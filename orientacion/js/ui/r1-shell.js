/* MILITOPO · REDISEÑO R1 · navegación/shell no destructivo */
(()=>{
  if(window.__MILITOPO_R1_SHELL__) return;
  window.__MILITOPO_R1_SHELL__=true;

  const state={role:"organizer",workspace:null,hosted:[],currentStep:2,mapHome:true,managerEvent:null,managerOpen:false,eventStatus:null,managerModuleTitle:null,participantsObserver:null,participantsTab:"invites",managerTab:"design"};
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
      admin:'<path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6z"/><path d="M9 12h6M12 9v6"/>',
      close:'<path d="m6 6 12 12M18 6 6 18"/>'
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.more}</svg>`;
  };
  function safeCall(name,...args){try{const fn=window[name];if(typeof fn==="function")return fn(...args)}catch(e){console.warn("MILITOPO R1",name,e)}return null}
  function roleLabel(role){return role==="super_admin"?"SÚPER ADMIN":role==="organizer"?"ORGANIZADOR":"CORREDOR"}
  function currentEventName(){return String($("#eventName")?.value||"MILITOPO ORIENTACIÓN").trim()||"MILITOPO ORIENTACIÓN"}
  function currentEventId(){return String($("#eventId")?.value||"").trim()}

  /* R7F.2 · Señal de navegación robusta dentro de módulos.
     La pantalla principal de Organizer/Súper Admin conserva su diseño original SIN flechas.
     En módulos, pestañas y accesos que profundizan en otra vista sí mantenemos el chevron naranja. */
  const NAV_TARGET_SELECTOR=[
    '[data-more-action]','[role="tab"]','button[aria-expanded]',
    '[data-r3-manager-action]','[data-r3-manager-tab]','[data-r3-back-manager]',
    '[data-r4-part-tab]','[data-r4-live-jump]','[data-r4-analysis-tab]','[data-r4-go-lifecycle]',
    '[data-r3-complete-routes]','[data-r2-route-choice]','[data-r5-race-choice]',
    '[data-r4-results-view]','[data-h5-view]','[data-roster-filter]','[data-live-layer]','[data-track-layer]',
    '#m2CloudRecoveryOpen','#m2OrganizerHistoryOpen','.m2-cloud-event-open','.m2-history-open-results',
    '.m2-life-live-link','.m2-r5-reuse','.m2-r5-new-main','.analysis-tab',
    '.r1-layer-pop [data-layer]','.layer-btn[data-layer]','.r3-routes-layers button','#toggleFinishOrganizedBtn',
    '[data-r2-details="prev"]','[data-r2-details="next"]',
    '.nav-row button','.iof-nav-buttons button','.militopo-platform-choice','.militopo-platform-back'
  ].join(',');
  function decorateNavigationTargets(root=document){
    const items=[];
    try{if(root?.matches?.(NAV_TARGET_SELECTOR))items.push(root)}catch(_){}
    try{items.push(...root.querySelectorAll?.(NAV_TARGET_SELECTOR)||[])}catch(_){}
    items.forEach(el=>{
      const locked=el.matches?.('.is-locked,[disabled],[aria-disabled="true"]');
      el.classList.toggle('militopo-nav-target',!locked);
    });
  }
  function startNavigationDecorator(){
    decorateNavigationTargets(document);
    document.querySelectorAll('.r1-map-btn[data-map-action="layers"],[data-r2-tools-toggle]').forEach(el=>el.classList.remove('militopo-nav-target'));
    const observer=new MutationObserver(records=>{records.forEach(record=>record.addedNodes.forEach(node=>{if(node?.nodeType===1){decorateNavigationTargets(node);try{if(node.matches?.('.r1-map-btn[data-map-action="layers"],[data-r2-tools-toggle]'))node.classList.remove('militopo-nav-target');node.querySelectorAll?.('.r1-map-btn[data-map-action="layers"],[data-r2-tools-toggle]').forEach(el=>el.classList.remove('militopo-nav-target'))}catch(_){}}}))});
    observer.observe(document.body,{childList:true,subtree:true});
    state.navDecoratorObserver=observer;
  }

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
        <button class="r1-nav-btn" type="button" data-r1-action="profile" aria-label="Mi perfil"><span class="r1-profile-online" aria-label="Sesión iniciada"><i></i><em>EN LÍNEA</em></span>${icon("profile")}<span class="r1-label r1-label-profile"><span>MI</span><span>PERFIL</span></span></button>
        <button class="r1-nav-btn is-primary" type="button" data-r1-action="races">${icon("plus")}<span class="r1-label r1-label-load"><span>CARGAR</span><span>CARRERA</span></span></button>
        <button class="r1-nav-btn is-manager" type="button" data-r1-action="manager">${icon("settings")}<span class="r1-label r1-label-manager"><span>GESTIONAR</span><span>CARRERA</span></span></button>
        <button class="r1-nav-btn" type="button" data-r1-action="participants">${icon("users")}<span>PARTICIPANTES</span></button>
        <button class="r1-nav-btn is-live" type="button" data-r1-action="live" aria-label="LIVE">${icon("live")}<span>LIVE</span><i class="r1-live-pulse" aria-hidden="true"></i></button>
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
        <button class="r1-more-action r8-admin-launch" type="button" data-more-action="admin" hidden><strong>ADMINISTRACIÓN</strong><small>Usuarios, roles y supervisión global</small></button>
        ${moreAction("CONFIGURACIÓN","Datos y reglas de la carrera","config")}
        ${moreAction("PARTICIPANTES","Invitaciones, censo y asignaciones","participants")}
        ${moreAction("RECORRIDOS","Crear y revisar recorridos manuales","routes")}
        ${moreAction("AJUSTES DE MAPA","Importar, buscar, editar y revisar datos cartográficos","maptools")}
        ${moreAction("MATERIAL QR","Planos, QR y exportaciones","material")}
        ${moreAction("SECUENCIA","Salidas, llegadas y control","sequence")}
        ${moreAction("RESULTADOS","Resultados y clasificación","results")}
        ${moreAction("ANÁLISIS","Reproductor y análisis post-carrera","analysis")}
        ${moreAction("HISTÓRICO","Carreras finalizadas y archivadas","history")}
        ${moreAction("AYUDA Y GUÍA","Centro visual de ayuda y flujo de trabajo","help")}
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
    try{state.participantsObserver?.disconnect?.()}catch(_){} state.participantsObserver=null;
    titleEl.textContent=title;body.innerHTML="";state.hosted=[];body.classList.remove("r3-manager-view","r4-participants-view","r4-live-view","r4-analysis-view");
    const managerTitle=state.managerModuleTitle;state.managerModuleTitle=null;
    if(managerTitle){
      const nav=document.createElement("div");nav.className="r3-module-nav";
      nav.innerHTML=`<div><span>GESTIÓN DE CARRERA</span><strong>${managerTitle}</strong><small>${currentEventName()}</small></div><button type="button" data-r3-back-manager>← VOLVER A GESTIONAR</button>`;
      nav.querySelector("[data-r3-back-manager]")?.addEventListener("click",()=>openRaceManager(state.managerEvent||{}));
      body.appendChild(nav);
    }
    const stack=document.createElement("div");stack.className="r1-module-stack";body.appendChild(stack);
    nodes.filter(Boolean).forEach(node=>{const marker=document.createComment(`r1:${node.id||node.tagName}`);node.parentNode?.insertBefore(marker,node);state.hosted.push({node,marker});node.classList.add("r1-hosted");stack.appendChild(node)});
    state.workspace.classList.add("is-open");document.body.style.overflow="hidden";
    /* R3D/R3G: cada módulo abre arriba y sin conservar desplazamiento horizontal. */
    const resetWorkspaceScroll=()=>{try{body.scrollTop=0;body.scrollLeft=0;body.scrollTo({top:0,left:0,behavior:"auto"});if(state.workspace){state.workspace.scrollTop=0;state.workspace.scrollLeft=0}}catch(_){}};
    resetWorkspaceScroll();requestAnimationFrame(resetWorkspaceScroll);setTimeout(()=>{resetWorkspaceScroll();window.dispatchEvent(new Event("resize"))},80);
  }
  function closeWorkspace(returnToMap=true){
    state.hosted.forEach(({node,marker})=>{try{node.classList.remove("r1-hosted");marker.parentNode?.insertBefore(node,marker);marker.remove()}catch(_){}});
    state.hosted=[];state.managerOpen=false;try{state.participantsObserver?.disconnect?.()}catch(_){} state.participantsObserver=null;state.workspace?.classList.remove("is-open");if(state.workspace){const body=$("#r1WorkspaceBody",state.workspace);body?.classList.remove("r4-participants-view","r4-live-view","r4-analysis-view");if(body)body.innerHTML=""}document.body.style.overflow="";
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
  function participantHubNumber(id){const n=Number(String($(id)?.textContent||"0").replace(/[^0-9-]/g,""));return Number.isFinite(n)?n:0}
  function lifecycleLabelEs(status){return R3_STATUS[String(status||"draft").toLowerCase()]||"BORRADOR"}
  function participantsSnapshot(){try{return window.MILITOPO_V2_PARTICIPANTS_ADMIN?.getSnapshot?.()||null}catch(_){return null}}
  async function openLifecycleFromParticipants(){
    const status=currentLifecycleStatus(),label=lifecycleLabelEs(status);
    const message=`La carrera está en ${label}. Para enviar invitaciones debe estar PUBLICADA.\n\n¿Quieres ir a ESTADO Y PUBLICACIÓN?`;
    if(!await globalThis.MILITOPO_CONFIRM(message,{title:"PUBLICAR PARA INVITAR",confirmText:"IR A ESTADO"}))return false;
    state.managerEvent=currentManagerContext(state.managerEvent||{});
    state.managerModuleTitle="ESTADO Y PUBLICACIÓN";
    return openManagerInjected(["m2EventLifecycle"],"ESTADO Y PUBLICACIÓN",1);
  }
  function refreshParticipantsHub(){
    const hub=$("#r4ParticipantsHub");if(!hub)return;
    const capacity=Math.max(0,Number($("#participantCount")?.value)||0);
    const active=participantHubNumber("#m2RosterActive"),pending=participantHubNumber("#m2RosterPending"),removed=participantHubNumber("#m2RosterRemoved");
    const status=currentLifecycleStatus(),published=status==="published",label=lifecycleLabelEs(status);
    const set=(id,value)=>{const el=$(id,hub);if(el)el.textContent=String(value)};
    set("#r4PartCapacity",capacity||"—");set("#r4PartActive",active);set("#r4PartPending",pending);set("#r4PartRemoved",removed);
    const chip=$("#r4PartState",hub);if(chip){chip.textContent=label;chip.dataset.status=status}
    const inviteTab=$("[data-r4-part-tab='invites']",hub);if(inviteTab){inviteTab.classList.toggle("is-locked",!published);inviteTab.querySelector("small").textContent=published?"AÑADIR Y COMPARTIR":"REQUIERE PUBLICADO"}
    const notice=$("#r4PartNotice",hub);if(notice){
      notice.className="r4-participants-notice "+(published?"is-open":"is-locked");
      notice.innerHTML=published
        ? `<strong>PUBLICADO</strong><span>Invitaciones habilitadas.</span>`
        : `<strong>${label}</strong><span>Para invitar, la carrera debe estar PUBLICADA.</span><button type="button" data-r4-go-lifecycle>IR A ESTADO Y PUBLICACIÓN</button>`;
    }
    refreshAssignmentsHub();
  }
  function assignmentRouteCard(routeId,members){
    const details=window.MILITOPO_R2_BRIDGE?.getRouteDetails?.(routeId)||null;
    const assigned=members.filter(row=>String(row.routeId||"")===String(routeId));
    const distance=Number(details?.metrics?.distanceKm),positive=Number(details?.metrics?.positiveM);
    const distanceText=Number.isFinite(distance)?`${distance.toFixed(2)} km`:"—";
    const positiveText=Number.isFinite(positive)?`+${Math.round(positive)} m`:"—";
    const difficulty=String(details?.metrics?.difficulty||"—").toUpperCase();
    return `<article class="r4-assignment-route"><div><strong>${routeId}</strong><span>${assigned.length} asignado${assigned.length===1?"":"s"}</span></div><small>${distanceText} · ${positiveText} · ${difficulty}</small></article>`;
  }
  function refreshAssignmentsHub(){
    const panel=$("#r4AssignmentsPanel");if(!panel)return;
    const snap=participantsSnapshot();
    const plan=routePlanSnapshot();
    const members=(snap?.members||[]).filter(row=>String(row.status||"active")==="active");
    const assigned=members.filter(row=>row.participantId&&row.routeId);
    const unassigned=members.filter(row=>!row.participantId||!row.routeId);
    const capacity=Math.max(0,Number($("#participantCount")?.value)||Number(plan?.participantCount)||0);
    const free=Math.max(0,capacity-members.length);
    const routeIds=(plan?.routeIds||[]).map(String);
    const pending=(snap?.invitations||[]).filter(row=>String(row.status||"pending")==="pending");
    const metrics=panel.querySelector("[data-r4-assignment-metrics]");if(metrics)metrics.innerHTML=`
      <div><strong>${assigned.length}</strong><span>ASIGNADOS</span></div>
      <div class="${unassigned.length?"is-warn":""}"><strong>${unassigned.length}</strong><span>SIN RECORRIDO</span></div>
      <div><strong>${free}</strong><span>PLAZAS LIBRES</span></div>
      <div><strong>${routeIds.length}</strong><span>RECORRIDOS</span></div>`;
    const routes=panel.querySelector("[data-r4-assignment-routes]");if(routes)routes.innerHTML=routeIds.length?routeIds.map(id=>assignmentRouteCard(id,members)).join(""):`<div class="r4-assignment-empty">Todavía no hay recorridos creados.</div>`;
    const list=panel.querySelector("[data-r4-assignment-list]");if(list){
      const rows=members.map(row=>{
        const name=String(row.displayName||row.username||row.email||"Participante");
        const assignment=row.participantId&&row.routeId?`${row.participantId} · ${row.routeId}`:"SIN ASIGNAR";
        return `<div class="r4-assignment-person ${row.participantId&&row.routeId?"":"is-warn"}"><span>${name.replace(/[&<>\"]/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[s]||s))}</span><strong>${assignment}</strong></div>`;
      });
      if(pending.length)rows.push(`<div class="r4-assignment-pending"><strong>${pending.length} invitación${pending.length===1?"":"es"} pendiente${pending.length===1?"":"s"}</strong><span>El recorrido se asignará automáticamente al aceptar.</span></div>`);
      list.innerHTML=rows.length?rows.join(""):`<div class="r4-assignment-empty">Todavía no hay participantes unidos.</div>`;
    }
  }
  function selectParticipantsTab(tab){
    const hub=$("#r4ParticipantsHub"),roster=$("#m2ParticipantsAdmin"),invites=$("#m2Invitations"),assignments=$("#r4AssignmentsPanel");if(!hub||!roster||!invites||!assignments)return;
    state.participantsTab=["invites","roster","assignments"].includes(tab)?tab:"invites";
    hub.querySelectorAll("[data-r4-part-tab]").forEach(b=>b.classList.toggle("is-active",b.dataset.r4PartTab===state.participantsTab));
    roster.classList.toggle("r4-panel-hidden",state.participantsTab!=="roster");
    invites.classList.toggle("r4-panel-hidden",state.participantsTab!=="invites");
    assignments.classList.toggle("r4-panel-hidden",state.participantsTab!=="assignments");
    const body=$("#r1WorkspaceBody");if(body){body.scrollTop=0;body.scrollLeft=0}
    refreshParticipantsHub();refreshAssignmentsHub();
  }
  function decorateParticipantsModule(){
    const body=$("#r1WorkspaceBody"),stack=$(".r1-module-stack",body),roster=$("#m2ParticipantsAdmin",body),invites=$("#m2Invitations",body);if(!body||!stack||!roster||!invites)return false;
    body.classList.add("r4-participants-view");
    let hub=$("#r4ParticipantsHub",body);
    if(!hub){
      hub=document.createElement("section");hub.id="r4ParticipantsHub";hub.className="r4-participants-hub";
      hub.innerHTML=`<div class="r4-participants-hero"><div><span>ORGANIZACIÓN · PARTICIPANTES</span><h2>PARTICIPANTES</h2><small>${currentEventName()}</small></div><b id="r4PartState">—</b></div>
        <div class="r4-participants-metrics"><div><strong id="r4PartCapacity">—</strong><span>PLAZAS</span></div><div><strong id="r4PartActive">0</strong><span>UNIDOS</span></div><div><strong id="r4PartPending">0</strong><span>PENDIENTES</span></div><div><strong id="r4PartRemoved">0</strong><span>RETIRADOS</span></div></div>
        <div class="r4-participants-tabs"><button type="button" data-r4-part-tab="invites"><strong>INVITACIONES</strong><small>AÑADIR Y COMPARTIR</small></button><button type="button" data-r4-part-tab="roster"><strong>CENSO</strong><small>LISTA</small></button><button type="button" data-r4-part-tab="assignments"><strong>ASIGNACIONES</strong><small>PLAZAS Y RECORRIDOS</small></button></div>
        <div id="r4PartNotice" class="r4-participants-notice"></div>`;
      stack.parentNode.insertBefore(hub,stack);
      hub.addEventListener("click",event=>{const lifecycle=event.target.closest("[data-r4-go-lifecycle]");if(lifecycle){openLifecycleFromParticipants();return}const b=event.target.closest("[data-r4-part-tab]");if(b)selectParticipantsTab(b.dataset.r4PartTab)});
    }
    let assignments=$("#r4AssignmentsPanel",body);
    if(!assignments){
      assignments=document.createElement("section");assignments.id="r4AssignmentsPanel";assignments.className="r4-assignments-panel r4-panel-hidden";
      assignments.innerHTML=`<div class="r4-assignment-head"><div><strong>ASIGNACIÓN DE RECORRIDOS</strong><span>La plaza y el recorrido se asignan automáticamente al aceptar la invitación.</span></div><button type="button" data-r4-refresh-assignments>ACTUALIZAR</button></div><div class="r4-assignment-metrics" data-r4-assignment-metrics></div><div class="r4-assignment-section"><strong>DISTRIBUCIÓN POR RECORRIDO</strong><div class="r4-assignment-routes" data-r4-assignment-routes></div></div><div class="r4-assignment-section"><strong>PARTICIPANTES</strong><div class="r4-assignment-list" data-r4-assignment-list></div></div>`;
      stack.parentNode.insertBefore(assignments,stack);
      assignments.addEventListener("click",event=>{if(event.target.closest("[data-r4-refresh-assignments]")){try{window.MILITOPO_V2_PARTICIPANTS_ADMIN?.refresh?.()}catch(_){}setTimeout(refreshAssignmentsHub,180)}});
    }
    selectParticipantsTab(state.participantsTab||"invites");refreshParticipantsHub();refreshAssignmentsHub();
    try{state.participantsObserver?.disconnect?.()}catch(_){}
    /* R4B.1: observar solo los módulos fuente. Antes se observaba todo el stack,
       incluido el panel ASIGNACIONES que nosotros mismos reescribimos. Cada
       refresh generaba otra mutación y podía entrar en un bucle de MutationObserver
       que dejaba la interfaz sin responder (X, volver, pestañas, etc.). */
    let refreshQueued=false;
    const observer=new MutationObserver(()=>{
      if(refreshQueued)return;
      refreshQueued=true;
      requestAnimationFrame(()=>{
        refreshQueued=false;
        refreshParticipantsHub();
        refreshAssignmentsHub();
      });
    });
    const observerOptions={subtree:true,childList:true,characterData:true};
    observer.observe(roster,observerOptions);
    observer.observe(invites,observerOptions);
    state.participantsObserver=observer;
    setTimeout(()=>{refreshParticipantsHub();refreshAssignmentsHub()},220);setTimeout(()=>{refreshParticipantsHub();refreshAssignmentsHub()},700);
    return true;
  }
  function openParticipantsModule(fromManager=false){
    if(fromManager)state.managerModuleTitle="PARTICIPANTES";
    state.participantsTab="invites";
    openInjected(["m2Invitations","m2ParticipantsAdmin"],"PARTICIPANTES",1);
    setTimeout(decorateParticipantsModule,150);setTimeout(decorateParticipantsModule,360);
  }
  function refreshLiveHub(){
    const hub=$("#r4LiveHub");if(!hub)return;
    const status=currentLifecycleStatus(),label=lifecycleLabelEs(status);
    const chip=$("#r4LiveStatus",hub);if(chip){chip.textContent=label;chip.dataset.status=status}
    const total=participantHubNumber("#m2F2CTotal"),pending=participantHubNumber("#m2F2CPending"),racing=participantHubNumber("#m2F2CRacing"),finished=participantHubNumber("#m2F2CFinished");
    const values=[["#r4LiveTotal",total],["#r4LivePending",pending],["#r4LiveRacing",racing],["#r4LiveFinished",finished]];values.forEach(([id,v])=>{const el=$(id,hub);if(el)el.textContent=String(v)});
    const note=$("#r4LiveNotice",hub);if(note){
      if(status==="live"){note.className="r4-live-notice is-live";note.innerHTML="<strong>EN DIRECTO</strong><span>Posiciones, progreso y tiempos se actualizan automáticamente.</span><button type=\"button\" class=\"is-danger\" data-r4-live-finish>FINALIZAR CARRERA</button>"}
      else if(status==="finished"||status==="archived"){note.className="r4-live-notice";note.innerHTML=`<strong>${label}</strong><span>Se muestra la última información registrada de la carrera.</span>`}
      else{note.className="r4-live-notice is-warn";note.innerHTML=`<strong>${label}</strong><span>El seguimiento en directo se activa al iniciar la carrera.</span><button type="button" data-r4-live-lifecycle>ESTADO Y PUBLICACIÓN</button>`}
    }
  }
  function decorateLiveModule(){
    const body=$("#r1WorkspaceBody"),stack=$(".r1-module-stack",body),monitor=$("#m2OrganizerLiveMonitor",body),map=$("#m2OrganizerLiveMap",body);if(!body||!stack||!monitor||!map)return false;
    body.classList.add("r4-live-view");
    let hub=$("#r4LiveHub",body);
    if(!hub){
      hub=document.createElement("section");hub.id="r4LiveHub";hub.className="r4-live-hub";hub.innerHTML=`<div class="r4-live-hero"><div><span>ORGANIZACIÓN · SEGUIMIENTO</span><h2>LIVE</h2><small>${currentEventName()}</small></div><b id="r4LiveStatus">—</b></div><div class="r4-live-metrics"><div><strong id="r4LiveTotal">0</strong><span>PARTICIPANTES</span></div><div><strong id="r4LivePending">0</strong><span>SIN SALIR</span></div><div><strong id="r4LiveRacing">0</strong><span>EN CARRERA</span></div><div><strong id="r4LiveFinished">0</strong><span>FINALIZADOS</span></div></div><div id="r4LiveNotice" class="r4-live-notice"></div><div class="r4-live-jumps"><button type="button" data-r4-live-jump="map">MAPA</button><button type="button" data-r4-live-jump="table">TABLA DE SEGUIMIENTO</button></div>`;
      stack.parentNode.insertBefore(hub,stack);
      hub.addEventListener("click",event=>{
        if(event.target.closest("[data-r4-live-lifecycle]")){state.managerModuleTitle="ESTADO Y PUBLICACIÓN";openManagerInjected(["m2EventLifecycle"],"ESTADO Y PUBLICACIÓN",1);return}
        if(event.target.closest("[data-r4-live-finish]")){const fn=globalThis.MILITOPO_V2_EVENT_LIFECYCLE_ADVANCE;if(typeof fn==="function"){Promise.resolve(fn()).then(()=>setTimeout(refreshLiveHub,180)).catch(error=>{try{globalThis.toast?.(`No se pudo finalizar: ${String(error?.message||error)}`)}catch(_){}});}else{state.managerModuleTitle="ESTADO Y PUBLICACIÓN";openManagerInjected(["m2EventLifecycle"],"ESTADO Y PUBLICACIÓN",1);}return}
        const jump=event.target.closest("[data-r4-live-jump]")?.dataset.r4LiveJump;if(!jump)return;const target=jump==="map"?$("#m2OrganizerLiveMap",body):$("#m2OrganizerLiveMonitor",body);target?.scrollIntoView?.({behavior:"smooth",block:"start"});
      });
    }
    /* El mapa es la vista principal y la tabla queda justo debajo. */
    map.style.order="1";monitor.style.order="2";
    refreshLiveHub();
    let queued=false;const observer=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;refreshLiveHub()})});
    observer.observe(monitor,{subtree:true,childList:true,characterData:true});
    setTimeout(()=>{refreshLiveHub();try{window.dispatchEvent(new Event("resize"))}catch(_){}},120);
    return true;
  }
  function openLiveModule(fromManager=false){
    if(fromManager)state.managerModuleTitle="LIVE";
    openInjected(["m2OrganizerLiveMonitor","m2OrganizerLiveMap"],"LIVE · CENTRO DE SEGUIMIENTO",1);
    setTimeout(decorateLiveModule,150);setTimeout(decorateLiveModule,380);
  }
  function openResultsModule(fromManager=false){
    if(fromManager)state.managerModuleTitle="RESULTADOS Y CLASIFICACIÓN";
    openInjected(["m2EventHistoricalResults"],"RESULTADOS Y CLASIFICACIÓN",1);
    setTimeout(()=>{try{window.MILITOPO_V2_RESULTS_SET_VIEW?.("results")}catch(_){}},120);
  }
  function decorateAnalysisModule(){
    const body=$("#r1WorkspaceBody"),stack=$(".r1-module-stack",body),step=$("#step7",body);if(!body||!stack||!step)return false;
    body.classList.add("r4-analysis-view");
    let hub=$("#r4AnalysisHub",body);
    if(!hub){
      hub=document.createElement("section");hub.id="r4AnalysisHub";hub.className="r4-analysis-hub";
      hub.innerHTML=`<div class="r4-analysis-hero"><div><span>ORGANIZACIÓN · POST-CARRERA</span><h2>REPRODUCTOR Y ANÁLISIS</h2><small>${currentEventName()}</small></div><b>MULTICORREDOR</b></div><div class="r4-analysis-metrics"><div><strong>HASTA 5</strong><span>CORREDORES</span></div><div><strong>00:00</strong><span>DESDE EL INICIO</span></div><div><strong>HORA REAL</strong><span>SEGÚN SALIDA</span></div><div><strong>1× · 2× · 4× · 10×</strong><span>VELOCIDAD</span></div></div><div class="r4-analysis-jumps"><button type="button" data-r4-analysis-tab="tracks">REPRODUCTOR</button><button type="button" data-r4-analysis-tab="summary">RESUMEN Y ANÁLISIS</button></div>`;
      stack.parentNode.insertBefore(hub,stack);
      hub.addEventListener("click",event=>{const tab=event.target.closest("[data-r4-analysis-tab]")?.dataset.r4AnalysisTab;if(!tab)return;try{window.openRaceAnalysisTab?.(tab)}catch(_){};const target=tab==="tracks"?$("#analysisPanelTracks",step):$("#analysisPanelSummary",step);target?.scrollIntoView?.({behavior:"smooth",block:"start"})});
    }
    try{window.renderRaceAnalysis?.();window.openRaceAnalysisTab?.("tracks")}catch(_){}
    setTimeout(()=>{try{window.dispatchEvent(new Event("resize"))}catch(_){}},100);
    return true;
  }
  function openAnalysisModule(fromManager=false){
    if(fromManager)state.managerModuleTitle="REPRODUCTOR Y ANÁLISIS";
    const opened=openStep(7,"REPRODUCTOR Y ANÁLISIS");
    if(opened!==false){setTimeout(decorateAnalysisModule,120);setTimeout(decorateAnalysisModule,320)}
  }
  function openHistory(){const btn=$("#m2OrganizerHistoryOpen");if(btn){btn.click();return}openInjected(["m2EventHistoricalResults"],"HISTÓRICO Y RESULTADOS",1)}
  function openProfile(){
    closeMore();
    const btn=$("#m2AuthAccountBtn");
    if(btn){btn.click();return}
    safeCall("toast","El perfil todavía se está cargando. Inténtalo de nuevo en un instante.");
  }
  function onTopAction(event){const a=event.target.closest("[data-r1-action]")?.dataset.r1Action;if(!a)return;closeMore();if(a==="home"){showMapHome();return}if(a==="profile"){openProfile();return}if(a==="races"){closeWorkspace(true);openRaces();return}if(a==="manager"){openRaceManager();return}if(a==="participants"){openParticipantsModule(false);return}if(a==="live"){openLiveModule(false);return}if(a==="more"){openMore();return}}
  function openSuperAdmin(){
    closeMore();
    if(state.role!=="super_admin"){safeCall("toast","Esta zona requiere SÚPER ADMINISTRADOR.");return false}
    if(window.MILITOPO_R8_SUPER_ADMIN?.open){window.MILITOPO_R8_SUPER_ADMIN.open();return true}
    globalThis.dispatchEvent(new CustomEvent("militopo:r8-open-admin"));
    return true;
  }
  function runMoreAction(a){if(a==="admin")return openSuperAdmin();if(a==="manager")return openRaceManager();if(a==="config")return openStep(1,"CONFIGURACIÓN DE CARRERA");if(a==="participants")return openParticipantsModule(false);if(a==="routes")return openRoutesModule();if(a==="maptools")return openStep(2,"AJUSTES Y DATOS DEL MAPA");if(a==="material"){if(!materialQrUnlocked())return showMaterialLockedNotice();return openStep(4,"MATERIAL QR Y EXPORTACIÓN")}if(a==="sequence")return openStep(5,"SECUENCIA DE SALIDA Y LLEGADA");if(a==="results")return openResultsModule(false);if(a==="analysis")return openAnalysisModule(false);if(a==="history"){closeMore();return openHistory()}if(a==="help"){closeMore();if(typeof window.showOrientationGuide==="function")window.showOrientationGuide();return}}
  const R3_STATUS={draft:"BORRADOR",prepared:"PREPARADO",published:"PUBLICADO",live:"EN DIRECTO",finished:"FINALIZADO",archived:"ARCHIVADO"};
  const R3_ORDER=["draft","prepared","published","live","finished","archived"];
  function currentLifecycleStatus(){return String(window.MILITOPO_V2_EVENT_STATUS?.status||state.eventStatus?.status||state.managerEvent?.status||"draft")}
  function refreshLiveNavState(){
    const active=currentLifecycleStatus()==="live";
    const button=$("[data-r1-action='live']");
    if(button){button.classList.toggle("is-live-active",active);button.setAttribute("aria-label",active?"LIVE · carrera en directo":"LIVE");button.title=active?"Carrera EN DIRECTO · abrir LIVE":"LIVE";}
    const card=$("[data-r3-manager-action='live']");if(card)card.classList.toggle("is-live-active",active);
    const operationTab=$("[data-r3-manager-tab='operation']");if(operationTab){operationTab.classList.toggle("is-live-mode",active);operationTab.setAttribute("aria-label",active?"OPERACIÓN Y POST CARRERA · carrera en directo":"OPERACIÓN Y POST CARRERA");}
  }
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
  function managerParticipantSnapshot(){
    const snap=participantsSnapshot();
    const capacity=Math.max(0,Number($("#participantCount")?.value)||Number(state.managerEvent?.participantCount)||0);
    const members=(snap?.members||[]).filter(row=>String(row.status||"active")==="active");
    const invitations=snap?.invitations||[];
    const pending=invitations.filter(row=>String(row.status||"pending")==="pending").length;
    const declined=invitations.filter(row=>String(row.status||"pending")==="declined").length;
    const accepted=members.length;
    const free=Math.max(0,capacity-accepted);
    const projected=accepted+pending;
    return {capacity,accepted,pending,declined,free,projected};
  }
  function participantControlHtml(){
    const data=managerParticipantSnapshot();
    const cap=data.capacity||0;
    const occupancy=cap?Math.min(100,Math.round((data.accepted/cap)*100)):0;
    const over=Math.max(0,data.projected-cap);
    let tone="is-open",title="PARTICIPANTES E INVITACIONES",detail="";
    if(!cap){tone="is-warn";detail="Define primero el número de plazas de la carrera."}
    else if(over>0){tone="is-alert";detail=`Hay ${over} invitación${over===1?"":"es"} pendiente${over===1?"":"s"} por encima de las plazas libres.`}
    else if(data.pending>0){tone="is-warn";detail=`${data.accepted} asignada${data.accepted===1?"":"s"} · ${data.pending} pendiente${data.pending===1?"":"s"} de responder antes del inicio.`}
    else if(data.accepted>=cap){tone="is-ready";detail="Todas las plazas están asignadas y no hay respuestas pendientes."}
    else{detail=`${data.free} plaza${data.free===1?"":"s"} libre${data.free===1?"":"s"} y ninguna invitación pendiente.`}
    return `<section class="r5-prestart-participants ${tone}" id="r5PrestartParticipants" aria-label="Control previo de participantes">
      <div class="r5-prestart-head"><div><span>CONTROL PREVIO</span><strong>${title}</strong><small data-r5-participant-detail>${detail}</small></div><b data-r5-participant-occupancy>${cap?`${data.accepted}/${cap}`:"—"}</b></div>
      <div class="r5-prestart-progress" aria-hidden="true"><i data-r5-participant-progress style="width:${occupancy}%"></i></div>
      <div class="r5-prestart-metrics">
        <div><strong data-r5-participant-capacity>${cap||"—"}</strong><span>PLAZAS</span></div>
        <div><strong data-r5-participant-accepted>${data.accepted}</strong><span>ASIGNADAS</span></div>
        <div class="${data.pending?"is-pending":""}"><strong data-r5-participant-pending>${data.pending}</strong><span>PENDIENTES</span></div>
        <div><strong data-r5-participant-free>${cap?data.free:"—"}</strong><span>LIBRES</span></div>
      </div>
      <div class="r5-prestart-foot"><span data-r5-participant-declined>${data.declined?`${data.declined} rechazada${data.declined===1?"":"s"} por corredores`:"Sin invitaciones rechazadas"}</span><button type="button" data-r3-manager-action="participants">ABRIR PARTICIPANTES E INVITACIONES</button></div>
    </section>`;
  }
  function refreshManagerParticipantControl(){
    const card=$("#r5PrestartParticipants");
    if(!card)return;
    const fresh=document.createElement("div");
    fresh.innerHTML=participantControlHtml();
    const next=fresh.firstElementChild;
    if(next)card.replaceWith(next);
    const replacement=$("#r5PrestartParticipants");
    replacement?.querySelectorAll("[data-r3-manager-action]").forEach(button=>button.addEventListener("click",()=>runManagerAction(button.dataset.r3ManagerAction)));
  }
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
        <div><strong>${ctx.participantCount||"—"}</strong><span>PLAZAS</span></div>
        <div><strong>${ctx.controlCount||"—"}</strong><span>BALIZAS</span></div>
        <div><strong>${ctx.courseSyncedCount||"—"}</strong><span>RECORRIDOS</span></div>
        <div><strong>${ctx.controlsPerRoute||"—"}</strong><span>BALIZAS POR RECORRIDO</span></div>
      </div>
      <div class="r3-manager-mode-label">ÁREA DE GESTIÓN</div>
      <div class="r3-manager-tabs" role="tablist" aria-label="Áreas principales de gestión">
        <button type="button" role="tab" aria-selected="${state.managerTab!=="operation"}" class="${state.managerTab!=="operation"?"is-active":""}" data-r3-manager-tab="design"><span class="r3-manager-tab-icon">${icon("route")}</span><strong>DISEÑO Y PREPARACIÓN</strong></button>
        <button type="button" role="tab" aria-selected="${state.managerTab==="operation"}" class="${state.managerTab==="operation"?"is-active ":""}${ctx.status==="live"?"is-live-mode":""}" data-r3-manager-tab="operation"><span class="r3-manager-tab-icon">${icon("live")}</span><strong>OPERACIÓN Y POST CARRERA</strong><i class="r3-manager-live-dot" aria-hidden="true"></i></button>
      </div>
      <div class="r3-manager-tabpanel ${state.managerTab==="operation"?"":"is-active"}" data-r3-manager-panel="design" role="tabpanel">
        ${readinessHtml()}
        ${participantControlHtml()}
        <div class="r3-manager-option-label"><span>DISEÑO Y PREPARACIÓN</span><small>Configura la carrera antes de pasar a competición</small></div>
        <div class="r3-manager-grid r3-manager-grid-compact">
          ${managerCard((designReadinessSnapshot()?.items.find(i=>i.key==="map")?.ok)?"map":"complete-map","MAPA Y BALIZAS","Salida, llegada y controles","layers","is-primary")}
          ${managerCard("config","CONFIGURACIÓN","Datos y reglas","settings")}
          ${managerCard("routes","RECORRIDOS","Revisar y completar","route")}
          ${managerCard("lifecycle","ESTADO Y PUBLICACIÓN","Preparar y publicar","flag","is-state")}
          ${managerCard("material","MATERIAL QR",materialQrUnlocked()?"Planos, QR y exportación":"🔒 Desde PREPARADO","qr",materialQrUnlocked()?"":"is-locked")}
          ${managerCard("sequence","SECUENCIA","Salidas y llegadas","flag")}
        </div>
      </div>
      <div class="r3-manager-tabpanel ${state.managerTab==="operation"?"is-active":""}" data-r3-manager-panel="operation" role="tabpanel">
        <div class="r3-manager-option-label"><span>OPCIONES</span><small>Herramientas de competición y post-carrera</small></div>
        <div class="r3-manager-grid r3-manager-grid-compact">
          ${managerCard("live","LIVE","Seguimiento en tiempo real","live","is-live")}
          ${managerCard("results","RESULTADOS","Clasificación oficial","chart")}
          ${managerCard("analysis","ANÁLISIS","Reproductor y análisis","chart")}
        </div>
      </div>
      <div class="r3-manager-footer"><button type="button" class="is-map" data-r3-manager-action="map">VOLVER AL MAPA</button></div>
    </section>`;
    body.querySelectorAll("[data-r3-manager-action]").forEach(button=>button.addEventListener("click",()=>runManagerAction(button.dataset.r3ManagerAction)));
    refreshLiveNavState();
    body.querySelectorAll("[data-r3-manager-tab]").forEach(button=>button.addEventListener("click",()=>{
      state.managerTab=button.dataset.r3ManagerTab==="operation"?"operation":"design";
      body.querySelectorAll("[data-r3-manager-tab]").forEach(tab=>{const active=tab.dataset.r3ManagerTab===state.managerTab;tab.classList.toggle("is-active",active);tab.setAttribute("aria-selected",String(active))});
      body.querySelectorAll("[data-r3-manager-panel]").forEach(panel=>panel.classList.toggle("is-active",panel.dataset.r3ManagerPanel===state.managerTab));
    }));
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
    const body=$("#r1WorkspaceBody");if(body){body.classList.add("r3-manager-view");body.scrollLeft=0;body.scrollTop=0}
    renderRaceManager();
    try{
      const refresh=window.MILITOPO_V2_PARTICIPANTS_ADMIN?.refresh?.();
      if(refresh&&typeof refresh.finally==="function")refresh.finally(()=>setTimeout(refreshManagerParticipantControl,40));
    }catch(_){}
    setTimeout(()=>{refreshManagerParticipantControl();if(body){body.scrollLeft=0;body.scrollTop=0}window.dispatchEvent(new Event("resize"))},180);
  }
  function openManagerStep(step,title){state.managerModuleTitle=title;return openStep(step,title)}
  function openManagerInjected(ids,title,step=1){state.managerModuleTitle=title;return openInjected(ids,title,step)}
  function runManagerAction(action){
    state.managerOpen=false;
    if(action==="races"){closeWorkspace(true);setTimeout(openRaces,60);return}
    if(action==="complete-map")return openMapForMissing();
    if(action==="complete-routes")return openMissingRoutes();
    if(action==="map"){closeWorkspace(true);return}
    if(action==="config")return openManagerStep(1,"CONFIGURACIÓN DE CARRERA");
    if(action==="routes"){state.managerModuleTitle="RECORRIDOS";return openRoutesModule()}
    if(action==="participants")return openParticipantsModule(true);
    if(action==="lifecycle")return openManagerInjected(["m2EventLifecycle"],"ESTADO Y PUBLICACIÓN",1);
    if(action==="live")return openLiveModule(true);
    if(action==="material"){if(!materialQrUnlocked())return showMaterialLockedNotice();return openManagerStep(4,"MATERIAL QR Y EXPORTACIÓN")}
    if(action==="sequence")return openManagerStep(5,"SECUENCIA DE SALIDA Y LLEGADA");
    if(action==="results")return openResultsModule(true);
    if(action==="analysis")return openAnalysisModule(true);
  }
  function refreshContext(){
    const active=$$(".card.active")[0];const m=active?.id?.match(/^step(\d+)$/);state.currentStep=m?Number(m[1]):state.currentStep;
    const workspaceOpen=!!state.workspace?.classList.contains("is-open");state.mapHome=!workspaceOpen;
    document.body.classList.toggle("r1-map-context",!workspaceOpen);document.body.classList.toggle("r1-map-home",!workspaceOpen);
    $$(".r1-nav-btn").forEach(b=>b.classList.remove("is-active"));
    const name=$("#r1EventName"),meta=$("#r1EventMeta");if(name)name.textContent=currentEventName();if(meta)meta.textContent=currentEventId()||"Sin carrera cargada";
    refreshLiveNavState();
  }
  function setProfileOnline(online=true){
    const button=$("[data-r1-action='profile']");if(!button)return;
    const active=Boolean(online);button.classList.toggle("is-session-online",active);
    const badge=$(".r1-profile-online",button);if(badge)badge.hidden=!active;
    button.title=active?"Mi perfil · sesión iniciada":"Mi perfil";
  }
  function setRole(role){
    state.role=String(role||"organizer");
    const pill=$("#r1RolePill");if(pill){pill.dataset.role=state.role;$("span",pill).textContent=roleLabel(state.role)}
    const adminAction=$("[data-more-action='admin']");if(adminAction)adminAction.hidden=state.role!=="super_admin";
    if(state.role!=="super_admin")window.MILITOPO_R8_SUPER_ADMIN?.close?.();
    decorateNavigationTargets(document);
  }
  function bindEvents(){
    window.addEventListener("militopo:v2-auth-ready",e=>{setRole(e.detail?.role);setProfileOnline(Boolean(e.detail?.uid))});
    window.addEventListener("militopo:v2-orientation-header",e=>{const h=e.detail?.header||{};const name=$("#r1EventName"),meta=$("#r1EventMeta");if(name&&h.eventName)name.textContent=h.eventName;if(meta&&h.eventId)meta.textContent=h.eventId});
    window.addEventListener("militopo:v2-cloud-event-applied",()=>setTimeout(refreshContext,100));
    window.addEventListener("militopo:r4-open-results-after-load",()=>setTimeout(()=>openResultsModule(false),120));
    window.addEventListener("militopo:r3-race-manager-open",event=>{const race=event?.detail?.event||{};setTimeout(()=>openRaceManager(race),80)});
    window.addEventListener("militopo:v2-event-status",event=>{state.eventStatus=event?.detail||null;refreshMaterialAccess();refreshLiveHub();refreshLiveNavState();if(state.managerOpen&&state.workspace?.classList.contains("is-open"))renderRaceManager()});
    window.addEventListener("militopo:v2-event-status-changed",event=>{const to=event?.detail?.to;if(to&&state.managerEvent)state.managerEvent={...state.managerEvent,status:to};refreshMaterialAccess();refreshParticipantsHub();refreshLiveHub();refreshLiveNavState();if(state.managerOpen&&state.workspace?.classList.contains("is-open"))setTimeout(renderRaceManager,120)});
    window.addEventListener("militopo:r1-open-live",()=>{closeMore();openLiveModule(false);});
    window.addEventListener("militopo:v2-roster-changed",()=>setTimeout(()=>{refreshParticipantsHub();refreshAssignmentsHub();refreshManagerParticipantControl()},60));
    window.addEventListener("militopo:v2-roster-snapshot",()=>setTimeout(()=>{refreshParticipantsHub();refreshAssignmentsHub();refreshManagerParticipantControl()},60));
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
  globalThis.addEventListener("militopo:r5-reuse-complete",()=>setTimeout(()=>openStep(1,"CONFIGURACIÓN DE CARRERA"),90));
function init(){
    document.body.classList.add("r1-shell-active");
    try{setRole(localStorage.getItem("militopo_v2_last_role")||"organizer")}catch(_){}
    buildTopbar();buildMapDock();buildMore();buildWorkspace();bindEvents();startNavigationDecorator();setProfileOnline(Boolean(window.MILITOPO_V2_AUTH?.uid));refreshContext();
    setTimeout(()=>{safeCall("goStep",2,{noScroll:true,silent:true});state.currentStep=2;state.mapHome=true;window.MILITOPO_R2_MAP_HOME?.activate?.();refreshContext()},260);
    setTimeout(refreshContext,700);setTimeout(refreshContext,1600);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();
