/* MILITOPO V2 · Fase C1 · cabecera/configuración de eventos en Firestore.
   Firestore es una copia oficial progresiva; el guardado local/IndexedDB sigue siendo
   la red de seguridad y no se elimina ni se sustituye en esta fase. */
import "../bootstrap.js";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const MANAGER_ROLES = new Set(["organizer", "super_admin"]);
const state = {
  auth: globalThis.MILITOPO_V2_AUTH || null,
  services: null,
  latest: null,
  timer: null,
  busy: false,
  rerun: false,
  lastHashByEvent: new Map(),
  knownByEvent: new Map()
};

function cleanRole(role) {
  return ["runner", "organizer", "super_admin"].includes(String(role || "")) ? String(role) : "runner";
}
function canManage(auth = state.auth) {
  return Boolean(auth?.uid && auth?.emailVerified && MANAGER_ROLES.has(cleanRole(auth.role)));
}
function toInt(value, fallback = 0, min = 0) {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? Math.max(min, n) : Math.max(min, Math.trunc(Number(fallback) || 0));
}
function toNumber(value, fallback = 0, min = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, n) : Math.max(min, Number(fallback) || 0);
}
function normalizeHeader(raw = {}) {
  return {
    eventId: String(raw.eventId || "").trim(),
    eventName: String(raw.eventName || "ENTRENAMIENTO ORIENTACIÓN").trim().slice(0, 140) || "ENTRENAMIENTO ORIENTACIÓN",
    participantCount: toInt(raw.participantCount, 10, 1),
    maxUniqueRoutes: toInt(raw.maxUniqueRoutes, 15, 1),
    controlCount: toInt(raw.controlCount, 25, 0),
    controlsPerRoute: toInt(raw.controlsPerRoute, 8, 0),
    maxControlReuse: toInt(raw.maxControlReuse, 6, 1),
    planScale: Number(raw.planScale) === 7500 ? 7500 : 10000,
    planEquidistanceM: toNumber(raw.planEquidistanceM, 5, 0.5)
  };
}
function comparableFromDoc(data = {}) {
  return normalizeHeader(data);
}
function stableHash(header) {
  return JSON.stringify(normalizeHeader(header));
}
function sameHeader(a, b) {
  return stableHash(a) === stableHash(b);
}

function ensureStatusNode() {
  let node = document.getElementById("m2CloudEventStatus");
  if (node) return node;
  const step = document.getElementById("step1");
  if (!step) return null;
  node = document.createElement("div");
  node.id = "m2CloudEventStatus";
  node.className = "status warn";
  node.style.margin = "12px 0";
  node.textContent = "☁️ Nube: esperando confirmación del PASO 1.";
  const nav = step.querySelector(".nav-row");
  if (nav) nav.insertAdjacentElement("beforebegin", node);
  else step.appendChild(node);
  return node;
}
function paintStatus(text, kind = "warn") {
  const node = ensureStatusNode();
  if (!node) return;
  node.className = `status ${kind}`;
  node.textContent = text;
}

async function services() {
  if (state.services) return state.services;
  state.services = await globalThis.MILITOPO_V2.firebase();
  return state.services;
}

function scheduleSync(delay = 700) {
  clearTimeout(state.timer);
  state.timer = setTimeout(() => syncLatest().catch(error => {
    console.error("[MILITOPO C1] sync", error);
    paintStatus("⚠️ Nube: no se pudo sincronizar. El evento sigue guardado en este dispositivo.", "warn");
  }), delay);
}

async function syncLatest() {
  const packet = state.latest;
  if (!packet?.armed) {
    paintStatus("☁️ Nube: confirma el PASO 1 para crear la copia del evento en Firestore.", "warn");
    return false;
  }
  if (!canManage()) {
    paintStatus("🔒 Nube: la sincronización del organizador requiere rol organizer o super_admin.", "warn");
    return false;
  }
  if (!navigator.onLine) {
    paintStatus("📴 Sin conexión: la copia local sigue protegida. La cabecera se sincronizará al volver Internet.", "warn");
    return false;
  }
  const header = normalizeHeader(packet.header);
  if (!header.eventId) return false;
  if (state.busy) {
    state.rerun = true;
    return false;
  }

  state.busy = true;
  try {
    const { firestore } = await services();
    const ref = doc(firestore, "events", header.eventId);
    const uid = String(state.auth.uid);
    const desiredHash = stableHash(header);
    if (state.lastHashByEvent.get(header.eventId) === desiredHash) {
      paintStatus(`☁️ Firestore al día · ${header.eventId}`, "ok");
      return true;
    }

    let known = state.knownByEvent.get(header.eventId);
    if (!known) {
      paintStatus("☁️ Comprobando copia en Firestore…", "warn");
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() || {};
        if (String(data.ownerUid || "") !== uid) {
          paintStatus("🔒 Este identificador ya pertenece a otra cuenta. No se ha sobrescrito nada.", "err");
          return false;
        }
        known = { exists: true, data };
        state.knownByEvent.set(header.eventId, known);
        if (sameHeader(data, header)) {
          state.lastHashByEvent.set(header.eventId, desiredHash);
          paintStatus(`☁️ Firestore al día · ${header.eventId}`, "ok");
          return true;
        }
      } else {
        known = { exists: false, data: null };
        state.knownByEvent.set(header.eventId, known);
      }
    }

    paintStatus("☁️ Guardando cabecera del evento en Firestore…", "warn");
    if (!known.exists) {
      await setDoc(ref, {
        ...header,
        ownerUid: uid,
        kind: "orientation",
        status: "draft",
        schemaVersion: 1,
        cloudStage: "C1",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      state.knownByEvent.set(header.eventId, { exists: true, data: { ...header, ownerUid: uid, status: "draft" } });
    } else {
      await setDoc(ref, {
        ...header,
        ownerUid: uid,
        kind: "orientation",
        schemaVersion: 1,
        cloudStage: "C1",
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
    state.lastHashByEvent.set(header.eventId, desiredHash);
    paintStatus(`✅ Nube sincronizada · ${header.eventId}`, "ok");
    return true;
  } finally {
    state.busy = false;
    if (state.rerun) {
      state.rerun = false;
      scheduleSync(250);
    }
  }
}

function acceptOrientationPacket(detail) {
  if (!detail?.header) return;
  state.latest = {
    armed: Boolean(detail.armed),
    reason: String(detail.reason || ""),
    header: normalizeHeader(detail.header)
  };
  if (!state.latest.armed) {
    paintStatus("☁️ Nube: confirma el PASO 1 para crear la copia del evento en Firestore.", "warn");
    return;
  }
  scheduleSync(detail.reason === "step1-confirmed" ? 100 : 900);
}

function onAuthReady(event) {
  state.auth = event?.detail || globalThis.MILITOPO_V2_AUTH || null;
  if (state.latest?.armed) scheduleSync(100);
  else if (!canManage()) paintStatus("🔒 Nube: acceso de organizador no habilitado para esta cuenta.", "warn");
}

function init() {
  ensureStatusNode();
  globalThis.addEventListener("militopo:v2-auth-ready", onAuthReady);
  globalThis.addEventListener("militopo:v2-orientation-header", event => acceptOrientationPacket(event.detail));
  globalThis.addEventListener("online", () => { if (state.latest?.armed) scheduleSync(150); });
  globalThis.addEventListener("offline", () => paintStatus("📴 Sin conexión: el evento continúa protegido localmente.", "warn"));
  if (globalThis.MILITOPO_V2_AUTH) onAuthReady({ detail: globalThis.MILITOPO_V2_AUTH });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
