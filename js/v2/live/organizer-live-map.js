/* MILITOPO V2 · G5 · Cartografía del mapa Live del organizador.
   Base seleccionable: MAPANT / IGN / AÉREO / PLANO CARRERA.
   Las capas Live (balizas, corredores y trazas) permanecen por encima al cambiar de fondo. */
import "../bootstrap.js";
import { collection, doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const VERSION = "v2-r9k-cartografia-hd-20261010";
const MANAGER_ROLES = new Set(["organizer", "super_admin"]);
const DEFAULT_RACE_PLAN_ID = "el-valle-matizado";
const EVENT_STATUS_ES = {
  draft:"BORRADOR", prepared:"PREPARADO", published:"PUBLICADO", live:"EN DIRECTO", finished:"FINALIZADO", archived:"ARCHIVADO"
};
const PARTICIPANT_STATUS_ES = {
  not_started:"SIN SALIR", ready:"PREPARADO", racing:"EN CARRERA", started:"EN CARRERA", finished:"FINALIZADO", removed:"RETIRADO"
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
  runnerMotion: new Map(),
  runnerColors: new Map(),
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
    .m2-g5map{margin:0;padding:14px;border-radius:18px;border:1px solid rgba(255,255,255,.09);background:linear-gradient(180deg,#1c281d,#151f16);color:#f4f2e7;min-width:0;max-width:100%;box-sizing:border-box}
    .m2-g5map-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
    .m2-g5map-title{font:950 .76rem/1 system-ui,-apple-system,sans-serif;letter-spacing:.09em;color:#eef2e5}
    .m2-g5map-chip{padding:6px 11px;border-radius:999px;border:1px solid rgba(126,220,150,.36);font-size:.72rem;font-weight:900}
    .m2-g5map-message{margin:9px 0 10px;font-size:.66rem;line-height:1.35;color:#aeb7ac}
    .m2-g5map-layers{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin:0 0 8px}
    .m2-g5-layer-btn{min-width:0;min-height:34px;padding:6px 4px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:rgba(0,0,0,.23);color:#f7f2e8;font:900 clamp(.54rem,1.75vw,.68rem)/1.05 Arial,sans-serif;letter-spacing:.025em;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .m2-g5-layer-btn.active{background:#d8b45e;color:#201608;border-color:#f2d58f;box-shadow:0 0 0 1px rgba(255,255,255,.08) inset}
    .m2-g5-layer-btn.loading{opacity:.62;cursor:wait}
    .m2-g5map-layerstatus{min-height:18px;margin:0 0 9px;font-size:.64rem;opacity:.76}
    .m2-g5map-layerstatus.err{color:#ffc5b9;opacity:1}
    .m2-g5map-toolbar{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;margin-bottom:10px}
    .m2-g5map-select,.m2-g5map-btn{min-height:38px;border-radius:11px;border:1px solid rgba(255,255,255,.15);background:rgba(0,0,0,.22);color:#f7f2e8;padding:0 11px;font:inherit;font-size:.70rem;font-weight:800}
    .m2-g5map-btn{cursor:pointer;white-space:nowrap}.m2-g5map-btn:disabled{opacity:.45;cursor:not-allowed}
    .m2-g5map-canvas{height:430px;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.10);background:#182017;position:relative}
    .m2-g5map-empty{position:absolute;inset:0;display:grid;place-items:center;padding:24px;text-align:center;font-size:.76rem;opacity:.68;pointer-events:none;z-index:700}
    .m2-g5map-legend{display:flex;gap:12px;flex-wrap:wrap;margin-top:9px;font-size:.62rem;opacity:.75}
    .m2-g5map-legend span{display:inline-flex;align-items:center;gap:5px}
    .m2-g5-runner-wrap,.m2-g5-checkpoint-wrap{background:transparent!important;border:0!important;overflow:visible!important}
    .m2-g5-runner{position:relative;width:32px;height:32px;display:grid;place-items:center;filter:drop-shadow(0 5px 8px rgba(0,0,0,.58))}
    .m2-g5-runner svg{width:30px;height:30px;overflow:visible}.m2-g5-runner .nav-body{fill:var(--runner-color,#59a6ff);stroke:#fff;stroke-width:1.8;stroke-linejoin:round}.m2-g5-runner .nav-core{fill:#111914}.m2-g5-runner .nav-shadow{fill:rgba(0,0,0,.34)}
    .m2-g5-runner.stale{opacity:.58;filter:drop-shadow(0 4px 7px rgba(0,0,0,.5))}.m2-g5-runner.finished{filter:drop-shadow(0 0 8px rgba(255,255,255,.52)) drop-shadow(0 5px 8px rgba(0,0,0,.58))}
    .m2-g5-runner-label{position:absolute;left:27px;top:3px;max-width:120px;padding:3px 6px;border:2px solid #fff;border-radius:9px;background:var(--runner-color,#59a6ff);color:#fff;font:950 9px/1.05 Arial,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 4px 12px rgba(0,0,0,.46);text-shadow:0 1px 2px rgba(0,0,0,.55)}
    .m2-g5-runner-label small{display:block;margin-top:2px;font-size:7px;font-weight:800;opacity:.92}
    .m2-g5-checkpoint{position:relative;width:30px;height:30px;display:grid;place-items:center;filter:drop-shadow(0 4px 7px rgba(0,0,0,.48))}.m2-g5-checkpoint svg{width:30px;height:30px;overflow:visible}.m2-g5-checkpoint text{fill:#fff;font:950 8px/1 "Courier New",monospace;paint-order:stroke;stroke:rgba(0,0,0,.62);stroke-width:2px}.m2-g5-checkpoint.control .cp-ring{fill:rgba(17,30,20,.94);stroke:#f0cf82;stroke-width:3}.m2-g5-checkpoint.control .cp-core{fill:#f0cf82}.m2-g5-checkpoint.start .cp-start{fill:#357b54;stroke:#effff4;stroke-width:2.6;stroke-linejoin:round}.m2-g5-checkpoint.finish .cp-finish-outer{fill:#3b2020;stroke:#fff1ed;stroke-width:3}.m2-g5-checkpoint.finish .cp-finish-inner{fill:none;stroke:#df746d;stroke-width:2.3}
    .m2-g5map .leaflet-control-attribution{font-size:9px}
    @media(max-width:700px){.m2-g5map{padding:10px}.m2-g5map-toolbar{grid-template-columns:1fr 1fr}.m2-g5map-select{grid-column:1/-1}.m2-g5map-canvas{height:360px}.m2-g5map-layers{gap:4px}.m2-g5-layer-btn{padding:6px 2px;letter-spacing:0}}
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
      <div class="m2-g5map-title">MAPA EN DIRECTO</div>
      <div id="m2G5MapChip" class="m2-g5map-chip">ESPERANDO</div>
    </div>
    <div id="m2G5MapMessage" class="m2-g5map-message">Carga una carrera para preparar el mapa de seguimiento.</div>
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
    <div class="m2-g5map-legend"><span>➤ Corredor · color e identificación propios</span><span>△ Salida</span><span>◎ Baliza</span><span>⦿ Llegada</span></div>`;
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
function createIgnHdHybridLayer(L, kind, options={}) {
  const key=String(kind||"").toLowerCase();
  const aerial=key==="aerial"||key==="pnoa"||key==="aereo"||key==="aéreo";
  const maxZoom=Number(options.maxZoom||25);
  const nativeMax=Number(options.maxNativeZoom||(aerial?19:20));
  const attribution=aerial?"© PNOA Máxima Actualidad · IGN":"© Instituto Geográfico Nacional";
  const tms=L.tileLayer(aerial
    ? "https://tms-pnoa-ma.idee.es/1.0.0/pnoa-ma/{z}/{x}/{-y}.jpeg"
    : "https://tms-mapa-raster.ign.es/1.0.0/mapa-raster/{z}/{x}/{-y}.jpeg", {
      attribution,maxNativeZoom:nativeMax,maxZoom,keepBuffer:aerial?8:6,updateWhenIdle:false,updateWhenZooming:true,zIndex:200
    });
  const hd=L.tileLayer.wms(aerial?"https://www.ign.es/wms-inspire/pnoa-ma":"https://www.ign.es/wms-inspire/mapa-raster", {
    layers:aerial?"OI.OrthoimageCoverage":"mtn_rasterizado",styles:"",format:"image/jpeg",transparent:false,version:"1.3.0",
    attribution,maxZoom,keepBuffer:4,updateWhenIdle:false,updateWhenZooming:true,zIndex:210
  });
  const hdGetTileUrl=hd.getTileUrl.bind(hd);
  hd.getTileUrl=coords=>hdGetTileUrl(coords).replace(/([?&](?:width|height)=)\d+/gi,(_,prefix)=>`${prefix}512`);
  const group=L.layerGroup([tms]);
  let hostMap=null;
  const hdFrom=nativeMax+1;
  const sync=()=>{
    if(!hostMap)return;
    if(Number(hostMap.getZoom?.()||0)>=hdFrom){if(!group.hasLayer(hd))group.addLayer(hd)}
    else if(group.hasLayer(hd))group.removeLayer(hd);
  };
  group.on("add",()=>{hostMap=group._map||null;hostMap?.on?.("zoomend",sync);hostMap?.on?.("moveend",sync);requestAnimationFrame(sync)});
  group.on("remove",()=>{hostMap?.off?.("zoomend",sync);hostMap?.off?.("moveend",sync);if(group.hasLayer(hd))group.removeLayer(hd);hostMap=null});
  return group;
}
function buildBaseLayers(L) {
  return {
    mapant:createMapantLayer(L),
    ign:createIgnHdHybridLayer(L,"ign",{maxNativeZoom:20,maxZoom:25}),
    aerial:createIgnHdHybridLayer(L,"aerial",{maxNativeZoom:19,maxZoom:25})
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
  state.map = L.map(node, { zoomControl:true, preferCanvas:true, maxZoom:25, zoomSnap:.25, zoomDelta:.5 }).setView([40.2, -3.7], 5);
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
function participantStatusLabel(row = {}) {
  const key = participantStatus(row);
  return PARTICIPANT_STATUS_ES[key] || "SIN SALIR";
}
function runnerColor(uid = "") {
  const key=String(uid||"");if(state.runnerColors.has(key))return state.runnerColors.get(key);
  const palette=["#4ea3ff","#ff7a59","#7fd35b","#d46cff","#f2c14e","#2fd0c8","#ff5e9b","#8b9cff","#ff9d3d","#5edb8a","#e66b6b","#4dc7f2"];
  const used=new Set(state.runnerColors.values());let color=palette.find(item=>!used.has(item));
  if(!color){let hash=2166136261;for(const ch of key){hash^=ch.charCodeAt(0);hash=Math.imul(hash,16777619)}const hue=Math.abs(hash>>>0)%360;color=`hsl(${hue} 74% 56%)`;}
  state.runnerColors.set(key,color);return color;
}
function bearingDeg(a,b){
  if(!a||!b)return 0;const rad=v=>Number(v)*Math.PI/180,deg=v=>v*180/Math.PI;
  const lat1=rad(a.lat),lat2=rad(b.lat),dLon=rad(Number(b.lng)-Number(a.lng));
  const y=Math.sin(dLon)*Math.cos(lat2),x=Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);
  const out=(deg(Math.atan2(y,x))+360)%360;return Number.isFinite(out)?out:0;
}
function approxDistanceM(a,b){
  if(!a||!b)return 0;const dy=(Number(b.lat)-Number(a.lat))*111320,dx=(Number(b.lng)-Number(a.lng))*111320*Math.cos(Number(a.lat)*Math.PI/180);return Math.hypot(dx,dy);
}
function runnerBearing(uid,gps,lat,lng){
  const explicit=Number(gps?.heading??gps?.course??gps?.bearing);const prev=state.runnerMotion.get(uid);let bearing=Number.isFinite(explicit)&&explicit>=0?explicit:(Number(prev?.bearing)||0);
  const current={lat,lng};if(prev&&approxDistanceM(prev,current)>=2.5)bearing=bearingDeg(prev,current);
  state.runnerMotion.set(uid,{lat,lng,bearing});return bearing;
}
function runnerMeta(row={}){
  const slot=String(row.slotId||row.participantSlot||row.plaza||"").trim(),route=String(row.routeId||row.routeCode||row.recorrido||"").trim();return [slot,route].filter(Boolean).join(" · ");
}

function redrawCheckpoints() {
  if (!state.mapReady || !state.checkpointLayer) return;
  const L = globalThis.L;
  state.checkpointLayer.clearLayers();
  Object.values(state.checkpoints || {}).forEach(cp => {
    const lat = Number(cp.lat), lng = Number(cp.lon ?? cp.lng);
    if (!validCoord(lat, lng)) return;
    const type = String(cp.type || "BALIZA").toUpperCase();
    const key=String(cp.checkpointId||cp.id||"B").trim().toUpperCase();
    const label=type==="SALIDA"?"S":type==="LLEGADA"?"L":(key.length>4?key.slice(-4):key);
    let svg="",kind="control";
    if(type==="SALIDA"){kind="start";svg=`<svg viewBox="0 0 40 40" aria-hidden="true"><path class="cp-start" d="M20 4 36 34H4Z"/><text x="20" y="28" text-anchor="middle">S</text></svg>`;}
    else if(type==="LLEGADA"){kind="finish";svg=`<svg viewBox="0 0 40 40" aria-hidden="true"><circle class="cp-finish-outer" cx="20" cy="20" r="16"/><circle class="cp-finish-inner" cx="20" cy="20" r="10"/><text x="20" y="24" text-anchor="middle">L</text></svg>`;}
    else svg=`<svg viewBox="0 0 40 40" aria-hidden="true"><circle class="cp-ring" cx="20" cy="20" r="16"/><circle class="cp-core" cx="20" cy="20" r="3"/><text x="20" y="12" text-anchor="middle">${esc(label)}</text></svg>`;
    const icon=L.divIcon({className:"m2-g5-checkpoint-wrap",html:`<div class="m2-g5-checkpoint ${kind}">${svg}</div>`,iconSize:[30,30],iconAnchor:[15,15]});
    const marker = L.marker([lat, lng], { icon, keyboard:false });
    marker.bindPopup(`<strong>${esc(type === "SALIDA" ? "SALIDA" : type === "LLEGADA" ? "LLEGADA" : key)}</strong><br>${esc(type)}${cp.description ? `<br>${esc(cp.description)}` : ""}`);
    marker.addTo(state.checkpointLayer);
  });
}

function redrawRunners() {
  if (!state.mapReady || !state.runnerLayer) return;
  const L = globalThis.L;
  state.runnerLayer.clearLayers();state.runnerMarkers.clear();
  const now = Date.now();
  Object.entries(state.participants || {}).forEach(([uid, row]) => {
    const gps = row?.gps || {},lat = Number(gps.lat), lng = Number(gps.lng);
    if (!validCoord(lat, lng)) return;
    const age = Math.max(0, now - Number(gps.updatedAt || 0)),stale = age > 30000 || gps.active !== true,finished = participantStatus(row) === "finished";
    const color=runnerColor(uid),name=participantName(row),meta=runnerMeta(row),bearing=runnerBearing(uid,gps,lat,lng);
    const icon=L.divIcon({className:"m2-g5-runner-wrap",html:`<div class="m2-g5-runner ${finished?"finished":stale?"stale":""}" style="--runner-color:${color}"><svg viewBox="0 0 36 36" aria-hidden="true"><g transform="rotate(${bearing.toFixed(1)} 18 18)"><path class="nav-shadow" d="M18 2.5 31 30.5 18 25.5 5 30.5Z" transform="translate(1 1.5)"/><path class="nav-body" d="M18 2.5 31 30.5 18 25.5 5 30.5Z"/><path class="nav-core" d="M18 9.5 23.6 23.5 18 21.4 12.4 23.5Z"/></g></svg><div class="m2-g5-runner-label">${esc(name)}${meta?`<small>${esc(meta)}</small>`:""}</div></div>`,iconSize:[34,34],iconAnchor:[17,17]});
    const marker = L.marker([lat,lng], { icon, keyboard:false,zIndexOffset:1200 });
    marker.bindPopup(`<strong style="color:${color}">${esc(name)}</strong>${meta?`<br>${esc(meta)}`:""}<br>${esc(participantStatusLabel(row))}<br>GPS ±${Math.round(Number(gps.accuracy || 0))} m · ${esc(fmtAgo(gps.updatedAt))}`);
    marker.addTo(state.runnerLayer);state.runnerMarkers.set(uid, marker);
  });
}

function redrawTrack() {
  if (!state.mapReady || !state.trackLayer) return;
  const L = globalThis.L;
  state.trackLayer.clearLayers();
  const points = state.trackPoints.filter(p => validCoord(p.lat, p.lng)).map(p => [Number(p.lat), Number(p.lng)]);
  if (points.length < 2) return;
  const selectedColor=state.selectedUid?runnerColor(state.selectedUid):"#f0c16a";
  const line = L.polyline(points, { color:selectedColor, weight:5, opacity:.9, lineJoin:"round", lineCap:"round" }).addTo(state.trackLayer);
  if (state.selectedUid) {
    const row = state.participants?.[state.selectedUid] || {};
    line.bindPopup(`Traza de <strong style="color:${selectedColor}">${esc(participantName(row))}</strong> · ${points.length} puntos`);
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
    message.textContent = "Se necesita una cuenta verificada de ORGANIZADOR o SÚPER ADMINISTRADOR.";
    return;
  }
  const withGps = Object.values(state.participants || {}).filter(row => validCoord(row?.gps?.lat,row?.gps?.lng)).length;
  chip.textContent = state.runId ? (state.runStatus === "finished" ? "FINALIZADO" : "EN DIRECTO") : (EVENT_STATUS_ES[state.eventStatus] || "ESPERANDO");
  if (state.lastError) message.textContent = state.lastError;
  else if (!state.eventId) message.textContent = "Carga una carrera para preparar el mapa de seguimiento.";
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
  state.runnerMotion.clear();
  state.runnerColors.clear();
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
  state.runnerMotion.clear();
  state.runnerColors.clear();
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
