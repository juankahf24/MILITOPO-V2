"use strict";
// Read-only coaching metrics. Never used for ranking, penalties or control validation.
const R=6371008.8,rad=Math.PI/180;
const round=(v,d=1)=>Number.isFinite(v)?Number(v.toFixed(d)):null;
const num=v=>v===null||v===undefined||v===""?null:(Number.isFinite(Number(v))?Number(v):null);
function coord(p){const lat=num(p?.lat),lng=num(p?.lng??p?.lon);return lat!==null&&lng!==null&&Math.abs(lat)<=85&&Math.abs(lng)<=180?{lat,lng}:null;}
function meters(a,b){const p=a.lat*rad,q=b.lat*rad,h=Math.sin((q-p)/2)**2+Math.cos(p)*Math.cos(q)*Math.sin((b.lng-a.lng)*rad/2)**2;return R*2*Math.atan2(Math.sqrt(Math.min(1,h)),Math.sqrt(Math.max(0,1-h)));}
const id=v=>({SALIDA:"START",LLEGADA:"FINISH",META:"FINISH"}[String(v||"").trim().toUpperCase()]||String(v||"").trim().toUpperCase());
function analyzeItinerary({itinerary,track=[],routePointIds=[],startedAtMs,finishedAtMs,resultStatus,controlExpectedCount,controlDetectedCount}={}){
 const absent=reason=>({version:1,available:false,reason});
 if(!itinerary?.saved||!Array.isArray(itinerary.points)||itinerary.points.length<2)return absent("Esta carrera no tiene un itinerario de referencia guardado para tu recorrido.");
 if(itinerary.points.length>5000)return absent("El itinerario supera el tamaño admitido para este análisis.");
 const planned=itinerary.points.map(coord);if(planned.some(p=>!p))return absent("El itinerario contiene coordenadas no válidas.");
 const anchors=itinerary.points.filter(p=>p.anchorId).map(p=>id(p.anchorId)),expected=routePointIds.map(id);
 if(!expected.length||anchors.length!==expected.length||anchors.some((v,i)=>v!==expected[i]))return absent("El itinerario guardado no coincide con las balizas de tu recorrido histórico.");
 const start=num(startedAtMs),finish=num(finishedAtMs);
 if(!start||!finish||finish<=start)return absent("Faltan horas válidas de salida o llegada para comparar el GPS.");
 let plannedM=0;for(let i=1;i<planned.length;i++)plannedM+=meters(planned[i-1],planned[i]);
 if(plannedM<1)return absent("El itinerario de referencia no tiene una longitud suficiente.");
 const rows=track.filter(p=>num(p.at)!==null&&Number(p.at)>=start&&Number(p.at)<=finish).slice().sort((a,b)=>Number(a.at)-Number(b.at)||Number(a.seq||0)-Number(b.seq||0));
 if(rows.length<2)return absent("No hay suficientes posiciones GPS entre la salida y la llegada.");
 // Preserve breaks: rejected fixes must never be joined by a fictitious straight line.
 const segments=[];let previous=null,used=0,rejected=0,unknownAccuracy=0,distanceM=0,coveredMs=0,gaps=0,accuracySum=0,accuracyCount=0;
 for(const raw of rows){
  const p=coord(raw),accuracy=num(raw.accuracy),at=Number(raw.at);
  if(!p||(accuracy!==null&&accuracy>50)){previous=null;rejected++;continue;}
  if(accuracy===null||accuracy<=0)unknownAccuracy++;else{accuracySum+=accuracy;accuracyCount++;}
  used++;const current={...p,at};
  if(previous){const dt=at-previous.at,d=meters(previous,current);
   if(dt>0&&dt<=60000&&d/(dt/1000)<=15){segments.push({a:previous,b:current,d});distanceM+=d;coveredMs+=dt;}
   else if(dt>0)gaps++;
  }
  previous=current;
 }
 if(!segments.length||distanceM<1)return absent("El GPS útil es insuficiente o presenta saltos que impiden la comparación.");
 const lat0=planned[0].lat,lon0=planned[0].lng,cos=Math.cos(lat0*rad);
 const xy=p=>({x:(p.lng-lon0)*rad*R*cos,y:(p.lat-lat0)*rad*R});
 const line=planned.map(xy);
 function deviation(p){const q=xy(p);let best=Infinity;for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((q.x-a.x)*dx+(q.y-a.y)*dy)/(dx*dx+dy*dy||1)));best=Math.min(best,Math.hypot(q.x-a.x-t*dx,q.y-a.y-t*dy));}return best;}
 // Bound nearest-segment work; distance and time coverage still use the complete useful track.
 const stride=Math.max(1,Math.ceil(segments.length/6000));let weight=0,near=0,sum=0;
 for(let i=0;i<segments.length;i+=stride){const s=segments[i];if(!s.d)continue;const dev=deviation({lat:(s.a.lat+s.b.lat)/2,lng:(s.a.lng+s.b.lng)/2});weight+=s.d;sum+=dev*s.d;if(dev<=20)near+=s.d;}
 const coverage=Math.min(1,coveredMs/(finish-start));
 const controls=num(controlExpectedCount),detected=num(controlDetectedCount);
 const complete=String(resultStatus)==="finished"&&controls>0&&detected>=controls;
 const meanAccuracy=accuracyCount?accuracySum/accuracyCount:null;
 const reliable=coverage>=.9&&rejected/rows.length<=.1&&unknownAccuracy/Math.max(1,used)<=.2&&meanAccuracy!==null&&meanAccuracy<=25;
 const comparable=complete&&reliable;
 return {version:1,available:true,quality:reliable?"usable":"limited",comparable,
  referenceUpdatedAt:String(itinerary.updatedAt||"").slice(0,40),plannedDistanceM:round(plannedM),analyzedDistanceM:round(distanceM),
  distanceDifferenceM:comparable?round(distanceM-plannedM):null,
  distanceRatioPct:comparable?round(plannedM/distanceM*100):null,
  nearReferencePct:weight?round(near/weight*100):null,meanDeviationM:weight?round(sum/weight):null,corridorM:20,
  controlEffectivenessPct:controls>0&&detected!==null?round(Math.min(1,Math.max(0,detected/controls))*100):null,
  timeCoveragePct:round(coverage*100),usedPointCount:used,rejectedPointCount:rejected,gapCount:gaps,
  unknownAccuracyCount:unknownAccuracy,meanAccuracyM:round(meanAccuracy),sampled:stride>1,
  note:!complete?"Participación incompleta: no se puntúa la relación de distancias.":!reliable?"GPS parcial o impreciso: no se puntúa la relación de distancias.":distanceM<plannedM*.98?"Has registrado menos distancia que la referencia. Puede ser otra elección de camino o una diferencia del GPS.":"Compara tu elección con la referencia del organizador; no implica que esa referencia sea el camino óptimo."};
}
module.exports={analyzeItinerary};
