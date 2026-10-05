/* MILITOPO Participante · compatibilidad legacy · K1 QA 20261001
   Esta PWA ya no es la interfaz principal del runner V2. Se conserva únicamente
   mientras siga disponible la exportación ZIP del organizador.
   Importante: no usar skipWaiting automático para no sustituir una versión
   mientras una copia legacy pudiera estar ejecutando una carrera. */
const CACHE_NAME="militopo-v2-participante-r5b1-header-history-20261005";
const APP_SHELL=[
  "./","./index.html","./runner.html","./styles.css","./app.js","./manifest.webmanifest",
  "./icons/participante-192.png","./icons/participante-512.png","./icons/apple-touch-icon.png",
  "./runner-home-v4.js?v=v2-r5b1-runner-header-history-20261005",
  "../../js/v2/firebase-config.js","../../js/v2/ui/confirm-dialog.js?v=v2-r5a1-confirmaciones-20261005","../../js/v2/live/runner-session-v2.js"
];

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await Promise.allSettled(APP_SHELL.map(url=>cache.add(new Request(url,{cache:"reload"}))));
  })());
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names
      .filter(name=>name.startsWith("militopo-v2-participante-")&&name!==CACHE_NAME)
      .map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch",event=>{
  const req=event.request;
  if(req.method!=="GET")return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin)return;
  const isNav=req.mode==="navigate";
  const isCode=/\.(?:js|html|css)$/i.test(url.pathname)||isNav;

  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    if(isCode){
      try{
        const response=await fetch(new Request(req,{cache:"no-store"}));
        if(response&&response.ok)cache.put(req,response.clone()).catch(()=>{});
        return response;
      }catch(_){
        return (await caches.match(req,{ignoreSearch:true}))
          || (isNav?await caches.match("./index.html"):null)
          || new Response("",{status:503,statusText:"Offline"});
      }
    }

    const hit=await caches.match(req);
    if(hit)return hit;
    try{
      const response=await fetch(req);
      if(response&&response.ok)cache.put(req,response.clone()).catch(()=>{});
      return response;
    }catch(_){
      return new Response("",{status:503,statusText:"Offline"});
    }
  })());
});
