/* MILITOPO V2 · H4 · lector de PLANO CARRERA para vistas históricas.
   Reutiliza la misma biblioteca IndexedDB de Orientación cuando el evento local
   coincide y, si no hay plano disponible en este dispositivo, usa el GeoTIFF
   integrado Valle matizado como plano de prueba/fallback. */
(function(){
  "use strict";
  const DB_NAME="militopo_v2_orientation_maps";
  const STORE="maps";
  const ACTIVE_KEY="__active_map__";
  const FALLBACK_ID="el-valle-matizado";
  const PROBE_KEY="militopo_v2_orientacion_restore_probe_v2";
  let geotiffPromise=null;

  function validBounds(bounds){
    return Array.isArray(bounds)&&bounds.length===2&&bounds.every(pair=>Array.isArray(pair)&&pair.length===2&&pair.every(v=>Number.isFinite(Number(v))));
  }
  function openDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }
  async function dbGet(key){
    const db=await openDb();
    try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readonly"),req=tx.objectStore(STORE).get(key);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)});}finally{db.close();}
  }
  async function dbPut(value,key){
    const db=await openDb();
    try{await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});}finally{db.close();}
  }
  function localEventId(){
    try{const raw=localStorage.getItem(PROBE_KEY);const data=raw?JSON.parse(raw):null;return String(data?.eventId||"").trim();}catch(_){return "";}
  }
  async function activeLocalForEvent(eventId){
    if(!eventId||localEventId()!==String(eventId))return null;
    try{
      const activeId=await dbGet(ACTIVE_KEY);
      if(!activeId)return null;
      const record=await dbGet(activeId);
      if(!record||!record.pngBlob||!validBounds(record.bounds))return null;
      return {id:String(record.id||activeId),name:String(record.name||"Plano carrera"),format:String(record.format||"geotiff"),epsg:record.epsg||null,bounds:record.bounds.map(p=>p.map(Number)),blob:record.pngBlob,builtin:!!record.builtin,fallback:false,eventId:String(eventId),source:"local"};
    }catch(error){console.warn("[MILITOPO H4 race plan] plano local",error);return null;}
  }
  function loadScript(src,test){
    if(test())return Promise.resolve();
    return new Promise((resolve,reject)=>{const existing=[...document.scripts].find(s=>s.src===src);if(existing){const wait=()=>test()?resolve():setTimeout(wait,80);wait();return;}const s=document.createElement("script");s.src=src;s.async=true;s.onload=()=>test()?resolve():reject(new Error("La librería GeoTIFF no quedó disponible"));s.onerror=()=>reject(new Error("No se pudo cargar la librería GeoTIFF"));document.head.appendChild(s);});
  }
  async function ensureGeoTiff(){
    if(globalThis.GeoTIFF)return globalThis.GeoTIFF;
    if(!geotiffPromise)geotiffPromise=loadScript("https://cdn.jsdelivr.net/npm/geotiff@2.1.3/dist-browser/geotiff.min.js",()=>!!globalThis.GeoTIFF).then(()=>globalThis.GeoTIFF);
    return geotiffPromise;
  }
  function epsgOf(image){const g=image.getGeoKeys?image.getGeoKeys():{};return Number(g.ProjectedCSTypeGeoKey||g.GeographicTypeGeoKey||0)||null;}
  function projection(epsg){
    if(!globalThis.proj4)throw new Error("Proj4 no está disponible");
    const code=`EPSG:${epsg}`;if(globalThis.proj4.defs(code))return code;
    const n=Number(epsg);
    if(n>=32601&&n<=32660)globalThis.proj4.defs(code,`+proj=utm +zone=${n-32600} +datum=WGS84 +units=m +no_defs`);
    else if(n>=25801&&n<=25860)globalThis.proj4.defs(code,`+proj=utm +zone=${n-25800} +ellps=GRS80 +units=m +no_defs`);
    else if(n===4326)globalThis.proj4.defs(code,"+proj=longlat +datum=WGS84 +no_defs");
    else throw new Error(`EPSG:${epsg} no reconocido`);
    return code;
  }
  function boundsFromProjected(bbox,epsg){
    const code=projection(epsg),a=globalThis.proj4(code,"EPSG:4326",[bbox[0],bbox[1]]),b=globalThis.proj4(code,"EPSG:4326",[bbox[2],bbox[3]]);
    return [[Math.min(a[1],b[1]),Math.min(a[0],b[0])],[Math.max(a[1],b[1]),Math.max(a[0],b[0])]];
  }
  async function rasterToPng(image,maxDim=4096){
    const sw=image.getWidth(),sh=image.getHeight(),scale=Math.min(1,maxDim/Math.max(sw,sh)),w=Math.max(1,Math.round(sw*scale)),h=Math.max(1,Math.round(sh*scale));
    const rasters=await image.readRasters({interleave:true,width:w,height:h});
    const samples=image.getSamplesPerPixel?image.getSamplesPerPixel():Math.max(1,Math.round(rasters.length/(w*h)));
    const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;const ctx=canvas.getContext("2d"),out=ctx.createImageData(w,h),d=out.data;
    let min=Infinity,max=-Infinity;if(samples===1){for(let i=0;i<rasters.length;i++){const v=Number(rasters[i]);if(Number.isFinite(v)){min=Math.min(min,v);max=Math.max(max,v)}}if(!Number.isFinite(min)||max<=min){min=0;max=255}}
    for(let i=0,p=0;i<w*h;i++,p+=4){if(samples>=3){d[p]=rasters[i*samples]||0;d[p+1]=rasters[i*samples+1]||0;d[p+2]=rasters[i*samples+2]||0;d[p+3]=samples>=4?(rasters[i*samples+3]??255):255}else{const v=Math.max(0,Math.min(255,Math.round(((Number(rasters[i])-min)/(max-min||1))*255)));d[p]=d[p+1]=d[p+2]=v;d[p+3]=255}}
    ctx.putImageData(out,0,0);const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("No se pudo convertir el GeoTIFF")),"image/png"));
    return {blob,width:w,height:h,sourceWidth:sw,sourceHeight:sh};
  }
  async function builtinFallback(eventId){
    const cacheId=`builtin:${FALLBACK_ID}`;
    try{const cached=await dbGet(cacheId);if(cached?.pngBlob&&validBounds(cached.bounds))return {id:cacheId,name:cached.name||"Valle matizado",format:cached.format||"geotiff",epsg:cached.epsg||null,bounds:cached.bounds.map(p=>p.map(Number)),blob:cached.pngBlob,builtin:true,fallback:true,eventId:String(eventId||""),source:"builtin"};}catch(_){ }
    const catalogUrl=new URL("orientacion/maps/index.json",location.href).href;
    const catalogRes=await fetch(catalogUrl,{cache:"no-store"});if(!catalogRes.ok)throw new Error("No se pudo abrir el catálogo de planos");
    const catalog=await catalogRes.json();const meta=(Array.isArray(catalog?.maps)?catalog.maps:[]).find(x=>String(x?.id||"")===FALLBACK_ID);if(!meta)throw new Error("Valle matizado no está en el catálogo");
    const base=new URL("orientacion/",location.href),fileUrl=new URL(String(meta.file||"").replace(/^\.\//,""),base).href;
    const response=await fetch(fileUrl,{cache:"force-cache"});if(!response.ok)throw new Error(`No se pudo descargar Valle matizado (${response.status})`);
    const GeoTIFF=await ensureGeoTiff(),tiff=await GeoTIFF.fromArrayBuffer(await response.arrayBuffer()),image=await tiff.getImage(),bbox=image.getBoundingBox(),epsg=epsgOf(image);
    if(!bbox||bbox.length!==4||!epsg)throw new Error("Valle matizado no contiene georreferenciación legible");
    const bounds=boundsFromProjected(bbox,epsg),png=await rasterToPng(image,4096),record={id:cacheId,name:meta.name||"Valle matizado",format:"geotiff",epsg,bounds,pngBlob:png.blob,width:png.width,height:png.height,sourceWidth:png.sourceWidth,sourceHeight:png.sourceHeight,importedAt:new Date().toISOString(),builtin:true,sourceFile:meta.file};
    try{await dbPut(record,cacheId);}catch(error){console.warn("[MILITOPO H4 race plan] cache",error);}
    return {id:cacheId,name:record.name,format:"geotiff",epsg,bounds,blob:png.blob,builtin:true,fallback:true,eventId:String(eventId||""),source:"builtin"};
  }
  async function getForEvent({eventId}={}){
    const id=String(eventId||"").trim();
    const local=await activeLocalForEvent(id);if(local)return local;
    return builtinFallback(id);
  }
  globalThis.MILITOPO_RACE_PLAN_HISTORY={getForEvent};
})();
