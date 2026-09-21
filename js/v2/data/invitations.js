/* MILITOPO V2 · Fase E2 · invitaciones por @usuario, correo y lotes.
   Spark-safe: Firestore + Auth, sin Functions ni servicios de pago. */
import "../bootstrap.js";
import {
  collection,
  doc,
  documentId,
  endAt,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAt,
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
  target: null,
  bulk: null,
  create: null,
  bulkCreate: null,
  userSearch: null,
  userResults: null,
  selectedBox: null,
  selectedCreate: null,
  selectedUsers: new Map(),
  directoryCache: new Map(),
  directorySearchTimer: null,
  loadedEventId: "",
  loading: false
};

function roleOf() {
  const role = String(state.auth?.role || "runner");
  return ["runner", "organizer", "super_admin"].includes(role) ? role : "runner";
}
function canManage() { return Boolean(state.auth?.uid && state.auth?.emailVerified && MANAGER_ROLES.has(roleOf())); }
function currentEventId() { return String(document.getElementById("eventId")?.value || "").trim(); }
function normalizedEmail(value) { return String(value || "").trim().toLowerCase().slice(0, 254); }
function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function normalizeUsername(value) { return String(value || "").trim().toLowerCase().replace(/^@+/, "").slice(0, 24); }
function validUsername(value) { return /^[a-z0-9._-]{3,24}$/.test(normalizeUsername(value)); }
function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
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
  const who = row.targetUsername ? `@${row.targetUsername}` : row.targetEmail || "participante";
  return `Hola ${who}. Te han invitado a participar en ${eventName} con MILITOPO.\n\nAbre este enlace para iniciar sesión y unirte a la carrera:\n${invitationUrl(row.id)}`;
}
function statusLabel(row) {
  const status = String(row.status || "pending");
  if (status === "accepted") return "ACEPTADA";
  if (status === "revoked") return "REVOCADA";
  return "PENDIENTE";
}
function targetLabel(row) {
  if (row.targetUsername) return `@${row.targetUsername}${row.targetDisplayName ? ` · ${row.targetDisplayName}` : ""}`;
  return row.targetEmail || "Sin destinatario";
}
function injectStyle() {
  if (document.getElementById("m2InviteStyle")) return;
  const style = document.createElement("style");
  style.id = "m2InviteStyle";
  style.textContent = `
    .m2-invites{margin:14px 0;padding:14px;border:1px solid rgba(255,255,255,.16);border-radius:14px;background:rgba(255,255,255,.035)}
    .m2-invites-head{display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px}
    .m2-invites-title{font-weight:900;letter-spacing:.04em}.m2-invites-chip{font-size:.75rem;font-weight:900;border:1px solid rgba(245,204,121,.32);border-radius:999px;padding:5px 9px}
    .m2-invites-form{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end}.m2-invites-form label,.m2-invites-bulk label{display:grid;gap:5px;font-size:.82rem;font-weight:800}
    .m2-invites input,.m2-invites textarea{width:100%;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#0d140b;color:#fff;padding:10px 12px;font:inherit;font-size:16px;box-sizing:border-box}
    .m2-invites input{min-height:44px}.m2-invites textarea{min-height:110px;resize:vertical;line-height:1.45}
    .m2-invites button{min-height:44px;border-radius:10px;border:1px solid rgba(245,204,121,.35);background:rgba(245,204,121,.14);color:inherit;padding:9px 12px;font:inherit;font-weight:900;cursor:pointer}.m2-invites button:disabled{opacity:.45;cursor:not-allowed}
    .m2-invites-create{background:linear-gradient(180deg,#f6d285,#d99c38)!important;color:#1b160c!important}.m2-invites-status{margin:9px 0;font-size:.82rem;line-height:1.55;opacity:.9;white-space:pre-line}
    .m2-user-picker{position:relative;margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.1);display:grid;gap:8px}.m2-user-picker label{display:grid;gap:5px;font-size:.82rem;font-weight:800}
    .m2-user-results{display:grid;gap:5px;max-height:280px;overflow:auto;padding:5px;border:1px solid rgba(255,255,255,.12);border-radius:11px;background:#0b1209}.m2-user-results[hidden]{display:none!important}
    .m2-user-option{display:flex!important;align-items:center;justify-content:space-between;gap:10px;text-align:left;width:100%;background:rgba(255,255,255,.04)!important}.m2-user-option-main{min-width:0}.m2-user-option-name{font-weight:900;overflow-wrap:anywhere}.m2-user-option-handle{font-size:.76rem;opacity:.68;overflow-wrap:anywhere}.m2-user-option-state{font-size:.72rem;opacity:.72;white-space:nowrap}
    .m2-selected-users{display:flex;gap:6px;flex-wrap:wrap;min-height:8px}.m2-selected-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(126,220,150,.3);border-radius:999px;padding:6px 8px;background:rgba(126,220,150,.08);font-size:.78rem}.m2-selected-chip button{min-height:28px!important;padding:1px 7px!important;border-radius:999px!important}.m2-user-picker small{opacity:.68;line-height:1.4}
    .m2-invites-bulk{margin-top:12px;padding-top:12px;border-top:1px solid rgba(255,255,255,.1);display:grid;gap:8px}.m2-invites-bulk small{opacity:.68;line-height:1.4}
    .m2-invites-list{display:grid;gap:8px;margin-top:10px;min-height:22px}.m2-invite-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px;border:1px solid rgba(255,255,255,.12);border-radius:11px;background:rgba(0,0,0,.12)}
    .m2-invite-email{font-weight:900;overflow-wrap:anywhere}.m2-invite-link{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.73rem;opacity:.76;overflow-wrap:anywhere;margin-top:3px}.m2-invite-meta{font-size:.75rem;opacity:.65;margin-top:3px}
    .m2-invite-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;max-width:360px}.m2-invite-actions button{font-size:.78rem}.m2-invite-revoked{opacity:.55}.m2-invite-accepted{border-color:rgba(126,220,150,.35)}
    @media(max-width:680px){.m2-invites-form{grid-template-columns:1fr}.m2-invites-form button,.m2-invites-bulk button,.m2-user-picker>.m2-selected-create{width:100%}.m2-invite-item{grid-template-columns:1fr}.m2-invite-actions{justify-content:stretch;max-width:none}.m2-invite-actions button{flex:1 1 45%}}
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
    <div class="m2-invites-head"><div class="m2-invites-title">👥 PARTICIPANTES · INVITACIONES</div><div id="m2InviteChip" class="m2-invites-chip">SIN EVENTO</div></div>
    <div class="m2-invites-form">
      <label>@usuario o correo
        <input id="m2InviteTarget" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="@corredor o participante@correo.com">
      </label>
      <button id="m2InviteCreate" class="m2-invites-create" type="button" disabled>INVITAR</button>
    </div>
    <div class="m2-user-picker">
      <label>Buscar usuarios registrados en MILITOPO
        <input id="m2InviteUserSearch" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Escribe c, ca, @casper…">
      </label>
      <small>Escribe una o más letras. La lista se filtra por @usuario mientras escribes. Pulsa un usuario para añadirlo a la selección.</small>
      <div id="m2InviteUserResults" class="m2-user-results" hidden></div>
      <div id="m2InviteSelected" class="m2-selected-users"></div>
      <button id="m2InviteSelectedCreate" class="m2-selected-create" type="button" disabled>INVITAR USUARIOS SELECCIONADOS</button>
    </div>
    <div class="m2-invites-bulk">
      <label>Pegar lista de usuarios o correos
        <textarea id="m2InviteBulk" autocapitalize="none" spellcheck="false" placeholder="@juan\n@maria\npedro@correo.com"></textarea>
      </label>
      <small>Para listas externas puedes pegar usuarios o correos separados por líneas, espacios, comas o punto y coma. MILITOPO elimina duplicados y omite los que ya tengan invitación pendiente.</small>
      <button id="m2InviteBulkCreate" type="button" disabled>INVITAR A TODOS</button>
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
  state.target = panel.querySelector("#m2InviteTarget");
  state.bulk = panel.querySelector("#m2InviteBulk");
  state.create = panel.querySelector("#m2InviteCreate");
  state.bulkCreate = panel.querySelector("#m2InviteBulkCreate");
  state.userSearch = panel.querySelector("#m2InviteUserSearch");
  state.userResults = panel.querySelector("#m2InviteUserResults");
  state.selectedBox = panel.querySelector("#m2InviteSelected");
  state.selectedCreate = panel.querySelector("#m2InviteSelectedCreate");
  state.create.addEventListener("click", () => createTargets([state.target.value], false, "single"));
  state.bulkCreate.addEventListener("click", () => createTargets(parseBulk(state.bulk.value), true, "bulk"));
  state.selectedCreate.addEventListener("click", () => createTargets([...state.selectedUsers.keys()].map(key => `@${key}`), true, "selected"));
  state.userSearch.addEventListener("focus", () => scheduleDirectorySearch(0));
  state.userSearch.addEventListener("input", () => scheduleDirectorySearch(180));
  state.userResults.addEventListener("click", onDirectoryClick);
  state.selectedBox.addEventListener("click", onSelectedClick);
  state.list.addEventListener("click", onListClick);
  renderSelectedUsers();
  return panel;
}
function paint(message = "") {
  ensurePanel(); if (!state.panel) return;
  const chip = state.panel.querySelector("#m2InviteChip");
  if (!canManage()) {
    chip.textContent = "SIN PERMISOS"; state.status.textContent = "Se necesita una cuenta organizer o super_admin verificada.";
    state.create.disabled = true; state.bulkCreate.disabled = true; state.selectedCreate.disabled = true;
    state.target.disabled = true; state.bulk.disabled = true; state.userSearch.disabled = true; return;
  }
  state.target.disabled = state.busy; state.bulk.disabled = state.busy; state.userSearch.disabled = state.busy;
  renderSelectedUsers();
  if (!state.event) {
    chip.textContent = currentEventId() ? "COMPROBANDO" : "SIN EVENTO";
    state.status.textContent = message || "Carga un evento PREPARADO o PUBLICADO."; state.create.disabled = true; state.bulkCreate.disabled = true; state.selectedCreate.disabled = true; return;
  }
  const status = String(state.event.status || "draft"); chip.textContent = status.toUpperCase();
  const allowed = ALLOWED_EVENT_STATES.has(status);
  state.create.disabled = state.busy || !allowed || !navigator.onLine;
  state.bulkCreate.disabled = state.busy || !allowed || !navigator.onLine;
  state.selectedCreate.disabled = state.busy || !allowed || !navigator.onLine || state.selectedUsers.size === 0;
  state.status.textContent = message || (allowed ? "Busca por @usuario si ya tiene cuenta MILITOPO, o usa su correo si todavía no está registrado." : `Las invitaciones solo se crean con el evento PREPARADO o PUBLICADO. Estado actual: ${status.toUpperCase()}.`);
}
async function loadEvent({ force = false } = {}) {
  ensurePanel(); const eventId = currentEventId();
  if (!canManage() || !eventId || !navigator.onLine) { paint(); return false; }
  if (!force && state.event?.eventId === eventId && state.loadedEventId === eventId) return true;
  if (state.loading) return false;
  const changedEvent = state.loadedEventId && state.loadedEventId !== eventId; state.loading = true;
  if (changedEvent) { state.event = null; state.rows = []; state.list.innerHTML = `<div style="font-size:.82rem;opacity:.68">Cargando invitaciones…</div>`; paint("Cargando el evento seleccionado…"); }
  try {
    const { firestore } = await services(); const snap = await getDoc(doc(firestore, "events", eventId));
    if (!snap.exists()) { if (changedEvent) state.list.innerHTML = ""; paint("El evento todavía no existe en Firestore."); return false; }
    const data = snap.data() || {};
    if (roleOf() !== "super_admin" && String(data.ownerUid || "") !== String(state.auth.uid || "")) { if (changedEvent) state.list.innerHTML = ""; paint("Este evento no pertenece a esta cuenta."); return false; }
    state.event = { ...data, eventId: snap.id }; state.loadedEventId = eventId; paint(); await loadInvitations(); return true;
  } catch (error) { console.error("[MILITOPO E2] load event", error); paint("No se pudo leer el evento. La aplicación local sigue intacta."); return false; }
  finally { state.loading = false; }
}
async function loadInvitations() {
  if (!state.event || !canManage()) return;
  try {
    const { firestore } = await services(); let snap;
    if (roleOf() === "super_admin") snap = await getDocs(query(collection(firestore, "invitations"), where("eventId", "==", state.event.eventId)));
    else snap = await getDocs(query(collection(firestore, "invitations"), where("createdBy", "==", state.auth.uid)));
    const rows = [];
    snap.forEach(d => { const data = d.data() || {}; if (String(data.eventId || "") === state.event.eventId) rows.push({ id: d.id, ...data }); });
    rows.sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)); state.rows = rows; renderList(rows);
  } catch (error) { console.error("[MILITOPO E2] list", error); state.list.innerHTML = `<div class="status warn">No se pudieron cargar las invitaciones.</div>`; }
}
function renderList(rows) {
  if (!rows.length) { state.list.innerHTML = `<div style="font-size:.82rem;opacity:.68">Aún no hay invitaciones para este evento.</div>`; return; }
  state.list.innerHTML = rows.map(row => {
    const status = String(row.status || "pending"), revoked = status === "revoked", accepted = status === "accepted", url = invitationUrl(row.id);
    return `<article class="m2-invite-item ${revoked ? "m2-invite-revoked" : ""} ${accepted ? "m2-invite-accepted" : ""}">
      <div><div class="m2-invite-email">${esc(targetLabel(row))}</div><div class="m2-invite-meta">${esc(statusLabel(row))} · ${esc(formatDate(row.createdAt))}</div><div class="m2-invite-link">${esc(url)}</div></div>
      <div class="m2-invite-actions"><button type="button" data-whatsapp="${esc(row.id)}">WHATSAPP</button><button type="button" data-share="${esc(row.id)}">COMPARTIR</button><button type="button" data-copy-link="${esc(row.id)}">COPIAR ENLACE</button>${row.targetEmail ? `<button type="button" data-email="${esc(row.id)}">EMAIL</button>` : ""}${status === "pending" ? `<button type="button" data-revoke="${esc(row.id)}">REVOCAR</button>` : ""}</div>
    </article>`;
  }).join("");
}
function renderSelectedUsers() {
  if (!state.selectedBox || !state.selectedCreate) return;
  const rows = [...state.selectedUsers.values()];
  state.selectedBox.innerHTML = rows.map(row => `<span class="m2-selected-chip"><span>@${esc(row.username)}${row.displayName ? ` · ${esc(row.displayName)}` : ""}</span><button type="button" data-remove-user="${esc(row.username)}" aria-label="Quitar @${esc(row.username)}">×</button></span>`).join("");
  const status = String(state.event?.status || "");
  state.selectedCreate.disabled = state.busy || !ALLOWED_EVENT_STATES.has(status) || !navigator.onLine || rows.length === 0;
}
function renderDirectoryResults(rows, prefix = "") {
  if (!state.userResults) return;
  if (!rows.length) {
    state.userResults.hidden = false;
    state.userResults.innerHTML = `<div style="padding:8px;font-size:.8rem;opacity:.7">${prefix ? `No hay usuarios que empiecen por @${esc(prefix)}.` : "Todavía no hay usuarios para mostrar."}</div>`;
    return;
  }
  state.userResults.hidden = false;
  state.userResults.innerHTML = rows.map(row => {
    const username = normalizeUsername(row.usernameKey || row.username);
    const own = String(row.uid || "") === String(state.auth?.uid || "");
    const selected = state.selectedUsers.has(username);
    const label = own ? "TU CUENTA" : selected ? "AÑADIDO" : "AÑADIR";
    return `<button class="m2-user-option" type="button" data-select-user="${esc(username)}" ${own || selected ? "disabled" : ""}>
      <span class="m2-user-option-main"><span class="m2-user-option-name">${esc(row.displayName || `@${username}`)}</span><br><span class="m2-user-option-handle">@${esc(username)}</span></span>
      <span class="m2-user-option-state">${label}</span>
    </button>`;
  }).join("");
}
async function searchDirectory(raw = "") {
  if (!canManage() || !navigator.onLine || !state.userResults) return;
  const prefix = normalizeUsername(raw);
  if (String(raw || "").trim() && !/^[a-z0-9._-]{1,24}$/.test(prefix)) {
    renderDirectoryResults([], prefix);
    return;
  }
  const cacheKey = prefix || "*";
  if (state.directoryCache.has(cacheKey)) {
    renderDirectoryResults(state.directoryCache.get(cacheKey), prefix);
    return;
  }
  state.userResults.hidden = false;
  state.userResults.innerHTML = `<div style="padding:8px;font-size:.8rem;opacity:.7">Buscando usuarios…</div>`;
  try {
    const { firestore } = await services();
    const base = collection(firestore, "usernames");
    const q = prefix
      ? query(base, orderBy(documentId()), startAt(prefix), endAt(`${prefix}\uf8ff`), limit(12))
      : query(base, orderBy(documentId()), limit(12));
    const snap = await getDocs(q);
    const rows = [];
    snap.forEach(d => rows.push({ id:d.id, ...(d.data() || {}) }));
    state.directoryCache.set(cacheKey, rows);
    renderDirectoryResults(rows, prefix);
  } catch (error) {
    console.error("[MILITOPO E2] directory search", error);
    state.userResults.hidden = false;
    state.userResults.innerHTML = `<div style="padding:8px;font-size:.8rem;opacity:.75">No se pudo consultar el directorio de usuarios.</div>`;
  }
}
function scheduleDirectorySearch(delay = 180) {
  clearTimeout(state.directorySearchTimer);
  state.directorySearchTimer = setTimeout(() => searchDirectory(state.userSearch?.value || ""), delay);
}
function onDirectoryClick(event) {
  const button = event.target.closest("[data-select-user]");
  if (!button) return;
  const username = normalizeUsername(button.dataset.selectUser);
  if (!username) return;
  const candidates = [...state.directoryCache.values()].flat();
  const row = candidates.find(item => normalizeUsername(item.usernameKey || item.username) === username);
  if (!row || String(row.uid || "") === String(state.auth?.uid || "")) return;
  state.selectedUsers.set(username, {
    username,
    uid: String(row.uid || ""),
    displayName: String(row.displayName || "").slice(0, 80)
  });
  renderSelectedUsers();
  renderDirectoryResults((state.directoryCache.get(normalizeUsername(state.userSearch?.value || "") || "*") || []), normalizeUsername(state.userSearch?.value || ""));
}
function onSelectedClick(event) {
  const button = event.target.closest("[data-remove-user]");
  if (!button) return;
  state.selectedUsers.delete(normalizeUsername(button.dataset.removeUser));
  renderSelectedUsers();
  scheduleDirectorySearch(0);
}
function parseBulk(text) {
  return [...new Set(String(text || "").split(/[\s,;]+/).map(x => x.trim()).filter(Boolean))].slice(0, 200);
}
async function resolveTarget(raw) {
  const value = String(raw || "").trim();
  if (!value) return { ok:false, reason:"vacío" };
  if (validEmail(normalizedEmail(value))) return { ok:true, kind:"email", targetEmail:normalizedEmail(value), key:`email:${normalizedEmail(value)}` };
  const username = normalizeUsername(value);
  if (!validUsername(username)) return { ok:false, reason:`${value}: formato no válido` };
  const { firestore } = await services();
  const snap = await getDoc(doc(firestore, "usernames", username));
  if (!snap.exists()) return { ok:false, reason:`@${username}: usuario no encontrado` };
  const data = snap.data() || {};
  if (!data.uid) return { ok:false, reason:`@${username}: registro incompleto` };
  return { ok:true, kind:"user", targetUid:String(data.uid), targetUsername:username, targetUsernameKey:username, targetDisplayName:String(data.displayName || "").slice(0,80) || null, key:`uid:${data.uid}` };
}
function existingPending(target) {
  return state.rows.some(row => {
    if (String(row.status || "pending") !== "pending") return false;
    if (target.kind === "user") return String(row.targetUid || "") === String(target.targetUid);
    return normalizedEmail(row.targetEmail) === target.targetEmail;
  });
}
async function createOne(target) {
  const { firestore } = await services(); const ref = doc(collection(firestore, "invitations"));
  const payload = {
    schemaVersion: 3,
    eventId: state.event.eventId,
    eventName: String(state.event.eventName || "").slice(0,140),
    createdBy: state.auth.uid,
    role: "runner", status: "pending", createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  };
  if (target.kind === "user") Object.assign(payload, { targetUid:target.targetUid, targetUsername:target.targetUsername, targetUsernameKey:target.targetUsernameKey, targetDisplayName:target.targetDisplayName });
  else payload.targetEmail = target.targetEmail;
  await setDoc(ref, payload);
  return ref.id;
}
async function createTargets(rawTargets, bulkMode, origin = bulkMode ? "bulk" : "single") {
  if (state.busy || !state.event) return;
  const inputs = [...new Set((rawTargets || []).map(v => String(v || "").trim()).filter(Boolean))];
  if (!inputs.length) { paint("Escribe al menos un @usuario o correo."); return; }
  if (!ALLOWED_EVENT_STATES.has(String(state.event.status || ""))) { paint(); return; }
  state.busy = true; paint(`Comprobando ${inputs.length} destinatario${inputs.length === 1 ? "" : "s"}…`);
  try {
    const resolved = [];
    const errors = [];
    for (const value of inputs) {
      try {
        const target = await resolveTarget(value);
        if (!target.ok) errors.push(target.reason); else if (!resolved.some(x => x.key === target.key)) resolved.push(target);
      } catch (_) { errors.push(`${value}: no se pudo comprobar`); }
    }
    const notMembers = [];
    let alreadyJoined = 0;
    const { firestore } = await services();
    for (const target of resolved) {
      if (target.kind === "user") {
        const memberSnap = await getDoc(doc(firestore, "events", state.event.eventId, "members", target.targetUid));
        if (memberSnap.exists()) { alreadyJoined += 1; continue; }
      }
      notMembers.push(target);
    }
    const fresh = notMembers.filter(target => !existingPending(target));
    const skipped = notMembers.length - fresh.length;
    let created = 0;
    for (const target of fresh) { await createOne(target); created += 1; }
    if (origin === "single" && created) state.target.value = "";
    if (origin === "bulk" && created) state.bulk.value = "";
    if (origin === "selected") { state.selectedUsers.clear(); renderSelectedUsers(); }
    await loadInvitations();
    const pieces = [`✅ ${created} invitación${created === 1 ? "" : "es"} creada${created === 1 ? "" : "s"}`];
    if (alreadyJoined) pieces.push(`ℹ️ ${alreadyJoined} ya estaba${alreadyJoined === 1 ? "" : "n"} unido${alreadyJoined === 1 ? "" : "s"} al evento`);
    if (skipped) pieces.push(`ℹ️ ${skipped} ya tenía${skipped === 1 ? "" : "n"} invitación pendiente`);
    if (errors.length) {
      pieces.push(`⚠️ ${errors.length} entrada${errors.length === 1 ? "" : "s"} no válida${errors.length === 1 ? "" : "s"}`);
      errors.slice(0,5).forEach(item => pieces.push(`   • ${item}`));
      if (errors.length > 5) pieces.push(`   • …y ${errors.length - 5} más`);
    }
    paint(pieces.join("\n"));
  } catch (error) { console.error("[MILITOPO E2] create", error); paint(`No se pudieron crear las invitaciones: ${String(error?.message || error)}`); }
  finally { state.busy = false; paint(state.status.textContent); }
}
async function revokeInvitation(id) {
  if (!id || state.busy) return; if (!confirm("¿Revocar esta invitación? El participante ya no podrá utilizar este enlace.")) return;
  state.busy = true; paint("Revocando invitación…");
  try { const { firestore } = await services(); await updateDoc(doc(firestore, "invitations", id), { status:"revoked", revokedAt:serverTimestamp(), updatedAt:serverTimestamp() }); await loadInvitations(); paint("✅ Invitación revocada."); }
  catch (error) { console.error("[MILITOPO E2] revoke", error); paint(`No se pudo revocar: ${String(error?.message || error)}`); }
  finally { state.busy = false; paint(state.status.textContent); }
}
function rowById(id) { return state.rows.find(row => String(row.id) === String(id)) || null; }
async function copyLink(id) {
  const url = invitationUrl(id); try { await navigator.clipboard.writeText(url); if (typeof globalThis.toast === "function") globalThis.toast("Enlace de invitación copiado"); else paint("✅ Enlace copiado."); } catch (_) { prompt("Copia este enlace de invitación:", url); }
}
function shareWhatsApp(id) { const row = rowById(id); if (!row) return; window.open(`https://wa.me/?text=${encodeURIComponent(shareMessage(row))}`, "_blank", "noopener,noreferrer"); }
function shareEmail(id) { const row = rowById(id); if (!row?.targetEmail) return; const subject = `Invitación MILITOPO · ${row.eventName || "Carrera"}`; window.location.href = `mailto:${encodeURIComponent(row.targetEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(shareMessage(row))}`; }
async function shareNative(id) {
  const row = rowById(id); if (!row) return; const url = invitationUrl(id), text = shareMessage(row);
  if (navigator.share) { try { await navigator.share({ title:`Invitación MILITOPO · ${row.eventName || "Carrera"}`, text, url }); return; } catch (error) { if (error?.name === "AbortError") return; } }
  await copyLink(id);
}
function onListClick(event) {
  const whatsapp = event.target.closest("[data-whatsapp]"); if (whatsapp) return shareWhatsApp(whatsapp.dataset.whatsapp);
  const share = event.target.closest("[data-share]"); if (share) return shareNative(share.dataset.share);
  const copy = event.target.closest("[data-copy-link]"); if (copy) return copyLink(copy.dataset.copyLink);
  const email = event.target.closest("[data-email]"); if (email) return shareEmail(email.dataset.email);
  const revoke = event.target.closest("[data-revoke]"); if (revoke) revokeInvitation(revoke.dataset.revoke);
}
function scheduleLoad(delay = 250, force = false) {
  clearTimeout(scheduleLoad.timer); scheduleLoad.force = Boolean(scheduleLoad.force || force);
  scheduleLoad.timer = setTimeout(() => { const mustForce = Boolean(scheduleLoad.force); scheduleLoad.force = false; loadEvent({ force:mustForce }); }, delay);
}
function init() {
  ensurePanel();
  globalThis.addEventListener("militopo:v2-auth-ready", event => { state.auth = event?.detail || globalThis.MILITOPO_V2_AUTH || null; state.loadedEventId = ""; state.directoryCache.clear(); state.selectedUsers.clear(); renderSelectedUsers(); scheduleLoad(150, true); });
  globalThis.addEventListener("militopo:v2-orientation-header", () => scheduleLoad(250, false));
  globalThis.addEventListener("militopo:v2-cloud-event-applied", event => { if (event?.detail?.ok) scheduleLoad(180, true); });
  globalThis.addEventListener("militopo:v2-event-status-changed", () => scheduleLoad(180, true));
  globalThis.addEventListener("online", () => scheduleLoad(100, true));
  globalThis.addEventListener("offline", () => paint("📴 Sin conexión: no se pueden crear invitaciones ahora."));
  if (globalThis.MILITOPO_V2_AUTH) scheduleLoad(120, true);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true }); else init();
