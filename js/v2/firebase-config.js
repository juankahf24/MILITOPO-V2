/* MILITOPO V2 · Configuración pública del cliente Firebase.
   Proyecto DEV: militopo-v2-dev
   IMPORTANTE: aquí NUNCA van claves privadas, service accounts ni secretos de servidor. */
window.MILITOPO_V2_CONFIG = Object.freeze({
  environment: "development",
  configured: true,
  firebase: Object.freeze({
    apiKey: "AIzaSyCN1DZSBfdwQfD_iQmwZ7bx3Eim51KFs74",
    authDomain: "militopo-v2-dev.firebaseapp.com",
    databaseURL: "https://militopo-v2-dev-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "militopo-v2-dev",
    storageBucket: "militopo-v2-dev.firebasestorage.app",
    messagingSenderId: "499586992955",
    appId: "1:499586992955:web:05c07940b0beac8835851e"
  }),
  appCheck: Object.freeze({
    enabled: false,
    recaptchaEnterpriseSiteKey: ""
  }),
  emulators: Object.freeze({
    enabled: false,
    host: "127.0.0.1",
    authPort: 9099,
    firestorePort: 8080,
    databasePort: 9000,
    functionsPort: 5001
  })
});
