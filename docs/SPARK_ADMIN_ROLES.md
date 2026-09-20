# MILITOPO V2 · Roles administrativos en Firebase Spark

MILITOPO-V2 permanece en el plan **Spark**. No se despliegan Cloud Functions ni Cloud Storage.
Los roles privilegiados se asignan únicamente desde un entorno administrativo con Firebase Admin SDK.

Roles válidos:

- `runner`
- `organizer`
- `super_admin`

## Requisitos

1. Abrir Google Cloud Shell con el proyecto `militopo-v2-dev` seleccionado.
2. Clonar/actualizar el repositorio.
3. Instalar las dependencias administrativas:

```bash
cd ~/MILITOPO-V2/functions
npm install
```

## Ver usuarios

```bash
npm run admin:list-users
```

## Cambiar un rol

Por correo:

```bash
npm run admin:set-role -- correo@ejemplo.com super_admin
```

También se puede usar el UID:

```bash
npm run admin:set-role -- UID organizer
```

Para retirar privilegios:

```bash
npm run admin:set-role -- correo@ejemplo.com runner
```

Los roles `organizer` y `super_admin` solo se conceden si Firebase Auth confirma que el correo está verificado.
La herramienta conserva los demás custom claims y actualiza `users/{uid}.roleMirror` como espejo administrativo.

Tras un cambio de rol, el usuario debe recargar MILITOPO o volver a iniciar sesión. La interfaz B2 fuerza la renovación del token al entrar para recoger el cambio inmediatamente.

## Seguridad

- No guardar claves de cuentas de servicio en GitHub.
- No añadir controles en el navegador capaces de asignar `organizer` o `super_admin`.
- No desplegar `functions/` mientras el proyecto deba permanecer en Spark.
