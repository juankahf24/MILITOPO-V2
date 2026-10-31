/* MILITOPO F2.11 — aviso de actualización, sin borrado de datos ni takeover automático.
   La primera actualización desde clientes anteriores puede requerir cerrar todas las pestañas
   que aún usen un SW antiguo. Las siguientes muestran este aviso al instalarse una versión. */
(() => {
  "use strict";
  if (!("serviceWorker" in navigator) || !("caches" in window) || !/^https?:$/.test(location.protocol)) return;
  const scriptTag = document.currentScript;
  const swPath = scriptTag?.getAttribute("data-sw") || "./sw.js";
  const guardCache = "militopo-v2-update-guard";
  const guardPaths = ["__militopo_active_race_lock__", "orientacion/participante/__militopo_active_race_lock__"];
  let registration = null, requested = false, notice = null;
  const root = location.pathname.includes("/MILITOPO-V2/")
    ? location.origin + location.pathname.split("/MILITOPO-V2/")[0] + "/MILITOPO-V2/"
    : new URL(swPath,location.href).href.replace(/(?:orientacion\/participante\/|orientacion\/)?sw\.js(?:\?.*)?$/,'');
  async function hasActiveRace() {
    try {
      const cache = await caches.open(guardCache);
      for (const item of guardPaths) {
        const res = await cache.match(new URL(item,root).href);
        if (!res) continue;
        const lock = await res.json();
        const elapsed = Date.now() - Number(lock?.updatedAt || 0);
        if (elapsed >= 0 && elapsed <= 36 * 3600000 &&
            ["racing", "started"].includes(String(lock?.status || "").toLowerCase()) && lock.eventId && lock.runId) return true;
      }
    } catch (_) { return true; } // No arriesgar la sesión si no podemos comprobarlo.
    return false;
  }
  function clearNotice() { notice?.remove(); notice = null; }
  async function showIfWaiting() {
    if (!registration?.waiting || requested || notice || !navigator.onLine || await hasActiveRace()) return;
    notice = document.createElement("aside");
    notice.id = "militopo-version-notice";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-label", "Actualización de MILITOPO disponible");
    Object.assign(notice.style, {position:"fixed",left:"12px",right:"12px",bottom:"calc(14px + env(safe-area-inset-bottom, 0px))",zIndex:"2147483646",maxWidth:"460px",margin:"0 auto",background:"#14241b",color:"#f4f3e9",border:"1px solid #72866c",borderRadius:"14px",boxShadow:"0 8px 32px #0008",padding:"12px",font:"600 13px system-ui,sans-serif",display:"flex",alignItems:"center",gap:"10px"});
    const label = document.createElement("span"); label.textContent = "Nueva versión disponible"; label.style.flex = "1";
    const button = document.createElement("button"); button.type = "button"; button.textContent = "Actualizar";
    Object.assign(button.style, {background:"#eaf1d9",color:"#102015",border:0,borderRadius:"9px",padding:"10px",font:"700 13px system-ui"});
    const later = document.createElement("button"); later.type = "button"; later.textContent = "Ahora no";
    Object.assign(later.style, {background:"transparent",color:"#cbd7c7",border:0,font:"12px system-ui"});
    later.addEventListener("click",clearNotice);
    button.addEventListener("click", async () => {
      button.disabled = true;
      if (await hasActiveRace()) { label.textContent = "Actualización aplazada hasta terminar la carrera"; button.disabled = false; return; }
      const worker = registration?.waiting;
      if (!worker) { clearNotice(); return; }
      requested = true;
      label.textContent = "Activando nueva versión…";
      worker.postMessage({type:"MILITOPO_ACTIVATE_UPDATE"});
    });
    notice.append(label,button,later); document.body.appendChild(notice);
  }
  function watch(reg) {
    if (!reg) return;
    registration = reg;
    showIfWaiting();
    reg.addEventListener("updatefound", () => {
      const installing = reg.installing;
      installing?.addEventListener("statechange", () => { if (installing.state === "installed") showIfWaiting(); });
    });
  }
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (requested) location.reload();
  });
  window.addEventListener("online", () => { registration?.update().catch(()=>{}); showIfWaiting(); });
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register(swPath, {updateViaCache:"none"});
      watch(reg);
      await reg.update();
      await showIfWaiting();
    } catch (_) { /* La app sigue funcionando con su versión existente. */ }
  });
})();
