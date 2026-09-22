"use strict";

const { setGlobalOptions } = require("firebase-functions/v2");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getDatabase } = require("firebase-admin/database");

initializeApp();
// Control de coste/escala: MILITOPO no necesita decenas de instancias simultáneas.
setGlobalOptions({ region: "europe-west1", maxInstances: 3, timeoutSeconds: 60, memory: "256MiB" });

const db = getFirestore();
const auth = getAuth();
const rtdb = getDatabase();
const VALID_ROLES = new Set(["runner", "organizer", "super_admin"]);
const LIVE_STATES = new Set(["prepared", "published", "live", "finished"]);

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

function cleanEventId(value) {
  const eventId = String(value || "").trim();
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(eventId)) {
    throw new HttpsError("invalid-argument", "Identificador de evento no válido.");
  }
  return eventId;
}

function assertManagerForEvent(identity, eventData) {
  const role = String(identity.token.role || "runner");
  const ownerUid = String(eventData?.ownerUid || "");
  if (role === "super_admin") return;
  if (role === "organizer" && identity.uid === ownerUid) return;
  throw new HttpsError("permission-denied", "No tienes permisos para administrar este evento.");
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

exports.syncLiveAccess = onCall({ enforceAppCheck: false }, async request => {
  const identity = requireVerified(request);
  const eventId = cleanEventId(request.data?.eventId);
  const eventRef = db.collection("events").doc(eventId);
  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) throw new HttpsError("not-found", "El evento no existe.");

  const eventData = eventSnap.data() || {};
  assertManagerForEvent(identity, eventData);
  const ownerUid = String(eventData.ownerUid || "").trim();
  if (!ownerUid) throw new HttpsError("failed-precondition", "El evento no tiene organizador.");

  const status = String(eventData.status || "draft").toLowerCase();
  if (!LIVE_STATES.has(status)) {
    throw new HttpsError("failed-precondition", "Live V2 solo se prepara desde PREPARADO.");
  }

  const membersSnap = await eventRef.collection("members").get();
  const members = [];
  membersSnap.forEach(docSnap => {
    const row = docSnap.data() || {};
    const uid = String(row.uid || docSnap.id || "").trim();
    if (!uid) return;
    members.push({
      uid,
      status: String(row.status || "active").toLowerCase(),
      username: String(row.username || "").slice(0, 40),
      displayName: String(row.displayName || row.name || "").slice(0, 120),
      email: String(row.email || "").slice(0, 180)
    });
  });

  const baseRef = rtdb.ref(`v2/live/${ownerUid}/${eventId}`);
  const currentMembersSnap = await baseRef.child("members").get();
  const currentMembers = currentMembersSnap.exists() ? (currentMembersSnap.val() || {}) : {};
  const updates = {
    "meta/ownerUid": ownerUid,
    "meta/eventId": eventId,
    "meta/eventName": String(eventData.eventName || "").slice(0, 140),
    "meta/status": status,
    "meta/schemaVersion": 2,
    "meta/backend": "cloud-functions-v2",
    "meta/updatedAt": Date.now()
  };

  const seen = new Set();
  for (const member of members) {
    seen.add(member.uid);
    updates[`members/${member.uid}`] = {
      uid: member.uid,
      active: member.status === "active",
      status: member.status,
      username: member.username || null,
      displayName: member.displayName || null,
      email: member.email || null,
      updatedAt: Date.now()
    };
  }
  for (const uid of Object.keys(currentMembers)) {
    if (!seen.has(uid)) updates[`members/${uid}`] = null;
  }

  await baseRef.update(updates);
  const activeMembers = members.filter(row => row.status === "active").length;
  const removedMembers = members.filter(row => row.status === "removed").length;
  return { ok: true, eventId, ownerUid, status, activeMembers, removedMembers, schemaVersion: 2 };
});
