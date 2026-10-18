/* MILITOPO Premium · P2A.2 · Home contextual + continuación guiada */
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const premium=globalThis.MILITOPO_PREMIUM;
if(!premium) throw new Error("MILITOPO Premium core no disponible");

const MANAGER_ROLES=new Set(["organizer","super_admin"]);
const STATUS_LABELS={draft:"BORRADOR",prepared:"PREPARADO",published:"PUBLICADO",live:"EN DIRECTO",finished:"FINALIZADO",archived:"ARCHIVADO"};
const state={auth:globalThis.MILITOPO_V2_AUTH||null,root:null,opened:false,autoOpened:false,busy:false,lastRows:[],lastFetch:0};
const $=(sel,root=document)=>root.querySelector(sel);

function esc(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function role(){return String(state.auth?.role||globalThis.MILITOPO_V2_AUTH?.role||"").toLowerCase()}
function canManage(){return Boolean(state.auth?.uid&&state.auth?.emailVerified&&MANAGER_ROLES.has(role()))}
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
  if(ctx.status==="published")return {label:"GESTIONAR PARTICIPANTES",action:"participants",kind:"primary"};
  return {label:"CONTINUAR PREPARACIÓN",action:"builder",kind:"primary"};
}

function ensure(){
  if(state.root?.isConnected)return state.root;
  const root=document.createElement("section");
  root.className="mpp-home";root.id="militopoPremiumHome";root.setAttribute("aria-label","Inicio MILITOPO");
  root.innerHTML=`<div class="mpp-home-scroll"><div class="mpp-home-inner">
    <header class="mpp-r2-header"><div class="mpp-r2-heading"><span>MILITOPO · ORGANIZADOR</span><h1>Centro de carreras</h1><small>Crea, publica y dirige desde un solo lugar.</small></div>
      <div class="mpp-r2-header-tools"><button type="button" data-mpp-action="profile">MI PERFIL</button><button type="button" class="is-gold" data-mpp-action="mode-choice">CAMBIAR MODO ↗</button></div></header>
    <div class="mpp-home-hero mpp-home-hero-r2">
      <article class="mpp-home-current" data-mpp-current></article>
      <article class="mpp-home-lead"><div><div class="mpp-eyebrow">LO SIGUIENTE PARA TU CARRERA</div><h2>Todo bajo control.</h2><p>El siguiente paso cambia según el estado de tu carrera. Sin menús duplicados ni configuraciones innecesarias.</p></div><div class="mpp-home-actions" data-mpp-actions></div></article>
    </div>
    <section class="mpp-home-section">
      <div class="mpp-section-title"><h2>Mis carreras</h2><span data-mpp-sync>Preparando resumen…</span></div>
      <div class="mpp-stats" data-mpp-stats></div>
    </section>
    <section class="mpp-home-section">
      <div class="mpp-section-title"><h2>Centro de operaciones</h2><span>Herramientas según tu carrera</span></div>
      <div class="mpp-quick" data-mpp-quick></div>
    </section>
    <section class="mpp-r2-account"><div><span>UN PERFIL · DOS EXPERIENCIAS</span><strong>Tu actividad de corredor y organizador pertenece a la misma cuenta.</strong><small>Consulta tus resultados deportivos desde CORRER. Gestiona tus eventos desde aquí.</small></div><button type="button" data-mpp-action="runner-profile">VER MI RENDIMIENTO →</button></section>
    <details class="mpp-r2-advanced"><summary>Herramientas avanzadas de gestión</summary><div><button type="button" data-mpp-action="manager">GESTIÓN CLÁSICA</button><button type="button" data-mpp-action="map">MAPA DE TRABAJO</button><button type="button" data-mpp-action="analysis">ANÁLISIS TÉCNICO</button></div><p>Estos módulos permanecen accesibles mientras se integran en el nuevo centro. No se eliminan datos ni funciones.</p></details>
    <div class="mpp-home-foot"><span><b>R2 · CENTRO DE CARRERAS</b></span><span>Autorización y estados conservados.</span></div>
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
    <button type="button" data-mpp-action="races"><span class="mpp-r2-quick-icon">▤</span><strong>MIS CARRERAS</strong><small>Crea, carga y continúa</small></button>
    <button type="button" data-mpp-action="participants"><span class="mpp-r2-quick-icon">♙</span><strong>PARTICIPANTES</strong><small>Invitaciones y asignaciones</small></button>
    <button type="button" data-mpp-action="live"><span class="mpp-r2-quick-icon">◉</span><strong>LIVE</strong><small>Seguimiento operativo</small></button>
    <button type="button" data-mpp-action="results"><span class="mpp-r2-quick-icon">▥</span><strong>RESULTADOS</strong><small>Clasificación e histórico</small></button>`;

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

async function getBuilderReady(timeout=1800){
  const first=premium.get("event-builder");
  if(first?.open)return first;
  const started=Date.now();
  while(Date.now()-started<timeout){
    await new Promise(resolve=>setTimeout(resolve,60));
    const builder=premium.get("event-builder");
    if(builder?.open)return builder;
  }
  return null;
}
async function openBuilder(options={}){
  const builder=await getBuilderReady();
  if(!builder){
    bridge()?.toast?.("No se ha podido cargar el asistente Premium. Cierra y vuelve a abrir MILITOPO.");
    console.error("[MILITOPO Premium Home] event-builder no disponible",premium.health?.());
    return false;
  }
  if(options.resumeCurrent&&builder.resumeCurrent)return builder.resumeCurrent();
  return builder.open(options);
}
async function run(action){
  if(action==="mode-choice"){close();return globalThis.MILITOPO_ORIENTATION_MODES?.open?.()||false}
  if(action==="runner-profile"){
    const url=new URL("./participante/",location.href);url.searchParams.set("militopo_tab","profile");location.assign(url.href);return true;
  }
  const b=bridge();if(!b)return false;
  if(action==="profile")return b.shell.profile();
  if(action==="create"||action==="builder"){
    const ok=await openBuilder(action==="create"?{fresh:true}:{resumeCurrent:true});
    if(ok!==false)close();
    return ok;
  }
  if(action!=="map")close();
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

premium.register("organizer-home",Object.freeze({open,close,refresh,isOpen:()=>state.opened}),{version:"p2c1",purpose:"role-home-guided-resume-safe-builder"});

globalThis.addEventListener("militopo:v2-auth-ready",event=>{
  state.auth=event.detail||globalThis.MILITOPO_V2_AUTH||null;
  if(!canManage())close();
  /* R1: la elección inicial de modo decide cuándo abrir el Centro.
     No abrir Home automáticamente por encima del selector. */
});
["militopo:v2-cloud-event-applied","militopo:v2-event-status","militopo:v2-event-status-changed","militopo:r5-reuse-complete"].forEach(name=>globalThis.addEventListener(name,()=>setTimeout(refresh,120)));
globalThis.addEventListener("online",()=>{if(state.opened)fetchRows(true)});
globalThis.addEventListener("offline",()=>{if(state.opened)renderStats(state.lastRows,false)});

if(globalThis.MILITOPO_V2_AUTH)state.auth=globalThis.MILITOPO_V2_AUTH;
