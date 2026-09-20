/* MILITOPO V2 · Fase D1 · ciclo de vida del evento.
   Gestiona estados del evento desde Firestore sin Cloud Functions ni Storage. */
import "../bootstrap.js";
import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

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
  refresh: null
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
    @media(max-width:520px){.m2-life-track{grid-template-columns:repeat(3,minmax(0,1fr))}.m2-life-actions button{width:100%}}
  `;
  document.head.appendChild(style);
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
    state.action.textContent = "ACCESO NO DISPONIBLE";
    state.panel.querySelector("#m2LifecycleTrack").innerHTML = trackHtml("draft");
    return;
  }
  if (!eventId || !state.event) {
    state.status.textContent = eventId ? "COMPROBANDO" : "SIN EVENTO";
    state.detail.textContent = message || "Confirma el PASO 1 para crear el evento en Firestore.";
    state.action.disabled = true;
    state.action.textContent = "EVENTO AÚN NO DISPONIBLE";
    state.panel.querySelector("#m2LifecycleTrack").innerHTML = trackHtml("draft");
    return;
  }
  const status = validStatus(state.event.status);
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
  paint(`Cambiando ${META[from].label} → ${META[to].label}…`);
  try {
    const { firestore } = await services();
    const payload = {
      status: to,
      cloudStage: "D1",
      lifecycleVersion: 1,
      updatedAt: serverTimestamp()
    };
    if (to === "prepared") payload.preparedAt = serverTimestamp();
    if (to === "published") payload.publishedAt = serverTimestamp();
    if (to === "live") payload.liveAt = serverTimestamp();
    if (to === "finished") payload.finishedAt = serverTimestamp();
    if (to === "archived") payload.archivedAt = serverTimestamp();
    await updateDoc(doc(firestore, "events", eventId), payload);
    await refresh();
    globalThis.dispatchEvent(new CustomEvent("militopo:v2-event-status-changed", { detail: { eventId, from, to } }));
    if (typeof globalThis.toast === "function") globalThis.toast(`Estado: ${META[to].label}`);
  } catch (error) {
    console.error("[MILITOPO D1] transition", error);
    paint(`No se pudo cambiar el estado: ${String(error?.message || error)}`);
  } finally {
    state.busy = false;
    paint();
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
