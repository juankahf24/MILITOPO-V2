/* MILITOPO V2 · Fase E3 + H4.2 · censo y asignación visible de recorridos. */
import "../bootstrap.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const MANAGER_ROLES = new Set(["organizer", "super_admin"]);
const EDITABLE_MEMBERSHIP_STATES = new Set(["prepared", "published"]);
const state = {
  auth: globalThis.MILITOPO_V2_AUTH || null,
  services: null,
  event: null,
  members: [],
  invitations: [],
  directoryByUid: new Map(),
  filter: "all",
  search: "",
  selected: new Set(),
  busy: false,
  loading: false,
  loadedEventId: "",
  root: null,
  list: null,
  status: null,
  searchInput: null,
  searchSuggest: null,
  tabs: null,
  bulkBar: null,
  realtimeMembersUnsub: null,
  realtimeInvitesUnsub: null,
  realtimeEventId: "",
  realtimeSeq: 0,
  lastRealtimeMemberSignature: ""
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
function normalize(value) {
  return String(value || "").trim().toLowerCase();
}
async function services() {
  if (state.services) return state.services;
  state.services = await globalThis.MILITOPO_V2.firebase();
  return state.services;
}
function membershipsEditable() {
  return EDITABLE_MEMBERSHIP_STATES.has(String(state.event?.status || ""));
}
function injectStyle() {
  if (document.getElementById("m2ParticipantsAdminStyle")) return;
  const style = document.createElement("style");
  style.id = "m2ParticipantsAdminStyle";
  style.textContent = `
    .m2-roster{margin:14px 0;padding:14px;border:1px solid rgba(255,255,255,.16);border-radius:14px;background:rgba(255,255,255,.035)}
    .m2-roster-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .m2-roster-title{font-weight:950;letter-spacing:.045em}.m2-roster-state{font-size:.75rem;font-weight:900;border:1px solid rgba(245,204,121,.32);border-radius:999px;padding:5px 9px}
    .m2-roster-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:11px 0}.m2-roster-stat{padding:9px;border:1px solid rgba(255,255,255,.11);border-radius:10px;background:rgba(0,0,0,.12);text-align:center}.m2-roster-stat strong{display:block;font-size:1.08rem}.m2-roster-stat span{font-size:.7rem;opacity:.7;font-weight:850}
    .m2-roster-toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:start;margin:10px 0}.m2-roster-search-wrap{position:relative;min-width:0}.m2-roster-search{width:100%;min-height:44px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:#0d140b;color:#fff;padding:10px 12px;font:inherit;font-size:16px;box-sizing:border-box}.m2-roster-suggest{position:absolute;left:0;right:0;top:calc(100% + 5px);z-index:40;border:1px solid rgba(245,204,121,.3);border-radius:12px;background:#0b1209;box-shadow:0 14px 30px rgba(0,0,0,.35);overflow:hidden;max-height:290px;overflow-y:auto}.m2-roster-suggest[hidden]{display:none!important}.m2-roster-suggest-btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left;border:0;border-bottom:1px solid rgba(255,255,255,.08);background:transparent;color:inherit;padding:10px 12px;font:inherit;cursor:pointer}.m2-roster-suggest-btn:last-child{border-bottom:0}.m2-roster-suggest-btn:active,.m2-roster-suggest-btn:focus-visible{background:rgba(245,204,121,.12);outline:none}.m2-roster-suggest-main{min-width:0}.m2-roster-suggest-name{font-weight:950;overflow-wrap:anywhere}.m2-roster-suggest-meta{font-size:.72rem;opacity:.68;overflow-wrap:anywhere}.m2-roster-suggest-state{flex:0 0 auto;border:1px solid rgba(245,204,121,.28);border-radius:999px;padding:4px 7px;font-size:.62rem;font-weight:950}.m2-roster-suggest-empty{padding:10px 12px;font-size:.78rem;opacity:.7}
    .m2-roster-refresh,.m2-roster-action{min-height:44px;border-radius:10px;border:1px solid rgba(245,204,121,.35);background:rgba(245,204,121,.14);color:inherit;padding:9px 12px;font:inherit;font-weight:900;cursor:pointer}.m2-roster-refresh:disabled,.m2-roster-action:disabled{opacity:.45;cursor:not-allowed}
    .m2-roster-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin:8px 0}.m2-roster-tab{min-width:0;min-height:38px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);color:inherit;padding:7px 4px;font:inherit;font-size:.7rem;font-weight:900;cursor:pointer;white-space:nowrap}.m2-roster-tab.is-active{border-color:rgba(245,204,121,.48);background:rgba(245,204,121,.13)}
    .m2-roster-status{min-height:22px;margin:8px 0;font-size:.8rem;line-height:1.45;opacity:.82;white-space:pre-line}.m2-roster-status.is-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;opacity:1;white-space:normal}.m2-roster-status-chip{display:flex;align-items:center;justify-content:center;gap:5px;min-width:0;border:1px solid rgba(245,204,121,.34);border-radius:999px;background:rgba(245,204,121,.11);padding:7px 6px;font-size:.68rem;font-weight:900;white-space:nowrap}.m2-roster-status-chip strong{font-size:.92rem;color:#f5cc79}.m2-roster-list{display:grid;gap:8px;min-height:30px}
    .m2-roster-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px;border:1px solid rgba(255,255,255,.12);border-radius:11px;background:rgba(0,0,0,.12)}.m2-roster-row.is-removed{opacity:.68}.m2-roster-row.is-pending{border-color:rgba(245,204,121,.22)}
    .m2-roster-check{width:20px;height:20px;accent-color:#e4b754}.m2-roster-name{font-weight:950;overflow-wrap:anywhere}.m2-roster-handle{font-size:.77rem;opacity:.72;overflow-wrap:anywhere}.m2-roster-meta{font-size:.74rem;opacity:.62;margin-top:2px;overflow-wrap:anywhere}.m2-roster-badge{display:inline-flex;margin-top:5px;border-radius:999px;padding:4px 7px;font-size:.68rem;font-weight:950;border:1px solid rgba(255,255,255,.14)}
    .m2-roster-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.m2-roster-actions button{min-height:38px;border-radius:9px;border:1px solid rgba(245,204,121,.3);background:rgba(245,204,121,.1);color:inherit;padding:7px 9px;font:inherit;font-size:.74rem;font-weight:900;cursor:pointer}.m2-roster-actions button:disabled{opacity:.45;cursor:not-allowed}
    .m2-roster-bulk{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.1)}.m2-roster-bulk[hidden]{display:none!important}.m2-roster-bulk-count{font-size:.78rem;font-weight:900;margin-right:auto}
    @media(max-width:680px){.m2-roster-summary{grid-template-columns:repeat(3,1fr)}.m2-roster-toolbar{grid-template-columns:1fr}.m2-roster-refresh{width:100%}.m2-roster-tab{font-size:.64rem;padding:7px 2px}.m2-roster-status-chip{font-size:.61rem;padding:7px 3px;gap:3px}.m2-roster-status-chip strong{font-size:.82rem}.m2-roster-row{grid-template-columns:auto minmax(0,1fr)}.m2-roster-actions{grid-column:1/-1;justify-content:stretch}.m2-roster-actions button{flex:1 1 42%}.m2-roster-bulk .m2-roster-action{flex:1 1 100%}}
  `;
  document.head.appendChild(style);
}
function ensureUi() {
  if (state.root?.isConnected) return true;
  const step = document.getElementById("step1");
  if (!step) return false;
  injectStyle();
  const root = document.createElement("section");
  root.id = "m2ParticipantsAdmin";
  root.className = "m2-roster";
  root.innerHTML = `
    <div class="m2-roster-head">
      <div class="m2-roster-title">👥 CENSO DEL EVENTO</div>
      <div id="m2RosterState" class="m2-roster-state">SIN EVENTO</div>
    </div>
    <div class="m2-roster-summary">
      <div class="m2-roster-stat"><strong id="m2RosterActive">0</strong><span>UNIDOS</span></div>
      <div class="m2-roster-stat"><strong id="m2RosterPending">0</strong><span>PENDIENTES</span></div>
      <div class="m2-roster-stat"><strong id="m2RosterRemoved">0</strong><span>RETIRADOS</span></div>
    </div>
    <div class="m2-roster-toolbar">
      <div class="m2-roster-search-wrap">
        <input id="m2RosterSearch" class="m2-roster-search" type="search" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Buscar por nombre, @usuario o correo" aria-autocomplete="list" aria-controls="m2RosterSuggest">
        <div id="m2RosterSuggest" class="m2-roster-suggest" role="listbox" hidden></div>
      </div>
      <button id="m2RosterRefresh" class="m2-roster-refresh" type="button">ACTUALIZAR</button>
    </div>
    <div id="m2RosterTabs" class="m2-roster-tabs" role="tablist" aria-label="Filtrar participantes">
      <button class="m2-roster-tab is-active" type="button" data-roster-filter="all">TODOS</button>
      <button class="m2-roster-tab" type="button" data-roster-filter="active">UNIDOS</button>
      <button class="m2-roster-tab" type="button" data-roster-filter="pending">PENDIENTES</button>
      <button class="m2-roster-tab" type="button" data-roster-filter="removed">RETIRADOS</button>
    </div>
    <div id="m2RosterStatus" class="m2-roster-status">Carga un evento para ver su censo.</div>
    <div id="m2RosterList" class="m2-roster-list"></div>
    <div id="m2RosterBulk" class="m2-roster-bulk" hidden>
      <span id="m2RosterBulkCount" class="m2-roster-bulk-count">0 seleccionados</span>
      <button id="m2RosterBulkRemove" class="m2-roster-action" type="button" disabled>QUITAR SELECCIONADOS</button>
      <button id="m2RosterBulkRestore" class="m2-roster-action" type="button" disabled>RESTAURAR SELECCIONADOS</button>
      <button id="m2RosterBulkRevoke" class="m2-roster-action" type="button" disabled>REVOCAR PENDIENTES</button>
    </div>`;
  const invites = document.getElementById("m2Invitations");
  if (invites) invites.insertAdjacentElement("afterend", root);
  else {
    const nav = step.querySelector(".nav-row");
    if (nav) nav.insertAdjacentElement("beforebegin", root); else step.appendChild(root);
  }
  state.root = root;
  state.list = root.querySelector("#m2RosterList");
  state.status = root.querySelector("#m2RosterStatus");
  state.searchInput = root.querySelector("#m2RosterSearch");
  state.searchSuggest = root.querySelector("#m2RosterSuggest");
  state.tabs = root.querySelector("#m2RosterTabs");
  state.bulkBar = root.querySelector("#m2RosterBulk");
  root.querySelector("#m2RosterRefresh")?.addEventListener("click", () => loadAll({ force:true }));
  state.searchInput?.addEventListener("input", () => { state.search = state.searchInput.value || ""; render(); renderSearchSuggest(); });
  state.searchInput?.addEventListener("focus", () => renderSearchSuggest());
  state.searchInput?.addEventListener("keydown", event => { if (event.key === "Escape") hideSearchSuggest(); });
  state.searchSuggest?.addEventListener("click", onSearchSuggestClick);
  document.addEventListener("pointerdown", event => { if (state.root?.isConnected && !state.root.querySelector(".m2-roster-search-wrap")?.contains(event.target)) hideSearchSuggest(); }, { passive:true });
  state.tabs?.addEventListener("click", event => {
    const button = event.target.closest("[data-roster-filter]");
    if (!button) return;
    state.filter = String(button.dataset.rosterFilter || "all");
    state.tabs.querySelectorAll("[data-roster-filter]").forEach(el => el.classList.toggle("is-active", el === button));
    state.selected.clear();
    render();
    renderSearchSuggest();
  });
  state.list?.addEventListener("click", onListClick);
  state.list?.addEventListener("change", onListChange);
  root.querySelector("#m2RosterBulkRemove")?.addEventListener("click", () => runBulk("remove"));
  root.querySelector("#m2RosterBulkRestore")?.addEventListener("click", () => runBulk("restore"));
  root.querySelector("#m2RosterBulkRevoke")?.addEventListener("click", () => runBulk("revoke"));
  return true;
}
function setStatus(text) {
  if (!state.status) return;
  state.status.classList.remove("is-summary");
  state.status.textContent = text || "";
}
function setSummaryStatus(active, pending, removed) {
  if (!state.status) return;
  state.status.classList.add("is-summary");
  state.status.innerHTML = `
    <span class="m2-roster-status-chip"><strong>${active}</strong> UNIDO${active === 1 ? "" : "S"}</span>
    <span class="m2-roster-status-chip"><strong>${pending}</strong> PENDIENTE${pending === 1 ? "" : "S"}</span>
    <span class="m2-roster-status-chip"><strong>${removed}</strong> RETIRADO${removed === 1 ? "" : "S"}</span>`;
}
function hideSearchSuggest() {
  if (state.searchSuggest) state.searchSuggest.hidden = true;
}
function searchSuggestionRows() {
  const needle = normalize(state.search).replace(/^@+/, "");
  let rows = allRows().filter(row => state.filter === "all" || row.type === state.filter);
  if (needle) {
    rows = rows.filter(row => [row.displayName, row.username, row.email, row.uid].some(value => normalize(value).includes(needle)));
  }
  return rows.slice(0, 8);
}
function renderSearchSuggest() {
  if (!state.searchSuggest || document.activeElement !== state.searchInput) return;
  const rows = searchSuggestionRows();
  state.searchSuggest.hidden = false;
  if (!rows.length) {
    state.searchSuggest.innerHTML = `<div class="m2-roster-suggest-empty">No hay participantes que coincidan.</div>`;
    return;
  }
  state.searchSuggest.innerHTML = rows.map(row => {
    const handle = row.username ? `@${row.username}` : "";
    const meta = [handle, row.email].filter(Boolean).join(" · ");
    return `<button class="m2-roster-suggest-btn" type="button" role="option" data-roster-suggest="${esc(row.key)}">
      <span class="m2-roster-suggest-main"><span class="m2-roster-suggest-name">${esc(row.displayName)}</span>${meta ? `<br><span class="m2-roster-suggest-meta">${esc(meta)}</span>` : ""}</span>
      <span class="m2-roster-suggest-state">${actionLabel(row.type)}</span>
    </button>`;
  }).join("");
}
function onSearchSuggestClick(event) {
  const button = event.target.closest("[data-roster-suggest]");
  if (!button || !state.searchInput) return;
  const row = allRows().find(item => item.key === String(button.dataset.rosterSuggest || ""));
  if (!row) return;
  const value = row.username ? `@${row.username}` : (row.email || row.displayName);
  state.searchInput.value = value;
  state.search = value;
  hideSearchSuggest();
  render();
  state.searchInput.blur();
}
function directoryForUid(uid) {
  return state.directoryByUid.get(String(uid || "")) || null;
}
function invitationForMember(member) {
  const invitationId = String(member.invitationId || "");
  if (invitationId) {
    const direct = state.invitations.find(row => row.id === invitationId);
    if (direct) return direct;
  }
  return state.invitations.find(row => String(row.targetUid || "") === String(member.uid || "")) || null;
}
function memberView(member) {
  const directory = directoryForUid(member.uid);
  const invite = invitationForMember(member);
  const username = normalize(member.username || directory?.usernameKey || directory?.username || invite?.targetUsername).replace(/^@+/, "");
  const displayName = String(member.displayName || directory?.displayName || invite?.targetDisplayName || "").trim();
  const email = String(member.email || invite?.targetEmail || "").trim();
  return {
    key: `member:${member.uid}`,
    type: String(member.status || "active") === "removed" ? "removed" : "active",
    uid: String(member.uid || ""),
    invitationId: String(member.invitationId || invite?.id || ""),
    displayName: displayName || (username ? `@${username}` : email || "Participante"),
    username,
    email,
    date: member.joinedAt || null,
    member
  };
}
function pendingView(invite) {
  const username = normalize(invite.targetUsername || "").replace(/^@+/, "");
  const email = String(invite.targetEmail || "").trim();
  return {
    key: `invite:${invite.id}`,
    type: "pending",
    inviteId: invite.id,
    displayName: String(invite.targetDisplayName || "").trim() || (username ? `@${username}` : email || "Invitación"),
    username,
    email,
    date: invite.createdAt || null,
    invite
  };
}
function allRows() {
  const members = state.members.map(memberView);
  const pending = state.invitations.filter(row => String(row.status || "pending") === "pending").map(pendingView);
  return [...members, ...pending];
}
function filteredRows() {
  const needle = normalize(state.search).replace(/^@+/, "");
  return allRows().filter(row => {
    if (state.filter !== "all" && row.type !== state.filter) return false;
    if (!needle) return true;
    return [row.displayName, row.username, row.email, row.uid].some(value => normalize(value).includes(needle));
  }).sort((a,b) => {
    const order = { active:0, pending:1, removed:2 };
    const diff = (order[a.type] ?? 9) - (order[b.type] ?? 9);
    if (diff) return diff;
    const am = a.date?.toMillis?.() || 0, bm = b.date?.toMillis?.() || 0;
    return bm - am;
  });
}
function actionLabel(type) {
  if (type === "pending") return "PENDIENTE";
  if (type === "removed") return "RETIRADO";
  return "UNIDO";
}
function render() {
  if (!ensureUi()) return;
  const eventState = String(state.event?.status || "").toUpperCase();
  const chip = state.root.querySelector("#m2RosterState");
  if (chip) chip.textContent = state.event ? eventState || "BORRADOR" : (currentEventId() ? "COMPROBANDO" : "SIN EVENTO");
  const active = state.members.filter(row => String(row.status || "active") === "active").length;
  const removed = state.members.filter(row => String(row.status || "active") === "removed").length;
  const pending = state.invitations.filter(row => String(row.status || "pending") === "pending").length;
  state.root.querySelector("#m2RosterActive").textContent = String(active);
  state.root.querySelector("#m2RosterPending").textContent = String(pending);
  state.root.querySelector("#m2RosterRemoved").textContent = String(removed);

  if (!canManage()) {
    setStatus("Esta zona requiere una cuenta organizer o super_admin verificada.");
    state.list.innerHTML = "";
    renderBulk();
    return;
  }
  if (!state.event) {
    setStatus("Carga un evento para ver su censo.");
    state.list.innerHTML = "";
    renderBulk();
    return;
  }
  const editable = membershipsEditable();
  if (!editable) setStatus(`El censo se conserva, pero los cambios de participantes están bloqueados en ${eventState}.`);
  else if (!state.loading && !state.busy) setSummaryStatus(active, pending, removed);

  const rows = filteredRows();
  if (!rows.length) {
    state.list.innerHTML = `<div style="font-size:.82rem;opacity:.68;padding:4px 1px">No hay participantes que coincidan con este filtro.</div>`;
    renderBulk();
    return;
  }
  state.list.innerHTML = rows.map(row => {
    const checked = state.selected.has(row.key);
    const handle = row.username ? `@${row.username}` : "";
    const secondary = [handle, row.email].filter(Boolean).join(" · ");
    const dateLabel = row.type === "pending" ? `Invitada: ${formatDate(row.date)}` : `Unido: ${formatDate(row.date)}`;
    const routeMeta = row.type !== "pending" && row.member?.participantId && row.member?.routeId
      ? `${row.member.participantId} · ${row.member.routeId}${Number.isFinite(Number(row.member.routeDistanceKm)) ? ` · ${Number(row.member.routeDistanceKm).toFixed(2)} km` : ""}${row.member.routeControlCount != null ? ` · ${Number(row.member.routeControlCount)} balizas` : ""}`
      : "";
    const disabled = state.busy || !editable || !navigator.onLine;
    const action = row.type === "active"
      ? `<button type="button" data-remove-member="${esc(row.uid)}" ${disabled ? "disabled" : ""}>QUITAR</button>`
      : row.type === "removed"
        ? `<button type="button" data-restore-member="${esc(row.uid)}" ${disabled ? "disabled" : ""}>RESTAURAR</button>`
        : `<button type="button" data-revoke-invite="${esc(row.inviteId)}" ${disabled ? "disabled" : ""}>REVOCAR</button>`;
    return `<article class="m2-roster-row is-${esc(row.type)}">
      <input class="m2-roster-check" type="checkbox" data-roster-select="${esc(row.key)}" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} aria-label="Seleccionar ${esc(row.displayName)}">
      <div><div class="m2-roster-name">${esc(row.displayName)}</div>${secondary ? `<div class="m2-roster-handle">${esc(secondary)}</div>` : ""}<div class="m2-roster-meta">${esc(dateLabel)}</div>${routeMeta ? `<div class="m2-roster-meta" style="color:#f0c16a;font-weight:900;opacity:.95">🧭 ${esc(routeMeta)}</div>` : ""}<span class="m2-roster-badge">${actionLabel(row.type)}</span></div>
      <div class="m2-roster-actions">${action}</div>
    </article>`;
  }).join("");
  renderBulk();
}
function renderBulk() {
  if (!state.bulkBar) return;
  const selectedRows = allRows().filter(row => state.selected.has(row.key));
  const active = selectedRows.filter(row => row.type === "active").length;
  const removed = selectedRows.filter(row => row.type === "removed").length;
  const pending = selectedRows.filter(row => row.type === "pending").length;
  state.bulkBar.hidden = selectedRows.length === 0;
  state.root.querySelector("#m2RosterBulkCount").textContent = `${selectedRows.length} seleccionado${selectedRows.length === 1 ? "" : "s"}`;
  const disabled = state.busy || !membershipsEditable() || !navigator.onLine;
  const remove = state.root.querySelector("#m2RosterBulkRemove");
  const restore = state.root.querySelector("#m2RosterBulkRestore");
  const revoke = state.root.querySelector("#m2RosterBulkRevoke");
  remove.disabled = disabled || active === 0; remove.textContent = active ? `QUITAR (${active})` : "QUITAR SELECCIONADOS";
  restore.disabled = disabled || removed === 0; restore.textContent = removed ? `RESTAURAR (${removed})` : "RESTAURAR SELECCIONADOS";
  revoke.disabled = disabled || pending === 0; revoke.textContent = pending ? `REVOCAR (${pending})` : "REVOCAR PENDIENTES";
}
async function resolveDirectory(uids) {
  state.directoryByUid.clear();
  const clean = [...new Set(uids.map(String).filter(Boolean))];
  if (!clean.length) return;
  const { firestore } = await services();
  for (let i = 0; i < clean.length; i += 30) {
    const chunk = clean.slice(i, i + 30);
    try {
      const snap = await getDocs(query(collection(firestore, "usernames"), where("uid", "in", chunk)));
      snap.forEach(d => {
        const data = d.data() || {};
        if (data.uid) state.directoryByUid.set(String(data.uid), { id:d.id, ...data });
      });
    } catch (error) {
      console.warn("[MILITOPO E3] username directory chunk", error);
    }
  }
}

function stopRealtimeRoster() {
  try { state.realtimeMembersUnsub?.(); } catch (_) {}
  try { state.realtimeInvitesUnsub?.(); } catch (_) {}
  state.realtimeMembersUnsub = null;
  state.realtimeInvitesUnsub = null;
  state.realtimeEventId = "";
  state.lastRealtimeMemberSignature = "";
  state.realtimeSeq += 1;
}
function refreshRosterUi() {
  state.selected.forEach(key => {
    const exists = allRows().some(row => row.key === key);
    if (!exists) state.selected.delete(key);
  });
  render();
  renderSearchSuggest();
}
async function startRealtimeRoster(eventId) {
  if (!eventId || !canManage()) return;
  if (state.realtimeEventId === eventId && state.realtimeMembersUnsub && state.realtimeInvitesUnsub) return;
  stopRealtimeRoster();
  state.realtimeEventId = eventId;
  const seq = state.realtimeSeq;
  try {
    const { firestore } = await services();
    const membersRef = collection(firestore, "events", eventId, "members");
    state.realtimeMembersUnsub = onSnapshot(membersRef, async snap => {
      if (seq !== state.realtimeSeq) return;
      const members = [];
      snap.forEach(d => members.push({ id:d.id, ...(d.data() || {}), uid:String((d.data() || {}).uid || d.id) }));
      await resolveDirectory(members.map(row => row.uid));
      if (seq !== state.realtimeSeq) return;
      const signature = members.map(row => `${row.uid}:${String(row.status || "active")}`).sort().join("|");
      const changed = signature !== state.lastRealtimeMemberSignature;
      state.lastRealtimeMemberSignature = signature;
      state.members = members;
      refreshRosterUi();
      if (changed) {
        try { globalThis.dispatchEvent(new CustomEvent("militopo:v2-roster-changed", { detail: { eventId, members: members.length } })); } catch (_) {}
      }
    }, error => console.warn("[MILITOPO roster realtime members]", error));

    const inviteQuery = roleOf() === "super_admin"
      ? query(collection(firestore, "invitations"), where("eventId", "==", eventId))
      : query(collection(firestore, "invitations"), where("createdBy", "==", state.auth.uid));
    state.realtimeInvitesUnsub = onSnapshot(inviteQuery, snap => {
      if (seq !== state.realtimeSeq) return;
      const invitations = [];
      snap.forEach(d => {
        const data = d.data() || {};
        if (String(data.eventId || "") === eventId) invitations.push({ id:d.id, ...data });
      });
      state.invitations = invitations;
      refreshRosterUi();
    }, error => console.warn("[MILITOPO roster realtime invitations]", error));
  } catch (error) {
    console.warn("[MILITOPO roster realtime] start", error);
  }
}

async function loadAll({ force = false } = {}) {
  ensureUi();
  const eventId = currentEventId();
  if (!canManage() || !eventId || !navigator.onLine) { render(); return false; }
  if (!force && state.loadedEventId === eventId && state.event) { render(); await startRealtimeRoster(eventId); return true; }
  if (state.loading) return false;
  state.loading = true;
  setStatus("Actualizando censo…");
  try {
    const { firestore } = await services();
    const eventSnap = await getDoc(doc(firestore, "events", eventId));
    if (!eventSnap.exists()) {
      state.event = null; state.members = []; state.invitations = []; state.loadedEventId = ""; render();
      setStatus("El evento todavía no existe en Firestore."); return false;
    }
    const eventData = eventSnap.data() || {};
    if (roleOf() !== "super_admin" && String(eventData.ownerUid || "") !== String(state.auth.uid || "")) {
      state.event = null; state.members = []; state.invitations = []; state.loadedEventId = ""; render();
      setStatus("Este evento no pertenece a esta cuenta."); return false;
    }
    state.event = { eventId:eventSnap.id, ...eventData };

    const membersSnap = await getDocs(collection(firestore, "events", eventId, "members"));
    const members = [];
    membersSnap.forEach(d => members.push({ id:d.id, ...(d.data() || {}), uid:String((d.data() || {}).uid || d.id) }));

    let invitesSnap;
    if (roleOf() === "super_admin") invitesSnap = await getDocs(query(collection(firestore, "invitations"), where("eventId", "==", eventId)));
    else invitesSnap = await getDocs(query(collection(firestore, "invitations"), where("createdBy", "==", state.auth.uid)));
    const invitations = [];
    invitesSnap.forEach(d => {
      const data = d.data() || {};
      if (String(data.eventId || "") === eventId) invitations.push({ id:d.id, ...data });
    });
    await resolveDirectory(members.map(row => row.uid));
    state.members = members;
    state.invitations = invitations;
    state.loadedEventId = eventId;
    state.selected.clear();
    render();
    renderSearchSuggest();
    await startRealtimeRoster(eventId);
    return true;
  } catch (error) {
    console.error("[MILITOPO E3] load roster", error);
    setStatus("No se pudo actualizar el censo. El evento local no se ha modificado.");
    return false;
  } finally {
    state.loading = false;
    render();
  }
}
function onListChange(event) {
  const input = event.target.closest("[data-roster-select]");
  if (!input) return;
  const key = String(input.dataset.rosterSelect || "");
  if (!key) return;
  if (input.checked) {
    if (state.selected.size >= 100) {
      input.checked = false;
      setStatus("Puedes gestionar hasta 100 participantes por acción masiva.");
      return;
    }
    state.selected.add(key);
  } else state.selected.delete(key);
  renderBulk();
}
function rowByUid(uid) {
  return state.members.find(row => String(row.uid || row.id) === String(uid)) || null;
}
function inviteById(id) {
  return state.invitations.find(row => String(row.id) === String(id)) || null;
}
async function applyMemberAction(kind, members) {
  if (!members.length || state.busy || !state.event || !membershipsEditable()) return;
  const label = kind === "remove" ? "quitar" : "restaurar";
  if (!confirm(`¿${label === "quitar" ? "Quitar" : "Restaurar"} ${members.length === 1 ? "este participante" : `${members.length} participantes`}?`)) return;
  state.busy = true; render();
  setStatus(kind === "remove" ? "Quitando participantes…" : "Restaurando participantes…");
  try {
    const { firestore } = await services();
    const batch = writeBatch(firestore);
    const now = serverTimestamp();
    for (const member of members) {
      const uid = String(member.uid || member.id || "");
      if (!uid) continue;
      const memberRef = doc(firestore, "events", state.event.eventId, "members", uid);
      if (kind === "remove") batch.update(memberRef, { status:"removed", removedAt:now, removedBy:state.auth.uid, updatedAt:now });
      else batch.update(memberRef, { status:"active", restoredAt:now, restoredBy:state.auth.uid, updatedAt:now });
      const invitationId = String(member.invitationId || "");
      if (invitationId) {
        const inviteRef = doc(firestore, "invitations", invitationId);
        if (kind === "remove") batch.update(inviteRef, { status:"removed", removedAt:now, removedBy:state.auth.uid, updatedAt:now });
        else batch.update(inviteRef, { status:"accepted", restoredAt:now, restoredBy:state.auth.uid, updatedAt:now });
      }
    }
    await batch.commit();
    state.selected.clear();
    await loadAll({ force:true });
    globalThis.dispatchEvent(new CustomEvent("militopo:v2-invitation-refresh"));
    setStatus(kind === "remove" ? "✅ Participante(s) retirado(s) del evento." : "✅ Participante(s) restaurado(s) en el evento.");
  } catch (error) {
    console.error("[MILITOPO E3] member action", error);
    setStatus(`No se pudo completar la operación: ${String(error?.message || error)}`);
  } finally {
    state.busy = false; render();
  }
}
async function revokeInvitations(invites) {
  if (!invites.length || state.busy || !state.event || !membershipsEditable()) return;
  if (!confirm(`¿Revocar ${invites.length === 1 ? "esta invitación" : `${invites.length} invitaciones pendientes`}?`)) return;
  state.busy = true; render(); setStatus("Revocando invitaciones…");
  try {
    const { firestore } = await services();
    const batch = writeBatch(firestore); const now = serverTimestamp();
    invites.forEach(invite => batch.update(doc(firestore, "invitations", invite.id), { status:"revoked", revokedAt:now, updatedAt:now }));
    await batch.commit();
    state.selected.clear();
    await loadAll({ force:true });
    globalThis.dispatchEvent(new CustomEvent("militopo:v2-invitation-refresh"));
    setStatus("✅ Invitación(es) revocada(s).");
  } catch (error) {
    console.error("[MILITOPO E3] revoke pending", error);
    setStatus(`No se pudieron revocar: ${String(error?.message || error)}`);
  } finally { state.busy = false; render(); }
}
function onListClick(event) {
  const remove = event.target.closest("[data-remove-member]");
  if (remove) {
    const member = rowByUid(remove.dataset.removeMember);
    if (member) applyMemberAction("remove", [member]);
    return;
  }
  const restore = event.target.closest("[data-restore-member]");
  if (restore) {
    const member = rowByUid(restore.dataset.restoreMember);
    if (member) applyMemberAction("restore", [member]);
    return;
  }
  const revoke = event.target.closest("[data-revoke-invite]");
  if (revoke) {
    const invite = inviteById(revoke.dataset.revokeInvite);
    if (invite) revokeInvitations([invite]);
  }
}
function runBulk(kind) {
  const rows = allRows().filter(row => state.selected.has(row.key));
  if (kind === "remove") return applyMemberAction("remove", rows.filter(row => row.type === "active").map(row => row.member));
  if (kind === "restore") return applyMemberAction("restore", rows.filter(row => row.type === "removed").map(row => row.member));
  if (kind === "revoke") return revokeInvitations(rows.filter(row => row.type === "pending").map(row => row.invite));
}
function scheduleLoad(delay = 200, force = false) {
  clearTimeout(scheduleLoad.timer);
  scheduleLoad.force = Boolean(scheduleLoad.force || force);
  scheduleLoad.timer = setTimeout(() => {
    const mustForce = Boolean(scheduleLoad.force); scheduleLoad.force = false;
    loadAll({ force:mustForce });
  }, delay);
}
function init() {
  ensureUi();
  globalThis.addEventListener("militopo:v2-auth-ready", event => {
    state.auth = event?.detail || globalThis.MILITOPO_V2_AUTH || null;
    stopRealtimeRoster();
    state.loadedEventId = ""; state.selected.clear(); scheduleLoad(120, true);
  });
  globalThis.addEventListener("militopo:v2-orientation-header", () => {
    const eventId = currentEventId();
    if (eventId && eventId !== state.loadedEventId) { stopRealtimeRoster(); scheduleLoad(220, true); }
  });
  globalThis.addEventListener("militopo:v2-cloud-event-applied", event => { if (event?.detail?.ok) scheduleLoad(160, true); });
  globalThis.addEventListener("militopo:v2-event-status-changed", () => scheduleLoad(160, true));
  globalThis.addEventListener("militopo:v2-invitation-accepted", () => scheduleLoad(120, true));
  globalThis.addEventListener("militopo:v2-roster-refresh", () => scheduleLoad(120, true));
  globalThis.addEventListener("militopo:v2-invitation-refresh", () => scheduleLoad(160, true));
  globalThis.addEventListener("online", () => scheduleLoad(100, true));
  globalThis.addEventListener("offline", () => setStatus("📴 Sin conexión: el censo queda visible, pero no se pueden aplicar cambios."));
  globalThis.addEventListener("militopo:v2-auth-signed-out", stopRealtimeRoster);
  if (globalThis.MILITOPO_V2_AUTH) scheduleLoad(120, true);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
else init();
