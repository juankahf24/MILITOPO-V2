# MILITOPO V2 · FASE J — Seguridad final

## J1 — Autoridad del servidor y Rules

- `events/{eventId}/results/{uid}` queda de solo lectura para clientes autorizados.
  La escritura oficial se realiza únicamente desde Cloud Functions/Admin SDK.
- Los `trackChunks` históricos siguen siendo de solo escritura servidor.
- En RTDB se elimina la escritura cliente a nivel completo de `participants/{uid}`.
  El runner conserva exclusivamente las escrituras explícitas necesarias (`online`, `lastSeen`, `updatedAt`, `gps`) y el servidor mantiene estado, salida, llegada, penalizaciones y resultado.
- El espejo `users.emailVerified` solo puede coincidir con el claim real de Firebase Auth.
- Storage queda declarado explícitamente en `firebase.json` y continúa cerrado por defecto.

## J2 — App Check

Se activará de forma escalonada: primero registro web + métricas, después enforcement en Cloud Functions/Firestore/RTDB una vez validado el cliente real. No activar enforcement antes de configurar la clave de reCAPTCHA Enterprise.
