/* Información de carrera compartida; no inicia carreras ni solicita ubicación del dispositivo. */
const contexts=new Map(),memory=new Map(),pending=new Map(),retryAt=new Map();
const CACHE_PREFIX='militopo_weather_v1:',TTL=30*60*1000;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function raceStartMs(value){
 if(value==null||value==='')return NaN;
 if(typeof value?.toMillis==='function')return value.toMillis();
 if(typeof value==='object'&&Number.isFinite(value.seconds))return value.seconds*1000;
 if(typeof value==='number')return value>1e12?value:value*1000;
 // Los horarios guardados deben llevar zona UTC/offset para no variar con el teléfono.
 return typeof value==='string'&&/(Z|[+-]\d\d:\d\d)$/i.test(value)?Date.parse(value):NaN;
}
export function meetingCoordinates(point){
 if(point?.lat===null||point?.lon===null||point?.lat===undefined||point?.lon===undefined||point?.lat===''||point?.lon==='')return null;
 const lat=Number(point.lat),lon=Number(point.lon);return Number.isFinite(lat)&&Number.isFinite(lon)&&Math.abs(lat)<=90&&Math.abs(lon)<=180?{lat,lon}:null;
}
export function meetingDirections(point){const p=meetingCoordinates(point);if(!p)return '';return 'https://www.google.com/maps/dir/?'+new URLSearchParams({api:'1',destination:`${p.lat},${p.lon}`,travelmode:'driving',dir_action:'navigate'});}
export function raceCountdown(event,now=Date.now()){
 const status=String(event.status||'').toLowerCase();if(status==='live')return 'EN DIRECTO · Carrera iniciada';if(['finished','archived'].includes(status))return 'Carrera finalizada';
 const start=raceStartMs(event.scheduledStartAt);if(!Number.isFinite(start))return 'Horario pendiente de confirmar';
 const seconds=Math.max(0,Math.ceil((start-now)/1000));if(!seconds)return 'Hora prevista alcanzada · Esperando al organizador';
 const d=Math.floor(seconds/86400),h=Math.floor(seconds%86400/3600),m=Math.floor(seconds%3600/60),s=seconds%60;
 return `${d} d · ${String(h).padStart(2,'0')} h · ${String(m).padStart(2,'0')} min · ${String(s).padStart(2,'0')} s`;
}
function weatherLabel(code){if(code===0)return 'Despejado';if([1,2].includes(code))return 'Parcialmente nuboso';if(code===3)return 'Cubierto';if([45,48].includes(code))return 'Niebla';if(code>=51&&code<=57)return 'Llovizna';if(code>=61&&code<=67)return 'Lluvia';if(code>=71&&code<=77)return 'Nieve';if(code>=80&&code<=82)return 'Chubascos';if([85,86].includes(code))return 'Chubascos de nieve';if([95,96,99].includes(code))return 'Tormenta';return 'Previsión meteorológica';}
export function selectHourlyForecast(json,start){
 const h=json?.hourly;if(!Array.isArray(h?.time)||!h.time.length)throw Error('Sin previsión para esa hora.');
 let best=-1,distance=Infinity;h.time.forEach((v,i)=>{const diff=Math.abs(Number(v)*1000-start);if(diff<distance){best=i;distance=diff;}});
 if(best<0||distance>3600*1000)throw Error('La previsión todavía no cubre la hora de la carrera.');
 const n=key=>{const value=h[key]?.[best];return value===null||value===undefined||!Number.isFinite(Number(value))?null:Number(value);};
 const result={temperature:n('temperature_2m'),rain:n('precipitation_probability'),wind:n('wind_speed_10m'),gust:n('wind_gusts_10m'),code:n('weather_code')};
 if(result.temperature===null&&result.code===null)throw Error('La previsión no contiene datos para esa hora.');return result;
}
function weatherKey(event){const p=meetingCoordinates(event.meetingPoint),start=raceStartMs(event.scheduledStartAt);return p&&Number.isFinite(start)?`${p.lat.toFixed(4)},${p.lon.toFixed(4)}:${start}`:'';}
function readCache(key){if(memory.has(key))return memory.get(key);try{const entry=JSON.parse(localStorage.getItem(CACHE_PREFIX+key)||'null');if(entry?.data&&Number.isFinite(entry.at)&&Date.now()-entry.at>=0&&Date.now()-entry.at<24*3600000){memory.set(key,entry);return entry;}}catch(_){}return null;}
async function forecast(event){
 const key=weatherKey(event);if(!key)return;
 const old=readCache(key);if(old&&Date.now()-old.at<TTL)return old;
 if(navigator.onLine===false)return old;
 if(pending.has(key))return pending.get(key);
 if((retryAt.get(key)||0)>Date.now())return old;
 const start=raceStartMs(event.scheduledStartAt),p=meetingCoordinates(event.meetingPoint);
 if(start<Date.now()-3600000||start>Date.now()+16*86400000)return old;
 const task=(async()=>{const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),10000);try{
  const url='https://api.open-meteo.com/v1/forecast?'+new URLSearchParams({latitude:String(p.lat),longitude:String(p.lon),hourly:'temperature_2m,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m',forecast_days:'16',timezone:'GMT',timeformat:'unixtime',wind_speed_unit:'kmh'});
  const response=await fetch(url,{signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer'});if(!response.ok)throw Error('Servicio temporalmente no disponible.');
  const entry={at:Date.now(),data:selectHourlyForecast(await response.json(),start)};memory.set(key,entry);retryAt.delete(key);
  try{const keys=Object.keys(localStorage).filter(k=>k.startsWith(CACHE_PREFIX));if(keys.length>=12)keys.sort((a,b)=>{try{return JSON.parse(localStorage.getItem(a)).at-JSON.parse(localStorage.getItem(b)).at;}catch(_){return 0;}}).slice(0,keys.length-11).forEach(k=>localStorage.removeItem(k));localStorage.setItem(CACHE_PREFIX+key,JSON.stringify(entry));}catch(_){}
  return entry;
 }catch(_){retryAt.set(key,Date.now()+5*60000);return old;}finally{clearTimeout(timeout);pending.delete(key);}})();pending.set(key,task);return task;
}
function formatStart(event){const ms=raceStartMs(event.scheduledStartAt);if(!Number.isFinite(ms))return '';try{return new Intl.DateTimeFormat('es-ES',{dateStyle:'medium',timeStyle:'short',timeZone:event.timeZone||'Europe/Madrid'}).format(ms);}catch(_){return new Date(ms).toISOString();}}
function weatherIcon(kind){
 const common='viewBox="0 0 64 64" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
 const cloud='<path d="M18 44h28a12 12 0 0 0 0-24 16 16 0 0 0-30-3 13.5 13.5 0 0 0 2 27Z" fill="#c8dfed" stroke="#7ca9c2" stroke-width="2"/>';
 const sun='<circle cx="26" cy="25" r="12" fill="#f4c54f" stroke="#e3a830" stroke-width="2"/><path d="M26 4v4m0 34v4M5 25h4m34 0h4M11 10l3 3m24 24 3 3M11 40l3-3m24-24 3-3" stroke="#f4c54f" stroke-width="3"/>';
 if(kind==='rain')return `<svg ${common}>${cloud}<path d="m21 50-3 7m15-7-3 7m15-7-3 7" stroke="#55bbf0" stroke-width="4"/></svg>`;
 if(kind==='snow')return `<svg ${common}>${cloud}<path d="M20 50v10m-5-5h10m10-5v10m-5-5h10m10-5v10m-5-5h10" stroke="#b2e8ff" stroke-width="2"/></svg>`;
 if(kind==='storm')return `<svg ${common}>${cloud}<path d="m34 40-9 13h9l-5 10 17-17H35l6-6" fill="#f4c54f" stroke="#e1ab30" stroke-width="1.5"/></svg>`;
 if(kind==='fog')return `<svg ${common}>${cloud}<path d="M9 48h46M15 55h34" stroke="#b7ceca" stroke-width="3"/></svg>`;
 if(kind==='sun')return `<svg ${common}>${sun}</svg>`;
 if(kind==='partial')return `<svg ${common}>${sun}<path d="M27 51h23a10 10 0 0 0-1-20 12 12 0 0 0-22 0 10 10 0 0 0 0 20Z" fill="#c8dfed" stroke="#7ca9c2" stroke-width="2"/></svg>`;
 return `<svg ${common}>${cloud}</svg>`;
}
function conditionIcon(code){return weatherIcon(code===0?'sun':[1,2].includes(code)?'partial':[45,48].includes(code)?'fog':code>=95?'storm':code>=71&&code<=77||[85,86].includes(code)?'snow':code>=51&&code<=67||code>=80&&code<=82?'rain':'cloud');}
function metricIcon(kind){return kind==='rain'?'<svg viewBox="0 0 24 24" fill="#59bdf1" aria-hidden="true"><path d="M12 2C10 6 5 11 5 15a7 7 0 0 0 14 0c0-4-5-9-7-13Z"/></svg>':`<svg viewBox="0 0 24 24" fill="none" stroke="${kind==='gust'?'#e9bd69':'#93d8c0'}" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 7h12a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 17h5a2 2 0 1 1-2 2"/></svg>`;}
function weatherHtml(event,entry){
 const ms=raceStartMs(event.scheduledStartAt),p=meetingCoordinates(event.meetingPoint);let body='';
 if(!p)body='El organizador debe confirmar el punto de encuentro.';
 else if(!Number.isFinite(ms))body='Falta el horario programado para consultar el tiempo.';
 else if(ms>Date.now()+16*86400000)body='Previsión disponible al acercarse la fecha (hasta 16 días).';
 else if(entry?.data){const d=entry.data,num=(v,unit)=>Number.isFinite(v)?`${Math.round(v)}${unit}`:'—';body=`<div class="mp-weather-condition">${conditionIcon(d.code)}<div><strong>${num(d.temperature,' °C')}</strong><span>${esc(weatherLabel(d.code))}</span></div></div><div class="mp-race-weather-values"><div>${metricIcon("rain")}<span>Lluvia</span><strong>${num(d.rain,' %')}</strong></div><div>${metricIcon("wind")}<span>Viento</span><strong>${num(d.wind,' km/h')}</strong></div><div>${metricIcon("gust")}<span>Rachas</span><strong>${num(d.gust,' km/h')}</strong></div></div><small>${Date.now()-entry.at>=TTL?'Última previsión guardada':'Actualizado'}: ${esc(new Date(entry.at).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'}))}</small>`;if(d.code>=95)body+='<p class="mp-race-weather-warning">Previsión de tormenta: revisa la evolución y las indicaciones de la organización.</p>';}
 else if(ms<Date.now()-3600000)body='La hora programada ya ha pasado; no hay previsión guardada.';
 else body=navigator.onLine===false?'Sin conexión y sin previsión guardada.':'Previsión no disponible ahora. Se volverá a intentar automáticamente.';
 return `<div class="mp-weather-heading"><strong>TIEMPO A LA HORA PROGRAMADA</strong><details class="mp-race-source"><summary aria-label="Fuente y licencia de la previsión" title="Información meteorológica"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/></svg></summary><span>Previsión: <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a></span></details></div><div>${body}</div>`;
}
function bodyHtml(event){const start=formatStart(event),directions=meetingDirections(event.meetingPoint),live=event.status==='live';return `<div class="mp-race-signal ${live?'is-live':''}"><span aria-hidden="true"></span><strong data-race-countdown>${esc(raceCountdown(event))}</strong></div>${start?`<div class="mp-race-date">Inicio programado: ${esc(start)}</div>`:''}<div class="mp-race-meeting"><small>PUNTO DE ENCUENTRO</small><strong>${esc(event.meetingPoint?.name||'Punto de encuentro')}</strong>${directions?`<a href="${esc(directions)}" target="_blank" rel="noopener noreferrer">CÓMO LLEGAR EN COCHE ↗</a>`:'<span>Ubicación pendiente de confirmar</span>'}</div><div class="mp-race-weather" data-race-weather>${weatherHtml(event,readCache(weatherKey(event)))}</div>`;}
function styles(){if(document.getElementById('mp-race-info-style'))return;const s=document.createElement('style');s.id='mp-race-info-style';s.textContent=`
.mp-race-info{min-width:0;padding:16px;border:1px solid #91ad964d;border-radius:18px;background:#142f25;color:#edf4e9;margin:14px 0;font-family:system-ui;text-align:left}.mp-race-info *{box-sizing:border-box}.mp-race-signal{display:flex;gap:9px;align-items:center;font-size:14px;line-height:1.4}.mp-race-signal>span{flex:none;width:10px;height:10px;border-radius:50%;background:#d8b66b}.mp-race-signal.is-live>span{background:#54e780;box-shadow:0 0 0 5px #4ce68122,0 0 14px #4ce68177}.mp-race-signal.is-live strong{color:#83f4a3!important}.mp-race-date{font-size:11px;color:#bed1c0;line-height:1.5;margin-top:9px}.mp-race-meeting{display:grid;gap:6px;margin:14px 0;padding-top:12px;border-top:1px solid #809b832b}.mp-race-info small{display:block;color:#b3c7b4;font-size:10px;letter-spacing:.04em;margin-bottom:6px}.mp-race-info strong{color:#ecf4e9;font-size:14px;text-shadow:none!important;overflow-wrap:anywhere}.mp-race-info a{color:#ecd18c;font-size:12px;line-height:1.5}.mp-race-meeting>a{padding:10px 12px;min-height:42px;border:1px solid #a9c8aa66;border-radius:10px;text-align:center;text-decoration:none}.mp-race-weather{font-size:12px;line-height:1.6}.mp-race-weather-values{display:flex;flex-wrap:wrap;gap:6px 14px;margin:6px 0}.mp-race-weather>a{font-size:10px}.mp-race-weather-warning{color:#ffd29a!important;padding:8px;border:1px solid #cda16c;border-radius:8px}.mp-race-info[data-race-theme=light]{background:#edf4eb;color:#264b34}.mp-race-info[data-race-theme=light] strong{color:#244b34}.mp-race-info[data-race-theme=light] small,.mp-race-info[data-race-theme=light] .mp-race-date{color:#637b67}.mp-race-info[data-race-theme=light] a{color:#315f3f}.mp-race-info[data-race-theme=light] .mp-race-signal.is-live strong{color:#18723d!important}.mp-race-info[data-race-theme=light] .mp-race-weather-warning{background:#fff2dd;color:#74421c!important}

/* Integrado en la tarjeta de carrera en ambos modos. */
.mp-race-info,.mp-race-info[data-race-theme=light]{background:transparent!important;border:0;border-top:1px solid #9db9a23b;border-radius:0;box-shadow:none!important;padding:16px 0 0;margin:16px 0;color:inherit}
.mp-race-info .mp-weather-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:18px 0 12px;padding-top:14px;border-top:1px solid #9db9a23b}
.mp-race-info .mp-weather-heading>strong{font:850 13px/1.4 system-ui;letter-spacing:.06em;color:#efcd87!important}
.mp-race-info .mp-race-source{position:relative;flex:none;font-size:10px}.mp-race-info .mp-race-source summary{display:grid;place-items:center;width:28px;height:28px;cursor:pointer;list-style:none;color:#c9d9c7}.mp-race-source summary::-webkit-details-marker{display:none}.mp-race-source summary svg{width:18px;height:18px}.mp-race-source>span{display:block;position:absolute;right:0;z-index:5;width:210px;max-width:70vw;padding:12px;background:#163c2b;border:1px solid #829d83;border-radius:12px;box-shadow:0 4px 16px #0003;color:#e8f2e5}
.mp-race-info .mp-weather-condition{display:flex;align-items:center;gap:16px}.mp-weather-condition>svg{width:66px;height:66px;flex:none}.mp-weather-condition>div{display:grid;gap:2px}.mp-race-info .mp-weather-condition strong{font:850 28px/1.2 system-ui;color:#eff6ec}.mp-weather-condition span{font-size:14px;color:#d0e1ce}
.mp-race-info .mp-race-weather-values{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:16px 0}.mp-race-weather-values>div{display:grid;justify-items:start;align-content:start;gap:5px;min-width:0}.mp-race-weather-values svg{width:24px;height:24px}.mp-race-weather-values span{font-size:11px;color:#bfcebb}.mp-race-weather-values strong{font-size:13px;line-height:1.4;overflow-wrap:anywhere}
.mpp-r3-current .mp-race-info small{color:#bfd0bd}.mpp-r3-current .mp-race-info strong{color:#edf5e8}.mpp-r3-current .mp-race-info a{color:#e8cd88}.mpp-r3-current .mp-race-info .mp-race-date{color:#bfd0bd}
`;document.head.appendChild(s);}
export function setRaceInfoContext(event,authoritative=false){if(!event?.eventId)return;const id=String(event.eventId),old=contexts.get(id)||{eventId:id},next={...old};for(const k of ['status','scheduledStartAt','timeZone','meetingPoint'])if((authoritative||Object.hasOwn(event,k))&&(k!=='status'||authoritative||!old._authoritative))next[k]=event[k];if(authoritative)next._authoritative=true;if(JSON.stringify(next)===JSON.stringify(old))return;contexts.set(id,next);document.querySelectorAll('[data-race-info]').forEach(node=>{if(node.dataset.raceInfo===id)node.innerHTML=bodyHtml(next);});queueMicrotask(hydrate);}
export function raceInfoHtml(event,theme='dark'){if(!event?.eventId)return '';styles();setRaceInfoContext(event);queueMicrotask(hydrate);return `<section class="mp-race-info" data-race-info="${esc(event.eventId)}" data-race-theme="${theme==='light'?'light':'dark'}" aria-label="Horario, encuentro y tiempo de la carrera">${bodyHtml(contexts.get(String(event.eventId))||event)}</section>`;}
async function hydrate(){if(document.hidden)return;const ids=new Set([...document.querySelectorAll('[data-race-info]')].map(node=>node.dataset.raceInfo));await Promise.all([...ids].map(async id=>{const event=contexts.get(id);if(!event)return;const key=weatherKey(event),entry=await forecast(event);if(contexts.get(id)!==event||key!==weatherKey(event))return;document.querySelectorAll('[data-race-info]').forEach(node=>{if(node.dataset.raceInfo!==id)return;const weather=node.querySelector('[data-race-weather]'),html=weatherHtml(event,entry);if(weather&&weather.innerHTML!==html){const expanded=weather.querySelector(".mp-race-source")?.open;weather.innerHTML=html;if(expanded){const source=weather.querySelector(".mp-race-source");if(source)source.open=true;}}});}));}
let lastHydrate=0;setInterval(()=>{if(document.hidden)return;document.querySelectorAll('[data-race-info]').forEach(node=>{const event=contexts.get(node.dataset.raceInfo),target=node.querySelector('[data-race-countdown]');if(event&&target){const value=raceCountdown(event);if(target.textContent!==value)target.textContent=value;}});if(Date.now()-lastHydrate>60000){lastHydrate=Date.now();void hydrate();}},1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void hydrate();});globalThis.addEventListener('online',()=>void hydrate());
export function clearRaceInfo(){contexts.clear();}
