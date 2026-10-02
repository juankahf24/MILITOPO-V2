/* MILITOPO · REDISEÑO R1 · navegación/shell no destructivo */
(()=>{
  if(window.__MILITOPO_R1_SHELL__) return;
  window.__MILITOPO_R1_SHELL__=true;

  const state={role:"organizer",workspace:null,hosted:[],currentStep:1};
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const icon=(name)=>{
    const paths={
      races:'<path d="M4 6h16M4 12h16M4 18h10"/><path d="m17 16 3 2-3 2z"/>',
      plus:'<path d="M12 5v14M5 12h14"/>',
      map:'<path d="m3 6 5-2 8 2 5-2v14l-5 2-8-2-5 2z"/><path d="M8 4v14M16 6v14"/>',
      users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
      live:'<path d="M8.5 16.5a6 6 0 0 1 0-9M15.5 7.5a6 6 0 0 1 0 9"/><path d="M5 20a11 11 0 0 1 0-16M19 4a11 11 0 0 1 0 16"/><circle cx="12" cy="12" r="2"/>',
      more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
      layers:'<path d="m12 2 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
      locate:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
      zoomin:'<path d="M12 5v14M5 12h14"/>',
      zoomout:'<path d="M5 12h14"/>',
      close:'<path d="m6 6 12 12M18 6 6 18"/>'
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.more}</svg>`;
  };
  function safeCall(name,...args){try{const fn=window[name];if(typeof fn==="function")return fn(...args)}catch(e){console.warn("MILITOPO R1",name,e)}return null}
  function roleLabel(role){return role==="super_admin"?"SÚPER ADMIN":role==="organizer"?"ORGANIZADOR":"CORREDOR"}
  function currentEventName(){return String($("#eventName")?.value||"MILITOPO ORIENTACIÓN").trim()||"MILITOPO ORIENTACIÓN"}
  function currentEventId(){return String($("#eventId")?.value||"").trim()}

  function buildTopbar(){
    const compass=document.createElement("button");
    compass.className="r1-compass";compass.type="button";compass.dataset.r1Action="home";compass.setAttribute("aria-label","MILITOPO");
    compass.innerHTML='<img src="assets/r1/militopo-compass.png" alt="Brújula MILITOPO">';
    const bar=document.createElement("header");bar.className="r1-topbar";bar.id="militopoR1Topbar";
    bar.innerHTML=`
      <div class="r1-event"><strong id="r1EventName">${currentEventName()}</strong><span id="r1EventMeta">${currentEventId()||"Sin carrera cargada"}</span></div>
      <nav class="r1-nav" aria-label="Navegación principal MILITOPO">
        <button class="r1-nav-btn is-primary" type="button" data-r1-action="races">${icon("races")}<span>MIS CARRERAS</span></button>
        <button class="r1-nav-btn" type="button" data-r1-action="new">${icon("plus")}<span>NUEVA</span></button>
        <button class="r1-nav-btn" type="button" data-r1-action="map">${icon("map")}<span>MAPA</span></button>
        <button class="r1-nav-btn" type="button" data-r1-action="participants">${icon("users")}<span>PARTICIPANTES</span></button>
        <button class="r1-nav-btn is-live" type="button" data-r1-action="live">${icon("live")}<span>LIVE</span></button>
        <button class="r1-nav-btn" type="button" data-r1-action="more">${icon("more")}<span>MÁS</span></button>
      </nav>
      <div class="r1-role-pill" id="r1RolePill" data-role="${state.role}"><i class="r1-role-dot"></i><span>${roleLabel(state.role)}</span></div>`;
    document.body.append(compass,bar);
    compass.addEventListener("click",onTopAction);
    bar.addEventListener("click",onTopAction);
  }
  function buildMapDock(){
    const dock=document.createElement("aside");dock.className="r1-map-dock";dock.id="r1MapDock";dock.innerHTML=`
      <button class="r1-map-btn" type="button" data-map-action="locate" aria-label="Mi ubicación" title="Mi ubicación">${icon("locate")}</button>
      <button class="r1-map-btn" type="button" data-map-action="layers" aria-label="Capas" title="Capas">${icon("layers")}</button>
      <div class="r1-map-separator"></div>
      <button class="r1-map-btn" type="button" data-map-action="zoom-in" aria-label="Acercar" title="Acercar">${icon("zoomin")}</button>
      <button class="r1-map-btn" type="button" data-map-action="zoom-out" aria-label="Alejar" title="Alejar">${icon("zoomout")}</button>`;
    const layers=document.createElement("div");layers.className="r1-layer-pop";layers.id="r1LayerPop";layers.innerHTML=`
      <button type="button" data-layer="mapant">MAPANT</button><button type="button" data-layer="ign">IGN</button>
      <button type="button" data-layer="pnoa">AÉREO</button><button type="button" data-layer="custom">MI PLANO</button>`;
    document.body.append(dock,layers);
    dock.addEventListener("click",event=>{const a=event.target.closest("[data-map-action]")?.dataset.mapAction;if(!a)return;if(a==="layers"){layers.classList.toggle("is-open");return}if(a==="locate"){safeCall("useMyLocation");return}const selector=a==="zoom-in"?".leaflet-control-zoom-in":".leaflet-control-zoom-out";const mapEl=$("#map");mapEl?.querySelector(selector)?.dispatchEvent(new MouseEvent("click",{bubbles:true,cancelable:true}))});
    layers.addEventListener("click",event=>{const b=event.target.closest("[data-layer]");if(!b)return;safeCall("switchLayer",b.dataset.layer);layers.classList.remove("is-open")});
  }
  function buildMore(){
    const wrap=document.createElement("div");wrap.className="r1-more-backdrop";wrap.id="r1More";wrap.innerHTML=`<section class="r1-more-panel" role="dialog" aria-modal="true" aria-label="Más herramientas">
      <div class="r1-more-head"><strong>MÁS HERRAMIENTAS</strong><button class="r1-close" type="button" data-more-close aria-label="Cerrar">×</button></div>
      <div class="r1-more-grid">
        ${moreAction("CONFIGURACIÓN","Datos y reglas de la carrera","config")}
        ${moreAction("PARTICIPANTES","Invitaciones, censo y asignaciones","participants")}
        ${moreAction("RECORRIDOS","Generar y revisar recorridos","routes")}
        ${moreAction("MATERIAL QR","Planos, QR y exportaciones","material")}
        ${moreAction("SECUENCIA","Salidas, llegadas y control","sequence")}
        ${moreAction("RESULTADOS","Resultados y clasificación","results")}
        ${moreAction("ANÁLISIS","Reproductor y análisis post-carrera","analysis")}
        ${moreAction("HISTÓRICO","Carreras finalizadas y archivadas","history")}
        ${moreAction("AYUDA","Guía actual de Orientación","help")}
      </div></section>`;
    document.body.appendChild(wrap);wrap.addEventListener("click",event=>{if(event.target===wrap||event.target.closest("[data-more-close]")){closeMore();return}const a=event.target.closest("[data-more-action]")?.dataset.moreAction;if(a)runMoreAction(a)});
  }
  function moreAction(title,desc,action){return `<button class="r1-more-action" type="button" data-more-action="${action}"><strong>${title}</strong><small>${desc}</small></button>`}
  function buildWorkspace(){
    const o=document.createElement("div");o.className="r1-workspace";o.id="r1Workspace";o.innerHTML=`<div class="r1-workspace-shell"><header class="r1-workspace-head"><div class="r1-workspace-title"><small>MILITOPO · ORIENTACIÓN</small><strong id="r1WorkspaceTitle">MÓDULO</strong></div><button class="r1-close" type="button" data-r1-workspace-close aria-label="Cerrar">${icon("close")}</button></header><main class="r1-workspace-body" id="r1WorkspaceBody"></main></div>`;
    document.body.appendChild(o);state.workspace=o;o.addEventListener("click",e=>{if(e.target===o||e.target.closest("[data-r1-workspace-close]"))closeWorkspace()});
  }
  function hostNodes(nodes,title){
    closeWorkspace(false);const body=$("#r1WorkspaceBody"),titleEl=$("#r1WorkspaceTitle");if(!body)return;
    titleEl.textContent=title;body.innerHTML="";state.hosted=[];
    const stack=document.createElement("div");stack.className="r1-module-stack";body.appendChild(stack);
    nodes.filter(Boolean).forEach(node=>{const marker=document.createComment(`r1:${node.id||node.tagName}`);node.parentNode?.insertBefore(marker,node);state.hosted.push({node,marker});node.classList.add("r1-hosted");stack.appendChild(node)});
    state.workspace.classList.add("is-open");document.body.style.overflow="hidden";setTimeout(()=>{window.dispatchEvent(new Event("resize"))},80);
  }
  function closeWorkspace(restore=true){
    if(restore)state.hosted.forEach(({node,marker})=>{try{node.classList.remove("r1-hosted");marker.parentNode?.insertBefore(node,marker);marker.remove()}catch(_){}});
    else state.hosted.forEach(({node,marker})=>{try{node.classList.remove("r1-hosted");marker.parentNode?.insertBefore(node,marker);marker.remove()}catch(_){}});
    state.hosted=[];state.workspace?.classList.remove("is-open");if(state.workspace)$("#r1WorkspaceBody",state.workspace).innerHTML="";document.body.style.overflow="";setTimeout(()=>window.dispatchEvent(new Event("resize")),60);
  }
  function openStep(step,title){closeMore();closeWorkspace();safeCall("goStep",step,{noScroll:true});state.currentStep=step;setTimeout(()=>{const node=$(`#step${step}`);if(node)hostNodes([node],title)},50)}
  function openInjected(ids,title,step=1){closeMore();closeWorkspace();safeCall("goStep",step,{noScroll:true});setTimeout(()=>{const nodes=ids.map(id=>document.getElementById(id)).filter(Boolean);if(nodes.length)hostNodes(nodes,title);else{safeCall("toast","Módulo todavía cargando. Inténtalo de nuevo en un instante.")}},90)}
  function closeMore(){$("#r1More")?.classList.remove("is-open")}
  function openMore(){$("#r1More")?.classList.add("is-open")}
  function openRaces(){const btn=$("#m2CloudRecoveryOpen");if(btn){btn.click();return}safeCall("goStep",1);safeCall("toast","Mis carreras se está preparando")}
  function openHistory(){const btn=$("#m2OrganizerHistoryOpen");if(btn){btn.click();return}openInjected(["m2EventHistoricalResults"],"HISTÓRICO Y RESULTADOS",1)}
  function onTopAction(event){const a=event.target.closest("[data-r1-action]")?.dataset.r1Action;if(!a)return;closeMore();if(a==="home"){closeWorkspace();safeCall("goStep",1);window.scrollTo({top:0,behavior:"smooth"});return}if(a==="races"){closeWorkspace();openRaces();return}if(a==="new"){closeWorkspace();safeCall("createNewRace");setTimeout(()=>openStep(1,"NUEVA CARRERA · CONFIGURACIÓN"),60);return}if(a==="map"){openStep(2,"MAPA Y BALIZAS");return}if(a==="participants"){openInjected(["m2Invitations","m2ParticipantsAdmin"],"PARTICIPANTES",1);return}if(a==="live"){openInjected(["m2OrganizerLiveMonitor","m2OrganizerLiveMap"],"LIVE · CENTRO DE SEGUIMIENTO",1);return}if(a==="more"){openMore();return}}
  function runMoreAction(a){if(a==="config")return openStep(1,"CONFIGURACIÓN DE CARRERA");if(a==="participants")return openInjected(["m2Invitations","m2ParticipantsAdmin"],"PARTICIPANTES",1);if(a==="routes")return openStep(3,"RECORRIDOS");if(a==="material")return openStep(4,"MATERIAL QR Y EXPORTACIÓN");if(a==="sequence")return openStep(5,"SECUENCIA DE SALIDA Y LLEGADA");if(a==="results")return openInjected(["m2EventHistoricalResults"],"RESULTADOS Y CLASIFICACIÓN",1);if(a==="analysis")return openStep(7,"ANÁLISIS Y REPRODUCTOR");if(a==="history"){closeMore();return openHistory()}if(a==="help"){closeMore();if(typeof window.showOrientationGuide==="function")window.showOrientationGuide();return}}
  function refreshContext(){
    const active=$$(".card.active")[0];const m=active?.id?.match(/^step(\d+)$/);state.currentStep=m?Number(m[1]):state.currentStep;document.body.classList.toggle("r1-map-context",state.currentStep===2 || !!$("#r1Workspace #step2"));
    $$(".r1-nav-btn").forEach(b=>b.classList.remove("is-active"));if(state.currentStep===2)$("[data-r1-action='map']")?.classList.add("is-active");
    const name=$("#r1EventName"),meta=$("#r1EventMeta");if(name)name.textContent=currentEventName();if(meta)meta.textContent=currentEventId()||"Sin carrera cargada";
  }
  function setRole(role){state.role=String(role||"organizer");const pill=$("#r1RolePill");if(pill){pill.dataset.role=state.role;$("span",pill).textContent=roleLabel(state.role)}}
  function bindEvents(){
    window.addEventListener("militopo:v2-auth-ready",e=>setRole(e.detail?.role));
    window.addEventListener("militopo:v2-orientation-header",e=>{const h=e.detail?.header||{};const name=$("#r1EventName"),meta=$("#r1EventMeta");if(name&&h.eventName)name.textContent=h.eventName;if(meta&&h.eventId)meta.textContent=h.eventId});
    window.addEventListener("militopo:v2-cloud-event-applied",()=>setTimeout(refreshContext,100));
    document.addEventListener("input",e=>{if(e.target?.id==="eventName")refreshContext()},{passive:true});
    document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;if($("#r1More")?.classList.contains("is-open"))closeMore();else if(state.workspace?.classList.contains("is-open"))closeWorkspace();});
    const observer=new MutationObserver(refreshContext);$$('.card').forEach(card=>observer.observe(card,{attributes:true,attributeFilter:["class"]}));
  }
  function init(){
    document.body.classList.add("r1-shell-active");
    try{setRole(localStorage.getItem("militopo_v2_last_role")||"organizer")}catch(_){}
    buildTopbar();buildMapDock();buildMore();buildWorkspace();bindEvents();refreshContext();
    setTimeout(refreshContext,600);setTimeout(refreshContext,1600);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
