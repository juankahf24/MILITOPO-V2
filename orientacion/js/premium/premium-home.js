import {raceInfoHtml} from "../../../js/v2/race/race-info-ui.js?v=2.0.34";
import {personalProfileHtml,openPersonalProfileEditor,openPersonalPhoto} from "../../../js/v2/profile/personal-profile-ui.js?v=2.0.33";
/* MILITOPO R5 · Centro de carreras, nuevo organizador a pantalla completa.
 * El mapa histórico queda como motor interno; solo se muestran pantallas del nuevo centro.
 * Roles/permisos vienen del auth real de Firebase, no del modo de navegación. */
import {collection,getDocs,getDoc,doc,query,where} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {fetchOrganizerUnifiedProfile} from "./organizer-profile-data.js?v=militopo-r4-profile-20261019";
const premium=globalThis.MILITOPO_PREMIUM;
if(!premium)throw new Error("MILITOPO Premium core no disponible");
const ROLES=new Set(["organizer","super_admin"]);
const LABELS={draft:"BORRADOR",prepared:"PREPARADO",published:"PUBLICADA",live:"EN DIRECTO",finished:"FINALIZADA"};
const state={auth:globalThis.MILITOPO_V2_AUTH||null,root:null,opened:false,screen:"home",rows:[],rowsLoaded:false,rowsError:"",lastFetch:0,busy:false,pendingRecoveryId:"",filter:"all",search:"",raceLimit:10,notice:"",profile:{uid:"",busy:false,loadedAt:0,user:null,history:null,profileError:"",historyError:""},profileRequest:0,operationKind:"publish",packageBusy:false};
const $=(sel,root=document)=>root.querySelector(sel);
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const role=()=>String(state.auth?.role||globalThis.MILITOPO_V2_AUTH?.role||"").toLowerCase();
const canManage=()=>Boolean(state.auth?.uid&&state.auth.emailVerified&&ROLES.has(role()));
const bridge=()=>premium.get("legacy-bridge");
const current=()=>bridge()?.shell?.current?.()||{};
const status=s=>{const raw=String(s||"draft").toLowerCase();return raw==="archived"?"finished":raw};
const statusLabel=s=>LABELS[status(s)]||"BORRADOR";
const isEditable=s=>["draft","prepared"].includes(status(s));
function icon(name){const p={lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>',plus:'<path d="M12 5v14M5 12h14"/>',arrow:'<path d="m5 12 14 0m-6-6 6 6-6 6"/>',back:'<path d="m15 18-6-6 6-6"/>',calendar:'<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4M16 2v4M3 10h18"/>',chart:'<path d="M4 19V5m0 14h16M8 15v-5m5 5V7m5 8V4"/>',users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m14-17a4 4 0 0 1 0 8m6 9v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',radio:'<circle cx="12" cy="12" r="2"/><path d="M7 7a7 7 0 0 0 0 10m10-10a7 7 0 0 1 0 10M4 4a11 11 0 0 0 0 16m16-16a11 11 0 0 1 0 16"/>',route:'<circle cx="6" cy="4" r="2"/><circle cx="18" cy="20" r="2"/><path d="M6 6v7a5 5 0 0 0 5 5h5m-5-13h5a4 4 0 0 1 0 8h-5"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"/>',flag:'<path d="M5 21V4m0 0c5-2 9 2 14 0v12c-5 2-9-2-14 0"/>',refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 9a8 8 0 0 1 14 3m-2 3a8 8 0 0 1-14-3"/>',search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',shield:'<path d="M12 2 4 6v6c0 5 3 8 8 10 5-2 8-5 8-10V6z"/><path d="m9 12 2 2 4-4"/>'};return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p[name]||p.arrow}</svg>`}
function message(text){state.notice=String(text||"");const node=$('[data-mpp-notice]',state.root);if(node){node.textContent=state.notice;node.hidden=!state.notice}}
function primary(ctx){if(!ctx.eventId)return {label:"CREAR MI PRIMERA CARRERA",action:"create",icon:"plus"};const s=status(ctx.status);if(isEditable(s))return {label:"CONTINUAR ASISTENTE",action:"builder",icon:"route"};if(s==="published")return globalThis.MILITOPO_PACKAGE?.ready()?{label:"INICIAR CARRERA",action:"launch-live",icon:"radio"}:{label:"INVITAR PARTICIPANTES",action:"participants",icon:"users"};if(s==="live")return {label:"ABRIR LIVE",action:"live",icon:"radio"};return {label:"VER RESULTADOS",action:"results",icon:"chart"}}
function ensure(){if(state.root?.isConnected)return state.root;
  const root=document.createElement("section");root.id="militopoPremiumHome";root.className="mpp-home";root.setAttribute("aria-label","Centro de carreras MILITOPO");
  root.innerHTML=`<div class="mpp-home-scroll"><div class="mpp-home-inner">
    <header class="mpp-r3-header"><div class="mpp-r3-identity"><img src="../icons/militopo-512.png" alt="" width="48" height="48"><div><span>ORIENTACIÓN / MILITOPO</span><strong>Centro de carreras</strong></div></div>
    <div class="mpp-r3-tools"><button type="button" data-mpp-action="profile" aria-label="Mi perfil y estadísticas" title="Mi perfil">${icon("user")}</button><button type="button" data-mpp-action="mode-choice" aria-label="Cambiar modo" title="Cambiar modo">${icon("users")}</button></div></header>
    <div class="mpp-r3-notice" data-mpp-notice role="status" hidden></div>
    <main data-mpp-view class="mpp-r3-view"></main>
    <footer class="mpp-r3-footer"><span>MILITOPO ORIENTACIÓN</span><span>Una cuenta · Dos experiencias</span></footer>
  </div></div>`;
  root.addEventListener("click",onClick);root.addEventListener("input",onInput);root.addEventListener("change",onInput);document.body.appendChild(root);state.root=root;return root;
}
function statCounts(){const stats={draft:0,published:0,live:0,closed:0};for(const row of state.rows){const s=status(row.status);if(isEditable(s))stats.draft++;if(s==="published")stats.published++;if(s==="live")stats.live++;if(s==="finished")stats.closed++}return stats}
function statCards(){const stats=statCounts(),n=value=>state.rowsLoaded?value:"—";return `<div class="mpp-r3-stats"><article><strong>${n(stats.draft)}</strong><small>EN PREPARACIÓN</small></article><article><strong>${n(stats.published)}</strong><small>PUBLICADAS</small></article><article class="is-live"><strong>${n(stats.live)}</strong><small>EN DIRECTO</small></article><article><strong>${n(stats.closed)}</strong><small>FINALIZADAS</small></article></div>`}
function currentCard(){const ctx=current(),id=String(ctx.eventId||"").trim(),s=status(ctx.status),name=id?ctx.eventName||"Carrera sin nombre":"Todavía no hay carrera activa";const p=primary({eventId:id,status:s});
  return `<article class="mpp-r3-current"><div class="mpp-r3-current-top"><small>CARRERA ACTUAL</small><span class="mpp-r3-status" data-status="${esc(s)}">${id?statusLabel(s):"SIN CARRERA"}</span></div><h2>${esc(name)}</h2><div class="mpp-r3-sub">${id?esc(id):"Tu próxima carrera empieza con un asistente guiado."}</div>${id?raceInfoHtml({eventId:id,status:s},"light"):""}
    <div class="mpp-r3-current-bottom"><p>${!id?"Diseña una carrera desde cero. MILITOPO guarda lo que avances.":isEditable(s)?"Diseño en curso · Revisa cada paso antes de publicar.":s==="published"?(p.action==="launch-live"?"Participantes cerrados · Descarga el ZIP y abre LIVE para iniciar la carrera.":"Carrera publicada · Gestiona las invitaciones y participantes."):s==="live"?"Carrera en directo · Prioriza el seguimiento.":"Carrera completada · Consulta resultados e histórico."}</p>
    <button type="button" class="mpp-r3-main-action ${p.action==="launch-live"?"is-start-ready":""}" data-mpp-action="${p.action}">${icon(p.icon)}<span>${p.label}</span>${icon("arrow")}</button>${s==="published"&&p.action!=="launch-live"?`<button type="button" class="mpp-r3-live-entry" data-mpp-action="launch-live">${icon("radio")} IR A LIVE PARA INICIAR ${icon("arrow")}</button>`:""}<button type="button" class="mpp-r5-open-flow" data-mpp-action="operations">${icon("flag")} GESTIONAR CARRERA ${icon("arrow")}</button></div></article>`;
}
function homeHtml(){const n=state.rows.length;return `<section class="mpp-r3-intro"><div><span>ESPACIO DEL ORGANIZADOR</span><h1>Todo listo para tu próxima carrera.</h1><p>Desde el diseño hasta los resultados. Una sola pantalla para empezar y cada tarea en su propio paso.</p></div><div class="mpp-r3-intro-accent"><span>01</span><strong>DISEÑA</strong><i>→</i><span>02</span><strong>GESTIONA</strong><i>→</i><span>03</span><strong>ANALIZA</strong></div></section>
  <section class="mpp-r3-main-grid">${currentCard()}<div class="mpp-r3-actions"><div class="mpp-r3-section-kicker">ACCESOS DIRECTOS</div><button class="mpp-r3-action is-gold" type="button" data-mpp-action="create"><span class="mpp-r3-icon">${icon("plus")}</span><span><strong>Crear nueva carrera</strong><small>Abre el asistente desde el primer paso</small></span>${icon("arrow")}</button><button class="mpp-r3-action" type="button" data-mpp-action="races"><span class="mpp-r3-icon">${icon("calendar")}</span><span><strong>Mis carreras</strong><small>${n?n+" carreras disponibles":"Ver, cargar y continuar"}</small></span>${icon("arrow")}</button><button class="mpp-r3-action" type="button" data-mpp-action="profile"><span class="mpp-r3-icon">${icon("chart")}</span><span><strong>Mi perfil y estadísticas</strong><small>Tu actividad en MILITOPO</small></span>${icon("arrow")}</button></div></section>
  <section class="mpp-r3-section"><div class="mpp-r3-section-head"><div><small>VISIÓN GENERAL</small><h2>Mis carreras en cifras</h2></div><button type="button" data-mpp-action="races">VER TODAS ${icon("arrow")}</button></div>${statCards()}</section>
  `}
// F2.26: usar EXCLUSIVAMENTE createdAt de Firestore. La última edición/publicación
// nunca debe presentarse como fecha de creación. Registros legacy sin campo: al final.
function createdAtMs(value){
  if(value==null)return 0;
  let ms=NaN;
  if(typeof value.toMillis==="function")ms=value.toMillis();
  else if(typeof value.seconds==="number")ms=value.seconds*1000+(Number(value.nanoseconds)||0)/1e6;
  else if(value instanceof Date)ms=value.getTime();
  else if(typeof value==="string")ms=Date.parse(value);
  else if(typeof value==="number")ms=value>1e12?value:value>1e9?value*1000:NaN;
  return Number.isFinite(ms)&&ms>0?ms:0;
}
function createdLabel(ms){return ms?new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"short",year:"numeric",timeZone:"Europe/Madrid"}).format(ms):"Fecha de creación no disponible"}
function filteredRows(){return state.rows.filter(row=>{const q=state.search.toLocaleLowerCase("es"),s=status(row.status);const hit=!q||[row.eventName,row.eventId].join(" ").toLocaleLowerCase("es").includes(q);return hit&&(state.filter==="all"||state.filter==="draft"&&isEditable(s)||s===state.filter||state.filter==="closed"&&s==="finished")})}
function raceListHtml(){const all=filteredRows(),rows=all.slice(0,state.raceLimit);return rows.length?rows.map(row=>`<article><div><span class="mpp-r3-status" data-status="${esc(status(row.status))}">${statusLabel(row.status)}</span><h3>${esc(row.eventName||"Carrera")}</h3><small>${esc(row.eventId)}</small><span class="mpp-r3-created">${icon("calendar")} Creada: ${esc(createdLabel(row.createdMs))}</span></div><div class="mpp-r5-race-actions"><button type="button" data-mpp-reuse="${esc(row.eventId)}" ${status(row.status)==="live"?"disabled":""}>REUTILIZAR</button><button type="button" data-mpp-load="${esc(row.eventId)}">ABRIR ${icon("arrow")}</button></div></article>`).join("")+`<p class="mpp-r3-page-count">Mostrando ${rows.length} de ${all.length} carreras</p>${rows.length<all.length?'<button type="button" class="mpp-r3-show-more" data-mpp-action="more-races">MOSTRAR 10 MÁS</button>':""}`:`<div class="mpp-r3-empty">${state.busy?"Cargando carreras…":state.rows.length?"No hay carreras con esos filtros.":navigator.onLine?"Aún no hay carreras disponibles. Puedes empezar con el asistente.":"Sin conexión. La carrera cargada localmente sigue disponible."}</div>`}
// Refrescar solo las tarjetas: Firebase, eventos LIVE y guardado del asistente
// NO pueden sustituir el input enfocado ni cerrar el teclado virtual en Safari.
function refreshRaceList(){const target=$(".mpp-r3-race-list",state.root);if(target)target.innerHTML=raceListHtml()}

function racesHtml(){return `<section class="mpp-r3-page-head" data-mpp-races-head><button type="button" data-mpp-action="home">${icon("back")} VOLVER AL CENTRO</button><small>MIS CARRERAS</small><h1>Tu calendario de organización</h1><p>Selecciona una carrera para seguir exactamente donde la dejaste.</p></section><section class="mpp-r3-section mpp-r3-races"><div class="mpp-r3-filters"><label>${icon("search")}<input data-mpp-search type="search" placeholder="Buscar por nombre o código" value="${esc(state.search)}" autocomplete="off"></label><select data-mpp-filter aria-label="Filtrar carreras">${[["all","Todas"],["draft","En preparación"],["published","Publicadas"],["live","En directo"],["closed","Finalizadas"]].map(([value,label])=>`<option value="${value}" ${state.filter===value?"selected":""}>${label}</option>`).join("")}</select><button type="button" data-mpp-action="refresh" aria-label="Actualizar carreras">${icon("refresh")}</button></div><p class="mpp-r3-sort-note">Ordenadas por fecha de creación · más recientes primero</p><div class="mpp-r3-race-list">${raceListHtml()}</div><button class="mpp-r3-wide-create" type="button" data-mpp-action="create">${icon("plus")} CREAR UNA NUEVA CARRERA</button></section>`}
function formatDistance(m){const km=Math.max(0,Number(m)||0)/1000;return `${km.toLocaleString("es-ES",{minimumFractionDigits:1,maximumFractionDigits:1})} km`}
function formatDuration(ms){if(ms==null||!Number.isFinite(Number(ms)))return "—";const seconds=Math.round(Math.max(0,Number(ms))/1000),hours=Math.floor(seconds/3600),mins=Math.floor(seconds%3600/60),secs=seconds%60;return hours?`${hours}:${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`:`${mins}:${String(secs).padStart(2,"0")}`}
function formatProfileDate(ms){const d=new Date(Number(ms)||0);return Number(ms)>0&&!Number.isNaN(d.getTime())?new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"short",year:"numeric"}).format(d):"—"}
function runnerStatusLabel(s){return ({finished:"FINALIZÓ",incomplete:"INCOMPLETA",not_started:"NO SALIÓ"})[String(s||"").toLowerCase()]||"RESULTADO"}
function profileAvatar(user,a){const url=String(a.photoURL||user?.photoURL||"").trim();if(/^https:\/\//i.test(url))return `<img src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`;const name=String(user?.displayName||a.displayName||a.email||"M").trim(),parts=name.split(/\s+/);return esc(((parts[0]?.[0]||"")+(parts[1]?.[0]||"")).toUpperCase()||"M")}
function profileMetric(value,label){return `<article><strong>${esc(value)}</strong><small>${esc(label)}</small></article>`}
function runnerProfileSection(){
  const p=state.profile,h=p.history;
  const stateText=p.busy?"Consultando histórico deportivo…":p.historyError||"";
  if(!h)return `<div class="mpp-r4-runner-empty" role="status">${icon(p.busy?"refresh":"shield")}<div><strong>${p.busy?"Cargando estadísticas":"Estadísticas no disponibles"}</strong><p>${esc(stateText||"Aún no se han podido consultar los resultados de esta cuenta.")}</p></div></div>`;
  return `${p.historyError?`<p class="mpp-r4-inline-note" role="status">No se pudo actualizar el histórico. Se muestran los últimos datos cargados. ${esc(p.historyError)}</p>`:""}<div class="mpp-r4-kpis">${profileMetric(h.started,"PARTICIPACIONES")}${profileMetric(h.finished,"FINALIZADAS")}${profileMetric(formatDistance(h.distanceM),"DISTANCIA GPS")}${profileMetric(`${h.completion}%`,"FINALIZACIÓN")}</div>
    <div class="mpp-r4-runner-secondary">${profileMetric(h.incomplete,"INCOMPLETAS")}${profileMetric(h.discarded,"CONTROLES DESCARTADOS")}${profileMetric(formatDuration(h.penaltyMs),"PENALIZACIÓN TOTAL")}</div>
    <div class="mpp-r4-recent-head"><strong>Últimas actuaciones</strong><small>${h.recent.length} RECIENTES</small></div>
    <div class="mpp-r4-recent-list">${h.recent.length?h.recent.map(row=>`<div class="mpp-r4-recent-row"><div><strong>${esc(row.eventName)}</strong><small>${esc(formatProfileDate(row.dateMs))} · ${esc(formatDistance(row.distanceM))}</small></div><span data-result="${esc(row.status)}">${esc(runnerStatusLabel(row.status))}</span></div>`).join(""):`<p class="mpp-r3-muted">Aún no hay resultados consolidados en tu cuenta.</p>`}</div>
    ${h.limited?'<p class="mpp-r3-muted">Se muestran métricas de los últimos 200 resultados disponibles; pueden existir participaciones anteriores.</p>':""}`;
}
function profileHtml(){
  const a=state.auth||{},p=state.profile,u=p.user||{},username=String(u.usernameKey||u.username||a.username||"").replace(/^@/,"").trim();
  return `<section class="mpp-r3-page-head"><button type="button" data-mpp-action="home">${icon("back")} VOLVER AL CENTRO</button><small>PERFIL MILITOPO · UNA SOLA CUENTA</small><h1>Tu actividad, en un mismo lugar.</h1><p>Consulta tu rendimiento deportivo y tu actividad como organizador sin cambiar de cuenta.</p></section>
  <section class="mpp-r3-profile mpp-r4-profile">
    <article class="mpp-r4-identity"><button type="button" class="mpp-r4-avatar" data-mpp-action="profile-photo" aria-label="Ver o editar foto">${profileAvatar(u,a)}</button><div class="mpp-r4-identity-main"><h2>${esc(u.displayName||a.displayName||a.email||"Usuario MILITOPO")}</h2>${username?`<strong>@${esc(username)}</strong>`:""}<small>${esc(a.email||"")}</small></div><span class="mpp-r4-role">${role()==="super_admin"?"SÚPER ADMIN":"ORGANIZADOR"}</span></article>
    ${personalProfileHtml(u,a.email||"")}
    ${p.profileError?`<p class="mpp-r4-inline-note">${esc(p.profileError)}</p>`:""}
    <article class="mpp-r3-section mpp-r4-profile-card"><div class="mpp-r4-section-title"><div class="mpp-r4-section-icon">${icon("chart")}</div><div><small>COMO CORREDOR</small><h2>Mi rendimiento deportivo</h2></div></div>${runnerProfileSection()}<div class="mpp-r4-actions"><button type="button" class="mpp-r4-reload" data-mpp-action="profile-refresh">${icon("refresh")} ACTUALIZAR</button><button type="button" class="mpp-r4-secondary-action" data-mpp-action="runner-profile">VER PERFIL DE CORREDOR ${icon("arrow")}</button></div></article>
    <article class="mpp-r3-section mpp-r4-profile-card"><div class="mpp-r4-section-title"><div class="mpp-r4-section-icon is-gold">${icon("calendar")}</div><div><small>COMO ORGANIZADOR</small><h2>Mis carreras organizadas</h2></div></div>${statCards()}<p class="mpp-r3-muted">${state.rowsLoaded?`${state.rows.length} carreras propias encontradas en MILITOPO. Los estados reflejan la información de Firebase.`:state.rowsError||"Actualizando tus carreras propias desde Firebase…"}</p><button type="button" class="mpp-r4-secondary-action" data-mpp-action="races">VER MIS CARRERAS ${icon("arrow")}</button></article>
    <p class="mpp-r4-footnote">Las estadísticas deportivas proceden del histórico de la cuenta autenticada. El perfil es único y mantiene tus datos al cambiar de modo.</p>
  </section>`;
}
async function loadProfile(force=false){
  if(!canManage()||!state.opened||state.screen!=="profile")return;
  const uid=String(state.auth.uid),p=state.profile;
  if(p.busy)return;
  if(!force&&p.uid===uid&&p.loadedAt&&Date.now()-p.loadedAt<45000)return;
  const request=++state.profileRequest;
  state.profile={...p,uid,busy:true,profileError:"",historyError:""};render(true);
  try{
    const services=await globalThis.MILITOPO_V2.firebase();
    const result=await fetchOrganizerUnifiedProfile(state.auth,services);
    if(request!==state.profileRequest||String(state.auth?.uid||"")!==uid)return;
    state.profile={uid,busy:false,loadedAt:Date.now(),...result};
  }catch(error){
    if(request!==state.profileRequest||String(state.auth?.uid||"")!==uid)return;
    state.profile={uid,busy:false,loadedAt:0,user:p.uid===uid?p.user:null,history:p.uid===uid?p.history:null,profileError:"",historyError:String(error?.message||"No se pudo consultar el histórico.")};
  }
  if(state.opened&&state.screen==="profile")render(true);
}
const R5_OPERATIONS=[
  {kind:"publish",number:"01",label:"Preparar y publicar",short:"Preflight y publicación",icon:"flag",description:"Revisa el diseño y publica la carrera cuando todos los requisitos estén completos."},
  {kind:"participants",number:"02",label:"Invitar participantes",short:"Invitaciones y asignaciones",icon:"users",description:"Envía invitaciones y asigna corredores a sus recorridos sin salir del Centro."},
  {kind:"live",number:"03",label:"Seguimiento LIVE",short:"Operación en tiempo real",icon:"radio",description:"Controla la carrera durante su desarrollo con el seguimiento oficial de MILITOPO."},
  {kind:"results",number:"04",label:"Resultados",short:"Clasificaciones y cierre",icon:"chart",description:"Consulta los resultados oficiales de la carrera y la clasificación de los participantes."},
  {kind:"package",number:"05",label:"Paquete del organizador",short:"Descarga de material",icon:"download",description:"Obtén el ZIP de la carrera con planos, QR, IOF y documentación existente."}
];
function operationAllowed(kind,ctx=current()){
  const s=status(ctx.status);
  if(!ctx.eventId)return {ok:false,reason:"Selecciona una carrera de Mis carreras antes de continuar."};
  if(kind==="publish"&&isEditable(s)&&!navigator.onLine)return {ok:false,reason:"Sin conexión. Recupera Internet para revisar y publicar. Puedes seguir consultando el diseño guardado."};
  if(kind==="publish")return isEditable(s)?{ok:true,action:"open-publish",label:"ABRIR PREFLIGHT Y PUBLICACIÓN"}:{ok:false,reason:"Esta carrera ya está publicada o cerrada. No necesita volver a publicarse."};
  if(kind==="participants")return ["published","live","finished"].includes(s)?{ok:true,action:"launch-participants",label:"ABRIR INVITACIONES Y PARTICIPANTES"}:{ok:false,reason:"Las invitaciones se habilitan cuando la carrera está PUBLICADA."};
  if(kind==="live")return ["published","live","finished"].includes(s)?{ok:true,action:"launch-live",label:"ABRIR CENTRO LIVE"}:{ok:false,reason:"El seguimiento LIVE solo se habilita tras publicar la carrera."};
  if(kind==="results")return ["published","live","finished"].includes(s)?{ok:true,action:"launch-results",label:"VER RESULTADOS"}:{ok:false,reason:"Los resultados estarán disponibles cuando la carrera se publique y comience a recibir actividad."};
  if(kind==="analysis")return s==="finished"?{ok:true,action:"launch-analysis",label:"COMPARAR PARTICIPANTES"}:{ok:false,reason:"Finaliza la carrera antes de abrir el análisis comparativo. Los tracks GPS y los tiempos deben estar consolidados."};
  if(kind==="package")return {ok:Boolean(globalThis.MILITOPO_PACKAGE?.ready()),action:"download-package",label:"DESCARGAR ZIP DEL ORGANIZADOR",reason:globalThis.MILITOPO_PACKAGE?.reason()||"Publica la carrera y cierra participantes para habilitar el ZIP."};
  return {ok:false,reason:"Operación no disponible"};
}
function managementCard(row,ctx){
  if(row.kind==="package"){
    const enabled=globalThis.MILITOPO_PACKAGE?.ready(),reason=globalThis.MILITOPO_PACKAGE?.reason()||"Publica la carrera y cierra participantes para habilitar el ZIP.";
    return `<article class="mpp-manage-card mpp-package-card" data-management-kind="package"><small>PAQUETE DEL ORGANIZADOR</small><h2>ZIP COMPLETO DE LA CARRERA</h2><p>Planos PDF, QR, descripciones IOF, GPX y datos de los participantes confirmados con sus recorridos.</p><p id="mpp-reason-package" role="status">${esc(reason)}</p><button type="button" data-mpp-action="download-package" aria-describedby="mpp-reason-package" ${enabled?"":"disabled"}>${enabled?"DESCARGAR ZIP":"🔒 ZIP BLOQUEADO"}</button></article>`;
  }
  const gate=operationAllowed(row.kind,ctx),busy=row.kind==="package"&&state.packageBusy,disabled=!gate.ok||busy;
  const reason=busy?"Preparando el archivo. Espera a que termine.":gate.ok?row.description:gate.reason;
  return `<article class="mpp-manage-card" data-management-kind="${row.kind}"><div class="mpp-manage-card-title">${icon(row.icon)}<h2>${esc(row.label)}</h2></div><p id="mpp-reason-${row.kind}">${esc(reason)}</p><button type="button" data-mpp-action="${gate.action||"unavailable"}" aria-describedby="mpp-reason-${row.kind}" aria-disabled="${disabled}" ${disabled?"disabled":""}>${icon(disabled?"lock":"arrow")}<span>${busy?"Generando ZIP…":!gate.ok?"No disponible":row.kind==="publish"?"Revisar y publicar":row.kind==="package"?"Descargar ZIP":"Abrir"}</span></button></article>`;
}
function operationsHtml(){
  const ctx=current(),s=status(ctx.status),editable=Boolean(ctx.eventId&&isEditable(s));
  const rows=[...R5_OPERATIONS,{kind:"analysis",label:"Análisis",icon:"chart",description:"Compara hasta 5 corredores, reproduce sus tracks GPS y revisa los tiempos por tramo."}];
  return `<section class="mpp-management"><nav class="mpp-manage-nav" aria-label="Navegación de gestión"><button type="button" data-mpp-action="home">${icon("back")} Centro de carreras</button><button type="button" data-mpp-action="races">${icon("calendar")} Mis carreras</button></nav><header class="mpp-manage-header"><div><small>GESTIONAR CARRERA</small><h1>${esc(ctx.eventId?ctx.eventName||"Carrera":"Selecciona una carrera")}</h1>${ctx.eventId?`<p class="mpp-manage-identity"><strong>ID DE CARRERA</strong><code>${esc(ctx.eventId)}</code><small>Código de esta carrera · comprueba el ID antes de gestionar o modificar</small></p>`:""}</div><span class="mpp-r3-status" data-status="${esc(s)}">${ctx.eventId?statusLabel(s):"SIN CARRERA"}</span></header><p class="mpp-manage-connection" data-online="${navigator.onLine}" role="status" aria-live="polite">${navigator.onLine?"Conexión de red disponible. Cada herramienta comprobará el acceso a sus datos.":"Sin conexión. La publicación está bloqueada. Los datos no guardados en este dispositivo pueden no estar disponibles."}</p><div class="mpp-manage-design"><div><strong>Diseño de la carrera</strong><p>${editable?"Mapa, balizas, recorridos y reglas.":ctx.eventId?"El diseño está cerrado para proteger la carrera.":"Abre una carrera desde Mis carreras para ver sus herramientas."}</p></div><button type="button" data-mpp-action="builder" ${editable?"":"disabled"} aria-disabled="${!editable}">${icon(editable?"route":"lock")} ${editable?"Continuar diseño":"Diseño cerrado"}</button></div><div class="mpp-manage-grid">${rows.map(row=>managementCard(row,ctx)).join("")}</div></section>`;
}
// Keep legacy entry points without restoring the old numbered wizard.
function operationHtml(){return operationsHtml()}
function showPackageNotice(title,message,{busy=false,error=false}={}){document.body.classList.add("r5-package-running");document.querySelector(".mpp-r5-package-notice")?.remove();const node=document.createElement("div");node.className=`mpp-r5-package-notice ${error?"is-error":""}`;node.setAttribute("role","status");node.setAttribute("aria-live","polite");node.innerHTML=`<div class="mpp-r5-package-card"><img alt="" src="../icons/militopo-512.png"><strong>${esc(title)}</strong><p>${esc(message)}</p>${busy?'<span class="mpp-r5-spinner" aria-hidden="true"></span>':""}</div>`;document.body.appendChild(node);if(!busy)setTimeout(()=>{node.remove();if(!document.querySelector(".mpp-r5-package-notice"))document.body.classList.remove("r5-package-running")},3400)}
async function exportPackage(){return globalThis.MILITOPO_PACKAGE?.download();}

let renderedView="",renderedScreen="";
function render(preserve=false){ensure();const body=$('[data-mpp-view]',state.root),scroll=$('.mpp-home-scroll',state.root),y=scroll?.scrollTop||0;
  // La red puede responder segundos después de abrir el buscador. Nunca desmontar
  // los filtros si seguimos en "Mis carreras"; solo actualizar las tarjetas.
  if(state.screen==="races"&&body.querySelector("[data-mpp-races-head]")&&body.querySelector(".mpp-r3-race-list")){
    refreshRaceList();if(preserve&&scroll)scroll.scrollTop=y;return;
  }
  const html=state.screen==="races"?racesHtml():state.screen==="profile"?profileHtml():state.screen==="operations"?operationsHtml():state.screen==="operation"?operationHtml():homeHtml();
  if(html!==renderedView||state.screen!==renderedScreen){
    const oldPhoto=body.querySelector(".mpp-r4-avatar img");
    const template=document.createElement("template");template.innerHTML=html;
    const newPhoto=template.content.querySelector(".mpp-r4-avatar img");
    if(oldPhoto&&newPhoto&&oldPhoto.getAttribute("src")===newPhoto.getAttribute("src"))newPhoto.replaceWith(oldPhoto);
    body.replaceChildren(template.content);renderedView=html;renderedScreen=state.screen;
  }
  if(preserve&&scroll)scroll.scrollTop=y;else if(scroll)scroll.scrollTop=0;
}
function setScreen(screen){if(screen==="races"&&state.screen!=="races")state.raceLimit=10;state.screen=screen;render();if(screen==="profile"){void loadProfile();void fetchRows(false)}}
async function fetchRows(force=false){if(!canManage())return state.rows;if(state.busy)return state.rows;
  if(!navigator.onLine){render(true);message("Sin conexión: puedes continuar la carrera local que ya tengas cargada.");return state.rows}
  if(!force&&Date.now()-state.lastFetch<30000&&state.rows.length)return state.rows;
  state.busy=true;try{const ownerUid=String(state.auth.uid),{firestore}=await globalThis.MILITOPO_V2.firebase();const ref=collection(firestore,"events");const src=query(ref,where("ownerUid","==",ownerUid));const snap=await getDocs(src);const rows=[];snap.forEach(doc=>{const data=doc.data()||{};if(String(data.kind||"orientation")!=="orientation")return;rows.push({eventId:String(data.eventId||doc.id),eventName:String(data.eventName||data.name||"Carrera"),status:status(data.status),createdMs:createdAtMs(data.createdAt)})});rows.sort((a,b)=>b.createdMs-a.createdMs||a.eventName.localeCompare(b.eventName,"es")||a.eventId.localeCompare(b.eventId));if(String(state.auth?.uid||"")!==ownerUid)return state.rows;state.rows=rows;state.rowsLoaded=true;state.rowsError="";state.lastFetch=Date.now();if(state.opened)render(true);return rows}
  catch(error){console.warn("[MILITOPO R5] mis carreras",error);state.rowsError="No se pudo consultar tus carreras organizadas. Intenta actualizar cuando tengas conexión.";if(state.opened)render(true);message(state.rowsError);return state.rows}
  finally{state.busy=false}}
async function getBuilder(){for(let i=0;i<22;i++){const builder=premium.get("event-builder");if(builder?.open)return builder;await new Promise(r=>setTimeout(r,90))}return null}
async function openBuilder(fresh=false,requestedStep=null){if(!canManage())return false;const builder=await getBuilder();if(!builder){message("El asistente no está disponible. Comprueba que todos los archivos Premium están subidos.");return false}
  if(!fresh&&!current().eventId){setScreen("races");message("Primero selecciona una carrera o crea una nueva.");return false}
  const result=builder.open(fresh?{fresh:true}:{resumeCurrent:true,...(Number.isInteger(requestedStep)?{step:requestedStep}:{})});if(result===false){message("No se pudo abrir el asistente.");return false}close();return true}
async function loadRace(id,options={}){if(!canManage()||!id)return false;const api=globalThis.MILITOPO_V2_ORGANIZER_CENTER;if(!api?.recoverDirect){message("El cargador de carreras aún no está listo.");return false}
  state.pendingRecoveryId=id;message(options.reuse?"Creando una copia nueva en Firebase…":"Preparando la carrera seleccionada…");
  try{const result=await api.recoverDirect(id,options);if(result===false){state.pendingRecoveryId="";message("La selección se ha cancelado o no se ha podido cargar.");return false}return true}
  catch(error){state.pendingRecoveryId="";message(String(error?.message||"No se pudo abrir la carrera"));return false}}
async function editPersonal(photo=false){
 try{const services=await globalThis.MILITOPO_V2.firebase();const options={app:services.app,firestore:services.firestore,user:services.auth.currentUser,onSaved:async()=>{const user=services.auth.currentUser;if(!user)return;const fresh=await getDoc(doc(services.firestore,"users",user.uid));if(state.auth?.uid!==user.uid)return;state.profile.user=fresh.data()||{};if(state.opened&&state.screen==="profile")render(true);}};
 await (photo?openPersonalPhoto(options):openPersonalProfileEditor(options));
 }catch(error){message(String(error?.message||error));}
}
async function run(action){
  if(action==="profile-photo"){void editPersonal(true);return true}
  if(action==="more-races"){state.raceLimit+=10;refreshRaceList();return true}if(!canManage())return false;
  if(action==="mode-choice"){close();return globalThis.MILITOPO_ORIENTATION_MODES?.open?.()}
  if(action==="home"){setScreen("home");return true}
  if(action==="races"){setScreen("races");fetchRows(false);return true}
  if(action==="operations"){setScreen("operations");return true}
  if(action==="refresh"){fetchRows(true);return true}
  if(action==="profile"){setScreen("profile");return true}
  if(action==="profile-refresh"){void loadProfile(true);void fetchRows(true);return true}
  if(action==="runner-profile"){const url=new URL("./participante/",location.href);url.searchParams.set("militopo_tab","profile");location.assign(url.href);return true}
  if(action==="create")return openBuilder(true);
  if(action==="open-publish"){
    const gate=operationAllowed("publish");if(!gate.ok){message(gate.reason);return false}
    return openBuilder(false,8);
  }
  if(action==="download-package")return exportPackage();
  if(action==="publish"||action==="package"||["participants","live","results"].includes(action)){
    state.operationKind=action;setScreen("operation");return true;
  }
  if(["launch-participants","launch-live","launch-results","launch-analysis"].includes(action)){
    const kind=action.slice(7);const gate=operationAllowed(kind);if(!gate.ok){message(gate.reason);return false}
    const openTool=bridge()?.shell?.premiumModule;
    if(typeof openTool!=="function"){message("Esta herramienta todavía se está inicializando. Vuelve a intentarlo.");return false}
    const ok=openTool(kind);if(ok!==true){message("No se pudo abrir la herramienta seleccionada.");return false}
    close();return true;
  }
  if(action==="builder"){if(!current().eventId){setScreen("races");message("Selecciona o crea una carrera para continuar.");return false}if(!isEditable(current().status)){setScreen("operations");message("El diseño de una carrera publicada está cerrado. La edición debe respetar sus bloqueos de seguridad.");return false}return openBuilder(false)}
  return false;
}
function onClick(e){if(e.target.closest("[data-personal-edit]")){void editPersonal(false);return}const op=e.target.closest("[data-mpp-operation]");if(op){if(op.disabled)return;state.operationKind=op.dataset.mppOperation;setScreen("operation");return}const reuse=e.target.closest("[data-mpp-reuse]");if(reuse&&!reuse.disabled){loadRace(reuse.dataset.mppReuse,{reuse:true});return}const load=e.target.closest("[data-mpp-load]");if(load){loadRace(load.dataset.mppLoad);return}const button=e.target.closest("[data-mpp-action]");if(button&&!button.disabled)run(button.dataset.mppAction)}
function onInput(e){
  if(e.target.matches("[data-mpp-filter]")){state.filter=e.target.value;state.raceLimit=10;render(true);return;}
  if(e.target.matches("[data-mpp-search]")){
    // Nunca reconstruir el input al teclear: iOS Safari perdería teclado y foco.
    state.search=e.target.value;state.raceLimit=10;
    refreshRaceList();
  }
}
function open(screen){if(!canManage())return false;ensure();document.body.classList.add("mor-organizer-shell");globalThis.MILITOPO_V2_ORGANIZER_CENTER?.close?.();if(screen)state.screen=screen;render();state.root.classList.add("is-open");state.root.setAttribute("aria-hidden","false");document.body.classList.add("militopo-premium-home-open");state.opened=true;fetchRows(false);if(state.screen==="profile")void loadProfile();return true}
function close(){if(!state.root)return;state.root.classList.remove("is-open");state.root.setAttribute("aria-hidden","true");document.body.classList.remove("militopo-premium-home-open");state.opened=false}
function refresh(){if(state.opened)render(true)}
function onDraftSaved({eventId,eventName}={}){
  const id=String(eventId||"").trim(),name=String(eventName||"").trim();
  if(!id)return;
  const row=state.rows.find(item=>item.eventId===id);
  if(row&&name)row.eventName=name;
  state.lastFetch=0; // la próxima apertura consultará el nombre confirmado en Firebase.
  if(state.opened){render(true);void fetchRows(true);}
}
premium.register("organizer-home",Object.freeze({open,close,refresh,onDraftSaved,isOpen:()=>state.opened,showRaces:()=>open("races"),showOperations:(kind)=>{if(kind){state.operationKind=kind;return open("operation")}return open("operations")},showOperation:(kind)=>{state.operationKind=kind||"publish";return open("operation")}}),{version:"r5",purpose:"r5-guided-operations-workspaces-and-official-engines"});
addEventListener("militopo:v2-auth-ready",e=>{const priorUid=String(state.auth?.uid||"");state.auth=e.detail||globalThis.MILITOPO_V2_AUTH||null;if(priorUid!==String(state.auth?.uid||"")){state.profileRequest++;state.profile={uid:"",busy:false,loadedAt:0,user:null,history:null,profileError:"",historyError:""};state.rows=[];state.rowsLoaded=false;state.rowsError="";state.lastFetch=0}if(!canManage())close();else if(state.opened&&state.screen==="profile")render(true)});
addEventListener("militopo:v2-cloud-event-applied",e=>{const id=String(e.detail?.eventId||"");if(!e.detail?.ok){if(state.pendingRecoveryId)message("No se pudo recuperar la carrera; la anterior permanece guardada.");state.pendingRecoveryId="";return}
  const previousSelection=state.pendingRecoveryId;
  if(!previousSelection||!(previousSelection===id||(e.detail?.reusedAsNew===true&&previousSelection===String(e.detail.sourceEventId||"")))){refresh();return}
  state.pendingRecoveryId="";fetchRows(true);setScreen("home");
  message(e.detail?.reusedAsNew===true?`BORRADOR NUEVO CREADO: ${id}. Diseño copiado, sin participantes ni resultados.`:"Carrera cargada correctamente. Ya puedes continuar.")});
["militopo:registration-state","militopo:v2-event-status","militopo:v2-event-status-changed","militopo:r5-reuse-complete","militopo:premium-builder-p2c-complete"].forEach(ev=>addEventListener(ev,()=>setTimeout(refresh,120)));
addEventListener("offline",refresh);
addEventListener("online",()=>{if(state.notice.startsWith("Sin conexión"))message("");refresh();if(state.opened)fetchRows(true)});
if(globalThis.MILITOPO_V2_AUTH)state.auth=globalThis.MILITOPO_V2_AUTH;
