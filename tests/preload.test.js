import test from 'node:test';
import assert from 'node:assert/strict';
import {preloadPhotos,createSpreadCache} from '../src/preload.js';
import {bookLayout} from '../src/fixtures.js';
import {desk} from '../src/building.js';
import {readFileSync} from 'node:fs';

test('exhibition preload awaits every unique texture and limits simultaneous requests',async()=>{
  let active=0,peak=0,finished=0;const progress=[];
  const photos=Array.from({length:15},(_,i)=>({id:String(i)}));photos.push(photos[0]);
  const result=await preloadPhotos(photos,async p=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,2));active--;finished++;return `texture-${p.id}`;},(done,total)=>progress.push([done,total]),3);
  assert.equal(finished,15);assert.equal(result.ready.size,15);assert.equal(result.failed.length,0);assert.equal(peak,3);assert.deepEqual(progress.at(-1),[15,15]);
});
test('adjacent album spreads are prefetched and reuse the same resolved texture objects',async()=>{
  let calls=0;const photos=Array.from({length:8},(_,i)=>({id:String(i)})),album={id:'album',photoIds:photos.map(p=>p.id)},cache=createSpreadCache(photos,async p=>{calls++;return {id:p.id};});
  await cache.prepare(album,1);cache.warm(album,1);
  const [previous,next]=await Promise.all([cache.prepare(album,0),cache.prepare(album,2)]);assert.equal(calls,6);assert.equal(previous[0].map.id,'0');assert.equal(next[1].map.id,'5');assert.equal(await cache.prepare(album,2),next);assert.equal(calls,6);
});
test('every non-Favorite folder has an album and the full row clears the opened book',()=>{
  const catalog=JSON.parse(readFileSync(new URL('../public/gallery.json',import.meta.url))),albums=JSON.parse(readFileSync(new URL('../public/albums.json',import.meta.url))).albums;
  assert.deepEqual(albums.map(a=>a.name).sort(),Object.keys(catalog.folders).filter(f=>f!=='Favorite').sort());
  const layout=bookLayout(desk,albums.length);for(const b of layout.standing){assert.ok(b.x-b.width/2>layout.open.x+layout.open.width/2+.1);assert.ok(b.x+b.width/2<desk.x+desk.width/2);}
  assert.ok(layout.open.x-layout.open.width/2>desk.x-desk.width/2);
});
