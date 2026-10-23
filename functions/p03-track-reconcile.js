"use strict";

// MILITOPO P0.3 — GPS reconciliation is an evidentiary update, NOT a re-scoring.
// This helper deliberately has no Firebase SDK dependency; injectable stores
// permit regression tests without accessing production data.
const { createHash, randomUUID } = require("node:crypto");

const CHUNK_SIZE = 250;
const LEASE_MS = 8 * 60 * 1000;
const PATH_SEGMENT = /^[A-Za-z0-9_-]{1,128}$/;

function safeSegment(s) { return typeof s === "string" && PATH_SEGMENT.test(s); }
function normalize(raw, start, finish) {
  const entries = raw && typeof raw === "object" ? Object.values(raw) : [];
  const points = [];
  let rejected = 0;
  const seen = new Set();
  for (const row of entries) {
    const lat = Number(row?.lat), lng = Number(row?.lng);
    const at = Number(row?.at), seq = Number(row?.seq), accuracy = Number(row?.accuracy);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 ||
        !Number.isFinite(lng) || lng < -180 || lng > 180 ||
        !Number.isSafeInteger(at) || at < 1 ||
        !Number.isSafeInteger(seq) || seq < 1 ||
        !Number.isFinite(accuracy) || accuracy < 0 || accuracy > 5000 ||
        (start && at < start) || (finish && at > finish)) { rejected++; continue; }
    const key = `${seq}|${at}|${lat}|${lng}`;
    if (seen.has(key)) { rejected++; continue; }
    seen.add(key);
    points.push({ lat, lng, at, seq, accuracy: Math.round(accuracy * 10) / 10 });
  }
  points.sort((a, b) => a.seq - b.seq || a.at - b.at);
  return { points, rejected, rawCount: entries.length };
}
function hashPoints(points) {
  const h = createHash("sha256");
  for (const p of points) h.update(`${p.seq}|${p.at}|${p.lat}|${p.lng}|${p.accuracy};`);
  return h.digest("hex");
}
function distanceMeters(points) {
  let sum = 0;
  const rad = Math.PI / 180;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const dp = (b.lat - a.lat) * rad, dl = (b.lng - a.lng) * rad;
    const h = Math.sin(dp / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dl / 2) ** 2;
    const d = 12742000 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
    if (Number.isFinite(d) && d >= 0 && d <= 5000) sum += d;
  }
  return Math.round(sum);
}
function trackPatch(points, fingerprint, revision, rejected, previousCount, stamp) {
  const first = points[0] || null, last = points[points.length - 1] || null;
  const endpoint = p => p ? { lat: p.lat, lng: p.lng, at: p.at, seq: p.seq } : null;
  return {
    activeTrackRevision: revision, trackFingerprintSha256: fingerprint,
    trackPointCount: points.length, trackChunkCount: Math.ceil(points.length / CHUNK_SIZE),
    trackDistanceM: distanceMeters(points), trackStart: endpoint(first), trackEnd: endpoint(last),
    trackReconcileExcludedCount: rejected, trackReconcileNewPointCount: Math.max(0, points.length - previousCount),
    trackReconcileMethod: "p03-gps-only-no-official-rescore", trackReconciledAt: stamp,
    trackReconcileLease: null
  };
}

function createReconciler({ db, rtdb, FieldValue, logger = console }) {
  async function reconcile({ ownerUid, eventId, runId, uid }) {
    if (![ownerUid, eventId, runId, uid].every(safeSegment)) throw new Error("Identificador GPS inseguro.");
    const eventRef = db.collection("events").doc(eventId);
    const eventSnap = await eventRef.get();
    if (!eventSnap.exists) return { state: "event_missing" };
    const eventData = eventSnap.data() || {};
    if (eventData.ownerUid !== ownerUid || String(eventData.liveRunId || "") !== runId) return { state: "other_run" };
    const resultRef = eventRef.collection("results").doc(uid);
    const current = await resultRef.get();
    if (!current.exists) return { state: "result_not_ready" };
    const previous = current.data() || {};
    if (previous.runId !== runId || previous.runnerUid !== uid) return { state: "different_result" };
    // Do not modify results for running participants whose result is not yet final.
    const status = String(eventData.status || "").toLowerCase();
    if (!["finished", "archived"].includes(status) &&
        !["finished", "incomplete"].includes(String(previous.status || "").toLowerCase())) {
      return { state: "result_not_final" };
    }
    const startMs = Number(previous.startedAtMs || 0) || 0;
    const finishMs = Number(previous.finishedAtMs || 0) || 0;
    if (!startMs || String(previous.status || "").toLowerCase() === "not_started") {
      return { state: "not_started" };
    }
    const liveRef = rtdb.ref(`v2/live/${ownerUid}/${eventId}/runs/${runId}/tracks/${uid}`);
    const trackSnap = await liveRef.get();
    const { points, rejected } = normalize(trackSnap.exists() ? trackSnap.val() : null, startMs, finishMs);
    // Un corte de cobertura no debe convertir un track existente en «0 km».
    if (!points.length) return { state: "no_valid_track", rejected };
    const fingerprint = hashPoints(points);
    if (previous.trackFingerprintSha256 === fingerprint &&
        previous.activeTrackRevision && Number(previous.trackPointCount || 0) === points.length) {
      return { state: "already_reconciled", points: points.length };
    }

    const leaseId = randomUUID();
    const now = Date.now();
    const lease = await db.runTransaction(async tx => {
      const snap = await tx.get(resultRef);
      if (!snap.exists) return "missing";
      const result = snap.data() || {};
      if (result.runId !== runId || result.runnerUid !== uid) return "changed_run";
      if (result.trackFingerprintSha256 === fingerprint && result.activeTrackRevision &&
          Number(result.trackPointCount || 0) === points.length) return "already_reconciled";
      if (Number(result.trackReconcileLease?.until || 0) > now) return "busy";
      tx.update(resultRef, { trackReconcileLease: { id: leaseId, until: now + LEASE_MS, startedAt: now } });
      return "acquired";
    });
    if (lease === "busy") throw new Error("P03_RECONCILE_LEASE_BUSY"); // Retryable event.
    if (lease !== "acquired") return { state: lease };

    const revision = `gps_${randomUUID().replace(/-/g, "")}`;
    try {
      // Immutable revision: no legacy chunk is deleted, and the published pointer
      // changes only after ALL new chunks are committed.
      const chunkRoot = resultRef.collection("trackRevisions").doc(revision).collection("chunks");
      for (let i = 0; i < points.length; i += CHUNK_SIZE * 150) {
        const batch = db.batch();
        const last = Math.min(points.length, i + CHUNK_SIZE * 150);
        for (let j = i; j < last; j += CHUNK_SIZE) {
          const part = points.slice(j, j + CHUNK_SIZE), index = Math.floor(j / CHUNK_SIZE);
          batch.set(chunkRoot.doc(`chunk_${String(index).padStart(6, "0")}`), {
            index, pointCount: part.length, firstSeq: part[0]?.seq || null,
            lastSeq: part[part.length - 1]?.seq || null, points: part,
            schemaVersion: 1, createdAt: FieldValue.serverTimestamp()
          });
        }
        await batch.commit();
      }
      // If new points appeared while staging, retry with a new complete snapshot.
      const latest = await liveRef.get();
      const latestPoints = normalize(latest.exists() ? latest.val() : null, startMs, finishMs).points;
      if (hashPoints(latestPoints) !== fingerprint) throw new Error("P03_TRACK_CHANGED_DURING_RECONCILE");

      const patch = trackPatch(points, fingerprint, revision, rejected,
        Math.max(0, Number(previous.trackPointCount || 0)), FieldValue.serverTimestamp());
      const committed = await db.runTransaction(async tx => {
        const snap = await tx.get(resultRef);
        if (!snap.exists) return false;
        const result = snap.data() || {};
        if (result.runId !== runId || result.trackReconcileLease?.id !== leaseId) return false;
        tx.update(resultRef, patch);
        return true;
      });
      if (!committed) throw new Error("P03_RECONCILE_LEASE_LOST");
      logger.info("[MILITOPO P0.3] GPS reconciliado", { eventId, runId, uid, points: points.length, rejected });
      return { state: "reconciled", points: points.length, rejected };
    } catch (error) {
      try {
        await db.runTransaction(async tx => {
          const snap = await tx.get(resultRef);
          if (snap.exists && snap.data()?.trackReconcileLease?.id === leaseId) {
            tx.update(resultRef, { trackReconcileLease: null });
          }
        });
      } catch (releaseError) { logger.error("[MILITOPO P0.3] No se pudo liberar el bloqueo", releaseError); }
      throw error;
    }
  }
  return { reconcile };
}
module.exports = { CHUNK_SIZE, normalize, hashPoints, distanceMeters, trackPatch, safeSegment, createReconciler };
