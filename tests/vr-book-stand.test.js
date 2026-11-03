import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {TABLE_TOP,createVRBookStand} from '../src/vr-book-stand.js';
import {createBooks} from '../src/books.js';
const makeText=(name,w,h)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial());m.name=name;return m;};
test('desk hinge stays fixed while height controls move the viewer and menu stays beside pages',()=>{
 const scene=new THREE.Scene(),book=new THREE.Group();scene.add(book);book.position.set(-4,1.035,2.5);const original=book.position.clone();let height=1.4,closed=0;
 const stand=createVRBookStand(scene,{adjustHeight:d=>height+=d,resetHeight:()=>height=1.4,close:()=>closed++,makeText});stand.mount(book);
 const fixed=stand.root.position.clone(),press=name=>stand.controls.find(c=>c.name===name).userData.vrAction();
 assert.equal(fixed.y,TABLE_TOP+.08);press('Higher');assert.equal(height,1.5);press('Lower');assert.equal(height,1.4);assert.deepEqual(stand.root.position,fixed);
 for(let i=0;i<30;i++)press('More tilt');assert.ok(Math.abs(stand.tilt.rotation.x+75*Math.PI/180)<1e-8);
 for(let i=0;i<30;i++)press('Less tilt');assert.ok(Math.abs(stand.tilt.rotation.x+15*Math.PI/180)<1e-8);
 assert.equal(new Set(stand.controls.map(c=>c.position.x)).size,2);assert.equal(new Set(stand.controls.map(c=>c.position.y)).size,3);
 for(const control of stand.controls)assert.ok(control.position.x+.32< -1.375);
 press('Reset');assert.deepEqual(stand.root.position,fixed);assert.ok(Math.abs(stand.tilt.rotation.x+Math.PI/4)<1e-8);press('Close book');assert.equal(closed,1);
 stand.unmount();assert.equal(book.parent,scene);assert.deepEqual(book.position,original);assert.equal(stand.root.visible,false);stand.dispose();
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
  // All book vertices and the tray remain above the actual table, including flipping sheets.
  const checkAboveTable=()=>{scene.updateMatrixWorld(true);for(const group of [books.openGroup,stand.tilt.children[0]])group.traverse(mesh=>{if(!mesh.geometry)return;const points=mesh.geometry.attributes.position;for(let i=0;i<points.count;i++){const point=new THREE.Vector3().fromBufferAttribute(points,i).applyMatrix4(mesh.matrixWorld);assert.ok(point.y>=TABLE_TOP-1e-6,`table penetration: ${point.y}`);}});};
  for(const label of ['More tilt','Less tilt']){for(let i=0;i<15;i++){stand.controls.find(c=>c.name===label).userData.vrAction();checkAboveTable();}}
  await books.turn(1);for(let i=0;i<70;i++){books.update(.01);checkAboveTable();}assert.equal(books.reader.spread,1);assert.equal(stand.active,true);await books.turn(1);books.update(1);assert.equal(stand.active,false);assert.deepEqual(books.openGroup.position,original);assert.equal(books.openGroup.parent,scene);books.dispose();stand.dispose();
 }finally{globalThis.document=previous;}
});
