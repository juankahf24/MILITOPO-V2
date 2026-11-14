/* MILITOPO Premium · único controlador de entrada y navegación pesada. */
(()=>{
 'use strict';if(globalThis.MILITOPO_TRANSITION)return;
 const CONFIG=Object.freeze({minimumMs:3800,enterMs:300,exitMs:400,backgroundMs:550,lettersMs:2750,timeoutMs:30000});
 const base=new URL('../../../',document.currentScript.src),KEY='militopo_transition_handoff_v1';
 let active=null,authSettled=false;const animations=new WeakMap();
 const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
 const abortError=()=>Object.assign(new Error('Carga cancelada'),{name:'AbortError'});
 function delay(ms,signal){return new Promise((resolve,reject)=>{if(signal?.aborted){reject(signal.reason||abortError());return}const done=()=>{signal?.removeEventListener('abort',abort);resolve();};const timer=setTimeout(done,Math.max(0,ms)),abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(signal.reason||abortError());};signal?.addEventListener('abort',abort,{once:true});});}
 function abortable(promise,signal){return new Promise((resolve,reject)=>{const abort=()=>{signal.removeEventListener('abort',abort);reject(signal.reason||abortError());};if(signal.aborted){abort();return;}signal.addEventListener('abort',abort,{once:true});Promise.resolve(promise).then(value=>{signal.removeEventListener('abort',abort);resolve(value);},error=>{signal.removeEventListener('abort',abort);reject(error);});});}
 function waitFor(predicate,signal){return new Promise((resolve,reject)=>{
  let finished=false;const end=(error,value)=>{if(finished)return;finished=true;observer.disconnect();clearInterval(poll);signal?.removeEventListener('abort',abort);error?reject(error):resolve(value);};
  const check=()=>{try{const value=predicate();if(value)end(null,value);}catch(error){end(error);}},abort=()=>end(signal.reason||abortError());
  const observer=new MutationObserver(check),poll=setInterval(check,100);observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','aria-hidden']});signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();else check();
 });}
 function frame(){return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));}
 const letters=word=>[...word].map((letter,index)=>`<span style="--letter:${index}" aria-hidden="true">${letter}</span>`).join('');
 const logo='<svg class="mp-mountain-mark" viewBox="0 0 440 150" aria-hidden="true"><defs><linearGradient id="mpMountainLight" x1="0" y1="0" x2="0.6" y2="1"><stop stop-color="#f1ffc8"/><stop offset="1" stop-color="#88b647"/></linearGradient></defs><path d="M3 145 111 52l37 30L223 3l94 94 25-18 95 66-98-35-22 10-94-91-72 79-41-32-72 61Z" fill="url(#mpMountainLight)"/><path d="m223 29-19 58 16-9-30 50 39-24-8 26 72 13-47-55 7 27-30-61 7 12ZM111 76l-14 41 20-12-8 24 37-21-23-13ZM342 101l-7 14 26 20-9-18 38 22Z" fill="#243e1d"/></svg>';
 function mount(startedAt=Date.now()){
  const root=document.createElement('section');root.id='mpPremiumTransition';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Cargando MILITOPO');root.tabIndex=-1;
  const elapsed=Math.max(0,Date.now()-startedAt);root.style.setProperty('--mp-elapsed',elapsed+'ms');if(elapsed>250)root.classList.add('is-transfer');
  root.innerHTML=`<div class="mp-transition-bg"></div><div class="mp-transition-light"></div><div class="mp-transition-content">${logo}<div class="mp-loader-brackets"><div class="mp-loader-word" aria-label="MILITOPO">${letters('MILITOPO')}</div><div class="mp-loader-line"></div><div class="mp-loader-word is-loading" aria-label="CARGANDO">${letters('CARGANDO')}</div></div><div class="mp-loader-progress" role="progressbar" aria-label="Preparando pantalla"></div><p class="mp-loader-status" role="status" aria-live="polite">Preparando tu entorno</p><div class="mp-loader-actions"></div></div>`;
  const state={root,startedAt,previous:document.activeElement,inert:new Map(),attempt:0,navigating:false};
  document.body.appendChild(root);document.body.classList.add('mp-transition-host');document.documentElement.classList.add('mp-transition-open');
  const block=()=>{for(const node of document.body.children){if(node===root||state.inert.has(node))continue;state.inert.set(node,node.inert);node.inert=true;}};block();state.observer=new MutationObserver(block);state.observer.observe(document.body,{childList:true});root.focus({preventScroll:true});return state;
 }
 function remove(state){clearTimeout(state.navigationTimer);try{sessionStorage.removeItem(KEY);}catch(_){}state.observer.disconnect();for(const [node,value]of state.inert)if(node.isConnected)node.inert=value;state.root.remove();document.documentElement.classList.remove('mp-transition-open');document.body.classList.remove('mp-transition-host');if(active===state)active=null;state.previous?.focus?.({preventScroll:true});}
 async function backdrop(signal){
  const image=new Image(),url=new URL('assets/transition/militopo-'+(matchMedia('(orientation: portrait)').matches?'portrait':'landscape')+'.webp',base).href;
  await new Promise((resolve,reject)=>{const abort=()=>{cleanup();reject(signal.reason||abortError());},cleanup=()=>{image.onload=null;image.onerror=null;signal?.removeEventListener('abort',abort);};image.onload=()=>{cleanup();resolve();};image.onerror=()=>{cleanup();reject(new Error('No se pudo cargar el fondo. Comprueba la conexión o vuelve a intentarlo.'));};signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}image.src=url;if(image.complete&&image.naturalWidth){cleanup();resolve();}});
  if(image.decode)await abortable(image.decode(),signal);return url;
 }
 async function showBackdrop(state,signal){
  const url=await backdrop(signal);if(signal.aborted||active!==state)throw signal.reason||abortError();
  state.root.querySelector('.mp-transition-bg').style.backgroundImage=`url("${url}")`;
  state.root.classList.add('has-backdrop');await frame();
 }
 async function prepareVisual(state,signal){
  await showBackdrop(state,signal);await delay(reduced()?0:CONFIG.backgroundMs,signal);
  if(!state.root.classList.contains('has-content')){
   state.contentAt=Date.now();state.root.style.setProperty('--mp-elapsed','0ms');state.root.classList.add('has-content');
  }
 }
 function errorView(state,error){state.root.classList.add('has-error');state.root.querySelector('.mp-loader-status').textContent=error?.message||'No se pudo preparar la pantalla.';const box=state.root.querySelector('.mp-loader-actions');box.replaceChildren();for(const [label,action]of [['REINTENTAR',()=>attempt(state)],['VOLVER',()=>{state.controller.abort(abortError());remove(state);state.resolve({ok:false,cancelled:true});}]]){const button=document.createElement('button');button.type='button';button.textContent=label;button.onclick=action;box.appendChild(button);}box.querySelector('button').focus({preventScroll:true});}
 async function attempt(state){
  clearTimeout(state.navigationTimer);const generation=++state.attempt;state.controller?.abort(abortError());state.controller=new AbortController();const signal=state.controller.signal;
  state.root.classList.remove('has-error');state.root.querySelector('.mp-loader-actions').replaceChildren();state.root.querySelector('.mp-loader-status').textContent='Preparando tu entorno';
  const timer=setTimeout(()=>state.controller.abort(new Error('La carga está tardando más de lo esperado. Puedes reintentar o volver.')),CONFIG.timeoutMs);
  try{
   const [result]=await abortable(Promise.all([state.task(signal),prepareVisual(state,signal)]),signal);if(signal.aborted)throw signal.reason;
   await frame();const readyAt=reduced()?Date.now():Math.max(state.startedAt+CONFIG.minimumMs,(state.contentAt||Date.now())+CONFIG.lettersMs);await delay(Math.max(0,readyAt-Date.now()),signal);if(active!==state||state.attempt!==generation||state.navigating)return;
   state.root.querySelector('.mp-loader-status').textContent='Todo preparado';
   const exit=reduced()?100:CONFIG.exitMs;if(state.root.animate){const animation=state.root.animate([{opacity:1},{opacity:0}],{duration:exit,easing:'ease-in-out',fill:'forwards'});await animation.finished;}else{state.root.style.transition=`opacity ${exit}ms ease`;state.root.style.opacity='0';await delay(exit,signal);}
   if(active===state){remove(state);state.resolve({ok:true,value:result});}
  }catch(error){if(active===state&&state.attempt===generation&&!state.navigating)errorView(state,error);}finally{clearTimeout(timer);}
 }
 function run(task,{startedAt=Date.now()}={}){
  if(active)return Promise.resolve().then(()=>task(active.controller.signal));
  const state=mount(startedAt);active=state;state.task=task;state.promise=new Promise(resolve=>state.resolve=resolve);void attempt(state);return state.promise;
 }
 function handoffStart(){try{const data=JSON.parse(sessionStorage.getItem(KEY)||'null');sessionStorage.removeItem(KEY);if(data&&data.to===location.pathname+location.search&&Date.now()-data.startedAt>=0&&Date.now()-data.startedAt<60000)return data.startedAt;}catch(_){}return Date.now();}
 async function navigate(target,{replace=false}={}){
  const url=new URL(target,location.href);if(url.origin!==location.origin)throw Error('La transición solo admite pantallas internas.');
  if(document.querySelector('#m2RaceV2.m2race-is-racing,[data-militopo-runner-active="true"]'))return false;
  let state=active;if(state?.navigating)return false;
  if(!state){state=mount();active=state;state.controller=new AbortController();state.resolve=()=>{};state.promise=Promise.resolve();}
  state.navigating=true;try{sessionStorage.setItem(KEY,JSON.stringify({to:url.pathname+url.search,startedAt:state.startedAt}));}catch(_){}
  try{await Promise.all([showBackdrop(state,state.controller.signal),delay(reduced()?0:CONFIG.enterMs,state.controller.signal)]);globalThis.__MILITOPO_AUTH_NAVIGATING=true;try{sessionStorage.setItem('militopo_v2_allow_navigation_once','1');}catch(_){}replace?location.replace(url.href):location.assign(url.href);
   state.navigationTimer=setTimeout(()=>{if(active===state){state.navigating=false;state.task=()=>navigate(target,{replace});errorView(state,new Error('No se pudo abrir la siguiente pantalla. Reintenta o vuelve.'));}},CONFIG.timeoutMs);
  }catch(error){state.navigating=false;state.task=()=>navigate(target,{replace});errorView(state,error);}return true;
 }
 async function entryTask(kind,signal){
  await waitFor(()=>document.readyState!=='loading',signal);
  if(kind==='runner'){
   await waitFor(()=>typeof globalThis.MILITOPO_RUNNER_PREPARE==='function',signal);const ok=await globalThis.MILITOPO_RUNNER_PREPARE();if(!ok&&!globalThis.MILITOPO_RUNNER_OFFLINE_READY)await waitFor(()=>globalThis.MILITOPO_RUNNER_ENTRY_READY||globalThis.MILITOPO_RUNNER_OFFLINE_READY,signal);return document.querySelector('[data-runner-panel="home"]');
  }
  await waitFor(()=>authSettled||globalThis.MILITOPO_ENTRY_AUTH_READY,signal);
  if(kind==='root'){
   return waitFor(()=>{if(document.body.classList.contains('militopo-booting'))return null;const visible=node=>node&&!node.hidden&&getComputedStyle(node).display!=='none'&&getComputedStyle(node).visibility!=='hidden';const access=document.getElementById('militopoV2AuthOverlay');if(visible(access))return access;const selector=document.getElementById('startupModeOverlay'),button=document.getElementById('startupOriBtn');if(visible(selector)&&button&&!button.disabled)return selector;const runner=document.getElementById('m2RunnerDashboard');return visible(runner)?runner:null;},signal);
  }
  document.body.classList.remove('ori-page-booting');document.body.classList.add('ori-page-ready');
  const auth=globalThis.MILITOPO_V2_AUTH;
  if(!auth?.uid||!auth.emailVerified)return document.getElementById('militopoV2AuthOverlay');
  if(!['organizer','super_admin'].includes(auth.role)){await navigate(new URL('orientacion/participante/',base).href,{replace:true});return null;}
  const target=await waitFor(()=>{const home=globalThis.MILITOPO_PREMIUM?.get?.('organizer-home');const choice=document.getElementById('militopoOrientationModes');return home?.isOpen?.()?home:choice&&!choice.hidden?choice:null;},signal);
  if(target.prepare)return target.prepare();return target;
 }
 function bootEntry(kind){return run(signal=>entryTask(kind,signal),{startedAt:handoffStart()});}
 function soft(node){if(!node||reduced()||!node.animate)return;animations.get(node)?.cancel();animations.set(node,node.animate([{opacity:.55,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,easing:'cubic-bezier(.2,.65,.3,1)'}));}
 globalThis.MILITOPO_TRANSITION=Object.freeze({config:CONFIG,run,navigate,waitFor,bootEntry,soft,active:()=>Boolean(active)});
 addEventListener('militopo:auth-ui-ready',()=>{authSettled=true;});
 addEventListener('pageshow',event=>{if(event.persisted&&active){clearTimeout(active.navigationTimer);active.controller.abort(abortError());const state=active;remove(state);state.resolve({ok:false,cancelled:true});}});
 document.addEventListener('click',event=>{if(event.defaultPrevented)return;const button=event.target.closest?.('#startupOriBtn,#startupOriCard');if(!button||button.disabled||active)return;event.preventDefault();event.stopImmediatePropagation();void navigate(new URL(globalThis.MILITOPO_V2_AUTH?.role==='runner'?'orientacion/participante/':'orientacion/',base).href);},true);
})();
