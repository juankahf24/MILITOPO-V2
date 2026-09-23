/* MILITOPO V2 · F3A · Home Runner V4.
   Compatibilidad móvil: usa imports ESM estáticos (igual que el login principal)
   y elimina los import() dinámicos desde gstatic que fallaban en algunos navegadores. */
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

const VERSION="v2-f3a-runner-home-v4-20260923";
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
  events:document.getElementById("rhEvents"),
  retry:document.getElementById("rhRetry")
};

let auth=null;
let currentUser=null;
let profile=null;

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
  try{
    auth=initializeAuth(app,{persistence:[indexedDBLocalPersistence,browserLocalPersistence,browserSessionPersistence]});
  }catch(error){
    if(String(error?.code||"").includes("already-initialized"))auth=getAuth(app);else throw error;
  }
  return app;
}
async function waitForUser(){
  setStatus("Recuperando tu sesión MILITOPO…");
  if(auth.currentUser)return auth.currentUser;
  return withTimeout(new Promise((resolve,reject)=>{
    let finished=false;
    const stop=onAuthStateChanged(auth,user=>{
      if(finished)return;finished=true;try{stop();}catch(_){}resolve(user);
    },error=>{
      if(finished)return;finished=true;try{stop();}catch(_){}reject(error);
    });
  }),10000,"No se detectó una sesión activa en este dispositivo.");
}
async function loadProfile(app,user){
  const db=getFirestore(app);
  let data={};
  try{
    const snap=await withTimeout(getDoc(doc(db,"users",user.uid)),8000,"El perfil tardó demasiado en responder.");
    if(snap.exists())data=snap.data()||{};
  }catch(error){console.warn("[MILITOPO runner home profile]",error);}
  profile=data;
  const displayName=String(data.displayName||user.displayName||user.email||"Corredor").trim();
  const username=String(data.usernameKey||data.username||"").trim().toLowerCase();
  text(els.name,displayName);
  text(els.meta,`${username?`@${username} · `:""}runner · ${user.email||""}`);
  text(els.avatar,initials(displayName));
  if(els.detailsBtn)els.detailsBtn.disabled=false;
  if(els.logoutBtn)els.logoutBtn.disabled=false;
  if(els.details)els.details.innerHTML=`<strong>Nombre:</strong> ${esc(displayName)}<br><strong>Usuario:</strong> ${username?`@${esc(username)}`:"Sin usuario"}<br><strong>Correo:</strong> ${esc(user.email||"")}<br><strong>Rol:</strong> runner<br><span class="small">UID: ${esc(user.uid)}</span>`;
}
function statusES(s){return ({draft:"BORRADOR",prepared:"PREPARADO",published:"PUBLICADO",live:"EN DIRECTO",finished:"FINALIZADO",archived:"ARCHIVADO"})[String(s||"").toLowerCase()]||String(s||"").toUpperCase();}
function renderEvents(events){
  if(!els.events)return;
  els.events.innerHTML="";
  if(!events.length){
    setStatus("No tienes carreras preparadas, publicadas o en directo asociadas a esta cuenta.","ok");
    return;
  }
  setStatus(`✅ ${events.length} carrera${events.length===1?"":"s"} asociada${events.length===1?"":"s"} a tu cuenta.`,"ok");
  els.events.innerHTML=events.map(ev=>{
    const state=String(ev.status||"").toLowerCase();
    const live=state==="live"&&String(ev.liveRunId||"").trim();
    const waiting=state==="finished"?"Carrera finalizada.":state==="prepared"?"La carrera está preparada. Espera a que el organizador la publique.":"Esperando a que el organizador inicie la carrera.";
    const action=live
      ? `<button class="btn primary" type="button" data-enter-event="${esc(ev.eventId)}">ENTRAR EN LA CARRERA</button>`
      : `<div class="waiting">${waiting}</div>`;
    return `<article class="event"><strong>${esc(ev.eventName||"Carrera")}</strong><div class="event-meta">${esc(statusES(ev.status))} · ${esc(ev.eventId||"")}</div><span class="pill">${esc(statusES(ev.status))}</span>${action}</article>`;
  }).join("");
  els.events.querySelectorAll("[data-enter-event]").forEach(btn=>btn.addEventListener("click",()=>{
    const id=String(btn.dataset.enterEvent||"");
    const url=new URL("runner.html",location.href);
    url.searchParams.set("app","1");url.searchParams.set("event",id);
    location.href=url.href;
  }));
}
async function loadEvents(app){
  setStatus("Consultando tus carreras Live V2…");
  if(els.retry)els.retry.style.display="none";
  const functions=getFunctions(app,REGION);
  const call=httpsCallable(functions,"getRunnerLiveEvents");
  try{
    const result=await withTimeout(call({clientVersion:VERSION}),15000,"La consulta de carreras tardó demasiado.");
    const events=Array.isArray(result?.data?.events)?result.data.events:[];
    renderEvents(events);
  }catch(error){
    console.error("[MILITOPO runner home events]",error);
    const code=String(error?.code||"");
    const msg=String(error?.message||"No se pudieron consultar tus carreras.");
    setStatus(`⚠️ ${msg}${code?` (${code})`:""}`,"err");
    if(els.retry)els.retry.style.display="block";
  }
}
async function boot(){
  try{
    const app=initFirebase();
    const user=await waitForUser();
    if(!user)throw new Error("No hay una sesión iniciada. Vuelve a la pantalla de acceso.");
    currentUser=user;
    if(!user.emailVerified)throw new Error("Tu correo todavía no está verificado.");
    await loadProfile(app,user);
    await loadEvents(app);
  }catch(error){
    console.error("[MILITOPO runner home boot]",error);
    text(els.name,"No se pudo cargar tu cuenta");
    text(els.meta,"La sesión o Firebase no respondieron correctamente.");
    setStatus(`⚠️ ${String(error?.message||error)}`,"err");
    if(els.retry)els.retry.style.display="block";
  }
}

els.detailsBtn?.addEventListener("click",()=>{
  els.details?.classList.toggle("show");
  if(els.detailsBtn)els.detailsBtn.textContent=els.details?.classList.contains("show")?"OCULTAR DATOS":"VER DATOS DE CUENTA";
});
els.logoutBtn?.addEventListener("click",async()=>{
  try{if(auth)await signOut(auth);}catch(_){}
  location.replace("../../");
});
els.retry?.addEventListener("click",()=>location.reload());

boot();
