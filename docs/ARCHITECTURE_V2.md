# MILITOPO V2 · Arquitectura base

## Principios

- **V1 queda congelada**. V2 usa namespaces, cachés e IndexedDB propios.
- **Authentication** identifica personas; ningún rol privilegiado se decide en el navegador.
- **Custom Claims**: `runner`, `organizer`, `super_admin`.
- **Cloud Firestore**: fuente histórica/oficial (usuarios, carreras, miembros, recorridos, resultados, auditoría).
- **Realtime Database**: datos efímeros de carrera en vivo (posición, controles, presencia, telemetría).
- **IndexedDB/PWA**: continuidad offline. Firestore solo persistirá entre sesiones en dispositivos marcados como confiables; el motor de carrera mantendrá su almacenamiento local crítico independiente.
- **Cloud Functions**: operaciones privilegiadas, invitaciones, roles, cierre de carrera, consolidación y auditoría.
- **App Check**: se activará después de validar Auth/Rules en DEV.

## Roles

### runner
Puede acceder a su perfil, eventos de los que es miembro y sus resultados. No puede concederse permisos ni declarar resultados oficiales.

### organizer
Puede crear y administrar únicamente sus eventos. No puede administrar eventos ajenos ni conceder `super_admin`.

### super_admin
Administración global de MILITOPO. Inicialmente será una única cuenta.

## Ciclo de una carrera

`draft -> prepared -> published -> live -> finished -> archived`

No habrá borrado físico directo desde el cliente. Las eliminaciones se convertirán en archivado/papelera y, en una fase posterior, purga administrativa auditada.

## Separación Live / Histórico

Realtime Database contiene el estado de alta frecuencia mientras se disputa la carrera. Al finalizar, Functions consolidará el resultado oficial en Firestore. Un fallo de red no debe borrar el estado local ni invalidar el resultado pendiente de sincronización.
