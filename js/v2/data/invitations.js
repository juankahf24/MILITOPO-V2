/* MILITOPO V2 · Fase E1 ampliada · invitaciones por enlace/WhatsApp + estado en app.
   Spark-safe: Firestore + Auth, sin Functions ni servicios de pago. */
import "../bootstrap.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const MANAGER_ROLES = new Set(["organizer", "super_admin"]);
const ALLOWED_EVENT_STATES = new Set(["prepared", "published"]);
const state = {
  auth: globalThis.MILITOPO_V2_AUTH || null,
  services: null,
  event: null,
  rows: [],
  busy: false,
  panel: null,
  list: null,
  status: null,
  email: null,
  create: null
};

function roleOf() {
  const role = String(state.auth?.role || "runner");
  return ["runner", "organizer", "super_admin"].includes(role) ? role : "runner";
}
function canManage() {
  return Boolean(state.auth?.uid && state.auth?.emailVerified && MANAGER_ROLES.has(roleOf()));
}
function currentEventId() {
  return String(document.getElementById("eventId")?.value || "").trim();
}
function normalizedEmail(value) {
  return String(value || "").trim().toLowerCase().slice(0, 254);
}
function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function formatDate(value) {
  try {
    const date = value?.toDate ? value.toDate() : value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime()) ? date.toLocaleString("es-ES") : "—";
  } catch (_) { return "—"; }
}
async function services() {
  if (state.services) return state.services;
  state.services = await globalThis.MILITOPO_V2.firebase();
  return state.services;
}
function invitationUrl(id) {
  const root = new URL("../", window.location.href);
  root.hash = "";
  root.search = "";
  root.searchParams.set("invite", String(id));
  return root.href;
}
function shareMessage(row) {
  const eventName = String(row.eventName || state.event?.eventName || "una carrera de orientación").trim();
  return `Te han invitado a participar en ${eventName} con MILITOPO.\n\nAbre este enlace para iniciar sesión y unirte a la carrera:\n${invitationUrl(row.id)}`;
}
function statusLabel(row) {
  const status = String(row.status || "pending");
  if (status === "accepted") return "ACEPTADA";
  if (status === "revoked") return "REVOCADA";
  return "PENDIENTE";
}
function injectStyle() {
  if (document.getElementById("m2InviteStyle")) return;
  const style = document.createElement("style");
  style.id = "m2InviteStyle";
  style.textContent = `
    .m2-invites{margin:14px 0;padding:14px;border:1px solid rgba(255,255,255,.16);border-radius:14px;background:rgba(255,255,255,.035)}
    .m2-invites-head{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px}
    .m2-invites-title{font-weight:900;letter-spacing:.04em}
    .m2-invites-chip{font-size:.75rem;font-weight:900;border:1px solid rgba(245,204,121,.32);border-radius:999px;padding:5px 9px}
    .m2-invites-form{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end}
    .m2-invites-form label{display:grid;gap:5px;font-size:.82rem;font-weight:800}
    .m2-invites-form input{width:100%;min-height:44px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#0d140b;color:#fff;padding:10px 12px;font:inherit;font-size:16px}
    .m2-invites button{min-height:44px;border-radius:10px;border:1px solid rgba(245,204,121,.35);background:rgba(245,204,121,.14);color:inherit;padding:9px 12px;font:inherit;font-weight:900;cursor:pointer}
    .m2-invites button:disabled{opacity:.45;cursor:not-allowed}
    .m2-invites-create{background:linear-gradient(180deg,#f6d285,#d99c38)!important;color:#1b160c!important}
    .m2-invites-status{margin:9px 0;font-size:.82rem;line-height:1.4;opacity:.86}
    .m2-invites-list{display:grid;gap:8px;margin-top:10px}
    .m2-invite-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px;border:1px solid rgba(255,255,255,.12);border-radius:11px;background:rgba(0,0,0,.12)}
    .m2-invite-email{font-weight:900;overflow-wrap:anywhere}
    .m2-invite-link{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.73rem;opacity:.76;overflow-wrap:anywhere;margin-top:3px}
    .m2-invite-meta{font-size:.75rem;opacity:.65;margin-top:3px}
    .m2-invite-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;max-width:330px}
    .m2-invite-actions button{font-size:.78rem}
    .m2-invite-revoked{opacity:.55}
    .m2-invite-accepted{border-color:rgba(126,220,150,.35)}
    @media(max-width:680px){.m2-invites-form{grid-template-columns:1fr}.m2-invites-form button{width:100%}.m2-invite-item{grid-template-columns:1fr}.m2-invite-actions{justify-content:stretch;max-width:none}.m2-invite-actions button{flex:1 1 45%}}
  `;
  document.head.appendChild(style);
}
function ensurePanel() {
  if (state.panel?.isConnected) return state.panel;
  const step = document.getElementById("step1");
  if (!step) return null;
  injectStyle();
  const panel = document.createElement("section");
  panel.id = "m2Invitations";
  panel.className = "m2-invites";
  panel.innerHTML = `
    <div class="m2-invites-head">
      <div class="m2-invites-title">👥 PARTICIPANTES · INVITACIONES</div>
      <div id="m2InviteChip" class="m2-invites-chip">SIN EVENTO</div>
    </div>
    <div class="m2-invites-form">
      <label>Correo del participante
        <input id="m2InviteEmail" type="email" inputmode="email" autocomplete="email" placeholder="participante@correo.com">
      </label>
      <button id="m2InviteCreate" class="m2-invites-create" type="button" disabled>CREAR INVITACIÓN</button>
    </div>
    <div id="m2InviteStatus" class="m2-invites-status">Carga un evento PREPARADO o PUBLICADO.</div>
    <div id="m2InviteList" class="m2-invites-list"></div>`;
  const lifecycle = document.getElementById("m2EventLifecycle");
  if (lifecycle) lifecycle.insertAdjacentElement("afterend", panel);
  else {
    const nav = step.querySelector(".nav-row");
    if (nav) nav.insertAdjacentElement("beforebegin", panel); else step.appendChild(panel);
  }
  state.panel = panel;
  state.list = panel.querySelector("#m2InviteList");
  state.status = panel.querySelector("#m2InviteStatus");
  state.email = panel.querySelector("#m2InviteEmail");
  state.create = panel.querySelector("#m2InviteCreate");
  state.create.addEventListener("click", createInvitation);
  state.list.addEventListener("click", onListClick);
  return panel;
}
function paint(message = "") {
  ensurePanel();
  if (!state.panel) return;
  const chip = state.panel.querySelector("#m2InviteChip");
  if (!canManage()) {
    chip.textContent = "SIN PERMISOS";
    state.status.textContent = "Se necesita una cuenta organizer o super_admin verificada.";
    state.create.disabled = true;
    state.email.disabled = true;
    return;
  }
  state.email.disabled = state.busy;
  if (!state.event) {
    chip.textContent = currentEventId() ? "COMPROBANDO" : "SIN EVENTO";
    state.status.textContent = message || "Carga un evento PREPARADO o PUBLICADO.";
    state.create.disabled = true;
    return;
  }
  const status = String(state.event.status || "draft");
  chip.textContent = status.toUpperCase();
  const allowed = ALLOWED_EVENT_STATES.has(status);
  state.create.disabled = state.busy || !allowed || !navigator.onLine;
  state.status.textContent = message || (allowed
    ? "Crea una invitación individual. El corredor la verá en su cuenta y también puedes enviársela por WhatsApp o compartir el enlace."
    : `Las invitaciones solo se crean con el evento PREPARADO o PUBLICADO. Estado actual: ${status.toUpperCase()}.`);
}
async function loadEvent() {
  ensurePanel();
  const eventId = currentEventId();
  state.event = null;
  state.rows = [];
  state.list.innerHTML = "";
  if (!canManage() || !eventId || !navigator.onLine) { paint(); return false; }
  try {
    const { firestore } = await services();
    const snap = await getDoc(doc(firestore, "events", eventId));
    if (!snap.exists()) { paint("El evento todavía no existe en Firestore."); return false; }
    const data = snap.data() || {};
    if (roleOf() !== "super_admin" && String(data.ownerUid || "") !== String(state.auth.uid || "")) {
      paint("Este evento no pertenece a esta cuenta."); return false;
    }
    state.event = { ...data, eventId: snap.id };
    paint();
    await loadInvitations();
    return true;
  } catch (error) {
    console.error("[MILITOPO E1] load event", error);
    paint("No se pudo leer el evento. La aplicación local sigue intacta.");
    return false;
  }
}
async function loadInvitations() {
  if (!state.event || !canManage()) return;
  try {
    const { firestore } = await services();
    let snap;
    if (roleOf() === "super_admin") {
      snap = await getDocs(query(collection(firestore, "invitations"), where("eventId", "==", state.event.eventId)));
    } else {
      snap = await getDocs(query(collection(firestore, "invitations"), where("createdBy", "==", state.auth.uid)));
    }
    const rows = [];
    snap.forEach(d => {
      const data = d.data() || {};
      if (String(data.eventId || "") === state.event.eventId) rows.push({ id: d.id, ...data });
    });
    rows.sort((a,b) => {
      const am = a.createdAt?.toMillis?.() || 0, bm = b.createdAt?.toMillis?.() || 0;
      return bm - am;
    });
    state.rows = rows;
    renderList(rows);
  } catch (error) {
    console.error("[MILITOPO E1] list", error);
    state.list.innerHTML = `<div class="status warn">No se pudieron cargar las invitaciones.</div>`;
  }
}
function renderList(rows) {
  if (!rows.length) {
    state.list.innerHTML = `<div style="font-size:.82rem;opacity:.68">Aún no hay invitaciones para este evento.</div>`;
    return;
  }
  state.list.innerHTML = rows.map(row => {
    const status = String(row.status || "pending");
    const revoked = status === "revoked";
    const accepted = status === "accepted";
    const url = invitationUrl(row.id);
    return `<article class="m2-invite-item ${revoked ? "m2-invite-revoked" : ""} ${accepted ? "m2-invite-accepted" : ""}">
      <div>
        <div class="m2-invite-email">${esc(row.targetEmail || "Sin correo")}</div>
        <div class="m2-invite-meta">${esc(statusLabel(row))} · ${esc(formatDate(row.createdAt))}</div>
        <div class="m2-invite-link">${esc(url)}</div>
      </div>
      <div class="m2-invite-actions">
        <button type="button" data-whatsapp="${esc(row.id)}">WHATSAPP</button>
        <button type="button" data-share="${esc(row.id)}">COMPARTIR</button>
        <button type="button" data-copy-link="${esc(row.id)}">COPIAR ENLACE</button>
        ${status === "pending" ? `<button type="button" data-revoke="${esc(row.id)}">REVOCAR</button>` : ""}
      </div>
    </article>`;
  }).join("");
}
async function createInvitation() {
  if (state.busy || !state.event) return;
  const email = normalizedEmail(state.email.value);
  if (!validEmail(email)) {
    paint("Escribe un correo válido para el participante.");
    state.email.focus();
    return;
  }
  if (!ALLOWED_EVENT_STATES.has(String(state.event.status || ""))) { paint(); return; }
  const existing = state.rows.find(row => normalizedEmail(row.targetEmail) === email && String(row.status || "pending") === "pending");
  if (existing) {
    paint("Ese corredor ya tiene una invitación pendiente. Puedes compartir el enlace que aparece debajo.");
    return;
  }
  state.busy = true;
  paint("Creando invitación…");
  try {
    const { firestore } = await services();
    const ref = doc(collection(firestore, "invitations"));
    await setDoc(ref, {
      schemaVersion: 2,
      eventId: state.event.eventId,
      eventName: String(state.event.eventName || "").slice(0, 140),
      createdBy: state.auth.uid,
      targetEmail: email,
      role: "runner",
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    state.email.value = "";
    paint("✅ Invitación creada. Ya puedes enviarla por WhatsApp, compartirla o copiar el enlace.");
    await loadInvitations();
  } catch (error) {
    console.error("[MILITOPO E1] create", error);
    paint(`No se pudo crear la invitación: ${String(error?.message || error)}`);
  } finally {
    state.busy = false;
    paint(state.status.textContent);
  }
}
async function revokeInvitation(id) {
  if (!id || state.busy) return;
  if (!confirm("¿Revocar esta invitación? El participante ya no podrá utilizar este enlace.")) return;
  state.busy = true;
  paint("Revocando invitación…");
  try {
    const { firestore } = await services();
    await updateDoc(doc(firestore, "invitations", id), {
      status: "revoked",
      revokedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await loadInvitations();
    paint("✅ Invitación revocada.");
  } catch (error) {
    console.error("[MILITOPO E1] revoke", error);
    paint(`No se pudo revocar: ${String(error?.message || error)}`);
  } finally {
    state.busy = false;
    paint(state.status.textContent);
  }
}
function rowById(id) {
  return state.rows.find(row => String(row.id) === String(id)) || null;
}
async function copyLink(id) {
  const url = invitationUrl(id);
  try {
    await navigator.clipboard.writeText(url);
    if (typeof globalThis.toast === "function") globalThis.toast("Enlace de invitación copiado");
    else paint("✅ Enlace copiado.");
  } catch (_) {
    prompt("Copia este enlace de invitación:", url);
  }
}
function shareWhatsApp(id) {
  const row = rowById(id);
  if (!row) return;
  const url = `https://wa.me/?text=${encodeURIComponent(shareMessage(row))}`;
  window.open(url, "_blank", "noopener,noreferrer");
}
async function shareNative(id) {
  const row = rowById(id);
  if (!row) return;
  const url = invitationUrl(id);
  const text = shareMessage(row);
  if (navigator.share) {
    try {
      await navigator.share({ title: `Invitación MILITOPO · ${row.eventName || "Carrera"}`, text, url });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  await copyLink(id);
}
function onListClick(event) {
  const whatsapp = event.target.closest("[data-whatsapp]");
  if (whatsapp) { shareWhatsApp(whatsapp.dataset.whatsapp); return; }
  const share = event.target.closest("[data-share]");
  if (share) { shareNative(share.dataset.share); return; }
  const copy = event.target.closest("[data-copy-link]");
  if (copy) { copyLink(copy.dataset.copyLink); return; }
  const revoke = event.target.closest("[data-revoke]");
  if (revoke) revokeInvitation(revoke.dataset.revoke);
}
function scheduleLoad(delay = 250) {
  clearTimeout(scheduleLoad.timer);
  scheduleLoad.timer = setTimeout(() => loadEvent(), delay);
}
function init() {
  ensurePanel();
  globalThis.addEventListener("militopo:v2-auth-ready", event => {
    state.auth = event?.detail || globalThis.MILITOPO_V2_AUTH || null;
    scheduleLoad(150);
  });
  globalThis.addEventListener("militopo:v2-orientation-header", () => scheduleLoad(700));
  globalThis.addEventListener("militopo:v2-cloud-event-applied", event => { if (event?.detail?.ok) scheduleLoad(250); });
  globalThis.addEventListener("militopo:v2-event-status-changed", () => scheduleLoad(250));
  globalThis.addEventListener("online", () => scheduleLoad(100));
  globalThis.addEventListener("offline", () => paint("📴 Sin conexión: no se pueden crear invitaciones ahora."));
  if (globalThis.MILITOPO_V2_AUTH) scheduleLoad(120);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
