/* MILITOPO Premium · P2B/P2C/P3/P2D/P2E · asistente + IOF + recorridos + itinerario + preflight + publicación */
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const premium=globalThis.MILITOPO_PREMIUM;
if(!premium)throw new Error("MILITOPO Premium core no disponible");

const DRAFT_KEY="militopo_premium_builder_draft_v4";
const EVENT_DRAFT_PREFIX="militopo_premium_builder_event_draft_v3:";
const META_PREFIX="militopo_premium_event_meta_v1:";
const MANAGER_ROLES=new Set(["organizer","super_admin"]);
const steps=["TIPO","DATOS","PLANO","HORARIO","UBICACIÓN","CONTROLES + IOF","RECORRIDOS","ITINERARIO","PREFLIGHT"];
const stepHints=["Modalidad","Identidad","Cartografía","Programa","Encuentro","Puntos y símbolos","Diseño manual","Distancia real","Comprobación final"];
const state={
  root:null,opened:false,step:0,busy:false,routeBusy:false,draft:null,mode:"create",eventId:"",auth:globalThis.MILITOPO_V2_AUTH||null,
  planMap:null,planBase:null,planMarker:null,
  locationMap:null,locationBase:null,locationMarker:null,locationPressTimer:null,locationResults:[],precisionMap:null,precisionMarker:null,precisionPoint:null,
  controlMap:null,controlBase:null,controlMarkers:null,selectedControlId:"START",controlsPhase:"placement",controlMethod:"map",atakPreview:null,atakFileName:"",
  routeMap:null,routeBase:null,routeMarkers:null,routeLine:null,selectedRouteId:"R01",routeDraftControls:[],
  itineraryMap:null,itineraryBase:null,itineraryLayer:null,itineraryMarkers:null,itineraryDraftPoints:[],itineraryDirty:false,
  blockerMessage:"",importState:null,packageBusy:false,publishing:false,publicationError:null,publicationEpoch:0,draftOwnerUid:""
};
const $=(s,r=document)=>r.querySelector(s);

function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function role(){return String(state.auth?.role||globalThis.MILITOPO_V2_AUTH?.role||"").toLowerCase()}
function canManage(){return Boolean((state.auth?.uid||globalThis.MILITOPO_V2_AUTH?.uid)&&MANAGER_ROLES.has(role()))}
function bridge(){return premium.get("legacy-bridge")}
function r2(){return globalThis.MILITOPO_R2_BRIDGE||null}
function legacyControlCount(){const n=Number(document.getElementById("controlCount")?.value);return Number.isFinite(n)&&n>0?Math.min(80,Math.trunc(n)):25}
function legacyControlsPerRoute(){const n=Number(document.getElementById("controlsPerRoute")?.value);return Number.isFinite(n)&&n>0?Math.min(30,Math.trunc(n)):8}
function nowLocalRounded(){const d=new Date(Date.now()+60*60*1000);d.setMinutes(Math.ceil(d.getMinutes()/15)*15,0,0);const p=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`}
function plusHours(local,h){const d=new Date(local);if(Number.isNaN(d.getTime()))return "";d.setHours(d.getHours()+h);const p=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`}
function freshDraft(){const start=nowLocalRounded(),controlCount=legacyControlCount();return {raceType:"training",name:"",description:"",participantCount:20,controlCount,mapLayer:"pnoa",mapCenterLat:"40.4168",mapCenterLon:"-3.7038",mapZoom:12,mapAreaConfirmed:true,customMapId:"",customMapName:"",customMapFormat:"",startAt:start,endAt:plusHours(start,4),locationName:"",lat:"",lon:"",googleMapType:"satellite",locationZoom:16,routeCount:1,controlsPerRoute:Math.min(controlCount,legacyControlsPerRoute()),itineraries:{},timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||"Europe/Madrid"}}
function newDraftStorageKey(){return DRAFT_KEY+":"+encodeURIComponent(currentDraftOwner())}
function draftStorageKey(){return state.mode==="resume"&&state.eventId?EVENT_DRAFT_PREFIX+state.eventId:newDraftStorageKey()}
function currentDraftOwner(){return String((state.auth||globalThis.MILITOPO_V2_AUTH)?.uid||"")}
function draftBelongsToCurrent(raw){return Boolean(raw&&typeof raw==="object"&&!Array.isArray(raw)&&(!raw._localOwnerUid||raw._localOwnerUid===currentDraftOwner()))}
function draftSaveStatus(message,error=false){
  state.localSaveMessage=message;state.localSaveError=error;
  const node=state.root?.querySelector?.("[data-mpb-local-save]");
  if(node){node.textContent=message;node.style.color=error?"#8c281f":"#24583c";node.setAttribute("role",error?"alert":"status")}
}
function readDraft(key=DRAFT_KEY){
  try{const raw=JSON.parse((key===DRAFT_KEY?(localStorage.getItem(newDraftStorageKey())||localStorage.getItem(DRAFT_KEY)):localStorage.getItem(key))||"null");return draftBelongsToCurrent(raw)?{...freshDraft(),...raw}:freshDraft()}
  catch(_){return freshDraft()}
}
function hasRecoverableDraft(){try{return draftBelongsToCurrent(JSON.parse(localStorage.getItem(newDraftStorageKey())||localStorage.getItem(DRAFT_KEY)||"null"))}catch(_){return false}}
function saveDraft(){
  if(!state.draft)return false;
  if(state.hydrating)return true;
  if(state.mode==="create"&&state.freshPristine&&hasRecoverableDraft()){draftSaveStatus("Borrador anterior disponible · recupera o empieza a editar uno nuevo");return true;}
  const uid=currentDraftOwner();
  if(!uid||state.draftOwnerUid!==uid){draftSaveStatus("Sesión cambiada. Vuelve a abrir el borrador con su cuenta.",true);return false}
  try{
    const key=draftStorageKey(),previous=localStorage.getItem(key);
    // No sobrescribir un borrador identificado de otra cuenta en este dispositivo.
    if(previous){let parsed;try{parsed=JSON.parse(previous)}catch(_){throw new Error("La copia local no es legible; se conserva sin sobrescribir")}
      if(!draftBelongsToCurrent(parsed))throw new Error("Hay un borrador de otra cuenta en este dispositivo")}
    state.draft._localOwnerUid=uid;
    const serialized=JSON.stringify(state.draft);
    if(serialized!==previous)localStorage.setItem(key,serialized);
    draftSaveStatus(navigator.onLine?"Borrador guardado en este dispositivo":"Sin conexión · borrador guardado en este dispositivo");
    return true;
  }catch(error){console.warn("[MILITOPO Premium Builder] almacenamiento local",error);draftSaveStatus("No se pudo guardar aquí. Mantén esta pantalla abierta y revisa el almacenamiento o la cuenta.",true);return false}
}
function clearDraft(key=draftStorageKey()){try{localStorage.removeItem(key)}catch(_){}}
function preserveBeforeSuspend(){
  if(!state.opened||!state.draft||state.publishing||currentDraftOwner()!==state.draftOwnerUid)return;
  syncInputs();preservePendingEditor();
}
function pendingResumeRoute(draft){
  return draft.pendingItineraryEditor?.id||draft.pendingRouteEditor?.id||Object.keys(draft.pendingItineraryEditors||{})[0]||Object.keys(draft.pendingRouteEditors||{})[0]||routeId(1);
}
function validMetadataDates(draft){return Number.isFinite(new Date(draft.startAt).getTime())&&Number.isFinite(new Date(draft.endAt).getTime())}

function localDateTime(iso){if(!iso)return "";const d=new Date(iso);if(Number.isNaN(d.getTime()))return "";const p=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`}
function mapsUrl(d=state.draft){const lat=Number(d.lat),lon=Number(d.lon);if(Number.isFinite(lat)&&lat>=-90&&lat<=90&&Number.isFinite(lon)&&lon>=-180&&lon<=180&&String(d.lat??"").trim()!==""&&String(d.lon??"").trim()!=="")return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lon}`)}`;const q=String(d.locationName||"").trim();return q?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`:""}
function mapsEmbedUrl(d=state.draft){const lat=Number(d.lat),lon=Number(d.lon),hasCoords=String(d.lat??"").trim()!==""&&String(d.lon??"").trim()!==""&&Number.isFinite(lat)&&Number.isFinite(lon),q=hasCoords?`${lat},${lon}`:(String(d.locationName||"").trim()||"Madrid, España"),z=Math.max(4,Math.min(21,Math.round(Number(d.locationZoom)||16)));return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=${z}&output=embed`}
function fmtDate(local){if(!local)return "—";const d=new Date(local);if(Number.isNaN(d.getTime()))return local;return new Intl.DateTimeFormat("es-ES",{dateStyle:"medium",timeStyle:"short"}).format(d)}
function typeLabel(v){return v==="competition"?"COMPETICIÓN":"ENTRENAMIENTO"}
function mapLabel(v){return ({mapant:"MAPANT",ign:"IGN",pnoa:"AÉREO",custom:"MI PLANO"})[v]||"MAPANT"}
function validCoords(){const la=String(state.draft.lat??"").trim(),lo=String(state.draft.lon??"").trim();if(!la||!lo)return false;const a=Number(la),o=Number(lo);return Number.isFinite(a)&&a>=-90&&a<=90&&Number.isFinite(o)&&o>=-180&&o<=180}
function validWorkCenter(){const a=Number(state.draft.mapCenterLat),o=Number(state.draft.mapCenterLon);return Number.isFinite(a)&&a>=-90&&a<=90&&Number.isFinite(o)&&o>=-180&&o<=180}
function activeCustomMap(){try{return globalThis.MILITOPO_ORIENTATION_CUSTOM_MAP?.getActive?.()||null}catch(_){return null}}
function snapshot(){try{return r2()?.getSnapshot?.()||null}catch(_){return null}}
function pointPlaced(p){if(!p||p.lat===null||p.lon===null||p.lat===""||p.lon===""||p.lat===undefined||p.lon===undefined)return false;const lat=Number(p.lat),lon=Number(p.lon);return Number.isFinite(lat)&&lat>=-90&&lat<=90&&Number.isFinite(lon)&&lon>=-180&&lon<=180}
function controlOrder(s=snapshot()){if(!s)return [];const controls=[...(s.controls||[])].sort((a,b)=>String(a.id).localeCompare(String(b.id),undefined,{numeric:true}));return [s.points?.find?.(p=>p.id==="START"),...controls,s.points?.find?.(p=>p.id==="FINISH")].filter(Boolean)}
function controlsComplete(s=snapshot()){const list=controlOrder(s);return Boolean(list.length&&list.every(pointPlaced))}
function iofSummary(){try{return r2()?.getIofSummary?.()||{total:0,complete:0,pending:[],allComplete:false}}catch(_){return {total:0,complete:0,pending:[],allComplete:false}}}
function routeId(index){return `R${String(index).padStart(2,"0")}`}
function routeTargetCount(){const participants=Math.max(1,Math.min(30,Math.trunc(Number(state.draft?.participantCount)||1)));return Math.max(1,Math.min(participants,Math.trunc(Number(state.draft?.routeCount)||1)))}
function controlsPerRoute(){const available=snapshot()?.controls?.filter(pointPlaced).length||state.draft?.controlCount||1;return Math.max(1,Math.min(Math.max(1,available),Math.trunc(Number(state.draft?.controlsPerRoute)||1)))}
function routeDetails(id){try{return r2()?.getRouteDetails?.(id)||null}catch(_){return null}}
// F2.18 · Comprobaciones sobre el modelo de puntos/recorridos existente.
// No se crea una segunda estructura de datos ni se alteran carreras guardadas.
function pointDesignProblem(s=snapshot()){
  if(!s||!Array.isArray(s.points)||!Array.isArray(s.controls))return "No se ha cargado la estructura de controles de esta carrera.";
  const ids=s.points.map(p=>String(p?.id||"").trim()),unique=new Set(ids);
  if(ids.some(id=>!id)||unique.size!==ids.length)return "Hay identificadores de puntos vacíos o duplicados. Revisa las balizas.";
  for(const id of ["START","FINISH"]){
    const p=s.points.find(p=>p.id===id);
    if(!p)return `Falta ${id==="START"?"SALIDA":"LLEGADA"} en el diseño.`;
    if(!pointPlaced(p))return `${id==="START"?"SALIDA":"LLEGADA"} no tiene coordenadas válidas.`;
  }
  const count=Number(state.draft?.controlCount);
  if(!Number.isInteger(count)||count<1||s.controls.length!==count)
    return `El diseño tiene ${s.controls.length} balizas y la configuración exige ${Number.isInteger(count)?count:"un número válido"}.`;
  for(const p of s.controls){
    const id=String(p?.id||"").trim();
    if(!id||id==="START"||id==="FINISH")return "Hay una baliza con identificador reservado o vacío.";
    if(!pointPlaced(p))return `La baliza ${id} no tiene coordenadas válidas.`;
    if(s.points.filter(q=>q.id===id&&q.type==="BALIZA").length!==1)return `La baliza ${id} no coincide con el diseño de puntos.`;
  }
  return "";
}
function routeDesignProblem(id,s=snapshot()){
  const d=routeDetails(id),per=controlsPerRoute();
  if(!d||!Array.isArray(d.controls)||d.controls.length!==per)return `${id}: guarda exactamente ${per} balizas.`;
  const controls=d.controls.map(String),unique=new Set(controls);
  if(unique.size!==controls.length||controls.some(pid=>!pid||pid==="START"||pid==="FINISH"))return `${id}: hay balizas repetidas o referencias inválidas.`;
  const available=new Map((s?.controls||[]).map(p=>[String(p.id),p]));
  for(const pid of controls){if(!available.has(pid)||!pointPlaced(available.get(pid)))return `${id}: la baliza ${pid} ya no existe o no tiene coordenadas válidas.`;}
  // getRouteDetails expone los puntos guardados de la ruta en su orden original.
  const expected=["START",...controls,"FINISH"];
  if(!Array.isArray(d.points)||d.points.length!==expected.length||d.points.some((p,i)=>p.id!==expected[i]||!pointPlaced(p)))
    return `${id}: la geometría guardada no coincide con SALIDA, balizas y LLEGADA.`;
  return "";
}
function itineraryDesignProblem(id,s=snapshot()){
  const it=savedItinerary(id);
  if(!it?.saved||!Array.isArray(it.points)||it.points.length<2)return `${id}: guarda el itinerario.`;
  if(it.points.some(p=>!pointPlaced(p)))return `${id}: hay vértices con coordenadas inválidas.`;
  const d=routeDetails(id),expected=["START",...(d?.controls||[]),"FINISH"];
  const anchors=it.points.filter(p=>p.anchorId);
  if(anchors.length!==expected.length)return `${id}: faltan anclajes del recorrido; revisa el itinerario.`;
  const byId=new Map((s?.points||[]).map(p=>[String(p.id),p]));
  for(let i=0;i<expected.length;i++){
    const p=anchors[i],ref=byId.get(expected[i]);
    if(String(p.anchorId)!==expected[i]||!pointPlaced(ref)||haversineMeters(p,ref)>2)
      return `${id}: las balizas o sus coordenadas cambiaron; vuelve a guardar el itinerario.`;
  }
  if(it.points[0]!==anchors[0]||it.points[it.points.length-1]!==anchors[anchors.length-1])
    return `${id}: el itinerario debe comenzar en SALIDA y terminar en LLEGADA.`;
  return "";
}
function routesComplete(){const s=snapshot();return !pointDesignProblem(s)&&Array.from({length:routeTargetCount()},(_,i)=>routeDesignProblem(routeId(i+1),s)).every(x=>!x)}
function lifecycleStatus(){return String(globalThis.MILITOPO_V2_EVENT_STATUS?.status||bridge()?.shell?.current?.().status||"draft").toLowerCase()}
function lifecycleLabel(value=lifecycleStatus()){return ({draft:"BORRADOR",prepared:"PREPARADO",published:"PUBLICADA",live:"EN DIRECTO",finished:"FINALIZADA",archived:"FINALIZADA"})[String(value||"draft").toLowerCase()]||String(value||"").toUpperCase()}
function preflightReady(){return preflightItems().every(x=>x.ok)}

function haversineMeters(a,b){const R=6371000,toRad=x=>x*Math.PI/180,la1=toRad(Number(a.lat)),la2=toRad(Number(b.lat)),dLa=toRad(Number(b.lat)-Number(a.lat)),dLo=toRad(Number(b.lon)-Number(a.lon));const h=Math.sin(dLa/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLo/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(h)))}
function pathMeters(points=[]){let total=0;for(let i=1;i<points.length;i++)total+=haversineMeters(points[i-1],points[i]);return total}
function formatKm(m){return Number.isFinite(m)?`${(m/1000).toFixed(m>=10000?1:2)} km`:"—"}
function routeAnchorPoints(id=state.selectedRouteId){const d=routeDetails(id),snap=snapshot(),byId=new Map((snap?.points||[]).map(p=>[p.id,p]));if(!d||!Array.isArray(d.controls))return [];return ["START",...d.controls,"FINISH"].map(pid=>{const p=byId.get(pid);return pointPlaced(p)?{lat:Number(p.lat),lon:Number(p.lon),anchorId:pid}:null}).filter(Boolean)}
function savedItinerary(id=state.selectedRouteId){const raw=state.draft?.itineraries?.[id];return raw&&Array.isArray(raw.points)?raw:null}
function itineraryComplete(id){return !routeDesignProblem(id)&&!itineraryDesignProblem(id)}
function itinerariesComplete(){for(let i=1;i<=routeTargetCount();i++)if(!itineraryComplete(routeId(i)))return false;return routeTargetCount()>0}
function itinerarySummary(id=state.selectedRouteId){const direct=pathMeters(routeAnchorPoints(id)),draft=state.itineraryDraftPoints?.length?state.itineraryDraftPoints:routeAnchorPoints(id),real=pathMeters(draft),diff=direct>0?((real-direct)/direct*100):0;return {direct,real,diff}}

function hydrateExisting(eventId){
  const ctx=bridge()?.shell?.current?.()||{};let meta=null,eventDraft=null;
  try{meta=JSON.parse(localStorage.getItem(META_PREFIX+eventId)||"null")}catch(_){ }
  try{const raw=JSON.parse(localStorage.getItem(EVENT_DRAFT_PREFIX+eventId)||"null");if(draftBelongsToCurrent(raw))eventDraft=raw}catch(_){ }
  const base=freshDraft(),snap=snapshot();
  if(meta)Object.assign(base,{raceType:meta.raceType||base.raceType,description:meta.description||"",mapLayer:meta.mapSelection?.layer||base.mapLayer,mapCenterLat:meta.mapSelection?.workCenter?.lat??"",mapCenterLon:meta.mapSelection?.workCenter?.lon??"",mapZoom:meta.mapSelection?.workCenter?.zoom??13,mapAreaConfirmed:Boolean(meta.mapSelection?.workCenter),customMapId:meta.mapSelection?.customMap?.id||"",customMapName:meta.mapSelection?.customMap?.name||"",customMapFormat:meta.mapSelection?.customMap?.format||"",startAt:localDateTime(meta.scheduledStartAt)||base.startAt,endAt:localDateTime(meta.scheduledEndAt)||base.endAt,timeZone:meta.timeZone||base.timeZone,locationName:meta.meetingPoint?.name||"",lat:meta.meetingPoint?.lat??"",lon:meta.meetingPoint?.lon??"",routeCount:meta.premiumRouteCount||base.routeCount,controlsPerRoute:meta.premiumControlsPerRoute||base.controlsPerRoute,itineraries:meta.premiumItineraries||base.itineraries||{}});
  if(eventDraft)Object.assign(base,eventDraft);
  base.name=String(base.name||ctx.eventName||document.getElementById("eventName")?.value||"").trim();
  const legacyCount=Number(document.getElementById("participantCount")?.value);if(Number.isFinite(legacyCount)&&legacyCount>0&&!eventDraft?.participantCount)base.participantCount=Math.min(100,legacyCount);
  if(snap?.controls?.length)base.controlCount=snap.controls.length;
  if(snap?.routeCount)base.routeCount=Math.max(Number(base.routeCount)||1,Number(snap.routeCount)||1);
  if(snap?.controlsPerRoute)base.controlsPerRoute=Math.min(base.controlCount,Math.max(1,Number(snap.controlsPerRoute)||1));
  return base;
}
function suggestedResumeStep(){
  if(String(state.draft.name||"").trim().length<3)return 1;
  if(!state.draft.mapAreaConfirmed||!validWorkCenter())return 2;
  const a=new Date(state.draft.startAt),b=new Date(state.draft.endAt);if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime())||b<=a)return 3;
  if(!validCoords())return 4;
  if(!controlsComplete()||!iofSummary().allComplete)return 5;
  if(!routesComplete())return 6;
  return 7;
}

function ensure(){
  if(state.root?.isConnected)return state.root;
  const root=document.createElement("section");root.id="militopoPremiumBuilder";root.className="mpb";root.setAttribute("aria-hidden","true");
  root.innerHTML=`<div class="mpb-shell">
    <aside class="mpb-rail">
      <div class="mpb-brand"><span class="mpb-brand-mark">M</span><div><small>MILITOPO</small><strong>CREADOR DE CARRERA</strong></div></div>
      <div class="mpb-rail-intro"><span>PREPARACIÓN GUIADA</span><strong data-mpb-title>NUEVA CARRERA</strong><p>Un paso cada vez. MILITOPO conserva el trabajo mientras avanzas.</p></div>
      <nav class="mpb-progress" data-mpb-progress aria-label="Pasos de creación"></nav>
      <div class="mpb-rail-status"><span data-mpb-rail-percent>0%</span><div><small>PROGRESO</small><strong data-mpb-rail-current>TIPO</strong></div></div>
    </aside>
    <section class="mpb-stage">
      <header class="mpb-stage-head"><div><small data-mpb-stage-kicker>DISEÑO DE CARRERA</small><strong data-mpb-stage-title>TIPO</strong></div><button type="button" class="mpb-close" data-mpb-close aria-label="Guardar y cerrar">×</button></header>
      <p data-mpb-local-save role="status" aria-live="polite" style="margin:0;padding:10px 16px;background:#eef5ed;font:600 13px/1.4 system-ui;color:#24583c"></p><main class="mpb-body" data-mpb-body></main>
      <footer class="mpb-foot" data-mpb-foot></footer>
    </section>
  </div>`;
  root.addEventListener("click",onClick);root.addEventListener("input",onInput);root.addEventListener("change",onInput);document.body.appendChild(root);state.root=root;return root;
}
function destroyMaps(){
  if(state.locationPressTimer){clearTimeout(state.locationPressTimer);state.locationPressTimer=null}
  closePrecisionPicker();try{state.planMap?.remove?.()}catch(_){ }try{state.locationMap?.remove?.()}catch(_){ }try{state.controlMap?.remove?.()}catch(_){ }try{state.routeMap?.remove?.()}catch(_){ }
  state.planMap=null;state.planBase=null;state.planMarker=null;state.locationMap=null;state.locationBase=null;state.locationMarker=null;state.controlMap=null;state.controlBase=null;state.controlMarkers=null;state.routeMap=null;state.routeBase=null;state.routeMarkers=null;state.routeLine=null;try{state.itineraryMap?.remove?.()}catch(_){ }state.itineraryMap=null;state.itineraryBase=null;state.itineraryLayer=null;state.itineraryMarkers=null;
}
function progress(){
  const target=$("[data-mpb-progress]",ensure());
  target.innerHTML=steps.map((label,i)=>`<button type="button" data-mpb-jump="${i}" class="${i===state.step?"is-active":""} ${i<state.step?"is-done":""}"><span class="mpb-progress-index">${i<state.step?"✓":String(i+1).padStart(2,"0")}</span><span class="mpb-progress-copy"><small>${esc(stepHints[i])}</small><b>${esc(label)}</b></span></button>`).join("");
  const pct=Math.round((state.step)/(steps.length-1)*100),current=steps[state.step];
  const p=$("[data-mpb-rail-percent]",state.root),c=$("[data-mpb-rail-current]",state.root),st=$("[data-mpb-stage-title]",state.root);if(p)p.textContent=`${pct}%`;if(c)c.textContent=current;if(st)st.textContent=current;
}
function footer(){
  const body=$("[data-mpb-body]",ensure()),f=$("[data-mpb-foot]",ensure()),last=state.step===steps.length-1;
  if(f)f.innerHTML="";if(!body)return;
  const placing=state.step===5&&state.controlsPhase==="placement";const reason=last?"":placing?controlsPlacementMessage():validateStep(state.step),locked=Boolean(reason);
  const back=`<button type="button" class="mpb-flow-btn mpb-flow-back" data-mpb-back ${state.step===0||state.busy||state.publishing?"disabled":""}><span>←</span><b>ATRÁS</b></button>`;
  const next=last?`<button type="button" class="mpb-flow-btn mpb-flow-next" data-mpb-publish-shortcut ${state.busy||state.publishing||lifecycleStatus()==="published"?"disabled":""}><b>${lifecycleStatus()==="published"?"PUBLICADA":"REVISAR PUBLICACIÓN"}</b><span>✓</span></button>`:`<button type="button" class="mpb-flow-btn mpb-flow-next ${locked?"is-locked":""}" data-mpb-next aria-disabled="${locked?"true":"false"}"><b>${locked?"CONTINUAR · PENDIENTE":state.busy?"PREPARANDO…":(placing?"CONTINUAR A IOF":"CONTINUAR")}</b><span>${locked?"🔒":"→"}</span></button>`;
  const save=`<button type="button" class="mpb-flow-btn mpb-flow-exit" data-mpb-save-exit ${state.busy||state.publishing?"disabled":""}><span>▣</span><b>${state.busy?"GUARDANDO…":"GUARDAR Y SALIR"}</b></button>`;
  const msg=state.blockerMessage||"";
  const existing=body.querySelector(".mpb-flow-actions");
  if(existing){
    // F2.25: conservar los nodos de botones al perder foco de un input. El
    // evento 'change' de Safari ocurre entre pointerdown y click: reconstruir
    // el footer en ese momento se comía la pulsación (incluso PUBLICAR).
    const backButton=existing.querySelector("[data-mpb-back]");
    if(backButton)backButton.disabled=state.step===0||state.busy||state.publishing;
    const saveButton=existing.querySelector("[data-mpb-save-exit]");
    if(saveButton){saveButton.disabled=state.busy||state.publishing;const label=saveButton.querySelector("b");if(label)label.textContent=state.busy?"GUARDANDO…":"GUARDAR Y SALIR";}
    const nextButton=existing.querySelector("[data-mpb-next],[data-mpb-publish-shortcut]");
    if(nextButton){
      nextButton.disabled=state.busy||state.publishing||(last&&lifecycleStatus()==="published");
      nextButton.classList.toggle("is-locked",!last&&locked);
      nextButton.setAttribute("aria-disabled",String(nextButton.disabled||(!last&&locked)));
      const label=nextButton.querySelector("b");if(label)label.textContent=last?(lifecycleStatus()==="published"?"PUBLICADA":"REVISAR PUBLICACIÓN"):(locked?"CONTINUAR · PENDIENTE":state.busy?"PREPARANDO…":placing?"CONTINUAR A IOF":"CONTINUAR");
    }
    const blocker=existing.querySelector(".mpb-flow-blocker");
    if(!msg)blocker?.remove();
    else if(blocker){const label=blocker.querySelector("span");if(label)label.textContent=msg;}
    else existing.insertAdjacentHTML("beforeend",`<div class="mpb-flow-blocker"><strong>FALTA PARA CONTINUAR</strong><span>${esc(msg)}</span></div>`);
    return;
  }
  body.insertAdjacentHTML("beforeend",`<div class="mpb-flow-actions" aria-label="Navegación del asistente">${back}${next}${save}${msg?`<div class="mpb-flow-blocker"><strong>FALTA PARA CONTINUAR</strong><span>${esc(msg)}</span></div>`:""}</div>`);
}

function field(id,label,type="text",value="",extra=""){return `<label class="mpb-field"><span>${label}</span><input id="${id}" type="${type}" value="${esc(value)}" ${extra}></label>`}
function stepHead(n,title,copy,tag="CONFIGURACIÓN"){return `<div class="mpb-step-copy"><div class="mpb-step-eyebrow"><span>${esc(tag)}</span><b>${String(n).padStart(2,"0")} / ${String(steps.length).padStart(2,"0")}</b></div><h2>${title}</h2><p>${copy}</p></div>`}

function renderType(){return `<section class="mpb-step">${stepHead(1,"¿Qué vas a organizar?","Elige la modalidad y MILITOPO adaptará el resto del creador para mostrar solo lo necesario.","INICIO")}
  <div class="mpb-type-grid">
    <button type="button" class="mpb-type ${state.draft.raceType==="competition"?"is-selected":""}" data-mpb-type="competition"><span class="mpb-type-icon">01</span><div><em>MODALIDAD</em><strong>COMPETICIÓN</strong><small>Categorías, clasificación y configuración competitiva.</small></div><i>${state.draft.raceType==="competition"?"SELECCIONADA":"ELEGIR"}</i></button>
    <button type="button" class="mpb-type ${state.draft.raceType==="training"?"is-selected":""}" data-mpb-type="training"><span class="mpb-type-icon">02</span><div><em>MODALIDAD</em><strong>ENTRENAMIENTO</strong><small>Flujo directo y limpio, sin opciones competitivas innecesarias.</small></div><i>${state.draft.raceType==="training"?"SELECCIONADO":"ELEGIR"}</i></button>
    <button type="button" class="mpb-type mpb-type-secondary" data-mpb-reuse><span class="mpb-type-icon">↻</span><div><em>REUTILIZACIÓN</em><strong>DESDE UNA CARRERA ANTERIOR</strong><small>Recupera una base existente y ajústala desde el asistente Premium.</small></div><i>ABRIR CARRERAS</i></button>
  </div>${state.mode==="create"&&hasRecoverableDraft()?`<button type="button" class="mpb-restore-local" data-mpb-restore-local>RECUPERAR BORRADOR LOCAL GUARDADO</button>`:""}</section>`}
function renderData(){return `<section class="mpb-step">${stepHead(2,"Dale identidad a la carrera","Nombre, descripción y capacidad prevista. Esta información acompañará al evento durante todo su ciclo.")}
  <div class="mpb-card mpb-form-card"><div class="mpb-form">${field("mpbName","NOMBRE DE LA CARRERA","text",state.draft.name,'maxlength="140" autocomplete="off" placeholder="Ej. Sierra Norte · Jornada 1"')}<label class="mpb-field mpb-field-wide"><span>DESCRIPCIÓN <em>OPCIONAL</em></span><textarea id="mpbDescription" maxlength="500" placeholder="Información breve para los participantes">${esc(state.draft.description)}</textarea></label>${field("mpbParticipants","PLAZAS PREVISTAS","number",state.draft.participantCount,'min="1" max="100" inputmode="numeric"')}</div></div>
  <div class="mpb-insight"><span>CONFIGURACIÓN ACTIVA</span><strong>${typeLabel(state.draft.raceType)}</strong><p>${state.draft.raceType==="competition"?"Las categorías y clasificación por categoría aparecerán más adelante.":"Las opciones competitivas permanecerán ocultas para mantener el flujo sencillo."}</p></div></section>`}
function customLibraryOptions(){const src=document.getElementById("orientationGeoTiffLibrary");if(!src)return `<option value="">— Sin plano guardado —</option>`;const selected=String(state.draft.customMapId||activeCustomMap()?.id||"");const renderNode=node=>{if(node.tagName==="OPTGROUP")return `<optgroup label="${esc(node.label)}">${[...node.children].map(renderNode).join("")}</optgroup>`;if(node.tagName==="OPTION")return `<option value="${esc(node.value)}" ${String(node.value)===selected?"selected":""}>${esc(node.textContent||"")}</option>`;return ""};return [...src.children].map(renderNode).join("")||`<option value="">— Sin plano guardado —</option>`}
function renderPlan(){const custom=activeCustomMap(),importText=state.importState?.message||"GeoTIFF / KMZ georreferenciado";return `<section class="mpb-step mpb-step-map">${stepHead(3,"Elige el plano y fija la zona","La cartografía se define antes de colocar controles para que todo el diseño nazca sobre la misma referencia.","CARTOGRAFÍA")}
  <div class="mpb-map-layout"><div class="mpb-map-choice mpb-card"><div class="mpb-section-label"><span>CAPA BASE</span><small>Selecciona una</small></div><div class="mpb-layer-grid">
    <button type="button" class="mpb-layer-card ${state.draft.mapLayer==="mapant"?"is-selected":""}" data-mpb-layer="mapant"><span>TOPO</span><div><strong>MAPANT</strong><small>Orientación y lectura del terreno.</small></div></button>
    <button type="button" class="mpb-layer-card ${state.draft.mapLayer==="ign"?"is-selected":""}" data-mpb-layer="ign"><span>IGN</span><div><strong>IGN</strong><small>Mapa raster oficial.</small></div></button>
    <button type="button" class="mpb-layer-card ${state.draft.mapLayer==="pnoa"?"is-selected":""}" data-mpb-layer="pnoa"><span>FOTO</span><div><strong>AÉREO</strong><small>PNOA para comprobar terreno real.</small></div></button>
    <button type="button" class="mpb-layer-card ${state.draft.mapLayer==="custom"?"is-selected":""}" data-mpb-layer="custom"><span>+</span><div><strong>MI PLANO</strong><small>${esc(custom?.name||state.draft.customMapName||"GeoTIFF / KMZ")}</small></div></button>
  </div><div class="mpb-custom-map-box ${state.draft.mapLayer==="custom"?"is-visible":""}"><label class="mpb-field"><span>PLANO GUARDADO</span><select id="mpbCustomMapLibrary">${customLibraryOptions()}</select></label><button type="button" class="mpb-btn mpb-btn-soft" data-mpb-import-plan>CARGAR PLANO · GEOTIFF / KMZ</button><small data-mpb-import-status>${esc(importText)}</small></div><div class="mpb-map-actions"><button type="button" class="mpb-btn mpb-btn-ghost" data-mpb-map-geolocate>CENTRAR EN MI UBICACIÓN</button><span>${state.draft.mapAreaConfirmed&&validWorkCenter()?`ZONA FIJADA · ${Number(state.draft.mapCenterLat).toFixed(4)}, ${Number(state.draft.mapCenterLon).toFixed(4)}`:"Toca el mapa para fijar la zona de trabajo"}</span></div></div>
  <div class="mpb-map-preview-wrap"><div id="mpbPlanMap" class="mpb-plan-map" aria-label="Vista previa del plano"></div></div></div></section>`}
function renderSchedule(){return `<section class="mpb-step">${stepHead(4,"Programa la carrera","Define la ventana operativa del evento. La hora informa y prepara; nunca inicia la carrera automáticamente.","TIEMPO")}
  <div class="mpb-card mpb-form-card"><div class="mpb-form mpb-form-two">${field("mpbStart","INICIO","datetime-local",state.draft.startAt)}${field("mpbEnd","FINAL PREVISTO","datetime-local",state.draft.endAt)}</div></div>
  <div class="mpb-schedule-preview"><div><small>INICIO</small><strong>${esc(fmtDate(state.draft.startAt))}</strong></div><span>→</span><div><small>FINAL PREVISTO</small><strong>${esc(fmtDate(state.draft.endAt))}</strong></div></div>
  <div class="mpb-insight"><span>CONTROL DEL ORGANIZADOR</span><strong>El estado EN DIRECTO siempre será manual</strong><p>La programación no cambia el estado por sí sola.</p></div></section>`}
function locationResultsHtml(){const rows=Array.isArray(state.locationResults)?state.locationResults:[];if(!rows.length)return "";return `<div class="mpb-location-results"><div class="mpb-section-label"><span>RESULTADOS</span><small>Selecciona el punto correcto</small></div>${rows.map((row,i)=>`<button type="button" data-mpb-location-result="${i}"><span>${i+1}</span><div><strong>${esc(row.title||row.displayName||"Ubicación")}</strong><small>${esc(row.displayName||"")}</small></div><b>SELECCIONAR</b></button>`).join("")}</div>`}
function renderLocation(){const embed=mapsEmbedUrl();return `<section class="mpb-step mpb-step-location">${stepHead(5,"Elige el punto de encuentro","Busca una dirección o ajusta el punto exacto en el mapa. Confirmar el punto es suficiente para continuar, sin hacer otra búsqueda.","UBICACIÓN")}
  <div class="mpb-location-layout"><div class="mpb-card mpb-location-search"><label class="mpb-field"><span>BUSCAR UBICACIÓN</span><div class="mpb-search-row"><input id="mpbLocationSearch" type="search" value="${esc(state.draft.locationName)}" maxlength="180" autocomplete="off" placeholder="Ej. Calle Mayor 10, Madrid · Casa de Campo · Cercedilla"><button type="button" class="mpb-btn mpb-btn-soft" data-mpb-location-search>BUSCAR</button></div></label>
    <small class="mpb-search-help">Escribe calle + ciudad, municipio, paraje o un lugar conocido. No necesitas introducir coordenadas.</small>
    <div class="mpb-location-actions"><button type="button" class="mpb-location-mini" data-mpb-geolocate>⌖ <span>MI UBICACIÓN</span></button><button type="button" class="mpb-location-mini" data-mpb-use-work-center ${validWorkCenter()?"":"disabled"}>◎ <span>CENTRO DEL PLANO</span></button></div>
    ${locationResultsHtml()}
    <div class="mpb-location-status"><span>${validCoords()?"UBICACIÓN SELECCIONADA":"SELECCIONA UNA UBICACIÓN"}</span><strong data-mpb-location-name>${esc(state.draft.locationName||"Madrid, España")}</strong><small data-mpb-location-help>${validCoords()?"Este punto será el centro inicial del mapa de CONTROLES.":"Busca un lugar o pulsa AJUSTAR PUNTO EXACTO y confirma el marcador."}</small></div></div>
    <div class="mpb-google-only"><iframe data-mpb-google-frame title="Google Maps · punto de encuentro" src="${esc(embed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" aria-label="Google Maps"></iframe></div>
    <div class="mpb-location-precision-action"><button type="button" class="mpb-btn mpb-btn-primary" data-mpb-precision-open>⌖ AJUSTAR PUNTO EXACTO</button><p>Google Maps sirve para consultar el entorno y elegir MAPA / SATÉLITE. Para fijar el punto con precisión, toca «AJUSTAR PUNTO EXACTO» y después el lugar exacto: sin mantener pulsado.</p></div></div></section>`}

function pointLabel(p){if(!p)return "PUNTO";return p.id==="START"?"SALIDA":p.id==="FINISH"?"LLEGADA":`BALIZA ${String(p.id).replace(/^B/,"")}`}
function pointIcon(p){return p?.id==="START"?"△":p?.id==="FINISH"?"◎":"○"}
function mapMarkerType(id){return id==="START"?"start":id==="FINISH"?"finish":"control"}
function mapMarkerLabel(id){if(id==="START"||id==="FINISH")return "";return String(id||"").replace(/^B/,"")}
// SVG markers use an identical square viewBox and Leaflet anchor on every map.
// Keeping text inside SVG avoids legacy CSS squeezing numbers into vertical columns.
function mapMarkerHtml(id,{selected=false,order=null,variant="default"}={}){
  const type=mapMarkerType(id),label=esc(mapMarkerLabel(id));
  const focus=selected?'<circle cx="16" cy="16" r="14.1" fill="none" stroke="#ffffff" stroke-width="1.8"/>':"";
  const shape=type==="start"
    ?'<path d="M16 5.8 L5.7 25.2 L26.3 25.2 Z" fill="#ffffff" stroke="#248854" stroke-width="2.6" stroke-linejoin="round"/>'
    :type==="finish"
      ?'<circle cx="16" cy="16" r="11" fill="#ffffff" stroke="#c94c48" stroke-width="2.5"/><circle cx="16" cy="16" r="7.2" fill="none" stroke="#c94c48" stroke-width="2.1"/>'
      :`<circle cx="16" cy="16" r="11" fill="${selected?"#fff4d8":"#fffcf5"}" stroke="${selected?"#b47a0f":"#d3a028"}" stroke-width="2.5"/><text x="16" y="19.1" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="${label.length>=3?"8":"9.5"}" font-weight="800" fill="#17271e">${label}</text>`;
  const number=Number.isFinite(order)&&type==="control"?`<circle cx="26.2" cy="5.8" r="5.2" fill="#173d2b" stroke="#ffffff" stroke-width="1"/><text x="26.2" y="8.2" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="6.4" font-weight="800" fill="#ffffff">${order}</text>`:"";
  return `<svg class="mpb-pin-svg" viewBox="0 0 32 32" width="28" height="28" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(type==="start"?"Salida":type==="finish"?"Llegada":`Baliza ${label}`)}">${focus}${shape}${number}</svg>`;
}
function mapMarkerIcon(html){return L.divIcon({html,className:"mpb-geometry-icon",iconSize:[28,28],iconAnchor:[14,14]})}
function optionHtml(options,current){return (options||[]).map(o=>`<option value="${esc(o.value)}" ${String(o.value)===String(current||"")?"selected":""}>${esc(o.label||o.text||"—")}</option>`).join("")}
function iofEditorHtml(selected){
  if(!selected)return "";
  const model=r2()?.getIofModel?.(selected.id);if(!model)return `<div class="mpb-iof-card"><p>El editor IOF se está preparando…</p></div>`;
  const special=selected.id==="START"||selected.id==="FINISH";
  const status=model.complete?"is-complete":model.placed?"is-pending":"is-blocked";
  return `<section class="mpb-iof-card ${status}"><div class="mpb-iof-head"><div><span>DESCRIPCIÓN IOF</span><strong>${esc(pointLabel(selected))}</strong></div><b>${model.complete?"COMPLETA":model.placed?"PENDIENTE":"COLOCA EL PUNTO"}</b></div>
    <div class="mpb-iof-preview" aria-label="Vista previa IOF">${model.previewHtml||""}</div>
    ${special?`<div class="mpb-iof-fixed"><span>${selected.id==="START"?"△":"◎"}</span><div><strong>${selected.id==="START"?"SALIDA":"LLEGADA"}</strong><small>También puedes completar C, D, E, F, G y H para conservar la misma edición en tabla IOF y PDF.</small></div></div>`:""}
    <div class="mpb-iof-fields">
      ${[["c","C · SIMILAR"],["d","D · ELEMENTO"],["e","E · ASPECTO"],["f","F · DIMENSIÓN"],["g","G · SITUACIÓN"],["h","H · INFO"]].map(([key,label])=>`<label><span>${label}</span><select data-mpb-iof-field="${key}" data-mpb-iof-point="${esc(selected.id)}" ${model.placed?"":"disabled"}>${optionHtml(model.options?.[key],model.description?.[key])}</select></label>`).join("")}
      <label class="mpb-iof-text"><span>TEXTO / NOTA <em>OPCIONAL</em></span><input type="text" data-mpb-iof-field="text" data-mpb-iof-point="${esc(selected.id)}" value="${esc(model.description?.text||"")}" maxlength="120" ${model.placed?"":"disabled"} placeholder="Observación auxiliar"></label>
    </div>
    <div class="mpb-iof-actions">${model.complete?`<button type="button" class="mpb-btn mpb-btn-ghost" data-mpb-iof-pending="${esc(selected.id)}">EDITAR / MARCAR PENDIENTE</button>`:""}<button type="button" class="mpb-btn mpb-btn-primary" data-mpb-iof-save-next="${esc(selected.id)}" ${model.placed?"":"disabled"}>${model.complete?"SIGUIENTE PUNTO":"GUARDAR Y SIGUIENTE"} <span>→</span></button></div>
    ${model.readableText?`<p class="mpb-iof-readable">${esc(model.readableText)}</p>`:""}
  </section>`;
}
function controlsPlacementMessage(){
  const list=controlOrder(),missing=list.filter(p=>!pointPlaced(p));
  return missing.length?`Falta colocar ${missing.slice(0,6).map(pointLabel).join(", ")}${missing.length>6?"…":""} (${list.length-missing.length}/${list.length}).`:"";
}
function controlStripHtml(list){return `<div class="mpb-control-strip" aria-label="Selección de puntos">${list.map(p=>`<button type="button" class="${p.id===state.selectedControlId?"is-selected":""} ${pointPlaced(p)?"is-placed":""}" data-mpb-point="${esc(p.id)}"><span>${pointPlaced(p)?"✓":pointIcon(p)}</span><small>${esc(p.id==="START"?"SAL":p.id==="FINISH"?"META":p.id)}</small></button>`).join("")}</div>`}
function controlsPanelHtml(s=snapshot()){
  const list=controlOrder(s),placed=list.filter(pointPlaced).length,total=list.length,controls=s?.controls||[],selected=list.find(p=>p.id===state.selectedControlId)||list[0],iof=iofSummary(),positionMode=state.controlsPhase!=="iof";
  const summary=`<div class="mpb-controls-summary"><article class="${pointPlaced(list[0])?"is-ok":""}"><small>SALIDA</small><strong>${pointPlaced(list[0])?"LISTA":"PENDIENTE"}</strong></article><article class="${placed===total?"is-ok":""}"><small>PUNTOS</small><strong>${placed}/${total}</strong></article><article class="${pointPlaced(list.at(-1))?"is-ok":""}"><small>LLEGADA</small><strong>${pointPlaced(list.at(-1))?"LISTA":"PENDIENTE"}</strong></article><article class="${iof.allComplete?"is-ok":""}"><small>IOF</small><strong>${iof.complete}/${iof.total}</strong></article></div>`;
  if(!positionMode)return `${summary}${controlStripHtml(list)}<div class="mpb-selected-control"><div><small>DESCRIPCIÓN SELECCIONADA</small><strong>${esc(pointLabel(selected))}</strong><span>Edita y guarda las columnas C–H. La geometría queda conservada.</span></div><b>IOF</b></div>${iofEditorHtml(selected)}<button type="button" class="mpb-btn mpb-btn-ghost mpb-back-to-place" data-mpb-controls-phase="placement">← VOLVER A COLOCAR PUNTOS</button>`;
  const methods=[{id:"map",icon:"map-pin",name:"SOBRE EL MAPA",detail:"Toca para situar cada punto"},{id:"manual",icon:"crosshair",name:"COORDENADAS",detail:"UTM o latitud / longitud"},{id:"atak",icon:"atak",name:"IMPORTAR ATAK",detail:"Archivo GPX de waypoints"}];
  const methodCards=`<div class="mpb-placement-methods">${methods.map(m=>`<button type="button" class="mpb-placement-method ${state.controlMethod===m.id?"is-active":""}" data-mpb-control-method="${m.id}">${m.id==="atak"?'<img src="../assets/atak.png" alt="Logo ATAK" loading="lazy">':`<span class="mpb-method-symbol">${m.id==="map"?"⌖":"UTM"}</span>`}<strong>${m.name}</strong><small>${m.detail}</small></button>`).join("")}</div>`;
  const selectedUtm=String(selected?.utm||""),lat=pointPlaced(selected)?Number(selected.lat).toFixed(6):"",lon=pointPlaced(selected)?Number(selected.lon).toFixed(6):"";
  const coordinateCard=`<div class="mpb-coordinates-card"><div class="mpb-section-label"><span>${esc(pointLabel(selected))}</span><small>WGS84</small></div><div class="mpb-coordinate-switch"><button type="button" data-mpb-coord-format="utm" class="${state.coordFormat!=="latlon"?"is-current":""}">UTM</button><button type="button" data-mpb-coord-format="latlon" class="${state.coordFormat==="latlon"?"is-current":""}">LATITUD / LONGITUD</button></div>${state.coordFormat==="latlon"?`<div class="mpb-coordinate-fields"><label>LATITUD<input id="mpbPointLat" type="text" inputmode="decimal" autocomplete="off" placeholder="40.416800" value="${esc(lat)}"></label><label>LONGITUD<input id="mpbPointLon" type="text" inputmode="decimal" autocomplete="off" placeholder="-3.703800" value="${esc(lon)}"></label></div>`:`<label class="mpb-coordinate-utm">COORDENADA UTM<input id="mpbPointUtm" type="text" autocapitalize="characters" spellcheck="false" autocomplete="off" placeholder="30T 463941 4106198" value="${esc(selectedUtm)}"></label>`}<p>Selecciona SALIDA, una baliza o LLEGADA; introduce sus coordenadas y guarda. Las dos formas quedan sincronizadas en MILITOPO.</p><button class="mpb-btn mpb-btn-primary" type="button" data-mpb-save-coordinates>GUARDAR PUNTO Y SIGUIENTE →</button></div>`;
  const preview=state.atakPreview;
  const atakCard=`<div class="mpb-atak-panel"><div class="mpb-atak-brand"><img src="../assets/atak.png" alt="ATAK"><div><strong>IMPORTACIÓN ATAK · GPX</strong><small>Recupera START, FINISH y B01–B${String(controls.length).padStart(2,"0")}</small></div></div><button type="button" class="mpb-btn mpb-btn-soft" data-mpb-choose-atak>SELECCIONAR ARCHIVO GPX</button><input id="mpbAtakFile" type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" hidden><small>El archivo se analiza antes de aplicar ningún cambio.</small>${preview?`<div class="mpb-atak-summary"><strong>${esc(state.atakFileName||"Archivo GPX")}</strong><b>${preview.matches.length} coincidencia${preview.matches.length===1?"":"s"}</b>${preview.error?`<p class="is-error">${esc(preview.error)}</p>`:""}<div class="mpb-atak-points">${preview.matches.map(p=>`<span>✓ ${esc(p.id)}</span>`).join("")}</div>${preview.skipped.length?`<p>${preview.skipped.length} punto(s) omitidos: ${esc(preview.skipped.slice(0,5).map(x=>`${x.id} (${x.reason})`).join(" · "))}</p>`:""}</div><button type="button" class="mpb-btn mpb-btn-primary" data-mpb-apply-atak ${preview.matches.length?"":"disabled"}>REVISADO · IMPORTAR ${preview.matches.length} PUNTOS</button>`:""}</div>`;
  return `${summary}<div class="mpb-control-toolbar"><div><span>BALIZAS TOTALES</span><strong>${controls.length}</strong></div><div><button type="button" data-mpb-control-count="-1" aria-label="Quitar una baliza">−</button><button type="button" data-mpb-control-count="1" aria-label="Añadir una baliza">+</button></div></div><p class="mpb-placement-label">¿CÓMO QUIERES COLOCAR LOS PUNTOS?</p>${methodCards}<div class="mpb-selected-control"><div><small>PUNTO ACTIVO</small><strong>${esc(pointLabel(selected))}</strong><span>${pointPlaced(selected)?"Colocado. Puedes corregir su posición o pasar a otro.":"Aún no colocado."}</span></div><b>${pointPlaced(selected)?"✓":"+"}</b></div>${controlStripHtml(list)}${state.controlMethod==="manual"?coordinateCard:state.controlMethod==="atak"?atakCard:`<p class="mpb-controls-hint">Toca el mapa para colocar <strong>${esc(pointLabel(selected))}</strong>. Después elige el siguiente punto; puedes alternar a coordenadas o ATAK cuando quieras.</p>`}<div class="mpb-control-actions"><button type="button" class="mpb-btn mpb-btn-ghost" data-mpb-fit-controls>VER TODOS</button><button type="button" class="mpb-btn mpb-btn-danger" data-mpb-clear-point ${pointPlaced(selected)?"":"disabled"}>BORRAR PUNTO</button></div><div class="mpb-controls-progress"><i style="width:${total?Math.round(placed/total*100):0}%"></i></div><p class="mpb-controls-hint ${placed===total?"is-done":""}">${placed===total?"Todos los puntos colocados. Pulsa CONTINUAR A IOF para editar sus descripciones.":controlsPlacementMessage()}</p>`;
}
function renderControls(){const positionMode=state.controlsPhase!=="iof";return `<section class="mpb-step mpb-step-controls">${stepHead(6,positionMode?"Coloca los puntos de la carrera":"Completa las descripciones IOF",positionMode?"Primero configura SALIDA, balizas y LLEGADA mediante mapa, coordenadas o ATAK. Después editarás las descripciones IOF.":"Con todos los puntos colocados, completa las columnas IOF. Puedes volver a la colocación sin perder ningún dato.","DISEÑO TÉCNICO")}
  <div class="mpb-control-substeps"><span class="${positionMode?"is-active":"is-done"}">01 · COLOCACIÓN</span><span class="${positionMode?"":"is-active"}">02 · DESCRIPCIONES IOF</span></div>
  <div class="mpb-controls-layout ${positionMode?"":"is-iof-only"}"><aside class="mpb-controls-panel mpb-card" data-mpb-controls-panel>${controlsPanelHtml()}</aside>${positionMode?`<div class="mpb-controls-map-wrap"><div id="mpbControlsMap" class="mpb-controls-map" aria-label="Mapa para colocar controles"></div><div class="mpb-map-badge"><small>${esc(mapLabel(state.draft.mapLayer))}</small><strong>${state.controlMethod==="map"?"TOCA PARA COLOCAR":"VISTA DE REFERENCIA"}</strong></div></div>`:""}</div></section>`}

function existingRouteCount(){return Number(snapshot()?.routeCount)||0}
// F2.28: el render no debe sobrescribir la edición de un recorrido guardado.
function ensureRouteSelection(){
  const previous=state.selectedRouteId;
  const count=routeTargetCount();
  const n=Math.max(1,Math.min(count,Number(String(previous||"R01").replace(/\D/g,""))||1));
  const selected=routeId(n);
  if(previous!==selected||!Array.isArray(state.routeDraftControls)){
    state.selectedRouteId=selected;
    const pending=state.draft?.pendingRouteEditors?.[selected]||(state.draft?.pendingRouteEditor?.id===selected?state.draft.pendingRouteEditor:null);
    const saved=routeDetails(selected);
    state.routeDraftControls=pending?.id===selected&&Array.isArray(pending.controls)?[...pending.controls]:Array.isArray(saved?.controls)?[...saved.controls]:[];
  }
}
function routeListHtml(){const count=routeTargetCount(),per=controlsPerRoute();return `<div class="mpb-route-list">${Array.from({length:count},(_,i)=>{const id=routeId(i+1),d=routeDetails(id),ok=Boolean(d&&!routeDesignProblem(id));return `<button type="button" data-mpb-route="${id}" class="${id===state.selectedRouteId?"is-selected":""} ${ok?"is-complete":""}"><span>${ok?"✓":String(i+1).padStart(2,"0")}</span><div><strong>${id}</strong><small>${ok?`${d.controls.length} controles · completo`:"Pendiente"}</small></div></button>`}).join("")}</div>`}
function routeOrderHtml(){const per=controlsPerRoute();return `<div class="mpb-route-order"><span class="is-fixed">SALIDA</span>${Array.from({length:per},(_,i)=>{const id=state.routeDraftControls[i];return id?`<button type="button" data-mpb-route-control="${esc(id)}"><b>${i+1}</b>${esc(id)}<i>×</i></button>`:`<span class="is-empty"><b>${i+1}</b>CONTROL</span>`}).join("")}<span class="is-fixed ${state.routeDraftControls.length===per?"is-connected":"is-waiting"}">${state.routeDraftControls.length===per?"✓ LLEGADA":"○ LLEGADA PENDIENTE"}</span></div>`}
function routeControlsHtml(){const controls=(snapshot()?.controls||[]).filter(pointPlaced).sort((a,b)=>String(a.id).localeCompare(String(b.id),undefined,{numeric:true}));return `<div class="mpb-route-control-grid">${controls.map(p=>{const idx=state.routeDraftControls.indexOf(p.id);return `<button type="button" data-mpb-route-control="${esc(p.id)}" class="${idx>=0?"is-selected":""}"><span>${idx>=0?idx+1:"+"}</span><strong>${esc(p.id)}</strong></button>`}).join("")}</div>`}
function renderRoutesStep(){ensureRouteSelection();const target=routeTargetCount(),existing=existingRouteCount(),per=controlsPerRoute(),complete=Array.from({length:target},(_,i)=>!routeDesignProblem(routeId(i+1))).filter(Boolean).length;return `<section class="mpb-step mpb-step-routes">${stepHead(7,"Crea los recorridos manualmente","Elige cada recorrido y añade las balizas en el orden exacto de paso. MILITOPO no genera recorridos automáticamente.","RECORRIDOS")}
  <div class="mpb-route-layout"><aside class="mpb-route-panel mpb-card">
    <div class="mpb-route-config"><label><span>Nº DE RECORRIDOS</span><input id="mpbRouteCount" type="number" min="1" max="${Math.max(1,Math.min(30,Number(state.draft.participantCount)||1))}" value="${target}"></label><label><span>BALIZAS / RECORRIDO</span><input id="mpbControlsPerRoute" type="number" min="1" max="${Math.max(1,state.draft.controlCount)}" value="${per}"></label></div>
    <div class="mpb-section-label"><span>RECORRIDOS</span><small>${complete}/${target} completos</small></div>${routeListHtml()}
    <div class="mpb-route-builder"><div class="mpb-route-builder-head"><div><span>EDITANDO</span><strong>${esc(state.selectedRouteId)}</strong></div><b>${state.routeDraftControls.length}/${per}</b></div>
      <div class="mpb-route-edit-actions"><button type="button" data-mpb-route-undo ${state.routeDraftControls.length?"":"disabled"}>↶ DESHACER ÚLTIMO</button><button type="button" data-mpb-route-restore ${routeDetails(state.selectedRouteId)?"":"disabled"}>↺ RESTAURAR GUARDADO</button><button type="button" class="is-danger" data-mpb-route-clear ${state.routeDraftControls.length?"":"disabled"}>LIMPIAR RECORRIDO</button></div>
      <small class="mpb-route-edit-help">Puedes editar un recorrido guardado: añade las balizas nuevas, toca una seleccionada para quitarla o pulsa DESHACER ÚLTIMO. Los cambios no sustituyen el recorrido guardado hasta pulsar ACTUALIZAR RECORRIDO. LIMPIAR elimina el recorrido completo solo con confirmación.</small>${routeOrderHtml()}<div class="mpb-section-label"><span>AÑADIR BALIZAS</span><small>En orden</small></div>${routeControlsHtml()}
      <button type="button" class="mpb-btn mpb-btn-primary mpb-route-save" data-mpb-save-route ${state.routeDraftControls.length===per&&!state.routeBusy?"":"disabled"}>${state.routeBusy?"GUARDANDO RECORRIDO…":routeDetails(state.selectedRouteId)?"ACTUALIZAR RECORRIDO":"GUARDAR RECORRIDO"}</button>
    </div>
  </aside><div class="mpb-route-map-wrap"><div id="mpbRouteMap" class="mpb-route-map" aria-label="Vista del recorrido manual"></div><div class="mpb-map-badge"><small>${esc(state.selectedRouteId)}</small><strong>${state.routeDraftControls.length}/${per} BALIZAS</strong></div></div></div></section>`}
function itineraryRouteListHtml(){const count=routeTargetCount();return `<div class="mpb-itinerary-route-list">${Array.from({length:count},(_,i)=>{const id=routeId(i+1),done=itineraryComplete(id);return `<button type="button" data-mpb-itinerary-route="${id}" class="${id===state.selectedRouteId?"is-selected":""} ${done?"is-complete":""}"><span>${done?"✓":String(i+1).padStart(2,"0")}</span><strong>${id}</strong></button>`}).join("")}</div>`}
function loadItineraryDraft(id){state.selectedRouteId=String(id||"R01");const saved=savedItinerary(state.selectedRouteId),pending=state.draft?.pendingItineraryEditors?.[state.selectedRouteId]||(state.draft?.pendingItineraryEditor?.id===state.selectedRouteId?state.draft.pendingItineraryEditor:null);state.itineraryDraftPoints=(pending?.id===state.selectedRouteId&&Array.isArray(pending.points)?pending.points:saved?.points)?.map(p=>({lat:Number(p.lat),lon:Number(p.lon),anchorId:p.anchorId||null}))||routeAnchorPoints(state.selectedRouteId);state.itineraryDirty=Boolean(pending?.id===state.selectedRouteId)}
function renderItinerary(){if(!state.itineraryDraftPoints.length)loadItineraryDraft(state.selectedRouteId);const sum=itinerarySummary(),count=routeTargetCount(),done=Array.from({length:count},(_,i)=>itineraryComplete(routeId(i+1))).filter(Boolean).length;return `<section class="mpb-step mpb-step-itinerary">${stepHead(8,"Dibuja el itinerario real","MILITOPO parte de la línea directa entre controles. Toca el mapa para añadir vértices por los caminos reales y ajusta el recorrido a lo que se puede transitar.","ITINERARIO REAL")}<div class="mpb-itinerary-layout"><aside class="mpb-itinerary-panel mpb-card"><div class="mpb-section-label"><span>RECORRIDO</span><small>${done}/${count} guardados</small></div>${itineraryRouteListHtml()}<div class="mpb-itinerary-metrics"><article><small>DISTANCIA DIRECTA</small><strong>${formatKm(sum.direct)}</strong></article><article><small>ITINERARIO ESTIMADO</small><strong>${formatKm(sum.real)}</strong></article><article><small>DIFERENCIA</small><strong>${sum.direct?`${sum.diff>=0?"+":""}${sum.diff.toFixed(0)} %`:"—"}</strong></article></div><div class="mpb-itinerary-actions"><button type="button" data-mpb-itinerary-undo ${state.itineraryDraftPoints.some(p=>!p.anchorId)?"":"disabled"}>↶ DESHACER VÉRTICE</button><button type="button" data-mpb-itinerary-reset>↺ VOLVER A LÍNEA DIRECTA</button></div><p class="mpb-itinerary-help">Toca el mapa cerca del tramo que quieras desviar. MILITOPO insertará un vértice en ese segmento. Los puntos de control permanecen fijos.</p><button type="button" class="mpb-btn mpb-btn-primary" data-mpb-itinerary-save>GUARDAR ITINERARIO ${esc(state.selectedRouteId)}</button></aside><div class="mpb-itinerary-map-wrap"><div id="mpbItineraryMap" class="mpb-itinerary-map" aria-label="Editor del itinerario real"></div><div class="mpb-map-badge mpb-map-badge-bottom"><small>${esc(state.selectedRouteId)}</small><strong>TOCA PARA AÑADIR VÉRTICES</strong></div></div></div></section>`}
function preflightItems(){const s=snapshot(),io=iofSummary(),routeCount=routeTargetCount(),pointError=pointDesignProblem(s),routeErrors=Array.from({length:routeCount},(_,i)=>routeDesignProblem(routeId(i+1),s)),itineraryErrors=Array.from({length:routeCount},(_,i)=>itineraryDesignProblem(routeId(i+1),s)),routeDone=routeErrors.filter(x=>!x).length,itDone=itineraryErrors.filter((x,i)=>!x&&!routeErrors[i]).length,a=new Date(state.draft.startAt),b=new Date(state.draft.endAt);return [
  {label:"Datos de carrera",ok:String(state.draft.name||"").trim().length>=3,detail:state.draft.name||"Nombre pendiente",step:1},
  {label:"Plano y zona",ok:["mapant","ign","pnoa","custom"].includes(state.draft.mapLayer)&&validWorkCenter(),detail:`${mapLabel(state.draft.mapLayer)} · zona ${validWorkCenter()?"fijada":"pendiente"}`,step:2},
  {label:"Horario",ok:!Number.isNaN(a.getTime())&&!Number.isNaN(b.getTime())&&b>a,detail:`${fmtDate(state.draft.startAt)} → ${fmtDate(state.draft.endAt)}`,step:3},
  {label:"Punto de encuentro",ok:validCoords(),detail:validCoords()?(state.draft.locationName||"Punto exacto seleccionado"):"Ubicación pendiente",step:4},
  {label:"Controles",ok:!pointError,detail:pointError||`${controlOrder(s).length} puntos colocados y válidos`,step:5},
  {label:"Descripciones IOF",ok:io.allComplete,detail:`${io.complete}/${io.total} completas`,step:5},
  {label:"Recorridos",ok:!pointError&&routeDone===routeCount&&routeCount>0,detail:pointError||routeErrors.find(Boolean)||`${routeDone}/${routeCount} válidos`,step:6},
  {label:"Itinerarios reales",ok:!pointError&&routeDone===routeCount&&itDone===routeCount&&routeCount>0,detail:pointError||routeErrors.find(Boolean)||itineraryErrors.find(Boolean)||`${itDone}/${routeCount} válidos`,step:7}
]}
function publicationAvailability(ready=preflightReady(),editable=["draft","prepared"].includes(lifecycleStatus())){
  if(state.publishing)return "Publicación en curso. Espera a que termine.";
  if(!navigator.onLine)return "Sin conexión. Recupera Internet para publicar.";
  if(!editable)return "El estado actual no permite publicar esta carrera.";
  if(state.publicationError&&publicationIsCurrent(state.publicationError.token))return state.publicationError.message;
  if(!ready)return "Completa los requisitos pendientes antes de publicar.";
  return "Disponible para publicar tras tu confirmación.";
}
function refreshPublicationAvailability(){
  if(!state.opened)return;
  const button=state.root?.querySelector("[data-mpb-publish]");if(!button)return;
  const ready=preflightReady(),editable=["draft","prepared"].includes(lifecycleStatus());
  button.disabled=!ready||!editable||state.publishing||!navigator.onLine;
  button.setAttribute("aria-disabled",String(button.disabled));
  button.textContent=state.publishing?"PUBLICANDO…":"PUBLICAR CARRERA";
  const note=state.root.querySelector("#mpbPublishAvailability");if(note)note.textContent=publicationAvailability(ready,editable);
}
function renderReview(){const items=preflightItems(),done=items.filter(x=>x.ok).length,pct=Math.round(done/items.length*100),all=done===items.length,status=lifecycleStatus(),published=status==="published",canPublish=["draft","prepared"].includes(status);return `<section class="mpb-step mpb-step-preflight">${stepHead(9,"Revisión final y publicación","MILITOPO comprueba el diseño completo. Desde aquí puedes descargar el paquete final y publicar sin pasar por un estado intermedio visible.","PREFLIGHT")}
  <div class="mpb-preflight-hero ${all?"is-ready":"is-pending"}"><div><span>PREPARACIÓN DE LA CARRERA</span><strong>${pct}% ${all?"LISTA":"COMPLETA"}</strong><p>${all?"El diseño está completo. Puedes descargar el ZIP y publicar la carrera.":`${items.length-done} requisitos pendientes antes de publicar.`}</p></div><b>${pct}%</b></div>
  <div class="mpb-preflight-list">${items.map(x=>`<article class="${x.ok?"is-ok":"is-pending"}"><span>${x.ok?"✓":"!"}</span><div><strong>${esc(x.label)}</strong><small>${esc(x.detail)}</small></div>${x.ok?`<b>COMPLETO</b>`:`<button type="button" data-mpb-jump="${x.step}">CORREGIR →</button>`}</article>`).join("")}</div>
  <div class="mpb-preflight-actions">
    <article class="mpb-preflight-action-card"><div><small>PAQUETE DEL ORGANIZADOR</small><strong>ZIP COMPLETO DE LA CARRERA</strong><p>Planos PDF, QR, descripciones IOF, GPX, datos del evento y diseño Premium.</p></div><button type="button" data-mpb-download-package ${all&&!state.packageBusy?"":"disabled"}>${state.packageBusy?"GENERANDO ZIP…":"DESCARGAR ZIP"}</button></article>
    <article class="mpb-preflight-action-card is-publish"><div><small>ESTADO · ${esc(lifecycleLabel(status))}</small><strong>${published?"CARRERA PUBLICADA":"PUBLICAR CARRERA"}</strong><p>${published?"Las invitaciones ya están habilitadas.":"MILITOPO gestiona PREPARADO internamente; tú solo confirmas PUBLICAR una vez."}</p></div>${published?`<button type="button" data-mpb-open-participants>INVITAR PARTICIPANTES →</button>`:`<button type="button" data-mpb-publish aria-disabled="${!all||!canPublish||state.publishing||!navigator.onLine}" aria-describedby="mpbPublishAvailability" ${all&&canPublish&&!state.publishing&&navigator.onLine?"":"disabled"}>${state.publishing?"PUBLICANDO…":"PUBLICAR CARRERA"}</button><p id="mpbPublishAvailability" role="status" aria-live="polite">${esc(publicationAvailability(all,canPublish))}</p>`}</article>
  </div>
  ${!all?`<div class="mpb-insight"><span>PUBLICACIÓN BLOQUEADA</span><strong>Completa primero los requisitos pendientes</strong><p>Los botones de ZIP y publicación se habilitan al alcanzar el 100 %.</p></div>`:""}
</section>`}

function render(){
  destroyMaps();draftSaveStatus(state.localSaveMessage||"Los cambios se guardan en este dispositivo",Boolean(state.localSaveError));const title=$("[data-mpb-title]",ensure());if(title)title.textContent=state.eventId?"PREPARAR CARRERA":"NUEVA CARRERA";progress();
  const body=$("[data-mpb-body]",ensure());body.innerHTML=[renderType,renderData,renderPlan,renderSchedule,renderLocation,renderControls,renderRoutesStep,renderItinerary,renderReview][state.step]();footer();body.scrollTop=0;
  if(state.step===2)setTimeout(initPlanMap,40);if(state.step===5&&state.controlsPhase==="placement")setTimeout(initControlsMap,40);if(state.step===6)setTimeout(initRoutesMap,40);if(state.step===7)setTimeout(initItineraryMap,40);
}
function syncInputs(){
  const v=id=>$("#"+id,state.root)?.value;
  if($("#mpbName",state.root))state.draft.name=String(v("mpbName")||"").trimStart();if($("#mpbDescription",state.root))state.draft.description=String(v("mpbDescription")||"");if($("#mpbParticipants",state.root))state.draft.participantCount=Math.max(1,Math.min(100,Number(v("mpbParticipants"))||1));
  if($("#mpbStart",state.root))state.draft.startAt=String(v("mpbStart")||"");if($("#mpbEnd",state.root))state.draft.endAt=String(v("mpbEnd")||"");if($("#mpbLocationSearch",state.root)){if(!validCoords())state.draft.locationName=String(v("mpbLocationSearch")||"").trimStart();else if(!String(state.draft.locationName||"").trim())state.draft.locationName="Punto seleccionado en el mapa";}
  if($("#mpbRouteCount",state.root)){state.draft.routeCount=Math.max(1,Math.min(Math.max(1,Math.min(30,Number(state.draft.participantCount)||1)),Math.trunc(Number(v("mpbRouteCount"))||1)))}
  if($("#mpbControlsPerRoute",state.root))state.draft.controlsPerRoute=Math.max(1,Math.min(Math.max(1,state.draft.controlCount),Math.trunc(Number(v("mpbControlsPerRoute"))||1)));
  saveDraft();
}
function validateStep(step=state.step){
  syncInputs();
  if(step===1&&state.draft.name.trim().length<3)return "Pon un nombre de al menos 3 caracteres.";
  if(step===2){if(!["mapant","ign","pnoa","custom"].includes(state.draft.mapLayer))return "Selecciona el plano de la carrera.";if(state.draft.mapLayer==="custom"&&!activeCustomMap())return "Carga o selecciona un plano propio antes de continuar.";if(!state.draft.mapAreaConfirmed||!validWorkCenter())return "Fija la zona de trabajo tocando el mapa o usando tu ubicación."}
  if(step===3){const a=new Date(state.draft.startAt),b=new Date(state.draft.endAt);if(Number.isNaN(a.getTime())||Number.isNaN(b.getTime()))return "Indica el inicio y el final previsto.";if(b<=a)return "El final previsto debe ser posterior al inicio."}
  if(step===4&&!validCoords())return "Selecciona una ubicación: busca un lugar o pulsa AJUSTAR PUNTO EXACTO y confirma el marcador.";
  if(step===5){const issue=pointDesignProblem();if(issue)return issue;const missing=controlOrder().filter(p=>!pointPlaced(p)).map(p=>pointLabel(p)),io=iofSummary(),parts=[];if(missing.length)parts.push(`colocar ${missing.slice(0,5).join(", ")}${missing.length>5?"…":""}`);if(!io.allComplete)parts.push(`IOF pendiente: ${io.pending.slice(0,5).join(", ")}${io.pending.length>5?"…":""}`);if(parts.length)return `Pendiente: ${parts.join(" · ")}.`}
  if(step===6&&!routesComplete()){const s=snapshot(),specific=pointDesignProblem(s)||Array.from({length:routeTargetCount()},(_,i)=>routeDesignProblem(routeId(i+1),s)).find(Boolean);if(specific)return specific;const per=controlsPerRoute(),pending=[];for(let i=1;i<=routeTargetCount();i++){const id=routeId(i),d=routeDetails(id);if(!d||d.controls?.length!==per)pending.push(id)}return `Pendiente: guardar ${pending.slice(0,6).join(", ")}${pending.length>6?"…":""}.`}
  if(step===7&&!itinerariesComplete()){const s=snapshot(),specific=pointDesignProblem(s)||Array.from({length:routeTargetCount()},(_,i)=>routeDesignProblem(routeId(i+1),s)||itineraryDesignProblem(routeId(i+1),s)).find(Boolean);if(specific)return specific;const pending=[];for(let i=1;i<=routeTargetCount();i++){const id=routeId(i);if(!itineraryComplete(id))pending.push(id)}return `Pendiente: guardar itinerario real de ${pending.slice(0,6).join(", ")}${pending.length>6?"…":""}.`}
  return "";
}
function notify(msg){if(bridge()?.toast?.(msg)!==true){const n=document.createElement("div");n.className="mpb-toast";n.textContent=msg;document.body.appendChild(n);setTimeout(()=>n.remove(),2800)}}

async function ensureEventForControls(){
  if(state.eventId)return true;if(state.busy)return false;state.busy=true;footer();
  try{
    const b=bridge();if(!b?.event?.createDraftDirect){notify("El creador todavía no está listo. Cierra y vuelve a abrir MILITOPO.");return false}
    const created=await b.event.createDraftDirect();if(created!==true)return false;await new Promise(r=>setTimeout(r,100));applyLegacyBasics();try{b.event.saveRules()}catch(error){console.warn("[MILITOPO Premium Builder] reglas",error)}applySelectedPlan();await new Promise(r=>setTimeout(r,120));
    const id=String(b.shell.current?.().eventId||document.getElementById("eventId")?.value||"").trim();if(!id){notify("No se pudo identificar el borrador creado.");return false}
    const oldKey=newDraftStorageKey();state.eventId=id;state.mode="resume";if(saveDraft()){try{localStorage.removeItem(oldKey)}catch(_){ }}await syncMetadata(id);state.selectedControlId="START";notify("Borrador creado. Ahora diseña los controles.");return true;
  }finally{state.busy=false;footer()}
}
async function next(){preservePendingEditor();if(state.step===5&&state.controlsPhase==="placement"){const missing=controlsPlacementMessage();if(missing){state.blockerMessage=missing;footer();requestAnimationFrame(()=>$(".mpb-flow-blocker",state.root)?.scrollIntoView?.({behavior:"smooth",block:"center"}));return}state.controlsPhase="iof";state.selectedControlId=controlOrder().find(p=>!r2()?.getIofModel?.(p.id)?.complete)?.id||"START";state.blockerMessage="";render();return}const err=validateStep();if(err){state.blockerMessage=err;footer();notify(err);requestAnimationFrame(()=>{$(".mpb-flow-blocker",state.root)?.scrollIntoView?.({behavior:"smooth",block:"center"})});return}state.blockerMessage="";if(state.step===4){if(!await ensureEventForControls())return}state.step=Math.min(steps.length-1,state.step+1);if(state.step===6){state.draft.controlsPerRoute=Math.min(state.draft.controlCount,controlsPerRoute());ensureRouteSelection();loadRouteDraft(state.selectedRouteId)}if(state.step===7)loadItineraryDraft(state.selectedRouteId);saveDraft();render()}
function back(){preservePendingEditor();if(state.step===5&&state.controlsPhase==="iof"){state.controlsPhase="placement";state.blockerMessage="";render();return}syncInputs();state.blockerMessage="";state.step=Math.max(0,state.step-1);render()}
async function jump(n){preservePendingEditor();syncInputs();n=Number(n);if(!Number.isInteger(n)||n<0||n>=steps.length)return;if(n>state.step){for(let i=state.step;i<n;i++){const err=validateStep(i);if(err){state.blockerMessage=err;footer();notify(err);requestAnimationFrame(()=>{$(".mpb-flow-blocker",state.root)?.scrollIntoView?.({behavior:"smooth",block:"center"})});return}}if(n>=5&&!state.eventId&&!(await ensureEventForControls()))return}state.blockerMessage="";if(n===5&&state.step!==5)state.controlsPhase=controlsComplete()?"iof":"placement";state.step=n;if(state.step===6){ensureRouteSelection();loadRouteDraft(state.selectedRouteId)}if(state.step===7)loadItineraryDraft(state.selectedRouteId);render()}

/* Cartografía estable reutilizada por PLANO, CONTROLES y RECORRIDOS. */
function createMapantPreview(){return L.tileLayer.wms("https://raster.trailmap.fi/mapproxy/service",{layers:"spain_mapant",styles:"",format:"image/png",transparent:false,version:"1.1.1",attribution:"© MapAnt / Trailmap",minZoom:0,maxZoom:22,tileSize:256,crossOrigin:true,updateWhenIdle:false,updateWhenZooming:true,keepBuffer:4})}
function createIgnPreview(kind){const aerial=kind==="pnoa",maxZoom=25,nativeMax=aerial?19:20,minSourceZoom=5,template=aerial?"https://tms-pnoa-ma.idee.es/1.0.0/pnoa-ma/{z}/{x}/{-y}.jpeg":"https://tms-mapa-raster.ign.es/1.0.0/mapa-raster/{z}/{x}/{-y}.jpeg",attribution=aerial?"© PNOA Máxima Actualidad · IGN":"© Instituto Geográfico Nacional";const Persistent=L.GridLayer.extend({initialize(opts={}){L.GridLayer.prototype.initialize.call(this,opts);this._cache=new Map()},_url(z,x,y){const n=2**z,wx=((x%n)+n)%n,ty=n-1-y;return template.replace("{z}",z).replace("{x}",wx).replace("{-y}",ty)},_load(url){if(this._cache.has(url))return this._cache.get(url);const p=new Promise((resolve,reject)=>{const i=new Image();i.decoding="async";i.onload=()=>resolve(i);i.onerror=()=>reject(new Error("tile"));i.src=url});this._cache.set(url,p);if(this._cache.size>96){const k=this._cache.keys().next().value;if(k)this._cache.delete(k)}p.catch(()=>{if(this._cache.get(url)===p)this._cache.delete(url)});return p},createTile(coords,done){const size=this.getTileSize(),c=document.createElement("canvas");c.width=size.x;c.height=size.y;const ctx=c.getContext("2d",{alpha:false});ctx.fillStyle=aerial?"#c9c9c1":"#e9e5d8";ctx.fillRect(0,0,size.x,size.y);const requested=coords.z;const draw=async source=>{const z=Math.max(minSourceZoom,Math.min(source,nativeMax,requested)),scale=2**(requested-z),px=Math.floor(coords.x/scale),py=Math.floor(coords.y/scale),n=2**z;if(py<0||py>=n){done(null,c);return}try{const img=await this._load(this._url(z,px,py)),ox=((coords.x%scale)+scale)%scale,oy=((coords.y%scale)+scale)%scale,sw=img.naturalWidth/scale,sh=img.naturalHeight/scale;ctx.imageSmoothingEnabled=true;try{ctx.imageSmoothingQuality="high"}catch(_){ }ctx.drawImage(img,ox*sw,oy*sh,sw,sh,0,0,size.x,size.y);done(null,c)}catch(_){if(z>minSourceZoom){draw(z-1);return}done(null,c)}};draw(Math.min(requested,nativeMax));return c}});return new Persistent({attribution,minZoom:0,maxZoom,tileSize:256,keepBuffer:aerial?8:6,updateWhenIdle:false,updateWhenZooming:true})}
function previewLayer(){if(state.draft.mapLayer==="mapant")return createMapantPreview();if(state.draft.mapLayer==="ign")return createIgnPreview("ign");if(state.draft.mapLayer==="pnoa")return createIgnPreview("pnoa");const custom=activeCustomMap();if(state.draft.mapLayer==="custom"&&custom?.url&&custom?.bounds)return L.imageOverlay(custom.url,custom.bounds,{opacity:1,interactive:false});return createMapantPreview()}
function setWorkCenter(lat,lon,zoom,confirmed=true){const a=Number(lat),o=Number(lon);if(!Number.isFinite(a)||!Number.isFinite(o))return;state.draft.mapCenterLat=a.toFixed(6);state.draft.mapCenterLon=o.toFixed(6);state.draft.mapZoom=Math.max(4,Math.min(25,Number(zoom)||13));state.draft.mapAreaConfirmed=Boolean(confirmed);saveDraft()}
function initPlanMap(){if(state.step!==2||!state.opened||!globalThis.L)return;const el=$("#mpbPlanMap",state.root);if(!el)return;destroyMaps();let center=[40.4168,-3.7038],zoom=12;const custom=activeCustomMap();if(validWorkCenter()){center=[Number(state.draft.mapCenterLat),Number(state.draft.mapCenterLon)];zoom=Number(state.draft.mapZoom)||13}else if(state.draft.mapLayer==="custom"&&custom?.bounds){const b=L.latLngBounds(custom.bounds);center=[b.getCenter().lat,b.getCenter().lng];zoom=14;setWorkCenter(center[0],center[1],zoom,true)}state.planMap=L.map(el,{zoomControl:true,maxZoom:25,zoomSnap:.25,zoomDelta:.5,bounceAtZoomLimits:false}).setView(center,zoom);state.planBase=previewLayer();state.planBase?.addTo?.(state.planMap);if(state.draft.mapLayer==="custom"&&custom?.bounds){try{state.planMap.fitBounds(custom.bounds,{padding:[18,18],maxZoom:19,animate:false});const c=state.planMap.getCenter();setWorkCenter(c.lat,c.lng,state.planMap.getZoom(),true)}catch(_){}}if(validWorkCenter())state.planMarker=L.circleMarker([Number(state.draft.mapCenterLat),Number(state.draft.mapCenterLon)],{radius:7,weight:3,color:"#fff",fillColor:"#f59e0b",fillOpacity:1}).addTo(state.planMap);state.planMap.on("click",e=>{setWorkCenter(e.latlng.lat,e.latlng.lng,state.planMap.getZoom(),true);if(state.planMarker)state.planMarker.setLatLng(e.latlng);else state.planMarker=L.circleMarker(e.latlng,{radius:7,weight:3,color:"#fff",fillColor:"#f59e0b",fillOpacity:1}).addTo(state.planMap);const line=$(".mpb-map-actions span",state.root);if(line)line.textContent=`ZONA FIJADA · ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`});state.planMap.on("zoomend",()=>{if(validWorkCenter()){state.draft.mapZoom=state.planMap.getZoom();saveDraft()}});setTimeout(()=>state.planMap?.invalidateSize?.(),80)}
function renderControlMarkers(){if(!state.controlMap||!state.controlMarkers)return;state.controlMarkers.clearLayers();const list=controlOrder();list.forEach(p=>{if(!pointPlaced(p))return;const selected=p.id===state.selectedControlId;const html=mapMarkerHtml(p.id,{selected});const marker=L.marker([Number(p.lat),Number(p.lon)],{icon:mapMarkerIcon(html)}).addTo(state.controlMarkers);marker.on("click",ev=>{try{L.DomEvent.stopPropagation(ev)}catch(_){ }state.selectedControlId=p.id;refreshControlsUi()})})}
function fitControls(){const pts=controlOrder().filter(pointPlaced);if(!state.controlMap)return;if(pts.length){const bounds=L.latLngBounds(pts.map(p=>[Number(p.lat),Number(p.lon)]));state.controlMap.fitBounds(bounds,{padding:[34,34],maxZoom:18,animate:true})}else if(validWorkCenter())state.controlMap.setView([Number(state.draft.mapCenterLat),Number(state.draft.mapCenterLon)],Math.max(13,Number(state.draft.mapZoom)||13))}
async function ensureSelectedMapReady(){if(state.draft.mapLayer!=="custom"||activeCustomMap()||!state.draft.customMapId)return true;try{if(typeof globalThis.activateOrientationCustomMap==="function")await globalThis.activateOrientationCustomMap(state.draft.customMapId);return Boolean(activeCustomMap())}catch(error){console.warn("[MILITOPO Premium Builder] restaurar plano propio",error);return false}}
function updateGooglePreview(){const frame=$("[data-mpb-google-frame]",state.root);if(frame)frame.src=mapsEmbedUrl()}
function setMeetingPoint(lat,lon,{name="",zoom=16}={}){const a=Number(lat),o=Number(lon);if(!Number.isFinite(a)||!Number.isFinite(o))return false;state.draft.lat=a.toFixed(6);state.draft.lon=o.toFixed(6);state.locationResults=[];state.draft.locationZoom=Math.max(4,Math.min(21,Math.round(Number(zoom)||16)));if(String(name||"").trim())state.draft.locationName=String(name).trim();else if(!String(state.draft.locationName||"").trim())state.draft.locationName="Punto seleccionado en el mapa";const searchField=$("#mpbLocationSearch",state.root);if(searchField)searchField.value=state.draft.locationName;saveDraft();if(state.locationMap){state.locationMap.setView([a,o],Math.max(13,Number(zoom)||16),{animate:true});if(state.locationMarker)state.locationMarker.setLatLng([a,o]);else state.locationMarker=L.marker([a,o],{interactive:false}).addTo(state.locationMap)}updateGooglePreview();const nameEl=$("[data-mpb-location-name]",state.root),help=$("[data-mpb-location-help]",state.root);if(nameEl)nameEl.textContent=state.draft.locationName||"Punto seleccionado";const status=$(`.mpb-location-status > span`,state.root);if(status)status.textContent="UBICACIÓN SELECCIONADA";if(help)help.textContent="Punto exacto guardado. Este será el centro inicial del mapa de controles.";state.blockerMessage="";footer();return true}
function closePrecisionPicker(){
  try{state.precisionMap?.remove?.()}catch(_){ }
  state.precisionMap=null;state.precisionMarker=null;state.precisionPoint=null;
  state.root?.querySelector(".mpb-precision-overlay")?.remove();
}
function showCenterNotice(title,message,{kind="success",busy=false,autoClose=2500,icon="auto"}={}){
  const host=document.body||state.root;if(!host)return;
  host.querySelector(".mpb-center-notice")?.remove();
  host.querySelectorAll(".mpb-toast").forEach(el=>el.remove());
  const node=document.createElement("div");node.className=`mpb-center-notice is-${kind}${busy?" is-busy":""}`;
  node.setAttribute("role","status");node.setAttribute("aria-live","polite");
  const logo=icon==="militopo"
    ?`<div class="mpb-center-brand"><img src="../icons/militopo-512.png" width="80" height="80" alt="Topo MILITOPO"><span class="mpb-center-brand-state">${busy?"···":kind==="error"?"!":"✓"}</span></div>`
    :`<span class="mpb-center-notice-icon">${busy?"◌":kind==="success"?"✓":"!"}</span>`;
  node.innerHTML=`<div class="mpb-center-notice-card"><div class="mpb-center-kicker">MILITOPO · ORGANIZACIÓN</div>${logo}<strong>${esc(title)}</strong><p>${esc(message)}</p>${busy?'<div class="mpb-center-progress" aria-label="Operación en curso"><div></div></div>':""}</div>`;
  host.appendChild(node);
  if(autoClose>0)setTimeout(()=>{if(node.isConnected)node.remove()},autoClose);
  return node;
}
function updateCenterNotice(title,message,options={}){showCenterNotice(title,message,options)}
function openPrecisionPicker(){
  if(!state.opened||state.step!==4||!globalThis.L)return notify("El selector de punto exacto no está disponible.");
  closePrecisionPicker();
  const center=validCoords()?[Number(state.draft.lat),Number(state.draft.lon)]:validWorkCenter()?[Number(state.draft.mapCenterLat),Number(state.draft.mapCenterLon)]:[40.4168,-3.7038];
  state.precisionPoint={lat:center[0],lon:center[1]};
  const node=document.createElement("div");node.className="mpb-precision-overlay";node.setAttribute("role","dialog");node.setAttribute("aria-modal","true");node.setAttribute("aria-label","Seleccionar ubicación exacta");
  node.innerHTML=`<div class="mpb-precision-dialog"><header><div><small>UBICACIÓN · EDICIÓN PRECISA</small><strong>Selecciona el punto exacto</strong><p>Toca una vez el mapa o arrastra el marcador. Después confirma el punto.</p></div><button type="button" data-mpb-precision-cancel aria-label="Cerrar selector">×</button></header><div class="mpb-precision-map" id="mpbPrecisionMap"></div><footer><button type="button" class="mpb-btn mpb-btn-ghost" data-mpb-precision-cancel>CANCELAR</button><button type="button" class="mpb-btn mpb-btn-primary" data-mpb-precision-confirm>✓ CONFIRMAR ESTE PUNTO</button></footer><small class="mpb-precision-credit">Vista de ajuste: cartografía aérea PNOA/IGN. El resultado se mostrará en Google Maps.</small></div>`;
  state.root.appendChild(node);
  state.precisionMap=L.map(node.querySelector("#mpbPrecisionMap"),{zoomControl:true,maxZoom:21,zoomSnap:.5,bounceAtZoomLimits:false,tap:false}).setView(center,Math.max(14,Number(state.draft.locationZoom)||16));
  createIgnPreview("pnoa").addTo(state.precisionMap);
  const icon=L.divIcon({className:"mpb-precision-pin-wrapper",html:'<div class="mpb-precision-pin">●</div>',iconSize:[30,39],iconAnchor:[15,38]});
  state.precisionMarker=L.marker(center,{draggable:true,icon}).addTo(state.precisionMap);
  state.precisionMap.on("click",e=>{state.precisionPoint={lat:e.latlng.lat,lon:e.latlng.lng};state.precisionMarker?.setLatLng(e.latlng)});
  state.precisionMarker.on("dragend",e=>{const p=e.target.getLatLng();state.precisionPoint={lat:p.lat,lon:p.lng}});
  setTimeout(()=>state.precisionMap?.invalidateSize(),90);
}
function confirmPrecisionPicker(){const point=state.precisionPoint,zoom=state.precisionMap?.getZoom()||16;if(!point)return;closePrecisionPicker();setMeetingPoint(point.lat,point.lon,{name:"Punto seleccionado en el mapa",zoom});showCenterNotice("PUNTO CONFIRMADO","Ubicación exacta guardada. El paso 6 partirá de este punto.")}
function initLocationMap(){if(state.step!==4||!state.opened||!globalThis.L)return;const el=$("#mpbLocationPickerMap",state.root);if(!el)return;try{state.locationMap?.remove?.()}catch(_){ }let center=validCoords()?[Number(state.draft.lat),Number(state.draft.lon)]:validWorkCenter()?[Number(state.draft.mapCenterLat),Number(state.draft.mapCenterLon)]:[40.4168,-3.7038],zoom=validCoords()?Math.max(12,Number(state.draft.locationZoom)||16):Math.max(12,Number(state.draft.mapZoom)||13);state.locationMap=L.map(el,{zoomControl:true,maxZoom:21,zoomSnap:1,zoomDelta:1,bounceAtZoomLimits:false,tap:true}).setView(center,zoom);state.locationBase=previewLayer();state.locationBase?.addTo?.(state.locationMap);if(validCoords())state.locationMarker=L.marker(center,{interactive:false}).addTo(state.locationMap);state.locationMap.on("click",e=>{if(setMeetingPoint(e.latlng.lat,e.latlng.lng,{zoom:state.locationMap.getZoom()})){notify("Punto de encuentro fijado. Puedes tocar otro punto para moverlo.");footer()}});state.locationMap.on("zoomend",()=>{state.draft.locationZoom=Math.max(4,Math.min(21,Math.round(state.locationMap.getZoom())));saveDraft();updateGooglePreview()});setTimeout(()=>state.locationMap?.invalidateSize?.(),80)}
async function searchLocation(){syncInputs();const q=String(state.draft.locationName||"").trim();if(!q){notify("Escribe una calle, ciudad o lugar para buscarlo.");return}const btn=$("[data-mpb-location-search]",state.root);if(btn){btn.disabled=true;btn.textContent="BUSCANDO…"}try{const url=`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=es&addressdetails=1&q=${encodeURIComponent(q)}`;const res=await fetch(url,{headers:{Accept:"application/json"}});if(!res.ok)throw new Error(`HTTP ${res.status}`);const rows=await res.json();state.locationResults=(Array.isArray(rows)?rows:[]).filter(row=>Number.isFinite(Number(row.lat))&&Number.isFinite(Number(row.lon))).map(row=>({lat:Number(row.lat),lon:Number(row.lon),displayName:String(row.display_name||q),title:String(row.name||row.display_name||q).split(",")[0]}));if(!state.locationResults.length){state.draft.lat="";state.draft.lon="";saveDraft();notify("No se encontraron resultados. Prueba con calle + municipio o un lugar más conocido.")}renderKeepScroll()}catch(error){console.warn("[MILITOPO Premium Builder] búsqueda de ubicación",error);notify("No se pudo completar la búsqueda. Comprueba la conexión e inténtalo otra vez.")}finally{const next=$("[data-mpb-location-search]",state.root);if(next){next.disabled=false;next.textContent="BUSCAR"}}}
function selectLocationResult(index){const row=state.locationResults?.[Number(index)];if(!row)return;state.draft.locationName=row.displayName||state.draft.locationName;setMeetingPoint(row.lat,row.lon,{name:state.draft.locationName,zoom:16});state.locationResults=[];saveDraft();renderKeepScroll();notify("Ubicación seleccionada")}
async function initControlsMap(){if(state.step!==5||state.controlsPhase!=="placement"||!state.opened||!globalThis.L)return;await ensureSelectedMapReady();const el=$("#mpbControlsMap",state.root);if(!el)return;try{state.controlMap?.remove?.()}catch(_){ }const hasMeeting=validCoords();let center=hasMeeting?[Number(state.draft.lat),Number(state.draft.lon)]:validWorkCenter()?[Number(state.draft.mapCenterLat),Number(state.draft.mapCenterLon)]:[40.4168,-3.7038],zoom=hasMeeting?16:Math.max(7,Number(state.draft.mapZoom)||13);const pts=controlOrder().filter(pointPlaced);if(!hasMeeting&&!validWorkCenter()&&pts.length){center=[Number(pts[0].lat),Number(pts[0].lon)];zoom=15}state.controlMap=L.map(el,{zoomControl:true,maxZoom:25,zoomSnap:.25,zoomDelta:.5,bounceAtZoomLimits:false}).setView(center,zoom);state.controlBase=previewLayer();state.controlBase?.addTo?.(state.controlMap);const custom=activeCustomMap();if(state.draft.mapLayer==="custom"&&custom?.bounds&&!hasMeeting&&!validWorkCenter()&&!pts.length){try{state.controlMap.fitBounds(custom.bounds,{padding:[18,18],maxZoom:19,animate:false})}catch(_){ }}state.controlMarkers=L.layerGroup().addTo(state.controlMap);renderControlMarkers();state.controlMap.on("click",e=>{if(state.controlMethod==="map")placeSelectedControl(e.latlng.lat,e.latlng.lng)});setTimeout(()=>state.controlMap?.invalidateSize?.(),80)}
function nextWorkflowPoint(id){const list=controlOrder(),index=list.findIndex(p=>p.id===id);if(index<0)return list[0]?.id||"START";return list[Math.min(list.length-1,index+1)]?.id||id}
function savePointCoordinates(){
  const id=state.selectedControlId,api=r2();if(!api)return notify("El editor de coordenadas todavía no está disponible.");
  let point;
  if(state.coordFormat==="latlon"){
    const a=String($("#mpbPointLat",state.root)?.value||"").trim().replace(",","."),o=String($("#mpbPointLon",state.root)?.value||"").trim().replace(",",".");
    const lat=Number(a),lon=Number(o);if(!a||!o||!Number.isFinite(lat)||lat< -90||lat>90||!Number.isFinite(lon)||lon< -180||lon>180)return notify("Latitud o longitud no válida. Revisa los valores en grados decimales WGS84.");
    point={lat,lon};
  }else{
    const text=String($("#mpbPointUtm",state.root)?.value||"").trim();
    point=api.coordinatesFromUtm?.(text);
    if(!point)return notify("UTM no válida. Ejemplo: 30T 463941 4106198. Comprueba zona, banda y metros.");
  }
  if(api.placePoint?.(id,point.lat,point.lon)!==true)return notify("No se pudo guardar el punto. Comprueba los permisos de la carrera.");
  if(id==="START"||id==="FINISH")api.setIofComplete?.(id,true);
  state.selectedControlId=nextWorkflowPoint(id);refreshControlsUi();notify(`${pointLabel({id})} guardada en coordenadas exactas.`);
}
async function readAtakFile(file){
  if(!file)return;
  if(file.size>6*1024*1024)return notify("El GPX supera el máximo de 6 MB.");
  try{
    const raw=await file.text();const preview=r2()?.previewAtakGpx?.(raw);
    if(!preview)return notify("No se pudo interpretar el archivo ATAK.");
    state.atakPreview=preview;state.atakFileName=file.name;refreshControlsUi();
    if(!preview.matches.length)notify(preview.error||"Ningún punto coincide con los IDs de la carrera.");
  }catch(error){notify(`Error leyendo GPX: ${error?.message||error}`)}
}
async function applyAtakImport(){
  const preview=state.atakPreview;if(!preview?.matches?.length)return;
  const replaced=preview.matches.filter(p=>pointPlaced(snapshot()?.points?.find(x=>x.id===p.id))).length;
  const confirmText=`Se importarán ${preview.matches.length} puntos ATAK de ${state.atakFileName||"archivo GPX"}. ${replaced?`${replaced} puntos ya colocados serán sustituidos. `:""}${preview.skipped.length?`${preview.skipped.length} no coincidentes o duplicados se omitirán. `:""}Las descripciones IOF existentes se conservarán. ¿Confirmas?`;
  const ok=globalThis.MILITOPO_CONFIRM?await globalThis.MILITOPO_CONFIRM(confirmText,{title:"CONFIRMAR IMPORTACIÓN ATAK",confirmText:"IMPORTAR PUNTOS"}):globalThis.confirm?.(confirmText);
  if(!ok)return;
  const result=r2()?.applyAtakPreview?.(preview);
  if(!result?.ok)return notify(result?.error||"No se pudo importar el GPX.");
  state.atakPreview=null;state.atakFileName="";
  const first=controlOrder().find(p=>!pointPlaced(p));state.selectedControlId=first?.id||"START";
  renderKeepScroll();showCenterNotice("PUNTOS ATAK IMPORTADOS",`${result.imported} puntos actualizados. Comprueba su posición antes de continuar a IOF.`,{icon:"militopo"});
}
function refreshControlsUi(){const panel=$("[data-mpb-controls-panel]",state.root);if(panel)panel.innerHTML=controlsPanelHtml();renderControlMarkers();state.blockerMessage="";footer()}
function placeSelectedControl(lat,lon){const api=r2();if(!api?.placePoint){notify("El editor de controles todavía se está iniciando.");return}const id=state.selectedControlId||"START";if(api.placePoint(id,lat,lon)!==true){notify("No se pudo colocar ese punto.");return}if(id==="START"||id==="FINISH")api.setIofComplete?.(id,true);state.selectedControlId=nextWorkflowPoint(id);notify(`${pointLabel({id})} colocada`);refreshControlsUi()}
function changeControlCount(delta){const api=r2(),s=snapshot();if(!api?.configureControls||!s)return;const next=Math.max(1,Math.min(80,(s.controls?.length||state.draft.controlCount||1)+Number(delta||0)));if(next===(s.controls?.length||0))return;if(api.configureControls(next)!==true)return;state.draft.controlCount=next;state.draft.controlsPerRoute=Math.min(next,Math.max(1,Number(state.draft.controlsPerRoute)||1));saveDraft();const ids=new Set(controlOrder().map(p=>p.id));if(!ids.has(state.selectedControlId))state.selectedControlId="START";refreshControlsUi()}
function clearSelectedControl(){const api=r2();if(!api?.clearPoint)return;const id=state.selectedControlId;if(!id)return;if(api.clearPoint(id)!==true)return;api.setIofComplete?.(id,false);refreshControlsUi();notify(`${pointLabel({id})} eliminada`)}
function saveIofAndNext(id){const api=r2();if(!api?.setIofComplete)return;const model=api.getIofModel?.(id);if(model?.complete){state.selectedControlId=nextWorkflowPoint(id);refreshControlsUi();return}const result=api.setIofComplete(id,true);if(!result?.ok){notify(result?.error||"No se pudo completar la descripción IOF.");return}state.selectedControlId=nextWorkflowPoint(id);refreshControlsUi();notify(`${pointLabel({id})} · IOF guardada`)}

function renderKeepScroll(){const body=$("[data-mpb-body]",state.root),y=body?.scrollTop||0;render();requestAnimationFrame(()=>{const next=$("[data-mpb-body]",state.root);if(next)next.scrollTop=y})}
function loadRouteDraft(id){state.selectedRouteId=String(id||"R01");const d=routeDetails(state.selectedRouteId),pending=state.draft?.pendingRouteEditors?.[state.selectedRouteId]||(state.draft?.pendingRouteEditor?.id===state.selectedRouteId?state.draft.pendingRouteEditor:null);state.routeDraftControls=pending?.id===state.selectedRouteId&&Array.isArray(pending.controls)?[...pending.controls]:d?.controls?[...d.controls]:[];saveDraft()}
function toggleRouteControl(id){id=String(id||"");const idx=state.routeDraftControls.indexOf(id);if(idx>=0)state.routeDraftControls.splice(idx,1);else{const max=controlsPerRoute();if(state.routeDraftControls.length>=max){notify(`Este recorrido ya tiene ${max} balizas.`);return}state.routeDraftControls.push(id)}preservePendingEditor();renderKeepScroll()}
function undoRouteControl(){if(!state.routeDraftControls.length)return;const removed=state.routeDraftControls.pop();preservePendingEditor();renderKeepScroll();notify(`${removed} retirada de la edición`)}
async function restoreRouteDraft(){const d=routeDetails(state.selectedRouteId);if(!d?.controls?.length){notify("Este recorrido todavía no tiene una versión guardada.");return}const ok=globalThis.MILITOPO_CONFIRM?await globalThis.MILITOPO_CONFIRM("Se descartarán los cambios que aún no has guardado y se restaurará la última versión guardada del recorrido.",{title:"RESTAURAR RECORRIDO",confirmText:"RESTAURAR"}):true;if(!ok)return;state.routeDraftControls=[...d.controls];preservePendingEditor();renderKeepScroll();notify(`${state.selectedRouteId} restaurado desde la versión guardada`)}
async function clearRouteDraft(){const saved=routeDetails(state.selectedRouteId),hasDraft=state.routeDraftControls.length>0;if(!saved&&!hasDraft){notify("Este recorrido ya está vacío.");return}const text=saved?`Se borrará ${state.selectedRouteId} guardado y quedará PENDIENTE para que puedas crearlo de nuevo desde cero.`:`Se limpiará la edición actual de ${state.selectedRouteId}.`;const ok=globalThis.MILITOPO_CONFIRM?await globalThis.MILITOPO_CONFIRM(text,{title:"LIMPIAR RECORRIDO",confirmText:saved?"BORRAR Y REHACER":"LIMPIAR",danger:true}):true;if(!ok)return;if(saved){const removed=r2()?.deleteManualRoute?.(state.selectedRouteId);if(removed!==true){notify("No se pudo borrar el recorrido guardado.");return}if(state.draft.itineraries?.[state.selectedRouteId])delete state.draft.itineraries[state.selectedRouteId]}state.routeDraftControls=[];preservePendingEditor();renderKeepScroll();notify(`${state.selectedRouteId} limpio · listo para rehacer`) }
async function handleRouteCountChange(raw){const requested=Math.max(1,Math.min(Math.max(1,Math.min(30,Number(state.draft.participantCount)||1)),Math.trunc(Number(raw)||1))),existing=existingRouteCount(),previous=routeTargetCount();if(requested===previous)return;if(requested<existing){const removed=[];for(let i=existing;i>requested;i--)removed.push(routeId(i));const ok=globalThis.MILITOPO_CONFIRM?await globalThis.MILITOPO_CONFIRM(`Ahora hay ${existing} recorridos guardados. Al bajar a ${requested} se borrará ${removed.join(", ")} y también sus itinerarios guardados.`,{title:"REDUCIR NÚMERO DE RECORRIDOS",confirmText:`DEJAR ${requested} RECORRIDOS`,danger:true}):true;if(!ok){const input=$("#mpbRouteCount",state.root);if(input)input.value=String(previous);return}for(const id of removed){r2()?.deleteManualRoute?.(id);if(state.draft.itineraries?.[id])delete state.draft.itineraries[id];
    if(state.draft.pendingRouteEditors)delete state.draft.pendingRouteEditors[id];
    if(state.draft.pendingItineraryEditors)delete state.draft.pendingItineraryEditors[id]}}state.draft.routeCount=requested;r2()?.configureManualRoutes?.(requested,controlsPerRoute());ensureRouteSelection();loadRouteDraft(state.selectedRouteId);saveDraft();renderKeepScroll();notify(`Configuración actualizada: ${requested} recorrido${requested===1?"":"s"}`)}
function renderRouteMapContent(){
  if(!state.routeMap||!state.routeMarkers)return;
  state.routeMarkers.clearLayers();
  if(state.routeLine){try{state.routeLine.remove()}catch(_){ }state.routeLine=null}
  const snap=snapshot(),points=snap?.points||[],byId=new Map(points.map(p=>[p.id,p]));
  const ordered=["START",...state.routeDraftControls,...(state.routeDraftControls.length===controlsPerRoute()?["FINISH"]:[])].map(id=>byId.get(id)).filter(pointPlaced);
  const latlngs=ordered.map(p=>[Number(p.lat),Number(p.lon)]);
  if(latlngs.length>1){
    state.routeLine=L.polyline(latlngs,{weight:5,opacity:.96,color:"#d69b24",dashArray:"12 7",lineCap:"round",lineJoin:"round"}).addTo(state.routeMap);
  }
  (snap?.controls||[]).filter(pointPlaced).forEach(p=>{
    const idx=state.routeDraftControls.indexOf(p.id),selected=idx>=0;
    const html=mapMarkerHtml(p.id,{selected,order:selected?idx+1:null,variant:"route"});
    const marker=L.marker([Number(p.lat),Number(p.lon)],{
      icon:mapMarkerIcon(html)
    }).addTo(state.routeMarkers);
    marker.on("click",ev=>{try{L.DomEvent.stopPropagation(ev)}catch(_){ }toggleRouteControl(p.id)});
  });
  ["START","FINISH"].forEach(id=>{
    const p=byId.get(id);if(!pointPlaced(p))return;
    const html=mapMarkerHtml(id,{variant:"route"});
    L.marker([Number(p.lat),Number(p.lon)],{
      icon:mapMarkerIcon(html),
      interactive:false
    }).addTo(state.routeMarkers);
  });
}

function initRoutesMap(){if(state.step!==6||!state.opened||!globalThis.L)return;const el=$("#mpbRouteMap",state.root);if(!el)return;let center=validCoords()?[Number(state.draft.lat),Number(state.draft.lon)]:validWorkCenter()?[Number(state.draft.mapCenterLat),Number(state.draft.mapCenterLon)]:[40.4168,-3.7038],zoom=validCoords()?16:Math.max(7,Number(state.draft.mapZoom)||13);const pts=controlOrder().filter(pointPlaced);state.routeMap=L.map(el,{zoomControl:true,maxZoom:25,zoomSnap:.25,zoomDelta:.5,bounceAtZoomLimits:false}).setView(center,zoom);state.routeBase=previewLayer();state.routeBase?.addTo?.(state.routeMap);state.routeMarkers=L.layerGroup().addTo(state.routeMap);renderRouteMapContent();if(pts.length){try{state.routeMap.fitBounds(L.latLngBounds(pts.map(p=>[Number(p.lat),Number(p.lon)])),{padding:[38,38],maxZoom:17,animate:false})}catch(_){ }}setTimeout(()=>state.routeMap?.invalidateSize?.(),80)}
async function saveCurrentRoute(){if(state.routeBusy)return;syncInputs();const api=r2(),per=controlsPerRoute();if(state.routeDraftControls.length!==per){notify(`Selecciona exactamente ${per} balizas.`);return}if(api?.configureManualRoutes?.(routeTargetCount(),per)!==true){notify("No se pudo guardar la configuración de recorridos.");return}state.routeBusy=true;renderKeepScroll();try{const result=await api.createManualRoute?.(state.selectedRouteId,state.routeDraftControls);if(!result?.ok){notify(result?.error||"No se pudo guardar el recorrido.");return}if(state.draft.pendingRouteEditor?.id===state.selectedRouteId)delete state.draft.pendingRouteEditor;
  if(state.draft.pendingRouteEditors)delete state.draft.pendingRouteEditors[state.selectedRouteId];
  saveDraft();showCenterNotice("RECORRIDO GUARDADO",`${state.selectedRouteId} se ha guardado correctamente con ${per} balizas.`,{icon:"militopo"});const n=Number(state.selectedRouteId.replace(/\D/g,""))||1;if(n<routeTargetCount())loadRouteDraft(routeId(n+1));else loadRouteDraft(state.selectedRouteId)}finally{state.routeBusy=false;renderKeepScroll()}}

function nearestItinerarySegment(latlng){if(!state.itineraryMap||state.itineraryDraftPoints.length<2)return 0;const p=state.itineraryMap.latLngToLayerPoint(latlng);let best=0,bestD=Infinity;for(let i=0;i<state.itineraryDraftPoints.length-1;i++){const a=state.itineraryMap.latLngToLayerPoint([state.itineraryDraftPoints[i].lat,state.itineraryDraftPoints[i].lon]),b=state.itineraryMap.latLngToLayerPoint([state.itineraryDraftPoints[i+1].lat,state.itineraryDraftPoints[i+1].lon]),dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1))),x=a.x+t*dx,y=a.y+t*dy,d=(p.x-x)**2+(p.y-y)**2;if(d<bestD){bestD=d;best=i}}return best}
// F2.28: el icono de Leaflet contiene un círculo real centrado en una zona
// táctil de 28px. El icono y su zona activa comparten el mismo centro.
function renderItineraryMapContent(){
  if(!state.itineraryMap)return;
  if(state.itineraryLayer){try{state.itineraryLayer.remove()}catch(_){ }state.itineraryLayer=null}
  if(state.itineraryMarkers){try{state.itineraryMarkers.remove()}catch(_){ }}
  state.itineraryMarkers=L.layerGroup().addTo(state.itineraryMap);
  const pts=state.itineraryDraftPoints;
  if(pts.length>1)state.itineraryLayer=L.polyline(pts.map(p=>[p.lat,p.lon]),{weight:6,opacity:.95,color:"#d99f29",lineCap:"round",lineJoin:"round"}).addTo(state.itineraryMap);
  pts.forEach((p,i)=>{
    const manual=!p.anchorId;
    const icon=manual
      ?L.divIcon({html:'<div class="mpb-itinerary-point is-manual" aria-hidden="true"></div>',className:"mpb-map-point-wrap mpb-itinerary-drag-marker",iconSize:[28,28],iconAnchor:[14,14]})
      :mapMarkerIcon(mapMarkerHtml(p.anchorId,{variant:"itinerary"}));
    const marker=L.marker([p.lat,p.lon],{draggable:manual,autoPan:false,riseOnHover:manual,bubblingMouseEvents:false,icon}).addTo(state.itineraryMarkers);
    if(!manual)return;
    const el=marker.getElement?.();
    if(el){el.setAttribute("title","Arrastra para mover este vértice");el.setAttribute("aria-label","Vértice del itinerario arrastrable");L.DomEvent?.disableClickPropagation?.(el)}
    marker.on("click",event=>{try{L.DomEvent.stopPropagation(event.originalEvent)}catch(_){ }});
    marker.on("drag",event=>{
      const ll=event.target.getLatLng();
      if(state.itineraryLayer){
        const moved=state.itineraryDraftPoints.map((point,j)=>j===i?[ll.lat,ll.lng]:[point.lat,point.lon]);
        state.itineraryLayer.setLatLngs(moved);
      }
    });
    marker.on("dragend",event=>{
      const ll=event.target.getLatLng();
      state.itineraryDraftPoints[i]={lat:ll.lat,lon:ll.lng,anchorId:null};
      state.itineraryDirty=true;
      preservePendingEditor();
      renderItineraryMapContent();
      refreshItineraryMetrics();
    });
  });
}
function refreshItineraryMetrics(){const metrics=$(".mpb-itinerary-metrics",state.root);if(!metrics)return;const sum=itinerarySummary();metrics.innerHTML=`<article><small>DISTANCIA DIRECTA</small><strong>${formatKm(sum.direct)}</strong></article><article><small>ITINERARIO ESTIMADO</small><strong>${formatKm(sum.real)}</strong></article><article><small>DIFERENCIA</small><strong>${sum.direct?`${sum.diff>=0?"+":""}${sum.diff.toFixed(0)} %`:"—"}</strong></article>`}
function initItineraryMap(){if(state.step!==7||!state.opened||!globalThis.L)return;const el=$("#mpbItineraryMap",state.root);if(!el)return;if(!state.itineraryDraftPoints.length)loadItineraryDraft(state.selectedRouteId);let center=validCoords()?[Number(state.draft.lat),Number(state.draft.lon)]:validWorkCenter()?[Number(state.draft.mapCenterLat),Number(state.draft.mapCenterLon)]:[40.4168,-3.7038];state.itineraryMap=L.map(el,{zoomControl:true,maxZoom:25,zoomSnap:.25,zoomDelta:.5,bounceAtZoomLimits:false}).setView(center,15);state.itineraryBase=previewLayer();state.itineraryBase?.addTo?.(state.itineraryMap);renderItineraryMapContent();if(state.itineraryDraftPoints.length>1){try{state.itineraryMap.fitBounds(L.latLngBounds(state.itineraryDraftPoints.map(p=>[p.lat,p.lon])),{padding:[36,36],maxZoom:17,animate:false})}catch(_){ }}state.itineraryMap.on("click",e=>{const i=nearestItinerarySegment(e.latlng);state.itineraryDraftPoints.splice(i+1,0,{lat:e.latlng.lat,lon:e.latlng.lng,anchorId:null});state.itineraryDirty=true;preservePendingEditor();renderItineraryMapContent();refreshItineraryMetrics()});setTimeout(()=>state.itineraryMap?.invalidateSize?.(),80)}
function undoItineraryVertex(){for(let i=state.itineraryDraftPoints.length-1;i>=0;i--){if(!state.itineraryDraftPoints[i].anchorId){state.itineraryDraftPoints.splice(i,1);state.itineraryDirty=true;preservePendingEditor();renderKeepScroll();notify("Último vértice eliminado");return}}}
async function resetItineraryDraft(){const ok=globalThis.MILITOPO_CONFIRM?await globalThis.MILITOPO_CONFIRM(`Se eliminarán todos los vértices manuales de ${state.selectedRouteId} y volverás a la línea directa entre controles.`,{title:"VOLVER A LÍNEA DIRECTA",confirmText:"RESTABLECER",danger:true}):true;if(!ok)return;state.itineraryDraftPoints=routeAnchorPoints(state.selectedRouteId);state.itineraryDirty=true;preservePendingEditor();renderKeepScroll();notify(`${state.selectedRouteId} · línea directa restaurada`)}
function saveItinerary(){state.draft.itineraries=state.draft.itineraries&&typeof state.draft.itineraries==="object"?state.draft.itineraries:{};state.draft.itineraries[state.selectedRouteId]={saved:true,updatedAt:new Date().toISOString(),points:state.itineraryDraftPoints.map(p=>({lat:Number(p.lat),lon:Number(p.lon),anchorId:p.anchorId||null})),...itinerarySummary()};state.itineraryDirty=false;if(state.draft.pendingItineraryEditor?.id===state.selectedRouteId)delete state.draft.pendingItineraryEditor;
  if(state.draft.pendingItineraryEditors)delete state.draft.pendingItineraryEditors[state.selectedRouteId];
  saveDraft();notify(`${state.selectedRouteId} · itinerario guardado`);const n=Number(state.selectedRouteId.replace(/\D/g,""))||1;if(n<routeTargetCount())loadItineraryDraft(routeId(n+1));renderKeepScroll()}
function chooseLayer(layer){state.draft.mapLayer=layer;if(layer==="custom"){const c=activeCustomMap();if(c){state.draft.customMapId=c.id||"";state.draft.customMapName=c.name||"";state.draft.customMapFormat=c.format||"";if(c.bounds){const b=L.latLngBounds(c.bounds),m=b.getCenter();setWorkCenter(m.lat,m.lng,14,true)}}}saveDraft();render()}
async function selectCustomMap(id){id=String(id||"");if(!id)return;if(typeof globalThis.activateOrientationCustomMap!=="function"){notify("La biblioteca de planos aún no está lista.");return}try{state.importState={message:"Cargando plano guardado…"};updateImportStatus();await globalThis.activateOrientationCustomMap(id);const c=activeCustomMap();if(!c)throw new Error("Plano no disponible");state.draft.mapLayer="custom";state.draft.customMapId=c.id||id;state.draft.customMapName=c.name||"Plano propio";state.draft.customMapFormat=c.format||"";if(c.bounds){const b=L.latLngBounds(c.bounds),m=b.getCenter();setWorkCenter(m.lat,m.lng,14,true)}saveDraft();state.importState={message:`✓ ${c.name||"Plano propio"}`};render()}catch(e){console.warn(e);notify("No se pudo cargar ese plano.")}}
function updateImportStatus(){const el=$("[data-mpb-import-status]",state.root);if(el&&state.importState?.message)el.textContent=state.importState.message}
function importPlan(){state.draft.mapLayer="custom";saveDraft();const input=document.getElementById("orientationGeoTiffInput");if(!input){notify("El importador de planos no está disponible todavía.");return}input.click()}
function geolocateWorkArea(){if(!navigator.geolocation){notify("Este dispositivo no ofrece ubicación.");return}const btn=$("[data-mpb-map-geolocate]",state.root);if(btn){btn.disabled=true;btn.textContent="LOCALIZANDO…"}navigator.geolocation.getCurrentPosition(pos=>{setWorkCenter(pos.coords.latitude,pos.coords.longitude,15,true);if(state.planMap){state.planMap.setView([pos.coords.latitude,pos.coords.longitude],15,{animate:true});if(state.planMarker)state.planMarker.setLatLng([pos.coords.latitude,pos.coords.longitude]);else state.planMarker=L.circleMarker([pos.coords.latitude,pos.coords.longitude],{radius:7,weight:3,color:"#fff",fillColor:"#f59e0b",fillOpacity:1}).addTo(state.planMap)}const line=$(".mpb-map-actions span",state.root);if(line)line.textContent=`ZONA FIJADA · ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;if(btn){btn.disabled=false;btn.textContent="CENTRAR EN MI UBICACIÓN"}},()=>{if(btn){btn.disabled=false;btn.textContent="CENTRAR EN MI UBICACIÓN"}notify("No se pudo obtener tu ubicación.")},{enableHighAccuracy:true,timeout:12000,maximumAge:15000})}
function geolocate(){if(!navigator.geolocation){notify("Este dispositivo no ofrece ubicación.");return}const btn=$("[data-mpb-geolocate]",state.root);if(btn){btn.disabled=true;btn.innerHTML="⌖ <span>LOCALIZANDO…</span>"}navigator.geolocation.getCurrentPosition(pos=>{setMeetingPoint(pos.coords.latitude,pos.coords.longitude,{name:state.draft.locationName||"Mi ubicación",zoom:16});if(btn){btn.disabled=false;btn.innerHTML="⌖ <span>MI UBICACIÓN</span>"}notify(`Ubicación obtenida · precisión ±${Math.round(pos.coords.accuracy||0)} m`)},err=>{if(btn){btn.disabled=false;btn.innerHTML="⌖ <span>MI UBICACIÓN</span>"}notify(err.code===1?"Permite el acceso a ubicación para usar este botón.":"No se pudo obtener la ubicación.")},{enableHighAccuracy:true,timeout:12000,maximumAge:15000})}
function useWorkCenter(){if(!validWorkCenter())return;setMeetingPoint(state.draft.mapCenterLat,state.draft.mapCenterLon,{name:state.draft.locationName||"Punto de encuentro de la carrera",zoom:15});notify("Centro del plano usado como punto de encuentro.")}

async function syncMetadata(eventId,attempt=0,isCurrent=()=>true){if(!isCurrent())return false;if(!validMetadataDates(state.draft)){draftSaveStatus("Borrador local conservado · completa las fechas para sincronizar");return false;}const custom=activeCustomMap(),iof=iofSummary();const meta={premiumSchemaVersion:4,eventName:String(state.draft.name||"").trim(),participantCount:Math.max(1,Math.min(100,Number(state.draft.participantCount)||1)),raceType:state.draft.raceType,description:String(state.draft.description||"").trim(),mapSelection:{layer:state.draft.mapLayer,label:mapLabel(state.draft.mapLayer),workCenter:{lat:Number(state.draft.mapCenterLat),lon:Number(state.draft.mapCenterLon),zoom:Number(state.draft.mapZoom)||13},customMap:state.draft.mapLayer==="custom"?{id:custom?.id||state.draft.customMapId||"",name:custom?.name||state.draft.customMapName||"",format:custom?.format||state.draft.customMapFormat||""}:null},scheduledStartAt:new Date(state.draft.startAt).toISOString(),scheduledEndAt:new Date(state.draft.endAt).toISOString(),timeZone:state.draft.timeZone||"Europe/Madrid",meetingPoint:{name:String(state.draft.locationName||"").trim(),lat:validCoords()?Number(state.draft.lat):null,lon:validCoords()?Number(state.draft.lon):null,mapsUrl:mapsUrl()},premiumControlCount:Number(state.draft.controlCount)||0,premiumIofComplete:iof.allComplete,premiumRouteCount:routeTargetCount(),premiumControlsPerRoute:controlsPerRoute(),premiumItineraries:state.draft.itineraries||{},updatedAtLocal:new Date().toISOString()};try{localStorage.setItem(META_PREFIX+eventId,JSON.stringify(meta))}catch(_){ }if(!navigator.onLine)return false;try{const auth=globalThis.MILITOPO_V2_AUTH||state.auth;if(!auth?.uid)return false;const {firestore}=await globalThis.MILITOPO_V2.firebase();if(!isCurrent()||!navigator.onLine)return false;await setDoc(doc(firestore,"events",eventId),{...meta,ownerUid:String(auth.uid),updatedAt:serverTimestamp()},{merge:true});return true}catch(error){console.warn("[MILITOPO Premium Builder] metadata",error);if(attempt<2){await new Promise(r=>setTimeout(r,800*(attempt+1)));return syncMetadata(eventId,attempt+1,isCurrent)}return false}}
function applyLegacyBasics(){const name=document.getElementById("eventName"),count=document.getElementById("participantCount"),controls=document.getElementById("controlCount"),per=document.getElementById("controlsPerRoute"),routes=document.getElementById("maxUniqueRoutes");if(name){name.value=state.draft.name.trim();name.dispatchEvent(new Event("input",{bubbles:true}));name.dispatchEvent(new Event("change",{bubbles:true}))}if(count){count.value=String(Math.max(1,Math.min(100,Number(state.draft.participantCount)||1)));count.dispatchEvent(new Event("change",{bubbles:true}))}if(controls){controls.value=String(Math.max(1,Math.min(80,Number(state.draft.controlCount)||legacyControlCount())));controls.dispatchEvent(new Event("change",{bubbles:true}))}if(per)per.value=String(controlsPerRoute());if(routes)routes.value=String(routeTargetCount())}
function applySelectedPlan(){try{globalThis.MILITOPO_MAP_CONTROL?.switchLayer?.(state.draft.mapLayer)}catch(e){console.warn("[MILITOPO Premium Builder] capa",e)}}
async function downloadOrganizerPackage(){
  if(state.packageBusy)return;
  if(!preflightReady()){showCenterNotice("ZIP NO DISPONIBLE","Completa primero los requisitos de Preflight.",{kind:"error"});return}
  const fn=globalThis.generateZip;
  if(typeof fn!=="function"){showCenterNotice("GENERADOR NO DISPONIBLE","No está cargado el exportador del ZIP.",{kind:"error"});return}
  const eventId=String(state.eventId||bridge()?.shell?.current?.().eventId||"").trim();
  state.packageBusy=true;
  showCenterNotice("PREPARANDO ZIP","Comprobando carrera y reuniendo planos, QR, IOF y recorridos…",{busy:true,autoClose:0,icon:"militopo"});
  renderKeepScroll();
  try{
    applyLegacyBasics();r2()?.configureManualRoutes?.(routeTargetCount(),controlsPerRoute());
    try{bridge()?.event?.saveRules?.()}catch(_){}
    await syncMetadata(eventId);
    if(lifecycleStatus()==="draft"){
      if(!navigator.onLine)throw new Error("Necesitas conexión para preparar el borrador y descargar material");
      const refresh=globalThis.MILITOPO_V2_EVENT_LIFECYCLE_REFRESH,advance=globalThis.MILITOPO_V2_EVENT_LIFECYCLE_ADVANCE;
      if(typeof refresh!=="function"||typeof advance!=="function")throw new Error("Ciclo de vida no disponible");
      await new Promise(r=>setTimeout(r,800));
      for(let attempt=0;attempt<5&&lifecycleStatus()==="draft";attempt++){
        await refresh();if(lifecycleStatus()!=="draft")break;await advance();await new Promise(r=>setTimeout(r,650));
      }
      await refresh();if(lifecycleStatus()==="draft")throw new Error("La carrera todavía no ha podido quedar preparada");
    }
    updateCenterNotice("GENERANDO ARCHIVO","Comprimiendo el material. La descarga comenzará cuando termine…",{busy:true,autoClose:0,icon:"militopo"});
    const prevSuppress=globalThis.__MILITOPO_SUPPRESS_ZIP_TOAST__;
    let outcome;
    try{
      globalThis.__MILITOPO_SUPPRESS_ZIP_TOAST__=true;
      outcome=await fn();
    }finally{globalThis.__MILITOPO_SUPPRESS_ZIP_TOAST__=prevSuppress;}
    if(!outcome?.ok)throw new Error(outcome?.error||"El exportador no ha confirmado la descarga");
    const issues=Array.isArray(outcome.warnings)?outcome.warnings:[];
    if(issues.length){
      updateCenterNotice("ZIP CON AVISOS",`${outcome.filename||"El paquete"} se ha descargado, pero ${issues.length} material(es) tienen incidencias. ${issues.slice(0,2).join(" · ")}. Comprueba los archivos _ERROR.txt.`,{kind:"error",autoClose:0,icon:"militopo"});
    }else{
      updateCenterNotice("ZIP LISTO",`${outcome.filename||"El paquete"} se ha enviado a la descarga del navegador. Se han comprobado PDF, GPX y datos disponibles.`,{autoClose:4500,icon:"militopo"});
    }
  }catch(error){
    console.error("[MILITOPO Premium Builder] ZIP",error);
    updateCenterNotice("ERROR AL GENERAR ZIP",String(error?.message||error),{kind:"error",autoClose:6500,icon:"militopo"});
  }finally{state.packageBusy=false;renderKeepScroll()}
}
function publicationToken(){
  const auth=state.auth||globalThis.MILITOPO_V2_AUTH;
  return {epoch:state.publicationEpoch,eventId:String(state.eventId||""),uid:String(auth?.uid||""),draft:state.draft};
}
function publicationIsCurrent(token){
  const auth=state.auth||globalThis.MILITOPO_V2_AUTH;
  return state.opened&&state.step===8&&state.publicationEpoch===token.epoch&&state.draft===token.draft&&
    Boolean(token.eventId&&token.uid&&auth?.emailVerified&&canManage())&&String(auth?.uid||"")===token.uid&&
    String(state.eventId||"")===token.eventId&&String(bridge()?.shell?.current?.().eventId||"")===token.eventId;
}
async function publishRace(){
  if(state.publishing)return;
  if(!preflightReady()){notify("Completa el Preflight antes de publicar.");return}
  if(!navigator.onLine){notify("Necesitas conexión para publicar la carrera.");return}
  const token=publicationToken(),current=()=>publicationIsCurrent(token);
  if(!current()){notify("Carga la carrera y verifica tu sesión antes de publicar.");return}
  if(!["draft","prepared"].includes(lifecycleStatus())){notify("El estado actual no permite publicar esta carrera.");return}
  const refresh=globalThis.MILITOPO_V2_EVENT_LIFECYCLE_REFRESH,advance=globalThis.MILITOPO_V2_EVENT_LIFECYCLE_ADVANCE;
  if(typeof refresh!=="function"||typeof advance!=="function"){notify("Ciclo de vida no disponible.");return}
  // Lock before confirmation; all later work stays bound to this race/account/view.
  state.publicationError=null;
  state.publishing=true;refreshPublicationAvailability();
  let publicationNotice=null;
  const ensureCurrent=()=>{
    if(!current())throw new Error("La carrera, la sesión o la vista ha cambiado. Revisa el estado antes de volver a publicar.");
    if(!navigator.onLine)throw new Error("Sin conexión. Recupera Internet y comprueba el estado antes de reintentar.");
  };
  try{
    if(typeof globalThis.MILITOPO_CONFIRM!=="function")throw new Error("La confirmación no está disponible. Vuelve a intentarlo cuando termine la carga.");
    const ok=await globalThis.MILITOPO_CONFIRM(
      "¿Seguro que quieres PUBLICAR esta carrera?\n\nAl publicarla quedarán bloqueadas las balizas, controles, recorridos, itinerarios, el plano y la configuración de diseño. No podrás modificarlos en esta carrera; para otro diseño tendrás que crear un nuevo BORRADOR reutilizándola.\n\nNo se iniciará el seguimiento en directo.",
      {title:"PUBLICACIÓN DEFINITIVA · BLOQUEO DE DISEÑO",confirmText:"SÍ, PUBLICAR Y BLOQUEAR",danger:true}
    );
    if(!ok)return;
    ensureCurrent();
    publicationNotice=showCenterNotice("PUBLICANDO CARRERA", "Esperando la confirmación de Firebase. Mantén esta pantalla abierta.", {busy:true,autoClose:0,icon:"militopo"});
    if(!preflightReady())throw new Error("El diseño ha cambiado. Revisa los requisitos pendientes.");
    if(!await refresh())throw new Error("No se pudo comprobar el estado de la carrera. No se ha continuado la publicación.");
    ensureCurrent();
    let status=lifecycleStatus();
    if(status!=="published"){
      if(!["draft","prepared"].includes(status))throw new Error(`El estado ha cambiado a ${lifecycleLabel(status)}.`);
      applyLegacyBasics();r2()?.configureManualRoutes?.(routeTargetCount(),controlsPerRoute());
      try{bridge()?.event?.saveRules?.()}catch(_){}
      ensureCurrent();
      if(!await syncMetadata(token.eventId,0,current))throw new Error("No se pudieron confirmar los datos de la carrera. Revisa la conexión antes de reintentar.");
      ensureCurrent();
      // At most draft -> prepared -> published. Never advance blindly or start LIVE.
      for(let step=0;step<2;step++){
        if(!await refresh())throw new Error("No se pudo actualizar el estado de la carrera.");
        ensureCurrent();status=lifecycleStatus();
        if(status==="published")break;
        if(!["draft","prepared"].includes(status))throw new Error(`El estado ha cambiado a ${lifecycleLabel(status)}.`);
        const result=await advance({publicationOnly:true,publishConsentConfirmed:true,eventId:token.eventId,expectedFrom:status});
        ensureCurrent();
        if(result?.ok!==true)throw new Error(result?.error||"No se recibió confirmación del cambio de estado. Actualiza la aplicación antes de reintentar.");
        // Esperar la confirmación oficial antes de intentar otra transición; evita
        // exigir otro clic por una lectura/repaint tardío tras PREPARADO.
        let confirmed="";
        for(let confirmation=0;confirmation<5;confirmation++){
          if(confirmation)await new Promise(resolve=>setTimeout(resolve,300*confirmation));
          ensureCurrent();
          if(await refresh()){ensureCurrent();confirmed=lifecycleStatus();if(confirmed!==status)break;}
        }
        if(!confirmed||confirmed===status)throw new Error("No se ha confirmado el cambio en Firebase. Comprueba el estado de esta carrera antes de reintentar.");
        status=confirmed;
        if(status==="published")break;
      }
    }
    if(status!=="published")throw new Error(`No se completó la publicación · estado ${lifecycleLabel(status)}`);
    renderKeepScroll();
    showCenterNotice("CARRERA PUBLICADA", "Firebase ha confirmado la publicación. Invitaciones habilitadas.", {icon:"militopo"});
  }catch(error){
    console.error("[MILITOPO Premium Builder] publicar",error);
    if(current()){
      const message=`Publicación no confirmada: ${error?.message||error}`;
      state.publicationError={token,message};
      showCenterNotice("PUBLICACIÓN NO CONFIRMADA", message, {kind:"error",autoClose:6000,icon:"militopo"});
    }
  }finally{
    publicationNotice?.remove();
    state.publishing=false;
    // Do not rebuild another race's form or move its scroll position.
    refreshPublicationAvailability();
  }
}
// Guardar incluso la edición intermedia del recorrido/itinerario, sin inventar
// un recorrido oficial hasta pulsar GUARDAR RECORRIDO / GUARDAR ITINERARIO.
function preservePendingEditor(){
  if(!state.draft||!state.selectedRouteId)return;
  const id=state.selectedRouteId;
  if(state.step===6&&Array.isArray(state.routeDraftControls)){
    const saved=routeDetails(id)?.controls||[];
    const drafts=state.draft.pendingRouteEditors||{};
    if(JSON.stringify(saved)!==JSON.stringify(state.routeDraftControls)){
      drafts[id]={id,controls:[...state.routeDraftControls]};
    }else{
      delete drafts[id];
    }
    state.draft.pendingRouteEditors=drafts;
    if(state.draft.pendingRouteEditor?.id===id)delete state.draft.pendingRouteEditor;
  }
  if(state.step===7&&Array.isArray(state.itineraryDraftPoints)){
    const drafts=state.draft.pendingItineraryEditors||{};
    if(state.itineraryDirty){
      drafts[id]={id,points:state.itineraryDraftPoints.map(p=>({lat:Number(p.lat),lon:Number(p.lon),anchorId:p.anchorId||null}))};
    }else{
      delete drafts[id];
    }
    state.draft.pendingItineraryEditors=drafts;
    if(state.draft.pendingItineraryEditor?.id===id)delete state.draft.pendingItineraryEditor;
  }
  saveDraft();
}
// F2.27 · Guardar y salir debe comprobar también el escritor C2 de balizas y
// recorridos, no solo los metadatos. No convierte ediciones sin GUARDAR en
// diseños oficiales: esas siguen protegidas localmente.
function confirmCloudStructure(eventId,isCurrent){
  return new Promise(resolve=>{
    const requestId=`f227-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let settled=false;
    let timer=null;
    const finish=(ok,error="")=>{if(settled)return;settled=true;clearTimeout(timer);globalThis.removeEventListener("militopo:v2-orientation-structure-save-result",onResult);resolve({ok:ok===true,error:String(error||"")})};
    const onResult=e=>{
      const d=e.detail||{};
      if(d.requestId!==requestId||d.eventId!==eventId)return;
      finish(d.ok===true&&isCurrent(),d.error);
    };
    globalThis.addEventListener("militopo:v2-orientation-structure-save-result",onResult);
    timer=setTimeout(()=>finish(false,"Sin confirmación de Firestore"),25000);
    if(!isCurrent()||globalThis.MILITOPO_ORIENTATION_REQUEST_STRUCTURE_SYNC?.(requestId,eventId)!==true)finish(false,"El contexto de la carrera cambió");
  });
}
// F2.25 · Guardar y salir de cualquier paso, sin validar requisitos de publicación.
// La copia local siempre se conserva; solo confirmar guardado en la nube tras respuesta de Firestore.
async function saveAndExit(){
  if(state.busy||state.publishing||!state.opened)return false;
  if(state.mode==="create"&&state.freshPristine&&hasRecoverableDraft()){close();notify("Se conserva el borrador anterior. No has empezado a editar uno nuevo.");return true;}
  syncInputs();preservePendingEditor();
  if(!saveDraft()){
    notify("Safari no ha podido guardar el borrador en este dispositivo. No cierres todavía.");return false;
  }
  state.busy=true;footer();
  try{
    const editable=["draft","prepared"].includes(lifecycleStatus());
    if(state.eventId&&!editable){notify("Esta carrera ya no es editable. No se han guardado modificaciones.");return false;}
    if(state.eventId&&String(bridge()?.shell?.current?.().eventId||"")!==state.eventId){
      notify("La carrera seleccionada ha cambiado. Vuelve a abrir el diseño correcto antes de guardar.");return false;
    }
    if(state.eventId&&String(state.draft.name||"").trim().length<3){
      notify("El nombre debe tener al menos 3 caracteres para guardarlo en Mis carreras.");return false;
    }
    // Antes de existir un ID, la preparación puede estar incompleta: conservar localmente.
    if(!state.eventId){
      if(!navigator.onLine||String(state.draft.name||"").trim().length<3){
        close();notify("Borrador local guardado. Para guardarlo en Mis carreras, pon un nombre y conecta Internet.");return true;
      }
      applyLegacyBasics();
      // ensureEventForControls gestiona su propio bloqueo para evitar dos creaciones.
      state.busy=false;
      const created=await ensureEventForControls();
      state.busy=true;
      if(!created){notify("No se pudo crear la carrera en Firebase. El borrador sigue guardado aquí.");return false;}
    }
    const eventId=String(state.eventId||"").trim();
    if(!eventId){notify("No se ha confirmado un ID de carrera. Conservamos el borrador local.");return false;}
    applyLegacyBasics();
    // Guardado de cabecera del motor existente, sin modificar la geometría ni navegar.
    if(globalThis.MILITOPO_BUILDER_SAVE_BASICS?.()===false){notify("No se pudo conservar la cabecera local. Revisa el espacio de Safari.");return false;}
    // No llamar a saveRules: ese botón histórico cambia de paso y puede alterar recorridos.
    if(!navigator.onLine){close();notify("Guardado solo en este dispositivo. Vuelve a conectarte y abre el borrador para sincronizar.");return true;}
    const ownerUid=String((state.auth||globalThis.MILITOPO_V2_AUTH)?.uid||"");
    const current=()=>state.opened&&state.eventId===eventId&&state.draft&&
      String((state.auth||globalThis.MILITOPO_V2_AUTH)?.uid||"")===ownerUid&&
      String(bridge()?.shell?.current?.().eventId||"")===eventId&&
      ["draft","prepared"].includes(lifecycleStatus());
    const saved=await syncMetadata(eventId,0,current);
    if(!saved){notify("No se confirmó el guardado de la configuración en Firebase. El borrador sigue aquí; inténtalo otra vez.");return false;}
    const structureResult=await confirmCloudStructure(eventId,current);
    if(!structureResult.ok){
      const cloudConflict=/conflicto|cambiaron en la nube|edición con firestore/i.test(structureResult.error);
      notify(cloudConflict?
        "La carrera cambió en la nube desde el último guardado. No se han sobrescrito balizas ni recorridos. Conserva el borrador local y revisa la carrera antes de continuar.":
        "La configuración se guardó, pero no se confirmó la sincronización de balizas y recorridos. Conservamos el borrador abierto; vuelve a intentar GUARDAR Y SALIR.");
      return false;
    }
    // Actualizar Mis carreras cuando se abra de nuevo y no mantener la copia editada en pantalla.
    // Mantener el borrador local para poder reanudar ediciones intermedias de
    // recorridos/itinerarios que todavía no son válidas para publicarse.
    premium.get("organizer-home")?.onDraftSaved?.({eventId,eventName:String(state.draft.name||"").trim()});
    close();
    notify(state.draft.pendingRouteEditor||state.draft.pendingItineraryEditor||Object.keys(state.draft.pendingRouteEditors||{}).length||Object.keys(state.draft.pendingItineraryEditors||{}).length?
      "Configuración y diseño oficial guardados en Firebase. La edición incompleta sigue solo en este dispositivo hasta guardarla desde su paso.":
      "Configuración, balizas y recorridos sincronizados. Puedes continuar desde Mis carreras.");
    return true;
  }catch(error){
    console.error("[MILITOPO F2.25] guardar y salir",error);
    notify("No se pudo confirmar el guardado. Los cambios locales se conservan; inténtalo de nuevo.");
    return false;
  }finally{state.busy=false;if(state.opened)footer();}
}
async function finishBase(){for(let i=0;i<8;i++){const err=validateStep(i);if(err){state.step=i;render();notify(err);return}}if(state.busy)return;state.busy=true;footer();try{const id=String(state.eventId||bridge()?.shell?.current?.().eventId||"").trim();if(!id){notify("No hay un borrador cargado.");return}applyLegacyBasics();r2()?.configureManualRoutes?.(routeTargetCount(),controlsPerRoute());applySelectedPlan();const ok=await syncMetadata(id);if(!saveDraft()){notify("No se pudo conservar el borrador local. Mantén esta pantalla abierta.");return}close();setTimeout(()=>{notify(ok?"Diseño Premium guardado correctamente.":"Diseño guardado en el dispositivo. Se sincronizará cuando vuelva la conexión.");globalThis.dispatchEvent(new CustomEvent("militopo:premium-builder-p2c-complete",{detail:{eventId:id}}))},120)}finally{state.busy=false;if(state.opened)footer()}}
function reuse(){syncInputs();close();premium.get("organizer-home")?.showRaces?.();notify("Selecciona la carrera que quieres utilizar como referencia.")}
async function onInput(event){
  const target=event?.target;
  if(target)state.freshPristine=false;
  if(target?.id==="mpbAtakFile"&&event.type==="change"){const file=target.files?.[0];await readAtakFile(file);target.value="";return}
  if(target?.id==="mpbRouteCount"){if(event?.type==="change")await handleRouteCountChange(target.value);return}
  if(target?.id==="mpbLocationSearch"&&event?.type==="input"){state.draft.locationName=String(target.value||"").trimStart();state.draft.lat="";state.draft.lon="";state.locationResults=[];saveDraft();state.blockerMessage="";footer();return}
  if(target?.matches?.("[data-mpb-iof-field]")&&event.type==="change"){const result=r2()?.updateIof?.(target.dataset.mpbIofPoint,target.dataset.mpbIofField,target.value);if(!result?.ok)notify(result?.error||"No se pudo actualizar la descripción IOF.");refreshControlsUi();return}
  if(target?.id==="mpbCustomMapLibrary"&&event.type==="change"){selectCustomMap(target.value);return}
  syncInputs();state.blockerMessage="";footer();
  if(event?.type==="change"&&(state.step===3||state.step===4)){setTimeout(render,0);return}
  if(event?.type==="change"&&state.step===6&&target?.id==="mpbControlsPerRoute"){preservePendingEditor();r2()?.configureManualRoutes?.(routeTargetCount(),controlsPerRoute());ensureRouteSelection();renderKeepScroll()}
}
async function onClick(e){
  const t=e.target.closest("button,a");if(!t)return;
  if(t.matches("[data-mpb-type],[data-mpb-restore-local],[data-mpb-layer]"))state.freshPristine=false;
  if(t.matches("[data-mpb-close],[data-mpb-save-exit]")){await saveAndExit();return}
  if((state.busy||state.publishing)&&t.matches("[data-mpb-next],[data-mpb-back],[data-mpb-jump],[data-mpb-publish-shortcut]"))return;
  if(t.matches("[data-mpb-publish-shortcut]")){state.root.querySelector("[data-mpb-publish]")?.scrollIntoView?.({behavior:"smooth",block:"center"});return}if(t.matches("[data-mpb-next]")){await next();return}if(t.matches("[data-mpb-back]")){back();return}if(t.matches("[data-mpb-jump]")){await jump(t.dataset.mpbJump);return}
  if(t.matches("[data-mpb-precision-open]")){openPrecisionPicker();return}if(t.matches("[data-mpb-precision-cancel]")){closePrecisionPicker();return}if(t.matches("[data-mpb-precision-confirm]")){confirmPrecisionPicker();return}
  if(t.matches("[data-mpb-restore-local]")){state.draft=readDraft();state.blockerMessage="";render();notify("Borrador local recuperado.");return}if(t.matches("[data-mpb-type]")){state.draft.raceType=t.dataset.mpbType;saveDraft();render();return}if(t.matches("[data-mpb-reuse]")){reuse();return}if(t.matches("[data-mpb-layer]")){chooseLayer(t.dataset.mpbLayer);return}if(t.matches("[data-mpb-import-plan]")){importPlan();return}if(t.matches("[data-mpb-map-geolocate]")){geolocateWorkArea();return}if(t.matches("[data-mpb-location-search]")){await searchLocation();return}if(t.matches("[data-mpb-location-result]")){selectLocationResult(t.dataset.mpbLocationResult);return}if(t.matches("[data-mpb-geolocate]")){geolocate();return}if(t.matches("[data-mpb-use-work-center]")){useWorkCenter();return}
  if(t.matches("[data-mpb-control-method]")){state.controlMethod=t.dataset.mpbControlMethod;state.atakPreview=null;state.atakFileName="";renderKeepScroll();return}
  if(t.matches("[data-mpb-coord-format]")){state.coordFormat=t.dataset.mpbCoordFormat;refreshControlsUi();return}
  if(t.matches("[data-mpb-save-coordinates]")){savePointCoordinates();return}
  if(t.matches("[data-mpb-choose-atak]")){state.root.querySelector("#mpbAtakFile")?.click();return}
  if(t.matches("[data-mpb-apply-atak]")){await applyAtakImport();return}
  if(t.matches("[data-mpb-controls-phase]")){if(t.dataset.mpbControlsPhase==="iof"&&!controlsComplete()){notify(controlsPlacementMessage());return}state.controlsPhase=t.dataset.mpbControlsPhase;render();return}
  if(t.matches("[data-mpb-point]")){state.selectedControlId=t.dataset.mpbPoint;refreshControlsUi();return}if(t.matches("[data-mpb-control-count]")){changeControlCount(Number(t.dataset.mpbControlCount));return}if(t.matches("[data-mpb-clear-point]")){clearSelectedControl();return}if(t.matches("[data-mpb-fit-controls]")){fitControls();return}if(t.matches("[data-mpb-iof-save-next]")){saveIofAndNext(t.dataset.mpbIofSaveNext);return}if(t.matches("[data-mpb-iof-pending]")){r2()?.setIofComplete?.(t.dataset.mpbIofPending,false);refreshControlsUi();return}
  if(t.matches("[data-mpb-route]")){preservePendingEditor();loadRouteDraft(t.dataset.mpbRoute);renderKeepScroll();return}if(t.matches("[data-mpb-route-control]")){toggleRouteControl(t.dataset.mpbRouteControl);return}if(t.matches("[data-mpb-route-undo]")){undoRouteControl();return}if(t.matches("[data-mpb-route-restore]")){await restoreRouteDraft();return}if(t.matches("[data-mpb-route-clear]")){await clearRouteDraft();return}if(t.matches("[data-mpb-save-route]")){await saveCurrentRoute();return}if(t.matches("[data-mpb-itinerary-route]")){preservePendingEditor();loadItineraryDraft(t.dataset.mpbItineraryRoute);renderKeepScroll();return}if(t.matches("[data-mpb-itinerary-undo]")){undoItineraryVertex();return}if(t.matches("[data-mpb-itinerary-reset]")){await resetItineraryDraft();return}if(t.matches("[data-mpb-itinerary-save]")){saveItinerary();return}if(t.matches("[data-mpb-download-package]")){await downloadOrganizerPackage();return}if(t.matches("[data-mpb-publish]")){await publishRace();return}if(t.matches("[data-mpb-open-participants]")){close();setTimeout(()=>premium.get("organizer-home")?.showOperations?.(),80);return}if(t.matches("[data-mpb-finish]")){await finishBase();return}
}
function open(opts={}){if(!canManage())return false;state.publicationEpoch++;state.draftOwnerUid=String((state.auth||globalThis.MILITOPO_V2_AUTH)?.uid||"");ensure();const ctx=bridge()?.shell?.current?.()||{};state.mode=opts.resumeCurrent?"resume":"create";state.eventId=state.mode==="resume"?String(opts.eventId||ctx.eventId||"").trim():"";if(state.mode==="resume"&&!state.eventId){notify("Carga una carrera antes de continuar la preparación.");return false}state.freshPristine=Boolean(opts.fresh&&state.mode==="create");state.hydrating=true;state.draft=state.mode==="resume"?hydrateExisting(state.eventId):(opts.fresh?freshDraft():readDraft());if(validCoords()&&!String(state.draft.locationName||"").trim()){state.draft.locationName="Punto seleccionado en el mapa";saveDraft()}if(opts.fresh&&state.mode==="create"){/* F2.25: no eliminar un borrador local anterior hasta que el usuario lo sustituya expresamente. */}const requested=Number(opts.step);state.step=Number.isFinite(requested)?Math.max(0,Math.min(steps.length-1,requested)):(state.mode==="resume"?suggestedResumeStep():0);const s=snapshot(),firstPending=controlOrder(s).find(p=>!pointPlaced(p)||!r2()?.getIofModel?.(p.id)?.complete);state.selectedControlId=firstPending?.id||s?.selectedPointId||"START";state.controlsPhase=controlsComplete()?"iof":"placement";state.controlMethod="map";state.coordFormat="utm";state.atakPreview=null;state.atakFileName="";state.selectedRouteId=pendingResumeRoute(state.draft);loadRouteDraft(state.selectedRouteId);state.blockerMessage="";if(state.step===7)loadItineraryDraft(state.selectedRouteId);state.root.classList.add("is-open");state.root.setAttribute("aria-hidden","false");document.body.classList.add("militopo-premium-builder-open");state.opened=true;try{render()}finally{state.hydrating=false}return true}
function resumeCurrent(){return open({resumeCurrent:true})}
function close(){state.publicationEpoch++;const wasOpen=state.opened;destroyMaps();if(!state.root)return;state.root.classList.remove("is-open");state.root.setAttribute("aria-hidden","true");document.body.classList.remove("militopo-premium-builder-open");state.opened=false;if(wasOpen&&document.body.classList.contains("mor-organizer-shell")){queueMicrotask(()=>premium.get("organizer-home")?.open?.())}}

premium.register("event-builder",Object.freeze({open,resumeCurrent,close,isOpen:()=>state.opened,getDraft:()=>Object.freeze({...state.draft})}),{version:"r5b-control-placement-utm-atak-20261019",purpose:"guided-controls-placement-map-utm-latlon-atak-then-iof"});
globalThis.addEventListener("militopo:v2-auth-ready",e=>{state.publicationEpoch++;state.auth=e.detail||globalThis.MILITOPO_V2_AUTH||null;if(!canManage()||currentDraftOwner()!==state.draftOwnerUid)close()});
globalThis.addEventListener("militopo:v2-orientation-import",e=>{const d=e.detail||{};state.importState={message:d.message||d.stage||"Procesando plano…",state:d.state||"progress"};updateImportStatus();if(d.state==="success"){const c=d.map||activeCustomMap();state.draft.mapLayer="custom";state.draft.customMapId=c?.id||"";state.draft.customMapName=c?.name||d.fileName||"Plano propio";state.draft.customMapFormat=c?.format||"";if(c?.bounds&&globalThis.L){const b=L.latLngBounds(c.bounds),m=b.getCenter();setWorkCenter(m.lat,m.lng,14,true)}saveDraft();if(state.opened&&state.step===2)setTimeout(render,40)}});
globalThis.addEventListener("militopo:v2-orientation-custom-map",e=>{if(!state.opened||state.step!==2)return;const c=e.detail?.map;if(!c)return;state.draft.customMapId=c.id||"";state.draft.customMapName=c.name||"";state.draft.customMapFormat=c.format||"";saveDraft()});
globalThis.addEventListener("militopo:premium-controls-updated",()=>{if(state.opened&&state.step===5)setTimeout(refreshControlsUi,20)});
globalThis.addEventListener("militopo:premium-iof-updated",()=>{if(state.opened&&state.step===5)setTimeout(refreshControlsUi,20)});
globalThis.addEventListener("militopo:r2-route-updated",()=>{if(state.opened&&state.step===6)setTimeout(renderKeepScroll,20)});
async function syncCurrentDraftMetadata(){
  if(state.metadataSyncBusy){state.metadataSyncAgain=true;return false}
  const eventId=String(state.eventId||""),draft=state.draft,uid=state.draftOwnerUid,epoch=state.publicationEpoch;
  const current=()=>{
    const auth=state.auth||globalThis.MILITOPO_V2_AUTH,ctx=bridge()?.shell?.current?.()||{};
    return Boolean(eventId&&draft&&uid&&auth?.emailVerified&&canManage())&&!state.publishing&&navigator.onLine&&
      state.publicationEpoch===epoch&&state.draft===draft&&String(auth?.uid||"")===uid&&
      String(state.eventId||"")===eventId&&String(ctx.eventId||"")===eventId&&["draft","prepared"].includes(String(ctx.status||"").toLowerCase());
  };
  if(!current())return false;
  if(!saveDraft())return false;
  state.metadataSyncBusy=true;
  const revision=JSON.stringify(draft);
  try{
    const ok=await syncMetadata(eventId,0,()=>current()&&JSON.stringify(draft)===revision);
    if(current()&&JSON.stringify(draft)===revision)draftSaveStatus(ok?"Metadatos sincronizados · ediciones parciales conservadas aquí":"Borrador local conservado · metadatos pendientes de sincronizar");
    return ok;
  }catch(error){if(current())draftSaveStatus("Borrador local conservado · no se confirmó la sincronización");console.warn("[MILITOPO Premium Builder] reconexión",error);return false}
  finally{
    state.metadataSyncBusy=false;
    const again=state.metadataSyncAgain||(current()&&JSON.stringify(draft)!==revision);
    state.metadataSyncAgain=false;
    if(again&&current())setTimeout(()=>{void syncCurrentDraftMetadata()},300);
  }
}
globalThis.addEventListener("online",()=>{void syncCurrentDraftMetadata()});
globalThis.addEventListener("pagehide",preserveBeforeSuspend);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")preserveBeforeSuspend()});

["online","offline"].forEach(type=>globalThis.addEventListener(type,refreshPublicationAvailability));

globalThis.addEventListener("militopo:v2-auth-signed-out",()=>{state.auth=null;close()});
globalThis.addEventListener("militopo:v2-cloud-event-applied",e=>{if(e.detail?.ok)state.publicationEpoch++});
