import '../../../js/v2/bootstrap.js';
import {doc,onSnapshot} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {httpsCallable} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js';
let eventId='',header=null,unsub=null,running=false,roster=[],dialog=null,percentage=0,previousFocus=null;
const currentId=()=>String(document.getElementById('eventId')?.value||'').trim();
const ready=()=>Boolean(header?.registrationClosed===true&&header.status==='published'&&eventId===currentId());
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function call(name,data){const services=await globalThis.MILITOPO_V2.firebase();return (await httpsCallable(services.functions,name)(data)).data;}
function installStyle(){if(document.getElementById('mp-package-style'))return;const style=document.createElement('style');style.id='mp-package-style';style.textContent=`
.mp-package-dialog{box-sizing:border-box;position:fixed;inset:0;width:100vw;max-width:none;height:100dvh;max-height:none;margin:0;border:0;padding:24px;background:#0d271d;color:#fff;z-index:2147483647;overflow:auto;font-family:system-ui,sans-serif}
.mp-package-dialog::backdrop{background:#0d271d}.mp-package-dialog:not([open]){display:none}.mp-package-dialog[open]{display:grid;place-items:center}.mp-package-card{width:min(100%,520px);text-align:center}.mp-package-card h1{font-size:clamp(24px,5vw,36px);margin:22px 0 12px}.mp-package-card p{line-height:1.6;color:#d6e5dc;overflow-wrap:anywhere}.mp-package-card progress{width:100%;height:16px;accent-color:#e4ae3f}.mp-package-percent{font-size:52px;color:#efbd54;font-weight:800}.mp-package-card button{display:block;width:100%;min-height:52px;margin-top:14px;border:0;border-radius:14px;padding:14px;background:#e4ae3f;color:#10291e;font:700 16px system-ui;cursor:pointer}.mp-package-spinner{width:44px;height:44px;border:4px solid #476457;border-top-color:#e4ae3f;border-radius:50%;margin:auto;animation:mp-package-spin 1s linear infinite}@keyframes mp-package-spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.mp-package-spinner{animation:none}}
.mp-registration{padding:18px;margin:16px 0;border:1px solid #cfdbc9;border-radius:16px;background:#f0f5ed;color:#163b29}.mp-registration button{min-height:48px;padding:12px;border:0;border-radius:10px;background:#174b33;color:white;font-weight:700}.mp-registration p{font-size:14px;line-height:1.5}
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
async function closeRegistration(){
 if(running)return;const id=currentId();
 running=true;openDialog();screen('Revisando inscripciones','Comprobando participantes e invitaciones pendientes…');
 try{
  const review=await call('closeOrientationRegistration',{eventId:id,preview:true});
  if(id!==currentId())throw new Error('La carrera seleccionada ha cambiado. Vuelve a revisar el cierre.');
  if(review.confirmationToken){
   const text=`Hay ${review.participantCount} participantes confirmados y ${review.pendingCount} invitaciones sin responder. Al cerrar, las invitaciones pendientes ya no podrán aceptarse y el ZIP solo incluirá a los participantes confirmados con recorrido. No se podrán añadir ni retirar corredores. ¿Confirmas el cierre?`;
   if(!globalThis.confirm(text)){closeDialog();return;}
   screen('Cerrando participantes','Aplicando el cierre confirmado…');
   await call('closeOrientationRegistration',{eventId:id,confirmationToken:review.confirmationToken});
  }
  screen('Participantes cerrados','Las invitaciones pendientes están bloqueadas. Ya puedes descargar el ZIP antes de iniciar la carrera.',{error:true});dialog.querySelector('button').textContent='ENTENDIDO';
 }catch(error){screen('No se pudieron cerrar las inscripciones',error?.message||String(error),{error:true});}
}

function refreshControls(){
 const panel=document.getElementById('m2Invitations');
 if(panel){let box=panel.querySelector('.mp-registration');if(!box){box=document.createElement('section');box.className='mp-registration';panel.prepend(box);}
 const closed=header?.registrationClosed===true;
 if(closed){panel.querySelectorAll("#m2InviteCreate,#m2InviteSelectedCreate,#m2InviteBulkCreate").forEach(b=>b.disabled=true);const status=panel.querySelector("#m2InviteStatus");if(status)status.textContent="Inscripciones cerradas. Descarga el ZIP antes de iniciar.";}
 const html=`<strong>${closed?'PARTICIPANTES CERRADOS':'CIERRE DE PARTICIPANTES'}</strong><p>${closed?'Las inscripciones están bloqueadas. Descarga el ZIP antes de iniciar la carrera.':'Cierra las inscripciones para habilitar el ZIP. Podrás confirmar el cierre aunque queden invitaciones sin responder; después ya no podrán aceptarse.'}</p><button data-close-registration ${closed||header?.status!=='published'||running?'disabled':''}>${closed?'🔒 INSCRIPCIONES CERRADAS':'CERRAR PARTICIPANTES'}</button>${ready()?'<button data-roster-download>DESCARGAR ZIP</button>':''}`;
 if(box._view!==html){box._view=html;box.innerHTML=html;box.querySelector('[data-close-registration]')?.addEventListener('click',closeRegistration);box.querySelector('[data-roster-download]')?.addEventListener('click',download);}
 }
 document.querySelectorAll('[data-mpb-download-package],[data-mpp-action="download-package"]').forEach(button=>{button.disabled=!ready()||running;button.setAttribute('aria-disabled',String(button.disabled));button.title=ready()?'Descargar material':'Publica la carrera y cierra participantes para descargar';if(button.hasAttribute('data-mpb-download-package'))button.textContent=ready()?'DESCARGAR ZIP':'🔒 CIERRA PARTICIPANTES PARA DESCARGAR';});
}
async function watchEvent(){const id=currentId();if(id===eventId){refreshControls();return}unsub?.();unsub=null;eventId=id;header=null;refreshControls();if(!id)return;
 try{const {firestore}=await globalThis.MILITOPO_V2.firebase();if(id!==eventId)return;unsub=onSnapshot(doc(firestore,'events',id),snap=>{if(id!==eventId)return;header=snap.exists()?snap.data():null;refreshControls();},()=>{header=null;refreshControls();});}catch(_){header=null;}
}
globalThis.MILITOPO_PACKAGE=Object.freeze({ready,download,progress,compression,active:()=>running,roster:()=>roster});
installStyle();setInterval(watchEvent,1200);watchEvent();

globalThis.addEventListener("militopo:v2-auth-ready",()=>{unsub?.();unsub=null;eventId="";header=null;watchEvent();});
