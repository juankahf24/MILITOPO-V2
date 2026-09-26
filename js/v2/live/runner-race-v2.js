/* MILITOPO V2 · G3 · Carrera + GPS + track offline + recuperación de sesión.
   Live V2 es el único flujo activo. El GPS solo se comparte durante la carrera. */
(function(){
  "use strict";
  const VERSION="v2-h6-9-coordinated-finish-summary-20260926";
  const state={root:null,services:null,event:null,auth:null,runId:"",participant:null,controlPlan:null,unsubParticipant:null,unsubActive:null,timer:null,busy:false,gpsTried:false,recovered:false,localArrivalAt:0,autoFinishing:false,summaryOpen:false};
  const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const statusLabel=s=>({not_started:"PREPARADO",ready:"PREPARADO",racing:"EN CARRERA",started:"EN CARRERA",finished:"FINALIZADO"})[String(s||"").toLowerCase()]||String(s||"").toUpperCase();
  const fmtClock=ms=>{const sec=Math.max(0,Math.floor(ms/1000)),h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return h?`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;};
  const fmtTime=v=>{const n=Number(v||0);if(!n)return "—";try{return new Intl.DateTimeFormat("es-ES",{hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date(n));}catch(_){return "—";}};
  const fmtKm=v=>Number.isFinite(Number(v))?`${Number(v).toFixed(2)} km`:"—";
  const routeSequence=v=>(Array.isArray(v)?v:[]).map(raw=>{const key=String(raw||"").trim(),upper=key.toUpperCase();return upper==="START"||upper==="SALIDA"?"S":upper==="FINISH"||upper==="LLEGADA"?"L":key;}).filter(Boolean).join(" → ");
  async function services(){if(!state.services)state.services=await globalThis.MILITOPO_V2.firebase();return state.services;}
  function gpsApi(){return globalThis.MILITOPO_RUNNER_GPS_V2||null;}
  function trackApi(){return globalThis.MILITOPO_RUNNER_TRACK_V2||null;}
  function controlsApi(){return globalThis.MILITOPO_RUNNER_CONTROLS_V2||null;}
  function gpsContext(){return {ownerUid:state.event?.ownerUid||"",eventId:state.event?.eventId||"",runId:state.runId,uid:state.auth?.uid||""};}
  function installStyle(){if(document.getElementById("m2RaceV2Style"))return;const s=document.createElement("style");s.id="m2RaceV2Style";s.textContent=`
    #m2RaceV2{position:fixed;inset:0;z-index:100120;background:linear-gradient(180deg,#07110b,#09170e 44%,#050b07);color:#f7f2e8;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:auto;padding:calc(env(safe-area-inset-top) + 14px) 14px calc(env(safe-area-inset-bottom) + 24px)}#m2RaceV2[hidden]{display:none!important}
    .m2race-shell{width:min(720px,100%);margin:0 auto;display:grid;gap:14px}.m2race-top{display:flex;align-items:center;gap:12px}.m2race-back{width:44px;height:44px;border-radius:14px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;font-size:1.25rem}.m2race-brand{min-width:0;flex:1}.m2race-kicker{font-size:.68rem;letter-spacing:.16em;color:#93bb82;font-weight:800}.m2race-title{margin:3px 0 0;font-size:clamp(1.25rem,6vw,2rem);line-height:1.08;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.m2race-live{display:flex;align-items:center;gap:7px;padding:8px 10px;border-radius:999px;background:rgba(86,180,112,.11);border:1px solid rgba(105,220,136,.22);font-size:.7rem;font-weight:800;color:#bce8c7}.m2race-dot{width:8px;height:8px;border-radius:50%;background:#73d58d;box-shadow:0 0 0 5px rgba(115,213,141,.10)}
    .m2race-card{border:1px solid rgba(255,255,255,.09);border-radius:24px;background:linear-gradient(180deg,rgba(21,42,28,.96),rgba(10,23,15,.98));box-shadow:0 18px 50px rgba(0,0,0,.25);padding:18px}.m2race-hero{padding:24px 18px;text-align:center;background:radial-gradient(circle at 50% 0,rgba(137,197,110,.19),transparent 42%),linear-gradient(180deg,rgba(22,49,30,.98),rgba(9,22,14,.98))}.m2race-route-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.m2race-route-title{font-size:.72rem;font-weight:900;letter-spacing:.10em;color:#e8efdd}.m2race-route-id{padding:6px 9px;border-radius:999px;border:1px solid rgba(232,191,99,.32);background:rgba(232,191,99,.10);font-size:.65rem;font-weight:900;color:#f5d995}.m2race-route-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:10px}.m2race-route-stat{padding:9px 7px;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07)}.m2race-route-stat span{display:block;font-size:.55rem;letter-spacing:.07em;color:#89988c}.m2race-route-stat strong{display:block;margin-top:4px;font-size:.76rem;color:#eef4e8;overflow-wrap:anywhere}.m2race-route-seq{margin-top:10px;padding:9px 10px;border-radius:12px;background:rgba(0,0,0,.12);color:#bdc9bf;font-size:.68rem;line-height:1.5;overflow-wrap:anywhere}.m2race-state{display:inline-flex;padding:7px 12px;border-radius:999px;border:1px solid rgba(144,212,116,.32);background:rgba(144,212,116,.10);font-size:.72rem;font-weight:900;letter-spacing:.08em;color:#d9f1ce}.m2race-state.racing{color:#d8edff;border-color:rgba(94,169,235,.35);background:rgba(74,134,197,.12)}.m2race-state.finished{color:#f7e5ad;border-color:rgba(230,191,90,.35);background:rgba(190,148,47,.12)}.m2race-time{font-size:clamp(2.8rem,14vw,5.3rem);font-variant-numeric:tabular-nums;font-weight:800;letter-spacing:-.05em;margin:14px 0 2px}.m2race-time-label{font-size:.68rem;letter-spacing:.13em;color:#89998d;font-weight:800}.m2race-event{margin-top:15px;color:#b9c6bc;font-size:.82rem}.m2race-event strong{color:#fff}.m2race-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.m2race-stat{padding:14px;border-radius:18px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07)}.m2race-stat span{display:block;font-size:.63rem;letter-spacing:.11em;color:#849488;font-weight:800}.m2race-stat strong{display:block;margin-top:7px;font-size:1rem}.m2race-action{width:100%;min-height:62px;border:0;border-radius:20px;font:inherit;font-size:1rem;font-weight:900;letter-spacing:.04em}.m2race-start{background:linear-gradient(180deg,#b9df80,#8fbe5e);color:#10200d;box-shadow:0 12px 30px rgba(117,171,77,.22)}.m2race-finish{background:linear-gradient(180deg,#e8bf63,#c89537);color:#281b07}.m2race-action:disabled{opacity:.52;filter:saturate(.4)}.m2race-note{margin-top:10px;text-align:center;color:#8e9b91;font-size:.7rem;line-height:1.45}.m2race-confirm{display:none;margin-top:12px;padding:14px;border-radius:18px;background:rgba(229,174,67,.08);border:1px solid rgba(229,174,67,.22)}.m2race-confirm.open{display:block}.m2race-confirm p{margin:0 0 10px;font-size:.78rem;color:#e7d6ad}.m2race-confirm-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.m2race-mini{min-height:44px;border-radius:13px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;font:inherit;font-weight:800}.m2race-mini.primary{background:rgba(229,174,67,.16);border-color:rgba(229,174,67,.38);color:#ffe4a7}
    .m2race-gps{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px}.m2race-gps-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:14px;background:rgba(97,171,229,.10);border:1px solid rgba(97,171,229,.22);font-size:1.2rem}.m2race-gps-title{font-size:.72rem;font-weight:900;letter-spacing:.08em}.m2race-gps-text{margin-top:4px;color:#93a29a;font-size:.69rem;line-height:1.35}.m2race-gps-pill{padding:6px 9px;border-radius:999px;border:1px solid rgba(255,255,255,.12);font-size:.58rem;font-weight:900;color:#dce8de}.m2race-gps-pill.ok{color:#cceec7;border-color:rgba(113,214,135,.28);background:rgba(113,214,135,.08)}.m2race-gps-pill.warn{color:#ffe3a8;border-color:rgba(235,184,80,.32);background:rgba(235,184,80,.08)}.m2race-gps-btn{grid-column:1/-1;width:100%;min-height:44px;border-radius:14px;border:1px solid rgba(105,176,231,.28);background:rgba(70,139,194,.10);color:#dcedfb;font:inherit;font-size:.72rem;font-weight:900}
    .m2race-track{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px}.m2race-track-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:14px;background:rgba(193,160,73,.10);border:1px solid rgba(193,160,73,.22);font-size:1.1rem}.m2race-track-title{font-size:.72rem;font-weight:900;letter-spacing:.08em}.m2race-track-text{margin-top:4px;color:#93a29a;font-size:.69rem;line-height:1.35}.m2race-track-pill{padding:6px 9px;border-radius:999px;border:1px solid rgba(255,255,255,.12);font-size:.58rem;font-weight:900}.m2race-track-pill.ok{color:#cceec7;border-color:rgba(113,214,135,.28);background:rgba(113,214,135,.08)}.m2race-track-pill.warn{color:#ffe3a8;border-color:rgba(235,184,80,.32);background:rgba(235,184,80,.08)}
    .m2race-resilience{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px}.m2race-resilience-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:14px;background:rgba(134,201,116,.10);border:1px solid rgba(134,201,116,.22);font-size:1.1rem}.m2race-resilience-title{font-size:.72rem;font-weight:900;letter-spacing:.08em}.m2race-resilience-text{margin-top:4px;color:#93a29a;font-size:.69rem;line-height:1.35}.m2race-resilience-pill{padding:6px 9px;border-radius:999px;border:1px solid rgba(255,255,255,.12);font-size:.58rem;font-weight:900}.m2race-resilience-pill.ok{color:#cceec7;border-color:rgba(113,214,135,.28);background:rgba(113,214,135,.08)}.m2race-resilience-pill.warn{color:#ffe3a8;border-color:rgba(235,184,80,.32);background:rgba(235,184,80,.08)}
    .m2race-control-card{border-color:rgba(235,192,91,.25);background:radial-gradient(circle at 82% 5%,rgba(235,192,91,.13),transparent 34%),linear-gradient(180deg,rgba(24,43,27,.98),rgba(9,22,14,.98))}.m2race-control-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.m2race-control-kicker{font-size:.68rem;letter-spacing:.12em;font-weight:900;color:#f0cf83}.m2race-control-progress{font-size:.63rem;color:#a8b6aa;font-weight:800}.m2race-next{text-align:center;margin:13px 0 6px;font-size:clamp(2.2rem,13vw,4.5rem);line-height:1;font-weight:950;letter-spacing:-.03em;color:#f7df9b}.m2race-next.complete{font-size:clamp(1.45rem,7vw,2.25rem);color:#bce8c7}.m2race-control-meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.m2race-control-meta div{padding:10px;border-radius:13px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07)}.m2race-control-meta span{display:block;font-size:.55rem;letter-spacing:.08em;color:#85938a}.m2race-control-meta strong{display:block;margin-top:4px;font-size:.78rem}.m2race-control-status{margin-top:10px;min-height:38px;padding:10px;border-radius:13px;background:rgba(0,0,0,.14);color:#aebcb1;font-size:.7rem;line-height:1.35}.m2race-control-status.ok{color:#d5f0cf;border:1px solid rgba(117,211,137,.22)}.m2race-control-status.warn{color:#ffe3a8;border:1px solid rgba(235,184,80,.25)}.m2race-qr-btn{position:relative;z-index:6;pointer-events:auto;touch-action:manipulation;-webkit-user-select:none;user-select:none;width:100%;min-height:48px;margin-top:10px;border-radius:15px;border:1px solid rgba(235,192,91,.36);background:rgba(235,192,91,.11);color:#f8e2ad;font:inherit;font-size:.76rem;font-weight:900;letter-spacing:.04em}.m2race-qr-fallback{display:flex;align-items:center;justify-content:center;width:100%;min-height:42px;margin-top:8px;border-radius:12px;border:1px dashed rgba(235,192,91,.28);background:rgba(235,192,91,.07);color:#f3d896;font-size:.68rem;font-weight:900;cursor:pointer;touch-action:manipulation}.m2race-qr-panel{margin-top:11px;padding:10px;border-radius:16px;background:#050806;border:1px solid rgba(255,255,255,.10)}.m2race-qr-panel[hidden]{display:none!important}.m2race-qr-video{width:100%;max-height:48vh;border-radius:13px;background:#000;object-fit:cover}.m2race-qr-status{padding:8px 4px 3px;color:#b9c6bc;font-size:.68rem;line-height:1.35}.m2race-qr-close{width:100%;min-height:42px;margin-top:8px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;font:inherit;font-size:.7rem;font-weight:900}.m2race-start-confirm{position:fixed;inset:0;z-index:100140;display:none;align-items:flex-end;justify-content:center;padding:18px;background:rgba(2,7,4,.74);backdrop-filter:blur(10px)}.m2race-start-confirm.open{display:flex}.m2race-start-sheet{width:min(520px,100%);border-radius:28px;padding:22px;background:linear-gradient(180deg,#17301f,#0a1710);border:1px solid rgba(190,226,137,.22);box-shadow:0 28px 80px rgba(0,0,0,.5);animation:m2raceSheetIn .22s ease-out}.m2race-start-icon{width:58px;height:58px;margin:0 auto 13px;display:grid;place-items:center;border-radius:20px;background:rgba(176,220,116,.13);border:1px solid rgba(176,220,116,.28);font-size:1.65rem}.m2race-start-sheet h2{margin:0;text-align:center;font-size:1.25rem}.m2race-start-sheet p{margin:9px auto 16px;max-width:400px;text-align:center;color:#a9b7ad;font-size:.78rem;line-height:1.45}.m2race-start-choice{display:grid;grid-template-columns:1fr 1.35fr;gap:9px}.m2race-start-choice button{min-height:52px;border-radius:16px;font:inherit;font-weight:900;border:1px solid rgba(255,255,255,.11)}.m2race-start-no{background:rgba(255,255,255,.06);color:#e9eee9}.m2race-start-yes{background:linear-gradient(180deg,#c2e887,#91c15c);color:#10200d;border:0!important}@keyframes m2raceSheetIn{from{transform:translateY(18px);opacity:.35}to{transform:translateY(0);opacity:1}}
    .m2race-sync{display:flex;align-items:center;gap:9px;font-size:.74rem;color:#aebbb1}.m2race-sync strong{color:#dce8de}.m2race-sync-dot{width:9px;height:9px;border-radius:50%;background:#75d38d}.m2race-result{text-align:center}.m2race-result-icon{font-size:2.4rem}.m2race-result h2{margin:8px 0 4px;font-size:1.35rem}.m2race-result p{margin:0;color:#9eaaa1;font-size:.78rem}.m2race-busy{position:fixed;inset:0;z-index:100130;display:none;place-items:center;background:rgba(3,8,5,.76);backdrop-filter:blur(8px)}.m2race-busy.open{display:grid}.m2race-busy-card{width:min(86vw,380px);border-radius:24px;background:#0f2015;border:1px solid rgba(144,212,116,.24);padding:22px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.4)}.m2race-spinner{width:34px;height:34px;border-radius:50%;border:3px solid rgba(255,255,255,.12);border-top-color:#a9d77d;margin:0 auto 12px;animation:m2spin .8s linear infinite}@keyframes m2spin{to{transform:rotate(360deg)}}.m2race-busy-card strong{display:block}.m2race-busy-card span{display:block;margin-top:5px;color:#91a095;font-size:.72rem}
    .m2race-summary{position:fixed;inset:0;z-index:100150;display:none;align-items:flex-end;justify-content:center;padding:18px;background:rgba(2,7,4,.78);backdrop-filter:blur(12px)}.m2race-summary.open{display:flex}.m2race-summary-sheet{width:min(560px,100%);max-height:88vh;overflow:auto;border-radius:30px 30px 22px 22px;padding:22px;background:linear-gradient(180deg,#173321,#08160e);border:1px solid rgba(185,225,128,.25);box-shadow:0 30px 90px rgba(0,0,0,.55)}.m2race-summary-check{width:66px;height:66px;margin:0 auto 12px;display:grid;place-items:center;border-radius:22px;background:rgba(133,216,119,.14);border:1px solid rgba(133,216,119,.30);font-size:2rem}.m2race-summary h2{margin:0;text-align:center;font-size:1.45rem}.m2race-summary-sub{margin:7px 0 18px;text-align:center;color:#aab8ae;font-size:.76rem;line-height:1.4}.m2race-summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.m2race-summary-stat{padding:12px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}.m2race-summary-stat span{display:block;font-size:.56rem;letter-spacing:.08em;color:#829287;font-weight:800}.m2race-summary-stat strong{display:block;margin-top:5px;font-size:.9rem;color:#f2f5ef}.m2race-summary-ranks{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.m2race-summary-rank{padding:13px;border-radius:16px;background:rgba(231,190,91,.08);border:1px solid rgba(231,190,91,.20);text-align:center}.m2race-summary-rank span{display:block;font-size:.56rem;color:#c8b47e;letter-spacing:.08em}.m2race-summary-rank strong{display:block;margin-top:5px;font-size:1.05rem;color:#ffe4a5}.m2race-summary-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:15px}.m2race-summary-actions button{min-height:50px;border-radius:15px;font:inherit;font-weight:900}.m2race-summary-close{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff}.m2race-summary-done{border:0;background:linear-gradient(180deg,#c2e887,#91c15c);color:#10200d}
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
      <section class="m2race-card"><div class="m2race-route-head"><div class="m2race-route-title">🧭 MI RECORRIDO ASIGNADO</div><div id="m2raceRouteId" class="m2race-route-id">—</div></div><div class="m2race-route-grid"><div class="m2race-route-stat"><span>DISTANCIA REDUCIDA</span><strong id="m2raceRouteDistance">—</strong></div><div class="m2race-route-stat"><span>BALIZAS</span><strong id="m2raceRouteControls">—</strong></div><div class="m2race-route-stat"><span>DESNIVEL +</span><strong id="m2raceRouteClimb">—</strong></div><div class="m2race-route-stat"><span>DIFICULTAD</span><strong id="m2raceRouteDifficulty">—</strong></div></div><div id="m2raceRouteSequence" class="m2race-route-seq">Esperando recorrido…</div></section>
      <section id="m2raceControlCard" class="m2race-card m2race-control-card" hidden><div class="m2race-control-head"><div class="m2race-control-kicker">🎯 SIGUIENTE BALIZA</div><div id="m2raceControlProgress" class="m2race-control-progress">0 / 0</div></div><div id="m2raceNextControl" class="m2race-next">—</div><div class="m2race-control-meta"><div><span>DISTANCIA GPS</span><strong id="m2raceControlDistance">—</strong></div><div><span>VALIDACIÓN</span><strong id="m2raceControlMethod">GPS + QR</strong></div></div><div id="m2raceControlStatus" class="m2race-control-status">GPS: precisión ±10 m o mejor y distancia ≤10 m. El QR puede escanearse en cualquier ubicación como respaldo.</div><button id="m2raceQrOpen" class="m2race-qr-btn" type="button">📷 ESCANEAR QR DE LA BALIZA</button><div id="m2raceQrPanel" class="m2race-qr-panel" hidden><video id="m2raceQrVideo" class="m2race-qr-video" playsinline muted></video><canvas id="m2raceQrCanvas" hidden></canvas><div id="m2raceQrStatus" class="m2race-qr-status">Preparando cámara…</div><label class="m2race-qr-fallback" for="m2raceQrPhoto">📸 USAR CÁMARA NATIVA DEL MÓVIL<input id="m2raceQrPhoto" type="file" accept="image/*" capture="environment" hidden></label><button id="m2raceQrClose" class="m2race-qr-close" type="button">CERRAR CÁMARA</button></div></section>
      <section class="m2race-card"><div class="m2race-grid"><div class="m2race-stat"><span>SALIDA</span><strong id="m2raceStartAt">—</strong></div><div class="m2race-stat"><span>LLEGADA</span><strong id="m2raceFinishAt">—</strong></div></div></section>
      <section class="m2race-card"><div class="m2race-gps"><div class="m2race-gps-icon">◎</div><div><div class="m2race-gps-title">GPS DE CARRERA</div><div id="m2raceGpsText" class="m2race-gps-text">El GPS se activa al iniciar el recorrido.</div></div><span id="m2raceGpsPill" class="m2race-gps-pill">ESPERANDO</span><button id="m2raceGpsActivate" class="m2race-gps-btn" type="button" hidden>ACTIVAR GPS</button></div></section>
      <section class="m2race-card"><div class="m2race-track"><div class="m2race-track-icon">↝</div><div><div class="m2race-track-title">TRACK DEL RECORRIDO</div><div id="m2raceTrackText" class="m2race-track-text">Preparado para guardar tu recorrido.</div></div><span id="m2raceTrackPill" class="m2race-track-pill">LISTO</span></div></section>
      <section class="m2race-card"><div class="m2race-resilience"><div class="m2race-resilience-icon">⟳</div><div><div class="m2race-resilience-title">CONTINUIDAD DE CARRERA</div><div id="m2raceResilienceText" class="m2race-resilience-text">MILITOPO puede recuperar esta carrera si recargas la aplicación.</div></div><span id="m2raceResiliencePill" class="m2race-resilience-pill">PROTEGIDO</span></div></section>
      <section id="m2raceActionCard" class="m2race-card"><button id="m2raceStart" class="m2race-action m2race-start" type="button">INICIAR RECORRIDO</button><button id="m2raceFinish" class="m2race-action m2race-finish" type="button" hidden>TERMINAR CARRERA</button><div id="m2raceConfirm" class="m2race-confirm"><p>¿Quieres terminar la carrera ahora? Si faltan balizas o no has validado LLEGADA, el resultado quedará registrado como INCOMPLETO.</p><div class="m2race-confirm-actions"><button id="m2raceCancelFinish" class="m2race-mini" type="button">SEGUIR CORRIENDO</button><button id="m2raceConfirmFinish" class="m2race-mini primary" type="button">SÍ · TERMINAR</button></div></div><div id="m2raceActionNote" class="m2race-note">La llegada puede finalizar automáticamente por GPS o QR. También puedes terminar manualmente la carrera cuando lo necesites.</div></section>
      <section class="m2race-card"><div class="m2race-sync"><span class="m2race-sync-dot"></span><div><strong id="m2raceSyncTitle">Sincronización activa</strong><br><span id="m2raceSyncText">Conectado a Realtime Database V2.</span></div></div></section>
      <section id="m2raceResult" class="m2race-card m2race-result" hidden><div class="m2race-result-icon">✓</div><h2>Recorrido finalizado</h2><p id="m2raceResultText">La llegada ha quedado registrada y sincronizada con el organizador.</p></section>
    </div>
    <div id="m2raceStartConfirm" class="m2race-start-confirm" role="dialog" aria-modal="true" aria-labelledby="m2raceStartConfirmTitle"><div class="m2race-start-sheet"><div class="m2race-start-icon">🏁</div><h2 id="m2raceStartConfirmTitle">¿Estás preparado para iniciar?</h2><p>Al confirmar empieza tu tiempo oficial, se activa el GPS de carrera y el organizador recibe tu salida.</p><div class="m2race-start-choice"><button id="m2raceStartNo" class="m2race-start-no" type="button">TODAVÍA NO</button><button id="m2raceStartYes" class="m2race-start-yes" type="button">SÍ · INICIAR AHORA</button></div></div></div>
    <div id="m2raceSummary" class="m2race-summary" role="dialog" aria-modal="true" aria-labelledby="m2raceSummaryTitle"><div class="m2race-summary-sheet"><div class="m2race-summary-check">✓</div><h2 id="m2raceSummaryTitle">Carrera terminada</h2><p id="m2raceSummarySub" class="m2race-summary-sub">Resultado sincronizado correctamente.</p><div class="m2race-summary-grid"><div class="m2race-summary-stat"><span>TIEMPO OFICIAL</span><strong id="m2sumTime">—</strong></div><div class="m2race-summary-stat"><span>DISTANCIA GPS</span><strong id="m2sumTrack">—</strong></div><div class="m2race-summary-stat"><span>DISTANCIA REDUCIDA</span><strong id="m2sumReduced">—</strong></div><div class="m2race-summary-stat"><span>BALIZAS</span><strong id="m2sumControls">—</strong></div><div class="m2race-summary-stat"><span>VELOCIDAD MEDIA</span><strong id="m2sumSpeed">—</strong></div><div class="m2race-summary-stat"><span>RITMO MEDIO</span><strong id="m2sumPace">—</strong></div><div class="m2race-summary-stat"><span>PUNTOS GPS</span><strong id="m2sumPoints">—</strong></div><div class="m2race-summary-stat"><span>LLEGADA</span><strong id="m2sumArrival">—</strong></div></div><div class="m2race-summary-ranks"><div class="m2race-summary-rank"><span>CLASIFICACIÓN GENERAL</span><strong id="m2sumGeneralRank">—</strong></div><div class="m2race-summary-rank"><span id="m2sumRouteLabel">MI RECORRIDO</span><strong id="m2sumRouteRank">—</strong></div></div><div class="m2race-summary-actions"><button id="m2raceSummaryClose" class="m2race-summary-close" type="button">SEGUIR VIENDO</button><button id="m2raceSummaryDone" class="m2race-summary-done" type="button">VOLVER A MIS CARRERAS</button></div></div></div>
    <div id="m2raceBusy" class="m2race-busy"><div class="m2race-busy-card"><div class="m2race-spinner"></div><strong id="m2raceBusyTitle">Procesando…</strong><span id="m2raceBusyText">Sincronizando con Live V2.</span></div></div>`;
    document.body.appendChild(root);state.root=root;
    root.querySelector("#m2raceBack").addEventListener("click",close);
    root.querySelector("#m2raceStart").addEventListener("click",()=>root.querySelector("#m2raceStartConfirm").classList.add("open"));
    root.querySelector("#m2raceFinish").addEventListener("click",()=>root.querySelector("#m2raceConfirm").classList.add("open"));
    root.querySelector("#m2raceStartNo").addEventListener("click",()=>root.querySelector("#m2raceStartConfirm").classList.remove("open"));
    root.querySelector("#m2raceStartYes").addEventListener("click",()=>{root.querySelector("#m2raceStartConfirm").classList.remove("open");startRace();});
    root.querySelector("#m2raceCancelFinish").addEventListener("click",()=>root.querySelector("#m2raceConfirm").classList.remove("open"));
    root.querySelector("#m2raceConfirmFinish").addEventListener("click",finishRace);
    root.querySelector("#m2raceGpsActivate").addEventListener("click",activateGps);
    root.querySelector("#m2raceQrClose").addEventListener("click",closeQrScanner);
    root.querySelector("#m2raceSummaryClose").addEventListener("click",()=>{root.querySelector("#m2raceSummary").classList.remove("open");state.summaryOpen=false;});
    root.querySelector("#m2raceSummaryDone").addEventListener("click",()=>{root.querySelector("#m2raceSummary").classList.remove("open");state.summaryOpen=false;close();});
    root.querySelector("#m2raceQrPhoto").addEventListener("change",async event=>{
      const file=event.target?.files?.[0]||null,status=root.querySelector("#m2raceQrStatus"),api=controlsApi();
      if(!file)return;
      if(status)status.textContent="Leyendo QR desde la cámara del móvil…";
      try{await api?.scanImageFile?.(file,{canvas:root.querySelector("#m2raceQrCanvas"),statusEl:status});}
      catch(error){if(status)status.textContent=`No se pudo leer la imagen: ${String(error?.message||error)}`;}
      finally{try{event.target.value="";}catch(_){}}
    });
    return root;
  }
  const el=id=>ensureRoot().querySelector("#"+id);
  function busy(title,text){state.busy=true;el("m2raceBusyTitle").textContent=title;el("m2raceBusyText").textContent=text;el("m2raceBusy").classList.add("open");}
  function unbusy(){state.busy=false;el("m2raceBusy").classList.remove("open");}
  const fmtTrackKm=m=>Number.isFinite(Number(m))?`${(Number(m)/1000).toFixed(2)} km`:"—";
  const fmtPace=v=>{const n=Number(v);if(!Number.isFinite(n)||n<=0)return "—";const min=Math.floor(n),sec=Math.round((n-min)*60);return `${min}:${String(sec===60?0:sec).padStart(2,"0")} min/km`;};
  async function showFinishSummary({incomplete=false}={}){
    const panel=el("m2raceSummary");if(!panel)return;state.summaryOpen=true;
    el("m2raceSummaryTitle").textContent=incomplete?"Carrera terminada · INCOMPLETA":"Carrera terminada ✓";
    el("m2raceSummarySub").textContent=incomplete?"La carrera se ha cerrado y sincronizado, pero faltaban controles o LLEGADA.":"Balizas, llegada, track y resultado están sincronizados con el organizador.";
    const basic=state.participant||{};
    el("m2sumTime").textContent=basic.startedAt&&basic.finishedAt?fmtClock(Math.max(0,Number(basic.finishedAt)-Number(basic.startedAt))):"—";
    el("m2sumReduced").textContent=fmtKm(basic.routeDistanceKm);
    const cs=controlsApi()?.snapshot?.()||{};el("m2sumControls").textContent=`${Math.max(0,Number(cs.serverCompletedCount??cs.completedCount??0))} / ${Math.max(0,Number(cs.expectedCount||basic.routeControlCount||0))}`;
    el("m2sumArrival").textContent=fmtTime(basic.finishedAt||state.localArrivalAt);
    ["m2sumTrack","m2sumSpeed","m2sumPace","m2sumPoints","m2sumGeneralRank","m2sumRouteRank"].forEach(id=>el(id).textContent="—");
    el("m2sumRouteLabel").textContent=basic.routeId?`${basic.routeId} · MI RECORRIDO`:"MI RECORRIDO";
    panel.classList.add("open");
    try{
      const svc=await services();
      const [detailRes,classRes]=await Promise.allSettled([svc.callable("getRunnerResultDetail",{eventId:state.event.eventId}),svc.callable("getEventClassification",{eventId:state.event.eventId})]);
      if(detailRes.status==="fulfilled"){const r=detailRes.value?.data?.result||{};el("m2sumTime").textContent=r.durationMs!=null?fmtClock(r.durationMs):el("m2sumTime").textContent;el("m2sumTrack").textContent=fmtTrackKm(r.trackDistanceM);el("m2sumReduced").textContent=r.reducedDistanceKm==null?el("m2sumReduced").textContent:fmtKm(r.reducedDistanceKm);el("m2sumControls").textContent=`${Math.max(0,Number(r.controlDetectedCount||0))} / ${Math.max(0,Number(r.controlExpectedCount||0))}`;el("m2sumSpeed").textContent=r.avgSpeedKmh==null?"—":`${Number(r.avgSpeedKmh).toFixed(2)} km/h`;el("m2sumPace").textContent=fmtPace(r.paceMinKm);el("m2sumPoints").textContent=String(Math.max(0,Number(r.trackPointCount||0)));el("m2sumArrival").textContent=fmtTime(r.finishedAtMs||basic.finishedAt||state.localArrivalAt);}
      if(classRes.status==="fulfilled"){const c=classRes.value?.data||{},my=c.my||{};el("m2sumGeneralRank").textContent=my.generalRank?`${my.generalRank}º / ${Math.max(1,Number(my.generalCount||0))}`:"—";el("m2sumRouteLabel").textContent=my.routeId?`${my.routeId} · MI RECORRIDO`:el("m2sumRouteLabel").textContent;el("m2sumRouteRank").textContent=my.routeRank?`${my.routeRank}º / ${Math.max(1,Number(my.routeCount||0))}`:"—";}
    }catch(_){}
  }
  function clearListeners(){try{state.unsubParticipant?.();}catch(_){}try{state.unsubActive?.();}catch(_){}state.unsubParticipant=null;state.unsubActive=null;if(state.timer){clearInterval(state.timer);state.timer=null;}}
  function close(){if(state.busy)return;controlsApi()?.closeScanner?.();ensureRoot().hidden=true;document.body.style.overflow="";window.dispatchEvent(new CustomEvent("militopo:v2-runner-race-closed",{detail:{event:state.event?{...state.event}:null,runId:state.runId,status:String(state.participant?.status||"")}}));}
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
  function fmtMeters(v){const n=Number(v);return Number.isFinite(n)&&n>=0?`${Math.round(n)} m`:"—";}
  function updateControlUi(status="status",detail={}){
    const api=controlsApi(),snap=api?.snapshot?.()||{},card=el("m2raceControlCard"),nextEl=el("m2raceNextControl"),progressEl=el("m2raceControlProgress"),distanceEl=el("m2raceControlDistance"),statusEl=el("m2raceControlStatus"),qrBtn=el("m2raceQrOpen"),kicker=card?.querySelector(".m2race-control-kicker");
    if(!card)return;
    const raceStatus=String(state.participant?.status||snap.raceStatus||"").toLowerCase(),active=["racing","started"].includes(raceStatus);
    card.hidden=!active;if(!active)return;
    const completed=Math.max(0,Number(detail.completedCount??snap.completedCount??0)),expected=Math.max(0,Number(detail.expectedCount??snap.expectedCount??0)),next=detail.nextControl??snap.nextControl??null,finishValidated=Boolean(detail.finishValidated??snap.finishValidated),pending=Math.max(0,Number(detail.pending??snap.pending??0));
    const syncError=String(detail.message&&status==="sync_error"?detail.message:(snap.lastSyncError||""));
    progressEl.textContent=`${completed} / ${expected}`;
    if(!next){
      nextEl.textContent=finishValidated?"LLEGADA ✓":"LLEGADA";
      nextEl.classList.add("complete");
      distanceEl.textContent="—";qrBtn.hidden=true;
      statusEl.className="m2race-control-status "+(finishValidated?"ok":"warn");
      statusEl.textContent=finishValidated?"🏁 Llegada registrada. Finalizando y sincronizando automáticamente…":"Esperando validación de llegada.";
      if(kicker)kicker.textContent="🏁 LLEGADA";
      return;
    }
    const isFinish=String(next.checkpointId||"").toUpperCase()==="FINISH"||String(next.kind||"")==="finish";
    if(kicker)kicker.textContent=isFinish?"🏁 LLEGADA":"🎯 SIGUIENTE BALIZA";
    nextEl.classList.toggle("complete",isFinish);
    nextEl.textContent=isFinish?"LLEGADA":String(next.checkpointId||"—");
    qrBtn.hidden=false;qrBtn.textContent=isFinish?"📷 ESCANEAR QR DE LLEGADA":"📷 ESCANEAR QR DE LA BALIZA";
    if(detail.distanceM!=null)distanceEl.textContent=fmtMeters(detail.distanceM);
    if(status==="passed"||status==="qr_passed"){const pass=detail.pass||{};statusEl.className="m2race-control-status ok";statusEl.textContent=`✅ ${pass.checkpointId||"Baliza"} validada por ${String(pass.source||"").toUpperCase()==="QR"?"QR":"GPS"}. Siguiente: ${String(detail.nextAfter?.checkpointId||snap.nextControl?.checkpointId||"FINISH").toUpperCase()==="FINISH"?"LLEGADA":detail.nextAfter?.checkpointId||snap.nextControl?.checkpointId}.`;}
    else if(status==="arrival_local"||status==="arrival_qr"){statusEl.className="m2race-control-status ok";statusEl.textContent="🏁 LLEGADA registrada. Parando tiempo y sincronizando automáticamente…";}
    else if(status==="arrival_synced"){statusEl.className="m2race-control-status ok";statusEl.textContent="🏁 LLEGADA sincronizada. Cerrando carrera con el organizador…";}
    else if(pending>0&&!(["passed","qr_passed","arrival_local","arrival_qr"].includes(status))){statusEl.className="m2race-control-status warn";statusEl.textContent=syncError?`Sincronización pendiente · ${pending} validación${pending===1?"":"es"}. Reintentando automáticamente…`:`Sincronizando ${pending} validación${pending===1?"":"es"} con el organizador…`;return;}
    else if(status==="offline"){statusEl.className="m2race-control-status warn";statusEl.textContent=detail.message||"Validación guardada localmente. Se sincronizará al volver la cobertura.";}
    else if(status==="sync_error"||status==="qr_error"){statusEl.className="m2race-control-status warn";statusEl.textContent=detail.message||"No se pudo sincronizar. El registro local se conserva y se reintentará.";}
    else if(status==="syncing"){statusEl.className="m2race-control-status";statusEl.textContent=pending?`Sincronizando ${pending} validación${pending===1?"":"es"}…`:isFinish?"Sincronizando llegada…":"Sincronizando paso por baliza…";}
    else if(status==="gps"){
      statusEl.className="m2race-control-status";
      if(pending>0){statusEl.textContent=`Sincronizando ${pending} validación${pending===1?"":"es"} con el organizador…`;return;}
      if(detail.distanceM==null){statusEl.textContent=isFinish?"Esperando coordenadas de LLEGADA. Puedes usar su QR desde cualquier ubicación.":"Esperando coordenadas de la siguiente baliza. Puedes usar el QR en cualquier ubicación si necesitas respaldo.";}
      else if(detail.accuracyOk===false){statusEl.className="m2race-control-status warn";statusEl.textContent=`Precisión GPS insuficiente: ±${Math.round(Number(detail.accuracyM||0))} m. Para validar necesitas ±10 m o mejor y estar a 10 m o menos. El QR sigue disponible.`;}
      else if(Number(detail.distanceM)>10){statusEl.textContent=`${isFinish?"LLEGADA":"Siguiente "+next.checkpointId} · GPS ±${Math.round(Number(detail.accuracyM||0))} m · estás a ${Math.round(Number(detail.distanceM))} m. Acércate hasta 10 m o menos, o usa el QR.`;}
      else{statusEl.textContent=`${isFinish?"LLEGADA":"Siguiente "+next.checkpointId} · dentro de 10 m y con precisión válida. Validando por GPS…`;}
    } else {
      statusEl.className="m2race-control-status";
      statusEl.textContent=isFinish?"Todas las balizas están completas. Valida LLEGADA por GPS (≤10 m con precisión ±10 m) o escanea su QR.":"GPS solo valida con precisión ±10 m o mejor y a 10 m o menos. El QR puede usarse en cualquier ubicación.";
    }
  }
  async function openQrScanner(){
    const api=controlsApi(),panel=el("m2raceQrPanel"),status=el("m2raceQrStatus"),btn=el("m2raceQrOpen");
    if(!panel)return;
    panel.hidden=false;
    if(status)status.textContent="Botón QR detectado · solicitando cámara…";
    panel.scrollIntoView?.({behavior:"smooth",block:"center"});
    if(!api?.openScanner){if(status)status.textContent="El módulo lector QR no está disponible. Recarga MILITOPO e inténtalo de nuevo.";return;}
    if(btn)btn.disabled=true;
    try{
      const ok=await api.openScanner({video:el("m2raceQrVideo"),canvas:el("m2raceQrCanvas"),statusEl:status});
      if(!ok&&status&&!status.textContent)status.textContent="No se pudo abrir el lector QR.";
    }catch(error){if(status)status.textContent=`No se pudo abrir la cámara: ${String(error?.message||error)}`;}
    finally{if(btn)btn.disabled=false;}
  }
  function closeQrScanner(){controlsApi()?.closeScanner?.();const panel=el("m2raceQrPanel");if(panel)panel.hidden=true;}

  function render(){
    const row=state.participant||{},st=String(row.status||"ready").toLowerCase(),label=statusLabel(st),pill=el("m2raceState");
    pill.textContent=label;pill.className="m2race-state"+(st==="racing"||st==="started"?" racing":st==="finished"?" finished":"");
    el("m2raceStartAt").textContent=fmtTime(row.startedAt);el("m2raceFinishAt").textContent=fmtTime(row.finishedAt);
    el("m2raceRouteId").textContent=row.participantId&&row.routeId?`${row.participantId} · ${row.routeId}`:(row.routeId||"—");
    el("m2raceRouteDistance").textContent=fmtKm(row.routeDistanceKm);
    el("m2raceRouteControls").textContent=Number.isFinite(Number(row.routeControlCount))?String(Number(row.routeControlCount)):"—";
    el("m2raceRouteClimb").textContent=row.routePositiveM==null?"—":`${Number(row.routePositiveM)} m`;
    el("m2raceRouteDifficulty").textContent=String(row.routeDifficulty||"—");
    el("m2raceRouteSequence").textContent=routeSequence(row.routePoints)||"Recorrido asignado. La secuencia de balizas no está disponible.";
    el("m2raceStart").disabled=!row.routeId||!row.participantId;
    el("m2raceStart").hidden=!["ready","not_started"].includes(st);
    const hasFinishTarget=Boolean(state.controlPlan?.finish);
    el("m2raceFinish").hidden=!["racing","started"].includes(st);
    el("m2raceActionNote").textContent=hasFinishTarget?"LLEGADA finaliza automáticamente por GPS/QR. El botón TERMINAR CARRERA permanece disponible como salida manual.":"Puedes terminar manualmente la carrera cuando lo necesites.";
    const resultText=el("m2raceResultText");if(resultText)resultText.textContent=row.manualFinishIncomplete?"Carrera terminada manualmente. El resultado queda como INCOMPLETO porque faltaban balizas o LLEGADA.":"La llegada/fin de carrera ha quedado registrada y sincronizada con el organizador.";
    el("m2raceResult").hidden=st!=="finished";el("m2raceActionCard").hidden=st==="finished";if(st==="finished")el("m2raceConfirm").classList.remove("open");updateTimer();
    controlsApi()?.setRaceStatus?.(st);updateControlUi("status");
    try{window.dispatchEvent(new CustomEvent("militopo:v2-race-participant",{detail:{event:state.event?{...state.event}:null,auth:state.auth?{...state.auth}:null,runId:state.runId,participant:{...row},status:st}}));}catch(_){}
    if(st==="finished"){gpsApi()?.stop?.("finished").catch?.(()=>{});controlsApi()?.stop?.();}
    if(["racing","started"].includes(st)&&!gpsApi()?.snapshot?.().active&&!state.gpsTried){state.gpsTried=true;gpsApi()?.resumeIfGranted?.(gpsContext()).catch?.(()=>{});updateGpsUi("idle",{message:"GPS disponible. Pulsa ACTIVAR GPS si no se activa automáticamente."});}
  }
  function updateTimer(){if(state.timer){clearInterval(state.timer);state.timer=null;}const tick=()=>{const row=state.participant||{},start=Number(row.startedAt||0),serverFinish=Number(row.finishedAt||0),finish=serverFinish||Number(state.localArrivalAt||0),st=String(row.status||"").toLowerCase();if(!start){el("m2raceTimer").textContent="00:00";return;}el("m2raceTimer").textContent=fmtClock((finish||Date.now())-start);if((st==="finished"||finish)&&state.timer){clearInterval(state.timer);state.timer=null;}};tick();if(["racing","started"].includes(String(state.participant?.status||"").toLowerCase())&&!state.localArrivalAt)state.timer=setInterval(tick,1000);}
  async function bind(){const svc=await services(),api=svc.databaseApi;if(!api)throw new Error("Realtime Database no disponible.");const pRef=api.ref(`v2/live/${state.event.ownerUid}/${state.event.eventId}/runs/${state.runId}/participants/${state.auth.uid}`);const activeRef=api.ref(`v2/live/${state.event.ownerUid}/${state.event.eventId}/activeRun`);state.unsubParticipant=api.onValue(pRef,snap=>{state.participant=snap.val()||{};render();});state.unsubActive=api.onValue(activeRef,snap=>{const a=snap.val()||{};if(String(a.status||"")==="finished"){gpsApi()?.stop?.("event_finished").catch?.(()=>{});el("m2raceSyncTitle").textContent="Evento finalizado";el("m2raceSyncText").textContent="El organizador ha cerrado la sesión Live V2.";try{window.dispatchEvent(new CustomEvent("militopo:v2-race-event-finished",{detail:{event:state.event?{...state.event}:null,runId:state.runId}}));}catch(_){}if(String(state.participant?.status||"")!=="finished"){el("m2raceStart").disabled=true;el("m2raceFinish").disabled=true;}}});}
  async function open(detail){clearListeners();state.event=detail?.event||null;state.auth=detail?.auth||null;state.runId=String(detail?.runId||"");state.recovered=Boolean(detail?.recovered);state.gpsTried=false;state.controlPlan=null;state.localArrivalAt=0;state.autoFinishing=false;state.summaryOpen=false;if(!state.event||!state.auth||!state.runId)return;const root=ensureRoot();root.hidden=false;document.body.style.overflow="hidden";el("m2raceStartConfirm").classList.remove("open");el("m2raceTitle").textContent=state.event.eventName||"Carrera";el("m2raceEvent").innerHTML=`<strong>${esc(state.auth.displayName||state.auth.username||"Corredor")}</strong> · ${esc(state.event.eventId||"")}`;el("m2raceSyncTitle").textContent=state.recovered?"Recuperando carrera":"Sincronización activa";el("m2raceSyncText").textContent=state.recovered?"Reconectando con tu sesión Live V2…":"Conectando a la sesión Live V2…";updateGpsUi("idle");updateTrackUi("ready");try{window.dispatchEvent(new CustomEvent("militopo:v2-race-opened",{detail:{event:{...state.event},auth:{...state.auth},runId:state.runId,recovered:state.recovered}}));}catch(_){}try{const svc=await services();const joined=await svc.callable("runnerJoinLive",{eventId:state.event.eventId,clientVersion:VERSION});state.runId=String(joined?.data?.runId||state.runId);state.controlPlan=joined?.data?.controlPlan||null;state.participant={...(state.participant||{}),...(joined?.data||{})};await controlsApi()?.configure?.({context:gpsContext(),plan:state.controlPlan,progress:joined?.data?.controlProgress||null,status:state.participant?.status||"ready"});const controlSnap=controlsApi()?.snapshot?.()||{};if(controlSnap.finishValidated)state.localArrivalAt=Number(controlSnap.finishPass?.passedAtMs||joined?.data?.controlProgress?.arrivalAt||Date.now());render();await bind();el("m2raceSyncTitle").textContent=state.recovered?"Carrera recuperada":"Sincronización activa";el("m2raceSyncText").textContent=state.recovered?"Sesión restaurada. Track, cronómetro y Live V2 continúan.":"Conectado a Realtime Database V2.";if(controlSnap.finishValidated&&["racing","started"].includes(String(state.participant?.status||"").toLowerCase()))setTimeout(()=>autoFinishFromArrival({pass:controlSnap.finishPass,recovered:true}),120);}catch(error){el("m2raceSyncTitle").textContent="No se pudo conectar";el("m2raceSyncText").textContent=String(error?.message||error);try{window.dispatchEvent(new CustomEvent("militopo:v2-runner-race-error",{detail:{event:state.event?{...state.event}:null,runId:state.runId,recovered:state.recovered,message:String(error?.message||error)}}));}catch(_){}}}
  async function activateGps(){const api=gpsApi();if(!api)return updateGpsUi("unsupported",{message:"Módulo GPS no disponible."});updateGpsUi("requesting");const fix=await api.prepare();if(fix){await api.start(gpsContext(),fix);state.gpsTried=true;}else updateGpsUi("error",{message:api.snapshot?.().lastError||"No se pudo activar el GPS."});}
  async function startRace(){
    if(state.busy)return;
    state.localArrivalAt=0;state.autoFinishing=false;
    busy("Preparando salida","Solicitando GPS y validando tu sesión…");
    let fix=null;
    try{if(gpsApi()){updateGpsUi("requesting");fix=await gpsApi().prepare();}}
    catch(_){fix=null;}
    try{
      const svc=await services();
      el("m2raceBusyText").textContent="Registrando la salida en Live V2…";
      await svc.callable("runnerStartRace",{eventId:state.event.eventId,clientVersion:VERSION});
      controlsApi()?.setRaceStatus?.("racing");updateControlUi("status");
      if(gpsApi()&&fix)await gpsApi().start(gpsContext(),fix);else if(!fix)updateGpsUi("error",{message:"La carrera ha empezado, pero el GPS no está activo. Puedes activarlo manualmente."});
      await new Promise(r=>setTimeout(r,650));el("m2raceBusyTitle").textContent="Salida registrada";el("m2raceBusyText").textContent="Ya estás EN CARRERA. El organizador ha recibido el cambio.";await new Promise(r=>setTimeout(r,850));
    }catch(error){el("m2raceBusyTitle").textContent="No se pudo iniciar";el("m2raceBusyText").textContent=String(error?.message||error);await new Promise(r=>setTimeout(r,1600));}
    finally{unbusy();}
  }
  async function autoFinishFromArrival(detail={}){
    const st=String(state.participant?.status||"").toLowerCase();
    if(state.autoFinishing||st==="finished"||!["racing","started"].includes(st))return;
    const controls=controlsApi();
    const pass=detail.pass||controls?.snapshot?.().finishPass||null;
    state.localArrivalAt=Math.max(0,Number(pass?.passedAtMs||state.localArrivalAt||Date.now()));
    updateTimer();closeQrScanner();state.autoFinishing=true;
    busy("🏁 Llegada validada","Sincronizando balizas y LLEGADA…");
    try{
      if(navigator.onLine===false)throw new Error("Sin conexión. La llegada está guardada y se cerrará al recuperar cobertura.");
      const controlsOk=controls?.flushAndWait?await controls.flushAndWait({timeoutMs:20000,requireArrival:true}):await controls?.flush?.();
      const cSnap=controls?.snapshot?.()||{};
      if(!controlsOk||cSnap.pending>0||!cSnap.serverFinishValidated)throw new Error(`Queda pendiente la sincronización de ${Math.max(1,Number(cSnap.pending||1))} validación.`);
      el("m2raceBusyText").textContent="Balizas y LLEGADA sincronizadas · cerrando GPS y track…";
      try{await gpsApi()?.stop?.("arrival_validated");}catch(_){}
      const tSnap=trackApi()?.snapshot?.()||{};
      if(Number(tSnap.pending||0)>0){
        const trackOk=await trackApi()?.flush?.({force:true});
        const after=trackApi()?.snapshot?.()||{};
        if(trackOk===false||Number(after.pending||0)>0)throw new Error(`Quedan ${Number(after.pending||0)} puntos GPS pendientes de sincronizar.`);
      }
      el("m2raceBusyText").textContent="Todo sincronizado · confirmando FINALIZADO con el organizador…";
      const svc=await services();
      const result=await svc.callable("runnerFinishRace",{eventId:state.event.eventId,clientVersion:VERSION,pendingPasses:controls?.pendingPasses?.()||[]});
      const data=result?.data||{};
      state.participant={...(state.participant||{}),status:"finished",finishedAt:Number(data.finishedAt||state.localArrivalAt||Date.now()),manualFinish:false,manualFinishIncomplete:false};
      render();
      el("m2raceBusyTitle").textContent="Carrera finalizada ✓";
      el("m2raceBusyText").textContent="Balizas, llegada, track y resultado sincronizados correctamente.";
      await new Promise(r=>setTimeout(r,650));
      unbusy();state.autoFinishing=false;
      await showFinishSummary({incomplete:false});
      return;
    }catch(error){
      const msg=String(error?.message||error||"No se pudo cerrar automáticamente.");
      el("m2raceBusyTitle").textContent="Llegada guardada";
      el("m2raceBusyText").textContent=`Esperando a completar la sincronización antes de finalizar… ${msg}`;
      await new Promise(r=>setTimeout(r,1000));
      state.autoFinishing=false;unbusy();
      if(navigator.onLine!==false)setTimeout(()=>autoFinishFromArrival({pass,retry:true}),1600);
      return;
    }finally{if(state.busy)unbusy();}
  }

  async function finishRace(){
    if(state.busy)return;
    el("m2raceConfirm").classList.remove("open");
    const api=controlsApi();
    busy("Terminando carrera","Consolidando balizas, track y resultado…");
    try{
      try{await api?.flush?.();}catch(_){}
      const pendingPasses=api?.pendingPasses?.()||[];
      try{await gpsApi()?.stop?.("runner_manual_finish");}catch(_){}
      const svc=await services();
      const result=await svc.callable("runnerFinishRace",{eventId:state.event.eventId,clientVersion:VERSION,manualFinish:true,pendingPasses});
      const data=result?.data||{};
      state.participant={...(state.participant||{}),status:"finished",finishedAt:Number(data.finishedAt||Date.now()),manualFinish:true,manualFinishIncomplete:Boolean(data.manualFinishIncomplete)};
      render();
      el("m2raceBusyTitle").textContent=data.manualFinishIncomplete?"Carrera terminada · INCOMPLETA":"Carrera terminada";
      el("m2raceBusyText").textContent=data.manualFinishIncomplete?"Se ha cerrado cuando lo has solicitado. El resultado queda INCOMPLETO porque faltaban balizas o LLEGADA.":"Resultado y recorrido sincronizados correctamente.";
      await new Promise(r=>setTimeout(r,650));unbusy();await showFinishSummary({incomplete:Boolean(data.manualFinishIncomplete)});return;
    }catch(error){
      el("m2raceBusyTitle").textContent="No se pudo terminar";
      el("m2raceBusyText").textContent=String(error?.message||error);
      await new Promise(r=>setTimeout(r,1600));
    }finally{unbusy();}
  }

  // H6.2.2: el botón vive dentro de una interfaz dinámica. Capturamos el toque en fase capture
  // para que ningún re-render/listener externo pueda dejarlo sin respuesta.
  if(!globalThis.__MILITOPO_QR_BUTTON_CAPTURE_V2){
    globalThis.__MILITOPO_QR_BUTTON_CAPTURE_V2=true;
    document.addEventListener("click",event=>{
      const target=event.target?.closest?.("#m2raceQrOpen");
      if(!target)return;
      event.preventDefault();
      event.stopPropagation();
      openQrScanner().catch(error=>{
        const status=el("m2raceQrStatus"),panel=el("m2raceQrPanel");
        if(panel)panel.hidden=false;
        if(status)status.textContent=`Error al abrir cámara: ${String(error?.message||error)}`;
      });
    },true);
  }

  window.addEventListener("militopo:v2-gps-status",e=>updateGpsUi(e.detail?.status||"idle",e.detail||{}));
  window.addEventListener("militopo:v2-track-status",e=>updateTrackUi(e.detail?.status||"ready",e.detail||{}));
  window.addEventListener("militopo:v2-control-status",e=>{
    const d=e.detail||{};
    if(d.status==="qr_closed"){const panel=el("m2raceQrPanel");if(panel)panel.hidden=true;return;}
    if(d.status==="arrival_local"||d.status==="arrival_qr"){
      state.localArrivalAt=Math.max(0,Number(d.pass?.passedAtMs||Date.now()));
      const panel=el("m2raceQrPanel");if(panel)panel.hidden=true;
      el("m2raceFinishAt").textContent=fmtTime(state.localArrivalAt);
      updateTimer();
      try{Promise.resolve(gpsApi()?.stop?.("arrival_local")).catch(()=>{});}catch(_){}
      // H6.8: el cierre comienza desde la propia validación local de LLEGADA.
      // runnerFinishRace recibe el diario completo y consolida la llegada en backend,
      // por lo que ya no dependemos de un segundo evento arrival_synced.
      setTimeout(()=>autoFinishFromArrival(d).catch(()=>{}),80);
    }
    updateControlUi(d.status||"status",d);
    if(d.status==="arrival_synced")setTimeout(()=>autoFinishFromArrival(d).catch(()=>{}),40);
  });
  window.addEventListener("online",()=>{const cs=controlsApi()?.snapshot?.()||{};if(cs.finishValidated&&["racing","started"].includes(String(state.participant?.status||"").toLowerCase()))setTimeout(()=>autoFinishFromArrival({pass:cs.finishPass,retry:true}),350);});
  window.addEventListener("militopo:v2-resilience-status",e=>{const d=e.detail||{},pill=el("m2raceResiliencePill"),text=el("m2raceResilienceText");if(!pill||!text)return;pill.className="m2race-resilience-pill";if(d.status==="awake"){pill.textContent="PANTALLA ACTIVA";pill.classList.add("ok");text.textContent="Wake Lock activo mientras corres. Si recargas, MILITOPO recuperará la sesión.";}else if(d.status==="restoring"){pill.textContent="RECUPERANDO";pill.classList.add("warn");text.textContent="Reconectando carrera, GPS y track local…";}else if(d.status==="unsupported"){pill.textContent="RECUPERACIÓN ACTIVA";pill.classList.add("ok");text.textContent="La recuperación de carrera está activa. Este navegador no ofrece Wake Lock de pantalla.";}else if(d.status==="released"){pill.textContent="RECUPERACIÓN ACTIVA";pill.classList.add("ok");text.textContent="La sesión queda protegida aunque la pantalla pueda apagarse.";}else{pill.textContent="PROTEGIDO";pill.classList.add("ok");text.textContent=d.message||"MILITOPO puede recuperar esta carrera si recargas la aplicación.";}});
  window.addEventListener("militopo:v2-open-runner-race",e=>open(e.detail));
})();
