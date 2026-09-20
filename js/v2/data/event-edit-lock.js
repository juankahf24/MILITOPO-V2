/* MILITOPO V2 · Fase D2 · bloqueo de diseño según ciclo del evento.
   Draft/prepared: editable. Published/live/finished/archived: diseño congelado.
   Firestore Rules son la barrera autoritativa; este módulo añade UX preventiva. */
import "../bootstrap.js";

const LOCKED = new Set(["published", "live", "finished", "archived"]);
const LABELS = {
  draft: "BORRADOR",
  prepared: "PREPARADO",
  published: "PUBLICADO",
  live: "EN DIRECTO",
  finished: "FINALIZADO",
  archived: "ARCHIVADO"
};
const state = { eventId: "", status: "draft", locked: false, observer: null };

function normalizeStatus(value) {
  const key = String(value || "draft");
  return Object.prototype.hasOwnProperty.call(LABELS, key) ? key : "draft";
}
function currentEventId() {
  return String(document.getElementById("eventId")?.value || state.eventId || "").trim();
}
function publishGlobal() {
  const detail = {
    eventId: state.eventId,
    status: state.status,
    label: LABELS[state.status],
    locked: state.locked
  };
  globalThis.MILITOPO_V2_EVENT_EDIT_LOCK = detail;
  globalThis.dispatchEvent(new CustomEvent("militopo:v2-event-edit-lock", { detail }));
}
function ensureStyle() {
  if (document.getElementById("m2EventEditLockStyle")) return;
  const style = document.createElement("style");
  style.id = "m2EventEditLockStyle";
  style.textContent = `
    .m2-design-lock{margin:10px 0 14px;padding:12px 14px;border-radius:15px;border:1px solid rgba(245,204,121,.42);background:rgba(70,42,18,.78);line-height:1.4;font-size:.82rem}
    .m2-design-lock strong{color:#f6d28b;letter-spacing:.05em}
    .m2-design-lock[hidden]{display:none!important}
    .m2-cloud-locked-control{opacity:.58!important;cursor:not-allowed!important}
  `;
  document.head.appendChild(style);
}
function ensureBanner(stepId) {
  const step = document.getElementById(stepId);
  if (!step) return null;
  let banner = step.querySelector(":scope > .m2-design-lock");
  if (!banner) {
    banner = document.createElement("div");
    banner.className = "m2-design-lock";
    banner.hidden = true;
    const header = step.querySelector(".card-header");
    if (header) header.insertAdjacentElement("afterend", banner);
    else step.prepend(banner);
  }
  return banner;
}
function mutationButton(button) {
  const code = String(button.getAttribute("onclick") || "");
  if (!code) return false;
  return [
    "confirmStep1", "confirmStep2", "autofillOrientationPoints", "clearAllOrientationPoints",
    "saveSelectedPoint", "clearSelectedPoint", "regenerateSingleRoute", "openManualRouteEditor",
    "markCurrentIofComplete", "markCurrentIofPending", "autofillRandomIofDescriptions",
    "autofillOfficialIofDescriptions", "applyIofTemplateToEmpty", "clearIofDescriptions"
  ].some(name => code.includes(name));
}
function setControlLocked(el, locked) {
  if (!el) return;
  if (locked) {
    if (!el.dataset.m2PrevDisabled) el.dataset.m2PrevDisabled = el.disabled ? "1" : "0";
    el.disabled = true;
    el.classList.add("m2-cloud-locked-control");
  } else if (el.dataset.m2PrevDisabled != null) {
    el.disabled = el.dataset.m2PrevDisabled === "1";
    delete el.dataset.m2PrevDisabled;
    el.classList.remove("m2-cloud-locked-control");
  }
}
function applyControls() {
  const locked = state.locked;
  [
    "eventName", "participantCount", "maxUniqueRoutes", "controlCount", "controlsPerRoute",
    "maxControlReuse", "planScaleSelect", "planEquidistanceInput", "selectedUtm", "iofEventName",
    "iofQuickTemplate"
  ].forEach(id => setControlLocked(document.getElementById(id), locked));

  document.querySelectorAll("#step1 button, #step2 button, #step3 button").forEach(button => {
    if (mutationButton(button)) setControlLocked(button, locked);
  });
  document.querySelectorAll("#pointsTable input, #iofDescriptionsEditor select").forEach(el => setControlLocked(el, locked));

  ["step1", "step2", "step3"].forEach(stepId => {
    const banner = ensureBanner(stepId);
    if (!banner) return;
    banner.hidden = !locked;
    if (locked) {
      banner.innerHTML = `<strong>🔒 DISEÑO BLOQUEADO · ${LABELS[state.status]}</strong><br>` +
        `Balizas, configuración y recorridos quedan congelados para que participantes y material oficial usen una única versión. ` +
        `Puedes consultar el evento y generar material, pero no modificar su diseño.`;
    }
  });
}
function applyStatus(detail = {}) {
  const status = normalizeStatus(detail.status);
  const eventId = String(detail.eventId || currentEventId() || "").trim();
  const exists = detail.exists !== false;
  state.eventId = eventId;
  state.status = status;
  state.locked = Boolean(exists && LOCKED.has(status));
  publishGlobal();
  applyControls();
  // Markers/table may have been rendered before the status arrived. Re-rendering is intentionally
  // delegated to the classic app on the next normal render; hard guards still prevent mutation.
}
function init() {
  ensureStyle();
  ["step1", "step2", "step3"].forEach(ensureBanner);
  globalThis.addEventListener("militopo:v2-event-status", event => applyStatus(event.detail || {}));
  globalThis.addEventListener("militopo:v2-cloud-event-applied", event => {
    if (event?.detail?.ok) {
      state.eventId = String(event.detail.eventId || currentEventId());
      setTimeout(applyControls, 100);
    }
  });
  const existing = globalThis.MILITOPO_V2_EVENT_STATUS;
  if (existing) applyStatus(existing);
  else { publishGlobal(); applyControls(); }
  state.observer = new MutationObserver(() => applyControls());
  ["step1", "step2", "step3"].forEach(id => {
    const node = document.getElementById(id);
    if (node) state.observer.observe(node, { childList: true, subtree: true });
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
