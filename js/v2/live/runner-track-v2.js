/* MILITOPO V2 · G2 · Track GPS persistente + cola offline.
   Guarda puntos localmente durante la carrera y los sincroniza por lotes con RTDB.
   La cola sobrevive a recargas/cortes de red y se vacía al recuperar conexión. */
import { ref, update } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const VERSION = "v2-g2-track-offline-20260924";
const MAX_QUEUE = 2200;
const FLUSH_BATCH = 24;
const FLUSH_INTERVAL_MS = 7000;

const state = {
  services: null,
  context: null,
  queue: [],
  active: false,
  flushing: false,
  timer: null,
  lastPoint: null,
  sent: 0,
  lastError: "",
  key: ""
};

async function services() {
  if (!state.services) state.services = await globalThis.MILITOPO_V2.firebase();
  return state.services;
}

function emit(status, detail = {}) {
  globalThis.dispatchEvent(new CustomEvent("militopo:v2-track-status", {
    detail: {
      status,
      version: VERSION,
      pending: state.queue.length,
      sent: state.sent,
      online: navigator.onLine !== false,
      ...detail
    }
  }));
}

function storageKey(context = state.context) {
  if (!context?.uid || !context?.eventId || !context?.runId) return "";
  return `militopo_v2_track_${context.uid}_${context.eventId}_${context.runId}`;
}

function safeLoad(key) {
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data.slice(-MAX_QUEUE) : [];
  } catch (_) {
    return [];
  }
}

function persist() {
  if (!state.key) return;
  try {
    if (state.queue.length) localStorage.setItem(state.key, JSON.stringify(state.queue.slice(-MAX_QUEUE)));
    else localStorage.removeItem(state.key);
  } catch (_) {}
}

function pointId(point) {
  const at = Math.max(0, Number(point?.at || Date.now()));
  const seq = Math.max(0, Number(point?.seq || 0));
  return `p_${String(at)}_${String(seq).padStart(5, "0")}`;
}

function trackBasePath() {
  const c = state.context;
  if (!c?.ownerUid || !c?.eventId || !c?.runId || !c?.uid) return "";
  return `v2/live/${c.ownerUid}/${c.eventId}/runs/${c.runId}/tracks/${c.uid}`;
}

function normalizeFix(fix) {
  if (!fix) return null;
  const lat = Number(fix.lat);
  const lng = Number(fix.lng);
  const accuracy = Math.max(0, Number(fix.accuracy || 0));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    accuracy: Math.round(accuracy * 10) / 10,
    at: Math.max(0, Number(fix.updatedAt || Date.now()))
  };
}

async function flush({ force = false } = {}) {
  if (state.flushing || !state.queue.length || !trackBasePath()) {
    if (!state.queue.length) emit("synced");
    return state.queue.length === 0;
  }
  if (!force && navigator.onLine === false) {
    emit("offline", { message: "Sin conexión. El recorrido sigue guardándose en el dispositivo." });
    return false;
  }

  state.flushing = true;
  emit("syncing");
  try {
    const { database } = await services();
    while (state.queue.length && (force || navigator.onLine !== false)) {
      const batch = state.queue.slice(0, FLUSH_BATCH);
      const payload = {};
      const base = trackBasePath();
      for (const p of batch) payload[`${base}/${pointId(p)}`] = p;
      await update(ref(database), payload);
      state.queue.splice(0, batch.length);
      state.sent += batch.length;
      persist();
      emit(state.queue.length ? "syncing" : "synced");
      if (!force) break;
    }
    state.lastError = "";
    return state.queue.length === 0;
  } catch (error) {
    state.lastError = String(error?.message || error);
    persist();
    emit(navigator.onLine === false ? "offline" : "error", { message: state.lastError });
    return false;
  } finally {
    state.flushing = false;
  }
}

async function start(context) {
  state.context = { ...context };
  state.key = storageKey(context);
  state.queue = safeLoad(state.key);
  state.active = true;
  state.sent = 0;
  state.lastError = "";
  if (state.timer) clearInterval(state.timer);
  state.timer = setInterval(() => flush().catch(() => {}), FLUSH_INTERVAL_MS);
  emit(state.queue.length ? "queued" : "ready", { recovered: state.queue.length });
  if (navigator.onLine !== false && state.queue.length) flush().catch(() => {});
  return true;
}

function record(fix) {
  if (!state.active) return;
  const p = normalizeFix(fix);
  if (!p) return;
  const last = state.queue[state.queue.length - 1] || state.lastPoint;
  p.seq = Math.max(1, Number(last?.seq || 0) + 1);
  state.lastPoint = p;
  state.queue.push(p);
  if (state.queue.length > MAX_QUEUE) state.queue.splice(0, state.queue.length - MAX_QUEUE);
  persist();
  emit(navigator.onLine === false ? "offline" : "queued", { point: { ...p } });
  if (navigator.onLine !== false && state.queue.length >= 6) flush().catch(() => {});
}

async function stop({ flushPending = true } = {}) {
  state.active = false;
  if (state.timer) clearInterval(state.timer);
  state.timer = null;
  if (flushPending) await flush({ force: true });
  persist();
  emit(state.queue.length ? "queued" : "stopped");
  return state.queue.length === 0;
}

function snapshot() {
  return {
    active: state.active,
    pending: state.queue.length,
    sent: state.sent,
    lastError: state.lastError,
    online: navigator.onLine !== false
  };
}

window.addEventListener("online", () => {
  emit("online");
  flush({ force: true }).catch(() => {});
});
window.addEventListener("offline", () => emit("offline", { message: "Sin conexión. Guardando el track en el dispositivo." }));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") flush().catch(() => {});
});

// Intento final al abandonar la página: persistencia local ya está hecha; la sincronización se reanudará al volver.
window.addEventListener("pagehide", persist);

window.MILITOPO_RUNNER_TRACK_V2 = Object.freeze({ start, record, flush, stop, snapshot });
