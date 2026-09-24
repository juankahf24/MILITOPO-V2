/* MILITOPO V2 · G3 · GPS Live + reanudación tras recarga.
   Captura una única posición en vivo durante la carrera y la publica en RTDB.
   El track se guarda localmente y se sincroniza al recuperar conexión. */
import { ref, update } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const VERSION = "v2-g3-recovery-wakelock-20260924";
const MIN_WRITE_MS = 4000;
const FORCE_WRITE_MS = 12000;
const MIN_MOVE_M = 3;

const state = {
  services: null,
  context: null,
  watchId: null,
  active: false,
  lastSent: null,
  seedFix: null,
  lastError: ""
};

function trackApi() { return globalThis.MILITOPO_RUNNER_TRACK_V2 || null; }

async function services() {
  if (!state.services) state.services = await globalThis.MILITOPO_V2.firebase();
  return state.services;
}

function emit(status, detail = {}) {
  globalThis.dispatchEvent(new CustomEvent("militopo:v2-gps-status", {
    detail: { status, version: VERSION, ...detail }
  }));
}

function toFix(position) {
  const c = position?.coords;
  if (!c) return null;
  return {
    lat: Number(c.latitude),
    lng: Number(c.longitude),
    accuracy: Math.max(0, Number(c.accuracy || 0)),
    updatedAt: Date.now()
  };
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

async function writeFix(fix, force = false) {
  if (!fix || !state.active) return;
  const now = Date.now();
  const elapsed = state.lastSent ? now - state.lastSent.updatedAt : Infinity;
  const moved = state.lastSent ? distanceM(state.lastSent, fix) : Infinity;
  if (!force && elapsed < MIN_WRITE_MS) return;
  if (!force && elapsed < FORCE_WRITE_MS && moved < MIN_MOVE_M) return;

  trackApi()?.record?.(fix);
  const path = contextPath();
  if (!path) return;
  try {
    const { database } = await services();
    await update(ref(database, path), {
      active: true,
      lat: fix.lat,
      lng: fix.lng,
      accuracy: Math.round(fix.accuracy * 10) / 10,
      updatedAt: fix.updatedAt
    });
    state.lastSent = { ...fix };
    state.lastError = "";
    emit("active", { fix: { ...fix } });
  } catch (error) {
    state.lastError = String(error?.message || error);
    emit("error", { message: state.lastError });
  }
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

function prepare() {
  if (!navigator.geolocation) {
    const message = "Este dispositivo no ofrece geolocalización web.";
    emit("unsupported", { message });
    return Promise.resolve(null);
  }
  emit("requesting", { message: "Solicitando posición GPS…" });
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      position => {
        const fix = toFix(position);
        state.seedFix = fix;
        emit("ready", { fix: { ...fix } });
        resolve(fix);
      },
      error => {
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
  stopWatchOnly();
  state.context = { ...context };
  state.active = true;
  await trackApi()?.start?.(state.context);
  state.lastSent = null;
  const first = seedFix || state.seedFix;
  if (first) await writeFix(first, true);

  state.watchId = navigator.geolocation.watchPosition(
    position => writeFix(toFix(position)).catch(() => {}),
    geolocationError,
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
  );
  emit("watching", { fix: first ? { ...first } : null });
  return true;
}

function stopWatchOnly() {
  if (state.watchId != null) {
    try { navigator.geolocation.clearWatch(state.watchId); } catch (_) {}
  }
  state.watchId = null;
}

async function stop(reason = "manual") {
  stopWatchOnly();
  const path = contextPath();
  const wasActive = state.active;
  state.active = false;
  if (path && wasActive && state.lastSent) {
    try {
      const { database } = await services();
      await update(ref(database, path), {
        active: false,
        lat: state.lastSent.lat,
        lng: state.lastSent.lng,
        accuracy: Math.round(state.lastSent.accuracy * 10) / 10,
        updatedAt: Date.now()
      });
    } catch (_) {}
  }
  await trackApi()?.stop?.({ flushPending: true });
  emit("stopped", { reason, fix: state.lastSent ? { ...state.lastSent } : null });
}

async function resumeIfGranted(context) {
  if (!navigator.geolocation) return false;
  try {
    if (navigator.permissions?.query) {
      try {
        const permission = await navigator.permissions.query({ name: "geolocation" });
        if (permission.state === "denied") {
          emit("error", { message: "El permiso de ubicación está desactivado para MILITOPO." });
          return false;
        }
      } catch (_) {}
    }
    // En Safari/iPhone Permissions API puede no estar disponible aunque el permiso GPS sí lo esté.
    // Se intenta recuperar una posición directamente; si el sistema ya concedió permiso no muestra un diálogo nuevo.
    const fix = await prepare();
    if (!fix) return false;
    return start(context, fix);
  } catch (_) {
    return false;
  }
}

function snapshot() {
  return {
    active: state.active,
    lastSent: state.lastSent ? { ...state.lastSent } : null,
    lastError: state.lastError
  };
}

globalThis.MILITOPO_RUNNER_GPS_V2 = Object.freeze({
  prepare,
  start,
  stop,
  resumeIfGranted,
  snapshot
});
