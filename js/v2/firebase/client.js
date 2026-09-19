/* MILITOPO V2 · Firebase client singleton.
   SDK modular 12.19.0. La app V2 usa un nombre Firebase propio para no colisionar
   con el backend Live heredado mientras termina la migración. */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getDatabase, connectDatabaseEmulator } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { getFunctions, connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js";

const APP_NAME = "militopo-v2";
let services = null;

function requireClientConfig() {
  const cfg = globalThis.MILITOPO_V2_CONFIG;
  if (!cfg?.configured) throw new Error("MILITOPO_V2_FIREBASE_NOT_CONFIGURED");
  const required = ["apiKey", "authDomain", "projectId", "appId"];
  const missing = required.filter(key => !String(cfg.firebase?.[key] || "").trim());
  if (missing.length) throw new Error(`MILITOPO_V2_FIREBASE_CONFIG_MISSING:${missing.join(",")}`);
  return cfg;
}

function findApp() {
  return getApps().find(candidate => candidate.name === APP_NAME) || null;
}

export function getMilitopoFirebase() {
  if (services) return services;
  const cfg = requireClientConfig();
  const app = findApp() || initializeApp(cfg.firebase, APP_NAME);
  const auth = getAuth(app);

  // Firestore solo persiste datos entre sesiones cuando el usuario ha marcado el
  // dispositivo como de confianza. Fase B gestionará esa decisión en la interfaz.
  let trustedDevice = false;
  try { trustedDevice = localStorage.getItem("militopo_v2_trusted_device") === "1"; } catch (_) {}
  const firestore = initializeFirestore(app, {
    localCache: trustedDevice
      ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
      : memoryLocalCache()
  });
  const database = getDatabase(app);
  const functions = getFunctions(app, "europe-west1");

  if (cfg.emulators?.enabled) {
    const host = cfg.emulators.host || "127.0.0.1";
    connectAuthEmulator(auth, `http://${host}:${cfg.emulators.authPort || 9099}`, { disableWarnings: true });
    connectFirestoreEmulator(firestore, host, Number(cfg.emulators.firestorePort || 8080));
    connectDatabaseEmulator(database, host, Number(cfg.emulators.databasePort || 9000));
    connectFunctionsEmulator(functions, host, Number(cfg.emulators.functionsPort || 5001));
  }

  let appCheck = null;
  if (cfg.appCheck?.enabled && cfg.appCheck.recaptchaEnterpriseSiteKey) {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(cfg.appCheck.recaptchaEnterpriseSiteKey),
      isTokenAutoRefreshEnabled: true
    });
  }

  services = Object.freeze({ app, auth, firestore, database, functions, appCheck, config: cfg });
  return services;
}
