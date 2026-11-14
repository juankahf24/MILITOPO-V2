/* Explanatory post-race metrics, separate from official classification. */
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const valid=v=>v!==null&&v!==undefined&&Number.isFinite(Number(v));
const pct=v=>valid(v)?`${Number(v).toFixed(1)} %`:'—';
const distance=v=>valid(v)?`${(Number(v)/1000).toFixed(2)} km`:'—';
export function itineraryAnalysisHtml(data){
 if(!document.getElementById('m2ItineraryAnalysisStyle')){
  const style=document.createElement('style');style.id='m2ItineraryAnalysisStyle';style.textContent=`
  .ia-card{margin:14px 0;padding:15px;border:1px solid #8bab7540;border-radius:17px;background:linear-gradient(140deg,#203a292e,#ffffff03);color:#ebefdf;min-width:0}.ia-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.ia-head strong{font:850 14px/1.3 system-ui}.ia-badge{padding:5px 8px;border:1px solid #9eb27744;border-radius:8px;font:750 9px/1.3 system-ui;color:#ccdcab}.ia-note{margin:10px 0 0;font:450 11px/1.55 system-ui;color:#b4c4ae}.ia-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:12px}.ia-metric{padding:10px;border:1px solid #b8d39b14;border-radius:11px;background:#a7c78d06;min-width:0}.ia-metric small{display:block;font:750 8px/1.4 system-ui;letter-spacing:.035em;color:#a8bb9e}.ia-metric b{display:block;margin-top:4px;font:850 18px/1.3 system-ui;color:#e4dfad;overflow-wrap:anywhere}.ia-metric span{display:block;margin-top:4px;font:450 10px/1.4 system-ui;color:#95a68d}.ia-quality{margin-top:10px;padding-top:10px;border-top:1px solid #b4c69b1a;font:500 10px/1.5 system-ui;color:#9fb092}.ia-card summary{cursor:pointer;min-height:38px;display:flex;align-items:center;color:#cabd89;font:750 11px/1.4 system-ui}.ia-card details p{margin:0;font:450 10px/1.6 system-ui;color:#a8b89e}@media(max-width:350px){.ia-grid{grid-template-columns:1fr}.ia-card{padding:12px}}`;
  document.head.append(style);
 }
 const head='<div class="ia-head"><strong>Análisis de tu itinerario</strong>';
 if(!data?.available)return `<section class="ia-card">${head}</div><p class="ia-note">${esc(data?.reason||'El análisis todavía no está disponible para este resultado.')}</p></section>`;
 const metrics=[
  ['ITINERARIO PREVISTO',distance(data.plannedDistanceM),'Referencia dibujada por el organizador'],
  ['GPS ÚTIL ANALIZADO',distance(data.analyzedDistanceM),data.quality==='limited'?'Registro parcial o de calidad limitada':'Posiciones entre salida y llegada'],
  ['DIFERENCIA DE DISTANCIA',valid(data.distanceDifferenceM)?`${Number(data.distanceDifferenceM)>=0?'+':''}${Math.round(Number(data.distanceDifferenceM))} m`:'—','GPS menos referencia; no equivale a distancia evitable'],
  ['RELACIÓN REF. / GPS',pct(data.distanceRatioPct),'Referencia ÷ GPS × 100. Puede superar el 100 %'],
  ['PROXIMIDAD AL ITINERARIO',pct(data.nearReferencePct),`Distancia analizada a unos ${Number(data.corridorM)||20} m o menos de la referencia`],
  ['SEPARACIÓN MEDIA',valid(data.meanDeviationM)?`${Math.round(Number(data.meanDeviationM))} m`:'—','Estimación de separación respecto a la línea prevista'],
  ['EFECTIVIDAD DE CONTROLES',pct(data.controlEffectivenessPct),'Controles validados / controles esperados'],
  ['COBERTURA TEMPORAL GPS',pct(data.timeCoveragePct),'Tiempo con segmentos GPS útiles / duración de carrera']
 ];
 return `<section class="ia-card">${head}<span class="ia-badge">${data.quality==='limited'?'GPS LIMITADO':'ANÁLISIS ORIENTATIVO'}</span></div><p class="ia-note">${esc(data.note)}</p><div class="ia-grid">${metrics.map(([label,value,help])=>`<div class="ia-metric"><small>${esc(label)}</small><b>${esc(value)}</b><span>${esc(help)}</span></div>`).join('')}</div><p class="ia-quality">${Number(data.usedPointCount)||0} posiciones útiles · ${Number(data.rejectedPointCount)||0} descartadas · ${Number(data.gapCount)||0} cortes entre posiciones${valid(data.meanAccuracyM)?` · Precisión media declarada ±${Math.round(Number(data.meanAccuracyM))} m`:""}${data.sampled?' · Separación estimada por muestreo':''}.</p><details><summary>Cómo interpretar estos datos</summary><p>Se excluyen posiciones con precisión declarada peor que 50 m, saltos de más de 60 segundos y segmentos de velocidad superior a 15 m/s. No se rellenan los huecos del GPS. La relación de distancias se muestra solo con al menos un 90 % de cobertura temporal, precisión media declarada de 25 m o mejor, como máximo un 10 % de posiciones rechazadas, un 20 % sin precisión declarada y todos los controles completados. Otro camino puede ser válido y más corto. Estos datos no cambian tiempos, penalizaciones ni clasificación.</p></details></section>`;
}
