/* MILITOPO Premium · P2B · puente estable hacia la aplicación existente. */
(function(global){
  "use strict";
  var premium = global.MILITOPO_PREMIUM;
  if (!premium || premium.has("legacy-bridge")) return;

  function fn(name){ return typeof global[name] === "function" ? global[name] : null; }
  function shell(){ return global.MILITOPO_R1_SHELL || null; }
  function invoke(name, args){
    var target = fn(name);
    if (!target) return false;
    return target.apply(global, Array.isArray(args) ? args : []);
  }
  function shellCall(name, args, fallback){
    try {
      var api=shell(), target=api && api[name];
      if(typeof target!=="function") return fallback;
      return target.apply(api, Array.isArray(args)?args:[]);
    } catch(error){ console.error("[MILITOPO Premium bridge]",name,error); return fallback; }
  }

  var bridge = {
    shell: Object.freeze({
      current: function(){ return shellCall("current",[],Object.freeze({})); },
      homeMap: function(){ return shellCall("homeMap",[],false); },
      races: function(){ return shellCall("races",[],false); },
      manager: function(event){ return shellCall("manager",[event||{}],false); },
      participants: function(){ return shellCall("participants",[],false); },
      live: function(){ return shellCall("live",[],false); },
      results: function(){ return shellCall("results",[],false); },
      analysis: function(){ return shellCall("analysis",[],false); },
      history: function(){ return shellCall("history",[],false); },
      profile: function(){ return shellCall("profile",[],false); },
      admin: function(){ return shellCall("admin",[],false); }
    }),
    navigation: Object.freeze({
      goStep: function(step){ return invoke("goStep", [step]); },
      hasGoStep: function(){ return !!fn("goStep"); }
    }),
    event: Object.freeze({
      create: function(){ return shellCall("newRace",[],false); },
      createLegacy: function(){ return shellCall("newRaceLegacy",[],false); },
      createDraftDirect: function(){ return invoke("createNewRace", []); },
      saveRules: function(){ return invoke("confirmStep1", []); },
      hasCreate: function(){ return !!shell()?.newRace || !!fn("createNewRace"); }
    }),
    map: Object.freeze({
      home: function(){ return shellCall("homeMap",[],false); },
      layer: function(name){ return invoke("switchLayer", [name]); },
      fitAll: function(){ return invoke("fitAllPoints", []); },
      hasMap: function(){ return !!fn("switchLayer"); }
    }),
    organizer: Object.freeze({
      manager: function(){ return global.MILITOPO_R3_ORGANIZER_MANAGER || null; },
      center: function(){ return global.MILITOPO_V2_ORGANIZER_CENTER || null; }
    }),
    admin: Object.freeze({
      open: function(){ return shellCall("admin",[],false); },
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
      var s=shell();
      return Object.freeze({
        shell: !!s,
        newRace: !!s?.newRace,
        goStep: !!fn("goStep"),
        switchLayer: !!fn("switchLayer"),
        organizerManager: !!global.MILITOPO_R3_ORGANIZER_MANAGER,
        organizerCenter: !!global.MILITOPO_V2_ORGANIZER_CENTER,
        superAdmin: !!(global.MILITOPO_R8_SUPER_ADMIN && typeof global.MILITOPO_R8_SUPER_ADMIN.open === "function"),
        auth: !!global.MILITOPO_V2_AUTH
      });
    }
  };

  premium.register("legacy-bridge", Object.freeze(bridge), { version: "p2b", purpose: "isolation" });

  function finish(){
    try { document.documentElement.dataset.militopoPremium = "p1-home"; } catch (_) {}
    premium.markReady();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", finish, { once: true });
  else finish();
})(window);
