/* Mapant: solicitudes acotadas, reutilización y recuperación de teselas. */
(() => {
  function create(L,options={}) {
    const cache=new Map(),extent=20037508.342789244,native=18;
    function image(z,x,y){
      const n=2**z,span=2*extent/n,wx=((x%n)+n)%n;
      const key=`${z}/${wx}/${y}`;
      if(cache.has(key))return cache.get(key);
      const bbox=[-extent+wx*span,extent-(y+1)*span,-extent+(wx+1)*span,extent-y*span];
      const url='https://raster.trailmap.fi/mapproxy/service?'+new URLSearchParams({SERVICE:'WMS',REQUEST:'GetMap',VERSION:'1.1.1',LAYERS:'spain_mapant',STYLES:'',FORMAT:'image/png',SRS:'EPSG:3857',WIDTH:'256',HEIGHT:'256',BBOX:bbox.join(',')});
      const load=()=>new Promise((resolve,reject)=>{const img=new Image();img.crossOrigin='anonymous';img.decoding='async';const timer=setTimeout(()=>finish(new Error('Mapant: tiempo de respuesta agotado')),10000);let ended=false;
        function finish(error){if(ended)return;ended=true;clearTimeout(timer);img.onload=img.onerror=null;error?reject(error):resolve(img);}
        img.onload=()=>finish();img.onerror=()=>finish(new Error('Mapant: no se pudo cargar la tesela'));img.src=url;});
      const pending=load().catch(()=>load());cache.set(key,pending);
      pending.catch(()=>{if(cache.get(key)===pending)cache.delete(key);});
      if(cache.size>128)cache.delete(cache.keys().next().value);
      return pending;
    }
    const Stable=L.GridLayer.extend({
      createTile(coords,done){
        const canvas=document.createElement('canvas'),size=this.getTileSize();canvas.width=size.x;canvas.height=size.y;
        const ctx=canvas.getContext('2d');
        const top=Math.min(coords.z,native),bottom=Math.max(0,top-3);
        const draw=async z=>{const scale=2**(coords.z-z),px=Math.floor(coords.x/scale),py=Math.floor(coords.y/scale),n=2**z;
          if(py<0||py>=n){done(null,canvas);return;}
          try{const img=await image(z,px,py),ox=((coords.x%scale)+scale)%scale,oy=((coords.y%scale)+scale)%scale;
            ctx.imageSmoothingEnabled=true;ctx.drawImage(img,ox*256/scale,oy*256/scale,256/scale,256/scale,0,0,size.x,size.y);done(null,canvas);
          }catch(error){if(z>bottom)return draw(z-1);done(error,canvas);}
        };
        void draw(top);return canvas;
      }
    });
    return new Stable({attribution:'© MapAnt / Trailmap',minZoom:0,maxZoom:Number(options.maxZoom||25),tileSize:256,keepBuffer:6,updateWhenIdle:true,updateWhenZooming:false});
  }
  globalThis.MILITOPO_MAPANT=Object.freeze({create});
})();
