import '../../../js/v2/bootstrap.js';
import {doc,onSnapshot,collection,query,where} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {httpsCallable} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js';
let review={id:'',members:[],invites:[],membersReady:false,invitesReady:false,error:''},reviewUnsubs=[];
let eventId='',header=null,unsub=null,running=false,roster=[],dialog=null,percentage=0,previousFocus=null;
const currentId=()=>String(document.getElementById('eventId')?.value||'').trim();
const ready=()=>Boolean(header?.registrationClosed===true&&header.status==='published'&&eventId===currentId());
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function call(name,data){const services=await globalThis.MILITOPO_V2.firebase();return (await httpsCallable(services.functions,name)(data)).data;}
function installStyle(){if(document.getElementById('mp-package-style'))return;const style=document.createElement('style');style.id='mp-package-style';style.textContent=`
.mp-package-dialog{box-sizing:border-box;position:fixed;inset:0;width:100vw;max-width:none;height:100dvh;max-height:none;margin:0;border:0;padding:24px;background:#0d271d;color:#fff;z-index:2147483647;overflow:auto;font-family:system-ui,sans-serif}
.mp-package-dialog::backdrop{background:#0d271d}.mp-package-dialog:not([open]){display:none}.mp-package-dialog[open]{display:grid;place-items:center}.mp-package-card{width:min(100%,520px);text-align:center}.mp-package-card h1{font-size:clamp(24px,5vw,36px);margin:22px 0 12px}.mp-package-card p{line-height:1.6;color:#d6e5dc;overflow-wrap:anywhere}.mp-package-card progress{width:100%;height:16px;accent-color:#e4ae3f}.mp-package-percent{font-size:52px;color:#efbd54;font-weight:800}.mp-package-card button{display:block;width:100%;min-height:52px;margin-top:14px;border:0;border-radius:14px;padding:14px;background:#e4ae3f;color:#10291e;font:700 16px system-ui;cursor:pointer}.mp-package-spinner{width:44px;height:44px;border:4px solid #476457;border-top-color:#e4ae3f;border-radius:50%;margin:auto;animation:mp-package-spin 1s linear infinite}@keyframes mp-package-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.mp-package-spinner{animation:none}}
.mp-registration{padding:18px;margin:16px 0;border:1px solid #cfdbc9;border-radius:16px;background:#f0f5ed;color:#163b29}.mp-registration button{min-height:48px;padding:12px;border:0;border-radius:10px;background:#174b33;color:white;font-weight:700}.mp-registration p{font-size:14px;line-height:1.5}

.mp-registration{box-sizing:border-box;width:100%;max-width:100%;padding:clamp(16px,3vw,28px);background:#f7faf6;border:1px solid #d7e4d9;border-radius:22px;box-shadow:0 12px 32px #10291e12}
.mp-close-heading small{font-size:10px;letter-spacing:.1em;font-weight:800;color:#667b6c}.mp-close-heading h2{font-size:26px;margin:8px 0;color:#163b29}.mp-close-heading p{color:#5d7163}
.mp-close-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:20px 0}.mp-close-stats article{padding:16px;border-radius:16px;background:#e8f0e8;display:grid;gap:5px;color:#174b33}.mp-close-stats strong{font-size:30px}.mp-close-stats span{font-size:12px;line-height:1.4}
.mp-close-table{overflow-x:auto;border:1px solid #dbe5dc;border-radius:14px;margin:12px 0 22px}.mp-close-table table{border-collapse:collapse;width:100%;font-size:13px;text-align:left}.mp-close-table th{padding:12px;background:#e6eee5;color:#234b34}.mp-close-table td{padding:12px;border-top:1px solid #dbe5dc;overflow-wrap:anywhere;color:#234532}.mp-close-table tr:nth-child(even){background:#edf3ed}
.mp-close-warning{padding:16px;border-radius:14px;background:#fff1e7;border:1px solid #f0d3bb;margin:20px 0;color:#803b25}.mp-registration button.mp-close-danger,.mp-package-card button.mp-close-danger{background:#b42e31;color:white;width:100%;min-height:54px;border-radius:14px}.mp-registration button:disabled{opacity:.55;cursor:default}.mp-package-card button.mp-close-cancel{background:#25493a;color:white}
#mpRegistrationReview{display:none}
`;document.head.appendChild(style);}
function openDialog(){installStyle();previousFocus=document.activeElement;dialog=document.createElement('dialog');dialog.className='mp-package-dialog';dialog.setAttribute('aria-labelledby','mp-package-title');dialog.addEventListener('cancel',e=>e.preventDefault());document.body.appendChild(dialog);dialog.showModal();}
function closeDialog(){dialog?.close();dialog?.remove();dialog=null;running=false;roster=[];previousFocus?.focus?.();refreshControls();}
function screen(title,message,{done=false,error=false}={}){
 dialog.innerHTML=`<section class="mp-package-card">${!done&&!error?'<div class="mp-package-spinner" aria-hidden="true"></div>':''}<small>MILITOPO · MATERIAL DE CARRERA</small><h1 id="mp-package-title">${esc(title)}</h1><p role="status">${esc(message)}</p>${!error?`<div class="mp-package-percent">${done?100:percentage}%</div><small>AVANCE ESTIMADO</small><progress max="100" value="${done?100:percentage}" aria-label="Preparación del ZIP"></progress>`:''}${done?'<p>Comprueba el archivo en Descargas. El navegador no puede confirmar por sí solo que se haya guardado.</p><button data-confirm>CONFIRMO QUE HE DESCARGADO EL ARCHIVO</button>':error?'<button data-confirm>VOLVER Y REVISAR</button>':''}</section>`;
 dialog.querySelector('[data-confirm]')?.addEventListener('click',closeDialog);dialog.querySelector('button')?.focus();
}
function progress(done,total,label){if(!dialog)return;percentage=Math.max(percentage,Math.min(90,Math.round(5+85*Math.max(0,done)/Math.max(1,total))));screen('Preparando tu ZIP',label||'Reuniendo los archivos…');}
function compression(percent){if(!dialog)return;percentage=Math.max(percentage,Math.min(99,Math.round(90+Number(percent||0)*.09)));screen('Comprimiendo el material','Terminando el archivo. Mantén esta pantalla abierta.');}
async function download(){
 if(running)return {ok:false,error:'Hay una descarga en curso'};
 running=true;percentage=0;openDialog();document.getElementById("zipProgressBox")?.remove();screen('Comprobando participantes','Verificando el cierre y los recorridos en Firebase…');
 const id=currentId();
 try{
  const result=await call('getOrientationPackageRoster',{eventId:id});
  if(id!==currentId())throw new Error('La carrera seleccionada ha cambiado. Vuelve a abrir la descarga.');
  roster=result.participants||[];if(!roster.length)throw new Error('No hay participantes confirmados.');
  const old=globalThis.__MILITOPO_SUPPRESS_ZIP_TOAST__;globalThis.__MILITOPO_SUPPRESS_ZIP_TOAST__=true;
  let output;try{output=await globalThis.generateZip();}finally{globalThis.__MILITOPO_SUPPRESS_ZIP_TOAST__=old;}
  if(!output?.ok)throw new Error(output?.error||'No se pudo generar el ZIP.');
  const warnings=output.warnings||[];
  screen(warnings.length?'ZIP preparado con avisos':'ZIP preparado',`${output.filename}. Descarga enviada al navegador.${warnings.length?' Revisa estas incidencias: '+warnings.join(' · '):''}`,{done:true});
  return output;
 }catch(error){screen('No se ha completado la descarga',error?.message||String(error),{error:true});return {ok:false,error:String(error?.message||error)};}
}
function confirmClosure(review){
 return new Promise(resolve=>{
  dialog.innerHTML=`<section class="mp-package-card"><small>CIERRE DE INSCRIPCIONES</small><h1 id="mp-package-title">¿Cerrar participantes?</h1><div class="mp-close-stats"><article><strong>${Number(review.participantCount)||0}</strong><span>Confirmados con recorrido</span></article><article><strong>${Number(review.pendingCount)||0}</strong><span>Invitaciones sin responder</span></article></div><p>Las invitaciones pendientes quedarán bloqueadas. No podrás añadir ni retirar participantes. El ZIP incluirá únicamente a los participantes confirmados con su recorrido.</p><p>Este cierre no inicia ni finaliza la carrera. Revisa la tabla antes de confirmar; no hay opción de reabrir las inscripciones.</p><button class="mp-close-danger" data-accept-close>SÍ, CERRAR PARTICIPANTES</button><button class="mp-close-cancel" data-cancel-close>VOLVER A REVISAR</button></section>`;
  dialog.querySelector('[data-accept-close]').onclick=()=>resolve(true);
  const cancel=dialog.querySelector('[data-cancel-close]');cancel.onclick=()=>resolve(false);cancel.focus();
 });
}
async function closeRegistration(){
 if(running)return;const id=currentId();
 running=true;openDialog();screen('Revisando inscripciones','Comprobando participantes e invitaciones pendientes…');
 try{
  const review=await call('closeOrientationRegistration',{eventId:id,preview:true});
  if(id!==currentId())throw new Error('La carrera seleccionada ha cambiado. Vuelve a revisar el cierre.');
  if(review.confirmationToken){
   if(!await confirmClosure(review)){closeDialog();return;}
   screen('Cerrando participantes','Aplicando el cierre confirmado…');
   await call('closeOrientationRegistration',{eventId:id,confirmationToken:review.confirmationToken});
  }
  screen('Participantes cerrados','Descarga el ZIP desde Gestionar carrera. Después abre LIVE para iniciar cuando comience la actividad.',{error:true});dialog.querySelector('button').textContent='VOLVER A LA CARRERA';
  const live=document.createElement('button');live.textContent='IR A LIVE PARA INICIAR';live.className='mp-live-shortcut';live.onclick=()=>{closeDialog();openLive();};dialog.querySelector('.mp-package-card').appendChild(live);
 }catch(error){screen('No se pudieron cerrar las inscripciones',error?.message||String(error),{error:true});}
}

function reason(){
 if(!header||eventId!==currentId())return 'Selecciona una carrera y espera a que se compruebe su estado.';
 if(header.status!=='published')return 'El ZIP se descarga con la carrera publicada, después de cerrar participantes y antes de iniciar.';
 return header.registrationClosed===true?'Participantes cerrados. ZIP disponible con las asignaciones confirmadas.':'ZIP bloqueado: entra en Invitar participantes → 02 Cerrar participantes y confirma el cierre.';
}
function stopReview(){reviewUnsubs.forEach(fn=>fn());reviewUnsubs=[];review={id:'',members:[],invites:[],membersReady:false,invitesReady:false,error:''};}
async function watchReview(){
 const body=document.getElementById('r1WorkspaceBody');
 if(!eventId||body?.dataset.r5Tab!=='roster'||!body.closest('[data-premium-tool="participants"]')){if(review.id)stopReview();return;}
 if(review.id===eventId)return;
 stopReview();const id=eventId;review.id=id;
 try{
  const {firestore}=await globalThis.MILITOPO_V2.firebase();if(review.id!==id)return;
  const failed=()=>{if(review.id!==id)return;review.error='No se pudo comprobar el resumen. Revisa la conexión y vuelve a abrir esta pestaña.';refreshControls();};
  reviewUnsubs.push(onSnapshot(collection(firestore,'events',id,'members'),snap=>{if(review.id!==id)return;review.members=snap.docs.map(d=>({...d.data(),id:d.id}));review.membersReady=true;refreshControls();},failed));
  reviewUnsubs.push(onSnapshot(query(collection(firestore,'invitations'),where('eventId','==',id)),snap=>{if(review.id!==id)return;review.invites=snap.docs.map(d=>({...d.data(),id:d.id}));review.invitesReady=true;refreshControls();},failed));
 }catch(_){if(review.id===id){review.error='No se pudo cargar el resumen. Vuelve a abrir esta pestaña.';refreshControls();}}
}
function openLive(){
 globalThis.MILITOPO_PREMIUM?.get?.('event-builder')?.close?.();
 queueMicrotask(()=>{
  globalThis.MILITOPO_PREMIUM?.get?.('organizer-home')?.close?.();
  globalThis.MILITOPO_R1_SHELL?.premiumModule?.('live');
 });
 return true;
}
function registrationHtml(){
 const closed=header?.registrationClosed===true,loaded=review.id===eventId&&review.membersReady&&review.invitesReady&&!review.error;
 const active=review.members.filter(m=>String(m.status||'active')==='active');
 const pending=review.invites.filter(i=>String(i.status||'pending')==='pending');
 const removed=review.members.length-active.length;
 const name=row=>row.displayName||row.targetDisplayName||(row.username?'@'+row.username:'')||(row.targetUsername?'@'+row.targetUsername:'')||row.email||row.targetEmail||row.uid||row.id;
 return `<header class="mp-close-heading"><small>REVISIÓN FINAL DE INSCRIPCIONES</small><h2>${closed?'Participantes cerrados':'Cerrar participantes'}</h2><p>Comprueba quién correrá y qué recorrido tiene asignado antes de habilitar el paquete del organizador.</p></header>${review.error?`<p role="alert">${esc(review.error)}</p>`:!loaded?'<p role="status">Comprobando participantes e invitaciones…</p>':`<div class="mp-close-stats"><article><strong>${active.length}</strong><span>Participantes confirmados</span></article><article><strong>${pending.length}</strong><span>${closed?'Invitaciones bloqueadas':'Invitaciones pendientes'}</span></article></div><h3>Participantes y recorridos</h3><div class="mp-close-table"><table><thead><tr><th>Participante</th><th>Plaza</th><th>Recorrido</th></tr></thead><tbody>${active.length?active.map(m=>`<tr><td>${esc(name(m))}</td><td>${esc(m.participantId||m.webParticipantId||'Sin asignar')}</td><td>${esc(m.routeId||m.courseId||'Sin asignar')}</td></tr>`).join(''):'<tr><td colspan="3">Todavía no hay participantes confirmados.</td></tr>'}</tbody></table></div><h3>${closed?'Invitaciones bloqueadas':'Invitaciones pendientes'}</h3><div class="mp-close-table"><table><thead><tr><th>Usuario</th><th>Estado</th></tr></thead><tbody>${pending.length?pending.map(i=>`<tr><td>${esc(name(i))}</td><td>${closed?'Bloqueada por cierre':'Sin responder'}</td></tr>`).join(''):'<tr><td colspan="2">No quedan invitaciones pendientes.</td></tr>'}</tbody></table></div>${removed?`<p>${removed} participante(s) retirado(s): quedan fuera del ZIP.</p>`:''}`}
 <div class="mp-close-warning"><strong>${closed?'Inscripciones bloqueadas':'Qué ocurrirá al cerrar'}</strong><p>No se podrán añadir ni retirar participantes. Las invitaciones sin responder ya no podrán aceptarse. El ZIP incluirá a los participantes confirmados con recorrido; la carrera seguirá publicada hasta que la inicies.</p></div><button class="mp-close-danger" data-close-registration ${closed||!loaded||!active.length||header?.status!=='published'||running?'disabled':''}>${closed?'🔒 PARTICIPANTES CERRADOS':'CERRAR PARTICIPANTES'}</button>${closed?'<p>Descarga el ZIP desde Gestionar carrera → Paquete del organizador.</p><button class="mp-live-shortcut" data-open-live>IR A LIVE PARA INICIAR →</button>':''}`;
}
function refreshControls(){
 const panel=document.getElementById('m2Invitations');
 if(panel){
  const label=panel.querySelector('.m2-user-picker>label');if(label?.firstChild?.nodeType===3)label.firstChild.textContent='BUSCAR USUARIOS';
  let box=document.getElementById('mpRegistrationReview');if(!box){box=document.createElement('section');box.id='mpRegistrationReview';box.className='mp-registration';}
  if(box.parentNode!==panel.parentNode||box.previousElementSibling!==panel)panel.insertAdjacentElement('afterend',box);
  const html=registrationHtml();if(box._view!==html){box._view=html;box.innerHTML=html;box.querySelector('[data-close-registration]')?.addEventListener('click',closeRegistration);box.querySelector('[data-open-live]')?.addEventListener('click',openLive);}
  if(header?.registrationClosed===true){panel.querySelectorAll('#m2InviteCreate,#m2InviteSelectedCreate,#m2InviteBulkCreate').forEach(b=>b.disabled=true);const status=panel.querySelector('#m2InviteStatus');if(status)status.textContent='Inscripciones cerradas. Las invitaciones pendientes ya no podrán aceptarse.';}
 }
 document.querySelectorAll('[data-mpp-action="download-package"]').forEach(button=>{
  const enabled=ready()&&!running;button.disabled=!enabled;button.setAttribute('aria-disabled',String(!enabled));button.textContent=enabled?'DESCARGAR ZIP':'🔒 ZIP BLOQUEADO';
  const note=button.closest('[data-management-kind="package"]')?.querySelector('#mpp-reason-package');if(note)note.textContent=reason();
 });
}

async function watchEvent(){const id=currentId();if(id===eventId){refreshControls();watchReview();return}unsub?.();unsub=null;eventId=id;header=null;stopReview();refreshControls();if(!id)return;
 try{const {firestore}=await globalThis.MILITOPO_V2.firebase();if(id!==eventId)return;unsub=onSnapshot(doc(firestore,'events',id),snap=>{if(id!==eventId)return;header=snap.exists()?snap.data():null;refreshControls();globalThis.dispatchEvent(new Event("militopo:registration-state"));},()=>{header=null;refreshControls();});}catch(_){header=null;}
}
globalThis.MILITOPO_PACKAGE=Object.freeze({ready,reason,openLive,download,progress,compression,active:()=>running,roster:()=>roster});
installStyle();setInterval(watchEvent,1200);watchEvent();

globalThis.addEventListener("militopo:v2-auth-ready",()=>{unsub?.();unsub=null;eventId="";header=null;stopReview();watchEvent();});
