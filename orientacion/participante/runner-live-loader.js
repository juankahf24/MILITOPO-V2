/* MILITOPO V2 · R9N · Carrera Live + clasificación provisional/oficial + responsive. */
import "../../js/v2/bootstrap.js?v=v2-r6b-competicion-one-screen-20261006";
await import("../../js/v2/live/runner-track-v2.js?v=v2-p03-gps-reconciliation-20261023");
await import("../../js/v2/live/runner-gps-v2.js?v=v2-lote2-gps-20261109");
await import("./runner-controls-v2.js?v=2.0.11");
await import("./runner-race-v2.js?v=2.0.21");
await import("./runner-r9m-responsive.js?v=2.0.7");

// Cargar el respaldo una vez identificada la sesión local del corredor.
// El receptor de la carrera ya está listo antes de emitir su reapertura.
export function loadRunnerRecovery() {
  return import("../../js/v2/live/runner-resilience-v2.js?v=v2-i4-safe-update-guard-20260928");
}
