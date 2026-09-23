"use strict";

const { setGlobalOptions } = require("firebase-functions/v2");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getDatabase } = require("firebase-admin/database");
const { randomUUID } = require("node:crypto");

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


async function syncLiveAccessForEvent(identity, eventId, suppliedEventSnap = null) {
  const eventRef = db.collection("events").doc(eventId);
  const eventSnap = suppliedEventSnap || await eventRef.get();
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
  return {
    eventRef, eventSnap, eventData, ownerUid, status, members, baseRef,
    activeMembers: members.filter(row => row.status === "active")
  };
}

function newRunId() {
  return `run_${Date.now()}_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

exports.syncLiveAccess = onCall({ enforceAppCheck: false }, async request => {
  const identity = requireVerified(request);
  const eventId = cleanEventId(request.data?.eventId);
  const live = await syncLiveAccessForEvent(identity, eventId);
  const removedMembers = live.members.filter(row => row.status === "removed").length;
  return {
    ok: true,
    eventId,
    ownerUid: live.ownerUid,
    status: live.status,
    activeMembers: live.activeMembers.length,
    removedMembers,
    schemaVersion: 2
  };
});

exports.startLiveRun = onCall({ enforceAppCheck: false }, async request => {
  const identity = requireVerified(request);
  const eventId = cleanEventId(request.data?.eventId);
  const eventRef = db.collection("events").doc(eventId);
  let eventSnap = await eventRef.get();
  if (!eventSnap.exists) throw new HttpsError("not-found", "El evento no existe.");
  let eventData = eventSnap.data() || {};
  assertManagerForEvent(identity, eventData);

  const ownerUid = String(eventData.ownerUid || "").trim();
  if (!ownerUid) throw new HttpsError("failed-precondition", "El evento no tiene organizador.");
  const baseRef = rtdb.ref(`v2/live/${ownerUid}/${eventId}`);
  const activeSnap = await baseRef.child("activeRun").get();
  const existing = activeSnap.exists() ? (activeSnap.val() || {}) : {};

  if (String(eventData.status || "").toLowerCase() === "live" && existing.runId) {
    return { ok: true, recovered: true, eventId, ownerUid, runId: String(existing.runId), status: "live" };
  }
  if (String(eventData.status || "").toLowerCase() !== "published") {
    throw new HttpsError("failed-precondition", "Solo se puede iniciar una carrera PUBLICADA.");
  }

  const live = await syncLiveAccessForEvent(identity, eventId, eventSnap);
  const runId = newRunId();
  const now = Date.now();
  const participants = {};
  for (const member of live.activeMembers) {
    participants[member.uid] = {
      uid: member.uid,
      username: member.username || null,
      displayName: member.displayName || null,
      status: "not_started",
      online: false,
      startedAt: null,
      finishedAt: null,
      lastSeen: null,
      updatedAt: now
    };
  }

  const updates = {};
  updates[`runs/${runId}/meta`] = {
    runId,
    eventId,
    ownerUid,
    eventName: String(eventData.eventName || "").slice(0, 140),
    status: "active",
    participantCount: live.activeMembers.length,
    startedAt: now,
    finishedAt: null,
    schemaVersion: 2,
    backend: "cloud-functions-v2"
  };
  updates[`runs/${runId}/participants`] = participants;
  updates["activeRun"] = {
    runId,
    status: "active",
    startedAt: now,
    participantCount: live.activeMembers.length,
    updatedAt: now
  };
  updates["meta/status"] = "live";
  updates["meta/activeRunId"] = runId;
  updates["meta/updatedAt"] = now;
  await baseRef.update(updates);

  await eventRef.set({
    status: "live",
    liveRunId: runId,
    liveBackend: "cloud-functions-v2",
    liveAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await appendAudit("LIVE_RUN_STARTED", identity.uid, null, { eventId, ownerUid, runId, participantCount: live.activeMembers.length });
  return { ok: true, eventId, ownerUid, runId, status: "live", participantCount: live.activeMembers.length };
});

exports.finishLiveRun = onCall({ enforceAppCheck: false }, async request => {
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
  if (status === "finished") {
    return { ok: true, recovered: true, eventId, ownerUid, runId: String(eventData.liveRunId || ""), status: "finished" };
  }
  if (status !== "live") throw new HttpsError("failed-precondition", "Solo se puede finalizar un evento EN DIRECTO.");

  const baseRef = rtdb.ref(`v2/live/${ownerUid}/${eventId}`);
  const activeSnap = await baseRef.child("activeRun").get();
  const active = activeSnap.exists() ? (activeSnap.val() || {}) : {};
  const runId = String(eventData.liveRunId || active.runId || "").trim();
  if (!runId) throw new HttpsError("failed-precondition", "No existe una sesión Live V2 activa para este evento.");
  const now = Date.now();
  await baseRef.update({
    [`runs/${runId}/meta/status`]: "finished",
    [`runs/${runId}/meta/finishedAt`]: now,
    [`runs/${runId}/meta/updatedAt`]: now,
    "activeRun/status": "finished",
    "activeRun/finishedAt": now,
    "activeRun/updatedAt": now,
    "meta/status": "finished",
    "meta/updatedAt": now
  });
  await eventRef.set({
    status: "finished",
    finishedAt: FieldValue.serverTimestamp(),
    liveRunId: runId,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await appendAudit("LIVE_RUN_FINISHED", identity.uid, null, { eventId, ownerUid, runId });
  return { ok: true, eventId, ownerUid, runId, status: "finished" };
});

// F3A · Contexto Live del corredor autenticado.
// Evita collectionGroup("members"): esa consulta puede necesitar un índice de
// grupo de colecciones y, si falta, Cloud Functions termina devolviendo 500.
// Primero buscamos únicamente eventos activos y después comprobamos el
// documento members/{uid} de cada candidato. Las carreras FINALIZADAS no se
// muestran en "Mis carreras"; quedarán para la futura vista de historial.
exports.getRunnerLiveEvents = onCall({ enforceAppCheck: false }, async request => {
  const identity = requireVerified(request);
  const uid = String(identity.uid || "").trim();

  try {
    const wantedStatuses = ["prepared", "published", "live"];
    const snapshots = await Promise.all(
      wantedStatuses.map(status => db.collection("events").where("status", "==", status).limit(200).get())
    );

    const candidates = new Map();
    for (const querySnap of snapshots) {
      querySnap.forEach(eventSnap => candidates.set(eventSnap.id, eventSnap));
    }

    const rows = await Promise.all(Array.from(candidates.values()).map(async eventSnap => {
      const eventId = eventSnap.id;
      const data = eventSnap.data() || {};
      const memberSnap = await eventSnap.ref.collection("members").doc(uid).get();
      if (!memberSnap.exists) return null;

      const memberData = memberSnap.data() || {};
      if (String(memberData.status || "active").toLowerCase() !== "active") return null;

      const status = String(data.status || "draft").toLowerCase();
      const ownerUid = String(data.ownerUid || "").trim();
      if (!ownerUid || !wantedStatuses.includes(status)) return null;

      let activeRun = {};
      // Solo consultamos RTDB si la carrera está realmente EN DIRECTO.
      if (status === "live") {
        const activeSnap = await rtdb.ref(`v2/live/${ownerUid}/${eventId}/activeRun`).get();
        activeRun = activeSnap.exists() ? (activeSnap.val() || {}) : {};
      }

      return {
        eventId,
        eventName: String(data.eventName || "Carrera de orientación").slice(0, 140),
        ownerUid,
        status,
        liveRunId: String(activeRun.runId || data.liveRunId || ""),
        liveStatus: String(activeRun.status || ""),
        participantCount: Math.max(0, Number(activeRun.participantCount || 0))
      };
    }));

    const events = rows.filter(Boolean);
    events.sort((a, b) => {
      const rank = { live: 0, published: 1, prepared: 2 };
      return (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || a.eventName.localeCompare(b.eventName, "es");
    });

    return { ok: true, uid, events };
  } catch (error) {
    console.error("[MILITOPO getRunnerLiveEvents]", {
      uid,
      code: error?.code || null,
      message: error?.message || String(error)
    });
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "No se pudieron consultar tus carreras activas.");
  }
});
