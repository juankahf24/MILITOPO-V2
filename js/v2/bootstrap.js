/* MILITOPO V2 · P1.7 · bootstrap único por página, incluso con distintas ?v=.
   Se conservan las URL antiguas: todas reutilizan la misma API y estado. */
if (!globalThis.MILITOPO_V2) {
  const status = {
    phase: "A",
    version: "2.0.0-a1",
    environment: globalThis.MILITOPO_V2_CONFIG?.environment || "development",
    configured: Boolean(globalThis.MILITOPO_V2_CONFIG?.configured),
    ready: false,
    error: null
  };
  let pending = null;

  const api = Object.freeze({
    get status() { return { ...status }; },
    firebase() {
      if (!status.configured) return Promise.reject(new Error("MILITOPO V2 Firebase todavía no está configurado."));
      if (pending) return pending;
      pending = import("./firebase/client.js?v=v2-f3a-runner-homefix2-20260923")
        .then(module => {
          const services = module.getMilitopoFirebase();
          const firstReady = !status.ready;
          status.ready = true;
          status.error = null;
          if (firstReady) globalThis.dispatchEvent(new CustomEvent("militopo:v2-backend-ready", { detail: { environment: status.environment } }));
          return services;
        })
        .catch(error => {
          status.error = String(error?.message || error);
          throw error;
        })
        .finally(() => { pending = null; });
      return pending;
    }
  });
  // Publicar antes de importar el cliente: los otros módulos comparten el arranque.
  globalThis.MILITOPO_V2 = api;
  if (status.configured) {
    api.firebase().catch(error => console.error("[MILITOPO V2] Backend no disponible", error));
  } else {
    console.info("[MILITOPO V2] Fase A instalada. Falta pegar firebaseConfig en js/v2/firebase-config.js");
  }
}
