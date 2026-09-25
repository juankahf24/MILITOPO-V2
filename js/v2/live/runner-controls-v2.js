/* MILITOPO V2 · H6.3 · Controles Live robustos + llegada GPS/QR.
   - Balizas en orden por GPS estricto (<=10 m y precisión <=10 m) o QR.
   - LLEGADA es el último objetivo y se valida igual que una baliza.
   - Cola local robusta, reintentos y recuperación tras recarga. */
(function(){
  "use strict";

  const VERSION="v2-h6-5-authoritative-sync-modal-fix-20260925";
  const JSQR_URL="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
  const PASS_COOLDOWN_MS=4500;
  const GPS_MAX_ACCURACY_M=10;
  const GPS_CAPTURE_RADIUS_M=10;

  const state={
    services:null,context:null,plan:null,raceStatus:"ready",completedCount:0,
    serverCompletedCount:0,queue:[],passes:[],lastFix:null,lastAutoAt:0,
    finishValidated:false,serverFinishValidated:false,finishPass:null,serverAttemptIds:new Set(),
    flushing:false,flushAgain:false,retryTimer:0,storageKey:"",scanner:null,scannerFrame:0,qrLoading:null,
    localHydrated:false,lastSyncError:"",syncFailureCount:0
  };

  async function services(){if(!state.services)state.services=await globalThis.MILITOPO_V2.firebase();return state.services;}
  const canonical=value=>{const u=String(value||"").trim().toUpperCase();if(["S","SALIDA","START"].includes(u))return "START";if(["L","META","LLEGADA","FINISH"].includes(u))return "FINISH";return u;};
  function haversine(a,b){if(!a||!b)return Infinity;const R=6371000,rad=Math.PI/180,p1=Number(a.lat)*rad,p2=Number(b.lat)*rad,dp=(Number(b.lat)-Number(a.lat))*rad,dl=(Number(b.lng)-Number(a.lng))*rad,h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
  function controlList(){return Array.isArray(state.plan?.controls)?state.plan.controls:[];}
  function expectedCount(){return Math.max(0,Number(state.plan?.expectedCount||controlList().length||0));}
  function finishTarget(){const f=state.plan?.finish;if(f&&typeof f==="object")return {...f,kind:"finish",checkpointId:"FINISH"};return null;}
  function nextTarget(){if(state.completedCount<expectedCount())return {...controlList()[state.completedCount],kind:"control"};if(!state.finishValidated)return finishTarget();return null;}
  function makeAttemptId(){try{return crypto.randomUUID().replace(/-/g,"");}catch(_){return `a_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;}}
  function contextKey(ctx=state.context){if(!ctx?.uid||!ctx?.eventId||!ctx?.runId)return "";return `militopo_v2_controls_${ctx.uid}_${ctx.eventId}_${ctx.runId}`;}
  function emit(status,detail={}){const next=nextTarget();window.dispatchEvent(new CustomEvent("militopo:v2-control-status",{detail:{status,version:VERSION,raceStatus:state.raceStatus,completedCount:state.completedCount,expectedCount:expectedCount(),nextControl:next?{...next}:null,finishValidated:state.finishValidated,finishPass:state.finishPass?{...state.finishPass}:null,lastFix:state.lastFix?{...state.lastFix}:null,pending:state.queue.length,...detail}}));}
  function safeLoad(){if(!state.storageKey)return null;try{const raw=localStorage.getItem(state.storageKey);const x=raw?JSON.parse(raw):null;return x&&typeof x==="object"?x:null;}catch(_){return null;}}
  function persist(){if(!state.storageKey)return;try{localStorage.setItem(state.storageKey,JSON.stringify({v:2,completedCount:state.completedCount,serverCompletedCount:state.serverCompletedCount,queue:state.queue.slice(-160),passes:state.passes.slice(-160),finishValidated:state.finishValidated,serverFinishValidated:state.serverFinishValidated,finishPass:state.finishPass,savedAt:Date.now()}));}catch(_){}}
  function clearRetry(){if(state.retryTimer){clearTimeout(state.retryTimer);state.retryTimer=0;}}
  function scheduleRetry(ms=1200){clearRetry();if(navigator.onLine===false||!state.queue.length)return;state.retryTimer=setTimeout(()=>{state.retryTimer=0;flush().catch(()=>{});},ms);}

  function progressFromServer(progress){
    const server = progress && typeof progress === "object" ? progress : {};
    const n=Math.max(0,Number(server.completedCount||0));
    // El servidor es la única autoridad sobre lo que ya está sincronizado.
    // Nunca usamos Math.max con una copia local antigua: si el servidor dice 0, es 0.
    state.serverCompletedCount=Math.min(n,expectedCount());
    state.serverAttemptIds=new Set();
    const serverPasses=server.passes&&typeof server.passes==="object"?Object.values(server.passes):[];
    for(const row of serverPasses){if(row?.attemptId)state.serverAttemptIds.add(String(row.attemptId));}
    if(server?.finishPass?.attemptId)state.serverAttemptIds.add(String(server.finishPass.attemptId));

    // Conservamos el historial local completo y superponemos la versión confirmada por servidor.
    const localByOrder=new Map((state.passes||[]).map(row=>[Number(row.order||0),{...row}]));
    for(const row of serverPasses)localByOrder.set(Number(row.order||0),{...row});
    state.passes=Array.from(localByOrder.values())
      .filter(row=>canonical(row.checkpointId)!=="FINISH")
      .sort((a,b)=>Number(a.order||0)-Number(b.order||0));

    state.serverFinishValidated=Boolean(server.finishValidated);
    if(state.serverFinishValidated){
      state.finishValidated=true;
      state.finishPass=server.finishPass?{...server.finishPass}:(state.finishPass||null);
    }
    rebuildPendingQueue();
  }

  function hydrateLocalOnce(){
    if(state.localHydrated)return;
    state.localHydrated=true;
    const local=safeLoad();
    if(!local)return;
    state.passes=Array.isArray(local.passes)?local.passes:[];
    state.completedCount=Math.max(0,Number(local.completedCount||0));
    state.queue=Array.isArray(local.queue)?local.queue:[];
    if(local.finishValidated){state.finishValidated=true;state.finishPass=local.finishPass||null;}
  }

  function rebuildPendingQueue(){
    const pending=[];
    const seen=new Set();
    const normal=(state.passes||[]).slice().sort((a,b)=>Number(a.order||0)-Number(b.order||0));
    for(const item of normal){
      const attempt=String(item?.attemptId||"");
      const order=Math.max(0,Number(item?.order||0));
      if(!attempt||seen.has(attempt)||state.serverAttemptIds.has(attempt))continue;
      if(order<=state.serverCompletedCount)continue;
      pending.push({...item});seen.add(attempt);
    }
    if(state.finishValidated&&!state.serverFinishValidated&&state.finishPass){
      const attempt=String(state.finishPass.attemptId||"");
      if(attempt&&!seen.has(attempt)&&!state.serverAttemptIds.has(attempt)){pending.push({...state.finishPass});seen.add(attempt);}
    }
    // Conserva cualquier elemento legado de cola que no exista aún en passes, pero sin saltar controles anteriores.
    for(const item of state.queue||[]){
      const attempt=String(item?.attemptId||"");
      if(!attempt||seen.has(attempt)||state.serverAttemptIds.has(attempt))continue;
      const order=Math.max(0,Number(item?.order||0));
      if(canonical(item?.checkpointId)!=="FINISH"&&order<=state.serverCompletedCount)continue;
      pending.push({...item});seen.add(attempt);
    }
    pending.sort((a,b)=>Number(a.order||9999)-Number(b.order||9999));
    state.queue=pending;
    const localCompleted=normal.reduce((m,row)=>Math.max(m,Math.max(0,Number(row.order||0))),0);
    state.completedCount=Math.min(Math.max(state.serverCompletedCount,localCompleted),expectedCount());
  }

  function reconcile(){
    rebuildPendingQueue();
    persist();
  }

  async function preloadQrReader(){
    if("BarcodeDetector" in window||window.jsQR)return true;
    if(state.qrLoading)return state.qrLoading;
    state.qrLoading=new Promise(resolve=>{
      const existing=document.querySelector('script[data-m2-jsqr="1"]');
      if(existing){if(window.jsQR)return resolve(true);existing.addEventListener("load",()=>resolve(Boolean(window.jsQR)),{once:true});existing.addEventListener("error",()=>resolve(false),{once:true});return;}
      const script=document.createElement("script");script.src=JSQR_URL;script.async=true;script.dataset.m2Jsqr="1";script.onload=()=>resolve(Boolean(window.jsQR));script.onerror=()=>resolve(false);document.head.appendChild(script);
    }).finally(()=>{state.qrLoading=null;});
    return state.qrLoading;
  }

  async function configure({context,plan,progress,status}={}){
    closeScanner({silent:true});clearRetry();
    state.context=context?{...context}:null;
    state.plan=plan&&typeof plan==="object"?JSON.parse(JSON.stringify(plan)):null;
    state.raceStatus=String(status||"ready").toLowerCase();
    state.completedCount=0;state.serverCompletedCount=0;state.queue=[];state.passes=[];state.lastFix=null;state.lastAutoAt=0;state.finishValidated=false;state.serverFinishValidated=false;state.finishPass=null;state.serverAttemptIds=new Set();state.flushing=false;state.flushAgain=false;state.localHydrated=false;state.lastSyncError="";state.syncFailureCount=0;
    state.storageKey=contextKey();
    hydrateLocalOnce();
    progressFromServer(progress||null);reconcile();
    preloadQrReader().catch(()=>{});
    if(navigator.onLine!==false)flush().catch(()=>{});
    emit("ready");
    return snapshot();
  }

  function setRaceStatus(status){state.raceStatus=String(status||"").toLowerCase();if(!["racing","started"].includes(state.raceStatus))closeScanner({silent:true});emit("status");}

  async function refreshFromServer(){
    if(!state.context?.eventId)return false;
    try{const svc=await services();const result=await svc.callable("runnerJoinLive",{eventId:state.context.eventId,clientVersion:VERSION});const data=result?.data||{};if(data.controlPlan)state.plan=data.controlPlan;progressFromServer(data.controlProgress||null);reconcile();emit("reconciled");return true;}catch(_){return false;}
  }

  async function flush(){
    rebuildPendingQueue();
    if(navigator.onLine===false||!state.context?.eventId){emit("offline",{message:"Validación guardada en el dispositivo. Se sincronizará al recuperar cobertura."});return state.queue.length===0;}
    if(state.flushing){state.flushAgain=true;return false;}
    if(!state.queue.length){state.lastSyncError="";state.syncFailureCount=0;return true;}
    clearRetry();state.flushing=true;emit("syncing",{pending:state.queue.length});
    try{
      const svc=await services();
      let guard=0;
      while(state.queue.length&&navigator.onLine!==false&&guard<5){
        guard+=1;
        // Antes de enviar, reconstruimos desde TODO el historial local. Así una baliza
        // no puede desaparecer de la cola mientras el servidor todavía la espera.
        rebuildPendingQueue();
        const batch=state.queue.slice(0,60).map(item=>({...item}));
        const before=state.queue.length;
        if(!batch.length)break;
        try{
          const result=await svc.callable("runnerSyncControlPasses",{eventId:state.context.eventId,clientVersion:VERSION,passes:batch});
          const data=result?.data||{};
          progressFromServer(data.progress||null);
          reconcile();
          state.lastSyncError="";state.syncFailureCount=0;
          emit(state.queue.length?"syncing":"synced",{syncedCount:Math.max(0,before-state.queue.length),pending:state.queue.length,server:data});
          if(state.queue.length>=before&&state.queue.length){
            // El servidor no avanzó: refrescamos una vez su progreso real antes de reintentar.
            await refreshFromServer();
            rebuildPendingQueue();
            if(state.queue.length>=before)break;
          }
        }catch(error){
          const msg=String(error?.message||error||"");
          state.lastSyncError=msg;state.syncFailureCount+=1;
          // Si el servidor dice que espera una baliza anterior, releemos su estado y
          // reconstruimos la cola completa desde passes locales (B1+B2+...).
          await refreshFromServer();
          rebuildPendingQueue();
          if(state.queue.length&&guard<3){
            const first=String(state.queue[0]?.checkpointId||"");
            const expectedMatch=/siguiente validaci[oó]n es\s+([^\.\[]+)/i.exec(msg);
            if(expectedMatch&&canonical(expectedMatch[1])===canonical(first))continue;
          }
          emit(navigator.onLine===false?"offline":"sync_error",{message:msg,pending:state.queue.length});
          scheduleRetry(Math.min(6000,1800+state.syncFailureCount*900));
          break;
        }
      }
      return state.queue.length===0;
    }finally{
      state.flushing=false;persist();
      if((state.flushAgain||state.queue.length)&&navigator.onLine!==false){state.flushAgain=false;scheduleRetry(state.queue.length?Math.min(5000,1200+state.syncFailureCount*700):250);}
    }
  }

  function registerLocal(checkpointId,source,meta={}){
    if(!["racing","started"].includes(state.raceStatus))return {ok:false,message:"La carrera todavía no está iniciada."};
    const target=nextTarget();const id=canonical(checkpointId);
    if(!target)return {ok:false,message:"El recorrido y la llegada ya están validados."};
    if(id!==canonical(target.checkpointId))return {ok:false,message:`La siguiente validación es ${canonical(target.checkpointId)==="FINISH"?"LLEGADA":target.checkpointId}.`};
    const now=Math.max(0,Number(meta.passedAtMs||Date.now()));
    const previous=state.passes[state.passes.length-1]||null;
    const startedAt=Math.max(0,Number(meta.startedAt||0));
    const isFinish=id==="FINISH";
    const pass={order:isFinish?expectedCount()+1:state.completedCount+1,kind:isFinish?"finish":"control",checkpointId:id,source,passedAtMs:now,elapsedMs:startedAt?Math.max(0,now-startedAt):null,splitMs:previous?.passedAtMs?Math.max(0,now-Number(previous.passedAtMs)):null,distanceM:meta.distanceM==null?null:Math.round(Number(meta.distanceM)*10)/10,allowedRadiusM:meta.allowedRadiusM==null?null:Math.round(Number(meta.allowedRadiusM)*10)/10,gpsAccuracyM:meta.accuracy==null?null:Math.round(Number(meta.accuracy)*10)/10,lat:meta.lat==null?null:Number(meta.lat),lng:meta.lng==null?null:Number(meta.lng),accuracy:meta.accuracy==null?null:Number(meta.accuracy),attemptId:makeAttemptId(),qrRaw:source==="qr"?String(meta.qrRaw||"").trim():undefined};
    if(isFinish){state.finishValidated=true;state.finishPass={...pass};}
    else{state.passes.push(pass);state.completedCount=Math.min(expectedCount(),state.completedCount+1);}
    state.queue.push({...pass});state.lastAutoAt=Date.now();persist();
    try{if(navigator.vibrate)navigator.vibrate(isFinish?[220,80,220,80,320]:[120,70,180]);}catch(_){}
    emit(isFinish?"arrival_local":"passed",{pass,nextAfter:nextTarget()?{...nextTarget()}:null});
    if(navigator.onLine!==false)flush().catch(()=>{});else emit("offline",{message:isFinish?"Llegada guardada en el dispositivo. Se finalizará automáticamente al recuperar cobertura.":"Baliza guardada en el dispositivo. Se sincronizará al recuperar cobertura."});
    return {ok:true,pass};
  }

  function handleFix(fix){
    if(!fix)return;const lat=Number(fix.lat),lng=Number(fix.lng),accuracy=Math.max(0,Number(fix.accuracy||0));if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
    state.lastFix={lat,lng,accuracy,updatedAt:Number(fix.updatedAt||Date.now())};
    const next=nextTarget();if(!next||!["racing","started"].includes(state.raceStatus)){emit("gps",{distanceM:null});return;}
    if(!Number.isFinite(Number(next.lat))||!Number.isFinite(Number(next.lng))){emit("gps",{distanceM:null,message:canonical(next.checkpointId)==="FINISH"?"La llegada no tiene coordenadas. Usa el QR de LLEGADA.":"Esta baliza no tiene coordenadas. Usa QR si es necesario."});return;}
    const distanceM=haversine({lat,lng},{lat:Number(next.lat),lng:Number(next.lng)});const accuracyOk=Number.isFinite(accuracy)&&accuracy>0&&accuracy<=GPS_MAX_ACCURACY_M;
    emit("gps",{distanceM:Math.round(distanceM),allowedRadiusM:GPS_CAPTURE_RADIUS_M,accuracyM:Math.round(accuracy*10)/10,accuracyOk,maxAccuracyM:GPS_MAX_ACCURACY_M,captureRadiusM:GPS_CAPTURE_RADIUS_M,targetKind:next.kind});
    if(Date.now()-state.lastAutoAt<PASS_COOLDOWN_MS)return;
    if(accuracyOk&&distanceM<=GPS_CAPTURE_RADIUS_M)registerLocal(next.checkpointId,"gps",{passedAtMs:state.lastFix.updatedAt,distanceM,allowedRadiusM:GPS_CAPTURE_RADIUS_M,accuracy,lat,lng});
  }

  function parseQr(raw){const value=String(raw||"").trim().toUpperCase(),parts=value.split("|");if(parts.length<4||parts[0]!=="ORI"||parts[1]!=="CONTROL")return {ok:false,message:"QR no válido de MILITOPO."};if(String(parts[2])!==String(state.context?.eventId||"").toUpperCase())return {ok:false,message:"Este QR pertenece a otra carrera."};const id=canonical(parts[3]);const next=nextTarget();if(!next)return {ok:false,message:"El recorrido y la llegada ya están validados."};if(id!==canonical(next.checkpointId))return {ok:false,message:`QR de ${id==="FINISH"?"LLEGADA":id}. La siguiente validación es ${canonical(next.checkpointId)==="FINISH"?"LLEGADA":next.checkpointId}.`};return {ok:true,id,raw:value};}
  function submitQr(raw){const parsed=parseQr(raw);if(!parsed.ok){emit("qr_error",{message:parsed.message,qrRaw:String(raw||"")});return parsed;}const res=registerLocal(parsed.id,"qr",{passedAtMs:Date.now(),qrRaw:parsed.raw});if(res.ok){emit(parsed.id==="FINISH"?"arrival_qr":"qr_passed",{pass:res.pass});closeScanner();}return res;}

  async function openScanner({video,canvas,statusEl}={}){
    if(!video||!canvas)return false;
    if(!navigator.mediaDevices?.getUserMedia){if(statusEl)statusEl.textContent="Este navegador no permite acceder a la cámara.";emit("qr_error",{message:"Cámara no disponible."});return false;}
    closeScanner({silent:true});if(statusEl)statusEl.textContent="Solicitando cámara…";
    let stream=null;
    try{try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}},audio:false});}catch(_){stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});}video.setAttribute("playsinline","");video.setAttribute("webkit-playsinline","");video.setAttribute("autoplay","");video.muted=true;video.autoplay=true;video.srcObject=stream;await video.play();}
    catch(error){try{stream?.getTracks?.().forEach(t=>t.stop());}catch(_){}const name=String(error?.name||"");const msg=/NotAllowed|Permission/i.test(name)?"Permiso de cámara denegado. Actívalo para MILITOPO en los ajustes del navegador.":"No se pudo abrir la cámara. Revisa el permiso de cámara.";if(statusEl)statusEl.textContent=msg;emit("qr_error",{message:msg,detail:String(error?.message||error)});return false;}
    let detector=null,useJsQr=false;if("BarcodeDetector" in window){try{detector=new BarcodeDetector({formats:["qr_code"]});}catch(_){}}
    if(!detector){if(statusEl)statusEl.textContent="Cámara activa · preparando lector QR…";const ready=await preloadQrReader();useJsQr=ready&&Boolean(window.jsQR);}
    if(!detector&&!useJsQr){try{stream?.getTracks?.().forEach(t=>t.stop());}catch(_){}try{video.srcObject=null;}catch(_){}if(statusEl)statusEl.textContent="La cámara funciona, pero no se pudo preparar el lector QR.";emit("qr_error",{message:"Lector QR no disponible."});return false;}
    state.scanner={stream,video,canvas,statusEl,detector,useJsQr,running:true,lastRaw:"",lastAt:0};const target=nextTarget();if(statusEl)statusEl.textContent=`Cámara activa. Apunta al QR de ${canonical(target?.checkpointId)==="FINISH"?"LLEGADA":target?.checkpointId||"la siguiente baliza"}.`;emit("qr_scanning");setTimeout(()=>{try{video.play();}catch(_){}},250);scanLoop();return true;
  }

  async function scanLoop(){const sc=state.scanner;if(!sc?.running)return;try{let raw="";if(sc.video.readyState>=2){if(sc.detector){const codes=await sc.detector.detect(sc.video);if(codes?.length)raw=String(codes[0].rawValue||"").trim();}else if(sc.useJsQr&&window.jsQR){const w=sc.video.videoWidth||640,h=sc.video.videoHeight||480;if(w&&h){sc.canvas.width=w;sc.canvas.height=h;const ctx=sc.canvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(sc.video,0,0,w,h);const img=ctx.getImageData(0,0,w,h);const code=window.jsQR(img.data,w,h,{inversionAttempts:"attemptBoth"});if(code?.data)raw=String(code.data).trim();}}}if(raw){const now=Date.now();if(raw!==sc.lastRaw||now-sc.lastAt>2200){sc.lastRaw=raw;sc.lastAt=now;const result=submitQr(raw);if(sc.statusEl)sc.statusEl.textContent=result.ok?"QR validado correctamente.":result.message;}}else if(sc.statusEl){const target=nextTarget();sc.statusEl.textContent=`Buscando QR de ${canonical(target?.checkpointId)==="FINISH"?"LLEGADA":target?.checkpointId||"la siguiente baliza"}…`;}}catch(_){if(sc.statusEl)sc.statusEl.textContent="Buscando QR…";}if(state.scanner?.running)state.scannerFrame=requestAnimationFrame(scanLoop);}

  async function scanImageFile(file,{canvas,statusEl}={}){if(!file)return {ok:false,message:"No se recibió ninguna imagen."};const workCanvas=canvas||document.createElement("canvas");let source=null,revoke="";try{if("createImageBitmap" in window){source=await createImageBitmap(file);}else{revoke=URL.createObjectURL(file);source=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error("No se pudo abrir la foto."));img.src=revoke;});}const sw=Number(source.width||source.naturalWidth||0),sh=Number(source.height||source.naturalHeight||0);if(!sw||!sh)throw new Error("La imagen de la cámara no es válida.");const maxSide=1800,scale=Math.min(1,maxSide/Math.max(sw,sh)),w=Math.max(1,Math.round(sw*scale)),h=Math.max(1,Math.round(sh*scale));workCanvas.width=w;workCanvas.height=h;const ctx=workCanvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(source,0,0,w,h);let raw="";if("BarcodeDetector" in window){try{const detector=new BarcodeDetector({formats:["qr_code"]});const codes=await detector.detect(workCanvas);if(codes?.length)raw=String(codes[0].rawValue||"").trim();}catch(_){}}if(!raw){const ready=await preloadQrReader();if(ready&&window.jsQR){const img=ctx.getImageData(0,0,w,h),code=window.jsQR(img.data,w,h,{inversionAttempts:"attemptBoth"});if(code?.data)raw=String(code.data).trim();}}if(!raw){const msg="No se ha detectado ningún QR en la imagen. Acerca más la cámara y vuelve a intentarlo.";if(statusEl)statusEl.textContent=msg;emit("qr_error",{message:msg});return {ok:false,message:msg};}const result=submitQr(raw);if(statusEl)statusEl.textContent=result.ok?"QR validado correctamente.":result.message;return result;}catch(error){const msg=String(error?.message||error||"No se pudo leer el QR.");if(statusEl)statusEl.textContent=msg;emit("qr_error",{message:msg});return {ok:false,message:msg};}finally{try{source?.close?.();}catch(_){}if(revoke)try{URL.revokeObjectURL(revoke);}catch(_){}}}

  function closeScanner(options={}){const silent=Boolean(options&&options.silent),sc=state.scanner;if(sc){sc.running=false;try{sc.stream?.getTracks?.().forEach(t=>t.stop());}catch(_){}try{sc.video.srcObject=null;}catch(_){}}if(state.scannerFrame)cancelAnimationFrame(state.scannerFrame);state.scannerFrame=0;state.scanner=null;if(!silent)emit("qr_closed");}
  function snapshot(){return {configured:Boolean(state.context&&state.plan),raceStatus:state.raceStatus,completedCount:state.completedCount,serverCompletedCount:state.serverCompletedCount,expectedCount:expectedCount(),nextControl:nextTarget()?{...nextTarget()}:null,finishValidated:state.finishValidated,serverFinishValidated:state.serverFinishValidated,finishPass:state.finishPass?{...state.finishPass}:null,pending:state.queue.length,syncing:state.flushing,lastSyncError:state.lastSyncError,syncFailureCount:state.syncFailureCount,lastFix:state.lastFix?{...state.lastFix}:null};}
  function pendingPasses(){return state.queue.map(item=>({...item}));}
  function stop(){closeScanner({silent:true});clearRetry();persist();state.raceStatus="finished";emit("stopped");}

  window.addEventListener("militopo:v2-gps-fix",event=>{const fix=event.detail?.fix;if(fix)handleFix(fix);});
  window.addEventListener("online",()=>{state.flushAgain=true;flush().catch(()=>{});});
  window.addEventListener("pagehide",persist);

  globalThis.MILITOPO_RUNNER_CONTROLS_V2=Object.freeze({configure,setRaceStatus,flush,refreshFromServer,openScanner,scanImageFile,closeScanner,submitQr,snapshot,pendingPasses,stop,version:VERSION});
})();
