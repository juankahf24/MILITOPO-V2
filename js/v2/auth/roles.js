export const MILITOPO_ROLES = Object.freeze({
  SUPER_ADMIN: "super_admin",
  ORGANIZER: "organizer",
  RUNNER: "runner"
});

export function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  return Object.values(MILITOPO_ROLES).includes(role) ? role : MILITOPO_ROLES.RUNNER;
}

export function canOrganize(role) {
  const normalized = normalizeRole(role);
  return normalized === MILITOPO_ROLES.SUPER_ADMIN || normalized === MILITOPO_ROLES.ORGANIZER;
}

export function isSuperAdmin(role) {
  return normalizeRole(role) === MILITOPO_ROLES.SUPER_ADMIN;
}
