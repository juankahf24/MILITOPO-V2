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
  let registration = null, requested = false, notice = null, versionLabels = [];
  let currentVersionText = "MILITOPO · versión sin confirmar";
  const localRelease = "F2.25";
  const releaseMatch = /f225-builder-save-search-20261102/i;
  // F2.25: etiqueta temporal de depuración dentro del flujo normal del
  // documento, nunca fixed/sticky. Cada rama tiene su propio contenedor.
  function getVersionHosts() {
    // La vista Premium y el gestor LIVE se abren sobre la interfaz base:
    // cada una debe tener su propia etiqueta DENTRO de su zona desplazable.
    return [
      document.querySelector("body > .app, body > main.runner-home"),
      document.querySelector("body > .container"),
      document.getElementById("orientacionShell"),
      document.querySelector("#militopoPremiumHome .mpp-home-inner"),
      document.getElementById("r1WorkspaceBody")
    ].filter(Boolean);
  }
  function ensureVersionLabels() {
    const hosts = getVersionHosts();
    if (versionLabels.length === hosts.length && versionLabels.every((el, i) => el.parentElement === hosts[i])) return;
    versionLabels.forEach(el => el.remove());
    versionLabels = hosts.map((host, i) => {
      const label = document.createElement("div");
      label.id = i ? `militopo-active-version-${i + 1}` : "militopo-active-version";
      label.setAttribute("role", "status");
      label.setAttribute("aria-label", "Versión activa de MILITOPO (depuración)");
      Object.assign(label.style, {
        position:"static", display:"block", float:"none", clear:"both",
        width:"fit-content", maxWidth:"100%", boxSizing:"border-box",
        margin:"7px 0 11px", background:"rgba(16,30,23,.70)", color:"#cad6c6",
        font:"500 10px system-ui,sans-serif", border:"1px solid rgba(190,204,180,.24)",
        borderRadius:"7px", padding:"4px 8px", pointerEvents:"none"
      });
      // Inmediatamente después del encabezado; participa en el scroll de
      // Organizador, Corredor y Topografía, sin tapar sus botones o mapas.
      const header = Array.from(host.children).find(child => child.tagName === "HEADER" || child.classList.contains("header"));
      if (header) header.insertAdjacentElement("afterend",label);
      else host.insertBefore(label,host.firstElementChild);
      label.textContent = currentVersionText;
      return label;
    });
  }
  function showVersion(value) {
    currentVersionText = value;
    ensureVersionLabels();
    versionLabels.forEach(label => { label.textContent = value; });
  }
  // Organizer Premium y Workspace se crean bajo demanda. Detectar su
  // aparición y re-render sin mantener un elemento flotante encima de ellos.
  let observedWorkspace = null;
  const workspaceObserver = new MutationObserver(() => ensureVersionLabels());
  function watchWorkspace() {
    const body = document.getElementById("r1WorkspaceBody");
    if (body && observedWorkspace !== body) {
      workspaceObserver.disconnect();
      workspaceObserver.observe(body, {childList:true});
      observedWorkspace = body;
    }
  }
  const dynamicHostsObserver = new MutationObserver(() => {
    ensureVersionLabels();
    watchWorkspace();
  });
  dynamicHostsObserver.observe(document.body, {childList:true});
  watchWorkspace();
  function requestActiveVersion() {
    if (!document.body) return;
    const controller = navigator.serviceWorker.controller;
    if (!controller) { showVersion("MILITOPO · versión sin confirmar"); return; }
    showVersion("MILITOPO · comprobando versión…");
    try { controller.postMessage({type:"MILITOPO_GET_SW_VERSION"}); }
    catch (_) { showVersion("MILITOPO · versión sin confirmar"); }
  }
  navigator.serviceWorker.addEventListener("message", event => {
    if (event.data?.type !== "MILITOPO_SW_VERSION") return;
    const buildId = String(event.data.buildId || "");
    showVersion(releaseMatch.test(buildId) ? `MILITOPO ${localRelease} · activa` : "MILITOPO · otra versión activa");
  });
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
    requestActiveVersion();
    if (requested) location.reload();
  });
  window.addEventListener("online", () => { registration?.update().catch(()=>{}); showIfWaiting(); requestActiveVersion(); });
  // Comprobar versiones al volver de otra aplicación, sin reactivar durante la carrera.
  let lastForegroundCheck = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    requestActiveVersion();
    if (!navigator.onLine || Date.now() - lastForegroundCheck < 60000) return;
    lastForegroundCheck = Date.now();
    hasActiveRace().then(active => { if (!active) registration?.update().then(showIfWaiting).catch(()=>{}); });
  });
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register(swPath, {updateViaCache:"none"});
      watch(reg);
      requestActiveVersion();
      await reg.update();
      await showIfWaiting();
      requestActiveVersion();
    } catch (_) { /* La app sigue funcionando con su versión existente. */ }
  });
})();
