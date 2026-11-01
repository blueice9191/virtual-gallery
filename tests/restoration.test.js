import test from 'node:test';
import assert from 'node:assert/strict';
import { rooms,slots,corridorSlots,canWalk,polar,walls,segmentDistance,findPath3D } from '../src/building.js';

test('restored ground-floor sector 10 has its photos and both neighboring doorways',()=>{
  const room=rooms.find(r=>r.id==='f1-r10');assert.ok(room);
  assert.equal(rooms.filter(r=>r.floor===0).length,12);
  assert.equal(slots.filter(s=>s.room===room.id).length,8);
  assert.equal(corridorSlots.filter(s=>s.room===room.id).length,1);
  for(const angle of [room.angle-room.span/2,room.angle+room.span/2]){
    const p=polar(18,angle);assert.equal(canWalk(p.x,p.z,0),true);
    assert.ok(!walls.some(w=>w.floor===0&&w.kind!=='lintel'&&segmentDistance(p.x,p.z,w.a,w.b)<.32));
  }
  for(const id of ['f1-r9','f1-r11']){const neighbor=rooms.find(r=>r.id===id);assert.ok(findPath3D({...room.visit,y:0},{...neighbor.visit,y:0}).length);}
});
test('the museum has no outdoor walkable area and sector 10 has a solid outer wall',()=>{
  const r=rooms.find(r=>r.id==='f1-r10'),p=polar(23*Math.cos(r.span/2),r.angle);
  assert.equal(canWalk(p.x,p.z,0),false);
  for(const p of [{x:0,z:30},{x:30,z:0},{x:-30,z:0},{x:0,z:-30}])assert.equal(canWalk(p.x,p.z,0),false);
});
