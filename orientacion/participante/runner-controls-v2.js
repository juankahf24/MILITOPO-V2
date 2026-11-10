/* MILITOPO Orientación · Control de balizas y llegada GPS/QR.
   Variante de Orientación del módulo Live compartido. Mantiene su API y el formato local v3.
   - Balizas en orden por GPS estricto (<=10 m y precisión <=10 m) o QR.
   - LLEGADA es el último objetivo y se valida igual que una baliza.
   - Cola local robusta, reintentos y recuperación tras recarga. */
(function(){
  "use strict";

  const VERSION="v2.0.11-orientacion";
  const JSQR_URL="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
  const PASS_COOLDOWN_MS=4500;
  const GPS_MAX_ACCURACY_M=10;
  const GPS_CAPTURE_RADIUS_M=10;
  const CONTROL_PENALTY_MS=15*60*1000;

  const state={
    services:null,context:null,plan:null,raceStatus:"ready",completedCount:0,
    serverCompletedCount:0,queue:[],passes:[],journal:[],lastFix:null,lastAutoAt:0,
    finishValidated:false,serverFinishValidated:false,finishPass:null,serverAttemptIds:new Set(),
    flushing:false,flushAgain:false,retryTimer:0,storageKey:"",scanner:null,qrEpoch:0,qrLoading:null,
    epoch:0,runConflict:false,localHydrated:false,lastSyncError:"",syncFailureCount:0,localStorageError:""
  };

  async function services(){if(!state.services)state.services=await globalThis.MILITOPO_V2.firebase();return state.services;}
  function token(){return {epoch:state.epoch,context:{...(state.context||{})}};}
  function current(t){const auth=globalThis.MILITOPO_V2_AUTH;return t.epoch===state.epoch&&["uid","ownerUid","eventId","runId"].every(k=>t.context[k]===state.context?.[k])&&(!auth||(auth.uid===t.context.uid&&auth.role==="runner"));}
  function checkRun(data,t){if((data?.runId&&String(data.runId)!==t.context.runId)||(data?.eventId&&String(data.eventId)!==t.context.eventId)){const e=new Error("La sesión activa ha cambiado. Conservamos las balizas de tu participación original.");e.details={reason:"RUN_CHANGED"};throw e;}}
  const canonical=value=>{const u=String(value||"").trim().toUpperCase();if(["S","SALIDA","START"].includes(u))return "START";if(["L","META","LLEGADA","FINISH"].includes(u))return "FINISH";return u;};
  function haversine(a,b){if(!a||!b)return Infinity;const R=6371000,rad=Math.PI/180,p1=Number(a.lat)*rad,p2=Number(b.lat)*rad,dp=(Number(b.lat)-Number(a.lat))*rad,dl=(Number(b.lng)-Number(a.lng))*rad,h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*R*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
  function controlList(){return Array.isArray(state.plan?.controls)?state.plan.controls:[];}
  function expectedCount(){return Math.max(0,Number(state.plan?.expectedCount||controlList().length||0));}
  function finishTarget(){const f=state.plan?.finish;if(f&&typeof f==="object")return {...f,kind:"finish",checkpointId:"FINISH"};return null;}
  function nextTarget(){if(state.completedCount<expectedCount())return {...controlList()[state.completedCount],kind:"control"};if(!state.finishValidated)return finishTarget();return null;}
  function makeAttemptId(){try{return crypto.randomUUID().replace(/-/g,"");}catch(_){return `a_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;}}
  function contextKey(ctx=state.context){if(!ctx?.uid||!ctx?.eventId||!ctx?.runId)return "";return `militopo_v2_controls_${ctx.uid}_${ctx.eventId}_${ctx.runId}`;}
  function courseStats(){
    const expected=expectedCount();
    const completed=Math.min(expected,Math.max(0,Number(state.completedCount||0)));
    const discarded=(state.passes||[]).filter(row=>String(row?.source||"").toLowerCase()==="discard"||row?.discarded===true).length;
    const pendingControls=Math.max(0,expected-completed);
    const penaltyAccumulatedMs=discarded*CONTROL_PENALTY_MS;
    return {expected,completed,discarded,pendingControls,penaltyAccumulatedMs,penaltyPreviewMs:penaltyAccumulatedMs};
  }
  function progressPasses(){return (state.passes||[]).map(row=>({order:Number(row?.order||0),checkpointId:String(row?.checkpointId||""),source:String(row?.source||""),discarded:Boolean(row?.discarded||String(row?.source||"").toLowerCase()==="discard")}));}
  function emit(status,detail={}){const next=nextTarget(),stats=courseStats();window.dispatchEvent(new CustomEvent("militopo:v2-control-status",{detail:{status,version:VERSION,context:state.context?{...state.context}:null,raceStatus:state.raceStatus,completedCount:state.completedCount,expectedCount:stats.expected,discardedControlCount:stats.discarded,pendingControlCount:stats.pendingControls,penaltyAccumulatedMs:stats.penaltyAccumulatedMs,penaltyPreviewMs:stats.penaltyPreviewMs,progressPasses:progressPasses(),nextControl:next?{...next}:null,finishValidated:state.finishValidated,serverFinishValidated:state.serverFinishValidated,finishPass:state.finishPass?{...state.finishPass}:null,lastFix:state.lastFix?{...state.lastFix}:null,pending:state.queue.length,localStorageError:state.localStorageError,...detail}}));}
  function safeLoad(){if(!state.storageKey)return null;try{const raw=localStorage.getItem(state.storageKey);const x=raw?JSON.parse(raw):null;return x&&typeof x==="object"?x:null;}catch(_){return null;}}
  function journalAdd(item,journal=state.journal){
    if(!item||typeof item!=="object")return;
    const row={...item};
    const attempt=String(row.attemptId||"");
    const order=Math.max(0,Number(row.order||0));
    const id=canonical(row.checkpointId);
    const idx=journal.findIndex(x=>{
      if(attempt&&String(x?.attemptId||"")===attempt)return true;
      return !attempt&&order>0&&Number(x?.order||0)===order&&canonical(x?.checkpointId)===id;
    });
    if(idx>=0)journal[idx]={...journal[idx],...row};else journal.push(row);
    journal.sort((a,b)=>Number(a.order||9999)-Number(b.order||9999));
    if(journal.length>240)journal.splice(0,journal.length-240);
  }
  function syncPayload(){
    const rows=[];const seen=new Set();
    for(const raw of state.journal||[]){
      if(!raw||typeof raw!=="object")continue;
      const attempt=String(raw.attemptId||"");
      const fallback=`${Number(raw.order||0)}|${canonical(raw.checkpointId)}|${Number(raw.passedAtMs||0)}`;
      const key=attempt||fallback;if(seen.has(key))continue;seen.add(key);rows.push({...raw});
    }
    if(state.finishValidated&&state.finishPass){
      const attempt=String(state.finishPass.attemptId||"");
      const key=attempt||`F|${Number(state.finishPass.passedAtMs||0)}`;
      if(!seen.has(key)){seen.add(key);rows.push({...state.finishPass});}
    }
    rows.sort((a,b)=>Number(a.order||9999)-Number(b.order||9999));
    return rows.slice(0,200);
  }
  function persist(progress=state){
    if(!state.storageKey)return false;
    try{
      localStorage.setItem(state.storageKey,JSON.stringify({
        v:3,completedCount:progress.completedCount,serverCompletedCount:state.serverCompletedCount,
        queue:progress.queue.slice(-200),passes:progress.passes.slice(-200),journal:progress.journal.slice(-240),
        finishValidated:progress.finishValidated,serverFinishValidated:state.serverFinishValidated,
        finishPass:progress.finishPass,savedAt:Date.now()
      }));
      return true;
    }catch(_){return false;}
  }
  function clearRetry(){if(state.retryTimer){clearTimeout(state.retryTimer);state.retryTimer=0;}}
  function scheduleRetry(ms=1200){clearRetry();if(state.runConflict||navigator.onLine===false||!state.queue.length)return;state.retryTimer=setTimeout(()=>{state.retryTimer=0;flush().catch(()=>{});},ms);}

  function progressFromServer(progress){
    const server = progress && typeof progress === "object" ? progress : {};
    const n=Math.max(0,Number(server.completedCount||0));
    // El servidor es la única autoridad sobre lo que ya está sincronizado.
    // Nunca usamos Math.max con una copia local antigua: si el servidor dice 0, es 0.
    state.serverCompletedCount=Math.min(n,expectedCount());
    state.serverAttemptIds=new Set();
    const serverPasses=server.passes&&typeof server.passes==="object"?Object.values(server.passes):[];
    for(const row of serverPasses){if(row?.attemptId)state.serverAttemptIds.add(String(row.attemptId));journalAdd(row);}
    if(server?.finishPass?.attemptId){state.serverAttemptIds.add(String(server.finishPass.attemptId));journalAdd(server.finishPass);}

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
    state.journal=Array.isArray(local.journal)?local.journal:[];
    if(!state.journal.length){for(const row of state.passes)journalAdd(row);for(const row of (Array.isArray(local.queue)?local.queue:[]))journalAdd(row);}
    state.completedCount=Math.max(0,Number(local.completedCount||0));
    state.serverCompletedCount=Math.max(0,Number(local.serverCompletedCount||0));
    state.queue=Array.isArray(local.queue)?local.queue:[];
    state.serverFinishValidated=Boolean(local.serverFinishValidated);
    if(local.finishValidated||state.serverFinishValidated){state.finishValidated=true;state.finishPass=local.finishPass||null;if(state.finishPass)journalAdd(state.finishPass);}
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

  function createQrDetector(){
    if(typeof window.BarcodeDetector!=="function")return null;
    try{return new window.BarcodeDetector({formats:["qr_code"]});}catch(_){return null;}
  }

  function preloadQrReader(){
    if(typeof window.jsQR==="function")return Promise.resolve(true);
    if(state.qrLoading)return state.qrLoading;
    state.qrLoading=new Promise(resolve=>{
      const script=document.createElement("script");
      script.src=JSQR_URL;
      script.async=true;
      const timer=setTimeout(()=>finish(false),5000);
      function finish(ready){
        clearTimeout(timer);
        script.onload=script.onerror=null;
        if(!ready)script.remove();
        resolve(ready);
      }
      script.onload=()=>finish(typeof window.jsQR==="function");
      script.onerror=()=>finish(false);
      document.head.appendChild(script);
    }).finally(()=>{state.qrLoading=null;});
    return state.qrLoading;
  }

  async function configure({context,plan,progress,status}={}){
    state.epoch+=1;state.runConflict=false;closeScanner({silent:true});clearRetry();
    state.context=context?{...context}:null;
    state.plan=plan&&typeof plan==="object"?JSON.parse(JSON.stringify(plan)):null;
    state.raceStatus=String(status||"ready").toLowerCase();
    state.completedCount=0;state.serverCompletedCount=0;state.queue=[];state.passes=[];state.journal=[];state.lastFix=null;state.lastAutoAt=0;state.finishValidated=false;state.serverFinishValidated=false;state.finishPass=null;state.serverAttemptIds=new Set();state.flushing=false;state.flushAgain=false;state.localHydrated=false;state.lastSyncError="";state.syncFailureCount=0;state.localStorageError="";
    state.storageKey=contextKey();
    hydrateLocalOnce();
    if(progress&&typeof progress==="object")progressFromServer(progress);else reconcile();
    if(!createQrDetector())preloadQrReader().catch(()=>{});
    if(navigator.onLine!==false)flush().catch(()=>{});
    emit("ready");
    return snapshot();
  }

  function setRaceStatus(status){state.raceStatus=String(status||"").toLowerCase();if(!["racing","started"].includes(state.raceStatus))closeScanner({silent:true});emit("status");}

  async function refreshFromServer(){
    if(!state.context?.eventId)return false;
    const t=token();
    try{
      const svc=await services();if(!current(t))return false;
      const result=await svc.callable("runnerJoinLive",{eventId:t.context.eventId,expectedRunId:t.context.runId,clientVersion:VERSION});
      if(!current(t))return false;const data=result?.data||{};checkRun(data,t);
      if(data.controlPlan)state.plan=data.controlPlan;progressFromServer(data.controlProgress||null);reconcile();emit("reconciled");return true;
    }catch(error){if(current(t)&&error?.details?.reason==="RUN_CHANGED")state.runConflict=true;return false;}
  }

  async function flush(){
    const t=token();if(!current(t)||state.runConflict)return false;
    rebuildPendingQueue();
    if(navigator.onLine===false||!state.context?.eventId){emit("offline",{message:"Validación guardada en el dispositivo. Se sincronizará al recuperar cobertura."});return state.queue.length===0;}
    if(state.flushing){state.flushAgain=true;return false;}
    if(!state.queue.length){state.lastSyncError="";state.syncFailureCount=0;return true;}
    clearRetry();state.flushing=true;emit("syncing",{pending:state.queue.length});
    try{
      const svc=await services();if(!current(t))return false;
      let guard=0;
      while(current(t)&&state.queue.length&&navigator.onLine!==false&&guard<5){
        guard+=1;
        // Antes de enviar, reconstruimos desde TODO el historial local. Así una baliza
        // no puede desaparecer de la cola mientras el servidor todavía la espera.
        rebuildPendingQueue();
        // H6.6: cada intento reenvía el diario completo. El servidor ignora
        // idempotentemente lo ya confirmado y aplica solo el prefijo que falte.
        const batch=syncPayload();
        const before=state.queue.length;
        if(!batch.length)break;
        try{
          const result=await svc.callable("runnerSyncControlPasses",{eventId:t.context.eventId,expectedRunId:t.context.runId,clientVersion:VERSION,passes:batch});
          if(!current(t))return false;const data=result?.data||{};checkRun(data,t);
          const finishWasServerValidated=state.serverFinishValidated;
          progressFromServer(data.progress||null);
          reconcile();
          state.lastSyncError="";state.syncFailureCount=0;
          if(!finishWasServerValidated&&state.serverFinishValidated){
            // H6.7: la interfaz de carrera escucha arrival_synced para ejecutar
            // runnerFinishRace automáticamente. Antes solo emitíamos "synced",
            // por eso la LLEGADA quedaba validada pero la carrera no se cerraba.
            emit("arrival_synced",{
              pass:state.finishPass?{...state.finishPass}:null,
              arrivalAt:Number(data.arrivalAt||state.finishPass?.passedAtMs||Date.now()),
              syncedCount:Math.max(0,before-state.queue.length),
              pending:state.queue.length,server:data
            });
          }else{
            emit(state.queue.length?"syncing":"synced",{syncedCount:Math.max(0,before-state.queue.length),pending:state.queue.length,server:data});
          }
          if(state.queue.length>=before&&state.queue.length){
            // El servidor no avanzó: refrescamos una vez su progreso real antes de reintentar.
            await refreshFromServer();if(!current(t))return false;
            rebuildPendingQueue();
            if(state.queue.length>=before)break;
          }
        }catch(error){
          if(!current(t))return false;
          const msg=String(error?.message||error||"");
          state.lastSyncError=msg;state.syncFailureCount+=1;
          if(error?.details?.reason==="RUN_CHANGED"){state.runConflict=true;emit("sync_error",{message:msg,pending:state.queue.length});break;}
          // Si el servidor dice que espera una baliza anterior, releemos su estado y
          // reconstruimos la cola completa desde passes locales (B1+B2+...).
          await refreshFromServer();if(!current(t))return false;
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
      if(t.epoch===state.epoch){state.flushing=false;if(current(t)){persist();
      if((state.flushAgain||state.queue.length)&&navigator.onLine!==false){state.flushAgain=false;scheduleRetry(state.queue.length?Math.min(5000,1200+state.syncFailureCount*700):250);}
      }}
    }
  }

  function registerLocal(checkpointId,source,meta={}){
    if(!current(token()))return {ok:false,message:"La sesión ya no corresponde a esta carrera."};
    if(!["racing","started"].includes(state.raceStatus))return {ok:false,message:"La carrera todavía no está iniciada."};
    const target=nextTarget();const id=canonical(checkpointId);
    if(!target)return {ok:false,message:"El recorrido y la llegada ya están validados."};
    if(id!==canonical(target.checkpointId))return {ok:false,message:`La siguiente validación es ${canonical(target.checkpointId)==="FINISH"?"LLEGADA":target.checkpointId}.`};
    const now=Math.max(0,Number(meta.passedAtMs||Date.now()));
    const previous=state.passes[state.passes.length-1]||null;
    const startedAt=Math.max(0,Number(meta.startedAt||0));
    const isFinish=id==="FINISH";
    const pass={order:isFinish?expectedCount()+1:state.completedCount+1,kind:isFinish?"finish":"control",checkpointId:id,source,discarded:source==="discard",penaltyMs:source==="discard"?CONTROL_PENALTY_MS:0,passedAtMs:now,elapsedMs:startedAt?Math.max(0,now-startedAt):null,splitMs:previous?.passedAtMs?Math.max(0,now-Number(previous.passedAtMs)):null,distanceM:meta.distanceM==null?null:Math.round(Number(meta.distanceM)*10)/10,allowedRadiusM:meta.allowedRadiusM==null?null:Math.round(Number(meta.allowedRadiusM)*10)/10,gpsAccuracyM:meta.accuracy==null?null:Math.round(Number(meta.accuracy)*10)/10,lat:meta.lat==null?null:Number(meta.lat),lng:meta.lng==null?null:Number(meta.lng),accuracy:meta.accuracy==null?null:Number(meta.accuracy),attemptId:makeAttemptId(),qrRaw:source==="qr"?String(meta.qrRaw||"").trim():undefined};
    const progress={
      completedCount:isFinish?state.completedCount:Math.min(expectedCount(),state.completedCount+1),
      passes:isFinish?state.passes:[...state.passes,pass],
      queue:[...state.queue,{...pass}],
      journal:[...state.journal],
      finishValidated:isFinish||state.finishValidated,
      finishPass:isFinish?{...pass}:state.finishPass
    };
    journalAdd(pass,progress.journal);
    // Confirmar la escritura antes de avanzar, vibrar o emitir la llegada.
    if(!persist(progress)){
      const message=isFinish?"No se guardó la llegada. Libera espacio y reintenta.":"No se guardó la baliza. Libera espacio y reintenta.";
      state.localStorageError=message;
      emit("storage_error",{message});
      return {ok:false,message};
    }
    Object.assign(state,progress);
    state.localStorageError="";
    state.lastAutoAt=Date.now();
    try{if(navigator.vibrate)navigator.vibrate(isFinish?[220,80,220,80,320]:[120,70,180]);}catch(_){}
    emit(isFinish?"arrival_local":(source==="discard"?"discarded":"passed"),{pass,nextAfter:nextTarget()?{...nextTarget()}:null});
    // H6.9: las balizas normales siguen sincronizando en segundo plano. LLEGADA no
    // arranca otra petición paralela: runner-race-v2 coordina un único cierre
    // (controles -> track -> FINALIZADO), evitando la carrera entre flush y finish.
    if(!isFinish){
      if(navigator.onLine!==false)flush().catch(()=>{});
      else emit("offline",{message:"Baliza guardada en el dispositivo. Se sincronizará al recuperar cobertura."});
    }else if(navigator.onLine===false){
      emit("offline",{message:"Llegada guardada. La carrera se cerrará automáticamente al recuperar cobertura."});
    }
    return {ok:true,pass};
  }

  function discardNextControl(expectedCheckpointId=""){
    const target=nextTarget();
    if(!target)return {ok:false,message:"No hay ninguna baliza pendiente."};
    if(canonical(target.checkpointId)==="FINISH")return {ok:false,message:"La LLEGADA no se puede descartar."};
    const expected=canonical(expectedCheckpointId);
    const current=canonical(target.checkpointId);
    // K3A · La confirmación queda ligada a una baliza concreta. Si esa baliza
    // se valida por GPS/QR mientras el diálogo está abierto, nunca se descarta
    // accidentalmente el siguiente control.
    if(expected&&expected!==current){
      return {ok:false,stale:true,message:`${expected} ya no es la baliza pendiente. La siguiente es ${current}. No se ha descartado nada.`};
    }
    const result=registerLocal(target.checkpointId,"discard",{passedAtMs:Date.now()});
    if(result.ok&&navigator.onLine===false)emit("offline",{message:`${target.checkpointId} descartada. Penalización +15:00 guardada localmente.`});
    return result;
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
  function submitQr(raw){const parsed=parseQr(raw);if(!parsed.ok){emit("qr_error",{message:parsed.message,qrRaw:String(raw||"")});return parsed;}const res=registerLocal(parsed.id,"qr",{passedAtMs:Date.now(),qrRaw:parsed.raw});if(res.ok)closeScanner();return res;}

  function stopMedia(stream){
    for(const track of stream?.getTracks?.()||[]){
      try{track.stop();}catch(_){}
    }
  }

  function scannerIsCurrent(sc){
    return state.scanner===sc && current(sc.token) && document.visibilityState!=="hidden";
  }

  function scannerError(sc,message){
    if(!scannerIsCurrent(sc))return false;
    if(sc.statusEl)sc.statusEl.textContent=message;
    closeScanner({silent:true});
    emit("qr_error",{message});
    return false;
  }

  async function initializeScanner(sc){
    try{
      let stream;
      try{
        stream=await navigator.mediaDevices.getUserMedia({
          video:{facingMode:{ideal:"environment"},width:{ideal:1280},height:{ideal:720}},audio:false
        });
      }catch(error){
        if(!scannerIsCurrent(sc))return false;
        if(!["OverconstrainedError","ConstraintNotSatisfiedError","NotFoundError","DevicesNotFoundError"].includes(error?.name))throw error;
        stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
      }
      if(!scannerIsCurrent(sc)){stopMedia(stream);return false;}
      sc.stream=stream;
      for(const track of stream.getVideoTracks?.()||[]){
        track.addEventListener("ended",()=>{
          scannerError(sc,"La cámara se ha detenido. Vuelve a abrir el lector QR.");
        },{once:true});
      }
      const {video}=sc;
      video.setAttribute("playsinline","");
      video.setAttribute("webkit-playsinline","");
      video.muted=true;
      video.autoplay=true;
      video.srcObject=stream;
      await video.play();
      if(!scannerIsCurrent(sc))return false;

      sc.detector=createQrDetector();
      if(!sc.detector){
        if(sc.statusEl)sc.statusEl.textContent="Preparando lector QR…";
        const ready=await preloadQrReader();
        if(!scannerIsCurrent(sc))return false;
        if(!ready)return scannerError(sc,"No se pudo cargar el lector QR. Vuelve a intentarlo.");
      }
      if(sc.statusEl)sc.statusEl.textContent="Cámara activa. Apunta al QR de la siguiente baliza.";
      emit("qr_scanning");
      void scanLoop(sc);
      return true;
    }catch(error){
      const message=/NotAllowed|Permission/i.test(String(error?.name||""))
        ?"Permiso de cámara denegado. Actívalo en los ajustes del navegador."
        :"No se pudo abrir la cámara. Vuelve a intentarlo o usa una foto.";
      return scannerError(sc,message);
    }
  }

  function openScanner({video,canvas,statusEl}={}){
    if(!video||!canvas||document.visibilityState==="hidden")return Promise.resolve(false);
    closeScanner({silent:true});
    if(!navigator.mediaDevices?.getUserMedia){
      const message="Este navegador no permite acceder a la cámara.";
      if(statusEl)statusEl.textContent=message;
      emit("qr_error",{message});
      return Promise.resolve(false);
    }
    if(statusEl)statusEl.textContent="Solicitando cámara…";
    const sc={token:token(),video,canvas,statusEl,stream:null,detector:null,frame:0,lastRaw:"",lastAt:0,cancel:null};
    const cancelled=new Promise(resolve=>{sc.cancel=()=>resolve(false);});
    state.scanner=sc;
    // El permiso puede resolverse después de cerrar el lector. La apertura
    // visible se cancela al instante y el flujo tardío se libera al llegar.
    return Promise.race([initializeScanner(sc),cancelled]);
  }

  function rawQrFromCanvas(canvas,ctx){
    const image=ctx.getImageData(0,0,canvas.width,canvas.height);
    const code=window.jsQR(image.data,canvas.width,canvas.height,{inversionAttempts:"attemptBoth"});
    return String(code?.data||"").trim();
  }

  async function scanLoop(sc){
    if(!scannerIsCurrent(sc))return;
    try{
      let raw="";
      if(sc.video.readyState>=2){
        if(sc.detector){
          try{
            const codes=await sc.detector.detect(sc.video);
            if(!scannerIsCurrent(sc))return;
            raw=String(codes?.[0]?.rawValue||"").trim();
          }catch(_){
            if(!scannerIsCurrent(sc))return;
            sc.detector=null;
            const ready=await preloadQrReader();
            if(!scannerIsCurrent(sc))return;
            if(!ready){scannerError(sc,"No se pudo leer el QR. Vuelve a abrir el lector o usa una foto.");return;}
          }
        }else{
          const width=sc.video.videoWidth,height=sc.video.videoHeight;
          if(width&&height){
            sc.canvas.width=width;sc.canvas.height=height;
            const ctx=sc.canvas.getContext("2d",{willReadFrequently:true});
            ctx.drawImage(sc.video,0,0,width,height);
            raw=rawQrFromCanvas(sc.canvas,ctx);
          }
        }
      }
      if(raw){
        const now=Date.now();
        if(raw!==sc.lastRaw||now-sc.lastAt>2200){
          sc.lastRaw=raw;sc.lastAt=now;
          const result=submitQr(raw);
          if(sc.statusEl)sc.statusEl.textContent=result.ok?"QR validado correctamente.":result.message;
        }
      }
    }catch(_){
      scannerError(sc,"No se pudo leer el QR. Vuelve a abrir el lector o usa una foto.");
      return;
    }
    if(scannerIsCurrent(sc))sc.frame=requestAnimationFrame(()=>void scanLoop(sc));
  }

  async function scanImageFile(file,{canvas,statusEl}={}){
    if(!file)return {ok:false,message:"No se recibió ninguna imagen."};
    closeScanner({silent:true});
    const epoch=state.qrEpoch,race=token();
    const valid=()=>epoch===state.qrEpoch&&current(race);
    const cancelled={ok:false,message:"Lectura cancelada."};
    const workCanvas=canvas||document.createElement("canvas");
    let source=null,revoke="";
    try{
      if(typeof window.createImageBitmap==="function"){
        source=await window.createImageBitmap(file);
      }else{
        revoke=URL.createObjectURL(file);
        source=await new Promise((resolve,reject)=>{
          const img=new Image();
          img.onload=()=>resolve(img);
          img.onerror=()=>reject(new Error("No se pudo abrir la foto."));
          img.src=revoke;
        });
      }
      if(!valid())return cancelled;
      const width=Number(source.width||source.naturalWidth||0),height=Number(source.height||source.naturalHeight||0);
      if(!width||!height)throw new Error("La imagen de la cámara no es válida.");
      const scale=Math.min(1,1800/Math.max(width,height));
      workCanvas.width=Math.max(1,Math.round(width*scale));
      workCanvas.height=Math.max(1,Math.round(height*scale));
      const ctx=workCanvas.getContext("2d",{willReadFrequently:true});
      ctx.drawImage(source,0,0,workCanvas.width,workCanvas.height);

      let raw="";
      const detector=createQrDetector();
      if(detector){
        try{raw=String((await detector.detect(workCanvas))?.[0]?.rawValue||"").trim();}catch(_){}
      }
      if(!valid())return cancelled;
      if(!raw){
        const ready=await preloadQrReader();
        if(!valid())return cancelled;
        if(!ready)throw new Error("No se pudo cargar el lector QR. Vuelve a intentarlo.");
        raw=rawQrFromCanvas(workCanvas,ctx);
      }
      if(!raw)throw new Error("No se detectó ningún QR. Acerca más la cámara y vuelve a intentarlo.");
      const result=submitQr(raw);
      if(statusEl)statusEl.textContent=result.ok?"QR validado correctamente.":result.message;
      return result;
    }catch(error){
      if(!valid())return cancelled;
      const message=String(error?.message||"No se pudo leer el QR.");
      if(statusEl)statusEl.textContent=message;
      emit("qr_error",{message});
      return {ok:false,message};
    }finally{
      try{source?.close?.();}catch(_){}
      if(revoke)URL.revokeObjectURL(revoke);
    }
  }

  function closeScanner({silent=false}={}){
    const sc=state.scanner;
    state.scanner=null;
    state.qrEpoch++;
    if(sc){
      sc.cancel();
      if(sc.frame)cancelAnimationFrame(sc.frame);
      stopMedia(sc.stream);
      if(sc.stream&&sc.video.srcObject===sc.stream)sc.video.srcObject=null;
    }
    if(!silent)emit("qr_closed");
  }

  function pauseScanner(){
    const status=state.scanner?.statusEl;
    closeScanner({silent:true});
    if(status)status.textContent="Cámara pausada. Vuelve a abrir el lector QR cuando regreses.";
  }

  async function flushAndWait({timeoutMs=18000,requireArrival=false}={}){
    const t=token();
    const canSync=()=>current(t)&&!state.runConflict&&navigator.onLine!==false;
    const confirmed=()=>state.queue.length===0&&(!requireArrival||state.serverFinishValidated);
    if(!canSync())return false;
    rebuildPendingQueue();
    if(confirmed())return true;

    // El cierre espera la confirmación sin quedar atado a la duración de la petición.
    // La cola y sus reintentos siguen bajo el control de flush().
    return new Promise(resolve=>{
      const poll=setInterval(()=>{
        if(!canSync())finish(false);
        else if(confirmed())finish(true);
      },120);
      const deadline=setTimeout(()=>finish(canSync()&&confirmed()),timeoutMs);
      function finish(ok){
        clearInterval(poll);
        clearTimeout(deadline);
        resolve(ok);
      }
      if(!state.flushing)flush().catch(()=>{});
    });
  }
  function snapshot(){const stats=courseStats();return {configured:Boolean(state.context&&state.plan),runConflict:state.runConflict,raceStatus:state.raceStatus,completedCount:state.completedCount,serverCompletedCount:state.serverCompletedCount,expectedCount:stats.expected,discardedControlCount:stats.discarded,pendingControlCount:stats.pendingControls,penaltyAccumulatedMs:stats.penaltyAccumulatedMs,penaltyPreviewMs:stats.penaltyPreviewMs,progressPasses:progressPasses(),nextControl:nextTarget()?{...nextTarget()}:null,finishValidated:state.finishValidated,serverFinishValidated:state.serverFinishValidated,finishPass:state.finishPass?{...state.finishPass}:null,pending:state.queue.length,journalCount:state.journal.length,syncing:state.flushing,lastSyncError:state.lastSyncError,syncFailureCount:state.syncFailureCount,lastFix:state.lastFix?{...state.lastFix}:null};}
  function pendingPasses(){return syncPayload().map(item=>({...item}));}
  function stop(){closeScanner({silent:true});clearRetry();persist();state.raceStatus="finished";emit("stopped");}

  window.addEventListener("militopo:v2-gps-fix",event=>{const fix=event.detail?.fix;if(fix)handleFix(fix);});
  window.addEventListener("online",()=>{state.flushAgain=true;flush().catch(()=>{});});
  window.addEventListener("militopo:v2-auth-signed-out",()=>{persist();state.epoch+=1;clearRetry();state.flushing=false;state.context=null;closeScanner({silent:true});});
  document.addEventListener?.("visibilitychange",()=>{
    if(document.visibilityState==="hidden")pauseScanner();
  });
  window.addEventListener("pagehide",()=>{pauseScanner();persist();});

  globalThis.MILITOPO_RUNNER_CONTROLS_V2=Object.freeze({configure,setRaceStatus,flush,flushAndWait,refreshFromServer,openScanner,scanImageFile,closeScanner,submitQr,discardNextControl,snapshot,pendingPasses,stop,version:VERSION});
})();
