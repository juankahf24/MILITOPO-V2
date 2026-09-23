/* MILITOPO V2 · F3A · Firebase client singleton + runner shell helpers.
   Añade Cloud Functions 2nd gen en europe-west1 manteniendo Auth, Firestore y RTDB. */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  initializeAuth,
  getAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  connectAuthEmulator
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getDatabase, connectDatabaseEmulator, ref as databaseRef, get as databaseGet,
  onValue as databaseOnValue, update as databaseUpdate, onDisconnect as databaseOnDisconnect,
  serverTimestamp as databaseServerTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js";

const APP_NAME = "militopo-v2";
const FUNCTIONS_REGION = "europe-west1";
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
  let auth;
  try {
    auth = initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence]
    });
  } catch (error) {
    if (String(error?.code || "").includes("already-initialized")) auth = getAuth(app);
    else throw error;
  }

  let trustedDevice = false;
  try { trustedDevice = localStorage.getItem("militopo_v2_trusted_device") === "1"; } catch (_) {}
  const firestore = initializeFirestore(app, {
    localCache: trustedDevice
      ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
      : memoryLocalCache()
  });
  const database = getDatabase(app);
  const functions = getFunctions(app, FUNCTIONS_REGION);

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

  const callable = (name, data = {}) => httpsCallable(functions, String(name))(data);
  const databaseApi = Object.freeze({
    ref: path => databaseRef(database, String(path || "")),
    get: target => databaseGet(target),
    onValue: (target, next, error) => databaseOnValue(target, next, error),
    update: (target, value) => databaseUpdate(target, value),
    onDisconnect: target => databaseOnDisconnect(target),
    serverTimestamp: () => databaseServerTimestamp()
  });
  services = Object.freeze({ app, auth, firestore, database, functions, appCheck, config: cfg, callable, databaseApi });
  return services;
}
