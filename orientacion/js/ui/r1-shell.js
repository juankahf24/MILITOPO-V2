/* MILITOPO · REDISEÑO R1 · navegación/shell no destructivo */
(()=>{
  if(window.__MILITOPO_R1_SHELL__) return;
  window.__MILITOPO_R1_SHELL__=true;

  const state={role:"organizer",workspace:null,hosted:[],currentStep:2,mapHome:true,managerEvent:null,managerOpen:false,eventStatus:null};
  const $=(s,r=document)=>r.querySelector(s);
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const icon=(name)=>{
    const paths={
      races:'<path d="M4 6h16M4 12h16M4 18h10"/><path d="m17 16 3 2-3 2z"/>',
      plus:'<path d="M12 5v14M5 12h14"/>',
      profile:'<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
      users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
      live:'<path d="M8.5 16.5a6 6 0 0 1 0-9M15.5 7.5a6 6 0 0 1 0 9"/><path d="M5 20a11 11 0 0 1 0-16M19 4a11 11 0 0 1 0 16"/><circle cx="12" cy="12" r="2"/>',
      more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
      layers:'<path d="m12 2 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
      locate:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
      zoomin:'<path d="M12 5v14M5 12h14"/>',
      zoomout:'<path d="M5 12h14"/>',
      settings:'<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.08.37.29.71.6 1 .3.27.68.41 1.1.4H21v4h-.09c-.42-.01-.8.13-1.1.4-.31.29-.52.63-.6 1z"/>',
      route:'<path d="M5 6h8a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h10"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="18" r="2"/>',
      flag:'<path d="M5 21V4"/><path d="M5 5h11l-2 4 2 4H5"/>',
      chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
      qr:'<rect x="3" y="3" width="6" height="6"/><rect x="15" y="3" width="6" height="6"/><rect x="3" y="15" width="6" height="6"/><path d="M15 15h2v2h-2zM19 15h2v6h-2M15 19h2v2h-2"/>',
      close:'<path d="m6 6 12 12M18 6 6 18"/>'
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.more}</svg>`;
  };
  function safeCall(name,...args){try{const fn=window[name];if(typeof fn==="function")return fn(...args)}catch(e){console.warn("MILITOPO R1",name,e)}return null}
  function roleLabel(role){return role==="super_admin"?"SÚPER ADMIN":role==="organizer"?"ORGANIZADOR":"CORREDOR"}
  function currentEventName(){return String($("#eventName")?.value||"MILITOPO ORIENTACIÓN").trim()||"MILITOPO ORIENTACIÓN"}
  function currentEventId(){return String($("#eventId")?.value||"").trim()}

  function buildTopbar(){
    const compass=document.createElement("img");
    compass.className="r1-compass";compass.dataset.r1Action="home";compass.setAttribute("role","button");compass.tabIndex=0;compass.setAttribute("aria-label","MILITOPO");
    compass.src="assets/r1/militopo-compass-r2k.png?v=r2k-direct-logo-20261003";
    compass.alt="Brújula MILITOPO";
    compass.draggable=false;
    const bar=document.createElement("header");bar.className="r1-topbar";bar.id="militopoR1Topbar";
    bar.innerHTML=`
      <div class="r1-event"><strong id="r1EventName">${currentEventName()}</strong><span id="r1EventMeta">${currentEventId()||"Sin carrera cargada"}</span></div>
      <nav class="r1-nav" aria-label="Navegación principal MILITOPO">
        <button class="r1-nav-btn" type="button" data-r1-action="profile">${icon("profile")}<span class="r1-label r1-label-profile"><span>MI</span><span>PERFIL</span></span></button>
        <button class="r1-nav-btn is-primary" type="button" data-r1-action="races">${icon("plus")}<span class="r1-label r1-label-load"><span>CARGAR</span><span>CARRERA</span></span></button>
        <button class="r1-nav-btn is-manager" type="button" data-r1-action="manager">${icon("settings")}<span class="r1-label r1-label-manager"><span>GESTIONAR</span><span>CARRERA</span></span></button>
        <button class="r1-nav-btn" type="button" data-r1-action="participants">${icon("users")}<span>PARTICIPANTES</span></button>
        <button class="r1-nav-btn is-live" type="button" data-r1-action="live">${icon("live")}<span>LIVE</span></button>
        <button class="r1-nav-btn" type="button" data-r1-action="more">${icon("more")}<span>MÁS</span></button>
      </nav>
      <div class="r1-role-pill" id="r1RolePill" data-role="${state.role}"><i class="r1-role-dot"></i><span>${roleLabel(state.role)}</span></div>`;
    document.body.append(compass,bar);
    compass.addEventListener("click",onTopAction);
    compass.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onTopAction(event)}});
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
        ${moreAction("RECORRIDOS","Crear y revisar recorridos manuales","routes")}
        ${moreAction("AJUSTES DE MAPA","Importar, buscar, editar y revisar datos cartográficos","maptools")}
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
    state.mapHome=false;document.body.classList.add("r1-workspace-open");
    titleEl.textContent=title;body.innerHTML="";state.hosted=[];
    const stack=document.createElement("div");stack.className="r1-module-stack";body.appendChild(stack);
    nodes.filter(Boolean).forEach(node=>{const marker=document.createComment(`r1:${node.id||node.tagName}`);node.parentNode?.insertBefore(marker,node);state.hosted.push({node,marker});node.classList.add("r1-hosted");stack.appendChild(node)});
    state.workspace.classList.add("is-open");document.body.style.overflow="hidden";
    /* R3D: todos los módulos se abren siempre desde arriba. En especial evita que
       ESTADO Y PUBLICACIÓN conserve el scroll del módulo anterior. */
    const resetWorkspaceScroll=()=>{try{body.scrollTop=0;body.scrollLeft=0;body.scrollTo({top:0,left:0,behavior:"auto"});if(state.workspace){state.workspace.scrollTop=0;state.workspace.scrollLeft=0}}catch(_){}};
    resetWorkspaceScroll();requestAnimationFrame(resetWorkspaceScroll);setTimeout(()=>{resetWorkspaceScroll();window.dispatchEvent(new Event("resize"))},80);
  }
  function closeWorkspace(returnToMap=true){
    state.hosted.forEach(({node,marker})=>{try{node.classList.remove("r1-hosted");marker.parentNode?.insertBefore(node,marker);marker.remove()}catch(_){}});
    state.hosted=[];state.managerOpen=false;state.workspace?.classList.remove("is-open");if(state.workspace)$("#r1WorkspaceBody",state.workspace).innerHTML="";document.body.style.overflow="";
    document.body.classList.remove("r1-workspace-open");state.mapHome=!!returnToMap;
    if(returnToMap){safeCall("goStep",2,{noScroll:true,silent:true});state.currentStep=2;setTimeout(()=>window.MILITOPO_R2_MAP_HOME?.activate?.(),35)}
    setTimeout(()=>{window.dispatchEvent(new Event("resize"));refreshContext()},60);
  }
  function showMapHome(){closeMore();closeWorkspace(true);window.scrollTo({top:0,behavior:"auto"});}
  function openStep(step,title){
    closeMore();
    if(Number(step)===4&&!materialQrUnlocked()){showMaterialLockedNotice();return false}
    closeWorkspace(false);safeCall("goStep",step,{noScroll:true});state.currentStep=step;
    setTimeout(()=>{const node=$(`#step${step}`);if(node){hostNodes([node],title);if(Number(step)===3)setTimeout(refreshRoutesProfessional,35)}},50);
    return true;
  }
  function openInjected(ids,title,step=1){closeMore();closeWorkspace(false);safeCall("goStep",step,{noScroll:true});setTimeout(()=>{const nodes=ids.map(id=>document.getElementById(id)).filter(Boolean);if(nodes.length)hostNodes(nodes,title);else{safeCall("toast","Módulo todavía cargando. Inténtalo de nuevo en un instante.")}},90)}
  function closeMore(){$("#r1More")?.classList.remove("is-open")}
  function openMore(){refreshMaterialAccess();$("#r1More")?.classList.add("is-open")}
  function openRaces(){
    const center=window.MILITOPO_V2_ORGANIZER_CENTER;
    if(center&&typeof center.open==="function"){center.open();return}
    const btn=$("#m2CloudRecoveryOpen");if(btn){btn.click();return}
    safeCall("goStep",1);safeCall("toast","Mis carreras se está preparando");
  }
  async function startNewRace(){
    closeMore();
    /* createNewRace devuelve false al pulsar CANCELAR. No cambiamos de pantalla
       ni cerramos MIS CARRERAS hasta que el usuario confirme de verdad. */
    const created=await safeCall("createNewRace");
    if(created!==true)return false;
    try{window.MILITOPO_V2_ORGANIZER_CENTER?.close?.()}catch(_){}
    closeWorkspace(false);
    setTimeout(()=>openStep(1,"NUEVA CARRERA · CONFIGURACIÓN"),60);
    return true;
  }
  function openHistory(){const btn=$("#m2OrganizerHistoryOpen");if(btn){btn.click();return}openInjected(["m2EventHistoricalResults"],"HISTÓRICO Y RESULTADOS",1)}
  function openProfile(){
    closeMore();
    const btn=$("#m2AuthAccountBtn");
    if(btn){btn.click();return}
    safeCall("toast","El perfil todavía se está cargando. Inténtalo de nuevo en un instante.");
  }
  function onTopAction(event){const a=event.target.closest("[data-r1-action]")?.dataset.r1Action;if(!a)return;closeMore();if(a==="home"){showMapHome();return}if(a==="profile"){openProfile();return}if(a==="races"){closeWorkspace(true);openRaces();return}if(a==="manager"){openRaceManager();return}if(a==="participants"){openInjected(["m2Invitations","m2ParticipantsAdmin"],"PARTICIPANTES",1);return}if(a==="live"){openInjected(["m2OrganizerLiveMonitor","m2OrganizerLiveMap"],"LIVE · CENTRO DE SEGUIMIENTO",1);return}if(a==="more"){openMore();return}}
  function runMoreAction(a){if(a==="manager")return openRaceManager();if(a==="config")return openStep(1,"CONFIGURACIÓN DE CARRERA");if(a==="participants")return openInjected(["m2Invitations","m2ParticipantsAdmin"],"PARTICIPANTES",1);if(a==="routes")return openRoutesModule();if(a==="maptools")return openStep(2,"AJUSTES Y DATOS DEL MAPA");if(a==="material"){if(!materialQrUnlocked())return showMaterialLockedNotice();return openStep(4,"MATERIAL QR Y EXPORTACIÓN")}if(a==="sequence")return openStep(5,"SECUENCIA DE SALIDA Y LLEGADA");if(a==="results")return openStep(6,"RESULTADOS Y CONTROL");if(a==="analysis")return openStep(7,"ANÁLISIS Y REPRODUCTOR");if(a==="history"){closeMore();return openHistory()}if(a==="help"){closeMore();if(typeof window.showOrientationGuide==="function")window.showOrientationGuide();return}}
  const R3_STATUS={draft:"BORRADOR",prepared:"PREPARADO",published:"PUBLICADO",live:"EN DIRECTO",finished:"FINALIZADO",archived:"ARCHIVADO"};
  const R3_ORDER=["draft","prepared","published","live","finished","archived"];
  function currentLifecycleStatus(){return String(window.MILITOPO_V2_EVENT_STATUS?.status||state.eventStatus?.status||state.managerEvent?.status||"draft")}
  function materialQrUnlocked(){return R3_ORDER.indexOf(currentLifecycleStatus())>=R3_ORDER.indexOf("prepared")}
  function showMaterialLockedNotice(){
    closeMore();
    const message="MATERIAL QR está bloqueado mientras la carrera esté en BORRADOR. Estará disponible cuando la carrera pase a PREPARADO.";
    try{window.alert(message)}catch(_){safeCall("toast",message)}
    return false;
  }
  function refreshMaterialAccess(){
    const locked=!materialQrUnlocked();
    const more=$("[data-more-action='material']");
    if(more){more.classList.toggle("is-locked",locked);more.setAttribute("aria-disabled",locked?"true":"false");const small=$("small",more);if(small)small.textContent=locked?"🔒 Disponible desde PREPARADO":"Planos, QR y exportaciones";}
  }
  function routePlanSnapshot(){
    const snap=window.MILITOPO_R2_BRIDGE?.getSnapshot?.();
    if(!snap)return null;
    const required=Math.max(1,Math.min(Number(snap.participantCount)||1,Number(snap.maxUniqueRoutes)||1));
    const ids=[...new Set((snap.routeIds||[]).map(String))];
    const created=ids.length;
    const expected=Array.from({length:required},(_,i)=>"R"+String(i+1).padStart(2,"0"));
    const missingIds=expected.filter(id=>!ids.includes(id));
    return {...snap,required,created,missing:Math.max(0,required-created),missingIds};
  }
  function refreshRoutesProfessional(){
    const plan=routePlanSnapshot();if(!plan)return;
    const required=$("#r3RoutesRequired"),created=$("#r3RoutesCreated"),missing=$("#r3RoutesMissing"),box=$("#r3RoutesCompletion");
    if(required)required.textContent=String(plan.required);if(created)created.textContent=String(plan.created);if(missing)missing.textContent=String(plan.missing);
    if(!box)return;
    if(plan.missing>0){
      const noun=plan.missing===1?"recorrido":"recorridos";
      box.className="r3-routes-completion is-pending";
      box.innerHTML=`<div><strong>FALTAN ${plan.missing} ${noun.toUpperCase()}</strong><span>Debes completar ${plan.required} en total. Pendientes: ${plan.missingIds.join(", ")||"—"}.</span></div><button type="button" data-r3-complete-routes>COMPLETAR RECORRIDOS</button>`;
      box.querySelector("[data-r3-complete-routes]")?.addEventListener("click",openMapAndTrace);
    }else{
      box.className="r3-routes-completion is-complete";
      box.innerHTML=`<div><strong>RECORRIDOS COMPLETOS</strong><span>Ya están creados los ${plan.required} recorridos previstos para esta carrera.</span></div>`;
    }
  }
  function openMapAndTrace(){
    closeMore();closeWorkspace(true);
    setTimeout(()=>{try{window.MILITOPO_R2_MAP_HOME?.activate?.();window.MILITOPO_R2_MAP_HOME?.refresh?.()}catch(_){}},25);
    setTimeout(()=>{try{window.MILITOPO_R2_MAP_HOME?.openTracePicker?.()}catch(_){safeCall("toast","Pulsa TRAZAR para seleccionar el recorrido.")}},110);
  }
  function openRoutesModule(){const ok=openStep(3,"RECORRIDOS");if(ok!==false)setTimeout(refreshRoutesProfessional,120);return ok}
  function numValue(id,fallback=0){const n=Number($("#"+id)?.value);return Number.isFinite(n)?n:fallback}
  function routeCountFromUi(fallback=0){const text=String($("#routeCountInfo")?.textContent||"");const match=text.match(/·\s*(\d+)\s+recorrido/i);return match?Number(match[1]):Number(fallback)||0}
  function currentManagerContext(extra={}){
    const lifecycle=window.MILITOPO_V2_EVENT_STATUS||state.eventStatus||{};
    const prior=state.managerEvent||{};
    return {
      ...prior,...extra,
      eventId:currentEventId()||extra.eventId||prior.eventId||"",
      eventName:currentEventName()||extra.eventName||prior.eventName||"MILITOPO ORIENTACIÓN",
      status:String(lifecycle.status||extra.status||prior.status||"draft"),
      participantCount:numValue("participantCount",extra.participantCount??prior.participantCount??0),
      controlCount:numValue("controlCount",extra.controlCount??prior.controlCount??0),
      controlsPerRoute:numValue("controlsPerRoute",extra.controlsPerRoute??prior.controlsPerRoute??0),
      courseSyncedCount:routeCountFromUi(extra.courseSyncedCount??prior.courseSyncedCount??0)
    };
  }
  function managerTrack(status){const current=Math.max(0,R3_ORDER.indexOf(status));return R3_ORDER.map((key,index)=>`<span class="r3-manager-stage ${index<current?"is-done":index===current?"is-current":""}">${R3_STATUS[key]}</span>`).join("")}
  function managerCard(action,title,desc,iconName,tone="") {return `<button type="button" class="r3-manager-card ${tone}" data-r3-manager-action="${action}"><span class="r3-manager-icon">${icon(iconName)}</span><span class="r3-manager-card-copy"><strong>${title}</strong><small>${desc}</small></span><span class="r3-manager-arrow">›</span></button>`}
  function designReadinessSnapshot(){
    const snap=window.MILITOPO_R2_BRIDGE?.getSnapshot?.();
    const routePlan=routePlanSnapshot();
    if(!snap)return null;
    const points=Array.isArray(snap.points)?snap.points:[];
    const start=points.find(p=>p.type==="SALIDA");
    const finish=points.find(p=>p.type==="LLEGADA");
    const hasStart=!!start&&start.lat!==null&&start.lon!==null;
    const hasFinish=!!finish&&finish.lat!==null&&finish.lon!==null;
    const controlTotal=Array.isArray(snap.controls)?snap.controls.length:0;
    const controlsPlaced=Number(snap.controlsPlaced)||0;
    const rulesOk=Number(snap.participantCount)>0&&controlTotal>0&&Number(snap.controlsPerRoute)>0&&Number(snap.controlsPerRoute)<=controlTotal&&Number(snap.maxUniqueRoutes)>0;
    const mapOk=hasStart&&hasFinish&&controlsPlaced>=controlTotal;
    const routesOk=!!routePlan&&routePlan.missing===0;
    const items=[
      {key:"config",title:"REGLAS DE CARRERA",ok:rulesOk,detail:rulesOk?`${snap.participantCount} participantes · ${controlTotal} balizas · ${snap.controlsPerRoute} por recorrido`:`Revisa participantes, balizas y balizas por recorrido.`},
      {key:"map",title:"MAPA Y BALIZAS",ok:mapOk,detail:mapOk?`SALIDA + ${controlsPlaced} balizas + LLEGADA colocadas`:`${hasStart?"SALIDA ✓":"Falta SALIDA"} · ${controlsPlaced}/${controlTotal} balizas · ${hasFinish?"LLEGADA ✓":"Falta LLEGADA"}`},
      {key:"routes",title:"RECORRIDOS",ok:routesOk,detail:routePlan?(routesOk?`${routePlan.created}/${routePlan.required} recorridos completos`:`${routePlan.created}/${routePlan.required} completos · faltan ${routePlan.missingIds.join(", ")||routePlan.missing}`):"No se pudo leer el plan de recorridos."}
    ];
    return {items,ready:items.every(item=>item.ok),done:items.filter(item=>item.ok).length,total:items.length};
  }
  function missingMapPlan(){
    const snap=window.MILITOPO_R2_BRIDGE?.getSnapshot?.();
    if(!snap)return {tool:"",message:""};
    const points=Array.isArray(snap.points)?snap.points:[];
    const start=points.find(p=>p.type==="SALIDA");
    const finish=points.find(p=>p.type==="LLEGADA");
    const hasStart=!!start&&start.lat!==null&&start.lon!==null;
    const hasFinish=!!finish&&finish.lat!==null&&finish.lon!==null;
    const total=Array.isArray(snap.controls)?snap.controls.length:0;
    const placed=Number(snap.controlsPlaced)||0;
    const missingControls=Math.max(0,total-placed);
    const missing=[];
    if(!hasStart)missing.push("SALIDA");
    if(missingControls)missing.push(`${missingControls} ${missingControls===1?"BALIZA":"BALIZAS"}`);
    if(!hasFinish)missing.push("LLEGADA");
    const prefix=missing.length?`FALTA${missing.length>1?"N":""}: ${missing.join(" · ")}. `:"";
    if(!hasStart)return {tool:"start",message:`${prefix}SALIDA activada · toca el mapa para colocarla.`};
    if(missingControls)return {tool:"control",message:`${prefix}BALIZA activada · coloca las balizas pendientes una a una.`};
    if(!hasFinish)return {tool:"finish",message:`${prefix}LLEGADA activada · toca el mapa para colocarla.`};
    return {tool:"",message:"Mapa completo · SALIDA, todas las balizas y LLEGADA están colocadas."};
  }
  function openMapForMissing(){
    const plan=missingMapPlan();
    closeMore();closeWorkspace(true);
    setTimeout(()=>{try{window.MILITOPO_R2_MAP_HOME?.activate?.();window.MILITOPO_R2_MAP_HOME?.refresh?.()}catch(_){}},25);
    setTimeout(()=>{
      try{
        if(plan.tool)window.MILITOPO_R2_MAP_HOME?.activatePlacementTool?.(plan.tool,plan.message);
        else safeCall("toast",plan.message);
      }catch(_){safeCall("toast",plan.message||"Abre la herramienta correspondiente en el mapa.")}
    },115);
  }
  function openMissingRoutes(){openMapAndTrace()}
  function readinessHtml(){
    const ready=designReadinessSnapshot();
    if(!ready)return "";
    const firstPending=ready.items.find(item=>!item.ok);
    const status=currentLifecycleStatus();
    const title=ready.ready?(status==="draft"?"DISEÑO LISTO PARA PREPARAR":"DISEÑO COMPLETO"):"PREPARACIÓN PENDIENTE";
    const subtitle=ready.ready?(status==="draft"?"La estructura básica está completa. Revisa ESTADO Y PUBLICACIÓN para pasar a PREPARADO.":"La estructura cartográfica obligatoria está completa."):`${ready.done}/${ready.total} bloques básicos completados antes de preparar la carrera.`;
    const action=ready.ready?"lifecycle":(firstPending?.key||"config");
    const smartAction=action==="map"?"complete-map":action==="routes"?"complete-routes":action;
    const actionLabel=ready.ready?(status==="draft"?"REVISAR ESTADO Y PUBLICACIÓN":"VER ESTADO"):(action==="routes"?"COMPLETAR RECORRIDOS":action==="map"?"COMPLETAR MAPA":"REVISAR CONFIGURACIÓN");
    return `<section class="r3-readiness ${ready.ready?"is-ready":"is-pending"}" aria-label="Preparación de carrera">
      <div class="r3-readiness-head"><div><span>CONTROL DE PREPARACIÓN</span><strong>${title}</strong><small>${subtitle}</small></div><b>${ready.done}/${ready.total}</b></div>
      <div class="r3-readiness-list">${ready.items.map(item=>{const itemAction=!item.ok&&item.key==="map"?"complete-map":!item.ok&&item.key==="routes"?"complete-routes":item.key;return `<button type="button" class="r3-readiness-item ${item.ok?"is-ok":"is-warn"}" data-r3-manager-action="${itemAction}"><i>${item.ok?"✓":"!"}</i><span><strong>${item.title}</strong><small>${item.detail}</small></span><em>›</em></button>`}).join("")}</div>
      <button type="button" class="r3-readiness-main" data-r3-manager-action="${smartAction}">${actionLabel}</button>
    </section>`;
  }
  function renderRaceManager(){
    const body=$("#r1WorkspaceBody");if(!body)return;
    const ctx=currentManagerContext();state.managerEvent=ctx;state.managerOpen=true;
    const status=R3_STATUS[ctx.status]||String(ctx.status||"BORRADOR").toUpperCase();
    body.innerHTML=`<section class="r3-manager" aria-label="Gestión de carrera">
      <div class="r3-manager-hero">
        <div class="r3-manager-title"><span>GESTIÓN DE CARRERA</span><h2>${String(ctx.eventName).replace(/[&<>"]/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[s]||s))}</h2><small>${ctx.eventId||"Sin identificador"}</small></div>
        <span class="r3-manager-status" data-status="${ctx.status}">${status}</span>
      </div>
      <div class="r3-manager-track">${managerTrack(ctx.status)}</div>
      <div class="r3-manager-metrics">
        <div><strong>${ctx.participantCount||"—"}</strong><span>PARTICIPANTES</span></div>
        <div><strong>${ctx.controlCount||"—"}</strong><span>BALIZAS</span></div>
        <div><strong>${ctx.courseSyncedCount||"—"}</strong><span>RECORRIDOS</span></div>
        <div><strong>${ctx.controlsPerRoute||"—"}</strong><span>BALIZAS POR RECORRIDO</span></div>
      </div>
      ${readinessHtml()}
      <div class="r3-manager-section-head"><strong>GESTIONAR</strong><span>Accede a cada área sin navegar por PASOS.</span></div>
      <div class="r3-manager-grid">
        ${managerCard((designReadinessSnapshot()?.items.find(i=>i.key==="map")?.ok)?"map":"complete-map","MAPA Y BALIZAS","Diseñar salida, llegada, balizas y trazado","layers","is-primary")}
        ${managerCard("config","CONFIGURACIÓN","Datos generales y reglas de la carrera","settings")}
        ${managerCard("routes","RECORRIDOS","Revisar recorridos manuales y asignaciones","route")}
        ${managerCard("participants","PARTICIPANTES","Invitaciones, censo y asignación de recorrido","users")}
        ${managerCard("lifecycle","ESTADO Y PUBLICACIÓN","Preparar, publicar, iniciar, finalizar y archivar","flag","is-state")}
        ${managerCard("live","LIVE","Centro de seguimiento en tiempo real","live","is-live")}
        ${managerCard("material","MATERIAL QR",materialQrUnlocked()?"Planos, QR y exportaciones":"🔒 Disponible desde PREPARADO","qr",materialQrUnlocked()?"":"is-locked")}
        ${managerCard("sequence","SECUENCIA","Salidas, llegadas y control de carrera","flag")}
        ${managerCard("results","RESULTADOS","Resultados y control de participantes","chart")}
        ${managerCard("analysis","ANÁLISIS","Reproductor y análisis post-carrera","chart")}
      </div>
      <div class="r3-manager-footer"><button type="button" data-r3-manager-action="races">← CARGAR CARRERA</button><button type="button" class="is-map" data-r3-manager-action="map">VOLVER AL MAPA</button></div>
    </section>`;
    body.querySelectorAll("[data-r3-manager-action]").forEach(button=>button.addEventListener("click",()=>runManagerAction(button.dataset.r3ManagerAction)));
  }
  function openRaceManager(event={}){
    closeMore();
    const ctx=currentManagerContext(event);
    if(!ctx.eventId){safeCall("toast","Carga primero una carrera desde CARGAR CARRERA.");openRaces();return}
    state.managerEvent=ctx;
    closeWorkspace(false);
    const titleEl=$("#r1WorkspaceTitle");if(titleEl)titleEl.textContent="GESTIÓN DE CARRERA";
    state.mapHome=false;document.body.classList.add("r1-workspace-open");
    state.workspace?.classList.add("is-open");document.body.style.overflow="hidden";
    renderRaceManager();setTimeout(()=>window.dispatchEvent(new Event("resize")),60);
  }
  function runManagerAction(action){
    state.managerOpen=false;
    if(action==="races"){closeWorkspace(true);setTimeout(openRaces,60);return}
    if(action==="complete-map")return openMapForMissing();
    if(action==="complete-routes")return openMissingRoutes();
    if(action==="map"){closeWorkspace(true);return}
    if(action==="config")return openStep(1,"CONFIGURACIÓN DE CARRERA");
    if(action==="routes")return openRoutesModule();
    if(action==="participants")return openInjected(["m2Invitations","m2ParticipantsAdmin"],"PARTICIPANTES",1);
    if(action==="lifecycle")return openInjected(["m2EventLifecycle"],"ESTADO Y PUBLICACIÓN",1);
    if(action==="live")return openInjected(["m2OrganizerLiveMonitor","m2OrganizerLiveMap"],"LIVE · CENTRO DE SEGUIMIENTO",1);
    if(action==="material"){if(!materialQrUnlocked())return showMaterialLockedNotice();return openStep(4,"MATERIAL QR Y EXPORTACIÓN")}
    if(action==="sequence")return openStep(5,"SECUENCIA DE SALIDA Y LLEGADA");
    if(action==="results")return openStep(6,"RESULTADOS Y CONTROL");
    if(action==="analysis")return openStep(7,"ANÁLISIS Y REPRODUCTOR");
  }
  function refreshContext(){
    const active=$$(".card.active")[0];const m=active?.id?.match(/^step(\d+)$/);state.currentStep=m?Number(m[1]):state.currentStep;
    const workspaceOpen=!!state.workspace?.classList.contains("is-open");state.mapHome=!workspaceOpen;
    document.body.classList.toggle("r1-map-context",!workspaceOpen);document.body.classList.toggle("r1-map-home",!workspaceOpen);
    $$(".r1-nav-btn").forEach(b=>b.classList.remove("is-active"));
    const name=$("#r1EventName"),meta=$("#r1EventMeta");if(name)name.textContent=currentEventName();if(meta)meta.textContent=currentEventId()||"Sin carrera cargada";
  }
  function setRole(role){state.role=String(role||"organizer");const pill=$("#r1RolePill");if(pill){pill.dataset.role=state.role;$("span",pill).textContent=roleLabel(state.role)}}
  function bindEvents(){
    window.addEventListener("militopo:v2-auth-ready",e=>setRole(e.detail?.role));
    window.addEventListener("militopo:v2-orientation-header",e=>{const h=e.detail?.header||{};const name=$("#r1EventName"),meta=$("#r1EventMeta");if(name&&h.eventName)name.textContent=h.eventName;if(meta&&h.eventId)meta.textContent=h.eventId});
    window.addEventListener("militopo:v2-cloud-event-applied",()=>setTimeout(refreshContext,100));
    window.addEventListener("militopo:r3-race-manager-open",event=>{const race=event?.detail?.event||{};setTimeout(()=>openRaceManager(race),80)});
    window.addEventListener("militopo:v2-event-status",event=>{state.eventStatus=event?.detail||null;refreshMaterialAccess();if(state.managerOpen&&state.workspace?.classList.contains("is-open"))renderRaceManager()});
    window.addEventListener("militopo:v2-event-status-changed",event=>{const to=event?.detail?.to;if(to&&state.managerEvent)state.managerEvent={...state.managerEvent,status:to};refreshMaterialAccess();if(state.managerOpen&&state.workspace?.classList.contains("is-open"))setTimeout(renderRaceManager,120)});
    window.addEventListener("militopo:r2-route-updated",()=>{if(state.currentStep===3)setTimeout(refreshRoutesProfessional,70);if(state.managerOpen&&state.workspace?.classList.contains("is-open"))setTimeout(renderRaceManager,90)});
    window.addEventListener("militopo:r2-config-updated",event=>{
      /* R2H · una sola pulsación en SINCRONIZAR aplica reglas y vuelve al mapa
         sin recargar ni cerrar la PWA. */
      closeMore();
      closeWorkspace(true);
      setTimeout(()=>{
        try{window.MILITOPO_R2_MAP_HOME?.activate?.();window.MILITOPO_R2_MAP_HOME?.refresh?.()}catch(_){}
        refreshContext();
        if(state.currentStep===3)refreshRoutesProfessional();
        if(state.managerOpen&&state.workspace?.classList.contains("is-open"))renderRaceManager();
      },45);
    });
    document.addEventListener("input",e=>{if(e.target?.id==="eventName")refreshContext()},{passive:true});
    document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;if($("#r1More")?.classList.contains("is-open"))closeMore();else if(state.workspace?.classList.contains("is-open"))closeWorkspace();});
    const observer=new MutationObserver(refreshContext);$$('.card').forEach(card=>observer.observe(card,{attributes:true,attributeFilter:["class"]}));
  }
  
  globalThis.MILITOPO_R3_ORGANIZER_MANAGER=Object.freeze({open:(event)=>openRaceManager(event||{}),close:()=>closeWorkspace(true),mapAndTrace:openMapAndTrace,refreshRoutes:refreshRoutesProfessional});
  globalThis.addEventListener("militopo:r3-new-race",startNewRace);
function init(){
    document.body.classList.add("r1-shell-active");
    try{setRole(localStorage.getItem("militopo_v2_last_role")||"organizer")}catch(_){}
    buildTopbar();buildMapDock();buildMore();buildWorkspace();bindEvents();refreshContext();
    setTimeout(()=>{safeCall("goStep",2,{noScroll:true,silent:true});state.currentStep=2;state.mapHome=true;window.MILITOPO_R2_MAP_HOME?.activate?.();refreshContext()},260);
    setTimeout(refreshContext,700);setTimeout(refreshContext,1600);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
