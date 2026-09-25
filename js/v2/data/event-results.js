/* MILITOPO V2 · H6 · resultados persistentes + paso GPS por balizas para el organizador.
   Fuente exclusiva: Firestore events/{eventId}/results. No depende del Live RTDB. */
import "../bootstrap.js";
import {
  collection,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const MANAGER_ROLES = new Set(["organizer", "super_admin"]);
const STATUS_ES = {
  draft: "BORRADOR",
  prepared: "PREPARADO",
  published: "PUBLICADO",
  live: "EN DIRECTO",
  finished: "FINALIZADO",
  archived: "ARCHIVADO"
};
const RESULT_ES = {
  finished: "FINALIZADO",
  incomplete: "INCOMPLETO",
  not_started: "NO SALIÓ"
};
const state = {
  auth: globalThis.MILITOPO_V2_AUTH || null,
  services: null,
  eventId: "",
  eventStatus: "",
  rows: [],
  panel: null,
  unsubscribe: null,
  bindingKey: "",
  error: "",
  classification: null,
  classLoading: false,
  classError: "",
  classView: "general",
  classToken: 0
};

function esc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
}
function roleOf() {
  const role = String(state.auth?.role || "runner");
  return ["runner", "organizer", "super_admin"].includes(role) ? role : "runner";
}
function canManage() {
  return Boolean(state.auth?.uid && state.auth?.emailVerified && MANAGER_ROLES.has(roleOf()));
}
async function services() {
  if (!state.services) state.services = await globalThis.MILITOPO_V2.firebase();
  return state.services;
}
function currentEventId() {
  return String(state.eventId || document.getElementById("eventId")?.value || "").trim();
}
function injectStyle() {
  if (document.getElementById("m2H2ResultsStyle")) return;
  const style = document.createElement("style");
  style.id = "m2H2ResultsStyle";
  style.textContent = `
    .m2-h2{margin:16px 0;padding:15px;border-radius:20px;border:1px solid rgba(111,184,229,.32);background:linear-gradient(180deg,rgba(7,19,28,.94),rgba(5,14,20,.96))}
    .m2-h2-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .m2-h2-title{font-weight:900;letter-spacing:.075em;color:#d8efff}.m2-h2-chip{padding:6px 10px;border-radius:999px;border:1px solid rgba(111,184,229,.34);font-size:.70rem;font-weight:900}
    .m2-h2-message{margin:10px 0 11px;font-size:.78rem;line-height:1.45;opacity:.84}
    .m2-h2-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:10px 0 12px}
    .m2-h2-metric{padding:9px 5px;border-radius:13px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);text-align:center}
    .m2-h2-metric strong{display:block;font-size:1.02rem}.m2-h2-metric span{display:block;margin-top:2px;font-size:.56rem;opacity:.66}
    .m2-h2-tools{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:5px 0 9px;flex-wrap:wrap}.m2-h2-source{font-size:.64rem;opacity:.62}
    .m2-h2-refresh{min-height:34px;padding:6px 10px;border-radius:10px;border:1px solid rgba(111,184,229,.30);background:rgba(111,184,229,.10);color:inherit;font:inherit;font-size:.65rem;font-weight:900;cursor:pointer}
    .m2-h2-table-wrap{overflow:auto;border:1px solid rgba(255,255,255,.08);border-radius:14px;max-height:390px}.m2-h2-table{width:100%;border-collapse:collapse;min-width:930px;background:rgba(0,0,0,.10)}
    .m2-h2-table th,.m2-h2-table td{padding:8px 7px;border-bottom:1px solid rgba(255,255,255,.06);font-size:.62rem;text-align:left;white-space:nowrap}.m2-h2-table th{font-size:.55rem;color:#cfeaff;letter-spacing:.045em;position:sticky;top:0;background:#0a1921;z-index:1}
    .m2-h2-state{display:inline-flex;padding:4px 7px;border-radius:999px;border:1px solid rgba(255,255,255,.14);font-size:.54rem;font-weight:900}.m2-h2-state.finished{color:#dcffd0;border-color:rgba(126,220,150,.35);background:rgba(82,145,66,.15)}.m2-h2-state.incomplete{color:#ffe4a8;border-color:rgba(245,204,121,.34);background:rgba(160,114,43,.14)}.m2-h2-state.not_started{color:#d2d8dc;opacity:.72}
    .m2-h2-empty{padding:18px;text-align:center;font-size:.72rem;opacity:.68}.m2-h2-num{font-variant-numeric:tabular-nums}
    .m2-h5{margin-top:14px;padding-top:14px;border-top:1px solid rgba(111,184,229,.18)}.m2-h5-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.m2-h5-title{font-weight:900;letter-spacing:.075em;color:#f6e2a6}.m2-h5-note{margin:7px 0 9px;font-size:.66rem;line-height:1.4;opacity:.72}.m2-h5-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.m2-h5-tab{min-height:34px;padding:6px 10px;border-radius:999px;border:1px solid rgba(240,193,106,.28);background:rgba(240,193,106,.06);color:inherit;font:inherit;font-size:.62rem;font-weight:900}.m2-h5-tab.active{background:#d8b45e;color:#201608;border-color:#f2d58f}.m2-h5-table-wrap{overflow:auto;border:1px solid rgba(255,255,255,.08);border-radius:14px;max-height:430px}.m2-h5-table{width:100%;border-collapse:collapse;min-width:900px}.m2-h5-table th,.m2-h5-table td{padding:8px 7px;border-bottom:1px solid rgba(255,255,255,.06);font-size:.62rem;text-align:left;white-space:nowrap}.m2-h5-table th{font-size:.55rem;color:#f3dfa8;position:sticky;top:0;background:#0a1921;z-index:1}.m2-h5-rank{font-weight:900;color:#f6e2a6}.m2-h5-gap{font-variant-numeric:tabular-nums}.m2-h5-own{background:rgba(240,193,106,.08)}
    @media(max-width:600px){.m2-h2-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.m2-h2{padding:13px 11px}}
  `;
  document.head.appendChild(style);
}
function ensurePanel() {
  if (state.panel?.isConnected) return state.panel;
  const step = document.getElementById("step1");
  if (!step) return null;
  const mapPanel = document.getElementById("m2OrganizerLiveMap");
  const monitor = document.getElementById("m2OrganizerLiveMonitor");
  const panel = document.createElement("section");
  panel.id = "m2EventHistoricalResults";
  panel.className = "m2-h2";
  panel.innerHTML = `
    <div class="m2-h2-head"><div class="m2-h2-title">🏁 RESULTADOS E HISTÓRICO · EVENTO</div><div id="m2H2Chip" class="m2-h2-chip">SIN EVENTO</div></div>
    <div id="m2H2Message" class="m2-h2-message">Carga un evento para consultar los resultados persistentes.</div>
    <div class="m2-h2-metrics">
      <div class="m2-h2-metric"><strong id="m2H2Total">0</strong><span>RESULTADOS</span></div>
      <div class="m2-h2-metric"><strong id="m2H2Finished">0</strong><span>FINALIZADOS</span></div>
      <div class="m2-h2-metric"><strong id="m2H2Incomplete">0</strong><span>INCOMPLETOS</span></div>
      <div class="m2-h2-metric"><strong id="m2H2NotStarted">0</strong><span>NO SALIERON</span></div>
    </div>
    <div class="m2-h2-tools"><div class="m2-h2-source">Fuente: Firestore · histórico permanente H1/H2</div><button id="m2H2Refresh" class="m2-h2-refresh" type="button">ACTUALIZAR</button></div>
    <div class="m2-h2-table-wrap"><table class="m2-h2-table"><thead><tr><th>CORREDOR</th><th>ESTADO</th><th>SALIDA</th><th>LLEGADA</th><th>TIEMPO</th><th>DISTANCIA</th><th>BALIZAS GPS</th><th>GPS</th><th>RUN</th></tr></thead><tbody id="m2H2Body"><tr><td colspan="9" class="m2-h2-empty">Sin resultados cargados.</td></tr></tbody></table></div>
    <section class="m2-h5"><div class="m2-h5-head"><div class="m2-h5-title">🏆 CLASIFICACIÓN H5</div><div id="m2H5Chip" class="m2-h2-chip">SIN DATOS</div></div><div id="m2H5Note" class="m2-h5-note">GENERAL incluye a todos los participantes independientemente del recorrido. POR RECORRIDO compara únicamente corredores con el mismo Rxx.</div><div id="m2H5Tabs" class="m2-h5-tabs"></div><div class="m2-h5-table-wrap"><table class="m2-h5-table"><thead><tr><th>PUESTO</th><th>CORREDOR</th><th>PLAZA</th><th>RECORRIDO</th><th>D. REDUCIDA</th><th>TIEMPO</th><th>DIF. LÍDER</th><th>ESTADO</th></tr></thead><tbody id="m2H5Body"><tr><td colspan="8" class="m2-h2-empty">Sin clasificación cargada.</td></tr></tbody></table></div></section>`;
  if (mapPanel?.parentNode) mapPanel.insertAdjacentElement("afterend", panel);
  else if (monitor?.parentNode) monitor.insertAdjacentElement("afterend", panel);
  else {
    const nav = step.querySelector(".nav-row");
    if (nav) nav.insertAdjacentElement("beforebegin", panel); else step.appendChild(panel);
  }
  panel.querySelector("#m2H2Refresh")?.addEventListener("click", () => { bindResults(true); loadClassification(true); });
  panel.addEventListener("click", event => {
    const btn = event.target.closest("[data-h5-view]");
    if (!btn) return;
    state.classView = String(btn.dataset.h5View || "general");
    renderClassification();
  });
  state.panel = panel;
  render();
  return panel;
}
function setText(id, value) {
  const node = state.panel?.querySelector(`#${id}`);
  if (node) node.textContent = String(value ?? "");
}
function formatDateTime(value) {
  const ms = Number(value || 0);
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  try { return new Intl.DateTimeFormat("es-ES", { day:"2-digit", month:"2-digit", year:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit" }).format(new Date(ms)); }
  catch (_) { return new Date(ms).toLocaleString(); }
}
function formatDuration(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}
function formatDistance(value) {
  const m = Number(value);
  if (!Number.isFinite(m) || m < 0) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}
function formatGap(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms === 0) return "LÍDER";
  return `+${formatDuration(ms)}`;
}
function classRows() {
  if (!state.classification) return [];
  if (state.classView === "general") return Array.isArray(state.classification.general) ? state.classification.general : [];
  return Array.isArray(state.classification.byRoute?.[state.classView]) ? state.classification.byRoute[state.classView] : [];
}
function renderClassification() {
  ensurePanel();
  if (!state.panel) return;
  const tabs = state.panel.querySelector("#m2H5Tabs");
  const body = state.panel.querySelector("#m2H5Body");
  const chip = state.panel.querySelector("#m2H5Chip");
  const note = state.panel.querySelector("#m2H5Note");
  if (!tabs || !body || !chip || !note) return;
  const data = state.classification;
  if (state.classLoading) chip.textContent = "CARGANDO";
  else if (state.classError) chip.textContent = "ERROR";
  else if (data?.event?.provisional) chip.textContent = "PROVISIONAL";
  else if (data) chip.textContent = "OFICIAL";
  else chip.textContent = "SIN DATOS";

  const routes = Array.isArray(data?.routes) ? data.routes : [];
  if (state.classView !== "general" && !routes.some(row => row.routeId === state.classView)) state.classView = "general";
  tabs.innerHTML = `<button class="m2-h5-tab ${state.classView === "general" ? "active" : ""}" type="button" data-h5-view="general">GENERAL</button>` + routes.map(route => `<button class="m2-h5-tab ${state.classView === route.routeId ? "active" : ""}" type="button" data-h5-view="${esc(route.routeId)}">${esc(route.routeId)} · ${esc(route.participantCount)} corredores</button>`).join("");

  if (state.classError) note.textContent = `⚠️ ${state.classError}`;
  else if (state.classView === "general") note.textContent = "GENERAL ordena por tiempo absoluto entre todos los finalizados, aunque sus recorridos sean diferentes. El Rxx y la distancia reducida permanecen visibles para interpretar la comparación.";
  else {
    const route = routes.find(row => row.routeId === state.classView) || {};
    const distance = Number.isFinite(Number(route.routeDistanceKm)) ? `${Number(route.routeDistanceKm).toFixed(2)} km` : "distancia —";
    note.textContent = `${state.classView}: ${route.participantCount || 0} participantes · ${distance} · clasificación entre corredores del mismo recorrido.`;
  }

  if (state.classLoading) { body.innerHTML = '<tr><td colspan="8" class="m2-h2-empty">Calculando clasificación…</td></tr>'; return; }
  const rows = classRows();
  if (!rows.length) { body.innerHTML = `<tr><td colspan="8" class="m2-h2-empty">${state.classError ? "No se pudo cargar la clasificación." : "Todavía no hay participantes clasificables."}</td></tr>`; return; }
  body.innerHTML = rows.map(row => {
    const status = ["finished","incomplete","not_started"].includes(String(row.status)) ? String(row.status) : "not_started";
    return `<tr class="${row.runnerUid === state.auth?.uid ? "m2-h5-own" : ""}"><td class="m2-h5-rank">${row.rank ?? "—"}</td><td><strong>${esc(runnerName(row))}</strong></td><td>${esc(row.participantId || "—")}</td><td>${esc(row.routeId || "—")}</td><td>${row.routeDistanceKm == null ? "—" : `${esc(Number(row.routeDistanceKm).toFixed(2))} km`}</td><td><strong>${esc(formatDuration(row.durationMs))}</strong></td><td class="m2-h5-gap">${esc(formatGap(row.gapToLeaderMs))}</td><td><span class="m2-h2-state ${esc(status)}">${esc(RESULT_ES[status])}</span></td></tr>`;
  }).join("");
}
async function loadClassification(force = false) {
  const eventId = currentEventId();
  if (!canManage() || !eventId || !navigator.onLine) { if (!eventId) state.classification = null; renderClassification(); return; }
  if (state.classLoading && !force) return;
  const token = ++state.classToken;
  state.classLoading = true; state.classError = ""; renderClassification();
  try {
    const svc = await services();
    if (typeof svc.callable !== "function") throw new Error("Backend de clasificación no disponible.");
    const response = await svc.callable("getEventClassification", { eventId, clientVersion:"v2-h5-classification-20260925" });
    if (token !== state.classToken || eventId !== currentEventId()) return;
    state.classification = response?.data || null;
    state.classError = "";
  } catch (error) {
    if (token !== state.classToken) return;
    console.error("[MILITOPO H5 organizer]", error);
    state.classification = null;
    state.classError = String(error?.message || "No se pudo calcular la clasificación.");
  } finally {
    if (token === state.classToken) { state.classLoading = false; renderClassification(); }
  }
}

function runnerName(row) {
  const display = String(row.displayName || "").trim();
  const username = String(row.username || "").replace(/^@/, "").trim();
  if (display && username) return `${display} (@${username})`;
  if (display) return display;
  if (username) return `@${username}`;
  if (row.email) return String(row.email);
  return String(row.runnerUid || "Corredor");
}
function sortedRows() {
  const rank = { finished:0, incomplete:1, not_started:2 };
  return [...state.rows].sort((a,b) => {
    const rs = (rank[String(a.status)] ?? 9) - (rank[String(b.status)] ?? 9);
    if (rs) return rs;
    const at = Number(a.finishedAtMs || a.startedAtMs || 0);
    const bt = Number(b.finishedAtMs || b.startedAtMs || 0);
    if (at !== bt) return at - bt;
    return runnerName(a).localeCompare(runnerName(b), "es");
  });
}
function render() {
  ensurePanel();
  if (!state.panel) return;
  const eventId = currentEventId();
  const body = state.panel.querySelector("#m2H2Body");
  const refresh = state.panel.querySelector("#m2H2Refresh");
  if (refresh) refresh.disabled = !canManage() || !eventId || !navigator.onLine;

  if (!canManage()) {
    setText("m2H2Chip", "SIN PERMISOS");
    setText("m2H2Message", "Los resultados del evento solo están disponibles para organizer o super_admin verificados.");
    state.rows = [];
  } else if (!eventId) {
    setText("m2H2Chip", "SIN EVENTO");
    setText("m2H2Message", "Carga o recupera un evento para consultar su histórico.");
    state.rows = [];
  } else {
    setText("m2H2Chip", STATUS_ES[state.eventStatus] || (state.eventStatus ? state.eventStatus.toUpperCase() : "CARGADO"));
    if (state.error) setText("m2H2Message", `⚠️ ${state.error}`);
    else if (!state.rows.length) {
      const live = state.eventStatus === "live";
      setText("m2H2Message", live ? "El evento está EN DIRECTO. Los corredores aparecerán aquí cuando su resultado se consolide." : "Todavía no hay resultados persistentes para este evento.");
    } else if (state.eventStatus === "live") {
      setText("m2H2Message", "Resultados parciales persistentes. Al FINALIZAR el evento se consolidarán también incompletos y corredores que no salieron.");
    } else {
      setText("m2H2Message", "Histórico leído desde Firestore. Estos resultados permanecen disponibles aunque la sesión Live deje de utilizarse.");
    }
  }

  const rows = canManage() && eventId ? sortedRows() : [];
  const counts = rows.reduce((acc,row) => { const key = String(row.status || "not_started"); if (key === "finished") acc.finished++; else if (key === "incomplete") acc.incomplete++; else acc.notStarted++; return acc; }, {finished:0,incomplete:0,notStarted:0});
  setText("m2H2Total", rows.length);
  setText("m2H2Finished", counts.finished);
  setText("m2H2Incomplete", counts.incomplete);
  setText("m2H2NotStarted", counts.notStarted);

  if (!body) return;
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="9" class="m2-h2-empty">${state.error ? "No se pudieron leer los resultados." : "Sin resultados guardados para este evento."}</td></tr>`;
    return;
  }
  body.innerHTML = rows.map(row => {
    const status = ["finished","incomplete","not_started"].includes(String(row.status)) ? String(row.status) : "not_started";
    const run = String(row.runId || "");
    return `<tr>
      <td><strong>${esc(runnerName(row))}</strong></td>
      <td><span class="m2-h2-state ${esc(status)}">${esc(RESULT_ES[status])}</span></td>
      <td class="m2-h2-num">${esc(formatDateTime(row.startedAtMs))}</td>
      <td class="m2-h2-num">${esc(formatDateTime(row.finishedAtMs))}</td>
      <td class="m2-h2-num"><strong>${esc(formatDuration(row.durationMs))}</strong></td>
      <td class="m2-h2-num">${esc(formatDistance(row.trackDistanceM))}</td>
      <td class="m2-h2-num">${Number(row.controlExpectedCount||0)>0?`${esc(Number(row.controlDetectedCount||0))} / ${esc(Number(row.controlExpectedCount||0))}`:"—"}</td>
      <td class="m2-h2-num">${esc(Number(row.trackPointCount || 0))} pts · ${esc(Number(row.trackChunkCount || 0))} bloques</td>
      <td title="${esc(run)}">${esc(run ? run.slice(0,18) + (run.length > 18 ? "…" : "") : "—")}</td>
    </tr>`;
  }).join("");
  renderClassification();
}
function stopResults() {
  try { state.unsubscribe?.(); } catch (_) {}
  state.unsubscribe = null;
  state.bindingKey = "";
}
async function bindResults(force = false) {
  ensurePanel();
  const eventId = currentEventId();
  if (!canManage() || !eventId) {
    stopResults(); state.rows = []; state.error = ""; render(); return;
  }
  const key = `${state.auth.uid}:${eventId}`;
  if (!force && state.unsubscribe && state.bindingKey === key) { render(); return; }
  stopResults();
  state.eventId = eventId;
  state.bindingKey = key;
  state.error = "";
  render();
  try {
    const { firestore } = await services();
    state.unsubscribe = onSnapshot(collection(firestore, "events", eventId, "results"), snap => {
      state.rows = snap.docs.map(d => ({ id:d.id, ...(d.data() || {}) }));
      state.error = "";
      render();
      loadClassification(false);
    }, error => {
      console.error("[MILITOPO H2] resultados", error);
      state.rows = [];
      state.error = String(error?.message || "No se pudieron consultar los resultados de Firestore.");
      render();
    });
  } catch (error) {
    console.error("[MILITOPO H2] bind", error);
    state.error = String(error?.message || error);
    render();
  }
}
function updateFromHeader(event) {
  const next = String(event?.detail?.header?.eventId || document.getElementById("eventId")?.value || "").trim();
  if (next !== state.eventId) {
    state.eventId = next;
    state.rows = [];
    state.error = "";
    state.classification = null; state.classError = ""; state.classView = "general";
    stopResults();
  }
  setTimeout(() => bindResults(), 160);
}
function init() {
  injectStyle();
  ensurePanel();
  addEventListener("militopo:v2-auth-ready", event => {
    state.auth = event?.detail || globalThis.MILITOPO_V2_AUTH || null;
    setTimeout(() => bindResults(true), 160);
  });
  addEventListener("militopo:v2-auth-signed-out", () => {
    state.auth = null; state.rows = []; state.eventId = ""; state.eventStatus = ""; state.classification = null; state.classError = ""; state.classView = "general"; stopResults(); render(); renderClassification();
  });
  addEventListener("militopo:v2-orientation-header", updateFromHeader);
  addEventListener("militopo:v2-cloud-event-applied", event => {
    if (!event?.detail?.ok) return;
    state.eventId = String(event.detail.eventId || state.eventId || "");
    setTimeout(() => bindResults(true), 200);
  });
  addEventListener("militopo:v2-event-status", event => {
    const detail = event?.detail || {};
    if (detail.eventId) state.eventId = String(detail.eventId);
    state.eventStatus = String(detail.status || state.eventStatus || "").toLowerCase();
    render();
    setTimeout(() => bindResults(), 120);
  });
  addEventListener("militopo:v2-event-status-changed", event => {
    const detail = event?.detail || {};
    if (detail.eventId) state.eventId = String(detail.eventId);
    if (detail.to) state.eventStatus = String(detail.to).toLowerCase();
    setTimeout(() => { bindResults(true); loadClassification(true); }, 350);
  });
  addEventListener("online", () => { bindResults(true); loadClassification(true); });
  addEventListener("offline", () => { state.error = "Sin conexión: se mantiene la última vista cargada, pero Firestore no puede actualizarse."; render(); });
  if (globalThis.MILITOPO_V2_AUTH) {
    state.auth = globalThis.MILITOPO_V2_AUTH;
    setTimeout(() => { bindResults(); loadClassification(); }, 220);
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
else init();
