/* MILITOPO V2 · Fase D3 · guardia del área Organizador.
   La UI se bloquea para runner; Firestore Rules siguen siendo la autoridad real. */
import "../bootstrap.js";

const ALLOWED = new Set(["organizer", "super_admin"]);
const state = { auth: globalThis.MILITOPO_V2_AUTH || null, overlay: null };

function roleOf(auth = state.auth) {
  const role = String(auth?.role || "runner");
  return ["runner", "organizer", "super_admin"].includes(role) ? role : "runner";
}
function allowed(auth = state.auth) {
  return Boolean(auth?.uid && auth?.emailVerified && ALLOWED.has(roleOf(auth)));
}
function ensureStyle() {
  if (document.getElementById("m2OrganizerGuardStyle")) return;
  const style = document.createElement("style");
  style.id = "m2OrganizerGuardStyle";
  style.textContent = `
    .m2-organizer-guard{position:fixed;inset:0;z-index:2147482500;display:grid;place-items:center;padding:18px;background:rgba(5,9,5,.96);color:#fff}
    .m2-organizer-guard[hidden]{display:none!important}
    .m2-organizer-guard-card{width:min(520px,100%);border:1px solid rgba(245,204,121,.32);border-radius:18px;background:#10170e;padding:20px;text-align:center}
    .m2-organizer-guard-card h2{margin:0 0 8px;color:#f5d18b}
    .m2-organizer-guard-card p{margin:0 0 16px;line-height:1.5;opacity:.86}
    .m2-organizer-guard-card a{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 16px;border-radius:11px;background:#e7d18f;color:#11170f;font-weight:900;text-decoration:none}
  `;
  document.head.appendChild(style);
}
function ensureOverlay() {
  ensureStyle();
  if (state.overlay?.isConnected) return state.overlay;
  const overlay = document.createElement("div");
  overlay.id = "m2OrganizerGuard";
  overlay.className = "m2-organizer-guard";
  overlay.hidden = true;
  overlay.innerHTML = `
    <section class="m2-organizer-guard-card" role="alertdialog" aria-modal="true" aria-labelledby="m2OrganizerGuardTitle">
      <h2 id="m2OrganizerGuardTitle">Área Organizador restringida</h2>
      <p>Esta sección requiere una cuenta verificada con rol <strong>organizer</strong> o <strong>super_admin</strong>.</p>
      <a href="../">VOLVER A MILITOPO</a>
    </section>`;
  document.body.appendChild(overlay);
  state.overlay = overlay;
  return overlay;
}
function apply(auth) {
  state.auth = auth || globalThis.MILITOPO_V2_AUTH || null;
  const overlay = ensureOverlay();
  if (!state.auth?.uid) {
    overlay.hidden = true; // auth-ui se ocupa del usuario no autenticado.
    return;
  }
  overlay.hidden = allowed(state.auth);
  document.documentElement.dataset.m2OrganizerAccess = allowed(state.auth) ? "allowed" : "denied";
}
function init() {
  ensureOverlay();
  globalThis.addEventListener("militopo:v2-auth-ready", event => apply(event?.detail));
  if (globalThis.MILITOPO_V2_AUTH) apply(globalThis.MILITOPO_V2_AUTH);
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
