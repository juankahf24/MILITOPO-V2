/* MILITOPO V2 · G3 · GPS Live + reanudación tras recarga.
   Captura una única posición en vivo durante la carrera y la publica en RTDB.
   El track se guarda localmente y se sincroniza al recuperar conexión. */
import { ref, update } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const VERSION = "v2-lote2-gps-20261109";
const MIN_WRITE_MS = 4000;
const FORCE_WRITE_MS = 12000;
const MIN_MOVE_M = 3;
const RESUME_STALE_MS = 18000;

const state = {
  epoch: 0,
  trackChain: Promise.resolve(),
  services: null,
  context: null,
  watchId: null,
  active: false,
  lastSent: null,
  lastFixAt: 0,
  publishingEpoch: null,
  resumeBusy: false,
  seedFix: null,
  lastError: ""
};

function trackApi() { return globalThis.MILITOPO_RUNNER_TRACK_V2 || null; }

// Cada inicio/parada invalida callbacks anteriores, incluso si clearWatch llega tarde.
function allowed(context = state.context) {
  const auth = globalThis.MILITOPO_V2_AUTH;
  return !auth || (auth.uid === context?.uid && auth.role === "runner");
}
function current(epoch) { return epoch === state.epoch && (!state.context || allowed()); }
function trackOperation(fn) {
  const result = state.trackChain.then(fn);
  state.trackChain = result.catch(() => {});
  return result;
}

async function services() {
  if (!state.services) state.services = await globalThis.MILITOPO_V2.firebase();
  return state.services;
}

function emit(status, detail = {}) {
  globalThis.dispatchEvent(new CustomEvent("militopo:v2-gps-status", {
    detail: { status, version: VERSION, ...detail }
  }));
}

function isFreshFix(fix) {
  const age = Date.now() - fix?.updatedAt;
  return Number.isFinite(fix?.updatedAt) && fix.updatedAt > 0 && age >= -1000 && age < RESUME_STALE_MS;
}

function toFix(position) {
  const c = position?.coords;
  if (!c) return null;
  const fix = {
    lat: c.latitude,
    lng: c.longitude,
    accuracy: c.accuracy,
    heading: Number.isFinite(c.heading) ? c.heading : null,
    speed: Number.isFinite(c.speed) ? c.speed : null,
    updatedAt: position.timestamp
  };
  if (!isFreshFix(fix) || !Number.isFinite(fix.lat) || Math.abs(fix.lat) > 90 ||
      !Number.isFinite(fix.lng) || Math.abs(fix.lng) > 180 ||
      !Number.isFinite(fix.accuracy) || fix.accuracy < 0 || fix.accuracy > 5000) return null;
  return fix;
}

function distanceM(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371000;
  const rad = Math.PI / 180;
  const p1 = a.lat * rad;
  const p2 = b.lat * rad;
  const dp = (b.lat - a.lat) * rad;
  const dl = (b.lng - a.lng) * rad;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function contextPath() {
  const c = state.context;
  if (!c?.ownerUid || !c?.eventId || !c?.runId || !c?.uid) return "";
  return `v2/live/${c.ownerUid}/${c.eventId}/runs/${c.runId}/participants/${c.uid}/gps`;
}

async function publishFix(fix, epoch = state.epoch) {
  const path = contextPath();
  if (!current(epoch) || !state.active || !path || !isFreshFix(fix) ||
      navigator.onLine === false || state.publishingEpoch === epoch) return false;
  // RTDB puede retener el envío hasta reconectar. El track local sigue capturando.
  state.publishingEpoch = epoch;
  try {
    const { database } = await services();
    if (!current(epoch) || !state.active || !isFreshFix(fix) || navigator.onLine === false) return false;
    await update(ref(database, path), {
      active: true,
      lat: fix.lat,
      lng: fix.lng,
      accuracy: Math.round(fix.accuracy * 10) / 10,
      updatedAt: fix.updatedAt
    });
    if (!current(epoch) || !state.active) return false;
    state.lastError = "";
    emit("active", { fix: { ...fix } });
    return true;
  } catch (error) {
    if (!current(epoch) || !state.active) return false;
    state.lastError = String(error?.message || error);
    emit(navigator.onLine === false ? "offline_active" : "error", { message: state.lastError, fix: { ...fix } });
    return false;
  } finally {
    if (state.publishingEpoch === epoch) state.publishingEpoch = null;
  }
}

async function writeFix(fix, force = false, epoch = state.epoch) {
  if (!current(epoch) || !state.active || !isFreshFix(fix) || fix.updatedAt <= state.lastFixAt) return;
  state.lastFixAt = fix.updatedAt;
  try { globalThis.dispatchEvent(new CustomEvent("militopo:v2-gps-fix", { detail: { fix: { ...fix }, version: VERSION } })); } catch (_) {}
  await trackOperation(() => saveFix(fix, force, epoch));
}

async function saveFix(fix, force, epoch) {
  if (!current(epoch) || !state.active) return;
  const elapsed = state.lastSent ? fix.updatedAt - state.lastSent.updatedAt : Infinity;
  const moved = state.lastSent ? distanceM(state.lastSent, fix) : Infinity;
  if (!force && elapsed < MIN_WRITE_MS) return;
  if (!force && elapsed < FORCE_WRITE_MS && moved < MIN_MOVE_M) return;

  // Nunca informar de GPS protegido si IndexedDB no confirmó su escritura.
  const stored = await trackApi()?.record?.(fix);
  if (!current(epoch) || !state.active) return;
  if (stored !== true) {
    const message = "No se pudo guardar el punto GPS en el dispositivo. No cierres la PWA y comprueba el almacenamiento.";
    state.lastError = message;
    emit("storage_error", { message, fix: { ...fix } });
    return;
  }
  state.lastSent = { ...fix };
  if (navigator.onLine === false) {
    state.lastError = "";
    emit("offline_active", { fix: { ...fix }, message: "GPS activo sin cobertura. La posición y el track se guardan en el dispositivo." });
    return;
  }
  void publishFix(fix, epoch);
}

function geolocationError(error) {
  const code = Number(error?.code || 0);
  const message = code === 1
    ? "Permiso de ubicación denegado."
    : code === 2
      ? "No se pudo obtener la ubicación."
      : code === 3
        ? "La ubicación está tardando demasiado."
        : String(error?.message || "GPS no disponible.");
  state.lastError = message;
  emit("error", { message });
}

function prepare(epoch = state.epoch, context = null) {
  const authUid = globalThis.MILITOPO_V2_AUTH?.uid;
  const valid = () => epoch === state.epoch && (!context || allowed(context)) &&
    (!authUid || globalThis.MILITOPO_V2_AUTH?.uid === authUid);
  if (!navigator.geolocation) {
    const message = "Este dispositivo no ofrece geolocalización web.";
    emit("unsupported", { message });
    return Promise.resolve(null);
  }
  emit("requesting", { message: "Solicitando posición GPS…" });
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      position => {
        if (!valid()) { resolve(null); return; }
        const fix = toFix(position);
        state.seedFix = fix;
        if (!fix) {
          geolocationError({ message: "La posición GPS no es válida o está desactualizada. Vuelve a intentarlo." });
          resolve(null);
          return;
        }
        emit("ready", { fix: { ...fix } });
        resolve(fix);
      },
      error => {
        if (!valid()) { resolve(null); return; }
        geolocationError(error);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 4000 }
    );
  });
}

async function start(context, seedFix = null) {
  if (!navigator.geolocation) {
    emit("unsupported", { message: "GPS no disponible." });
    return false;
  }
  if (!allowed(context)) return false;
  const epoch = ++state.epoch;
  stopWatchOnly();
  state.resumeBusy = false;
  state.lastFixAt = 0;
  state.lastError = "";
  state.lastSent = null;
  state.context = { ...context };
  state.active = false;
  const trackReady = await trackOperation(() => current(epoch) ? trackApi()?.start?.(context) : false);
  if (!current(epoch)) return false;
  if (trackReady !== true) {
    emit("storage_error", { message: "No se puede proteger el recorrido GPS en el dispositivo. Comprueba el almacenamiento antes de continuar." });
    return false;
  }
  state.active = true;
  const seed = seedFix || state.seedFix;
  const first = isFreshFix(seed) ? seed : null;
  state.seedFix = null;
  if (first) await writeFix(first, true, epoch);
  if (!current(epoch) || !state.active) return false;

  installWatch();
  emit("watching", { fix: first ? { ...first } : null });
  return true;
}

function installWatch() {
  if (!navigator.geolocation || !state.active) return false;
  stopWatchOnly();
  const epoch = state.epoch;
  state.watchId = navigator.geolocation.watchPosition(
    position => writeFix(toFix(position), false, epoch).catch(() => {}),
    error => { if (current(epoch) && state.active) geolocationError(error); },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
  );
  return true;
}

async function resumeAfterSuspend(reason = "visible") {
  if (!state.active || !state.context || !navigator.geolocation || document.visibilityState === "hidden" || state.resumeBusy) return false;
  const stale = !state.lastFixAt || (Date.now() - state.lastFixAt) >= RESUME_STALE_MS;
  if (!stale && state.watchId != null) return true;
  const epoch = state.epoch;
  state.resumeBusy = true;
  try {
    emit("requesting", { message: "Reanudando GPS tras volver a MILITOPO…", reason });
    installWatch();
    await new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        position => {
          const fix = toFix(position);
          if (fix) writeFix(fix, true, epoch).catch(() => {});
          resolve();
        },
        () => resolve(),
        { enableHighAccuracy: true, timeout: 9000, maximumAge: 2500 }
      );
    });
    if (!current(epoch) || !state.active) return false;
    emit("watching", { fix: state.lastSent ? { ...state.lastSent } : null, resumed: true, reason });
    return true;
  } finally {
    if (epoch === state.epoch) state.resumeBusy = false;
  }
}

function stopWatchOnly() {
  if (state.watchId != null) {
    try { navigator.geolocation.clearWatch(state.watchId); } catch (_) {}
  }
  state.watchId = null;
}

async function publishInactive(path, fix, epoch) {
  try {
    const { database } = await services();
    if (!current(epoch)) return;
    await update(ref(database, path), {
      active: false,
      lat: fix.lat,
      lng: fix.lng,
      accuracy: Math.round(fix.accuracy * 10) / 10,
      updatedAt: fix.updatedAt
    });
  } catch (_) {}
}

async function stop(reason = "manual") {
  const epoch = ++state.epoch;
  stopWatchOnly();
  const path = contextPath();
  const wasActive = state.active;
  const lastSent = state.lastSent ? { ...state.lastSent } : null;
  state.active = false;
  state.resumeBusy = false;
  state.seedFix = null;
  // Encolar antes de esperar a la red: una parada antigua nunca detiene un inicio nuevo.
  const stopped = trackOperation(() => trackApi()?.stop?.({ flushPending: reason !== "signed_out" }));
  if (path && wasActive && isFreshFix(lastSent) && reason !== "signed_out" && navigator.onLine !== false) {
    void publishInactive(path, lastSent, epoch);
  }
  await stopped;
  if (epoch === state.epoch) emit("stopped", { reason, fix: lastSent });
}

async function resumeIfGranted(context) {
  if (!navigator.geolocation || !allowed(context)) return false;
  const epoch = state.epoch;
  try {
    if (navigator.permissions?.query) {
      try {
        const permission = await navigator.permissions.query({ name: "geolocation" });
        if (epoch !== state.epoch || !allowed(context)) return false;
        if (permission.state === "denied") {
          emit("error", { message: "El permiso de ubicación está desactivado para MILITOPO." });
          return false;
        }
      } catch (_) {}
    }
    // En Safari/iPhone Permissions API puede no estar disponible aunque el permiso GPS sí lo esté.
    // Se intenta recuperar una posición directamente; si el sistema ya concedió permiso no muestra un diálogo nuevo.
    if (epoch !== state.epoch || !allowed(context)) return false;
    const fix = await prepare(epoch, context);
    if (!fix || epoch !== state.epoch || !allowed(context)) return false;
    return start(context, fix);
  } catch (_) {
    return false;
  }
}

function snapshot() {
  return {
    active: state.active,
    lastSent: state.lastSent ? { ...state.lastSent } : null,
    lastFixAt: state.lastFixAt,
    lastError: state.lastError
  };
}

window.addEventListener("online", () => {
  if (state.active) void publishFix(state.lastSent);
});
window.addEventListener("offline", () => {
  if (state.active) emit("offline_active", { fix: state.lastSent ? { ...state.lastSent } : null, message: "GPS activo sin cobertura. El track continúa guardándose localmente." });
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") setTimeout(() => resumeAfterSuspend("visibility").catch(() => {}), 180);
});
window.addEventListener("pageshow", () => {
  setTimeout(() => resumeAfterSuspend("pageshow").catch(() => {}), 220);
});

window.addEventListener("militopo:v2-auth-signed-out", () => {
  stop("signed_out").catch(() => {});
});

globalThis.MILITOPO_RUNNER_GPS_V2 = Object.freeze({
  prepare,
  start,
  stop,
  resumeIfGranted,
  resumeAfterSuspend,
  snapshot
});
