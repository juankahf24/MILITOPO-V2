/* MILITOPO Premium · P2A · Home contextual del Organizador/Super Admin */
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const premium=globalThis.MILITOPO_PREMIUM;
if(!premium) throw new Error("MILITOPO Premium core no disponible");

const MANAGER_ROLES=new Set(["organizer","super_admin"]);
const STATUS_LABELS={draft:"BORRADOR",prepared:"PREPARADO",published:"PUBLICADO",live:"EN DIRECTO",finished:"FINALIZADO",archived:"ARCHIVADO"};
const state={auth:globalThis.MILITOPO_V2_AUTH||null,root:null,opened:false,autoOpened:false,busy:false,lastRows:[],lastFetch:0};
const $=(sel,root=document)=>root.querySelector(sel);

function esc(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function role(){return String(state.auth?.role||globalThis.MILITOPO_V2_AUTH?.role||"").toLowerCase()}
function canManage(){return Boolean(state.auth?.uid&&MANAGER_ROLES.has(role()))}
function bridge(){return premium.get("legacy-bridge")}
function current(){return bridge()?.shell?.current?.()||Object.freeze({})}
function statusLabel(status){return STATUS_LABELS[String(status||"draft").toLowerCase()]||"BORRADOR"}

function nextMessage(status,eventId){
  if(!eventId)return "Crea una carrera o carga una existente para empezar.";
  switch(String(status||"draft")){
    case "draft":return "Continúa configurando mapa, controles y recorridos.";
    case "prepared":return "La estructura está preparada. Revisa y publica cuando quieras abrir inscripciones.";
    case "published":return "Carrera publicada. Ya puedes gestionar participantes e invitaciones.";
    case "live":return "Carrera en directo. Prioridad: seguimiento, incidencias y llegadas.";
    case "finished":return "Carrera finalizada. Revisa resultados y clasificación.";
    case "archived":return "Carrera archivada y disponible en histórico.";
    default:return "Continúa gestionando la carrera.";
  }
}
function primaryFor(ctx){
  if(!ctx.eventId)return {label:"CREAR CARRERA",action:"create",kind:"primary"};
  if(ctx.status==="live")return {label:"ABRIR LIVE",action:"live",kind:"primary"};
  if(ctx.status==="finished"||ctx.status==="archived")return {label:"VER RESULTADOS",action:"results",kind:"primary"};
  return {label:"CONTINUAR PREPARACIÓN",action:"manager",kind:"primary"};
}

function ensure(){
  if(state.root?.isConnected)return state.root;
  const root=document.createElement("section");
  root.className="mpp-home";root.id="militopoPremiumHome";root.setAttribute("aria-label","Inicio MILITOPO");
  root.innerHTML=`<div class="mpp-home-scroll"><div class="mpp-home-inner">
    <div class="mpp-home-hero">
      <article class="mpp-home-lead">
        <div><div class="mpp-eyebrow">MILITOPO · CENTRO DE CARRERAS</div><h1>Organiza sin perderte.</h1><p>Crea, prepara y opera una carrera desde un único punto. MILITOPO te muestra lo importante y deja el detalle para cuando lo necesitas.</p></div>
        <div class="mpp-home-actions" data-mpp-actions></div>
      </article>
      <article class="mpp-home-current" data-mpp-current></article>
    </div>
    <section class="mpp-home-section">
      <div class="mpp-section-title"><h2>TUS CARRERAS</h2><span data-mpp-sync>Preparando resumen…</span></div>
      <div class="mpp-stats" data-mpp-stats></div>
    </section>
    <section class="mpp-home-section">
      <div class="mpp-section-title"><h2>ACCESOS RÁPIDOS</h2><span>Solo lo que necesitas ahora</span></div>
      <div class="mpp-quick" data-mpp-quick></div>
    </section>
    <div class="mpp-home-foot"><span><b>PREMIUM P1</b> · Home contextual</span><span>Mapa, carrera y herramientas siguen disponibles en la barra superior.</span></div>
  </div></div>`;
  root.addEventListener("click",onClick);
  document.body.appendChild(root);state.root=root;return root;
}

function renderCurrent(){
  const ctx=current(),target=$("[data-mpp-current]",ensure());
  const id=String(ctx.eventId||"").trim(),name=id?String(ctx.eventName||"Carrera").trim():"NINGUNA CARRERA CARGADA";
  const status=String(ctx.status||"draft").toLowerCase();
  target.innerHTML=`<div class="mpp-current-head"><span>CARRERA ACTUAL</span><span class="mpp-status" data-status="${esc(status)}">${id?esc(statusLabel(status)):"SIN CARGAR"}</span></div>
    <div class="mpp-current-title">${esc(name)}</div>
    <div class="mpp-current-id">${id?esc(id):"Carga una carrera para trabajar sobre ella"}</div>
    <div class="mpp-current-next"><small>SIGUIENTE PASO</small><strong>${esc(nextMessage(status,id))}</strong></div>`;
  const main=primaryFor({eventId:id,status});
  $("[data-mpp-actions]",state.root).innerHTML=`
    <button class="mpp-btn mpp-btn-${main.kind}" type="button" data-mpp-action="${main.action}">${main.label}</button>
    <button class="mpp-btn mpp-btn-gold" type="button" data-mpp-action="races">MIS CARRERAS</button>
    <button class="mpp-btn mpp-btn-ghost" type="button" data-mpp-action="map">ABRIR MAPA</button>`;

  const quick=$("[data-mpp-quick]",state.root),admin=role()==="super_admin";
  quick.innerHTML=`
    <button type="button" data-mpp-action="manager"><strong>GESTIONAR CARRERA</strong><small>Preparación, estado y operación</small></button>
    <button type="button" data-mpp-action="participants"><strong>PARTICIPANTES</strong><small>Invitaciones, censo y asignaciones</small></button>
    <button type="button" data-mpp-action="history"><strong>HISTÓRICO</strong><small>Carreras cerradas y resultados</small></button>
    <button type="button" data-mpp-action="${admin?"admin":"analysis"}"><strong>${admin?"ADMINISTRACIÓN":"ANÁLISIS"}</strong><small>${admin?"Usuarios, roles y supervisión":"Reproductor y post-carrera"}</small></button>`;
}

function renderStats(rows=state.lastRows,loading=false){
  const target=$("[data-mpp-stats]",ensure()),sync=$("[data-mpp-sync]",state.root);
  const counts={prep:0,published:0,live:0,closed:0};
  rows.forEach(row=>{const s=String(row.status||"draft").toLowerCase();if(s==="draft"||s==="prepared")counts.prep++;else if(s==="published")counts.published++;else if(s==="live")counts.live++;else if(s==="finished"||s==="archived")counts.closed++;});
  target.classList.toggle("mpp-loading",loading);
  target.innerHTML=`
    <div class="mpp-stat"><strong>${counts.prep}</strong><span>EN PREPARACIÓN</span></div>
    <div class="mpp-stat"><strong>${counts.published}</strong><span>PUBLICADAS</span></div>
    <div class="mpp-stat is-live"><strong>${counts.live}</strong><span>EN DIRECTO</span></div>
    <div class="mpp-stat"><strong>${counts.closed}</strong><span>FINALIZADAS / ARCHIVADAS</span></div>`;
  if(sync){
    if(!navigator.onLine)sync.textContent="Sin conexión · usando datos disponibles";
    else if(loading)sync.textContent="Actualizando…";
    else sync.textContent=`${rows.length} carrera${rows.length===1?"":"s"} localizada${rows.length===1?"":"s"}`;
  }
}

async function fetchRows(force=false){
  if(!canManage())return [];
  if(!navigator.onLine){renderStats(state.lastRows,false);return state.lastRows;}
  if(state.busy)return state.lastRows;
  if(!force&&Date.now()-state.lastFetch<30000&&state.lastRows.length){renderStats(state.lastRows,false);return state.lastRows;}
  state.busy=true;renderStats(state.lastRows,true);
  try{
    const {firestore}=await globalThis.MILITOPO_V2.firebase();
    const ref=collection(firestore,"events");
    const source=role()==="super_admin"?ref:query(ref,where("ownerUid","==",String(state.auth.uid)));
    const snap=await getDocs(source),rows=[];
    snap.forEach(d=>{const x=d.data()||{};if(String(x.kind||"orientation")!=="orientation")return;rows.push({eventId:String(x.eventId||d.id),status:String(x.status||"draft")});});
    state.lastRows=rows;state.lastFetch=Date.now();renderStats(rows,false);return rows;
  }catch(error){
    console.warn("[MILITOPO Premium Home] resumen",error);renderStats(state.lastRows,false);
    const sync=$("[data-mpp-sync]",state.root);if(sync)sync.textContent="Resumen no disponible ahora";
    return state.lastRows;
  }finally{state.busy=false}
}

async function run(action){
  const b=bridge();if(!b)return false;
  if(action!=="map")close();
  if(action==="create"){const builder=premium.get("event-builder");if(builder?.open)return builder.open();return await b.event.create();}
  if(action==="races")return b.shell.races();
  if(action==="map"){close();return b.map.home();}
  if(action==="manager")return b.shell.manager();
  if(action==="participants")return b.shell.participants();
  if(action==="live")return b.shell.live();
  if(action==="results")return b.shell.results();
  if(action==="analysis")return b.shell.analysis();
  if(action==="history")return b.shell.history();
  if(action==="admin")return b.shell.admin();
  return false;
}
function onClick(event){const button=event.target.closest("[data-mpp-action]");if(!button)return;run(button.dataset.mppAction)}

function open(){
  if(!canManage())return false;
  const root=ensure();renderCurrent();renderStats(state.lastRows,false);root.classList.add("is-open");root.setAttribute("aria-hidden","false");document.body.classList.add("militopo-premium-home-open");state.opened=true;fetchRows(false);return true;
}
function close(){if(!state.root)return;state.root.classList.remove("is-open");state.root.setAttribute("aria-hidden","true");document.body.classList.remove("militopo-premium-home-open");state.opened=false}
function refresh(){if(!state.root)return;renderCurrent();if(state.opened)fetchRows(true)}

premium.register("organizer-home",Object.freeze({open,close,refresh,isOpen:()=>state.opened}),{version:"p2a",purpose:"role-home"});

globalThis.addEventListener("militopo:v2-auth-ready",event=>{
  state.auth=event.detail||globalThis.MILITOPO_V2_AUTH||null;
  if(canManage()&&!state.autoOpened){state.autoOpened=true;setTimeout(open,360)}
  else if(!canManage())close();
});
["militopo:v2-cloud-event-applied","militopo:v2-event-status","militopo:v2-event-status-changed","militopo:r5-reuse-complete"].forEach(name=>globalThis.addEventListener(name,()=>setTimeout(refresh,120)));
globalThis.addEventListener("online",()=>{if(state.opened)fetchRows(true)});
globalThis.addEventListener("offline",()=>{if(state.opened)renderStats(state.lastRows,false)});

if(globalThis.MILITOPO_V2_AUTH){state.auth=globalThis.MILITOPO_V2_AUTH;if(canManage()&&!state.autoOpened){state.autoOpened=true;setTimeout(open,520)}}
