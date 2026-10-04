/* MILITOPO V2 · H6.1 · resultados persistentes + validación de balizas GPS/QR para el organizador.
   Fuente exclusiva: Firestore events/{eventId}/results. No depende del Live RTDB. */
import "../bootstrap.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
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
  classToken: 0,
  mainView: "results"
};
const organizerPlaybackCache = new Map();

function publishOrganizerResults() {
  const eventId = String(state.eventId || currentEventId() || "").trim();
  globalThis.MILITOPO_V2_ORGANIZER_RESULTS = {
    eventId,
    rows: state.rows.map(row => ({ ...row })),
    updatedAt: Date.now()
  };
  globalThis.dispatchEvent(new CustomEvent("militopo:v2-organizer-results", { detail: { eventId, count: state.rows.length } }));
}

function safePlaybackPoint(raw) {
  const lat = Number(raw?.lat), lng = Number(raw?.lng ?? raw?.lon), at = Number(raw?.at), seq = Number(raw?.seq);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(at)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180 || at <= 0) return null;
  return { lat, lng, at, seq: Number.isFinite(seq) ? seq : 0, accuracy: Math.max(0, Number(raw?.accuracy || 0)) };
}

async function loadOrganizerPlaybackResult(input = {}) {
  if (!canManage()) throw new Error("No tienes permisos para cargar tracks de este evento.");
  const eventId = String(input.eventId || currentEventId() || state.eventId || "").trim();
  const runnerUid = String(input.runnerUid || "").trim();
  if (!eventId || !runnerUid) throw new Error("Falta identificar el evento o el corredor.");
  const cacheKey = `${eventId}:${runnerUid}`;
  if (!input.force && organizerPlaybackCache.has(cacheKey)) return organizerPlaybackCache.get(cacheKey);
  const { firestore } = await services();
  const resultRef = doc(firestore, "events", eventId, "results", runnerUid);
  const [resultSnap, chunksSnap] = await Promise.all([
    getDoc(resultRef),
    getDocs(collection(resultRef, "trackChunks"))
  ]);
  if (!resultSnap.exists()) throw new Error("No existe el resultado persistente de este corredor.");
  const chunks = chunksSnap.docs.map(row => ({ index: Math.max(0, Number(row.data()?.index || 0)), points: Array.isArray(row.data()?.points) ? row.data().points : [] })).sort((a,b) => a.index - b.index);
  const track = [];
  for (const chunk of chunks) for (const raw of chunk.points) { const point = safePlaybackPoint(raw); if (point) track.push(point); }
  track.sort((a,b) => (a.seq - b.seq) || (a.at - b.at));
  const payload = { ok:true, eventId, runnerUid, result:{ id: resultSnap.id, ...(resultSnap.data() || {}) }, track };
  organizerPlaybackCache.set(cacheKey, payload);
  return payload;
}

globalThis.MILITOPO_V2_LOAD_ORGANIZER_PLAYBACK_RESULT = loadOrganizerPlaybackResult;

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
    .m2-h2{margin:0;padding:14px;border-radius:18px;border:1px solid rgba(255,255,255,.09);background:linear-gradient(180deg,#1c281d,#151f16);color:#f4f2e7;min-width:0;max-width:100%;box-sizing:border-box}
    .m2-h2-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap}.m2-h2-heading{display:grid;gap:3px}.m2-h2-heading span{font:850 .53rem/1 system-ui;letter-spacing:.11em;color:#96a394}.m2-h2-title{font:950 1.18rem/1 system-ui;letter-spacing:.025em;color:#f3f2e7}.m2-h2-chip{padding:6px 10px;border-radius:999px;border:1px solid rgba(216,180,94,.28);background:rgba(216,180,94,.08);font-size:.68rem;font-weight:900;color:#f1dda6}
    .m2-h2-message{margin:9px 0 11px;font-size:.68rem;line-height:1.4;color:#adb8ac}.m2-h2-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:10px 0 12px}.m2-h2-metric{min-width:0;padding:10px 5px;border-radius:12px;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.03);text-align:center}.m2-h2-metric strong{display:block;font:950 1.08rem/1 system-ui}.m2-h2-metric span{display:block;margin-top:4px;font:850 .49rem/1.08 system-ui;letter-spacing:.045em;color:#99a499}
    .m2-h2-tools{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:5px 0 10px;flex-wrap:wrap}.m2-h2-source{font-size:.61rem;color:#89958a}.m2-h2-refresh{min-height:36px;padding:6px 12px;border-radius:10px;border:1px solid rgba(216,180,94,.28);background:rgba(216,180,94,.09);color:#f5e6b7;font:900 .62rem/1 system-ui;cursor:pointer}.m2-h2-refresh:disabled{opacity:.45;cursor:not-allowed}
    .m2-r4-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:10px 0}.m2-r4-tab{min-height:42px;border:1px solid rgba(255,255,255,.12);border-radius:12px;background:rgba(0,0,0,.16);color:#d7ddd3;font:900 .67rem/1 system-ui;letter-spacing:.045em;cursor:pointer}.m2-r4-tab.active{background:#d8b45e;color:#211708;border-color:#f1d88e}.m2-r4-view[hidden]{display:none!important}
    .m2-h2-table-wrap,.m2-h5-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid rgba(255,255,255,.08);border-radius:13px;max-width:100%}.m2-h2-table{width:100%;border-collapse:collapse;min-width:1180px;background:rgba(0,0,0,.08)}.m2-h2-table th,.m2-h2-table td,.m2-h5-table th,.m2-h5-table td{padding:8px 7px;border-bottom:1px solid rgba(255,255,255,.055);font-size:.61rem;text-align:left;white-space:nowrap}.m2-h2-table th,.m2-h5-table th{font-size:.52rem;color:#d9c792;letter-spacing:.04em;position:sticky;top:0;background:#172219;z-index:2}.m2-h2-table td:first-child,.m2-h5-table td:nth-child(2){white-space:normal;min-width:170px}.m2-h2-state{display:inline-flex;padding:4px 7px;border-radius:999px;border:1px solid rgba(255,255,255,.13);font-size:.53rem;font-weight:900}.m2-h2-state.finished{color:#dcffd0;border-color:rgba(126,220,150,.35);background:rgba(82,145,66,.15)}.m2-h2-state.incomplete{color:#ffe4a8;border-color:rgba(245,204,121,.34);background:rgba(160,114,43,.14)}.m2-h2-state.not_started{color:#d2d8dc;opacity:.72}.m2-h2-empty{padding:18px!important;text-align:center!important;font-size:.70rem!important;color:#9ba69d}.m2-h2-num{font-variant-numeric:tabular-nums}.m2-h2-official{font-weight:950;color:#f4e2ad}.m2-h2-penalty{font-weight:900;color:#ffc98b}
    .m2-h5{margin:0}.m2-h5-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:5px}.m2-h5-title{font:950 .78rem/1 system-ui;letter-spacing:.07em;color:#f3dfa8}.m2-h5-note{margin:7px 0 9px;font-size:.65rem;line-height:1.4;color:#9da79e}.m2-h5-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.m2-h5-tab{min-height:35px;padding:6px 10px;border-radius:999px;border:1px solid rgba(240,193,106,.28);background:rgba(240,193,106,.06);color:#f1ede0;font:900 .61rem/1 system-ui;cursor:pointer}.m2-h5-tab.active{background:#d8b45e;color:#201608;border-color:#f2d58f}.m2-h5-table{width:100%;border-collapse:collapse;min-width:900px}.m2-h5-rank{font-weight:950;color:#f6e2a6}.m2-h5-gap{font-variant-numeric:tabular-nums}.m2-h5-own{background:rgba(240,193,106,.08)}
    @media(max-width:600px){.m2-h2{padding:10px}.m2-h2-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.m2-h2-heading .m2-h2-title{font-size:1.02rem}.m2-r4-tab{min-height:40px;font-size:.61rem}}
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
    <div class="m2-h2-head"><div class="m2-h2-heading"><span>ORGANIZACIÓN · CARRERA</span><div class="m2-h2-title">RESULTADOS Y CLASIFICACIÓN</div></div><div id="m2H2Chip" class="m2-h2-chip">SIN CARRERA</div></div>
    <div id="m2H2Message" class="m2-h2-message">Carga una carrera para consultar sus resultados.</div>
    <div class="m2-h2-metrics">
      <div class="m2-h2-metric"><strong id="m2H2Total">0</strong><span>RESULTADOS</span></div>
      <div class="m2-h2-metric"><strong id="m2H2Finished">0</strong><span>FINALIZADOS</span></div>
      <div class="m2-h2-metric"><strong id="m2H2Incomplete">0</strong><span>INCOMPLETOS</span></div>
      <div class="m2-h2-metric"><strong id="m2H2NotStarted">0</strong><span>NO SALIERON</span></div>
    </div>
    <div class="m2-h2-tools"><div class="m2-h2-source">Resultados persistentes de la carrera</div><button id="m2H2Refresh" class="m2-h2-refresh" type="button">ACTUALIZAR</button></div>
    <div class="m2-r4-tabs" role="tablist" aria-label="Vista de resultados">
      <button type="button" class="m2-r4-tab active" data-r4-results-view="results">RESULTADOS</button>
      <button type="button" class="m2-r4-tab" data-r4-results-view="classification">CLASIFICACIÓN</button>
    </div>
    <section id="m2R4ResultsView" class="m2-r4-view">
      <div class="m2-h2-table-wrap"><table class="m2-h2-table"><thead><tr><th>PARTICIPANTE</th><th>ESTADO</th><th>RECORRIDO</th><th>SALIDA</th><th>LLEGADA</th><th>TIEMPO REAL</th><th>PENALIZACIÓN</th><th>TIEMPO OFICIAL</th><th>BALIZAS</th><th>DISTANCIA</th><th>TRACK GPS</th></tr></thead><tbody id="m2H2Body"><tr><td colspan="11" class="m2-h2-empty">Sin resultados cargados.</td></tr></tbody></table></div>
    </section>
    <section id="m2R4ClassView" class="m2-r4-view" hidden>
      <section class="m2-h5"><div class="m2-h5-head"><div class="m2-h5-title">CLASIFICACIÓN</div><div id="m2H5Chip" class="m2-h2-chip">SIN DATOS</div></div><div id="m2H5Note" class="m2-h5-note">GENERAL incluye a todos los participantes. POR RECORRIDO compara únicamente corredores con el mismo recorrido.</div><div id="m2H5Tabs" class="m2-h5-tabs"></div><div class="m2-h5-table-wrap"><table class="m2-h5-table"><thead><tr><th>PUESTO</th><th>PARTICIPANTE</th><th>PLAZA</th><th>RECORRIDO</th><th>DISTANCIA</th><th>TIEMPO OFICIAL</th><th>DIF. LÍDER</th><th>ESTADO</th></tr></thead><tbody id="m2H5Body"><tr><td colspan="8" class="m2-h2-empty">Sin clasificación cargada.</td></tr></tbody></table></div></section>
    </section>`;
  if (mapPanel?.parentNode) mapPanel.insertAdjacentElement("afterend", panel);
  else if (monitor?.parentNode) monitor.insertAdjacentElement("afterend", panel);
  else {
    const nav = step.querySelector(".nav-row");
    if (nav) nav.insertAdjacentElement("beforebegin", panel); else step.appendChild(panel);
  }
  panel.querySelector("#m2H2Refresh")?.addEventListener("click", () => { bindResults(true); loadClassification(true); });
  panel.addEventListener("click", event => {
    const main = event.target.closest("[data-r4-results-view]");
    if (main) { state.mainView = String(main.dataset.r4ResultsView || "results"); renderMainView(); return; }
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
function renderMainView() {
  if (!state.panel) return;
  const view = state.mainView === "classification" ? "classification" : "results";
  state.mainView = view;
  const results = state.panel.querySelector("#m2R4ResultsView");
  const classification = state.panel.querySelector("#m2R4ClassView");
  if (results) results.hidden = view !== "results";
  if (classification) classification.hidden = view !== "classification";
  state.panel.querySelectorAll("[data-r4-results-view]").forEach(btn => btn.classList.toggle("active", btn.dataset.r4ResultsView === view));
}
function penaltyMs(row = {}) {
  const candidates = [row.penaltyMs, row.controlPenaltyMs, row.totalPenaltyMs, row.discardPenaltyMs, row.discardPenaltyTotalMs];
  for (const value of candidates) { const n = Number(value); if (Number.isFinite(n) && n >= 0) return n; }
  return 0;
}
function officialDurationMs(row = {}) {
  for (const value of [row.officialDurationMs, row.adjustedDurationMs, row.officialTimeMs]) { const n = Number(value); if (Number.isFinite(n) && n >= 0) return n; }
  const real = Number(row.durationMs);
  return Number.isFinite(real) && real >= 0 ? real + penaltyMs(row) : NaN;
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
  renderMainView();
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
  else if (state.classView === "general") note.textContent = "GENERAL asigna puesto a todo corredor que tomó la salida: FINALIZADOS primero e INCOMPLETOS después. Dentro de cada estado se ordena por TIEMPO OFICIAL. NO SALIÓ queda sin puesto.";
  else {
    const route = routes.find(row => row.routeId === state.classView) || {};
    const distance = Number.isFinite(Number(route.routeDistanceKm)) ? `${Number(route.routeDistanceKm).toFixed(2)} km` : "distancia —";
    note.textContent = `${state.classView}: ${route.participantCount || 0} participantes · ${distance} · FINALIZADOS primero e INCOMPLETOS después, ordenados por TIEMPO OFICIAL. NO SALIÓ queda sin puesto.`;
  }

  if (state.classLoading) { body.innerHTML = '<tr><td colspan="8" class="m2-h2-empty">Calculando clasificación…</td></tr>'; return; }
  const rows = classRows();
  if (!rows.length) { body.innerHTML = `<tr><td colspan="8" class="m2-h2-empty">${state.classError ? "No se pudo cargar la clasificación." : "Todavía no hay participantes clasificables."}</td></tr>`; return; }
  body.innerHTML = rows.map(row => {
    const status = ["finished","incomplete","not_started"].includes(String(row.status)) ? String(row.status) : "not_started";
    return `<tr class="${row.runnerUid === state.auth?.uid ? "m2-h5-own" : ""}"><td class="m2-h5-rank">${row.rank ?? "—"}</td><td><strong>${esc(runnerName(row))}</strong></td><td>${esc(row.participantId || "—")}</td><td>${esc(row.routeId || "—")}</td><td>${row.routeDistanceKm == null ? "—" : `${esc(Number(row.routeDistanceKm).toFixed(2))} km`}</td><td><strong>${esc(formatDuration(row.officialDurationMs ?? row.durationMs))}</strong></td><td class="m2-h5-gap">${esc(formatGap(row.gapToLeaderMs))}</td><td><span class="m2-h2-state ${esc(status)}">${esc(RESULT_ES[status])}</span></td></tr>`;
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
    const ao = officialDurationMs(a), bo = officialDurationMs(b);
    if (Number.isFinite(ao) && Number.isFinite(bo) && ao !== bo) return ao - bo;
    if (Number.isFinite(ao) !== Number.isFinite(bo)) return Number.isFinite(ao) ? -1 : 1;
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
    setText("m2H2Message", "Los resultados de la carrera solo están disponibles para ORGANIZADOR o SÚPER ADMINISTRADOR verificados.");
    state.rows = [];
  } else if (!eventId) {
    setText("m2H2Chip", "SIN EVENTO");
    setText("m2H2Message", "Carga una carrera para consultar sus resultados.");
    state.rows = [];
  } else {
    setText("m2H2Chip", STATUS_ES[state.eventStatus] || (state.eventStatus ? state.eventStatus.toUpperCase() : "CARGADO"));
    if (state.error) setText("m2H2Message", `⚠️ ${state.error}`);
    else if (!state.rows.length) {
      const live = state.eventStatus === "live";
      setText("m2H2Message", live ? "La carrera está EN DIRECTO. Los participantes aparecerán aquí cuando su resultado se consolide." : "Todavía no hay resultados guardados para esta carrera.");
    } else if (state.eventStatus === "live") {
      setText("m2H2Message", "Resultados parciales. Al FINALIZAR la carrera se consolidarán también incompletos y participantes que no salieron.");
    } else {
      setText("m2H2Message", "Resultados consolidados y disponibles para consulta permanente.");
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
    body.innerHTML = `<tr><td colspan="11" class="m2-h2-empty">${state.error ? "No se pudieron leer los resultados." : "Sin resultados guardados para esta carrera."}</td></tr>`;
    return;
  }
  body.innerHTML = rows.map(row => {
    const status = ["finished","incomplete","not_started"].includes(String(row.status)) ? String(row.status) : "not_started";
    const penalty = penaltyMs(row);
    const official = officialDurationMs(row);
    const route = String(row.routeId || row.routeCode || row.recorrido || "—");
    return `<tr>
      <td><strong>${esc(runnerName(row))}</strong></td>
      <td><span class="m2-h2-state ${esc(status)}">${esc(RESULT_ES[status])}</span></td>
      <td>${esc(route)}</td>
      <td class="m2-h2-num">${esc(formatDateTime(row.startedAtMs))}</td>
      <td class="m2-h2-num">${esc(formatDateTime(row.finishedAtMs))}</td>
      <td class="m2-h2-num">${esc(formatDuration(row.durationMs))}</td>
      <td class="m2-h2-num m2-h2-penalty">${penalty > 0 ? `+${esc(formatDuration(penalty))}` : "—"}</td>
      <td class="m2-h2-num m2-h2-official">${esc(formatDuration(official))}</td>
      <td class="m2-h2-num">${Number(row.controlExpectedCount||0)>0?`${esc(Number(row.controlDetectedCount ?? row.controlCompletedCount ?? 0))} / ${esc(Number(row.controlExpectedCount||0))}`:"—"}</td>
      <td class="m2-h2-num">${esc(formatDistance(row.trackDistanceM))}</td>
      <td class="m2-h2-num">${esc(Number(row.trackPointCount || 0))} puntos · ${esc(Number(row.trackChunkCount || 0))} bloques</td>
    </tr>`;
  }).join("");
  renderMainView();
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
      publishOrganizerResults();
      render();
      loadClassification(false);
    }, error => {
      console.error("[MILITOPO H2] resultados", error);
      state.rows = [];
      state.error = String(error?.message || "No se pudieron consultar los resultados de Firestore.");
      publishOrganizerResults();
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
    organizerPlaybackCache.clear();
    stopResults();
    publishOrganizerResults();
  }
  setTimeout(() => bindResults(), 160);
}
function init() {
  injectStyle();
  ensurePanel();
  publishOrganizerResults();
  addEventListener("militopo:v2-auth-ready", event => {
    state.auth = event?.detail || globalThis.MILITOPO_V2_AUTH || null;
    setTimeout(() => bindResults(true), 160);
  });
  addEventListener("militopo:v2-auth-signed-out", () => {
    state.auth = null; state.rows = []; state.eventId = ""; state.eventStatus = ""; state.classification = null; state.classError = ""; state.classView = "general"; organizerPlaybackCache.clear(); stopResults(); publishOrganizerResults(); render(); renderClassification();
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

globalThis.MILITOPO_V2_RESULTS_SET_VIEW = view => {
  state.mainView = view === "classification" ? "classification" : "results";
  renderMainView();
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
else init();
