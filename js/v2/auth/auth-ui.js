/* MILITOPO V2 · Fase B3 · Auth + perfil/cuenta en Firebase Spark.
   Sin Cloud Functions ni Storage. Roles privilegiados siguen administrándose
   exclusivamente con Firebase Admin SDK desde Cloud Shell. */
import "../bootstrap.js";
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

const ROOT_ICON_URL = new URL("../../../icons/militopo-512.png", import.meta.url).href;
const TRUSTED_DEVICE_KEY = "militopo_v2_trusted_device";
const KEEP_SESSION_KEY = "militopo_v2_keep_session";
const POST_LOGIN_SELECTOR_KEY = "militopo_v2_post_login_selector";
const RUNNER_LANDING_URL = new URL("../../../orientacion/participante/", import.meta.url).href;

function isRunnerArea() {
  try { return /\/orientacion\/participante(?:\/|$)/.test(new URL(window.location.href).pathname); }
  catch (_) { return false; }
}

function routeRunnerToParticipant() {
  clearPostLoginSelector();
  if (isRunnerArea()) return false;
  try { window.location.replace(RUNNER_LANDING_URL); }
  catch (_) { window.location.href = RUNNER_LANDING_URL; }
  return true;
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
  trustedDeviceAtBoot: false
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

async function applyCompatiblePersistence(auth, remember) {
  const preferred = remember ? browserLocalPersistence : browserSessionPersistence;
  try {
    await setPersistence(auth, preferred);
    return remember ? "local" : "session";
  } catch (error) {
    console.warn("[MILITOPO V2 Auth] persistence fallback", error);
  }

  if (preferred !== browserSessionPersistence) {
    try {
      await setPersistence(auth, browserSessionPersistence);
      return "session";
    } catch (error) {
      console.warn("[MILITOPO V2 Auth] session persistence fallback", error);
    }
  }

  await setPersistence(auth, inMemoryPersistence);
  return "memory";
}

async function signInCompatible(auth, email, password) {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    if (String(error?.code || "") !== "auth/internal-error") throw error;
    console.warn("[MILITOPO V2 Auth] internal-error; retrying with memory persistence", error);
    try { await signOut(auth); } catch (_) {}
    await setPersistence(auth, inMemoryPersistence);
    await new Promise(resolve => setTimeout(resolve, 250));
    return await signInWithEmailAndPassword(auth, email, password);
  }
}

function authReturnUrl() {
  try { return new URL("./", window.location.href).href; }
  catch (_) { return window.location.href; }
}

function roleLabel(role) {
  const labels = {
    runner: "runner",
    organizer: "organizer",
    super_admin: "super_admin"
  };
  return labels[normalizeRole(role)] || "runner";
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
      <section class="m2-account-card" role="dialog" aria-modal="true" aria-labelledby="m2AccountTitle">
        <header class="m2-account-header">
          <div>
            <span class="m2-account-kicker">MILITOPO V2</span>
            <h2 id="m2AccountTitle">Mi cuenta</h2>
          </div>
          <button id="m2AccountClose" class="m2-account-close" type="button" aria-label="Cerrar">×</button>
        </header>

        <div class="m2-account-identity">
          <div class="m2-account-avatar" id="m2AccountAvatar">M</div>
          <div>
            <strong id="m2AccountIdentityName">Usuario</strong>
            <span id="m2AccountIdentityEmail">correo</span>
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

function setBusy(busy) {
  state.busy = Boolean(busy);
  ["m2AuthSubmit", "m2AuthVerifiedBtn", "m2AuthResendBtn", "m2AccountSave", "m2AccountResetPassword", "m2AccountLogout"].forEach(id => {
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
    emailVerified: Boolean(user.emailVerified)
  });
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
  [el("m2AuthAvatar"), el("m2AccountAvatar")].forEach(node => { if (node) node.textContent = initials(finalName); });
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
  if (el("m2AccountKeepSession")) el("m2AccountKeepSession").checked = keepSessionEnabled();
  if (el("m2AccountTrustedDevice")) el("m2AccountTrustedDevice").checked = trustedDeviceEnabled();
}

async function enterApp(user) {
  const profile = await ensureRunnerProfile(user);
  const token = await user.getIdTokenResult(true);
  state.role = normalizeRole(token?.claims?.role);
  state.currentUser = user;
  state.profile = profile;
  const displayName = profile?.displayName || user.displayName || null;

  // Un corredor no necesita elegir entre ramas ni entrar en el área Organizador.
  // Su destino normal es directamente MILITOPO Participante.
  if (state.role === "runner" && routeRunnerToParticipant()) {
    return;
  }

  paintAccount(user, displayName);
  if (el("militopoV2AccountBadge")) el("militopoV2AccountBadge").hidden = false;
  if (el("militopoV2AuthOverlay")) el("militopoV2AuthOverlay").hidden = true;
  publishAuthState(user, displayName);

  // organizer/super_admin conservan el selector de ramas tras un login manual.
  if (state.role !== "runner" && consumePostLoginSelector()) {
    queueMicrotask(requestBranchSelectorAfterLogin);
  } else if (state.role === "runner") {
    clearPostLoginSelector();
  }
}

function openAccountPanel() {
  if (!state.currentUser) return;
  paintAccount(state.currentUser, state.profile?.displayName || state.currentUser.displayName || null);
  setAccountMessage("");
  if (el("m2AccountReload")) el("m2AccountReload").hidden = true;
  if (el("militopoV2AccountPanel")) el("militopoV2AccountPanel").hidden = false;
}
function closeAccountPanel() {
  if (el("militopoV2AccountPanel")) el("militopoV2AccountPanel").hidden = true;
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
    paintAccount(state.currentUser, name);
    publishAuthState(state.currentUser, name);

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
  el("m2AccountForm")?.addEventListener("submit", saveAccount);
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

  onAuthStateChanged(state.services.auth, async user => {
    try {
      if (!user) {
        state.currentUser = null;
        state.profile = null;
        closeAccountPanel();
        if (el("militopoV2AccountBadge")) el("militopoV2AccountBadge").hidden = true;
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
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}

