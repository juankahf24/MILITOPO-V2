/* MILITOPO · diálogo de confirmación unificado.
   Sustituye las confirmaciones nativas por una interfaz coherente en móvil/PWA/escritorio. */
(()=>{
  if(globalThis.MILITOPO_CONFIRM)return;
  let activeResolve=null;
  let lastFocus=null;

  function ensureStyle(){
    if(document.getElementById('militopoConfirmStyle'))return;
    const style=document.createElement('style');
    style.id='militopoConfirmStyle';
    style.textContent=`
      html.militopo-confirm-open,html.militopo-confirm-open body{overflow:hidden!important}
      .militopo-confirm-overlay{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:max(18px,env(safe-area-inset-top)) 16px max(18px,env(safe-area-inset-bottom));background:rgba(4,9,5,.76);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);box-sizing:border-box}
      .militopo-confirm-overlay[hidden]{display:none!important}
      .militopo-confirm-card{width:min(430px,100%);box-sizing:border-box;border:1px solid rgba(201,218,170,.30);border-radius:24px;background:linear-gradient(180deg,#1c2a1e,#101811);box-shadow:0 28px 90px rgba(0,0,0,.58);color:#f3f5ed;padding:20px;display:grid;gap:15px;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .militopo-confirm-head{display:flex;align-items:center;gap:12px}
      .militopo-confirm-icon{width:44px;height:44px;flex:0 0 44px;border-radius:14px;display:grid;place-items:center;background:#dfe8c5;color:#182019;font-weight:950;font-size:22px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.5)}
      .militopo-confirm-copy{min-width:0;display:grid;gap:3px}.militopo-confirm-copy small{font-size:10px;font-weight:900;letter-spacing:.16em;color:#aebaaa}.militopo-confirm-copy h2{margin:0;font-size:19px;line-height:1.1;letter-spacing:.02em}
      .militopo-confirm-message{margin:0;padding:13px 14px;border-radius:16px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);color:#dce3d8;font-size:14px;line-height:1.5;white-space:pre-line;overflow-wrap:anywhere}
      .militopo-confirm-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px}.militopo-confirm-actions button{min-height:48px;border-radius:14px;font:900 13px/1 system-ui,-apple-system,sans-serif;letter-spacing:.04em;cursor:pointer}
      .militopo-confirm-cancel{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.055);color:#f0f3ed}.militopo-confirm-ok{border:1px solid rgba(183,219,135,.34);background:linear-gradient(180deg,#dbeab5,#b9d87b);color:#11180f}
      .militopo-confirm-card.is-danger{border-color:rgba(232,144,125,.34)}.militopo-confirm-card.is-danger .militopo-confirm-icon{background:#e7b3a8;color:#32110d}.militopo-confirm-card.is-danger .militopo-confirm-ok{background:linear-gradient(180deg,#e8b6aa,#d98d7d);border-color:rgba(255,207,197,.34);color:#2a0f0b}
      .militopo-confirm-actions button:active{transform:scale(.985)}
      @media(max-width:480px){.militopo-confirm-card{border-radius:21px;padding:17px}.militopo-confirm-actions{grid-template-columns:1fr}.militopo-confirm-ok{order:-1}.militopo-confirm-message{font-size:13px}}
    `;
    document.head.appendChild(style);
  }

  function ensureOverlay(){
    ensureStyle();
    let overlay=document.getElementById('militopoConfirmOverlay');
    if(overlay)return overlay;
    overlay=document.createElement('div');
    overlay.id='militopoConfirmOverlay';
    overlay.className='militopo-confirm-overlay';
    overlay.hidden=true;
    overlay.innerHTML=`<section class="militopo-confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="militopoConfirmTitle" aria-describedby="militopoConfirmMessage">
      <div class="militopo-confirm-head"><div class="militopo-confirm-icon" aria-hidden="true">?</div><div class="militopo-confirm-copy"><small>MILITOPO</small><h2 id="militopoConfirmTitle">CONFIRMAR ACCIÓN</h2></div></div>
      <p class="militopo-confirm-message" id="militopoConfirmMessage"></p>
      <div class="militopo-confirm-actions"><button class="militopo-confirm-cancel" type="button">CANCELAR</button><button class="militopo-confirm-ok" type="button">CONFIRMAR</button></div>
    </section>`;
    document.body.appendChild(overlay);
    const finish=value=>{
      if(overlay.hidden)return;
      overlay.hidden=true;
      document.documentElement.classList.remove('militopo-confirm-open');
      const resolve=activeResolve;activeResolve=null;
      try{lastFocus?.focus?.({preventScroll:true})}catch(_){ }
      lastFocus=null;
      resolve?.(Boolean(value));
    };
    overlay.querySelector('.militopo-confirm-cancel').addEventListener('click',()=>finish(false));
    overlay.querySelector('.militopo-confirm-ok').addEventListener('click',()=>finish(true));
    overlay.addEventListener('click',event=>{if(event.target===overlay)finish(false)});
    document.addEventListener('keydown',event=>{if(!overlay.hidden&&event.key==='Escape'){event.preventDefault();finish(false)}});
    return overlay;
  }

  globalThis.MILITOPO_CONFIRM=function(message,options={}){
    const overlay=ensureOverlay();
    if(activeResolve){activeResolve(false);activeResolve=null;}
    lastFocus=document.activeElement;
    const text=String(message??'').trim();
    const inferredDanger=/\b(borrar|eliminar|revocar|descartar|archivar|finalizar|salir sin guardar)\b/i.test(text);
    const danger=options.danger??inferredDanger;
    const card=overlay.querySelector('.militopo-confirm-card');
    card.classList.toggle('is-danger',Boolean(danger));
    overlay.querySelector('.militopo-confirm-icon').textContent=danger?'!':'?';
    overlay.querySelector('#militopoConfirmTitle').textContent=String(options.title||'CONFIRMAR ACCIÓN');
    overlay.querySelector('#militopoConfirmMessage').textContent=text;
    overlay.querySelector('.militopo-confirm-cancel').textContent=String(options.cancelText||'CANCELAR');
    overlay.querySelector('.militopo-confirm-ok').textContent=String(options.confirmText||'CONFIRMAR');
    overlay.hidden=false;
    document.documentElement.classList.add('militopo-confirm-open');
    setTimeout(()=>overlay.querySelector('.militopo-confirm-ok')?.focus({preventScroll:true}),20);
    return new Promise(resolve=>{activeResolve=resolve});
  };
})();
