/* pdf-tablas-fix-v2-20260527 */
/* tabsfix-v2-20260526-001 */
/* MILITOPO_V39_ESTADO_PASO5_ICONOS_LIMPIOS */
const state={eventId:"",eventName:"ENTRENAMIENTO ORIENTACIÓN",
    planScale:10000,
    pdfPlanCenterManual:null,
    selectedMapLayer:"mapant",
    customGeoTiffMeta:null,
    customGeoTiffOpacity:1,
    planEquidistanceM:5,participantCount:10,maxUniqueRoutes:15,controlCount:25,controlsPerRoute:8,maxControlReuse:6,points:{},routes:[],metrics:[],elevations:{},participantLogs:{},participantNames:{},skippedRoutes:{},importedResults:[]};let map=null,layers={},currentLayer=null,markersLayer=null,routeLayer=null,pdfPlanPreviewLayer=null,pdfPlanPreviewRectangle=null,pdfPlanPreviewLabelMarker=null,pdfPlanCenterMarker=null,pdfPlanAdjustMode=false,pdfPlanDragFrame=null,userLocationMarker=null,userAccuracyCircle=null,selectedPointId="START";let currentAppStep=1;let __autoSaveTimer=null;let __durableSaveTimer=null;let selectedIofPointId="START";

function createFreshEventId(){
    return "ORI_"+new Date().toISOString().slice(0,10).replaceAll("-","")+"_"+Math.random().toString(36).slice(2,7).toUpperCase();
}

function resetStateToFreshEvent(){
    const freshId=createFreshEventId();
    state.eventId=freshId;
    state.eventName="ENTRENAMIENTO ORIENTACIÓN";
    state.planScale=10000;
    state.pdfPlanCenterManual=null;
    state.selectedMapLayer="mapant";
    state.customGeoTiffMeta=null;
    state.customGeoTiffOpacity=1;
    state.planEquidistanceM=5;
    state.participantCount=10;
    state.maxUniqueRoutes=15;
    state.controlCount=25;
    state.controlsPerRoute=8;
    state.maxControlReuse=6;
    state.points={};
    state.routes=[];
    state.metrics=[];
    state.elevations={};
    state.participantLogs={};
    state.participantNames={};
    state.skippedRoutes={};
    state.importedResults=[];
    state.raceDataProtection={protected:false,runId:"",startedAt:"",lastDataAt:"",status:""};
    state.iofDescriptions={};
    state.routeWarnings=[];
    selectedPointId="START";
    selectedIofPointId="START";
    currentAppStep=1;
    if(typeof hideZipProgress==="function")hideZipProgress();
    if(typeof stopStep5ResultQrCamera==="function")stopStep5ResultQrCamera();
    if(typeof stopStep5FinishQrCamera==="function")stopStep5FinishQrCamera();
    return freshId;
}

let __militopoOrientationInitialized=false;
let __militopoOrganizerStateEpoch=0;
function init(){
    if(__militopoOrientationInitialized)return;
    __militopoOrientationInitialized=true;
    try{
        setupReusableExerciseImporter();
        fillSelect("participantCount",1,100,10,n=>`${n} participantes`);
        fillSelect("maxUniqueRoutes",1,30,15,n=>`${n} recorridos únicos máx.`);
        fillSelect("controlCount",3,80,25,n=>`${n} balizas`);
        fillSelect("controlsPerRoute",2,30,8,n=>`${n} balizas`);
        fillSelect("maxControlReuse",1,100,6,n=>`${n} usos máx.`);

        state.eventId=createFreshEventId();
        const eventIdInput=document.getElementById("eventId");
        if(eventIdInput)eventIdInput.value=state.eventId;
        loadCustomIofSymbols();

        const restoreInfo=loadState();
        const restored=!!(restoreInfo&&restoreInfo.restored);
        const restoredStep=normalizeAppStep((restoreInfo&&restoreInfo.step)||1);

        syncConfigToUi();
        rebuildPointsFromConfig(true);
        currentAppStep=restoredStep;

        renderPointSelectors();
        renderPointsTable();
        renderIofDescriptionsEditor();
        updateParticipantSelect();
        updateRouteCountInfo();
        bindStepTabs();
        bindStrongAutosave();
        cleanupStep2ImportAndTableUi();
        goStep(restoredStep,{silent:true,noScroll:true});

        // La copia IndexedDB es una red de seguridad, nunca debe bloquear el arranque.
        const bootStateEpoch=__militopoOrganizerStateEpoch;
        setTimeout(()=>recoverDurableOrganizerStateAfterBoot(restoreInfo,bootStateEpoch).catch(error=>console.warn("Recuperación duradera posterior al arranque",error)),600);
        setTimeout(()=>{
            initMapWhenReady();
            restoreOrientationGeoTiffFromDb().finally(()=>goStep(currentAppStep,{silent:true,noScroll:true}));
            const msg=restored
                ? `✅ Evento restaurado · paso ${restoredStep} · origen: ${restoreInfo.reason}`
                : `ℹ️ No había evento guardado completo · paso inicial ${restoredStep} · origen: ${restoreInfo.reason}`;
            setRestoreStatus(msg,restored?"ok":"warn");
            if(restored){toast(`Evento restaurado · paso ${restoredStep}`);setTimeout(()=>toast(`Evento restaurado · paso ${restoredStep}`),700);}
        },120);
    }catch(error){
        __militopoOrientationInitialized=false;
        console.error("MILITOPO Orientación · fallo de inicialización",error);
        try{setRestoreStatus("❌ No se pudo iniciar Orientación: "+(error?.message||error),"err")}catch(_){ }
    }
}
function initMapWhenReady(attempt=0){
    if(map)return true;
    if(typeof window.L!=="undefined"){
        try{initMap();return true}catch(error){console.warn("Mapa todavía no disponible",error)}
    }
    if(attempt<80){setTimeout(()=>initMapWhenReady(attempt+1),250);return false;}
    try{setRestoreStatus("⚠️ La interfaz está operativa, pero el mapa no pudo cargar. Comprueba la conexión y vuelve a intentarlo.","warn")}catch(_){ }
    return false;
}
function fillSelect(id,min,max,selected,labelFn){const sel=document.getElementById(id);sel.innerHTML="";for(let i=min;i<=max;i++){const opt=document.createElement("option");opt.value=i;opt.textContent=labelFn?labelFn(i):i;if(i===selected)opt.selected=true;sel.appendChild(opt)}}
function syncConfigFromUi(){state.eventName=document.getElementById("eventName").value.trim()||"ENTRENAMIENTO ORIENTACIÓN";state.participantCount=parseInt(document.getElementById("participantCount").value,10);const uniqueSel=document.getElementById("maxUniqueRoutes");state.maxUniqueRoutes=Math.max(1,parseInt(uniqueSel?uniqueSel.value:state.maxUniqueRoutes||15,10)||15);state.controlCount=parseInt(document.getElementById("controlCount").value,10);state.controlsPerRoute=parseInt(document.getElementById("controlsPerRoute").value,10);state.maxControlReuse=parseInt(document.getElementById("maxControlReuse").value,10)}function syncConfigToUi(){document.getElementById("eventName").value=state.eventName;document.getElementById("eventId").value=state.eventId;document.getElementById("participantCount").value=state.participantCount;const uniqueSel=document.getElementById("maxUniqueRoutes");if(uniqueSel)uniqueSel.value=Math.min(30,Math.max(1,state.maxUniqueRoutes||15));document.getElementById("controlCount").value=state.controlCount;document.getElementById("controlsPerRoute").value=state.controlsPerRoute;document.getElementById("maxControlReuse").value=state.maxControlReuse}
function rebuildPointsFromConfig(preserve=true){syncConfigFromUi();const next={};next.START=preserve&&state.points.START?state.points.START:makePoint("START","SALIDA");next.FINISH=preserve&&state.points.FINISH?state.points.FINISH:makePoint("FINISH","LLEGADA");for(let i=1;i<=state.controlCount;i++){const id="B"+String(i).padStart(2,"0");next[id]=preserve&&state.points[id]?state.points[id]:makePoint(id,"BALIZA")}state.points=next}function makePoint(id,type){return{id,type,utm:"",desc:type==="BALIZA"?id:type,lat:null,lon:null,elevation:null}}
function bindStepTabs(){document.querySelectorAll(".step-tab").forEach(btn=>btn.addEventListener("click",()=>goStep(Number(btn.dataset.step))))}function goStep(n,opts={}){
    if(typeof hideZipProgress==='function')hideZipProgress();

    const previousAppStep=currentAppStep;
    currentAppStep=normalizeAppStep(n);
    saveCurrentStepNow();

    document.querySelectorAll(".card").forEach(c=>c.classList.remove("active"));
    const target=document.getElementById("step"+currentAppStep);
    if(target){
        target.classList.add("active");
        target.classList.remove("ori-step-fluent-enter");
        requestAnimationFrame(()=>target.classList.add("ori-step-fluent-enter"));
    }

    document.querySelectorAll(".step-tab").forEach(btn=>{
        const step=Number(btn.dataset.step);

        // FIX V2: limpieza fuerte de estados visuales al cambiar/retroceder pasos.
        btn.classList.remove("active","done","future");
        btn.removeAttribute("data-step-state");
        btn.style.removeProperty("background");
        btn.style.removeProperty("background-image");
        btn.style.removeProperty("color");
        btn.style.removeProperty("box-shadow");
        btn.style.removeProperty("opacity");

        if(step===currentAppStep){
            btn.classList.add("active");
            btn.setAttribute("data-step-state","active");
        }else if(step<currentAppStep){
            btn.classList.add("done");
            btn.setAttribute("data-step-state","done");
        }else{
            btn.classList.add("future");
            btn.setAttribute("data-step-state","future");
        }
    });

    if(currentAppStep===2){
        cleanupStep2ImportAndTableUi();
        renderIofDescriptionsEditor();
        validateIofDescriptions();
        setTimeout(()=>{if(map)map.invalidateSize();renderMapMarkers();cleanupStep2ImportAndTableUi()},200);
    }
    if(currentAppStep===3){
        // Los recorridos pueden proceder de una generación nueva, una restauración
        // automática o la importación de un ejercicio anterior. El paso 3 debe
        // reconstruirse siempre desde el estado real y no depender de haber pasado
        // antes por el botón de generación del paso 2.
        updateRouteCountInfo();
        renderRoutes();
    }
    if(currentAppStep===4){runExerciseVerifier(false)}
    if(currentAppStep===5){
        if(previousAppStep!==5)setFinishOrganizedPanelOpen(false);
        updateOrganizerParticipantSelects();
        prepareStartFlow();
    }
    if(currentAppStep===6)renderResultsControl();

    if(!opts.noScroll)window.scrollTo({top:0,behavior:"smooth"});

    if(!opts.silent){
        saveState();
        setRestoreStatus(`💾 Paso ${currentAppStep} guardado. Al recargar debe volver aquí.`,"ok");
    }
}function toast(msg){const el=document.getElementById("toast");el.textContent=msg;el.style.display="block";clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>el.style.display="none",2600)}


function syncPlanScaleFromUiNow(){
    const s=document.getElementById("planScaleSelect");
    const e=document.getElementById("planEquidistanceInput");
    if(s)state.planScale=(Number(s.value)===7500?7500:10000);
    if(e){
        const eq=Number(e.value);
        state.planEquidistanceM=Number.isFinite(eq)&&eq>0?eq:5;
    }
}

function updatePlanScaleSetting(){
    syncPlanScaleFromUiNow();
    renderPlanPdfPreview();
    scheduleSaveState();
}
function syncPlanScaleSettingUi(){
    const s=document.getElementById("planScaleSelect");
    const e=document.getElementById("planEquidistanceInput");
    if(s)s.value=String(state.planScale||10000);
    if(e)e.value=String(state.planEquidistanceM||5);
}

function confirmStep1(){rebuildPointsFromConfig(true);renderPointSelectors();renderPointsTable();updateParticipantSelect();updateRouteCountInfo();saveState();toast("Configuración guardada");goStep(2)}
// AUTOFILL TEST POINTS JS START
function getAutofillOrientationBaseCenter(){
    // Prioridad 1: centro visible actual del mapa. Si el usuario ha buscado una zona,
    // searchPlace() ya habrá movido el mapa ahí, por tanto se usa ese centro.
    if(map && typeof map.getCenter === "function"){
        const c = map.getCenter();
        if(c && Number.isFinite(c.lat) && Number.isFinite(c.lng)){
            return {lat:c.lat, lon:c.lng, label:"ZONA DEL MAPA"};
        }
    }

    // Prioridad 2: si el cuadro de búsqueda contiene una UTM válida, úsala como centro.
    const searchValue = (document.getElementById("searchBox")?.value || "").trim().toUpperCase();
    if(searchValue && typeof utmToLatLon === "function"){
        const ll = utmToLatLon(searchValue);
        if(ll && Number.isFinite(ll.lat) && Number.isFinite(ll.lon)){
            return {lat:ll.lat, lon:ll.lon, label:"ZONA BUSCADA"};
        }
    }

    // Fallback neutro: solo si el mapa aún no está disponible.
    return {lat:40.4168, lon:-3.7038, label:"ZONA ACTUAL"};
}

function autofillOrientationPoints() {
    if(rejectProtectedRaceMutation("recolocar todas las balizas"))return;
    syncConfigFromUi();
    rebuildPointsFromConfig(true);

    const base = getAutofillOrientationBaseCenter();
    const baseLat = base.lat;
    const baseLon = base.lon;
    const zoneLabel = base.label;
    const controls = Object.values(state.points).filter(p => p.type === "BALIZA");

    const start = state.points.START;
    const finish = state.points.FINISH;

    const startLat = baseLat + 0.0017;
    const startLon = baseLon - 0.0036;
    const finishLat = baseLat - 0.0021;
    const finishLon = baseLon + 0.0038;

    Object.assign(start, {
        lat: startLat,
        lon: startLon,
        utm: latLonToUtm(startLat, startLon),
        desc: `SALIDA · ${zoneLabel}`,
        elevation: null
    });

    Object.assign(finish, {
        lat: finishLat,
        lon: finishLon,
        utm: latLonToUtm(finishLat, finishLon),
        desc: `LLEGADA · ${zoneLabel}`,
        elevation: null
    });

    const rings = [
        {rLat: 0.0018, rLon: 0.0028, n: 8},
        {rLat: 0.0034, rLon: 0.0048, n: 10},
        {rLat: 0.0050, rLon: 0.0068, n: 12},
        {rLat: 0.0064, rLon: 0.0088, n: 16}
    ];

    const generated = [];
    let idx = 0;
    for (const ring of rings) {
        for (let j = 0; j < ring.n && generated.length < controls.length; j++) {
            const ang = ((j / ring.n) * Math.PI * 2) + (idx * 0.37);
            const lat = baseLat + Math.sin(ang) * ring.rLat + Math.sin(idx * 1.41) * 0.00035;
            const lon = baseLon + Math.cos(ang) * ring.rLon + Math.cos(idx * 1.19) * 0.00040;
            generated.push({lat, lon});
            idx++;
        }
    }

    while (generated.length < controls.length) {
        const i = generated.length;
        const lat = baseLat + (Math.sin(i * 2.11) * 0.0068);
        const lon = baseLon + (Math.cos(i * 1.77) * 0.0092);
        generated.push({lat, lon});
    }

    controls.forEach((p, i) => {
        const g = generated[i];
        p.lat = g.lat;
        p.lon = g.lon;
        p.utm = latLonToUtm(g.lat, g.lon);
        p.desc = `CONTROL ${p.id} · ${zoneLabel}`;
        p.elevation = null;
    });

    state.routes = [];
    state.metrics = [];
    state.routeWarnings = [];
    selectedPointId = "START";

    renderPointSelectors();
    renderPointsTable();
    renderMapMarkers();
    updateParticipantSelect();
    updateRouteCountInfo();

    setTimeout(()=>{
        if(map){
            map.invalidateSize();
            fitAllPoints();
        }
    },180);

    saveState();
    toast(`Puntos rellenados en la zona actual: salida, llegada y ${controls.length} balizas`);
    if(typeof setRestoreStatus==="function")setRestoreStatus(`✅ Puntos rellenados en la zona actual del mapa (${controls.length} balizas)`,"ok");
}

function clearAllOrientationPoints() {
    if(rejectProtectedRaceMutation("borrar las balizas y recorridos"))return;
    Object.values(state.points||{}).forEach(p => {
        p.utm = "";
        p.lat = null;
        p.lon = null;
        p.elevation = null;
        p.desc = p.type === "BALIZA" ? p.id : p.type;
    });

    state.routes = [];
    state.metrics = [];
    state.participantLogs = {};
    state.routeWarnings = [];
    selectedPointId = "START";

    renderPointSelectors();
    renderPointsTable();
    renderMapMarkers();
    if(typeof renderRoutes==="function")renderRoutes();
    updateParticipantSelect();
    updateRouteCountInfo();

    const routeSummary=document.getElementById("routeSummary");
    if(routeSummary){
        routeSummary.className = "status warn";
        routeSummary.textContent = "Todavía no hay recorridos generados.";
    }
    const routesGrid=document.getElementById("routesGrid");
    if(routesGrid)routesGrid.innerHTML = "";
    const qrPreview=document.getElementById("qrPreview");
    if(qrPreview)qrPreview.innerHTML = "";
    const zipStatus=document.getElementById("zipStatus");
    if(zipStatus){
        zipStatus.className = "status warn";
        zipStatus.textContent = "Genera primero los recorridos y después el material.";
    }

    saveState();
    toast("Puntos limpiados correctamente");
    if(typeof setRestoreStatus==="function")setRestoreStatus("🧹 Puntos limpiados correctamente","ok");
}
// AUTOFILL TEST POINTS JS END


// ROUTE GENERATION LOADER JS START
function routeSleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function showRouteGenerationLoader(text="Preparando cálculo...", percent=0){
    const box=document.getElementById("routeGenerationLoader");
    if(!box) return;
    box.style.display="grid";
    updateRouteGenerationLoader(text, percent);
}
function updateRouteGenerationLoader(text, percent){
    const label=document.getElementById("routeGenerationText");
    const fill=document.getElementById("routeGenerationFill");
    const pct=document.getElementById("routeGenerationPercent");
    const safePercent=Math.max(0,Math.min(100,Math.round(percent||0)));
    if(label) label.textContent=text||"Generando recorridos...";
    if(fill) fill.style.width=safePercent+"%";
    if(pct) pct.textContent=safePercent+"%";
}
function hideRouteGenerationLoader(){
    const box=document.getElementById("routeGenerationLoader");
    if(box) box.style.display="none";
}
// ROUTE GENERATION LOADER JS END

async function confirmStep2(){
    const v=validatePoints();
    if(!v.ok){
        toast("Faltan puntos obligatorios");
        return;
    }
    saveState();
    showRouteGenerationLoader("Preparando desniveles y recorridos...", 4);
    await routeSleep(80);
    let ok=false;
    try{
        ok=await generateRoutes(true);
    }catch(e){
        console.error(e);
        const summary=document.getElementById("routeSummary");
        if(summary){
            summary.className="status err";
            summary.textContent="Error generando recorridos. Se ha detenido el cálculo para evitar que la pantalla quede bloqueada.";
        }
        toast("Error generando recorridos. Revisa puntos y vuelve a intentar.");
        ok=false;
    }
    updateRouteGenerationLoader(ok?"Recorridos generados. Abriendo paso 3...":"No se pudieron generar los recorridos.", ok?100:0);
    await routeSleep(ok?450:900);
    hideRouteGenerationLoader();
    if(ok) goStep(3);
}async function confirmStep3(){
    if(!state.routes.length){
        showRouteGenerationLoader("Generando recorridos antes del material...", 8);
        await routeSleep(80);
        const ok=await generateRoutes(true);
        hideRouteGenerationLoader();
        if(!ok) return;
    }
    renderQrPreview();
    saveState();
    goStep(4);
}
function validatePoints(){const requiredOk=["START","FINISH"].every(id=>state.points[id]?.lat!==null&&state.points[id]?.lon!==null);const controls=Object.values(state.points).filter(p=>p.type==="BALIZA"&&p.lat!==null&&p.lon!==null);return{ok:requiredOk&&controls.length>=state.controlsPerRoute,controlsCount:controls.length}}
function renderPointSelectors(){const sel=document.getElementById("selectedPoint");sel.innerHTML="";Object.values(state.points).forEach(p=>{const opt=document.createElement("option");opt.value=p.id;opt.textContent=`${symbolForType(p.type)} ${p.id} · ${p.desc||p.type}`;sel.appendChild(opt)});sel.value=selectedPointId;sel.onchange=()=>{selectedPointId=sel.value;loadSelectedPointFields();zoomSelectedPoint()};loadSelectedPointFields()}function symbolForType(type){return type==="SALIDA"?"△":type==="LLEGADA"?"◎":"○"}function loadSelectedPointFields(){const p=state.points[selectedPointId];if(!p)return;document.getElementById("selectedUtm").value=p.utm||""}
function saveSelectedPoint(){
    const p=state.points[selectedPointId];
    if(!p)return;
    const utm=normalizeUtmText(document.getElementById("selectedUtm").value);
    const parsed=parseUtmStrict(utm);
    if(!parsed){toast("UTM no válida. Usa formato exacto: 30T 463941 4106198");return}
    const ll=utmToLatLon(parsed.normalized);
    if(!ll){toast("UTM no válida");return}
    p.utm=parsed.normalized;
    p.lat=ll.lat;
    p.lon=ll.lon;
    p.desc=p.desc||p.id;
    renderPointsTable();
    renderMapMarkers();
    renderIofDescriptionsEditor();
    saveState();
    toast(`${p.id} guardado`);
}
function clearSelectedPoint(){const p=state.points[selectedPointId];if(!p)return;p.utm="";p.lat=null;p.lon=null;p.elevation=null;renderPointsTable();renderMapMarkers();saveState();toast(`${p.id} limpiado`)}
function normalizeUtmText(value){
    return String(value||"").trim().replace(/\s+/g," ").toUpperCase();
}

function parseUtmStrict(value){
    const raw=normalizeUtmText(value);
    const m=raw.match(/^([1-9]|[1-5][0-9]|60)([C-HJ-NP-X])\s+(\d{6})\s+(\d{7})$/);
    if(!m)return null;
    const zone=Number(m[1]), band=m[2], easting=Number(m[3]), northing=Number(m[4]);
    if(easting<100000||easting>900000)return null;
    if(northing<0||northing>10000000)return null;
    if(band==="X"&&(zone===32||zone===34||zone===36))return null;
    return {raw,zone,band,easting,northing,normalized:`${zone}${band} ${String(easting).padStart(6,"0")} ${String(northing).padStart(7,"0")}`};
}

function isValidUtm(value){
    const parsed=parseUtmStrict(value);
    if(!parsed)return false;
    if(typeof proj4!=="function")return true;
    return !!utmToLatLon(parsed.normalized);
}

function pointBaseStatus(id){
    const p=(state.points||{})[id]||{};
    const utmOk=isValidUtm(p.utm);
    const latLonOk=Number.isFinite(p.lat)&&Number.isFinite(p.lon);
    const missing=[];
    if(!utmOk)missing.push("UTM");
    if(!latLonOk)missing.push("coordenadas");
    return {ok:utmOk&&latLonOk,utmOk,descOk:true,latLonOk,missing};
}

function pointStatusBadgeHtml(id){
    const st=pointBaseStatus(id);
    return `<span class="point-status-badge ${st.ok?"ok":"warn"}">${st.ok?"✅ Completa":"⚠️ Pendiente"}${st.ok?"":": "+escapeHtml(st.missing.join(", "))}</span>`;
}


function cleanupStep2ImportAndTableUi(){
    if(!document.getElementById("militopo-points-table-no-x-scroll")){
        const st=document.createElement("style");
        st.id="militopo-points-table-no-x-scroll";
        st.textContent=`
            .points-base-table,
            .points-base-table *{box-sizing:border-box!important;}
            .points-base-table{width:100%!important;max-width:100%!important;min-width:0!important;table-layout:fixed!important;border-collapse:separate!important;}
            .points-base-table th,.points-base-table td{min-width:0!important;max-width:none!important;overflow:hidden!important;}
            .points-base-table input[data-field="utm"]{width:100%!important;max-width:280px!important;min-width:0!important;box-sizing:border-box!important;display:block!important;margin-left:0!important;margin-right:auto!important;text-align:left!important;}
            .table-wrap:has(.points-base-table){width:100%!important;max-width:100%!important;min-width:0!important;overflow-x:hidden!important;overflow-y:auto!important;overscroll-behavior-x:none!important;-webkit-overflow-scrolling:touch!important;touch-action:pan-y!important;}
        `;
        document.head.appendChild(st);
    }
    const gpxFile=document.getElementById("gpxFile");
    if(gpxFile){
        gpxFile.style.display="none";
        gpxFile.setAttribute("aria-hidden","true");
        gpxFile.tabIndex=-1;
    }

    const atakGpxFile=document.getElementById("atakGpxFile");
    if(atakGpxFile){
        atakGpxFile.style.display="none";
        atakGpxFile.setAttribute("aria-hidden","true");
        atakGpxFile.tabIndex=-1;
    }

    // MILITOPO · Paso 2 limpieza visual solicitada: solo cambia textos/botones, no funciones.
    try{
        const norm=s=>String(s||"").replace(/\s+/g," ").trim();
        const stripImportPrefix=s=>String(s||"").replace(/^\s*CSV\s*o\s*texto\s*:\s*/i,"");

        const ATAK_BUTTON_ICON = `<span style="display:inline-flex;align-items:center;justify-content:center;width:3.35em;height:3.35em;vertical-align:-0.56em;margin-left:-0.75em;margin-right:0.85em;flex:0 0 auto;background:transparent;"><img src="data:image/png;base64,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" alt="TAK" style="display:block;width:100%;height:100%;object-fit:contain;background:transparent;mix-blend-mode:normal;image-rendering:auto;" /></span>`;
        const ATAK_BUTTON_LABEL = `IMPORTAR POR ATAK GPX`;

        document.querySelectorAll("textarea,input").forEach(el=>{
            if(typeof el.placeholder==="string" && /^\s*CSV\s*o\s*texto\s*:/i.test(el.placeholder)){
                el.placeholder=stripImportPrefix(el.placeholder);
            }
            if((el.tagName||"").toLowerCase()==="textarea" && typeof el.value==="string" && /^\s*CSV\s*o\s*texto\s*:/i.test(el.value)){
                el.value=stripImportPrefix(el.value);
            }
            if(el.dataset && typeof el.dataset.placeholder==="string" && /^\s*CSV\s*o\s*texto\s*:/i.test(el.dataset.placeholder)){
                el.dataset.placeholder=stripImportPrefix(el.dataset.placeholder);
            }
        });

        document.querySelectorAll("button,label,.btn,[role='button']").forEach(btn=>{
            const t=norm(btn.textContent);
            if(t.includes("IMPORTAR") && t.includes("GPX") && t.includes("ATAK")){
                btn.innerHTML=ATAK_BUTTON_LABEL;
                btn.setAttribute("aria-label","Importar por ATAK GPX");
                return;
            }
        });

        document.querySelectorAll("h1,h2,h3,h4,h5,h6,.card-title,.section-title,legend,summary,strong,b,div,span").forEach(el=>{
            if(el.dataset&&el.dataset.militopoImportPointsTitle)return;
            const t=norm(el.textContent);
            if(t==="IMPORTAR COORDENADAS"){
                const hasInteractive=el.querySelector&&el.querySelector("input,select,textarea,button,table,#map");
                if(!hasInteractive){
                    el.textContent="📍 IMPORTAR PUNTOS";
                    if(el.dataset)el.dataset.militopoImportPointsTitle="1";
                }
            }
        });

        document.querySelectorAll("button").forEach(btn=>{
            const t=norm(btn.textContent);
            if(t.includes("IMPORTAR") && t.includes("GPX") && t.includes("ATAK")){
                btn.innerHTML=ATAK_BUTTON_LABEL;
                btn.setAttribute("aria-label","Importar por ATAK GPX");
                return;
            }
            if(t.includes("VER TODO")){
                btn.innerHTML="👁️ CENTRAR PLANO EN TODOS LOS PUNTOS";
                btn.setAttribute("aria-label","Centrar plano en todos los puntos");
                return;
            }
            if(t.includes("IMPORTAR TEXTO") && (t.includes("EXCEL") || t.includes("CSV"))){
                btn.innerHTML="📥 IMPORTAR TEXTO";
                btn.setAttribute("aria-label","Importar texto");
                return;
            }
            if(t.includes("EXPORTAR CSV")){
                btn.style.display="none";
                btn.setAttribute("aria-hidden","true");
                btn.tabIndex=-1;
            }
        });

        document.querySelectorAll("small,p,div,span,label").forEach(el=>{
            if(el.dataset&&el.dataset.militopoExamplePrefixCleaned)return;
            const raw=String(el.textContent||"");
            if(/^\s*CSV\s*o\s*texto\s*:/i.test(raw)){
                const hasInteractive=el.querySelector&&el.querySelector("input,select,textarea,button,table,#map");
                if(!hasInteractive){
                    el.textContent=stripImportPrefix(raw);
                    el.dataset.militopoExamplePrefixCleaned="1";
                }
            }
        });

        const target="Salida · Llegada · Balizas con etiqueta";
        document.querySelectorAll("small,p,div,span").forEach(el=>{
            if(el.dataset&&el.dataset.militopoStep2Cleaned)return;
            const t=norm(el.textContent);
            if(t===target || t.includes(target)){
                const hasInputs=el.querySelector&&el.querySelector("input,select,textarea,button,table,#map");
                if(!hasInputs){
                    el.dataset.militopoStep2Cleaned="1";
                    el.style.display="none";
                    el.setAttribute("aria-hidden","true");
                }
            }
        });


        // MILITOPO · Paso 2 reordenado sin tocar index.html:
        // 1) ATAK como bloque principal, 2) buscar zona, 3) capas, 4) mapa, 5) resto igual.
        const step2=document.getElementById("step2");
        if(step2 && !step2.dataset.militopoStep2AtakReordered){
            const header=step2.querySelector(".card-header");
            const mapEl=document.getElementById("map");
            const layerPills=step2.querySelector(".layer-pills");
            const searchBox=document.getElementById("searchBox");
            const searchBlock=searchBox?searchBox.closest(".block"):null;
            const importText=document.getElementById("importText");
            const importBlock=importText?importText.closest(".block"):null;
            const atakInput=document.getElementById("atakGpxFile");
            if(header && mapEl && layerPills && searchBlock && importBlock && atakInput){
                let atakBlock=step2.querySelector(".militopo-atak-main-block");
                if(!atakBlock){
                    atakBlock=document.createElement("div");
                    atakBlock.className="block militopo-atak-main-block";
                    atakBlock.style.marginTop="0";
                    atakBlock.style.padding="18px";
                    atakBlock.innerHTML=`
                        <div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px">
                            <span style="display:inline-flex;align-items:center;justify-content:center;width:104px;height:104px;border-radius:24px;background:radial-gradient(circle at 50% 35%,rgba(255,255,255,.10),rgba(255,255,255,0) 58%), linear-gradient(180deg,rgba(24,36,14,.18),rgba(18,25,12,.08));border:1.2px solid rgba(237,214,145,.20);box-shadow:inset 0 1px 0 rgba(255,255,255,.08)">${ATAK_BUTTON_ICON.replace('width:3.35em;height:3.35em;vertical-align:-0.56em;margin-left:-0.75em;margin-right:0.85em;','width:88px;height:88px;vertical-align:0;margin-left:0;margin-right:0;')}</span>
                            <label style="margin:0;font-size:1.2rem;line-height:1.12;text-align:center">IMPORTAR PUNTOS CON ATAK</label>
                            <button class="btn green militopo-atak-main-btn" style="width:100%;max-width:560px;min-height:56px;padding:14px 22px;font-size:1.02rem;letter-spacing:.03em;box-shadow:0 8px 18px rgba(0,0,0,.12)" onclick="document.getElementById('atakGpxFile').click()">IMPORTAR POR ATAK GPX</button>
                        </div>
                        <div style="margin-top:14px;padding:14px 15px;border-radius:18px;background:rgba(18,30,11,.15);border:1px solid rgba(237,214,145,.12)">
                            <div class="help" style="margin:0;color:rgba(245,239,223,.96)">Los waypoints del GPX deben guardarse con nombre o descripción: <b>START</b>, <b>FINISH</b>, <b>B01</b>, <b>B02</b>, etc. La app actualiza automáticamente el punto cuyo ID coincida.</div>
                        </div>`;
                }
                // Quitar el botón ATAK duplicado del bloque antiguo de importación de texto.
                importBlock.querySelectorAll("button").forEach(btn=>{
                    const t=norm(btn.textContent);
                    if(t.includes("ATAK") && t.includes("GPX")) btn.remove();
                });
                // Quitar la ayuda ATAK duplicada del bloque antiguo.
                importBlock.querySelectorAll(".help").forEach(h=>{
                    const t=norm(h.textContent);
                    if(t.includes("ATAK GPX") && t.includes("waypoint")) h.remove();
                });
                atakBlock.appendChild(atakInput);
                header.insertAdjacentElement("afterend", atakBlock);
                searchBlock.style.marginTop="34px";
                searchBlock.style.padding="18px";
                searchBlock.style.borderRadius="28px";
                atakBlock.insertAdjacentElement("afterend", searchBlock);

                const searchTitleEl=searchBlock.querySelector("label,h3,h4,strong,.block-title,.section-title")||searchBlock.firstElementChild;
                if(searchTitleEl && !searchTitleEl.dataset.militopoSearchStyled){
                    const cleanTitle=String(searchTitleEl.textContent||"").replace(/^\s*[🗺️🔎📍]+\s*/u,"").trim()||"BUSCAR ZONA DEL MAPA";
                    searchTitleEl.textContent=`🗺️ ${cleanTitle}`;
                    searchTitleEl.style.display="block";
                    searchTitleEl.style.marginBottom="14px";
                    searchTitleEl.dataset.militopoSearchStyled="1";
                }

                const searchInput=searchBox;
                if(searchInput){
                    searchInput.style.minHeight="70px";
                    searchInput.style.padding="0 22px";
                    searchInput.style.fontSize="1.02rem";
                    searchInput.style.fontWeight="700";
                    searchInput.style.letterSpacing=".015em";
                    searchInput.style.borderRadius="22px";
                    searchInput.style.border="1.4px solid rgba(233, 194, 116, .65)";
                    searchInput.style.background="linear-gradient(180deg, rgba(85,53,28,.96), rgba(59,36,21,.96))";
                    searchInput.style.boxShadow="inset 0 1px 0 rgba(255,255,255,.10), 0 10px 22px rgba(35,22,10,.22)";
                }

                const searchButtons=[...searchBlock.querySelectorAll("button")].filter(btn=>btn.offsetParent!==null || btn.style.display!=="none");
                const primaryBtn=searchButtons[0];
                const secondaryBtn=searchButtons[1];
                [primaryBtn,secondaryBtn].forEach(btn=>{
                    if(!btn)return;
                    btn.style.width="100%";
                    btn.style.maxWidth="unset";
                    btn.style.minHeight="58px";
                    btn.style.padding="14px 18px";
                    btn.style.borderRadius="999px";
                    btn.style.fontSize="1.02rem";
                    btn.style.letterSpacing=".03em";
                    btn.style.marginTop="14px";
                });
                if(primaryBtn){
                    primaryBtn.innerHTML="🔎 BUSCAR";
                    primaryBtn.style.background="linear-gradient(180deg, #efd185 0%, #e0b45a 100%)";
                    primaryBtn.style.color="#2b1908";
                    primaryBtn.style.boxShadow="0 10px 22px rgba(97,69,23,.24), inset 0 1px 0 rgba(255,255,255,.35)";
                }
                if(secondaryBtn){
                    secondaryBtn.innerHTML="👁️ CENTRAR PLANO EN TODOS LOS PUNTOS";
                    secondaryBtn.style.background="linear-gradient(180deg, rgba(112,72,40,.96), rgba(77,47,27,.96))";
                    secondaryBtn.style.color="#f7f1e2";
                    secondaryBtn.style.boxShadow="0 10px 22px rgba(38,24,13,.22), inset 0 1px 0 rgba(255,255,255,.08)";
                    secondaryBtn.style.marginTop="16px";
                }
                layerPills.style.marginTop="18px";
                layerPills.style.display="grid";
                layerPills.style.gridTemplateColumns="repeat(3,minmax(0,1fr))";
                layerPills.style.gap="10px";
                layerPills.style.padding="8px";
                layerPills.style.borderRadius="22px";
                layerPills.style.background="linear-gradient(180deg, rgba(28,41,17,.10), rgba(15,25,9,.04))";
                layerPills.style.border="1px solid rgba(237,214,145,.12)";
                layerPills.style.boxShadow="inset 0 1px 0 rgba(255,255,255,.06)";
                /* Las cuatro capas permanecen juntas dentro de CAPAS DEL MAPA. */

                const styleLayerPillButtons=()=>{
                    const layerButtons=[...layerPills.querySelectorAll("button")];
                    layerButtons.forEach(btn=>{
                        const layerKey=String(btn.dataset.layer||"").toLowerCase();
                        if(layerKey.includes("mapant")) btn.textContent="🗺️ MAPANT";
                        else if(layerKey.includes("ign")) btn.textContent="🧭 IGN";
                        else if(layerKey.includes("pnoa") || layerKey.includes("aereo") || layerKey.includes("aéreo")) btn.textContent="🛰️ AÉREO";
                        const active=btn.classList.contains("active") || btn.getAttribute("aria-pressed")==="true" || btn.dataset.active==="1";
                        btn.style.width="100%";
                        btn.style.minWidth="0";
                        btn.style.minHeight="42px";
                        btn.style.padding="9px 10px";
                        btn.style.borderRadius="15px";
                        btn.style.fontSize=".9rem";
                        btn.style.lineHeight="1";
                        btn.style.fontWeight="900";
                        btn.style.letterSpacing=".055em";
                        btn.style.boxShadow=active
                            ? "0 8px 18px rgba(68,90,34,.22), inset 0 1px 0 rgba(255,255,255,.20)"
                            : "0 6px 14px rgba(35,22,10,.14), inset 0 1px 0 rgba(255,255,255,.08)";
                        btn.style.border=active
                            ? "1.2px solid rgba(216,181,96,.55)"
                            : "1.1px solid rgba(237,214,145,.18)";
                        btn.style.background=active
                            ? "linear-gradient(180deg, #9ec56a 0%, #7faa4f 100%)"
                            : "linear-gradient(180deg, rgba(109,72,41,.92), rgba(77,48,27,.95))";
                        btn.style.color=active ? "#20300f" : "#f7f1e2";
                        btn.style.whiteSpace="nowrap";
                        btn.style.textAlign="center";
                        btn.style.justifyContent="center";
                        btn.style.display="inline-flex";
                        btn.style.alignItems="center";
                        btn.style.gap="0";
                    });
                };
                styleLayerPillButtons();
                layerPills.addEventListener("click",()=>setTimeout(styleLayerPillButtons,0));

                layerPills.insertAdjacentElement("afterend", mapEl);

                const selectedPoint=document.getElementById("selectedPoint");
                const editBlock=selectedPoint?selectedPoint.closest(".block"):null;
                const tableBlock=document.querySelector(".points-base-table")?.closest(".block")||null;
                const modernBlocks=[editBlock,importBlock,tableBlock].filter(Boolean);
                modernBlocks.forEach(block=>{
                    if(block.classList.contains("autofill-test-panel"))return;
                    block.style.marginTop="22px";
                    block.style.padding="18px";
                    block.style.borderRadius="26px";
                    block.style.background="linear-gradient(180deg, rgba(216,232,191,.12), rgba(68,91,46,.10))";
                    block.style.border="1.2px solid rgba(237,214,145,.20)";
                    block.style.boxShadow="inset 0 1px 0 rgba(255,255,255,.07), 0 10px 26px rgba(0,0,0,.09)";
                    block.querySelectorAll("label").forEach(label=>{
                        label.style.display="block";
                        label.style.marginBottom="10px";
                        label.style.letterSpacing=".055em";
                        label.style.fontWeight="900";
                    });
                    block.querySelectorAll("input,select,textarea").forEach(el=>{
                        el.style.borderRadius=el.tagName==="TEXTAREA"?"18px":"16px";
                        el.style.border="1.2px solid rgba(233,194,116,.48)";
                        el.style.background="linear-gradient(180deg, rgba(69,43,25,.92), rgba(48,31,18,.94))";
                        el.style.boxShadow="inset 0 1px 0 rgba(255,255,255,.08)";
                    });
                    block.querySelectorAll("button").forEach(btn=>{
                        btn.style.minHeight="48px";
                        btn.style.padding="12px 16px";
                        btn.style.borderRadius="999px";
                        btn.style.fontSize=".95rem";
                        btn.style.letterSpacing=".025em";
                    });
                });
                if(importBlock){
                    const title=importBlock.querySelector("label");
                    if(title)title.textContent="📥 IMPORTAR PUNTOS";
                    importBlock.querySelectorAll("button").forEach(btn=>{
                        if(norm(btn.textContent).includes("IMPORTAR TEXTO")){
                            btn.innerHTML="📥 IMPORTAR TEXTO";
                            btn.style.width="100%";
                            btn.style.background="linear-gradient(180deg, #efd185 0%, #e0b45a 100%)";
                            btn.style.color="#2b1908";
                        }
                    });
                }
                if(editBlock){
                    const title=editBlock.querySelector("label");
                    if(title)title.textContent="📍 EDITAR PUNTO DEL PLANO";
                    editBlock.querySelectorAll("button").forEach(btn=>{
                        const t=norm(btn.textContent);
                        if(t.includes("GUARDAR")){
                            btn.style.background="linear-gradient(180deg, #9ec56a 0%, #7faa4f 100%)";
                            btn.style.color="#20300f";
                        }else if(t.includes("LIMPIAR")){
                            btn.style.background="linear-gradient(180deg, #c9654d 0%, #a74735 100%)";
                            btn.style.color="#fff6ea";
                        }
                    });
                }
                if(tableBlock){
                    const title=tableBlock.querySelector("label");
                    if(title)title.textContent="📋 TABLA EDITABLE DE PUNTOS";
                    const wrap=tableBlock.querySelector(".table-wrap");
                    if(wrap){
                        wrap.style.borderRadius="18px";
                        wrap.style.overflowX="hidden";
                        wrap.style.overflowY="auto";
                        wrap.style.webkitOverflowScrolling="touch";
                        wrap.style.border="1px solid rgba(237,214,145,.16)";
                        wrap.style.width="100%";
                        wrap.style.maxWidth="100%";
                        wrap.style.boxSizing="border-box";
                        wrap.style.touchAction="pan-y";
                        wrap.style.overscrollBehaviorX="none";
                        wrap.style.maxHeight="430px";
                        wrap.style.webkitOverflowScrolling="auto";
                        wrap.style.scrollbarWidth="none";
                    }
                }

                step2.dataset.militopoStep2AtakReordered="1";
            }
        }
    }catch(e){console.warn("No se pudo limpiar visualmente el paso 2",e)}


        document.querySelectorAll(".table-wrap").forEach(wrapEl=>{
            if(wrapEl.querySelector(".points-base-table")){
                wrapEl.style.overflowX="hidden";
                wrapEl.style.overflowY="auto";
                wrapEl.style.webkitOverflowScrolling="touch";
                wrapEl.style.width="100%";
                wrapEl.style.maxWidth="100%";
                wrapEl.style.boxSizing="border-box";
                wrapEl.style.touchAction="pan-y";
                wrapEl.style.overscrollBehaviorX="none";
                wrapEl.style.maxHeight="430px";
                wrapEl.style.webkitOverflowScrolling="auto";
                wrapEl.style.scrollbarWidth="none";
            }
        });

    const table=document.querySelector(".points-base-table");
    if(table){
        table.style.fontSize=".84rem";
        table.style.borderCollapse="separate";
        table.style.borderSpacing="0";
        table.style.width="100%";
        table.style.maxWidth="100%";
        table.style.tableLayout="fixed";
        table.style.minWidth="0";
        table.style.boxSizing="border-box";
        const headRow=table.querySelector("thead tr");
        if(headRow){
            [...headRow.children].forEach(th=>{
                const label=String(th.textContent||"").trim().toUpperCase();
                if(label==="ESTADO" || label==="TIPO") th.remove();
            });
            const ths=[...headRow.children];
            if(ths[0]){
                ths[0].textContent="ID";
                ths[0].style.width="32%";
                ths[0].style.textAlign="left";
            }
            if(ths[1]){
                ths[1].textContent="UTM";
                ths[1].style.width="68%";
                ths[1].style.textAlign="left";
            }
            ths.forEach(th=>{
                th.style.padding="7px 3px";
                th.style.fontSize=".70rem";
                th.style.letterSpacing=".045em";
                th.style.lineHeight="1";
                th.style.whiteSpace="nowrap";
            });
        }
        table.querySelectorAll("td").forEach(td=>{
            td.style.padding="4px 4px";
            td.style.verticalAlign="middle";
            td.style.textAlign="left";
            td.style.boxSizing="border-box";
            td.style.overflow="hidden";
        });
        table.querySelectorAll('input[data-field="utm"]').forEach(inp=>{
            inp.style.width="100%";
            inp.style.maxWidth="280px";
            inp.style.minWidth="0";
            inp.style.display="block";
            inp.style.marginLeft="0";
            inp.style.marginRight="auto";
            inp.style.boxSizing="border-box";
            inp.style.maxWidth="280px";
        });
    }
}

function renderPointsTable(){
    cleanupStep2ImportAndTableUi();
    const tbody=document.getElementById("pointsTable");
    tbody.innerHTML="";
    Object.values(state.points).forEach(p=>{
        const st=pointBaseStatus(p.id);
        const typeIcon=symbolForType(p.type);
        const statusText=st.ok?"Completo":`Pendiente · ${escapeHtml(st.missing.join(", "))}`;
        const statusClass=st.ok?"ok":"warn";
        const tr=document.createElement("tr");
        tr.className=st.ok?"point-row-ok":"point-row-warn";
        tr.innerHTML=`<td class="point-id-status-cell" style="width:32%;padding:4px 3px;vertical-align:middle;text-align:left">
                <div style="display:flex;align-items:center;gap:2px;min-width:0">
                    <span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:9px;background:rgba(237,214,145,.12);border:1px solid rgba(237,214,145,.16);font-weight:900;flex:0 0 18px;font-size:.68rem">${typeIcon}</span>
                    <div style="display:flex;flex-direction:column;gap:2px;min-width:0">
                        <b style="font-size:.76rem;line-height:1;letter-spacing:.01em">${escapeHtml(p.id)}</b>
                        <span class="point-status-badge ${statusClass}" style="display:inline-flex;align-items:center;width:max-content;max-width:62px;padding:2px 4px;border-radius:999px;font-size:.54rem;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${st.ok?"✅ ":"⚠️ "}${statusText}</span>
                    </div>
                </div>
            </td>
            <td style="width:68%;padding:4px 3px;vertical-align:middle;text-align:left"><input class="${st.utmOk?"":"point-input-invalid"}" style="width:100%;max-width:280px;min-width:0;display:block;margin-left:0;margin-right:auto;box-sizing:border-box;min-height:32px;padding:6px 7px;border-radius:10px;font-size:.76rem;letter-spacing:.01em" value="${escapeHtml(p.utm||"")}" data-id="${p.id}" data-field="utm" placeholder="30T 463941 4106198"></td>`;
        tbody.appendChild(tr);
    });
    tbody.querySelectorAll("input").forEach(inp=>inp.addEventListener("change",e=>{
        const id=e.target.dataset.id,p=state.points[id];
        if(!p)return;
        const val=normalizeUtmText(e.target.value);
        const parsed=parseUtmStrict(val);
        if(val&&!parsed){
            p.utm=val;
            p.lat=null;
            p.lon=null;
            toast(`UTM incompleta o con formato incorrecto en ${id}`);
        }else if(parsed){
            const ll=utmToLatLon(parsed.normalized);
            p.utm=parsed.normalized;
            p.lat=ll?ll.lat:null;
            p.lon=ll?ll.lon:null;
            p.desc=p.desc||p.id;
        }else{
            p.utm="";
            p.lat=null;
            p.lon=null;
        }
        renderPointsTable();
        renderMapMarkers();
        renderIofDescriptionsEditor();
        saveState();
    }))
}



/* MILITOPO FIX MAPANT 20260605 V3
   MAPANT con WMS de Trailmap/MapProxy, no WMTS manual.
   Motivo: el WMTS mostraba gris al acercar porque algunas teselas de zoom alto no
   respondían bien. WMS recalcula por BBOX en cada zoom y mantiene el zoom cercano. */
function createMapantWmtsLayer(options={}){
    const maxZoom=Number(options.maxZoom||22);
    const layer=L.tileLayer.wms('https://raster.trailmap.fi/mapproxy/service',{
        layers:'spain_mapant',
        styles:'',
        format:'image/png',
        transparent:false,
        version:'1.1.1',
        attribution:'© MapAnt / Trailmap',
        minZoom:0,
        maxZoom:maxZoom,
        tileSize:256,
        crossOrigin:true,
        updateWhenIdle:false,
        updateWhenZooming:true,
        keepBuffer:4
    });
    return layer;
}

function selectPoint(id){selectedPointId=id;document.getElementById("selectedPoint").value=id;loadSelectedPointFields();zoomSelectedPoint()}

/* MILITOPO · ajuste manual seguro del centro del plano PDF */
function getAutomaticPlanPdfCenter(pts){
    return pts.length?{
        lat:pts.reduce((sum,p)=>sum+p.lat,0)/pts.length,
        lon:pts.reduce((sum,p)=>sum+p.lon,0)/pts.length
    }:{lat:40.4168,lon:-3.7038};
}
function getSavedManualPlanPdfCenter(){
    const c=state.pdfPlanCenterManual;
    return c&&Number.isFinite(Number(c.lat))&&Number.isFinite(Number(c.lon))
        ? {lat:Number(c.lat),lon:Number(c.lon)}
        : null;
}
function ensurePlanPdfAdjustControls(){
    const step2=document.getElementById("step2");
    const mapEl=step2?.querySelector("#map");
    const quickBlock=step2?.querySelector(".autofill-test-panel");
    if(!step2||!mapEl||!quickBlock)return;

    let box=document.getElementById("pdfPlanAdjustControls");
    if(box && !step2.contains(box)){
        box.remove();
        box=null;
    }
    if(box){
        if(box.nextElementSibling!==quickBlock)quickBlock.insertAdjacentElement("beforebegin",box);
        return;
    }

    box=document.createElement("div");
    box.id="pdfPlanAdjustControls";
    box.className="block pdf-plan-adjust-controls-block";
    box.style.cssText="position:relative;z-index:20;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;width:100%;max-width:100%;grid-column:1 / -1;box-sizing:border-box;margin:14px 0 14px;padding:12px 11px;border-radius:18px;background:rgba(22,36,20,.94);border:1px solid rgba(235,215,151,.32);box-shadow:0 10px 24px rgba(0,0,0,.22);backdrop-filter:blur(8px)";
    box.innerHTML=`<button id="pdfPlanAdjustBtn" type="button" style="border:0;border-radius:999px;padding:8px 11px;font-weight:900;font-size:.72rem;background:#e7c46f;color:#231707;cursor:pointer">✥ AJUSTAR BORDE</button><button id="pdfPlanSaveCenterBtn" type="button" style="display:none;border:0;border-radius:999px;padding:8px 11px;font-weight:900;font-size:.72rem;background:#83b85f;color:#10200c;cursor:pointer">✓ GUARDAR POSICIÓN</button><button id="pdfPlanAutoCenterBtn" type="button" style="border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:8px 11px;font-weight:900;font-size:.72rem;background:rgba(255,255,255,.08);color:#fff;cursor:pointer">↺ CENTRO AUTOMÁTICO</button><span id="pdfPlanCenterModeText" style="align-self:center;padding:0 4px;color:#f6ead0;font:800 .67rem/1.1 Arial,sans-serif"></span>`;
    quickBlock.insertAdjacentElement("beforebegin",box);
    document.getElementById("pdfPlanAdjustBtn")?.addEventListener("click",()=>{
        pdfPlanAdjustMode=!pdfPlanAdjustMode;
        updatePlanPdfAdjustControls();
        renderPlanPdfPreview();
        toast(pdfPlanAdjustMode?"Arrastra el marcador central para mover el borde del plano":"Ajuste del borde desactivado");
    });
    document.getElementById("pdfPlanSaveCenterBtn")?.addEventListener("click",()=>{
        if(pdfPlanCenterMarker){
            const ll=pdfPlanCenterMarker.getLatLng();
            state.pdfPlanCenterManual={lat:ll.lat,lon:ll.lng};
            pdfPlanAdjustMode=false;
            saveState();
            updatePlanPdfAdjustControls();
            renderPlanPdfPreview();
            toast("Posición manual del plano guardada");
        }
    });
    document.getElementById("pdfPlanAutoCenterBtn")?.addEventListener("click",()=>{
        state.pdfPlanCenterManual=null;
        pdfPlanAdjustMode=false;
        saveState();
        updatePlanPdfAdjustControls();
        renderPlanPdfPreview();
        toast("Centro automático restaurado");
    });
    updatePlanPdfAdjustControls();
}
function updatePlanPdfAdjustControls(){
    const adjust=document.getElementById("pdfPlanAdjustBtn");
    const save=document.getElementById("pdfPlanSaveCenterBtn");
    const mode=document.getElementById("pdfPlanCenterModeText");
    const manual=!!getSavedManualPlanPdfCenter();
    if(adjust){
        adjust.textContent=pdfPlanAdjustMode?"✕ CANCELAR AJUSTE":"✥ AJUSTAR BORDE";
        adjust.style.background=pdfPlanAdjustMode?"#c85f4d":"#e7c46f";
        adjust.style.color=pdfPlanAdjustMode?"#fff":"#231707";
    }
    if(save)save.style.display=pdfPlanAdjustMode?"inline-block":"none";
    if(mode)mode.textContent=pdfPlanAdjustMode?"Mueve el punto central":manual?"Centro manual activo":"Centro automático";
}

/* MILITOPO · previsualización exacta de la ventana del plano PDF en el mapa del paso 2 */
function getPlanPdfPreviewGeometry(){
    const pts=Object.values(state.points||{}).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));
    if(!pts.length)return null;

    // Debe coincidir exactamente con participantPlanHtml().
    const planScale=Number(state.planScale||10000)===7500?7500:10000;
    const planHtmlToPdfMeasuredFactor=1.00;
    const mapPaperWidthMm=230;
    const mapPaperHeightMm=158;
    const terrainWidthM=mapPaperWidthMm*planHtmlToPdfMeasuredFactor*planScale/1000;
    const terrainHeightM=mapPaperHeightMm*planHtmlToPdfMeasuredFactor*planScale/1000;

    // Incluye SALIDA, LLEGADA y todas las balizas con coordenadas válidas.
    const automaticCenter=getAutomaticPlanPdfCenter(pts);
    const center=getSavedManualPlanPdfCenter()||automaticCenter;
    const mPerLat=111320;
    const mPerLon=111320*Math.cos(center.lat*Math.PI/180);
    const halfLat=(terrainHeightM/2)/mPerLat;
    const halfLon=(terrainWidthM/2)/(mPerLon||1);
    const bounds={
        north:center.lat+halfLat,
        south:center.lat-halfLat,
        west:center.lon-halfLon,
        east:center.lon+halfLon
    };
    const inside=p=>p.lat<=bounds.north&&p.lat>=bounds.south&&p.lon>=bounds.west&&p.lon<=bounds.east;
    const outside=pts.filter(p=>!inside(p));
    return {pts,center,bounds,outside,planScale,terrainWidthM,terrainHeightM};
}

function renderPlanPdfPreview(){
    if(!map||typeof L==="undefined")return;
    ensurePlanPdfAdjustControls();
    updatePlanPdfAdjustControls();
    if(!pdfPlanPreviewLayer)pdfPlanPreviewLayer=L.layerGroup().addTo(map);
    pdfPlanPreviewLayer.clearLayers();

    const geometry=getPlanPdfPreviewGeometry();
    if(!geometry)return;
    const {center,bounds,outside,planScale,terrainWidthM,terrainHeightM}=geometry;
    const hasOutside=outside.length>0;
    const lineColor=hasOutside?"#ff4d4d":"#39b54a";

    pdfPlanPreviewRectangle=L.rectangle(
        [[bounds.south,bounds.west],[bounds.north,bounds.east]],
        {color:lineColor,weight:3,opacity:.96,fillColor:lineColor,fillOpacity:.055,dashArray:"12 8",interactive:false}
    ).addTo(pdfPlanPreviewLayer);

    // Etiqueta compacta colocada fuera del rectángulo para no tapar el plano.
    const labelText="BORDE PLANOS RECORRIDOS";
    const labelIcon=L.divIcon({
        className:"",
        iconSize:null,
        iconAnchor:[0,24],
        html:`<div style="pointer-events:none;white-space:nowrap;padding:4px 7px;border-radius:7px;background:${hasOutside?"rgba(115,14,14,.94)":"rgba(24,76,35,.94)"};border:2px solid ${lineColor};color:#fff;font:900 9px/1 Arial,sans-serif;letter-spacing:.02em;box-shadow:0 3px 10px rgba(0,0,0,.30)">${labelText}</div>`
    });
    const labelLat=bounds.north+((bounds.north-bounds.south)*0.015);
    pdfPlanPreviewLabelMarker=L.marker([labelLat,bounds.west],{icon:labelIcon,interactive:false,zIndexOffset:900}).addTo(pdfPlanPreviewLayer);

    const centerIcon=L.divIcon({
        className:"",
        iconSize:pdfPlanAdjustMode?[32,32]:[18,18],
        iconAnchor:pdfPlanAdjustMode?[16,16]:[9,9],
        html:pdfPlanAdjustMode
            ? `<div style="width:30px;height:30px;border-radius:50%;background:#f2cf78;border:4px solid #fff;box-shadow:0 4px 16px rgba(0,0,0,.45);cursor:grab;position:relative"><span style="position:absolute;left:12px;top:4px;width:2px;height:14px;background:#24331d"></span><span style="position:absolute;left:6px;top:10px;width:14px;height:2px;background:#24331d"></span></div>`
            : `<div style="width:18px;height:18px;position:relative;pointer-events:none"><span style="position:absolute;left:8px;top:0;width:2px;height:18px;background:${lineColor}"></span><span style="position:absolute;left:0;top:8px;width:18px;height:2px;background:${lineColor}"></span></div>`
    });
    pdfPlanCenterMarker=L.marker([center.lat,center.lon],{icon:centerIcon,interactive:pdfPlanAdjustMode,draggable:pdfPlanAdjustMode,zIndexOffset:1000}).addTo(pdfPlanPreviewLayer);
    if(pdfPlanAdjustMode){
        pdfPlanCenterMarker.on("dragstart",()=>{
            if(map&&map.dragging)map.dragging.disable();
        });
        pdfPlanCenterMarker.on("drag",ev=>{
            const ll=ev.target.getLatLng();
            state.pdfPlanCenterManual={lat:ll.lat,lon:ll.lng};
            if(pdfPlanDragFrame)cancelAnimationFrame(pdfPlanDragFrame);
            pdfPlanDragFrame=requestAnimationFrame(()=>{
                pdfPlanDragFrame=null;
                const mPerLat=111320;
                const mPerLon=111320*Math.cos(ll.lat*Math.PI/180);
                const halfLat=(terrainHeightM/2)/mPerLat;
                const halfLon=(terrainWidthM/2)/(mPerLon||1);
                const liveBounds=[[ll.lat-halfLat,ll.lng-halfLon],[ll.lat+halfLat,ll.lng+halfLon]];
                if(pdfPlanPreviewRectangle)pdfPlanPreviewRectangle.setBounds(liveBounds);
                if(pdfPlanPreviewLabelMarker){
                    const labelLatLive=(ll.lat+halfLat)+(halfLat*2*.015);
                    pdfPlanPreviewLabelMarker.setLatLng([labelLatLive,ll.lng-halfLon]);
                }
            });
        });
        pdfPlanCenterMarker.on("dragend",ev=>{
            if(map&&map.dragging)map.dragging.enable();
            const ll=ev.target.getLatLng();
            state.pdfPlanCenterManual={lat:ll.lat,lon:ll.lng};
            scheduleSaveState();
            renderPlanPdfPreview();
        });
    }

    outside.forEach(p=>{
        L.circleMarker([p.lat,p.lon],{
            radius:15,color:"#ff3030",weight:4,opacity:1,fillColor:"#ff3030",fillOpacity:.10,interactive:false
        }).addTo(pdfPlanPreviewLayer);
    });
}

function initMap(){if(map)return;const step2MaxZoom=24;const pnoaNativeMaxZoom=19;map=L.map("map",{zoomControl:true,maxZoom:step2MaxZoom,zoomSnap:.25,zoomDelta:.5,wheelPxPerZoomLevel:34,doubleClickZoom:true,boxZoom:true,touchZoom:true,bounceAtZoomLimits:false}).setView([40.4168,-3.7038],7);layers.mapant=createMapantWmtsLayer({maxZoom:step2MaxZoom,maxNativeZoom:19});layers.ign=L.tileLayer("https://www.ign.es/wmts/mapa-raster?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=MTN&STYLE=default&TILEMATRIXSET=GoogleMapsCompatible&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",{attribution:"© Instituto Geográfico Nacional",maxNativeZoom:18,maxZoom:step2MaxZoom,keepBuffer:6,updateWhenZooming:true});layers.pnoa=L.tileLayer("https://www.ign.es/wmts/pnoa-ma?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=OI.OrthoimageCoverage&STYLE=default&TILEMATRIXSET=GoogleMapsCompatible&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",{attribution:"© PNOA Máxima Actualidad · IGN",maxNativeZoom:pnoaNativeMaxZoom,maxZoom:22,keepBuffer:8,updateWhenIdle:false,updateWhenZooming:true,crossOrigin:true,className:"pnoa-overzoom-tile"});const initialLayer=["mapant","ign","pnoa"].includes(state.selectedMapLayer)?state.selectedMapLayer:"mapant";map.setMaxZoom(initialLayer==="pnoa"?22:step2MaxZoom);currentLayer=layers[initialLayer].addTo(map);document.querySelectorAll(".layer-btn").forEach(b=>b.classList.toggle("active",b.dataset.layer===state.selectedMapLayer));markersLayer=L.layerGroup().addTo(map);routeLayer=L.layerGroup().addTo(map);map.on("click",e=>{const p=state.points[selectedPointId];if(!p)return;const utm=latLonToUtm(e.latlng.lat,e.latlng.lng);p.lat=e.latlng.lat;p.lon=e.latlng.lng;p.utm=utm;document.getElementById("selectedUtm").value=utm;renderPointsTable();renderMapMarkers();saveState();toast(`${p.id} colocado en el mapa`)});renderMapMarkers();fitAllPoints()}
function bringPlanPreviewToFront(){
    try{
        if(pdfPlanPreviewRectangle&&typeof pdfPlanPreviewRectangle.bringToFront==="function")pdfPlanPreviewRectangle.bringToFront();
        if(pdfPlanPreviewLabelMarker&&typeof pdfPlanPreviewLabelMarker.setZIndexOffset==="function")pdfPlanPreviewLabelMarker.setZIndexOffset(1200);
        if(pdfPlanCenterMarker&&typeof pdfPlanCenterMarker.setZIndexOffset==="function")pdfPlanCenterMarker.setZIndexOffset(1250);
    }catch(e){console.warn("No se pudo colocar el borde de impresión al frente",e)}
}
function switchLayer(name){if(!map)return;const pnoaNativeMaxZoom=19;const normalMaxZoom=24;if(name==="custom"){if(!orientationGeoTiffRuntime.ready){toast("Importa primero un GeoTIFF o KMZ georreferenciado");updateOrientationCustomOpacityPanel();return}map.setMaxZoom(normalMaxZoom);showOrientationGeoTiffOverlay();state.selectedMapLayer="custom"}else{if(!layers[name])return;map.setMaxZoom(name==="pnoa"?22:normalMaxZoom);if(name==="pnoa"&&map.getZoom()>22)map.setZoom(22,{animate:false});hideOrientationGeoTiffOverlay();if(currentLayer)map.removeLayer(currentLayer);currentLayer=layers[name].addTo(map);state.selectedMapLayer=name}document.querySelectorAll(".layer-btn").forEach(b=>b.classList.toggle("active",b.dataset.layer===name));updateOrientationCustomOpacityPanel();bringPlanPreviewToFront();saveState();setTimeout(()=>{map.invalidateSize();if(name==="custom"&&orientationGeoTiffRuntime.ready&&orientationGeoTiffRuntime.bounds){map.fitBounds(orientationGeoTiffRuntime.bounds,{padding:[24,24],maxZoom:19,animate:true})}bringPlanPreviewToFront()},80)}

// ORIENTATION POINT POPUP JS START
function getPointPopupIcon(type){
    if(type==="SALIDA") return "△";
    if(type==="LLEGADA") return "◎";
    return "○";
}

function buildOrientationPointPopup(pointId){
    const p=state.points[pointId];
    if(!p) return '<div class="ori-map-popup-card"><div class="ori-map-popup-body">Punto no encontrado</div></div>';
    const id=escapeHtml(pointId);
    const type=escapeHtml(p.type||"PUNTO");
    const utm=escapeHtml(p.utm||"");
    const icon=getPointPopupIcon(p.type);

    return `
        <div class="ori-map-popup-card">
            <div class="ori-map-popup-header">
                <div class="ori-map-popup-badge">${icon}</div>
                <div>
                    <div class="ori-map-popup-title">${id}</div>
                    <div class="ori-map-popup-subtitle">${type} · editar en plano</div>
                </div>
            </div>
            <div class="ori-map-popup-body">
                <label class="ori-map-popup-label">Coordenada UTM</label>
                <input class="ori-map-popup-input" id="oriPopupUtm_${id}" value="${utm}" placeholder="30T 451520 4780100">

                <div class="ori-map-popup-actions">
                    <button type="button" class="ori-map-popup-btn save" onclick="saveOrientationPopupPoint('${id}')">✓ Guardar</button>
                    <button type="button" class="ori-map-popup-btn delete" onclick="deleteOrientationPopupPoint('${id}')">🧹 Eliminar</button>
                </div>

                <div class="ori-map-popup-note">✅ Puedes arrastrar el icono para cambiar la posición. La coordenada se actualiza automáticamente.</div>
            </div>
        </div>
    `;
}

function openOrientationPointPopup(marker, pointId){
    selectedPointId=pointId;
    const select=document.getElementById("selectedPoint");
    if(select) select.value=pointId;
    loadSelectedPointFields();

    const html=buildOrientationPointPopup(pointId);
    marker.unbindPopup();
    marker.bindPopup(html,{
        className:"orientation-point-popup",
        closeButton:true,
        autoPan:true,
        keepInView:true,
        maxWidth:320,
        minWidth:260
    });
    marker.openPopup();
}

function saveOrientationPopupPoint(pointId){
    const p=state.points[pointId];
    if(!p) return;
    const utmEl=document.getElementById(`oriPopupUtm_${pointId}`);
    const utm=(utmEl?.value||"").trim().toUpperCase();

    const ll=utmToLatLon(utm);
    if(!ll){
        toast("UTM no válida");
        return;
    }

    p.utm=normalizeUtm(utm);
    p.lat=ll.lat;
    p.lon=ll.lon;
    p.desc=p.desc||p.id;
    p.elevation=null;

    selectedPointId=pointId;
    renderPointSelectors();
    renderPointsTable();
    renderMapMarkers();
    loadSelectedPointFields();
    saveState();
    toast(`${pointId} guardado`);
}

function deleteOrientationPopupPoint(pointId){
    const p=state.points[pointId];
    if(!p) return;
    p.utm="";
    p.lat=null;
    p.lon=null;
    p.elevation=null;
    p.desc=p.type==="BALIZA"?p.id:p.type;

    selectedPointId=pointId;
    renderPointSelectors();
    renderPointsTable();
    renderMapMarkers();
    loadSelectedPointFields();
    saveState();
    toast(`${pointId} eliminado`);
}
// ORIENTATION POINT POPUP JS END

function renderMapMarkers(){if(!markersLayer)return;markersLayer.clearLayers();routeLayer?.clearLayers();renderPlanPdfPreview();Object.values(state.points).forEach(p=>{if(p.lat===null||p.lon===null)return;const icon=L.divIcon({html:`<div class="${iconClassForType(p.type)}">${p.type==="BALIZA"?p.id.replace("B",""):""}</div>`,className:"",iconSize:[22,22],iconAnchor:[11,11]});const marker=L.marker([p.lat,p.lon],{icon,draggable:true}).bindTooltip(`${p.id}`,{permanent:true,direction:"right",className:"marker-label"}).on("dragend",ev=>{const ll=ev.target.getLatLng();p.lat=ll.lat;p.lon=ll.lng;p.utm=latLonToUtm(ll.lat,ll.lng);p.elevation=null;selectedPointId=p.id;renderPointsTable();loadSelectedPointFields();saveState();renderPlanPdfPreview();marker.setPopupContent(buildOrientationPointPopup(p.id))}).on("click",()=>openOrientationPointPopup(marker,p.id)).addTo(markersLayer);marker.bindPopup(buildOrientationPointPopup(p.id),{className:"orientation-point-popup",closeButton:true,autoPan:true,maxWidth:330})})}function iconClassForType(type){return type==="SALIDA"?"ori-start-icon":type==="LLEGADA"?"ori-finish-icon":"ori-control-icon"}function zoomSelectedPoint(){const p=state.points[selectedPointId];if(!map||!p||p.lat===null)return;map.setView([p.lat,p.lon],19)}function fitAllPoints(){
    if(!map)return;
    const latlngs=Object.values(state.points||{})
        .filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon))
        .map(p=>[p.lat,p.lon]);
    if(latlngs.length){
        map.fitBounds(latlngs,{padding:[42,42],maxZoom:19});
    }
}function useMyLocation(){
    if(!navigator.geolocation){toast("Geolocalización no disponible");return}
    if(!map){toast("Mapa no disponible");return}
    navigator.geolocation.getCurrentPosition(pos=>{
        const lat=pos.coords.latitude,lon=pos.coords.longitude,acc=pos.coords.accuracy||0;
        const icon=L.divIcon({
            html:`<div style="width:18px;height:18px;border-radius:50%;background:#2f8cff;border:4px solid white;box-shadow:0 0 0 4px rgba(47,140,255,.28),0 4px 12px rgba(0,0,0,.35);"></div>`,
            className:"",
            iconSize:[24,24],
            iconAnchor:[12,12]
        });
        if(userLocationMarker){
            userLocationMarker.setLatLng([lat,lon]);
        }else{
            userLocationMarker=L.marker([lat,lon],{icon,interactive:true}).addTo(map);
        }
        userLocationMarker.bindPopup(`<b>📍 Estás aquí</b><br>Precisión aproximada: ${Math.round(acc)} m`).openPopup();

        if(userAccuracyCircle){
            userAccuracyCircle.setLatLng([lat,lon]);
            userAccuracyCircle.setRadius(acc);
        }else{
            userAccuracyCircle=L.circle([lat,lon],{
                radius:acc,
                color:"#2f8cff",
                weight:1,
                fillColor:"#2f8cff",
                fillOpacity:.12
            }).addTo(map);
        }

        map.setView([lat,lon],17);
        toast("Ubicación marcada en el mapa");
    },()=>toast("No se pudo obtener ubicación"),{enableHighAccuracy:true,timeout:12000,maximumAge:10000})
}
async function searchPlace(){const q=document.getElementById("searchBox").value.trim();if(!q)return;const ll=utmToLatLon(q.toUpperCase());if(ll){map.setView([ll.lat,ll.lon],15);return}try{const res=await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);const data=await res.json();if(data?.[0])map.setView([Number(data[0].lat),Number(data[0].lon)],14);else toast("Lugar no encontrado")}catch(e){toast("Buscador no disponible")}}
const ORI_UTM_BANDS="CDEFGHJKLMNPQRSTUVWX";
function orientationUtmBandForLat(lat){lat=Number(lat);if(!Number.isFinite(lat)||lat<-80||lat>84)return null;if(lat===84)return"X";return ORI_UTM_BANDS[Math.max(0,Math.min(ORI_UTM_BANDS.length-1,Math.floor((lat+80)/8)))];}
function orientationUtmZoneForLatLon(lat,lon){lat=Number(lat);lon=Number(lon);if(!Number.isFinite(lat)||!Number.isFinite(lon)||lon<-180||lon>180)return null;let zone=lon===180?60:Math.floor((lon+180)/6)+1;if(lat>=56&&lat<64&&lon>=3&&lon<12)zone=32;if(lat>=72&&lat<84){if(lon>=0&&lon<9)zone=31;else if(lon>=9&&lon<21)zone=33;else if(lon>=21&&lon<33)zone=35;else if(lon>=33&&lon<42)zone=37;}return Math.max(1,Math.min(60,zone));}
function orientationParseUtm(text){const m=String(text||"").trim().toUpperCase().match(/^([1-9]|[1-5][0-9]|60)([C-HJ-NP-X])\s+(\d{6})\s+(\d{7})$/);if(!m)return null;const zone=Number(m[1]),letter=m[2],easting=Number(m[3]),northing=Number(m[4]);if(easting<100000||easting>900000||northing<0||northing>10000000)return null;if(letter==="X"&&(zone===32||zone===34||zone===36))return null;return{zone,letter,easting,northing};}
function utmToLatLon(text){const p=orientationParseUtm(text);if(!p||!window.proj4)return null;const north=ORI_UTM_BANDS.indexOf(p.letter)>=ORI_UTM_BANDS.indexOf("N");try{const proj=`+proj=utm +zone=${p.zone} +datum=WGS84 +units=m +no_defs ${north?"":"+south"}`;const [lon,lat]=proj4(proj,"WGS84",[p.easting,p.northing]);if(!Number.isFinite(lat)||!Number.isFinite(lon)||orientationUtmBandForLat(lat)!==p.letter)return null;return{lat,lon,zone:p.zone,letter:p.letter}}catch(e){return null}}
function normalizeUtm(v){const p=orientationParseUtm(v);return p?`${p.zone}${p.letter} ${String(Math.round(p.easting)).padStart(6,"0")} ${String(Math.round(p.northing)).padStart(7,"0")}`:v}
function latLonToUtm(lat,lon){if(!window.proj4)return"";const zone=orientationUtmZoneForLatLon(lat,lon),letter=orientationUtmBandForLat(lat);if(!zone||!letter)return"";const proj=`+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs ${Number(lat)>=0?"":"+south"}`;const [e,n]=proj4("WGS84",proj,[Number(lon),Number(lat)]);return `${zone}${letter} ${String(Math.round(e)).padStart(6,"0")} ${String(Math.round(n)).padStart(7,"0")}`}
function haversineKm(a,b){const R=6371,dLat=(b.lat-a.lat)*Math.PI/180,dLon=(b.lon-a.lon)*Math.PI/180,lat1=a.lat*Math.PI/180,lat2=b.lat*Math.PI/180,x=Math.sin(dLat/2)**2+Math.sin(dLon/2)**2*Math.cos(lat1)*Math.cos(lat2);return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x))}
// ELEVATION REAL ROBUST START
function pointNeedsElevation(p){return p&&p.lat!==null&&p.lon!==null&&(!Number.isFinite(Number(p.elevation))||p.elevationReal!==true)}
function elevationAbortError(){try{return new DOMException("Cálculo de elevación cancelado","AbortError")}catch(_){const e=new Error("Cálculo de elevación cancelado");e.name="AbortError";return e}}
function throwIfElevationAborted(signal){if(signal&&signal.aborted)throw elevationAbortError()}
async function fetchJsonWithTimeout(url,timeoutMs=5000,externalSignal=null){
    if(!window.fetch)return null;throwIfElevationAborted(externalSignal);
    const controller=typeof AbortController!=="undefined"?new AbortController():null;let timer=null;let onAbort=null;
    try{
        if(controller){timer=setTimeout(()=>controller.abort(),timeoutMs);if(externalSignal){onAbort=()=>controller.abort();externalSignal.addEventListener("abort",onAbort,{once:true})}}
        const res=await fetch(url,controller?{signal:controller.signal,cache:"no-store"}:{cache:"no-store"});
        throwIfElevationAborted(externalSignal);
        if(!res||!res.ok)return null;return await res.json();
    }catch(e){if(externalSignal&&externalSignal.aborted)throw elevationAbortError();return null}
    finally{if(timer)clearTimeout(timer);if(externalSignal&&onAbort)externalSignal.removeEventListener("abort",onAbort)}
}
async function fetchElevationChunk(points,timeoutMs=5000,signal=null){
    if(!points||!points.length)return null;throwIfElevationAborted(signal);
    const lats=points.map(p=>Number(p.lat).toFixed(6)).join(","),lons=points.map(p=>Number(p.lon).toFixed(6)).join(",");
    const om=await fetchJsonWithTimeout(`https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`,timeoutMs,signal);
    if(om&&Array.isArray(om.elevation)&&om.elevation.length>=points.length)return om.elevation.slice(0,points.length);
    throwIfElevationAborted(signal);
    const locs=points.map(p=>`${Number(p.lat).toFixed(6)},${Number(p.lon).toFixed(6)}`).join("|");
    const srtm=await fetchJsonWithTimeout(`https://api.opentopodata.org/v1/srtm30m?locations=${encodeURIComponent(locs)}`,timeoutMs,signal);
    if(srtm&&Array.isArray(srtm.results)&&srtm.results.length>=points.length){const arr=srtm.results.slice(0,points.length).map(r=>r&&r.elevation);if(arr.some(e=>Number.isFinite(Number(e))))return arr}
    throwIfElevationAborted(signal);
    const aster=await fetchJsonWithTimeout(`https://api.opentopodata.org/v1/aster30m?locations=${encodeURIComponent(locs)}`,timeoutMs,signal);
    if(aster&&Array.isArray(aster.results)&&aster.results.length>=points.length){const arr=aster.results.slice(0,points.length).map(r=>r&&r.elevation);if(arr.some(e=>Number.isFinite(Number(e))))return arr}
    return null;
}
async function prepareElevationsForRoutes(options={}){
    const signal=options&&options.signal||null;
    const pts=Object.values(state.points).filter(p=>p&&p.lat!==null&&p.lon!==null);
    // Nunca reutilizamos una cota estimada o antigua como si fuese real.
    pts.forEach(p=>{p.elevation=null;p.elev=null;p.elevationReal=false});
    state.elevationSource="unavailable";saveState();
    const realValues=new Map(),chunkSize=20;
    for(let i=0;i<pts.length;i+=chunkSize){
        throwIfElevationAborted(signal);
        const chunk=pts.slice(i,i+chunkSize),elevs=await fetchElevationChunk(chunk,5000,signal);
        if(Array.isArray(elevs))chunk.forEach((p,j)=>{const e=Number(elevs[j]);if(Number.isFinite(e))realValues.set(p.id,Math.round(e))});
    }
    throwIfElevationAborted(signal);
    pts.forEach(p=>{if(realValues.has(p.id)){p.elevation=realValues.get(p.id);p.elev=p.elevation;p.elevationReal=true}else{p.elevation=null;p.elev=null;p.elevationReal=false}});
    const realCount=realValues.size,total=pts.length;
    state.elevationSource=total>0&&realCount===total?"real":realCount>0?"partial":"unavailable";
    saveState();return{realCount,total,source:state.elevationSource};
}
async function prepareElevationsForRoutesWithDeadline(timeoutMs=12000){
    const controller=typeof AbortController!=="undefined"?new AbortController():null;
    let timer=null;
    try{
        if(controller)timer=setTimeout(()=>controller.abort(),timeoutMs);
        return await prepareElevationsForRoutes(controller?{signal:controller.signal}:{});
    }catch(e){
        if(e&&e.name!=="AbortError")console.warn("No se pudo obtener desnivel real",e);
        const pts=Object.values(state.points).filter(p=>p&&p.lat!==null&&p.lon!==null);
        pts.forEach(p=>{if(p.elevationReal!==true){p.elevation=null;p.elev=null;p.elevationReal=false}});
        state.elevationSource="unavailable";saveState();
        return{realCount:pts.filter(p=>p.elevationReal===true&&Number.isFinite(Number(p.elevation))).length,total:pts.length,source:"unavailable",timeout:!!(e&&e.name==="AbortError")};
    }finally{if(timer)clearTimeout(timer)}
}
// ELEVATION REAL ROBUST END
function getAvailableControls(){return Object.values(state.points).filter(p=>p.type==="BALIZA"&&p.lat!==null&&p.lon!==null)}
async function generateRoutes(silent=false){
    if(rejectProtectedRaceMutation("generar de nuevo los recorridos")){if(!silent)hideRouteGenerationLoader();return false;}
    syncConfigFromUi();
    const v=validatePoints();
    if(!v.ok){
        document.getElementById("routeSummary").className="status err";
        document.getElementById("routeSummary").textContent=`Faltan puntos. Debes tener salida, llegada y al menos ${state.controlsPerRoute} balizas completas.`;
        if(!silent) hideRouteGenerationLoader();
        return false;
    }

    const summary=document.getElementById("routeSummary");
    summary.className="status warn";
    summary.textContent="Calculando desnivel real y generando recorridos limpios...";
    if(!silent) showRouteGenerationLoader("Calculando desnivel real...",8);
    else updateRouteGenerationLoader("Calculando desnivel real...",8);
    await routeSleep(60);

    const elevationInfo=await prepareElevationsForRoutesWithDeadline(12000);
    const hasFullRealElevation=elevationInfo.source==="real";
    summary.textContent=hasFullRealElevation
        ? "Desnivel real listo. Diseñando recorridos con trazado lógico..."
        : "Sin desnivel real completo. Los recorridos se calcularán por distancia y geometría.";
    updateRouteGenerationLoader(hasFullRealElevation?"Desnivel real listo. Diseñando trazados...":"Sin desnivel real · continuando de forma segura...",24);
    await routeSleep(60);

    const controls=getAvailableControls();
    const start=state.points.START;
    const finish=state.points.FINISH;
    const routes=[];
    const usage={};
    const qualityWarnings=[];
    controls.forEach(c=>usage[c.id]=0);

    const context=buildProfessionalRouteContext(start,controls,finish);
    const targetCount=Math.min(state.controlsPerRoute,controls.length);
    const uniqueRouteCount=Math.max(1,Math.min(state.participantCount,Number(state.maxUniqueRoutes)||15));
    const attempts=Math.max(3200,Math.min(12000,uniqueRouteCount*620+controls.length*150+targetCount*420));

    function generationShuffle(list, seed){
        const arr=[...list];
        for(let i=arr.length-1;i>0;i--){
            const x=Math.sin((seed+1)*997.31+i*61.17)*10000;
            const r=x-Math.floor(x);
            const j=Math.floor(r*(i+1));
            const tmp=arr[i];arr[i]=arr[j];arr[j]=tmp;
        }
        return arr;
    }

    function generationWideSample(seed, currentUsage){
        const selected=[];
        const used=new Set();
        const pool=generationShuffle(controls,seed);
        if(!pool.length)return selected;
        selected.push(pool[0]);
        used.add(pool[0].id);
        while(selected.length<targetCount && used.size<controls.length){
            let bestC=null,bestScore=-Infinity;
            controls.forEach(c=>{
                if(used.has(c.id))return;
                const minD=Math.min(...selected.map(s=>haversineKm(s,c)));
                const usePenalty=Math.pow((currentUsage[c.id]||0),1.25)*0.20;
                const score=minD-usePenalty+Math.random()*0.05;
                if(score>bestScore){bestScore=score;bestC=c;}
            });
            if(!bestC)break;
            selected.push(bestC);
            used.add(bestC.id);
        }
        return selected;
    }

    for(let r=0;routes.length<uniqueRouteCount && r<uniqueRouteCount*7;r++){
        const routeSlot=routes.length;
        updateRouteGenerationLoader(`Diseñando recorrido único ${routeSlot+1} de ${uniqueRouteCount}...`,24+((routeSlot/Math.max(1,uniqueRouteCount))*66));
        await routeSleep(10);

        let best=null;
        const uniqueCandidates=new Map();

        for(let a=0;a<attempts;a++){
            let sampled;
            let direction=(a%4===0||a%4===3)?1:-1;
            const mode=a%7;

            if(mode===0){
                sampled=professionalSampleControls(context,targetCount,usage,r,a,routes);
                direction=sampled.direction||direction;
                sampled=sampled.controls||sampled;
            }else if(mode===1){
                sampled=sampleBalancedProgression(context,targetCount,usage,r,a,direction);
            }else if(mode===2){
                sampled=sampleFlowingRoute(context,targetCount,usage,r,a,direction,routes);
            }else if(mode===3){
                sampled=generationWideSample(a+r*137,usage);
            }else if(mode===4){
                sampled=generationShuffle(controls,a+r*211).slice(0,targetCount);
            }else if(mode===5){
                const s=professionalSampleControls(context,targetCount,usage,r,a+911,routes);
                direction=s.direction||direction;
                sampled=generationShuffle(s.controls||s,a+r*313).slice(0,targetCount);
            }else{
                sampled=sampleProgressionWindows(context,targetCount,usage,r,a+177,routes,direction);
            }

            const candidateControls=sampled.controls||sampled;
            if(!candidateControls||candidateControls.length<targetCount)continue;

            let ordered=orderControlsSmart(start,candidateControls,finish,a,context,direction);

            // Variaciones controladas para que el generador inicial piense como la regeneración.
            if(a%13===0 && ordered.length>3){
                const k=1+(a%(ordered.length-2));
                const rotated=[...ordered.slice(k),...ordered.slice(0,k)];
                ordered=orderControlsSmart(start,rotated,finish,a+53,context,direction);
            }
            if(a%17===0 && ordered.length>4){
                const c=[...ordered];
                const i=1+(a%(ordered.length-2));
                const tmp=c[i];c[i]=c[i+1];c[i+1]=tmp;
                ordered=smoothAdjacentImprove([start,...c,finish],context,direction).slice(1,-1);
            }

            const ids=ordered.map(c=>c.id);
            const key=ids.join("|");
            if(uniqueCandidates.has(key))continue;

            const route=[start,...ordered,finish];
            const metrics=calcRouteMetrics(route);
            const quality=routeQualityDetails(route,context,direction);

            // Se permite repetir algún tramo suelto. Lo que se penaliza de verdad
            // es coincidir 3 o 4 balizas seguidas con otro recorrido.
            const sequencePenalty=calcLongSequenceOverlapPenalty(ordered,routes);
            const pairPenalty=calcSequenceOverlapPenalty(ordered,routes)*0.035;
            const overlap=calcOverlapPenalty(ordered,routes);
            const reusePenalty=ordered.reduce((sum,c)=>sum+Math.max(0,(usage[c.id]||0)-Math.max(1,state.maxControlReuse||1)+1),0);
            const balancePenalty=calcDistanceBalancePenalty(metrics,routes.map(x=>x.metrics));

            const qualityTier=quality.code==="clean"?0:(quality.code==="acceptable"?1:2);
            const shortLegPenalty=(quality.shortControlLegs||0)*90000;
            const overMaxLegPenalty=(quality.overMaxLegs||0)*420000+(quality.maxLegExcessKm||0)*520000;
            const score=
                overMaxLegPenalty +
                qualityTier*180000 +
                shortLegPenalty +
                quality.total*22.0 +
                sequencePenalty +
                pairPenalty +
                balancePenalty*4.2 +
                overlap*0.35 +
                reusePenalty*2.4 +
                metrics.distanceKm*0.10 +
                Math.random()*0.01;

            const item={route,controls:ordered,metrics,quality,score,sequencePenalty,balancePenalty,direction};
            uniqueCandidates.set(key,item);
            if(!best||score<best.score)best=item;

            // Si encuentra un limpio sin tramos cortos ni coincidencias largas, puede parar antes.
            if(best && best.quality.code==="clean" && Number(best.quality.shortControlLegs||0)===0 && Number(best.quality.overMaxLegs||0)===0 && best.sequencePenalty===0 && a>900){
                break;
            }
        }

        if(!best)continue;

        function prepareGeneratedRouteItem(item, clonedFrom=""){
            item.metrics.quality=item.quality.label;
            item.metrics.qualityCode=item.quality.code;
            item.metrics.qualityScore=Number(item.quality.total.toFixed(2));
            item.metrics.maxLegTargetM=800;
            item.metrics.overMaxLegs=Number(item.quality.overMaxLegs||0);
            item.metrics.overMaxLegList=[...(item.quality.overMaxLegList||[])];
            item.metrics.routeMode=context.mode==="loop"?"circular":"lineal";
            if(clonedFrom)item.metrics.variantOf=clonedFrom;
            return item;
        }

        function pushGeneratedRoute(item, routeNumber, isInverse=false){
            item.controls.forEach(c=>usage[c.id]=(usage[c.id]||0)+1);
            prepareGeneratedRouteItem(item, isInverse?"INVERSO":"");
            routes.push(item);

            const rid="R"+String(routeNumber).padStart(2,"0");
            if(item.quality.overMaxLegs>0){
                qualityWarnings.push(`${rid}: no fue posible mantener todos los tramos por debajo de 800 m. Tramo(s) a revisar: ${(item.quality.overMaxLegList||[]).join(", ")}. Añade o redistribuye balizas para reducirlos.`);
            }
            if(item.quality.shortControlLegs>0){
                qualityWarnings.push(`${rid}: contiene ${item.quality.shortControlLegs} tramo(s) entre balizas por debajo de 200 m (${(item.quality.shortControlLegList||[]).join(", ")}). Añade/mueve balizas o reduce controles por recorrido.`);
            }
            if(item.quality.code==="forced"){
                qualityWarnings.push(`${rid}: Recorrido forzado. Revisa distribución de balizas, reduce controles por recorrido o mueve salida/llegada.`);
            }else if(item.quality.code==="acceptable"){
                qualityWarnings.push(`${rid}: Recorrido aceptable. Trazado válido, pero no totalmente limpio.`);
            }
            // No se muestran avisos por inversos ni por repetir tramos sueltos.
            // La lógica ya evita especialmente coincidir 3 o 4 balizas seguidas.
        }

        const currentRouteNumber=routes.length+1;
        pushGeneratedRoute(best,currentRouteNumber,false);

        // Prioridad alta: si un recorrido sale limpio/perfecto, se crea también su inverso.
        // Así se obtienen dos recorridos muy buenos con la misma calidad de trazado.
        const canAddInverse=routes.length<uniqueRouteCount && best.quality.code==="clean" && Number(best.quality.shortControlLegs||0)===0;
        if(canAddInverse){
            const inverseControls=[...best.controls].reverse();
            const inverseRoute=[start,...inverseControls,finish];
            const inverseMetrics=calcRouteMetrics(inverseRoute);
            const inverseQuality=routeQualityDetails(inverseRoute,context,-best.direction);
            const inverseSequencePenalty=calcSequenceOverlapPenalty(inverseControls,routes);
            const inverseOverlap=calcOverlapPenalty(inverseControls,routes);
            const inverseItem={
                route:inverseRoute,
                controls:inverseControls,
                metrics:inverseMetrics,
                quality:inverseQuality,
                score:best.score+0.001,
                sequencePenalty:inverseSequencePenalty,
                overlap:inverseOverlap,
                balancePenalty:best.balancePenalty||0,
                direction:-best.direction
            };

            // Lo añadimos si sigue siendo bueno. Si por geometría sale aceptable, también se permite,
            // pero nunca si aparecen tramos entre balizas de menos de 200 m.
            if(inverseQuality.shortControlLegs===0 && inverseQuality.code!=="forced"){
                pushGeneratedRoute(inverseItem,routes.length+1,true);
            }
        }
    }

    if(elevationInfo.source!=="real"){
        qualityWarnings.unshift("Desnivel real parcial/no disponible. Se usó estimación conservadora para evitar desniveles falsos.");
    }

    const uniqueRoutes=routes.slice(0,uniqueRouteCount);
    if(!uniqueRoutes.length){
        summary.className="status err";
        summary.textContent="No se pudo generar ningún recorrido válido.";
        if(!silent)hideRouteGenerationLoader();
        return false;
    }
    // Se generan pocos diseños de alta calidad y se reparten cíclicamente.
    // Ejemplo con 15 diseños: P01/P16/P31 usan R01.
    state.routes=Array.from({length:state.participantCount},(_,i)=>{
        const designIndex=i%uniqueRoutes.length;
        const design=uniqueRoutes[designIndex];
        return {
            participantId:"P"+String(i+1).padStart(2,"0"),
            routeId:"R"+String(designIndex+1).padStart(2,"0"),
            routeDesignIndex:designIndex,
            points:design.route.map(p=>p.id)
        };
    });
    state.metrics=state.routes.map((r,i)=>{
        const src=uniqueRoutes[i%uniqueRoutes.length].metrics||{};
        return JSON.parse(JSON.stringify(src));
    });
    state.uniqueRouteCount=uniqueRoutes.length;
    state.skippedRoutes={};
    assignBalancedDifficulties(state.metrics);
    state.routeQualitySummary=buildRouteQualitySummary(state.metrics);
    state.routeWarnings=qualityWarnings;

    updateRouteGenerationLoader("Pintando resultados...",94);
    await routeSleep(80);

    renderRoutes();
    renderQrPreview();
    updateParticipantSelect();
    saveState();

    updateRouteGenerationLoader("Recorridos generados correctamente",100);
    if(qualityWarnings.some(w=>/forzado/i.test(w)))toast("Recorridos generados con algún trazado forzado");
    else toast("Recorridos generados con trazado lógico");
    if(!silent){
        await routeSleep(450);
        hideRouteGenerationLoader();
    }
    return true;
}


function routeEntryToPenaltyRoute(routeEntry){
    const ids=(routeEntry&&Array.isArray(routeEntry.points))?routeEntry.points:[];
    const controls=ids
        .filter(id=>id!=="START"&&id!=="FINISH")
        .map(id=>state.points&&state.points[id])
        .filter(Boolean);
    return {controls};
}

function calcRouteRepeatPenalty(orderedControls,originalControlIds){
    const ids=orderedControls.map(c=>c.id);
    const original=Array.isArray(originalControlIds)?originalControlIds:[];
    if(!ids.length||!original.length)return 0;
    let penalty=0;
    if(ids.join("|")===original.join("|")) penalty+=4500;
    const idSet=new Set(ids);
    const originalSet=new Set(original);
    let common=0;
    originalSet.forEach(id=>{if(idSet.has(id))common++;});
    const sameRatio=common/Math.max(1,Math.min(ids.length,original.length));
    if(sameRatio>=1) penalty+=850;
    else if(sameRatio>=0.85) penalty+=320;
    else if(sameRatio>=0.70) penalty+=120;

    for(let i=0;i<ids.length-1;i++){
        const pair=ids[i]+"|"+ids[i+1];
        const rev=ids[i+1]+"|"+ids[i];
        for(let j=0;j<original.length-1;j++){
            const op=original[j]+"|"+original[j+1];
            if(pair===op) penalty+=120;
            else if(rev===op) penalty+=28;
        }
    }
    return penalty;
}


function sampleFlowingRoute(context,count,usage,routeIndex,attempt,direction,existingRoutes=[]){
    // Alias seguro: usa el selector fluido original y mantiene diversidad mediante seed/dirección.
    if(typeof sampleSmoothGreedy==="function"){
        return sampleSmoothGreedy(context,count,usage,routeIndex,attempt,existingRoutes,direction);
    }
    if(typeof sampleProgressionWindows==="function"){
        return sampleProgressionWindows(context,count,usage,routeIndex,attempt,existingRoutes,direction);
    }
    return (context.controls||[]).slice(0,count);
}

async function regenerateSingleRoute(routeIndex){
    if(rejectProtectedRaceMutation("regenerar recorridos"))return false;
    routeIndex=Number(routeIndex);
    if(!Number.isInteger(routeIndex)||!state.routes||!state.routes[routeIndex]){
        toast("Recorrido no encontrado");
        return false;
    }

    syncConfigFromUi();
    const v=validatePoints();
    if(!v.ok){
        const summary=document.getElementById("routeSummary");
        if(summary){
            summary.className="status err";
            summary.textContent=`Faltan puntos. Debes tener salida, llegada y al menos ${state.controlsPerRoute} balizas completas.`;
        }
        toast("Faltan puntos obligatorios");
        return false;
    }

    const oldRoute=state.routes[routeIndex];
    const routeId=oldRoute.routeId||("R"+String(routeIndex+1).padStart(2,"0"));
    const participantId=oldRoute.participantId||("P"+String(routeIndex+1).padStart(2,"0"));
    const originalControlIds=(oldRoute.points||[]).filter(id=>id!=="START"&&id!=="FINISH");

    // Un recorrido único puede estar asignado a varios participantes (por ejemplo,
    // R01 a P01, P11, P21, P31...). Al regenerarlo desde cualquiera de sus tarjetas,
    // deben cambiar todas las copias que comparten el mismo routeId.
    const linkedRouteIndexes=(state.routes||[])
        .map((route,index)=>String(route?.routeId||"")===String(routeId)?index:-1)
        .filter(index=>index>=0);
    const linkedRouteIndexSet=new Set(linkedRouteIndexes.length?linkedRouteIndexes:[routeIndex]);

    showRouteGenerationLoader(`Regenerando ${routeId} con más variedad...`,6);
    await routeSleep(70);

    await prepareElevationsForRoutesWithDeadline(9000);

    const controls=getAvailableControls();
    const startPoint=state.points.START;
    const finishPoint=state.points.FINISH;
    const context=buildProfessionalRouteContext(startPoint,controls,finishPoint);
    const oldOrdered=originalControlIds.map(id=>state.points[id]).filter(Boolean);

    // Las asignaciones duplicadas del mismo recorrido no deben penalizarse entre sí.
    // Se excluye todo el grupo enlazado durante la búsqueda de la nueva variante.
    const preservedRoutes=(state.routes||[]).filter((_,i)=>!linkedRouteIndexSet.has(i));
    const existingRoutes=preservedRoutes.map(r=>routeEntryToPenaltyRoute(r)).filter(Boolean);
    const existingMetrics=(state.metrics||[]).filter((_,i)=>!linkedRouteIndexSet.has(i));
    const usage={};
    controls.forEach(c=>usage[c.id]=0);
    preservedRoutes.forEach(r=>{
        (r.points||[]).filter(id=>id!=="START"&&id!=="FINISH").forEach(id=>{
            usage[id]=(usage[id]||0)+1;
        });
    });

    const targetCount=Math.min(state.controlsPerRoute,controls.length);
    const attempts=Math.max(2200,Math.min(9000,controls.length*150+targetCount*420+state.participantCount*90));
    let best=null;
    const uniqueCandidates=new Map();

    function candidateKey(ids){return ids.join("|");}
    function routeRepeatHardPenalty(ids){
        let penalty=0;
        const original=originalControlIds||[];
        if(original.length){
            if(ids.join("|")===original.join("|")) penalty+=12000;
            const originalSet=new Set(original);
            const common=ids.filter(id=>originalSet.has(id)).length;
            const ratio=common/Math.max(1,Math.min(ids.length,original.length));
            if(ratio>=1) penalty+=2800;
            else if(ratio>=0.88) penalty+=1350;
            else if(ratio>=0.74) penalty+=540;
            for(let i=0;i<ids.length-1;i++){
                const pair=ids[i]+"|"+ids[i+1];
                const rev=ids[i+1]+"|"+ids[i];
                for(let j=0;j<original.length-1;j++){
                    const op=original[j]+"|"+original[j+1];
                    if(pair===op) penalty+=420;
                    else if(rev===op) penalty+=95;
                }
            }
        }
        return penalty;
    }
    function controlledShuffle(list, seed){
        const arr=[...list];
        for(let i=arr.length-1;i>0;i--){
            const x=Math.sin((seed+1)*999 + i*47.31)*10000;
            const r=x-Math.floor(x);
            const j=Math.floor(r*(i+1));
            const tmp=arr[i];arr[i]=arr[j];arr[j]=tmp;
        }
        return arr;
    }
    function farthestDiverseSample(seed){
        const selected=[];
        const used=new Set();
        const ordered=controlledShuffle(controls,seed);
        const originalSet=new Set(originalControlIds||[]);
        const preferNew=ordered.filter(c=>!originalSet.has(c.id));
        const basePool=preferNew.length>=targetCount?preferNew:ordered;
        if(!basePool.length)return selected;
        selected.push(basePool[0]);used.add(basePool[0].id);
        while(selected.length<targetCount&&used.size<controls.length){
            let bestC=null,bestScore=-Infinity;
            controls.forEach(c=>{
                if(used.has(c.id))return;
                const minD=Math.min(...selected.map(s=>haversineKm(s,c)));
                const a=controlAnalysis(context,c,(seed%2)?1:-1);
                const progressSpread=Math.abs((a.t||0.5)-((selected.length+1)/(targetCount+1)));
                const oldPenalty=originalSet.has(c.id)?0.55:0;
                const usePenalty=Math.pow((usage[c.id]||0),1.25)*0.18;
                const score=minD*1.4-progressSpread*0.35-oldPenalty-usePenalty+Math.random()*0.08;
                if(score>bestScore){bestScore=score;bestC=c;}
            });
            if(!bestC)break;
            selected.push(bestC);used.add(bestC.id);
        }
        return selected;
    }

    for(let a=0;a<attempts;a++){
        const direction=(a%4===0||a%4===3)?1:-1;
        let sample;
        const mode=a%6;
        if(mode===0){
            sample=professionalSampleControls(context,targetCount,usage,routeIndex+17,a+Math.floor(Date.now()%997),[]);
            sample=sample.controls||sample;
        }else if(mode===1){
            sample=sampleBalancedProgression(context,targetCount,usage,routeIndex+29,a,direction);
        }else if(mode===2){
            sample=sampleFlowingRoute(context,targetCount,usage,routeIndex+41,a,direction,existingRoutes);
        }else if(mode===3){
            sample=farthestDiverseSample(a+routeIndex*131);
        }else if(mode===4){
            sample=controlledShuffle(controls,a+routeIndex*211).slice(0,targetCount);
        }else{
            const pool=controlledShuffle(controls,a+routeIndex*307);
            const originalSet=new Set(originalControlIds||[]);
            sample=[...pool.filter(c=>!originalSet.has(c.id)),...pool.filter(c=>originalSet.has(c.id))].slice(0,targetCount);
        }

        if(!sample||sample.length<targetCount)continue;

        let ordered=orderControlsSmart(startPoint,sample,finishPoint,a,context,direction);

        // Variaciones controladas sobre el mismo conjunto: mantiene lógica pero abre más diversidad.
        if(a%7===0) ordered=[...ordered].reverse();
        if(a%9===0 && ordered.length>3){
            const k=1+(a%(ordered.length-2));
            ordered=[...ordered.slice(k),...ordered.slice(0,k)];
            ordered=orderControlsSmart(startPoint,ordered,finishPoint,a+77,context,direction);
        }
        if(a%11===0 && ordered.length>4){
            const i=1+(a%(ordered.length-2));
            const candidate=[...ordered];
            const tmp=candidate[i];candidate[i]=candidate[i+1];candidate[i+1]=tmp;
            ordered=smoothAdjacentImprove([startPoint,...candidate,finishPoint],context,direction).slice(1,-1);
        }

        if(!ordered||ordered.length<targetCount)continue;
        const ids=ordered.map(c=>c.id);
        const key=candidateKey(ids);
        const route=[startPoint,...ordered,finishPoint];
        const metrics=calcRouteMetrics(route);
        const quality=routeQualityDetails(route,context,direction);
        const sequencePenalty=calcSequenceOverlapPenalty(ordered,existingRoutes);
        const overlap=calcOverlapPenalty(ordered,existingRoutes);
        const repeatPenalty=routeRepeatHardPenalty(ids);
        const balancePenalty=calcDistanceBalancePenalty(metrics,existingMetrics);
        const oldDistance=oldOrdered.length?calcSequenceOverlapPenalty(ordered,[{controls:oldOrdered}]):0;

        const overMaxLegPenalty=(quality.overMaxLegs||0)*460000+(quality.maxLegExcessKm||0)*560000;
        const score=
            overMaxLegPenalty +
            quality.total*19.0 +
            sequencePenalty*8.8 +
            overlap*1.7 +
            repeatPenalty +
            oldDistance*6.5 +
            balancePenalty*5.0 +
            Math.abs(metrics.distanceKm-(existingMetrics[0]?.distanceKm||metrics.distanceKm))*0.02 +
            Math.random()*3.5;

        const item={route,controls:ordered,metrics,quality,score,ids,key};
        const prev=uniqueCandidates.get(key);
        if(!prev||score<prev.score)uniqueCandidates.set(key,item);

        // Para no quedarnos en las mismas dos opciones, comparamos sobre muchos candidatos únicos.
        if(!best||score<best.score)best=item;

        if(a%200===0){
            updateRouteGenerationLoader(`Probando variantes ${uniqueCandidates.size} / ${a+1}...`,Math.min(92,10+(a/attempts)*82));
            await routeSleep(1);
        }
    }

    const ranked=[...uniqueCandidates.values()].sort((a,b)=>a.score-b.score);
    if(ranked.length){
        // Elige entre los mejores, no siempre el primero, para que cada pulsación genere alternativas reales.
        const pickWindow=Math.min(14,ranked.length);
        const offset=Math.floor((Date.now()/1000 + routeIndex*3) % pickWindow);
        best=ranked[offset]||ranked[0];
    }

    if(!best){
        hideRouteGenerationLoader();
        toast("No se pudo regenerar un recorrido distinto");
        return false;
    }

    best.metrics.quality=best.quality.label;
    best.metrics.qualityCode=best.quality.code;
    best.metrics.qualityScore=Number(best.quality.total.toFixed(2));
    best.metrics.maxLegTargetM=800;
    best.metrics.overMaxLegs=Number(best.quality.overMaxLegs||0);
    best.metrics.overMaxLegList=[...(best.quality.overMaxLegList||[])];
    best.metrics.routeMode=context.mode==="loop"?"circular":"lineal";

    const regeneratedPointIds=best.route.map(p=>p.id);
    const indexesToUpdate=linkedRouteIndexes.length?linkedRouteIndexes:[routeIndex];
    indexesToUpdate.forEach(index=>{
        const current=state.routes[index]||{};
        state.routes[index]={
            ...current,
            participantId:current.participantId||participantId,
            routeId,
            points:[...regeneratedPointIds]
        };
        // Cada participante conserva una copia independiente de las métricas para
        // evitar que una modificación posterior afecte a todos por referencia.
        state.metrics[index]={...best.metrics};
    });

    assignBalancedDifficulties(state.metrics);
    state.routeQualitySummary=buildRouteQualitySummary(state.metrics);
    state.routeWarnings=(state.routeWarnings||[]).filter(w=>!String(w).startsWith(routeId+":"));
    if(best.quality.overMaxLegs>0)state.routeWarnings.push(`${routeId}: no fue posible mantener todos los tramos por debajo de 800 m. Tramo(s) a revisar: ${(best.quality.overMaxLegList||[]).join(", ")}. Añade o redistribuye balizas para reducirlos.`);
    if(best.quality.shortControlLegs>0)state.routeWarnings.push(`${routeId}: contiene ${best.quality.shortControlLegs} tramo(s) entre balizas por debajo de 200 m (${(best.quality.shortControlLegList||[]).join(", ")}). Añade/mueve balizas o reduce controles por recorrido.`);
    if(best.quality.code==="forced")state.routeWarnings.push(`${routeId}: Recorrido forzado. Revisa distribución de balizas, reduce controles por recorrido o mueve salida/llegada.`);
    else if(best.quality.code==="acceptable")state.routeWarnings.push(`${routeId}: Recorrido aceptable. Trazado válido, pero no totalmente limpio.`);

    renderRoutes();
    renderQrPreview();
    updateParticipantSelect();
    saveState();

    const updatedCount=(linkedRouteIndexes.length||1);
    updateRouteGenerationLoader(`${routeId} regenerado para ${updatedCount} participante${updatedCount===1?"":"s"}`,100);
    await routeSleep(450);
    hideRouteGenerationLoader();
    toast(`${routeId} actualizado en ${updatedCount} participante${updatedCount===1?"":"s"}`);
    return true;
}

function buildProfessionalRouteContext(start,controls,finish){
    const all=[start,...controls,finish].filter(Boolean);
    const lat0=all.reduce((s,p)=>s+Number(p.lat||0),0)/Math.max(1,all.length);
    const lon0=all.reduce((s,p)=>s+Number(p.lon||0),0)/Math.max(1,all.length);
    const cosLat=Math.cos(lat0*Math.PI/180)||1;
    const xy=p=>({x:(Number(p.lon||0)-lon0)*111.32*cosLat,y:(Number(p.lat||0)-lat0)*110.57});
    const startXY=xy(start),finishXY=xy(finish);
    const controlXY=new Map();
    controls.forEach(c=>controlXY.set(c.id,xy(c)));
    const center=controls.length?controls.reduce((o,c)=>{const p=controlXY.get(c.id);o.x+=p.x;o.y+=p.y;return o;},{x:0,y:0}):{x:0,y:0};
    center.x/=Math.max(1,controls.length);center.y/=Math.max(1,controls.length);

    let spread=0;
    controls.forEach(c=>{
        const p=controlXY.get(c.id);
        spread=Math.max(spread,Math.hypot(p.x-center.x,p.y-center.y));
    });
    const sfKm=Math.hypot(finishXY.x-startXY.x,finishXY.y-startXY.y);
    const loopMode=sfKm<Math.max(0.18,spread*0.28);

    const axis={x:finishXY.x-startXY.x,y:finishXY.y-startXY.y};
    let len=Math.hypot(axis.x,axis.y);
    if(loopMode||len<0.05){
        const pca=principalAxisFromControls(controls,controlXY,center);
        axis.x=pca.x;axis.y=pca.y;len=Math.hypot(axis.x,axis.y)||1;
    }
    axis.len=len;axis.len2=len*len||1;

    const angles=new Map();
    const radii=new Map();
    controls.forEach(c=>{
        const p=controlXY.get(c.id);
        const a=Math.atan2(p.y-center.y,p.x-center.x);
        const r=Math.hypot(p.x-center.x,p.y-center.y);
        angles.set(c.id,a);radii.set(c.id,r);
    });
    const avgRadius=[...radii.values()].reduce((s,v)=>s+v,0)/Math.max(1,radii.size);
    const maxRadiusDev=Math.max(0.1,...[...radii.values()].map(v=>Math.abs(v-avgRadius)));
    const startAngle=Math.atan2(startXY.y-center.y,startXY.x-center.x);

    let maxSide=0;
    controls.forEach(c=>{
        const p=controlXY.get(c.id);
        const rel={x:p.x-startXY.x,y:p.y-startXY.y};
        const side=(rel.x*axis.y-rel.y*axis.x)/(axis.len||1);
        maxSide=Math.max(maxSide,Math.abs(side));
    });
    maxSide=maxSide||1;

    return {start,finish,controls,xy,controlXY,startXY,finishXY,center,axis,spread,sfKm,mode:loopMode?"loop":"linear",angles,radii,avgRadius,maxRadiusDev,startAngle,maxSide};
}

function principalAxisFromControls(controls,controlXY,center){
    if(!controls.length)return {x:1,y:0};
    let sxx=0,syy=0,sxy=0;
    controls.forEach(c=>{
        const p=controlXY.get(c.id);
        const x=p.x-center.x,y=p.y-center.y;
        sxx+=x*x;syy+=y*y;sxy+=x*y;
    });
    const theta=0.5*Math.atan2(2*sxy,sxx-syy);
    let vx=Math.cos(theta),vy=Math.sin(theta);
    return {x:vx,y:vy};
}

function normalizeAnglePositive(a){
    const two=Math.PI*2;
    return ((a%two)+two)%two;
}

function controlAnalysis(context,c,direction=1){
    if(!context||!c)return {t:0,side:0,sideNorm:0};
    if(context.mode==="loop"){
        const angle=context.angles.get(c.id)??0;
        const delta=direction>=0?normalizeAnglePositive(angle-context.startAngle):normalizeAnglePositive(context.startAngle-angle);
        const t=delta/(Math.PI*2);
        const radius=context.radii.get(c.id)??context.avgRadius;
        const sideNorm=(radius-context.avgRadius)/(context.maxRadiusDev||1);
        return {t,side:radius,sideNorm:Math.max(-1.4,Math.min(1.4,sideNorm)),radius};
    }
    const p=context.controlXY.get(c.id)||context.xy(c);
    const rel={x:p.x-context.startXY.x,y:p.y-context.startXY.y};
    const t=(rel.x*context.axis.x+rel.y*context.axis.y)/(context.axis.len2||1);
    const side=(rel.x*context.axis.y-rel.y*context.axis.x)/(context.axis.len||1);
    return {t,side,sideNorm:Math.max(-1.4,Math.min(1.4,side/(context.maxSide||1)))};
}

function routePointProgress(context,p,direction,index,lastIndex){
    if(index===0)return 0;
    if(index===lastIndex)return 1;
    return controlAnalysis(context,p,direction).t;
}

function professionalSampleControls(context,count,usage,routeIndex,attempt,existingRoutes=[]){
    if(count>=context.controls.length){
        const direction=routeDirectionForCandidate(context,routeIndex,attempt);
        return {controls:[...context.controls],direction};
    }
    const direction=routeDirectionForCandidate(context,routeIndex,attempt);
    const mode=attempt%4;
    let controls;
    if(mode===0)controls=sampleProgressionWindows(context,count,usage,routeIndex,attempt,existingRoutes,direction);
    else if(mode===1)controls=sampleSmoothGreedy(context,count,usage,routeIndex,attempt,existingRoutes,direction);
    else if(mode===2)controls=sampleProgressionWindows(context,count,usage,routeIndex,attempt+17,existingRoutes,direction);
    else controls=sampleBalancedProgression(context,count,usage,routeIndex,attempt,direction);
    return {controls:ensureUniqueControls(controls,context,count,usage,direction),direction};
}

function routeDirectionForCandidate(context,routeIndex,attempt){
    if(context.mode==="loop")return (routeIndex+Math.floor(attempt/11))%2===0?1:-1;
    return attempt%37===0?-1:1;
}

function ensureUniqueControls(controls,context,count,usage,direction){
    const selected=[],used=new Set();
    (controls||[]).forEach(c=>{if(c&&!used.has(c.id)&&selected.length<count){selected.push(c);used.add(c.id);}});
    if(selected.length<count){
        [...context.controls]
            .sort((a,b)=>{
                const ua=usage[a.id]||0,ub=usage[b.id]||0;
                if(ua!==ub)return ua-ub;
                return controlAnalysis(context,a,direction).t-controlAnalysis(context,b,direction).t;
            })
            .forEach(c=>{if(selected.length<count&&!used.has(c.id)){selected.push(c);used.add(c.id);}});
    }
    return selected;
}

function sampleProgressionWindows(context,count,usage,routeIndex,attempt,existingRoutes,direction){
    const selected=[],used=new Set();
    const lanes=context.mode==="loop"?[-0.45,0.15,0.55,-0.1,0.35]:[-0.65,-0.32,0,0.32,0.65,0.16,-0.16];
    const lane=lanes[(routeIndex+Math.floor(attempt/5))%lanes.length];
    const shift=((routeIndex%7)-3)*0.012+Math.sin((attempt+1)*0.73)*0.018;
    let prev=context.start;
    let prevT=0;
    let prevSide=0;

    for(let j=0;j<count;j++){
        const idealT=Math.max(0.015,Math.min(0.985,(j+1)/(count+1)+shift));
        let best=null;
        context.controls.forEach(c=>{
            if(used.has(c.id))return;
            const a=controlAnalysis(context,c,direction);
            const progressBack=Math.max(0,prevT-a.t);
            const d=haversineKm(prev,c);
            const tPenalty=Math.abs(a.t-idealT)*7.0;
            const sidePenalty=Math.abs((a.sideNorm||0)-lane)*(context.mode==="loop"?0.42:0.75);
            const sideJump=Math.abs((a.sideNorm||0)-prevSide)*0.38;
            const edgePenalty=(a.t<-.04||a.t>1.04)?8:0;
            const usagePenalty=Math.pow((usage[c.id]||0),1.45)*1.15;
            const pairPenalty=pairOverlapPenalty(prev.id,c.id,existingRoutes)*1.8;
            const score=tPenalty+progressBack*80+d*0.22+sidePenalty+sideJump+edgePenalty+usagePenalty+pairPenalty+Math.random()*0.06;
            if(!best||score<best.score)best={c,score,a};
        });
        if(best){
            selected.push(best.c);used.add(best.c.id);prev=best.c;prevT=Math.max(prevT,best.a.t);prevSide=best.a.sideNorm||0;
        }
    }
    return selected;
}

function sampleSmoothGreedy(context,count,usage,routeIndex,attempt,existingRoutes,direction){
    const selected=[],used=new Set();
    const laneWave=Math.sin(routeIndex*1.19+attempt*.13)*0.38;
    let current=context.start;
    let prevT=0;
    let prevSide=0;
    for(let j=0;j<count;j++){
        const idealT=(j+1)/(count+1);
        let best=null;
        context.controls.forEach(c=>{
            if(used.has(c.id))return;
            const a=controlAnalysis(context,c,direction);
            const back=Math.max(0,prevT-a.t);
            const d=haversineKm(current,c);
            const tPenalty=Math.abs(a.t-idealT)*5.6;
            const progressPenalty=back*95;
            const sideContinuity=Math.abs((a.sideNorm||0)-prevSide)*0.62;
            const lanePenalty=Math.abs((a.sideNorm||0)-laneWave)*0.28;
            const usagePenalty=Math.pow((usage[c.id]||0),1.42)*1.05;
            const pairPenalty=pairOverlapPenalty(current.id,c.id,existingRoutes)*2.0;
            const score=d*0.62+tPenalty+progressPenalty+sideContinuity+lanePenalty+usagePenalty+pairPenalty+Math.random()*0.05;
            if(!best||score<best.score)best={c,score,a};
        });
        if(best){
            selected.push(best.c);used.add(best.c.id);current=best.c;prevT=Math.max(prevT,best.a.t);prevSide=best.a.sideNorm||0;
        }
    }
    return selected;
}

function sampleBalancedProgression(context,count,usage,routeIndex,attempt,direction){
    const ordered=[...context.controls].sort((a,b)=>controlAnalysis(context,a,direction).t-controlAnalysis(context,b,direction).t);
    const selected=[],used=new Set();
    const offset=(routeIndex*3+attempt)%Math.max(1,ordered.length);
    for(let j=0;j<count;j++){
        const ideal=Math.round((j+1)*ordered.length/(count+1));
        let best=null;
        for(let radius=0;radius<ordered.length;radius++){
            const indexes=[ideal+radius+offset%3-1,ideal-radius+offset%3-1];
            for(const rawIdx of indexes){
                const idx=Math.max(0,Math.min(ordered.length-1,rawIdx));
                const c=ordered[idx];
                if(!c||used.has(c.id))continue;
                const score=radius+Math.pow((usage[c.id]||0),1.35)*2.2+Math.random()*0.04;
                if(!best||score<best.score)best={c,score};
            }
            if(best&&radius>3)break;
        }
        if(best){selected.push(best.c);used.add(best.c.id);}
    }
    return selected;
}

function orderControlsSmart(start,controls,finish,seed=0,context=null,direction=1){
    if(!controls.length)return [];
    context=context||buildProfessionalRouteContext(start,controls,finish);
    const sorted=[...controls].sort((a,b)=>controlAnalysis(context,a,direction).t-controlAnalysis(context,b,direction).t);
    const grouped=groupControlsByProgress(sorted,context,direction);
    let ordered=[];
    let current=start;
    grouped.forEach(group=>{
        const local=[...group];
        while(local.length){
            let bestIdx=0,bestScore=Infinity;
            local.forEach((p,idx)=>{
                const a=controlAnalysis(context,p,direction);
                const d=haversineKm(current,p);
                const prevA=current===start?{sideNorm:0}:controlAnalysis(context,current,direction);
                const side=Math.abs((a.sideNorm||0)-(prevA.sideNorm||0));
                const score=d+side*0.18+Math.random()*0.0001;
                if(score<bestScore){bestScore=score;bestIdx=idx;}
            });
            const next=local.splice(bestIdx,1)[0];
            ordered.push(next);current=next;
        }
    });

    ordered=smoothAdjacentImprove([start,...ordered,finish],context,direction).slice(1,-1);

    const normalRoute=[start,...ordered,finish];
    const reversed=[...ordered].reverse();
    const reverseRoute=[start,...reversed,finish];
    const normalQ=routeQualityDetails(normalRoute,context,direction);
    const reverseQ=routeQualityDetails(reverseRoute,context,-direction);
    if(context.mode==="loop" && reverseQ.total<normalQ.total*.92 && reverseQ.hardBacktracks===0 && reverseQ.crossings===0){
        return reversed;
    }
    if(context.mode!=="loop" && reverseQ.total<normalQ.total*.72 && reverseQ.hardBacktracks===0 && reverseQ.crossings===0){
        return reversed;
    }
    return ordered;
}

function groupControlsByProgress(sorted,context,direction){
    const groups=[];
    const threshold=context.mode==="loop"?0.075:0.055;
    sorted.forEach(c=>{
        const t=controlAnalysis(context,c,direction).t;
        const last=groups[groups.length-1];
        if(!last){groups.push([c]);return;}
        const lastT=controlAnalysis(context,last[last.length-1],direction).t;
        if(Math.abs(t-lastT)<=threshold)last.push(c);
        else groups.push([c]);
    });
    return groups;
}

function smoothAdjacentImprove(route,context,direction){
    let best=[...route];
    let bestQ=routeQualityDetails(best,context,direction).total+routeDistanceKm(best)*0.04;
    let improved=true,loops=0;
    while(improved&&loops<5){
        improved=false;loops++;
        for(let i=1;i<best.length-2;i++){
            const candidate=[...best];
            const tmp=candidate[i];candidate[i]=candidate[i+1];candidate[i+1]=tmp;
            const q=routeQualityDetails(candidate,context,direction);
            const score=q.total+routeDistanceKm(candidate)*0.04;
            if(q.progressPenalty<=routeQualityDetails(best,context,direction).progressPenalty+0.02 && score+0.0001<bestQ){
                best=candidate;bestQ=score;improved=true;
            }
        }
    }
    return best;
}

function routeDistanceKm(route){
    let d=0;
    for(let i=1;i<route.length;i++)d+=haversineKm(route[i-1],route[i]);
    return d;
}


function shortControlLegDetails(route,minKm=0.2){
    let count=0;
    let penalty=0;
    const legs=[];
    if(!Array.isArray(route))return {count,penalty,legs};
    for(let i=1;i<route.length;i++){
        const a=route[i-1], b=route[i];
        if(!a||!b)continue;
        const bothControls=a.type==="BALIZA" && b.type==="BALIZA";
        if(!bothControls)continue;
        const d=haversineKm(a,b);
        if(Number.isFinite(d) && d<minKm){
            count++;
            legs.push(`${a.id}-${b.id}: ${Math.round(d*1000)} m`);
            penalty += Math.pow((minKm-d)/minKm,2)*900 + 260;
        }
    }
    return {count,penalty:Number(penalty.toFixed(3)),legs};
}

const ROUTE_MAX_LEG_TARGET_KM=0.8;

function maxRouteLegDetails(route,maxKm=ROUTE_MAX_LEG_TARGET_KM){
    let count=0;
    let excessKm=0;
    let longestKm=0;
    const legs=[];
    if(!Array.isArray(route))return {count,excessKm,longestKm,legs};
    for(let i=1;i<route.length;i++){
        const a=route[i-1],b=route[i];
        if(!a||!b)continue;
        const d=haversineKm(a,b);
        if(!Number.isFinite(d))continue;
        longestKm=Math.max(longestKm,d);
        if(d>maxKm){
            count++;
            excessKm+=d-maxKm;
            legs.push(`${a.id}-${b.id}: ${Math.round(d*1000)} m`);
        }
    }
    return {
        count,
        excessKm:Number(excessKm.toFixed(3)),
        longestKm:Number(longestKm.toFixed(3)),
        legs
    };
}

function routeMaxLegScore(route,maxKm=ROUTE_MAX_LEG_TARGET_KM){
    const d=maxRouteLegDetails(route,maxKm);
    // Prioridad casi absoluta: primero evitar cualquier tramo superior a 800 m.
    // Si el mapa lo hace imposible, se escoge la alternativa con menos tramos
    // excedidos y con el menor exceso total.
    return d.count*320000+d.excessKm*480000+Math.max(0,d.longestKm-maxKm)*180000;
}

function routeQualityDetails(route,context=null,direction=1){
    context=context||buildProfessionalRouteContext(route[0],route.slice(1,-1),route[route.length-1]);
    let crossings=0,backtracks=0,hardBacktracks=0,turnPenalty=0,zigzags=0,nearRevisits=0,longLegPenalty=0,lateralJumpPenalty=0,edgePenalty=0;
    if(!route||route.length<3)return {total:0,label:"Recorrido limpio",code:"clean",crossings:0,backtracks:0,hardBacktracks:0};

    for(let i=0;i<route.length-3;i++){
        for(let j=i+2;j<route.length-1;j++){
            if(Math.abs(i-j)<=1)continue;
            if(segmentsIntersect(route[i],route[i+1],route[j],route[j+1]))crossings++;
        }
    }

    const progress=route.map((p,i)=>routePointProgress(context,p,direction,i,route.length-1));
    const sideVals=route.map((p,i)=>{
        if(i===0||i===route.length-1)return 0;
        return controlAnalysis(context,p,direction).sideNorm||0;
    });
    const legDistances=[];
    for(let i=1;i<route.length;i++)legDistances.push(haversineKm(route[i-1],route[i]));
    const avgLeg=legDistances.reduce((a,b)=>a+b,0)/Math.max(1,legDistances.length);
    const longest=Math.max(...legDistances,0);
    if(avgLeg>0&&longest>avgLeg*2.15)longLegPenalty=(longest/avgLeg-2.15);

    for(let i=1;i<route.length-1;i++){
        const ang=turnAngle(route[i-1],route[i],route[i+1]);
        const deflection=180-ang;
        if(deflection>105)turnPenalty+=(deflection-105)/55;
        if(ang<68)turnPenalty+=(68-ang)/68*1.8;
        const dt=progress[i]-progress[i-1];
        if(dt<-0.012){backtracks+=Math.abs(dt);if(dt<-0.055)hardBacktracks++;}
        if(progress[i]<-0.08||progress[i]>1.08)edgePenalty+=1;
        const sp=sideVals[i-1],sn=sideVals[i],sx=sideVals[i+1]||0;
        if(Math.sign(sp)!==0&&Math.sign(sx)!==0&&Math.sign(sp)!==Math.sign(sx)&&Math.abs(sn)>.18)zigzags+=1;
        const lateralJump=Math.abs(sn-sp);
        if(lateralJump>0.95)lateralJumpPenalty+=lateralJump-0.95;
    }

    for(let i=1;i<route.length-1;i++){
        for(let j=i+2;j<route.length-1;j++){
            const d=haversineKm(route[i],route[j]);
            if(d<0.14)nearRevisits+=(0.14-d)/0.14;
        }
    }

    const progressPenalty=backtracks*120+hardBacktracks*18;
    const shortLegs=shortControlLegDetails(route,0.2);
    const maxLegs=maxRouteLegDetails(route,ROUTE_MAX_LEG_TARGET_KM);
    const maxLegPenalty=routeMaxLegScore(route,ROUTE_MAX_LEG_TARGET_KM);
    const total=
        maxLegPenalty+
        crossings*90+
        progressPenalty+
        turnPenalty*22+
        zigzags*9+
        nearRevisits*10+
        longLegPenalty*7+
        lateralJumpPenalty*7+
        edgePenalty*6+
        shortLegs.penalty;
    const code=(maxLegs.count===0&&shortLegs.count===0&&crossings===0&&hardBacktracks===0&&total<28&&turnPenalty<1.35&&zigzags<=1)?"clean":((maxLegs.count===0&&shortLegs.count===0&&crossings<=1&&hardBacktracks<=1&&total<70)?"acceptable":"forced");
    const label=code==="clean"?"Recorrido limpio":(code==="acceptable"?"Recorrido aceptable":"Recorrido forzado");
    return {total,crossings,backtracks:Number(backtracks.toFixed(3)),hardBacktracks,turnPenalty:Number(turnPenalty.toFixed(2)),zigzags,nearRevisits:Number(nearRevisits.toFixed(2)),longLegPenalty:Number(longLegPenalty.toFixed(2)),lateralJumpPenalty:Number(lateralJumpPenalty.toFixed(2)),progressPenalty:Number(progressPenalty.toFixed(2)),shortControlLegs:shortLegs.count,shortControlLegList:shortLegs.legs,maxLegTargetM:Math.round(ROUTE_MAX_LEG_TARGET_KM*1000),overMaxLegs:maxLegs.count,overMaxLegList:maxLegs.legs,maxLegExcessKm:maxLegs.excessKm,longestLegKm:maxLegs.longestKm,label,code};
}

function turnAngle(a,b,c){
    const ax=Number(a.lon)-Number(b.lon),ay=Number(a.lat)-Number(b.lat);
    const cx=Number(c.lon)-Number(b.lon),cy=Number(c.lat)-Number(b.lat);
    const dot=ax*cx+ay*cy;
    const n1=Math.sqrt(ax*ax+ay*ay)||1;
    const n2=Math.sqrt(cx*cx+cy*cy)||1;
    const cos=Math.max(-1,Math.min(1,dot/(n1*n2)));
    return Math.acos(cos)*180/Math.PI;
}

function segmentsIntersect(a,b,c,d){
    if(!a||!b||!c||!d)return false;
    const o1=orient(a,b,c),o2=orient(a,b,d),o3=orient(c,d,a),o4=orient(c,d,b);
    return o1*o2<0&&o3*o4<0;
}

function orient(a,b,c){
    return (Number(b.lon)-Number(a.lon))*(Number(c.lat)-Number(a.lat))-(Number(b.lat)-Number(a.lat))*(Number(c.lon)-Number(a.lon));
}


function calcLongSequenceOverlapPenalty(orderedControls,existingRoutes){
    const ids=(orderedControls||[]).map(c=>c.id);
    let penalty=0;
    (existingRoutes||[]).forEach(r=>{
        const ex=(r.controls||[]).map(c=>c.id);
        // Coincidir 3 balizas seguidas se penaliza mucho.
        for(let i=0;i<=ids.length-3;i++){
            const tri=ids.slice(i,i+3).join("|");
            const triRev=ids.slice(i,i+3).reverse().join("|");
            for(let j=0;j<=ex.length-3;j++){
                const other=ex.slice(j,j+3).join("|");
                if(tri===other)penalty+=1600;
                else if(triRev===other)penalty+=420;
            }
        }
        // Coincidir 4 balizas seguidas se considera casi prohibido.
        for(let i=0;i<=ids.length-4;i++){
            const quad=ids.slice(i,i+4).join("|");
            const quadRev=ids.slice(i,i+4).reverse().join("|");
            for(let j=0;j<=ex.length-4;j++){
                const other=ex.slice(j,j+4).join("|");
                if(quad===other)penalty+=9000;
                else if(quadRev===other)penalty+=2400;
            }
        }
    });
    return penalty;
}

function calcSequenceOverlapPenalty(orderedControls,existingRoutes){
    const ids=orderedControls.map(c=>c.id);
    let penalty=0;
    existingRoutes.forEach(r=>{
        const ex=(r.controls||[]).map(c=>c.id);
        for(let i=0;i<ids.length-2;i++){
            const tri=ids.slice(i,i+3).join("|");
            const rev=ids.slice(i,i+3).reverse().join("|");
            for(let j=0;j<ex.length-2;j++){
                const other=ex.slice(j,j+3).join("|");
                const otherRev=ex.slice(j,j+3).reverse().join("|");
                if(tri===other)penalty+=95;
                else if(tri===otherRev||rev===other)penalty+=22;
            }
        }
        for(let i=0;i<ids.length-1;i++){
            const pair=ids.slice(i,i+2).join("|");
            const pairRev=ids.slice(i,i+2).reverse().join("|");
            for(let j=0;j<ex.length-1;j++){
                const op=ex.slice(j,j+2).join("|");
                if(pair===op)penalty+=4.5;
                else if(pairRev===op)penalty+=1.2;
            }
        }
    });
    return penalty;
}

function pairOverlapPenalty(a,b,existingRoutes){
    if(!a||!b)return 0;
    let p=0;
    existingRoutes.forEach(r=>{
        const ex=(r.controls||[]).map(c=>c.id);
        for(let i=0;i<ex.length-1;i++){
            if(ex[i]===a&&ex[i+1]===b)p+=1;
            if(ex[i]===b&&ex[i+1]===a)p+=0.35;
        }
    });
    return p;
}

function calcOverlapPenalty(orderedControls,existingRoutes){
    const ids=new Set(orderedControls.map(c=>c.id));
    let penalty=0;
    existingRoutes.forEach(r=>{
        const routeIds=new Set((r.controls||[]).map(c=>c.id));
        ids.forEach(id=>{if(routeIds.has(id))penalty++;});
    });
    return penalty;
}

function calcDistanceBalancePenalty(metrics,existingMetrics){
    if(!existingMetrics.length)return 0;
    const avg=existingMetrics.reduce((s,m)=>s+Number(m.distanceKm||0),0)/existingMetrics.length;
    if(!avg)return 0;
    const diff=Math.abs(Number(metrics.distanceKm||0)-avg)/avg;
    return diff<0.13?0:Math.pow(diff-0.13,2)*42;
}

function calcBalancePenalty(metrics,existingMetrics){
    if(!existingMetrics.length)return 0;
    const avgDist=existingMetrics.reduce((s,m)=>s+Number(m.distanceKm||0),0)/existingMetrics.length;
    const distDiff=Math.abs(Number(metrics.distanceKm||0)-avgDist)/Math.max(1,avgDist);
    const realClimbs=existingMetrics.filter(m=>m?.positiveM!=null&&Number.isFinite(Number(m.positiveM))).map(m=>Number(m.positiveM));
    if(metrics?.positiveM==null||!Number.isFinite(Number(metrics.positiveM))||!realClimbs.length)return distDiff;
    const avgClimb=realClimbs.reduce((a,b)=>a+b,0)/realClimbs.length;
    const climbDiff=Math.abs(Number(metrics.positiveM)-avgClimb)/Math.max(1,avgClimb||1);
    return distDiff*.5+climbDiff*.5;
}

function buildRouteQualitySummary(metrics){
    const q={clean:0,acceptable:0,forced:0};
    (metrics||[]).forEach(m=>{
        const c=m.qualityCode||"acceptable";
        if(c==="clean")q.clean++;
        else if(c==="forced")q.forced++;
        else q.acceptable++;
    });
    return q;
}
// SMART ROUTE GENERATOR END

function calcRouteMetrics(route){
    let distance=0,longest=0;
    for(let i=1;i<route.length;i++){const d=haversineKm(route[i-1],route[i]);distance+=d;longest=Math.max(longest,d)}
    const hasRealElevation=route.length>1&&route.every(p=>p&&p.elevationReal===true&&Number.isFinite(Number(p.elevation)));
    let pos=null,neg=null,global=null;
    if(hasRealElevation){
        pos=0;neg=0;
        for(let i=1;i<route.length;i++){
            const a=route[i-1],b=route[i],d=haversineKm(a,b),diff=Number(b.elevation)-Number(a.elevation);
            const maxReasonableDiff=Math.max(35,d*1000*0.28);
            if(Math.abs(diff)<=maxReasonableDiff){if(diff>0)pos+=diff;else neg+=Math.abs(diff)}
        }
        const raw=Number(route[route.length-1].elevation)-Number(route[0].elevation);
        global=Math.abs(raw)<=Math.max(50,distance*1000*0.20)?raw:0;
        pos=Math.round(pos);neg=Math.round(neg);global=Math.round(global);
    }
    const difficultyScore=distance*.5+(hasRealElevation?(pos/1000)*.5:0);
    let difficulty="MEDIA";if(difficultyScore<3.5)difficulty="BAJA";if(difficultyScore>7.5)difficulty="ALTA";
    return{distanceKm:Number(distance.toFixed(3)),longestKm:Number(longest.toFixed(3)),positiveM:pos,negativeM:neg,globalM:global,elevationStatus:hasRealElevation?"real":"unavailable",difficulty,difficultyScore:Number(difficultyScore.toFixed(3))}
}
// BALANCED DIFFICULTY BUCKETS START
function assignBalancedDifficulties(metrics){
    if(!Array.isArray(metrics)||!metrics.length) return;
    const n=metrics.length;
    let faciles=Math.round(n/3);
    let medias=Math.round(n/3);
    faciles=Math.max(1,Math.min(faciles,n));
    medias=Math.max(0,Math.min(medias,n-faciles));
    const orden=metrics.map((m,i)=>({i,score:Number(m.difficultyScore||0)})).sort((a,b)=>a.score-b.score);
    orden.forEach((item,rank)=>{
        if(rank<faciles) metrics[item.i].difficulty="BAJA";
        else if(rank<faciles+medias) metrics[item.i].difficulty="MEDIA";
        else metrics[item.i].difficulty="ALTA";
    });
    state.difficultyBuckets={total:n,faciles,medias,dificiles:n-faciles-medias};
}
// BALANCED DIFFICULTY BUCKETS END

function returnStep3MapPanelHome(){
    const panel=document.getElementById("step3MapPanel");
    const grid=document.getElementById("routesGrid");
    const step3=document.getElementById("step3");
    if(!panel||!grid||!step3)return;
    if(panel.parentElement!==step3){
        step3.insertBefore(panel,grid);
    }
}

const manualRouteEditorState={
    routeIndex:-1,
    routeId:"",
    targetCount:0,
    selectedControlIds:[],
    availableControlIds:[]
};
let manualRouteEditorLastFocus=null;
let manualRouteEditorMap=null;
let manualRouteEditorLayers={};
let manualRouteEditorCurrentLayer=null;
let manualRouteEditorMarkersLayer=null;
let manualRouteEditorPathLayer=null;
let manualRouteEditorLayerName="";

function manualRouteLatLng(pointId){
    const point=state.points?.[pointId];
    const lat=Number(point?.lat),lon=Number(point?.lon);
    return Number.isFinite(lat)&&Number.isFinite(lon)?[lat,lon]:null;
}

function buildManualRouteBaseLayers(){
    return{
        mapant:createMapantWmtsLayer({maxZoom:24,maxNativeZoom:19}),
        ign:L.tileLayer("https://www.ign.es/wmts/mapa-raster?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=MTN&STYLE=default&TILEMATRIXSET=GoogleMapsCompatible&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",{attribution:"© Instituto Geográfico Nacional",maxNativeZoom:18,maxZoom:24,keepBuffer:6,updateWhenZooming:true}),
        pnoa:L.tileLayer("https://www.ign.es/wmts/pnoa-ma?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=OI.OrthoimageCoverage&STYLE=default&TILEMATRIXSET=GoogleMapsCompatible&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",{attribution:"© PNOA Máxima Actualidad · IGN",maxNativeZoom:19,maxZoom:22,keepBuffer:8,updateWhenIdle:false,updateWhenZooming:true,crossOrigin:true,className:"pnoa-overzoom-tile"})
    };
}

function switchManualRouteEditorLayer(name){
    const m=manualRouteEditorMap;
    if(!m||!manualRouteEditorLayers[name])return;
    if(manualRouteEditorCurrentLayer)m.removeLayer(manualRouteEditorCurrentLayer);
    m.setMaxZoom(name==="pnoa"?22:24);
    if(name==="pnoa"&&m.getZoom()>22)m.setZoom(22,{animate:false});
    manualRouteEditorCurrentLayer=manualRouteEditorLayers[name].addTo(m);
    manualRouteEditorLayerName=name;
    document.querySelectorAll("[data-manual-map-layer]").forEach(btn=>btn.classList.toggle("active",btn.dataset.manualMapLayer===name));
    manualRouteEditorMarkersLayer?.bringToFront?.();
    manualRouteEditorPathLayer?.bringToFront?.();
    setTimeout(()=>m.invalidateSize(),40);
}

function ensureManualRouteEditorMap(){
    const el=document.getElementById("manualRouteEditorMap");
    if(!el||typeof L==="undefined")return null;
    if(manualRouteEditorMap)return manualRouteEditorMap;
    manualRouteEditorMap=L.map(el,{zoomControl:true,maxZoom:24,zoomSnap:.25,zoomDelta:.5,wheelPxPerZoomLevel:34,doubleClickZoom:true,boxZoom:true,touchZoom:true,bounceAtZoomLimits:false});
    manualRouteEditorLayers=buildManualRouteBaseLayers();
    const preferred=["mapant","ign","pnoa"].includes(state.selectedMapLayer)?state.selectedMapLayer:"mapant";
    manualRouteEditorCurrentLayer=manualRouteEditorLayers[preferred].addTo(manualRouteEditorMap);
    manualRouteEditorLayerName=preferred;
    manualRouteEditorPathLayer=L.layerGroup().addTo(manualRouteEditorMap);
    manualRouteEditorMarkersLayer=L.layerGroup().addTo(manualRouteEditorMap);
    document.querySelectorAll("[data-manual-map-layer]").forEach(btn=>{
        btn.classList.toggle("active",btn.dataset.manualMapLayer===preferred);
        btn.addEventListener("click",()=>switchManualRouteEditorLayer(btn.dataset.manualMapLayer));
    });
    const allLatLngs=Object.values(state.points||{}).map(point=>manualRouteLatLng(point.id)).filter(Boolean);
    if(allLatLngs.length>1)manualRouteEditorMap.fitBounds(L.latLngBounds(allLatLngs).pad(.12),{padding:[24,24],maxZoom:18,animate:false});
    else if(allLatLngs.length===1)manualRouteEditorMap.setView(allLatLngs[0],17,{animate:false});
    else manualRouteEditorMap.setView([40.4168,-3.7038],7,{animate:false});
    requestAnimationFrame(()=>manualRouteEditorMap?.invalidateSize());
    return manualRouteEditorMap;
}

function renderManualRouteEditorMap(){
    const m=ensureManualRouteEditorMap();
    if(!m||!manualRouteEditorMarkersLayer||!manualRouteEditorPathLayer)return;
    manualRouteEditorMarkersLayer.clearLayers();
    manualRouteEditorPathLayer.clearLayers();
    const selected=Array.isArray(manualRouteEditorState.selectedControlIds)?manualRouteEditorState.selectedControlIds:[];
    const order=new Map(selected.map((id,index)=>[String(id),index+1]));
    Object.values(state.points||{}).forEach(point=>{
        const ll=manualRouteLatLng(point.id);if(!ll)return;
        const number=order.get(String(point.id));
        const icon=L.divIcon({html:`<div class="${iconClassForType(point.type)}${number?" manual-route-map-selected":""}">${point.type==="BALIZA"?(number||String(point.id).replace("B","")):""}</div>`,className:"",iconSize:[24,24],iconAnchor:[12,12]});
        const marker=L.marker(ll,{icon,keyboard:true,zIndexOffset:number?500:0})
            .bindTooltip(number?`${point.id} · ${number}ª`:String(point.id),{permanent:true,direction:"right",className:"marker-label"})
            .addTo(manualRouteEditorMarkersLayer);
        if(point.type==="BALIZA"&&manualRouteEditorState.availableControlIds.includes(point.id)){
            marker.on("click",()=>{
                const target=Math.max(1,Number(manualRouteEditorState.targetCount)||1);
                if(manualRouteEditorState.selectedControlIds.includes(point.id)||manualRouteEditorState.selectedControlIds.length>=target)return;
                manualRouteEditorState.selectedControlIds.push(point.id);
                renderManualRouteEditor();
            });
        }
    });
    const sequence=["START",...selected];
    const target=Math.max(1,Number(manualRouteEditorState.targetCount)||1);
    if(selected.length===target)sequence.push("FINISH");
    const latlngs=sequence.map(manualRouteLatLng).filter(Boolean);
    if(latlngs.length>1)L.polyline(latlngs,{color:"#f0c16a",weight:5,opacity:.95,lineJoin:"round",lineCap:"round"}).addTo(manualRouteEditorPathLayer);
    const hint=document.getElementById("manualRouteEditorMapHint");
    if(hint){
        const pretty=["SALIDA",...selected];
        if(selected.length===target)pretty.push("LLEGADA");
        hint.textContent=pretty.join(" → ")+(selected.length<target?" → …":" ");
    }
    document.querySelectorAll("[data-manual-map-layer]").forEach(btn=>btn.classList.toggle("active",btn.dataset.manualMapLayer===manualRouteEditorLayerName));
    requestAnimationFrame(()=>m.invalidateSize());
}

function destroyManualRouteEditorMap(){
    if(manualRouteEditorMap){try{manualRouteEditorMap.remove()}catch(_){}}
    manualRouteEditorMap=null;
    manualRouteEditorLayers={};
    manualRouteEditorCurrentLayer=null;
    manualRouteEditorMarkersLayer=null;
    manualRouteEditorPathLayer=null;
    manualRouteEditorLayerName="";
}

function setManualRouteBackgroundHidden(hidden){
    const targets=[document.querySelector(".app")].filter(Boolean);
    targets.forEach(target=>{
        if(!target)return;
        if(hidden){
            if("inert" in target)target.inert=true;
            target.dataset.manualRoutePrevAriaHidden=target.getAttribute("aria-hidden")||"";
            target.setAttribute("aria-hidden","true");
        }else{
            if("inert" in target)target.inert=false;
            const prev=target.dataset.manualRoutePrevAriaHidden;
            if(prev)target.setAttribute("aria-hidden",prev);
            else target.removeAttribute("aria-hidden");
            delete target.dataset.manualRoutePrevAriaHidden;
        }
    });
}

function linkedRouteIndexesByRouteId(routeId,fallbackIndex){
    const linked=(state.routes||[])
        .map((route,index)=>String(route?.routeId||"")===String(routeId)?index:-1)
        .filter(index=>index>=0);
    return linked.length?linked:[fallbackIndex];
}

function buildManualRouteMetrics(controlIds){
    const startPoint=state.points.START;
    const finishPoint=state.points.FINISH;
    const routeControls=(Array.isArray(controlIds)?controlIds:[]).map(id=>state.points[id]).filter(Boolean);
    const route=[startPoint,...routeControls,finishPoint];
    const context=buildProfessionalRouteContext(startPoint,getAvailableControls(),finishPoint);
    const quality=routeQualityDetails(route,context,1);
    const metrics=calcRouteMetrics(route);
    metrics.quality=quality.label;
    metrics.qualityCode=quality.code;
    metrics.qualityScore=Number(quality.total.toFixed(2));
    metrics.maxLegTargetM=800;
    metrics.overMaxLegs=Number(quality.overMaxLegs||0);
    metrics.overMaxLegList=[...(quality.overMaxLegList||[])];
    metrics.routeMode=context.mode==="loop"?"circular":"lineal";
    return {metrics,quality,pointIds:route.map(point=>point.id)};
}

function applyRouteControlsToLinkedParticipants(routeIndex,controlIds){
    routeIndex=Number(routeIndex);
    const route=state.routes&&state.routes[routeIndex];
    if(!route)return false;
    const routeId=route.routeId||("R"+String(routeIndex+1).padStart(2,"0"));
    const participantId=route.participantId||("P"+String(routeIndex+1).padStart(2,"0"));
    const linkedIndexes=linkedRouteIndexesByRouteId(routeId,routeIndex);
    const built=buildManualRouteMetrics(controlIds);
    linkedIndexes.forEach(index=>{
        const current=state.routes[index]||{};
        state.routes[index]={
            ...current,
            participantId:current.participantId||participantId,
            routeId,
            points:[...built.pointIds]
        };
        state.metrics[index]={...built.metrics};
    });
    assignBalancedDifficulties(state.metrics);
    state.routeQualitySummary=buildRouteQualitySummary(state.metrics);
    state.routeWarnings=(state.routeWarnings||[]).filter(w=>!String(w).startsWith(routeId+":"));
    if(built.quality.overMaxLegs>0)state.routeWarnings.push(`${routeId}: no fue posible mantener todos los tramos por debajo de 800 m. Tramo(s) a revisar: ${(built.quality.overMaxLegList||[]).join(", ")}. Añade o redistribuye balizas para reducirlos.`);
    if(built.quality.shortControlLegs>0)state.routeWarnings.push(`${routeId}: contiene ${built.quality.shortControlLegs} tramo(s) entre balizas por debajo de 200 m (${(built.quality.shortControlLegList||[]).join(", ")}). Añade/mueve balizas o reduce controles por recorrido.`);
    if(built.quality.code==="forced")state.routeWarnings.push(`${routeId}: Recorrido forzado. Revisa distribución de balizas, reduce controles por recorrido o mueve salida/llegada.`);
    else if(built.quality.code==="acceptable")state.routeWarnings.push(`${routeId}: Recorrido aceptable. Trazado válido, pero no totalmente limpio.`);
    renderRoutes();
    renderQrPreview();
    updateParticipantSelect();
    saveState();
    toast(`${routeId} actualizado manualmente en ${linkedIndexes.length} participante${linkedIndexes.length===1?"":"s"}`);
    return true;
}

function ensureManualRouteEditorModal(){
    let modal=document.getElementById("manualRouteEditorModal");
    if(modal)return modal;
    modal=document.createElement("section");
    modal.id="manualRouteEditorModal";
    modal.className="manual-route-modal";
    modal.setAttribute("role","dialog");
    modal.setAttribute("aria-modal","true");
    modal.setAttribute("aria-labelledby","manualRouteEditorTitle");
    modal.style.display="none";
    modal.innerHTML=`
        <div class="manual-route-modal-card">
            <div class="manual-route-modal-head">
                <h3 id="manualRouteEditorTitle">Regenerar recorrido manualmente</h3>
                <button type="button" class="btn secondary manual-route-close-btn" id="manualRouteCloseBtn">Cerrar</button>
            </div>
            <div id="manualRouteEditorBody"></div>
            <div class="manual-route-map-section">
                <div class="manual-route-map-head">
                    <div>
                        <div class="manual-route-subtitle">Vista del recorrido</div>
                        <div id="manualRouteEditorMapHint" class="manual-route-map-hint">SALIDA → …</div>
                    </div>
                    <div class="manual-route-map-layers" aria-label="Fondo del mapa">
                        <button type="button" class="layer-btn" data-manual-map-layer="mapant">🧭 MAPANT</button>
                        <button type="button" class="layer-btn" data-manual-map-layer="ign">🗺️ IGN</button>
                        <button type="button" class="layer-btn" data-manual-map-layer="pnoa">🛰️ AÉREO</button>
                    </div>
                </div>
                <div id="manualRouteEditorMap" class="manual-route-map" aria-label="Mapa del recorrido manual"></div>
                <div class="manual-route-map-note">Todas las balizas permanecen visibles. Cada baliza elegida se une en orden desde SALIDA; al completar la secuencia se añade LLEGADA.</div>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click",ev=>{if(ev.target===modal)closeManualRouteEditor();});
    modal.addEventListener("keydown",ev=>{
        if(ev.key==="Escape"){ev.preventDefault();closeManualRouteEditor();return;}
        if(ev.key!=="Tab")return;
        const focusables=[...modal.querySelectorAll('button:not([disabled]),[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el=>el.offsetParent!==null);
        if(!focusables.length){ev.preventDefault();return;}
        const first=focusables[0];
        const last=focusables[focusables.length-1];
        if(ev.shiftKey){
            if(document.activeElement===first||!modal.contains(document.activeElement)){ev.preventDefault();last.focus();}
        }else if(document.activeElement===last||!modal.contains(document.activeElement)){
            ev.preventDefault();
            first.focus();
        }
    });
    const closeBtn=modal.querySelector("#manualRouteCloseBtn");
    if(closeBtn)closeBtn.addEventListener("click",closeManualRouteEditor);
    return modal;
}

function renderManualRouteEditor(){
    const modal=ensureManualRouteEditorModal();
    const body=modal.querySelector("#manualRouteEditorBody");
    if(!body)return;
    const selected=Array.isArray(manualRouteEditorState.selectedControlIds)?manualRouteEditorState.selectedControlIds:[];
    const selectedSet=new Set(selected);
    const routeRef=manualRouteEditorState.routeId||`R${String(manualRouteEditorState.routeIndex+1).padStart(2,"0")}`;
    const target=Math.max(1,Number(manualRouteEditorState.targetCount)||1);
    body.innerHTML=`
        <div class="status ${selected.length===target?"ok":"warn"}" style="margin-top:0;">
            ${routeRef}: selecciona <b>${target}</b> baliza${target===1?"":"s"} en el orden deseado. Seleccionadas: <b>${selected.length}/${target}</b>.
        </div>
        <div class="manual-route-selected-wrap">
            <div class="manual-route-subtitle">Secuencia actual</div>
            <div class="manual-route-selected-list">
                ${selected.length?selected.map((id,index)=>`<button type="button" class="manual-route-chip is-selected" data-remove-index="${index}" title="Quitar ${escapeHtml(id)}" aria-label="Quitar baliza ${escapeHtml(id)} de la posición ${index+1}">${index+1}. ${escapeHtml(id)} <span aria-hidden="true">✕</span></button>`).join(""):'<span class="manual-route-empty">Todavía no has añadido balizas.</span>'}
            </div>
        </div>
        <div class="manual-route-available-wrap">
            <div class="manual-route-subtitle">Balizas disponibles</div>
            <div class="manual-route-available-list">
                ${manualRouteEditorState.availableControlIds.map(id=>{
                    const blocked=selectedSet.has(id)||selected.length>=target;
                    return `<button type="button" class="manual-route-chip ${blocked?"is-disabled":""}" data-add-id="${escapeHtml(id)}" ${blocked?"disabled":""}>${escapeHtml(id)}</button>`;
                }).join("")}
            </div>
        </div>
        <div class="btn-row manual-route-actions">
            <button type="button" class="btn secondary" id="manualRouteUndoBtn" ${selected.length?"":"disabled"}>↩️ DESHACER ÚLTIMA</button>
            <button type="button" class="btn secondary" id="manualRouteClearBtn" ${selected.length?"":"disabled"}>🧹 LIMPIAR</button>
            <button type="button" class="btn green" id="manualRouteConfirmBtn" ${selected.length===target?"":"disabled"}>✅ GUARDAR RECORRIDO</button>
        </div>`;
    body.querySelectorAll("[data-add-id]").forEach(btn=>{
        btn.addEventListener("click",()=>{
            const id=String(btn.dataset.addId||"");
            if(!id)return;
            if(manualRouteEditorState.selectedControlIds.length>=target)return;
            if(manualRouteEditorState.selectedControlIds.includes(id))return;
            manualRouteEditorState.selectedControlIds.push(id);
            renderManualRouteEditor();
        });
    });
    body.querySelectorAll("[data-remove-index]").forEach(btn=>{
        btn.addEventListener("click",()=>{
            const index=Number(btn.dataset.removeIndex);
            if(!Number.isInteger(index)||index<0)return;
            manualRouteEditorState.selectedControlIds.splice(index,1);
            renderManualRouteEditor();
        });
    });
    const undoBtn=body.querySelector("#manualRouteUndoBtn");
    if(undoBtn)undoBtn.addEventListener("click",()=>{
        manualRouteEditorState.selectedControlIds.pop();
        renderManualRouteEditor();
    });
    const clearBtn=body.querySelector("#manualRouteClearBtn");
    if(clearBtn)clearBtn.addEventListener("click",()=>{
        manualRouteEditorState.selectedControlIds=[];
        renderManualRouteEditor();
    });
    const confirmBtn=body.querySelector("#manualRouteConfirmBtn");
    if(confirmBtn)confirmBtn.addEventListener("click",()=>{
        if(manualRouteEditorState.selectedControlIds.length!==target){
            toast(`Selecciona exactamente ${target} baliza${target===1?"":"s"} antes de guardar.`);
            return;
        }
        const ok=applyRouteControlsToLinkedParticipants(manualRouteEditorState.routeIndex,manualRouteEditorState.selectedControlIds);
        if(ok)closeManualRouteEditor();
    });
    requestAnimationFrame(renderManualRouteEditorMap);
}

function openManualRouteEditor(routeIndex){
    if(rejectProtectedRaceMutation("regenerar recorridos manualmente"))return false;
    routeIndex=Number(routeIndex);
    syncConfigFromUi();
    const route=state.routes&&state.routes[routeIndex];
    if(!Number.isInteger(routeIndex)||!route){toast("Recorrido no encontrado");return false;}
    const validation=validatePoints();
    if(!validation.ok){toast("Completa salida, llegada y balizas antes de regenerar manualmente.");return false;}
    const controls=getAvailableControls().map(control=>control.id);
    if(!controls.length){toast("No hay balizas disponibles para este recorrido.");return false;}
    const target=Math.min(Math.max(1,Number(state.controlsPerRoute)||1),controls.length);
    manualRouteEditorState.routeIndex=routeIndex;
    manualRouteEditorState.routeId=String(route.routeId||("R"+String(routeIndex+1).padStart(2,"0")));
    manualRouteEditorState.targetCount=target;
    manualRouteEditorState.availableControlIds=controls;
    manualRouteEditorState.selectedControlIds=[...new Set((route.points||[]).filter(id=>id!=="START"&&id!=="FINISH").filter(id=>controls.includes(id)))].slice(0,target);
    manualRouteEditorLastFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    ensureManualRouteEditorModal().style.display="flex";
    document.body.classList.add("manual-route-modal-open");
    setManualRouteBackgroundHidden(true);
    renderManualRouteEditor();
    const modal=document.getElementById("manualRouteEditorModal");
    const focusTarget=modal?.querySelector("#manualRouteConfirmBtn:not([disabled]), [data-add-id]:not([disabled]), #manualRouteCloseBtn");
    if(focusTarget&&typeof focusTarget.focus==="function")focusTarget.focus();
    return true;
}

function closeManualRouteEditor(){
    const modal=document.getElementById("manualRouteEditorModal");
    if(modal)modal.style.display="none";
    destroyManualRouteEditorMap();
    document.body.classList.remove("manual-route-modal-open");
    setManualRouteBackgroundHidden(false);
    const restore=manualRouteEditorLastFocus;
    manualRouteEditorLastFocus=null;
    if(restore&&restore.isConnected&&typeof restore.focus==="function")restore.focus();
}

function renderRoutes(){
    const grid=document.getElementById("routesGrid");
    if(!grid)return;
    returnStep3MapPanelHome();
    grid.innerHTML="";
    if(!state.routes.length){
        const routeSummary=document.getElementById("routeSummary");
        if(routeSummary){routeSummary.className="status warn";routeSummary.textContent="Todavía no hay recorridos generados.";}
        return;
    }

    const dists=state.metrics.map(m=>Number(m.distanceKm||0));
    const climbs=state.metrics.filter(m=>m?.positiveM!=null&&Number.isFinite(Number(m.positiveM))).map(m=>Number(m.positiveM));
    const avgD=avg(dists).toFixed(3);
    const avgC=climbs.length?`${Math.round(avg(climbs))} m`:"Sin desnivel real";
    const warnings=Array.isArray(state.routeWarnings)?state.routeWarnings:[];
    const buckets=state.difficultyBuckets||{};
    const q=state.routeQualitySummary||buildRouteQualitySummary(state.metrics||[]);
    const hasForced=(q.forced||0)>0 || warnings.some(w=>/forzado/i.test(w));
    const routeSummary=document.getElementById("routeSummary");
    if(routeSummary){
        const forcedCount=q.forced||0;
        const cleanCount=q.clean||0;
        const acceptableCount=q.acceptable||0;
        const totalRoutes=state.routes.length||0;
        const diffHtml=buckets.total?`<div class="metric difficulty-metric"><small>Dificultad</small><div style="display:grid;gap:2px;margin-top:6px;font-size:16px;font-weight:900;line-height:1.15;"><div style="display:grid;grid-template-columns:28px 1fr;align-items:center;"><b>${buckets.faciles||0}</b><span>fácil</span></div><div style="display:grid;grid-template-columns:28px 1fr;align-items:center;"><b>${buckets.medias||0}</b><span>media</span></div><div style="display:grid;grid-template-columns:28px 1fr;align-items:center;"><b>${buckets.dificiles||0}</b><span>difícil</span></div></div></div>`:"";
        const forcedAdvice=forcedCount>0
            ? `<div style="margin-top:10px;padding:10px 12px;border-radius:14px;background:rgba(255,193,7,.16);border:1px solid rgba(255,193,7,.45);"><b>⚠️ Consejo:</b> hay <b>${forcedCount}</b> recorrido(s) forzado(s). Para reducirlos, añade o mueve balizas, baja controles por recorrido o reduce participantes.</div>`
            : `<div style="margin-top:10px;padding:10px 12px;border-radius:14px;background:rgba(34,197,94,.14);border:1px solid rgba(34,197,94,.38);"><b>✅ Consejo:</b> no hay recorridos forzados. La distribución actual es buena para generar planos.</div>`;
        const extraWarnings=warnings.length?`<details style="margin-top:10px;"><summary style="cursor:pointer;font-weight:800;">Ver avisos técnicos (${warnings.length})</summary><div style="margin-top:8px;display:grid;gap:6px;">${warnings.slice(0,8).map(w=>`<div style="padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.05);">${escapeHtml(w)}</div>`).join("")}${warnings.length>8?`<div style="font-size:12px;opacity:.75;">+ ${warnings.length-8} aviso(s) más.</div>`:""}</div></details>`:"";
        routeSummary.className=hasForced?"status warn":"status ok";
        routeSummary.innerHTML=`
            <div style="display:grid;gap:12px;line-height:1.35;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                    <div>
                        <div style="font-size:18px;font-weight:900;">✅ ${totalRoutes} recorridos generados</div>
                        <div style="font-size:12px;opacity:.8;margin-top:2px;">Resumen automático del paso 3</div>
                    </div>
                    <div style="font-size:12px;font-weight:900;padding:8px 12px;border-radius:999px;background:rgba(255,255,255,.6);border:1px solid rgba(0,0,0,.12);">${hasForced?"REVISAR FORZADOS":"TRAZADO OK"}</div>
                </div>

                <div class="metric-grid" style="margin-top:0;">
                    <div class="metric"><small>Total recorridos</small><b>${totalRoutes}</b></div>
                    <div class="metric"><small>🟢 Lógicos</small><b>${cleanCount}</b></div>
                    <div class="metric"><small>🟡 Aceptables</small><b>${acceptableCount}</b></div>
                    <div class="metric"><small>🔴 Forzados</small><b>${forcedCount}</b></div>
                    <div class="metric"><small>Distancia media</small><b>${avgD} km</b></div>
                    <div class="metric"><small>Desnivel + medio</small><b>${avgC}</b></div>
                    ${diffHtml}
                </div>

                ${forcedAdvice}
                <div style="font-size:12px;opacity:.82;">Tip: si pides muchos participantes y aparecen demasiados forzados, suele mejorar añadiendo balizas intermedias y evitando zonas con pocas alternativas.</div>
                ${extraWarnings}
            </div>`;
    }

    state.routes.forEach((r,i)=>{
        const m=state.metrics[i]||{};
        const div=document.createElement("div");
        div.className="route-card";
        div.dataset.routeIndex=String(i);
        const quality=m.quality||"Recorrido aceptable";
        const qClass=m.qualityCode==="clean"?"ok":(m.qualityCode==="forced"?"err":"warn");
        div.innerHTML=`<div class="route-title"><span>${escapeHtml(r.routeId)} · ${escapeHtml(r.participantId)}</span><span>${escapeHtml(m.difficulty||"MEDIA")}</span></div>
            <div class="metric-grid">
                <div class="metric"><small>Distancia</small><b>${escapeHtml(m.distanceKm||"--")} km</b></div>
                <div class="metric"><small>Tramo largo</small><b>${escapeHtml(m.longestKm||"--")} km</b></div>
                <div class="metric"><small>Desnivel +</small><b>${m.positiveM==null?"Sin desnivel real":escapeHtml(m.positiveM)+" m"}</b></div>
                <div class="metric"><small>Desnivel -</small><b>${m.negativeM==null?"Sin desnivel real":escapeHtml(m.negativeM)+" m"}</b></div>
                <div class="metric"><small>Dificultad</small><b>${escapeHtml(m.difficulty||"MEDIA")}</b></div>
                <div class="metric"><small>Desnivel global</small><b>${m.globalM==null?"Sin desnivel real":(Number(m.globalM)>0?"+":"")+escapeHtml(m.globalM)+" m"}</b></div>
            </div>
            <div class="status ${qClass}" style="margin-top:10px;">${escapeHtml(quality)}${m.routeMode?` · ${escapeHtml(m.routeMode)}`:""}</div>
            <div class="route-line">${r.points.map(escapeHtml).join(" → ")}</div>
            <div class="btn-row"><button class="btn secondary" onclick="previewRouteByKey(\'${escapeHtml(r.routeId)}\',\'${escapeHtml(r.participantId)}\')">🗺️ VER EN PLANO</button><button class="btn" onclick="regenerateSingleRoute(${i})">🔁 REGENERAR SOLO ESTE</button><button class="btn secondary" onclick="openManualRouteEditor(${i})">✍️ REGENERAR MANUALMENTE</button></div>`;
        grid.appendChild(div);
    });
}
function avg(arr){return arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0}let step3RouteMap=null,step3RouteBaseLayer=null,step3RouteLayers={},step3RouteMarkers=null,step3RouteLines=null;

function previewRoute(idx){
    const route=state.routes[idx];
    if(!route)return;
    previewRouteByKey(route.routeId,route.participantId);
}

function previewRouteByKey(routeId,participantId){
    const idx=(state.routes||[]).findIndex(r=>String(r.routeId)===String(routeId)&&String(r.participantId)===String(participantId));
    if(idx<0){toast("El recorrido seleccionado ya no existe. Vuelve a generar o actualizar el paso 3.");return}
    showStep3MapRoute(idx,true);
}

function resetStep3RouteMap(){
    try{if(step3RouteMap)step3RouteMap.remove()}catch(e){console.warn("No se pudo reiniciar el mapa del recorrido",e)}
    step3RouteMap=null;step3RouteBaseLayer=null;step3RouteLayers={};step3RouteMarkers=null;step3RouteLines=null;
    const host=document.getElementById("step3RouteMap");
    if(host){host.innerHTML="";host.removeAttribute("class");host.removeAttribute("tabindex");host.removeAttribute("style");host.setAttribute("style","width:100%;height:min(58vh,560px);min-height:380px;border-radius:22px;overflow:hidden;border:2px solid rgba(230,188,122,.42);background:#d9d1b8;")}
}

function showStep3MapRoute(idx,forceFresh=false){
    const panel=document.getElementById("step3MapPanel");
    const grid=document.getElementById("routesGrid");
    if(!panel||!grid)return;

    const routeCard=grid.querySelector(`.route-card[data-route-index="${idx}"]`);
    if(!routeCard)return;

    // El plano compartido se mueve dentro del mismo bloque del recorrido pulsado.
    // Así no se duplica Leaflet ni se altera la lógica del mapa.
    routeCard.appendChild(panel);
    panel.style.display="block";
    panel.style.marginTop="14px";

    const r=state.routes[idx];
    const title=document.getElementById("step3MapTitle");
    if(title) title.textContent=`${r.routeId} · ${r.participantId}`;

    if(forceFresh)resetStep3RouteMap();
    setTimeout(()=>{
        initStep3RouteMapIfNeeded();
        drawStep3MapRoute(idx);
        if(step3RouteMap)step3RouteMap.invalidateSize();
    },180);
}

function hideStep3Map(){
    const panel=document.getElementById("step3MapPanel");
    if(panel)panel.style.display="none";
}

function initStep3RouteMapIfNeeded(){
    if(step3RouteMap){
        setTimeout(()=>step3RouteMap.invalidateSize(),80);
        return;
    }

    const step3MaxZoom=22;
    step3RouteMap=L.map("step3RouteMap",{zoomControl:true,maxZoom:step3MaxZoom,zoomSnap:.25,zoomDelta:.5,wheelPxPerZoomLevel:42}).setView([40.4168,-3.7038],7);

    step3RouteLayers={
        mapant:createMapantWmtsLayer({maxZoom:step3MaxZoom,maxNativeZoom:19}),
        ign:L.tileLayer("https://www.ign.es/wmts/mapa-raster?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=MTN&STYLE=default&TILEMATRIXSET=GoogleMapsCompatible&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",{attribution:"© IGN",maxNativeZoom:18,maxZoom:step3MaxZoom}),
        pnoa:L.tileLayer("https://www.ign.es/wmts/pnoa-ma?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=OI.OrthoimageCoverage&STYLE=default&TILEMATRIXSET=GoogleMapsCompatible&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",{attribution:"© PNOA",maxNativeZoom:19,maxZoom:step3MaxZoom}),
        custom:null
    };

    const preferredLayer=state.selectedMapLayer==="custom"&&orientationGeoTiffRuntime.ready?"custom":(["mapant","ign","pnoa"].includes(state.selectedMapLayer)?state.selectedMapLayer:"mapant");
    if(preferredLayer==="custom"){
        step3RouteLayers.custom=L.imageOverlay(orientationGeoTiffRuntime.url,orientationGeoTiffRuntime.bounds,{opacity:Number.isFinite(Number(state.customGeoTiffOpacity))?Number(state.customGeoTiffOpacity):1,interactive:false,zIndex:120});
        step3RouteBaseLayer=step3RouteLayers.custom.addTo(step3RouteMap);
    }else step3RouteBaseLayer=step3RouteLayers[preferredLayer].addTo(step3RouteMap);
    step3RouteMarkers=L.layerGroup().addTo(step3RouteMap);
    step3RouteLines=L.layerGroup().addTo(step3RouteMap);
}

function switchStep3MapLayer(name){
    if(!step3RouteMap)return;
    if(name==="custom"){
        if(!orientationGeoTiffRuntime.ready){toast("Importa primero un GeoTIFF o KMZ georreferenciado");return}
        if(step3RouteBaseLayer)step3RouteMap.removeLayer(step3RouteBaseLayer);
        step3RouteLayers.custom=L.imageOverlay(orientationGeoTiffRuntime.url,orientationGeoTiffRuntime.bounds,{opacity:Number.isFinite(Number(state.customGeoTiffOpacity))?Number(state.customGeoTiffOpacity):1});
        step3RouteBaseLayer=step3RouteLayers.custom.addTo(step3RouteMap);
    }else{
        if(!step3RouteLayers[name])return;
        if(step3RouteBaseLayer)step3RouteMap.removeLayer(step3RouteBaseLayer);
        step3RouteBaseLayer=step3RouteLayers[name].addTo(step3RouteMap);
    }
    setTimeout(()=>step3RouteMap.invalidateSize(),80);
}

function drawStep3MapRoute(idx){
    if(!step3RouteMap||!step3RouteMarkers||!step3RouteLines)return;

    step3RouteMarkers.clearLayers();
    step3RouteLines.clearLayers();

    const currentRoute=state.routes[idx];
    if(!currentRoute)return;
    const route={routeId:currentRoute.routeId,participantId:currentRoute.participantId,points:[...(currentRoute.points||[])]};

    const pts=route.points.map(id=>state.points[id]).filter(p=>p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon)));
    if(pts.length<2)return;

    const latlngs=pts.map(p=>[Number(p.lat),Number(p.lon)]);
    L.polyline(latlngs,{color:"#ff3ecf",weight:4,opacity:.9}).addTo(step3RouteLines);

    pts.forEach((p,i)=>{
        const icon=L.divIcon({
            html:`<div class="${iconClassForType(p.type)}">${p.type==="BALIZA"?String(i).padStart(2,"0"):""}</div>`,
            className:"",
            iconSize:[22,22],
            iconAnchor:[11,11]
        });
        L.marker([Number(p.lat),Number(p.lon)],{icon})
            .bindTooltip(`${i+1}. ${p.id}`,{permanent:true,direction:"right",className:"marker-label"})
            .bindPopup(`<b>${escapeHtml(p.id)}</b><br>${escapeHtml(p.desc||"")}<br>${escapeHtml(p.utm||"")}`)
            .addTo(step3RouteMarkers);
    });

    // Usa exactamente la misma ventana geográfica que los planos PDF.
    // De esta forma, al pulsar "VER EN PLANO" se ve el recorrido dentro del
    // borde real de impresión (escala y centro manual/automático incluidos).
    const printGeometry=typeof getPlanPdfPreviewGeometry==="function"?getPlanPdfPreviewGeometry():null;
    let targetBounds=L.latLngBounds(latlngs);
    if(printGeometry&&printGeometry.bounds){
        const b=printGeometry.bounds;
        const printBounds=L.latLngBounds([[b.south,b.west],[b.north,b.east]]);
        L.rectangle(printBounds,{
            color:"#e7c46f",
            weight:3,
            opacity:.96,
            fillColor:"#e7c46f",
            fillOpacity:.035,
            dashArray:"12 8",
            interactive:false
        }).addTo(step3RouteLines);
        targetBounds=printBounds;
    }

    const applyPrintFit=()=>{
        if(!step3RouteMap)return;
        step3RouteMap.invalidateSize();
        step3RouteMap.fitBounds(targetBounds,{padding:[14,14],animate:false});
    };
    requestAnimationFrame(()=>requestAnimationFrame(applyPrintFit));
    setTimeout(applyPrintFit,180);
}

function drawRoute(idx){
    if(!routeLayer||!map)return;
    routeLayer.clearLayers();
    const route=state.routes[idx],pts=route.points.map(id=>state.points[id]).filter(p=>p&&p.lat!==null);
    if(pts.length<2)return;
    const latlngs=pts.map(p=>[p.lat,p.lon]);
    L.polyline(latlngs,{color:"#ff3ecf",weight:4,opacity:.85}).addTo(routeLayer);
    map.fitBounds(latlngs,{padding:[40,40]});
}
function updateRouteCountInfo(){const el=document.getElementById("routeCountInfo");if(!el)return;const unique=Math.max(1,Math.min(state.participantCount||1,state.uniqueRouteCount||state.maxUniqueRoutes||15));el.textContent=`${state.participantCount} participantes · hasta ${unique} recorridos únicos`}
function importTextPoints(){const raw=document.getElementById("importText").value.trim();if(!raw)return;const lines=raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);let count=0;lines.forEach(line=>{const parts=line.split(/[,;]/).map(x=>x.trim());if(parts.length<2)return;const id=parts[0].toUpperCase(),utm=parts[1].toUpperCase(),desc=parts.slice(2).join(" ")||id;if(!state.points[id])return;const ll=utmToLatLon(utm);if(!ll)return;Object.assign(state.points[id],{utm:normalizeUtm(utm),lat:ll.lat,lon:ll.lon,desc});count++});renderPointsTable();renderMapMarkers();saveState();toast(`${count} puntos importados`)}function exportPointsCsv(){const rows=[["ID","TIPO","UTM"]];Object.values(state.points).forEach(p=>rows.push([p.id,p.type,p.utm||""]));downloadText("balizas_orientacion.csv",rows.map(r=>r.map(csvEscape).join(",")).join("\n"))}
function normalizeImportPointId(value){
    let s=String(value||"").trim().toUpperCase();
    s=s.replace(/^\s*(PUNTO|POINT|BALIZA|CONTROL|CTRL|WP|WPT)\s*[-_: ]\s*/i,"").trim().toUpperCase();
    if(s==="SALIDA")s="START";
    if(s==="LLEGADA"||s==="META")s="FINISH";
    const b=s.match(/\bB\s*0*([0-9]{1,3})\b/);
    if(b)return "B"+String(Number(b[1])).padStart(2,"0");
    const exact=s.match(/\b(START|FINISH|B[0-9]{2,3})\b/);
    return exact?exact[1]:"";
}
function extractTextTag(block,tag){
    const m=String(block||"").match(new RegExp("<"+tag+"[^>]*>([\\s\\S]*?)<\\/"+tag+">","i"));
    return m?String(m[1]||"").replace(/<!\[CDATA\[|\]\]>/g,"").trim():"";
}

function extractAtakAttribute(block, attr){
    const m=String(block||"").match(new RegExp("\\b"+attr+"=[\"']([^\"']+)[\"']","i"));
    return m?String(m[1]||"").trim():"";
}

function parseAtakGpxWaypoints(txt){
    const out=[];
    const wptRegex=/<wpt\b([^>]*)>([\s\S]*?)<\/wpt>/gi;
    let m;
    while((m=wptRegex.exec(txt))){
        const attrs=m[1]||"";
        const body=m[2]||"";
        const latM=attrs.match(/\blat=["']([^"']+)["']/i);
        const lonM=attrs.match(/\blon=["']([^"']+)["']/i);
        const lat=latM?Number(latM[1]):NaN;
        const lon=lonM?Number(lonM[1]):NaN;

        // ATAK puede guardar el identificador en <name>, <desc>, <cmt>,
        // o dentro de extensiones COT como callsign, title o remarks.
        const name=extractTextTag(body,"name");
        const desc=extractTextTag(body,"desc")||extractTextTag(body,"cmt");
        const callsign=extractAtakAttribute(body,"callsign");
        const title=extractAtakAttribute(body,"title");
        const remarks=extractAtakAttribute(body,"remarks");
        const rawId=name||callsign||title||desc||remarks;

        const id=normalizeImportPointId(rawId);
        if(Number.isFinite(lat)&&Number.isFinite(lon)){
            out.push({id,lat,lon,name,desc,callsign,title,remarks});
        }
    }
    return out;
}
function applyImportedPointById(item){
    const id=normalizeImportPointId(item.id||item.name||item.desc);
    if(!id||!state.points[id])return false;
    const p=state.points[id];
    p.lat=item.lat;
    p.lon=item.lon;
    p.utm=latLonToUtm(item.lat,item.lon);
    p.desc=p.id;
    p.elevation=null;
    return true;
}
function finishAtakImport(imported,total,unmatched){
    renderPointSelectors();
    renderPointsTable();
    renderMapMarkers();
    renderIofDescriptionsEditor();
    updateParticipantSelect();
    updateRouteCountInfo();
    setTimeout(()=>{if(map){map.invalidateSize();fitAllPoints()}},180);
    saveState();
    const msg=`GPX ATAK importado: ${imported}/${total} puntos actualizados${unmatched?` · ${unmatched} sin ID válido`:``}`;
    toast(msg);
    if(typeof setRestoreStatus==="function")setRestoreStatus(msg,imported?"ok":"warn");
}
function importAtakGpxById(event){
    const file=event.target.files&&event.target.files[0];
    if(!file)return;
    const reader=new FileReader();
    reader.onload=()=>{
        const txt=String(reader.result||"");
        const waypoints=parseAtakGpxWaypoints(txt);
        let imported=0;
        let unmatched=0;
        waypoints.forEach(w=>{
            if(applyImportedPointById(w))imported++;
            else unmatched++;
        });
        finishAtakImport(imported,waypoints.length,unmatched);
        event.target.value="";
    };
    reader.readAsText(file);
}
function importGpxKmlFile(event){
    const file=event.target.files&&event.target.files[0];
    if(!file)return;
    const reader=new FileReader();
    reader.onload=()=>{
        const txt=String(reader.result||"");
        let found=parseAtakGpxWaypoints(txt);
        if(!found.length){
            const kmlRegex=/<Placemark[\s\S]*?<\/Placemark>/gi;
            const blocks=txt.match(kmlRegex)||[];
            found=blocks.map(block=>{
                const name=extractTextTag(block,"name");
                const desc=extractTextTag(block,"description");
                const cm=block.match(/<coordinates>([^<]+)<\/coordinates>/i);
                if(!cm)return null;
                const parts=cm[1].trim().split(/[,\s]+/).map(Number);
                const lon=parts[0],lat=parts[1];
                return Number.isFinite(lat)&&Number.isFinite(lon)?{id:normalizeImportPointId(name||desc),lat,lon,name,desc}:null;
            }).filter(Boolean);
        }
        let imported=0,unmatched=0;
        found.forEach(w=>{if(applyImportedPointById(w))imported++;else unmatched++;});
        finishAtakImport(imported,found.length,unmatched);
        event.target.value="";
    };
    reader.readAsText(file);
}

function ensureParticipantNamesStore(){
    if(!state.participantNames || typeof state.participantNames!=="object" || Array.isArray(state.participantNames))state.participantNames={};
    return state.participantNames;
}

function participantName(pid){
    ensureParticipantNamesStore();
    return String(state.participantNames[pid]||"").trim();
}

function participantDisplay(pid,routeId=""){
    const name=participantName(pid);
    const route=routeId?` · ${routeId}`:"";
    return name?`${pid} · ${name}${route}`:`${pid}${route}`;
}

/* MILITOPO LIVE · contexto seguro para el módulo de seguimiento en vivo */
window.MILITOPO_LIVE_GET_ORGANIZER_CONTEXT=function(){
    const allRoutes=Array.isArray(state.routes)?state.routes:[];
    const activeRouteList=(typeof activeRoutes==="function"?activeRoutes():allRoutes);
    const routes=activeRouteList.map(route=>{
        const participantId=String(route?.participantId||"");
        const flow=(typeof getStartFlowStatus==="function"?getStartFlowStatus(route):{})||{};
        const imported=(state.importedResults||[]).find(result=>String(result?.participantId||"")===participantId&&!isResultForSkippedRoute(result))||null;
        const finished=!!imported||!!flow.finishQrDeliveredAt;
        const started=finished||!!flow.startQrDeliveredAt;
        const scans=Array.isArray(imported?.scans)?imported.scans:[];
        return{
            participantId,
            participantName:participantName(participantId),
            routeId:String(route?.routeId||""),
            totalControls:(route?.points||[]).filter(id=>id!=="START"&&id!=="FINISH").length,
            completedControls:scans.filter(scan=>String(scan?.status||scan?.st||"")==="correct").length,
            discardedControls:scans.filter(scan=>String(scan?.status||scan?.st||"")==="skipped").length,
            localStatus:finished?"finished":started?"racing":"not_started",
            startTime:imported?.startTime||flow.startQrDeliveredAt||null,
            finishTime:imported?.finishTime||flow.finishQrDeliveredAt||null,
            resultImported:!!imported,
            resultCode:String(imported?.raw||"")
        };
    }).filter(route=>route.participantId);
    return{
        eventId:String(state.eventId||""),
        eventName:String(state.eventName||"ENTRENAMIENTO ORIENTACIÓN"),
        routes,
        allParticipantIds:allRoutes.map(route=>String(route?.participantId||"")).filter(Boolean),
        discardedParticipantIds:allRoutes.filter(route=>typeof isRouteSkipped==="function"&&isRouteSkipped(route)).map(route=>String(route?.participantId||"")).filter(Boolean),
        currentStep:Number(currentAppStep||1),
        liveRunId:String(state.raceDataProtection?.runId||""),
        raceDataProtected:state.raceDataProtection?.protected===true
    };
};

function refreshLiveOrganizerContext(){
    try{
        if(typeof window.MILITOPO_LIVE_REFRESH_ORGANIZER_CONTEXT==="function"){
            queueMicrotask(()=>{try{window.MILITOPO_LIVE_REFRESH_ORGANIZER_CONTEXT()}catch(_){}});
        }
    }catch(_){ }
}

function setParticipantName(pid,name){
    if(!pid)return;
    ensureParticipantNamesStore();
    const clean=String(name||"").trim().replace(/\s+/g," ");
    if(clean)state.participantNames[pid]=clean;
    else delete state.participantNames[pid];
    (state.importedResults||[]).forEach(r=>{if(r.participantId===pid)r.participantName=clean;});
    saveState();
    updateOrganizerParticipantSelects({keepQr:true});
    renderResultsControl();
    refreshLiveOrganizerContext();
}

function createParticipantNameField(id,labelText,onSave){
    const wrap=document.createElement("div");
    wrap.className="participant-name-field";
    wrap.style.cssText="margin-top:10px;padding:10px;border:1px solid rgba(240,193,106,.35);border-radius:14px;background:rgba(255,255,255,.05);";
    wrap.innerHTML=`<label style="display:block;margin-bottom:6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#f0c16a;">${labelText}</label><input id="${id}" type="text" placeholder="Nombre y apellidos" autocomplete="off" autocapitalize="words" spellcheck="false" style="width:100%;">`;
    const input=wrap.querySelector("input");
    const save=()=>onSave(input.value);
    input.addEventListener("change",save);
    input.addEventListener("blur",save);
    input.addEventListener("keydown",ev=>{
        if(ev.key==="Enter"){ev.preventDefault();input.blur();}
    });
    return wrap;
}

function ensureParticipantNameUi(){
    const startSel=document.getElementById("startFlowParticipantSelect");
    if(startSel && !document.getElementById("startParticipantNameInput")){
        const field=createParticipantNameField("startParticipantNameInput","Nombre del participante",value=>{
            const pid=document.getElementById("startFlowParticipantSelect")?.value;
            if(pid)setParticipantName(pid,value);
        });
        startSel.insertAdjacentElement("afterend",field);
    }

    const oldFinishField=document.getElementById("finishParticipantNameInput")?.closest(".participant-name-field");
    if(oldFinishField)oldFinishField.remove();

    refreshParticipantNameInputs();
    ensureRouteDiscardUi();
}

function refreshParticipantNameInputs(){
    ensureParticipantNamesStore();
    const startSel=document.getElementById("startFlowParticipantSelect");
    const startInput=document.getElementById("startParticipantNameInput");
    if(startSel&&startInput&&document.activeElement!==startInput&&startInput.value!==participantName(startSel.value))startInput.value=participantName(startSel.value);
}

function saveStartParticipantNameNow(){
    const sel=document.getElementById("startFlowParticipantSelect");
    const input=document.getElementById("startParticipantNameInput");
    if(sel&&input)setParticipantName(sel.value,input.value);
}

function ensureStartFlowStatusStore(){
    if(!state.startFlowStatus || typeof state.startFlowStatus!=="object" || Array.isArray(state.startFlowStatus))state.startFlowStatus={};
    return state.startFlowStatus;
}

function startFlowStatusKey(routeOrPid,routeId=""){
    return routeAssignmentKey(routeOrPid,routeId);
}

function getStartFlowStatus(routeOrPid,routeId=""){
    const store=ensureStartFlowStatusStore();
    const key=startFlowStatusKey(routeOrPid,routeId);
    return store[key]||{};
}

function markStartFlowStatus(pid,field){
    const route=getRouteByParticipant(pid);
    if(!route)return null;
    const store=ensureStartFlowStatusStore();
    const key=startFlowStatusKey(route);
    const current=store[key]||{participantId:route.participantId,routeId:route.routeId};
    current.participantId=route.participantId;
    current.routeId=route.routeId;
    current.updatedAt=new Date().toISOString();
    if(field==="prepared"&&!current.preparedAt)current.preparedAt=current.updatedAt;
    if(field==="participantQr"&&!current.participantQrShownAt)current.participantQrShownAt=current.updatedAt;
    if(field==="startQr"&&!current.startQrShownAt)current.startQrShownAt=current.updatedAt;
    if(field==="startDelivered"){
        if(!current.startQrShownAt)current.startQrShownAt=current.updatedAt;
        current.startQrDeliveredAt=current.updatedAt;
    }
    if(field==="finishQr"&&!current.finishQrShownAt)current.finishQrShownAt=current.updatedAt;
    if(field==="finishDelivered"){
        if(!current.finishQrShownAt)current.finishQrShownAt=current.updatedAt;
        current.finishQrDeliveredAt=current.updatedAt;
    }
    store[key]=current;
    if(field==="startDelivered"||field==="finishDelivered")window.MILITOPO_PROTECT_RACE_DATA?.({status:field==="finishDelivered"?"closing":"active",startedAt:current.startQrDeliveredAt||current.updatedAt,lastDataAt:current.updatedAt});
    saveState();
    if(typeof updateOrganizerParticipantSelects==="function")updateOrganizerParticipantSelects({keepQr:true});
    renderStartFlowStatusPanel();
    refreshLiveOrganizerContext();
    return current;
}

function cleanupStartFlowStatusStore(){
    const store=ensureStartFlowStatusStore();
    const valid=new Set((state.routes||[]).map(r=>startFlowStatusKey(r)));
    Object.keys(store).forEach(k=>{if(!valid.has(k))delete store[k]});
}

function routeHasImportedResult(route){
    ensureImportedResultsStore();
    const participantId=String(route?.participantId||"");
    if(!participantId)return false;
    // Con recorridos compartidos (R01, R02, etc.), el estado debe pertenecer
    // siempre al participante concreto. Usar routeId aquí hacía que el resultado
    // de P01 marcara también como finalizados a P16, P31... con el mismo recorrido.
    return (state.importedResults||[]).some(result=>
        !isResultForSkippedRoute(result) &&
        String(result?.participantId||"")===participantId
    );
}

function startFlowStatusForRoute(route){
    if(isRouteSkipped(route))return {stage:"discarded",cls:"bad",icon:"🚫",label:"Descartado",hint:"No se entrega ni cuenta en resultados"};
    const st=getStartFlowStatus(route);
    if(routeHasImportedResult(route)||st.liveResultReceived===true||!!String(st.liveResultCode||"").trim())return {stage:"result",cls:"ok",icon:"📥",label:"Finalizados con resultado",hint:"Resultado recibido en directo o importado"};
    if(st.finishQrDeliveredAt)return {stage:"finished",cls:"ok",icon:"🏁",label:"Finalizados",hint:"QR llegada entregado · esperando QR final de resultado"};
    if(st.startQrDeliveredAt)return {stage:"race",cls:"ok",icon:"🏃",label:"En carrera",hint:"Salida entregada · llegada pendiente"};
    return {stage:"pending",cls:"pending",icon:"⏳",label:"Pendientes",hint:"Aún sin salida entregada"};
}

window.MILITOPO_LIVE_SYNC_STARTFLOW_STATUS=function(participantId,status,extra={}){
    try{
        const route=getRouteByParticipant(String(participantId||""));
        if(!route)return false;
        const store=ensureStartFlowStatusStore();
        const key=startFlowStatusKey(route);
        const current=store[key]||{participantId:route.participantId,routeId:route.routeId};
        const now=new Date().toISOString();
        const payload=extra&&typeof extra==="object"?extra:{};
        const liveResultReceived=payload.resultImported===true||!!String(payload.resultCode||"").trim();
        window.MILITOPO_TOUCH_RACE_DATA?.({status:String(status||"active"),lastDataAt:now});
        let changed=false;
        if(status==="racing"){
            if(!current.startQrShownAt){current.startQrShownAt=now;changed=true;}
            if(!current.startQrDeliveredAt){current.startQrDeliveredAt=now;changed=true;}
        }
        if(status==="finished"){
            if(!current.startQrShownAt){current.startQrShownAt=now;changed=true;}
            if(!current.startQrDeliveredAt){current.startQrDeliveredAt=now;changed=true;}
            if(!current.finishQrShownAt){current.finishQrShownAt=now;changed=true;}
            if(!current.finishQrDeliveredAt){current.finishQrDeliveredAt=now;changed=true;}
        }
        if(payload.startTime && !current.startQrDeliveredAt){current.startQrDeliveredAt=payload.startTime;changed=true;}
        if(payload.finishTime && !current.finishQrDeliveredAt){current.finishQrDeliveredAt=payload.finishTime;changed=true;}
        if(liveResultReceived){
            if(current.liveResultReceived!==true){current.liveResultReceived=true;changed=true;}
            const nextCode=String(payload.resultCode||"").trim();
            if(nextCode && current.liveResultCode!==nextCode){current.liveResultCode=nextCode;changed=true;}
            if(!current.liveResultReceivedAt){current.liveResultReceivedAt=now;changed=true;}
        }
        if(!changed)return true;
        current.updatedAt=now;
        store[key]=current;
        saveState();
        renderStartFlowStatusPanel();
        if(typeof updateOrganizerParticipantSelects==="function")updateOrganizerParticipantSelects({keepQr:true});
        try{
            if(typeof renderStep5RoutePicker==="function"){
                renderStep5RoutePicker("start");
                renderStep5RoutePicker("finish");
            }
        }catch(_){ }
        return true;
    }catch(_){return false;}
};

function setFinishOrganizedPanelOpen(open){
    const panel=document.getElementById("finishOrganizedBlock");
    const button=document.getElementById("toggleFinishOrganizedBtn");
    const grid=document.getElementById("organizerFlowGrid");
    if(!panel||!button)return;

    const isOpen=Boolean(open);
    panel.style.display=isOpen?"block":"none";
    button.textContent=isOpen?"OCULTAR LLEGADA ORGANIZADA":"🏁 ABRIR LLEGADA ORGANIZADA";
    button.className=isOpen?"btn red":"btn secondary";
    button.style.width="100%";
    button.style.minHeight="54px";
    button.setAttribute("aria-expanded",isOpen?"true":"false");
    if(grid)grid.style.gridTemplateColumns=isOpen?"":"1fr";

    if(!isOpen&&typeof stopStep5ResultQrCamera==="function"){
        try{stopStep5ResultQrCamera()}catch(_){ }
    }
}

function toggleFinishOrganizedPanel(){
    const panel=document.getElementById("finishOrganizedBlock");
    if(!panel)return;
    setFinishOrganizedPanelOpen(panel.style.display==="none"||getComputedStyle(panel).display==="none");
}

function ensureStep5FlowVisualStyles(){
    if(document.getElementById("step5FlowVisualStyles"))return;
    const style=document.createElement("style");
    style.id="step5FlowVisualStyles";
    style.textContent=`
.step5-status-panel{margin-top:16px;border-radius:24px;border:1.8px solid rgba(240,193,106,.42);background:linear-gradient(180deg,rgba(38,58,25,.74),rgba(7,16,8,.42));padding:14px;overflow:hidden;box-shadow:0 18px 44px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.06)}
.step5-status-title{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px;color:#f0c16a;font-weight:900;letter-spacing:.08em;text-transform:uppercase;font-size:.86rem;line-height:1.25}
.step5-status-title-main{display:block;font-size:1.02rem;color:#ffe3a0;letter-spacing:.10em}.step5-status-title-sub{display:block;margin-top:5px;color:#f5e6c8;font-size:.72rem;letter-spacing:.03em;text-transform:none;line-height:1.35;font-weight:800;opacity:.92}.step5-status-active-pill{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;border:1px solid rgba(139,181,106,.55);background:rgba(139,181,106,.18);color:#f7ffe9;padding:8px 11px;font-size:.78rem;line-height:1.15;white-space:normal;text-align:center}
.step5-status-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:9px;margin-bottom:12px}.step5-status-summary span{border-radius:999px;padding:6px 9px;background:rgba(255,255,255,.07);border:1px solid rgba(230,188,122,.18);font-size:.72rem;font-weight:900;color:#f5e6c8;line-height:1.15}.step5-status-summary-clear > span{display:none}.step5-count-card{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:9px;border-radius:18px;padding:10px 12px;background:rgba(0,0,0,.20);border:1.3px solid rgba(230,188,122,.25);min-height:58px}.step5-count-card .ico{font-size:1.55rem;line-height:1}.step5-count-card b{display:block;color:#f5e6c8;font-size:.82rem;line-height:1.15;letter-spacing:.035em}.step5-count-card small{display:block;color:#cbb894;font-size:.66rem;line-height:1.2;margin-top:3px}.step5-count-card em{font-style:normal;color:#ffe3a0;font-size:1.55rem;font-weight:900;line-height:1}.step5-count-card.race{border-color:rgba(93,168,255,.42);background:rgba(65,130,205,.14)}.step5-count-card.finished,.step5-count-card.result{border-color:rgba(139,181,106,.48);background:rgba(139,181,106,.12)}.step5-count-card.discarded{border-color:rgba(200,94,69,.50);background:rgba(200,94,69,.12)}
.step5-status-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:9px;margin-top:10px}.step5-status-list-title{margin:4px 0 8px;color:#ffe3a0;font-weight:900;letter-spacing:.08em;text-transform:uppercase;font-size:.76rem}
.step5-status-card{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:center;border-radius:18px;padding:11px;background:rgba(0,0,0,.17);border:1.4px solid rgba(230,188,122,.24);overflow:hidden}
.step5-status-card.ok{border-color:rgba(139,181,106,.55);background:rgba(139,181,106,.11)}
.step5-status-card.warn{border-color:rgba(230,188,122,.60);background:rgba(230,188,122,.09)}
.step5-status-card.bad{border-color:rgba(200,94,69,.60);background:rgba(200,94,69,.11)}
.step5-status-card.pending{border-color:rgba(230,188,122,.22)}
.step5-status-icon{width:34px;height:34px;border-radius:999px;display:grid;place-items:center;background:rgba(255,255,255,.08);font-weight:900;flex:none}
.step5-status-main{min-width:0}.step5-status-main b,.step5-status-main small{display:block;white-space:normal;overflow-wrap:anywhere;word-break:normal;line-height:1.25}
.step5-status-main b{color:#f5e6c8;font-size:.88rem}.step5-status-main small{color:#cbb894;font-size:.72rem;margin-top:2px}
.organizer-step-buttons .btn{min-height:54px}.step5-confirm-panel{border-width:1.5px!important}
.step5-confirm-actions{display:grid;grid-template-columns:1fr;gap:8px;margin-top:8px}.step5-confirm-actions .btn{width:100%;min-height:52px}.step5-confirm-small{display:block;margin-top:6px;color:#cbb894;font-size:.78rem;line-height:1.25}
#discardStartRouteBtn{min-height:48px}#discardedRoutesInfo{line-height:1.35}
@media(max-width:760px){.organizer-flow-grid{grid-template-columns:1fr!important}.step5-status-grid{grid-template-columns:1fr}.step5-status-panel{padding:12px}.step5-status-title{font-size:.76rem}.step5-status-title-main{font-size:.94rem}.step5-status-summary{grid-template-columns:1fr}.step5-count-card{min-height:62px}.step5-count-card b{font-size:.82rem}.step5-count-card small{font-size:.66rem}.organizer-flow-grid .block{padding:14px}.organizer-step-buttons{gap:8px!important}.organizer-qr-box img{max-width:88vw!important}.step5-confirm-actions .btn{font-size:.9rem}}`
    document.head.appendChild(style);
}

function ensureStartFlowStatusPanel(){
    ensureStep5FlowVisualStyles();
    let panel=document.getElementById("startFlowStatusPanel");
    if(panel)return panel;
    const payload=document.getElementById("organizerStartPayload");
    const block=payload?.closest(".block")||document.getElementById("organizerQrSequenceBlock");
    if(!block)return null;
    panel=document.createElement("div");
    panel.id="startFlowStatusPanel";
    panel.className="step5-status-panel";
    if(payload)payload.insertAdjacentElement("afterend",panel);
    else block.appendChild(panel);
    return panel;
}

function renderStartFlowStatusPanel(){
    const panel=ensureStartFlowStatusPanel();
    if(!panel)return;
    cleanupStartFlowStatusStore();
    const routes=state.routes||[];
    if(!routes.length){
        panel.innerHTML=`<div class="step5-status-title"><span class="step5-status-title-main">Estado de salidas y participantes</span></div><div class="status warn">Genera recorridos para ver el estado.</div>`;
        return;
    }
    const counts={pending:0,race:0,finished:0,result:0,discarded:0};
    const cards=routes.map(route=>{
        const st=startFlowStatusForRoute(route);
        if(counts[st.stage]!==undefined)counts[st.stage]++;
        else counts.pending++;
        const name=resultParticipantName(route.participantId);
        const title=name?`${route.participantId} · ${route.routeId||""} · ${name}`:`${route.participantId} · ${route.routeId||""}`;
        const cleanIcons={pending:"⏳",race:"🏃",finished:"🏁",result:"📥",discarded:"🚫"};
        const cleanLabels={pending:"Pendientes",race:"En carrera",finished:"Finalizados",result:"Finalizados con resultado",discarded:"Descartado"};
        const icon=cleanIcons[st.stage]||"⏳";
        const label=cleanLabels[st.stage]||"Pendientes";
        return `<div class="step5-status-card ${st.cls}"><div class="step5-status-icon">${icon}</div><div class="step5-status-main"><b>${escapeHtml(title)}</b><small>${escapeHtml(label)} · ${escapeHtml(st.hint)}</small></div></div>`;
    }).join("");
    const activeCount=activeRoutes().length;
    const totalCount=routes.length;
    const discardedCount=counts.discarded;
    panel.innerHTML=`<div class="step5-status-title">
            <span><span class="step5-status-title-main">Estado de salidas y participantes</span></span>
            <span class="step5-status-active-pill">${activeCount} de ${totalCount} recorridos activos<br><small>${discardedCount} descartado(s) / reserva</small></span>
        </div>
        <div class="step5-status-summary step5-status-summary-clear">
            <div class="step5-count-card pending"><span class="ico">⏳</span><span><b>Pendientes</b><small>Sin salida entregada</small></span><em>${counts.pending}</em></div>
            <div class="step5-count-card race"><span class="ico">🏃</span><span><b>En carrera</b><small>Salida entregada y llegada pendiente</small></span><em>${counts.race}</em></div>
            <div class="step5-count-card finished"><span class="ico">🏁</span><span><b>Finalizados</b><small>Llegada entregada; falta importar resultado</small></span><em>${counts.finished}</em></div>
            <div class="step5-count-card result"><span class="ico">📥</span><span><b>Finalizados con resultado</b><small>Resultado importado del participante al terminar</small></span><em>${counts.result}</em></div>
            <div class="step5-count-card discarded"><span class="ico">🚫</span><span><b>Descartados</b><small>No cuentan en carrera; material queda de reserva</small></span><em>${counts.discarded}</em></div>
        </div>
        <div class="step5-status-list-title">Detalle por participante</div>
        <div class="step5-status-grid">${cards}</div>`;
}
function ensureSkippedRoutesStore(){
    if(!state.skippedRoutes || typeof state.skippedRoutes!=="object" || Array.isArray(state.skippedRoutes))state.skippedRoutes={};
    return state.skippedRoutes;
}

function routeAssignmentKey(routeOrPid,routeId=""){
    let route=null;
    if(routeOrPid && typeof routeOrPid==="object")route=routeOrPid;
    else route=getRouteByParticipant(String(routeOrPid||""));
    const pid=String(route?.participantId||routeOrPid||"");
    const rid=String(route?.routeId||routeId||"");
    return `${pid}__${rid}`;
}

function isRouteSkipped(routeOrPid,routeId=""){
    const skipped=ensureSkippedRoutesStore();
    const route=(routeOrPid && typeof routeOrPid==="object")?routeOrPid:getRouteByParticipant(String(routeOrPid||""));
    if(route && skipped[routeAssignmentKey(route)])return true;
    const pid=String(route?.participantId||routeOrPid||"");
    const rid=String(route?.routeId||routeId||"");
    return Object.values(skipped).some(x=>String(x.participantId||"")===pid && (!rid || String(x.routeId||"")===rid));
}

function activeRoutes(){
    return (state.routes||[]).filter(route=>!isRouteSkipped(route));
}

function skippedRoutesList(){
    ensureSkippedRoutesStore();
    return (state.routes||[]).filter(route=>isRouteSkipped(route));
}

function isResultForSkippedRoute(result){
    if(!result)return false;
    const participantId=String(result.participantId||"");
    let route=null;
    if(participantId){
        route=(state.routes||[]).find(r=>String(r.participantId||"")===participantId)||null;
    }else{
        // Compatibilidad con resultados antiguos sin participantId: solo se usa
        // routeId si identifica de forma inequívoca un único participante.
        const routeId=String(result.routeId||"");
        const matches=(state.routes||[]).filter(r=>String(r.routeId||"")===routeId);
        if(matches.length===1)route=matches[0];
    }
    return route?isRouteSkipped(route):false;
}

function activeImportedResults(){
    ensureImportedResultsStore();
    return (state.importedResults||[]).filter(r=>!isResultForSkippedRoute(r));
}

function setRouteSkipped(pid,skipped=true){
    const route=getRouteByParticipant(pid);
    if(!route)return false;
    const store=ensureSkippedRoutesStore();
    const key=routeAssignmentKey(route);
    if(skipped){
        store[key]={participantId:route.participantId,routeId:route.routeId,discardedAt:new Date().toISOString(),reason:"organizer"};
        // Descartar solo cambia la participación activa. El resultado, track y log
        // se conservan íntegros para poder reactivar o auditar el recorrido.
    }else{
        delete store[key];
    }
    saveState();
    updateOrganizerParticipantSelects();
    renderResultsControl();
    renderImportedResults();
    refreshLiveOrganizerContext();
    return true;
}

function findNextAssignableRouteIndex(fromIndex=organizerStartIndex){
    const routes=state.routes||[];
    if(!routes.length)return -1;
    for(let offset=1;offset<=routes.length;offset++){
        const idx=(fromIndex+offset)%routes.length;
        if(!isRouteSkipped(routes[idx]))return idx;
    }
    return -1;
}

function ensureRouteDiscardUi(){
    ensureStartFlowStatusPanel();
    const nextBtn=document.querySelector('button[onclick="nextStartFlowParticipant()"]');
    let btn=document.getElementById("discardStartRouteBtn");
    if(nextBtn && !btn){
        btn=document.createElement("button");
        btn.id="discardStartRouteBtn";
        btn.className="btn red";
        btn.style.cssText="margin-top:10px;width:100%;";
        nextBtn.insertAdjacentElement("afterend",btn);
    }
    if(btn)btn.onclick=discardCurrentStartRoute;
    const infoAnchor=document.getElementById("startFlowInfo");
    if(infoAnchor && !document.getElementById("discardedRoutesInfo")){
        const div=document.createElement("div");
        div.id="discardedRoutesInfo";
        div.className="status warn";
        div.style.cssText="display:none;margin-top:10px;";
        infoAnchor.insertAdjacentElement("afterend",div);
    }
    updateRouteDiscardUi();
}

function updateRouteDiscardUi(){
    const sel=document.getElementById("startFlowParticipantSelect");
    const btn=document.getElementById("discardStartRouteBtn");
    const info=document.getElementById("discardedRoutesInfo");
    const route=sel&&sel.value?getRouteByParticipant(sel.value):null;
    if(route&&isRouteSkipped(route))setStep5DeliveryConfirmPanel("start",null,"hidden");
    if(btn){
        if(route&&isRouteSkipped(route)){
            btn.textContent="↩️ REACTIVAR ESTE RECORRIDO";
            btn.className="btn green";
        }else{
            btn.textContent="🚫 DESCARTAR / NO ASIGNAR ESTE RECORRIDO";
            btn.className="btn red";
        }
    }
    if(info){
        const skipped=skippedRoutesList();
        if(skipped.length){
            info.style.display="block";
            info.innerHTML=`Recorridos descartados: <b>${skipped.length}</b><br>${skipped.map(r=>escapeHtml(`${r.participantId} · ${r.routeId}`)).join(" · ")}`;
        }else{
            info.style.display="none";
            info.innerHTML="";
        }
    }
    renderStartFlowStatusPanel();
    if(document.getElementById("startFlowParticipantPicker"))renderStep5RoutePicker("start");
    if(document.getElementById("finishFlowParticipantPicker"))renderStep5RoutePicker("finish");
}

function discardCurrentStartRoute(){
    const sel=document.getElementById("startFlowParticipantSelect");
    if(!sel||!sel.value)return toast("Selecciona un recorrido");
    const route=getRouteByParticipant(sel.value);
    if(!route)return toast("No hay recorrido seleccionado");

    if(isRouteSkipped(route)){
        setRouteSkipped(route.participantId,false);
        organizerStartIndex=(state.routes||[]).findIndex(r=>r.participantId===route.participantId);
        const startSel=document.getElementById("startFlowParticipantSelect");
        if(startSel)startSel.value=route.participantId;
        showParticipantQrForStart();
        toast(`Recorrido reactivado: ${route.participantId} · ${route.routeId}`);
        return;
    }

    if(!confirm(`¿Descartar ${route.participantId} · ${route.routeId}?\n\nNo se entregará a nadie, no contará como pendiente y no entrará en resultados.`))return;
    const currentIdx=(state.routes||[]).findIndex(r=>r.participantId===route.participantId);
    setRouteSkipped(route.participantId,true);
    toast(`Recorrido descartado: ${route.participantId} · ${route.routeId}`);

    const nextIdx=findNextAssignableRouteIndex(currentIdx);
    const startSel=document.getElementById("startFlowParticipantSelect");
    if(nextIdx>=0){
        organizerStartIndex=nextIdx;
        if(startSel)startSel.value=state.routes[nextIdx].participantId;
        showParticipantQrForStart();
    }else{
        if(startSel)startSel.value=route.participantId;
        const info=document.getElementById("startFlowInfo");
        const box=document.getElementById("organizerStartQrBox");
        const payloadBox=document.getElementById("organizerStartPayload");
        if(info){info.className="status warn";info.textContent="Todos los recorridos están descartados. Reactiva alguno para poder entregarlo.";}
        if(box)box.innerHTML="QR pendiente";
        if(payloadBox)payloadBox.textContent="";
    }
    updateRouteDiscardUi();
}


function resultParticipantName(resultOrPid){
    const pid=typeof resultOrPid==="string"?resultOrPid:(resultOrPid?.participantId||"");
    const stored=participantName(pid);
    if(stored)return stored;
    if(resultOrPid && typeof resultOrPid==="object")return String(resultOrPid.participantName||"").trim();
    return "";
}

let organizerStartIndex=0;

function step5RouteDropdownStatus(route){
    if(!route)return "⏳ Pendientes";
    if(isRouteSkipped(route))return "🚫 Descartado";
    if(routeHasImportedResult(route))return "📥 Finalizados con resultado";
    const st=getStartFlowStatus(route);
    if(st.finishQrDeliveredAt)return "🏁 Finalizados";
    if(st.startQrDeliveredAt)return "🏃 En carrera";
    return "⏳ Pendientes";
}

function step5RouteDropdownText(route){
    if(!route)return "⏳ Pendientes";
    const name=participantName(route.participantId);
    const identity=name?`${route.participantId} · ${route.routeId||""} · ${name}`:`${route.participantId} · ${route.routeId||""}`;
    return `${identity}\n${step5RouteDropdownStatus(route)}`;
}


function step5RouteIdentityText(route){
    if(!route)return "Sin recorrido";
    const name=participantName(route.participantId);
    return name?`${route.participantId} · ${route.routeId||""} · ${name}`:`${route.participantId} · ${route.routeId||""}`;
}

function ensureStep5RoutePickerStyles(){
    if(document.getElementById("step5RoutePickerStyles"))return;
    const style=document.createElement("style");
    style.id="step5RoutePickerStyles";
    style.textContent=`
.step5-native-hidden{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;opacity:0!important;pointer-events:none!important}
.step5-route-picker{width:100%;margin:8px 0 10px;position:relative}
.step5-route-picker-current,.step5-route-option{width:100%;text-align:left;border-radius:18px;border:1px solid rgba(230,188,122,.42);background:linear-gradient(180deg,rgba(89,61,36,.95),rgba(51,36,25,.96));color:#f5e6c8;font-family:inherit;font-weight:900;padding:13px 14px;box-shadow:inset 0 1px 0 rgba(255,255,255,.07)}
.step5-route-picker-current{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;min-height:64px}
.step5-route-picker-current:after{content:"⌄";grid-column:2;grid-row:1/3;font-size:1.25rem;color:#f0c16a;align-self:center}
.step5-route-picker.open .step5-route-picker-current:after{content:"⌃"}
.step5-route-line{display:block;white-space:normal;overflow-wrap:anywhere;word-break:normal;line-height:1.2;letter-spacing:.045em}
.step5-route-status{display:block;margin-top:5px;color:#f0c16a;white-space:normal;line-height:1.2;letter-spacing:.045em}
.step5-route-menu{display:none;margin-top:8px;max-height:330px;overflow:auto;border-radius:20px;border:1px solid rgba(230,188,122,.32);background:rgba(12,20,10,.98);padding:7px;box-shadow:0 18px 42px rgba(0,0,0,.45);gap:7px}
.step5-route-picker.open .step5-route-menu{display:grid}
.step5-route-option{display:block;margin:0;cursor:pointer;background:rgba(255,255,255,.055);border-color:rgba(230,188,122,.25);box-shadow:none;min-height:62px}
.step5-route-option.selected{border-color:rgba(240,193,106,.85);background:rgba(240,193,106,.13)}
.step5-route-option.discarded{border-color:rgba(200,94,69,.55);background:rgba(200,94,69,.10)}
.step5-route-empty{padding:12px;color:#cbb894;font-weight:900}
@media(max-width:760px){.step5-route-picker-current,.step5-route-option{border-radius:16px;padding:12px 13px}.step5-route-menu{max-height:300px}.step5-route-line{font-size:.92rem}.step5-route-status{font-size:.86rem}}
`;
    document.head.appendChild(style);
}

function step5RoutePickerMeta(kind){
    return kind==="finish"
        ? {selectId:"finishFlowParticipantSelect",pickerId:"finishFlowParticipantPicker",onSelect:()=>renderFinishFlowQr()}
        : {selectId:"startFlowParticipantSelect",pickerId:"startFlowParticipantPicker",onSelect:()=>setStartFlowParticipantFromSelect()};
}

function ensureStep5RoutePickers(){
    ensureStep5RoutePickerStyles();
    ["start","finish"].forEach(kind=>{
        const meta=step5RoutePickerMeta(kind);
        const sel=document.getElementById(meta.selectId);
        if(!sel)return;
        sel.classList.add("step5-native-hidden");
        let picker=document.getElementById(meta.pickerId);
        if(!picker){
            picker=document.createElement("div");
            picker.id=meta.pickerId;
            picker.className="step5-route-picker";
            sel.insertAdjacentElement("beforebegin",picker);
        }
        renderStep5RoutePicker(kind);
    });
}

function toggleStep5RoutePicker(kind){
    const meta=step5RoutePickerMeta(kind);
    const picker=document.getElementById(meta.pickerId);
    if(!picker)return;
    const willOpen=!picker.classList.contains("open");
    document.querySelectorAll(".step5-route-picker.open").forEach(el=>el.classList.remove("open"));
    if(willOpen)picker.classList.add("open");
}

function chooseStep5RouteFromPicker(kind,pid){
    const meta=step5RoutePickerMeta(kind);
    const sel=document.getElementById(meta.selectId);
    if(!sel)return;
    sel.value=pid;
    const picker=document.getElementById(meta.pickerId);
    if(picker)picker.classList.remove("open");
    meta.onSelect();
    renderStep5RoutePicker(kind);
}

function renderStep5RoutePicker(kind){
    const meta=step5RoutePickerMeta(kind);
    const sel=document.getElementById(meta.selectId);
    const picker=document.getElementById(meta.pickerId);
    if(!sel||!picker)return;
    const routes=state.routes||[];
    const selectedRoute=routes.find(r=>String(r.participantId)===String(sel.value))||routes[0]||null;
    picker.innerHTML="";

    const current=document.createElement("button");
    current.type="button";
    current.className="step5-route-picker-current";
    current.onclick=()=>toggleStep5RoutePicker(kind);
    const currentMain=document.createElement("span");
    currentMain.style.minWidth="0";
    const currentIdentity=document.createElement("span");
    currentIdentity.className="step5-route-line";
    currentIdentity.textContent=selectedRoute?step5RouteIdentityText(selectedRoute):"No hay recorridos";
    const currentStatus=document.createElement("span");
    currentStatus.className="step5-route-status";
    currentStatus.textContent=selectedRoute?step5RouteDropdownStatus(selectedRoute):"⏳ Pendientes";
    currentMain.appendChild(currentIdentity);
    currentMain.appendChild(currentStatus);
    current.appendChild(currentMain);
    picker.appendChild(current);

    const menu=document.createElement("div");
    menu.className="step5-route-menu";
    if(!routes.length){
        const empty=document.createElement("div");
        empty.className="step5-route-empty";
        empty.textContent="No hay recorridos generados";
        menu.appendChild(empty);
    }else{
        routes.forEach(route=>{
            const opt=document.createElement("button");
            opt.type="button";
            opt.className="step5-route-option"+(String(route.participantId)===String(sel.value)?" selected":"")+(isRouteSkipped(route)?" discarded":"");
            opt.onclick=()=>chooseStep5RouteFromPicker(kind,route.participantId);
            const identity=document.createElement("span");
            identity.className="step5-route-line";
            identity.textContent=step5RouteIdentityText(route);
            const status=document.createElement("span");
            status.className="step5-route-status";
            status.textContent=step5RouteDropdownStatus(route);
            opt.appendChild(identity);
            opt.appendChild(status);
            menu.appendChild(opt);
        });
    }
    picker.appendChild(menu);
}
function updateOrganizerParticipantSelects(opts={}){
    ensureParticipantNamesStore();
    ensureSkippedRoutesStore();
    const startSel=document.getElementById("startFlowParticipantSelect");
    const finishSel=document.getElementById("finishFlowParticipantSelect");

    const fillRouteSelect=sel=>{
        if(!sel)return;
        const current=sel.value;
        sel.innerHTML="";
        (state.routes||[]).forEach(route=>{
            const opt=document.createElement("option");
            opt.value=route.participantId;
            opt.textContent=step5RouteDropdownText(route);
            if(isRouteSkipped(route))opt.dataset.discarded="1";
            sel.appendChild(opt);
        });
        if(current && [...sel.options].some(o=>o.value===current)) sel.value=current;
    };

    fillRouteSelect(startSel);
    fillRouteSelect(finishSel);

    ensureParticipantNameUi();
    refreshParticipantNameInputs();
    ensureStep5RoutePickers();
    updateRouteDiscardUi();
}

function getRouteByParticipant(pid){
    return state.routes.find(r=>r.participantId===pid);
}

async function renderOrganizerQr(targetBoxId,targetPayloadId,payload,label){
    const box=document.getElementById(targetBoxId);
    const payloadBox=document.getElementById(targetPayloadId);
    if(!box) return;

    // No mostrar visualmente el texto técnico del QR.
    // El payload se sigue usando para generar el QR, pero no se pinta debajo.
    if(payloadBox) payloadBox.textContent="";
    box.innerHTML="Generando QR...";

    if(window.QRCode && typeof QRCode.toDataURL==="function"){
        try{
            const url=await QRCode.toDataURL(payload,{margin:4,width:320,errorCorrectionLevel:"M"});
            box.innerHTML=`<div style="text-align:center;"><img src="${url}" style="width:240px;max-width:100%;border-radius:16px;background:white;padding:10px;"><div style="margin-top:8px;font-weight:900;color:#f0c16a;">${escapeHtml(label||"QR")}</div></div>`;
            return;
        }catch(e){
            console.warn("No se pudo generar QR visual:", e);
        }
    }

    if(typeof makeOfflineQrSvg==="function"){
        const svg=makeOfflineQrSvg(payload,label||"QR");
        const dataUrl="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
        box.innerHTML=`<div style="text-align:center;"><img src="${dataUrl}" style="width:240px;max-width:100%;border-radius:16px;background:white;padding:10px;"><div style="margin-top:8px;font-weight:900;color:#f0c16a;">${escapeHtml(label||"QR")}</div></div>`;
        return;
    }

    box.innerHTML=`<div class="status warn" style="word-break:break-all;">No hay generador QR visual disponible.<br><br><b>${escapeHtml(label||"QR")}</b><br>${escapeHtml(payload)}</div>`;
}

function ensureStep5DeliveryConfirmPanelElement(kind){
    const id=kind==="finish"?"finishQrDeliveryConfirmPanel":"startQrDeliveryConfirmPanel";
    let panel=document.getElementById(id);
    if(panel)return panel;
    const qrBox=document.getElementById(kind==="finish"?"organizerFinishQrBox":"organizerStartQrBox");
    if(!qrBox)return null;
    panel=document.createElement("div");
    panel.id=id;
    panel.className="status warn";
    panel.style.cssText="display:block;margin-top:10px;";
    qrBox.insertAdjacentElement("afterend",panel);
    return panel;
}

function setStep5DeliveryConfirmPanel(kind,route=null,mode="idle"){
    const panel=ensureStep5DeliveryConfirmPanelElement(kind);
    if(!panel)return;
    const isFinish=kind==="finish";
    const idleText=isFinish
        ? "🏁 QR LLEGADA pendiente de mostrar."
        : "2️⃣ QR SALIDA pendiente de mostrar.";
    panel.style.display="block";
    if(!route){
        panel.className="status warn step5-confirm-panel";
        panel.innerHTML=`${idleText}<span class="step5-confirm-small">Cuando lo muestres y el participante lo escanee/reciba, se podrá confirmar aquí. Mostrarlo en pantalla no cuenta como entregado.</span>`;
        return;
    }
    const st=getStartFlowStatus(route);
    const delivered=isFinish?!!st.finishQrDeliveredAt:!!st.startQrDeliveredAt;
    const shown=isFinish?!!st.finishQrShownAt:!!st.startQrShownAt;
    panel.className=(delivered?"status ok":"status warn")+" step5-confirm-panel";
    if(delivered){
        panel.innerHTML=`✅ ${isFinish?"QR de llegada":"QR de salida"} entregado confirmado<br><b>${escapeHtml(participantDisplay(route.participantId,route.routeId))}</b><span class="step5-confirm-small">El estado ya está contado como confirmado.</span>`;
        return;
    }
    if(isFinish&&!st.startQrDeliveredAt){
        panel.className="status warn step5-confirm-panel";
        panel.innerHTML=`🏁 QR LLEGADA ${shown?"mostrado":"pendiente de mostrar"}<br><b>${escapeHtml(participantDisplay(route.participantId,route.routeId))}</b><span class="step5-confirm-small">Este participante sigue pendiente porque todavía no has confirmado el QR de salida entregado. Primero confirma la salida; seleccionar llegada no lo pone en carrera.</span>`;
        return;
    }
    const btnLabel=isFinish?"✅ CONFIRMAR QR LLEGADA ENTREGADO":"✅ CONFIRMAR QR SALIDA ENTREGADO";
    const fn=isFinish?"confirmFinishQrDelivered()":"confirmStartQrDelivered()";
    const intro=shown
        ? `QR ${isFinish?"LLEGADA":"SALIDA"} mostrado<br><b>${escapeHtml(participantDisplay(route.participantId,route.routeId))}</b><span class="step5-confirm-small">Falta confirmar que lo ha escaneado o recibido.</span>`
        : `${isFinish?"🏁 QR LLEGADA":"2️⃣ QR SALIDA"} pendiente de mostrar<br><b>${escapeHtml(participantDisplay(route.participantId,route.routeId))}</b>`;
    panel.innerHTML=`${intro}<div class="step5-confirm-actions"><button class="btn green" onclick="${fn}">${btnLabel}</button></div><span class="step5-confirm-small">Pulsa solo cuando el QR se haya entregado de verdad. Mostrarlo en pantalla no cuenta.</span>${shown?"":'<span class="step5-confirm-small">Primero muestra el QR correspondiente.</span>'}`;
}

function hideStep5DeliveryConfirmPanels(){
    setStep5DeliveryConfirmPanel("start",null,"idle");
    setStep5DeliveryConfirmPanel("finish",null,"idle");
}

function confirmStartQrDelivered(){
    const sel=document.getElementById("startFlowParticipantSelect");
    if(!sel||!sel.value)return toast("Selecciona participante");
    const route=getRouteByParticipant(sel.value);
    if(!route)return toast("No hay recorrido seleccionado");
    if(isRouteSkipped(route))return toast("Este recorrido está descartado");
    const st=getStartFlowStatus(route);
    if(!st.startQrShownAt)return toast("Primero muestra el QR de salida");
    markStartFlowStatus(route.participantId,"startDelivered");
    setStep5DeliveryConfirmPanel("start",route,"start");
    updateRouteDiscardUi();
    renderStartFlowStatusPanel();
    const info=document.getElementById("startFlowInfo");
    if(info){info.className="status ok";info.innerHTML=`✅ QR de SALIDA entregado confirmado para <b>${escapeHtml(participantDisplay(route.participantId,route.routeId))}</b>.`}
    toast("Salida confirmada: "+route.participantId);
}

function confirmFinishQrDelivered(){
    const sel=document.getElementById("finishFlowParticipantSelect");
    if(!sel||!sel.value)return toast("Selecciona participante");
    const route=getRouteByParticipant(sel.value);
    if(!route)return toast("No hay recorrido seleccionado");
    if(isRouteSkipped(route))return toast("Este recorrido está descartado");
    const st=getStartFlowStatus(route);
    if(!st.startQrDeliveredAt)return toast("Primero confirma el QR de salida entregado");
    if(!st.finishQrShownAt)return toast("Primero muestra el QR de llegada");
    markStartFlowStatus(route.participantId,"finishDelivered");
    setStep5DeliveryConfirmPanel("finish",route,"finish");
    updateRouteDiscardUi();
    renderStartFlowStatusPanel();
    const info=document.getElementById("finishFlowInfo");
    if(info){info.className="status ok";info.innerHTML=`✅ QR de LLEGADA entregado confirmado para <b>${escapeHtml(participantDisplay(route.participantId,route.routeId))}</b>. Ahora espera el QR final de resultado del participante.`}
    toast("Llegada confirmada: "+route.participantId);
}

function prepareStartFlow(){
    updateOrganizerParticipantSelects();
    hideStep5DeliveryConfirmPanels();

    const sel=document.getElementById("startFlowParticipantSelect");
    if(!sel || !sel.options.length){
        const info=document.getElementById("startFlowInfo");
        if(info){
            info.className="status err";
            info.textContent="No hay recorridos generados.";
        }
        hideStep5DeliveryConfirmPanels();
        renderStartFlowStatusPanel();
        return;
    }

    const routes=state.routes||[];
    if(!activeRoutes().length){
        const info=document.getElementById("startFlowInfo");
        const box=document.getElementById("organizerStartQrBox");
        const payloadBox=document.getElementById("organizerStartPayload");
        if(info){info.className="status warn";info.textContent="Todos los recorridos están descartados. Reactiva alguno para poder entregarlo.";}
        if(box)box.innerHTML="QR pendiente";
        if(payloadBox)payloadBox.textContent="";
        hideStep5DeliveryConfirmPanels();
        updateRouteDiscardUi();
        renderStartFlowStatusPanel();
        return;
    }
    organizerStartIndex=Math.min(organizerStartIndex,routes.length-1);
    if(isRouteSkipped(routes[organizerStartIndex])){
        const nextIdx=findNextAssignableRouteIndex(organizerStartIndex);
        if(nextIdx>=0)organizerStartIndex=nextIdx;
    }
    sel.value=routes[organizerStartIndex].participantId;
    showParticipantQrForStart();
}

function setStartFlowParticipantFromSelect(){
    const sel=document.getElementById("startFlowParticipantSelect");
    if(!sel) return;
    organizerStartIndex=state.routes.findIndex(r=>r.participantId===sel.value);
    if(organizerStartIndex<0) organizerStartIndex=0;
    markStartFlowStatus(sel.value,"prepared");
    refreshParticipantNameInputs();
    updateRouteDiscardUi();
    showParticipantQrForStart();
}

function showParticipantQrForStart(){
    saveStartParticipantNameNow();
    const sel=document.getElementById("startFlowParticipantSelect");
    if(!sel) return;

    const pid=sel.value;
    const route=getRouteByParticipant(pid);
    if(!route) return toast("No hay recorrido para ese participante");
    if(isRouteSkipped(route)){
        const info=document.getElementById("startFlowInfo");
        const box=document.getElementById("organizerStartQrBox");
        const payloadBox=document.getElementById("organizerStartPayload");
        if(info){info.className="status warn";info.innerHTML=`${escapeHtml(route.participantId)} · ${escapeHtml(route.routeId)} está descartado por el organizador y no se asignará a nadie.`;}
        if(box)box.innerHTML="QR pendiente";
        if(payloadBox)payloadBox.textContent="";
        hideStep5DeliveryConfirmPanels();
        updateRouteDiscardUi();
        renderStartFlowStatusPanel();
        return;
    }

    markStartFlowStatus(pid,"participantQr");
    const payload=participantPayload(pid);
    const info=document.getElementById("startFlowInfo");
    const name=resultParticipantName(pid);
    if(info){
        info.className="status ok";
        info.innerHTML=`1️⃣ Enseña este QR a <b>${escapeHtml(participantDisplay(pid,route.routeId))}</b> para cargar su recorrido en el móvil.`;
    }

    setStep5DeliveryConfirmPanel("start",route,"participant");
    renderOrganizerQr("organizerStartQrBox","organizerStartPayload",payload,participantDisplay(pid,route.routeId));
    renderStartFlowStatusPanel();
}

function showStartQrForParticipant(){
    saveStartParticipantNameNow();
    const sel=document.getElementById("startFlowParticipantSelect");
    if(!sel) return;

    const pid=sel.value;
    const route=getRouteByParticipant(pid);
    if(!route) return toast("No hay recorrido para ese participante");
    if(isRouteSkipped(route)) return toast("Este recorrido está descartado y no se puede entregar");

    markStartFlowStatus(pid,"startQr");
    const payload=controlPayload("START");
    const info=document.getElementById("startFlowInfo");
    if(info){
        info.className="status ok";
        info.innerHTML=`2️⃣ Ahora <b>${escapeHtml(participantDisplay(pid,route.routeId))}</b> escanea SALIDA. Su cronómetro offline empieza en su móvil.`;
    }

    renderOrganizerQr("organizerStartQrBox","organizerStartPayload",payload,`SALIDA · ${participantDisplay(pid,route.routeId)}`);
    setStep5DeliveryConfirmPanel("start",route,"start");
    renderStartFlowStatusPanel();
}

function nextStartFlowParticipant(){
    if(!state.routes.length) return toast("No hay recorridos");
    const nextIdx=findNextAssignableRouteIndex(organizerStartIndex);
    if(nextIdx<0){
        toast("No quedan recorridos asignables. Todos están descartados.");
        updateRouteDiscardUi();
        return;
    }
    if(nextIdx<=organizerStartIndex)toast("Fin de lista. Vuelves al primer recorrido asignable.");
    organizerStartIndex=nextIdx;

    const sel=document.getElementById("startFlowParticipantSelect");
    if(sel) sel.value=state.routes[organizerStartIndex].participantId;
    refreshParticipantNameInputs();
    updateRouteDiscardUi();

    showParticipantQrForStart();
}

function renderFinishFlowQr(){
    updateOrganizerParticipantSelects();

    const sel=document.getElementById("finishFlowParticipantSelect");
    if(!sel || !sel.value) return toast("Selecciona participante");

    const pid=sel.value;
    const route=getRouteByParticipant(pid);
    if(!route) return toast("No hay recorrido para ese participante");
    if(isRouteSkipped(route)) return toast("Este recorrido está descartado y no se puede usar en llegada");

    markStartFlowStatus(pid,"finishQr");
    const payload=controlPayload("FINISH");
    const info=document.getElementById("finishFlowInfo");
    refreshParticipantNameInputs();
    if(info){
        const flowState=getStartFlowStatus(route);
        if(!flowState.startQrDeliveredAt){
            info.className="status warn";
            info.innerHTML=`Has seleccionado la LLEGADA de <b>${escapeHtml(participantDisplay(pid,route.routeId))}</b>, pero todavía no consta la salida entregada. Esto no lo pone en carrera. Primero confirma QR SALIDA entregado.`;
        }else{
            info.className="status ok";
            info.innerHTML=`Enseña este QR de LLEGADA a <b>${escapeHtml(participantDisplay(pid,route.routeId))}</b>. Después su móvil debe mostrarte el QR final de resultado.`;
        }
    }

    renderOrganizerQr("organizerFinishQrBox","organizerFinishPayload",payload,`LLEGADA · ${participantDisplay(pid,route.routeId)}`);
    setStep5DeliveryConfirmPanel("finish",route,"finish");
    renderStartFlowStatusPanel();
}

let resultQrCameraStream=null;
let resultQrCameraRunning=false;
let resultQrDetector=null;
let resultQrUseJsQr=false;
let resultQrLastValue="";
let resultQrLastTime=0;

function ensureImportedResultsStore(){
    if(!state.importedResults) state.importedResults=[];
}

function normalizeResultImportValue(raw){
    let value=String(raw||"").trim();
    if(!value)return "";

    // Compatibilidad: si alguien pega el JSON antiguo de la app participante,
    // se extrae automáticamente el campo result para no perder el resultado.
    if(value[0]==="{"){
        try{
            const data=JSON.parse(value);
            if(data&&data.result)value=String(data.result).trim();
            else if(data&&data.payload){
                const eventId=data.eventId||state.eventId;
                const participantId=data.participantId||data.p||"";
                if(eventId&&participantId)value=`ORI|RESULT|${eventId}|${participantId}|${data.payload}`;
            }
        }catch(e){}
    }
    return value;
}

function resultEncodeTime(iso){
    if(!iso)return null;
    const ms=Date.parse(iso);
    return Number.isFinite(ms)?ms.toString(36):String(iso);
}

function resultDecodeTime(v){
    if(v===null||v===undefined||v==="")return null;
    if(typeof v==="number"&&Number.isFinite(v))return new Date(v).toISOString();
    const s=String(v);
    if(/^\d{4}-\d{2}-\d{2}T/.test(s))return s;
    if(/^[0-9a-z]+$/i.test(s)){
        const ms=parseInt(s,36);
        if(Number.isFinite(ms)&&ms>946684800000&&ms<4102444800000)return new Date(ms).toISOString();
    }
    return s;
}

function resultEncodeStatus(status){
    return {correct:"c",out_of_order:"o",wrong:"w",duplicate:"d",skipped:"s"}[String(status||"")]||String(status||"");
}

function resultDecodeStatus(status){
    return {c:"correct",o:"out_of_order",w:"wrong",d:"duplicate",s:"skipped"}[String(status||"")]||String(status||"");
}

function parseResultPayload(raw){
    const value=normalizeResultImportValue(raw);
    const parts=value.split("|");

    if(parts.length<5 || parts[0]!=="ORI" || parts[1]!=="RESULT"){
        return {ok:false,error:"No es un QR de resultado ORI|RESULT"};
    }

    const eventId=parts[2];
    const participantId=parts[3];
    const encoded=parts.slice(4).join("|");

    if(eventId!==state.eventId){
        return {ok:false,error:"Resultado de otro evento"};
    }

    try{
        const json=decodeURIComponent(escape(atob(encoded)));
        const data=JSON.parse(json);
        const compactScans=Array.isArray(data.x)?data.x.map(s=>{
            if(Array.isArray(s))return {id:s[0],t:resultDecodeTime(s[1]),st:resultDecodeStatus(s[2]),lat:Number.isFinite(Number(s[3]))?Number(s[3]):null,lon:Number.isFinite(Number(s[4]))?Number(s[4]):null,accuracy:Number.isFinite(Number(s[5]))?Number(s[5]):null};
            return {id:s.i||s.id||s.controlId,t:resultDecodeTime(s.t||s.timestamp),st:resultDecodeStatus(s.s||s.st||s.status)};
        }):[];
        const normalScans=Array.isArray(data.scans)?data.scans:[];
        const scans=(compactScans.length?compactScans:normalScans).map(s=>({
            id:s.id||s.controlId||"",
            controlId:s.controlId||s.id||"",
            t:s.t||s.timestamp||"",
            timestamp:s.timestamp||s.t||"",
            st:s.st||s.status||"",
            status:s.status||s.st||"",
            lat:Number.isFinite(Number(s.lat))?Number(s.lat):null,
            lon:Number.isFinite(Number(s.lon??s.lng))?Number(s.lon??s.lng):null,
            accuracy:Number.isFinite(Number(s.accuracy))?Number(s.accuracy):null
        }));
        const missing=Array.isArray(data.m)?data.m:(Array.isArray(data.missingControls)?data.missingControls:[]);

        return {
            ok:true,
            eventId,
            participantId,
            participantName:resultParticipantName(participantId),
            routeId:data.routeId||data.r||"",
            completed:("completed" in data)?!!data.completed:!!data.c,
            startTime:resultDecodeTime(data.startTime||data.st||null),
            finishTime:resultDecodeTime(data.finishTime||data.ft||null),
            scans,
            missingControls:missing,
            distanceTrackM:Number.isFinite(Number(data.d))?Number(data.d):null,
            adjustedTimeMs:Number.isFinite(Number(data.a))?Number(data.a):null,
            penaltyPerControlMinutes:Number.isFinite(Number(data.pr))?Number(data.pr):null,
            sourceAppVersion:String(data.av||""),
            trackPointCount:Number.isFinite(Number(data.tc))?Number(data.tc):0,
            raw:value,
            importedAt:new Date().toISOString()
        };
    }catch(e){
        return {ok:false,error:"No se pudo leer el contenido del resultado"};
    }
}

const TRACK_PART_STORAGE_PREFIX="militopo_offline_track_parts_v56_";
function trackPartStorageKey(eventId,participantId,transferId){return TRACK_PART_STORAGE_PREFIX+[eventId,participantId,transferId].map(x=>String(x||"").replace(/[^a-z0-9_-]/gi,"_")).join("_")}
function decodeFullTrackTransfer(encoded){
    const json=decodeURIComponent(escape(atob(encoded)));
    const data=JSON.parse(json);
    if(!data||!Array.isArray(data.rows))throw new Error("Track no válido");
    const track=[];let t=0,lat=0,lon=0;
    for(let i=0;i<data.rows.length;i++){
        const r=data.rows[i]||[];
        t=i? t+Number(r[0]||0):Number(r[0]||0);
        lat=i? lat+Number(r[1]||0):Number(r[1]||0);
        lon=i? lon+Number(r[2]||0):Number(r[2]||0);
        if(!Number.isFinite(t)||!Number.isFinite(lat)||!Number.isFinite(lon))continue;
        track.push({timestamp:new Date(t).toISOString(),lat:lat/1e7,lon:lon/1e7,accuracy:r[3]===null||r[3]===undefined?null:Number(r[3])/10,altitude:r[4]===null||r[4]===undefined?null:Number(r[4])/10,speed:r[5]===null||r[5]===undefined?null:Number(r[5])/100,heading:r[6]===null||r[6]===undefined?null:Number(r[6]),event:r[7]||"gps"});
    }
    return {eventId:String(data.e||""),participantId:String(data.p||""),routeId:String(data.r||""),participantName:String(data.n||""),track};
}
function attachOfflineTrackToResult(participantId,trackData){
    ensureImportedResultsStore();
    const idx=state.importedResults.findIndex(r=>String(r.participantId||"")===String(participantId||""));
    if(idx<0){
        try{localStorage.setItem(`militopo_pending_full_track_v56_${state.eventId}_${participantId}`,JSON.stringify(trackData))}catch(e){}
        return false;
    }
    const r=state.importedResults[idx];
    r.track=trackData.track;r.gpsTrack=trackData.track;r.trackPointCount=trackData.track.length;
    if(trackData.routeId&&!r.routeId)r.routeId=trackData.routeId;
    if(trackData.participantName)r.participantName=trackData.participantName;
    r.trackImportedOffline=true;r.trackImportedAt=new Date().toISOString();
    try{localStorage.removeItem(`militopo_pending_full_track_v56_${state.eventId}_${participantId}`)}catch(e){}
    saveState();renderImportedResults();renderResultsControl();if(Number(currentAppStep)===7&&typeof renderRaceAnalysis==="function")renderRaceAnalysis();
    return true;
}
function applyPendingOfflineTrack(parsed){
    try{
        const key=`militopo_pending_full_track_v56_${state.eventId}_${parsed.participantId}`;
        const raw=localStorage.getItem(key);if(!raw)return parsed;
        const d=JSON.parse(raw);if(d&&Array.isArray(d.track)&&d.track.length){parsed.track=d.track;parsed.gpsTrack=d.track;parsed.trackPointCount=d.track.length;parsed.trackImportedOffline=true;localStorage.removeItem(key)}
    }catch(e){}
    return parsed;
}
function importOfflineTrackPart(raw){
    const parts=String(raw||"").trim().split("|");
    if(parts.length<8||parts[0]!=="ORI"||parts[1]!=="TRACKPART")return null;
    const eventId=parts[2],participantId=parts[3],transferId=parts[4],index=Number(parts[5]),total=Number(parts[6]),chunk=parts.slice(7).join("|");
    if(eventId!==state.eventId)return {ok:false,error:"Track de otro evento",keepScanning:false};
    if(!participantId||!transferId||!Number.isInteger(index)||!Number.isInteger(total)||index<1||index>total||total>250)return {ok:false,error:"Parte de track no válida",keepScanning:true};
    const key=trackPartStorageKey(eventId,participantId,transferId);
    let acc={eventId,participantId,transferId,total,parts:{},updatedAt:new Date().toISOString()};
    try{const old=JSON.parse(localStorage.getItem(key)||"null");if(old&&old.total===total)acc=old}catch(e){}
    acc.parts[String(index)]=chunk;acc.updatedAt=new Date().toISOString();
    try{localStorage.setItem(key,JSON.stringify(acc))}catch(e){return {ok:false,error:"Sin espacio para guardar las partes del track",keepScanning:false}}
    const count=Object.keys(acc.parts).length;
    if(count<total)return {ok:true,partial:true,participantId,index,total,count,keepScanning:true,message:`Track ${participantId}: parte ${index}/${total} guardada (${count}/${total})`};
    try{
        let encoded="";for(let i=1;i<=total;i++){if(!acc.parts[String(i)])throw new Error("Falta una parte");encoded+=acc.parts[String(i)]}
        const data=decodeFullTrackTransfer(encoded);
        if(data.eventId&&data.eventId!==state.eventId)throw new Error("Evento incorrecto");
        if(data.participantId&&data.participantId!==participantId)throw new Error("Participante incorrecto");
        const attached=attachOfflineTrackToResult(participantId,data);
        localStorage.removeItem(key);
        return {ok:true,complete:true,participantId,total,pointCount:data.track.length,attached,keepScanning:false,message:attached?`Track completo importado: ${participantId} · ${data.track.length} puntos`:`Track completo guardado. Importa ahora el QR final de ${participantId}`};
    }catch(e){return {ok:false,error:"No se pudo reconstruir el track completo",keepScanning:false}}
}

function importResultFromInput(){
    const input=document.getElementById("resultImportInput");
    if(!input || !input.value.trim()) return toast("Pega o escanea un resultado primero");
    importResultPayload(input.value.trim());
}

function importResultPayload(raw){
    ensureImportedResultsStore();

    const trackOutcome=importOfflineTrackPart(raw);
    if(trackOutcome){
        if(trackOutcome.ok)toast(trackOutcome.message||"Parte del track importada");else toast(trackOutcome.error||"Parte del track no válida");
        return trackOutcome;
    }

    let parsed=parseResultPayload(raw);
    if(!parsed.ok){
        toast(parsed.error||"Resultado no válido");
        return {ok:false,error:parsed.error||"Resultado no válido",keepScanning:false};
    }
    parsed=applyPendingOfflineTrack(parsed);

    if(isResultForSkippedRoute(parsed)){
        toast(`Resultado ignorado: ${parsed.participantId} está descartado por el organizador`);
        return {ok:false,error:"Participante descartado",keepScanning:false};
    }

    parsed.participantName=resultParticipantName(parsed.participantId);
    window.MILITOPO_TOUCH_RACE_DATA?.({status:"closing",lastDataAt:new Date().toISOString()});
    const idx=state.importedResults.findIndex(r=>r.participantId===parsed.participantId);
    if(idx>=0){
        state.importedResults[idx]=parsed;
        toast("Resultado actualizado: "+parsed.participantId);
    }else{
        state.importedResults.push(parsed);
        toast("Resultado importado: "+parsed.participantId);
    }

    saveState();
    renderImportedResults();
    renderResultsControl();
    if(typeof updateOrganizerParticipantSelects==="function")updateOrganizerParticipantSelects({keepQr:true});
    renderStartFlowStatusPanel();
    return {ok:true,complete:true,participantId:parsed.participantId,keepScanning:false};
}


/* MILITOPO LIVE · importación automática y segura del resultado final */
window.MILITOPO_LIVE_IMPORT_RESULT=function(raw,meta={}){
    try{
        ensureImportedResultsStore();
        const parsed=parseResultPayload(raw);
        if(!parsed.ok)return {ok:false,error:parsed.error||"Resultado no válido"};
        if(isResultForSkippedRoute(parsed))return {ok:false,error:`${parsed.participantId} está descartado por el organizador`};

        parsed.participantName=resultParticipantName(parsed.participantId);
        parsed.liveImported=true;
        parsed.liveRunId=String(meta.runId||"");
        parsed.liveReceivedAt=String(meta.receivedAt||new Date().toISOString());
        if(Array.isArray(meta.track)&&meta.track.length){parsed.track=meta.track;parsed.gpsTrack=meta.track;parsed.trackPointCount=Math.max(Number(meta.trackPointCount)||0,meta.track.length)}

        const normalizedRaw=normalizeResultImportValue(parsed.raw);
        const idx=state.importedResults.findIndex(r=>r.participantId===parsed.participantId);
        const duplicate=idx>=0&&normalizeResultImportValue(state.importedResults[idx]?.raw||"")===normalizedRaw;

        if(duplicate&&Array.isArray(meta.track)&&meta.track.length&&idx>=0){window.MILITOPO_TOUCH_RACE_DATA?.({runId:meta.runId,status:"active"});state.importedResults[idx].track=meta.track;state.importedResults[idx].gpsTrack=meta.track;state.importedResults[idx].trackPointCount=Math.max(Number(meta.trackPointCount)||0,meta.track.length);saveState();if(Number(currentAppStep)===7)renderRaceAnalysis()}
        if(!duplicate){
            window.MILITOPO_TOUCH_RACE_DATA?.({runId:meta.runId,status:"active"});
            if(idx>=0)state.importedResults[idx]=parsed;
            else state.importedResults.push(parsed);
            saveState();
            renderImportedResults();
            renderResultsControl();
            if(typeof updateOrganizerParticipantSelects==="function")updateOrganizerParticipantSelects({keepQr:true});
            renderStartFlowStatusPanel();
            refreshLiveOrganizerContext();
            if(typeof toast==="function")toast(`Resultado recibido en vivo: ${parsed.participantId}`);
        }

        return {ok:true,duplicate,participantId:parsed.participantId,completed:!!parsed.completed};
    }catch(error){
        console.error("MILITOPO LIVE · importación automática",error);
        return {ok:false,error:error?.message||"No se pudo importar el resultado en vivo"};
    }
};

window.MILITOPO_LIVE_HAS_RESULT=function(participantId,raw=""){
    try{
        ensureImportedResultsStore();
        const found=state.importedResults.find(r=>String(r.participantId||"")===String(participantId||""));
        if(!found)return false;
        if(!raw)return true;
        return normalizeResultImportValue(found.raw||"")===normalizeResultImportValue(raw);
    }catch(_){return false;}
};

function renderImportedResults(){
    ensureImportedResultsStore();

    const summary=document.getElementById("importedResultsSummary");
    const list=document.getElementById("importedResultsList");
    if(!summary || !list) return;

    const visibleResults=activeImportedResults();
    const total=visibleResults.length;
    const ok=visibleResults.filter(r=>r.completed).length;
    const warn=total-ok;

    if(!total){
        summary.className="status warn";
        summary.textContent="Todavía no hay resultados importados.";
        list.innerHTML="";
        return;
    }

    summary.className=warn?"status warn":"status ok";
    summary.innerHTML=`${total} resultado(s) importados · ${ok} completo(s) · ${warn} con avisos`;

    const sorted=[...visibleResults].sort((a,b)=>String(a.participantId).localeCompare(String(b.participantId),"es",{numeric:true}));

    list.innerHTML=sorted.map(r=>{
        const totalTime=r.startTime&&r.finishTime ? formatDuration(new Date(r.finishTime)-new Date(r.startTime)) : "--";
        const cls=r.completed?"ok":"bad";
        const icon=r.completed?"✅":"⚠️";
        const missing=(r.missingControls||[]).length ? ` · pendientes: ${(r.missingControls||[]).join(", ")}` : "";
        const name=resultParticipantName(r);
        return `<div class="scan-item ${cls}">
            <b>${escapeHtml(name?`${r.participantId} · ${name}`:r.participantId)}</b>
            <span>${escapeHtml(r.routeId||"--")} · ${totalTime}${missing}</span>
            <span>${icon}</span>
        </div>`;
    }).join("");
}

function clearImportedResults(){
    const guard=ensureRaceDataProtection();
    if(guard.protected && typeof window.MILITOPO_LIVE_DELETE_RACE_DATA==="function"){window.MILITOPO_LIVE_DELETE_RACE_DATA();return;}
    if(!confirm("¿Limpiar todos los resultados importados?")) return;
    state.importedResults=[];
    saveState();
    renderImportedResults();
    renderResultsControl();
    toast("Resultados limpiados");
}

function downloadImportedResults(){
    ensureImportedResultsStore();
    const data={
        eventId:state.eventId,
        exportedAt:new Date().toISOString(),
        participantNames:state.participantNames||{},
        skippedRoutes:state.skippedRoutes||{},
        results:activeImportedResults()
    };
    downloadText(`resultados_importados_${state.eventId}.json`,JSON.stringify(data,null,2));
}

async function startResultQrCamera(){
    const panel=document.getElementById("resultQrCameraPanel");
    const video=document.getElementById("resultQrVideo");
    const status=document.getElementById("resultQrCameraStatus");

    if(!panel||!video||!status) return;

    panel.style.display="block";
    status.className="status warn";
    status.textContent="Preparando lector QR de resultado...";

    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
        status.className="status err";
        status.textContent="Este navegador no permite usar cámara. Usa importación manual.";
        return;
    }

    resultQrDetector=null;
    resultQrUseJsQr=false;

    if("BarcodeDetector" in window){
        try{
            resultQrDetector=new BarcodeDetector({formats:["qr_code"]});
        }catch(e){
            resultQrDetector=null;
        }
    }

    try{
        await loadJsQrLibrary();
        resultQrUseJsQr=!!window.jsQR;
    }catch(e){
        if(!resultQrDetector){
            status.className="status err";
            status.textContent="No se pudo cargar lector QR compatible. Usa importación manual.";
            return;
        }
    }

    try{
        resultQrCameraStream=await navigator.mediaDevices.getUserMedia({
            video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}},
            audio:false
        });

        video.srcObject=resultQrCameraStream;
        await video.play();

        resultQrCameraRunning=true;
        resultQrLastValue="";
        resultQrLastTime=0;

        status.className="status ok";
        status.textContent="Cámara activa. Apunta al QR final del participante.";

        scanResultQrCameraLoop();
    }catch(e){
        console.warn("No se pudo abrir cámara de resultado:", e);
        status.className="status err";
        status.textContent="No se pudo abrir la cámara. Usa importación manual.";
        stopResultQrCamera();
    }
}

function stopResultQrCamera(){
    resultQrCameraRunning=false;

    if(resultQrCameraStream){
        resultQrCameraStream.getTracks().forEach(t=>t.stop());
        resultQrCameraStream=null;
    }

    const video=document.getElementById("resultQrVideo");
    if(video) video.srcObject=null;

    const panel=document.getElementById("resultQrCameraPanel");
    if(panel) panel.style.display="none";
}

async function scanResultQrCameraLoop(){
    if(!resultQrCameraRunning) return;

    const video=document.getElementById("resultQrVideo");
    const canvas=document.getElementById("resultQrCanvas");
    const status=document.getElementById("resultQrCameraStatus");

    try{
        let raw="";

        if(video && video.readyState>=2){
            if(resultQrDetector){
                try{
                    const codes=await resultQrDetector.detect(video);
                    if(codes && codes.length) raw=(codes[0].rawValue||"").trim();
                }catch(e){}
            }
            if(!raw && resultQrUseJsQr && window.jsQR && canvas){
                const w=video.videoWidth||1280;
                const h=video.videoHeight||720;
                canvas.width=w;
                canvas.height=h;
                const ctx=canvas.getContext("2d",{willReadFrequently:true});
                ctx.drawImage(video,0,0,w,h);
                const img=ctx.getImageData(0,0,w,h);
                const code=window.jsQR(img.data,w,h,{inversionAttempts:"attemptBoth"});
                if(code && code.data) raw=String(code.data).trim();
            }
        }

        if(raw){
            const now=Date.now();

            if(raw!==resultQrLastValue || now-resultQrLastTime>2500){
                resultQrLastValue=raw;
                resultQrLastTime=now;

                const input=document.getElementById("resultImportInput");
                if(input) input.value=raw;

                const outcome=importResultPayload(raw);
                if(status){
                    status.className=(outcome&&outcome.ok===false)?"status err":"status ok";
                    status.textContent=(outcome&&outcome.message)||(outcome&&outcome.error)||"QR importado.";
                }
                if(navigator.vibrate) navigator.vibrate(120);
            }
        }else if(status && resultQrCameraRunning){
            status.className="status warn";
            status.textContent="Buscando QR final...";
        }
    }catch(e){
        console.warn("Error leyendo QR resultado:", e);
        if(status){
            status.className="status warn";
            status.textContent="Buscando QR final...";
        }
    }

    if(resultQrCameraRunning){
        requestAnimationFrame(scanResultQrCameraLoop);
    }
}

function updateParticipantSelect(){const sel=document.getElementById("participantSelect");if(sel){sel.innerHTML="";for(let i=1;i<=state.participantCount;i++){const pid="P"+String(i).padStart(2,"0"),opt=document.createElement("option");opt.value=pid;opt.textContent=pid;sel.appendChild(opt)}}updateOrganizerParticipantSelects()}function renderQrPreview(){updateOrganizerParticipantSelects();renderImportedResults();const box=document.getElementById("qrPreview");if(!box)return;box.innerHTML="";[{label:"Participante P01",payload:participantPayload("P01")},{label:"Baliza B01",payload:controlPayload("B01")},{label:"Salida",payload:controlPayload("START")},{label:"Llegada",payload:controlPayload("FINISH")}].forEach(async item=>{const div=document.createElement("div");div.className="qr-card";div.innerHTML=`<div>${item.label}</div><div style="height:150px;display:grid;place-items:center">Generando...</div><small>${item.payload}</small>`;box.appendChild(div);try{const url=await QRCode.toDataURL(item.payload,{margin:4,width:220,errorCorrectionLevel:'M'});div.innerHTML=`<div>${item.label}</div><img src="${url}"><small>${item.payload}</small>`}catch(e){div.innerHTML=`<div>${item.label}</div><pre>${item.payload}</pre>`}})}
function base64UrlEncodeUtf8(value){
    const bytes=new TextEncoder().encode(String(value??""));
    let bin="";
    bytes.forEach(b=>bin+=String.fromCharCode(b));
    return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}

function base64UrlDecodeUtf8(value){
    const clean=String(value||"").replace(/-/g,"+").replace(/_/g,"/");
    const padded=clean+"=".repeat((4-clean.length%4)%4);
    const bin=atob(padded);
    const bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
}

function safeParticipantBaseUrl(){
    try{return new URL("./participante/",window.location.href).toString();}
    catch(e){return "./participante/";}
}

function buildParticipantWebEventData(pid){
    const full=typeof buildEventData==="function"?buildEventData():{};
    const route=(state.routes||[]).find(r=>r&&r.participantId===pid&&!isRouteSkipped(r))
        || (state.routes||[]).find(r=>r&&r.participantId===pid)
        || null;
    if(!route)throw new Error("No hay recorrido para "+pid);

    const routeIndex=(state.routes||[]).findIndex(r=>r&&r.participantId===route.participantId&&r.routeId===route.routeId);
    const metric=(state.metrics||[])[routeIndex]||{};
    const pointIds=new Set((route.points||[]).filter(Boolean));
    pointIds.add("START");
    pointIds.add("FINISH");

    const points={};
    Object.keys(state.points||{}).forEach(id=>{
        if(pointIds.has(id)&&state.points[id])points[id]=state.points[id];
    });

    const payload={
        ...full,
        participantMode:true,
        webParticipantId:pid,
        webGeneratedAt:new Date().toISOString(),
        config:{...(full.config||{}),participantCount:1,activeParticipantCount:1},
        routes:[route],
        metrics:[metric],
        points,
        participantNames:{[pid]:(state.participantNames||{})[pid]||""},
        participantLogs:{},
        skippedRoutes:{},
        importedResults:[]
    };

    if(state.iofDescriptions){
        payload.iofDescriptions={};
        Object.keys(state.iofDescriptions).forEach(id=>{
            if(pointIds.has(id))payload.iofDescriptions[id]=state.iofDescriptions[id];
        });
    }
    return payload;
}

function participantWebUrl(pid){
    const compact=buildCompactParticipantWebData(pid);
    const packed=base64UrlEncodeUtf8(JSON.stringify(compact));
    const url=new URL(safeParticipantBaseUrl(),window.location.href);
    url.searchParams.set("modo","participante");
    url.searchParams.set("p",pid);
    url.searchParams.set("c",packed);
    return url.toString();
}
function readParticipantWebDataFromUrl(){
    try{
        const params=new URLSearchParams(window.location.search||"");
        const packed=params.get("c")||params.get("pdata")||params.get("data")||"";
        if(!packed)return null;
        const raw=JSON.parse(base64UrlDecodeUtf8(packed));
        const eventData=(raw&&(raw.v===1||raw.v===2))?expandCompactParticipantWebData(raw):raw;
        const pid=params.get("p")||eventData.webParticipantId||"";
        const saved={pid,eventData,loadedAt:new Date().toISOString()};
        localStorage.setItem("militopo_participant_web_event_v1",JSON.stringify(saved));
        localStorage.setItem("militopo_orientacion_access_mode_v1","participante");
        try{
            const cleanUrl=window.location.pathname+"?modo=participante"+(pid?"&p="+encodeURIComponent(pid):"");
            window.history.replaceState({},document.title,cleanUrl);
        }catch(e){}
        return saved;
    }catch(e){
        console.warn("No se pudo leer datos de participante",e);
        return null;
    }
}
function readSavedParticipantWebData(){
    const fromUrl=readParticipantWebDataFromUrl();
    if(fromUrl)return fromUrl;
    try{
        const raw=localStorage.getItem("militopo_participant_web_event_v1");
        return raw?JSON.parse(raw):null;
    }catch(e){return null;}
}


function roundCoordForQr(value){
    const n=Number(value);
    return Number.isFinite(n)?Number(n.toFixed(6)):null;
}

function buildCompactParticipantWebData(pid){
    const route=(state.routes||[]).find(r=>r&&r.participantId===pid&&!isRouteSkipped(r))
        || (state.routes||[]).find(r=>r&&r.participantId===pid)
        || null;
    if(!route)throw new Error("No hay recorrido para "+pid);

    const routeIndex=(state.routes||[]).findIndex(r=>r&&r.participantId===route.participantId&&r.routeId===route.routeId);
    const metric=(state.metrics||[])[routeIndex]||{};
    const ids=(route.points||[]).filter(Boolean);
    const allIds=[];
    ["START",...ids,"FINISH"].forEach(id=>{ if(id&&!allIds.includes(id))allIds.push(id); });

    const points=allIds.map(id=>{
        const p=(state.points||{})[id]||{};
        return [
            String(id),
            String(p.type||((String(id).toUpperCase()==="START")?"SALIDA":(String(id).toUpperCase()==="FINISH")?"LLEGADA":"BALIZA")),
            roundCoordForQr(p.lat),
            roundCoordForQr(p.lon),
            Number.isFinite(Number(p.elevation))?Math.round(Number(p.elevation)):null,
            String(p.utm||""),
            String(p.desc||"")
        ];
    });

    // v2 conserva dentro del propio QR todo lo necesario para abrir directamente
    // al participante con su recorrido, pero elimina datos redundantes (UTM,
    // descripción, altitud y nombres de propiedades repetidos). El QR final
    // ORI|RESULT no depende de este formato y continúa intacto como respaldo.
    return {
        v:2,
        e:String(state.eventId||""),
        n:String(state.eventName||"ENTRENAMIENTO ORIENTACIÓN"),
        p:String(pid||route.participantId||""),
        pn:String((state.participantNames||{})[pid]||""),
        r:[String(route.routeId||""),ids],
        m:[
            Number.isFinite(Number(metric.distanceKm))?Number(Number(metric.distanceKm).toFixed(3)):null,
            Number.isFinite(Number(metric.climbUp))?Math.round(Number(metric.climbUp)):null,
            Number.isFinite(Number(metric.climbDown))?Math.round(Number(metric.climbDown)):null,
            Number.isFinite(Number(metric.netClimb))?Math.round(Number(metric.netClimb)):null,
            metric.difficulty||null
        ],
        pts:points.map(row=>[row[0],row[2],row[3]]),
        t:Date.now()
    };
}

function expandCompactParticipantWebData(compact){
    if(!compact)return compact;

    // v2 = QR participante simplificado. Hay que expandirlo aquí, en la app principal,
    // para que al abrir la web desde el QR el iframe participante ya reciba routes/points
    // y cargue el recorrido directamente sin pedir escanear otra vez.
    if(compact.v===2){
        const points={};
        (compact.pts||[]).forEach(row=>{
            const id=String(row[0]||"");
            if(!id)return;
            const upper=id.toUpperCase();
            points[id]={
                id,
                type:upper==="START"?"SALIDA":upper==="FINISH"?"LLEGADA":"BALIZA",
                lat:Number.isFinite(Number(row[1]))?Number(row[1]):null,
                lon:Number.isFinite(Number(row[2]))?Number(row[2]):null,
                elevation:null,
                utm:"",
                desc:""
            };
        });

        const pid=String(compact.p||"P01");
        const routeId=String((compact.r&&compact.r[0])||"R01");
        const routePoints=((compact.r&&compact.r[1])||[]).filter(Boolean);

        return {
            version:"orientacion_v2_web_compact_main_expanded",
            participantMode:true,
            webParticipantId:pid,
            eventId:String(compact.e||""),
            eventName:String(compact.n||"ENTRENAMIENTO ORIENTACIÓN"),
            createdAt:new Date(Number(compact.t)||Date.now()).toISOString(),
            config:{participantCount:1,activeParticipantCount:1,controlCount:routePoints.length,controlsPerRoute:routePoints.length,maxControlReuse:1},
            points,
            routes:[{participantId:pid,routeId,points:routePoints}],
            metrics:[{
                participantId:pid,
                routeId,
                distanceKm:compact.m?.[0],
                climbUp:compact.m?.[1],
                climbDown:compact.m?.[2],
                netClimb:compact.m?.[3],
                difficulty:compact.m?.[4]
            }],
            participantNames:{[pid]:String(compact.pn||"")},
            participantLogs:{},
            skippedRoutes:{},
            importedResults:[],
            iofDescriptions:{}
        };
    }

    if(compact.v!==1)return compact;

    const points={};
    (compact.pts||[]).forEach(row=>{
        const id=String(row[0]||"");
        if(!id)return;
        points[id]={
            id,
            type:String(row[1]||"BALIZA"),
            lat:Number.isFinite(Number(row[2]))?Number(row[2]):null,
            lon:Number.isFinite(Number(row[3]))?Number(row[3]):null,
            elevation:Number.isFinite(Number(row[4]))?Number(row[4]):null,
            utm:String(row[5]||""),
            desc:String(row[6]||"")
        };
    });

    const pid=String(compact.p||compact.r?.i||"P01");
    const routeId=String(compact.r?.d||"R01");
    const routePoints=(compact.r?.q||[]).filter(Boolean);

    return {
        version:"orientacion_v1_web_compact",
        participantMode:true,
        webParticipantId:pid,
        eventId:String(compact.e||""),
        eventName:String(compact.n||"ENTRENAMIENTO ORIENTACIÓN"),
        createdAt:new Date(Number(compact.t)||Date.now()).toISOString(),
        config:{participantCount:1,activeParticipantCount:1,controlCount:routePoints.length,controlsPerRoute:routePoints.length,maxControlReuse:1},
        points,
        routes:[{participantId:pid,routeId,points:routePoints}],
        metrics:[{
            participantId:pid,
            routeId,
            distanceKm:compact.m?.km,
            climbUp:compact.m?.pp,
            climbDown:compact.m?.pn,
            netClimb:compact.m?.dg,
            difficulty:compact.m?.df
        }],
        participantNames:{[pid]:String(compact.pn||"")},
        participantLogs:{},
        skippedRoutes:{},
        importedResults:[],
        iofDescriptions:{}
    };
}

function participantPayload(pid){
    try{
        return participantWebUrl(pid);
    }catch(e){
        const route=state.routes.find(r=>r.participantId===pid&&!isRouteSkipped(r));
        return `ORI|PART|${state.eventId}|${pid}|${route?.routeId||""}`;
    }
}
function controlPayload(id){return `ORI|CONTROL|${state.eventId}|${id}`}
function loadParticipantMode(){
    const pid=document.getElementById("participantSelect").value;
    const route=state.routes.find(r=>r.participantId===pid&&!isRouteSkipped(r));
    if(!route){
        document.getElementById("participantInfo").className="status err";
        document.getElementById("participantInfo").textContent="No hay recorrido activo para este participante.";
        return;
    }

    if(!state.participantLogs[pid]) state.participantLogs[pid]=makeParticipantLog(pid,route.routeId);

    document.getElementById("participantInfo").className="status ok";
    document.getElementById("participantInfo").innerHTML=`<b>${pid}</b> · ${route.routeId}<br>${route.points.join(" → ")}`;

    renderScanList(pid);
    renderRunnerNextInfo(pid);
    renderRunnerResult(pid);
    saveState();
}

function makeParticipantLog(pid,routeId){
    return{
        eventId:state.eventId,
        participantId:pid,
        routeId,
        startTime:null,
        finishTime:null,
        scans:[],
        pendingSync:true,
        completed:false,
        resultPayload:null
    };
}

function getSelectedParticipantRoute(){
    const pid=document.getElementById("participantSelect").value;
    const route=state.routes.find(r=>r.participantId===pid);
    return {pid,route,log:state.participantLogs[pid]};
}

function parseOrientationQr(raw){
    const value=(raw||"").trim().toUpperCase();
    const parts=value.split("|");

    if(parts.length>=4 && parts[0]==="ORI"){
        return {
            ok:true,
            type:parts[1],
            eventId:parts[2],
            id:parts[3],
            raw:value
        };
    }

    return {
        ok:true,
        type:"CONTROL",
        eventId:state.eventId,
        id:value,
        raw:value
    };
}

function markStart(){
    const {pid,route}=getSelectedParticipantRoute();
    if(!route) return toast("Carga primero un recorrido");
    registerStart(pid,route,"MANUAL");
}

function markFinish(){
    const {pid,route}=getSelectedParticipantRoute();
    if(!route) return toast("Carga primero un recorrido");
    registerFinish(pid,route,"MANUAL");
}

function registerStart(pid,route,source){
    if(!state.participantLogs[pid]) state.participantLogs[pid]=makeParticipantLog(pid,route.routeId);
    const log=state.participantLogs[pid];

    if(log.startTime){
        toast("La salida ya estaba registrada");
        return;
    }

    log.startTime=new Date().toISOString();
    log.startSource=source||"QR";
    log.pendingSync=true;
    log.completed=false;

    renderScanList(pid);
    renderRunnerNextInfo(pid);
    renderRunnerResult(pid);
    saveState();
    toast("Salida registrada");
}

function registerFinish(pid,route,source){
    if(!state.participantLogs[pid]) return toast("No hay salida/registro");
    const log=state.participantLogs[pid];

    if(!log.startTime) return toast("Primero debe registrar la salida");

    const expectedControls=route.points.filter(id=>id!=="START"&&id!=="FINISH");
    const correctControls=log.scans.filter(s=>s.status==="correct").map(s=>s.controlId);
    const missing=expectedControls.filter(id=>!correctControls.includes(id));

    log.finishTime=new Date().toISOString();
    log.finishSource=source||"QR";
    log.completed=missing.length===0;
    log.missingControls=missing;
    log.pendingSync=true;
    log.resultPayload=buildRunnerResultPayload(pid);

    renderScanList(pid);
    renderRunnerNextInfo(pid);
    renderRunnerResult(pid);
    saveState();

    toast(missing.length ? "Llegada registrada con balizas pendientes" : "Llegada registrada. Recorrido completo");
}

function scanControl(){
    const raw=document.getElementById("scanInput").value.trim();
    const {pid,route}=getSelectedParticipantRoute();

    if(!route) return toast("Carga primero un recorrido");
    if(!raw) return toast("Introduce o escanea un QR");

    const qr=parseOrientationQr(raw);
    if(!qr.ok) return toast("QR no válido");

    if(qr.type!=="CONTROL"){
        toast("Este QR no es una baliza de control");
        return;
    }

    if(qr.eventId!==state.eventId){
        toast("Este QR pertenece a otro evento");
        return;
    }

    if(!state.participantLogs[pid]) state.participantLogs[pid]=makeParticipantLog(pid,route.routeId);

    if(qr.id==="START"){
        registerStart(pid,route,"QR");
        document.getElementById("scanInput").value="";
        return;
    }

    if(qr.id==="FINISH"){
        registerFinish(pid,route,"QR");
        document.getElementById("scanInput").value="";
        return;
    }

    const log=state.participantLogs[pid];
    if(!log.startTime){
        toast("Primero debe escanear SALIDA");
        return;
    }

    if(log.finishTime){
        toast("El recorrido ya está finalizado");
        return;
    }

    const expectedControls=route.points.filter(id=>id!=="START"&&id!=="FINISH");
    const validInRoute=expectedControls.includes(qr.id);
    const alreadyCorrect=log.scans.some(s=>s.controlId===qr.id&&s.status==="correct");
    const correctCount=log.scans.filter(s=>s.status==="correct").length;
    const expectedId=expectedControls[correctCount]||"FINISH";
    const expectedOrder=correctCount+1;

    let status="wrong";
    if(qr.id===expectedId) status="correct";
    else if(alreadyCorrect) status="duplicate";
    else if(validInRoute) status="out_of_order";

    log.scans.push({
        eventId:state.eventId,
        participantId:pid,
        routeId:route.routeId,
        controlId:qr.id,
        timestamp:new Date().toISOString(),
        expectedOrder,
        expectedControlId:expectedId,
        realOrder:log.scans.length+1,
        status,
        synced:false
    });

    log.pendingSync=true;
    document.getElementById("scanInput").value="";

    renderScanList(pid);
    renderRunnerNextInfo(pid);
    renderRunnerResult(pid);
    saveState();

    const msg={
        correct:"Baliza correcta",
        out_of_order:`Fuera de orden. Tocaba ${expectedId}`,
        wrong:"Baliza no pertenece a tu recorrido",
        duplicate:"Baliza duplicada"
    }[status]||"Baliza registrada";
    toast(msg);
}

function renderRunnerNextInfo(pid){
    const route=state.routes.find(r=>r.participantId===pid);
    const log=state.participantLogs[pid];
    const box=document.getElementById("runnerNextInfo");
    if(!box) return;

    if(!route){
        box.className="status warn";
        box.textContent="Carga un participante para ver el siguiente punto.";
        return;
    }

    if(!log || !log.startTime){
        box.className="status warn";
        box.innerHTML="Siguiente paso: <b>escanear SALIDA</b>.";
        return;
    }

    if(log.finishTime){
        box.className=log.completed?"status ok":"status warn";
        box.innerHTML=log.completed ? "Recorrido finalizado correctamente." : `Recorrido finalizado con pendientes: ${(log.missingControls||[]).join(", ")}`;
        return;
    }

    const expectedControls=route.points.filter(id=>id!=="START"&&id!=="FINISH");
    const correctCount=log.scans.filter(s=>s.status==="correct").length;
    const next=expectedControls[correctCount] || "FINISH";

    box.className="status ok";
    box.innerHTML=`Siguiente QR obligatorio: <b>${next}</b>`;
}

function renderScanList(pid){
    const box=document.getElementById("scanList");
    const log=state.participantLogs[pid];
    const route=state.routes.find(r=>r.participantId===pid);

    if(!log || !route){
        box.innerHTML="";
        return;
    }

    let html=`<div class="scan-item ${log.startTime?"ok":"pending"}"><b>SALIDA</b><span>${log.startTime?formatTime(log.startTime):"Pendiente"}</span><span>${log.startTime?"✅":"⏳"}</span></div>`;

    log.scans.forEach(s=>{
        const cls=s.status==="correct"?"ok":(s.status==="duplicate"?"pending":"bad");
        const icon=s.status==="correct"?"✅":(s.status==="duplicate"?"🔁":"⚠️");
        html+=`<div class="scan-item ${cls}"><b>${s.controlId}</b><span>${formatTime(s.timestamp)} · tocaba ${s.expectedControlId} · ${labelScanStatus(s.status)}</span><span>${icon}</span></div>`;
    });

    html+=`<div class="scan-item ${log.finishTime?(log.completed?"ok":"bad"):"pending"}"><b>LLEGADA</b><span>${log.finishTime?formatTime(log.finishTime):"Pendiente"}</span><span>${log.finishTime?"🏁":"⏳"}</span></div>`;

    box.innerHTML=html;
}

function labelScanStatus(status){
    return {
        correct:"correcta",
        out_of_order:"fuera de orden",
        wrong:"no pertenece",
        duplicate:"duplicada"
    }[status]||status;
}

function clearParticipantLog(){
    const pid=document.getElementById("participantSelect").value;
    delete state.participantLogs[pid];
    renderScanList(pid);
    renderRunnerNextInfo(pid);
    renderRunnerResult(pid);
    saveState();
    toast("Registro limpiado");
}

function buildRunnerResultPayload(pid){
    const log=state.participantLogs[pid];
    if(!log) return "";
    const compact={
        v:3,
        r:log.routeId,
        st:resultEncodeTime(log.startTime),
        ft:resultEncodeTime(log.finishTime),
        c:!!log.completed,
        x:(log.scans||[]).map(s=>[s.controlId,resultEncodeTime(s.timestamp),resultEncodeStatus(s.status)]),
        m:log.missingControls||[]
    };
    return btoa(unescape(encodeURIComponent(JSON.stringify(compact))));
}

async function renderRunnerResult(pid){
    const box=document.getElementById("runnerResultBox");
    const summary=document.getElementById("runnerResultSummary");
    const qrBox=document.getElementById("runnerResultQr");
    const txt=document.getElementById("runnerResultText");
    if(!box||!summary||!qrBox||!txt) return;

    const log=state.participantLogs[pid];
    if(!log || !log.finishTime){
        box.style.display="none";
        return;
    }

    box.style.display="block";
    const payload=buildRunnerResultPayload(pid);
    log.resultPayload=payload;

    const totalMs=log.startTime&&log.finishTime ? (new Date(log.finishTime)-new Date(log.startTime)) : 0;
    const total=formatDuration(totalMs);

    summary.className=log.completed?"status ok":"status warn";
    summary.innerHTML=`<b>${pid}</b> · ${log.routeId}<br>Salida: ${formatTime(log.startTime)} · Llegada: ${formatTime(log.finishTime)} · Tiempo: ${total}<br>${log.completed?"✅ Recorrido completo":"⚠️ Pendientes: "+(log.missingControls||[]).join(", ")}`;

    const resultCode=`ORI|RESULT|${state.eventId}|${pid}|${payload}`;

    txt.value=resultCode;
    txt.setAttribute("aria-label","Código manual del resultado para copiar al organizador");
    qrBox.innerHTML="Generando QR final claro...";

    if(window.QRCode){
        try{
            const url=await QRCode.toDataURL(resultCode,{margin:8,width:1100,errorCorrectionLevel:'H'});
            qrBox.innerHTML=`<div style="display:grid;gap:10px;justify-items:center;">
                <img src="${url}" alt="QR final de resultado" style="width:min(94vw,520px);max-width:100%;border-radius:18px;background:#fff;padding:22px;border:8px solid #fff;image-rendering:pixelated;box-shadow:0 12px 30px rgba(0,0,0,.35);">
                <div class="status ok" style="width:100%;text-align:center;">📲 QR FINAL DE RESULTADO<br><small>Acerca la cámara del organizador. Si no lo lee, usa el código manual de abajo.</small></div>
            </div>`;
        }catch(e){
            qrBox.innerHTML="<small>No se pudo generar QR final. Usa el código manual de abajo.</small>";
        }
    }else{
        qrBox.innerHTML="<small>QR no disponible. Usa el código manual de abajo.</small>";
    }
}

function copyRunnerResult(){
    const txt=document.getElementById("runnerResultText");
    if(!txt || !txt.value) return toast("No hay resultado");
    txt.select();
    document.execCommand("copy");
    toast("Resultado copiado");
}

function exportParticipantLog(){
    const pid=document.getElementById("participantSelect").value;
    const log=state.participantLogs[pid];
    if(!log)return toast("No hay registro para exportar");
    downloadText(`registro_${pid}_${log.routeId||"SIN_RUTA"}.json`,JSON.stringify(log,null,2));
}

function formatTime(iso){
    if(!iso) return "--";
    return new Date(iso).toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
}

function formatDuration(ms){
    if(!Number.isFinite(ms)||ms<=0) return "--";
    const total=Math.floor(ms/1000);
    const h=Math.floor(total/3600);
    const m=Math.floor((total%3600)/60);
    const s=total%60;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}
let qrCameraStream=null;
let qrCameraRunning=false;
let qrDetector=null;
let qrUseJsQr=false;
let qrLastValue="";
let qrLastTime=0;

function loadJsQrLibrary(){
    return new Promise((resolve,reject)=>{
        if(window.jsQR) return resolve(true);

        const existing=document.querySelector('script[data-jsqr-loader="true"]');
        if(existing){
            existing.addEventListener("load",()=>resolve(true),{once:true});
            existing.addEventListener("error",()=>reject(new Error("No se pudo cargar jsQR")),{once:true});
            return;
        }

        const s=document.createElement("script");
        s.src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
        s.async=true;
        s.dataset.jsqrLoader="true";
        s.onload=()=>resolve(true);
        s.onerror=()=>reject(new Error("No se pudo cargar jsQR"));
        document.head.appendChild(s);
    });
}

async function startQrCamera(){
    const panel=document.getElementById("qrCameraPanel");
    const video=document.getElementById("qrVideo");
    const status=document.getElementById("qrCameraStatus");

    if(!panel||!video||!status) return;

    panel.style.display="block";
    status.className="status warn";
    status.textContent="Preparando lector QR...";

    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
        status.className="status err";
        status.textContent="Este navegador no permite usar cámara. Usa registro manual.";
        return;
    }

    qrDetector=null;
    qrUseJsQr=false;

    if("BarcodeDetector" in window){
        try{
            qrDetector=new BarcodeDetector({formats:["qr_code"]});
            status.textContent="Lector nativo disponible. Solicitando cámara...";
        }catch(e){
            qrDetector=null;
        }
    }

    if(!qrDetector){
        try{
            status.textContent="Cargando lector QR compatible...";
            await loadJsQrLibrary();
            if(window.jsQR){
                qrUseJsQr=true;
                status.textContent="Lector compatible cargado. Solicitando cámara...";
            }
        }catch(e){
            console.warn("No se pudo cargar lector jsQR:", e);
            status.className="status err";
            status.textContent="No se pudo cargar el lector QR compatible. Usa registro manual.";
            return;
        }
    }

    try{
        qrCameraStream=await navigator.mediaDevices.getUserMedia({
            video:{
                facingMode:{ideal:"environment"},
                width:{ideal:1280},
                height:{ideal:720}
            },
            audio:false
        });

        video.srcObject=qrCameraStream;
        await video.play();

        qrCameraRunning=true;
        qrLastValue="";
        qrLastTime=0;

        status.className="status ok";
        status.textContent=qrUseJsQr
            ? "Cámara activa con lector compatible. Apunta al QR."
            : "Cámara activa con lector nativo. Apunta al QR.";

        scanQrCameraLoop();
    }catch(e){
        console.warn("No se pudo abrir cámara QR:", e);
        status.className="status err";
        status.textContent="No se pudo abrir la cámara. Revisa permisos o usa registro manual.";
        stopQrCamera();
    }
}

function stopQrCamera(){
    qrCameraRunning=false;

    if(qrCameraStream){
        qrCameraStream.getTracks().forEach(t=>t.stop());
        qrCameraStream=null;
    }

    const video=document.getElementById("qrVideo");
    if(video) video.srcObject=null;

    const panel=document.getElementById("qrCameraPanel");
    if(panel) panel.style.display="none";
}

async function scanQrCameraLoop(){
    if(!qrCameraRunning) return;

    const video=document.getElementById("qrVideo");
    const canvas=document.getElementById("qrCanvas");
    const status=document.getElementById("qrCameraStatus");

    try{
        let raw="";

        if(video && video.readyState>=2){
            if(qrDetector){
                const codes=await qrDetector.detect(video);
                if(codes && codes.length) raw=(codes[0].rawValue||"").trim();
            }else if(qrUseJsQr && window.jsQR && canvas){
                const w=video.videoWidth || 640;
                const h=video.videoHeight || 480;
                if(w>0 && h>0){
                    canvas.width=w;
                    canvas.height=h;
                    const ctx=canvas.getContext("2d",{willReadFrequently:true});
                    ctx.drawImage(video,0,0,w,h);
                    const img=ctx.getImageData(0,0,w,h);
                    const code=window.jsQR(img.data,w,h,{inversionAttempts:"attemptBoth"});
                    if(code && code.data) raw=String(code.data).trim();
                }
            }
        }

        if(raw){
            const now=Date.now();

            if(raw!==qrLastValue || now-qrLastTime>2500){
                qrLastValue=raw;
                qrLastTime=now;

                document.getElementById("scanInput").value=raw;

                if(status){
                    status.className="status ok";
                    status.textContent="QR leído: "+raw;
                }

                scanControl();

                if(navigator.vibrate) navigator.vibrate(120);
            }
        }else if(status && qrCameraRunning){
            status.className="status warn";
            status.textContent="Buscando QR...";
        }
    }catch(e){
        console.warn("Error leyendo QR:", e);
        if(status){
            status.className="status warn";
            status.textContent="Buscando QR...";
        }
    }

    if(qrCameraRunning){
        requestAnimationFrame(scanQrCameraLoop);
    }
}

function makeOfflineQrSvg(payload, title="QR"){
    // QR real offline SVG: Byte mode, ECC-L, versiones 1-4.
    const data=unescape(encodeURIComponent(String(payload||"")));
    const bytes=[];
    for(let i=0;i<data.length;i++) bytes.push(data.charCodeAt(i)&255);

    const specs={
        1:{size:21,dataCodewords:19,eccCodewords:7,align:[]},
        2:{size:25,dataCodewords:34,eccCodewords:10,align:[18]},
        3:{size:29,dataCodewords:55,eccCodewords:15,align:[22]},
        4:{size:33,dataCodewords:80,eccCodewords:20,align:[26]}
    };

    let ver=1;
    for(const v of [1,2,3,4]){
        if(bytes.length+2<=specs[v].dataCodewords){ver=v;break;}
        ver=v;
    }

    const spec=specs[ver];
    if(bytes.length+2>spec.dataCodewords){
        return makeQrTooLargeSvg(payload,title);
    }

    const bits=[];
    const pushBits=(val,len)=>{for(let i=len-1;i>=0;i--)bits.push((val>>>i)&1);};

    pushBits(0x4,4); // byte mode
    pushBits(bytes.length,8);
    bytes.forEach(b=>pushBits(b,8));

    const capBits=spec.dataCodewords*8;
    const term=Math.min(4,capBits-bits.length);
    pushBits(0,term);
    while(bits.length%8) bits.push(0);

    const dataCodewords=[];
    for(let i=0;i<bits.length;i+=8){
        let b=0;
        for(let j=0;j<8;j++) b=(b<<1)|bits[i+j];
        dataCodewords.push(b);
    }

    const pads=[0xEC,0x11];
    let padIndex=0;
    while(dataCodewords.length<spec.dataCodewords){
        dataCodewords.push(pads[padIndex%2]);
        padIndex++;
    }

    const ecc=qrReedSolomonCompute(dataCodewords,spec.eccCodewords);
    const codewords=dataCodewords.concat(ecc);
    const dataBits=[];
    codewords.forEach(b=>pushByteTo(dataBits,b));

    const size=spec.size;
    const base=Array.from({length:size},()=>Array(size).fill(false));
    const reserved=Array.from({length:size},()=>Array(size).fill(false));
    const setFunc=(x,y,dark)=>{
        if(x<0||y<0||x>=size||y>=size)return;
        base[y][x]=!!dark;
        reserved[y][x]=true;
    };

    drawFinder(base,reserved,0,0);
    drawFinder(base,reserved,size-7,0);
    drawFinder(base,reserved,0,size-7);

    for(let i=0;i<size;i++){
        setFunc(6,i,i%2===0);
        setFunc(i,6,i%2===0);
    }

    if(spec.align.length){
        for(const ay of [6,...spec.align]){
            for(const ax of [6,...spec.align]){
                if(reserved[ay]?.[ax]) continue;
                drawAlignment(base,reserved,ax,ay);
            }
        }
    }

    setFunc(8,size-8,true); // dark module

    let bitIndex=0;
    let upward=true;
    for(let right=size-1;right>=1;right-=2){
        if(right===6) right--;
        for(let vert=0;vert<size;vert++){
            const y=upward?size-1-vert:vert;
            for(let j=0;j<2;j++){
                const x=right-j;
                if(!reserved[y][x]){
                    base[y][x]=(bitIndex<dataBits.length)?!!dataBits[bitIndex++]:false;
                }
            }
        }
        upward=!upward;
    }

    let best=null;
    for(let mask=0;mask<8;mask++){
        const m=base.map(r=>r.slice());
        for(let y=0;y<size;y++){
            for(let x=0;x<size;x++){
                if(!reserved[y][x] && qrMask(mask,x,y)) m[y][x]=!m[y][x];
            }
        }
        drawFormatBits(m,reserved,mask,size);
        const pen=qrPenalty(m);
        if(!best||pen<best.penalty) best={matrix:m,mask,penalty:pen};
    }

    const quiet=4,cell=10,total=(size+quiet*2)*cell;
    const titleEsc=escapeXml(String(title||"QR"));
    const payloadEsc=escapeXml(String(payload||""));
    const rects=[];
    const matrix=best.matrix;
    for(let y=0;y<size;y++){
        for(let x=0;x<size;x++){
            if(matrix[y][x]) rects.push(`<rect x="${(x+quiet)*cell}" y="${(y+quiet)*cell}" width="${cell}" height="${cell}"/>`);
        }
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${total+74}" viewBox="0 0 ${total} ${total+74}" data-payload="${payloadEsc}">
<title>${titleEsc}</title>
<rect width="100%" height="100%" fill="white"/>
<g fill="black">${rects.join("")}</g>
<text x="${total/2}" y="${total+28}" text-anchor="middle" font-family="monospace" font-size="20" font-weight="bold">${titleEsc}</text>
<text x="${total/2}" y="${total+54}" text-anchor="middle" font-family="monospace" font-size="9">${payloadEsc}</text>
</svg>`;
}

function makeQrTooLargeSvg(payload,title){
    const titleEsc=escapeXml(String(title||"QR"));
    const payloadEsc=escapeXml(String(payload||""));
    return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="260" viewBox="0 0 500 260">
<rect width="100%" height="100%" fill="white"/>
<text x="250" y="70" text-anchor="middle" font-family="monospace" font-size="24" font-weight="bold">${titleEsc}</text>
<text x="250" y="125" text-anchor="middle" font-family="monospace" font-size="16">QR demasiado largo para generador offline.</text>
<text x="250" y="170" text-anchor="middle" font-family="monospace" font-size="10">${payloadEsc}</text>
</svg>`;
}

function escapeXml(s){
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function pushByteTo(arr,b){
    for(let i=7;i>=0;i--) arr.push((b>>>i)&1);
}

function drawFinder(matrix,reserved,x,y){
    const size=matrix.length;
    for(let dy=-1;dy<=7;dy++){
        for(let dx=-1;dx<=7;dx++){
            const xx=x+dx,yy=y+dy;
            if(xx<0||yy<0||xx>=size||yy>=size) continue;
            const dark=(dx>=0&&dx<=6&&dy>=0&&dy<=6&&(dx===0||dx===6||dy===0||dy===6||(dx>=2&&dx<=4&&dy>=2&&dy<=4)));
            matrix[yy][xx]=dark;
            reserved[yy][xx]=true;
        }
    }
}

function drawAlignment(matrix,reserved,cx,cy){
    for(let dy=-2;dy<=2;dy++){
        for(let dx=-2;dx<=2;dx++){
            const xx=cx+dx,yy=cy+dy;
            const dark=Math.max(Math.abs(dx),Math.abs(dy))!==1;
            matrix[yy][xx]=dark;
            reserved[yy][xx]=true;
        }
    }
}

function qrMask(mask,x,y){
    switch(mask){
        case 0:return (x+y)%2===0;
        case 1:return y%2===0;
        case 2:return x%3===0;
        case 3:return (x+y)%3===0;
        case 4:return (Math.floor(y/2)+Math.floor(x/3))%2===0;
        case 5:return ((x*y)%2)+((x*y)%3)===0;
        case 6:return (((x*y)%2)+((x*y)%3))%2===0;
        case 7:return (((x+y)%2)+((x*y)%3))%2===0;
        default:return false;
    }
}

function drawFormatBits(matrix,reserved,mask,size){
    const bits=getFormatBits(mask); // ECC L
    const get=i=>((bits>>>i)&1)!==0;

    for(let i=0;i<=6;i++) matrix[8][i]=get(i);
    matrix[8][7]=get(6);
    matrix[8][8]=get(7);
    matrix[7][8]=get(8);
    for(let i=9;i<15;i++) matrix[14-i][8]=get(i);

    for(let i=0;i<8;i++) matrix[size-1-i][8]=get(i);
    for(let i=8;i<15;i++) matrix[8][size-15+i]=get(i);

    for(let i=0;i<=6;i++) reserved[8][i]=true;
    reserved[8][7]=reserved[8][8]=reserved[7][8]=true;
    for(let i=9;i<15;i++) reserved[14-i][8]=true;
    for(let i=0;i<8;i++) reserved[size-1-i][8]=true;
    for(let i=8;i<15;i++) reserved[8][size-15+i]=true;
}

function getFormatBits(mask){
    const data=(1<<3)|mask; // ECC level L = 01
    let rem=data<<10;
    for(let i=14;i>=10;i--){
        if(((rem>>>i)&1)!==0) rem^=0x537<<(i-10);
    }
    return ((data<<10)|rem)^0x5412;
}

const QR_EXP=(()=>{const e=Array(512);let x=1;for(let i=0;i<255;i++){e[i]=x;x<<=1;if(x&0x100)x^=0x11D;}for(let i=255;i<512;i++)e[i]=e[i-255];return e;})();
const QR_LOG=(()=>{const l=Array(256).fill(0);for(let i=0;i<255;i++)l[QR_EXP[i]]=i;return l;})();

function gfMul(a,b){
    if(a===0||b===0)return 0;
    return QR_EXP[QR_LOG[a]+QR_LOG[b]];
}

function qrPolyMul(p,q){
    const r=Array(p.length+q.length-1).fill(0);
    for(let i=0;i<p.length;i++) for(let j=0;j<q.length;j++) r[i+j]^=gfMul(p[i],q[j]);
    return r;
}

function qrReedSolomonGenerator(deg){
    let g=[1];
    for(let i=0;i<deg;i++) g=qrPolyMul(g,[1,QR_EXP[i]]);
    return g;
}

function qrReedSolomonCompute(data,eccLen){
    const gen=qrReedSolomonGenerator(eccLen);
    const res=Array(eccLen).fill(0);
    for(const b of data){
        const factor=b^res.shift();
        res.push(0);
        for(let i=0;i<eccLen;i++) res[i]^=gfMul(gen[i+1],factor);
    }
    return res;
}

function qrPenalty(m){
    const size=m.length;
    let penalty=0;

    for(let y=0;y<size;y++){
        let runColor=m[y][0],run=1;
        for(let x=1;x<size;x++){
            if(m[y][x]===runColor){run++; if(run===5)penalty+=3; else if(run>5)penalty++;}
            else{runColor=m[y][x];run=1;}
        }
    }

    for(let x=0;x<size;x++){
        let runColor=m[0][x],run=1;
        for(let y=1;y<size;y++){
            if(m[y][x]===runColor){run++; if(run===5)penalty+=3; else if(run>5)penalty++;}
            else{runColor=m[y][x];run=1;}
        }
    }

    for(let y=0;y<size-1;y++){
        for(let x=0;x<size-1;x++){
            const c=m[y][x];
            if(m[y][x+1]===c&&m[y+1][x]===c&&m[y+1][x+1]===c) penalty+=3;
        }
    }

    const pattern=[true,false,true,true,true,false,true,false,false,false,false];
    for(let y=0;y<size;y++){
        for(let x=0;x<=size-11;x++){
            let ok=true,okr=true;
            for(let k=0;k<11;k++){if(m[y][x+k]!==pattern[k])ok=false;if(m[y][x+k]!==pattern[10-k])okr=false;}
            if(ok||okr)penalty+=40;
        }
    }
    for(let x=0;x<size;x++){
        for(let y=0;y<=size-11;y++){
            let ok=true,okr=true;
            for(let k=0;k<11;k++){if(m[y+k][x]!==pattern[k])ok=false;if(m[y+k][x]!==pattern[10-k])okr=false;}
            if(ok||okr)penalty+=40;
        }
    }

    let dark=0;
    for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(m[y][x])dark++;
    const total=size*size;
    const k=Math.abs(Math.floor((dark*20)/total)-10);
    penalty+=k*10;

    return penalty;
}

async function addQrFileToZip(folder, filenameBase, payload, label){
    folder.file(`PAYLOAD_${filenameBase}.txt`, payload);

    if(window.QRCode && typeof QRCode.toDataURL==="function"){
        try{
            const dataUrl=await QRCode.toDataURL(payload,{margin:4,width:500,errorCorrectionLevel:"M"});
            folder.file(`QR_${filenameBase}.png`,dataUrl.split(",")[1],{base64:true});
            return "png";
        }catch(e){
            console.warn("QR PNG falló, creando SVG:", filenameBase, e);
        }
    }

    // Respaldo visual sin depender de librería externa.
    folder.file(`QR_${filenameBase}.svg`, makeOfflineQrSvg(payload,label||filenameBase));
    return "svg";
}

async function qrDataUrlForPrint(payload,width=900){
    if(window.QRCode && typeof QRCode.toDataURL==="function"){
        try{
            return await QRCode.toDataURL(payload,{margin:4,width,errorCorrectionLevel:"M"});
        }catch(e){
            console.warn("QR imprimible PNG falló, creando SVG:", e);
        }
    }
    if(typeof makeOfflineQrSvg==="function"){
        return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(makeOfflineQrSvg(payload,"QR"));
    }
    return "";
}

function pointQrPrintTitle(point){
    const id=String(point?.id||"").toUpperCase();
    if(id==="START")return "SALIDA";
    if(id==="FINISH")return "LLEGADA";
    return `BALIZA ${id}`;
}

function safePointFilename(id){
    return String(id||"PUNTO").toUpperCase().replace(/[^A-Z0-9_-]+/g,"_");
}

function pointPrintEventLabel(){
    const name=String(state.eventName||"").trim();
    const id=String(state.eventId||"").trim();
    if(name && id && name!==id)return `${name}<br><small>${id}</small>`;
    return name||id||"—";
}

function pointLatLonMeta(point){
    const lat=Number(point?.lat);
    const lon=Number(point?.lon);
    if(Number.isFinite(lat)&&Number.isFinite(lon))return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    return "—";
}

function controlQrPrintCss(){
    return `
@page{size:A4 portrait;margin:0}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#e9e4d5;color:#111;font-family:"Arial Black",Arial,Helvetica,sans-serif}.print-sheet{width:210mm;height:297mm;margin:0 auto;background:#fffdf5;display:flex;flex-direction:column;border:0;break-after:page;page-break-after:always;overflow:hidden}.print-sheet:last-child{break-after:auto;page-break-after:auto}.print-head{height:28mm;background:linear-gradient(180deg,#18230f,#2f441e);color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;padding:3mm 10mm;border-bottom:2.2mm solid #e5ae4f}.print-head .label{font-size:8pt;letter-spacing:2pt;font-weight:900;color:#ffe2a0;margin-bottom:1mm}.print-head .id{font-size:46pt;line-height:.86;letter-spacing:2.2pt;font-weight:900;text-shadow:0 1mm 0 rgba(0,0,0,.25)}.print-body{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:4mm 10mm 5mm}.qr-frame{width:178mm;height:178mm;border:2mm solid #111;border-radius:7mm;background:#fff;display:flex;align-items:center;justify-content:center;padding:5mm;margin-top:2mm}.qr-frame img{width:164mm;height:164mm;object-fit:contain;image-rendering:pixelated}.mini-id{margin-top:3.4mm;font-size:30pt;line-height:.95;font-weight:900;letter-spacing:1.5pt;color:#18230f}.desc{margin-top:1.5mm;min-height:6mm;text-align:center;font-size:10pt;font-family:Arial,Helvetica,sans-serif;font-weight:800;color:#3b2b18;max-width:185mm}.meta{margin-top:5mm;width:100%;display:grid;grid-template-columns:1fr 1fr;gap:1.8mm;font-family:"Courier New",monospace;font-size:7.2pt;font-weight:900;color:#111}.meta div{border:1px solid #111;border-radius:1.8mm;padding:1.25mm 2mm;background:#f7efd8;min-height:7.8mm}.meta small{font-size:6.4pt;font-weight:900}.payload{grid-column:1/3;word-break:break-all;font-size:6.1pt;background:#f2f2f2!important}.brand{display:none!important}@media print{body{background:#fff}.print-sheet{margin:0;box-shadow:none}.no-print{display:none!important}}`;
}
function printableControlQrPageHtml(point,payload,qrDataUrl){
    const id=String(point?.id||"").toUpperCase();
    const title=pointQrPrintTitle(point);
    const desc=point?.desc?String(point.desc):"";
    const type=point?.type||"PUNTO";
    const utm=point?.utm||"";
    const qrImg=qrDataUrl||"";
    const eventLabel=pointPrintEventLabel();
    const latLon=pointLatLonMeta(point);
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${escapeHtml(title)} · QR imprimible</title><style>${controlQrPrintCss()}</style></head><body><div class="print-sheet"><header class="print-head"><div><div class="label">ID DEL PUNTO</div><div class="id">${escapeHtml(id)}</div></div></header><main class="print-body"><div class="qr-frame"><img src="${escapeHtml(qrImg)}" alt="QR ${escapeHtml(id)}"></div><div class="mini-id">${escapeHtml(title)}</div><div class="desc">${escapeHtml(desc||"Escanear este QR en el punto correspondiente.")}</div><section class="meta"><div><b>EVENTO</b><br>${eventLabel}</div><div><b>TIPO</b><br>${escapeHtml(type)}</div><div><b>UTM</b><br>${escapeHtml(utm||"—")}</div><div><b>COORDENADAS</b><br>${escapeHtml(latLon)}</div><div><b>APP</b><br>MILITOPO · ORIENTACIÓN</div><div><b>ID PUNTO</b><br>${escapeHtml(id)}</div><div class="payload"><b>PAYLOAD</b><br>${escapeHtml(payload)}</div></section></main></div></body></html>`;
}

function printableAllControlQrsHtml(items){
    const eventLabel=pointPrintEventLabel();
    const sheets=items.map(item=>{
        const point=item.point||{};
        const id=String(point.id||"").toUpperCase();
        const title=pointQrPrintTitle(point);
        const desc=point.desc?String(point.desc):"";
        const type=point.type||"PUNTO";
        const utm=point.utm||"";
        const latLon=pointLatLonMeta(point);
        return `<div class="print-sheet"><header class="print-head"><div><div class="label">ID DEL PUNTO</div><div class="id">${escapeHtml(id)}</div></div></header><main class="print-body"><div class="qr-frame"><img src="${escapeHtml(item.qrDataUrl||"")}" alt="QR ${escapeHtml(id)}"></div><div class="mini-id">${escapeHtml(title)}</div><div class="desc">${escapeHtml(desc||"Escanear este QR en el punto correspondiente.")}</div><section class="meta"><div><b>EVENTO</b><br>${eventLabel}</div><div><b>TIPO</b><br>${escapeHtml(type)}</div><div><b>UTM</b><br>${escapeHtml(utm||"—")}</div><div><b>COORDENADAS</b><br>${escapeHtml(latLon)}</div><div><b>APP</b><br>MILITOPO · ORIENTACIÓN</div><div><b>ID PUNTO</b><br>${escapeHtml(id)}</div><div class="payload"><b>PAYLOAD</b><br>${escapeHtml(item.payload||"")}</div></section></main></div>`;
    }).join("\n");
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>QR imprimibles · salida, balizas y llegada</title><style>${controlQrPrintCss()}</style></head><body>${sheets}</body></html>`;
}


async function addPrintableControlQrToZip(controlsFolder,point,payload){
    // Solo prepara la hoja para el archivo general. No crea un HTML por cada punto.
    const qrDataUrl=await qrDataUrlForPrint(payload,1200);
    return {point,payload,qrDataUrl};
}


function participantQrPrintCss(){
    return `
@page{size:A4 portrait;margin:8mm}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif}.sheet{width:194mm;min-height:281mm;margin:0 auto;background:#fff;display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:136mm;gap:6mm;break-after:page;page-break-after:always}.sheet:last-child{break-after:auto;page-break-after:auto}.participant-card{border:1.8mm solid #000;border-radius:3mm;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;text-align:center;padding:6mm 5mm;overflow:hidden}.pid-label{font-size:9pt;letter-spacing:1.8pt;font-weight:900;text-transform:uppercase;margin:0 0 1.5mm}.pid{font-size:36pt;line-height:.95;font-weight:900;letter-spacing:1pt;margin:0 0 4mm}.participant-qr{width:68mm;height:68mm;border:1.2mm solid #000;padding:3mm;background:#fff;display:flex;align-items:center;justify-content:center;margin:0 auto 4mm}.participant-qr img{width:60mm;height:60mm;object-fit:contain;image-rendering:pixelated}.event-info{width:100%;border-top:1.2px solid #000;padding-top:3mm;font-size:10pt;line-height:1.25;font-weight:800;text-align:left;word-break:break-word}.event-info b{font-weight:900}.empty-card{border:0}.print-note{display:none}@media screen{body{background:#eee}.sheet{margin:12px auto;box-shadow:0 3px 20px rgba(0,0,0,.18)}}@media print{body{background:#fff}.sheet{margin:0;box-shadow:none}.print-note{display:none!important}}`;
}

function participantPrintEventName(){
    return String(state.eventName||"ENTRENAMIENTO ORIENTACIÓN").trim()||"ENTRENAMIENTO ORIENTACIÓN";
}

function printableAllParticipantQrsHtml(items){
    const eventName=participantPrintEventName();
    const eventCode=String(state.eventId||"").trim()||"—";
    const cards=items.map(item=>{
        const route=item.route||{};
        const pid=String(route.participantId||"").toUpperCase();
        return `<article class="participant-card"><div class="pid-label">ID PARTICIPANTE</div><div class="pid">${escapeHtml(pid)}</div><div class="participant-qr"><img src="${escapeHtml(item.qrDataUrl||"")}" alt="QR ${escapeHtml(pid)}"></div><div class="event-info"><b>Ejercicio:</b> ${escapeHtml(eventName)}<br><b>Código:</b> ${escapeHtml(eventCode)}</div></article>`;
    });
    while(cards.length%4!==0)cards.push(`<article class="participant-card empty-card"></article>`);
    const sheets=[];
    for(let i=0;i<cards.length;i+=4){
        sheets.push(`<section class="sheet">${cards.slice(i,i+4).join("")}</section>`);
    }
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>QR participantes · ${escapeHtml(eventCode)}</title><style>${participantQrPrintCss()}</style></head><body>${sheets.join("\n")}</body></html>`;
}

async function addPrintableParticipantQrItem(route,payload){
    const qrDataUrl=await qrDataUrlForPrint(payload,1200);
    return {route,payload,qrDataUrl};
}


function pdfSafeText(value){
    return String(value??"").replace(/<br\s*\/?\s*>/gi," · ").replace(/\s+/g," ").trim();
}

function pdfTextLines(doc,text,maxWidth){
    const clean=pdfSafeText(text)||"—";
    try{return doc.splitTextToSize(clean,maxWidth);}
    catch(e){return [clean];}
}

async function printableQrPngDataUrl(dataUrl,size=1200){
    const src=String(dataUrl||"");
    if(src.startsWith("data:image/png"))return src;
    return await new Promise((resolve,reject)=>{
        const img=new Image();
        img.onload=()=>{
            try{
                const canvas=document.createElement("canvas");
                canvas.width=size;
                canvas.height=size;
                const ctx=canvas.getContext("2d");
                ctx.fillStyle="#ffffff";
                ctx.fillRect(0,0,size,size);
                ctx.drawImage(img,0,0,size,size);
                resolve(canvas.toDataURL("image/png"));
            }catch(e){reject(e);}
        };
        img.onerror=()=>reject(new Error("No se pudo convertir el QR a PNG para PDF"));
        img.src=src;
    });
}

function participantDisplayNameForPdf(route){
    const pid=String(route?.participantId||"").toUpperCase();
    const rid=String(route?.routeId||"").toUpperCase();
    return rid?`${pid} · ${rid}`:pid;
}

function drawPdfLabelValue(doc,label,value,x,y,w,h,opts={}){
    doc.setDrawColor(30,30,30);
    doc.setLineWidth(0.25);
    doc.rect(x,y,w,h);
    doc.setFont("helvetica","bold");
    doc.setFontSize(opts.labelSize||6.5);
    doc.text(String(label||"").toUpperCase(),x+2,y+3.2);
    doc.setFont("helvetica",opts.boldValue?"bold":"normal");
    doc.setFontSize(opts.valueSize||8);
    const lines=pdfTextLines(doc,value,w-4).slice(0,opts.maxLines||3);
    doc.text(lines,x+2,y+7);
}

async function printableParticipantsQrPdfBlob(items){
    const jsPDF=await ensureJsPdf();
    const doc=new jsPDF({orientation:"portrait",unit:"mm",format:"a4",compress:true});
    const pageW=210,pageH=297,margin=8,gap=6;
    const cardW=(pageW-margin*2-gap)/2;
    const cardH=(pageH-margin*2-gap)/2;
    const eventName=participantPrintEventName();
    const eventCode=String(state.eventId||"").trim()||"—";
    const generatedAt=new Date().toLocaleString("es-ES");

    for(let i=0;i<items.length;i++){
        if(i>0 && i%4===0)doc.addPage("a4","portrait");
        const pos=i%4;
        const col=pos%2,row=Math.floor(pos/2);
        const x=margin+col*(cardW+gap);
        const y=margin+row*(cardH+gap);
        const route=items[i].route||{};
        const pid=String(route.participantId||"").toUpperCase();
        const rid=String(route.routeId||"").toUpperCase();
        const payload=String(items[i].payload||"");
        const payloadDisplay=payload.length>110?payload.slice(0,110)+"…":payload;
        const qr=await printableQrPngDataUrl(items[i].qrDataUrl,1200);

        doc.setDrawColor(0,0,0);
        doc.setLineWidth(0.8);
        doc.rect(x,y,cardW,cardH);

        doc.setFillColor(245,245,245);
        doc.rect(x,y,cardW,17,"F");
        doc.setFont("helvetica","bold");
        doc.setFontSize(7.5);
        doc.text("ID PARTICIPANTE",x+4,y+5.5);
        doc.setFontSize(28);
        doc.text(pid||"—",x+4,y+15.2);
        if(rid){
            doc.setFontSize(10);
            doc.text(rid,x+cardW-4,y+13.8,{align:"right"});
        }

        const qrSize=62;
        const qrX=x+(cardW-qrSize)/2;
        const qrY=y+21;
        doc.setLineWidth(0.55);
        doc.rect(qrX-2,qrY-2,qrSize+4,qrSize+4);
        doc.addImage(qr,"PNG",qrX,qrY,qrSize,qrSize,undefined,"FAST");

        let infoY=qrY+qrSize+8;
        drawPdfLabelValue(doc,"Ejercicio",eventName,x+4,infoY,cardW-8,12,{valueSize:7.2,maxLines:2});
        infoY+=14;
        drawPdfLabelValue(doc,"Evento",eventCode,x+4,infoY,(cardW-10)/2,10,{valueSize:7,maxLines:1,boldValue:true});
        drawPdfLabelValue(doc,"Recorrido",rid||"—",x+5+(cardW-10)/2,infoY,(cardW-10)/2,10,{valueSize:7,maxLines:1,boldValue:true});
        infoY+=12;
        drawPdfLabelValue(doc,"Payload",payloadDisplay,x+4,infoY,cardW-8,15,{valueSize:5.8,maxLines:3});
        doc.setFont("helvetica","normal");
        doc.setFontSize(5.5);
        doc.text(`MILITOPO · ORIENTACIÓN · ${generatedAt}`,x+cardW/2,y+cardH-3,{align:"center"});
    }
    return doc.output("blob");
}

async function printableControlsQrPdfBlob(items){
    const jsPDF=await ensureJsPdf();
    const doc=new jsPDF({orientation:"portrait",unit:"mm",format:"a4",compress:true});
    const pageW=210,pageH=297,margin=8,gap=6;
    const eventName=participantPrintEventName();
    const eventCode=String(state.eventId||"").trim()||"—";
    const generatedAt=new Date().toLocaleString("es-ES");
    let hasContent=false;

    const pointGroup=item=>{
        const point=item?.point||{};
        const id=String(point.id||"").toUpperCase();
        const type=String(point.type||"").toUpperCase();
        if(id==="START"||type==="SALIDA"||type==="START")return "start";
        if(id==="FINISH"||type==="LLEGADA"||type==="FINISH")return "finish";
        return "control";
    };

    const newSheet=()=>{
        if(hasContent)doc.addPage("a4","portrait");
        hasContent=true;
    };

    const drawOuterFrame=()=>{
        doc.setDrawColor(0,0,0);
        doc.setLineWidth(0.25);
        doc.rect(margin,margin,pageW-margin*2,pageH-margin*2);
    };

    const drawControlQrCard=async(item,x,y,w,h,mode)=>{
        const point=item?.point||{};
        const id=String(point.id||"").toUpperCase();
        const title=pointQrPrintTitle(point);
        const type=String(point.type||"PUNTO");
        const desc=String(point.desc||"Escanear este QR en el punto correspondiente.");
        const utm=String(point.utm||"—");
        const latLon=pointLatLonMeta(point);
        const qr=await printableQrPngDataUrl(item.qrDataUrl,1400);
        const isHalf=mode==="half";

        doc.setDrawColor(0,0,0);
        doc.setLineWidth(isHalf?0.55:0.42);
        doc.roundedRect(x,y,w,h,3,3);

        doc.setFillColor(24,35,15);
        doc.roundedRect(x,y,w,isHalf?18:16,3,3,"F");
        doc.setTextColor(255,255,255);
        doc.setFont("helvetica","bold");
        doc.setFontSize(isHalf?7.5:6.8);
        doc.text("ID DEL PUNTO",x+w/2,y+(isHalf?5.2:4.7),{align:"center"});
        doc.setFontSize(isHalf?24:20);
        doc.text(id||"—",x+w/2,y+(isHalf?14.5:13.2),{align:"center"});
        doc.setTextColor(0,0,0);

        const qrSize=isHalf?68:58;
        const qrX=x+(w-qrSize)/2;
        const qrY=y+(isHalf?24:21);
        doc.setLineWidth(isHalf?0.8:0.58);
        doc.rect(qrX-2,qrY-2,qrSize+4,qrSize+4);
        if(qr)doc.addImage(qr,"PNG",qrX,qrY,qrSize,qrSize,undefined,"FAST");

        const titleY=qrY+qrSize+(isHalf?8:7.2);
        doc.setFont("helvetica","bold");
        doc.setFontSize(isHalf?15:12.5);
        doc.text(pdfSafeText(title),x+w/2,titleY,{align:"center"});

        const boxGap=2;
        const boxW=(w-10-boxGap)/2;
        const left=x+5;
        const right=left+boxW+boxGap;

        if(isHalf){
            // SALIDA y LLEGADA comparten una hoja A4: formato más limpio y compacto.
            // Solo se imprimen los recuadros necesarios: Ejercicio y Evento.
            const infoY=y+h-17;
            drawPdfLabelValue(doc,"Ejercicio",eventName,left,infoY,boxW,11,{valueSize:6.4,maxLines:1});
            drawPdfLabelValue(doc,"Evento",eventCode,right,infoY,boxW,11,{valueSize:6.4,maxLines:1,boldValue:true});
            return;
        }

        doc.setFont("helvetica","normal");
        doc.setFontSize(6.5);
        const descLines=pdfTextLines(doc,desc,w-12).slice(0,1);
        doc.text(descLines,x+w/2,titleY+4.7,{align:"center"});

        const infoY=y+h-30;
        drawPdfLabelValue(doc,"Ejercicio",eventName,left,infoY,boxW,10,{valueSize:5.8,maxLines:1});
        drawPdfLabelValue(doc,"Evento",eventCode,right,infoY,boxW,10,{valueSize:5.8,maxLines:1,boldValue:true});
        drawPdfLabelValue(doc,"Tipo",type,left,infoY+12,boxW,8.6,{valueSize:5.8,maxLines:1,boldValue:true});
        drawPdfLabelValue(doc,"Coord.",latLon,right,infoY+12,boxW,8.6,{valueSize:5.3,maxLines:1});
    };

    const startItem=(items||[]).find(item=>pointGroup(item)==="start");
    const finishItem=(items||[]).find(item=>pointGroup(item)==="finish");
    const controlItems=(items||[])
        .filter(item=>pointGroup(item)==="control")
        .sort((a,b)=>String(a?.point?.id||"").localeCompare(String(b?.point?.id||""),"es",{numeric:true}));

    if(startItem||finishItem){
        newSheet();
        drawOuterFrame();
        doc.setFont("helvetica","bold");
        doc.setFontSize(9);
        doc.text("QR SALIDA Y LLEGADA",pageW/2,margin+5,{align:"center"});
        const cardW=pageW-margin*2-8;
        const cardH=(pageH-margin*2-13)/2;
        const x=margin+4;
        const y1=margin+9;
        const y2=y1+cardH+5;
        if(startItem)await drawControlQrCard(startItem,x,y1,cardW,cardH,"half");
        if(finishItem)await drawControlQrCard(finishItem,x,y2,cardW,cardH,"half");
        doc.setFont("helvetica","normal");
        doc.setFontSize(5.8);
        doc.text(`MILITOPO · ORIENTACIÓN · ${generatedAt}`,pageW/2,pageH-margin-2,{align:"center"});
    }

    for(let i=0;i<controlItems.length;i+=4){
        newSheet();
        drawOuterFrame();
        doc.setFont("helvetica","bold");
        doc.setFontSize(9);
        doc.text("QR BALIZAS",pageW/2,margin+5,{align:"center"});
        const usableW=pageW-margin*2-8;
        const usableH=pageH-margin*2-13;
        const cardW=(usableW-gap)/2;
        const cardH=(usableH-gap)/2;
        const baseX=margin+4;
        const baseY=margin+9;
        const pageItems=controlItems.slice(i,i+4);
        for(let j=0;j<pageItems.length;j++){
            const col=j%2;
            const row=Math.floor(j/2);
            const x=baseX+col*(cardW+gap);
            const y=baseY+row*(cardH+gap);
            await drawControlQrCard(pageItems[j],x,y,cardW,cardH,"quarter");
        }
        doc.setFont("helvetica","normal");
        doc.setFontSize(5.8);
        doc.text(`MILITOPO · ORIENTACIÓN · ${generatedAt}`,pageW/2,pageH-margin-2,{align:"center"});
    }

    if(!hasContent){
        doc.setFont("helvetica","bold");
        doc.setFontSize(14);
        doc.text("No hay QR de balizas para imprimir",pageW/2,pageH/2,{align:"center"});
    }

    return doc.output("blob");
}


async function participantAccessWebQrPdfBlob(){
    const jsPDF=await ensureJsPdf();
    const eventName=participantPrintEventName();
    const eventCode=String(state.eventId||"").trim()||"—";
    const routes=(state.routes||[]).filter(r=>r&&!isRouteSkipped(r));
    const pdf=new jsPDF({orientation:"portrait",unit:"mm",format:"a4",compress:true});
    const pageW=210,pageH=297,margin=8,gap=6;
    const cardW=(pageW-margin*2-gap)/2;
    const cardH=(pageH-margin*2-gap)/2;
    const generatedAt=new Date().toLocaleString("es-ES");

    for(let i=0;i<routes.length;i++){
        if(i>0 && i%4===0)pdf.addPage("a4","portrait");
        const pos=i%4;
        const col=pos%2,row=Math.floor(pos/2);
        const x=margin+col*(cardW+gap);
        const y=margin+row*(cardH+gap);
        const route=routes[i];
        const pid=String(route.participantId||"").toUpperCase();
        const rid=String(route.routeId||"").toUpperCase();
        const url=participantWebUrl(route.participantId);
        const qrDataUrl=await qrDataUrlForPrint(url,1200);

        pdf.setFillColor(255,255,255);
        pdf.rect(x,y,cardW,cardH,"F");
        pdf.setDrawColor(0,0,0);
        pdf.setLineWidth(.55);
        pdf.rect(x,y,cardW,cardH,"S");

        pdf.setTextColor(0,0,0);
        pdf.setFont("helvetica","bold");
        pdf.setFontSize(9.5);
        pdf.text("MILITOPO · PARTICIPANTE WEB",x+cardW/2,y+8,{align:"center",maxWidth:cardW-8});
        pdf.setFontSize(8.2);
        pdf.text(`${pid} · ${rid}`,x+cardW/2,y+15,{align:"center"});
        pdf.setFont("helvetica","normal");
        pdf.setFontSize(6.5);
        pdf.text(eventName,x+cardW/2,y+21,{align:"center",maxWidth:cardW-8});

        const qrSize=Math.min(70,cardW-24);
        const qrX=x+(cardW-qrSize)/2;
        const qrY=y+28;
        pdf.setLineWidth(.7);
        pdf.rect(qrX-2,qrY-2,qrSize+4,qrSize+4,"S");
        pdf.addImage(qrDataUrl,"PNG",qrX,qrY,qrSize,qrSize,undefined,"FAST");

        pdf.setFont("helvetica","bold");
        pdf.setFontSize(7.2);
        pdf.text("Escanear con cámara del móvil",x+cardW/2,qrY+qrSize+9,{align:"center"});
        pdf.setFont("helvetica","normal");
        pdf.setFontSize(5.5);
        const note=[
            "Abre la misma rama Orientación en modo participante.",
            "El recorrido compacto va dentro del QR.",
            `Evento: ${eventCode}`,
            `Generado: ${generatedAt}`
        ];
        let yy=qrY+qrSize+16;
        note.forEach(line=>{
            pdf.text(line,x+cardW/2,yy,{align:"center",maxWidth:cardW-10});
            yy+=5.2;
        });
    }

    if(!routes.length){
        pdf.setFont("helvetica","bold");
        pdf.setFontSize(14);
        pdf.text("No hay recorridos activos para generar QR web participante.",105,145,{align:"center",maxWidth:180});
    }

    return pdf.output("blob");
}


function participantOfflineAppHtml(eventData){
    const bin=atob("PCFET0NUWVBFIGh0bWw+PGh0bWwgbGFuZz0iZXMiPjxoZWFkPjxtZXRhIGNoYXJzZXQ9IlVURi04Ij48bWV0YSBuYW1lPSJ2aWV3cG9ydCIgY29udGVudD0id2lkdGg9ZGV2aWNlLXdpZHRoLGluaXRpYWwtc2NhbGU9MS4wIj48dGl0bGU+TUlMSVRPUE8gUGFydGljaXBhbnRlPC90aXRsZT4KPHN0eWxlPgo6cm9vdHstLXA6IzM0NDcyNDstLWc6I2YwYzE2YTstLWM6I2Y1ZTZjODstLW06I2NiYjg5NDstLXI6I2M4NWU0NTstLXY6IzhiYjU2YX0qe2JveC1zaXppbmc6Ym9yZGVyLWJveH1ib2R5e21hcmdpbjowO2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE4MGRlZywjMTAxOTBiLCMyMDI5MTYsIzE1MWIxMCk7Y29sb3I6dmFyKC0tYyk7Zm9udC1mYW1pbHk6IkNvdXJpZXIgTmV3Iixtb25vc3BhY2V9LmFwcHttYXgtd2lkdGg6NzYwcHg7bWFyZ2luOmF1dG87cGFkZGluZzoxNnB4IDEycHggNDRweH0uY2FyZHtib3JkZXItcmFkaXVzOjI4cHg7bWFyZ2luOjAgMCAxNnB4O3BhZGRpbmc6MThweDtiYWNrZ3JvdW5kOnJhZGlhbC1ncmFkaWVudChjaXJjbGUgYXQgODglIDEwJSxyZ2JhKDI0MCwxOTMsMTA2LC4xMyksdHJhbnNwYXJlbnQgMjYlKSxsaW5lYXItZ3JhZGllbnQoMTgwZGVnLHJnYmEoMjU1LDI1NSwyNTUsLjA5KSxyZ2JhKDI1NSwyNTUsMjU1LC4wMzUpKSx2YXIoLS1wKTtib3JkZXI6MXB4IHNvbGlkIHJnYmEoMjMwLDE4OCwxMjIsLjI4KTtib3gtc2hhZG93OjAgMThweCA0NHB4IHJnYmEoMCwwLDAsLjI2KX1oMSxoMnttYXJnaW46MCAwIDEycHg7Y29sb3I6dmFyKC0tZyk7bGV0dGVyLXNwYWNpbmc6MnB4fS5zdGF0dXN7Ym9yZGVyLXJhZGl1czoxOHB4O3BhZGRpbmc6MTJweDttYXJnaW4tdG9wOjEwcHg7YmFja2dyb3VuZDpyZ2JhKDAsMCwwLC4xNik7Ym9yZGVyOjFweCBzb2xpZCByZ2JhKDIzMCwxODgsMTIyLC4zNSk7Zm9udC13ZWlnaHQ6OTAwO2xpbmUtaGVpZ2h0OjEuMzV9Lm9re2JvcmRlci1jb2xvcjpyZ2JhKDEzOSwxODEsMTA2LC42KTtiYWNrZ3JvdW5kOnJnYmEoMTM5LDE4MSwxMDYsLjE2KX0uZXJye2JvcmRlci1jb2xvcjpyZ2JhKDIwMCw5NCw2OSwuNik7YmFja2dyb3VuZDpyZ2JhKDIwMCw5NCw2OSwuMTQpfS5idG57d2lkdGg6MTAwJTttaW4taGVpZ2h0OjU0cHg7Ym9yZGVyOjA7Ym9yZGVyLXJhZGl1czo5OTlweDttYXJnaW4tdG9wOjEwcHg7Zm9udC1mYW1pbHk6aW5oZXJpdDtmb250LXdlaWdodDo5MDA7bGV0dGVyLXNwYWNpbmc6LjhweDtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxODBkZWcsdmFyKC0tZyksI2Q3OTczNSk7Y29sb3I6IzI2MTcwOH0uZ3JlZW57YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTgwZGVnLCM4YmI1NmEsIzVmODgzOCk7Y29sb3I6I2Y3ZmZlOX0ucmVke2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDE4MGRlZywjYzg1ZTQ1LCM5NjNkMmIpO2NvbG9yOiNmZmY0ZTl9LnNlY29uZGFyeXtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxODBkZWcsIzU3M2EyMiwjMzMyNDE5KTtjb2xvcjp2YXIoLS1jKX1pbnB1dCx0ZXh0YXJlYXt3aWR0aDoxMDAlO21pbi1oZWlnaHQ6NDhweDtib3JkZXItcmFkaXVzOjE2cHg7Ym9yZGVyOjFweCBzb2xpZCByZ2JhKDIzMCwxODgsMTIyLC40NSk7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTgwZGVnLCM0ZTM3MjIsIzMzMjYxYik7Y29sb3I6dmFyKC0tYyk7Zm9udC1mYW1pbHk6aW5oZXJpdDtmb250LXdlaWdodDo5MDA7cGFkZGluZzoxMnB4O21hcmdpbi10b3A6MTBweH0ucm91dGV7Zm9udC1zaXplOjFyZW07bGluZS1oZWlnaHQ6MS41NTtmb250LXdlaWdodDo5MDB9Lm5leHR7Zm9udC1zaXplOmNsYW1wKDEuNXJlbSw4dncsMi42cmVtKTt0ZXh0LWFsaWduOmNlbnRlcjtjb2xvcjp2YXIoLS1nKTtwYWRkaW5nOjE2cHg7Ym9yZGVyLXJhZGl1czoyMnB4O2JhY2tncm91bmQ6cmdiYSgwLDAsMCwuMTgpO2JvcmRlcjoxcHggc29saWQgcmdiYSgyMzAsMTg4LDEyMiwuMzUpO21hcmdpbi10b3A6MTJweH0uc2NhbntkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjgycHggMWZyIGF1dG87Z2FwOjhweDtib3JkZXItcmFkaXVzOjE0cHg7cGFkZGluZzoxMHB4O21hcmdpbi10b3A6OHB4O2JhY2tncm91bmQ6cmdiYSgwLDAsMCwuMTUpO2JvcmRlcjoxcHggc29saWQgcmdiYSgyMzAsMTg4LDEyMiwuMil9LnNjYW4ub2t7Ym9yZGVyLWNvbG9yOnJnYmEoMTM5LDE4MSwxMDYsLjUpfS5zY2FuLmJhZHtib3JkZXItY29sb3I6cmdiYSgyMDAsOTQsNjksLjYpfXZpZGVve3dpZHRoOjEwMCU7bWF4LWhlaWdodDozODBweDtib3JkZXItcmFkaXVzOjE4cHg7YmFja2dyb3VuZDojMTExO29iamVjdC1maXQ6Y292ZXI7bWFyZ2luLXRvcDoxMHB4fS5xciBpbWd7d2lkdGg6bWluKDkydncsNTIwcHgpO21heC13aWR0aDoxMDAlO2JhY2tncm91bmQ6I2ZmZjtwYWRkaW5nOjE4cHg7Ym9yZGVyLXJhZGl1czoxOHB4O2ltYWdlLXJlbmRlcmluZzpwaXhlbGF0ZWQ7Ym9yZGVyOjRweCBzb2xpZCAjZmZmO2JveC1zaGFkb3c6MCAxMnB4IDMwcHggcmdiYSgwLDAsMCwuMzUpfS5xcnt0ZXh0LWFsaWduOmNlbnRlcjttYXJnaW4tdG9wOjEycHh9LnNtYWxse2NvbG9yOnZhcigtLW0pO2ZvbnQtc2l6ZTouODJyZW07bGluZS1oZWlnaHQ6MS4zNX0ucmVzdWx0LXFyLWluc3RydWN0aW9ue21hcmdpbjoxMnB4IGF1dG8gMTBweDtwYWRkaW5nOjE0cHggMTJweDtib3JkZXItcmFkaXVzOjE4cHg7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTgwZGVnLCNmMGMxNmEsI2Q3OTczNSk7Y29sb3I6IzI0MTcwYTtmb250LXdlaWdodDo5MDA7dGV4dC1hbGlnbjpjZW50ZXI7bGluZS1oZWlnaHQ6MS4zNTtib3JkZXI6MnB4IHNvbGlkIHJnYmEoMjU1LDI1NSwyNTUsLjU1KTtib3gtc2hhZG93OjAgMTBweCAyOHB4IHJnYmEoMCwwLDAsLjM1KTtmb250LXNpemU6MXJlbTttYXgtd2lkdGg6MzEwcHh9CgouY2FtZXJhLW92ZXJsYXl7cG9zaXRpb246Zml4ZWQ7aW5zZXQ6MDt3aWR0aDoxMDB2dztoZWlnaHQ6MTAwZHZoO3otaW5kZXg6OTk5OTk7YmFja2dyb3VuZDpyZ2JhKDQsMTAsNCwuOTgpO2Rpc3BsYXk6bm9uZTthbGlnbi1pdGVtczpzdHJldGNoO2p1c3RpZnktY29udGVudDpmbGV4LXN0YXJ0O3BhZGRpbmc6MDtvdmVyZmxvdzpoaWRkZW59Ci5jYW1lcmEtb3ZlcmxheS5hY3RpdmV7ZGlzcGxheTpmbGV4fQpib2R5LmNhbWVyYS1vcGVue292ZXJmbG93OmhpZGRlbiFpbXBvcnRhbnQ7b3ZlcnNjcm9sbC1iZWhhdmlvcjpub25lO3RvdWNoLWFjdGlvbjpub25lfQouY2FtZXJhLXNoZWxse3dpZHRoOjEwMCU7aGVpZ2h0OjEwMCU7bWF4LWhlaWdodDpub25lO292ZXJmbG93OmhpZGRlbjtib3JkZXItcmFkaXVzOjA7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTgwZGVnLHJnYmEoMjU1LDI1NSwyNTUsLjA5KSxyZ2JhKDI1NSwyNTUsMjU1LC4wMzUpKSwjMzQ0NzI0O2JvcmRlcjowO2JveC1zaGFkb3c6bm9uZTtwYWRkaW5nOm1heCgxMnB4LGVudihzYWZlLWFyZWEtaW5zZXQtdG9wKSkgMTJweCBtYXgoMTJweCxlbnYoc2FmZS1hcmVhLWluc2V0LWJvdHRvbSkpO2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW59Ci5jYW1lcmEtdGl0bGV7ZmxleDowIDAgYXV0bztmb250LXdlaWdodDo5MDA7Y29sb3I6I2YwYzE2YTtsZXR0ZXItc3BhY2luZzoxcHg7Zm9udC1zaXplOjEuMThyZW07bWFyZ2luOjAgMCA4cHg7dGV4dC1hbGlnbjpjZW50ZXJ9Ci5jYW1lcmEtdmlkZW97d2lkdGg6MTAwJTtoZWlnaHQ6YXV0bzttaW4taGVpZ2h0OjA7bWF4LWhlaWdodDpub25lO2ZsZXg6MSAxIGF1dG87Ym9yZGVyLXJhZGl1czoxNnB4O2JhY2tncm91bmQ6IzA1MDUwNTtvYmplY3QtZml0OmNvdmVyO2Rpc3BsYXk6YmxvY2s7Ym9yZGVyOjJweCBzb2xpZCByZ2JhKDI0MCwxOTMsMTA2LC4zNSl9Ci5jYW1lcmEtc2hlbGwgLnN0YXR1c3tmbGV4OjAgMCBhdXRvO21hcmdpbi10b3A6OHB4O3BhZGRpbmc6OXB4IDEwcHh9Ci5jYW1lcmEtaGVscHtmbGV4OjAgMCBhdXRvO2ZvbnQtc2l6ZTouNzhyZW07Y29sb3I6I2NiYjg5NDtsaW5lLWhlaWdodDoxLjI1O21hcmdpbi10b3A6N3B4O3RleHQtYWxpZ246Y2VudGVyfQouY2FtZXJhLXNoZWxsPi5idG57ZmxleDowIDAgYXV0bzttYXJnaW4tdG9wOjhweDttaW4taGVpZ2h0OjQ4cHh9CgoKLm9mZmxpbmUtc2FmZXtib3JkZXI6MnB4IHNvbGlkIHJnYmEoMjQwLDE5MywxMDYsLjY1KTtiYWNrZ3JvdW5kOnJnYmEoMjQwLDE5MywxMDYsLjEzKTtib3gtc2hhZG93OjAgMTBweCAyOHB4IHJnYmEoMCwwLDAsLjI4KX0KLnJlY292ZXJ5LWFjdGlvbnN7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnI7Z2FwOjhweDttYXJnaW4tdG9wOjEwcHh9Ci5zYXZlLXBpbGx7ZGlzcGxheTppbmxpbmUtYmxvY2s7bWFyZ2luLXRvcDo4cHg7cGFkZGluZzo2cHggMTBweDtib3JkZXItcmFkaXVzOjk5OXB4O2JhY2tncm91bmQ6cmdiYSgxMzksMTgxLDEwNiwuMTgpO2JvcmRlcjoxcHggc29saWQgcmdiYSgxMzksMTgxLDEwNiwuNTUpO2ZvbnQtc2l6ZTouNzhyZW07Zm9udC13ZWlnaHQ6OTAwO2NvbG9yOiNlYWZmZDh9Ci5iaWctd2Fybntmb250LXNpemU6MS4wNXJlbTtib3JkZXItd2lkdGg6MnB4IWltcG9ydGFudDt0ZXh0LWFsaWduOmNlbnRlcn0KLm9mZmxpbmUtcmVhZHktdGl0bGV7Zm9udC1zaXplOjEuMTJyZW07bGV0dGVyLXNwYWNpbmc6MXB4O21hcmdpbi1ib3R0b206MTBweDt0ZXh0LWFsaWduOmNlbnRlcjtjb2xvcjojZjBjMTZhfQoub2ZmbGluZS1jaGVja2xpc3R7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnI7Z2FwOjhweDttYXJnaW46MTJweCAwfQoub2ZmbGluZS1jaGVja3tkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjM0cHggMWZyO2dhcDo4cHg7YWxpZ24taXRlbXM6c3RhcnQ7cGFkZGluZzoxMHB4O2JvcmRlci1yYWRpdXM6MTRweDtiYWNrZ3JvdW5kOnJnYmEoMCwwLDAsLjE4KTtib3JkZXI6MXB4IHNvbGlkIHJnYmEoMjMwLDE4OCwxMjIsLjI1KTt0ZXh0LWFsaWduOmxlZnR9Ci5vZmZsaW5lLWNoZWNrLnllc3tib3JkZXItY29sb3I6cmdiYSgxMzksMTgxLDEwNiwuNjUpO2JhY2tncm91bmQ6cmdiYSgxMzksMTgxLDEwNiwuMTQpfQoub2ZmbGluZS1jaGVjay5ub3tib3JkZXItY29sb3I6cmdiYSgyMDAsOTQsNjksLjcpO2JhY2tncm91bmQ6cmdiYSgyMDAsOTQsNjksLjE2KX0KLm9mZmxpbmUtY2hlY2sud2FpdHtib3JkZXItY29sb3I6cmdiYSgyNDAsMTkzLDEwNiwuNjUpO2JhY2tncm91bmQ6cmdiYSgyNDAsMTkzLDEwNiwuMTIpfQoub2ZmbGluZS1jaGVjayBie2Rpc3BsYXk6YmxvY2s7Y29sb3I6I2Y1ZTZjODtmb250LXNpemU6LjkzcmVtO2xpbmUtaGVpZ2h0OjEuMjV9Ci5vZmZsaW5lLWNoZWNrIHNtYWxse2Rpc3BsYXk6YmxvY2s7Y29sb3I6I2NiYjg5NDtmb250LXNpemU6Ljc4cmVtO2xpbmUtaGVpZ2h0OjEuMjg7bWFyZ2luLXRvcDoycHh9Ci5vZmZsaW5lLWluc3RydWN0aW9ue2JvcmRlci1yYWRpdXM6MTZweDtwYWRkaW5nOjEycHg7bWFyZ2luLXRvcDoxMHB4O2JhY2tncm91bmQ6cmdiYSgwLDAsMCwuMik7Ym9yZGVyOjFweCBzb2xpZCByZ2JhKDI0MCwxOTMsMTA2LC4zOCk7bGluZS1oZWlnaHQ6MS4zNTt0ZXh0LWFsaWduOmNlbnRlcn0KLm9mZmxpbmUtaW5zdHJ1Y3Rpb24ucmVhZHl7YmFja2dyb3VuZDpyZ2JhKDEzOSwxODEsMTA2LC4xNyk7Ym9yZGVyLWNvbG9yOnJnYmEoMTM5LDE4MSwxMDYsLjY1KTtjb2xvcjojZWFmZmQ4fQoub2ZmbGluZS1pbnN0cnVjdGlvbi5ibG9ja2Vke2JhY2tncm91bmQ6cmdiYSgyMDAsOTQsNjksLjE2KTtib3JkZXItY29sb3I6cmdiYSgyMDAsOTQsNjksLjcpO2NvbG9yOiNmZmY0ZTl9CgoKLnJlc3VsdC1jb2RlLXRpdGxle21hcmdpbjoxNHB4IDAgNnB4O3BhZGRpbmc6MTJweDtib3JkZXItcmFkaXVzOjE2cHg7YmFja2dyb3VuZDpyZ2JhKDI0MCwxOTMsMTA2LC4xNik7Ym9yZGVyOjFweCBzb2xpZCByZ2JhKDI0MCwxOTMsMTA2LC41NSk7Y29sb3I6I2YwYzE2YTtmb250LXdlaWdodDo5MDA7bGluZS1oZWlnaHQ6MS4zNTt0ZXh0LWFsaWduOmNlbnRlcn0KI3Jlc3VsdFRleHR7ZGlzcGxheTpibG9jayFpbXBvcnRhbnQ7bWluLWhlaWdodDoxMThweCFpbXBvcnRhbnQ7bWF4LWhlaWdodDoxOTBweDtyZXNpemU6bm9uZTtvdmVyZmxvdzphdXRvO2ZvbnQtc2l6ZTouNzZyZW0haW1wb3J0YW50O2xpbmUtaGVpZ2h0OjEuMzUhaW1wb3J0YW50O3BhZGRpbmc6MTJweCFpbXBvcnRhbnQ7bWFyZ2luLXRvcDo4cHghaW1wb3J0YW50O3dvcmQtYnJlYWs6YnJlYWstYWxsO292ZXJmbG93LXdyYXA6YW55d2hlcmV9CiNyZXN1bHRUZXh0e21pbi1oZWlnaHQ6MTUwcHg7YmFja2dyb3VuZDojZmZmO2NvbG9yOiMxMDEwMTA7Ym9yZGVyOjRweCBzb2xpZCAjZjBjMTZhO2ZvbnQtc2l6ZTouODhyZW07bGluZS1oZWlnaHQ6MS4zNTtsZXR0ZXItc3BhY2luZzouM3B4O3dvcmQtYnJlYWs6YnJlYWstYWxsfQoucXIgaW1ne3dpZHRoOm1pbig5NnZ3LDYyMHB4KTtwYWRkaW5nOjI0cHg7Ym9yZGVyOjhweCBzb2xpZCAjZmZmfQoKLyogUEFSVElDSVBBTlRFIFNJTVBMRSDCtyBzb2xvIDMgYmxvcXVlcyB2aXNpYmxlcyAqLwouc2ltcGxlLXBhcnRpY2lwYW50LWFwcHttYXgtd2lkdGg6NjIwcHg7cGFkZGluZzoxNHB4IDEwcHggMzRweH0KLnNpbXBsZS1jYXJke3Bvc2l0aW9uOnJlbGF0aXZlO3BhZGRpbmc6MThweCAxNnB4IDIwcHg7bWFyZ2luLWJvdHRvbToxNHB4fQouc2ltcGxlLXN0ZXB7d2lkdGg6MzhweDtoZWlnaHQ6MzhweDtib3JkZXItcmFkaXVzOjE0cHg7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTgwZGVnLCNmMGMxNmEsI2Q3OTczNSk7Y29sb3I6IzI0MTcwYTtmb250LXdlaWdodDo5MDA7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO21hcmdpbi1ib3R0b206MTBweDtib3gtc2hhZG93OjAgOHB4IDE4cHggcmdiYSgwLDAsMCwuMjUpfQouc2ltcGxlLWNhcmQgaDJ7Zm9udC1zaXplOjEuMzVyZW07bWFyZ2luLWJvdHRvbToxMnB4fQouc2ltcGxlLXJvdXRlLWJveHtmb250LXNpemU6Ljk1cmVtfQouc2ltcGxlLXNjYW5ze21hcmdpbi10b3A6MTRweH0KI2V2ZW50SW5mbywub2ZmbGluZS1zYWZlLC5vZmZsaW5lLXJlYWR5LXRpdGxlLC5vZmZsaW5lLWNoZWNrbGlzdCwub2ZmbGluZS1pbnN0cnVjdGlvbiwucmVjb3ZlcnktYWN0aW9ucywuc2F2ZS1waWxsLC5zbWFsbC5iaWctd2FybntkaXNwbGF5Om5vbmUhaW1wb3J0YW50fQojbG9hZFBhcnRpY2lwYW50UXJCdG57bWFyZ2luLXRvcDoxMnB4fQojcmVzdWx0IGJ1dHRvbltvbmNsaWNrPSJkb3dubG9hZFJlc3VsdCgpIl17ZGlzcGxheTpub25lIWltcG9ydGFudH0KLnNjYW57Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjcycHggMWZyIDQycHg7Zm9udC1zaXplOi44NnJlbX0KQG1lZGlhKG1heC13aWR0aDo1MjBweCl7CiAgLnNpbXBsZS1wYXJ0aWNpcGFudC1hcHB7cGFkZGluZzoxMHB4IDhweCAyOHB4fQogIC5zaW1wbGUtY2FyZHtib3JkZXItcmFkaXVzOjIycHg7cGFkZGluZzoxNnB4IDE0cHh9CiAgLnNpbXBsZS1jYXJkIGgye2ZvbnQtc2l6ZToxLjE4cmVtfQogIC5uZXh0e2ZvbnQtc2l6ZToxLjM1cmVtfQogIC5zY2Fue2dyaWQtdGVtcGxhdGUtY29sdW1uczo2MnB4IDFmciAzNHB4O2dhcDo2cHh9Cn0KCi5yZXN1bHQtb3BlbnthbmltYXRpb246cmVzdWx0UmV2ZWFsIC40NXMgZWFzZSBib3RoO2JveC1zaGFkb3c6MCAwIDAgM3B4IHJnYmEoMjQwLDE5MywxMDYsLjI0KSwwIDI0cHggNTRweCByZ2JhKDAsMCwwLC4zOCkhaW1wb3J0YW50fS5yZXN1bHQtb3BlbiAuc2ltcGxlLXN0ZXB7dHJhbnNmb3JtOnNjYWxlKDEuMDgpO2JveC1zaGFkb3c6MCAwIDAgNnB4IHJnYmEoMjQwLDE5MywxMDYsLjE0KSwwIDEwcHggMjJweCByZ2JhKDAsMCwwLC4yOCl9QGtleWZyYW1lcyByZXN1bHRSZXZlYWx7ZnJvbXtvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZVkoMjRweCl9dG97b3BhY2l0eToxO3RyYW5zZm9ybTp0cmFuc2xhdGVZKDApfX0KCi8qIE1JTElUT1BPIMK3IEdQUyBERSBQUk9YSU1JREFEIERFTlRSTyBERSBMQSBBUFAgUEFSVElDSVBBTlRFICovCi5ncHMtY2FyZHtkaXNwbGF5Om5vbmU7Ym9yZGVyLWNvbG9yOnJnYmEoMTM5LDE4MSwxMDYsLjU4KTtiYWNrZ3JvdW5kOnJhZGlhbC1ncmFkaWVudChjaXJjbGUgYXQgODglIDEwJSxyZ2JhKDEzOSwxODEsMTA2LC4xNiksdHJhbnNwYXJlbnQgMjglKSxsaW5lYXItZ3JhZGllbnQoMTgwZGVnLHJnYmEoMjU1LDI1NSwyNTUsLjA5KSxyZ2JhKDI1NSwyNTUsMjU1LC4wMzUpKSx2YXIoLS1wKX0KLmdwcy10aXRsZXtmb250LXdlaWdodDo5MDA7Y29sb3I6dmFyKC0tZyk7Zm9udC1zaXplOjEuMDhyZW07bGluZS1oZWlnaHQ6MS4yNTttYXJnaW4tYm90dG9tOjEwcHh9Ci5ncHMtbWV0cmljc3tkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdCgyLG1pbm1heCgwLDFmcikpO2dhcDo4cHg7bWFyZ2luOjEwcHggMH0KLmdwcy1tZXRyaWN7cGFkZGluZzoxMHB4IDhweDtib3JkZXItcmFkaXVzOjE0cHg7YmFja2dyb3VuZDpyZ2JhKDI1NSwyNTUsMjU1LC4wNyk7dGV4dC1hbGlnbjpjZW50ZXI7Ym9yZGVyOjFweCBzb2xpZCByZ2JhKDIzMCwxODgsMTIyLC4xNil9Ci5ncHMtbWV0cmljIHNtYWxse2Rpc3BsYXk6YmxvY2s7Y29sb3I6dmFyKC0tbSk7Zm9udC1zaXplOi43cmVtO2ZvbnQtd2VpZ2h0OjkwMH0uZ3BzLW1ldHJpYyBie2Rpc3BsYXk6YmxvY2s7bWFyZ2luLXRvcDo0cHg7Zm9udC1zaXplOjFyZW19Ci5ncHMtbm90ZXtmb250LXNpemU6Ljc2cmVtO2xpbmUtaGVpZ2h0OjEuMzU7Y29sb3I6dmFyKC0tbSk7bWFyZ2luLXRvcDoxMHB4fQouZ3BzLWFjdGlvbnN7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnI7Z2FwOjhweH0KLmxpdmUtc3luYy1zdGF0dXN7bWFyZ2luOjEwcHggMCAwO3BhZGRpbmc6OHB4IDEwcHg7Ym9yZGVyLXJhZGl1czoxMnB4IDEycHggOHB4IDhweDt0ZXh0LWFsaWduOmNlbnRlcjtmb250LXNpemU6LjcycmVtO2xpbmUtaGVpZ2h0OjEuMjU7Zm9udC13ZWlnaHQ6OTAwO2JvcmRlcjoxcHggc29saWQgcmdiYSgyNTUsMjU1LDI1NSwuMTIpO2JhY2tncm91bmQ6cmdiYSgwLDAsMCwuMTYpfS5saXZlLXN5bmMtc3RhdHVzLmlzLXN5bmNlZHtjb2xvcjojZWFmZmQ4O2JvcmRlci1jb2xvcjpyZ2JhKDEzOSwxODEsMTA2LC41NSk7YmFja2dyb3VuZDpyZ2JhKDEzOSwxODEsMTA2LC4xNCl9LmxpdmUtc3luYy1zdGF0dXMuaXMtb2ZmbGluZXtjb2xvcjojZmZlMGEwO2JvcmRlci1jb2xvcjpyZ2JhKDIzMCwxODgsMTIyLC40OCk7YmFja2dyb3VuZDpyZ2JhKDE1MSwxMDMsMzQsLjE0KX0ubGl2ZS1zeW5jLXN0YXR1cy5pcy1zeW5jaW5ne2NvbG9yOiNkNWVkZmY7Ym9yZGVyLWNvbG9yOnJnYmEoOTMsMTY4LDI1NSwuNDIpO2JhY2tncm91bmQ6cmdiYSg3MCwxMzksMjA2LC4xNCl9LmxpdmUtc3luYy1zdGF0dXMuaXMtaW5hY3RpdmV7Y29sb3I6I2Q2Y2ZiZjtib3JkZXItY29sb3I6cmdiYSgyMDMsMTg0LDE0OCwuMjgpO2JhY2tncm91bmQ6cmdiYSgyNTUsMjU1LDI1NSwuMDQ1KX0KLmxpdmUtbGFzdC1zeW5je21hcmdpbjowIDAgNHB4O3BhZGRpbmc6NnB4IDEwcHg7Ym9yZGVyLXJhZGl1czowIDAgMTJweCAxMnB4O3RleHQtYWxpZ246Y2VudGVyO2ZvbnQtc2l6ZTouNjZyZW07bGluZS1oZWlnaHQ6MS4zO2ZvbnQtd2VpZ2h0OjkwMDtjb2xvcjojY2JiODk0O2JhY2tncm91bmQ6cmdiYSgwLDAsMCwuMTMpO2JvcmRlcjoxcHggc29saWQgcmdiYSgyNTUsMjU1LDI1NSwuMDkpO2JvcmRlci10b3A6MDtsZXR0ZXItc3BhY2luZzouMDJlbX0KLmdwcy1maW5pc2gtbm90aWNle2Rpc3BsYXk6bm9uZTttYXJnaW46MCAwIDE0cHg7cGFkZGluZzowO2FuaW1hdGlvbjpmaW5pc2hOb3RpY2VSZXZlYWwgLjM4cyBlYXNlIGJvdGh9Lmdwcy1maW5pc2gtbm90aWNlLm9wZW57ZGlzcGxheTpibG9ja30uZ3BzLWZpbmlzaC1jYXJke3dpZHRoOjEwMCU7cGFkZGluZzoyMnB4IDE4cHg7Ym9yZGVyLXJhZGl1czoyOHB4O2JvcmRlcjoycHggc29saWQgcmdiYSgxMzksMTgxLDEwNiwuNzIpO2JhY2tncm91bmQ6cmFkaWFsLWdyYWRpZW50KGNpcmNsZSBhdCA1MCUgMCxyZ2JhKDEzOSwxODEsMTA2LC4xNiksdHJhbnNwYXJlbnQgMzglKSxsaW5lYXItZ3JhZGllbnQoMTgwZGVnLCMyNzM1MWQsIzEyMTkwZCk7Ym94LXNoYWRvdzowIDE4cHggNDZweCByZ2JhKDAsMCwwLC40Nik7dGV4dC1hbGlnbjpjZW50ZXJ9Lmdwcy1maW5pc2gtaWNvbntmb250LXNpemU6NDhweDtsaW5lLWhlaWdodDoxfS5ncHMtZmluaXNoLXRpdGxle21hcmdpbi10b3A6OXB4O2ZvbnQtc2l6ZToxLjI0cmVtO2ZvbnQtd2VpZ2h0OjEwMDA7Y29sb3I6I2VhZmZkOH0uZ3BzLWZpbmlzaC10ZXh0e21hcmdpbjo5cHggMCAxNnB4O2NvbG9yOiNmNWU2Yzg7Zm9udC1zaXplOi45cmVtO2xpbmUtaGVpZ2h0OjEuNDU7d2hpdGUtc3BhY2U6cHJlLWxpbmV9Lmdwcy1maW5pc2gtY2FyZCAuYnRue3dpZHRoOjEwMCV9QGtleWZyYW1lcyBmaW5pc2hOb3RpY2VSZXZlYWx7ZnJvbXtvcGFjaXR5OjA7dHJhbnNmb3JtOnRyYW5zbGF0ZVkoLTE0cHgpfXRve29wYWNpdHk6MTt0cmFuc2Zvcm06dHJhbnNsYXRlWSgwKX19Ci5ncHMtY2hvaWNlLW92ZXJsYXl7cG9zaXRpb246Zml4ZWQ7aW5zZXQ6MDt6LWluZGV4OjEyMDAwMDtkaXNwbGF5Om5vbmU7cGxhY2UtaXRlbXM6Y2VudGVyO3BhZGRpbmc6MThweDtiYWNrZ3JvdW5kOnJnYmEoNSwxMCw0LC44Nik7YmFja2Ryb3AtZmlsdGVyOmJsdXIoNXB4KTstd2Via2l0LWJhY2tkcm9wLWZpbHRlcjpibHVyKDVweCl9Lmdwcy1jaG9pY2Utb3ZlcmxheS5vcGVue2Rpc3BsYXk6Z3JpZH0uZ3BzLWNob2ljZS1jYXJke3dpZHRoOm1pbig5MnZ3LDUyMHB4KTtwYWRkaW5nOjI0cHggMThweDtib3JkZXItcmFkaXVzOjI4cHg7Ym9yZGVyOjJweCBzb2xpZCByZ2JhKDI0MCwxOTMsMTA2LC43Mik7YmFja2dyb3VuZDpyYWRpYWwtZ3JhZGllbnQoY2lyY2xlIGF0IDUwJSAwLHJnYmEoMjQwLDE5MywxMDYsLjE2KSx0cmFuc3BhcmVudCAzOCUpLGxpbmVhci1ncmFkaWVudCgxODBkZWcsIzJkMmExZCwjMTIxNTBlKTtib3gtc2hhZG93OjAgMjJweCA2MHB4IHJnYmEoMCwwLDAsLjU4KTt0ZXh0LWFsaWduOmNlbnRlcn0uZ3BzLWNob2ljZS1pY29ue2ZvbnQtc2l6ZTo1MnB4O2xpbmUtaGVpZ2h0OjF9Lmdwcy1jaG9pY2UtdGl0bGV7bWFyZ2luLXRvcDo5cHg7Zm9udC1zaXplOjEuMjJyZW07Zm9udC13ZWlnaHQ6MTAwMDtjb2xvcjojZmZmMGM4fS5ncHMtY2hvaWNlLXRleHR7bWFyZ2luOjEwcHggMCAxNnB4O2NvbG9yOiNmNWU2Yzg7Zm9udC1zaXplOi45cmVtO2xpbmUtaGVpZ2h0OjEuNDh9Lmdwcy1jaG9pY2UtYWN0aW9uc3tkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmcjtnYXA6OXB4fS5ncHMtY2hvaWNlLWFjdGlvbnMgLmJ0bnttYXJnaW4tdG9wOjA7d2lkdGg6MTAwJX0KI2dwc0xvY2tPdmVybGF5e3Bvc2l0aW9uOmZpeGVkO2luc2V0OjA7ei1pbmRleDoxMDAwMDA7ZGlzcGxheTpub25lO3BsYWNlLWl0ZW1zOmNlbnRlcjtwYWRkaW5nOjE4cHg7YmFja2dyb3VuZDpyYWRpYWwtZ3JhZGllbnQoY2lyY2xlIGF0IDUwJSAyNSUsIzRiMzQxZiwjMTcxMjBkIDcyJSk7Y29sb3I6I2ZmZjhlODt0b3VjaC1hY3Rpb246bm9uZTt1c2VyLXNlbGVjdDpub25lfQojZ3BzTG9ja092ZXJsYXkub3BlbntkaXNwbGF5OmdyaWR9Lmdwcy1sb2NrLWNhcmR7d2lkdGg6bWluKDkydncsNTIwcHgpO3RleHQtYWxpZ246Y2VudGVyO3BhZGRpbmc6MjZweCAxOHB4O2JvcmRlcjoycHggc29saWQgI2Q5YWI1ODtib3JkZXItcmFkaXVzOjI4cHg7YmFja2dyb3VuZDpyZ2JhKDI0LDE4LDEyLC45Nik7Ym94LXNoYWRvdzowIDE4cHggNTVweCByZ2JhKDAsMCwwLC41NSl9Ci5ncHMtbG9jay1pY29ue2ZvbnQtc2l6ZTo1NHB4fS5ncHMtbG9jay10YXJnZXR7Zm9udC1zaXplOjQ2cHg7Zm9udC13ZWlnaHQ6OTAwO21hcmdpbjo4cHggMDtjb2xvcjojZmZkOTgyfS5ncHMtdW5sb2Nre21hcmdpbi10b3A6MjJweDt3aWR0aDoxMDAlO3BhZGRpbmc6MThweDtib3JkZXItcmFkaXVzOjE4cHg7Ym9yZGVyOjFweCBzb2xpZCAjZTRiZDc4O2JhY2tncm91bmQ6IzViM2IyMTtjb2xvcjojZmZmO2ZvbnQtd2VpZ2h0OjkwMDtwb3NpdGlvbjpyZWxhdGl2ZTtvdmVyZmxvdzpoaWRkZW59Lmdwcy11bmxvY2s6YmVmb3Jle2NvbnRlbnQ6IiI7cG9zaXRpb246YWJzb2x1dGU7aW5zZXQ6MDt0cmFuc2Zvcm06c2NhbGVYKDApO3RyYW5zZm9ybS1vcmlnaW46bGVmdDtiYWNrZ3JvdW5kOnJnYmEoMjU1LDIxNywxMzAsLjI4KX0uZ3BzLXVubG9jay5ob2xkaW5nOmJlZm9yZXt0cmFuc2Zvcm06c2NhbGVYKDEpO3RyYW5zaXRpb246dHJhbnNmb3JtIDIuMnMgbGluZWFyfQpodG1sLmdwcy1sb2NrZWQsaHRtbC5ncHMtbG9ja2VkIGJvZHl7b3ZlcmZsb3c6aGlkZGVufQo8L3N0eWxlPjxzY3JpcHQ+Ci8qIFFSIG9mZmxpbmUgZW1iZWJpZG8gcGFyYSBNSUxJVE9QTy4gQmFzYWRvIGVuIFFSQ29kZSBmb3IgSmF2YVNjcmlwdCAoS2F6dWhpa28gQXJhc2UsIE1JVCkgKi8KKGZ1bmN0aW9uKGdsb2JhbCl7CiAgY29uc3QgX19tb2R1bGVzID0gewoiLi9RUk1vZGUiOiBmdW5jdGlvbihtb2R1bGUsIGV4cG9ydHMsIHJlcXVpcmUpewptb2R1bGUuZXhwb3J0cyA9IHsKICAgIE1PREVfTlVNQkVSIDogICAgICAgMSA8PCAwLAogICAgTU9ERV9BTFBIQV9OVU0gOiAgICAxIDw8IDEsCiAgICBNT0RFXzhCSVRfQllURSA6ICAgIDEgPDwgMiwKICAgIE1PREVfS0FOSkkgOiAgICAgICAgMSA8PCAzCn07Cgp9LAoiLi9RUkVycm9yQ29ycmVjdExldmVsIjogZnVuY3Rpb24obW9kdWxlLCBleHBvcnRzLCByZXF1aXJlKXsKbW9kdWxlLmV4cG9ydHMgPSB7CglMIDogMSwKCU0gOiAwLAoJUSA6IDMsCglIIDogMgp9OwoKCn0sCiIuL1FSTWFza1BhdHRlcm4iOiBmdW5jdGlvbihtb2R1bGUsIGV4cG9ydHMsIHJlcXVpcmUpewptb2R1bGUuZXhwb3J0cyA9IHsKCVBBVFRFUk4wMDAgOiAwLAoJUEFUVEVSTjAwMSA6IDEsCglQQVRURVJOMDEwIDogMiwKCVBBVFRFUk4wMTEgOiAzLAoJUEFUVEVSTjEwMCA6IDQsCglQQVRURVJOMTAxIDogNSwKCVBBVFRFUk4xMTAgOiA2LAoJUEFUVEVSTjExMSA6IDcKfTsKCn0sCiIuL1FSTWF0aCI6IGZ1bmN0aW9uKG1vZHVsZSwgZXhwb3J0cywgcmVxdWlyZSl7CnZhciBRUk1hdGggPSB7CgoJZ2xvZyA6IGZ1bmN0aW9uKG4pIHsKCQoJCWlmIChuIDwgMSkgewoJCQl0aHJvdyBuZXcgRXJyb3IoImdsb2coIiArIG4gKyAiKSIpOwoJCX0KCQkKCQlyZXR1cm4gUVJNYXRoLkxPR19UQUJMRVtuXTsKCX0sCgkKCWdleHAgOiBmdW5jdGlvbihuKSB7CgkKCQl3aGlsZSAobiA8IDApIHsKCQkJbiArPSAyNTU7CgkJfQoJCgkJd2hpbGUgKG4gPj0gMjU2KSB7CgkJCW4gLT0gMjU1OwoJCX0KCQoJCXJldHVybiBRUk1hdGguRVhQX1RBQkxFW25dOwoJfSwKCQoJRVhQX1RBQkxFIDogbmV3IEFycmF5KDI1NiksCgkKCUxPR19UQUJMRSA6IG5ldyBBcnJheSgyNTYpCgp9OwoJCmZvciAodmFyIGkgPSAwOyBpIDwgODsgaSsrKSB7CglRUk1hdGguRVhQX1RBQkxFW2ldID0gMSA8PCBpOwp9CmZvciAodmFyIGkgPSA4OyBpIDwgMjU2OyBpKyspIHsKCVFSTWF0aC5FWFBfVEFCTEVbaV0gPSBRUk1hdGguRVhQX1RBQkxFW2kgLSA0XQoJCV4gUVJNYXRoLkVYUF9UQUJMRVtpIC0gNV0KCQleIFFSTWF0aC5FWFBfVEFCTEVbaSAtIDZdCgkJXiBRUk1hdGguRVhQX1RBQkxFW2kgLSA4XTsKfQpmb3IgKHZhciBpID0gMDsgaSA8IDI1NTsgaSsrKSB7CglRUk1hdGguTE9HX1RBQkxFW1FSTWF0aC5FWFBfVEFCTEVbaV0gXSA9IGk7Cn0KCm1vZHVsZS5leHBvcnRzID0gUVJNYXRoOwoKfSwKIi4vUVJQb2x5bm9taWFsIjogZnVuY3Rpb24obW9kdWxlLCBleHBvcnRzLCByZXF1aXJlKXsKdmFyIFFSTWF0aCA9IHJlcXVpcmUoJy4vUVJNYXRoJyk7CgpmdW5jdGlvbiBRUlBvbHlub21pYWwobnVtLCBzaGlmdCkgewoJaWYgKG51bS5sZW5ndGggPT09IHVuZGVmaW5lZCkgewoJCXRocm93IG5ldyBFcnJvcihudW0ubGVuZ3RoICsgIi8iICsgc2hpZnQpOwoJfQoKCXZhciBvZmZzZXQgPSAwOwoKCXdoaWxlIChvZmZzZXQgPCBudW0ubGVuZ3RoICYmIG51bVtvZmZzZXRdID09PSAwKSB7CgkJb2Zmc2V0Kys7Cgl9CgoJdGhpcy5udW0gPSBuZXcgQXJyYXkobnVtLmxlbmd0aCAtIG9mZnNldCArIHNoaWZ0KTsKCWZvciAodmFyIGkgPSAwOyBpIDwgbnVtLmxlbmd0aCAtIG9mZnNldDsgaSsrKSB7CgkJdGhpcy5udW1baV0gPSBudW1baSArIG9mZnNldF07Cgl9Cn0KClFSUG9seW5vbWlhbC5wcm90b3R5cGUgPSB7CgoJZ2V0IDogZnVuY3Rpb24oaW5kZXgpIHsKCQlyZXR1cm4gdGhpcy5udW1baW5kZXhdOwoJfSwKCQoJZ2V0TGVuZ3RoIDogZnVuY3Rpb24oKSB7CgkJcmV0dXJuIHRoaXMubnVtLmxlbmd0aDsKCX0sCgkKCW11bHRpcGx5IDogZnVuY3Rpb24oZSkgewoJCgkJdmFyIG51bSA9IG5ldyBBcnJheSh0aGlzLmdldExlbmd0aCgpICsgZS5nZXRMZW5ndGgoKSAtIDEpOwoJCgkJZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmdldExlbmd0aCgpOyBpKyspIHsKCQkJZm9yICh2YXIgaiA9IDA7IGogPCBlLmdldExlbmd0aCgpOyBqKyspIHsKCQkJCW51bVtpICsgal0gXj0gUVJNYXRoLmdleHAoUVJNYXRoLmdsb2codGhpcy5nZXQoaSkgKSArIFFSTWF0aC5nbG9nKGUuZ2V0KGopICkgKTsKCQkJfQoJCX0KCQoJCXJldHVybiBuZXcgUVJQb2x5bm9taWFsKG51bSwgMCk7Cgl9LAoJCgltb2QgOiBmdW5jdGlvbihlKSB7CgkKCQlpZiAodGhpcy5nZXRMZW5ndGgoKSAtIGUuZ2V0TGVuZ3RoKCkgPCAwKSB7CgkJCXJldHVybiB0aGlzOwoJCX0KCQoJCXZhciByYXRpbyA9IFFSTWF0aC5nbG9nKHRoaXMuZ2V0KDApICkgLSBRUk1hdGguZ2xvZyhlLmdldCgwKSApOwoJCgkJdmFyIG51bSA9IG5ldyBBcnJheSh0aGlzLmdldExlbmd0aCgpICk7CgkJCgkJZm9yICh2YXIgaSA9IDA7IGkgPCB0aGlzLmdldExlbmd0aCgpOyBpKyspIHsKCQkJbnVtW2ldID0gdGhpcy5nZXQoaSk7CgkJfQoJCQoJCWZvciAodmFyIHggPSAwOyB4IDwgZS5nZXRMZW5ndGgoKTsgeCsrKSB7CgkJCW51bVt4XSBePSBRUk1hdGguZ2V4cChRUk1hdGguZ2xvZyhlLmdldCh4KSApICsgcmF0aW8pOwoJCX0KCQoJCS8vIHJlY3Vyc2l2ZSBjYWxsCgkJcmV0dXJuIG5ldyBRUlBvbHlub21pYWwobnVtLCAwKS5tb2QoZSk7Cgl9Cn07Cgptb2R1bGUuZXhwb3J0cyA9IFFSUG9seW5vbWlhbDsKCn0sCiIuL1FSQml0QnVmZmVyIjogZnVuY3Rpb24obW9kdWxlLCBleHBvcnRzLCByZXF1aXJlKXsKZnVuY3Rpb24gUVJCaXRCdWZmZXIoKSB7Cgl0aGlzLmJ1ZmZlciA9IFtdOwoJdGhpcy5sZW5ndGggPSAwOwp9CgpRUkJpdEJ1ZmZlci5wcm90b3R5cGUgPSB7CgoJZ2V0IDogZnVuY3Rpb24oaW5kZXgpIHsKCQl2YXIgYnVmSW5kZXggPSBNYXRoLmZsb29yKGluZGV4IC8gOCk7CgkJcmV0dXJuICggKHRoaXMuYnVmZmVyW2J1ZkluZGV4XSA+Pj4gKDcgLSBpbmRleCAlIDgpICkgJiAxKSA9PSAxOwoJfSwKCQoJcHV0IDogZnVuY3Rpb24obnVtLCBsZW5ndGgpIHsKCQlmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7CgkJCXRoaXMucHV0Qml0KCAoIChudW0gPj4+IChsZW5ndGggLSBpIC0gMSkgKSAmIDEpID09IDEpOwoJCX0KCX0sCgkKCWdldExlbmd0aEluQml0cyA6IGZ1bmN0aW9uKCkgewoJCXJldHVybiB0aGlzLmxlbmd0aDsKCX0sCgkKCXB1dEJpdCA6IGZ1bmN0aW9uKGJpdCkgewoJCgkJdmFyIGJ1ZkluZGV4ID0gTWF0aC5mbG9vcih0aGlzLmxlbmd0aCAvIDgpOwoJCWlmICh0aGlzLmJ1ZmZlci5sZW5ndGggPD0gYnVmSW5kZXgpIHsKCQkJdGhpcy5idWZmZXIucHVzaCgwKTsKCQl9CgkKCQlpZiAoYml0KSB7CgkJCXRoaXMuYnVmZmVyW2J1ZkluZGV4XSB8PSAoMHg4MCA+Pj4gKHRoaXMubGVuZ3RoICUgOCkgKTsKCQl9CgkKCQl0aGlzLmxlbmd0aCsrOwoJfQp9OwoKbW9kdWxlLmV4cG9ydHMgPSBRUkJpdEJ1ZmZlcjsKCn0sCiIuL1FSOGJpdEJ5dGUiOiBmdW5jdGlvbihtb2R1bGUsIGV4cG9ydHMsIHJlcXVpcmUpewp2YXIgUVJNb2RlID0gcmVxdWlyZSgnLi9RUk1vZGUnKTsKCmZ1bmN0aW9uIFFSOGJpdEJ5dGUoZGF0YSkgewoJdGhpcy5tb2RlID0gUVJNb2RlLk1PREVfOEJJVF9CWVRFOwoJdGhpcy5kYXRhID0gZGF0YTsKfQoKUVI4Yml0Qnl0ZS5wcm90b3R5cGUgPSB7CgoJZ2V0TGVuZ3RoIDogZnVuY3Rpb24oKSB7CgkJcmV0dXJuIHRoaXMuZGF0YS5sZW5ndGg7Cgl9LAoJCgl3cml0ZSA6IGZ1bmN0aW9uKGJ1ZmZlcikgewoJCWZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5kYXRhLmxlbmd0aDsgaSsrKSB7CgkJCS8vIG5vdCBKSVMgLi4uCgkJCWJ1ZmZlci5wdXQodGhpcy5kYXRhLmNoYXJDb2RlQXQoaSksIDgpOwoJCX0KCX0KfTsKCm1vZHVsZS5leHBvcnRzID0gUVI4Yml0Qnl0ZTsKCn0sCiIuL1FSUlNCbG9jayI6IGZ1bmN0aW9uKG1vZHVsZSwgZXhwb3J0cywgcmVxdWlyZSl7CnZhciBRUkVycm9yQ29ycmVjdExldmVsID0gcmVxdWlyZSgnLi9RUkVycm9yQ29ycmVjdExldmVsJyk7CgpmdW5jdGlvbiBRUlJTQmxvY2sodG90YWxDb3VudCwgZGF0YUNvdW50KSB7Cgl0aGlzLnRvdGFsQ291bnQgPSB0b3RhbENvdW50OwoJdGhpcy5kYXRhQ291bnQgID0gZGF0YUNvdW50Owp9CgpRUlJTQmxvY2suUlNfQkxPQ0tfVEFCTEUgPSBbCgoJLy8gTAoJLy8gTQoJLy8gUQoJLy8gSAoKCS8vIDEKCVsxLCAyNiwgMTldLAoJWzEsIDI2LCAxNl0sCglbMSwgMjYsIDEzXSwKCVsxLCAyNiwgOV0sCgkKCS8vIDIKCVsxLCA0NCwgMzRdLAoJWzEsIDQ0LCAyOF0sCglbMSwgNDQsIDIyXSwKCVsxLCA0NCwgMTZdLAoKCS8vIDMKCVsxLCA3MCwgNTVdLAoJWzEsIDcwLCA0NF0sCglbMiwgMzUsIDE3XSwKCVsyLCAzNSwgMTNdLAoKCS8vIDQJCQoJWzEsIDEwMCwgODBdLAoJWzIsIDUwLCAzMl0sCglbMiwgNTAsIDI0XSwKCVs0LCAyNSwgOV0sCgkKCS8vIDUKCVsxLCAxMzQsIDEwOF0sCglbMiwgNjcsIDQzXSwKCVsyLCAzMywgMTUsIDIsIDM0LCAxNl0sCglbMiwgMzMsIDExLCAyLCAzNCwgMTJdLAoJCgkvLyA2CglbMiwgODYsIDY4XSwKCVs0LCA0MywgMjddLAoJWzQsIDQzLCAxOV0sCglbNCwgNDMsIDE1XSwKCQoJLy8gNwkJCglbMiwgOTgsIDc4XSwKCVs0LCA0OSwgMzFdLAoJWzIsIDMyLCAxNCwgNCwgMzMsIDE1XSwKCVs0LCAzOSwgMTMsIDEsIDQwLCAxNF0sCgkKCS8vIDgKCVsyLCAxMjEsIDk3XSwKCVsyLCA2MCwgMzgsIDIsIDYxLCAzOV0sCglbNCwgNDAsIDE4LCAyLCA0MSwgMTldLAoJWzQsIDQwLCAxNCwgMiwgNDEsIDE1XSwKCQoJLy8gOQoJWzIsIDE0NiwgMTE2XSwKCVszLCA1OCwgMzYsIDIsIDU5LCAzN10sCglbNCwgMzYsIDE2LCA0LCAzNywgMTddLAoJWzQsIDM2LCAxMiwgNCwgMzcsIDEzXSwKCQoJLy8gMTAJCQoJWzIsIDg2LCA2OCwgMiwgODcsIDY5XSwKCVs0LCA2OSwgNDMsIDEsIDcwLCA0NF0sCglbNiwgNDMsIDE5LCAyLCA0NCwgMjBdLAoJWzYsIDQzLCAxNSwgMiwgNDQsIDE2XSwKCgkvLyAxMQoJWzQsIDEwMSwgODFdLAoJWzEsIDgwLCA1MCwgNCwgODEsIDUxXSwKCVs0LCA1MCwgMjIsIDQsIDUxLCAyM10sCglbMywgMzYsIDEyLCA4LCAzNywgMTNdLAoKCS8vIDEyCglbMiwgMTE2LCA5MiwgMiwgMTE3LCA5M10sCglbNiwgNTgsIDM2LCAyLCA1OSwgMzddLAoJWzQsIDQ2LCAyMCwgNiwgNDcsIDIxXSwKCVs3LCA0MiwgMTQsIDQsIDQzLCAxNV0sCgoJLy8gMTMKCVs0LCAxMzMsIDEwN10sCglbOCwgNTksIDM3LCAxLCA2MCwgMzhdLAoJWzgsIDQ0LCAyMCwgNCwgNDUsIDIxXSwKCVsxMiwgMzMsIDExLCA0LCAzNCwgMTJdLAoKCS8vIDE0CglbMywgMTQ1LCAxMTUsIDEsIDE0NiwgMTE2XSwKCVs0LCA2NCwgNDAsIDUsIDY1LCA0MV0sCglbMTEsIDM2LCAxNiwgNSwgMzcsIDE3XSwKCVsxMSwgMzYsIDEyLCA1LCAzNywgMTNdLAoKCS8vIDE1CglbNSwgMTA5LCA4NywgMSwgMTEwLCA4OF0sCglbNSwgNjUsIDQxLCA1LCA2NiwgNDJdLAoJWzUsIDU0LCAyNCwgNywgNTUsIDI1XSwKCVsxMSwgMzYsIDEyXSwKCgkvLyAxNgoJWzUsIDEyMiwgOTgsIDEsIDEyMywgOTldLAoJWzcsIDczLCA0NSwgMywgNzQsIDQ2XSwKCVsxNSwgNDMsIDE5LCAyLCA0NCwgMjBdLAoJWzMsIDQ1LCAxNSwgMTMsIDQ2LCAxNl0sCgoJLy8gMTcKCVsxLCAxMzUsIDEwNywgNSwgMTM2LCAxMDhdLAoJWzEwLCA3NCwgNDYsIDEsIDc1LCA0N10sCglbMSwgNTAsIDIyLCAxNSwgNTEsIDIzXSwKCVsyLCA0MiwgMTQsIDE3LCA0MywgMTVdLAoKCS8vIDE4CglbNSwgMTUwLCAxMjAsIDEsIDE1MSwgMTIxXSwKCVs5LCA2OSwgNDMsIDQsIDcwLCA0NF0sCglbMTcsIDUwLCAyMiwgMSwgNTEsIDIzXSwKCVsyLCA0MiwgMTQsIDE5LCA0MywgMTVdLAoKCS8vIDE5CglbMywgMTQxLCAxMTMsIDQsIDE0MiwgMTE0XSwKCVszLCA3MCwgNDQsIDExLCA3MSwgNDVdLAoJWzE3LCA0NywgMjEsIDQsIDQ4LCAyMl0sCglbOSwgMzksIDEzLCAxNiwgNDAsIDE0XSwKCgkvLyAyMAoJWzMsIDEzNSwgMTA3LCA1LCAxMzYsIDEwOF0sCglbMywgNjcsIDQxLCAxMywgNjgsIDQyXSwKCVsxNSwgNTQsIDI0LCA1LCA1NSwgMjVdLAoJWzE1LCA0MywgMTUsIDEwLCA0NCwgMTZdLAoKCS8vIDIxCglbNCwgMTQ0LCAxMTYsIDQsIDE0NSwgMTE3XSwKCVsxNywgNjgsIDQyXSwKCVsxNywgNTAsIDIyLCA2LCA1MSwgMjNdLAoJWzE5LCA0NiwgMTYsIDYsIDQ3LCAxN10sCgoJLy8gMjIKCVsyLCAxMzksIDExMSwgNywgMTQwLCAxMTJdLAoJWzE3LCA3NCwgNDZdLAoJWzcsIDU0LCAyNCwgMTYsIDU1LCAyNV0sCglbMzQsIDM3LCAxM10sCgoJLy8gMjMKCVs0LCAxNTEsIDEyMSwgNSwgMTUyLCAxMjJdLAoJWzQsIDc1LCA0NywgMTQsIDc2LCA0OF0sCglbMTEsIDU0LCAyNCwgMTQsIDU1LCAyNV0sCglbMTYsIDQ1LCAxNSwgMTQsIDQ2LCAxNl0sCgoJLy8gMjQKCVs2LCAxNDcsIDExNywgNCwgMTQ4LCAxMThdLAoJWzYsIDczLCA0NSwgMTQsIDc0LCA0Nl0sCglbMTEsIDU0LCAyNCwgMTYsIDU1LCAyNV0sCglbMzAsIDQ2LCAxNiwgMiwgNDcsIDE3XSwKCgkvLyAyNQoJWzgsIDEzMiwgMTA2LCA0LCAxMzMsIDEwN10sCglbOCwgNzUsIDQ3LCAxMywgNzYsIDQ4XSwKCVs3LCA1NCwgMjQsIDIyLCA1NSwgMjVdLAoJWzIyLCA0NSwgMTUsIDEzLCA0NiwgMTZdLAoKCS8vIDI2CglbMTAsIDE0MiwgMTE0LCAyLCAxNDMsIDExNV0sCglbMTksIDc0LCA0NiwgNCwgNzUsIDQ3XSwKCVsyOCwgNTAsIDIyLCA2LCA1MSwgMjNdLAoJWzMzLCA0NiwgMTYsIDQsIDQ3LCAxN10sCgoJLy8gMjcKCVs4LCAxNTIsIDEyMiwgNCwgMTUzLCAxMjNdLAoJWzIyLCA3MywgNDUsIDMsIDc0LCA0Nl0sCglbOCwgNTMsIDIzLCAyNiwgNTQsIDI0XSwKCVsxMiwgNDUsIDE1LCAyOCwgNDYsIDE2XSwKCgkvLyAyOAoJWzMsIDE0NywgMTE3LCAxMCwgMTQ4LCAxMThdLAoJWzMsIDczLCA0NSwgMjMsIDc0LCA0Nl0sCglbNCwgNTQsIDI0LCAzMSwgNTUsIDI1XSwKCVsxMSwgNDUsIDE1LCAzMSwgNDYsIDE2XSwKCgkvLyAyOQoJWzcsIDE0NiwgMTE2LCA3LCAxNDcsIDExN10sCglbMjEsIDczLCA0NSwgNywgNzQsIDQ2XSwKCVsxLCA1MywgMjMsIDM3LCA1NCwgMjRdLAoJWzE5LCA0NSwgMTUsIDI2LCA0NiwgMTZdLAoKCS8vIDMwCglbNSwgMTQ1LCAxMTUsIDEwLCAxNDYsIDExNl0sCglbMTksIDc1LCA0NywgMTAsIDc2LCA0OF0sCglbMTUsIDU0LCAyNCwgMjUsIDU1LCAyNV0sCglbMjMsIDQ1LCAxNSwgMjUsIDQ2LCAxNl0sCgoJLy8gMzEKCVsxMywgMTQ1LCAxMTUsIDMsIDE0NiwgMTE2XSwKCVsyLCA3NCwgNDYsIDI5LCA3NSwgNDddLAoJWzQyLCA1NCwgMjQsIDEsIDU1LCAyNV0sCglbMjMsIDQ1LCAxNSwgMjgsIDQ2LCAxNl0sCgoJLy8gMzIKCVsxNywgMTQ1LCAxMTVdLAoJWzEwLCA3NCwgNDYsIDIzLCA3NSwgNDddLAoJWzEwLCA1NCwgMjQsIDM1LCA1NSwgMjVdLAoJWzE5LCA0NSwgMTUsIDM1LCA0NiwgMTZdLAoKCS8vIDMzCglbMTcsIDE0NSwgMTE1LCAxLCAxNDYsIDExNl0sCglbMTQsIDc0LCA0NiwgMjEsIDc1LCA0N10sCglbMjksIDU0LCAyNCwgMTksIDU1LCAyNV0sCglbMTEsIDQ1LCAxNSwgNDYsIDQ2LCAxNl0sCgoJLy8gMzQKCVsxMywgMTQ1LCAxMTUsIDYsIDE0NiwgMTE2XSwKCVsxNCwgNzQsIDQ2LCAyMywgNzUsIDQ3XSwKCVs0NCwgNTQsIDI0LCA3LCA1NSwgMjVdLAoJWzU5LCA0NiwgMTYsIDEsIDQ3LCAxN10sCgoJLy8gMzUKCVsxMiwgMTUxLCAxMjEsIDcsIDE1MiwgMTIyXSwKCVsxMiwgNzUsIDQ3LCAyNiwgNzYsIDQ4XSwKCVszOSwgNTQsIDI0LCAxNCwgNTUsIDI1XSwKCVsyMiwgNDUsIDE1LCA0MSwgNDYsIDE2XSwKCgkvLyAzNgoJWzYsIDE1MSwgMTIxLCAxNCwgMTUyLCAxMjJdLAoJWzYsIDc1LCA0NywgMzQsIDc2LCA0OF0sCglbNDYsIDU0LCAyNCwgMTAsIDU1LCAyNV0sCglbMiwgNDUsIDE1LCA2NCwgNDYsIDE2XSwKCgkvLyAzNwoJWzE3LCAxNTIsIDEyMiwgNCwgMTUzLCAxMjNdLAoJWzI5LCA3NCwgNDYsIDE0LCA3NSwgNDddLAoJWzQ5LCA1NCwgMjQsIDEwLCA1NSwgMjVdLAoJWzI0LCA0NSwgMTUsIDQ2LCA0NiwgMTZdLAoKCS8vIDM4CglbNCwgMTUyLCAxMjIsIDE4LCAxNTMsIDEyM10sCglbMTMsIDc0LCA0NiwgMzIsIDc1LCA0N10sCglbNDgsIDU0LCAyNCwgMTQsIDU1LCAyNV0sCglbNDIsIDQ1LCAxNSwgMzIsIDQ2LCAxNl0sCgoJLy8gMzkKCVsyMCwgMTQ3LCAxMTcsIDQsIDE0OCwgMTE4XSwKCVs0MCwgNzUsIDQ3LCA3LCA3NiwgNDhdLAoJWzQzLCA1NCwgMjQsIDIyLCA1NSwgMjVdLAoJWzEwLCA0NSwgMTUsIDY3LCA0NiwgMTZdLAoKCS8vIDQwCglbMTksIDE0OCwgMTE4LCA2LCAxNDksIDExOV0sCglbMTgsIDc1LCA0NywgMzEsIDc2LCA0OF0sCglbMzQsIDU0LCAyNCwgMzQsIDU1LCAyNV0sCglbMjAsIDQ1LCAxNSwgNjEsIDQ2LCAxNl0KXTsKClFSUlNCbG9jay5nZXRSU0Jsb2NrcyA9IGZ1bmN0aW9uKHR5cGVOdW1iZXIsIGVycm9yQ29ycmVjdExldmVsKSB7CgkKCXZhciByc0Jsb2NrID0gUVJSU0Jsb2NrLmdldFJzQmxvY2tUYWJsZSh0eXBlTnVtYmVyLCBlcnJvckNvcnJlY3RMZXZlbCk7CgkKCWlmIChyc0Jsb2NrID09PSB1bmRlZmluZWQpIHsKCQl0aHJvdyBuZXcgRXJyb3IoImJhZCBycyBibG9jayBAIHR5cGVOdW1iZXI6IiArIHR5cGVOdW1iZXIgKyAiL2Vycm9yQ29ycmVjdExldmVsOiIgKyBlcnJvckNvcnJlY3RMZXZlbCk7Cgl9CgoJdmFyIGxlbmd0aCA9IHJzQmxvY2subGVuZ3RoIC8gMzsKCQoJdmFyIGxpc3QgPSBbXTsKCQoJZm9yICh2YXIgaSA9IDA7IGkgPCBsZW5ndGg7IGkrKykgewoKCQl2YXIgY291bnQgPSByc0Jsb2NrW2kgKiAzICsgMF07CgkJdmFyIHRvdGFsQ291bnQgPSByc0Jsb2NrW2kgKiAzICsgMV07CgkJdmFyIGRhdGFDb3VudCAgPSByc0Jsb2NrW2kgKiAzICsgMl07CgoJCWZvciAodmFyIGogPSAwOyBqIDwgY291bnQ7IGorKykgewoJCQlsaXN0LnB1c2gobmV3IFFSUlNCbG9jayh0b3RhbENvdW50LCBkYXRhQ291bnQpICk7CQoJCX0KCX0KCQoJcmV0dXJuIGxpc3Q7Cn07CgpRUlJTQmxvY2suZ2V0UnNCbG9ja1RhYmxlID0gZnVuY3Rpb24odHlwZU51bWJlciwgZXJyb3JDb3JyZWN0TGV2ZWwpIHsKCglzd2l0Y2goZXJyb3JDb3JyZWN0TGV2ZWwpIHsKCWNhc2UgUVJFcnJvckNvcnJlY3RMZXZlbC5MIDoKCQlyZXR1cm4gUVJSU0Jsb2NrLlJTX0JMT0NLX1RBQkxFWyh0eXBlTnVtYmVyIC0gMSkgKiA0ICsgMF07CgljYXNlIFFSRXJyb3JDb3JyZWN0TGV2ZWwuTSA6CgkJcmV0dXJuIFFSUlNCbG9jay5SU19CTE9DS19UQUJMRVsodHlwZU51bWJlciAtIDEpICogNCArIDFdOwoJY2FzZSBRUkVycm9yQ29ycmVjdExldmVsLlEgOgoJCXJldHVybiBRUlJTQmxvY2suUlNfQkxPQ0tfVEFCTEVbKHR5cGVOdW1iZXIgLSAxKSAqIDQgKyAyXTsKCWNhc2UgUVJFcnJvckNvcnJlY3RMZXZlbC5IIDoKCQlyZXR1cm4gUVJSU0Jsb2NrLlJTX0JMT0NLX1RBQkxFWyh0eXBlTnVtYmVyIC0gMSkgKiA0ICsgM107CglkZWZhdWx0IDoKCQlyZXR1cm4gdW5kZWZpbmVkOwoJfQp9OwoKbW9kdWxlLmV4cG9ydHMgPSBRUlJTQmxvY2s7Cgp9LAoiLi9RUlV0aWwiOiBmdW5jdGlvbihtb2R1bGUsIGV4cG9ydHMsIHJlcXVpcmUpewp2YXIgUVJNb2RlID0gcmVxdWlyZSgnLi9RUk1vZGUnKTsKdmFyIFFSUG9seW5vbWlhbCA9IHJlcXVpcmUoJy4vUVJQb2x5bm9taWFsJyk7CnZhciBRUk1hdGggPSByZXF1aXJlKCcuL1FSTWF0aCcpOwp2YXIgUVJNYXNrUGF0dGVybiA9IHJlcXVpcmUoJy4vUVJNYXNrUGF0dGVybicpOwoKdmFyIFFSVXRpbCA9IHsKCiAgICBQQVRURVJOX1BPU0lUSU9OX1RBQkxFIDogWwogICAgICAgIFtdLAogICAgICAgIFs2LCAxOF0sCiAgICAgICAgWzYsIDIyXSwKICAgICAgICBbNiwgMjZdLAogICAgICAgIFs2LCAzMF0sCiAgICAgICAgWzYsIDM0XSwKICAgICAgICBbNiwgMjIsIDM4XSwKICAgICAgICBbNiwgMjQsIDQyXSwKICAgICAgICBbNiwgMjYsIDQ2XSwKICAgICAgICBbNiwgMjgsIDUwXSwKICAgICAgICBbNiwgMzAsIDU0XSwgICAgICAgIAogICAgICAgIFs2LCAzMiwgNThdLAogICAgICAgIFs2LCAzNCwgNjJdLAogICAgICAgIFs2LCAyNiwgNDYsIDY2XSwKICAgICAgICBbNiwgMjYsIDQ4LCA3MF0sCiAgICAgICAgWzYsIDI2LCA1MCwgNzRdLAogICAgICAgIFs2LCAzMCwgNTQsIDc4XSwKICAgICAgICBbNiwgMzAsIDU2LCA4Ml0sCiAgICAgICAgWzYsIDMwLCA1OCwgODZdLAogICAgICAgIFs2LCAzNCwgNjIsIDkwXSwKICAgICAgICBbNiwgMjgsIDUwLCA3MiwgOTRdLAogICAgICAgIFs2LCAyNiwgNTAsIDc0LCA5OF0sCiAgICAgICAgWzYsIDMwLCA1NCwgNzgsIDEwMl0sCiAgICAgICAgWzYsIDI4LCA1NCwgODAsIDEwNl0sCiAgICAgICAgWzYsIDMyLCA1OCwgODQsIDExMF0sCiAgICAgICAgWzYsIDMwLCA1OCwgODYsIDExNF0sCiAgICAgICAgWzYsIDM0LCA2MiwgOTAsIDExOF0sCiAgICAgICAgWzYsIDI2LCA1MCwgNzQsIDk4LCAxMjJdLAogICAgICAgIFs2LCAzMCwgNTQsIDc4LCAxMDIsIDEyNl0sCiAgICAgICAgWzYsIDI2LCA1MiwgNzgsIDEwNCwgMTMwXSwKICAgICAgICBbNiwgMzAsIDU2LCA4MiwgMTA4LCAxMzRdLAogICAgICAgIFs2LCAzNCwgNjAsIDg2LCAxMTIsIDEzOF0sCiAgICAgICAgWzYsIDMwLCA1OCwgODYsIDExNCwgMTQyXSwKICAgICAgICBbNiwgMzQsIDYyLCA5MCwgMTE4LCAxNDZdLAogICAgICAgIFs2LCAzMCwgNTQsIDc4LCAxMDIsIDEyNiwgMTUwXSwKICAgICAgICBbNiwgMjQsIDUwLCA3NiwgMTAyLCAxMjgsIDE1NF0sCiAgICAgICAgWzYsIDI4LCA1NCwgODAsIDEwNiwgMTMyLCAxNThdLAogICAgICAgIFs2LCAzMiwgNTgsIDg0LCAxMTAsIDEzNiwgMTYyXSwKICAgICAgICBbNiwgMjYsIDU0LCA4MiwgMTEwLCAxMzgsIDE2Nl0sCiAgICAgICAgWzYsIDMwLCA1OCwgODYsIDExNCwgMTQyLCAxNzBdCiAgICBdLAoKICAgIEcxNSA6ICgxIDw8IDEwKSB8ICgxIDw8IDgpIHwgKDEgPDwgNSkgfCAoMSA8PCA0KSB8ICgxIDw8IDIpIHwgKDEgPDwgMSkgfCAoMSA8PCAwKSwKICAgIEcxOCA6ICgxIDw8IDEyKSB8ICgxIDw8IDExKSB8ICgxIDw8IDEwKSB8ICgxIDw8IDkpIHwgKDEgPDwgOCkgfCAoMSA8PCA1KSB8ICgxIDw8IDIpIHwgKDEgPDwgMCksCiAgICBHMTVfTUFTSyA6ICgxIDw8IDE0KSB8ICgxIDw8IDEyKSB8ICgxIDw8IDEwKSAgICB8ICgxIDw8IDQpIHwgKDEgPDwgMSksCgogICAgZ2V0QkNIVHlwZUluZm8gOiBmdW5jdGlvbihkYXRhKSB7CiAgICAgICAgdmFyIGQgPSBkYXRhIDw8IDEwOwogICAgICAgIHdoaWxlIChRUlV0aWwuZ2V0QkNIRGlnaXQoZCkgLSBRUlV0aWwuZ2V0QkNIRGlnaXQoUVJVdGlsLkcxNSkgPj0gMCkgewogICAgICAgICAgICBkIF49IChRUlV0aWwuRzE1IDw8IChRUlV0aWwuZ2V0QkNIRGlnaXQoZCkgLSBRUlV0aWwuZ2V0QkNIRGlnaXQoUVJVdGlsLkcxNSkgKSApOyAgICAKICAgICAgICB9CiAgICAgICAgcmV0dXJuICggKGRhdGEgPDwgMTApIHwgZCkgXiBRUlV0aWwuRzE1X01BU0s7CiAgICB9LAoKICAgIGdldEJDSFR5cGVOdW1iZXIgOiBmdW5jdGlvbihkYXRhKSB7CiAgICAgICAgdmFyIGQgPSBkYXRhIDw8IDEyOwogICAgICAgIHdoaWxlIChRUlV0aWwuZ2V0QkNIRGlnaXQoZCkgLSBRUlV0aWwuZ2V0QkNIRGlnaXQoUVJVdGlsLkcxOCkgPj0gMCkgewogICAgICAgICAgICBkIF49IChRUlV0aWwuRzE4IDw8IChRUlV0aWwuZ2V0QkNIRGlnaXQoZCkgLSBRUlV0aWwuZ2V0QkNIRGlnaXQoUVJVdGlsLkcxOCkgKSApOyAgICAKICAgICAgICB9CiAgICAgICAgcmV0dXJuIChkYXRhIDw8IDEyKSB8IGQ7CiAgICB9LAoKICAgIGdldEJDSERpZ2l0IDogZnVuY3Rpb24oZGF0YSkgewoKICAgICAgICB2YXIgZGlnaXQgPSAwOwoKICAgICAgICB3aGlsZSAoZGF0YSAhPT0gMCkgewogICAgICAgICAgICBkaWdpdCsrOwogICAgICAgICAgICBkYXRhID4+Pj0gMTsKICAgICAgICB9CgogICAgICAgIHJldHVybiBkaWdpdDsKICAgIH0sCgogICAgZ2V0UGF0dGVyblBvc2l0aW9uIDogZnVuY3Rpb24odHlwZU51bWJlcikgewogICAgICAgIHJldHVybiBRUlV0aWwuUEFUVEVSTl9QT1NJVElPTl9UQUJMRVt0eXBlTnVtYmVyIC0gMV07CiAgICB9LAoKICAgIGdldE1hc2sgOiBmdW5jdGlvbihtYXNrUGF0dGVybiwgaSwgaikgewogICAgICAgIAogICAgICAgIHN3aXRjaCAobWFza1BhdHRlcm4pIHsKICAgICAgICAgICAgCiAgICAgICAgY2FzZSBRUk1hc2tQYXR0ZXJuLlBBVFRFUk4wMDAgOiByZXR1cm4gKGkgKyBqKSAlIDIgPT09IDA7CiAgICAgICAgY2FzZSBRUk1hc2tQYXR0ZXJuLlBBVFRFUk4wMDEgOiByZXR1cm4gaSAlIDIgPT09IDA7CiAgICAgICAgY2FzZSBRUk1hc2tQYXR0ZXJuLlBBVFRFUk4wMTAgOiByZXR1cm4gaiAlIDMgPT09IDA7CiAgICAgICAgY2FzZSBRUk1hc2tQYXR0ZXJuLlBBVFRFUk4wMTEgOiByZXR1cm4gKGkgKyBqKSAlIDMgPT09IDA7CiAgICAgICAgY2FzZSBRUk1hc2tQYXR0ZXJuLlBBVFRFUk4xMDAgOiByZXR1cm4gKE1hdGguZmxvb3IoaSAvIDIpICsgTWF0aC5mbG9vcihqIC8gMykgKSAlIDIgPT09IDA7CiAgICAgICAgY2FzZSBRUk1hc2tQYXR0ZXJuLlBBVFRFUk4xMDEgOiByZXR1cm4gKGkgKiBqKSAlIDIgKyAoaSAqIGopICUgMyA9PT0gMDsKICAgICAgICBjYXNlIFFSTWFza1BhdHRlcm4uUEFUVEVSTjExMCA6IHJldHVybiAoIChpICogaikgJSAyICsgKGkgKiBqKSAlIDMpICUgMiA9PT0gMDsKICAgICAgICBjYXNlIFFSTWFza1BhdHRlcm4uUEFUVEVSTjExMSA6IHJldHVybiAoIChpICogaikgJSAzICsgKGkgKyBqKSAlIDIpICUgMiA9PT0gMDsKCiAgICAgICAgZGVmYXVsdCA6CiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigiYmFkIG1hc2tQYXR0ZXJuOiIgKyBtYXNrUGF0dGVybik7CiAgICAgICAgfQogICAgfSwKCiAgICBnZXRFcnJvckNvcnJlY3RQb2x5bm9taWFsIDogZnVuY3Rpb24oZXJyb3JDb3JyZWN0TGVuZ3RoKSB7CgogICAgICAgIHZhciBhID0gbmV3IFFSUG9seW5vbWlhbChbMV0sIDApOwoKICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGVycm9yQ29ycmVjdExlbmd0aDsgaSsrKSB7CiAgICAgICAgICAgIGEgPSBhLm11bHRpcGx5KG5ldyBRUlBvbHlub21pYWwoWzEsIFFSTWF0aC5nZXhwKGkpXSwgMCkgKTsKICAgICAgICB9CgogICAgICAgIHJldHVybiBhOwogICAgfSwKCiAgICBnZXRMZW5ndGhJbkJpdHMgOiBmdW5jdGlvbihtb2RlLCB0eXBlKSB7CgogICAgICAgIGlmICgxIDw9IHR5cGUgJiYgdHlwZSA8IDEwKSB7CgogICAgICAgICAgICAvLyAxIC0gOQoKICAgICAgICAgICAgc3dpdGNoKG1vZGUpIHsKICAgICAgICAgICAgY2FzZSBRUk1vZGUuTU9ERV9OVU1CRVIgICAgIDogcmV0dXJuIDEwOwogICAgICAgICAgICBjYXNlIFFSTW9kZS5NT0RFX0FMUEhBX05VTSAgOiByZXR1cm4gOTsKICAgICAgICAgICAgY2FzZSBRUk1vZGUuTU9ERV84QklUX0JZVEUgIDogcmV0dXJuIDg7CiAgICAgICAgICAgIGNhc2UgUVJNb2RlLk1PREVfS0FOSkkgICAgICA6IHJldHVybiA4OwogICAgICAgICAgICBkZWZhdWx0IDoKICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigibW9kZToiICsgbW9kZSk7CiAgICAgICAgICAgIH0KCiAgICAgICAgfSBlbHNlIGlmICh0eXBlIDwgMjcpIHsKCiAgICAgICAgICAgIC8vIDEwIC0gMjYKCiAgICAgICAgICAgIHN3aXRjaChtb2RlKSB7CiAgICAgICAgICAgIGNhc2UgUVJNb2RlLk1PREVfTlVNQkVSICAgICA6IHJldHVybiAxMjsKICAgICAgICAgICAgY2FzZSBRUk1vZGUuTU9ERV9BTFBIQV9OVU0gIDogcmV0dXJuIDExOwogICAgICAgICAgICBjYXNlIFFSTW9kZS5NT0RFXzhCSVRfQllURSAgOiByZXR1cm4gMTY7CiAgICAgICAgICAgIGNhc2UgUVJNb2RlLk1PREVfS0FOSkkgICAgICA6IHJldHVybiAxMDsKICAgICAgICAgICAgZGVmYXVsdCA6CiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoIm1vZGU6IiArIG1vZGUpOwogICAgICAgICAgICB9CgogICAgICAgIH0gZWxzZSBpZiAodHlwZSA8IDQxKSB7CgogICAgICAgICAgICAvLyAyNyAtIDQwCgogICAgICAgICAgICBzd2l0Y2gobW9kZSkgewogICAgICAgICAgICBjYXNlIFFSTW9kZS5NT0RFX05VTUJFUiAgICAgOiByZXR1cm4gMTQ7CiAgICAgICAgICAgIGNhc2UgUVJNb2RlLk1PREVfQUxQSEFfTlVNICA6IHJldHVybiAxMzsKICAgICAgICAgICAgY2FzZSBRUk1vZGUuTU9ERV84QklUX0JZVEUgIDogcmV0dXJuIDE2OwogICAgICAgICAgICBjYXNlIFFSTW9kZS5NT0RFX0tBTkpJICAgICAgOiByZXR1cm4gMTI7CiAgICAgICAgICAgIGRlZmF1bHQgOgogICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCJtb2RlOiIgKyBtb2RlKTsKICAgICAgICAgICAgfQoKICAgICAgICB9IGVsc2UgewogICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoInR5cGU6IiArIHR5cGUpOwogICAgICAgIH0KICAgIH0sCgogICAgZ2V0TG9zdFBvaW50IDogZnVuY3Rpb24ocXJDb2RlKSB7CiAgICAgICAgCiAgICAgICAgdmFyIG1vZHVsZUNvdW50ID0gcXJDb2RlLmdldE1vZHVsZUNvdW50KCk7CiAgICAgICAgdmFyIGxvc3RQb2ludCA9IDA7CiAgICAgICAgdmFyIHJvdyA9IDA7IAogICAgICAgIHZhciBjb2wgPSAwOwoKICAgICAgICAKICAgICAgICAvLyBMRVZFTDEKICAgICAgICAKICAgICAgICBmb3IgKHJvdyA9IDA7IHJvdyA8IG1vZHVsZUNvdW50OyByb3crKykgewoKICAgICAgICAgICAgZm9yIChjb2wgPSAwOyBjb2wgPCBtb2R1bGVDb3VudDsgY29sKyspIHsKCiAgICAgICAgICAgICAgICB2YXIgc2FtZUNvdW50ID0gMDsKICAgICAgICAgICAgICAgIHZhciBkYXJrID0gcXJDb2RlLmlzRGFyayhyb3csIGNvbCk7CgogICAgICAgICAgICAgICAgZm9yICh2YXIgciA9IC0xOyByIDw9IDE7IHIrKykgewoKICAgICAgICAgICAgICAgICAgICBpZiAocm93ICsgciA8IDAgfHwgbW9kdWxlQ291bnQgPD0gcm93ICsgcikgewogICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTsKICAgICAgICAgICAgICAgICAgICB9CgogICAgICAgICAgICAgICAgICAgIGZvciAodmFyIGMgPSAtMTsgYyA8PSAxOyBjKyspIHsKCiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb2wgKyBjIDwgMCB8fCBtb2R1bGVDb3VudCA8PSBjb2wgKyBjKSB7CiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTsKICAgICAgICAgICAgICAgICAgICAgICAgfQoKICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHIgPT09IDAgJiYgYyA9PT0gMCkgewogICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7CiAgICAgICAgICAgICAgICAgICAgICAgIH0KCiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkYXJrID09PSBxckNvZGUuaXNEYXJrKHJvdyArIHIsIGNvbCArIGMpICkgewogICAgICAgICAgICAgICAgICAgICAgICAgICAgc2FtZUNvdW50Kys7CiAgICAgICAgICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgICAgICAgICB9CiAgICAgICAgICAgICAgICB9CgogICAgICAgICAgICAgICAgaWYgKHNhbWVDb3VudCA+IDUpIHsKICAgICAgICAgICAgICAgICAgICBsb3N0UG9pbnQgKz0gKDMgKyBzYW1lQ291bnQgLSA1KTsKICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgfQogICAgICAgIH0KCiAgICAgICAgLy8gTEVWRUwyCgogICAgICAgIGZvciAocm93ID0gMDsgcm93IDwgbW9kdWxlQ291bnQgLSAxOyByb3crKykgewogICAgICAgICAgICBmb3IgKGNvbCA9IDA7IGNvbCA8IG1vZHVsZUNvdW50IC0gMTsgY29sKyspIHsKICAgICAgICAgICAgICAgIHZhciBjb3VudCA9IDA7CiAgICAgICAgICAgICAgICBpZiAocXJDb2RlLmlzRGFyayhyb3csICAgICBjb2wgICAgKSApIGNvdW50Kys7CiAgICAgICAgICAgICAgICBpZiAocXJDb2RlLmlzRGFyayhyb3cgKyAxLCBjb2wgICAgKSApIGNvdW50Kys7CiAgICAgICAgICAgICAgICBpZiAocXJDb2RlLmlzRGFyayhyb3csICAgICBjb2wgKyAxKSApIGNvdW50Kys7CiAgICAgICAgICAgICAgICBpZiAocXJDb2RlLmlzRGFyayhyb3cgKyAxLCBjb2wgKyAxKSApIGNvdW50Kys7CiAgICAgICAgICAgICAgICBpZiAoY291bnQgPT09IDAgfHwgY291bnQgPT09IDQpIHsKICAgICAgICAgICAgICAgICAgICBsb3N0UG9pbnQgKz0gMzsKICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgfQogICAgICAgIH0KCiAgICAgICAgLy8gTEVWRUwzCgogICAgICAgIGZvciAocm93ID0gMDsgcm93IDwgbW9kdWxlQ291bnQ7IHJvdysrKSB7CiAgICAgICAgICAgIGZvciAoY29sID0gMDsgY29sIDwgbW9kdWxlQ291bnQgLSA2OyBjb2wrKykgewogICAgICAgICAgICAgICAgaWYgKHFyQ29kZS5pc0Rhcmsocm93LCBjb2wpICYmIAogICAgICAgICAgICAgICAgICAgICAgICAhcXJDb2RlLmlzRGFyayhyb3csIGNvbCArIDEpICYmIAogICAgICAgICAgICAgICAgICAgICAgICAgcXJDb2RlLmlzRGFyayhyb3csIGNvbCArIDIpICYmIAogICAgICAgICAgICAgICAgICAgICAgICAgcXJDb2RlLmlzRGFyayhyb3csIGNvbCArIDMpICYmIAogICAgICAgICAgICAgICAgICAgICAgICAgcXJDb2RlLmlzRGFyayhyb3csIGNvbCArIDQpICYmIAogICAgICAgICAgICAgICAgICAgICAgICAhcXJDb2RlLmlzRGFyayhyb3csIGNvbCArIDUpICYmIAogICAgICAgICAgICAgICAgICAgICAgICAgcXJDb2RlLmlzRGFyayhyb3csIGNvbCArIDYpICkgewogICAgICAgICAgICAgICAgICAgIGxvc3RQb2ludCArPSA0MDsKICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgfQogICAgICAgIH0KCiAgICAgICAgZm9yIChjb2wgPSAwOyBjb2wgPCBtb2R1bGVDb3VudDsgY29sKyspIHsKICAgICAgICAgICAgZm9yIChyb3cgPSAwOyByb3cgPCBtb2R1bGVDb3VudCAtIDY7IHJvdysrKSB7CiAgICAgICAgICAgICAgICBpZiAocXJDb2RlLmlzRGFyayhyb3csIGNvbCkgJiYKICAgICAgICAgICAgICAgICAgICAgICAgIXFyQ29kZS5pc0Rhcmsocm93ICsgMSwgY29sKSAmJgogICAgICAgICAgICAgICAgICAgICAgICAgcXJDb2RlLmlzRGFyayhyb3cgKyAyLCBjb2wpICYmCiAgICAgICAgICAgICAgICAgICAgICAgICBxckNvZGUuaXNEYXJrKHJvdyArIDMsIGNvbCkgJiYKICAgICAgICAgICAgICAgICAgICAgICAgIHFyQ29kZS5pc0Rhcmsocm93ICsgNCwgY29sKSAmJgogICAgICAgICAgICAgICAgICAgICAgICAhcXJDb2RlLmlzRGFyayhyb3cgKyA1LCBjb2wpICYmCiAgICAgICAgICAgICAgICAgICAgICAgICBxckNvZGUuaXNEYXJrKHJvdyArIDYsIGNvbCkgKSB7CiAgICAgICAgICAgICAgICAgICAgbG9zdFBvaW50ICs9IDQwOwogICAgICAgICAgICAgICAgfQogICAgICAgICAgICB9CiAgICAgICAgfQoKICAgICAgICAvLyBMRVZFTDQKICAgICAgICAKICAgICAgICB2YXIgZGFya0NvdW50ID0gMDsKCiAgICAgICAgZm9yIChjb2wgPSAwOyBjb2wgPCBtb2R1bGVDb3VudDsgY29sKyspIHsKICAgICAgICAgICAgZm9yIChyb3cgPSAwOyByb3cgPCBtb2R1bGVDb3VudDsgcm93KyspIHsKICAgICAgICAgICAgICAgIGlmIChxckNvZGUuaXNEYXJrKHJvdywgY29sKSApIHsKICAgICAgICAgICAgICAgICAgICBkYXJrQ291bnQrKzsKICAgICAgICAgICAgICAgIH0KICAgICAgICAgICAgfQogICAgICAgIH0KICAgICAgICAKICAgICAgICB2YXIgcmF0aW8gPSBNYXRoLmFicygxMDAgKiBkYXJrQ291bnQgLyBtb2R1bGVDb3VudCAvIG1vZHVsZUNvdW50IC0gNTApIC8gNTsKICAgICAgICBsb3N0UG9pbnQgKz0gcmF0aW8gKiAxMDsKCiAgICAgICAgcmV0dXJuIGxvc3RQb2ludDsgICAgICAgCiAgICB9Cgp9OwoKbW9kdWxlLmV4cG9ydHMgPSBRUlV0aWw7Cgp9LAoiLi9pbmRleCI6IGZ1bmN0aW9uKG1vZHVsZSwgZXhwb3J0cywgcmVxdWlyZSl7Ci8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tCi8vIFFSQ29kZSBmb3IgSmF2YVNjcmlwdAovLwovLyBDb3B5cmlnaHQgKGMpIDIwMDkgS2F6dWhpa28gQXJhc2UKLy8KLy8gVVJMOiBodHRwOi8vd3d3LmQtcHJvamVjdC5jb20vCi8vCi8vIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgbGljZW5zZToKLy8gICBodHRwOi8vd3d3Lm9wZW5zb3VyY2Uub3JnL2xpY2Vuc2VzL21pdC1saWNlbnNlLnBocAovLwovLyBUaGUgd29yZCAiUVIgQ29kZSIgaXMgcmVnaXN0ZXJlZCB0cmFkZW1hcmsgb2YgCi8vIERFTlNPIFdBVkUgSU5DT1JQT1JBVEVECi8vICAgaHR0cDovL3d3dy5kZW5zby13YXZlLmNvbS9xcmNvZGUvZmFxcGF0ZW50LWUuaHRtbAovLwovLy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLQovLyBNb2RpZmllZCB0byB3b3JrIGluIG5vZGUgZm9yIHRoaXMgcHJvamVjdCAoYW5kIHNvbWUgcmVmYWN0b3JpbmcpCi8vLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tCgp2YXIgUVI4Yml0Qnl0ZSA9IHJlcXVpcmUoJy4vUVI4Yml0Qnl0ZScpOwp2YXIgUVJVdGlsID0gcmVxdWlyZSgnLi9RUlV0aWwnKTsKdmFyIFFSUG9seW5vbWlhbCA9IHJlcXVpcmUoJy4vUVJQb2x5bm9taWFsJyk7CnZhciBRUlJTQmxvY2sgPSByZXF1aXJlKCcuL1FSUlNCbG9jaycpOwp2YXIgUVJCaXRCdWZmZXIgPSByZXF1aXJlKCcuL1FSQml0QnVmZmVyJyk7CgpmdW5jdGlvbiBRUkNvZGUodHlwZU51bWJlciwgZXJyb3JDb3JyZWN0TGV2ZWwpIHsKCXRoaXMudHlwZU51bWJlciA9IHR5cGVOdW1iZXI7Cgl0aGlzLmVycm9yQ29ycmVjdExldmVsID0gZXJyb3JDb3JyZWN0TGV2ZWw7Cgl0aGlzLm1vZHVsZXMgPSBudWxsOwoJdGhpcy5tb2R1bGVDb3VudCA9IDA7Cgl0aGlzLmRhdGFDYWNoZSA9IG51bGw7Cgl0aGlzLmRhdGFMaXN0ID0gW107Cn0KClFSQ29kZS5wcm90b3R5cGUgPSB7CgkKCWFkZERhdGEgOiBmdW5jdGlvbihkYXRhKSB7CgkJdmFyIG5ld0RhdGEgPSBuZXcgUVI4Yml0Qnl0ZShkYXRhKTsKCQl0aGlzLmRhdGFMaXN0LnB1c2gobmV3RGF0YSk7CgkJdGhpcy5kYXRhQ2FjaGUgPSBudWxsOwoJfSwKCQoJaXNEYXJrIDogZnVuY3Rpb24ocm93LCBjb2wpIHsKCQlpZiAocm93IDwgMCB8fCB0aGlzLm1vZHVsZUNvdW50IDw9IHJvdyB8fCBjb2wgPCAwIHx8IHRoaXMubW9kdWxlQ291bnQgPD0gY29sKSB7CgkJCXRocm93IG5ldyBFcnJvcihyb3cgKyAiLCIgKyBjb2wpOwoJCX0KCQlyZXR1cm4gdGhpcy5tb2R1bGVzW3Jvd11bY29sXTsKCX0sCgoJZ2V0TW9kdWxlQ291bnQgOiBmdW5jdGlvbigpIHsKCQlyZXR1cm4gdGhpcy5tb2R1bGVDb3VudDsKCX0sCgkKCW1ha2UgOiBmdW5jdGlvbigpIHsKCQkvLyBDYWxjdWxhdGUgYXV0b21hdGljYWxseSB0eXBlTnVtYmVyIGlmIHByb3ZpZGVkIGlzIDwgMQoJCWlmICh0aGlzLnR5cGVOdW1iZXIgPCAxICl7CgkJCXZhciB0eXBlTnVtYmVyID0gMTsKCQkJZm9yICh0eXBlTnVtYmVyID0gMTsgdHlwZU51bWJlciA8IDQwOyB0eXBlTnVtYmVyKyspIHsKCQkJCXZhciByc0Jsb2NrcyA9IFFSUlNCbG9jay5nZXRSU0Jsb2Nrcyh0eXBlTnVtYmVyLCB0aGlzLmVycm9yQ29ycmVjdExldmVsKTsKCgkJCQl2YXIgYnVmZmVyID0gbmV3IFFSQml0QnVmZmVyKCk7CgkJCQl2YXIgdG90YWxEYXRhQ291bnQgPSAwOwoJCQkJZm9yICh2YXIgaSA9IDA7IGkgPCByc0Jsb2Nrcy5sZW5ndGg7IGkrKykgewoJCQkJCXRvdGFsRGF0YUNvdW50ICs9IHJzQmxvY2tzW2ldLmRhdGFDb3VudDsKCQkJCX0KCgkJCQlmb3IgKHZhciB4ID0gMDsgeCA8IHRoaXMuZGF0YUxpc3QubGVuZ3RoOyB4KyspIHsKCQkJCQl2YXIgZGF0YSA9IHRoaXMuZGF0YUxpc3RbeF07CgkJCQkJYnVmZmVyLnB1dChkYXRhLm1vZGUsIDQpOwoJCQkJCWJ1ZmZlci5wdXQoZGF0YS5nZXRMZW5ndGgoKSwgUVJVdGlsLmdldExlbmd0aEluQml0cyhkYXRhLm1vZGUsIHR5cGVOdW1iZXIpICk7CgkJCQkJZGF0YS53cml0ZShidWZmZXIpOwoJCQkJfQoJCQkJaWYgKGJ1ZmZlci5nZXRMZW5ndGhJbkJpdHMoKSA8PSB0b3RhbERhdGFDb3VudCAqIDgpCgkJCQkJYnJlYWs7CgkJCX0KCQkJdGhpcy50eXBlTnVtYmVyID0gdHlwZU51bWJlcjsKCQl9CgkJdGhpcy5tYWtlSW1wbChmYWxzZSwgdGhpcy5nZXRCZXN0TWFza1BhdHRlcm4oKSApOwoJfSwKCQoJbWFrZUltcGwgOiBmdW5jdGlvbih0ZXN0LCBtYXNrUGF0dGVybikgewoJCQoJCXRoaXMubW9kdWxlQ291bnQgPSB0aGlzLnR5cGVOdW1iZXIgKiA0ICsgMTc7CgkJdGhpcy5tb2R1bGVzID0gbmV3IEFycmF5KHRoaXMubW9kdWxlQ291bnQpOwoJCQoJCWZvciAodmFyIHJvdyA9IDA7IHJvdyA8IHRoaXMubW9kdWxlQ291bnQ7IHJvdysrKSB7CgkJCQoJCQl0aGlzLm1vZHVsZXNbcm93XSA9IG5ldyBBcnJheSh0aGlzLm1vZHVsZUNvdW50KTsKCQkJCgkJCWZvciAodmFyIGNvbCA9IDA7IGNvbCA8IHRoaXMubW9kdWxlQ291bnQ7IGNvbCsrKSB7CgkJCQl0aGlzLm1vZHVsZXNbcm93XVtjb2xdID0gbnVsbDsvLyhjb2wgKyByb3cpICUgMzsKCQkJfQoJCX0KCQoJCXRoaXMuc2V0dXBQb3NpdGlvblByb2JlUGF0dGVybigwLCAwKTsKCQl0aGlzLnNldHVwUG9zaXRpb25Qcm9iZVBhdHRlcm4odGhpcy5tb2R1bGVDb3VudCAtIDcsIDApOwoJCXRoaXMuc2V0dXBQb3NpdGlvblByb2JlUGF0dGVybigwLCB0aGlzLm1vZHVsZUNvdW50IC0gNyk7CgkJdGhpcy5zZXR1cFBvc2l0aW9uQWRqdXN0UGF0dGVybigpOwoJCXRoaXMuc2V0dXBUaW1pbmdQYXR0ZXJuKCk7CgkJdGhpcy5zZXR1cFR5cGVJbmZvKHRlc3QsIG1hc2tQYXR0ZXJuKTsKCQkKCQlpZiAodGhpcy50eXBlTnVtYmVyID49IDcpIHsKCQkJdGhpcy5zZXR1cFR5cGVOdW1iZXIodGVzdCk7CgkJfQoJCgkJaWYgKHRoaXMuZGF0YUNhY2hlID09PSBudWxsKSB7CgkJCXRoaXMuZGF0YUNhY2hlID0gUVJDb2RlLmNyZWF0ZURhdGEodGhpcy50eXBlTnVtYmVyLCB0aGlzLmVycm9yQ29ycmVjdExldmVsLCB0aGlzLmRhdGFMaXN0KTsKCQl9CgkKCQl0aGlzLm1hcERhdGEodGhpcy5kYXRhQ2FjaGUsIG1hc2tQYXR0ZXJuKTsKCX0sCgoJc2V0dXBQb3NpdGlvblByb2JlUGF0dGVybiA6IGZ1bmN0aW9uKHJvdywgY29sKSAgewoJCQoJCWZvciAodmFyIHIgPSAtMTsgciA8PSA3OyByKyspIHsKCQkJCgkJCWlmIChyb3cgKyByIDw9IC0xIHx8IHRoaXMubW9kdWxlQ291bnQgPD0gcm93ICsgcikgY29udGludWU7CgkJCQoJCQlmb3IgKHZhciBjID0gLTE7IGMgPD0gNzsgYysrKSB7CgkJCQkKCQkJCWlmIChjb2wgKyBjIDw9IC0xIHx8IHRoaXMubW9kdWxlQ291bnQgPD0gY29sICsgYykgY29udGludWU7CgkJCQkKCQkJCWlmICggKDAgPD0gciAmJiByIDw9IDYgJiYgKGMgPT09IDAgfHwgYyA9PT0gNikgKSB8fCAKICAgICAgICAgICAgICAgICAgICAgKDAgPD0gYyAmJiBjIDw9IDYgJiYgKHIgPT09IDAgfHwgciA9PT0gNikgKSB8fCAKICAgICAgICAgICAgICAgICAgICAgKDIgPD0gciAmJiByIDw9IDQgJiYgMiA8PSBjICYmIGMgPD0gNCkgKSB7CgkJCQkJdGhpcy5tb2R1bGVzW3JvdyArIHJdW2NvbCArIGNdID0gdHJ1ZTsKCQkJCX0gZWxzZSB7CgkJCQkJdGhpcy5tb2R1bGVzW3JvdyArIHJdW2NvbCArIGNdID0gZmFsc2U7CgkJCQl9CgkJCX0JCQoJCX0JCQoJfSwKCQoJZ2V0QmVzdE1hc2tQYXR0ZXJuIDogZnVuY3Rpb24oKSB7CgkKCQl2YXIgbWluTG9zdFBvaW50ID0gMDsKCQl2YXIgcGF0dGVybiA9IDA7CgkKCQlmb3IgKHZhciBpID0gMDsgaSA8IDg7IGkrKykgewoJCQkKCQkJdGhpcy5tYWtlSW1wbCh0cnVlLCBpKTsKCQoJCQl2YXIgbG9zdFBvaW50ID0gUVJVdGlsLmdldExvc3RQb2ludCh0aGlzKTsKCQoJCQlpZiAoaSA9PT0gMCB8fCBtaW5Mb3N0UG9pbnQgPiAgbG9zdFBvaW50KSB7CgkJCQltaW5Mb3N0UG9pbnQgPSBsb3N0UG9pbnQ7CgkJCQlwYXR0ZXJuID0gaTsKCQkJfQoJCX0KCQoJCXJldHVybiBwYXR0ZXJuOwoJfSwKCQoJY3JlYXRlTW92aWVDbGlwIDogZnVuY3Rpb24odGFyZ2V0X21jLCBpbnN0YW5jZV9uYW1lLCBkZXB0aCkgewoJCgkJdmFyIHFyX21jID0gdGFyZ2V0X21jLmNyZWF0ZUVtcHR5TW92aWVDbGlwKGluc3RhbmNlX25hbWUsIGRlcHRoKTsKCQl2YXIgY3MgPSAxOwoJCgkJdGhpcy5tYWtlKCk7CgoJCWZvciAodmFyIHJvdyA9IDA7IHJvdyA8IHRoaXMubW9kdWxlcy5sZW5ndGg7IHJvdysrKSB7CgkJCQoJCQl2YXIgeSA9IHJvdyAqIGNzOwoJCQkKCQkJZm9yICh2YXIgY29sID0gMDsgY29sIDwgdGhpcy5tb2R1bGVzW3Jvd10ubGVuZ3RoOyBjb2wrKykgewoJCgkJCQl2YXIgeCA9IGNvbCAqIGNzOwoJCQkJdmFyIGRhcmsgPSB0aGlzLm1vZHVsZXNbcm93XVtjb2xdOwoJCQkKCQkJCWlmIChkYXJrKSB7CgkJCQkJcXJfbWMuYmVnaW5GaWxsKDAsIDEwMCk7CgkJCQkJcXJfbWMubW92ZVRvKHgsIHkpOwoJCQkJCXFyX21jLmxpbmVUbyh4ICsgY3MsIHkpOwoJCQkJCXFyX21jLmxpbmVUbyh4ICsgY3MsIHkgKyBjcyk7CgkJCQkJcXJfbWMubGluZVRvKHgsIHkgKyBjcyk7CgkJCQkJcXJfbWMuZW5kRmlsbCgpOwoJCQkJfQoJCQl9CgkJfQoJCQoJCXJldHVybiBxcl9tYzsKCX0sCgoJc2V0dXBUaW1pbmdQYXR0ZXJuIDogZnVuY3Rpb24oKSB7CgkJCgkJZm9yICh2YXIgciA9IDg7IHIgPCB0aGlzLm1vZHVsZUNvdW50IC0gODsgcisrKSB7CgkJCWlmICh0aGlzLm1vZHVsZXNbcl1bNl0gIT09IG51bGwpIHsKCQkJCWNvbnRpbnVlOwoJCQl9CgkJCXRoaXMubW9kdWxlc1tyXVs2XSA9IChyICUgMiA9PT0gMCk7CgkJfQoJCgkJZm9yICh2YXIgYyA9IDg7IGMgPCB0aGlzLm1vZHVsZUNvdW50IC0gODsgYysrKSB7CgkJCWlmICh0aGlzLm1vZHVsZXNbNl1bY10gIT09IG51bGwpIHsKCQkJCWNvbnRpbnVlOwoJCQl9CgkJCXRoaXMubW9kdWxlc1s2XVtjXSA9IChjICUgMiA9PT0gMCk7CgkJfQoJfSwKCQoJc2V0dXBQb3NpdGlvbkFkanVzdFBhdHRlcm4gOiBmdW5jdGlvbigpIHsKCQoJCXZhciBwb3MgPSBRUlV0aWwuZ2V0UGF0dGVyblBvc2l0aW9uKHRoaXMudHlwZU51bWJlcik7CgkJCgkJZm9yICh2YXIgaSA9IDA7IGkgPCBwb3MubGVuZ3RoOyBpKyspIHsKCQkKCQkJZm9yICh2YXIgaiA9IDA7IGogPCBwb3MubGVuZ3RoOyBqKyspIHsKCQkJCgkJCQl2YXIgcm93ID0gcG9zW2ldOwoJCQkJdmFyIGNvbCA9IHBvc1tqXTsKCQkJCQoJCQkJaWYgKHRoaXMubW9kdWxlc1tyb3ddW2NvbF0gIT09IG51bGwpIHsKCQkJCQljb250aW51ZTsKCQkJCX0KCQkJCQoJCQkJZm9yICh2YXIgciA9IC0yOyByIDw9IDI7IHIrKykgewoJCQkJCgkJCQkJZm9yICh2YXIgYyA9IC0yOyBjIDw9IDI7IGMrKykgewoJCQkJCQoJCQkJCQlpZiAoTWF0aC5hYnMocikgPT09IDIgfHwgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICBNYXRoLmFicyhjKSA9PT0gMiB8fAogICAgICAgICAgICAgICAgICAgICAgICAgICAgKHIgPT09IDAgJiYgYyA9PT0gMCkgKSB7CgkJCQkJCQl0aGlzLm1vZHVsZXNbcm93ICsgcl1bY29sICsgY10gPSB0cnVlOwoJCQkJCQl9IGVsc2UgewoJCQkJCQkJdGhpcy5tb2R1bGVzW3JvdyArIHJdW2NvbCArIGNdID0gZmFsc2U7CgkJCQkJCX0KCQkJCQl9CgkJCQl9CgkJCX0KCQl9Cgl9LAoJCglzZXR1cFR5cGVOdW1iZXIgOiBmdW5jdGlvbih0ZXN0KSB7CgkKCQl2YXIgYml0cyA9IFFSVXRpbC5nZXRCQ0hUeXBlTnVtYmVyKHRoaXMudHlwZU51bWJlcik7CiAgICAgICAgdmFyIG1vZDsKCQoJCWZvciAodmFyIGkgPSAwOyBpIDwgMTg7IGkrKykgewoJCQltb2QgPSAoIXRlc3QgJiYgKCAoYml0cyA+PiBpKSAmIDEpID09PSAxKTsKCQkJdGhpcy5tb2R1bGVzW01hdGguZmxvb3IoaSAvIDMpXVtpICUgMyArIHRoaXMubW9kdWxlQ291bnQgLSA4IC0gM10gPSBtb2Q7CgkJfQoJCgkJZm9yICh2YXIgeCA9IDA7IHggPCAxODsgeCsrKSB7CgkJCW1vZCA9ICghdGVzdCAmJiAoIChiaXRzID4+IHgpICYgMSkgPT09IDEpOwoJCQl0aGlzLm1vZHVsZXNbeCAlIDMgKyB0aGlzLm1vZHVsZUNvdW50IC0gOCAtIDNdW01hdGguZmxvb3IoeCAvIDMpXSA9IG1vZDsKCQl9Cgl9LAoJCglzZXR1cFR5cGVJbmZvIDogZnVuY3Rpb24odGVzdCwgbWFza1BhdHRlcm4pIHsKCQoJCXZhciBkYXRhID0gKHRoaXMuZXJyb3JDb3JyZWN0TGV2ZWwgPDwgMykgfCBtYXNrUGF0dGVybjsKCQl2YXIgYml0cyA9IFFSVXRpbC5nZXRCQ0hUeXBlSW5mbyhkYXRhKTsKICAgICAgICB2YXIgbW9kOwoJCgkJLy8gdmVydGljYWwJCQoJCWZvciAodmFyIHYgPSAwOyB2IDwgMTU7IHYrKykgewoJCgkJCW1vZCA9ICghdGVzdCAmJiAoIChiaXRzID4+IHYpICYgMSkgPT09IDEpOwoJCgkJCWlmICh2IDwgNikgewoJCQkJdGhpcy5tb2R1bGVzW3ZdWzhdID0gbW9kOwoJCQl9IGVsc2UgaWYgKHYgPCA4KSB7CgkJCQl0aGlzLm1vZHVsZXNbdiArIDFdWzhdID0gbW9kOwoJCQl9IGVsc2UgewoJCQkJdGhpcy5tb2R1bGVzW3RoaXMubW9kdWxlQ291bnQgLSAxNSArIHZdWzhdID0gbW9kOwoJCQl9CgkJfQoJCgkJLy8gaG9yaXpvbnRhbAoJCWZvciAodmFyIGggPSAwOyBoIDwgMTU7IGgrKykgewoJCgkJCW1vZCA9ICghdGVzdCAmJiAoIChiaXRzID4+IGgpICYgMSkgPT09IDEpOwoJCQkKCQkJaWYgKGggPCA4KSB7CgkJCQl0aGlzLm1vZHVsZXNbOF1bdGhpcy5tb2R1bGVDb3VudCAtIGggLSAxXSA9IG1vZDsKCQkJfSBlbHNlIGlmIChoIDwgOSkgewoJCQkJdGhpcy5tb2R1bGVzWzhdWzE1IC0gaCAtIDEgKyAxXSA9IG1vZDsKCQkJfSBlbHNlIHsKCQkJCXRoaXMubW9kdWxlc1s4XVsxNSAtIGggLSAxXSA9IG1vZDsKCQkJfQoJCX0KCQoJCS8vIGZpeGVkIG1vZHVsZQoJCXRoaXMubW9kdWxlc1t0aGlzLm1vZHVsZUNvdW50IC0gOF1bOF0gPSAoIXRlc3QpOwoJCgl9LAoJCgltYXBEYXRhIDogZnVuY3Rpb24oZGF0YSwgbWFza1BhdHRlcm4pIHsKCQkKCQl2YXIgaW5jID0gLTE7CgkJdmFyIHJvdyA9IHRoaXMubW9kdWxlQ291bnQgLSAxOwoJCXZhciBiaXRJbmRleCA9IDc7CgkJdmFyIGJ5dGVJbmRleCA9IDA7CgkJCgkJZm9yICh2YXIgY29sID0gdGhpcy5tb2R1bGVDb3VudCAtIDE7IGNvbCA+IDA7IGNvbCAtPSAyKSB7CgkKCQkJaWYgKGNvbCA9PT0gNikgY29sLS07CgkKCQkJd2hpbGUgKHRydWUpIHsKCQoJCQkJZm9yICh2YXIgYyA9IDA7IGMgPCAyOyBjKyspIHsKCQkJCQkKCQkJCQlpZiAodGhpcy5tb2R1bGVzW3Jvd11bY29sIC0gY10gPT09IG51bGwpIHsKCQkJCQkJCgkJCQkJCXZhciBkYXJrID0gZmFsc2U7CgkKCQkJCQkJaWYgKGJ5dGVJbmRleCA8IGRhdGEubGVuZ3RoKSB7CgkJCQkJCQlkYXJrID0gKCAoIChkYXRhW2J5dGVJbmRleF0gPj4+IGJpdEluZGV4KSAmIDEpID09PSAxKTsKCQkJCQkJfQoJCgkJCQkJCXZhciBtYXNrID0gUVJVdGlsLmdldE1hc2sobWFza1BhdHRlcm4sIHJvdywgY29sIC0gYyk7CgkKCQkJCQkJaWYgKG1hc2spIHsKCQkJCQkJCWRhcmsgPSAhZGFyazsKCQkJCQkJfQoJCQkJCQkKCQkJCQkJdGhpcy5tb2R1bGVzW3Jvd11bY29sIC0gY10gPSBkYXJrOwoJCQkJCQliaXRJbmRleC0tOwoJCgkJCQkJCWlmIChiaXRJbmRleCA9PT0gLTEpIHsKCQkJCQkJCWJ5dGVJbmRleCsrOwoJCQkJCQkJYml0SW5kZXggPSA3OwoJCQkJCQl9CgkJCQkJfQoJCQkJfQoJCQkJCQkJCQoJCQkJcm93ICs9IGluYzsKCQoJCQkJaWYgKHJvdyA8IDAgfHwgdGhpcy5tb2R1bGVDb3VudCA8PSByb3cpIHsKCQkJCQlyb3cgLT0gaW5jOwoJCQkJCWluYyA9IC1pbmM7CgkJCQkJYnJlYWs7CgkJCQl9CgkJCX0KCQl9CgkJCgl9Cgp9OwoKUVJDb2RlLlBBRDAgPSAweEVDOwpRUkNvZGUuUEFEMSA9IDB4MTE7CgpRUkNvZGUuY3JlYXRlRGF0YSA9IGZ1bmN0aW9uKHR5cGVOdW1iZXIsIGVycm9yQ29ycmVjdExldmVsLCBkYXRhTGlzdCkgewoJCgl2YXIgcnNCbG9ja3MgPSBRUlJTQmxvY2suZ2V0UlNCbG9ja3ModHlwZU51bWJlciwgZXJyb3JDb3JyZWN0TGV2ZWwpOwoJCgl2YXIgYnVmZmVyID0gbmV3IFFSQml0QnVmZmVyKCk7CgkKCWZvciAodmFyIGkgPSAwOyBpIDwgZGF0YUxpc3QubGVuZ3RoOyBpKyspIHsKCQl2YXIgZGF0YSA9IGRhdGFMaXN0W2ldOwoJCWJ1ZmZlci5wdXQoZGF0YS5tb2RlLCA0KTsKCQlidWZmZXIucHV0KGRhdGEuZ2V0TGVuZ3RoKCksIFFSVXRpbC5nZXRMZW5ndGhJbkJpdHMoZGF0YS5tb2RlLCB0eXBlTnVtYmVyKSApOwoJCWRhdGEud3JpdGUoYnVmZmVyKTsKCX0KCgkvLyBjYWxjIG51bSBtYXggZGF0YS4KCXZhciB0b3RhbERhdGFDb3VudCA9IDA7Cglmb3IgKHZhciB4ID0gMDsgeCA8IHJzQmxvY2tzLmxlbmd0aDsgeCsrKSB7CgkJdG90YWxEYXRhQ291bnQgKz0gcnNCbG9ja3NbeF0uZGF0YUNvdW50OwoJfQoKCWlmIChidWZmZXIuZ2V0TGVuZ3RoSW5CaXRzKCkgPiB0b3RhbERhdGFDb3VudCAqIDgpIHsKCQl0aHJvdyBuZXcgRXJyb3IoImNvZGUgbGVuZ3RoIG92ZXJmbG93LiAoIiArIAogICAgICAgICAgICBidWZmZXIuZ2V0TGVuZ3RoSW5CaXRzKCkgKyAKICAgICAgICAgICAgIj4iICsgIAogICAgICAgICAgICB0b3RhbERhdGFDb3VudCAqIDggKyAKICAgICAgICAgICAgIikiKTsKCX0KCgkvLyBlbmQgY29kZQoJaWYgKGJ1ZmZlci5nZXRMZW5ndGhJbkJpdHMoKSArIDQgPD0gdG90YWxEYXRhQ291bnQgKiA4KSB7CgkJYnVmZmVyLnB1dCgwLCA0KTsKCX0KCgkvLyBwYWRkaW5nCgl3aGlsZSAoYnVmZmVyLmdldExlbmd0aEluQml0cygpICUgOCAhPT0gMCkgewoJCWJ1ZmZlci5wdXRCaXQoZmFsc2UpOwoJfQoKCS8vIHBhZGRpbmcKCXdoaWxlICh0cnVlKSB7CgkJCgkJaWYgKGJ1ZmZlci5nZXRMZW5ndGhJbkJpdHMoKSA+PSB0b3RhbERhdGFDb3VudCAqIDgpIHsKCQkJYnJlYWs7CgkJfQoJCWJ1ZmZlci5wdXQoUVJDb2RlLlBBRDAsIDgpOwoJCQoJCWlmIChidWZmZXIuZ2V0TGVuZ3RoSW5CaXRzKCkgPj0gdG90YWxEYXRhQ291bnQgKiA4KSB7CgkJCWJyZWFrOwoJCX0KCQlidWZmZXIucHV0KFFSQ29kZS5QQUQxLCA4KTsKCX0KCglyZXR1cm4gUVJDb2RlLmNyZWF0ZUJ5dGVzKGJ1ZmZlciwgcnNCbG9ja3MpOwp9OwoKUVJDb2RlLmNyZWF0ZUJ5dGVzID0gZnVuY3Rpb24oYnVmZmVyLCByc0Jsb2NrcykgewoKCXZhciBvZmZzZXQgPSAwOwoJCgl2YXIgbWF4RGNDb3VudCA9IDA7Cgl2YXIgbWF4RWNDb3VudCA9IDA7CgkKCXZhciBkY2RhdGEgPSBuZXcgQXJyYXkocnNCbG9ja3MubGVuZ3RoKTsKCXZhciBlY2RhdGEgPSBuZXcgQXJyYXkocnNCbG9ja3MubGVuZ3RoKTsKCQoJZm9yICh2YXIgciA9IDA7IHIgPCByc0Jsb2Nrcy5sZW5ndGg7IHIrKykgewoKCQl2YXIgZGNDb3VudCA9IHJzQmxvY2tzW3JdLmRhdGFDb3VudDsKCQl2YXIgZWNDb3VudCA9IHJzQmxvY2tzW3JdLnRvdGFsQ291bnQgLSBkY0NvdW50OwoKCQltYXhEY0NvdW50ID0gTWF0aC5tYXgobWF4RGNDb3VudCwgZGNDb3VudCk7CgkJbWF4RWNDb3VudCA9IE1hdGgubWF4KG1heEVjQ291bnQsIGVjQ291bnQpOwoJCQoJCWRjZGF0YVtyXSA9IG5ldyBBcnJheShkY0NvdW50KTsKCQkKCQlmb3IgKHZhciBpID0gMDsgaSA8IGRjZGF0YVtyXS5sZW5ndGg7IGkrKykgewoJCQlkY2RhdGFbcl1baV0gPSAweGZmICYgYnVmZmVyLmJ1ZmZlcltpICsgb2Zmc2V0XTsKCQl9CgkJb2Zmc2V0ICs9IGRjQ291bnQ7CgkJCgkJdmFyIHJzUG9seSA9IFFSVXRpbC5nZXRFcnJvckNvcnJlY3RQb2x5bm9taWFsKGVjQ291bnQpOwoJCXZhciByYXdQb2x5ID0gbmV3IFFSUG9seW5vbWlhbChkY2RhdGFbcl0sIHJzUG9seS5nZXRMZW5ndGgoKSAtIDEpOwoKCQl2YXIgbW9kUG9seSA9IHJhd1BvbHkubW9kKHJzUG9seSk7CgkJZWNkYXRhW3JdID0gbmV3IEFycmF5KHJzUG9seS5nZXRMZW5ndGgoKSAtIDEpOwoJCWZvciAodmFyIHggPSAwOyB4IDwgZWNkYXRhW3JdLmxlbmd0aDsgeCsrKSB7CiAgICAgICAgICAgIHZhciBtb2RJbmRleCA9IHggKyBtb2RQb2x5LmdldExlbmd0aCgpIC0gZWNkYXRhW3JdLmxlbmd0aDsKCQkJZWNkYXRhW3JdW3hdID0gKG1vZEluZGV4ID49IDApPyBtb2RQb2x5LmdldChtb2RJbmRleCkgOiAwOwoJCX0KCgl9CgkKCXZhciB0b3RhbENvZGVDb3VudCA9IDA7Cglmb3IgKHZhciB5ID0gMDsgeSA8IHJzQmxvY2tzLmxlbmd0aDsgeSsrKSB7CgkJdG90YWxDb2RlQ291bnQgKz0gcnNCbG9ja3NbeV0udG90YWxDb3VudDsKCX0KCgl2YXIgZGF0YSA9IG5ldyBBcnJheSh0b3RhbENvZGVDb3VudCk7Cgl2YXIgaW5kZXggPSAwOwoKCWZvciAodmFyIHogPSAwOyB6IDwgbWF4RGNDb3VudDsgeisrKSB7CgkJZm9yICh2YXIgcyA9IDA7IHMgPCByc0Jsb2Nrcy5sZW5ndGg7IHMrKykgewoJCQlpZiAoeiA8IGRjZGF0YVtzXS5sZW5ndGgpIHsKCQkJCWRhdGFbaW5kZXgrK10gPSBkY2RhdGFbc11bel07CgkJCX0KCQl9Cgl9CgoJZm9yICh2YXIgeHggPSAwOyB4eCA8IG1heEVjQ291bnQ7IHh4KyspIHsKCQlmb3IgKHZhciB0ID0gMDsgdCA8IHJzQmxvY2tzLmxlbmd0aDsgdCsrKSB7CgkJCWlmICh4eCA8IGVjZGF0YVt0XS5sZW5ndGgpIHsKCQkJCWRhdGFbaW5kZXgrK10gPSBlY2RhdGFbdF1beHhdOwoJCQl9CgkJfQoJfQoKCXJldHVybiBkYXRhOwoKfTsKCm1vZHVsZS5leHBvcnRzID0gUVJDb2RlOwoKfQogIH07CiAgY29uc3QgX19jYWNoZSA9IHt9OwogIGZ1bmN0aW9uIF9fcmVxdWlyZShpZCl7CiAgICBpZihfX2NhY2hlW2lkXSkgcmV0dXJuIF9fY2FjaGVbaWRdLmV4cG9ydHM7CiAgICBpZighX19tb2R1bGVzW2lkXSkgdGhyb3cgbmV3IEVycm9yKCdNw7NkdWxvIFFSIG5vIGVuY29udHJhZG86ICcraWQpOwogICAgY29uc3QgbW9kdWxlID0ge2V4cG9ydHM6e319OwogICAgX19jYWNoZVtpZF0gPSBtb2R1bGU7CiAgICBfX21vZHVsZXNbaWRdKG1vZHVsZSwgbW9kdWxlLmV4cG9ydHMsIF9fcmVxdWlyZSk7CiAgICByZXR1cm4gbW9kdWxlLmV4cG9ydHM7CiAgfQoKICBjb25zdCBRUkNvZGVNb2RlbCA9IF9fcmVxdWlyZSgnLi9pbmRleCcpOwogIGNvbnN0IFFSRXJyb3JDb3JyZWN0TGV2ZWwgPSBfX3JlcXVpcmUoJy4vUVJFcnJvckNvcnJlY3RMZXZlbCcpOwoKICBmdW5jdGlvbiBub3JtYWxpemVMZXZlbChsZXZlbCl7CiAgICBjb25zdCB4PVN0cmluZyhsZXZlbHx8J00nKS50b1VwcGVyQ2FzZSgpOwogICAgcmV0dXJuIFFSRXJyb3JDb3JyZWN0TGV2ZWxbeF0gPz8gUVJFcnJvckNvcnJlY3RMZXZlbC5NOwogIH0KCiAgZnVuY3Rpb24gbWFrZU1vZGVsKHRleHQsIG9wdGlvbnM9e30pewogICAgY29uc3QgcXIgPSBuZXcgUVJDb2RlTW9kZWwoMCwgbm9ybWFsaXplTGV2ZWwob3B0aW9ucy5lcnJvckNvcnJlY3Rpb25MZXZlbCkpOwogICAgcXIuYWRkRGF0YShTdHJpbmcodGV4dCA/PyAnJykpOwogICAgcXIubWFrZSgpOwogICAgcmV0dXJuIHFyOwogIH0KCiAgZnVuY3Rpb24gbWF0cml4RnJvbU1vZGVsKHFyKXsKICAgIGNvbnN0IG4gPSBxci5nZXRNb2R1bGVDb3VudCgpOwogICAgY29uc3QgbSA9IFtdOwogICAgZm9yKGxldCByPTA7cjxuO3IrKyl7CiAgICAgIGNvbnN0IHJvdz1bXTsKICAgICAgZm9yKGxldCBjPTA7YzxuO2MrKykgcm93LnB1c2goISFxci5pc0RhcmsocixjKSk7CiAgICAgIG0ucHVzaChyb3cpOwogICAgfQogICAgcmV0dXJuIG07CiAgfQoKICBmdW5jdGlvbiBkcmF3VG9DYW52YXMocXIsIG9wdGlvbnM9e30pewogICAgY29uc3QgbWFyZ2luID0gTnVtYmVyLmlzRmluaXRlKG9wdGlvbnMubWFyZ2luKSA/IG9wdGlvbnMubWFyZ2luIDogNDsKICAgIGNvbnN0IGNvdW50ID0gcXIuZ2V0TW9kdWxlQ291bnQoKTsKICAgIGNvbnN0IHRhcmdldFdpZHRoID0gTWF0aC5tYXgoMjAwLCBOdW1iZXIob3B0aW9ucy53aWR0aCl8fDMyMCk7CiAgICBjb25zdCBjZWxsID0gTWF0aC5tYXgoNCwgTWF0aC5mbG9vcih0YXJnZXRXaWR0aCAvIChjb3VudCArIG1hcmdpbioyKSkpOwogICAgY29uc3Qgc2l6ZSA9IChjb3VudCArIG1hcmdpbioyKSAqIGNlbGw7CiAgICBjb25zdCBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTsKICAgIGNhbnZhcy53aWR0aCA9IHNpemU7CiAgICBjYW52YXMuaGVpZ2h0ID0gc2l6ZTsKICAgIGNvbnN0IGN0eCA9IGNhbnZhcy5nZXRDb250ZXh0KCcyZCcsIHthbHBoYTpmYWxzZX0pOwogICAgY3R4LmltYWdlU21vb3RoaW5nRW5hYmxlZCA9IGZhbHNlOwogICAgY3R4LmZpbGxTdHlsZSA9ICcjRkZGRkZGJzsKICAgIGN0eC5maWxsUmVjdCgwLDAsc2l6ZSxzaXplKTsKICAgIGN0eC5maWxsU3R5bGUgPSAnIzAwMDAwMCc7CiAgICBmb3IobGV0IHI9MDtyPGNvdW50O3IrKyl7CiAgICAgIGZvcihsZXQgYz0wO2M8Y291bnQ7YysrKXsKICAgICAgICBpZihxci5pc0RhcmsocixjKSkgY3R4LmZpbGxSZWN0KChjK21hcmdpbikqY2VsbCwgKHIrbWFyZ2luKSpjZWxsLCBjZWxsLCBjZWxsKTsKICAgICAgfQogICAgfQogICAgcmV0dXJuIGNhbnZhczsKICB9CgogIGZ1bmN0aW9uIHN2Z0VzYyhzKXsKICAgIHJldHVybiBTdHJpbmcocykucmVwbGFjZSgvJi9nLCcmYW1wOycpLnJlcGxhY2UoLzwvZywnJmx0OycpLnJlcGxhY2UoLz4vZywnJmd0OycpLnJlcGxhY2UoLyIvZywnJnF1b3Q7Jyk7CiAgfQoKICBmdW5jdGlvbiBidWlsZFN2Zyh0ZXh0LCBsYWJlbCwgb3B0aW9ucz17fSl7CiAgICBjb25zdCBxciA9IG1ha2VNb2RlbCh0ZXh0LCBvcHRpb25zKTsKICAgIGNvbnN0IG1hcmdpbiA9IE51bWJlci5pc0Zpbml0ZShvcHRpb25zLm1hcmdpbikgPyBvcHRpb25zLm1hcmdpbiA6IDQ7CiAgICBjb25zdCBjb3VudCA9IHFyLmdldE1vZHVsZUNvdW50KCk7CiAgICBjb25zdCBjZWxsID0gTWF0aC5tYXgoNiwgTnVtYmVyKG9wdGlvbnMuY2VsbFNpemUpfHwxMCk7CiAgICBjb25zdCBzaXplID0gKGNvdW50ICsgbWFyZ2luKjIpICogY2VsbDsKICAgIGNvbnN0IHRpdGxlID0gbGFiZWwgfHwgJ1FSJzsKICAgIGNvbnN0IHJlY3RzID0gW107CiAgICBmb3IobGV0IHI9MDtyPGNvdW50O3IrKyl7CiAgICAgIGZvcihsZXQgYz0wO2M8Y291bnQ7YysrKXsKICAgICAgICBpZihxci5pc0RhcmsocixjKSkgcmVjdHMucHVzaChgPHJlY3QgeD0iJHsoYyttYXJnaW4pKmNlbGx9IiB5PSIkeyhyK21hcmdpbikqY2VsbH0iIHdpZHRoPSIke2NlbGx9IiBoZWlnaHQ9IiR7Y2VsbH0iLz5gKTsKICAgICAgfQogICAgfQogICAgcmV0dXJuIGA8P3htbCB2ZXJzaW9uPSIxLjAiIGVuY29kaW5nPSJVVEYtOCI/Pgo8c3ZnIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgd2lkdGg9IiR7c2l6ZX0iIGhlaWdodD0iJHtzaXplKzc0fSIgdmlld0JveD0iMCAwICR7c2l6ZX0gJHtzaXplKzc0fSIgc2hhcGUtcmVuZGVyaW5nPSJjcmlzcEVkZ2VzIj4KPHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2ZmZiIvPgo8ZyBmaWxsPSIjMDAwIj4ke3JlY3RzLmpvaW4oJycpfTwvZz4KPHRleHQgeD0iJHtzaXplLzJ9IiB5PSIke3NpemUrMjh9IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0ibW9ub3NwYWNlIiBmb250LXNpemU9IjIwIiBmb250LXdlaWdodD0iNzAwIj4ke3N2Z0VzYyh0aXRsZSl9PC90ZXh0Pgo8dGV4dCB4PSIke3NpemUvMn0iIHk9IiR7c2l6ZSs1NH0iIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJtb25vc3BhY2UiIGZvbnQtc2l6ZT0iOSI+JHtzdmdFc2MoU3RyaW5nKHRleHQpKX08L3RleHQ+Cjwvc3ZnPmA7CiAgfQoKICBnbG9iYWwuUVJDb2RlID0gewogICAgdG9EYXRhVVJMOiBmdW5jdGlvbih0ZXh0LCBvcHRpb25zPXt9KXsKICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLHJlamVjdCk9PnsKICAgICAgICB0cnl7CiAgICAgICAgICBjb25zdCBjYW52YXMgPSBkcmF3VG9DYW52YXMobWFrZU1vZGVsKHRleHQsIG9wdGlvbnMpLCBvcHRpb25zKTsKICAgICAgICAgIHJlc29sdmUoY2FudmFzLnRvRGF0YVVSTCgnaW1hZ2UvcG5nJykpOwogICAgICAgIH1jYXRjaChlcnIpeyByZWplY3QoZXJyKTsgfQogICAgICB9KTsKICAgIH0sCiAgICB0b0NhbnZhczogZnVuY3Rpb24oY2FudmFzT3JUZXh0LCB0ZXh0T3JPcHRpb25zLCBtYXliZU9wdGlvbnMpewogICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUscmVqZWN0KT0+ewogICAgICAgIHRyeXsKICAgICAgICAgIGxldCBjYW52YXMsIHRleHQsIG9wdGlvbnM7CiAgICAgICAgICBpZih0eXBlb2YgY2FudmFzT3JUZXh0ID09PSAnc3RyaW5nJyl7CiAgICAgICAgICAgIHRleHQgPSBjYW52YXNPclRleHQ7IG9wdGlvbnMgPSB0ZXh0T3JPcHRpb25zIHx8IHt9OyBjYW52YXMgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdjYW52YXMnKTsKICAgICAgICAgIH0gZWxzZSB7CiAgICAgICAgICAgIGNhbnZhcyA9IGNhbnZhc09yVGV4dDsgdGV4dCA9IHRleHRPck9wdGlvbnM7IG9wdGlvbnMgPSBtYXliZU9wdGlvbnMgfHwge307CiAgICAgICAgICB9CiAgICAgICAgICBjb25zdCBxciA9IG1ha2VNb2RlbCh0ZXh0LCBvcHRpb25zKTsKICAgICAgICAgIGNvbnN0IHRlbXAgPSBkcmF3VG9DYW52YXMocXIsIG9wdGlvbnMpOwogICAgICAgICAgY2FudmFzLndpZHRoID0gdGVtcC53aWR0aDsgY2FudmFzLmhlaWdodCA9IHRlbXAuaGVpZ2h0OwogICAgICAgICAgY29uc3QgY3R4ID0gY2FudmFzLmdldENvbnRleHQoJzJkJywge2FscGhhOmZhbHNlfSk7CiAgICAgICAgICBjdHguZHJhd0ltYWdlKHRlbXAsMCwwKTsKICAgICAgICAgIHJlc29sdmUoY2FudmFzKTsKICAgICAgICB9Y2F0Y2goZXJyKXsgcmVqZWN0KGVycik7IH0KICAgICAgfSk7CiAgICB9LAogICAgdG9TdHJpbmc6IGZ1bmN0aW9uKHRleHQsIG9wdGlvbnM9e30pewogICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUscmVqZWN0KT0+ewogICAgICAgIHRyeXsgcmVzb2x2ZShidWlsZFN2Zyh0ZXh0LCBvcHRpb25zLmxhYmVsIHx8ICdRUicsIG9wdGlvbnMpKTsgfWNhdGNoKGVycil7IHJlamVjdChlcnIpOyB9CiAgICAgIH0pOwogICAgfSwKICAgIF9fb2ZmbGluZTogdHJ1ZQogIH07CgogIGdsb2JhbC5tYWtlT2ZmbGluZVFyU3ZnID0gZnVuY3Rpb24ocGF5bG9hZCwgdGl0bGU9J1FSJyl7CiAgICByZXR1cm4gYnVpbGRTdmcoU3RyaW5nKHBheWxvYWR8fCcnKSwgdGl0bGUsIHtlcnJvckNvcnJlY3Rpb25MZXZlbDonTScsIG1hcmdpbjo0LCBjZWxsU2l6ZToxMH0pOwogIH07CiAgZ2xvYmFsLl9fTUlMSVRPUE9fUVJfUkVBRFkgPSB0cnVlOwp9KSh3aW5kb3cpOwo8L3NjcmlwdD48L2hlYWQ+PGJvZHk+PGRpdiBjbGFzcz0iYXBwIHNpbXBsZS1wYXJ0aWNpcGFudC1hcHAiPgo8ZGl2IGlkPSJncHNGaW5pc2hOb3RpY2UiIGNsYXNzPSJncHMtZmluaXNoLW5vdGljZSIgcm9sZT0iZGlhbG9nIiBhcmlhLWxhYmVsbGVkYnk9Imdwc0ZpbmlzaFRpdGxlIiBhcmlhLWxpdmU9ImFzc2VydGl2ZSI+CiAgPGRpdiBjbGFzcz0iZ3BzLWZpbmlzaC1jYXJkIj4KICAgIDxkaXYgY2xhc3M9Imdwcy1maW5pc2gtaWNvbiI+8J+PgTwvZGl2PgogICAgPGRpdiBpZD0iZ3BzRmluaXNoVGl0bGUiIGNsYXNzPSJncHMtZmluaXNoLXRpdGxlIj5DQVJSRVJBIEZJTkFMSVpBREE8L2Rpdj4KICAgIDxkaXYgaWQ9Imdwc0ZpbmlzaFRleHQiIGNsYXNzPSJncHMtZmluaXNoLXRleHQiPkxsZWdhZGEgcmVnaXN0cmFkYS4gUHJlcGFyYW5kbyBlbCByZXN1bHRhZG8uLi48L2Rpdj4KICAgIDxidXR0b24gY2xhc3M9ImJ0biBncmVlbiIgdHlwZT0iYnV0dG9uIiBvbmNsaWNrPSJjbG9zZUdwc0ZpbmlzaE5vdGljZSgpIj5FTlRFTkRJRE88L2J1dHRvbj4KICA8L2Rpdj4KPC9kaXY+CjxkaXYgaWQ9Imdwc0Fycml2YWxDb25maXJtIiBjbGFzcz0iZ3BzLWNob2ljZS1vdmVybGF5IiByb2xlPSJkaWFsb2ciIGFyaWEtbW9kYWw9InRydWUiIGFyaWEtbGFiZWxsZWRieT0iZ3BzQXJyaXZhbENvbmZpcm1UaXRsZSI+CiAgPGRpdiBjbGFzcz0iZ3BzLWNob2ljZS1jYXJkIj4KICAgIDxkaXYgY2xhc3M9Imdwcy1jaG9pY2UtaWNvbiI+8J+PgTwvZGl2PgogICAgPGRpdiBpZD0iZ3BzQXJyaXZhbENvbmZpcm1UaXRsZSIgY2xhc3M9Imdwcy1jaG9pY2UtdGl0bGUiPsK/VEVSTUlOQVIgTEEgQ0FSUkVSQT88L2Rpdj4KICAgIDxkaXYgaWQ9Imdwc0Fycml2YWxDb25maXJtVGV4dCIgY2xhc3M9Imdwcy1jaG9pY2UtdGV4dCI+SGFzIGxsZWdhZG8gYSBsYSBtZXRhLiBDb25maXJtYSBzaSBxdWllcmVzIGZpbmFsaXphciBlIGltcG9ydGFyIGVsIHJlc3VsdGFkby48L2Rpdj4KICAgIDxkaXYgY2xhc3M9Imdwcy1jaG9pY2UtYWN0aW9ucyI+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBncmVlbiIgdHlwZT0iYnV0dG9uIiBvbmNsaWNrPSJjb25maXJtR3BzQXJyaXZhbEZpbmlzaCgpIj7wn4+BIFRFUk1JTkFSIEUgSU1QT1JUQVIgUkVTVUxUQURPUzwvYnV0dG9uPgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc2Vjb25kYXJ5IiB0eXBlPSJidXR0b24iIG9uY2xpY2s9ImNvbnRpbnVlR3BzUmFjZSgpIj5DT05USU5VQVIgQ0FSUkVSQTwvYnV0dG9uPgogICAgPC9kaXY+CiAgPC9kaXY+CjwvZGl2Pgo8ZGl2IGlkPSJncHNTdGFydFJlbWluZGVyIiBjbGFzcz0iZ3BzLWNob2ljZS1vdmVybGF5IiByb2xlPSJkaWFsb2ciIGFyaWEtbW9kYWw9InRydWUiIGFyaWEtbGFiZWxsZWRieT0iZ3BzU3RhcnRSZW1pbmRlclRpdGxlIj4KICA8ZGl2IGNsYXNzPSJncHMtY2hvaWNlLWNhcmQiPgogICAgPGRpdiBjbGFzcz0iZ3BzLWNob2ljZS1pY29uIj7wn5ONPC9kaXY+CiAgICA8ZGl2IGlkPSJncHNTdGFydFJlbWluZGVyVGl0bGUiIGNsYXNzPSJncHMtY2hvaWNlLXRpdGxlIj5HUFMgREVTQUNUSVZBRE88L2Rpdj4KICAgIDxkaXYgY2xhc3M9Imdwcy1jaG9pY2UtdGV4dCI+TGEgU0FMSURBIHlhIGVzdMOhIHJlZ2lzdHJhZGEuIEFjdGl2YSBlbCBHUFMgcGFyYSB2YWxpZGFyIGJhbGl6YXMgeSBMTEVHQURBIHBvciBwcm94aW1pZGFkIGR1cmFudGUgbGEgY2FycmVyYSBlbiB2aXZvLjwvZGl2PgogICAgPGRpdiBjbGFzcz0iZ3BzLWNob2ljZS1hY3Rpb25zIj4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIGdyZWVuIiB0eXBlPSJidXR0b24iIG9uY2xpY2s9ImFjdGl2YXRlR3BzRnJvbVN0YXJ0UmVtaW5kZXIoKSI+8J+ToSBBQ1RJVkFSIEdQUyBBSE9SQTwvYnV0dG9uPgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4gc2Vjb25kYXJ5IiB0eXBlPSJidXR0b24iIG9uY2xpY2s9ImNsb3NlR3BzU3RhcnRSZW1pbmRlcigpIj5DT05USU5VQVIgU0lOIEdQUzwvYnV0dG9uPgogICAgPC9kaXY+CiAgPC9kaXY+CjwvZGl2Pgo8c2VjdGlvbiBpZD0icGFydGljaXBhbnRSb3V0ZUNhcmQiIGNsYXNzPSJjYXJkIHNpbXBsZS1jYXJkIj4KICA8ZGl2IGNsYXNzPSJzaW1wbGUtc3RlcCI+MTwvZGl2PgogIDxoMj5TdSByZWNvcnJpZG88L2gyPgogIDxkaXYgaWQ9ImlkZW50aXR5IiBjbGFzcz0ic3RhdHVzIj5Fc2NhbmVhIHR1IFFSIGRlIHBhcnRpY2lwYW50ZSBwYXJhIGNhcmdhciBlbCByZWNvcnJpZG8uPC9kaXY+CiAgPGRpdiBpZD0icm91dGUiIGNsYXNzPSJzdGF0dXMgc2ltcGxlLXJvdXRlLWJveCI+UmVjb3JyaWRvIHBlbmRpZW50ZSBkZSBjYXJnYXIuPC9kaXY+CiAgPGJ1dHRvbiBpZD0ibG9hZFBhcnRpY2lwYW50UXJCdG4iIGNsYXNzPSJidG4gZ3JlZW4iIG9uY2xpY2s9InN0YXJ0UXJDYW1lcmEoKSI+8J+TtyBFU0NBTkVBUiBRUiBQQVJUSUNJUEFOVEU8L2J1dHRvbj4KICA8aW5wdXQgaWQ9Im1hbnVhbElucHV0IiBwbGFjZWhvbGRlcj0iUGVnYSBhcXXDrSBlbCBjw7NkaWdvIFFSIHNpIGZhbGxhIGPDoW1hcmEiIHN0eWxlPSJkaXNwbGF5Om5vbmUiPgogIDxidXR0b24gaWQ9Im1hbnVhbEJ0biIgY2xhc3M9ImJ0biIgb25jbGljaz0ibG9hZE1hbnVhbCgpIiBzdHlsZT0iZGlzcGxheTpub25lIj5DQVJHQVIgTUFOVUFMPC9idXR0b24+Cjwvc2VjdGlvbj4KCjxzZWN0aW9uIGlkPSJyYWNlIiBjbGFzcz0iY2FyZCBzaW1wbGUtY2FyZCIgc3R5bGU9ImRpc3BsYXk6bm9uZSI+CiAgPGRpdiBjbGFzcz0ic2ltcGxlLXN0ZXAiPjI8L2Rpdj4KICA8aDI+RXNjYW5lYXIgY29udHJvbGVzPC9oMj4KICA8ZGl2IGlkPSJuZXh0IiBjbGFzcz0ibmV4dCI+LS08L2Rpdj4KICA8YnV0dG9uIGNsYXNzPSJidG4gZ3JlZW4iIG9uY2xpY2s9InN0YXJ0UXJDYW1lcmEoKSI+8J+TtyBFU0NBTkVBUiBDT05UUk9MPC9idXR0b24+CiAgPGRpdiBpZD0ic2NhbnMiIGNsYXNzPSJzaW1wbGUtc2NhbnMiPjwvZGl2Pgo8L3NlY3Rpb24+Cgo8c2VjdGlvbiBpZD0iZ3BzUHJveGltaXR5IiBjbGFzcz0iY2FyZCBzaW1wbGUtY2FyZCBncHMtY2FyZCI+CiAgPGRpdiBjbGFzcz0iZ3BzLXRpdGxlIj7wn5ONIFZBTElEQUNJw5NOIEFVVE9Nw4FUSUNBIFBPUiBQUk9YSU1JREFEPC9kaXY+CiAgPGRpdiBjbGFzcz0iZ3BzLW1ldHJpY3MiPgogICAgPGRpdiBjbGFzcz0iZ3BzLW1ldHJpYyI+PHNtYWxsPlNpZ3VpZW50ZSBwdW50bzwvc21hbGw+PGIgaWQ9Imdwc1RhcmdldCI+4oCUPC9iPjwvZGl2PgogICAgPGRpdiBjbGFzcz0iZ3BzLW1ldHJpYyI+PHNtYWxsPlByZWNpc2nDs24gR1BTPC9zbWFsbD48YiBpZD0iZ3BzQWNjdXJhY3kiPuKAlDwvYj48L2Rpdj4KICA8L2Rpdj4KICA8ZGl2IGlkPSJsaXZlU3luY1N0YXR1cyIgY2xhc3M9ImxpdmUtc3luYy1zdGF0dXMgaXMtaW5hY3RpdmUiIGFyaWEtbGl2ZT0icG9saXRlIj7imqogQ0FSUkVSQSBFTiBWSVZPIE5PIEFDVElWQTwvZGl2PgogIDxkaXYgaWQ9ImxpdmVMYXN0U3luYyIgY2xhc3M9ImxpdmUtbGFzdC1zeW5jIj7DmkxUSU1BIFNJTkNST05JWkFDScOTTiBFTiBWSVZPIMK3IFRPREFWw41BIE5PIFJFQUxJWkFEQTwvZGl2PgogIDxkaXYgY2xhc3M9Imdwcy1hY3Rpb25zIj4KICAgIDxidXR0b24gaWQ9Imdwc1N0YXJ0QnRuIiBjbGFzcz0iYnRuIGdyZWVuIiBvbmNsaWNrPSJzdGFydFByb3hpbWl0eUdwcygpIj7wn5OhIEFDVElWQVIgR1BTPC9idXR0b24+CiAgICA8YnV0dG9uIGlkPSJncHNTdG9wQnRuIiBjbGFzcz0iYnRuIHNlY29uZGFyeSIgb25jbGljaz0ic3RvcFByb3hpbWl0eUdwcyh0cnVlKSIgZGlzYWJsZWQ+REVURU5FUiBHUFM8L2J1dHRvbj4KICAgIDxidXR0b24gaWQ9Imdwc0xvY2tCdG4iIGNsYXNzPSJidG4iIG9uY2xpY2s9ImxvY2tSYWNlU2NyZWVuKCkiPvCflJIgQkxPUVVFQVIgUEFOVEFMTEE8L2J1dHRvbj4KICA8L2Rpdj4KPC9zZWN0aW9uPgoKPHNlY3Rpb24gaWQ9InJlc3VsdCIgY2xhc3M9ImNhcmQgc2ltcGxlLWNhcmQiIHN0eWxlPSJkaXNwbGF5Om5vbmUiPgogIDxkaXYgY2xhc3M9InNpbXBsZS1zdGVwIj4zPC9kaXY+CiAgPGgyPlJlc3VsdGFkbyBmaW5hbDwvaDI+CiAgPGRpdiBpZD0ic3VtbWFyeSIgY2xhc3M9InN0YXR1cyBvayI+PC9kaXY+CiAgPGRpdiBpZD0icmVzdWx0UXIiIGNsYXNzPSJxciI+PC9kaXY+CiAgPGRpdiBjbGFzcz0icmVzdWx0LWNvZGUtdGl0bGUiPkPDk0RJR08gTUFOVUFMIERFTCBSRVNVTFRBRE8gwrcgT1JJfFJFU1VMVDwvZGl2PgogIDx0ZXh0YXJlYSBpZD0icmVzdWx0VGV4dCIgcmVhZG9ubHkgb25jbGljaz0idGhpcy5zZWxlY3QoKSIgYXJpYS1sYWJlbD0iQ8OzZGlnbyBtYW51YWwgT1JJIFJFU1VMVCBwYXJhIGVudHJlZ2FyIGFsIG9yZ2FuaXphZG9yIj48L3RleHRhcmVhPgogIDxidXR0b24gY2xhc3M9ImJ0biBzZWNvbmRhcnkiIG9uY2xpY2s9ImNvcHlSZXN1bHQoKSI+8J+TiyBDT1BJQVIgQ8OTRElHTzwvYnV0dG9uPgo8L3NlY3Rpb24+CjwvZGl2Pgo8ZGl2IGlkPSJncHNMb2NrT3ZlcmxheSI+PGRpdiBjbGFzcz0iZ3BzLWxvY2stY2FyZCI+PGRpdiBjbGFzcz0iZ3BzLWxvY2staWNvbiI+8J+UkvCfk408L2Rpdj48ZGl2Pk1PRE8gQ0FSUkVSQSBCTE9RVUVBRE88L2Rpdj48ZGl2IGlkPSJncHNMb2NrVGFyZ2V0IiBjbGFzcz0iZ3BzLWxvY2stdGFyZ2V0Ij7igJQ8L2Rpdj48ZGl2IGlkPSJncHNMb2NrU3RhdHVzIj5BY3RpdmEgZWwgR1BTIHBhcmEgZGV0ZWN0YXIgbGEgc2lndWllbnRlIGJhbGl6YS48L2Rpdj48YnV0dG9uIGlkPSJncHNVbmxvY2tCdG4iIGNsYXNzPSJncHMtdW5sb2NrIiB0eXBlPSJidXR0b24iPk1BTlTDiU4gUFVMU0FETyAyIFNFR1VORE9TIFBBUkEgREVTQkxPUVVFQVI8L2J1dHRvbj48L2Rpdj48L2Rpdj4KPGRpdiBpZD0iY2FtZXJhT3ZlcmxheSIgY2xhc3M9ImNhbWVyYS1vdmVybGF5Ij4KICA8ZGl2IGNsYXNzPSJjYW1lcmEtc2hlbGwiPgogICAgPGRpdiBpZD0iY2FtZXJhVGl0bGUiIGNsYXNzPSJjYW1lcmEtdGl0bGUiPkxFQ1RPUiBRUjwvZGl2PgogICAgPHZpZGVvIGlkPSJ2aWRlbyIgY2xhc3M9ImNhbWVyYS12aWRlbyIgcGxheXNpbmxpbmUgd2Via2l0LXBsYXlzaW5saW5lIG11dGVkIGF1dG9wbGF5PjwvdmlkZW8+CiAgICA8Y2FudmFzIGlkPSJjYW52YXMiIHN0eWxlPSJkaXNwbGF5Om5vbmUiPjwvY2FudmFzPgogICAgPGRpdiBpZD0iY2FtU3RhdHVzIiBjbGFzcz0ic3RhdHVzIj5QcmVwYXJhbmRvIGPDoW1hcmEuLi48L2Rpdj4KICAgIDxkaXYgY2xhc3M9ImNhbWVyYS1oZWxwIj5TaSBubyB2ZXMgaW1hZ2VuLCBjaWVycmEgeSB2dWVsdmUgYSBwdWxzYXIgRVNDQU5FQVIgUVIuIEVuIGlQaG9uZSB1c2EgU2FmYXJpIGNvbiBIVFRQUy48L2Rpdj4KICAgIDxidXR0b24gY2xhc3M9ImJ0biByZWQiIG9uY2xpY2s9InN0b3BRckNhbWVyYSgpIj5ERVRFTkVSIEPDgU1BUkE8L2J1dHRvbj4KICA8L2Rpdj4KPC9kaXY+Cgo8ZGl2IGlkPSJ0b2FzdCIgc3R5bGU9ImRpc3BsYXk6bm9uZTtwb3NpdGlvbjpmaXhlZDtib3R0b206MThweDtsZWZ0OjUwJTt0cmFuc2Zvcm06dHJhbnNsYXRlWCgtNTAlKTtiYWNrZ3JvdW5kOiMxYzI0MTQ7Y29sb3I6I2Y1ZTZjODtib3JkZXItcmFkaXVzOjk5OXB4O3BhZGRpbmc6MTJweCAxNnB4O2ZvbnQtd2VpZ2h0OjkwMCI+PC9kaXY+CjxzY3JpcHQ+CmNvbnN0IEVWRU5UX0RBVEE9X19FVkVOVF9EQVRBX187bGV0IHJvdXRlPW51bGwscGlkPW51bGwsbG9nPW51bGwsc3RyZWFtPW51bGwscnVubmluZz1mYWxzZSxkZXRlY3Rvcj1udWxsLHVzZUpzUXI9ZmFsc2UsbGFzdD0iIixsYXN0VD0wOwpjb25zdCBBUFBfVkVSU0lPTj0ib2ZmbGluZS1wYWdlLWNhY2hlLXY2MyI7CmZ1bmN0aW9uIG5vdGlmeU1pbGl0b3BvTGl2ZShraW5kLGV4dHJhPXt9KXsKICAgIHRyeXsKICAgICAgICBpZighcm91dGV8fCFwaWQpcmV0dXJuOwogICAgICAgIGNvbnN0IGV4cGVjdGVkPShyb3V0ZS5wb2ludHN8fFtdKS5maWx0ZXIoeD0+eCE9PSJTVEFSVCImJnghPT0iRklOSVNIIik7CiAgICAgICAgY29uc3QgY29tcGxldGVkPWxvZyYmQXJyYXkuaXNBcnJheShsb2cuc2NhbnMpP2xvZy5zY2Fucy5maWx0ZXIocz0+cy5zdGF0dXM9PT0iY29ycmVjdCIpLmxlbmd0aDowOwogICAgICAgIGNvbnN0IHBhcnRpY2lwYW50TmFtZT1TdHJpbmcoKEVWRU5UX0RBVEEucGFydGljaXBhbnROYW1lcyYmRVZFTlRfREFUQS5wYXJ0aWNpcGFudE5hbWVzW3BpZF0pfHwiIikudHJpbSgpOwogICAgICAgIGxldCBmaW5pc2hQYXlsb2FkPSIiOwogICAgICAgIGlmKGtpbmQ9PT0iRklOSVNIIiYmbG9nKXsKICAgICAgICAgICAgdHJ5e2ZpbmlzaFBheWxvYWQ9dHlwZW9mIHJlc3VsdFBheWxvYWQ9PT0iZnVuY3Rpb24iP1N0cmluZyhyZXN1bHRQYXlsb2FkKCl8fCIiKTpTdHJpbmcobG9nLnJlc3VsdFBheWxvYWR8fCIiKX1jYXRjaChlKXtmaW5pc2hQYXlsb2FkPVN0cmluZyhsb2cucmVzdWx0UGF5bG9hZHx8IiIpfQogICAgICAgICAgICBpZihmaW5pc2hQYXlsb2FkKWxvZy5yZXN1bHRQYXlsb2FkPWZpbmlzaFBheWxvYWQ7CiAgICAgICAgfQogICAgICAgIGNvbnN0IHJlc3VsdENvZGU9ZmluaXNoUGF5bG9hZD8oIk9SSXxSRVNVTFR8IitFVkVOVF9EQVRBLmV2ZW50SWQrInwiK3BpZCsifCIrZmluaXNoUGF5bG9hZCk6IiI7CiAgICAgICAgd2luZG93LnBhcmVudC5wb3N0TWVzc2FnZSh7CiAgICAgICAgICAgIHNvdXJjZToiTUlMSVRPUE9fTElWRV9WMiIsCiAgICAgICAgICAgIGtpbmQsCiAgICAgICAgICAgIHBheWxvYWQ6ewogICAgICAgICAgICAgICAgZXZlbnRJZDpTdHJpbmcoRVZFTlRfREFUQS5ldmVudElkfHwiIiksCiAgICAgICAgICAgICAgICBldmVudE5hbWU6U3RyaW5nKEVWRU5UX0RBVEEuZXZlbnROYW1lfHwiRU5UUkVOQU1JRU5UTyBPUklFTlRBQ0nDk04iKSwKICAgICAgICAgICAgICAgIHBhcnRpY2lwYW50SWQ6U3RyaW5nKHBpZHx8IiIpLAogICAgICAgICAgICAgICAgcGFydGljaXBhbnROYW1lLAogICAgICAgICAgICAgICAgcm91dGVJZDpTdHJpbmcocm91dGUucm91dGVJZHx8IiIpLAogICAgICAgICAgICAgICAgdG90YWxDb250cm9sczpleHBlY3RlZC5sZW5ndGgsCiAgICAgICAgICAgICAgICBjb21wbGV0ZWRDb250cm9sczpjb21wbGV0ZWQsCiAgICAgICAgICAgICAgICBwZW5kaW5nQ29udHJvbHM6TWF0aC5tYXgoMCxleHBlY3RlZC5sZW5ndGgtY29tcGxldGVkKSwKICAgICAgICAgICAgICAgIHN0YXJ0VGltZTpsb2cmJmxvZy5zdGFydFRpbWU/bG9nLnN0YXJ0VGltZTpudWxsLAogICAgICAgICAgICAgICAgZmluaXNoVGltZTpsb2cmJmxvZy5maW5pc2hUaW1lP2xvZy5maW5pc2hUaW1lOm51bGwsCiAgICAgICAgICAgICAgICBjb21wbGV0ZWQ6ISEobG9nJiZsb2cuY29tcGxldGVkKSwKICAgICAgICAgICAgICAgIG1pc3NpbmdDb250cm9sczpsb2cmJkFycmF5LmlzQXJyYXkobG9nLm1pc3NpbmdDb250cm9scyk/bG9nLm1pc3NpbmdDb250cm9sczpbXSwKICAgICAgICAgICAgICAgIHJlc3VsdENvZGUsCiAgICAgICAgICAgICAgICBjbGllbnRUaW1lOm5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSwKICAgICAgICAgICAgICAgIC4uLmV4dHJhCiAgICAgICAgICAgIH0KICAgICAgICB9LCIqIik7CiAgICB9Y2F0Y2goZSl7fQp9Cgpjb25zdCBKU1FSX0NBQ0hFX0tFWT0ibWlsaXRvcG9fanNxcl9jYWNoZV92MSI7CmNvbnN0IFJVTl9XSU5ET1dfUFJFRklYPSJNSUxJVE9QT19SVU5fQkFDS1VQOiI7CmNvbnN0IFJVTl9NRU1PUlk9e3JhdzoiIn07CmxldCBvZmZsaW5lUGFnZVJlYWR5PWZhbHNlLG9mZmxpbmVQYWdlQ2hlY2tlZD1mYWxzZSxxclJlYWRlclJlYWR5PWZhbHNlOwpmdW5jdGlvbiBzYWZlTm93KCl7cmV0dXJuIG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKX0KZnVuY3Rpb24gYmFzZUtleSgpe3JldHVybiAibWlsaXRvcG9fcnVubmVyXyIrRVZFTlRfREFUQS5ldmVudElkfQpmdW5jdGlvbiBhbGxSZWNvdmVyeUtleXMocCl7cmV0dXJuIFtiYXNlS2V5KCkrIl8iK3AsYmFzZUtleSgpLGJhc2VLZXkoKSsiX2FjdGl2ZSIsYmFzZUtleSgpKyJfYmFja3VwXyIrcCxiYXNlS2V5KCkrIl9iYWNrdXBfbGFzdCIsYmFzZUtleSgpKyJfZW1lcmdlbmN5XyIrcCxiYXNlS2V5KCkrIl9lbWVyZ2VuY3lfbGFzdCIsYmFzZUtleSgpKyJfY2hlY2twb2ludF8iK3BdfQpmdW5jdGlvbiBub3JtYWxpemVMb2coeCl7CiAgICBpZigheHx8dHlwZW9mIHghPT0ib2JqZWN0IilyZXR1cm4gbnVsbDsKICAgIGlmKCF4LmV2ZW50SWQpeC5ldmVudElkPUVWRU5UX0RBVEEuZXZlbnRJZDsKICAgIGlmKHguZXZlbnRJZCE9PUVWRU5UX0RBVEEuZXZlbnRJZClyZXR1cm4gbnVsbDsKICAgIGlmKCFBcnJheS5pc0FycmF5KHguc2NhbnMpKXguc2NhbnM9W107CiAgICBpZighQXJyYXkuaXNBcnJheSh4Lm1pc3NpbmdDb250cm9scykpeC5taXNzaW5nQ29udHJvbHM9W107CiAgICByZXR1cm4geDsKfQpmdW5jdGlvbiBjaG9vc2VCZXN0TG9nKGNhbmRpZGF0ZXMpewogICAgY29uc3QgdmFsaWQ9Y2FuZGlkYXRlcy5tYXAoeD0+bm9ybWFsaXplTG9nKHgpKS5maWx0ZXIoQm9vbGVhbik7CiAgICBpZighdmFsaWQubGVuZ3RoKXJldHVybiBudWxsOwogICAgdmFsaWQuc29ydCgoYSxiKT0+ewogICAgICAgIGNvbnN0IGFzPShhLnNjYW5zfHxbXSkubGVuZ3RoKyhhLnN0YXJ0VGltZT8xOjApKyhhLmZpbmlzaFRpbWU/MzowKSsoYS5yZXN1bHRQYXlsb2FkPzI6MCk7CiAgICAgICAgY29uc3QgYnM9KGIuc2NhbnN8fFtdKS5sZW5ndGgrKGIuc3RhcnRUaW1lPzE6MCkrKGIuZmluaXNoVGltZT8zOjApKyhiLnJlc3VsdFBheWxvYWQ/MjowKTsKICAgICAgICBpZihhcyE9PWJzKXJldHVybiBicy1hczsKICAgICAgICByZXR1cm4gU3RyaW5nKGIubGFzdFNhdmVkQXR8fCIiKS5sb2NhbGVDb21wYXJlKFN0cmluZyhhLmxhc3RTYXZlZEF0fHwiIikpOwogICAgfSk7CiAgICByZXR1cm4gdmFsaWRbMF07Cn0KZnVuY3Rpb24gc2FmZUdldChzdG9yYWdlLGspe3RyeXtyZXR1cm4gc3RvcmFnZSYmc3RvcmFnZS5nZXRJdGVtP3N0b3JhZ2UuZ2V0SXRlbShrKTpudWxsfWNhdGNoKGUpe3JldHVybiBudWxsfX0KZnVuY3Rpb24gcmVhZEpzb25SYXcocmF3KXt0cnl7cmV0dXJuIHJhdz9KU09OLnBhcnNlKHJhdyk6bnVsbH1jYXRjaChlKXtyZXR1cm4gbnVsbH19CmZ1bmN0aW9uIHJlYWRKc29uS2V5KGspe3JldHVybiByZWFkSnNvblJhdyhzYWZlR2V0KGxvY2FsU3RvcmFnZSxrKXx8c2FmZUdldChzZXNzaW9uU3RvcmFnZSxrKSl9CmZ1bmN0aW9uIHJlYWRXaW5kb3dOYW1lQmFja3VwKCl7dHJ5e2NvbnN0IHJhdz1TdHJpbmcod2luZG93Lm5hbWV8fCIiKTtyZXR1cm4gcmF3LnN0YXJ0c1dpdGgoUlVOX1dJTkRPV19QUkVGSVgpP3JlYWRKc29uUmF3KHJhdy5zbGljZShSVU5fV0lORE9XX1BSRUZJWC5sZW5ndGgpKTpudWxsfWNhdGNoKGUpe3JldHVybiBudWxsfX0KZnVuY3Rpb24gcmVhZE1lbW9yeUJhY2t1cCgpe3JldHVybiByZWFkSnNvblJhdyhSVU5fTUVNT1JZLnJhdyl9CmZ1bmN0aW9uIHdyaXRlS2V5RXZlcnl3aGVyZShrLHJhdyl7CiAgICB0cnl7bG9jYWxTdG9yYWdlLnNldEl0ZW0oayxyYXcpfWNhdGNoKGUpe30KICAgIHRyeXtzZXNzaW9uU3RvcmFnZS5zZXRJdGVtKGsscmF3KX1jYXRjaChlKXt9CiAgICB0cnl7UlVOX01FTU9SWS5yYXc9cmF3fWNhdGNoKGUpe30KICAgIHRyeXt3aW5kb3cubmFtZT1SVU5fV0lORE9XX1BSRUZJWCtyYXd9Y2F0Y2goZSl7fQp9CmZ1bmN0aW9uIHN0b3JhZ2VIZWFsdGgoKXsKICAgIGxldCBsb2NhbE9rPWZhbHNlLHNlc3Npb25Paz1mYWxzZTsKICAgIHRyeXtjb25zdCBrPSJtaWxpdG9wb19zdG9yYWdlX3Rlc3QiO2xvY2FsU3RvcmFnZS5zZXRJdGVtKGssIjEiKTtsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbShrKTtsb2NhbE9rPXRydWV9Y2F0Y2goZSl7fQogICAgdHJ5e2NvbnN0IGs9Im1pbGl0b3BvX3Nlc3Npb25fdGVzdCI7c2Vzc2lvblN0b3JhZ2Uuc2V0SXRlbShrLCIxIik7c2Vzc2lvblN0b3JhZ2UucmVtb3ZlSXRlbShrKTtzZXNzaW9uT2s9dHJ1ZX1jYXRjaChlKXt9CiAgICByZXR1cm4ge29rOmxvY2FsT2t8fHNlc3Npb25Payxsb2NhbE9rLHNlc3Npb25Pa307Cn0KZnVuY3Rpb24gZXNjKHMpe3JldHVybiBTdHJpbmcocz09bnVsbD8iIjpzKS5yZXBsYWNlKC9bJjw+IiddL2csYz0+KHsiJiI6IiZhbXA7IiwiPCI6IiZsdDsiLCI+IjoiJmd0OyIsIlwiIjoiJnF1b3Q7IiwiJyI6IiYjMzk7In1bY118fGMpKX0KZnVuY3Rpb24gcm91dGVJc0xvYWRlZCgpe3JldHVybiAhIShyb3V0ZSYmcGlkJiZsb2cmJmxvZy5wYXJ0aWNpcGFudElkJiZsb2cucm91dGVJZCl9CmZ1bmN0aW9uIG9mZmxpbmVMaW5lKHN0YXRlLHRpdGxlLGRldGFpbCl7CiAgICBjb25zdCBjbHM9c3RhdGU9PT10cnVlPyJ5ZXMiOnN0YXRlPT09IndhaXQiPyJ3YWl0Ijoibm8iOwogICAgY29uc3QgaWNvPXN0YXRlPT09dHJ1ZT8i4pyFIjpzdGF0ZT09PSJ3YWl0Ij8i4o+zIjoi4puUIjsKICAgIHJldHVybiAiPGRpdiBjbGFzcz0nb2ZmbGluZS1jaGVjayAiK2NscysiJz48c3Bhbj4iK2ljbysiPC9zcGFuPjxzcGFuPjxiPiIrdGl0bGUrIjwvYj48c21hbGw+IitkZXRhaWwrIjwvc21hbGw+PC9zcGFuPjwvZGl2PiI7Cn0KZnVuY3Rpb24gdXBkYXRlT2ZmbGluZVNhZmV0eVBhbmVsKG1zZyl7CiAgICAvLyBCbG9xdWUgZGUgY29tcHJvYmFjacOzbiBzaW4gY29iZXJ0dXJhIGVsaW1pbmFkbyBwb3IgcGV0aWNpw7NuIGRlbCB1c3VhcmlvLgogICAgcmV0dXJuOwp9CmFzeW5jIGZ1bmN0aW9uIHJlcXVlc3RQZXJzaXN0ZW50U3RvcmFnZSgpe3RyeXtpZihuYXZpZ2F0b3Iuc3RvcmFnZSYmbmF2aWdhdG9yLnN0b3JhZ2UucGVyc2lzdClhd2FpdCBuYXZpZ2F0b3Iuc3RvcmFnZS5wZXJzaXN0KCl9Y2F0Y2goZSl7fX0KYXN5bmMgZnVuY3Rpb24gcHJlY2FjaGVRclJlYWRlcigpewogICAgaWYod2luZG93LmpzUVIpcmV0dXJuIHRydWU7CiAgICB0cnl7CiAgICAgICAgY29uc3QgY2FjaGVkPXNhZmVHZXQobG9jYWxTdG9yYWdlLEpTUVJfQ0FDSEVfS0VZKXx8c2FmZUdldChzZXNzaW9uU3RvcmFnZSxKU1FSX0NBQ0hFX0tFWSk7CiAgICAgICAgaWYoY2FjaGVkKXsobmV3IEZ1bmN0aW9uKGNhY2hlZCkpKCk7IGlmKHdpbmRvdy5qc1FSKXJldHVybiB0cnVlO30KICAgIH1jYXRjaChlKXt9CiAgICB0cnl7CiAgICAgICAgaWYoIW5hdmlnYXRvci5vbkxpbmUpcmV0dXJuIGZhbHNlOwogICAgICAgIGNvbnN0IHI9YXdhaXQgZmV0Y2goImh0dHBzOi8vY2RuLmpzZGVsaXZyLm5ldC9ucG0vanNxckAxLjQuMC9kaXN0L2pzUVIubWluLmpzIix7Y2FjaGU6ImZvcmNlLWNhY2hlIn0pOwogICAgICAgIGlmKHIub2spewogICAgICAgICAgICBjb25zdCBjb2RlPWF3YWl0IHIudGV4dCgpOwogICAgICAgICAgICB0cnl7bG9jYWxTdG9yYWdlLnNldEl0ZW0oSlNRUl9DQUNIRV9LRVksY29kZSl9Y2F0Y2goZSl7fQogICAgICAgICAgICB0cnl7c2Vzc2lvblN0b3JhZ2Uuc2V0SXRlbShKU1FSX0NBQ0hFX0tFWSxjb2RlKX1jYXRjaChlKXt9CiAgICAgICAgICAgIChuZXcgRnVuY3Rpb24oY29kZSkpKCk7CiAgICAgICAgICAgIHJldHVybiAhIXdpbmRvdy5qc1FSOwogICAgICAgIH0KICAgIH1jYXRjaChlKXt9CiAgICByZXR1cm4gZmFsc2U7Cn0KCmFzeW5jIGZ1bmN0aW9uIGVuc3VyZU9mZmxpbmVQYWdlQXZhaWxhYmxlKCl7CiAgICBvZmZsaW5lUGFnZUNoZWNrZWQ9ZmFsc2U7b2ZmbGluZVBhZ2VSZWFkeT1mYWxzZTt1cGRhdGVPZmZsaW5lU2FmZXR5UGFuZWwoKTsKICAgIGlmKCEoL15odHRwcz86JC8udGVzdChsb2NhdGlvbi5wcm90b2NvbCkpKXtvZmZsaW5lUGFnZUNoZWNrZWQ9dHJ1ZTtvZmZsaW5lUGFnZVJlYWR5PXRydWU7dXBkYXRlT2ZmbGluZVNhZmV0eVBhbmVsKCk7cmV0dXJuIHRydWU7fQogICAgaWYoISgic2VydmljZVdvcmtlciIgaW4gbmF2aWdhdG9yKXx8ISgiY2FjaGVzIiBpbiB3aW5kb3cpKXsKICAgICAgICBvZmZsaW5lUGFnZUNoZWNrZWQ9dHJ1ZTtvZmZsaW5lUGFnZVJlYWR5PWZhbHNlOwogICAgICAgIHVwZGF0ZU9mZmxpbmVTYWZldHlQYW5lbCgiQVZJU086IGVzdGUgbmF2ZWdhZG9yIG5vIHBlcm1pdGUgZ3VhcmRhciBsYSBww6FnaW5hIGNvbXBsZXRhIHBhcmEgcmVjYXJnYXIgc2luIGNvYmVydHVyYSIpOwogICAgICAgIHJldHVybiBmYWxzZTsKICAgIH0KICAgIGxldCByZWdpc3RlcmVkPWZhbHNlOwogICAgY29uc3QgY2FuZGlkYXRlcz1bIi4vc3cuanMiLCIuLi9zdy5qcyJdOwogICAgZm9yKGNvbnN0IHNyYyBvZiBjYW5kaWRhdGVzKXsKICAgICAgICB0cnl7CiAgICAgICAgICAgIGF3YWl0IG5hdmlnYXRvci5zZXJ2aWNlV29ya2VyLnJlZ2lzdGVyKHNyYyx7dXBkYXRlVmlhQ2FjaGU6Im5vbmUifSk7CiAgICAgICAgICAgIHJlZ2lzdGVyZWQ9dHJ1ZTsKICAgICAgICAgICAgYnJlYWs7CiAgICAgICAgfWNhdGNoKGUpe30KICAgIH0KICAgIHRyeXsKICAgICAgICBjb25zdCBjYWNoZT1hd2FpdCBjYWNoZXMub3BlbigibWlsaXRvcG8tcGFydGljaXBhbnRlLXBhZ2UtdjUzIik7CiAgICAgICAgY29uc3QgcGFnZVVybD1sb2NhdGlvbi5ocmVmLnNwbGl0KCIjIilbMF07CiAgICAgICAgY29uc3QgaHRtbD0iPCFET0NUWVBFIGh0bWw+XG4iK2RvY3VtZW50LmRvY3VtZW50RWxlbWVudC5vdXRlckhUTUw7CiAgICAgICAgYXdhaXQgY2FjaGUucHV0KG5ldyBSZXF1ZXN0KHBhZ2VVcmwpLG5ldyBSZXNwb25zZShodG1sLHtoZWFkZXJzOnsiQ29udGVudC1UeXBlIjoidGV4dC9odG1sO2NoYXJzZXQ9dXRmLTgifX0pKTsKICAgICAgICB0cnl7YXdhaXQgY2FjaGUuYWRkKG5ldyBSZXF1ZXN0KHBhZ2VVcmwse2NhY2hlOiJyZWxvYWQifSkpfWNhdGNoKGUpe30KICAgIH1jYXRjaChlKXsKICAgICAgICBvZmZsaW5lUGFnZUNoZWNrZWQ9dHJ1ZTtvZmZsaW5lUGFnZVJlYWR5PWZhbHNlOwogICAgICAgIHVwZGF0ZU9mZmxpbmVTYWZldHlQYW5lbCgiQVZJU086IG5vIHNlIHB1ZG8gZ3VhcmRhciBsYSBww6FnaW5hIGNvbXBsZXRhIHBhcmEgcmVjYXJnYXIgc2luIGNvYmVydHVyYSIpOwogICAgICAgIHJldHVybiBmYWxzZTsKICAgIH0KICAgIHRyeXthd2FpdCBuYXZpZ2F0b3Iuc2VydmljZVdvcmtlci5yZWFkeX1jYXRjaChlKXt9CiAgICBjb25zdCBjb250cm9sbGVkPXJlZ2lzdGVyZWR8fCEhbmF2aWdhdG9yLnNlcnZpY2VXb3JrZXIuY29udHJvbGxlcjsKICAgIG9mZmxpbmVQYWdlQ2hlY2tlZD10cnVlO29mZmxpbmVQYWdlUmVhZHk9ISFjb250cm9sbGVkOwogICAgdXBkYXRlT2ZmbGluZVNhZmV0eVBhbmVsKGNvbnRyb2xsZWQ/IlDDgUdJTkEgR1VBUkRBREEgUEFSQSBSRUNBUkdBUiBTSU4gQ09CRVJUVVJBIjoiQVZJU086IHDDoWdpbmEgZ3VhcmRhZGEsIHBlcm8gZWwgbW9kbyByZWNhcmdhIHNpbiBjb2JlcnR1cmEgdG9kYXbDrWEgbm8gZXN0w6EgYWN0aXZvIik7CiAgICByZXR1cm4gISFjb250cm9sbGVkOwp9CgoKZnVuY3Rpb24gYXV0b0xvYWRFbWJlZGRlZFBhcnRpY2lwYW50Um91dGUoKXsKICAgIHRyeXsKICAgICAgICBpZihyb3V0ZUlzTG9hZGVkKCkpcmV0dXJuIHRydWU7CiAgICAgICAgY29uc3Qgcm91dGVzPUFycmF5LmlzQXJyYXkoRVZFTlRfREFUQS5yb3V0ZXMpP0VWRU5UX0RBVEEucm91dGVzOltdOwogICAgICAgIGlmKCFFVkVOVF9EQVRBLnBhcnRpY2lwYW50TW9kZSAmJiByb3V0ZXMubGVuZ3RoIT09MSlyZXR1cm4gZmFsc2U7CiAgICAgICAgY29uc3Qgcj1yb3V0ZXNbMF07CiAgICAgICAgaWYoIXIgfHwgIXIucGFydGljaXBhbnRJZClyZXR1cm4gZmFsc2U7CgogICAgICAgIHBpZD1TdHJpbmcoRVZFTlRfREFUQS53ZWJQYXJ0aWNpcGFudElkfHxyLnBhcnRpY2lwYW50SWQpOwogICAgICAgIHJvdXRlPXI7CgogICAgICAgIGNvbnN0IGNhbmRpZGF0ZXM9YWxsUmVjb3ZlcnlLZXlzKHBpZCkubWFwKHJlYWRKc29uS2V5KTsKICAgICAgICBsb2c9Y2hvb3NlQmVzdExvZyhjYW5kaWRhdGVzKTsKICAgICAgICBpZighbG9nKXsKICAgICAgICAgICAgbG9nPXsKICAgICAgICAgICAgICAgIGV2ZW50SWQ6RVZFTlRfREFUQS5ldmVudElkLAogICAgICAgICAgICAgICAgcGFydGljaXBhbnRJZDpwaWQsCiAgICAgICAgICAgICAgICByb3V0ZUlkOnJvdXRlLnJvdXRlSWQsCiAgICAgICAgICAgICAgICBzdGFydFRpbWU6bnVsbCwKICAgICAgICAgICAgICAgIGZpbmlzaFRpbWU6bnVsbCwKICAgICAgICAgICAgICAgIHNjYW5zOltdLAogICAgICAgICAgICAgICAgY29tcGxldGVkOmZhbHNlLAogICAgICAgICAgICAgICAgbWlzc2luZ0NvbnRyb2xzOltdCiAgICAgICAgICAgIH07CiAgICAgICAgfQoKICAgICAgICBsb2cuZXZlbnRJZD1FVkVOVF9EQVRBLmV2ZW50SWQ7CiAgICAgICAgbG9nLnBhcnRpY2lwYW50SWQ9cGlkOwogICAgICAgIGxvZy5yb3V0ZUlkPXJvdXRlLnJvdXRlSWQ7CgogICAgICAgIHNhdmUoKTsKICAgICAgICByZW5kZXJMb2FkZWQoKTsKICAgICAgICBlbnN1cmVPZmZsaW5lUGFnZUF2YWlsYWJsZSgpOwoKICAgICAgICBjb25zdCBpZGVudD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgiaWRlbnRpdHkiKTsKICAgICAgICBpZihpZGVudCl7CiAgICAgICAgICAgIGlkZW50LmNsYXNzTmFtZT0ic3RhdHVzIG9rIjsKICAgICAgICAgICAgaWRlbnQuaW5uZXJIVE1MPSLinIUgUmVjb3JyaWRvIGNhcmdhZG8gYXV0b23DoXRpY2FtZW50ZSBkZXNkZSBlbCBRUiBkZSBwYXJ0aWNpcGFudGUuPGJyPjxiPiIrZXNjKHBpZCkrIjwvYj4gwrcgIitlc2Mocm91dGUucm91dGVJZHx8IiIpOwogICAgICAgIH0KICAgICAgICB0b2FzdCgiUmVjb3JyaWRvIGNhcmdhZG8gYXV0b23DoXRpY2FtZW50ZSIpOwogICAgICAgIHJldHVybiB0cnVlOwogICAgfWNhdGNoKGUpewogICAgICAgIGNvbnNvbGUud2FybigiTm8gc2UgcHVkbyBhdXRvY2FyZ2FyIHJlY29ycmlkbyBlbWJlYmlkbyIsZSk7CiAgICAgICAgcmV0dXJuIGZhbHNlOwogICAgfQp9CgpmdW5jdGlvbiBpbml0KCl7CiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgiZXZlbnRJbmZvIikuaW5uZXJIVE1MPSJFdmVudG86IDxiPiIrRVZFTlRfREFUQS5ldmVudElkKyI8L2I+PGJyPiIrKEVWRU5UX0RBVEEuZXZlbnROYW1lfHwiT3JpZW50YWNpw7NuIik7CiAgICByZXF1ZXN0UGVyc2lzdGVudFN0b3JhZ2UoKTsKICAgIGJpbmRQYXJ0aWNpcGFudEF1dG9zYXZlKCk7CiAgICBjb25zdCByZXN0b3JlZD1yZXN0b3JlQmVzdFNhdmVkUnVuKHRydWUpOwogICAgY29uc3QgZW1iZWRkZWQ9YXV0b0xvYWRFbWJlZGRlZFBhcnRpY2lwYW50Um91dGUoKTsKICAgIHVwZGF0ZU9mZmxpbmVTYWZldHlQYW5lbCgocmVzdG9yZWR8fGVtYmVkZGVkKT8iUkVDT1JSSURPIENBUkdBRE8gWSBHVUFSREFETyBBVVRPTcOBVElDQU1FTlRFIjoiQ0FSR0EgVFUgUVIgREUgUEFSVElDSVBBTlRFIEFOVEVTIERFIFNBTElSIik7CiAgICBlbnN1cmVPZmZsaW5lUGFnZUF2YWlsYWJsZSgpLnRoZW4oKCk9PnVwZGF0ZU9mZmxpbmVTYWZldHlQYW5lbCgpKTsKICAgIHByZWNhY2hlUXJSZWFkZXIoKS50aGVuKG9rPT57cXJSZWFkZXJSZWFkeT0hIW9rO3VwZGF0ZU9mZmxpbmVTYWZldHlQYW5lbCgpO30pOwp9CmZ1bmN0aW9uIGtleSgpe3JldHVybiBiYXNlS2V5KCl9ZnVuY3Rpb24gdG9hc3QobSl7Y29uc3QgdD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgidG9hc3QiKTt0LnRleHRDb250ZW50PW07dC5zdHlsZS5kaXNwbGF5PSJibG9jayI7Y2xlYXJUaW1lb3V0KHQuX3QpO3QuX3Q9c2V0VGltZW91dCgoKT0+dC5zdHlsZS5kaXNwbGF5PSJub25lIiwyNTAwKX0KZnVuY3Rpb24gbWFudWFsKCl7ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIm1hbnVhbElucHV0Iikuc3R5bGUuZGlzcGxheT0iYmxvY2siO2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJtYW51YWxCdG4iKS5zdHlsZS5kaXNwbGF5PSJibG9jayJ9ZnVuY3Rpb24gbG9hZE1hbnVhbCgpe2hhbmRsZVFyKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJtYW51YWxJbnB1dCIpLnZhbHVlKX0KZnVuY3Rpb24gZGVjb2RlQjY0VXJsSnNvbih2YWx1ZSl7CiAgICB0cnl7CiAgICAgICAgY29uc3QgYjY0PVN0cmluZyh2YWx1ZXx8IiIpLnJlcGxhY2UoLy0vZywiKyIpLnJlcGxhY2UoL18vZywiLyIpOwogICAgICAgIGNvbnN0IHBhZD1iNjQubGVuZ3RoJTQgPyAiPSIucmVwZWF0KDQtKGI2NC5sZW5ndGglNCkpIDogIiI7CiAgICAgICAgY29uc3QgYmluPWF0b2IoYjY0K3BhZCk7CiAgICAgICAgY29uc3QgYnl0ZXM9bmV3IFVpbnQ4QXJyYXkoYmluLmxlbmd0aCk7CiAgICAgICAgZm9yKGxldCBpPTA7aTxiaW4ubGVuZ3RoO2krKylieXRlc1tpXT1iaW4uY2hhckNvZGVBdChpKTsKICAgICAgICByZXR1cm4gSlNPTi5wYXJzZShuZXcgVGV4dERlY29kZXIoInV0Zi04IikuZGVjb2RlKGJ5dGVzKSk7CiAgICB9Y2F0Y2goZSl7CiAgICAgICAgdHJ5ewogICAgICAgICAgICBjb25zdCBiNjQ9U3RyaW5nKHZhbHVlfHwiIikucmVwbGFjZSgvLS9nLCIrIikucmVwbGFjZSgvXy9nLCIvIik7CiAgICAgICAgICAgIGNvbnN0IHBhZD1iNjQubGVuZ3RoJTQgPyAiPSIucmVwZWF0KDQtKGI2NC5sZW5ndGglNCkpIDogIiI7CiAgICAgICAgICAgIHJldHVybiBKU09OLnBhcnNlKGRlY29kZVVSSUNvbXBvbmVudChlc2NhcGUoYXRvYihiNjQrcGFkKSkpKTsKICAgICAgICB9Y2F0Y2goZXJyKXtyZXR1cm4gbnVsbH0KICAgIH0KfQpmdW5jdGlvbiBleHBhbmRQYXJ0aWNpcGFudENvbXBhY3RQYWNrKGNvbXBhY3QpewogICAgaWYoIWNvbXBhY3R8fHR5cGVvZiBjb21wYWN0IT09Im9iamVjdCIpcmV0dXJuIG51bGw7CiAgICBpZihjb21wYWN0LnY9PT0xKXsKICAgICAgICBjb25zdCBwb2ludHM9e307CiAgICAgICAgKGNvbXBhY3QucHRzfHxbXSkuZm9yRWFjaChyb3c9PnsKICAgICAgICAgICAgY29uc3QgaWQ9U3RyaW5nKHJvd1swXXx8IiIpOwogICAgICAgICAgICBpZighaWQpcmV0dXJuOwogICAgICAgICAgICBwb2ludHNbaWRdPXtpZCx0eXBlOlN0cmluZyhyb3dbMV18fCJCQUxJWkEiKSxsYXQ6TnVtYmVyLmlzRmluaXRlKE51bWJlcihyb3dbMl0pKT9OdW1iZXIocm93WzJdKTpudWxsLGxvbjpOdW1iZXIuaXNGaW5pdGUoTnVtYmVyKHJvd1szXSkpP051bWJlcihyb3dbM10pOm51bGwsZWxldmF0aW9uOk51bWJlci5pc0Zpbml0ZShOdW1iZXIocm93WzRdKSk/TnVtYmVyKHJvd1s0XSk6bnVsbCx1dG06U3RyaW5nKHJvd1s1XXx8IiIpLGRlc2M6U3RyaW5nKHJvd1s2XXx8IiIpfTsKICAgICAgICB9KTsKICAgICAgICBjb25zdCBwaWQ9U3RyaW5nKGNvbXBhY3QucHx8IlAwMSIpOwogICAgICAgIGNvbnN0IHJvdXRlSWQ9U3RyaW5nKChjb21wYWN0LnImJmNvbXBhY3Quci5kKXx8IlIwMSIpOwogICAgICAgIGNvbnN0IHJvdXRlUG9pbnRzPSgoY29tcGFjdC5yJiZjb21wYWN0LnIucSl8fFtdKS5maWx0ZXIoQm9vbGVhbik7CiAgICAgICAgcmV0dXJue3ZlcnNpb246InBhcnRpY2lwYW50X2NvbXBhY3RfdjFfbG9hZGVkX2luc2lkZV9ydW5uZXIiLHBhcnRpY2lwYW50TW9kZTp0cnVlLHdlYlBhcnRpY2lwYW50SWQ6cGlkLGV2ZW50SWQ6U3RyaW5nKGNvbXBhY3QuZXx8RVZFTlRfREFUQS5ldmVudElkfHwiIiksZXZlbnROYW1lOlN0cmluZyhjb21wYWN0Lm58fCJFTlRSRU5BTUlFTlRPIE9SSUVOVEFDScOTTiIpLHBvaW50cyxyb3V0ZXM6W3twYXJ0aWNpcGFudElkOnBpZCxyb3V0ZUlkLHBvaW50czpyb3V0ZVBvaW50c31dLG1ldHJpY3M6W3twYXJ0aWNpcGFudElkOnBpZCxyb3V0ZUlkLGRpc3RhbmNlS206Y29tcGFjdC5tJiZjb21wYWN0Lm0ua20sY2xpbWJVcDpjb21wYWN0Lm0mJmNvbXBhY3QubS5wcCxjbGltYkRvd246Y29tcGFjdC5tJiZjb21wYWN0Lm0ucG4sbmV0Q2xpbWI6Y29tcGFjdC5tJiZjb21wYWN0Lm0uZGcsZGlmZmljdWx0eTpjb21wYWN0Lm0mJmNvbXBhY3QubS5kZn1dLHBhcnRpY2lwYW50TmFtZXM6e1twaWRdOlN0cmluZyhjb21wYWN0LnBufHwiIil9LHBhcnRpY2lwYW50TG9nczp7fSxza2lwcGVkUm91dGVzOnt9LGltcG9ydGVkUmVzdWx0czpbXSxpb2ZEZXNjcmlwdGlvbnM6e319OwogICAgfQogICAgaWYoY29tcGFjdC52PT09Mil7CiAgICAgICAgY29uc3QgcG9pbnRzPXt9OwogICAgICAgIChjb21wYWN0LnB0c3x8W10pLmZvckVhY2gocm93PT57CiAgICAgICAgICAgIGNvbnN0IGlkPVN0cmluZyhyb3dbMF18fCIiKTsKICAgICAgICAgICAgaWYoIWlkKXJldHVybjsKICAgICAgICAgICAgY29uc3QgdXA9aWQudG9VcHBlckNhc2UoKTsKICAgICAgICAgICAgcG9pbnRzW2lkXT17aWQsdHlwZTp1cD09PSJTVEFSVCI/IlNBTElEQSI6dXA9PT0iRklOSVNIIj8iTExFR0FEQSI6IkJBTElaQSIsbGF0Ok51bWJlci5pc0Zpbml0ZShOdW1iZXIocm93WzFdKSk/TnVtYmVyKHJvd1sxXSk6bnVsbCxsb246TnVtYmVyLmlzRmluaXRlKE51bWJlcihyb3dbMl0pKT9OdW1iZXIocm93WzJdKTpudWxsLGVsZXZhdGlvbjpudWxsLHV0bToiIixkZXNjOiIifTsKICAgICAgICB9KTsKICAgICAgICBjb25zdCBwaWQ9U3RyaW5nKGNvbXBhY3QucHx8IlAwMSIpOwogICAgICAgIGNvbnN0IHJvdXRlSWQ9U3RyaW5nKChjb21wYWN0LnImJmNvbXBhY3QuclswXSl8fCJSMDEiKTsKICAgICAgICBjb25zdCByb3V0ZVBvaW50cz0oKGNvbXBhY3QuciYmY29tcGFjdC5yWzFdKXx8W10pLmZpbHRlcihCb29sZWFuKTsKICAgICAgICByZXR1cm57dmVyc2lvbjoicGFydGljaXBhbnRfY29tcGFjdF92Ml9sb2FkZWRfaW5zaWRlX3J1bm5lciIscGFydGljaXBhbnRNb2RlOnRydWUsd2ViUGFydGljaXBhbnRJZDpwaWQsZXZlbnRJZDpTdHJpbmcoY29tcGFjdC5lfHxFVkVOVF9EQVRBLmV2ZW50SWR8fCIiKSxldmVudE5hbWU6U3RyaW5nKGNvbXBhY3Qubnx8IkVOVFJFTkFNSUVOVE8gT1JJRU5UQUNJw5NOIikscG9pbnRzLHJvdXRlczpbe3BhcnRpY2lwYW50SWQ6cGlkLHJvdXRlSWQscG9pbnRzOnJvdXRlUG9pbnRzfV0sbWV0cmljczpbe3BhcnRpY2lwYW50SWQ6cGlkLHJvdXRlSWQsZGlzdGFuY2VLbTpjb21wYWN0Lm0mJmNvbXBhY3QubVswXSxjbGltYlVwOmNvbXBhY3QubSYmY29tcGFjdC5tWzFdLGNsaW1iRG93bjpjb21wYWN0Lm0mJmNvbXBhY3QubVsyXSxuZXRDbGltYjpjb21wYWN0Lm0mJmNvbXBhY3QubVszXSxkaWZmaWN1bHR5OmNvbXBhY3QubSYmY29tcGFjdC5tWzRdfV0scGFydGljaXBhbnROYW1lczp7W3BpZF06U3RyaW5nKGNvbXBhY3QucG58fCIiKX0scGFydGljaXBhbnRMb2dzOnt9LHNraXBwZWRSb3V0ZXM6e30saW1wb3J0ZWRSZXN1bHRzOltdLGlvZkRlc2NyaXB0aW9uczp7fX07CiAgICB9CiAgICBpZihjb21wYWN0LnJvdXRlcyYmY29tcGFjdC5wb2ludHMpcmV0dXJuIGNvbXBhY3Q7CiAgICByZXR1cm4gbnVsbDsKfQpmdW5jdGlvbiBpbXBvcnRQYXJ0aWNpcGFudEV2ZW50RGF0YShwYWNrKXsKICAgIGlmKCFwYWNrfHwhcGFjay5yb3V0ZXN8fCFwYWNrLnBvaW50cylyZXR1cm4gZmFsc2U7CiAgICB0cnl7CiAgICAgICAgT2JqZWN0LmtleXMoRVZFTlRfREFUQSkuZm9yRWFjaChrPT5kZWxldGUgRVZFTlRfREFUQVtrXSk7CiAgICAgICAgT2JqZWN0LmFzc2lnbihFVkVOVF9EQVRBLHBhY2spOwogICAgICAgIHJldHVybiB0cnVlOwogICAgfWNhdGNoKGUpe2NvbnNvbGUud2FybigiTm8gc2UgcHVkbyBpbXBvcnRhciBwYWNrIHBhcnRpY2lwYW50ZSIsZSk7cmV0dXJuIGZhbHNlO30KfQpmdW5jdGlvbiBwYXJzZShyYXcpewogICAgY29uc3QgdmFsdWU9U3RyaW5nKHJhd3x8IiIpLnRyaW0oKTsKICAgIHRyeXsKICAgICAgICBjb25zdCB1cmw9bmV3IFVSTCh2YWx1ZSwgd2luZG93LmxvY2F0aW9uLmhyZWYpOwogICAgICAgIGNvbnN0IHBhcmFtcz1uZXcgVVJMU2VhcmNoUGFyYW1zKHVybC5zZWFyY2h8fCIiKTsKICAgICAgICBjb25zdCBwYWNrZWQ9cGFyYW1zLmdldCgiYyIpfHxwYXJhbXMuZ2V0KCJwZGF0YSIpfHxwYXJhbXMuZ2V0KCJkYXRhIil8fCIiOwogICAgICAgIGNvbnN0IHVybFBpZD1wYXJhbXMuZ2V0KCJwIil8fCIiOwogICAgICAgIGlmKHBhY2tlZHx8dXJsUGlkKXsKICAgICAgICAgICAgY29uc3QgZGVjb2RlZD1wYWNrZWQ/ZGVjb2RlQjY0VXJsSnNvbihwYWNrZWQpOm51bGw7CiAgICAgICAgICAgIGNvbnN0IHBhY2s9ZXhwYW5kUGFydGljaXBhbnRDb21wYWN0UGFjayhkZWNvZGVkKTsKICAgICAgICAgICAgY29uc3QgcGlkPXVybFBpZHx8KHBhY2smJnBhY2sud2ViUGFydGljaXBhbnRJZCl8fCIiOwogICAgICAgICAgICBjb25zdCByb3V0ZUlkPShwYWNrJiZwYWNrLnJvdXRlcyYmcGFjay5yb3V0ZXNbMF0mJnBhY2sucm91dGVzWzBdLnJvdXRlSWQpfHwiIjsKICAgICAgICAgICAgcmV0dXJue29rOnRydWUsdHlwZToiUEFSVElDSVBBTlQiLGV2ZW50SWQ6U3RyaW5nKChwYWNrJiZwYWNrLmV2ZW50SWQpfHxFVkVOVF9EQVRBLmV2ZW50SWR8fCIiKSxpZDpTdHJpbmcocGlkKSxyb3V0ZUlkOlN0cmluZyhyb3V0ZUlkfHwiIiksZXZlbnREYXRhOnBhY2t9OwogICAgICAgIH0KICAgIH1jYXRjaChlKXt9CiAgICBjb25zdCBwPXZhbHVlLnNwbGl0KCJ8Iik7CiAgICBpZihwLmxlbmd0aD49NCYmcFswXS50b1VwcGVyQ2FzZSgpPT09Ik9SSSIpewogICAgICAgIGNvbnN0IHR5cGU9U3RyaW5nKHBbMV18fCIiKS50b1VwcGVyQ2FzZSgpOwogICAgICAgIHJldHVybntvazp0cnVlLHR5cGU6dHlwZT09PSJQQVJUIj8iUEFSVElDSVBBTlQiOnR5cGUsZXZlbnRJZDpwWzJdLGlkOnBbM10scm91dGVJZDpwWzRdfHwiIn07CiAgICB9CiAgICByZXR1cm57b2s6ZmFsc2V9Owp9CgovKiBHUFMgZGUgcHJveGltaWRhZCBlamVjdXRhZG8gZGVudHJvIGRlbCBpZnJhbWUgcGFydGljaXBhbnRlICovCmNvbnN0IEdQU19SQURJVVNfTT03LEdQU19NQVhfQUNDVVJBQ1lfTT0xMCxHUFNfUkVRVUlSRURfSElUUz0zOwpjb25zdCBHUFNfUFJFRl9QUkVGSVg9Im1pbGl0b3BvX3BhcnRpY2lwYW50X2dwc19lbmFibGVkX3YxOiI7CmNvbnN0IEdQU19MT0NLX1BSRUZfUFJFRklYPSJtaWxpdG9wb19wYXJ0aWNpcGFudF9ncHNfbG9ja192MToiOwpsZXQgZ3BzV2F0Y2hJZD1udWxsLGdwc1dha2VMb2NrPW51bGwsZ3BzSW5zaWRlSGl0cz0wLGdwc0xhc3RUYXJnZXQ9IiIsZ3BzTGFzdFBvc2l0aW9uPW51bGwsZ3BzTGFzdFZhbGlkYXRlZEF0PTAsZ3BzVW5sb2NrVGltZXI9bnVsbCxncHNQcmVmc1Jlc3RvcmVkRm9yPSIiLHBhcnRpY2lwYW50TGl2ZVN5bmNTdGF0ZT0iaW5hY3RpdmUiLHBhcnRpY2lwYW50UGVuZGluZ1N5bmNDb3VudD0wLHBhcnRpY2lwYW50UGVuZGluZ0NvbnRyb2xTeW5jQ291bnQ9MCxwYXJ0aWNpcGFudFBlbmRpbmdSZXN1bHRTeW5jPWZhbHNlLGdwc0ZpbmlzaGVkQnlQcm94aW1pdHk9ZmFsc2UsZ3BzRmluaXNoTm90aWNlTW9kZT0iIixncHNGaW5pc2hOb3RpY2VEaXNtaXNzZWRNb2RlPSIiLGdwc0ZpbmlzaEluc2lkZUhpdHM9MCxncHNGaW5pc2hDb25maXJtT3Blbj1mYWxzZSxncHNGaW5pc2hEZWNsaW5lZFVudGlsTGVhdmU9ZmFsc2UsZ3BzU3RhcnRSZW1pbmRlck9wZW49ZmFsc2UsY2FtZXJhTGF5b3V0UmVzdG9yZT1udWxsOwpmdW5jdGlvbiBncHNQcmVmU3VmZml4KCl7cmV0dXJuIFN0cmluZyhFVkVOVF9EQVRBLmV2ZW50SWR8fCIiKSsiOiIrU3RyaW5nKHBpZHx8InBlbmRpbmciKX0KZnVuY3Rpb24gZ3BzUmVhZFByZWYocHJlZml4KXtjb25zdCBrPXByZWZpeCtncHNQcmVmU3VmZml4KCk7cmV0dXJuIHNhZmVHZXQobG9jYWxTdG9yYWdlLGspPT09IjEifHxzYWZlR2V0KHNlc3Npb25TdG9yYWdlLGspPT09IjEifQpmdW5jdGlvbiBncHNXcml0ZVByZWYocHJlZml4LG9uKXtjb25zdCBrPXByZWZpeCtncHNQcmVmU3VmZml4KCksdj1vbj8iMSI6IjAiO3RyeXtsb2NhbFN0b3JhZ2Uuc2V0SXRlbShrLHYpfWNhdGNoKGUpe310cnl7c2Vzc2lvblN0b3JhZ2Uuc2V0SXRlbShrLHYpfWNhdGNoKGUpe319CmZ1bmN0aW9uIGdwc1NldEJ1dHRvbihhY3RpdmUpe2NvbnN0IHN0YXJ0PWdwc0VsKCJncHNTdGFydEJ0biIpLHN0b3A9Z3BzRWwoImdwc1N0b3BCdG4iKTtpZihzdGFydCl7c3RhcnQuZGlzYWJsZWQ9ISFhY3RpdmU7c3RhcnQudGV4dENvbnRlbnQ9YWN0aXZlPyLwn5OhIEdQUyBBQ1RJVkFETyI6IvCfk6EgQUNUSVZBUiBHUFMifWlmKHN0b3Apc3RvcC5kaXNhYmxlZD0hYWN0aXZlfQpmdW5jdGlvbiByZXN0b3JlR3BzUHJlZmVyZW5jZXMoKXtpZighcm91dGV8fCFwaWQpcmV0dXJuO2NvbnN0IHRva2VuPWdwc1ByZWZTdWZmaXgoKTtpZihncHNQcmVmc1Jlc3RvcmVkRm9yPT09dG9rZW4pcmV0dXJuO2dwc1ByZWZzUmVzdG9yZWRGb3I9dG9rZW47Y29uc3Qgd2FudGVkPWdwc1JlYWRQcmVmKEdQU19QUkVGX1BSRUZJWCksbG9ja2VkPWdwc1JlYWRQcmVmKEdQU19MT0NLX1BSRUZfUFJFRklYKTtpZih3YW50ZWQpc2V0VGltZW91dCgoKT0+c3RhcnRQcm94aW1pdHlHcHMoZmFsc2UpLDEyMCk7aWYobG9ja2VkKXNldFRpbWVvdXQoKCk9PmxvY2tSYWNlU2NyZWVuKGZhbHNlKSwyMjApfQpmdW5jdGlvbiBncHNFbChpZCl7cmV0dXJuIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGlkKX0KZnVuY3Rpb24gZm9ybWF0UGFydGljaXBhbnRMYXN0U3luYyh2YWx1ZSl7CiAgICBjb25zdCBlbD1ncHNFbCgibGl2ZUxhc3RTeW5jIik7aWYoIWVsKXJldHVybjsKICAgIGNvbnN0IGQ9dmFsdWU/bmV3IERhdGUodmFsdWUpOm51bGw7CiAgICBpZighZHx8IU51bWJlci5pc0Zpbml0ZShkLmdldFRpbWUoKSkpe2VsLnRleHRDb250ZW50PSLDmkxUSU1BIFNJTkNST05JWkFDScOTTiBFTiBWSVZPIMK3IFRPREFWw41BIE5PIFJFQUxJWkFEQSI7cmV0dXJufQogICAgY29uc3Qgbm93PW5ldyBEYXRlKCksc2FtZURheT1kLmdldEZ1bGxZZWFyKCk9PT1ub3cuZ2V0RnVsbFllYXIoKSYmZC5nZXRNb250aCgpPT09bm93LmdldE1vbnRoKCkmJmQuZ2V0RGF0ZSgpPT09bm93LmdldERhdGUoKTsKICAgIGNvbnN0IHRpbWU9ZC50b0xvY2FsZVRpbWVTdHJpbmcoImVzLUVTIix7aG91cjoiMi1kaWdpdCIsbWludXRlOiIyLWRpZ2l0IixzZWNvbmQ6IjItZGlnaXQifSk7CiAgICBjb25zdCBkYXRlPWQudG9Mb2NhbGVEYXRlU3RyaW5nKCJlcy1FUyIse2RheToiMi1kaWdpdCIsbW9udGg6IjItZGlnaXQifSk7CiAgICBlbC50ZXh0Q29udGVudD0iw5pMVElNQSBTSU5DUk9OSVpBQ0nDk04gRU4gVklWTyDCtyAiKyhzYW1lRGF5PyJIT1kgwrcgIjpkYXRlKyIgwrcgIikrdGltZTsKfQpmdW5jdGlvbiBzZXRQYXJ0aWNpcGFudExpdmVTeW5jU3RhdHVzKHN0YXRlLHRleHQsbGFzdFN5bmNBdCl7Y29uc3QgZWw9Z3BzRWwoImxpdmVTeW5jU3RhdHVzIik7Y29uc3QgYWxsb3dlZD17c3luY2VkOjEsb2ZmbGluZToxLHN5bmNpbmc6MSxpbmFjdGl2ZToxfTtjb25zdCBzYWZlPWFsbG93ZWRbc3RhdGVdP3N0YXRlOiJpbmFjdGl2ZSI7cGFydGljaXBhbnRMaXZlU3luY1N0YXRlPXNhZmU7aWYoZWwpe2VsLmNsYXNzTmFtZT0ibGl2ZS1zeW5jLXN0YXR1cyBpcy0iK3NhZmU7ZWwudGV4dENvbnRlbnQ9U3RyaW5nKHRleHR8fCLimqogQ0FSUkVSQSBFTiBWSVZPIE5PIEFDVElWQSIpfWZvcm1hdFBhcnRpY2lwYW50TGFzdFN5bmMobGFzdFN5bmNBdCl9CmZ1bmN0aW9uIHJlc2l6ZVBhcnRpY2lwYW50RnJhbWVGcm9tSW5zaWRlKCl7dHJ5e2NvbnN0IGZyYW1lPXdpbmRvdy5mcmFtZUVsZW1lbnQ7aWYoIWZyYW1lKXJldHVybjtjb25zdCBoPU1hdGgubWF4KGRvY3VtZW50LmJvZHk/LnNjcm9sbEhlaWdodHx8MCxkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ/LnNjcm9sbEhlaWdodHx8MCw5MDApO2ZyYW1lLnN0eWxlLmhlaWdodD0oaCsyNCkrInB4IjtmcmFtZS5zdHlsZS5taW5IZWlnaHQ9KGgrMjQpKyJweCJ9Y2F0Y2goZSl7fX0KZnVuY3Rpb24gZm9jdXNGaW5pc2hOb3RpY2VBdFRvcCgpe3NldFRpbWVvdXQoKCk9Pnt0cnl7cmVzaXplUGFydGljaXBhbnRGcmFtZUZyb21JbnNpZGUoKTtpZih3aW5kb3cucGFyZW50JiZ3aW5kb3cucGFyZW50IT09d2luZG93KXtjb25zdCB0b3BiYXI9d2luZG93LnBhcmVudC5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKCIjbWlsaXRvcG9QYXJ0aWNpcGFudE9ubHlTaGVsbCAucGFydGljaXBhbnQtb25seS10b3BiYXIiKTtpZih0b3BiYXIpe3RvcGJhci5zY3JvbGxJbnRvVmlldyh7YmVoYXZpb3I6InNtb290aCIsYmxvY2s6InN0YXJ0In0pO3JldHVybn1jb25zdCBmcmFtZT13aW5kb3cuZnJhbWVFbGVtZW50O2lmKGZyYW1lKWZyYW1lLnNjcm9sbEludG9WaWV3KHtiZWhhdmlvcjoic21vb3RoIixibG9jazoic3RhcnQifSl9ZWxzZXtncHNFbCgiZ3BzRmluaXNoTm90aWNlIik/LnNjcm9sbEludG9WaWV3KHtiZWhhdmlvcjoic21vb3RoIixibG9jazoic3RhcnQifSl9fWNhdGNoKGUpe3RyeXtncHNFbCgiZ3BzRmluaXNoTm90aWNlIik/LnNjcm9sbEludG9WaWV3KHtiZWhhdmlvcjoic21vb3RoIixibG9jazoic3RhcnQifSl9Y2F0Y2goXyl7fX19LDgwKX0KZnVuY3Rpb24gY2xvc2VHcHNGaW5pc2hOb3RpY2UoKXtjb25zdCBlbD1ncHNFbCgiZ3BzRmluaXNoTm90aWNlIik7Z3BzRmluaXNoTm90aWNlRGlzbWlzc2VkTW9kZT1ncHNGaW5pc2hOb3RpY2VNb2RlO2lmKGVsKWVsLmNsYXNzTGlzdC5yZW1vdmUoIm9wZW4iKTtyZXNpemVQYXJ0aWNpcGFudEZyYW1lRnJvbUluc2lkZSgpfQpmdW5jdGlvbiBzaG93R3BzRmluaXNoTm90aWNlKG1vZGU9InBlbmRpbmciKXsKICAgIGNvbnN0IGJveD1ncHNFbCgiZ3BzRmluaXNoTm90aWNlIiksdGl0bGU9Z3BzRWwoImdwc0ZpbmlzaFRpdGxlIiksdGV4dD1ncHNFbCgiZ3BzRmluaXNoVGV4dCIpOwogICAgaWYoIWJveHx8IXRpdGxlfHwhdGV4dClyZXR1cm47CiAgICBjb25zdCBtb2RlQ2hhbmdlZD1ncHNGaW5pc2hOb3RpY2VNb2RlIT09bW9kZTsKICAgIGlmKG1vZGVDaGFuZ2VkKWdwc0ZpbmlzaE5vdGljZURpc21pc3NlZE1vZGU9IiI7CiAgICBncHNGaW5pc2hOb3RpY2VNb2RlPW1vZGU7CiAgICBpZihncHNGaW5pc2hOb3RpY2VEaXNtaXNzZWRNb2RlPT09bW9kZSlyZXR1cm47CiAgICBjb25zdCBzaG91bGRGb2N1cz1tb2RlQ2hhbmdlZHx8IWJveC5jbGFzc0xpc3QuY29udGFpbnMoIm9wZW4iKTsKICAgIGJveC5jbGFzc0xpc3QuYWRkKCJvcGVuIik7CiAgICBpZihtb2RlPT09ImltcG9ydGVkIil7CiAgICAgICAgdGl0bGUudGV4dENvbnRlbnQ9IuKchSBSRVNVTFRBRE8gSU1QT1JUQURPIjsKICAgICAgICB0ZXh0LnRleHRDb250ZW50PSJIYXMgdGVybWluYWRvIGxhIGNhcnJlcmEgeSB0dSByZXN1bHRhZG8geWEgc2UgaGEgaW1wb3J0YWRvIGF1dG9tw6F0aWNhbWVudGUuIjsKICAgIH1lbHNlIGlmKG1vZGU9PT0ib2ZmbGluZSIpewogICAgICAgIHRpdGxlLnRleHRDb250ZW50PSLwn4+BIENBUlJFUkEgRklOQUxJWkFEQSBTSU4gQ09ORVhJw5NOIjsKICAgICAgICBjb25zdCBtaXNzaW5nPWxvZyYmQXJyYXkuaXNBcnJheShsb2cubWlzc2luZ0NvbnRyb2xzKT9sb2cubWlzc2luZ0NvbnRyb2xzOltdOwogICAgICAgIGNvbnN0IHJvdXRlTGluZT1taXNzaW5nLmxlbmd0aAogICAgICAgICAgICA/KCJDb250cm9sZXMgcGVuZGllbnRlcyBkZWwgcmVjb3JyaWRvOiAiK21pc3Npbmcuam9pbigiLCAiKSsiLiIpCiAgICAgICAgICAgIDoiUmVjb3JyaWRvIGNvbXBsZXRvOiBubyBxdWVkYW4gY29udHJvbGVzIHBlbmRpZW50ZXMuIjsKICAgICAgICBjb25zdCBzeW5jQ29udHJvbHM9TWF0aC5tYXgoMCxOdW1iZXIocGFydGljaXBhbnRQZW5kaW5nQ29udHJvbFN5bmNDb3VudCl8fDApOwogICAgICAgIGNvbnN0IHN5bmNMaW5lPXN5bmNDb250cm9scz4wCiAgICAgICAgICAgID8oIlF1ZWRhbiAiK3N5bmNDb250cm9scysiIGNvbnRyb2wiKyhzeW5jQ29udHJvbHM9PT0xPyIiOiJlcyIpKyIgcGVuZGllbnRlIisoc3luY0NvbnRyb2xzPT09MT8iIjoicyIpKyIgZGUgZW52aWFyIGFsIG1vZG8gZW4gdml2by4iKQogICAgICAgICAgICA6IkxvcyBjb250cm9sZXMgcmVnaXN0cmFkb3MgZXN0w6FuIGd1YXJkYWRvcyBlbiBlbCBtw7N2aWwuIjsKICAgICAgICBjb25zdCByZXN1bHRMaW5lPSJUYW1iacOpbiBmYWx0YSBlbnZpYXIgeSByZWNpYmlyIGxhIGNvbmZpcm1hY2nDs24gZGVsIHJlc3VsdGFkbyBmaW5hbC4iOwogICAgICAgIHRleHQudGV4dENvbnRlbnQ9cm91dGVMaW5lKyJcblxuIitzeW5jTGluZSsiICIrcmVzdWx0TGluZSsiXG5cblRvZG8gc2UgcmVpbnRlbnRhcsOhIGF1dG9tw6F0aWNhbWVudGUgYWwgcmVjdXBlcmFyIGNvYmVydHVyYS4gRWwgUVIgZmluYWwgc2lndWUgZGlzcG9uaWJsZSBjb21vIHJlc3BhbGRvLiI7CiAgICB9ZWxzZSBpZihtb2RlPT09ImluYWN0aXZlIil7CiAgICAgICAgdGl0bGUudGV4dENvbnRlbnQ9IvCfj4EgQ0FSUkVSQSBGSU5BTElaQURBIjsKICAgICAgICB0ZXh0LnRleHRDb250ZW50PSJMYSBsbGVnYWRhIHNlIGhhIHJlZ2lzdHJhZG8sIHBlcm8gbGEgY2FycmVyYSBlbiB2aXZvIG5vIGVzdMOhIGFjdGl2YS4gRW5zZcOxYSBlbCBRUiBmaW5hbCBhbCBvcmdhbml6YWRvciBwYXJhIGltcG9ydGFyIGVsIHJlc3VsdGFkby4iOwogICAgfWVsc2V7CiAgICAgICAgdGl0bGUudGV4dENvbnRlbnQ9IvCfj4EgQ0FSUkVSQSBGSU5BTElaQURBIjsKICAgICAgICB0ZXh0LnRleHRDb250ZW50PSJMYSBsbGVnYWRhIHNlIGhhIHJlZ2lzdHJhZG8uIEVzcGVyYW5kbyBjb25maXJtYWNpw7NuIGRlIGltcG9ydGFjacOzbiBlbiB2aXZvLi4uIjsKICAgIH0KICAgIGlmKHNob3VsZEZvY3VzKWZvY3VzRmluaXNoTm90aWNlQXRUb3AoKTsKfQoKZnVuY3Rpb24gZ3BzRmluaXNoUG9pbnQoKXsKICAgIGlmKCFyb3V0ZXx8IWxvZ3x8IWxvZy5zdGFydFRpbWV8fGxvZy5maW5pc2hUaW1lKXJldHVybiBudWxsOwogICAgY29uc3QgcG9pbnQ9RVZFTlRfREFUQS5wb2ludHMmJkVWRU5UX0RBVEEucG9pbnRzLkZJTklTSDsKICAgIGNvbnN0IGxhdD1OdW1iZXIocG9pbnQmJnBvaW50LmxhdCksbG9uPU51bWJlcihwb2ludCYmcG9pbnQubG9uKTsKICAgIHJldHVybiBOdW1iZXIuaXNGaW5pdGUobGF0KSYmTnVtYmVyLmlzRmluaXRlKGxvbik/e2lkOiJGSU5JU0giLGxhYmVsOiJMTEVHQURBIixsYXQsbG9uLGlzRmluaXNoOnRydWV9Om51bGw7Cn0KZnVuY3Rpb24gZ3BzUHJvZ3Jlc3NEYXRhKCl7CiAgICBjb25zdCBleHBlY3RlZD0ocm91dGUmJnJvdXRlLnBvaW50c3x8W10pLmZpbHRlcihpZD0+aWQhPT0iU1RBUlQiJiZpZCE9PSJGSU5JU0giKTsKICAgIGNvbnN0IGNvbXBsZXRlZD1ncHNDb3JyZWN0Q291bnQoKTsKICAgIHJldHVybntjb21wbGV0ZWQsdG90YWw6ZXhwZWN0ZWQubGVuZ3RoLHBlbmRpbmc6TWF0aC5tYXgoMCxleHBlY3RlZC5sZW5ndGgtY29tcGxldGVkKX07Cn0KZnVuY3Rpb24gc2hvd0dwc0Fycml2YWxDb25maXJtKCl7CiAgICBpZighcm91dGV8fCFsb2d8fCFsb2cuc3RhcnRUaW1lfHxsb2cuZmluaXNoVGltZXx8Z3BzRmluaXNoQ29uZmlybU9wZW4pcmV0dXJuIGZhbHNlOwogICAgY29uc3QgcD1ncHNQcm9ncmVzc0RhdGEoKTsKICAgIGlmKCFwLnBlbmRpbmcpcmV0dXJuIGZhbHNlOwogICAgY29uc3QgYm94PWdwc0VsKCJncHNBcnJpdmFsQ29uZmlybSIpLHRleHQ9Z3BzRWwoImdwc0Fycml2YWxDb25maXJtVGV4dCIpOwogICAgaWYoIWJveHx8IXRleHQpcmV0dXJuIGZhbHNlOwogICAgdGV4dC50ZXh0Q29udGVudD0iSGFzIGxsZWdhZG8gY29uICIrcC5jb21wbGV0ZWQrIiBkZSAiK3AudG90YWwrIiBjb250cm9sZXMgY29tcGxldGFkb3MuIFNpIHRlcm1pbmFzIGFob3JhLCBzZSBpbXBvcnRhcsOhIGVsIHJlc3VsdGFkbyBjb24gIitwLnBlbmRpbmcrIiBjb250cm9sIisocC5wZW5kaW5nPT09MT8iIHBlbmRpZW50ZS4iOiJlcyBwZW5kaWVudGVzLiIpOwogICAgZ3BzRmluaXNoQ29uZmlybU9wZW49dHJ1ZTsKICAgIGJveC5jbGFzc0xpc3QuYWRkKCJvcGVuIik7CiAgICBzZXRHcHNTdGF0dXMoIkxsZWdhZGEgZGV0ZWN0YWRhLiBDb25maXJtYSBzaSBxdWllcmVzIHRlcm1pbmFyIGxhIGNhcnJlcmEuIiwib2siKTsKICAgIHJldHVybiB0cnVlOwp9CmZ1bmN0aW9uIGNsb3NlR3BzQXJyaXZhbENvbmZpcm0oKXsKICAgIGNvbnN0IGJveD1ncHNFbCgiZ3BzQXJyaXZhbENvbmZpcm0iKTsKICAgIGlmKGJveClib3guY2xhc3NMaXN0LnJlbW92ZSgib3BlbiIpOwogICAgZ3BzRmluaXNoQ29uZmlybU9wZW49ZmFsc2U7Cn0KZnVuY3Rpb24gY29udGludWVHcHNSYWNlKCl7CiAgICBjbG9zZUdwc0Fycml2YWxDb25maXJtKCk7CiAgICBncHNGaW5pc2hEZWNsaW5lZFVudGlsTGVhdmU9dHJ1ZTsKICAgIGdwc0ZpbmlzaEluc2lkZUhpdHM9MDsKICAgIGdwc0xhc3RWYWxpZGF0ZWRBdD1EYXRlLm5vdygpOwogICAgZ3BzUmVmcmVzaFN0YXRlKCk7CiAgICB0b2FzdCgiQ29udGluw7phcyBsYSBjYXJyZXJhLiBQb2Ryw6FzIHRlcm1pbmFyIGFsIHNhbGlyIHkgdm9sdmVyIGEgZW50cmFyIGVuIExMRUdBREEuIik7Cn0KYXN5bmMgZnVuY3Rpb24gY29uZmlybUdwc0Fycml2YWxGaW5pc2goKXsKICAgIGlmKCFyb3V0ZXx8IWxvZ3x8IWxvZy5zdGFydFRpbWV8fGxvZy5maW5pc2hUaW1lKXJldHVybjsKICAgIGNsb3NlR3BzQXJyaXZhbENvbmZpcm0oKTsKICAgIGdwc0ZpbmlzaERlY2xpbmVkVW50aWxMZWF2ZT1mYWxzZTsKICAgIGdwc0ZpbmlzaEluc2lkZUhpdHM9MDsKICAgIGdwc0ZpbmlzaGVkQnlQcm94aW1pdHk9dHJ1ZTsKICAgIHVubG9ja1JhY2VTY3JlZW4odHJ1ZSk7CiAgICBhd2FpdCBmaW5pc2hSYWNlKCJncHMiKTsKfQpmdW5jdGlvbiBzaG93R3BzU3RhcnRSZW1pbmRlcigpewogICAgaWYoIXJvdXRlfHwhbG9nfHwhbG9nLnN0YXJ0VGltZXx8bG9nLmZpbmlzaFRpbWV8fGdwc1dhdGNoSWQhPT1udWxsfHxncHNTdGFydFJlbWluZGVyT3BlbilyZXR1cm47CiAgICBjb25zdCBib3g9Z3BzRWwoImdwc1N0YXJ0UmVtaW5kZXIiKTsKICAgIGlmKCFib3gpcmV0dXJuOwogICAgZ3BzU3RhcnRSZW1pbmRlck9wZW49dHJ1ZTsKICAgIGJveC5jbGFzc0xpc3QuYWRkKCJvcGVuIik7Cn0KZnVuY3Rpb24gY2xvc2VHcHNTdGFydFJlbWluZGVyKCl7CiAgICBjb25zdCBib3g9Z3BzRWwoImdwc1N0YXJ0UmVtaW5kZXIiKTsKICAgIGlmKGJveClib3guY2xhc3NMaXN0LnJlbW92ZSgib3BlbiIpOwogICAgZ3BzU3RhcnRSZW1pbmRlck9wZW49ZmFsc2U7Cn0KYXN5bmMgZnVuY3Rpb24gYWN0aXZhdGVHcHNGcm9tU3RhcnRSZW1pbmRlcigpewogICAgY2xvc2VHcHNTdGFydFJlbWluZGVyKCk7CiAgICBhd2FpdCBzdGFydFByb3hpbWl0eUdwcyh0cnVlKTsKfQp3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigibWVzc2FnZSIsZXZlbnQ9PnsKICAgIGlmKGV2ZW50LnNvdXJjZSE9PXdpbmRvdy5wYXJlbnQpcmV0dXJuOwogICAgY29uc3QgbXNnPWV2ZW50LmRhdGE7CiAgICBpZighbXNnKXJldHVybjsKICAgIGlmKG1zZy5zb3VyY2U9PT0iTUlMSVRPUE9fTElWRV9TWU5DX1NUQVRVUyImJm1zZy5wYXlsb2FkKXsKICAgICAgICBwYXJ0aWNpcGFudFBlbmRpbmdTeW5jQ291bnQ9TWF0aC5tYXgoMCxOdW1iZXIobXNnLnBheWxvYWQucGVuZGluZyl8fDApOwogICAgICAgIHBhcnRpY2lwYW50UGVuZGluZ0NvbnRyb2xTeW5jQ291bnQ9TWF0aC5tYXgoMCxOdW1iZXIobXNnLnBheWxvYWQucGVuZGluZ0NvbnRyb2xzKXx8MCk7CiAgICAgICAgcGFydGljaXBhbnRQZW5kaW5nUmVzdWx0U3luYz0hIW1zZy5wYXlsb2FkLnBlbmRpbmdSZXN1bHQ7CiAgICAgICAgc2V0UGFydGljaXBhbnRMaXZlU3luY1N0YXR1cyhtc2cucGF5bG9hZC5zdGF0ZSxtc2cucGF5bG9hZC50ZXh0LG1zZy5wYXlsb2FkLmxhc3RTeW5jQXQpOwogICAgICAgIGlmKGxvZyYmbG9nLmZpbmlzaFRpbWUmJm1zZy5wYXlsb2FkLnN0YXRlPT09Im9mZmxpbmUiKXNob3dHcHNGaW5pc2hOb3RpY2UoIm9mZmxpbmUiKTsKICAgICAgICBpZihsb2cmJmxvZy5maW5pc2hUaW1lJiZtc2cucGF5bG9hZC5zdGF0ZT09PSJpbmFjdGl2ZSIpc2hvd0dwc0ZpbmlzaE5vdGljZSgiaW5hY3RpdmUiKTsKICAgICAgICByZXR1cm47CiAgICB9CiAgICBpZihtc2cuc291cmNlPT09Ik1JTElUT1BPX0xJVkVfUkVTVUxUX0lNUE9SVEVEIiYmbXNnLnBheWxvYWQmJlN0cmluZyhtc2cucGF5bG9hZC5wYXJ0aWNpcGFudElkfHwiIik9PT1TdHJpbmcocGlkfHwiIikpewogICAgICAgIGlmKGxvZyYmbG9nLmZpbmlzaFRpbWUpe3Nob3dHcHNGaW5pc2hOb3RpY2UoImltcG9ydGVkIik7dG9hc3QoIlJlc3VsdGFkbyBpbXBvcnRhZG8uIENhcnJlcmEgZmluYWxpemFkYS4iKX0KICAgIH0KfSk7CmZ1bmN0aW9uIGdwc0NvcnJlY3RDb3VudCgpe3JldHVybiBsb2cmJkFycmF5LmlzQXJyYXkobG9nLnNjYW5zKT9sb2cuc2NhbnMuZmlsdGVyKHM9PnMuc3RhdHVzPT09ImNvcnJlY3QiKS5sZW5ndGg6MH0KZnVuY3Rpb24gZ3BzTmV4dENvbnRyb2woKXsKICAgIGlmKCFyb3V0ZXx8IWxvZ3x8IWxvZy5zdGFydFRpbWV8fGxvZy5maW5pc2hUaW1lKXJldHVybiBudWxsOwogICAgY29uc3QgaWRzPShyb3V0ZS5wb2ludHN8fFtdKS5maWx0ZXIoaWQ9PmlkIT09IlNUQVJUIiYmaWQhPT0iRklOSVNIIik7CiAgICBjb25zdCBkb25lPWdwc0NvcnJlY3RDb3VudCgpOwogICAgbGV0IGlkPWlkc1tkb25lXSxpc0ZpbmlzaD1mYWxzZTsKICAgIGlmKCFpZCYmZG9uZT49aWRzLmxlbmd0aCl7aWQ9IkZJTklTSCI7aXNGaW5pc2g9dHJ1ZX0KICAgIGNvbnN0IHBvaW50PWlkJiZFVkVOVF9EQVRBLnBvaW50cz9FVkVOVF9EQVRBLnBvaW50c1tpZF06bnVsbCxsYXQ9TnVtYmVyKHBvaW50JiZwb2ludC5sYXQpLGxvbj1OdW1iZXIocG9pbnQmJnBvaW50Lmxvbik7CiAgICByZXR1cm4gaWQmJk51bWJlci5pc0Zpbml0ZShsYXQpJiZOdW1iZXIuaXNGaW5pdGUobG9uKT97aWQsbGFiZWw6aXNGaW5pc2g/IkxMRUdBREEiOmlkLGxhdCxsb24saXNGaW5pc2h9Om51bGwKfQpmdW5jdGlvbiBncHNEaXN0YW5jZU0obGF0MSxsb24xLGxhdDIsbG9uMil7Y29uc3Qgcj02MzcxMDAwLHJhZD14PT54Kk1hdGguUEkvMTgwLHAxPXJhZChsYXQxKSxwMj1yYWQobGF0MiksZHA9cmFkKGxhdDItbGF0MSksZGw9cmFkKGxvbjItbG9uMSksYT1NYXRoLnNpbihkcC8yKSoqMitNYXRoLmNvcyhwMSkqTWF0aC5jb3MocDIpKk1hdGguc2luKGRsLzIpKioyO3JldHVybiAyKnIqTWF0aC5hdGFuMihNYXRoLnNxcnQoYSksTWF0aC5zcXJ0KDEtYSkpfQpmdW5jdGlvbiBzZXRHcHNTdGF0dXModGV4dCxraW5kPSIiKXtjb25zdCBib3g9Z3BzRWwoImdwc1N0YXR1cyIpO2lmKGJveCl7Ym94LnRleHRDb250ZW50PXRleHQ7Ym94LmNsYXNzTmFtZT0ic3RhdHVzIisoa2luZD8iICIra2luZDoiIil9Y29uc3QgbG9jaz1ncHNFbCgiZ3BzTG9ja1N0YXR1cyIpO2lmKGxvY2spbG9jay50ZXh0Q29udGVudD10ZXh0fQpmdW5jdGlvbiB1cGRhdGVHcHNNZXRyaWNzKGRpc3Q9bnVsbCxhY2M9bnVsbCx0YXJnZXRJZD1udWxsKXtjb25zdCBuZXh0PWdwc05leHRDb250cm9sKCksdGFyZ2V0PXRhcmdldElkfHwobmV4dCYmKG5leHQubGFiZWx8fG5leHQuaWQpKXx8IuKAlCI7aWYoZ3BzRWwoImdwc1RhcmdldCIpKWdwc0VsKCJncHNUYXJnZXQiKS50ZXh0Q29udGVudD10YXJnZXQ7aWYoZ3BzRWwoImdwc0FjY3VyYWN5IikpZ3BzRWwoImdwc0FjY3VyYWN5IikudGV4dENvbnRlbnQ9YWNjPT1udWxsPyLigJQiOiLCsSIrTWF0aC5yb3VuZChhY2MpKyIgbSI7aWYoZ3BzRWwoImdwc0xvY2tUYXJnZXQiKSlncHNFbCgiZ3BzTG9ja1RhcmdldCIpLnRleHRDb250ZW50PXRhcmdldH0KYXN5bmMgZnVuY3Rpb24gZ3BzQmVlcCgpe3RyeXtjb25zdCBDPXdpbmRvdy5BdWRpb0NvbnRleHR8fHdpbmRvdy53ZWJraXRBdWRpb0NvbnRleHQ7aWYoIUMpcmV0dXJuO2NvbnN0IGM9bmV3IEMoKTtpZihjLnN0YXRlPT09InN1c3BlbmRlZCIpYXdhaXQgYy5yZXN1bWUoKS5jYXRjaCgoKT0+e30pO2NvbnN0IG1hc3Rlcj1jLmNyZWF0ZUdhaW4oKTttYXN0ZXIuZ2Fpbi5zZXRWYWx1ZUF0VGltZSguNzIsYy5jdXJyZW50VGltZSk7bWFzdGVyLmNvbm5lY3QoYy5kZXN0aW5hdGlvbik7WzAsLjIyLC40NF0uZm9yRWFjaCgoZGVsYXksaSk9Pntjb25zdCBvPWMuY3JlYXRlT3NjaWxsYXRvcigpLGc9Yy5jcmVhdGVHYWluKCksc3RhcnQ9Yy5jdXJyZW50VGltZStkZWxheTtvLnR5cGU9InNxdWFyZSI7by5mcmVxdWVuY3kuc2V0VmFsdWVBdFRpbWUoaT09PTE/MTMyMDoxMDgwLHN0YXJ0KTtnLmdhaW4uc2V0VmFsdWVBdFRpbWUoLjAwMDEsc3RhcnQpO2cuZ2Fpbi5leHBvbmVudGlhbFJhbXBUb1ZhbHVlQXRUaW1lKC42MixzdGFydCsuMDE4KTtnLmdhaW4uc2V0VmFsdWVBdFRpbWUoLjYyLHN0YXJ0Ky4xMik7Zy5nYWluLmV4cG9uZW50aWFsUmFtcFRvVmFsdWVBdFRpbWUoLjAwMDEsc3RhcnQrLjE5KTtvLmNvbm5lY3QoZyk7Zy5jb25uZWN0KG1hc3Rlcik7by5zdGFydChzdGFydCk7by5zdG9wKHN0YXJ0Ky4yKX0pO3NldFRpbWVvdXQoKCk9PmMuY2xvc2UoKS5jYXRjaCgoKT0+e30pLDEwMDApfWNhdGNoKGUpe319CmZ1bmN0aW9uIGdwc1ZhbGlkYXRlZChpZCl7Z3BzQmVlcCgpO3RyeXtuYXZpZ2F0b3IudmlicmF0ZSYmbmF2aWdhdG9yLnZpYnJhdGUoWzUwMCwxMjAsNTAwLDEyMCw3NTBdKX1jYXRjaChlKXt9dG9hc3QoIkJhbGl6YSAiK2lkKyIgdmFsaWRhZGEgcG9yIHByb3hpbWlkYWQiKX0KZnVuY3Rpb24gZ3BzQXJyaXZhbERldGVjdGVkKG5lZWRzQ29uZmlybWF0aW9uPXRydWUpe2dwc0JlZXAoKTt0cnl7bmF2aWdhdG9yLnZpYnJhdGUmJm5hdmlnYXRvci52aWJyYXRlKFs3MDAsMTQwLDcwMCwxNDAsMTAwMF0pfWNhdGNoKGUpe310b2FzdChuZWVkc0NvbmZpcm1hdGlvbj8iTGxlZ2FkYSBkZXRlY3RhZGEuIENvbmZpcm1hIHNpIHF1aWVyZXMgdGVybWluYXIiOiJMbGVnYWRhIGRldGVjdGFkYS4gUmVjb3JyaWRvIGNvbXBsZXRvOyBmaW5hbGl6YW5kbyBlIGltcG9ydGFuZG8gcmVzdWx0YWRvIil9CmZ1bmN0aW9uIGhhbmRsZUdwc0Fycml2YWxEZXRlY3RlZCgpewogICAgY29uc3QgcD1ncHNQcm9ncmVzc0RhdGEoKTsKICAgIGlmKHAucGVuZGluZz4wKXsKICAgICAgICBncHNBcnJpdmFsRGV0ZWN0ZWQodHJ1ZSk7CiAgICAgICAgc2hvd0dwc0Fycml2YWxDb25maXJtKCk7CiAgICAgICAgcmV0dXJuOwogICAgfQogICAgZ3BzQXJyaXZhbERldGVjdGVkKGZhbHNlKTsKICAgIGdwc0ZpbmlzaENvbmZpcm1PcGVuPXRydWU7CiAgICBzZXRHcHNTdGF0dXMoIkxsZWdhZGEgZGV0ZWN0YWRhLiBSZWNvcnJpZG8gY29tcGxldG8uIEZpbmFsaXphbmRvIGUgaW1wb3J0YW5kbyByZXN1bHRhZG8uLi4iLCJvayIpOwogICAgUHJvbWlzZS5yZXNvbHZlKGNvbmZpcm1HcHNBcnJpdmFsRmluaXNoKCkpLmNhdGNoKCgpPT57CiAgICAgICAgZ3BzRmluaXNoQ29uZmlybU9wZW49ZmFsc2U7CiAgICAgICAgc2V0R3BzU3RhdHVzKCJObyBzZSBwdWRvIGZpbmFsaXphciBhdXRvbcOhdGljYW1lbnRlLiBFc2NhbmVhIExMRUdBREEgY29tbyByZXNwYWxkby4iLCJlcnIiKTsKICAgIH0pOwp9CmFzeW5jIGZ1bmN0aW9uIHJlcXVlc3RHcHNXYWtlTG9jaygpe3RyeXtpZigid2FrZUxvY2siIGluIG5hdmlnYXRvciYmZG9jdW1lbnQudmlzaWJpbGl0eVN0YXRlPT09InZpc2libGUiJiYhZ3BzV2FrZUxvY2spZ3BzV2FrZUxvY2s9YXdhaXQgbmF2aWdhdG9yLndha2VMb2NrLnJlcXVlc3QoInNjcmVlbiIpfWNhdGNoKGUpe319CmFzeW5jIGZ1bmN0aW9uIHJlbGVhc2VHcHNXYWtlTG9jaygpe3RyeXtpZihncHNXYWtlTG9jaylhd2FpdCBncHNXYWtlTG9jay5yZWxlYXNlKCl9Y2F0Y2goZSl7fWdwc1dha2VMb2NrPW51bGx9CmZ1bmN0aW9uIGdwc0N1cnJlbnRBY2N1cmFjeSgpe2NvbnN0IGFjYz1OdW1iZXIoZ3BzTGFzdFBvc2l0aW9uJiZncHNMYXN0UG9zaXRpb24uY29vcmRzJiZncHNMYXN0UG9zaXRpb24uY29vcmRzLmFjY3VyYWN5KTtyZXR1cm4gTnVtYmVyLmlzRmluaXRlKGFjYyk/YWNjOm51bGx9CmZ1bmN0aW9uIGdwc1JlZnJlc2hTdGF0ZSgpewogICAgaWYoZ3BzV2F0Y2hJZD09PW51bGwpe3VwZGF0ZUdwc01ldHJpY3MoKTtyZXR1cm59CiAgICBpZihsb2cmJmxvZy5maW5pc2hUaW1lKXtzZXRHcHNTdGF0dXMoIlJlY29ycmlkbyBmaW5hbGl6YWRvLiBHUFMgZGV0ZW5pZG8uIiwib2siKTtzdG9wUHJveGltaXR5R3BzKGZhbHNlKTtyZXR1cm59CiAgICBpZighbG9nfHwhbG9nLnN0YXJ0VGltZSl7c2V0R3BzU3RhdHVzKCJHUFMgYWN0aXZvLiBFc2NhbmVhIFNBTElEQSBwYXJhIGNvbWVuemFyLiIsIiIpO3VwZGF0ZUdwc01ldHJpY3MobnVsbCxncHNDdXJyZW50QWNjdXJhY3koKSwiU0FMSURBIMK3IFFSIik7cmV0dXJufQogICAgY29uc3QgbmV4dD1ncHNOZXh0Q29udHJvbCgpOwogICAgaWYoIW5leHQpe3NldEdwc1N0YXR1cygiTm8gc2UgZW5jdWVudHJhbiBjb29yZGVuYWRhcyB2w6FsaWRhcyBwYXJhIExMRUdBREEuIEVzY2FuZWEgc3UgUVIuIiwiZXJyIik7dXBkYXRlR3BzTWV0cmljcyhudWxsLGdwc0N1cnJlbnRBY2N1cmFjeSgpLCJMTEVHQURBIMK3IFFSIik7cmV0dXJufQogICAgaWYoZ3BzTGFzdFBvc2l0aW9uKXByb2Nlc3NHcHNQb3NpdGlvbihncHNMYXN0UG9zaXRpb24pOwogICAgZWxzZXtzZXRHcHNTdGF0dXMoIlNhbGlkYSByZWdpc3RyYWRhLiBFc3BlcmFuZG8gcG9zaWNpw7NuIEdQUy4uLiIsIiIpO3VwZGF0ZUdwc01ldHJpY3MobnVsbCxudWxsLG5leHQubGFiZWx8fG5leHQuaWQpfQp9CmZ1bmN0aW9uIHByb2Nlc3NHcHNQb3NpdGlvbihwb3MpewogICAgZ3BzTGFzdFBvc2l0aW9uPXBvczsKICAgIGNvbnN0IGFjYz1OdW1iZXIocG9zJiZwb3MuY29vcmRzJiZwb3MuY29vcmRzLmFjY3VyYWN5KXx8OTk5OTsKICAgIGlmKCFsb2d8fCFsb2cuc3RhcnRUaW1lKXsKICAgICAgICBncHNJbnNpZGVIaXRzPTA7Z3BzRmluaXNoSW5zaWRlSGl0cz0wOwogICAgICAgIHNldEdwc1N0YXR1cygiR1BTIGFjdGl2by4gRXNjYW5lYSBTQUxJREEgcGFyYSBjb21lbnphci4iLCIiKTsKICAgICAgICB1cGRhdGVHcHNNZXRyaWNzKG51bGwsYWNjLCJTQUxJREEgwrcgUVIiKTsKICAgICAgICByZXR1cm47CiAgICB9CiAgICBpZihsb2cuZmluaXNoVGltZSl7CiAgICAgICAgZ3BzSW5zaWRlSGl0cz0wO2dwc0ZpbmlzaEluc2lkZUhpdHM9MDsKICAgICAgICBzZXRHcHNTdGF0dXMoIlJlY29ycmlkbyBmaW5hbGl6YWRvLiIsIm9rIik7CiAgICAgICAgdXBkYXRlR3BzTWV0cmljcyhudWxsLGFjYywi4oCUIik7CiAgICAgICAgcmV0dXJuOwogICAgfQoKICAgIGNvbnN0IGZpbmlzaFRhcmdldD1ncHNGaW5pc2hQb2ludCgpOwogICAgbGV0IGZpbmlzaERpc3Q9bnVsbDsKICAgIGlmKGZpbmlzaFRhcmdldCl7CiAgICAgICAgZmluaXNoRGlzdD1ncHNEaXN0YW5jZU0ocG9zLmNvb3Jkcy5sYXRpdHVkZSxwb3MuY29vcmRzLmxvbmdpdHVkZSxmaW5pc2hUYXJnZXQubGF0LGZpbmlzaFRhcmdldC5sb24pOwogICAgICAgIGlmKGZpbmlzaERpc3Q+R1BTX1JBRElVU19NKzMpewogICAgICAgICAgICBncHNGaW5pc2hJbnNpZGVIaXRzPTA7CiAgICAgICAgICAgIGdwc0ZpbmlzaERlY2xpbmVkVW50aWxMZWF2ZT1mYWxzZTsKICAgICAgICB9ZWxzZSBpZihhY2M8PUdQU19NQVhfQUNDVVJBQ1lfTSYmZmluaXNoRGlzdDw9R1BTX1JBRElVU19NJiYhZ3BzRmluaXNoRGVjbGluZWRVbnRpbExlYXZlJiYhZ3BzRmluaXNoQ29uZmlybU9wZW4pewogICAgICAgICAgICBncHNGaW5pc2hJbnNpZGVIaXRzKys7CiAgICAgICAgICAgIGlmKGdwc0ZpbmlzaEluc2lkZUhpdHM+PUdQU19SRVFVSVJFRF9ISVRTJiZEYXRlLm5vdygpLWdwc0xhc3RWYWxpZGF0ZWRBdD4zNTAwKXsKICAgICAgICAgICAgICAgIGdwc0xhc3RWYWxpZGF0ZWRBdD1EYXRlLm5vdygpOwogICAgICAgICAgICAgICAgZ3BzRmluaXNoSW5zaWRlSGl0cz0wOwogICAgICAgICAgICAgICAgaGFuZGxlR3BzQXJyaXZhbERldGVjdGVkKCk7CiAgICAgICAgICAgIH0KICAgICAgICB9ZWxzZSBpZihmaW5pc2hEaXN0PkdQU19SQURJVVNfTSl7CiAgICAgICAgICAgIGdwc0ZpbmlzaEluc2lkZUhpdHM9MDsKICAgICAgICB9CiAgICAgICAgaWYoZ3BzRmluaXNoQ29uZmlybU9wZW4pewogICAgICAgICAgICB1cGRhdGVHcHNNZXRyaWNzKGZpbmlzaERpc3QsYWNjLCJMTEVHQURBIik7CiAgICAgICAgICAgIHJldHVybjsKICAgICAgICB9CiAgICB9CgogICAgY29uc3QgdGFyZ2V0PWdwc05leHRDb250cm9sKCk7CiAgICBpZighdGFyZ2V0KXsKICAgICAgICBncHNJbnNpZGVIaXRzPTA7CiAgICAgICAgaWYoZmluaXNoVGFyZ2V0KXsKICAgICAgICAgICAgc2V0R3BzU3RhdHVzKGFjYz5HUFNfTUFYX0FDQ1VSQUNZX00KICAgICAgICAgICAgICAgID8iU2lndWllbnRlIExMRUdBREEgwrcgZXNwZXJhbmRvIG1lam9yIHByZWNpc2nDs24gKMKxIitNYXRoLnJvdW5kKGFjYykrIiBtKSIKICAgICAgICAgICAgICAgIDooZ3BzRmluaXNoRGVjbGluZWRVbnRpbExlYXZlPyJMTEVHQURBIGRldGVjdGFkYSDCtyBoYXMgZWxlZ2lkbyBjb250aW51YXIgbGEgY2FycmVyYS4iOiJTaWd1aWVudGUgTExFR0FEQSDCtyBwcmVjaXNpw7NuIMKxIitNYXRoLnJvdW5kKGFjYykrIiBtIiksCiAgICAgICAgICAgICAgICBhY2M+R1BTX01BWF9BQ0NVUkFDWV9NPyIiOiJvayIpOwogICAgICAgICAgICB1cGRhdGVHcHNNZXRyaWNzKGZpbmlzaERpc3QsYWNjLCJMTEVHQURBIik7CiAgICAgICAgfWVsc2V7CiAgICAgICAgICAgIHNldEdwc1N0YXR1cygiTm8gc2UgZW5jdWVudHJhbiBjb29yZGVuYWRhcyB2w6FsaWRhcyBwYXJhIExMRUdBREEuIEVzY2FuZWEgc3UgUVIuIiwiZXJyIik7CiAgICAgICAgICAgIHVwZGF0ZUdwc01ldHJpY3MobnVsbCxhY2MsIkxMRUdBREEgwrcgUVIiKTsKICAgICAgICB9CiAgICAgICAgcmV0dXJuOwogICAgfQoKICAgIGNvbnN0IGxhYmVsPXRhcmdldC5sYWJlbHx8dGFyZ2V0LmlkOwogICAgY29uc3QgZGlzdD10YXJnZXQuaXNGaW5pc2gmJmZpbmlzaERpc3QhPW51bGw/ZmluaXNoRGlzdDpncHNEaXN0YW5jZU0ocG9zLmNvb3Jkcy5sYXRpdHVkZSxwb3MuY29vcmRzLmxvbmdpdHVkZSx0YXJnZXQubGF0LHRhcmdldC5sb24pOwogICAgaWYodGFyZ2V0LmlzRmluaXNoKXsKICAgICAgICBncHNJbnNpZGVIaXRzPTA7CiAgICAgICAgc2V0R3BzU3RhdHVzKGFjYz5HUFNfTUFYX0FDQ1VSQUNZX00KICAgICAgICAgICAgPyJTaWd1aWVudGUgTExFR0FEQSDCtyBlc3BlcmFuZG8gbWVqb3IgcHJlY2lzacOzbiAowrEiK01hdGgucm91bmQoYWNjKSsiIG0pIgogICAgICAgICAgICA6KGdwc0ZpbmlzaERlY2xpbmVkVW50aWxMZWF2ZT8iTExFR0FEQSBkZXRlY3RhZGEgwrcgaGFzIGVsZWdpZG8gY29udGludWFyIGxhIGNhcnJlcmEuIjoiU2lndWllbnRlIExMRUdBREEgwrcgcHJlY2lzacOzbiDCsSIrTWF0aC5yb3VuZChhY2MpKyIgbSIpLAogICAgICAgICAgICBhY2M+R1BTX01BWF9BQ0NVUkFDWV9NPyIiOiJvayIpOwogICAgICAgIHVwZGF0ZUdwc01ldHJpY3MoZGlzdCxhY2MsIkxMRUdBREEiKTsKICAgICAgICByZXR1cm47CiAgICB9CgogICAgaWYoZ3BzTGFzdFRhcmdldCE9PXRhcmdldC5pZCl7Z3BzSW5zaWRlSGl0cz0wO2dwc0xhc3RUYXJnZXQ9dGFyZ2V0LmlkfQogICAgaWYoYWNjPkdQU19NQVhfQUNDVVJBQ1lfTSl7CiAgICAgICAgZ3BzSW5zaWRlSGl0cz0wOwogICAgICAgIHNldEdwc1N0YXR1cygiU2lndWllbnRlICIrbGFiZWwrIiDCtyBlc3BlcmFuZG8gbWVqb3IgcHJlY2lzacOzbiAowrEiK01hdGgucm91bmQoYWNjKSsiIG0pIiwiIik7CiAgICB9ZWxzZSBpZihkaXN0PD1HUFNfUkFESVVTX00pewogICAgICAgIGdwc0luc2lkZUhpdHMrKzsKICAgICAgICBzZXRHcHNTdGF0dXMoIkRlbnRybyBkZSA3IG0gZGUgIitsYWJlbCsiIMK3IGNvbmZpcm1hbmRvICIrZ3BzSW5zaWRlSGl0cysiLyIrR1BTX1JFUVVJUkVEX0hJVFMsIm9rIik7CiAgICAgICAgaWYoZ3BzSW5zaWRlSGl0cz49R1BTX1JFUVVJUkVEX0hJVFMmJkRhdGUubm93KCktZ3BzTGFzdFZhbGlkYXRlZEF0PjM1MDApewogICAgICAgICAgICBncHNMYXN0VmFsaWRhdGVkQXQ9RGF0ZS5ub3coKTsKICAgICAgICAgICAgY29uc3QgYmVmb3JlPWdwc0NvcnJlY3RDb3VudCgpOwogICAgICAgICAgICBzY2FuQ29udHJvbCh0YXJnZXQuaWQpOwogICAgICAgICAgICBpZihncHNDb3JyZWN0Q291bnQoKT5iZWZvcmUpZ3BzVmFsaWRhdGVkKHRhcmdldC5pZCk7CiAgICAgICAgICAgIGdwc0luc2lkZUhpdHM9MDtncHNMYXN0VGFyZ2V0PSIiOwogICAgICAgIH0KICAgIH1lbHNlewogICAgICAgIGdwc0luc2lkZUhpdHM9MDsKICAgICAgICBzZXRHcHNTdGF0dXMoIlNpZ3VpZW50ZSAiK2xhYmVsKyIgwrcgcHJlY2lzacOzbiDCsSIrTWF0aC5yb3VuZChhY2MpKyIgbSIsIm9rIik7CiAgICB9CiAgICB1cGRhdGVHcHNNZXRyaWNzKGRpc3QsYWNjLGxhYmVsKTsKfQpmdW5jdGlvbiBncHNFcnJvcihlcnIpe2NvbnN0IGRlbmllZD1lcnImJmVyci5jb2RlPT09MSxtc2c9ZGVuaWVkPyJQZXJtaXNvIGRlIHViaWNhY2nDs24gZGVuZWdhZG8uIEFjdGl2YSB1YmljYWNpw7NuIHByZWNpc2EuIjplcnImJmVyci5jb2RlPT09Mj8iTm8gc2UgcHVlZGUgb2J0ZW5lciBsYSB1YmljYWNpw7NuLiBSZXZpc2EgZWwgR1BTLiI6IkVsIEdQUyB0YXJkYSBkZW1hc2lhZG8uIE1hbnTDqW4gTUlMSVRPUE8gYWJpZXJ0YS4iO2lmKGRlbmllZCl7aWYoZ3BzV2F0Y2hJZCE9PW51bGwpe3RyeXtuYXZpZ2F0b3IuZ2VvbG9jYXRpb24uY2xlYXJXYXRjaChncHNXYXRjaElkKX1jYXRjaChlKXt9Z3BzV2F0Y2hJZD1udWxsfWdwc1dyaXRlUHJlZihHUFNfUFJFRl9QUkVGSVgsZmFsc2UpO2dwc1NldEJ1dHRvbihmYWxzZSl9c2V0R3BzU3RhdHVzKG1zZywiZXJyIil9CmFzeW5jIGZ1bmN0aW9uIHN0YXJ0UHJveGltaXR5R3BzKHJlbWVtYmVyPXRydWUpe2lmKCFyb3V0ZSlyZXR1cm4gdG9hc3QoIkNhcmdhIHByaW1lcm8gdHUgcmVjb3JyaWRvIik7aWYoIW5hdmlnYXRvci5nZW9sb2NhdGlvbil7Z3BzV3JpdGVQcmVmKEdQU19QUkVGX1BSRUZJWCxmYWxzZSk7Z3BzU2V0QnV0dG9uKGZhbHNlKTtzZXRHcHNTdGF0dXMoIkVzdGUgZGlzcG9zaXRpdm8gbm8gcGVybWl0ZSBnZW9sb2NhbGl6YWNpw7NuLiIsImVyciIpO3JldHVybn1pZihyZW1lbWJlcilncHNXcml0ZVByZWYoR1BTX1BSRUZfUFJFRklYLHRydWUpO2lmKGdwc1dhdGNoSWQhPT1udWxsKXtncHNTZXRCdXR0b24odHJ1ZSk7Z3BzUmVmcmVzaFN0YXRlKCk7cmV0dXJufXNldEdwc1N0YXR1cygiU29saWNpdGFuZG8gcGVybWlzbyBkZSB1YmljYWNpw7NuIHByZWNpc2EuLi4iLCIiKTthd2FpdCByZXF1ZXN0R3BzV2FrZUxvY2soKTt0cnl7Z3BzV2F0Y2hJZD1uYXZpZ2F0b3IuZ2VvbG9jYXRpb24ud2F0Y2hQb3NpdGlvbihwcm9jZXNzR3BzUG9zaXRpb24sZ3BzRXJyb3Ise2VuYWJsZUhpZ2hBY2N1cmFjeTp0cnVlLG1heGltdW1BZ2U6MTAwMCx0aW1lb3V0OjE1MDAwfSk7Z3BzU2V0QnV0dG9uKHRydWUpO3VwZGF0ZUdwc01ldHJpY3MoKTtncHNSZWZyZXNoU3RhdGUoKX1jYXRjaChlKXtncHNXYXRjaElkPW51bGw7Z3BzV3JpdGVQcmVmKEdQU19QUkVGX1BSRUZJWCxmYWxzZSk7Z3BzU2V0QnV0dG9uKGZhbHNlKTtzZXRHcHNTdGF0dXMoIk5vIHNlIHB1ZG8gcmVhY3RpdmFyIGVsIEdQUy4gUHVsc2EgQUNUSVZBUiBHUFMuIiwiZXJyIil9fQpmdW5jdGlvbiBzdG9wUHJveGltaXR5R3BzKHNob3cscmVtZW1iZXI9dHJ1ZSl7aWYoZ3BzV2F0Y2hJZCE9PW51bGwpe25hdmlnYXRvci5nZW9sb2NhdGlvbi5jbGVhcldhdGNoKGdwc1dhdGNoSWQpO2dwc1dhdGNoSWQ9bnVsbH1pZihyZW1lbWJlcilncHNXcml0ZVByZWYoR1BTX1BSRUZfUFJFRklYLGZhbHNlKTtncHNJbnNpZGVIaXRzPTA7Z3BzTGFzdFRhcmdldD0iIjtyZWxlYXNlR3BzV2FrZUxvY2soKTtncHNTZXRCdXR0b24oZmFsc2UpO2lmKHNob3cpc2V0R3BzU3RhdHVzKCJHUFMgZGV0ZW5pZG8uIEVsIGVzY2FuZW8gUVIgc2lndWUgZGlzcG9uaWJsZS4iLCIiKTt1cGRhdGVHcHNNZXRyaWNzKCl9CmZ1bmN0aW9uIGxvY2tSYWNlU2NyZWVuKHJlbWVtYmVyPXRydWUpe2lmKHJlbWVtYmVyKWdwc1dyaXRlUHJlZihHUFNfTE9DS19QUkVGX1BSRUZJWCx0cnVlKTtyZXF1ZXN0R3BzV2FrZUxvY2soKTtpZihncHNFbCgiZ3BzTG9ja092ZXJsYXkiKSlncHNFbCgiZ3BzTG9ja092ZXJsYXkiKS5jbGFzc0xpc3QuYWRkKCJvcGVuIik7ZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsYXNzTGlzdC5hZGQoImdwcy1sb2NrZWQiKTtncHNSZWZyZXNoU3RhdGUoKX0KZnVuY3Rpb24gdW5sb2NrUmFjZVNjcmVlbihyZW1lbWJlcj10cnVlKXtjbGVhclRpbWVvdXQoZ3BzVW5sb2NrVGltZXIpO2dwc1VubG9ja1RpbWVyPW51bGw7aWYocmVtZW1iZXIpZ3BzV3JpdGVQcmVmKEdQU19MT0NLX1BSRUZfUFJFRklYLGZhbHNlKTtpZihncHNFbCgiZ3BzTG9ja092ZXJsYXkiKSlncHNFbCgiZ3BzTG9ja092ZXJsYXkiKS5jbGFzc0xpc3QucmVtb3ZlKCJvcGVuIik7ZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmNsYXNzTGlzdC5yZW1vdmUoImdwcy1sb2NrZWQiKX0KZnVuY3Rpb24gYmluZEdwc1VubG9jaygpe2NvbnN0IGI9Z3BzRWwoImdwc1VubG9ja0J0biIpO2lmKCFiKXJldHVybjtjb25zdCBzdGFydD0oKT0+e2NsZWFyVGltZW91dChncHNVbmxvY2tUaW1lcik7Yi5jbGFzc0xpc3QuYWRkKCJob2xkaW5nIik7Z3BzVW5sb2NrVGltZXI9c2V0VGltZW91dCgoKT0+e2IuY2xhc3NMaXN0LnJlbW92ZSgiaG9sZGluZyIpO3VubG9ja1JhY2VTY3JlZW4oKX0sMjIwMCl9LGNhbmNlbD0oKT0+e2NsZWFyVGltZW91dChncHNVbmxvY2tUaW1lcik7Z3BzVW5sb2NrVGltZXI9bnVsbDtiLmNsYXNzTGlzdC5yZW1vdmUoImhvbGRpbmciKX07WyJwb2ludGVyZG93biIsInRvdWNoc3RhcnQiXS5mb3JFYWNoKGU9PmIuYWRkRXZlbnRMaXN0ZW5lcihlLHN0YXJ0LHtwYXNzaXZlOnRydWV9KSk7WyJwb2ludGVydXAiLCJwb2ludGVyY2FuY2VsIiwicG9pbnRlcmxlYXZlIiwidG91Y2hlbmQiLCJ0b3VjaGNhbmNlbCJdLmZvckVhY2goZT0+Yi5hZGRFdmVudExpc3RlbmVyKGUsY2FuY2VsLHtwYXNzaXZlOnRydWV9KSl9CmRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoInZpc2liaWxpdHljaGFuZ2UiLCgpPT57aWYoZG9jdW1lbnQudmlzaWJpbGl0eVN0YXRlPT09InZpc2libGUiKXtpZihncHNXYXRjaElkIT09bnVsbHx8Z3BzUmVhZFByZWYoR1BTX0xPQ0tfUFJFRl9QUkVGSVgpKXJlcXVlc3RHcHNXYWtlTG9jaygpO2lmKGdwc1dhdGNoSWQ9PT1udWxsJiZncHNSZWFkUHJlZihHUFNfUFJFRl9QUkVGSVgpJiZyb3V0ZSlzZXRUaW1lb3V0KCgpPT5zdGFydFByb3hpbWl0eUdwcyhmYWxzZSksODApfX0pO3dpbmRvdy5hZGRFdmVudExpc3RlbmVyKCJwYWdlaGlkZSIsKCk9PnN0b3BQcm94aW1pdHlHcHMoZmFsc2UsZmFsc2UpKTtzZXRUaW1lb3V0KGJpbmRHcHNVbmxvY2ssMCk7CgpmdW5jdGlvbiBoYW5kbGVRcihyYXcpewogICAgY29uc3QgcT1wYXJzZShyYXcpOwogICAgaWYoIXEub2spcmV0dXJuIHRvYXN0KCJRUiBubyB2w6FsaWRvIik7CiAgICBpZihxLnR5cGU9PT0iUEFSVElDSVBBTlQifHxxLnR5cGU9PT0iUEFSVCIpewogICAgICAgIGlmKHEuZXZlbnREYXRhKWltcG9ydFBhcnRpY2lwYW50RXZlbnREYXRhKHEuZXZlbnREYXRhKTsKICAgICAgICBpZihxLmV2ZW50SWQmJkVWRU5UX0RBVEEuZXZlbnRJZCYmcS5ldmVudElkIT09RVZFTlRfREFUQS5ldmVudElkKXJldHVybiB0b2FzdCgiUVIgZGUgb3RybyBldmVudG8iKTsKICAgICAgICByZXR1cm4gbG9hZFBhcnRpY2lwYW50KHEpOwogICAgfQogICAgaWYocS5ldmVudElkIT09RVZFTlRfREFUQS5ldmVudElkKXJldHVybiB0b2FzdCgiUVIgZGUgb3RybyBldmVudG8iKTsKICAgIGlmKHEudHlwZT09PSJDT05UUk9MIilyZXR1cm4gc2NhbkNvbnRyb2wocS5pZCk7CiAgICB0b2FzdCgiUVIgbm8gcmVjb25vY2lkbyIpCn0KZnVuY3Rpb24gbG9hZFBhcnRpY2lwYW50KHEpewogICAgaWYocS5ldmVudERhdGEpaW1wb3J0UGFydGljaXBhbnRFdmVudERhdGEocS5ldmVudERhdGEpOwogICAgcm91dGU9RVZFTlRfREFUQS5yb3V0ZXMuZmluZChyPT5yLnBhcnRpY2lwYW50SWQ9PT1xLmlkJiYoIXEucm91dGVJZHx8ci5yb3V0ZUlkPT09cS5yb3V0ZUlkKSl8fEVWRU5UX0RBVEEucm91dGVzLmZpbmQocj0+ci5wYXJ0aWNpcGFudElkPT09cS5pZCl8fChFVkVOVF9EQVRBLnJvdXRlcy5sZW5ndGg9PT0xP0VWRU5UX0RBVEEucm91dGVzWzBdOm51bGwpOwogICAgaWYoIXJvdXRlKXJldHVybiB0b2FzdCgiUGFydGljaXBhbnRlIG5vIGVuY29udHJhZG8iKTsKICAgIHBpZD1yb3V0ZS5wYXJ0aWNpcGFudElkfHxxLmlkOwogICAgY29uc3QgY2FuZGlkYXRlcz1hbGxSZWNvdmVyeUtleXMocGlkKS5tYXAocmVhZEpzb25LZXkpOwogICAgbG9nPWNob29zZUJlc3RMb2coY2FuZGlkYXRlcyk7CiAgICBpZighbG9nKWxvZz17ZXZlbnRJZDpFVkVOVF9EQVRBLmV2ZW50SWQscGFydGljaXBhbnRJZDpwaWQscm91dGVJZDpyb3V0ZS5yb3V0ZUlkLHN0YXJ0VGltZTpudWxsLGZpbmlzaFRpbWU6bnVsbCxzY2FuczpbXSxjb21wbGV0ZWQ6ZmFsc2UsbWlzc2luZ0NvbnRyb2xzOltdfTsKICAgIGxvZy5ldmVudElkPUVWRU5UX0RBVEEuZXZlbnRJZDsKICAgIGxvZy5wYXJ0aWNpcGFudElkPXBpZDsKICAgIGxvZy5yb3V0ZUlkPXJvdXRlLnJvdXRlSWQ7CiAgICBzYXZlKCk7CiAgICByZW5kZXJMb2FkZWQoKTsKICAgIGVuc3VyZU9mZmxpbmVQYWdlQXZhaWxhYmxlKCk7CiAgICB0cnl7c3RvcFFyQ2FtZXJhKCl9Y2F0Y2goZSl7fTsKICAgIHNldFRpbWVvdXQoKCk9Pnt0cnl7ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoInJhY2UiKT8uc2Nyb2xsSW50b1ZpZXcoe2JlaGF2aW9yOiJzbW9vdGgiLGJsb2NrOiJzdGFydCJ9KX1jYXRjaChlKXt9fSwxNTApOwogICAgbm90aWZ5TWlsaXRvcG9MaXZlKCJSRUFEWSIpOwogICAgdG9hc3QoIlJlY29ycmlkbyBjYXJnYWRvIHkgZ3VhcmRhZG8gb2ZmbGluZSIpCn0KCmZ1bmN0aW9uIHJlc3RvcmVCZXN0U2F2ZWRSdW4oc2lsZW50KXsKICAgIGNvbnN0IGd1ZXNzZXM9W3JlYWRXaW5kb3dOYW1lQmFja3VwKCkscmVhZE1lbW9yeUJhY2t1cCgpXTsKICAgIHRyeXtndWVzc2VzLnB1c2gocmVhZEpzb25LZXkoa2V5KCkpLHJlYWRKc29uS2V5KGtleSgpKyJfYWN0aXZlIikscmVhZEpzb25LZXkoa2V5KCkrIl9iYWNrdXBfbGFzdCIpLHJlYWRKc29uS2V5KGtleSgpKyJfZW1lcmdlbmN5X2xhc3QiKSl9Y2F0Y2goZSl7fQogICAgKEVWRU5UX0RBVEEucm91dGVzfHxbXSkuZm9yRWFjaChyPT5hbGxSZWNvdmVyeUtleXMoci5wYXJ0aWNpcGFudElkKS5mb3JFYWNoKGs9Pmd1ZXNzZXMucHVzaChyZWFkSnNvbktleShrKSkpKTsKICAgIGNvbnN0IGJlc3Q9Y2hvb3NlQmVzdExvZyhndWVzc2VzKTsKICAgIGlmKCFiZXN0KXtpZighc2lsZW50KXRvYXN0KCJObyBoYXkgcmVjb3JyaWRvIGd1YXJkYWRvIGVuIGVzdGUgbcOzdmlsIik7cmV0dXJuIGZhbHNlfQogICAgcGlkPWJlc3QucGFydGljaXBhbnRJZDsKICAgIHJvdXRlPUVWRU5UX0RBVEEucm91dGVzLmZpbmQocj0+ci5wYXJ0aWNpcGFudElkPT09cGlkJiYoIWJlc3Qucm91dGVJZHx8ci5yb3V0ZUlkPT09YmVzdC5yb3V0ZUlkKSl8fEVWRU5UX0RBVEEucm91dGVzLmZpbmQocj0+ci5wYXJ0aWNpcGFudElkPT09cGlkKTsKICAgIGlmKCFyb3V0ZSl7aWYoIXNpbGVudCl0b2FzdCgiTm8gc2UgZW5jdWVudHJhIGVsIHJlY29ycmlkbyBndWFyZGFkbyIpO3JldHVybiBmYWxzZX0KICAgIGxvZz1iZXN0O3NhdmUoKTtyZW5kZXJMb2FkZWQoKTtub3RpZnlNaWxpdG9wb0xpdmUoIlJFQURZIik7aWYoIXNpbGVudCl0b2FzdCgiUmVjb3JyaWRvIHJlc3RhdXJhZG8gY29ycmVjdGFtZW50ZSIpO3JldHVybiB0cnVlOwp9CgpmdW5jdGlvbiByZW5kZXJMb2FkZWQoKXtkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgicmFjZSIpLnN0eWxlLmRpc3BsYXk9ImJsb2NrIjtjb25zdCBncHNDYXJkPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJncHNQcm94aW1pdHkiKTtpZihncHNDYXJkKWdwc0NhcmQuc3R5bGUuZGlzcGxheT0iYmxvY2siO2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJpZGVudGl0eSIpLmNsYXNzTmFtZT0ic3RhdHVzIG9rIjtkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgiaWRlbnRpdHkiKS5pbm5lckhUTUw9IjxiPiIrcGlkKyI8L2I+IMK3ICIrcm91dGUucm91dGVJZCsiIGNhcmdhZG8iO2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJyb3V0ZSIpLmlubmVySFRNTD0iPGI+T3JkZW4gb2JsaWdhdG9yaW88L2I+PGJyPjxkaXYgY2xhc3M9J3JvdXRlJz4iK3JvdXRlLnBvaW50cy5qb2luKCIg4oaSICIpKyI8L2Rpdj4iO2NvbnN0IGxvYWRCdG49ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoImxvYWRQYXJ0aWNpcGFudFFyQnRuIik7aWYobG9hZEJ0bilsb2FkQnRuLnN0eWxlLmRpc3BsYXk9Im5vbmUiO3JlbmRlck5leHQoKTtyZW5kZXJTY2FucygpO3JlbmRlclJlc3VsdCgpO3VwZGF0ZU9mZmxpbmVTYWZldHlQYW5lbCgiUkVDT1JSSURPIEdVQVJEQURPIEVOIEVTVEUgTcOTVklMIik7Z3BzUmVmcmVzaFN0YXRlKCk7cmVzdG9yZUdwc1ByZWZlcmVuY2VzKCl9CmZ1bmN0aW9uIHNjYW5Db250cm9sKGlkKXtpZighcm91dGUpcmV0dXJuIHRvYXN0KCJQcmltZXJvIFFSIHBhcnRpY2lwYW50ZSIpO2lmKGlkPT09IlNUQVJUIilyZXR1cm4gc3RhcnRSYWNlKCk7aWYoaWQ9PT0iRklOSVNIIilyZXR1cm4gZmluaXNoUmFjZSgpO2lmKCFsb2cuc3RhcnRUaW1lKXJldHVybiB0b2FzdCgiUHJpbWVybyBTQUxJREEiKTtpZihsb2cuZmluaXNoVGltZSlyZXR1cm4gdG9hc3QoIllhIGZpbmFsaXphZG8iKTtjb25zdCBleHA9cm91dGUucG9pbnRzLmZpbHRlcih4PT54IT09IlNUQVJUIiYmeCE9PSJGSU5JU0giKTtjb25zdCBkb25lPWxvZy5zY2Fucy5maWx0ZXIocz0+cy5zdGF0dXM9PT0iY29ycmVjdCIpLmxlbmd0aDtjb25zdCBleHBlY3RlZD1leHBbZG9uZV18fCJGSU5JU0giO2NvbnN0IGR1cD1sb2cuc2NhbnMuc29tZShzPT5zLmNvbnRyb2xJZD09PWlkKTtsZXQgc3RhdHVzPWR1cD8iZHVwbGljYXRlIjppZD09PWV4cGVjdGVkPyJjb3JyZWN0IjpleHAuaW5jbHVkZXMoaWQpPyJvdXRfb2Zfb3JkZXIiOiJ3cm9uZyI7bG9nLnNjYW5zLnB1c2goe2NvbnRyb2xJZDppZCx0aW1lc3RhbXA6bmV3IERhdGUoKS50b0lTT1N0cmluZygpLGV4cGVjdGVkQ29udHJvbElkOmV4cGVjdGVkLHN0YXR1c30pO3NhdmUoKTtyZW5kZXJOZXh0KCk7cmVuZGVyU2NhbnMoKTtub3RpZnlNaWxpdG9wb0xpdmUoIkNPTlRST0wiLHtzY2FuU3RhdHVzOnN0YXR1c30pO2dwc1JlZnJlc2hTdGF0ZSgpO3RvYXN0KHNjYW5TdGF0dXNNZXNzYWdlKHN0YXR1cyxleHBlY3RlZCkpfQpmdW5jdGlvbiBzY2FuU3RhdHVzTGFiZWwoc3RhdHVzKXtyZXR1cm4ge2NvcnJlY3Q6IkNvcnJlY3RvIixvdXRfb2Zfb3JkZXI6IkZ1ZXJhIGRlIG9yZGVuIix3cm9uZzoiSW5jb3JyZWN0byIsZHVwbGljYXRlOiJEdXBsaWNhZG8ifVtTdHJpbmcoc3RhdHVzfHwiIildfHwiRXN0YWRvIGRlc2Nvbm9jaWRvIn0KZnVuY3Rpb24gc2NhblN0YXR1c01lc3NhZ2Uoc3RhdHVzLGV4cGVjdGVkKXtyZXR1cm4ge2NvcnJlY3Q6IkJhbGl6YSBjb3JyZWN0YSIsb3V0X29mX29yZGVyOiJGdWVyYSBkZSBvcmRlbi4gVG9jYWJhICIrZXhwZWN0ZWQsd3Jvbmc6IkJhbGl6YSBpbmNvcnJlY3RhOiBubyBwZXJ0ZW5lY2UgYSB0dSByZWNvcnJpZG8iLGR1cGxpY2F0ZToiQmFsaXphIGR1cGxpY2FkYSJ9W1N0cmluZyhzdGF0dXN8fCIiKV18fCJCYWxpemEgcmVnaXN0cmFkYSJ9CmZ1bmN0aW9uIHN0YXJ0UmFjZSgpewogICAgaWYoIXJvdXRlKXJldHVybiB0b2FzdCgiUHJpbWVybyBRUiBwYXJ0aWNpcGFudGUiKTsKICAgIGlmKGxvZy5zdGFydFRpbWUpcmV0dXJuIHRvYXN0KCJTYWxpZGEgeWEgcmVnaXN0cmFkYSIpOwogICAgbG9nLnN0YXJ0VGltZT1uZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCk7CiAgICBzYXZlKCk7cmVuZGVyTmV4dCgpO3JlbmRlclNjYW5zKCk7bm90aWZ5TWlsaXRvcG9MaXZlKCJTVEFSVCIpO2dwc1JlZnJlc2hTdGF0ZSgpO3RvYXN0KCJTYWxpZGEgcmVnaXN0cmFkYSIpOwogICAgaWYoZ3BzV2F0Y2hJZD09PW51bGwpc2V0VGltZW91dChzaG93R3BzU3RhcnRSZW1pbmRlciwxODApOwp9CmFzeW5jIGZ1bmN0aW9uIGZpbmlzaFJhY2Uoc291cmNlPSJxciIpewogICAgaWYoIXJvdXRlKXJldHVybiB0b2FzdCgiUHJpbWVybyBRUiBwYXJ0aWNpcGFudGUiKTsKICAgIGlmKCFsb2cuc3RhcnRUaW1lKXJldHVybiB0b2FzdCgiUHJpbWVybyBTQUxJREEiKTsKICAgIGlmKGxvZy5maW5pc2hUaW1lKXJldHVybiB0b2FzdCgiTGxlZ2FkYSB5YSByZWdpc3RyYWRhIik7CiAgICBjb25zdCBieUdwcz1zb3VyY2U9PT0iZ3BzIjsKICAgIGlmKGJ5R3BzKXtjbG9zZUdwc0Fycml2YWxDb25maXJtKCk7Y2xvc2VHcHNTdGFydFJlbWluZGVyKCk7Z3BzRmluaXNoRGVjbGluZWRVbnRpbExlYXZlPWZhbHNlO2dwc0ZpbmlzaEluc2lkZUhpdHM9MDt1bmxvY2tSYWNlU2NyZWVuKHRydWUpO30KICAgIGNvbnN0IGV4cD1yb3V0ZS5wb2ludHMuZmlsdGVyKHg9PnghPT0iU1RBUlQiJiZ4IT09IkZJTklTSCIpOwogICAgY29uc3QgZG9uZT1sb2cuc2NhbnMuZmlsdGVyKHM9PnMuc3RhdHVzPT09ImNvcnJlY3QiKS5tYXAocz0+cy5jb250cm9sSWQpOwogICAgbG9nLm1pc3NpbmdDb250cm9scz1leHAuZmlsdGVyKHg9PiFkb25lLmluY2x1ZGVzKHgpKTsKICAgIGxvZy5maW5pc2hUaW1lPW5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTsKICAgIGxvZy5jb21wbGV0ZWQ9bG9nLm1pc3NpbmdDb250cm9scy5sZW5ndGg9PT0wOwogICAgbG9nLnJlc3VsdFBheWxvYWQ9cmVzdWx0UGF5bG9hZCgpOwogICAgaWYoYnlHcHMpbG9nLmZpbmlzaFNvdXJjZT0iZ3BzIjsKICAgIHNhdmUoKTtyZW5kZXJOZXh0KCk7cmVuZGVyU2NhbnMoKTthd2FpdCByZW5kZXJSZXN1bHQoKTsKICAgIGxvZy5yZXN1bHRQYXlsb2FkPXJlc3VsdFBheWxvYWQoKTsKICAgIHNhdmUoKTsKICAgIG5vdGlmeU1pbGl0b3BvTGl2ZSgiRklOSVNIIix7cmVzdWx0Q29kZToiT1JJfFJFU1VMVHwiK0VWRU5UX0RBVEEuZXZlbnRJZCsifCIrcGlkKyJ8Iitsb2cucmVzdWx0UGF5bG9hZH0pOwogICAgc2V0R3BzU3RhdHVzKCJSZWNvcnJpZG8gZmluYWxpemFkby4gR1BTIGRldGVuaWRvLiIsIm9rIik7c3RvcFByb3hpbWl0eUdwcyhmYWxzZSk7CiAgICBjb25zdCByZXN1bHRTZWM9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoInJlc3VsdCIpOwogICAgaWYocmVzdWx0U2VjKXtyZXN1bHRTZWMuc3R5bGUuZGlzcGxheT0iYmxvY2siO3Jlc3VsdFNlYy5jbGFzc0xpc3QuYWRkKCJyZXN1bHQtb3BlbiIpO2lmKCFieUdwcylyZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKCk9PnNldFRpbWVvdXQoKCk9Pnt0cnl7cmVzdWx0U2VjLnNjcm9sbEludG9WaWV3KHtiZWhhdmlvcjoic21vb3RoIixibG9jazoic3RhcnQifSl9Y2F0Y2goZSl7d2luZG93LnNjcm9sbFRvKHt0b3A6cmVzdWx0U2VjLm9mZnNldFRvcCxiZWhhdmlvcjoic21vb3RoIn0pfX0sMTIwKSl9CiAgICBpZihwYXJ0aWNpcGFudExpdmVTeW5jU3RhdGU9PT0ib2ZmbGluZSIpc2hvd0dwc0ZpbmlzaE5vdGljZSgib2ZmbGluZSIpOwogICAgZWxzZSBpZihwYXJ0aWNpcGFudExpdmVTeW5jU3RhdGU9PT0iaW5hY3RpdmUiKXNob3dHcHNGaW5pc2hOb3RpY2UoImluYWN0aXZlIik7CiAgICBlbHNlIGlmKGJ5R3BzKXNob3dHcHNGaW5pc2hOb3RpY2UoInBlbmRpbmciKTsKICAgIGlmKGJ5R3BzKXsKICAgICAgICB0b2FzdCgiTGxlZ2FkYSByZWdpc3RyYWRhIHBvciBHUFMuIEhhcyB0ZXJtaW5hZG8gbGEgY2FycmVyYS4iKTsKICAgIH1lbHNlewogICAgICAgIHRvYXN0KGxvZy5jb21wbGV0ZWQ/IkxsZWdhZGEgcmVnaXN0cmFkYS4gRW5zZcOxYSBlbCBRUiBmaW5hbCBhbCBvcmdhbml6YWRvciI6IkxsZWdhZGEgcmVnaXN0cmFkYSBjb24gYXZpc29zLiBFbnNlw7FhIGVsIFFSIGZpbmFsIGFsIG9yZ2FuaXphZG9yIik7CiAgICB9Cn0KZnVuY3Rpb24gc2F2ZSgpewogICAgaWYoIWxvZ3x8IXBpZClyZXR1cm47CiAgICB0cnl7CiAgICAgICAgbG9nLmV2ZW50SWQ9RVZFTlRfREFUQS5ldmVudElkOwogICAgICAgIGxvZy5wYXJ0aWNpcGFudElkPXBpZDsKICAgICAgICBpZihyb3V0ZSlsb2cucm91dGVJZD1yb3V0ZS5yb3V0ZUlkOwogICAgICAgIGlmKCFBcnJheS5pc0FycmF5KGxvZy5zY2FucykpbG9nLnNjYW5zPVtdOwogICAgICAgIGlmKCFBcnJheS5pc0FycmF5KGxvZy5taXNzaW5nQ29udHJvbHMpKWxvZy5taXNzaW5nQ29udHJvbHM9W107CiAgICAgICAgaWYobG9nLmZpbmlzaFRpbWUmJiFsb2cucmVzdWx0UGF5bG9hZCYmcm91dGUpbG9nLnJlc3VsdFBheWxvYWQ9cmVzdWx0UGF5bG9hZCgpOwogICAgICAgIGxvZy5sYXN0U2F2ZWRBdD1zYWZlTm93KCk7CiAgICAgICAgbG9nLmFwcFZlcnNpb249QVBQX1ZFUlNJT047CiAgICAgICAgY29uc3QgcmF3PUpTT04uc3RyaW5naWZ5KGxvZyk7CiAgICAgICAgd3JpdGVLZXlFdmVyeXdoZXJlKGtleSgpKyJfIitwaWQscmF3KTsKICAgICAgICB3cml0ZUtleUV2ZXJ5d2hlcmUoa2V5KCkscmF3KTsKICAgICAgICB3cml0ZUtleUV2ZXJ5d2hlcmUoa2V5KCkrIl9hY3RpdmUiLHJhdyk7CiAgICAgICAgd3JpdGVLZXlFdmVyeXdoZXJlKGtleSgpKyJfYmFja3VwXyIrcGlkLHJhdyk7CiAgICAgICAgd3JpdGVLZXlFdmVyeXdoZXJlKGtleSgpKyJfYmFja3VwX2xhc3QiLHJhdyk7CiAgICAgICAgd3JpdGVLZXlFdmVyeXdoZXJlKGtleSgpKyJfZW1lcmdlbmN5XyIrcGlkLHJhdyk7CiAgICAgICAgd3JpdGVLZXlFdmVyeXdoZXJlKGtleSgpKyJfZW1lcmdlbmN5X2xhc3QiLHJhdyk7CiAgICAgICAgd3JpdGVLZXlFdmVyeXdoZXJlKGtleSgpKyJfY2hlY2twb2ludF8iK3BpZCxyYXcpOwogICAgfWNhdGNoKGUpewogICAgICAgIGNvbnNvbGUud2FybigiTm8gc2UgcHVkbyBndWFyZGFyIHJlZ2lzdHJvIG9mZmxpbmUiLGUpOwogICAgfQogICAgdXBkYXRlT2ZmbGluZVNhZmV0eVBhbmVsKCk7Cn0KZnVuY3Rpb24gcmVuZGVyTmV4dCgpe2NvbnN0IG49ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoIm5leHQiKTtpZighbG9nLnN0YXJ0VGltZSl7bi50ZXh0Q29udGVudD0iVEUgVE9DQTogU0FMSURBIjtyZXR1cm59aWYobG9nLmZpbmlzaFRpbWUpe24udGV4dENvbnRlbnQ9bG9nLmNvbXBsZXRlZD8iRklOQUxJWkFETyBPSyI6IkZJTkFMSVpBRE8gQ09OIEFWSVNPUyI7cmV0dXJufWNvbnN0IGV4cD1yb3V0ZS5wb2ludHMuZmlsdGVyKHg9PnghPT0iU1RBUlQiJiZ4IT09IkZJTklTSCIpO2NvbnN0IGRvbmU9bG9nLnNjYW5zLmZpbHRlcihzPT5zLnN0YXR1cz09PSJjb3JyZWN0IikubGVuZ3RoO24udGV4dENvbnRlbnQ9IlRFIFRPQ0E6ICIrKGV4cFtkb25lXXx8IkZJTklTSCIpfQpmdW5jdGlvbiByZW5kZXJTY2Fucygpe2xldCBoPSI8ZGl2IGNsYXNzPSdzY2FuICIrKGxvZy5zdGFydFRpbWU/Im9rIjoiIikrIic+PGI+U0FMSURBPC9iPjxzcGFuPiIrKGxvZy5zdGFydFRpbWU/dG0obG9nLnN0YXJ0VGltZSk6IlBlbmRpZW50ZSIpKyI8L3NwYW4+PHNwYW4+IisobG9nLnN0YXJ0VGltZT8i4pyFIjoi4o+zIikrIjwvc3Bhbj48L2Rpdj4iO2xvZy5zY2Fucy5mb3JFYWNoKHM9Pntjb25zdCBjbHM9cy5zdGF0dXM9PT0iY29ycmVjdCI/Im9rIjoiYmFkIjtoKz0iPGRpdiBjbGFzcz0nc2NhbiAiK2NscysiJz48Yj4iK3MuY29udHJvbElkKyI8L2I+PHNwYW4+Iit0bShzLnRpbWVzdGFtcCkrIiDCtyB0b2NhYmEgIitzLmV4cGVjdGVkQ29udHJvbElkKyIgwrcgIitzY2FuU3RhdHVzTGFiZWwocy5zdGF0dXMpKyI8L3NwYW4+PHNwYW4+Iisocy5zdGF0dXM9PT0iY29ycmVjdCI/IuKchSI6IuKaoO+4jyIpKyI8L3NwYW4+PC9kaXY+In0pO2grPSI8ZGl2IGNsYXNzPSdzY2FuICIrKGxvZy5maW5pc2hUaW1lPyhsb2cuY29tcGxldGVkPyJvayI6ImJhZCIpOiIiKSsiJz48Yj5MTEVHQURBPC9iPjxzcGFuPiIrKGxvZy5maW5pc2hUaW1lP3RtKGxvZy5maW5pc2hUaW1lKToiUGVuZGllbnRlIikrIjwvc3Bhbj48c3Bhbj4iKyhsb2cuZmluaXNoVGltZT8i8J+PgSI6IuKPsyIpKyI8L3NwYW4+PC9kaXY+Ijtkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgic2NhbnMiKS5pbm5lckhUTUw9aH0KCmZ1bmN0aW9uIGVuY1Jlc3VsdFRpbWUodil7Y29uc3QgbXM9RGF0ZS5wYXJzZSh2KTtyZXR1cm4gTnVtYmVyLmlzRmluaXRlKG1zKT9tcy50b1N0cmluZygzNik6KHZ8fG51bGwpfQpmdW5jdGlvbiBlbmNSZXN1bHRTdGF0dXMocyl7cmV0dXJuIHtjb3JyZWN0OiJjIixvdXRfb2Zfb3JkZXI6Im8iLHdyb25nOiJ3IixkdXBsaWNhdGU6ImQifVtTdHJpbmcoc3x8IiIpXXx8U3RyaW5nKHN8fCIiKX0KZnVuY3Rpb24gY29tcGFjdFJlc3VsdE9iamVjdChwYXJ0aWFsPWZhbHNlKXsKICAgIHJldHVybiB7CiAgICAgICAgdjozLAogICAgICAgIHI6cm91dGUucm91dGVJZCwKICAgICAgICBzdDplbmNSZXN1bHRUaW1lKGxvZy5zdGFydFRpbWUpLAogICAgICAgIGZ0OmVuY1Jlc3VsdFRpbWUobG9nLmZpbmlzaFRpbWUpLAogICAgICAgIGM6ISFsb2cuY29tcGxldGVkLAogICAgICAgIHB0bDohIXBhcnRpYWwsCiAgICAgICAgeDoobG9nLnNjYW5zfHxbXSkubWFwKHM9PltzLmNvbnRyb2xJZCxlbmNSZXN1bHRUaW1lKHMudGltZXN0YW1wKSxlbmNSZXN1bHRTdGF0dXMocy5zdGF0dXMpXSksCiAgICAgICAgbTpsb2cubWlzc2luZ0NvbnRyb2xzfHxbXSwKICAgICAgICBsczplbmNSZXN1bHRUaW1lKGxvZy5sYXN0U2F2ZWRBdHx8c2FmZU5vdygpKQogICAgfTsKfQpmdW5jdGlvbiBlbmNvZGVSZXN1bHRPYmplY3Qob2JqKXsKICAgIHJldHVybiBidG9hKHVuZXNjYXBlKGVuY29kZVVSSUNvbXBvbmVudChKU09OLnN0cmluZ2lmeShvYmopKSkpOwp9CmZ1bmN0aW9uIHBhcnRpYWxSZXN1bHRQYXlsb2FkKCl7CiAgICBpZighbG9nfHwhcGlkfHwhcm91dGUpcmV0dXJuICIiOwogICAgcmV0dXJuIGVuY29kZVJlc3VsdE9iamVjdChjb21wYWN0UmVzdWx0T2JqZWN0KHRydWUpKTsKfQphc3luYyBmdW5jdGlvbiBzaG93UGFydGlhbFJlc3VsdFFyKCl7CiAgICBpZighbG9nfHwhcGlkfHwhcm91dGUpcmV0dXJuIHRvYXN0KCJQcmltZXJvIGNhcmdhIHR1IFFSIGRlIHBhcnRpY2lwYW50ZSIpOwogICAgY29uc3QgcGF5bG9hZD1wYXJ0aWFsUmVzdWx0UGF5bG9hZCgpOwogICAgY29uc3QgcmVzdWx0PSJPUkl8UkVTVUxUfCIrRVZFTlRfREFUQS5ldmVudElkKyJ8IitwaWQrInwiK3BheWxvYWQ7CiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgicmVzdWx0Iikuc3R5bGUuZGlzcGxheT0iYmxvY2siOwogICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoInN1bW1hcnkiKS5pbm5lckhUTUw9IjxiPlFSIERFIFJFU0NBVEUgUEFSQ0lBTDwvYj48YnI+IitwaWQrIiDCtyAiK3JvdXRlLnJvdXRlSWQrIjxicj5FbnNlw7FhIGVzdGUgUVIgYWwgb3JnYW5pemFkb3Igc2kgaGF5IHByb2JsZW1hLiI7CiAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgicmVzdWx0VGV4dCIpLnZhbHVlPXJlc3VsdDsKICAgIHRyeXtjb25zdCB1cmw9YXdhaXQgUVJDb2RlLnRvRGF0YVVSTChyZXN1bHQse21hcmdpbjo4LHdpZHRoOjEyMDAsZXJyb3JDb3JyZWN0aW9uTGV2ZWw6IkgifSk7ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoInJlc3VsdFFyIikuaW5uZXJIVE1MPSI8aW1nIHNyYz0nIit1cmwrIic+PGRpdiBjbGFzcz0ncmVzdWx0LXFyLWluc3RydWN0aW9uJz7wn4aYIFFSIERFIFJFU0NBVEUgUEFSQ0lBTDxicj5FTlNFw5FBIEVTVEUgUVIgQUwgT1JHQU5JWkFET1IuIFNJIE5PIExFRSwgVVNBIEVMIEPDk0RJR08gTUFOVUFMLjwvZGl2PiJ9Y2F0Y2goZSl7dG9hc3QoIk5vIHNlIHB1ZG8gZ2VuZXJhciBRUiBwYXJjaWFsIil9CiAgICBzYXZlKCk7Cn0KCmZ1bmN0aW9uIHJlc3VsdFBheWxvYWQoKXtyZXR1cm4gZW5jb2RlUmVzdWx0T2JqZWN0KGNvbXBhY3RSZXN1bHRPYmplY3QoZmFsc2UpKX0KYXN5bmMgZnVuY3Rpb24gcmVuZGVyUmVzdWx0KCl7Y29uc3Qgc2VjPWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJyZXN1bHQiKTtpZighc2VjKXJldHVybjtpZighbG9nfHwhbG9nLmZpbmlzaFRpbWUpe3NlYy5zdHlsZS5kaXNwbGF5PSJub25lIjtzZWMuY2xhc3NMaXN0LnJlbW92ZSgicmVzdWx0LW9wZW4iKTtyZXR1cm59c2VjLnN0eWxlLmRpc3BsYXk9ImJsb2NrIjtzZWMuY2xhc3NMaXN0LmFkZCgicmVzdWx0LW9wZW4iKTtjb25zdCBwYXlsb2FkPXJlc3VsdFBheWxvYWQoKTtsb2cucmVzdWx0UGF5bG9hZD1wYXlsb2FkO2NvbnN0IHJlc3VsdD0iT1JJfFJFU1VMVHwiK0VWRU5UX0RBVEEuZXZlbnRJZCsifCIrcGlkKyJ8IitwYXlsb2FkO2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJzdW1tYXJ5IikuaW5uZXJIVE1MPSI8Yj4iK3BpZCsiPC9iPiDCtyAiK3JvdXRlLnJvdXRlSWQrIjxicj4iKyhsb2cuY29tcGxldGVkPyLinIUgUmVjb3JyaWRvIGNvbXBsZXRvIjoi4pqg77iPIFBlbmRpZW50ZXM6ICIrKGxvZy5taXNzaW5nQ29udHJvbHN8fFtdKS5qb2luKCIsICIpKSsiPGJyPjxzdHJvbmc+RU5TRcORQSBFU1RFIEPDk0RJR08gQUwgT1JHQU5JWkFET1I8L3N0cm9uZz4iO2RvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJyZXN1bHRUZXh0IikudmFsdWU9cmVzdWx0O3RyeXtjb25zdCB1cmw9YXdhaXQgUVJDb2RlLnRvRGF0YVVSTChyZXN1bHQse21hcmdpbjo4LHdpZHRoOjEyMDAsZXJyb3JDb3JyZWN0aW9uTGV2ZWw6IkgifSk7ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoInJlc3VsdFFyIikuaW5uZXJIVE1MPSI8aW1nIHNyYz0nIit1cmwrIicgYWx0PSdRUiByZXN1bHRhZG8nPjxkaXYgY2xhc3M9J3Jlc3VsdC1xci1pbnN0cnVjdGlvbic+8J+TsiBRUiBGSU5BTCBERSBSRVNVTFRBRE88YnI+RU5Tw4nDkUFTRUxPIEFMIE9SR0FOSVpBRE9SIFBBUkEgR1VBUkRBUiBUVSBSRVNVTFRBRE8uPC9kaXY+In1jYXRjaChlKXtkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgicmVzdWx0UXIiKS5pbm5lckhUTUw9IjxkaXYgY2xhc3M9J3N0YXR1cyBlcnInPk5vIHNlIHB1ZG8gZ2VuZXJhciBlbCBRUiBmaW5hbC4gVXNhIENPUElBUiBDw5NESUdPIHkgZW5zw6nDsWFzZWxvIGFsIG9yZ2FuaXphZG9yLjwvZGl2PiJ9c2F2ZSgpfQpmdW5jdGlvbiBjb3B5UmVzdWx0KCl7Y29uc3QgdD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgicmVzdWx0VGV4dCIpO3Quc2VsZWN0KCk7ZG9jdW1lbnQuZXhlY0NvbW1hbmQoImNvcHkiKTt0b2FzdCgiQ8OzZGlnbyBkZSByZXN1bHRhZG8gY29waWFkbyIpfWZ1bmN0aW9uIGRvd25sb2FkUmVzdWx0KCl7Y29uc3QgYj1uZXcgQmxvYihbZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoInJlc3VsdFRleHQiKS52YWx1ZV0se3R5cGU6InRleHQvcGxhaW47Y2hhcnNldD11dGYtOCJ9KTtjb25zdCBhPWRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoImEiKTthLmhyZWY9VVJMLmNyZWF0ZU9iamVjdFVSTChiKTthLmRvd25sb2FkPSJjb2RpZ29fcmVzdWx0YWRvXyIrKHBpZHx8InBhcnRpY2lwYW50ZSIpKyIudHh0IjthLmNsaWNrKCk7VVJMLnJldm9rZU9iamVjdFVSTChhLmhyZWYpfWZ1bmN0aW9uIHRtKGkpe3JldHVybiBuZXcgRGF0ZShpKS50b0xvY2FsZVRpbWVTdHJpbmcoImVzLUVTIix7aG91cjoiMi1kaWdpdCIsbWludXRlOiIyLWRpZ2l0IixzZWNvbmQ6IjItZGlnaXQifSl9CmZ1bmN0aW9uIGJpbmRQYXJ0aWNpcGFudEF1dG9zYXZlKCl7CiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCJ2aXNpYmlsaXR5Y2hhbmdlIiwoKT0+e2lmKGRvY3VtZW50LnZpc2liaWxpdHlTdGF0ZT09PSJoaWRkZW4iKXNhdmUoKX0pOwogICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigiZnJlZXplIixzYXZlKTsKICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoInJlc3VtZSIsKCk9PntzYXZlKCk7cmVzdG9yZUJlc3RTYXZlZFJ1bih0cnVlKX0pOwogICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigiaW5wdXQiLHNhdmUsdHJ1ZSk7CiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCJjaGFuZ2UiLHNhdmUsdHJ1ZSk7CiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigicGFnZWhpZGUiLHNhdmUpOwogICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoInBhZ2VzaG93IiwoKT0+e3JlcXVlc3RQZXJzaXN0ZW50U3RvcmFnZSgpO3NhdmUoKTtyZXN0b3JlQmVzdFNhdmVkUnVuKHRydWUpfSk7CiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigiYmVmb3JldW5sb2FkIixzYXZlKTsKICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCJvZmZsaW5lIiwoKT0+e3NhdmUoKTt1cGRhdGVPZmZsaW5lU2FmZXR5UGFuZWwoIlNJTiBDT0JFUlRVUkE6IEVMIFJFQ09SUklETyBTSUdVRSBHVUFSREFETyIpfSk7CiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigib25saW5lIiwoKT0+ewogICAgICAgIHNhdmUoKTsKICAgICAgICB1cGRhdGVPZmZsaW5lU2FmZXR5UGFuZWwoIkNPQkVSVFVSQSBSRUNVUEVSQURBIik7CiAgICAgICAgcHJlY2FjaGVRclJlYWRlcigpOwogICAgICAgIG5vdGlmeU1pbGl0b3BvTGl2ZSgiUkVBRFkiKTsKICAgICAgICBpZihsb2cmJmxvZy5maW5pc2hUaW1lKXsKICAgICAgICAgICAgaWYoIWxvZy5yZXN1bHRQYXlsb2FkJiZyb3V0ZSlsb2cucmVzdWx0UGF5bG9hZD1yZXN1bHRQYXlsb2FkKCk7CiAgICAgICAgICAgIHNhdmUoKTsKICAgICAgICAgICAgbm90aWZ5TWlsaXRvcG9MaXZlKCJGSU5JU0giLHtyZXN1bHRDb2RlOmxvZy5yZXN1bHRQYXlsb2FkPygiT1JJfFJFU1VMVHwiK0VWRU5UX0RBVEEuZXZlbnRJZCsifCIrcGlkKyJ8Iitsb2cucmVzdWx0UGF5bG9hZCk6IiJ9KTsKICAgICAgICB9CiAgICB9KTsKICAgIHNldEludGVydmFsKHNhdmUsMTUwMCk7Cn0KCmZ1bmN0aW9uIGxvYWRKc1FyKCl7cmV0dXJuIG5ldyBQcm9taXNlKGFzeW5jKHJlcyxyZWopPT57CiAgICBpZih3aW5kb3cuanNRUilyZXR1cm4gcmVzKHRydWUpOwogICAgdHJ5e2NvbnN0IG9rPWF3YWl0IHByZWNhY2hlUXJSZWFkZXIoKTtpZihvaylyZXR1cm4gcmVzKHRydWUpfWNhdGNoKGUpe30KICAgIHRyeXsKICAgICAgICBpZighbmF2aWdhdG9yLm9uTGluZSlyZXR1cm4gcmVqKG5ldyBFcnJvcigiU2luIGxlY3RvciBRUiBvZmZsaW5lIikpOwogICAgICAgIGNvbnN0IHM9ZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgic2NyaXB0Iik7CiAgICAgICAgcy5zcmM9Imh0dHBzOi8vY2RuLmpzZGVsaXZyLm5ldC9ucG0vanNxckAxLjQuMC9kaXN0L2pzUVIubWluLmpzIjsKICAgICAgICBzLm9ubG9hZD0oKT0+e3RyeXtyZXModHJ1ZSl9Y2F0Y2goZSl7cmVzKHRydWUpfX07CiAgICAgICAgcy5vbmVycm9yPSgpPT5yZWoobmV3IEVycm9yKCJObyBzZSBwdWRvIGNhcmdhciBqc1FSIikpOwogICAgICAgIGRvY3VtZW50LmhlYWQuYXBwZW5kQ2hpbGQocyk7CiAgICB9Y2F0Y2goZSl7cmVqKGUpfQp9KX0KCmZ1bmN0aW9uIGVudGVyQ2FtZXJhRnVsbHNjcmVlbigpewogIGRvY3VtZW50LmJvZHkuY2xhc3NMaXN0LmFkZCgiY2FtZXJhLW9wZW4iKTsKICB0cnl7d2luZG93LnNjcm9sbFRvKDAsMCk7ZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbFRvcD0wO2RvY3VtZW50LmJvZHkuc2Nyb2xsVG9wPTB9Y2F0Y2goZSl7fQogIHRyeXsKICAgIGlmKHdpbmRvdy5wYXJlbnQmJndpbmRvdy5wYXJlbnQhPT13aW5kb3cpewogICAgICBjb25zdCBmcmFtZT13aW5kb3cuZnJhbWVFbGVtZW50LHBkb2M9d2luZG93LnBhcmVudC5kb2N1bWVudDsKICAgICAgaWYoZnJhbWUmJnBkb2MpewogICAgICAgIGNhbWVyYUxheW91dFJlc3RvcmU9ewogICAgICAgICAgaGVpZ2h0OmZyYW1lLnN0eWxlLmhlaWdodHx8IiIsbWluSGVpZ2h0OmZyYW1lLnN0eWxlLm1pbkhlaWdodHx8IiIsCiAgICAgICAgICBodG1sT3ZlcmZsb3c6cGRvYy5kb2N1bWVudEVsZW1lbnQuc3R5bGUub3ZlcmZsb3d8fCIiLGJvZHlPdmVyZmxvdzpwZG9jLmJvZHkuc3R5bGUub3ZlcmZsb3d8fCIiCiAgICAgICAgfTsKICAgICAgICBjb25zdCB2aD1NYXRoLm1heCg0MjAsTnVtYmVyKHdpbmRvdy5wYXJlbnQuaW5uZXJIZWlnaHQpfHxOdW1iZXIoc2NyZWVuJiZzY3JlZW4uaGVpZ2h0KXx8NzIwKTsKICAgICAgICBmcmFtZS5zdHlsZS5oZWlnaHQ9dmgrInB4IjsKICAgICAgICBmcmFtZS5zdHlsZS5taW5IZWlnaHQ9dmgrInB4IjsKICAgICAgICBwZG9jLmRvY3VtZW50RWxlbWVudC5zdHlsZS5vdmVyZmxvdz0iaGlkZGVuIjsKICAgICAgICBwZG9jLmJvZHkuc3R5bGUub3ZlcmZsb3c9ImhpZGRlbiI7CiAgICAgICAgZnJhbWUuc2Nyb2xsSW50b1ZpZXcoe2JlaGF2aW9yOiJhdXRvIixibG9jazoic3RhcnQifSk7CiAgICAgIH0KICAgIH0KICB9Y2F0Y2goZSl7fQp9CmZ1bmN0aW9uIGV4aXRDYW1lcmFGdWxsc2NyZWVuKCl7CiAgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QucmVtb3ZlKCJjYW1lcmEtb3BlbiIpOwogIHRyeXsKICAgIGlmKHdpbmRvdy5wYXJlbnQmJndpbmRvdy5wYXJlbnQhPT13aW5kb3cmJmNhbWVyYUxheW91dFJlc3RvcmUpewogICAgICBjb25zdCBmcmFtZT13aW5kb3cuZnJhbWVFbGVtZW50LHBkb2M9d2luZG93LnBhcmVudC5kb2N1bWVudDsKICAgICAgaWYoZnJhbWUpe2ZyYW1lLnN0eWxlLmhlaWdodD1jYW1lcmFMYXlvdXRSZXN0b3JlLmhlaWdodDtmcmFtZS5zdHlsZS5taW5IZWlnaHQ9Y2FtZXJhTGF5b3V0UmVzdG9yZS5taW5IZWlnaHR9CiAgICAgIGlmKHBkb2Mpe3Bkb2MuZG9jdW1lbnRFbGVtZW50LnN0eWxlLm92ZXJmbG93PWNhbWVyYUxheW91dFJlc3RvcmUuaHRtbE92ZXJmbG93O3Bkb2MuYm9keS5zdHlsZS5vdmVyZmxvdz1jYW1lcmFMYXlvdXRSZXN0b3JlLmJvZHlPdmVyZmxvd30KICAgIH0KICB9Y2F0Y2goZSl7fQogIGNhbWVyYUxheW91dFJlc3RvcmU9bnVsbDsKICBzZXRUaW1lb3V0KHJlc2l6ZVBhcnRpY2lwYW50RnJhbWVGcm9tSW5zaWRlLDUwKTsKfQoKYXN5bmMgZnVuY3Rpb24gc3RhcnRRckNhbWVyYSgpewogIGNvbnN0IG92ZXJsYXk9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoImNhbWVyYU92ZXJsYXkiKTsKICBjb25zdCB2aWRlbz1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgidmlkZW8iKTsKICBjb25zdCBzdD1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgiY2FtU3RhdHVzIik7CiAgY29uc3QgdGl0bGU9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoImNhbWVyYVRpdGxlIik7CgogIGlmKHRpdGxlKSB0aXRsZS50ZXh0Q29udGVudD1yb3V0ZSA/ICJFU0NBTkVBUiBCQUxJWkEgLyBTQUxJREEgLyBMTEVHQURBIiA6ICJFU0NBTkVBUiBRUiBQQVJUSUNJUEFOVEUiOwogIGVudGVyQ2FtZXJhRnVsbHNjcmVlbigpOwogIGlmKG92ZXJsYXkpIG92ZXJsYXkuY2xhc3NMaXN0LmFkZCgiYWN0aXZlIik7CiAgaWYoc3Qpe3N0LmNsYXNzTmFtZT0ic3RhdHVzIjtzdC50ZXh0Q29udGVudD0iU29saWNpdGFuZG8gY8OhbWFyYS4uLiI7fQoKICBpZighbmF2aWdhdG9yLm1lZGlhRGV2aWNlc3x8IW5hdmlnYXRvci5tZWRpYURldmljZXMuZ2V0VXNlck1lZGlhKXsKICAgIGlmKHN0KXtzdC5jbGFzc05hbWU9InN0YXR1cyBlcnIiO3N0LnRleHRDb250ZW50PSJFc3RlIG5hdmVnYWRvciBubyBwZXJtaXRlIGPDoW1hcmEuIFVzYSBNQU5VQUwuIjt9CiAgICByZXR1cm47CiAgfQoKICBkZXRlY3Rvcj1udWxsO3VzZUpzUXI9ZmFsc2U7CgogIGlmKCJCYXJjb2RlRGV0ZWN0b3IiIGluIHdpbmRvdyl7CiAgICB0cnl7ZGV0ZWN0b3I9bmV3IEJhcmNvZGVEZXRlY3Rvcih7Zm9ybWF0czpbInFyX2NvZGUiXX0pfWNhdGNoKGUpe2RldGVjdG9yPW51bGx9CiAgfQoKICB0cnl7CiAgICBpZihzdClzdC50ZXh0Q29udGVudD0iUHJlcGFyYW5kbyBsZWN0b3IgUVIgY29tcGF0aWJsZS4uLiI7CiAgICBhd2FpdCBsb2FkSnNRcigpOwogICAgdXNlSnNRcj0hIXdpbmRvdy5qc1FSOwogIH1jYXRjaChlKXsKICAgIHVzZUpzUXI9ZmFsc2U7CiAgICBpZighZGV0ZWN0b3IpewogICAgICBpZihzdCl7c3QuY2xhc3NOYW1lPSJzdGF0dXMgZXJyIjtzdC50ZXh0Q29udGVudD0iU2luIGxlY3RvciBRUiBkaXNwb25pYmxlIG9mZmxpbmUgZW4gZXN0ZSBuYXZlZ2Fkb3IuIFVzYSBNQU5VQUwgbyBtdWVzdHJhIGVsIFFSIGRlIHJlc2NhdGUgcGFyY2lhbC4iO30KICAgICAgcmV0dXJuOwogICAgfQogIH0KCiAgdHJ5ewogICAgaWYoc3RyZWFtKXtzdHJlYW0uZ2V0VHJhY2tzKCkuZm9yRWFjaCh0PT50LnN0b3AoKSk7c3RyZWFtPW51bGx9CiAgICBzdHJlYW09YXdhaXQgbmF2aWdhdG9yLm1lZGlhRGV2aWNlcy5nZXRVc2VyTWVkaWEoewogICAgICB2aWRlbzp7ZmFjaW5nTW9kZTp7aWRlYWw6ImVudmlyb25tZW50In0sd2lkdGg6e2lkZWFsOjEyODB9LGhlaWdodDp7aWRlYWw6NzIwfX0sCiAgICAgIGF1ZGlvOmZhbHNlCiAgICB9KTsKCiAgICB2aWRlby5zcmNPYmplY3Q9c3RyZWFtOwogICAgdmlkZW8uc2V0QXR0cmlidXRlKCJwbGF5c2lubGluZSIsIiIpOwogICAgdmlkZW8uc2V0QXR0cmlidXRlKCJ3ZWJraXQtcGxheXNpbmxpbmUiLCIiKTsKICAgIHZpZGVvLm11dGVkPXRydWU7CiAgICB2aWRlby5hdXRvcGxheT10cnVlOwoKICAgIGF3YWl0IHZpZGVvLnBsYXkoKTsKCiAgICBydW5uaW5nPXRydWU7bGFzdD0iIjtsYXN0VD0wOwoKICAgIGlmKHN0KXtzdC5jbGFzc05hbWU9InN0YXR1cyBvayI7c3QudGV4dENvbnRlbnQ9IkPDoW1hcmEgYWN0aXZhLiBBcHVudGEgYWwgUVIuIjt9CgogICAgc2V0VGltZW91dCgoKT0+e3RyeXt2aWRlby5wbGF5KCl9Y2F0Y2goZSl7fX0sMjUwKTsKICAgIGxvb3AoKTsKICB9Y2F0Y2goZSl7CiAgICBjb25zb2xlLndhcm4oIkVycm9yIGPDoW1hcmE6IixlKTsKICAgIGlmKHN0KXtzdC5jbGFzc05hbWU9InN0YXR1cyBlcnIiO3N0LnRleHRDb250ZW50PSJObyBzZSBwdWRvIGFicmlyIG8gbW9zdHJhciBsYSBjw6FtYXJhLiBSZXZpc2EgcGVybWlzb3MgbyB1c2EgTUFOVUFMLiI7fQogIH0KfQoKZnVuY3Rpb24gc3RvcFFyQ2FtZXJhKCl7CiAgcnVubmluZz1mYWxzZTsKICBpZihzdHJlYW0pe3N0cmVhbS5nZXRUcmFja3MoKS5mb3JFYWNoKHQ9PnQuc3RvcCgpKTtzdHJlYW09bnVsbH0KICBjb25zdCB2aWRlbz1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgidmlkZW8iKTsKICBpZih2aWRlbykgdmlkZW8uc3JjT2JqZWN0PW51bGw7CiAgY29uc3Qgb3ZlcmxheT1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgiY2FtZXJhT3ZlcmxheSIpOwogIGlmKG92ZXJsYXkpIG92ZXJsYXkuY2xhc3NMaXN0LnJlbW92ZSgiYWN0aXZlIik7CiAgZXhpdENhbWVyYUZ1bGxzY3JlZW4oKTsKfQoKYXN5bmMgZnVuY3Rpb24gbG9vcCgpewogIGlmKCFydW5uaW5nKXJldHVybjsKICBjb25zdCB2aWRlbz1kb2N1bWVudC5nZXRFbGVtZW50QnlJZCgidmlkZW8iKSxjYW52YXM9ZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoImNhbnZhcyIpLHN0PWRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCJjYW1TdGF0dXMiKTsKICB0cnl7CiAgICBsZXQgcmF3PSIiOwogICAgaWYodmlkZW8mJnZpZGVvLnJlYWR5U3RhdGU+PTIpewogICAgICBpZihkZXRlY3Rvcil7CiAgICAgICAgdHJ5e2NvbnN0IGM9YXdhaXQgZGV0ZWN0b3IuZGV0ZWN0KHZpZGVvKTsgaWYoYyYmYy5sZW5ndGgpcmF3PShjWzBdLnJhd1ZhbHVlfHwiIikudHJpbSgpO31jYXRjaChlKXt9CiAgICAgIH0KICAgICAgaWYoIXJhdyYmdXNlSnNRciYmd2luZG93LmpzUVImJmNhbnZhcyl7CiAgICAgICAgY29uc3Qgdz12aWRlby52aWRlb1dpZHRofHwxMjgwLGg9dmlkZW8udmlkZW9IZWlnaHR8fDcyMDsKICAgICAgICBjYW52YXMud2lkdGg9dztjYW52YXMuaGVpZ2h0PWg7CiAgICAgICAgY29uc3QgY3R4PWNhbnZhcy5nZXRDb250ZXh0KCIyZCIse3dpbGxSZWFkRnJlcXVlbnRseTp0cnVlfSk7CiAgICAgICAgY3R4LmRyYXdJbWFnZSh2aWRlbywwLDAsdyxoKTsKICAgICAgICBjb25zdCBpbWc9Y3R4LmdldEltYWdlRGF0YSgwLDAsdyxoKTsKICAgICAgICBjb25zdCBjb2RlPXdpbmRvdy5qc1FSKGltZy5kYXRhLHcsaCx7aW52ZXJzaW9uQXR0ZW1wdHM6ImF0dGVtcHRCb3RoIn0pOwogICAgICAgIGlmKGNvZGUmJmNvZGUuZGF0YSlyYXc9U3RyaW5nKGNvZGUuZGF0YSkudHJpbSgpOwogICAgICB9CiAgICB9CgogICAgaWYocmF3KXsKICAgICAgY29uc3Qgbm93PURhdGUubm93KCk7CiAgICAgIGlmKHJhdyE9PWxhc3R8fG5vdy1sYXN0VD4yNTAwKXsKICAgICAgICBsYXN0PXJhdztsYXN0VD1ub3c7CiAgICAgICAgaWYoc3Qpe3N0LmNsYXNzTmFtZT0ic3RhdHVzIG9rIjtzdC50ZXh0Q29udGVudD0iUVIgbGXDrWRvIjt9CiAgICAgICAgaGFuZGxlUXIocmF3KTsKICAgICAgICBpZihuYXZpZ2F0b3IudmlicmF0ZSluYXZpZ2F0b3IudmlicmF0ZSgxMjApOwogICAgICAgIHN0b3BRckNhbWVyYSgpOwogICAgICB9CiAgICB9ZWxzZSBpZihzdCl7CiAgICAgIHN0LmNsYXNzTmFtZT0ic3RhdHVzIjsKICAgICAgc3QudGV4dENvbnRlbnQ9KHZpZGVvJiZ2aWRlby52aWRlb1dpZHRoKT8gIkJ1c2NhbmRvIFFSLi4uIiA6ICJDw6FtYXJhIGFiaWVydGEuIEVzcGVyYW5kbyBpbWFnZW4uLi4iOwogICAgfQogIH1jYXRjaChlKXsKICAgIGlmKHN0KXtzdC5jbGFzc05hbWU9InN0YXR1cyI7c3QudGV4dENvbnRlbnQ9IkJ1c2NhbmRvIFFSLi4uIjt9CiAgfQogIGlmKHJ1bm5pbmcpcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGxvb3ApCn0KCmluaXQoKTsKPC9zY3JpcHQ+PC9ib2R5PjwvaHRtbD4=");
    const bytes=new Uint8Array(bin.length);
    for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i);
    const template=new TextDecoder("utf-8").decode(bytes);
    return template.replace("__EVENT_DATA__", JSON.stringify(eventData));
}

function participantOfflineServiceWorkerJs(){
    return `/* MILITOPO participante · GPS precisión 10 m, 3 lecturas y avisos reforzados v64 */
const MILITOPO_PARTICIPANT_CACHE = "militopo-participante-offline-v64";
const PARTICIPANT_CORE = ["./", "./index.html", "./sw.js"];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil((async () => {
    const cache = await caches.open(MILITOPO_PARTICIPANT_CACHE);
    await Promise.allSettled(PARTICIPANT_CORE.map(url => cache.add(new Request(url, { cache: "reload" }))));
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (e) {}
    }
    await self.clients.claim();
  })());
});

async function cached(request) {
  return await caches.match(request, { ignoreSearch: false });
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(MILITOPO_PARTICIPANT_CACHE);
    try {
      const preload = await event.preloadResponse;
      const response = preload || await fetch(request);
      if (response && response.status !== 206) cache.put(request, response.clone()).catch(() => {});
      return response;
    } catch (e) {
      const hit = await cached(request);
      if (hit) return hit;
      if (request.mode === "navigate") {
        const fallback = await cached(new Request("./index.html")) || await cached(new Request("./"));
        if (fallback) return fallback;
        return new Response("<!doctype html><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>MILITOPO offline</title><body style='font-family:monospace;background:#10190b;color:#f5e6c8;padding:24px'><h1>MILITOPO participante sin cobertura</h1><p>Esta app todavía no estaba guardada en este móvil. Ábrela una vez con cobertura antes de empezar.</p></body>", { headers: { "Content-Type": "text/html;charset=utf-8" } });
      }
      return new Response("", { status: 503, statusText: "Offline" });
    }
  })());
});`;
}


let lastVerificationReport=null;

function verifierStatus(ok,warn=false){
    if(ok&&!warn)return "ok";
    if(ok&&warn)return "warn";
    return "err";
}

function addVerificationItem(items,key,title,ok,details=[],warnings=[]){
    items.push({
        key,
        title,
        ok:!!ok,
        warnings:Array.isArray(warnings)?warnings:[],
        details:Array.isArray(details)?details:[String(details||"")],
        status:verifierStatus(!!ok,Array.isArray(warnings)&&warnings.length>0)
    });
}

function routeMetricForRoute(route){
    const idx=(state.routes||[]).findIndex(r=>r.routeId===route.routeId&&r.participantId===route.participantId);
    return idx>=0?(state.metrics||[])[idx]:null;
}

function validateExercise(){
    const items=[];
    const points=state.points||{};
    const pointIds=Object.keys(points);
    const controlIds=pointIds.filter(id=>id!=="START"&&id!=="FINISH");
    const routes=state.routes||[];
    const metrics=state.metrics||[];

    const hasStart=!!points.START;
    const hasFinish=!!points.FINISH;
    const expectedPoints=(state.controlCount||0)+2;

    addVerificationItem(
        items,
        "config",
        "Configuración básica",
        !!state.eventId&&!!state.eventName&&state.participantCount>0&&state.controlCount>0&&state.controlsPerRoute>0,
        [
            `Evento: ${state.eventId||"sin ID"}`,
            `Nombre: ${state.eventName||"sin nombre"}`,
            `${state.participantCount||0} participante(s)`,
            `${state.controlCount||0} baliza(s)`,
            `${state.controlsPerRoute||0} controles por recorrido`
        ]
    );

    addVerificationItem(
        items,
        "points_count",
        "Puntos del ejercicio",
        hasStart&&hasFinish&&controlIds.length===state.controlCount,
        [
            `Salida: ${hasStart?"sí":"no"}`,
            `Llegada: ${hasFinish?"sí":"no"}`,
            `Balizas: ${controlIds.length}/${state.controlCount||0}`,
            `Total puntos: ${pointIds.length}/${expectedPoints}`
        ],
        controlIds.length!==state.controlCount?[`El número de balizas no coincide con la configuración.`]:[]
    );

    const invalidBase=pointIds.filter(id=>typeof pointBaseStatus==="function"?!pointBaseStatus(id).ok:!(points[id].utm&&points[id].desc&&Number.isFinite(points[id].lat)&&Number.isFinite(points[id].lon)));
    addVerificationItem(
        items,
        "points_format",
        "UTM, descripción y coordenadas",
        invalidBase.length===0&&pointIds.length>0,
        invalidBase.length?invalidBase.map(id=>{
            const st=typeof pointBaseStatus==="function"?pointBaseStatus(id):{missing:["datos"]};
            return `${id}: falta ${st.missing.join(", ")}`;
        }):[`Todos los puntos tienen UTM válida, descripción y coordenadas.`]
    );

    const missingElevation=pointIds.filter(id=>points[id].elevationReal!==true||!Number.isFinite(Number(points[id].elevation)));
    addVerificationItem(
        items,
        "elevations",
        "Elevaciones reales (opcional)",
        pointIds.length>0,
        missingElevation.length?[`${missingElevation.length} punto(s) sin elevación real. Se mostrará “Sin desnivel real”.`]:[`Elevaciones reales disponibles para todos los puntos.`],
        missingElevation.length?[`No se inventan cotas: el ejercicio puede generarse igualmente y el desnivel queda marcado como no disponible.`]:[]
    );

    const incompleteIof=pointIds.filter(id=>typeof isIofComplete==="function"?!isIofComplete(id):false);
    addVerificationItem(
        items,
        "iof",
        "Descripciones de control IOF",
        incompleteIof.length===0&&pointIds.length>0,
        incompleteIof.length?incompleteIof.map(id=>`${id}: pendiente`):[`Todas las descripciones IOF están completas.`]
    );

    const expectedRoutes=state.participantCount||0;
    addVerificationItem(
        items,
        "routes",
        "Recorridos generados",
        routes.length===expectedRoutes&&routes.length>0,
        [
            `Recorridos: ${routes.length}/${expectedRoutes}`,
            `Métricas: ${metrics.length}/${routes.length}`
        ],
        routes.length!==expectedRoutes?[`Genera de nuevo recorridos si cambiaste participantes, balizas o controles.`]:[]
    );

    const badRoutes=routes.filter(route=>{
        const ids=route.points||[];
        if(!ids.length)return true;
        if(ids[0]!=="START")return true;
        if(ids[ids.length-1]!=="FINISH")return true;
        const controls=ids.filter(id=>id!=="START"&&id!=="FINISH");
        if(controls.length!==state.controlsPerRoute)return true;
        if(new Set(controls).size!==controls.length)return true;
        return ids.some(id=>!points[id]);
    });
    addVerificationItem(
        items,
        "route_structure",
        "Estructura de recorridos",
        badRoutes.length===0&&routes.length>0,
        badRoutes.length?badRoutes.map(r=>`${r.participantId||"?"} · ${r.routeId||"?"}: revisar orden/puntos`):[`Todos los recorridos empiezan en START, terminan en FINISH y tienen controles válidos.`]
    );

    const missingMetrics=routes.filter(route=>{const m=routeMetricForRoute(route);return !m||m.distanceKm==null||!String(m.difficulty||"").trim()});
    const noRealClimb=routes.filter(route=>{const m=routeMetricForRoute(route);return m&&(m.positiveM==null||m.negativeM==null||m.globalM==null)});
    addVerificationItem(
        items,
        "metrics",
        "Distancia, desnivel y dificultad",
        missingMetrics.length===0&&routes.length>0,
        missingMetrics.length?missingMetrics.map(r=>`${r.participantId||"?"} · ${r.routeId||"?"}: faltan distancia/dificultad`):[`Todos los recorridos tienen distancia y dificultad calculadas.${noRealClimb.length?` ${noRealClimb.length} sin desnivel real.`:""}`],
        noRealClimb.length?[`El ZIP sigue siendo válido: donde no haya cotas reales aparecerá “Sin desnivel real”.`]:[]
    );

    const diffCounts={facil:0,media:0,dificil:0,sinClasificar:0};
    (metrics||[]).forEach(m=>{
        const d=String(m.difficulty||"").trim().toLowerCase();

        // La app muestra normalmente BAJA / MEDIA / ALTA.
        // En el informe se traduce a Fácil / Media / Difícil.
        if(d==="baja"||d.includes("baja")||d.includes("fácil")||d.includes("facil")){
            diffCounts.facil++;
        }else if(d==="media"||d.includes("media")){
            diffCounts.media++;
        }else if(d==="alta"||d.includes("alta")||d.includes("difícil")||d.includes("dificil")){
            diffCounts.dificil++;
        }else{
            diffCounts.sinClasificar++;
        }
    });

    const diffTotal=diffCounts.facil+diffCounts.media+diffCounts.dificil+diffCounts.sinClasificar;
    const diffOk=metrics.length===routes.length&&routes.length>0&&diffTotal===routes.length&&diffCounts.sinClasificar===0;

    addVerificationItem(
        items,
        "difficulty",
        "Reparto de categorías/dificultad",
        diffOk,
        [
            `Fácil/Baja: ${diffCounts.facil}`,
            `Media: ${diffCounts.media}`,
            `Difícil/Alta: ${diffCounts.dificil}`,
            `Total clasificado: ${diffCounts.facil+diffCounts.media+diffCounts.dificil}/${routes.length}`
        ],
        diffCounts.sinClasificar?[`${diffCounts.sinClasificar} recorrido(s) sin dificultad reconocida.`]:(routes.length&&!metrics.length?[`No hay métricas suficientes para revisar categorías.`]:[])
    );

    const expectedFiles=[
        `${routes.length} plano(s) HTML de participante`,
        `${state.participantCount||0} QR de participante`,
        `${controlIds.length+2} QR de controles: salida, llegada y balizas`,
        `App participante offline`,
        `JSON del evento`,
        `CSV de recorridos`,
        `Hoja general IOF HTML/CSV`
    ];
    addVerificationItem(
        items,
        "zip_material",
        "Material previsto del ZIP",
        routes.length>0&&controlIds.length>0&&pointIds.length>0,
        expectedFiles
    );

    const appOk=typeof participantOfflineAppHtml==="function";
    addVerificationItem(
        items,
        "participant_app",
        "App participante",
        appOk,
        [appOk?"Plantilla de app participante integrada.":"No se encontró la función de app participante."]
    );

    const severe=items.filter(i=>!i.ok);
    const warnings=items.filter(i=>i.warnings&&i.warnings.length);
    return {
        eventId:state.eventId,
        eventName:state.eventName,
        checkedAt:new Date().toISOString(),
        ok:severe.length===0,
        errors:severe.length,
        warnings:warnings.length,
        items
    };
}

function renderExerciseVerifier(report){
    const summary=document.getElementById("exerciseVerifierSummary");
    const results=document.getElementById("exerciseVerifierResults");
    if(!summary||!results)return;

    summary.className=report.ok?"status ok":"status warn";
    summary.innerHTML=report.ok
        ? `✅ Ejercicio listo para generar material. ${report.items.length} comprobaciones correctas.`
        : `⚠️ Hay ${report.errors} bloque(s) pendiente(s). Revisa antes de imprimir o entregar material.`;

    results.innerHTML=report.items.map(item=>{
        const icon=item.ok?(item.warnings.length?"⚠️":"✅"):"❌";
        const cls=item.ok?(item.warnings.length?"warn":"ok"):"err";
        const details=[...(item.details||[]),...(item.warnings||[]).map(w=>"Aviso: "+w)];
        return `<div class="verify-card ${cls}">
            ${icon} ${escapeHtml(item.title)}
            <small>${details.slice(0,8).map(escapeHtml).join("<br>")}${details.length>8?"<br>...":""}</small>
        </div>`;
    }).join("");
}

function runExerciseVerifier(showToast=true){
    const report=validateExercise();
    lastVerificationReport=report;
    renderExerciseVerifier(report);
    if(showToast)toast(report.ok?"Ejercicio verificado correctamente":"Verificación con pendientes");
    saveState();
    return report;
}

function verificationReportHtml(report){
    const rows=report.items.map(item=>{
        const cls=item.ok?(item.warnings.length?"warn":"ok"):"err";
        const status=item.ok?(item.warnings.length?"AVISO":"OK"):"PENDIENTE";
        const details=[...(item.details||[]),...(item.warnings||[]).map(w=>"Aviso: "+w)].map(escapeHtml).join("<br>");
        return `<tr class="${cls}"><td>${escapeHtml(status)}</td><td>${escapeHtml(item.title)}</td><td>${details}</td></tr>`;
    }).join("");
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>Verificación ${escapeHtml(report.eventId||"")}</title><style>body{font-family:Arial,Helvetica,sans-serif;margin:24px;color:#111}h1{color:#2d3b1f}table{width:100%;border-collapse:collapse}th,td{border:1px solid #aaa;padding:8px;vertical-align:top}th{background:#eee}.ok{background:#e9ffe2}.warn{background:#fff4d0}.err{background:#ffe0d8}</style></head><body><h1>Verificación del ejercicio · ${escapeHtml(report.eventId||"")}</h1><p><b>Nombre:</b> ${escapeHtml(report.eventName||"")}<br><b>Fecha:</b> ${new Date(report.checkedAt).toLocaleString("es-ES")}<br><b>Estado:</b> ${report.ok?"LISTO":"CON PENDIENTES"}</p><table><thead><tr><th>Estado</th><th>Bloque</th><th>Detalle</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

function downloadVerificationReport(){
    const report=lastVerificationReport||runExerciseVerifier(false);
    downloadText(`verificacion_${state.eventId||"evento"}.html`,verificationReportHtml(report));
}

function setZipStatus(kind,msg){
    const el=document.getElementById("zipStatus");
    if(!el)return;
    el.className=`status ${kind||"warn"}`;
    el.textContent=msg;
}

async function verifyAndGenerateZip(){
    try{
        syncPlanScaleFromUiNow();
        const verification=runExerciseVerifier(false);
        renderExerciseVerifier(verification);

        if(!verification.ok){
            const go=confirm("La verificación tiene pendientes. ¿Quieres generar el ZIP igualmente?");
            if(!go){
                setZipStatus("warn","ZIP cancelado. Corrige los pendientes o vuelve a confirmar para generar igualmente.");
                return;
            }
        }

        return generateZip(verification);
    }catch(err){
        console.error("Error antes de generar ZIP:",err);
        setZipStatus("err",`Error antes de generar ZIP: ${err&&err.message?err.message:err}`);
        updateZipProgress(1,1,"Error antes de generar ZIP");
        toast("Error generando ZIP");
    }
}



async function loadScriptOnce(url,globalCheck){
    if(globalCheck&&globalCheck())return;
    await new Promise((resolve,reject)=>{
        const existing=[...document.scripts].find(s=>s.src===url);
        if(existing){
            if(globalCheck&&globalCheck())return resolve();
            existing.addEventListener("load",resolve,{once:true});
            existing.addEventListener("error",reject,{once:true});
            return;
        }
        const s=document.createElement("script");
        s.src=url;
        s.onload=resolve;
        s.onerror=()=>reject(new Error("No se pudo cargar "+url));
        document.head.appendChild(s);
    });
}

async function ensurePlanAssets(){
    if(window.MILITOPO_PLAN_ASSETS)return window.MILITOPO_PLAN_ASSETS;
    await loadScriptOnce(new URL("js/config/plan-assets.js?v=v77-reset-seguro-wakelock-20260919",location.href).href,()=>window.MILITOPO_PLAN_ASSETS);
    if(!window.MILITOPO_PLAN_ASSETS)throw new Error("Recursos de plano no disponibles");
    return window.MILITOPO_PLAN_ASSETS;
}

async function ensureJsPdf(){
    if(window.jspdf&&window.jspdf.jsPDF)return window.jspdf.jsPDF;
    await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",()=>window.jspdf&&window.jspdf.jsPDF);
    if(!window.jspdf||!window.jspdf.jsPDF)throw new Error("jsPDF no disponible");
    return window.jspdf.jsPDF;
}

async function ensureHtml2Canvas(){
    if(window.html2canvas)return window.html2canvas;
    await loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",()=>window.html2canvas);
    if(!window.html2canvas)throw new Error("html2canvas no disponible");
    return window.html2canvas;
}

function waitMs(ms){return new Promise(r=>setTimeout(r,ms));}

function getSelectedPdfLayerKey(){
    const key=String(state.selectedMapLayer||"mapant").toLowerCase();
    return ["mapant","ign","pnoa","custom"].includes(key)?key:"mapant";
}

function getPdfBackgroundLayerMeta(layerKey=getSelectedPdfLayerKey()){
    const defs={
        mapant:{key:"mapant",label:"MAPANT",format:"image/png",endpoint:"https://raster.trailmap.fi/mapproxy/service",layer:"spain_mapant"},
        ign:{key:"ign",label:"IGN",format:"image/jpeg",endpoint:"https://www.ign.es/wms-inspire/mapa-raster",layer:"mtn_rasterizado"},
        pnoa:{key:"pnoa",label:"AÉREO PNOA",format:"image/jpeg",endpoint:"https://www.ign.es/wms-inspire/pnoa-ma",layer:"OI.OrthoimageCoverage"},
        custom:{key:"custom",label:(state.customGeoTiffMeta&&state.customGeoTiffMeta.name)||"PLANO PROPIO",format:"image/png",endpoint:"",layer:""}
    };
    return defs[layerKey]||defs.mapant;
}

function pdfBackgroundImageUrlForExport(bounds,widthPx=2200,heightPx=1580,layerKey=getSelectedPdfLayerKey()){
    const meta=getPdfBackgroundLayerMeta(layerKey);
    const q=new URLSearchParams({
        SERVICE:"WMS",
        REQUEST:"GetMap",
        VERSION:"1.1.1",
        LAYERS:meta.layer,
        STYLES:"",
        SRS:"EPSG:4326",
        BBOX:[bounds.west,bounds.south,bounds.east,bounds.north].join(","),
        WIDTH:String(widthPx),
        HEIGHT:String(heightPx),
        FORMAT:meta.format,
        TRANSPARENT:"FALSE"
    });
    return meta.endpoint+"?"+q.toString();
}

async function imageUrlToDataUrlForPdf(url){
    if(!window._militopoPdfBgCache)window._militopoPdfBgCache={};
    if(window._militopoPdfBgCache[url])return window._militopoPdfBgCache[url];
    const res=await fetch(url,{mode:"cors",cache:"force-cache"});
    if(!res.ok)throw new Error("El servidor del fondo PDF no respondió: "+res.status);
    const blob=await res.blob();
    const dataUrl=await new Promise((resolve,reject)=>{
        const fr=new FileReader();
        fr.onload=()=>resolve(fr.result);
        fr.onerror=()=>reject(new Error("No se pudo convertir el fondo seleccionado a imagen"));
        fr.readAsDataURL(blob);
    });
    window._militopoPdfBgCache[url]=dataUrl;
    return dataUrl;
}

function makePlanFrameSafeForHtml2Canvas(frame,hasCleanBackground){
    /*
      FIX PDF PLANOS 20260605:
      html2canvas falla si intenta pintar teselas Leaflet externas dentro del iframe
      (canvas tainted/CORS). El plano ya tiene su propio fondo MAPANT limpio en dataURL
      cuando se puede descargar. Por eso se ignora/elimina el mapa Leaflet antes de capturar.
      Si MAPANT no se puede convertir, igualmente se genera el PDF con fondo neutro, símbolos,
      recorrido, tabla IOF y escala, en vez de romper el ZIP.
    */
    try{
        const doc=frame&&frame.contentDocument;
        if(!doc)return;
        const wrap=doc.querySelector(".map-wrap");
        const mapDiv=doc.querySelector("#participantPlanMap");

        if(wrap&&!hasCleanBackground&&!doc.getElementById("militopoPdfMapFallback")){
            const fallback=doc.createElement("div");
            fallback.id="militopoPdfMapFallback";
            const layerMeta=getPdfBackgroundLayerMeta();
            fallback.textContent=`Fondo ${layerMeta.label} no disponible · plano generado con símbolos y tabla IOF`;
            fallback.style.position="absolute";
            fallback.style.inset="0";
            fallback.style.zIndex="100";
            fallback.style.background="linear-gradient(135deg,#e9ead7,#d8d8bd)";
            fallback.style.color="#354126";
            fallback.style.font="900 13px Arial, sans-serif";
            fallback.style.display="flex";
            fallback.style.alignItems="center";
            fallback.style.justifyContent="center";
            fallback.style.textAlign="center";
            fallback.style.padding="16px";
            fallback.style.boxSizing="border-box";
            wrap.insertBefore(fallback,wrap.firstChild);
        }

        if(mapDiv){
            mapDiv.setAttribute("data-html2canvas-ignore","true");
            mapDiv.style.display="none";
            mapDiv.style.visibility="hidden";
            mapDiv.style.opacity="0";
        }
        doc.querySelectorAll(".leaflet-container,.leaflet-pane,.leaflet-tile,.leaflet-layer,.leaflet-control-container").forEach(el=>{
            el.setAttribute("data-html2canvas-ignore","true");
        });
    }catch(e){
        console.warn("MILITOPO: no se pudo activar modo seguro de captura PDF",e);
    }
}

function shouldIgnorePlanPdfElementForCanvas(el){
    if(!el)return false;
    try{
        return el.id==="participantPlanMap" ||
            (el.classList&&(el.classList.contains("leaflet-container")||
                            el.classList.contains("leaflet-pane")||
                            el.classList.contains("leaflet-tile")||
                            el.classList.contains("leaflet-layer")||
                            el.classList.contains("leaflet-control-container")));
    }catch(e){return false;}
}

async function injectMapantBackgroundIntoPlanFrame(frame){
    /*
      FIX PDF PLANOS 20260605:
      La generación fallaba antes de dividir archivos porque html2canvas intentaba capturar
      teselas externas de Leaflet/MAPANT. Ahora se intenta crear un fondo MAPANT limpio
      como dataURL y después se oculta el mapa Leaflet para evitar CORS. Si MAPANT falla,
      no se rompe el ZIP: se genera PDF con fondo neutro y todo el recorrido/IOF.
    */
    let ok=false;
    try{
        const win=frame.contentWindow;
        const doc=frame.contentDocument;
        const bounds=win&&win.militopoPlanExportBounds;
        const wrap=doc&&doc.querySelector(".map-wrap");
        if(!bounds||!wrap)throw new Error("No se pudo leer la ventana común del mapa para el PDF");
        const layerKey=getSelectedPdfLayerKey();
        const layerMeta=getPdfBackgroundLayerMeta(layerKey);
        const dataUrl=layerKey==="custom"
            ? await orientationGeoTiffDataUrlForBounds(bounds,2200,1580)
            : await imageUrlToDataUrlForPdf(pdfBackgroundImageUrlForExport(bounds,2200,1580,layerKey));

        let img=doc.getElementById("militopoPdfSelectedBackground");
        if(!img){
            img=doc.createElement("img");
            img.id="militopoPdfSelectedBackground";
            img.alt=`Fondo ${layerMeta.label} exportado`;
            img.style.position="absolute";
            img.style.inset="0";
            img.style.width="100%";
            img.style.height="100%";
            img.style.objectFit="fill";
            img.style.zIndex="120";
            img.style.pointerEvents="none";
            wrap.insertBefore(img,wrap.firstChild);
        }
        img.src=dataUrl;

        await new Promise((resolve,reject)=>{
            if(img.complete&&img.naturalWidth>0)return resolve();
            img.onload=()=>resolve();
            img.onerror=()=>reject(new Error(`No cargó la imagen incrustada ${layerMeta.label}`));
        });
        ok=true;
    }catch(err){
        console.warn("MILITOPO: no se pudo incrustar el fondo seleccionado en PDF; se genera plano PDF con fondo neutro:",err);
        try{
            const doc=frame.contentDocument;
            const failedBg=doc&&doc.getElementById("militopoPdfSelectedBackground");
            if(failedBg)failedBg.remove();
        }catch(e){}
        ok=false;
    }finally{
        makePlanFrameSafeForHtml2Canvas(frame,ok);
    }
    return ok;
}


async function waitForPlanFrameReady(frame,timeoutMs=9000){
    const start=Date.now();
    while(Date.now()-start<timeoutMs){
        const doc=frame.contentDocument;
        const win=frame.contentWindow;
        if(doc&&doc.querySelector(".sheet")){
            const map=doc.querySelector("#participantPlanMap");
            const leafletReady=!!doc.querySelector(".leaflet-tile-loaded")||!!doc.querySelector(".leaflet-tile")||!map;
            if(leafletReady){
                await waitMs(1800);
                return;
            }
        }
        await waitMs(250);
    }
    await waitMs(1200);
}




function recolorIofAreaBlackToPinkOnCanvas(canvas, frame){
    try{
        const doc=frame&&frame.contentDocument;
        if(!canvas||!doc)return canvas;
        const sheet=doc.querySelector(".sheet")||doc.body;
        if(!sheet)return canvas;
        const sheetRect=sheet.getBoundingClientRect();
        if(!sheetRect.width||!sheetRect.height)return canvas;
        const scaleX=canvas.width/sheetRect.width;
        const scaleY=canvas.height/sheetRect.height;
        const ctx=canvas.getContext("2d",{willReadFrequently:true});
        if(!ctx)return canvas;
        const pink={r:255,g:79,b:163};
        const blocks=Array.from(doc.querySelectorAll(".iof"));
        blocks.forEach(block=>{
            const r=block.getBoundingClientRect();
            let x=Math.max(0,Math.floor((r.left-sheetRect.left)*scaleX)-3);
            let y=Math.max(0,Math.floor((r.top-sheetRect.top)*scaleY)-3);
            let w=Math.min(canvas.width-x,Math.ceil(r.width*scaleX)+6);
            let h=Math.min(canvas.height-y,Math.ceil(r.height*scaleY)+6);
            if(w<=0||h<=0)return;
            const img=ctx.getImageData(x,y,w,h);
            const d=img.data;
            for(let i=0;i<d.length;i+=4){
                const rr=d[i],gg=d[i+1],bb=d[i+2],aa=d[i+3];
                if(aa<20)continue;
                const max=Math.max(rr,gg,bb), min=Math.min(rr,gg,bb);
                const isBlack=max<92;
                const isDarkNeutral=max<135 && (max-min)<38;
                if(isBlack||isDarkNeutral){
                    d[i]=pink.r; d[i+1]=pink.g; d[i+2]=pink.b;
                }
            }
            ctx.putImageData(img,x,y);
        });
    }catch(e){
        console.warn("MILITOPO IOF rosa canvas: no se pudo recolorear tabla",e);
    }
    return canvas;
}



function planPdfLegendLandscapeLeftDataUrl(){return window.MILITOPO_PLAN_ASSETS?.legendLandscape||""}


async function participantPlanPdfBlob(route){
    await ensurePlanAssets();
    const jsPDF=await ensureJsPdf();
    const html2canvas=await ensureHtml2Canvas();
    if(typeof participantPlanHtml!=="function")throw new Error("participantPlanHtml no disponible");

    const frame=document.createElement("iframe");
    frame.style.position="fixed";
    frame.style.left="-20000px";
    frame.style.top="0";
    frame.style.width="1123px";
    frame.style.height="794px";
    frame.style.border="0";
    frame.setAttribute("aria-hidden","true");
    document.body.appendChild(frame);

    try{
        const html=participantPlanHtml(route);
        frame.srcdoc=html;
        await new Promise((resolve,reject)=>{
            const t=setTimeout(()=>resolve(),6000);
            frame.onload=()=>{clearTimeout(t);resolve();};
        });
        await waitForPlanFrameReady(frame);
        await injectMapantBackgroundIntoPlanFrame(frame);

        const docEl=frame.contentDocument;
        const sheet=docEl.querySelector(".sheet")||docEl.body;
        if(!sheet)throw new Error("No se encontró la hoja del plano");

        // Fuerza A4 horizontal antes de capturar. La hoja conserva 5 mm internos de seguridad;
        // el plano/mapa se recalcula con dimensiones físicas menores para no romper la escala.
        sheet.style.width="297mm";
        sheet.style.height="210mm";
        sheet.style.margin="0";
        sheet.style.boxSizing="border-box";
        sheet.style.padding="5mm";

        makePlanFrameSafeForHtml2Canvas(frame,!!docEl.getElementById("militopoPdfMapantBackground"));

        const canvas=await html2canvas(sheet,{
            scale:3,
            useCORS:true,
            allowTaint:false,
            backgroundColor:"#ebe3c8",
            logging:false,
            ignoreElements:shouldIgnorePlanPdfElementForCanvas,
            windowWidth:1123,
            windowHeight:794
        });
        recolorIofAreaBlackToPinkOnCanvas(canvas,frame);

        const pdf=new jsPDF({orientation:"landscape",unit:"mm",format:"a4",compress:true});
        const img=canvas.toDataURL("image/jpeg",0.96);
        pdf.addImage(img,"JPEG",0,0,297,210,undefined,"FAST");

        // Cara trasera para impresión dúplex: leyenda IOF en la página 2, también en A4 horizontal.
        // La leyenda se gira hacia la izquierda para que el encabezado quede en el lateral izquierdo.
        const legendBack=await planPdfLegendLandscapeLeftDataUrl();
        pdf.addPage([297,210],"landscape");
        // Cara trasera / hoja de descripciones IOF más corta.
        // La imagen ya viene girada a la izquierda; reducir el ancho evita que los símbolos
        // queden tan estirados y deja la leyenda más compacta, como en la zona marcada.
        pdf.addImage(legendBack,"JPEG",5,5,232,200,undefined,"FAST");

        return pdf.output("blob");
    }catch(e){
        throw new Error("PDF fiel no generado: "+(e&&e.message?e.message:e));
    }finally{
        setTimeout(()=>frame.remove(),500);
    }
}




function xmlEscape(value){
    return String(value??"")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&apos;");
}

function buildAllExercisePointsGpx(){
    const points=Object.values(state.points||{})
        .filter(p=>p&&p.id&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon)))
        .filter(p=>{
            const id=String(p.id||"").toUpperCase();
            const type=String(p.type||"").toUpperCase();
            return id==="START"||id==="FINISH"||type==="SALIDA"||type==="LLEGADA"||type==="START"||type==="FINISH"||type==="BALIZA";
        })
        .sort((a,b)=>{
            const order=p=>{
                const id=String(p.id||"").toUpperCase();
                const type=String(p.type||"").toUpperCase();
                if(id==="START"||type==="SALIDA"||type==="START")return -2;
                if(id==="FINISH"||type==="LLEGADA"||type==="FINISH")return 999999;
                const m=id.match(/^B(\d+)$/);
                return m?Number(m[1]):500000;
            };
            return order(a)-order(b)||String(a.id||"").localeCompare(String(b.id||""));
        });

    if(!points.length)throw new Error("No hay puntos con coordenadas válidas para generar GPX.");

    const eventName=String(state.eventName||"ENTRENAMIENTO ORIENTACIÓN");
    const now=new Date().toISOString();

    const waypoints=points.map(p=>{
        const id=String(p.id||"").trim();
        const lat=Number(p.lat);
        const lon=Number(p.lon);
        const ele=Number.isFinite(Number(p.elevation))?Number(p.elevation):null;
        const type=String(p.type||"BALIZA").trim()||"BALIZA";
        const descParts=[
            `ID: ${id}`,
            `Tipo: ${type}`,
            p.utm?`UTM: ${p.utm}`:"",
            p.desc?`Descripción: ${p.desc}`:""
        ].filter(Boolean);

        return [
            `  <wpt lat="${lat.toFixed(8)}" lon="${lon.toFixed(8)}">`,
            `    <name>${xmlEscape(id)}</name>`,
            `    <desc>${xmlEscape(descParts.join(" | "))}</desc>`,
            ele!==null?`    <ele>${Math.round(ele)}</ele>`:"",
            `    <type>${xmlEscape(type)}</type>`,
            `    <sym>Waypoint</sym>`,
            `  </wpt>`
        ].filter(Boolean).join("\n");
    }).join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1"
     creator="MILITOPO ORIENTACIÓN"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${xmlEscape(eventName)} · Puntos ATAK</name>
    <desc>${xmlEscape("Todos los puntos del ejercicio generados por MILITOPO. Cada waypoint conserva su ID como nombre para ATAK.")}</desc>
    <time>${now}</time>
  </metadata>
${waypoints}
</gpx>`;
}


async function allControlsPlanPdfBlob(){
    await ensurePlanAssets();
    const jsPDF=await ensureJsPdf();
    const html2canvas=await ensureHtml2Canvas();
    if(typeof allControlsPlanHtml!=="function")throw new Error("allControlsPlanHtml no disponible");

    const frame=document.createElement("iframe");
    frame.style.position="fixed";
    frame.style.left="-20000px";
    frame.style.top="0";
    frame.style.width="1123px";
    frame.style.height="794px";
    frame.style.border="0";
    frame.setAttribute("aria-hidden","true");
    document.body.appendChild(frame);

    try{
        const html=allControlsPlanHtml();
        frame.srcdoc=html;
        await new Promise(resolve=>{
            const t=setTimeout(()=>resolve(),6000);
            frame.onload=()=>{clearTimeout(t);resolve();};
        });
        await waitForPlanFrameReady(frame);
        await injectMapantBackgroundIntoPlanFrame(frame);

        const docEl=frame.contentDocument;
        const sheet=docEl&&docEl.querySelector(".sheet");
        if(!sheet)throw new Error("No se encontró la hoja del plano general");

        makePlanFrameSafeForHtml2Canvas(frame,!!docEl.getElementById("militopoPdfMapantBackground"));

        const canvas=await html2canvas(sheet,{
            scale:2.1,
            useCORS:true,
            allowTaint:false,
            backgroundColor:"#ffffff",
            logging:false,
            ignoreElements:shouldIgnorePlanPdfElementForCanvas,
            width:sheet.scrollWidth,
            height:sheet.scrollHeight,
            windowWidth:sheet.scrollWidth,
            windowHeight:sheet.scrollHeight
        });
        recolorIofAreaBlackToPinkOnCanvas(canvas,frame);

        const img=canvas.toDataURL("image/jpeg",0.96);
        const pdf=new jsPDF({orientation:"landscape",unit:"mm",format:"a4",compress:true});
        const pageW=297, pageH=210;
        const margin=4;
        pdf.setFillColor(255,255,255);
        pdf.rect(0,0,pageW,pageH,"F");
        pdf.addImage(img,"JPEG",margin,margin,pageW-margin*2,pageH-margin*2,undefined,"FAST");

        // Impresión a doble cara:
        // Página 1 = plano con encabezado, mapa, tabla IOF lateral y ficha técnica.
        // Página 2 y siguientes = tabla IOF vertical con las balizas que no caben en el lateral.
        if(typeof appendAllControlsIofOverflowPdfPages==="function"){
            await appendAllControlsIofOverflowPdfPages(pdf);
        }

        return pdf.output("blob");
    }catch(e){
        throw new Error("Plano general no generado: "+(e&&e.message?e.message:e));
    }finally{
        setTimeout(()=>frame.remove(),500);
    }
}






async function buildPrintScaleCalibrationPdfBlob(){
    const jsPDF=await ensureJsPdf();
    const pdf=new jsPDF({orientation:"landscape",unit:"mm",format:"a4",compress:true});
    const correctionFactor=1.00; // V63: sin compensación; imprimir a tamaño real / 100 %.
    const cm10Corrected=100/correctionFactor; // 90,909 mm dibujados para salir como 100 mm impresos.
    const cm1Corrected=10/correctionFactor;   // 9,091 mm dibujados para salir como 10 mm impresos.

    pdf.setFillColor(255,255,255);
    pdf.rect(0,0,297,210,"F");

    pdf.setTextColor(20,20,20);
    pdf.setDrawColor(20,20,20);
    pdf.setFont("helvetica","bold");
    pdf.setFontSize(18);
    pdf.text("MILITOPO · CALIBRACIÓN DE IMPRESIÓN Y ESCALA",148.5,18,{align:"center"});

    pdf.setFontSize(10.5);
    pdf.setFont("helvetica","normal");
    pdf.text("Escala física V63: sin compensación adicional. Imprime a tamaño real / 100 %.",148.5,30,{align:"center"});
    pdf.text("Imprime en A4 horizontal, tamaño real / 100 %, sin ajustar a página. Después mide las barras.",148.5,37,{align:"center"});

    pdf.setFont("helvetica","bold");
    pdf.setFontSize(12);
    pdf.text("Comprobación física corregida",25,58);
    pdf.setLineWidth(0.5);

    // Barra corregida: debe medir 10 cm una vez impresa.
    const x0=25;
    const x1=x0+cm10Corrected;
    pdf.line(x0,70,x1,70);
    pdf.line(x0,67,x0,73);
    pdf.line(x1,67,x1,73);
    for(let i=0;i<=10;i++){
        const x=x0+i*(cm10Corrected/10);
        pdf.line(x,68.5,x,71.5);
        pdf.setFontSize(7);
        pdf.text(String(i),x,77,{align:"center"});
    }
    pdf.setFontSize(10);
    pdf.text("Esta barra debe medir exactamente 10 cm al imprimir",x0+cm10Corrected/2,84,{align:"center"});

    // Barra corregida: debe medir 1 cm una vez impresa.
    const sx0=25;
    const sx1=sx0+cm1Corrected;
    pdf.setLineWidth(0.45);
    pdf.line(sx0,103,sx1,103);
    pdf.line(sx0,100,sx0,106);
    pdf.line(sx1,100,sx1,106);
    pdf.setFontSize(10);
    pdf.text("Esta barra debe medir exactamente 1 cm al imprimir",sx0+cm1Corrected/2,114,{align:"center"});

    pdf.setFont("helvetica","bold");
    pdf.setFontSize(12);
    pdf.text("Equivalencia de escala de los planos corregidos",165,58);

    pdf.setFont("helvetica","normal");
    pdf.setFontSize(10);
    pdf.text("E: 1:10.000  -  1 cm impreso = 100 m en el terreno",165,72);
    pdf.text("E: 1:7.500   -  1 cm impreso = 75 m en el terreno",165,82);

    pdf.setFont("helvetica","bold");
    pdf.text("Por qué se corrige:",165,102);
    pdf.setFont("helvetica","normal");
    pdf.text("La escala del plano se genera ahora directamente a tamaño real, sin reducción previa.",165,112);
    pdf.text("Por eso esta calibración dibuja la barra un 10 % más corta,",165,121);
    pdf.text("para que al imprimirse mida 1 cm real con la regla.",165,130);

    pdf.setDrawColor(180,0,0);
    pdf.setTextColor(180,0,0);
    pdf.setLineWidth(0.8);
    pdf.rect(20,150,257,35);
    pdf.setFont("helvetica","bold");
    pdf.setFontSize(13);
    pdf.text("NO IMPRIMIR CON AJUSTAR A PÁGINA",148.5,165,{align:"center"});
    pdf.setFontSize(11);
    pdf.text("Usar: A4 horizontal · escala 100 % · tamaño real",148.5,176,{align:"center"});

    return pdf.output("blob");
}



function zipUiYield(){return new Promise(r=>setTimeout(r,80));}
function ensureZipProgressUi(){
    let box=document.getElementById("zipProgressBox");
    if(box)return box;
    box=document.createElement("div");
    box.id="zipProgressBox";
    box.className="zip-progress-wrap";
    box.style.display="none";
    box.innerHTML='<div class="zip-progress-title">GENERANDO ZIP</div><div class="zip-progress-bar"><div id="zipProgressFill" class="zip-progress-fill"></div></div><div id="zipProgressMeta" class="zip-progress-meta">Preparando...</div>';
    document.body.appendChild(box);
    return box;
}
function updateZipProgress(done,total,label){
    const box=ensureZipProgressUi();
    const fill=document.getElementById("zipProgressFill");
    const meta=document.getElementById("zipProgressMeta");
    const safeTotal=Math.max(1,total||1);
    const pct=Math.max(2,Math.min(100,Math.round((done/safeTotal)*100)));
    box.style.display="block";
    if(fill)fill.style.width=pct+"%";
    if(meta)meta.textContent=(label||"Procesando")+" · "+pct+"%";
}
function hideZipProgress(){
    const box=document.getElementById("zipProgressBox");
    if(box)box.style.display="none";
}



async function recorridosPdfBlob(){
    const jsPDF=await ensureJsPdf();
    const doc=new jsPDF({orientation:"landscape",unit:"mm",format:"a4",compress:true});

    const pageW=297, pageH=210;
    const margin=4;
    const usableW=pageW-margin*2;
    const titleH=15;
    const headerH=8;
    const rowH=8;
    const bottom=pageH-margin;

    // Total exacto: 289 mm útiles para A4 horizontal con margen 4 mm.
    const columns=[
        {key:"participantId",label:"PARTICIPANTE",w:25,align:"center"},
        {key:"routeId",label:"RECORRIDO",w:21,align:"center"},
        {key:"distanceKm",label:"DIST. KM",w:20,align:"center"},
        {key:"longestKm",label:"TRAMO LARGO",w:23,align:"center"},
        {key:"positiveM",label:"DESNIVEL +",w:22,align:"center"},
        {key:"negativeM",label:"DESNIVEL -",w:22,align:"center"},
        {key:"globalM",label:"GLOBAL",w:18,align:"center"},
        {key:"difficulty",label:"DIFICULTAD",w:23,align:"center"},
        {key:"order",label:"ORDEN",w:115,align:"left"}
    ];

    const rows=(state.routes||[]).map((r,i)=>{
        const m=(state.metrics||[])[i]||{};
        return {
            participantId:String(r.participantId||""),
            routeId:String(r.routeId||""),
            distanceKm:m.distanceKm??"",
            longestKm:m.longestKm??"",
            positiveM:m.positiveM??"Sin desnivel real",
            negativeM:m.negativeM??"Sin desnivel real",
            globalM:m.globalM??"Sin desnivel real",
            difficulty:m.difficulty??"",
            order:(r.points||[]).join(" < ")
        };
    });

    function drawPageHeader(){
        doc.setFillColor(255,255,255);
        doc.rect(0,0,pageW,pageH,"F");

        doc.setDrawColor(0,0,0);
        doc.setLineWidth(0.45);
        doc.rect(margin,margin,pageW-margin*2,pageH-margin*2,"S");

        doc.setFont("helvetica","bold");
        doc.setTextColor(0,0,0);
        doc.setFontSize(16);
        doc.text("RECORRIDOS",pageW/2,margin+8,{align:"center"});

        doc.setFont("helvetica","normal");
        doc.setFontSize(7);
        doc.setTextColor(0,0,0);
        const meta=`MILITOPO ORIENTACIÓN · ${String(state.eventName||"ENTRENAMIENTO ORIENTACIÓN")} · ${new Date().toLocaleString("es-ES")}`;
        doc.text(meta,pageW/2,margin+13,{align:"center",maxWidth:usableW-8});
    }

    function drawTableHeader(y){
        let x=margin;
        doc.setLineWidth(0.25);
        doc.setFont("helvetica","bold");
        doc.setFontSize(6.1);
        columns.forEach(col=>{
            doc.setFillColor(245,245,245);
            doc.rect(x,y,col.w,headerH,"F");
            doc.setDrawColor(0,0,0);
            doc.rect(x,y,col.w,headerH,"S");
            doc.setTextColor(0,0,0);
            const lines=doc.splitTextToSize(col.label,col.w-2).slice(0,2);
            doc.text(lines,x+col.w/2,y+3.3,{align:"center",maxWidth:col.w-2});
            x+=col.w;
        });
    }

    function drawCellText(text,x,y,w,align){
        const clean=String(text??"");
        doc.setFont("helvetica","normal");
        doc.setFontSize(5.7);
        doc.setTextColor(0,0,0);
        const maxW=w-2;
        const lines=doc.splitTextToSize(clean,maxW).slice(0,2);
        const tx=align==="center"?x+w/2:x+1.2;
        doc.text(lines,tx,y+3.4,{align:align==="center"?"center":"left",maxWidth:maxW});
    }

    function drawRow(row,y){
        let x=margin;
        doc.setDrawColor(0,0,0);
        doc.setLineWidth(0.2);
        columns.forEach(col=>{
            doc.rect(x,y,col.w,rowH,"S");
            drawCellText(row[col.key],x,y,col.w,col.align);
            x+=col.w;
        });
    }

    drawPageHeader();
    let y=margin+titleH+3;
    drawTableHeader(y);
    y+=headerH;

    rows.forEach(row=>{
        if(y+rowH>bottom){
            doc.addPage("a4","landscape");
            drawPageHeader();
            y=margin+titleH+3;
            drawTableHeader(y);
            y+=headerH;
        }
        drawRow(row,y);
        y+=rowH;
    });

    if(!rows.length){
        doc.setFont("helvetica","normal");
        doc.setTextColor(0,0,0);
        doc.setFontSize(10);
        doc.text("No hay recorridos generados.",pageW/2,y+12,{align:"center"});
    }

    return doc.output("blob");
}


async function balizasPdfBlob(){
    const jsPDF=await ensureJsPdf();
    const doc=new jsPDF({orientation:"portrait",unit:"mm",format:"a4",compress:true});

    const pageW=210, pageH=297;
    const margin=5;
    const usableW=pageW-margin*2;
    const titleH=16;
    const rowH=8;
    const headerH=8;
    const bottom=pageH-margin;

    const columns=[
        {key:"id",label:"ID",w:20,align:"center"},
        {key:"type",label:"TIPO",w:30,align:"center"},
        {key:"utm",label:"UTM",w:72,align:"left"},
        {key:"lat",label:"LAT",w:26,align:"center"},
        {key:"lon",label:"LON",w:26,align:"center"},
        {key:"elev",label:"ELEV.",w:26,align:"center"}
    ];

    function sortPointOrder(a,b){
        const order=id=>{
            const s=String(id||"").toUpperCase();
            if(s==="START")return -2;
            if(s==="FINISH")return 99999;
            const m=s.match(/^B(\d+)$/);
            return m?Number(m[1]):50000;
        };
        return order(a.id)-order(b.id)||String(a.id).localeCompare(String(b.id));
    }

    const rows=Object.values(state.points||{})
        .slice()
        .sort(sortPointOrder)
        .map(p=>({
            id:String(p.id||""),
            type:String(p.type||""),
            utm:String(p.utm||""),
            lat:Number.isFinite(Number(p.lat))?Number(p.lat).toFixed(6):"",
            lon:Number.isFinite(Number(p.lon))?Number(p.lon).toFixed(6):"",
            elev:Number.isFinite(Number(p.elevation))?String(Math.round(Number(p.elevation))):""
        }));

    function drawPageHeader(){
        doc.setFillColor(255,255,255);
        doc.rect(0,0,pageW,pageH,"F");

        doc.setDrawColor(0,0,0);
        doc.setLineWidth(0.45);
        doc.rect(margin,margin,pageW-margin*2,pageH-margin*2,"S");

        doc.setFont("helvetica","bold");
        doc.setTextColor(0,0,0);
        doc.setFontSize(16);
        doc.text("BALIZAS",pageW/2,margin+8,{align:"center"});

        doc.setFontSize(7);
        doc.setFont("helvetica","normal");
        doc.setTextColor(0,0,0);
        const meta=`MILITOPO ORIENTACIÓN · ${String(state.eventName||"ENTRENAMIENTO ORIENTACIÓN")} · ${new Date().toLocaleString("es-ES")}`;
        doc.text(meta,pageW/2,margin+13,{align:"center",maxWidth:usableW-8});
    }

    function drawTableHeader(y){
        let x=margin;
        doc.setLineWidth(0.25);
        doc.setFont("helvetica","bold");
        doc.setFontSize(7);
        columns.forEach(col=>{
            doc.setFillColor(245,245,245);
            doc.rect(x,y,col.w,headerH,"F");
            doc.setDrawColor(0,0,0);
            doc.rect(x,y,col.w,headerH,"S");
            doc.setTextColor(0,0,0);
            doc.text(col.label,x+col.w/2,y+5.2,{align:"center"});
            x+=col.w;
        });
    }

    function drawCellText(text,x,y,w,align){
        const clean=String(text??"");
        doc.setFont("helvetica","normal");
        doc.setFontSize(6.5);
        doc.setTextColor(0,0,0);
        const maxW=w-2;
        const lines=doc.splitTextToSize(clean,maxW).slice(0,2);
        const tx=align==="center"?x+w/2:x+1.4;
        doc.text(lines,tx,y+5.1,{align:align==="center"?"center":"left",maxWidth:maxW});
    }

    function drawRow(row,y){
        let x=margin;
        doc.setDrawColor(0,0,0);
        doc.setLineWidth(0.2);
        columns.forEach(col=>{
            doc.rect(x,y,col.w,rowH,"S");
            drawCellText(row[col.key],x,y,col.w,col.align);
            x+=col.w;
        });
    }

    drawPageHeader();
    let y=margin+titleH+3;
    drawTableHeader(y);
    y+=headerH;

    rows.forEach(row=>{
        if(y+rowH>bottom){
            doc.addPage("a4","portrait");
            drawPageHeader();
            y=margin+titleH+3;
            drawTableHeader(y);
            y+=headerH;
        }
        drawRow(row,y);
        y+=rowH;
    });

    if(!rows.length){
        doc.setFont("helvetica","normal");
        doc.setTextColor(0,0,0);
        doc.setFontSize(10);
        doc.text("No hay balizas configuradas.",pageW/2,y+12,{align:"center"});
    }

    return doc.output("blob");
}



async function addParticipantOfflinePwaToZip(folder,eventData){
    if(!folder)throw new Error("Carpeta de participante offline no disponible");
    const base=folder.folder("orientacion");
    const assets=[
        ["participante/index.html","participante/index.html",false],["participante/runner.html","participante/runner.html",false],
        ["participante/styles.css","participante/styles.css",false],["participante/app.js","participante/app.js",false],
        ["participante/manifest.webmanifest","participante/manifest.webmanifest",false],["participante/sw.js","participante/sw.js",false],
        ["participante/icons/participante-192.png","participante/icons/participante-192.png",true],["participante/icons/participante-512.png","participante/icons/participante-512.png",true],
        ["participante/icons/apple-touch-icon.png","participante/icons/apple-touch-icon.png",true],["js/live/live-phase2.js","js/live/live-phase2.js",false]
    ];
    const failures=[];
    for(const [source,dest,binary] of assets){
        try{const res=await fetch(new URL(source,location.href),{cache:"force-cache"});if(!res.ok)throw new Error(String(res.status));base.file(dest,binary?await res.blob():await res.text())}
        catch(e){failures.push(`${source}: ${e&&e.message?e.message:e}`)}
    }
    folder.file("evento_orientacion.json",JSON.stringify(eventData,null,2));
    folder.file("LEEME_OFFLINE.txt",[
        "MILITOPO PARTICIPANTE · COPIA OFFLINE DEL EJERCICIO",
        "", "La PWA real del participante está en orientacion/participante/.",
        "Para conservar Service Worker y almacenamiento offline debe servirse por HTTPS (o localhost); no se garantiza el funcionamiento abriendo runner.html directamente con file://.",
        "evento_orientacion.json conserva una copia completa de los datos del ejercicio.",
        "La PWA guarda progreso, escaneos, tiempos y cola de sincronización localmente cuando no hay cobertura y sincroniza al recuperar conexión.",
        failures.length?"":"Todos los archivos de la PWA se incluyeron correctamente.",
        failures.length?"Archivos que no pudieron incorporarse en este dispositivo:\n"+failures.join("\n"):""
    ].filter(Boolean).join("\n"));
    return{ok:failures.length===0,failures};
}
async function generateZip(verificationFromButton=null){ensureZipProgressUi();updateZipProgress(0,1,'Preparando ZIP');await zipUiYield();syncPlanScaleFromUiNow();
    const previousButton=document.querySelector('button[onclick="verifyAndGenerateZip()"]');
    try{
        setZipStatus("warn","Preparando ZIP...");

        const verification=verificationFromButton||runExerciseVerifier(false);
        saveState();

        if(!state.routes || !state.routes.length){
            setZipStatus("warn","Genera primero los recorridos.");
            return toast("Genera primero los recorridos");
        }

        if(typeof JSZip==="undefined"){
            setZipStatus("err","No se pudo cargar JSZip. Recarga la página y vuelve a intentarlo.");
            return toast("JSZip no cargado");
        }

        if(previousButton){
            previousButton.disabled=true;
            previousButton.textContent="GENERANDO ZIP...";
        }

        const materialRoutes=state.routes||[];
        if(!materialRoutes.length){
            setZipStatus("warn","No hay recorridos para generar.");
            return toast("No hay recorridos");
        }
        const skippedMaterialCount=typeof skippedRoutesList==="function"?skippedRoutesList().length:0;

        const totalZipWork=(materialRoutes.length||0)*2+(Object.keys(state.points||{}).length||0)+6;
        let zipWorkDone=0;
        updateZipProgress(zipWorkDone,totalZipWork,"Iniciando generación");
        await zipUiYield();

        const zip=new JSZip();
        const eventData=buildEventData();
        zip.folder("Otros documentos");

        setZipStatus("warn","Añadiendo datos del evento...");
        zip.file("Otros documentos/evento_orientacion.json",JSON.stringify(eventData,null,2));
        zip.file("Otros documentos/recorridos.pdf",await recorridosPdfBlob());
        zip.file("Otros documentos/balizas.pdf",await balizasPdfBlob());
        zip.file("Otros documentos/registros_offline_base.json",JSON.stringify({eventId:state.eventId,participantNames:state.participantNames||{},logs:state.participantLogs},null,2));
        if(typeof verificationReportHtml==="function"){
            zip.file("Otros documentos/VERIFICACION_EJERCICIO.html",verificationReportHtml(verification));
        }

        const participantsFolder=zip.folder("Participantes");
        const participantOfflineFolder=participantsFolder.folder("APP_PARTICIPANTE_OFFLINE");
        try{await addParticipantOfflinePwaToZip(participantOfflineFolder,eventData)}catch(offlinePackErr){participantOfflineFolder.file("ERROR_EMPAQUETADO.txt",String(offlinePackErr&&offlinePackErr.message?offlinePackErr.message:offlinePackErr))}
        const controlsFolder=zip.folder("QR_Balizas");
        const pdfFolder=zip.folder("Planos_PDF");
        zip.folder("Plano Completo");
        if(typeof buildPrintScaleCalibrationPdfBlob==="function"){
            try{
                setZipStatus("warn","Añadiendo calibración de impresión...");
                zip.file("Otros documentos/CALIBRACION_IMPRESION_ESCALA.pdf",await buildPrintScaleCalibrationPdfBlob());
            }catch(calErr){
                zip.file("Otros documentos/CALIBRACION_IMPRESION_ESCALA_ERROR.txt",`No se pudo generar la calibración: ${calErr&&calErr.message?calErr.message:calErr}`);
            }
        }

        setZipStatus("warn","Añadiendo descripciones IOF...");
        const descRows=[["Baliza","C","D_Elemento","E_Aspecto","F_Dimension","G_Situacion","H_Info","Combinacion","Texto"]];
        Object.keys(state.points||{}).forEach(id=>{
            const d=(state.iofDescriptions||{})[id]||{};
            descRows.push([
                id,
                typeof iofText==="function"?iofText("c",d.c):"",
                typeof iofText==="function"?iofText("d",d.d):"",
                typeof iofEText==="function"?iofEText(d):"",
                typeof iofText==="function"?iofText("f",d.f):"",
                typeof iofText==="function"?iofText("g",d.g):"",
                typeof iofText==="function"?iofText("h",d.h):"",
                typeof iofText==="function"?iofText("combo",d.combo):"",
                d.text||""
            ]);
        });
        zip.file("Otros documentos/Descripciones_IOF_general.csv",descRows.map(r=>r.map(csvEscape).join(";")).join("\n"));

        if(typeof buildAllExercisePointsGpx==="function"){
            try{
                setZipStatus("warn","Añadiendo GPX ATAK con todos los puntos...");
                zip.file("Puntos_ejercicio_ATAK.gpx",buildAllExercisePointsGpx());
            }catch(gpxErr){
                console.warn("GPX ATAK no generado",gpxErr);
                zip.file("Puntos_ejercicio_ATAK_ERROR.txt",`No se pudo generar el GPX ATAK. Motivo: ${gpxErr&&gpxErr.message?gpxErr.message:gpxErr}`);
            }
        }

        if(typeof allControlsPlanPdfBlob==="function"){
            try{
                setZipStatus("warn","Generando plano general con todas las balizas...");
                zip.file("Plano Completo/Plano_todas_balizas.pdf",await allControlsPlanPdfBlob());
            }catch(planErr){
                console.warn("Plano general de balizas no generado",planErr);
                zip.file("Plano Completo/Plano_todas_balizas_ERROR.txt",`No se pudo generar el plano general de balizas. Motivo: ${planErr&&planErr.message?planErr.message:planErr}`);
            }
        }

        let participantQrCount=0;
        let controlQrCount=0;
        const printableParticipantQrItems=[];

        for(const route of materialRoutes){
            updateZipProgress(++zipWorkDone,totalZipWork,`Preparando participante ${participantQrCount+1}/${materialRoutes.length}`);
            await zipUiYield();
            setZipStatus("warn",`Generando PDF y QR de participantes... ${participantQrCount+1}/${materialRoutes.length}`);

            const payload=participantPayload(route.participantId);
            if(typeof participantPlanPdfBlob==="function"){
                try{
                    updateZipProgress(++zipWorkDone,totalZipWork,`Generando PDF de plano ${participantQrCount+1}/${materialRoutes.length}`);
                    await zipUiYield();
                    setZipStatus("warn",`Generando PDF fiel de plano... ${participantQrCount+1}/${materialRoutes.length}`);
                    const pdfBlob=await participantPlanPdfBlob(route);
                    pdfFolder.file(`Plano_${route.participantId}_${route.routeId}.pdf`,pdfBlob);
                }catch(pdfErr){
                    console.warn("PDF plano no generado",route,pdfErr);
                    pdfFolder.file(`Plano_${route.participantId}_${route.routeId}_ERROR.txt`,`No se pudo generar este PDF. Motivo: ${pdfErr&&pdfErr.message?pdfErr.message:pdfErr}`);
                }
            }

            if(typeof addPrintableParticipantQrItem==="function"){
                printableParticipantQrItems.push(await addPrintableParticipantQrItem(route,payload));
            }
            participantQrCount++;
            await new Promise(r=>setTimeout(r,0));
        }

        if(typeof participantAccessWebQrPdfBlob==="function"){
            try{
                participantsFolder.file("QR_ACCESO_WEB_PARTICIPANTE_A4.pdf",await participantAccessWebQrPdfBlob());
            }catch(accessQrErr){
                console.warn("PDF QR acceso web participante no generado",accessQrErr);
                participantsFolder.file("QR_ACCESO_WEB_PARTICIPANTE_ERROR.txt",`No se pudo generar el PDF de acceso web participante. Motivo: ${accessQrErr&&accessQrErr.message?accessQrErr.message:accessQrErr}`);
            }
        }

        const allPoints=Object.values(state.points||{})
            .filter(p=>{
                if(!p||!p.id)return false;
                const id=String(p.id).toUpperCase();
                const type=String(p.type||"").toUpperCase();
                return id==="START"||id==="FINISH"||type==="SALIDA"||type==="LLEGADA"||type==="START"||type==="FINISH"||type==="BALIZA";
            })
            .sort((a,b)=>{
                const group=p=>{
                    const id=String(p.id||"").toUpperCase();
                    const type=String(p.type||"").toUpperCase();
                    if(id==="START"||type==="SALIDA"||type==="START")return 0;
                    if(id==="FINISH"||type==="LLEGADA"||type==="FINISH")return 2;
                    return 1;
                };
                const ga=group(a),gb=group(b);
                if(ga!==gb)return ga-gb;
                return String(a.id).localeCompare(String(b.id),"es",{numeric:true});
            });

        const printableControlQrItems=[];

        for(const p of allPoints){
            updateZipProgress(++zipWorkDone,totalZipWork,`Preparando hoja imprimible ${controlQrCount+1}/${allPoints.length}`);
            await zipUiYield();
            setZipStatus("warn",`Preparando QR de balizas imprimibles... ${controlQrCount+1}/${allPoints.length}`);
            const payload=controlPayload(p.id);
            if(typeof addPrintableControlQrToZip==="function"){
                printableControlQrItems.push(await addPrintableControlQrToZip(controlsFolder,p,payload));
            }
            controlQrCount++;
            await new Promise(r=>setTimeout(r,0));
        }

        if(printableControlQrItems.length && typeof printableControlsQrPdfBlob==="function"){
            updateZipProgress(++zipWorkDone,totalZipWork,"Generando PDF de QR balizas");
            await zipUiYield();
            setZipStatus("warn","Generando PDF imprimible de salida, balizas y llegada...");
            controlsFolder.file("IMPRIMIR_TODAS_BALIZAS_A4.pdf",await printableControlsQrPdfBlob(printableControlQrItems));
        }

        updateZipProgress(totalZipWork-1,totalZipWork,"Comprimiendo ZIP");
        setZipStatus("warn","Comprimiendo ZIP...");
        const blob=await zip.generateAsync({type:"blob"});

        const eventNameForZip=String(document.getElementById("eventName")?.value||state.eventName||state.eventId||"MILITOPO_ORIENTACION").trim();
        const safeEventNameForZip=eventNameForZip
            .normalize("NFKC")
            .replace(/[\/:*?"<>|]+/g,"-")
            .replace(/\s+/g," ")
            .replace(/[. ]+$/g,"")
            .slice(0,120)
            || `MILITOPO_ORIENTACION_${state.eventId||"EVENTO"}`;
        const filename=`${safeEventNameForZip}.zip`;

        if(typeof saveAs==="function"){
            saveAs(blob,filename);
        }else{
            const url=URL.createObjectURL(blob);
            const a=document.createElement("a");
            a.href=url;
            a.download=filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},1500);
        }

        updateZipProgress(totalZipWork,totalZipWork,"ZIP generado correctamente");
        setTimeout(hideZipProgress,1500);
        setZipStatus("ok",`ZIP generado correctamente. QR participantes: ${participantQrCount}. QR balizas: ${controlQrCount}.${skippedMaterialCount?` Reservas/descartados incluidos: ${skippedMaterialCount}.`:""}`);
        saveState();
        toast("ZIP generado");
    }catch(err){
        console.error("Error generando ZIP:",err);
        updateZipProgress(1,1,"Error generando ZIP");
        setZipStatus("err",`Error generando ZIP: ${err&&err.message?err.message:err}`);
        toast("Error generando ZIP");
    }finally{
        if(previousButton){
            previousButton.disabled=false;
            previousButton.textContent="📦 VERIFICAR Y GENERAR ZIP";
        }
    }
}


function safeJsonClone(value,fallback){
    try{return JSON.parse(JSON.stringify(value))}catch(e){return fallback}
}
function safeReadJsonLocalStorage(key,fallback){
    try{
        const raw=localStorage.getItem(key);
        if(!raw)return fallback;
        const parsed=JSON.parse(raw);
        return parsed&&typeof parsed==="object"?parsed:fallback;
    }catch(e){return fallback}
}
function buildEventData(){
    syncPlanScaleFromUiNow();
    const entries=(state.routes||[]).map((route,i)=>({route,metric:(state.metrics||[])[i]}));
    const now=new Date().toISOString();
    const routes=entries.map(x=>safeJsonClone(x.route,{}));
    const metrics=entries.map(x=>safeJsonClone(x.metric||{},{}));
    const points=safeJsonClone(state.points||{},{});
    const participantNames=safeJsonClone(state.participantNames||{},{});
    const iofDescriptions=safeJsonClone(state.iofDescriptions||{},{});
    const skippedRoutes=safeJsonClone(state.skippedRoutes||{},{});
    const routeWarnings=safeJsonClone(state.routeWarnings||[],[]);
    const elevations=safeJsonClone(state.elevations||{},{});
    const pdfPlanCenterManual=state.pdfPlanCenterManual&&Number.isFinite(Number(state.pdfPlanCenterManual.lat))&&Number.isFinite(Number(state.pdfPlanCenterManual.lon))
        ? {lat:Number(state.pdfPlanCenterManual.lat),lon:Number(state.pdfPlanCenterManual.lon)}
        : null;
    const customSymbols=safeJsonClone(customIofSymbols||{combo:{},f:{},g:{}},{combo:{},f:{},g:{}});
    const customDSymbols=safeReadJsonLocalStorage(STORAGE_KEY_IOF_D_CUSTOM_SYMBOLS,{});
    const pointIds=Object.keys(points);
    const routeIds=routes.map(r=>String(r.routeId||""));
    const participantIds=routes.map(r=>String(r.participantId||""));

    return{
        version:"orientacion_v2_restorable",
        legacyVersion:"orientacion_v1_offline",
        schemaVersion:2,
        format:"MILITOPO_ORIENTATION_EVENT",
        generatedAt:now,
        createdAt:now,
        eventId:state.eventId,
        eventName:state.eventName,
        restore:{
            ready:true,
            recommendedImportSource:"zip",
            acceptedImportSources:["zip","json"],
            preferredMode:"repeat_existing_material",
            targetStep:5,
            preserveEventId:true,
            preservePrintedMaterial:true,
            preserveQrPayloads:true,
            fallbackToAutomaticPlanCenter:true,
            resetOnReuse:[
                "participantLogs",
                "importedResults",
                "startTimes",
                "finishTimes",
                "scanHistory",
                "classification"
            ],
            preserveOnReuse:[
                "eventId",
                "eventName",
                "config",
                "points",
                "routes",
                "metrics",
                "iofDescriptions",
                "participantNames",
                "skippedRoutes",
                "routeWarnings",
                "elevations",
                "plan",
                "customIofSymbols"
            ]
        },
        config:{
            participantCount:entries.length||state.participantCount,
            activeParticipantCount:typeof activeRoutes==="function"?activeRoutes().length:entries.length,
            skippedParticipantCount:typeof skippedRoutesList==="function"?skippedRoutesList().length:0,
            controlCount:state.controlCount,
            controlsPerRoute:state.controlsPerRoute,
            maxControlReuse:state.maxControlReuse,
            planScale:Number(state.planScale)||10000,
            planEquidistanceM:Number(state.planEquidistanceM)||5,
            selectedMapLayer:getSelectedPdfLayerKey(),
            balance:{distance:.5,climb:.5},
            liveReadyInternals:true,
            liveVisible:false
        },
        plan:{
            scale:Number(state.planScale)||10000,
            equidistanceM:Number(state.planEquidistanceM)||5,
            centerMode:pdfPlanCenterManual?"manual":"automatic",
            manualCenter:pdfPlanCenterManual,
            automaticCenterFallback:true,
            backgroundLayer:getSelectedPdfLayerKey()
        },
        points,
        routes,
        metrics,
        elevations,
        iofDescriptions,
        participantNames,
        skippedRoutes,
        routeWarnings,
        customIofSymbols:{
            general:customSymbols,
            d:customDSymbols
        },
        executionTemplate:{
            targetStep:5,
            participantLogs:{},
            importedResults:[],
            completedParticipants:[],
            classification:[]
        },
        integrity:{
            pointCount:pointIds.length,
            routeCount:routes.length,
            participantCount:participantIds.filter(Boolean).length,
            pointIds,
            routeIds,
            participantIds,
            hasStart:Object.prototype.hasOwnProperty.call(points,"START"),
            hasFinish:Object.prototype.hasOwnProperty.call(points,"FINISH"),
            generatedAt:now
        }
    }
}function pointsCsv(){const rows=[["ID","TIPO","UTM","LAT","LON","ELEVACION","QR"]];Object.values(state.points).forEach(p=>rows.push([p.id,p.type,p.utm||"",p.lat??"",p.lon??"",p.elevation??"",controlPayload(p.id)]));return rows.map(r=>r.map(csvEscape).join(",")).join("\n")}function routesCsv(){const rows=[["PARTICIPANTE","RECORRIDO","ESTADO_MATERIAL","DISTANCIA_KM","TRAMO_LARGO_KM","DESNIVEL_POSITIVO_M","DESNIVEL_NEGATIVO_M","DESNIVEL_GLOBAL_M","DIFICULTAD","ORDEN"]];(state.routes||[]).forEach((r,i)=>{const m=state.metrics[i]||{};rows.push([r.participantId,r.routeId,isRouteSkipped(r)?"DESCARTADO_RESERVA":"ACTIVO",m.distanceKm,m.longestKm,m.positiveM??"SIN_DESNIVEL_REAL",m.negativeM??"SIN_DESNIVEL_REAL",m.globalM??"SIN_DESNIVEL_REAL",m.difficulty,r.points.join(" > ")])});return rows.map(r=>r.map(csvEscape).join(",")).join("\n")}

const STORAGE_KEY_IOF_CUSTOM_SYMBOLS="militopo_iof_custom_symbols_v4_c_h_combo_cruce_union_curva";
const STORAGE_KEY_IOF_D_CUSTOM_SYMBOLS="militopo_iof_d_custom_symbols_v1";
let customIofSymbols={combo:{},f:{},g:{}};

const IOF_OPTIONS={"c":[["","—"],["norte","C1 el del norte"],["este","C2 el del este"],["sureste","C3 el del sureste"],["sur","C4 el del sur"],["oeste","C5 el del oeste"],["noreste","C6 el del noreste"],["sudoeste","C7 el del sudoeste"],["noroeste","C8 el del noroeste"],["superior","C9 el superior"],["inferior","C10 el inferior"],["medio","C11 el del medio"],["derecha","el de la derecha"],["izquierda","el de la izquierda"]],"d":[["","—"],["edificio","Edificio"],["area_pavimentada","Area pavimentada"],["ruina","Ruina"],["tuberia_pista_bobsleigh_rastro_estructura","Tubería; Pista bobsleigh / Rastro estructura"],["torre_poste","Torre / Poste"],["plataforma_tiro","Plataforma de tiro"],["mojon_delimitador_cairn","Mojón delimitador, Cairn"],["pesebre_comedero","Pesebre, comedero"],["carbonera_plataforma","Carbonera Plataforma"],["monumento_estatua","Monumento o estatua"],["paso_zona_cubierta","Paso / Zona cubierta"],["escalera","Escalera"],["area_fuera_limites","Area fuera de limites"],["carretera","Carretera"],["pista_camino","Pista / Camino"],["cortafuegos","Cortafuegos"],["puente","Puente"],["linea_electrica","Línea eléctrica"],["torre_linea_electrica","Torre de línea eléctrica"],["tunel","Túnel"],["muro_piedra","Muro de piedra"],["cerca_valla","Cerca / Valla"],["punto_cruce","Punto de cruce"],["campo_abierto","Campo abierto"],["campo_semiabierto","Campo semi-abierto"],["esquina_bosque","Esquina del bosque"],["claro","Claro"],["matorral_vegetacion_espesa","Matorral / Vegetación espesa"],["seto_matorral_lineal","Seto / Matorral lineal"],["limite_vegetacion","Límite de vegetación"],["bosquecillo","Bosquecillo"],["arbol_prominente_caracteristico","Árbol prominente / Característico"],["raiz_tocon_arbol","Raíz, tocón de árbol"],["campo_piedras","Campo de piedras"],["grupo_piedras","Grupo de piedras"],["terreno_pedregoso","Terreno pedregoso"],["afloramiento_rocoso","Afloramiento rocoso"],["paso_estrecho","Paso estrecho"],["trinchera","Trinchera"],["terraza","Terraza"],["espolon","Espolón"],["vaguada","Vaguada"],["terraplen_talud_tierra","Terraplén / Talud de tierra"],["cantera","Cantera"],["lago","Lago"],["charca","Charca"],["hoyo_agua","Hoyo de agua"],["rio_corriente_curso_agua","Río, corriente, curso de agua"],["cauce_agua_secundario_arroyo","Cauce de agua secundario, arroyo"],["pantano_estrecho","Pantano estrecho"],["pantano","Pantano"],["tierra_firme_pantano","Tierra firme en pantano"],["pozo","Pozo"],["manantial","Manantial"],["tanque_agua_abrevadero","Tanque de agua, abrevadero"],["depresion","Depresión"],["depresion_pequena","Depresión pequeña"],["foso_hoyo","Foso / Hoyo"],["terreno_suelo_accidentado","Terreno / Suelo accidentado"],["hormiguero_monticulo_termitas","Hormiguero (montículo de termitas)"],["muro_tierra","Muro de tierra"],["surco_erosion","Surco de erosión"],["surco_pequeno_erosion","Surco pequeño de erosión"],["colina","Colina"],["monticulo","Montículo"],["collado","Collado"],["cortado_risco","Cortado, risco"],["pilar_roca","Pilar de roca"],["cueva","Cueva"],["roca","Roca"]],"e":[["","—"],["bajo","E1 bajo"],["suave_poco_profundo","E2 suave / poco profundo"],["profundo","E3 profundo"],["cubierto_maleza","E4 cubierto de maleza"],["despejado_abierto","E5 despejado / abierto"],["pedregoso_rocoso","E6 pedregoso / rocoso"],["pantanoso","E7 pantanoso"],["arenoso","E8 arenoso"],["perenne_hoja_fina","E9 perenne / hoja fina"],["caducifolio_hoja_ancha","E10 caducifolio / hoja ancha"],["en_ruinas_caido","E11 en ruinas / caído"]],"f":[["","—"],["altura_profundidad","F1 altura / profundidad"],["tamano","F2 tamaño"],["altura_pendiente","F3 altura en pendiente"],["altura_dos_objetos","F4 altura de dos objetos"],["combo_cruce","F5 combinación: cruce"],["combo_union","F6 combinación: unión"],["combo_curva","F7 combinación: curva"]],"g":[["","—"],["lado_noreste","Lado noreste"],["lado_noroeste","Lado noroeste"],["lado_sureste","Lado sureste"],["lado_sudoeste","Lado sudoeste"],["borde_noreste","Borde noreste"],["borde_noroeste","Borde noroeste"],["borde_sureste","Borde sureste"],["borde_sudoeste","Borde sudoeste"],["parte_norte","Parte norte"],["parte_este","Parte este"],["parte_sur","Parte sur"],["parte_oeste","Parte oeste"],["esquina_norte_interior","Esquina norte (dentro / interior)"],["esquina_este_interior","Esquina este (dentro / interior)"],["esquina_oeste_interior","Esquina oeste (dentro / interior)"],["esquina_sur_interior","Esquina sur (dentro / interior)"],["esquina_norte_exterior","Esquina norte (fuera / exterior)"],["esquina_este_exterior","Esquina este (fuera / exterior)"],["esquina_oeste_exterior","Esquina oeste (fuera / exterior)"],["esquina_sur_exterior","Esquina sur (fuera / exterior)"],["punta_noreste","Punta noreste"],["punta_noroeste","Punta noroeste"],["punta_sureste","Punta sureste"],["punta_suroeste","Punta suroeste"],["al_pie_sin_direccion","Al pie (sin dirección)"],["al_pie_noreste","Al pie noreste"],["al_pie_noroeste","Al pie noroeste"],["al_pie_sureste","Al pie sureste"],["al_pie_sudoeste","Al pie sudoeste"],["norte_fin","Norte fin"],["noreste_fin","Noreste fin"],["este_fin","Este fin"],["sureste_fin","Sureste fin"],["sur_fin","Sur fin"],["suroeste_fin","Suroeste fin"],["oeste_fin","Oeste fin"],["noroeste_fin","Noroeste fin"],["parte_superior","Parte superior"],["parte_inferior","Parte inferior"],["encima","Encima"],["debajo","Debajo"],["entre","Entre"]],"h":[["","—"],["primeros_auxilios","H1 primeros auxilios"],["avituallamiento","H2 avituallamiento"],["controlador","H3 controlador"]],"combo":[["","—"],["cruce","Cruce"],["union","Unión"],["curva","Curva"]]};


/* MILITOPO IOF F COMBINACIÓN 20260605
   Las tres opciones de combinación (cruce, unión y curva) se integran ahora
   en la columna F · dimensión. Se mantiene compatibilidad con eventos guardados
   que usaban el campo antiguo `combo`.
*/
const IOF_F_COMBO_PREFIX="combo_";
function isIofFComboValue(value){return String(value||"").startsWith(IOF_F_COMBO_PREFIX);}
function comboKeyFromFValue(value){return isIofFComboValue(value)?String(value).slice(IOF_F_COMBO_PREFIX.length):"";}
function fValueFromComboKey(value){return value?IOF_F_COMBO_PREFIX+String(value):"";}
function effectiveIofFValue(desc){
    const d=desc||{};
    if(d.f)return d.f;
    if(d.combo)return fValueFromComboKey(d.combo);
    return "";
}

function iofFUsesSecondObject(fValue){
    const v=String(fValue||"");
    return v==="combo_cruce" || v==="combo_union";
}
function iofGUsesSecondObject(gValue){
    return String(gValue||"")==="entre";
}
function iofEUsesDOptions(desc){
    const d=desc||{};
    return iofFUsesSecondObject(effectiveIofFValue(d)) || iofGUsesSecondObject(d.g);
}
function iofEOptionsForPoint(id){
    const desc=(state.iofDescriptions&&state.iofDescriptions[id])||{};
    if(iofEUsesDOptions(desc)) return [["","—"],...(IOF_OPTIONS.d||[])];
    return IOF_OPTIONS.e||[];
}
function iofESymbol(desc){
    const d=desc||{};
    return iofSymbol(iofEUsesDOptions(d)?"d":"e",d.e);
}
function iofEText(desc){
    const d=desc||{};
    return iofText(iofEUsesDOptions(d)?"d":"e",d.e);
}

function normalizeIofFSymbolSvg(svg){
    let s=String(svg||"").trim();
    if(!s || !/^<svg[\s>]/i.test(s))return "";
    const firstTagEnd=s.indexOf(">");
    if(firstTagEnd<0)return s;
    let first=s.slice(0,firstTagEnd);
    const rest=s.slice(firstTagEnd);
    if(!/\sclass=/i.test(first)){
        first=first.replace(/^<svg/i,'<svg class="iof-combo-svg"');
    }else if(!/iof-combo-svg/i.test(first)){
        first=first.replace(/class=(["'])(.*?)\1/i,function(m,q,cls){return 'class='+q+'iof-combo-svg '+cls+q;});
    }
    if(!/\saria-hidden=/i.test(first))first+=' aria-hidden="true"';
    return first+rest;
}
function getExternalIofFSymbolSvg(key){
    const k=String(key||"");
    const src=(window.MILITOPO_IOF_F_SYMBOLS||window.MILITOPO_IOF_F_SYMBOL_OVERRIDES||{});
    return normalizeIofFSymbolSvg(src[k]||"");
}

function iofComboSymbolSvg(key){
    const k=String(key||"");
    const externalSvg=getExternalIofFSymbolSvg(k);
    if(externalSvg)return externalSvg;
    const base='class="iof-combo-svg" viewBox="0 0 500 500" aria-hidden="true"';

    /* MILITOPO 20260605 · símbolos de combinación F
       Reemplazados por SVG fijo para que se vea igual en tabla previa,
       planos PDF individuales y plano completo PDF.
    */
    if(k==="union")return `<svg ${base}><title>Unión</title><path d="M250 430V245" fill="none" stroke="currentColor" stroke-width="54" stroke-linecap="round" stroke-linejoin="round"/><path d="M95 82L250 245L405 82" fill="none" stroke="currentColor" stroke-width="54" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    if(k==="cruce")return `<svg ${base}><title>Cruce</title><path d="M95 95L405 405" fill="none" stroke="currentColor" stroke-width="54" stroke-linecap="round" stroke-linejoin="round"/><path d="M405 95L95 405" fill="none" stroke="currentColor" stroke-width="54" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

    if(k==="curva")return `<svg ${base}><title>Curva</title><path d="M125 390C125 240 240 125 390 125" fill="none" stroke="currentColor" stroke-width="58" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    return "";
}

function ensureIofDescriptions(){
    if(!state.iofDescriptions)state.iofDescriptions={};
    const validFields=["c","d","e","f","g","h","combo"];
    const isValid=(field,value)=>{
        if(!value)return true;
        if(field==="e"){
            return (IOF_OPTIONS.e||[]).some(x=>x[0]===value) || (IOF_OPTIONS.d||[]).some(x=>x[0]===value);
        }
        return (IOF_OPTIONS[field]||[]).some(x=>x[0]===value);
    };

    Object.keys(state.points||{}).forEach(id=>{
        if(!state.iofDescriptions[id]){
            state.iofDescriptions[id]={c:"",d:"",e:"",f:"",g:"",h:"",combo:"",text:"",complete:false};
        }
        validFields.forEach(field=>{
            if(!isValid(field,state.iofDescriptions[id][field])){
                state.iofDescriptions[id][field]="";
            }
        });
    });
}

const IOF_SYMBOLS={"c":{},"d":{},"e":{},"f":{},"g":{},"h":{},"combo":{}};
/* === MILITOPO · Biblioteca IOF C-H fija desde backup del usuario ===
   Esta copia deja los símbolos editados dentro del propio HTML para que
   GitHub Pages y cualquier dispositivo los carguen sin depender de localStorage.
*/
const MILITOPO_BAKED_IOF_SYMBOLS=window.MILITOPO_BAKED_IOF_SYMBOLS||{};
(function installBakedIofSymbols(){
    const humanizeIofKey=(key)=>String(key||"")
        .replace(/_/g," ")
        .replace(/\s+/g," ")
        .trim()
        .replace(/^./,c=>c.toUpperCase());
    Object.keys(MILITOPO_BAKED_IOF_SYMBOLS||{}).forEach(group=>{
        IOF_SYMBOLS[group]=IOF_SYMBOLS[group]||{};
        Object.assign(IOF_SYMBOLS[group],MILITOPO_BAKED_IOF_SYMBOLS[group]||{});
        IOF_OPTIONS[group]=IOF_OPTIONS[group]||[["","—"]];
        Object.keys(MILITOPO_BAKED_IOF_SYMBOLS[group]||{}).forEach(key=>{
            if(!IOF_OPTIONS[group].some(item=>item&&item[0]===key)){
                IOF_OPTIONS[group].push([key,humanizeIofKey(key)]);
            }
        });
    });
})();


function cleanIofLabel(label){
    return String(label||"")
        .replace(/^C\d+\s+/,"")
        .replace(/^D\d+(?:-\d+)?\s+/,"")
        .replace(/^E\d+\s+/,"")
        .replace(/^F\d+\s+/,"")
        .replace(/^G\d+\s+/,"")
        .replace(/^H\d+\s+/,"")
        .replace(/^COMB-\d+\s+/,"")
        .replace(/^COMB\s+/,"");
}

function iofOfficialSymbol(group,value){
    const g=String(group||"");
    const v=String(value||"");
    if(g==="f"&&isIofFComboValue(v))return iofComboSymbolSvg(comboKeyFromFValue(v));
    if(g==="combo")return iofComboSymbolSvg(v);
    return (IOF_SYMBOLS[g]&&IOF_SYMBOLS[g][v])||"";
}

function shortIofTextForSelect(txt){
    return String(txt||"")
        .replace("suave / poco profundo","suave / poco prof.")
        .replace("cubierto de maleza","cubierto maleza")
        .replace("pedregoso / rocoso","pedregoso")
        .replace("caducifolio / hoja ancha","caducifolio")
        .replace("perenne / hoja fina","perenne")
        .replace("río / curso de agua","río / curso")
        .replace("cauce de agua / arroyo","cauce / arroyo")
        .replace("matorral / vegetación espesa","matorral / veg.")
        .replace("seto / matorral lineal","seto / lineal")
        .replace("raíz / tocón de árbol","raíz / tocón")
        .replace("depósito de agua / abrevadero","depósito / abrev.")
        .replace("edificio / pilar","edificio / pilar")
        .replace("pasaje / zona cubierta","pasaje / cubierta")
        .replace("encima / superior / dos niveles","encima / superior")
        .replace("debajo / inferior / dos niveles","debajo / inferior");
}


function iofSelectOptionSymbol(group,value){
    if(group==="f"&&isIofFComboValue(value)){const k=comboKeyFromFValue(value);const m={cruce:"×",union:"Y",curva:"⌒"};return m[k]||"";}
    if(group==="c"){
        const m={norte:"↑",este:"→",sureste:"↘",sur:"↓",oeste:"←",noreste:"↗",sudoeste:"↙",noroeste:"↖",superior:"●─",inferior:"─●",medio:"│●│",derecha:"││●",izquierda:"●││"};
        return m[value]||"";
    }
    if(group==="e"){const m={bajo:"⌒",suave_poco_profundo:"⌣",profundo:"∪",cubierto_maleza:"▦",despejado_abierto:"⠿",pedregoso_rocoso:"▲▲▲",pantanoso:"≡",arenoso:"⠿",perenne_hoja_fina:"♠",caducifolio_hoja_ancha:"♣",en_ruinas_caido:"↴"};return m[value]||"";}
    if(group==="d"){const m={edificio:'■',area_pavimentada:'▧',ruina:'□',tuberia_pista_bobsleigh_rastro_estructura:'↗',torre_poste:'┬',plataforma_tiro:'┌',mojon_delimitador_cairn:'⊙',pesebre_comedero:'↑',carbonera_plataforma:'△',monumento_estatua:'△',paso_zona_cubierta:'Π',escalera:'▰',area_fuera_limites:'▣',carretera:'/',pista_camino:'╱',cortafuegos:'⋱',puente:'╪',linea_electrica:'╳',torre_linea_electrica:'⊗',tunel:'═',muro_piedra:'●●',cerca_valla:'⌐',punto_cruce:'╫',campo_abierto:'◇',campo_semiabierto:'◌',esquina_bosque:'↙',claro:'○',matorral_vegetacion_espesa:'▧',seto_matorral_lineal:'○○',limite_vegetacion:'〉',bosquecillo:'♤',arbol_prominente_caracteristico:'♤',raiz_tocon_arbol:'⊗',campo_piedras:'▲▲',grupo_piedras:'▲▲',terreno_pedregoso:'▦',afloramiento_rocoso:'✳',paso_estrecho:'][',trinchera:'∪',terraza:'♈',espolon:'♈',vaguada:'∩',terraplen_talud_tierra:'⌒',cantera:'◔',lago:'≈○',charca:'≈∪',hoyo_agua:'≈∨',rio_corriente_curso_agua:'≈',cauce_agua_secundario_arroyo:'≋',pantano_estrecho:'⋱',pantano:'≡',tierra_firme_pantano:'▤',pozo:'○',manantial:'≈',tanque_agua_abrevadero:'≈▭',depresion:'⊂',depresion_pequena:'∪',foso_hoyo:'∨',terreno_suelo_accidentado:'∪∪',hormiguero_monticulo_termitas:'✳',muro_tierra:'╬',surco_erosion:'∧',surco_pequeno_erosion:'⋰',colina:'○',monticulo:'●',collado:')(',cortado_risco:'┬',pilar_roca:'▲',cueva:'✳',roca:'▲'};return m[value]||"";}
    if(group==="g"){
        const m={
            lado_noreste:'○↗',lado_noroeste:'↖○',lado_sureste:'○↘',lado_sudoeste:'↙○',
            borde_noreste:'○╱',borde_noroeste:'╲○',borde_sureste:'○╲',borde_sudoeste:'╱○',
            parte_norte:'•↑',parte_este:'○•',parte_sur:'•↓',parte_oeste:'•○',
            esquina_norte_interior:'⌃•',esquina_este_interior:'•›',esquina_oeste_interior:'‹•',esquina_sur_interior:'⌄•',
            esquina_norte_exterior:'•⌃',esquina_este_exterior:'›•',esquina_oeste_exterior:'•‹',esquina_sur_exterior:'∨•',
            punta_noreste:'↗•',punta_noroeste:'•↖',punta_sureste:'↘•',punta_suroeste:'•↙',
            noroeste_fin:'⌜',parte_superior:'‖•',parte_inferior:'‖̣',encima:'•∩',
            al_pie_sin_direccion:'L•',al_pie_noreste:'⌞↗',al_pie_noroeste:'↖⌟',al_pie_sureste:'⌜↘',al_pie_sudoeste:'↙⌝',
            debajo:'∩•',entre:'─•─'
        };
        return m[value]||"";
    }
    if(group==="h"){
        const m={primeros_auxilios:"✚",avituallamiento:"▱",controlador:"♙"};
        return m[value]||"";
    }
    if(group==="combo"){
        const m={cruce:"×",union:"Y",curva:"⌒"};
        return m[value]||"";
    }
    return "";
}

function iofOptionLabel(group,value){
    const item=(IOF_OPTIONS[group]||[]).find(x=>x[0]===value);
    if(!item)return "";
    const txt=shortIofTextForSelect(cleanIofLabel(item[1]));
    if(!value||txt==="—")return "—";
    const sym=iofSelectOptionSymbol(group,value);
    return sym?`${sym} ${txt}`:txt;
}

function iofOptionTextOnly(group,value){
    const item=(IOF_OPTIONS[group]||[]).find(x=>x[0]===value);
    return item?cleanIofLabel(item[1]).replace(/^—$/,""):"";
}

function iofSymbol(group,value){
    const g=String(group||"");
    const v=String(value||"");
    if(g!=="f"&&customIofSymbols&&customIofSymbols[g]&&customIofSymbols[g][v]) return customIofSymbols[g][v];
    return iofOfficialSymbol(g,v);
}
function iofText(group,value){return iofOptionTextOnly(group,value);}


function loadCustomIofSymbols(){
    customIofSymbols={combo:{},f:{},g:{}};
    try{
        const raw=localStorage.getItem(STORAGE_KEY_IOF_CUSTOM_SYMBOLS);
        if(raw){
            const parsed=JSON.parse(raw);
            if(parsed&&typeof parsed==="object"){
                customIofSymbols.combo=parsed.combo&&typeof parsed.combo==="object"?parsed.combo:{};
                customIofSymbols.f=parsed.f&&typeof parsed.f==="object"?parsed.f:{};
                customIofSymbols.g=parsed.g&&typeof parsed.g==="object"?parsed.g:{};
            }
        }
    }catch(e){
        customIofSymbols={combo:{},f:{},g:{}};
    }
}
function saveCustomIofSymbols(){
    try{
        localStorage.setItem(STORAGE_KEY_IOF_CUSTOM_SYMBOLS,JSON.stringify(customIofSymbols||{combo:{},f:{},g:{}}));
    }catch(e){}
}
function sanitizeCustomSvg(svg){
    const s=String(svg||"").trim();
    if(!s)return "";
    if(!/^<svg[\s>]/i.test(s)||!/<\/svg>$/i.test(s))throw new Error("Debe empezar por <svg y terminar en </svg>");
    if(/<script|on\w+\s*=|javascript:/i.test(s))throw new Error("SVG bloqueado por seguridad");
    return s;
}

function currentIofOptionValue(group){
    ensureIofDescriptions();
    const d=(state.iofDescriptions&&state.iofDescriptions[selectedIofPointId])||{};
    const value=d[group]||"";
    if(value && (IOF_OPTIONS[group]||[]).some(x=>x[0]===value))return value;
    return ((IOF_OPTIONS[group]||[]).find(x=>x[0])||[""])[0];
}
function groupTitleForCustomEditor(group){
    if(group==="combo")return "COMBINACIÓN";
    return group.toUpperCase();
}
function renderCustomIofSymbolEditors(){
    const box=document.getElementById("iofCustomSvgEditors");
    if(box)box.remove();
}
function renderCustomIofSymbolEditor(group){return "";}
function loadCustomIofSymbolForEdit(group,value){}
function previewCustomIofSymbol(group){}
function saveCustomIofSymbol(group){}
function resetCustomIofSymbol(group){}
function exportCustomIofLibrary(group){}
function importCustomIofLibrary(group,file){}

async function exportFullIofCHBackup(){
    const groups=["c","d","e","f","g","h"];
    const now=new Date();
    const stamp=now.toISOString().replace(/[:.]/g,"-").slice(0,19);

    const escapeCsvValue=value=>`"${String(value??"").replace(/"/g,'""')}"`;
    const stripHtml=value=>String(value??"").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
    const htmlEscapeLocal=value=>String(value??"")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&#39;");
    const saveBlob=(filename,blob)=>{
        if(typeof saveAs==="function"){
            saveAs(blob,filename);
            return;
        }
        const url=URL.createObjectURL(blob);
        const a=document.createElement("a");
        a.href=url;
        a.download=filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},800);
    };

    const options={};
    const officialSymbols={};
    const customSymbols={};
    const effectiveSymbols={};
    const summary=[];

    groups.forEach(group=>{
        const groupOptions=IOF_OPTIONS[group]||[];
        options[group]=groupOptions.map(([value,label])=>({
            value,
            label:cleanIofLabel(label),
            selectLabel:iofOptionLabel(group,value)
        }));

        officialSymbols[group]={...(IOF_SYMBOLS[group]||{})};
        customSymbols[group]=(group==="f")?{}:{...((customIofSymbols&&customIofSymbols[group])||{})};
        effectiveSymbols[group]={};

        groupOptions.forEach(([value,label])=>{
            if(!value)return;
            const official=iofOfficialSymbol(group,value)||officialSymbols[group][value]||"";
            const custom=customSymbols[group][value]||"";
            const finalSvg=custom||official;
            if(finalSvg)effectiveSymbols[group][value]=finalSvg;
            summary.push({
                group:group.toUpperCase(),
                value,
                label:cleanIofLabel(label),
                selectLabel:iofOptionLabel(group,value),
                hasSymbol:!!finalSvg,
                source:custom?"custom":"official"
            });
        });
    });

    const data={
        type:"MILITOPO_IOF_SYMBOL_LIBRARY_BACKUP",
        version:3,
        scope:"C-H",
        exportedAt:now.toISOString(),
        app:"MILITOPO_ORIENTACION",
        description:"Backup mejorado de la biblioteca IOF C-H. Incluye opciones, SVG efectivos usados por la app, SVG oficiales, SVG personalizados compatibles y resumen.",
        notes:[
            "La columna F usa los SVG fijos actuales de MILITOPO; el editor manual F está desactivado.",
            "El bloque effectiveSymbols contiene los símbolos que debe usar la app en la tabla previa y en PDFs.",
            "El bloque options conserva etiquetas y valores de los desplegables C-H."
        ],
        counts:{
            groups:groups.length,
            options:Object.fromEntries(groups.map(g=>[g,(options[g]||[]).length])),
            effectiveSymbols:Object.fromEntries(groups.map(g=>[g,Object.keys(effectiveSymbols[g]||{}).length])),
            customSymbols:Object.fromEntries(groups.map(g=>[g,Object.keys(customSymbols[g]||{}).length]))
        },
        options,
        effectiveSymbols,
        officialSymbols,
        customSymbols,
        summary
    };

    const json=JSON.stringify(data,null,2);
    const csv=[
        ["grupo","valor","etiqueta","etiqueta_desplegable","tiene_svg","origen"].map(escapeCsvValue).join(","),
        ...summary.map(r=>[r.group,r.value,r.label,r.selectLabel,r.hasSymbol?"sí":"no",r.source].map(escapeCsvValue).join(","))
    ].join("\n");

    const previewRows=summary.map(r=>{
        const svg=(effectiveSymbols[r.group.toLowerCase()]||{})[r.value]||"";
        return `<tr><td>${htmlEscapeLocal(r.group)}</td><td>${htmlEscapeLocal(r.value)}</td><td>${htmlEscapeLocal(r.label)}</td><td class="symbol">${svg||"—"}</td><td>${htmlEscapeLocal(r.source)}</td></tr>`;
    }).join("\n");
    const previewHtml=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MILITOPO · Backup IOF C-H</title><style>body{font-family:Arial,sans-serif;background:#f4efe2;color:#151515;margin:24px}h1{font-size:24px}.meta{background:#fff;border:1px solid #ccb98e;border-radius:12px;padding:12px;margin:12px 0 18px}table{border-collapse:collapse;width:100%;background:#fff}th,td{border:1px solid #999;padding:7px 8px;vertical-align:middle;font-size:13px}th{background:#25331d;color:#fff}.symbol{width:90px;height:56px;text-align:center}.symbol svg{max-width:42px;max-height:42px;stroke:#000;fill:none;stroke-width:6}.symbol svg.filled{fill:#000;stroke:#000}</style></head><body><h1>MILITOPO · Backup símbolos IOF C-H</h1><div class="meta"><b>Exportado:</b> ${htmlEscapeLocal(now.toLocaleString("es-ES"))}<br><b>Grupos:</b> C, D, E, F, G, H<br><b>Nota:</b> columna F con símbolos fijos actuales; editor manual F desactivado.</div><table><thead><tr><th>Grupo</th><th>Valor</th><th>Etiqueta</th><th>Símbolo</th><th>Origen</th></tr></thead><tbody>${previewRows}</tbody></table></body></html>`;

    const readme=`MILITOPO · Backup símbolos IOF C-H\n\nExportado: ${now.toISOString()}\n\nContenido:\n- simbolos_IOF_C-H_backup.json: backup completo para conservar/restaurar biblioteca.\n- resumen_simbolos_C-H.csv: listado rápido de opciones.\n- vista_previa_simbolos_C-H.html: vista visual de los símbolos.\n\nNotas:\n- El editor SVG F se ha eliminado.\n- La columna F usa símbolos fijos oficiales/embebidos, incluyendo combinación: cruce, unión y curva.\n`;

    try{
        if(typeof JSZip==="function"){
            const zip=new JSZip();
            zip.file("simbolos_IOF_C-H_backup.json",json);
            zip.file("resumen_simbolos_C-H.csv",csv);
            zip.file("vista_previa_simbolos_C-H.html",previewHtml);
            zip.file("LEEME_BACKUP_IOF_C-H.txt",readme);
            const blob=await zip.generateAsync({type:"blob",compression:"DEFLATE",compressionOptions:{level:6}});
            saveBlob(`MILITOPO_backup_simbolos_IOF_C-H_${stamp}.zip`,blob);
            toast("Backup C-H exportado en ZIP con JSON, CSV y vista previa");
            return;
        }
    }catch(e){
        console.warn("No se pudo crear ZIP de backup IOF; se descarga JSON:",e);
    }

    downloadText(`MILITOPO_backup_simbolos_IOF_C-H_${stamp}.json`,json);
    toast("Backup C-H exportado en JSON");
}

function syncIofEventName(){const input=document.getElementById("iofEventName");if(input&&input.value.trim()){state.eventName=input.value.trim();const main=document.getElementById("eventName");if(main)main.value=state.eventName;scheduleSaveState()}}

function iofPointIds(){
    return Object.keys(state.points||{}).sort((a,b)=>{
        const order=id=>id==="START"?0:id==="FINISH"?9999:Number(String(id).replace(/\D/g,""))||5000;
        return order(a)-order(b);
    });
}

function isIofComplete(id){
    ensureIofDescriptions();
    const base=pointBaseStatus(id);
    if(!base.ok)return false;
    const d=state.iofDescriptions[id]||{};
    return d.complete===true;
}

function iofDisplayStatus(id){
    const base=pointBaseStatus(id);
    if(!base.ok)return "⚠️ pendiente base";
    return isIofComplete(id)?"✅ completo":"⚠️ pendiente IOF";
}

function renderIofPointSelector(){
    const sel=document.getElementById("iofPointSelector");
    if(!sel)return;

    const ids=iofPointIds();
    if(!ids.length)return;

    if(!selectedIofPointId || !ids.includes(selectedIofPointId)) selectedIofPointId=ids[0];

    sel.innerHTML=ids.map(id=>{
        const p=state.points[id]||{};
        const label=`${id} · ${iofDisplayStatus(id)} · ${p.desc||""}`;
        return `<option value="${escapeHtml(id)}" ${id===selectedIofPointId?"selected":""}>${escapeHtml(label)}</option>`;
    }).join("");
}

function renderIofDescriptionsEditor(){
    ensureIofDescriptions();

    const eventNameInput=document.getElementById("iofEventName");
    if(eventNameInput) eventNameInput.value=state.eventName||"";

    const ids=iofPointIds();
    if(!ids.length)return;
    if(!selectedIofPointId || !ids.includes(selectedIofPointId)) selectedIofPointId=ids[0];

    renderIofPointSelector();

    const box=document.getElementById("iofDescriptionsEditor");
    if(!box) return;

    const id=selectedIofPointId;
    const p=state.points[id]||{};
    const d=(state.iofDescriptions&&state.iofDescriptions[id])||{};
    const kind=id==="START"?"Salida":id==="FINISH"?"Llegada":"Control";

    const title=document.getElementById("iofCurrentTitle");
    if(title)title.textContent=id;
    const kindEl=document.getElementById("iofCurrentKind");
    if(kindEl)kindEl.textContent=kind;

    box.innerHTML=`<div class="iof-row">
        <div class="iof-code">${escapeHtml(id)}</div>
        <div>
            <div class="iof-fields">
                ${iofSelectHtml(id,"c","C · SIMILAR",d.c)}
                ${iofSelectHtml(id,"d","D · elemento",d.d)}
                ${iofSelectHtml(id,"e","E · aspecto",d.e)}
                ${iofSelectHtml(id,"f","F · dimensión",effectiveIofFValue(d))}
                ${iofSelectHtml(id,"g","G · situación",d.g)}
                ${iofSelectHtml(id,"h","H · info extra",d.h)}

            </div>
            <div id="iofPreview_${id}" class="iof-preview">${iofPreviewCells(id)}</div>
        </div>
    </div>`;

    renderIofStatus();
    if(typeof validateIofDescriptions==="function") validateIofDescriptions();
}

function iofSelectHtml(id,field,label,value){
    const sourceOptions=field==="e"?iofEOptionsForPoint(id):(IOF_OPTIONS[field]||[]);
    const optionGroup=field==="e"&&iofEUsesDOptions((state.iofDescriptions&&state.iofDescriptions[id])||{})?"d":field;
    const options=sourceOptions.map(([val,txt])=>{
        return `<option value="${escapeHtml(val)}" ${val===(value||"")?"selected":""}>${escapeHtml(iofOptionLabel(optionGroup,val))}</option>`;
    }).join("");
    const cSvg=`<svg class="iof-c-letter-svg" viewBox="0 0 28 28" aria-label="C" role="img"><path d="M19.2 7.7C17.9 6.6 16.2 6 14.3 6C10.4 6 7.7 9.2 7.7 14C7.7 18.8 10.4 22 14.3 22C16.3 22 18 21.4 19.3 20.3" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/></svg>`;
    const labelHtml=field==="c"?`<label class="iof-c-label-fixed">${cSvg}<span class="iof-c-dot">·</span><span>SIMILAR</span></label>`:`<label>${escapeHtml(label)}</label>`;
    const fEditButton="";
    return `<div>${labelHtml}<select onchange="updateIofDescription('${id}','${field}',this.value)">${options}</select>${fEditButton}</div>`;
}


/* Editor manual SVG F eliminado: la columna F usa ahora símbolos fijos embebidos. */
function openIofFManualSvgEditor(id){toast("El editor SVG F ya no está disponible: F usa símbolos fijos.");}
function previewIofFManualSvgEditor(){}
function saveIofFManualSvg(){}
function resetIofFManualSvg(){}
function closeIofFManualSvgEditor(){
    const panel=document.getElementById("iofFManualSvgEditor");
    if(panel)panel.style.display="none";
}


function renderIofStatus(){
    ensureIofDescriptions();
    const ids=iofPointIds();
    const complete=ids.filter(isIofComplete).length;
    const total=ids.length;
    const summary=document.getElementById("iofCompactSummary");
    if(summary){
        summary.className=complete===total?"iof-status-pill ok":"iof-status-pill warn";
        summary.textContent=`${complete}/${total} puntos completos`;
    }
    const current=document.getElementById("iofCurrentStatus");
    if(current){
        const base=pointBaseStatus(selectedIofPointId);
        const done=isIofComplete(selectedIofPointId);
        current.className=done?"iof-status-pill ok":"iof-status-pill warn";
        current.textContent=done?`${selectedIofPointId}: completa`:`${selectedIofPointId}: pendiente${base.ok?" IOF":" · "+base.missing.join(", ")}`;
    }
    renderIofPointSelector();
}

function selectIofPoint(id){
    selectedIofPointId=id;
    renderIofDescriptionsEditor();
    scheduleSaveState();
}

function moveIofPoint(delta){
    const ids=iofPointIds();
    if(!ids.length)return;
    let idx=ids.indexOf(selectedIofPointId);
    if(idx<0)idx=0;
    idx=Math.max(0,Math.min(ids.length-1,idx+delta));
    selectedIofPointId=ids[idx];
    renderIofDescriptionsEditor();
    scheduleSaveState();
}

function markCurrentIofComplete(){
    ensureIofDescriptions();
    if(!selectedIofPointId)return;
    const base=pointBaseStatus(selectedIofPointId);
    if(!base.ok){
        toast(selectedIofPointId+" pendiente: falta "+base.missing.join(", "));
        renderIofStatus();
        return;
    }
    state.iofDescriptions[selectedIofPointId]={...(state.iofDescriptions[selectedIofPointId]||{}),complete:true};
    renderIofDescriptionsEditor();
    scheduleSaveState();
    toast(selectedIofPointId+" marcada como completa");
}

function markCurrentIofPending(){
    ensureIofDescriptions();
    if(!selectedIofPointId)return;
    state.iofDescriptions[selectedIofPointId]={...(state.iofDescriptions[selectedIofPointId]||{}),complete:false};
    renderIofDescriptionsEditor();
    scheduleSaveState();
    toast(selectedIofPointId+" marcada como pendiente");
}

function iofPreviewCells(id){
    ensureIofDescriptions();
    const d=state.iofDescriptions[id]||{};
    const code=id==="START"?"▶":id==="FINISH"?"◎":escapeHtml(id);
    const cSymbol=iofSymbol("c",d.c);
    const dSymbol=iofSymbol("d",d.d);
    const eSymbol=iofESymbol(d);
    const fValue=effectiveIofFValue(d);
    const fSymbol=iofSymbol("f",fValue)||iofSymbol("combo",d.combo);
    const gSymbol=iofSymbol("g",d.g);
    const hSymbol=iofSymbol("h",d.h);
    return `<div>A</div><div>${escapeHtml(code)}</div><div>${iofSymbolBox(cSymbol,"small")}</div><div>${iofSymbolBox(dSymbol,"small")}</div><div>${iofSymbolBox(eSymbol,"small")}</div><div>${iofSymbolBox(fSymbol,"small")}</div><div>${iofSymbolBox(gSymbol,"small")}</div><div>${iofSymbolBox(hSymbol,"small")}</div>`;
}

function updateIofDescription(id,field,value){
    ensureIofDescriptions();
    const desc=state.iofDescriptions[id];
    if(field==="f"){
        desc.f=value;
        // Compatibilidad: el selector antiguo de combinación queda absorbido dentro de F.
        desc.combo="";
    }else{
        desc[field]=value;
    }

    // E usa la biblioteca de D cuando F es cruce/unión o cuando G es "Entre".
    // Al cambiar F o G se elimina cualquier valor de E que ya no sea compatible.
    if(field==="f" || field==="g"){
        const allowedLibrary=iofEUsesDOptions(desc)?IOF_OPTIONS.d:IOF_OPTIONS.e;
        const allowedE=(allowedLibrary||[]).some(x=>x[0]===desc.e);
        if(desc.e&&!allowedE)desc.e="";
    }

    if(field!=="complete") desc.complete=false;
    if(field==="f" || field==="g"){
        renderIofDescriptionsEditor();
    }else{
        const preview=document.getElementById("iofPreview_"+id);
        if(preview)preview.innerHTML=iofPreviewCells(id);
        renderIofStatus();
        renderIofPointSelector();
    }
    scheduleSaveState();
}

function pickRandom(arr){
    const values=(arr||[]).map(x=>x[0]).filter(Boolean);
    return values[Math.floor(Math.random()*values.length)]||"";
}



function autofillRandomIofDescriptions(){
    ensureIofDescriptions();
    Object.keys(state.points||{}).forEach(id=>{
        const p=state.points[id]||{};
        if(id==="START"){
            state.iofDescriptions[id]={c:"",d:"",e:"",f:"",g:"",h:"",combo:"",text:p.desc||"SALIDA",complete:true};
            return;
        }
        if(id==="FINISH"){
            state.iofDescriptions[id]={c:"",d:"",e:"",f:"",g:"",h:"",combo:"",text:p.desc||"LLEGADA",complete:true};
            return;
        }
        state.iofDescriptions[id]={
            c:Math.random()<0.15?pickRandom(IOF_OPTIONS.c):"",
            d:pickRandom(IOF_OPTIONS.d),
            e:Math.random()<0.45?pickRandom(IOF_OPTIONS.e):"",
            f:Math.random()<0.20?pickRandom(IOF_OPTIONS.f):"",
            g:pickRandom(IOF_OPTIONS.g),
            h:Math.random()<0.12?pickRandom(IOF_OPTIONS.h):"",
            combo:"",
            text:p.desc||"",
            complete:true
        };
    });
    renderIofDescriptionsEditor();
    renderMapMarkers();
    saveState();
    toast("Descripciones IOF de prueba completadas");
}

function autofillOfficialIofDescriptions(){
    ensureIofDescriptions();
    const terrain=["terraza","espolon_saliente","vaguada_entrante","talud","colina","cota_monticulo","collado","depresion","foso_hoyo"];
    const rock=["cortado_rocoso","pilar_rocoso","cueva_gruta","roca","campo_piedras","grupo_piedras","pedregal","afloramiento_rocoso"];
    const water=["lago","charca","hoyo_agua","rio_curso_agua","cauce_agua_arroyo","pantano_estrecho","pantano","fuente_pozo","manantial"];
    const veg=["campo_abierto","campo_semiabierto","esquina_bosque","claro","matorral_vegetacion_espesa","seto_matorral_lineal","linde_vegetacion","bosquecillo","arbol_peculiar","raiz_tocon"];
    const built=["carretera","camino_pista","cortafuegos","puente","linea_electrica","poste_electrico","muro_tapia","cerca_valla","punto_paso","edificio_pilar","ruina","escaleras"];
    const pools=[terrain,rock,water,veg,built];
    const rand=a=>a[Math.floor(Math.random()*a.length)];
    const values=field=>(IOF_OPTIONS[field]||[]).map(x=>x[0]).filter(Boolean);
    const randOption=field=>rand(values(field));
    Object.keys(state.points||{}).forEach(id=>{
        const p=state.points[id]||{};
        if(id==="START"){
            state.iofDescriptions[id]={...(state.iofDescriptions[id]||{}),text:(state.iofDescriptions[id]?.text||p.desc||"SALIDA"),complete:true};
            return;
        }
        if(id==="FINISH"){
            state.iofDescriptions[id]={...(state.iofDescriptions[id]||{}),text:(state.iofDescriptions[id]?.text||p.desc||"LLEGADA"),complete:true};
            return;
        }
        state.iofDescriptions[id]={c:Math.random()<0.12?randOption("c"):"",d:rand(rand(pools)),e:Math.random()<0.40?randOption("e"):"",f:Math.random()<0.15?randOption("f"):"",g:randOption("g"),h:"",combo:"",text:"",complete:true};
    });
    renderIofDescriptionsEditor();
    if(typeof validateIofDescriptions==="function") validateIofDescriptions();
    scheduleSaveState();
    toast("Descripciones oficiales generadas");
}

function applyIofTemplateToEmpty(){
    ensureIofDescriptions();
    const template=document.getElementById("iofQuickTemplate")?.value;
    if(!template)return toast("Elige una plantilla");

    const presets={
        terreno:{d:"vaguada_entrante",g:"al_pie",text:""},
        rocas:{d:"roca",g:"al_pie_norte",text:""},
        agua:{d:"rio_curso_agua",g:"borde_este",text:""},
        vegetacion:{d:"linde_vegetacion",g:"en_curva",text:""},
        construido:{d:"cerca_valla",g:"esquina_este_fuera",text:""},
        especial:{d:"elemento_especial_x",g:"entre_dos_objetos",text:""}
    };
    const preset=presets[template]||{};

    Object.keys(state.points||{}).forEach(id=>{
        if(id==="START"||id==="FINISH")return;
        const d=state.iofDescriptions[id]||{};
        if(!d.d&&!d.g&&!d.text){
            state.iofDescriptions[id]={...d,...preset};
        }
    });
    renderIofDescriptionsEditor();
    validateIofDescriptions();
    scheduleSaveState();
    toast("Plantilla oficial aplicada a balizas vacías");
}

function renderIofCellSymbol(symbol){
    const s=String(symbol||"").trim();
    if(/^<svg[\s>]/i.test(s)) return s;
    return escapeHtml(s);
}

function getIofDescription(id){ensureIofDescriptions();const d=state.iofDescriptions[id]||{},p=state.points[id]||{};const fValue=effectiveIofFValue(d);return {c:d.c||"",d:d.d||"",e:d.e||"",f:fValue,g:d.g||"",h:d.h||"",combo:d.combo||"",text:d.text||p.desc||"",cSymbol:iofSymbol("c",d.c),dSymbol:iofSymbol("d",d.d),eSymbol:iofESymbol(d),fSymbol:iofSymbol("f",fValue)||iofSymbol("combo",d.combo),gSymbol:iofSymbol("g",d.g),gText:iofText("g",d.g)||"",hSymbol:iofSymbol("h",d.h),dText:iofText("d",d.d)||p.desc||"",eText:iofEText(d),fText:iofText("f",fValue)||iofText("combo",d.combo),hText:iofText("h",d.h)}}


function iofSymbolBox(symbol, extraClass=""){
    const s=String(symbol||"").trim();
    const inner=s.startsWith("<svg")?s:escapeHtml(s||"");
    return `<span class="iof-symbol-svg ${extraClass}">${inner}</span>`;
}

function buildIofDescriptionText(id){
    const io=getIofDescription(id);
    return [io.dText,io.eText,io.fText,io.gText,io.hText].filter(Boolean).join(" · ");
}

function validateIofDescriptions(){
    ensureIofDescriptions();
    const ids=iofPointIds();
    const missing=ids.filter(id=>!isIofComplete(id));
    const status=document.getElementById("iofValidationStatus");
    if(status){
        if(missing.length){
            status.className="status warn";
            status.innerHTML=`⚠️ Pendientes ${missing.length} baliza(s): <b>${missing.slice(0,12).join(", ")}${missing.length>12?"...":""}</b>`;
        }else{
            status.className="status ok";
            status.innerHTML=`✅ Todas las descripciones están completas.`;
        }
    }
    renderIofStatus();
    return missing.length===0;
}

function clearIofDescriptions(){
    if(!confirm("¿Limpiar todas las descripciones IOF?"))return;
    state.iofDescriptions={};
    Object.keys(state.points||{}).forEach(id=>{
        const p=state.points[id]||{};
        state.iofDescriptions[id]={c:"",d:"",e:"",f:"",g:"",h:"",combo:"",text:(id==="START"?(p.desc||"SALIDA"):id==="FINISH"?(p.desc||"LLEGADA"):""),complete:false};
    });
    ensureIofDescriptions();
    selectedIofPointId="START";
    renderIofDescriptionsEditor();
    validateIofDescriptions();
    scheduleSaveState();
    toast("Descripciones limpiadas: todos los puntos quedan pendientes");
}

function downloadIofDescriptionsCsv(){
    ensureIofDescriptions();
    const rows=[["Baliza","C","D_Elemento","E_Aspecto","F_Dimension","G_Situacion","H_Info","Combinacion","Texto"]];
    Object.keys(state.points||{}).sort((a,b)=>{
        const order=id=>id==="START"?0:id==="FINISH"?9999:Number(String(id).replace(/\D/g,""))||5000;
        return order(a)-order(b);
    }).forEach(id=>{
        const d=state.iofDescriptions[id]||{};
        rows.push([id,iofText("c",d.c),iofText("d",d.d),iofEText(d),iofText("f",effectiveIofFValue(d)),iofText("g",d.g),iofText("h",d.h),iofText("combo",d.combo),d.text||""]);
    });
    downloadText(`descripciones_IOF_${state.eventId}.csv`,rows.map(r=>r.map(csvEscape).join(";")).join("\n"));
}

function iofDescriptionsSheetHtml(){
    ensureIofDescriptions();
    const ids=Object.keys(state.points||{}).sort((a,b)=>{
        const order=id=>id==="START"?0:id==="FINISH"?9999:Number(String(id).replace(/\D/g,""))||5000;
        return order(a)-order(b);
    });
    const rows=ids.map((id,i)=>{
        const p=state.points[id]||{};
        const io=getIofDescription(id);
        const symbol=id==="START"?"▶":id==="FINISH"?"◎":(io.dSymbol||"○");
        return `<tr>
            <td>${i+1}</td>
            <td>${escapeHtml(id)}</td>
            <td class="symbol">${String(io.cSymbol||"").startsWith("<svg")?io.cSymbol:escapeHtml(io.cSymbol||"")}</td>
            <td class="symbol">${String(symbol||"").startsWith("<svg")?symbol:escapeHtml(symbol||"")}</td>
            <td>${escapeHtml(io.dText||p.desc||"")}</td>
            <td>${escapeHtml(io.eText||"")}</td>
            <td>${escapeHtml(io.fText||"")}</td>
            <td>${escapeHtml(io.gText||"")}</td>
            <td>${escapeHtml(io.hText||"")}</td>
            <td>${escapeHtml(io.text||"")}</td>
        </tr>`;
    }).join("");
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Descripciones_${state.eventId}</title><style>@page{size:A4 portrait;margin:8mm}body{font-family:Arial,Helvetica,sans-serif;margin:0;background:#eee;color:#111}.page{background:#fff;max-width:1260px;margin:0 auto;padding:18px}.title{font-size:36px;font-weight:900;color:#c000a0}.meta{margin:8px 0 16px;font-size:14px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #888;padding:6px;vertical-align:middle}th{background:#f4d7ef;color:#6d005d}.symbol{font-size:18px;text-align:center;font-weight:900}.symbol .iof-c-svg{width:18px;height:18px;color:#111;display:inline-block;vertical-align:middle}.symbol .iof-c-svg path,.symbol .iof-c-svg line,.symbol .iof-c-svg polyline{fill:none;stroke:currentColor;stroke-width:8;stroke-linecap:round;stroke-linejoin:round}.symbol .iof-c-svg circle{fill:currentColor;stroke:none}.symbol .iof-c-svg{width:26px;height:26px;color:#111}.symbol .iof-c-svg line,.symbol .iof-c-svg polyline{fill:none;stroke:currentColor;stroke-width:8;stroke-linecap:round;stroke-linejoin:miter}.symbol .iof-c-svg circle{fill:currentColor;stroke:none}.symbol .iof-combo-svg{width:26px;height:26px;color:#111;display:inline-block;vertical-align:middle}.toolbar{margin:10px 0 14px}.toolbar button{border:0;border-radius:999px;background:#c000a0;color:white;font-weight:800;padding:9px 13px}@media print{body{background:white}.page{max-width:none;padding:0}.toolbar{display:none}.title{font-size:28px}table{font-size:10px}}</style></head><body><div class="page"><div class="title">Descripciones de control · ${escapeHtml(state.eventName||"Orientación")}</div><div class="meta"><b>Evento:</b> ${escapeHtml(state.eventId)} · <b>Formato:</b> IOF A-H · <b>Fecha:</b> ${new Date().toLocaleDateString("es-ES")}</div><div class="toolbar"><button onclick="window.print()">🖨️ Imprimir / guardar PDF</button></div><table><thead><tr><th>A<br>Nº</th><th>B<br>Código</th><th>C</th><th>D<br>Símbolo</th><th>D<br>Elemento</th><th>E<br>Aspecto</th><th>F<br>Dim.</th><th>G<br>Situación</th><th>H<br>Info</th><th>Texto</th></tr></thead><tbody>${rows}</tbody></table></div></body></html>`;
}

function openIofDescriptionsSheet(){
    const w=window.open("","_blank");
    if(!w)return toast("El navegador bloqueó la ventana");
    w.document.write(iofDescriptionsSheetHtml());
    w.document.close();
}




const ALL_CONTROLS_PLAN_FIRST_PAGE_IOF_MAX=21;
const ALL_CONTROLS_IOF_TABLES_PER_BACK_PAGE=3;

function allControlsPlanPointIds(){
    return Object.values(state.points||{})
        .filter(p=>p&&p.id&&Number.isFinite(p.lat)&&Number.isFinite(p.lon))
        .filter(p=>{
            const id=String(p.id||"").toUpperCase();
            const type=String(p.type||"").toUpperCase();
            return id==="START"||id==="FINISH"||type==="SALIDA"||type==="LLEGADA"||type==="START"||type==="FINISH"||type==="BALIZA";
        })
        .sort((a,b)=>{
            const order=p=>{
                const id=String(p.id||"").toUpperCase();
                const type=String(p.type||"").toUpperCase();
                if(id==="START"||type==="SALIDA"||type==="START")return -2;
                if(id==="FINISH"||type==="LLEGADA"||type==="FINISH")return 999999;
                const m=id.match(/^B(\d+)$/);
                return m?Number(m[1]):500000;
            };
            return order(a)-order(b)||String(a.id||"").localeCompare(String(b.id||""));
        })
        .map(p=>p.id);
}

function allControlsPlanIofRows(pointIds){
    return (pointIds||[]).map((id,idx)=>{
        const p=state.points[id]||{};
        const io=typeof getIofDescription==="function"?getIofDescription(id):{};
        const raw=(field)=>((state.iofDescriptions||{})[id]||{})[field]||"";
        const up=String(id||"").toUpperCase();
        const type=String(p.type||"").toUpperCase();
        const isStart=up==="START"||type==="SALIDA"||type==="START";
        const isFinish=up==="FINISH"||type==="LLEGADA"||type==="FINISH";
        const n=isStart?"S":isFinish?"M":String((pointIds||[]).slice(0,idx+1).filter(pid=>{
            const u=String(pid||"").toUpperCase();
            return u!=="START"&&u!=="FINISH";
        }).length);
        return {
            id:String(id||""),
            order:isStart?"▷":isFinish?"◎":n,
            code:isStart?"SALIDA":isFinish?"META":String(id||""),
            c:(io.cSymbol||raw("c")||""),
            d:(io.dSymbol||raw("d")||""),
            e:(io.eSymbol||raw("e")||""),
            f:(io.fSymbol||io.fText||raw("f")||raw("combo")||""),
            g:(io.gSymbol||raw("g")||""),
            h:(io.hSymbol||raw("h")||"")
        };
    });
}

function allControlsIofTableHtml(rows,label){
    const eventTitle=escapeHtml(state.eventName||"ENTRENAMIENTO ORIENTACIÓN");
    const scaleLabel=`1:${Number(state.planScale||10000)===7500?"7.500":"10.000"}`;
    const routeNumber=escapeHtml(label||"IOF");
    return `<div class="iof" style="padding:0!important;margin:0!important;justify-content:flex-start!important;align-items:stretch!important"><div class="iof-desc-title" style="height:18px!important;min-height:18px!important;margin:0!important;padding:0!important">DESCRIPCIÓN IOF</div><div class="iof-head"><div class="iof-title">${eventTitle}</div><div class="iof-difficulty">PLANO GENERAL · ${scaleLabel}</div><div class="iof-metrics"><div>${routeNumber}</div><div>BALIZAS</div><div>TODAS</div></div><div class="iof-letters"><div>A</div><div>B</div><div>C</div><div>D</div><div>E</div><div>F</div><div>G</div><div>H</div></div></div><table class="iof-table"><colgroup><col class="col-a"><col class="col-b"><col><col><col><col><col><col></colgroup><tbody>${rows.map(p=>`<tr><td>${escapeHtml(String(p.order))}</td><td class="code">${escapeHtml(p.code)}</td><td>${renderIofCellSymbol(p.c)}</td><td>${renderIofCellSymbol(p.d)}</td><td>${renderIofCellSymbol(p.e)}</td><td class="fcell">${renderIofCellSymbol(p.f)}</td><td class="gcell">${renderIofCellSymbol(p.g)}</td><td>${renderIofCellSymbol(p.h)}</td></tr>`).join("")}</tbody></table></div>`;
}

function allControlsIofOverflowPageHtml(tableChunks,page,totalPages){
    const tables=tableChunks.map((rows,i)=>allControlsIofTableHtml(rows,`IOF ${page}.${i+1}`)).join("");
    const eventTitle=escapeHtml(state.eventName||"ENTRENAMIENTO ORIENTACIÓN");
    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>IOF_trasera_${page}</title><style>
@page{size:A4 portrait;margin:0}
html,body{margin:0;padding:0;background:#eee;font-family:Arial,Helvetica,sans-serif;color:#111}
.sheet{width:210mm;height:297mm;background:#ebe3c8;margin:0 auto;position:relative;overflow:hidden;box-sizing:border-box;padding:7mm}
.back-title{height:14mm;background:#3f4a2c;color:#efe6c8;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:900;letter-spacing:2px;font-size:15px;margin-bottom:5mm}
.back-subtitle{position:absolute;left:7mm;right:7mm;bottom:3mm;text-align:center;font-size:7px;font-weight:900;color:#3f4a2c}
.iof-grid{display:grid;grid-template-columns:50mm 50mm 50mm;gap:6mm;align-items:start;justify-content:center}
.iof{width:50mm;border:2px solid #ff4fa3;color:#ff4fa3;font-weight:900;background:white;display:flex;flex-direction:column;box-sizing:border-box;padding:0!important;margin:0!important;justify-content:flex-start!important;align-items:stretch!important}
.iof:before{content:none!important;display:none!important}
.iof-desc-title{height:18px!important;min-height:18px!important;margin:0!important;padding:0!important;display:flex;align-items:center;justify-content:center;border-bottom:2px solid #ff4fa3;background:#f2f2f2;color:#ff4fa3;font-size:8px;font-weight:900;letter-spacing:.45px;box-sizing:border-box}
.iof-head{border-bottom:2px solid #ff4fa3;background:white;color:#ff4fa3;font-weight:900;font-size:8px;line-height:1.08}
.iof-title{height:15px;display:flex;align-items:center;justify-content:center;border-bottom:1.3px solid #ff4fa3;font-size:8px;background:#fff;overflow:hidden;white-space:nowrap;padding:0 2px;box-sizing:border-box}
.iof-difficulty{height:14px;display:flex;align-items:center;justify-content:center;border-bottom:1.3px solid #ff4fa3;font-size:7px;background:#fff}
.iof-metrics{display:grid;grid-template-columns:1fr 1.35fr 1.15fr;height:16px;border-bottom:1.3px solid #ff4fa3;background:#fff}
.iof-metrics div{display:flex;align-items:center;justify-content:center;border-right:1.3px solid #ff4fa3;font-size:8px;overflow:hidden}.iof-metrics div:last-child{border-right:0}
.iof-letters{display:grid;grid-template-columns:19px 34px repeat(6,1fr);height:15px;border-bottom:1.3px solid #ff4fa3;background:#fff}
.iof-letters div{display:flex;align-items:center;justify-content:center;border-right:1.3px solid #ff4fa3;font-size:8px}.iof-letters div:last-child{border-right:0}
.iof-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8px;color:#ff4fa3;background:#fff}
.iof-table td{border:1.3px solid #ff4fa3;height:17px;text-align:center;vertical-align:middle;overflow:hidden;white-space:nowrap;color:#ff4fa3}
.iof-table .col-a{width:19px}.iof-table .col-b{width:34px}.iof-table .code{font-size:7px}.iof-table .fcell{font-size:6.1px;letter-spacing:-.2px}.iof-table .gcell{font-size:6.1px;letter-spacing:-.25px}
.iof-table svg{width:18.8px;height:18.8px;color:#000!important;vertical-align:middle;display:inline-block;overflow:visible;filter:none!important}
.iof-table svg path,.iof-table svg line,.iof-table svg polyline,.iof-table svg rect,.iof-table svg circle,.iof-table svg ellipse,.iof-table svg polygon{fill:none;stroke:currentColor;stroke-width:8.2;stroke-linecap:round;stroke-linejoin:round}
.iof-table svg [fill]:not([fill="none"]):not([fill="transparent"]),.iof-table svg .fill,.iof-table svg.filled rect,.iof-table svg.filled circle,.iof-table svg.filled polygon,.iof-table svg text,.iof-table svg tspan{fill:currentColor}
.iof-table svg text,.iof-table svg tspan{stroke:none}
</style></head><body><div class="sheet"><div class="back-title">TABLA IOF TRASERA · ${eventTitle}</div><div class="iof-grid">${tables}</div><div class="back-subtitle">Impresión a doble cara · Página trasera ${page}/${totalPages} · Mismo formato, tamaño y símbolos que la tabla IOF lateral</div></div></body></html>`;
}

async function appendAllControlsIofOverflowPdfPages(pdf){
    const pointIds=allControlsPlanPointIds();
    const allRows=allControlsPlanIofRows(pointIds);
    const overflowRows=allRows.slice(ALL_CONTROLS_PLAN_FIRST_PAGE_IOF_MAX);
    if(!overflowRows.length)return;

    const html2canvas=await ensureHtml2Canvas();
    const rowsPerTable=ALL_CONTROLS_PLAN_FIRST_PAGE_IOF_MAX;
    const tableChunks=[];
    for(let i=0;i<overflowRows.length;i+=rowsPerTable){
        tableChunks.push(overflowRows.slice(i,i+rowsPerTable));
    }

    const pages=[];
    for(let i=0;i<tableChunks.length;i+=ALL_CONTROLS_IOF_TABLES_PER_BACK_PAGE){
        pages.push(tableChunks.slice(i,i+ALL_CONTROLS_IOF_TABLES_PER_BACK_PAGE));
    }

    const frame=document.createElement("iframe");
    frame.style.position="fixed";
    frame.style.left="-20000px";
    frame.style.top="0";
    frame.style.width="794px";
    frame.style.height="1123px";
    frame.style.border="0";
    frame.setAttribute("aria-hidden","true");
    document.body.appendChild(frame);

    try{
        for(let p=0;p<pages.length;p++){
            frame.srcdoc=allControlsIofOverflowPageHtml(pages[p],p+1,pages.length);
            await new Promise(resolve=>{
                const t=setTimeout(()=>resolve(),1000);
                frame.onload=()=>{clearTimeout(t);resolve();};
            });
            await waitMs(450);
            const doc=frame.contentDocument;
            const sheet=doc&&doc.querySelector(".sheet");
            if(!sheet)continue;

            const canvas=await html2canvas(sheet,{
                scale:2.2,
                useCORS:true,
                allowTaint:false,
                backgroundColor:"#ebe3c8",
                logging:false,
                width:sheet.scrollWidth,
                height:sheet.scrollHeight,
                windowWidth:sheet.scrollWidth,
                windowHeight:sheet.scrollHeight
            });
            recolorIofAreaBlackToPinkOnCanvas(canvas,frame);
            const img=canvas.toDataURL("image/jpeg",0.96);
            pdf.addPage([210,297],"portrait");
            pdf.addImage(img,"JPEG",0,0,210,297,undefined,"FAST");
        }
    }finally{
        setTimeout(()=>frame.remove(),500);
    }
}

function allControlsPlanHtml(){
    const pointIds=allControlsPlanPointIds();
    if(!pointIds.length)throw new Error("No hay puntos con coordenadas para crear el plano general.");

    const fakeRoute={participantId:"GENERAL",routeId:"TODAS_BALIZAS",points:pointIds};
    let html=participantPlanHtml(fakeRoute);

    const hideFrom=ALL_CONTROLS_PLAN_FIRST_PAGE_IOF_MAX+1;
    const overflowCount=Math.max(0,pointIds.length-ALL_CONTROLS_PLAN_FIRST_PAGE_IOF_MAX);
    const overflowCss=overflowCount>0
        ? `.iof-table tbody tr:nth-child(n+${hideFrom}){display:none!important}.iof:after{content:"Continúa en tabla IOF trasera: ${overflowCount} puntos";display:flex;align-items:center;justify-content:center;border-top:1.3px solid #ff4fa3;background:#fff;color:#ff4fa3;font-size:6.5px;font-weight:900;height:15px;text-align:center;padding:0 2px;box-sizing:border-box}`
        : "";

    html=html
        .replace(/<title>Plano_[^<]*<\/title>/, "<title>Plano_todas_balizas</title>")
        .replace(/Recorrido: GENERAL \/ TODAS_BALIZAS/g, "Plano general: todas las balizas")
        .replace(/const segs=\[\];[\s\S]*?lines\.innerHTML=segs\.join\(''\);/, "lines.innerHTML='';")
        .replace(/\+p\.markerOrder\+/g, "+p.id+")
        .replace(/font-size="23" font-weight="900"/g, "font-size=\"13\" font-weight=\"650\"")
        .replace(/\(x\+symbolRx\+5\)\.toFixed\(1\)/g, "(x+symbolRx+1.5).toFixed(1)")
        .replace(/\(y-symbolR-2\)\.toFixed\(1\)/g, "(y-symbolR+1).toFixed(1)")
        .replace(/Fondo común del evento · escala fija correcta/g, "Plano general de todas las balizas · escala fija correcta")
        .replace("</style>", overflowCss+"</style>");

    return html;
}


function participantPlanHtml(route){
    const routeIndex=(state.routes||[]).findIndex(r=>r.routeId===route.routeId&&r.participantId===route.participantId);
    const metric=(state.metrics||[])[routeIndex]||{};
    const routePoints=(route.points||[]).map(id=>state.points[id]).filter(Boolean);
    const allEventPoints=Object.values(state.points||{}).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));
    const fallbackPoints=routePoints.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));
    const eventTitle=escapeHtml(state.eventName||"ENTRENAMIENTO ORIENTACIÓN");
    const participant=escapeHtml(route.participantId||"P--");
    const routeId=escapeHtml(route.routeId||"R--");
    const routeNumber=escapeHtml(String(route.routeId||"").replace(/^R/i,"")||route.routeId||"-");
    const difficulty=escapeHtml(metric.difficulty||"-");
    const distance=metric.distanceKm!=null?`${metric.distanceKm} km`:"-";
    // En la cabecera lateral de la tabla IOF del plano PDF se muestra el desnivel positivo.
    // Antes se usaba metric.globalM, por eso podía salir -1 m si el desnivel global era negativo.
    const climb=metric.positiveM!=null?`${metric.positiveM} m`:"Sin desnivel real";
    const planScale=Number(state.planScale||10000)===7500?7500:10000;
    const planEquidistance=Number(state.planEquidistanceM||5)||5;
    const scaleLabel=`1/${planScale.toLocaleString("es-ES")}`;
    const pdfLayerKey=getSelectedPdfLayerKey();
    const pdfLayerMeta=getPdfBackgroundLayerMeta(pdfLayerKey);
    // Corrección de escala del plano generado desde HTML/canvas.
    // V63: escala física corregida. Se elimina la compensación 1,10 que reducía el plano
    // y obligaba a imprimir al 110 %. A tamaño real/100 %, 1 cm representa exactamente la escala elegida.
    const planHtmlToPdfMeasuredFactor=1.00;
    const scaleCheckMeters=planScale===7500?75:100;
    const scaleCheckWidthMm=10/planHtmlToPdfMeasuredFactor;

    const crestImg=window.MILITOPO_PLAN_ASSETS?.crest||"";

    const modernCompassImg=window.MILITOPO_PLAN_ASSETS?.compass||"";

    // Bloque del mapa en papel. Mismo tamaño y mismo fondo para todos los participantes.
    const mapPaperWidthMm=230;
    const mapPaperHeightMm=158;
    const terrainWidthM=mapPaperWidthMm*planHtmlToPdfMeasuredFactor*planScale/1000;
    const terrainHeightM=mapPaperHeightMm*planHtmlToPdfMeasuredFactor*planScale/1000;

    const pts=allEventPoints.length?allEventPoints:fallbackPoints;
    const automaticCenter=getAutomaticPlanPdfCenter(pts);
    const center=getSavedManualPlanPdfCenter()||automaticCenter;

    const mPerLat=111320;
    const mPerLon=111320*Math.cos(center.lat*Math.PI/180);
    const halfLat=(terrainHeightM/2)/mPerLat;
    const halfLon=(terrainWidthM/2)/(mPerLon||1);
    const bounds={north:center.lat+halfLat,south:center.lat-halfLat,west:center.lon-halfLon,east:center.lon+halfLon,centerLat:center.lat,centerLon:center.lon,widthM:terrainWidthM,heightM:terrainHeightM};
    const windowAreaKm2=(terrainWidthM*terrainHeightM)/1000000;
    const centerUtm=(typeof latLonToUtm==="function")?latLonToUtm(center.lat,center.lon):`${center.lat.toFixed(6)}, ${center.lon.toFixed(6)}`;


    const project=p=>{
        const x=((p.lon-bounds.west)/(bounds.east-bounds.west))*1000;
        const y=((bounds.north-p.lat)/(bounds.north-bounds.south))*1000;
        return {x,y};
    };
    const inside=p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&p.lat<=bounds.north&&p.lat>=bounds.south&&p.lon>=bounds.west&&p.lon<=bounds.east;
    const outOfBounds=pts.filter(p=>!inside(p)).map(p=>p.id);

    const pointData=routePoints.map((p,idx)=>{
        function raw(field){return ((state.iofDescriptions||{})[p.id]||{})[field]||""}
        const io=typeof getIofDescription==="function"?getIofDescription(p.id):{};
        const isStart=p.id==="START", isFinish=p.id==="FINISH";
        const n=isStart?"S":isFinish?"M":String(routePoints.slice(0,idx+1).filter(q=>q.id!=="START"&&q.id!=="FINISH").length);
        const pr=Number.isFinite(p.lat)&&Number.isFinite(p.lon)?project(p):{x:500,y:500};
        return {
            id:p.id, lat:p.lat, lon:p.lon, x:pr.x, y:pr.y, inside:inside(p),
            order:isStart?"▷":isFinish?"◎":n, markerOrder:n,
            type:isStart?"START":isFinish?"FINISH":"CONTROL",
            c:(io.cSymbol||raw("c")||""), d:(io.dSymbol||raw("d")||""), e:(io.eSymbol||raw("e")||""),
            f:(io.fSymbol||io.fText||raw("f")||raw("combo")||""), g:(io.gSymbol||""), h:(io.hSymbol||raw("h")||"")
        };
    });

    const json=JSON.stringify(pointData).replace(/</g,"\\u003c");
    const boundsJson=JSON.stringify(bounds).replace(/</g,"\\u003c");
    const warning=outOfBounds.length?`ATENCIÓN: no caben ${outOfBounds.length} punto(s) a esta escala: ${outOfBounds.join(", ")}`:"Fondo común del evento · escala fija correcta";

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Plano_${participant}_${routeId}</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
@page{size:A4 landscape;margin:0}
html,body{margin:0;padding:0;background:#eee;font-family:Arial,Helvetica,sans-serif;color:#111}
.toolbar{position:sticky;top:0;z-index:1000;background:rgba(255,255,255,.94);padding:8px;border-bottom:1px solid #ddd}
.toolbar button{border:0;border-radius:999px;background:#e45ac8;color:white;font-weight:900;padding:10px 16px}
.sheet{width:297mm;height:210mm;background:#ebe3c8;margin:0 auto;position:relative;overflow:hidden;box-sizing:border-box;border:0;padding:5mm}
.header{height:18mm;background:#3f4a2c;color:#efe6c8;display:grid;grid-template-columns:20mm 1fr 54mm;align-items:center;gap:4mm;padding:0 7mm;box-sizing:border-box}
.title{text-align:center}.title h1{margin:0;font-size:28px;letter-spacing:5px;font-weight:900}.title h2{margin:4px 0 0;font-size:18px;letter-spacing:3px;font-weight:900}
.scale{text-align:right;font-weight:900;font-size:20px}.scale small{display:block;font-size:13px}.crestBox{width:18mm;height:15mm;display:flex;align-items:center;justify-content:center;background:#f7efd7;border-radius:3px;overflow:hidden;padding:0}.crestBox img{width:100%;height:100%;object-fit:contain;display:block}.crestFallback{font-size:16px;font-weight:900;color:#3f4a2c}.northBox{width:18mm;height:15mm;display:flex;align-items:center;justify-content:center}.northSvg{width:16mm;height:16mm}.headerBrand{display:flex;align-items:center;justify-content:flex-end;gap:3mm;height:18mm;overflow:hidden}.headerBrandText{font-size:14px;letter-spacing:2.5px;font-weight:900;color:#efe6c8;white-space:nowrap}.headerMascot{width:16mm;height:16mm;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:3mm;background:rgba(0,0,0,.22);flex:0 0 auto}.headerMascot img{width:16mm;height:16mm;object-fit:cover;display:block}
.content{display:grid;grid-template-columns:230mm 50mm;gap:1mm;padding:4mm 1mm 0 5mm;height:162mm;box-sizing:border-box;background:#ebe3c8}
.map-wrap{position:relative;border:0;background:#e9ead7;overflow:hidden}.mapNorthCompass{position:absolute;top:4mm;right:4mm;width:22mm;height:22mm;z-index:9999;background:transparent;border:0;border-radius:50%;box-shadow:0 1mm 3mm rgba(0,0,0,.24);display:flex;align-items:center;justify-content:center;pointer-events:none;overflow:hidden}.mapNorthCompass img{width:100%;height:100%;object-fit:contain;display:block;filter:drop-shadow(0 .5mm .7mm rgba(0,0,0,.25))}.realScaleCheck{position:absolute;left:6mm;bottom:6mm;z-index:700;background:rgba(239,230,200,.92);border:1.2px solid #2f2a1e;padding:2mm 3mm;font-weight:900;color:#2f2a1e;font-size:9px}.realScaleBar{width:${scaleCheckWidthMm.toFixed(3)}mm;height:0;border-top:2px solid #2f2a1e;border-left:2px solid #2f2a1e;border-right:2px solid #2f2a1e;margin-bottom:1mm}.realScaleCheck small{display:block;font-size:7px;font-weight:800}
#participantPlanMap{width:100%;height:100%}.routeOverlay{position:absolute;inset:0;width:100%;height:100%;z-index:500;pointer-events:none}
.iof{border:2px solid #ff4fa3;color:#ff4fa3;font-weight:900;background:white;display:flex;flex-direction:column;padding:0!important;margin:0!important;justify-content:flex-start!important;align-items:stretch!important}
.iof:before{content:none!important;display:none!important}
.iof-desc-title{height:18px!important;min-height:18px!important;margin:0!important;padding:0!important;display:flex;align-items:center;justify-content:center;border-bottom:2px solid #ff4fa3;background:#f2f2f2;color:#ff4fa3;font-size:8px;font-weight:900;letter-spacing:.45px;box-sizing:border-box}
.iof-head{border-bottom:2px solid #ff4fa3;background:white;color:#ff4fa3;font-weight:900;font-size:8px;line-height:1.08}
.iof-title{height:15px;display:flex;align-items:center;justify-content:center;border-bottom:1.3px solid #ff4fa3;font-size:8px;background:#fff;overflow:hidden;white-space:nowrap}
.iof-difficulty{height:14px;display:flex;align-items:center;justify-content:center;border-bottom:1.3px solid #ff4fa3;font-size:8px;background:#fff}
.iof-metrics{display:grid;grid-template-columns:1fr 1.35fr 1.15fr;height:16px;border-bottom:1.3px solid #ff4fa3;background:#fff}
.iof-metrics div{display:flex;align-items:center;justify-content:center;border-right:1.3px solid #ff4fa3;font-size:8px}.iof-metrics div:last-child{border-right:0}
.iof-letters{display:grid;grid-template-columns:19px 34px repeat(6,1fr);height:15px;border-bottom:1.3px solid #ff4fa3;background:#fff}
.iof-letters div{display:flex;align-items:center;justify-content:center;border-right:1.3px solid #ff4fa3;font-size:8px}.iof-letters div:last-child{border-right:0}
.iof-table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8px;color:#ff4fa3;background:#fff}.iof-table td{border:1.3px solid #ff4fa3;height:17px;text-align:center;vertical-align:middle;overflow:hidden;white-space:nowrap;color:#ff4fa3}
.iof-table .col-a{width:19px}.iof-table .col-b{width:34px}.iof-table .code{font-size:7px}.iof-table .fcell{font-size:6.1px;letter-spacing:-.2px}.iof-table .gcell{font-size:6.1px;letter-spacing:-.25px}.iof-table svg{width:18.8px;height:18.8px;color:#000!important;vertical-align:middle;display:inline-block;overflow:visible;filter:none!important}.iof-table svg path,.iof-table svg line,.iof-table svg polyline,.iof-table svg rect,.iof-table svg circle,.iof-table svg ellipse,.iof-table svg polygon{fill:none;stroke:currentColor;stroke-width:8.2;stroke-linecap:round;stroke-linejoin:round}.iof-table svg [fill]:not([fill="none"]):not([fill="transparent"]),.iof-table svg .fill,.iof-table svg.filled rect,.iof-table svg.filled circle,.iof-table svg.filled polygon,.iof-table svg text,.iof-table svg tspan{fill:currentColor}.iof-table svg text,.iof-table svg tspan{stroke:none}.iof-table svg image{filter:grayscale(100%) contrast(125%)!important}.footer{height:20mm;display:grid;grid-template-columns:125mm 1fr;align-items:center;padding:1.5mm 5mm 3mm;box-sizing:border-box;font-size:6.6px;background:#ebe3c8;border-top:2px solid #9a7b3f}
.footer .tech{color:#354126;font-weight:900;line-height:1.12}.footer .note{text-align:right;font-weight:900;font-size:10px;color:#2f2a1e;line-height:1.2}.warn{color:${outOfBounds.length?"#a00000":"#354126"};font-weight:900}
.leaflet-control-attribution{display:none}
@media print{.toolbar{display:none}.sheet{margin:0;border:0}body{background:white}}
.iof-table .iof-c-svg,.symCell .iof-c-svg{width:17.2px;height:17.2px;color:#000;display:inline-block;vertical-align:middle}.iof-table .iof-c-svg path,.iof-table .iof-c-svg line,.iof-table .iof-c-svg polyline,.symCell .iof-c-svg path,.symCell .iof-c-svg line,.symCell .iof-c-svg polyline{fill:none;stroke:currentColor;stroke-width:9.2;stroke-linecap:round;stroke-linejoin:round}.iof-table .iof-c-svg circle,.symCell .iof-c-svg circle{fill:currentColor;stroke:none}.iof-table .iof-g-svg{width:17.2px;height:17.2px;color:#000;vertical-align:middle}.iof-table .iof-g-svg path,.iof-table .iof-g-svg line,.iof-table .iof-g-svg rect,.iof-table .iof-g-svg circle,.iof-table .iof-g-svg ellipse,.iof-table .iof-g-svg polygon{fill:none;stroke:currentColor;stroke-width:8;stroke-linecap:round;stroke-linejoin:round}.iof-table .iof-g-svg .fill{fill:currentColor;stroke:none}.iof-table .iof-combo-svg,.symCell .iof-combo-svg,.symbol .iof-combo-svg{width:17.2px;height:17.2px;color:#000;display:inline-block;vertical-align:middle}</style></head><body>
<div class="toolbar"><button onclick="window.print()">🖨️ Imprimir / guardar PDF</button></div>
<div class="sheet"><div class="header"><div class="crestBox">${crestImg?`<img src="${crestImg}" alt="Escudo III Bandera">`:`<div class="crestFallback">III</div>`}</div><div class="title"><h1>${eventTitle}</h1><h2>E: ${scaleLabel} · EQ ${planEquidistance} m</h2></div><div class="headerBrand"><div class="headerBrandText">MILITOPO</div><div class="headerMascot"><img src="data:image/jpeg;base64,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" alt="Icono Militopo"></div></div></div>
<div class="content"><div class="map-wrap"><div id="participantPlanMap"></div><svg class="routeOverlay" viewBox="0 0 1000 1000" preserveAspectRatio="none"><g id="courseLines"></g><g id="courseMarkers"></g></svg><div class="mapNorthCompass" aria-label="Norte del plano"><img src="${modernCompassImg}" alt="Brújula MILITOPO"></div><div class="realScaleCheck"><div class="realScaleBar"></div>1 cm = ${scaleCheckMeters} m<small>${scaleLabel}</small></div></div>
<div class="iof" style="border:2px solid #ff4fa3!important;color:#ff4fa3!important;padding:0!important;margin:0!important;justify-content:flex-start!important;align-items:stretch!important"><div class="iof-desc-title" style="height:18px!important;min-height:18px!important;margin:0!important;padding:0!important;border-bottom:2px solid #ff4fa3!important;color:#ff4fa3!important;background:#f2f2f2!important">DESCRIPCIÓN IOF</div><div class="iof-head" style="border-bottom:2px solid #ff4fa3!important;color:#ff4fa3!important"><div class="iof-title" style="border-bottom:1.3px solid #ff4fa3!important;color:#ff4fa3!important">${eventTitle}</div><div class="iof-difficulty" style="border-bottom:1.3px solid #ff4fa3!important;color:#ff4fa3!important">${difficulty}</div><div class="iof-metrics" style="border-bottom:1.3px solid #ff4fa3!important;color:#ff4fa3!important"><div style="border-right:1.3px solid #ff4fa3!important;color:#ff4fa3!important">${routeNumber}</div><div style="border-right:1.3px solid #ff4fa3!important;color:#ff4fa3!important">${distance}</div><div style="color:#ff4fa3!important">${climb}</div></div><div class="iof-letters" style="border-bottom:1.3px solid #ff4fa3!important;color:#ff4fa3!important"><div style="border-right:1.3px solid #ff4fa3!important;color:#ff4fa3!important">A</div><div style="border-right:1.3px solid #ff4fa3!important;color:#ff4fa3!important">B</div><div style="border-right:1.3px solid #ff4fa3!important;color:#ff4fa3!important">C</div><div style="border-right:1.3px solid #ff4fa3!important;color:#ff4fa3!important">D</div><div style="border-right:1.3px solid #ff4fa3!important;color:#ff4fa3!important">E</div><div style="border-right:1.3px solid #ff4fa3!important;color:#ff4fa3!important">F</div><div style="border-right:1.3px solid #ff4fa3!important;color:#ff4fa3!important">G</div><div style="color:#ff4fa3!important">H</div></div></div>
<table class="iof-table"><colgroup><col class="col-a"><col class="col-b"><col><col><col><col><col><col></colgroup><tbody>${pointData.map(p=>`<tr><td style="border:1.3px solid #ff4fa3!important;color:#ff4fa3!important;background:#fff!important">${escapeHtml(String(p.order))}</td><td class="code" style="border:1.3px solid #ff4fa3!important;color:#ff4fa3!important;background:#fff!important">${escapeHtml(p.type==="START"?"SALIDA":p.type==="FINISH"?"META":p.id)}</td><td style="border:1.3px solid #ff4fa3!important;color:#ff4fa3!important;background:#fff!important">${renderIofCellSymbol(p.c)}</td><td style="border:1.3px solid #ff4fa3!important;color:#ff4fa3!important;background:#fff!important">${renderIofCellSymbol(p.d)}</td><td style="border:1.3px solid #ff4fa3!important;color:#ff4fa3!important;background:#fff!important">${renderIofCellSymbol(p.e)}</td><td class="fcell" style="border:1.3px solid #ff4fa3!important;color:#ff4fa3!important;background:#fff!important">${renderIofCellSymbol(p.f)}</td><td class="gcell" style="border:1.3px solid #ff4fa3!important;color:#ff4fa3!important;background:#fff!important">${renderIofCellSymbol(p.g)}</td><td style="border:1.3px solid #ff4fa3!important;color:#ff4fa3!important;background:#fff!important">${renderIofCellSymbol(p.h)}</td></tr>`).join("")}</tbody></table></div></div>
<div class="footer"><div class="tech">FICHA TÉCNICA:<br>Evento: ${escapeHtml(state.eventId||"")}<br>Plano: ${escapeHtml(pdfLayerMeta.label)}<br>Escala: ${scaleLabel}<br>Equidistancia: ${planEquidistance} m<br>Ventana común: ${Math.round(terrainWidthM)} m × ${Math.round(terrainHeightM)} m = ${windowAreaKm2.toFixed(2)} km²<br>Centro UTM: ${escapeHtml(centerUtm)}<br>Recorrido: ${participant} / ${routeId}</div><div class="note">El deporte de orientación es respetuoso con el medio natural, cuida la naturaleza.</div></div></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<script>
const points=${json}; const commonBounds=${boundsJson}; const pdfLayerKey=${JSON.stringify(pdfLayerKey)}; window.militopoPlanExportBounds=commonBounds; window.militopoPlanExportLayer=pdfLayerKey;
const map=L.map('participantPlanMap',{zoomControl:false,attributionControl:false,preferCanvas:true,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false,touchZoom:false}).setView([commonBounds.centerLat,commonBounds.centerLon],15);
function createPdfSelectedLayer(key){
    if(key==='ign')return L.tileLayer('https://www.ign.es/wmts/mapa-raster?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=MTN&STYLE=default&TILEMATRIXSET=GoogleMapsCompatible&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',{maxNativeZoom:18,maxZoom:22,crossOrigin:true});
    if(key==='pnoa')return L.tileLayer('https://www.ign.es/wmts/pnoa-ma?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=OI.OrthoimageCoverage&STYLE=default&TILEMATRIXSET=GoogleMapsCompatible&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',{maxNativeZoom:19,maxZoom:22,crossOrigin:true});
    if(key==='custom')return L.layerGroup();
    return L.tileLayer.wms('https://raster.trailmap.fi/mapproxy/service',{layers:'spain_mapant',styles:'',format:'image/png',transparent:false,version:'1.1.1',attribution:'© MapAnt / Trailmap',minZoom:0,maxZoom:22,tileSize:256,crossOrigin:true,updateWhenIdle:false,updateWhenZooming:true,keepBuffer:4});
}
createPdfSelectedLayer(pdfLayerKey).addTo(map);
const bounds=[[commonBounds.south,commonBounds.west],[commonBounds.north,commonBounds.east]];
function drawCourse(){
    const lines=document.getElementById('courseLines'), markers=document.getElementById('courseMarkers');
    if(!lines||!markers)return;

    // Símbolos uniformes y pequeños: el punto real queda en el centro del círculo/meta,
    // y en el vértice del triángulo de salida.
    const symbolR=10;
    const strokeW=1.15; // V62: borde de círculos/símbolos PDF más fino para no tapar cartografía
    const lineW=1.7;
    const cutGap=symbolR+2.2;

    // Corrección círculos perfectos:
    // El SVG del recorrido usa viewBox 1000x1000 con preserveAspectRatio="none".
    // Al encajar sobre un área rectangular, un <circle> se estira y sale como óvalo.
    // Por eso usamos <ellipse> compensada en X según la proporción real del área del plano.
    const mapWrap=document.querySelector(".map-wrap");
    const mapAspectFix=mapWrap ? (mapWrap.clientHeight / Math.max(1,mapWrap.clientWidth)) : (162/230);
    const symbolRx=symbolR*mapAspectFix;
    const finishInnerRx=(symbolR*0.58)*mapAspectFix;

    function unit(a,b){
        const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;
        return {ux:dx/d,uy:dy/d,dx,dy,d};
    }

    const segs=[];
    for(let i=0;i<points.length-1;i++){
        const a=points[i],b=points[i+1];
        const u=unit(a,b);
        const g1=a.type==='START'?0:cutGap;
        const g2=cutGap;
        const x1=a.x+u.ux*g1,y1=a.y+u.uy*g1;
        const x2=b.x-u.ux*g2,y2=b.y-u.uy*g2;
        if(Math.hypot(x2-x1,y2-y1)>1){
            segs.push('<line x1="'+x1.toFixed(1)+'" y1="'+y1.toFixed(1)+'" x2="'+x2.toFixed(1)+'" y2="'+y2.toFixed(1)+'" stroke="#e45ac8" stroke-width="'+lineW+'" stroke-linecap="round" vector-effect="non-scaling-stroke"/>');
        }
    }
    lines.innerHTML=segs.join('');

    markers.innerHTML=points.map((p,i)=>{
        const x=p.x,y=p.y;
        if(p.type==='START'){
            const next=points[i+1]||p;
            const u=unit(p,next);
            const px=-u.uy,py=u.ux;
            const tipX=x,tipY=y;
            const baseCX=x-u.ux*symbolR*1.55,baseCY=y-u.uy*symbolR*1.55;
            const p2x=baseCX+px*symbolR*.92,p2y=baseCY+py*symbolR*.92;
            const p3x=baseCX-px*symbolR*.92,p3y=baseCY-py*symbolR*.92;
            return '<polygon points="'+tipX.toFixed(1)+','+tipY.toFixed(1)+' '+p2x.toFixed(1)+','+p2y.toFixed(1)+' '+p3x.toFixed(1)+','+p3y.toFixed(1)+'" fill="none" stroke="#e45ac8" stroke-width="'+strokeW+'" vector-effect="non-scaling-stroke"/>';
        }
        if(p.type==='FINISH'){
            return '<ellipse cx="'+x+'" cy="'+y+'" rx="'+finishInnerRx.toFixed(1)+'" ry="'+(symbolR*0.58).toFixed(1)+'" fill="none" stroke="#e45ac8" stroke-width="'+strokeW+'" vector-effect="non-scaling-stroke"/><ellipse cx="'+x+'" cy="'+y+'" rx="'+symbolRx.toFixed(1)+'" ry="'+symbolR+'" fill="none" stroke="#e45ac8" stroke-width="'+strokeW+'" vector-effect="non-scaling-stroke"/>';
        }
        return '<ellipse cx="'+x+'" cy="'+y+'" rx="'+symbolRx.toFixed(1)+'" ry="'+symbolR+'" fill="none" stroke="#e45ac8" stroke-width="'+strokeW+'" vector-effect="non-scaling-stroke"/><text x="'+(x+symbolRx+5).toFixed(1)+'" y="'+(y-symbolR-2).toFixed(1)+'" fill="#e45ac8" font-size="23" font-weight="900">'+p.markerOrder+'</text>';
    }).join('');
}

setTimeout(()=>{map.invalidateSize();map.fitBounds(bounds,{padding:[0,0],animate:false});drawCourse();},250);
<\/script></body></html>`;
}









/* MILITOPO · importar y reutilizar un ejercicio completo desde ZIP o JSON */
const STORAGE_KEY_PRE_IMPORT_BACKUP="militopo_orientacion_pre_import_backup_v1";

function setupReusableExerciseImporter(){
    const step1=document.getElementById("step1");
    if(!step1 || document.getElementById("reuseExerciseImportBlock"))return;

    const block=document.createElement("div");
    block.id="reuseExerciseImportBlock";
    block.className="block militopo-reuse-exercise-block";
    block.innerHTML=`
        <label>♻️ REUTILIZAR EJERCICIO ANTERIOR</label>
        <div class="militopo-reuse-copy">
            <b>Importa</b> el <b>ZIP completo del evento o</b> su archivo <b>evento_orientacion.json</b>.
            Se conservarán puntos, recorridos, participantes, QR, planos y descripciones; se reiniciarán tiempos, escaneos y resultados.
        </div>
        <input id="reuseExerciseFileInput" type="file" hidden>
        <div class="btn-row militopo-reuse-actions">
            <button id="reuseExerciseChooseBtn" type="button" class="btn green"><span aria-hidden="true" style="font-size:1.65em;line-height:1;display:inline-block;vertical-align:-0.12em;margin-right:.22em">🏃</span> IMPORTAR EJERCICIO ANTERIOR</button>
        </div>
        <div id="reuseExerciseImportStatus" class="status warn" style="display:none"></div>`;

    const firstGrid=step1.querySelector(".grid.two");
    if(firstGrid && firstGrid.parentNode){
        firstGrid.insertAdjacentElement("afterend",block);
    }else{
        const nav=step1.querySelector(".nav-buttons,.btn-row");
        if(nav)nav.insertAdjacentElement("beforebegin",block); else step1.appendChild(block);
    }

    const style=document.createElement("style");
    style.id="militopoReusableExerciseStyles";
    style.textContent=`
        #reuseExerciseImportBlock{margin-top:18px;padding:18px;border-radius:24px;border:1px solid rgba(237,214,145,.24);background:linear-gradient(180deg,rgba(112,145,74,.16),rgba(36,52,29,.16));box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 12px 28px rgba(0,0,0,.10)}
        #reuseExerciseImportBlock>label{display:block;margin-bottom:9px;font-weight:900;letter-spacing:.04em}
        .militopo-reuse-copy{font-size:.82rem;line-height:1.45;color:rgba(255,248,234,.78);margin-bottom:13px}
        .militopo-reuse-actions{display:flex;gap:10px;flex-wrap:wrap}
        #reuseExerciseChooseBtn{min-height:46px}
        #reuseExerciseImportStatus{margin-top:12px;white-space:pre-line}
    `;
    document.head.appendChild(style);

    const input=document.getElementById("reuseExerciseFileInput");
    document.getElementById("reuseExerciseChooseBtn")?.addEventListener("click",()=>input?.click());
    input?.addEventListener("change",async event=>{
        const file=event.target.files&&event.target.files[0];
        event.target.value="";
        if(file)await importReusableExerciseFile(file);
    });
}

function setReusableExerciseStatus(message,type="warn"){
    const el=document.getElementById("reuseExerciseImportStatus");
    if(!el)return;
    el.style.display="block";
    el.className="status "+type;
    el.textContent=message;
}

async function readReusableExerciseFile(file){
    if(!file)throw new Error("No se ha seleccionado ningún archivo.");

    // En iPhone/iPad el selector puede ocultar archivos ZIP si se limita con accept.
    // Por eso se permite seleccionar cualquier archivo y se detecta su contenido.
    const name=String(file.name||"").toLowerCase();
    const type=String(file.type||"").toLowerCase();

    const tryJson=async()=>{
        const text=await file.text();
        const trimmed=text.replace(/^\uFEFF/,"").trim();
        if(!trimmed || (trimmed[0]!=="{" && trimmed[0]!=="["))throw new Error("No parece JSON");
        return JSON.parse(trimmed);
    };

    const tryZip=async()=>{
        if(typeof JSZip==="undefined")throw new Error("JSZip no está disponible. Recarga la aplicación e inténtalo de nuevo.");
        const zip=await JSZip.loadAsync(file);
        let entry=zip.file("Otros documentos/evento_orientacion.json");
        if(!entry){
            const candidates=Object.values(zip.files).filter(item=>!item.dir && /(^|\/)evento_orientacion\.json$/i.test(item.name));
            entry=candidates[0]||null;
        }
        if(!entry)throw new Error("El ZIP no contiene Otros documentos/evento_orientacion.json.");
        return JSON.parse(await entry.async("string"));
    };

    if(name.endsWith(".json") || type.includes("json")){
        try{return await tryJson();}catch(e){}
    }
    if(name.endsWith(".zip") || type.includes("zip") || type.includes("compressed")){
        try{return await tryZip();}catch(e){throw e;}
    }

    // Si iOS entrega el archivo sin extensión o con MIME genérico, probamos ambos formatos.
    try{return await tryJson();}catch(jsonError){}
    try{return await tryZip();}catch(zipError){
        throw new Error("El archivo seleccionado no contiene un ejercicio MILITOPO válido. Selecciona el ZIP del evento o evento_orientacion.json.");
    }
}

function validateReusableExerciseData(data){
    if(!data || typeof data!=="object")throw new Error("El archivo no contiene un ejercicio válido.");
    if(!data.eventId)throw new Error("Falta el identificador eventId. No se pueden reutilizar los QR impresos.");
    if(!data.points || typeof data.points!=="object")throw new Error("El ejercicio no contiene puntos.");
    if(!data.points.START || !data.points.FINISH)throw new Error("El ejercicio debe contener salida y llegada.");
    if(!Array.isArray(data.routes) || !data.routes.length)throw new Error("El ejercicio no contiene recorridos generados.");
    const invalidRoute=data.routes.find(route=>!route || !route.routeId || !route.participantId || !Array.isArray(route.points));
    if(invalidRoute)throw new Error("Hay algún recorrido incompleto o incompatible.");
    return true;
}


function clearOrganizerSavedStateBeforeReusableImport(){
    try{clearTimeout(__autoSaveTimer)}catch(e){}
    try{localStorage.removeItem(STORAGE_KEY_MAIN)}catch(e){}
    try{localStorage.removeItem(STORAGE_KEY_BACKUP)}catch(e){}
    try{localStorage.removeItem(STORAGE_KEY_LEGACY)}catch(e){}
    try{localStorage.removeItem(STORAGE_KEY_LAST_STEP)}catch(e){}
    try{sessionStorage.removeItem(STORAGE_KEY_SESSION);sessionStorage.removeItem(STORAGE_KEY_LEGACY);sessionStorage.removeItem(STORAGE_KEY_LAST_STEP)}catch(e){}
    try{if(String(window.name||"").startsWith(WINDOW_NAME_PREFIX))window.name=""}catch(e){}
}

function hardResetStateForReusableExerciseImport(){
    Object.keys(state).forEach(key=>delete state[key]);
    Object.assign(state,{
        eventId:"",
        eventName:"ENTRENAMIENTO ORIENTACIÓN",
        planScale:10000,
        pdfPlanCenterManual:null,
        selectedMapLayer:"mapant",
        planEquidistanceM:5,
        participantCount:10,
        maxUniqueRoutes:15,
        controlCount:25,
        controlsPerRoute:8,
        maxControlReuse:6,
        points:{},
        routes:[],
        metrics:[],
        elevations:{},
        participantLogs:{},
        participantNames:{},
        skippedRoutes:{},
        importedResults:[],
        iofDescriptions:{},
        routeWarnings:[],
        startFlowStatus:{},
        startTimes:{},
        finishTimes:{},
        scanHistory:[],
        classification:[],
        liveRunId:"",
        liveRunStartedAt:"",
        liveRunStatus:""
    });
    selectedPointId="START";
    selectedIofPointId="START";
}

function clearAllReusableExerciseRuntimeStorage(eventId){
    try{
        const eventRaw=String(eventId||"").trim();if(!eventRaw)return;
        const safe=eventRaw.replace(/[.#$\[\]\/]/g,"-").replace(/\s+/g,"-").replace(/-+/g,"-").slice(0,100);
        const exactKeys=new Set([
            "militopo_v1_live_v2_organizer_run_"+safe,
            "militopo_v1_live_v2_auto_import_"+safe,
            "militopo_orientacion_last_live_run_"+safe
        ]);
        const eventPrefixes=["militopo_v1_live_v2_organizer_snapshot_"+safe, "militopo_v1_live_v2_last_sync_"+safe];
        const wipeScoped=storage=>{try{const keys=[];for(let i=0;i<storage.length;i++)keys.push(storage.key(i));keys.filter(Boolean).forEach(k=>{const key=String(k);if(exactKeys.has(key)||eventPrefixes.some(prefix=>key.startsWith(prefix)))storage.removeItem(key)})}catch(_){}};
        wipeScoped(localStorage);wipeScoped(sessionStorage);
        // La cola es compartida entre eventos: retirar únicamente entradas del evento restaurado.
        try{const qKey="militopo_v1_live_v2_pending_events",raw=localStorage.getItem(qKey),queue=raw?JSON.parse(raw):[];if(Array.isArray(queue)){const keep=queue.filter(item=>String(item?.eventKey||item?.eventId||"")!==safe&&String(item?.eventId||"")!==eventRaw);keep.length?localStorage.setItem(qKey,JSON.stringify(keep)):localStorage.removeItem(qKey)}}catch(_){ }
        // El contexto participante también es global; solo se borra si pertenece al mismo evento.
        try{const cKey="militopo_v1_live_v2_participant_context",ctx=JSON.parse(localStorage.getItem(cKey)||"null");if(ctx&&(String(ctx.eventId||"")===eventRaw||String(ctx.eventKey||"")===safe))localStorage.removeItem(cKey)}catch(_){ }
    }catch(e){console.warn("No se pudo limpiar el runtime del evento",e)}
}

function resetRuntimeForReusableExerciseImport(){
    try{
        state.participantLogs={};
        state.importedResults=[];
        state.startTimes={};
        state.finishTimes={};
        state.scanHistory=[];
        state.classification=[];
        state.startFlowStatus={};
        state.participantNames={};
        state.skippedRoutes={};
        state.liveRunId="";
        state.liveRunStartedAt="";
        state.liveRunStatus="";
    }catch(e){}
}

function clearReusableExerciseLocalRuntimeKeys(eventId){clearAllReusableExerciseRuntimeStorage(eventId)}

async function resetLiveForReusableExerciseImport(eventId){
    try{
        if(window.MILITOPO_LIVE_PHASE2 && typeof window.MILITOPO_LIVE_PHASE2.resetOrganizerEventForReusableExercise==="function"){
            const allowed=await window.MILITOPO_LIVE_PHASE2.resetOrganizerEventForReusableExercise(eventId);
            if(allowed===false)return false;
        }
        clearReusableExerciseLocalRuntimeKeys(eventId);
        return true;
    }catch(e){
        console.warn("No se pudo reiniciar la carrera en vivo al restaurar ejercicio",e);
        return false;
    }
}

function applyReusableExerciseData(data){
    hardResetStateForReusableExerciseImport();
    const cfg=data.config||{};
    const plan=data.plan||{};
    const routes=safeJsonClone(data.routes||[],[]);
    const points=safeJsonClone(data.points||{},{});

    state.eventId=String(data.eventId);
    state.eventName=String(data.eventName||"ENTRENAMIENTO ORIENTACIÓN");
    state.participantCount=routes.length||Number(cfg.participantCount)||10;
    state.controlCount=Number(cfg.controlCount)||Object.values(points).filter(p=>p&&p.type==="BALIZA").length;
    state.controlsPerRoute=Number(cfg.controlsPerRoute)||Math.max(2,(routes[0]?.points||[]).filter(id=>id!=="START"&&id!=="FINISH").length);
    state.maxControlReuse=Number(cfg.maxControlReuse)||6;
    state.planScale=Number(plan.scale||cfg.planScale)===7500?7500:10000;
    state.planEquidistanceM=Number(plan.equidistanceM||cfg.planEquidistanceM)||5;
    state.selectedMapLayer=["mapant","ign","pnoa","custom"].includes(String(plan.backgroundLayer||cfg.selectedMapLayer||"mapant"))?String(plan.backgroundLayer||cfg.selectedMapLayer||"mapant"):"mapant";
    state.pdfPlanCenterManual=plan.manualCenter&&Number.isFinite(Number(plan.manualCenter.lat))&&Number.isFinite(Number(plan.manualCenter.lon))
        ? {lat:Number(plan.manualCenter.lat),lon:Number(plan.manualCenter.lon)}
        : null;
    state.points=points;
    state.routes=routes;
    state.metrics=safeJsonClone(data.metrics||[],[]);
    state.elevations=safeJsonClone(data.elevations||{},{});
    state.iofDescriptions=safeJsonClone(data.iofDescriptions||{},{});
    // Nueva repetición limpia: no se heredan nombres, descartes ni estados de otra carrera.
    state.participantNames={};
    state.skippedRoutes={};
    state.routeWarnings=safeJsonClone(data.routeWarnings||[],[]);

    // Nueva ejecución del mismo material: se limpia únicamente la actividad anterior.
    state.participantLogs={};
    state.importedResults=[];
    state.startTimes={};
    state.finishTimes={};
    state.scanHistory=[];
    state.classification=[];
    state.startFlowStatus={};
    state.liveRunId="";
    state.liveRunStartedAt="";
    state.liveRunStatus="";

    const symbols=data.customIofSymbols||{};
    try{
        if(symbols.general){
            localStorage.setItem("militopo_iof_custom_symbols_v4_c_h_combo_cruce_union_curva",JSON.stringify(symbols.general));
            customIofSymbols=safeJsonClone(symbols.general,{combo:{},f:{},g:{}});
        }
        if(symbols.d)localStorage.setItem("militopo_iof_d_custom_symbols_v1",JSON.stringify(symbols.d));
    }catch(e){}

    selectedPointId="START";
    selectedIofPointId="START";
}

async function importReusableExerciseFile(file){
    const button=document.getElementById("reuseExerciseChooseBtn");
    const beforeState=cloneStateForSave();
    const beforeStep=currentAppStep;
    try{
        if(button){button.disabled=true;button.textContent="IMPORTANDO...";}
        setReusableExerciseStatus("Leyendo y comprobando el ejercicio...","warn");
        const data=await readReusableExerciseFile(file);
        validateReusableExerciseData(data);

        const routeCount=data.routes.length;
        const pointCount=Object.keys(data.points||{}).length;
        const confirmText=`Se va a restaurar “${data.eventName||data.eventId}” con ${routeCount} recorridos y ${pointCount} puntos.\n\nSe conservará el eventId para reutilizar los QR y planos impresos. Se borrarán únicamente tiempos, escaneos y resultados anteriores.\n\n¿Continuar?`;
        if(!confirm(confirmText)){
            setReusableExerciseStatus("Importación cancelada. No se ha modificado el ejercicio actual.","warn");
            return;
        }

        try{localStorage.setItem(STORAGE_KEY_PRE_IMPORT_BACKUP,JSON.stringify({savedAt:new Date().toISOString(),currentStep:beforeStep,state:beforeState}))}catch(e){}
        const liveResetAllowed=await resetLiveForReusableExerciseImport(data.eventId);
        if(!liveResetAllowed){
            setReusableExerciseStatus("Restauración bloqueada: todavía hay participantes en carrera o datos pendientes de sincronizar.","warn");
            return;
        }
        clearOrganizerSavedStateBeforeReusableImport();
        clearAllReusableExerciseRuntimeStorage(data.eventId);
        applyReusableExerciseData(data);
        resetRuntimeForReusableExerciseImport();
        clearAllReusableExerciseRuntimeStorage(state.eventId);

        syncConfigToUi();
        syncPlanScaleSettingUi();
        renderPointSelectors();
        renderPointsTable();
        renderIofDescriptionsEditor();
        updateParticipantSelect();
        updateRouteCountInfo();
        // Aunque la importación abra directamente el paso 5, dejamos preparados
        // los pasos intermedios para que al volver a ellos reflejen todo lo cargado.
        if(typeof renderRoutes==="function")renderRoutes();
        if(typeof renderQrPreview==="function")renderQrPreview();
        if(typeof renderMapMarkers==="function")renderMapMarkers();
        if(typeof renderPlanPdfPreview==="function")renderPlanPdfPreview();
        if(typeof updateOrganizerParticipantSelects==="function")updateOrganizerParticipantSelects();
        if(typeof renderStartFlowStatusPanel==="function")renderStartFlowStatusPanel();
        if(typeof hideStep5DeliveryConfirmPanels==="function")hideStep5DeliveryConfirmPanels();
        if(typeof cleanupStartFlowStatusStore==="function")cleanupStartFlowStatusStore();
        if(typeof renderImportedResults==="function")renderImportedResults();
        if(typeof renderStep5RoutePicker==="function"){renderStep5RoutePicker("start");renderStep5RoutePicker("finish");}

        currentAppStep=5;
        saveState();
        goStep(5,{silent:true});
        setReusableExerciseStatus(`✅ Ejercicio restaurado: ${state.eventName}\n${state.routes.length} recorridos · listo en el Paso 5.`,"ok");
        setRestoreStatus(`✅ Ejercicio importado y preparado para repetición · ${state.eventId}`,"ok");
        toast("Ejercicio restaurado · listo en Paso 5");
    }catch(error){
        console.error("Error importando ejercicio reutilizable:",error);
        Object.keys(state).forEach(key=>delete state[key]);
        Object.assign(state,beforeState);
        currentAppStep=beforeStep;
        try{
            syncConfigToUi();
            syncPlanScaleSettingUi();
            renderPointSelectors();
            renderPointsTable();
            renderIofDescriptionsEditor();
            updateParticipantSelect();
            updateRouteCountInfo();
            goStep(beforeStep,{silent:true,noScroll:true});
        }catch(e){}
        setReusableExerciseStatus("❌ No se ha importado nada: "+(error&&error.message?error.message:error),"err");
        toast("No se pudo importar el ejercicio");
    }finally{
        if(button){button.disabled=false;button.innerHTML='<span aria-hidden="true" style="font-size:1.65em;line-height:1;display:inline-block;vertical-align:-0.12em;margin-right:.22em">🏃</span> IMPORTAR EJERCICIO ANTERIOR';}
    }
}

document.addEventListener("DOMContentLoaded",setupReusableExerciseImporter);


const STORAGE_KEY_MAIN="militopo_orientacion_autosave_v2";
const STORAGE_KEY_BACKUP="militopo_orientacion_autosave_backup_v2";
const STORAGE_KEY_SESSION="militopo_orientacion_autosave_session_v2";
const STORAGE_KEY_LEGACY="militopo_orientacion_v1";
const STORAGE_KEY_LAST_STEP="militopo_orientacion_last_step_v2";
const WINDOW_NAME_PREFIX="MILITOPO_ORGANIZER_BACKUP:";
const DURABLE_ORGANIZER_DB="MILITOPO_V1_ORGANIZER_STATE_V1";
const DURABLE_ORGANIZER_EVENT_STORE="events";
const DURABLE_ORGANIZER_TRACK_STORE="resultTracks";
const __durableTrackSignatures=new Map();

function withOrganizerTimeout(promise,ms=1800,label="operación IndexedDB"){
    return new Promise((resolve,reject)=>{
        let done=false;
        const timer=setTimeout(()=>{if(done)return;done=true;reject(new Error(label+" excedió el tiempo máximo"))},ms);
        Promise.resolve(promise).then(value=>{if(done)return;done=true;clearTimeout(timer);resolve(value)},error=>{if(done)return;done=true;clearTimeout(timer);reject(error)});
    });
}
function openDurableOrganizerDb(){
    if(typeof indexedDB==="undefined")return Promise.reject(new Error("IndexedDB no disponible"));
    return new Promise((resolve,reject)=>{
        try{
            const req=indexedDB.open(DURABLE_ORGANIZER_DB,1);
            req.onupgradeneeded=()=>{
                const db=req.result;
                if(!db.objectStoreNames.contains(DURABLE_ORGANIZER_EVENT_STORE))db.createObjectStore(DURABLE_ORGANIZER_EVENT_STORE,{keyPath:"eventId"});
                if(!db.objectStoreNames.contains(DURABLE_ORGANIZER_TRACK_STORE))db.createObjectStore(DURABLE_ORGANIZER_TRACK_STORE,{keyPath:"id"});
            };
            req.onsuccess=()=>resolve(req.result);
            req.onerror=()=>reject(req.error||new Error("No se pudo abrir el archivo duradero del organizador"));
            req.onblocked=()=>reject(new Error("IndexedDB bloqueado por otra pestaña o una versión anterior"));
        }catch(error){reject(error)}
    });
}
function durableTrackSignature(track){
    const list=Array.isArray(track)?track:[];
    if(!list.length)return "";
    const last=list[list.length-1]||{};
    return `${list.length}:${String(last.t||last.time||last.timestamp||"")}:${Number(last.lat)||0}:${Number(last.lon||last.lng)||0}`;
}
async function persistDurableOrganizerState(payload){
    if(!payload?.state?.eventId)return false;
    const eventId=String(payload.state.eventId);
    const db=await openDurableOrganizerDb();
    try{
        const compact=JSON.parse(JSON.stringify(payload));
        const tx=db.transaction([DURABLE_ORGANIZER_EVENT_STORE,DURABLE_ORGANIZER_TRACK_STORE],"readwrite");
        tx.objectStore(DURABLE_ORGANIZER_EVENT_STORE).put({eventId,savedAt:compact.savedAt,currentStep:compact.currentStep,selectedIofPointId:compact.selectedIofPointId||"START",state:compact.state});
        const trackStore=tx.objectStore(DURABLE_ORGANIZER_TRACK_STORE);
        (state.importedResults||[]).forEach(result=>{
            const pid=String(result?.participantId||"");
            const track=Array.isArray(result?.track)&&result.track.length?result.track:(Array.isArray(result?.gpsTrack)?result.gpsTrack:[]);
            if(!pid||!track.length)return;
            const id=`${eventId}:${pid}`;
            const sig=durableTrackSignature(track);
            if(__durableTrackSignatures.get(id)===sig)return;
            __durableTrackSignatures.set(id,sig);
            trackStore.put({id,eventId,participantId:pid,track,trackPointCount:track.length,savedAt:compact.savedAt});
        });
        await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error("No se pudo guardar el archivo duradero"));tx.onabort=()=>reject(tx.error||new Error("Se canceló el guardado duradero"));});
        return true;
    }finally{try{db.close()}catch(_){}}
}
function scheduleDurableOrganizerState(payload){
    clearTimeout(__durableSaveTimer);
    const snapshot=JSON.parse(JSON.stringify(payload));
    __durableSaveTimer=setTimeout(()=>persistDurableOrganizerState(snapshot).catch(error=>console.warn("Copia duradera del organizador",error)),350);
}
async function readDurableOrganizerState(eventId=""){
    const db=await openDurableOrganizerDb();
    try{
        const rows=await new Promise((resolve,reject)=>{
            const tx=db.transaction(DURABLE_ORGANIZER_EVENT_STORE,"readonly");
            const store=tx.objectStore(DURABLE_ORGANIZER_EVENT_STORE);
            const req=eventId?store.get(String(eventId)):store.getAll();
            req.onsuccess=()=>resolve(req.result||null);
            req.onerror=()=>reject(req.error||new Error("No se pudo leer la copia duradera"));
        });
        let record=eventId?rows:(Array.isArray(rows)?rows.sort((a,b)=>(Date.parse(String(b?.savedAt||""))||0)-(Date.parse(String(a?.savedAt||""))||0))[0]:null);
        if(!record?.state)return null;
        const tracks=await new Promise((resolve,reject)=>{
            const tx=db.transaction(DURABLE_ORGANIZER_TRACK_STORE,"readonly");
            const req=tx.objectStore(DURABLE_ORGANIZER_TRACK_STORE).getAll();
            req.onsuccess=()=>resolve((req.result||[]).filter(row=>String(row?.eventId||"")===String(record.eventId||"")));
            req.onerror=()=>reject(req.error||new Error("No se pudieron leer los tracks duraderos"));
        });
        const restored=JSON.parse(JSON.stringify(record));
        const byPid=new Map((tracks||[]).map(row=>[String(row.participantId||""),row]));
        (restored.state.importedResults||[]).forEach(result=>{
            const row=byPid.get(String(result?.participantId||""));
            if(row?.track?.length){result.track=row.track;result.gpsTrack=row.track;result.trackPointCount=Math.max(Number(result.trackPointCount)||0,row.track.length);}
        });
        return restored;
    }finally{try{db.close()}catch(_){}}
}
async function deleteDurableOrganizerState(eventId){
    const target=String(eventId||"").trim();if(!target)return;
    const db=await openDurableOrganizerDb();
    try{
        const tracks=await new Promise((resolve,reject)=>{const tx=db.transaction(DURABLE_ORGANIZER_TRACK_STORE,"readonly");const req=tx.objectStore(DURABLE_ORGANIZER_TRACK_STORE).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error)});
        const tx=db.transaction([DURABLE_ORGANIZER_EVENT_STORE,DURABLE_ORGANIZER_TRACK_STORE],"readwrite");
        tx.objectStore(DURABLE_ORGANIZER_EVENT_STORE).delete(target);
        const store=tx.objectStore(DURABLE_ORGANIZER_TRACK_STORE);
        tracks.filter(row=>String(row?.eventId||"")===target).forEach(row=>store.delete(row.id));
        await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)});
        [...__durableTrackSignatures.keys()].filter(key=>key.startsWith(target+":")).forEach(key=>__durableTrackSignatures.delete(key));
    }finally{try{db.close()}catch(_){}}
}
async function restoreDurableOrganizerState(restoreInfo){
    const currentEvent=restoreInfo?.restored?String(state.eventId||""):"";
    const durable=await withOrganizerTimeout(readDurableOrganizerState(currentEvent),1800,"Recuperación duradera");
    if(!durable?.state)return restoreInfo;
    const localMs=Date.parse(String(restoreInfo?.savedAt||""))||0;
    const durableMs=Date.parse(String(durable.savedAt||""))||0;
    if(restoreInfo?.restored&&localMs>=durableMs)return restoreInfo;
    Object.assign(state,durable.state);
    if(!state.importedResults)state.importedResults=[];
    if(!state.participantNames)state.participantNames={};
    if(!state.skippedRoutes)state.skippedRoutes={};
    if(!state.raceDataProtection)state.raceDataProtection={protected:false,runId:"",startedAt:"",lastDataAt:"",status:""};
    currentAppStep=normalizeAppStep(durable.currentStep||state.currentStep||1);
    selectedIofPointId=durable.selectedIofPointId||selectedIofPointId||"START";
    return {restored:true,step:currentAppStep,reason:"indexeddb_durable",savedAt:durable.savedAt};
}
async function recoverDurableOrganizerStateAfterBoot(localRestoreInfo,expectedEpoch=__militopoOrganizerStateEpoch){
    if(expectedEpoch!==__militopoOrganizerStateEpoch)return false;
    let recovered;
    try{recovered=await restoreDurableOrganizerState(localRestoreInfo)}catch(error){console.warn("Copia duradera no disponible; se continúa con el estado local",error);return false}
    if(expectedEpoch!==__militopoOrganizerStateEpoch)return false;
    if(!recovered?.restored||recovered.reason!=="indexeddb_durable")return false;
    try{
        syncConfigToUi();
        rebuildPointsFromConfig(true);
        renderPointSelectors();
        renderPointsTable();
        renderIofDescriptionsEditor();
        updateParticipantSelect();
        updateRouteCountInfo();
        goStep(normalizeAppStep(recovered.step||1),{silent:true,noScroll:true});
        if(map){renderMapMarkers();fitAllPoints()}
        setRestoreStatus(`✅ Evento recuperado desde copia duradera · paso ${normalizeAppStep(recovered.step||1)}`,"ok");
        toast("Evento recuperado desde copia duradera");
        return true;
    }catch(error){console.warn("La copia duradera se leyó pero no pudo aplicarse",error);return false}
}

function ensureRaceDataProtection(){
    if(!state.raceDataProtection||typeof state.raceDataProtection!=="object")state.raceDataProtection={protected:false,runId:"",startedAt:"",lastDataAt:"",status:""};
    return state.raceDataProtection;
}
function currentExerciseHasRaceEvidence(){
    try{
        if(Array.isArray(state.importedResults)&&state.importedResults.length)return true;
        if(Array.isArray(state.scanHistory)&&state.scanHistory.length)return true;
        if(state.startTimes&&typeof state.startTimes==="object"&&Object.keys(state.startTimes).length)return true;
        if(state.finishTimes&&typeof state.finishTimes==="object"&&Object.keys(state.finishTimes).length)return true;
        const flow=state.startFlowStatus&&typeof state.startFlowStatus==="object"?Object.values(state.startFlowStatus):[];
        if(flow.some(row=>row&&(row.startQrDeliveredAt||row.finishQrDeliveredAt||row.liveResultReceived||row.liveResultCode)))return true;
        const logs=state.participantLogs&&typeof state.participantLogs==="object"?Object.values(state.participantLogs):[];
        if(logs.some(row=>row&&(row.startTime||row.finishTime||row.resultPayload||(Array.isArray(row.scans)&&row.scans.length)||(Array.isArray(row.track)&&row.track.length))))return true;
        if(typeof window.MILITOPO_LIVE_HAS_CURRENT_RACE_DATA==="function"&&window.MILITOPO_LIVE_HAS_CURRENT_RACE_DATA())return true;
    }catch(_){ }
    return false;
}
function rejectProtectedRaceMutation(action="modificar el ejercicio"){
    const guard=ensureRaceDataProtection();
    if(!guard.protected)return false;
    // Un run recordado o una carrera creada sin ninguna salida real no debe
    // bloquear el diseño del ejercicio. Solo se protege desde que existe
    // evidencia de carrera del ejercicio ACTUAL.
    if(!currentExerciseHasRaceEvidence()){
        state.raceDataProtection={protected:false,runId:"",startedAt:"",lastDataAt:"",status:""};
        scheduleSaveState();
        return false;
    }
    const msg=`🔒 Carrera protegida: no puedes ${action} mientras existan datos reales de carrera guardados. Usa “BORRAR DATOS DE ESTA CARRERA” si realmente quieres preparar otra ejecución.`;
    try{toast(msg)}catch(_){ }
    try{setRestoreStatus(msg,"warn")}catch(_){ }
    return true;
}
window.MILITOPO_PROTECT_RACE_DATA=function(meta={}){
    const guard=ensureRaceDataProtection(),now=new Date().toISOString();
    guard.protected=true;
    guard.runId=String(meta.runId||guard.runId||"");
    guard.startedAt=guard.startedAt||String(meta.startedAt||now);
    guard.lastDataAt=String(meta.lastDataAt||now);
    guard.status=String(meta.status||guard.status||"active");
    scheduleSaveState();
    return true;
};
window.MILITOPO_TOUCH_RACE_DATA=function(meta={}){
    const guard=ensureRaceDataProtection(),now=new Date().toISOString();
    guard.protected=true;
    if(meta.runId)guard.runId=String(meta.runId);
    if(!guard.startedAt)guard.startedAt=String(meta.startedAt||now);
    guard.lastDataAt=String(meta.lastDataAt||now);
    if(meta.status)guard.status=String(meta.status);
    scheduleSaveState();
    return true;
};
window.MILITOPO_CLEAR_RACE_RUNTIME_STATE=function(){
    state.participantLogs={};
    state.importedResults=[];
    state.startTimes={};
    state.finishTimes={};
    state.scanHistory=[];
    state.classification=[];
    state.startFlowStatus={};
    state.liveRunId="";state.liveRunStartedAt="";state.liveRunStatus="";
    state.raceDataProtection={protected:false,runId:"",startedAt:"",lastDataAt:"",status:""};
    saveState();
    try{renderImportedResults();renderResultsControl();renderStartFlowStatusPanel();updateOrganizerParticipantSelects({keepQr:true});if(Number(currentAppStep)===7&&typeof renderRaceAnalysis==="function")renderRaceAnalysis()}catch(_){ }
    return true;
};

function normalizeAppStep(n){
    n=Number(n);
    return Number.isFinite(n)?Math.min(7,Math.max(1,Math.round(n))):1;
}
function saveCurrentStepNow(){
    const step=String(normalizeAppStep(currentAppStep));
    try{localStorage.setItem(STORAGE_KEY_LAST_STEP,step)}catch(e){}
    try{sessionStorage.setItem(STORAGE_KEY_LAST_STEP,step)}catch(e){}
}
function loadLastStepFallback(){
    try{
        const raw=localStorage.getItem(STORAGE_KEY_LAST_STEP)||sessionStorage.getItem(STORAGE_KEY_LAST_STEP);
        return raw==null?0:normalizeAppStep(raw);
    }catch(e){
        try{const raw=sessionStorage.getItem(STORAGE_KEY_LAST_STEP);return raw==null?0:normalizeAppStep(raw)}catch(_){return 0}
    }
}

function cloneStateForSave(){
    try{syncConfigFromUi()}catch(e){}
    const copy=JSON.parse(JSON.stringify(state));
    if(!copy.importedResults)copy.importedResults=[];
    if(!copy.participantNames)copy.participantNames={};
    if(!copy.skippedRoutes)copy.skippedRoutes={};
    if(!copy.raceDataProtection)copy.raceDataProtection={protected:false,runId:"",startedAt:"",lastDataAt:"",status:""};
    copy.currentStep=currentAppStep||1;
    return copy;
}

function cloneStateForCompactSave(){
    const copy=cloneStateForSave();
    copy.importedResults=(copy.importedResults||[]).map(result=>{
        const next={...result};
        const track=Array.isArray(next.track)&&next.track.length?next.track:(Array.isArray(next.gpsTrack)?next.gpsTrack:[]);
        if(track.length){
            next.trackPointCount=Math.max(Number(next.trackPointCount)||0,track.length);
            next.trackStoredExternally=true;
        }
        delete next.track;
        delete next.gpsTrack;
        return next;
    });
    return copy;
}

function safeStorageWrite(storage,key,value){
    try{storage.setItem(key,value);return true}catch(_){return false}
}

function saveState(){
    try{
        currentAppStep=normalizeAppStep(currentAppStep||1);
        saveCurrentStepNow();
        const savedAt=new Date().toISOString();
        const payload={savedAt,currentStep:currentAppStep,selectedIofPointId:selectedIofPointId||"START",state:cloneStateForSave()};
        const compactPayload={savedAt,currentStep:currentAppStep,selectedIofPointId:selectedIofPointId||"START",state:cloneStateForCompactSave(),compact:true};
        const raw=JSON.stringify(payload),compactRaw=JSON.stringify(compactPayload);
        const mainOk=safeStorageWrite(localStorage,STORAGE_KEY_MAIN,raw);
        const backupOk=safeStorageWrite(localStorage,STORAGE_KEY_BACKUP,compactRaw);
        const sessionOk=safeStorageWrite(sessionStorage,STORAGE_KEY_SESSION,raw)||safeStorageWrite(sessionStorage,STORAGE_KEY_SESSION,compactRaw);
        // El legado y window.name son copias ligeras: así un track grande no puede
        // dejar sin espacio los datos de resultados, estados y salidas.
        safeStorageWrite(localStorage,STORAGE_KEY_LEGACY,JSON.stringify(compactPayload.state));
        safeStorageWrite(sessionStorage,STORAGE_KEY_LEGACY,JSON.stringify(compactPayload.state));
        try{window.name=WINDOW_NAME_PREFIX+compactRaw}catch(e){}
        safeStorageWrite(localStorage,"militopo_orientacion_restore_probe_v2",JSON.stringify({savedAt,eventId:state.eventId,currentStep:currentAppStep}));
        scheduleDurableOrganizerState(compactPayload);
        if(!(mainOk||backupOk||sessionOk)){
            setRestoreStatus("⚠️ El navegador no ha podido guardar el estado local. Libera espacio antes de continuar.","err");
            return false;
        }
        return true;
    }catch(e){
        console.warn("Autoguardado falló:",e);
        setRestoreStatus("⚠️ No se ha podido guardar el evento en este navegador.", "err");
        return false;
    }
}

function scheduleSaveState(){
    clearTimeout(__autoSaveTimer);
    __autoSaveTimer=setTimeout(()=>saveState(),250);
}


function setRestoreStatus(message,type="warn"){
    const el=document.getElementById("restoreDebugStatus");
    if(!el)return;
    el.style.display="block";
    el.className="status "+type;
    el.textContent=message;
}
function safeReadJsonStorage(key){
    try{
        const raw=(localStorage.getItem(key)||sessionStorage.getItem(key));
        if(!raw)return {ok:false,raw:null,value:null,error:null};
        return {ok:true,raw,value:JSON.parse(raw),error:null};
    }catch(e){
        try{
            const raw=sessionStorage.getItem(key);
            if(!raw)return {ok:false,raw:null,value:null,error:e};
            return {ok:true,raw,value:JSON.parse(raw),error:null};
        }catch(e2){return {ok:false,raw:null,value:null,error:e2};}
    }
}
function readWindowNameOrganizerBackup(){
    try{
        const raw=String(window.name||"");
        if(!raw.startsWith(WINDOW_NAME_PREFIX))return {ok:false,raw:null,value:null,error:null};
        const json=raw.slice(WINDOW_NAME_PREFIX.length);
        return {ok:true,raw:json,value:JSON.parse(json),error:null};
    }catch(e){return {ok:false,raw:null,value:null,error:e};}
}
function storageAvailable(){
    try{
        const k="militopo_storage_probe";
        localStorage.setItem(k,"1");
        localStorage.removeItem(k);
        return true;
    }catch(e){return false}
}

function loadState(){
    const navStep=loadLastStepFallback();

    if(!storageAvailable()){
        setRestoreStatus("⚠️ El navegador no permite guardar/restaurar localStorage en esta vista.", "err");
        currentAppStep=1;
        return {restored:false,step:1,reason:"storage_unavailable"};
    }

    const main=safeReadJsonStorage(STORAGE_KEY_MAIN);
    const backup=safeReadJsonStorage(STORAGE_KEY_BACKUP);
    const session=safeReadJsonStorage(STORAGE_KEY_SESSION);
    const windowBackup=readWindowNameOrganizerBackup();
    const legacy=safeReadJsonStorage(STORAGE_KEY_LEGACY);

    const candidates=[
        {reason:"main",value:main.value},
        {reason:"backup",value:backup.value},
        {reason:"session",value:session.value},
        {reason:"window",value:windowBackup.value}
    ].filter(item=>item.value&&item.value.state);
    candidates.sort((a,b)=>(Date.parse(String(b.value.savedAt||""))||0)-(Date.parse(String(a.value.savedAt||""))||0));
    const chosen=candidates[0]||null;
    const payload=chosen?.value||null;

    if(payload){
        Object.assign(state,payload.state);
        currentAppStep=normalizeAppStep(navStep||payload.currentStep||state.currentStep||1);
        selectedIofPointId=payload.selectedIofPointId||selectedIofPointId||"START";
        if(!state.importedResults)state.importedResults=[];
        if(!state.participantNames)state.participantNames={};
        if(!state.skippedRoutes)state.skippedRoutes={};
        if(!state.raceDataProtection)state.raceDataProtection={protected:false,runId:"",startedAt:"",lastDataAt:"",status:""};
        if(state.pdfPlanCenterManual&&(!Number.isFinite(Number(state.pdfPlanCenterManual.lat))||!Number.isFinite(Number(state.pdfPlanCenterManual.lon))))state.pdfPlanCenterManual=null;
        return {restored:true,step:currentAppStep,reason:chosen?.reason||"unknown",savedAt:payload.savedAt||""};
    }

    if(legacy.value){
        Object.assign(state,legacy.value);
        if(!state.importedResults)state.importedResults=[];
        if(!state.participantNames)state.participantNames={};
        if(!state.skippedRoutes)state.skippedRoutes={};
        if(!state.raceDataProtection)state.raceDataProtection={protected:false,runId:"",startedAt:"",lastDataAt:"",status:""};
        if(state.pdfPlanCenterManual&&(!Number.isFinite(Number(state.pdfPlanCenterManual.lat))||!Number.isFinite(Number(state.pdfPlanCenterManual.lon))))state.pdfPlanCenterManual=null;
        currentAppStep=normalizeAppStep(navStep||legacy.value.currentStep||1);
        return {restored:true,step:currentAppStep,reason:"legacy",savedAt:""};
    }

    currentAppStep=normalizeAppStep(navStep||1);
    return {restored:false,step:currentAppStep,reason:navStep?"nav_only":"empty"};
}

function bindStrongAutosave(){
    document.addEventListener("input",scheduleSaveState,true);
    document.addEventListener("change",scheduleSaveState,true);
    document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")saveState()});
    document.addEventListener("freeze",saveState);
    document.addEventListener("resume",saveState);
    window.addEventListener("pagehide",saveState);
    window.addEventListener("pageshow",()=>{saveState();try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist()}catch(e){}});
    window.addEventListener("beforeunload",saveState);
    window.addEventListener("offline",saveState);
    window.addEventListener("online",saveState);
    try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist()}catch(e){}
    setInterval(saveState,4000);
}

async function resetSavedEvent(){
    if(!window.__militopoDeleteExerciseInProgress && typeof window.MILITOPO_LIVE_DELETE_EXERCISE==="function"){
        await window.MILITOPO_LIVE_DELETE_EXERCISE();
        return;
    }
    if(!window.__militopoDeleteExerciseResetConfirmed&&!confirm("¿Borrar el evento guardado y empezar un evento totalmente nuevo? Se borrarán puntos, recorridos, descripciones IOF, QR, resultados y registros guardados."))return false;
    const deletedEventId=String(state.eventId||"");

    __militopoOrganizerStateEpoch++;
    clearTimeout(__autoSaveTimer);
    clearTimeout(__durableSaveTimer);
    try{await withOrganizerTimeout(deleteDurableOrganizerState(deletedEventId),2200,"Borrado duradero")}catch(error){console.warn("No se pudo borrar la copia duradera",error)}
    try{await window.MILITOPO_LIVE_PURGE_LOCAL_EVENT?.(deletedEventId)}catch(error){console.warn("No se pudo purgar el seguimiento local del evento",error)}
    localStorage.removeItem(STORAGE_KEY_MAIN);
    localStorage.removeItem(STORAGE_KEY_BACKUP);
    localStorage.removeItem(STORAGE_KEY_LEGACY);
    localStorage.removeItem(STORAGE_KEY_LAST_STEP);
    try{sessionStorage.removeItem(STORAGE_KEY_SESSION);sessionStorage.removeItem(STORAGE_KEY_LEGACY);sessionStorage.removeItem(STORAGE_KEY_LAST_STEP)}catch(e){}
    try{if(String(window.name||"").startsWith(WINDOW_NAME_PREFIX))window.name=""}catch(e){}

    resetStateToFreshEvent();

    const eventIdInput=document.getElementById("eventId");
    if(eventIdInput)eventIdInput.value=state.eventId;
    const eventNameInput=document.getElementById("eventName");
    if(eventNameInput)eventNameInput.value=state.eventName;
    const iofEventName=document.getElementById("iofEventName");
    if(iofEventName)iofEventName.value=state.eventName;

    syncConfigToUi();
    rebuildPointsFromConfig(true);
    state.routes=[];
    state.metrics=[];
    state.skippedRoutes={};
    state.routeWarnings=[];
    state.iofDescriptions={};
    ensureIofDescriptions();

    renderPointSelectors();
    renderPointsTable();
    renderIofDescriptionsEditor();
    validateIofDescriptions();
    updateParticipantSelect();
    updateRouteCountInfo();
    if(typeof renderRoutes==="function")renderRoutes();
    const routeSummary=document.getElementById("routeSummary");
    if(routeSummary){routeSummary.className="status warn";routeSummary.textContent="Todavía no hay recorridos generados.";}
    if(typeof updateOrganizerParticipantSelects==="function")updateOrganizerParticipantSelects();
    if(typeof renderResultsControl==="function")renderResultsControl();
    if(typeof renderExerciseVerifier==="function")renderExerciseVerifier(runExerciseVerifier(false));

    if(markersLayer)markersLayer.clearLayers();
    if(routeLayer)routeLayer.clearLayers();
    renderMapMarkers();

    saveState();
    goStep(1,{silent:true});
    toast("Evento nuevo creado: "+state.eventId);
    return true;
}let step5ResultQrCameraStream=null;
let step5ResultQrCameraRunning=false;
let step5ResultQrDetector=null;
let step5ResultQrUseJsQr=false;
let step5ResultQrLastValue="";
let step5ResultQrLastTime=0;

function resultMs(r){
    if(!r||!r.startTime||!r.finishTime)return null;
    const ms=new Date(r.finishTime)-new Date(r.startTime);
    return Number.isFinite(ms)&&ms>=0?ms:null;
}

function routeMetricForResult(resultOrRouteId){
    const routeId=typeof resultOrRouteId==="string"?resultOrRouteId:String(resultOrRouteId?.routeId||"");
    const participantId=typeof resultOrRouteId==="object"?String(resultOrRouteId?.participantId||""):"";
    const routes=state.routes||[];
    let idx=routes.findIndex(r=>String(r.routeId||"")===routeId);
    if(idx<0&&participantId)idx=routes.findIndex(r=>String(r.participantId||"")===participantId);
    return idx>=0?((state.metrics||[])[idx]||{}):{};
}

function routeDifficultyForResult(resultOrRouteId){
    const metric=routeMetricForResult(resultOrRouteId);
    return String(metric?.difficulty||"--");
}

function resultStatusEs(status){
    const s=String(status||"").trim().toLowerCase();
    const map={
        correct:"Correcto",
        correcta:"Correcto",
        ok:"Correcto",
        pending:"Pendiente",
        pendiente:"Pendiente",
        duplicate:"Duplicado",
        duplicated:"Duplicado",
        skipped:"Descartado",
        out_of_order:"Fuera de orden",
        wrong_order:"Fuera de orden",
        wrong:"Incorrecto",
        incorrect:"Incorrecto",
        error:"Error",
        missed:"Pendiente",
        missing:"Pendiente",
        manual:"Manual",
        partial:"Parcial"
    };
    return map[s]||status||"--";
}

function classifyParticipantStatus(pid){
    const route=getRouteByParticipant(pid);
    if(route&&isRouteSkipped(route))return {status:"DESCARTADO POR ORGANIZADOR",cls:"pending",icon:"🚫",result:null};
    const r=activeImportedResults().find(x=>x.participantId===pid);
    if(r){
        return r.completed ? {status:"FINALIZADO OK",cls:"ok",icon:"✅",result:r} : {status:"FINALIZADO CON AVISOS",cls:"bad",icon:"⚠️",result:r};
    }
    return {status:"SIN RESULTADO IMPORTADO",cls:"pending",icon:"⏳",result:null};
}

function renderResultsControl(){
    if(!state.importedResults)state.importedResults=[];
    ensureParticipantNamesStore();
    const routes=activeRoutes();
    const discarded=skippedRoutesList().length;
    const totalParticipants=routes.length||0;
    const importedResults=activeImportedResults();
    const imported=importedResults.length;
    const completed=importedResults.filter(r=>r.completed).length;
    const warnings=imported-completed;
    const pending=Math.max(0,totalParticipants-imported);

    const summary=document.getElementById("resultsControlSummary");
    if(summary){
        const needsReview=warnings||pending;
        const progress=totalParticipants?Math.round((imported/totalParticipants)*100):0;
        const statusText=totalParticipants?`${imported} de ${totalParticipants} resultados importados`:"Sin recorridos activos";
        const reviewText=!totalParticipants?"Genera recorridos para activar el control de resultados":(!needsReview?"Evento completo: todos los resultados están importados y correctos":(pending?"Aún quedan resultados pendientes de importar":"Hay resultados con avisos para revisar"));
        const card=(icon,title,value,hint)=>`
            <div style="display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;padding:14px 14px;border:1px solid rgba(255,255,255,.18);border-radius:18px;background:rgba(0,0,0,.16);">
                <div style="font-size:1.7rem;line-height:1;">${icon}</div>
                <div style="min-width:0;">
                    <div style="font-weight:900;letter-spacing:.04em;text-transform:uppercase;line-height:1.15;">${title}</div>
                    <div style="opacity:.78;font-size:.92rem;line-height:1.25;margin-top:3px;">${hint}</div>
                </div>
                <div style="font-size:2rem;font-weight:900;line-height:1;white-space:nowrap;">${value}</div>
            </div>`;
        summary.className=needsReview?"status warn":"status ok";
        summary.innerHTML=`
            <div style="display:grid;gap:14px;text-align:left;">
                <div style="display:grid;gap:6px;padding:14px;border-radius:18px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);">
                    <div style="opacity:.78;font-size:.82rem;letter-spacing:.12em;text-transform:uppercase;">Evento</div>
                    <div style="font-size:1.15rem;font-weight:900;word-break:break-word;">${escapeHtml(state.eventId||"--")}</div>
                    <div style="font-weight:800;line-height:1.25;">${statusText}</div>
                    <div style="opacity:.84;line-height:1.3;">${reviewText}</div>
                    <div style="height:10px;border-radius:999px;background:rgba(0,0,0,.25);overflow:hidden;margin-top:6px;border:1px solid rgba(255,255,255,.12);">
                        <div style="height:100%;width:${Math.max(0,Math.min(100,progress))}%;border-radius:999px;background:rgba(255,244,190,.85);"></div>
                    </div>
                    <div style="opacity:.76;font-size:.9rem;">Progreso de importación: ${progress}%</div>
                </div>

                <div style="display:grid;gap:10px;">
                    ${card("📥","Resultados importados",`${imported}/${totalParticipants}`,"QR final recibido del participante")}
                    ${card("✅","Correctos",completed,"Recorridos completos sin avisos")}
                    ${card("⚠️","Con avisos",warnings,"Revisar controles pendientes, repetidos o fuera de orden")}
                    ${card("⏳","Pendientes",pending,"Faltan por importar al terminar")}
                    ${discarded?card("🚫","Descartados / reserva",discarded,"No cuentan como pendientes de resultados"):""}
                </div>
            </div>`;
        const oldMetricGrid=summary.nextElementSibling;
        if(oldMetricGrid&&oldMetricGrid.classList&&oldMetricGrid.classList.contains("grid")){
            oldMetricGrid.style.display="none";
        }
    }

    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
    set("resTotalParticipants",totalParticipants);
    set("resImportedCount",imported);
    set("resCompletedCount",completed);
    set("resWarningCount",warnings);

    renderClassificationTable();
    renderParticipantsStatusGrid();
    renderResultDetailSelect();
    renderSelectedResultDetail();
    renderImportedResults();
    renderStartFlowStatusPanel();
}

function resultCompletedControlsCount(result){
    return (result?.scans||[]).filter(s=>(s?.st||s?.status)==="correct").length;
}
function resultDiscardedControlIds(result){
    return [...new Set((result?.scans||[])
        .filter(s=>String(s?.st||s?.status||"").toLowerCase()==="skipped")
        .map(s=>String(s?.id||s?.controlId||s?.expectedControlId||"").trim())
        .filter(Boolean))];
}
function resultPendingControlIds(result){
    const discarded=new Set(resultDiscardedControlIds(result));
    return [...new Set((Array.isArray(result?.missingControls)?result.missingControls:[])
        .map(x=>String(x||"").trim()).filter(Boolean)
        .filter(id=>!discarded.has(id)))];
}
function resultDiscardedControlsCount(result){return resultDiscardedControlIds(result).length;}
function resultPendingControlsCount(result){return resultPendingControlIds(result).length;}

function sortedImportedResults(){
    return [...activeImportedResults()].sort((a,b)=>{
        const aControls=resultCompletedControlsCount(a);
        const bControls=resultCompletedControlsCount(b);
        if(aControls!==bControls)return bControls-aControls;

        const am=resultMs(a),bm=resultMs(b);
        if(am!==null&&bm!==null&&am!==bm)return am-bm;
        if(am!==null&&bm===null)return -1;
        if(am===null&&bm!==null)return 1;

        const ac=a.completed?0:1,bc=b.completed?0:1;
        if(ac!==bc)return ac-bc;

        return String(a.participantId).localeCompare(String(b.participantId),"es",{numeric:true});
    });
}

function classificationRankClass(rank,completed){
    if(!completed)return "rank-warn";
    const n=Number(rank)||0;
    if(n===1)return "rank-top1";
    if(n===2)return "rank-top2";
    if(n===3)return "rank-top3";
    if(n>=4&&n<=10)return "rank-004-010";
    if(n>=11&&n<=20)return "rank-011-020";
    if(n>=21&&n<=30)return "rank-021-030";
    if(n>=31&&n<=40)return "rank-031-040";
    if(n>=41&&n<=50)return "rank-041-050";
    if(n>=51&&n<=60)return "rank-051-060";
    if(n>=61&&n<=70)return "rank-061-070";
    if(n>=71&&n<=80)return "rank-071-080";
    if(n>=81&&n<=90)return "rank-081-090";
    if(n>=91&&n<=100)return "rank-091-100";
    return "rank-other";
}
function classificationXlsxStyle(rank,completed){
    const cls=classificationRankClass(rank,completed);
    const m={
        "rank-top1":2,
        "rank-top2":3,
        "rank-top3":4,
        "rank-004-010":5,
        "rank-011-020":6,
        "rank-021-030":7,
        "rank-031-040":8,
        "rank-041-050":9,
        "rank-051-060":10,
        "rank-061-070":11,
        "rank-071-080":5,
        "rank-081-090":6,
        "rank-091-100":7,
        "rank-other":12,
        "rank-warn":11
    };
    return m[cls]||12;
}

function renderClassificationTable(){
    const box=document.getElementById("classificationTable");
    if(!box)return;
    const rows=sortedImportedResults();
    if(!rows.length){box.innerHTML=`<div class="status warn">Todavía no hay resultados importados.</div>`;return;}
    let rank=0;
    box.innerHTML=`<div style="width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;">
    <table class="results-table" style="width:100%;min-width:1260px;table-layout:fixed;border-collapse:separate;border-spacing:0;">
        <colgroup><col style="width:7%"><col style="width:18%"><col style="width:11%"><col style="width:10%"><col style="width:11%"><col style="width:11%"><col style="width:11%"><col style="width:11%"><col style="width:9%"><col style="width:9%"></colgroup>
        <thead><tr><th>Puesto</th><th>Nombre</th><th>Tiempo</th><th>Recorrido</th><th>Dificultad</th><th>Distancia</th><th>Desnivel +</th><th>Controles<br>completados</th><th>Controles<br>pendientes</th><th>Controles<br>descartados</th></tr></thead>
        <tbody>${rows.map(r=>{
            rank++;
            const ms=resultMs(r),time=ms!==null?formatDuration(ms):"--",metric=routeMetricForResult(r);
            const controls=typeof resultCompletedControlsCount==="function"?resultCompletedControlsCount(r):(r.scans||[]).filter(s=>s.st==="correct"||s.status==="correct").length;
            const missingCount=resultPendingControlsCount(r);
            const cls=classificationRankClass(rank,r.completed);
            return `<tr class="${cls}"><td style="text-align:center">${rank}</td><td>${escapeHtml(resultParticipantName(r)||r.participantId||"--")}</td><td style="text-align:center">${escapeHtml(time)}</td><td style="text-align:center">${escapeHtml(r.routeId||"--")}</td><td style="text-align:center;font-weight:900">${escapeHtml(String(metric?.difficulty||"--"))}</td><td style="text-align:center">${escapeHtml(metric?.distanceKm!=null&&Number.isFinite(Number(metric.distanceKm))?`${Number(metric.distanceKm).toFixed(2)} km`:"--")}</td><td style="text-align:center">${escapeHtml(metric?.positiveM!=null?`${metric.positiveM} m`:"Sin desnivel real")}</td><td style="text-align:center">${controls}</td><td style="text-align:center">${missingCount}</td><td style="text-align:center">${resultDiscardedControlsCount(r)}</td></tr>`;
        }).join("")}</tbody>
    </table></div>`;
}

function renderParticipantsStatusGrid(){
    const box=document.getElementById("participantsStatusGrid");
    if(!box)return;

    const routes=activeRoutes();
    const discarded=skippedRoutesList().length;
    if(!(state.routes||[]).length){
        box.innerHTML=`<div class="status warn">Genera recorridos para ver el estado de participantes.</div>`;
        return;
    }
    if(!routes.length){
        box.innerHTML=`<div class="status warn">Todos los recorridos están descartados por el organizador. No hay participantes activos.</div>`;
        return;
    }

    box.innerHTML=(discarded?`<div class="status warn" style="margin-bottom:10px;">${discarded} recorrido(s) descartado(s) por el organizador. No cuentan como pendientes.</div>`:"")+routes.map(route=>{
        const st=classifyParticipantStatus(route.participantId);
        const r=st.result;
        const ms=resultMs(r);
        const time=ms!==null?formatDuration(ms):"--";
        const pendingIds=r?resultPendingControlIds(r):[];
        const discardedIds=r?resultDiscardedControlIds(r):[];
        const name=resultParticipantName(route.participantId);
        const participantLabel=name?`${route.participantId} · ${name}`:route.participantId;
        const detailRows=[
            discardedIds.length?`<div style="grid-column:1;line-height:1.35;">⏭️ <b>Descartados:</b> ${escapeHtml(discardedIds.join(", "))}</div>`:"",
            pendingIds.length?`<div style="grid-column:1;line-height:1.35;">⏳ <b>Pendientes:</b> ${escapeHtml(pendingIds.join(", "))}</div>`:""
        ].filter(Boolean).join("");
        return `<div class="scan-item ${st.cls}" style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:7px 12px;align-items:center;overflow:hidden;">
            <b style="display:block;grid-column:1;line-height:1.25;white-space:normal;overflow-wrap:anywhere;">${escapeHtml(participantLabel)}</b>
            <div style="grid-column:1;line-height:1.35;white-space:normal;overflow-wrap:anywhere;"><b>${escapeHtml(route.routeId)}</b> · ${escapeHtml(st.status)} <span style="white-space:nowrap;">Tiempo: <b>${escapeHtml(time)}</b></span></div>
            ${detailRows}
            <span style="grid-column:2;grid-row:1 / span 4;font-size:1.45rem;align-self:center;">${st.icon}</span>
        </div>`;
    }).join("");
}

function renderResultDetailSelect(){
    const sel=document.getElementById("resultDetailSelect");
    if(!sel)return;

    const current=sel.value;
    const rows=sortedImportedResults();

    sel.innerHTML=`<option value="">Selecciona resultado...</option>`+rows.map(r=>`<option value="${escapeHtml(r.participantId)}">${escapeHtml(resultParticipantName(r)?`${r.participantId} · ${resultParticipantName(r)} · ${r.routeId||"--"}`:`${r.participantId} · ${r.routeId||"--"}`)}</option>`).join("");
    if(current && rows.some(r=>r.participantId===current)) sel.value=current;
}


function formatDateTimeSpain(value){
    if(!value)return "--";
    const d=new Date(value);
    if(!Number.isFinite(d.getTime()))return "--";
    try{
        return new Intl.DateTimeFormat("es-ES",{
            timeZone:"Europe/Madrid",
            day:"2-digit",
            month:"2-digit",
            year:"numeric",
            hour:"2-digit",
            minute:"2-digit",
            second:"2-digit",
            hour12:false
        }).format(d).replace(",", "");
    }catch(e){
        return d.toLocaleString("es-ES");
    }
}

function renderSelectedResultDetail(){
    const sel=document.getElementById("resultDetailSelect");
    const box=document.getElementById("selectedResultDetail");
    if(!sel||!box)return;

    const pid=sel.value;
    const r=activeImportedResults().find(x=>x.participantId===pid);
    if(!r){
        box.className="status warn";
        box.innerHTML="Selecciona un resultado importado.";
        return;
    }

    const ms=resultMs(r);
    const time=ms!==null?formatDuration(ms):"--";
    const scans=(r.scans||[]).map((s,i)=>{
        const id=s.id||s.controlId||"--";
        const when=s.t||s.timestamp||"";
        const st=s.st||s.status||"--";
        return `<div style="padding:6px 0;border-top:1px solid rgba(255,255,255,.12);"><b>${i+1}. ${escapeHtml(id)}</b><br><span>${escapeHtml(formatDateTimeSpain(when))}</span><br><span>Estado: ${escapeHtml(resultStatusEs(st))}</span></div>`;
    }).join("");

    box.className=r.completed?"status ok":"status warn";
    const name=resultParticipantName(r);
    box.innerHTML=`<div style="display:grid;gap:8px;line-height:1.35;">
        <div><b>${escapeHtml(r.participantId||"--")}${name?` · ${escapeHtml(name)}`:""}</b></div>
        <div><b>Participante:</b> ${escapeHtml(r.participantId||"--")}</div>
        <div><b>Nombre:</b> ${escapeHtml(name||"--")}</div>
        <div><b>Recorrido:</b> ${escapeHtml(r.routeId||"--")}</div>
        <div><b>Dificultad:</b> ${escapeHtml(routeDifficultyForResult(r))}</div>
        <div><b>Estado:</b> ${r.completed?"✅ Completo":"⚠️ Con avisos"}</div>
        <div><b>Salida:</b> ${escapeHtml(formatDateTimeSpain(r.startTime))}</div>
        <div><b>Llegada:</b> ${escapeHtml(formatDateTimeSpain(r.finishTime))}</div>
        <div><b>Tiempo:</b> ${escapeHtml(time)}</div>
        <div><b>✅ Controles completados:</b> ${resultCompletedControlsCount(r)}</div>
        <div><b>⏭️ Controles descartados:</b> ${escapeHtml(resultDiscardedControlIds(r).join(", ")||"Ninguno")}</div>
        <div><b>⏳ Controles pendientes:</b> ${escapeHtml(resultPendingControlIds(r).join(", ")||"Ninguno")}</div>
        <div style="margin-top:8px;"><b>Pasos registrados</b></div>
        <div>${scans||"--"}</div>
    </div>`;
}

function importStep5ResultFromInput(){
    const input=document.getElementById("step5ResultImportInput");
    if(!input||!input.value.trim())return toast("Pega o escanea un resultado primero");
    importResultPayload(input.value.trim());
    renderResultsControl();
}


function classificationRowsForExport(){
    const rows=[["Puesto","Nombre","Tiempo","Recorrido","Dificultad","Distancia","Desnivel +","Controles\ncompletados","Controles\npendientes","Controles\ndescartados"]];
    let rank=0;
    sortedImportedResults().forEach(r=>{
        rank++;
        const ms=resultMs(r),metric=routeMetricForResult(r);
        const controls=typeof resultCompletedControlsCount==="function"?resultCompletedControlsCount(r):(r.scans||[]).filter(s=>s.st==="correct"||s.status==="correct").length;
        rows.push([rank,resultParticipantName(r)||r.participantId||"",ms!==null?formatDuration(ms):"--",r.routeId||"--",String(metric?.difficulty||"--"),metric?.distanceKm!=null&&Number.isFinite(Number(metric.distanceKm))?`${Number(metric.distanceKm).toFixed(2)} km`:"--",metric?.positiveM!=null?`${metric.positiveM} m`:"Sin desnivel real",controls,resultPendingControlsCount(r),resultDiscardedControlsCount(r)]);
    });
    return rows;
}

async function downloadClassificationExcel(){
    const rows=classificationRowsForExport();
    if(rows.length<=1)return toast("No hay clasificación para exportar");

    if(typeof JSZip==="undefined"){
        toast("No se pudo crear XLSX: JSZip no está cargado");
        return;
    }

    const escXml=v=>String(v??"")
        .replace(/&/g,"&amp;")
        .replace(/</g,"&lt;")
        .replace(/>/g,"&gt;")
        .replace(/"/g,"&quot;")
        .replace(/'/g,"&apos;");

    const colName=n=>{
        let s="";
        while(n>0){
            const m=(n-1)%26;
            s=String.fromCharCode(65+m)+s;
            n=Math.floor((n-1)/26);
        }
        return s;
    };

    const rankedResults=sortedImportedResults();
    const sheetRows=rows.map((row,ri)=>{
        const r=ri+1;
        const completed=ri===0?true:!!rankedResults[ri-1]?.completed;
        const styleId=ri===0?1:classificationXlsxStyle(row[0],completed);
        const maxLen=Math.max(...row.map(cell=>String(cell??"").length));
        const rowHeight=ri===0?48:Math.min(110,Math.max(38,28+Math.ceil(maxLen/28)*12));
        const cells=row.map((cell,ci)=>{
            const ref=colName(ci+1)+r;
            return `<c r="${ref}" t="inlineStr" s="${styleId}"><is><t>${escXml(cell)}</t></is></c>`;
        }).join("");
        return `<row r="${r}" ht="${rowHeight}" customHeight="1">${cells}</row>`;
    }).join("");

    const widths=[8,24,14,12,14,14,14,22,22,22].map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join("");

    const sheetXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
 <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
 <dimension ref="A1:J${rows.length}"/>
 <cols>${widths}</cols>
 <sheetData>${sheetRows}</sheetData>
 <pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
 <pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;

    const workbookXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
 <sheets><sheet name="Clasificacion" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;

    const relsXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

    const workbookRelsXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
 <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
 <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

    const fills=[
        "FFFFFF","D9EAD3","FFF2CC","E7E6E6","FCE5CD","D9EAD3","D0E0E3","D9D2E9","EAD1DC","FFF2CC","CFE2F3","F4CCCC","EEEEEE"
    ].map(c=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`).join("");

    const xfs=[
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>',
        '<xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>',
        '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>',
        '<xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>',
        '<xf numFmtId="0" fontId="1" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>',
        '<xf numFmtId="0" fontId="0" fillId="5" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>',
        '<xf numFmtId="0" fontId="0" fillId="6" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>',
        '<xf numFmtId="0" fontId="0" fillId="7" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>',
        '<xf numFmtId="0" fontId="0" fillId="8" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>',
        '<xf numFmtId="0" fontId="0" fillId="9" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>',
        '<xf numFmtId="0" fontId="0" fillId="10" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>',
        '<xf numFmtId="0" fontId="0" fillId="11" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>',
        '<xf numFmtId="0" fontId="0" fillId="12" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment horizontal="center" vertical="top" wrapText="1"/></xf>'
    ].join("");

    const stylesXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
 <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
 <fills count="13"><fill><patternFill patternType="none"/></fill>${fills}</fills>
 <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
 <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
 <cellXfs count="13">${xfs}</cellXfs>
</styleSheet>`;

    const contentTypesXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
 <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
 <Default Extension="xml" ContentType="application/xml"/>
 <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
 <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
 <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

    const zip=new JSZip();
    zip.file("[Content_Types].xml",contentTypesXml);
    zip.folder("_rels").file(".rels",relsXml);
    zip.folder("xl").file("workbook.xml",workbookXml);
    zip.folder("xl").folder("_rels").file("workbook.xml.rels",workbookRelsXml);
    zip.folder("xl").folder("worksheets").file("sheet1.xml",sheetXml);
    zip.folder("xl").file("styles.xml",stylesXml);

    const blob=await zip.generateAsync({
        type:"blob",
        mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const filename=`clasificacion_${state.eventId||"militopo"}.xlsx`;
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},1500);
}

function downloadImportedResultsCsv(){
    const rows=[["Puesto","Participante","Nombre","Recorrido","Dificultad","Estado","Tiempo","Salida","Llegada","ControlesCorrectos","ControlesDescartados","ControlesPendientes"]];
    let rank=0;
    sortedImportedResults().forEach(r=>{
        rank++;
        const ms=resultMs(r);
        const controls=typeof resultCompletedControlsCount==="function"?resultCompletedControlsCount(r):(r.scans||[]).filter(s=>s.st==="correct"||s.status==="correct").length;
        rows.push([
            rank,
            r.participantId,
            resultParticipantName(r)||"",
            r.routeId||"",
            routeDifficultyForResult(r),
            r.completed?"OK":"AVISO",
            ms!==null?formatDuration(ms):"",
            r.startTime||"",
            r.finishTime||"",
            controls,
            resultDiscardedControlIds(r).join(" "),
            resultPendingControlIds(r).join(" ")
        ]);
    });
    downloadText(`clasificacion_${state.eventId}.csv`,rows.map(r=>r.map(csvEscape).join(";")).join("\n"));
}

function downloadDetailedSplitsCsv(){
    const rows=[["Participante","Nombre","Recorrido","Orden","Baliza","Hora","Estado"]];
    sortedImportedResults().forEach(r=>{
        (r.scans||[]).forEach((s,i)=>{
            rows.push([r.participantId,resultParticipantName(r)||"",r.routeId||"",i+1,s.id||s.controlId||"",s.t||s.timestamp||"",s.st||s.status||""]);
        });
    });
    downloadText(`parciales_${state.eventId}.csv`,rows.map(r=>r.map(csvEscape).join(";")).join("\n"));
}

async function startStep5ResultQrCamera(){
    const panel=document.getElementById("step5ResultQrCameraPanel");
    const video=document.getElementById("step5ResultQrVideo");
    const status=document.getElementById("step5ResultQrCameraStatus");
    if(!panel||!video||!status)return;

    // Coloca siempre la cámara justo debajo del botón ESCANEAR QR RESULTADO,
    // antes del bloque de importación manual. Así no depende del orden previo del DOM.
    const scanBlock=document.getElementById("step5ResultScanBlock");
    const scanButton=scanBlock?.querySelector('button[onclick*="startStep5ResultQrCamera"]');
    const scanButtonRow=scanButton?.closest(".btn-row");
    if(scanButtonRow && scanButtonRow.nextElementSibling!==panel){
        scanButtonRow.insertAdjacentElement("afterend",panel);
    }

    panel.style.display="block";
    status.className="status warn";
    status.textContent="Preparando lector QR de resultado...";

    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
        status.className="status err";
        status.textContent="Este navegador no permite cámara. Usa importación manual.";
        return;
    }

    step5ResultQrDetector=null;
    step5ResultQrUseJsQr=false;

    if("BarcodeDetector" in window){
        try{step5ResultQrDetector=new BarcodeDetector({formats:["qr_code"]})}catch(e){step5ResultQrDetector=null}
    }

    try{
        await loadJsQrLibrary();
        step5ResultQrUseJsQr=!!window.jsQR;
    }catch(e){
        if(!step5ResultQrDetector){
            status.className="status err";
            status.textContent="No se pudo cargar lector QR. Usa importación manual.";
            return;
        }
    }

    try{
        step5ResultQrCameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}},audio:false});
        video.srcObject=step5ResultQrCameraStream;
        await video.play();
        step5ResultQrCameraRunning=true;
        step5ResultQrLastValue="";
        step5ResultQrLastTime=0;
        status.className="status ok";
        status.textContent="Cámara activa. Apunta al QR final.";
        scanStep5ResultQrCameraLoop();
    }catch(e){
        status.className="status err";
        status.textContent="No se pudo abrir la cámara. Usa importación manual.";
        stopStep5ResultQrCamera();
    }
}

function stopStep5ResultQrCamera(){
    step5ResultQrCameraRunning=false;
    if(step5ResultQrCameraStream){
        step5ResultQrCameraStream.getTracks().forEach(t=>t.stop());
        step5ResultQrCameraStream=null;
    }
    const video=document.getElementById("step5ResultQrVideo");
    if(video)video.srcObject=null;
    const panel=document.getElementById("step5ResultQrCameraPanel");
    if(panel)panel.style.display="none";
}

async function scanStep5ResultQrCameraLoop(){
    if(!step5ResultQrCameraRunning)return;
    const video=document.getElementById("step5ResultQrVideo");
    const canvas=document.getElementById("step5ResultQrCanvas");
    const status=document.getElementById("step5ResultQrCameraStatus");

    try{
        let raw="";
        if(video&&video.readyState>=2){
            if(step5ResultQrDetector){
                try{
                    const codes=await step5ResultQrDetector.detect(video);
                    if(codes&&codes.length)raw=(codes[0].rawValue||"").trim();
                }catch(e){}
            }
            if(!raw&&step5ResultQrUseJsQr&&window.jsQR&&canvas){
                const w=video.videoWidth||1280,h=video.videoHeight||720;
                canvas.width=w;canvas.height=h;
                const ctx=canvas.getContext("2d",{willReadFrequently:true});
                ctx.drawImage(video,0,0,w,h);
                const img=ctx.getImageData(0,0,w,h);
                const code=window.jsQR(img.data,w,h,{inversionAttempts:"attemptBoth"});
                if(code&&code.data)raw=String(code.data).trim();
            }
        }

        if(raw){
            const now=Date.now();
            if(raw!==step5ResultQrLastValue||now-step5ResultQrLastTime>2500){
                step5ResultQrLastValue=raw;
                step5ResultQrLastTime=now;
                const input=document.getElementById("step5ResultImportInput");
                if(input)input.value=raw;
                const outcome=importResultPayload(raw);
                renderResultsControl();
                if(status){status.className=(outcome&&outcome.ok===false)?"status err":"status ok";status.textContent=(outcome&&outcome.message)||(outcome&&outcome.error)||"QR importado."}
                if(navigator.vibrate)navigator.vibrate(120);
                if(!(outcome&&outcome.keepScanning)){stopStep5ResultQrCamera();return;}
            }
        }else if(status){
            status.className="status warn";
            status.textContent="Buscando QR final...";
        }
    }catch(e){
        if(status){status.className="status warn";status.textContent="Buscando QR final..."}
    }

    if(step5ResultQrCameraRunning)requestAnimationFrame(scanStep5ResultQrCameraLoop);
}

function downloadText(filename,content){const blob=new Blob([content],{type:"text/plain;charset=utf-8"});saveAs(blob,filename)}function csvEscape(v){const s=String(v??"");return /[",\n;]/.test(s)?`"${s.replaceAll('"','""')}"`:s}function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]))}
const __renderPointsTableBase=renderPointsTable;renderPointsTable=function(){__renderPointsTableBase();renderIofDescriptionsEditor()};


function bootMilitopoOrientation(){try{init()}catch(error){console.error("MILITOPO Orientación · arranque",error)}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bootMilitopoOrientation,{once:true});
else setTimeout(bootMilitopoOrientation,0);



/* MILITOPO · mejora visual de todos los desplegables solo para Windows de escritorio */
function setupWindowsAllSelectContrast(){
    const ua=String(navigator.userAgent||navigator.platform||"");
    const isWindows=/Windows/i.test(ua);
    const isDesktopPointer=window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if(!isWindows || !isDesktopPointer) return;

    document.documentElement.classList.add("militopo-windows-desktop");
    if(document.getElementById("militopoWindowsAllSelectStyles")) return;

    const style=document.createElement("style");
    style.id="militopoWindowsAllSelectStyles";
    style.textContent=`
        .militopo-windows-desktop select {
            color-scheme: dark !important;
            background-color:#3b2719 !important;
            background-image:linear-gradient(180deg,#563720 0%,#342116 100%) !important;
            color:#fff4dd !important;
            border:1.5px solid rgba(238,194,112,.78) !important;
            box-shadow:inset 0 1px 0 rgba(255,255,255,.09),0 8px 20px rgba(0,0,0,.18) !important;
            text-shadow:none !important;
            font-weight:700 !important;
            opacity:1 !important;
        }
        .militopo-windows-desktop select:hover {
            border-color:#f4cf88 !important;
            filter:brightness(1.05) !important;
        }
        .militopo-windows-desktop select:focus,
        .militopo-windows-desktop select:focus-visible {
            outline:none !important;
            border-color:#ffd98a !important;
            box-shadow:0 0 0 3px rgba(240,193,106,.24),inset 0 1px 0 rgba(255,255,255,.10) !important;
        }
        .militopo-windows-desktop select option,
        .militopo-windows-desktop select optgroup {
            background:#2d2118 !important;
            color:#fff7e8 !important;
            font-weight:700 !important;
        }
        .militopo-windows-desktop select option:checked {
            background:#d8a54d !important;
            color:#211509 !important;
        }
        .militopo-windows-desktop select option:hover {
            background:#6b4a2c !important;
            color:#fffaf0 !important;
        }
        .militopo-windows-desktop select:disabled {
            opacity:.62 !important;
            color:#d8cbb5 !important;
            cursor:not-allowed !important;
        }
    `;
    document.head.appendChild(style);
}

document.addEventListener("DOMContentLoaded",setupWindowsAllSelectContrast);


/* ===== MILITOPO ORIENTACIÓN · BIBLIOTECA DE PLANOS GEOTIFF / KMZ V2 ===== */
const ORIENTATION_GEOTIFF_DB="militopo_orientation_maps_v1";
const ORIENTATION_GEOTIFF_STORE="maps";
const ORIENTATION_MAP_ACTIVE_KEY="__active_map__";
const orientationGeoTiffRuntime={ready:false,url:null,dataUrl:null,bounds:null,imageWidth:0,imageHeight:0,overlay:null,name:"",epsg:null,id:null,format:null,builtin:false};
let orientationBuiltinMaps=[];
async function loadOrientationBuiltinMaps(){
    try{
        const response=await fetch("./maps/index.json",{cache:"no-store"});
        if(!response.ok)throw new Error("No se pudo abrir el catálogo de planos integrados");
        const data=await response.json();
        orientationBuiltinMaps=Array.isArray(data&&data.maps)?data.maps.filter(m=>m&&m.id&&m.file&&m.name):[];
    }catch(err){
        console.warn("No se pudo cargar el catálogo de planos integrados",err);
        orientationBuiltinMaps=[];
    }
    return orientationBuiltinMaps;
}

function setOrientationGeoTiffStatus(message,type="warn"){
    const el=document.getElementById("orientationGeoTiffStatus");
    if(el){el.className="status "+type;el.innerHTML=message}
}
function orientationMapId(){return "map_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8)}
function updateOrientationCustomOpacityPanel(){
    const panel=document.getElementById("orientationGeoTiffOpacityPanel");
    if(!panel)return;
    const visible=state.selectedMapLayer==="custom"&&orientationGeoTiffRuntime.ready;
    panel.hidden=!visible;
    panel.setAttribute("aria-hidden",visible?"false":"true");
}
function updateOrientationGeoTiffUi(){
    const ready=orientationGeoTiffRuntime.ready;
    const fit=document.getElementById("orientationGeoTiffFitBtn"),rem=document.getElementById("orientationGeoTiffRemoveBtn");
    if(fit)fit.disabled=!ready;if(rem)rem.disabled=!ready||!!orientationGeoTiffRuntime.builtin;
    const opacity=Number.isFinite(Number(state.customGeoTiffOpacity))?Number(state.customGeoTiffOpacity):1;
    const slider=document.getElementById("orientationGeoTiffOpacity");if(slider)slider.value=Math.round(opacity*100);
    const label=document.getElementById("orientationGeoTiffOpacityValue");if(label)label.textContent=Math.round(opacity*100)+" %";
    updateOrientationCustomOpacityPanel();
    if(ready){
        const m=state.customGeoTiffMeta||{};
        const format=(m.format||orientationGeoTiffRuntime.format||"PLANO").toUpperCase();
        const ref=m.epsg?`EPSG:${escapeHtml(String(m.epsg))}`:"Coordenadas KML/KMZ";
        setOrientationGeoTiffStatus(`✅ <b>${escapeHtml(m.name||orientationGeoTiffRuntime.name||"Plano propio")}</b> · ${format} · ${ref}<br>${orientationGeoTiffRuntime.builtin?"Plano integrado en MILITOPO y disponible en cualquier dispositivo.":"Guardado en la biblioteca local de este dispositivo."} Usa la opacidad para compararlo con las demás capas.`,"ok");
    }
}
function orientationGeoTiffDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(ORIENTATION_GEOTIFF_DB,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(ORIENTATION_GEOTIFF_STORE))req.result.createObjectStore(ORIENTATION_GEOTIFF_STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function orientationDbPut(value,key){const db=await orientationGeoTiffDb();await new Promise((resolve,reject)=>{const tx=db.transaction(ORIENTATION_GEOTIFF_STORE,"readwrite");tx.objectStore(ORIENTATION_GEOTIFF_STORE).put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}
async function orientationDbGet(key){const db=await orientationGeoTiffDb();const value=await new Promise((resolve,reject)=>{const tx=db.transaction(ORIENTATION_GEOTIFF_STORE,"readonly");const req=tx.objectStore(ORIENTATION_GEOTIFF_STORE).get(key);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)});db.close();return value}
async function orientationDbDelete(key){const db=await orientationGeoTiffDb();await new Promise((resolve,reject)=>{const tx=db.transaction(ORIENTATION_GEOTIFF_STORE,"readwrite");tx.objectStore(ORIENTATION_GEOTIFF_STORE).delete(key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}
async function orientationDbEntries(){const db=await orientationGeoTiffDb();const entries=await new Promise((resolve,reject)=>{const tx=db.transaction(ORIENTATION_GEOTIFF_STORE,"readonly"),store=tx.objectStore(ORIENTATION_GEOTIFF_STORE),out=[];const req=store.openCursor();req.onsuccess=e=>{const c=e.target.result;if(c){out.push({key:c.key,value:c.value});c.continue()}else resolve(out)};req.onerror=()=>reject(req.error)});db.close();return entries}
async function saveOrientationGeoTiffRecord(record){await orientationDbPut(record,record.id);await orientationDbPut(record.id,ORIENTATION_MAP_ACTIVE_KEY)}
async function readOrientationGeoTiffRecord(){const active=await orientationDbGet(ORIENTATION_MAP_ACTIVE_KEY);if(active){const r=await orientationDbGet(active);if(r)return r}const legacy=await orientationDbGet("active");if(legacy){legacy.id=legacy.id||orientationMapId();legacy.format=legacy.format||"geotiff";await saveOrientationGeoTiffRecord(legacy);await orientationDbDelete("active");return legacy}return null}
async function listOrientationMapRecords(){return (await orientationDbEntries()).filter(e=>e.key!==ORIENTATION_MAP_ACTIVE_KEY&&e.key!=="active"&&e.value&&e.value.pngBlob).map(e=>e.value).sort((a,b)=>String(a.name).localeCompare(String(b.name),"es"))}
async function refreshOrientationMapLibrary(selectedId){
    const select=document.getElementById("orientationGeoTiffLibrary");if(!select)return;
    if(!orientationBuiltinMaps.length)await loadOrientationBuiltinMaps();
    const records=await listOrientationMapRecords();
    const builtinOptions=orientationBuiltinMaps.length?`<optgroup label="PLANOS INTEGRADOS EN MILITOPO">${orientationBuiltinMaps.map(m=>`<option value="builtin:${escapeHtml(m.id)}">${escapeHtml(m.name)} · ${(m.format||"plano").toUpperCase()}</option>`).join("")}</optgroup>`:"";
    const localRecords=records.filter(r=>!String(r.id||"").startsWith("builtin:"));
    const localOptions=localRecords.length?`<optgroup label="PLANOS GUARDADOS EN ESTE DISPOSITIVO">${localRecords.map(r=>`<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)} · ${(r.format||"plano").toUpperCase()}</option>`).join("")}</optgroup>`:"";
    select.innerHTML='<option value="">— Sin plano seleccionado —</option>'+builtinOptions+localOptions;
    select.value=selectedId||orientationGeoTiffRuntime.id||"";
}
async function deleteOrientationGeoTiffRecord(id){if(id)await orientationDbDelete(id);await orientationDbDelete(ORIENTATION_MAP_ACTIVE_KEY)}
async function ensureOrientationGeoTiffLib(){if(window.GeoTIFF)return window.GeoTIFF;await loadScriptOnce("https://cdn.jsdelivr.net/npm/geotiff@2.1.3/dist-browser/geotiff.min.js",()=>window.GeoTIFF);if(!window.GeoTIFF)throw new Error("No se pudo cargar la librería GeoTIFF");return window.GeoTIFF}
function orientationGeoTiffEpsg(image){const g=image.getGeoKeys?image.getGeoKeys():{};return Number(g.ProjectedCSTypeGeoKey||g.GeographicTypeGeoKey||0)||null}
function ensureOrientationProjection(epsg){if(!window.proj4)throw new Error("Proj4 no está disponible");const code="EPSG:"+epsg;if(proj4.defs(code))return code;const n=Number(epsg);if(n>=32601&&n<=32660)proj4.defs(code,`+proj=utm +zone=${n-32600} +datum=WGS84 +units=m +no_defs`);else if(n>=25801&&n<=25860)proj4.defs(code,`+proj=utm +zone=${n-25800} +ellps=GRS80 +units=m +no_defs`);else if(n===4326)proj4.defs(code,"+proj=longlat +datum=WGS84 +no_defs");else throw new Error(`EPSG:${epsg} no reconocido. Usa GeoTIFF UTM ETRS89/WGS84.`);return code}
function orientationBoundsFromProjected(bbox,epsg){const code=ensureOrientationProjection(epsg),a=proj4(code,"EPSG:4326",[bbox[0],bbox[1]]),b=proj4(code,"EPSG:4326",[bbox[2],bbox[3]]);return [[Math.min(a[1],b[1]),Math.min(a[0],b[0])],[Math.max(a[1],b[1]),Math.max(a[0],b[0])]]}
async function orientationRasterToPng(image,maxDim=4096){const srcW=image.getWidth(),srcH=image.getHeight(),scale=Math.min(1,maxDim/Math.max(srcW,srcH)),w=Math.max(1,Math.round(srcW*scale)),h=Math.max(1,Math.round(srcH*scale));const rasters=await image.readRasters({interleave:true,width:w,height:h});const samples=image.getSamplesPerPixel?image.getSamplesPerPixel():Math.max(1,Math.round(rasters.length/(w*h)));const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;const ctx=canvas.getContext("2d"),out=ctx.createImageData(w,h),d=out.data;let min=Infinity,max=-Infinity;if(samples===1){for(let i=0;i<rasters.length;i++){const v=Number(rasters[i]);if(Number.isFinite(v)){min=Math.min(min,v);max=Math.max(max,v)}}if(!Number.isFinite(min)||max<=min){min=0;max=255}}for(let i=0,p=0;i<w*h;i++,p+=4){if(samples>=3){d[p]=rasters[i*samples]||0;d[p+1]=rasters[i*samples+1]||0;d[p+2]=rasters[i*samples+2]||0;d[p+3]=samples>=4?(rasters[i*samples+3]??255):255}else{const v=Math.max(0,Math.min(255,Math.round(((Number(rasters[i])-min)/(max-min||1))*255)));d[p]=d[p+1]=d[p+2]=v;d[p+3]=255}}ctx.putImageData(out,0,0);const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("No se pudo convertir el GeoTIFF a PNG")),"image/png"));return {blob,dataUrl:canvas.toDataURL("image/png"),width:w,height:h,sourceWidth:srcW,sourceHeight:srcH}}
function imageFromBlob(blob){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(blob),img=new Image();img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("No se pudo abrir la imagen incluida en el KMZ"))};img.src=url})}
function kmzParseCoordinates(text){return text.trim().split(/\s+/).map(v=>{const a=v.split(",").map(Number);return {lng:a[0],lat:a[1]}}).filter(p=>Number.isFinite(p.lng)&&Number.isFinite(p.lat))}
function kmlQuadCorners(points){if(points.length!==4)throw new Error("El KMZ debe contener cuatro esquinas georreferenciadas");/* gx:LatLonQuad define las esquinas en orden: inferior izquierda, inferior derecha, superior derecha, superior izquierda. Respetar este orden conserva la rotación real del plano exportado por ATAK. */return {bl:points[0],br:points[1],tr:points[2],tl:points[3]}}
function affineForTriangles(s0,s1,s2,d0,d1,d2){const den=s0.x*(s1.y-s2.y)+s1.x*(s2.y-s0.y)+s2.x*(s0.y-s1.y);if(Math.abs(den)<1e-9)return null;const a=(d0.x*(s1.y-s2.y)+d1.x*(s2.y-s0.y)+d2.x*(s0.y-s1.y))/den,b=(d0.y*(s1.y-s2.y)+d1.y*(s2.y-s0.y)+d2.y*(s0.y-s1.y))/den,c=(d0.x*(s2.x-s1.x)+d1.x*(s0.x-s2.x)+d2.x*(s1.x-s0.x))/den,d=(d0.y*(s2.x-s1.x)+d1.y*(s0.x-s2.x)+d2.y*(s1.x-s0.x))/den,e=(d0.x*(s1.x*s2.y-s2.x*s1.y)+d1.x*(s2.x*s0.y-s0.x*s2.y)+d2.x*(s0.x*s1.y-s1.x*s0.y))/den,f=(d0.y*(s1.x*s2.y-s2.x*s1.y)+d1.y*(s2.x*s0.y-s0.x*s2.y)+d2.y*(s0.x*s1.y-s1.x*s0.y))/den;return [a,b,c,d,e,f]}
function drawWarpTriangle(ctx,img,s0,s1,s2,d0,d1,d2){const m=affineForTriangles(s0,s1,s2,d0,d1,d2);if(!m)return;ctx.save();ctx.beginPath();ctx.moveTo(d0.x,d0.y);ctx.lineTo(d1.x,d1.y);ctx.lineTo(d2.x,d2.y);ctx.closePath();ctx.clip();ctx.setTransform(...m);ctx.drawImage(img,0,0);ctx.restore()}
async function kmzImageToNorthUp(blob,points,maxDim=4096){const img=await imageFromBlob(blob),q=kmlQuadCorners(points),west=Math.min(...points.map(p=>p.lng)),east=Math.max(...points.map(p=>p.lng)),south=Math.min(...points.map(p=>p.lat)),north=Math.max(...points.map(p=>p.lat)),latScale=Math.max(.2,Math.cos(((north+south)/2)*Math.PI/180)),geoRatio=((east-west)*latScale)/Math.max(1e-9,north-south),w=geoRatio>=1?maxDim:Math.max(1,Math.round(maxDim*geoRatio)),h=geoRatio>=1?Math.max(1,Math.round(maxDim/geoRatio)):maxDim,canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;const ctx=canvas.getContext("2d");ctx.clearRect(0,0,w,h);const toPix=p=>({x:(p.lng-west)/(east-west)*w,y:(north-p.lat)/(north-south)*h}),D={tl:toPix(q.tl),tr:toPix(q.tr),br:toPix(q.br),bl:toPix(q.bl)},steps=28;for(let iy=0;iy<steps;iy++)for(let ix=0;ix<steps;ix++){const u0=ix/steps,u1=(ix+1)/steps,v0=iy/steps,v1=(iy+1)/steps,bilerp=(u,v)=>({x:(1-u)*(1-v)*D.tl.x+u*(1-v)*D.tr.x+u*v*D.br.x+(1-u)*v*D.bl.x,y:(1-u)*(1-v)*D.tl.y+u*(1-v)*D.tr.y+u*v*D.br.y+(1-u)*v*D.bl.y}),s00={x:u0*img.naturalWidth,y:v0*img.naturalHeight},s10={x:u1*img.naturalWidth,y:v0*img.naturalHeight},s11={x:u1*img.naturalWidth,y:v1*img.naturalHeight},s01={x:u0*img.naturalWidth,y:v1*img.naturalHeight},d00=bilerp(u0,v0),d10=bilerp(u1,v0),d11=bilerp(u1,v1),d01=bilerp(u0,v1);drawWarpTriangle(ctx,img,s00,s10,s11,d00,d10,d11);drawWarpTriangle(ctx,img,s00,s11,s01,d00,d11,d01)}const pngBlob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("No se pudo preparar la imagen del KMZ")),"image/png"));return {blob:pngBlob,dataUrl:canvas.toDataURL("image/png"),width:w,height:h,sourceWidth:img.naturalWidth,sourceHeight:img.naturalHeight,bounds:[[south,west],[north,east]]}}
async function parseOrientationKmz(file){if(typeof JSZip==="undefined")throw new Error("JSZip no está disponible");const zip=await JSZip.loadAsync(file),kmlEntry=Object.values(zip.files).find(e=>!e.dir&&e.name.toLowerCase().endsWith(".kml"));if(!kmlEntry)throw new Error("El KMZ no contiene un archivo KML");const xml=new DOMParser().parseFromString(await kmlEntry.async("text"),"application/xml");if(xml.querySelector("parsererror"))throw new Error("El KML del KMZ no es válido");const href=(xml.querySelector("GroundOverlay Icon href")||xml.querySelector("Icon href"))?.textContent?.trim();if(!href)throw new Error("El KMZ no indica la imagen del plano");let points=[];const quad=xml.getElementsByTagNameNS("http://www.google.com/kml/ext/2.2","LatLonQuad")[0]||[...xml.getElementsByTagName("gx:LatLonQuad")][0];if(quad){const c=quad.getElementsByTagName("coordinates")[0];if(c)points=kmzParseCoordinates(c.textContent)}if(points.length!==4){const box=xml.querySelector("GroundOverlay LatLonBox");if(box){const north=Number(box.querySelector("north")?.textContent),south=Number(box.querySelector("south")?.textContent),east=Number(box.querySelector("east")?.textContent),west=Number(box.querySelector("west")?.textContent);if([north,south,east,west].every(Number.isFinite))points=[{lng:west,lat:south},{lng:east,lat:south},{lng:east,lat:north},{lng:west,lat:north}]}}if(points.length!==4)throw new Error("No se encontraron las cuatro esquinas del plano en el KMZ");const cleanHref=decodeURIComponent(href).replace(/^\.\//,""),imageEntry=zip.file(cleanHref)||Object.values(zip.files).find(e=>!e.dir&&e.name.split("/").pop()===cleanHref.split("/").pop());if(!imageEntry)throw new Error("No se encontró la imagen referenciada dentro del KMZ");const ext=imageEntry.name.toLowerCase().split(".").pop(),mime=ext==="png"?"image/png":ext==="webp"?"image/webp":"image/jpeg",blob=await imageEntry.async("blob");return kmzImageToNorthUp(new Blob([blob],{type:mime}),points,4096)}
function applyOrientationGeoTiffRecord(record){if(orientationGeoTiffRuntime.url)URL.revokeObjectURL(orientationGeoTiffRuntime.url);orientationGeoTiffRuntime.ready=true;orientationGeoTiffRuntime.url=URL.createObjectURL(record.pngBlob);orientationGeoTiffRuntime.dataUrl=record.dataUrl||null;orientationGeoTiffRuntime.bounds=record.bounds;orientationGeoTiffRuntime.imageWidth=record.width;orientationGeoTiffRuntime.imageHeight=record.height;orientationGeoTiffRuntime.name=record.name;orientationGeoTiffRuntime.epsg=record.epsg||null;orientationGeoTiffRuntime.id=record.id;orientationGeoTiffRuntime.format=record.format||"geotiff";orientationGeoTiffRuntime.builtin=!!record.builtin;state.customGeoTiffMeta={id:record.id,name:record.name,format:record.format||"geotiff",epsg:record.epsg||null,bounds:record.bounds,width:record.width,height:record.height,sourceWidth:record.sourceWidth,sourceHeight:record.sourceHeight,importedAt:record.importedAt};updateOrientationGeoTiffUi();refreshOrientationMapLibrary(record.id);if(state.selectedMapLayer==="custom")showOrientationGeoTiffOverlay()}
async function detectOrientationCustomMapType(file){
  if(!file)throw new Error("No se ha seleccionado ningún archivo");
  const header=new Uint8Array(await file.slice(0,16).arrayBuffer());
  const isZip=header.length>=4&&header[0]===0x50&&header[1]===0x4B&&(header[2]===0x03||header[2]===0x05||header[2]===0x07)&&(header[3]===0x04||header[3]===0x06||header[3]===0x08);
  const isTiffLE=header.length>=4&&header[0]===0x49&&header[1]===0x49&&header[2]===0x2A&&header[3]===0x00;
  const isTiffBE=header.length>=4&&header[0]===0x4D&&header[1]===0x4D&&header[2]===0x00&&header[3]===0x2A;
  if(isZip)return "kmz";
  if(isTiffLE||isTiffBE)return "geotiff";
  const type=String(file.type||"").toLowerCase();
  if(type.includes("kmz")||type.includes("zip"))return "kmz";
  if(type.includes("tiff"))return "geotiff";
  const name=String(file.name||"").toLowerCase();
  if(name.endsWith(".kmz"))return "kmz";
  if(name.endsWith(".tif")||name.endsWith(".tiff"))return "geotiff";
  throw new Error("El archivo seleccionado no es un KMZ ni un GeoTIFF compatible");
}
async function importOrientationCustomMap(file){
  if(!file)return;
  setOrientationGeoTiffStatus("⏳ Analizando el archivo seleccionado...","warn");
  try{
    const kind=await detectOrientationCustomMapType(file);
    if(kind==="kmz")return await importOrientationKmz(file);
    return await importOrientationGeoTiff(file);
  }catch(err){
    console.error(err);
    setOrientationGeoTiffStatus(`⚠️ No se pudo reconocer el plano.<br><b>Motivo:</b> ${escapeHtml(err&&err.message?err.message:(err==null?"Error interno sin detalle":String(err)))}`,"err");
    const input=document.getElementById("orientationGeoTiffInput");if(input)input.value="";
  }
}
async function importOrientationGeoTiff(file){if(!file)return;setOrientationGeoTiffStatus("⏳ Leyendo y preparando el GeoTIFF. En planos grandes puede tardar...","warn");try{const GeoTIFF=await ensureOrientationGeoTiffLib(),tiff=await GeoTIFF.fromArrayBuffer(await file.arrayBuffer()),image=await tiff.getImage(),bbox=image.getBoundingBox(),epsg=orientationGeoTiffEpsg(image);if(!bbox||bbox.length!==4||!epsg)throw new Error("El archivo no contiene georreferenciación EPSG legible");const bounds=orientationBoundsFromProjected(bbox,epsg),png=await orientationRasterToPng(image,4096),record={id:orientationMapId(),name:file.name,format:"geotiff",epsg,bounds,pngBlob:png.blob,dataUrl:png.dataUrl,width:png.width,height:png.height,sourceWidth:png.sourceWidth,sourceHeight:png.sourceHeight,importedAt:new Date().toISOString()};await saveOrientationGeoTiffRecord(record);applyOrientationGeoTiffRecord(record);state.customGeoTiffOpacity=1;switchLayer("custom");fitOrientationGeoTiff();saveState();toast("Plano GeoTIFF guardado en la biblioteca")}catch(err){console.error(err);setOrientationGeoTiffStatus(`⚠️ No se pudo cargar el GeoTIFF.<br><b>Motivo:</b> ${escapeHtml(err&&err.message?err.message:(err==null?"Error interno sin detalle":String(err)))}`,"err")}finally{const input=document.getElementById("orientationGeoTiffInput");if(input)input.value=""}}
async function importOrientationKmz(file){setOrientationGeoTiffStatus("⏳ Abriendo el KMZ y preparando su imagen georreferenciada...","warn");try{const png=await parseOrientationKmz(file),record={id:orientationMapId(),name:file.name,format:"kmz",epsg:null,bounds:png.bounds,pngBlob:png.blob,dataUrl:png.dataUrl,width:png.width,height:png.height,sourceWidth:png.sourceWidth,sourceHeight:png.sourceHeight,importedAt:new Date().toISOString()};await saveOrientationGeoTiffRecord(record);applyOrientationGeoTiffRecord(record);state.customGeoTiffOpacity=1;switchLayer("custom");fitOrientationGeoTiff();saveState();toast("Plano KMZ guardado en la biblioteca")}catch(err){console.error(err);setOrientationGeoTiffStatus(`⚠️ No se pudo cargar el KMZ.<br><b>Motivo:</b> ${escapeHtml(err&&err.message?err.message:(err==null?"Error interno sin detalle":String(err)))}`,"err")}finally{const input=document.getElementById("orientationGeoTiffInput");if(input)input.value=""}}
async function activateIntegratedOrientationMap(mapId){
    const cleanId=String(mapId||"").trim();
    if(!cleanId)return;
    await activateOrientationCustomMap(`builtin:${cleanId}`);
}
window.activateIntegratedOrientationMap=activateIntegratedOrientationMap;
async function activateOrientationCustomMap(id){
    if(!id)return;
    if(String(id).startsWith("builtin:")){
        const builtinId=String(id).slice(8),meta=orientationBuiltinMaps.find(m=>String(m.id)===builtinId);
        if(!meta)return toast("No se encontró el plano integrado");
        setOrientationGeoTiffStatus(`⏳ Cargando <b>${escapeHtml(meta.name)}</b> desde MILITOPO...`,"warn");
        try{
            let record=await orientationDbGet(id);
            const expectedFormat=String(meta.format||"").toLowerCase();
            const storedFormat=String(record&&record.format||"").toLowerCase();
            const sourceChanged=!!record&&String(record.sourceFile||"")!==String(meta.file||"");
            const formatChanged=!!record&&storedFormat!==expectedFormat;
            if(record&&(!record.pngBlob||!Array.isArray(record.bounds)||record.bounds.length!==2||sourceChanged||formatChanged)){
                await orientationDbDelete(id);
                record=null;
            }
            if(!record){
                const response=await fetch(meta.file,{cache:"force-cache"});
                if(!response.ok)throw new Error(`No se pudo descargar el plano integrado (${response.status})`);
                const blob=await response.blob();
                const format=String(meta.format||"").toLowerCase();
                if(format==="image"||format==="png"||format==="jpg"||format==="jpeg"||format==="webp"){
                    if(!Array.isArray(meta.bounds)||meta.bounds.length!==2)throw new Error("El catálogo no contiene los límites geográficos del plano");
                    const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error("No se pudo preparar la imagen integrada"));reader.readAsDataURL(blob)});
                    record={id,name:meta.name,format:"image",epsg:null,bounds:meta.bounds,pngBlob:blob,dataUrl,width:Number(meta.width)||0,height:Number(meta.height)||0,sourceWidth:Number(meta.width)||0,sourceHeight:Number(meta.height)||0,importedAt:new Date().toISOString(),builtin:true,sourceFile:meta.file};
                }else if(format==="kmz"){
                    const png=await parseOrientationKmz(blob);
                    record={id,name:meta.name,format:"kmz",epsg:null,bounds:png.bounds,pngBlob:png.blob,dataUrl:png.dataUrl,width:png.width,height:png.height,sourceWidth:png.sourceWidth,sourceHeight:png.sourceHeight,importedAt:new Date().toISOString(),builtin:true,sourceFile:meta.file};
                }else if(format==="geotiff"||format==="tif"||format==="tiff"){
                    const GeoTIFF=await ensureOrientationGeoTiffLib();
                    const tiff=await GeoTIFF.fromArrayBuffer(await blob.arrayBuffer());
                    const image=await tiff.getImage();
                    const bbox=image.getBoundingBox();
                    const epsg=orientationGeoTiffEpsg(image);
                    if(!bbox||bbox.length!==4||!epsg)throw new Error("El GeoTIFF integrado no contiene georreferenciación EPSG legible");
                    const bounds=orientationBoundsFromProjected(bbox,epsg);
                    const png=await orientationRasterToPng(image,4096);
                    record={id,name:meta.name,format:"geotiff",epsg,bounds,pngBlob:png.blob,dataUrl:png.dataUrl,width:png.width,height:png.height,sourceWidth:png.sourceWidth,sourceHeight:png.sourceHeight,importedAt:new Date().toISOString(),builtin:true,sourceFile:meta.file};
                }else{
                    throw new Error("Formato integrado no compatible");
                }
                await orientationDbPut(record,id);
            }
            await orientationDbPut(id,ORIENTATION_MAP_ACTIVE_KEY);
            hideOrientationGeoTiffOverlay();applyOrientationGeoTiffRecord(record);switchLayer("custom");fitOrientationGeoTiff();saveState();toast(`Plano integrado activado: ${meta.name}`);
        }catch(err){
            console.error(err);setOrientationGeoTiffStatus(`⚠️ No se pudo cargar el plano integrado.<br><b>Motivo:</b> ${escapeHtml(err&&err.message?err.message:(err==null?"Error interno sin detalle":String(err)))}`,"err");
        }
        return;
    }
    const record=await orientationDbGet(id);if(!record)return toast("No se encontró el plano guardado");await orientationDbPut(id,ORIENTATION_MAP_ACTIVE_KEY);hideOrientationGeoTiffOverlay();applyOrientationGeoTiffRecord(record);switchLayer("custom");fitOrientationGeoTiff();saveState()
}
async function restoreOrientationGeoTiffFromDb(){try{await loadOrientationBuiltinMaps();let record=await readOrientationGeoTiffRecord();if(record&&String(record.id||"").startsWith("builtin:")){const builtinId=String(record.id).slice(8);if(!orientationBuiltinMaps.some(m=>String(m.id)===builtinId)){await orientationDbDelete(record.id);await orientationDbDelete(ORIENTATION_MAP_ACTIVE_KEY);record=null}}if(record)applyOrientationGeoTiffRecord(record);else{await refreshOrientationMapLibrary();updateOrientationGeoTiffUi()}}catch(err){console.warn("No se pudo restaurar el plano propio",err);setOrientationGeoTiffStatus("⚠️ La biblioteca de planos no pudo restaurarse en este navegador.","err")}}
function bringOrientationLayerToFront(layer){if(!layer)return;try{if(typeof layer.bringToFront==='function'){layer.bringToFront();return}if(typeof layer.eachLayer==='function'){layer.eachLayer(function(child){if(child&&typeof child.bringToFront==='function')child.bringToFront()})}}catch(e){console.warn('No se pudo reordenar una capa del mapa:',e)}}function showOrientationGeoTiffOverlay(){if(!map||!orientationGeoTiffRuntime.ready)return;if(orientationGeoTiffRuntime.overlay&&map.hasLayer(orientationGeoTiffRuntime.overlay))map.removeLayer(orientationGeoTiffRuntime.overlay);orientationGeoTiffRuntime.overlay=L.imageOverlay(orientationGeoTiffRuntime.url,orientationGeoTiffRuntime.bounds,{opacity:Number.isFinite(Number(state.customGeoTiffOpacity))?Number(state.customGeoTiffOpacity):1,interactive:false,zIndex:120}).addTo(map);bringOrientationLayerToFront(routeLayer);bringOrientationLayerToFront(markersLayer);bringPlanPreviewToFront()}
function hideOrientationGeoTiffOverlay(){if(map&&orientationGeoTiffRuntime.overlay&&map.hasLayer(orientationGeoTiffRuntime.overlay))map.removeLayer(orientationGeoTiffRuntime.overlay)}
function setOrientationGeoTiffOpacity(value){state.customGeoTiffOpacity=Math.max(0,Math.min(1,Number(value)/100));if(orientationGeoTiffRuntime.overlay)orientationGeoTiffRuntime.overlay.setOpacity(state.customGeoTiffOpacity);const label=document.getElementById("orientationGeoTiffOpacityValue");if(label)label.textContent=Math.round(state.customGeoTiffOpacity*100)+" %";saveState()}
function fitOrientationGeoTiff(){if(map&&orientationGeoTiffRuntime.bounds){map.fitBounds(orientationGeoTiffRuntime.bounds,{padding:[18,18]});setTimeout(()=>map.invalidateSize(),80)}}
async function removeOrientationGeoTiff(){if(!orientationGeoTiffRuntime.ready)return;if(!confirm(`¿Eliminar "${orientationGeoTiffRuntime.name}" de la biblioteca local de este dispositivo?`))return;const removedId=orientationGeoTiffRuntime.id;hideOrientationGeoTiffOverlay();await deleteOrientationGeoTiffRecord(removedId);if(orientationGeoTiffRuntime.url)URL.revokeObjectURL(orientationGeoTiffRuntime.url);Object.assign(orientationGeoTiffRuntime,{ready:false,url:null,dataUrl:null,bounds:null,imageWidth:0,imageHeight:0,overlay:null,name:"",epsg:null,id:null,format:null,builtin:false});state.customGeoTiffMeta=null;const records=await listOrientationMapRecords();if(records.length){await saveOrientationGeoTiffRecord(records[0]);applyOrientationGeoTiffRecord(records[0])}else{if(state.selectedMapLayer==="custom")switchLayer("mapant");await refreshOrientationMapLibrary();updateOrientationGeoTiffUi();setOrientationGeoTiffStatus("No hay ningún plano propio cargado.","warn")}saveState()}
async function orientationGeoTiffDataUrlForBounds(bounds,width,height){if(!orientationGeoTiffRuntime.ready)throw new Error("No hay plano propio cargado");let src=orientationGeoTiffRuntime.dataUrl;if(!src){const record=await orientationDbGet(orientationGeoTiffRuntime.id);src=record&&record.dataUrl;if(!src)throw new Error("No se pudo leer la imagen guardada")}const b=orientationGeoTiffRuntime.bounds,sw=b[0],ne=b[1],west=sw[1],south=sw[0],east=ne[1],north=ne[0],inter={west:Math.max(west,bounds.west),east:Math.min(east,bounds.east),south:Math.max(south,bounds.south),north:Math.min(north,bounds.north)};if(inter.west>=inter.east||inter.south>=inter.north)throw new Error("El marco PDF queda fuera del plano importado");const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error("No se pudo abrir el plano para el PDF"));i.src=src});const sx=(inter.west-west)/(east-west)*img.naturalWidth,sy=(north-inter.north)/(north-south)*img.naturalHeight,swp=(inter.east-inter.west)/(east-west)*img.naturalWidth,shp=(inter.north-inter.south)/(north-south)*img.naturalHeight,c=document.createElement("canvas");c.width=width;c.height=height;const ctx=c.getContext("2d");ctx.fillStyle="#ffffff";ctx.fillRect(0,0,width,height);const dx=(inter.west-bounds.west)/(bounds.east-bounds.west)*width,dy=(bounds.north-inter.north)/(bounds.north-bounds.south)*height,dw=(inter.east-inter.west)/(bounds.east-bounds.west)*width,dh=(inter.north-inter.south)/(bounds.north-bounds.south)*height;ctx.drawImage(img,sx,sy,swp,shp,dx,dy,dw,dh);return c.toDataURL("image/png")}
/* ===== FIN BIBLIOTECA DE PLANOS GEOTIFF / KMZ V2 ===== */

/* =========================================================
   MILITOPO V13 · PASO 7 ANÁLISIS + TRAMOS MANUALES
   Fase 1: configuración común por posición, análisis de
   resultados existentes y archivo completo reabrible.
   ========================================================= */
(function(){
  const originalNormalizeAppStep=normalizeAppStep;
  normalizeAppStep=function(n){
    n=Number(n);
    return Number.isFinite(n)?Math.min(7,Math.max(1,Math.round(n))):1;
  };

  function ensureRaceAnalysisState(){
    if(!state.raceAnalysis||typeof state.raceAnalysis!=="object")state.raceAnalysis={};
    if(!Array.isArray(state.raceAnalysis.segments))state.raceAnalysis.segments=[];
    if(!state.raceAnalysis.version)state.raceAnalysis.version=1;
    if(!state.raceAnalysis.createdAt)state.raceAnalysis.createdAt=new Date().toISOString();
    if(!state.raceAnalysis.trackSettings)state.raceAnalysis.trackSettings={enabled:true,minSeconds:4,minDistanceM:4,maxAccuracyM:35};
    if(!Number.isFinite(Number(state.raceAnalysis.discardPenaltyMinutes)))state.raceAnalysis.discardPenaltyMinutes=15;
    return state.raceAnalysis;
  }

  function controlsCountForSegments(){
    const routes=(state.routes||[]).filter(r=>!isRouteSkipped(r));
    const counts=routes.map(r=>(r.points||[]).filter(id=>id!=="START"&&id!=="FINISH").length).filter(Number.isFinite);
    return counts.length?Math.min(...counts):Math.max(0,Number(state.controlsPerRoute)||0);
  }

  function balancedBoundaries(count,total){
    const out=[];
    for(let i=1;i<count;i++)out.push(Math.max(1,Math.min(total-1,Math.round(total*i/count))));
    return [...new Set(out)].sort((a,b)=>a-b);
  }

  window.buildRaceSegmentsEditor=function(resetEvenly=false){
    const analysis=ensureRaceAnalysisState();
    const total=controlsCountForSegments();
    const count=Math.max(2,Math.min(6,Number(document.getElementById("raceSegmentCount")?.value||analysis.segmentCount||3)));
    let boundaries=Array.isArray(analysis.boundaries)?analysis.boundaries.slice():[];
    if(resetEvenly||boundaries.length!==count-1)boundaries=balancedBoundaries(count,total);
    const names=Array.isArray(analysis.segmentNames)?analysis.segmentNames.slice():[];
    const editor=document.getElementById("raceSegmentsEditor");
    if(!editor)return;
    editor.innerHTML=Array.from({length:count},(_,i)=>{
      const end=i===count-1?total:(boundaries[i]||Math.max(1,Math.round(total*(i+1)/count)));
      return `<div class="race-segment-row">
        <div><label>Nombre del tramo ${i+1}</label><input id="raceSegmentName${i}" value="${escapeHtml(names[i]||`Tramo ${i+1}`)}" maxlength="40"></div>
        <div><label>${i===count-1?"Final del tramo":"Termina después del control"}</label>${i===count-1?`<input value="LLEGADA" disabled>`:`<select id="raceSegmentEnd${i}">${Array.from({length:Math.max(0,total-1)},(_,j)=>j+1).map(v=>`<option value="${v}" ${v===end?"selected":""}>Control ${v}</option>`).join("")}</select>`}</div>
      </div>`;
    }).join("");
    const status=document.getElementById("raceSegmentsStatus");
    if(status)status.innerHTML=total?`Todos los recorridos activos se analizarán con <b>${count} tramos</b> sobre <b>${total} controles</b>.`:`Genera recorridos antes de configurar los tramos.`;
  };

  window.distributeRaceSegmentsEvenly=function(){buildRaceSegmentsEditor(true);toast("Tramos distribuidos de forma equilibrada")};

  function readSegmentsEditor(){
    const total=controlsCountForSegments();
    const count=Math.max(2,Math.min(6,Number(document.getElementById("raceSegmentCount")?.value||3)));
    const names=[];const boundaries=[];
    for(let i=0;i<count;i++){
      names.push(String(document.getElementById(`raceSegmentName${i}`)?.value||`Tramo ${i+1}`).trim()||`Tramo ${i+1}`);
      if(i<count-1)boundaries.push(Number(document.getElementById(`raceSegmentEnd${i}`)?.value||0));
    }
    if(!total)throw new Error("Primero genera recorridos válidos");
    if(boundaries.some(v=>!Number.isInteger(v)||v<1||v>=total))throw new Error("Hay finales de tramo fuera del recorrido");
    for(let i=1;i<boundaries.length;i++)if(boundaries[i]<=boundaries[i-1])throw new Error("Los finales de tramo deben avanzar en orden y no pueden repetirse");
    return {segmentCount:count,segmentNames:names,boundaries,totalControls:total,savedAt:new Date().toISOString()};
  }

  window.saveRaceSegmentsConfig=function(){
    try{
      const cfg=readSegmentsEditor();
      const analysis=ensureRaceAnalysisState();
      Object.assign(analysis,cfg);
      saveState();
      const status=document.getElementById("raceSegmentsStatus");if(status){status.className="status ok";status.textContent=`Configuración guardada: ${cfg.segmentCount} tramos para ${cfg.totalControls} controles.`}
      toast("Tramos de carrera guardados");
    }catch(e){const status=document.getElementById("raceSegmentsStatus");if(status){status.className="status err";status.textContent=e.message||String(e)}toast(e.message||"Configuración no válida")}
  };

  function segmentDefinitions(){
    const a=ensureRaceAnalysisState();
    const total=controlsCountForSegments();
    const count=Math.max(2,Math.min(6,Number(a.segmentCount||3)));
    const boundaries=(Array.isArray(a.boundaries)&&a.boundaries.length===count-1?a.boundaries:balancedBoundaries(count,total));
    const ends=[...boundaries,total];let start=0;
    return ends.map((end,i)=>({index:i,name:(a.segmentNames&&a.segmentNames[i])||`Tramo ${i+1}`,startControl:start,endControl:end,isFinal:i===ends.length-1})).map((x,i,arr)=>({...x,startControl:i===0?0:arr[i-1].endControl}));
  }

  window.previewRaceSegmentsForRoutes=function(){
    const box=document.getElementById("raceSegmentsPreview");if(!box)return;
    const routes=(state.routes||[]).filter(r=>!isRouteSkipped(r));
    const defs=segmentDefinitions();
    if(!routes.length){box.innerHTML='<div class="status warn">No hay recorridos activos para mostrar.</div>';return}
    box.innerHTML=routes.slice(0,12).map(r=>{
      const controls=(r.points||[]).filter(id=>id!=="START"&&id!=="FINISH");
      const parts=defs.map(d=>{const start=d.startControl===0?"SALIDA":controls[d.startControl-1]||`Control ${d.startControl}`;const end=d.isFinal?"LLEGADA":controls[d.endControl-1]||`Control ${d.endControl}`;return `<b>${escapeHtml(d.name)}:</b> ${escapeHtml(start)} → ${escapeHtml(end)}`}).join(" · ");
      return `<div class="race-route-preview"><strong>${escapeHtml(r.routeId||r.participantId||"Recorrido")}</strong><br>${parts}</div>`;
    }).join("")+(routes.length>12?`<div class="status warn">Vista previa limitada a 12 de ${routes.length} recorridos.</div>`:"");
  };

  function resultRoute(r){return (state.routes||[]).find(x=>String(x.routeId||"")===String(r.routeId||"")||String(x.participantId||"")===String(r.participantId||""));}
  function correctOrSkippedScanMap(r){const m=new Map();(r.scans||[]).forEach(s=>{const st=String(s.st||s.status||"").toLowerCase();const id=String(s.id||s.controlId||s.expectedControlId||"");if(id&&(st==="correct"||st==="skipped")&&!m.has(id))m.set(id,{...s,status:st,time:s.timestamp||s.time||s.ts||null})});return m}
  function toMs(v){const n=new Date(v).getTime();return Number.isFinite(n)?n:null}
  function discardPenaltyMs(){ensureRaceAnalysisState();return Math.max(0,Number(state.raceAnalysis.discardPenaltyMinutes)||15)*60000}
  window.MILITOPO_GET_DISCARD_PENALTY_MINUTES=function(){ensureRaceAnalysisState();return Math.max(0,Number(state.raceAnalysis.discardPenaltyMinutes)||15)};
  window.saveRaceDiscardPenalty=function(){const el=document.getElementById('raceDiscardPenaltyMinutes');ensureRaceAnalysisState();state.raceAnalysis.discardPenaltyMinutes=Math.max(0,Number(el?.value)||15);saveState();renderRaceAnalysis();toast('Penalización de descartes guardada')};
  function skippedCount(r){return (r.scans||[]).filter(s=>String(s.st||s.status||'').toLowerCase()==='skipped').length}
  function discardedControlIds(r){return [...new Set((r.scans||[]).filter(s=>String(s.st||s.status||'').toLowerCase()==='skipped').map(s=>String(s.id||s.controlId||s.expectedControlId||'').trim()).filter(Boolean))]}
  function pendingControlIds(r){const discarded=new Set(discardedControlIds(r));return [...new Set((Array.isArray(r.missingControls)?r.missingControls:[]).map(x=>String(x||'').trim()).filter(Boolean).filter(id=>!discarded.has(id)))]}
  function penalizedControlsCount(r){return discardedControlIds(r).length+pendingControlIds(r).length}
  function adjustedResultMs(r){const raw=resultMs(r);return Number.isFinite(raw)?raw+penalizedControlsCount(r)*discardPenaltyMs():null}
  function trackPoints(r){const t=Array.isArray(r.track)?r.track:(Array.isArray(r.gpsTrack)?r.gpsTrack:[]);return t.filter(p=>Number.isFinite(Number(p.lat??p.latitude))&&Number.isFinite(Number(p.lng??p.lon??p.longitude)))}
  function haversineM(a,b){const R=6371000,rad=x=>x*Math.PI/180;const lat1=rad(Number(a.lat??a.latitude)),lat2=rad(Number(b.lat??b.latitude));const dlat=lat2-lat1,dlon=rad(Number(b.lng??b.lon??b.longitude)-Number(a.lng??a.lon??a.longitude));const h=Math.sin(dlat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dlon/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(h)))}
  function trackDistanceM(r){const pts=trackPoints(r);let d=0;for(let i=1;i<pts.length;i++){const x=haversineM(pts[i-1],pts[i]);if(Number.isFinite(x)&&x<500)d+=x}return pts.length>1?d:null}
  function routeIdealDistanceM(r){
    const route=resultRoute(r);if(!route)return null;
    const idx=(state.routes||[]).indexOf(route);
    const metric=idx>=0?(state.metrics||[])[idx]:null;
    const km=Number(metric?.distanceKm);
    if(Number.isFinite(km)&&km>0)return km*1000;
    try{const fallback=Number(routeDistanceKm(route));return Number.isFinite(fallback)&&fallback>0?fallback*1000:null}catch(_){return null}
  }
  function routeEfficiencyData(r){
    const real=trackDistanceM(r),ideal=routeIdealDistanceM(r),points=trackPoints(r).length;
    if(!Number.isFinite(real)||!Number.isFinite(ideal)||real<=0||ideal<=0||points<2)return null;
    const percent=ideal/real*100;
    if(!Number.isFinite(percent)||percent<=0)return null;
    return {real,ideal,percent,points};
  }
  function participantLabel(r){const name=resultParticipantName(r)||r.participantId||'--';return String(name)}
  function resultSegmentTimes(r){
    const route=resultRoute(r);if(!route)return [];
    const controls=(route.points||[]).filter(id=>id!=="START"&&id!=="FINISH");
    const scanMap=correctOrSkippedScanMap(r),pendingSet=new Set(pendingControlIds(r)),defs=segmentDefinitions();
    let previous=toMs(r.startTime);if(previous===null)return defs.map(d=>({...d,ms:null,rawMs:null,penaltyMs:0,discarded:0,pending:0,status:"Sin salida"}));
    return defs.map(d=>{
      let endTime=null;
      if(d.isFinal)endTime=toMs(r.finishTime);
      else{
        const boundaryId=controls[d.endControl-1];
        const exact=scanMap.get(boundaryId);endTime=exact?toMs(exact.time):null;
        if(endTime===null){
          for(let pos=d.endControl;pos<controls.length;pos++){
            const later=scanMap.get(controls[pos]);const t=later?toMs(later.time):null;
            if(t!==null){endTime=t;break}
          }
        }
        if(endTime===null)endTime=toMs(r.finishTime);
      }
      const rawMs=endTime!==null&&previous!==null&&endTime>=previous?endTime-previous:null;
      const segmentControls=controls.slice(d.startControl,d.endControl);
      const discarded=segmentControls.reduce((n,id)=>n+(scanMap.get(id)?.status==='skipped'?1:0),0);
      const pending=segmentControls.reduce((n,id)=>n+(pendingSet.has(id)?1:0),0);
      const penalized=discarded+pending,penaltyMs=penalized*discardPenaltyMs();
      const ms=rawMs===null?null:rawMs+penaltyMs;
      if(endTime!==null)previous=endTime;
      const parts=[];
      if(discarded)parts.push(`${discarded} descartado${discarded===1?'':'s'}`);
      if(pending)parts.push(`${pending} pendiente${pending===1?'':'s'}`);
      const status=parts.length?`${parts.join(' · ')} · +${formatDuration(penaltyMs)}`:(rawMs===null?'Incompleto':'Correcto');
      return {...d,ms,rawMs,penaltyMs,discarded,pending,status};
    });
  }
  function formatAnalysisMs(ms){return ms==null?"--":formatDuration(ms)}
  function median(values){const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
  function analysisResults(){return typeof activeImportedResults==="function"?activeImportedResults():(state.importedResults||[])}

  window.openRaceAnalysisTab=function(name){
    document.querySelectorAll('.analysis-tab').forEach(b=>b.classList.toggle('active',b.dataset.analysisTab===name));
    document.querySelectorAll('.analysis-panel').forEach(p=>p.classList.remove('active'));
    const id='analysisPanel'+name.charAt(0).toUpperCase()+name.slice(1);document.getElementById(id)?.classList.add('active');
  };

  function renderAnalysisSummary(){
    const rs=analysisResults();const rawTimes=rs.map(resultMs).filter(Number.isFinite);const completed=rs.filter(r=>r.completed).length;
    const valid=rs.filter(r=>Number.isFinite(adjustedResultMs(r))).sort((a,b)=>adjustedResultMs(a)-adjustedResultMs(b));
    const winner=valid[0]||null,slowest=valid.length?valid[valid.length-1]:null;
    const distances=rs.map(trackDistanceM).filter(Number.isFinite);
    const efficiencyRanking=rs.map(r=>({r,data:routeEfficiencyData(r)})).filter(x=>x.data).sort((a,b)=>b.data.percent-a.data.percent);
    const mostEfficient=efficiencyRanking[0]||null;
    const cards=[
      ['Participantes con resultado',`${rs.length}/${Math.max(rs.length,(state.routes||[]).filter(r=>!r.discarded).length)}`],
      ['Finalizados OK',completed],
      ['🏆 Ganador · menor tiempo',winner?`${participantLabel(winner)} · ${formatAnalysisMs(adjustedResultMs(winner))}`:'--'],
      ['Tiempo medio',rawTimes.length?formatDuration(Math.round(rawTimes.reduce((a,b)=>a+b,0)/rawTimes.length)):'--'],
      ['Tiempo central (mediana)',rawTimes.length?formatDuration(Math.round(median(rawTimes))):'--'],
      ['Distancia real media',distances.length?`${(distances.reduce((a,b)=>a+b,0)/distances.length/1000).toFixed(2)} km`:'Sin tracks'],
      ['🎯 Participante más eficiente',mostEfficient?`${participantLabel(mostEfficient.r)} · ${mostEfficient.data.percent.toFixed(1)} % · ${(mostEfficient.data.ideal/1000).toFixed(2)} / ${(mostEfficient.data.real/1000).toFixed(2)} km`:'Sin tracks'],
      ['Mayor tiempo',slowest?`${participantLabel(slowest)} · ${formatAnalysisMs(adjustedResultMs(slowest))}`:'--'],
      ['Tramos configurados',segmentDefinitions().length]
    ];
    const box=document.getElementById('raceAnalysisSummaryCards');if(box)box.innerHTML=cards.map(([a,b])=>`<div class="analysis-metric-card"><small>${escapeHtml(String(a))}</small><strong>${escapeHtml(String(b))}</strong></div>`).join('');
    const table=document.getElementById('raceAnalysisRanking');if(table)table.innerHTML=valid.length?`<table class="results-table"><thead><tr><th>Puesto</th><th>Participante</th><th>Recorrido</th><th>Tiempo ajustado</th><th>Penalización</th><th>Tiempo real</th><th>Distancia real</th></tr></thead><tbody>${valid.map((r,i)=>{const pen=penalizedControlsCount(r)*discardPenaltyMs(),dist=trackDistanceM(r);return `<tr><td>${i+1}</td><td>${escapeHtml(participantLabel(r))}</td><td>${escapeHtml(r.routeId||'--')}</td><td><b>${formatAnalysisMs(adjustedResultMs(r))}</b></td><td>${pen?'+'+formatDuration(pen):'—'}</td><td>${formatAnalysisMs(resultMs(r))}</td><td>${Number.isFinite(dist)?(dist/1000).toFixed(2)+' km':'--'}</td></tr>`}).join('')}</tbody></table>`:'<div class="status warn">Todavía no hay resultados para analizar.</div>';
  }

  function renderAnalysisSegments(){
    const rs=analysisResults();const defs=segmentDefinitions();const box=document.getElementById('raceAnalysisSegments');const status=document.getElementById('raceAnalysisSegmentsStatus');
    if(!box)return;if(!rs.length){box.innerHTML='';if(status){status.className='status warn';status.textContent='Importa resultados para calcular los tramos.'}return}
    if(status){status.className='status ok';status.textContent=`${defs.length} tramos aplicados por posición a ${rs.length} participante(s).`}
    box.innerHTML=defs.map((d,di)=>{const rows=rs.map(r=>({r,seg:resultSegmentTimes(r)[di]})).sort((a,b)=>(a.seg?.ms??Infinity)-(b.seg?.ms??Infinity));const leader=rows.find(x=>Number.isFinite(x.seg?.ms))?.seg.ms??null;const rangeLabel=`${d.startControl===0?'Salida':'Control '+d.startControl} → ${d.isFinal?'Llegada':'Control '+d.endControl}`;return `<div class="analysis-segment-card"><h3>🧩 ${escapeHtml(d.name)} <small style="display:block;margin-top:4px;font-size:.78em;font-weight:700;opacity:.78">${escapeHtml(rangeLabel)}</small></h3><div class="table-wrap"><table class="results-table"><thead><tr><th>Puesto</th><th>Participante</th><th>Recorrido</th><th>Tiempo ajustado</th><th>Penalización</th><th>Tiempo real</th><th>Diferencia</th><th>Estado</th></tr></thead><tbody>${rows.map((x,i)=>`<tr><td>${Number.isFinite(x.seg?.ms)?i+1:'--'}</td><td>${escapeHtml(resultParticipantName(x.r)||x.r.participantId||'--')}</td><td>${escapeHtml(x.r.routeId||'--')}</td><td><b>${formatAnalysisMs(x.seg?.ms)}</b></td><td>${x.seg?.penaltyMs?'+'+formatDuration(x.seg.penaltyMs):'—'}</td><td>${formatAnalysisMs(x.seg?.rawMs)}</td><td>${Number.isFinite(x.seg?.ms)&&leader!==null?(x.seg.ms===leader?'—':'+'+formatDuration(x.seg.ms-leader)):'--'}</td><td>${escapeHtml(x.seg?.status||'incompleto')}</td></tr>`).join('')}</tbody></table></div></div>`}).join('');
  }

  let analysisSplitSort={index:-1,direction:'asc'};
  window.setAnalysisSplitSort=function(index){
    const idx=Number(index);
    if(analysisSplitSort.index===idx)analysisSplitSort.direction=analysisSplitSort.direction==='asc'?'desc':'asc';
    else analysisSplitSort={index:idx,direction:'asc'};
    renderAnalysisSplits();
  };
  function renderAnalysisSplits(){
    const rs=analysisResults();const box=document.getElementById('raceAnalysisSplits');if(!box)return;
    const max=Math.max(0,...rs.map(r=>{const route=resultRoute(r);return route?(route.points||[]).filter(x=>x!=='START'&&x!=='FINISH').length:0}));
    if(!rs.length||!max){box.innerHTML='<div class="status warn">No hay parciales disponibles.</div>';return}
    const headers=Array.from({length:max+1},(_,i)=>i===max?'Último → Llegada':`${i===0?'Salida':'C'+i} → C${i+1}`);
    const prepared=rs.map(r=>{const route=resultRoute(r);const controls=(route?.points||[]).filter(x=>x!=='START'&&x!=='FINISH');const map=correctOrSkippedScanMap(r),pending=new Set(pendingControlIds(r));let prev=toMs(r.startTime);const vals=controls.map(id=>{const scan=map.get(id);const t=toMs(scan?.time);const raw=t!==null&&prev!==null?t-prev:null;if(t!==null)prev=t;return {raw,skipped:scan?.status==='skipped',pending:pending.has(id)};});const ft=toMs(r.finishTime);vals.push({raw:ft!==null&&prev!==null?ft-prev:null,skipped:false,pending:false});return {r,vals}});
    if(analysisSplitSort.index>=0){const factor=analysisSplitSort.direction==='desc'?-1:1;prepared.sort((a,b)=>{const av=a.vals[analysisSplitSort.index],bv=b.vals[analysisSplitSort.index];const am=av?.raw==null?Infinity:av.raw+((av.skipped||av.pending)?discardPenaltyMs():0),bm=bv?.raw==null?Infinity:bv.raw+((bv.skipped||bv.pending)?discardPenaltyMs():0);return (am-bm)*factor||participantLabel(a.r).localeCompare(participantLabel(b.r),'es',{numeric:true})})}
    const arrow=i=>analysisSplitSort.index===i?(analysisSplitSort.direction==='desc'?'▼':'▲'):'↕';
    box.innerHTML=`<div class="status ok" style="margin-bottom:10px;">Los controles descartados y pendientes se penalizan y suman ${state.raceAnalysis.discardPenaltyMinutes||15} min al tramo correspondiente.</div><table class="results-table"><thead><tr><th><button type="button" class="analysis-sort-th" onclick="setAnalysisSplitSort(-1)">Participante</button></th>${headers.map((h,i)=>`<th><button type="button" class="analysis-sort-th" onclick="setAnalysisSplitSort(${i})">${escapeHtml(h)} <span>${arrow(i)}</span></button></th>`).join('')}</tr></thead><tbody>${prepared.map(({r,vals})=>`<tr><td>${escapeHtml(participantLabel(r))}</td>${headers.map((_,i)=>{const v=vals[i];if(!v||v.raw==null)return '<td>--</td>';return v.skipped?`<td class="analysis-split-skipped">⏭️ Descartado<br><small>+${formatDuration(discardPenaltyMs())}</small></td>`:v.pending?`<td class="analysis-split-skipped">⏳ Pendiente<br><small>+${formatDuration(discardPenaltyMs())}</small></td>`:`<td>${formatAnalysisMs(v.raw)}</td>`}).join('')}</tr>`).join('')}</tbody></table>`;
  }

  const analysisTrackColors=['#e53935','#1565c0','#43a047','#8e24aa','#fb8c00'];
  let analysisTrackMap=null,analysisTrackBase=null,analysisTrackBaseKey='mapant',analysisTrackGroup=null,analysisTrackAnimationGroup=null,analysisSmartInspectionGroup=null,analysisTrackSelected=new Set();
  let analysisSmartFocusedLeg=null;
  const analysisPlayback={mode:'relative',speed:1,currentMs:0,durationMs:0,playing:false,lastFrame:0,raf:0,prepared:[],inspectionEndMs:null};
  function trackTimeMs(v){if(v==null)return null;if(typeof v==='number'&&Number.isFinite(v))return v<1e12?v*1000:v;const n=new Date(v).getTime();return Number.isFinite(n)?n:null}
  function normalizedTrack(r){
    const raw=trackPoints(r),fallbackStart=toMs(r.startTime)||Date.now();
    let previous=fallbackStart;
    return raw.map((p,i)=>{let t=trackTimeMs(p.timestamp??p.time??p.ts??p.recordedAt);if(t===null)t=previous+(i?2000:0);if(t<previous)t=previous;previous=t;return {lat:Number(p.lat??p.latitude),lng:Number(p.lng??p.lon??p.longitude),timestamp:t,accuracy:Number(p.accuracy),heading:Number(p.heading??p.course),speed:Number(p.speed)}}).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lng));
  }
  function analysisTrackLayer(key){if(key==='ign')return L.tileLayer('https://www.ign.es/wmts/mapa-raster?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=MTN&STYLE=default&TILEMATRIXSET=GoogleMapsCompatible&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',{maxNativeZoom:18,maxZoom:22,attribution:'© IGN'});if(key==='pnoa')return L.tileLayer('https://www.ign.es/wmts/pnoa-ma?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=OI.OrthoimageCoverage&STYLE=default&TILEMATRIXSET=GoogleMapsCompatible&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}',{maxNativeZoom:19,maxZoom:22,attribution:'© PNOA'});if(key==='custom'&&orientationGeoTiffRuntime?.ready)return L.imageOverlay(orientationGeoTiffRuntime.url,orientationGeoTiffRuntime.bounds,{opacity:1});return createMapantWmtsLayer({maxZoom:22,maxNativeZoom:19})}
  function ensureAnalysisTrackMap(){const el=document.getElementById('raceAnalysisTrackMap');if(!el||!window.L)return null;if(!analysisTrackMap){analysisTrackMap=L.map(el,{zoomControl:true,maxZoom:22,zoomSnap:.25}).setView([40.4168,-3.7038],7);analysisTrackGroup=L.layerGroup().addTo(analysisTrackMap);analysisTrackAnimationGroup=L.layerGroup().addTo(analysisTrackMap);analysisSmartInspectionGroup=L.layerGroup().addTo(analysisTrackMap);setAnalysisTrackLayer(analysisTrackBaseKey);setTimeout(()=>analysisTrackMap.invalidateSize(),80)}return analysisTrackMap}
  window.setAnalysisTrackLayer=function(key){if(key==='custom'&&!orientationGeoTiffRuntime?.ready){toast('Selecciona o carga primero un plano propio');return}analysisTrackBaseKey=key;const m=ensureAnalysisTrackMap();if(!m)return;if(analysisTrackBase)m.removeLayer(analysisTrackBase);analysisTrackBase=analysisTrackLayer(key);if(analysisTrackBase)analysisTrackBase.addTo(m);[analysisTrackGroup,analysisTrackAnimationGroup,analysisSmartInspectionGroup].forEach(g=>{if(g){m.removeLayer(g);g.addTo(m)}});document.querySelectorAll('[data-track-layer]').forEach(b=>b.classList.toggle('active',b.dataset.trackLayer===key));setTimeout(()=>{m.invalidateSize();if(key==='custom'&&orientationGeoTiffRuntime?.bounds){m.fitBounds(orientationGeoTiffRuntime.bounds,{padding:[24,24],maxZoom:19,animate:true})}},80)};
  function clearAnalysisTrackView(){
    analysisPlayback.prepared=[];analysisPlayback.currentMs=0;analysisPlayback.durationMs=0;analysisPlayback.playing=false;analysisPlayback.lastFrame=0;analysisPlayback.inspectionEndMs=null;
    if(analysisPlayback.raf)cancelAnimationFrame(analysisPlayback.raf);analysisPlayback.raf=0;
    analysisSmartFocusedLeg=null;
    [analysisTrackGroup,analysisTrackAnimationGroup,analysisSmartInspectionGroup].forEach(g=>g&&g.clearLayers());
    const ids=['analysisPlaybackParticipantStatus','analysisPlaybackActiveEvent','analysisPlaybackEvents','analysisPlaybackLegend','analysisSmartTable','analysisLiveLeader'];
    ids.forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=''});
    const status=document.getElementById('analysisSmartInspectionStatus');if(status)status.hidden=true;
    updateAnalysisPlaybackUi();
  }
  window.toggleAnalysisTrack=function(pid,checked){if(checked){if(analysisTrackSelected.size>=5){const el=document.querySelector(`[data-analysis-track-id="${CSS.escape(String(pid))}"]`);if(el)el.checked=false;toast('Puedes comparar un máximo de 5 participantes');return}analysisTrackSelected.add(String(pid))}else analysisTrackSelected.delete(String(pid));const selectionCount=document.getElementById('analysisTrackSelectionCount');if(selectionCount)selectionCount.textContent=analysisTrackSelected.size+' seleccionados';syncSmartAnalysisParticipantOptions();smartAnalysisCache.clear();clearSmartLegInspection(false);if(!analysisTrackSelected.size){clearAnalysisTrackView();renderSmartNavigationAnalysis();renderLiveRaceLeader();return}stopAnalysisPlayback(false);drawAnalysisTracks();prepareAnalysisPlayback();renderSmartNavigationAnalysis();renderLiveRaceLeader();if(checked)setTimeout(()=>fitAnalysisTrackParticipant(pid),140)};
  window.selectAllAnalysisTracks=function(flag){if(!flag)analysisTrackSelected.clear();stopAnalysisPlayback(true);renderAnalysisTracks()};
  window.fitAnalysisTracks=function(){const m=ensureAnalysisTrackMap();if(!m||!analysisTrackGroup)return;const layers=analysisTrackGroup.getLayers();const group=L.featureGroup(layers);if(layers.length){const b=group.getBounds();if(b.isValid())m.fitBounds(b.pad(.08),{maxZoom:18})}};
  function bearingDeg(a,b){const r=x=>x*Math.PI/180,d=x=>x*180/Math.PI,y=Math.sin(r(b.lng-a.lng))*Math.cos(r(b.lat)),x=Math.cos(r(a.lat))*Math.sin(r(b.lat))-Math.sin(r(a.lat))*Math.cos(r(b.lat))*Math.cos(r(b.lng-a.lng));return (d(Math.atan2(y,x))+360)%360}
  function stablePlaybackBearing(points,index){
    if(!Array.isArray(points)||points.length<2)return 0;
    const center=Math.max(0,Math.min(points.length-1,Number(index)||0));
    let a=center,b=Math.min(points.length-1,center+1);
    while(a>0&&haversineM(points[a],points[b])<4)a--;
    while(b<points.length-1&&haversineM(points[a],points[b])<8)b++;
    if(a===b){a=Math.max(0,center-1);b=Math.min(points.length-1,center+1)}
    return bearingDeg(points[a],points[b]);
  }
  function interpolateTrackPoint(points,target){if(!points.length)return null;if(target<=points[0].playMs)return {...points[0],bearing:stablePlaybackBearing(points,0)};if(target>=points[points.length-1].playMs){const n=points.length;return {...points[n-1],bearing:stablePlaybackBearing(points,n-2)};}let lo=0,hi=points.length-1;while(lo+1<hi){const mid=(lo+hi)>>1;if(points[mid].playMs<=target)lo=mid;else hi=mid}const a=points[lo],b=points[hi],span=Math.max(1,b.playMs-a.playMs),f=Math.max(0,Math.min(1,(target-a.playMs)/span));return {lat:a.lat+(b.lat-a.lat)*f,lng:a.lng+(b.lng-a.lng)*f,bearing:stablePlaybackBearing(points,lo),index:lo,f}}
  function playbackIcon(color,label,bearing){const angle=Number.isFinite(Number(bearing))?Number(bearing):0;return L.divIcon({className:'analysis-runner-icon-wrap',html:`<div class="analysis-runner-icon" style="--runner-color:${color};transform:rotate(${angle}deg)"><span>▲</span></div><div class="analysis-runner-name" style="--runner-color:${color};background:${color}">${escapeHtml(label)}</div>`,iconSize:[48,48],iconAnchor:[24,24]})}
  function selectedTrackResults(){return analysisResults().filter(r=>analysisTrackSelected.has(String(r.participantId||''))&&normalizedTrack(r).length>1)}
  function playbackEventTime(v){const n=trackTimeMs(v);return Number.isFinite(n)?n:null}
  function playbackControlPoint(id){const p=(state.points||{})[id];if(!p)return null;const lat=Number(p.lat??p.latitude),lng=Number(p.lng??p.lon??p.longitude);return Number.isFinite(lat)&&Number.isFinite(lng)?{lat,lng}:null}
  function playbackEventsForResult(r,base){const route=resultRoute(r),controls=(route?.points||[]).filter(id=>id!=='START'&&id!=='FINISH'),events=[];const st=playbackEventTime(r.startTime);if(st!==null)events.push({type:'start',id:'SALIDA',timestamp:st,playMs:st-base,status:'start'});(r.scans||[]).forEach(scan=>{const status=String(scan.st||scan.status||'').toLowerCase(),id=String(scan.id||scan.controlId||scan.expectedControlId||'').trim(),t=playbackEventTime(scan.timestamp||scan.time||scan.ts);if(id&&t!==null)events.push({type:'control',id,status,timestamp:t,playMs:t-base,point:(Number.isFinite(Number(scan.lat))&&Number.isFinite(Number(scan.lon??scan.lng))?{lat:Number(scan.lat),lng:Number(scan.lon??scan.lng)}:playbackControlPoint(id))})});const ft=playbackEventTime(r.finishTime);if(ft!==null)events.push({type:'finish',id:'LLEGADA',timestamp:ft,playMs:ft-base,status:'finish'});events.sort((a,b)=>a.playMs-b.playMs);return {events,controls}}
  function prepareAnalysisPlayback(){const rs=selectedTrackResults();const all=rs.map((r,i)=>({r,color:analysisTrackColors[i%analysisTrackColors.length],points:normalizedTrack(r)}));if(!all.length){analysisPlayback.prepared=[];analysisPlayback.durationMs=0;analysisPlayback.currentMs=0;updateAnalysisPlaybackUi();return}
    const globalStart=Math.min(...all.map(x=>x.points[0].timestamp));
    analysisPlayback.prepared=all.map(x=>{const base=analysisPlayback.mode==='relative'?x.points[0].timestamp:globalStart,meta=playbackEventsForResult(x.r,base);return {...x,base,events:meta.events,controls:meta.controls,points:x.points.map(p=>({...p,playMs:p.timestamp-base}))}});
    analysisPlayback.durationMs=Math.max(0,...analysisPlayback.prepared.map(x=>x.points[x.points.length-1].playMs));analysisPlayback.currentMs=Math.min(analysisPlayback.currentMs,analysisPlayback.durationMs);updateAnalysisPlaybackUi();renderPlaybackEventTimeline();drawAnalysisPlaybackFrame();
  }
  function formatPlayback(ms){ms=Math.max(0,Math.round(ms/1000));const h=Math.floor(ms/3600),m=Math.floor((ms%3600)/60),s=ms%60;return h?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}
  function updateAnalysisPlaybackUi(){const range=document.getElementById('analysisPlaybackRange'),cur=document.getElementById('analysisPlaybackCurrent'),tot=document.getElementById('analysisPlaybackTotal'),play=document.getElementById('analysisPlaybackPlay'),legend=document.getElementById('analysisPlaybackLegend');if(range)range.value=analysisPlayback.durationMs?Math.round(analysisPlayback.currentMs/analysisPlayback.durationMs*1000):0;if(cur)cur.textContent=formatPlayback(analysisPlayback.currentMs);if(tot)tot.textContent=formatPlayback(analysisPlayback.durationMs);if(play)play.textContent=analysisPlayback.playing?'⏸':'▶';if(legend)legend.innerHTML=analysisPlayback.prepared.map(x=>`<span><i style="background:${x.color}"></i>${escapeHtml(participantLabel(x.r))}</span>`).join('')}
  function playbackStatusFor(x,now){const passed=(x.events||[]).filter(e=>e.playMs<=now),last=passed[passed.length-1]||null;let completed=new Set(passed.filter(e=>e.type==='control'&&(e.status==='correct'||e.status==='skipped')).map(e=>e.id));let objective=(x.controls||[]).find(id=>!completed.has(id))||'LLEGADA';let stateLabel='Buscando '+objective,icon='🧭';const smart=smartAnalyzeResult(x.r),base=(analysisPlayback.mode==='relative'?(normalizedTrack(x.r)[0]?.timestamp||0):Math.min(...analysisPlayback.prepared.map(y=>y.points[0].timestamp))),absoluteNow=base+now,activeIssue=smart.legs.find(l=>l.severity!=='ok'&&absoluteNow>=l.from.time&&absoluteNow<=l.to.time);if(activeIssue){stateLabel=activeIssue.reason+' · '+activeIssue.from.id+' → '+activeIssue.to.id;icon=activeIssue.severity==='high'?'🔴':'🟠'}if(last&&Math.abs(now-last.playMs)<3500){if(last.type==='start'){stateLabel='Salida registrada';icon='🚩'}else if(last.type==='finish'){stateLabel='Llegada registrada';icon='🏁'}else if(last.status==='correct'){stateLabel='Control '+last.id+' validado';icon='✅'}else if(last.status==='skipped'){stateLabel='Control '+last.id+' descartado';icon='⏭️'}else {stateLabel='Lectura '+last.id+' · '+(last.status||'incidencia');icon='⚠️'}}return {objective,last,stateLabel,icon,completed,activeIssue}}
  function objectiveIcon(color,id,phase){const p=Number.isFinite(phase)?phase:0,scale=(.82+.34*p).toFixed(3),opacity=(1-.72*p).toFixed(3);return L.divIcon({className:'analysis-objective-wrap',html:`<div class="analysis-objective-pulse" style="--objective-color:${color};transform:scale(${scale});opacity:${opacity};animation:none"></div><div class="analysis-objective-core" style="--objective-color:${color}">🎯</div><div class="analysis-objective-label" style="--objective-color:${color};border-color:${color}">${escapeHtml(id)}</div>`,iconSize:[64,64],iconAnchor:[32,32]})}
  function renderPlaybackPanels(statuses){const box=document.getElementById('analysisPlaybackParticipantStatus');if(box){box.classList.toggle('has-items',!!statuses.length);box.innerHTML=statuses.map(z=>`<div class="analysis-live-card" style="--runner-color:${z.x.color};border-color:${z.x.color}"><div class="analysis-live-card-head"><i style="background:${z.x.color}"></i><strong>${escapeHtml(participantLabel(z.x.r))}</strong><span>${escapeHtml(String(z.x.r.routeId||z.x.r.routeCode||'--'))}</span></div><b>${z.st.icon} ${escapeHtml(z.st.stateLabel)}</b><small>🎯 Objetivo: <strong>${escapeHtml(z.st.objective)}</strong></small></div>`).join('')}const active=document.getElementById('analysisPlaybackActiveEvent');if(active){const recent=statuses.map(z=>({z,e:z.st.last})).filter(q=>q.e&&Math.abs(analysisPlayback.currentMs-q.e.playMs)<6500).sort((a,b)=>Math.abs(analysisPlayback.currentMs-a.e.playMs)-Math.abs(analysisPlayback.currentMs-b.e.playMs))[0];active.className='analysis-active-event analysis-active-event-top '+(recent?'show':'');active.innerHTML=recent?`<strong>${recent.z.st.icon} ${escapeHtml(participantLabel(recent.z.x.r))}</strong><span>${escapeHtml(recent.z.st.stateLabel)}</span><small>${escapeHtml(String(recent.z.x.r.routeId||recent.z.x.r.routeCode||''))}</small>`:''}}
  function renderPlaybackEventTimeline(){const box=document.getElementById('analysisPlaybackEvents');if(!box)return;const marks=[];analysisPlayback.prepared.forEach(x=>(x.events||[]).forEach(e=>{if(e.playMs>=0&&e.playMs<=analysisPlayback.durationMs)marks.push({x,e})}));marks.sort((a,b)=>a.e.playMs-b.e.playMs);box.innerHTML=marks.map(({x,e})=>`<button type="button" style="--event-color:${x.color}" onclick="seekAnalysisPlaybackMs(${Math.max(0,Math.round(e.playMs))})" title="${escapeHtml(participantLabel(x.r))} · ${escapeHtml(e.id)}"><span>${e.type==='start'?'🚩':e.type==='finish'?'🏁':e.status==='skipped'?'⏭️':e.status==='correct'?'✅':'⚠️'}</span><b>${escapeHtml(e.id)}</b><small>${formatPlayback(e.playMs)}</small></button>`).join('')}
  window.seekAnalysisPlaybackMs=function(ms){stopAnalysisPlayback(false);analysisPlayback.currentMs=Math.max(0,Math.min(analysisPlayback.durationMs,Number(ms)||0));drawAnalysisPlaybackFrame()};
  function drawAnalysisPlaybackFrame(){const m=ensureAnalysisTrackMap();if(!m||!analysisTrackAnimationGroup)return;analysisTrackAnimationGroup.clearLayers();const statuses=[];analysisPlayback.prepared.forEach(x=>{if(analysisSmartFocusedLeg&&String(x.r.participantId||'')!==String(analysisSmartFocusedLeg.pid))return;const first=x.points[0],last=x.points[x.points.length-1];if(analysisPlayback.currentMs<first.playMs||analysisPlayback.currentMs>last.playMs)return;const p=interpolateTrackPoint(x.points,analysisPlayback.currentMs);if(!p)return;const st=playbackStatusFor(x,analysisPlayback.currentMs);statuses.push({x,st});L.marker([p.lat,p.lng],{icon:playbackIcon(x.color,participantLabel(x.r),p.bearing),zIndexOffset:1000}).addTo(analysisTrackAnimationGroup);if(!analysisSmartFocusedLeg&&st.objective!=='LLEGADA'){const op=playbackControlPoint(st.objective),pulse=((performance.now()%1300)/1300);if(op)L.marker([op.lat,op.lng],{icon:objectiveIcon(x.color,st.objective,pulse),zIndexOffset:900}).addTo(analysisTrackAnimationGroup)}});renderPlaybackPanels(statuses);updateAnalysisPlaybackUi();renderLiveRaceLeader()}
  function playbackLoop(now){if(!analysisPlayback.playing)return;if(!analysisPlayback.lastFrame)analysisPlayback.lastFrame=now;const delta=Math.min(250,now-analysisPlayback.lastFrame);analysisPlayback.lastFrame=now;analysisPlayback.currentMs+=delta*analysisPlayback.speed;
    if(analysisSmartFocusedLeg&&Number.isFinite(analysisPlayback.inspectionEndMs)&&analysisPlayback.currentMs>=analysisPlayback.inspectionEndMs){const next=nextSmartInspectionContext();if(next){renderSmartInspection(next,{setTime:true,fit:true,scrollRow:false});analysisPlayback.playing=true;analysisPlayback.lastFrame=now}else{analysisPlayback.currentMs=analysisPlayback.inspectionEndMs;stopAnalysisPlayback(false);drawAnalysisPlaybackFrame();return}}
    else if(analysisPlayback.currentMs>=analysisPlayback.durationMs){analysisPlayback.currentMs=analysisPlayback.durationMs;stopAnalysisPlayback(false);drawAnalysisPlaybackFrame();return}
    drawAnalysisPlaybackFrame();if(analysisPlayback.playing)analysisPlayback.raf=requestAnimationFrame(playbackLoop)}
  function stopAnalysisPlayback(reset){analysisPlayback.playing=false;analysisPlayback.lastFrame=0;if(analysisPlayback.raf)cancelAnimationFrame(analysisPlayback.raf);analysisPlayback.raf=0;if(reset)analysisPlayback.currentMs=0;drawAnalysisPlaybackFrame()}
  window.toggleAnalysisPlayback=function(){if(!analysisPlayback.prepared.length){toast('Selecciona al menos un participante con track');return}if(analysisSmartFocusedLeg&&Number.isFinite(analysisPlayback.inspectionEndMs)&&analysisPlayback.currentMs>=analysisPlayback.inspectionEndMs){const ctx=smartInspectionContext(analysisSmartFocusedLeg.pid,analysisSmartFocusedLeg.index);if(ctx)analysisPlayback.currentMs=ctx.startMs}else if(analysisPlayback.currentMs>=analysisPlayback.durationMs)analysisPlayback.currentMs=0;analysisPlayback.playing=!analysisPlayback.playing;analysisPlayback.lastFrame=0;updateAnalysisPlaybackUi();if(analysisPlayback.playing)analysisPlayback.raf=requestAnimationFrame(playbackLoop)};
  window.resetAnalysisPlayback=function(){stopAnalysisPlayback(true)};
  window.jumpAnalysisPlayback=function(delta){stopAnalysisPlayback(false);analysisPlayback.currentMs=Math.max(0,Math.min(analysisPlayback.durationMs,analysisPlayback.currentMs+Number(delta||0)));drawAnalysisPlaybackFrame()};
  window.seekAnalysisPlayback=function(value){stopAnalysisPlayback(false);analysisPlayback.currentMs=analysisPlayback.durationMs*Math.max(0,Math.min(1000,Number(value)||0))/1000;drawAnalysisPlaybackFrame()};
  window.setAnalysisPlaybackSpeed=function(value){analysisPlayback.speed=Math.max(.25,Math.min(20,Number(value)||1))};
  window.setAnalysisPlaybackMode=function(value){stopAnalysisPlayback(true);analysisPlayback.mode=value==='real'?'real':'relative';prepareAnalysisPlayback()};
  function analysisEndpointIcon(kind,color,label){const isStart=kind==='start',emoji=isStart?'🚩':'🏁',text=isStart?'SALIDA':'LLEGADA';return L.divIcon({className:'analysis-endpoint-wrap',html:`<div class="analysis-endpoint-marker ${isStart?'start':'finish'}" style="--runner-color:${color}"><span>${emoji}</span><b>${text}</b><small>${escapeHtml(label)}</small></div>`,iconSize:[92,54],iconAnchor:[46,27]})}
  function analysisCollectiveEndpointIcon(kind){const isStart=kind==='start',emoji=isStart?'🚩':'🏁';return L.divIcon({className:'analysis-collective-endpoint-wrap',html:`<div class="analysis-collective-endpoint ${isStart?'start':'finish'}" title="${isStart?'Salida':'Llegada'}"><span>${emoji}</span></div>`,iconSize:[28,28],iconAnchor:[14,14]})}
  function drawAnalysisTracks(){const m=ensureAnalysisTrackMap(),status=document.getElementById('raceAnalysisTrackMapStatus');if(!m||!analysisTrackGroup)return;analysisTrackGroup.clearLayers();const startPt=playbackControlPoint('START'),finishPt=playbackControlPoint('FINISH');if(startPt)L.marker([startPt.lat,startPt.lng],{icon:analysisCollectiveEndpointIcon('start'),interactive:false,zIndexOffset:650}).addTo(analysisTrackGroup);if(finishPt)L.marker([finishPt.lat,finishPt.lng],{icon:analysisCollectiveEndpointIcon('finish'),interactive:false,zIndexOffset:650}).addTo(analysisTrackGroup);const rs=selectedTrackResults();let drawn=0;rs.forEach((r,i)=>{const pts=normalizedTrack(r);if(pts.length<2)return;const color=analysisTrackColors[i%analysisTrackColors.length],latlngs=pts.map(p=>[p.lat,p.lng]);L.polyline(latlngs,{color,weight:4,opacity:.82,lineJoin:'round',lineCap:'round'}).addTo(analysisTrackGroup);(r.scans||[]).forEach(scan=>{const id=String(scan.id||scan.controlId||scan.expectedControlId||'').trim(),st=String(scan.st||scan.status||'').toLowerCase(),actualLat=Number(scan.lat),actualLon=Number(scan.lon??scan.lng),controlPt=playbackControlPoint(id),pt=(st==='skipped'&&Number.isFinite(actualLat)&&Number.isFinite(actualLon))?{lat:actualLat,lng:actualLon}:controlPt;if(!pt)return;const glyph=st==='correct'?'✓':st==='skipped'?'⏭️':'!';const distanceToControl=(st==='skipped'&&controlPt&&Number.isFinite(actualLat)&&Number.isFinite(actualLon))?Math.round(haversineKm(actualLat,actualLon,controlPt.lat,controlPt.lng)*1000):null;L.circleMarker([pt.lat,pt.lng],{radius:st==='skipped'?10:8,color:'#101827',weight:3,fillColor:st==='correct'?color:(st==='skipped'?'#f59e0b':'#dc2626'),fillOpacity:1}).bindTooltip(`${glyph} ${id} · ${participantLabel(r)} · ${st==='correct'?'Correcto':st==='skipped'?('Descartado aquí'+(distanceToControl!==null?' · a '+distanceToControl+' m del control':'')):'Incidencia'}`,{className:'analysis-track-label analysis-track-label-strong',direction:'top',offset:[0,-8]}).addTo(analysisTrackGroup)});drawn++});if(status){status.className='status '+(drawn?'ok':'warn');status.textContent=drawn?`${drawn} track${drawn===1?'':'s'} preparado${drawn===1?'':'s'} para comparar y reproducir.`:'Selecciona participantes con track GPS.'}prepareAnalysisPlayback();setTimeout(()=>m.invalidateSize(),40)}
  function analysisRankingMap(rs){const ordered=[...rs].sort((a,b)=>{const aa=adjustedResultMs(a),bb=adjustedResultMs(b),ar=Number.isFinite(aa)?aa:Infinity,br=Number.isFinite(bb)?bb:Infinity;const art=Math.max(0,(toMs(a.finishTime)||0)-(toMs(a.startTime)||0)),brt=Math.max(0,(toMs(b.finishTime)||0)-(toMs(b.startTime)||0));return (ar-br)||(art-brt)||participantLabel(a).localeCompare(participantLabel(b),'es',{numeric:true})});return new Map(ordered.map((r,i)=>[String(r.participantId||''),i+1]))}
  function fitAnalysisTrackParticipant(pid){const m=ensureAnalysisTrackMap();if(!m)return false;const r=analysisResults().find(x=>String(x.participantId||'')===String(pid||''));const pts=r?normalizedTrack(r):[];if(pts.length<2)return false;const b=L.latLngBounds(pts.map(q=>[q.lat,q.lng]));if(!b.isValid())return false;requestAnimationFrame(()=>setTimeout(()=>{m.invalidateSize();m.fitBounds(b.pad(.14),{padding:[24,24],maxZoom:19,animate:true})},60));return true}
  function renderAnalysisTracks(){const box=document.getElementById('raceAnalysisTracksSummary'),list=document.getElementById('raceAnalysisTrackParticipants');if(!list)return;const rawResults=analysisResults();const rankMap=analysisRankingMap(rawResults);const rs=[...rawResults].sort((a,b)=>{const ra=Number(rankMap.get(String(a.participantId||'')))||999999,rb=Number(rankMap.get(String(b.participantId||'')))||999999;if(ra!==rb)return ra-rb;const ta=adjustedResultMs(a),tb=adjustedResultMs(b);return (Number.isFinite(ta)?ta:Infinity)-(Number.isFinite(tb)?tb:Infinity)});const available=rs.filter(r=>normalizedTrack(r).length>1);for(const id of [...analysisTrackSelected])if(!available.some(r=>String(r.participantId||'')===id))analysisTrackSelected.delete(id);list.innerHTML=rs.map(r=>{const pts=normalizedTrack(r),pid=String(r.participantId||''),dist=trackDistanceM(r),selected=analysisTrackSelected.has(pid),selIndex=[...analysisTrackSelected].indexOf(pid),color=analysisTrackColors[Math.max(0,selIndex)%analysisTrackColors.length],route=String(r.routeId||r.routeCode||r.route||'Sin recorrido'),duration=pts.length>1?pts[pts.length-1].timestamp-pts[0].timestamp:null,rank=rankMap.get(pid)||'--',adjusted=adjustedResultMs(r);return `<label class="analysis-track-choice"><input data-analysis-track-id="${escapeHtml(pid)}" type="checkbox" ${selected?'checked':''} ${pts.length<2?'disabled':''} onchange="toggleAnalysisTrack(decodeURIComponent('${encodeURIComponent(pid)}'),this.checked)"><span class="analysis-track-swatch" style="background:${selected?color:'#777'}"></span><span class="analysis-track-choice-info"><strong><span class="analysis-track-rank">#${rank}</span> · ${escapeHtml(participantLabel(r))}</strong><em>Recorrido: ${escapeHtml(route)}</em><small class="analysis-track-adjusted">Tiempo ajustado: <b>${Number.isFinite(adjusted)?formatAnalysisMs(adjusted):'--'}</b></small><small>Distancia track: ${pts.length&&Number.isFinite(dist)?(dist/1000).toFixed(2)+' km':'--'}</small><small>Duración track: ${Number.isFinite(duration)?formatPlayback(duration):'--'}</small></span></label>`}).join('')||'<div class="status warn">No hay participantes con resultado.</div>';const selectionCount=document.getElementById('analysisTrackSelectionCount');if(selectionCount)selectionCount.textContent=analysisTrackSelected.size+' seleccionados';if(box){box.innerHTML='';box.style.display='none'}ensureAnalysisTrackMap();drawAnalysisTracks()}
  window.MILITOPO_LIVE_ATTACH_TRACK=function(participantId,track,meta={}){try{if(!Array.isArray(track)||track.length<2)return false;ensureImportedResultsStore();const r=(state.importedResults||[]).find(x=>String(x.participantId||'')===String(participantId||''));if(!r)return false;r.track=track;r.gpsTrack=track;r.trackPointCount=Math.max(Number(meta.trackPointCount)||0,track.length);r.trackLiveUpdatedAt=new Date().toISOString();saveState();if(Number(currentAppStep)===7)renderAnalysisTracks();return true}catch(e){console.warn('No se pudo asociar el track en vivo',e);return false}};


  // V37 · Fase 3B: análisis inteligente de navegación
  const smartAnalysisCache=new Map();
  function smartMedian(values){const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2}
  function smartPointAtTime(points,t){if(!points.length)return null;let best=0,bestD=Infinity;for(let i=0;i<points.length;i++){const d=Math.abs(points[i].timestamp-t);if(d<bestD){best=i;bestD=d}else if(points[i].timestamp>t&&d>bestD)break}return best}
  function smartResultEvents(r){
    const route=resultRoute(r),routeControls=(route?.points||[]).filter(id=>id!=='START'&&id!=='FINISH'),scans=(r.scans||[]).filter(s=>{const st=String(s.st||s.status||'').toLowerCase();return st==='correct'||st==='skipped'}).map(s=>({id:String(s.id||s.controlId||s.expectedControlId||'').trim(),status:String(s.st||s.status||'').toLowerCase(),time:playbackEventTime(s.timestamp||s.time||s.ts)})).filter(e=>e.id&&Number.isFinite(e.time));
    const byId=new Map();scans.forEach(e=>{if(!byId.has(e.id))byId.set(e.id,e)});
    const out=[];const st=playbackEventTime(r.startTime);if(Number.isFinite(st))out.push({id:'START',label:'Salida',status:'start',time:st,point:playbackControlPoint('START')});
    routeControls.forEach((id,idx)=>{const e=byId.get(String(id));if(e)out.push({...e,label:'Control '+(idx+1)+' · '+id,point:playbackControlPoint(id),ordinal:idx+1})});
    const ft=playbackEventTime(r.finishTime);if(Number.isFinite(ft))out.push({id:'FINISH',label:'Llegada',status:'finish',time:ft,point:playbackControlPoint('FINISH'),ordinal:routeControls.length+1});
    return out.sort((a,b)=>a.time-b.time)
  }
  function smartAnalyzeResult(r){
    const key=String(r.participantId||'')+'|'+String(r.trackLiveUpdatedAt||r.finishTime||'')+'|'+String((r.scans||[]).length);if(smartAnalysisCache.has(key))return smartAnalysisCache.get(key);
    const pts=normalizedTrack(r),events=smartResultEvents(r),legs=[];if(pts.length<2||events.length<2){const empty={r,legs,totalExtra:0,totalLost:0,totalStopped:0,issues:0,score:null};smartAnalysisCache.set(key,empty);return empty}
    const movingSpeeds=[];for(let i=1;i<pts.length;i++){const dt=(pts[i].timestamp-pts[i-1].timestamp)/1000,d=haversineM(pts[i-1],pts[i]);if(dt>0&&dt<20&&d>2){const v=d/dt;if(v>.4&&v<8)movingSpeeds.push(v)}}
    const baseSpeed=Math.max(.8,Math.min(4.5,smartMedian(movingSpeeds)||1.5));
    for(let i=1;i<events.length;i++){
      const a=events[i-1],b=events[i];if(!a.point||!b.point||b.time<=a.time)continue;let ia=smartPointAtTime(pts,a.time),ib=smartPointAtTime(pts,b.time);if(ia===null||ib===null)continue;if(ib<ia)[ia,ib]=[ib,ia];const seg=pts.slice(ia,ib+1);if(seg.length<2)continue;
      let actual=0,stopped=0;for(let k=1;k<seg.length;k++){const dt=Math.max(0,seg[k].timestamp-seg[k-1].timestamp),d=haversineM(seg[k-1],seg[k]);if(Number.isFinite(d)&&d<500)actual+=d;if(dt<=30000&&d<2.5)stopped+=dt}
      const direct=haversineM(a.point,b.point),extra=Math.max(0,actual-direct),ratio=direct>10?actual/direct:1,duration=b.time-a.time;const lostExtra=extra/baseSpeed*1000,lostStop=Math.max(0,stopped-30000),lost=lostExtra+lostStop;
      let severity='ok',reason='Trazado directo';if(b.status==='skipped'){severity='high';reason='Control descartado'}else if(extra>Math.max(120,direct*.7)||ratio>1.85||stopped>120000){severity='high';reason=stopped>120000?'Parada prolongada / búsqueda':'Desvío importante'}else if(extra>Math.max(50,direct*.3)||ratio>1.35||stopped>60000){severity='medium';reason=stopped>60000?'Búsqueda o parada':'Desvío moderado'}
      const efficiency=actual>0?Math.max(0,Math.min(100,direct/actual*100)):null;legs.push({index:i-1,from:a,to:b,ia,ib,points:seg,actual,direct,extra,ratio,efficiency,duration,stopped,lost,severity,reason,status:b.status});
    }
    const totalExtra=legs.reduce((s,x)=>s+x.extra,0),totalLost=legs.reduce((s,x)=>s+x.lost,0),totalStopped=legs.reduce((s,x)=>s+x.stopped,0),issues=legs.filter(x=>x.severity!=='ok').length;const real=trackDistanceM(r),ideal=routeIdealDistanceM(r),score=(Number.isFinite(real)&&Number.isFinite(ideal)&&real>0)?Math.min(100,ideal/real*100):null;const out={r,pts,events,legs,totalExtra,totalLost,totalStopped,issues,score,baseSpeed};smartAnalysisCache.set(key,out);return out
  }
  function smartLeaderFor(r){const route=String(r.routeId||r.routeCode||r.route||'');return analysisResults().filter(x=>String(x.routeId||x.routeCode||x.route||'')===route&&Number.isFinite(adjustedResultMs(x))).sort((a,b)=>adjustedResultMs(a)-adjustedResultMs(b))[0]||null}
  function smartEventElapsedMap(r){const st=playbackEventTime(r.startTime),m=new Map();if(!Number.isFinite(st))return m;smartResultEvents(r).forEach(e=>{if(e.id!=='START')m.set(e.id,e.time-st)});return m}
  function smartDeltaText(r,event){const mode=document.getElementById('analysisSmartLeaderMode')?.value||'route';if(mode==='none')return '—';const leader=smartLeaderFor(r);if(!leader||String(leader.participantId||'')===String(r.participantId||''))return 'Líder';const mine=smartEventElapsedMap(r).get(event.id),best=smartEventElapsedMap(leader).get(event.id);if(!Number.isFinite(mine)||!Number.isFinite(best))return '—';const d=mine-best;return (d>=0?'+':'−')+formatPlayback(Math.abs(d))}
  function smartSeverityBadge(x){const cls=x.severity,label=x.severity==='high'?'⚠ Revisar':x.severity==='medium'?'△ Atención':'✓ Correcto';return `<span class="analysis-smart-badge ${cls}">${label}</span>`}
  function syncSmartAnalysisParticipantOptions(){
    const sel=document.getElementById('analysisSmartParticipant');if(!sel)return null;
    const selected=selectedTrackResults();const previous=String(sel.value||'');
    sel.innerHTML=selected.map(r=>`<option value="${escapeHtml(String(r.participantId||''))}">${escapeHtml(participantLabel(r))} · ${escapeHtml(String(r.routeId||r.routeCode||r.route||'--'))}</option>`).join('');
    const valid=selected.some(r=>String(r.participantId||'')===previous);if(valid)sel.value=previous;else if(selected[0])sel.value=String(selected[0].participantId||'');
    sel.disabled=!selected.length;return sel.value||null;
  }
  function fitSelectedAnalysisParticipant(pid){
    const m=ensureAnalysisTrackMap();if(!m)return;
    const r=selectedTrackResults().find(x=>String(x.participantId||'')===String(pid||''));
    const pts=r?normalizedTrack(r):[];
    if(pts.length<2)return;
    const b=L.latLngBounds(pts.map(p=>[p.lat,p.lng]));
    if(b.isValid())setTimeout(()=>{m.invalidateSize();m.fitBounds(b.pad(.12),{maxZoom:19,animate:true})},40);
  }
  window.setSmartAnalysisParticipant=function(pid){clearSmartLegInspection(false);const sel=document.getElementById('analysisSmartParticipant');if(sel)sel.value=String(pid||'');renderSmartNavigationAnalysis();setTimeout(()=>{fitSelectedAnalysisParticipant(pid);fitAnalysisTrackParticipant(pid)},120)};
  function smartSelectedAnalyses(){const selected=selectedTrackResults();const pid=syncSmartAnalysisParticipantOptions();const filtered=pid?selected.filter(r=>String(r.participantId||'')===String(pid)):selected.slice(0,1);return filtered.map(smartAnalyzeResult)}
  function smartLegColor(leg){return leg.severity==='high'?'#ef4444':leg.severity==='medium'?'#f59e0b':'#22c55e'}
  function smartInspectionContext(pid,index){
    const a=smartSelectedAnalyses().find(x=>String(x.r.participantId||'')===String(pid));
    const leg=a?.legs.find(x=>x.index===Number(index));
    if(!a||!leg)return null;
    const prepared=analysisPlayback.prepared.find(x=>String(x.r.participantId||'')===String(pid));
    const globalBase=analysisPlayback.mode==='relative'?(normalizedTrack(a.r)[0]?.timestamp||leg.from.time):Math.min(...analysisPlayback.prepared.map(x=>x.points[0].timestamp));
    return {a,leg,prepared,startMs:Math.max(0,leg.from.time-globalBase),endMs:Math.max(0,leg.to.time-globalBase)};
  }
  function nextSmartInspectionContext(){
    if(!analysisSmartFocusedLeg)return null;
    const analyses=smartSelectedAnalyses();
    const ai=analyses.findIndex(x=>String(x.r.participantId||'')===String(analysisSmartFocusedLeg.pid));
    if(ai<0)return null;
    const current=analyses[ai],nextLeg=current.legs.find(x=>x.index>Number(analysisSmartFocusedLeg.index));
    if(nextLeg)return smartInspectionContext(current.r.participantId,nextLeg.index);
    const nextAnalysis=analyses[ai+1];
    return nextAnalysis?.legs?.length?smartInspectionContext(nextAnalysis.r.participantId,nextAnalysis.legs[0].index):null;
  }
  function renderSmartInspection(ctx,{setTime=true,fit=true,scrollRow=true}={}){
    if(!ctx)return false;const {a,leg}=ctx,m=ensureAnalysisTrackMap();if(!m||!analysisSmartInspectionGroup)return false;
    analysisSmartFocusedLeg={pid:String(a.r.participantId||''),index:Number(leg.index)};analysisPlayback.inspectionEndMs=ctx.endMs;
    analysisSmartInspectionGroup.clearLayers();if(analysisTrackGroup&&m.hasLayer(analysisTrackGroup))m.removeLayer(analysisTrackGroup);if(analysisTrackAnimationGroup)analysisTrackAnimationGroup.clearLayers();
    const color=smartLegColor(leg),latlngs=leg.points.map(p=>[p.lat,p.lng]);if(latlngs.length<2)return false;
    L.polyline(latlngs,{color:'#0f172a',weight:11,opacity:.88,lineCap:'round',lineJoin:'round',interactive:false}).addTo(analysisSmartInspectionGroup);
    L.polyline(latlngs,{color,weight:6,opacity:1,lineCap:'round',lineJoin:'round',dashArray:leg.severity==='medium'?'12 7':null}).addTo(analysisSmartInspectionGroup);
    const start=leg.points[0],end=leg.points[leg.points.length-1];
    const endpoint=(label,glyph,bg)=>{const value=label==='START'?'🚩':label==='FINISH'?'🏁':String(label).toUpperCase();const cls=(label==='START'||label==='FINISH')?' is-event':'';return L.divIcon({className:'analysis-smart-endpoint-wrap',html:`<div class="analysis-smart-endpoint${cls}" style="--endpoint-bg:${bg}" title="${escapeHtml(label)}"><span>${escapeHtml(value)}</span></div>`,iconSize:[26,26],iconAnchor:[13,13]})};
    L.marker([start.lat,start.lng],{icon:endpoint(leg.from.id,'●','#1d4ed8'),zIndexOffset:900}).addTo(analysisSmartInspectionGroup);
    L.marker([end.lat,end.lng],{icon:endpoint(leg.to.id,'◎',color),zIndexOffset:910}).addTo(analysisSmartInspectionGroup);
    const mid=leg.points[Math.floor(leg.points.length/2)];
    L.marker([mid.lat,mid.lng],{icon:L.divIcon({className:'analysis-smart-inspection-badge-wrap',html:`<div class="analysis-smart-inspection-badge" style="--inspection-color:${color}"><strong>${escapeHtml(participantLabel(a.r))}</strong><span>${escapeHtml(leg.from.id)} → ${escapeHtml(leg.to.id)}</span><small>${escapeHtml(leg.reason)} · +${Math.round(leg.extra)} m · ${Number.isFinite(leg.efficiency)?leg.efficiency.toFixed(1):'--'} %</small></div>`,iconSize:[190,50],iconAnchor:[95,25]}),zIndexOffset:950}).addTo(analysisSmartInspectionGroup);
    if(fit){const b=L.latLngBounds(latlngs);if(b.isValid())m.fitBounds(b.pad(.22),{maxZoom:19,animate:true})}
    if(setTime)analysisPlayback.currentMs=ctx.startMs;
    document.querySelectorAll('.analysis-smart-table tr').forEach(el=>el.classList.toggle('is-focused',el.dataset.pid===String(a.r.participantId||'')&&Number(el.dataset.legIndex)===Number(leg.index)));
    const row=document.querySelector(`.analysis-smart-table tr[data-pid="${CSS.escape(String(a.r.participantId||''))}"][data-leg-index="${Number(leg.index)}"]`);if(row&&scrollRow)row.scrollIntoView({block:'nearest',behavior:'smooth'});
    const box=document.getElementById('analysisSmartInspectionStatus');if(box){box.hidden=false;box.innerHTML=`<div><b>Inspeccionando ${escapeHtml(participantLabel(a.r))}</b><span>${escapeHtml(leg.from.id)} → ${escapeHtml(leg.to.id)} · ${escapeHtml(leg.reason)}</span></div><button type="button" onclick="clearSmartLegInspection()">Volver a todos los tracks</button>`}
    updateAnalysisPlaybackUi();drawAnalysisPlaybackFrame();return true;
  }
  function clearSmartLegInspection(redraw=true){
    analysisSmartFocusedLeg=null;analysisPlayback.inspectionEndMs=null;
    if(analysisSmartInspectionGroup)analysisSmartInspectionGroup.clearLayers();
    const m=ensureAnalysisTrackMap();
    if(m&&analysisTrackGroup&&!m.hasLayer(analysisTrackGroup))analysisTrackGroup.addTo(m);
    document.querySelectorAll('.analysis-smart-table tr.is-focused').forEach(el=>el.classList.remove('is-focused'));
    const box=document.getElementById('analysisSmartInspectionStatus');if(box)box.hidden=true;
    if(redraw)drawAnalysisPlaybackFrame();
  }
  window.clearSmartLegInspection=function(){clearSmartLegInspection(true);fitAnalysisTracks()};
  window.focusSmartLeg=function(pid,index){
    const ctx=smartInspectionContext(pid,index);if(!ctx)return;
    stopAnalysisPlayback(false);renderSmartInspection(ctx,{setTime:true,fit:true});
  };
  window.renderSmartNavigationAnalysis=function(){
    const table=document.getElementById('analysisSmartTable');if(!table)return;const analyses=smartSelectedAnalyses();if(!analyses.length){table.innerHTML='<div class="status warn">Selecciona participantes para analizar su navegación.</div>';return}
    const rows=[];analyses.forEach((a,participantOrder)=>a.legs.forEach(x=>rows.push({a,x,participantOrder})));rows.sort((u,v)=>(u.participantOrder-v.participantOrder)||(u.x.index-v.x.index));
    table.innerHTML=`<table class="results-table"><thead><tr><th>Participante</th><th>Tramo</th><th>Estado</th><th>Tiempo</th><th>Distancia directa</th><th>Distancia real</th><th>Distancia extra</th><th>Eficiencia</th><th>Parado</th><th>Pérdida estimada</th><th>Contra líder</th></tr></thead><tbody>${rows.map(({a,x})=>`<tr class="smart-severity-${x.severity}" data-pid="${escapeHtml(String(a.r.participantId||''))}" data-leg-index="${x.index}" onclick="focusSmartLeg(decodeURIComponent('${encodeURIComponent(String(a.r.participantId||''))}'),${x.index})"><td>${escapeHtml(participantLabel(a.r))}</td><td><button type="button" class="link-button analysis-smart-focus">${escapeHtml(x.from.id)} → ${escapeHtml(x.to.id)}</button><br><small>${escapeHtml(x.reason)}</small></td><td>${smartSeverityBadge(x)}</td><td>${formatPlayback(x.duration)}</td><td>${Math.round(x.direct)} m</td><td>${Math.round(x.actual)} m</td><td>${Math.round(x.extra)} m</td><td><b>${Number.isFinite(x.efficiency)?x.efficiency.toFixed(1)+' %':'--'}</b></td><td>${formatPlayback(x.stopped)}</td><td><b>${formatPlayback(x.lost)}</b></td><td>${smartDeltaText(a.r,x.to)}</td></tr>`).join('')}</tbody></table>`;
  };

  function liveLeaderPosition(x,now){
    const points=x.points||[],controls=x.controls||[],events=x.events||[];
    if(!points.length)return null;
    const startMs=points[0].playMs||0;
    if(now<startMs)return null;
    const passed=events.filter(e=>e.playMs<=now);
    const controlEvents=passed.filter(e=>e.type==='control'&&(e.status==='correct'||e.status==='skipped'));
    const correct=controlEvents.filter(e=>e.status==='correct').length;
    const skipped=controlEvents.filter(e=>e.status==='skipped').length;
    const finishEvent=events.find(e=>e.type==='finish');
    const finished=!!finishEvent&&finishEvent.playMs<=now;
    const elapsedMs=Math.max(0,Math.min(now,finished?finishEvent.playMs:now)-startMs);
    const pending=Math.max(0,controls.length-correct-skipped);
    // Durante la carrera solo penalizan los descartes ya realizados.
    // Los pendientes se penalizan únicamente cuando el participante ha registrado la llegada.
    const penalizedPending=finished?pending:0;
    const penaltyCount=skipped+penalizedPending;
    const penaltyMs=penaltyCount*discardPenaltyMs();
    const adjustedMs=elapsedMs+penaltyMs;
    const reachedIds=new Set(controlEvents.map(e=>e.id));
    const nextIndex=controls.findIndex(id=>!reachedIds.has(id));
    const targetId=finished?'FINISH':(nextIndex<0?'FINISH':controls[nextIndex]);
    return {x,finished,elapsedMs,adjustedMs,penaltyMs,skipped,pending,penalizedPending,correct,targetId,label:finished?'Finalizado':(targetId==='FINISH'?'Hacia llegada':'Buscando '+targetId)};
  }
  function liveLeaderRows(){
    return (analysisPlayback.prepared||[]).map(x=>liveLeaderPosition(x,analysisPlayback.currentMs)).filter(Boolean).sort((a,b)=>(a.adjustedMs-b.adjustedMs)||(a.elapsedMs-b.elapsedMs)||((a.skipped+a.pending)-(b.skipped+b.pending))||participantLabel(a.x.r).localeCompare(participantLabel(b.x.r),'es',{numeric:true})).slice(0,5);
  }
  window.renderLiveRaceLeader=function(){
    const box=document.getElementById('analysisLiveLeader');if(!box)return;const rows=liveLeaderRows();
    if(!rows.length){box.innerHTML='<div class="status warn">Selecciona participantes y reproduce desde 00:00 para calcular el liderazgo por tiempo ajustado.</div>';return}
    const leader=rows[0];box.innerHTML=`<div class="analysis-live-leader-head"><div><small>LÍDER POR TIEMPO AJUSTADO</small><strong>🥇 ${escapeHtml(participantLabel(leader.x.r))}</strong><span>${escapeHtml(String(leader.x.r.routeId||leader.x.r.routeCode||'--'))} · ${escapeHtml(leader.label)}</span></div><b class="analysis-adjusted-time-main">${formatPlayback(leader.adjustedMs)}</b></div><div class="analysis-live-leader-list">${rows.map((z,i)=>`<div class="analysis-live-leader-row ${i===0?'leader':''}"><b>${i+1}</b><i style="background:${z.x.color}"></i><span><strong>${escapeHtml(participantLabel(z.x.r))}</strong><small>${escapeHtml(z.label)}</small><small class="analysis-leader-counts"><span>⏭ ${z.skipped}</span><span>⏳ ${z.pending}</span></small></span><em class="analysis-adjusted-time">${formatPlayback(z.adjustedMs)}</em></div>`).join('')}</div>`;
  };

  window.renderRaceAnalysis=function(){ensureRaceAnalysisState();renderAnalysisSummary();renderAnalysisSegments();renderAnalysisSplits();renderAnalysisTracks();renderSmartNavigationAnalysis();renderLiveRaceLeader();};

  function archivePayload(){
    ensureRaceAnalysisState();
    return {format:'MILITOPO_RACE_ARCHIVE',version:1,createdAt:new Date().toISOString(),appVersion:'V45_RANKING_ZOOM_LIDERAZGO_Y_RESUMEN_PARTICIPANTE',eventId:state.eventId,eventName:state.eventName,state:JSON.parse(JSON.stringify(state)),analysis:{segments:segmentDefinitions(),generatedAt:new Date().toISOString()}};
  }
  window.downloadMilitopoRaceArchive=async function(){
    try{saveState();const payload=archivePayload();const safe=(state.eventName||state.eventId||'carrera').replace(/[^a-z0-9_-]+/gi,'_');if(typeof JSZip!=='undefined'){const zip=new JSZip();zip.file('carrera.json',JSON.stringify(payload));zip.file('LEER_PRIMERO.txt','Archivo completo de carrera MILITOPO. Ábrelo desde PASO 7 > ARCHIVO.');const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`MILITOPO_CARRERA_${safe}.militopo`;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1500)}else downloadText(`MILITOPO_CARRERA_${safe}.militopo`,JSON.stringify(payload));const st=document.getElementById('raceArchiveStatus');if(st){st.className='status ok';st.textContent='Carrera completa guardada correctamente.'}toast('Archivo completo de carrera guardado')}catch(e){console.error(e);toast('No se pudo guardar la carrera: '+(e.message||e))}
  };
  window.importMilitopoRaceArchive=async function(file){
    if(!file)return;const st=document.getElementById('raceArchiveStatus');try{if(st){st.className='status warn';st.textContent='Abriendo archivo de carrera...'}let text='';const buf=await file.arrayBuffer();const bytes=new Uint8Array(buf);if(bytes[0]===0x50&&bytes[1]===0x4b&&typeof JSZip!=='undefined'){const zip=await JSZip.loadAsync(buf);const entry=zip.file('carrera.json')||Object.values(zip.files).find(x=>x.name.endsWith('.json'));if(!entry)throw new Error('El archivo no contiene carrera.json');text=await entry.async('string')}else text=new TextDecoder().decode(bytes);const payload=JSON.parse(text);if(payload.format!=='MILITOPO_RACE_ARCHIVE'||!payload.state)throw new Error('No es un archivo de carrera MILITOPO válido');if(!confirm(`Se reemplazará el ejercicio abierto por "${payload.eventName||payload.eventId||'Carrera guardada'}". ¿Continuar?`))return;Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,payload.state);ensureRaceAnalysisState();syncConfigToUi();rebuildPointsFromConfig(true);renderPointSelectors();renderPointsTable();renderIofDescriptionsEditor();updateParticipantSelect();updateRouteCountInfo();renderMapMarkers();saveState();buildRaceSegmentsEditor(false);renderResultsControl();renderRaceAnalysis();goStep(7,{silent:true});if(st){st.className='status ok';st.textContent=`Carrera cargada: ${payload.eventName||payload.eventId}`};toast('Carrera completa restaurada')}catch(e){console.error(e);if(st){st.className='status err';st.textContent='No se pudo abrir: '+(e.message||e)}toast('Archivo de carrera no válido')}finally{const input=document.getElementById('militopoRaceArchiveInput');if(input)input.value=''}
  };

  const oldGoStep=goStep;
  goStep=function(n,opts={}){const out=oldGoStep(n,opts);if(Number(currentAppStep)===5){enforceStep5AnalysisFirst();ensureRaceAnalysisState();const sel=document.getElementById('raceSegmentCount');if(sel)sel.value=String(state.raceAnalysis.segmentCount||3);const pen=document.getElementById('raceDiscardPenaltyMinutes');if(pen)pen.value=String(state.raceAnalysis.discardPenaltyMinutes||15);buildRaceSegmentsEditor(false)}if(Number(currentAppStep)===7)renderRaceAnalysis();return out};

  const oldReset=resetStateToFreshEvent;
  resetStateToFreshEvent=function(){const id=oldReset.apply(this,arguments);state.raceAnalysis={version:2,segments:[],segmentCount:3,segmentNames:['Tramo 1','Tramo 2','Tramo 3'],boundaries:[],discardPenaltyMinutes:15,trackSettings:{enabled:true,minSeconds:4,minDistanceM:4,maxAccuracyM:35}};return id};

  function enforceStep5AnalysisFirst(){const step=document.getElementById('step5'),block=document.getElementById('raceSegmentsConfigBlock');if(!step||!block)return;const header=step.querySelector(':scope > .card-header');if(header&&header.nextElementSibling!==block)header.insertAdjacentElement('afterend',block);const live=step.querySelector('.militopo-live2-panel');if(live&&block.nextElementSibling!==live)block.insertAdjacentElement('afterend',live)}

  document.addEventListener('DOMContentLoaded',()=>{enforceStep5AnalysisFirst();const step=document.getElementById('step5');if(step)new MutationObserver(()=>enforceStep5AnalysisFirst()).observe(step,{childList:true});ensureRaceAnalysisState();setTimeout(()=>{enforceStep5AnalysisFirst();const sel=document.getElementById('raceSegmentCount');if(sel)sel.value=String(state.raceAnalysis.segmentCount||3);const pen=document.getElementById('raceDiscardPenaltyMinutes');if(pen)pen.value=String(state.raceAnalysis.discardPenaltyMinutes||15);buildRaceSegmentsEditor(false)},500)});
})();
