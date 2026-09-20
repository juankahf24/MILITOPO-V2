# MILITOPO V2 · Fase B3 · Cuenta y perfil (Spark)

Esta fase mantiene el proyecto en Firebase Spark y no usa Cloud Functions ni Cloud Storage.

## Incluye
- Menú de cuenta accesible desde la insignia superior.
- Edición del nombre para mostrar.
- Correo, verificación y rol visibles en modo lectura.
- Persistencia de sesión configurable.
- Opción local «dispositivo de confianza» para activar la caché persistente de Firestore.
- Envío de correo para cambio/restablecimiento de contraseña.
- Cierre de sesión desde el panel de cuenta.
- Sin edición de roles desde el navegador.

## Seguridad
Los roles `organizer` y `super_admin` siguen asignándose únicamente con Firebase Admin SDK desde Cloud Shell. El navegador solo puede actualizar campos de perfil permitidos por `firestore.rules`.

## Nota sobre dispositivo de confianza
El tipo de caché de Firestore se decide al inicializar Firebase. Si se cambia esta opción, MILITOPO solicita recargar la página para aplicar el cambio.
