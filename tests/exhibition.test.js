import test from 'node:test';
import assert from 'node:assert/strict';
import {exhibitionPlan,printGeometry} from '../src/exhibition.js';
import {planExpandedDisplays,fallbackFolders} from '../src/expanded-displays.js';
import {createVisit} from '../src/visit.js';
const folders=['Scenery','Street_BW','Street_Color','China','Madison','Panorama_Scenery','Panorama_Street'];
const photos=folders.flatMap(folder=>[0,1].map(i=>({id:`${folder}-${i}`,folder,theme:folder,width:i?500:1500,height:1000,title:folder})));
photos.push(...folders.filter(f=>!f.startsWith('Panorama')).map(f=>({id:`fav-${f}`,folder:'Favorite',theme:'Favorite',favoriteFor:f,title:f,width:1000,height:700})));
const catalog={version:'test',photos};
test('arbitrary folders and Panorama prefixes produce reproducible unique exhibitions',()=>{
 const custom={version:'custom',photos:['Paintings','Calligraphy','Panorama_Ink','Panorama_City'].flatMap(folder=>Array.from({length:20},(_,i)=>({id:`${folder}-${i}`,folder,theme:folder,title:`Art ${i}`,width:1200,height:700})))};
 for(let seed=0;seed<30;seed++){
  const visit={...createVisit(custom),created:seed*1999},plan=exhibitionPlan(custom,visit),displays=planExpandedDisplays(custom,visit);
  assert.ok(plan.floors[2].startsWith('Panorama'));
  assert.ok(plan.favoriteId);assert.deepEqual(displays,planExpandedDisplays(custom,JSON.parse(JSON.stringify(visit))));
  assert.equal(new Set(displays.map(d=>d.photo.id)).size,displays.length);
  for(const d of displays){if(d.slot.floor<2)assert.ok(!d.photo.folder.startsWith('Panorama'));if(d.photo.folder.startsWith('Panorama'))assert.equal(d.photo.folder,plan.floors[2]);}
 }
});
test('matching Favorite names win; missing favorite and panorama folders work',()=>{
 const visit={...createVisit(catalog),created:170};const plan=exhibitionPlan(catalog,visit);
 assert.equal(catalog.photos.find(p=>p.id===plan.favoriteId).favoriteFor,plan.floors[0]);
 const ordinary={version:'plain',photos:photos.filter(p=>p.folder==='Scenery')},plain=exhibitionPlan(ordinary,createVisit(ordinary));
 assert.equal(plain.floors[2],'Scenery');assert.ok(plain.favoriteId);
 const dotted={version:'dot',photos:[{id:'x',folder:'Ink.v2',theme:'Ink.v2',title:'x'},{id:'fav',folder:'Favorite',theme:'Favorite',title:'Ink.v2'}]};
 assert.equal(exhibitionPlan(dotted,createVisit(dotted)).favoriteId,'fav');
});
test('white mat sizes preserve image aspect ratio and fit each wall slot',()=>{
  for(const photo of photos)for(const mode of ['none','narrow','wide']){
    const slot={maxWidth:1.25,maxHeight:2},p=printGeometry(photo,slot,mode);assert.ok(Math.abs(p.width/p.height-photo.width/photo.height)<1e-10);assert.ok(p.outerWidth<=1.250001&&p.outerHeight<=2.000001);assert.equal(p.mat===0,mode==='none');
  }
});

test('new narrow equals the former wide mat, and wide doubles that physical thickness',()=>{
  const photo={width:1500,height:1000},slot={maxWidth:3,maxHeight:3},narrow=printGeometry(photo,slot,'narrow'),wide=printGeometry(photo,slot,'wide');
  assert.ok(Math.abs(narrow.mat/narrow.height-.1)<1e-10);assert.ok(Math.abs(wide.mat-2*narrow.mat)<1e-10);
});
