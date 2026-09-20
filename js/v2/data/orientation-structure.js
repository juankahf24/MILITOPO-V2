/* MILITOPO V2 · Fase C2 · balizas y recorridos en Firestore.
   Mantiene localStorage/IndexedDB como red de seguridad. Solo escribe diferencias
   reales para no consumir cuota con el autoguardado periódico del organizador. */
import "../bootstrap.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const MANAGER_ROLES = new Set(["organizer", "super_admin"]);
const state = {
  auth: globalThis.MILITOPO_V2_AUTH || null,
  services: null,
  latest: null,
  timer: null,
  busy: false,
  rerun: false,
  remoteByEvent: new Map(),
  parentWaits: 0
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
function scheduleSync(delay = 900) {
  clearTimeout(state.timer);
  state.timer = setTimeout(() => syncLatest().catch(error => {
    console.error("[MILITOPO C2] sync", error);
    paintStatus("⚠️ Nube: no se pudieron sincronizar balizas/recorridos. La copia local sigue intacta.", "warn");
  }), delay);
}
async function loadRemoteIndex(firestore, eventId) {
  if (state.remoteByEvent.has(eventId)) return state.remoteByEvent.get(eventId);
  paintStatus("☁️ Comparando balizas y recorridos con Firestore…", "warn");
  const [checkpointSnap, courseSnap] = await Promise.all([
    getDocs(collection(firestore, "events", eventId, "checkpoints")),
    getDocs(collection(firestore, "events", eventId, "courses"))
  ]);
  const remote = { checkpoints: new Map(), courses: new Map() };
  checkpointSnap.forEach(snap => remote.checkpoints.set(snap.id, cleanString(snap.data()?.contentHash, 32)));
  courseSnap.forEach(snap => remote.courses.set(snap.id, cleanString(snap.data()?.contentHash, 32)));
  state.remoteByEvent.set(eventId, remote);
  return remote;
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
async function syncLatest() {
  const packet = state.latest;
  if (!packet?.armed || !packet.eventId) {
    paintStatus("☁️ Estructura: confirma primero el PASO 1.", "warn");
    return false;
  }
  if (!canManage()) {
    paintStatus("🔒 Estructura: requiere rol organizer o super_admin con correo verificado.", "warn");
    return false;
  }
  const editLock = globalThis.MILITOPO_V2_EVENT_EDIT_LOCK;
  if (editLock?.locked && (!editLock.eventId || String(editLock.eventId) === packet.eventId)) {
    paintStatus(`🔒 Estructura bloqueada en ${String(editLock.label || editLock.status || "PUBLICADO")}. Firestore conserva la versión publicada.`, "warn");
    return false;
  }
  if (!navigator.onLine) {
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
    const eventRef = doc(firestore, "events", packet.eventId);
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) {
      state.parentWaits += 1;
      paintStatus("☁️ Estructura: esperando a que C1 cree la cabecera del evento…", "warn");
      if (state.parentWaits <= 5) scheduleSync(1400);
      return false;
    }
    state.parentWaits = 0;
    const eventData = eventSnap.data() || {};
    if (String(eventData.ownerUid || "") !== String(state.auth.uid || "")) {
      paintStatus("🔒 Estructura: este evento pertenece a otra cuenta. No se ha sobrescrito nada.", "err");
      return false;
    }

    const remote = await loadRemoteIndex(firestore, packet.eventId);
    const wantedCheckpoints = desiredMap(packet.checkpoints, "checkpointId");
    const wantedCourses = desiredMap(packet.courses, "courseId");
    const batch = writeBatch(firestore);
    let mutations = 0;

    for (const [id, item] of wantedCheckpoints) {
      if (remote.checkpoints.get(id) === item.hash) continue;
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
      if (remote.courses.get(id) === item.hash) continue;
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
      await batch.commit();

      remote.checkpoints = new Map([...wantedCheckpoints].map(([id, item]) => [id, item.hash]));
      remote.courses = new Map([...wantedCourses].map(([id, item]) => [id, item.hash]));
      paintStatus(`✅ Estructura sincronizada · ${packet.checkpoints.length} puntos · ${packet.courses.length} recorridos`, "ok");
      return true;
    }

    paintStatus(`☁️ Estructura al día · ${packet.checkpoints.length} puntos · ${packet.courses.length} recorridos`, "ok");
    return true;
  } finally {
    state.busy = false;
    if (state.rerun) {
      state.rerun = false;
      scheduleSync(300);
    }
  }
}
function acceptPacket(detail) {
  state.latest = normalizePacket(detail);
  if (!state.latest.armed) {
    paintStatus("☁️ Estructura: confirma primero el PASO 1.", "warn");
    return;
  }
  const fastReasons = new Set(["step2-confirmed", "routes-generated", "route-regenerated"]);
  scheduleSync(fastReasons.has(state.latest.reason) ? 180 : 1100);
}
function onAuthReady(event) {
  state.auth = event?.detail || globalThis.MILITOPO_V2_AUTH || null;
  if (state.latest?.armed) scheduleSync(180);
}
function init() {
  ensureStatusNodes();
  globalThis.addEventListener("militopo:v2-auth-ready", onAuthReady);
  globalThis.addEventListener("militopo:v2-orientation-structure", event => acceptPacket(event.detail));
  globalThis.addEventListener("online", () => { if (state.latest?.armed) scheduleSync(180); });
  globalThis.addEventListener("offline", () => paintStatus("📴 Sin conexión: balizas y recorridos siguen protegidos localmente.", "warn"));
  if (globalThis.MILITOPO_V2_AUTH) onAuthReady({ detail: globalThis.MILITOPO_V2_AUTH });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
