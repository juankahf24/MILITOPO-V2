/* MILITOPO R3 · selector único de modo. Los permisos nunca dependen del modo elegido. */
(()=>{
  if(globalThis.MILITOPO_ORIENTATION_MODES)return;
  const ROLES=new Set(["organizer","super_admin"]);
  let root=null,lastUid="",auth=null,opened=false;
  const eligible=()=>Boolean(auth?.uid&&auth?.emailVerified&&ROLES.has(String(auth.role||"").toLowerCase()));
  const runnerSvg='<svg class="mor-illustration" viewBox="0 0 160 160" aria-hidden="true" focusable="false"><circle cx="80" cy="80" r="73" fill="#dfeddd"/><circle cx="80" cy="80" r="57" fill="#eff5e8"/><path d="M13 127h134M24 139h84" stroke="#a0b9a0" stroke-width="3" stroke-linecap="round"/><path d="m21 104 27-16 20 8 31-22 37 18" fill="none" stroke="#bdcdb5" stroke-width="2" stroke-dasharray="4 6"/><path d="m38 51 21 1M22 65h30M29 79h19" stroke="#94bda0" stroke-width="4" stroke-linecap="round"/><ellipse cx="88" cy="137" rx="46" ry="6" fill="#b2c9ae" opacity=".55"/><path d="m81 85-19 20-24 14 7 9 28-15 21-20" fill="#d89b6e"/><path d="m85 83 22 14 3 29 12-1-1-37-24-20" fill="#eeb68a"/><path d="m79 72-12 21 13 12 14-17 8 6 10-13-21-17" fill="#233d38"/><path d="m81 42-16 27 13 15 23-15-6-22" fill="#279b74"/><path d="m81 42 13 5 4 16-11 13-9-8" fill="#4cc391"/><path d="m76 47-17 14-13-6" fill="none" stroke="#eeb68a" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="m94 50 12 13 14-5" fill="none" stroke="#eeb68a" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="m78 45-9 7 7 10 10-13M91 46l8 3 6 9-10 7" fill="#198060"/><path d="m86 35-3 10 10 6 5-15" fill="#dc9d70"/><path d="M84 23c3-10 21-10 24 1l-1 13c-2 8-12 12-18 5-4-4-6-11-5-19Z" fill="#f0b98b"/><path d="M83 28c-3-10 5-17 14-16 10 0 15 6 13 16l-8-5-9 1-2 9-7-1Z" fill="#263d32"/><path d="m105 29 5 6-5 2" fill="#dc9d70"/><path d="m38 117 10 9-4 8-19 2c-5 0-6-4-2-7Z" fill="#ed9f49"/><path d="m27 135 21-3" stroke="#fff1cb" stroke-width="4" stroke-linecap="round"/><path d="m109 124 13-1 8 6c5 4 3 8-3 8h-19Z" fill="#ed9f49"/><path d="M109 136h21" stroke="#fff1cb" stroke-width="4" stroke-linecap="round"/><circle cx="131" cy="35" r="12" fill="#174b35"/><path d="m126 35 4 4 6-8" fill="none" stroke="#dfedbe" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const organizerSvg='<svg class="mor-illustration" viewBox="0 0 160 160" aria-hidden="true" focusable="false"><circle cx="80" cy="80" r="73" fill="#254e39"/><circle cx="80" cy="80" r="58" fill="#315c42"/><ellipse cx="82" cy="138" rx="53" ry="6" fill="#0d3023" opacity=".45"/><path d="m25 38 34-9 36 10 35-8v91l-35 9-36-10-34 9Z" fill="#e6edce"/><path d="m25 38 34-9v92l-34 9Z" fill="#c1d5ab"/><path d="m95 39 35-8v91l-35 9Z" fill="#d5e3bc"/><path d="M59 29v92M95 39v92" fill="none" stroke="#91ae83" stroke-width="2"/><path d="m29 61 25-11M30 76l22-9M65 52l24 7M65 102l23 7M102 54l22-7M101 112l23-7" stroke="#a5bd90" stroke-width="2" opacity=".65"/><path d="m37 112 12-25 21 5 12-25 28 6 10-22" fill="none" stroke="#328565" stroke-width="4" stroke-linecap="round" stroke-dasharray="3 7"/><circle cx="48" cy="88" r="5" fill="#f6c66d" stroke="#476c42" stroke-width="2"/><circle cx="81" cy="68" r="5" fill="#f6c66d" stroke="#476c42" stroke-width="2"/><path d="M111 51V29m0 0h21l-5 7 5 7h-21" fill="#e9ab49" stroke="#e9ab49" stroke-width="3" stroke-linejoin="round"/><path d="m30 44 20-6" stroke="#eaf3db" stroke-width="3" stroke-linecap="round"/><circle cx="113" cy="113" r="28" fill="#123b2c" stroke="#d7b66a" stroke-width="3"/><circle cx="113" cy="113" r="21" fill="#eaf0d6"/><path d="m113 93 4 16 11 4-15 5-4-5Z" fill="#d99c3e"/><path d="m113 133-4-16-11-4 15-5 4 5Z" fill="#2b7656"/><circle cx="113" cy="113" r="3" fill="#173e2e"/><path d="M113 88v4M138 113h-4M113 138v-4M88 113h4" stroke="#f0cf7f" stroke-width="2"/><rect x="22" y="17" width="32" height="25" rx="8" fill="#e7bc63"/><path d="m29 29 5 5 12-12" fill="none" stroke="#234a35" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function ensure(){
    if(root?.isConnected)return root;
    root=document.createElement("section");root.id="militopoOrientationModes";root.className="mor-mode-gate";root.hidden=true;
    root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");root.setAttribute("aria-labelledby","morModeHeading");
    root.innerHTML=`<div class="mor-mode-panel">
      <div class="mor-mode-brand"><div class="mor-brand-mark"><img src="../icons/militopo-512.png" alt="" width="64" height="64"><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="m12 3 4 9-4 9-4-9Z" fill="#d9b96a"/><path d="m12 3 4 9h-8Z" fill="#fff3c6"/></svg></span></div><div class="mor-brand-copy"><span class="mor-brand-kicker">MILITOPO <i aria-hidden="true">/</i> ORIENTACIÓN</span><h1 id="morModeHeading">Elige tu experiencia<span aria-hidden="true">.</span></h1><p>Un perfil. Dos formas de vivir cada carrera.</p></div></div>
      <div class="mor-mode-choices" role="group" aria-label="Seleccionar modo">
        <button type="button" class="mor-mode-choice" data-mor-choice="runner"><span class="mor-choice-symbol" aria-hidden="true">${runnerSvg}</span><span class="mor-choice-copy"><small class="mor-choice-kicker">TU PRÓXIMO RETO</small><strong>Correr</strong><span>Mis carreras, GPS, clasificación y rendimiento.</span><span class="mor-choice-tags" aria-hidden="true"><em>GPS</em><em>RESULTADOS</em></span></span><b>ENTRAR COMO CORREDOR <i aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></i></b></button>
        <button type="button" class="mor-mode-choice is-organizer" data-mor-choice="organizer"><span class="mor-choice-symbol" aria-hidden="true">${organizerSvg}</span><span class="mor-choice-copy"><small class="mor-choice-kicker">DE LA IDEA A LA META</small><strong>Organizar</strong><span>Diseñar, gestionar y seguir una carrera paso a paso.</span><span class="mor-choice-tags" aria-hidden="true"><em>RECORRIDOS</em><em>GESTIÓN</em></span></span><b>ABRIR CENTRO DE CARRERAS <i aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></i></b></button>
      </div><p data-mor-error role="status"></p><div class="mor-mode-foot"><span><i aria-hidden="true">✓</i> Una cuenta. Tu actividad siempre contigo.</span><small data-mor-user></small></div>
    </div>`;
    root.addEventListener("click",e=>{const action=e.target.closest("[data-mor-choice]")?.dataset.morChoice;if(action)select(action)});
    document.body.appendChild(root);return root;
  }
  function close(){if(root)root.hidden=true;document.body.classList.remove("mor-choice-open");opened=false}
  function show(){if(!eligible())return false;document.body.classList.add("mor-organizer-shell");ensure();root.querySelector("[data-mor-user]").textContent=auth.displayName||"";
    globalThis.MILITOPO_PREMIUM?.get?.("organizer-home")?.close?.();root.hidden=false;document.body.classList.add("mor-choice-open");opened=true;return true}
  const getHome=()=>globalThis.MILITOPO_PREMIUM?.get?.("organizer-home");
  const directed=()=>new URLSearchParams(location.search).get("militopo_mode")==="organizer";

  async function openOrganizer(signal) {
    const transition=globalThis.MILITOPO_TRANSITION;
    const home=getHome() || await transition?.waitFor(getHome,signal);
    if(!eligible() || !home)throw new Error("No se pudo abrir el Centro de Carreras.");
    try {
      const view=await home.prepare();
      if(signal && transition?.settleView)await transition.settleView(view,signal);
      if(signal?.aborted)throw signal.reason;
      if(!eligible())throw new Error("La sesión ha cambiado.");
      if(directed()){
        const url=new URL(location.href);
        url.searchParams.delete("militopo_mode");
        history.replaceState(history.state,"",url);
      }
      close();
      window.scrollTo({top:0,behavior:"instant"});
      return view;
    } catch(error) {
      if(!signal?.aborted)show();
      throw error;
    }
  }

  function select(mode) {
    if(!eligible())return false;
    const button=root?.querySelector(`[data-mor-choice="${mode}"]`);
    const transition=globalThis.MILITOPO_TRANSITION;
    const status=root?.querySelector("[data-mor-error]");
    if(status)status.textContent="";
    if(mode==="runner"){
      if(transition)void transition.navigate("./participante/", {button}).catch(reportSelectionError);
      else location.assign("./participante/");
      return true;
    }
    if(mode!=="organizer")return false;
    const prepare=async signal=>{
      const view=await openOrganizer(signal);
      transition?.soft(view?.querySelector(".mpp-r3-header"));
      return view;
    };
    if(button && transition?.runInline)void transition.runInline(button,prepare).catch(reportSelectionError);
    else void prepare().catch(reportSelectionError);
    return true;
  }

  function reportSelectionError(error) {
    const status=root?.querySelector("[data-mor-error]");
    if(status)status.textContent=error?.message || "No se pudo abrir la pantalla. Vuelve a intentarlo.";
  }

  function prepareEntry(signal) {
    if(directed())return openOrganizer(signal);
    if(!show())throw new Error("No se pudo abrir el selector de experiencia.");
    root.scrollTop=0;
    return root;
  }

  function onAuth(candidate) {
    auth=candidate||globalThis.MILITOPO_V2_AUTH||null;
    if(!eligible()){close();document.body.classList.remove("mor-organizer-shell");lastUid="";return;}
    document.body.classList.add("mor-organizer-shell");
    if(lastUid===auth.uid)return;
    lastUid=auth.uid;
    // On entry the controller alone opens and awaits the requested screen.
    if(globalThis.MILITOPO_TRANSITION?.isEntering("orientation"))return;
    if(directed())select("organizer");else show();
  }
  globalThis.MILITOPO_ORIENTATION_MODES=Object.freeze({open:show,close,select,prepareEntry,isOpen:()=>opened,canOrganize:eligible});
  addEventListener("militopo:v2-auth-ready",e=>onAuth(e.detail));
  if(globalThis.MILITOPO_V2_AUTH)onAuth(globalThis.MILITOPO_V2_AUTH);
})();
