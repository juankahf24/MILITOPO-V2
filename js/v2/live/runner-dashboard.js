/* MILITOPO V2 · F3A · Runner dashboard sobre la shell autenticada principal.
   No importa Firebase ni vuelve a inicializar Auth: reutiliza el singleton que ya
   ha cargado correctamente la pantalla de login de MILITOPO. */
(function () {
  "use strict";
  const VERSION = "v2-f3b-session-realtimefix-20260923";
  const state = { auth:null, services:null, events:[], active:null, runId:"", participantStatus:"", unsubRun:null, unsubParticipant:null, heartbeat:null, root:null, eventWatchers:new Map() };
  const LAST_ROLE_KEY = "militopo_v2_last_role";
  const AUTH_SNAPSHOT_KEY = "militopo_v2_auth_snapshot";

  const esc = v => String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const statusES = s => ({draft:"BORRADOR",prepared:"PREPARADO",published:"PUBLICADO",live:"EN DIRECTO",finished:"FINALIZADO",archived:"ARCHIVADO"})[String(s||"").toLowerCase()] || String(s||"").toUpperCase();
  const initials = name => { const p=String(name||"").trim().split(/\s+/).filter(Boolean); return ((p[0]?.[0]||"")+(p[1]?.[0]||"")).toUpperCase()||"R"; };


  function cachedAuth(){
    try{const raw=localStorage.getItem(AUTH_SNAPSHOT_KEY);if(!raw)return null;const data=JSON.parse(raw);return data?.role==="runner"?data:null;}catch(_){return null;}
  }
  async function recoverRunnerAuth(){
    if(state.auth?.uid)return true;
    try{
      const svc=await services();
      if(typeof svc.auth?.authStateReady==="function") await Promise.race([svc.auth.authStateReady(),new Promise(resolve=>setTimeout(resolve,5000))]);
      const user=svc.auth?.currentUser;
      if(!user||!user.emailVerified)return false;
      const snap=cachedAuth();
      activate({uid:user.uid,email:user.email||snap?.email||null,displayName:snap?.displayName||user.displayName||null,username:snap?.username||null,role:"runner",emailVerified:true},true);
      return true;
    }catch(error){console.warn("[MILITOPO runner dashboard] auth recovery",error);return false;}
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
      .m2rd-events{display:grid;gap:10px;margin-top:10px}.m2rd-event{border:1px solid rgba(255,255,255,.10);border-radius:16px;background:rgba(255,255,255,.035);padding:13px}.m2rd-event strong{display:block;font-size:.94rem}.m2rd-event-meta{margin-top:4px;color:#b7ad99;font-size:.72rem}.m2rd-pill{display:inline-block;margin-top:8px;padding:5px 9px;border-radius:999px;border:1px solid rgba(126,220,150,.36);color:#e0f6d4;font-size:.68rem;font-weight:900}.m2rd-note{margin-top:9px;padding:9px 10px;border-radius:12px;background:rgba(240,193,106,.08);color:#eadbbf;font-size:.75rem;line-height:1.4}.m2rd-live{margin-top:9px;padding:9px 10px;border-radius:12px;border:1px solid rgba(126,220,150,.28);background:rgba(126,220,150,.10);color:#ddf6d2;font-size:.75rem;font-weight:900}.m2rd-btn{width:100%;min-height:45px;margin-top:9px;border-radius:13px;border:1px solid rgba(126,220,150,.40);background:rgba(126,220,150,.15);color:#efffe8;font:inherit;font-weight:900}.m2rd-btn:disabled{opacity:.48}.m2rd-small{margin-top:10px;color:#978e7e;font-size:.68rem;line-height:1.45}
      @media(max-width:430px){#m2RunnerDashboard{padding-left:9px;padding-right:9px}.m2rd-card{border-radius:22px}}
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
    </div>`;
    document.body.appendChild(root); state.root=root;
    root.querySelector("#m2rdAccount")?.addEventListener("click",()=>document.getElementById("m2AuthAccountBtn")?.click());
    root.querySelector("#m2rdRetry")?.addEventListener("click",()=>loadEvents(true));
    root.addEventListener("click",e=>{const btn=e.target.closest("[data-enter-event]"); if(!btn)return; const id=btn.dataset.enterEvent||""; const event=state.events.find(row=>row.eventId===id); if(!event||!state.runId)return; window.dispatchEvent(new CustomEvent("militopo:v2-open-runner-race",{detail:{event:{...event},runId:state.runId,auth:{...state.auth}}}));});
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
  async function services(){ if(!state.services) state.services=await globalThis.MILITOPO_V2.firebase(); return state.services; }
  async function bindEventWatchers(){
    cleanupEventWatchers();
    if(!state.auth?.uid || !state.events.length) return;
    try{
      const svc=await services(), api=svc.databaseApi;
      if(!api) return;
      for(const event of state.events){
        if(!event?.ownerUid || !event?.eventId) continue;
        const activeRef=api.ref(`v2/live/${event.ownerUid}/${event.eventId}/activeRun`);
        const unsubscribe=api.onValue(activeRef,snap=>{
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
        },error=>console.warn("[MILITOPO runner dashboard] activeRun watcher",event.eventId,error));
        state.eventWatchers.set(event.eventId,unsubscribe);
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
      return `<article class="m2rd-event"><strong>${esc(ev.eventName||"Carrera")}</strong><div class="m2rd-event-meta">${esc(statusES(ev.status))} · ${esc(ev.eventId||"")}</div><span class="m2rd-pill">${esc(statusES(ev.status))}</span>${action}</article>`;
    }).join("");
  }
  async function loadEvents(force=false,silent=false){
    if(!state.auth||state.auth.role!=="runner") return;
    const retry=el("m2rdRetry"); retry.hidden=true;
    if(!silent) setStatus("Consultando tus carreras Live V2…");
    try{
      const svc=await services(); if(!svc.callable) throw new Error("Backend Live V2 no disponible.");
      const result=await svc.callable("getRunnerLiveEvents",{clientVersion:VERSION});
      state.events=Array.isArray(result?.data?.events)?result.data.events:[]; renderEvents();
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
    try{localStorage.setItem(LAST_ROLE_KEY,"runner");localStorage.setItem(AUTH_SNAPSHOT_KEY,JSON.stringify(auth));}catch(_){}
    reveal(); paintIdentity(auth);
    if(changedUid||!state.events.length) loadEvents(false,silent);
  }
  addEventListener("militopo:v2-auth-ready",e=>activate(e.detail));
  addEventListener("militopo:v2-runner-dashboard",e=>activate(e.detail));
  addEventListener("militopo:v2-auth-signed-out",()=>{
    state.auth=null;state.events=[];cleanupLive();cleanupEventWatchers();hide();
    try{localStorage.removeItem(LAST_ROLE_KEY);localStorage.removeItem(AUTH_SNAPSHOT_KEY);}catch(_){}
  });
  addEventListener("pageshow",()=>{if(globalThis.MILITOPO_V2_AUTH?.role==="runner")activate(globalThis.MILITOPO_V2_AUTH);});
  document.addEventListener("visibilitychange",()=>{if(!document.hidden&&state.auth?.role==="runner")loadEvents(false,true);});
  addEventListener("focus",()=>{if(state.auth?.role==="runner")loadEvents(false,true);});
  addEventListener("online",()=>{if(state.auth?.role==="runner")loadEvents(true,true);});
  addEventListener("militopo:v2-invitation-accepted",()=>{if(state.auth?.role==="runner")loadEvents(true,false);});
  addEventListener("militopo:v2-inbox-updated",event=>{if(state.auth?.role==="runner" && Number(event?.detail?.pending||0)===0) loadEvents(true,true);});
  try{
    if(localStorage.getItem(LAST_ROLE_KEY)==="runner"){
      reveal();
      const snap=cachedAuth();
      if(snap) paintIdentity(snap);
      setStatus("Recuperando tu sesión de corredor…");
      setTimeout(()=>recoverRunnerAuth(),120);
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
