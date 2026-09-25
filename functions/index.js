"use strict";

const { setGlobalOptions } = require("firebase-functions/v2");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
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
      email: String(row.email || "").slice(0, 180),
      ...memberRouteSummary(row)
    });
  });

  // Completa la identidad desde users/{uid}. Miembros creados en fases
  // anteriores podían tener solo uid/email y el monitor acababa mostrando el UID.
  if (members.length) {
    const refs = members.map(member => db.collection("users").doc(member.uid));
    const profiles = await db.getAll(...refs);
    profiles.forEach((profileSnap, index) => {
      if (!profileSnap?.exists) return;
      const profile = profileSnap.data() || {};
      const member = members[index];
      if (!member.username) {
        member.username = String(profile.usernameKey || profile.username || "").replace(/^@/, "").slice(0, 40);
      }
      if (!member.displayName) {
        member.displayName = String(profile.displayName || "").slice(0, 120);
      }
      if (!member.email) {
        member.email = String(profile.email || "").slice(0, 180);
      }
    });
  }

  // Migración H4.2: si un miembro antiguo llegó a PUBLICADO/LIVE sin routeId,
  // se le asigna ahora una plaza real antes de entrar en Live. Los nuevos miembros
  // ya salen asignados directamente desde acceptInvitationV2.
  if ((status === "published" || status === "live") && members.some(row => row.status === "active" && (!row.participantId || !row.routeId))) {
    for (const member of members) {
      if (member.status !== "active" || (member.participantId && member.routeId)) continue;
      const assignment = await ensureMemberRouteAssignment(eventRef, eventData, member.uid, { allowLive: true });
      Object.assign(member, assignment);
    }
  }

  const baseRef = rtdb.ref(`v2/live/${ownerUid}/${eventId}`);
  const currentMembersSnap = await baseRef.child("members").get();
  const currentMembers = currentMembersSnap.exists() ? (currentMembersSnap.val() || {}) : {};
  const currentActiveRunSnap = await baseRef.child("activeRun").get();
  const currentActiveRun = currentActiveRunSnap.exists() ? (currentActiveRunSnap.val() || {}) : {};
  const currentRunId = String(currentActiveRun.runId || "").trim();
  const currentRunActive = Boolean(currentRunId && String(currentActiveRun.status || "") === "active");
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
      participantId: member.participantId || null,
      routeId: member.routeId || null,
      routeDesignIndex: Number(member.routeDesignIndex || 0),
      routeDistanceKm: member.routeDistanceKm ?? null,
      routePositiveM: member.routePositiveM ?? null,
      routeNegativeM: member.routeNegativeM ?? null,
      routeDifficulty: member.routeDifficulty || null,
      routeControlCount: Number(member.routeControlCount || 0),
      routePoints: Array.isArray(member.routePoints) ? member.routePoints : [],
      updatedAt: Date.now()
    };
    // Si la sesión ya está en directo, refresca solo los datos de identidad.
    // No toca estado, online, salida, llegada ni lastSeen.
    if (currentRunActive && member.status === "active") {
      updates[`runs/${currentRunId}/participants/${member.uid}/username`] = member.username || null;
      updates[`runs/${currentRunId}/participants/${member.uid}/displayName`] = member.displayName || null;
      updates[`runs/${currentRunId}/participants/${member.uid}/email`] = member.email || null;
      updates[`runs/${currentRunId}/participants/${member.uid}/participantId`] = member.participantId || null;
      updates[`runs/${currentRunId}/participants/${member.uid}/routeId`] = member.routeId || null;
      updates[`runs/${currentRunId}/participants/${member.uid}/routeDistanceKm`] = member.routeDistanceKm ?? null;
      updates[`runs/${currentRunId}/participants/${member.uid}/routePositiveM`] = member.routePositiveM ?? null;
      updates[`runs/${currentRunId}/participants/${member.uid}/routeDifficulty`] = member.routeDifficulty || null;
      updates[`runs/${currentRunId}/participants/${member.uid}/routeControlCount`] = Number(member.routeControlCount || 0);
      updates[`runs/${currentRunId}/participants/${member.uid}/routePoints`] = Array.isArray(member.routePoints) ? member.routePoints : [];
    }
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


// H4.2/H4.3 · Asignación persistente corredor → plaza → recorrido.
// El diseño publicado ya contiene recorridos y, cuando existen, participantIds Pxx.
// La asignación se realiza en backend para que dos aceptaciones simultáneas no puedan
// quedarse con la misma plaza. Una plaza permanece reservada aunque el corredor sea
// retirado temporalmente del censo.
function participantOrder(value) {
  const text = String(value || "").trim();
  const number = Number((text.match(/\d+/) || [])[0] || 0);
  return Number.isFinite(number) && number > 0 ? number : Number.MAX_SAFE_INTEGER;
}

function normalizeRouteMetric(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function routeControlCount(points) {
  return (Array.isArray(points) ? points : []).filter(value => {
    const key = String(value || "").trim().toUpperCase();
    return key && !["START", "FINISH", "SALIDA", "LLEGADA"].includes(key);
  }).length;
}

function routeSlotPayload(slot) {
  return {
    participantId: String(slot?.participantId || "").slice(0, 80) || null,
    routeId: String(slot?.routeId || "").slice(0, 80) || null,
    routeDesignIndex: Math.max(0, Number(slot?.routeDesignIndex || 0)),
    routeDistanceKm: normalizeRouteMetric(slot?.metrics?.distanceKm),
    routePositiveM: normalizeRouteMetric(slot?.metrics?.positiveM),
    routeNegativeM: normalizeRouteMetric(slot?.metrics?.negativeM),
    routeDifficulty: String(slot?.metrics?.difficulty || "").slice(0, 40) || null,
    routeControlCount: routeControlCount(slot?.points),
    routePoints: Array.isArray(slot?.points) ? slot.points.map(x => String(x || "").slice(0, 80)).filter(Boolean).slice(0, 120) : []
  };
}

async function loadRouteCatalog(eventRef, eventData = {}) {
  const coursesSnap = await eventRef.collection("courses").get();
  const courses = [];
  coursesSnap.forEach(docSnap => {
    const row = docSnap.data() || {};
    const routeId = String(row.routeId || row.courseId || docSnap.id || "").trim();
    if (!routeId) return;
    courses.push({
      routeId,
      routeDesignIndex: Math.max(0, Number(row.routeDesignIndex || 0)),
      points: Array.isArray(row.points) ? row.points.map(x => String(x || "").trim()).filter(Boolean).slice(0, 120) : [],
      assignedParticipantIds: Array.isArray(row.assignedParticipantIds)
        ? [...new Set(row.assignedParticipantIds.map(x => String(x || "").trim()).filter(Boolean))].slice(0, 500)
        : [],
      metrics: row.metrics && typeof row.metrics === "object" ? {
        distanceKm: normalizeRouteMetric(row.metrics.distanceKm),
        positiveM: normalizeRouteMetric(row.metrics.positiveM),
        negativeM: normalizeRouteMetric(row.metrics.negativeM),
        difficulty: String(row.metrics.difficulty || "").slice(0, 40),
        routeMode: String(row.metrics.routeMode || "").slice(0, 40)
      } : {}
    });
  });
  courses.sort((a, b) => a.routeDesignIndex - b.routeDesignIndex || a.routeId.localeCompare(b.routeId, "es", { numeric: true }));
  if (!courses.length) throw new HttpsError("failed-precondition", "El evento no tiene recorridos publicados.");

  const slots = [];
  const seen = new Set();
  for (const course of courses) {
    for (const rawParticipantId of course.assignedParticipantIds) {
      const participantId = String(rawParticipantId || "").trim();
      if (!participantId || seen.has(participantId)) continue;
      seen.add(participantId);
      slots.push({ participantId, ...course });
    }
  }

  // Compatibilidad con estructuras antiguas: si Firestore no llevaba todavía
  // assignedParticipantIds completos, reconstruimos P01..PN con el mismo reparto
  // round-robin que ya utiliza la recuperación cloud de Orientación.
  const participantCount = Math.max(1, Math.trunc(Number(eventData.participantCount || slots.length || courses.length || 1)));
  for (let i = 0; i < participantCount; i += 1) {
    const participantId = `P${String(i + 1).padStart(2, "0")}`;
    if (seen.has(participantId)) continue;
    const course = courses[i % courses.length];
    seen.add(participantId);
    slots.push({ participantId, ...course });
  }
  slots.sort((a, b) => participantOrder(a.participantId) - participantOrder(b.participantId) || String(a.participantId).localeCompare(String(b.participantId), "es", { numeric: true }));
  return { courses, slots };
}

function memberRouteSummary(member = {}) {
  return {
    participantId: String(member.participantId || member.webParticipantId || "").slice(0, 80) || null,
    routeId: String(member.routeId || member.courseId || "").slice(0, 80) || null,
    routeDesignIndex: Math.max(0, Number(member.routeDesignIndex || 0)),
    routeDistanceKm: normalizeRouteMetric(member.routeDistanceKm),
    routePositiveM: normalizeRouteMetric(member.routePositiveM),
    routeNegativeM: normalizeRouteMetric(member.routeNegativeM),
    routeDifficulty: String(member.routeDifficulty || "").slice(0, 40) || null,
    routeControlCount: Math.max(0, Number(member.routeControlCount || 0)),
    routePoints: Array.isArray(member.routePoints) ? member.routePoints.map(x => String(x || "").slice(0, 80)).filter(Boolean).slice(0, 120) : []
  };
}

async function existingParticipantReservations(eventRef, excludeUid = "") {
  const snap = await eventRef.collection("members").get();
  const reserved = new Map();
  snap.forEach(docSnap => {
    const uid = String(docSnap.id || "").trim();
    if (excludeUid && uid === excludeUid) return;
    const row = docSnap.data() || {};
    const participantId = String(row.participantId || row.webParticipantId || "").trim();
    if (participantId) reserved.set(participantId, uid);
  });
  return reserved;
}

async function ensureMemberRouteAssignment(eventRef, eventData, uid, { allowLive = true } = {}) {
  const catalog = await loadRouteCatalog(eventRef, eventData);
  const reserved = await existingParticipantReservations(eventRef, uid);
  const memberRef = eventRef.collection("members").doc(uid);
  const stateRef = eventRef.collection("system").doc("routeAssignments");

  const result = await db.runTransaction(async tx => {
    const [freshEventSnap, memberSnap, assignmentSnap] = await Promise.all([
      tx.get(eventRef), tx.get(memberRef), tx.get(stateRef)
    ]);
    if (!freshEventSnap.exists) throw new HttpsError("not-found", "El evento no existe.");
    if (!memberSnap.exists) throw new HttpsError("permission-denied", "No estás inscrito en esta carrera.");
    const freshEvent = freshEventSnap.data() || {};
    const status = String(freshEvent.status || "").toLowerCase();
    if (!(status === "published" || (allowLive && status === "live"))) {
      throw new HttpsError("failed-precondition", "El recorrido se asigna cuando el evento está PUBLICADO.");
    }
    const member = memberSnap.data() || {};
    if (String(member.status || "active").toLowerCase() !== "active") {
      throw new HttpsError("failed-precondition", "Tu inscripción no está activa.");
    }

    const currentParticipantId = String(member.participantId || member.webParticipantId || "").trim();
    const currentRouteId = String(member.routeId || member.courseId || "").trim();
    const stateData = assignmentSnap.exists ? (assignmentSnap.data() || {}) : {};
    const assignments = stateData.assignments && typeof stateData.assignments === "object" ? { ...stateData.assignments } : {};

    if (currentParticipantId && currentRouteId) {
      const slot = catalog.slots.find(x => x.participantId === currentParticipantId && x.routeId === currentRouteId)
        || catalog.slots.find(x => x.routeId === currentRouteId)
        || null;
      const summary = slot ? routeSlotPayload(slot) : memberRouteSummary(member);
      assignments[currentParticipantId] = { uid, routeId: currentRouteId };
      tx.set(stateRef, { schemaVersion: 1, assignments, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      // Completa métricas si la membresía viene de una versión anterior.
      if (slot) tx.set(memberRef, { ...summary, routeAssignedAt: member.routeAssignedAt || FieldValue.serverTimestamp(), routeAssignmentSource: member.routeAssignmentSource || "legacy_backfill", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return summary;
    }

    const slot = catalog.slots.find(candidate => {
      const occupiedByMember = reserved.get(candidate.participantId);
      const occupiedByState = assignments[candidate.participantId]?.uid;
      return !occupiedByMember && (!occupiedByState || occupiedByState === uid);
    });
    if (!slot) throw new HttpsError("resource-exhausted", "No quedan plazas/recorridos disponibles en este evento.");

    const summary = routeSlotPayload(slot);
    assignments[summary.participantId] = { uid, routeId: summary.routeId };
    tx.set(memberRef, {
      ...summary,
      routeAssignedAt: FieldValue.serverTimestamp(),
      routeAssignmentSource: "automatic",
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    tx.set(stateRef, { schemaVersion: 1, assignments, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return summary;
  });
  return result;
}

exports.acceptInvitationV2 = onCall({ enforceAppCheck: false }, async request => {
  const identity = requireVerified(request);
  const uid = String(identity.uid || "").trim();
  const invitationId = String(request.data?.invitationId || "").trim();
  if (!/^[A-Za-z0-9_-]{1,180}$/.test(invitationId)) throw new HttpsError("invalid-argument", "Invitación no válida.");

  const inviteRef = db.collection("invitations").doc(invitationId);
  const initialInviteSnap = await inviteRef.get();
  if (!initialInviteSnap.exists) throw new HttpsError("not-found", "La invitación ya no existe.");
  const initialInvite = initialInviteSnap.data() || {};
  const eventId = cleanEventId(initialInvite.eventId);
  const eventRef = db.collection("events").doc(eventId);
  const [eventSnap, profileSnap] = await Promise.all([eventRef.get(), db.collection("users").doc(uid).get()]);
  if (!eventSnap.exists) throw new HttpsError("not-found", "La carrera ya no existe.");
  const eventData = eventSnap.data() || {};
  const catalog = await loadRouteCatalog(eventRef, eventData);
  const reserved = await existingParticipantReservations(eventRef, uid);
  const memberRef = eventRef.collection("members").doc(uid);
  const stateRef = eventRef.collection("system").doc("routeAssignments");
  const profile = profileSnap.exists ? (profileSnap.data() || {}) : {};
  const tokenEmail = String(identity.token.email || "").trim().toLowerCase();

  const assignment = await db.runTransaction(async tx => {
    const [freshInviteSnap, freshEventSnap, memberSnap, assignmentSnap] = await Promise.all([
      tx.get(inviteRef), tx.get(eventRef), tx.get(memberRef), tx.get(stateRef)
    ]);
    if (!freshInviteSnap.exists) throw new HttpsError("not-found", "La invitación ya no existe.");
    if (!freshEventSnap.exists) throw new HttpsError("not-found", "La carrera ya no existe.");
    const invite = freshInviteSnap.data() || {};
    const freshEvent = freshEventSnap.data() || {};
    if (String(invite.eventId || "") !== eventId) throw new HttpsError("failed-precondition", "La invitación no corresponde a este evento.");
    if (String(freshEvent.status || "").toLowerCase() !== "published") {
      throw new HttpsError("failed-precondition", "Solo puedes unirte mientras la carrera está PUBLICADA.");
    }
    const uidMatches = String(invite.targetUid || "") === uid;
    const emailMatches = tokenEmail && String(invite.targetEmail || "").trim().toLowerCase() === tokenEmail;
    if (!uidMatches && !emailMatches) throw new HttpsError("permission-denied", "La invitación no corresponde a esta cuenta.");
    const inviteStatus = String(invite.status || "pending").toLowerCase();
    if (inviteStatus === "revoked") throw new HttpsError("failed-precondition", "La invitación ha sido revocada.");
    if (!new Set(["pending", "accepted"]).has(inviteStatus)) throw new HttpsError("failed-precondition", "La invitación ya no está disponible.");

    const member = memberSnap.exists ? (memberSnap.data() || {}) : {};
    if (memberSnap.exists && String(member.status || "active").toLowerCase() === "removed") {
      throw new HttpsError("failed-precondition", "El organizador ha retirado temporalmente tu inscripción.");
    }
    const currentParticipantId = String(member.participantId || member.webParticipantId || "").trim();
    const currentRouteId = String(member.routeId || member.courseId || "").trim();
    const stateData = assignmentSnap.exists ? (assignmentSnap.data() || {}) : {};
    const assignments = stateData.assignments && typeof stateData.assignments === "object" ? { ...stateData.assignments } : {};

    let summary = null;
    if (currentParticipantId && currentRouteId) {
      const slot = catalog.slots.find(x => x.participantId === currentParticipantId && x.routeId === currentRouteId)
        || catalog.slots.find(x => x.routeId === currentRouteId)
        || null;
      summary = slot ? routeSlotPayload(slot) : memberRouteSummary(member);
    } else {
      const slot = catalog.slots.find(candidate => {
        const occupiedByMember = reserved.get(candidate.participantId);
        const occupiedByState = assignments[candidate.participantId]?.uid;
        return !occupiedByMember && (!occupiedByState || occupiedByState === uid);
      });
      if (!slot) throw new HttpsError("resource-exhausted", "No quedan plazas/recorridos disponibles en esta carrera.");
      summary = routeSlotPayload(slot);
    }

    assignments[summary.participantId] = { uid, routeId: summary.routeId };
    const memberPayload = {
      uid,
      email: tokenEmail || String(profile.email || "").slice(0, 180) || null,
      username: String(profile.usernameKey || profile.username || invite.targetUsername || "").replace(/^@/, "").slice(0, 40) || null,
      displayName: String(profile.displayName || invite.targetDisplayName || "").slice(0, 120) || null,
      role: "runner",
      status: "active",
      invitationId,
      ...summary,
      routeAssignedAt: member.routeAssignedAt || FieldValue.serverTimestamp(),
      routeAssignmentSource: member.routeAssignmentSource || "automatic",
      updatedAt: FieldValue.serverTimestamp()
    };
    if (!memberSnap.exists) memberPayload.joinedAt = FieldValue.serverTimestamp();
    tx.set(memberRef, memberPayload, { merge: true });
    tx.set(stateRef, { schemaVersion: 1, assignments, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (inviteStatus === "pending" || !uidMatches) {
      const inviteUpdate = { status: "accepted", targetUid: uid, acceptedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() };
      tx.set(inviteRef, inviteUpdate, { merge: true });
    }
    return summary;
  });

  await appendAudit("RUNNER_ROUTE_ASSIGNED", uid, uid, { eventId, invitationId, participantId: assignment.participantId, routeId: assignment.routeId });
  return { ok: true, eventId, eventName: String(eventData.eventName || "Carrera de orientación").slice(0, 140), ...assignment };
});

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
    if (!member.participantId || !member.routeId) {
      throw new HttpsError("failed-precondition", `El corredor ${member.displayName || member.username || member.uid} no tiene recorrido asignado.`);
    }
    participants[member.uid] = {
      uid: member.uid,
      username: member.username || null,
      displayName: member.displayName || null,
      email: member.email || null,
      participantId: member.participantId,
      routeId: member.routeId,
      routeDesignIndex: Number(member.routeDesignIndex || 0),
      routeDistanceKm: member.routeDistanceKm ?? null,
      routePositiveM: member.routePositiveM ?? null,
      routeNegativeM: member.routeNegativeM ?? null,
      routeDifficulty: member.routeDifficulty || null,
      routeControlCount: Number(member.routeControlCount || 0),
      routePoints: Array.isArray(member.routePoints) ? member.routePoints : [],
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


const RESULT_SCHEMA_VERSION = 1;
const RESULT_TRACK_CHUNK_SIZE = 250;

function normalizeTrackPoints(raw) {
  const rows = raw && typeof raw === "object" ? Object.values(raw) : [];
  return rows.map(row => {
    const lat = Number(row?.lat);
    const lng = Number(row?.lng);
    const accuracy = Math.max(0, Number(row?.accuracy || 0));
    const at = Math.max(0, Number(row?.at || 0));
    const seq = Math.max(0, Number(row?.seq || 0));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(at) || !Number.isFinite(seq)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180 || at <= 0 || seq <= 0) return null;
    return { lat, lng, accuracy: Math.round(accuracy * 10) / 10, at, seq };
  }).filter(Boolean).sort((a, b) => a.seq - b.seq || a.at - b.at);
}

function haversineMeters(a, b) {
  if (!a || !b) return 0;
  const R = 6371000;
  const rad = Math.PI / 180;
  const p1 = a.lat * rad;
  const p2 = b.lat * rad;
  const dp = (b.lat - a.lat) * rad;
  const dl = (b.lng - a.lng) * rad;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

function trackDistanceMeters(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const d = haversineMeters(points[i - 1], points[i]);
    // Filtra saltos GPS claramente imposibles para no falsear el resumen.
    if (Number.isFinite(d) && d >= 0 && d <= 5000) total += d;
  }
  return Math.round(total);
}

// H6 · Detección histórica de paso por balizas a partir del track GPS.
// Es una evidencia automática, no una descalificación oficial: un fallo GPS no
// cambia por sí solo el estado FINISHED del corredor. La búsqueda respeta el
// orden del recorrido y guarda también la aproximación mínima a cada control.
const CONTROL_ANALYSIS_VERSION = 1;
const CONTROL_BASE_RADIUS_M = 25;
const CONTROL_MAX_RADIUS_M = 45;

function canonicalControlId(value) {
  const raw = String(value || "").trim();
  const upper = raw.toUpperCase();
  if (["START", "SALIDA", "S"].includes(upper)) return "START";
  if (["FINISH", "LLEGADA", "META", "L"].includes(upper)) return "FINISH";
  return upper;
}

function analyzeControlPasses(points, routePoints, checkpoints, startedAtMs = null, finishedAtMs = null) {
  const track = Array.isArray(points) ? points : [];
  const route = (Array.isArray(routePoints) ? routePoints : []).map(canonicalControlId).filter(Boolean);
  const checkpointMap = new Map();
  for (const row of (Array.isArray(checkpoints) ? checkpoints : [])) {
    const id = canonicalControlId(row?.checkpointId || row?.id);
    const lat = Number(row?.lat);
    const lng = Number(row?.lng ?? row?.lon);
    if (!id || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    checkpointMap.set(id, { checkpointId: id, lat, lng });
  }
  const expectedIds = route.filter(id => !["START", "FINISH"].includes(id));
  if (!expectedIds.length) {
    return {
      version: CONTROL_ANALYSIS_VERSION, method: "gps_sequential_proximity_v1",
      expectedCount: 0, detectedCount: 0, missingCount: 0, completionPct: null,
      validation: "unavailable", passes: []
    };
  }

  const startMs = Math.max(0, Number(startedAtMs || 0)) || (track[0]?.at || null);
  const endMs = Math.max(0, Number(finishedAtMs || 0)) || (track[track.length - 1]?.at || null);
  let cursor = 0;
  let previousPassAt = startMs;
  const passes = [];

  for (let order = 0; order < expectedIds.length; order += 1) {
    const checkpointId = expectedIds[order];
    const cp = checkpointMap.get(checkpointId);
    let bestDistanceM = Infinity;
    let bestAccuracyM = null;
    let bestAtMs = null;
    let detected = null;
    let detectedIndex = -1;

    if (cp) {
      for (let i = cursor; i < track.length; i += 1) {
        const point = track[i];
        const d = haversineMeters({ lat: point.lat, lng: point.lng }, cp);
        if (!Number.isFinite(d)) continue;
        const accuracy = Math.max(0, Number(point.accuracy || 0));
        if (d < bestDistanceM) {
          bestDistanceM = d;
          bestAccuracyM = accuracy > 0 ? accuracy : null;
          bestAtMs = Math.max(0, Number(point.at || 0)) || null;
        }
        const allowedRadius = Math.min(CONTROL_MAX_RADIUS_M, Math.max(CONTROL_BASE_RADIUS_M, 20 + Math.min(25, accuracy)));
        if (d <= allowedRadius) {
          detected = { point, distanceM: d, allowedRadiusM: allowedRadius, accuracyM: accuracy > 0 ? accuracy : null };
          detectedIndex = i;
          break;
        }
      }
    }

    const passedAtMs = detected ? (Math.max(0, Number(detected.point.at || 0)) || null) : null;
    const elapsedMs = passedAtMs && startMs ? Math.max(0, passedAtMs - startMs) : null;
    const splitMs = passedAtMs && previousPassAt ? Math.max(0, passedAtMs - previousPassAt) : null;
    if (detectedIndex >= 0) {
      cursor = detectedIndex + 1;
      previousPassAt = passedAtMs || previousPassAt;
    }
    passes.push({
      order: order + 1, checkpointId, detected: Boolean(detected),
      passedAtMs, elapsedMs, splitMs,
      distanceM: detected ? Math.round(detected.distanceM * 10) / 10 : null,
      allowedRadiusM: detected ? Math.round(detected.allowedRadiusM * 10) / 10 : null,
      gpsAccuracyM: detected?.accuracyM == null ? null : Math.round(detected.accuracyM * 10) / 10,
      closestDistanceM: Number.isFinite(bestDistanceM) ? Math.round(bestDistanceM * 10) / 10 : null,
      closestAccuracyM: bestAccuracyM == null ? null : Math.round(bestAccuracyM * 10) / 10,
      closestAtMs: bestAtMs,
      checkpointAvailable: Boolean(cp)
    });
  }

  const detectedCount = passes.filter(row => row.detected).length;
  const expectedCount = passes.length;
  const missingCount = expectedCount - detectedCount;
  const completionPct = expectedCount ? Math.round((detectedCount / expectedCount) * 1000) / 10 : null;
  const validation = !track.length ? "unavailable" : missingCount === 0 ? "complete" : detectedCount ? "partial" : "none_detected";
  return {
    version: CONTROL_ANALYSIS_VERSION, method: "gps_sequential_proximity_v1",
    baseRadiusM: CONTROL_BASE_RADIUS_M, maxRadiusM: CONTROL_MAX_RADIUS_M,
    expectedCount, detectedCount, missingCount, completionPct, validation,
    startedAtMs: startMs, finishedAtMs: endMs, passes
  };
}

function resultStatus(participantStatus) {
  const value = String(participantStatus || "not_started").toLowerCase();
  if (value === "finished") return "finished";
  if (value === "racing" || value === "started") return "incomplete";
  return "not_started";
}

async function replaceResultTrackChunks(resultRef, points) {
  const chunksRef = resultRef.collection("trackChunks");
  const existing = await chunksRef.get();
  const writes = [];
  existing.forEach(docSnap => writes.push({ type: "delete", ref: docSnap.ref }));

  for (let i = 0; i < points.length; i += RESULT_TRACK_CHUNK_SIZE) {
    const chunk = points.slice(i, i + RESULT_TRACK_CHUNK_SIZE);
    const index = Math.floor(i / RESULT_TRACK_CHUNK_SIZE);
    writes.push({
      type: "set",
      ref: chunksRef.doc(`chunk_${String(index).padStart(4, "0")}`),
      data: {
        index,
        pointCount: chunk.length,
        firstSeq: chunk[0]?.seq || null,
        lastSeq: chunk[chunk.length - 1]?.seq || null,
        firstAtMs: chunk[0]?.at || null,
        lastAtMs: chunk[chunk.length - 1]?.at || null,
        points: chunk,
        schemaVersion: RESULT_SCHEMA_VERSION,
        updatedAt: FieldValue.serverTimestamp()
      }
    });
  }

  for (let offset = 0; offset < writes.length; offset += 400) {
    const batch = db.batch();
    for (const item of writes.slice(offset, offset + 400)) {
      if (item.type === "delete") batch.delete(item.ref);
      else batch.set(item.ref, item.data);
    }
    await batch.commit();
  }
}

async function persistRunnerResult({ eventRef, eventData, ownerUid, eventId, baseRef, runId, uid, participant = null, cutoffAt = null, source = "runner_finish" }) {
  const participantRef = baseRef.child(`runs/${runId}/participants/${uid}`);
  let row = participant || null;
  if (!row) {
    const snap = await participantRef.get();
    row = snap.exists() ? (snap.val() || {}) : {};
  }

  const [trackSnap, memberSnap, profileSnap, checkpointsSnap] = await Promise.all([
    baseRef.child(`runs/${runId}/tracks/${uid}`).get(),
    eventRef.collection("members").doc(uid).get(),
    db.collection("users").doc(uid).get(),
    eventRef.collection("checkpoints").get()
  ]);
  const points = normalizeTrackPoints(trackSnap.exists() ? trackSnap.val() : null);
  const member = memberSnap.exists ? (memberSnap.data() || {}) : {};
  const profile = profileSnap.exists ? (profileSnap.data() || {}) : {};
  const checkpoints = [];
  checkpointsSnap.forEach(docSnap => {
    const data = docSnap.data() || {};
    checkpoints.push({
      checkpointId: String(data.checkpointId || docSnap.id || ""),
      lat: Number(data.lat),
      lng: Number(data.lng ?? data.lon)
    });
  });

  const participantState = String(row.status || "not_started").toLowerCase();
  const finalStatus = resultStatus(participantState);
  const startedAtMs = Math.max(0, Number(row.startedAt || 0)) || null;
  let finishedAtMs = Math.max(0, Number(row.finishedAt || 0)) || null;
  if (!finishedAtMs && finalStatus === "incomplete" && cutoffAt) finishedAtMs = Math.max(0, Number(cutoffAt || 0)) || null;
  const durationMs = startedAtMs && finishedAtMs ? Math.max(0, finishedAtMs - startedAtMs) : null;
  const routePoints = Array.isArray(member.routePoints) ? member.routePoints.map(x => String(x || "").slice(0, 80)).filter(Boolean).slice(0, 120) : [];
  const controlAnalysis = analyzeControlPasses(points, routePoints, checkpoints, startedAtMs, finishedAtMs);
  const resultRef = eventRef.collection("results").doc(uid);
  const existing = await resultRef.get();
  const first = points[0] || null;
  const last = points[points.length - 1] || null;

  const result = {
    schemaVersion: RESULT_SCHEMA_VERSION,
    eventId,
    eventName: String(eventData.eventName || "Carrera de orientación").slice(0, 140),
    ownerUid,
    runId,
    runnerUid: uid,
    username: String(profile.usernameKey || profile.username || row.username || "").replace(/^@/, "").slice(0, 40) || null,
    displayName: String(profile.displayName || row.displayName || "").slice(0, 120) || null,
    email: String(profile.email || row.email || "").slice(0, 180) || null,
    membershipStatus: String(member.status || "active").toLowerCase(),
    invitationId: String(member.invitationId || "").slice(0, 160) || null,
    participantId: String(member.participantId || member.webParticipantId || row.participantId || "").slice(0, 80) || null,
    routeId: String(member.routeId || member.courseId || row.routeId || row.courseId || "").slice(0, 80) || null,
    routeDistanceKm: normalizeRouteMetric(member.routeDistanceKm ?? row.routeDistanceKm),
    routePositiveM: normalizeRouteMetric(member.routePositiveM ?? row.routePositiveM),
    routeNegativeM: normalizeRouteMetric(member.routeNegativeM ?? row.routeNegativeM),
    routeDifficulty: String(member.routeDifficulty || row.routeDifficulty || "").slice(0, 40) || null,
    routeControlCount: Math.max(0, Number(member.routeControlCount ?? row.routeControlCount ?? 0)),
    routePoints,
    controlAnalysisVersion: controlAnalysis.version,
    controlDetectionMethod: controlAnalysis.method,
    controlExpectedCount: controlAnalysis.expectedCount,
    controlDetectedCount: controlAnalysis.detectedCount,
    controlMissingCount: controlAnalysis.missingCount,
    controlCompletionPct: controlAnalysis.completionPct,
    controlValidation: controlAnalysis.validation,
    controlPasses: controlAnalysis.passes,
    controlAnalyzedAt: FieldValue.serverTimestamp(),
    status: finalStatus,
    liveParticipantStatus: participantState,
    startedAtMs,
    finishedAtMs,
    durationMs,
    startedAt: startedAtMs ? new Date(startedAtMs) : null,
    finishedAt: finishedAtMs ? new Date(finishedAtMs) : null,
    trackPointCount: points.length,
    trackChunkCount: Math.ceil(points.length / RESULT_TRACK_CHUNK_SIZE),
    trackDistanceM: trackDistanceMeters(points),
    trackStart: first ? { lat: first.lat, lng: first.lng, at: first.at, seq: first.seq } : null,
    trackEnd: last ? { lat: last.lat, lng: last.lng, at: last.at, seq: last.seq } : null,
    source,
    livePath: `v2/live/${ownerUid}/${eventId}/runs/${runId}`,
    consolidatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  if (!existing.exists) result.createdAt = FieldValue.serverTimestamp();

  await resultRef.set(result, { merge: true });
  await replaceResultTrackChunks(resultRef, points);
  return { uid, status: finalStatus, trackPointCount: points.length, durationMs };
}

async function consolidateRunResults({ eventRef, eventData, ownerUid, eventId, baseRef, runId, cutoffAt, source }) {
  const participantsSnap = await baseRef.child(`runs/${runId}/participants`).get();
  const participants = participantsSnap.exists() ? (participantsSnap.val() || {}) : {};
  const entries = Object.entries(participants);
  const rows = [];
  const concurrency = 6;
  for (let offset = 0; offset < entries.length; offset += concurrency) {
    const group = entries.slice(offset, offset + concurrency);
    const saved = await Promise.all(group.map(([uid, participant]) => persistRunnerResult({
      eventRef, eventData, ownerUid, eventId, baseRef, runId, uid,
      participant: participant || {}, cutoffAt, source
    })));
    rows.push(...saved);
  }
  const summary = { total: rows.length, finished: 0, incomplete: 0, notStarted: 0 };
  for (const row of rows) {
    if (row.status === "finished") summary.finished += 1;
    else if (row.status === "incomplete") summary.incomplete += 1;
    else summary.notStarted += 1;
  }
  return { rows, summary };
}

exports.finishLiveRun = onCall({ enforceAppCheck: false, timeoutSeconds: 300 }, async request => {
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

  // H1: antes de cerrar Live, consolida todos los participantes en Firestore.
  // Los que terminaron quedan FINISHED; quien seguía corriendo queda INCOMPLETE;
  // quien no salió queda NOT_STARTED. Así el histórico no depende de RTDB.
  const consolidation = await consolidateRunResults({
    eventRef, eventData, ownerUid, eventId, baseRef, runId,
    cutoffAt: now,
    source: "event_finish"
  });

  await baseRef.update({
    [`runs/${runId}/meta/status`]: "finished",
    [`runs/${runId}/meta/finishedAt`]: now,
    [`runs/${runId}/meta/updatedAt`]: now,
    [`runs/${runId}/meta/resultsConsolidatedAt`]: now,
    [`runs/${runId}/meta/resultCount`]: consolidation.summary.total,
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
    resultsConsolidatedAt: FieldValue.serverTimestamp(),
    resultCount: consolidation.summary.total,
    resultFinishedCount: consolidation.summary.finished,
    resultIncompleteCount: consolidation.summary.incomplete,
    resultNotStartedCount: consolidation.summary.notStarted,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await appendAudit("LIVE_RUN_FINISHED", identity.uid, null, {
    eventId, ownerUid, runId,
    resultCount: consolidation.summary.total,
    finished: consolidation.summary.finished,
    incomplete: consolidation.summary.incomplete,
    notStarted: consolidation.summary.notStarted
  });
  return { ok: true, eventId, ownerUid, runId, status: "finished", results: consolidation.summary };
});


// F3B · Transiciones de carrera del corredor desde backend.
async function resolveRunnerLiveContext(identity, eventId) {
  const uid = String(identity.uid || "").trim();
  const eventRef = db.collection("events").doc(eventId);
  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) throw new HttpsError("not-found", "La carrera no existe.");
  const eventData = eventSnap.data() || {};
  const ownerUid = String(eventData.ownerUid || "").trim();
  if (!ownerUid) throw new HttpsError("failed-precondition", "La carrera no tiene organizador.");

  const memberSnap = await eventRef.collection("members").doc(uid).get();
  if (!memberSnap.exists || String(memberSnap.data()?.status || "active").toLowerCase() !== "active") {
    throw new HttpsError("permission-denied", "Tu cuenta no está activa en esta carrera.");
  }
  const member = memberSnap.data() || {};
  if (!member.participantId || !member.routeId) {
    throw new HttpsError("failed-precondition", "Tu inscripción todavía no tiene un recorrido asignado.");
  }
  if (String(eventData.status || "").toLowerCase() !== "live") {
    throw new HttpsError("failed-precondition", "La carrera no está EN DIRECTO.");
  }

  const baseRef = rtdb.ref(`v2/live/${ownerUid}/${eventId}`);
  const activeSnap = await baseRef.child("activeRun").get();
  const active = activeSnap.exists() ? (activeSnap.val() || {}) : {};
  const runId = String(active.runId || eventData.liveRunId || "").trim();
  if (!runId || String(active.status || "") !== "active") {
    throw new HttpsError("failed-precondition", "No existe una sesión Live V2 activa.");
  }
  const participantRef = baseRef.child(`runs/${runId}/participants/${uid}`);
  const participantSnap = await participantRef.get();
  if (!participantSnap.exists) throw new HttpsError("permission-denied", "No estás incluido en esta sesión Live V2.");
  return { uid, eventId, eventRef, eventData, ownerUid, baseRef, runId, participantRef, participant: participantSnap.val() || {}, member };
}

exports.runnerJoinLive = onCall({ enforceAppCheck: false }, async request => {
  const identity = requireVerified(request);
  const eventId = cleanEventId(request.data?.eventId);
  const ctx = await resolveRunnerLiveContext(identity, eventId);
  const current = String(ctx.participant.status || "not_started").toLowerCase();
  const status = ["racing", "started", "finished"].includes(current) ? (current === "started" ? "racing" : current) : "ready";
  const profileSnap = await db.collection("users").doc(ctx.uid).get();
  const profile = profileSnap.exists ? (profileSnap.data() || {}) : {};
  const now = Date.now();
  const route = memberRouteSummary(ctx.member);
  await ctx.participantRef.update({
    uid: ctx.uid,
    displayName: String(profile.displayName || ctx.participant.displayName || "").slice(0, 120) || null,
    username: String(profile.usernameKey || profile.username || ctx.participant.username || "").replace(/^@/, "").slice(0, 40) || null,
    email: String(profile.email || ctx.participant.email || identity.token.email || "").slice(0, 180) || null,
    ...route,
    status,
    online: true,
    lastSeen: now,
    updatedAt: now
  });
  return { ok: true, eventId, ownerUid: ctx.ownerUid, runId: ctx.runId, status, ...route };
});

exports.runnerStartRace = onCall({ enforceAppCheck: false }, async request => {
  const identity = requireVerified(request);
  const eventId = cleanEventId(request.data?.eventId);
  const ctx = await resolveRunnerLiveContext(identity, eventId);
  const current = String(ctx.participant.status || "not_started").toLowerCase();
  if (!ctx.member?.participantId || !ctx.member?.routeId) throw new HttpsError("failed-precondition", "No puedes iniciar sin un recorrido asignado.");
  if (current === "finished") throw new HttpsError("failed-precondition", "Este recorrido ya está finalizado.");
  if (["racing", "started"].includes(current)) {
    return { ok: true, recovered: true, eventId, runId: ctx.runId, status: "racing", startedAt: ctx.participant.startedAt || null };
  }
  if (!["not_started", "ready"].includes(current)) throw new HttpsError("failed-precondition", "Estado de salida no válido.");
  const now = Date.now();
  await ctx.participantRef.update({ status: "racing", online: true, startedAt: now, lastSeen: now, updatedAt: now });
  await appendAudit("RUNNER_STARTED", identity.uid, identity.uid, { eventId, ownerUid: ctx.ownerUid, runId: ctx.runId });
  return { ok: true, eventId, runId: ctx.runId, status: "racing", startedAt: now };
});

exports.runnerFinishRace = onCall({ enforceAppCheck: false }, async request => {
  const identity = requireVerified(request);
  const eventId = cleanEventId(request.data?.eventId);
  const ctx = await resolveRunnerLiveContext(identity, eventId);
  const current = String(ctx.participant.status || "").toLowerCase();
  if (current === "finished") {
    // Idempotente: si RTDB ya marcaba llegada pero Firestore falló o no existía aún,
    // reconstruimos el resultado oficial al reintentar.
    const saved = await persistRunnerResult({
      eventRef: ctx.eventRef,
      eventData: ctx.eventData,
      ownerUid: ctx.ownerUid,
      eventId,
      baseRef: ctx.baseRef,
      runId: ctx.runId,
      uid: ctx.uid,
      participant: ctx.participant,
      cutoffAt: ctx.participant.finishedAt || Date.now(),
      source: "runner_finish_recovery"
    });
    return {
      ok: true, recovered: true, eventId, runId: ctx.runId, status: "finished",
      finishedAt: ctx.participant.finishedAt || null,
      resultPersisted: true,
      trackPointCount: saved.trackPointCount,
      durationMs: saved.durationMs
    };
  }
  if (!["racing", "started"].includes(current)) throw new HttpsError("failed-precondition", "Debes iniciar el recorrido antes de finalizarlo.");
  const now = Date.now();
  const finishedParticipant = { ...ctx.participant, status: "finished", online: true, finishedAt: now, lastSeen: now, updatedAt: now };
  await ctx.participantRef.update({ status: "finished", online: true, finishedAt: now, lastSeen: now, updatedAt: now });

  const saved = await persistRunnerResult({
    eventRef: ctx.eventRef,
    eventData: ctx.eventData,
    ownerUid: ctx.ownerUid,
    eventId,
    baseRef: ctx.baseRef,
    runId: ctx.runId,
    uid: ctx.uid,
    participant: finishedParticipant,
    cutoffAt: now,
    source: "runner_finish"
  });

  await appendAudit("RUNNER_FINISHED", identity.uid, identity.uid, {
    eventId, ownerUid: ctx.ownerUid, runId: ctx.runId,
    trackPointCount: saved.trackPointCount,
    durationMs: saved.durationMs
  });
  return {
    ok: true, eventId, runId: ctx.runId, status: "finished", finishedAt: now,
    resultPersisted: true,
    trackPointCount: saved.trackPointCount,
    durationMs: saved.durationMs
  };
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

      let memberData = memberSnap.data() || {};
      if (String(memberData.status || "active").toLowerCase() !== "active") return null;

      const status = String(data.status || "draft").toLowerCase();
      const ownerUid = String(data.ownerUid || "").trim();
      if (!ownerUid || !wantedStatuses.includes(status)) return null;

      // H4.2: miembros aceptados antes de esta fase reciben su recorrido al
      // consultar una carrera ya PUBLICADA/EN DIRECTO. Los nuevos se asignan al aceptar.
      if ((status === "published" || status === "live") && (!memberData.participantId || !memberData.routeId)) {
        try {
          const assignment = await ensureMemberRouteAssignment(eventSnap.ref, data, uid, { allowLive: true });
          memberData = { ...memberData, ...assignment };
        } catch (assignmentError) {
          console.error("[MILITOPO getRunnerLiveEvents assignment]", { eventId, uid, message: assignmentError?.message || String(assignmentError) });
          if (assignmentError instanceof HttpsError) throw assignmentError;
          throw new HttpsError("internal", "No se pudo asignar tu recorrido.");
        }
      }

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
        participantCount: Math.max(0, Number(activeRun.participantCount || 0)),
        ...memberRouteSummary(memberData)
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


// H3 · Histórico permanente del corredor autenticado.
// Consulta Firestore desde backend y devuelve únicamente documentos cuyo runnerUid
// coincide con la cuenta autenticada. RTDB no interviene en esta vista.
exports.getRunnerHistory = onCall({ enforceAppCheck: false }, async request => {
  const identity = requireVerified(request);
  const uid = String(identity.uid || "").trim();
  const requestedLimit = Math.max(1, Math.min(200, Number(request.data?.limit || 100)));

  try {
    // Igual que getRunnerLiveEvents, evitamos depender de índices collectionGroup.
    // Recorremos únicamente estados capaces de contener un resultado H1 y leemos
    // exactamente results/{uid}; así nunca se consultan resultados de otros runners.
    const statuses = ["live", "finished", "archived"];
    const eventSnaps = await Promise.all(
      statuses.map(status => db.collection("events").where("status", "==", status).limit(250).get())
    );
    const events = new Map();
    for (const querySnap of eventSnaps) {
      querySnap.forEach(eventSnap => events.set(eventSnap.id, eventSnap));
    }

    const eventRows = Array.from(events.values());
    const results = [];
    const batchSize = 150;
    for (let offset = 0; offset < eventRows.length; offset += batchSize) {
      const slice = eventRows.slice(offset, offset + batchSize);
      const refs = slice.map(eventSnap => eventSnap.ref.collection("results").doc(uid));
      const resultSnaps = refs.length ? await db.getAll(...refs) : [];
      resultSnaps.forEach((docSnap, index) => {
        if (!docSnap.exists) return;
        const row = docSnap.data() || {};
        if (String(row.runnerUid || uid) !== uid) return;
        const eventSnap = slice[index];
        const eventData = eventSnap?.data() || {};
        const status = String(row.status || "not_started").toLowerCase();
        results.push({
          eventId: String(row.eventId || eventSnap?.id || "").slice(0, 120),
          eventName: String(row.eventName || eventData.eventName || "Carrera de orientación").slice(0, 140),
          eventStatus: String(eventData.status || "").toLowerCase(),
          ownerUid: String(row.ownerUid || eventData.ownerUid || "").slice(0, 160),
          runId: String(row.runId || "").slice(0, 180),
          status: ["finished", "incomplete", "not_started"].includes(status) ? status : "not_started",
          startedAtMs: Math.max(0, Number(row.startedAtMs || 0)) || null,
          finishedAtMs: Math.max(0, Number(row.finishedAtMs || 0)) || null,
          durationMs: row.durationMs == null ? null : Math.max(0, Number(row.durationMs || 0)),
          trackDistanceM: Math.max(0, Number(row.trackDistanceM || 0)),
          trackPointCount: Math.max(0, Number(row.trackPointCount || 0)),
          trackChunkCount: Math.max(0, Number(row.trackChunkCount || 0)),
          consolidatedAtMs: typeof row.consolidatedAt?.toMillis === "function" ? row.consolidatedAt.toMillis() : null
        });
      });
    }

    results.sort((a, b) => {
      const at = Number(a.finishedAtMs || a.startedAtMs || a.consolidatedAtMs || 0);
      const bt = Number(b.finishedAtMs || b.startedAtMs || b.consolidatedAtMs || 0);
      if (at !== bt) return bt - at;
      return String(a.eventName || "").localeCompare(String(b.eventName || ""), "es");
    });
    if (results.length > requestedLimit) results.length = requestedLimit;

    const summary = results.reduce((acc, row) => {
      acc.total += 1;
      if (row.status === "finished") acc.finished += 1;
      else if (row.status === "incomplete") acc.incomplete += 1;
      else acc.notStarted += 1;
      return acc;
    }, { total: 0, finished: 0, incomplete: 0, notStarted: 0 });

    return { ok: true, uid, results, summary };
  } catch (error) {
    console.error("[MILITOPO getRunnerHistory]", {
      uid,
      code: error?.code || null,
      message: error?.message || String(error)
    });
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "No se pudo consultar tu histórico de carreras.");
  }
});


// H4 · Detalle histórico completo de una participación del corredor autenticado.
// Devuelve solo SU resultado, el track persistente y la cartografía lógica del evento
// necesaria para reconstruir el mapa histórico. RTDB no interviene.
exports.getRunnerResultDetail = onCall({ enforceAppCheck: false, timeoutSeconds: 120, memory: "512MiB" }, async request => {
  const identity = requireVerified(request);
  const uid = String(identity.uid || "").trim();
  const eventId = cleanEventId(request.data?.eventId);

  function timestampMs(value) {
    if (!value) return null;
    if (typeof value.toMillis === "function") return value.toMillis();
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  function safeTrackPoint(row) {
    const lat = Number(row?.lat), lng = Number(row?.lng), at = Number(row?.at), seq = Number(row?.seq);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(at) || !Number.isFinite(seq)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180 || at <= 0 || seq <= 0) return null;
    const accuracy = Math.max(0, Number(row?.accuracy || 0));
    return { lat, lng, at, seq, accuracy: Math.round(accuracy * 10) / 10 };
  }
  function sampleForMap(points, maxPoints = 6000) {
    if (points.length <= maxPoints) return points;
    const out = [];
    const used = new Set();
    const last = points.length - 1;
    for (let i = 0; i < maxPoints; i += 1) {
      const index = Math.round((i * last) / (maxPoints - 1));
      if (used.has(index)) continue;
      used.add(index);
      out.push(points[index]);
    }
    return out;
  }

  try {
    const eventRef = db.collection("events").doc(eventId);
    const [eventSnap, resultSnap, memberSnap] = await Promise.all([
      eventRef.get(),
      eventRef.collection("results").doc(uid).get(),
      eventRef.collection("members").doc(uid).get()
    ]);
    if (!eventSnap.exists) throw new HttpsError("not-found", "La carrera ya no existe.");
    if (!resultSnap.exists) throw new HttpsError("not-found", "No existe un resultado histórico tuyo para esta carrera.");

    const eventData = eventSnap.data() || {};
    const result = resultSnap.data() || {};
    const member = memberSnap.exists ? (memberSnap.data() || {}) : {};
    if (String(result.runnerUid || uid) !== uid) {
      throw new HttpsError("permission-denied", "Este resultado no pertenece a tu cuenta.");
    }

    const [chunksSnap, checkpointsSnap, coursesSnap] = await Promise.all([
      resultSnap.ref.collection("trackChunks").get(),
      eventRef.collection("checkpoints").get(),
      eventRef.collection("courses").get()
    ]);

    const chunks = [];
    chunksSnap.forEach(docSnap => {
      const data = docSnap.data() || {};
      chunks.push({ index: Math.max(0, Number(data.index || 0)), points: Array.isArray(data.points) ? data.points : [] });
    });
    chunks.sort((a, b) => a.index - b.index);
    const track = [];
    for (const chunk of chunks) {
      for (const raw of chunk.points) {
        const point = safeTrackPoint(raw);
        if (point) track.push(point);
      }
    }
    track.sort((a, b) => a.seq - b.seq || a.at - b.at);

    const mapTrack = sampleForMap(track, 6000);
    let accuracyCount = 0, accuracySum = 0, accuracyBest = Infinity, accuracyWorst = 0;
    for (const point of track) {
      const value = Number(point.accuracy || 0);
      if (!Number.isFinite(value) || value <= 0) continue;
      accuracyCount += 1; accuracySum += value;
      if (value < accuracyBest) accuracyBest = value;
      if (value > accuracyWorst) accuracyWorst = value;
    }
    const accuracy = accuracyCount ? {
      averageM: Math.round((accuracySum / accuracyCount) * 10) / 10,
      bestM: Math.round(accuracyBest * 10) / 10,
      worstM: Math.round(accuracyWorst * 10) / 10,
      sampleCount: accuracyCount
    } : { averageM: null, bestM: null, worstM: null, sampleCount: 0 };

    const checkpoints = [];
    checkpointsSnap.forEach(docSnap => {
      const row = docSnap.data() || {};
      const lat = Number(row.lat), lon = Number(row.lon ?? row.lng);
      checkpoints.push({
        checkpointId: String(row.checkpointId || docSnap.id || "").slice(0, 80),
        type: ["SALIDA", "LLEGADA", "BALIZA"].includes(String(row.type || "").toUpperCase()) ? String(row.type).toUpperCase() : "BALIZA",
        description: String(row.description || "").slice(0, 240),
        lat: Number.isFinite(lat) ? lat : null,
        lon: Number.isFinite(lon) ? lon : null,
        elevationM: Number.isFinite(Number(row.elevationM)) ? Number(row.elevationM) : null
      });
    });

    const courses = [];
    coursesSnap.forEach(docSnap => {
      const row = docSnap.data() || {};
      courses.push({
        courseId: String(row.courseId || row.routeId || docSnap.id || "").slice(0, 80),
        points: Array.isArray(row.points) ? row.points.map(x => String(x).slice(0, 80)).slice(0, 120) : [],
        assignedParticipantIds: Array.isArray(row.assignedParticipantIds)
          ? [...new Set(row.assignedParticipantIds.map(x => String(x || "").trim()).filter(Boolean))].slice(0, 300)
          : [],
        metrics: row.metrics && typeof row.metrics === "object" ? {
          distanceKm: Number.isFinite(Number(row.metrics.distanceKm)) ? Number(row.metrics.distanceKm) : null,
          positiveM: Number.isFinite(Number(row.metrics.positiveM)) ? Number(row.metrics.positiveM) : null,
          negativeM: Number.isFinite(Number(row.metrics.negativeM)) ? Number(row.metrics.negativeM) : null,
          difficulty: String(row.metrics.difficulty || "").slice(0, 40),
          routeMode: String(row.metrics.routeMode || "").slice(0, 40)
        } : null
      });
    });

    // H4.1 · Resolver el recorrido del corredor sin adivinar.
    // Preferimos una asignación explícita; después una coincidencia con
    // assignedParticipantIds; solo usamos el único recorrido del evento cuando
    // no existe ninguna ambigüedad.
    const cleanKey = value => String(value || "").trim().toLowerCase();
    const explicitCourseId = String(
      result.routeId || result.courseId || member.routeId || member.courseId || ""
    ).trim();
    let selectedCourse = explicitCourseId
      ? courses.find(course => String(course.courseId || "") === explicitCourseId) || null
      : null;
    let courseMatch = selectedCourse ? "explicit" : "";

    if (!selectedCourse) {
      const username = String(result.username || "").replace(/^@/, "").trim();
      const candidates = new Set([
        result.participantId,
        member.participantId,
        member.webParticipantId,
        uid,
        username,
        username ? `@${username}` : "",
        result.email,
        result.displayName
      ].map(cleanKey).filter(Boolean));
      const matched = courses.filter(course =>
        (course.assignedParticipantIds || []).some(value => candidates.has(cleanKey(value)))
      );
      if (matched.length === 1) {
        selectedCourse = matched[0];
        courseMatch = "assigned";
      }
    }
    if (!selectedCourse && courses.length === 1) {
      selectedCourse = courses[0];
      courseMatch = "single_course";
    }

    const reducedDistanceKm = Number.isFinite(Number(selectedCourse?.metrics?.distanceKm))
      ? Number(selectedCourse.metrics.distanceKm)
      : null;

    const startedAtMs = Math.max(0, Number(result.startedAtMs || 0)) || timestampMs(result.startedAt);
    const finishedAtMs = Math.max(0, Number(result.finishedAtMs || 0)) || timestampMs(result.finishedAt);
    const durationMs = result.durationMs == null ? (startedAtMs && finishedAtMs ? Math.max(0, finishedAtMs - startedAtMs) : null) : Math.max(0, Number(result.durationMs || 0));
    const distanceM = Math.max(0, Number(result.trackDistanceM || 0));
    const effectiveRoutePoints = (Array.isArray(result.routePoints) && result.routePoints.length)
      ? result.routePoints
      : (Array.isArray(member.routePoints) && member.routePoints.length)
        ? member.routePoints
        : (Array.isArray(selectedCourse?.points) ? selectedCourse.points : []);
    const controlAnalysis = analyzeControlPasses(track, effectiveRoutePoints, checkpoints, startedAtMs, finishedAtMs);
    if (Number(result.controlAnalysisVersion || 0) !== CONTROL_ANALYSIS_VERSION) {
      await resultSnap.ref.set({
        routePoints: effectiveRoutePoints.slice(0, 120),
        controlAnalysisVersion: controlAnalysis.version,
        controlDetectionMethod: controlAnalysis.method,
        controlExpectedCount: controlAnalysis.expectedCount,
        controlDetectedCount: controlAnalysis.detectedCount,
        controlMissingCount: controlAnalysis.missingCount,
        controlCompletionPct: controlAnalysis.completionPct,
        controlValidation: controlAnalysis.validation,
        controlPasses: controlAnalysis.passes,
        controlAnalyzedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
    const hours = durationMs && durationMs > 0 ? durationMs / 3600000 : 0;
    const avgSpeedKmh = hours > 0 ? Math.round(((distanceM / 1000) / hours) * 100) / 100 : null;
    const paceMinKm = durationMs && distanceM > 0 ? Math.round(((durationMs / 60000) / (distanceM / 1000)) * 100) / 100 : null;

    return {
      ok: true,
      event: {
        eventId,
        eventName: String(result.eventName || eventData.eventName || "Carrera de orientación").slice(0, 140),
        status: String(eventData.status || "").toLowerCase(),
        planScale: Number(eventData.planScale) || null,
        planEquidistanceM: Number(eventData.planEquidistanceM) || null,
        checkpointCount: checkpoints.length,
        courseCount: courses.length,
        participantCount: Math.max(0, Number(eventData.participantCount || 0))
      },
      result: {
        runnerUid: uid,
        runId: String(result.runId || "").slice(0, 180),
        status: ["finished", "incomplete", "not_started"].includes(String(result.status || "")) ? String(result.status) : "not_started",
        startedAtMs: startedAtMs || null,
        finishedAtMs: finishedAtMs || null,
        durationMs: durationMs == null ? null : durationMs,
        trackDistanceM: distanceM,
        reducedDistanceKm,
        courseId: selectedCourse?.courseId || explicitCourseId || null,
        courseDifficulty: String(selectedCourse?.metrics?.difficulty || "").slice(0, 40) || null,
        coursePositiveM: Number.isFinite(Number(selectedCourse?.metrics?.positiveM)) ? Number(selectedCourse.metrics.positiveM) : null,
        courseMatch: courseMatch || null,
        trackPointCount: Math.max(0, Number(result.trackPointCount || track.length)),
        trackChunkCount: Math.max(0, Number(result.trackChunkCount || chunks.length)),
        avgSpeedKmh,
        paceMinKm,
        gpsAccuracy: accuracy,
        controlExpectedCount: controlAnalysis.expectedCount,
        controlDetectedCount: controlAnalysis.detectedCount,
        controlMissingCount: controlAnalysis.missingCount,
        controlCompletionPct: controlAnalysis.completionPct,
        controlValidation: controlAnalysis.validation,
        controlDetectionMethod: controlAnalysis.method,
        source: String(result.source || "").slice(0, 80)
      },
      controlPasses: controlAnalysis.passes,
      checkpoints,
      courses,
      track: mapTrack,
      trackMeta: {
        storedPointCount: track.length,
        returnedPointCount: mapTrack.length,
        downsampled: mapTrack.length < track.length
      }
    };
  } catch (error) {
    console.error("[MILITOPO getRunnerResultDetail]", { uid, eventId, code: error?.code || null, message: error?.message || String(error) });
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "No se pudo cargar el detalle histórico de esta carrera.");
  }
});


// H5 · Clasificación oficial V2.
// Una misma fuente genera la clasificación GENERAL y POR RECORRIDO para
// organizador y corredores. Los puestos se asignan únicamente a FINALIZADOS;
// incompletos y no salieron permanecen visibles, pero sin puesto competitivo.
function h5ResultStatus(value) {
  const status = String(value || "not_started").toLowerCase();
  return ["finished", "incomplete", "not_started"].includes(status) ? status : "not_started";
}
function h5RunnerLabel(row = {}) {
  const displayName = String(row.displayName || "").trim();
  const username = String(row.username || "").replace(/^@/, "").trim();
  if (displayName && username) return `${displayName} (@${username})`;
  if (displayName) return displayName;
  if (username) return `@${username}`;
  return String(row.participantId || "Corredor");
}
function h5Duration(row = {}) {
  const value = Number(row.durationMs);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
function h5RankRows(rows) {
  const statusOrder = { finished: 0, incomplete: 1, not_started: 2 };
  const sorted = [...rows].sort((a, b) => {
    const sa = statusOrder[h5ResultStatus(a.status)] ?? 9;
    const sb = statusOrder[h5ResultStatus(b.status)] ?? 9;
    if (sa !== sb) return sa - sb;
    if (sa === 0) {
      const da = h5Duration(a), dbb = h5Duration(b);
      if (da !== dbb) return (da ?? Number.MAX_SAFE_INTEGER) - (dbb ?? Number.MAX_SAFE_INTEGER);
    }
    const pa = participantOrder(a.participantId), pb = participantOrder(b.participantId);
    if (pa !== pb) return pa - pb;
    return h5RunnerLabel(a).localeCompare(h5RunnerLabel(b), "es", { numeric: true });
  });

  const leaderDuration = h5Duration(sorted.find(row => h5ResultStatus(row.status) === "finished"));
  let previousDuration = null;
  let previousRank = 0;
  let finishedOrdinal = 0;
  return sorted.map(row => {
    const status = h5ResultStatus(row.status);
    const duration = h5Duration(row);
    let rank = null;
    if (status === "finished" && duration != null) {
      finishedOrdinal += 1;
      if (previousDuration !== null && duration === previousDuration) rank = previousRank;
      else rank = finishedOrdinal;
      previousDuration = duration;
      previousRank = rank;
    }
    return {
      ...row,
      status,
      rank,
      gapToLeaderMs: rank != null && leaderDuration != null && duration != null ? Math.max(0, duration - leaderDuration) : null
    };
  });
}
function h5PublicRow(row = {}) {
  return {
    runnerUid: String(row.runnerUid || row.uid || "").slice(0, 180),
    participantId: String(row.participantId || "").slice(0, 80) || null,
    routeId: String(row.routeId || "").slice(0, 80) || null,
    displayName: String(row.displayName || "").slice(0, 120) || null,
    username: String(row.username || "").replace(/^@/, "").slice(0, 40) || null,
    status: h5ResultStatus(row.status),
    rank: row.rank == null ? null : (Number.isFinite(Number(row.rank)) ? Number(row.rank) : null),
    durationMs: h5Duration(row),
    gapToLeaderMs: row.gapToLeaderMs == null ? null : (Number.isFinite(Number(row.gapToLeaderMs)) ? Number(row.gapToLeaderMs) : null),
    startedAtMs: Math.max(0, Number(row.startedAtMs || 0)) || null,
    finishedAtMs: Math.max(0, Number(row.finishedAtMs || 0)) || null,
    trackDistanceM: Math.max(0, Number(row.trackDistanceM || 0)),
    routeDistanceKm: normalizeRouteMetric(row.routeDistanceKm),
    routePositiveM: normalizeRouteMetric(row.routePositiveM),
    routeDifficulty: String(row.routeDifficulty || "").slice(0, 40) || null,
    routeControlCount: Math.max(0, Number(row.routeControlCount || 0)),
    controlExpectedCount: Math.max(0, Number(row.controlExpectedCount || 0)),
    controlDetectedCount: Math.max(0, Number(row.controlDetectedCount || 0)),
    controlValidation: String(row.controlValidation || "").slice(0, 40) || null
  };
}

async function buildEventClassification(eventRef, eventData) {
  const [resultsSnap, membersSnap, coursesSnap] = await Promise.all([
    eventRef.collection("results").get(),
    eventRef.collection("members").get(),
    eventRef.collection("courses").get()
  ]);
  const courseById = new Map();
  coursesSnap.forEach(docSnap => {
    const row = docSnap.data() || {};
    const routeId = String(row.routeId || row.courseId || docSnap.id || "").trim();
    if (!routeId) return;
    const metrics = row.metrics && typeof row.metrics === "object" ? row.metrics : {};
    courseById.set(routeId, {
      routeId,
      routeDistanceKm: normalizeRouteMetric(metrics.distanceKm),
      routePositiveM: normalizeRouteMetric(metrics.positiveM),
      routeNegativeM: normalizeRouteMetric(metrics.negativeM),
      routeDifficulty: String(metrics.difficulty || "").slice(0, 40) || null,
      routeControlCount: routeControlCount(row.points)
    });
  });

  const resultByUid = new Map();
  resultsSnap.forEach(docSnap => resultByUid.set(docSnap.id, { runnerUid: docSnap.id, ...(docSnap.data() || {}) }));
  const members = new Map();
  membersSnap.forEach(docSnap => members.set(docSnap.id, { uid: docSnap.id, ...(docSnap.data() || {}) }));
  const uids = new Set([...members.keys(), ...resultByUid.keys()]);
  const profileRefs = [...uids].map(uid => db.collection("users").doc(uid));
  const profileSnaps = profileRefs.length ? await db.getAll(...profileRefs) : [];
  const profiles = new Map();
  profileSnaps.forEach(docSnap => { if (docSnap.exists) profiles.set(docSnap.id, docSnap.data() || {}); });

  const rows = [];
  for (const uid of uids) {
    const member = members.get(uid) || {};
    const result = resultByUid.get(uid) || {};
    // Un miembro retirado que nunca participó no entra en la clasificación.
    const memberStatus = String(member.status || "active").toLowerCase();
    if (!resultByUid.has(uid) && memberStatus !== "active") continue;
    const profile = profiles.get(uid) || {};
    const routeId = String(result.routeId || member.routeId || member.courseId || "").trim();
    const course = courseById.get(routeId) || {};
    const hasResult = resultByUid.has(uid);
    rows.push({
      runnerUid: uid,
      participantId: String(result.participantId || member.participantId || member.webParticipantId || "").slice(0, 80) || null,
      routeId: routeId || null,
      displayName: String(result.displayName || member.displayName || profile.displayName || "").slice(0, 120) || null,
      username: String(result.username || member.username || profile.usernameKey || profile.username || "").replace(/^@/, "").slice(0, 40) || null,
      status: hasResult ? h5ResultStatus(result.status) : "not_started",
      durationMs: hasResult && result.durationMs != null ? Math.max(0, Number(result.durationMs || 0)) : null,
      startedAtMs: hasResult ? (Math.max(0, Number(result.startedAtMs || 0)) || null) : null,
      finishedAtMs: hasResult ? (Math.max(0, Number(result.finishedAtMs || 0)) || null) : null,
      trackDistanceM: hasResult ? Math.max(0, Number(result.trackDistanceM || 0)) : 0,
      routeDistanceKm: normalizeRouteMetric(result.routeDistanceKm ?? member.routeDistanceKm ?? course.routeDistanceKm),
      routePositiveM: normalizeRouteMetric(result.routePositiveM ?? member.routePositiveM ?? course.routePositiveM),
      routeNegativeM: normalizeRouteMetric(result.routeNegativeM ?? member.routeNegativeM ?? course.routeNegativeM),
      routeDifficulty: String(result.routeDifficulty || member.routeDifficulty || course.routeDifficulty || "").slice(0, 40) || null,
      routeControlCount: Math.max(0, Number(result.routeControlCount ?? member.routeControlCount ?? course.routeControlCount ?? 0)),
      controlExpectedCount: Math.max(0, Number(result.controlExpectedCount || 0)),
      controlDetectedCount: Math.max(0, Number(result.controlDetectedCount || 0)),
      controlValidation: String(result.controlValidation || "").slice(0, 40) || null
    });
  }

  const general = h5RankRows(rows);
  const routeIds = [...new Set(rows.map(row => String(row.routeId || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  const byRoute = {};
  const routeSummary = [];
  for (const routeId of routeIds) {
    const ranked = h5RankRows(rows.filter(row => String(row.routeId || "") === routeId));
    byRoute[routeId] = ranked;
    const course = courseById.get(routeId) || {};
    routeSummary.push({
      routeId,
      participantCount: ranked.length,
      finishedCount: ranked.filter(row => row.status === "finished").length,
      routeDistanceKm: normalizeRouteMetric(course.routeDistanceKm ?? ranked[0]?.routeDistanceKm),
      routePositiveM: normalizeRouteMetric(course.routePositiveM ?? ranked[0]?.routePositiveM),
      routeDifficulty: String(course.routeDifficulty || ranked[0]?.routeDifficulty || "").slice(0, 40) || null,
      routeControlCount: Math.max(0, Number(course.routeControlCount ?? ranked[0]?.routeControlCount ?? 0))
    });
  }
  return { general, byRoute, routes: routeSummary };
}

exports.getEventClassification = onCall({ enforceAppCheck: false, timeoutSeconds: 120, memory: "512MiB" }, async request => {
  const identity = requireVerified(request);
  const eventId = cleanEventId(request.data?.eventId);
  try {
    const eventRef = db.collection("events").doc(eventId);
    const [eventSnap, memberSnap, ownResultSnap] = await Promise.all([
      eventRef.get(),
      eventRef.collection("members").doc(identity.uid).get(),
      eventRef.collection("results").doc(identity.uid).get()
    ]);
    if (!eventSnap.exists) throw new HttpsError("not-found", "La carrera ya no existe.");
    const eventData = eventSnap.data() || {};
    const role = String(identity.token.role || "runner");
    const manager = role === "super_admin" || (role === "organizer" && String(eventData.ownerUid || "") === identity.uid);
    if (!manager && !memberSnap.exists && !ownResultSnap.exists) {
      throw new HttpsError("permission-denied", "No perteneces a esta carrera.");
    }

    const built = await buildEventClassification(eventRef, eventData);
    const publicGeneral = built.general.map(h5PublicRow);
    const publicByRoute = {};
    for (const [routeId, rows] of Object.entries(built.byRoute)) publicByRoute[routeId] = rows.map(h5PublicRow);
    const myGeneral = built.general.find(row => row.runnerUid === identity.uid) || null;
    const myRouteRows = myGeneral?.routeId ? (built.byRoute[myGeneral.routeId] || []) : [];
    const myRoute = myRouteRows.find(row => row.runnerUid === identity.uid) || null;

    const counts = publicGeneral.reduce((acc, row) => {
      acc.total += 1;
      if (row.status === "finished") acc.finished += 1;
      else if (row.status === "incomplete") acc.incomplete += 1;
      else acc.notStarted += 1;
      return acc;
    }, { total: 0, finished: 0, incomplete: 0, notStarted: 0 });

    return {
      ok: true,
      event: {
        eventId,
        eventName: String(eventData.eventName || "Carrera de orientación").slice(0, 140),
        status: String(eventData.status || "").toLowerCase(),
        provisional: String(eventData.status || "").toLowerCase() === "live"
      },
      summary: counts,
      routes: built.routes,
      general: publicGeneral,
      byRoute: publicByRoute,
      my: myGeneral ? {
        generalRank: myGeneral.rank == null ? null : (Number.isFinite(Number(myGeneral.rank)) ? Number(myGeneral.rank) : null),
        generalCount: built.general.length,
        generalFinishedCount: built.general.filter(row => row.status === "finished").length,
        generalGapMs: myGeneral.gapToLeaderMs == null ? null : (Number.isFinite(Number(myGeneral.gapToLeaderMs)) ? Number(myGeneral.gapToLeaderMs) : null),
        routeId: myGeneral.routeId || null,
        routeRank: myRoute?.rank == null ? null : (Number.isFinite(Number(myRoute.rank)) ? Number(myRoute.rank) : null),
        routeCount: myRouteRows.length,
        routeFinishedCount: myRouteRows.filter(row => row.status === "finished").length,
        routeGapMs: myRoute?.gapToLeaderMs == null ? null : (Number.isFinite(Number(myRoute.gapToLeaderMs)) ? Number(myRoute.gapToLeaderMs) : null)
      } : null
    };
  } catch (error) {
    console.error("[MILITOPO H5 getEventClassification]", { uid: identity.uid, eventId, code: error?.code || null, message: error?.message || String(error) });
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "No se pudo construir la clasificación de esta carrera.");
  }
});

// F3B hardening · sincronización servidor-servidor de membresías e invitaciones.
// Evita depender de eventos CustomEvent entre dispositivos y mantiene RTDB al día
// aunque ningún organizador tenga la página abierta.
exports.syncLiveMembershipOnWrite = onDocumentWritten("events/{eventId}/members/{uid}", async event => {
  const eventId = cleanEventId(event.params.eventId);
  try {
    await syncLiveAccessForEvent({ uid: "system", token: { role: "super_admin" } }, eventId);
  } catch (error) {
    const code = String(error?.code || "");
    if (code === "failed-precondition" || code === "not-found") {
      console.log("[MILITOPO syncLiveMembershipOnWrite] omitido", { eventId, code });
      return;
    }
    console.error("[MILITOPO syncLiveMembershipOnWrite]", { eventId, code, message: error?.message || String(error) });
    throw error;
  }
});

async function resolveInvitationSignalUid(data) {
  if (!data) return "";
  const direct = String(data.targetUid || "").trim();
  if (direct) return direct;
  const email = String(data.targetEmail || "").trim().toLowerCase();
  if (!email) return "";
  const snap = await db.collection("users").where("email", "==", email).limit(1).get();
  if (snap.empty) return "";
  return String(snap.docs[0].id || snap.docs[0].data()?.uid || "").trim();
}

exports.mirrorInvitationSignal = onDocumentWritten("invitations/{invitationId}", async event => {
  const invitationId = String(event.params.invitationId || "").trim();
  const before = event.data?.before?.exists ? (event.data.before.data() || {}) : null;
  const after = event.data?.after?.exists ? (event.data.after.data() || {}) : null;
  const [beforeUid, afterUid] = await Promise.all([
    resolveInvitationSignalUid(before),
    resolveInvitationSignalUid(after)
  ]);
  const touched = new Set([beforeUid, afterUid].filter(Boolean));
  const updates = {};
  for (const uid of touched) {
    const path = `v2/userSignals/${uid}/invitations/${invitationId}`;
    const isCurrentTarget = uid === afterUid;
    const status = String(after?.status || "").toLowerCase();
    if (isCurrentTarget && after && status === "pending") {
      updates[path] = {
        invitationId,
        eventId: String(after.eventId || ""),
        eventName: String(after.eventName || "Carrera").slice(0, 140),
        status: "pending",
        updatedAt: Date.now()
      };
    } else {
      updates[path] = null;
    }
  }
  if (Object.keys(updates).length) await rtdb.ref().update(updates);
});

