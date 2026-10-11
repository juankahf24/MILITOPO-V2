/* MILITOPO · R9M · pulido responsive de carrera activa sin tocar lógica de competición. */
(()=>{
  if(document.getElementById('m2RaceR9MResponsive'))return;
  const style=document.createElement('style');
  style.id='m2RaceR9MResponsive';
  style.textContent=`
    #m2RaceV2{overscroll-behavior:none!important;-webkit-overflow-scrolling:touch}
    #m2RaceV2 .m2race-shell{min-width:0!important}
    #m2RaceV2 .m2race-dashboard,#m2RaceV2 .m2race-bottom,#m2RaceV2 .m2race-control-card{min-width:0!important}
    #m2RaceV2 .m2race-title,#m2RaceV2 .m2race-event,#m2RaceV2 .m2race-gps-text{min-width:0}
    #m2RaceV2 .m2race-progress-sequence{scroll-snap-type:x proximity;overscroll-behavior-x:contain}
    #m2RaceV2 .m2race-progress-node{scroll-snap-align:center}
    #m2RaceV2 .m2race-qr-panel{padding-left:max(10px,env(safe-area-inset-left))!important;padding-right:max(10px,env(safe-area-inset-right))!important}
    #m2RaceV2 .m2race-summary{padding-left:max(7px,env(safe-area-inset-left))!important;padding-right:max(7px,env(safe-area-inset-right))!important}
    @media(max-width:430px){
      #m2RaceV2 .m2race-top{min-width:0!important}
      #m2RaceV2 .m2race-live{white-space:nowrap!important}
      #m2RaceV2 .m2race-performance{min-width:0!important}
      #m2RaceV2 .m2race-progress-sequence{padding-bottom:2px!important}
    }
    @media(max-height:740px){
      #m2RaceV2.m2race-is-racing .m2race-performance{padding:8px 9px 8px!important;border-radius:17px!important}
      #m2RaceV2.m2race-is-racing .m2race-time{font-size:3.2rem!important;line-height:.86!important}
      #m2RaceV2.m2race-is-racing .m2race-time-label{margin-top:4px!important;font-size:.62rem!important}
      #m2RaceV2.m2race-is-racing .m2race-clock-sub{margin-top:4px!important;gap:5px!important}
      #m2RaceV2.m2race-is-racing .m2race-clock-sub span{padding:4px 6px!important;border-radius:9px!important}
      #m2RaceV2 .m2race-progress{margin-top:6px!important;padding-top:6px!important}
      #m2RaceV2 .m2race-progress-sequence{margin-top:4px!important}
      #m2RaceV2 .m2race-progress-node{height:21px!important;min-width:29px!important;padding:0 5px!important;font-size:.43rem!important}
      #m2RaceV2 .m2race-control-card{padding:6px 7px!important;gap:3px!important}
      #m2RaceV2 .m2race-next{font-size:2.35rem!important}
      #m2RaceV2 .m2race-gpsbar{padding:4px 6px!important}
      #m2RaceV2 .m2race-actions-row button{min-height:37px!important}
    }
    @media(max-height:650px){
      #m2RaceV2.m2race-is-racing .m2race-time{font-size:2.8rem!important}
      #m2RaceV2 .m2race-progress-track{height:8px!important}
      #m2RaceV2 .m2race-progress-node{height:19px!important;min-width:27px!important;font-size:.40rem!important}
      #m2RaceV2 .m2race-control-head{min-height:18px!important}
      #m2RaceV2 .m2race-control-kicker{min-height:18px!important;padding:2px 6px!important;font-size:.56rem!important}
      #m2RaceV2 .m2race-next{font-size:2.05rem!important}
      #m2RaceV2 .m2race-control-actions .m2race-qr-btn{min-height:30px!important;height:30px!important}
      #m2RaceV2 .m2race-control-actions .m2race-discard-btn{min-height:25px!important;height:25px!important}
    }
    @media(orientation:landscape) and (max-height:520px){
      #m2RaceV2{overflow:auto!important;padding-bottom:max(6px,env(safe-area-inset-bottom))!important}
      #m2RaceV2 .m2race-shell{height:auto!important;min-height:calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 12px)!important;overflow:visible!important}
      #m2RaceV2 .m2race-dashboard{overflow:visible!important}
    }
  `;
  document.head.appendChild(style);
})();
