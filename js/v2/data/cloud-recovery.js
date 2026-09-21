/* MILITOPO V2 · Fase D3 · centro de eventos del Organizador.
   Organizer: solo sus eventos. Super admin: todos los eventos accesibles.
   Mantiene la recuperación C3 y nunca borra eventos físicamente. */
import "../bootstrap.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const MANAGER_ROLES = new Set(["organizer", "super_admin"]);
const state = {
  auth: globalThis.MILITOPO_V2_AUTH || null,
  services: null,
  busy: false,
  overlay: null,
  list: null,
  status: null,
  events: []
};

function cleanRole(role) {
  return ["runner", "organizer", "super_admin"].includes(String(role || "")) ? String(role) : "runner";
}
function canManage(auth = state.auth) {
  return Boolean(auth?.uid && auth?.emailVerified && MANAGER_ROLES.has(cleanRole(auth.role)));
}
function isSuperAdmin(auth = state.auth) {
  return cleanRole(auth?.role) === "super_admin";
}
const STATUS_LABELS = {
  draft: "BORRADOR", prepared: "PREPARADO", published: "PUBLICADO",
  live: "EN DIRECTO", finished: "FINALIZADO", archived: "ARCHIVADO"
};
function statusLabel(value) {
  return STATUS_LABELS[String(value || "draft")] || String(value || "draft").toUpperCase();
}
function cleanString(value, max = 300) {
  return String(value ?? "").trim().slice(0, max);
}
function finiteOrNull(value) {
  if (value === null || value === "" || typeof value === "undefined") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function timestampMs(value) {
  try {
    if (value && typeof value.toMillis === "function") return value.toMillis();
    if (value && typeof value.toDate === "function") return value.toDate().getTime();
    if (typeof value === "string") return Date.parse(value) || 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  } catch (_) {}
  return 0;
}
function formatDate(value) {
  const ms = timestampMs(value);
  if (!ms) return "Sin fecha";
  try {
    return new Intl.DateTimeFormat("es-ES", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(ms));
  } catch (_) {
    return new Date(ms).toLocaleString();
  }
}
function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function services() {
  if (state.services) return state.services;
  state.services = await globalThis.MILITOPO_V2.firebase();
  return state.services;
}

function ensureStyles() {
  if (document.getElementById("m2CloudRecoveryStyles")) return;
  const style = document.createElement("style");
  style.id = "m2CloudRecoveryStyles";
  style.textContent = `
    .m2-cloud-recovery-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0}
    .m2-cloud-recovery-btn{min-height:44px;border:1px solid rgba(255,255,255,.22);border-radius:10px;padding:10px 14px;background:#1b2517;color:#fff;font-weight:800;cursor:pointer}
    .m2-cloud-recovery-btn:disabled{opacity:.55;cursor:not-allowed}
    .m2-cloud-recovery-overlay{position:fixed;inset:0;z-index:2147481000;background:rgba(0,0,0,.72);display:grid;place-items:center;padding:16px}
    .m2-cloud-recovery-overlay[hidden]{display:none!important}
    .m2-cloud-recovery-panel{width:min(760px,100%);max-height:82vh;overflow:auto;background:#11180e;color:#fff;border:1px solid rgba(255,255,255,.18);border-radius:16px;padding:16px;box-shadow:0 18px 60px rgba(0,0,0,.55)}
    .m2-cloud-recovery-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px}
    .m2-cloud-recovery-close{min-width:44px;min-height:44px;border:0;border-radius:10px;background:#262e22;color:#fff;font-size:20px;cursor:pointer}
    .m2-cloud-recovery-list{display:grid;gap:10px}
    .m2-cloud-event{border:1px solid rgba(255,255,255,.16);border-radius:12px;padding:12px;background:rgba(255,255,255,.04)}
    .m2-cloud-event h3{margin:0 0 5px;font-size:1rem}
    .m2-cloud-event-meta{font-size:.86rem;opacity:.78;display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
    .m2-cloud-event-status{display:inline-flex;align-items:center;min-height:26px;padding:3px 8px;border-radius:999px;border:1px solid rgba(245,204,121,.34);font-size:.74rem;font-weight:900;letter-spacing:.04em}
    .m2-cloud-event.archived{opacity:.72}
    .m2-cloud-event-open{min-height:42px;border:0;border-radius:9px;padding:9px 13px;font-weight:900;cursor:pointer;background:#d9e8c9;color:#10150d}
    .m2-cloud-recovery-empty{padding:14px;border:1px dashed rgba(255,255,255,.25);border-radius:10px;opacity:.82}
    @media(max-width:480px){.m2-cloud-recovery-panel{padding:12px}.m2-cloud-event-open{width:100%}}
  `;
  document.head.appendChild(style);
}

function paintStatus(text, kind = "warn") {
  ensureLauncher();
  if (!state.status) return;
  state.status.className = `status ${kind}`;
  state.status.textContent = text;
}

function ensureLauncher() {
  ensureStyles();
  const step = document.getElementById("step1");
  if (!step) return null;
  let row = document.getElementById("m2CloudRecoveryRow");
  if (!row) {
    row = document.createElement("div");
    row.id = "m2CloudRecoveryRow";
    row.className = "m2-cloud-recovery-row";
    row.innerHTML = `
      <button type="button" id="m2CloudRecoveryOpen" class="m2-cloud-recovery-btn">☁️ ABRIR EVENTO DESDE NUBE</button>
      <span id="m2CloudRecoveryMini" style="font-size:.85rem;opacity:.78">C3 · recuperación Firestore</span>
    `;
    const nav = step.querySelector(".nav-row");
    if (nav) nav.insertAdjacentElement("beforebegin", row);
    else step.appendChild(row);
    row.querySelector("#m2CloudRecoveryOpen")?.addEventListener("click", openCloudPicker);
  }
  let status = document.getElementById("m2CloudRecoveryStatus");
  if (!status) {
    status = document.createElement("div");
    status.id = "m2CloudRecoveryStatus";
    status.className = "status warn";
    status.style.margin = "8px 0 12px";
    status.textContent = "☁️ Recuperación nube preparada.";
    row.insertAdjacentElement("afterend", status);
  }
  state.status = status;
  return row;
}

function ensureOverlay() {
  if (state.overlay?.isConnected) return state.overlay;
  const overlay = document.createElement("div");
  overlay.className = "m2-cloud-recovery-overlay";
  overlay.hidden = true;
  overlay.style.display = "none";
  overlay.innerHTML = `
    <section class="m2-cloud-recovery-panel" role="dialog" aria-modal="true" aria-labelledby="m2CloudRecoveryTitle">
      <div class="m2-cloud-recovery-head">
        <div>
          <h2 id="m2CloudRecoveryTitle" style="margin:0">Eventos en Firestore</h2>
          <div style="font-size:.86rem;opacity:.72;margin-top:3px">Organizer: tus eventos. Super admin: todos los eventos accesibles.</div>
        </div>
        <button type="button" class="m2-cloud-recovery-close" aria-label="Cerrar">×</button>
      </div>
      <div id="m2CloudRecoveryList" class="m2-cloud-recovery-list"></div>
    </section>
  `;
  overlay.querySelector(".m2-cloud-recovery-close")?.addEventListener("click", closeOverlay);
  overlay.addEventListener("click", event => {
    if (event.target === overlay) closeOverlay();
  });
  document.body.appendChild(overlay);
  state.overlay = overlay;
  state.list = overlay.querySelector("#m2CloudRecoveryList");
  return overlay;
}
function closeOverlay() {
  if (!state.overlay) return;
  state.overlay.hidden = true;
  state.overlay.style.display = "none";
}

function normalizeHeader(id, data = {}) {
  return {
    eventId: cleanString(data.eventId || id, 120),
    eventName: cleanString(data.eventName || "ENTRENAMIENTO ORIENTACIÓN", 140) || "ENTRENAMIENTO ORIENTACIÓN",
    participantCount: Math.max(1, Math.trunc(Number(data.participantCount) || 10)),
    maxUniqueRoutes: Math.max(1, Math.trunc(Number(data.maxUniqueRoutes) || 15)),
    controlCount: Math.max(0, Math.trunc(Number(data.controlCount) || 0)),
    controlsPerRoute: Math.max(0, Math.trunc(Number(data.controlsPerRoute) || 0)),
    maxControlReuse: Math.max(1, Math.trunc(Number(data.maxControlReuse) || 6)),
    planScale: Number(data.planScale) === 7500 ? 7500 : 10000,
    planEquidistanceM: Math.max(0.5, Number(data.planEquidistanceM) || 5),
    cloudStage: cleanString(data.cloudStage, 20),
    status: cleanString(data.status || "draft", 30),
    ownerUid: cleanString(data.ownerUid, 160),
    updatedAt: data.updatedAt || data.structureUpdatedAt || data.createdAt || null
  };
}
function normalizeCheckpoint(id, data = {}) {
  return {
    checkpointId: cleanString(data.checkpointId || id, 80),
    type: ["SALIDA", "LLEGADA", "BALIZA"].includes(String(data.type || "")) ? String(data.type) : "BALIZA",
    description: cleanString(data.description ?? data.desc, 240),
    utm: cleanString(data.utm, 120),
    lat: finiteOrNull(data.lat),
    lon: finiteOrNull(data.lon),
    elevationM: finiteOrNull(data.elevationM ?? data.elevation),
    iof: data.iof && typeof data.iof === "object" ? {
      c: cleanString(data.iof.c, 80), d: cleanString(data.iof.d, 80), e: cleanString(data.iof.e, 80),
      f: cleanString(data.iof.f, 80), g: cleanString(data.iof.g, 80), h: cleanString(data.iof.h, 80),
      combo: cleanString(data.iof.combo, 80), text: cleanString(data.iof.text, 240), complete: data.iof.complete === true
    } : {}
  };
}
function normalizeCourse(id, data = {}) {
  const routeId = cleanString(data.routeId || data.courseId || id, 80);
  return {
    courseId: routeId,
    routeId,
    routeDesignIndex: Math.max(0, Math.trunc(Number(data.routeDesignIndex) || 0)),
    points: Array.isArray(data.points) ? data.points.map(x => cleanString(x, 80)).filter(Boolean).slice(0, 120) : [],
    assignedParticipantIds: Array.isArray(data.assignedParticipantIds)
      ? [...new Set(data.assignedParticipantIds.map(x => cleanString(x, 80)).filter(Boolean))].slice(0, 300)
      : [],
    metrics: data.metrics && typeof data.metrics === "object" ? {
      distanceKm: finiteOrNull(data.metrics.distanceKm),
      longestKm: finiteOrNull(data.metrics.longestKm),
      positiveM: finiteOrNull(data.metrics.positiveM),
      negativeM: finiteOrNull(data.metrics.negativeM),
      difficulty: cleanString(data.metrics.difficulty, 40),
      quality: cleanString(data.metrics.quality, 160),
      qualityCode: cleanString(data.metrics.qualityCode, 40),
      routeMode: cleanString(data.metrics.routeMode, 40)
    } : {}
  };
}

async function loadEventList() {
  if (!canManage()) throw new Error("Necesitas una cuenta organizer o super_admin verificada.");
  if (!navigator.onLine) throw new Error("No hay conexión. El evento local sigue disponible.");
  const { firestore } = await services();
  const eventsRef = collection(firestore, "events");
  const source = isSuperAdmin()
    ? eventsRef
    : query(eventsRef, where("ownerUid", "==", String(state.auth.uid)));
  const snap = await getDocs(source);
  const rows = [];
  snap.forEach(docSnap => {
    const data = docSnap.data() || {};
    if (String(data.kind || "orientation") !== "orientation") return;
    rows.push(normalizeHeader(docSnap.id, data));
  });
  rows.sort((a, b) => {
    const aa = a.status === "archived" ? 1 : 0;
    const ba = b.status === "archived" ? 1 : 0;
    return aa - ba || timestampMs(b.updatedAt) - timestampMs(a.updatedAt) || a.eventName.localeCompare(b.eventName, "es");
  });
  state.events = rows;
  return rows;
}

function renderEventList(rows) {
  if (!state.list) return;
  if (!rows.length) {
    state.list.innerHTML = `<div class="m2-cloud-recovery-empty">No hay eventos de Orientación guardados en Firestore para esta cuenta.</div>`;
    return;
  }
  state.list.innerHTML = rows.map(row => {
    const archived = row.status === "archived";
    const own = String(row.ownerUid || "") === String(state.auth?.uid || "");
    return `
      <article class="m2-cloud-event${archived ? " archived" : ""}">
        <h3>${esc(row.eventName)}</h3>
        <div class="m2-cloud-event-meta">
          <span class="m2-cloud-event-status">${esc(statusLabel(row.status))}</span>
          <span>${esc(row.eventId)}</span>
          <span>${row.participantCount} participantes</span>
          <span>${row.controlCount} balizas</span>
          <span>${esc(row.cloudStage || "C1")}</span>
          ${isSuperAdmin() ? `<span>${own ? "PROPIO" : "OTRO ORGANIZADOR"}</span>` : ""}
          <span>${esc(formatDate(row.updatedAt))}</span>
        </div>
        <button type="button" class="m2-cloud-event-open" data-event-id="${esc(row.eventId)}">${archived ? "ABRIR ARCHIVADO" : "ABRIR ESTE EVENTO"}</button>
      </article>
    `;
  }).join("");
  state.list.querySelectorAll(".m2-cloud-event-open").forEach(button => {
    button.addEventListener("click", () => recoverEvent(button.dataset.eventId));
  });
}

async function openCloudPicker() {
  const launcher = document.getElementById("m2CloudRecoveryOpen");
  if (state.busy) return;
  ensureOverlay();
  state.overlay.hidden = false;
  state.overlay.style.display = "grid";
  if (state.list) state.list.innerHTML = `<div class="m2-cloud-recovery-empty">Consultando Firestore…</div>`;
  if (launcher) launcher.disabled = true;
  try {
    const rows = await loadEventList();
    renderEventList(rows);
    paintStatus(`☁️ ${rows.length} evento${rows.length === 1 ? "" : "s"} disponible${rows.length === 1 ? "" : "s"} en el centro de eventos.`, "ok");
  } catch (error) {
    console.error("[MILITOPO C3] list", error);
    if (state.list) state.list.innerHTML = `<div class="m2-cloud-recovery-empty">⚠️ ${esc(error?.message || "No se pudo consultar Firestore.")}</div>`;
    paintStatus("⚠️ No se pudo consultar la lista de eventos. El guardado local no se ha tocado.", "warn");
  } finally {
    if (launcher) launcher.disabled = false;
  }
}

async function fetchCloudEvent(eventId) {
  const { firestore } = await services();
  const eventRef = doc(firestore, "events", eventId);
  const [eventSnap, checkpointSnap, courseSnap] = await Promise.all([
    getDoc(eventRef),
    getDocs(collection(firestore, "events", eventId, "checkpoints")),
    getDocs(collection(firestore, "events", eventId, "courses"))
  ]);
  if (!eventSnap.exists()) throw new Error("El evento ya no existe en Firestore.");
  const header = normalizeHeader(eventSnap.id, eventSnap.data() || {});
  if (String(header.ownerUid || "") !== String(state.auth?.uid || "") && !isSuperAdmin()) {
    throw new Error("Este evento no pertenece a la cuenta actual.");
  }
  const checkpoints = [];
  const courses = [];
  checkpointSnap.forEach(snap => checkpoints.push(normalizeCheckpoint(snap.id, snap.data() || {})));
  courseSnap.forEach(snap => courses.push(normalizeCourse(snap.id, snap.data() || {})));
  checkpoints.sort((a, b) => {
    const order = id => id === "START" ? -2 : id === "FINISH" ? 999999 : Number(String(id).replace(/\D+/g, "")) || 0;
    return order(a.checkpointId) - order(b.checkpointId);
  });
  courses.sort((a, b) => a.routeDesignIndex - b.routeDesignIndex || a.routeId.localeCompare(b.routeId, "es"));
  return { header, checkpoints, courses };
}

async function recoverEvent(eventId) {
  if (state.busy) return;
  const row = state.events.find(item => item.eventId === eventId);
  if (!row) return;
  const ok = confirm(
    `Se va a abrir “${row.eventName}” (${row.eventId}) desde Firestore.\n\n` +
    `MILITOPO guardará primero una copia duradera del evento que tengas abierto en este dispositivo. ` +
    `Después cargará la configuración, balizas y recorridos de la nube.\n\n¿Continuar?`
  );
  if (!ok) return;

  state.busy = true;
  state.list?.querySelectorAll("button").forEach(button => { button.disabled = true; });
  paintStatus(`☁️ Descargando ${row.eventId}…`, "warn");
  try {
    const packet = await fetchCloudEvent(eventId);
    if (!packet.checkpoints.some(point => point.checkpointId === "START") || !packet.checkpoints.some(point => point.checkpointId === "FINISH")) {
      throw new Error("La copia de nube no contiene salida y llegada completas.");
    }
    const requestId = `c3_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    globalThis.dispatchEvent(new CustomEvent("militopo:v2-cloud-event-loaded", {
      detail: { ...packet, requestId }
    }));
    paintStatus(`☁️ Aplicando ${eventId} en el organizador…`, "warn");
    closeOverlay();
  } catch (error) {
    console.error("[MILITOPO C3] recover", error);
    paintStatus(`⚠️ ${error?.message || "No se pudo recuperar el evento."} El evento local sigue intacto.`, "warn");
    state.list?.querySelectorAll("button").forEach(button => { button.disabled = false; });
  } finally {
    state.busy = false;
  }
}

function onAuthReady(event) {
  state.auth = event?.detail || globalThis.MILITOPO_V2_AUTH || null;
  const button = document.getElementById("m2CloudRecoveryOpen");
  if (button) button.disabled = !canManage();
  if (!canManage()) paintStatus("🔒 Recuperación nube disponible para organizer/super_admin con correo verificado.", "warn");
}
function onApplied(event) {
  const detail = event?.detail || {};
  if (detail.ok) {
    paintStatus(`✅ Evento recuperado desde Firestore · ${cleanString(detail.eventId, 120)}`, "ok");
  } else {
    paintStatus(`⚠️ ${cleanString(detail.error || "No se pudo aplicar el evento descargado.", 300)}`, "warn");
  }
}

function init() {
  ensureLauncher();
  ensureOverlay();
  globalThis.addEventListener("militopo:v2-auth-ready", onAuthReady);
  globalThis.addEventListener("militopo:v2-cloud-event-applied", onApplied);
  globalThis.addEventListener("online", () => {
    if (canManage()) paintStatus("☁️ Recuperación nube preparada.", "ok");
  });
  globalThis.addEventListener("offline", () => paintStatus("📴 Sin conexión: los eventos locales siguen disponibles.", "warn"));
  if (globalThis.MILITOPO_V2_AUTH) onAuthReady({ detail: globalThis.MILITOPO_V2_AUTH });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
