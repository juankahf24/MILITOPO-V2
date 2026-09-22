/* MILITOPO V2 · F2B · ciclo de vida con inicio/final de carrera serverizado.
   PUBLICADO→EN DIRECTO y EN DIRECTO→FINALIZADO pasan por Cloud Functions. */
import "../bootstrap.js";
import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";

const MANAGER_ROLES = new Set(["organizer", "super_admin"]);
const ORDER = ["draft", "prepared", "published", "live", "finished", "archived"];
const META = {
  draft: { label: "BORRADOR", action: "MARCAR COMO PREPARADO", next: "prepared" },
  prepared: { label: "PREPARADO", action: "PUBLICAR EVENTO", next: "published" },
  published: { label: "PUBLICADO", action: "INICIAR EVENTO", next: "live" },
  live: { label: "EN DIRECTO", action: "FINALIZAR EVENTO", next: "finished" },
  finished: { label: "FINALIZADO", action: "ARCHIVAR EVENTO", next: "archived" },
  archived: { label: "ARCHIVADO", action: "", next: "" }
};
const state = {
  auth: globalThis.MILITOPO_V2_AUTH || null,
  services: null,
  eventId: "",
  event: null,
  busy: false,
  panel: null,
  status: null,
  detail: null,
  action: null,
  refresh: null,
  overlay: null,
  overlayShownAt: 0
};

function roleOf(auth = state.auth) {
  const role = String(auth?.role || "runner");
  return ["runner", "organizer", "super_admin"].includes(role) ? role : "runner";
}
function canManage() {
  return Boolean(state.auth?.uid && state.auth?.emailVerified && MANAGER_ROLES.has(roleOf()));
}
function esc(value) {
  return String(value ?? "").replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
}
function validStatus(value) {
  return ORDER.includes(String(value || "")) ? String(value) : "draft";
}
function currentEventId() {
  return String(state.eventId || document.getElementById("eventId")?.value || "").trim();
}

function publishLifecycleState(eventId, status, exists = true) {
  const normalized = validStatus(status);
  const locked = Boolean(exists && !["draft", "prepared"].includes(normalized));
  const detail = {
    eventId: String(eventId || ""),
    status: normalized,
    exists: Boolean(exists),
    lockedDesign: locked,
    label: META[normalized]?.label || normalized
  };
  globalThis.MILITOPO_V2_EVENT_STATUS = detail;
  globalThis.dispatchEvent(new CustomEvent("militopo:v2-event-status", { detail }));
  return detail;
}
async function services() {
  if (!state.services) state.services = await globalThis.MILITOPO_V2.firebase();
  return state.services;
}
function injectStyle() {
  if (document.getElementById("m2LifecycleStyle")) return;
  const style = document.createElement("style");
  style.id = "m2LifecycleStyle";
  style.textContent = `
    .m2-life{margin:12px 0 16px;padding:14px;border:1px solid rgba(245,204,121,.34);border-radius:18px;background:rgba(7,17,8,.78)}
    .m2-life-head{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}
    .m2-life-title{font-weight:900;letter-spacing:.08em;color:#f5d18b}
    .m2-life-chip{display:inline-flex;align-items:center;min-height:34px;padding:5px 11px;border-radius:999px;border:1px solid rgba(245,204,121,.34);font-weight:900;letter-spacing:.06em;background:rgba(245,204,121,.10)}
    .m2-life-track{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:5px;margin:12px 0 10px}
    .m2-life-step{min-width:0;padding:6px 4px;border-radius:8px;text-align:center;font-size:.62rem;line-height:1.15;border:1px solid rgba(255,255,255,.10);opacity:.48}
    .m2-life-step.done{opacity:.82;background:rgba(116,156,87,.18)}
    .m2-life-step.active{opacity:1;border-color:rgba(245,204,121,.55);background:rgba(245,204,121,.14);font-weight:900}
    .m2-life-detail{font-size:.79rem;line-height:1.45;opacity:.84;margin:8px 0 12px}
    .m2-life-actions{display:flex;gap:8px;flex-wrap:wrap}
    .m2-life button{min-height:44px;border-radius:12px;border:1px solid rgba(245,204,121,.38);padding:9px 12px;font:inherit;font-weight:900;cursor:pointer;background:rgba(245,204,121,.14);color:inherit}
    .m2-life button[disabled]{opacity:.42;cursor:not-allowed}
    .m2-life .m2-life-primary{background:linear-gradient(180deg,#f6d285,#d99c38);color:#1b160c;border-color:#f7d793}
    .m2-life-overlay[hidden]{display:none!important}
    .m2-life-overlay{position:fixed;inset:0;z-index:2147482500;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(2,8,3,.66);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
    .m2-life-progress-card{width:min(92vw,430px);border:1px solid rgba(245,204,121,.52);border-radius:22px;padding:22px 20px;background:rgba(8,20,10,.97);box-shadow:0 18px 60px rgba(0,0,0,.35);text-align:center}
    .m2-life-progress-icon{font-size:2rem;line-height:1;margin-bottom:10px}
    .m2-life-progress-title{font-weight:900;letter-spacing:.09em;color:#f5d18b;font-size:1.05rem}
    .m2-life-progress-text{margin-top:8px;line-height:1.45;opacity:.88;font-size:.84rem;min-height:2.9em}
    .m2-life-progress-track{height:7px;margin-top:18px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.10)}
    .m2-life-progress-bar{width:12%;height:100%;border-radius:inherit;background:linear-gradient(90deg,rgba(245,204,121,.55),#f5cc79);transition:width .48s cubic-bezier(.2,.8,.2,1)}
    .m2-life-progress-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:14px}
    .m2-life-progress-step{padding:7px 5px;border-radius:10px;border:1px solid rgba(255,255,255,.08);font-size:.61rem;line-height:1.2;opacity:.42;transition:opacity .28s ease,background .28s ease,border-color .28s ease}
    .m2-life-progress-step.is-active{opacity:1;background:rgba(245,204,121,.10);border-color:rgba(245,204,121,.38)}
    .m2-life-progress-step.is-done{opacity:.78;background:rgba(118,166,88,.12);border-color:rgba(118,166,88,.30)}
    .m2-life-overlay.is-success .m2-life-progress-bar{width:100%!important}
    .m2-life-overlay.is-error .m2-life-progress-bar{width:100%!important;opacity:.5}
    .m2-life-progress-card{animation:m2LifeCardIn .22s ease-out both}
    @keyframes m2LifeCardIn{from{opacity:0;transform:scale(.975) translateY(8px)}to{opacity:1;transform:none}}
    @media(prefers-reduced-motion:reduce){.m2-life-progress-bar,.m2-life-progress-step,.m2-life-progress-card{transition:none;animation:none}}
    @media(max-width:520px){.m2-life-track{grid-template-columns:repeat(3,minmax(0,1fr))}.m2-life-actions button{width:100%}}
  `;
  document.head.appendChild(style);
}
const TRANSITION_UI = {
  "draft>prepared": ["PREPARANDO EVENTO", "Validando balizas y recorridos y guardando el estado…"],
  "prepared>published": ["PUBLICANDO EVENTO", "Aplicando el estado PUBLICADO y cerrando el diseño…"],
  "published>live": ["INICIANDO EVENTO", "Creando la sesión Live V2 y autorizando corredores…"],
  "live>finished": ["FINALIZANDO EVENTO", "Cerrando la sesión Live V2 y guardando el final de la actividad…"],
  "finished>archived": ["ARCHIVANDO EVENTO", "Guardando el evento como archivado sin borrar sus datos…"]
};
function ensureProcessingOverlay() {
  if (state.overlay?.isConnected) return state.overlay;
  const overlay = document.createElement("div");
  overlay.id = "m2LifecycleProcessing";
  overlay.className = "m2-life-overlay";
  overlay.hidden = true;
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.setAttribute("aria-busy", "false");
  overlay.innerHTML = `
    <div class="m2-life-progress-card">
      <div class="m2-life-progress-icon" aria-hidden="true">⏳</div>
      <div class="m2-life-progress-title">PROCESANDO…</div>
      <div class="m2-life-progress-text">Espera un momento.</div>
      <div class="m2-life-progress-track" aria-hidden="true"><div class="m2-life-progress-bar"></div></div>
      <div class="m2-life-progress-steps" aria-hidden="true">
        <div class="m2-life-progress-step" data-stage="1">SOLICITUD</div>
        <div class="m2-life-progress-step" data-stage="2">VALIDACIÓN</div>
        <div class="m2-life-progress-step" data-stage="3">GUARDADO</div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  state.overlay = overlay;
  return overlay;
}
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function setProcessingStage(stage, title, text, width) {
  const overlay = ensureProcessingOverlay();
  if (title) overlay.querySelector(".m2-life-progress-title").textContent = title;
  if (text) overlay.querySelector(".m2-life-progress-text").textContent = text;
  const bar = overlay.querySelector(".m2-life-progress-bar");
  if (bar && Number.isFinite(Number(width))) bar.style.width = `${Math.max(8, Math.min(100, Number(width)))}%`;
  overlay.querySelectorAll(".m2-life-progress-step").forEach((node, index) => {
    const n = index + 1;
    node.classList.toggle("is-done", n < stage);
    node.classList.toggle("is-active", n === stage);
  });
}
function showProcessing(from, to) {
  const overlay = ensureProcessingOverlay();
  const [title, text] = TRANSITION_UI[`${from}>${to}`] || ["ACTUALIZANDO EVENTO", "Guardando el nuevo estado…"];
  overlay.classList.remove("is-success", "is-error");
  overlay.querySelector(".m2-life-progress-icon").textContent = "⏳";
  overlay.hidden = false;
  overlay.setAttribute("aria-busy", "true");
  state.overlayShownAt = Date.now();
  setProcessingStage(1, title, "Solicitud recibida. Preparando la operación…", 12);

  // La secuencia visual empieza inmediatamente y avanza aunque el backend responda muy rápido.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    setProcessingStage(1, title, "Solicitud recibida. Preparando la operación…", 18);
  }));
  clearTimeout(state.processingStage2Timer);
  clearTimeout(state.processingStage3Timer);
  state.processingStage2Timer = setTimeout(() => {
    if (!overlay.hidden) setProcessingStage(2, title, text, 48);
  }, 420);
  state.processingStage3Timer = setTimeout(() => {
    if (!overlay.hidden) setProcessingStage(3, title, "Guardando y confirmando el nuevo estado…", 78);
  }, 1050);
}
async function finishProcessing(ok, text = "") {
  const overlay = ensureProcessingOverlay();
  clearTimeout(state.processingStage2Timer);
  clearTimeout(state.processingStage3Timer);

  // Mantener la secuencia el tiempo suficiente para que pueda leerse y no dé sensación de salto.
  const elapsed = Date.now() - Number(state.overlayShownAt || 0);
  if (elapsed < 1650) {
    if (elapsed < 420) {
      await sleep(Math.max(0, 420 - elapsed));
      setProcessingStage(2, null, "Validando la operación con MILITOPO…", 48);
    }
    const elapsed2 = Date.now() - Number(state.overlayShownAt || 0);
    if (elapsed2 < 1050) {
      await sleep(Math.max(0, 1050 - elapsed2));
      setProcessingStage(3, null, "Guardando y confirmando el nuevo estado…", 78);
    }
    const elapsed3 = Date.now() - Number(state.overlayShownAt || 0);
    if (elapsed3 < 1650) await sleep(1650 - elapsed3);
  }

  overlay.classList.toggle("is-success", Boolean(ok));
  overlay.classList.toggle("is-error", !ok);
  overlay.querySelector(".m2-life-progress-icon").textContent = ok ? "✅" : "⚠️";
  overlay.querySelector(".m2-life-progress-title").textContent = ok ? "OPERACIÓN COMPLETADA" : "NO SE PUDO COMPLETAR";
  overlay.querySelector(".m2-life-progress-text").textContent = text || (ok ? "Estado actualizado correctamente." : "Revisa el mensaje del bloque de gestión.");
  overlay.querySelector(".m2-life-progress-bar").style.width = "100%";
  overlay.querySelectorAll(".m2-life-progress-step").forEach(node => {
    node.classList.remove("is-active");
    node.classList.add("is-done");
  });
  overlay.setAttribute("aria-busy", "false");

  // Resultado visible el tiempo suficiente para leerlo.
  await sleep(ok ? 1350 : 2000);
  overlay.hidden = true;
  overlay.classList.remove("is-success", "is-error");
  overlay.querySelector(".m2-life-progress-bar").style.width = "12%";
}

function ensurePanel() {
  if (state.panel?.isConnected) return state.panel;
  const step = document.getElementById("step1");
  if (!step) return null;
  injectStyle();
  const panel = document.createElement("section");
  panel.id = "m2EventLifecycle";
  panel.className = "m2-life";
  panel.innerHTML = `
    <div class="m2-life-head">
      <div class="m2-life-title">☁️ GESTIÓN DEL EVENTO V2</div>
      <div id="m2LifecycleStatus" class="m2-life-chip">SIN CARGAR</div>
    </div>
    <div id="m2LifecycleTrack" class="m2-life-track"></div>
    <div id="m2LifecycleDetail" class="m2-life-detail">Confirma el PASO 1 para crear el evento en Firestore.</div>
    <div class="m2-life-actions">
      <button id="m2LifecycleRefresh" type="button">↻ ACTUALIZAR ESTADO</button>
      <button id="m2LifecycleAction" type="button" class="m2-life-primary" disabled>EVENTO AÚN NO DISPONIBLE</button>
    </div>`;
  const nav = step.querySelector(".nav-row");
  if (nav) nav.insertAdjacentElement("beforebegin", panel);
  else step.appendChild(panel);
  state.panel = panel;
  state.status = panel.querySelector("#m2LifecycleStatus");
  state.detail = panel.querySelector("#m2LifecycleDetail");
  state.action = panel.querySelector("#m2LifecycleAction");
  state.refresh = panel.querySelector("#m2LifecycleRefresh");
  state.refresh.addEventListener("click", () => refresh(true));
  state.action.addEventListener("click", advance);
  paint();
  return panel;
}
function trackHtml(status) {
  const current = ORDER.indexOf(status);
  return ORDER.map((key, index) => {
    const cls = index < current ? "done" : index === current ? "active" : "";
    return `<div class="m2-life-step ${cls}">${esc(META[key].label)}</div>`;
  }).join("");
}
function readinessText(data, status) {
  if (status === "draft") {
    const points = Number(data?.checkpointSyncedCount || 0);
    const courses = Number(data?.courseSyncedCount || 0);
    if (points < 3 || courses < 1) return `Para marcar como PREPARADO faltan datos en Firestore: ${points} puntos · ${courses} recorridos.`;
    return `Estructura preparada: ${points} puntos · ${courses} recorridos. Ya puedes cerrar la preparación.`;
  }
  if (status === "prepared") return "El evento está preparado. Publicarlo lo deja listo para la fase de participantes y salida.";
  if (status === "published") return "El evento está publicado. Inícialo solo cuando vaya a comenzar la actividad.";
  if (status === "live") return "Evento EN DIRECTO. Finalízalo cuando termine la actividad.";
  if (status === "finished") return "Evento finalizado. Archívalo cuando ya no necesites modificar su gestión.";
  return "Evento archivado. Se conserva en Firestore; no se borra físicamente.";
}
function paint(message = "") {
  ensurePanel();
  if (!state.panel) return;
  const eventId = currentEventId();
  if (!canManage()) {
    state.status.textContent = "SIN PERMISOS";
    state.detail.textContent = "Se necesita una cuenta organizer o super_admin verificada.";
    state.action.disabled = true;
    state.refresh.disabled = state.busy;
    state.action.textContent = "ACCESO NO DISPONIBLE";
    state.panel.querySelector("#m2LifecycleTrack").innerHTML = trackHtml("draft");
    return;
  }
  if (!eventId || !state.event) {
    state.status.textContent = eventId ? "COMPROBANDO" : "SIN EVENTO";
    state.detail.textContent = message || "Confirma el PASO 1 para crear el evento en Firestore.";
    state.action.disabled = true;
    state.refresh.disabled = state.busy;
    state.action.textContent = "EVENTO AÚN NO DISPONIBLE";
    state.panel.querySelector("#m2LifecycleTrack").innerHTML = trackHtml("draft");
    return;
  }
  const status = validStatus(state.event.status);
  state.refresh.disabled = state.busy;
  state.status.textContent = META[status].label;
  state.panel.querySelector("#m2LifecycleTrack").innerHTML = trackHtml(status);
  state.detail.textContent = message || readinessText(state.event, status);
  if (!META[status].next) {
    state.action.disabled = true;
    state.action.textContent = "EVENTO ARCHIVADO";
  } else {
    const notReady = status === "draft" && (Number(state.event.checkpointSyncedCount || 0) < 3 || Number(state.event.courseSyncedCount || 0) < 1);
    state.action.disabled = state.busy || notReady || !navigator.onLine;
    state.action.textContent = state.busy ? "ACTUALIZANDO…" : META[status].action;
  }
}
async function refresh(userRequested = false) {
  ensurePanel();
  const eventId = currentEventId();
  state.eventId = eventId;
  if (!canManage() || !eventId) {
    state.event = null;
    publishLifecycleState(eventId, "draft", false);
    paint();
    return false;
  }
  if (!navigator.onLine) {
    paint("Sin conexión. El estado de Firestore no se puede comprobar ahora; los datos locales permanecen intactos.");
    return false;
  }
  try {
    const { firestore } = await services();
    const snap = await getDoc(doc(firestore, "events", eventId));
    if (!snap.exists()) {
      state.event = null;
      publishLifecycleState(eventId, "draft", false);
      paint("Este código todavía no existe en Firestore. Confirma el PASO 1 y espera a que aparezca ‘Firestore al día’. ");
      return false;
    }
    const data = snap.data() || {};
    if (String(data.ownerUid || "") !== String(state.auth?.uid || "") && roleOf() !== "super_admin") {
      state.event = null;
      paint("Este evento no pertenece a esta cuenta.");
      return false;
    }
    state.event = { ...data, eventId: snap.id, status: validStatus(data.status) };
    publishLifecycleState(snap.id, state.event.status, true);
    paint(userRequested ? "Estado actualizado desde Firestore. " + readinessText(state.event, state.event.status) : "");
    return true;
  } catch (error) {
    console.error("[MILITOPO D1] refresh", error);
    paint("No se pudo leer el estado del evento. La copia local no se ha modificado.");
    return false;
  }
}
function confirmTransition(from, to) {
  if (to === "live") return confirm("Vas a marcar el evento como EN DIRECTO.\n\nHazlo solo cuando la actividad vaya a comenzar. ¿Continuar?");
  if (to === "finished") return confirm("Vas a FINALIZAR el evento.\n\n¿La actividad ha terminado realmente?");
  if (to === "archived") return confirm("Vas a ARCHIVAR el evento.\n\nNo se borrará, pero quedará cerrado en el ciclo V2. ¿Continuar?");
  return true;
}
async function advance() {
  if (state.busy) return;
  if (!await refresh()) return;
  const eventId = currentEventId();
  const from = validStatus(state.event?.status);
  const to = META[from]?.next;
  if (!to) return;
  if (from === "draft" && (Number(state.event.checkpointSyncedCount || 0) < 3 || Number(state.event.courseSyncedCount || 0) < 1)) {
    paint(readinessText(state.event, from));
    return;
  }
  if (!confirmTransition(from, to)) return;

  state.busy = true;
  showProcessing(from, to);
  paint(`Cambiando ${META[from].label} → ${META[to].label}…`);
  let ok = false;
  let finalMessage = "";
  try {
    const svc = await services();
    const { firestore, functions } = svc;
    if (from === "published" && to === "live") {
      const response = await httpsCallable(functions, "startLiveRun")({ eventId });
      const data = response?.data || {};
      await refresh();
      globalThis.dispatchEvent(new CustomEvent("militopo:v2-live-run-changed", { detail: data }));
      globalThis.dispatchEvent(new CustomEvent("militopo:v2-event-status-changed", { detail: { eventId, from, to, runId: data.runId || "" } }));
      finalMessage = `Evento EN DIRECTO · ${Number(data.participantCount || 0)} corredor${Number(data.participantCount || 0) === 1 ? "" : "es"} autorizado${Number(data.participantCount || 0) === 1 ? "" : "s"}.`;
      if (typeof globalThis.toast === "function") globalThis.toast(`Carrera iniciada · ${data.participantCount ?? 0} corredor(es)`);
      ok = true;
      return;
    }
    if (from === "live" && to === "finished") {
      const response = await httpsCallable(functions, "finishLiveRun")({ eventId });
      const data = response?.data || {};
      await refresh();
      globalThis.dispatchEvent(new CustomEvent("militopo:v2-live-run-changed", { detail: data }));
      globalThis.dispatchEvent(new CustomEvent("militopo:v2-event-status-changed", { detail: { eventId, from, to, runId: data.runId || "" } }));
      finalMessage = "Evento FINALIZADO · sesión Live V2 cerrada correctamente.";
      if (typeof globalThis.toast === "function") globalThis.toast("Carrera finalizada en backend Live V2");
      ok = true;
      return;
    }
    const payload = {
      status: to,
      cloudStage: "F2B",
      lifecycleVersion: 2,
      updatedAt: serverTimestamp()
    };
    if (to === "prepared") payload.preparedAt = serverTimestamp();
    if (to === "published") payload.publishedAt = serverTimestamp();
    if (to === "archived") payload.archivedAt = serverTimestamp();
    await updateDoc(doc(firestore, "events", eventId), payload);
    await refresh();
    globalThis.dispatchEvent(new CustomEvent("militopo:v2-event-status-changed", { detail: { eventId, from, to } }));
    finalMessage = `Estado actualizado a ${META[to].label}.`;
    if (typeof globalThis.toast === "function") globalThis.toast(`Estado: ${META[to].label}`);
    ok = true;
  } catch (error) {
    console.error("[MILITOPO F2B] transition", error);
    finalMessage = `No se pudo cambiar el estado: ${String(error?.message || error)}`;
  } finally {
    state.busy = false;
    paint(ok ? "" : finalMessage);
    await finishProcessing(ok, finalMessage);
  }
}

function onAuthReady(event) {
  state.auth = event?.detail || globalThis.MILITOPO_V2_AUTH || null;
  setTimeout(() => refresh(), 120);
}
function onHeader(event) {
  const eventId = String(event?.detail?.header?.eventId || "").trim();
  if (eventId && eventId !== state.eventId) {
    state.eventId = eventId;
    state.event = null;
  }
  setTimeout(() => refresh(), event?.detail?.reason === "step1-confirmed" ? 900 : 250);
}
function init() {
  ensurePanel();
  globalThis.addEventListener("militopo:v2-auth-ready", onAuthReady);
  globalThis.addEventListener("militopo:v2-orientation-header", onHeader);
  globalThis.addEventListener("militopo:v2-cloud-event-applied", event => {
    if (event?.detail?.ok) {
      state.eventId = String(event.detail.eventId || "");
      setTimeout(() => refresh(), 250);
    }
  });
  globalThis.addEventListener("online", () => refresh());
  globalThis.addEventListener("offline", () => paint("Sin conexión. El estado del evento se mantiene, pero no se puede avanzar hasta recuperar Internet."));
  if (globalThis.MILITOPO_V2_AUTH) onAuthReady({ detail: globalThis.MILITOPO_V2_AUTH });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
