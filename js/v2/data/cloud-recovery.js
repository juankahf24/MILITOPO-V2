/* MILITOPO V2 · R8D · centro de eventos del Organizador.
   Organizer: solo sus eventos. Super admin: todos los eventos accesibles.
   R8D añade búsqueda incremental por subcadena y retorno integrado a Administración.
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
  events: [],
  overlayMode: "events",
  openResultsAfterRecover: "",
  reuseAfterRecover: "",
  filter: "all",
  query: "",
  adminReturn: false,
  historyFilter: "all",
  historyRows: []
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
function formatDuration(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n < 0) return "—";
  const total = Math.floor(n / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
}
function resultPenaltyMs(row = {}) {
  for (const value of [row.penaltyMs,row.controlPenaltyMs,row.totalPenaltyMs,row.discardPenaltyMs,row.discardPenaltyTotalMs]) {
    const n=Number(value); if(Number.isFinite(n)&&n>=0)return n;
  }
  return 0;
}
function officialDurationMs(row = {}) {
  for (const value of [row.officialDurationMs,row.adjustedDurationMs,row.officialTimeMs]) {
    const n=Number(value); if(Number.isFinite(n)&&n>=0)return n;
  }
  const real=Number(row.durationMs);return Number.isFinite(real)&&real>=0?real+resultPenaltyMs(row):NaN;
}
function resultName(row = {}) {
  const display = cleanString(row.displayName, 120);
  const username = cleanString(row.username, 40).replace(/^@/, "");
  if (display && username) return `${display} (@${username})`;
  return display || (username ? `@${username}` : "Corredor");
}
function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function searchKey(value) {
  return String(value ?? "").toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
    .m2-cloud-history-btn{border-color:rgba(245,204,121,.40);background:#282313;color:#ffe7a3}
    .m2-cloud-history-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 12px}
    .m2-cloud-history-stat{border:1px solid rgba(255,255,255,.11);border-radius:12px;padding:9px 6px;background:rgba(255,255,255,.035);text-align:center}
    .m2-cloud-history-stat strong{display:block;font-size:1.05rem}.m2-cloud-history-stat span{display:block;margin-top:2px;font-size:.60rem;opacity:.68}
    .m2-cloud-history-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin:9px 0 10px}
    .m2-cloud-history-metric{border:1px solid rgba(255,255,255,.09);border-radius:10px;padding:7px 5px;text-align:center;background:rgba(255,255,255,.025)}
    .m2-cloud-history-metric strong{display:block;font-size:.91rem}.m2-cloud-history-metric span{display:block;font-size:.53rem;opacity:.66;margin-top:2px}
    .m2-cloud-history-best{font-size:.77rem;line-height:1.4;margin:0 0 10px;color:#e8f6df}
    .m2-r4-history-tools{display:flex;align-items:end;justify-content:space-between;gap:10px;margin:0 0 12px;padding:10px;border:1px solid rgba(255,255,255,.09);border-radius:13px;background:rgba(255,255,255,.025)}
    .m2-r4-history-tools label{display:grid;gap:5px;min-width:min(300px,100%);font-size:.57rem;font-weight:900;letter-spacing:.08em;color:#dfe6d9}.m2-r4-history-tools select{width:100%;min-height:42px;box-sizing:border-box;border:1px solid #d7dfc8;border-radius:10px;padding:8px 34px 8px 10px;background:#f7f9ee!important;background-color:#f7f9ee!important;color:#111811!important;-webkit-text-fill-color:#111811!important;opacity:1!important;font:900 .72rem/1 system-ui;appearance:auto;-webkit-appearance:menulist}.m2-r4-history-tools select option{background:#ffffff!important;color:#111811!important;-webkit-text-fill-color:#111811!important}.m2-r4-history-tools span{font-size:.58rem;color:#b4bdb2;text-align:right}
    .m2-cloud-history-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.m2-cloud-history-card-head h3{min-width:0;overflow:hidden;text-overflow:ellipsis}.m2-cloud-history-best strong{color:#f5d48b}
    .m2-cloud-recovery-empty{padding:14px;border:1px dashed rgba(255,255,255,.25);border-radius:10px;opacity:.82}
    @media(max-width:600px){.m2-cloud-history-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.m2-cloud-history-metrics{grid-template-columns:repeat(3,minmax(0,1fr))}.m2-r4-history-tools{align-items:stretch;flex-direction:column}.m2-r4-history-tools span{text-align:left}}
    /* R3A · Centro profesional MIS CARRERAS */
    .m2-cloud-recovery-panel{width:min(1180px,100%);max-height:calc(100dvh - 28px);background:linear-gradient(180deg,#151d14,#0e140d);border-radius:22px;padding:18px}
    .m2-cloud-recovery-head{position:sticky;top:-18px;z-index:3;margin:-18px -18px 14px;padding:18px;background:linear-gradient(180deg,#182217 82%,rgba(24,34,23,.96));border-bottom:1px solid rgba(255,255,255,.09)}
    .m2-r3-head-copy{min-width:0}.m2-r3-head-copy h2{font-size:clamp(1.12rem,3vw,1.55rem);letter-spacing:.02em}.m2-r3-head-copy p{margin:5px 0 0;font-size:.80rem;opacity:.68}
    .m2-r3-head-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
    .m2-r3-head-btn{min-height:42px;border:1px solid rgba(255,255,255,.15);border-radius:11px;padding:8px 12px;background:#283326;color:#f6f4e8;font-weight:900;cursor:pointer}
    .m2-r3-head-btn.is-new{background:#e9eddc;color:#152016;border-color:#e9eddc}.m2-r3-head-btn:disabled{opacity:.5;cursor:not-allowed}
    .m2-r3-summary{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px;margin:0 0 10px}
    .m2-r3-summary[hidden],.m2-r3-filters[hidden]{display:none!important}
    .m2-r3-summary-card{min-width:0;border:1px solid rgba(255,255,255,.10);border-radius:13px;padding:9px 8px;background:rgba(255,255,255,.035);text-align:center}
    .m2-r3-summary-card strong{display:block;font-size:1.12rem;line-height:1}.m2-r3-summary-card span{display:block;margin-top:4px;font-size:.55rem;opacity:.63;letter-spacing:.08em}
    .m2-r3-filters{display:flex;gap:6px;overflow-x:auto;padding:2px 0 12px;scrollbar-width:none}.m2-r3-filters::-webkit-scrollbar{display:none}
    .m2-r3-filter{flex:0 0 auto;min-height:36px;border:1px solid rgba(255,255,255,.13);border-radius:999px;padding:7px 11px;background:rgba(255,255,255,.045);color:#dce4d6;font-size:.68rem;font-weight:900;cursor:pointer}
    .m2-r3-filter.is-active{background:#e8ecd9;color:#162017;border-color:#e8ecd9}
    .m2-cloud-recovery-list.m2-r3-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .m2-cloud-event{position:relative;overflow:hidden;border-radius:16px;padding:14px;background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.025))}
    .m2-cloud-event::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:#69766a}
    .m2-cloud-event[data-status="draft"]::before{background:#8b9189}.m2-cloud-event[data-status="prepared"]::before{background:#c5a65b}.m2-cloud-event[data-status="published"]::before{background:#69a86f}.m2-cloud-event[data-status="live"]::before{background:#d46045}.m2-cloud-event[data-status="finished"]::before{background:#6e8da5}.m2-cloud-event[data-status="archived"]::before{background:#555e56}
    .m2-r3-event-title{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.m2-r3-event-title h3{font-size:1.02rem;line-height:1.15;margin:0;min-width:0;overflow:hidden;text-overflow:ellipsis}
    .m2-cloud-event-status{flex:0 0 auto}.m2-r3-event-id{font-size:.67rem;opacity:.48;margin:5px 0 10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .m2-r3-event-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:0 0 11px}
    .m2-r3-event-metric{border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:7px 4px;text-align:center;background:rgba(0,0,0,.12)}
    .m2-r3-event-metric strong{display:block;font-size:.91rem}.m2-r3-event-metric span{display:block;margin-top:2px;font-size:.49rem;opacity:.58;letter-spacing:.05em}
    .m2-r3-event-footer{display:flex;align-items:center;justify-content:space-between;gap:10px}.m2-r3-event-updated{font-size:.66rem;opacity:.52;min-width:0}
    .m2-cloud-event-open{min-height:42px;flex:0 0 auto;border-radius:10px;padding:9px 13px;background:#e5ead8;color:#111811}.m2-cloud-event-open:disabled{opacity:.55}
    @media(max-width:760px){.m2-cloud-recovery-overlay{padding:0}.m2-cloud-recovery-panel{width:100%;height:100dvh;max-height:100dvh;border:0;border-radius:0;padding:14px}.m2-cloud-recovery-head{top:-14px;margin:-14px -14px 12px;padding:calc(14px + env(safe-area-inset-top)) 14px 12px}.m2-cloud-recovery-list.m2-r3-grid{grid-template-columns:1fr}.m2-r3-summary{grid-template-columns:repeat(3,minmax(0,1fr))}.m2-r3-head-actions .m2-r3-head-btn:not(.is-new){display:none}}
    @media(max-width:480px){.m2-cloud-recovery-panel{padding:12px}.m2-cloud-event-open{width:auto}.m2-cloud-history-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.m2-r3-event-metrics{grid-template-columns:repeat(4,minmax(0,1fr))}.m2-r3-event-footer{align-items:flex-end}}
    .m2-r5-choice{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:4px 0 11px}.m2-r5-choice.is-admin-context{grid-template-columns:repeat(3,minmax(0,1fr))}.m2-r5-choice button{min-width:0;min-height:64px;border:1px solid rgba(255,255,255,.12);border-radius:13px;padding:8px 9px;background:#202b21;color:#eef1e6;text-align:left;display:grid;grid-template-columns:31px minmax(0,1fr);gap:7px;align-items:center;cursor:pointer}.m2-r5-choice button.is-active{background:#edf0df;color:#172018;border-color:#edf0df}.m2-r5-choice-icon{width:31px;height:31px;border-radius:9px;display:grid;place-items:center;background:#101711;font-size:1rem}.m2-r5-choice button.is-active .m2-r5-choice-icon{background:#2f5b39;color:#fff}.m2-r5-choice strong{display:block;font:950 .67rem/1.05 system-ui}.m2-r5-choice small{display:block;margin-top:3px;font:650 .51rem/1.18 system-ui;opacity:.75}.m2-r5-admin-return{border-color:rgba(240,163,84,.52)!important;background:rgba(240,163,84,.10)!important;color:#f7e8c7!important}.m2-r5-admin-return[hidden]{display:none!important}.m2-r5-admin-return .m2-r5-choice-icon{color:#f0a354}.m2-r5-existing-wrap[hidden]{display:none!important}.m2-r5-filterbar{display:grid;grid-template-columns:auto minmax(160px,1fr) minmax(150px,.55fr);gap:8px;align-items:center;margin:8px 0 12px;padding:9px 10px;border:1px solid rgba(255,255,255,.09);border-radius:13px;background:#171f17}.m2-r5-filterbar label{font:900 .57rem/1 system-ui;letter-spacing:.09em;color:#b6c0b3}.m2-r5-filterbar input,.m2-r5-filterbar select{width:100%;min-height:40px;box-sizing:border-box;border:1px solid #d8ddc9;border-radius:10px;padding:8px 10px;background:#f8f5e6!important;color:#101810!important;-webkit-text-fill-color:#101810!important;font:900 .70rem/1 system-ui;color-scheme:light}.m2-r5-filterbar input::placeholder{color:#596258;opacity:1}.m2-r5-filterbar select{padding-right:34px}.m2-r5-result-count{grid-column:2/4;font:750 .54rem/1.2 system-ui;color:#aeb8ad}.m2-r5-event-actions{display:flex;gap:7px;align-items:center}.m2-r5-reuse{min-height:38px;border:1px solid rgba(205,171,92,.32);border-radius:10px;padding:8px 10px;background:rgba(205,171,92,.10);color:#f2ddb0;font:900 .58rem/1 system-ui;cursor:pointer}.m2-r5-reuse:disabled{opacity:.42;cursor:not-allowed}.m2-r5-new-note{padding:12px;border:1px solid rgba(255,255,255,.09);border-radius:13px;background:#141d15;color:#c7d0c4;font:650 .68rem/1.4 system-ui}.m2-r5-new-main{margin-top:10px;width:100%;min-height:48px;border:0;border-radius:13px;background:#edf0df;color:#172018;font:950 .72rem/1 system-ui;cursor:pointer}
    @media(max-width:600px){.m2-r5-choice{grid-template-columns:1fr 1fr}.m2-r5-choice.is-admin-context{grid-template-columns:repeat(3,minmax(0,1fr))}.m2-r5-choice button{min-height:58px;padding:7px;grid-template-columns:27px minmax(0,1fr);gap:5px}.m2-r5-choice-icon{width:27px;height:27px;font-size:.9rem}.m2-r5-choice strong{font-size:.57rem}.m2-r5-choice small{display:none}.m2-r5-filterbar{grid-template-columns:1fr}.m2-r5-filterbar label{grid-column:1}.m2-r5-filterbar input,.m2-r5-filterbar select{font-size:16px!important}.m2-r5-result-count{grid-column:1}.m2-r5-event-actions{width:100%;justify-content:flex-end;flex-wrap:wrap}}
    /* R9D · CARGAR / CREAR CARRERA · responsive PWA profesional. */
    body.m2-cloud-picker-open{overflow:hidden!important;overscroll-behavior:none!important}
    .m2-cloud-recovery-overlay{overflow:hidden;overscroll-behavior:contain}
    .m2-cloud-recovery-panel{overflow-x:hidden!important;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
    .m2-r5-choice button,.m2-r5-filterbar>*{min-width:0}
    @media(max-width:760px){
      .m2-cloud-recovery-panel{padding:12px 12px max(14px,env(safe-area-inset-bottom))}
      .m2-cloud-recovery-head{top:-12px;margin:-12px -12px 10px;padding:calc(12px + env(safe-area-inset-top)) 12px 10px}
      .m2-r5-choice{gap:6px;margin-bottom:9px}
      .m2-r5-choice button{min-height:54px;padding:6px 7px;grid-template-columns:26px minmax(0,1fr);gap:6px;border-radius:12px}
      .m2-r5-choice-icon{width:26px;height:26px;border-radius:8px;font-size:.84rem}
      .m2-r5-choice strong{font-size:.55rem}.m2-r5-choice small{display:none}
      .m2-r5-filterbar{grid-template-columns:minmax(0,1.35fr) minmax(116px,.65fr);gap:6px;padding:8px;margin:7px 0 10px}
      .m2-r5-filterbar label{grid-column:1/-1}.m2-r5-filterbar input,.m2-r5-filterbar select{min-width:0;min-height:44px;font-size:16px!important}
      .m2-r5-result-count{grid-column:1/-1}
      .m2-r3-summary{gap:5px;margin-bottom:8px}.m2-r3-summary-card{padding:8px 4px}
      .m2-cloud-event{padding:11px 10px;border-radius:14px}.m2-r3-event-title h3{font-size:.94rem}
      .m2-r3-event-metrics{gap:4px}.m2-r3-event-metric{padding:6px 3px}
      .m2-cloud-recovery-list{padding-bottom:max(4px,env(safe-area-inset-bottom))}
    }
    @media(max-width:430px){
      .m2-r5-choice.is-admin-context{grid-template-columns:repeat(3,minmax(0,1fr))}
      .m2-r5-choice button{grid-template-columns:1fr;place-items:center;align-content:center;text-align:center;min-height:60px;padding:6px 4px;gap:4px}
      .m2-r5-choice-icon{width:24px;height:24px}.m2-r5-choice strong{font-size:.48rem;line-height:1.08;white-space:normal;text-align:center}
      .m2-r5-filterbar{grid-template-columns:1fr}.m2-r5-filterbar label,.m2-r5-result-count{grid-column:1}
      .m2-r3-summary-card strong{font-size:1rem}.m2-r3-summary-card span{font-size:.49rem;letter-spacing:.05em}
      .m2-r3-event-title{gap:7px}.m2-cloud-event-status{font-size:.63rem;padding:3px 6px}
      .m2-r3-event-metric span{font-size:.44rem;letter-spacing:.02em}
      .m2-r3-event-footer{display:grid;grid-template-columns:1fr;gap:7px;align-items:stretch}
      .m2-r5-event-actions{display:grid;grid-template-columns:1fr 1fr;width:100%;gap:6px}
      .m2-cloud-event-open,.m2-r5-reuse{width:100%;min-width:0;min-height:40px;padding:8px 6px}
      .m2-r3-event-updated{order:2;text-align:right}
    }
    /* R9E · buscar / filtrar: más ancho útil y un punto menos de altura. */
    .m2-r5-filterbar{width:100%;max-width:none;box-sizing:border-box}
    .m2-r5-filterbar input,.m2-r5-filterbar select{min-height:34px;height:34px;padding-top:4px;padding-bottom:4px}
    @media(max-width:760px){
      .m2-r5-filterbar{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px;padding:6px 4px;margin:6px 0 9px;border-left:0;border-right:0;border-radius:9px}
      .m2-r5-filterbar label,.m2-r5-result-count{grid-column:1/-1}
      .m2-r5-filterbar input,.m2-r5-filterbar select{width:100%;min-height:36px!important;height:36px!important;padding:4px 8px;font-size:16px!important}
    }
    @media(max-width:430px){
      .m2-r5-filterbar{grid-template-columns:1fr;padding-left:2px;padding-right:2px}
      .m2-r5-filterbar label,.m2-r5-result-count{grid-column:1}
    }
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
      <button type="button" id="m2OrganizerHistoryOpen" class="m2-cloud-recovery-btn m2-cloud-history-btn">📚 HISTÓRICO DEL ORGANIZADOR</button>
      <span id="m2CloudRecoveryMini" style="font-size:.85rem;opacity:.78">Firestore · eventos e histórico</span>
    `;
    const nav = step.querySelector(".nav-row");
    if (nav) nav.insertAdjacentElement("beforebegin", row);
    else step.appendChild(row);
    row.querySelector("#m2CloudRecoveryOpen")?.addEventListener("click", openCloudPicker);
    row.querySelector("#m2OrganizerHistoryOpen")?.addEventListener("click", openHistoryPicker);
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
        <div class="m2-r3-head-copy">
          <h2 id="m2CloudRecoveryTitle" style="margin:0">CARGAR / CREAR CARRERA</h2>
          <p id="m2CloudRecoverySubtitle">Elige cómo quieres empezar</p>
        </div>
        <div class="m2-r3-head-actions">
          <button type="button" id="m2R3Refresh" class="m2-r3-head-btn">↻ ACTUALIZAR</button>
          <button type="button" class="m2-cloud-recovery-close" aria-label="Cerrar">×</button>
        </div>
      </div>
      <div class="m2-r5-choice" role="tablist" aria-label="Opciones de carrera">
        <button type="button" class="is-active" data-r5-race-choice="existing" role="tab" aria-selected="true"><span class="m2-r5-choice-icon">☁</span><span><strong>CARRERA EXISTENTE</strong><small>Cargar o reutilizar una carrera guardada</small></span></button>
        <button type="button" data-r5-race-choice="new" role="tab" aria-selected="false"><span class="m2-r5-choice-icon">＋</span><span><strong>NUEVA DESDE CERO</strong><small>Crear un borrador completamente vacío</small></span></button>
        <button type="button" class="m2-r5-admin-return" data-r8-admin-return hidden><span class="m2-r5-choice-icon">‹</span><span><strong>VOLVER A ADMIN</strong><small>Regresar a Supervisión global</small></span></button>
      </div>
      <div class="m2-r5-existing-wrap" id="m2R5ExistingWrap">
        <div id="m2R3RaceSummary" class="m2-r3-summary"></div>
        <div id="m2R3RaceFilters" class="m2-r3-filters"></div>
        <div id="m2CloudRecoveryList" class="m2-cloud-recovery-list"></div>
      </div>
      <div id="m2R5NewWrap" hidden>
        <div class="m2-r5-new-note"><strong>NUEVA CARRERA DESDE CERO</strong><br>Se creará un BORRADOR nuevo con otro identificador. La carrera que tengas abierta permanecerá guardada.</div>
        <button type="button" id="m2R5CreateFromZero" class="m2-r5-new-main">CREAR CARRERA NUEVA</button>
      </div>
    </section>
  `;
  const choose = mode => {
    const existing = mode !== "new";
    overlay.querySelector("#m2R5ExistingWrap")?.toggleAttribute("hidden", !existing);
    overlay.querySelector("#m2R5NewWrap")?.toggleAttribute("hidden", existing);
    overlay.querySelectorAll("[data-r5-race-choice]").forEach(button => {
      const active = button.dataset.r5RaceChoice === (existing ? "existing" : "new");
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
  };
  overlay.querySelectorAll("[data-r5-race-choice]").forEach(button => button.addEventListener("click", () => choose(button.dataset.r5RaceChoice)));
  overlay.querySelector("[data-r8-admin-return]")?.addEventListener("click", () => {
    closeOverlay();
    globalThis.dispatchEvent(new CustomEvent("militopo:r8-return-admin", { detail:{ tab:"events" } }));
  });
  overlay.querySelector("#m2R5CreateFromZero")?.addEventListener("click", () => {
    globalThis.dispatchEvent(new CustomEvent("militopo:r3-new-race"));
  });
  overlay.querySelector(".m2-cloud-recovery-close")?.addEventListener("click", closeOverlay);
  overlay.querySelector("#m2R3Refresh")?.addEventListener("click", () => {
    if (state.overlayMode === "history") openHistoryPicker();
    else openCloudPicker(false, { returnToAdmin:state.adminReturn });
  });
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
  document.body.classList.remove("m2-cloud-picker-open");
  /* R8E: el retorno a Administración es contextual. Al cerrar el centro
     nunca debe quedarse visible al abrir CARGAR CARRERA desde la pantalla principal. */
  state.adminReturn = false;
  state.overlay.querySelector(".m2-r5-choice")?.classList.remove("is-admin-context");
  const adminReturn = state.overlay.querySelector("[data-r8-admin-return]");
  if (adminReturn) adminReturn.hidden = true;
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
    updatedAt: data.updatedAt || data.structureUpdatedAt || data.createdAt || null,
    finishedAt: data.finishedAt || null,
    archivedAt: data.archivedAt || null,
    resultCount: Math.max(0, Math.trunc(Number(data.resultCount) || 0)),
    resultFinishedCount: Math.max(0, Math.trunc(Number(data.resultFinishedCount) || 0)),
    resultIncompleteCount: Math.max(0, Math.trunc(Number(data.resultIncompleteCount) || 0)),
    resultNotStartedCount: Math.max(0, Math.trunc(Number(data.resultNotStartedCount) || 0)),
    checkpointSyncedCount: Math.max(0, Math.trunc(Number(data.checkpointSyncedCount) || 0)),
    courseSyncedCount: Math.max(0, Math.trunc(Number(data.courseSyncedCount) || 0))
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
  if (!canManage()) throw new Error("Necesitas una cuenta de ORGANIZADOR o SÚPER ADMINISTRADOR verificada.");
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
  const summary = document.getElementById("m2R3RaceSummary");
  const filters = document.getElementById("m2R3RaceFilters");
  const statuses = ["draft","prepared","published","live","finished","archived"];
  const counts = Object.fromEntries(statuses.map(key => [key, 0]));
  rows.forEach(row => { const key = String(row.status || "draft"); if (key in counts) counts[key] += 1; });
  if (summary) {
    summary.hidden = false;
    summary.innerHTML = [
      [rows.length,"TOTAL"],[counts.draft,"BORRADOR"],[counts.prepared,"PREPARADO"],
      [counts.published,"PUBLICADO"],[counts.live,"EN DIRECTO"],[counts.finished + counts.archived,"CERRADAS"]
    ].map(([value,label]) => `<div class="m2-r3-summary-card"><strong>${value}</strong><span>${label}</span></div>`).join("");
  }
  const filterDefs = [
    ["all","TODAS"],["draft","BORRADOR"],["prepared","PREPARADO"],["published","PUBLICADO"],
    ["live","EN DIRECTO"],["finished","FINALIZADO"],["archived","ARCHIVADO"]
  ];
  const queryKey = searchKey(state.query);
  const byStatus = state.filter === "all" ? rows : rows.filter(row => String(row.status || "draft") === state.filter);
  const visible = !queryKey ? byStatus : byStatus.filter(row => {
    const haystack = [row.eventName,row.eventId,statusLabel(row.status),row.ownerUid].map(searchKey).join(" ");
    return haystack.includes(queryKey);
  });
  if (filters) {
    filters.hidden = false;
    const options = filterDefs.map(([key,label]) => `<option value="${key}"${state.filter === key ? " selected" : ""}>${label} · ${key === "all" ? rows.length : (counts[key] || 0)}</option>`).join("");
    filters.innerHTML = `<div class="m2-r5-filterbar"><label for="m2R5Search">BUSCAR / FILTRAR</label><input id="m2R5Search" type="search" value="${esc(state.query)}" placeholder="Nombre o ID de carrera" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Buscar carreras"><select id="m2R5FilterSelect" aria-label="Filtrar carreras por estado">${options}</select><span class="m2-r5-result-count">${visible.length} de ${rows.length} carrera${rows.length === 1 ? "" : "s"}</span></div>`;
    filters.querySelector("#m2R5FilterSelect")?.addEventListener("change", event => {
      state.filter = event.target.value || "all";
      renderEventList(rows);
    });
    filters.querySelector("#m2R5Search")?.addEventListener("input", event => {
      state.query = event.target.value || "";
      const caret = event.target.selectionStart ?? state.query.length;
      renderEventList(rows);
      const next = document.getElementById("m2R5Search");
      if (next) { next.focus({preventScroll:true}); try { next.setSelectionRange(caret,caret); } catch (_) {} }
    });
  }
  state.list.classList.add("m2-r3-grid");
  if (!visible.length) {
    state.list.innerHTML = `<div class="m2-cloud-recovery-empty">No hay carreras que coincidan con la búsqueda o el filtro.</div>`;
    return;
  }
  state.list.innerHTML = visible.map(row => {
    const archived = row.status === "archived";
    const own = String(row.ownerUid || "") === String(state.auth?.uid || "");
    const routeCount = Math.max(Number(row.courseSyncedCount || 0), 0);
    const pointCount = Math.max(Number(row.checkpointSyncedCount || 0), Number(row.controlCount || 0) + (row.controlCount ? 2 : 0));
    return `
      <article class="m2-cloud-event${archived ? " archived" : ""}" data-status="${esc(row.status || "draft")}">
        <div class="m2-r3-event-title">
          <h3>${esc(row.eventName)}</h3>
          <span class="m2-cloud-event-status">${esc(statusLabel(row.status))}</span>
        </div>
        <div class="m2-r3-event-id">${esc(row.eventId)}${isSuperAdmin() ? ` · ${own ? "PROPIO" : "OTRO ORGANIZADOR"}` : ""}</div>
        <div class="m2-r3-event-metrics">
          <div class="m2-r3-event-metric"><strong>${row.participantCount}</strong><span>PARTICIPANTES</span></div>
          <div class="m2-r3-event-metric"><strong>${row.controlCount}</strong><span>BALIZAS</span></div>
          <div class="m2-r3-event-metric"><strong>${routeCount || "—"}</strong><span>RECORRIDOS</span></div>
          <div class="m2-r3-event-metric is-route-controls"><strong>${Math.max(0, Number(row.controlsPerRoute || 0)) || "—"}</strong><span>BALIZAS POR RECORRIDO</span></div>
        </div>
        <div class="m2-r3-event-footer">
          <div class="m2-r3-event-updated">Actualizada · ${esc(formatDate(row.updatedAt))}</div>
          <div class="m2-r5-event-actions">
            <button type="button" class="m2-r5-reuse" data-reuse-event="${esc(row.eventId)}" ${row.status === "live" ? 'disabled title="No se puede reutilizar mientras esté EN DIRECTO"' : ""}>REUTILIZAR</button>
            <button type="button" class="m2-cloud-event-open" data-event-id="${esc(row.eventId)}">${archived ? "ABRIR" : "CARGAR"}</button>
          </div>
        </div>
      </article>`;
  }).join("");
  state.list.querySelectorAll(".m2-cloud-event-open").forEach(button => {
    button.addEventListener("click", () => recoverEvent(button.dataset.eventId));
  });
  state.list.querySelectorAll("[data-reuse-event]").forEach(button => {
    button.addEventListener("click", () => recoverEvent(button.dataset.reuseEvent, { reuse:true }));
  });
}
async function loadHistorySummary(row) {
  const { firestore } = await services();
  const snap = await getDocs(collection(firestore, "events", row.eventId, "results"));
  const results = snap.docs.map(d => ({ id:d.id, ...(d.data() || {}) }));
  const counts = { total: results.length, finished:0, incomplete:0, notStarted:0 };
  let best = null;
  for (const result of results) {
    const status = String(result.status || "not_started").toLowerCase();
    if (status === "finished") {
      counts.finished += 1;
      const durationMs = officialDurationMs(result);
      if (Number.isFinite(durationMs) && durationMs >= 0 && (!best || durationMs < best.durationMs)) {
        best = { durationMs, name: resultName(result), routeId: cleanString(result.routeId, 40) };
      }
    } else if (status === "incomplete") counts.incomplete += 1;
    else counts.notStarted += 1;
  }
  if (!counts.total && row.resultCount) {
    counts.total = row.resultCount; counts.finished = row.resultFinishedCount;
    counts.incomplete = row.resultIncompleteCount; counts.notStarted = row.resultNotStartedCount;
  }
  return { ...row, counts, best };
}

async function loadHistoryRows() {
  const rows = (await loadEventList()).filter(row => ["finished","archived"].includes(String(row.status || "").toLowerCase()));
  const out = [];
  const concurrency = 6;
  for (let offset = 0; offset < rows.length; offset += concurrency) {
    const group = rows.slice(offset, offset + concurrency);
    const summaries = await Promise.all(group.map(row => loadHistorySummary(row).catch(error => {
      console.warn("[MILITOPO H7] resumen", row.eventId, error);
      return { ...row, counts:{ total:row.resultCount, finished:row.resultFinishedCount, incomplete:row.resultIncompleteCount, notStarted:row.resultNotStartedCount }, best:null, summaryError:true };
    })));
    out.push(...summaries);
  }
  out.sort((a,b) => timestampMs(b.archivedAt || b.finishedAt || b.updatedAt) - timestampMs(a.archivedAt || a.finishedAt || a.updatedAt));
  return out;
}

function renderHistoryList(rows = state.historyRows) {
  if (!state.list) return;
  const source = Array.isArray(rows) ? rows : [];
  const filtered = source.filter(row => state.historyFilter === "all" || String(row.status || "").toLowerCase() === state.historyFilter);
  if (!source.length) {
    state.list.innerHTML = `<div class="m2-cloud-recovery-empty">Todavía no hay carreras FINALIZADAS o ARCHIVADAS para esta cuenta.</div>`;
    return;
  }
  const aggregate = filtered.reduce((acc,row) => {
    acc.results += Number(row.counts?.total || 0);
    acc.finished += Number(row.counts?.finished || 0);
    acc.incomplete += Number(row.counts?.incomplete || 0);
    acc.notStarted += Number(row.counts?.notStarted || 0);
    return acc;
  }, { results:0, finished:0, incomplete:0, notStarted:0 });
  state.list.innerHTML = `
    <div class="m2-r4-history-tools">
      <label>FILTRAR HISTÓRICO
        <select id="m2R4HistoryFilter" aria-label="Filtrar histórico">
          <option value="all"${state.historyFilter === "all" ? " selected" : ""}>TODAS</option>
          <option value="finished"${state.historyFilter === "finished" ? " selected" : ""}>FINALIZADAS</option>
          <option value="archived"${state.historyFilter === "archived" ? " selected" : ""}>ARCHIVADAS</option>
        </select>
      </label>
      <span>${filtered.length} carrera${filtered.length === 1 ? "" : "s"} · más recientes primero</span>
    </div>
    <div class="m2-cloud-history-summary">
      <div class="m2-cloud-history-stat"><strong>${filtered.length}</strong><span>CARRERAS</span></div>
      <div class="m2-cloud-history-stat"><strong>${aggregate.finished}</strong><span>CLASIFICADOS</span></div>
      <div class="m2-cloud-history-stat"><strong>${aggregate.incomplete}</strong><span>INCOMPLETOS</span></div>
      <div class="m2-cloud-history-stat"><strong>${aggregate.notStarted}</strong><span>NO SALIERON</span></div>
    </div>` + (filtered.length ? filtered.map(row => {
      const counts = row.counts || { total:0, finished:0, incomplete:0, notStarted:0 };
      const date = row.archivedAt || row.finishedAt || row.updatedAt;
      const best = row.best ? `<div class="m2-cloud-history-best">MEJOR TIEMPO OFICIAL · <strong>${esc(formatDuration(row.best.durationMs))}</strong> · ${esc(row.best.name)}${row.best.routeId ? ` · ${esc(row.best.routeId)}` : ""}</div>` : `<div class="m2-cloud-history-best">Sin tiempo oficial finalizado disponible.</div>`;
      return `
        <article class="m2-cloud-event${row.status === "archived" ? " archived" : ""}" data-status="${esc(row.status)}">
          <div class="m2-cloud-history-card-head"><h3>${esc(row.eventName)}</h3><span class="m2-cloud-event-status">${esc(statusLabel(row.status))}</span></div>
          <div class="m2-cloud-event-meta"><span>${esc(row.eventId)}</span><span>${esc(formatDate(date))}</span></div>
          <div class="m2-cloud-history-metrics">
            <div class="m2-cloud-history-metric"><strong>${counts.total}</strong><span>RESULTADOS</span></div>
            <div class="m2-cloud-history-metric"><strong>${counts.finished}</strong><span>FINALIZADOS</span></div>
            <div class="m2-cloud-history-metric"><strong>${counts.incomplete}</strong><span>INCOMPLETOS</span></div>
            <div class="m2-cloud-history-metric"><strong>${counts.notStarted}</strong><span>NO SALIERON</span></div>
            <div class="m2-cloud-history-metric"><strong>${row.participantCount}</strong><span>PLAZAS</span></div>
          </div>
          ${best}
          <button type="button" class="m2-cloud-event-open m2-history-open-results" data-event-id="${esc(row.eventId)}">ABRIR RESULTADOS Y CLASIFICACIÓN</button>
        </article>`;
    }).join("") : `<div class="m2-cloud-recovery-empty">No hay carreras con este estado.</div>`);
  state.list.querySelector("#m2R4HistoryFilter")?.addEventListener("change", event => { state.historyFilter = event.target.value || "all"; renderHistoryList(); });
  state.list.querySelectorAll(".m2-history-open-results").forEach(button => {
    button.addEventListener("click", () => recoverEvent(button.dataset.eventId, { openResults:true }));
  });
}

async function openHistoryPicker() {
  const launcher = document.getElementById("m2OrganizerHistoryOpen");
  if (state.busy) return;
  ensureOverlay();
  state.overlayMode = "history";
  state.historyFilter = "all";
  const title = document.getElementById("m2CloudRecoveryTitle");
  const subtitle = document.getElementById("m2CloudRecoverySubtitle");
  if (title) title.textContent = "HISTÓRICO DEL ORGANIZADOR";
  if (subtitle) subtitle.textContent = "Carreras finalizadas y archivadas · resultados y clasificación oficial.";
  state.overlay?.querySelector(".m2-r5-choice")?.setAttribute("hidden", "");
  document.getElementById("m2R5ExistingWrap")?.removeAttribute("hidden");
  document.getElementById("m2R5NewWrap")?.setAttribute("hidden", "");
  document.getElementById("m2R3RaceSummary")?.setAttribute("hidden", "");
  document.getElementById("m2R3RaceFilters")?.setAttribute("hidden", "");
  const newRaceButton = document.getElementById("m2R3NewRace"); if (newRaceButton) newRaceButton.hidden = true;
  state.list?.classList.remove("m2-r3-grid");
  state.overlay.hidden = false; state.overlay.style.display = "grid";
  document.body.classList.add("m2-cloud-picker-open");
  if (state.list) state.list.innerHTML = `<div class="m2-cloud-recovery-empty">Construyendo histórico y resultados…</div>`;
  if (launcher) launcher.disabled = true;
  try {
    const rows = await loadHistoryRows();
    state.historyRows = rows;
    renderHistoryList(rows);
    paintStatus(`📚 Histórico: ${rows.length} carrera${rows.length === 1 ? "" : "s"} finalizada${rows.length === 1 ? "" : "s"}/archivada${rows.length === 1 ? "" : "s"}.`, "ok");
  } catch (error) {
    console.error("[MILITOPO H7] histórico", error);
    if (state.list) state.list.innerHTML = `<div class="m2-cloud-recovery-empty">⚠️ ${esc(error?.message || "No se pudo cargar el histórico.")}</div>`;
    paintStatus("⚠️ No se pudo cargar el histórico del organizador.", "warn");
  } finally {
    if (launcher) launcher.disabled = false;
  }
}

async function openCloudPicker(resetFilter = true, options = {}) {
  const launcher = document.getElementById("m2CloudRecoveryOpen");
  if (state.busy) return;
  ensureOverlay();
  if (resetFilter) { state.filter = "all"; state.query = ""; }
  state.adminReturn = options?.returnToAdmin === true;
  if (typeof options?.query === "string") state.query = options.query;
  state.overlayMode = "events";
  const title = document.getElementById("m2CloudRecoveryTitle");
  const subtitle = document.getElementById("m2CloudRecoverySubtitle");
  if (title) title.textContent = "CARGAR / CREAR CARRERA";
  if (subtitle) subtitle.textContent = "Abre una carrera, reutiliza su diseño o crea una nueva desde cero.";
  const choice = state.overlay?.querySelector(".m2-r5-choice");
  choice?.removeAttribute("hidden");
  choice?.classList.toggle("is-admin-context", state.adminReturn);
  const adminReturn = state.overlay?.querySelector("[data-r8-admin-return]");
  if (adminReturn) adminReturn.hidden = !state.adminReturn;
  document.getElementById("m2R5ExistingWrap")?.removeAttribute("hidden");
  document.getElementById("m2R5NewWrap")?.setAttribute("hidden", "");
  state.overlay?.querySelectorAll("[data-r5-race-choice]").forEach(button=>{const active=button.dataset.r5RaceChoice==="existing";button.classList.toggle("is-active",active);button.setAttribute("aria-selected",String(active))});
  const summary = document.getElementById("m2R3RaceSummary"); if (summary) summary.hidden = false;
  const filters = document.getElementById("m2R3RaceFilters"); if (filters) filters.hidden = false;
  const newRaceButton = document.getElementById("m2R3NewRace"); if (newRaceButton) newRaceButton.hidden = false;
  state.list?.classList.add("m2-r3-grid");
  state.overlay.hidden = false;
  state.overlay.style.display = "grid";
  document.body.classList.add("m2-cloud-picker-open");
  if (state.list) state.list.innerHTML = `<div class="m2-cloud-recovery-empty">Consultando tus carreras en Firestore…</div>`;
  if (launcher) launcher.disabled = true;
  try {
    const rows = await loadEventList();
    renderEventList(rows);
    paintStatus(`☁️ ${rows.length} carrera${rows.length === 1 ? "" : "s"} disponible${rows.length === 1 ? "" : "s"}.`, "ok");
  } catch (error) {
    console.error("[MILITOPO R3A] list", error);
    if (state.list) state.list.innerHTML = `<div class="m2-cloud-recovery-empty">⚠️ ${esc(error?.message || "No se pudo consultar Firestore.")}</div>`;
    paintStatus("⚠️ No se pudo consultar la lista de carreras. El guardado local no se ha tocado.", "warn");
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

async function recoverEvent(eventId, options = {}) {
  if (state.busy) return;
  const row = state.events.find(item => item.eventId === eventId);
  if (!row) return;
  const openResults = options?.openResults === true;
  const reuse = options?.reuse === true;
  state.openResultsAfterRecover = openResults ? eventId : "";
  state.reuseAfterRecover = reuse ? eventId : "";
  const message = reuse
    ? `Se creará una CARRERA NUEVA usando el diseño de “${row.eventName}”.

Se copiarán configuración, balizas y recorridos. NO se copiarán participantes, invitaciones, tiempos ni resultados. La nueva carrera quedará en BORRADOR.

¿Continuar?`
    : openResults
      ? `Se va a abrir “${row.eventName}” y después RESULTADOS Y CLASIFICACIÓN.

¿Continuar?`
      : `Se va a abrir “${row.eventName}” (${row.eventId}) desde Firestore.

MILITOPO guardará primero una copia duradera del evento que tengas abierto en este dispositivo. Después cargará la configuración, balizas y recorridos de la nube.

¿Continuar?`;
  const ok = await globalThis.MILITOPO_CONFIRM(message, {
    title: reuse ? "REUTILIZAR CARRERA" : "ABRIR CARRERA",
    confirmText: reuse ? "CREAR COPIA" : "CONTINUAR"
  });
  if (!ok) { state.openResultsAfterRecover = ""; state.reuseAfterRecover = ""; return; }

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
  const historyButton = document.getElementById("m2OrganizerHistoryOpen");
  if (button) button.disabled = !canManage();
  if (historyButton) historyButton.disabled = !canManage();
  if (!canManage()) paintStatus("🔒 Recuperación en nube disponible para ORGANIZADOR o SÚPER ADMINISTRADOR con correo verificado.", "warn");
}
function onApplied(event) {
  const detail = event?.detail || {};
  if (detail.ok) {
    const eventId = cleanString(detail.eventId, 120);
    paintStatus(`✅ Evento recuperado desde Firestore · ${eventId}`, "ok");
    if (state.reuseAfterRecover && state.reuseAfterRecover === eventId) {
      state.reuseAfterRecover = "";
      setTimeout(async () => {
        try {
          const ok = await globalThis.reuseCurrentRaceAsNew?.();
          if (ok === true) {
            closeOverlay();
            paintStatus("✅ Diseño reutilizado en una carrera nueva · BORRADOR", "ok");
            globalThis.dispatchEvent(new CustomEvent("militopo:r5-reuse-complete"));
          }
        } catch (error) {
          console.error("[MILITOPO reutilizar carrera]", error);
          paintStatus(`⚠️ ${cleanString(error?.message || "No se pudo reutilizar la carrera.", 300)}`, "warn");
        }
      }, 220);
    }
    if (state.openResultsAfterRecover && state.openResultsAfterRecover === eventId) {
      state.openResultsAfterRecover = "";
      // R4F: después de recuperar desde HISTÓRICO, abrir directamente el
      // módulo profesional de RESULTADOS Y CLASIFICACIÓN del shell.
      setTimeout(() => {
        globalThis.dispatchEvent(new CustomEvent("militopo:r4-open-results-after-load", { detail:{ eventId } }));
      }, 180);
    }
  } else {
    paintStatus(`⚠️ ${cleanString(detail.error || "No se pudo aplicar el evento descargado.", 300)}`, "warn");
  }
}

globalThis.MILITOPO_V2_ORGANIZER_CENTER = Object.freeze({
  open: (options = {}) => openCloudPicker(true, options),
  refresh: () => openCloudPicker(false, { returnToAdmin:state.adminReturn }),
  close: closeOverlay
});

function init() {
  ensureLauncher();
  ensureOverlay();
  globalThis.addEventListener("militopo:v2-auth-ready", onAuthReady);
  globalThis.addEventListener("militopo:v2-cloud-event-applied", onApplied);
  globalThis.addEventListener("militopo:v2-event-status-changed", () => {
    if (state.overlayMode === "events" && state.overlay && !state.overlay.hidden) {
      setTimeout(() => openCloudPicker(false, { returnToAdmin:state.adminReturn }), 180);
    }
  });
  globalThis.addEventListener("online", () => {
    if (canManage()) paintStatus("☁️ Recuperación nube preparada.", "ok");
  });
  globalThis.addEventListener("offline", () => paintStatus("📴 Sin conexión: los eventos locales siguen disponibles.", "warn"));
  if (globalThis.MILITOPO_V2_AUTH) onAuthReady({ detail: globalThis.MILITOPO_V2_AUTH });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
