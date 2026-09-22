/* MILITOPO V2 · Fase F1 · base segura de Live en Realtime Database.
   No sustituye todavía live-phase2.js: prepara el namespace V2, sincroniza acceso
   desde Firestore y mantiene V1 intacto hasta F2/F3. */
import "../bootstrap.js";
import {
  collection,
  doc,
  getDoc,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  get,
  ref,
  serverTimestamp,
  update
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const MANAGER_ROLES = new Set(["organizer", "super_admin"]);
const SYNCABLE_STATES = new Set(["prepared", "published", "live", "finished"]);
const state = {
  auth: globalThis.MILITOPO_V2_AUTH || null,
  services: null,
  eventId: "",
  event: null,
  busy: false,
  lastHash: "",
  timer: null,
  panel: null,
  message: "",
  lastAttemptHash: "",
  lastFailedHash: "",
  lastFailedMessage: ""
};

function roleOf() {
  const role = String(state.auth?.role || "runner");
  return ["runner", "organizer", "super_admin"].includes(role) ? role : "runner";
}
function canManage() {
  return Boolean(state.auth?.uid && state.auth?.emailVerified && MANAGER_ROLES.has(roleOf()));
}
function esc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
}
function eventIdNow() {
  return String(state.eventId || globalThis.MILITOPO_V2_EVENT_STATUS?.eventId || document.getElementById("eventId")?.value || "").trim();
}
function stableHash(eventData, members) {
  return JSON.stringify({
    eventId: eventData?.eventId || "",
    ownerUid: eventData?.ownerUid || "",
    status: eventData?.status || "",
    members: members.map(row => [row.uid, row.status]).sort((a,b) => a[0].localeCompare(b[0]))
  });
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
      <div class="m2-livev2-title">📡 LIVE V2 · REALTIME DATABASE</div>
      <div id="m2LiveV2Chip" class="m2-livev2-chip">ESPERANDO</div>
    </div>
    <div id="m2LiveV2Status" class="m2-livev2-status">Carga un evento para preparar su acceso Live V2.</div>
    <button id="m2LiveV2Sync" type="button">SINCRONIZAR ACCESO LIVE V2</button>
    <div class="m2-livev2-note">F1 prepara la base segura en Realtime Database. El Live antiguo sigue intacto hasta F2/F3.</div>`;
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
    status.textContent = state.message || "Carga un evento Firestore para preparar su acceso Live V2.";
    button.disabled = true; return;
  }
  const statusKey = String(state.event.status || "draft");
  chip.textContent = statusKey.toUpperCase();
  button.disabled = state.busy || !navigator.onLine || !SYNCABLE_STATES.has(statusKey);
  if (state.message) status.textContent = state.message;
  else if (!SYNCABLE_STATES.has(statusKey)) status.textContent = `Estado ${statusKey.toUpperCase()}: Live V2 se prepara desde PREPARADO.`;
  else status.textContent = "Base Live V2 lista para sincronizar accesos.";
  button.textContent = state.busy ? "SINCRONIZANDO…" : "SINCRONIZAR ACCESO LIVE V2";
}
function errorMessage(error) {
  const code = String(error?.code || "").trim();
  const msg = String(error?.message || error || "").trim();
  const joined = `${code} ${msg}`.toLowerCase();
  if (joined.includes("permission") || joined.includes("denied")) {
    return "⛔ Realtime Database rechazó la operación. Comprueba que las reglas F1 corregidas estén desplegadas.";
  }
  if (joined.includes("network") || joined.includes("unavailable") || joined.includes("offline")) {
    return "📴 No se pudo conectar con Realtime Database. Comprueba la conexión y vuelve a intentarlo.";
  }
  return `⚠️ No se pudo preparar Live V2${code ? ` · ${code}` : ""}. Firestore y el Live antiguo no se han modificado.`;
}
async function readEventAndMembers(eventId) {
  const { firestore } = await services();
  const eventSnap = await getDoc(doc(firestore, "events", eventId));
  if (!eventSnap.exists()) throw new Error("EVENT_NOT_FOUND");
  const data = { ...(eventSnap.data() || {}), eventId: eventSnap.id };
  const ownerUid = String(data.ownerUid || "");
  if (!ownerUid) throw new Error("EVENT_WITHOUT_OWNER");
  if (roleOf() !== "super_admin" && ownerUid !== String(state.auth?.uid || "")) throw new Error("EVENT_NOT_OWNED");
  const memberSnap = await getDocs(collection(firestore, "events", eventId, "members"));
  const members = [];
  memberSnap.forEach(d => {
    const row = d.data() || {};
    members.push({ uid: String(row.uid || d.id), status: String(row.status || "active") });
  });
  return { data, members };
}
async function sync(userRequested = false) {
  const eventId = eventIdNow();
  state.eventId = eventId;
  if (!canManage() || !eventId || state.busy) { paint(); return false; }
  if (!navigator.onLine) { paint("📴 Sin conexión. La base Live V2 no se modifica."); return false; }

  state.busy = true;
  paint("Comprobando Firestore y Realtime Database…");
  try {
    const { database } = await services();
    const { data, members } = await readEventAndMembers(eventId);
    state.event = data;
    const eventStatus = String(data.status || "draft");
    if (!SYNCABLE_STATES.has(eventStatus)) {
      state.message = "";
      return false;
    }

    const hash = stableHash(data, members);
    if (!userRequested && hash === state.lastHash) {
      const active = members.filter(x => x.status === "active").length;
      state.message = `✅ Live V2 al día · ${active} corredor${active === 1 ? "" : "es"} autorizado${active === 1 ? "" : "s"}.`;
      return true;
    }
    // Si un intento automático ya falló con exactamente los mismos datos, no lo
    // repetimos en bucle. El botón manual sigue disponible para reintentar.
    if (!userRequested && hash === state.lastFailedHash) {
      state.message = state.lastFailedMessage || "⚠️ Live V2 pendiente de reintento manual.";
      return false;
    }
    state.lastAttemptHash = hash;

    const ownerUid = String(data.ownerUid);
    const base = `v2/live/${ownerUid}/${eventId}`;
    const currentMembersSnap = await get(ref(database, `${base}/members`));
    const currentMembers = currentMembersSnap.exists() ? (currentMembersSnap.val() || {}) : {};
    const updates = {
      "meta/ownerUid": ownerUid,
      "meta/eventId": eventId,
      "meta/eventName": String(data.eventName || "").slice(0, 140),
      "meta/status": eventStatus,
      "meta/schemaVersion": 1,
      "meta/updatedAt": serverTimestamp()
    };
    const seen = new Set();
    for (const member of members) {
      if (!member.uid) continue;
      seen.add(member.uid);
      updates[`members/${member.uid}/uid`] = member.uid;
      updates[`members/${member.uid}/active`] = member.status === "active";
      updates[`members/${member.uid}/status`] = member.status;
      updates[`members/${member.uid}/updatedAt`] = serverTimestamp();
    }
    Object.keys(currentMembers).forEach(uid => { if (!seen.has(uid)) updates[`members/${uid}`] = null; });

    await update(ref(database, base), updates);
    state.lastHash = hash;
    state.lastFailedHash = "";
    state.lastFailedMessage = "";
    const active = members.filter(row => row.status === "active").length;
    const removed = members.filter(row => row.status === "removed").length;
    state.message = `✅ Live V2 preparado · ${active} autorizado${active === 1 ? "" : "s"}${removed ? ` · ${removed} retirado${removed === 1 ? "" : "s"}` : ""}.`;
    globalThis.dispatchEvent(new CustomEvent("militopo:v2-live-foundation-ready", { detail: { eventId, ownerUid, activeMembers: active } }));
    return true;
  } catch (error) {
    console.error("[MILITOPO F1] sync", error);
    const msg = errorMessage(error);
    state.lastFailedHash = state.lastAttemptHash;
    state.lastFailedMessage = msg;
    state.message = msg;
    return false;
  } finally {
    state.busy = false;
    paint();
  }
}
async function refreshFromEventStatus(detail = {}) {
  const eventId = String(detail.eventId || eventIdNow()).trim();
  state.eventId = eventId;
  if (!eventId || !canManage()) { state.event = null; paint(); return; }
  try {
    const { data } = await readEventAndMembers(eventId);
    state.event = data;
    clearTimeout(state.timer);
    state.timer = setTimeout(() => sync(false), 650);
  } catch (error) {
    state.event = null; paint("No se pudo leer el evento para Live V2.");
  }
}
function onAuthReady(event) {
  state.auth = event?.detail || globalThis.MILITOPO_V2_AUTH || null;
  paint();
  const detail = globalThis.MILITOPO_V2_EVENT_STATUS || {};
  if (detail.eventId) refreshFromEventStatus(detail);
}
function init() {
  ensurePanel();
  globalThis.addEventListener("militopo:v2-auth-ready", onAuthReady);
  globalThis.addEventListener("militopo:v2-event-status", event => refreshFromEventStatus(event.detail || {}));
  globalThis.addEventListener("militopo:v2-event-status-changed", event => refreshFromEventStatus(event.detail || globalThis.MILITOPO_V2_EVENT_STATUS || {}));
  globalThis.addEventListener("militopo:v2-roster-refresh", () => { if (state.eventId) { clearTimeout(state.timer); state.timer = setTimeout(() => sync(false), 650); } });
  globalThis.addEventListener("militopo:v2-invitation-accepted", () => { if (state.eventId) { clearTimeout(state.timer); state.timer = setTimeout(() => sync(false), 650); } });
  globalThis.addEventListener("online", () => { if (state.eventId) refreshFromEventStatus({ eventId: state.eventId }); });
  globalThis.addEventListener("offline", () => paint("📴 Sin conexión. Live V2 conserva la última configuración en Realtime Database."));
  if (globalThis.MILITOPO_V2_AUTH) onAuthReady({ detail: globalThis.MILITOPO_V2_AUTH });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true }); else init();
