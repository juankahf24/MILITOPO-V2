"use strict";

const { setGlobalOptions } = require("firebase-functions/v2");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineString } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();
setGlobalOptions({ region: "europe-west1", maxInstances: 20 });

const db = getFirestore();
const auth = getAuth();
const BOOTSTRAP_ADMIN_EMAIL = defineString("BOOTSTRAP_ADMIN_EMAIL");
const VALID_ROLES = new Set(["runner", "organizer", "super_admin"]);

function requireAuth(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  return request.auth;
}

function requireVerified(request) {
  const identity = requireAuth(request);
  if (identity.token.email_verified !== true) {
    throw new HttpsError("failed-precondition", "Debes verificar tu correo electrónico.");
  }
  return identity;
}

function requireSuperAdmin(request) {
  const identity = requireVerified(request);
  if (identity.token.role !== "super_admin") {
    throw new HttpsError("permission-denied", "Permiso de superadministrador requerido.");
  }
  return identity;
}

async function appendAudit(action, actorUid, targetUid, extra = {}) {
  await db.collection("systemAudit").add({
    action,
    actorUid,
    targetUid: targetUid || null,
    ...extra,
    createdAt: FieldValue.serverTimestamp()
  });
}

exports.ensureUserProfile = onCall({ enforceAppCheck: false }, async request => {
  const identity = requireVerified(request);
  const user = await auth.getUser(identity.uid);
  const existingClaims = user.customClaims || {};
  const role = VALID_ROLES.has(existingClaims.role) ? existingClaims.role : "runner";

  if (existingClaims.role !== role) {
    await auth.setCustomUserClaims(user.uid, { ...existingClaims, role });
  }

  const ref = db.collection("users").doc(user.uid);
  const snap = await ref.get();
  const profile = {
    uid: user.uid,
    email: user.email || null,
    emailVerified: Boolean(user.emailVerified),
    displayName: user.displayName || null,
    photoURL: user.photoURL || null,
    roleMirror: role,
    accountStatus: "active",
    updatedAt: FieldValue.serverTimestamp()
  };
  if (!snap.exists) profile.createdAt = FieldValue.serverTimestamp();
  await ref.set(profile, { merge: true });

  return { uid: user.uid, role, emailVerified: Boolean(user.emailVerified) };
});

exports.setUserRole = onCall({ enforceAppCheck: false }, async request => {
  const actor = requireSuperAdmin(request);
  const targetUid = String(request.data?.uid || "").trim();
  const role = String(request.data?.role || "").trim().toLowerCase();
  if (!targetUid || !VALID_ROLES.has(role)) {
    throw new HttpsError("invalid-argument", "UID o rol no válido.");
  }

  const target = await auth.getUser(targetUid);
  if ((role === "organizer" || role === "super_admin") && !target.emailVerified) {
    throw new HttpsError("failed-precondition", "El usuario debe verificar el correo antes de recibir permisos elevados.");
  }

  const claims = target.customClaims || {};
  await auth.setCustomUserClaims(targetUid, { ...claims, role });
  await db.collection("users").doc(targetUid).set({
    roleMirror: role,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await appendAudit("USER_ROLE_CHANGED", actor.uid, targetUid, { role });
  return { ok: true, uid: targetUid, role };
});

exports.bootstrapSuperAdmin = onCall({ enforceAppCheck: false }, async request => {
  const identity = requireVerified(request);
  const configuredEmail = String(BOOTSTRAP_ADMIN_EMAIL.value() || "").trim().toLowerCase();
  const callerEmail = String(identity.token.email || "").trim().toLowerCase();
  if (!configuredEmail || callerEmail !== configuredEmail) {
    throw new HttpsError("permission-denied", "Esta cuenta no está autorizada para el bootstrap inicial.");
  }

  const lockRef = db.collection("system").doc("superAdminBootstrap");
  await db.runTransaction(async tx => {
    const lock = await tx.get(lockRef);
    if (lock.exists && lock.data()?.uid !== identity.uid) {
      throw new HttpsError("already-exists", "El superadministrador inicial ya fue configurado.");
    }
    if (!lock.exists) {
      tx.create(lockRef, {
        uid: identity.uid,
        email: callerEmail,
        status: "pending",
        createdAt: FieldValue.serverTimestamp()
      });
    }
  });

  const user = await auth.getUser(identity.uid);
  await auth.setCustomUserClaims(identity.uid, { ...(user.customClaims || {}), role: "super_admin" });
  const userRef = db.collection("users").doc(identity.uid);
  const userSnap = await userRef.get();
  const profile = {
    uid: identity.uid,
    email: user.email || callerEmail,
    emailVerified: true,
    roleMirror: "super_admin",
    accountStatus: "active",
    updatedAt: FieldValue.serverTimestamp()
  };
  if (!userSnap.exists) profile.createdAt = FieldValue.serverTimestamp();
  await userRef.set(profile, { merge: true });
  await lockRef.set({ status: "complete", completedAt: FieldValue.serverTimestamp() }, { merge: true });
  await appendAudit("SUPER_ADMIN_BOOTSTRAPPED", identity.uid, identity.uid);
  return { ok: true, uid: identity.uid, role: "super_admin" };
});
