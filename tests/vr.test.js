import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {immersiveSupported,teleportLanding,floorLanding,fittedArtwork} from '../src/vr-policy.js';
import {canWalk} from '../src/building.js';
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

test('pointing cannot teleport through an occluding wall and held sticks snap only once',async()=>{
 const f=fixture(),floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));floor.rotation.x=-Math.PI/2;f.scene.add(floor);f.hooks.floors=()=>[floor];
 const wall=new THREE.Mesh(new THREE.PlaneGeometry(3,3),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));wall.position.set(0,1,-.5);f.scene.add(wall);f.hooks.occluders=()=>[wall];
 await f.vr.enter();f.vr.update(.016);f.vr.menu.visible=false;const c=f.controllers[0],source={gamepad:{axes:[0,0,0,0]}};c.position.set(0,1.6,0);c.rotation.x=-Math.PI/4;c.dispatchEvent({type:'connected',data:source});f.scene.updateMatrixWorld(true);
 c.dispatchEvent({type:'select'});await Promise.resolve();assert.equal(f.vr.rig.position.z,0);
 f.hooks.occluders=()=>[];f.scene.remove(wall);c.dispatchEvent({type:'select'});await Promise.resolve();await Promise.resolve();assert.ok(f.vr.rig.position.z< -1);
 source.gamepad.axes[2]=1;f.vr.update(.016);const turn=f.vr.rig.rotation.y;f.vr.update(.016);assert.equal(f.vr.rig.rotation.y,turn);
 source.gamepad.axes[2]=0;f.vr.update(.016);source.gamepad.axes[2]=1;f.vr.update(.016);assert.ok(Math.abs(f.vr.rig.rotation.y-turn)> .5);await f.vr.exit();
});

test('an unfinished teleport from an ended session cannot relocate a new session',async()=>{
 let release;const f=fixture();f.hooks.prepareLanding=()=>new Promise(resolve=>release=resolve);await f.vr.enter();f.vr.update(.016);const pending=f.vr.teleport({x:11,y:12,z:4});await f.vr.exit();await f.vr.enter();f.vr.update(.016);release();await pending;assert.equal(f.vr.rig.position.y,0);assert.equal(f.vr.rig.position.z,0);await f.vr.exit();
});
