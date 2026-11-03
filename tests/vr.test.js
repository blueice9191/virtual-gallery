import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {immersiveSupported,teleportLanding,floorLanding,fittedArtwork,walkingLanding} from '../src/vr-policy.js';
import {canWalk,walkSurface} from '../src/building.js';
import {createVR} from '../src/vr.js';

test('VR capability checks fail closed and floor destinations use real collision geometry',async()=>{
  assert.equal(await immersiveSupported(null),false);
  assert.equal(await immersiveSupported({isSessionSupported:async()=>{throw Error();}}),false);
  assert.equal(await immersiveSupported({isSessionSupported:async mode=>mode==='immersive-vr'}),true);
  for(let floor=0;floor<3;floor++)assert.deepEqual(teleportLanding(floorLanding(floor),canWalk),floorLanding(floor));
  assert.equal(teleportLanding({x:0,y:6,z:0},canWalk),null); // Upper atrium void.
  assert.equal(teleportLanding({x:5.8,y:1.5,z:0},canWalk),null); // Stair tread is not a safe flat-floor landing.
  assert.equal(teleportLanding({x:25,y:0,z:0},canWalk),null);
  for(const photo of [{width:100,height:1000},{width:10000,height:100}]){
    const fit=fittedArtwork(photo);assert.ok(fit.width<=1.9000001&&fit.height<=1.5000001);assert.ok(Math.abs(fit.width/fit.height-photo.width/photo.height)<1e-8);
  }
});
function fixture(loadArtwork=async()=>new THREE.Texture()){
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(66,1.5,.08,110);camera.position.set(2,1.7,8);camera.rotation.y=.2;
  const controllers=[new THREE.Group(),new THREE.Group()],changes=[],errors=[];
  const xr=new THREE.EventDispatcher();xr.isPresenting=false;xr.getController=i=>controllers[i];xr.getCamera=()=>camera;xr.getSession=()=>xr.session;xr.setReferenceSpaceType=()=>{};xr.setFramebufferScaleFactor=()=>{};
  xr.updateCamera=()=>{camera.position.set(.3,1.6,0);camera.quaternion.identity();camera.parent.updateMatrixWorld(true);};
  xr.setSession=async session=>{xr.session=session;xr.isPresenting=true;xr.updateCamera();};
  const session={async end(){xr.isPresenting=false;xr.session=null;xr.dispatchEvent({type:'sessionend'});}};
  const device={async requestSession(mode,options){assert.equal(mode,'immersive-vr');assert.deepEqual(options.requiredFeatures,['local-floor']);return session;}};
  const renderer={xr,shadowMap:{enabled:true}},button={},makeText=(name,w,h)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial());m.name=name;return m;};
  const art=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial());art.position.set(0,1.6,-3);art.userData.photo={id:'art',title:'##Art',width:1000,height:700};scene.add(art);
  const hooks={beforeEnter(){},feet:()=>({x:0,y:0,z:0}),yaw:()=>0,canStand:()=>true,artworks:()=>[art],floors:()=>[],occluders:()=>[],loadArtwork,prepareLanding:async()=>{},changed:v=>changes.push(v),error:m=>errors.push(m)};
  const vr=createVR({scene,renderer,camera,button,xr:device,hooks,makeText});
  return {vr,scene,camera,renderer,controllers,button,hooks,changes,errors};
}
test('VR lifecycle preserves head offset during floor teleport and restores the walking camera',async()=>{
  const f=fixture(),position=f.camera.position.clone(),rotation=f.camera.quaternion.clone();
  await f.vr.enter();assert.equal(f.vr.active,true);assert.equal(f.renderer.shadowMap.enabled,false);
  f.vr.update(.016);await f.vr.teleport({x:11,y:6,z:4});
  assert.ok(Math.abs(f.vr.headPosition().x-11)<1e-9);assert.ok(Math.abs(f.vr.headPosition().z-4)<1e-9);assert.equal(f.vr.rig.position.y,6);
  await f.vr.exit();assert.equal(f.vr.active,false);assert.deepEqual(f.camera.position,position);assert.deepEqual(f.camera.quaternion.toArray(),rotation.toArray());assert.equal(f.renderer.shadowMap.enabled,true);assert.deepEqual(f.changes,[true,false]);assert.deepEqual(f.errors,[]);
});
test('controller selection opens an in-world artwork and disposes the high resolution texture on close',async()=>{
  let disposed=false;const texture=new THREE.Texture();texture.addEventListener('dispose',()=>disposed=true);
  const f=fixture(async()=>texture);await f.vr.enter();f.vr.update(.016);f.vr.menu.visible=false;
  f.controllers[0].position.set(0,1.6,0);f.controllers[0].dispatchEvent({type:'connected',data:{gamepad:{axes:[0,0,0,0]}}});f.scene.updateMatrixWorld(true);
  f.controllers[0].dispatchEvent({type:'select'});await Promise.resolve();await Promise.resolve();
  assert.equal(f.vr.viewer.visible,true);assert.ok(f.vr.viewer.children.some(o=>o.material?.map===texture));
  f.vr.closeArtwork();assert.equal(disposed,true);assert.equal(f.vr.viewer.visible,false);assert.equal(f.vr.menu.visible,true);await f.vr.exit();
});
test('a pending artwork load cannot leak a texture into an ended VR session',async()=>{
  let resolve,disposed=false;const f=fixture(()=>new Promise(r=>resolve=r));await f.vr.enter();f.vr.update(.016);
  const pending=f.vr.openArtwork({id:'late',width:500,height:1000});await f.vr.exit();const texture=new THREE.Texture();texture.addEventListener('dispose',()=>disposed=true);resolve(texture);await pending;
  assert.equal(disposed,true);assert.equal(f.vr.viewer.visible,false);
});

test('pointing cannot teleport through an occluding wall and right stick turns until released',async()=>{
 const f=fixture(),floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));floor.rotation.x=-Math.PI/2;f.scene.add(floor);f.hooks.floors=()=>[floor];
 const wall=new THREE.Mesh(new THREE.PlaneGeometry(3,3),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));wall.position.set(0,1,-.5);f.scene.add(wall);f.hooks.occluders=()=>[wall];
 await f.vr.enter();f.vr.update(.016);f.vr.menu.visible=false;const c=f.controllers[0],source={handedness:'right',gamepad:{axes:[0,0,0,0]}};c.position.set(0,1.6,0);c.rotation.x=-Math.PI/4;c.dispatchEvent({type:'connected',data:source});f.scene.updateMatrixWorld(true);
 c.dispatchEvent({type:'select'});await Promise.resolve();assert.equal(f.vr.rig.position.z,0);
 f.hooks.occluders=()=>[];f.scene.remove(wall);c.dispatchEvent({type:'select'});await Promise.resolve();await Promise.resolve();assert.ok(f.vr.rig.position.z< -1);
 source.gamepad.axes[2]=1;f.vr.update(.016);const turn=f.vr.rig.rotation.y;f.vr.update(.016);assert.ok(f.vr.rig.rotation.y<turn);
 source.gamepad.axes[2]=0;f.vr.update(.016);source.gamepad.axes[2]=1;f.vr.update(.016);assert.ok(Math.abs(f.vr.rig.rotation.y-turn)> .02);await f.vr.exit();
});

test('an unfinished teleport from an ended session cannot relocate a new session',async()=>{
 let release;const f=fixture();f.hooks.prepareLanding=()=>new Promise(resolve=>release=resolve);await f.vr.enter();f.vr.update(.016);const pending=f.vr.teleport({x:11,y:12,z:4});await f.vr.exit();await f.vr.enter();f.vr.update(.016);release();await pending;assert.equal(f.vr.rig.position.y,0);assert.equal(f.vr.rig.position.z,0);await f.vr.exit();
});


test('left stick moves head-relative, releases to stop, and collision blocks movement',async()=>{
 const f=fixture();await f.vr.enter();f.vr.update(.016);
 const source={handedness:'left',gamepad:{axes:[0,0,0,-1]}};
 f.controllers[0].dispatchEvent({type:'connected',data:source});
 const before=f.vr.headPosition();f.vr.update(.05);assert.ok(f.vr.headPosition().z<before.z-.07);
 source.gamepad.axes[3]=0;const stopped=f.vr.headPosition();f.vr.update(.05);assert.deepEqual(f.vr.headPosition(),stopped);
 source.gamepad.axes[2]=1;f.vr.update(.05);assert.ok(f.vr.headPosition().x>stopped.x+.07);
 f.hooks.canStand=()=>false;const blocked=f.vr.headPosition();f.vr.update(.05);assert.deepEqual(f.vr.headPosition(),blocked);await f.vr.exit();
});

test('unparented XR camera cannot reset the world floor used by photo streaming',async()=>{
 const f=fixture();const arrayCamera=new THREE.ArrayCamera();arrayCamera.position.set(.3,1.6,0);f.renderer.xr.getCamera=()=>arrayCamera;
 await f.vr.enter();f.vr.update(.016);
 for(const floor of [1,2,0]){await f.vr.teleport({x:11,y:floor*6,z:4});f.vr.update(.016);const position=f.vr.headPosition();assert.ok(Math.abs(position.y-(floor*6+1.6))<1e-8);assert.ok(Math.abs(position.x-11)<1e-8);}
 await f.vr.exit();
});

test('right stick rotates around head, bounds tilt, and preserves room-scale tracking',async()=>{
 const f=fixture();await f.vr.enter();f.vr.update(.016);const before=f.vr.headPosition();
 const source={handedness:'right',gamepad:{axes:[0,0,0,-1]}};f.controllers[1].dispatchEvent({type:'connected',data:source});
 for(let i=0;i<100;i++)f.vr.update(.05);
 assert.ok(f.vr.headPosition().distanceTo(before)<1e-8);assert.ok(Math.abs(f.vr.rig.rotation.x-Math.PI/6)<1e-8);
 source.gamepad.axes[3]=0;const rotation=f.vr.rig.quaternion.clone();f.vr.update(.05);assert.deepEqual(rotation.toArray(),f.vr.rig.quaternion.toArray());await f.vr.exit();
});


test('either controller can select a book and turn either page while locomotion remains enabled',async()=>{
 const f=fixture();let opened=0,turned=0,closed=0;
 const target=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial());target.position.set(0,1.6,-2);target.userData.album={id:'book'};f.scene.add(target);
 f.hooks.bookTargets=()=>[target];f.hooks.openBook=()=>opened++;f.hooks.turnBook=d=>turned+=d;f.hooks.closeBook=()=>closed++;
 await f.vr.enter();f.vr.update(.016);f.vr.menu.visible=false;
 for(const [i,handedness] of ['left','right'].entries()){const c=f.controllers[i];c.position.set(0,1.6,0);c.dispatchEvent({type:'connected',data:{handedness,gamepad:{axes:[0,0,0,0]}}});}
 f.scene.updateMatrixWorld(true);f.controllers[0].dispatchEvent({type:'select'});assert.equal(opened,1);
 delete target.userData.album;target.userData.turnPage=1;f.controllers[1].dispatchEvent({type:'select'});assert.equal(turned,1);
 target.userData.turnPage=-1;f.controllers[0].dispatchEvent({type:'select'});assert.equal(turned,0);
 f.controllers[0].userData.xrSource.gamepad.axes[3]=-1;const start=f.vr.headPosition();f.vr.update(.05);assert.ok(f.vr.headPosition().z<start.z);
 await f.vr.exit();assert.equal(closed,1);
});

test('thumbstick stair walking follows both switchback flights up and down on both levels',async()=>{
 const f=fixture();f.hooks.feet=()=>({x:5.5,y:0,z:3.45});f.hooks.walkSurface=(x,z,y)=>walkingLanding(x,z,y,walkSurface);
 await f.vr.enter();f.vr.update(.016);const source={handedness:'left',gamepad:{axes:[0,0,0,0]}};f.controllers[0].dispatchEvent({type:'connected',data:source});
 // Fixture headset has a .3 m room-scale offset, so virtual head starts at x=5.8.
 async function go(x,z,height){
  for(let i=0;i<500;i++){const p=f.vr.headPosition(),dx=x-p.x,dz=z-p.z;if(Math.hypot(dx,dz)<.035)break;const amount=Math.max(.001,Math.hypot(dx,dz));source.gamepad.axes[2]=dx/amount;source.gamepad.axes[3]=dz/amount;f.vr.update(.02);}
  source.gamepad.axes[2]=source.gamepad.axes[3]=0;const p=f.vr.headPosition();assert.ok(Math.hypot(p.x-x,p.z-z)<.07,JSON.stringify(p));assert.ok(Math.abs(p.y-1.6-height)<.1,JSON.stringify(p));
 }
 for(let floor=0;floor<2;floor++){await go(5.8,-3.67,floor*6+3);await go(8.2,-3.67,floor*6+3);await go(8.2,3.7,floor*6+6);if(floor===0)await go(5.8,3.7,6);}
 for(let floor=1;floor>=0;floor--){await go(8.2,-3.67,floor*6+3);await go(5.8,-3.67,floor*6+3);await go(5.8,3.7,floor*6);if(floor===1)await go(8.2,3.7,6);}
 await f.vr.exit();
});


test('virtual reading height clamps between table and 6 ft 6 in without moving the book or floor',async()=>{
 const f=fixture();await f.vr.enter();f.vr.update(.016);const book=new THREE.Group();book.position.set(-4,1.035,2.5);f.scene.add(book);f.vr.bookStand.mount(book);const fixed=f.vr.bookStand.root.position.clone();
 for(let i=0;i<40;i++)f.vr.setReadingHeight(.1);assert.ok(Math.abs(f.vr.headPosition().y-1.9812)<1e-8);
 for(let i=0;i<40;i++)f.vr.setReadingHeight(-.1);assert.ok(Math.abs(f.vr.headPosition().y-1.01)<1e-8);
 assert.deepEqual(f.vr.bookStand.root.position,fixed);f.vr.bookStand.unmount();assert.ok(Math.abs(f.vr.headPosition().y-1.6)<1e-8);await f.vr.exit();assert.equal(f.vr.active,false);
});
