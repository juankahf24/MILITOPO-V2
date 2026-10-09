/* MILITOPO · R8B · SÚPER ADMINISTRADOR
   Administración global: usuarios/roles y supervisión avanzada de carreras.
   Frontend seguro: reutiliza setUserRole y CARGAR CARRERA; no altera Functions. */
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const EVENT_PAGE_SIZE=5;
const state={
  auth:null,overlay:null,users:[],events:[],tab:"summary",services:null,loading:false,
  userQuery:"",roleFilter:"all",eventQuery:"",eventStatusFilter:"all",eventsVisible:EVENT_PAGE_SIZE
};
const $=(s,r=document)=>r.querySelector(s);
const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const cleanRole=value=>["runner","organizer","super_admin"].includes(String(value||""))?String(value):"runner";
const roleLabel=value=>({runner:"CORREDOR",organizer:"ORGANIZADOR",super_admin:"SÚPER ADMIN"}[cleanRole(value)]||"CORREDOR");
const statusLabel=value=>({draft:"BORRADOR",prepared:"PREPARADO",published:"PUBLICADO",live:"EN DIRECTO",finished:"FINALIZADO",archived:"ARCHIVADO"}[String(value||"draft").toLowerCase()]||String(value||"BORRADOR").toUpperCase());
const tsMs=value=>{try{if(typeof value?.toMillis==="function")return value.toMillis();if(value?.seconds)return Number(value.seconds)*1000;const n=Date.parse(value);return Number.isFinite(n)?n:0}catch(_){return 0}};
const statusKeys=["draft","prepared","published","live","finished","archived"];

function toast(message){try{if(typeof globalThis.toast==="function")globalThis.toast(message);else console.info("[MILITOPO R8]",message)}catch(_){}}
function isSuperAdmin(){return cleanRole(state.auth?.role||globalThis.MILITOPO_V2_AUTH?.role)==="super_admin"}
function formatDate(value){const ms=tsMs(value);if(!ms)return "Sin fecha";try{return new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"}).format(ms)}catch(_){return new Date(ms).toLocaleString("es-ES")}}
function ensureUi(){
  if(state.overlay?.isConnected)return state.overlay;
  const overlay=document.createElement("div");overlay.id="r8AdminOverlay";overlay.className="r8-admin-overlay";overlay.innerHTML=`
    <section class="r8-admin-shell" role="dialog" aria-modal="true" aria-labelledby="r8AdminTitle">
      <header class="r8-admin-head"><div class="r8-admin-head-copy"><span>MILITOPO · CONTROL GLOBAL</span><h2 id="r8AdminTitle">SÚPER ADMINISTRADOR</h2><small>Usuarios, roles y supervisión general de carreras</small></div><button class="r8-admin-close" type="button" data-r8-close aria-label="Cerrar">✕</button></header>
      <nav class="r8-admin-tabs" role="tablist" aria-label="Administración"><button class="is-active" type="button" role="tab" data-r8-tab="summary">RESUMEN</button><button type="button" role="tab" data-r8-tab="users">USUARIOS Y ROLES</button><button type="button" role="tab" data-r8-tab="events">CARRERAS</button></nav>
      <main class="r8-admin-body">
        <div id="r8AdminStatus" class="r8-admin-status">Preparado.</div>
        <section class="r8-admin-view" data-r8-view="summary"></section>
        <section class="r8-admin-view" data-r8-view="users" hidden></section>
        <section class="r8-admin-view" data-r8-view="events" hidden></section>
      </main>
    </section>`;
  document.body.appendChild(overlay);state.overlay=overlay;
  overlay.addEventListener("click",onClick);
  overlay.addEventListener("input",onInput);
  overlay.addEventListener("change",onChange);
  return overlay;
}
function setStatus(message,error=false){const el=$("#r8AdminStatus",ensureUi());if(!el)return;el.textContent=String(message||"");el.classList.toggle("is-error",Boolean(error))}
function setTab(tab){
  state.tab=["summary","users","events"].includes(tab)?tab:"summary";
  if(state.tab==="events")state.eventsVisible=EVENT_PAGE_SIZE;
  const overlay=ensureUi();
  overlay.querySelectorAll("[data-r8-tab]").forEach(btn=>{const active=btn.dataset.r8Tab===state.tab;btn.classList.toggle("is-active",active);btn.setAttribute("aria-selected",String(active))});
  overlay.querySelectorAll("[data-r8-view]").forEach(view=>view.hidden=view.dataset.r8View!==state.tab);
  render();
}
function userRole(row){return cleanRole(row.roleMirror||row.role)}
function ownerLabel(uid){const user=state.users.find(row=>row.uid===uid);return user?String(user.displayName||user.username||user.email||uid):uid||"Sin organizador"}
function metrics(){const roles={runner:0,organizer:0,super_admin:0};state.users.forEach(row=>roles[userRole(row)]++);const live=state.events.filter(row=>String(row.status)==="live").length;return {users:state.users.length,...roles,events:state.events.length,live}}
function renderSummary(){
  const view=$("[data-r8-view='summary']",ensureUi());if(!view)return;const m=metrics();
  const recent=state.events.slice().sort((a,b)=>tsMs(b.updatedAt)-tsMs(a.updatedAt)).slice(0,6);
  view.innerHTML=`<div class="r8-admin-metrics">
    <div class="r8-admin-metric"><strong>${m.users}</strong><span>USUARIOS</span></div><div class="r8-admin-metric"><strong>${m.runner}</strong><span>CORREDORES</span></div><div class="r8-admin-metric"><strong>${m.organizer}</strong><span>ORGANIZADORES</span></div><div class="r8-admin-metric"><strong>${m.super_admin}</strong><span>SÚPER ADMIN</span></div><div class="r8-admin-metric"><strong>${m.events}</strong><span>CARRERAS</span></div><div class="r8-admin-metric"><strong>${m.live}</strong><span>EN DIRECTO</span></div>
  </div><section class="r8-admin-section"><div class="r8-admin-section-head"><div><strong>ACTIVIDAD DE CARRERAS</strong><small>Vista global de los eventos más recientes</small></div><button type="button" class="r8-admin-open-events militopo-nav-target" data-r8-open-events>VER TODAS</button></div><div class="r8-event-list">${recent.length?recent.map(eventRowHtml).join(""):'<div class="r8-admin-empty">Todavía no hay carreras.</div>'}</div></section>`;
}
function filteredUsers(){const q=state.userQuery.trim().toLowerCase();return state.users.filter(row=>{if(state.roleFilter!=="all"&&userRole(row)!==state.roleFilter)return false;if(!q)return true;return [row.displayName,row.username,row.usernameKey,row.email,row.uid].some(value=>String(value||"").toLowerCase().includes(q))})}
function userRowHtml(row){
  const role=userRole(row),self=row.uid===state.auth?.uid,verified=row.emailVerified===true;const username=String(row.usernameKey||row.username||"").replace(/^@/,"");
  return `<div class="r8-user-row" data-r8-user-row="${esc(row.uid)}"><div class="r8-user-id"><strong>${esc(row.displayName||row.email||"Usuario")}${self?' <span class="r8-self">· TÚ</span>':""}</strong>${username?`<span>@${esc(username)}</span>`:""}<small>${esc(row.email||row.uid)}</small><b class="${verified?"":"is-unverified"}">${verified?"CORREO VERIFICADO":"CORREO NO VERIFICADO"}</b></div><div class="r8-user-actions"><select class="r8-user-role" data-r8-role ${self?'disabled title="Tu propio rol no se cambia desde este panel"':""}><option value="runner" ${role==="runner"?"selected":""}>CORREDOR</option><option value="organizer" ${role==="organizer"?"selected":""}>ORGANIZADOR</option><option value="super_admin" ${role==="super_admin"?"selected":""}>SÚPER ADMIN</option></select><button type="button" class="r8-user-apply" data-r8-apply-role ${self?"disabled":""}>APLICAR</button></div><span class="r8-event-status">${roleLabel(role)}</span></div>`;
}
function renderUsers(){
  const view=$("[data-r8-view='users']",ensureUi());if(!view)return;const rows=filteredUsers();
  view.innerHTML=`<div class="r8-admin-toolbar r8-user-toolbar"><input type="search" value="${esc(state.userQuery)}" data-r8-user-search placeholder="Buscar nombre, @usuario, correo o UID" aria-label="Buscar usuarios"><select data-r8-role-filter aria-label="Filtrar usuarios por rol"><option value="all" ${state.roleFilter==="all"?"selected":""}>TODOS LOS ROLES</option><option value="runner" ${state.roleFilter==="runner"?"selected":""}>CORREDORES</option><option value="organizer" ${state.roleFilter==="organizer"?"selected":""}>ORGANIZADORES</option><option value="super_admin" ${state.roleFilter==="super_admin"?"selected":""}>SÚPER ADMIN</option></select><button type="button" class="r8-admin-refresh" data-r8-refresh>ACTUALIZAR</button></div><div class="r8-user-list">${rows.length?rows.map(userRowHtml).join(""):'<div class="r8-admin-empty">No hay usuarios que coincidan con el filtro.</div>'}</div>`;
}
function eventRowHtml(row){
  const participantCount=Math.max(0,Math.trunc(Number(row.participantCount)||0));
  const controlCount=Math.max(0,Math.trunc(Number(row.controlCount)||0));
  const routeCount=Math.max(0,Math.trunc(Number(row.courseSyncedCount)||0));
  const metrics=[participantCount?`${participantCount} plazas`:"",controlCount?`${controlCount} balizas`:"",routeCount?`${routeCount} recorridos`:""].filter(Boolean).join(" · ");
  return `<div class="r8-event-row"><div class="r8-event-copy"><strong>${esc(row.eventName||row.name||row.eventId||"Carrera")}</strong><span>${esc(row.eventId||"")}</span><small><b>ORGANIZADOR</b> · ${esc(ownerLabel(String(row.ownerUid||"")))}</small>${metrics?`<small>${esc(metrics)}</small>`:""}<small>Actualizada · ${esc(formatDate(row.updatedAt||row.createdAt))}</small></div><b class="r8-event-status" data-status="${esc(String(row.status||"draft"))}">${esc(statusLabel(row.status))}</b></div>`;
}
function eventCounts(rows=state.events){const counts=Object.fromEntries(statusKeys.map(key=>[key,0]));rows.forEach(row=>{const key=String(row.status||"draft");if(key in counts)counts[key]++});return counts}
function filteredEvents(){
  const q=state.eventQuery.trim().toLowerCase();
  return state.events.slice().filter(row=>{
    if(state.eventStatusFilter!=="all"&&String(row.status||"draft")!==state.eventStatusFilter)return false;
    if(!q)return true;
    const owner=ownerLabel(String(row.ownerUid||""));
    return [row.eventName,row.name,row.eventId,owner,row.ownerUid,statusLabel(row.status)].some(value=>String(value||"").toLowerCase().includes(q));
  }).sort((a,b)=>tsMs(b.updatedAt)-tsMs(a.updatedAt));
}
function renderEventSummary(){
  const counts=eventCounts();const closed=(counts.finished||0)+(counts.archived||0);
  return `<div class="r8-event-summary">
    <button type="button" data-r8-event-chip="all" class="${state.eventStatusFilter==="all"?"is-active":""}"><strong>${state.events.length}</strong><span>TOTAL</span></button>
    <button type="button" data-r8-event-chip="draft" class="${state.eventStatusFilter==="draft"?"is-active":""}"><strong>${counts.draft||0}</strong><span>BORRADOR</span></button>
    <button type="button" data-r8-event-chip="prepared" class="${state.eventStatusFilter==="prepared"?"is-active":""}"><strong>${counts.prepared||0}</strong><span>PREPARADO</span></button>
    <button type="button" data-r8-event-chip="published" class="${state.eventStatusFilter==="published"?"is-active":""}"><strong>${counts.published||0}</strong><span>PUBLICADO</span></button>
    <button type="button" data-r8-event-chip="live" class="${state.eventStatusFilter==="live"?"is-active":""}"><strong>${counts.live||0}</strong><span>EN DIRECTO</span></button>
    <button type="button" data-r8-event-chip="closed" class="${["closed","finished","archived"].includes(state.eventStatusFilter)?"is-active":""}"><strong>${closed}</strong><span>CERRADAS</span></button>
  </div>`;
}
function renderEvents(){
  const view=$("[data-r8-view='events']",ensureUi());if(!view)return;
  let rows=filteredEvents();
  if(state.eventStatusFilter==="closed")rows=state.events.slice().filter(row=>["finished","archived"].includes(String(row.status||""))).filter(row=>{const q=state.eventQuery.trim().toLowerCase();if(!q)return true;return [row.eventName,row.name,row.eventId,ownerLabel(String(row.ownerUid||"")),row.ownerUid].some(value=>String(value||"").toLowerCase().includes(q))}).sort((a,b)=>tsMs(b.updatedAt)-tsMs(a.updatedAt));
  const visible=rows.slice(0,state.eventsVisible);const remaining=Math.max(0,rows.length-visible.length);
  const statusOptions=[["all","TODOS LOS ESTADOS"],["draft","BORRADOR"],["prepared","PREPARADO"],["published","PUBLICADO"],["live","EN DIRECTO"],["closed","CERRADAS"],["finished","FINALIZADO"],["archived","ARCHIVADO"]];
  view.innerHTML=`${renderEventSummary()}<div class="r8-admin-toolbar r8-events-toolbar"><input type="search" value="${esc(state.eventQuery)}" data-r8-event-search placeholder="Buscar carrera, ID u organizador" aria-label="Buscar carreras"><select data-r8-event-status aria-label="Filtrar carreras por estado">${statusOptions.map(([key,label])=>`<option value="${key}" ${state.eventStatusFilter===key?"selected":""}>${label}</option>`).join("")}</select><button type="button" class="r8-admin-refresh" data-r8-refresh>ACTUALIZAR</button></div><section class="r8-admin-section"><div class="r8-admin-section-head"><div><strong>SUPERVISIÓN GLOBAL</strong><small>${rows.length===state.events.length?`${rows.length} carreras accesibles como súper administrador`:`${rows.length} de ${state.events.length} carreras coinciden con el filtro`}</small></div><button type="button" class="r8-admin-open-events militopo-nav-target" data-r8-open-organizer-center>ABRIR CARGAR CARRERA</button></div><div class="r8-event-list">${visible.length?visible.map(eventRowHtml).join(""):'<div class="r8-admin-empty">No hay carreras que coincidan con la búsqueda o el filtro.</div>'}</div>${remaining?`<div class="r8-load-more-wrap"><button type="button" class="r8-load-more" data-r8-load-more><span>CARGAR MÁS</span><small>${Math.min(EVENT_PAGE_SIZE,remaining)} de ${remaining} restantes</small></button></div>`:""}</section>`;
}
function render(){if(!state.overlay)return;if(state.tab==="summary")renderSummary();else if(state.tab==="users")renderUsers();else renderEvents()}
async function services(){if(state.services)return state.services;if(!globalThis.MILITOPO_V2?.firebase)throw new Error("Backend de MILITOPO no disponible.");state.services=await globalThis.MILITOPO_V2.firebase();return state.services}
async function refresh(){
  if(state.loading)return;if(!isSuperAdmin()){setStatus("Acceso reservado a SÚPER ADMINISTRADOR.",true);return}
  state.loading=true;setStatus("Actualizando usuarios y carreras…");
  try{
    const svc=await services();const [usersSnap,eventsSnap]=await Promise.all([getDocs(collection(svc.firestore,"users")),getDocs(collection(svc.firestore,"events"))]);
    state.users=[];usersSnap.forEach(doc=>state.users.push({uid:doc.id,...(doc.data()||{})}));
    state.events=[];eventsSnap.forEach(doc=>{const data=doc.data()||{};if(String(data.kind||"orientation")!=="orientation")return;state.events.push({eventId:doc.id,...data})});
    state.users.sort((a,b)=>String(a.displayName||a.email||a.uid).localeCompare(String(b.displayName||b.email||b.uid),"es"));
    setStatus(`Actualizado · ${state.users.length} usuarios · ${state.events.length} carreras`);render();
  }catch(error){console.error("[MILITOPO R8]",error);setStatus(`No se pudo cargar administración: ${String(error?.message||error)}`,true)}finally{state.loading=false}
}
async function applyRole(button){
  const row=button.closest("[data-r8-user-row]");if(!row)return;const uid=row.dataset.r8UserRow,select=$("[data-r8-role]",row),role=cleanRole(select?.value);const user=state.users.find(item=>item.uid===uid);if(!user||uid===state.auth?.uid)return;
  const name=user.displayName||user.email||uid;const question=`Cambiar el rol de ${name} a ${roleLabel(role)}.\n\nEste cambio modifica sus permisos de MILITOPO.`;let accepted=true;
  if(typeof globalThis.MILITOPO_CONFIRM==="function")accepted=await globalThis.MILITOPO_CONFIRM(question,{title:"CAMBIAR ROL",confirmText:"APLICAR ROL"});else accepted=window.confirm(question);if(!accepted)return;
  button.disabled=true;setStatus(`Aplicando rol ${roleLabel(role)}…`);
  try{const svc=await services();await svc.callable("setUserRole",{uid,role});user.roleMirror=role;setStatus(`Rol actualizado: ${name} · ${roleLabel(role)}`);render()}catch(error){console.error("[MILITOPO R8 role]",error);setStatus(`No se pudo cambiar el rol: ${String(error?.message||error)}`,true);button.disabled=false}
}
function openOrganizerCenter(){close();setTimeout(()=>{if(globalThis.MILITOPO_V2_ORGANIZER_CENTER?.open)globalThis.MILITOPO_V2_ORGANIZER_CENTER.open();else toast("CARGAR CARRERA todavía se está iniciando.")},60)}
function onClick(event){
  if(event.target===state.overlay||event.target.closest("[data-r8-close]")){close();return}
  const tab=event.target.closest("[data-r8-tab]");if(tab){setTab(tab.dataset.r8Tab);return}
  if(event.target.closest("[data-r8-refresh]")){refresh();return}
  const apply=event.target.closest("[data-r8-apply-role]");if(apply){applyRole(apply);return}
  if(event.target.closest("[data-r8-open-events]")){setTab("events");return}
  if(event.target.closest("[data-r8-open-organizer-center]")){openOrganizerCenter();return}
  const chip=event.target.closest("[data-r8-event-chip]");if(chip){const key=chip.dataset.r8EventChip;state.eventStatusFilter=key==="closed"?"closed":key;state.eventsVisible=EVENT_PAGE_SIZE;renderEvents();return}
  if(event.target.closest("[data-r8-load-more]")){state.eventsVisible+=EVENT_PAGE_SIZE;renderEvents();return}
}
function onInput(event){
  if(event.target.matches("[data-r8-user-search]")){state.userQuery=event.target.value;renderUsers();const next=$("[data-r8-user-search]",state.overlay);if(next){next.focus();try{next.setSelectionRange(state.userQuery.length,state.userQuery.length)}catch(_){}}return}
  if(event.target.matches("[data-r8-event-search]")){state.eventQuery=event.target.value;state.eventsVisible=EVENT_PAGE_SIZE;renderEvents();const next=$("[data-r8-event-search]",state.overlay);if(next){next.focus();try{next.setSelectionRange(state.eventQuery.length,state.eventQuery.length)}catch(_){}}}
}
function onChange(event){
  if(event.target.matches("[data-r8-role-filter]")){state.roleFilter=event.target.value;renderUsers();return}
  if(event.target.matches("[data-r8-event-status]")){state.eventStatusFilter=event.target.value||"all";state.eventsVisible=EVENT_PAGE_SIZE;renderEvents()}
}
function open(){state.auth=globalThis.MILITOPO_V2_AUTH||state.auth;if(!isSuperAdmin()){toast("Esta zona requiere SÚPER ADMINISTRADOR.");return false}const overlay=ensureUi();overlay.classList.add("is-open");document.body.style.overflow="hidden";setTab(state.tab||"summary");refresh();return true}
function close(){if(!state.overlay)return;state.overlay.classList.remove("is-open");document.body.style.overflow=""}
function onAuth(detail){state.auth=detail||null;if(!isSuperAdmin())close()}

globalThis.MILITOPO_R8_SUPER_ADMIN=Object.freeze({open,close,refresh});
globalThis.addEventListener("militopo:r8-open-admin",open);
globalThis.addEventListener("militopo:v2-auth-ready",event=>onAuth(event.detail));
if(globalThis.MILITOPO_V2_AUTH)onAuth(globalThis.MILITOPO_V2_AUTH);
