/* MILITOPO V2 · I3 · Resiliencia offline real de carrera activa.
   Conserva contexto suficiente para reabrir una carrera EN CARRERA sin red:
   evento, runId, corredor, recorrido/controlPlan, hora de salida y llegada local.
   Al volver Internet, runner-race-v2 reconcilia RTDB/Functions sin recargar la app. */
(function(){
  "use strict";
  const VERSION="v2-i3-1-offline-auto-open-active-race-20260928";
  const KEY="militopo_v2_active_race_v3";
  const MAX_AGE_MS=24*60*60*1000;
  const state={context:null,status:"",wake:null,restoring:false,restoreTimer:null};

  function emit(status,detail={}){
    try{globalThis.dispatchEvent(new CustomEvent("militopo:v2-resilience-status",{detail:{status,version:VERSION,...detail}}));}catch(_){}
  }
  function clone(value){try{return value==null?null:JSON.parse(JSON.stringify(value));}catch(_){return null;}}
  function cleanEvent(ev){
    if(!ev)return null;
    return {
      eventId:String(ev.eventId||""),eventName:String(ev.eventName||"Carrera"),ownerUid:String(ev.ownerUid||""),status:String(ev.status||""),
      participantId:ev.participantId||null,routeId:ev.routeId||null,routeDistanceKm:ev.routeDistanceKm??null,routeControlCount:ev.routeControlCount??null,
      routePositiveM:ev.routePositiveM??null,routeDifficulty:ev.routeDifficulty??null,routePoints:Array.isArray(ev.routePoints)?[...ev.routePoints]:undefined
    };
  }
  function cleanAuth(auth){if(!auth)return null;return {uid:String(auth.uid||""),email:auth.email||null,displayName:auth.displayName||null,username:auth.username||null,role:String(auth.role||"runner")};}
  function cleanParticipant(p){
    if(!p||typeof p!=="object")return null;
    const out={...p};
    delete out.gps;
    return clone(out);
  }
  function read(){
    try{
      const raw=localStorage.getItem(KEY);if(!raw)return null;
      const data=JSON.parse(raw);if(!data?.event?.eventId||!data?.auth?.uid||!data?.runId)return null;
      if(Date.now()-Number(data.savedAt||0)>MAX_AGE_MS){localStorage.removeItem(KEY);return null;}
      return data;
    }catch(_){return null;}
  }
  function write(ctx){state.context=ctx;try{localStorage.setItem(KEY,JSON.stringify(ctx));}catch(_){} }
  function clear(){state.context=null;try{localStorage.removeItem(KEY);}catch(_){} }
  function saveFrom(detail,status=state.status||""){
    const event=cleanEvent(detail?.event),auth=cleanAuth(detail?.auth),runId=String(detail?.runId||"");
    if(!event?.eventId||!auth?.uid||!runId)return;
    const previous=read();
    const same=previous&&previous.event?.eventId===event.eventId&&previous.auth?.uid===auth.uid&&String(previous.runId||"")===runId;
    const nextStatus=String(status||detail?.status||previous?.status||"").toLowerCase();
    const participant=cleanParticipant(detail?.participant)||(same?previous.participant:null);
    const controlPlan=clone(detail?.controlPlan)||(same?previous.controlPlan:null);
    const localArrivalAt=Math.max(0,Number(detail?.localArrivalAt||(same?previous.localArrivalAt:0)||0));
    write({
      event:{...(same&&previous?.event?previous.event:{}),...event},auth,runId,status:nextStatus,
      participant,controlPlan,localArrivalAt,
      savedAt:Date.now(),version:VERSION
    });
  }
  async function releaseWake(){const lock=state.wake;state.wake=null;if(lock){try{await lock.release();}catch(_){}}emit("released");}
  async function requestWake(){
    if(state.status!=="racing"&&state.status!=="started")return false;
    if(document.visibilityState!=="visible")return false;
    if(!("wakeLock" in navigator)){emit("unsupported");return false;}
    if(state.wake&&!state.wake.released){emit("awake");return true;}
    try{state.wake=await navigator.wakeLock.request("screen");state.wake.addEventListener?.("release",()=>{state.wake=null;if(state.status==="racing"||state.status==="started")emit("released");});emit("awake");return true;}
    catch(error){emit("released",{message:String(error?.message||error)});return false;}
  }
  function currentAuth(){return globalThis.MILITOPO_V2_AUTH||null;}
  function raceVisible(){const root=document.getElementById("m2RaceV2");return Boolean(root&&!root.hidden);}
  function restore(auth){
    if(state.restoring||raceVisible()||!auth?.uid||auth.role!=="runner")return;
    const saved=read();if(!saved||saved.auth.uid!==auth.uid)return;
    const status=String(saved.status||"").toLowerCase();
    if(["finished","archived"].includes(status)){clear();return;}
    state.context=saved;state.status=status;state.restoring=true;
    emit(navigator.onLine===false?"restoring_offline":"restoring",{eventId:saved.event.eventId});
    clearTimeout(state.restoreTimer);
    state.restoreTimer=setTimeout(()=>{
      state.restoring=false;
      try{globalThis.dispatchEvent(new CustomEvent("militopo:v2-open-runner-race",{detail:{
        event:{...saved.event},auth:{...auth},runId:saved.runId,recovered:true,
        recoverySnapshot:{participant:clone(saved.participant),controlPlan:clone(saved.controlPlan),localArrivalAt:Number(saved.localArrivalAt||0),status:saved.status,savedAt:saved.savedAt}
      }}));}catch(_){}
    },500);
  }

  globalThis.addEventListener("militopo:v2-open-runner-race",e=>{const d=e.detail||{};saveFrom(d,d.recoverySnapshot?.status||state.status);if(d.recovered)emit(navigator.onLine===false?"restoring_offline":"restoring",{eventId:d.event?.eventId||""});});
  globalThis.addEventListener("militopo:v2-race-opened",e=>saveFrom(e.detail||{},state.status));
  globalThis.addEventListener("militopo:v2-race-local-snapshot",e=>{const d=e.detail||{};state.status=String(d.status||state.status||"").toLowerCase();saveFrom(d,state.status);});
  globalThis.addEventListener("militopo:v2-race-participant",e=>{
    const d=e.detail||{};state.status=String(d.status||"").toLowerCase();saveFrom(d,state.status);
    if(["racing","started"].includes(state.status))requestWake();
    else if(state.status==="finished"){clear();releaseWake();emit("idle",{message:"Carrera finalizada. Recuperación ya no necesaria."});}
  });
  globalThis.addEventListener("militopo:v2-race-event-finished",()=>{clear();releaseWake();});
  globalThis.addEventListener("militopo:v2-runner-race-error",e=>{
    if(!e.detail?.recovered)return;
    state.restoring=false;
    if(navigator.onLine===false){emit("offline_protected",{message:"Sin conexión. La carrera local sigue protegida y no se elimina."});return;}
    emit("restore_error",{message:String(e.detail?.message||"No se pudo reconciliar la carrera.")});
  });
  globalThis.addEventListener("militopo:v2-auth-ready",e=>{if(e.detail?.role==="runner")setTimeout(()=>restore(e.detail),350);});
  globalThis.addEventListener("militopo:v2-runner-dashboard",e=>{if(e.detail?.role==="runner")setTimeout(()=>restore(e.detail),350);});
  globalThis.addEventListener("militopo:v2-auth-signed-out",()=>{clear();state.status="";releaseWake();});
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible"){
      if(state.status==="racing"||state.status==="started")requestWake();
      const auth=currentAuth();if(auth?.role==="runner")setTimeout(()=>restore(auth),250);
    }
  });
  globalThis.addEventListener("pageshow",()=>{const auth=currentAuth();if(auth?.role==="runner")setTimeout(()=>restore(auth),350);});
  globalThis.addEventListener("pagehide",()=>{const saved=read();if(saved)write({...saved,savedAt:Date.now()});});

  state.context=read();
  if(state.context){
    state.status=String(state.context.status||"").toLowerCase();
    emit("idle",{message:"Hay una carrera protegida para recuperación."});

    /* I3.1: al arrancar totalmente offline Firebase Auth puede no haber restaurado aún
       MILITOPO_V2_AUTH, aunque el dashboard runner sí tenga su snapshot local.
       Una carrera que YA estaba racing/started debe abrirse desde su propia copia local
       sin esperar a Firebase/RTDB. La seguridad del servidor sigue en Rules/Functions;
       aquí solo reconstruimos la interfaz de la carrera del mismo uid guardado. */
    if(["racing","started"].includes(state.status)){
      setTimeout(()=>{
        if(raceVisible())return;
        const liveAuth=currentAuth();
        const savedAuth=state.context?.auth||null;
        const auth=(liveAuth?.role==="runner"&&String(liveAuth.uid||"")===String(savedAuth?.uid||""))?liveAuth:savedAuth;
        if(auth?.role==="runner"&&auth?.uid) restore(auth);
      },850);
    }
  }
  globalThis.MILITOPO_RUNNER_RESILIENCE_V2=Object.freeze({snapshot:()=>({active:!!read(),status:state.status,wake:!!state.wake&&!state.wake.released,context:read()}),restore:()=>restore(currentAuth()||state.context?.auth||null),clear});
})();
