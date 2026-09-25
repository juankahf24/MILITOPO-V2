/* MILITOPO V2 · F3A · Runner dashboard sobre la shell autenticada principal.
   No importa Firebase ni vuelve a inicializar Auth: reutiliza el singleton que ya
   ha cargado correctamente la pantalla de login de MILITOPO. */
(function () {
  "use strict";
  const VERSION = "v2-h4-23-route-assignment-20260925";
  const state = { auth:null, services:null, servicesPromise:null, recoveryPromise:null, events:[], history:[], historySummary:{total:0,finished:0,incomplete:0,notStarted:0}, historyLoading:false, historyError:"", historyDetail:null, detailLoading:false, detailError:"", detailEventId:"", detailMap:null, detailBaseLayers:{}, detailBaseLayer:null, detailBaseKey:"mapant", detailTrackLayer:null, detailCheckpointLayer:null, detailRacePlanLayer:null, detailRacePlanDescriptor:null, detailRacePlanOwnedUrl:"", detailRacePlanLoading:false, detailRacePlanError:"", active:null, runId:"", participantStatus:"", unsubRun:null, unsubParticipant:null, heartbeat:null, root:null, eventWatchers:new Map(), unsubInviteSignals:null, inviteSignalSignature:"", recoveryDeadline:null };
  const LAST_ROLE_KEY = "militopo_v2_last_role";
  const AUTH_SNAPSHOT_KEY = "militopo_v2_auth_snapshot";
  const EVENTS_SNAPSHOT_KEY = "militopo_v2_runner_events_snapshot";

  const esc = v => String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const statusES = s => ({draft:"BORRADOR",prepared:"PREPARADO",published:"PUBLICADO",live:"EN DIRECTO",finished:"FINALIZADO",archived:"ARCHIVADO"})[String(s||"").toLowerCase()] || String(s||"").toUpperCase();
  const initials = name => { const p=String(name||"").trim().split(/\s+/).filter(Boolean); return ((p[0]?.[0]||"")+(p[1]?.[0]||"")).toUpperCase()||"R"; };
  const fmtRouteKm = value => Number.isFinite(Number(value)) ? `${Number(value).toFixed(2)} km` : "—";
  const routeSequenceText = row => (Array.isArray(row?.routePoints) ? row.routePoints : []).map(value=>{const key=String(value||"").trim();const upper=key.toUpperCase();return upper==="START"||upper==="SALIDA"?"S":upper==="FINISH"||upper==="LLEGADA"?"L":key;}).filter(Boolean).join(" → ");


  function cachedAuth(){
    try{const raw=localStorage.getItem(AUTH_SNAPSHOT_KEY);if(!raw)return null;const data=JSON.parse(raw);return data?.role==="runner"?data:null;}catch(_){return null;}
  }
  async function recoverRunnerAuth(){
    if(state.auth?.uid)return true;
    if(state.recoveryPromise)return state.recoveryPromise;
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
        const snap=cachedAuth();
        activate({uid:user.uid,email:user.email||snap?.email||null,displayName:snap?.displayName||user.displayName||null,username:snap?.username||null,role:"runner",emailVerified:true},true);
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
          setTimeout(()=>document.getElementById("m2AuthAccountBtn")?.click(),180);
        } else if(!signature){
          state.inviteSignalSignature="";
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
      .m2rd-account{width:100%;min-height:44px;margin-top:12px;border-radius:13px;border:1px solid rgba(240,193,106,.38);background:rgba(240,193,106,.10);color:#fff1d2;font:inherit;font-weight:900}.m2rd-status{padding:10px 11px;border-radius:13px;background:rgba(255,255,255,.035);color:#c7bda8;font-size:.78rem;line-height:1.45}.m2rd-status.ok{border:1px solid rgba(126,220,150,.25);color:#dcf4cf}.m2rd-status.err{border:1px solid rgba(255,142,122,.28);color:#ffd0c8}
      .m2rd-events{display:grid;gap:10px;margin-top:10px}.m2rd-event{border:1px solid rgba(255,255,255,.10);border-radius:16px;background:rgba(255,255,255,.035);padding:13px}.m2rd-event strong{display:block;font-size:.94rem}.m2rd-event-meta{margin-top:4px;color:#b7ad99;font-size:.72rem}.m2rd-pill{display:inline-block;margin-top:8px;padding:5px 9px;border-radius:999px;border:1px solid rgba(126,220,150,.36);color:#e0f6d4;font-size:.68rem;font-weight:900}.m2rd-route{margin-top:9px;padding:10px;border-radius:12px;border:1px solid rgba(240,193,106,.28);background:rgba(240,193,106,.07)}.m2rd-route-head{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:.72rem;font-weight:900;color:#f2dfb5}.m2rd-route-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin-top:7px}.m2rd-route-grid span{display:block;padding:6px 5px;border-radius:9px;background:rgba(0,0,0,.14);font-size:.58rem;color:#9e9b8e}.m2rd-route-grid strong{display:block;margin-top:2px;color:#f3f0e8;font-size:.68rem;overflow-wrap:anywhere}.m2rd-route-seq{margin-top:7px;font-size:.62rem;line-height:1.45;color:#bdb49f;overflow-wrap:anywhere}.m2rd-note{margin-top:9px;padding:9px 10px;border-radius:12px;background:rgba(240,193,106,.08);color:#eadbbf;font-size:.75rem;line-height:1.4}.m2rd-live{margin-top:9px;padding:9px 10px;border-radius:12px;border:1px solid rgba(126,220,150,.28);background:rgba(126,220,150,.10);color:#ddf6d2;font-size:.75rem;font-weight:900}.m2rd-btn{width:100%;min-height:45px;margin-top:9px;border-radius:13px;border:1px solid rgba(126,220,150,.40);background:rgba(126,220,150,.15);color:#efffe8;font:inherit;font-weight:900}.m2rd-btn:disabled{opacity:.48}.m2rd-small{margin-top:10px;color:#978e7e;font-size:.68rem;line-height:1.45}
      .m2rd-history-head{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:10px 0}.m2rd-history-stat{padding:9px 7px;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);text-align:center}.m2rd-history-stat strong{display:block;font-size:1rem;color:#f4e7c8}.m2rd-history-stat span{display:block;margin-top:2px;font-size:.58rem;letter-spacing:.06em;color:#9f9889}.m2rd-history{display:grid;gap:9px}.m2rd-history-row{padding:12px;border-radius:15px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.09)}.m2rd-history-top{display:flex;gap:8px;justify-content:space-between;align-items:flex-start}.m2rd-history-title{min-width:0}.m2rd-history-title strong{display:block;font-size:.9rem}.m2rd-history-date{margin-top:3px;color:#a9a18f;font-size:.68rem}.m2rd-history-state{flex:0 0 auto;padding:4px 7px;border-radius:999px;font-size:.61rem;font-weight:900;border:1px solid rgba(126,220,150,.30);color:#daf3cf}.m2rd-history-state.incomplete{border-color:rgba(240,193,106,.34);color:#f5dfaf}.m2rd-history-state.not_started{border-color:rgba(170,170,170,.25);color:#c4c4c4}.m2rd-history-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:9px}.m2rd-history-metric{padding:7px;border-radius:10px;background:rgba(0,0,0,.12)}.m2rd-history-metric span{display:block;font-size:.56rem;color:#8f978d;letter-spacing:.05em}.m2rd-history-metric strong{display:block;margin-top:3px;font-size:.76rem;color:#edf2e8}.m2rd-history-refresh{min-height:40px;margin-top:9px}.m2rd-history-detail-btn{width:100%;min-height:38px;margin-top:9px;border-radius:11px;border:1px solid rgba(240,193,106,.34);background:rgba(240,193,106,.10);color:#fff0cf;font:inherit;font-size:.72rem;font-weight:900}
      .m2rd-detail{position:fixed;inset:0;z-index:100003;overflow:auto;background:rgba(4,8,5,.985);padding:max(72px,calc(env(safe-area-inset-top) + 58px)) 10px calc(28px + env(safe-area-inset-bottom));color:#f5e6c8}.m2rd-detail[hidden]{display:none!important}.m2rd-detail-shell{width:min(860px,100%);margin:0 auto;display:grid;gap:12px}.m2rd-detail-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.m2rd-detail-head h2{margin:0;color:#f0c16a;font-size:1.15rem}.m2rd-detail-close{min-width:44px;min-height:40px;border-radius:11px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.07);color:#fff;font:inherit;font-weight:900}.m2rd-detail-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.m2rd-detail-stat{padding:9px 7px;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08)}.m2rd-detail-stat span{display:block;font-size:.56rem;color:#9a9b8f;letter-spacing:.05em}.m2rd-detail-stat strong{display:block;margin-top:4px;font-size:.78rem;color:#eef3e9;overflow-wrap:anywhere}.m2rd-detail-maptools{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin-top:10px}.m2rd-detail-layer{min-height:34px;border-radius:10px;border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.22);color:#f6efe2;font:inherit;font-size:.65rem;font-weight:900}.m2rd-detail-layer.active{background:#d8b45e;color:#201608;border-color:#f2d58f}.m2rd-detail-layer.loading{opacity:.62;cursor:wait}.m2rd-detail-layerstatus{min-height:18px;margin:6px 0 0;font-size:.64rem;opacity:.76}.m2rd-detail-layerstatus.err{color:#ffc5b9;opacity:1}.m2rd-detail-map{height:390px;margin-top:8px;border-radius:15px;overflow:hidden;border:1px solid rgba(255,255,255,.12);background:#172017}.m2rd-detail-note{margin-top:8px;color:#a9a18f;font-size:.67rem;line-height:1.4}.m2rd-control-list{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.m2rd-control-chip{padding:5px 7px;border-radius:999px;border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.035);font-size:.62rem}.m2rd-control-chip.start{border-color:rgba(126,220,150,.35);color:#daf4d0}.m2rd-control-chip.finish{border-color:rgba(255,145,130,.30);color:#ffd3cb}
      .m2rd-detail-checkpoint{min-width:22px;height:22px;padding:0 4px;border-radius:999px;display:grid;place-items:center;border:2px solid rgba(255,255,255,.9);background:#9b6b2f;color:white;font-size:9px;font-weight:900;box-shadow:0 2px 7px rgba(0,0,0,.38)}
      .m2rd-detail-checkpoint.start{background:#397d55}.m2rd-detail-checkpoint.finish{background:#934d4d}
      .m2rd-detail-map .leaflet-control-attribution{font-size:9px}.m2rd-detail-maplegend{display:flex;gap:12px;flex-wrap:wrap;margin-top:8px;font-size:.62rem;opacity:.75}.m2rd-detail-maplegend span{display:inline-flex;align-items:center;gap:5px}
      @media(max-width:430px){#m2RunnerDashboard{padding-left:9px;padding-right:9px}.m2rd-card{border-radius:22px}.m2rd-history-head{grid-template-columns:1fr 1fr}.m2rd-history-metrics{grid-template-columns:1fr 1fr 1fr}.m2rd-detail-grid{grid-template-columns:1fr 1fr}.m2rd-detail-map{height:320px}}
    `;
    document.head.appendChild(style);
  }

  function ensureRoot(){
    installStyle();
    if(state.root?.isConnected) return state.root;
    const root=document.createElement("section"); root.id="m2RunnerDashboard"; root.hidden=true;
    root.innerHTML=`<div class="m2rd-shell">
      <section class="m2rd-card m2rd-hero"><img class="m2rd-logo" src="icons/militopo-512.png" alt="MILITOPO"><h1 class="m2rd-title">MILITOPO</h1><p class="m2rd-sub"><strong>ÁREA DEL CORREDOR</strong><br>Tus carreras, invitaciones y sesiones Live V2.</p></section>
      <section class="m2rd-card"><h2 class="m2rd-kicker">👤 MI CUENTA</h2><div class="m2rd-id"><div id="m2rdAvatar" class="m2rd-avatar">R</div><div><div id="m2rdName" class="m2rd-name">Corredor</div><div id="m2rdMeta" class="m2rd-meta">runner</div></div></div><button id="m2rdAccount" class="m2rd-account" type="button">MI CUENTA</button></section>
      <section class="m2rd-card"><h2 class="m2rd-kicker">📡 LIVE V2 · MIS CARRERAS</h2><div id="m2rdStatus" class="m2rd-status">Cargando tus carreras…</div><div id="m2rdEvents" class="m2rd-events"></div><button id="m2rdRetry" class="m2rd-btn" type="button" hidden>REINTENTAR</button><div class="m2rd-small">El acceso a Organizador está reservado a organizer/super_admin. Tu cuenta runner entra directamente aquí.</div></section>
      <section class="m2rd-card"><h2 class="m2rd-kicker">🏁 MI HISTÓRICO</h2><div id="m2rdHistoryStatus" class="m2rd-status">Cargando tus resultados…</div><div class="m2rd-history-head"><div class="m2rd-history-stat"><strong id="m2rdHistoryTotal">0</strong><span>RESULTADOS</span></div><div class="m2rd-history-stat"><strong id="m2rdHistoryFinished">0</strong><span>FINALIZADOS</span></div><div class="m2rd-history-stat"><strong id="m2rdHistoryIncomplete">0</strong><span>INCOMPLETOS</span></div><div class="m2rd-history-stat"><strong id="m2rdHistoryNotStarted">0</strong><span>NO SALIÓ</span></div></div><div id="m2rdHistory" class="m2rd-history"></div><button id="m2rdHistoryRefresh" class="m2rd-btn m2rd-history-refresh" type="button">ACTUALIZAR HISTÓRICO</button><div class="m2rd-small">Resultados permanentes guardados en Firestore. Pulsa VER DETALLE para consultar mapa, track y métricas completas.</div></section>
    </div>
    <section id="m2rdHistoryDetail" class="m2rd-detail" hidden><div class="m2rd-detail-shell">
      <section class="m2rd-card"><div class="m2rd-detail-head"><div><div class="m2rd-kicker">🏁 DETALLE DE PARTICIPACIÓN</div><h2 id="m2rdDetailTitle">Carrera</h2><div id="m2rdDetailSubtitle" class="m2rd-history-date">Resultado histórico</div></div><button id="m2rdDetailClose" class="m2rd-detail-close" type="button" aria-label="Cerrar detalle">✕</button></div><div id="m2rdDetailStatus" class="m2rd-status" style="margin-top:12px">Selecciona una carrera.</div></section>
      <section class="m2rd-card"><h3 class="m2rd-kicker">📊 RESULTADO</h3><div id="m2rdDetailMetrics" class="m2rd-detail-grid"></div></section>
      <section class="m2rd-card"><h3 class="m2rd-kicker">🗺️ TRACK Y CARTOGRAFÍA</h3><div class="m2rd-detail-maptools" role="tablist" aria-label="Cartografía del track histórico"><button class="m2rd-detail-layer active" type="button" data-detail-layer="mapant">MAPANT</button><button class="m2rd-detail-layer" type="button" data-detail-layer="ign">IGN</button><button class="m2rd-detail-layer" type="button" data-detail-layer="aerial">AÉREO</button><button class="m2rd-detail-layer" type="button" data-detail-layer="custom">PLANO CARRERA</button></div><div id="m2rdDetailLayerStatus" class="m2rd-detail-layerstatus">Fondo: MAPANT</div><div id="m2rdDetailMap" class="m2rd-detail-map"></div><div class="m2rd-detail-maplegend"><span>━ Track del corredor</span><span>◆ Baliza / salida / llegada</span></div><button id="m2rdDetailFit" class="m2rd-btn" type="button">ENCUADRAR RECORRIDO</button><div id="m2rdDetailMapNote" class="m2rd-detail-note">El track se carga desde Firestore, no desde la sesión Live.</div></section>
      <section class="m2rd-card"><h3 class="m2rd-kicker">◆ DATOS DE LA CARRERA</h3><div id="m2rdDetailEventMetrics" class="m2rd-detail-grid"></div><div id="m2rdDetailControls" class="m2rd-control-list"></div></section>
    </div></section>`;
    document.body.appendChild(root); state.root=root;
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
    root.addEventListener("click",e=>{
      const detailBtn=e.target.closest("[data-history-detail]");
      if(detailBtn){openHistoryDetail(String(detailBtn.dataset.historyDetail||""));return;}
      const layerBtn=e.target.closest("[data-detail-layer]");
      if(layerBtn){switchHistoryDetailLayer(String(layerBtn.dataset.detailLayer||"mapant")).catch(error=>{console.error("[MILITOPO H4.1 layer]",error);state.detailRacePlanError=String(error?.message||"No se pudo cambiar el fondo cartográfico.");renderHistoryDetailLayerState();});return;}
      const btn=e.target.closest("[data-enter-event]");
      if(!btn)return; const id=btn.dataset.enterEvent||""; const event=state.events.find(row=>row.eventId===id); if(!event||!state.runId)return; window.dispatchEvent(new CustomEvent("militopo:v2-open-runner-race",{detail:{event:{...event},runId:state.runId,auth:{...state.auth}}}));
    });
    return root;
  }
  function el(id){return ensureRoot().querySelector("#"+id);}
  function setStatus(msg,type=""){const n=el("m2rdStatus");n.textContent=msg;n.className=`m2rd-status${type?` ${type}`:""}`;}
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
        let retryTimer=null;
        let retryCount=0;

        const cleanupActive=()=>{
          try{activeUnsub?.();}catch(_){}
          activeUnsub=null;
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
            renderEvents();
            if(!state.active || state.active.eventId!==target.eventId || !state.runId){
              connectLive(target);
            }
          } else if(runStatus==="finished"){
            target.status="finished";
            target.liveStatus="finished";
            renderEvents();
            if(state.active?.eventId===target.eventId){
              cleanupLive();
              setStatus("🏁 La sesión Live V2 ha finalizado.","ok");
            }
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

  async function connectLive(event){
    cleanupLive(); state.active=event; setStatus(`Conectando con ${event.eventName}…`);
    try{
      const svc=await services(), api=svc.databaseApi;
      if(!api) throw new Error("Realtime Database no está preparado en esta versión.");
      const activeRef=api.ref(`v2/live/${event.ownerUid}/${event.eventId}/activeRun`);
      const activeSnap=await api.get(activeRef); const active=activeSnap.exists()?(activeSnap.val()||{}):{};
      if(!active.runId||String(active.status)!=="active") throw new Error("La carrera todavía no está en directo.");
      const joined=await svc.callable("runnerJoinLive",{eventId:event.eventId,clientVersion:VERSION});
      state.runId=String(joined?.data?.runId||active.runId||"");
      if(!state.runId) throw new Error("No se pudo resolver la sesión Live V2.");
      const pRef=api.ref(`v2/live/${event.ownerUid}/${event.eventId}/runs/${state.runId}/participants/${state.auth.uid}`);
      await api.update(pRef,{online:true,lastSeen:api.serverTimestamp(),updatedAt:api.serverTimestamp()});
      try{await api.onDisconnect(pRef).update({online:false,lastSeen:api.serverTimestamp(),updatedAt:api.serverTimestamp()});}catch(_){}
      state.heartbeat=setInterval(()=>api.update(pRef,{online:true,lastSeen:api.serverTimestamp(),updatedAt:api.serverTimestamp()}).catch(()=>{}),20000);
      state.unsubParticipant=api.onValue(pRef,snap=>{const row=snap.val()||{}; state.participantStatus=String(row.status||"ready").toLowerCase(); const label=state.participantStatus==="ready"?"PREPARADO":state.participantStatus==="racing"?"EN CARRERA":state.participantStatus==="finished"?"FINALIZADO":statusES(state.participantStatus); setStatus(`✅ Conectado a Live V2 · ${event.eventName} · ${label}`,"ok"); renderEvents();});
      state.unsubRun=api.onValue(activeRef,snap=>{const row=snap.val()||{};if(String(row.status||"")==="finished"){setStatus("🏁 La sesión Live V2 ha finalizado.","ok");cleanupLive();renderEvents();}});
    }catch(error){console.error("[MILITOPO runner dashboard live]",error);setStatus(`⚠️ ${String(error?.message||error)}`,"err");}
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
    state.detailTrackLayer=L.layerGroup().addTo(state.detailMap);state.detailCheckpointLayer=L.layerGroup().addTo(state.detailMap);
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
    [state.detailTrackLayer,state.detailCheckpointLayer].forEach(group=>{
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
  function renderHistoryDetailMap(){
    const map=ensureHistoryDetailMap(),L=globalThis.L,detail=state.historyDetail;if(!map||!L||!detail)return;
    state.detailTrackLayer?.clearLayers();state.detailCheckpointLayer?.clearLayers();
    const track=(detail.track||[]).filter(p=>validHistoryCoord(p.lat,p.lng)).map(p=>[Number(p.lat),Number(p.lng)]);
    if(track.length>1)L.polyline(track,{weight:4,opacity:.88}).addTo(state.detailTrackLayer);
    else if(track.length===1)L.circleMarker(track[0],{radius:6,weight:2,fillOpacity:.9}).addTo(state.detailTrackLayer);
    (detail.checkpoints||[]).forEach(cp=>{
      if(!validHistoryCoord(cp.lat,cp.lon))return;
      const type=String(cp.type||"BALIZA").toUpperCase();
      const cls=type==="SALIDA"?"start":type==="LLEGADA"?"finish":"";
      const label=type==="SALIDA"?"S":type==="LLEGADA"?"L":String(cp.checkpointId||cp.id||"P").replace(/^P/i,"").slice(-3);
      const icon=L.divIcon({className:"",html:`<div class="m2rd-detail-checkpoint ${cls}">${esc(label)}</div>`,iconSize:[30,24],iconAnchor:[15,12]});
      const marker=L.marker([Number(cp.lat),Number(cp.lon)],{icon,keyboard:false});
      marker.bindPopup(`<strong>${esc(cp.checkpointId||"Punto")}</strong><br>${esc(type)}${cp.description?`<br>${esc(cp.description)}`:""}`);marker.addTo(state.detailCheckpointLayer);
    });
    bringHistoryOverlayLayersToFront();
    setTimeout(()=>{map.invalidateSize();fitHistoryDetailMap();},100);
  }
  function renderHistoryDetail(){
    const detail=state.historyDetail,panel=el("m2rdHistoryDetail"),status=el("m2rdDetailStatus");if(!panel)return;
    if(state.detailLoading){status.textContent="Cargando resultado, track y balizas desde Firestore…";status.className="m2rd-status";return;}
    if(state.detailError){status.textContent=`⚠️ ${state.detailError}`;status.className="m2rd-status err";return;}
    if(!detail){status.textContent="No hay detalle cargado.";status.className="m2rd-status";return;}
    const event=detail.event||{},result=detail.result||{},gps=result.gpsAccuracy||{},meta=detail.trackMeta||{};
    el("m2rdDetailTitle").textContent=event.eventName||"Carrera";
    el("m2rdDetailSubtitle").textContent=`${historyStatusES(result.status)} · ${event.eventId||""}`;
    status.textContent="✅ Resultado histórico cargado desde Firestore.";status.className="m2rd-status ok";
    el("m2rdDetailMetrics").innerHTML=[
      metricCell("ESTADO",historyStatusES(result.status)),metricCell("SALIDA",fmtClock(result.startedAtMs)),metricCell("LLEGADA",fmtClock(result.finishedAtMs)),metricCell("TIEMPO",fmtDuration(result.durationMs)),
      metricCell("RECORRIDO",result.courseId||"—"),metricCell("DISTANCIA REDUCIDA",fmtReducedDistance(result.reducedDistanceKm)),metricCell("DISTANCIA TRACK",fmtDistance(result.trackDistanceM)),metricCell("DESNIVEL +",Number.isFinite(Number(result.coursePositiveM))?`${Math.round(Number(result.coursePositiveM))} m`:"—"),
      metricCell("DIFICULTAD",result.courseDifficulty||"—"),metricCell("RITMO MEDIO",fmtPace(result.paceMinKm)),metricCell("VELOCIDAD MEDIA",fmtSpeed(result.avgSpeedKmh)),metricCell("PUNTOS GPS",`${Number(result.trackPointCount||0)} pts`),
      metricCell("PRECISIÓN MEDIA",fmtAccuracy(gps.averageM)),metricCell("MEJOR GPS",fmtAccuracy(gps.bestM)),metricCell("PEOR GPS",fmtAccuracy(gps.worstM)),metricCell("RUN ID",result.runId||"—")
    ].join("");
    el("m2rdDetailEventMetrics").innerHTML=[
      metricCell("ESCALA",event.planScale?`1:${Number(event.planScale).toLocaleString("es-ES")}`:"—"),metricCell("EQUIDISTANCIA",event.planEquidistanceM?`${event.planEquidistanceM} m`:"—"),metricCell("BALIZAS",String(event.checkpointCount||0)),metricCell("RECORRIDOS",String(event.courseCount||0)),metricCell("PARTICIPANTES PREVISTOS",String(event.participantCount||0)),metricCell("ESTADO EVENTO",statusES(event.status||""))
    ].join("");
    const controls=el("m2rdDetailControls");controls.innerHTML=(detail.checkpoints||[]).map(cp=>`<span class="m2rd-control-chip ${String(cp.type||"").toLowerCase()==="salida"?"start":String(cp.type||"").toLowerCase()==="llegada"?"finish":""}">${esc(cp.type==="SALIDA"?"SALIDA":cp.type==="LLEGADA"?"LLEGADA":cp.checkpointId||"BALIZA")}${cp.elevationM!=null?` · ${esc(cp.elevationM)} m`:""}</span>`).join("")||'<span class="m2rd-detail-note">No hay balizas georreferenciadas guardadas.</span>';
    const trackNote=meta.downsampled?`Firestore conserva ${meta.storedPointCount} puntos. Para que el mapa funcione fluido se muestran ${meta.returnedPointCount} puntos representativos.`:`Track histórico completo · ${meta.storedPointCount||0} puntos almacenados en Firestore.`;
    const courseNote=result.reducedDistanceKm==null&&Number(event.courseCount||0)>1?" · Distancia reducida pendiente de una asignación inequívoca del recorrido al corredor.":" · Distancia reducida = recorrido diseñado; distancia track = GPS real.";
    el("m2rdDetailMapNote").textContent=trackNote+courseNote;
    renderHistoryDetailMap();
  }
  async function openHistoryDetail(eventId){
    if(!eventId||state.detailLoading)return;
    const panel=el("m2rdHistoryDetail");panel.hidden=false;panel.scrollTop=0;state.detailEventId=eventId;state.detailLoading=true;state.detailError="";state.historyDetail=null;
    state.detailRacePlanDescriptor=null;state.detailRacePlanError="";state.detailRacePlanLoading=false;cleanupHistoryRacePlanUrl();
    if(state.detailMap&&state.detailBaseKey==="custom"){await switchHistoryDetailLayer("mapant");}
    const historyRow=state.history.find(row=>String(row.eventId)===String(eventId));el("m2rdDetailTitle").textContent=historyRow?.eventName||"Carrera";el("m2rdDetailSubtitle").textContent=historyRow?`${historyStatusES(historyRow.status)} · ${eventId}`:eventId;renderHistoryDetail();
    try{
      const svc=await services();if(!svc.callable)throw new Error("Backend de detalle histórico no disponible.");
      const response=await svc.callable("getRunnerResultDetail",{eventId,clientVersion:VERSION});
      if(state.detailEventId!==eventId)return;
      state.historyDetail=response?.data||null;
    }catch(error){console.error("[MILITOPO H4 detail]",error);state.detailError=String(error?.message||"No se pudo cargar el detalle de la carrera.");}
    finally{if(state.detailEventId===eventId){state.detailLoading=false;renderHistoryDetail();}}
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
      return `<article class="m2rd-history-row"><div class="m2rd-history-top"><div class="m2rd-history-title"><strong>${esc(row.eventName||"Carrera de orientación")}</strong><div class="m2rd-history-date">${esc(date)} · ${esc(row.eventId||"")}</div></div><span class="m2rd-history-state ${esc(status)}">${esc(historyStatusES(status))}</span></div><div class="m2rd-history-metrics"><div class="m2rd-history-metric"><span>TIEMPO</span><strong>${esc(fmtDuration(row.durationMs))}</strong></div><div class="m2rd-history-metric"><span>DISTANCIA</span><strong>${esc(fmtDistance(row.trackDistanceM))}</strong></div><div class="m2rd-history-metric"><span>GPS</span><strong>${esc(points)} pts</strong></div></div><button class="m2rd-history-detail-btn" type="button" data-history-detail="${esc(row.eventId||"")}">VER DETALLE · MAPA Y TRACK</button></article>`;
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
      state.history=[];state.historySummary={total:0,finished:0,incomplete:0,notStarted:0};
      state.historyError=String(error?.message||"No se pudo consultar tu histórico.");
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
        const ps=String(state.participantStatus||"ready").toLowerCase();
        const liveLabel=ps==="racing"?"EN CARRERA":ps==="finished"?"FINALIZADO":"PREPARADO / SIN SALIR";
        const buttonLabel=ps==="finished"?"VER RESUMEN DE CARRERA":"ENTRAR EN LA CARRERA";
        action=isConnected?`<div class="m2rd-live">✅ CONECTADO · ${liveLabel}</div><button class="m2rd-btn" type="button" data-enter-event="${esc(ev.eventId)}">${buttonLabel}</button>`:`<div class="m2rd-live">Carrera EN DIRECTO. Conectando automáticamente…</div>`;
      }
      else if(String(ev.status)==="finished") action=`<div class="m2rd-note">Carrera finalizada.</div>`;
      else if(String(ev.status)==="prepared") action=`<div class="m2rd-note">La carrera está PREPARADA. Espera a que el organizador la publique.</div>`;
      else action=`<div class="m2rd-note">Esperando a que el organizador inicie la carrera.</div>`;
      const routeAssigned=Boolean(ev.participantId&&ev.routeId);
      const routeBlock=routeAssigned?`<div class="m2rd-route"><div class="m2rd-route-head"><span>🧭 MI RECORRIDO</span><span>${esc(ev.participantId)} · ${esc(ev.routeId)}</span></div><div class="m2rd-route-grid"><span>DISTANCIA<strong>${esc(fmtRouteKm(ev.routeDistanceKm))}</strong></span><span>BALIZAS<strong>${esc(ev.routeControlCount??"—")}</strong></span><span>DESNIVEL +<strong>${ev.routePositiveM==null?"—":`${esc(ev.routePositiveM)} m`}</strong></span><span>DIFICULTAD<strong>${esc(ev.routeDifficulty||"—")}</strong></span></div>${routeSequenceText(ev)?`<div class="m2rd-route-seq">${esc(routeSequenceText(ev))}</div>`:""}</div>`:`<div class="m2rd-note">Recorrido pendiente de asignación.</div>`;
      return `<article class="m2rd-event"><strong>${esc(ev.eventName||"Carrera")}</strong><div class="m2rd-event-meta">${esc(statusES(ev.status))} · ${esc(ev.eventId||"")}</div><span class="m2rd-pill">${esc(statusES(ev.status))}</span>${routeBlock}${action}</article>`;
    }).join("");
  }
  async function loadEvents(force=false,silent=false){
    if(!state.auth||state.auth.role!=="runner") return;
    const retry=el("m2rdRetry"); retry.hidden=true;
    if(!silent) setStatus("Consultando tus carreras Live V2…");
    try{
      const svc=await services(); if(!svc.callable) throw new Error("Backend Live V2 no disponible.");
      const result=await svc.callable("getRunnerLiveEvents",{clientVersion:VERSION});
      state.events=Array.isArray(result?.data?.events)?result.data.events:[]; writeEventsSnapshot(state.events); renderEvents();
      await bindEventWatchers();
      const live=state.events.filter(e=>String(e.status)==="live"&&String(e.liveRunId||"").trim());
      if(live.length===1&&(!state.active||state.active.eventId!==live[0].eventId)) setTimeout(()=>connectLive(live[0]),250);
      else if(!live.length){
        cleanupLive();
        if(state.events.length&&!silent)setStatus(`✅ ${state.events.length} carrera${state.events.length===1?"":"s"} asociada${state.events.length===1?"":"s"} a tu cuenta.`,"ok");
      }
    }catch(error){console.error("[MILITOPO runner dashboard]",error);setStatus(`⚠️ ${String(error?.message||"No se pudieron consultar tus carreras.")}`,"err");retry.hidden=false;}
  }
  function activate(auth, silent=false){
    if(!auth||auth.role!=="runner"){hide();return;}
    const changedUid=String(state.auth?.uid||"")!==String(auth.uid||"");
    state.auth=auth;
    clearTimeout(state.recoveryDeadline); state.recoveryDeadline=null;
    try{localStorage.setItem(LAST_ROLE_KEY,"runner");localStorage.setItem(AUTH_SNAPSHOT_KEY,JSON.stringify(auth));}catch(_){}
    reveal(); paintIdentity(auth);
    const retry=el("m2rdRetry"); retry.textContent="REINTENTAR"; retry.hidden=true;
    if(changedUid || !state.unsubInviteSignals) bindInviteSignals();
    if(changedUid||!state.events.length) loadEvents(false,silent);
    if(changedUid||!state.history.length) loadHistory(silent);
  }
  addEventListener("militopo:v2-auth-ready",e=>activate(e.detail));
  addEventListener("militopo:v2-runner-dashboard",e=>activate(e.detail));
  addEventListener("militopo:v2-auth-signed-out",()=>{
    state.auth=null;state.events=[];state.history=[];state.historySummary={total:0,finished:0,incomplete:0,notStarted:0};state.historyError="";cleanupLive();cleanupEventWatchers();cleanupInviteSignals();hide();
    try{localStorage.removeItem(LAST_ROLE_KEY);localStorage.removeItem(AUTH_SNAPSHOT_KEY);localStorage.removeItem(EVENTS_SNAPSHOT_KEY);}catch(_){}
  });
  addEventListener("pageshow",()=>{if(globalThis.MILITOPO_V2_AUTH?.role==="runner")activate(globalThis.MILITOPO_V2_AUTH);});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&state.auth?.role==="runner"){loadEvents(false,true);loadHistory(true);}});
  addEventListener("focus",()=>{if(state.auth?.role==="runner"){loadEvents(false,true);loadHistory(true);}});
  addEventListener("online",()=>{if(state.auth?.role==="runner"){loadEvents(true,true);loadHistory(true);}});
  addEventListener("militopo:v2-runner-race-closed",event=>{if(state.auth?.role==="runner"){loadEvents(true,true);if(String(event?.detail?.status||"").toLowerCase()==="finished")setTimeout(()=>loadHistory(false),350);}});
  addEventListener("militopo:v2-invitation-accepted",()=>{if(state.auth?.role==="runner")loadEvents(true,false);});
  addEventListener("militopo:v2-inbox-updated",event=>{if(state.auth?.role==="runner" && Number(event?.detail?.pending||0)===0) loadEvents(true,true);});
  try{
    if(localStorage.getItem(LAST_ROLE_KEY)==="runner"){
      reveal();
      const snap=cachedAuth();
      if(snap) paintIdentity(snap);
      const cachedEvents=readEventsSnapshot();
      if(cachedEvents.length){ state.events=cachedEvents; renderEvents(); }
      setStatus("Recuperando tu sesión de corredor…");
      setTimeout(()=>recoverRunnerAuth(),120);
      clearTimeout(state.recoveryDeadline);
      state.recoveryDeadline=setTimeout(async()=>{
        if(state.auth?.uid) return;
        const ok=await recoverRunnerAuth();
        if(!ok){
          const retry=el("m2rdRetry");
          retry.hidden=false; retry.textContent="REINTENTAR SESIÓN";
          setStatus("No se ha podido restaurar la sesión todavía. Reintenta; si Firebase no responde, MILITOPO volverá al acceso seguro.","err");
          setTimeout(()=>{
            if(state.auth?.uid)return;
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
    if(auth?.role==="runner"){
      clearInterval(bootTimer);
      activate(auth,true);
    } else if(bootTries%5===0){
      recoverRunnerAuth();
    }
    if(bootTries>=30) clearInterval(bootTimer);
  },400);
  if(globalThis.MILITOPO_V2_AUTH) queueMicrotask(()=>activate(globalThis.MILITOPO_V2_AUTH,true));
})();
