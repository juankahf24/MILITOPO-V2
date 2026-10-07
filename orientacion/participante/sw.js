/* MILITOPO Participante · R6F carrera focalizada + resumen final fijo 20261007.
   No usamos skipWaiting automático: una carrera activa nunca debe cambiar de versión a mitad de ejecución. */
const CACHE_NAME="militopo-v2-participante-r6f-race-focus-summary-20261007";
const APP_SHELL=[
  "./","./index.html","./runner.html","./styles.css","./app.js","./manifest.webmanifest",
  "../../icons/militopo-192.png?v=r6a1-runner-brand-20261006","../../icons/militopo-512.png?v=r6a1-runner-brand-20261006",
  "./runner-home-v4.js?v=v2-r6f-race-focus-summary-20261007","./runner-live-loader.js?v=v2-r6f-race-focus-summary-20261007",
  "../../js/v2/firebase-config.js","../../js/v2/bootstrap.js?v=v2-r6b-competicion-one-screen-20261006",
  "../../js/v2/firebase/client.js?v=v2-f3a-runner-homefix2-20260923",
  "../../js/v2/ui/confirm-dialog.js?v=v2-r5e-runner-confirmaciones-20261006",
  "../../js/v2/live/runner-track-v2.js?v=v2-g3-recovery-wakelock-20260924",
  "../../js/v2/live/runner-gps-v2.js?v=v2-k3b-gps-resume-20261001",
  "../../js/v2/live/runner-resilience-v2.js?v=v2-i4-safe-update-guard-20260928",
  "../../js/v2/live/runner-controls-v2.js?v=v2-r6f-progress-discard-state-20261007",
  "../../js/v2/live/runner-race-v2.js?v=v2-r6f-race-focus-summary-20261007"
];
self.addEventListener("install",event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE_NAME);await Promise.allSettled(APP_SHELL.map(url=>cache.add(new Request(url,{cache:"reload"}))));})());});
self.addEventListener("activate",event=>{event.waitUntil((async()=>{const names=await caches.keys();await Promise.all(names.filter(name=>name.startsWith("militopo-v2-participante-")&&name!==CACHE_NAME).map(name=>caches.delete(name)));await self.clients.claim();})());});
self.addEventListener("fetch",event=>{const req=event.request;if(req.method!=="GET")return;const url=new URL(req.url);if(url.origin!==self.location.origin)return;const isNav=req.mode==="navigate",isCode=/\.(?:js|html|css)$/i.test(url.pathname)||isNav;event.respondWith((async()=>{const cache=await caches.open(CACHE_NAME);if(isCode){try{const response=await fetch(new Request(req,{cache:"no-store"}));if(response&&response.ok)cache.put(req,response.clone()).catch(()=>{});return response;}catch(_){return (await caches.match(req,{ignoreSearch:true}))||(isNav?await caches.match("./index.html"):null)||new Response("",{status:503,statusText:"Offline"});}}const hit=await caches.match(req);if(hit)return hit;try{const response=await fetch(req);if(response&&response.ok)cache.put(req,response.clone()).catch(()=>{});return response;}catch(_){return new Response("",{status:503,statusText:"Offline"});}})());});
