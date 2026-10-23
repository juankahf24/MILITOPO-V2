/* MILITOPO V2 · R9N · Carrera Live + clasificación provisional/oficial + responsive. */
import "../../js/v2/bootstrap.js?v=v2-r6b-competicion-one-screen-20261006";
try { await globalThis.MILITOPO_V2?.firebase?.(); } catch (error) { console.warn("[MILITOPO runner live loader] Firebase inicial", error); }
await import("../../js/v2/live/runner-track-v2.js?v=v2-p01-durable-track-20261023");
await import("../../js/v2/live/runner-gps-v2.js?v=v2-p01-gps-track-guard-20261023");
await import("../../js/v2/live/runner-resilience-v2.js?v=v2-i4-safe-update-guard-20260928");
await import("../../js/v2/live/runner-controls-v2.js?v=v2-r6f-progress-discard-state-20261007");
await import("../../js/v2/live/runner-race-v2.js?v=v2-p01-race-track-warning-20261023");
await import("./runner-r9m-responsive.js?v=v2-r9m-runner-responsive-20261011");
