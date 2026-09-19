# Fase A · Puesta en marcha

## Ya configurado

- Proyecto Firebase DEV: `militopo-v2-dev`.
- Aplicación Web registrada.
- Firestore creado en `europe-southwest1` (Madrid), modo producción.
- Realtime Database creada en Europa (`europe-west1`), modo bloqueado/producción.
- `js/v2/firebase-config.js` ya contiene la configuración pública de la app Web y `configured: true`.
- `.firebaserc` apunta a `militopo-v2-dev`.
- App Check queda preparado pero desactivado hasta completar su integración y pruebas.

## Pendiente de completar durante la Fase A

1. Habilitar/configurar los proveedores de Firebase Authentication previstos para V2.
2. Instalar Firebase CLI en el entorno desde el que se vayan a desplegar reglas/functions y ejecutar `firebase login`.
3. En `functions/`, ejecutar `npm install`.
4. Probar reglas/servicios localmente con `firebase emulators:start` antes de desplegar.
5. Antes del primer bootstrap de administrador, configurar `BOOTSTRAP_ADMIN_EMAIL` con el correo verificado correspondiente al desplegar Functions. La función `bootstrapSuperAdmin` se bloquea después del primer uso.
6. Configurar App Check en web y validar métricas antes de activar enforcement.

## Todavía NO hacer

- No actives enforcement de App Check todavía.
- No migres la carrera Live de V1 a la nueva RTDB todavía.
- No borres `militopo-live`.
- No metas service accounts, claves privadas, contraseñas ni secretos en GitHub.

## Estado de esta entrega

La infraestructura, reglas y funciones de la Fase A están preparadas sobre la base V77. La interfaz completa de registro/login/verificación pertenece a la Fase B. Hasta entonces la herramienta de Orientación sigue accesible directamente para poder probar V2 sin el selector antiguo Organizador/Participante.
