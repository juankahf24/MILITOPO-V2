/* MILITOPO V2 · P0.1 · Track GPS duradero y sincronización idempotente.
   - IndexedDB es la fuente de verdad de puntos PENDIENTES, sin poda silenciosa.
   - Migra la cola legacy de localStorage de forma reversible: solo elimina el
     original DESPUÉS de confirmar la transacción de IndexedDB.
   - Secuencia persistente por participación, incluso con cola vacía.
   - Un ACK de RTDB precede SIEMPRE al borrado local. Reintentos usan idénticas claves.
   - No borra carreras antiguas ni cachés. Fallos de almacenamiento son visibles. */
import { ref, update } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const VERSION = "v2-p01-durable-track-20261023";
const DB_NAME = "militopo_v2_runner_tracks";
const DB_VERSION = 1;
const FLUSH_BATCH = 24;
const FLUSH_INTERVAL_MS = 7000;
const ACK_TIMEOUT_MS = 12000;

const state = {
  services: null, context: null, key: "", queue: [], active: false,
  flushing: false, timer: null, sent: 0, lastError: "", lastSeq: 0,
  storageFailed: false, storageFailures: 0, hasStorageGap: false,
  recordChain: Promise.resolve(), dbPromise: null
};

async function services() {
  if (!state.services) state.services = await globalThis.MILITOPO_V2.firebase();
  return state.services;
}
function emit(status, detail = {}) {
  globalThis.dispatchEvent(new CustomEvent("militopo:v2-track-status", {
    detail: {
      status, version: VERSION, pending: state.queue.length, sent: state.sent,
      online: navigator.onLine !== false, storageFailed: state.storageFailed,
      storageFailures: state.storageFailures, hasStorageGap: state.hasStorageGap, ...detail
    }
  }));
}
function legacyKey(context = state.context) {
  if (!context?.uid || !context?.eventId || !context?.runId) return "";
  return `militopo_v2_track_${context.uid}_${context.eventId}_${context.runId}`;
}
function storageKey(context = state.context) {
  const oldKey = legacyKey(context);
  return oldKey && context?.ownerUid ? `${oldKey}_${context.ownerUid}` : "";
}
function pointId(point) {
  return `p_${String(point.at)}_${String(point.seq).padStart(5, "0")}`;
}
function trackBasePath(context = state.context) {
  if (!context?.ownerUid || !context?.eventId || !context?.runId || !context?.uid) return "";
  return `v2/live/${context.ownerUid}/${context.eventId}/runs/${context.runId}/tracks/${context.uid}`;
}
function normalizeFix(fix) {
  if (!fix) return null;
  const lat = Number(fix.lat), lng = Number(fix.lng);
  const accuracy = Number(fix.accuracy ?? 0);
  const at = Number(fix.updatedAt ?? Date.now());
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 ||
      !Number.isFinite(lng) || lng < -180 || lng > 180 ||
      !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 5000 ||
      !Number.isFinite(at) || at <= 0) return null;
  return { lat, lng, accuracy: Math.round(accuracy * 10) / 10, at };
}
function cleanPendingPoint(value) {
  const p = normalizeFix({ ...value, updatedAt: value?.at });
  const seq = Number(value?.seq);
  if (!p || !Number.isSafeInteger(seq) || seq < 1) return null;
  return { ...p, seq };
}
function openDb() {
  if (state.dbPromise) return state.dbPromise;
  state.dbPromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error("IndexedDB no disponible en este navegador.")); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("points")) {
        const store = db.createObjectStore("points", { keyPath: "id" });
        store.createIndex("byRunSeq", ["runKey", "seq"], { unique: false });
      }
      if (!db.objectStoreNames.contains("sessions")) db.createObjectStore("sessions", { keyPath: "runKey" });
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); state.dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => reject(req.error || new Error("No se pudo abrir IndexedDB."));
    req.onblocked = () => reject(new Error("IndexedDB bloqueada por otra pestaña."));
  }).catch(error => { state.dbPromise = null; throw error; });
  return state.dbPromise;
}
function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error("Transacción IndexedDB cancelada."));
    tx.onerror = () => reject(tx.error || new Error("Error de escritura IndexedDB."));
  });
}
function requestResult(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Lectura IndexedDB fallida."));
  });
}
function failStorage(error) {
  state.storageFailed = true;
  state.storageFailures += 1;
  state.hasStorageGap = true;
  state.lastError = String(error?.message || error);
  emit("storage_error", { message: state.lastError });
}
async function listPending(db, runKey) {
  const tx = db.transaction("points", "readonly");
  const index = tx.objectStore("points").index("byRunSeq");
  const range = IDBKeyRange.bound([runKey, 0], [runKey, Number.MAX_SAFE_INTEGER]);
  const rows = await requestResult(index.getAll(range));
  await transactionDone(tx);
  return rows.map(({ id, runKey: ignored, ...p }) => p);
}
async function initRun(context) {
  const db = await openDb();
  const runKey = storageKey(context), oldKey = legacyKey(context);
  if (!runKey) throw new Error("Faltan datos de carrera para proteger el GPS.");
  // Importar sin recortar los 2.200 puntos heredados. Si falla el proceso, NO
  // eliminar el respaldo de localStorage. Las claves repetidas se sobrescriben.
  const raw = localStorage.getItem(oldKey);
  if (raw !== null) {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("La cola GPS antigua no es válida; se conserva sin modificar.");
    const oldPoints = parsed.map(cleanPendingPoint);
    if (oldPoints.some(p => !p)) throw new Error("Hay puntos GPS antiguos ilegibles; se conserva el original.");
    if (oldPoints.length) {
      const tx = db.transaction(["points", "sessions"], "readwrite");
      const points = tx.objectStore("points");
      const session = tx.objectStore("sessions");
      const previous = await requestResult(session.get(runKey));
      const high = Math.max(Number(previous?.lastSeq || 0), ...oldPoints.map(p => p.seq));
      for (const p of oldPoints) points.put({ ...p, runKey, id: `${runKey}|${pointId(p)}` });
      session.put({ runKey, lastSeq: high, hasStorageGap: Boolean(previous?.hasStorageGap), storageFailures: Number(previous?.storageFailures || 0) });
      await transactionDone(tx);
    }
    // Si removeItem falla, se reimportará idempotentemente la siguiente vez.
    try { localStorage.removeItem(oldKey); } catch (_) {}
  }
  const tx = db.transaction("sessions", "readonly");
  const session = await requestResult(tx.objectStore("sessions").get(runKey));
  await transactionDone(tx);
  const queue = await listPending(db, runKey);
  return {
    queue, lastSeq: Math.max(Number(session?.lastSeq || 0), Number(queue.at(-1)?.seq || 0), Date.now() - 1),
    hasStorageGap: Boolean(session?.hasStorageGap), storageFailures: Number(session?.storageFailures || 0)
  };
}
async function storePoint(runKey, point) {
  const db = await openDb();
  const tx = db.transaction(["points", "sessions"], "readwrite");
  const stores = { points: tx.objectStore("points"), sessions: tx.objectStore("sessions") };
  stores.points.put({ ...point, runKey, id: `${runKey}|${pointId(point)}` });
  stores.sessions.put({ runKey, lastSeq: point.seq, hasStorageGap: state.hasStorageGap, storageFailures: state.storageFailures });
  await transactionDone(tx);
}
async function deleteAcknowledged(runKey, points) {
  const db = await openDb();
  const tx = db.transaction("points", "readwrite");
  const store = tx.objectStore("points");
  for (const p of points) store.delete(`${runKey}|${pointId(p)}`);
  await transactionDone(tx);
}
function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("Firebase no ha confirmado el envío a tiempo; los puntos continúan pendientes.")), ms); })
  ]).finally(() => clearTimeout(timer));
}
async function flush({ force = false } = {}) {
  // Si hay un punto guardándose, no enviar antes de confirmar su durabilidad.
  await state.recordChain;
  if (state.flushing) return false;
  if (!state.queue.length) { if (!state.storageFailed) emit("synced"); return !state.storageFailed; }
  const context = state.context ? { ...state.context } : null;
  const base = trackBasePath(context), runKey = storageKey(context);
  if (!base || !runKey) return false;
  if (navigator.onLine === false) {
    emit("offline", { message: "Sin conexión. El track está en el dispositivo." });
    return false;
  }
  state.flushing = true;
  emit("syncing");
  try {
    const { database } = await services();
    do {
      if (navigator.onLine === false || state.key !== runKey) break;
      const batch = state.queue.slice(0, FLUSH_BATCH);
      if (!batch.length) break;
      const payload = {};
      for (const p of batch) payload[`${base}/${pointId(p)}`] = p;
      await withTimeout(update(ref(database), payload), ACK_TIMEOUT_MS);
      // P0: si se cierra la app tras el ACK pero antes del borrado, se reenvían
      // los mismos IDs, nunca se crean puntos duplicados.
      await deleteAcknowledged(runKey, batch);
      if (state.key !== runKey) break;
      state.queue.splice(0, batch.length);
      state.sent += batch.length;
      state.lastError = "";
      state.storageFailed = false;
      emit(state.queue.length ? "syncing" : "synced");
    } while (force && state.queue.length);
    return state.queue.length === 0 && !state.storageFailed;
  } catch (error) {
    state.lastError = String(error?.message || error);
    emit(navigator.onLine === false ? "offline" : "error", { message: state.lastError });
    return false;
  } finally { state.flushing = false; }
}
async function start(context) {
  if (state.active && state.key === storageKey(context)) return true;
  if (state.flushing) { failStorage(new Error("Hay una sincronización GPS anterior en curso.")); return false; }
  await state.recordChain;
  state.active = false;
  try {
    const initial = await initRun(context);
    state.context = { ...context };
    state.key = storageKey(context);
    state.queue = initial.queue;
    state.lastSeq = initial.lastSeq;
    state.storageFailures = initial.storageFailures;
    state.hasStorageGap = initial.hasStorageGap;
    state.sent = 0;
    state.storageFailed = false;
    state.lastError = "";
    state.active = true;
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(() => flush().catch(() => {}), FLUSH_INTERVAL_MS);
    emit(state.queue.length ? "queued" : "ready", { recovered: state.queue.length });
    if (navigator.onLine !== false && state.queue.length) flush().catch(() => {});
    return true;
  } catch (error) { failStorage(error); return false; }
}
function record(fix) {
  if (!state.active || !state.key) return Promise.resolve(false);
  const p = normalizeFix(fix), runKey = state.key;
  if (!p) { failStorage(new Error("Posición GPS inválida; no se ha guardado.")); return Promise.resolve(false); }
  const work = async () => {
    if (runKey !== state.key) return false;
    p.seq = Math.max(state.lastSeq + 1, Date.now());
    await storePoint(runKey, p);
    state.lastSeq = p.seq;
    state.queue.push(p);
    state.storageFailed = false;
    state.lastError = "";
    emit(navigator.onLine === false ? "offline" : "queued", { point: { ...p } });
    if (navigator.onLine !== false && state.queue.length >= 6) flush().catch(() => {});
    return true;
  };
  const result = state.recordChain.then(work).catch(error => { failStorage(error); return false; });
  state.recordChain = result.then(() => {});
  return result;
}
async function stop({ flushPending = true } = {}) {
  state.active = false;
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
  await state.recordChain;
  const ok = flushPending ? await flush({ force: true }) : state.queue.length === 0;
  emit(state.queue.length ? "queued" : "stopped");
  return ok;
}
function snapshot() {
  return {
    active: state.active, pending: state.queue.length, sent: state.sent,
    lastError: state.lastError, online: navigator.onLine !== false,
    storageFailed: state.storageFailed, storageFailures: state.storageFailures,
    hasStorageGap: state.hasStorageGap
  };
}
window.addEventListener("online", () => { emit("online"); flush({ force: true }).catch(() => {}); });
window.addEventListener("offline", () => emit("offline", { message: "Sin conexión. Guardando el track en el dispositivo." }));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") flush().catch(() => {});
});
// IndexedDB confirma las escrituras DURANTE la carrera. No borrar al salir.
window.MILITOPO_RUNNER_TRACK_V2 = Object.freeze({ start, record, flush, stop, snapshot });
