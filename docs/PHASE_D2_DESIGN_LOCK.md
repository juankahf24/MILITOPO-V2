# MILITOPO V2 · Fase D2 · Bloqueo de diseño

## Objetivo
Congelar la configuración, balizas y recorridos en cuanto un evento pasa a `published`.

## Estados editables
- `draft`
- `prepared`

## Estados bloqueados
- `published`
- `live`
- `finished`
- `archived`

## Protección en dos capas
1. Interfaz: desactiva controles de edición y muestra un aviso de diseño congelado.
2. Firestore Rules: rechaza escrituras de `checkpoints` y `courses`, y después de publicar solo permite cambios del ciclo de vida en el documento del evento.

La generación/consulta de material sigue disponible; el bloqueo se limita al diseño oficial del evento.
