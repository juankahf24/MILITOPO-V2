/* MILITOPO V2 · H6.1 · Control Live de balizas.
   - Siguiente baliza en tiempo real.
   - Validación automática por proximidad GPS.
   - QR de la baliza como respaldo si el GPS falla.
   - Cola local para no perder picadas sin cobertura / tras recarga. */
(function(){
  "use strict";

  const VERSION="v2-h6-2-manual-live-strictgps-progress-reset-20260925";
  const JSQR_URL="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
  const PASS_COOLDOWN_MS=4500;
  const GPS_MAX_ACCURACY_M=10;
  const GPS_CAPTURE_RADIUS_M=10;

  const state={
    services:null,context:null,plan:null,raceStatus:"ready",completedCount:0,
    serverCompletedCount:0,queue:[],passes:[],lastFix:null,lastAutoAt:0,
    flushing:false,storageKey:"",scanner:null,scannerFrame:0,qrLoading:null
  };

  async function services(){if(!state.services)state.services=await globalThis.MILITOPO_V2.firebase();return state.services;}
  const canonical=value=>{const u=String(value||"").trim().toUpperCase();if(["S","SALIDA","START"].includes(u))return "START";if(["L","META","LLEGADA","FINISH"].includes(u))return "FINISH";return u;};
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  function haversine(a,b){if(!a||!b)return Infinity;const R=6371000,rad=Math.PI/180,p1=Number(a.lat)*rad,p2=Number(b.lat)*rad,dp=(Number(b.lat)-Number(a.lat))*rad,dl=(Number(b.lng)-Number(a.lng))*rad,h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
  function controlList(){return Array.isArray(state.plan?.controls)?state.plan.controls:[];}
  function nextControl(){return controlList()[state.completedCount]||null;}
  function expectedCount(){return Math.max(0,Number(state.plan?.expectedCount||controlList().length||0));}
  function allowedRadius(){return GPS_CAPTURE_RADIUS_M;}
  function makeAttemptId(){try{return crypto.randomUUID().replace(/-/g,"");}catch(_){return `a_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;}}
  function contextKey(ctx=state.context){if(!ctx?.uid||!ctx?.eventId||!ctx?.runId)return "";return `militopo_v2_controls_${ctx.uid}_${ctx.eventId}_${ctx.runId}`;}
  function emit(status,detail={}){const next=nextControl();window.dispatchEvent(new CustomEvent("militopo:v2-control-status",{detail:{status,version:VERSION,raceStatus:state.raceStatus,completedCount:state.completedCount,expectedCount:expectedCount(),nextControl:next?{...next}:null,lastFix:state.lastFix?{...state.lastFix}:null,pending:state.queue.length,...detail}}));}
  function safeLoad(){if(!state.storageKey)return null;try{const raw=localStorage.getItem(state.storageKey);const x=raw?JSON.parse(raw):null;return x&&typeof x==="object"?x:null;}catch(_){return null;}}
  function persist(){if(!state.storageKey)return;try{localStorage.setItem(state.storageKey,JSON.stringify({v:1,completedCount:state.completedCount,serverCompletedCount:state.serverCompletedCount,queue:state.queue.slice(-120),passes:state.passes.slice(-120),savedAt:Date.now()}));}catch(_){}}
  function progressFromServer(progress){const n=Math.max(0,Number(progress?.completedCount||0));state.serverCompletedCount=Math.max(state.serverCompletedCount,n);const serverPasses=progress?.passes&&typeof progress.passes==="object"?Object.values(progress.passes):[];if(serverPasses.length){state.passes=serverPasses.map(row=>({...row})).sort((a,b)=>Number(a.order||0)-Number(b.order||0));}}
  function reconcile(){const local=safeLoad();if(local){state.queue=Array.isArray(local.queue)?local.queue:[];state.passes=Array.isArray(local.passes)&&local.passes.length?local.passes:state.passes;state.completedCount=Math.max(state.completedCount,Math.max(0,Number(local.completedCount||0)));state.serverCompletedCount=Math.max(state.serverCompletedCount,Math.max(0,Number(local.serverCompletedCount||0)));}
    state.completedCount=Math.max(state.completedCount,state.serverCompletedCount);
    state.completedCount=Math.min(state.completedCount,expectedCount());
    state.queue=state.queue.filter(item=>Math.max(0,Number(item.order||0))>state.serverCompletedCount);
    persist();
  }

  async function preloadQrReader(){
    if("BarcodeDetector" in window||window.jsQR)return true;
    if(state.qrLoading)return state.qrLoading;
    state.qrLoading=new Promise(resolve=>{
      const existing=document.querySelector('script[data-m2-jsqr="1"]');
      if(existing){existing.addEventListener("load",()=>resolve(Boolean(window.jsQR)),{once:true});existing.addEventListener("error",()=>resolve(false),{once:true});return;}
      const script=document.createElement("script");script.src=JSQR_URL;script.async=true;script.dataset.m2Jsqr="1";script.onload=()=>resolve(Boolean(window.jsQR));script.onerror=()=>resolve(false);document.head.appendChild(script);
    }).finally(()=>{state.qrLoading=null;});
    return state.qrLoading;
  }

  async function configure({context,plan,progress,status}={}){
    closeScanner();
    state.context=context?{...context}:null;
    state.plan=plan&&typeof plan==="object"?JSON.parse(JSON.stringify(plan)):null;
    state.raceStatus=String(status||"ready").toLowerCase();
    state.completedCount=0;state.serverCompletedCount=0;state.queue=[];state.passes=[];state.lastFix=null;state.lastAutoAt=0;
    state.storageKey=contextKey();
    progressFromServer(progress||null);reconcile();
    // Precarga el lector mientras aún hay cobertura. Después puede usarse si falla el GPS.
    preloadQrReader().catch(()=>{});
    if(navigator.onLine!==false)flush().catch(()=>{});
    emit("ready");
    return snapshot();
  }

  function setRaceStatus(status){state.raceStatus=String(status||"").toLowerCase();if(!["racing","started"].includes(state.raceStatus))closeScanner();emit("status");}

  async function refreshFromServer(){
    if(!state.context?.eventId)return false;
    try{const svc=await services();const result=await svc.callable("runnerJoinLive",{eventId:state.context.eventId,clientVersion:VERSION});const data=result?.data||{};if(data.controlPlan)state.plan=data.controlPlan;progressFromServer(data.controlProgress||null);reconcile();emit("reconciled");return true;}catch(_){return false;}
  }

  async function flush(){
    if(state.flushing||!state.queue.length||navigator.onLine===false||!state.context?.eventId)return state.queue.length===0;
    state.flushing=true;emit("syncing");
    try{
      const svc=await services();
      while(state.queue.length&&navigator.onLine!==false){
        const item=state.queue[0];
        try{
          const result=await svc.callable("runnerRegisterControlPass",{eventId:state.context.eventId,clientVersion:VERSION,...item});
          const data=result?.data||{};progressFromServer(data.progress||{completedCount:data.completedCount});
          state.queue.shift();reconcile();emit("synced",{pass:item,server:data});
        }catch(error){
          const msg=String(error?.message||error||"");
          if(/siguiente baliza|already|ya est|orden|failed-precondition/i.test(msg)){
            const ok=await refreshFromServer();
            if(ok){state.queue=state.queue.filter(q=>Number(q.order||0)>state.serverCompletedCount);persist();if(!state.queue.length)break;}
          }
          emit(navigator.onLine===false?"offline":"sync_error",{message:msg});
          break;
        }
      }
      return state.queue.length===0;
    }finally{state.flushing=false;persist();}
  }

  function registerLocal(checkpointId,source,meta={}){
    if(!["racing","started"].includes(state.raceStatus))return {ok:false,message:"La carrera todavía no está iniciada."};
    const next=nextControl();const id=canonical(checkpointId);
    if(!next)return {ok:false,message:"Todas las balizas del recorrido ya están validadas."};
    if(id!==canonical(next.checkpointId))return {ok:false,message:`La siguiente baliza es ${next.checkpointId}.`};
    const now=Math.max(0,Number(meta.passedAtMs||Date.now()));
    const previous=state.passes[state.passes.length-1]||null;
    const startedAt=Math.max(0,Number(meta.startedAt||0));
    const pass={order:state.completedCount+1,checkpointId:id,source,passedAtMs:now,elapsedMs:startedAt?Math.max(0,now-startedAt):null,splitMs:previous?.passedAtMs?Math.max(0,now-Number(previous.passedAtMs)):null,distanceM:meta.distanceM==null?null:Math.round(Number(meta.distanceM)*10)/10,allowedRadiusM:meta.allowedRadiusM==null?null:Math.round(Number(meta.allowedRadiusM)*10)/10,gpsAccuracyM:meta.accuracy==null?null:Math.round(Number(meta.accuracy)*10)/10,lat:meta.lat==null?null:Number(meta.lat),lng:meta.lng==null?null:Number(meta.lng),accuracy:meta.accuracy==null?null:Number(meta.accuracy),attemptId:makeAttemptId(),qrRaw:source==="qr"?String(meta.qrRaw||"").trim():undefined};
    state.passes.push(pass);state.completedCount+=1;state.queue.push({...pass});state.lastAutoAt=Date.now();persist();
    try{if(navigator.vibrate)navigator.vibrate([120,70,180]);}catch(_){}
    emit("passed",{pass,nextAfter:nextControl()?{...nextControl()}:null});
    if(navigator.onLine!==false)flush().catch(()=>{});else emit("offline",{message:"Baliza guardada en el dispositivo. Se sincronizará al recuperar cobertura."});
    return {ok:true,pass};
  }

  function handleFix(fix){
    if(!fix)return;const lat=Number(fix.lat),lng=Number(fix.lng),accuracy=Math.max(0,Number(fix.accuracy||0));if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
    state.lastFix={lat,lng,accuracy,updatedAt:Number(fix.updatedAt||Date.now())};
    const next=nextControl();if(!next||!["racing","started"].includes(state.raceStatus)){emit("gps",{distanceM:null});return;}
    if(!Number.isFinite(Number(next.lat))||!Number.isFinite(Number(next.lng))){emit("gps",{distanceM:null,message:"Esta baliza no tiene coordenadas. Usa QR si es necesario."});return;}
    const distanceM=haversine({lat,lng},{lat:Number(next.lat),lng:Number(next.lng)});const radius=allowedRadius();
    const accuracyOk=Number.isFinite(accuracy)&&accuracy>0&&accuracy<=GPS_MAX_ACCURACY_M;
    emit("gps",{distanceM:Math.round(distanceM),allowedRadiusM:radius,accuracyM:Math.round(accuracy*10)/10,accuracyOk,maxAccuracyM:GPS_MAX_ACCURACY_M,captureRadiusM:GPS_CAPTURE_RADIUS_M});
    if(Date.now()-state.lastAutoAt<PASS_COOLDOWN_MS)return;
    // GPS solo valida si la posición es suficientemente fiable (±10 m o mejor)
    // y el dispositivo está físicamente a 10 m o menos del control.
    if(accuracyOk&&distanceM<=GPS_CAPTURE_RADIUS_M){registerLocal(next.checkpointId,"gps",{passedAtMs:state.lastFix.updatedAt,distanceM,allowedRadiusM:GPS_CAPTURE_RADIUS_M,accuracy,lat,lng});}
  }

  function parseQr(raw){const value=String(raw||"").trim().toUpperCase(),parts=value.split("|");if(parts.length<4||parts[0]!=="ORI"||parts[1]!=="CONTROL")return {ok:false,message:"QR no válido de MILITOPO."};if(String(parts[2])!==String(state.context?.eventId||"").toUpperCase())return {ok:false,message:"Este QR pertenece a otra carrera."};const id=canonical(parts[3]);const next=nextControl();if(!next)return {ok:false,message:"Ya has completado todas las balizas."};if(id!==canonical(next.checkpointId))return {ok:false,message:`QR de ${id}. La siguiente baliza es ${next.checkpointId}.`};return {ok:true,id,raw:value};}
  function submitQr(raw){const parsed=parseQr(raw);if(!parsed.ok){emit("qr_error",{message:parsed.message,qrRaw:String(raw||"")});return parsed;}const res=registerLocal(parsed.id,"qr",{passedAtMs:Date.now(),qrRaw:parsed.raw});if(res.ok){emit("qr_passed",{pass:res.pass});closeScanner();}return res;}

  async function openScanner({video,canvas,statusEl}={}){
    if(!video||!canvas)return false;
    if(!navigator.mediaDevices?.getUserMedia){if(statusEl)statusEl.textContent="Este navegador no permite acceder a la cámara.";emit("qr_error",{message:"Cámara no disponible."});return false;}
    closeScanner();
    let detector=null;let useJsQr=false;
    if("BarcodeDetector" in window){try{detector=new BarcodeDetector({formats:["qr_code"]});}catch(_){} }
    if(!detector){const ready=await preloadQrReader();useJsQr=ready&&Boolean(window.jsQR);}
    if(!detector&&!useJsQr){if(statusEl)statusEl.textContent="No se pudo preparar el lector QR.";emit("qr_error",{message:"Lector QR no disponible."});return false;}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}},audio:false});
      video.srcObject=stream;await video.play();
      state.scanner={stream,video,canvas,statusEl,detector,useJsQr,running:true,lastRaw:"",lastAt:0};
      if(statusEl)statusEl.textContent=`Cámara activa. Apunta al QR de ${nextControl()?.checkpointId||"la siguiente baliza"}.`;
      emit("qr_scanning");scanLoop();return true;
    }catch(error){if(statusEl)statusEl.textContent="No se pudo abrir la cámara. Revisa el permiso de cámara.";emit("qr_error",{message:String(error?.message||error)});closeScanner();return false;}
  }

  async function scanLoop(){
    const sc=state.scanner;if(!sc?.running)return;
    try{
      let raw="";
      if(sc.video.readyState>=2){
        if(sc.detector){const codes=await sc.detector.detect(sc.video);if(codes?.length)raw=String(codes[0].rawValue||"").trim();}
        else if(sc.useJsQr&&window.jsQR){const w=sc.video.videoWidth||640,h=sc.video.videoHeight||480;if(w&&h){sc.canvas.width=w;sc.canvas.height=h;const ctx=sc.canvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(sc.video,0,0,w,h);const img=ctx.getImageData(0,0,w,h);const code=window.jsQR(img.data,w,h,{inversionAttempts:"attemptBoth"});if(code?.data)raw=String(code.data).trim();}}
      }
      if(raw){const now=Date.now();if(raw!==sc.lastRaw||now-sc.lastAt>2200){sc.lastRaw=raw;sc.lastAt=now;const result=submitQr(raw);if(sc.statusEl)sc.statusEl.textContent=result.ok?"QR validado correctamente.":result.message;}}
      else if(sc.statusEl)sc.statusEl.textContent=`Buscando QR de ${nextControl()?.checkpointId||"la siguiente baliza"}…`;
    }catch(_){if(sc.statusEl)sc.statusEl.textContent="Buscando QR…";}
    if(state.scanner?.running)state.scannerFrame=requestAnimationFrame(scanLoop);
  }

  function closeScanner(){const sc=state.scanner;if(sc){sc.running=false;try{sc.stream?.getTracks?.().forEach(t=>t.stop());}catch(_){}try{sc.video.srcObject=null;}catch(_){}}if(state.scannerFrame)cancelAnimationFrame(state.scannerFrame);state.scannerFrame=0;state.scanner=null;emit("qr_closed");}
  function snapshot(){return {configured:Boolean(state.context&&state.plan),raceStatus:state.raceStatus,completedCount:state.completedCount,serverCompletedCount:state.serverCompletedCount,expectedCount:expectedCount(),nextControl:nextControl()?{...nextControl()}:null,pending:state.queue.length,lastFix:state.lastFix?{...state.lastFix}:null};}
  function stop(){closeScanner();persist();state.raceStatus="finished";emit("stopped");}

  window.addEventListener("militopo:v2-gps-fix",event=>{const fix=event.detail?.fix;if(fix)handleFix(fix);});
  window.addEventListener("online",()=>flush().catch(()=>{}));
  window.addEventListener("pagehide",persist);

  globalThis.MILITOPO_RUNNER_CONTROLS_V2=Object.freeze({configure,setRaceStatus,flush,refreshFromServer,openScanner,closeScanner,submitQr,snapshot,stop,version:VERSION});
})();
