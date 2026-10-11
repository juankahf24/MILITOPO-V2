/* MILITOPO Premium · P0A · puente estable hacia la aplicación existente.
   Toda función Premium nueva debe hablar con este puente en vez de acoplarse
   directamente a la implementación legacy. */
(function(global){
  "use strict";
  var premium = global.MILITOPO_PREMIUM;
  if (!premium || premium.has("legacy-bridge")) return;

  function fn(name){ return typeof global[name] === "function" ? global[name] : null; }
  function exists(name){ return typeof global[name] !== "undefined" && global[name] !== null; }
  function invoke(name, args){
    var target = fn(name);
    if (!target) return false;
    target.apply(global, Array.isArray(args) ? args : []);
    return true;
  }

  var bridge = {
    navigation: Object.freeze({
      goStep: function(step){ return invoke("goStep", [step]); },
      hasGoStep: function(){ return !!fn("goStep"); }
    }),
    event: Object.freeze({
      create: function(){ return invoke("createNewRace", []); },
      saveRules: function(){ return invoke("confirmStep1", []); },
      hasCreate: function(){ return !!fn("createNewRace"); }
    }),
    map: Object.freeze({
      layer: function(name){ return invoke("switchLayer", [name]); },
      fitAll: function(){ return invoke("fitAllPoints", []); },
      hasMap: function(){ return !!fn("switchLayer"); }
    }),
    organizer: Object.freeze({
      manager: function(){ return global.MILITOPO_R3_ORGANIZER_MANAGER || null; },
      center: function(){ return global.MILITOPO_V2_ORGANIZER_CENTER || null; }
    }),
    admin: Object.freeze({
      open: function(){
        var admin = global.MILITOPO_R8_SUPER_ADMIN;
        return admin && typeof admin.open === "function" ? admin.open() : false;
      },
      available: function(){
        var admin = global.MILITOPO_R8_SUPER_ADMIN;
        return !!(admin && typeof admin.open === "function");
      }
    }),
    auth: Object.freeze({
      current: function(){ return global.MILITOPO_V2_AUTH || null; },
      role: function(){ return String((global.MILITOPO_V2_AUTH || {}).role || "").toLowerCase(); }
    }),
    toast: function(message){
      if (typeof global.toast === "function") { global.toast(message); return true; }
      return false;
    },
    health: function(){
      return Object.freeze({
        goStep: !!fn("goStep"),
        createNewRace: !!fn("createNewRace"),
        switchLayer: !!fn("switchLayer"),
        organizerManager: exists("MILITOPO_R3_ORGANIZER_MANAGER"),
        organizerCenter: exists("MILITOPO_V2_ORGANIZER_CENTER"),
        superAdmin: !!(global.MILITOPO_R8_SUPER_ADMIN && typeof global.MILITOPO_R8_SUPER_ADMIN.open === "function"),
        auth: exists("MILITOPO_V2_AUTH")
      });
    }
  };

  premium.register("legacy-bridge", Object.freeze(bridge), {
    version: "p0a",
    purpose: "isolation"
  });

  function finish(){
    try { document.documentElement.dataset.militopoPremium = "p0a"; } catch (_) {}
    premium.markReady();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", finish, { once: true });
  else finish();
})(window);
