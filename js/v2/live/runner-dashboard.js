/* MILITOPO V2 · F3A · Runner dashboard sobre la shell autenticada principal.
   No importa Firebase ni vuelve a inicializar Auth: reutiliza el singleton que ya
   ha cargado correctamente la pantalla de login de MILITOPO. */
(function () {
  "use strict";
  const VERSION = "v2-i6c-organizer-replay-nav-20261001";
  const state = { auth:null, services:null, servicesPromise:null, recoveryPromise:null, events:[], history:[], historySummary:{total:0,finished:0,incomplete:0,notStarted:0}, historyLoading:false, historyError:"", historyDetail:null, detailLoading:false, detailError:"", detailEventId:"", classificationDetail:null, classificationLoading:false, classificationError:"", classificationView:"general", detailMap:null, detailBaseLayers:{}, detailBaseLayer:null, detailBaseKey:"mapant", detailTrackLayer:null, detailCheckpointLayer:null, detailCheckpointMarkers:new Map(), detailRacePlanLayer:null, detailRacePlanDescriptor:null, detailRacePlanOwnedUrl:"", detailRacePlanLoading:false, detailRacePlanError:"", detailPlaybackLayer:null, detailPlaybackMarker:null, detailPlaybackTrail:null, detailPlaybackTargetLine:null, detailPlaybackPoints:[], detailPlaybackControlRows:[], detailPlaybackStartMs:0, detailPlaybackObjectiveKey:"", detailPlaybackPlaying:false, detailPlaybackRaf:0, detailPlaybackLastFrame:0, detailPlaybackCurrentMs:0, detailPlaybackDurationMs:0, detailPlaybackSpeed:1, active:null, runId:"", participantStatus:"", unsubRun:null, unsubParticipant:null, heartbeat:null, root:null, eventWatchers:new Map(), unsubInviteSignals:null, inviteSignalSignature:"", recoveryDeadline:null, connectingEventId:"", connectPromise:null, connectToken:0, liveSelectionTimer:null, pendingInvites:0, autoOpenedRuns:new Set(), onlineRevalidating:false, onlineRefreshPromise:null };
  const LAST_ROLE_KEY = "militopo_v2_last_role";
  const AUTH_SNAPSHOT_KEY = "militopo_v2_auth_snapshot";
  const EVENTS_SNAPSHOT_KEY = "militopo_v2_runner_events_snapshot";
  const ACTIVE_RACE_KEY = "militopo_v2_active_race_v3";
  const ONLINE_RELOAD_KEY = "militopo_v2_online_recovery_reload_v1";

  const esc = v => String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const statusES = s => ({draft:"BORRADOR",prepared:"PREPARADO",published:"PUBLICADO",live:"EN DIRECTO",finished:"FINALIZADO",archived:"ARCHIVADO"})[String(s||"").toLowerCase()] || String(s||"").toUpperCase();
  const initials = name => { const p=String(name||"").trim().split(/\s+/).filter(Boolean); return ((p[0]?.[0]||"")+(p[1]?.[0]||"")).toUpperCase()||"R"; };
  const fmtRouteKm = value => Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)} km` : "—";
  const routeSequenceText = row => (Array.isArray(row?.routePoints) ? row.routePoints : []).map(value=>{const key=String(value||"").trim();const upper=key.toUpperCase();return upper==="START"||upper==="SALIDA"?"S":upper==="FINISH"||upper==="LLEGADA"?"L":key;}).filter(Boolean).join(" → ");


  function cachedAuth(){
    try{const raw=localStorage.getItem(AUTH_SNAPSHOT_KEY);if(!raw)return null;const data=JSON.parse(raw);return data?.role==="runner"?data:null;}catch(_){return null;}
  }

  function activeRaceSnapshot(){
    try{
      const raw=localStorage.getItem(ACTIVE_RACE_KEY);if(!raw)return null;
      const data=JSON.parse(raw);
      if(!data?.event?.eventId||!data?.auth?.uid||!data?.runId)return null;
      const status=String(data.status||"").toLowerCase();
      return ["finished","archived"].includes(status)?null:data;
    }catch(_){return null;}
  }
  function clearOnlineRecoveryReload(){
    try{sessionStorage.removeItem(ONLINE_RELOAD_KEY);}catch(_){}
  }
  function scheduleControlledOnlineReload(){
    if(!navigator.onLine)return false;
    // No recargamos automáticamente una carrera activa: I3 validará esa recuperación
    // de forma específica para no arriesgar una actualización de versión a mitad de carrera.
    if(activeRaceSnapshot())return false;
    try{
      const previous=Number(sessionStorage.getItem(ONLINE_RELOAD_KEY)||0);
      if(previous && Date.now()-previous<60000)return false;
      sessionStorage.setItem(ONLINE_RELOAD_KEY,String(Date.now()));
    }catch(_){}
    setStatus("Conexión recuperada · reactivando tu sesión de forma segura…","ok");
    setTimeout(()=>{try{location.reload();}catch(_){}},450);
    return true;
  }
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  function reconnectErrorText(error){
    return `${String(error?.code||"")} ${String(error?.message||error||"")}`.toLowerCase();
  }
  function transientReconnectError(error){
    const text=reconnectErrorText(error);
    return !text || /internal|unavailable|network|fetch|offline|timeout|deadline|failed-precondition|load failed|\[0\]/.test(text);
  }
  async function forceFreshRunnerToken(){
    if(!navigator.onLine)return false;
    const svc=await services();
    if(typeof svc.auth?.authStateReady==="function"){
      try{await Promise.race([svc.auth.authStateReady(),wait(3500)]);}catch(_){}
    }
    const snap=cachedAuth();
    const user=svc.auth?.currentUser;
    if(!user||!snap?.uid||String(user.uid)!==String(snap.uid))return false;
    try{
      await Promise.race([user.getIdToken(true),new Promise((_,reject)=>setTimeout(()=>reject(new Error("TOKEN_REFRESH_TIMEOUT")),6000))]);
      return true;
    }catch(error){
      console.warn("[MILITOPO runner dashboard] token refresh",error);
      return false;
    }
  }
  async function refreshEventsAfterReconnect(){
    const delays=[0,650,1400,2800,4500];
    let lastError=null;
    for(const delay of delays){
      if(delay)await wait(delay);
      if(!navigator.onLine)throw new Error("OFFLINE_AGAIN");
      try{
        const result=await loadEvents(true,true,{throwOnError:true,reconnecting:true});
        return result!==false;
      }catch(error){
        lastError=error;
        if(!transientReconnectError(error))throw error;
        setStatus("Conexión recuperada · sincronizando tus carreras…","ok");
        try{await forceFreshRunnerToken();}catch(_){}
      }
    }
    throw lastError||new Error("RECONNECT_EVENTS_TIMEOUT");
  }
  async function revalidateAfterOnline(){
    if(!navigator.onLine)return false;
    if(state.onlineRefreshPromise)return state.onlineRefreshPromise;
    state.onlineRevalidating=true;
    state.onlineRefreshPromise=(async()=>{
      const snap=cachedAuth();
      if(!snap?.uid||snap.role!=="runner")return false;
      setStatus("Conexión recuperada · revalidando tu sesión…","ok");

      // Primero recuperamos Firebase Auth. No consultamos Functions hasta que
      // la instancia de Auth y su token estén preparados de nuevo.
      if(state.auth?.role!=="runner"){
        const delays=[0,600,1300,2400,4000];
        let recovered=false;
        for(const delay of delays){
          if(delay)await wait(delay);
          if(!navigator.onLine)return false;
          recovered=await recoverRunnerAuth();
          if(recovered||state.auth?.role==="runner")break;
        }
        if(!recovered&&state.auth?.role!=="runner"){
          if(scheduleControlledOnlineReload())return false;
          setStatus("Conexión recuperada · esperando a que Firebase restaure la sesión…","ok");
          return false;
        }
      }

      await forceFreshRunnerToken();
      setStatus("Conexión recuperada · sincronizando tus carreras…","ok");
      try{
        await refreshEventsAfterReconnect();
      }catch(error){
        console.warn("[MILITOPO runner dashboard] reconnect events",error);
        if(!activeRaceSnapshot()&&scheduleControlledOnlineReload())return false;
        // Durante una carrera jamás sustituimos la UI local por un error de Functions.
        setStatus(activeRaceSnapshot()?"Conexión recuperada · carrera protegida. Reintentando sincronización con el organizador…":"Conexión recuperada · reintentando sincronización…","ok");
        return false;
      }

      // El histórico no bloquea la recuperación del dashboard. Si tarda o falla,
      // conserva lo que ya hubiera en pantalla y podrá actualizarse después.
      try{await loadHistory(true);}catch(_){}
      clearOnlineRecoveryReload();
      setStatus("✅ Conexión recuperada · datos sincronizados.","ok");
      return true;
    })();
    try{return await state.onlineRefreshPromise;}finally{state.onlineRefreshPromise=null;state.onlineRevalidating=false;}
  }
  async function recoverRunnerAuth(){
    if(state.auth?.uid)return state.auth.role==="runner";
    if(state.recoveryPromise)return state.recoveryPromise;

    // I1.2: JAMÁS inferir "runner" solo porque Firebase tenga un usuario autenticado.
    // La recuperación rápida solo es válida si este MISMO uid ya tenía un snapshot runner.
    // Esto evita que organizer/super_admin sean degradados por el recuperador del dashboard.
    const snap=cachedAuth();
    if(!snap?.uid || snap.role!=="runner") return false;

    state.recoveryPromise=(async()=>{
      try{
        const svc=await services();
        if(typeof svc.auth?.authStateReady==="function"){
          await Promise.race([svc.auth.authStateReady(),new Promise(resolve=>setTimeout(resolve,8000))]);
        } else {
          await new Promise(resolve=>setTimeout(resolve,600));
        }
        const user=svc.auth?.currentUser;
        if(!user||!user.emailVerified)return false;
        if(String(user.uid||"")!==String(snap.uid||"")){
          try{localStorage.removeItem(LAST_ROLE_KEY);localStorage.removeItem(AUTH_SNAPSHOT_KEY);document.documentElement.classList.remove("militopo-runner-restore");}catch(_){}
          return false;
        }

        // Si los claims están disponibles, son autoridad: si esta cuenta ya no es runner,
        // cancelamos la restauración y limpiamos cualquier hint local antiguo.
        let token=null;
        try{token=await Promise.race([user.getIdTokenResult(false),new Promise(resolve=>setTimeout(()=>resolve(null),5000))]);}catch(_){}
        const claimedRole=String(token?.claims?.role||"").trim();
        if(claimedRole && claimedRole!=="runner"){
          try{localStorage.removeItem(LAST_ROLE_KEY);localStorage.removeItem(AUTH_SNAPSHOT_KEY);document.documentElement.classList.remove("militopo-runner-restore");}catch(_){}
          hide();
          return false;
        }

        activate({uid:user.uid,email:user.email||snap.email||null,displayName:snap.displayName||user.displayName||null,username:snap.username||null,role:"runner",emailVerified:true},true);
        return true;
      }catch(error){
        console.warn("[MILITOPO runner dashboard] auth recovery",error);
        return false;
      }finally{
        state.recoveryPromise=null;
      }
    })();
    return state.recoveryPromise;
  }

  function cleanupInviteSignals(){
    try{state.unsubInviteSignals?.();}catch(_){}
    state.unsubInviteSignals=null;
    state.inviteSignalSignature="";
  }

  async function bindInviteSignals(){
    cleanupInviteSignals();
    if(!state.auth?.uid) return;
    try{
      const svc=await services(), api=svc.databaseApi;
      if(!api) return;
      const signalRef=api.ref(`v2/userSignals/${state.auth.uid}/invitations`);
      state.unsubInviteSignals=api.onValue(signalRef,snap=>{
        const rows=snap.exists()?(snap.val()||{}):{};
        const pending=Object.entries(rows).filter(([,row])=>String(row?.status||"pending")==="pending").map(([id])=>id).sort();
        const signature=pending.join("|");
        if(signature && signature!==state.inviteSignalSignature){
          state.inviteSignalSignature=signature;
          try{globalThis.dispatchEvent(new CustomEvent("militopo:v2-invitation-refresh",{detail:{source:"rtdb-signal",pending:pending.length}}));}catch(_){}
          updateAccountInviteBadge(pending.length);
        } else if(!signature){
          state.inviteSignalSignature="";
          updateAccountInviteBadge(0);
        }
      },error=>console.warn("[MILITOPO runner dashboard] invitation signals",error));
    }catch(error){
      console.warn("[MILITOPO runner dashboard] bind invitation signals",error);
    }
  }

  function readEventsSnapshot(){
    try{const raw=localStorage.getItem(EVENTS_SNAPSHOT_KEY);if(!raw)return [];const rows=JSON.parse(raw);return Array.isArray(rows)?rows:[];}catch(_){return [];}
  }
  function writeEventsSnapshot(rows){
    try{localStorage.setItem(EVENTS_SNAPSHOT_KEY,JSON.stringify(Array.isArray(rows)?rows:[]));}catch(_){}
  }


  function installStyle(){
    if(document.getElementById("m2RunnerDashboardStyle")) return;
    const style=document.createElement("style"); style.id="m2RunnerDashboardStyle";
    style.textContent=`
      #m2RunnerDashboard{position:fixed;inset:0;z-index:99997;overflow:auto;background:radial-gradient(circle at 50% 0,rgba(70,108,48,.28),transparent 34%),linear-gradient(180deg,#0b140c,#070c08 76%);color:#f5e6c8;font-family:"Courier New",ui-monospace,monospace;padding:max(88px,calc(env(safe-area-inset-top) + 74px)) 12px calc(34px + env(safe-area-inset-bottom))}
      #m2RunnerDashboard[hidden]{display:none!important}.m2rd-shell{width:min(760px,100%);margin:0 auto;display:grid;gap:14px}.m2rd-card{border:1px solid rgba(240,193,106,.30);border-radius:26px;background:linear-gradient(180deg,rgba(31,55,28,.97),rgba(15,29,18,.98));padding:16px;box-shadow:0 14px 40px rgba(0,0,0,.24)}
      .m2rd-hero{text-align:center;padding:18px 14px}.m2rd-logo{width:92px;height:92px;border-radius:24px;border:3px solid rgba(240,193,106,.72);object-fit:cover}.m2rd-title{margin:10px 0 2px;color:#f0c16a;letter-spacing:.16em;font-size:clamp(1.7rem,8vw,2.7rem)}.m2rd-sub{margin:0;color:#c7bda8;font-size:.82rem;line-height:1.45}.m2rd-kicker{margin:0 0 10px;color:#e6f6d7;font-size:1rem;letter-spacing:.06em}
      .m2rd-id{display:grid;grid-template-columns:54px minmax(0,1fr);gap:12px;align-items:center}.m2rd-avatar{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;background:#cee99a;color:#172511;font-weight:900;font-size:1rem;border:2px solid rgba(240,193,106,.45)}.m2rd-name{font-weight:900;overflow-wrap:anywhere}.m2rd-meta{margin-top:4px;color:#b7ad99;font-size:.75rem;overflow-wrap:anywhere}
      .m2rd-account{position:relative;width:100%;min-height:44px;margin-top:12px;border-radius:13px;border:1px solid rgba(240,193,106,.38);background:rgba(240,193,106,.10);color:#fff1d2;font:inherit;font-weight:900}.m2rd-account-badge{position:absolute;right:10px;top:50%;transform:translateY(-50%);min-width:20px;height:20px;padding:0 6px;border-radius:999px;display:grid;place-items:center;background:#f0c66f;color:#17130b;font-size:.68rem;font-weight:1000;border:2px solid #1a2b18}.m2rd-account-badge[hidden]{display:none!important}.m2rd-status{padding:10px 11px;border-radius:13px;background:rgba(255,255,255,.035);color:#c7bda8;font-size:.78rem;line-height:1.45}.m2rd-status.ok{border:1px solid rgba(126,220,150,.25);color:#dcf4cf}.m2rd-status.err{border:1px solid rgba(255,142,122,.28);color:#ffd0c8}
      .m2rd-events{display:grid;gap:10px;margin-top:10px}.m2rd-event{border:1px solid rgba(255,255,255,.10);border-radius:16px;background:rgba(255,255,255,.035);padding:13px}.m2rd-event strong{display:block;font-size:.94rem}.m2rd-event-meta{margin-top:4px;color:#b7ad99;font-size:.72rem}.m2rd-pill{display:inline-block;margin-top:8px;padding:5px 9px;border-radius:999px;border:1px solid rgba(126,220,150,.36);color:#e0f6d4;font-size:.68rem;font-weight:900}.m2rd-route{margin-top:9px;padding:10px;border-radius:12px;border:1px solid rgba(240,193,106,.28);background:rgba(240,193,106,.07)}.m2rd-route-head{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:.72rem;font-weight:900;color:#f2dfb5}.m2rd-route-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin-top:7px}.m2rd-route-grid span{display:block;padding:6px 5px;border-radius:9px;background:rgba(0,0,0,.14);font-size:.58rem;color:#9e9b8e}.m2rd-route-grid strong{display:block;margin-top:2px;color:#f3f0e8;font-size:.68rem;overflow-wrap:anywhere}.m2rd-route-seq{margin-top:7px;font-size:.62rem;line-height:1.45;color:#bdb49f;overflow-wrap:anywhere}.m2rd-note{margin-top:9px;padding:9px 10px;border-radius:12px;background:rgba(240,193,106,.08);color:#eadbbf;font-size:.75rem;line-height:1.4}.m2rd-live{margin-top:9px;padding:9px 10px;border-radius:12px;border:1px solid rgba(126,220,150,.28);background:rgba(126,220,150,.10);color:#ddf6d2;font-size:.75rem;font-weight:900}.m2rd-btn{width:100%;min-height:45px;margin-top:9px;border-radius:13px;border:1px solid rgba(126,220,150,.40);background:rgba(126,220,150,.15);color:#efffe8;font:inherit;font-weight:900}.m2rd-btn:disabled{opacity:.48}.m2rd-small{margin-top:10px;color:#978e7e;font-size:.68rem;line-height:1.45}
      .m2rd-history-head{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:10px 0}.m2rd-history-stat{padding:9px 7px;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);text-align:center}.m2rd-history-stat strong{display:block;font-size:1rem;color:#f4e7c8}.m2rd-history-stat span{display:block;margin-top:2px;font-size:.58rem;letter-spacing:.06em;color:#9f9889}.m2rd-history{display:grid;gap:9px}.m2rd-history-row{padding:12px;border-radius:15px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.09)}.m2rd-history-top{display:flex;gap:8px;justify-content:space-between;align-items:flex-start}.m2rd-history-title{min-width:0}.m2rd-history-title strong{display:block;font-size:.9rem}.m2rd-history-date{margin-top:3px;color:#a9a18f;font-size:.68rem}.m2rd-history-state{flex:0 0 auto;padding:4px 7px;border-radius:999px;font-size:.61rem;font-weight:900;border:1px solid rgba(126,220,150,.30);color:#daf3cf}.m2rd-history-state.incomplete{border-color:rgba(240,193,106,.34);color:#f5dfaf}.m2rd-history-state.not_started{border-color:rgba(170,170,170,.25);color:#c4c4c4}.m2rd-history-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:9px}.m2rd-history-metric{padding:7px;border-radius:10px;background:rgba(0,0,0,.12)}.m2rd-history-metric span{display:block;font-size:.56rem;color:#8f978d;letter-spacing:.05em}.m2rd-history-metric strong{display:block;margin-top:3px;font-size:.76rem;color:#edf2e8}.m2rd-history-refresh{min-height:40px;margin-top:9px}.m2rd-history-detail-btn{width:100%;min-height:38px;margin-top:9px;border-radius:11px;border:1px solid rgba(240,193,106,.34);background:rgba(240,193,106,.10);color:#fff0cf;font:inherit;font-size:.72rem;font-weight:900}
      .m2rd-detail{position:fixed;inset:0;z-index:100003;overflow:auto;background:rgba(4,8,5,.985);padding:max(72px,calc(env(safe-area-inset-top) + 58px)) 10px calc(28px + env(safe-area-inset-bottom));color:#f5e6c8}.m2rd-detail[hidden]{display:none!important}.m2rd-detail-shell{width:min(860px,100%);margin:0 auto;display:grid;gap:12px}.m2rd-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.m2rd-detail-head h2{margin:0;color:#f0c16a;font-size:1.15rem}.m2rd-detail-close{min-width:44px;min-height:40px;border-radius:11px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.07);color:#fff;font:inherit;font-weight:900}.m2rd-detail-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.m2rd-detail-stat{padding:9px 7px;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08)}.m2rd-detail-stat span{display:block;font-size:.56rem;color:#9a9b8f;letter-spacing:.05em}.m2rd-detail-stat strong{display:block;margin-top:4px;font-size:.78rem;color:#eef3e9;overflow-wrap:anywhere}.m2rd-detail-maptools{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin-top:10px}.m2rd-detail-layer{min-height:34px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.22);color:#f6efe2;font:inherit;font-size:.65rem;font-weight:900}.m2rd-detail-layer.active{background:#d8b45e;color:#201608;border-color:#f2d58f}.m2rd-detail-layer.loading{opacity:.62;cursor:wait}.m2rd-detail-layerstatus{min-height:18px;margin:6px 0 0;font-size:.64rem;opacity:.76}.m2rd-detail-layerstatus.err{color:#ffc5b9;opacity:1}.m2rd-detail-map{height:390px;margin-top:8px;border-radius:15px;overflow:hidden;border:1px solid rgba(255,255,255,.12);background:#172017}.m2rd-detail-note{margin-top:8px;color:#a9a18f;font-size:.67rem;line-height:1.4}.m2rd-control-list{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.m2rd-control-chip{padding:5px 7px;border-radius:999px;border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.035);font-size:.62rem}.m2rd-control-chip.start{border-color:rgba(126,220,150,.35);color:#daf4d0}.m2rd-control-chip.finish{border-color:rgba(255,145,130,.30);color:#ffd3cb}.m2rd-pass-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:9px}.m2rd-pass-note{margin:9px 0;color:#aaa28f;font-size:.66rem;line-height:1.45}.m2rd-pass-table-wrap{overflow:auto;border:1px solid rgba(255,255,255,.08);border-radius:13px;max-height:360px}.m2rd-pass-table{width:100%;min-width:690px;border-collapse:collapse}.m2rd-pass-table th,.m2rd-pass-table td{padding:8px 7px;border-bottom:1px solid rgba(255,255,255,.06);font-size:.62rem;text-align:left;white-space:nowrap}.m2rd-pass-table th{position:sticky;top:0;background:#172719;color:#f0dca6;font-size:.55rem}.m2rd-pass-ok{color:#cceec7;font-weight:900}.m2rd-pass-discard{color:#f3ca77;font-weight:900}.m2rd-pass-miss{color:#ffd0c8;font-weight:900}
      .m2rd-playback{margin-top:10px;padding:10px;border-radius:14px;border:1px solid rgba(240,193,106,.18);background:rgba(0,0,0,.16)}.m2rd-playback-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}.m2rd-playback-actions{display:flex;gap:6px;flex-wrap:wrap}.m2rd-playback-btn,.m2rd-playback-speed{min-height:36px;border-radius:10px;border:1px solid rgba(240,193,106,.30);background:rgba(240,193,106,.08);color:#fff0cf;font:inherit;font-size:.66rem;font-weight:900;padding:0 10px}.m2rd-playback-btn.primary{background:#d8b45e;color:#201608;border-color:#f2d58f}.m2rd-playback-time{font-size:.68rem;color:#d9d1c2;font-weight:900;white-space:nowrap}.m2rd-playback-objective{display:grid;grid-template-columns:auto minmax(0,1fr);gap:3px 10px;align-items:center;margin-top:10px;padding:9px 10px;border-radius:11px;border:1px solid rgba(240,193,106,.22);background:linear-gradient(90deg,rgba(240,193,106,.10),rgba(255,255,255,.025))}.m2rd-playback-objective span{grid-row:1/3;font-size:.53rem;letter-spacing:.07em;color:#a99d83;font-weight:900}.m2rd-playback-objective strong{font-size:.78rem;color:#ffe4a1;letter-spacing:.035em}.m2rd-playback-objective small{font-size:.58rem;color:#b8b1a2}.m2rd-playback-slider{width:100%;margin:10px 0 2px;accent-color:#d8b45e}.m2rd-playback-meta{display:flex;justify-content:space-between;gap:8px;color:#a9a18f;font-size:.61rem}.m2rd-playback-empty{opacity:.58}.m2rd-playback-marker{position:relative;width:34px;height:34px;display:grid;place-items:center;transform:rotate(var(--m2rd-heading,0deg));transform-origin:50% 50%;filter:drop-shadow(0 5px 7px rgba(0,0,0,.58));transition:transform .12s linear}.m2rd-playback-marker svg{width:34px;height:34px;overflow:visible}.m2rd-playback-marker .nav-shadow{fill:rgba(0,0,0,.30)}.m2rd-playback-marker .nav-body{fill:#f0c16a;stroke:#fff7df;stroke-width:1.7;stroke-linejoin:round}.m2rd-playback-marker .nav-core{fill:#182116}.m2rd-playback-marker:after{content:"";position:absolute;inset:7px;border-radius:50%;box-shadow:0 0 0 0 rgba(240,193,106,.40);animation:m2rdRunnerPulse 1.45s ease-out infinite;pointer-events:none}
      .m2rd-class-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.m2rd-class-tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px}.m2rd-class-tab{min-height:38px;border-radius:11px;border:1px solid rgba(240,193,106,.28);background:rgba(240,193,106,.07);color:#f6ead1;font:inherit;font-size:.68rem;font-weight:900}.m2rd-class-tab.active{background:#d8b45e;color:#201608;border-color:#f2d58f}.m2rd-class-table-wrap{overflow:auto;margin-top:8px;border:1px solid rgba(255,255,255,.08);border-radius:13px;max-height:350px}.m2rd-class-table{width:100%;min-width:720px;border-collapse:collapse}.m2rd-class-table th,.m2rd-class-table td{padding:8px 7px;border-bottom:1px solid rgba(255,255,255,.06);font-size:.62rem;text-align:left;white-space:nowrap}.m2rd-class-table th{position:sticky;top:0;background:#172719;color:#f0dca6;font-size:.55rem}.m2rd-class-me{background:rgba(240,193,106,.10)}.m2rd-class-rank{font-weight:900;color:#f0dca6}.m2rd-class-note{margin-top:8px;color:#a9a18f;font-size:.66rem;line-height:1.4}
      .m2rd-map-marker{position:relative;width:36px;height:36px;display:grid;place-items:center;filter:drop-shadow(0 5px 8px rgba(0,0,0,.42));transform-origin:center}.m2rd-map-marker svg{width:36px;height:36px;overflow:visible}.m2rd-map-marker text{font-family:"Courier New",monospace;font-weight:1000;paint-order:stroke;stroke:rgba(7,12,8,.78);stroke-width:2px;stroke-linejoin:round}.m2rd-map-marker.control .marker-ring{fill:rgba(18,32,20,.92);stroke:#f2cf82;stroke-width:3}.m2rd-map-marker.control .marker-core{fill:#f2cf82}.m2rd-map-marker.start .marker-shape{fill:#397d55;stroke:#f1ffe9;stroke-width:2.5}.m2rd-map-marker.finish .marker-outer{fill:rgba(34,21,21,.92);stroke:#f3d7d2;stroke-width:3}.m2rd-map-marker.finish .marker-inner{fill:none;stroke:#d76d68;stroke-width:2}.m2rd-map-marker.validated .marker-state-dot{background:#76d692}.m2rd-map-marker.discarded .marker-state-dot{background:#f0b55f}.m2rd-map-marker.pending .marker-state-dot{background:#d9796b}.m2rd-map-marker .marker-state-dot{position:absolute;right:-1px;bottom:-1px;width:9px;height:9px;border-radius:50%;border:2px solid #101710;background:#b6b6b6}.m2rd-map-marker.discarded:after{content:"";position:absolute;width:27px;height:3px;border-radius:999px;background:#ffb35b;transform:rotate(-42deg);box-shadow:0 0 0 1px rgba(40,18,0,.6)}.m2rd-map-marker.is-objective{z-index:5;animation:m2rdObjectivePulse .72s ease-in-out infinite;filter:drop-shadow(0 0 8px rgba(255,232,91,.95)) drop-shadow(0 0 18px rgba(255,178,43,.72))}.m2rd-map-marker.is-objective:before,.m2rd-map-marker.is-objective:after{content:"";position:absolute;border-radius:50%;pointer-events:none}.m2rd-map-marker.is-objective:before{inset:-10px;border:3px solid #fff25e;box-shadow:0 0 0 5px rgba(255,223,74,.22),0 0 24px rgba(255,218,76,.95);animation:m2rdObjectiveRing .78s ease-out infinite}.m2rd-map-marker.is-objective:after{inset:-17px;border:2px solid rgba(255,247,163,.95);box-shadow:0 0 18px rgba(255,208,43,.72);animation:m2rdObjectiveRing2 .78s .18s ease-out infinite}.m2rd-map-marker.control.is-objective .marker-ring{stroke:#fff25e;stroke-width:4.2;fill:#26351c}.m2rd-map-marker.control.is-objective .marker-core{fill:#fff25e}.m2rd-map-marker.start.is-objective:before,.m2rd-map-marker.start.is-objective:after{border-radius:12px}.m2rd-detail-map .leaflet-marker-icon{background:transparent!important;border:0!important}.m2rd-detail-map .leaflet-popup-content-wrapper{background:#152119;color:#f4ead6;border:1px solid rgba(240,193,106,.28);border-radius:12px}.m2rd-detail-map .leaflet-popup-tip{background:#152119}@keyframes m2rdObjectivePulse{0%,100%{transform:scale(1);filter:brightness(1)}50%{transform:scale(1.20);filter:brightness(1.55)}}@keyframes m2rdObjectiveRing{0%{transform:scale(.74);opacity:1}100%{transform:scale(1.52);opacity:0}}@keyframes m2rdObjectiveRing2{0%{transform:scale(.70);opacity:.95}100%{transform:scale(1.72);opacity:0}}@keyframes m2rdRunnerPulse{0%{box-shadow:0 0 0 0 rgba(240,193,106,.40)}75%,100%{box-shadow:0 0 0 11px rgba(240,193,106,0)}}
      .m2rd-detail-map .leaflet-control-attribution{font-size:9px}.m2rd-detail-maplegend{display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;font-size:.62rem;opacity:.75}.m2rd-detail-maplegend span{display:inline-flex;align-items:center;gap:5px}
      @media(max-width:430px){#m2RunnerDashboard{padding-left:9px;padding-right:9px}.m2rd-card{border-radius:22px}.m2rd-history-head{grid-template-columns:1fr 1fr}.m2rd-history-metrics{grid-template-columns:1fr 1fr 1fr}.m2rd-detail-grid{grid-template-columns:1fr 1fr}.m2rd-class-summary{grid-template-columns:1fr 1fr}.m2rd-pass-summary{grid-template-columns:1fr 1fr}.m2rd-playback-head{grid-template-columns:1fr}.m2rd-playback-time{text-align:left}.m2rd-detail-map{height:320px}}
    `;
    document.head.appendChild(style);
  }

  function ensureRoot(){
    installStyle();
    if(state.root?.isConnected) return state.root;
    const root=document.createElement("section"); root.id="m2RunnerDashboard"; root.hidden=true;
    root.innerHTML=`<div class="m2rd-shell">
      <section class="m2rd-card m2rd-hero"><img class="m2rd-logo" src="icons/militopo-512.png" alt="MILITOPO"><h1 class="m2rd-title">MILITOPO</h1><p class="m2rd-sub"><strong>ÁREA DEL CORREDOR</strong><br>Tus carreras, invitaciones y sesiones Live V2.</p></section>
      <section class="m2rd-card"><h2 class="m2rd-kicker">👤 MI CUENTA</h2><div class="m2rd-id"><div id="m2rdAvatar" class="m2rd-avatar">R</div><div><div id="m2rdName" class="m2rd-name">Corredor</div><div id="m2rdMeta" class="m2rd-meta">runner</div></div></div><button id="m2rdAccount" class="m2rd-account" type="button">MI CUENTA<span id="m2rdAccountBadge" class="m2rd-account-badge" hidden>0</span></button></section>
      <section class="m2rd-card"><h2 class="m2rd-kicker">📡 LIVE V2 · MIS CARRERAS</h2><div id="m2rdStatus" class="m2rd-status">Cargando tus carreras…</div><div id="m2rdEvents" class="m2rd-events"></div><button id="m2rdRetry" class="m2rd-btn" type="button" hidden>REINTENTAR</button><div class="m2rd-small">El acceso a Organizador está reservado a organizer/super_admin. Tu cuenta runner entra directamente aquí.</div></section>
      <section class="m2rd-card"><h2 class="m2rd-kicker">🏁 MI HISTÓRICO</h2><div id="m2rdHistoryStatus" class="m2rd-status">Cargando tus resultados…</div><div class="m2rd-history-head"><div class="m2rd-history-stat"><strong id="m2rdHistoryTotal">0</strong><span>RESULTADOS</span></div><div class="m2rd-history-stat"><strong id="m2rdHistoryFinished">0</strong><span>FINALIZADOS</span></div><div class="m2rd-history-stat"><strong id="m2rdHistoryIncomplete">0</strong><span>INCOMPLETOS</span></div><div class="m2rd-history-stat"><strong id="m2rdHistoryNotStarted">0</strong><span>NO SALIÓ</span></div></div><div id="m2rdHistory" class="m2rd-history"></div><button id="m2rdHistoryRefresh" class="m2rd-btn m2rd-history-refresh" type="button">ACTUALIZAR HISTÓRICO</button><div class="m2rd-small">Resultados permanentes guardados en Firestore. Pulsa VER DETALLE para consultar mapa, track y métricas completas.</div></section>
    </div>
    <section id="m2rdHistoryDetail" class="m2rd-detail" hidden><div class="m2rd-detail-shell">
      <section class="m2rd-card"><div class="m2rd-detail-head"><div><div class="m2rd-kicker">🏁 DETALLE DE PARTICIPACIÓN</div><h2 id="m2rdDetailTitle">Carrera</h2><div id="m2rdDetailSubtitle" class="m2rd-history-date">Resultado histórico</div></div><button id="m2rdDetailClose" class="m2rd-detail-close" type="button" aria-label="Cerrar detalle">✕</button></div><div id="m2rdDetailStatus" class="m2rd-status" style="margin-top:12px">Selecciona una carrera.</div></section>
      <section class="m2rd-card"><h3 class="m2rd-kicker">📊 RESULTADO</h3><div id="m2rdDetailMetrics" class="m2rd-detail-grid"></div></section>
      <section class="m2rd-card"><h3 class="m2rd-kicker">🏆 CLASIFICACIÓN</h3><div id="m2rdClassificationStatus" class="m2rd-status">Cargando clasificación…</div><div id="m2rdClassificationSummary" class="m2rd-class-summary" style="margin-top:10px"></div><div class="m2rd-class-tabs"><button id="m2rdClassGeneralBtn" class="m2rd-class-tab active" type="button" data-class-view="general">GENERAL</button><button id="m2rdClassRouteBtn" class="m2rd-class-tab" type="button" data-class-view="route">MI RECORRIDO</button></div><div class="m2rd-class-table-wrap"><table class="m2rd-class-table"><thead><tr><th>PUESTO</th><th>CORREDOR</th><th>PLAZA</th><th>RECORRIDO</th><th>D. REDUCIDA</th><th>TIEMPO OFICIAL</th><th>DIF. LÍDER</th></tr></thead><tbody id="m2rdClassificationBody"><tr><td colspan="7">Cargando…</td></tr></tbody></table></div><div id="m2rdClassificationNote" class="m2rd-class-note"></div></section>
      <section class="m2rd-card"><h3 class="m2rd-kicker">🗺️ TRACK Y CARTOGRAFÍA</h3><div class="m2rd-detail-maptools" role="tablist" aria-label="Cartografía del track histórico"><button class="m2rd-detail-layer active" type="button" data-detail-layer="mapant">MAPANT</button><button class="m2rd-detail-layer" type="button" data-detail-layer="ign">IGN</button><button class="m2rd-detail-layer" type="button" data-detail-layer="aerial">AÉREO</button><button class="m2rd-detail-layer" type="button" data-detail-layer="custom">PLANO CARRERA</button></div><div id="m2rdDetailLayerStatus" class="m2rd-detail-layerstatus">Fondo: MAPANT</div><div id="m2rdDetailMap" class="m2rd-detail-map"></div><div class="m2rd-playback"><div class="m2rd-playback-head"><div class="m2rd-playback-actions"><button id="m2rdPlaybackToggle" class="m2rd-playback-btn primary" type="button">▶ REPRODUCIR</button><button id="m2rdPlaybackReset" class="m2rd-playback-btn" type="button">↺ REINICIAR</button><select id="m2rdPlaybackSpeed" class="m2rd-playback-speed" aria-label="Velocidad de reproducción"><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option><option value="10">10×</option></select></div><div id="m2rdPlaybackClock" class="m2rd-playback-time">00:00 / 00:00</div></div><div class="m2rd-playback-objective"><span>OBJETIVO EN ESE MOMENTO</span><strong id="m2rdPlaybackObjective">—</strong><small id="m2rdPlaybackObjectiveMeta">Mueve la línea temporal para reconstruir la navegación.</small></div><input id="m2rdPlaybackSlider" class="m2rd-playback-slider" type="range" min="0" max="1000" value="0" step="1" aria-label="Posición temporal del track"><div class="m2rd-playback-meta"><span>Salida</span><span>Reproducción GPS histórica</span><span>Llegada</span></div></div><div class="m2rd-detail-maplegend"><span>━ Track completo</span><span>━ Tramo reproducido</span><span>┄ Objetivo actual</span><span>➤ Dirección del corredor</span><span>● verde validada · ● ámbar descartada · ● rojo pendiente</span><span>◎ Baliza / △ salida / ⦿ llegada</span></div><button id="m2rdDetailFit" class="m2rd-btn" type="button">ENCUADRAR RECORRIDO</button><div id="m2rdDetailMapNote" class="m2rd-detail-note">El track se carga desde Firestore, no desde la sesión Live.</div></section>
      <section class="m2rd-card"><h3 class="m2rd-kicker">🎯 PASO POR BALIZAS · ESTADO OFICIAL</h3><div id="m2rdPassSummary" class="m2rd-pass-summary"></div><div id="m2rdPassNote" class="m2rd-pass-note">Cada baliza queda identificada como VALIDADA, DESCARTADA o PENDIENTE. Descartadas y pendientes al finalizar penalizan +15:00 cada una.</div><div class="m2rd-pass-table-wrap"><table class="m2rd-pass-table"><thead><tr><th>#</th><th>BALIZA</th><th>ESTADO</th><th>HORA</th><th>DESDE SALIDA</th><th>PARCIAL</th><th>MÉTODO / PENALIZACIÓN</th></tr></thead><tbody id="m2rdPassBody"><tr><td colspan="7">Sin análisis.</td></tr></tbody></table></div></section>
      <section class="m2rd-card"><h3 class="m2rd-kicker">◆ DATOS DE LA CARRERA</h3><div id="m2rdDetailEventMetrics" class="m2rd-detail-grid"></div><div id="m2rdDetailControls" class="m2rd-control-list"></div></section>
    </div></section>`;
    document.body.appendChild(root); state.root=root; updateAccountInviteBadge(state.pendingInvites);
    root.querySelector("#m2rdAccount")?.addEventListener("click",()=>{
      const accountBtn=document.getElementById("m2AuthAccountBtn");
      if(state.auth?.uid&&accountBtn){accountBtn.click();return;}
      recoverRunnerAuth().then(ok=>{
        if(ok){document.getElementById("m2AuthAccountBtn")?.click();return;}
        try{globalThis.dispatchEvent(new CustomEvent("militopo:v2-auth-recovery-failed"));}catch(_){}
        hide();
      });
    });
    root.querySelector("#m2rdRetry")?.addEventListener("click",async()=>{
      if(!state.auth?.uid){ setStatus("Reintentando recuperación de sesión…"); const ok=await recoverRunnerAuth(); if(!ok)setStatus("Todavía no se ha restaurado la sesión. Espera unos segundos y vuelve a intentar.","err"); return; }
      loadEvents(true);
    });
    root.querySelector("#m2rdHistoryRefresh")?.addEventListener("click",()=>loadHistory(false));
    root.querySelector("#m2rdDetailClose")?.addEventListener("click",()=>closeHistoryDetail());
    root.querySelector("#m2rdDetailFit")?.addEventListener("click",()=>fitHistoryDetailMap());
    root.querySelector("#m2rdPlaybackToggle")?.addEventListener("click",()=>toggleHistoryPlayback());
    root.querySelector("#m2rdPlaybackReset")?.addEventListener("click",()=>resetHistoryPlayback(true));
    root.querySelector("#m2rdPlaybackSlider")?.addEventListener("input",e=>seekHistoryPlayback(Number(e.target.value||0)));
    root.querySelector("#m2rdPlaybackSpeed")?.addEventListener("change",e=>{const speed=Number(e.target.value||1);state.detailPlaybackSpeed=[1,2,4,10].includes(speed)?speed:1;});
    root.addEventListener("click",e=>{
      const detailBtn=e.target.closest("[data-history-detail]");
      if(detailBtn){openHistoryDetail(String(detailBtn.dataset.historyDetail||""));return;}
      const classBtn=e.target.closest("[data-class-view]");
      if(classBtn){state.classificationView=String(classBtn.dataset.classView||"general");renderRunnerClassification();return;}
      const layerBtn=e.target.closest("[data-detail-layer]");
      if(layerBtn){switchHistoryDetailLayer(String(layerBtn.dataset.detailLayer||"mapant")).catch(error=>{console.error("[MILITOPO H4.1 layer]",error);state.detailRacePlanError=String(error?.message||"No se pudo cambiar el fondo cartográfico.");renderHistoryDetailLayerState();});return;}
      const reconnectBtn=e.target.closest("[data-reconnect-event]");
      if(reconnectBtn){const id=String(reconnectBtn.dataset.reconnectEvent||"");const event=state.events.find(row=>row.eventId===id);if(event){event.liveConnectError="";connectLive(event,{autoOpen:false});}return;}
      const btn=e.target.closest("[data-enter-event]");
      if(!btn)return; const id=btn.dataset.enterEvent||""; const event=state.events.find(row=>row.eventId===id); if(!event)return; const runId=state.active?.eventId===id?state.runId:String(event.liveRunId||""); if(!runId)return; window.dispatchEvent(new CustomEvent("militopo:v2-open-runner-race",{detail:{event:{...event},runId,auth:{...state.auth}}}));
    });
    return root;
  }
  function el(id){return ensureRoot().querySelector("#"+id);}
  function setStatus(msg,type=""){const n=el("m2rdStatus");n.textContent=msg;n.className=`m2rd-status${type?` ${type}`:""}`;}
  function updateAccountInviteBadge(count){
    const n=Math.max(0,Number(count||0));state.pendingInvites=n;
    const badge=state.root?.querySelector?.("#m2rdAccountBadge");
    if(badge){badge.hidden=n===0;badge.textContent=n>9?"9+":String(n);}
  }
  function reveal(){
    const root=ensureRoot(); root.hidden=false;
    const startup=document.getElementById("startupModeOverlay"); if(startup){startup.hidden=true;startup.style.display="none";}
    document.documentElement.style.background="#081008";
  }
  function hide(){ if(state.root)state.root.hidden=true; cleanupLive(); }
  function paintIdentity(auth){
    el("m2rdName").textContent=auth.displayName||auth.email||"Corredor";
    el("m2rdMeta").textContent=`${auth.username?`@${auth.username} · `:""}runner · ${auth.email||""}`;
    el("m2rdAvatar").textContent=initials(auth.displayName||auth.email||"R");
  }
  function cleanupLive(){
    try{state.unsubRun?.();}catch(_){} try{state.unsubParticipant?.();}catch(_){} state.unsubRun=null;state.unsubParticipant=null;
    if(state.heartbeat){clearInterval(state.heartbeat);state.heartbeat=null;} state.runId="";state.participantStatus="";state.active=null;
  }
  function cleanupEventWatchers(){
    for(const unsubscribe of state.eventWatchers.values()){try{unsubscribe?.();}catch(_){}}
    state.eventWatchers.clear();
    if(state.liveSelectionTimer){clearTimeout(state.liveSelectionTimer);state.liveSelectionTimer=null;}
  }
  function participantRank(status){
    const value=String(status||"").toLowerCase();
    if(value==="racing"||value==="started") return 0;
    if(value==="ready"||value==="not_started") return 1;
    if(!value) return 2;
    if(value==="finished") return 9;
    return 3;
  }
  function liveCandidates(){
    return state.events
      .filter(row=>String(row?.status||"").toLowerCase()==="live" && String(row?.liveRunId||"").trim())
      .sort((a,b)=>{
        const ar=participantRank(a.participantLiveStatus), br=participantRank(b.participantLiveStatus);
        if(ar!==br) return ar-br;
        return Number(b.liveStartedAt||0)-Number(a.liveStartedAt||0);
      });
  }
  function raceScreenVisible(){
    const root=document.getElementById("m2RaceV2");
    return Boolean(root && !root.hidden);
  }
  function maybeOpenRunnerRace(event, runId, status){
    const st=String(status||"ready").toLowerCase();
    if(!event||!runId||st==="finished"||raceScreenVisible()) return;
    const key=`${event.eventId}:${runId}`;
    if(state.autoOpenedRuns.has(key)) return;
    state.autoOpenedRuns.add(key);
    try{
      window.dispatchEvent(new CustomEvent("militopo:v2-open-runner-race",{detail:{event:{...event},runId,auth:{...state.auth},autoOpened:true}}));
    }catch(_){}
  }
  function scheduleLiveSelection(delay=100){
    if(state.liveSelectionTimer) clearTimeout(state.liveSelectionTimer);
    state.liveSelectionTimer=setTimeout(()=>{
      state.liveSelectionTimer=null;
      const candidates=liveCandidates();
      if(!candidates.length) return;
      const current=state.active && state.events.find(row=>row.eventId===state.active.eventId);
      const currentStatus=String(current?.participantLiveStatus||state.participantStatus||"").toLowerCase();
      // Una carrera ya EN CARRERA nunca debe ser desplazada por otra sesión Live.
      if(state.active?.eventId && state.runId && ["racing","started"].includes(currentStatus)){
        return;
      }
      const target=candidates[0];
      if(state.active?.eventId===target.eventId && state.runId){
        return;
      }
      // Conectamos Live en segundo plano, pero nunca abrimos automáticamente la pantalla
      // de carrera. El corredor entra de forma consciente desde MIS CARRERAS.
      connectLive(target,{autoOpen:false});
    },delay);
  }
  async function services(){
    if(state.services)return state.services;
    if(state.servicesPromise)return state.servicesPromise;
    state.servicesPromise=(async()=>{
      const started=Date.now();
      while(typeof globalThis.MILITOPO_V2?.firebase!=="function"){
        if(Date.now()-started>8000)throw new Error("FIREBASE_BOOT_TIMEOUT");
        await new Promise(resolve=>setTimeout(resolve,120));
      }
      return await Promise.race([
        Promise.resolve(globalThis.MILITOPO_V2.firebase()),
        new Promise((_,reject)=>setTimeout(()=>reject(new Error("FIREBASE_SERVICES_TIMEOUT")),9000))
      ]);
    })();
    try{state.services=await state.servicesPromise;return state.services;}finally{state.servicesPromise=null;}
  }
  async function bindEventWatchers(){
    cleanupEventWatchers();
    if(!state.auth?.uid || !state.events.length) return;
    try{
      const svc=await services(), api=svc.databaseApi;
      if(!api) return;

      for(const event of state.events){
        if(!event?.ownerUid || !event?.eventId) continue;

        const memberRef=api.ref(`v2/live/${event.ownerUid}/${event.eventId}/members/${state.auth.uid}`);
        const activeRef=api.ref(`v2/live/${event.ownerUid}/${event.eventId}/activeRun`);

        let disposed=false;
        let memberUnsub=null;
        let activeUnsub=null;
        let participantUnsub=null;
        let participantRunId="";
        let retryTimer=null;
        let retryCount=0;

        const cleanupParticipant=()=>{
          try{participantUnsub?.();}catch(_){}
          participantUnsub=null;
          participantRunId="";
        };
        const cleanupActive=()=>{
          try{activeUnsub?.();}catch(_){}
          activeUnsub=null;
          cleanupParticipant();
        };
        const bindParticipant=(runId)=>{
          const cleanRunId=String(runId||"").trim();
          if(disposed||!cleanRunId||participantRunId===cleanRunId) return;
          cleanupParticipant();
          participantRunId=cleanRunId;
          const participantRef=api.ref(`v2/live/${event.ownerUid}/${event.eventId}/runs/${cleanRunId}/participants/${state.auth.uid}`);
          try{
            participantUnsub=api.onValue(participantRef,snap=>{
              const target=state.events.find(row=>row.eventId===event.eventId);
              if(!target) return;
              const row=snap.exists()?(snap.val()||{}):{};
              target.participantLiveStatus=String(row.status||"ready").toLowerCase();
              renderEvents();
              scheduleLiveSelection(60);
            },error=>{
              console.warn("[MILITOPO runner dashboard] participant watcher",event.eventId,error);
            });
          }catch(error){
            console.warn("[MILITOPO runner dashboard] participant bind",event.eventId,error);
          }
        };
        const scheduleRetry=()=>{
          if(disposed || retryTimer || retryCount>=12) return;
          const delay=Math.min(5000,700+(retryCount*350));
          retryCount+=1;
          retryTimer=setTimeout(()=>{
            retryTimer=null;
            bindActiveRun();
          },delay);
        };
        const applyActiveRun=snap=>{
          retryCount=0;
          const active=snap.exists()?(snap.val()||{}):{};
          const runId=String(active.runId||"").trim();
          const runStatus=String(active.status||"").toLowerCase();
          const target=state.events.find(row=>row.eventId===event.eventId);
          if(!target) return;

          if(runId && runStatus==="active"){
            target.status="live";
            target.liveRunId=runId;
            target.liveStatus=runStatus;
            target.liveStartedAt=Number(active.startedAt||0);
            bindParticipant(runId);
            renderEvents();
            // No conectamos cada watcher por su cuenta: si hay varias carreras
            // EN DIRECTO, una selección central evita que se pisen entre sí.
            scheduleLiveSelection(80);
          } else if(runStatus==="finished"){
            target.status="finished";
            target.liveStatus="finished";
            target.participantLiveStatus="finished";
            cleanupParticipant();
            renderEvents();
            if(state.active?.eventId===target.eventId){
              cleanupLive();
              setStatus("🏁 La sesión Live V2 ha finalizado.","ok");
            }
            scheduleLiveSelection(80);
            setTimeout(()=>loadEvents(false,true),500);
          }
        };
        const bindActiveRun=()=>{
          if(disposed || activeUnsub) return;
          try{
            activeUnsub=api.onValue(
              activeRef,
              applyActiveRun,
              error=>{
                console.warn("[MILITOPO runner dashboard] activeRun watcher",event.eventId,error);
                cleanupActive();
                scheduleRetry();
              }
            );
          }catch(error){
            console.warn("[MILITOPO runner dashboard] activeRun bind",event.eventId,error);
            cleanupActive();
            scheduleRetry();
          }
        };

        // La autorización RTDB puede llegar unos milisegundos después de aceptar
        // la invitación. Escuchamos primero el nodo propio del corredor (siempre
        // legible por su UID) y solo entonces abrimos el listener de activeRun.
        // Así evitamos que un PERMISSION_DENIED inicial cancele el listener para
        // siempre y obligue a recargar cuando el organizador pone EN DIRECTO.
        memberUnsub=api.onValue(
          memberRef,
          snap=>{
            const member=snap.exists()?(snap.val()||{}):{};
            if(member.active===true){
              bindActiveRun();
            }else{
              cleanupActive();
            }
          },
          error=>{
            console.warn("[MILITOPO runner dashboard] member watcher",event.eventId,error);
            scheduleRetry();
          }
        );

        state.eventWatchers.set(event.eventId,()=>{
          disposed=true;
          if(retryTimer){clearTimeout(retryTimer);retryTimer=null;}
          cleanupActive();
          try{memberUnsub?.();}catch(_){}
          memberUnsub=null;
        });
      }
    }catch(error){
      console.warn("[MILITOPO runner dashboard] watchers",error);
    }
  }

  async function connectLive(event,{autoOpen=false}={}){
    const eventId=String(event?.eventId||"").trim();
    if(!eventId||!state.auth?.uid) return;
    if(state.connectingEventId===eventId && state.connectPromise) return state.connectPromise;
    const token=++state.connectToken;
    state.connectingEventId=eventId;
    setStatus(`Conectando con ${event.eventName}…`);
    state.connectPromise=(async()=>{
      try{
        const svc=await services(), api=svc.databaseApi;
        if(!api) throw new Error("Realtime Database no está preparado en esta versión.");
        const activeRef=api.ref(`v2/live/${event.ownerUid}/${event.eventId}/activeRun`);
        const activeSnap=await api.get(activeRef); const active=activeSnap.exists()?(activeSnap.val()||{}):{};
        if(!active.runId||String(active.status)!=="active") throw new Error("La carrera todavía no está en directo.");
        const joined=await svc.callable("runnerJoinLive",{eventId:event.eventId,clientVersion:VERSION});
        if(token!==state.connectToken) return;
        const nextRunId=String(joined?.data?.runId||active.runId||"");
        if(!nextRunId) throw new Error("No se pudo resolver la sesión Live V2.");

        // Solo sustituimos la conexión anterior cuando la nueva ya está validada.
        cleanupLive();
        state.active=event;
        state.runId=nextRunId;
        state.participantStatus=String(joined?.data?.status||event.participantLiveStatus||"ready").toLowerCase();
        event.liveRunId=nextRunId;
        event.liveStartedAt=Number(active.startedAt||event.liveStartedAt||0);
        event.participantLiveStatus=state.participantStatus;

        const pRef=api.ref(`v2/live/${event.ownerUid}/${event.eventId}/runs/${state.runId}/participants/${state.auth.uid}`);
        await api.update(pRef,{online:true,lastSeen:api.serverTimestamp(),updatedAt:api.serverTimestamp()});
        try{await api.onDisconnect(pRef).update({online:false,lastSeen:api.serverTimestamp(),updatedAt:api.serverTimestamp()});}catch(_){}
        state.heartbeat=setInterval(()=>api.update(pRef,{online:true,lastSeen:api.serverTimestamp(),updatedAt:api.serverTimestamp()}).catch(()=>{}),20000);
        state.unsubParticipant=api.onValue(pRef,snap=>{
          const row=snap.val()||{};
          state.participantStatus=String(row.status||"ready").toLowerCase();
          event.participantLiveStatus=state.participantStatus;
          const label=state.participantStatus==="ready"?"PREPARADO":state.participantStatus==="racing"?"EN CARRERA":state.participantStatus==="finished"?"FINALIZADO":statusES(state.participantStatus);
          setStatus(`✅ Conectado a Live V2 · ${event.eventName} · ${label}`,"ok");
          renderEvents();
          if(state.participantStatus==="finished") scheduleLiveSelection(80);
        });
        state.unsubRun=api.onValue(activeRef,snap=>{
          const row=snap.val()||{};
          if(String(row.status||"")==="finished"){
            setStatus("🏁 La sesión Live V2 ha finalizado.","ok");
            cleanupLive();
            renderEvents();
            scheduleLiveSelection(80);
          }
        });
        renderEvents();
      }catch(error){
        if(token!==state.connectToken) return;
        console.error("[MILITOPO runner dashboard live]",error);
        const target=state.events.find(row=>row.eventId===eventId);
        if(target) target.liveConnectError=String(error?.message||error);
        renderEvents();
        setStatus(`⚠️ ${String(error?.message||error)}`,"err");
      }finally{
        if(token===state.connectToken){
          state.connectingEventId="";
          state.connectPromise=null;
        }
      }
    })();
    return state.connectPromise;
  }
  function historyStatusES(status){
    return ({finished:"FINALIZADO",incomplete:"INCOMPLETO",not_started:"NO SALIÓ"})[String(status||"").toLowerCase()] || "NO SALIÓ";
  }
  function fmtHistoryDate(ms){
    const value=Number(ms||0); if(!value)return "—";
    try{return new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(value));}catch(_){return new Date(value).toLocaleString();}
  }
  function fmtDuration(ms){
    const value=Number(ms); if(!Number.isFinite(value)||value<0)return "—";
    const total=Math.floor(value/1000),h=Math.floor(total/3600),m=Math.floor((total%3600)/60),sec=total%60;
    return h>0?`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`:`${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  }
  function fmtDistance(meters){
    const value=Math.max(0,Number(meters||0));
    return value>=1000?`${(value/1000).toFixed(value>=10000?1:2)} km`:`${Math.round(value)} m`;
  }
  function fmtReducedDistance(km){
    const value=Number(km);return Number.isFinite(value)&&value>=0?`${value.toFixed(2)} km`:"—";
  }
  function setHistoryStatus(message,type=""){
    const node=el("m2rdHistoryStatus");node.textContent=message;node.className=`m2rd-status${type?` ${type}`:""}`;
  }
  function fmtClock(ms){
    const value=Number(ms||0); if(!value)return "—";
    try{return new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date(value));}catch(_){return new Date(value).toLocaleString();}
  }
  function fmtPace(value){
    const min=Number(value); if(!Number.isFinite(min)||min<=0)return "—";
    const whole=Math.floor(min),sec=Math.round((min-whole)*60);
    return `${whole}:${String(sec===60?0:sec).padStart(2,"0")} min/km`;
  }
  function fmtSpeed(value){const n=Number(value);return Number.isFinite(n)&&n>0?`${n.toFixed(2)} km/h`:"—";}
  function fmtAccuracy(value){const n=Number(value);return Number.isFinite(n)&&n>0?`${n.toFixed(1)} m`:"—";}
  function metricCell(label,value){return `<div class="m2rd-detail-stat"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;}
  function cleanupHistoryRacePlanUrl(){
    if(!state.detailRacePlanOwnedUrl)return;
    try{URL.revokeObjectURL(state.detailRacePlanOwnedUrl);}catch(_){}
    state.detailRacePlanOwnedUrl="";
  }
  function closeHistoryDetail(){
    stopHistoryPlayback(false);
    const panel=el("m2rdHistoryDetail"); if(panel)panel.hidden=true;
    state.detailEventId="";state.detailError="";state.detailLoading=false;
  }
  function historyMapantLayer(L){
    return L.tileLayer.wms("https://raster.trailmap.fi/mapproxy/service",{layers:"spain_mapant",styles:"",format:"image/png",transparent:false,version:"1.1.1",attribution:"© MapAnt / Trailmap",maxZoom:22,tileSize:256,crossOrigin:true,keepBuffer:4});
  }
  function ensureHistoryDetailMap(){
    const L=globalThis.L,node=el("m2rdDetailMap"); if(!L||!node)return null;
    if(state.detailMap){setTimeout(()=>state.detailMap?.invalidateSize?.(),80);return state.detailMap;}
    state.detailMap=L.map(node,{zoomControl:true,preferCanvas:true,maxZoom:22,zoomSnap:.25,zoomDelta:.5}).setView([40.2,-3.7],5);
    state.detailBaseLayers={
      mapant:historyMapantLayer(L),
      ign:L.tileLayer("https://www.ign.es/wmts/mapa-raster?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=MTN&STYLE=default&TILEMATRIXSET=GoogleMapsCompatible&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",{attribution:"© Instituto Geográfico Nacional",maxNativeZoom:18,maxZoom:22,keepBuffer:5}),
      aerial:L.tileLayer("https://www.ign.es/wmts/pnoa-ma?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=OI.OrthoimageCoverage&STYLE=default&TILEMATRIXSET=GoogleMapsCompatible&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",{attribution:"© PNOA · IGN",maxNativeZoom:19,maxZoom:22,keepBuffer:6,crossOrigin:true})
    };
    state.detailBaseKey="mapant";state.detailBaseLayer=state.detailBaseLayers.mapant.addTo(state.detailMap);
    state.detailTrackLayer=L.layerGroup().addTo(state.detailMap);state.detailCheckpointLayer=L.layerGroup().addTo(state.detailMap);state.detailPlaybackLayer=L.layerGroup().addTo(state.detailMap);
    renderHistoryDetailLayerState();
    return state.detailMap;
  }
  function removeHistoryBaseLayer(){
    const map=state.detailMap;if(!map)return;
    if(state.detailBaseLayer&&map.hasLayer(state.detailBaseLayer))map.removeLayer(state.detailBaseLayer);
    if(state.detailRacePlanLayer&&map.hasLayer(state.detailRacePlanLayer))map.removeLayer(state.detailRacePlanLayer);
    state.detailBaseLayer=null;state.detailRacePlanLayer=null;
  }
  function bringHistoryOverlayLayersToFront(){
    const map=state.detailMap;if(!map)return;
    [state.detailTrackLayer,state.detailCheckpointLayer,state.detailPlaybackLayer].forEach(group=>{
      if(!group)return;
      try{if(map.hasLayer(group))map.removeLayer(group);group.addTo(map);}catch(_){}
    });
  }
  async function loadHistoryRacePlanDescriptor(){
    const api=globalThis.MILITOPO_RACE_PLAN_HISTORY;
    if(!api?.getForEvent)throw new Error("El lector de planos de carrera todavía no está disponible.");
    const raw=await api.getForEvent({eventId:state.detailEventId});
    if(!raw||!Array.isArray(raw.bounds)||raw.bounds.length!==2)throw new Error("No hay un plano de carrera disponible.");
    cleanupHistoryRacePlanUrl();
    let url=String(raw.url||"");
    if(!url&&raw.blob){url=URL.createObjectURL(raw.blob);state.detailRacePlanOwnedUrl=url;}
    if(!url)throw new Error("No se pudo preparar la imagen del plano de carrera.");
    state.detailRacePlanDescriptor={...raw,url,bounds:raw.bounds.map(pair=>pair.map(Number))};
    return state.detailRacePlanDescriptor;
  }
  function renderHistoryDetailLayerState(){
    const panel=el("m2rdHistoryDetail");if(!panel)return;
    panel.querySelectorAll("[data-detail-layer]").forEach(btn=>{
      const key=String(btn.dataset.detailLayer||"");
      btn.classList.toggle("active",key===state.detailBaseKey);
      btn.classList.toggle("loading",key==="custom"&&state.detailRacePlanLoading);
      btn.disabled=key==="custom"&&state.detailRacePlanLoading;
    });
    const status=el("m2rdDetailLayerStatus");if(!status)return;
    status.className=`m2rd-detail-layerstatus${state.detailRacePlanError?" err":""}`;
    if(state.detailRacePlanError)status.textContent=`PLANO CARRERA: ${state.detailRacePlanError}`;
    else if(state.detailRacePlanLoading)status.textContent="PLANO CARRERA: preparando cartografía georreferenciada…";
    else if(state.detailBaseKey==="custom"){
      const d=state.detailRacePlanDescriptor||{};
      status.textContent=`Fondo: PLANO CARRERA · ${d.name||"plano propio"}${d.fallback?" · prueba integrada":""}`;
    }else status.textContent=`Fondo: ${{mapant:"MAPANT",ign:"IGN",aerial:"AÉREO"}[state.detailBaseKey]||"MAPANT"}`;
  }
  async function switchHistoryDetailLayer(key){
    const map=ensureHistoryDetailMap(),L=globalThis.L;if(!map||!L)return false;
    const wanted=["mapant","ign","aerial","custom"].includes(String(key))?String(key):"mapant";
    if(wanted===state.detailBaseKey&&(wanted!=="custom"||state.detailRacePlanLayer))return true;
    const previous=state.detailBaseKey;
    state.detailRacePlanError="";
    if(wanted==="custom"){
      state.detailRacePlanLoading=true;renderHistoryDetailLayerState();
      try{
        const descriptor=await loadHistoryRacePlanDescriptor();
        removeHistoryBaseLayer();
        state.detailRacePlanLayer=L.imageOverlay(descriptor.url,descriptor.bounds,{opacity:1,interactive:false,pane:"tilePane"}).addTo(map);
        state.detailBaseKey="custom";
        bringHistoryOverlayLayersToFront();
        renderHistoryDetailLayerState();
        return true;
      }catch(error){
        state.detailRacePlanError=String(error?.message||"No se pudo cargar el plano de carrera.");
        state.detailBaseKey=previous;
        renderHistoryDetailLayerState();
        return false;
      }finally{
        state.detailRacePlanLoading=false;renderHistoryDetailLayerState();
      }
    }
    const next=state.detailBaseLayers[wanted];if(!next)return false;
    removeHistoryBaseLayer();state.detailBaseLayer=next.addTo(map);state.detailBaseKey=wanted;
    bringHistoryOverlayLayersToFront();renderHistoryDetailLayerState();return true;
  }
  function validHistoryCoord(lat,lng){return Number.isFinite(Number(lat))&&Number.isFinite(Number(lng))&&Number(lat)>=-90&&Number(lat)<=90&&Number(lng)>=-180&&Number(lng)<=180;}
  function fitHistoryDetailMap(){
    const map=state.detailMap,L=globalThis.L,detail=state.historyDetail;if(!map||!L||!detail)return;
    const coords=[];(detail.track||[]).forEach(p=>{if(validHistoryCoord(p.lat,p.lng))coords.push([Number(p.lat),Number(p.lng)]);});
    (detail.checkpoints||[]).forEach(p=>{if(validHistoryCoord(p.lat,p.lon))coords.push([Number(p.lat),Number(p.lon)]);});
    if(coords.length===1)map.setView(coords[0],16);else if(coords.length>1)map.fitBounds(L.latLngBounds(coords),{padding:[24,24],maxZoom:17});
  }
  function historyCheckpointKey(cp){
    const type=String(cp?.type||"").toUpperCase();
    if(type==="SALIDA")return "START";
    if(type==="LLEGADA")return "FINISH";
    return String(cp?.checkpointId||cp?.id||"").trim().toUpperCase();
  }
  function historyPassState(checkpointId){
    const key=String(checkpointId||"").trim().toUpperCase();
    const row=(state.detailPlaybackControlRows||[]).find(item=>String(item?.checkpointId||"").trim().toUpperCase()===key);
    if(!row)return "pending";
    const source=String(row.source||"").toLowerCase(),value=String(row.state||"").toLowerCase();
    if(row.discarded||source==="discard"||value==="discarded")return "discarded";
    if(row.detected||value==="validated"||["gps","qr","gps_track_recovery"].includes(source))return "validated";
    return "pending";
  }
  function historyCheckpointIcon(cp){
    const L=globalThis.L,type=String(cp?.type||"BALIZA").toUpperCase(),key=historyCheckpointKey(cp);
    const isControl=type!=="SALIDA"&&type!=="LLEGADA";
    const status=isControl?historyPassState(key):"";
    const rawLabel=type==="SALIDA"?"S":type==="LLEGADA"?"L":String(cp?.checkpointId||cp?.id||"B").trim().toUpperCase();
    const label=rawLabel.length>4?rawLabel.slice(-4):rawLabel;
    let svg="";
    if(type==="SALIDA"){
      svg=`<svg viewBox="0 0 36 36" aria-hidden="true"><path class="marker-shape" d="M18 3.5 33 31H3Z"/><text x="18" y="25" text-anchor="middle" font-size="12" fill="#fff">${esc(label)}</text></svg>`;
    }else if(type==="LLEGADA"){
      svg=`<svg viewBox="0 0 36 36" aria-hidden="true"><circle class="marker-outer" cx="18" cy="18" r="15"/><circle class="marker-inner" cx="18" cy="18" r="9.5"/><text x="18" y="22" text-anchor="middle" font-size="11" fill="#fff">${esc(label)}</text></svg>`;
    }else{
      const font=label.length>=4?8.5:10;
      svg=`<svg viewBox="0 0 36 36" aria-hidden="true"><circle class="marker-ring" cx="18" cy="18" r="14.5"/><circle class="marker-core" cx="18" cy="18" r="2.6"/><text x="18" y="11" text-anchor="middle" font-size="${font}" fill="#fff">${esc(label)}</text></svg><span class="marker-state-dot" aria-hidden="true"></span>`;
    }
    const kind=type==="SALIDA"?"start":type==="LLEGADA"?"finish":"control";
    return L.divIcon({className:"",html:`<div class="m2rd-map-marker ${kind}${status?` ${status}`:""}" data-checkpoint="${esc(key)}">${svg}</div>`,iconSize:[36,36],iconAnchor:[18,18],popupAnchor:[0,-18]});
  }
  function renderHistoryDetailMap(){
    const map=ensureHistoryDetailMap(),L=globalThis.L,detail=state.historyDetail;if(!map||!L||!detail)return;
    state.detailTrackLayer?.clearLayers();state.detailCheckpointLayer?.clearLayers();state.detailCheckpointMarkers.clear();
    const track=(detail.track||[]).filter(p=>validHistoryCoord(p.lat,p.lng)).map(p=>[Number(p.lat),Number(p.lng)]);
    if(track.length>1)L.polyline(track,{weight:4,opacity:.76,lineCap:"round",lineJoin:"round"}).addTo(state.detailTrackLayer);
    else if(track.length===1)L.circleMarker(track[0],{radius:6,weight:2,fillOpacity:.9}).addTo(state.detailTrackLayer);
    (detail.checkpoints||[]).forEach(cp=>{
      if(!validHistoryCoord(cp.lat,cp.lon))return;
      const type=String(cp.type||"BALIZA").toUpperCase(),key=historyCheckpointKey(cp);
      const marker=L.marker([Number(cp.lat),Number(cp.lon)],{icon:historyCheckpointIcon(cp),keyboard:false,zIndexOffset:type==="BALIZA"?800:900});
      const officialState=(type!=="SALIDA"&&type!=="LLEGADA")?historyPassState(key):"";
      const stateLabel=officialState==="validated"?"VALIDADA":officialState==="discarded"?"DESCARTADA · +15:00":officialState==="pending"?"PENDIENTE AL FINALIZAR · +15:00":"";
      marker.bindPopup(`<strong>${esc(type==="SALIDA"?"SALIDA":type==="LLEGADA"?"LLEGADA":cp.checkpointId||"BALIZA")}</strong>${stateLabel?`<br>${esc(stateLabel)}`:""}${cp.description?`<br>${esc(cp.description)}`:""}`);
      marker.addTo(state.detailCheckpointLayer);
      state.detailCheckpointMarkers.set(key,{marker,cp:{...cp},type});
    });
    bringHistoryOverlayLayersToFront();
    setTimeout(()=>{map.invalidateSize();fitHistoryDetailMap();applyHistoryPlaybackObjective(playbackObjectiveAt(state.detailPlaybackCurrentMs),null);},100);
  }
  function clearHistoryPlaybackLayer(){
    try{state.detailPlaybackLayer?.clearLayers?.();}catch(_){}
    state.detailPlaybackMarker=null;state.detailPlaybackTrail=null;state.detailPlaybackTargetLine=null;state.detailPlaybackObjectiveKey="";
    for(const entry of state.detailCheckpointMarkers.values()){
      const node=entry?.marker?.getElement?.()?.querySelector?.(".m2rd-map-marker");
      node?.classList?.remove("is-objective");
    }
  }
  function playbackObjectiveAt(ms){
    const rows=Array.isArray(state.detailPlaybackControlRows)?state.detailPlaybackControlRows:[];
    const start=Math.max(0,Number(state.detailPlaybackStartMs||0)),target=Math.max(0,Number(ms)||0);
    for(const row of rows){
      const key=String(row?.checkpointId||"").trim().toUpperCase();if(!key)continue;
      const passedAt=Math.max(0,Number(row?.passedAtMs||0));
      if(!passedAt||!start||Math.max(0,passedAt-start)>target)return {key,label:key,kind:"control",row};
    }
    return {key:"FINISH",label:"LLEGADA",kind:"finish",row:null};
  }
  function applyHistoryPlaybackObjective(objective,pos){
    const key=String(objective?.key||"").toUpperCase();
    state.detailPlaybackObjectiveKey=key;
    for(const [markerKey,entry] of state.detailCheckpointMarkers.entries()){
      const node=entry?.marker?.getElement?.()?.querySelector?.(".m2rd-map-marker");
      node?.classList?.toggle("is-objective",markerKey===key);
    }
    const title=el("m2rdPlaybackObjective"),meta=el("m2rdPlaybackObjectiveMeta");
    if(title)title.textContent=objective?.label||"—";
    if(meta){
      const atEnd=state.detailPlaybackDurationMs>0&&state.detailPlaybackCurrentMs>=state.detailPlaybackDurationMs;
      meta.textContent=!objective?"Sin objetivo reconstruible":atEnd?(objective.kind==="control"?`${objective.label} quedó PENDIENTE al finalizar`:"LLEGADA · fin de la reproducción"):objective.kind==="finish"?"Últimas balizas resueltas · objetivo: LLEGADA":"Buscando esta baliza en el instante seleccionado";
    }
    const targetEntry=state.detailCheckpointMarkers.get(key),L=globalThis.L,layer=state.detailPlaybackLayer;
    if(pos&&targetEntry&&L&&layer&&validHistoryCoord(targetEntry.cp?.lat,targetEntry.cp?.lon)){
      const latlngs=[[Number(pos.lat),Number(pos.lng)],[Number(targetEntry.cp.lat),Number(targetEntry.cp.lon)]];
      if(!state.detailPlaybackTargetLine)state.detailPlaybackTargetLine=L.polyline(latlngs,{color:"#f0c16a",weight:2,opacity:.86,dashArray:"7 8",lineCap:"round",interactive:false}).addTo(layer);
      else state.detailPlaybackTargetLine.setLatLngs(latlngs);
    }else if(state.detailPlaybackTargetLine){
      state.detailPlaybackTargetLine.setLatLngs([]);
    }
  }
  function updateHistoryPlaybackUi(){
    const ready=state.detailPlaybackPoints.length>0&&state.detailPlaybackDurationMs>0;
    const toggle=el("m2rdPlaybackToggle"),reset=el("m2rdPlaybackReset"),slider=el("m2rdPlaybackSlider"),clock=el("m2rdPlaybackClock"),speed=el("m2rdPlaybackSpeed");
    if(toggle){toggle.disabled=!ready;toggle.textContent=state.detailPlaybackPlaying?"⏸ PAUSAR":"▶ REPRODUCIR";toggle.classList.toggle("primary",ready);}
    if(reset)reset.disabled=!ready;
    if(slider){slider.disabled=!ready;slider.value=ready?String(Math.round((state.detailPlaybackCurrentMs/state.detailPlaybackDurationMs)*1000)):"0";}
    if(clock)clock.textContent=ready?`${fmtDuration(state.detailPlaybackCurrentMs)} / ${fmtDuration(state.detailPlaybackDurationMs)}`:"SIN TRACK REPRODUCIBLE";
    if(speed){speed.disabled=!ready;speed.value=String(state.detailPlaybackSpeed);}
  }
  function stopHistoryPlayback(update=true){
    state.detailPlaybackPlaying=false;state.detailPlaybackLastFrame=0;
    if(state.detailPlaybackRaf){try{cancelAnimationFrame(state.detailPlaybackRaf);}catch(_){}state.detailPlaybackRaf=0;}
    if(update)updateHistoryPlaybackUi();
  }
  function historyPlaybackBearing(a,b){
    if(!a||!b)return 0;
    const rad=value=>Number(value)*Math.PI/180,deg=value=>value*180/Math.PI;
    const lat1=rad(a.lat),lat2=rad(b.lat),dLon=rad(Number(b.lng)-Number(a.lng));
    const y=Math.sin(dLon)*Math.cos(lat2);
    const x=Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);
    const out=(deg(Math.atan2(y,x))+360)%360;
    return Number.isFinite(out)?out:0;
  }
  function stableHistoryPlaybackBearing(points,index){
    if(!Array.isArray(points)||points.length<2)return 0;
    let a=Math.max(0,Math.min(points.length-1,Number(index)||0)),b=Math.min(points.length-1,a+1);
    const distance=(p,q)=>{const dy=(Number(q.lat)-Number(p.lat))*111320,dx=(Number(q.lng)-Number(p.lng))*111320*Math.cos(Number(p.lat)*Math.PI/180);return Math.hypot(dx,dy);};
    while(a>0&&distance(points[a],points[b])<3)a--;
    while(b<points.length-1&&distance(points[a],points[b])<7)b++;
    if(a===b){a=Math.max(0,a-1);b=Math.min(points.length-1,b+1);}
    return historyPlaybackBearing(points[a],points[b]);
  }
  function playbackPointAt(ms){
    const points=state.detailPlaybackPoints;if(!points.length)return null;
    const target=Math.max(0,Math.min(state.detailPlaybackDurationMs,Number(ms)||0));
    if(target<=points[0].playMs)return {...points[0],index:0,bearing:stableHistoryPlaybackBearing(points,0)};
    const last=points.length-1;if(target>=points[last].playMs)return {...points[last],index:last,bearing:stableHistoryPlaybackBearing(points,Math.max(0,last-1))};
    let lo=0,hi=last;
    while(lo+1<hi){const mid=(lo+hi)>>1;if(points[mid].playMs<=target)lo=mid;else hi=mid;}
    const a=points[lo],b=points[hi],span=Math.max(1,b.playMs-a.playMs),t=Math.max(0,Math.min(1,(target-a.playMs)/span));
    return {lat:a.lat+(b.lat-a.lat)*t,lng:a.lng+(b.lng-a.lng)*t,playMs:target,index:lo,bearing:stableHistoryPlaybackBearing(points,lo)};
  }
  function drawHistoryPlaybackFrame(){
    const map=state.detailMap,L=globalThis.L,layer=state.detailPlaybackLayer;if(!map||!L||!layer){updateHistoryPlaybackUi();return;}
    if(!state.detailPlaybackPoints.length||state.detailPlaybackDurationMs<=0){clearHistoryPlaybackLayer();updateHistoryPlaybackUi();return;}
    const pos=playbackPointAt(state.detailPlaybackCurrentMs);if(!pos)return;
    if(!state.detailPlaybackMarker){
      const icon=L.divIcon({className:"",html:'<div class="m2rd-playback-marker"><svg viewBox="0 0 36 36" aria-hidden="true"><path class="nav-shadow" d="M18 2.5 31 30.5 18 25.5 5 30.5Z" transform="translate(1 1.5)"/><path class="nav-body" d="M18 2.5 31 30.5 18 25.5 5 30.5Z"/><path class="nav-core" d="M18 9.5 23.6 23.5 18 21.4 12.4 23.5Z"/></svg></div>',iconSize:[38,38],iconAnchor:[19,19]});
      state.detailPlaybackMarker=L.marker([pos.lat,pos.lng],{icon,keyboard:false,zIndexOffset:1800}).addTo(layer);
    }else state.detailPlaybackMarker.setLatLng([pos.lat,pos.lng]);
    const nav=state.detailPlaybackMarker?.getElement?.()?.querySelector?.('.m2rd-playback-marker');
    if(nav)nav.style.setProperty('--m2rd-heading',`${Number(pos.bearing||0).toFixed(1)}deg`);
    const trail=state.detailPlaybackPoints.slice(0,pos.index+1).map(point=>[point.lat,point.lng]);trail.push([pos.lat,pos.lng]);
    if(!state.detailPlaybackTrail)state.detailPlaybackTrail=L.polyline(trail,{color:"#f0c16a",weight:6,opacity:.95,lineCap:"round",lineJoin:"round"}).addTo(layer);else state.detailPlaybackTrail.setLatLngs(trail);
    applyHistoryPlaybackObjective(playbackObjectiveAt(state.detailPlaybackCurrentMs),pos);
    bringHistoryOverlayLayersToFront();updateHistoryPlaybackUi();
  }
  function prepareHistoryPlayback(){
    stopHistoryPlayback(false);clearHistoryPlaybackLayer();
    const detail=state.historyDetail||{},result=detail.result||{};
    const raw=(Array.isArray(detail.track)?detail.track:[]).filter(point=>validHistoryCoord(point.lat,point.lng)&&Number.isFinite(Number(point.at))).map(point=>({lat:Number(point.lat),lng:Number(point.lng),at:Number(point.at)})).sort((a,b)=>a.at-b.at);
    if(!raw.length){state.detailPlaybackPoints=[];state.detailPlaybackDurationMs=0;state.detailPlaybackCurrentMs=0;state.detailPlaybackStartMs=0;applyHistoryPlaybackObjective(null,null);updateHistoryPlaybackUi();return;}
    const start=Math.max(0,Number(result.startedAtMs||0))||raw[0].at;
    const finish=Math.max(0,Number(result.finishedAtMs||0))||raw[raw.length-1].at;
    state.detailPlaybackStartMs=start;
    state.detailPlaybackPoints=raw.map(point=>({...point,playMs:Math.max(0,point.at-start)}));
    const lastPlay=state.detailPlaybackPoints[state.detailPlaybackPoints.length-1]?.playMs||0;
    state.detailPlaybackDurationMs=Math.max(0,finish-start,lastPlay);
    state.detailPlaybackCurrentMs=0;state.detailPlaybackSpeed=[1,2,4,10].includes(Number(state.detailPlaybackSpeed))?Number(state.detailPlaybackSpeed):1;
    drawHistoryPlaybackFrame();
  }
  function historyPlaybackLoop(now){
    if(!state.detailPlaybackPlaying)return;
    if(!state.detailPlaybackLastFrame)state.detailPlaybackLastFrame=now;
    const delta=Math.min(400,Math.max(0,now-state.detailPlaybackLastFrame));state.detailPlaybackLastFrame=now;
    state.detailPlaybackCurrentMs=Math.min(state.detailPlaybackDurationMs,state.detailPlaybackCurrentMs+delta*state.detailPlaybackSpeed);
    drawHistoryPlaybackFrame();
    if(state.detailPlaybackCurrentMs>=state.detailPlaybackDurationMs){stopHistoryPlayback(true);return;}
    state.detailPlaybackRaf=requestAnimationFrame(historyPlaybackLoop);
  }
  function toggleHistoryPlayback(){
    if(!state.detailPlaybackPoints.length||state.detailPlaybackDurationMs<=0)return;
    if(state.detailPlaybackPlaying){stopHistoryPlayback(true);return;}
    if(state.detailPlaybackCurrentMs>=state.detailPlaybackDurationMs)state.detailPlaybackCurrentMs=0;
    state.detailPlaybackPlaying=true;state.detailPlaybackLastFrame=0;updateHistoryPlaybackUi();state.detailPlaybackRaf=requestAnimationFrame(historyPlaybackLoop);
  }
  function resetHistoryPlayback(keepPaused=true){
    stopHistoryPlayback(false);state.detailPlaybackCurrentMs=0;drawHistoryPlaybackFrame();
    if(!keepPaused){state.detailPlaybackPlaying=true;state.detailPlaybackRaf=requestAnimationFrame(historyPlaybackLoop);}
  }
  function seekHistoryPlayback(scale){
    if(!state.detailPlaybackDurationMs)return;
    const ratio=Math.max(0,Math.min(1000,Number(scale)||0))/1000;state.detailPlaybackCurrentMs=state.detailPlaybackDurationMs*ratio;state.detailPlaybackLastFrame=0;drawHistoryPlaybackFrame();
  }
  function fmtClassGap(value){const ms=Number(value);if(!Number.isFinite(ms)||ms<0)return "—";if(ms===0)return "LÍDER";return `+${fmtDuration(ms)}`;}
  function classificationRunnerName(row){const d=String(row?.displayName||"").trim(),u=String(row?.username||"").replace(/^@/,"").trim();return d&&u?`${d} (@${u})`:d||u&&`@${u}`||String(row?.participantId||"Corredor");}
  function renderRunnerClassification(){
    const status=el("m2rdClassificationStatus"),summary=el("m2rdClassificationSummary"),body=el("m2rdClassificationBody"),note=el("m2rdClassificationNote");if(!status||!summary||!body||!note)return;
    el("m2rdClassGeneralBtn")?.classList.toggle("active",state.classificationView==="general");el("m2rdClassRouteBtn")?.classList.toggle("active",state.classificationView==="route");
    if(state.classificationLoading){status.textContent="Calculando clasificación…";status.className="m2rd-status";body.innerHTML='<tr><td colspan="7">Calculando…</td></tr>';return;}
    if(state.classificationError){status.textContent=`⚠️ ${state.classificationError}`;status.className="m2rd-status err";summary.innerHTML="";body.innerHTML='<tr><td colspan="7">No se pudo cargar.</td></tr>';note.textContent="";return;}
    const data=state.classificationDetail,my=data?.my||null;if(!data||!my){status.textContent="Clasificación no disponible para esta participación.";status.className="m2rd-status";summary.innerHTML="";body.innerHTML='<tr><td colspan="7">Sin clasificación.</td></tr>';note.textContent="";return;}
    status.textContent=data.event?.provisional?"⚠️ Clasificación provisional: el evento sigue EN DIRECTO.":"✅ Clasificación persistente del evento.";status.className=`m2rd-status ${data.event?.provisional?"":"ok"}`;
    summary.innerHTML=[metricCell("PUESTO GENERAL",my.generalRank?`${my.generalRank} / ${my.generalRankedCount??my.generalCount??"—"}`:"—"),metricCell(`PUESTO ${my.routeId||"RECORRIDO"}`,my.routeRank?`${my.routeRank} / ${my.routeRankedCount??my.routeCount??"—"}`:"—"),metricCell("DIF. LÍDER GENERAL",fmtClassGap(my.generalGapMs)),metricCell("DIF. LÍDER RECORRIDO",fmtClassGap(my.routeGapMs))].join("");
    const routeId=String(my.routeId||"");const rows=state.classificationView==="route"?(data.byRoute?.[routeId]||[]):(data.general||[]);el("m2rdClassRouteBtn").textContent=routeId?`${routeId} · MI RECORRIDO`:"MI RECORRIDO";
    body.innerHTML=rows.length?rows.map(row=>`<tr class="${row.runnerUid===state.auth?.uid?"m2rd-class-me":""}"><td class="m2rd-class-rank">${row.rank??"—"}</td><td><strong>${esc(classificationRunnerName(row))}</strong></td><td>${esc(row.participantId||"—")}</td><td>${esc(row.routeId||"—")}</td><td>${row.routeDistanceKm==null?"—":`${esc(Number(row.routeDistanceKm).toFixed(2))} km`}</td><td><strong>${esc(fmtDuration(row.officialDurationMs??row.durationMs))}</strong></td><td>${esc(fmtClassGap(row.gapToLeaderMs))}</td></tr>`).join(""):'<tr><td colspan="7">Sin participantes.</td></tr>';
    note.textContent=state.classificationView==="general"?"GENERAL asigna puesto a todo corredor que tomó la salida: FINALIZADOS primero e INCOMPLETOS después. Dentro de cada estado se ordena por TIEMPO OFICIAL. NO SALIÓ queda sin puesto.":`Clasificación del ${routeId||"mismo recorrido"}: FINALIZADOS primero e INCOMPLETOS después, ordenados por TIEMPO OFICIAL. NO SALIÓ queda sin puesto.`;
  }

  function renderHistoryDetail(){
    const detail=state.historyDetail,panel=el("m2rdHistoryDetail"),status=el("m2rdDetailStatus");if(!panel)return;renderRunnerClassification();
    if(state.detailLoading){status.textContent="Cargando resultado, track y balizas desde Firestore…";status.className="m2rd-status";return;}
    if(state.detailError){status.textContent=`⚠️ ${state.detailError}`;status.className="m2rd-status err";return;}
    if(!detail){status.textContent="No hay detalle cargado.";status.className="m2rd-status";return;}
    const event=detail.event||{},result=detail.result||{},gps=result.gpsAccuracy||{},meta=detail.trackMeta||{};
    el("m2rdDetailTitle").textContent=event.eventName||"Carrera";
    el("m2rdDetailSubtitle").textContent=`${historyStatusES(result.status)} · ${event.eventId||""}`;
    status.textContent="✅ Resultado histórico cargado desde Firestore.";status.className="m2rd-status ok";
    el("m2rdDetailMetrics").innerHTML=[
      metricCell("ESTADO",historyStatusES(result.status)),metricCell("SALIDA",fmtClock(result.startedAtMs)),metricCell("LLEGADA",fmtClock(result.finishedAtMs)),metricCell("TIEMPO OFICIAL",fmtDuration(result.officialDurationMs??result.durationMs)),
      metricCell("TIEMPO REAL",fmtDuration(result.durationMs)),metricCell("PENALIZACIÓN",result.penaltyMs?`+${fmtDuration(result.penaltyMs)}`:"+00:00"),metricCell("PENDIENTES",String(Math.max(0,Number(result.pendingControlCount||0)))),metricCell("DESCARTADAS",String(Math.max(0,Number(result.discardedControlCount||0)))),
      metricCell("RECORRIDO",result.courseId||"—"),metricCell("DISTANCIA REDUCIDA",fmtReducedDistance(result.reducedDistanceKm)),metricCell("DISTANCIA TRACK",fmtDistance(result.trackDistanceM)),metricCell("DESNIVEL +",Number.isFinite(Number(result.coursePositiveM))?`${Math.round(Number(result.coursePositiveM))} m`:"—"),
      metricCell("DIFICULTAD",result.courseDifficulty||"—"),metricCell("RITMO MEDIO",fmtPace(result.paceMinKm)),metricCell("VELOCIDAD MEDIA",fmtSpeed(result.avgSpeedKmh)),metricCell("PUNTOS GPS",`${Number(result.trackPointCount||0)} pts`),
      metricCell("PRECISIÓN MEDIA",fmtAccuracy(gps.averageM)),metricCell("MEJOR GPS",fmtAccuracy(gps.bestM)),metricCell("PEOR GPS",fmtAccuracy(gps.worstM)),metricCell("RUN ID",result.runId||"—")
    ].join("");
    const rawPassRows=Array.isArray(detail.controlPasses)?detail.controlPasses:[];
    const selectedCourse=(Array.isArray(detail.courses)?detail.courses:[]).find(course=>String(course.courseId||"")===String(result.courseId||""))||null;
    const expectedIds=(Array.isArray(selectedCourse?.points)?selectedCourse.points:[]).map(value=>String(value||"").trim().toUpperCase()).filter(id=>id&&!['START','SALIDA','S','FINISH','LLEGADA','META','L'].includes(id));
    const storedByOrder=new Map(rawPassRows.map(row=>[Number(row?.order||0),row]));
    const discardedById=new Map((Array.isArray(result.discardedControls)?result.discardedControls:[]).map(row=>[String(row?.checkpointId||"").trim().toUpperCase(),row]));
    const passRows=expectedIds.length?expectedIds.map((checkpointId,index)=>{
      const order=index+1,stored=storedByOrder.get(order)||rawPassRows.find(row=>String(row?.checkpointId||"").trim().toUpperCase()===checkpointId)||null,discarded=discardedById.get(checkpointId)||null;
      if(stored)return {...stored,order,checkpointId,discarded:Boolean(stored.discarded||String(stored.source||"").toLowerCase()==="discard"||String(stored.state||"").toLowerCase()==="discarded"||discarded),pending:Boolean(stored.pending||String(stored.state||"").toLowerCase()==="pending")};
      if(discarded)return {order,checkpointId,detected:false,discarded:true,pending:false,state:"discarded",source:"discard",passedAtMs:discarded.discardedAtMs||null,elapsedMs:null,splitMs:null,penaltyMs:Number(discarded.penaltyMs||900000)};
      return {order,checkpointId,detected:false,discarded:false,pending:true,state:"pending",source:"pending",passedAtMs:null,elapsedMs:null,splitMs:null,penaltyMs:result.status==="not_started"?0:900000};
    }):rawPassRows;
    state.detailPlaybackControlRows=passRows.map(row=>({...row}));
    const rowState=row=>{const source=String(row?.source||"").toLowerCase(),stateValue=String(row?.state||"").toLowerCase();if(row?.discarded||source==="discard"||stateValue==="discarded")return "discarded";if(row?.detected||stateValue==="validated"||["gps","qr","gps_track_recovery"].includes(source))return "validated";return "pending";};
    const expected=Math.max(0,Number(result.controlExpectedCount||passRows.length||0));
    const derivedValidated=passRows.filter(row=>rowState(row)==="validated").length;
    const derivedDiscarded=passRows.filter(row=>rowState(row)==="discarded").length;
    const derivedPending=passRows.filter(row=>rowState(row)==="pending").length;
    const detected=Math.max(0,derivedValidated||Number(result.controlDetectedCount||0));
    const discarded=Math.max(0,derivedDiscarded||Number(result.discardedControlCount||0));
    const missing=Math.max(0,expected?derivedPending:Number(result.pendingControlCount??result.controlMissingCount??0));
    const pct=expected?`${((detected/expected)*100).toFixed(1)}%`:"—";
    const qrCount=Math.max(0,Number(result.controlQrCount||passRows.filter(row=>String(row.source||"")==="qr").length||0));
    const liveGpsCount=Math.max(0,Number(result.controlGpsLiveCount||passRows.filter(row=>String(row.source||"")==="gps").length||0));
    const recoveryCount=Math.max(0,Number(result.controlTrackRecoveryCount||passRows.filter(row=>String(row.source||"")==="gps_track_recovery").length||0));
    const methodLabel=qrCount&&liveGpsCount?"GPS + QR":qrCount?"QR":liveGpsCount?"GPS LIVE":recoveryCount?"GPS TRACK":detected?"GPS / QR":"—";
    const penalty=Math.max(0,Number(result.penaltyMs||((discarded+missing)*900000)));
    el("m2rdPassSummary").innerHTML=[metricCell("VALIDADAS",expected?`${detected} / ${expected}`:"—"),metricCell("DESCARTADAS",String(discarded)),metricCell("PENDIENTES",String(missing)),metricCell("PENALIZACIÓN",penalty?`+${fmtDuration(penalty)}`:"+00:00"),metricCell("COBERTURA",pct),metricCell("MÉTODO",methodLabel)].join("");
    const passNote=el("m2rdPassNote");
    if(passNote){
      passNote.textContent=`Estado oficial: ${detected} validada${detected===1?"":"s"} · ${discarded} descartada${discarded===1?"":"s"} · ${missing} pendiente${missing===1?"":"s"}. Cada DESCARTADA y cada PENDIENTE al finalizar añade +15:00 al TIEMPO OFICIAL.`;
    }
    const passBody=el("m2rdPassBody");
    if(passBody){
      passBody.innerHTML=passRows.length?passRows.map(row=>{
        const stateRow=rowState(row),source=String(row.source||"").toLowerCase();
        const sourceLabel=source==="qr"?"QR":source==="gps"?"GPS LIVE":source==="gps_track_recovery"?"GPS TRACK":source==="discard"?"DESCARTE":"SIN VALIDAR";
        if(stateRow==="discarded")return `<tr><td>${esc(row.order||"—")}</td><td><strong>${esc(row.checkpointId||"—")}</strong></td><td class="m2rd-pass-discard">DESCARTADA · +15:00</td><td>${row.passedAtMs?esc(fmtClock(row.passedAtMs)):"—"}</td><td>${row.elapsedMs!=null?esc(fmtDuration(row.elapsedMs)):"—"}</td><td>${row.splitMs!=null?esc(fmtDuration(row.splitMs)):"—"}</td><td class="m2rd-pass-discard">DESCARTE · +15:00</td></tr>`;
        if(stateRow==="pending")return `<tr><td>${esc(row.order||"—")}</td><td><strong>${esc(row.checkpointId||"—")}</strong></td><td class="m2rd-pass-miss">PENDIENTE · +15:00</td><td>—</td><td>—</td><td>—</td><td class="m2rd-pass-miss">NO VALIDADA AL FINALIZAR · +15:00</td></tr>`;
        const gps=source==="qr"?"QR":(row.gpsAccuracyM==null?sourceLabel:`${sourceLabel} ±${Number(row.gpsAccuracyM).toFixed(0)} m`),dist=row.distanceM!=null?` · ${Number(row.distanceM).toFixed(0)} m`:"";
        return `<tr><td>${esc(row.order||"—")}</td><td><strong>${esc(row.checkpointId||"—")}</strong></td><td class="m2rd-pass-ok">VALIDADA · ${esc(sourceLabel)}</td><td>${row.passedAtMs?esc(fmtClock(row.passedAtMs)):"—"}</td><td>${row.elapsedMs!=null?esc(fmtDuration(row.elapsedMs)):"—"}</td><td>${row.splitMs!=null?esc(fmtDuration(row.splitMs)):"—"}</td><td>${esc(gps+dist)}</td></tr>`;
      }).join(""):'<tr><td colspan="7">No hay una secuencia de balizas analizable para este recorrido.</td></tr>';
    }
    el("m2rdDetailEventMetrics").innerHTML=[
      metricCell("ESCALA",event.planScale?`1:${Number(event.planScale).toLocaleString("es-ES")}`:"—"),metricCell("EQUIDISTANCIA",event.planEquidistanceM?`${event.planEquidistanceM} m`:"—"),metricCell("BALIZAS",String(event.checkpointCount||0)),metricCell("RECORRIDOS",String(event.courseCount||0)),metricCell("PARTICIPANTES PREVISTOS",String(event.participantCount||0)),metricCell("ESTADO EVENTO",statusES(event.status||""))
    ].join("");
    const controls=el("m2rdDetailControls");controls.innerHTML=(detail.checkpoints||[]).map(cp=>`<span class="m2rd-control-chip ${String(cp.type||"").toLowerCase()==="salida"?"start":String(cp.type||"").toLowerCase()==="llegada"?"finish":""}">${esc(cp.type==="SALIDA"?"SALIDA":cp.type==="LLEGADA"?"LLEGADA":cp.checkpointId||"BALIZA")}${cp.elevationM!=null?` · ${esc(cp.elevationM)} m`:""}</span>`).join("")||'<span class="m2rd-detail-note">No hay balizas georreferenciadas guardadas.</span>';
    const trackNote=meta.downsampled?`Firestore conserva ${meta.storedPointCount} puntos. Para que el mapa funcione fluido se muestran ${meta.returnedPointCount} puntos representativos.`:`Track histórico completo · ${meta.storedPointCount||0} puntos almacenados en Firestore.`;
    const courseNote=result.reducedDistanceKm==null&&Number(event.courseCount||0)>1?" · Distancia reducida pendiente de una asignación inequívoca del recorrido al corredor.":" · Distancia reducida = recorrido diseñado; distancia track = GPS real.";
    el("m2rdDetailMapNote").textContent=trackNote+courseNote;
    renderHistoryDetailMap();prepareHistoryPlayback();
  }
  async function openHistoryDetail(eventId){
    if(!eventId||state.detailLoading)return;
    const panel=el("m2rdHistoryDetail");panel.hidden=false;panel.scrollTop=0;state.detailEventId=eventId;state.detailLoading=true;state.detailError="";state.historyDetail=null;state.classificationDetail=null;state.classificationLoading=true;state.classificationError="";state.classificationView="general";
    stopHistoryPlayback(false);clearHistoryPlaybackLayer();state.detailPlaybackPoints=[];state.detailPlaybackControlRows=[];state.detailPlaybackStartMs=0;state.detailPlaybackCurrentMs=0;state.detailPlaybackDurationMs=0;updateHistoryPlaybackUi();
    state.detailRacePlanDescriptor=null;state.detailRacePlanError="";state.detailRacePlanLoading=false;cleanupHistoryRacePlanUrl();
    if(state.detailMap&&state.detailBaseKey==="custom"){await switchHistoryDetailLayer("mapant");}
    const historyRow=state.history.find(row=>String(row.eventId)===String(eventId));el("m2rdDetailTitle").textContent=historyRow?.eventName||"Carrera";el("m2rdDetailSubtitle").textContent=historyRow?`${historyStatusES(historyRow.status)} · ${eventId}`:eventId;renderHistoryDetail();
    try{
      const svc=await services();if(!svc.callable)throw new Error("Backend de detalle histórico no disponible.");
      const [detailResult,classResult]=await Promise.allSettled([
        svc.callable("getRunnerResultDetail",{eventId,clientVersion:VERSION}),
        svc.callable("getEventClassification",{eventId,clientVersion:VERSION})
      ]);
      if(state.detailEventId!==eventId)return;
      if(detailResult.status==="fulfilled")state.historyDetail=detailResult.value?.data||null;else{console.error("[MILITOPO H4 detail]",detailResult.reason);state.detailError=String(detailResult.reason?.message||"No se pudo cargar el detalle de la carrera.");}
      if(classResult.status==="fulfilled")state.classificationDetail=classResult.value?.data||null;else{console.error("[MILITOPO H5 classification]",classResult.reason);state.classificationError=String(classResult.reason?.message||"No se pudo cargar la clasificación.");}
    }catch(error){console.error("[MILITOPO H4/H5 detail]",error);state.detailError=String(error?.message||"No se pudo cargar el detalle de la carrera.");state.classificationError=state.detailError;}
    finally{if(state.detailEventId===eventId){state.detailLoading=false;state.classificationLoading=false;renderHistoryDetail();renderRunnerClassification();}}
  }

  function renderHistory(){
    const holder=el("m2rdHistory"),summary=state.historySummary||{};
    el("m2rdHistoryTotal").textContent=String(summary.total||0);
    el("m2rdHistoryFinished").textContent=String(summary.finished||0);
    el("m2rdHistoryIncomplete").textContent=String(summary.incomplete||0);
    el("m2rdHistoryNotStarted").textContent=String(summary.notStarted||0);
    const refresh=el("m2rdHistoryRefresh"); if(refresh)refresh.disabled=state.historyLoading||!navigator.onLine;
    if(state.historyLoading){setHistoryStatus("Consultando tus resultados permanentes…");}
    else if(state.historyError){setHistoryStatus(`⚠️ ${state.historyError}`,"err");}
    else if(!state.history.length){setHistoryStatus("Todavía no tienes resultados históricos guardados.","ok");}
    else setHistoryStatus(`✅ ${state.history.length} resultado${state.history.length===1?"":"s"} guardado${state.history.length===1?"":"s"} en tu histórico.`,"ok");
    if(!holder)return;
    holder.innerHTML=state.history.map(row=>{
      const status=["finished","incomplete","not_started"].includes(String(row.status))?String(row.status):"not_started";
      const date=fmtHistoryDate(row.finishedAtMs||row.startedAtMs||row.consolidatedAtMs);
      const points=Math.max(0,Number(row.trackPointCount||0));
      return `<article class="m2rd-history-row"><div class="m2rd-history-top"><div class="m2rd-history-title"><strong>${esc(row.eventName||"Carrera de orientación")}</strong><div class="m2rd-history-date">${esc(date)} · ${esc(row.eventId||"")}</div></div><span class="m2rd-history-state ${esc(status)}">${esc(historyStatusES(status))}</span></div><div class="m2rd-history-metrics"><div class="m2rd-history-metric"><span>TIEMPO OFICIAL</span><strong>${esc(fmtDuration(row.officialDurationMs??row.durationMs))}</strong></div><div class="m2rd-history-metric"><span>DISTANCIA</span><strong>${esc(fmtDistance(row.trackDistanceM))}</strong></div><div class="m2rd-history-metric"><span>GPS</span><strong>${esc(points)} pts</strong></div></div><button class="m2rd-history-detail-btn" type="button" data-history-detail="${esc(row.eventId||"")}">VER DETALLE · MAPA Y TRACK</button></article>`;
    }).join("");
  }
  async function loadHistory(silent=false){
    if(!state.auth||state.auth.role!=="runner"||state.historyLoading)return;
    state.historyLoading=true;state.historyError="";renderHistory();
    try{
      const svc=await services(); if(!svc.callable)throw new Error("Backend de histórico no disponible.");
      const response=await svc.callable("getRunnerHistory",{clientVersion:VERSION,limit:100});
      state.history=Array.isArray(response?.data?.results)?response.data.results:[];
      state.historySummary=response?.data?.summary||{total:state.history.length,finished:0,incomplete:0,notStarted:0};
    }catch(error){
      console.error("[MILITOPO runner history]",error);
      if(state.onlineRevalidating&&transientReconnectError(error)){
        // Durante la transición de red conservamos el histórico ya visible; un
        // error temporal de Functions no debe borrar datos válidos de la pantalla.
        state.historyError="";
      }else{
        state.history=[];state.historySummary={total:0,finished:0,incomplete:0,notStarted:0};
        state.historyError=String(error?.message||"No se pudo consultar tu histórico.");
      }
    }finally{
      state.historyLoading=false;renderHistory();
    }
  }

  function renderEvents(){
    const holder=el("m2rdEvents"); holder.innerHTML="";
    if(!state.events.length){setStatus("No tienes carreras activas asociadas a tu cuenta ahora mismo. Las carreras finalizadas no se muestran aquí.","ok");return;}
    holder.innerHTML=state.events.map(ev=>{
      const live=String(ev.status)==="live"&&String(ev.liveRunId||"").trim();
      const isConnected=state.active?.eventId===ev.eventId&&state.runId;
      let action="";
      if(live){
        const ps=String(ev.participantLiveStatus||(isConnected?state.participantStatus:"")||"ready").toLowerCase();
        const liveLabel=ps==="racing"?"EN CARRERA":ps==="finished"?"FINALIZADO":"PREPARADO / SIN SALIR";
        const buttonLabel=ps==="finished"?"VER RESUMEN DE CARRERA":"ENTRAR EN LA CARRERA";
        if(isConnected){
          action=`<div class="m2rd-live">✅ CONECTADO · ${liveLabel}</div><button class="m2rd-btn" type="button" data-enter-event="${esc(ev.eventId)}">${buttonLabel}</button>`;
        }else if(ev.liveConnectError){
          action=`<div class="m2rd-live">⚠️ No se pudo conectar automáticamente.</div><button class="m2rd-btn" type="button" data-reconnect-event="${esc(ev.eventId)}">REINTENTAR CONEXIÓN</button>`;
        }else{
          action=`<div class="m2rd-live">Carrera EN DIRECTO. Preparando acceso…</div>`;
        }
      }
      else if(String(ev.status)==="finished") action=`<div class="m2rd-note">Carrera finalizada.</div>`;
      else if(String(ev.status)==="prepared") action=`<div class="m2rd-note">La carrera está PREPARADA. Espera a que el organizador la publique.</div>`;
      else action=`<div class="m2rd-note">Esperando a que el organizador inicie la carrera.</div>`;
      const routeAssigned=Boolean(ev.participantId&&ev.routeId);
      const routeBlock=routeAssigned?`<div class="m2rd-route"><div class="m2rd-route-head"><span>🧭 MI RECORRIDO</span><span>${esc(ev.participantId)} · ${esc(ev.routeId)}</span></div><div class="m2rd-route-grid"><span>DISTANCIA<strong>${esc(fmtRouteKm(ev.routeDistanceKm))}</strong></span><span>BALIZAS<strong>${esc(ev.routeControlCount??"—")}</strong></span><span>DESNIVEL +<strong>${ev.routePositiveM==null?"—":`${esc(ev.routePositiveM)} m`}</strong></span><span>DIFICULTAD<strong>${esc(ev.routeDifficulty||"—")}</strong></span></div>${routeSequenceText(ev)?`<div class="m2rd-route-seq">${esc(routeSequenceText(ev))}</div>`:""}</div>`:`<div class="m2rd-note">Recorrido pendiente de asignación.</div>`;
      return `<article class="m2rd-event"><strong>${esc(ev.eventName||"Carrera")}</strong><div class="m2rd-event-meta">${esc(statusES(ev.status))} · ${esc(ev.eventId||"")}</div><span class="m2rd-pill">${esc(statusES(ev.status))}</span>${routeBlock}${action}</article>`;
    }).join("");
  }
  async function loadEvents(force=false,silent=false,options={}){
    if(!state.auth||state.auth.role!=="runner") return false;
    const retry=el("m2rdRetry"); retry.hidden=true;
    if(!silent) setStatus("Consultando tus carreras Live V2…");
    try{
      const svc=await services(); if(!svc.callable) throw new Error("Backend Live V2 no disponible.");
      const result=await svc.callable("getRunnerLiveEvents",{clientVersion:VERSION});
      state.events=Array.isArray(result?.data?.events)?result.data.events:[]; writeEventsSnapshot(state.events); renderEvents();
      await bindEventWatchers();
      const live=state.events.filter(e=>String(e.status)==="live"&&String(e.liveRunId||"").trim());
      if(live.length){
        // Los watchers completan startedAt/estado por corredor y la selección
        // central elige una sola sesión, incluso si hay varias carreras EN DIRECTO.
        scheduleLiveSelection(220);
      }else{
        cleanupLive();
        if(state.events.length&&!silent)setStatus(`✅ ${state.events.length} carrera${state.events.length===1?"":"s"} asociada${state.events.length===1?"":"s"} a tu cuenta.`,"ok");
      }
      return true;
    }catch(error){
      console.error("[MILITOPO runner dashboard]",error);
      if(options?.throwOnError)throw error;
      // Una transición offline→online puede devolver temporalmente functions/internal.
      // Conservamos el snapshot visible y dejamos que el coordinador de reconexión reintente.
      if(options?.reconnecting||state.onlineRevalidating||(!navigator.onLine)){
        setStatus(navigator.onLine?"Conexión recuperada · sincronizando tus carreras…":"📴 Sin conexión · mostrando la última información guardada.","ok");
        return false;
      }
      setStatus(`⚠️ ${String(error?.message||"No se pudieron consultar tus carreras.")}`,"err");retry.hidden=false;
      return false;
    }
  }
  function activate(auth, silent=false){
    if(!auth||auth.role!=="runner"){
      hide();
      try{localStorage.removeItem(LAST_ROLE_KEY);document.documentElement.classList.remove("militopo-runner-restore");}catch(_){}
      return;
    }
    const changedUid=String(state.auth?.uid||"")!==String(auth.uid||"");
    state.auth=auth;
    clearTimeout(state.recoveryDeadline); state.recoveryDeadline=null;
    try{localStorage.setItem(LAST_ROLE_KEY,"runner");localStorage.setItem(AUTH_SNAPSHOT_KEY,JSON.stringify(auth));}catch(_){}
    reveal(); paintIdentity(auth);
    const retry=el("m2rdRetry"); retry.textContent="REINTENTAR"; retry.hidden=true;
    if(changedUid || !state.unsubInviteSignals) bindInviteSignals();
    if(!state.onlineRevalidating){
      if(changedUid||!state.events.length) loadEvents(false,silent);
      if(changedUid||!state.history.length) loadHistory(silent);
    }
  }
  addEventListener("militopo:v2-auth-ready",e=>activate(e.detail));
  addEventListener("militopo:v2-runner-dashboard",e=>activate(e.detail));
  addEventListener("militopo:v2-auth-signed-out",()=>{
    state.auth=null;state.events=[];state.history=[];state.historySummary={total:0,finished:0,incomplete:0,notStarted:0};state.historyError="";cleanupLive();cleanupEventWatchers();cleanupInviteSignals();hide();
    try{localStorage.removeItem(LAST_ROLE_KEY);localStorage.removeItem(AUTH_SNAPSHOT_KEY);localStorage.removeItem(EVENTS_SNAPSHOT_KEY);}catch(_){}
  });
  addEventListener("pageshow",()=>{if(globalThis.MILITOPO_V2_AUTH?.role==="runner")activate(globalThis.MILITOPO_V2_AUTH);});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&state.auth?.role==="runner"&&!state.onlineRevalidating){loadEvents(false,true);loadHistory(true);}});
  addEventListener("focus",()=>{if(state.auth?.role==="runner"&&!state.onlineRevalidating){loadEvents(false,true);loadHistory(true);}});
  addEventListener("online",()=>{
    revalidateAfterOnline().catch(error=>{
      console.warn("[MILITOPO runner dashboard] online revalidation",error);
      if(navigator.onLine&&!activeRaceSnapshot())scheduleControlledOnlineReload();
    });
  });
  addEventListener("militopo:v2-runner-race-closed",event=>{if(state.auth?.role==="runner"){loadEvents(true,true);if(String(event?.detail?.status||"").toLowerCase()==="finished")setTimeout(()=>loadHistory(false),350);}});
  addEventListener("militopo:v2-invitation-accepted",()=>{if(state.auth?.role==="runner")loadEvents(true,false);});
  addEventListener("militopo:v2-inbox-updated",event=>{
    if(state.auth?.role!=="runner")return;
    const pending=Math.max(0,Number(event?.detail?.pending||0));
    updateAccountInviteBadge(pending);
    if(pending===0)loadEvents(true,true);
  });
  try{
    const snap=cachedAuth();
    if(localStorage.getItem(LAST_ROLE_KEY)==="runner" && snap?.uid && snap.role==="runner"){
      reveal();
      paintIdentity(snap);
      const cachedEvents=readEventsSnapshot();
      if(cachedEvents.length){ state.events=cachedEvents; renderEvents(); }
      setStatus("Recuperando tu sesión de corredor…");
      setTimeout(()=>recoverRunnerAuth(),120);
      clearTimeout(state.recoveryDeadline);
      state.recoveryDeadline=setTimeout(async()=>{
        if(state.auth?.uid) return;

        // I2.1: OFFLINE es un estado válido, no un fallo de autenticación.
        // Si existe un snapshot runner válido del mismo dispositivo, mantenemos
        // la shell restaurada y los datos locales indefinidamente. La seguridad
        // real sigue estando en Rules/Functions; aquí solo preservamos la UI offline.
        if(!navigator.onLine){
          const retry=el("m2rdRetry");
          retry.hidden=true;
          setStatus("📴 Sin conexión · sesión local restaurada. Tus carreras guardadas siguen disponibles; MILITOPO revalidará la cuenta al recuperar Internet.","ok");
          return;
        }

        const ok=await recoverRunnerAuth();
        if(!ok){
          // Si la red cayó durante el intento, tampoco destruimos el snapshot.
          if(!navigator.onLine){
            const retry=el("m2rdRetry");
            retry.hidden=true;
            setStatus("📴 Sin conexión · sesión local restaurada. Revalidación pendiente al recuperar Internet.","ok");
            return;
          }
          const retry=el("m2rdRetry");
          retry.hidden=false; retry.textContent="REINTENTAR SESIÓN";
          setStatus("No se ha podido confirmar la sesión con Firebase. Reintenta cuando tengas conexión.","err");
          setTimeout(()=>{
            if(state.auth?.uid||!navigator.onLine)return;
            try{globalThis.dispatchEvent(new CustomEvent("militopo:v2-auth-recovery-failed"));}catch(_){}
            hide();
          },7000);
        }
      },12000);
    }
  }catch(_){}
  let bootTries=0;
  const bootTimer=setInterval(()=>{
    bootTries+=1;
    const auth=globalThis.MILITOPO_V2_AUTH;
    if(auth){
      clearInterval(bootTimer);
      activate(auth,true); // activate() oculta el dashboard para cualquier rol no-runner.
      return;
    }
    // Solo intentar recuperación si existe evidencia local explícita de runner.
    if(bootTries%5===0 && navigator.onLine){
      const snap=cachedAuth();
      if(snap?.uid && snap.role==="runner") recoverRunnerAuth();
    }
    if(bootTries>=30) clearInterval(bootTimer);
  },400);
  if(globalThis.MILITOPO_V2_AUTH) queueMicrotask(()=>activate(globalThis.MILITOPO_V2_AUTH,true));
})();
