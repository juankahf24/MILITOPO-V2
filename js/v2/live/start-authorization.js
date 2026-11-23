/* Shared by both runner race screens. The participant subscription supplies the official decision. */
globalThis.createRunnerStartAuthorization = function ({ el, raceToken, isCurrent, services }) {
  let sending = null;
  let failure = "";
  let latest = null;
  let contextEpoch = null;

  function render(row, gpsReady, runClosed) {
    const token = raceToken();
    if (contextEpoch !== token.epoch) {
      contextEpoch = token.epoch;
      sending = null;
      failure = "";
    }
    latest = {row, gpsReady, runClosed};
    const request = el("m2raceRequestStart");
    const action = el("m2raceStart");
    const note = el("m2raceAuthError");
    const waiting = !row || ["not_started", "ready"].includes(row.status || "ready");
    const approval = row?.startAuthorization?.status;
    const approved = approval === "approved";
    const pending = approval === "pending";
    const assigned = Boolean(row?.routeId && row?.participantId);
    request.hidden = !waiting || runClosed;
    note.textContent = waiting && !approved && !pending && !runClosed ? failure : "";
    if (!waiting) return;
    request.dataset.approval = approved ? "approved" : pending ? "pending" : "new";
    request.disabled = !assigned || approved || pending || Boolean(sending) || runClosed;
    request.textContent = approved ? "✓  Salida autorizada" : pending ? "Solicitud enviada · pendiente"
      : sending ? "Enviando solicitud…" : "Pedir autorización de salida";
    action.disabled = runClosed || !approved || !assigned || !gpsReady;
    action.textContent = runClosed ? "SALIDA CERRADA" : !approved ? "🔒 INICIAR RECORRIDO"
      : !assigned ? "RECORRIDO NO DISPONIBLE" : !gpsReady ? "ACTIVA GPS PARA INICIAR" : "INICIAR RECORRIDO";
  }

  async function request() {
    const token = raceToken();
    if (!latest || !isCurrent(token) || el("m2raceRequestStart").disabled) return;
    sending = token;
    failure = "";
    const refresh = () => render(latest.row, latest.gpsReady, latest.runClosed);
    refresh();
    try {
      const svc = await services();
      if (!isCurrent(token)) return;
      const result = await svc.callable("liveStartAuthorization", {
        action:"request", eventId:token.context.eventId, expectedRunId:token.context.runId
      });
      if (!isCurrent(token)) return;
      // Approval can arrive from Live before the request acknowledgement.
      if (latest.row && latest.row.startAuthorization?.status !== "approved") {
        latest.row.startAuthorization = {status:result.data.status};
      }
    } catch (error) {
      if (isCurrent(token)) failure = error.message || "No se pudo enviar. Vuelve a intentarlo.";
    } finally {
      if (sending === token && isCurrent(token)) { sending = null; refresh(); }
    }
  }
  return {render, request};
};
