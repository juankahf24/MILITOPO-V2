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
      email: String(row.email || "").slice(0, 180)
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
      updatedAt: Date.now()
    };
    // Si la sesión ya está en directo, refresca solo los datos de identidad.
    // No toca estado, online, salida, llegada ni lastSeen.
    if (currentRunActive && member.status === "active") {
      updates[`runs/${currentRunId}/participants/${member.uid}/username`] = member.username || null;
      updates[`runs/${currentRunId}/participants/${member.uid}/displayName`] = member.displayName || null;
      updates[`runs/${currentRunId}/participants/${member.uid}/email`] = member.email || null;
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
      email: member.email || null,
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

  const trackSnap = await baseRef.child(`runs/${runId}/tracks/${uid}`).get();
  const points = normalizeTrackPoints(trackSnap.exists() ? trackSnap.val() : null);
  const memberSnap = await eventRef.collection("members").doc(uid).get();
  const member = memberSnap.exists ? (memberSnap.data() || {}) : {};
  const profileSnap = await db.collection("users").doc(uid).get();
  const profile = profileSnap.exists ? (profileSnap.data() || {}) : {};

  const participantState = String(row.status || "not_started").toLowerCase();
  const finalStatus = resultStatus(participantState);
  const startedAtMs = Math.max(0, Number(row.startedAt || 0)) || null;
  let finishedAtMs = Math.max(0, Number(row.finishedAt || 0)) || null;
  if (!finishedAtMs && finalStatus === "incomplete" && cutoffAt) finishedAtMs = Math.max(0, Number(cutoffAt || 0)) || null;
  const durationMs = startedAtMs && finishedAtMs ? Math.max(0, finishedAtMs - startedAtMs) : null;
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
  return { uid, eventId, eventRef, eventData, ownerUid, baseRef, runId, participantRef, participant: participantSnap.val() || {} };
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
  await ctx.participantRef.update({
    uid: ctx.uid,
    displayName: String(profile.displayName || ctx.participant.displayName || "").slice(0, 120) || null,
    username: String(profile.usernameKey || profile.username || ctx.participant.username || "").replace(/^@/, "").slice(0, 40) || null,
    email: String(profile.email || ctx.participant.email || identity.token.email || "").slice(0, 180) || null,
    status,
    online: true,
    lastSeen: now,
    updatedAt: now
  });
  return { ok: true, eventId, ownerUid: ctx.ownerUid, runId: ctx.runId, status };
});

exports.runnerStartRace = onCall({ enforceAppCheck: false }, async request => {
  const identity = requireVerified(request);
  const eventId = cleanEventId(request.data?.eventId);
  const ctx = await resolveRunnerLiveContext(identity, eventId);
  const current = String(ctx.participant.status || "not_started").toLowerCase();
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
        source: String(result.source || "").slice(0, 80)
      },
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

