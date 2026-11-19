/* Color estable por corredor, compartido entre Live y el reproductor. */
(() => {
  const palette=["#4ea3ff","#ff7a59","#7fd35b","#d46cff","#f2c14e","#2fd0c8","#ff5e9b","#8b9cff","#ff9d3d","#5edb8a","#e66b6b","#4dc7f2"];
  function color(uid){let hash=2166136261;for(const ch of String(uid||"")){hash^=ch.charCodeAt(0);hash=Math.imul(hash,16777619);}return palette[(hash>>>0)%palette.length];}
  function arrow(fill){return `<svg viewBox="0 0 36 36" aria-hidden="true" style="display:block;width:34px;height:34px;fill:${fill};stroke:none"><path d="M18 2.5 31 30.5 18 25.5 5 30.5Z"/></svg>`;}
  globalThis.MILITOPO_RUNNER_MARKER=Object.freeze({color,arrow});
})();
