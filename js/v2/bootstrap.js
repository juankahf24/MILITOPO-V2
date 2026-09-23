/* MILITOPO V2 · bootstrap no bloqueante.
   La V77 funcional arranca aunque Firebase V2 todavía no esté configurado. */
const status = {
  phase: "A",
  version: "2.0.0-a1",
  environment: globalThis.MILITOPO_V2_CONFIG?.environment || "development",
  configured: Boolean(globalThis.MILITOPO_V2_CONFIG?.configured),
  ready: false,
  error: null
};

globalThis.MILITOPO_V2 = Object.freeze({
  get status() { return { ...status }; },
  async firebase() {
    if (!status.configured) throw new Error("MILITOPO V2 Firebase todavía no está configurado.");
    const module = await import("./firebase/client.js?v=v2-f3a-runner-homefix2-20260923");
    const services = module.getMilitopoFirebase();
    status.ready = true;
    globalThis.dispatchEvent(new CustomEvent("militopo:v2-backend-ready", { detail: { environment: status.environment } }));
    return services;
  }
});

if (status.configured) {
  globalThis.MILITOPO_V2.firebase().catch(error => {
    status.error = String(error?.message || error);
    console.error("[MILITOPO V2] Backend no disponible", error);
  });
} else {
  console.info("[MILITOPO V2] Fase A instalada. Falta pegar firebaseConfig en js/v2/firebase-config.js");
}
