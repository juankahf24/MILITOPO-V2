# MILITOPO V2 · Fase D1 · Ciclo de vida del evento

Objetivo: convertir cada evento de Firestore en un evento gestionado por estados, sin Cloud Functions ni Cloud Storage.

Estados permitidos:

`draft → prepared → published → live → finished → archived`

## Seguridad

- Solo `organizer` propietario o `super_admin` pueden cambiar el estado.
- El navegador no puede saltarse estados.
- Para pasar de `draft` a `prepared`, Firestore debe tener al menos 3 checkpoints y 1 recorrido sincronizado.
- No existe borrado físico del evento.
- El archivado conserva el documento y su estructura.

## Interfaz

En PASO 1 aparece `GESTIÓN DEL EVENTO V2` con:
- estado actual;
- línea de progreso;
- comprobación de preparación;
- botón para avanzar al siguiente estado;
- confirmación antes de `live`, `finished` y `archived`.

## Despliegue de reglas

Tras subir los archivos al repositorio:

`firebase deploy --only firestore:rules`

No desplegar Functions ni Storage.
