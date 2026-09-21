# MILITOPO V2 · D2 hotfix · bloqueo de evento publicado

Corrige un bucle de renderizado en `event-edit-lock.js` que podía congelar la aplicación
al abrir un evento en estado `published`, `live`, `finished` o `archived`.

Causa: el MutationObserver llamaba a `applyControls()`, que volvía a escribir el HTML del
banner de bloqueo en cada pasada. Esa escritura generaba otra mutación y repetía el ciclo.

Cambios:
- el banner solo se modifica cuando su contenido cambia;
- las mutaciones se agrupan a una actualización por frame;
- se añade protección contra reentrada;
- se corrige la conservación del estado `disabled` previo (`"0"` no se trata como ausente);
- se incrementa la versión de caché/Service Worker para forzar la carga del módulo corregido.

No modifica reglas Firestore ni datos del evento.
