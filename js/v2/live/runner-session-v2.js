/* MILITOPO V2 · F3A · Sesión Live autenticada del corredor.
   Conecta la cuenta runner a la sesión V2 sin tocar todavía la lógica GPS/offline de la Fase G. */
import "../bootstrap.js?v=v2-f3a-runner-homefix2-20260923";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";
import { ref, get, onValue, update, onDisconnect, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const STATUS_ES = { prepared:"PREPARADO", published:"PUBLICADO", live:"EN DIRECTO", finished:"FINALIZADO" };
const state = { services:null, user:null, events:[], selected:null, runId:"", unsubRun:null, unsubParticipant:null, heartbeat:null, panel:null, list:null, status:null, home:false };

function esc(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
async function services(){ if(!state.services) state.services = await globalThis.MILITOPO_V2.firebase(); return state.services; }
function injectStyle(){
  if(document.getElementById("m2RunnerV2Style"))return;
  const s=document.createElement("style");s.id="m2RunnerV2Style";s.textContent=`
  .m2-runner-v2{margin:0 0 16px;padding:15px;border-radius:22px;border:1px solid rgba(126,220,150,.34);background:linear-gradient(180deg,rgba(8,29,15,.96),rgba(5,18,9,.97));color:#f5e6c8}
  .m2-runner-v2 h2{margin:0 0 8px;font-size:1rem;color:#e6f6d7;letter-spacing:.06em}.m2-runner-v2-status{font-size:.78rem;line-height:1.45;opacity:.88;margin-bottom:10px}
  .m2-runner-v2-list{display:grid;gap:8px}.m2-runner-v2-event{padding:11px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(255,255,255,.035)}
  .m2-runner-v2-event strong{display:block;font-size:.88rem}.m2-runner-v2-meta{font-size:.7rem;opacity:.7;margin-top:3px}.m2-runner-v2-btn{width:100%;min-height:44px;margin-top:8px;border:1px solid rgba(126,220,150,.4);border-radius:12px;background:rgba(126,220,150,.14);color:#efffe8;font:inherit;font-weight:900}.m2-runner-v2-btn:disabled{opacity:.45}
  .m2-runner-v2-live{margin-top:8px;padding:9px 10px;border-radius:12px;background:rgba(126,220,150,.12);border:1px solid rgba(126,220,150,.28);font-size:.75rem;font-weight:900;color:#dff7d3}`;
  document.head.appendChild(s);
}
function ensurePanel(){
  if(state.panel?.isConnected)return state.panel; injectStyle();
  const hero=document.querySelector(".participant-main-hero"); if(!hero)return null;
  const panel=document.createElement("section"); panel.id="m2RunnerLiveV2"; panel.className="m2-runner-v2";
  panel.innerHTML=`<h2>📡 LIVE V2 · MI CARRERA</h2><div id="m2RunnerV2Status" class="m2-runner-v2-status">Comprobando sesión…</div><div id="m2RunnerV2List" class="m2-runner-v2-list"></div>`;
  hero.insertAdjacentElement("afterend",panel); state.panel=panel; state.status=panel.querySelector("#m2RunnerV2Status"); state.list=panel.querySelector("#m2RunnerV2List");
  state.list.addEventListener("click",e=>{
    const b=e.target.closest("[data-event-id]");
    if(!b)return;
    const eventId=String(b.dataset.eventId||"");
    if(state.home){
      try{sessionStorage.setItem("militopo_v2_runner_selected_event",eventId)}catch(_){}
      const target=new URL("runner.html",window.location.href);
      target.searchParams.set("app","1");
      target.searchParams.set("event",eventId);
      window.location.href=target.href;
      return;
    }
    connectEvent(eventId);
  }); return panel;
}
function setStatus(t){ensurePanel(); if(state.status)state.status.textContent=t;}
function renderEvents(){
  ensurePanel(); if(!state.list)return;
  if(!state.user){state.list.innerHTML=`<a class="m2-runner-v2-btn" style="display:grid;place-items:center;text-decoration:none" href="../../">VOLVER A MILITOPO E INICIAR SESIÓN</a>`;return;}
  if(!state.events.length){state.list.innerHTML="";setStatus("No tienes carreras activas o publicadas asociadas a esta cuenta.");return;}
  state.list.innerHTML=state.events.map(ev=>{
    const live=ev.status==="live"&&ev.liveRunId;
    const label=STATUS_ES[ev.status]||String(ev.status||"").toUpperCase();
    const action=live
      ? `<button type="button" class="m2-runner-v2-btn" data-event-id="${esc(ev.eventId)}">${state.home?"ENTRAR EN LA CARRERA":"CONECTAR A LA CARRERA EN DIRECTO"}</button>`
      : `<div class="m2-runner-v2-live">${ev.status==="finished"?"Carrera finalizada.":"Esperando a que el organizador inicie la carrera."}</div>`;
    return `<article class="m2-runner-v2-event"><strong>${esc(ev.eventName)}</strong><div class="m2-runner-v2-meta">${esc(label)} · ${esc(ev.eventId)}</div>${action}</article>`;
  }).join("");
  setStatus(state.home?"Estas son las carreras asociadas a tu cuenta.":"Carreras asociadas a tu cuenta MILITOPO.");
}
function cleanupConnection(){
  try{state.unsubRun?.();}catch(_){} try{state.unsubParticipant?.();}catch(_){} state.unsubRun=null;state.unsubParticipant=null;
  if(state.heartbeat){clearInterval(state.heartbeat);state.heartbeat=null;} state.runId="";
}
async function markPresence(event,runId){
  const {database}=await services(); const uid=state.user.uid; const pRef=ref(database,`v2/live/${event.ownerUid}/${event.eventId}/runs/${runId}/participants/${uid}`);
  const snap=await get(pRef); if(!snap.exists())throw new Error("Tu cuenta no está incluida en esta sesión Live.");
  const current=snap.val()||{}; const nextStatus=["racing","started","finished"].includes(String(current.status||""))?String(current.status):"ready";
  await update(pRef,{online:true,status:nextStatus,lastSeen:serverTimestamp(),updatedAt:serverTimestamp()});
  try{await onDisconnect(pRef).update({online:false,lastSeen:serverTimestamp(),updatedAt:serverTimestamp()});}catch(_){}
  state.heartbeat=setInterval(()=>{update(pRef,{online:true,lastSeen:serverTimestamp(),updatedAt:serverTimestamp()}).catch(()=>{});},20000);
  state.unsubParticipant=onValue(pRef,s=>{const row=s.val()||{};const label=String(row.status||"ready").toUpperCase();setStatus(`✅ Conectado a Live V2 · ${event.eventName} · ${label}`);});
  document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")update(pRef,{online:true,lastSeen:serverTimestamp(),updatedAt:serverTimestamp()}).catch(()=>{});},{passive:true});
}
async function connectEvent(eventId){
  const event=state.events.find(x=>x.eventId===eventId); if(!event)return; cleanupConnection(); state.selected=event; setStatus("Conectando con la sesión Live V2…");
  try{
    const {database}=await services(); const activeRef=ref(database,`v2/live/${event.ownerUid}/${event.eventId}/activeRun`);
    const snap=await get(activeRef); const active=snap.exists()?(snap.val()||{}):{}; if(!active.runId||active.status!=="active")throw new Error("La carrera todavía no está en directo.");
    state.runId=String(active.runId); await markPresence(event,state.runId);
    state.unsubRun=onValue(activeRef,s=>{const row=s.val()||{};if(String(row.status||"")==="finished"){setStatus("🏁 La sesión Live V2 ha finalizado.");cleanupConnection();}});
  }catch(error){console.error("[MILITOPO F3A runner]",error);setStatus(`⚠️ ${String(error?.message||"No se pudo conectar a Live V2.")}`);}
}
async function loadEvents(){
  if(!state.user)return; setStatus("Buscando tus carreras en MILITOPO…");
  try{
    const {functions}=await services();
    const call=httpsCallable(functions,"getRunnerLiveEvents");
    const res=await call({});
    state.events=Array.isArray(res.data?.events)?res.data.events:[];
    renderEvents();
    if(state.home)return;
    const params=new URLSearchParams(location.search||"");
    let requested=String(params.get("event")||"").trim();
    if(!requested){try{requested=String(sessionStorage.getItem("militopo_v2_runner_selected_event")||"").trim()}catch(_){} }
    const requestedEvent=requested?state.events.find(e=>e.eventId===requested&&e.status==="live"&&e.liveRunId):null;
    if(requestedEvent){setTimeout(()=>connectEvent(requestedEvent.eventId),180);return;}
    const live=state.events.filter(e=>e.status==="live"&&e.liveRunId);
    if(live.length===1)setTimeout(()=>connectEvent(live[0].eventId),350);
  }catch(error){console.error("[MILITOPO F3A events]",error);setStatus("No se pudieron consultar tus carreras ahora.");}
}
async function init(){
  state.home=document.body?.dataset?.runnerHome==="1";
  ensurePanel(); const {auth}=await services(); onAuthStateChanged(auth,user=>{cleanupConnection();state.user=user||null;state.events=[];if(!user){setStatus("Inicia sesión con tu cuenta MILITOPO para acceder a tu carrera.");renderEvents();return;} if(!user.emailVerified){setStatus("Verifica tu correo desde MILITOPO antes de entrar en una carrera.");renderEvents();return;} loadEvents();});
}
init().catch(error=>{console.error("[MILITOPO F3A init]",error);setStatus("No se pudo iniciar Live V2 del participante.");});
