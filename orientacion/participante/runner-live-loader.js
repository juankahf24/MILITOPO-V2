/* MILITOPO V2 · R6F · Carrera Live V2 · progreso semántico y resumen fijo. */
import "../../js/v2/bootstrap.js?v=v2-r6b-competicion-one-screen-20261006";

try { await globalThis.MILITOPO_V2?.firebase?.(); } catch (error) { console.warn("[MILITOPO runner live loader] Firebase inicial", error); }
await import("../../js/v2/live/runner-track-v2.js?v=v2-g3-recovery-wakelock-20260924");
await import("../../js/v2/live/runner-gps-v2.js?v=v2-k3b-gps-resume-20261001");
await import("../../js/v2/live/runner-resilience-v2.js?v=v2-i4-safe-update-guard-20260928");
await import("../../js/v2/live/runner-controls-v2.js?v=v2-r6f-progress-discard-state-20261007");
await import("../../js/v2/live/runner-race-v2.js?v=v2-r6f-race-focus-summary-20261007");
