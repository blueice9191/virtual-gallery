import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createVRBookStand} from '../src/vr-book-stand.js';
import {createBooks} from '../src/books.js';
const makeText=(name,w,h)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial());m.name=name;return m;};
test('reading stand fits seated/standing eye heights, faces viewer and stays world locked',()=>{
 for(const eyeHeight of [.95,1.7,2]){
  const scene=new THREE.Scene(),book=new THREE.Group();scene.add(book);book.position.set(-4,1.035,2.5);const original=book.position.clone();let position=new THREE.Vector3(2,eyeHeight,4);const direction=new THREE.Vector3(0,0,-1);let closed=0;
  const stand=createVRBookStand(scene,{pose:()=>({position,direction}),close:()=>closed++,makeText});stand.mount(book);
  assert.equal(stand.root.position.y,eyeHeight-.35);assert.ok(Math.abs(stand.tilt.rotation.x+Math.PI/4)<1e-8);
  const normal=new THREE.Vector3(0,1,0).transformDirection(book.matrixWorld),toViewer=position.clone().sub(book.getWorldPosition(new THREE.Vector3())).normalize();assert.ok(normal.dot(toViewer)>.8);
  const fixed=stand.root.position.clone();position=new THREE.Vector3(5,2.3,6);scene.updateMatrixWorld(true);assert.deepEqual(stand.root.position,fixed);
  const press=name=>stand.controls.find(c=>c.name===name).userData.vrAction();
  for(let i=0;i<30;i++){press('Raise');press('More tilt');}assert.ok(Math.abs(stand.root.position.y-(eyeHeight+.25))<1e-8);assert.ok(Math.abs(stand.tilt.rotation.x+75*Math.PI/180)<1e-8);
  for(let i=0;i<30;i++){press('Lower');press('Less tilt');}assert.ok(Math.abs(stand.tilt.rotation.x+15*Math.PI/180)<1e-8);
  press('Reset');assert.equal(stand.root.position.y,position.y-.35);press('Close book');assert.equal(closed,1);
  stand.unmount();assert.equal(book.parent,scene);assert.deepEqual(book.position,original);assert.equal(stand.root.visible,false);stand.dispose();
 }
});
test('tilted book retains page ray targets and textures and returns to desk after last page',async()=>{
 const previous=globalThis.document;globalThis.document={createElement(){return {getContext(){return {translate(){},rotate(){},fillText(){}};}};}};
 try{
  const scene=new THREE.Scene(),photos=Array.from({length:4},(_,i)=>({id:String(i),width:1000,height:700})),album={id:'test',name:'Test',photoIds:photos.map(p=>p.id)};
  const maps=photos.map(()=>new THREE.Texture());let stand;
  const books=createBooks(scene,[album],photos,async p=>maps[+p.id],{opened(){stand.mount(books.openGroup);},changed(){},closed(){stand.unmount();}},false,true);
  stand=createVRBookStand(scene,{pose:()=>({position:new THREE.Vector3(0,1.1,0),direction:new THREE.Vector3(0,0,-1)}),close:()=>books.close(),makeText});const original=books.openGroup.position.clone();
  await books.open(album);books.update(1);scene.updateMatrixWorld(true);
  for(const direction of [-1,1]){const target=books.pickables.find(p=>p.userData.turnPage===direction),center=target.getWorldPosition(new THREE.Vector3()),normal=new THREE.Vector3(0,0,1).transformDirection(target.matrixWorld);const ray=new THREE.Raycaster(center.clone().add(normal),normal.negate());assert.equal(ray.intersectObject(target)[0]?.object,target);}
  await books.turn(1);books.update(1);assert.equal(books.reader.spread,1);assert.equal(stand.active,true);await books.turn(1);books.update(1);assert.equal(stand.active,false);assert.deepEqual(books.openGroup.position,original);assert.equal(books.openGroup.parent,scene);books.dispose();stand.dispose();
 }finally{globalThis.document=previous;}
});
