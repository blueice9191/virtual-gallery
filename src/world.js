import {addVaultedRoom,createVaultMaterials} from './vaults.js';
import { createStatue } from './statue.js';
import { galleryFont } from './brand.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { floors,rooms,walls,ring,upperVoid,guardRuns,polar,desk,FLOOR_HEIGHT } from './building.js';
import { paleOak } from './materials.js';
import { benchLayout,guardPosts } from './fixtures.js';

export function textMesh(text,width,height,size=60,ink='#353d36',background=null,font=null){
  const c=document.createElement('canvas');c.width=1024;c.height=Math.max(64,Math.round(1024*height/width));const ctx=c.getContext('2d');
  if(background){ctx.fillStyle=background;ctx.fillRect(0,0,c.width,c.height);}ctx.fillStyle=ink;ctx.font=font||`400 ${size}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';
  text.split('\n').forEach((line,i,lines)=>ctx.fillText(line,512,c.height/2+(i-(lines.length-1)/2)*size*1.4,980));
  const map=new THREE.CanvasTexture(c);map.colorSpace=THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map,transparent:!background,depthWrite:!!background,side:THREE.DoubleSide}));
}
export function buildWorld(scene,renderer,branding){
  const floorMeshes=[],occluders=[],groups=[],roomSigns=new Map();let root=scene;
  const oak=paleOak(renderer),white=new THREE.MeshStandardMaterial({color:'#f5f5ef',roughness:.9}),trim=new THREE.MeshStandardMaterial({color:'#daddd4',roughness:.8}),metal=new THREE.MeshStandardMaterial({color:'#838e85',roughness:.4,metalness:.35}),wood=new THREE.MeshStandardMaterial({color:'#9c8564',roughness:.7});
  function box(w,h,d,x,y,z,mat=white){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;m.userData.static=true;root.add(m);return m;}
  function polygon(points,y,mat=oak,hole=null,walk=true){
    const shape=new THREE.Shape();shape.moveTo(points[0].x,-points[0].z);points.slice(1).forEach(p=>shape.lineTo(p.x,-p.z));shape.closePath();
    if(hole){const p=new THREE.Path();p.moveTo(hole[0].x,-hole[0].z);hole.slice(1).forEach(q=>p.lineTo(q.x,-q.z));p.closePath();shape.holes.push(p);}
    const m=new THREE.Mesh(new THREE.ShapeGeometry(shape),mat);m.rotation.x=-Math.PI/2;m.position.y=y;m.receiveShadow=true;root.add(m);if(walk)floorMeshes.push(m);return m;
  }
  function wall(a,b,h,y,mat=white,depth=.22){const m=box(Math.hypot(b.x-a.x,b.z-a.z),h,depth,(a.x+b.x)/2,y,(a.z+b.z)/2,mat);m.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);return m;}
  function rail(a,b,r=.025){const va=new THREE.Vector3(a.x,a.y,a.z),vb=new THREE.Vector3(b.x,b.y,b.z),delta=vb.clone().sub(va);const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),6),metal);m.position.copy(va).add(vb).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());m.userData.static=true;root.add(m);return m;}
  const vaultMaterials=createVaultMaterials();
  for(const f of floors){
    root=new THREE.Group();root.position.y=f.base;scene.add(root);groups.push(root);
    polygon(ring,0,oak,f.floor?upperVoid:null);
    if(f.floor)polygon([{x:4.8,z:3.2},{x:13,z:3.2},{x:13,z:4.7},{x:4.8,z:4.7}],.005);
    for(const r of rooms.filter(r=>r.floor===f.floor)){
      polygon(r.polygon,0);addVaultedRoom(root,r,vaultMaterials);
      const bench=benchLayout(r),b=bench.center;const seat=box(bench.length,.16,bench.depth,b.x,.48,b.z,wood);seat.rotation.y=bench.rotation;
      for(const foot of bench.legs){const leg=box(.12,.4,.35,foot.x,.2,foot.z,metal);leg.rotation.y=bench.rotation;}
      const sign=textMesh(r.name,Math.min(3.7,f.panorama?5:3.7),.43,65),sp=polar(12.4,r.angle);sign.position.set(sp.x,3.55,sp.z);sign.rotation.y=Math.atan2(-sp.x,-sp.z);root.add(sign);roomSigns.set(r.id,sign);
    }
    for(const w of walls.filter(w=>w.floor===f.floor)){
      const lintel=w.kind==='lintel',feature=w.kind==='feature';
      const m=wall(w.a,w.b,feature?3.65:lintel?4.8-(w.doorClearance||3.2):4.8,feature?1.825:lintel?(4.8+(w.doorClearance||3.2))/2:2.4);if(!lintel)occluders.push(m);
      if(!lintel)wall(w.a,w.b,.1,.05,trim,.24);
    }
    // Close the storey gaps along the exterior; room ceilings sit below these bands.
    for(let i=0;i<f.count;i++){const a=-Math.PI+i*Math.PI*2/f.count,b=a+Math.PI*2/f.count;wall(polar(23,a),polar(23,b),1.2,5.4,white);}
    for(let i=0;i<12;i++){
      const a=polar(13,i*Math.PI/6),b=polar(13,(i+1)*Math.PI/6);wall(a,b,.18,5.5,white,.24);box(.23,5.5,.23,a.x,2.75,a.z);
    }
    if(f.floor)for(let i=0;i<upperVoid.length;i++)wall(upperVoid[i],upperVoid[(i+1)%upperVoid.length],.2,-.11,trim,.15);
  }
  root=scene;
  const brandGroup=new THREE.Group();scene.add(brandGroup);let brandTicket=0;
  async function updateBrand(settings){
    const ticket=++brandTicket;
    for(const child of [...brandGroup.children]){brandGroup.remove(child);child.geometry.dispose();child.material.map?.dispose();child.material.dispose();}
    const sign=textMesh(settings.name,3.7,.7,130,'#675a43',null,galleryFont);sign.position.set(-4,2.05,4.265);sign.rotation.y=Math.PI;brandGroup.add(sign);
    const subtitle=textMesh(settings.subtitle,3.8,.25,52,'#675a43');subtitle.position.set(-4,1.64,4.265);subtitle.rotation.y=Math.PI;brandGroup.add(subtitle);
    try{const map=await new THREE.TextureLoader().loadAsync(settings.logo);if(ticket!==brandTicket){map.dispose();return;}map.colorSpace=THREE.SRGBColorSpace;
      const aspect=map.image.width/map.image.height,w=Math.min(1.45,1.25*aspect),logo=new THREE.Mesh(new THREE.PlaneGeometry(w,w/aspect),new THREE.MeshBasicMaterial({map,transparent:true}));logo.position.set(-4,2.98,4.26);logo.rotation.y=Math.PI;brandGroup.add(logo);
    }catch{ /* Keep the readable gallery name if a configured logo is unavailable. */ }
  }
  updateBrand(branding);
  const plinth=new THREE.Mesh(new THREE.CylinderGeometry(2.1,2.1,.25,48),trim);plinth.position.y=.125;plinth.receiveShadow=true;scene.add(plinth);
  box(1.1,.8,1.1,0,.65,0);let sculpture;
  function updateStatue(seed){if(sculpture){scene.remove(sculpture);sculpture.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}sculpture=createStatue(seed);scene.add(sculpture);renderer.shadowMap.needsUpdate=true;}
  updateStatue(branding.statueSeed||0);
  // The shared switchback stair core: two flights and a midpoint landing per storey.
  for(let f=0;f<2;f++){
    const base=f*FLOOR_HEIGHT;
    for(let i=0;i<16;i++){
      const rise=(i+1)*3/16;
      const a=box(1.6,rise,.4,5.8,base+rise/2,3.2-(i+.5)*.4,oak);floorMeshes.push(a);
      const b=box(1.6,rise,.4,8.2,base+3+rise/2,-3.2+(i+.5)*.4,oak);floorMeshes.push(b);
    }
    const landing=box(4,.18,1,7,base+2.91,-3.7,oak);floorMeshes.push(landing);
  }
  for(const run of guardRuns){
    rail({...run.a,y:run.a.y+run.height},{...run.b,y:run.b.y+run.height});
    for(const post of guardPosts(run))rail(post,{...post,y:post.y+run.height},.018);
  }
  for(const f of floors){const sign=textMesh(f.floor===2?'Floor 3 · Panorama galleries':`Floor ${f.floor+1} · Twelve galleries`,3.4,.4,60);sign.position.set(10.5,f.base+2.1,4.72);sign.rotation.y=Math.PI;scene.add(sign);}
  // Desk behind the favorite display board; the reading surface stays clear.
  box(desk.width,.14,desk.depth,desk.x,.94,desk.z,wood);
  for(const x of [-5.8,-2.2])for(const z of [1.85,3.35])box(.12,.87,.12,x,.435,z,metal);
  const ds=textMesh('Art albums',2,.25,68);ds.position.set(-4,.64,1.535);ds.rotation.y=Math.PI;scene.add(ds);
  // Only the top floor has the glass roof. Lower levels look through the atrium void.
  for(let i=0;i<12;i++){const p=polar(12.6,i*Math.PI/6);const m=box(12.6,.07,.07,p.x/2,17.5,p.z/2,trim);m.rotation.y=-Math.atan2(p.z,p.x);}
  const glass=new THREE.Mesh(new THREE.CircleGeometry(12.5,12),new THREE.MeshBasicMaterial({color:'#dceefa',transparent:true,opacity:.045,side:THREE.DoubleSide,depthWrite:false}));glass.rotation.x=Math.PI/2;glass.position.y=17.48;scene.add(glass);
  scene.updateMatrixWorld(true);
  // Batch fixed structural pieces by material. Keep picking colliders separate and invisible.
  const buckets=new Map();scene.traverse(o=>{if(o.isMesh&&o.userData.static){const key=o.material.uuid;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(o);}});
  for(const meshes of buckets.values()){
    if(meshes.length<2)continue;
    const geometries=meshes.map(m=>{const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrixWorld);return g;});
    const merged=mergeGeometries(geometries);if(!merged)continue;
    const mesh=new THREE.Mesh(merged,meshes[0].material);mesh.castShadow=mesh.receiveShadow=true;scene.add(mesh);
    for(const m of meshes){const worldMatrix=m.matrixWorld.clone();m.parent.remove(m);if(occluders.includes(m)){worldMatrix.decompose(m.position,m.quaternion,m.scale);m.visible=false;scene.add(m);}else if(!floorMeshes.includes(m))m.geometry.dispose();}geometries.forEach(g=>g.dispose());
  }
  return {floorMeshes,occluders,groups,updateBrand,updateStatue,updateRoomLabels(){for(const r of rooms){const sign=roomSigns.get(r.id),replacement=textMesh(r.name,3.7,.43,65);sign.material.map.dispose();sign.material.dispose();sign.material=replacement.material;replacement.geometry.dispose();}}};
}
