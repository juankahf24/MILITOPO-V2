# MILITOPO V2 · Fase C3 · Recuperación desde Firestore

## Objetivo
Cerrar la Fase C permitiendo que un organizador/super_admin recupere desde otro dispositivo la configuración, balizas y recorridos que ya están en Firestore.

## Seguridad
- Solo se listan eventos cuyo `ownerUid` coincide con el usuario autenticado.
- La cuenta debe tener correo verificado y rol `organizer` o `super_admin`.
- Antes de aplicar un evento descargado se fuerza un guardado local del evento actual.
- También se intenta guardar una copia duradera en IndexedDB antes de cambiar de evento.
- Si el evento local contiene evidencias de carrera/resultados y se intenta abrir otro evento, MILITOPO pide una confirmación adicional.
- C3 no borra documentos de Firestore ni modifica las Rules.

## Datos recuperados
Desde `events/{eventId}`:
- nombre y código del evento;
- participantes y parámetros de generación;
- escala y equidistancia.

Desde `events/{eventId}/checkpoints`:
- salida, llegada y balizas;
- UTM/coordenadas/elevación;
- descripciones IOF.

Desde `events/{eventId}/courses`:
- recorridos únicos;
- participantes asignados;
- métricas almacenadas.

Los resultados de carrera todavía no forman parte de la copia cloud de Fase C; se incorporarán en fases posteriores.

## Interfaz
En PASO 1 aparece `☁️ ABRIR EVENTO DESDE NUBE`.
Al pulsarlo se consulta Firestore y se muestran los eventos de la cuenta ordenados en el navegador por fecha de actualización.

## Prueba de salida de C3
1. Con un evento C2 sincronizado, pulsar `ABRIR EVENTO DESDE NUBE`.
2. Comprobar que aparece el evento correcto.
3. Abrirlo y confirmar.
4. Verificar mensaje `Evento recuperado desde Firestore`.
5. Comprobar que conserva nombre/código, 27 puntos y los recorridos esperados.
6. Recargar la página y comprobar que el evento recuperado también queda restaurado localmente.

Cuando esta prueba pase, la Fase C puede considerarse terminada.
