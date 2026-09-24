/* MILITOPO V2 · G5 · Cartografía del mapa Live del organizador.
   Base seleccionable: MAPANT / IGN / AÉREO / PLANO CARRERA.
   Las capas Live (balizas, corredores y trazas) permanecen por encima al cambiar de fondo. */
import "../bootstrap.js";
import { collection, doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const VERSION = "v2-g5-live-cartography-20260924";
const MANAGER_ROLES = new Set(["organizer", "super_admin"]);
const DEFAULT_RACE_PLAN_ID = "el-valle-matizado";

const state = {
  auth: globalThis.MILITOPO_V2_AUTH || null,
  services: null,
  eventId: "",
  ownerUid: "",
  eventStatus: "draft",
  runId: "",
  runStatus: "",
  participants: {},
  checkpoints: {},
  selectedUid: "",
  panel: null,
  map: null,
  baseLayers: {},
  baseLayer: null,
  baseLayerKey: "mapant",
  checkpointLayer: null,
  runnerLayer: null,
  trackLayer: null,
  racePlanLayer: null,
  racePlanDescriptor: null,
  racePlanOwnedUrl: "",
  racePlanLoading: false,
  racePlanError: "",
  runnerMarkers: new Map(),
  trackPoints: [],
  unsubActive: null,
  unsubParticipants: null,
  unsubCheckpoints: null,
  unsubTrack: null,
  mapReady: false,
  fittedKey: "",
  optionsKey: "",
  lastError: ""
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
function fmtAgo(value) {
  const n = Number(value || 0);
  if (!n) return "sin señal";
  const sec = Math.max(0, Math.floor((Date.now() - n) / 1000));
  if (sec < 10) return "ahora";
  if (sec < 60) return `hace ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `hace ${min} min`;
  try { return new Intl.DateTimeFormat("es-ES", {hour:"2-digit", minute:"2-digit"}).format(new Date(n)); }
  catch (_) { return "señal antigua"; }
}
function eventIdNow(detail = null) {
  return String(detail?.eventId || globalThis.MILITOPO_V2_EVENT_STATUS?.eventId || document.getElementById("eventId")?.value || "").trim();
}
async function services() {
  if (!state.services) state.services = await globalThis.MILITOPO_V2.firebase();
  return state.services;
}

function ensureStyles() {
  if (document.getElementById("m2G5MapStyles")) return;
  const style = document.createElement("style");
  style.id = "m2G5MapStyles";
  style.textContent = `
    .m2-g5map{margin:16px 0;padding:16px;border-radius:20px;border:1px solid rgba(126,220,150,.30);background:linear-gradient(180deg,rgba(8,26,14,.94),rgba(5,17,9,.96))}
    .m2-g5map-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .m2-g5map-title{font-weight:900;letter-spacing:.08em;color:#e6f6d7}
    .m2-g5map-chip{padding:6px 11px;border-radius:999px;border:1px solid rgba(126,220,150,.36);font-size:.72rem;font-weight:900}
    .m2-g5map-message{margin:10px 0 10px;font-size:.78rem;line-height:1.45;opacity:.84}
    .m2-g5map-layers{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin:0 0 8px}
    .m2-g5-layer-btn{min-width:0;min-height:34px;padding:6px 4px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:rgba(0,0,0,.23);color:#f7f2e8;font:900 clamp(.54rem,1.75vw,.68rem)/1.05 Arial,sans-serif;letter-spacing:.025em;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .m2-g5-layer-btn.active{background:#d8b45e;color:#201608;border-color:#f2d58f;box-shadow:0 0 0 1px rgba(255,255,255,.08) inset}
    .m2-g5-layer-btn.loading{opacity:.62;cursor:wait}
    .m2-g5map-layerstatus{min-height:18px;margin:0 0 9px;font-size:.64rem;opacity:.76}
    .m2-g5map-layerstatus.err{color:#ffc5b9;opacity:1}
    .m2-g5map-toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;margin-bottom:10px}
    .m2-g5map-select,.m2-g5map-btn{min-height:38px;border-radius:11px;border:1px solid rgba(255,255,255,.15);background:rgba(0,0,0,.22);color:#f7f2e8;padding:0 11px;font:inherit;font-size:.70rem;font-weight:800}
    .m2-g5map-btn{cursor:pointer;white-space:nowrap}.m2-g5map-btn:disabled{opacity:.45;cursor:not-allowed}
    .m2-g5map-canvas{height:410px;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,.12);background:#182017;position:relative}
    .m2-g5map-empty{position:absolute;inset:0;display:grid;place-items:center;padding:24px;text-align:center;font-size:.76rem;opacity:.68;pointer-events:none;z-index:700}
    .m2-g5map-legend{display:flex;gap:12px;flex-wrap:wrap;margin-top:9px;font-size:.62rem;opacity:.75}
    .m2-g5map-legend span{display:inline-flex;align-items:center;gap:5px}
    .m2-g5-runner-dot{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;border:2px solid #f7f2e8;background:#5a9ad6;box-shadow:0 2px 8px rgba(0,0,0,.45);font-size:9px;font-weight:900;color:white}
    .m2-g5-runner-dot.stale{background:#6c746b}.m2-g5-runner-dot.finished{background:#6fa45f}
    .m2-g5-checkpoint{min-width:22px;height:22px;padding:0 4px;border-radius:999px;display:grid;place-items:center;border:2px solid rgba(255,255,255,.9);background:#9b6b2f;color:white;font-size:9px;font-weight:900;box-shadow:0 2px 7px rgba(0,0,0,.38)}
    .m2-g5-checkpoint.start{background:#397d55}.m2-g5-checkpoint.finish{background:#934d4d}
    .m2-g5map .leaflet-control-attribution{font-size:9px}
    @media(max-width:700px){.m2-g5map{padding:13px}.m2-g5map-toolbar{grid-template-columns:1fr 1fr}.m2-g5map-select{grid-column:1/-1}.m2-g5map-canvas{height:340px}.m2-g5map-layers{gap:4px}.m2-g5-layer-btn{padding:6px 2px;letter-spacing:0}}
  `;
  document.head.appendChild(style);
}

function ensurePanel() {
  if (state.panel?.isConnected) return state.panel;
  const monitor = document.getElementById("m2OrganizerLiveMonitor");
  const step = document.getElementById("step1");
  if (!step) return null;
  ensureStyles();
  const panel = document.createElement("section");
  panel.id = "m2OrganizerLiveMap";
  panel.className = "m2-g5map";
  panel.innerHTML = `
    <div class="m2-g5map-head">
      <div class="m2-g5map-title">🗺️ MAPA LIVE V2 · ORGANIZADOR</div>
      <div id="m2G5MapChip" class="m2-g5map-chip">ESPERANDO</div>
    </div>
    <div id="m2G5MapMessage" class="m2-g5map-message">Carga un evento para preparar el mapa Live.</div>
    <div class="m2-g5map-layers" role="tablist" aria-label="Cartografía del mapa Live">
      <button class="m2-g5-layer-btn active" type="button" data-live-layer="mapant">MAPANT</button>
      <button class="m2-g5-layer-btn" type="button" data-live-layer="ign">IGN</button>
      <button class="m2-g5-layer-btn" type="button" data-live-layer="aerial">AÉREO</button>
      <button class="m2-g5-layer-btn" type="button" data-live-layer="custom">PLANO CARRERA</button>
    </div>
    <div id="m2G5LayerStatus" class="m2-g5map-layerstatus">Fondo: MAPANT</div>
    <div class="m2-g5map-toolbar">
      <select id="m2G5RunnerSelect" class="m2-g5map-select" aria-label="Corredor para mostrar su traza"><option value="">TRAZA · NINGÚN CORREDOR</option></select>
      <button id="m2G5FitBtn" class="m2-g5map-btn" type="button">ENCUADRAR TODO</button>
      <button id="m2G5TrackBtn" class="m2-g5map-btn" type="button" disabled>VER TRAZA</button>
    </div>
    <div id="m2G5Map" class="m2-g5map-canvas"><div id="m2G5MapEmpty" class="m2-g5map-empty">Esperando puntos o posiciones GPS…</div></div>
    <div class="m2-g5map-legend"><span>● Corredor con GPS</span><span>○ Señal antigua</span><span>◆ Baliza / salida / llegada</span></div>`;
  if (monitor?.parentNode) monitor.insertAdjacentElement("afterend", panel);
  else {
    const nav = step.querySelector(".nav-row");
    if (nav) nav.insertAdjacentElement("beforebegin", panel); else step.appendChild(panel);
  }
  panel.querySelectorAll("[data-live-layer]").forEach(button => button.addEventListener("click", () => switchBaseLayer(button.dataset.liveLayer).catch(error => {
    console.error("[MILITOPO G5] layer", error);
    state.racePlanError = error?.message || "No se pudo cambiar el fondo cartográfico.";
    renderLayerState();
  })));
  panel.querySelector("#m2G5RunnerSelect")?.addEventListener("change", event => {
    state.selectedUid = String(event.target.value || "");
    bindTrack().catch(() => {});
    renderToolbar();
  });
  panel.querySelector("#m2G5TrackBtn")?.addEventListener("click", () => {
    const select = panel.querySelector("#m2G5RunnerSelect");
    if (!state.selectedUid && select?.options?.length > 1) {
      select.selectedIndex = 1;
      state.selectedUid = String(select.value || "");
    }
    bindTrack().catch(() => {});
  });
  panel.querySelector("#m2G5FitBtn")?.addEventListener("click", () => fitAll(true));
  state.panel = panel;
  render();
  queueMicrotask(() => ensureMap());
  return panel;
}

function createMapantLayer(L) {
  return L.tileLayer.wms("https://raster.trailmap.fi/mapproxy/service", {
    layers:"spain_mapant", styles:"", format:"image/png", transparent:false, version:"1.1.1",
    attribution:"© MapAnt / Trailmap", minZoom:0, maxZoom:22, tileSize:256, crossOrigin:true,
    updateWhenIdle:false, updateWhenZooming:true, keepBuffer:4
  });
}
function buildBaseLayers(L) {
  return {
    mapant:createMapantLayer(L),
    ign:L.tileLayer("https://www.ign.es/wmts/mapa-raster?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=MTN&STYLE=default&TILEMATRIXSET=GoogleMapsCompatible&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}", {
      attribution:"© Instituto Geográfico Nacional", maxNativeZoom:18, maxZoom:22, keepBuffer:6, updateWhenZooming:true
    }),
    aerial:L.tileLayer("https://www.ign.es/wmts/pnoa-ma?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=OI.OrthoimageCoverage&STYLE=default&TILEMATRIXSET=GoogleMapsCompatible&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}", {
      attribution:"© PNOA Máxima Actualidad · IGN", maxNativeZoom:19, maxZoom:22, keepBuffer:8, updateWhenIdle:false, updateWhenZooming:true, crossOrigin:true
    })
  };
}
function ensureMap() {
  if (state.mapReady || !state.panel?.isConnected) return state.map;
  const L = globalThis.L;
  const node = state.panel.querySelector("#m2G5Map");
  if (!L || !node) {
    state.lastError = "El motor de mapa todavía no está disponible.";
    render();
    setTimeout(ensureMap, 500);
    return null;
  }
  state.map = L.map(node, { zoomControl:true, preferCanvas:true, maxZoom:22, zoomSnap:.25, zoomDelta:.5 }).setView([40.2, -3.7], 5);
  state.baseLayers = buildBaseLayers(L);
  state.baseLayer = state.baseLayers.mapant.addTo(state.map);
  state.baseLayerKey = "mapant";
  state.checkpointLayer = L.layerGroup().addTo(state.map);
  state.runnerLayer = L.layerGroup().addTo(state.map);
  state.trackLayer = L.layerGroup().addTo(state.map);
  state.mapReady = true;
  renderLayerState();
  setTimeout(() => state.map?.invalidateSize?.(), 100);
  redrawMap();
  return state.map;
}

function validBounds(bounds) {
  return Array.isArray(bounds) && bounds.length === 2 && bounds.every(pair => Array.isArray(pair) && pair.length === 2 && pair.every(Number.isFinite));
}
function cleanupOwnedRacePlanUrl() {
  if (!state.racePlanOwnedUrl) return;
  try { URL.revokeObjectURL(state.racePlanOwnedUrl); } catch (_) {}
  state.racePlanOwnedUrl = "";
}
async function loadRacePlanDescriptor() {
  const api = globalThis.MILITOPO_ORIENTATION_CUSTOM_MAP;
  if (!api?.getForLive) throw new Error("La biblioteca de planos de Orientación todavía no está preparada.");
  const raw = await api.getForLive({ eventId:state.eventId, fallbackBuiltinId:DEFAULT_RACE_PLAN_ID });
  if (!raw || !validBounds(raw.bounds)) throw new Error("Este evento no tiene un plano de carrera disponible.");
  cleanupOwnedRacePlanUrl();
  let url = raw.url || "";
  if (!url && raw.blob) {
    url = URL.createObjectURL(raw.blob);
    state.racePlanOwnedUrl = url;
  }
  if (!url) throw new Error("No se pudo preparar la imagen del plano de carrera.");
  state.racePlanDescriptor = { ...raw, url, bounds:raw.bounds.map(pair => pair.map(Number)) };
  return state.racePlanDescriptor;
}
function removeCurrentBaseLayer() {
  if (!state.map) return;
  if (state.baseLayer && state.map.hasLayer(state.baseLayer)) state.map.removeLayer(state.baseLayer);
  state.baseLayer = null;
  if (state.racePlanLayer && state.map.hasLayer(state.racePlanLayer)) state.map.removeLayer(state.racePlanLayer);
  state.racePlanLayer = null;
}
function bringLiveLayersToFront() {
  [state.trackLayer, state.checkpointLayer, state.runnerLayer].forEach(group => {
    try { group?.eachLayer?.(layer => layer?.bringToFront?.()); } catch (_) {}
  });
}
async function switchBaseLayer(key) {
  if (!state.mapReady) ensureMap();
  if (!state.map) return false;
  const wanted = ["mapant","ign","aerial","custom"].includes(String(key)) ? String(key) : "mapant";
  if (wanted === state.baseLayerKey && (wanted !== "custom" || state.racePlanLayer)) return true;
  const previous = state.baseLayerKey;
  state.racePlanError = "";
  if (wanted === "custom") {
    state.racePlanLoading = true;
    renderLayerState();
    try {
      const descriptor = await loadRacePlanDescriptor();
      removeCurrentBaseLayer();
      state.racePlanLayer = globalThis.L.imageOverlay(descriptor.url, descriptor.bounds, { opacity:1, interactive:false, pane:"tilePane" }).addTo(state.map);
      state.baseLayerKey = "custom";
      bringLiveLayersToFront();
      renderLayerState();
      return true;
    } catch (error) {
      state.racePlanError = error?.message || "No se pudo cargar el plano de carrera.";
      state.baseLayerKey = previous;
      renderLayerState();
      return false;
    } finally {
      state.racePlanLoading = false;
      renderLayerState();
    }
  }
  const next = state.baseLayers[wanted];
  if (!next) return false;
  removeCurrentBaseLayer();
  state.baseLayer = next.addTo(state.map);
  state.baseLayerKey = wanted;
  bringLiveLayersToFront();
  renderLayerState();
  return true;
}
function renderLayerState() {
  const panel = state.panel;
  if (!panel) return;
  panel.querySelectorAll("[data-live-layer]").forEach(button => {
    const key = String(button.dataset.liveLayer || "");
    button.classList.toggle("active", key === state.baseLayerKey);
    button.classList.toggle("loading", key === "custom" && state.racePlanLoading);
    button.disabled = key === "custom" && state.racePlanLoading;
  });
  const status = panel.querySelector("#m2G5LayerStatus");
  if (!status) return;
  status.className = `m2-g5map-layerstatus${state.racePlanError ? " err" : ""}`;
  if (state.racePlanError) status.textContent = `PLANO CARRERA: ${state.racePlanError}`;
  else if (state.racePlanLoading) status.textContent = "PLANO CARRERA: preparando cartografía georreferenciada…";
  else if (state.baseLayerKey === "custom") {
    const d = state.racePlanDescriptor || {};
    status.textContent = `Fondo: PLANO CARRERA · ${d.name || "plano propio"}${d.fallback ? " · prueba integrada" : ""}`;
  } else status.textContent = `Fondo: ${{mapant:"MAPANT",ign:"IGN",aerial:"AÉREO"}[state.baseLayerKey] || "MAPANT"}`;
}

function validCoord(lat, lng) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Number(lat) >= -90 && Number(lat) <= 90 && Number(lng) >= -180 && Number(lng) <= 180;
}
function participantName(row = {}) {
  return String(row.displayName || row.username || row.email || row.uid || "Corredor").trim();
}
function participantStatus(row = {}) {
  const s = String(row.status || "not_started").toLowerCase();
  return s === "started" ? "racing" : s;
}

function redrawCheckpoints() {
  if (!state.mapReady || !state.checkpointLayer) return;
  const L = globalThis.L;
  state.checkpointLayer.clearLayers();
  Object.values(state.checkpoints || {}).forEach(cp => {
    const lat = Number(cp.lat), lng = Number(cp.lon ?? cp.lng);
    if (!validCoord(lat, lng)) return;
    const type = String(cp.type || "BALIZA").toUpperCase();
    const cls = type === "SALIDA" ? "start" : type === "LLEGADA" ? "finish" : "";
    const label = type === "SALIDA" ? "S" : type === "LLEGADA" ? "L" : String(cp.checkpointId || cp.id || "P").replace(/^P/i, "").slice(-3);
    const icon = L.divIcon({
      className: "",
      html: `<div class="m2-g5-checkpoint ${cls}">${esc(label)}</div>`,
      iconSize: [24,24], iconAnchor: [12,12]
    });
    const marker = L.marker([lat, lng], { icon, keyboard:false });
    marker.bindPopup(`<strong>${esc(cp.checkpointId || "Punto")}</strong><br>${esc(type)}${cp.description ? `<br>${esc(cp.description)}` : ""}`);
    marker.addTo(state.checkpointLayer);
  });
}

function redrawRunners() {
  if (!state.mapReady || !state.runnerLayer) return;
  const L = globalThis.L;
  state.runnerLayer.clearLayers();
  state.runnerMarkers.clear();
  const now = Date.now();
  Object.entries(state.participants || {}).forEach(([uid, row]) => {
    const gps = row?.gps || {};
    const lat = Number(gps.lat), lng = Number(gps.lng);
    if (!validCoord(lat, lng)) return;
    const age = Math.max(0, now - Number(gps.updatedAt || 0));
    const stale = age > 30000 || gps.active !== true;
    const finished = participantStatus(row) === "finished";
    const initial = participantName(row).slice(0,1).toUpperCase() || "•";
    const icon = L.divIcon({
      className: "",
      html: `<div class="m2-g5-runner-dot ${finished ? "finished" : stale ? "stale" : ""}">${esc(initial)}</div>`,
      iconSize: [22,22], iconAnchor: [11,11]
    });
    const marker = L.marker([lat,lng], { icon, keyboard:false });
    marker.bindPopup(`<strong>${esc(participantName(row))}</strong><br>${esc(participantStatus(row).toUpperCase())}<br>GPS ±${Math.round(Number(gps.accuracy || 0))} m · ${esc(fmtAgo(gps.updatedAt))}`);
    marker.addTo(state.runnerLayer);
    state.runnerMarkers.set(uid, marker);
  });
}

function redrawTrack() {
  if (!state.mapReady || !state.trackLayer) return;
  const L = globalThis.L;
  state.trackLayer.clearLayers();
  const points = state.trackPoints.filter(p => validCoord(p.lat, p.lng)).map(p => [Number(p.lat), Number(p.lng)]);
  if (points.length < 2) return;
  const line = L.polyline(points, { weight:4, opacity:.82, lineJoin:"round" }).addTo(state.trackLayer);
  if (state.selectedUid) {
    const row = state.participants?.[state.selectedUid] || {};
    line.bindPopup(`Traza de <strong>${esc(participantName(row))}</strong> · ${points.length} puntos`);
  }
}

function redrawMap() {
  if (!state.mapReady) { ensureMap(); return; }
  redrawCheckpoints();
  redrawRunners();
  redrawTrack();
  bringLiveLayersToFront();
  updateEmpty();
  fitAll(false);
}

function allLatLngs() {
  const list = [];
  Object.values(state.checkpoints || {}).forEach(cp => {
    const lat = Number(cp.lat), lng = Number(cp.lon ?? cp.lng);
    if (validCoord(lat,lng)) list.push([lat,lng]);
  });
  Object.values(state.participants || {}).forEach(row => {
    const gps = row?.gps || {};
    if (validCoord(gps.lat,gps.lng)) list.push([Number(gps.lat),Number(gps.lng)]);
  });
  state.trackPoints.forEach(p => { if (validCoord(p.lat,p.lng)) list.push([Number(p.lat),Number(p.lng)]); });
  return list;
}
function fitAll(force = false) {
  if (!state.mapReady || !state.map) return;
  const points = allLatLngs();
  if (!points.length) return;
  const key = `${state.eventId}|${state.runId}|${points.length ? "has" : "none"}`;
  if (!force && state.fittedKey === key) return;
  try {
    if (points.length === 1) state.map.setView(points[0], 15);
    else state.map.fitBounds(points, { padding:[28,28], maxZoom:17 });
    state.fittedKey = key;
  } catch (_) {}
}
function updateEmpty() {
  const empty = state.panel?.querySelector("#m2G5MapEmpty");
  if (!empty) return;
  const hasPoints = allLatLngs().length > 0;
  empty.style.display = hasPoints ? "none" : "grid";
  if (!hasPoints) empty.textContent = state.runId ? "Esperando la primera posición GPS…" : "El mapa mostrará las balizas y los corredores cuando haya datos disponibles.";
}

function renderToolbar() {
  const panel = state.panel;
  if (!panel) return;
  const select = panel.querySelector("#m2G5RunnerSelect");
  const trackBtn = panel.querySelector("#m2G5TrackBtn");
  if (!select || !trackBtn) return;
  const previous = state.selectedUid;
  const rows = Object.entries(state.participants || {})
    .filter(([,row]) => row && row.active !== false)
    .sort((a,b) => participantName(a[1]).localeCompare(participantName(b[1]), "es"));
  const optionsKey = rows.map(([uid,row]) => `${uid}:${participantName(row)}`).join("|");
  if (optionsKey !== state.optionsKey) {
    state.optionsKey = optionsKey;
    select.innerHTML = `<option value="">TRAZA · NINGÚN CORREDOR</option>` + rows.map(([uid,row]) => `<option value="${esc(uid)}">${esc(participantName(row))}</option>`).join("");
    if (previous && rows.some(([uid]) => uid === previous)) select.value = previous;
    else if (state.selectedUid) { state.selectedUid = ""; select.value = ""; }
  }
  trackBtn.disabled = !state.runId || rows.length === 0;
  trackBtn.textContent = state.selectedUid ? "ACTUALIZAR TRAZA" : "VER TRAZA";
}

function render() {
  const panel = ensurePanel();
  if (!panel) return;
  const chip = panel.querySelector("#m2G5MapChip");
  const message = panel.querySelector("#m2G5MapMessage");
  if (!canManage()) {
    chip.textContent = "SIN PERMISOS";
    message.textContent = "Se necesita rol organizer o super_admin verificado.";
    return;
  }
  const withGps = Object.values(state.participants || {}).filter(row => validCoord(row?.gps?.lat,row?.gps?.lng)).length;
  chip.textContent = state.runId ? (state.runStatus === "finished" ? "FINALIZADO" : "EN DIRECTO") : String(state.eventStatus || "ESPERANDO").toUpperCase();
  if (state.lastError) message.textContent = state.lastError;
  else if (!state.eventId) message.textContent = "Carga un evento para preparar el mapa Live.";
  else if (!state.runId) message.textContent = "Mapa preparado. Al iniciar el evento aparecerán aquí las posiciones GPS de los corredores.";
  else message.textContent = withGps
    ? `${withGps} corredor${withGps === 1 ? "" : "es"} con posición GPS. Selecciona uno para visualizar su traza completa.`
    : "Sesión conectada. Esperando la primera posición GPS de los corredores.";
  renderToolbar();
  renderLayerState();
  updateEmpty();
}

function clearRunListeners() {
  try { state.unsubParticipants?.(); } catch (_) {}
  try { state.unsubTrack?.(); } catch (_) {}
  state.unsubParticipants = null;
  state.unsubTrack = null;
  state.participants = {};
  state.trackPoints = [];
  state.selectedUid = "";
  state.optionsKey = "";
}
function clearAllListeners() {
  clearRunListeners();
  try { state.unsubActive?.(); } catch (_) {}
  try { state.unsubCheckpoints?.(); } catch (_) {}
  state.unsubActive = null;
  state.unsubCheckpoints = null;
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

async function bindCheckpoints() {
  try { state.unsubCheckpoints?.(); } catch (_) {}
  state.unsubCheckpoints = null;
  state.checkpoints = {};
  if (!state.eventId) { redrawMap(); return; }
  const { firestore } = await services();
  state.unsubCheckpoints = onSnapshot(collection(firestore, "events", state.eventId, "checkpoints"), snap => {
    const next = {};
    snap.forEach(cpDoc => {
      const data = cpDoc.data() || {};
      next[cpDoc.id] = { checkpointId:cpDoc.id, ...data };
    });
    state.checkpoints = next;
    state.lastError = "";
    render(); redrawMap();
  }, error => {
    console.warn("[MILITOPO G5] checkpoints", error);
    state.lastError = "No se pudieron cargar las balizas del evento.";
    render();
  });
}

async function bindParticipants() {
  try { state.unsubParticipants?.(); } catch (_) {}
  state.unsubParticipants = null;
  state.participants = {};
  state.trackPoints = [];
  try { state.unsubTrack?.(); } catch (_) {}
  state.unsubTrack = null;
  state.selectedUid = "";
  render(); redrawMap();
  if (!state.runId || !state.ownerUid || !state.eventId) return;
  const { database } = await services();
  const path = `v2/live/${state.ownerUid}/${state.eventId}/runs/${state.runId}/participants`;
  state.unsubParticipants = onValue(ref(database, path), snap => {
    state.participants = snap.exists() ? (snap.val() || {}) : {};
    state.lastError = "";
    render(); redrawMap();
  }, error => {
    console.error("[MILITOPO G5] participants", error);
    state.lastError = "No se pudieron recibir las posiciones Live.";
    render();
  });
}

async function bindTrack() {
  try { state.unsubTrack?.(); } catch (_) {}
  state.unsubTrack = null;
  state.trackPoints = [];
  redrawMap();
  if (!state.selectedUid || !state.runId || !state.ownerUid || !state.eventId) return;
  const { database } = await services();
  const path = `v2/live/${state.ownerUid}/${state.eventId}/runs/${state.runId}/tracks/${state.selectedUid}`;
  state.unsubTrack = onValue(ref(database, path), snap => {
    const raw = snap.exists() ? (snap.val() || {}) : {};
    state.trackPoints = Object.values(raw).filter(Boolean).sort((a,b) => Number(a.seq || a.at || 0) - Number(b.seq || b.at || 0));
    redrawMap();
  }, error => {
    console.error("[MILITOPO G5] track", error);
    state.lastError = "No se pudo cargar la traza del corredor seleccionado.";
    render();
  });
}

async function bindEvent(eventId) {
  const nextId = String(eventId || "").trim();
  if (!nextId || !canManage()) return;
  if (nextId === state.eventId && state.unsubActive) return;
  clearAllListeners();
  state.eventId = nextId;
  state.ownerUid = "";
  state.runId = "";
  state.runStatus = "";
  state.fittedKey = "";
  state.lastError = "";
  state.racePlanError = "";
  render(); redrawMap();
  try {
    state.ownerUid = await resolveOwner(nextId);
    await bindCheckpoints();
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
      if (changed) bindParticipants().catch(() => {});
    }, error => {
      console.error("[MILITOPO G5] activeRun", error);
      state.lastError = "No se pudo conectar el mapa con la sesión Live V2.";
      render();
    });
  } catch (error) {
    console.error("[MILITOPO G5] bindEvent", error);
    state.lastError = "No se pudo preparar el mapa Live para este evento.";
    render();
  }
}

function onAuth(event) {
  state.auth = event?.detail || globalThis.MILITOPO_V2_AUTH || null;
  ensurePanel();
  const id = eventIdNow();
  if (id) bindEvent(id);
}
function onCustomMapChanged(event) {
  const changedEventId = String(event?.detail?.eventId || "").trim();
  if (changedEventId && state.eventId && changedEventId !== state.eventId) return;
  state.racePlanDescriptor = null;
  state.racePlanError = "";
  const wasCustom = state.baseLayerKey === "custom";
  if (wasCustom && state.mapReady && state.map) {
    removeCurrentBaseLayer();
    state.baseLayer = state.baseLayers.mapant?.addTo(state.map) || null;
    state.baseLayerKey = "mapant";
    bringLiveLayersToFront();
  }
  cleanupOwnedRacePlanUrl();
  if (wasCustom) switchBaseLayer("custom").catch(() => {});
  else renderLayerState();
}
function init() {
  ensurePanel();
  globalThis.addEventListener("militopo:v2-auth-ready", onAuth);
  globalThis.addEventListener("militopo:v2-orientation-custom-map", onCustomMapChanged);
  ["militopo:v2-event-status", "militopo:v2-event-status-changed", "militopo:v2-live-run-changed"].forEach(name => {
    globalThis.addEventListener(name, event => {
      const d = event?.detail || {};
      const status = d.to || d.status;
      if (status) state.eventStatus = String(status).toLowerCase();
      const id = eventIdNow(d);
      if (id) bindEvent(id);
      render();
    });
  });
  globalThis.addEventListener("online", () => { const id = eventIdNow(); if (id) bindEvent(id); });
  globalThis.addEventListener("resize", () => state.map?.invalidateSize?.());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") setTimeout(() => state.map?.invalidateSize?.(), 120);
  });
  if (globalThis.MILITOPO_V2_AUTH) onAuth({ detail:globalThis.MILITOPO_V2_AUTH });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
else init();
