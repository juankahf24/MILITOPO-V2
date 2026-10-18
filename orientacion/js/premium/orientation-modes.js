/* MILITOPO · R1 — Modos de uso, independientes del rol/autorización.
   Únicamente la auth resuelta habilita ORGANIZAR; las reglas Firebase siguen mandando.
   No guarda un rol alternativo ni toca sesiones GPS / resultado de corredores. */
(()=>{
  if(globalThis.MILITOPO_ORIENTATION_MODES)return;
  const ROLES=new Set(["organizer","super_admin"]);
  let root=null,lastUid="",opened=false,auth=null;
  const $=(sel,host=document)=>host.querySelector(sel);
  const eligible=()=>Boolean(auth?.uid&&auth?.emailVerified&&ROLES.has(String(auth.role||"")));
  function ensure(){
    if(root?.isConnected)return root;
    root=document.createElement("section");root.className="mor-mode-gate";root.id="militopoOrientationModes";root.hidden=true;
    root.setAttribute("role","dialog");root.setAttribute("aria-modal","true");root.setAttribute("aria-labelledby","morModeHeading");
    root.innerHTML=`<div class="mor-mode-panel">
      <div class="mor-mode-brand"><img src="../icons/militopo-512.png" alt="" width="74" height="74"><div><span>MILITOPO · ORIENTACIÓN</span><h1 id="morModeHeading">¿Qué quieres hacer hoy?</h1><p>Una sola cuenta, dos formas de vivir la orientación.</p></div></div>
      <div class="mor-mode-choices">
        <button type="button" class="mor-mode-choice" data-mor-choice="runner"><span class="mor-choice-symbol" aria-hidden="true">↗</span><strong>CORRER</strong><span>Mis carreras, invitaciones, GPS y resultados.</span><b>ENTRAR COMO CORREDOR <i aria-hidden="true">→</i></b></button>
        <button type="button" class="mor-mode-choice is-organizer" data-mor-choice="organizer"><span class="mor-choice-symbol" aria-hidden="true">◎</span><strong>ORGANIZAR</strong><span>Diseñar, publicar y gestionar tus carreras.</span><b>ABRIR CENTRO DE CARRERAS <i aria-hidden="true">→</i></b></button>
      </div>
      <div class="mor-mode-foot"><span>Una identidad · Perfil compartido · Estadísticas en ambos modos</span><small data-mor-user></small></div>
    </div>`;
    root.addEventListener("click",e=>{const action=e.target.closest("[data-mor-choice]")?.dataset.morChoice;if(action)select(action)});
    document.body.appendChild(root);return root;
  }
  function close(){if(!root)return;root.hidden=true;document.body.classList.remove("mor-choice-open");opened=false}
  function show(){if(!eligible())return false;ensure();const user=$('[data-mor-user]',root);if(user)user.textContent=auth?.displayName||"";
    globalThis.MILITOPO_PREMIUM?.get?.("organizer-home")?.close?.();root.hidden=false;document.body.classList.add("mor-choice-open");opened=true;return true}
  function select(mode){if(!eligible())return false;
    if(mode==="runner"){
      /* Los organizadores no tienen una carrera runner en esta pantalla; el GPS vive en su página independiente. */
      location.assign("./participante/");return true;
    }
    if(mode==="organizer"){
      close();const home=globalThis.MILITOPO_PREMIUM?.get?.("organizer-home");if(home?.open){home.open();return true}
      /* Nunca volver al menú antiguo en silencio si falta Home Premium. */
      show();const hint=$('[data-mor-user]',root);if(hint)hint.textContent="Centro cargando: vuelve a intentar en unos segundos";return false;
    }
    return false;
  }
  function onAuth(candidate){auth=candidate||globalThis.MILITOPO_V2_AUTH||null;if(!eligible()){close();lastUid="";return}
    if(lastUid===auth.uid)return;lastUid=auth.uid;
    const params=new URLSearchParams(location.search);const directed=params.get("militopo_mode")==="organizer";
    if(directed){params.delete("militopo_mode");const suffix=params.toString();history.replaceState(history.state,"",location.pathname+(suffix?`?${suffix}`:"")+location.hash)}
    setTimeout(()=>{if(!eligible())return;if(directed)select("organizer");else show()},450);
  }
  globalThis.MILITOPO_ORIENTATION_MODES=Object.freeze({open:show,close,select,isOpen:()=>opened,canOrganize:eligible});
  addEventListener("militopo:v2-auth-ready",e=>onAuth(e.detail));
  if(globalThis.MILITOPO_V2_AUTH)onAuth(globalThis.MILITOPO_V2_AUTH);
})();
