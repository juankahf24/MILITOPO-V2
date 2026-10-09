/* MILITOPO V2 · R8J/R8K · Runner: perfil fotográfico profesional y clasificación histórica visual. */
import "./runner-live-loader.js?v=v2-r6f-race-focus-summary-20261007";
import "./runner-history-v2.js?v=v2-r7e-runner-coherence-20261008";
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  initializeAuth,getAuth,indexedDBLocalPersistence,browserLocalPersistence,browserSessionPersistence,
  onAuthStateChanged,signOut,updateProfile
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, onSnapshot, updateDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";
import { openProfilePhotoMenu, openProfilePhotoViewer } from "../../js/v2/profile/profile-photo-ui.js?v=v2-r8l-profile-photo-square-20261009";

const VERSION="v2-r8m-classification-photo-compact-user-20261010";
const REGION="europe-west1";
const APP_NAME="militopo-v2";
const HISTORY_PAGE=6;

window.__MILITOPO_RUNNER_HOME_V4_BOOTED=true;
try{clearTimeout(window.__MILITOPO_RUNNER_HOME_V4_WATCHDOG);}catch(_){ }

const els={
  name:document.getElementById("rhName"),meta:document.getElementById("rhMeta"),avatar:document.getElementById("rhAvatar"),
  detailsBtn:document.getElementById("rhDetailsBtn"),logoutBtn:document.getElementById("rhLogoutBtn"),details:document.getElementById("rhDetails"),photoBtn:document.getElementById("rhPhotoBtn"),photoStatus:document.getElementById("rhPhotoStatus"),
  status:document.getElementById("rhStatus"),activeEvents:document.getElementById("rhActiveEvents"),historyEvents:document.getElementById("rhHistoryEvents"),
  activeCount:document.getElementById("rhActiveCount"),historyCount:document.getElementById("rhHistoryCount"),retry:document.getElementById("rhRetry"),
  headerUser:document.getElementById("rhHeaderUser"),headerHandle:document.getElementById("rhHeaderHandle"),hero:document.getElementById("rhDashboardHero"),
  dashActive:document.getElementById("rhDashActive"),dashFinished:document.getElementById("rhDashFinished"),dashTotal:document.getElementById("rhDashTotal"),dashKm:document.getElementById("rhDashKm"),
  historyMore:document.getElementById("rhHistoryMore"),histAll:document.getElementById("rhHistAll"),histFinished:document.getElementById("rhHistFinished"),histIncomplete:document.getElementById("rhHistIncomplete"),histNotStarted:document.getElementById("rhHistNotStarted"),resultModal:document.getElementById("rhResultModal"),resultTitle:document.getElementById("rhResultTitle"),resultBody:document.getElementById("rhResultBody"),resultClose:document.getElementById("rhResultClose"),
  inviteEvents:document.getElementById("rhInviteEvents"),inviteCount:document.getElementById("rhInviteCount"),raceNotice:document.getElementById("rhRaceNotice"),
  upcomingCard:document.getElementById("rhUpcomingCard"),recentCard:document.getElementById("rhRecentCard"),
  raceModal:document.getElementById("rhRaceModal"),raceTitle:document.getElementById("rhRaceTitle"),raceBody:document.getElementById("rhRaceBody"),raceClose:document.getElementById("rhRaceClose"),
  profileParticipations:document.getElementById("rhProfileParticipations"),profileFinished:document.getElementById("rhProfileFinished"),profileIncomplete:document.getElementById("rhProfileIncomplete"),profileKm:document.getElementById("rhProfileKm"),profileControls:document.getElementById("rhProfileControls"),profileElevation:document.getElementById("rhProfileElevation"),profilePenalty:document.getElementById("rhProfilePenalty"),profileDiscarded:document.getElementById("rhProfileDiscarded"),profileCompletion:document.getElementById("rhProfileCompletion"),profileBestRank:document.getElementById("rhProfileBestRank"),
  performanceHeadline:document.getElementById("rhPerformanceHeadline"),performanceSub:document.getElementById("rhPerformanceSub"),performanceRing:document.getElementById("rhPerformanceRing"),perfKmAvg:document.getElementById("rhPerfKmAvg"),perfPenaltyAvg:document.getElementById("rhPerfPenaltyAvg"),perfStreak:document.getElementById("rhPerfStreak"),perfDiscardAvg:document.getElementById("rhPerfDiscardAvg"),performanceList:document.getElementById("rhPerformanceList"),performanceCount:document.getElementById("rhPerformanceCount"),profileHistoryBtn:document.getElementById("rhProfileHistoryBtn"),
  recordDistance:document.getElementById("rhRecordDistance"),recordDistanceEvent:document.getElementById("rhRecordDistanceEvent"),recordElevation:document.getElementById("rhRecordElevation"),recordElevationEvent:document.getElementById("rhRecordElevationEvent"),recordControls:document.getElementById("rhRecordControls"),recordControlsEvent:document.getElementById("rhRecordControlsEvent"),recordBestRank:document.getElementById("rhRecordBestRank"),recordBestRankEvent:document.getElementById("rhRecordBestRankEvent"),
  network:document.querySelector(".online")
};

let auth=null,currentUser=null,profile=null,currentRaceTab="active",currentMainTab="home";
let functions=null,historyRows=[],activeRows=[],inviteRows=[],historyVisible=HISTORY_PAGE,historyFilter="all",inviteBusy=false;
let inviteUnsubs=[],inviteEmailRows=new Map(),inviteUidRows=new Map();
let activeEventUnsubs=new Map(),activeRefreshTimer=0,activeRefreshBusy=false,lastActiveRefreshAt=0,currentApp=null;
const completedEventIds=new Set();
let postRaceRefreshTimer=0;
const classificationCache=new Map();

function text(el,v){if(el)el.textContent=String(v??"");}
function esc(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function setStatus(message,type=""){text(els.status,message);if(els.status)els.status.className=`status${type?` ${type}`:""}`;}
function initials(name){const p=String(name||"").trim().split(/\s+/).filter(Boolean);return ((p[0]?.[0]||"")+(p[1]?.[0]||"")).toUpperCase()||"M";}
function withTimeout(promise,ms,label){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(label||"TIMEOUT")),ms))]);}
function config(){const cfg=globalThis.MILITOPO_V2_CONFIG;if(!cfg?.configured||!cfg.firebase?.apiKey)throw new Error("La configuración Firebase V2 no está disponible.");return cfg.firebase;}
function findApp(){return getApps().find(a=>a.name===APP_NAME)||null;}
async function initFirebase(){
  setStatus("Inicializando tu sesión MILITOPO…");
  if(globalThis.MILITOPO_V2?.firebase){
    try{const svc=await globalThis.MILITOPO_V2.firebase();auth=svc.auth;functions=svc.functions;return svc.app;}catch(error){console.warn("[MILITOPO runner singleton]",error);}
  }
  const app=findApp()||initializeApp(config(),APP_NAME);
  try{auth=initializeAuth(app,{persistence:[indexedDBLocalPersistence,browserLocalPersistence,browserSessionPersistence]});}catch(error){if(String(error?.code||"").includes("already-initialized"))auth=getAuth(app);else throw error;}
  functions=getFunctions(app,REGION);return app;
}
async function waitForUser(){setStatus("Recuperando tu sesión MILITOPO…");if(auth.currentUser)return auth.currentUser;return withTimeout(new Promise((resolve,reject)=>{let finished=false;const stop=onAuthStateChanged(auth,user=>{if(finished)return;finished=true;try{stop();}catch(_){}resolve(user);},error=>{if(finished)return;finished=true;try{stop();}catch(_){}reject(error);});}),10000,"No se detectó una sesión activa en este dispositivo.");}
function runnerAuthContext(){
  if(!currentUser?.uid)return null;
  const username=String(profile?.usernameKey||profile?.username||"").replace(/^@/,"").trim().toLowerCase();
  return {uid:String(currentUser.uid),email:currentUser.email||null,displayName:String(profile?.displayName||currentUser.displayName||currentUser.email||"Corredor"),username:username||null,role:"runner",photoURL:String(profile?.photoURL||currentUser.photoURL||"")||null};
}
function publishRunnerAuth(){
  const ctx=runnerAuthContext();if(!ctx)return;
  globalThis.MILITOPO_V2_AUTH={...ctx};
  try{globalThis.dispatchEvent(new CustomEvent("militopo:v2-auth-ready",{detail:{...ctx}}));}catch(_){}
}
function updateConnectivity(){
  if(!els.network)return;const online=navigator.onLine!==false;
  els.network.innerHTML=`<i></i>${online?"EN LÍNEA":"SIN COBERTURA"}`;
  els.network.classList.toggle("is-offline",!online);
}

function paintRunnerAvatar(name,photoURL=""){
  if(!els.avatar)return;
  const url=String(photoURL||"").trim();
  els.avatar.replaceChildren();
  if(url){const img=document.createElement("img");img.src=url;img.alt="";img.decoding="async";img.referrerPolicy="no-referrer";img.addEventListener("error",()=>{els.avatar.textContent=initials(name)},{once:true});els.avatar.appendChild(img);}else els.avatar.textContent=initials(name);
}
function runnerPhotoMessage(message,type=""){
  if(!els.photoStatus)return;els.photoStatus.textContent=String(message||"");els.photoStatus.className=`profile-photo-status${type?` ${type}`:""}`;
}
async function saveRunnerPhotoBlob(blob){
  if(!currentUser||!currentApp||!blob)return;if(navigator.onLine===false){runnerPhotoMessage("Necesitas conexión para cambiar la foto.","err");return;}
  if(els.photoBtn)els.photoBtn.disabled=true;runnerPhotoMessage("Subiendo foto…");
  try{const sdk=await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js");const storage=sdk.getStorage(currentApp),target=sdk.ref(storage,`avatars/${currentUser.uid}/profile.jpg`);await sdk.uploadBytes(target,blob,{contentType:"image/jpeg",cacheControl:"public,max-age=3600"});const basePhotoURL=await sdk.getDownloadURL(target);const photoURL=`${basePhotoURL}${basePhotoURL.includes("?")?"&":"?"}v=${Date.now()}`;await updateProfile(currentUser,{photoURL});const db=getFirestore(currentApp);await setDoc(doc(db,"users",currentUser.uid),{photoURL,updatedAt:serverTimestamp()},{merge:true});profile={...(profile||{}),photoURL};classificationCache.clear();paintRunnerAvatar(String(profile?.displayName||currentUser.displayName||currentUser.email||"Usuario"),photoURL);publishRunnerAuth();runnerPhotoMessage("Foto actualizada.","ok");}
  catch(error){console.error("[MILITOPO runner photo]",error);const code=String(error?.code||"");runnerPhotoMessage(code.includes("storage/unauthorized")?"Falta desplegar las reglas de Storage de este bloque.":String(error?.message||"No se pudo actualizar la foto."),"err");throw error}
  finally{if(els.photoBtn)els.photoBtn.disabled=false;}
}
function openRunnerPhotoMenu(){
  if(!currentUser)return;const name=String(profile?.displayName||currentUser.displayName||currentUser.email||"Usuario"),photoURL=String(profile?.photoURL||currentUser.photoURL||"");
  openProfilePhotoMenu({photoURL,name,canChange:true,onSave:saveRunnerPhotoBlob});
}

async function loadProfile(app,user){
  const db=getFirestore(app);let data={};
  try{const snap=await withTimeout(getDoc(doc(db,"users",user.uid)),8000,"El perfil tardó demasiado en responder.");if(snap.exists())data=snap.data()||{};}catch(error){console.warn("[MILITOPO runner profile]",error);}
  profile=data;
  const displayName=String(data.displayName||user.displayName||user.email||"Usuario").trim();
  const username=String(data.usernameKey||data.username||"").trim().toLowerCase().replace(/^@/,"");
  text(els.name,displayName);text(els.headerUser,displayName);text(els.headerHandle,username?`@${username}`:"");text(els.meta,`${username?`@${username} · `:""}${user.email||""}`);paintRunnerAvatar(displayName,data.photoURL||user.photoURL||"");
  if(els.detailsBtn)els.detailsBtn.disabled=false;if(els.logoutBtn)els.logoutBtn.disabled=false;
  if(els.details)els.details.innerHTML=`<strong>Nombre:</strong> ${esc(displayName)}<br><strong>Usuario:</strong> ${username?`@${esc(username)}`:"Sin usuario"}<br><strong>Correo:</strong> ${esc(user.email||"")}<br><strong>Rol:</strong> CORREDOR`;
  publishRunnerAuth();
}

function statusES(s){return ({draft:"BORRADOR",prepared:"PREPARADO",published:"PUBLICADA",live:"EN DIRECTO",finished:"FINALIZADA",archived:"ARCHIVADA",incomplete:"INCOMPLETA",not_started:"NO SALIÓ"})[String(s||"").toLowerCase()]||String(s||"").toUpperCase();}
function formatDuration(ms){const n=Number(ms);if(!Number.isFinite(n)||n<0)return "—";const total=Math.round(n/1000),h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;return h>0?`${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${m}:${String(s).padStart(2,"0")}`;}
function formatDate(ms){const n=Number(ms);if(!Number.isFinite(n)||n<=0)return "";try{return new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(n));}catch(_){return "";}}
function formatKm(m){const n=Number(m);return Number.isFinite(n)&&n>0?`${(n/1000).toFixed(2)} km`:"0.00 km";}
function formatKmCompact(km){const n=Number(km);if(!Number.isFinite(n)||n<=0)return "0 km";const digits=n>=100?0:1;return `${n.toFixed(digits).replace(".",",")} km`;}
function formatPenalty(ms){const n=Math.max(0,Number(ms||0));return n>0?`+${formatDuration(n)}`:"0:00";}
function stateClass(s){const v=String(s||"").toLowerCase();return ["live","published","finished","incomplete","not_started"].includes(v)?v:"";}
function metric(label,value){return `<div class="metric"><small>${esc(label)}</small><b>${esc(value)}</b></div>`;}
function historyEventIdSet(){return new Set(historyRows.map(row=>String(row?.eventId||"")).filter(Boolean));}
function inviteSeenStorageKey(){return `militopo_v2_runner_invites_seen_${String(currentUser?.uid||"guest")}`;}
function readSeenInviteIds(){try{const raw=JSON.parse(localStorage.getItem(inviteSeenStorageKey())||"[]");return new Set(Array.isArray(raw)?raw.map(String):[]);}catch(_){return new Set();}}
function markInvitesSeen(){if(!currentUser?.uid)return;const seen=readSeenInviteIds();inviteRows.forEach(row=>seen.add(String(row.id)));try{localStorage.setItem(inviteSeenStorageKey(),JSON.stringify([...seen].slice(-120)));}catch(_){}updateInviteNotifications();}
function updateInviteNotifications(){const seen=readSeenInviteIds(),unseen=inviteRows.filter(row=>!seen.has(String(row.id))).length,inviteTab=document.querySelector('[data-race-tab="invites"]');if(els.raceNotice)els.raceNotice.hidden=unseen===0;inviteTab?.classList.toggle("has-notification",inviteRows.length>0);if(inviteTab)inviteTab.setAttribute("aria-label",inviteRows.length?`Invitaciones, ${inviteRows.length} pendiente${inviteRows.length===1?"":"s"}${unseen?`, ${unseen} nueva${unseen===1?"":"s"}`:""}`:"Invitaciones");}

function setMainTab(tab){
  currentMainTab=["home","races","profile"].includes(tab)?tab:"home";
  document.querySelectorAll("[data-runner-tab]").forEach(btn=>btn.classList.toggle("is-active",btn.dataset.runnerTab===currentMainTab));
  document.querySelectorAll("[data-runner-panel]").forEach(panel=>panel.classList.toggle("is-active",panel.dataset.runnerPanel===currentMainTab));
  window.scrollTo({top:0,behavior:"auto"});
}
function setRaceTab(tab){
  currentRaceTab=["active","invites","history"].includes(tab)?tab:"active";
  document.querySelectorAll("[data-race-tab]").forEach(btn=>btn.classList.toggle("is-active",btn.dataset.raceTab===currentRaceTab));
  document.querySelectorAll("[data-race-panel]").forEach(panel=>panel.classList.toggle("is-active",panel.dataset.racePanel===currentRaceTab));
  if(currentRaceTab==="history")hydrateVisibleRanks();
  if(currentRaceTab==="invites")markInvitesSeen();
}

async function enterRace(eventId){
  const id=String(eventId||"").trim();if(!id||!currentUser?.uid)return;
  let ev=activeRows.find(row=>String(row.eventId)===id);
  if(!ev){setStatus("No se encontró esta carrera en tu sesión.","err");return;}
  if(String(ev.status||"").toLowerCase()!=="live"){setStatus("La carrera todavía no está EN DIRECTO.","err");return;}
  try{
    setStatus(`Conectando con ${ev.eventName||"la carrera"}…`);
    functions=functions||getFunctions(currentApp||findApp(),REGION);
    const join=httpsCallable(functions,"runnerJoinLive");
    const response=await withTimeout(join({eventId:id,clientVersion:VERSION}),12000,"No se pudo abrir la sesión Live V2.");
    const data=response?.data||{};const runId=String(data.runId||ev.liveRunId||"").trim();
    if(!runId)throw new Error("La sesión Live todavía no está preparada. Inténtalo de nuevo en unos segundos.");
    ev={...ev,...data,status:"live",liveRunId:runId};
    activeRows=activeRows.map(row=>String(row.eventId)===id?ev:row);
    renderActiveEvents(activeRows);renderDashboard();closeRaceModal();publishRunnerAuth();
    const authCtx=runnerAuthContext();
    globalThis.dispatchEvent(new CustomEvent("militopo:v2-open-runner-race",{detail:{event:{...ev},runId,auth:{...authCtx}}}));
    setStatus(`${ev.eventName||"Carrera"} · conectado a Live V2.`,"ok");
  }catch(error){console.error("[MILITOPO runner enter race]",error);setStatus(`No se pudo entrar en la carrera. ${String(error?.message||error)}`,"err");}
}

function routeMetric(ev,label,value){return value?`<div class="race-mini"><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`:"";}
function activeRaceDetails(ev){
  const distance=Number(ev.routeDistanceKm),positive=Number(ev.routePositiveM),controls=Math.max(0,Number(ev.routeControlCount||0));
  return [
    routeMetric(ev,"PLAZA",ev.participantId||"—"),routeMetric(ev,"RECORRIDO",ev.routeId||"—"),
    routeMetric(ev,"DISTANCIA",Number.isFinite(distance)&&distance>0?`${distance.toFixed(2)} km`:""),
    routeMetric(ev,"DESNIVEL +",Number.isFinite(positive)&&positive>=0?`${Math.round(positive)} m`:""),
    routeMetric(ev,"CONTROLES",controls?String(controls):""),routeMetric(ev,"DIFICULTAD",ev.routeDifficulty||"")
  ].join("");
}
function openRaceDetail(ev){
  if(!ev||!els.raceModal)return;text(els.raceTitle,ev.eventName||"Carrera");
  const state=String(ev.status||"").toLowerCase(),live=state==="live";
  const points=Array.isArray(ev.routePoints)?ev.routePoints.filter(Boolean):[];
  els.raceBody.innerHTML=`<div class="race-detail-status"><span class="pill ${esc(stateClass(state))}">${esc(statusES(state))}</span><strong>${live?"LISTA PARA COMPETIR":"PLAZA CONFIRMADA"}</strong></div><div class="race-detail-grid">${activeRaceDetails(ev)||'<div class="empty-card"><strong>Asignación confirmada</strong><span>La organización completará los datos del recorrido.</span></div>'}</div>${points.length?`<div class="route-sequence"><small>SECUENCIA DE CONTROLES</small><div>${points.map(p=>`<span>${esc(p)}</span>`).join("")}</div></div>`:""}<div class="race-detail-action">${live?`<button class="btn primary" type="button" data-modal-enter="${esc(ev.eventId)}">ENTRAR EN LA CARRERA</button>`:`<div class="waiting">El acceso a competición se habilitará cuando la organización ponga la carrera EN DIRECTO.</div>`}</div>`;
  els.raceModal.classList.add("is-open");els.raceModal.setAttribute("aria-hidden","false");
  els.raceBody.querySelector("[data-modal-enter]")?.addEventListener("click",()=>enterRace(ev.eventId));
}
function closeRaceModal(){els.raceModal?.classList.remove("is-open");els.raceModal?.setAttribute("aria-hidden","true");}

function renderActiveEvents(events){
  const list=els.activeEvents;if(!list)return;list.innerHTML="";text(els.activeCount,events.length);
  if(!events.length){list.innerHTML='<div class="empty-card"><strong>Sin carreras activas</strong><span>Cuando una carrera esté PUBLICADA o EN DIRECTO aparecerá aquí.</span></div>';return;}
  list.innerHTML=events.map(ev=>{
    const state=String(ev.status||"").toLowerCase(),live=state==="live";
    const assignment=[ev.participantId,ev.routeId].filter(Boolean).map(x=>`<span>${esc(x)}</span>`).join("");
    const summary=[Number(ev.routeDistanceKm)>0?`${Number(ev.routeDistanceKm).toFixed(2)} km`:"",Number(ev.routePositiveM)>=0&&ev.routePositiveM!==null?`+${Math.round(Number(ev.routePositiveM))} m`:"",ev.routeControlCount?`${ev.routeControlCount} controles`:""].filter(Boolean).join(" · ");
    const actions=`<div class="event-actions"><button class="btn secondary" type="button" data-active-detail="${esc(ev.eventId)}">VER DETALLES</button>${live?`<button class="btn primary" type="button" data-enter-event="${esc(ev.eventId)}">ENTRAR</button>`:""}</div>`;
    return `<article class="event" data-state="${esc(stateClass(state))}"><div class="event-top"><div class="event-title-wrap"><strong class="event-title">${esc(ev.eventName||"Carrera")}</strong><span class="event-date">${state==="live"?"Carrera en curso":"Esperando inicio"}</span></div><span class="pill ${esc(stateClass(state))}">${esc(statusES(state))}</span></div>${assignment?`<div class="assignment">${assignment}</div>`:""}${summary?`<div class="race-summary">${esc(summary)}</div>`:""}${!live?'<div class="waiting">Tu plaza está confirmada. Consulta tu recorrido mientras esperas el inicio.</div>':""}${actions}</article>`;
  }).join("");
  list.querySelectorAll("[data-enter-event]").forEach(btn=>btn.addEventListener("click",()=>enterRace(btn.dataset.enterEvent)));
  list.querySelectorAll("[data-active-detail]").forEach(btn=>btn.addEventListener("click",()=>{const ev=events.find(row=>String(row.eventId)===String(btn.dataset.activeDetail));if(ev)openRaceDetail(ev);}));
}

function stopActiveEventRealtime(){
  for(const [,unsub] of activeEventUnsubs){try{unsub?.();}catch(_){}}activeEventUnsubs.clear();
  if(activeRefreshTimer){clearTimeout(activeRefreshTimer);activeRefreshTimer=0;}
}
function scheduleActiveRefresh(app,delay=220){
  if(activeRefreshTimer)clearTimeout(activeRefreshTimer);
  activeRefreshTimer=setTimeout(()=>{activeRefreshTimer=0;refreshActiveEvents(app,{silent:true}).catch(()=>{});},Math.max(50,delay));
}
function bindActiveEventRealtime(app){
  const db=getFirestore(app),wanted=new Set(activeRows.map(row=>String(row.eventId||"")).filter(Boolean));
  for(const [eventId,unsub] of [...activeEventUnsubs.entries()]){if(wanted.has(eventId))continue;try{unsub?.();}catch(_){}activeEventUnsubs.delete(eventId);}
  for(const ev of activeRows){
    const eventId=String(ev.eventId||"");if(!eventId||activeEventUnsubs.has(eventId))continue;
    const unsub=onSnapshot(doc(db,"events",eventId),snap=>{
      if(!snap.exists())return;const data=snap.data()||{},nextStatus=String(data.status||"").toLowerCase();
      const idx=activeRows.findIndex(row=>String(row.eventId)===eventId);if(idx<0)return;
      const prevStatus=String(activeRows[idx].status||"").toLowerCase(),changed=prevStatus!==nextStatus;
      if(["published","live"].includes(nextStatus)){
        activeRows[idx]={...activeRows[idx],status:nextStatus,eventName:String(data.eventName||activeRows[idx].eventName||"Carrera")};
        renderActiveEvents(activeRows);renderDashboard();
        if(changed){setStatus(nextStatus==="live"?`${activeRows[idx].eventName} está EN DIRECTO.`:`${activeRows[idx].eventName} está PUBLICADA.`,"ok");}
        if(nextStatus==="live")scheduleActiveRefresh(app,180);
      }else if(["finished","archived"].includes(nextStatus)){
        activeRows=activeRows.filter(row=>String(row.eventId)!==eventId);renderActiveEvents(activeRows);renderDashboard();scheduleActiveRefresh(app,250);
      }
    },error=>console.warn("[MILITOPO runner event realtime]",eventId,error));
    activeEventUnsubs.set(eventId,unsub);
  }
}
async function refreshActiveEvents(app,{silent=false}={}){
  if(activeRefreshBusy||!app||!currentUser?.uid)return activeRows;
  activeRefreshBusy=true;
  try{
    functions=functions||getFunctions(app,REGION);const activeCall=httpsCallable(functions,"getRunnerLiveEvents");
    const activeResult=await withTimeout(activeCall({clientVersion:VERSION}),12000,"No se pudieron actualizar las carreras activas.");
    const activeRaw=Array.isArray(activeResult?.data?.events)?activeResult.data.events:[];
    const historical=historyEventIdSet();
    activeRows=activeRaw.filter(ev=>["published","live"].includes(String(ev?.status||"").toLowerCase())&&!historical.has(String(ev?.eventId||""))&&!completedEventIds.has(String(ev?.eventId||"")));
    lastActiveRefreshAt=Date.now();renderActiveEvents(activeRows);renderDashboard();bindActiveEventRealtime(app);
    if(!silent)setStatus(`${activeRows.length} activa${activeRows.length===1?"":"s"} · actualización en tiempo real`,"ok");
    return activeRows;
  }finally{activeRefreshBusy=false;}
}
function stopInvitationRealtime(){for(const unsub of inviteUnsubs.splice(0)){try{unsub?.();}catch(_){}}inviteEmailRows.clear();inviteUidRows.clear();}
function mergeInvitationRows(){
  const merged=new Map([...inviteEmailRows,...inviteUidRows]);inviteRows=[...merged.values()].filter(row=>String(row.status||"pending").toLowerCase()==="pending");
  inviteRows.sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0));renderInvitations();updateInviteNotifications();renderDashboard();
}
function invitationMap(snap){const map=new Map();snap.forEach(d=>{const row=d.data()||{};if(String(row.status||"pending").toLowerCase()==="pending")map.set(d.id,{id:d.id,...row});});return map;}
function renderInvitations(){
  text(els.inviteCount,inviteRows.length);updateInviteNotifications();if(!els.inviteEvents)return;
  if(!inviteRows.length){els.inviteEvents.innerHTML='<div class="empty-card"><strong>Sin invitaciones pendientes</strong><span>Las nuevas invitaciones aparecerán aquí en tiempo real.</span></div>';return;}
  els.inviteEvents.innerHTML=inviteRows.map(row=>`<article class="event invite-event"><div class="event-top"><div class="event-title-wrap"><strong class="event-title">${esc(row.eventName||"Carrera de orientación")}</strong><span class="event-date">Invitación para ${esc(row.targetUsername?`@${row.targetUsername}`:(row.targetEmail||currentUser?.email||"tu cuenta"))}</span></div><span class="pill invite">INVITACIÓN</span></div><div class="invite-copy">Confirma si quieres participar. Si aceptas, MILITOPO te asignará automáticamente tu plaza y recorrido.</div><div class="invite-actions"><button class="btn invite-accept" type="button" data-accept-invite="${esc(row.id)}" ${inviteBusy?"disabled":""}>ACEPTAR</button><button class="btn invite-reject" type="button" data-reject-invite="${esc(row.id)}" ${inviteBusy?"disabled":""}>RECHAZAR</button></div></article>`).join("");
  els.inviteEvents.querySelectorAll("[data-accept-invite]").forEach(btn=>btn.addEventListener("click",()=>acceptInvitation(btn.dataset.acceptInvite)));
  els.inviteEvents.querySelectorAll("[data-reject-invite]").forEach(btn=>btn.addEventListener("click",()=>rejectInvitation(btn.dataset.rejectInvite)));
}
function startInvitationRealtime(app){
  stopInvitationRealtime();if(!currentUser?.uid||!currentUser?.email)return;const db=getFirestore(app),email=String(currentUser.email||"").trim().toLowerCase(),uid=String(currentUser.uid||"");
  const onError=error=>{console.warn("[MILITOPO runner invitations]",error);};
  inviteUnsubs.push(onSnapshot(query(collection(db,"invitations"),where("targetEmail","==",email)),snap=>{inviteEmailRows=invitationMap(snap);mergeInvitationRows();},onError));
  inviteUnsubs.push(onSnapshot(query(collection(db,"invitations"),where("targetUid","==",uid)),snap=>{inviteUidRows=invitationMap(snap);mergeInvitationRows();},onError));
}
async function acceptInvitation(invitationId){
  if(inviteBusy||!invitationId||!functions)return;const row=inviteRows.find(item=>String(item.id)===String(invitationId));
  const confirmed=globalThis.MILITOPO_CONFIRM?await globalThis.MILITOPO_CONFIRM(`Vas a unirte a ${row?.eventName||"esta carrera"}. MILITOPO te asignará automáticamente una plaza y un recorrido.`,{title:"ACEPTAR INVITACIÓN",confirmText:"UNIRME"}):true;
  if(!confirmed)return;inviteBusy=true;renderInvitations();
  try{setStatus("Asignando tu plaza y recorrido…");const call=httpsCallable(functions,"acceptInvitationV2"),response=await call({invitationId,clientVersion:VERSION}),data=response?.data||{};setStatus(`Te has unido correctamente${data.routeId?` · ${data.routeId}`:""}.`,"ok");const app=findApp();if(app)await loadEvents(app);setMainTab("races");setRaceTab("active");}
  catch(error){console.error("[MILITOPO runner accept invitation]",error);setStatus(`No se pudo aceptar la invitación. ${String(error?.message||"")}`,"err");}
  finally{inviteBusy=false;renderInvitations();}
}
async function rejectInvitation(invitationId){
  if(inviteBusy||!invitationId||!currentUser?.uid)return;
  const row=inviteRows.find(item=>String(item.id)===String(invitationId));
  const confirmed=globalThis.MILITOPO_CONFIRM?await globalThis.MILITOPO_CONFIRM(`Vas a rechazar la invitación a ${row?.eventName||"esta carrera"}. El organizador verá que la has rechazado.`,{title:"RECHAZAR INVITACIÓN",confirmText:"RECHAZAR",danger:true}):true;
  if(!confirmed)return;
  inviteBusy=true;renderInvitations();
  try{
    if(!functions)throw new Error("Backend de invitaciones no disponible.");
    const call=httpsCallable(functions,"declineInvitationV2");
    await call({invitationId,clientVersion:VERSION});
    setStatus("Invitación rechazada. El organizador ha recibido tu respuesta.","ok");
    inviteEmailRows.delete(String(invitationId));
    inviteUidRows.delete(String(invitationId));
    mergeInvitationRows();
    renderDashboard();
  }catch(error){console.error("[MILITOPO runner reject invitation]",error);setStatus(`No se pudo rechazar la invitación. ${String(error?.message||"")}`,"err");}
  finally{inviteBusy=false;renderInvitations();}
}

function historyCard(row){
  const state=String(row.status||"not_started").toLowerCase(),date=formatDate(row.finishedAtMs||row.startedAtMs||row.consolidatedAtMs),official=row.officialDurationMs==null?null:formatDuration(row.officialDurationMs),real=row.durationMs==null?null:formatDuration(row.durationMs),penalty=Math.max(0,Number(row.penaltyMs||0)),distance=Math.max(0,Number(row.trackDistanceM||0)),pending=Math.max(0,Number(row.pendingControlCount||0)),discarded=Math.max(0,Number(row.discardedControlCount||0));
  let primary="",secondary="",metrics="",rank="";
  if(state==="finished"){
    primary=`<div class="result-main"><small>TIEMPO OFICIAL</small><strong>${esc(official||"—")}</strong></div>`;
    secondary=`<div class="result-side"><small>ESTADO</small><strong>COMPLETADA</strong></div>`;
    metrics=[metric("TIEMPO REAL",real||"—"),metric("PENALIZACIÓN",formatPenalty(penalty)),metric("DISTANCIA",distance?formatKm(distance):"—")].join("");
    rank=`<div class="history-rank loading" data-rank-event="${esc(row.eventId)}"><small>CLASIFICACIÓN</small><strong>Consultando…</strong></div>`;
  }else if(state==="incomplete"){
    primary=`<div class="result-main"><small>TIEMPO REGISTRADO</small><strong>${esc(official||real||"—")}</strong></div>`;
    secondary=`<div class="result-side"><small>ESTADO</small><strong>INCOMPLETA</strong></div>`;
    metrics=[metric("PENDIENTES",String(pending)),metric("DESCARTADAS",String(discarded)),metric("DISTANCIA",distance?formatKm(distance):"—")].join("");
    rank=`<div class="history-rank loading" data-rank-event="${esc(row.eventId)}"><small>CLASIFICACIÓN</small><strong>Consultando…</strong></div>`;
  }else{
    primary=`<div class="result-main"><small>RESULTADO</small><strong>NO SALIÓ</strong></div>`;
    secondary=`<div class="result-side"><small>REGISTRO</small><strong>SIN SALIDA</strong></div>`;
    metrics=metric("CARRERA",statusES(row.eventStatus)||"FINALIZADA");
  }
  const hasTrack=Math.max(0,Number(row.trackPointCount||0))>1;
  return `<article class="event history-event" data-state="${esc(stateClass(state))}" data-history-event="${esc(row.eventId)}"><div class="event-top"><div class="event-title-wrap"><strong class="event-title">${esc(row.eventName||"Carrera")}</strong><span class="event-date">${esc(date||statusES(row.eventStatus))}</span></div><span class="pill ${esc(stateClass(state))}">${esc(statusES(state))}</span></div><div class="result-hero">${primary}${secondary}</div>${rank}<div class="history-metrics">${metrics}</div><div class="history-actions${hasTrack?" has-replay":""}"><button class="btn secondary" type="button" data-result-detail="${esc(row.eventId)}" data-result-name="${esc(row.eventName||"Carrera")}">VER RESULTADO</button>${hasTrack?`<button class="btn replay" type="button" data-result-replay="${esc(row.eventId)}" data-result-name="${esc(row.eventName||"Carrera")}">▶ REPRODUCIR GPS</button>`:""}</div></article>`;
}

function filteredHistoryRows(){
  if(historyFilter==="all")return historyRows;
  return historyRows.filter(row=>String(row?.status||"").toLowerCase()===historyFilter);
}
function updateHistoryFilterCounts(){
  text(els.histAll,historyRows.length);
  text(els.histFinished,historyRows.filter(r=>String(r.status||"").toLowerCase()==="finished").length);
  text(els.histIncomplete,historyRows.filter(r=>String(r.status||"").toLowerCase()==="incomplete").length);
  text(els.histNotStarted,historyRows.filter(r=>String(r.status||"").toLowerCase()==="not_started").length);
}
function renderHistory(reset=false){
  const list=els.historyEvents;if(!list)return;if(reset)historyVisible=HISTORY_PAGE;text(els.historyCount,historyRows.length);updateHistoryFilterCounts();
  const rows=filteredHistoryRows(),visible=rows.slice(0,historyVisible);
  list.innerHTML=visible.length?visible.map(historyCard).join(""):'<div class="empty-card"><strong>Sin resultados en este filtro</strong><span>Prueba otra categoría del histórico.</span></div>';
  if(els.historyMore){els.historyMore.style.display=historyVisible<rows.length?"block":"none";els.historyMore.textContent=`MOSTRAR MÁS RESULTADOS (${rows.length-historyVisible})`;}
  list.querySelectorAll("[data-result-detail]").forEach(btn=>btn.addEventListener("click",()=>openResultDetail(btn.dataset.resultDetail,btn.dataset.resultName)));
  list.querySelectorAll("[data-result-replay]").forEach(btn=>btn.addEventListener("click",()=>openHistoryAnalysis(btn.dataset.resultReplay,btn.dataset.resultName)));
  hydrateVisibleRanks();
}

async function getClassification(eventId){
  if(classificationCache.has(eventId))return classificationCache.get(eventId);
  const promise=(async()=>{const call=httpsCallable(functions,"getEventClassification");const result=await call({eventId,clientVersion:VERSION});return result?.data||{};})();
  classificationCache.set(eventId,promise);try{return await promise;}catch(error){classificationCache.delete(eventId);throw error;}
}

function classificationName(row={}){const d=String(row.displayName||'').trim(),u=String(row.username||'').replace(/^@/,'').trim();return d||u&&`@${u}`||String(row.participantId||'Corredor')}
function classificationInitials(row={}){const p=classificationName(row).replace(/^@/,'').trim().split(/\s+/).filter(Boolean);return ((p[0]?.[0]||'')+(p[1]?.[0]||'')).toUpperCase()||'M'}
function classificationStatus(row={}){return ({finished:'FINALIZÓ',incomplete:'INCOMPLETA',not_started:'NO SALIÓ'})[String(row.status||'').toLowerCase()]||statusES(row.status)}
function classificationDistance(meters){const n=Number(meters);if(!Number.isFinite(n)||n<=0)return '—';const km=n/1000;return `${km.toLocaleString('es-ES',{minimumFractionDigits:km>=10?1:2,maximumFractionDigits:2})} km`}
function classificationControls(row={}){const done=Math.max(0,Number(row.controlDetectedCount||0)),expected=Math.max(0,Number(row.controlExpectedCount||row.routeControlCount||0));return expected?`${done}/${expected}`:(done?String(done):'—')}
function classificationRouteInfo(data,routeId){if(!routeId)return '';const route=(data?.routes||[]).find(item=>String(item.routeId||'')===String(routeId))||{};return `<div class="history-class-route-info"><div><small>RECORRIDO</small><strong>${esc(routeId)}</strong></div><div><small>PARTICIPANTES</small><strong>${esc(route.participantCount??(data?.byRoute?.[routeId]?.length||0))}</strong></div><div><small>DISTANCIA</small><strong>${Number.isFinite(Number(route.routeDistanceKm))?`${Number(route.routeDistanceKm).toFixed(2)} km`:'—'}</strong></div><div><small>DESNIVEL +</small><strong>${Number.isFinite(Number(route.routePositiveM))?`${Math.round(Number(route.routePositiveM))} m`:'—'}</strong></div></div>`}
function classificationRowsHtml(rows=[]){
  if(!rows.length)return '<div class="history-class-empty">Sin corredores en esta clasificación.</div>';
  const body=rows.map(row=>{
    const name=classificationName(row),username=String(row.username||'').replace(/^@/,''),me=String(row.runnerUid||'')===String(currentUser?.uid||''),photo=String((me?profile?.photoURL:'')||row.photoURL||'').trim();
    const rank=row.rank==null?'—':`${row.rank}º`,official=row.officialDurationMs==null?'—':formatDuration(row.officialDurationMs),real=row.durationMs==null?'—':formatDuration(row.durationMs),penalty=Number(row.penaltyMs||0)>0?formatDuration(row.penaltyMs):'0:00';
    const statusKey=String(row.status||'not_started').toLowerCase(),status=classificationStatus(row),participant=[username?`@${username}`:'',row.participantId||''].filter(Boolean).join(' · ');
    return `<tr class="${me?'is-me':''}"><td class="is-rank">${esc(rank)}</td><td><div class="history-class-runner"><button type="button" class="history-class-photo" data-class-photo-uid="${esc(row.runnerUid||'')}" data-class-photo-url="${esc(photo)}" data-class-photo-name="${esc(name)}" aria-label="Ver foto de ${esc(name)}">${photo?`<img src="${esc(photo)}" alt="">`:esc(classificationInitials(row))}</button><div class="history-class-runner-copy"><strong>${esc(name)}${me?' · TÚ':''}</strong><span>${esc(participant||'Corredor MILITOPO')}</span></div></div></td><td>${esc(row.routeId||'—')}</td><td><span class="history-class-status ${esc(statusKey)}">${esc(status)}</span></td><td class="history-class-official">${esc(official)}</td><td class="${Number(row.penaltyMs||0)>0?'':'history-class-zero'}">${esc(penalty)}</td><td>${esc(real)}</td><td>${esc(classificationControls(row))}</td><td>${esc(Number(row.discardedControlCount||0))}</td><td>${esc(Number(row.pendingControlCount||0))}</td><td>${esc(classificationDistance(row.trackDistanceM))}</td></tr>`;
  }).join('');
  return `<div class="history-class-table-scroll"><table class="history-class-table"><thead><tr><th>PUESTO</th><th>CORREDOR</th><th>REC.</th><th>ESTADO</th><th>TIEMPO OFICIAL</th><th>PENAL.</th><th>TIEMPO REAL</th><th>CONTROLES</th><th>DESC.</th><th>PEND.</th><th>DIST. GPS</th></tr></thead><tbody>${body}</tbody></table></div><div class="history-class-table-note">Desliza horizontalmente la tabla para consultar todos los datos de carrera.</div>`;
}
function renderHistoricalClassification(data,view='general'){
  if(!data)return '';
  const routeIds=(data.routes||[]).map(r=>String(r.routeId||'')).filter(Boolean),active=view==='general'?'general':(routeIds.includes(view)?view:'general');
  const rows=active==='general'?(data.general||[]):((data.byRoute||{})[active]||[]),tabs=[`<button type="button" class="${active==='general'?'is-active':''}" data-history-class-view="general">GENERAL</button>`,...routeIds.map(id=>`<button type="button" class="${active===id?'is-active':''}" data-history-class-view="${esc(id)}">${esc(id)}</button>`)].join('');
  const summary=data.summary||{},scopeSummary=active==='general'?{total:Number(summary.total??rows.length),finished:Number(summary.finished||0),incomplete:Number(summary.incomplete||0),notStarted:Number(summary.notStarted||0)}:{total:rows.length,finished:rows.filter(row=>String(row.status||'')==='finished').length,incomplete:rows.filter(row=>String(row.status||'')==='incomplete').length,notStarted:rows.filter(row=>String(row.status||'')==='not_started').length},finished=scopeSummary.finished,incomplete=scopeSummary.incomplete,notStarted=scopeSummary.notStarted,total=scopeSummary.total;
  return `<section class="history-classification" data-history-classification data-current-view="${esc(active)}"><div class="history-class-head"><div><small>CLASIFICACIÓN DE LA CARRERA</small><strong>${active==='general'?'GENERAL':`RECORRIDO ${esc(active)}`}</strong></div><span>${esc(total)} participantes · ${esc(routeIds.length)} recorridos</span></div><div class="history-class-summary"><div><strong>${esc(total)}</strong><small>TOTAL</small></div><div><strong>${esc(finished)}</strong><small>FINALIZARON</small></div><div><strong>${esc(incomplete)}</strong><small>INCOMPLETAS</small></div><div><strong>${esc(notStarted)}</strong><small>NO SALIÓ</small></div></div><div class="history-class-tabs">${tabs}</div>${active==='general'?'':classificationRouteInfo(data,active)}${classificationRowsHtml(rows)}</section>`;
}
function bindHistoricalClassification(root,data){if(!root||!data)return;root.querySelectorAll('[data-history-class-view]').forEach(btn=>btn.addEventListener('click',()=>{const section=root.querySelector('[data-history-classification]');if(!section)return;section.outerHTML=renderHistoricalClassification(data,btn.dataset.historyClassView||'general');bindHistoricalClassification(root,data)}));root.querySelectorAll('[data-class-photo-uid]').forEach(btn=>btn.addEventListener('click',()=>{const uid=String(btn.dataset.classPhotoUid||''),photoURL=String(btn.dataset.classPhotoUrl||''),name=String(btn.dataset.classPhotoName||'Corredor');if(uid&&uid===String(currentUser?.uid||''))openProfilePhotoMenu({photoURL:profile?.photoURL||photoURL,name,canChange:true,onSave:saveRunnerPhotoBlob});else openProfilePhotoViewer({photoURL,name})}))}

async function hydrateVisibleRanks(){
  const nodes=[...document.querySelectorAll("[data-rank-event]")];
  await Promise.allSettled(nodes.map(async node=>{
    const eventId=String(node.dataset.rankEvent||"");if(!eventId||node.dataset.loaded==="1")return;node.dataset.loaded="1";
    try{const data=await getClassification(eventId),my=data?.my;if(!my){node.classList.remove("loading");node.querySelector("strong").textContent="Sin puesto";return;}
      const generalCount=my.generalRankedCount||my.generalCount||"—";
      const routeCount=my.routeRankedCount||my.routeCount||"—";
      const general=my.generalRank?`<span class="rank-line"><em>GENERAL</em><b>${esc(my.generalRank)}º de ${esc(generalCount)}</b></span>`:`<span class="rank-line"><em>GENERAL</em><b>Sin puesto</b></span>`;
      const route=my.routeId?`<span class="rank-line"><em>${esc(my.routeId)}</em><b>${my.routeRank?`${esc(my.routeRank)}º de ${esc(routeCount)}`:"Sin puesto"}</b></span>`:"";
      node.classList.remove("loading");node.innerHTML=`<small>CLASIFICACIÓN</small><div class="rank-lines">${general}${route}</div>`;
    }catch(_){node.classList.remove("loading");node.querySelector("strong").textContent="No disponible";}
  }));
}

function renderDashboardHighlights(){
  const upcoming=activeRows.find(r=>String(r.status||"").toLowerCase()==="live")||activeRows.find(r=>String(r.status||"").toLowerCase()==="published")||null;
  const latest=historyRows[0]||null;
  if(els.upcomingCard){
    if(upcoming){const live=String(upcoming.status||"").toLowerCase()==="live";els.upcomingCard.className=`dashboard-highlight ${live?"is-live":"is-upcoming"}`;els.upcomingCard.innerHTML=`<small>${live?"AHORA":"PRÓXIMA CARRERA"}</small><strong>${esc(upcoming.eventName||"Carrera")}</strong><span>${esc([statusES(upcoming.status),upcoming.participantId,upcoming.routeId].filter(Boolean).join(" · "))}</span>`;els.upcomingCard.onclick=()=>{setMainTab("races");setRaceTab("active");};}
    else{els.upcomingCard.className="dashboard-highlight";els.upcomingCard.innerHTML='<small>PRÓXIMA CARRERA</small><strong>Sin carrera próxima</strong><span>Las carreras aceptadas y publicadas aparecerán aquí.</span>';els.upcomingCard.onclick=()=>{setMainTab("races");setRaceTab("active");};}
  }
  if(els.recentCard){
    if(latest){const official=latest.officialDurationMs==null?"":formatDuration(latest.officialDurationMs);els.recentCard.className="dashboard-highlight is-recent";els.recentCard.innerHTML=`<small>ÚLTIMA CARRERA</small><strong>${esc(latest.eventName||"Carrera")}</strong><span>${esc(statusES(latest.status))}${official?` · ${esc(official)}`:""}</span>`;els.recentCard.onclick=()=>openResultDetail(latest.eventId,latest.eventName||"Carrera");}
    else{els.recentCard.className="dashboard-highlight";els.recentCard.innerHTML='<small>ÚLTIMA CARRERA</small><strong>Sin resultados todavía</strong><span>Al finalizar una carrera aparecerá aquí automáticamente.</span>';els.recentCard.onclick=()=>{setMainTab("races");setRaceTab("history");};}
  }
}

function renderDashboard(){
  renderDashboardHighlights();
  const total=historyRows.length,finished=historyRows.filter(r=>String(r.status||"").toLowerCase()==="finished").length,totalKm=historyRows.reduce((sum,r)=>sum+Math.max(0,Number(r.trackDistanceM||0)),0)/1000;
  text(els.dashActive,activeRows.length);text(els.dashFinished,finished);text(els.dashTotal,total);text(els.dashKm,totalKm>0?totalKm.toFixed(totalKm>=100?0:1):"0");
  const live=activeRows.find(r=>String(r.status||"").toLowerCase()==="live"&&String(r.liveRunId||"").trim()),published=activeRows.find(r=>String(r.status||"").toLowerCase()==="published"),invite=inviteRows[0],latest=historyRows[0];
  if(live){els.hero.innerHTML=`<div><div class="hero-kicker">CARRERA EN DIRECTO</div><h2 class="hero-title">${esc(live.eventName||"Carrera")}</h2><div class="hero-sub">${esc([live.participantId,live.routeId].filter(Boolean).join(" · ")||"Tu carrera está lista")}</div></div><div class="hero-footer"><span class="hero-badge live">● EN DIRECTO</span><button class="hero-btn" type="button" data-hero-enter="${esc(live.eventId)}">ENTRAR</button></div>`;els.hero.querySelector("[data-hero-enter]")?.addEventListener("click",()=>enterRace(live.eventId));return;}
  if(published){els.hero.innerHTML=`<div><div class="hero-kicker">PRÓXIMA CARRERA</div><h2 class="hero-title">${esc(published.eventName||"Carrera")}</h2><div class="hero-sub">${esc([published.participantId,published.routeId].filter(Boolean).join(" · ")||"Tu plaza está confirmada")}. Esperando el inicio de la organización.</div></div><div class="hero-footer"><span class="hero-badge published">PUBLICADA</span><button class="hero-btn" type="button" data-hero-races>VER CARRERAS</button></div>`;els.hero.querySelector("[data-hero-races]")?.addEventListener("click",()=>{setMainTab("races");setRaceTab("active");});return;}
  if(invite){els.hero.innerHTML=`<div><div class="hero-kicker">NUEVA INVITACIÓN</div><h2 class="hero-title">${esc(invite.eventName||"Carrera")}</h2><div class="hero-sub">Tienes una invitación pendiente. Al aceptarla MILITOPO te asignará una plaza y un recorrido.</div></div><div class="hero-footer"><span class="hero-badge published">INVITACIÓN</span><button class="hero-btn" type="button" data-hero-invite>REVISAR</button></div>`;els.hero.querySelector("[data-hero-invite]")?.addEventListener("click",()=>{setMainTab("races");setRaceTab("invites");});return;}
  if(latest){const state=String(latest.status||"").toLowerCase(),official=latest.officialDurationMs==null?"":formatDuration(latest.officialDurationMs);els.hero.innerHTML=`<div><div class="hero-kicker">ÚLTIMO RESULTADO</div><h2 class="hero-title">${esc(latest.eventName||"Carrera")}</h2><div class="hero-sub">${esc(statusES(state))}${official?` · Tiempo oficial ${esc(official)}`:""}${Number(latest.trackDistanceM||0)>0?` · ${esc(formatKm(latest.trackDistanceM))}`:""}</div></div><div class="hero-footer"><span class="hero-badge">${esc(formatDate(latest.finishedAtMs||latest.startedAtMs||latest.consolidatedAtMs)||"HISTÓRICO")}</span><button class="hero-btn" type="button" data-hero-result>VER RESULTADO</button></div>`;els.hero.querySelector("[data-hero-result]")?.addEventListener("click",()=>openResultDetail(latest.eventId,latest.eventName||"Carrera"));return;}
  els.hero.innerHTML='<div><div class="hero-kicker">MILITOPO</div><h2 class="hero-title">Tu próxima carrera aparecerá aquí</h2><div class="hero-sub">Cuando aceptes una invitación publicada, tendrás acceso desde esta pantalla.</div></div><div class="hero-footer"><span class="hero-badge">SIN CARRERAS</span></div>';
}

function closeResultModal(){els.resultModal?.classList.remove("is-open");els.resultModal?.setAttribute("aria-hidden","true");}
async function openHistoryAnalysis(eventId,eventName){
  if(!eventId||!functions)return;
  setStatus("Preparando mapa y reproductor GPS…");
  try{
    const detailCall=httpsCallable(functions,"getRunnerResultDetail");
    const [detailRes,classRes]=await Promise.all([detailCall({eventId,clientVersion:VERSION}),getClassification(eventId).catch(()=>null)]);
    const detail=detailRes?.data||{};
    if(!Array.isArray(detail.track)||detail.track.length<2)throw new Error("Este resultado no tiene un track GPS reproducible.");
    await globalThis.MILITOPO_RUNNER_HISTORY_V2?.open?.({detail,classification:classRes,eventName:eventName||detail.event?.eventName||"Carrera"});
    setStatus("Track GPS histórico cargado.","ok");
  }catch(error){console.error("[MILITOPO runner history replay]",error);setStatus(`No se pudo abrir el reproductor. ${String(error?.message||"")}`,"err");}
}
async function openResultDetail(eventId,eventName){
  if(!eventId||!functions)return;text(els.resultTitle,eventName||"Resultado");if(els.resultBody)els.resultBody.innerHTML='<div class="status">Cargando resultado oficial…</div>';els.resultModal?.classList.add("is-open");els.resultModal?.setAttribute("aria-hidden","false");
  try{
    const detailCall=httpsCallable(functions,"getRunnerResultDetail");
    const [detailRes,classRes]=await Promise.all([detailCall({eventId,clientVersion:VERSION}),getClassification(eventId).catch(()=>null)]);
    const d=detailRes?.data||{},r=d.result||{},my=classRes?.my||null,state=String(r.status||"not_started").toLowerCase();
    const routeId=String(my?.routeId||r.courseId||"").trim()||"—";
    const generalRank=my?.generalRank?`${my.generalRank}º de ${my.generalRankedCount||my.generalCount||"—"}`:"SIN PUESTO";
    const routeRank=my?.routeRank?`${my.routeRank}º de ${my.routeRankedCount||my.routeCount||"—"}`:"SIN PUESTO";
    const replayReady=Array.isArray(d.track)&&d.track.length>1;
    if(els.resultBody){
      if(state==="not_started"){
        els.resultBody.innerHTML=`<div class="detail-status"><div class="detail-state"><small>RESULTADO</small><strong>NO SALIÓ</strong></div><div class="detail-general"><small>RECORRIDO</small><strong class="detail-rank">${esc(routeId)}</strong></div></div><div class="detail-empty-result"><strong>Sin salida registrada</strong><span>No hay tiempos, penalizaciones ni datos GPS que mostrar para esta participación.</span></div>${renderHistoricalClassification(classRes)}`;
        bindHistoricalClassification(els.resultBody,classRes);
        return;
      }
      const controls=Number(r.controlExpectedCount||0)>0?`${Math.max(0,Number(r.controlDetectedCount||0))}/${Math.max(0,Number(r.controlExpectedCount||0))}`:"—";
      const boxes=[
        [state==="finished"?"TIEMPO OFICIAL":"TIEMPO REGISTRADO",r.officialDurationMs==null?(r.durationMs==null?"—":formatDuration(r.durationMs)):formatDuration(r.officialDurationMs)],
        ["TIEMPO REAL",r.durationMs==null?"—":formatDuration(r.durationMs)],
        ["PENALIZACIÓN",formatPenalty(r.penaltyMs)],
        ["DISTANCIA",Number(r.trackDistanceM||0)>0?formatKm(r.trackDistanceM):"—"],
        ["RECORRIDO",routeId],
        ["CLASIF. RECORRIDO",routeRank],
        ["CONTROLES",controls],
        ["PENDIENTES",String(Math.max(0,Number(r.pendingControlCount||0)))],
        ["DESCARTADOS",String(Math.max(0,Number(r.discardedControlCount||0)))],
        ["DESNIVEL +",Number.isFinite(Number(r.coursePositiveM))?`${Math.round(Number(r.coursePositiveM))} m`:"—"],
        ["RITMO",Number.isFinite(Number(r.paceMinKm))?`${Number(r.paceMinKm).toFixed(2)} min/km`:"—"],
        ["VELOCIDAD MEDIA",Number.isFinite(Number(r.avgSpeedKmh))?`${Number(r.avgSpeedKmh).toFixed(2)} km/h`:"—"]
      ];
      els.resultBody.innerHTML=`<div class="detail-status"><div class="detail-state"><small>RESULTADO</small><strong>${esc(statusES(state))}</strong></div><div class="detail-general"><small>GENERAL</small><strong class="detail-rank">${esc(generalRank)}</strong></div></div><div class="detail-grid">${boxes.map(([a,b])=>`<div class="detail-box"><small>${esc(a)}</small><strong>${esc(b)}</strong></div>`).join("")}</div>${replayReady?`<button class="btn replay result-replay-btn" type="button" data-open-result-replay>▶ MAPA Y REPRODUCTOR GPS</button>`:`<div class="detail-note">Este resultado no contiene un track GPS reproducible.</div>`}${renderHistoricalClassification(classRes)}`;
      els.resultBody.querySelector("[data-open-result-replay]")?.addEventListener("click",async()=>{closeResultModal();await globalThis.MILITOPO_RUNNER_HISTORY_V2?.open?.({detail:d,classification:classRes,eventName:eventName||d.event?.eventName||"Carrera"});});
      bindHistoricalClassification(els.resultBody,classRes);
    }
  }catch(error){console.error("[MILITOPO runner result detail]",error);if(els.resultBody)els.resultBody.innerHTML=`<div class="status err">No se pudo cargar este resultado. ${esc(error?.message||"")}</div>`;}
}

function setProfileStat(el,value){if(el)el.textContent=String(value??"—");}
function startedRows(){return historyRows.filter(r=>["finished","incomplete"].includes(String(r.status||"").toLowerCase()));}
function recentStreak(){let count=0;for(const row of historyRows){const state=String(row.status||"").toLowerCase();if(state==="finished")count++;else break;}return count;}
function maxRecord(rows,getValue){let best=null,bestValue=-Infinity;for(const row of rows){const value=Number(getValue(row));if(Number.isFinite(value)&&value>bestValue){best=row;bestValue=value;}}return bestValue>0?{row:best,value:bestValue}:null;}
function renderPerformanceRecords(){
  const rows=startedRows();
  const distance=maxRecord(rows,r=>r.trackDistanceM||0),elevation=maxRecord(rows,r=>r.coursePositiveM||0),controls=maxRecord(rows,r=>r.controlDetectedCount||r.completedControlCount||0);
  setProfileStat(els.recordDistance,distance?formatKmCompact(distance.value/1000):"—");text(els.recordDistanceEvent,distance?.row?.eventName||"Sin datos");
  setProfileStat(els.recordElevation,elevation?`${Math.round(elevation.value)} m`:"—");text(els.recordElevationEvent,elevation?.row?.eventName||"Sin datos");
  setProfileStat(els.recordControls,controls?`${Math.round(controls.value)}`:"—");text(els.recordControlsEvent,controls?.row?.eventName||"Sin datos");
  if(els.recordBestRank&&!rows.length)els.recordBestRank.textContent="—";if(els.recordBestRankEvent&&!rows.length)els.recordBestRankEvent.textContent="Sin datos";
}
function renderPerformance(){
  const started=startedRows(),finished=started.filter(r=>String(r.status||"").toLowerCase()==="finished").length;
  const kmTotal=started.reduce((sum,r)=>sum+Math.max(0,Number(r.trackDistanceM||0)),0)/1000;
  const penaltyTotal=started.reduce((sum,r)=>sum+Math.max(0,Number(r.penaltyMs||0)),0);
  const discardedTotal=started.reduce((sum,r)=>sum+Math.max(0,Number(r.discardedControlCount||0)),0);
  const completion=started.length?Math.round((finished/started.length)*100):0,streak=recentStreak();
  setProfileStat(els.perfKmAvg,started.length?formatKmCompact(kmTotal/started.length):"—");
  setProfileStat(els.perfPenaltyAvg,started.length?formatPenalty(Math.round(penaltyTotal/started.length)):"—");
  setProfileStat(els.perfStreak,streak?`${streak} seguida${streak===1?"":"s"}`:"0");
  setProfileStat(els.perfDiscardAvg,started.length?(discardedTotal/started.length).toFixed(discardedTotal/started.length<10?1:0):"—");
  if(els.performanceRing)els.performanceRing.innerHTML=`<b>${completion}%</b><small>FINALIZADAS</small>`;
  if(els.performanceHeadline)els.performanceHeadline.textContent=started.length?`${finished} de ${started.length} carreras finalizadas`:"Todavía sin participaciones";
  if(els.performanceSub)els.performanceSub.textContent=started.length?`${formatKmCompact(kmTotal)} registrados en MILITOPO · ${discardedTotal} descarte${discardedTotal===1?"":"s"}`:"Cuando completes tu primera carrera, MILITOPO empezará a construir tu rendimiento.";
  renderPerformanceRecords();
  renderRecentPerformances();
}
async function renderRecentPerformances(){
  if(!els.performanceList)return;const rows=historyRows.slice(0,5);if(els.performanceCount)els.performanceCount.textContent=rows.length?`${rows.length} RECIENTES`:"SIN DATOS";
  if(!rows.length){els.performanceList.innerHTML='<div class="empty-card"><strong>Sin actuaciones todavía</strong><span>Finaliza una carrera para empezar tu análisis.</span></div>';return;}
  els.performanceList.innerHTML=rows.map(row=>{const state=String(row.status||"not_started").toLowerCase(),official=row.officialDurationMs==null?"—":formatDuration(row.officialDurationMs),distance=Number(row.trackDistanceM||0)>0?formatKm(row.trackDistanceM):"—",penalty=formatPenalty(row.penaltyMs),date=formatDate(row.finishedAtMs||row.startedAtMs||row.consolidatedAtMs)||"—";return `<div class="performance-row is-action" data-perf-event="${esc(row.eventId||"")}" data-perf-name="${esc(row.eventName||"Carrera")}" role="button" tabindex="0" aria-label="Ver resultado de ${esc(row.eventName||"Carrera")}"><div class="performance-row-main"><strong>${esc(row.eventName||"Carrera")}</strong><span>${esc(date)} · ${esc(distance)} · PEN. ${esc(penalty)}</span><i class="perf-state ${esc(state)}">${esc(statusES(state))}</i></div><div class="performance-row-side"><b>${esc(official)}</b><small class="perf-rank loading">CLASIFICACIÓN…</small></div></div>`;}).join("");
  els.performanceList.querySelectorAll("[data-perf-event]").forEach(card=>{const open=()=>openResultDetail(card.dataset.perfEvent,card.dataset.perfName||"Resultado");card.addEventListener("click",open);card.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();open();}});});
  await Promise.allSettled(rows.map(async row=>{const card=[...(els.performanceList?.querySelectorAll("[data-perf-event]")||[])].find(el=>String(el.dataset.perfEvent||"")===String(row.eventId||"")),node=card?.querySelector(".perf-rank");if(!node||!row.eventId)return;try{const data=await getClassification(row.eventId),my=data?.my;if(my?.generalRank)node.textContent=`GENERAL ${my.generalRank}º de ${my.generalRankedCount||my.generalCount||"—"}`;else node.textContent="SIN PUESTO";}catch(_){node.textContent="CLASIFICACIÓN NO DISP.";}node.classList.remove("loading");}));
}
function renderProfileStats(){
  const participations=startedRows().length;
  const finished=historyRows.filter(r=>String(r.status||"").toLowerCase()==="finished").length;
  const incomplete=historyRows.filter(r=>String(r.status||"").toLowerCase()==="incomplete").length;
  const km=historyRows.reduce((sum,r)=>sum+Math.max(0,Number(r.trackDistanceM||0)),0)/1000;
  const controls=historyRows.reduce((sum,r)=>sum+Math.max(0,Number(r.controlDetectedCount||r.completedControlCount||0)),0);
  const elevation=historyRows.reduce((sum,r)=>sum+Math.max(0,Number(r.coursePositiveM||0)),0);
  const penalty=historyRows.reduce((sum,r)=>sum+Math.max(0,Number(r.penaltyMs||0)),0);
  const discarded=historyRows.reduce((sum,r)=>sum+Math.max(0,Number(r.discardedControlCount||0)),0);
  const completionBase=finished+incomplete,completion=completionBase?Math.round((finished/completionBase)*100):0;
  setProfileStat(els.profileParticipations,participations);setProfileStat(els.profileFinished,finished);setProfileStat(els.profileIncomplete,incomplete);setProfileStat(els.profileKm,formatKmCompact(km));setProfileStat(els.profileControls,controls);setProfileStat(els.profileElevation,elevation?`${Math.round(elevation)} m`:"0 m");setProfileStat(els.profilePenalty,formatPenalty(penalty));setProfileStat(els.profileDiscarded,discarded);setProfileStat(els.profileCompletion,`${completion}%`);
  renderPerformance();hydrateBestRank();
}
async function hydrateBestRank(){
  if(!functions)return;
  if(els.profileBestRank)els.profileBestRank.textContent="Calculando…";
  if(els.recordBestRank)els.recordBestRank.textContent="…";
  if(els.recordBestRankEvent)els.recordBestRankEvent.textContent="Consultando clasificaciones…";
  const rows=startedRows().filter(r=>r.eventId).slice(0,12);
  if(!rows.length){if(els.profileBestRank)els.profileBestRank.textContent="—";if(els.recordBestRank)els.recordBestRank.textContent="—";if(els.recordBestRankEvent)els.recordBestRankEvent.textContent="Sin datos";return;}
  let best=null;
  const settled=await Promise.allSettled(rows.map(async row=>({row,data:await getClassification(row.eventId)})));
  for(const item of settled){if(item.status!=="fulfilled")continue;const {row,data}=item.value||{},my=data?.my,rank=Number(my?.generalRank);if(Number.isFinite(rank)&&rank>0&&(!best||rank<best.rank))best={rank,count:my.generalRankedCount||my.generalCount||"—",eventName:row?.eventName||"Carrera"};}
  const label=best?`${best.rank}º de ${best.count}`:"Sin puesto";
  if(els.profileBestRank)els.profileBestRank.textContent=label;
  if(els.recordBestRank)els.recordBestRank.textContent=label;
  if(els.recordBestRankEvent)els.recordBestRankEvent.textContent=best?.eventName||"Sin clasificación";
}

async function loadEvents(app){
  setStatus("Consultando tus carreras…");if(els.retry)els.retry.style.display="none";functions=functions||getFunctions(app,REGION);
  const activeCall=httpsCallable(functions,"getRunnerLiveEvents"),historyCall=httpsCallable(functions,"getRunnerHistory");
  try{
    const [activeResult,historyResult]=await withTimeout(Promise.all([activeCall({clientVersion:VERSION}),historyCall({clientVersion:VERSION,limit:100})]),18000,"La consulta de tus carreras tardó demasiado.");
    const activeRaw=Array.isArray(activeResult?.data?.events)?activeResult.data.events:[];
    historyRows=Array.isArray(historyResult?.data?.results)?historyResult.data.results:[];
    const historical=historyEventIdSet();
    for(const eventId of historical)completedEventIds.delete(eventId);
    activeRows=activeRaw.filter(ev=>["published","live"].includes(String(ev?.status||"").toLowerCase())&&!historical.has(String(ev?.eventId||""))&&!completedEventIds.has(String(ev?.eventId||"")));
    renderActiveEvents(activeRows);renderHistory(true);renderDashboard();renderProfileStats();bindActiveEventRealtime(app);
    const total=activeRows.length+historyRows.length;
    if(total)setStatus(`${activeRows.length} activa${activeRows.length===1?"":"s"} · ${historyRows.length} en histórico`,`ok`);else setStatus("No encontramos carreras asociadas a esta cuenta.","ok");
  }catch(error){console.error("[MILITOPO runner events]",error);const code=String(error?.code||""),msg=String(error?.message||"No se pudieron consultar tus carreras.");setStatus(`${msg}${code?` (${code})`:""}`,"err");if(els.retry)els.retry.style.display="block";}
}

function schedulePostRaceRefresh(eventId){
  const id=String(eventId||"").trim();if(id)completedEventIds.add(id);
  if(id){activeRows=activeRows.filter(row=>String(row.eventId||"")!==id);renderActiveEvents(activeRows);renderDashboard();if(currentApp)bindActiveEventRealtime(currentApp);}
  if(postRaceRefreshTimer)clearTimeout(postRaceRefreshTimer);
  let attempts=0;
  const refresh=async()=>{attempts++;if(!currentApp)return;try{await loadEvents(currentApp);}catch(_){}const found=!id||historyRows.some(row=>String(row.eventId||"")===id);if(!found&&attempts<3)postRaceRefreshTimer=setTimeout(refresh,attempts===1?1400:2600);};
  postRaceRefreshTimer=setTimeout(refresh,550);
}

async function boot(){try{const app=await initFirebase();currentApp=app;updateConnectivity();const user=await waitForUser();if(!user)throw new Error("No hay una sesión iniciada. Vuelve a la pantalla de acceso.");currentUser=user;if(!user.emailVerified)throw new Error("Tu correo todavía no está verificado.");await loadProfile(app,user);startInvitationRealtime(app);await loadEvents(app);}catch(error){console.error("[MILITOPO runner boot]",error);text(els.name,"No se pudo cargar tu cuenta");text(els.meta,"La sesión o Firebase no respondieron correctamente.");setStatus(String(error?.message||error),"err");if(els.retry)els.retry.style.display="block";}}

els.photoBtn?.addEventListener("click",openRunnerPhotoMenu);
els.detailsBtn?.addEventListener("click",()=>{els.details?.classList.toggle("show");if(els.detailsBtn)els.detailsBtn.textContent=els.details?.classList.contains("show")?"OCULTAR DATOS":"VER DATOS DE CUENTA";});
els.logoutBtn?.addEventListener("click",async()=>{stopInvitationRealtime();stopActiveEventRealtime();try{globalThis.MILITOPO_V2_AUTH=null;}catch(_){}try{if(auth)await signOut(auth);}catch(_){}location.replace("../../");});
els.retry?.addEventListener("click",()=>{const app=findApp();if(app)loadEvents(app);});
els.historyMore?.addEventListener("click",()=>{historyVisible+=HISTORY_PAGE;renderHistory(false);});
document.querySelectorAll("[data-history-filter]").forEach(btn=>btn.addEventListener("click",()=>{historyFilter=String(btn.dataset.historyFilter||"all");historyVisible=HISTORY_PAGE;document.querySelectorAll("[data-history-filter]").forEach(node=>node.classList.toggle("is-active",node===btn));renderHistory(false);}));
els.resultClose?.addEventListener("click",closeResultModal);
els.resultModal?.addEventListener("click",event=>{if(event.target===els.resultModal)closeResultModal();});
els.raceClose?.addEventListener("click",closeRaceModal);
els.raceModal?.addEventListener("click",event=>{if(event.target===els.raceModal)closeRaceModal();});
document.addEventListener("keydown",event=>{if(event.key==="Escape"){closeResultModal();closeRaceModal();}});
document.querySelectorAll("[data-runner-tab]").forEach(button=>button.addEventListener("click",()=>setMainTab(button.dataset.runnerTab||"home")));
document.querySelectorAll("[data-go-tab]").forEach(button=>button.addEventListener("click",()=>setMainTab(button.dataset.goTab||"home")));
document.querySelectorAll("[data-race-tab]").forEach(button=>button.addEventListener("click",()=>setRaceTab(button.dataset.raceTab)));
els.profileHistoryBtn?.addEventListener("click",()=>{setMainTab("races");setRaceTab("history");});
document.querySelectorAll("[data-profile-tab]").forEach(button=>button.addEventListener("click",()=>{const tab=button.dataset.profileTab||"summary";document.querySelectorAll("[data-profile-tab]").forEach(b=>b.classList.toggle("is-active",b===button));document.querySelectorAll("[data-profile-panel]").forEach(panel=>panel.classList.toggle("is-active",panel.dataset.profilePanel===tab));if(tab==="performance")renderPerformance();}));
window.addEventListener("militopo:v2-race-participant",event=>{const detail=event?.detail||{},status=String(detail.status||detail.participant?.status||"").toLowerCase();if(status!=="finished")return;const eventId=String(detail.event?.eventId||detail.event?.id||"");schedulePostRaceRefresh(eventId);});
window.addEventListener("militopo:v2-runner-race-closed",event=>{const detail=event?.detail||{},status=String(detail.status||"").toLowerCase();if(status!=="finished")return;const eventId=String(detail.event?.eventId||detail.event?.id||"");schedulePostRaceRefresh(eventId);setMainTab("home");});
window.addEventListener("online",()=>{updateConnectivity();if(currentApp)scheduleActiveRefresh(currentApp,120);});
window.addEventListener("offline",updateConnectivity);
window.addEventListener("focus",()=>{if(currentApp&&Date.now()-lastActiveRefreshAt>4000)scheduleActiveRefresh(currentApp,120);});
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"&&currentApp&&Date.now()-lastActiveRefreshAt>4000)scheduleActiveRefresh(currentApp,120);});

boot();
