/* MILITOPO R4 · lectura del perfil único y del histórico deportivo.
 * No crea un segundo perfil ni guarda resultados. Usa users/{uid} y getRunnerHistory.
 * Los permisos y el uid proceden siempre de Firebase Auth, nunca del modo visual. */
import {doc,getDoc} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {httpsCallable} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";

const asNonNegative=value=>Math.max(0,Number(value)||0);
const HISTORY_LIMIT=200;

export function summarizeRunnerHistory(input){
  const rows=Array.isArray(input)?input:[];
  const counted=rows.filter(row=>["finished","incomplete"].includes(String(row?.status||"").toLowerCase()));
  const finished=rows.filter(row=>String(row?.status||"").toLowerCase()==="finished").length;
  const incomplete=rows.filter(row=>String(row?.status||"").toLowerCase()==="incomplete").length;
  return {
    total:rows.length,started:counted.length,finished,incomplete,
    notStarted:rows.length-counted.length,
    distanceM:rows.reduce((sum,row)=>sum+asNonNegative(row?.trackDistanceM),0),
    penaltyMs:rows.reduce((sum,row)=>sum+asNonNegative(row?.penaltyMs),0),
    discarded:rows.reduce((sum,row)=>sum+asNonNegative(row?.discardedControlCount),0),
    completion:counted.length?Math.round(finished/counted.length*100):0,
    recent:rows.slice(0,5).map(row=>({
      eventName:String(row?.eventName||"Carrera"),status:String(row?.status||"not_started"),
      dateMs:Number(row?.finishedAtMs||row?.startedAtMs||row?.consolidatedAtMs)||0,
      distanceM:asNonNegative(row?.trackDistanceM),
      officialDurationMs:row?.officialDurationMs==null?null:asNonNegative(row.officialDurationMs)
    })),
    limited:rows.length>=HISTORY_LIMIT
  };
}

export async function fetchOrganizerUnifiedProfile(authContext,services){
  const uid=String(authContext?.uid||"");
  if(!uid||!services?.auth?.currentUser||services.auth.currentUser.uid!==uid)throw new Error("La sesión ha cambiado. Vuelve a entrar.");
  if(typeof navigator!=="undefined"&&navigator.onLine===false)throw new Error("Sin conexión. Las estadísticas se consultan desde tu cuenta, sin datos inventados.");
  const profileRequest=getDoc(doc(services.firestore,"users",uid));
  const historyRequest=httpsCallable(services.functions,"getRunnerHistory")({limit:HISTORY_LIMIT,clientVersion:"militopo-r4-profile"});
  const [profileResult,historyResult]=await Promise.allSettled([profileRequest,historyRequest]);
  if(services.auth.currentUser?.uid!==uid)throw new Error("La sesión ha cambiado. Vuelve a entrar.");
  const user=profileResult.status==="fulfilled"&&profileResult.value.exists()?profileResult.value.data()||{}:null;
  const results=historyResult.status==="fulfilled"?historyResult.value?.data?.results:null;
  const history=Array.isArray(results)?summarizeRunnerHistory(results):null;
  return {
    user,
    history,
    profileError:profileResult.status==="rejected"?"No se pudo actualizar el perfil. Se muestra la información de sesión.":"",
    historyError:!history?(historyResult.status==="rejected"?String(historyResult.reason?.message||"No se pudo cargar el histórico deportivo."):"El histórico deportivo no está disponible."):""
  };
}
