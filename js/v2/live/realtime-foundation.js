/* MILITOPO V2 · F2B Blaze · base Live serverizada.
   Accesos, inicio y final de sesión se coordinan desde Cloud Functions. */
import "../bootstrap.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";

const MANAGER_ROLES = new Set(["organizer", "super_admin"]);
const SYNCABLE_STATES = new Set(["prepared", "published", "live", "finished"]);
const STATUS_ES = { draft:"BORRADOR", prepared:"PREPARADO", published:"PUBLICADO", live:"EN DIRECTO", finished:"FINALIZADO", archived:"ARCHIVADO" };
const state = {
  auth: globalThis.MILITOPO_V2_AUTH || null,
  services: null,
  eventId: "",
  event: null,
  busy: false,
  panel: null,
  message: "",
  timer: null,
  lastSyncedKey: "",
  runMessage: ""
};

function roleOf() {
  const role = String(state.auth?.role || "runner");
  return ["runner", "organizer", "super_admin"].includes(role) ? role : "runner";
}
function canManage() {
  return Boolean(state.auth?.uid && state.auth?.emailVerified && MANAGER_ROLES.has(roleOf()));
}
function eventIdNow() {
  return String(state.eventId || globalThis.MILITOPO_V2_EVENT_STATUS?.eventId || document.getElementById("eventId")?.value || "").trim();
}
async function services() {
  if (!state.services) state.services = await globalThis.MILITOPO_V2.firebase();
  return state.services;
}
function injectStyle() {
  if (document.getElementById("m2LiveV2Style")) return;
  const style = document.createElement("style");
  style.id = "m2LiveV2Style";
  style.textContent = `
    .m2-livev2{margin:14px 0;padding:14px;border:1px solid rgba(126,220,150,.30);border-radius:18px;background:rgba(8,22,13,.78)}
    .m2-livev2-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .m2-livev2-title{font-weight:900;letter-spacing:.08em;color:#dff1cf}.m2-livev2-chip{padding:5px 10px;border-radius:999px;border:1px solid rgba(126,220,150,.34);font-weight:900;font-size:.76rem}
    .m2-livev2-status{margin:10px 0;font-size:.83rem;line-height:1.5;white-space:pre-line}.m2-livev2-note{font-size:.74rem;line-height:1.45;opacity:.72}
    .m2-livev2 button{width:100%;min-height:44px;margin-top:10px;border-radius:12px;border:1px solid rgba(126,220,150,.36);background:rgba(126,220,150,.12);color:inherit;font:inherit;font-weight:900;cursor:pointer}
    .m2-livev2 button[disabled]{opacity:.45;cursor:not-allowed}
  `;
  document.head.appendChild(style);
}
function ensurePanel() {
  if (state.panel?.isConnected) return state.panel;
  const step = document.getElementById("step1");
  if (!step) return null;
  injectStyle();
  const panel = document.createElement("section");
  panel.id = "m2LiveV2Foundation";
  panel.className = "m2-livev2";
  panel.innerHTML = `
    <div class="m2-livev2-head">
      <div class="m2-livev2-title">📡 LIVE V2 · BACKEND BLAZE</div>
      <div id="m2LiveV2Chip" class="m2-livev2-chip">ESPERANDO</div>
    </div>
    <div id="m2LiveV2Status" class="m2-livev2-status">Carga un evento para comprobar el backend Live V2.</div>
    <button id="m2LiveV2Sync" type="button">SINCRONIZAR ACCESO LIVE V2</button>
    <div class="m2-livev2-note">F2C: el seguimiento del organizador ya usa Live V2. El participante heredado se mantiene como respaldo hasta F3.</div>`;
  const nav = step.querySelector(".nav-row");
  if (nav) nav.insertAdjacentElement("beforebegin", panel); else step.appendChild(panel);
  panel.querySelector("#m2LiveV2Sync").addEventListener("click", () => sync(true));
  state.panel = panel;
  paint();
  return panel;
}
function paint(message) {
  if (typeof message === "string") state.message = message;
  const panel = ensurePanel(); if (!panel) return;
  const chip = panel.querySelector("#m2LiveV2Chip");
  const status = panel.querySelector("#m2LiveV2Status");
  const button = panel.querySelector("#m2LiveV2Sync");
  if (!canManage()) {
    chip.textContent = "SIN PERMISOS";
    status.textContent = "Se necesita rol organizer o super_admin verificado.";
    button.disabled = true; return;
  }
  if (!state.event) {
    chip.textContent = "SIN EVENTO";
    status.textContent = state.message || "Carga un evento Firestore para preparar Live V2.";
    button.disabled = true; return;
  }
  const statusKey = String(state.event.status || "draft");
  chip.textContent = STATUS_ES[statusKey] || statusKey.toUpperCase();
  button.disabled = state.busy || !navigator.onLine || !SYNCABLE_STATES.has(statusKey);
  const visibleMessage = state.runMessage || state.message;
  if (visibleMessage) status.textContent = visibleMessage;
  else if (!SYNCABLE_STATES.has(statusKey)) status.textContent = `Estado ${STATUS_ES[statusKey] || statusKey.toUpperCase()}: Live V2 se prepara desde PREPARADO.`;
  else if (statusKey === "live") status.textContent = "🟢 Evento EN DIRECTO · sesión Live V2 activa.";
  else if (statusKey === "finished") status.textContent = "✅ Evento FINALIZADO · sesión Live V2 cerrada.";
  else status.textContent = "Backend Live V2 listo para sincronizar accesos.";
  button.textContent = state.busy ? "SINCRONIZANDO…" : "SINCRONIZAR ACCESO LIVE V2";
}
function errorMessage(error) {
  const code = String(error?.code || "").trim();
  const msg = String(error?.message || error || "").trim();
  const joined = `${code} ${msg}`.toLowerCase();
  if (joined.includes("permission") || joined.includes("denied")) return "⛔ El backend rechazó la operación por permisos.";
  if (joined.includes("not-found")) return "⚠️ El evento no existe en Firestore.";
  if (joined.includes("failed-precondition")) return "⚠️ El evento todavía no está en un estado válido para Live V2.";
  if (joined.includes("network") || joined.includes("unavailable") || joined.includes("offline")) return "📴 No se pudo contactar con Cloud Functions. Comprueba la conexión.";
  if (joined.includes("internal")) return "⚠️ Error interno del backend Live V2. Vuelve a intentarlo.";
  return `⚠️ No se pudo sincronizar Live V2${code ? ` · ${code}` : ""}.`;
}
async function readEvent(eventId) {
  const { firestore } = await services();
  const snap = await getDoc(doc(firestore, "events", eventId));
  if (!snap.exists()) throw new Error("EVENT_NOT_FOUND");
  const data = { ...(snap.data() || {}), eventId: snap.id };
  if (roleOf() !== "super_admin" && String(data.ownerUid || "") !== String(state.auth?.uid || "")) throw new Error("EVENT_NOT_OWNED");
  return data;
}
async function sync(userRequested = false) {
  const eventId = eventIdNow();
  state.eventId = eventId;
  if (!canManage() || !eventId || state.busy) return false;
  if (!navigator.onLine) { if (userRequested || !state.message) paint("📴 Sin conexión. Live V2 no se modifica."); return false; }

  state.busy = true;
  if (userRequested) paint("Sincronizando mediante Cloud Functions…");
  try {
    const { functions } = await services();
    const call = httpsCallable(functions, "syncLiveAccess");
    const response = await call({ eventId });
    const data = response?.data || {};
    const active = Number(data.activeMembers || 0);
    const removed = Number(data.removedMembers || 0);
    state.lastSyncedKey = `${eventId}:${String(data.status || "")}:${active}:${removed}`;
    state.message = `✅ Backend Live V2 al día · ${active} corredor${active === 1 ? "" : "es"} autorizado${active === 1 ? "" : "s"}${removed ? ` · ${removed} retirado${removed === 1 ? "" : "s"}` : ""}.`;
    globalThis.dispatchEvent(new CustomEvent("militopo:v2-live-foundation-ready", { detail: data }));
    return true;
  } catch (error) {
    console.error("[MILITOPO F2A] syncLiveAccess", error);
    state.message = errorMessage(error);
    return false;
  } finally {
    state.busy = false;
    paint();
  }
}
async function refreshFromEventStatus(detail = {}, forceSync = false) {
  const eventId = String(detail.eventId || eventIdNow()).trim();
  const changedEvent = Boolean(eventId && state.eventId && eventId !== state.eventId);
  if (changedEvent) {
    clearTimeout(state.timer);
    state.event = null;
    state.message = "";
    state.runMessage = "";
    state.lastSyncedKey = "";
    paint("Cargando estado Live V2 del evento…");
  }
  state.eventId = eventId;
  if (!eventId || !canManage()) { state.event = null; state.message = ""; state.runMessage = ""; paint(); return; }
  try {
    state.event = await readEvent(eventId);
    const status = String(state.event.status || "draft");
    if (!new Set(["live", "finished"]).has(status)) state.runMessage = "";
    paint();
    if (SYNCABLE_STATES.has(status)) {
      clearTimeout(state.timer);
      state.timer = setTimeout(() => sync(false), forceSync ? 120 : 450);
    } else {
      state.message = "";
      paint();
    }
  } catch (error) {
    state.event = null;
    state.message = "";
    state.runMessage = "";
    paint("No se pudo leer el evento para Live V2.");
  }
}

function onAuthReady(event) {
  state.auth = event?.detail || globalThis.MILITOPO_V2_AUTH || null;
  paint();
  const detail = globalThis.MILITOPO_V2_EVENT_STATUS || {};
  if (detail.eventId) refreshFromEventStatus(detail, true);
}
function init() {
  ensurePanel();
  globalThis.addEventListener("militopo:v2-auth-ready", onAuthReady);
  globalThis.addEventListener("militopo:v2-event-status", event => refreshFromEventStatus(event.detail || {}));
  globalThis.addEventListener("militopo:v2-event-status-changed", event => refreshFromEventStatus(event.detail || globalThis.MILITOPO_V2_EVENT_STATUS || {}, true));
  globalThis.addEventListener("militopo:v2-roster-refresh", () => { if (state.eventId) { clearTimeout(state.timer); state.timer = setTimeout(() => sync(false), 150); } });
  globalThis.addEventListener("militopo:v2-invitation-accepted", () => { if (state.eventId) { clearTimeout(state.timer); state.timer = setTimeout(() => sync(false), 150); } });
  globalThis.addEventListener("militopo:v2-live-run-changed", event => {
    const detail = event?.detail || {};
    if (detail.eventId && String(detail.eventId) === String(state.eventId || eventIdNow())) {
      if (state.event && detail.status) state.event.status = String(detail.status);
      state.runMessage = detail.status === "live"
        ? `✅ Sesión Live V2 iniciada · ${Number(detail.participantCount || 0)} corredor${Number(detail.participantCount || 0) === 1 ? "" : "es"}.`
        : detail.status === "finished" ? "✅ Sesión Live V2 finalizada en backend." : state.runMessage;
      paint();
    }
  });
  globalThis.addEventListener("online", () => { if (state.eventId) refreshFromEventStatus({ eventId: state.eventId }, true); });
  globalThis.addEventListener("offline", () => paint("📴 Sin conexión. Live V2 conserva la última configuración del servidor."));
  if (globalThis.MILITOPO_V2_AUTH) onAuthReady({ detail: globalThis.MILITOPO_V2_AUTH });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true }); else init();
