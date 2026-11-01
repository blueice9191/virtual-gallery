import * as THREE from 'three';
import { atmosphereAt, localHour } from './atmosphere.js';

export function paleOak(renderer) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  let seed = 721; const random = () => {seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let row=0;row<16;row++) {
    const y=row*64, tone=Math.floor(random()*12);
    ctx.fillStyle=`rgb(${199+tone},${175+tone},${137+tone})`;ctx.fillRect(0,y,1024,64);
    for(let g=0;g<105;g++) {
      const gy=y+random()*64;ctx.strokeStyle=`rgba(99,70,35,${.025+random()*.075})`;ctx.lineWidth=.3+random()*.7;ctx.beginPath();ctx.moveTo(0,gy);
      for(let x=0;x<=1024;x+=32)ctx.lineTo(x,gy+Math.sin(x*.011+row+g)*(.4+random()*1.8));ctx.stroke();
    }
    ctx.fillStyle='rgba(90,67,39,.18)';ctx.fillRect(0,y,1024,1.3);
    const seam=(row%3)*170;for(let x=seam;x<1024;x+=512)ctx.fillRect(x,y,1.5,64);
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(.23,.23);map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
  return new THREE.MeshStandardMaterial({map,roughness:.72,color:'#ffffff'});
}

export function makeSky(scene, reduced) {
  const uniforms={zenith:{value:new THREE.Color()},horizon:{value:new THREE.Color()},cloudColor:{value:new THREE.Color()},sunColor:{value:new THREE.Color()},sunDirection:{value:new THREE.Vector3()},daylight:{value:1},drift:{value:0}};
  const mat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms,
    vertexShader:`varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`precision highp float;
      varying vec3 vDirection;uniform vec3 zenith,horizon,cloudColor,sunColor,sunDirection;uniform float daylight,drift;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
      float fbm(vec2 p){return .53*noise(p)+.27*noise(p*2.03)+.13*noise(p*4.07)+.07*noise(p*8.13);}
      void main(){vec3 d=normalize(vDirection);float height=max(0.,d.y);vec3 c=mix(horizon,zenith,smoothstep(0.,.85,height));
      vec2 uv=vec2(atan(d.z,d.x)/6.2831853+.5,asin(clamp(d.y,-1.,1.))/3.1415926+.5);
      vec2 cp=d.xz/(.3+max(.02,d.y))*2.4+vec2(drift,drift*.25);float clouds=smoothstep(.48,.72,fbm(cp))*smoothstep(.0,.18,height);
      vec2 starGrid=uv*vec2(500.,260.);vec2 cell=floor(starGrid);float star=step(.986,hash(cell))*pow(max(0.,1.-length(fract(starGrid)-.5)*2.),7.);c+=vec3(star)*(1.-daylight)*smoothstep(0.,.2,height)*(1.-clouds*.7)*2.;
      c=mix(c,cloudColor,clouds*(.08+.75*daylight));float sunDot=dot(d,normalize(sunDirection));c+=sunColor*pow(max(0.,sunDot),55.)*.16*daylight;c=mix(c,sunColor,smoothstep(.9991,.9996,sunDot)*daylight);
      float moonDot=dot(d,-normalize(sunDirection));c=mix(c,vec3(.84,.9,1.),smoothstep(.99945,.9997,moonDot)*(1.-daylight));
      gl_FragColor=vec4(c,1.);#include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`.replace('vec4(c,1.);#include','vec4(c,1.);\n#include')});
  const dome=new THREE.Mesh(new THREE.SphereGeometry(85,48,24),mat);dome.renderOrder=-100;dome.frustumCulled=false;scene.add(dome);
  let lastUpdate=-Infinity, previewHour=null;
  return { setPreview(hour){previewHour=hour;lastUpdate=-Infinity;}, update(time,hemi,sun){
    uniforms.drift.value=reduced?0:time*.000008;
    if(time-lastUpdate<30000)return;lastUpdate=time;
    const state=atmosphereAt(previewHour ?? localHour());
    const color=key=>new THREE.Color(state.a[key]).lerp(new THREE.Color(state.b[key]),state.t);
    uniforms.zenith.value.copy(color('top'));uniforms.horizon.value.copy(color('horizon'));uniforms.cloudColor.value.copy(color('cloud'));uniforms.sunColor.value.copy(color('sun'));uniforms.daylight.value=state.daylight;
    const angle=(state.hour-6)/24*Math.PI*2;uniforms.sunDirection.value.set(Math.cos(angle),Math.sin(angle),-.3).normalize();
    hemi.color.copy(color('horizon'));hemi.intensity=.85+state.daylight*1.65;
    sun.color.copy(color('sun'));sun.intensity=.08+state.daylight*2.22;sun.position.copy(uniforms.sunDirection.value).multiplyScalar(28);sun.position.y=Math.max(5,sun.position.y);
    return state.label;
  }};
}
