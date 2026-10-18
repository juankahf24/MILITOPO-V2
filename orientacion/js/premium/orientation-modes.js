/* MILITOPO R3 · selector único de modo. Los permisos nunca dependen del modo elegido. */
(()=>{
  if(globalThis.MILITOPO_ORIENTATION_MODES)return;
  const ROLES=new Set(["organizer","super_admin"]);
  let root=null,lastUid="",auth=null,opened=false;
  const eligible=()=>Boolean(auth?.uid&&auth?.emailVerified&&ROLES.has(String(auth.role||"").toLowerCase()));
  const runnerSvg='<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="42" cy="9" r="5.5" fill="currentColor" stroke="none"/><path d="M29 18 40 22l8 10M40 22 31 35 21 39M31 35l8 10-2 13M31 35 20 29l-10 8M18 57l13-22"/></svg>';
  const organizerSvg='<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 13 24 8l16 5 16-5v42l-16 5-16-5-16 5zM24 8v42m16-37v42"/><circle cx="31" cy="26" r="5"/><path d="M31 31v7m-10 2 3-4 5 4 5-6 8 5"/></svg>';
  function ensure(){
    if(root?.isConnected)return root;
    root=document.createElement("section");root.id="militopoOrientationModes";root.className="mor-mode-gate";root.hidden=true;
    root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");root.setAttribute("aria-labelledby","morModeHeading");
    root.innerHTML=`<div class="mor-mode-panel">
      <div class="mor-mode-brand"><img src="../icons/militopo-512.png" alt="" width="70" height="70"><div><span>MILITOPO / ORIENTACIÓN</span><h1 id="morModeHeading">Elige tu experiencia</h1><p>Un perfil. Dos formas de vivir cada carrera.</p></div></div>
      <div class="mor-mode-choices" role="group" aria-label="Seleccionar modo">
        <button type="button" class="mor-mode-choice" data-mor-choice="runner"><span class="mor-choice-symbol" aria-hidden="true">${runnerSvg}</span><strong>CORRER</strong><span>Mis carreras, GPS, clasificación y rendimiento.</span><b>ENTRAR COMO CORREDOR <i aria-hidden="true">→</i></b></button>
        <button type="button" class="mor-mode-choice is-organizer" data-mor-choice="organizer"><span class="mor-choice-symbol" aria-hidden="true">${organizerSvg}</span><strong>ORGANIZAR</strong><span>Diseñar, gestionar y seguir una carrera paso a paso.</span><b>ABRIR CENTRO DE CARRERAS <i aria-hidden="true">→</i></b></button>
      </div><div class="mor-mode-foot"><span>Una cuenta · Perfil y estadísticas comunes</span><small data-mor-user></small></div>
    </div>`;
    root.addEventListener("click",e=>{const action=e.target.closest("[data-mor-choice]")?.dataset.morChoice;if(action)select(action)});
    document.body.appendChild(root);return root;
  }
  function close(){if(root)root.hidden=true;document.body.classList.remove("mor-choice-open");opened=false}
  function show(){if(!eligible())return false;document.body.classList.add("mor-organizer-shell");ensure();root.querySelector("[data-mor-user]").textContent=auth.displayName||"";
    globalThis.MILITOPO_PREMIUM?.get?.("organizer-home")?.close?.();root.hidden=false;document.body.classList.add("mor-choice-open");opened=true;return true}
  function select(mode){if(!eligible())return false;
    if(mode==="runner"){location.assign("./participante/");return true}
    if(mode==="organizer"){
      const home=globalThis.MILITOPO_PREMIUM?.get?.("organizer-home");
      if(!home?.open){show();root.querySelector("[data-mor-user]").textContent="El Centro de Carreras todavía está cargando";return false}
      close();document.body.classList.add("mor-organizer-shell");
      if(home.open()===true)return true;
      show();root.querySelector("[data-mor-user]").textContent="No se pudo abrir el Centro de Carreras";return false;
    }
    return false;
  }
  function onAuth(candidate){auth=candidate||globalThis.MILITOPO_V2_AUTH||null;
    if(!eligible()){close();document.body.classList.remove("mor-organizer-shell");lastUid="";return}
    document.body.classList.add("mor-organizer-shell");if(lastUid===auth.uid)return;lastUid=auth.uid;
    const params=new URLSearchParams(location.search),directed=params.get("militopo_mode")==="organizer";
    if(directed){params.delete("militopo_mode");history.replaceState(history.state,"",location.pathname+(params.toString()?`?${params}`:"")+location.hash)}
    setTimeout(()=>{if(!eligible()||globalThis.MILITOPO_PREMIUM?.get?.("organizer-home")?.isOpen?.())return;if(directed)select("organizer");else show()},180);
  }
  globalThis.MILITOPO_ORIENTATION_MODES=Object.freeze({open:show,close,select,isOpen:()=>opened,canOrganize:eligible});
  addEventListener("militopo:v2-auth-ready",e=>onAuth(e.detail));
  if(globalThis.MILITOPO_V2_AUTH)onAuth(globalThis.MILITOPO_V2_AUTH);
})();
