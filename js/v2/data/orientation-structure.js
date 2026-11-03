/* MILITOPO V2 · Fase C2 · balizas y recorridos en Firestore.
   Mantiene localStorage/IndexedDB como red de seguridad. Solo escribe diferencias
   reales para no consumir cuota con el autoguardado periódico del organizador. */
import "../bootstrap.js";
import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  serverTimestamp,
  runTransaction
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const MANAGER_ROLES = new Set(["organizer", "super_admin"]);
const state = {
  auth: globalThis.MILITOPO_V2_AUTH || null,
  services: null,
  latest: null,
  saveQueue: [],
  timer: null,
  busy: false,
  rerun: false,
  remoteByEvent: new Map(),
  remoteRecheck: new Set(),
  cloudConflicts: new Set(),
  activeUid: String(globalThis.MILITOPO_V2_AUTH?.uid || ""),
  parentWaits: 0,
  epoch: 0,
  confirmedPacket: "",
  reviewBusy: false
};

function cleanRole(role) {
  return ["runner", "organizer", "super_admin"].includes(String(role || "")) ? String(role) : "runner";
}
function canManage(auth = state.auth) {
  return Boolean(auth?.uid && auth?.emailVerified && MANAGER_ROLES.has(cleanRole(auth.role)));
}
function finiteOrNull(value) {
  if (value === null || value === "" || typeof value === "undefined") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function cleanString(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}
function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((out, key) => {
    const v = value[key];
    if (typeof v !== "undefined") out[key] = stableObject(v);
    return out;
  }, {});
}
function stableJson(value) {
  return JSON.stringify(stableObject(value));
}
function hashPayload(value) {
  const text = stableJson(value);
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
function normalizeIof(raw = {}) {
  const out = {};
  ["c", "d", "e", "f", "g", "h", "combo", "text"].forEach(key => {
    const value = cleanString(raw?.[key], key === "text" ? 240 : 80);
    if (value) out[key] = value;
  });
  out.complete = raw?.complete === true;
  return out;
}
function normalizeCheckpoint(raw = {}) {
  return {
    checkpointId: cleanString(raw.checkpointId || raw.id, 80),
    type: ["SALIDA", "LLEGADA", "BALIZA"].includes(String(raw.type || "")) ? String(raw.type) : "BALIZA",
    description: cleanString(raw.description ?? raw.desc, 240),
    utm: cleanString(raw.utm, 120),
    lat: finiteOrNull(raw.lat),
    lon: finiteOrNull(raw.lon),
    elevationM: finiteOrNull(raw.elevationM ?? raw.elevation),
    iof: normalizeIof(raw.iof || {})
  };
}
function normalizeMetrics(raw = {}) {
  return {
    distanceKm: finiteOrNull(raw.distanceKm),
    longestKm: finiteOrNull(raw.longestKm),
    positiveM: finiteOrNull(raw.positiveM),
    negativeM: finiteOrNull(raw.negativeM),
    difficulty: cleanString(raw.difficulty, 40),
    quality: cleanString(raw.quality, 160),
    qualityCode: cleanString(raw.qualityCode, 40),
    routeMode: cleanString(raw.routeMode, 40)
  };
}
function normalizeCourse(raw = {}) {
  const routeId = cleanString(raw.routeId || raw.courseId, 80);
  return {
    courseId: routeId,
    routeId,
    routeDesignIndex: Math.max(0, Math.trunc(Number(raw.routeDesignIndex) || 0)),
    points: Array.isArray(raw.points) ? raw.points.map(x => cleanString(x, 80)).filter(Boolean).slice(0, 120) : [],
    assignedParticipantIds: Array.isArray(raw.assignedParticipantIds)
      ? [...new Set(raw.assignedParticipantIds.map(x => cleanString(x, 80)).filter(Boolean))].slice(0, 200)
      : [],
    metrics: normalizeMetrics(raw.metrics || {})
  };
}
function normalizePacket(detail = {}) {
  const eventId = cleanString(detail.eventId, 120);
  const checkpoints = Array.isArray(detail.checkpoints)
    ? detail.checkpoints.map(normalizeCheckpoint).filter(x => x.checkpointId)
    : [];
  const courses = Array.isArray(detail.courses)
    ? detail.courses.map(normalizeCourse).filter(x => x.courseId)
    : [];
  return {
    eventId,
    armed: Boolean(detail.armed),
    reason: cleanString(detail.reason, 80),
    requestId: cleanString(detail.requestId, 120),
    checkpoints,
    courses
  };
}

function ensureStatusNodes() {
  const nodes = [];
  ["step2", "step3"].forEach((stepId, index) => {
    const step = document.getElementById(stepId);
    if (!step) return;
    const id = `m2CloudStructureStatus${index + 2}`;
    let node = document.getElementById(id);
    if (!node) {
      node = document.createElement("div");
      node.id = id;
      node.className = "status warn";
      node.style.margin = "12px 0";
      node.textContent = "☁️ Estructura: esperando datos del evento.";
      const nav = step.querySelector(".nav-row");
      if (nav) nav.insertAdjacentElement("beforebegin", node);
      else step.appendChild(node);
    }
    nodes.push(node);
  });
  return nodes;
}
function paintStatus(text, kind = "warn") {
  paintConflictAction();
  ensureStatusNodes().forEach(node => {
    node.className = `status ${kind}`;
    node.textContent = text;
  });
}
async function services() {
  if (state.services) return state.services;
  state.services = await globalThis.MILITOPO_V2.firebase();
  return state.services;
}
function confirmStructureSave(packet, ok, error="") {
  if (!packet?.requestId) return;
  const index=state.saveQueue.indexOf(packet);
  if(index<0)return;
  state.saveQueue.splice(index,1);
  try {
    globalThis.dispatchEvent(new CustomEvent("militopo:v2-orientation-structure-save-result", {
      detail: { requestId: packet.requestId, eventId: packet.eventId, ok: ok === true, error: String(error || "") }
    }));
  } catch (_) {}
}
function scheduleSync(delay = 900) {
  clearTimeout(state.timer);
  state.timer = setTimeout(() => syncLatest().catch(error => {
    console.error("[MILITOPO C2] sync", error);
    paintStatus("⚠️ Nube: no se pudieron sincronizar balizas/recorridos. La copia local sigue intacta.", "warn");
  }), delay);
}
// F2.29: recuerda únicamente una huella de la última estructura CONFIRMADA,
// separada por cuenta y carrera. No almacena puntos nuevos ni modifica la cola.
function baselineKey(eventId) {
  return `militopo_c2_confirmed_${encodeURIComponent(String(state.auth?.uid || ""))}_${encodeURIComponent(eventId)}`;
}
function remoteFingerprint(remote) {
  return hashPayload({
    checkpoints: [...remote.checkpoints].sort((a,b)=>a[0].localeCompare(b[0])),
    courses: [...remote.courses].sort((a,b)=>a[0].localeCompare(b[0]))
  });
}
function remoteDocumentHash(data) {
  const hash=cleanString(data?.contentHash,32);
  if (hash) return hash;
  // Documentos anteriores al campo contentHash: detectar igualmente cambios
  // de contenido, ignorando los metadatos temporales del propio guardado.
  const content={...data};
  ["contentHash","createdAt","updatedAt","schemaVersion"].forEach(k=>delete content[k]);
  return `legacy:${hashPayload(content)}`;
}
function savedFingerprint(eventId) {
  try { return localStorage.getItem(baselineKey(eventId)) || ""; } catch (_) { return ""; }
}
function rememberConfirmedRemote(eventId, remote) {
  state.remoteByEvent.set(eventId, remote);
  state.remoteRecheck.delete(eventId);
  try { localStorage.setItem(baselineKey(eventId), remoteFingerprint(remote)); } catch (_) {}
}
async function loadRemoteIndex(firestore, eventId, verifyFresh = false, validateContext = () => {}) {
  validateContext();
  const known = state.remoteByEvent.get(eventId);
  if (known && !verifyFresh) return known;
  paintStatus("☁️ Comprobando cambios de balizas y recorridos en Firestore…", "warn");
  const [checkpointSnap, courseSnap] = await Promise.all([
    getDocsFromServer(collection(firestore, "events", eventId, "checkpoints")),
    getDocsFromServer(collection(firestore, "events", eventId, "courses"))
  ]);
  validateContext();
  const remote = { checkpoints: new Map(), courses: new Map(), documents: new Map() };
  checkpointSnap.forEach(snap => { remote.checkpoints.set(snap.id, remoteDocumentHash(snap.data() || {})); remote.documents.set(`checkpoints/${snap.id}`, stableJson(snap.data() || {})); });
  courseSnap.forEach(snap => { remote.courses.set(snap.id, remoteDocumentHash(snap.data() || {})); remote.documents.set(`courses/${snap.id}`, stableJson(snap.data() || {})); });
  const expected = known ? remoteFingerprint(known) : savedFingerprint(eventId);
  if (expected && expected !== remoteFingerprint(remote)) {
    markConflict(eventId);
    throw new Error("Conflicto: las balizas o recorridos cambiaron en la nube. No se ha sobrescrito la versión remota. Conserva tu borrador local y revisa la carrera antes de volver a guardar.");
  }
  state.remoteByEvent.set(eventId, remote);
  state.remoteRecheck.delete(eventId);
  return remote;
}
function packetSignature(packet) {
  return stableJson({ eventId: packet.eventId, armed: packet.armed, checkpoints: packet.checkpoints, courses: packet.courses });
}
function desiredMap(items, keyName) {
  const map = new Map();
  items.forEach(item => {
    const id = cleanString(item?.[keyName], 120);
    if (!id) return;
    const payload = stableObject(item);
    map.set(id, { payload, hash: hashPayload(payload) });
  });
  return map;
}
async function syncLatest(review = null) {
  // Solicitudes expresas de GUARDAR Y SALIR no se pierden por un
  // evento de autosave posterior que sustituya state.latest.
  const packet = state.saveQueue[0] || state.latest;
  const uid = String(state.auth?.uid || ""), epoch = state.epoch;
  const current = () => state.epoch === epoch && String(state.auth?.uid || "") === uid &&
    state.latest?.eventId === packet?.eventId && canManage();
  const assertCurrent = () => { if (review) assertReviewCurrent(review); if (!current()) throw new Error("La carrera o la cuenta han cambiado. No se confirma este guardado."); };
  if (!packet?.armed || !packet.eventId) {
    confirmStructureSave(packet,false,"No hay una carrera activa para sincronizar");
    paintStatus("☁️ Estructura: confirma primero el PASO 1.", "warn");
    return false;
  }
  if (state.cloudConflicts.has(packet.eventId) && !review) {
    confirmStructureSave(packet,false,"Conflicto de edición con Firestore");
    paintStatus("⚠️ La carrera cambió en la nube. No se sobrescribirán balizas ni recorridos. Revisa las versiones antes de continuar.", "err");
    return false;
  }
  if (!canManage()) {
    confirmStructureSave(packet,false,"Sesión o permisos no disponibles");
    paintStatus("🔒 Estructura: requiere rol organizer o super_admin con correo verificado.", "warn");
    return false;
  }
  const editLock = globalThis.MILITOPO_V2_EVENT_EDIT_LOCK;
  if (editLock?.locked && (!editLock.eventId || String(editLock.eventId) === packet.eventId)) {
    confirmStructureSave(packet,false,"La carrera no está editable");
    paintStatus(`🔒 Estructura bloqueada en ${String(editLock.label || editLock.status || "PUBLICADO")}. Firestore conserva la versión publicada.`, "warn");
    return false;
  }
  if (!navigator.onLine) {
    confirmStructureSave(packet,false,"Sin conexión");
    paintStatus("📴 Sin conexión: balizas y recorridos siguen protegidos localmente.", "warn");
    return false;
  }
  if (state.busy) {
    state.rerun = true;
    return false;
  }

  state.busy = true;
  try {
    const { firestore } = await services();
    assertCurrent();
    const eventRef = doc(firestore, "events", packet.eventId);
    const eventSnap = await getDocFromServer(eventRef);
    assertCurrent();
    if (!eventSnap.exists()) {
      state.parentWaits += 1;
      // El guardado explícito no se declara correcto si aún falta la cabecera.
      confirmStructureSave(packet,false,"Falta confirmar la carrera en Firestore");
      paintStatus("☁️ Estructura: esperando a que C1 cree la cabecera del evento…", "warn");
      if (state.parentWaits <= 5) scheduleSync(1400);
      return false;
    }
    state.parentWaits = 0;
    const eventData = review ? review.header : (eventSnap.data() || {});
    if (review) assertReviewCurrent(review);
    if (String(eventData.ownerUid || "") !== String(state.auth.uid || "")) {
      confirmStructureSave(packet,false,"El propietario de la carrera no coincide");
      paintStatus("🔒 Estructura: este evento pertenece a otra cuenta. No se ha sobrescrito nada.", "err");
      return false;
    }

    // Nunca usar el índice cacheado tras reconectar o confirmar GUARDAR Y SALIR.
    // Cualquier edición externa reconocible detiene la escritura antes del batch.
    const status=String(eventData.status || "draft").toLowerCase();
    if (!["draft","prepared"].includes(status)) {
      confirmStructureSave(packet,false,"Carrera no editable en la nube");
      paintStatus("🔒 La carrera ya no está en BORRADOR/PREPARADO en Firebase.", "err");
      return false;
    }
    // Nunca preparar escrituras usando un índice de otra sesión o anterior.
    const remote = review ? review.remote : await loadRemoteIndex(firestore, packet.eventId, true, assertCurrent);
    assertCurrent();
    const wantedCheckpoints = desiredMap(packet.checkpoints, "checkpointId");
    const wantedCourses = desiredMap(packet.courses, "courseId");
    const operations = [];
    const batch = {
      set: (ref, data, options) => operations.push({ kind: "set", ref, data, options }),
      delete: ref => operations.push({ kind: "delete", ref })
    };
    const checkedPaths = new Set([
      ...remote.documents.keys(),
      ...[...wantedCheckpoints.keys()].map(id => `checkpoints/${id}`),
      ...[...wantedCourses.keys()].map(id => `courses/${id}`)
    ]);
    const conflict = () => { throw Object.assign(new Error("La estructura cambió durante el guardado. Se conserva la copia local y no se sobrescribe la nube."), { structureConflict: true }); };
    const commitChecked = () => runTransaction(firestore, async tx => {
      assertCurrent();
      const headerSnap = await tx.get(eventRef);
      if (!headerSnap.exists()) conflict();
      const header = headerSnap.data() || {};
      if (header.ownerUid !== uid || !["draft", "prepared"].includes(String(header.status || "draft"))) conflict();
      if (stableJson(header.structureUpdatedAt || null) !== stableJson(eventData.structureUpdatedAt || null)) conflict();
      // Leer todos los documentos conocidos, incluidos los que no iban a cambiar.
      // Así un reintento no acepta silenciosamente una edición concurrente.
      const refs = [...checkedPaths].map(path => doc(firestore, "events", packet.eventId, ...path.split("/")));
      const snapshots = await Promise.all(refs.map(ref => tx.get(ref)));
      snapshots.forEach((snap, index) => {
        const expected = remote.documents.get([...checkedPaths][index]);
        if (snap.exists() ? stableJson(snap.data() || {}) !== expected : expected !== undefined) conflict();
      });
      assertCurrent();
      for (const op of operations) {
        if (op.kind === "delete") tx.delete(op.ref);
        else tx.set(op.ref, op.data, op.options);
      }
    });
    let mutations = 0;

    for (const [id, item] of wantedCheckpoints) {
      if (remote.checkpoints.get(id) === item.hash && (!review || stableJson(normalizeCheckpoint(JSON.parse(remote.documents.get(`checkpoints/${id}`)))) === stableJson(item.payload))) continue;
      const ref = doc(firestore, "events", packet.eventId, "checkpoints", id);
      const isNew = !remote.checkpoints.has(id);
      batch.set(ref, {
        ...item.payload,
        contentHash: item.hash,
        schemaVersion: 1,
        ...(isNew ? { createdAt: serverTimestamp() } : {}),
        updatedAt: serverTimestamp()
      }, { merge: true });
      mutations += 1;
    }
    for (const id of remote.checkpoints.keys()) {
      if (wantedCheckpoints.has(id)) continue;
      batch.delete(doc(firestore, "events", packet.eventId, "checkpoints", id));
      mutations += 1;
    }

    for (const [id, item] of wantedCourses) {
      if (remote.courses.get(id) === item.hash && (!review || stableJson(normalizeCourse(JSON.parse(remote.documents.get(`courses/${id}`)))) === stableJson(item.payload))) continue;
      const ref = doc(firestore, "events", packet.eventId, "courses", id);
      const isNew = !remote.courses.has(id);
      batch.set(ref, {
        ...item.payload,
        contentHash: item.hash,
        schemaVersion: 1,
        ...(isNew ? { createdAt: serverTimestamp() } : {}),
        updatedAt: serverTimestamp()
      }, { merge: true });
      mutations += 1;
    }
    for (const id of remote.courses.keys()) {
      if (wantedCourses.has(id)) continue;
      batch.delete(doc(firestore, "events", packet.eventId, "courses", id));
      mutations += 1;
    }

    const locatedCount = packet.checkpoints.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon)).length;
    const parentNeedsUpdate = String(eventData.cloudStage || "") !== "C2"
      || Number(eventData.checkpointSyncedCount ?? -1) !== packet.checkpoints.length
      || Number(eventData.locatedCheckpointCount ?? -1) !== locatedCount
      || Number(eventData.courseSyncedCount ?? -1) !== packet.courses.length;

    if (mutations || parentNeedsUpdate) {
      batch.set(eventRef, {
        cloudStage: "C2",
        checkpointSyncedCount: packet.checkpoints.length,
        locatedCheckpointCount: locatedCount,
        courseSyncedCount: packet.courses.length,
        structureUpdatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      mutations += 1;
      paintStatus("☁️ Guardando balizas y recorridos en Firestore…", "warn");
      if (operations.length > 450) throw new Error("Demasiados cambios para un único guardado seguro. Conservamos el borrador local; revisa el tamaño de la carrera.");
      await commitChecked();
      assertCurrent();

      remote.checkpoints = new Map([...wantedCheckpoints].map(([id, item]) => [id, item.hash]));
      remote.courses = new Map([...wantedCourses].map(([id, item]) => [id, item.hash]));
      rememberConfirmedRemote(packet.eventId, remote);
      if (review) clearConflict(packet.eventId);
      state.confirmedPacket = packetSignature(packet);
      paintStatus(`✅ Estructura sincronizada · ${packet.checkpoints.length} puntos · ${packet.courses.length} recorridos`, "ok");
      try { globalThis.dispatchEvent(new CustomEvent("militopo:v2-orientation-structure-synced", { detail: { eventId: packet.eventId, checkpointCount: packet.checkpoints.length, courseCount: packet.courses.length, changed: true, reason: packet.reason } })); } catch (_) {}
      confirmStructureSave(packet, true);
      return true;
    }

    await commitChecked();
    assertCurrent();
    rememberConfirmedRemote(packet.eventId, remote);
      if (review) clearConflict(packet.eventId);
    state.confirmedPacket = packetSignature(packet);
    paintStatus(`☁️ Estructura al día · ${packet.checkpoints.length} puntos · ${packet.courses.length} recorridos`, "ok");
    try { globalThis.dispatchEvent(new CustomEvent("militopo:v2-orientation-structure-synced", { detail: { eventId: packet.eventId, checkpointCount: packet.checkpoints.length, courseCount: packet.courses.length, changed: false, reason: packet.reason } })); } catch (_) {}
    confirmStructureSave(packet, true);
    return true;
  } catch (error) {
    if (!current()) { confirmStructureSave(packet, false, "La carrera o la cuenta han cambiado"); return false; }
    state.remoteRecheck.add(packet.eventId);
    if (error?.structureConflict) markConflict(packet.eventId);
    confirmStructureSave(packet, false, error?.message || "Error de Firestore");
    if (state.cloudConflicts.has(packet.eventId)) {
      paintStatus("⚠️ Conflicto con otra edición en la nube. No se ha sobrescrito la carrera. Conserva el borrador local y revisa la carrera.", "err");
      return false;
    }
    throw error;
  } finally {
    state.busy = false;
    if (state.rerun || state.saveQueue.length) {
      state.rerun = false;
      scheduleSync(state.saveQueue.length ? 0 : 300);
    }
  }
}
function acceptPacket(detail) {
  const next = normalizePacket(detail);
  if (state.latest && state.latest.eventId !== next.eventId) {
    state.epoch += 1;
    document.getElementById("m2ConflictDialog")?.close();
    state.confirmedPacket = "";
    for (const pending of [...state.saveQueue]) confirmStructureSave(pending, false, "La carrera seleccionada ha cambiado");
  }
  state.latest = next;
  try { if (localStorage.getItem(conflictKey(next.eventId))) state.cloudConflicts.add(next.eventId); } catch (_) {}
  paintConflictAction();
  if (!state.busy && !state.saveQueue.length && !next.requestId && next.armed && !state.remoteRecheck.has(next.eventId) &&
      !state.cloudConflicts.has(next.eventId) && packetSignature(next) === state.confirmedPacket) return;
  if (state.latest.requestId) state.saveQueue.push(state.latest);
  if (!state.latest.armed) {
    confirmStructureSave(state.latest,false,"La estructura todavía no está habilitada");
    paintStatus("☁️ Estructura: confirma primero el PASO 1.", "warn");
    return;
  }
  const fastReasons = new Set(["step1-confirmed", "r2-config-live", "step2-confirmed", "routes-generated", "route-regenerated", "r2-manual-route", "premium-save-exit"]);
  scheduleSync(fastReasons.has(state.latest.reason) ? 60 : 1100);
}
function onAuthReady(event) {
  state.auth = event?.detail || globalThis.MILITOPO_V2_AUTH || null;
  const uid=String(state.auth?.uid || "");
  if (uid !== state.activeUid) {
    state.epoch += 1;
    state.confirmedPacket = "";
    clearTimeout(state.timer);
    for (const pending of [...state.saveQueue]) confirmStructureSave(pending, false, "La cuenta ha cambiado");
    state.latest = null;
    state.remoteByEvent.clear();
    state.remoteRecheck.clear();
    state.cloudConflicts.clear();
    state.activeUid=uid;
    document.getElementById("m2ConflictDialog")?.close();
    paintConflictAction();
  }
  if (state.latest?.armed) {
    state.remoteRecheck.add(state.latest.eventId);
    scheduleSync(180);
  }
}
// F2.42: revisión explícita, copia de ambas estructuras y resolución condicionada.
function conflictKey(eventId) { return `${baselineKey(eventId)}_conflict`; }
function markConflict(eventId) {
  state.cloudConflicts.add(eventId);
  try { localStorage.setItem(conflictKey(eventId), "1"); } catch (_) {}
}
function clearConflict(eventId) {
  // Si no puede persistirse el desbloqueo, la siguiente apertura seguirá bloqueada.
  try { localStorage.removeItem(conflictKey(eventId)); } catch (_) {}
  state.cloudConflicts.delete(eventId);
}
function assertReviewCurrent(review) {
  if (!navigator.onLine || !canManage() || state.epoch !== review.epoch ||
      state.auth.uid !== review.uid || !state.latest?.armed ||
      state.latest.eventId !== review.eventId || packetSignature(state.latest) !== review.signature) {
    throw new Error("La cuenta, conexión o borrador han cambiado. Cierra y vuelve a revisar las versiones.");
  }
}
async function prepareConflictReview() {
  if (state.busy || state.saveQueue.length) throw new Error("Espera a que termine el guardado antes de revisar.");
  const local = normalizePacket(state.latest || {});
  const review = { uid: state.auth?.uid, epoch: state.epoch, eventId: local.eventId,
    signature: packetSignature(local), local, savedAt: new Date().toISOString() };
  assertReviewCurrent(review);
  if (!state.cloudConflicts.has(local.eventId)) throw new Error("No hay un conflicto pendiente en esta carrera.");
  const { firestore } = await services();
  assertReviewCurrent(review);
  const ref = doc(firestore, "events", local.eventId);
  const first = await getDocFromServer(ref);
  const [points, courses] = await Promise.all([
    getDocsFromServer(collection(firestore, "events", local.eventId, "checkpoints")),
    getDocsFromServer(collection(firestore, "events", local.eventId, "courses"))
  ]);
  const last = await getDocFromServer(ref);
  assertReviewCurrent(review);
  if (!first.exists() || !last.exists()) throw new Error("La carrera ya no existe.");
  const header = last.data();
  if (header.ownerUid !== review.uid || !["draft", "prepared"].includes(header.status)) throw new Error("La carrera ya no es editable por esta cuenta.");
  if (stableJson(first.data().structureUpdatedAt || null) !== stableJson(header.structureUpdatedAt || null)) throw new Error("La nube cambió mientras se leía. Vuelve a revisar.");
  const remote = {checkpoints: new Map(), courses: new Map(), documents: new Map()};
  points.forEach(snap => {remote.checkpoints.set(snap.id, remoteDocumentHash(snap.data()));remote.documents.set(`checkpoints/${snap.id}`, stableJson(snap.data()));});
  courses.forEach(snap => {remote.courses.set(snap.id, remoteDocumentHash(snap.data()));remote.documents.set(`courses/${snap.id}`, stableJson(snap.data()));});
  return {...review, header, remote};
}
function reviewDifferences(review) {
  const rows = [];
  for (const [group, items, key, normalize] of [["checkpoints", review.local.checkpoints, "checkpointId", normalizeCheckpoint], ["courses", review.local.courses, "courseId", normalizeCourse]]) {
    const local = new Map(items.map(item => [item[key], item]));
    for (const id of new Set([...local.keys(), ...review.remote[group].keys()])) {
      const raw = review.remote.documents.get(`${group}/${id}`);
      const cloud = raw === undefined ? null : normalize({...JSON.parse(raw), [key]: id});
      const mine = local.get(id) || null;
      if (stableJson(mine) !== stableJson(cloud)) rows.push({group, id, local: mine, cloud});
    }
  }
  return rows;
}
function readableVersion(value) {
  if (!value) return "No existe";
  const names = {checkpointId:"Identificador",type:"Tipo",description:"Descripción",utm:"UTM",lat:"Latitud",lon:"Longitud",elevationM:"Altitud (m)",iof:"Descripción IOF",courseId:"Recorrido",routeId:"Recorrido",routeDesignIndex:"Índice de diseño",points:"Orden de puntos",assignedParticipantIds:"Plazas asignadas",metrics:"Métricas",distanceKm:"Distancia (km)",longestKm:"Tramo mayor (km)",positiveM:"Ascenso (m)",negativeM:"Descenso (m)",difficulty:"Dificultad",quality:"Calidad",qualityCode:"Código de calidad",routeMode:"Modo",complete:"Completo",text:"Texto"};
  const show = (object, indent="") => Object.entries(object).filter(([key])=>key!=="routeId").map(([key,v])=>`${indent}${names[key] || key}: ${v === null ? "Sin dato" : Array.isArray(v) ? (v.join(" → ") || "Ninguno") : typeof v === "object" ? "\n"+show(v,indent+"  ") : typeof v === "boolean" ? (v?"Sí":"No") : String(v)}`).join("\n");
  return show(value);
}
function reviewArchiveText(review) {
  assertReviewCurrent(review);
  const data = {format: "MILITOPO-structure-conflict-v1", savedAt: review.savedAt,
    eventId: review.eventId, ownerUid: review.uid,
    scope: "Balizas y recorridos. No incluye planos, itinerarios parciales ni resultados.",
    local: review.local, cloudHeader: review.header, cloudDocuments: Object.fromEntries([...review.remote.documents].map(([key, value]) => [key, JSON.parse(value)]))};
  return JSON.stringify(data, null, 2);
}
function archiveReview(review) {
  const text = reviewArchiveText(review);
  const key = `${baselineKey(review.eventId)}_review_${review.savedAt}_${globalThis.crypto.randomUUID()}`;
  try {
    localStorage.setItem(key, text);
    if (localStorage.getItem(key) !== text) throw new Error("Copia no verificable");
  } catch (_) { throw new Error("No se pudo conservar la copia local: comprueba el espacio y los permisos de almacenamiento. No se sustituirá la nube."); }
  return text;
}
async function resolveReviewedLocal(review) {
  assertReviewCurrent(review);
  if (state.busy || state.saveQueue.length) throw new Error("Hay otro guardado en curso. Espera y revisa de nuevo.");
  if (!state.cloudConflicts.has(review.eventId)) throw new Error("Este conflicto ya no está pendiente.");
  archiveReview(review); // Obligatoria antes de cualquier escritura remota.
  const ok = await syncLatest(review);
  if (!ok) throw new Error("No se ha confirmado la sustitución. La nube puede haber cambiado: cierra y vuelve a comparar.");
  return true;
}
function archivedReviews(eventId) {
  const prefix = `${baselineKey(eventId)}_review_`;
  const copies = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) copies.push(JSON.parse(localStorage.getItem(key)));
  }
  return copies;
}
function downloadReview(text, eventId) {
  const url = URL.createObjectURL(new Blob([text], {type: "application/json"}));
  const link = document.createElement("a");
  link.href = url; link.download = `MILITOPO_conflicto_${eventId.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
function paintConflictAction() {
  let banner = document.getElementById("m2ConflictAction");
  const visible = canManage() && state.latest && state.cloudConflicts.has(state.latest.eventId);
  if (!visible) { banner?.remove(); return; }
  if (banner || !document.body) return;
  banner = document.createElement("aside"); banner.id = "m2ConflictAction";
  banner.style.cssText = "position:fixed;bottom:16px;left:16px;right:16px;z-index:2147483000;padding:14px;background:#fff5d9;color:#182d22;border:2px solid #ad7914;border-radius:16px;box-shadow:0 4px 20px #0003;display:flex;gap:12px;align-items:center;flex-wrap:wrap";
  const text = document.createElement("span"); text.textContent = "Guardado detenido: hay otra versión de balizas o recorridos.";
  const button = document.createElement("button"); button.type = "button";button.textContent = "Comparar versiones";
  button.style.cssText = "padding:12px 18px;background:#205e43;color:white;border:0;border-radius:10px;font:inherit;cursor:pointer";
  button.addEventListener("click", openConflictReview);
  banner.append(text, button); document.body.appendChild(banner);
}
async function openConflictReview() {
  if (state.reviewBusy || document.getElementById("m2ConflictDialog")?.open) return;
  state.reviewBusy = true;
  const opener = document.activeElement;
  const dialog = document.createElement("dialog");dialog.id = "m2ConflictDialog";
  dialog.setAttribute("aria-labelledby", "m2ConflictTitle");
  dialog.style.cssText = "width:min(680px,calc(100vw - 32px));max-height:85dvh;box-sizing:border-box;overflow:auto;border:2px solid #2b6548;border-radius:20px;padding:20px;background:#fff;color:#1b3025;font:16px system-ui;z-index:2147483647";
  const title = document.createElement("h2");title.id = "m2ConflictTitle";title.textContent = "Comparar balizas y recorridos";
  const message = document.createElement("p");message.setAttribute("role", "status");message.textContent = "Consultando la versión del servidor…";
  const content = document.createElement("div");
  const close = document.createElement("button");close.type = "button";close.textContent = "Cerrar sin sustituir";close.onclick = () => dialog.close();
  const styleButton = button => {button.style.cssText = "padding:12px;margin:8px 8px 8px 0;border:1px solid #245d40;border-radius:10px;font:inherit;cursor:pointer";return button;};
  dialog.append(title, message, content, styleButton(close));document.body.appendChild(dialog);
  let committing = false;
  dialog.addEventListener("cancel", e => {if (committing) e.preventDefault();});
  dialog.addEventListener("close", () => {dialog.remove();opener?.focus();});
  dialog.showModal();
  try {
    const review = await prepareConflictReview();
    if (!dialog.open) return;
    const rows = reviewDifferences(review);
    message.textContent = `${rows.length} elementos diferentes. Solo se compara estructura confirmada: balizas y recorridos. Los itinerarios y borradores parciales no se sustituyen. Si cierras, se conservan ambas versiones y el guardado sigue detenido.`;
    for (const row of rows) {
      const section = document.createElement("details"), label = document.createElement("summary");
      label.textContent = `${row.group === "checkpoints" ? "Punto" : "Recorrido"} ${row.id} · ${!row.local ? "solo en nube (se borraría)" : !row.cloud ? "solo local (se añadiría)" : "modificado"}`;
      section.appendChild(label);
      for (const [name, value] of [["Mi versión local", row.local], ["Versión en la nube", row.cloud]]) {
        const heading = document.createElement("h3"), pre = document.createElement("pre");heading.textContent = name;
        pre.style.cssText = "white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;background:#f0f5f1;padding:10px";
        pre.textContent = readableVersion(value);section.append(heading, pre);
      }
      content.appendChild(section);
    }
    const download = styleButton(document.createElement("button"));download.type = "button";download.textContent = "Descargar ambas versiones (JSON)";
    download.onclick = () => {
      try {
        const current = JSON.parse(reviewArchiveText(review));
        let copies = [current], saved = false;
        try {archiveReview(review); copies = archivedReviews(review.eventId); saved = true;} catch (_) {}
        downloadReview(JSON.stringify({format:"MILITOPO-conflict-copies-v1",copies},null,2),review.eventId);
        message.textContent = saved ? "Copia preparada. Comprueba la descarga en Archivos/Descargas. No se ha cambiado la nube." : "Se prepara la descarga de ambas versiones actuales, pero no se pudo conservar una copia en este dispositivo. Comprueba Archivos/Descargas. No se ha cambiado la nube.";
      } catch(error) {message.textContent = error.message;}
    };
    const label = document.createElement("label"), checkbox = document.createElement("input");checkbox.type = "checkbox";
    label.append(checkbox, document.createTextNode(" He revisado las diferencias y quiero sustituir la estructura de la nube por mi versión local, incluidos los borrados indicados."));label.style.display = "block";
    const apply = styleButton(document.createElement("button"));apply.type = "button";apply.textContent = "Guardar mi versión revisada";apply.disabled = true;
    checkbox.onchange = () => {apply.disabled = !checkbox.checked;};
    apply.onclick = async () => {
      if (committing || !checkbox.checked) return;
      committing = true;apply.disabled = close.disabled = download.disabled = checkbox.disabled = true;
      message.textContent = "Conservando ambas copias y comprobando de nuevo la nube…";
      try {await resolveReviewedLocal(review);message.textContent = "Versión local guardada y confirmada. Ambas estructuras quedan respaldadas en este dispositivo.";label.remove();apply.remove();paintConflictAction();}
      catch(error) {message.textContent = error.message;apply.remove();label.remove();}
      finally {committing = false;close.disabled = false;download.disabled = false;}
    };
    content.append(download, label, apply);
  } catch(error) {message.textContent = error.message;}
  finally {state.reviewBusy = false;}
}

globalThis.MILITOPO_DOWNLOAD_STRUCTURE_COPIES = eventId => {
  if (!canManage() || !eventId || state.latest?.eventId !== eventId) throw new Error("Abre la carrera con la cuenta propietaria antes de consultar sus copias.");
  const copies = archivedReviews(eventId);
  if (!copies.length) throw new Error("Esta cuenta no tiene copias de conflictos de esta carrera en este dispositivo.");
  downloadReview(JSON.stringify({format:"MILITOPO-conflict-copies-v1",copies},null,2),eventId);
  return copies.length;
};

function init() {
  ensureStatusNodes();
  globalThis.addEventListener("militopo:v2-auth-ready", onAuthReady);
  globalThis.addEventListener("militopo:v2-auth-signed-out", () => onAuthReady({ detail: { uid: "" } }));
  globalThis.addEventListener("militopo:v2-orientation-structure", event => acceptPacket(event.detail));
  globalThis.addEventListener("online", () => {
    if (state.latest?.armed) {
      state.remoteRecheck.add(state.latest.eventId);
      scheduleSync(180);
    }
  });
  globalThis.addEventListener("offline", () => {
    if (state.latest?.eventId) state.remoteRecheck.add(state.latest.eventId);
    paintStatus("📴 Sin conexión: balizas y recorridos siguen protegidos localmente.", "warn");
  });
  if (globalThis.MILITOPO_V2_AUTH) onAuthReady({ detail: globalThis.MILITOPO_V2_AUTH });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
