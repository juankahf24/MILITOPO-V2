/* MILITOPO Orientación · v2-h7-organizer-history-20260926 · H7 histórico global organizador */
const MILITOPO_CACHE="militopo-v2-orientacion-v2-h7-organizer-history-20260926";
const RUNTIME_CACHE="militopo-v2-orientacion-runtime-v2-h7-organizer-history-20260926";
const CORE_ASSETS=["./","./index.html","./js/app.js","./js/app.js?v=v2-h6-2-manual-live-strictgps-progress-reset-20260925","./js/config/iof-symbols-f.js","./js/config/iof-symbols-baked.js","./js/config/plan-assets.js","./js/core/app-main.js","./js/pdf/pdf-professional.js","./js/results/results-v16.js","./js/results/results-classification-fix.js","./css/styles.css","./js/vendor/qr.js","./maps/index.json","./maps/el-valle-matizado.tif","../js/v2/firebase-config.js","../js/v2/bootstrap.js","../js/v2/auth/roles.js","../js/v2/auth/auth-ui.css?v=v2-f3b-runtimefix-20260924","../js/v2/auth/auth-ui.js?v=v2-f3b-runtimefix-20260924","../js/v2/auth/organizer-guard.js?v=v2-f3b-runtimefix-20260924","../js/v2/data/invitations.js?v=v2-g1-gps-live-20260924","../js/v2/data/participants-admin.js?v=v2-h4-23-route-assignment-20260925","../js/v2/data/events.js?v=v2-f3b-runtimefix-20260924","../js/v2/data/orientation-structure.js?v=v2-f3b-runtimefix-20260924","../js/v2/data/cloud-recovery.js?v=v2-h7-organizer-history-20260926","../js/v2/data/event-lifecycle.js?v=v2-f3b-runtimefix-20260924","../js/v2/data/event-edit-lock.js?v=v2-f3b-runtimefix-20260924","../js/v2/live/realtime-foundation.js?v=v2-f3b-runtimefix-20260924","../js/v2/live/organizer-monitor.js?v=v2-h6-2-manual-live-strictgps-progress-reset-20260925","../js/v2/live/organizer-live-map.js?v=v2-g5-live-cartography-20260924","../js/v2/data/event-results.js?v=v2-h6-2-manual-live-strictgps-progress-reset-20260925"];
const REMOTE_ASSETS=["https://unpkg.com/leaflet@1.9.4/dist/leaflet.css","https://unpkg.com/leaflet@1.9.4/dist/leaflet.js","https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png","https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png","https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png","https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.9.2/proj4.js","https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js","https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js","https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js","https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js","https://cdn.jsdelivr.net/npm/geotiff@2.1.3/dist-browser/geotiff.min.js","https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js"];
const TRUSTED_RUNTIME_ORIGINS=new Set(["https://unpkg.com","https://cdnjs.cloudflare.com","https://cdn.jsdelivr.net","https://raster.trailmap.fi","https://www.ign.es","https://tile.openstreetmap.org"]);
async function cacheRemote(c,u){try{let r;try{r=await fetch(new Request(u,{mode:"cors",cache:"reload"}))}catch(_){r=await fetch(new Request(u,{mode:"no-cors",cache:"reload"}))}if(r)await c.put(u,r.clone())}catch(_){}}
async function trimCache(name,max=500){try{const c=await caches.open(name),keys=await c.keys();await Promise.all(keys.slice(0,Math.max(0,keys.length-max)).map(k=>c.delete(k)))}catch(_){}}
self.addEventListener("install",event=>{self.skipWaiting();event.waitUntil((async()=>{const c=await caches.open(MILITOPO_CACHE);await Promise.allSettled(CORE_ASSETS.map(u=>c.add(new Request(u,{cache:"reload"}))));await Promise.allSettled(REMOTE_ASSETS.map(u=>cacheRemote(c,u)))})())});
self.addEventListener("activate",event=>event.waitUntil((async()=>{if(self.registration.navigationPreload)try{await self.registration.navigationPreload.enable()}catch(_){}const keys=await caches.keys();await Promise.all(keys.filter(k=>(k.startsWith("militopo-v2-orientacion-")||k.startsWith("militopo-v2-page-snapshot-"))&&k!==MILITOPO_CACHE&&k!==RUNTIME_CACHE&&k!=="militopo-v2-page-snapshot-v2-h2-organizer-results-20260925").map(k=>caches.delete(k)));await self.clients.claim()})()));
async function cachedIn(cacheName,req){try{return await (await caches.open(cacheName)).match(req,{ignoreSearch:false})}catch(_){return undefined}}
function isAppCode(url,req){
  if(req.mode==="navigate")return true;
  if(url.origin!==self.location.origin)return false;
  return /\.(?:js|css|html?)$/i.test(url.pathname) || url.pathname.endsWith("/orientacion/") || url.pathname.endsWith("/MILITOPO-V2/");
}
self.addEventListener("fetch",event=>{
  const req=event.request;if(req.method!=="GET")return;
  const url=new URL(req.url);
  // No interceptar Firebase ESM: debe conservar CORS/MIME originales de gstatic.
  if(url.origin==="https://www.gstatic.com")return;
  const same=url.origin===self.location.origin,isRemote=TRUSTED_RUNTIME_ORIGINS.has(url.origin);
  if(!same&&!isRemote)return;
  event.respondWith((async()=>{
    const cacheName=same?MILITOPO_CACHE:RUNTIME_CACHE,cache=await caches.open(cacheName),isNav=same&&req.mode==="navigate";
    const hit=await cachedIn(cacheName,req);
    // HTML/JS/CSS propios: red primero para evitar mezclar versiones tras un despliegue.
    if(same&&isAppCode(url,req)){
      try{
        const preload=isNav?await event.preloadResponse:null;
        const r=preload||await fetch(new Request(req,{cache:"no-store"}));
        if(r&&r.ok&&r.status!==206)cache.put(req,r.clone()).catch(()=>{});
        return r;
      }catch(_){
        if(hit)return hit;
        if(isNav)return (await cachedIn(MILITOPO_CACHE,new Request("./index.html")))||(await cachedIn(MILITOPO_CACHE,new Request("./")))||new Response("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>MILITOPO offline</title><body style='font-family:monospace;background:#10190b;color:#f5e6c8;padding:24px'><h1>MILITOPO sin cobertura</h1><p>Los datos guardados siguen disponibles. Vuelve a conectar para actualizar la aplicación.</p></body>",{headers:{"Content-Type":"text/html;charset=utf-8"}});
        return new Response("",{status:503,statusText:"Offline"});
      }
    }
    // Recursos estáticos/remotos: caché actual primero y actualización en segundo plano.
    if(hit){event.waitUntil(fetch(req).then(r=>{if(r&&r.ok&&r.status!==206)cache.put(req,r.clone()).catch(()=>{})}).catch(()=>{}));return hit}
    try{const r=await fetch(req);if(r&&r.status!==206){cache.put(req,r.clone()).catch(()=>{});if(!same)event.waitUntil(trimCache(RUNTIME_CACHE))}return r}catch(_){return new Response("",{status:503,statusText:"Offline"})}
  })());
});
self.addEventListener("message",event=>{
  if(event.data&&event.data.type==="MILITOPO_CLEAR_OLD_CACHES"){
    event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(k=>(k.startsWith("militopo-v2-orientacion-")||k.startsWith("militopo-v2-page-snapshot-"))&&![MILITOPO_CACHE,RUNTIME_CACHE,"militopo-v2-page-snapshot-v2-h2-organizer-results-20260925"].includes(k)).map(k=>caches.delete(k)))})());
  }
});
