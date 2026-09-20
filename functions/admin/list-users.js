"use strict";

const { services } = require("./_admin-common");

(async () => {
  const { projectId, auth } = services();
  console.log(`Proyecto: ${projectId}`);
  console.log("Usuarios Firebase Auth (máx. 100):\n");
  const page = await auth.listUsers(100);
  if (!page.users.length) {
    console.log("No hay usuarios.");
    return;
  }
  for (const user of page.users) {
    const role = user.customClaims?.role || "runner";
    console.log(`${user.email || "(sin email)"}\t${user.uid}\tverified=${Boolean(user.emailVerified)}\trole=${role}`);
  }
})().catch(error => {
  console.error("ERROR:", error?.message || error);
  process.exitCode = 1;
});
