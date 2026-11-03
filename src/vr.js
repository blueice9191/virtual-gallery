import * as THREE from 'three';
import { textMesh } from './world.js';
import { artworkTitle } from './artwork-title.js';
import { teleportLanding,floorLanding,fittedArtwork } from './vr-policy.js';

// The headset owns camera pose. Only the rig moves for virtual navigation.
export function createVR({scene,renderer,camera,button,xr=globalThis.navigator?.xr,hooks,makeText=textMesh}){
  const rig=new THREE.Group();rig.name='VR player rig';scene.add(rig);rig.add(camera);
  const menu=new THREE.Group(),viewer=new THREE.Group();menu.name='VR menu';viewer.name='VR artwork viewer';scene.add(menu,viewer);menu.visible=viewer.visible=false;
  const panelTargets=[],viewerTargets=[],controllers=[],ray=new THREE.Raycaster(),head=new THREE.Vector3(),forward=new THREE.Vector3(),rotation=new THREE.Matrix4();
  const marker=new THREE.Mesh(new THREE.RingGeometry(.16,.23,32),new THREE.MeshBasicMaterial({color:'#4baf9c',side:THREE.DoubleSide}));marker.rotation.x=-Math.PI/2;marker.visible=false;scene.add(marker);
  const curtain=new THREE.Mesh(new THREE.PlaneGeometry(10,10),new THREE.MeshBasicMaterial({color:'#000',transparent:true,opacity:0,depthTest:false,depthWrite:false}));curtain.position.z=-.15;curtain.renderOrder=10000;camera.add(curtain);
  let generation=0,groundY=0,lookPitch=0;
  let active=false,starting=false,busy=false,saved=null,photoTicket=0,menuPending=false,photoTexture=null;
  const text=(label,w,h)=>makeText(label,w,h,60,'#263b32','#f8f9f6');
  const transitionLabel=text('Preparing gallery…',.18,.025);transitionLabel.position.z=-.14;transitionLabel.material.depthTest=false;transitionLabel.material.depthWrite=false;transitionLabel.renderOrder=10001;transitionLabel.visible=false;camera.add(transitionLabel);
  const hint=text('Left stick: move · Right stick: look\nTrigger: teleport / art · Squeeze: menu',1.8,.23);hint.position.y=.28;menu.add(hint);
  function control(label,x,y,action){const mesh=text(label,.52,.17);mesh.position.set(x,y,0);mesh.userData.vrAction=action;menu.add(mesh);panelTargets.push(mesh);return mesh;}
  for(let floor=0;floor<3;floor++)control(`Floor ${floor+1}`,(floor-1)*.59,0,()=>teleport(floorLanding(floor)));
  control('Close artwork',-.59,-.23,()=>closeArtwork());control('Exit VR',.59,-.23,()=>exit());
  const close=text('Close artwork',.65,.16);close.position.set(0,-1.02,.025);close.userData.vrAction=()=>closeArtwork();viewer.add(close);viewerTargets.push(close);
  const backing=new THREE.Mesh(new THREE.PlaneGeometry(2.15,2.3),new THREE.MeshBasicMaterial({color:'#f8f9f6',side:THREE.DoubleSide}));backing.position.z=-.01;viewer.add(backing);
  const loading=text('Loading artwork…',1.4,.18);viewer.add(loading);
  const title=text('',1.9,.16);title.position.set(0,.98,.02);viewer.add(title);
  const image=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({color:'#fff',side:THREE.DoubleSide}));image.position.z=.02;image.visible=false;viewer.add(image);
  // World-locked UI remains legible even when opened near a gallery wall.
  for(const child of menu.children){child.material.depthTest=false;child.material.depthWrite=false;child.renderOrder=8000;}
  for(const child of viewer.children){child.material.depthTest=false;child.material.depthWrite=false;child.renderOrder=child===backing?9000:child===image?9001:9002;}
  // The XR ArrayCamera is not parented to the rig. Its getWorldPosition()
  // recomputes matrixWorld without the rig offset; use the parented camera.
  function headPosition(){camera.getWorldPosition(head);return head.clone();}
  function place(group,distance,vertical=0){
    const position=headPosition();camera.getWorldDirection(forward);forward.y=0;if(forward.lengthSq()<.001)forward.set(0,0,-1);forward.normalize();
    group.position.copy(position).addScaledVector(forward,distance);group.position.y+=vertical;group.lookAt(position.x,group.position.y,position.z);group.updateMatrixWorld(true);
  }
  function disposeMap(texture){texture?.dispose();}
  function closeArtwork(){photoTicket++;viewer.visible=false;image.visible=false;image.material.map=null;disposeMap(photoTexture);photoTexture=null;if(active){menu.visible=true;menuPending=true;}}
  async function openArtwork(photo){
    closeArtwork();const ticket=photoTicket;viewer.visible=true;loading.visible=true;place(viewer,2.3);menu.visible=false;
    const caption=artworkTitle(photo),replacement=text(caption,1.9,.16);title.material.map?.dispose();title.material.dispose();title.material=replacement.material;replacement.geometry.dispose();title.visible=!!caption;
    try{
      const texture=await hooks.loadArtwork(photo);
      if(!active||ticket!==photoTicket){disposeMap(texture);return;}
      photoTexture=texture;const size=fittedArtwork(photo);image.geometry.dispose();image.geometry=new THREE.PlaneGeometry(size.width,size.height);image.material.map=texture;image.material.needsUpdate=true;image.visible=true;loading.visible=false;
    }catch{if(ticket===photoTicket){loading.visible=true;const replacement=text('Could not load. Close and try again.',1.8,.18);loading.material.map?.dispose();loading.material.dispose();loading.material=replacement.material;replacement.geometry.dispose();}}
  }
  async function teleport(point){
    if(!active||busy)return;
    const landing=teleportLanding(point,hooks.canStand);if(!landing)return;
    const requestGeneration=generation;busy=true;transitionLabel.visible=true;curtain.material.opacity=1;marker.visible=false;closeArtwork();menu.visible=false;
    try{
      await hooks.prepareLanding?.(landing);
      if(!active||generation!==requestGeneration)return;
      const current=headPosition();rig.position.x+=landing.x-current.x;rig.position.z+=landing.z-current.z;rig.position.y+=landing.y-groundY;groundY=landing.y;rig.updateMatrixWorld(true);renderer.xr.updateCamera(camera);menu.visible=true;menuPending=true;
    }catch{if(generation===requestGeneration){hooks.error('The destination could not be prepared. Please try again.');menu.visible=true;menuPending=true;}}
    finally{if(generation===requestGeneration){busy=false;transitionLabel.visible=false;}}
  }
  function visible(mesh){for(let p=mesh;p;p=p.parent)if(!p.visible)return false;return true;}
  function point(controller){
    controller.updateWorldMatrix(true,false);rotation.extractRotation(controller.matrixWorld);ray.ray.origin.setFromMatrixPosition(controller.matrixWorld);ray.ray.direction.set(0,0,-1).applyMatrix4(rotation);ray.far=40;
    const controls=viewer.visible?viewerTargets:panelTargets.filter(visible);
    const control=ray.intersectObjects(controls,false)[0];if(control)return control;
    const objects=viewer.visible?[backing]:[...hooks.artworks().filter(visible),...hooks.floors(),...hooks.occluders()];
    return ray.intersectObjects(objects,false)[0]||null;
  }
  function select(controller){
    if(!active||busy)return;const hit=point(controller);if(!hit)return;
    if(hit.object.userData.vrAction){hit.object.userData.vrAction();return;}
    if(viewer.visible)return;
    if(hit.object.userData.photo){openArtwork(hit.object.userData.photo);return;}
    if(hooks.floors().includes(hit.object))teleport(hit.point);
  }
  for(let i=0;i<2;i++){
    const controller=renderer.xr.getController(i);rig.add(controller);controller.userData.xrSource=null;controller.userData.snapReady=true;
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,-1)]),new THREE.LineBasicMaterial({color:'#5bbaa7'}));line.scale.z=4;line.visible=false;controller.add(line);
    controller.addEventListener('connected',e=>{controller.userData.xrSource=e.data;line.visible=active;});controller.addEventListener('disconnected',()=>{controller.userData.xrSource=null;line.visible=false;});
    controller.addEventListener('select',()=>select(controller));controller.addEventListener('squeeze',()=>{if(!active)return;if(viewer.visible)closeArtwork();menu.visible=true;menuPending=true;});
    controllers.push({controller,line});
  }
  function restore(){
    if(!saved)return;generation++;active=false;busy=false;starting=false;closeArtwork();menu.visible=false;marker.visible=false;transitionLabel.visible=false;curtain.material.opacity=0;controllers.forEach(v=>v.line.visible=false);
    rig.position.set(0,0,0);rig.rotation.set(0,0,0);camera.position.copy(saved.position);camera.quaternion.copy(saved.quaternion);camera.scale.copy(saved.scale);camera.fov=saved.fov;camera.aspect=saved.aspect;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
    renderer.shadowMap.enabled=saved.shadows;renderer.shadowMap.needsUpdate=true;saved=null;button.textContent='Enter VR';button.disabled=false;hooks.changed(false);
  }
  renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');renderer.xr.setFramebufferScaleFactor(.85);
  renderer.xr.addEventListener('sessionend',restore);
  async function enter(){
    if(active||starting)return;if(!xr)return;starting=true;button.disabled=true;
    try{
      hooks.beforeEnter();
      // Request directly inside the click activation; never enter VR automatically.
      const session=await xr.requestSession('immersive-vr',{requiredFeatures:['local-floor']});
      const feet=hooks.feet();saved={position:camera.position.clone(),quaternion:camera.quaternion.clone(),scale:camera.scale.clone(),fov:camera.fov,aspect:camera.aspect,shadows:renderer.shadowMap.enabled};
      groundY=feet.y;lookPitch=0;rig.position.set(feet.x,feet.y,feet.z);rig.rotation.set(0,hooks.yaw(),0);camera.position.set(0,0,0);camera.rotation.set(0,0,0);renderer.shadowMap.enabled=false;generation++;active=true;menuPending=true;menu.visible=true;hooks.changed(true);
      try{await renderer.xr.setSession(session);renderer.xr.setFoveation?.(.5);}catch(error){await session.end().catch(()=>{});throw error;}
      if(active){button.textContent='Exit VR';controllers.forEach(v=>v.line.visible=!!v.controller.userData.xrSource);}
    }catch{restore();hooks.error('VR could not start. Open the HTTPS gallery directly in a WebXR-compatible headset browser and allow the session.');}
    finally{starting=false;button.disabled=false;}
  }
  async function exit(){try{await renderer.xr.getSession()?.end();}catch{hooks.error('Use the headset system menu to leave VR.');}}
  button.onclick=()=>active?exit():enter();
  function update(dt){
    if(!active||!renderer.xr.isPresenting)return;rig.updateMatrixWorld(true);renderer.xr.updateCamera(camera);
    if(menuPending){place(menu,1.5,-.35);menuPending=false;}
    if(!busy)curtain.material.opacity=Math.max(0,curtain.material.opacity-dt*4);
    marker.visible=false;
    for(const {controller,line} of controllers){
      if(!controller.userData.xrSource)continue;const hit=point(controller);line.scale.z=hit?.distance||4;
      const landing=hit&&hooks.floors().includes(hit.object)&&teleportLanding(hit.point,hooks.canStand);
      if(landing&&!viewer.visible&&!busy){marker.position.set(landing.x,landing.y+.025,landing.z);marker.visible=true;}
      const source=controller.userData.xrSource,axes=source.gamepad?.axes||[];
      const stickX=axes.length>=4?axes[2]:axes[0]||0,stickY=axes.length>=4?axes[3]:axes[1]||0;
      const dead=v=>Math.abs(v)<.18?0:Math.sign(v)*(Math.abs(v)-.18)/.82;
      if(!busy&&!viewer.visible&&source.handedness==='left'){
        camera.getWorldDirection(forward);forward.y=0;if(forward.lengthSq()<.001)forward.set(0,0,-1);forward.normalize();
        const right=new THREE.Vector3(-forward.z,0,forward.x),delta=forward.clone().multiplyScalar(-dead(stickY)).addScaledVector(right,dead(stickX));
        if(delta.length()>1)delta.normalize();delta.multiplyScalar(1.6*Math.min(dt,.05));
        const steps=Math.max(1,Math.ceil(delta.length()/.04));
        for(let i=0;i<steps;i++)for(const axis of ['x','z']){
          const here=headPosition(),next={x:here.x,y:groundY,z:here.z};next[axis]+=delta[axis]/steps;
          if(teleportLanding(next,hooks.canStand)){rig.position[axis]+=delta[axis]/steps;rig.updateMatrixWorld(true);renderer.xr.updateCamera(camera);}
        }
      }
      if(!busy&&source.handedness==='right'){
        const yaw=-dead(stickX)*1.2*Math.min(dt,.05),nextPitch=THREE.MathUtils.clamp(lookPitch-dead(stickY)*.8*Math.min(dt,.05),-Math.PI/6,Math.PI/6),pitch=nextPitch-lookPitch;
        if(yaw||pitch){
          const center=headPosition(),up=new THREE.Vector3(0,1,0),turn=new THREE.Quaternion().setFromAxisAngle(up,yaw);
          camera.getWorldDirection(forward);const right=new THREE.Vector3().crossVectors(forward,up).normalize();
          turn.multiply(new THREE.Quaternion().setFromAxisAngle(right,pitch));
          rig.position.sub(center).applyQuaternion(turn).add(center);rig.quaternion.premultiply(turn);lookPitch=nextPitch;rig.updateMatrixWorld(true);renderer.xr.updateCamera(camera);
        }
      }
    }
  }
  return {get active(){return active;},get transitioning(){return busy;},enter,exit,update,headPosition,teleport,openArtwork,closeArtwork,menu,viewer,rig,controllers};
}
