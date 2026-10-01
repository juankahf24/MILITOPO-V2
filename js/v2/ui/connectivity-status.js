/* MILITOPO V2 · I6 · Estado profesional de conexión y sincronización.
   Unifica online/offline, reconexión y colas locales sin mostrar errores técnicos. */
(() => {
  "use strict";
  const VERSION = "v2-j1a-connectivity-no-spam-20261001";
  const state = {
    online: navigator.onLine !== false,
    reconnecting: false,
    trackPending: 0,
    controlPending: 0,
    trackSyncing: false,
    controlSyncing: false,
    raceActive: false,
    lastMode: "",
    hideTimer: null,
    reconnectTimer: null,
    root: null
  };

  function activeRaceFromStorage() {
    try {
      const s = JSON.parse(localStorage.getItem("militopo_v2_active_race_v3") || "null");
      const st = String(s?.participant?.status || s?.status || "").toLowerCase();
      return Boolean(s?.eventId && s?.runId && ["racing", "started"].includes(st));
    } catch (_) { return false; }
  }

  function installStyle() {
    if (document.getElementById("m2ConnectivityStyle")) return;
    const style = document.createElement("style");
    style.id = "m2ConnectivityStyle";
    style.textContent = `
      #m2ConnectivityHud{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom) + 14px);z-index:100300;width:min(92vw,480px);transform:translate(-50%,18px);opacity:0;pointer-events:none;transition:opacity .28s ease,transform .32s cubic-bezier(.2,.8,.2,1);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      #m2ConnectivityHud.show{opacity:1;transform:translate(-50%,0)}
      .m2conn-card{display:flex;align-items:center;gap:11px;min-height:52px;padding:10px 13px;border-radius:18px;background:rgba(9,18,13,.92);border:1px solid rgba(255,255,255,.10);box-shadow:0 14px 38px rgba(0,0,0,.32);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);color:#f4f0e5}
      .m2conn-icon{position:relative;flex:0 0 28px;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:rgba(133,205,117,.12);border:1px solid rgba(133,205,117,.28)}
      .m2conn-dot{width:8px;height:8px;border-radius:50%;background:#8ed27c;box-shadow:0 0 0 5px rgba(142,210,124,.10),0 0 16px rgba(142,210,124,.25)}
      .m2conn-body{min-width:0;flex:1}.m2conn-title{font-size:.72rem;font-weight:900;letter-spacing:.10em;text-transform:uppercase;color:#f8f3e8}.m2conn-sub{margin-top:2px;font-size:.67rem;line-height:1.3;color:#aeb9b0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .m2conn-badge{flex:0 0 auto;min-width:28px;height:28px;padding:0 8px;border-radius:999px;display:grid;place-items:center;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);font-size:.65rem;font-weight:900;color:#dfe6df}
      #m2ConnectivityHud[data-mode="offline"] .m2conn-card{border-color:rgba(236,184,94,.25);background:rgba(28,22,11,.94)}
      #m2ConnectivityHud[data-mode="offline"] .m2conn-icon{background:rgba(236,184,94,.12);border-color:rgba(236,184,94,.28)}
      #m2ConnectivityHud[data-mode="offline"] .m2conn-dot{background:#e8b95f;box-shadow:0 0 0 5px rgba(232,185,95,.10),0 0 16px rgba(232,185,95,.22)}
      #m2ConnectivityHud[data-mode="syncing"] .m2conn-dot,#m2ConnectivityHud[data-mode="reconnecting"] .m2conn-dot{background:#e2c46e;box-shadow:0 0 0 5px rgba(226,196,110,.10);animation:m2ConnPulse 1s ease-in-out infinite}
      #m2ConnectivityHud[data-mode="pending"] .m2conn-dot{background:#e6a85e;box-shadow:0 0 0 5px rgba(230,168,94,.10)}
      @keyframes m2ConnPulse{50%{opacity:.35;transform:scale(.72)}}
      @media(max-width:520px){#m2ConnectivityHud{bottom:calc(env(safe-area-inset-bottom) + 10px);width:calc(100vw - 20px)}.m2conn-card{border-radius:16px;padding:9px 11px}.m2conn-sub{font-size:.63rem}}
      @media(prefers-reduced-motion:reduce){#m2ConnectivityHud,.m2conn-dot{transition:none!important;animation:none!important}}
    `;
    document.head.appendChild(style);
  }

  function ensureRoot() {
    if (state.root?.isConnected) return state.root;
    installStyle();
    const root = document.createElement("aside");
    root.id = "m2ConnectivityHud";
    root.setAttribute("aria-live", "polite");
    root.setAttribute("aria-atomic", "true");
    root.innerHTML = `<div class="m2conn-card"><div class="m2conn-icon"><span class="m2conn-dot"></span></div><div class="m2conn-body"><div class="m2conn-title">CONECTADO</div><div class="m2conn-sub">MILITOPO está al día.</div></div><div class="m2conn-badge" hidden>0</div></div>`;
    document.body.appendChild(root);
    state.root = root;
    return root;
  }

  function pendingTotal() { return Math.max(0, state.controlPending) + Math.max(0, state.trackPending); }
  function pendingText() {
    const bits = [];
    if (state.controlPending > 0) bits.push(`${state.controlPending} control${state.controlPending === 1 ? "" : "es"}`);
    if (state.trackPending > 0) bits.push(`${state.trackPending} punto${state.trackPending === 1 ? "" : "s"} GPS`);
    return bits.join(" · ");
  }

  function showFor(ms = 2600) {
    const root = ensureRoot();
    root.classList.add("show");
    if (state.hideTimer) clearTimeout(state.hideTimer);
    state.hideTimer = null;
    if (ms > 0) state.hideTimer = setTimeout(() => root.classList.remove("show"), ms);
  }

  function render({ force = false } = {}) {
    const root = ensureRoot();
    const title = root.querySelector(".m2conn-title");
    const sub = root.querySelector(".m2conn-sub");
    const badge = root.querySelector(".m2conn-badge");
    const pending = pendingTotal();
    let mode = "ok", t = "CONECTADO", s = "MILITOPO está al día.", keep = false;

    if (!state.online) {
      mode = "offline"; t = "SIN COBERTURA"; keep = true;
      s = pending ? `${pendingText()} protegidos en este dispositivo.` : (state.raceActive ? "Carrera protegida localmente. Se sincronizará al volver Internet." : "Mostrando la última información guardada.");
    } else if (state.reconnecting) {
      mode = "reconnecting"; t = "RECUPERANDO CONEXIÓN"; keep = true;
      s = pending ? `Verificando conexión · ${pendingText()} pendientes.` : "Verificando sesión y sincronización…";
    } else if (state.trackSyncing || state.controlSyncing) {
      mode = "syncing"; t = "SINCRONIZANDO"; keep = true;
      s = pending ? `${pendingText()} pendientes de confirmar.` : "Confirmando los últimos datos con MILITOPO Live.";
    } else if (pending > 0) {
      mode = "pending"; t = "PENDIENTE DE SINCRONIZAR"; keep = true;
      s = `${pendingText()} guardados de forma segura.`;
    }

    root.dataset.mode = mode;
    title.textContent = t;
    sub.textContent = s;
    badge.hidden = pending <= 0;
    badge.textContent = pending > 99 ? "99+" : String(pending);
    document.documentElement.dataset.militopoConnection = mode;

    if (force || mode !== state.lastMode) {
      state.lastMode = mode;
      showFor(keep ? 0 : 2600);
    } else if (keep) {
      showFor(0);
    }
  }

  function syncSnapshots() {
    try {
      const t = globalThis.MILITOPO_RUNNER_TRACK_V2?.snapshot?.();
      if (t) state.trackPending = Math.max(0, Number(t.pending || 0));
    } catch (_) {}
    try {
      const c = globalThis.MILITOPO_RUNNER_CONTROLS_V2?.snapshot?.();
      if (c) state.controlPending = Math.max(0, Number(c.pending || 0));
    } catch (_) {}
    state.raceActive = activeRaceFromStorage() || state.raceActive;
  }

  addEventListener("offline", () => {
    state.online = false; state.reconnecting = false;
    if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
    syncSnapshots(); render({ force: true });
  });

  addEventListener("online", () => {
    state.online = true; state.reconnecting = true; syncSnapshots(); render({ force: true });
    if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
    state.reconnectTimer = setTimeout(() => { state.reconnecting = false; syncSnapshots(); render({ force: true }); }, 1600);
  });

  addEventListener("militopo:v2-track-status", e => {
    const d = e.detail || {}, st = String(d.status || "");
    state.trackPending = Math.max(0, Number(d.pending || 0));
    state.trackSyncing = ["syncing", "queued"].includes(st) && state.online && state.trackPending > 0;
    if (["synced", "online", "ready", "stopped"].includes(st) && state.trackPending === 0) state.trackSyncing = false;
    render({ force: st === "error" || st === "offline" });
  });

  addEventListener("militopo:v2-control-status", e => {
    const d = e.detail || {}, st = String(d.status || "");
    state.controlPending = Math.max(0, Number(d.pending || 0));
    state.controlSyncing = ["syncing"].includes(st) && state.online && state.controlPending > 0;
    if (["synced", "reconciled", "arrival_synced"].includes(st) && state.controlPending === 0) state.controlSyncing = false;
    render({ force: ["offline", "sync_error"].includes(st) });
  });

  addEventListener("militopo:v2-race-participant", e => {
    const st = String(e.detail?.status || "").toLowerCase();
    state.raceActive = ["racing", "started"].includes(st);
    syncSnapshots(); render({ force: false });
  });
  addEventListener("militopo:v2-race-opened", () => { state.raceActive = activeRaceFromStorage(); syncSnapshots(); render({ force: true }); });
  addEventListener("militopo:v2-runner-race-closed", () => { state.raceActive = activeRaceFromStorage(); syncSnapshots(); render({ force: false }); });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") { state.online = navigator.onLine !== false; syncSnapshots(); render({ force: false }); }
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { syncSnapshots(); render({ force: true }); }, { once: true });
  else { syncSnapshots(); render({ force: true }); }

  globalThis.MILITOPO_CONNECTIVITY_UI = Object.freeze({ version: VERSION, refresh: () => { syncSnapshots(); render({ force: false }); } });
})();
