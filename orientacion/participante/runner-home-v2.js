/* MILITOPO V2 · F3A runner home robusta.
   Esta pantalla es deliberadamente autocontenida para que el corredor vea siempre
   su identidad y sus carreras aunque otro módulo opcional tarde en cargar. */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";

const APP_NAME = "militopo-v2";
const REGION = "europe-west1";
const statusEl = document.getElementById("m2RunnerHomeStatus");
const listEl = document.getElementById("m2RunnerHomeList");
const nameEl = document.getElementById("m2RunnerIdentityName");
const metaEl = document.getElementById("m2RunnerIdentityMeta");
const accountBtn = document.getElementById("m2RunnerOpenAccount");
const STATUS_ES = { prepared:"PREPARADO", published:"PUBLICADO", live:"EN DIRECTO", finished:"FINALIZADO" };

function esc(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function setStatus(text){ if(statusEl) statusEl.textContent = text; }
function app(){
  const cfg=globalThis.MILITOPO_V2_CONFIG;
  if(!cfg?.configured) throw new Error("Firebase V2 no está configurado.");
  return getApps().find(a=>a.name===APP_NAME) || initializeApp(cfg.firebase, APP_NAME);
}
function showSignedOut(){
  if(nameEl) nameEl.textContent="Sesión no detectada";
  if(metaEl) metaEl.textContent="Vuelve a iniciar sesión para cargar tus carreras.";
  setStatus("Tu sesión no ha podido recuperarse en esta página.");
  if(listEl) listEl.innerHTML=`<a href="../../" style="display:grid;place-items:center;min-height:46px;border-radius:14px;border:1px solid rgba(240,193,106,.38);color:#fff3d7;text-decoration:none;font-weight:900">VOLVER A INICIAR SESIÓN</a>`;
}
async function renderIdentity(db,user){
  let profile={};
  try{const snap=await getDoc(doc(db,"users",user.uid)); if(snap.exists()) profile=snap.data()||{};}catch(error){console.warn("[runner home] profile",error);}
  const displayName=String(profile.displayName||user.displayName||user.email||"Corredor").trim();
  const username=String(profile.usernameKey||profile.username||"").trim().toLowerCase();
  if(nameEl) nameEl.textContent=displayName;
  if(metaEl) metaEl.textContent=`${username?`@${username} · `:""}runner · ${user.email||""}`;
  accountBtn?.addEventListener("click",()=>{
    const btn=document.getElementById("m2AuthAccountBtn");
    if(btn){btn.click();return;}
    window.location.href="../../";
  });
}
function eventCard(ev){
  const status=STATUS_ES[String(ev.status||"").toLowerCase()]||String(ev.status||"").toUpperCase();
  const live=String(ev.status||"").toLowerCase()==="live" && String(ev.liveRunId||"").trim();
  const action=live
    ? `<button type="button" data-open-event="${esc(ev.eventId)}" style="width:100%;min-height:46px;margin-top:10px;border-radius:14px;border:1px solid rgba(126,220,150,.42);background:rgba(126,220,150,.14);color:#efffe8;font:inherit;font-weight:900">ENTRAR EN LA CARRERA</button>`
    : `<div style="margin-top:9px;padding:9px 10px;border-radius:12px;background:rgba(126,220,150,.10);border:1px solid rgba(126,220,150,.24);font-size:.76rem;font-weight:900">${String(ev.status||"").toLowerCase()==="finished"?"Carrera finalizada.":"Esperando a que el organizador inicie la carrera."}</div>`;
  return `<article style="padding:12px;border:1px solid rgba(255,255,255,.11);border-radius:15px;background:rgba(255,255,255,.035)"><strong style="display:block;font-size:.9rem">${esc(ev.eventName||"Carrera")}</strong><div style="font-size:.72rem;opacity:.72;margin-top:4px">${esc(status)} · ${esc(ev.eventId||"")}</div>${action}</article>`;
}
async function load(user){
  const a=app(); const db=getFirestore(a); const functions=getFunctions(a,REGION);
  await renderIdentity(db,user);
  setStatus("Buscando tus carreras asociadas…");
  try{
    const call=httpsCallable(functions,"getRunnerLiveEvents");
    const res=await call({});
    const events=Array.isArray(res.data?.events)?res.data.events:[];
    if(!events.length){
      setStatus("No tienes carreras preparadas, publicadas o en directo asociadas a esta cuenta.");
      if(listEl) listEl.innerHTML="";
      return;
    }
    setStatus(`Tienes ${events.length} carrera${events.length===1?"":"s"} asociada${events.length===1?"":"s"} a tu cuenta.`);
    if(listEl) listEl.innerHTML=events.map(eventCard).join("");
    listEl?.addEventListener("click",event=>{
      const btn=event.target.closest("[data-open-event]"); if(!btn)return;
      const eventId=String(btn.dataset.openEvent||"");
      try{sessionStorage.setItem("militopo_v2_runner_selected_event",eventId);}catch(_){}
      const url=new URL("runner.html",window.location.href); url.searchParams.set("app","1"); url.searchParams.set("event",eventId); window.location.href=url.href;
    });
  }catch(error){
    console.error("[MILITOPO runner home]",error);
    setStatus(`No se pudieron cargar tus carreras ahora${error?.message?`: ${String(error.message).slice(0,120)}`:"."}`);
  }
}
try{
  const auth=getAuth(app());
  let settled=false;
  onAuthStateChanged(auth,user=>{
    settled=true;
    if(!user){showSignedOut();return;}
    if(!user.emailVerified){setStatus("Verifica tu correo antes de acceder a tus carreras.");return;}
    load(user);
  });
  setTimeout(()=>{if(!settled)setStatus("Recuperando la sesión del corredor…");},1200);
}catch(error){console.error("[MILITOPO runner home init]",error);setStatus("No se pudo iniciar el área del corredor. Recarga la página.");}
