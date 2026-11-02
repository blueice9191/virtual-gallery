import { createSpreadCache } from './preload.js';
import * as THREE from 'three';
import { AlbumState } from './album-state.js';
import { textMesh } from './world.js';
import { bookLayout } from './fixtures.js';
import { desk } from './building.js';
export function createBooks(scene,albums,photos,getTexture,hooks,reduced,bounded=false){
  const layout=bookLayout(desk,albums.length),spreads=createSpreadCache(photos,getTexture,bounded);
  const reader=new AlbumState(),closed=new Map(),pickables=[],openGroup=new THREE.Group();openGroup.position.set(layout.open.x,1.035,layout.open.z);scene.add(openGroup);openGroup.visible=false;
  const cream=new THREE.MeshStandardMaterial({color:'#eee8d8',roughness:.95}),coverMats=['#40594b','#456373','#846649'].map(color=>new THREE.MeshStandardMaterial({color,roughness:.8}));
  function box(w,h,d,x,y,z,mat,parent){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);parent.add(m);return m;}
  albums.forEach((album,i)=>{
    const group=new THREE.Group();group.position.set(layout.standing[i].x,1.04,layout.standing[i].z);scene.add(group);closed.set(album.id,group);
    const width=layout.standing[i].width;
    const cover=coverMats[i%coverMats.length];box(width,.88,.64,0,.44,0,cover,group);box(width*.76,.79,.55,0,.44,-.005,cream,group);
    const spine=box(width-.01,.88,.045,0,.44,-.325,cover,group);spine.userData.album=album;pickables.push(spine);
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=1024;const ctx=canvas.getContext('2d');ctx.translate(128,512);ctx.rotate(-Math.PI/2);ctx.fillStyle='#fff8e9';ctx.font='58px Georgia';ctx.textAlign='center';ctx.fillText(album.name,0,18,910);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const label=new THREE.Mesh(new THREE.PlaneGeometry(width*.82,.8),new THREE.MeshBasicMaterial({map:texture,transparent:true}));label.position.set(0,.44,-.351);label.rotation.y=Math.PI;label.userData.album=album;group.add(label);pickables.push(label);
  });
  box(2.65,.055,1.65,0,0,0,coverMats[0],openGroup);box(2.5,.05,1.54,0,.05,0,cream,openGroup);box(.045,.065,1.57,0,.09,0,coverMats[0],openGroup);
  const pages=[],turnTargets=[];
  for(let side=0;side<2;side++){
    const page=new THREE.Mesh(new THREE.PlaneGeometry(1.16,1.4),new THREE.MeshBasicMaterial({color:'#f8f5ed',side:THREE.DoubleSide}));page.rotation.set(-Math.PI/2,0,Math.PI);page.position.set(side?-.64:.64,.09,0);openGroup.add(page);pages.push(page);
    const target=new THREE.Mesh(new THREE.PlaneGeometry(1.25,1.54),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));target.rotation.x=-Math.PI/2;target.position.set(side?-.64:.64,.1,0);target.userData.turnPage=side?1:-1;openGroup.add(target);turnTargets.push(target);
  }
  const flipPivot=new THREE.Group();flipPivot.name='Turning page';flipPivot.position.y=.12;openGroup.add(flipPivot);
  const sheet=new THREE.Mesh(new THREE.PlaneGeometry(1.25,1.54),new THREE.MeshBasicMaterial({color:'#f8f5ed',side:THREE.DoubleSide}));sheet.rotation.x=-Math.PI/2;sheet.position.x=-.64;flipPivot.add(sheet);
  const turningImages=[false,true].map(back=>{const image=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({side:THREE.FrontSide}));image.name=back?'Turning back image':'Turning front image';image.rotation.set(back?Math.PI/2:-Math.PI/2,0,back?0:Math.PI);image.position.set(-.64,back?-.003:.003,0);flipPivot.add(image);return image;});
  flipPivot.visible=false;
  let animation=null,request=0,preparing=false;
  function paintImage(page,{photo,map}){
    page.userData.photo=photo;page.userData.albumPhoto=true;
    const aspect=photo?photo.width/photo.height:1,w=photo?Math.min(1.07,1.25*aspect):1.16,h=photo?w/aspect:1.4;
    page.geometry.dispose();page.geometry=new THREE.PlaneGeometry(w,h);page.material.map=map;page.material.color.set(photo?'#ffffff':'#f8f5ed');page.material.needsUpdate=true;
  }
  function paint(prepared){prepared.forEach((data,i)=>paintImage(pages[i],data));hooks.changed(reader);}
  async function open(album){
    if(reader.album||animation||preparing)return;preparing=true;const ticket=++request;hooks.loading?.('Preparing album…');
    try{const prepared=await spreads.prepare(album,0);if(ticket!==request)return;reader.open(album);closed.get(album.id).visible=false;openGroup.visible=true;openGroup.scale.setScalar(reduced?1:.02);animation=reduced?null:{kind:'open',t:0};hooks.opened(album,layout.open);paint(prepared);spreads.warm(album,0);}catch{hooks.loading?.('The album could not load. Please try again.');}finally{preparing=false;}
  }
  function close(){
    if(!reader.album)return;const id=reader.album.id;reader.close();request++;preparing=false;flipPivot.visible=false;flipPivot.rotation.z=0;animation={kind:'close',t:reduced?1:0,id};hooks.changed(reader);
  }
  async function turn(direction){
    if(!reader.album||animation||preparing)return;
    if(direction>0&&reader.last){close();return;}
    if(direction<0&&reader.spread===0)return;
    const album=reader.album,target=reader.spread+(direction>0?1:-1),ticket=++request;preparing=true;
    try{const prepared=await spreads.prepare(album,target);if(ticket!==request||reader.album!==album)return;
      if(reduced){direction>0?reader.next():reader.previous();paint(prepared);spreads.warm(album,target);return;}
      // Reveal the next underlying page before the sheet starts moving.
      // The outgoing print and the incoming reverse print keep their fitted sizes.
      const outgoing=pages[direction>0?1:0];
      const old={photo:outgoing.userData.photo,map:outgoing.material.map};
      paintImage(turningImages[0],direction>0?old:prepared[1]);
      paintImage(turningImages[1],direction>0?prepared[0]:old);
      paintImage(pages[direction>0?1:0],prepared[direction>0?1:0]);
      flipPivot.rotation.z=direction>0?0:-Math.PI;flipPivot.visible=true;animation={kind:'flip',t:0,direction,prepared,target,album};
    }catch{hooks.loading?.('These pages could not load. Please try again.');}finally{preparing=false;}
  }
  function update(dt){
    if(!animation)return;const a=animation;a.t=Math.min(1,a.t+dt/(a.kind==='flip'?.65:.5));const ease=a.t*a.t*(3-2*a.t);
    if(a.kind==='open')openGroup.scale.setScalar(Math.max(.02,ease));
    if(a.kind==='close')openGroup.scale.setScalar(Math.max(.02,1-ease));
    if(a.kind==='flip')flipPivot.rotation.z=(a.direction>0?ease:1-ease)*-Math.PI;
    if(a.t===1){animation=null;if(a.kind==='flip'){a.direction>0?reader.next():reader.previous();paint(a.prepared);flipPivot.visible=false;turningImages.forEach(p=>p.material.map=null);spreads.warm(a.album,a.target);}if(a.kind==='close'){if(bounded){pages.forEach(p=>p.material.map=null);turningImages.forEach(p=>p.material.map=null);spreads.clear();}openGroup.visible=false;closed.get(a.id).visible=true;hooks.closed();}}
  }
  function dispose(){spreads.clear();request++;preparing=false;animation=null;reader.close();for(const group of [...closed.values(),openGroup]){scene.remove(group);group.traverse(mesh=>{mesh.geometry?.dispose();if(mesh.material){if(!pages.includes(mesh)&&!turningImages.includes(mesh))mesh.material.map?.dispose();mesh.material.dispose();}});}}
  return {reader,open,close,turn,update,dispose,pickables:[...pickables,...turnTargets],get busy(){return !!animation||preparing;}};
}
