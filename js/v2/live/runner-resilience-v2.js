/* MILITOPO V2 · G3 · Resiliencia de carrera y Screen Wake Lock.
   Conserva el contexto de una carrera activa, recupera la interfaz tras recarga
   y mantiene la pantalla despierta mientras el corredor está EN CARRERA cuando
   el navegador ofrece Screen Wake Lock. */
(function(){
  "use strict";
  const VERSION="v2-g3-recovery-wakelock-20260924";
  const KEY="militopo_v2_active_race_v3";
  const MAX_AGE_MS=12*60*60*1000;
  const state={context:null,status:"",wake:null,restoring:false,restoreTimer:null};

  function emit(status,detail={}){
    try{globalThis.dispatchEvent(new CustomEvent("militopo:v2-resilience-status",{detail:{status,version:VERSION,...detail}}));}catch(_){}
  }
  function cleanEvent(ev){if(!ev)return null;return {eventId:String(ev.eventId||""),eventName:String(ev.eventName||"Carrera"),ownerUid:String(ev.ownerUid||""),status:String(ev.status||"")};}
  function cleanAuth(auth){if(!auth)return null;return {uid:String(auth.uid||""),email:auth.email||null,displayName:auth.displayName||null,username:auth.username||null,role:String(auth.role||"runner")};}
  function read(){
    try{
      const raw=localStorage.getItem(KEY);if(!raw)return null;
      const data=JSON.parse(raw);if(!data?.event?.eventId||!data?.auth?.uid||!data?.runId)return null;
      if(Date.now()-Number(data.savedAt||0)>MAX_AGE_MS){localStorage.removeItem(KEY);return null;}
      return data;
    }catch(_){return null;}
  }
  function write(ctx){
    state.context=ctx;
    try{localStorage.setItem(KEY,JSON.stringify(ctx));}catch(_){}
  }
  function clear(){state.context=null;try{localStorage.removeItem(KEY);}catch(_){} }
  function saveFrom(detail,status=state.status||""){
    const event=cleanEvent(detail?.event),auth=cleanAuth(detail?.auth),runId=String(detail?.runId||"");
    if(!event?.eventId||!auth?.uid||!runId)return;
    write({event,auth,runId,status:String(status||""),savedAt:Date.now(),version:VERSION});
  }
  async function releaseWake(){
    const lock=state.wake;state.wake=null;
    if(lock){try{await lock.release();}catch(_){} }
    emit("released");
  }
  async function requestWake(){
    if(state.status!=="racing"&&state.status!=="started")return false;
    if(document.visibilityState!=="visible")return false;
    if(!("wakeLock" in navigator)){emit("unsupported");return false;}
    if(state.wake&&!state.wake.released){emit("awake");return true;}
    try{
      state.wake=await navigator.wakeLock.request("screen");
      state.wake.addEventListener?.("release",()=>{state.wake=null;if(state.status==="racing"||state.status==="started")emit("released");});
      emit("awake");return true;
    }catch(error){emit("released",{message:String(error?.message||error)});return false;}
  }
  function currentAuth(){return globalThis.MILITOPO_V2_AUTH||null;}
  function raceVisible(){const root=document.getElementById("m2RaceV2");return Boolean(root&&!root.hidden);}
  function restore(auth){
    if(state.restoring||raceVisible()||!auth?.uid||auth.role!=="runner")return;
    const saved=read();if(!saved||saved.auth.uid!==auth.uid)return;
    if(["finished","archived"].includes(String(saved.status||"").toLowerCase())){clear();return;}
    state.context=saved;state.status=String(saved.status||"").toLowerCase();state.restoring=true;
    emit("restoring",{eventId:saved.event.eventId});
    clearTimeout(state.restoreTimer);
    state.restoreTimer=setTimeout(()=>{
      state.restoring=false;
      try{globalThis.dispatchEvent(new CustomEvent("militopo:v2-open-runner-race",{detail:{event:{...saved.event},auth:{...auth},runId:saved.runId,recovered:true}}));}catch(_){}
    },650);
  }

  globalThis.addEventListener("militopo:v2-open-runner-race",e=>{
    const d=e.detail||{};saveFrom(d,state.status);if(d.recovered)emit("restoring",{eventId:d.event?.eventId||""});
  });
  globalThis.addEventListener("militopo:v2-race-opened",e=>saveFrom(e.detail||{},state.status));
  globalThis.addEventListener("militopo:v2-race-participant",e=>{
    const d=e.detail||{};state.status=String(d.status||"").toLowerCase();
    saveFrom(d,state.status);
    if(["racing","started"].includes(state.status)) requestWake();
    else if(state.status==="finished"){clear();releaseWake();emit("idle",{message:"Carrera finalizada. Recuperación ya no necesaria."});}
  });
  globalThis.addEventListener("militopo:v2-race-event-finished",()=>{clear();releaseWake();});
  globalThis.addEventListener("militopo:v2-runner-race-error",e=>{
    if(e.detail?.recovered){clear();state.restoring=false;releaseWake();}
  });
  globalThis.addEventListener("militopo:v2-auth-ready",e=>{if(e.detail?.role==="runner")setTimeout(()=>restore(e.detail),450);});
  globalThis.addEventListener("militopo:v2-runner-dashboard",e=>{if(e.detail?.role==="runner")setTimeout(()=>restore(e.detail),450);});
  globalThis.addEventListener("militopo:v2-auth-signed-out",()=>{clear();state.status="";releaseWake();});
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible"){
      if(state.status==="racing"||state.status==="started")requestWake();
      const auth=currentAuth();if(auth?.role==="runner")setTimeout(()=>restore(auth),350);
    }
  });
  globalThis.addEventListener("pageshow",()=>{const auth=currentAuth();if(auth?.role==="runner")setTimeout(()=>restore(auth),500);});
  globalThis.addEventListener("pagehide",()=>{const saved=read();if(saved)write({...saved,savedAt:Date.now()});});

  state.context=read();
  if(state.context){state.status=String(state.context.status||"").toLowerCase();emit("idle",{message:"Hay una carrera protegida para recuperación."});}
  globalThis.MILITOPO_RUNNER_RESILIENCE_V2=Object.freeze({snapshot:()=>({active:!!read(),status:state.status,wake:!!state.wake&&!state.wake.released}),restore:()=>restore(currentAuth()),clear});
})();
