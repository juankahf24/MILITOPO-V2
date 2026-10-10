/* MILITOPO V2 · R9E · Auth + perfil propio completo + cuenta + foto interactiva con recorte manual.
   La foto se procesa en cliente, se sube a Storage en la ruta propia del usuario
   y se refleja en Auth/Firestore sin afectar al arranque offline. */
import "../bootstrap.js?v=v2-f3b-recovery-signals-20260924";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { normalizeRole } from "./roles.js";
import { openProfilePhotoMenu } from "../profile/profile-photo-ui.js?v=v2-r8l-profile-photo-square-20261009";

const ROOT_ICON_URL = new URL("../../../icons/militopo-512.png", import.meta.url).href;
const TRUSTED_DEVICE_KEY = "militopo_v2_trusted_device";
const KEEP_SESSION_KEY = "militopo_v2_keep_session";
const POST_LOGIN_SELECTOR_KEY = "militopo_v2_post_login_selector";
const AUTH_SNAPSHOT_KEY = "militopo_v2_auth_snapshot";
const LAST_ROLE_KEY = "militopo_v2_last_role";
let enterAppInFlight = null;
let enterAppInFlightUid = "";
const RUNNER_HOME_URL = new URL("../../../orientacion/participante/", import.meta.url).href;
function routeRunnerToParticipant() {
  clearPostLoginSelector();
  try {
    if (/\/orientacion\/participante\//.test(window.location.pathname)) return false;
    // R5B: navegación interna de Auth. Evita que el beforeunload heredado de
    // Topografía muestre “¿Quieres salir del sitio web?” al enviar un runner
    // a su área después del login.
    window.__MILITOPO_AUTH_NAVIGATING = true;
    try { sessionStorage.setItem("militopo_v2_allow_navigation_once", "1"); } catch (_) {}
    window.location.replace(RUNNER_HOME_URL);
    return true;
  } catch (_) {
    window.__MILITOPO_AUTH_NAVIGATING = true;
    try { sessionStorage.setItem("militopo_v2_allow_navigation_once", "1"); } catch (_) {}
    window.location.href = RUNNER_HOME_URL;
    return true;
  }
}


function readAuthSnapshot(uid = "") {
  try {
    const raw = localStorage.getItem(AUTH_SNAPSHOT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (uid && String(data?.uid || "") !== String(uid)) return null;
    return data && typeof data === "object" ? data : null;
  } catch (_) { return null; }
}
function writeAuthSnapshot(value) {
  try { localStorage.setItem(AUTH_SNAPSHOT_KEY, JSON.stringify(value || {})); } catch (_) {}
}
function clearAuthSnapshot() {
  try { localStorage.removeItem(AUTH_SNAPSHOT_KEY); } catch (_) {}
}
function paintAccountFromSnapshot(snapshot = readAuthSnapshot()) {
  if (!snapshot?.uid) return false;
  const role = normalizeRole(snapshot.role || "runner");
  const name = snapshot.displayName || snapshot.email || "Usuario";
  const username = String(snapshot.username || snapshot.usernameKey || "").replace(/^@/, "");
  const badge = el("militopoV2AccountBadge");
  const badgeName = el("m2AuthBadgeName");
  const badgeRole = el("m2AuthBadgeRole");
  if (badgeName) badgeName.textContent = name;
  if (badgeRole) badgeRole.textContent = username ? `@${username} · ${roleLabel(role)}` : roleLabel(role);
  [el("m2AuthAvatar"), el("m2AccountAvatar")].forEach(node => paintAvatar(node, name, snapshot.photoURL || ""));
  if (badge) {
    badge.hidden = false;
    badge.style.removeProperty("display");
  }
  return true;
}
function restoreAccountBadgeVisual() {
  if (state.currentUser) {
    paintAccount(state.currentUser, state.profile?.displayName || state.currentUser.displayName || null);
    if (el("militopoV2AccountBadge")) el("militopoV2AccountBadge").hidden = false;
    return true;
  }
  return paintAccountFromSnapshot();
}
function clearRunnerRestoreHint({ clearSnapshot = false } = {}) {
  try { localStorage.removeItem(LAST_ROLE_KEY); } catch (_) {}
  if (clearSnapshot) clearAuthSnapshot();
  try { document.documentElement.classList.remove("militopo-runner-restore"); } catch (_) {}
}
function isStandaloneMode() {
  try {
    return Boolean((window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true);
  } catch (_) { return false; }
}
function hasCachedAuthSnapshot() {
  const snap = readAuthSnapshot();
  return Boolean(snap?.uid && snap?.role);
}
function hasOfflineRunnerSnapshot() {
  try {
    if (navigator.onLine) return false;
    const raw = localStorage.getItem(AUTH_SNAPSHOT_KEY);
    if (!raw) return false;
    const snap = JSON.parse(raw);
    return Boolean(snap?.uid && snap?.role === "runner" && localStorage.getItem(LAST_ROLE_KEY) === "runner");
  } catch (_) { return false; }
}
async function getTokenResultReliable(user) {
  let token = await withTimeout(user.getIdTokenResult(false).catch(() => null), 8000, null);
  if (token) return token;
  token = await withTimeout(user.getIdTokenResult(true).catch(() => null), 12000, null);
  return token || null;
}
function withTimeout(promise, ms, fallback) {
  return Promise.race([
    Promise.resolve(promise),
    new Promise(resolve => setTimeout(() => resolve(fallback), ms))
  ]);
}

function markPostLoginSelector() {
  try { sessionStorage.setItem(POST_LOGIN_SELECTOR_KEY, "1"); } catch (_) {}
}
function clearPostLoginSelector() {
  try { sessionStorage.removeItem(POST_LOGIN_SELECTOR_KEY); } catch (_) {}
}
function consumePostLoginSelector() {
  try {
    if (sessionStorage.getItem(POST_LOGIN_SELECTOR_KEY) !== "1") return false;
    sessionStorage.removeItem(POST_LOGIN_SELECTOR_KEY);
    return true;
  } catch (_) { return false; }
}
function requestBranchSelectorAfterLogin() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete("modo");
    const next = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, "", next);
  } catch (_) {}
  window.dispatchEvent(new CustomEvent("militopo:v2:show-branch-selector", { detail: { reason: "interactive-login" } }));
}

const state = {
  services: null,
  mode: "login",
  busy: false,
  currentUser: null,
  role: "runner",
  profile: null,
  trustedDeviceAtBoot: false,
  ownOverview: null,
  ownOverviewLoading: false,
  ownOverviewError: ""
};

function boolFromStorage(key, fallback = false) {
  try {
    const value = localStorage.getItem(key);
    if (value === null) return fallback;
    return value === "1";
  } catch (_) { return fallback; }
}
function writeBoolStorage(key, value) {
  try { localStorage.setItem(key, value ? "1" : "0"); } catch (_) {}
}
function trustedDeviceEnabled() { return boolFromStorage(TRUSTED_DEVICE_KEY, false); }
function keepSessionEnabled() { return boolFromStorage(KEEP_SESSION_KEY, true); }

function rememberPersistenceMode(mode) {
  try { sessionStorage.setItem("militopo_v2_auth_persistence_mode", String(mode || "")); } catch (_) {}
}

async function applyCompatiblePersistence(auth, remember) {
  const attempts = remember
    ? [[browserLocalPersistence, "local"], [browserSessionPersistence, "session"], [inMemoryPersistence, "memory"]]
    : [[browserSessionPersistence, "session"], [browserLocalPersistence, "local"], [inMemoryPersistence, "memory"]];
  let lastError = null;
  for (const [persistence, mode] of attempts) {
    try {
      await setPersistence(auth, persistence);
      rememberPersistenceMode(mode);
      return mode;
    } catch (error) {
      lastError = error;
      console.warn(`[MILITOPO V2 Auth] persistence ${mode} no disponible`, error);
    }
  }
  throw lastError || new Error("AUTH_PERSISTENCE_UNAVAILABLE");
}

async function signInCompatible(auth, email, password) {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    if (String(error?.code || "") !== "auth/internal-error") throw error;
    console.warn("[MILITOPO V2 Auth] internal-error; probando persistencias alternativas", error);
  }
  const retries = [[browserLocalPersistence, "local"], [browserSessionPersistence, "session"], [inMemoryPersistence, "memory"]];
  let lastError = null;
  for (const [persistence, mode] of retries) {
    try {
      try { await signOut(auth); } catch (_) {}
      await setPersistence(auth, persistence);
      rememberPersistenceMode(mode);
      await new Promise(resolve => setTimeout(resolve, 180));
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      lastError = error;
      console.warn(`[MILITOPO V2 Auth] login fallback ${mode}`, error);
      if (String(error?.code || "") !== "auth/internal-error") throw error;
    }
  }
  throw lastError || new Error("auth/internal-error");
}

function authReturnUrl() {
  try { return new URL("./", window.location.href).href; }
  catch (_) { return window.location.href; }
}

function roleLabel(role) {
  const labels = {
    runner: "CORREDOR",
    organizer: "ORGANIZADOR",
    super_admin: "SÚPER ADMINISTRADOR"
  };
  return labels[normalizeRole(role)] || "CORREDOR";
}

function buildUi() {
  if (document.getElementById("militopoV2AuthOverlay")) return;
  document.body.insertAdjacentHTML("afterbegin", `
    <div id="militopoV2AuthOverlay" aria-live="polite">
      <section class="m2-auth-card" role="dialog" aria-modal="true" aria-labelledby="m2AuthTitle">
        <div class="m2-auth-brand">
          <img src="${ROOT_ICON_URL}" alt="MILITOPO">
          <h2 id="m2AuthTitle">MILITOPO</h2>
          <p>Acceso seguro · V2</p>
        </div>

        <div id="m2AuthMainView">
          <div class="m2-auth-tabs" role="tablist" aria-label="Acceso">
            <button id="m2AuthLoginTab" class="m2-auth-tab is-active" type="button">INICIAR SESIÓN</button>
            <button id="m2AuthRegisterTab" class="m2-auth-tab" type="button">CREAR CUENTA</button>
          </div>

          <form id="m2AuthForm" class="m2-auth-form" novalidate>
            <div id="m2AuthNameField" class="m2-auth-field" hidden>
              <label for="m2AuthName">Nombre</label>
              <input id="m2AuthName" name="name" autocomplete="name" maxlength="80" placeholder="Nombre y apellidos">
            </div>
            <div id="m2AuthUsernameField" class="m2-auth-field" hidden>
              <label for="m2AuthUsername">Usuario único</label>
              <input id="m2AuthUsername" name="username" autocomplete="username" maxlength="24" autocapitalize="none" spellcheck="false" placeholder="@juankahf23">
              <small>3–24 caracteres: letras, números, punto, guion o guion bajo.</small>
            </div>
            <div class="m2-auth-field">
              <label for="m2AuthEmail">Correo electrónico</label>
              <input id="m2AuthEmail" name="email" type="email" autocomplete="email" inputmode="email" required placeholder="tu@correo.com">
            </div>
            <div class="m2-auth-field">
              <label for="m2AuthPassword">Contraseña</label>
              <input id="m2AuthPassword" name="password" type="password" autocomplete="current-password" minlength="8" required placeholder="Mínimo 8 caracteres">
            </div>
            <div id="m2AuthConfirmField" class="m2-auth-field" hidden>
              <label for="m2AuthPasswordConfirm">Repite la contraseña</label>
              <input id="m2AuthPasswordConfirm" name="passwordConfirm" type="password" autocomplete="new-password" minlength="8" placeholder="Repite la contraseña">
            </div>
            <label class="m2-auth-check">
              <input id="m2AuthRemember" type="checkbox">
              <span>Mantener la sesión iniciada en este dispositivo</span>
            </label>
            <button id="m2AuthSubmit" class="m2-auth-primary" type="submit">ENTRAR</button>
            <div class="m2-auth-actions-row">
              <button id="m2AuthReset" class="m2-auth-link" type="button">He olvidado la contraseña</button>
            </div>
            <p id="m2AuthMessage" role="status"></p>
          </form>
        </div>

        <div id="m2AuthVerifyView" class="m2-auth-verify" hidden>
          <div style="font-size:2rem">✉️</div>
          <h3>Verifica tu correo</h3>
          <p>Hemos enviado un enlace de verificación a <strong id="m2AuthVerifyEmail"></strong>.</p>
          <p>Abre el correo, pulsa el enlace y vuelve aquí.</p>
          <div class="m2-auth-verify-actions">
            <button id="m2AuthVerifiedBtn" class="m2-auth-primary" type="button">YA LO HE VERIFICADO</button>
            <button id="m2AuthResendBtn" class="m2-auth-secondary" type="button">REENVIAR CORREO</button>
            <button id="m2AuthDifferentBtn" class="m2-auth-link" type="button">Usar otra cuenta</button>
          </div>
          <p id="m2AuthVerifyMessage" role="status"></p>
        </div>
      </section>
    </div>

    <div id="militopoV2AccountBadge" hidden>
      <button id="m2AuthAccountBtn" class="m2-auth-account-open" type="button" aria-haspopup="dialog" aria-controls="militopoV2AccountPanel">
        <span class="m2-auth-avatar" id="m2AuthAvatar">M</span>
        <span class="m2-auth-badge-copy">
          <strong id="m2AuthBadgeName">Usuario</strong>
          <small id="m2AuthBadgeRole">runner</small>
        </span>
        <span class="m2-auth-account-caret" aria-hidden="true">⌄</span>
      </button>
    </div>

    <div id="militopoV2AccountPanel" class="m2-account-overlay" hidden>
      <section id="m2SelfProfile" class="m2-self-profile" role="dialog" aria-modal="true" aria-labelledby="m2SelfProfileTitle" hidden>
        <header class="m2-self-profile-head">
          <button id="m2SelfProfileClose" class="m2-self-profile-back" type="button" aria-label="Volver">‹ <span>VOLVER</span></button>
          <div class="m2-self-profile-title"><small>PERFIL DE USUARIO</small><strong id="m2SelfProfileTitle">MI PERFIL</strong><span id="m2SelfProfileSubtitle">MILITOPO</span></div>
          <button id="m2SelfProfileSettings" class="m2-self-profile-settings" type="button">AJUSTES</button>
        </header>
        <main id="m2SelfProfileContent" class="m2-self-profile-main"></main>
      </section>

      <section id="m2AccountEditCard" class="m2-account-card" role="dialog" aria-modal="true" aria-labelledby="m2AccountTitle">
        <header class="m2-account-header">
          <div>
            <button id="m2AccountBackProfile" class="m2-account-back-profile" type="button" hidden>← VOLVER AL PERFIL</button>
            <span class="m2-account-kicker">MILITOPO V2</span>
            <h2 id="m2AccountTitle">Mi cuenta</h2>
          </div>
          <button id="m2AccountClose" class="m2-account-close" type="button" aria-label="Cerrar">×</button>
        </header>

        <div class="m2-account-identity">
          <div class="m2-account-photo-block">
            <button id="m2AccountPhotoBtn" class="m2-account-photo-trigger" type="button" aria-label="Ver opciones de foto de perfil">
              <span class="m2-account-avatar" id="m2AccountAvatar">M</span>
            </button>
          </div>
          <div>
            <strong id="m2AccountIdentityName">Usuario</strong>
            <span id="m2AccountIdentityEmail">correo</span>
            <span class="m2-account-role-badge" id="m2AccountRoleBadge">CORREDOR</span>
          </div>
        </div>

        <form id="m2AccountForm" class="m2-account-form" novalidate>
          <div class="m2-auth-field">
            <label for="m2AccountDisplayName">Nombre para mostrar</label>
            <input id="m2AccountDisplayName" autocomplete="name" maxlength="80" placeholder="Nombre y apellidos">
          </div>

          <div class="m2-auth-field">
            <label for="m2AccountUsername">Usuario único</label>
            <input id="m2AccountUsername" autocomplete="username" maxlength="24" autocapitalize="none" spellcheck="false" placeholder="@tuusuario">
            <small id="m2AccountUsernameHelp">El usuario te identifica para invitaciones. Una vez reservado no se puede cambiar desde la web.</small>
          </div>

          <div class="m2-account-readonly-grid">
            <div class="m2-account-readonly">
              <span>Correo</span>
              <strong id="m2AccountEmail">—</strong>
            </div>
            <div class="m2-account-readonly">
              <span>Verificación</span>
              <strong id="m2AccountVerified">—</strong>
            </div>
            <div class="m2-account-readonly">
              <span>Rol</span>
              <strong id="m2AccountRole">runner</strong>
            </div>
          </div>

          <div class="m2-account-options">
            <label class="m2-account-option">
              <input id="m2AccountKeepSession" type="checkbox">
              <span>
                <strong>Mantener sesión iniciada</strong>
                <small>Conserva el acceso en este navegador.</small>
              </span>
            </label>
            <label class="m2-account-option">
              <input id="m2AccountTrustedDevice" type="checkbox">
              <span>
                <strong>Dispositivo de confianza</strong>
                <small>Permite conservar Firestore offline en este dispositivo. Úsalo solo en un móvil u ordenador personal.</small>
              </span>
            </label>
          </div>

          <p id="m2AccountMessage" class="m2-account-message" role="status"></p>
          <div class="m2-account-actions">
            <button id="m2AccountSave" class="m2-auth-primary" type="submit">GUARDAR CAMBIOS</button>
            <button id="m2AccountReload" class="m2-auth-secondary" type="button" hidden>APLICAR Y RECARGAR</button>
            <button id="m2AccountResetPassword" class="m2-auth-secondary" type="button">ENVIAR CAMBIO DE CONTRASEÑA</button>
            <button id="m2AccountLogout" class="m2-account-danger" type="button">CERRAR SESIÓN</button>
          </div>
        </form>
      </section>
    </div>
  `);
}

function el(id) { return document.getElementById(id); }
function setMessage(text = "", kind = "") {
  const node = el("m2AuthMessage");
  if (!node) return;
  node.textContent = text;
  node.className = kind ? `is-${kind}` : "";
}
function setVerifyMessage(text = "", kind = "") {
  const node = el("m2AuthVerifyMessage");
  if (!node) return;
  node.textContent = text;
  node.className = kind ? `is-${kind}` : "";
}
function setAccountMessage(text = "", kind = "") {
  const node = el("m2AccountMessage");
  if (!node) return;
  node.textContent = text;
  node.className = `m2-account-message${kind ? ` is-${kind}` : ""}`;
}

function initials(name) {
  const clean = String(name || "M").trim();
  if (!clean) return "M";
  const parts = clean.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0].slice(0, 2)).toUpperCase();
}

function paintAvatar(node, name, photoURL = "") {
  if (!node) return;
  const url = String(photoURL || "").trim();
  node.replaceChildren();
  if (url) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = "";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("error", () => { node.textContent = initials(name); }, { once: true });
    node.appendChild(img);
  } else node.textContent = initials(name);
}

async function saveAccountPhotoBlob(blob) {
  if (!state.currentUser || state.busy) return;
  if (!blob) return;
  if (navigator.onLine === false) return setAccountMessage("Necesitas conexión para cambiar la foto de perfil.", "error");
  setBusy(true);
  setAccountMessage("Subiendo foto…");
  try {
    const storageSdk = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js");
    const storage = storageSdk.getStorage(state.services.app);
    const target = storageSdk.ref(storage, `avatars/${state.currentUser.uid}/profile.jpg`);
    await storageSdk.uploadBytes(target, blob, { contentType: "image/jpeg", cacheControl: "public,max-age=3600" });
    const basePhotoURL = await storageSdk.getDownloadURL(target);
    const photoURL = `${basePhotoURL}${basePhotoURL.includes("?") ? "&" : "?"}v=${Date.now()}`;
    await updateProfile(state.currentUser, { photoURL });
    await setDoc(doc(state.services.firestore, "users", state.currentUser.uid), { photoURL, updatedAt: serverTimestamp() }, { merge: true });
    state.profile = { ...(state.profile || {}), photoURL };
    if (state.ownOverview) {
      state.ownOverview = {
        ...state.ownOverview,
        account: { ...(state.ownOverview.account || {}), photoURL },
        profile: { ...(state.ownOverview.profile || {}), photoURL, updatedAtMs: Date.now() }
      };
    }
    paintAccount(state.currentUser, state.profile?.displayName || state.currentUser.displayName || null);
    publishAuthState(state.currentUser, state.profile?.displayName || state.currentUser.displayName || null);
    renderOwnOverview();
    setAccountMessage("Foto de perfil actualizada.", "ok");
  } catch (error) {
    console.error("[MILITOPO V2 photo]", error);
    const code = String(error?.code || "");
    if (code.includes("storage/unauthorized")) setAccountMessage("Storage todavía no permite subir fotos. Despliega las reglas de Storage de este bloque.", "error");
    else setAccountMessage(String(error?.message || "No se pudo actualizar la foto."), "error");
    throw error;
  } finally {
    setBusy(false);
  }
}

function setBusy(busy) {
  state.busy = Boolean(busy);
  ["m2AuthSubmit", "m2AuthVerifiedBtn", "m2AuthResendBtn", "m2AccountSave", "m2AccountResetPassword", "m2AccountLogout", "m2AccountPhotoBtn"].forEach(id => {
    const node = el(id);
    if (node) node.disabled = state.busy;
  });
}

function setMode(mode) {
  state.mode = mode === "register" ? "register" : "login";
  const register = state.mode === "register";
  el("m2AuthLoginTab")?.classList.toggle("is-active", !register);
  el("m2AuthRegisterTab")?.classList.toggle("is-active", register);
  if (el("m2AuthNameField")) el("m2AuthNameField").hidden = !register;
  if (el("m2AuthUsernameField")) el("m2AuthUsernameField").hidden = !register;
  if (el("m2AuthConfirmField")) el("m2AuthConfirmField").hidden = !register;
  const password = el("m2AuthPassword");
  if (password) password.autocomplete = register ? "new-password" : "current-password";
  const submit = el("m2AuthSubmit");
  if (submit) submit.textContent = register ? "CREAR CUENTA" : "ENTRAR";
  const reset = el("m2AuthReset");
  if (reset) reset.hidden = register;
  setMessage("");
}

function showMainView() {
  if (el("m2AuthMainView")) el("m2AuthMainView").hidden = false;
  if (el("m2AuthVerifyView")) el("m2AuthVerifyView").hidden = true;
  if (el("militopoV2AuthOverlay")) el("militopoV2AuthOverlay").hidden = false;
}

function showVerifyView(user) {
  state.currentUser = user;
  if (el("m2AuthMainView")) el("m2AuthMainView").hidden = true;
  if (el("m2AuthVerifyView")) el("m2AuthVerifyView").hidden = false;
  if (el("m2AuthVerifyEmail")) el("m2AuthVerifyEmail").textContent = user?.email || "tu correo";
  if (el("militopoV2AuthOverlay")) el("militopoV2AuthOverlay").hidden = false;
  setVerifyMessage("");
}


function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .slice(0, 24);
}
function validUsername(value) {
  return /^[a-z0-9._-]{3,24}$/.test(normalizeUsername(value));
}
function usernameError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
async function usernameAvailable(raw, ownUid = "") {
  const key = normalizeUsername(raw);
  if (!validUsername(key)) return false;
  const ref = doc(state.services.firestore, "usernames", key);
  const snap = await getDoc(ref);
  return !snap.exists() || String(snap.data()?.uid || "") === String(ownUid || "");
}
async function claimUsername(user, raw, displayName) {
  const key = normalizeUsername(raw);
  if (!validUsername(key)) {
    throw usernameError("username/invalid", "El usuario debe tener entre 3 y 24 caracteres y solo puede usar letras, números, punto, guion o guion bajo.");
  }
  const { firestore } = state.services;
  const directoryRef = doc(firestore, "usernames", key);
  const profileRef = doc(firestore, "users", user.uid);

  await runTransaction(firestore, async transaction => {
    const directorySnap = await transaction.get(directoryRef);
    const profileSnap = await transaction.get(profileRef);
    if (directorySnap.exists() && String(directorySnap.data()?.uid || "") !== String(user.uid)) {
      throw usernameError("username/taken", `@${key} ya está utilizado por otra cuenta.`);
    }
    const currentKey = normalizeUsername(profileSnap.exists() ? profileSnap.data()?.usernameKey : "");
    if (currentKey && currentKey !== key) {
      throw usernameError("username/locked", `Tu cuenta ya tiene el usuario @${currentKey}.`);
    }
    const now = serverTimestamp();
    transaction.set(directoryRef, {
      uid: user.uid,
      username: key,
      usernameKey: key,
      displayName: String(displayName || user.displayName || "").trim().slice(0, 80) || null,
      createdAt: directorySnap.exists() ? (directorySnap.data()?.createdAt || now) : now,
      updatedAt: now
    }, { merge: true });
    transaction.set(profileRef, {
      uid: user.uid,
      email: user.email || null,
      emailVerified: Boolean(user.emailVerified),
      displayName: String(displayName || user.displayName || "").trim().slice(0, 80) || null,
      username: key,
      usernameKey: key,
      updatedAt: now,
      ...(profileSnap.exists() ? {} : { createdAt: now })
    }, { merge: true });
  });
  return key;
}
async function updateDirectoryDisplayName(profile, displayName) {
  const key = normalizeUsername(profile?.usernameKey || profile?.username);
  if (!key) return;
  await setDoc(doc(state.services.firestore, "usernames", key), {
    uid: state.currentUser.uid,
    username: key,
    usernameKey: key,
    displayName: String(displayName || "").trim().slice(0, 80) || null,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function ensureRunnerProfile(user) {
  const { firestore } = state.services;
  const ref = doc(firestore, "users", user.uid);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    const created = {
      uid: user.uid,
      email: user.email || null,
      emailVerified: Boolean(user.emailVerified),
      displayName: user.displayName || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(ref, created);
    return { displayName: user.displayName || null, username: null, usernameKey: null };
  }
  const profile = snapshot.data() || {};
  if (user.emailVerified && profile.emailVerified !== true) {
    await setDoc(ref, { emailVerified: true, updatedAt: serverTimestamp() }, { merge: true });
    profile.emailVerified = true;
  }
  return profile;
}

function publishAuthState(user, displayName) {
  const username = normalizeUsername(state.profile?.usernameKey || state.profile?.username);
  globalThis.MILITOPO_V2_AUTH = Object.freeze({
    uid: user.uid,
    email: user.email || null,
    displayName: displayName || null,
    username: username || null,
    role: state.role,
    emailVerified: Boolean(user.emailVerified),
    photoURL: state.profile?.photoURL || user.photoURL || null
  });
  writeAuthSnapshot(globalThis.MILITOPO_V2_AUTH);
  globalThis.dispatchEvent(new CustomEvent("militopo:v2-auth-ready", {
    detail: globalThis.MILITOPO_V2_AUTH
  }));
}

function paintAccount(user, displayName) {
  const finalName = displayName || user.displayName || user.email || "Usuario";
  const badgeName = el("m2AuthBadgeName");
  const badgeRole = el("m2AuthBadgeRole");
  if (badgeName) badgeName.textContent = finalName;
  if (badgeRole) badgeRole.textContent = state.profile?.usernameKey ? `@${normalizeUsername(state.profile.usernameKey)} · ${roleLabel(state.role)}` : roleLabel(state.role);
  const photoURL = state.profile?.photoURL || user.photoURL || "";
  [el("m2AuthAvatar"), el("m2AccountAvatar")].forEach(node => paintAvatar(node, finalName, photoURL));
  if (el("m2AccountIdentityName")) el("m2AccountIdentityName").textContent = finalName;
  if (el("m2AccountIdentityEmail")) el("m2AccountIdentityEmail").textContent = user.email || "";
  if (el("m2AccountDisplayName")) el("m2AccountDisplayName").value = finalName === user.email ? "" : finalName;
  const username = normalizeUsername(state.profile?.usernameKey || state.profile?.username);
  if (el("m2AccountUsername")) {
    el("m2AccountUsername").value = username ? `@${username}` : "";
    el("m2AccountUsername").disabled = Boolean(username);
  }
  if (el("m2AccountUsernameHelp")) {
    el("m2AccountUsernameHelp").textContent = username
      ? `Tu identificador es @${username}.`
      : "Elige un @usuario único para que otros organizadores puedan encontrarte e invitarte.";
  }
  if (el("m2AccountEmail")) el("m2AccountEmail").textContent = user.email || "—";
  if (el("m2AccountVerified")) el("m2AccountVerified").textContent = user.emailVerified ? "Verificado ✓" : "Pendiente";
  if (el("m2AccountRole")) el("m2AccountRole").textContent = roleLabel(state.role);
  const roleBadge = el("m2AccountRoleBadge");
  if (roleBadge) {
    roleBadge.textContent = roleLabel(state.role);
    roleBadge.dataset.role = normalizeRole(state.role);
  }
  if (el("m2AccountKeepSession")) el("m2AccountKeepSession").checked = keepSessionEnabled();
  if (el("m2AccountTrustedDevice")) el("m2AccountTrustedDevice").checked = trustedDeviceEnabled();
}

async function enterAppCore(user) {
  const cached = readAuthSnapshot(user.uid);
  state.currentUser = user;

  // Si ya conocemos que esta cuenta es runner, restauramos inmediatamente una
  // vista de mínimo privilegio. Firestore/Functions siguen aplicando los permisos reales.
  if (cached?.role === "runner") {
    state.role = "runner";
    state.profile = {
      displayName: cached.displayName || user.displayName || null,
      username: cached.username || null,
      usernameKey: cached.username || null,
      photoURL: cached.photoURL || user.photoURL || null
    };
    const quickName = state.profile.displayName || user.displayName || user.email || null;
    paintAccount(user, quickName);
    if (el("militopoV2AccountBadge")) el("militopoV2AccountBadge").hidden = false;
    if (el("militopoV2AuthOverlay")) el("militopoV2AuthOverlay").hidden = true;
    publishAuthState(user, quickName);
    try { globalThis.dispatchEvent(new CustomEvent("militopo:v2-runner-dashboard", { detail: globalThis.MILITOPO_V2_AUTH })); } catch (_) {}
  }

  const [tokenResult, profileResult] = await Promise.all([
    getTokenResultReliable(user),
    withTimeout(ensureRunnerProfile(user).catch(() => null), 8000, null)
  ]);

  // Si Firebase no ha devuelto todavía el token, NO degradamos una cuenta privilegiada
  // silenciosamente a runner. Solo usamos un snapshot del MISMO uid; si tampoco existe,
  // abortamos esta preparación y dejamos que Auth reintente/recargue de forma segura.
  if (!tokenResult && !cached?.role) {
    throw new Error("ROLE_RESOLUTION_TIMEOUT");
  }
  state.role = tokenResult
    ? normalizeRole(tokenResult?.claims?.role || "runner")
    : normalizeRole(cached.role);
  state.profile = profileResult || state.profile || {
    displayName: cached?.displayName || user.displayName || null,
    username: cached?.username || null,
    usernameKey: cached?.username || null,
    photoURL: cached?.photoURL || user.photoURL || null
  };
  const displayName = state.profile?.displayName || cached?.displayName || user.displayName || null;

  if (state.role !== "runner") clearRunnerRestoreHint();
  if (state.role === "runner") {
    paintAccount(user, displayName);
    if (el("militopoV2AuthOverlay")) el("militopoV2AuthOverlay").hidden = true;
    if (routeRunnerToParticipant()) return;
    publishAuthState(user, displayName);
    try { globalThis.dispatchEvent(new CustomEvent("militopo:v2-runner-dashboard", { detail: globalThis.MILITOPO_V2_AUTH })); } catch (_) {}
    return;
  }
  paintAccount(user, displayName);
  if (el("militopoV2AccountBadge")) el("militopoV2AccountBadge").hidden = false;
  if (el("militopoV2AuthOverlay")) el("militopoV2AuthOverlay").hidden = true;
  publishAuthState(user, displayName);

  if (consumePostLoginSelector()) {
    queueMicrotask(requestBranchSelectorAfterLogin);
  }
}

async function enterApp(user) {
  const uid = String(user?.uid || "");
  if (!uid) throw new Error("AUTH_USER_REQUIRED");
  if (enterAppInFlight && enterAppInFlightUid === uid) return enterAppInFlight;
  enterAppInFlightUid = uid;
  enterAppInFlight = enterAppCore(user).finally(() => {
    if (enterAppInFlightUid === uid) {
      enterAppInFlight = null;
      enterAppInFlightUid = "";
    }
  });
  return enterAppInFlight;
}


function profileEsc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
}
function profileTsMs(value) {
  try {
    if (Number.isFinite(Number(value)) && Number(value) > 0) return Number(value);
    if (typeof value?.toMillis === "function") return value.toMillis();
    if (value?.seconds) return Number(value.seconds) * 1000;
    const parsed = Date.parse(value || "");
    return Number.isFinite(parsed) ? parsed : 0;
  } catch (_) { return 0; }
}
function profileDate(value, withTime = true) {
  const ms = profileTsMs(value);
  if (!ms) return "";
  try {
    return new Intl.DateTimeFormat("es-ES", withTime
      ? { day:"2-digit", month:"2-digit", year:"2-digit", hour:"2-digit", minute:"2-digit" }
      : { day:"2-digit", month:"2-digit", year:"numeric" }).format(ms);
  } catch (_) { return new Date(ms).toLocaleString("es-ES"); }
}
function profileKm(meters) {
  const km = Math.max(0, Number(meters || 0)) / 1000;
  return `${km.toLocaleString("es-ES", { minimumFractionDigits: km >= 100 ? 0 : 1, maximumFractionDigits: 1 })} km`;
}
function profilePenalty(ms) {
  const total = Math.max(0, Math.round(Number(ms || 0) / 60000));
  const h = Math.floor(total / 60), m = total % 60;
  return h ? `+${h} h ${String(m).padStart(2,"0")} min` : `+${m} min`;
}
function profileResultLabel(value) {
  return ({ finished:"FINALIZADA", incomplete:"INCOMPLETA", not_started:"NO SALIÓ" }[String(value || "not_started").toLowerCase()] || String(value || "—").toUpperCase());
}
function profileIcon(name) {
  const paths = {
    mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
    shield:'<path d="M12 3 4.5 6v5.5c0 4.4 3.1 7.5 7.5 9.5 4.4-2 7.5-5.1 7.5-9.5V6L12 3Z"/>',
    race:'<path d="M4 20V5m0 1h11l-2 3 2 3H4"/><path d="M18 13v7M15 20h6"/>',
    trophy:'<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6"/>',
    route:'<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h3a3 3 0 0 0 3-3v-6a3 3 0 0 1 3-3h-1"/>',
    mountain:'<path d="m3 19 6-10 4 6 2-3 6 7H3Z"/><path d="m8 11 2 2 2-2"/>',
    target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    discard:'<circle cx="12" cy="12" r="9"/><path d="m8 8 8 8M16 8l-8 8"/>',
    flag:'<path d="M5 21V4m0 1h10l-2 3 2 3H5"/>',
    activity:'<path d="M3 12h4l2-5 4 10 2-5h6"/>',
    alert:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    penalty:'<path d="M13 2 5 14h6l-1 8 9-13h-6V2Z"/>',
    refresh:'<path d="M20 6v5h-5M4 18v-5h5"/><path d="M18 9a7 7 0 0 0-12-2L4 11M6 15a7 7 0 0 0 12 2l2-4"/>'
  };
  return `<svg class="m2-self-icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.activity}</svg>`;
}
function profileLine(iconName, label, value, sub = "", kind = "") {
  return `<div class="m2-self-line ${profileEsc(kind)}"><span class="m2-self-line-icon">${profileIcon(iconName)}</span><div class="m2-self-line-copy"><small>${profileEsc(label)}</small>${sub ? `<span>${profileEsc(sub)}</span>` : ""}</div><strong>${profileEsc(value)}</strong></div>`;
}
function isFullOwnProfileRole() {
  return ["organizer", "super_admin"].includes(normalizeRole(state.role || "runner"));
}
function renderOwnOverview() {
  const host = el("m2SelfProfileContent");
  if (!host || !state.currentUser) return;
  const currentName = state.profile?.displayName || state.currentUser.displayName || state.currentUser.email || "Usuario";
  const currentUsername = normalizeUsername(state.profile?.usernameKey || state.profile?.username);
  const currentPhoto = state.profile?.photoURL || state.currentUser.photoURL || "";
  const currentRole = normalizeRole(state.role || "runner");
  if (state.ownOverviewLoading && !state.ownOverview) {
    host.innerHTML = `<div class="m2-self-state">${profileIcon("activity")}<strong>Cargando actividad MILITOPO…</strong></div>`;
    return;
  }
  const d = state.ownOverview || {};
  const account = d.account || {};
  const profile = d.profile || {};
  const runner = d.runner || {};
  const organizer = d.organizer || {};
  const role = normalizeRole(account.role || currentRole);
  const name = profile.displayName || currentName;
  const username = String(profile.username || currentUsername || "").replace(/^@/, "");
  const photoURL = profile.photoURL || account.photoURL || currentPhoto;
  const verified = account.emailVerified ?? Boolean(state.currentUser.emailVerified);
  const active = account.disabled !== true;
  const completion = Number(runner.started || 0) > 0 ? `${Math.round((Number(runner.finished || 0) / Math.max(1, Number(runner.started || 0))) * 100)}%` : "0%";
  const created = profileDate(account.creationTimeMs || profile.createdAtMs, false);
  const lastAccess = profileDate(account.lastSignInTimeMs, true);
  const updated = profileDate(profile.updatedAtMs, true);
  const organizerVisible = ["organizer", "super_admin"].includes(role) || Number(organizer.total || 0) > 0;
  const hasRunner = Number(runner.participations || 0) > 0 || Number(runner.trackDistanceM || 0) > 0;
  const runnerLines = [
    profileLine("race", "PARTICIPACIONES", Number(runner.participations || 0)),
    profileLine("trophy", "FINALIZADAS", Number(runner.finished || 0)),
    profileLine("route", "KM RECORRIDOS", profileKm(runner.trackDistanceM), "Distancia GPS acumulada"),
    profileLine("mountain", "DESNIVEL + ACUMULADO", `${Math.round(Number(runner.positiveM || 0)).toLocaleString("es-ES")} m`, "Suma de ascensos positivos"),
    profileLine("target", "CONTROLES", Number(runner.controlDetectedCount || 0)),
    profileLine("discard", "DESCARTES", Number(runner.discardedControlCount || 0)),
    profileLine("flag", "CARRERAS INICIADAS", Number(runner.started || 0)),
    profileLine("activity", "INCOMPLETAS", Number(runner.incomplete || 0), "", "is-warn"),
    profileLine("alert", "NO SALIÓ", Number(runner.notStarted || 0), "", "is-muted"),
    profileLine("trophy", "TASA DE FINALIZACIÓN", completion, "", "is-good"),
    profileLine("penalty", "PENALIZACIÓN ACUMULADA", profilePenalty(runner.penaltyMs), "", "is-warn")
  ].join("");
  const organizerLines = organizerVisible ? [
    profileLine("race", "CARRERAS CREADAS", Number(organizer.total || 0)),
    profileLine("activity", "EN DIRECTO", Number(organizer.live || 0)),
    profileLine("flag", "PUBLICADAS", Number(organizer.published || 0)),
    profileLine("target", "PREPARADAS", Number(organizer.prepared || 0)),
    profileLine("refresh", "BORRADORES", Number(organizer.draft || 0)),
    profileLine("check", "CERRADAS", Number(organizer.finished || 0) + Number(organizer.archived || 0))
  ].join("") : "";
  const dateBits = [
    created ? `<div><small>REGISTRO</small><strong>${profileEsc(created)}</strong></div>` : "",
    lastAccess ? `<div><small>ÚLTIMO ACCESO</small><strong>${profileEsc(lastAccess)}</strong></div>` : "",
    updated ? `<div><small>PERFIL ACTUALIZADO</small><strong>${profileEsc(updated)}</strong></div>` : ""
  ].filter(Boolean).join("");
  const lastRaceDate = profileDate(runner.lastRace?.atMs, true);
  host.innerHTML = `
    <section class="m2-self-hero">
      <div class="m2-self-identity">
        <button id="m2SelfProfilePhotoBtn" class="m2-self-photo" type="button" aria-label="Ver o cambiar foto de perfil"><span id="m2SelfAvatar" class="m2-self-avatar"></span></button>
        <div><small>MI PERFIL</small><h3>${profileEsc(name)}</h3><p>${username ? `@${profileEsc(username)}` : "Sin nombre de usuario"}</p></div>
      </div>
      <div class="m2-self-badges"><span class="m2-self-role">${profileIcon("shield")} ${profileEsc(roleLabel(role))}</span><span class="m2-self-status ${active ? "is-active" : "is-disabled"}">${profileIcon(active ? "shield" : "alert")} ${active ? "ACTIVA" : "BLOQUEADA"}</span></div>
    </section>
    <section class="m2-self-detail">
      <div class="m2-self-account"><span class="m2-self-line-icon">${profileIcon("mail")}</span><div><small>CORREO</small><strong>${profileEsc(account.email || state.currentUser.email || "Sin correo")}</strong></div><span class="m2-self-mail ${verified ? "is-ok" : "is-pending"}" title="${verified ? "Correo verificado" : "Correo pendiente"}">${profileIcon(verified ? "check" : "alert")}</span></div>
      ${dateBits ? `<div class="m2-self-dates">${dateBits}</div>` : ""}
      <div class="m2-self-activity ${organizerVisible ? "has-organizer" : ""}">
        <section class="m2-self-section"><div class="m2-self-section-title"><strong>ACTIVIDAD COMO CORREDOR</strong><small>Resumen acumulado en MILITOPO</small></div>${hasRunner ? `<div class="m2-self-lines">${runnerLines}</div>${runner.lastRace?.eventName ? `<div class="m2-self-last"><span class="m2-self-line-icon">${profileIcon("flag")}</span><div><small>ÚLTIMA PARTICIPACIÓN</small><strong>${profileEsc(runner.lastRace.eventName)}</strong><span>${profileEsc(profileResultLabel(runner.lastRace.status))}${lastRaceDate ? ` · ${profileEsc(lastRaceDate)}` : ""}</span></div></div>` : ""}` : `<div class="m2-self-empty">${profileIcon("route")}<div><strong>SIN PARTICIPACIONES</strong><span>Todavía no hay actividad como corredor.</span></div></div>`}</section>
        ${organizerVisible ? `<section class="m2-self-section m2-self-organizer"><div class="m2-self-section-title"><strong>ACTIVIDAD COMO ORGANIZADOR</strong><small>Resumen de carreras creadas</small></div><div class="m2-self-lines">${organizerLines}</div></section>` : ""}
      </div>
      ${state.ownOverviewError ? `<div class="m2-self-inline-error">${profileEsc(state.ownOverviewError)}</div>` : ""}
    </section>`;
  paintAvatar(el("m2SelfAvatar"), name, photoURL);
  if (el("m2SelfProfileTitle")) el("m2SelfProfileTitle").textContent = name;
  if (el("m2SelfProfileSubtitle")) el("m2SelfProfileSubtitle").textContent = `${username ? `@${username} · ` : ""}${roleLabel(role)}`;
}
async function loadOwnOverview(force = false) {
  if (!state.currentUser || !isFullOwnProfileRole()) return;
  if (state.ownOverviewLoading) return;
  if (state.ownOverview && !force) { renderOwnOverview(); return; }
  state.ownOverviewLoading = true;
  state.ownOverviewError = "";
  renderOwnOverview();
  try {
    const result = await state.services.callable("getMyUserOverview", {});
    state.ownOverview = result?.data || null;
    if (!state.ownOverview) throw new Error("La ficha no devolvió datos.");
  } catch (error) {
    console.error("[MILITOPO R9E own profile]", error);
    state.ownOverviewError = navigator.onLine === false
      ? "Sin conexión: se muestran los datos locales disponibles."
      : "No se pudo actualizar la actividad. Comprueba que getMyUserOverview está desplegada.";
  } finally {
    state.ownOverviewLoading = false;
    renderOwnOverview();
  }
}
function showSelfProfileView() {
  const profile = el("m2SelfProfile"), edit = el("m2AccountEditCard");
  if (profile) profile.hidden = false;
  if (edit) edit.hidden = true;
  document.body.classList.add("m2-self-profile-open");
  renderOwnOverview();
}
function showAccountEditView() {
  const profile = el("m2SelfProfile"), edit = el("m2AccountEditCard");
  if (profile) profile.hidden = true;
  if (edit) edit.hidden = false;
  if (el("m2AccountBackProfile")) el("m2AccountBackProfile").hidden = !isFullOwnProfileRole();
  document.body.classList.remove("m2-self-profile-open");
}

function openAccountPanel() {
  if (!state.currentUser) return;
  paintAccount(state.currentUser, state.profile?.displayName || state.currentUser.displayName || null);
  setAccountMessage("");
  if (el("m2AccountReload")) el("m2AccountReload").hidden = true;
  if (el("militopoV2AccountPanel")) el("militopoV2AccountPanel").hidden = false;
  if (isFullOwnProfileRole()) {
    showSelfProfileView();
    loadOwnOverview(false);
  } else {
    showAccountEditView();
  }
}
function closeAccountPanel() {
  if (el("militopoV2AccountPanel")) el("militopoV2AccountPanel").hidden = true;
  document.body.classList.remove("m2-self-profile-open");
}

function friendlyError(error) {
  const code = String(error?.code || "");
  const table = {
    "auth/invalid-email": "El correo no es válido.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/user-disabled": "Esta cuenta está deshabilitada.",
    "auth/email-already-in-use": "Ya existe una cuenta con ese correo.",
    "auth/weak-password": "La contraseña no cumple los requisitos de seguridad.",
    "auth/too-many-requests": "Demasiados intentos. Espera unos minutos y vuelve a probar.",
    "auth/network-request-failed": "No hay conexión con Firebase. Comprueba Internet.",
    "auth/missing-password": "Introduce la contraseña.",
    "auth/requires-recent-login": "Por seguridad, vuelve a iniciar sesión antes de hacer este cambio.",
    "auth/user-not-found": "No existe una cuenta con ese correo. Pulsa CREAR CUENTA si es tu primer acceso.",
    "auth/wrong-password": "Correo o contraseña incorrectos.",
    "auth/operation-not-allowed": "El acceso por correo y contraseña no está disponible ahora.",
    "auth/unsupported-persistence-type": "Este navegador no admite el modo de sesión solicitado. MILITOPO intentará un modo compatible.",
    "auth/web-storage-unsupported": "Este navegador tiene bloqueado el almacenamiento necesario para conservar la sesión.",
    "auth/internal-error": "Firebase ha devuelto un error interno al iniciar sesión incluso en modo de compatibilidad. Cierra esta pestaña, vuelve a abrir MILITOPO e inténtalo una vez más.",
    "ROLE_RESOLUTION_TIMEOUT": "Firebase no ha podido confirmar el rol de esta cuenta todavía. Comprueba la conexión y vuelve a intentarlo; MILITOPO no cambiará la cuenta a runner por defecto.",
    "auth/unauthorized-continue-uri": "Firebase no acepta la dirección de retorno para verificar el correo.",
    "auth/invalid-continue-uri": "La dirección de retorno del correo de verificación no es válida.",
    "auth/user-token-expired": "La sesión ha caducado. Pulsa USAR OTRA CUENTA e inicia sesión de nuevo.",
    "permission-denied": "Tu cuenta está verificada, pero Firebase ha rechazado el acceso al perfil. Vuelve a iniciar sesión.",
    "firestore/permission-denied": "Tu cuenta está verificada, pero Firebase ha rechazado el acceso al perfil. Vuelve a iniciar sesión.",
    "username/invalid": "El usuario debe tener entre 3 y 24 caracteres y solo puede usar letras, números, punto, guion o guion bajo.",
    "username/taken": "Ese @usuario ya está utilizado. Elige otro.",
    "username/locked": "Tu cuenta ya tiene un @usuario asignado."
  };
  if (table[code]) return table[code];
  return code ? `No se ha podido completar la operación (${code}).` : "No se ha podido completar la operación. Vuelve a intentarlo.";
}

async function sendVerification(user) {
  if (!user) throw new Error("No hay una sesión activa para verificar.");
  try {
    await sendEmailVerification(user, {
      url: authReturnUrl(),
      handleCodeInApp: false
    });
  } catch (error) {
    const code = String(error?.code || "");
    if (code === "auth/unauthorized-continue-uri" || code === "auth/invalid-continue-uri") {
      await sendEmailVerification(user);
      return;
    }
    throw error;
  }
}

async function handleSubmit(event) {
  event.preventDefault();
  if (state.busy) return;
  const email = String(el("m2AuthEmail")?.value || "").trim().toLowerCase();
  const password = String(el("m2AuthPassword")?.value || "");
  const remember = Boolean(el("m2AuthRemember")?.checked);
  if (!email || !password) return setMessage("Introduce correo y contraseña.", "error");

  if (state.mode === "register") {
    const name = String(el("m2AuthName")?.value || "").trim();
    const username = normalizeUsername(el("m2AuthUsername")?.value || "");
    const confirm = String(el("m2AuthPasswordConfirm")?.value || "");
    if (!name) return setMessage("Introduce tu nombre.", "error");
    if (!validUsername(username)) return setMessage("Elige un @usuario de 3–24 caracteres: letras, números, punto, guion o guion bajo.", "error");
    if (password.length < 8) return setMessage("Usa una contraseña de al menos 8 caracteres.", "error");
    if (password !== confirm) return setMessage("Las contraseñas no coinciden.", "error");
    try {
      if (!(await usernameAvailable(username))) return setMessage(`@${username} ya está utilizado. Elige otro.`, "error");
    } catch (error) {
      console.error("[MILITOPO V2 Auth] username availability", error);
      return setMessage("No se pudo comprobar el @usuario. Comprueba Internet y vuelve a intentarlo.", "error");
    }
  }

  // Login interactivo: no reutilizar el hint/snapshot de una cuenta runner anterior.
  // El rol se resolverá de nuevo desde el token de la cuenta que está entrando.
  clearRunnerRestoreHint({ clearSnapshot: true });
  markPostLoginSelector();
  setBusy(true);
  setMessage(state.mode === "register" ? "Creando cuenta…" : "Iniciando sesión…");
  try {
    writeBoolStorage(KEEP_SESSION_KEY, remember);
    const persistenceMode = await applyCompatiblePersistence(state.services.auth, remember);
    if (persistenceMode === "memory") {
      writeBoolStorage(KEEP_SESSION_KEY, false);
    }
    if (state.mode === "register") {
      const credential = await createUserWithEmailAndPassword(state.services.auth, email, password);
      const name = String(el("m2AuthName")?.value || "").trim();
      const username = normalizeUsername(el("m2AuthUsername")?.value || "");
      if (name) await updateProfile(credential.user, { displayName: name });
      await claimUsername(credential.user, username, name);
      showVerifyView(credential.user);
      try {
        await sendVerification(credential.user);
        setVerifyMessage("Correo de verificación enviado. Abre el enlace del correo y después pulsa YA LO HE VERIFICADO.", "ok");
      } catch (verificationError) {
        console.error("[MILITOPO V2 Auth] verification email", verificationError);
        setVerifyMessage(`${friendlyError(verificationError)} Puedes pulsar REENVIAR CORREO para intentarlo otra vez.`, "error");
      }
    } else {
      const credential = await signInCompatible(state.services.auth, email, password);
      if (!credential.user.emailVerified) {
        showVerifyView(credential.user);
        setVerifyMessage("Esta cuenta existe, pero el correo todavía no está verificado. Abre el enlace recibido o pulsa REENVIAR CORREO.", "error");
      } else await enterApp(credential.user);
    }
  } catch (error) {
    clearPostLoginSelector();
    console.error("[MILITOPO V2 Auth]", error);
    setMessage(friendlyError(error), "error");
  } finally {
    setBusy(false);
  }
}

async function saveAccount(event) {
  event.preventDefault();
  if (!state.currentUser || state.busy) return;
  const name = String(el("m2AccountDisplayName")?.value || "").trim();
  const requestedUsername = normalizeUsername(el("m2AccountUsername")?.value || "");
  const keepSession = Boolean(el("m2AccountKeepSession")?.checked);
  const trustedDevice = Boolean(el("m2AccountTrustedDevice")?.checked);
  if (!name) return setAccountMessage("Introduce un nombre para mostrar.", "error");
  if (name.length > 80) return setAccountMessage("El nombre es demasiado largo.", "error");
  if (!normalizeUsername(state.profile?.usernameKey || state.profile?.username) && !validUsername(requestedUsername)) {
    return setAccountMessage("Elige un @usuario de 3–24 caracteres.", "error");
  }

  setBusy(true);
  setAccountMessage("Guardando…");
  try {
    const beforeTrusted = trustedDeviceEnabled();
    await updateProfile(state.currentUser, { displayName: name });
    await setDoc(doc(state.services.firestore, "users", state.currentUser.uid), {
      displayName: name,
      emailVerified: Boolean(state.currentUser.emailVerified),
      updatedAt: serverTimestamp()
    }, { merge: true });

    let username = normalizeUsername(state.profile?.usernameKey || state.profile?.username);
    if (!username) {
      username = await claimUsername(state.currentUser, requestedUsername, name);
    } else {
      await updateDirectoryDisplayName(state.profile, name);
    }

    await setPersistence(state.services.auth, keepSession ? browserLocalPersistence : browserSessionPersistence);
    writeBoolStorage(KEEP_SESSION_KEY, keepSession);
    writeBoolStorage(TRUSTED_DEVICE_KEY, trustedDevice);

    state.profile = { ...(state.profile || {}), displayName: name, username, usernameKey: username };
    if (state.ownOverview) {
      state.ownOverview = { ...state.ownOverview, profile: { ...(state.ownOverview.profile || {}), displayName: name, username, updatedAtMs: Date.now() } };
    }
    paintAccount(state.currentUser, name);
    publishAuthState(state.currentUser, name);
    renderOwnOverview();

    if (beforeTrusted !== trustedDevice || state.trustedDeviceAtBoot !== trustedDevice) {
      setAccountMessage("Cambios guardados. Recarga para aplicar el modo offline de este dispositivo.", "ok");
      if (el("m2AccountReload")) el("m2AccountReload").hidden = false;
    } else {
      setAccountMessage("Cambios guardados.", "ok");
    }
  } catch (error) {
    console.error("[MILITOPO V2 Account]", error);
    setAccountMessage(friendlyError(error), "error");
  } finally {
    setBusy(false);
  }
}

async function init() {
  buildUi();
  // I5.4: en iOS standalone el badge fixed puede perderse entre navegaciones aunque
  // la sesión siga guardada. Pintamos de inmediato desde el snapshot local y Firebase
  // lo confirmará/actualizará después.
  restoreAccountBadgeVisual();
  state.trustedDeviceAtBoot = trustedDeviceEnabled();
  if (el("m2AuthRemember")) el("m2AuthRemember").checked = keepSessionEnabled();
  setMode("login");
  try {
    state.services = await globalThis.MILITOPO_V2.firebase();
  } catch (error) {
    console.error("[MILITOPO V2 Auth] Firebase init", error);
    showMainView();
    setMessage("Firebase no está disponible. Revisa la configuración V2.", "error");
    return;
  }

  el("m2AuthLoginTab")?.addEventListener("click", () => setMode("login"));
  el("m2AuthRegisterTab")?.addEventListener("click", () => setMode("register"));
  el("m2AuthForm")?.addEventListener("submit", handleSubmit);

  el("m2AuthReset")?.addEventListener("click", async () => {
    const email = String(el("m2AuthEmail")?.value || "").trim().toLowerCase();
    if (!email) return setMessage("Escribe primero tu correo electrónico.", "error");
    setBusy(true);
    try {
      await sendPasswordResetEmail(state.services.auth, email, { url: authReturnUrl() });
      setMessage("Te hemos enviado un correo para restablecer la contraseña.", "ok");
    } catch (error) {
      setMessage(friendlyError(error), "error");
    } finally { setBusy(false); }
  });

  el("m2AuthVerifiedBtn")?.addEventListener("click", async () => {
    const user = state.services?.auth?.currentUser || state.currentUser;
    if (!user) {
      setVerifyMessage("La sesión de verificación ya no está activa. Pulsa USAR OTRA CUENTA e inicia sesión.", "error");
      return;
    }
    setBusy(true);
    setVerifyMessage("Comprobando la verificación con Firebase…");
    try {
      await reload(user);
      const current = state.services.auth.currentUser || user;
      if (!current.emailVerified) {
        setVerifyMessage("Todavía no consta como verificado. Primero abre el enlace que Firebase ha enviado a tu correo y, después, vuelve aquí y pulsa este botón.", "error");
      } else {
        await current.getIdToken(true);
        await enterApp(current);
        setVerifyMessage("");
      }
    } catch (error) {
      console.error("[MILITOPO V2 Auth] verify check", error);
      setVerifyMessage(friendlyError(error), "error");
    } finally { setBusy(false); }
  });

  el("m2AuthResendBtn")?.addEventListener("click", async () => {
    if (!state.currentUser) return;
    setBusy(true);
    try {
      await sendVerification(state.currentUser);
      setVerifyMessage("Correo reenviado. Revisa también spam/no deseado.", "ok");
    } catch (error) {
      setVerifyMessage(friendlyError(error), "error");
    } finally { setBusy(false); }
  });

  el("m2AuthDifferentBtn")?.addEventListener("click", async () => {
    await signOut(state.services.auth);
    state.currentUser = null;
    showMainView();
    setMode("login");
  });

  el("m2AuthAccountBtn")?.addEventListener("click", openAccountPanel);
  el("m2AccountClose")?.addEventListener("click", closeAccountPanel);
  el("m2SelfProfileClose")?.addEventListener("click", closeAccountPanel);
  el("m2SelfProfileSettings")?.addEventListener("click", showAccountEditView);
  el("m2AccountBackProfile")?.addEventListener("click", () => { showSelfProfileView(); loadOwnOverview(false); });
  el("m2SelfProfileContent")?.addEventListener("click", event => {
    if (!event.target.closest("#m2SelfProfilePhotoBtn")) return;
    const name = state.profile?.displayName || state.currentUser?.displayName || state.currentUser?.email || "Usuario";
    const photoURL = state.profile?.photoURL || state.currentUser?.photoURL || "";
    openProfilePhotoMenu({ photoURL, name, canChange: true, onSave: saveAccountPhotoBlob });
  });
  el("m2AccountForm")?.addEventListener("submit", saveAccount);
  el("m2AccountPhotoBtn")?.addEventListener("click", () => {
    const name = state.profile?.displayName || state.currentUser?.displayName || state.currentUser?.email || "Usuario";
    const photoURL = state.profile?.photoURL || state.currentUser?.photoURL || "";
    openProfilePhotoMenu({ photoURL, name, canChange: true, onSave: saveAccountPhotoBlob });
  });
  el("m2AccountReload")?.addEventListener("click", () => window.location.reload());
  el("m2AccountResetPassword")?.addEventListener("click", async () => {
    const email = state.currentUser?.email;
    if (!email || state.busy) return;
    setBusy(true);
    setAccountMessage("Enviando correo…");
    try {
      await sendPasswordResetEmail(state.services.auth, email, { url: authReturnUrl() });
      setAccountMessage("Correo para cambiar la contraseña enviado. Revisa tu bandeja de entrada.", "ok");
    } catch (error) {
      setAccountMessage(friendlyError(error), "error");
    } finally { setBusy(false); }
  });

  el("m2AccountLogout")?.addEventListener("click", async () => {
    if (state.busy) return;
    setBusy(true);
    try {
      closeAccountPanel();
      await signOut(state.services.auth);
    } finally { setBusy(false); }
  });

  el("militopoV2AccountPanel")?.addEventListener("click", event => {
    if (event.target === el("militopoV2AccountPanel")) closeAccountPanel();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !el("militopoV2AccountPanel")?.hidden) closeAccountPanel();
  });

  // I5.4: WebKit standalone puede perder la capa fixed del badge al volver de otra vista.
  // Repintarlo desde Auth/snapshot no altera permisos; solo restaura la UI de cuenta.
  globalThis.addEventListener("pageshow", () => queueMicrotask(restoreAccountBadgeVisual));
  globalThis.addEventListener("militopo:v2-auth-ready", () => queueMicrotask(restoreAccountBadgeVisual));
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) setTimeout(restoreAccountBadgeVisual, 60);
  });

  onAuthStateChanged(state.services.auth, async user => {
    try {
      if (!user) {
        // I2.1/I5.4: Firebase Auth puede tardar en rehidratarse en iOS standalone.
        // Mantener visualmente el badge/snapshot durante una ventana corta NO concede
        // permisos: organizer-guard/Firestore/Functions siguen dependiendo de Auth real.
        if (hasOfflineRunnerSnapshot() || (isStandaloneMode() && hasCachedAuthSnapshot())) {
          restoreAccountBadgeVisual();
          closeAccountPanel();
          if (el("militopoV2AuthOverlay")) el("militopoV2AuthOverlay").hidden = true;
          if (navigator.onLine && isStandaloneMode()) {
            setTimeout(() => {
              const current = state.services?.auth?.currentUser;
              if (current) {
                enterApp(current).catch(error => console.warn("[MILITOPO V2 Auth] standalone rehydrate", error));
                return;
              }
              // Si tras la gracia sigue sin existir Auth real, volver al flujo normal de login.
              state.currentUser = null;
              state.profile = null;
              closeAccountPanel();
              if (el("militopoV2AccountBadge")) el("militopoV2AccountBadge").hidden = true;
              clearAuthSnapshot();
              try { globalThis.dispatchEvent(new CustomEvent("militopo:v2-auth-signed-out")); } catch (_) {}
              showMainView();
            }, 4500);
          }
          return;
        }
        state.currentUser = null;
        state.profile = null;
        closeAccountPanel();
        if (el("militopoV2AccountBadge")) el("militopoV2AccountBadge").hidden = true;
        clearAuthSnapshot();
        try { globalThis.dispatchEvent(new CustomEvent("militopo:v2-auth-signed-out")); } catch (_) {}
        showMainView();
        return;
      }
      state.currentUser = user;
      if (!user.emailVerified) {
        showVerifyView(user);
        return;
      }
      await enterApp(user);
    } catch (error) {
      console.error("[MILITOPO V2 Auth] state", error);
      showMainView();
      setMessage("No se ha podido preparar tu sesión. Vuelve a iniciar sesión.", "error");
    }
  });

  globalThis.addEventListener("militopo:v2-auth-recovery-failed", () => {
    // Offline no invalida una sesión local runner ya conocida. La revalidación
    // se hará al recuperar conectividad.
    if (hasOfflineRunnerSnapshot()) return;
    clearAuthSnapshot();
    try { localStorage.removeItem("militopo_v2_last_role"); } catch (_) {}
    closeAccountPanel();
    showMainView();
    setMode("login");
    setMessage("Tu sesión anterior no pudo restaurarse. Inicia sesión una vez para guardar la sesión con el modo estable.", "error");
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}

