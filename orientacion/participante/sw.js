/* MILITOPO Participante · R9O cierre responsive/PWA + clasificación 20261011.
   No usamos skipWaiting automático: una carrera activa nunca debe cambiar de versión a mitad de ejecución. */
const CACHE_NAME="militopo-v2-participante-p02-atomic-gps-20261023";
const APP_SHELL=[
  "./","./index.html","./runner.html","./styles.css","./app.js","./manifest.webmanifest",
  "./runner-r9o-final.css?v=r9o-final-20261011",
  "./runner-mode-switch.css?v=militopo-r4-profile-20261019",
  "../../icons/militopo-192.png?v=r6a1-runner-brand-20261006","../../icons/militopo-512.png?v=r6a1-runner-brand-20261006",
  "./runner-home-v4.js?v=militopo-r4-profile-20261019","./runner-history-v2.js?v=v2-r9m-overzoom-persistente-20261011","./runner-live-loader.js?v=v2-r9n-provisional-classification-20261011","./runner-r9m-responsive.js?v=v2-r9m-runner-responsive-20261011",
  "../../js/v2/firebase-config.js","../../js/v2/bootstrap.js?v=v2-r6b-competicion-one-screen-20261006",
  "../../js/v2/firebase/client.js?v=v2-f3a-runner-homefix2-20260923",
  "../../js/v2/ui/confirm-dialog.js?v=v2-r5e-runner-confirmaciones-20261006",
  "../../js/v2/profile/profile-photo-ui.js?v=v2-r8l-profile-photo-square-20261009",
  "../../js/v2/maps/race-plan-history.js?v=v2-r7e-runner-coherence-20261008",
  "../../js/v2/live/runner-track-v2.js?v=v2-p02-atomic-track-seq-20261023",
  "../../js/v2/live/runner-gps-v2.js?v=v2-p01-gps-track-guard-20261023",
  "../../js/v2/live/runner-resilience-v2.js?v=v2-i4-safe-update-guard-20260928",
  "../../js/v2/live/runner-controls-v2.js?v=v2-r6f-progress-discard-state-20261007",
  "../../js/v2/live/runner-race-v2.js?v=v2-p01-race-track-warning-20261023"
];
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
})());});
self.addEventListener("activate",event=>{event.waitUntil((async()=>{const names=await caches.keys();await Promise.all(names.filter(name=>name.startsWith("militopo-v2-participante-")&&name!==CACHE_NAME).map(name=>caches.delete(name)));await self.clients.claim();})());});
self.addEventListener("fetch",event=>{const req=event.request;if(req.method!=="GET")return;const url=new URL(req.url);if(url.origin!==self.location.origin)return;const isNav=req.mode==="navigate",isCode=/\.(?:js|html|css)$/i.test(url.pathname)||isNav;event.respondWith((async()=>{const cache=await caches.open(CACHE_NAME);if(isCode){try{const response=await fetch(new Request(req,{cache:"no-store"}));if(response&&response.ok)cache.put(req,response.clone()).catch(()=>{});return response;}catch(_){return (await caches.match(req,{ignoreSearch:true}))||(isNav?await caches.match("./index.html"):null)||new Response("",{status:503,statusText:"Offline"});}}const hit=await caches.match(req);if(hit)return hit;try{const response=await fetch(req);if(response&&response.ok)cache.put(req,response.clone()).catch(()=>{});return response;}catch(_){return new Response("",{status:503,statusText:"Offline"});}})());});
