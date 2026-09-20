# MILITOPO V2 · Fase C1 · Cabecera de eventos en Firestore

## Objetivo
Añadir una copia oficial progresiva de la configuración básica de cada ejercicio de Orientación en Firestore sin sustituir el sistema local existente.

## Seguridad de esta fase
- `localStorage`, `sessionStorage` e IndexedDB siguen siendo la red de seguridad.
- Firestore solo recibe la cabecera/configuración después de confirmar el PASO 1 o al recuperar un evento local ya existente.
- Solo `organizer` y `super_admin` verificados pueden crear/actualizar eventos según `firestore.rules`.
- El navegador no puede cambiar `ownerUid`, `createdAt` ni el estado de propiedad de un evento existente.
- No se usa Cloud Storage ni Cloud Functions.

## Documento creado
Ruta: `events/{eventId}`

Campos C1:
- `eventId`
- `eventName`
- `ownerUid`
- `kind = orientation`
- `status = draft` al crear
- `schemaVersion = 1`
- `cloudStage = C1`
- `participantCount`
- `maxUniqueRoutes`
- `controlCount`
- `controlsPerRoute`
- `maxControlReuse`
- `planScale`
- `planEquidistanceM`
- `createdAt`
- `updatedAt`

## Control de costes/cuota
El autoguardado local puede ejecutarse con frecuencia, pero el módulo C1 calcula una firma de la cabecera y evita escrituras Firestore cuando la configuración no ha cambiado.

## Prueba de salida C1
1. Entrar como `super_admin` u `organizer`.
2. Abrir Orientación.
3. Cambiar el nombre de la prueba si se desea.
4. Pulsar `CONFIRMAR Y PASAR AL MAPA`.
5. Ver el estado `✅ Nube sincronizada`.
6. En Firebase > Firestore comprobar `events/{eventId}` y sus campos.
7. Cambiar un valor del PASO 1, esperar al autoguardado y confirmar que Firestore se actualiza.
8. Comprobar que sin conexión la interfaz indica que la copia local sigue protegida.
