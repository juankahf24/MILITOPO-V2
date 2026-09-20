# MILITOPO V2 · Fase C2 · Estructura de Orientación en Firestore

## Objetivo
Guardar progresivamente en Firestore las balizas/puntos y los diseños de recorrido sin sustituir el guardado local existente.

## Rutas Firestore
- `events/{eventId}/checkpoints/{checkpointId}`
- `events/{eventId}/courses/{routeId}`

El documento padre `events/{eventId}` mantiene contadores informativos y `cloudStage: "C2"`.

## Seguridad
Se usan las reglas ya desplegadas en B2. Solo `organizer` propietario o `super_admin`, con correo verificado, puede escribir estas subcolecciones.

## Cuota / escrituras
La sincronización compara `contentHash` por documento. Un autoguardado local sin cambios no vuelve a escribir toda la estructura. Al mover una baliza se actualiza esa baliza y la metadata del evento; al regenerar un recorrido se actualizan solo los recorridos cuyo contenido cambió.

## Red de seguridad
`localStorage`, `sessionStorage` e IndexedDB continúan funcionando. Un fallo de red o Firestore no borra el evento local.

## Validación C2
1. Confirmar PASO 1.
2. Situar salida, llegada y balizas en PASO 2.
3. Comprobar el estado `Estructura sincronizada` o `Estructura al día`.
4. Generar recorridos y entrar en PASO 3.
5. En Firestore comprobar las subcolecciones `checkpoints` y `courses` dentro del evento.
