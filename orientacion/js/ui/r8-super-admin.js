/* MILITOPO · R8I · SÚPER ADMINISTRADOR
   Administración global: usuarios/roles, fichas profesionales y supervisión de carreras.
   R8I compacta la ficha seleccionada en una pantalla fija sin scroll e integra foto de perfil. */
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const EVENT_PAGE_SIZE=5;
const USER_PAGE_SIZE=10;
const state={
  auth:null,overlay:null,users:[],events:[],tab:"summary",services:null,loading:false,
  userQuery:"",roleFilter:"all",usersVisible:USER_PAGE_SIZE,
  eventQuery:"",eventStatusFilter:"all",eventsVisible:EVENT_PAGE_SIZE,selectedEventId:"",
  selectedUserId:"",userDetail:null,userDetailLoading:false,userDetailError:"",usersScrollTop:0
};
const $=(s,r=document)=>r.querySelector(s);
const esc=value=>String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
const searchKey=value=>String(value??"").toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const cleanRole=value=>["runner","organizer","super_admin"].includes(String(value||""))?String(value):"runner";
const roleLabel=value=>({runner:"CORREDOR",organizer:"ORGANIZADOR",super_admin:"SÚPER ADMIN"}[cleanRole(value)]||"CORREDOR");
const statusLabel=value=>({draft:"BORRADOR",prepared:"PREPARADO",published:"PUBLICADO",live:"EN DIRECTO",finished:"FINALIZADO",archived:"ARCHIVADO"}[String(value||"draft").toLowerCase()]||String(value||"BORRADOR").toUpperCase());
const resultStatusLabel=value=>({finished:"FINALIZADA",incomplete:"INCOMPLETA",not_started:"NO SALIÓ"}[String(value||"not_started").toLowerCase()]||String(value||"—").toUpperCase());
const tsMs=value=>{try{if(Number.isFinite(Number(value))&&Number(value)>0)return Number(value);if(typeof value?.toMillis==="function")return value.toMillis();if(value?.seconds)return Number(value.seconds)*1000;const n=Date.parse(value);return Number.isFinite(n)?n:0}catch(_){return 0}};
const statusKeys=["draft","prepared","published","live","finished","archived"];

function toast(message){try{if(typeof globalThis.toast==="function")globalThis.toast(message);else console.info("[MILITOPO R8]",message)}catch(_){}}
function isSuperAdmin(){return cleanRole(state.auth?.role||globalThis.MILITOPO_V2_AUTH?.role)==="super_admin"}
function formatDate(value){const ms=tsMs(value);if(!ms)return "Sin fecha";try{return new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"}).format(ms)}catch(_){return new Date(ms).toLocaleString("es-ES")}}
function formatDateOnly(value){const ms=tsMs(value);if(!ms)return "—";try{return new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"2-digit",year:"numeric"}).format(ms)}catch(_){return new Date(ms).toLocaleDateString("es-ES")}}
function formatKm(meters){const km=Math.max(0,Number(meters||0))/1000;return `${km.toLocaleString("es-ES",{minimumFractionDigits:km>=100?0:1,maximumFractionDigits:1})} km`}
function formatPenalty(ms){const total=Math.max(0,Math.round(Number(ms||0)/60000));const h=Math.floor(total/60),m=total%60;return h?`+${h} h ${String(m).padStart(2,"0")} min`:`+${m} min`}
function icon(name,cls=""){
  const paths={
    user:'<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>',
    eye:'<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.5"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    alert:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/>',
    shield:'<path d="M12 3 4.5 6v5.5c0 4.4 3.1 7.5 7.5 9.5 4.4-2 7.5-5.1 7.5-9.5V6L12 3Z"/>',
    mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    refresh:'<path d="M20 6v5h-5M4 18v-5h5"/><path d="M18 9a7 7 0 0 0-12-2L4 11M6 15a7 7 0 0 0 12 2l2-4"/>',
    flag:'<path d="M5 21V4m0 1h10l-2 3 2 3H5"/>',
    trophy:'<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6"/>',
    route:'<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h3a3 3 0 0 0 3-3v-6a3 3 0 0 1 3-3h-1"/>',
    mountain:'<path d="m3 19 6-10 4 6 2-3 6 7H3Z"/><path d="m8 11 2 2 2-2"/>',
    target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    discard:'<circle cx="12" cy="12" r="9"/><path d="m8 8 8 8M16 8l-8 8"/>',
    penalty:'<path d="M13 2 5 14h6l-1 8 9-13h-6V2Z"/>',
    race:'<path d="M4 20V5m0 1h11l-2 3 2 3H4"/><path d="M18 13v7M15 20h6"/>',
    lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    activity:'<path d="M3 12h4l2-5 4 10 2-5h6"/>',
    back:'<path d="m15 18-6-6 6-6"/><path d="M9 12h11"/>'
  };
  return `<svg class="r8-icon r8-icon-${esc(name)} ${esc(cls)}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name]||paths.activity}</svg>`;
}
function detailMetric(iconName,value,label,sub=""){
  return `<div class="r8-visual-metric"><span class="r8-visual-metric-icon">${icon(iconName)}</span><div><strong>${esc(value)}</strong><span>${esc(label)}</span>${sub?`<small>${esc(sub)}</small>`:""}</div></div>`;
}
function detailPill(iconName,value,label,kind=""){
  return `<div class="r8-detail-pill ${esc(kind)}"><span>${icon(iconName)}</span><div><strong>${esc(value)}</strong><small>${esc(label)}</small></div></div>`;
}
function profilePhoto(photoURL,role,className=""){
  const url=String(photoURL||"").trim();
  return `<span class="r8-user-profile-photo ${esc(className)}" data-role="${esc(role)}">${url?`<img src="${esc(url)}" alt="" loading="lazy" referrerpolicy="no-referrer">`:icon("user")}</span>`;
}
function ensureUi(){
  if(state.overlay?.isConnected)return state.overlay;
  const overlay=document.createElement("div");overlay.id="r8AdminOverlay";overlay.className="r8-admin-overlay";overlay.innerHTML=`
    <section class="r8-admin-shell" role="dialog" aria-modal="true" aria-labelledby="r8AdminTitle">
      <header class="r8-admin-head"><div class="r8-admin-head-copy"><span>MILITOPO · CONTROL GLOBAL</span><h2 id="r8AdminTitle">SÚPER ADMINISTRADOR</h2><small>Usuarios, roles y supervisión general de carreras</small></div><button class="r8-admin-close" type="button" data-r8-close aria-label="Cerrar">✕</button></header>
      <nav class="r8-admin-tabs" role="tablist" aria-label="Administración"><button class="is-active" type="button" role="tab" data-r8-tab="summary">RESUMEN</button><button type="button" role="tab" data-r8-tab="events">CARRERAS</button><button type="button" role="tab" data-r8-tab="users">USUARIOS Y ROLES</button></nav>
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
  if(state.tab==="users")state.usersVisible=USER_PAGE_SIZE;
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
  const counts=eventCounts();const closed=(counts.finished||0)+(counts.archived||0);
  const recent=state.events.slice().sort((a,b)=>tsMs(b.updatedAt)-tsMs(a.updatedAt)).slice(0,5);
  view.innerHTML=`<div class="r8-admin-metrics">
    <div class="r8-admin-metric"><strong>${m.users}</strong><span>USUARIOS</span></div><div class="r8-admin-metric"><strong>${m.runner}</strong><span>CORREDORES</span></div><div class="r8-admin-metric"><strong>${m.organizer}</strong><span>ORGANIZADORES</span></div><div class="r8-admin-metric"><strong>${m.super_admin}</strong><span>SÚPER ADMIN</span></div><div class="r8-admin-metric"><strong>${m.events}</strong><span>CARRERAS</span></div><div class="r8-admin-metric"><strong>${m.live}</strong><span>EN DIRECTO</span></div>
  </div>
  <section class="r8-admin-section r8-ops-section"><div class="r8-admin-section-head"><div><strong>ESTADO OPERATIVO</strong><small>Pulsa un estado para ir directamente a las carreras correspondientes</small></div></div><div class="r8-ops-grid">
    <button type="button" class="militopo-nav-target" data-r8-summary-filter="live"><strong>${counts.live||0}</strong><span>EN DIRECTO</span><small>Seguimiento activo</small></button>
    <button type="button" class="militopo-nav-target" data-r8-summary-filter="published"><strong>${counts.published||0}</strong><span>PUBLICADAS</span><small>Listas para competir</small></button>
    <button type="button" class="militopo-nav-target" data-r8-summary-filter="prepared"><strong>${counts.prepared||0}</strong><span>PREPARADAS</span><small>Pendientes de publicar</small></button>
    <button type="button" class="militopo-nav-target" data-r8-summary-filter="draft"><strong>${counts.draft||0}</strong><span>BORRADORES</span><small>En preparación</small></button>
    <button type="button" class="militopo-nav-target" data-r8-summary-filter="closed"><strong>${closed}</strong><span>CERRADAS</span><small>Finalizadas / archivadas</small></button>
  </div></section>
  <section class="r8-admin-section"><div class="r8-admin-section-head"><div><strong>ACTIVIDAD DE CARRERAS</strong><small>Las 5 carreras actualizadas más recientemente</small></div><button type="button" class="r8-admin-open-events militopo-nav-target" data-r8-open-events>VER TODAS</button></div><div class="r8-event-list">${recent.length?recent.map(eventRowHtml).join(""):'<div class="r8-admin-empty">Todavía no hay carreras.</div>'}</div></section>`;
}
function filteredUsers(){const q=searchKey(state.userQuery.trim());return state.users.filter(row=>{if(state.roleFilter!=="all"&&userRole(row)!==state.roleFilter)return false;if(!q)return true;return [row.displayName,row.username,row.usernameKey,row.email].some(value=>searchKey(value).includes(q))})}
function userRoleCounts(){const counts={runner:0,organizer:0,super_admin:0};state.users.forEach(row=>counts[userRole(row)]++);return counts}
function renderUserSummary(){
  const counts=userRoleCounts();
  const chips=[["all","TOTAL",state.users.length],["runner","CORREDORES",counts.runner],["organizer","ORGANIZADORES",counts.organizer],["super_admin","SÚPER ADMIN",counts.super_admin]];
  return `<div class="r8-user-summary">${chips.map(([key,label,count])=>`<button type="button" data-r8-user-chip="${key}" class="${state.roleFilter===key?"is-active":""}"><strong>${count}</strong><span>${label}</span></button>`).join("")}</div>`;
}
function userRowHtml(row){
  const role=userRole(row),self=row.uid===state.auth?.uid,verified=row.emailVerified===true;
  const username=String(row.usernameKey||row.username||"").replace(/^@/,"");
  const display=String(row.displayName||username||row.email||"Usuario");
  const secondary=username?`@${username}`:String(row.email||"");
  return `<article class="r8-user-row r8-user-row-compact" data-r8-user-row="${esc(row.uid)}">
    <div class="r8-user-compact-id">${profilePhoto(row.photoURL,role,"r8-user-avatar")}<div><strong>${esc(display)}${self?' <span class="r8-self">· TÚ</span>':""}</strong>${secondary?`<span>${esc(secondary)}</span>`:""}</div></div>
    <div class="r8-user-compact-actions">
      <span class="r8-mail-state ${verified?"is-ok":"is-pending"}" title="${verified?"Correo verificado":"Correo pendiente de verificar"}" aria-label="${verified?"Correo verificado":"Correo no verificado"}">${icon(verified?"check":"alert")}</span>
      <select class="r8-user-role r8-user-role-compact" data-r8-role ${self?'disabled title="Tu propio rol no se cambia desde este panel"':""} aria-label="Rol de ${esc(display)}"><option value="runner" ${role==="runner"?"selected":""}>CORREDOR</option><option value="organizer" ${role==="organizer"?"selected":""}>ORGANIZADOR</option><option value="super_admin" ${role==="super_admin"?"selected":""}>SÚPER ADMIN</option></select>
      ${self?"":`<button type="button" class="r8-user-apply r8-user-apply-icon" data-r8-apply-role title="Aplicar cambio de rol" aria-label="Aplicar cambio de rol">${icon("check")}</button>`}
      <button type="button" class="r8-user-view" data-r8-user-view="${esc(row.uid)}">${icon("eye")}<span>VER</span></button>
    </div>
  </article>`;
}
function renderUserDetail(){
  if(!state.selectedUserId)return "";
  const row=state.users.find(item=>item.uid===state.selectedUserId);if(!row)return "";
  const username=String(row.usernameKey||row.username||"").replace(/^@/,"");
  const role=userRole(row);
  const display=String(row.displayName||row.email||"Usuario");
  const headPhoto=profilePhoto(row.photoURL,role,"");
  const profileHead=`<header class="r8-user-profile-head"><div class="r8-user-profile-head-inner"><button type="button" class="r8-user-profile-back" data-r8-close-user-detail aria-label="Volver a usuarios">${icon("back")}<span>VOLVER</span></button><div class="r8-user-profile-title">${headPhoto}<div><small>PERFIL DE USUARIO</small><strong>${esc(display)}</strong><span>${username?`@${esc(username)} · `:""}${esc(roleLabel(role))}</span></div></div></div></header>`;
  if(state.userDetailLoading)return `<section class="r8-user-profile-full" data-r8-user-detail-card>${profileHead}<main class="r8-user-profile-main"><div class="r8-user-profile-content"><div class="r8-user-detail-loading r8-user-profile-state">${icon("activity")}<span>Cargando actividad MILITOPO…</span></div></div></main></section>`;
  if(state.userDetailError)return `<section class="r8-user-profile-full" data-r8-user-detail-card>${profileHead}<main class="r8-user-profile-main"><div class="r8-user-profile-content"><div class="r8-user-detail-error r8-user-profile-state">${icon("alert")}<span>${esc(state.userDetailError)}</span></div></div></main></section>`;
  const d=state.userDetail;if(!d)return "";
  const account=d.account||{},profile=d.profile||{},runner=d.runner||{},organizer=d.organizer||{};
  const verified=account.emailVerified===true,active=!account.disabled;
  const completion=runner.started?`${Math.round((Number(runner.finished||0)/Math.max(1,Number(runner.started||0)))*100)}%`:"";
  const organizerVisible=Number(organizer.total||0)>0||["organizer","super_admin"].includes(role);
  const createdMs=tsMs(account.creationTimeMs||profile.createdAtMs),lastSignInMs=tsMs(account.lastSignInTimeMs),updatedMs=tsMs(profile.updatedAtMs);
  const dates=[];
  if(createdMs)dates.push(detailPill("calendar",formatDateOnly(createdMs),"REGISTRO"));
  if(lastSignInMs)dates.push(detailPill("clock",formatDate(lastSignInMs),"ÚLTIMO ACCESO"));
  if(updatedMs)dates.push(detailPill("refresh",formatDate(updatedMs),"PERFIL ACTUALIZADO"));
  const runnerMetrics=[
    detailMetric("race",Number(runner.participations||0),"PARTICIPACIONES"),
    detailMetric("trophy",Number(runner.finished||0),"FINALIZADAS"),
    detailMetric("route",formatKm(runner.trackDistanceM),"KM RECORRIDOS","GPS acumulado"),
    detailMetric("mountain",`${Math.round(Number(runner.positiveM||0)).toLocaleString("es-ES")} m`,"DESNIVEL +","Ascenso acumulado"),
    detailMetric("target",Number(runner.controlDetectedCount||0),"CONTROLES"),
    detailMetric("discard",Number(runner.discardedControlCount||0),"DESCARTES")
  ].join("");
  const runnerPills=[
    Number(runner.started||0)>0?detailPill("flag",Number(runner.started||0),"INICIADAS"):"",
    Number(runner.incomplete||0)>0?detailPill("activity",Number(runner.incomplete||0),"INCOMPLETAS","is-warn"):"",
    Number(runner.notStarted||0)>0?detailPill("alert",Number(runner.notStarted||0),"NO SALIÓ","is-muted"):"",
    completion?detailPill("trophy",completion,"FINALIZACIÓN","is-good"):"",
    Number(runner.penaltyMs||0)>0?detailPill("penalty",formatPenalty(runner.penaltyMs),"PENALIZACIÓN","is-warn"):""
  ].filter(Boolean).join("");
  const hasRunnerActivity=Number(runner.participations||0)>0||Number(runner.trackDistanceM||0)>0;
  const organizerMetrics=organizerVisible?[
    detailMetric("race",Number(organizer.total||0),"CARRERAS"),
    detailMetric("activity",Number(organizer.live||0),"EN DIRECTO"),
    detailMetric("flag",Number(organizer.published||0),"PUBLICADAS"),
    detailMetric("target",Number(organizer.prepared||0),"PREPARADAS"),
    detailMetric("refresh",Number(organizer.draft||0),"BORRADORES"),
    detailMetric("check",Number(organizer.finished||0)+Number(organizer.archived||0),"CERRADAS")
  ].join(""):"";
  const lastRaceDate=tsMs(runner.lastRace?.atMs);
  const photoURL=profile.photoURL||row.photoURL||account.photoURL||"";
  return `<section class="r8-user-profile-full" data-r8-user-detail-card>${profileHead}<main class="r8-user-profile-main"><div class="r8-user-profile-content">
    <section class="r8-user-profile-hero"><div class="r8-user-profile-identity">${profilePhoto(photoURL,role,"r8-user-profile-photo-large")}<div><small>USUARIO SELECCIONADO</small><h3>${esc(display)}</h3><p>${username?`@${esc(username)}`:"Sin nombre de usuario"}</p></div></div><div class="r8-user-profile-badges"><span class="r8-profile-role">${icon("shield")} ${esc(roleLabel(account.role||role))}</span><span class="r8-profile-status ${active?"is-active":"is-disabled"}">${icon(active?"shield":"lock")} ${active?"ACTIVA":"BLOQUEADA"}</span></div></section>
    <section class="r8-user-detail r8-user-detail-visual r8-user-detail-fullscreen">
      <div class="r8-user-account-strip r8-user-account-strip-single"><div class="r8-account-email">${icon("mail")}<div><small>CORREO</small><strong>${esc(account.email||row.email||"Sin correo")}</strong></div><span class="r8-mail-state ${verified?"is-ok":"is-pending"}" title="${verified?"Correo verificado":"Correo pendiente de verificar"}">${icon(verified?"check":"alert")}</span></div></div>
      ${dates.length?`<div class="r8-detail-pills r8-date-pills">${dates.join("")}</div>`:""}
      <div class="r8-user-activity-layout ${organizerVisible?"has-organizer":""}">
        <div class="r8-user-detail-section"><div class="r8-user-detail-label"><strong>ACTIVIDAD COMO CORREDOR</strong><small>Acumulado MILITOPO</small></div>${hasRunnerActivity?`<div class="r8-visual-metrics">${runnerMetrics}</div>${runnerPills?`<div class="r8-detail-pills r8-runner-pills">${runnerPills}</div>`:""}${runner.lastRace?.eventName?`<div class="r8-user-last-race r8-user-last-race-visual"><span class="r8-last-race-icon">${icon("flag")}</span><div><b>ÚLTIMA PARTICIPACIÓN</b><strong>${esc(runner.lastRace.eventName)}</strong><small>${esc(resultStatusLabel(runner.lastRace.status))}${lastRaceDate?` · ${esc(formatDate(lastRaceDate))}`:""}</small></div></div>`:""}`:`<div class="r8-user-empty-visual">${icon("route")}<div><strong>SIN PARTICIPACIONES</strong><span>Todavía no hay actividad como corredor.</span></div></div>`}</div>
        ${organizerVisible?`<div class="r8-user-detail-section r8-organizer-activity"><div class="r8-user-detail-label"><strong>ACTIVIDAD COMO ORGANIZADOR</strong><small>Carreras creadas</small></div><div class="r8-visual-metrics">${organizerMetrics}</div></div>`:""}
      </div>
    </section>
  </div></main></section>`;
}

function renderUsers(){
  const view=$("[data-r8-view='users']",ensureUi());if(!view)return;
  const rows=filteredUsers(),visible=rows.slice(0,state.usersVisible),remaining=Math.max(0,rows.length-visible.length);
  view.innerHTML=`${renderUserSummary()}<div class="r8-admin-toolbar r8-user-toolbar"><input type="search" value="${esc(state.userQuery)}" data-r8-user-search placeholder="Buscar nombre, @usuario o correo" aria-label="Buscar usuarios"><select data-r8-role-filter aria-label="Filtrar usuarios por rol"><option value="all" ${state.roleFilter==="all"?"selected":""}>TODOS LOS ROLES</option><option value="runner" ${state.roleFilter==="runner"?"selected":""}>CORREDORES</option><option value="organizer" ${state.roleFilter==="organizer"?"selected":""}>ORGANIZADORES</option><option value="super_admin" ${state.roleFilter==="super_admin"?"selected":""}>SÚPER ADMIN</option></select></div><div class="r8-user-list">${visible.length?visible.map(userRowHtml).join(""):'<div class="r8-admin-empty">No hay usuarios que coincidan con el filtro.</div>'}</div>${remaining?`<div class="r8-load-more-wrap"><button type="button" class="r8-load-more" data-r8-user-load-more><span>CARGAR MÁS USUARIOS</span><small>${Math.min(USER_PAGE_SIZE,remaining)} de ${remaining} restantes</small></button></div>`:""}${renderUserDetail()}`;
}
function eventRowHtml(row){
  const participantCount=Math.max(0,Math.trunc(Number(row.participantCount)||0));
  const controlCount=Math.max(0,Math.trunc(Number(row.controlCount)||0));
  const routeCount=Math.max(0,Math.trunc(Number(row.courseSyncedCount)||0));
  const metrics=[participantCount?`${participantCount} plazas`:"",controlCount?`${controlCount} balizas`:"",routeCount?`${routeCount} recorridos`:""].filter(Boolean).join(" · ");
  return `<div class="r8-event-row"><div class="r8-event-copy"><strong>${esc(row.eventName||row.name||row.eventId||"Carrera")}</strong><span>${esc(row.eventId||"")}</span><small><b>ORGANIZADOR</b> · ${esc(ownerLabel(String(row.ownerUid||"")))}</small>${metrics?`<small>${esc(metrics)}</small>`:""}<small>Actualizada · ${esc(formatDate(row.updatedAt||row.createdAt))}</small></div><div class="r8-event-side"><b class="r8-event-status" data-status="${esc(String(row.status||"draft"))}">${esc(statusLabel(row.status))}</b><button type="button" class="r8-event-detail-btn militopo-nav-target" data-r8-event-detail="${esc(row.eventId)}">VER FICHA</button></div></div>`;
}
function renderEventDetail(){
  const row=state.events.find(item=>item.eventId===state.selectedEventId);if(!row)return "";
  const owner=state.users.find(user=>user.uid===String(row.ownerUid||""));
  const participantCount=Math.max(0,Math.trunc(Number(row.participantCount)||0));
  const controlCount=Math.max(0,Math.trunc(Number(row.controlCount)||0));
  const routeCount=Math.max(0,Math.trunc(Number(row.courseSyncedCount)||0));
  const controlsPerRoute=Math.max(0,Math.trunc(Number(row.controlsPerRoute)||0));
  return `<section class="r8-event-detail" data-r8-event-detail-card><div class="r8-event-detail-head"><div><span>FICHA DE SUPERVISIÓN</span><strong>${esc(row.eventName||row.name||row.eventId||"Carrera")}</strong><small>${esc(row.eventId||"")}</small></div><button type="button" data-r8-close-event-detail aria-label="Cerrar ficha">✕</button></div><div class="r8-event-detail-grid"><div><strong>${esc(statusLabel(row.status))}</strong><span>ESTADO</span></div><div><strong>${participantCount}</strong><span>PARTICIPANTES</span></div><div><strong>${controlCount}</strong><span>BALIZAS</span></div><div><strong>${routeCount||"—"}</strong><span>RECORRIDOS</span></div><div><strong>${controlsPerRoute||"—"}</strong><span>BALIZAS / REC.</span></div><div><strong>${esc(formatDate(row.updatedAt||row.createdAt))}</strong><span>ÚLTIMA ACT.</span></div></div><div class="r8-event-detail-owner"><b>ORGANIZADOR</b><span>${esc(ownerLabel(String(row.ownerUid||"")))}</span>${owner?.email?`<small>${esc(owner.email)}</small>`:""}</div><button type="button" class="r8-event-detail-open militopo-nav-target" data-r8-open-organizer-center="${esc(row.eventId)}">LOCALIZAR EN CARGAR CARRERA</button></section>`;
}
function eventCounts(rows=state.events){const counts=Object.fromEntries(statusKeys.map(key=>[key,0]));rows.forEach(row=>{const key=String(row.status||"draft");if(key in counts)counts[key]++});return counts}
function filteredEvents(){
  const q=searchKey(state.eventQuery.trim());
  return state.events.slice().filter(row=>{
    if(state.eventStatusFilter!=="all"&&String(row.status||"draft")!==state.eventStatusFilter)return false;
    if(!q)return true;
    const owner=ownerLabel(String(row.ownerUid||""));
    return [row.eventName,row.name,row.eventId,owner,row.ownerUid,statusLabel(row.status)].some(value=>searchKey(value).includes(q));
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
  if(state.eventStatusFilter==="closed")rows=state.events.slice().filter(row=>["finished","archived"].includes(String(row.status||""))).filter(row=>{const q=searchKey(state.eventQuery.trim());if(!q)return true;return [row.eventName,row.name,row.eventId,ownerLabel(String(row.ownerUid||"")),row.ownerUid].some(value=>searchKey(value).includes(q))}).sort((a,b)=>tsMs(b.updatedAt)-tsMs(a.updatedAt));
  const visible=rows.slice(0,state.eventsVisible);const remaining=Math.max(0,rows.length-visible.length);
  const statusOptions=[["all","TODOS LOS ESTADOS"],["draft","BORRADOR"],["prepared","PREPARADO"],["published","PUBLICADO"],["live","EN DIRECTO"],["closed","CERRADAS"],["finished","FINALIZADO"],["archived","ARCHIVADO"]];
  view.innerHTML=`${renderEventSummary()}<div class="r8-admin-toolbar r8-events-toolbar"><input type="search" value="${esc(state.eventQuery)}" data-r8-event-search placeholder="Buscar carrera, ID u organizador" aria-label="Buscar carreras"><select data-r8-event-status aria-label="Filtrar carreras por estado">${statusOptions.map(([key,label])=>`<option value="${key}" ${state.eventStatusFilter===key?"selected":""}>${label}</option>`).join("")}</select></div>${renderEventDetail()}<section class="r8-admin-section"><div class="r8-admin-section-head"><div><strong>SUPERVISIÓN GLOBAL</strong><small>${rows.length===state.events.length?`${rows.length} carreras accesibles como súper administrador`:`${rows.length} de ${state.events.length} carreras coinciden con el filtro`}</small></div><button type="button" class="r8-admin-open-events militopo-nav-target" data-r8-open-organizer-center>ABRIR CARGAR CARRERA</button></div><div class="r8-event-list">${visible.length?visible.map(eventRowHtml).join(""):'<div class="r8-admin-empty">No hay carreras que coincidan con la búsqueda o el filtro.</div>'}</div>${remaining?`<div class="r8-load-more-wrap"><button type="button" class="r8-load-more" data-r8-load-more><span>CARGAR MÁS</span><small>${Math.min(EVENT_PAGE_SIZE,remaining)} de ${remaining} restantes</small></button></div>`:""}</section>`;
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
  try{const svc=await services();await svc.callable("setUserRole",{uid,role});user.roleMirror=role;if(state.selectedUserId===uid&&state.userDetail?.account)state.userDetail.account.role=role;setStatus(`Rol actualizado: ${name} · ${roleLabel(role)}`);render()}catch(error){console.error("[MILITOPO R8 role]",error);setStatus(`No se pudo cambiar el rol: ${String(error?.message||error)}`,true);button.disabled=false}
}
async function openUserDetail(uid){
  uid=String(uid||"").trim();if(!uid)return;
  state.usersScrollTop=$(".r8-admin-body",state.overlay)?.scrollTop||0;
  state.selectedUserId=uid;state.userDetail=null;state.userDetailError="";state.userDetailLoading=true;renderUsers();
  setTimeout(()=>{const card=$("[data-r8-user-detail-card]",state.overlay);if(card)card.scrollTop=0},20);
  try{const svc=await services();const result=await svc.callable("getAdminUserOverview",{uid});state.userDetail=result?.data||null;if(!state.userDetail)throw new Error("La ficha no devolvió datos.");}
  catch(error){console.error("[MILITOPO R8 user detail]",error);const message=String(error?.message||error||"");state.userDetailError=message.includes("not-found")?"No se encontró esta cuenta.":message.includes("permission")?"No tienes permiso para consultar esta ficha.":"No se pudo cargar la ficha completa. Comprueba que la Function getAdminUserOverview está desplegada.";}
  finally{state.userDetailLoading=false;renderUsers();setTimeout(()=>{const card=$("[data-r8-user-detail-card]",state.overlay);if(card)card.scrollTop=0},20)}
}
function openOrganizerCenter(query=""){
  const center=globalThis.MILITOPO_V2_ORGANIZER_CENTER;
  if(!center?.open){toast("CARGAR CARRERA todavía se está iniciando.");return}
  state.tab="events";close();
  setTimeout(()=>{try{center.open({returnToAdmin:true,query:String(query||"")})}catch(error){console.error("[MILITOPO R8 center]",error);toast("No se pudo abrir CARGAR CARRERA.");open()}},60);
}
function onClick(event){
  if(event.target===state.overlay||event.target.closest("[data-r8-close]")){close();return}
  const tab=event.target.closest("[data-r8-tab]");if(tab){setTab(tab.dataset.r8Tab);return}
  if(event.target.closest("[data-r8-refresh]")){refresh();return}
  const userChip=event.target.closest("[data-r8-user-chip]");if(userChip){state.roleFilter=userChip.dataset.r8UserChip||"all";state.usersVisible=USER_PAGE_SIZE;renderUsers();return}
  if(event.target.closest("[data-r8-user-load-more]")){state.usersVisible+=USER_PAGE_SIZE;renderUsers();return}
  const userView=event.target.closest("[data-r8-user-view]");if(userView){openUserDetail(userView.dataset.r8UserView);return}
  if(event.target.closest("[data-r8-close-user-detail]")){state.selectedUserId="";state.userDetail=null;state.userDetailError="";state.userDetailLoading=false;renderUsers();setTimeout(()=>{const body=$(".r8-admin-body",state.overlay);if(body)body.scrollTop=state.usersScrollTop||0},0);return}
  const apply=event.target.closest("[data-r8-apply-role]");if(apply){applyRole(apply);return}
  if(event.target.closest("[data-r8-open-events]")){state.eventStatusFilter="all";setTab("events");return}
  if(event.target.closest("[data-r8-open-users]")){setTab("users");return}
  const summaryFilter=event.target.closest("[data-r8-summary-filter]");if(summaryFilter){state.eventStatusFilter=summaryFilter.dataset.r8SummaryFilter||"all";state.eventQuery="";setTab("events");return}
  const openCenter=event.target.closest("[data-r8-open-organizer-center]");if(openCenter){openOrganizerCenter(openCenter.dataset.r8OpenOrganizerCenter||"");return}
  const detail=event.target.closest("[data-r8-event-detail]");if(detail){state.selectedEventId=detail.dataset.r8EventDetail||"";if(state.tab!=="events")setTab("events");else renderEvents();setTimeout(()=>$("[data-r8-event-detail-card]",state.overlay)?.scrollIntoView?.({block:"nearest",behavior:"smooth"}),20);return}
  if(event.target.closest("[data-r8-close-event-detail]")){state.selectedEventId="";renderEvents();return}
  const chip=event.target.closest("[data-r8-event-chip]");if(chip){const key=chip.dataset.r8EventChip;state.eventStatusFilter=key==="closed"?"closed":key;state.eventsVisible=EVENT_PAGE_SIZE;renderEvents();return}
  if(event.target.closest("[data-r8-load-more]")){state.eventsVisible+=EVENT_PAGE_SIZE;renderEvents();return}
}
function onInput(event){
  if(event.target.matches("[data-r8-user-search]")){state.userQuery=event.target.value;state.usersVisible=USER_PAGE_SIZE;renderUsers();const next=$("[data-r8-user-search]",state.overlay);if(next){next.focus({preventScroll:true});try{next.setSelectionRange(state.userQuery.length,state.userQuery.length)}catch(_){}}return}
  if(event.target.matches("[data-r8-event-search]")){state.eventQuery=event.target.value;state.eventsVisible=EVENT_PAGE_SIZE;renderEvents();const next=$("[data-r8-event-search]",state.overlay);if(next){next.focus();try{next.setSelectionRange(state.eventQuery.length,state.eventQuery.length)}catch(_){}}}
}
function onChange(event){
  if(event.target.matches("[data-r8-role-filter]")){state.roleFilter=event.target.value;state.usersVisible=USER_PAGE_SIZE;renderUsers();return}
  if(event.target.matches("[data-r8-event-status]")){state.eventStatusFilter=event.target.value||"all";state.eventsVisible=EVENT_PAGE_SIZE;renderEvents()}
}
function open(){state.auth=globalThis.MILITOPO_V2_AUTH||state.auth;if(!isSuperAdmin()){toast("Esta zona requiere SÚPER ADMINISTRADOR.");return false}const overlay=ensureUi();overlay.classList.add("is-open");document.body.style.overflow="hidden";setTab(state.tab||"summary");refresh();return true}
function close(){if(!state.overlay)return;state.overlay.classList.remove("is-open");document.body.style.overflow=""}
function onAuth(detail){state.auth=detail||null;if(!isSuperAdmin())close()}

globalThis.MILITOPO_R8_SUPER_ADMIN=Object.freeze({open,close,refresh});
globalThis.addEventListener("militopo:r8-open-admin",open);
globalThis.addEventListener("militopo:v2-auth-ready",event=>onAuth(event.detail));
globalThis.addEventListener("militopo:r8-return-admin",()=>{state.tab="events";setTimeout(()=>open(),30)});
if(globalThis.MILITOPO_V2_AUTH)onAuth(globalThis.MILITOPO_V2_AUTH);
