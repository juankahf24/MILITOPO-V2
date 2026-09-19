# Modelo de datos V2

## Firestore

- `users/{uid}`: perfil no privilegiado, estado de cuenta y espejo de rol gestionado por servidor.
- `events/{eventId}`: cabecera de carrera y estado.
- `events/{eventId}/members/{uid}`: pertenencia, dorsal, recorrido asignado y estado de inscripción.
- `events/{eventId}/courses/{courseId}`: recorridos.
- `events/{eventId}/checkpoints/{checkpointId}`: balizas/salida/llegada.
- `events/{eventId}/results/{uid}`: resultado consolidado/oficial.
- `events/{eventId}/audit/{logId}`: auditoría específica del evento.
- `invitations/{inviteId}`: invitaciones creadas/aceptadas por Functions.
- `organizations/{orgId}` y `organizations/{orgId}/members/{uid}`: preparado para organizaciones futuras.
- `system/*`: bloqueos/configuración interna; sin acceso cliente.
- `systemAudit/*`: auditoría administrativa; escritura exclusiva de Admin SDK.

## Realtime Database

- `v2/access/{eventId}/{uid}`: ACL materializada por backend para que RTDB Rules no dependan de Firestore.
- `v2/live/{eventId}/participants/{uid}`: estado live del corredor.
- `v2/live/{eventId}/meta`: estado de la sesión live.

## Regla de oro

Un documento de perfil puede mostrar `roleMirror`, pero **la autorización real usa `request.auth.token.role`**. El cliente nunca puede convertir ese espejo en permisos.
