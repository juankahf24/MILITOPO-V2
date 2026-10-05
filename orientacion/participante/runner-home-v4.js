/* MILITOPO V2 · R5C · Dashboard profesional del corredor + resultados enriquecidos. */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  initializeAuth,getAuth,indexedDBLocalPersistence,browserLocalPersistence,browserSessionPersistence,
  onAuthStateChanged,signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";

const VERSION="v2-r5c-dashboard-profesional-20261005";
const REGION="europe-west1";
const APP_NAME="militopo-v2";
const HISTORY_PAGE=6;

window.__MILITOPO_RUNNER_HOME_V4_BOOTED=true;
try{clearTimeout(window.__MILITOPO_RUNNER_HOME_V4_WATCHDOG);}catch(_){ }

const els={
  name:document.getElementById("rhName"),meta:document.getElementById("rhMeta"),avatar:document.getElementById("rhAvatar"),
  detailsBtn:document.getElementById("rhDetailsBtn"),logoutBtn:document.getElementById("rhLogoutBtn"),details:document.getElementById("rhDetails"),
  status:document.getElementById("rhStatus"),activeEvents:document.getElementById("rhActiveEvents"),historyEvents:document.getElementById("rhHistoryEvents"),
  activeCount:document.getElementById("rhActiveCount"),historyCount:document.getElementById("rhHistoryCount"),retry:document.getElementById("rhRetry"),
  headerUser:document.getElementById("rhHeaderUser"),headerHandle:document.getElementById("rhHeaderHandle"),hero:document.getElementById("rhDashboardHero"),
  dashActive:document.getElementById("rhDashActive"),dashFinished:document.getElementById("rhDashFinished"),dashTotal:document.getElementById("rhDashTotal"),dashKm:document.getElementById("rhDashKm"),
  historyMore:document.getElementById("rhHistoryMore"),resultModal:document.getElementById("rhResultModal"),resultTitle:document.getElementById("rhResultTitle"),resultBody:document.getElementById("rhResultBody"),resultClose:document.getElementById("rhResultClose")
};

let auth=null,currentUser=null,profile=null,currentRaceTab="active",currentMainTab="home";
let functions=null,historyRows=[],activeRows=[],historyVisible=HISTORY_PAGE;
const classificationCache=new Map();

function text(el,v){if(el)el.textContent=String(v??"");}
function esc(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function setStatus(message,type=""){text(els.status,message);if(els.status)els.status.className=`status${type?` ${type}`:""}`;}
function initials(name){const p=String(name||"").trim().split(/\s+/).filter(Boolean);return ((p[0]?.[0]||"")+(p[1]?.[0]||"")).toUpperCase()||"M";}
function withTimeout(promise,ms,label){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(label||"TIMEOUT")),ms))]);}
function config(){const cfg=globalThis.MILITOPO_V2_CONFIG;if(!cfg?.configured||!cfg.firebase?.apiKey)throw new Error("La configuración Firebase V2 no está disponible.");return cfg.firebase;}
function findApp(){return getApps().find(a=>a.name===APP_NAME)||null;}
function initFirebase(){setStatus("Inicializando tu sesión MILITOPO…");const app=findApp()||initializeApp(config(),APP_NAME);try{auth=initializeAuth(app,{persistence:[indexedDBLocalPersistence,browserLocalPersistence,browserSessionPersistence]});}catch(error){if(String(error?.code||"").includes("already-initialized"))auth=getAuth(app);else throw error;}functions=getFunctions(app,REGION);return app;}
async function waitForUser(){setStatus("Recuperando tu sesión MILITOPO…");if(auth.currentUser)return auth.currentUser;return withTimeout(new Promise((resolve,reject)=>{let finished=false;const stop=onAuthStateChanged(auth,user=>{if(finished)return;finished=true;try{stop();}catch(_){}resolve(user);},error=>{if(finished)return;finished=true;try{stop();}catch(_){}reject(error);});}),10000,"No se detectó una sesión activa en este dispositivo.");}

async function loadProfile(app,user){
  const db=getFirestore(app);let data={};
  try{const snap=await withTimeout(getDoc(doc(db,"users",user.uid)),8000,"El perfil tardó demasiado en responder.");if(snap.exists())data=snap.data()||{};}catch(error){console.warn("[MILITOPO runner profile]",error);}
  profile=data;
  const displayName=String(data.displayName||user.displayName||user.email||"Usuario").trim();
  const username=String(data.usernameKey||data.username||"").trim().toLowerCase().replace(/^@/,"");
  text(els.name,displayName);text(els.headerUser,displayName);text(els.headerHandle,username?`@${username}`:"");text(els.meta,`${username?`@${username} · `:""}${user.email||""}`);text(els.avatar,initials(displayName));
  if(els.detailsBtn)els.detailsBtn.disabled=false;if(els.logoutBtn)els.logoutBtn.disabled=false;
  if(els.details)els.details.innerHTML=`<strong>Nombre:</strong> ${esc(displayName)}<br><strong>Usuario:</strong> ${username?`@${esc(username)}`:"Sin usuario"}<br><strong>Correo:</strong> ${esc(user.email||"")}<br><strong>Rol:</strong> CORREDOR`;
}

function statusES(s){return ({draft:"BORRADOR",prepared:"PREPARADO",published:"PUBLICADA",live:"EN DIRECTO",finished:"FINALIZADA",archived:"ARCHIVADA",incomplete:"INCOMPLETA",not_started:"NO SALIÓ"})[String(s||"").toLowerCase()]||String(s||"").toUpperCase();}
function formatDuration(ms){const n=Number(ms);if(!Number.isFinite(n)||n<0)return "—";const total=Math.round(n/1000),h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;return h>0?`${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${m}:${String(s).padStart(2,"0")}`;}
function formatDate(ms){const n=Number(ms);if(!Number.isFinite(n)||n<=0)return "";try{return new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(n));}catch(_){return "";}}
function formatKm(m){const n=Number(m);return Number.isFinite(n)&&n>0?`${(n/1000).toFixed(2)} km`:"0.00 km";}
function formatPenalty(ms){const n=Math.max(0,Number(ms||0));return n>0?`+${formatDuration(n)}`:"0:00";}
function stateClass(s){const v=String(s||"").toLowerCase();return ["live","published","finished","incomplete","not_started"].includes(v)?v:"";}
function metric(label,value){return `<div class="metric"><small>${esc(label)}</small><b>${esc(value)}</b></div>`;}

function setMainTab(tab){
  currentMainTab=["home","races","profile"].includes(tab)?tab:"home";
  document.querySelectorAll("[data-runner-tab]").forEach(btn=>btn.classList.toggle("is-active",btn.dataset.runnerTab===currentMainTab));
  document.querySelectorAll("[data-runner-panel]").forEach(panel=>panel.classList.toggle("is-active",panel.dataset.runnerPanel===currentMainTab));
  window.scrollTo({top:0,behavior:"auto"});
}
function setRaceTab(tab){
  currentRaceTab=tab==="history"?"history":"active";
  document.querySelectorAll("[data-race-tab]").forEach(btn=>btn.classList.toggle("is-active",btn.dataset.raceTab===currentRaceTab));
  document.querySelectorAll("[data-race-panel]").forEach(panel=>panel.classList.toggle("is-active",panel.dataset.racePanel===currentRaceTab));
  if(currentRaceTab==="history")hydrateVisibleRanks();
}

function enterRace(eventId){const id=String(eventId||"");if(!id)return;const url=new URL("runner.html",location.href);url.searchParams.set("app","1");url.searchParams.set("event",id);location.href=url.href;}

function renderActiveEvents(events){
  const list=els.activeEvents;if(!list)return;list.innerHTML="";text(els.activeCount,events.length);
  if(!events.length){list.innerHTML='<div class="empty-card"><strong>Sin carreras activas</strong><span>Cuando una carrera esté PUBLICADA o EN DIRECTO aparecerá aquí.</span></div>';return;}
  list.innerHTML=events.map(ev=>{
    const state=String(ev.status||"").toLowerCase(),live=state==="live"&&String(ev.liveRunId||"").trim();
    const assignment=[ev.participantId,ev.routeId].filter(Boolean).map(x=>`<span>${esc(x)}</span>`).join("");
    const action=live?`<button class="btn primary" type="button" data-enter-event="${esc(ev.eventId)}">ENTRAR EN LA CARRERA</button>`:`<div class="waiting">Tu plaza está preparada. El acceso se habilitará cuando la organización inicie la carrera.</div>`;
    return `<article class="event" data-state="${esc(stateClass(state))}"><div class="event-top"><div class="event-title-wrap"><strong class="event-title">${esc(ev.eventName||"Carrera")}</strong><span class="event-date">${state==="live"?"Carrera en curso":"Esperando inicio"}</span></div><span class="pill ${esc(stateClass(state))}">${esc(statusES(state))}</span></div>${assignment?`<div class="assignment">${assignment}</div>`:""}${action}</article>`;
  }).join("");
  list.querySelectorAll("[data-enter-event]").forEach(btn=>btn.addEventListener("click",()=>enterRace(btn.dataset.enterEvent)));
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
  return `<article class="event history-event" data-state="${esc(stateClass(state))}" data-history-event="${esc(row.eventId)}"><div class="event-top"><div class="event-title-wrap"><strong class="event-title">${esc(row.eventName||"Carrera")}</strong><span class="event-date">${esc(date||statusES(row.eventStatus))}</span></div><span class="pill ${esc(stateClass(state))}">${esc(statusES(state))}</span></div><div class="result-hero">${primary}${secondary}</div>${rank}<div class="history-metrics">${metrics}</div><div class="history-actions"><button class="btn secondary" type="button" data-result-detail="${esc(row.eventId)}" data-result-name="${esc(row.eventName||"Carrera")}">VER RESULTADO</button></div></article>`;
}

function renderHistory(reset=false){
  const list=els.historyEvents;if(!list)return;if(reset)historyVisible=HISTORY_PAGE;text(els.historyCount,historyRows.length);
  const visible=historyRows.slice(0,historyVisible);list.innerHTML=visible.length?visible.map(historyCard).join(""):'<div class="empty-card"><strong>Sin histórico todavía</strong><span>Cuando finalices una carrera, tus resultados aparecerán aquí.</span></div>';
  if(els.historyMore){els.historyMore.style.display=historyVisible<historyRows.length?"block":"none";els.historyMore.textContent=`MOSTRAR MÁS RESULTADOS (${historyRows.length-historyVisible})`;}
  list.querySelectorAll("[data-result-detail]").forEach(btn=>btn.addEventListener("click",()=>openResultDetail(btn.dataset.resultDetail,btn.dataset.resultName)));
  hydrateVisibleRanks();
}

async function getClassification(eventId){
  if(classificationCache.has(eventId))return classificationCache.get(eventId);
  const promise=(async()=>{const call=httpsCallable(functions,"getEventClassification");const result=await call({eventId,clientVersion:VERSION});return result?.data||{};})();
  classificationCache.set(eventId,promise);try{return await promise;}catch(error){classificationCache.delete(eventId);throw error;}
}
async function hydrateVisibleRanks(){
  const nodes=[...document.querySelectorAll("[data-rank-event]")];
  await Promise.allSettled(nodes.map(async node=>{
    const eventId=String(node.dataset.rankEvent||"");if(!eventId||node.dataset.loaded==="1")return;node.dataset.loaded="1";
    try{const data=await getClassification(eventId),my=data?.my;if(!my){node.classList.remove("loading");node.querySelector("strong").textContent="Sin puesto";return;}
      const rank=my.generalRank?`${my.generalRank}.º de ${my.generalRankedCount||my.generalCount||"—"}`:"Sin puesto";
      const route=my.routeId&&my.routeRank?` · ${my.routeId}: ${my.routeRank}.º`:my.routeId?` · ${my.routeId}`:"";
      node.classList.remove("loading");node.querySelector("strong").textContent=`${rank}${route}`;
    }catch(_){node.classList.remove("loading");node.querySelector("strong").textContent="No disponible";}
  }));
}

function renderDashboard(){
  const total=historyRows.length,finished=historyRows.filter(r=>String(r.status||"").toLowerCase()==="finished").length,totalKm=historyRows.reduce((sum,r)=>sum+Math.max(0,Number(r.trackDistanceM||0)),0)/1000;
  text(els.dashActive,activeRows.length);text(els.dashFinished,finished);text(els.dashTotal,total);text(els.dashKm,totalKm>0?totalKm.toFixed(totalKm>=100?0:1):"0");
  const live=activeRows.find(r=>String(r.status||"").toLowerCase()==="live"&&String(r.liveRunId||"").trim()),published=activeRows.find(r=>String(r.status||"").toLowerCase()==="published"),latest=historyRows[0];
  if(live){els.hero.innerHTML=`<div><div class="hero-kicker">CARRERA EN DIRECTO</div><h2 class="hero-title">${esc(live.eventName||"Carrera")}</h2><div class="hero-sub">${esc([live.participantId,live.routeId].filter(Boolean).join(" · ")||"Tu carrera está lista")}</div></div><div class="hero-footer"><span class="hero-badge live">● EN DIRECTO</span><button class="hero-btn" type="button" data-hero-enter="${esc(live.eventId)}">ENTRAR</button></div>`;els.hero.querySelector("[data-hero-enter]")?.addEventListener("click",()=>enterRace(live.eventId));return;}
  if(published){els.hero.innerHTML=`<div><div class="hero-kicker">PRÓXIMA CARRERA</div><h2 class="hero-title">${esc(published.eventName||"Carrera")}</h2><div class="hero-sub">${esc([published.participantId,published.routeId].filter(Boolean).join(" · ")||"Tu plaza está confirmada")}. Esperando el inicio de la organización.</div></div><div class="hero-footer"><span class="hero-badge published">PUBLICADA</span><button class="hero-btn" type="button" data-hero-races>VER CARRERAS</button></div>`;els.hero.querySelector("[data-hero-races]")?.addEventListener("click",()=>{setMainTab("races");setRaceTab("active");});return;}
  if(latest){const state=String(latest.status||"").toLowerCase(),official=latest.officialDurationMs==null?"":formatDuration(latest.officialDurationMs);els.hero.innerHTML=`<div><div class="hero-kicker">ÚLTIMO RESULTADO</div><h2 class="hero-title">${esc(latest.eventName||"Carrera")}</h2><div class="hero-sub">${esc(statusES(state))}${official?` · Tiempo oficial ${esc(official)}`:""}${Number(latest.trackDistanceM||0)>0?` · ${esc(formatKm(latest.trackDistanceM))}`:""}</div></div><div class="hero-footer"><span class="hero-badge">${esc(formatDate(latest.finishedAtMs||latest.startedAtMs||latest.consolidatedAtMs)||"HISTÓRICO")}</span><button class="hero-btn" type="button" data-hero-history>VER RESULTADO</button></div>`;els.hero.querySelector("[data-hero-history]")?.addEventListener("click",()=>{setMainTab("races");setRaceTab("history");});return;}
  els.hero.innerHTML='<div><div class="hero-kicker">MILITOPO</div><h2 class="hero-title">Tu próxima carrera aparecerá aquí</h2><div class="hero-sub">Cuando aceptes una invitación publicada, tendrás acceso desde esta pantalla.</div></div><div class="hero-footer"><span class="hero-badge">SIN CARRERAS</span></div>';
}

function closeResultModal(){els.resultModal?.classList.remove("is-open");els.resultModal?.setAttribute("aria-hidden","true");}
async function openResultDetail(eventId,eventName){
  if(!eventId||!functions)return;text(els.resultTitle,eventName||"Resultado");if(els.resultBody)els.resultBody.innerHTML='<div class="status">Cargando resultado oficial…</div>';els.resultModal?.classList.add("is-open");els.resultModal?.setAttribute("aria-hidden","false");
  try{
    const detailCall=httpsCallable(functions,"getRunnerResultDetail");
    const [detailRes,classRes]=await Promise.all([detailCall({eventId,clientVersion:VERSION}),getClassification(eventId).catch(()=>null)]);
    const d=detailRes?.data||{},r=d.result||{},my=classRes?.my||null,state=String(r.status||"not_started").toLowerCase();
    const generalRank=my?.generalRank?`${my.generalRank}.º / ${my.generalRankedCount||my.generalCount||"—"}`:"SIN PUESTO";
    const routeRank=my?.routeId&&my?.routeRank?`${my.routeId} · ${my.routeRank}.º / ${my.routeRankedCount||my.routeCount||"—"}`:(my?.routeId||r.courseId||"—");
    const controls=Number(r.controlExpectedCount||0)>0?`${Math.max(0,Number(r.controlDetectedCount||0))}/${Math.max(0,Number(r.controlExpectedCount||0))}`:"—";
    const boxes=[
      ["TIEMPO OFICIAL",r.officialDurationMs==null?"—":formatDuration(r.officialDurationMs)],
      ["TIEMPO REAL",r.durationMs==null?"—":formatDuration(r.durationMs)],
      ["PENALIZACIÓN",formatPenalty(r.penaltyMs)],
      ["DISTANCIA",Number(r.trackDistanceM||0)>0?formatKm(r.trackDistanceM):"—"],
      ["RECORRIDO",routeRank],
      ["CONTROLES",controls],
      ["PENDIENTES",String(Math.max(0,Number(r.pendingControlCount||0)))],
      ["DESCARTADOS",String(Math.max(0,Number(r.discardedControlCount||0)))],
      ["DESNIVEL +",Number.isFinite(Number(r.coursePositiveM))?`${Math.round(Number(r.coursePositiveM))} m`:"—"],
      ["RITMO",Number.isFinite(Number(r.paceMinKm))?`${Number(r.paceMinKm).toFixed(2)} min/km`:"—"]
    ];
    if(els.resultBody)els.resultBody.innerHTML=`<div class="detail-status"><div><small>RESULTADO</small><strong>${esc(statusES(state))}</strong></div><strong class="detail-rank">${esc(generalRank)}</strong></div><div class="detail-grid">${boxes.map(([a,b])=>`<div class="detail-box"><small>${esc(a)}</small><strong>${esc(b)}</strong></div>`).join("")}</div><div class="detail-note">El reproductor GPS completo, mapa histórico y estadísticas avanzadas se integran en la siguiente fase de análisis del corredor.</div>`;
  }catch(error){console.error("[MILITOPO runner result detail]",error);if(els.resultBody)els.resultBody.innerHTML=`<div class="status err">No se pudo cargar este resultado. ${esc(error?.message||"")}</div>`;}
}

async function loadEvents(app){
  setStatus("Consultando tus carreras…");if(els.retry)els.retry.style.display="none";functions=functions||getFunctions(app,REGION);
  const activeCall=httpsCallable(functions,"getRunnerLiveEvents"),historyCall=httpsCallable(functions,"getRunnerHistory");
  try{
    const [activeResult,historyResult]=await withTimeout(Promise.all([activeCall({clientVersion:VERSION}),historyCall({clientVersion:VERSION,limit:100})]),18000,"La consulta de tus carreras tardó demasiado.");
    const activeRaw=Array.isArray(activeResult?.data?.events)?activeResult.data.events:[];
    activeRows=activeRaw.filter(ev=>["published","live"].includes(String(ev?.status||"").toLowerCase()));
    historyRows=Array.isArray(historyResult?.data?.results)?historyResult.data.results:[];
    renderActiveEvents(activeRows);renderHistory(true);renderDashboard();
    const total=activeRows.length+historyRows.length;
    if(total)setStatus(`${activeRows.length} activa${activeRows.length===1?"":"s"} · ${historyRows.length} en histórico`,`ok`);else setStatus("No encontramos carreras asociadas a esta cuenta.","ok");
  }catch(error){console.error("[MILITOPO runner events]",error);const code=String(error?.code||""),msg=String(error?.message||"No se pudieron consultar tus carreras.");setStatus(`${msg}${code?` (${code})`:""}`,"err");if(els.retry)els.retry.style.display="block";}
}

async function boot(){try{const app=initFirebase(),user=await waitForUser();if(!user)throw new Error("No hay una sesión iniciada. Vuelve a la pantalla de acceso.");currentUser=user;if(!user.emailVerified)throw new Error("Tu correo todavía no está verificado.");await loadProfile(app,user);await loadEvents(app);}catch(error){console.error("[MILITOPO runner boot]",error);text(els.name,"No se pudo cargar tu cuenta");text(els.meta,"La sesión o Firebase no respondieron correctamente.");setStatus(String(error?.message||error),"err");if(els.retry)els.retry.style.display="block";}}

els.detailsBtn?.addEventListener("click",()=>{els.details?.classList.toggle("show");if(els.detailsBtn)els.detailsBtn.textContent=els.details?.classList.contains("show")?"OCULTAR DATOS":"VER DATOS DE CUENTA";});
els.logoutBtn?.addEventListener("click",async()=>{try{if(auth)await signOut(auth);}catch(_){}location.replace("../../");});
els.retry?.addEventListener("click",()=>{const app=findApp();if(app)loadEvents(app);});
els.historyMore?.addEventListener("click",()=>{historyVisible+=HISTORY_PAGE;renderHistory(false);});
els.resultClose?.addEventListener("click",closeResultModal);
els.resultModal?.addEventListener("click",event=>{if(event.target===els.resultModal)closeResultModal();});
document.addEventListener("keydown",event=>{if(event.key==="Escape")closeResultModal();});
document.querySelectorAll("[data-runner-tab]").forEach(button=>button.addEventListener("click",()=>setMainTab(button.dataset.runnerTab||"home")));
document.querySelectorAll("[data-go-tab]").forEach(button=>button.addEventListener("click",()=>setMainTab(button.dataset.goTab||"home")));
document.querySelectorAll("[data-race-tab]").forEach(button=>button.addEventListener("click",()=>setRaceTab(button.dataset.raceTab)));

boot();
