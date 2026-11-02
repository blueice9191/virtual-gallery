import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Texture} from 'three';
import {createBooks} from '../src/books.js';
test('turning sheet preserves print fit, reveals destination first, and commits without stale textures',async()=>{
 const previous=globalThis.document;
 globalThis.document={createElement(){return {width:0,height:0,getContext(){return {translate(){},rotate(){},fillText(){}};}};}};
 try{
  const photos=Array.from({length:6},(_,i)=>({id:String(i),width:i%2?600:1600,height:1000}));
  const maps=photos.map(()=>new Texture()),album={id:'test',name:'Test',photoIds:photos.map(p=>p.id)},scene=new Scene();
  const books=createBooks(scene,[album],photos,async p=>maps[Number(p.id)],{opened(){},changed(){},closed(){}},false);
  await books.open(album);books.update(1);
  const sheet=scene.getObjectByName('Turning page'),front=scene.getObjectByName('Turning front image'),back=scene.getObjectByName('Turning back image');
  await books.turn(1);
  assert.equal(front.material.map,maps[1]);assert.equal(back.material.map,maps[2]);
  assert.ok(Math.abs(front.geometry.parameters.width/front.geometry.parameters.height-.6)<1e-8);
  assert.ok(Math.abs(back.geometry.parameters.width/back.geometry.parameters.height-1.6)<1e-8);
  const underlying=[];scene.traverse(o=>{if(o.userData?.albumPhoto&&!['Turning front image','Turning back image'].includes(o.name))underlying.push(o);});
  assert.ok(underlying.some(o=>o.material.map===maps[3]));
  books.update(.64);assert.equal(sheet.visible,true);books.update(.02);assert.equal(sheet.visible,false);
  assert.deepEqual(underlying.map(o=>o.material.map),[maps[2],maps[3]]);
  await books.turn(-1);assert.equal(front.material.map,maps[1]);assert.equal(back.material.map,maps[2]);
  assert.ok(underlying.some(o=>o.material.map===maps[0]));books.update(1);
  assert.deepEqual(underlying.map(o=>o.material.map),[maps[0],maps[1]]);assert.equal(sheet.visible,false);
  books.dispose();maps.forEach(m=>m.dispose());
 }finally{globalThis.document=previous;}
});
