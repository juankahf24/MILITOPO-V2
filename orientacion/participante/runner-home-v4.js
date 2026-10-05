/* MILITOPO V2 · R5B · Área corredor: carreras activas + histórico. */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  initializeAuth,
  getAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";

const VERSION="v2-r5b-runner-races-history-20261005";
const REGION="europe-west1";
const APP_NAME="militopo-v2";

window.__MILITOPO_RUNNER_HOME_V4_BOOTED=true;
try{clearTimeout(window.__MILITOPO_RUNNER_HOME_V4_WATCHDOG);}catch(_){ }

const els={
  name:document.getElementById("rhName"),
  meta:document.getElementById("rhMeta"),
  avatar:document.getElementById("rhAvatar"),
  detailsBtn:document.getElementById("rhDetailsBtn"),
  logoutBtn:document.getElementById("rhLogoutBtn"),
  details:document.getElementById("rhDetails"),
  status:document.getElementById("rhStatus"),
  activeEvents:document.getElementById("rhActiveEvents"),
  historyEvents:document.getElementById("rhHistoryEvents"),
  activeCount:document.getElementById("rhActiveCount"),
  historyCount:document.getElementById("rhHistoryCount"),
  retry:document.getElementById("rhRetry")
};

let auth=null;
let currentUser=null;
let profile=null;
let currentRaceTab="active";

function text(el,v){if(el)el.textContent=String(v??"");}
function esc(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function setStatus(message,type=""){text(els.status,message);if(els.status)els.status.className=`status${type?` ${type}`:""}`;}
function initials(name){const p=String(name||"").trim().split(/\s+/).filter(Boolean);return ((p[0]?.[0]||"")+(p[1]?.[0]||"")).toUpperCase()||"R";}
function withTimeout(promise,ms,label){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(label||"TIMEOUT")),ms))]);}
function config(){
  const cfg=globalThis.MILITOPO_V2_CONFIG;
  if(!cfg?.configured||!cfg.firebase?.apiKey)throw new Error("La configuración Firebase V2 no está disponible.");
  return cfg.firebase;
}
function findApp(){return getApps().find(a=>a.name===APP_NAME)||null;}
function initFirebase(){
  setStatus("Inicializando tu sesión MILITOPO…");
  const app=findApp()||initializeApp(config(),APP_NAME);
  try{auth=initializeAuth(app,{persistence:[indexedDBLocalPersistence,browserLocalPersistence,browserSessionPersistence]});}
  catch(error){if(String(error?.code||"").includes("already-initialized"))auth=getAuth(app);else throw error;}
  return app;
}
async function waitForUser(){
  setStatus("Recuperando tu sesión MILITOPO…");
  if(auth.currentUser)return auth.currentUser;
  return withTimeout(new Promise((resolve,reject)=>{
    let finished=false;
    const stop=onAuthStateChanged(auth,user=>{if(finished)return;finished=true;try{stop();}catch(_){}resolve(user);},error=>{if(finished)return;finished=true;try{stop();}catch(_){}reject(error);});
  }),10000,"No se detectó una sesión activa en este dispositivo.");
}
async function loadProfile(app,user){
  const db=getFirestore(app);let data={};
  try{const snap=await withTimeout(getDoc(doc(db,"users",user.uid)),8000,"El perfil tardó demasiado en responder.");if(snap.exists())data=snap.data()||{};}
  catch(error){console.warn("[MILITOPO runner home profile]",error);}
  profile=data;
  const displayName=String(data.displayName||user.displayName||user.email||"Corredor").trim();
  const username=String(data.usernameKey||data.username||"").trim().toLowerCase();
  text(els.name,displayName);
  text(els.meta,`${username?`@${username} · `:""}CORREDOR · ${user.email||""}`);
  text(els.avatar,initials(displayName));
  if(els.detailsBtn)els.detailsBtn.disabled=false;
  if(els.logoutBtn)els.logoutBtn.disabled=false;
  if(els.details)els.details.innerHTML=`<strong>Nombre:</strong> ${esc(displayName)}<br><strong>Usuario:</strong> ${username?`@${esc(username)}`:"Sin usuario"}<br><strong>Correo:</strong> ${esc(user.email||"")}<br><strong>Rol:</strong> CORREDOR`;
}
function statusES(s){return ({draft:"BORRADOR",prepared:"PREPARADO",published:"PUBLICADO",live:"EN DIRECTO",finished:"FINALIZADO",archived:"ARCHIVADO",incomplete:"INCOMPLETA",not_started:"NO SALIÓ"})[String(s||"").toLowerCase()]||String(s||"").toUpperCase();}
function formatDuration(ms){
  const n=Number(ms);if(!Number.isFinite(n)||n<0)return "—";
  const total=Math.round(n/1000),h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;
  return h>0?`${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${m}:${String(s).padStart(2,"0")}`;
}
function formatDate(ms){const n=Number(ms);if(!Number.isFinite(n)||n<=0)return "";try{return new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(n));}catch(_){return "";}}
function setRaceTab(tab){
  currentRaceTab=tab==="history"?"history":"active";
  document.querySelectorAll("[data-race-tab]").forEach(btn=>btn.classList.toggle("is-active",btn.dataset.raceTab===currentRaceTab));
  document.querySelectorAll("[data-race-panel]").forEach(panel=>panel.classList.toggle("is-active",panel.dataset.racePanel===currentRaceTab));
}
function renderActiveEvents(events){
  const list=els.activeEvents;if(!list)return;
  list.innerHTML="";text(els.activeCount,events.length);
  if(!events.length){list.innerHTML='<div class="empty-card"><strong>Sin carreras activas</strong><span>No tienes carreras preparadas, publicadas o en directo ahora mismo.</span></div>';return;}
  list.innerHTML=events.map(ev=>{
    const state=String(ev.status||"").toLowerCase();
    const live=state==="live"&&String(ev.liveRunId||"").trim();
    const waiting=state==="prepared"?"Preparada. Pendiente de publicación.":state==="published"?"Publicada. Esperando el inicio.":"Carrera en directo.";
    const action=live?`<button class="btn primary" type="button" data-enter-event="${esc(ev.eventId)}">ENTRAR EN LA CARRERA</button>`:`<div class="waiting">${esc(waiting)}</div>`;
    return `<article class="event"><div class="event-top"><strong>${esc(ev.eventName||"Carrera")}</strong><span class="pill">${esc(statusES(ev.status))}</span></div><div class="event-meta">${esc(ev.participantId||"")}${ev.routeId?` · ${esc(ev.routeId)}`:""}</div>${action}</article>`;
  }).join("");
  list.querySelectorAll("[data-enter-event]").forEach(btn=>btn.addEventListener("click",()=>{
    const id=String(btn.dataset.enterEvent||"");const url=new URL("runner.html",location.href);url.searchParams.set("app","1");url.searchParams.set("event",id);location.href=url.href;
  }));
}
function renderHistory(rows){
  const list=els.historyEvents;if(!list)return;
  list.innerHTML="";text(els.historyCount,rows.length);
  if(!rows.length){list.innerHTML='<div class="empty-card"><strong>Sin histórico todavía</strong><span>Cuando finalices una carrera aparecerá aquí.</span></div>';return;}
  list.innerHTML=rows.map(row=>{
    const resultStatus=statusES(row.status);
    const date=formatDate(row.finishedAtMs||row.startedAtMs||row.consolidatedAtMs);
    const official=row.officialDurationMs==null?"—":formatDuration(row.officialDurationMs);
    const distance=Number(row.trackDistanceM||0)>0?`${(Number(row.trackDistanceM)/1000).toFixed(2)} km`:"—";
    return `<article class="event history-event"><div class="event-top"><strong>${esc(row.eventName||"Carrera")}</strong><span class="pill muted-pill">${esc(resultStatus)}</span></div><div class="history-grid"><div><small>TIEMPO OFICIAL</small><b>${esc(official)}</b></div><div><small>DISTANCIA</small><b>${esc(distance)}</b></div></div><div class="event-meta">${date?esc(date):esc(statusES(row.eventStatus))}</div></article>`;
  }).join("");
}
async function loadEvents(app){
  setStatus("Consultando tus carreras…");if(els.retry)els.retry.style.display="none";
  const functions=getFunctions(app,REGION);
  const activeCall=httpsCallable(functions,"getRunnerLiveEvents");
  const historyCall=httpsCallable(functions,"getRunnerHistory");
  try{
    const [activeResult,historyResult]=await withTimeout(Promise.all([
      activeCall({clientVersion:VERSION}),
      historyCall({clientVersion:VERSION,limit:100})
    ]),18000,"La consulta de tus carreras tardó demasiado.");
    const active=Array.isArray(activeResult?.data?.events)?activeResult.data.events:[];
    const history=Array.isArray(historyResult?.data?.results)?historyResult.data.results:[];
    renderActiveEvents(active);renderHistory(history);
    const total=active.length+history.length;
    if(total){setStatus(`Tienes ${active.length} activa${active.length===1?"":"s"} y ${history.length} en el histórico.`,"ok");}
    else setStatus("No encontramos carreras asociadas a esta cuenta.","ok");
    if(!active.length&&history.length)setRaceTab("history");
  }catch(error){
    console.error("[MILITOPO runner home events]",error);
    const code=String(error?.code||"");const msg=String(error?.message||"No se pudieron consultar tus carreras.");
    setStatus(`⚠️ ${msg}${code?` (${code})`:""}`,"err");if(els.retry)els.retry.style.display="block";
  }
}
async function boot(){
  try{const app=initFirebase();const user=await waitForUser();if(!user)throw new Error("No hay una sesión iniciada. Vuelve a la pantalla de acceso.");currentUser=user;if(!user.emailVerified)throw new Error("Tu correo todavía no está verificado.");await loadProfile(app,user);await loadEvents(app);}
  catch(error){console.error("[MILITOPO runner home boot]",error);text(els.name,"No se pudo cargar tu cuenta");text(els.meta,"La sesión o Firebase no respondieron correctamente.");setStatus(`⚠️ ${String(error?.message||error)}`,"err");if(els.retry)els.retry.style.display="block";}
}

els.detailsBtn?.addEventListener("click",()=>{els.details?.classList.toggle("show");if(els.detailsBtn)els.detailsBtn.textContent=els.details?.classList.contains("show")?"OCULTAR DATOS":"VER DATOS DE CUENTA";});
els.logoutBtn?.addEventListener("click",async()=>{try{if(auth)await signOut(auth);}catch(_){}location.replace("../../");});
els.retry?.addEventListener("click",()=>loadEvents(findApp()));
document.querySelectorAll("[data-runner-tab]").forEach(button=>button.addEventListener("click",()=>{const tab=button.dataset.runnerTab||"races";document.querySelectorAll("[data-runner-tab]").forEach(btn=>btn.classList.toggle("is-active",btn===button));document.querySelectorAll("[data-runner-panel]").forEach(panel=>panel.classList.toggle("is-active",panel.dataset.runnerPanel===tab));}));
document.querySelectorAll("[data-race-tab]").forEach(button=>button.addEventListener("click",()=>setRaceTab(button.dataset.raceTab)));

boot();
