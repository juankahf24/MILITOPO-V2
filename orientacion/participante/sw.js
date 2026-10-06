/* MILITOPO Participante · R5E.3 Rechazo + control previo 20261006.
   No usamos skipWaiting automático: una carrera activa nunca debe cambiar de versión a mitad de ejecución. */
const CACHE_NAME="militopo-v2-participante-r5e3-rechazo-control-previo-20261006";
const APP_SHELL=[
  "./","./index.html","./runner.html","./styles.css","./app.js","./manifest.webmanifest",
  "./icons/participante-192.png","./icons/participante-512.png","./icons/apple-touch-icon.png",
  "./runner-home-v4.js?v=v2-r5e3-rechazo-control-previo-20261006",
  "../assets/r1/militopo-compass-r2k.png?v=r5e2-runner-invitaciones-20261006",
  "../../js/v2/firebase-config.js","../../js/v2/ui/confirm-dialog.js?v=v2-r5e-runner-confirmaciones-20261006","../../js/v2/live/runner-session-v2.js"
];
self.addEventListener("install",event=>{event.waitUntil((async()=>{const cache=await caches.open(CACHE_NAME);await Promise.allSettled(APP_SHELL.map(url=>cache.add(new Request(url,{cache:"reload"}))));})());});
self.addEventListener("activate",event=>{event.waitUntil((async()=>{const names=await caches.keys();await Promise.all(names.filter(name=>name.startsWith("militopo-v2-participante-")&&name!==CACHE_NAME).map(name=>caches.delete(name)));await self.clients.claim();})());});
self.addEventListener("fetch",event=>{const req=event.request;if(req.method!=="GET")return;const url=new URL(req.url);if(url.origin!==self.location.origin)return;const isNav=req.mode==="navigate",isCode=/\.(?:js|html|css)$/i.test(url.pathname)||isNav;event.respondWith((async()=>{const cache=await caches.open(CACHE_NAME);if(isCode){try{const response=await fetch(new Request(req,{cache:"no-store"}));if(response&&response.ok)cache.put(req,response.clone()).catch(()=>{});return response;}catch(_){return (await caches.match(req,{ignoreSearch:true}))||(isNav?await caches.match("./index.html"):null)||new Response("",{status:503,statusText:"Offline"});}}const hit=await caches.match(req);if(hit)return hit;try{const response=await fetch(req);if(response&&response.ok)cache.put(req,response.clone()).catch(()=>{});return response;}catch(_){return new Response("",{status:503,statusText:"Offline"});}})());});
