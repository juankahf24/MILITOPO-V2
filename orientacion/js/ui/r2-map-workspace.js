/* MILITOPO · REDISEÑO R2 · workspace cartográfico del organizador */
(()=>{
  if(window.__MILITOPO_R2_MAP_WORKSPACE__)return;
  window.__MILITOPO_R2_MAP_WORKSPACE__=true;
  const $=(s,r=document)=>r.querySelector(s);
  const bridge=()=>window.MILITOPO_R2_BRIDGE||null;
  const state={trace:false,traceRouteId:"",selected:[],stage:null,statusTimer:null,lastSelected:"",placeMode:"",toolsHidden:false,activeTool:"",detailRouteId:"",detailsVisible:false};
  const ico={
    start:'<svg viewBox="0 0 24 24"><path d="M5 21V4m0 1h11l-2.5 3L16 11H5"/></svg>',
    control:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/></svg>',
    finish:'<svg viewBox="0 0 24 24"><path d="M5 21V4m0 1h12v8H5"/><path d="M8 5v8m3-8v8m3-8v8M5 9h12"/></svg>',
    route:'<svg viewBox="0 0 24 24"><circle cx="5" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M7 18c6 0 3-10 9-10"/></svg>',
    fit:'<svg viewBox="0 0 24 24"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>',
    eye:'<svg viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/></svg>',
    eyeOff:'<svg viewBox="0 0 24 24"><path d="m3 3 18 18"/><path d="M10.6 6.2A10.7 10.7 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3 3.8M6.6 6.6C3.5 8.5 2 12 2 12s3.5 6 10 6c1 0 2-.15 2.8-.42"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>'
  };
  function toast(msg){try{if(typeof window.toast==='function')window.toast(msg);else console.info(msg)}catch(_){}}
  function setText(el,value){if(!el)return;const next=String(value??'');if(el.textContent!==next)el.textContent=next}
  function btn(action,label,icon){return `<button class="r2-tool" type="button" data-r2-tool="${action}">${icon}<span>${label}</span></button>`}
  function build(){
    const map=$("#map");if(!map||document.getElementById("r2MapStage"))return !!document.getElementById("r2MapStage");
    const stage=document.createElement("section");stage.className="r2-map-stage r2-map-home-stage";stage.id="r2MapStage";stage.setAttribute("aria-label","Mapa principal de Orientación");
    stage.innerHTML=`
      <aside class="r2-tool-dock" aria-label="Herramientas de diseño">
        <button class="r2-tools-toggle" type="button" data-r2-tools-toggle aria-label="Ocultar herramientas">${ico.eyeOff}<span>OCULTAR</span></button>
        <div class="r2-tool-list">
          ${btn("start","SALIDA",ico.start)}
          ${btn("control","BALIZA",ico.control)}
          ${btn("finish","LLEGADA",ico.finish)}
          <i></i>
          ${btn("route","TRAZAR",ico.route)}
          ${btn("fit","CENTRAR",ico.fit)}
        </div>
      </aside>
      <div class="r2-map-slot"></div>
      <div class="r2-map-hud" id="r2MapHud">
        <span><b id="r2SelectedPoint">—</b><small>PUNTO ACTIVO</small></span>
        <span><b id="r2PlacedPoints">0/0</b><small>PUNTOS</small></span>
        <span><b id="r2PlacedControls">0/0</b><small>BALIZAS</small></span>
        <span><b id="r2RouteState">SIN RECORRIDO</b><small>RECORRIDO</small></span>
      </div>
      <div class="r2-context-tip" id="r2ContextTip">Selecciona una herramienta y trabaja directamente sobre el mapa.</div>
      <div class="r2-trace-panel" id="r2TracePanel" hidden>
        <div class="r2-trace-head"><div><small id="r2TraceRouteLabel">TRAZADO MANUAL · R01</small><strong id="r2TraceCount">0/0 BALIZAS</strong></div><button type="button" data-r2-trace="cancel" aria-label="Cancelar">×</button></div>
        <div class="r2-trace-sequence" id="r2TraceSequence">SALIDA → … → LLEGADA</div>
        <div class="r2-trace-actions"><button type="button" data-r2-trace="undo">↩ DESHACER</button><button type="button" data-r2-trace="clear">LIMPIAR</button><button class="is-confirm" id="r2TraceConfirm" type="button" data-r2-trace="confirm" disabled>✓ GUARDAR R01</button></div>
      </div>
      <section class="r2-route-details" id="r2RouteDetails" hidden aria-live="polite">
        <div class="r2-route-details-head">
          <div><small>DETALLES DEL RECORRIDO</small><strong id="r2RouteDetailsTitle">R01</strong></div>
          <div class="r2-route-details-nav">
            <button type="button" data-r2-details="prev" aria-label="Recorrido anterior">‹</button>
            <button type="button" data-r2-details="next" aria-label="Recorrido siguiente">›</button>
            <button type="button" data-r2-details="close" aria-label="Cerrar detalles">×</button>
          </div>
        </div>
        <div class="r2-route-details-metrics">
          <span><b id="r2DetailControls">—</b><small>PUNTOS DE CONTROL</small></span>
          <span><b id="r2DetailDistance">—</b><small>DISTANCIA TOTAL</small></span>
          <span><b id="r2DetailClimb">—</b><small>DESNIVEL +</small></span>
          <span><b id="r2DetailDifficulty">—</b><small>CATEGORÍA</small></span>
        </div>
        <div class="r2-route-profile" id="r2RouteProfile"></div>
        <div class="r2-route-details-sequence" id="r2RouteDetailsSequence"></div>
      </section>
      <div class="r2-route-picker" id="r2RoutePicker" hidden>
        <section class="r2-route-picker-card" role="dialog" aria-modal="true" aria-labelledby="r2RoutePickerTitle">
          <div class="r2-route-picker-head"><div><small>RECORRIDOS MANUALES</small><strong id="r2RoutePickerTitle">¿QUÉ RECORRIDO QUIERES TRAZAR?</strong></div><button class="r2-route-picker-close" type="button" data-r2-picker-close aria-label="Cerrar">×</button></div>
          <p class="r2-route-picker-help">Cada recorrido se crea desde cero seleccionando las balizas en el orden deseado. MILITOPO no genera el trazado automáticamente.</p>
          <div class="r2-route-picker-grid" id="r2RoutePickerGrid"></div>
        </section>
      </div>`;
    document.body.prepend(stage);$(".r2-map-slot",stage).appendChild(map);
    stage.addEventListener("click",onClick);state.stage=stage;window.militopoR2HandleMapPointClick=handleTracePoint;
    try{state.toolsHidden=localStorage.getItem("militopo_r2_tools_hidden")==="1"}catch(_){}
    applyToolsVisibility();
    window.MILITOPO_R2_MAP_HOME={
      activate(){stage.classList.add("is-active");setTimeout(()=>{window.dispatchEvent(new Event("resize"));try{map.dispatchEvent(new Event("militopo:r2-mounted"))}catch(_){}},40);refresh();},
      refresh,
      openTracePicker(){
        stage.classList.add("is-active");
        refresh();
        requestAnimationFrame(()=>setTimeout(()=>openRoutePicker(),35));
      }
    };
    refresh();setTimeout(()=>window.MILITOPO_R2_MAP_HOME.activate(),80);return true;
  }
  function applyToolsVisibility(){
    if(!state.stage)return;
    state.stage.querySelector('.r2-tool-dock')?.classList.toggle('is-collapsed',state.toolsHidden);
    const toggle=state.stage.querySelector('[data-r2-tools-toggle]');
    if(toggle){toggle.innerHTML=`${state.toolsHidden?ico.eye:ico.eyeOff}<span>${state.toolsHidden?'MOSTRAR':'OCULTAR'}</span>`;toggle.setAttribute('aria-label',state.toolsHidden?'Mostrar herramientas':'Ocultar herramientas');}
  }
  function toggleTools(){state.toolsHidden=!state.toolsHidden;try{localStorage.setItem("militopo_r2_tools_hidden",state.toolsHidden?"1":"0")}catch(_){}applyToolsVisibility()}
  function setTool(action){
    state.activeTool=action||'';
    state.stage?.querySelectorAll('[data-r2-tool]').forEach(b=>b.classList.toggle('is-active',b.dataset.r2Tool===state.activeTool));
  }
  function cancelActiveTool(message='Herramienta cancelada · toca otra herramienta cuando quieras continuar.'){
    if(state.trace){exitTrace(true);return}
    state.placeMode='';state.lastSelected='';bridge()?.clearSelection?.();setTool('');instruction(message);refresh();
  }
  function instruction(text){const el=$('#r2ContextTip');if(el)el.textContent=text}
  function selectPoint(id,label){
    if(state.trace)exitTrace(false);
    const b=bridge();if(!b?.selectPoint(id)){toast('No se pudo seleccionar el punto');return}
    state.lastSelected=id;state.placeMode=label;setTool(label);instruction(`Punto ${id} activo · toca el mapa para colocarlo o arrastra su marcador para moverlo.`);refresh();
  }
  function selectControl(){
    if(state.trace)exitTrace(false);
    const id=bridge()?.selectNextControl?.();if(!id){toast('Todas las balizas ya están colocadas. Puedes moverlas arrastrando sus marcadores.');return}
    state.lastSelected=id;state.placeMode='control';setTool('control');instruction(`${id} activa · toca el mapa para colocarla. Al guardarla, MILITOPO preparará automáticamente la siguiente baliza pendiente.`);refresh();
  }
  function onClick(e){
    if(e.target.closest("[data-r2-tools-toggle]")){toggleTools();return}
    const tool=e.target.closest('[data-r2-tool]')?.dataset.r2Tool;
    if(tool){
      if(tool==='start'){if(state.activeTool==='start')return cancelActiveTool('SALIDA deseleccionada.');return selectPoint('START','start')}
      if(tool==='control'){if(state.activeTool==='control')return cancelActiveTool('BALIZA deseleccionada.');return selectControl()}
      if(tool==='finish'){if(state.activeTool==='finish')return cancelActiveTool('LLEGADA deseleccionada.');return selectPoint('FINISH','finish')}
      if(tool==='fit'){bridge()?.fitAll?.();setTool('');instruction('Mapa centrado en todos los puntos colocados.');return}
      if(tool==='route'){if(state.trace||state.activeTool==='route')return exitTrace(true);return openRoutePicker()}
    }
    const detailsAction=e.target.closest('[data-r2-details]')?.dataset.r2Details;
    if(detailsAction==='close'){hideRouteDetails(true);return}
    if(detailsAction==='prev'){cycleRouteDetails(-1);return}
    if(detailsAction==='next'){cycleRouteDetails(1);return}
    if(e.target.closest('[data-r2-picker-close]')){closeRoutePicker();setTool('');return}
    const routeChoice=e.target.closest('[data-r2-route-choice]')?.dataset.r2RouteChoice;
    if(routeChoice){closeRoutePicker();return beginTrace(routeChoice)}
    const trace=e.target.closest('[data-r2-trace]')?.dataset.r2Trace;
    if(trace==='cancel')return exitTrace(true);
    if(trace==='undo'){state.selected.pop();renderTrace();return}
    if(trace==='clear'){state.selected=[];renderTrace();return}
    if(trace==='confirm')return confirmTrace();
  }
  function openRoutePicker(){
    const b=bridge(),snap=b?.getSnapshot?.();if(!snap)return;
    if(snap.locked){toast('La carrera está bloqueada para edición.');return}
    if(snap.controlsPlaced<snap.controlsPerRoute){toast(`Coloca al menos ${snap.controlsPerRoute} balizas antes de trazar un recorrido.`);return}
    const max=Math.max(1,Math.min(Number(snap.participantCount)||1,Number(snap.maxUniqueRoutes)||30));
    const existing=new Set(snap.routeIds||[]);
    const grid=$('#r2RoutePickerGrid');if(!grid)return;
    grid.innerHTML=Array.from({length:max},(_,i)=>{const rid='R'+String(i+1).padStart(2,'0'),exists=existing.has(rid);return `<button type="button" class="r2-route-choice${exists?' is-existing':''}" data-r2-route-choice="${rid}"><b>${rid}</b><small>${exists?'EXISTE · REHACER':'CREAR DESDE 0'}</small></button>`}).join('');
    $('#r2RoutePicker')?.removeAttribute('hidden');setTool('route');
    instruction('TRAZAR · elige primero qué recorrido quieres crear manualmente.');
  }
  function closeRoutePicker(){$('#r2RoutePicker')?.setAttribute('hidden','')}
  function beginTrace(routeId){
    const b=bridge(),snap=b?.getSnapshot?.();if(!snap)return;
    if(state.detailsVisible){$('#r2RouteDetails')?.setAttribute('hidden','');state.detailsVisible=false;bridge()?.clearSavedRoute?.()}
    state.trace=true;state.traceRouteId=String(routeId||'R01');state.selected=[];window.__MILITOPO_R2_TRACE_MODE__=true;setTool('route');
    state.stage?.classList.add('is-tracing');$('#r2TracePanel')?.removeAttribute('hidden');
    const label=$('#r2TraceRouteLabel');if(label)label.textContent=`TRAZADO MANUAL · ${state.traceRouteId}`;
    const confirm=$('#r2TraceConfirm');if(confirm)confirm.textContent=`✓ GUARDAR ${state.traceRouteId}`;
    instruction(`${state.traceRouteId} · selecciona las balizas del mapa en el orden exacto del recorrido.`);renderTrace();
  }
  function handleTracePoint(id){
    if(!state.trace)return false;
    const snap=bridge()?.getSnapshot?.();if(!snap)return false;
    const point=snap.points.find(p=>p.id===String(id));
    if(!point||point.type!=='BALIZA'){toast('En TRAZAR selecciona únicamente balizas. SALIDA y LLEGADA se añaden automáticamente.');return true}
    const target=snap.controlsPerRoute;
    if(state.selected.includes(point.id)){toast(`${point.id} ya está incluida.`);return true}
    if(state.selected.length>=target){toast(`Ya has seleccionado las ${target} balizas del recorrido.`);return true}
    state.selected.push(point.id);renderTrace();return true;
  }
  function renderTrace(){
    if(!state.trace)return;
    const snap=bridge()?.getSnapshot?.();if(!snap)return;
    const target=snap.controlsPerRoute,count=state.selected.length;
    const countEl=$('#r2TraceCount');if(countEl)countEl.textContent=`${count}/${target} BALIZAS`;
    const seq=$('#r2TraceSequence');if(seq)seq.innerHTML=`<b>SALIDA</b>${state.selected.map((id,i)=>`<span>${i+1}</span><b>${id}</b>`).join('')}<span>→</span><b class="finish">LLEGADA</b>`;
    const confirm=$('[data-r2-trace="confirm"]');if(confirm)confirm.disabled=count!==target;
    const undo=$('[data-r2-trace="undo"]');if(undo)undo.disabled=count===0;
    const clear=$('[data-r2-trace="clear"]');if(clear)clear.disabled=count===0;
    bridge()?.renderDraft?.([...state.selected]);
  }
  async function confirmTrace(){
    const confirm=$('[data-r2-trace="confirm"]');
    const original=confirm?.textContent||`✓ GUARDAR ${state.traceRouteId||'R01'}`;
    if(confirm){confirm.disabled=true;confirm.textContent='OBTENIENDO ALTITUD…'}
    instruction(`${state.traceRouteId||'RECORRIDO'} · obteniendo cotas reales antes de calcular distancia y desnivel.`);
    let result=null;
    try{result=await Promise.resolve(bridge()?.createManualRoute?.(state.traceRouteId,[...state.selected]))}
    catch(error){console.warn('R2G · guardado de recorrido',error);result={ok:false,error:'No se pudo guardar el recorrido.'}}
    if(!result?.ok){
      if(confirm){confirm.disabled=false;confirm.textContent=original}
      toast(result?.error||'No se pudo guardar el recorrido');if(result?.existing)exitTrace(true);return
    }
    const savedRouteId=result.routeId||state.traceRouteId||'R01';
    const elev=result.elevationInfo||{};
    const allReal=Number(elev.total)>0&&Number(elev.realCount)===Number(elev.total);
    toast(allReal?`${savedRouteId} guardado · altitud y desnivel reales calculados.`:`${savedRouteId} guardado · no fue posible obtener todas las cotas reales.`);
    exitTrace(false);refresh();
    showRouteDetails(savedRouteId,true);
    instruction(allReal?`${savedRouteId} guardado correctamente · distancia, altitud y desnivel reales actualizados.`:`${savedRouteId} guardado. Falta alguna cota real; se reintentará cuando muevas/actualices puntos con conexión.`);
  }
  function exitTrace(cancelled){
    state.trace=false;state.traceRouteId='';window.__MILITOPO_R2_TRACE_MODE__=false;bridge()?.clearDraft?.();state.selected=[];closeRoutePicker();
    state.placeMode='';state.lastSelected='';bridge()?.clearSelection?.();
    state.stage?.classList.remove('is-tracing');$('#r2TracePanel')?.setAttribute('hidden','');setTool('');
    if(cancelled){
      instruction('Trazado manual cancelado · no se ha modificado ningún recorrido.');
      if(state.detailRouteId)setTimeout(()=>showRouteDetails(state.detailRouteId,false),20);
    }
  }

  function routeIds(){
    const snap=bridge()?.getSnapshot?.();
    return [...(snap?.routeIds||[])].sort((a,b)=>{
      const na=Number(String(a).replace(/\D/g,''))||0,nb=Number(String(b).replace(/\D/g,''))||0;
      return na-nb||String(a).localeCompare(String(b));
    });
  }
  function routeProfileHtml(details){
    const pts=(details?.points||[]).filter(p=>p?.elevationReal===true&&Number.isFinite(Number(p.elevation)));
    if(pts.length<2)return '<div class="r2-profile-empty">PERFIL DE ELEVACIÓN · SIN COTAS REALES</div>';
    const values=pts.map(p=>Number(p.elevation)),min=Math.min(...values),max=Math.max(...values),range=Math.max(1,max-min);
    const coords=values.map((v,i)=>{
      const x=2+(256*(i/Math.max(1,values.length-1)));
      const y=42-((v-min)/range)*34;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<svg viewBox="0 0 260 46" role="img" aria-label="Perfil de elevación"><polyline class="r2-profile-base" points="2,42 258,42"/><polyline class="r2-profile-line" points="${coords}"/></svg><span>${Math.round(min)}–${Math.round(max)} m</span>`;
  }
  function showRouteDetails(routeId,fit=false){
    const b=bridge(),details=b?.getRouteDetails?.(routeId);if(!details)return false;
    state.detailRouteId=details.routeId;state.detailsVisible=true;
    const panel=$('#r2RouteDetails');panel?.removeAttribute('hidden');state.stage?.classList.add('has-route-details');
    setText($('#r2RouteDetailsTitle'),details.routeId);
    setText($('#r2DetailControls'),String(details.controls?.length||0));
    const km=details.metrics?.distanceKm;
    setText($('#r2DetailDistance'),km!==null&&km!==''&&Number.isFinite(Number(km))?`${Number(km).toFixed(3)} km`:'—');
    const climb=details.metrics?.positiveM;
    setText($('#r2DetailClimb'),climb!==null&&climb!==''&&Number.isFinite(Number(climb))?`+${Math.round(Number(climb))} m`:'SIN COTA');
    setText($('#r2DetailDifficulty'),String(details.metrics?.difficulty||'—'));
    const profile=$('#r2RouteProfile');if(profile)profile.innerHTML=routeProfileHtml(details);
    const sequence=$('#r2RouteDetailsSequence');
    if(sequence)sequence.innerHTML=`<b>SALIDA</b>${(details.controls||[]).map(id=>`<span>→</span><b>${id}</b>`).join('')}<span>→</span><b>LLEGADA</b>`;
    b?.showSavedRoute?.(details.routeId,{fit:!!fit});
    return true;
  }
  function hideRouteDetails(clearLine=false){
    $('#r2RouteDetails')?.setAttribute('hidden','');state.detailsVisible=false;state.stage?.classList.remove('has-route-details');
    if(clearLine)bridge()?.clearSavedRoute?.();
  }
  function cycleRouteDetails(step){
    const ids=routeIds();if(!ids.length)return;
    let idx=Math.max(0,ids.indexOf(state.detailRouteId));idx=(idx+Number(step||0)+ids.length)%ids.length;
    showRouteDetails(ids[idx],true);
  }
  function refreshRouteDetails(){
    if(!state.detailRouteId)return;
    const ids=routeIds();
    if(!ids.includes(state.detailRouteId)){hideRouteDetails(true);state.detailRouteId='';return}
    if(state.detailsVisible)showRouteDetails(state.detailRouteId,false);
  }
  function maybeAdvanceControl(){
    if(state.trace||state.placeMode!=='control'||!state.lastSelected)return;
    const b=bridge(),snap=b?.getSnapshot?.();if(!snap)return;
    const current=snap.points.find(p=>p.id===state.lastSelected);
    if(!current||current.lat===null||current.lon===null)return;
    const next=b.selectNextControl?.();
    if(next&&next!==state.lastSelected){state.lastSelected=next;instruction(`${next} preparada · toca el mapa para colocarla.`);}else if(!next){state.placeMode='';state.lastSelected='';bridge()?.clearSelection?.();setTool('');instruction('Todas las balizas están colocadas. Pulsa TRAZAR y elige el recorrido que quieres crear manualmente.');}
  }
  function refresh(){
    const snap=bridge()?.getSnapshot?.();if(!snap)return;
    setText($('#r2SelectedPoint'),snap.selectedPointId||'—');
    setText($('#r2PlacedPoints'),`${snap.placed}/${snap.total}`);
    setText($('#r2PlacedControls'),`${snap.controlsPlaced}/${snap.controls.length}`);
    setText($('#r2RouteState'),snap.routeCount?`${snap.routeCount} ${snap.routeCount===1?'RECORRIDO':'RECORRIDOS'}`:'SIN RECORRIDO');
    if(state.trace)renderTrace();
  }
  function ensure(){
    if(!state.stage)build();refresh();
  }
  function init(){
    ensure();
    /* R2G: repara también recorridos ya existentes al abrir la versión nueva,
       sin obligar a borrarlos ni volver a trazarlos. */
    setTimeout(()=>{Promise.resolve(bridge()?.ensureRouteElevations?.()).then(()=>{refresh();refreshRouteDetails()}).catch(()=>{})},450);
    window.addEventListener('militopo:v2-orientation-structure',()=>setTimeout(()=>{refresh();maybeAdvanceControl();refreshRouteDetails()},40));
    window.addEventListener('militopo:v2-cloud-event-applied',()=>setTimeout(()=>{refresh();refreshRouteDetails()},100));
    window.addEventListener('militopo:r2-config-updated',event=>{
      if(state.trace)exitTrace(true);
      state.placeMode='';state.lastSelected='';setTool('');
      const d=event.detail||{};
      setTimeout(()=>{
        refresh();refreshRouteDetails();
        instruction(`Reglas sincronizadas · ${Number(d.controlCount)||0} balizas · ${Number(d.controlsPerRoute)||0} por recorrido. Los cambios ya están activos.`);
      },20);
    });
    window.addEventListener('militopo:r2-route-updated',event=>{
      const routeId=String(event.detail?.routeId||'');
      if(!routeId||state.trace)return;
      if(!state.detailRouteId)state.detailRouteId=routeId;
      if(state.detailRouteId===routeId&&state.detailsVisible)showRouteDetails(routeId,false);
    });
    window.addEventListener('militopo:r2-elevation-updated',()=>setTimeout(()=>{refresh();refreshRouteDetails()},30));
    document.addEventListener('change',e=>{if(['selectedPoint','controlCount','controlsPerRoute'].includes(e.target?.id))setTimeout(refresh,20)},{passive:true});
    if(!state.stage){
      let attempts=0;
      const mountTimer=setInterval(()=>{attempts++;ensure();if(state.stage||attempts>=20)clearInterval(mountTimer)},150);
    }
    state.statusTimer=setInterval(()=>{if(document.body.classList.contains('r1-map-context'))refresh()},1200);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,120),{once:true});else setTimeout(init,120);
})();
