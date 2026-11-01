import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rooms,floors,entrance,canWalk,surfacesAt,findPath3D,walkSurface,FLOOR_HEIGHT } from '../src/building.js';
import { buildTourRoute,TourProgress } from '../src/tour.js';
import { AlbumState } from '../src/album-state.js';
import { planExpandedDisplays } from '../src/expanded-displays.js';
import { createVisit } from '../src/visit.js';
const catalog=JSON.parse(readFileSync(new URL('../public/gallery.json',import.meta.url))),albums=JSON.parse(readFileSync(new URL('../public/albums.json',import.meta.url))).albums;

test('building has 12/12/6 connected galleries and double-width panorama rooms',()=>{
  assert.deepEqual(floors.map(f=>rooms.filter(r=>r.floor===f.floor).length),[12,12,6]);
  assert.equal(rooms.find(r=>r.floor===2).span,rooms[0].span*2);
  for(const r of rooms){assert.ok(canWalk(r.visit.x,r.visit.z,r.floor),r.id);const peers=rooms.filter(n=>n.floor===r.floor),next=peers[(peers.indexOf(r)+1)%peers.length];assert.ok(findPath3D({...r.visit,y:r.floor*6},{...next.visit,y:next.floor*6}).length,`${r.id} to ${next.id}`);}
});
test('upper atrium centers are voids, balconies and stair landings remain walkable',()=>{
  assert.equal(canWalk(0,5,0),true);assert.equal(canWalk(0,5,1),false);assert.equal(canWalk(0,5,2),false);
  assert.equal(canWalk(11,4,1),true);assert.equal(canWalk(8.2,3.8,2),true);assert.equal(canWalk(-4,2.6,0),false);
  assert.ok(surfacesAt(5.8,0).some(y=>Math.abs(y-1.5)<.001));
  assert.ok(surfacesAt(8.2,0).some(y=>Math.abs(y-4.5)<.001));
});
test('every room is populated reproducibly, including reusable sample panorama displays',()=>{
  const visit=createVisit(catalog),a=planExpandedDisplays(catalog,visit),b=planExpandedDisplays(catalog,JSON.parse(JSON.stringify(visit)));
  assert.deepEqual(a,b);assert.ok(a.length>0&&a.length<=283);
  assert.equal(new Set(a.map(d=>d.photo.contentKey||d.photo.id)).size,a.length);
  assert.ok(a.filter(d=>d.slot.floor===2&&d.slot.wall==='outer').every(d=>d.slot.maxWidth===8));

});
test('albums contain valid assets, flip in both directions, and close after the final spread',()=>{
  const reader=new AlbumState();
  for(const album of albums){for(const id of album.photoIds)assert.ok(catalog.photos.some(p=>p.id===id));reader.open(album);assert.equal(reader.count,Math.ceil(album.photoIds.length/2));assert.equal(reader.next(),'turned');reader.previous();assert.equal(reader.spread,0);while(!reader.last)reader.next();assert.ok(reader.last);assert.equal(reader.next(),'closed');assert.equal(reader.album,null);}
});
test('full tour walks all 30 rooms in order, climbs both stairs, returns, and preserves pause position',async()=>{
  const route=await buildTourRoute({...rooms[0].visit,y:0}),arrivals=route.filter(p=>p.arrival);
  assert.deepEqual(arrivals.slice(0,30).map(p=>p.arrival.id),rooms.map(r=>r.id));assert.equal(arrivals.at(-1).arrival.id,'return');assert.equal(route.at(-1).y,0);
  assert.ok(route.some(p=>p.y>1&&p.y<5));assert.ok(route.some(p=>p.y>7&&p.y<11));
  // Simulate the exact axis-separated collision controller over the full route.
  let p={...rooms[0].visit,y:0};
  for(const target of route){let limit=100;while(Math.hypot(target.x-p.x,target.z-p.z)>.075&&limit--){const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz),step=Math.min(.08,d),old={...p};let h=walkSurface(p.x+dx/d*step,p.z,p.y);if(h!==undefined){p.x+=dx/d*step;p.y=h;}h=walkSurface(p.x,p.z+dz/d*step,p.y);if(h!==undefined){p.z+=dz/d*step;p.y=h;}assert.ok(Math.hypot(p.x-old.x,p.z-old.z)>.00001,`blocked at ${JSON.stringify(p)} toward ${JSON.stringify(target)}`);}assert.ok(limit>0);assert.ok(Math.abs(p.y-target.y)<.31);}
  assert.ok(Math.hypot(p.x-entrance.x,p.z-entrance.z)<.1);assert.ok(p.y<.01);
  const progress=new TourProgress();progress.start(route);progress.arrive();const index=progress.index;progress.pause();assert.equal(progress.status,'paused');progress.resume();assert.equal(progress.index,index);assert.equal(progress.status,'running');
});
