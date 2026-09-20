"use strict";

const { FieldValue, normalizedRole, resolveUser, services } = require("./_admin-common");

(async () => {
  const identity = process.argv[2];
  const role = normalizedRole(process.argv[3]);
  if (!identity) {
    throw new Error("Uso: node admin/set-user-role.js <email-o-uid> <runner|organizer|super_admin>");
  }

  const { projectId, auth, db } = services();
  const user = await resolveUser(auth, identity);

  if ((role === "organizer" || role === "super_admin") && !user.emailVerified) {
    throw new Error("El correo de ese usuario todavía no está verificado.");
  }

  const previousClaims = user.customClaims || {};
  await auth.setCustomUserClaims(user.uid, { ...previousClaims, role });
  await db.collection("users").doc(user.uid).set({
    uid: user.uid,
    email: user.email || null,
    emailVerified: Boolean(user.emailVerified),
    displayName: user.displayName || null,
    roleMirror: role,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  console.log("OK");
  console.log(`Proyecto: ${projectId}`);
  console.log(`Usuario: ${user.email || user.uid}`);
  console.log(`UID: ${user.uid}`);
  console.log(`Rol: ${role}`);
  console.log("El usuario debe recargar MILITOPO o volver a iniciar sesión para ver el rol nuevo.");
})().catch(error => {
  console.error("ERROR:", error?.message || error);
  process.exitCode = 1;
});
