/* MILITOPO V2 · G3 · Carrera + GPS + track offline + recuperación de sesión.
   Live V2 es el único flujo activo. El GPS solo se comparte durante la carrera. */
(function(){
  "use strict";
  const VERSION="v2-r6e-live-routes-progress-20261007";
  const state={root:null,services:null,event:null,auth:null,runId:"",participant:null,controlPlan:null,unsubParticipant:null,unsubActive:null,timer:null,busy:false,gpsTried:false,recovered:false,offlineRecovered:false,liveBound:false,reconnectPromise:null,localArrivalAt:0,autoFinishing:false,summaryOpen:false,gpsPrepared:false,preStartFix:null};
  const esc=v=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const statusLabel=s=>({not_started:"PREPARADO",ready:"PREPARADO",racing:"EN CARRERA",started:"EN CARRERA",finished:"FINALIZADO"})[String(s||"").toLowerCase()]||String(s||"").toUpperCase();
  const fmtClock=ms=>{const sec=Math.max(0,Math.floor(ms/1000)),h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;return h?`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`:`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;};
  const fmtTime=v=>{const n=Number(v||0);if(!n)return "—";try{return new Intl.DateTimeFormat("es-ES",{hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date(n));}catch(_){return "—";}};
  const fmtKm=v=>Number.isFinite(Number(v))?`${Number(v).toFixed(2)} km`:"—";
  const CONTROL_PENALTY_MS=15*60*1000;
  const routeSequence=v=>(Array.isArray(v)?v:[]).map(raw=>{const key=String(raw||"").trim(),upper=key.toUpperCase();return upper==="START"||upper==="SALIDA"?"S":upper==="FINISH"||upper==="LLEGADA"?"L":key;}).filter(Boolean).join(" → ");
  async function services(){if(!state.services)state.services=await globalThis.MILITOPO_V2.firebase();return state.services;}
  function gpsApi(){return globalThis.MILITOPO_RUNNER_GPS_V2||null;}
  function trackApi(){return globalThis.MILITOPO_RUNNER_TRACK_V2||null;}
  function controlsApi(){return globalThis.MILITOPO_RUNNER_CONTROLS_V2||null;}
  function gpsContext(){return {ownerUid:state.event?.ownerUid||"",eventId:state.event?.eventId||"",runId:state.runId,uid:state.auth?.uid||""};}
  function runnerLogoSrc(){return location.pathname.includes("/orientacion/participante/")?"../../icons/militopo-512.png?v=r6a1-runner-brand-20261006":"icons/militopo-512.png?v=r6a1-runner-brand-20261006";}
  function emitLocalSnapshot(){
    try{window.dispatchEvent(new CustomEvent("militopo:v2-race-local-snapshot",{detail:{event:state.event?{...state.event}:null,auth:state.auth?{...state.auth}:null,runId:state.runId,participant:state.participant?{...state.participant}:null,controlPlan:state.controlPlan?JSON.parse(JSON.stringify(state.controlPlan)):null,localArrivalAt:Number(state.localArrivalAt||0),status:String(state.participant?.status||"")}}));}catch(_){}
  }
  function hasUsableRecovery(snapshot){const p=snapshot?.participant||null,plan=snapshot?.controlPlan||null,st=String(p?.status||snapshot?.status||"").toLowerCase();return Boolean(p&&plan&&["racing","started"].includes(st)&&Number(p.startedAt||0)>0);}
  function installStyle(){if(document.getElementById("m2RaceV2Style"))return;const s=document.createElement("style");s.id="m2RaceV2Style";s.textContent=`
    #m2RaceV2{position:fixed;inset:0;z-index:100120;background:linear-gradient(180deg,#07110b,#09170e 44%,#050b07);color:#f7f2e8;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow:auto;padding:calc(env(safe-area-inset-top) + 14px) 14px calc(env(safe-area-inset-bottom) + 24px)}#m2RaceV2[hidden]{display:none!important}
    .m2race-shell{width:min(720px,100%);margin:0 auto;display:grid;gap:14px}.m2race-top{display:grid;grid-template-columns:44px 54px minmax(0,1fr) auto;align-items:center;gap:10px;padding:8px 9px;border:1px solid rgba(255,255,255,.08);border-radius:19px;background:linear-gradient(135deg,rgba(24,45,29,.98),rgba(9,22,13,.98));box-shadow:0 12px 34px rgba(0,0,0,.20)}.m2race-back{width:44px;height:44px;border-radius:13px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.055);color:#fff;font-size:1.25rem}.m2race-logo{width:54px;height:54px;border-radius:15px;overflow:hidden;border:1px solid rgba(255,255,255,.12);background:#040704;box-shadow:0 7px 18px rgba(0,0,0,.24)}.m2race-logo img{width:100%;height:100%;display:block;object-fit:cover}.m2race-brand{min-width:0}.m2race-kicker{font-size:.64rem;letter-spacing:.18em;color:#dce8d8;font-weight:950}.m2race-title{margin:3px 0 0;font-size:clamp(1.04rem,5vw,1.55rem);line-height:1.08;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.m2race-live{display:flex;align-items:center;gap:7px;padding:8px 10px;border-radius:999px;background:rgba(86,180,112,.11);border:1px solid rgba(105,220,136,.22);font-size:.64rem;font-weight:900;color:#bce8c7}.m2race-dot{width:8px;height:8px;border-radius:50%;background:#73d58d;box-shadow:0 0 0 5px rgba(115,213,141,.10)}
    .m2race-card{border:1px solid rgba(255,255,255,.09);border-radius:24px;background:linear-gradient(180deg,rgba(21,42,28,.96),rgba(10,23,15,.98));box-shadow:0 18px 50px rgba(0,0,0,.25);padding:18px}.m2race-hero{padding:24px 18px;text-align:center;background:radial-gradient(circle at 50% 0,rgba(137,197,110,.19),transparent 42%),linear-gradient(180deg,rgba(22,49,30,.98),rgba(9,22,14,.98))}.m2race-route-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.m2race-route-title{font-size:.72rem;font-weight:900;letter-spacing:.10em;color:#e8efdd}.m2race-route-id{padding:6px 9px;border-radius:999px;border:1px solid rgba(232,191,99,.32);background:rgba(232,191,99,.10);font-size:.65rem;font-weight:900;color:#f5d995}.m2race-route-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:10px}.m2race-route-stat{padding:9px 7px;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07)}.m2race-route-stat span{display:block;font-size:.55rem;letter-spacing:.07em;color:#89988c}.m2race-route-stat strong{display:block;margin-top:4px;font-size:.76rem;color:#eef4e8;overflow-wrap:anywhere}.m2race-route-seq{margin-top:10px;padding:9px 10px;border-radius:12px;background:rgba(0,0,0,.12);color:#bdc9bf;font-size:.68rem;line-height:1.5;overflow-wrap:anywhere}.m2race-state{display:inline-flex;padding:7px 12px;border-radius:999px;border:1px solid rgba(144,212,116,.32);background:rgba(144,212,116,.10);font-size:.72rem;font-weight:900;letter-spacing:.08em;color:#d9f1ce}.m2race-state.racing{color:#d8edff;border-color:rgba(94,169,235,.35);background:rgba(74,134,197,.12)}.m2race-state.finished{color:#f7e5ad;border-color:rgba(230,191,90,.35);background:rgba(190,148,47,.12)}.m2race-time{font-size:clamp(2.8rem,14vw,5.3rem);font-variant-numeric:tabular-nums;font-weight:800;letter-spacing:-.05em;margin:14px 0 2px}.m2race-time-label{font-size:.68rem;letter-spacing:.13em;color:#89998d;font-weight:800}.m2race-event{margin-top:15px;color:#b9c6bc;font-size:.82rem}.m2race-event strong{color:#fff}.m2race-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.m2race-stat{padding:14px;border-radius:18px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07)}.m2race-stat span{display:block;font-size:.63rem;letter-spacing:.11em;color:#849488;font-weight:800}.m2race-stat strong{display:block;margin-top:7px;font-size:1rem}.m2race-action{width:100%;min-height:62px;border:0;border-radius:20px;font:inherit;font-size:1rem;font-weight:900;letter-spacing:.04em}.m2race-start{background:linear-gradient(180deg,#b9df80,#8fbe5e);color:#10200d;box-shadow:0 12px 30px rgba(117,171,77,.22)}.m2race-finish{background:linear-gradient(180deg,#e8bf63,#c89537);color:#281b07}.m2race-action:disabled{opacity:.52;filter:saturate(.4)}.m2race-note{margin-top:10px;text-align:center;color:#8e9b91;font-size:.7rem;line-height:1.45}.m2race-confirm{display:none;margin-top:12px;padding:14px;border-radius:18px;background:rgba(229,174,67,.08);border:1px solid rgba(229,174,67,.22)}.m2race-confirm.open{display:block}.m2race-confirm p{margin:0 0 10px;font-size:.78rem;color:#e7d6ad}.m2race-confirm-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.m2race-mini{min-height:44px;border-radius:13px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;font:inherit;font-weight:800}.m2race-mini.primary{background:rgba(229,174,67,.16);border-color:rgba(229,174,67,.38);color:#ffe4a7}
    .m2race-gps{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px}.m2race-gps-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:14px;background:rgba(97,171,229,.10);border:1px solid rgba(97,171,229,.22);font-size:1.2rem}.m2race-gps-title{font-size:.72rem;font-weight:900;letter-spacing:.08em}.m2race-gps-text{margin-top:4px;color:#93a29a;font-size:.69rem;line-height:1.35}.m2race-gps-pill{padding:6px 9px;border-radius:999px;border:1px solid rgba(255,255,255,.12);font-size:.58rem;font-weight:900;color:#dce8de}.m2race-gps-pill.ok{color:#cceec7;border-color:rgba(113,214,135,.28);background:rgba(113,214,135,.08)}.m2race-gps-pill.warn{color:#ffe3a8;border-color:rgba(235,184,80,.32);background:rgba(235,184,80,.08)}.m2race-gps-btn{grid-column:1/-1;width:100%;min-height:44px;border-radius:14px;border:1px solid rgba(105,176,231,.28);background:rgba(70,139,194,.10);color:#dcedfb;font:inherit;font-size:.72rem;font-weight:900}
    .m2race-track{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px}.m2race-track-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:14px;background:rgba(193,160,73,.10);border:1px solid rgba(193,160,73,.22);font-size:1.1rem}.m2race-track-title{font-size:.72rem;font-weight:900;letter-spacing:.08em}.m2race-track-text{margin-top:4px;color:#93a29a;font-size:.69rem;line-height:1.35}.m2race-track-pill{padding:6px 9px;border-radius:999px;border:1px solid rgba(255,255,255,.12);font-size:.58rem;font-weight:900}.m2race-track-pill.ok{color:#cceec7;border-color:rgba(113,214,135,.28);background:rgba(113,214,135,.08)}.m2race-track-pill.warn{color:#ffe3a8;border-color:rgba(235,184,80,.32);background:rgba(235,184,80,.08)}
    .m2race-resilience{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:12px}.m2race-resilience-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:14px;background:rgba(134,201,116,.10);border:1px solid rgba(134,201,116,.22);font-size:1.1rem}.m2race-resilience-title{font-size:.72rem;font-weight:900;letter-spacing:.08em}.m2race-resilience-text{margin-top:4px;color:#93a29a;font-size:.69rem;line-height:1.35}.m2race-resilience-pill{padding:6px 9px;border-radius:999px;border:1px solid rgba(255,255,255,.12);font-size:.58rem;font-weight:900}.m2race-resilience-pill.ok{color:#cceec7;border-color:rgba(113,214,135,.28);background:rgba(113,214,135,.08)}.m2race-resilience-pill.warn{color:#ffe3a8;border-color:rgba(235,184,80,.32);background:rgba(235,184,80,.08)}
    .m2race-control-card{border-color:rgba(235,192,91,.25);background:radial-gradient(circle at 82% 5%,rgba(235,192,91,.13),transparent 34%),linear-gradient(180deg,rgba(24,43,27,.98),rgba(9,22,14,.98))}.m2race-control-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.m2race-control-kicker{font-size:.68rem;letter-spacing:.12em;font-weight:900;color:#f0cf83}.m2race-control-progress{font-size:.63rem;color:#a8b6aa;font-weight:800}.m2race-next{text-align:center;margin:13px 0 6px;font-size:clamp(2.2rem,13vw,4.5rem);line-height:1;font-weight:950;letter-spacing:-.03em;color:#f7df9b}.m2race-next.complete{font-size:clamp(1.45rem,7vw,2.25rem);color:#bce8c7}.m2race-control-meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.m2race-control-meta div{padding:10px;border-radius:13px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07)}.m2race-control-meta span{display:block;font-size:.55rem;letter-spacing:.08em;color:#85938a}.m2race-control-meta strong{display:block;margin-top:4px;font-size:.78rem}.m2race-control-status{margin-top:10px;min-height:38px;padding:10px;border-radius:13px;background:rgba(0,0,0,.14);color:#aebcb1;font-size:.7rem;line-height:1.35}.m2race-control-status.ok{color:#d5f0cf;border:1px solid rgba(117,211,137,.22)}.m2race-control-status.warn{color:#ffe3a8;border:1px solid rgba(235,184,80,.25)}.m2race-discard-btn{width:100%;min-height:48px;margin-top:9px;border-radius:15px;border:1px solid rgba(226,120,80,.28);background:rgba(160,65,42,.10);color:#ffd0bd;font:inherit;font-size:.72rem;font-weight:900;letter-spacing:.035em;touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden;position:relative}.m2race-discard-btn::before{content:"";position:absolute;inset:0 auto 0 0;width:var(--hold,0%);background:rgba(226,120,80,.22);pointer-events:none}.m2race-discard-btn span{position:relative;z-index:1}.m2race-discard-btn[hidden]{display:none!important}.m2race-discard-confirm{margin-top:9px;padding:12px;border-radius:14px;border:1px solid rgba(226,120,80,.25);background:rgba(105,35,24,.16);color:#ffd8c8;font-size:.72rem;line-height:1.4}.m2race-discard-confirm[hidden]{display:none!important}.m2race-discard-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}.m2race-discard-actions button{min-height:42px;border-radius:12px;font:inherit;font-weight:900}.m2race-discard-cancel{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff}.m2race-discard-ok{border:1px solid rgba(226,120,80,.38);background:rgba(190,70,42,.22);color:#ffd7c5}.m2race-penalty-preview{display:grid;grid-template-columns:.75fr 1fr 1.25fr;gap:7px;margin-top:10px}.m2race-penalty-preview>div{padding:9px 7px;border-radius:12px;background:rgba(229,174,67,.07);border:1px solid rgba(229,174,67,.16);text-align:center}.m2race-penalty-preview span{display:block;font-size:.50rem;letter-spacing:.055em;color:#c7b47f;font-weight:800}.m2race-penalty-preview strong{display:block;margin-top:4px;font-size:.72rem;color:#ffe1a0;font-variant-numeric:tabular-nums}.m2race-qr-btn{position:relative;z-index:6;pointer-events:auto;touch-action:manipulation;-webkit-user-select:none;user-select:none;width:100%;min-height:48px;margin-top:10px;border-radius:15px;border:1px solid rgba(235,192,91,.36);background:rgba(235,192,91,.11);color:#f8e2ad;font:inherit;font-size:.76rem;font-weight:900;letter-spacing:.04em}.m2race-qr-fallback{display:flex;align-items:center;justify-content:center;width:100%;min-height:42px;margin-top:8px;border-radius:12px;border:1px dashed rgba(235,192,91,.28);background:rgba(235,192,91,.07);color:#f3d896;font-size:.68rem;font-weight:900;cursor:pointer;touch-action:manipulation}.m2race-qr-panel{margin-top:11px;padding:10px;border-radius:16px;background:#050806;border:1px solid rgba(255,255,255,.10)}.m2race-qr-panel[hidden]{display:none!important}.m2race-qr-video{width:100%;max-height:48vh;border-radius:13px;background:#000;object-fit:cover}.m2race-qr-status{padding:8px 4px 3px;color:#b9c6bc;font-size:.68rem;line-height:1.35}.m2race-qr-close{width:100%;min-height:42px;margin-top:8px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff;font:inherit;font-size:.7rem;font-weight:900}.m2race-start-confirm{position:fixed;inset:0;z-index:100140;display:none;align-items:flex-end;justify-content:center;padding:18px;background:rgba(2,7,4,.74);backdrop-filter:blur(10px)}.m2race-start-confirm.open{display:flex}.m2race-start-sheet{width:min(520px,100%);border-radius:28px;padding:22px;background:linear-gradient(180deg,#17301f,#0a1710);border:1px solid rgba(190,226,137,.22);box-shadow:0 28px 80px rgba(0,0,0,.5);animation:m2raceSheetIn .22s ease-out}.m2race-start-icon{width:58px;height:58px;margin:0 auto 13px;display:grid;place-items:center;border-radius:20px;background:rgba(176,220,116,.13);border:1px solid rgba(176,220,116,.28);font-size:1.65rem}.m2race-start-sheet h2{margin:0;text-align:center;font-size:1.25rem}.m2race-start-sheet p{margin:9px auto 16px;max-width:400px;text-align:center;color:#a9b7ad;font-size:.78rem;line-height:1.45}.m2race-start-choice{display:grid;grid-template-columns:1fr 1.35fr;gap:9px}.m2race-start-choice button{min-height:52px;border-radius:16px;font:inherit;font-weight:900;border:1px solid rgba(255,255,255,.11)}.m2race-start-no{background:rgba(255,255,255,.06);color:#e9eee9}.m2race-start-yes{background:linear-gradient(180deg,#c2e887,#91c15c);color:#10200d;border:0!important}@keyframes m2raceSheetIn{from{transform:translateY(18px);opacity:.35}to{transform:translateY(0);opacity:1}}
    .m2race-sync{display:flex;align-items:center;gap:9px;font-size:.74rem;color:#aebbb1}.m2race-sync strong{color:#dce8de}.m2race-sync-dot{width:9px;height:9px;border-radius:50%;background:#75d38d}.m2race-result{text-align:center}.m2race-result-icon{font-size:2.4rem}.m2race-result h2{margin:8px 0 4px;font-size:1.35rem}.m2race-result p{margin:0;color:#9eaaa1;font-size:.78rem}.m2race-busy{position:fixed;inset:0;z-index:100130;display:none;place-items:center;background:rgba(3,8,5,.76);backdrop-filter:blur(8px)}.m2race-busy.open{display:grid}.m2race-busy-card{width:min(86vw,380px);border-radius:24px;background:#0f2015;border:1px solid rgba(144,212,116,.24);padding:22px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.4)}.m2race-spinner{width:34px;height:34px;border-radius:50%;border:3px solid rgba(255,255,255,.12);border-top-color:#a9d77d;margin:0 auto 12px;animation:m2spin .8s linear infinite}@keyframes m2spin{to{transform:rotate(360deg)}}.m2race-busy-card strong{display:block}.m2race-busy-card span{display:block;margin-top:5px;color:#91a095;font-size:.72rem}
    .m2race-summary{position:fixed;inset:0;z-index:100150;display:none;align-items:flex-end;justify-content:center;padding:18px;background:rgba(2,7,4,.78);backdrop-filter:blur(12px)}.m2race-summary.open{display:flex}.m2race-summary-sheet{width:min(560px,100%);max-height:88vh;overflow:auto;border-radius:30px 30px 22px 22px;padding:22px;background:linear-gradient(180deg,#173321,#08160e);border:1px solid rgba(185,225,128,.25);box-shadow:0 30px 90px rgba(0,0,0,.55)}.m2race-summary-check{width:66px;height:66px;margin:0 auto 12px;display:grid;place-items:center;border-radius:22px;background:rgba(133,216,119,.14);border:1px solid rgba(133,216,119,.30);font-size:2rem}.m2race-summary h2{margin:0;text-align:center;font-size:1.45rem}.m2race-summary-sub{margin:7px 0 18px;text-align:center;color:#aab8ae;font-size:.76rem;line-height:1.4}.m2race-summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.m2race-summary-stat{padding:12px;border-radius:16px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08)}.m2race-summary-stat span{display:block;font-size:.56rem;letter-spacing:.08em;color:#829287;font-weight:800}.m2race-summary-stat strong{display:block;margin-top:5px;font-size:.9rem;color:#f2f5ef}.m2race-summary-ranks{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.m2race-summary-rank{padding:13px;border-radius:16px;background:rgba(231,190,91,.08);border:1px solid rgba(231,190,91,.20);text-align:center}.m2race-summary-rank span{display:block;font-size:.56rem;color:#c8b47e;letter-spacing:.08em}.m2race-summary-rank strong{display:block;margin-top:5px;font-size:1.05rem;color:#ffe4a5}.m2race-summary-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:15px}.m2race-summary-actions button{min-height:50px;border-radius:15px;font:inherit;font-weight:900}.m2race-summary-close{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.06);color:#fff}.m2race-summary-done{border:0;background:linear-gradient(180deg,#c2e887,#91c15c);color:#10200d}
    @media(max-width:430px){.m2race-card{border-radius:21px;padding:15px}.m2race-top{grid-template-columns:42px 48px minmax(0,1fr) auto;gap:7px;padding:7px}.m2race-back{width:42px;height:42px}.m2race-logo{width:48px;height:48px;border-radius:13px}.m2race-live{padding:7px 8px}.m2race-grid{gap:8px}}
  `;document.head.appendChild(s);}
  function installR6BStyle(){
    if(document.getElementById("m2RaceR6BStyle"))return;
    const st=document.createElement("style");st.id="m2RaceR6BStyle";st.textContent=`
      #m2RaceV2{overflow:hidden!important;padding:calc(env(safe-area-inset-top,0px) + 7px) 8px calc(env(safe-area-inset-bottom,0px) + 7px)!important;background:radial-gradient(circle at 50% -12%,#183a25 0,#09180f 34%,#050b07 76%)!important}
      #m2RaceV2 .m2race-shell{height:calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 14px);max-height:100%;width:min(720px,100%);display:grid!important;grid-template-rows:auto minmax(0,1fr) auto;gap:7px!important;overflow:hidden}
      #m2RaceV2 .m2race-top{min-height:50px;grid-template-columns:38px 42px minmax(0,1fr) auto!important;gap:7px!important;padding:5px 6px!important;border-radius:15px!important}
      #m2RaceV2 .m2race-back{width:38px;height:38px;border-radius:11px;font-size:1.08rem}
      #m2RaceV2 .m2race-logo{width:42px;height:42px;border-radius:11px}
      #m2RaceV2 .m2race-kicker{font-size:.50rem;letter-spacing:.14em}
      #m2RaceV2 .m2race-title{font-size:clamp(.9rem,4vw,1.14rem);margin-top:2px}
      #m2RaceV2 .m2race-live{padding:6px 8px;font-size:.52rem;gap:5px}.m2race-dot{width:6px;height:6px}
      #m2RaceV2 .m2race-dashboard{min-height:0;border:1px solid rgba(215,231,208,.11);border-radius:20px;padding:10px;background:radial-gradient(circle at 80% 0,rgba(232,191,99,.09),transparent 30%),linear-gradient(180deg,rgba(22,48,30,.98),rgba(8,20,13,.99));box-shadow:0 16px 42px rgba(0,0,0,.25);display:grid;grid-template-rows:auto auto auto minmax(0,1fr);gap:7px;overflow:hidden}
      #m2RaceV2 .m2race-hero-line{display:flex;align-items:center;justify-content:space-between;gap:8px}.m2race-identity{display:flex;align-items:center;gap:6px;min-width:0}.m2race-identity b{padding:5px 7px;border-radius:9px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);font-size:.56rem;color:#d9e5da;white-space:nowrap}.m2race-identity span{font-size:.56rem;color:#8fa091;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #m2RaceV2 .m2race-state{padding:5px 8px!important;font-size:.55rem!important;letter-spacing:.06em!important}
      #m2RaceV2 .m2race-clock-wrap{text-align:center;padding:0 4px}.m2race-time{font-size:clamp(2.75rem,13vw,4.45rem)!important;line-height:.94!important;margin:2px 0 0!important;color:#fff8dd;text-shadow:0 0 26px rgba(235,192,91,.12)}.m2race-time-label{font-size:.58rem!important;color:#e7c877!important;letter-spacing:.16em!important;margin-top:4px}.m2race-clock-sub{display:flex;justify-content:center;gap:18px;margin-top:4px;font-size:.54rem;color:#829287}.m2race-clock-sub b{color:#d7e0d5;font-variant-numeric:tabular-nums}
      #m2RaceV2 .m2race-progress{padding:0 2px}.m2race-progress-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px;font-size:.54rem;font-weight:900;letter-spacing:.08em;color:#aeb9ae}.m2race-progress-head strong{color:#f2e3ae;font-size:.62rem}.m2race-progress-track{height:9px;border-radius:999px;overflow:hidden;background:#122019;border:1px solid rgba(255,255,255,.07);box-shadow:inset 0 1px 3px rgba(0,0,0,.42)}.m2race-progress-fill{height:100%;width:0;border-radius:inherit;background:linear-gradient(90deg,#75b55d,#b8d978 58%,#e6be62);box-shadow:0 0 14px rgba(166,210,105,.28);transition:width .32s ease}
      #m2RaceV2 .m2race-control-card{position:relative;min-height:0!important;padding:9px!important;border-radius:17px!important;display:grid!important;grid-template-rows:auto auto auto auto auto;gap:5px;overflow:auto;background:linear-gradient(180deg,rgba(255,255,255,.035),rgba(255,255,255,.015))!important;border-color:rgba(235,192,91,.17)!important;box-shadow:none!important}
      #m2RaceV2 .m2race-control-head{min-height:19px}.m2race-control-kicker{font-size:.56rem!important;letter-spacing:.10em!important}.m2race-control-progress{display:none!important}
      #m2RaceV2 .m2race-next{margin:0!important;font-size:clamp(2.05rem,10vw,3.45rem)!important;line-height:.96!important;color:#ffe29a!important}.m2race-next.complete{font-size:clamp(1.35rem,7vw,2rem)!important}
      #m2RaceV2 .m2race-control-meta{grid-template-columns:1fr 1fr!important;gap:5px!important;margin:0!important}.m2race-control-meta div{padding:6px 8px!important;border-radius:10px!important}.m2race-control-meta span{font-size:.45rem!important}.m2race-control-meta strong{font-size:.66rem!important;margin-top:2px!important}
      #m2RaceV2 .m2race-control-status{margin:0!important;min-height:28px!important;max-height:42px;overflow:hidden;padding:6px 8px!important;border-radius:10px!important;font-size:.56rem!important;line-height:1.24!important}
      #m2RaceV2 .m2race-qr-btn{min-height:44px!important;margin:0!important;border-radius:13px!important;background:linear-gradient(180deg,#f0cd75,#d5a747)!important;color:#211704!important;border:0!important;font-size:.68rem!important;box-shadow:0 9px 22px rgba(191,145,48,.18)}
      #m2RaceV2 .m2race-discard-btn{min-height:34px!important;margin:0!important;border-radius:11px!important;font-size:.57rem!important}.m2race-discard-confirm{position:absolute;left:9px;right:9px;bottom:9px;z-index:6;margin:0!important;box-shadow:0 14px 35px rgba(0,0,0,.45);background:#321711!important}
      #m2RaceV2 .m2race-penalty-preview{display:none!important}
      #m2RaceV2 .m2race-bottom{display:grid;gap:6px;min-height:0}
      #m2RaceV2 .m2race-gpsbar{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:7px;padding:7px 8px;border:1px solid rgba(102,174,226,.15);border-radius:14px;background:rgba(9,24,16,.96)}.m2race-gps-icon{width:31px!important;height:31px!important;border-radius:10px!important;font-size:.92rem!important}.m2race-gps-title{font-size:.54rem!important}.m2race-gps-text{margin-top:2px!important;font-size:.52rem!important;line-height:1.15!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.m2race-gps-pill{font-size:.49rem!important;padding:5px 7px!important}.m2race-gps-btn{grid-column:1/-1;min-height:36px!important;margin-top:0!important;border-radius:10px!important;font-size:.60rem!important;background:linear-gradient(180deg,#6baddd,#447ca6)!important;color:#fff!important}
      #m2RaceV2 .m2race-actions-row{display:grid;grid-template-columns:minmax(0,.72fr) minmax(0,1.28fr);gap:6px}.m2race-route-toggle{min-height:44px;border-radius:13px;border:1px solid rgba(255,255,255,.10);background:#17251a;color:#dce6dd;font:inherit;font-size:.60rem;font-weight:900}.m2race-action{min-height:44px!important;border-radius:13px!important;margin:0!important;font-size:.68rem!important}.m2race-action.m2race-start:disabled{background:#263226!important;color:#778378!important;box-shadow:none!important}.m2race-finish{background:linear-gradient(180deg,#e3ad54,#c67d30)!important;color:#241404!important}
      #m2RaceV2 .m2race-action-note{display:none!important}.m2race-confirm{position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 12px);z-index:100145;margin:0!important;background:#241d11!important;box-shadow:0 18px 60px rgba(0,0,0,.52)}
      #m2RaceV2 .m2race-system-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.m2race-system-chip{min-width:0;padding:4px 6px;border-radius:9px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.055);display:flex;align-items:center;justify-content:center;gap:4px;font-size:.45rem;color:#78877c;white-space:nowrap;overflow:hidden}.m2race-system-chip strong{color:#b9c6bc;overflow:hidden;text-overflow:ellipsis}.m2race-track-pill,.m2race-resilience-pill{padding:3px 5px!important;font-size:.43rem!important}.m2race-track-text,.m2race-resilience-text,.m2race-sync>div>br,.m2race-sync>div>span{display:none!important}.m2race-sync{font-size:.45rem!important;gap:4px!important;justify-content:center}.m2race-sync-dot{width:6px!important;height:6px!important}
      #m2RaceV2 .m2race-route-sheet{position:fixed;z-index:100135;left:10px;right:10px;bottom:calc(env(safe-area-inset-bottom,0px) + 10px);max-height:72dvh;overflow:auto;border-radius:22px!important;padding:14px!important;background:linear-gradient(180deg,#1b3120,#09150e)!important;border:1px solid rgba(232,191,99,.24)!important;box-shadow:0 24px 70px rgba(0,0,0,.56)}#m2RaceV2 .m2race-route-sheet[hidden]{display:none!important}.m2race-route-sheet-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:9px}.m2race-route-close{width:34px;height:34px;border-radius:10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.05);color:#fff;font:inherit;font-weight:900}.m2race-route-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}.m2race-route-seq{font-size:.62rem!important}.m2race-route-times{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px}.m2race-route-times>div{padding:8px;border-radius:11px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06)}.m2race-route-times span{display:block;font-size:.46rem;color:#829087}.m2race-route-times strong{display:block;margin-top:3px;font-size:.72rem}
      #m2RaceV2 .m2race-qr-panel{position:fixed!important;z-index:100160!important;inset:0!important;margin:0!important;padding:calc(env(safe-area-inset-top,0px) + 14px) 12px calc(env(safe-area-inset-bottom,0px) + 14px)!important;border-radius:0!important;background:rgba(3,9,5,.97)!important;display:grid;grid-template-rows:minmax(0,1fr) auto auto auto;align-items:center}.m2race-qr-panel[hidden]{display:none!important}.m2race-qr-video{width:100%!important;height:100%!important;max-height:none!important;object-fit:cover!important;border-radius:18px!important}.m2race-qr-status{font-size:.68rem!important;text-align:center}.m2race-qr-close{min-height:44px!important}
      #m2RaceV2 .m2race-result{position:absolute;inset:70px 10px 10px;z-index:8;display:grid;place-content:center;border-radius:20px;background:#0b1c11}.m2race-result[hidden]{display:none!important}
      #m2RaceV2 .m2race-event{display:none!important}
      @media(max-height:720px){#m2RaceV2 .m2race-top{min-height:46px}.m2race-logo{width:38px!important;height:38px!important}.m2race-back{width:36px!important;height:36px!important}.m2race-dashboard{padding:8px!important;gap:5px!important}.m2race-time{font-size:2.65rem!important}.m2race-control-card{padding:7px!important;gap:4px!important}.m2race-next{font-size:2rem!important}.m2race-control-status{max-height:34px!important}.m2race-qr-btn{min-height:40px!important}.m2race-gpsbar{padding:5px 7px!important}.m2race-actions-row button{min-height:40px!important}.m2race-system-strip{display:none!important}}
      @media(max-width:430px){#m2RaceV2{padding-left:6px!important;padding-right:6px!important}.m2race-shell{gap:6px!important}.m2race-top{grid-template-columns:36px 38px minmax(0,1fr) auto!important}.m2race-live span:last-child{font-size:.47rem}.m2race-dashboard{border-radius:17px!important}.m2race-clock-sub{gap:12px}.m2race-control-status{font-size:.53rem!important}.m2race-system-chip{font-size:.42rem!important}}
    `;document.head.appendChild(st);
  }
  function installR6DStyle(){
    if(document.getElementById("m2RaceR6DStyle"))return;
    const st=document.createElement("style");st.id="m2RaceR6DStyle";st.textContent=`
      #m2RaceV2{background:radial-gradient(circle at 50% -10%,#1a3b25 0,#09170f 31%,#050a07 76%)!important}
      #m2RaceV2 .m2race-shell{grid-template-rows:auto minmax(0,1fr) auto!important;gap:6px!important}
      #m2RaceV2 .m2race-top{min-height:46px!important;grid-template-columns:34px 38px minmax(0,1fr) auto!important;padding:4px 6px!important;border-radius:14px!important}.m2race-back{width:34px!important;height:34px!important;border-radius:10px!important;font-size:1rem!important}.m2race-logo{width:38px!important;height:38px!important;border-radius:11px!important}.m2race-kicker{font-size:.50rem!important;letter-spacing:.13em!important}.m2race-title{font-size:.92rem!important;margin-top:1px!important}.m2race-live{padding:5px 7px!important;font-size:.49rem!important;gap:5px!important}.m2race-dot{width:6px!important;height:6px!important;box-shadow:0 0 0 3px rgba(115,213,141,.10)!important}
      #m2RaceV2 .m2race-dashboard{padding:8px!important;gap:5px!important;border-radius:18px!important;grid-template-rows:auto auto auto minmax(0,1fr)!important}
      #m2RaceV2 .m2race-hero-line{min-height:24px}.m2race-identity b{padding:4px 6px!important;font-size:.50rem!important;border-radius:8px!important}
      #m2RaceV2 .m2race-clock-wrap{padding:0!important}.m2race-time{font-size:clamp(2.55rem,12vw,4rem)!important;line-height:.91!important;margin:0!important}.m2race-time-label{margin-top:3px!important;font-size:.54rem!important}.m2race-clock-sub{margin-top:3px!important;font-size:.50rem!important;gap:14px!important}
      #m2RaceV2 .m2race-progress-head{margin-bottom:4px!important;font-size:.50rem!important}.m2race-progress-head strong{font-size:.57rem!important}.m2race-progress-track{height:8px!important}
      #m2RaceV2 .m2race-control-card{padding:8px!important;gap:4px!important;overflow:hidden!important;border-radius:16px!important;grid-template-rows:auto auto auto auto auto auto!important;background:radial-gradient(circle at 85% 0,rgba(237,194,86,.09),transparent 34%),rgba(8,20,13,.72)!important}
      #m2RaceV2 .m2race-control-head{min-height:18px!important}.m2race-control-kicker{font-size:.52rem!important;color:#d9c17b!important;letter-spacing:.11em!important}.m2race-control-progress{display:block!important;font-size:.49rem!important;color:#aeb9af!important}
      #m2RaceV2 .m2race-next{font-size:clamp(2.35rem,11vw,3.85rem)!important;line-height:.92!important;margin:0!important;color:#ffe39b!important}.m2race-next.complete{font-size:clamp(1.35rem,7vw,2rem)!important}
      #m2RaceV2 .m2race-control-meta{display:none!important}.m2race-validation-strip{display:flex;justify-content:center;gap:6px;flex-wrap:wrap}.m2race-validation-chip{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.025);color:#99a89d;font-size:.47rem;font-weight:900;letter-spacing:.055em}.m2race-validation-chip.is-gps{color:#c9e4cf;border-color:rgba(108,202,132,.17);background:rgba(88,176,111,.06)}.m2race-validation-chip i{width:5px;height:5px;border-radius:50%;background:#76d68e;box-shadow:0 0 0 3px rgba(118,214,142,.08)}
      #m2RaceV2 .m2race-control-status{min-height:27px!important;max-height:36px!important;padding:6px 8px!important;font-size:.53rem!important;display:flex;align-items:center;justify-content:center;text-align:center;background:rgba(0,0,0,.12)!important}
      #m2RaceV2 .m2race-qr-btn{min-height:42px!important;border-radius:12px!important;font-size:.64rem!important;letter-spacing:.055em!important;background:linear-gradient(180deg,#f0cc72,#d7a844)!important;color:#201604!important}.m2race-discard-btn{min-height:31px!important;border-radius:10px!important;font-size:.53rem!important}
      #m2RaceV2 .m2race-bottom{gap:5px!important}.m2race-gpsbar{padding:5px 7px!important;border-radius:12px!important;min-height:39px}.m2race-gps-icon{width:28px!important;height:28px!important;border-radius:9px!important}.m2race-gps-title{font-size:.50rem!important}.m2race-gps-text{font-size:.48rem!important}.m2race-gps-pill{font-size:.45rem!important;padding:4px 6px!important}.m2race-gps-btn{min-height:34px!important;font-size:.56rem!important}
      #m2RaceV2.m2race-is-racing .m2race-gpsbar{grid-template-columns:auto minmax(0,1fr) auto!important;min-height:34px!important;padding:4px 7px!important}.m2race-is-racing .m2race-gps-text{display:none!important}.m2race-is-racing .m2race-gps-icon{width:25px!important;height:25px!important;font-size:.78rem!important}.m2race-is-racing .m2race-gps-title{font-size:.48rem!important}
      #m2RaceV2 .m2race-actions-row{grid-template-columns:minmax(0,.62fr) minmax(0,1.38fr)!important;gap:5px!important}.m2race-route-toggle,.m2race-action{min-height:40px!important;border-radius:11px!important;font-size:.58rem!important}.m2race-finish{font-size:.60rem!important}
      #m2RaceV2 .m2race-system-strip{gap:4px!important}.m2race-system-chip{padding:3px 5px!important;border-radius:8px!important;font-size:.41rem!important}.m2race-track-pill,.m2race-resilience-pill{font-size:.39rem!important;padding:2px 4px!important}
      @media(max-height:760px){#m2RaceV2 .m2race-top{min-height:42px!important}.m2race-time{font-size:2.45rem!important}.m2race-next{font-size:2.25rem!important}.m2race-control-status{max-height:31px!important}.m2race-validation-chip{padding:4px 6px!important;font-size:.43rem!important}.m2race-qr-btn{min-height:38px!important}.m2race-discard-btn{min-height:28px!important}.m2race-gpsbar{min-height:32px!important}.m2race-actions-row button{min-height:36px!important}.m2race-system-strip{display:grid!important}}
      @media(max-height:660px){#m2RaceV2 .m2race-system-strip{display:none!important}.m2race-clock-sub{display:none!important}.m2race-control-status{display:none!important}.m2race-validation-strip{gap:4px!important}.m2race-validation-chip{font-size:.40rem!important}.m2race-qr-btn{min-height:36px!important}}
    `;document.head.appendChild(st);
  }
  function installR6EStyle(){
    if(document.getElementById("m2RaceR6EStyle"))return;
    const st=document.createElement("style");st.id="m2RaceR6EStyle";st.textContent=`
      #m2RaceV2 .m2race-dashboard{grid-template-rows:auto auto minmax(0,1fr)!important;gap:6px!important}
      #m2RaceV2 .m2race-performance{padding:8px 10px 9px;border-radius:17px;border:1px solid rgba(238,205,118,.20);background:radial-gradient(circle at 50% -20%,rgba(238,205,118,.13),transparent 53%),rgba(3,13,8,.34);box-shadow:inset 0 1px 0 rgba(255,255,255,.025)}
      #m2RaceV2.m2race-is-racing .m2race-performance{padding:10px 11px 10px;border-color:rgba(238,205,118,.29);background:radial-gradient(circle at 50% -24%,rgba(238,205,118,.18),transparent 55%),rgba(3,13,8,.42)}
      #m2RaceV2.m2race-is-racing .m2race-time{font-size:clamp(3.15rem,15.5vw,5.15rem)!important;line-height:.88!important}.m2race-is-racing .m2race-time-label{font-size:.61rem!important;color:#f0d58a!important}.m2race-is-racing .m2race-clock-sub{margin-top:6px!important;gap:20px!important;font-size:.65rem!important}.m2race-is-racing .m2race-clock-sub span{padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.055)}.m2race-is-racing .m2race-clock-sub b{font-size:.72rem!important;color:#fff1c7!important}
      #m2RaceV2 .m2race-progress{margin-top:8px!important;padding-top:8px!important;border-top:1px solid rgba(255,255,255,.06)}.m2race-progress-track{height:10px!important}.m2race-progress-sequence{display:flex;align-items:center;gap:5px;margin-top:7px;overflow-x:auto;padding:1px 1px 3px;scrollbar-width:none;-webkit-overflow-scrolling:touch}.m2race-progress-sequence::-webkit-scrollbar{display:none}.m2race-progress-node{flex:0 0 auto;min-width:34px;height:25px;padding:0 7px;border-radius:999px;border:1px solid rgba(255,255,255,.08);display:inline-flex;align-items:center;justify-content:center;gap:4px;background:rgba(255,255,255,.025);color:#708077;font-size:.48rem;font-weight:950;letter-spacing:.025em;transition:.2s ease}.m2race-progress-node.done{background:rgba(86,171,105,.16);border-color:rgba(103,202,126,.28);color:#d5efd8}.m2race-progress-node.done::before{content:"✓";font-size:.50rem}.m2race-progress-node.current{background:linear-gradient(180deg,#f0c96e,#d8a947);border-color:#f2d284;color:#221705;box-shadow:0 0 0 3px rgba(232,187,83,.10),0 5px 14px rgba(144,96,20,.17);animation:m2raceCurrentControl 1.45s ease-in-out infinite}.m2race-progress-node.finish{min-width:29px}.m2race-progress-node.finish.done{background:rgba(86,171,105,.16);color:#d5efd8}.m2race-progress-node.start{min-width:29px}.m2race-progress-node.start.done{background:rgba(86,171,105,.16);color:#d5efd8}@keyframes m2raceCurrentControl{0%,100%{filter:brightness(1)}50%{filter:brightness(1.14)}}
      #m2RaceV2 .m2race-control-card{padding:6px 8px!important;gap:3px!important;border-radius:14px!important;overflow:hidden!important;grid-template-rows:auto auto auto auto!important}.m2race-control-head{min-height:16px!important}.m2race-control-kicker{font-size:.48rem!important}.m2race-control-progress{font-size:.46rem!important}.m2race-next{font-size:clamp(2.35rem,11vw,3.85rem)!important;margin:1px 0 0!important}.m2race-validation-strip{gap:4px!important}.m2race-validation-chip{padding:3px 6px!important;font-size:.40rem!important}.m2race-control-status{min-height:24px!important;max-height:28px!important;padding:4px 7px!important;font-size:.47rem!important}.m2race-control-actions{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,.72fr);gap:5px}.m2race-control-actions .m2race-qr-btn,.m2race-control-actions .m2race-discard-btn{width:100%!important;min-height:31px!important;height:31px!important;margin:0!important;border-radius:9px!important;font-size:.49rem!important;letter-spacing:.025em!important}.m2race-control-actions .m2race-discard-btn{color:#ffd6c6!important}.m2race-control-actions .m2race-qr-btn[hidden],.m2race-control-actions .m2race-discard-btn[hidden]{display:none!important}.m2race-discard-confirm{bottom:6px!important;left:6px!important;right:6px!important}
      @media(max-height:760px){#m2RaceV2 .m2race-performance{padding:6px 8px 7px!important}.m2race-is-racing .m2race-time{font-size:3.15rem!important}.m2race-progress-sequence{margin-top:5px!important}.m2race-progress-node{height:22px;min-width:31px;padding:0 6px;font-size:.44rem}.m2race-control-status{display:none!important}.m2race-validation-strip{display:none!important}.m2race-control-actions .m2race-qr-btn,.m2race-control-actions .m2race-discard-btn{min-height:29px!important;height:29px!important}}
      @media(max-height:670px){#m2RaceV2 .m2race-progress-sequence{margin-top:4px!important}.m2race-progress-node{height:20px;min-width:29px}.m2race-is-racing .m2race-clock-sub{margin-top:3px!important}.m2race-control-head{display:none!important}}
      @media(prefers-reduced-motion:reduce){.m2race-progress-node.current{animation:none!important}}
    `;document.head.appendChild(st);
  }
  function ensureRoot(){
    installStyle();installR6BStyle();installR6DStyle();installR6EStyle();
    if(state.root?.isConnected)return state.root;
    const root=document.createElement("section");
    root.id="m2RaceV2";root.hidden=true;
    root.innerHTML=`<div class="m2race-shell">
      <header class="m2race-top"><button id="m2raceBack" class="m2race-back" type="button" aria-label="Volver">←</button><div class="m2race-logo"><img src="${runnerLogoSrc()}" alt="MILITOPO"></div><div class="m2race-brand"><div class="m2race-kicker">MILITOPO · COMPETICIÓN</div><h1 id="m2raceTitle" class="m2race-title">Carrera</h1></div><div class="m2race-live"><span class="m2race-dot"></span><span>EN DIRECTO</span></div></header>
      <main class="m2race-dashboard">
        <div class="m2race-hero-line"><div class="m2race-identity"><b id="m2raceState">PREPARADO</b><b id="m2raceRouteId">—</b><span id="m2raceEvent">Conectando…</span></div></div>
        <section class="m2race-performance"><div class="m2race-clock-wrap"><div id="m2raceTimer" class="m2race-time">00:00</div><div class="m2race-time-label">TIEMPO OFICIAL</div><div class="m2race-clock-sub"><span>REAL <b id="m2raceRealMini">00:00</b></span><span>PEN. <b id="m2racePenaltyMini">+00:00</b></span></div></div><div class="m2race-progress"><div class="m2race-progress-head"><span>PROGRESO DEL RECORRIDO</span><strong id="m2raceProgressLabel">0 DE 0</strong></div><div class="m2race-progress-track"><div id="m2raceProgressFill" class="m2race-progress-fill"></div></div><div id="m2raceProgressSequence" class="m2race-progress-sequence" aria-label="Orden de balizas"></div></div></section>
        <section id="m2raceControlCard" class="m2race-control-card"><div class="m2race-control-head"><div class="m2race-control-kicker">SIGUIENTE BALIZA</div><div id="m2raceControlProgress" class="m2race-control-progress">0 DE 0</div></div><div id="m2raceNextControl" class="m2race-next">SALIDA</div><div class="m2race-validation-strip"><span class="m2race-validation-chip is-gps"><i></i>GPS AUTOMÁTICO</span><span class="m2race-validation-chip is-qr">QR DE RESPALDO</span></div><div id="m2raceControlStatus" class="m2race-control-status">Activa el GPS para habilitar la salida.</div><div id="m2racePenaltyPreview" class="m2race-penalty-preview"><div><span>DESCARTADAS</span><strong id="m2raceDiscardedControls">0</strong></div><div><span>PENALIZACIÓN</span><strong id="m2racePenaltyTime">+00:00</strong></div><div><span>OFICIAL</span><strong id="m2raceOfficialPreview">00:00</strong></div></div><div class="m2race-control-actions"><button id="m2raceQrOpen" class="m2race-qr-btn" type="button" hidden>ESCANEAR QR</button><button id="m2raceDiscard" class="m2race-discard-btn" type="button" hidden><span>DESCARTAR · 5s</span></button></div><div id="m2raceDiscardConfirm" class="m2race-discard-confirm" hidden><strong id="m2raceDiscardTitle">¿Descartar esta baliza?</strong><br>Es irreversible y añade <b>+15:00</b> al TIEMPO OFICIAL.<div class="m2race-discard-actions"><button id="m2raceDiscardCancel" class="m2race-discard-cancel" type="button">CANCELAR</button><button id="m2raceDiscardOk" class="m2race-discard-ok" type="button">SÍ · DESCARTAR</button></div></div><div id="m2raceQrPanel" class="m2race-qr-panel" hidden><video id="m2raceQrVideo" class="m2race-qr-video" playsinline muted></video><canvas id="m2raceQrCanvas" hidden></canvas><div id="m2raceQrStatus" class="m2race-qr-status">Preparando cámara…</div><label class="m2race-qr-fallback" for="m2raceQrPhoto">USAR CÁMARA NATIVA<input id="m2raceQrPhoto" type="file" accept="image/*" capture="environment" hidden></label><button id="m2raceQrClose" class="m2race-qr-close" type="button">CERRAR CÁMARA</button></div></section>
      </main>
      <footer class="m2race-bottom">
        <section class="m2race-gpsbar"><div class="m2race-gps-icon">◎</div><div><div class="m2race-gps-title">GPS OBLIGATORIO</div><div id="m2raceGpsText" class="m2race-gps-text">Actívalo antes de iniciar el recorrido.</div></div><span id="m2raceGpsPill" class="m2race-gps-pill">SIN ACTIVAR</span><button id="m2raceGpsActivate" class="m2race-gps-btn" type="button">ACTIVAR GPS</button></section>
        <div class="m2race-actions-row"><button id="m2raceRouteToggle" class="m2race-route-toggle" type="button">VER RECORRIDO</button><section id="m2raceActionCard"><button id="m2raceStart" class="m2race-action m2race-start" type="button" disabled>ACTIVA GPS PARA INICIAR</button><button id="m2raceFinish" class="m2race-action m2race-finish" type="button" hidden>TERMINAR CARRERA</button><div id="m2raceConfirm" class="m2race-confirm"><p>¿Quieres terminar la carrera ahora? Si faltan balizas o LLEGADA, el resultado quedará INCOMPLETO.</p><div class="m2race-confirm-actions"><button id="m2raceCancelFinish" class="m2race-mini" type="button">SEGUIR</button><button id="m2raceConfirmFinish" class="m2race-mini primary" type="button">SÍ · TERMINAR</button></div></div><div id="m2raceActionNote" class="m2race-note m2race-action-note"></div></section></div>
        <div class="m2race-system-strip"><div class="m2race-system-chip"><span id="m2raceTrackPill" class="m2race-track-pill">LISTO</span><strong>TRACK</strong><span id="m2raceTrackText" class="m2race-track-text">Listo</span></div><div class="m2race-system-chip"><span id="m2raceResiliencePill" class="m2race-resilience-pill">PROTEGIDO</span><strong>OFFLINE</strong><span id="m2raceResilienceText" class="m2race-resilience-text">Protegido</span></div><div class="m2race-system-chip"><div class="m2race-sync"><span class="m2race-sync-dot"></span><div><strong id="m2raceSyncTitle">SINCRONIZANDO</strong><br><span id="m2raceSyncText">Live V2</span></div></div></div></div>
      </footer>
      <section id="m2raceRouteCard" class="m2race-route-sheet" hidden><div class="m2race-route-sheet-head"><div class="m2race-route-title">🧭 MI RECORRIDO ASIGNADO</div><button id="m2raceRouteClose" class="m2race-route-close" type="button">×</button></div><div class="m2race-route-grid"><div class="m2race-route-stat"><span>DISTANCIA</span><strong id="m2raceRouteDistance">—</strong></div><div class="m2race-route-stat"><span>BALIZAS</span><strong id="m2raceRouteControls">—</strong></div><div class="m2race-route-stat"><span>DESNIVEL +</span><strong id="m2raceRouteClimb">—</strong></div><div class="m2race-route-stat"><span>DIFICULTAD</span><strong id="m2raceRouteDifficulty">—</strong></div></div><div id="m2raceRouteSequence" class="m2race-route-seq">Esperando recorrido…</div><div class="m2race-route-times"><div><span>SALIDA</span><strong id="m2raceStartAt">—</strong></div><div><span>LLEGADA</span><strong id="m2raceFinishAt">—</strong></div></div></section>
      <section id="m2raceResult" class="m2race-card m2race-result" hidden><div class="m2race-result-icon">✓</div><h2>Recorrido finalizado</h2><p id="m2raceResultText">Resultado sincronizado con el organizador.</p></section>
    </div>
    <div id="m2raceStartConfirm" class="m2race-start-confirm" role="dialog" aria-modal="true" aria-labelledby="m2raceStartConfirmTitle"><div class="m2race-start-sheet"><div class="m2race-start-icon">🏁</div><h2 id="m2raceStartConfirmTitle">¿Iniciar recorrido?</h2><p>El GPS ya está preparado. Al confirmar comienza el TIEMPO OFICIAL y se registra tu salida.</p><div class="m2race-start-choice"><button id="m2raceStartNo" class="m2race-start-no" type="button">TODAVÍA NO</button><button id="m2raceStartYes" class="m2race-start-yes" type="button">SÍ · INICIAR</button></div></div></div>
    <div id="m2raceSummary" class="m2race-summary" role="dialog" aria-modal="true" aria-labelledby="m2raceSummaryTitle"><div class="m2race-summary-sheet"><div class="m2race-summary-check">✓</div><h2 id="m2raceSummaryTitle">Carrera terminada</h2><p id="m2raceSummarySub" class="m2race-summary-sub">Resultado sincronizado correctamente.</p><div class="m2race-summary-grid"><div class="m2race-summary-stat"><span>TIEMPO OFICIAL</span><strong id="m2sumTime">—</strong></div><div class="m2race-summary-stat"><span>TIEMPO REAL</span><strong id="m2sumRealTime">—</strong></div><div class="m2race-summary-stat"><span>PENALIZACIÓN</span><strong id="m2sumPenalty">—</strong></div><div class="m2race-summary-stat"><span>PENDIENTES</span><strong id="m2sumPending">0</strong></div><div class="m2race-summary-stat"><span>DESCARTADAS</span><strong id="m2sumDiscarded">0</strong></div><div class="m2race-summary-stat"><span>DISTANCIA GPS</span><strong id="m2sumTrack">—</strong></div><div class="m2race-summary-stat"><span>DISTANCIA REDUCIDA</span><strong id="m2sumReduced">—</strong></div><div class="m2race-summary-stat"><span>BALIZAS</span><strong id="m2sumControls">—</strong></div><div class="m2race-summary-stat"><span>VELOCIDAD MEDIA</span><strong id="m2sumSpeed">—</strong></div><div class="m2race-summary-stat"><span>RITMO MEDIO</span><strong id="m2sumPace">—</strong></div><div class="m2race-summary-stat"><span>PUNTOS GPS</span><strong id="m2sumPoints">—</strong></div><div class="m2race-summary-stat"><span>LLEGADA</span><strong id="m2sumArrival">—</strong></div></div><div class="m2race-summary-ranks"><div class="m2race-summary-rank"><span>CLASIFICACIÓN GENERAL</span><strong id="m2sumGeneralRank">—</strong></div><div class="m2race-summary-rank"><span id="m2sumRouteLabel">MI RECORRIDO</span><strong id="m2sumRouteRank">—</strong></div></div><div class="m2race-summary-actions"><button id="m2raceSummaryClose" class="m2race-summary-close" type="button">SEGUIR VIENDO</button><button id="m2raceSummaryDone" class="m2race-summary-done" type="button">MIS CARRERAS</button></div></div></div>
    <div id="m2raceBusy" class="m2race-busy"><div class="m2race-busy-card"><div class="m2race-spinner"></div><strong id="m2raceBusyTitle">Procesando…</strong><span id="m2raceBusyText">Sincronizando con Live V2.</span></div></div>`;
    document.body.appendChild(root);state.root=root;
    root.querySelector("#m2raceBack").addEventListener("click",close);
    const setRouteOpen=open=>{const card=root.querySelector("#m2raceRouteCard"),btn=root.querySelector("#m2raceRouteToggle");if(!card)return;card.hidden=!open;if(btn)btn.textContent=open?"OCULTAR RECORRIDO":"VER RECORRIDO";};
    root.querySelector("#m2raceRouteToggle").addEventListener("click",()=>setRouteOpen(root.querySelector("#m2raceRouteCard").hidden));
    root.querySelector("#m2raceRouteClose").addEventListener("click",()=>setRouteOpen(false));
    root.querySelector("#m2raceStart").addEventListener("click",()=>{if(root.querySelector("#m2raceStart").disabled)return;root.querySelector("#m2raceStartConfirm").classList.add("open");});
    root.querySelector("#m2raceFinish").addEventListener("click",()=>root.querySelector("#m2raceConfirm").classList.add("open"));
    root.querySelector("#m2raceStartNo").addEventListener("click",()=>root.querySelector("#m2raceStartConfirm").classList.remove("open"));
    root.querySelector("#m2raceStartYes").addEventListener("click",()=>{root.querySelector("#m2raceStartConfirm").classList.remove("open");startRace();});
    root.querySelector("#m2raceCancelFinish").addEventListener("click",()=>root.querySelector("#m2raceConfirm").classList.remove("open"));
    root.querySelector("#m2raceConfirmFinish").addEventListener("click",finishRace);
    root.querySelector("#m2raceGpsActivate").addEventListener("click",activateGps);
    root.querySelector("#m2raceQrClose").addEventListener("click",closeQrScanner);
    const discardBtn=root.querySelector("#m2raceDiscard"),discardConfirm=root.querySelector("#m2raceDiscardConfirm");let discardHoldTimer=0,discardHoldStart=0,discardRaf=0;
    const resetDiscardHold=()=>{clearTimeout(discardHoldTimer);discardHoldTimer=0;cancelAnimationFrame(discardRaf);discardRaf=0;discardHoldStart=0;if(discardBtn)discardBtn.style.setProperty("--hold","0%");};
    const animateDiscardHold=()=>{if(!discardHoldStart)return;const pct=Math.min(100,((performance.now()-discardHoldStart)/5000)*100);discardBtn.style.setProperty("--hold",`${pct}%`);if(pct<100)discardRaf=requestAnimationFrame(animateDiscardHold);};
    const beginDiscardHold=e=>{if(discardBtn?.hidden||discardBtn?.disabled)return;e.preventDefault();resetDiscardHold();discardHoldStart=performance.now();discardRaf=requestAnimationFrame(animateDiscardHold);discardHoldTimer=setTimeout(()=>{resetDiscardHold();const snap=controlsApi()?.snapshot?.()||{},id=String(snap.nextControl?.checkpointId||"").trim();if(!id||id.toUpperCase()==="FINISH")return;discardConfirm.dataset.checkpointId=id;root.querySelector("#m2raceDiscardTitle").textContent=`¿Descartar ${id}?`;discardConfirm.hidden=false;},5000);};
    discardBtn?.addEventListener("pointerdown",beginDiscardHold);["pointerup","pointercancel","pointerleave"].forEach(ev=>discardBtn?.addEventListener(ev,resetDiscardHold));
    root.querySelector("#m2raceDiscardCancel")?.addEventListener("click",()=>{discardConfirm.hidden=true;discardConfirm.dataset.checkpointId="";});
    root.querySelector("#m2raceDiscardOk")?.addEventListener("click",()=>{const okBtn=root.querySelector("#m2raceDiscardOk");if(okBtn?.disabled)return;const expected=String(discardConfirm.dataset.checkpointId||"").trim();if(okBtn)okBtn.disabled=true;const res=controlsApi()?.discardNextControl?.(expected);discardConfirm.hidden=true;discardConfirm.dataset.checkpointId="";if(okBtn)okBtn.disabled=false;if(!res?.ok){const st=root.querySelector("#m2raceControlStatus");if(st){st.className="m2race-control-status warn";st.textContent=res?.message||"No se pudo descartar la baliza.";}}});
    root.querySelector("#m2raceSummaryClose").addEventListener("click",()=>{root.querySelector("#m2raceSummary").classList.remove("open");state.summaryOpen=false;});
    root.querySelector("#m2raceSummaryDone").addEventListener("click",()=>{root.querySelector("#m2raceSummary").classList.remove("open");state.summaryOpen=false;close();});
    root.querySelector("#m2raceQrPhoto").addEventListener("change",async event=>{const file=event.target?.files?.[0]||null,status=root.querySelector("#m2raceQrStatus"),api=controlsApi();if(!file)return;if(status)status.textContent="Leyendo QR desde la cámara del móvil…";try{await api?.scanImageFile?.(file,{canvas:root.querySelector("#m2raceQrCanvas"),statusEl:status});}catch(error){if(status)status.textContent=`No se pudo leer la imagen: ${String(error?.message||error)}`;}finally{try{event.target.value="";}catch(_){}}});
    return root;
  }
  const el=id=>ensureRoot().querySelector("#"+id);
  function busy(title,text){state.busy=true;el("m2raceBusyTitle").textContent=title;el("m2raceBusyText").textContent=text;el("m2raceBusy").classList.add("open");}
  function unbusy(){state.busy=false;el("m2raceBusy").classList.remove("open");}
  const fmtTrackKm=m=>Number.isFinite(Number(m))?`${(Number(m)/1000).toFixed(2)} km`:"—";
  const fmtPace=v=>{const n=Number(v);if(!Number.isFinite(n)||n<=0)return "—";const min=Math.floor(n),sec=Math.round((n-min)*60);return `${min}:${String(sec===60?0:sec).padStart(2,"0")} min/km`;};
  function penaltyPreviewValues(detail={}){
    const snap=controlsApi()?.snapshot?.()||{};
    const expected=Math.max(0,Number(detail.expectedCount??snap.expectedCount??0));
    const completed=Math.min(expected,Math.max(0,Number(detail.completedCount??snap.completedCount??0)));
    const discarded=Math.max(0,Number(detail.discardedControlCount??snap.discardedControlCount??0));
    const pending=Math.max(0,Number(detail.pendingControlCount??snap.pendingControlCount??(expected-completed)));
    const penaltyMs=Math.max(0,Number(detail.penaltyAccumulatedMs??detail.penaltyPreviewMs??snap.penaltyAccumulatedMs??snap.penaltyPreviewMs??(discarded*CONTROL_PENALTY_MS)));
    const row=state.participant||{},start=Number(row.startedAt||0),finish=Number(row.finishedAt||0)||Number(state.localArrivalAt||0);
    const rawMs=start?Math.max(0,(finish||Date.now())-start):0;
    return {expected,completed,discarded,pending,penaltyMs,rawMs,officialMs:rawMs+penaltyMs};
  }
  function updatePenaltyPreview(detail={}){
    const v=penaltyPreviewValues(detail),st=String(state.participant?.status||"").toLowerCase(),active=["racing","started"].includes(st)||st==="finished";
    const timer=el("m2raceTimer"),realMini=el("m2raceRealMini"),penMini=el("m2racePenaltyMini");
    if(timer)timer.textContent=fmtClock(v.officialMs);if(realMini)realMini.textContent=fmtClock(v.rawMs);if(penMini)penMini.textContent=`+${fmtClock(v.penaltyMs)}`;
    const box=el("m2racePenaltyPreview");if(box)box.hidden=!active;
    const d=el("m2raceDiscardedControls"),p=el("m2racePenaltyTime"),o=el("m2raceOfficialPreview");if(d)d.textContent=String(v.discarded);if(p)p.textContent=`+${fmtClock(v.penaltyMs)}`;if(o)o.textContent=fmtClock(v.officialMs);
  }

  async function showFinishSummary({incomplete=false}={}){
    const panel=el("m2raceSummary");if(!panel)return;state.summaryOpen=true;
    el("m2raceSummaryTitle").textContent=incomplete?"Carrera terminada · INCOMPLETA":"Carrera terminada ✓";
    el("m2raceSummarySub").textContent=incomplete?"La carrera se ha cerrado y sincronizado, pero faltaban controles o LLEGADA.":"Balizas, llegada, track y resultado están sincronizados con el organizador.";
    const basic=state.participant||{};
    const rawFallback=basic.startedAt&&basic.finishedAt?Math.max(0,Number(basic.finishedAt)-Number(basic.startedAt)):null;
    const cs=controlsApi()?.snapshot?.()||{};
    const pendingFallback=Math.max(0,Number(cs.pendingControlCount??Math.max(0,Number(cs.expectedCount||0)-Number(cs.completedCount||0))));
    const discardedFallback=Math.max(0,Number(cs.discardedControlCount||0));
    const penaltyFallback=(pendingFallback+discardedFallback)*CONTROL_PENALTY_MS;
    el("m2sumRealTime").textContent=rawFallback==null?"—":fmtClock(rawFallback);
    el("m2sumPenalty").textContent=penaltyFallback?`+${fmtClock(penaltyFallback)}`:"—";
    el("m2sumPending").textContent=String(pendingFallback);
    el("m2sumDiscarded").textContent=String(discardedFallback);
    el("m2sumTime").textContent=rawFallback==null?"—":fmtClock(rawFallback+penaltyFallback);
    el("m2sumReduced").textContent=fmtKm(basic.routeDistanceKm);
    el("m2sumControls").textContent=`${Math.max(0,Number(cs.serverCompletedCount??cs.completedCount??0))} / ${Math.max(0,Number(cs.expectedCount||basic.routeControlCount||0))}`;
    el("m2sumArrival").textContent=fmtTime(basic.finishedAt||state.localArrivalAt);
    ["m2sumTrack","m2sumSpeed","m2sumPace","m2sumPoints","m2sumGeneralRank","m2sumRouteRank"].forEach(id=>el(id).textContent="—");
    el("m2sumRouteLabel").textContent=basic.routeId?`${basic.routeId} · MI RECORRIDO`:"MI RECORRIDO";
    panel.classList.add("open");
    try{
      const svc=await services();
      const [detailRes,classRes]=await Promise.allSettled([svc.callable("getRunnerResultDetail",{eventId:state.event.eventId}),svc.callable("getEventClassification",{eventId:state.event.eventId})]);
      if(detailRes.status==="fulfilled"){const r=detailRes.value?.data?.result||{};const raw=r.durationMs==null?null:Math.max(0,Number(r.durationMs||0)),pen=Math.max(0,Number(r.penaltyMs||0)),official=r.officialDurationMs==null?(raw==null?null:raw+pen):Math.max(0,Number(r.officialDurationMs||0));el("m2sumTime").textContent=official==null?el("m2sumTime").textContent:fmtClock(official);el("m2sumRealTime").textContent=raw==null?el("m2sumRealTime").textContent:fmtClock(raw);el("m2sumPenalty").textContent=pen?`+${fmtClock(pen)}`:"—";el("m2sumPending").textContent=String(Math.max(0,Number(r.pendingControlCount??r.controlMissingCount??0)));el("m2sumDiscarded").textContent=String(Math.max(0,Number(r.discardedControlCount||0)));el("m2sumTrack").textContent=fmtTrackKm(r.trackDistanceM);el("m2sumReduced").textContent=r.reducedDistanceKm==null?el("m2sumReduced").textContent:fmtKm(r.reducedDistanceKm);el("m2sumControls").textContent=`${Math.max(0,Number(r.controlDetectedCount||0))} / ${Math.max(0,Number(r.controlExpectedCount||0))}`;el("m2sumSpeed").textContent=r.avgSpeedKmh==null?"—":`${Number(r.avgSpeedKmh).toFixed(2)} km/h`;el("m2sumPace").textContent=fmtPace(r.paceMinKm);el("m2sumPoints").textContent=String(Math.max(0,Number(r.trackPointCount||0)));el("m2sumArrival").textContent=fmtTime(r.finishedAtMs||basic.finishedAt||state.localArrivalAt);}
      if(classRes.status==="fulfilled"){const c=classRes.value?.data||{},my=c.my||{};el("m2sumGeneralRank").textContent=my.generalRank?`${my.generalRank}º de ${Math.max(1,Number(my.generalCount||0))}`:"—";el("m2sumRouteLabel").textContent=my.routeId?`${my.routeId} MI RECORRIDO`:el("m2sumRouteLabel").textContent;el("m2sumRouteRank").textContent=my.routeRank?`${my.routeRank}º de ${Math.max(1,Number(my.routeCount||0))}`:"—";}
    }catch(_){}
  }
  function clearListeners(){try{state.unsubParticipant?.();}catch(_){}try{state.unsubActive?.();}catch(_){}state.unsubParticipant=null;state.unsubActive=null;state.liveBound=false;if(state.timer){clearInterval(state.timer);state.timer=null;}}
  function close(){if(state.busy)return;controlsApi()?.closeScanner?.();ensureRoot().hidden=true;document.body.style.overflow="";window.dispatchEvent(new CustomEvent("militopo:v2-runner-race-closed",{detail:{event:state.event?{...state.event}:null,runId:state.runId,status:String(state.participant?.status||"")}}));}
  function syncStartGate(){
    const btn=el("m2raceStart"),row=state.participant||{},st=String(row.status||"ready").toLowerCase();if(!btn||!["ready","not_started"].includes(st))return;
    const routeReady=Boolean(row.routeId&&row.participantId),gpsReady=Boolean(state.gpsPrepared||gpsApi()?.snapshot?.().active);
    btn.disabled=!routeReady||!gpsReady;
    btn.textContent=!routeReady?"RECORRIDO NO DISPONIBLE":!gpsReady?"ACTIVA GPS PARA INICIAR":"INICIAR RECORRIDO";
  }
  function updateGpsUi(status,detail={}){
    const pill=el("m2raceGpsPill"),text=el("m2raceGpsText"),btn=el("m2raceGpsActivate");
    if(!pill||!text||!btn)return;
    pill.className="m2race-gps-pill";btn.hidden=true;
    const raceStatus=String(state.participant?.status||"ready").toLowerCase(),racing=["racing","started"].includes(raceStatus);
    const fix=detail.fix||state.preStartFix||gpsApi()?.snapshot?.().lastSent||null;
    if(status==="ready"&&!racing){
      if(fix){state.gpsPrepared=true;state.preStartFix={...fix};}
      pill.textContent="GPS LISTO";pill.classList.add("ok");text.textContent=fix?`Preparado · precisión ±${Math.round(Number(fix.accuracy||0))} m. Ya puedes iniciar.`:"GPS preparado. Ya puedes iniciar.";
    }else if(["active","watching","offline_active"].includes(status)||gpsApi()?.snapshot?.().active){
      pill.textContent=status==="offline_active"?"GPS · OFFLINE":"GPS ACTIVO";pill.classList.add(status==="offline_active"?"warn":"ok");
      text.textContent=status==="offline_active"?(detail.message||"Activo sin cobertura · track protegido localmente."):(fix?`Activo · precisión ±${Math.round(Number(fix.accuracy||0))} m.`:"GPS activo · buscando precisión…");
    }else if(status==="requesting"){
      pill.textContent="ACTIVANDO";pill.classList.add("warn");text.textContent="Solicitando permiso y posición GPS…";
    }else if(status==="error"||status==="unsupported"){
      state.gpsPrepared=false;state.preStartFix=null;pill.textContent="SIN GPS";pill.classList.add("warn");text.textContent=detail.message||"No se pudo activar el GPS.";btn.hidden=false;btn.textContent="REINTENTAR GPS";
    }else if(status==="stopped"){
      pill.textContent="DETENIDO";text.textContent="GPS detenido.";if(!racing){state.gpsPrepared=false;state.preStartFix=null;btn.hidden=false;}
    }else{
      pill.textContent=state.gpsPrepared?"GPS LISTO":"SIN ACTIVAR";if(state.gpsPrepared)pill.classList.add("ok");
      text.textContent=state.gpsPrepared?"GPS preparado. Ya puedes iniciar.":"Actívalo antes de iniciar el recorrido.";btn.hidden=Boolean(state.gpsPrepared||racing);btn.textContent="ACTIVAR GPS";
    }
    syncStartGate();
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
  function renderProgressSequence(completed=0,finished=false,finishValidated=false){
    const host=el("m2raceProgressSequence");if(!host)return;
    const controls=(Array.isArray(state.controlPlan?.controls)?state.controlPlan.controls:[]).map(row=>String(row?.checkpointId||"").trim()).filter(Boolean);
    const active=String(state.participant?.status||"").toLowerCase();
    const started=["racing","started","finished"].includes(active);
    const nodes=[`<span class="m2race-progress-node start ${started?"done":"current"}" data-progress-node="start">S</span>`];
    controls.forEach((id,index)=>{const cls=index<completed?"done":(!finished&&index===completed?"current":"");nodes.push(`<span class="m2race-progress-node ${cls}" data-progress-node="${esc(id)}">${esc(id)}</span>`);});
    const finishCurrent=started&&!finished&&completed>=controls.length&&!finishValidated;
    nodes.push(`<span class="m2race-progress-node finish ${finishValidated||finished?"done":finishCurrent?"current":""}" data-progress-node="finish">L</span>`);
    host.innerHTML=nodes.join("");
    const current=host.querySelector(".m2race-progress-node.current");if(current)requestAnimationFrame(()=>{try{current.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"})}catch(_){}});
  }
  function updateControlUi(status="status",detail={}){
    const api=controlsApi(),snap=api?.snapshot?.()||{},card=el("m2raceControlCard"),nextEl=el("m2raceNextControl"),progressEl=el("m2raceControlProgress"),statusEl=el("m2raceControlStatus"),qrBtn=el("m2raceQrOpen"),discardBtn=el("m2raceDiscard"),discardConfirm=el("m2raceDiscardConfirm"),kicker=card?.querySelector(".m2race-control-kicker");
    if(!card)return;
    const raceStatus=String(state.participant?.status||snap.raceStatus||"ready").toLowerCase(),active=["racing","started"].includes(raceStatus),finished=raceStatus==="finished";
    const expected=Math.max(0,Number(detail.expectedCount??snap.expectedCount??state.participant?.routeControlCount??0));
    const completed=Math.min(expected,Math.max(0,Number(detail.completedCount??snap.completedCount??0))),next=detail.nextControl??snap.nextControl??null,finishValidated=Boolean(detail.finishValidated??snap.finishValidated),pending=Math.max(0,Number(detail.pending??snap.pending??0));
    const progressLabel=el("m2raceProgressLabel"),progressFill=el("m2raceProgressFill");
    const pct=finishValidated||finished?100:(expected?Math.min(100,(completed/expected)*100):0);
    if(progressEl)progressEl.textContent=`${completed} DE ${expected}`;if(progressLabel)progressLabel.textContent=`${completed} DE ${expected}`;if(progressFill)progressFill.style.width=`${pct}%`;
    renderProgressSequence(completed,finished,finishValidated);
    updatePenaltyPreview({...detail,completedCount:completed,expectedCount:expected});
    if(discardConfirm&&!discardConfirm.hidden){const confirmed=String(discardConfirm.dataset.checkpointId||"").trim().toUpperCase(),current=String(next?.checkpointId||"").trim().toUpperCase();if(!confirmed||confirmed!==current){discardConfirm.hidden=true;discardConfirm.dataset.checkpointId="";}}
    if(!active&&!finished){
      if(kicker)kicker.textContent="SALIDA";nextEl.classList.remove("complete");nextEl.textContent="SALIDA";qrBtn.hidden=true;if(discardBtn)discardBtn.hidden=true;if(discardConfirm)discardConfirm.hidden=true;
      statusEl.className="m2race-control-status "+(state.gpsPrepared?"ok":"warn");statusEl.textContent=state.gpsPrepared?"GPS preparado · pulsa INICIAR RECORRIDO para registrar la salida.":"GPS obligatorio · actívalo para habilitar INICIAR RECORRIDO.";return;
    }
    if(finished){if(kicker)kicker.textContent="RECORRIDO";nextEl.textContent="FINALIZADO";nextEl.classList.add("complete");qrBtn.hidden=true;if(discardBtn)discardBtn.hidden=true;statusEl.className="m2race-control-status ok";statusEl.textContent="Resultado registrado y sincronizado.";return;}
    const syncError=String(detail.message&&status==="sync_error"?detail.message:(snap.lastSyncError||""));
    if(!next){nextEl.textContent=finishValidated?"LLEGADA ✓":"LLEGADA";nextEl.classList.add("complete");qrBtn.hidden=true;if(discardBtn)discardBtn.hidden=true;if(discardConfirm)discardConfirm.hidden=true;statusEl.className="m2race-control-status "+(finishValidated?"ok":"warn");statusEl.textContent=finishValidated?"🏁 Llegada registrada · cerrando carrera…":"Valida LLEGADA por GPS o QR.";if(kicker)kicker.textContent="🏁 LLEGADA";return;}
    const isFinish=String(next.checkpointId||"").toUpperCase()==="FINISH"||String(next.kind||"")==="finish";
    if(kicker)kicker.textContent=isFinish?"LLEGADA":"SIGUIENTE BALIZA";nextEl.classList.toggle("complete",isFinish);nextEl.textContent=isFinish?"LLEGADA":String(next.checkpointId||"—");
    qrBtn.hidden=false;if(discardBtn){discardBtn.hidden=isFinish;discardBtn.querySelector("span").textContent="DESCARTAR · 5s";}if(isFinish&&discardConfirm)discardConfirm.hidden=true;qrBtn.textContent=isFinish?"QR LLEGADA":"ESCANEAR QR";
    if(status==="discarded"){const pass=detail.pass||{};statusEl.className="m2race-control-status warn";statusEl.textContent=`${pass.checkpointId||"Baliza"} descartada · +15:00 al TIEMPO OFICIAL.`;}
    else if(status==="passed"||status==="qr_passed"){const pass=detail.pass||{};statusEl.className="m2race-control-status ok";statusEl.textContent=`✓ ${pass.checkpointId||"Baliza"} validada por ${String(pass.source||"").toUpperCase()==="QR"?"QR":"GPS"}.`;
    }else if(status==="arrival_local"||status==="arrival_qr"||status==="arrival_synced"){statusEl.className="m2race-control-status ok";statusEl.textContent="🏁 LLEGADA registrada · sincronizando resultado…";
    }else if(pending>0&&!(["passed","qr_passed","arrival_local","arrival_qr"].includes(status))){statusEl.className="m2race-control-status warn";statusEl.textContent=syncError?`Pendiente de sincronizar · ${pending}. ${syncError}`:`Sincronizando ${pending} validación${pending===1?"":"es"}…`;
    }else if(status==="offline"){statusEl.className="m2race-control-status warn";statusEl.textContent="Sin cobertura · validación protegida en el dispositivo.";
    }else if(status==="sync_error"||status==="qr_error"){statusEl.className="m2race-control-status warn";statusEl.textContent=detail.message||"Pendiente de sincronizar. El registro local está protegido.";
    }else if(status==="gps"){
      statusEl.className="m2race-control-status";
      if(detail.accuracyOk===false)statusEl.textContent=`Señal GPS imprecisa · precisión ±${Math.round(Number(detail.accuracyM||0))} m.`;
      else if(detail.distanceM!=null&&Number(detail.distanceM)<=10){statusEl.className="m2race-control-status ok";statusEl.textContent=isFinish?"LLEGADA detectada · validando…":"Baliza detectada · validando automáticamente…";}
      else statusEl.textContent=isFinish?"GPS activo · busca LLEGADA o usa QR.":"GPS activo · navegación libre. QR disponible como respaldo.";
    }else{statusEl.className="m2race-control-status";statusEl.textContent=isFinish?"Valida LLEGADA por GPS o QR.":"GPS automático · QR disponible como respaldo.";}
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
    ensureRoot().classList.toggle("m2race-is-racing",["racing","started"].includes(st));
    pill.textContent=label;pill.className="m2race-state"+(st==="racing"||st==="started"?" racing":st==="finished"?" finished":"");
    el("m2raceStartAt").textContent=fmtTime(row.startedAt);el("m2raceFinishAt").textContent=fmtTime(row.finishedAt);
    el("m2raceRouteId").textContent=row.participantId&&row.routeId?`${row.participantId} · ${row.routeId}`:(row.routeId||"—");
    el("m2raceRouteDistance").textContent=fmtKm(row.routeDistanceKm);el("m2raceRouteControls").textContent=Number.isFinite(Number(row.routeControlCount))?String(Number(row.routeControlCount)):"—";el("m2raceRouteClimb").textContent=row.routePositiveM==null?"—":`${Number(row.routePositiveM)} m`;el("m2raceRouteDifficulty").textContent=String(row.routeDifficulty||"—");el("m2raceRouteSequence").textContent=routeSequence(row.routePoints)||"Recorrido asignado. Secuencia no disponible.";
    const start=el("m2raceStart"),finish=el("m2raceFinish");start.hidden=!["ready","not_started"].includes(st);finish.hidden=!["racing","started"].includes(st);syncStartGate();
    const hasFinishTarget=Boolean(state.controlPlan?.finish);el("m2raceActionNote").textContent=hasFinishTarget?"LLEGADA finaliza automáticamente por GPS/QR.":"Puedes terminar manualmente cuando lo necesites.";
    const resultText=el("m2raceResultText");if(resultText)resultText.textContent=row.manualFinishIncomplete?"Carrera terminada manualmente como INCOMPLETA.":"Llegada y resultado sincronizados con el organizador.";
    el("m2raceResult").hidden=st!=="finished";if(st==="finished")el("m2raceConfirm").classList.remove("open");updateTimer();controlsApi()?.setRaceStatus?.(st);updateControlUi("status");
    try{window.dispatchEvent(new CustomEvent("militopo:v2-race-participant",{detail:{event:state.event?{...state.event}:null,auth:state.auth?{...state.auth}:null,runId:state.runId,participant:{...row},controlPlan:state.controlPlan?JSON.parse(JSON.stringify(state.controlPlan)):null,localArrivalAt:Number(state.localArrivalAt||0),status:st}}));}catch(_){}emitLocalSnapshot();
    if(st==="finished"){gpsApi()?.stop?.("finished").catch?.(()=>{});controlsApi()?.stop?.();}
    if(["racing","started"].includes(st)&&!gpsApi()?.snapshot?.().active&&!state.gpsTried){state.gpsTried=true;gpsApi()?.resumeIfGranted?.(gpsContext()).catch?.(()=>{});updateGpsUi("idle",{message:"GPS disponible. Actívalo si no se recupera automáticamente."});}
  }
  function updateTimer(){
    if(state.timer){clearInterval(state.timer);state.timer=null;}
    const tick=()=>{const row=state.participant||{},start=Number(row.startedAt||0),serverFinish=Number(row.finishedAt||0),finish=serverFinish||Number(state.localArrivalAt||0),st=String(row.status||"").toLowerCase();updatePenaltyPreview();if((st==="finished"||finish)&&state.timer){clearInterval(state.timer);state.timer=null;}};
    tick();if(["racing","started"].includes(String(state.participant?.status||"").toLowerCase())&&!state.localArrivalAt)state.timer=setInterval(tick,1000);
  }

  async function bind(){
    const svc=await services(),api=svc.databaseApi;if(!api)throw new Error("Realtime Database no disponible.");
    try{state.unsubParticipant?.();}catch(_){}try{state.unsubActive?.();}catch(_){}
    state.unsubParticipant=null;state.unsubActive=null;
    const pRef=api.ref(`v2/live/${state.event.ownerUid}/${state.event.eventId}/runs/${state.runId}/participants/${state.auth.uid}`);
    const activeRef=api.ref(`v2/live/${state.event.ownerUid}/${state.event.eventId}/activeRun`);
    state.unsubParticipant=api.onValue(pRef,snap=>{const remote=snap.val()||{};state.participant={...(state.participant||{}),...remote};render();});
    state.unsubActive=api.onValue(activeRef,snap=>{const a=snap.val()||{};if(String(a.status||"")==="finished"){gpsApi()?.stop?.("event_finished").catch?.(()=>{});el("m2raceSyncTitle").textContent="Evento finalizado";el("m2raceSyncText").textContent="El organizador ha cerrado la sesión Live V2.";try{window.dispatchEvent(new CustomEvent("militopo:v2-race-event-finished",{detail:{event:state.event?{...state.event}:null,runId:state.runId}}));}catch(_){}if(String(state.participant?.status||"")!=="finished"){el("m2raceStart").disabled=true;el("m2raceFinish").disabled=true;}}});
    state.liveBound=true;
  }
  async function restoreLocalRace(snapshot){
    if(!hasUsableRecovery(snapshot))return false;
    state.participant={...(snapshot.participant||{})};
    state.controlPlan=snapshot.controlPlan?JSON.parse(JSON.stringify(snapshot.controlPlan)):null;
    state.localArrivalAt=Math.max(0,Number(snapshot.localArrivalAt||0));
    await controlsApi()?.configure?.({context:gpsContext(),plan:state.controlPlan,progress:null,status:state.participant.status||snapshot.status||"racing"});
    const c=controlsApi()?.snapshot?.()||{};
    if(c.finishValidated)state.localArrivalAt=Math.max(state.localArrivalAt,Number(c.finishPass?.passedAtMs||0));
    state.offlineRecovered=true;
    render();
    el("m2raceSyncTitle").textContent="Carrera recuperada · SIN CONEXIÓN";
    el("m2raceSyncText").textContent="Cronómetro, recorrido, siguiente baliza, GPS y track continúan desde este dispositivo. Se sincronizarán al volver Internet.";
    updateTrackUi((trackApi()?.snapshot?.().pending||0)>0?"offline":"ready",{message:"Track local recuperado. Los puntos nuevos se guardan en el dispositivo."});
    emitLocalSnapshot();
    return true;
  }
  async function reconcileLive(){
    if(!navigator.onLine||!state.event?.eventId||!state.auth?.uid)return false;
    if(state.reconnectPromise)return state.reconnectPromise;
    state.reconnectPromise=(async()=>{
      el("m2raceSyncTitle").textContent="Conexión recuperada";
      el("m2raceSyncText").textContent="Reconciliando carrera, controles y track con Live V2…";
      try{
        const svc=await services();
        const joined=await svc.callable("runnerJoinLive",{eventId:state.event.eventId,clientVersion:VERSION});
        state.runId=String(joined?.data?.runId||state.runId);
        if(joined?.data?.controlPlan)state.controlPlan=joined.data.controlPlan;
        state.participant={...(state.participant||{}),...(joined?.data||{})};
        await controlsApi()?.configure?.({context:gpsContext(),plan:state.controlPlan,progress:joined?.data?.controlProgress||null,status:state.participant?.status||"racing"});
        await bind();
        try{await controlsApi()?.flush?.();}catch(_){}
        try{await trackApi()?.flush?.();}catch(_){}
        state.offlineRecovered=false;
        render();
        el("m2raceSyncTitle").textContent="Carrera sincronizada";
        el("m2raceSyncText").textContent="Conexión Live V2 recuperada. Controles y track pendientes se están sincronizando.";
        emitLocalSnapshot();
        const cs=controlsApi()?.snapshot?.()||{};
        if(cs.finishValidated&&["racing","started"].includes(String(state.participant?.status||"").toLowerCase()))setTimeout(()=>autoFinishFromArrival({pass:cs.finishPass,recovered:true}),180);
        return true;
      }catch(error){
        el("m2raceSyncTitle").textContent="Carrera local protegida";
        el("m2raceSyncText").textContent=`Internet ha vuelto, pero Live V2 todavía no responde. Seguimos guardando localmente y reintentaremos. ${String(error?.message||error)}`;
        setTimeout(()=>{if(navigator.onLine)reconcileLive().catch(()=>{});},2500);
        return false;
      }finally{state.reconnectPromise=null;}
    })();
    return state.reconnectPromise;
  }

  async function open(detail){
    clearListeners();state.event=detail?.event||null;state.auth=detail?.auth||null;state.runId=String(detail?.runId||"");state.recovered=Boolean(detail?.recovered);state.gpsTried=false;state.gpsPrepared=false;state.preStartFix=null;state.controlPlan=null;state.participant=null;state.localArrivalAt=0;state.autoFinishing=false;state.summaryOpen=false;state.offlineRecovered=false;state.reconnectPromise=null;
    if(!state.event||!state.auth||!state.runId)return;
    const recovery=detail?.recoverySnapshot||null;
    const root=ensureRoot();root.hidden=false;document.body.style.overflow="hidden";el("m2raceStartConfirm").classList.remove("open");el("m2raceRouteCard").hidden=true;el("m2raceRouteToggle").textContent="VER RECORRIDO";el("m2raceTitle").textContent=state.event.eventName||"Carrera";el("m2raceEvent").innerHTML=`<strong>${esc(state.auth.displayName||state.auth.username||"Corredor")}</strong> · ${esc(state.event.eventId||"")}`;el("m2raceSyncTitle").textContent=state.recovered?"Recuperando carrera":"Sincronización activa";el("m2raceSyncText").textContent=state.recovered?(navigator.onLine===false?"Restaurando la carrera desde este dispositivo…":"Reconectando con tu sesión Live V2…"):"Conectando a la sesión Live V2…";updateGpsUi("idle");updateTrackUi("ready");
    try{window.dispatchEvent(new CustomEvent("militopo:v2-race-opened",{detail:{event:{...state.event},auth:{...state.auth},runId:state.runId,recovered:state.recovered,recoverySnapshot:recovery}}));}catch(_){}

    if(state.recovered&&navigator.onLine===false&&hasUsableRecovery(recovery)){
      try{await restoreLocalRace(recovery);return;}catch(error){el("m2raceSyncTitle").textContent="Recuperación local incompleta";el("m2raceSyncText").textContent=String(error?.message||error);}
    }
    try{
      const svc=await services();const joined=await svc.callable("runnerJoinLive",{eventId:state.event.eventId,clientVersion:VERSION});
      state.runId=String(joined?.data?.runId||state.runId);state.controlPlan=joined?.data?.controlPlan||recovery?.controlPlan||null;state.participant={...(recovery?.participant||{}),...(joined?.data||{})};
      await controlsApi()?.configure?.({context:gpsContext(),plan:state.controlPlan,progress:joined?.data?.controlProgress||null,status:state.participant?.status||"ready"});
      const controlSnap=controlsApi()?.snapshot?.()||{};if(controlSnap.finishValidated)state.localArrivalAt=Number(controlSnap.finishPass?.passedAtMs||joined?.data?.controlProgress?.arrivalAt||recovery?.localArrivalAt||Date.now());
      render();await bind();el("m2raceSyncTitle").textContent=state.recovered?"Carrera recuperada":"Sincronización activa";el("m2raceSyncText").textContent=state.recovered?"Sesión restaurada. Track, cronómetro y Live V2 continúan.":"Conectado a Realtime Database V2.";emitLocalSnapshot();
      if(controlSnap.finishValidated&&["racing","started"].includes(String(state.participant?.status||"").toLowerCase()))setTimeout(()=>autoFinishFromArrival({pass:controlSnap.finishPass,recovered:true}),120);
    }catch(error){
      if(state.recovered&&hasUsableRecovery(recovery)){
        try{await restoreLocalRace(recovery);el("m2raceSyncText").textContent="Live V2 no responde todavía. La carrera continúa protegida con los datos locales.";return;}catch(_){}
      }
      el("m2raceSyncTitle").textContent="No se pudo conectar";el("m2raceSyncText").textContent=String(error?.message||error);try{window.dispatchEvent(new CustomEvent("militopo:v2-runner-race-error",{detail:{event:state.event?{...state.event}:null,runId:state.runId,recovered:state.recovered,message:String(error?.message||error)}}));}catch(_){}
    }
  }

  async function activateGps(){
    const api=gpsApi();if(!api)return updateGpsUi("unsupported",{message:"Módulo GPS no disponible."});
    updateGpsUi("requesting");
    try{
      const fix=await api.prepare();
      if(!fix){state.gpsPrepared=false;state.preStartFix=null;updateGpsUi("error",{message:api.snapshot?.().lastError||"No se pudo obtener una posición GPS."});return false;}
      state.gpsPrepared=true;state.preStartFix={...fix};state.gpsTried=true;
      const racing=["racing","started"].includes(String(state.participant?.status||"").toLowerCase());
      if(racing){const ok=await api.start(gpsContext(),fix);if(!ok){state.gpsPrepared=false;state.preStartFix=null;updateGpsUi("error",{message:"No se pudo mantener activo el GPS de carrera."});return false;}updateGpsUi("active",{fix});}
      else updateGpsUi("ready",{fix});
      return true;
    }catch(error){state.gpsPrepared=false;state.preStartFix=null;updateGpsUi("error",{message:String(error?.message||error)});return false;}
  }
  async function startRace(){
    if(state.busy)return;
    const api=gpsApi(),snap=api?.snapshot?.()||{};
    if(!state.gpsPrepared&&!snap.active){
      el("m2raceStartConfirm").classList.remove("open");
      const ok=await activateGps();if(!ok){el("m2raceControlStatus").className="m2race-control-status warn";el("m2raceControlStatus").textContent="No se puede iniciar: activa el GPS y permite la ubicación.";return;}
    }
    const fix=state.preStartFix||api?.snapshot?.().lastSent||null;
    if(!fix){el("m2raceControlStatus").className="m2race-control-status warn";el("m2raceControlStatus").textContent="No se puede iniciar sin una posición GPS válida.";syncStartGate();return;}
    state.localArrivalAt=0;state.autoFinishing=false;busy("Preparando salida","GPS validado · registrando tu salida oficial…");
    try{
      const svc=await services();const startResult=await svc.callable("runnerStartRace",{eventId:state.event.eventId,clientVersion:VERSION});const startData=startResult?.data||{};
      state.participant={...(state.participant||{}),status:"racing",startedAt:Number(startData.startedAt||state.participant?.startedAt||Date.now())};controlsApi()?.setRaceStatus?.("racing");
      const gpsStarted=await api.start(gpsContext(),fix);if(!gpsStarted)throw new Error("La salida se registró, pero el GPS no pudo mantenerse activo. Revisa el permiso de ubicación.");
      updateGpsUi("active",{fix});render();emitLocalSnapshot();updateControlUi("status");
      el("m2raceBusyTitle").textContent="Salida registrada ✓";el("m2raceBusyText").textContent="TIEMPO OFICIAL en marcha · GPS y track activos.";await new Promise(r=>setTimeout(r,650));
    }catch(error){el("m2raceBusyTitle").textContent="No se pudo iniciar";el("m2raceBusyText").textContent=String(error?.message||error);await new Promise(r=>setTimeout(r,1400));}
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
  window.addEventListener("online",()=>{if(state.event&&state.auth&&state.runId&&["racing","started"].includes(String(state.participant?.status||"").toLowerCase()))reconcileLive().catch(()=>{});else{const cs=controlsApi()?.snapshot?.()||{};if(cs.finishValidated&&["racing","started"].includes(String(state.participant?.status||"").toLowerCase()))setTimeout(()=>autoFinishFromArrival({pass:cs.finishPass,retry:true}),350);}});
  window.addEventListener("militopo:v2-resilience-status",e=>{const d=e.detail||{},pill=el("m2raceResiliencePill"),text=el("m2raceResilienceText");if(!pill||!text)return;pill.className="m2race-resilience-pill";if(d.status==="awake"){pill.textContent="PANTALLA ACTIVA";pill.classList.add("ok");text.textContent="Wake Lock activo mientras corres. Si cierras o recargas, MILITOPO conserva la carrera.";}else if(d.status==="restoring"||d.status==="restoring_offline"){pill.textContent=d.status==="restoring_offline"?"RECUPERANDO OFFLINE":"RECUPERANDO";pill.classList.add("warn");text.textContent=d.status==="restoring_offline"?"Restaurando cronómetro, recorrido, controles, GPS y track desde el dispositivo…":"Reconectando carrera, GPS y track local…";}else if(d.status==="offline_protected"){pill.textContent="PROTEGIDO OFFLINE";pill.classList.add("ok");text.textContent="La carrera sigue protegida localmente y se reconciliará al volver Internet.";}else if(d.status==="unsupported"){pill.textContent="RECUPERACIÓN ACTIVA";pill.classList.add("ok");text.textContent="La recuperación de carrera está activa. Este navegador no ofrece Wake Lock de pantalla.";}else if(d.status==="released"){pill.textContent="RECUPERACIÓN ACTIVA";pill.classList.add("ok");text.textContent="La sesión queda protegida aunque la pantalla pueda apagarse.";}else{pill.textContent="PROTEGIDO";pill.classList.add("ok");text.textContent=d.message||"MILITOPO puede recuperar esta carrera si recargas la aplicación.";}});
  window.addEventListener("militopo:v2-open-runner-race",e=>open(e.detail));
})();
