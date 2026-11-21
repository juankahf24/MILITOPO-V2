/* MILITOPO · Entrada y cambios de pantalla. */
(() => {
  'use strict';
  if (globalThis.MILITOPO_TRANSITION) return;
  // One display-mode flag for every entry document, including the runner.
  const standalone = matchMedia('(display-mode: standalone)');
  const syncDisplayMode = () => document.documentElement.classList.toggle('militopo-pwa-standalone', standalone.matches || navigator.standalone === true);
  syncDisplayMode();
  standalone.addEventListener?.('change', syncDisplayMode);
  addEventListener('pageshow', syncDisplayMode);
  const CONFIG = Object.freeze({minimumMs:3800, exitMs:400, backgroundMs:550, lettersMs:2750, timeoutMs:30000});
  const base = new URL('../../../', document.currentScript.src);
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animations = new WeakMap();
  let entryKind = 'local';
  let active = null;
  let pendingButton = null;

  function lockButton(button) {
    const disabled = button.disabled;
    const busy = button.getAttribute('aria-busy');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    return () => {
      button.disabled = disabled;
      if (busy === null) button.removeAttribute('aria-busy');
      else button.setAttribute('aria-busy', busy);
    };
  }

  async function runInline(button, task) {
    if (active || pendingButton) return false;
    const stop = lockButton(button);
    pendingButton = {stop};
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('La carga está tardando demasiado. Vuelve a intentarlo.')), CONFIG.timeoutMs);
    try {
      await untilAborted(controller.signal, task(controller.signal));
      return true;
    } finally {
      clearTimeout(timer);
      stop();
      pendingButton = null;
    }
  }

  // Cross-document navigation can retain the source snapshot while the destination starts.
  addEventListener('pageswap', event => {
    if (!pendingButton?.leaving || reduced()) event.viewTransition?.skipTransition();
  });
  addEventListener('pagereveal', event => {
    if (!document.documentElement.classList.contains('mp-cross-hold') || reduced()) event.viewTransition?.skipTransition();
  });
  const revealDocument = () => document.documentElement.classList.remove('mp-cross-hold');

  function untilAborted(signal, promise) {
    return new Promise((resolve, reject) => {
      const abort = () => reject(signal.reason);
      if (signal.aborted) { reject(signal.reason); return; }
      signal.addEventListener('abort', abort, {once:true});
      Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
  }

  function delay(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) { reject(signal.reason); return; }
      const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, ms);
      function cancel() { clearTimeout(timer); reject(signal.reason); }
      signal.addEventListener('abort', cancel, {once:true});
    });
  }

  function waitFor(test, signal) {
    return new Promise((resolve, reject) => {
      const observer = new MutationObserver(check);
      const poll = setInterval(check, 100);
      function finish(fn, result) {
        observer.disconnect();
        clearInterval(poll);
        signal.removeEventListener('abort', cancel);
        fn(result);
      }
      function cancel() { finish(reject, signal.reason); }
      function check() {
        try { const result = test(); if (result) finish(resolve, result); }
        catch (error) { finish(reject, error); }
      }
      observer.observe(document.documentElement, {subtree:true, childList:true, attributes:true, attributeFilter:['class','hidden','aria-hidden']});
      signal.addEventListener('abort', cancel, {once:true});
      if (signal.aborted) cancel(); else check();
    });
  }

  // Two animation frames leave one rendering opportunity between the change and the next action.
  const painted = signal => untilAborted(signal, new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  async function fade(node, to, duration, signal) {
    if (signal.aborted) throw signal.reason;
    const from = Number(getComputedStyle(node).opacity);
    node.style.opacity = String(to);
    if (from === to || reduced() || !duration || !node.animate) return;
    const fx = node.animate([{opacity:from}, {opacity:to}], {duration, easing:'ease-in-out'});
    try { await untilAborted(signal, fx.finished); }
    finally { fx.cancel(); }
  }
 const letters=word=>[...word].map((letter,index)=>`<span style="--letter:${index}" aria-hidden="true">${letter}</span>`).join('');
 const logo='<svg class="mp-mountain-mark" viewBox="0 0 440 150" aria-hidden="true"><defs><linearGradient id="mpMountainLight" x1="0" y1="0" x2="0.6" y2="1"><stop stop-color="#F3D787"/><stop offset="1" stop-color="#D8B45F"/></linearGradient></defs><path d="M3 145 111 52l37 30L223 3l94 94 25-18 95 66-98-35-22 10-94-91-72 79-41-32-72 61Z" fill="url(#mpMountainLight)"/><path d="m223 29-19 58 16-9-30 50 39-24-8 26 72 13-47-55 7 27-30-61 7 12ZM111 76l-14 41 20-12-8 24 37-21-23-13ZM342 101l-7 14 26 20-9-18 38 22Z" fill="#283525"/></svg>';

  function mount({kind, splash=false, entering=false, welcome=null}) {
    const root = document.createElement('dialog');
    root.id = 'mpPremiumTransition';
    root.setAttribute('aria-label', splash ? 'Cargando MILITOPO' : 'Cambio de pantalla');
    root.setAttribute('aria-modal', 'true');
    root.tabIndex = -1;

    root.style.opacity = entering ? '0' : '1';
    const scene = document.createElement('div');
    scene.className = 'mp-transition-scene';
    scene.setAttribute('aria-hidden', 'true');
    const content = document.createElement('div');
    content.className = 'mp-transition-content';
    content.innerHTML = splash ? `${logo}<div class="mp-loader-copy"><div class="mp-loader-brackets"><div class="mp-loader-word" aria-label="MILITOPO">${letters('MILITOPO')}</div><div class="mp-loader-line"></div><div class="mp-loader-word is-loading" aria-label="CARGANDO">${letters('CARGANDO')}</div></div><div class="mp-loader-progress" role="progressbar" aria-label="Preparando pantalla"></div><p class="mp-loader-status" role="status" aria-live="polite">Preparando tu entorno</p><div class="mp-loader-actions"></div></div>` : '<div class="mp-loader-copy"><p class="mp-loader-status" role="status"></p><div class="mp-loader-actions"></div></div>';
    if (splash) { scene.style.opacity = '1'; root.append(scene); }
    if (welcome) {
      root.classList.add('mp-welcome');
      root.setAttribute('aria-label', 'Bienvenida');
      content.classList.add('mp-welcome-content');
      const title = document.createElement('div');
      title.className = 'mp-welcome-title';
      title.setAttribute('role', 'status');
      const hello = document.createElement('span');
      hello.textContent = welcome.name ? 'Hola,' : 'Hola';
      const name = document.createElement('strong');
      name.textContent = welcome.name;
      title.append(hello, name);
      content.prepend(title);
      root.style.setProperty('--welcome-elapsed', Math.max(0, Date.now() - welcome.start) + 'ms');
    }
    root.append(content);
    document.body.append(root);
    root.addEventListener('cancel', event => event.preventDefault());
    root.addEventListener('wheel', event => event.preventDefault(), {passive:false});
    const state = {root, scene, content, kind, splash, welcome, promise:null, resolve:null, controller:null, timer:0, leaving:false, entryPending:Boolean(kind)};
    state.promise = new Promise(resolve => { state.resolve = resolve; });
    active = state;
    // Keep the focused form stable during the entrance fade. showModal() would
    // dismiss the software keyboard before this surface becomes opaque.
    state.deferredModal = Boolean(welcome && entering);
    if (state.deferredModal) root.setAttribute('open', '');
    else activateModal(state);
    return state;
  }

  function activateModal(state) {
    const {root} = state;
    if (root.showModal) {
      root.removeAttribute('open');
      root.showModal();
    } else {
      root.setAttribute('open', '');
      root.setAttribute('role', 'dialog');
      state.guard = event => {
        if (!root.contains(event.target)) (root.querySelector('button') || root).focus({preventScroll:true});
      };
      document.addEventListener('focusin', state.guard);
    }
    root.focus({preventScroll:true});
  }

  async function coverReady(state, signal) {
    if (!state.deferredModal) return;
    state.deferredModal = false;
    const editing = document.activeElement?.matches('input,textarea,[contenteditable="true"]');
    activateModal(state);
    if (!editing || !window.visualViewport) return;
    // Wait beneath the opaque cover for the keyboard viewport to catch up.
    // Abort and a bounded deadline keep navigation recoverable on all devices.
    await new Promise((resolve, reject) => {
      const start = performance.now();
      let frame = 0, stable = 0;
      function finish(error) {
        cancelAnimationFrame(frame);
        signal.removeEventListener('abort', abort);
        if (error) reject(error); else resolve();
      }
      function abort() { finish(signal.reason); }
      function check() {
        if (signal.aborted) { abort(); return; }
        const viewport = window.visualViewport;
        const covered = state.root.getBoundingClientRect().height;
        stable = viewport.height >= covered - 2 && Math.abs(viewport.offsetTop) < 2 ? stable + 1 : 0;
        if (stable >= 3 || performance.now() - start >= 1200) finish();
        else frame = requestAnimationFrame(check);
      }
      signal.addEventListener('abort', abort, {once:true});
      frame = requestAnimationFrame(check);
    });
  }

  function release(state, result) {
    if (active !== state) return;
    active = null;
    clearTimeout(state.timer);
    state.controller?.abort();
    if (state.guard) document.removeEventListener('focusin', state.guard);
    if (state.root.open && state.root.close) state.root.close();
    state.root.remove();
    revealDocument();
    state.resolve(result);
  }

  function newAttempt(state) {
    clearTimeout(state.timer);
    state.controller?.abort();
    const controller = new AbortController();
    state.controller = controller;
    state.timer = setTimeout(() => controller.abort(new Error('La carga está tardando más de lo esperado. Puedes reintentar o volver.')), CONFIG.timeoutMs);
    state.root.classList.remove('has-error');
    state.root.querySelector('.mp-loader-actions').replaceChildren();
    state.root.querySelector('.mp-loader-status').textContent = state.splash ? 'Preparando tu entorno' : 'Preparando la pantalla';
    return controller.signal;
  }

  function showError(state, error, retry) {
    clearTimeout(state.timer);
    state.root.style.opacity = '1';
    if (state.deferredModal) { state.deferredModal = false; activateModal(state); }
    state.root.classList.add('has-error');
    revealDocument();
    state.root.querySelector('.mp-loader-copy').style.opacity = '1';
    state.root.querySelector('.mp-loader-status').textContent = error?.message || 'No se pudo preparar la pantalla.';
    const actions = state.root.querySelector('.mp-loader-actions');
    actions.replaceChildren();
    for (const [label, action] of [['REINTENTAR', retry], ['VOLVER', () => release(state, {ok:false, cancelled:true})]]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.onclick = action;
      actions.append(button);
    }
    actions.firstElementChild.focus({preventScroll:true});
  }

  // Only the document that will display the destination creates the moving landscape.
  async function playScene(state, signal) {
    const {scene, root} = state;
    let image = scene.querySelector('img');
    if (!image || (image.complete && !image.naturalWidth)) {
      const picture = document.createElement('picture');
      picture.className = 'mp-transition-bg';
      const portrait = document.createElement('source');
      portrait.media = '(orientation: portrait)';
      portrait.srcset = new URL('assets/transition/militopo-portrait.webp', base).href;
      image = document.createElement('img');
      image.alt = '';
      image.fetchPriority = 'high';
      picture.append(portrait, image);
      const light = document.createElement('div');
      light.className = 'mp-transition-light';
      scene.replaceChildren(picture, light);
      image.src = new URL('assets/transition/militopo-landscape.webp', base).href;
    }
    // Allow <picture> to select its source, including after a rotation during loading.
    try {
      if (image.decode) {
        try { await untilAborted(signal, image.decode()); }
        catch (error) {
          if (signal.aborted) throw error;
          await painted(signal);
          await untilAborted(signal, image.decode());
        }
      } else if (!image.complete) {
        await untilAborted(signal, new Promise((resolve,reject) => { image.onload = resolve; image.onerror = reject; }));
      }
      if (image.naturalWidth) await fade(scene, 1, 0, signal);
    } catch (error) {
      if (signal.aborted) throw error;
      // Artwork is optional offline. Keep the same mark and progress animation over the solid surface.
      scene.style.opacity = '0';
    }
    root.classList.add('has-backdrop');
    await delay(reduced() ? 0 : CONFIG.backgroundMs, signal);
    root.classList.add('has-content');
    if (!reduced()) await delay(CONFIG.lettersMs, signal);
  }

  // CSS backgrounds are not covered by DOM readiness. Warm the visible destination artwork before the exit.
  async function settleView(view, signal) {
    const urls = new Set();
    const surfaces = [document.body, view, ...document.querySelectorAll('.mor-mode-panel,.mpp-r3-hero,.runner-head,.mpp-r3-header,.dashboard-highlight,.m2-auth-hero')];
    for (const node of surfaces) {
      if (!node?.getBoundingClientRect) continue;
      const box = node.getBoundingClientRect();
      if (!box.width || !box.height || box.top >= innerHeight || box.bottom <= 0) continue;
      for (const match of getComputedStyle(node).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
        const url = new URL(match[1], document.baseURI);
        if (url.origin === location.origin) urls.add(url.href);
      }
    }
    const jobs = [...urls].map(url => {
      const image = new Image();
      image.src = url;
      return image.decode?.();
    });
    if (document.fonts) jobs.push(document.fonts.ready);
    await untilAborted(signal, Promise.allSettled(jobs));
    await painted(signal);
  }

  async function present(state, task) {
    const signal = newAttempt(state);
    state.entryPending = Boolean(state.kind);
    state.root.querySelector('.mp-loader-copy').style.removeProperty('opacity');
    try {
      if (!state.splash) {
        await fade(state.root, 1, state.welcome ? 240 : 120, signal);
        await coverReady(state, signal);
        await painted(signal);
      }
      state.intro = state.splash ? Promise.all([
        playScene(state, signal), delay(reduced() ? 0 : CONFIG.minimumMs, signal)
      ]) : state.welcome ? delay(Math.max(0, state.welcome.start + (reduced() ? 450 : 1600) - Date.now()), signal) : Promise.resolve();
      const ready = Promise.resolve().then(() => task(signal)).then(async view => {
        if (signal.aborted) throw signal.reason;
        state.entryPending = false;
        await settleView(view, signal);
        return view;
      });
      const [view] = await untilAborted(signal, Promise.all([ready, state.intro]));
      if (state.leaving) return;
      if (!document.documentElement.classList.contains('mp-cross-hold')) {
        await fade(state.root, 0, state.splash || state.welcome ? CONFIG.exitMs : 150, signal);
      }
      release(state, {ok:true, value:view});
    } catch (error) {
      if (active === state && state.controller.signal === signal && !state.leaving && !state.suspended) {
        state.controller.abort();
        state.content.style.removeProperty('opacity');
        showError(state, error, () => { void present(state, task); });
      }
    }
  }

  async function navigate(target, {replace=false, beforeLeave, button, welcome=null}={}) {
    const url = new URL(target, location.href);
    if (url.origin !== location.origin) throw new Error('La transición solo admite pantallas internas.');
    if (active?.leaving || document.querySelector('#m2RaceV2.m2race-is-racing,[data-militopo-runner-active="true"]')) return false;
    if (pendingButton) return false;
    if (button && !active && !beforeLeave) {
      const stop = lockButton(button);
      const handoff = {stop, leaving:true};
      pendingButton = handoff;
      const controller = new AbortController();
      const timer = setTimeout(() => {
        if (pendingButton !== handoff) return;
        stop();
        pendingButton = null;
        globalThis.__MILITOPO_AUTH_NAVIGATING = false;
        forgetHandoff();
      }, CONFIG.timeoutMs);
      handoff.clear = () => clearTimeout(timer);
      try {
        if (pendingButton !== handoff) return false;
        commitNavigation(url, replace, true);
        return true;
      } catch (error) {
        handoff.clear();
        stop();
        pendingButton = null;
        globalThis.__MILITOPO_AUTH_NAVIGATING = false;
        forgetHandoff();
        throw error;
      }
    }
    const state = active || mount({entering:true, welcome});
    state.leaving = true;
    if (state.splash && state.intro) {
      try {
        await state.intro;
        await Promise.all([state.content, state.scene].map(node => fade(node, 0, 150, state.controller.signal)));
      } catch (_) {}
    }
    const signal = newAttempt(state);
    try {
      await fade(state.root, 1, state.welcome ? 240 : 120, signal);
      await coverReady(state, signal);
      await painted(signal);
      if (beforeLeave) await untilAborted(signal, beforeLeave());
      commitNavigation(url, replace, false, welcome);
      const stalled = () => fail(signal.reason);
      signal.addEventListener('abort', stalled, {once:true});
      return true;
    } catch (error) { fail(error); return false; }

    function fail(error) {
      if (active !== state || state.controller.signal !== signal || !state.leaving || state.suspended) return;
      state.leaving = false;
      globalThis.__MILITOPO_AUTH_NAVIGATING = false;
      try { sessionStorage.removeItem('militopo_v2_allow_navigation_once'); } catch (_) {}
      showError(state, error, () => { void navigate(url.href, {replace, beforeLeave, welcome}); });
    }
  }

  function forgetHandoff() {
    try {
      sessionStorage.removeItem('militopo_screen_handoff');
      sessionStorage.removeItem('militopo_v2_allow_navigation_once');
    } catch (_) {}
  }

  function commitNavigation(url, replace, inline, welcome=null) {
    try {
      sessionStorage.setItem('militopo_screen_handoff', JSON.stringify({url:url.href, time:Date.now(), inline, welcome}));
      sessionStorage.setItem('militopo_v2_allow_navigation_once', '1');
    } catch (_) {}
    globalThis.__MILITOPO_AUTH_NAVIGATING = true;
    if (replace) location.replace(url.href); else location.assign(url.href);
  }

  function visible(node) { return node && !node.hidden && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden'; }

  async function entryTask(kind, signal) {
    await waitFor(() => document.readyState !== 'loading', signal);
    if (kind === 'runner') {
      const prepare = await waitFor(() => globalThis.MILITOPO_RUNNER_PREPARE, signal);
      const ready = () => globalThis.MILITOPO_RUNNER_ENTRY_READY || globalThis.MILITOPO_RUNNER_OFFLINE_READY;
      if (!ready() && !await prepare()) await waitFor(ready, signal);
      return document.querySelector('[data-runner-panel].is-active');
    }
    await waitFor(() => globalThis.MILITOPO_ENTRY_AUTH_READY, signal);
    const login = () => document.getElementById('militopoV2AuthOverlay');
    if (kind === 'access') return waitFor(() => visible(login()) && login(), signal);
    if (kind === 'root') {
      return waitFor(() => {
        if (document.body.classList.contains('militopo-booting')) return null;
        if (visible(login())) return login();
        const chooser = document.getElementById('startupModeOverlay');
        const button = document.getElementById('startupOriBtn');
        if (visible(chooser) && button && !button.disabled) return chooser;
        const dashboard = document.getElementById('m2RunnerDashboard');
        return visible(dashboard) ? dashboard : null;
      }, signal);
    }
    const user = await waitFor(() => {
      if (visible(login())) return login();
      const auth = globalThis.MILITOPO_V2_AUTH;
      return auth?.uid && auth.emailVerified ? auth : null;
    }, signal);
    if (user === login()) return user;
    if (!['organizer','super_admin'].includes(user.role)) {
      await navigate(new URL('orientacion/participante/', base).href, {replace:true});
      return null;
    }
    const modes = await waitFor(() => {
      const gate = globalThis.MILITOPO_ORIENTATION_MODES;
      return gate?.canOrganize() ? gate : null;
    }, signal);
    return modes.prepareEntry(signal);
  }

  function welcomeLogin(name, target=null, openAccountView=null) {
    const welcome = {name:String(name || '').trim(), start:Date.now()};
    if (target) return navigate(target, {replace:true, welcome});
    const state = mount({kind:entryKind, welcome, entering:true});
    void present(state, signal => {
      // Exchange the login form for the account only after the welcome is opaque.
      if (openAccountView) {
        openAccountView();
        openAccountView = null;
      }
      return entryKind === 'local' ? document.body : entryTask(entryKind, signal);
    });
    return state.promise;
  }

  function bootEntry(kind) {
    entryKind = kind;
    if (active) return active.promise;
    let internal = false;
    let welcome = null;
    let retainedSource = false;
    try {
      const handoff = JSON.parse(sessionStorage.getItem('militopo_screen_handoff'));
      sessionStorage.removeItem('militopo_screen_handoff');
      internal = handoff?.url === location.href && Date.now() - handoff.time < 60000;
      if (internal && typeof handoff.welcome?.name === 'string' && Number.isFinite(handoff.welcome.start)) {
        welcome = handoff.welcome;
      }
      retainedSource = internal && handoff.inline && !reduced();
    } catch (_) {}
    const navType = performance.getEntriesByType('navigation')[0]?.type;
    if (navType !== 'reload' && document.referrer) {
      const source = new URL(document.referrer);
      internal ||= source.origin === base.origin && source.pathname.startsWith(base.pathname);
    }
    if (retainedSource) document.documentElement.classList.add('mp-cross-hold');
    const state = mount({kind, splash:!internal, welcome});
    void present(state, signal => entryTask(kind, signal));
    return state.promise;
  }

  function soft(node) {
    if (active || !node || reduced() || !node.animate) return;
    animations.get(node)?.cancel();
    animations.set(node, node.animate([{opacity:.55, transform:'translateY(5px)'},{opacity:1, transform:'translateY(0)'}],
      {duration:240, easing:'cubic-bezier(.2,.65,.3,1)'}));
  }

  globalThis.MILITOPO_TRANSITION = Object.freeze({config:CONFIG, navigate, welcomeLogin, waitFor, bootEntry, soft, settleView,
    runInline, active:() => Boolean(active || pendingButton), isEntering:kind => active?.kind === kind && active.entryPending});
  addEventListener('pagehide', () => {
    pendingButton?.clear?.();
    if (!active) return;
    active.suspended = true;
    clearTimeout(active.timer);
    active.controller?.abort();
  });
  addEventListener('pageshow', event => {
    if (!event.persisted) return;
    globalThis.__MILITOPO_AUTH_NAVIGATING = false;
    pendingButton?.stop();
    pendingButton = null;
    if (active) release(active, {ok:false, cancelled:true});
  });
})();
