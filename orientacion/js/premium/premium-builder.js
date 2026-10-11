/* MILITOPO Premium · P2A.2 · Creador guiado · reanudación de carrera existente */
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const premium=globalThis.MILITOPO_PREMIUM;
if(!premium)throw new Error("MILITOPO Premium core no disponible");

const DRAFT_KEY="militopo_premium_builder_draft_v2";
const EVENT_DRAFT_PREFIX="militopo_premium_builder_event_draft_v1:";
const META_PREFIX="militopo_premium_event_meta_v1:";
const MANAGER_ROLES=new Set(["organizer","super_admin"]);
const steps=["TIPO","DATOS","PLANO","HORARIO","UBICACIÓN","REVISIÓN"];
const state={
  root:null,opened:false,step:0,busy:false,draft:null,mode:"create",eventId:"",
  auth:globalThis.MILITOPO_V2_AUTH||null,
  planMap:null,planBase:null,planMarker:null,
  importState:null
};
const $=(s,r=document)=>r.querySelector(s);

function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function role(){return String(state.auth?.role||globalThis.MILITOPO_V2_AUTH?.role||"").toLowerCase()}
function canManage(){return Boolean((state.auth?.uid||globalThis.MILITOPO_V2_AUTH?.uid)&&MANAGER_ROLES.has(role()))}
function bridge(){return premium.get("legacy-bridge")}
function nowLocalRounded(){const d=new Date(Date.now()+60*60*1000);d.setMinutes(Math.ceil(d.getMinutes()/15)*15,0,0);const p=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`}
function plusHours(local,h){const d=new Date(local);if(Number.isNaN(d.getTime()))return "";d.setHours(d.getHours()+h);const p=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`}
function freshDraft(){const start=nowLocalRounded();return {
  raceType:"training",name:"",description:"",participantCount:20,
  mapLayer:"mapant",mapCenterLat:"",mapCenterLon:"",mapZoom:13,mapAreaConfirmed:false,
  customMapId:"",customMapName:"",customMapFormat:"",
  startAt:start,endAt:plusHours(start,4),locationName:"",lat:"",lon:"",
  timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||"Europe/Madrid"
}}
function draftStorageKey(){return state.mode==="resume"&&state.eventId?EVENT_DRAFT_PREFIX+state.eventId:DRAFT_KEY}
function readDraft(key=DRAFT_KEY){try{return {...freshDraft(),...JSON.parse(localStorage.getItem(key)||"{}")}}catch(_){return freshDraft()}}
function saveDraft(){try{localStorage.setItem(draftStorageKey(),JSON.stringify(state.draft))}catch(_){}}
function clearDraft(){try{localStorage.removeItem(draftStorageKey())}catch(_){}}
function localDateTime(iso){if(!iso)return "";const d=new Date(iso);if(Number.isNaN(d.getTime()))return "";const p=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`}
function hydrateExisting(eventId){
  const ctx=bridge()?.shell?.current?.()||{};
  let meta=null,eventDraft=null;
  try{meta=JSON.parse(localStorage.getItem(META_PREFIX+eventId)||"null")}catch(_){ }
  try{eventDraft=JSON.parse(localStorage.getItem(EVENT_DRAFT_PREFIX+eventId)||"null")}catch(_){ }
  const base=freshDraft();
  if(meta){
    Object.assign(base,{
      raceType:meta.raceType||base.raceType,description:meta.description||"",
      mapLayer:meta.mapSelection?.layer||base.mapLayer,
      mapCenterLat:meta.mapSelection?.workCenter?.lat??"",mapCenterLon:meta.mapSelection?.workCenter?.lon??"",
      mapZoom:meta.mapSelection?.workCenter?.zoom??13,mapAreaConfirmed:Boolean(meta.mapSelection?.workCenter),
      customMapId:meta.mapSelection?.customMap?.id||"",customMapName:meta.mapSelection?.customMap?.name||"",customMapFormat:meta.mapSelection?.customMap?.format||"",
      startAt:localDateTime(meta.scheduledStartAt)||base.startAt,endAt:localDateTime(meta.scheduledEndAt)||base.endAt,
      timeZone:meta.timeZone||base.timeZone,locationName:meta.meetingPoint?.name||"",lat:meta.meetingPoint?.lat??"",lon:meta.meetingPoint?.lon??""
    });
  }
  if(eventDraft)Object.assign(base,eventDraft);
  base.name=String(base.name||ctx.eventName||document.getElementById("eventName")?.value||"").trim();
  const legacyCount=Number(document.getElementById("participantCount")?.value);if(Number.isFinite(legacyCount)&&legacyCount>0&&!eventDraft?.participantCount)base.participantCount=Math.min(100,legacyCount);
  return base;
}
function suggestedResumeStep(){
  if(String(state.draft.name||"").trim().length<3)return 1;
  if(!state.draft.mapAreaConfirmed||!validWorkCenter())return 2;
  const a=new Date(state.draft.startAt),b=new Date(state.draft.endAt);if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime())||b<=a)return 3;
  if(String(state.draft.locationName||"").trim().length<2||!validCoords())return 4;
  return 5;
}
function mapsUrl(d=state.draft){const lat=Number(d.lat),lon=Number(d.lon);if(!Number.isFinite(lat)||!Number.isFinite(lon))return "";return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`}
function fmtDate(local){if(!local)return "—";const d=new Date(local);if(Number.isNaN(d.getTime()))return local;return new Intl.DateTimeFormat("es-ES",{dateStyle:"medium",timeStyle:"short"}).format(d)}
function typeLabel(v){return v==="competition"?"COMPETICIÓN":"ENTRENAMIENTO"}
function mapLabel(v){return ({mapant:"MAPANT",ign:"IGN",pnoa:"AÉREO",custom:"MI PLANO"})[v]||"MAPANT"}
function validCoords(){const a=Number(state.draft.lat),o=Number(state.draft.lon);return Number.isFinite(a)&&a>=-90&&a<=90&&Number.isFinite(o)&&o>=-180&&o<=180}
function validWorkCenter(){const a=Number(state.draft.mapCenterLat),o=Number(state.draft.mapCenterLon);return Number.isFinite(a)&&a>=-90&&a<=90&&Number.isFinite(o)&&o>=-180&&o<=180}
function activeCustomMap(){try{return globalThis.MILITOPO_ORIENTATION_CUSTOM_MAP?.getActive?.()||null}catch(_){return null}}

function ensure(){
  if(state.root?.isConnected)return state.root;
  const root=document.createElement("section");root.id="militopoPremiumBuilder";root.className="mpb";root.setAttribute("aria-hidden","true");
  root.innerHTML=`<div class="mpb-shell"><header class="mpb-head"><div><small>MILITOPO · CREADOR PREMIUM</small><strong data-mpb-title>NUEVA CARRERA</strong></div><button type="button" class="mpb-close" data-mpb-close aria-label="Cerrar">×</button></header><div class="mpb-progress" data-mpb-progress></div><main class="mpb-body" data-mpb-body></main><footer class="mpb-foot" data-mpb-foot></footer></div>`;
  root.addEventListener("click",onClick);root.addEventListener("input",onInput);root.addEventListener("change",onInput);
  document.body.appendChild(root);state.root=root;return root;
}
function destroyPlanMap(){
  try{state.planMap?.remove?.()}catch(_){ }
  state.planMap=null;state.planBase=null;state.planMarker=null;
}
function progress(){
  const target=$("[data-mpb-progress]",ensure());
  target.innerHTML=steps.map((label,i)=>`<button type="button" data-mpb-jump="${i}" class="${i===state.step?"is-active":""} ${i<state.step?"is-done":""}"><span>${i<state.step?"✓":i+1}</span><small>${label}</small></button>`).join("");
}
function footer(){
  const f=$("[data-mpb-foot]",ensure()),last=state.step===steps.length-1;
  const finalLabel=state.mode==="resume"?(state.busy?"GUARDANDO…":"GUARDAR Y CONTINUAR"):(state.busy?"CREANDO…":"CREAR BORRADOR Y CONTINUAR");
  f.innerHTML=`${state.step?`<button type="button" class="mpb-btn mpb-btn-ghost" data-mpb-back>ATRÁS</button>`:`<button type="button" class="mpb-btn mpb-btn-ghost" data-mpb-close>GUARDAR Y SALIR</button>`}<div class="mpb-foot-spacer"></div>${last?`<button type="button" class="mpb-btn mpb-btn-primary" data-mpb-create ${state.busy?"disabled":""}>${finalLabel}</button>`:`<button type="button" class="mpb-btn mpb-btn-primary" data-mpb-next>CONTINUAR</button>`}`;
}
function field(id,label,type="text",value="",extra=""){return `<label class="mpb-field"><span>${label}</span><input id="${id}" type="${type}" value="${esc(value)}" ${extra}></label>`}
function renderType(){return `<section class="mpb-step"><div class="mpb-step-copy"><small>PASO 1 DE 6</small><h2>¿Qué vas a organizar?</h2><p>Solo te enseñaremos las opciones que tengan sentido para este tipo de carrera.</p></div><div class="mpb-type-grid"><button type="button" class="mpb-type ${state.draft.raceType==="competition"?"is-selected":""}" data-mpb-type="competition"><span class="mpb-type-icon">🏁</span><strong>COMPETICIÓN</strong><small>Categorías, clasificaciones y opciones competitivas.</small></button><button type="button" class="mpb-type ${state.draft.raceType==="training"?"is-selected":""}" data-mpb-type="training"><span class="mpb-type-icon">🧭</span><strong>ENTRENAMIENTO</strong><small>Creación más rápida y sin complejidad competitiva innecesaria.</small></button><button type="button" class="mpb-type mpb-type-secondary" data-mpb-reuse><span class="mpb-type-icon">↻</span><strong>DESDE UNA CARRERA ANTERIOR</strong><small>Abre Mis carreras para reutilizar una configuración existente.</small></button></div></section>`}
function renderData(){return `<section class="mpb-step"><div class="mpb-step-copy"><small>PASO 2 DE 6</small><h2>Datos de la carrera</h2><p>Primero le damos identidad. Después elegimos el plano sobre el que vas a diseñarla.</p></div><div class="mpb-form">${field("mpbName","NOMBRE DE LA CARRERA","text",state.draft.name,'maxlength="140" autocomplete="off" placeholder="Ej. Sierra Norte · Jornada 1"')}<label class="mpb-field mpb-field-wide"><span>DESCRIPCIÓN <em>OPCIONAL</em></span><textarea id="mpbDescription" maxlength="500" placeholder="Información breve para los participantes">${esc(state.draft.description)}</textarea></label>${field("mpbParticipants","PLAZAS PREVISTAS","number",state.draft.participantCount,'min="1" max="100" inputmode="numeric"')}</div><div class="mpb-note"><strong>${typeLabel(state.draft.raceType)}</strong><span>${state.draft.raceType==="competition"?"Las categorías aparecerán más adelante, solo para este tipo de carrera.":"MILITOPO ocultará categorías y opciones competitivas que no necesitas."}</span></div></section>`}

function customLibraryOptions(){
  const src=document.getElementById("orientationGeoTiffLibrary");
  if(!src)return `<option value="">— Sin plano guardado —</option>`;
  const selected=String(state.draft.customMapId||activeCustomMap()?.id||"");
  const renderNode=node=>{
    if(node.tagName==="OPTGROUP")return `<optgroup label="${esc(node.label)}">${[...node.children].map(renderNode).join("")}</optgroup>`;
    if(node.tagName==="OPTION")return `<option value="${esc(node.value)}" ${String(node.value)===selected?"selected":""}>${esc(node.textContent||"")}</option>`;
    return "";
  };
  return [...src.children].map(renderNode).join("")||`<option value="">— Sin plano guardado —</option>`;
}
function renderPlan(){
  const custom=activeCustomMap();
  const importText=state.importState?.message||"GeoTIFF / KMZ georreferenciado";
  return `<section class="mpb-step mpb-step-map"><div class="mpb-step-copy"><small>PASO 3 DE 6</small><h2>Elige el plano y la zona</h2><p>La cartografía se decide ahora para que controles, recorridos e itinerarios nazcan sobre la base correcta.</p></div>
  <div class="mpb-map-layout"><div class="mpb-map-choice">
    <div class="mpb-layer-grid">
      <button type="button" class="mpb-layer-card ${state.draft.mapLayer==="mapant"?"is-selected":""}" data-mpb-layer="mapant"><span>TOPO</span><strong>MAPANT</strong><small>Orientación y detalle del terreno.</small></button>
      <button type="button" class="mpb-layer-card ${state.draft.mapLayer==="ign"?"is-selected":""}" data-mpb-layer="ign"><span>IGN</span><strong>IGN</strong><small>Mapa raster oficial.</small></button>
      <button type="button" class="mpb-layer-card ${state.draft.mapLayer==="pnoa"?"is-selected":""}" data-mpb-layer="pnoa"><span>FOTO</span><strong>AÉREO</strong><small>PNOA para comprobar el terreno real.</small></button>
      <button type="button" class="mpb-layer-card ${state.draft.mapLayer==="custom"?"is-selected":""}" data-mpb-layer="custom"><span>+</span><strong>MI PLANO</strong><small>${esc(custom?.name||state.draft.customMapName||"GeoTIFF / KMZ")}</small></button>
    </div>
    <div class="mpb-custom-map-box ${state.draft.mapLayer==="custom"?"is-visible":""}">
      <label class="mpb-field"><span>PLANO GUARDADO</span><select id="mpbCustomMapLibrary">${customLibraryOptions()}</select></label>
      <button type="button" class="mpb-btn mpb-btn-soft" data-mpb-import-plan>CARGAR PLANO · GEOTIFF / KMZ</button>
      <small data-mpb-import-status>${esc(importText)}</small>
    </div>
    <div class="mpb-map-actions"><button type="button" class="mpb-btn mpb-btn-ghost" data-mpb-map-geolocate>CENTRAR EN MI UBICACIÓN</button><span>${state.draft.mapAreaConfirmed&&validWorkCenter()?`ZONA ✓ · ${Number(state.draft.mapCenterLat).toFixed(4)}, ${Number(state.draft.mapCenterLon).toFixed(4)}`:"Toca el mapa para fijar la zona de trabajo"}</span></div>
  </div><div class="mpb-map-preview-wrap"><div id="mpbPlanMap" class="mpb-plan-map" aria-label="Vista previa del plano"></div><div class="mpb-map-badge"><small>PLANO SELECCIONADO</small><strong>${esc(mapLabel(state.draft.mapLayer))}</strong></div></div></div>
  <div class="mpb-note"><strong>NO ES LA SALIDA</strong><span>Este punto solo centra la zona de diseño. El punto de encuentro y la salida se definirán después.</span></div></section>`;
}
function renderSchedule(){return `<section class="mpb-step"><div class="mpb-step-copy"><small>PASO 4 DE 6</small><h2>Programa la carrera</h2><p>La ficha del evento mostrará cuándo empieza y cuándo está previsto que termine.</p></div><div class="mpb-form mpb-form-two">${field("mpbStart","INICIO","datetime-local",state.draft.startAt)}${field("mpbEnd","FINAL PREVISTO","datetime-local",state.draft.endAt)}</div><div class="mpb-schedule-preview"><div><small>INICIO</small><strong>${esc(fmtDate(state.draft.startAt))}</strong></div><span>→</span><div><small>FINAL PREVISTO</small><strong>${esc(fmtDate(state.draft.endAt))}</strong></div></div><div class="mpb-note"><strong>CONTROL HUMANO</strong><span>La hora programada informa y prepara la carrera. MILITOPO no la pondrá EN DIRECTO automáticamente.</span></div></section>`}
function renderLocation(){const url=mapsUrl();return `<section class="mpb-step"><div class="mpb-step-copy"><small>PASO 5 DE 6</small><h2>¿Dónde debe ir la gente?</h2><p>Este es el punto de encuentro para llegar a la carrera. Puede ser distinto de la salida.</p></div><div class="mpb-form">${field("mpbLocation","LUGAR / PUNTO DE ENCUENTRO","text",state.draft.locationName,'maxlength="140" placeholder="Ej. Aparcamiento Área Recreativa"')}<div class="mpb-coords">${field("mpbLat","LATITUD","number",state.draft.lat,'step="any" inputmode="decimal" placeholder="38.123456"')}${field("mpbLon","LONGITUD","number",state.draft.lon,'step="any" inputmode="decimal" placeholder="-1.234567"')}</div></div><div class="mpb-location-actions"><button type="button" class="mpb-btn mpb-btn-soft" data-mpb-geolocate>USAR MI UBICACIÓN</button><button type="button" class="mpb-btn mpb-btn-ghost" data-mpb-use-work-center ${validWorkCenter()?"":"disabled"}>USAR CENTRO DEL PLANO</button>${url?`<a class="mpb-btn mpb-btn-ghost" href="${esc(url)}" target="_blank" rel="noopener">ABRIR EN GOOGLE MAPS</a>`:""}</div><div class="mpb-note"><strong>CÓMO LLEGAR</strong><span>Cuando la carrera sea pública, el corredor tendrá este punto y un acceso directo a Google Maps.</span></div></section>`}
function renderReview(){const url=mapsUrl();return `<section class="mpb-step"><div class="mpb-step-copy"><small>PASO 6 DE 6</small><h2>Primera parte preparada</h2><p>Ahora crearemos el BORRADOR con el plano ya elegido. Después seguirá el diseño guiado de controles y recorridos.</p></div><div class="mpb-review"><article><small>TIPO</small><strong>${typeLabel(state.draft.raceType)}</strong></article><article><small>NOMBRE</small><strong>${esc(state.draft.name||"—")}</strong></article><article><small>PLANO</small><strong>${esc(mapLabel(state.draft.mapLayer))}${state.draft.mapLayer==="custom"&&state.draft.customMapName?` · ${esc(state.draft.customMapName)}`:""}</strong></article><article><small>ZONA DE TRABAJO</small><strong>${validWorkCenter()?`${Number(state.draft.mapCenterLat).toFixed(5)}, ${Number(state.draft.mapCenterLon).toFixed(5)}`:"—"}</strong></article><article><small>PLAZAS</small><strong>${esc(state.draft.participantCount)}</strong></article><article><small>INICIO</small><strong>${esc(fmtDate(state.draft.startAt))}</strong></article><article><small>FINAL PREVISTO</small><strong>${esc(fmtDate(state.draft.endAt))}</strong></article><article><small>UBICACIÓN</small><strong>${esc(state.draft.locationName||"—")}</strong>${url?`<a href="${esc(url)}" target="_blank" rel="noopener">VER EN GOOGLE MAPS</a>`:""}</article></div><div class="mpb-next-stage"><span>DESPUÉS</span><strong>CONTROLES → RECORRIDOS → ITINERARIO REAL → PREFLIGHT → PREPARAR → PUBLICAR → INVITAR</strong></div></section>`}
function render(){
  destroyPlanMap();const title=$("[data-mpb-title]",ensure());if(title)title.textContent=state.mode==="resume"?"PREPARAR CARRERA":"NUEVA CARRERA";progress();
  const body=$("[data-mpb-body]",ensure());
  body.innerHTML=[renderType,renderData,renderPlan,renderSchedule,renderLocation,renderReview][state.step]();
  footer();body.scrollTop=0;
  if(state.step===2)setTimeout(initPlanMap,40);
}

function syncInputs(){
  const v=id=>$("#"+id,state.root)?.value;
  if($("#mpbName",state.root))state.draft.name=String(v("mpbName")||"").trimStart();
  if($("#mpbDescription",state.root))state.draft.description=String(v("mpbDescription")||"");
  if($("#mpbParticipants",state.root))state.draft.participantCount=Math.max(1,Math.min(100,Number(v("mpbParticipants"))||1));
  if($("#mpbStart",state.root))state.draft.startAt=String(v("mpbStart")||"");
  if($("#mpbEnd",state.root))state.draft.endAt=String(v("mpbEnd")||"");
  if($("#mpbLocation",state.root))state.draft.locationName=String(v("mpbLocation")||"").trimStart();
  if($("#mpbLat",state.root))state.draft.lat=String(v("mpbLat")||"");
  if($("#mpbLon",state.root))state.draft.lon=String(v("mpbLon")||"");
  saveDraft();
}
function validateStep(step=state.step){
  syncInputs();
  if(step===1&&state.draft.name.trim().length<3)return "Pon un nombre de al menos 3 caracteres.";
  if(step===2){
    if(!["mapant","ign","pnoa","custom"].includes(state.draft.mapLayer))return "Selecciona el plano de la carrera.";
    if(state.draft.mapLayer==="custom"&&!activeCustomMap())return "Carga o selecciona un plano propio antes de continuar.";
    if(!state.draft.mapAreaConfirmed||!validWorkCenter())return "Fija la zona de trabajo tocando el mapa o usando tu ubicación.";
  }
  if(step===3){const a=new Date(state.draft.startAt),b=new Date(state.draft.endAt);if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime()))return "Indica el inicio y el final previsto.";if(b<=a)return "El final previsto debe ser posterior al inicio.";}
  if(step===4){if(state.draft.locationName.trim().length<2)return "Indica el lugar o punto de encuentro.";if(!validCoords())return "Indica unas coordenadas válidas o usa tu ubicación.";}
  return "";
}
function notify(msg){if(bridge()?.toast?.(msg)!==true){const n=document.createElement("div");n.className="mpb-toast";n.textContent=msg;document.body.appendChild(n);setTimeout(()=>n.remove(),2600)}}
function next(){const err=validateStep();if(err){notify(err);return}state.step=Math.min(steps.length-1,state.step+1);saveDraft();render()}
function back(){syncInputs();state.step=Math.max(0,state.step-1);render()}
function jump(n){syncInputs();n=Number(n);if(!Number.isInteger(n)||n<0||n>=steps.length)return;if(n>state.step){for(let i=state.step;i<n;i++){const err=validateStep(i);if(err){notify(err);return}}}state.step=n;render()}

/* Vista previa cartográfica del asistente. Reutiliza las mismas fuentes que MILITOPO. */
function createMapantPreview(){return L.tileLayer.wms("https://raster.trailmap.fi/mapproxy/service",{layers:"spain_mapant",styles:"",format:"image/png",transparent:false,version:"1.1.1",attribution:"© MapAnt / Trailmap",minZoom:0,maxZoom:22,tileSize:256,crossOrigin:true,updateWhenIdle:false,updateWhenZooming:true,keepBuffer:4})}
function createIgnPreview(kind){
  const aerial=kind==="pnoa";
  const maxZoom=25,nativeMax=aerial?19:20,minSourceZoom=5;
  const template=aerial?"https://tms-pnoa-ma.idee.es/1.0.0/pnoa-ma/{z}/{x}/{-y}.jpeg":"https://tms-mapa-raster.ign.es/1.0.0/mapa-raster/{z}/{x}/{-y}.jpeg";
  const attribution=aerial?"© PNOA Máxima Actualidad · IGN":"© Instituto Geográfico Nacional";
  const Persistent=L.GridLayer.extend({
    initialize(opts={}){L.GridLayer.prototype.initialize.call(this,opts);this._cache=new Map()},
    _url(z,x,y){const n=2**z,wx=((x%n)+n)%n,ty=n-1-y;return template.replace("{z}",z).replace("{x}",wx).replace("{-y}",ty)},
    _load(url){if(this._cache.has(url))return this._cache.get(url);const p=new Promise((resolve,reject)=>{const i=new Image();i.decoding="async";i.onload=()=>resolve(i);i.onerror=()=>reject(new Error("tile"));i.src=url});this._cache.set(url,p);if(this._cache.size>96){const k=this._cache.keys().next().value;if(k)this._cache.delete(k)}p.catch(()=>{if(this._cache.get(url)===p)this._cache.delete(url)});return p},
    createTile(coords,done){const size=this.getTileSize(),c=document.createElement("canvas");c.width=size.x;c.height=size.y;const ctx=c.getContext("2d",{alpha:false});ctx.fillStyle=aerial?"#c9c9c1":"#e9e5d8";ctx.fillRect(0,0,size.x,size.y);const requested=coords.z;const draw=async source=>{const z=Math.max(minSourceZoom,Math.min(source,nativeMax,requested)),scale=2**(requested-z),px=Math.floor(coords.x/scale),py=Math.floor(coords.y/scale),n=2**z;if(py<0||py>=n){done(null,c);return}try{const img=await this._load(this._url(z,px,py)),ox=((coords.x%scale)+scale)%scale,oy=((coords.y%scale)+scale)%scale,sw=img.naturalWidth/scale,sh=img.naturalHeight/scale;ctx.imageSmoothingEnabled=true;try{ctx.imageSmoothingQuality="high"}catch(_){ }ctx.drawImage(img,ox*sw,oy*sh,sw,sh,0,0,size.x,size.y);done(null,c)}catch(_){if(z>minSourceZoom){draw(z-1);return}done(null,c)}};draw(Math.min(requested,nativeMax));return c}
  });
  return new Persistent({attribution,minZoom:0,maxZoom,tileSize:256,keepBuffer:aerial?8:6,updateWhenIdle:false,updateWhenZooming:true});
}
function previewLayer(){
  if(state.draft.mapLayer==="mapant")return createMapantPreview();
  if(state.draft.mapLayer==="ign")return createIgnPreview("ign");
  if(state.draft.mapLayer==="pnoa")return createIgnPreview("pnoa");
  const custom=activeCustomMap();
  if(state.draft.mapLayer==="custom"&&custom?.url&&custom?.bounds)return L.imageOverlay(custom.url,custom.bounds,{opacity:1,interactive:false});
  return createMapantPreview();
}
function setWorkCenter(lat,lon,zoom,confirmed=true){
  const a=Number(lat),o=Number(lon);if(!Number.isFinite(a)||!Number.isFinite(o))return;
  state.draft.mapCenterLat=a.toFixed(6);state.draft.mapCenterLon=o.toFixed(6);state.draft.mapZoom=Math.max(4,Math.min(25,Number(zoom)||13));state.draft.mapAreaConfirmed=Boolean(confirmed);saveDraft();
}
function initPlanMap(){
  if(state.step!==2||!state.opened||!globalThis.L)return;
  const el=$("#mpbPlanMap",state.root);if(!el)return;
  destroyPlanMap();
  let center=[40.4168,-3.7038],zoom=6;
  const custom=activeCustomMap();
  if(validWorkCenter()){center=[Number(state.draft.mapCenterLat),Number(state.draft.mapCenterLon)];zoom=Number(state.draft.mapZoom)||13}
  else if(state.draft.mapLayer==="custom"&&custom?.bounds){const b=L.latLngBounds(custom.bounds);center=[b.getCenter().lat,b.getCenter().lng];zoom=14;setWorkCenter(center[0],center[1],zoom,true)}
  state.planMap=L.map(el,{zoomControl:true,maxZoom:25,zoomSnap:.25,zoomDelta:.5,bounceAtZoomLimits:false}).setView(center,zoom);
  state.planBase=previewLayer();state.planBase?.addTo?.(state.planMap);
  if(state.draft.mapLayer==="custom"&&custom?.bounds){try{state.planMap.fitBounds(custom.bounds,{padding:[18,18],maxZoom:19,animate:false});const c=state.planMap.getCenter();setWorkCenter(c.lat,c.lng,state.planMap.getZoom(),true)}catch(_){}}
  if(validWorkCenter())state.planMarker=L.circleMarker([Number(state.draft.mapCenterLat),Number(state.draft.mapCenterLon)],{radius:7,weight:3,color:"#fff",fillColor:"#d9a82b",fillOpacity:1}).addTo(state.planMap);
  state.planMap.on("click",e=>{setWorkCenter(e.latlng.lat,e.latlng.lng,state.planMap.getZoom(),true);if(state.planMarker)state.planMarker.setLatLng(e.latlng);else state.planMarker=L.circleMarker(e.latlng,{radius:7,weight:3,color:"#fff",fillColor:"#d9a82b",fillOpacity:1}).addTo(state.planMap);const line=$(".mpb-map-actions span",state.root);if(line)line.textContent=`ZONA ✓ · ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`});
  state.planMap.on("zoomend",()=>{if(validWorkCenter()){state.draft.mapZoom=state.planMap.getZoom();saveDraft()}});
  setTimeout(()=>state.planMap?.invalidateSize?.(),80);
}
function chooseLayer(layer){
  state.draft.mapLayer=layer;
  if(layer==="custom"){
    const c=activeCustomMap();
    if(c){state.draft.customMapId=c.id||"";state.draft.customMapName=c.name||"";state.draft.customMapFormat=c.format||"";if(c.bounds){const b=L.latLngBounds(c.bounds),m=b.getCenter();setWorkCenter(m.lat,m.lng,14,true)}}
  }
  saveDraft();render();
}
async function selectCustomMap(id){
  id=String(id||"");if(!id)return;
  if(typeof globalThis.activateOrientationCustomMap!=="function"){notify("La biblioteca de planos aún no está lista.");return}
  try{state.importState={message:"Cargando plano guardado…"};updateImportStatus();await globalThis.activateOrientationCustomMap(id);const c=activeCustomMap();if(!c)throw new Error("Plano no disponible");state.draft.mapLayer="custom";state.draft.customMapId=c.id||id;state.draft.customMapName=c.name||"Plano propio";state.draft.customMapFormat=c.format||"";if(c.bounds){const b=L.latLngBounds(c.bounds),m=b.getCenter();setWorkCenter(m.lat,m.lng,14,true)}saveDraft();state.importState={message:`✓ ${c.name||"Plano propio"}`};render()}catch(e){console.warn(e);notify("No se pudo cargar ese plano.")}
}
function updateImportStatus(){const el=$("[data-mpb-import-status]",state.root);if(el&&state.importState?.message)el.textContent=state.importState.message}
function importPlan(){
  state.draft.mapLayer="custom";saveDraft();
  const input=document.getElementById("orientationGeoTiffInput");
  if(!input){notify("El importador de planos no está disponible todavía.");return}
  input.click();
}
function geolocateWorkArea(){
  if(!navigator.geolocation){notify("Este dispositivo no ofrece ubicación.");return}
  const btn=$("[data-mpb-map-geolocate]",state.root);if(btn){btn.disabled=true;btn.textContent="LOCALIZANDO…"}
  navigator.geolocation.getCurrentPosition(pos=>{setWorkCenter(pos.coords.latitude,pos.coords.longitude,15,true);if(state.planMap){state.planMap.setView([pos.coords.latitude,pos.coords.longitude],15,{animate:true});if(state.planMarker)state.planMarker.setLatLng([pos.coords.latitude,pos.coords.longitude]);else state.planMarker=L.circleMarker([pos.coords.latitude,pos.coords.longitude],{radius:7,weight:3,color:"#fff",fillColor:"#d9a82b",fillOpacity:1}).addTo(state.planMap)}const line=$(".mpb-map-actions span",state.root);if(line)line.textContent=`ZONA ✓ · ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;if(btn){btn.disabled=false;btn.textContent="CENTRAR EN MI UBICACIÓN"}},()=>{if(btn){btn.disabled=false;btn.textContent="CENTRAR EN MI UBICACIÓN"}notify("No se pudo obtener tu ubicación.")},{enableHighAccuracy:true,timeout:12000,maximumAge:15000});
}

async function geolocate(){
  if(!navigator.geolocation){notify("Este dispositivo no ofrece ubicación.");return}
  const btn=$("[data-mpb-geolocate]",state.root);if(btn){btn.disabled=true;btn.textContent="LOCALIZANDO…"}
  navigator.geolocation.getCurrentPosition(pos=>{state.draft.lat=Number(pos.coords.latitude).toFixed(6);state.draft.lon=Number(pos.coords.longitude).toFixed(6);saveDraft();render();notify(`Ubicación obtenida · precisión ±${Math.round(pos.coords.accuracy||0)} m`)},err=>{if(btn){btn.disabled=false;btn.textContent="USAR MI UBICACIÓN"}notify(err.code===1?"Permite el acceso a ubicación para usar este botón.":"No se pudo obtener la ubicación.")},{enableHighAccuracy:true,timeout:12000,maximumAge:15000});
}
function useWorkCenter(){if(!validWorkCenter())return;state.draft.lat=state.draft.mapCenterLat;state.draft.lon=state.draft.mapCenterLon;if(!state.draft.locationName)state.draft.locationName="Punto de encuentro de la carrera";saveDraft();render()}
async function syncMetadata(eventId,attempt=0){
  const custom=activeCustomMap();
  const meta={premiumSchemaVersion:2,raceType:state.draft.raceType,description:String(state.draft.description||"").trim(),mapSelection:{layer:state.draft.mapLayer,label:mapLabel(state.draft.mapLayer),workCenter:{lat:Number(state.draft.mapCenterLat),lon:Number(state.draft.mapCenterLon),zoom:Number(state.draft.mapZoom)||13},customMap:state.draft.mapLayer==="custom"?{id:custom?.id||state.draft.customMapId||"",name:custom?.name||state.draft.customMapName||"",format:custom?.format||state.draft.customMapFormat||""}:null},scheduledStartAt:new Date(state.draft.startAt).toISOString(),scheduledEndAt:new Date(state.draft.endAt).toISOString(),timeZone:state.draft.timeZone||"Europe/Madrid",meetingPoint:{name:String(state.draft.locationName||"").trim(),lat:Number(state.draft.lat),lon:Number(state.draft.lon),mapsUrl:mapsUrl()},updatedAtLocal:new Date().toISOString()};
  try{localStorage.setItem(META_PREFIX+eventId,JSON.stringify(meta))}catch(_){ }
  if(!navigator.onLine)return false;
  try{const auth=globalThis.MILITOPO_V2_AUTH||state.auth;if(!auth?.uid)return false;const {firestore}=await globalThis.MILITOPO_V2.firebase();await setDoc(doc(firestore,"events",eventId),{...meta,ownerUid:String(auth.uid),updatedAt:serverTimestamp()},{merge:true});return true}catch(error){console.warn("[MILITOPO Premium Builder] metadata",error);if(attempt<2){await new Promise(r=>setTimeout(r,800*(attempt+1)));return syncMetadata(eventId,attempt+1)}return false}
}
function applyLegacyBasics(){
  const name=$("#eventName"),count=$("#participantCount");
  if(name){name.value=state.draft.name.trim();name.dispatchEvent(new Event("input",{bubbles:true}));name.dispatchEvent(new Event("change",{bubbles:true}))}
  if(count){count.value=String(Math.max(1,Math.min(100,Number(state.draft.participantCount)||1)));count.dispatchEvent(new Event("change",{bubbles:true}))}
}
function applySelectedPlan(){try{globalThis.MILITOPO_MAP_CONTROL?.switchLayer?.(state.draft.mapLayer)}catch(e){console.warn("[MILITOPO Premium Builder] capa",e)}}
async function createRace(){
  for(let i=0;i<5;i++){const err=validateStep(i);if(err){state.step=i;render();notify(err);return}}
  if(state.busy)return;state.busy=true;footer();
  try{
    const b=bridge();
    if(state.mode==="resume"){
      const eventId=String(state.eventId||b?.shell?.current?.().eventId||"").trim();if(!eventId){notify("No hay una carrera cargada para continuar.");return}
      applyLegacyBasics();applySelectedPlan();
      try{b.event.saveRules()}catch(error){console.warn("[MILITOPO Premium Builder] reglas",error)}
      const ok=await syncMetadata(eventId);clearDraft();close();
      setTimeout(()=>{notify(ok?"Preparación guardada. Continuamos con controles y recorridos.":"Preparación guardada en el dispositivo. Se sincronizará al recuperar conexión.");try{b.shell.manager({source:"premium-builder"})}catch(_){ }globalThis.dispatchEvent(new CustomEvent("militopo:premium-builder-resumed",{detail:{...state.draft,eventId}}))},120);
      return;
    }
    if(!b?.event?.createLegacy){notify("El creador todavía no está listo. Cierra y vuelve a abrir MILITOPO.");return}
    const created=await b.event.createLegacy();if(created!==true)return;
    await new Promise(r=>setTimeout(r,170));applyLegacyBasics();applySelectedPlan();
    try{b.event.saveRules()}catch(error){console.warn("[MILITOPO Premium Builder] reglas",error)}
    await new Promise(r=>setTimeout(r,260));
    const eventId=String(b.shell.current?.().eventId||$("#eventId")?.value||"").trim();
    if(eventId)syncMetadata(eventId).then(ok=>{if(!ok)console.info("MILITOPO Premium · metadatos guardados localmente para sincronización posterior")});
    const done={...state.draft,eventId};clearDraft();close();
    setTimeout(()=>{try{b.map.home()}catch(_){ }notify("Borrador creado · plano preparado. Seguimos con controles y recorridos.");globalThis.dispatchEvent(new CustomEvent("militopo:premium-builder-created",{detail:done}))},120);
  }finally{state.busy=false;if(state.opened)footer()}
}
function reuse(){syncInputs();close();bridge()?.shell?.races?.();notify("Selecciona una carrera anterior y utiliza REUTILIZAR.")}
function onInput(event){
  if(event?.target?.id==="mpbCustomMapLibrary"&&event.type==="change"){selectCustomMap(event.target.value);return}
  syncInputs();if(event?.type==="change"&&(state.step===3||state.step===4))setTimeout(render,0)
}
function onClick(e){
  const t=e.target.closest("button,a");if(!t)return;
  if(t.matches("[data-mpb-close]")){syncInputs();close();return}
  if(t.matches("[data-mpb-next]")){next();return}
  if(t.matches("[data-mpb-back]")){back();return}
  if(t.matches("[data-mpb-jump]")){jump(t.dataset.mpbJump);return}
  if(t.matches("[data-mpb-type]")){state.draft.raceType=t.dataset.mpbType;saveDraft();render();return}
  if(t.matches("[data-mpb-reuse]")){reuse();return}
  if(t.matches("[data-mpb-layer]")){chooseLayer(t.dataset.mpbLayer);return}
  if(t.matches("[data-mpb-import-plan]")){importPlan();return}
  if(t.matches("[data-mpb-map-geolocate]")){geolocateWorkArea();return}
  if(t.matches("[data-mpb-geolocate]")){geolocate();return}
  if(t.matches("[data-mpb-use-work-center]")){useWorkCenter();return}
  if(t.matches("[data-mpb-create]")){createRace();return}
}
function open(opts={}){if(!canManage())return false;ensure();const ctx=bridge()?.shell?.current?.()||{};state.mode=opts.resumeCurrent?"resume":"create";state.eventId=state.mode==="resume"?String(opts.eventId||ctx.eventId||"").trim():"";if(state.mode==="resume"&&!state.eventId){notify("Carga una carrera antes de continuar la preparación.");return false}state.draft=state.mode==="resume"?hydrateExisting(state.eventId):(opts.fresh?freshDraft():readDraft());if(opts.fresh&&state.mode==="create"){clearDraft();saveDraft()}const requested=Number(opts.step);state.step=Number.isFinite(requested)?Math.max(0,Math.min(steps.length-1,requested)):(state.mode==="resume"?suggestedResumeStep():0);state.root.classList.add("is-open");state.root.setAttribute("aria-hidden","false");document.body.classList.add("militopo-premium-builder-open");state.opened=true;render();return true}
function resumeCurrent(){return open({resumeCurrent:true})}
function close(){destroyPlanMap();if(!state.root)return;state.root.classList.remove("is-open");state.root.setAttribute("aria-hidden","true");document.body.classList.remove("militopo-premium-builder-open");state.opened=false}

premium.register("event-builder",Object.freeze({open,resumeCurrent,close,isOpen:()=>state.opened,getDraft:()=>Object.freeze({...state.draft})}),{version:"p2a2",purpose:"guided-event-creation-and-resume"});
globalThis.addEventListener("militopo:v2-auth-ready",e=>{state.auth=e.detail||globalThis.MILITOPO_V2_AUTH||null;if(!canManage())close()});
globalThis.addEventListener("militopo:v2-orientation-import",e=>{
  const d=e.detail||{};state.importState={message:d.message||d.stage||"Procesando plano…",state:d.state||"progress"};updateImportStatus();
  if(d.state==="success"){
    const c=d.map||activeCustomMap();state.draft.mapLayer="custom";state.draft.customMapId=c?.id||"";state.draft.customMapName=c?.name||d.fileName||"Plano propio";state.draft.customMapFormat=c?.format||"";
    if(c?.bounds&&globalThis.L){const b=L.latLngBounds(c.bounds),m=b.getCenter();setWorkCenter(m.lat,m.lng,14,true)}
    saveDraft();if(state.opened&&state.step===2)setTimeout(render,40);
  }
});
globalThis.addEventListener("militopo:v2-orientation-custom-map",e=>{
  if(!state.opened||state.step!==2)return;const c=e.detail?.map;if(!c)return;state.draft.customMapId=c.id||"";state.draft.customMapName=c.name||"";state.draft.customMapFormat=c.format||"";saveDraft()
});
globalThis.addEventListener("online",()=>{const id=String(bridge()?.shell?.current?.().eventId||"");if(!id)return;try{const saved=JSON.parse(localStorage.getItem(META_PREFIX+id)||"null");if(saved){state.draft={...freshDraft(),raceType:saved.raceType||"training",description:saved.description||"",mapLayer:saved.mapSelection?.layer||"mapant",mapCenterLat:saved.mapSelection?.workCenter?.lat??"",mapCenterLon:saved.mapSelection?.workCenter?.lon??"",mapZoom:saved.mapSelection?.workCenter?.zoom??13,mapAreaConfirmed:Boolean(saved.mapSelection?.workCenter),customMapId:saved.mapSelection?.customMap?.id||"",customMapName:saved.mapSelection?.customMap?.name||"",customMapFormat:saved.mapSelection?.customMap?.format||"",startAt:saved.scheduledStartAt?new Date(saved.scheduledStartAt).toISOString().slice(0,16):"",endAt:saved.scheduledEndAt?new Date(saved.scheduledEndAt).toISOString().slice(0,16):"",locationName:saved.meetingPoint?.name||"",lat:saved.meetingPoint?.lat??"",lon:saved.meetingPoint?.lon??"",timeZone:saved.timeZone||"Europe/Madrid"};syncMetadata(id)}}catch(_){ }});
