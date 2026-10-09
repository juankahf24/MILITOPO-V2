/* MILITOPO V2 · R8I · Auth + perfil/cuenta + foto de perfil.
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
      <section class="m2-account-card" role="dialog" aria-modal="true" aria-labelledby="m2AccountTitle">
        <header class="m2-account-header">
          <div>
            <span class="m2-account-kicker">MILITOPO V2</span>
            <h2 id="m2AccountTitle">Mi cuenta</h2>
          </div>
          <button id="m2AccountClose" class="m2-account-close" type="button" aria-label="Cerrar">×</button>
        </header>

        <div class="m2-account-identity">
          <div class="m2-account-photo-block">
            <div class="m2-account-avatar" id="m2AccountAvatar">M</div>
            <button id="m2AccountPhotoBtn" class="m2-account-photo-btn" type="button">CAMBIAR FOTO</button>
            <input id="m2AccountPhotoInput" type="file" accept="image/*" hidden>
          </div>
          <div>
            <strong id="m2AccountIdentityName">Usuario</strong>
            <span id="m2AccountIdentityEmail">correo</span>
            <small class="m2-account-photo-help">JPG/PNG · recorte cuadrado automático</small>
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

function imageToSquareJpeg(file, size = 512, quality = 0.86) {
  return new Promise((resolve, reject) => {
    if (!file || !String(file.type || "").startsWith("image/")) return reject(new Error("Selecciona una imagen válida."));
    if (Number(file.size || 0) > 12 * 1024 * 1024) return reject(new Error("La imagen original no puede superar 12 MB."));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("El formato de imagen no es compatible."));
      img.onload = () => {
        try {
          const side = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
          if (!side) throw new Error("La imagen está vacía.");
          const sx = Math.max(0, ((img.naturalWidth || img.width) - side) / 2);
          const sy = Math.max(0, ((img.naturalHeight || img.height) - side) / 2);
          const canvas = document.createElement("canvas");
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext("2d", { alpha: false });
          ctx.fillStyle = "#17231a"; ctx.fillRect(0, 0, size, size);
          ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
          canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("No se pudo preparar la foto.")), "image/jpeg", quality);
        } catch (error) { reject(error); }
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

async function uploadAccountPhoto(file) {
  if (!state.currentUser || state.busy) return;
  if (navigator.onLine === false) return setAccountMessage("Necesitas conexión para cambiar la foto de perfil.", "error");
  setBusy(true);
  setAccountMessage("Preparando foto…");
  try {
    const blob = await imageToSquareJpeg(file);
    const storageSdk = await import("https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js");
    const storage = storageSdk.getStorage(state.services.app);
    const target = storageSdk.ref(storage, `avatars/${state.currentUser.uid}/profile.jpg`);
    setAccountMessage("Subiendo foto…");
    await storageSdk.uploadBytes(target, blob, { contentType: "image/jpeg", cacheControl: "public,max-age=3600" });
    const basePhotoURL = await storageSdk.getDownloadURL(target);
    const photoURL = `${basePhotoURL}${basePhotoURL.includes("?") ? "&" : "?"}v=${Date.now()}`;
    await updateProfile(state.currentUser, { photoURL });
    await setDoc(doc(state.services.firestore, "users", state.currentUser.uid), { photoURL, updatedAt: serverTimestamp() }, { merge: true });
    state.profile = { ...(state.profile || {}), photoURL };
    paintAccount(state.currentUser, state.profile?.displayName || state.currentUser.displayName || null);
    publishAuthState(state.currentUser, state.profile?.displayName || state.currentUser.displayName || null);
    setAccountMessage("Foto de perfil actualizada.", "ok");
  } catch (error) {
    console.error("[MILITOPO V2 photo]", error);
    const code = String(error?.code || "");
    if (code.includes("storage/unauthorized")) setAccountMessage("Storage todavía no permite subir fotos. Despliega las reglas de Storage de este bloque.", "error");
    else setAccountMessage(String(error?.message || "No se pudo actualizar la foto."), "error");
  } finally {
    setBusy(false);
    const input = el("m2AccountPhotoInput"); if (input) input.value = "";
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
  el("m2AccountForm")?.addEventListener("submit", saveAccount);
  el("m2AccountPhotoBtn")?.addEventListener("click", () => el("m2AccountPhotoInput")?.click());
  el("m2AccountPhotoInput")?.addEventListener("change", event => { const file = event.target?.files?.[0]; if (file) uploadAccountPhoto(file); });
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

