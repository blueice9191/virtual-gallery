import test from 'node:test';
import assert from 'node:assert/strict';
import { rooms,desk,guardRuns,upperVoid,innerRing,canWalk,findPath3D,slots,walls,segmentDistance } from '../src/building.js';
import { benchLayout,benchBlocks,bookLayout,guardPosts } from '../src/fixtures.js';
import { smoothHeading,routeLookAhead,roomSweepYaw } from '../src/tour-camera.js';

test('all bench seats and feet run parallel to the wall rather than towards it',()=>{
  for(const room of rooms){const b=benchLayout(room);assert.ok(Math.abs(b.tangent.x*Math.cos(room.angle)+b.tangent.z*Math.sin(room.angle))<1e-10);assert.ok(Math.abs(Math.hypot(b.legs[0].x-b.legs[1].x,b.legs[0].z-b.legs[1].z)-b.length*.72)<1e-10);}
});
test('closed books form one touching row at the far left, clear of the open book and its page sweep',()=>{
  const layout=bookLayout(desk,3),open=layout.open;
  for(let i=0;i<layout.standing.length;i++){const b=layout.standing[i];assert.ok(b.x-b.width/2>open.x+open.width/2+.1);assert.ok(b.x+b.width/2<desk.x+desk.width/2);assert.ok(b.z+b.depth/2<desk.z+desk.depth/2);if(i)assert.ok(Math.abs(layout.standing[i-1].x-b.x-b.width)<1e-10);}
  assert.ok(open.x-open.width/2>desk.x-desk.width/2);assert.ok(open.z-open.depth/2>desk.z-desk.depth/2);
});
test('every guard has posts at both ends and closely spaced vertical supports',()=>{
  for(const run of guardRuns){const posts=guardPosts(run);assert.deepEqual(posts[0],run.a);assert.ok(Math.hypot(posts.at(-1).x-run.b.x,posts.at(-1).z-run.b.z)<1e-8);for(let i=1;i<posts.length;i++)assert.ok(Math.hypot(posts[i].x-posts[i-1].x,posts[i].z-posts[i-1].z)<=.851);}
});
test('bridge guards do not cross the circulation corridor or either active stair mouth',()=>{
  for(const floor of [1,2]){
    assert.ok(canWalk(10,3.2,floor));assert.ok(canWalk(10,4.7,floor));
    assert.ok(findPath3D({x:10,z:2.5,y:floor*6},{x:10,z:5.5,y:floor*6}).length);
    assert.ok(canWalk(8.2,3.5,floor));
  }
  assert.ok(canWalk(5.8,3.5,1));
  assert.ok(upperVoid.some(p=>p.x===9.35));assert.ok(!innerRing.some(p=>p.x===9.35));
});
test('additional display centers mount on solid entrance/side piers outside door openings',()=>{
  for(const slot of slots){const wallDistance=Math.min(...walls.filter(w=>w.floor===slot.floor&&w.kind!=='lintel').map(w=>segmentDistance(slot.x,slot.z,w.a,w.b)));assert.ok(wallDistance<.18,slot.id);const room=rooms.find(r=>r.id===slot.room);const direction={x:room.visit.x-slot.x,z:room.visit.z-slot.z};assert.ok(direction.x*slot.normal.x+direction.z*slot.normal.z>0,slot.id);}
});
test('tour heading has bounded angular velocity, no overshoot, and handles wraparound',()=>{
  let yaw=0;for(let i=0;i<300;i++){const next=smoothHeading(yaw,1.5,1/60);assert.ok(next>=yaw);assert.ok(next-yaw<=.95/60+1e-10);assert.ok(next<=1.5);yaw=next;}assert.ok(yaw>1.49);
  assert.ok(smoothHeading(Math.PI-.05,-Math.PI+.05,1/60)>Math.PI-.05);
  let previous=0;for(let i=0;i<=120;i++){const current=roomSweepYaw(0,i/10,12);assert.ok(current>=previous);previous=current;}assert.ok(Math.abs(previous-Math.PI*2)<1e-8);
});
test('camera looks several grid segments ahead rather than tracking each zigzag waypoint',()=>{
  const route=[{x:.5,z:.5,y:0},{x:1,z:.5,y:0},{x:1.5,z:1,y:0},{x:2,z:1,y:0},{x:3,z:1,y:0}];const target=routeLookAhead(route,0,{x:0,z:0,y:0},2.5);assert.ok(target.x>1.5);
});

test('long benches use their complete collision footprint and panorama benches sit at the room center',()=>{
  for(const room of rooms){const b=benchLayout(room);assert.equal(b.length,3);assert.ok(benchBlocks(b.center.x+b.tangent.x*1.4,b.center.z+b.tangent.z*1.4,b));assert.ok(!canWalk(b.center.x,b.center.z,room.floor));assert.ok(canWalk(room.visit.x,room.visit.z,room.floor));
    if(room.panorama){assert.ok(Math.abs(Math.hypot(b.center.x,b.center.z)-16.3144232134)<1e-7);assert.ok(Math.hypot(b.center.x,b.center.z)<18);}
    else assert.ok(Math.abs(Math.hypot(b.center.x,b.center.z)-19)<1e-9);
  }
});
