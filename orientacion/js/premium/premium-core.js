/* MILITOPO Premium · P0A
   Capa de aislamiento para nuevas funciones Premium.
   No sustituye lógica legacy: evita que las nuevas pantallas dependan directamente
   de decenas de globals y permite migrar módulos de forma gradual y comprobable. */
(function(global){
  "use strict";
  if (global.MILITOPO_PREMIUM && global.MILITOPO_PREMIUM.version) return;

  var modules = Object.create(null);
  var listeners = Object.create(null);
  var readyWaiters = [];
  var ready = false;

  function cleanName(value){ return String(value || "").trim(); }
  function now(){ return Date.now(); }

  function emit(type, detail){
    var name = cleanName(type);
    if (!name) return;
    var list = (listeners[name] || []).slice();
    for (var i = 0; i < list.length; i++) {
      try { list[i](detail); } catch (error) { console.error("[MILITOPO Premium event]", name, error); }
    }
    try { global.dispatchEvent(new CustomEvent("militopo:premium:" + name, { detail: detail })); } catch (_) {}
  }

  function on(type, handler){
    var name = cleanName(type);
    if (!name || typeof handler !== "function") return function(){};
    (listeners[name] || (listeners[name] = [])).push(handler);
    return function(){
      var list = listeners[name] || [];
      var idx = list.indexOf(handler);
      if (idx >= 0) list.splice(idx, 1);
    };
  }

  function register(name, api, meta){
    name = cleanName(name);
    if (!name) throw new Error("Nombre de módulo Premium vacío.");
    if (modules[name]) return modules[name].api;
    var record = {
      name: name,
      api: api || Object.create(null),
      meta: Object.assign({ version: "1", source: "premium" }, meta || {}),
      registeredAt: now()
    };
    modules[name] = record;
    emit("module-registered", { name: name, meta: record.meta });
    return record.api;
  }

  function has(name){ return !!modules[cleanName(name)]; }
  function get(name){ return modules[cleanName(name)] ? modules[cleanName(name)].api : null; }
  function requireModule(name){
    var api = get(name);
    if (!api) throw new Error("Módulo Premium no disponible: " + cleanName(name));
    return api;
  }

  function safeCall(target, method, args, fallback){
    try {
      var fn = target && target[method];
      if (typeof fn !== "function") return fallback;
      return fn.apply(target, Array.isArray(args) ? args : []);
    } catch (error) {
      console.error("[MILITOPO Premium call]", method, error);
      return fallback;
    }
  }

  function markReady(){
    if (ready) return;
    ready = true;
    var queue = readyWaiters.splice(0);
    for (var i = 0; i < queue.length; i++) {
      try { queue[i](api); } catch (error) { console.error("[MILITOPO Premium ready]", error); }
    }
    emit("ready", health());
  }

  function whenReady(handler){
    if (typeof handler !== "function") return;
    if (ready) { handler(api); return; }
    readyWaiters.push(handler);
  }

  function health(){
    var names = Object.keys(modules);
    var capability = get("legacy-bridge");
    var legacy = capability && typeof capability.health === "function" ? capability.health() : {};
    return Object.freeze({
      version: api.version,
      build: api.build,
      ready: ready,
      modules: names.slice().sort(),
      legacy: legacy
    });
  }

  var api = Object.freeze({
    version: "premium-p0a",
    build: "2026-10-11",
    register: register,
    has: has,
    get: get,
    require: requireModule,
    call: safeCall,
    emit: emit,
    on: on,
    markReady: markReady,
    whenReady: whenReady,
    health: health
  });

  global.MILITOPO_PREMIUM = api;
})(window);
