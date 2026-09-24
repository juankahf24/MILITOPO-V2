/* MILITOPO V2 · G2 · Interfaz de carrera + GPS + track offline persistente.
   Live V2 es el único flujo activo. El GPS solo se comparte durante la carrera. */
(function(){
  "use strict";
  const VERSION="v2-g2-track-offline-20260924";
  const state={root:null,services:null,event:null,auth:null,runId:"",participant:null,unsubParticipant:null,unsubActive:null,timer:null,busy:false,gpsTried:false};
  const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const statusLabel=s=>({not_started:"PREPARADO",ready:"PREPARADO",racing:"EN CARRERA",started:"EN CARRERA",finished:"FINALIZADO"})[String(s||"").toLowerCase()]||String(s||"").toUpperCase();
  const fmtClock=ms=>{const sec=Math.max(0,Math.floor(ms/1000)),h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return h?`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;};
  const fmtTime=v=>{const n=Number(v||0);if(!n)return "—";try{return new Intl.DateTimeFormat("es-ES",{hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date(n));}catch(_){return "—";}};
  async function services(){if(!state.services)state.services=await globalThis.MILITOPO_V2.firebase();return state.services;}
  function gpsApi(){return globalThis.MILITOPO_RUNNER_GPS_V2||null;}
  function trackApi(){return globalThis.MILITOPO_RUNNER_TRACK_V2||null;}
  function gpsContext(){return {ownerUid:state.event?.ownerUid||"",eventId:state.event?.eventId||"",runId:state.runId,uid:state.auth?.uid||""};}
  function installStyle(){if(document.getElementById("m2RaceV2Style"))return;const s=document.createElement("style");s.id="m2RaceV2Style";s.textContent=`
    #m2RaceV2{position:fixed;inset:0;z-index:100120;background:linear-gradient(180deg,#07110b,#09170e 44%,#050b07);color:#f7f2e8;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:auto;padding:calc(env(safe-area-inset-top) + 14px) 14px calc(env(safe-area-inset-bottom) + 24px)}#m2RaceV2[hidden]{display:none!important}
    .m2race-shell{width:min(720px,100%);margin:0 auto;display:grid;gap:14px}.m2race-top{display:flex;align-items:center;gap:12px}.m2race-back{width:44px;height:44px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;font-size:1.25rem}.m2race-brand{min-width:0;flex:1}.m2race-kicker{font-size:.68rem;letter-spacing:.16em;color:#93bb82;font-weight:800}.m2race-title{margin:3px 0 0;font-size:clamp(1.25rem,6vw,2rem);line-height:1.08;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.m2race-live{display:flex;align-items:center;gap:7px;padding:8px 10px;border-radius:999px;background:rgba(86,180,112,.11);border:1px solid rgba(105,220,136,.22);font-size:.7rem;font-weight:800;color:#bce8c7}.m2race-dot{width:8px;height:8px;border-radius:50%;background:#73d58d;box-shadow:0 0 0 5px rgba(115,213,141,.10)}
    .m2race-card{border:1px solid rgba(255,255,255,.09);border-radius:24px;background:linear-gradient(180deg,rgba(21,42,28,.96),rgba(10,23,15,.98));box-shadow:0 18px 50px rgba(0,0,0,.25);padding:18px}.m2race-hero{padding:24px 18px;text-align:center;background:radial-gradient(circle at 50% 0,rgba(137,197,110,.19),transparent 42%),linear-gradient(180deg,rgba(22,49,30,.98),rgba(9,22,14,.98))}.m2race-state{display:inline-flex;padding:7px 12px;border-radius:999px;border:1px solid rgba(144,212,116,.32);background:rgba(144,212,116,.10);font-size:.72rem;font-weight:900;letter-spacing:.08em;color:#d9f1ce}.m2race-state.racing{color:#d8edff;border-color:rgba(94,169,235,.35);background:rgba(74,134,197,.12)}.m2race-state.finished{color:#f7e5ad;border-color:rgba(230,191,90,.35);background:rgba(190,148,47,.12)}.m2race-time{font-size:clamp(2.8rem,14vw,5.3rem);font-variant-numeric:tabular-nums;font-weight:800;letter-spacing:-.05em;margin:14px 0 2px}.m2race-time-label{font-size:.68rem;letter-spacing:.13em;color:#89998d;font-weight:800}.m2race-event{margin-top:15px;color:#b9c6bc;font-size:.82rem}.m2race-event strong{color:#fff}.m2race-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.m2race-stat{padding:14px;border-radius:18px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07)}.m2race-stat span{display:block;font-size:.63rem;letter-spacing:.11em;color:#849488;font-weight:800}.m2race-stat strong{display:block;margin-top:7px;font-size:1rem}.m2race-action{width:100%;min-height:62px;border:0;border-radius:20px;font:inherit;font-size:1rem;font-weight:900;letter-spacing:.04em}.m2race-start{background:linear-gradient(180deg,#b9df80,#8fbe5e);color:#10200d;box-shadow:0 12px 30px rgba(117,171,77,.22)}.m2race-finish{background:linear-gradient(180deg,#e8bf63,#c89537);color:#281b07}.m2race-action:disabled{opacity:.52;filter:saturate(.4)}.m2race-note{margin-top:10px;text-align:center;color:#8e9b91;font-size:.7rem;line-height:1.45}.m2race-confirm{display:none;margin-top:12px;padding:14px;border-radius:18px;background:rgba(229,174,67,.08);border:1px solid rgba(229,174,67,.22)}.m2race-confirm.open{display:block}.m2race-confirm p{margin:0 0 10px;font-size:.78rem;color:#e7d6ad}.m2race-confirm-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.m2race-mini{min-height:44px;border-radius:13px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;font:inherit;font-weight:800}.m2race-mini.primary{background:rgba(229,174,67,.16);border-color:rgba(229,174,67,.38);color:#ffe4a7}
    .m2race-gps{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px}.m2race-gps-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:14px;background:rgba(97,171,229,.10);border:1px solid rgba(97,171,229,.22);font-size:1.2rem}.m2race-gps-title{font-size:.72rem;font-weight:900;letter-spacing:.08em}.m2race-gps-text{margin-top:4px;color:#93a29a;font-size:.69rem;line-height:1.35}.m2race-gps-pill{padding:6px 9px;border-radius:999px;border:1px solid rgba(255,255,255,.12);font-size:.58rem;font-weight:900;color:#dce8de}.m2race-gps-pill.ok{color:#cceec7;border-color:rgba(113,214,135,.28);background:rgba(113,214,135,.08)}.m2race-gps-pill.warn{color:#ffe3a8;border-color:rgba(235,184,80,.32);background:rgba(235,184,80,.08)}.m2race-gps-btn{grid-column:1/-1;width:100%;min-height:44px;border-radius:14px;border:1px solid rgba(105,176,231,.28);background:rgba(70,139,194,.10);color:#dcedfb;font:inherit;font-size:.72rem;font-weight:900}
    .m2race-track{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px}.m2race-track-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:14px;background:rgba(193,160,73,.10);border:1px solid rgba(193,160,73,.22);font-size:1.1rem}.m2race-track-title{font-size:.72rem;font-weight:900;letter-spacing:.08em}.m2race-track-text{margin-top:4px;color:#93a29a;font-size:.69rem;line-height:1.35}.m2race-track-pill{padding:6px 9px;border-radius:999px;border:1px solid rgba(255,255,255,.12);font-size:.58rem;font-weight:900}.m2race-track-pill.ok{color:#cceec7;border-color:rgba(113,214,135,.28);background:rgba(113,214,135,.08)}.m2race-track-pill.warn{color:#ffe3a8;border-color:rgba(235,184,80,.32);background:rgba(235,184,80,.08)}
    .m2race-sync{display:flex;align-items:center;gap:9px;font-size:.74rem;color:#aebbb1}.m2race-sync strong{color:#dce8de}.m2race-sync-dot{width:9px;height:9px;border-radius:50%;background:#75d38d}.m2race-result{text-align:center}.m2race-result-icon{font-size:2.4rem}.m2race-result h2{margin:8px 0 4px;font-size:1.35rem}.m2race-result p{margin:0;color:#9eaaa1;font-size:.78rem}.m2race-busy{position:fixed;inset:0;z-index:100130;display:none;place-items:center;background:rgba(3,8,5,.76);backdrop-filter:blur(8px)}.m2race-busy.open{display:grid}.m2race-busy-card{width:min(86vw,380px);border-radius:24px;background:#0f2015;border:1px solid rgba(144,212,116,.24);padding:22px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.4)}.m2race-spinner{width:34px;height:34px;border-radius:50%;border:3px solid rgba(255,255,255,.12);border-top-color:#a9d77d;margin:0 auto 12px;animation:m2spin .8s linear infinite}@keyframes m2spin{to{transform:rotate(360deg)}}.m2race-busy-card strong{display:block}.m2race-busy-card span{display:block;margin-top:5px;color:#91a095;font-size:.72rem}
    @media(max-width:430px){.m2race-card{border-radius:21px;padding:15px}.m2race-top{gap:9px}.m2race-live{padding:7px 8px}.m2race-grid{gap:8px}}
  `;document.head.appendChild(s);}
  function ensureRoot(){
    installStyle();
    if(state.root?.isConnected)return state.root;
    const root=document.createElement("section");
    root.id="m2RaceV2";root.hidden=true;
    root.innerHTML=`<div class="m2race-shell">
      <header class="m2race-top"><button id="m2raceBack" class="m2race-back" type="button" aria-label="Volver">←</button><div class="m2race-brand"><div class="m2race-kicker">MILITOPO · CARRERA</div><h1 id="m2raceTitle" class="m2race-title">Carrera</h1></div><div class="m2race-live"><span class="m2race-dot"></span><span>LIVE</span></div></header>
      <section class="m2race-card m2race-hero"><div id="m2raceState" class="m2race-state">PREPARADO</div><div id="m2raceTimer" class="m2race-time">00:00</div><div class="m2race-time-label">TIEMPO DE CARRERA</div><div id="m2raceEvent" class="m2race-event">Conectando…</div></section>
      <section class="m2race-card"><div class="m2race-grid"><div class="m2race-stat"><span>SALIDA</span><strong id="m2raceStartAt">—</strong></div><div class="m2race-stat"><span>LLEGADA</span><strong id="m2raceFinishAt">—</strong></div></div></section>
      <section class="m2race-card"><div class="m2race-gps"><div class="m2race-gps-icon">◎</div><div><div class="m2race-gps-title">GPS DE CARRERA</div><div id="m2raceGpsText" class="m2race-gps-text">El GPS se activa al iniciar el recorrido.</div></div><span id="m2raceGpsPill" class="m2race-gps-pill">ESPERANDO</span><button id="m2raceGpsActivate" class="m2race-gps-btn" type="button" hidden>ACTIVAR GPS</button></div></section>
      <section class="m2race-card"><div class="m2race-track"><div class="m2race-track-icon">↝</div><div><div class="m2race-track-title">TRACK DEL RECORRIDO</div><div id="m2raceTrackText" class="m2race-track-text">Preparado para guardar tu recorrido.</div></div><span id="m2raceTrackPill" class="m2race-track-pill">LISTO</span></div></section>
      <section id="m2raceActionCard" class="m2race-card"><button id="m2raceStart" class="m2race-action m2race-start" type="button">INICIAR RECORRIDO</button><button id="m2raceFinish" class="m2race-action m2race-finish" type="button" hidden>FINALIZAR RECORRIDO</button><div id="m2raceConfirm" class="m2race-confirm"><p>Confirma la llegada solo cuando hayas terminado tu recorrido.</p><div class="m2race-confirm-actions"><button id="m2raceCancelFinish" class="m2race-mini" type="button">CANCELAR</button><button id="m2raceConfirmFinish" class="m2race-mini primary" type="button">CONFIRMAR LLEGADA</button></div></div><div id="m2raceActionNote" class="m2race-note">Cuando estés en la salida, pulsa INICIAR RECORRIDO. El organizador verá el cambio al instante.</div></section>
      <section class="m2race-card"><div class="m2race-sync"><span class="m2race-sync-dot"></span><div><strong id="m2raceSyncTitle">Sincronización activa</strong><br><span id="m2raceSyncText">Conectado a Realtime Database V2.</span></div></div></section>
      <section id="m2raceResult" class="m2race-card m2race-result" hidden><div class="m2race-result-icon">✓</div><h2>Recorrido finalizado</h2><p>La llegada ha quedado registrada y sincronizada con el organizador.</p></section>
    </div><div id="m2raceBusy" class="m2race-busy"><div class="m2race-busy-card"><div class="m2race-spinner"></div><strong id="m2raceBusyTitle">Procesando…</strong><span id="m2raceBusyText">Sincronizando con Live V2.</span></div></div>`;
    document.body.appendChild(root);state.root=root;
    root.querySelector("#m2raceBack").addEventListener("click",close);
    root.querySelector("#m2raceStart").addEventListener("click",startRace);
    root.querySelector("#m2raceFinish").addEventListener("click",()=>root.querySelector("#m2raceConfirm").classList.add("open"));
    root.querySelector("#m2raceCancelFinish").addEventListener("click",()=>root.querySelector("#m2raceConfirm").classList.remove("open"));
    root.querySelector("#m2raceConfirmFinish").addEventListener("click",finishRace);
    root.querySelector("#m2raceGpsActivate").addEventListener("click",activateGps);
    return root;
  }
  const el=id=>ensureRoot().querySelector("#"+id);
  function busy(title,text){state.busy=true;el("m2raceBusyTitle").textContent=title;el("m2raceBusyText").textContent=text;el("m2raceBusy").classList.add("open");}
  function unbusy(){state.busy=false;el("m2raceBusy").classList.remove("open");}
  function clearListeners(){try{state.unsubParticipant?.();}catch(_){}try{state.unsubActive?.();}catch(_){}state.unsubParticipant=null;state.unsubActive=null;if(state.timer){clearInterval(state.timer);state.timer=null;}}
  function close(){if(state.busy)return;ensureRoot().hidden=true;document.body.style.overflow="";window.dispatchEvent(new CustomEvent("militopo:v2-runner-race-closed"));}
  function updateGpsUi(status,detail={}){
    const pill=el("m2raceGpsPill"),text=el("m2raceGpsText"),btn=el("m2raceGpsActivate");
    pill.className="m2race-gps-pill";btn.hidden=true;
    const fix=detail.fix||gpsApi()?.snapshot?.().lastSent||null;
    if(["active","watching","ready"].includes(status)){
      pill.textContent="ACTIVO";pill.classList.add("ok");
      text.textContent=fix?`Posición compartida · precisión ±${Math.round(Number(fix.accuracy||0))} m.`:"GPS activo. Esperando una posición precisa…";
    }else if(status==="requesting"){
      pill.textContent="ACTIVANDO";pill.classList.add("warn");text.textContent="Solicitando permiso y posición GPS…";
    }else if(status==="error"||status==="unsupported"){
      pill.textContent="SIN GPS";pill.classList.add("warn");text.textContent=detail.message||"No se pudo activar el GPS.";btn.hidden=false;
    }else if(status==="stopped"){
      pill.textContent="DETENIDO";text.textContent="El GPS de carrera está detenido.";
    }else{
      pill.textContent="ESPERANDO";text.textContent=detail.message||"El GPS se activa al iniciar el recorrido.";
      if(["racing","started"].includes(String(state.participant?.status||"").toLowerCase()))btn.hidden=false;
    }
  }

  function updateTrackUi(status,detail={}){
    const pill=el("m2raceTrackPill"),text=el("m2raceTrackText");
    if(!pill||!text)return;
    pill.className="m2race-track-pill";
    const snap=trackApi()?.snapshot?.()||{};
    const pending=Number(detail.pending ?? snap.pending ?? 0);
    const sent=Number(detail.sent ?? snap.sent ?? 0);
    if(status==="offline"){pill.textContent=`OFFLINE · ${pending}`;pill.classList.add("warn");text.textContent=`Sin cobertura. ${pending} punto${pending===1?"":"s"} guardado${pending===1?"":"s"} en el dispositivo.`;}
    else if(status==="syncing"||status==="queued"){pill.textContent=pending?`${pending} PEND.`:"SINCRONIZANDO";pill.classList.add(pending?"warn":"ok");text.textContent=pending?`Track protegido localmente · ${pending} pendiente${pending===1?"":"s"} de subir.`:`Sincronizando track con Live V2…`;}
    else if(status==="error"){pill.textContent=`LOCAL · ${pending}`;pill.classList.add("warn");text.textContent="El track sigue guardado en el dispositivo y se reintentará automáticamente.";}
    else if(status==="synced"||status==="online"){pill.textContent="AL DÍA";pill.classList.add("ok");text.textContent=`Track sincronizado · ${sent} punto${sent===1?"":"s"} enviado${sent===1?"":"s"}.`;}
    else if(status==="stopped"){pill.textContent=pending?`${pending} PEND.`:"GUARDADO";pill.classList.add(pending?"warn":"ok");text.textContent=pending?"Quedan puntos pendientes; se enviarán al recuperar conexión.":"Track guardado y sincronizado.";}
    else{pill.textContent="LISTO";text.textContent="El track se guardará incluso si pierdes cobertura durante la carrera.";}
  }
  function render(){
    const row=state.participant||{},st=String(row.status||"ready").toLowerCase(),label=statusLabel(st),pill=el("m2raceState");
    pill.textContent=label;pill.className="m2race-state"+(st==="racing"||st==="started"?" racing":st==="finished"?" finished":"");
    el("m2raceStartAt").textContent=fmtTime(row.startedAt);el("m2raceFinishAt").textContent=fmtTime(row.finishedAt);
    el("m2raceStart").hidden=!["ready","not_started"].includes(st);el("m2raceFinish").hidden=!["racing","started"].includes(st);
    el("m2raceResult").hidden=st!=="finished";el("m2raceActionCard").hidden=st==="finished";el("m2raceConfirm").classList.remove("open");updateTimer();
    if(st==="finished") gpsApi()?.stop?.("finished").catch?.(()=>{});
    if(["racing","started"].includes(st)&&!gpsApi()?.snapshot?.().active&&!state.gpsTried){state.gpsTried=true;gpsApi()?.resumeIfGranted?.(gpsContext()).catch?.(()=>{});updateGpsUi("idle",{message:"GPS disponible. Pulsa ACTIVAR GPS si no se activa automáticamente."});}
  }
  function updateTimer(){if(state.timer){clearInterval(state.timer);state.timer=null;}const tick=()=>{const row=state.participant||{},start=Number(row.startedAt||0),finish=Number(row.finishedAt||0),st=String(row.status||"").toLowerCase();if(!start){el("m2raceTimer").textContent="00:00";return;}el("m2raceTimer").textContent=fmtClock((finish||Date.now())-start);if(st==="finished"&&state.timer){clearInterval(state.timer);state.timer=null;}};tick();if(["racing","started"].includes(String(state.participant?.status||"").toLowerCase()))state.timer=setInterval(tick,1000);}
  async function bind(){const svc=await services(),api=svc.databaseApi;if(!api)throw new Error("Realtime Database no disponible.");const pRef=api.ref(`v2/live/${state.event.ownerUid}/${state.event.eventId}/runs/${state.runId}/participants/${state.auth.uid}`);const activeRef=api.ref(`v2/live/${state.event.ownerUid}/${state.event.eventId}/activeRun`);state.unsubParticipant=api.onValue(pRef,snap=>{state.participant=snap.val()||{};render();});state.unsubActive=api.onValue(activeRef,snap=>{const a=snap.val()||{};if(String(a.status||"")==="finished"){gpsApi()?.stop?.("event_finished").catch?.(()=>{});el("m2raceSyncTitle").textContent="Evento finalizado";el("m2raceSyncText").textContent="El organizador ha cerrado la sesión Live V2.";if(String(state.participant?.status||"")!=="finished"){el("m2raceStart").disabled=true;el("m2raceFinish").disabled=true;}}});}
  async function open(detail){clearListeners();state.event=detail?.event||null;state.auth=detail?.auth||null;state.runId=String(detail?.runId||"");state.gpsTried=false;if(!state.event||!state.auth||!state.runId)return;const root=ensureRoot();root.hidden=false;document.body.style.overflow="hidden";el("m2raceTitle").textContent=state.event.eventName||"Carrera";el("m2raceEvent").innerHTML=`<strong>${esc(state.auth.displayName||state.auth.username||"Corredor")}</strong> · ${esc(state.event.eventId||"")}`;el("m2raceSyncTitle").textContent="Sincronización activa";el("m2raceSyncText").textContent="Conectando a la sesión Live V2…";updateGpsUi("idle");updateTrackUi("ready");try{const svc=await services();const joined=await svc.callable("runnerJoinLive",{eventId:state.event.eventId,clientVersion:VERSION});state.runId=String(joined?.data?.runId||state.runId);await bind();el("m2raceSyncText").textContent="Conectado a Realtime Database V2.";}catch(error){el("m2raceSyncTitle").textContent="No se pudo conectar";el("m2raceSyncText").textContent=String(error?.message||error);}}
  async function activateGps(){const api=gpsApi();if(!api)return updateGpsUi("unsupported",{message:"Módulo GPS no disponible."});updateGpsUi("requesting");const fix=await api.prepare();if(fix){await api.start(gpsContext(),fix);state.gpsTried=true;}else updateGpsUi("error",{message:api.snapshot?.().lastError||"No se pudo activar el GPS."});}
  async function startRace(){
    if(state.busy)return;
    busy("Preparando salida","Solicitando GPS y validando tu sesión…");
    let fix=null;
    try{if(gpsApi()){updateGpsUi("requesting");fix=await gpsApi().prepare();}}
    catch(_){fix=null;}
    try{
      const svc=await services();
      el("m2raceBusyText").textContent="Registrando la salida en Live V2…";
      await svc.callable("runnerStartRace",{eventId:state.event.eventId,clientVersion:VERSION});
      if(gpsApi()&&fix)await gpsApi().start(gpsContext(),fix);else if(!fix)updateGpsUi("error",{message:"La carrera ha empezado, pero el GPS no está activo. Puedes activarlo manualmente."});
      await new Promise(r=>setTimeout(r,650));el("m2raceBusyTitle").textContent="Salida registrada";el("m2raceBusyText").textContent="Ya estás EN CARRERA. El organizador ha recibido el cambio.";await new Promise(r=>setTimeout(r,850));
    }catch(error){el("m2raceBusyTitle").textContent="No se pudo iniciar";el("m2raceBusyText").textContent=String(error?.message||error);await new Promise(r=>setTimeout(r,1600));}
    finally{unbusy();}
  }
  async function finishRace(){if(state.busy)return;busy("Registrando llegada","Deteniendo GPS y cerrando tu recorrido…");try{await gpsApi()?.stop?.("runner_finish");const svc=await services();await svc.callable("runnerFinishRace",{eventId:state.event.eventId,clientVersion:VERSION});await new Promise(r=>setTimeout(r,650));el("m2raceBusyTitle").textContent="Llegada registrada";el("m2raceBusyText").textContent="Recorrido finalizado y sincronizado correctamente.";await new Promise(r=>setTimeout(r,950));}catch(error){el("m2raceBusyTitle").textContent="No se pudo finalizar";el("m2raceBusyText").textContent=String(error?.message||error);await new Promise(r=>setTimeout(r,1600));}finally{unbusy();}}
  window.addEventListener("militopo:v2-gps-status",e=>updateGpsUi(e.detail?.status||"idle",e.detail||{}));
  window.addEventListener("militopo:v2-track-status",e=>updateTrackUi(e.detail?.status||"ready",e.detail||{}));
  window.addEventListener("militopo:v2-open-runner-race",e=>open(e.detail));
})();
