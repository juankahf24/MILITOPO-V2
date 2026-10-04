/* MILITOPO V2 · F2C · Monitor Live del organizador.
   Solo lectura sobre Realtime Database V2.
   El Live heredado queda oculto en el organizador y se mantiene intacto como respaldo hasta F3. */
import "../bootstrap.js";
import { collection, doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const MANAGER_ROLES = new Set(["organizer", "super_admin"]);
const CONTROL_PENALTY_MS = 15 * 60 * 1000;
const EVENT_STATUS_ES = {
  draft: "BORRADOR",
  prepared: "PREPARADO",
  published: "PUBLICADO",
  live: "EN DIRECTO",
  finished: "FINALIZADO",
  archived: "ARCHIVADO"
};
const RUN_STATUS_ES = {
  active: "EN DIRECTO",
  closing: "CERRANDO",
  finished: "FINALIZADO",
  archived: "ARCHIVADO"
};
const PARTICIPANT_STATUS_ES = {
  not_started: "SIN SALIR",
  ready: "PREPARADO",
  racing: "EN CARRERA",
  started: "EN CARRERA",
  finished: "FINALIZADO",
  removed: "RETIRADO"
};

const state = {
  auth: globalThis.MILITOPO_V2_AUTH || null,
  services: null,
  eventId: "",
  ownerUid: "",
  eventStatus: "draft",
  runId: "",
  runStatus: "",
  participants: {},
  roster: {},
  unsubActive: null,
  unsubParticipants: null,
  unsubRoster: null,
  panel: null,
  lastError: "",
  profileCache: new Map(),
  profileLoads: new Set(),
  clockTimer: null
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
function fmtTime(value) {
  const n = Number(value || 0);
  if (!n) return "—";
  try {
    return new Intl.DateTimeFormat("es-ES", { hour:"2-digit", minute:"2-digit", second:"2-digit" }).format(new Date(n));
  } catch (_) { return "—"; }
}
function fmtAgo(value) {
  const n = Number(value || 0);
  if (!n) return "—";
  const sec = Math.max(0, Math.floor((Date.now() - n) / 1000));
  if (sec < 10) return "ahora";
  if (sec < 60) return `hace ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  return fmtTime(n);
}
function fmtDuration(ms) {
  const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), sec = total % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}
function refreshOfficialClocks() {
  document.querySelectorAll("#m2F2CBody tr[data-started-at]").forEach(tr => {
    const start = Number(tr.dataset.startedAt || 0);
    const finish = Number(tr.dataset.finishedAt || 0);
    if (!start) return;
    const raw = Math.max(0, (finish || Date.now()) - start);
    const penalty = Math.max(0, Number(tr.dataset.penaltyMs || 0));
    const rawEl = tr.querySelector("[data-role='real-time']");
    const officialEl = tr.querySelector("[data-role='official-time']");
    const syncEl = tr.querySelector("[data-role='last-sync']");
    if (rawEl) rawEl.textContent = fmtDuration(raw);
    if (officialEl) officialEl.textContent = fmtDuration(raw + penalty);
    if (syncEl) syncEl.textContent = fmtAgo(Number(tr.dataset.lastSeen || 0));
  });
}
function ensureClockTimer() {
  if (state.clockTimer) return;
  state.clockTimer = setInterval(refreshOfficialClocks, 1000);
}
async function services() {
  if (!state.services) state.services = await globalThis.MILITOPO_V2.firebase();
  return state.services;
}
function hideLegacyOrganizerLive() {
  if (document.getElementById("m2F2CHideLegacyStyle")) return;
  const style = document.createElement("style");
  style.id = "m2F2CHideLegacyStyle";
  style.textContent = `
    /* F2C: el panel V77 no se elimina; solo queda fuera de la UI del organizador. */
    #militopoLivePhase2Panel{display:none!important}
    .m2-f2c{margin:0;padding:14px;border-radius:18px;border:1px solid rgba(255,255,255,.09);background:linear-gradient(180deg,#1c281d,#151f16);color:#f4f2e7;min-width:0;max-width:100%;box-sizing:border-box}
    .m2-f2c-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
    .m2-f2c-title{font:950 .76rem/1 system-ui,-apple-system,sans-serif;letter-spacing:.09em;color:#eef2e5}
    .m2-f2c-chip{padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.045);font:900 .60rem/1 system-ui;letter-spacing:.06em}
    .m2-f2c-message{margin:9px 0 10px;line-height:1.35;font-size:.66rem;color:#aeb7ac}
    .m2-f2c-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:10px 0}
    .m2-f2c-metric{min-width:0;padding:9px 5px;border-radius:12px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.03);text-align:center}
    .m2-f2c-metric strong{display:block;font:950 1.08rem/1 system-ui}.m2-f2c-metric span{display:block;margin-top:4px;font:850 .48rem/1.05 system-ui;letter-spacing:.05em;color:#98a398}
    .m2-f2c-run{padding:8px 10px;border-radius:11px;border:1px solid rgba(255,255,255,.06);background:rgba(0,0,0,.13);font-size:.60rem;line-height:1.35;color:#b4beb2;word-break:break-word}
    .m2-f2c-table-wrap{margin-top:10px;overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid rgba(255,255,255,.08);border-radius:13px;max-width:100%}
    .m2-f2c-table{width:100%;border-collapse:collapse;min-width:1280px;background:rgba(0,0,0,.08)}
    .m2-f2c-table th,.m2-f2c-table td{padding:8px 7px;border-bottom:1px solid rgba(255,255,255,.055);font-size:.61rem;text-align:left;vertical-align:middle}
    .m2-f2c-table th{font-size:.52rem;color:#d9c792;letter-spacing:.045em;white-space:nowrap;position:sticky;top:0;background:#172219;z-index:2}.m2-f2c-table td{white-space:nowrap}.m2-f2c-table td:first-child{white-space:normal;min-width:185px;position:sticky;left:0;background:#172219;z-index:1}.m2-f2c-time{font-variant-numeric:tabular-nums;font-weight:850}.m2-f2c-penalty{color:#ffd28c;font-weight:900}
    .m2-f2c-state{display:inline-flex;padding:4px 7px;border-radius:999px;border:1px solid rgba(255,255,255,.12);font-size:.53rem;font-weight:900}
    .m2-f2c-state.racing{color:#d7ecff;border-color:rgba(102,172,242,.35);background:rgba(76,136,197,.14)}
    .m2-f2c-state.finished{color:#e8ffd7;border-color:rgba(126,220,150,.34);background:rgba(96,160,77,.14)}
    .m2-f2c-state.pending{color:#ffe6a7;border-color:rgba(245,204,121,.34);background:rgba(170,121,43,.12)}
    .m2-f2c-signal{display:flex;gap:5px;flex-wrap:wrap;margin-top:4px;font:800 .47rem/1.05 system-ui}.m2-f2c-signal .ok{color:#bde99c}.m2-f2c-signal .off{color:#889188}.m2-f2c-signal .gps{color:#b9dcf2}
    @media(max-width:600px){.m2-f2c{padding:10px}.m2-f2c-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.m2-f2c-table-wrap{border-radius:11px}}
  `;
  document.head.appendChild(style);
}
function ensurePanel() {
  if (state.panel?.isConnected) return state.panel;
  hideLegacyOrganizerLive();
  const foundation = document.getElementById("m2LiveV2Foundation");
  const step = document.getElementById("step1");
  if (!step) return null;
  const panel = document.createElement("section");
  panel.id = "m2OrganizerLiveMonitor";
  panel.className = "m2-f2c";
  panel.innerHTML = `
    <div class="m2-f2c-head">
      <div class="m2-f2c-title">SEGUIMIENTO EN DIRECTO</div>
      <div id="m2F2CChip" class="m2-f2c-chip">ESPERANDO</div>
    </div>
    <div id="m2F2CMessage" class="m2-f2c-message">Carga un evento para conectar el seguimiento V2.</div>
    <div class="m2-f2c-metrics">
      <div class="m2-f2c-metric"><strong id="m2F2CTotal">0</strong><span>PARTICIPANTES</span></div>
      <div class="m2-f2c-metric"><strong id="m2F2CPending">0</strong><span>SIN SALIR</span></div>
      <div class="m2-f2c-metric"><strong id="m2F2CRacing">0</strong><span>EN CARRERA</span></div>
      <div class="m2-f2c-metric"><strong id="m2F2CFinished">0</strong><span>FINALIZADOS</span></div>
    </div>
    <div id="m2F2CRun" class="m2-f2c-run">Sin sesión de seguimiento cargada.</div>
    <div class="m2-f2c-table-wrap">
      <table class="m2-f2c-table">
        <thead><tr><th>PARTICIPANTE</th><th>ESTADO</th><th>PROGRESO</th><th>PUNTOS PENDIENTES</th><th>PUNTOS DESCARTADOS</th><th>TIEMPO AJUSTADO</th><th>PENALIZACIÓN CONTROLES</th><th>TIEMPO REAL</th><th>ÚLTIMA SINCRONIZACIÓN</th><th>HORA SALIDA</th><th>HORA LLEGADA</th></tr></thead>
        <tbody id="m2F2CBody"><tr><td colspan="11">Todavía no hay una sesión de seguimiento activa.</td></tr></tbody>
      </table>
    </div>`;
  if (foundation?.parentNode) foundation.insertAdjacentElement("afterend", panel);
  else {
    const nav = step.querySelector(".nav-row");
    if (nav) nav.insertAdjacentElement("beforebegin", panel); else step.appendChild(panel);
  }
  state.panel = panel;
  render();
  return panel;
}
function participantRows() {
  const source = state.runId ? state.participants : state.roster;
  return Object.values(source || {}).filter(row => row && row.active !== false).map(row => {
    if (state.runId) return row;
    return { ...row, status: "ready", online: false };
  }).sort((a,b) => {
    const an = String(a.displayName || a.username || a.uid || "").toLowerCase();
    const bn = String(b.displayName || b.username || b.uid || "").toLowerCase();
    return an.localeCompare(bn, "es");
  });
}
async function hydrateParticipantProfiles() {
  const source = state.runId ? state.participants : state.roster;
  const rows = Object.values(source || {}).filter(Boolean);
  const pending = rows.filter(row => {
    const uid = String(row?.uid || "").trim();
    if (!uid) return false;
    if (row.displayName || row.username || row.email) return false;
    if (state.profileCache.has(uid) || state.profileLoads.has(uid)) return false;
    return true;
  });
  if (!pending.length) return;

  const { firestore } = await services();
  await Promise.allSettled(pending.map(async row => {
    const uid = String(row.uid || "").trim();
    state.profileLoads.add(uid);
    try {
      const snap = await getDoc(doc(firestore, "users", uid));
      const profile = snap.exists() ? (snap.data() || {}) : {};
      const hydrated = {
        displayName: String(profile.displayName || "").trim(),
        username: String(profile.usernameKey || profile.username || "").replace(/^@/, "").trim(),
        email: String(profile.email || "").trim()
      };
      state.profileCache.set(uid, hydrated);
      if (state.participants?.[uid]) Object.assign(state.participants[uid], hydrated);
      if (state.roster?.[uid]) Object.assign(state.roster[uid], hydrated);
    } catch (error) {
      console.warn("[MILITOPO F2C] perfil participante", uid, error);
      state.profileCache.set(uid, {});
    } finally {
      state.profileLoads.delete(uid);
    }
  }));
  render();
}
function normalizedStatus(row) {
  const raw = String(row?.status || "not_started").toLowerCase();
  if (raw === "started") return "racing";
  return raw;
}
function render() {
  const panel = ensurePanel();
  if (!panel) return;
  const chip = panel.querySelector("#m2F2CChip");
  const message = panel.querySelector("#m2F2CMessage");
  const run = panel.querySelector("#m2F2CRun");
  const body = panel.querySelector("#m2F2CBody");
  if (!canManage()) {
    chip.textContent = "SIN PERMISOS";
    message.textContent = "Se necesita una cuenta verificada de ORGANIZADOR o SÚPER ADMINISTRADOR.";
    return;
  }
  const rows = participantRows();
  const pending = rows.filter(r => ["not_started","ready"].includes(normalizedStatus(r))).length;
  const racing = rows.filter(r => normalizedStatus(r) === "racing").length;
  const finished = rows.filter(r => normalizedStatus(r) === "finished").length;
  panel.querySelector("#m2F2CTotal").textContent = String(rows.length);
  panel.querySelector("#m2F2CPending").textContent = String(pending);
  panel.querySelector("#m2F2CRacing").textContent = String(racing);
  panel.querySelector("#m2F2CFinished").textContent = String(finished);

  const eventLabel = EVENT_STATUS_ES[state.eventStatus] || String(state.eventStatus || "").toUpperCase() || "ESPERANDO";
  const runLabel = RUN_STATUS_ES[state.runStatus] || eventLabel;
  chip.textContent = state.runId ? runLabel : eventLabel;

  if (state.lastError) message.textContent = state.lastError;
  else if (!state.eventId) message.textContent = "Carga un evento para conectar el seguimiento V2.";
  else if (!state.runId) message.textContent = rows.length
    ? `${rows.length} corredor${rows.length === 1 ? "" : "es"} autorizado${rows.length === 1 ? "" : "s"}. El seguimiento se activará al iniciar la carrera.`
    : (state.eventStatus === "published"
      ? "Evento PUBLICADO. No hay corredores autorizados todavía."
      : `Evento ${eventLabel}. No hay corredores autorizados todavía.`);
  else message.textContent = state.runStatus === "finished"
    ? "Carrera finalizada. Se conserva la última tabla recibida."
    : "Seguimiento conectado en tiempo real.";

  run.textContent = state.runId
    ? `Sesión: ${state.runId} · ${runLabel} · ${rows.length} participante${rows.length === 1 ? "" : "s"}`
    : `Pre-salida · ${rows.length} corredor${rows.length === 1 ? "" : "es"} autorizado${rows.length === 1 ? "" : "s"}`;

  if (!state.runId && !rows.length) {
    body.innerHTML = `<tr><td colspan="11">Todavía no hay corredores autorizados para el seguimiento.</td></tr>`;
    return;
  }
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="11">La sesión no tiene corredores autorizados.</td></tr>`;
    return;
  }
  body.innerHTML = rows.map(row => {
    const st = normalizedStatus(row);
    const cls = st === "finished" ? "finished" : st === "racing" ? "racing" : "pending";
    const label = PARTICIPANT_STATUS_ES[st] || st.toUpperCase();
    const name = String(row.displayName || row.username || row.email || row.uid || "Corredor");
    const sub = row.username ? `@${String(row.username).replace(/^@/,"")}` : String(row.email || row.uid || "");
    const online = row.online === true;
    const gps = row.gps || {};
    const hasGps = Number.isFinite(Number(gps.lat)) && Number.isFinite(Number(gps.lng)) && Number(gps.updatedAt || 0) > 0;
    const gpsActive = gps.active === true;
    const gpsLabel = !state.runId ? "—" : hasGps
      ? `${gpsActive ? "● GPS" : "○ ÚLTIMO"} ±${Math.round(Number(gps.accuracy || 0))}m · ${fmtAgo(gps.updatedAt)}`
      : "SIN GPS";
    const expectedControls = Math.max(0, Number(row.controlExpectedCount || row.routeControlCount || 0));
    // controlCompletedCount representa el avance secuencial e incluye los descartes.
    const completedControls = Math.min(expectedControls || Number.MAX_SAFE_INTEGER, Math.max(0, Number(row.controlCompletedCount || 0)));
    const discardedControls = Math.min(completedControls, Math.max(0, Number(row.discardedControlCount || 0)));
    const pendingControls = Math.max(0, expectedControls - completedControls);
    const progressLabel = expectedControls > 0 ? `${completedControls}/${expectedControls}` : "—";
    const progressDone = expectedControls > 0 && completedControls >= expectedControls;
    const startedAt = Math.max(0, Number(row.startedAt || 0));
    const finishedAt = Math.max(0, Number(row.finishedAt || 0));
    const hasStarted = startedAt > 0 && ["racing","finished"].includes(st);
    // Durante la carrera solo cuentan penalizaciones ya ocurridas (descartes).
    // Las balizas que sigan pendientes se penalizan únicamente al finalizar.
    const accumulatedPenalty = hasStarted ? discardedControls * CONTROL_PENALTY_MS : 0;
    const finalPenalty = st === "finished" && row.penaltyMs != null && Number.isFinite(Number(row.penaltyMs)) ? Math.max(0, Number(row.penaltyMs)) : accumulatedPenalty;
    const rawDuration = hasStarted ? Math.max(0, (finishedAt || Date.now()) - startedAt) : null;
    const finalOfficial = st === "finished" && row.officialDurationMs != null && Number.isFinite(Number(row.officialDurationMs)) ? Math.max(0, Number(row.officialDurationMs)) : (rawDuration == null ? null : rawDuration + finalPenalty);
    const lastSeen = Math.max(0, Number(row.lastSeen || row.updatedAt || 0));
    return `<tr data-started-at="${startedAt}" data-finished-at="${finishedAt}" data-penalty-ms="${finalPenalty}" data-last-seen="${lastSeen}">
      <td><strong>${esc(name)}</strong><br><span style="opacity:.62">${esc(sub)}</span><span class="m2-f2c-signal"><span class="${online ? "ok" : "off"}">${state.runId ? (online ? "● EN LÍNEA" : "○ SIN CONEXIÓN") : "EN ESPERA"}</span><span class="gps">${esc(gpsLabel)}</span></span></td>
      <td><span class="m2-f2c-state ${cls}">${esc(label)}</span></td>
      <td><strong style="color:${progressDone ? "#bde99c" : "#f5d18b"}">${esc(progressLabel)}</strong></td>
      <td><strong>${pendingControls}</strong></td>
      <td><strong>${discardedControls}</strong></td>
      <td class="m2-f2c-time" data-role="official-time">${finalOfficial == null ? "—" : fmtDuration(finalOfficial)}</td>
      <td class="m2-f2c-time m2-f2c-penalty">${finalPenalty ? `+${fmtDuration(finalPenalty)}` : (hasStarted ? "+00:00:00" : "—")}</td>
      <td class="m2-f2c-time" data-role="real-time">${rawDuration == null ? "—" : fmtDuration(rawDuration)}</td>
      <td data-role="last-sync">${esc(fmtAgo(lastSeen))}</td>
      <td>${esc(fmtTime(startedAt))}</td>
      <td>${esc(fmtTime(finishedAt))}</td>
    </tr>`;
  }).join("");
  refreshOfficialClocks();
  ensureClockTimer();
}
function clearListeners() {
  try { state.unsubActive?.(); } catch (_) {}
  try { state.unsubParticipants?.(); } catch (_) {}
  try { state.unsubRoster?.(); } catch (_) {}
  state.unsubActive = null;
  state.unsubParticipants = null;
  state.unsubRoster = null;
}
async function resolveOwner(eventId) {
  const { firestore } = await services();
  const snap = await getDoc(doc(firestore, "events", eventId));
  if (!snap.exists()) throw new Error("EVENT_NOT_FOUND");
  const data = snap.data() || {};
  const ownerUid = String(data.ownerUid || "").trim();
  if (!ownerUid) throw new Error("EVENT_OWNER_MISSING");
  if (roleOf() !== "super_admin" && ownerUid !== String(state.auth?.uid || "")) throw new Error("EVENT_NOT_OWNED");
  state.eventStatus = String(data.status || "draft").toLowerCase();
  return ownerUid;
}
async function bindRoster() {
  try { state.unsubRoster?.(); } catch (_) {}
  state.unsubRoster = null;
  state.roster = {};
  if (!state.eventId) { render(); return; }
  try {
    const { firestore } = await services();
    // Antes de iniciar una sesión, la fuente de verdad es el censo Firestore.
    // Esto evita depender de que el espejo RTDB haya terminado de sincronizar.
    state.unsubRoster = onSnapshot(collection(firestore, "events", state.eventId, "members"), snap => {
      const next = {};
      snap.forEach(memberDoc => {
        const row = memberDoc.data() || {};
        const uid = String(row.uid || memberDoc.id || "").trim();
        if (!uid) return;
        const status = String(row.status || "active").toLowerCase();
        next[uid] = {
          uid,
          active: status === "active",
          status,
          displayName: String(row.displayName || row.name || "").trim(),
          username: String(row.username || row.usernameKey || "").replace(/^@/, "").trim(),
          email: String(row.email || "").trim(),
          routeControlCount: Math.max(0, Number(row.routeControlCount || row.controlCount || 0)),
          controlExpectedCount: Math.max(0, Number(row.controlExpectedCount || row.routeControlCount || row.controlCount || 0)),
          controlCompletedCount: Math.max(0, Number(row.controlCompletedCount || 0)),
          updatedAt: row.updatedAt?.toMillis?.() || Date.now()
        };
      });
      state.roster = next;
      for (const [uid, cached] of state.profileCache.entries()) {
        if (state.roster?.[uid]) Object.assign(state.roster[uid], cached);
      }
      state.lastError = "";
      render();
      hydrateParticipantProfiles();
    }, error => {
      console.error("[MILITOPO F2C] roster firestore", error);
      state.lastError = "No se pudo leer el censo del evento en tiempo real.";
      render();
    });
  } catch (error) {
    console.error("[MILITOPO F2C] bindRoster", error);
    state.lastError = "No se pudo preparar el censo Live V2.";
    render();
  }
}

async function bindParticipants() {
  try { state.unsubParticipants?.(); } catch (_) {}
  state.unsubParticipants = null;
  state.participants = {};
  render();
  if (!state.runId || !state.ownerUid || !state.eventId) return;
  const { database } = await services();
  const path = `v2/live/${state.ownerUid}/${state.eventId}/runs/${state.runId}/participants`;
  state.unsubParticipants = onValue(ref(database, path), snap => {
    state.participants = snap.exists() ? (snap.val() || {}) : {};
    for (const [uid, cached] of state.profileCache.entries()) {
      if (state.participants?.[uid]) Object.assign(state.participants[uid], cached);
    }
    state.lastError = "";
    render();
    hydrateParticipantProfiles();
  }, error => {
    console.error("[MILITOPO F2C] participants", error);
    state.lastError = "No se pudo leer la tabla Live V2 del organizador.";
    render();
  });
}
async function bindEvent(eventId) {
  const nextId = String(eventId || "").trim();
  if (!nextId || !canManage()) return;
  if (nextId === state.eventId && state.unsubActive) {
    if (!state.unsubRoster) await bindRoster();
    return;
  }
  clearListeners();
  state.eventId = nextId;
  state.ownerUid = "";
  state.runId = "";
  state.runStatus = "";
  state.participants = {};
  state.roster = {};
  state.lastError = "";
  render();
  try {
    state.ownerUid = await resolveOwner(nextId);
    await bindRoster();
    const { database } = await services();
    const activePath = `v2/live/${state.ownerUid}/${state.eventId}/activeRun`;
    state.unsubActive = onValue(ref(database, activePath), snap => {
      const active = snap.exists() ? (snap.val() || {}) : {};
      const nextRunId = String(active.runId || "").trim();
      const changed = nextRunId !== state.runId;
      state.runId = nextRunId;
      state.runStatus = String(active.status || "").toLowerCase();
      state.lastError = "";
      render();
      if (changed) bindParticipants();
    }, error => {
      console.error("[MILITOPO F2C] activeRun", error);
      state.lastError = "No se pudo conectar con la sesión Live V2.";
      render();
    });
  } catch (error) {
    console.error("[MILITOPO F2C] bindEvent", error);
    state.lastError = "No se pudo preparar el monitor Live V2 para este evento.";
    render();
  }
}
function eventIdNow(detail = null) {
  return String(detail?.eventId || globalThis.MILITOPO_V2_EVENT_STATUS?.eventId || document.getElementById("eventId")?.value || "").trim();
}
function onAuth(event) {
  state.auth = event?.detail || globalThis.MILITOPO_V2_AUTH || null;
  ensurePanel();
  const id = eventIdNow();
  if (id) bindEvent(id);
}
function init() {
  hideLegacyOrganizerLive();
  ensurePanel();
  globalThis.addEventListener("militopo:v2-auth-ready", onAuth);
  globalThis.addEventListener("militopo:v2-event-status", event => {
    const d = event?.detail || {};
    if (d.status) state.eventStatus = String(d.status).toLowerCase();
    const id = eventIdNow(d);
    if (id) bindEvent(id);
    render();
  });
  globalThis.addEventListener("militopo:v2-event-status-changed", event => {
    const d = event?.detail || {};
    if (d.to) state.eventStatus = String(d.to).toLowerCase();
    const id = eventIdNow(d);
    if (id) bindEvent(id);
    render();
  });
  globalThis.addEventListener("militopo:v2-live-run-changed", event => {
    const d = event?.detail || {};
    if (d.status) state.eventStatus = String(d.status).toLowerCase();
    const id = eventIdNow(d);
    if (id) bindEvent(id);
    render();
  });
  globalThis.addEventListener("militopo:v2-roster-changed", () => { const id = eventIdNow(); if (id) bindRoster(); });
  globalThis.addEventListener("militopo:v2-roster-refresh", () => { const id = eventIdNow(); if (id) bindRoster(); });
  globalThis.addEventListener("militopo:v2-invitation-accepted", () => { const id = eventIdNow(); if (id) bindRoster(); });
  globalThis.addEventListener("militopo:v2-live-foundation-ready", () => { const id = eventIdNow(); if (id) bindRoster(); });
  globalThis.addEventListener("online", () => { const id = eventIdNow(); if (id) bindEvent(id); });
  globalThis.addEventListener("offline", () => { state.lastError = "Sin conexión. Se mantiene la última tabla Live V2 recibida."; render(); });
  if (globalThis.MILITOPO_V2_AUTH) onAuth({ detail: globalThis.MILITOPO_V2_AUTH });
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
else init();
