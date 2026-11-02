import test from 'node:test';
import assert from 'node:assert/strict';
import {imageURL,nearbyDisplays,createWallStream,wallTextureSize} from '../src/mobile-rendering.js';
test('mobile images bound both portrait and panorama dimensions',()=>{
  assert.equal(imageURL({displaySrc:'https://res.cloudinary.com/demo/image/upload/c_limit,w_4096,q_auto,f_auto/v1/a.jpg'},768),'https://res.cloudinary.com/demo/image/upload/c_limit,w_768,h_768,q_auto,f_auto/v1/a.jpg');
  assert.equal(imageURL({src:'blob:local'},768),'blob:local');
});
test('stream releases distant textures, bounds concurrency, and disposes obsolete pending loads',async()=>{
  let active=0,peak=0,released=0;
  const entries=Array.from({length:60},(_,i)=>({photo:{id:i},slot:{x:i/10,z:0,y:i<40?2:8},material:{},group:{visible:false}}));
  const nearby=nearbyDisplays(entries,{x:0,z:0,y:1.7});assert.equal(nearby.length,24);assert.ok(nearby.every(e=>e.slot.y===2));
  const stream=createWallStream(async photo=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,1));active--;return {id:photo.id};},()=>released++);
  stream.update(nearby);await stream.ready();assert.equal(stream.size,24);assert.ok(peak<=2);
  stream.update([]);assert.equal(stream.size,0);assert.equal(released,24);
  stream.update([entries[40]]);stream.dispose();await new Promise(r=>setTimeout(r,10));assert.equal(released,25);assert.equal(entries[40].group.visible,false);
});

test('only favorites-panel textures use the higher mobile resolution',()=>{assert.equal(wallTextureSize({slot:{area:'favorites'}}),2048);assert.equal(wallTextureSize({slot:{area:'corridor'}}),768);assert.equal(wallTextureSize(),768);});
