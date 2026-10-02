/* MILITOPO Orientación · FASE I1 · caché/versionado seguro. */
const BUILD_ID="v2-r2a-loadfix-20261002";
const CACHE_PREFIX="militopo-v2-orientacion--r2a";
const RUNTIME_PREFIX="militopo-v2-orientacion-runtime-";
const MILITOPO_CACHE=`${CACHE_PREFIX}${BUILD_ID}`;
const RUNTIME_CACHE=`${RUNTIME_PREFIX}${BUILD_ID}`;

/* Rutas EXACTAS cargadas por orientacion/index.html y js/app.js. */
const CORE_ASSETS=[
  "./",
  "./index.html",
  "./css/styles.css?v=v2-i6h-paso7-status-dots-20261001",
  "./css/r1-shell.css?v=r2a-loadfix-20261002",
  "./css/r2-map-workspace.css?v=r2a-loadfix-20261002",
  "./js/app.js?v=r2a-loadfix-20261002",
  "./js/ui/r1-shell.js?v=r2a-loadfix-20261002",
  "./js/ui/r2-map-workspace.js?v=r2a-loadfix-20261002",
  "./assets/r1/militopo-compass.png",
  "./js/config/iof-symbols-baked.js?v=v2-r2a-loadfix-20261002",
  "./js/core/app-main.js?v=v2-r2a-loadfix-20261002",
  "./js/pdf/pdf-professional.js?v=v2-r2a-loadfix-20261002",
  "./js/results/results-v16.js?v=v2-r2a-loadfix-20261002",
  "./js/results/results-classification-fix.js?v=v2-r2a-loadfix-20261002",
  "./js/config/plan-assets.js?v=v77-reset-seguro-wakelock-20260919",
  "./js/vendor/qr.js?v=modular-fase2",
  "./maps/index.json",
  "../manifest.webmanifest",
  "../icons/militopo-192.png",
  "../icons/militopo-512.png",
  "../icons/militopo-startup-premium-2048x3072.jpg",
  "../js/v2/firebase-config.js",
  "../js/v2/bootstrap.js",
  "../js/v2/ui/connectivity-status.js?v=v2-j1a-connectivity-no-spam-20261001",
  "../js/v2/firebase/client.js?v=v2-f3a-runner-homefix2-20260923",
  "../js/v2/auth/roles.js",
  "../js/v2/auth/auth-ui.css?v=v2-i5-4-pwa-account-hqlogo-20260929",
  "../js/v2/auth/auth-ui.js?v=v2-i5-4-pwa-account-hqlogo-20260929",
  "../js/v2/auth/organizer-guard.js?v=v2-f3b-runtimefix-20260924",
  "../js/v2/data/invitations.js?v=v2-invites-published-only-20260924",
  "../js/v2/data/participants-admin.js?v=v2-h4-23-route-assignment-20260925",
  "../js/v2/data/events.js?v=v2-f3b-runtimefix-20260924",
  "../js/v2/data/orientation-structure.js?v=v2-f3b-runtimefix-20260924",
  "../js/v2/data/cloud-recovery.js?v=v2-h7-1-history-open-step1-20260926",
  "../js/v2/data/event-lifecycle.js?v=v2-f3b-runtimefix-20260924",
  "../js/v2/data/event-edit-lock.js?v=v2-f3b-runtimefix-20260924",
  "../js/v2/live/realtime-foundation.js?v=v2-f3b-runtimefix-20260924",
  "../js/v2/live/organizer-monitor.js?v=v2-i6b2-history-objective-cache-20260930",
  "../js/v2/live/organizer-live-map.js?v=v2-i6h-paso7-status-dots-20261001",
  "../js/v2/data/event-results.js?v=v2-i6h-paso7-status-dots-20261001"
];

const FIREBASE_SDK_ASSETS=[
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js",
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js",
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js",
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js",
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js",
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js"
];
const REMOTE_ASSETS=[
  ...FIREBASE_SDK_ASSETS,
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  "https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.9.2/proj4.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
  "https://cdn.jsdelivr.net/npm/geotiff@2.1.3/dist-browser/geotiff.min.js",
  "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js"
];
const TRUSTED_RUNTIME_ORIGINS=new Set([
  "https://www.gstatic.com","https://unpkg.com","https://cdnjs.cloudflare.com","https://cdn.jsdelivr.net",
  "https://raster.trailmap.fi","https://www.ign.es","https://tile.openstreetmap.org"
]);

async function cacheRemote(cache,url){
  try{const target=new URL(url),firebase=target.origin==="https://www.gstatic.com";let r;try{r=await fetch(new Request(url,{mode:"cors",cache:"reload"}));}catch(_){if(firebase)return;r=await fetch(new Request(url,{mode:"no-cors",cache:"reload"}));}if(r&&(!firebase||(r.ok&&r.type!=="opaque")))await cache.put(url,r.clone());}catch(_){}
}
async function trimCache(name,max=500){try{const c=await caches.open(name),keys=await c.keys();await Promise.all(keys.slice(0,Math.max(0,keys.length-max)).map(k=>c.delete(k)));}catch(_){}}
async function matchIn(name,req){try{return await (await caches.open(name)).match(req,{ignoreSearch:false});}catch(_){return undefined;}}
function isAppCode(url,req){
  if(req.mode==="navigate")return true;
  if(url.origin!==self.location.origin)return false;
  return /\.(?:js|css|html?)$/i.test(url.pathname)||url.pathname.endsWith("/orientacion/")||url.pathname.endsWith("/MILITOPO-V2/");
}

self.addEventListener("install",event=>{
  /* La página actual no se recarga sola; el SW nuevo queda listo para la siguiente
     navegación, evitando tener que borrar manualmente la caché del navegador. */
  event.waitUntil((async()=>{
    const cache=await caches.open(MILITOPO_CACHE);
    const runtime=await caches.open(RUNTIME_CACHE);
    await cache.addAll(CORE_ASSETS.map(u=>new Request(u,{cache:"reload"})));
    /* I2: Firebase y librerías remotas se precachean en el mismo runtime cache
       que consulta el fetch handler. */
    await Promise.allSettled(REMOTE_ASSETS.map(u=>cacheRemote(runtime,u)));
    /* La versión instalada queda preparada para la siguiente navegación sin
       exigir borrar caché manualmente. No forzamos una recarga de la página. */
    await self.skipWaiting();
  })());
});

self.addEventListener("activate",event=>event.waitUntil((async()=>{
  if(self.registration.navigationPreload)try{await self.registration.navigationPreload.enable();}catch(_){}
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>{
    const oldMain=(k.startsWith(CACHE_PREFIX)||k.startsWith(RUNTIME_PREFIX))&&k!==MILITOPO_CACHE&&k!==RUNTIME_CACHE;
    const oldSnapshot=k.startsWith("militopo-v2-page-snapshot-");
    return oldMain||oldSnapshot;
  }).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));

self.addEventListener("message",event=>{
  const data=event.data||{};
  if(data.type==="MILITOPO_ACTIVATE_UPDATE")self.skipWaiting();
  if(data.type==="MILITOPO_GET_SW_VERSION")event.source?.postMessage?.({type:"MILITOPO_SW_VERSION",buildId:BUILD_ID,scope:"orientacion"});
});

self.addEventListener("fetch",event=>{
  const req=event.request;if(req.method!=="GET")return;
  const url=new URL(req.url);
  const same=url.origin===self.location.origin,isRemote=TRUSTED_RUNTIME_ORIGINS.has(url.origin);
  if(!same&&!isRemote)return;

  event.respondWith((async()=>{
    const cacheName=same?MILITOPO_CACHE:RUNTIME_CACHE;
    const cache=await caches.open(cacheName);
    const isNav=same&&req.mode==="navigate";

    if(same&&isAppCode(url,req)){
      const hit=await matchIn(MILITOPO_CACHE,req);
      if(hit)return hit;
      if(isNav){
        const shell=(await matchIn(MILITOPO_CACHE,new Request("./index.html")))||(await matchIn(MILITOPO_CACHE,new Request("./")));
        if(shell)return shell;
      }
      try{
        const r=await fetch(new Request(req,{cache:"no-store"}));
        if(r&&r.ok&&r.status!==206)await cache.put(req,r.clone());
        return r;
      }catch(_){
        if(isNav)return new Response("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>MILITOPO offline</title><body style='font-family:monospace;background:#10190b;color:#f5e6c8;padding:24px'><h1>MILITOPO sin cobertura</h1><p>La shell de Orientación no está completa en este dispositivo. Conecta una vez para completar la instalación.</p></body>",{headers:{"Content-Type":"text/html;charset=utf-8"}});
        return new Response("",{status:503,statusText:"Offline"});
      }
    }

    const hit=await matchIn(cacheName,req);
    if(hit){event.waitUntil(fetch(req).then(r=>{if(r&&r.status!==206)cache.put(req,r.clone()).catch(()=>{});}).catch(()=>{}));return hit;}
    try{
      const r=await fetch(req);
      if(r&&r.status!==206){cache.put(req,r.clone()).catch(()=>{});if(!same)event.waitUntil(trimCache(RUNTIME_CACHE));}
      return r;
    }catch(_){return new Response("",{status:503,statusText:"Offline"});}
  })());
});
