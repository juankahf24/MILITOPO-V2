/* MILITOPO V2 · Invitaciones en la cuenta del corredor.
   Muestra invitaciones dirigidas al correo autenticado y permite unirse con una escritura atómica. */
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

const state = {
  auth: globalThis.MILITOPO_V2_AUTH || null,
  services: null,
  rows: [],
  busy: false,
  root: null,
  list: null,
  status: null,
  badge: null,
  directInviteId: new URL(window.location.href).searchParams.get("invite") || "",
  realtimeUnsubs: [],
  realtimeEmailRows: new Map(),
  realtimeUidRows: new Map(),
  realtimeStartedFor: "",
  lastPendingSignature: ""
};

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function emailOf() {
  return String(state.auth?.email || "").trim().toLowerCase();
}
async function services() {
  if (state.services) return state.services;
  state.services = await globalThis.MILITOPO_V2.firebase();
  return state.services;
}
function injectStyle() {
  if (document.getElementById("m2InviteInboxStyle")) return;
  const style = document.createElement("style");
  style.id = "m2InviteInboxStyle";
  style.textContent = `
    #m2AuthAccountBtn{position:relative}
    .m2-inbox-badge{position:absolute;right:-5px;top:-6px;min-width:21px;height:21px;padding:0 6px;border-radius:999px;display:grid;place-items:center;background:#f0c66f;color:#17130b;font-size:.7rem;font-weight:1000;border:2px solid #0b1209}
    .m2-inbox{margin:2px 0 12px;padding:12px;border:1px solid rgba(245,204,121,.24);border-radius:13px;background:rgba(245,204,121,.055)}
    .m2-inbox-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
    .m2-inbox-title{font-weight:950;letter-spacing:.035em}
    .m2-inbox-count{font-size:.72rem;font-weight:900;opacity:.78}
    .m2-inbox-status{font-size:.8rem;line-height:1.4;opacity:.8;margin:6px 0}
    .m2-inbox-list{display:grid;gap:8px}
    .m2-inbox-item{padding:10px;border:1px solid rgba(255,255,255,.12);border-radius:11px;background:rgba(0,0,0,.12)}
    .m2-inbox-item.is-direct{border-color:rgba(245,204,121,.52);box-shadow:inset 0 0 0 1px rgba(245,204,121,.12)}
    .m2-inbox-event{font-weight:950;overflow-wrap:anywhere}
    .m2-inbox-meta{font-size:.76rem;opacity:.7;margin-top:3px;overflow-wrap:anywhere}
    .m2-inbox-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}
    .m2-inbox-actions button{min-height:42px;border-radius:10px;border:1px solid rgba(245,204,121,.35);background:rgba(245,204,121,.14);color:inherit;padding:8px 11px;font:inherit;font-weight:900;cursor:pointer}
    .m2-inbox-actions .m2-inbox-accept{background:linear-gradient(180deg,#f6d285,#d99c38);color:#1b160c}
    .m2-inbox-actions button:disabled{opacity:.5;cursor:not-allowed}
    .m2-inbox-joined{font-size:.78rem;font-weight:900;color:#bfe9c8;margin-top:7px}
  `;
  document.head.appendChild(style);
}
function ensureUi() {
  if (state.root?.isConnected) return true;
  const form = document.getElementById("m2AccountForm");
  if (!form) return false;
  injectStyle();
  const root = document.createElement("section");
  root.id = "m2InviteInbox";
  root.className = "m2-inbox";
  root.innerHTML = `
    <div class="m2-inbox-head">
      <div class="m2-inbox-title">🏁 Invitaciones a carreras</div>
      <div id="m2InviteInboxCount" class="m2-inbox-count">0 pendientes</div>
    </div>
    <div id="m2InviteInboxStatus" class="m2-inbox-status">Comprobando invitaciones…</div>
    <div id="m2InviteInboxList" class="m2-inbox-list"></div>`;
  const options = form.querySelector(".m2-account-options");
  if (options) form.insertBefore(root, options); else form.prepend(root);
  state.root = root;
  state.list = root.querySelector("#m2InviteInboxList");
  state.status = root.querySelector("#m2InviteInboxStatus");
  state.list.addEventListener("click", onClick);

  const accountButton = document.getElementById("m2AuthAccountBtn");
  if (accountButton && !document.getElementById("m2InviteInboxBadge")) {
    const badge = document.createElement("span");
    badge.id = "m2InviteInboxBadge";
    badge.className = "m2-inbox-badge";
    badge.hidden = true;
    accountButton.appendChild(badge);
    state.badge = badge;
  } else state.badge = document.getElementById("m2InviteInboxBadge");
  return true;
}
function setStatus(text) {
  if (state.status) state.status.textContent = text;
}

function stopRealtimeInvitations() {
  for (const unsubscribe of state.realtimeUnsubs.splice(0)) {
    try { unsubscribe?.(); } catch (_) {}
  }
  state.realtimeEmailRows.clear();
  state.realtimeUidRows.clear();
  state.realtimeStartedFor = "";
}
function rowsFromSnapshot(snapshot) {
  const out = new Map();
  snapshot.forEach(d => {
    const data = d.data() || {};
    const status = String(data.status || "pending");
    if (status === "pending" || (status === "accepted" && String(data.targetUid || "") === String(state.auth?.uid || ""))) {
      out.set(d.id, { id: d.id, ...data });
    }
  });
  return out;
}
function applyRealtimeRows() {
  const rowsById = new Map([...state.realtimeEmailRows, ...state.realtimeUidRows]);
  const rows = [...rowsById.values()];
  rows.sort((a,b) => {
    if (a.id === state.directInviteId) return -1;
    if (b.id === state.directInviteId) return 1;
    const am = a.createdAt?.toMillis?.() || 0, bm = b.createdAt?.toMillis?.() || 0;
    return bm - am;
  });
  state.rows = rows;
  render();
  const pending = rows.filter(row => String(row.status || "pending") === "pending");
  const signature = pending.map(row => row.id).sort().join("|");
  if (pending.length && signature && signature !== state.lastPendingSignature) {
    state.lastPendingSignature = signature;
    const marker = `militopo_v2_invite_seen_${state.auth?.uid || ""}_${pending.map(r => r.id).join("_")}`;
    let seen = false;
    try { seen = sessionStorage.getItem(marker) === "1"; } catch (_) {}
    if (state.directInviteId || !seen) {
      try { sessionStorage.setItem(marker, "1"); } catch (_) {}
      setTimeout(() => document.getElementById("m2AuthAccountBtn")?.click(), 120);
    }
  } else if (!pending.length) {
    state.lastPendingSignature = "";
  }
  try { globalThis.dispatchEvent(new CustomEvent("militopo:v2-inbox-updated", { detail: { pending: pending.length, rows: rows.length } })); } catch (_) {}
}
async function startRealtimeInvitations({ force = false } = {}) {
  if (!state.auth?.uid || !state.auth?.emailVerified || !emailOf()) return;
  if (!ensureUi()) { setTimeout(() => startRealtimeInvitations({ force }), 150); return; }
  const key = `${state.auth.uid}|${emailOf()}`;
  if (!force && state.realtimeStartedFor === key && state.realtimeUnsubs.length) return;
  stopRealtimeInvitations();
  state.realtimeStartedFor = key;
  setStatus("Comprobando invitaciones…");
  try {
    const { firestore } = await services();
    const emailQuery = query(collection(firestore, "invitations"), where("targetEmail", "==", emailOf()));
    const uidQuery = query(collection(firestore, "invitations"), where("targetUid", "==", String(state.auth.uid)));
    const onError = error => {
      console.error("[MILITOPO inbox realtime]", error);
      setStatus("No se pudieron sincronizar las invitaciones en tiempo real. Reintentaremos al recuperar conexión.");
    };
    state.realtimeUnsubs.push(onSnapshot(emailQuery, snap => {
      state.realtimeEmailRows = rowsFromSnapshot(snap);
      applyRealtimeRows();
    }, onError));
    state.realtimeUnsubs.push(onSnapshot(uidQuery, snap => {
      state.realtimeUidRows = rowsFromSnapshot(snap);
      applyRealtimeRows();
    }, onError));
  } catch (error) {
    console.error("[MILITOPO inbox realtime] start", error);
    setStatus("No se pudieron iniciar las invitaciones en tiempo real.");
  }
}
function removeInviteParam() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("invite")) return;
    url.searchParams.delete("invite");
    history.replaceState(history.state, "", url.href);
    state.directInviteId = "";
  } catch (_) {}
}
function render() {
  if (!ensureUi()) return;
  const pending = state.rows.filter(row => String(row.status || "pending") === "pending");
  const accepted = state.rows.filter(row => String(row.status || "") === "accepted" && String(row.targetUid || "") === String(state.auth?.uid || ""));
  const count = document.getElementById("m2InviteInboxCount");
  if (count) count.textContent = `${pending.length} pendiente${pending.length === 1 ? "" : "s"}`;
  if (state.badge) {
    state.badge.hidden = pending.length === 0;
    state.badge.textContent = pending.length > 9 ? "9+" : String(pending.length);
  }
  const rows = [...pending, ...accepted];
  if (!rows.length) {
    setStatus("No tienes invitaciones pendientes.");
    state.list.innerHTML = "";
    return;
  }
  setStatus(pending.length ? "Tienes una invitación pendiente. Puedes unirte directamente desde tu cuenta." : "No tienes invitaciones pendientes.");
  state.list.innerHTML = rows.map(row => {
    const isPending = String(row.status || "pending") === "pending";
    const direct = String(row.id) === String(state.directInviteId);
    return `<article class="m2-inbox-item ${direct ? "is-direct" : ""}">
      <div class="m2-inbox-event">${esc(row.eventName || "Carrera de orientación")}</div>
      <div class="m2-inbox-meta">Invitación para ${esc(row.targetUsername ? `@${row.targetUsername}` : (row.targetEmail || emailOf()))}</div>
      ${isPending
        ? `<div class="m2-inbox-actions"><button class="m2-inbox-accept" type="button" data-accept-invite="${esc(row.id)}" ${state.busy ? "disabled" : ""}>UNIRME A ESTA CARRERA</button></div>`
        : `<div class="m2-inbox-joined">✓ Ya estás unido a esta carrera</div>`}
    </article>`;
  }).join("");
}
async function loadInvitations() {
  if (!state.auth?.uid || !state.auth?.emailVerified || !emailOf()) return;
  if (!ensureUi()) {
    setTimeout(loadInvitations, 150);
    return;
  }
  setStatus("Comprobando invitaciones…");
  try {
    const { firestore } = await services();
    const rowsById = new Map();
    const [emailSnap, uidSnap] = await Promise.all([
      getDocs(query(collection(firestore, "invitations"), where("targetEmail", "==", emailOf()))),
      getDocs(query(collection(firestore, "invitations"), where("targetUid", "==", String(state.auth.uid))))
    ]);
    for (const snap of [emailSnap, uidSnap]) {
      snap.forEach(d => {
        const data = d.data() || {};
        const status = String(data.status || "pending");
        if (status === "pending" || (status === "accepted" && String(data.targetUid || "") === String(state.auth.uid))) {
          rowsById.set(d.id, { id: d.id, ...data });
        }
      });
    }
    const rows = [...rowsById.values()];
    if (state.directInviteId && !rows.some(row => row.id === state.directInviteId)) {
      try {
        const direct = await getDoc(doc(firestore, "invitations", state.directInviteId));
        if (direct.exists()) {
          const data = direct.data() || {};
          const status = String(data.status || "pending");
          if (status === "pending" || (status === "accepted" && String(data.targetUid || "") === String(state.auth.uid))) {
            rows.unshift({ id: direct.id, ...data });
          }
        }
      } catch (_) {
        setStatus("Este enlace de invitación no corresponde a la cuenta con la que has iniciado sesión, o ya no está disponible.");
      }
    }
    rows.sort((a,b) => {
      if (a.id === state.directInviteId) return -1;
      if (b.id === state.directInviteId) return 1;
      const am = a.createdAt?.toMillis?.() || 0, bm = b.createdAt?.toMillis?.() || 0;
      return bm - am;
    });
    state.rows = rows;
    render();

    const pending = rows.filter(row => String(row.status || "pending") === "pending");
    if (pending.length) {
      const marker = `militopo_v2_invite_seen_${state.auth.uid}_${pending.map(r => r.id).join("_")}`;
      const shouldOpen = Boolean(state.directInviteId) || sessionStorage.getItem(marker) !== "1";
      if (shouldOpen) {
        sessionStorage.setItem(marker, "1");
        setTimeout(() => document.getElementById("m2AuthAccountBtn")?.click(), 180);
      }
    }
  } catch (error) {
    console.error("[MILITOPO E1 inbox] load", error);
    setStatus("No se pudieron comprobar las invitaciones ahora. Tu sesión sigue funcionando.");
  }
}
async function acceptInvitation(id) {
  if (state.busy || !id || !state.auth?.uid) return;
  state.busy = true;
  render();
  setStatus("Uniéndote a la carrera…");
  try {
    const { firestore } = await services();
    const inviteRef = doc(firestore, "invitations", id);
    const inviteSnap = await getDoc(inviteRef);
    if (!inviteSnap.exists()) throw new Error("La invitación ya no existe.");
    const invite = inviteSnap.data() || {};
    const targetsUid = String(invite.targetUid || "") === String(state.auth.uid);
    const targetsEmail = String(invite.targetEmail || "").toLowerCase() === emailOf();
    if (!targetsUid && !targetsEmail) throw new Error("La invitación no corresponde a esta cuenta.");
    if (String(invite.status || "pending") === "revoked") throw new Error("La invitación ha sido revocada.");
    if (String(invite.status || "pending") === "accepted" && String(invite.targetUid || "") === String(state.auth.uid)) {
      removeInviteParam();
      await loadInvitations();
      setStatus("✓ Ya estabas unido a esta carrera.");
      return;
    }
    if (String(invite.status || "pending") !== "pending") throw new Error("La invitación ya no está disponible.");

    const memberRef = doc(firestore, "events", String(invite.eventId), "members", String(state.auth.uid));
    const memberSnap = await getDoc(memberRef);
    const batch = writeBatch(firestore);
    const inviteUpdate = {
      status: "accepted",
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    if (!invite.targetUid) inviteUpdate.targetUid = state.auth.uid;
    batch.update(inviteRef, inviteUpdate);
    if (!memberSnap.exists()) {
      batch.set(memberRef, {
        uid: state.auth.uid,
        email: emailOf(),
        role: "runner",
        status: "active",
        invitationId: id,
        joinedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    await batch.commit();
    removeInviteParam();
    applyRealtimeRows();
    setStatus("✅ Te has unido correctamente a la carrera.");
    globalThis.dispatchEvent(new CustomEvent("militopo:v2-invitation-accepted", { detail: { inviteId: id, eventId: invite.eventId } }));
    globalThis.dispatchEvent(new CustomEvent("militopo:v2-invitation-refresh", { detail: { inviteId: id, eventId: invite.eventId } }));
  } catch (error) {
    console.error("[MILITOPO E1 inbox] accept", error);
    setStatus(`No se pudo aceptar la invitación: ${String(error?.message || error)}`);
  } finally {
    state.busy = false;
    render();
  }
}
function onClick(event) {
  const button = event.target.closest("[data-accept-invite]");
  if (button) acceptInvitation(button.dataset.acceptInvite);
}
function onAuth(detail) {
  state.auth = detail || globalThis.MILITOPO_V2_AUTH || null;
  state.rows = [];
  if (!state.auth?.uid) {
    if (state.badge) state.badge.hidden = true;
    return;
  }
  setTimeout(() => startRealtimeInvitations({ force: true }), 80);
}
function init() {
  ensureUi();
  globalThis.addEventListener("militopo:v2-auth-ready", event => onAuth(event?.detail));
  globalThis.addEventListener("militopo:v2-invitation-refresh", () => startRealtimeInvitations({ force: true }));
  globalThis.addEventListener("online", () => startRealtimeInvitations({ force: true }));
  globalThis.addEventListener("militopo:v2-auth-signed-out", () => { stopRealtimeInvitations(); state.rows = []; render(); });
  if (globalThis.MILITOPO_V2_AUTH) onAuth(globalThis.MILITOPO_V2_AUTH);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
