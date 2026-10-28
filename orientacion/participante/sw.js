/* MILITOPO Participante · R9O cierre responsive/PWA + clasificación 20261011.
   No usamos skipWaiting automático: una carrera activa nunca debe cambiar de versión a mitad de ejecución. */
const CACHE_NAME="militopo-v2-participante-p15-firebase-offline-20261028";
const APP_SHELL=[
  // P1.4: imports transitivos exactos; conservar variantes usadas por clientes actuales.
  "../../js/v2/bootstrap.js?v=v2-f3b-recovery-signals-20260924",
  "../../js/v2/bootstrap.js?v=v2-f3b-session-realtimefix-20260923",
  "../../js/v2/bootstrap.js?v=v2-f3a-runner-sessionfix-20260923",
  "../../js/v2/auth/roles.js",

  "./","./index.html","./runner.html","./styles.css","./app.js","./manifest.webmanifest",
  "./runner-r9o-final.css?v=r9o-final-20261011",
  "./runner-mode-switch.css?v=militopo-r4-profile-20261019",
  "../../icons/militopo-192.png?v=r6a1-runner-brand-20261006","../../icons/militopo-512.png?v=r6a1-runner-brand-20261006",
  "./runner-home-v4.js?v=militopo-r4-profile-20261019","./runner-history-v2.js?v=v2-r9m-overzoom-persistente-20261011","./runner-live-loader.js?v=v2-r9n-provisional-classification-20261011","./runner-r9m-responsive.js?v=v2-r9m-runner-responsive-20261011",
  "../../js/v2/firebase-config.js","../../js/v2/firebase-config.js?v=v2-f3a-runner-homefix2-20260923",
  "../../js/v2/bootstrap.js?v=v2-r6b-competicion-one-screen-20261006",
  "../../js/v2/firebase/client.js?v=v2-f3a-runner-homefix2-20260923",
  "../../js/v2/ui/confirm-dialog.js?v=v2-r5e-runner-confirmaciones-20261006",
  "../../js/v2/ui/confirm-dialog.js?v=v2-r6a-carrera-activa-20261006",
  "../../js/v2/profile/profile-photo-ui.js?v=v2-r8l-profile-photo-square-20261009",
  // Dependencias exactas de runner.html para iniciar y reanudar offline.
  "../../js/v2/auth/auth-ui.css?v=v2-r8l-profile-photo-square-20261009",
  "../../js/v2/auth/auth-ui.js?v=v2-r8l-profile-photo-square-20261009",
  "../../js/v2/data/invitation-inbox.js?v=v2-f3a-runner-homefix2-20260923",
  "../../js/v2/live/runner-session-v2.js?v=v2-f3a-runner-homefix2-20260923",
  "../js/live/live-phase2.js?v=v2-f3a-runner-homefix2-20260923",
  "../../js/v2/maps/race-plan-history.js?v=v2-r7e-runner-coherence-20261008",
  "../../js/v2/live/runner-track-v2.js?v=v2-p03-gps-reconciliation-20261023",
  "../../js/v2/live/runner-gps-v2.js?v=v2-p01-gps-track-guard-20261023",
  "../../js/v2/live/runner-resilience-v2.js?v=v2-i4-safe-update-guard-20260928",
  "../../js/v2/live/runner-controls-v2.js?v=v2-r6f-progress-discard-state-20261007",
  "../../js/v2/live/runner-race-v2.js?v=v2-p01-race-track-warning-20261023"
];
/* P1.5: dependencias ESM exactas del corredor. La instalación solo termina
   si también está disponible este grafo del SDK; nunca cachear APIs ni datos.
   Las siete entradas auditadas importan únicamente firebase-app.js entre sí. */
const FIREBASE_SDK_ASSETS=[
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js",
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js",
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js",
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js",
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js",
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js",
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js"
];
const FIREBASE_SDK_URLS=new Set(FIREBASE_SDK_ASSETS);
function usableFirebaseSdk(response){
  return response&&response.status===200&&response.type!=="opaque"&&
    /^(?:text|application)\/(?:x-)?(?:javascript|ecmascript)\b/i.test(response.headers.get("Content-Type")||"");
}
// No instalar actualizaciones nuevas durante una carrera activa, incluso con
// la PWA cerrada: runner-resilience-v2 guarda un lock en Cache Storage.
const UPDATE_GUARD_CACHE="militopo-v2-update-guard";
const UPDATE_GUARD_URL=new URL("./__militopo_active_race_lock__",self.registration.scope).href;
async function activeRaceUpdateLock(){
  try{
    const cache=await caches.open(UPDATE_GUARD_CACHE),res=await cache.match(UPDATE_GUARD_URL);
    if(!res)return null;
    const data=await res.json();
    const fresh=Date.now()-Number(data?.updatedAt||0)<=36*60*60*1000&&Number(data?.updatedAt||0)>0;
    if(fresh&&["racing","started"].includes(String(data?.status||"").toLowerCase())&&data?.eventId&&data?.runId)return data;
    if(!fresh)await cache.delete(UPDATE_GUARD_URL);
  }catch(_){}
  return null;
}
self.addEventListener("install",event=>{event.waitUntil((async()=>{
  const lock=await activeRaceUpdateLock();
  if(lock)throw new Error(`MILITOPO_UPDATE_DEFERRED_ACTIVE_RACE:${lock.eventId}:${lock.runId}`);
  const cache=await caches.open(CACHE_NAME);
  // Si falla un archivo local, conserva el SW anterior en vez de instalar una PWA parcial.
  await Promise.all(APP_SHELL.map(url=>cache.add(new Request(url,{cache:"reload"}))));
  // Si falla el CDN o la respuesta no es JS utilizable, queda el SW anterior.
  await Promise.all(FIREBASE_SDK_ASSETS.map(async url=>{
    const response=await fetch(new Request(url,{mode:"cors",credentials:"omit",cache:"reload",redirect:"error"}));
    if(!usableFirebaseSdk(response))throw new Error("MILITOPO_SDK_PRECACHE_FAILED:"+url);
    await cache.put(url,response);
  }));
})());});
self.addEventListener("activate",event=>{event.waitUntil((async()=>{
  const names=await caches.keys();
  /* El runner guarda rescates offline en militopo-v2-participante-page-...
     Eso NO es una versión del SW y nunca debe eliminarse en una actualización. */
  await Promise.all(names.filter(name=>
    name.startsWith("militopo-v2-participante-")&&
    !name.startsWith("militopo-v2-participante-page-")&&
    name!==CACHE_NAME
  ).map(name=>caches.delete(name)));
  await self.clients.claim();
})());});
/* P1.2 · El código y la shell de una carrera pertenecen a una misma versión.
   Cache-first SOLO en la caché de ESTE SW: jamás usar CacheStorage.match()
   global ni ignorar ?v= para scripts/CSS. Evita mezclar versiones mientras
   una carrera mantiene bloqueada la actualización del Service Worker. */
const PARTICIPANT_URL=new URL("./",self.registration.scope);
const OFFLINE_PAGES=new Set([
  PARTICIPANT_URL.pathname,
  new URL("./index.html",PARTICIPANT_URL).pathname,
  new URL("./runner.html",PARTICIPANT_URL).pathname
]);
function isParticipantCode(req,url){
  return req.mode==="navigate"||/\.(?:js|css|html?)$/i.test(url.pathname);
}
async function getCurrentBuild(cache,req,url){
  /* Un ?event=... o ?c=... no altera la shell HTML. Se consulta su ruta
     conocida, sin la query, manteniendo intacta la URL real del navegador. */
  if(req.mode==="navigate"&&OFFLINE_PAGES.has(url.pathname)){
    const pathname=new URL(url.href);
    pathname.search="";pathname.hash="";
    return (await cache.match(req))||(await cache.match(pathname.href));
  }
  return cache.match(req,{ignoreSearch:false});
}
function offlineResponse(){
  return new Response("<!doctype html><html lang=es><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>MILITOPO sin conexión</title><body style='background:#0e1912;color:#f4edd9;font:16px system-ui;padding:24px'><h1>Sin conexión</h1><p>No se ha podido recuperar esta página de MILITOPO sin Internet. Conserva los datos de la carrera y vuelve a intentarlo cuando haya conexión.</p></body></html>",{
    status:503,headers:{"Content-Type":"text/html;charset=utf-8"}
  });
}
self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET")return;
  const url=new URL(req.url);
  const firebaseSdk=FIREBASE_SDK_URLS.has(url.href);
  if(url.origin!==self.location.origin&&!firebaseSdk)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    if(isParticipantCode(req,url)){
      const current=await getCurrentBuild(cache,req,url);
      if(current)return current;
      try{
        const response=await fetch(new Request(req,firebaseSdk?{cache:"no-store",mode:"cors",credentials:"omit",redirect:"error"}:{cache:"no-store"}));
        if(response&&response.ok&&response.status!==206&&(!firebaseSdk||usableFirebaseSdk(response))){
          // No guardamos URLs de navegación con parámetros de evento/participante.
          if(req.mode!=="navigate"||!url.search){
            event.waitUntil(cache.put(req,response.clone()).catch(()=>{}));
          }
        }
        return response;
      }catch(_){
        return req.mode==="navigate"?offlineResponse():new Response("",{status:503,statusText:"Offline"});
      }
    }
    /* Imágenes y otros recursos: también limitados a ESTA caché.
       No recuperar assets obsoletos de SW raíz, antiguo o de organizador. */
    const hit=await cache.match(req);
    if(hit)return hit;
    try{
      const response=await fetch(req);
      if(response&&response.ok&&response.status!==206){
        event.waitUntil(cache.put(req,response.clone()).catch(()=>{}));
      }
      return response;
    }catch(_){return new Response("",{status:503,statusText:"Offline"});}
  })());
});
