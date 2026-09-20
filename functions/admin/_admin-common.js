"use strict";

const { execFileSync } = require("node:child_process");
const { initializeApp, applicationDefault, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const VALID_ROLES = new Set(["runner", "organizer", "super_admin"]);

function currentProjectId() {
  const fromEnv = String(process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "").trim();
  if (fromEnv) return fromEnv;
  try {
    return String(execFileSync("gcloud", ["config", "get-value", "project"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })).trim();
  } catch (_) {
    return "";
  }
}

function services() {
  const projectId = currentProjectId();
  if (!projectId) throw new Error("No se pudo determinar el proyecto activo de Google Cloud.");
  const app = getApps()[0] || initializeApp({ credential: applicationDefault(), projectId });
  return { projectId, auth: getAuth(app), db: getFirestore(app) };
}

async function resolveUser(auth, identity) {
  const value = String(identity || "").trim();
  if (!value) throw new Error("Falta email o UID.");
  return value.includes("@") ? auth.getUserByEmail(value.toLowerCase()) : auth.getUser(value);
}

function normalizedRole(value) {
  const role = String(value || "").trim().toLowerCase();
  if (!VALID_ROLES.has(role)) throw new Error(`Rol no válido: ${role || "(vacío)"}`);
  return role;
}

module.exports = { FieldValue, VALID_ROLES, normalizedRole, resolveUser, services };
