/* MILITOPO 2.0.48. Presentation only: no services, routing or session mutations. */
(() => {
 'use strict';
 const script = document.currentScript;
 const logo = new URL('../../../icons/militopo-512.png', script.src).href;
 const headers = '.runner-head,.mpp-r3-header,.r6-appbar,#militopoR1Topbar,.header-clean-topografia';
 let queued = false;
 function text(node, value) { if (node && node.textContent !== value) node.textContent = value; }
 function paintAccount(header) {
  const row = header.querySelector('.tg-account');
  if (!row) return;
  const auth = globalThis.MILITOPO_V2_AUTH || {};
  const name = String(auth.displayName || auth.username || '').trim();
  text(row.querySelector('.tg-account-name'), name || (auth.uid ? 'Mi cuenta' : 'MILITOPO'));
  text(row.querySelector('.tg-account-handle'), auth.username ? '@' + String(auth.username).replace(/^@/, '') : '');
  text(row.querySelector('.tg-account-role'), header.matches('.r6-appbar') ? 'CORREDOR' : header.matches('.header-clean-topografia') ? 'TOPOGRAFÍA' : ({super_admin:'SÚPER ADMIN',admin:'ADMIN',organizer:'ORGANIZADOR',runner:'CORREDOR'}[String(auth.role || '').toLowerCase()] || 'ORGANIZADOR'));
  const network = row.querySelector('.tg-network');
  network.classList.toggle('is-offline', !navigator.onLine);
  text(network, navigator.onLine ? 'EN LÍNEA' : 'SIN CONEXIÓN');
 }
 function setup() {
  document.querySelectorAll(headers).forEach(header => {
   if (header.classList.contains('tg-header')) return;
   header.classList.add('tg-header');
   if (header.matches('.runner-head')) return; // Existing profile bindings are retained.
   if (header.matches('.mpp-r3-header')) {
    text(header.querySelector('.mpp-r3-identity strong'), 'MILITOPO');
    text(header.querySelector('.mpp-r3-identity span'), 'CENTRO DE CARRERAS');
   } else if (header.matches('#militopoR1Topbar')) {
    const brand = document.createElement('div');brand.className = 'tg-brand';
    const image = document.createElement('img');image.src = logo;image.alt = '';image.width = 52;image.height = 52;
    const title = document.createElement('strong');title.textContent = 'MILITOPO';
    brand.append(image,title);header.prepend(brand);
   }
   const row = document.createElement('div');row.className = 'tg-account';
   row.innerHTML = '<strong class="tg-account-name"></strong><span class="tg-account-meta"><span class="tg-account-handle"></span><span class="tg-account-role"></span></span><span class="tg-network"></span>';
   header.append(row);paintAccount(header);
  });
 }
 function schedule() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false;setup(); });
 }
 setup();
 new MutationObserver(schedule).observe(document.body, {childList:true,subtree:true});
 function refresh() { setup();document.querySelectorAll('.tg-header').forEach(paintAccount); }
 addEventListener('militopo:v2-auth-ready', refresh);
 addEventListener('online', refresh);addEventListener('offline', refresh);
})();
