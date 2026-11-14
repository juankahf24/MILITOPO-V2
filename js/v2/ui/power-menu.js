/* Shared header account menu. Opening the menu never signs the user out. */
export const powerIcon='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v9M6.3 5.7a9 9 0 1 0 11.4 0"/></svg>';
let sequence=0;
export function bindPowerMenu(trigger,{onLogout,onError=()=>{}}={}){
 if(!trigger)return null;
 if(!document.getElementById('mpPowerMenuStyle')){
  const style=document.createElement('style');style.id='mpPowerMenuStyle';style.textContent=`
  .mp-power-trigger{display:grid;place-items:center;width:44px;height:44px;padding:10px;border:1px solid #98b49155;border-radius:13px;background:#183d2b;color:#eaf0dd;cursor:pointer;touch-action:manipulation;box-shadow:inset 0 1px 0 #ffffff12,0 3px 8px #0002}
  .mp-power-trigger svg{width:20px;height:20px;pointer-events:none}.mp-power-trigger:hover,.mp-power-trigger[aria-expanded="true"]{background:#2b523b;color:#f5dfa7;border-color:#cfb87988}.mp-power-trigger:active{box-shadow:inset 0 2px 6px #0004}.mp-power-trigger:focus-visible,.mp-power-menu button:focus-visible{outline:3px solid #d5bb76;outline-offset:3px}.mp-power-trigger:disabled{opacity:.45;cursor:wait}
  .mp-power-menu{position:fixed;z-index:2147483500;min-width:174px;max-width:calc(100vw - 16px);padding:6px;border:1px solid #a5bb9666;border-radius:14px;background:#162b20;color:#f2f0df;box-shadow:0 16px 38px #0006;font-family:system-ui,sans-serif}.mp-power-menu[hidden]{display:none!important}.mp-power-menu button{display:flex;align-items:center;gap:10px;width:100%;min-height:44px;padding:10px 12px;border:0;border-radius:9px;background:transparent;color:inherit;font:750 13px/1.2 system-ui;cursor:pointer;touch-action:manipulation}.mp-power-menu button:hover{background:#ffffff0d}.mp-power-menu button:disabled{opacity:.6;cursor:wait}`;
  document.head.append(style);
 }
 const menu=document.createElement('div');menu.className='mp-power-menu';menu.id='mpPowerMenu'+(++sequence);menu.hidden=true;menu.setAttribute('role','menu');menu.setAttribute('aria-label','Sesión');
 menu.innerHTML=`<button type="button" role="menuitem">${powerIcon}<span>Cerrar sesión</span></button>`;
 document.documentElement.append(menu);const logout=menu.querySelector('button');let busy=false;
 trigger.classList.add('mp-power-trigger');trigger.innerHTML=powerIcon;trigger.setAttribute('aria-label','Opciones de sesión');trigger.setAttribute('title','Opciones de sesión');trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-controls',menu.id);trigger.setAttribute('aria-expanded','false');
 function close(restore=false){menu.hidden=true;trigger.setAttribute('aria-expanded','false');if(restore&&trigger.isConnected)trigger.focus({preventScroll:true});}
 function position(){const rect=trigger.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(rect.right-menu.offsetWidth,document.documentElement.clientWidth-menu.offsetWidth-8))+'px';menu.style.top=Math.max(8,Math.min(rect.bottom+7,window.innerHeight-menu.offsetHeight-8))+'px';}
 function open(){if(trigger.disabled||busy)return;menu.hidden=false;trigger.setAttribute('aria-expanded','true');position();logout.focus({preventScroll:true});}
 trigger.addEventListener('click',()=>menu.hidden?open():close(true));
 trigger.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();open();}});
 const outside=event=>{if(!menu.hidden&&!menu.contains(event.target)&&!trigger.contains(event.target))close();};
 const escape=event=>{if(!menu.hidden&&event.key==='Escape'){event.preventDefault();close(true);}};
 const scroll=()=>{if(!menu.hidden)close();};
 document.addEventListener('click',outside);document.addEventListener('keydown',escape);window.addEventListener('resize',scroll);window.addEventListener('scroll',scroll,true);
 menu.addEventListener('keydown',event=>{if(event.key==='Tab')close();if(['ArrowUp','ArrowDown','Home','End'].includes(event.key)){event.preventDefault();logout.focus();}});
 logout.addEventListener('click',async()=>{
  if(busy)return;busy=true;trigger.disabled=true;logout.disabled=true;close();
  try{await onLogout?.();}catch(error){onError(error);}
  finally{busy=false;trigger.disabled=false;logout.disabled=false;}
 });
 return {close,destroy(){close();menu.remove();document.removeEventListener('click',outside);document.removeEventListener('keydown',escape);window.removeEventListener('resize',scroll);window.removeEventListener('scroll',scroll,true);}};
}
