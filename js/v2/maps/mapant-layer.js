/* Trailmap publica Mapant en una cuadrícula Mercator de 256 px.
   Su nivel TMS 0 tiene dos teselas por eje: equivale al zoom 1 de Leaflet. */
(() => {
  const endpoint = 'https://raster.trailmap.fi/mapproxy';
  const extent = 20037508.342789244;
  const nativeZoom = 19;

  function wmsUrl({x, y, z}) {
    const span = 2 * extent / 2 ** z;
    const bbox = [-extent + x * span, extent - (y + 1) * span,
      -extent + (x + 1) * span, extent - y * span];
    const query = new URLSearchParams({
      SERVICE:'WMS', REQUEST:'GetMap', VERSION:'1.1.1', LAYERS:'spain_mapant',
      STYLES:'', FORMAT:'image/png', SRS:'EPSG:3857', WIDTH:'256', HEIGHT:'256',
      BBOX:bbox.join(',')
    });
    return endpoint + '/service?' + query;
  }

  function create(L, options = {}) {
    const maxZoom = Math.min(nativeZoom, Number(options.maxZoom) || nativeZoom);
    const Mapant = L.TileLayer.extend({
      onAdd(map) {
        this.previousMaxZoom = map.options.maxZoom;
        L.TileLayer.prototype.onAdd.call(this, map);
        map.setMaxZoom(Math.min(maxZoom, this.previousMaxZoom ?? maxZoom));
      },
      onRemove(map) {
        L.TileLayer.prototype.onRemove.call(this, map);
        map.setMaxZoom(this.previousMaxZoom);
      },
      createTile(coords, done) {
        const image = document.createElement('img');
        image.alt = '';
        image.decoding = 'async';
        const {x, y, z} = coords;
        const base = endpoint + '/tms/1.0.0/spain_mapant/GLOBAL_WEBMERCATOR';
        const sources = z === 0 ? [wmsUrl(coords)] :
          [`${base}/${z - 1}/${x}/${2 ** z - 1 - y}.png`, wmsUrl(coords)];
        let timer;
        function complete(error) {
          clearTimeout(timer);
          image.onload = image.onerror = null;
          done(error, image);
        }
        function load(index) {
          clearTimeout(timer);
          if (index >= sources.length) {
            complete(new Error('Mapant: tesela no disponible'));
            return;
          }
          image.onload = () => complete(null);
          image.onerror = () => load(index + 1);
          timer = setTimeout(() => load(index + 1), 8000);
          image.src = sources[index];
        }
        load(0);
        return image;
      }
    });
    return new Mapant('', {
      attribution:'© MapAnt / Trailmap', minZoom:0, maxZoom, tileSize:256,
      keepBuffer:4, updateWhenIdle:false, updateWhenZooming:false
    });
  }

  globalThis.MILITOPO_MAPANT = Object.freeze({create});
})();
