/* MILITOPO PWA · FASE I1 · caché/versionado seguro.
   Objetivo: una versión activa permanece inmutable mientras está controlando la app.
   Las nuevas versiones se instalan en segundo plano y solo sustituyen a la anterior
   cuando el navegador puede activar el nuevo Service Worker con seguridad. */
const BUILD_ID="v2-i1-2-strict-role-gate-20260927";
const CACHE_PREFIX="militopo-v2-pwa-";
const RUNTIME_PREFIX="militopo-v2-pwa-runtime-";
const CACHE_NAME=`${CACHE_PREFIX}${BUILD_ID}`;
const RUNTIME_CACHE=`${RUNTIME_PREFIX}${BUILD_ID}`;

/* Rutas EXACTAS que carga index.html o sus imports directos. No mezclar queries de otras fases. */
const APP_SHELL=[
  "./",
  "./index.html",
  "./styles.css?v=v2-a1-backend-20260919",
  "./app.js?v=v2-i1-2-role-gate-20260927",
  "./manifest.webmanifest",
  "./icons/militopo-192.png",
  "./icons/militopo-512.png",
  "./icons/militopo-startup-1536.png",
  "./icons/militopo-startup-premium-2048x3072.jpg",
  "./js/v2/firebase-config.js",
  "./js/v2/bootstrap.js",
  "./js/v2/firebase/client.js?v=v2-f3a-runner-homefix2-20260923",
  "./js/v2/auth/roles.js",
  "./js/v2/auth/auth-ui.css?v=v2-g3-recovery-wakelock-20260924",
  "./js/v2/auth/auth-ui.js?v=v2-i1-1-role-routing-20260927",
  "./js/v2/data/invitation-inbox.js?v=v2-h6-2-2-qr-button-hardfix-20260925",
  "./js/v2/maps/race-plan-history.js?v=v2-h4-1-runner-map-parity-20260925",
  "./js/v2/live/runner-dashboard.js?v=v2-i1-2-strict-runner-recovery-20260927",
  "./js/v2/live/runner-track-v2.js?v=v2-g3-recovery-wakelock-20260924",
  "./js/v2/live/runner-gps-v2.js?v=v2-h6-2-2-qr-button-hardfix-20260925",
  "./js/v2/live/runner-resilience-v2.js?v=v2-g3-recovery-wakelock-20260924",
  "./js/v2/live/runner-controls-v2.js?v=v2-h6-9-coordinated-finish-20260926",
  "./js/v2/live/runner-race-v2.js?v=v2-h6-9-coordinated-finish-summary-20260926"
];

/* Librerías externas útiles offline. Son opcionales durante install: si un CDN falla,
   no impedimos instalar la versión local, pero se intentarán cachear de nuevo al usarlas. */
const REMOTE_ASSETS=[
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  "https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.9.0/proj4.js",
  "https://cdn.sheetjs.com/xlsx-0.20.2/package/dist/xlsx.full.min.js",
  "https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js",
  "https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js",
  "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
];
const TRUSTED_RUNTIME_ORIGINS=new Set([
  "https://unpkg.com","https://cdnjs.cloudflare.com","https://cdn.sheetjs.com","https://cdn.jsdelivr.net",
  "https://tile.openstreetmap.org","https://www.ign.es","https://mapant.es","https://raster.trailmap.fi"
]);

async function cacheRemote(cache,url){
  try{
    let r;
    try{r=await fetch(new Request(url,{mode:"cors",cache:"reload"}));}
    catch(_){r=await fetch(new Request(url,{mode:"no-cors",cache:"reload"}));}
    if(r)await cache.put(url,r.clone());
  }catch(_){}
}
async function trimCache(name,max=450){
  try{const c=await caches.open(name),keys=await c.keys();await Promise.all(keys.slice(0,Math.max(0,keys.length-max)).map(k=>c.delete(k)));}catch(_){}
}
async function matchIn(name,req){try{return await (await caches.open(name)).match(req,{ignoreSearch:false});}catch(_){return undefined;}}
function isAppCode(url,req){
  if(req.mode==="navigate")return true;
  if(url.origin!==self.location.origin)return false;
  return /\.(?:js|css|html?)$/i.test(url.pathname)||url.pathname.endsWith("/MILITOPO-V2/");
}

self.addEventListener("install",event=>{
  /* NO skipWaiting(): una versión nueva no puede tomar el control en mitad de una carrera. */
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    /* El núcleo local sí es obligatorio. Si falta un archivo, no activamos una shell incompleta. */
    await cache.addAll(APP_SHELL.map(u=>new Request(u,{cache:"reload"})));
    await Promise.allSettled(REMOTE_ASSETS.map(u=>cacheRemote(cache,u)));
  })());
});

self.addEventListener("activate",event=>event.waitUntil((async()=>{
  if(self.registration.navigationPreload)try{await self.registration.navigationPreload.enable();}catch(_){}
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>(k.startsWith(CACHE_PREFIX)||k.startsWith(RUNTIME_PREFIX))&&k!==CACHE_NAME&&k!==RUNTIME_CACHE).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));

/* Activación manual reservada para una fase posterior/UI de actualización segura. */
self.addEventListener("message",event=>{
  const data=event.data||{};
  if(data.type==="MILITOPO_ACTIVATE_UPDATE")self.skipWaiting();
  if(data.type==="MILITOPO_GET_SW_VERSION")event.source?.postMessage?.({type:"MILITOPO_SW_VERSION",buildId:BUILD_ID,scope:"root"});
});

self.addEventListener("fetch",event=>{
  const req=event.request;if(req.method!=="GET")return;
  const url=new URL(req.url);
  /* Firebase SDK se resolverá en I2. No cachear aquí respuestas ESM opacas/incompletas. */
  if(url.origin==="https://www.gstatic.com")return;
  const same=url.origin===self.location.origin,isRemote=TRUSTED_RUNTIME_ORIGINS.has(url.origin);
  if(!same&&!isRemote)return;

  event.respondWith((async()=>{
    const cacheName=same?CACHE_NAME:RUNTIME_CACHE;
    const cache=await caches.open(cacheName);
    const isNav=same&&req.mode==="navigate";

    /* I1: el código de una versión activa es INMUTABLE. Cache-first sin revalidar.
       La siguiente versión vive en otro cache y no se mezcla con esta. */
    if(same&&isAppCode(url,req)){
      const hit=await matchIn(CACHE_NAME,req);
      if(hit)return hit;
      if(isNav){
        const shell=(await matchIn(CACHE_NAME,new Request("./index.html")))||(await matchIn(CACHE_NAME,new Request("./")));
        if(shell)return shell;
      }
      try{
        const r=await fetch(new Request(req,{cache:"no-store"}));
        if(r&&r.ok&&r.status!==206)await cache.put(req,r.clone());
        return r;
      }catch(_){
        if(isNav)return new Response("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>MILITOPO offline</title><body style='background:#0a0e0a;color:#f5e6c8;font-family:monospace;padding:24px'><h1>MILITOPO sin cobertura</h1><p>La aplicación no pudo cargar su shell local. Vuelve a conectar una vez para completar la instalación offline.</p></body>",{headers:{"Content-Type":"text/html;charset=utf-8"}});
        return new Response("",{status:503,statusText:"Offline"});
      }
    }

    /* Assets no ejecutables y recursos remotos: cache-first + refresco no bloqueante. */
    const hit=await matchIn(cacheName,req);
    if(hit){
      event.waitUntil(fetch(req).then(r=>{if(r&&r.status!==206)cache.put(req,r.clone()).catch(()=>{});}).catch(()=>{}));
      return hit;
    }
    try{
      const r=await fetch(req);
      if(r&&r.status!==206){cache.put(req,r.clone()).catch(()=>{});if(!same)event.waitUntil(trimCache(RUNTIME_CACHE));}
      return r;
    }catch(_){return new Response("",{status:503,statusText:"Offline"});}
  })());
});
