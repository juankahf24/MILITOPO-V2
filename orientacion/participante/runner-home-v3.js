/* MILITOPO V2 · F3A · Home Runner V3 autónoma.
   No depende de auth-ui/bootstrap para arrancar. Inicializa el mismo app-name
   de Firebase y recupera la sesión persistida del login. */
const VERSION="v2-f3a-runner-home-v3-20260923";
const REGION="europe-west1";
const els={
  name:document.getElementById("rhName"),meta:document.getElementById("rhMeta"),avatar:document.getElementById("rhAvatar"),
  detailsBtn:document.getElementById("rhDetailsBtn"),logoutBtn:document.getElementById("rhLogoutBtn"),details:document.getElementById("rhDetails"),
  status:document.getElementById("rhStatus"),events:document.getElementById("rhEvents"),retry:document.getElementById("rhRetry")
};
let sdk=null,auth=null,currentUser=null,profile=null;
function text(el,v){if(el)el.textContent=String(v??"");}
function esc(v){return String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));}
function setStatus(message,type=""){text(els.status,message);els.status.className=`status${type?` ${type}`:""}`;}
function initials(name){const p=String(name||"").trim().split(/\s+/).filter(Boolean);return ((p[0]?.[0]||"")+(p[1]?.[0]||"")).toUpperCase()||"R";}
function withTimeout(promise,ms,label){return Promise.race([promise,new Promise((_,reject)=>setTimeout(()=>reject(new Error(label||"TIMEOUT")),ms))]);}
async function loadSdk(){
  setStatus("Cargando Firebase de forma segura…");
  const imports=Promise.all([
    import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js"),
    import("https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js")
  ]);
  const [appMod,authMod,fsMod,fnMod]=await withTimeout(imports,12000,"No se pudieron cargar los módulos de Firebase.");
  return {appMod,authMod,fsMod,fnMod};
}
function config(){
  const cfg=globalThis.MILITOPO_V2_CONFIG;
  if(!cfg?.configured||!cfg.firebase?.apiKey)throw new Error("La configuración Firebase V2 no está disponible.");
  return cfg.firebase;
}
async function initFirebase(){
  sdk=await loadSdk();
  const {appMod,authMod}=sdk;
  const app=appMod.getApps().find(a=>a.name==="militopo-v2")||appMod.initializeApp(config(),"militopo-v2");
  try{
    auth=authMod.initializeAuth(app,{persistence:[authMod.indexedDBLocalPersistence,authMod.browserLocalPersistence,authMod.browserSessionPersistence]});
  }catch(error){
    const code=String(error?.code||"");
    if(code.includes("already-initialized"))auth=authMod.getAuth(app);else throw error;
  }
  return app;
}
async function waitForUser(){
  setStatus("Recuperando tu sesión MILITOPO…");
  if(typeof auth.authStateReady==="function"){
    try{await withTimeout(auth.authStateReady(),8000,"Firebase Auth tardó demasiado.");}catch(_){/* fallback observer */}
  }
  if(auth.currentUser)return auth.currentUser;
  return await withTimeout(new Promise((resolve,reject)=>{
    let done=false;const stop=sdk.authMod.onAuthStateChanged(auth,u=>{if(done)return;done=true;stop();resolve(u);},e=>{if(done)return;done=true;stop();reject(e);});
  }),8000,"No se detectó una sesión activa.");
}
async function loadProfile(app,user){
  const {fsMod}=sdk;const db=fsMod.getFirestore(app);let data={};
  try{const snap=await withTimeout(fsMod.getDoc(fsMod.doc(db,"users",user.uid)),8000,"El perfil tardó demasiado.");if(snap.exists())data=snap.data()||{};}catch(error){console.warn("[MILITOPO runner home profile]",error);}
  profile=data;const displayName=String(data.displayName||user.displayName||user.email||"Corredor").trim();const username=String(data.usernameKey||data.username||"").trim().toLowerCase();
  text(els.name,displayName);text(els.meta,`${username?`@${username} · `:""}runner · ${user.email||""}`);text(els.avatar,initials(displayName));
  els.detailsBtn.disabled=false;els.logoutBtn.disabled=false;
  els.details.innerHTML=`<strong>Nombre:</strong> ${esc(displayName)}<br><strong>Usuario:</strong> ${username?`@${esc(username)}`:"Sin usuario"}<br><strong>Correo:</strong> ${esc(user.email||"")}<br><strong>Rol:</strong> runner<br><span class="small">UID: ${esc(user.uid)}</span>`;
}
function statusES(s){return ({prepared:"PREPARADO",published:"PUBLICADO",live:"EN DIRECTO",finished:"FINALIZADO"})[String(s||"").toLowerCase()]||String(s||"").toUpperCase();}
function renderEvents(events){
  els.events.innerHTML="";
  if(!events.length){setStatus("No tienes carreras preparadas, publicadas o en directo asociadas a esta cuenta.","ok");return;}
  setStatus(`✅ ${events.length} carrera${events.length===1?"":"s"} asociada${events.length===1?"":"s"} a tu cuenta.`,"ok");
  els.events.innerHTML=events.map(ev=>{
    const live=String(ev.status||"").toLowerCase()==="live"&&String(ev.liveRunId||"").trim();
    const action=live?`<button class="btn primary" type="button" data-enter-event="${esc(ev.eventId)}">ENTRAR EN LA CARRERA</button>`:`<div class="waiting">${String(ev.status||"").toLowerCase()==="finished"?"Carrera finalizada.":"Esperando a que el organizador inicie la carrera."}</div>`;
    return `<article class="event"><strong>${esc(ev.eventName||"Carrera")}</strong><div class="event-meta">${esc(statusES(ev.status))} · ${esc(ev.eventId||"")}</div><span class="pill">${esc(statusES(ev.status))}</span>${action}</article>`;
  }).join("");
  els.events.querySelectorAll("[data-enter-event]").forEach(btn=>btn.addEventListener("click",()=>{
    const id=String(btn.dataset.enterEvent||"");const url=new URL("runner.html",location.href);url.searchParams.set("app","1");url.searchParams.set("event",id);location.href=url.href;
  }));
}
async function loadEvents(app){
  setStatus("Consultando tus carreras Live V2…");els.retry.style.display="none";
  const functions=sdk.fnMod.getFunctions(app,REGION);const call=sdk.fnMod.httpsCallable(functions,"getRunnerLiveEvents");
  try{
    const result=await withTimeout(call({clientVersion:VERSION}),15000,"La consulta de carreras tardó demasiado.");
    const events=Array.isArray(result?.data?.events)?result.data.events:[];renderEvents(events);
  }catch(error){
    console.error("[MILITOPO runner home events]",error);const code=String(error?.code||"");const msg=String(error?.message||"No se pudieron consultar tus carreras.");
    setStatus(`⚠️ ${msg}${code?` (${code})`:""}`,"err");els.retry.style.display="block";
  }
}
async function boot(){
  try{
    const app=await initFirebase();
    const user=await waitForUser();
    if(!user){throw new Error("No hay una sesión iniciada. Vuelve a la pantalla de acceso.");}
    currentUser=user;
    if(!user.emailVerified){throw new Error("Tu correo todavía no está verificado.");}
    await loadProfile(app,user);
    await loadEvents(app);
  }catch(error){
    console.error("[MILITOPO runner home boot]",error);text(els.name,"No se pudo cargar tu cuenta");text(els.meta,"La sesión o Firebase no respondieron correctamente.");setStatus(`⚠️ ${String(error?.message||error)}`,"err");els.retry.style.display="block";
  }
}
els.detailsBtn?.addEventListener("click",()=>{els.details.classList.toggle("show");els.detailsBtn.textContent=els.details.classList.contains("show")?"OCULTAR DATOS":"VER DATOS DE CUENTA";});
els.logoutBtn?.addEventListener("click",async()=>{try{if(auth&&sdk)await sdk.authMod.signOut(auth);}catch(_){}location.replace("../../");});
els.retry?.addEventListener("click",()=>{location.reload();});
boot();
