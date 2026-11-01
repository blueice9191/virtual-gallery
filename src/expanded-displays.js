import { exhibitionPlan,folderOf } from './exhibition.js';
import { rooms,slots,corridorSlots,FLOOR_HEIGHT } from './building.js';
// Any regular collection can fill spare walls; panorama collections never mix.
export const fallbackFolders={};
export const identity=photo=>photo.contentKey||photo.id;
export function planExpandedDisplays(catalog,visit){
  const photos=new Map(catalog.photos.map(p=>[p.id,p])),exhibition=exhibitionPlan(catalog,visit),used=new Set(),result=[];
  let seed=Number(visit.created)>>>0;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const pool=Object.values(visit.assignments).flat().filter(id=>photos.has(id));
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  const favoriteIds=[...new Set(exhibition?(exhibition.favoriteId?[exhibition.favoriteId]:[]):catalog.favoritePhotoIds||[])].filter(id=>photos.has(id)).slice(0,3);
  for(const [i,id] of favoriteIds.entries()){const photo=photos.get(id);if(used.has(identity(photo)))continue;used.add(identity(photo));result.push({photo,label:'Floor 1 · Selected collection',slot:{id:`favorite-${i}`,area:'favorites',floor:0,x:-4+(i-(favoriteIds.length-1)/2)*1.75,z:4.56,y:1.9,normal:{x:0,z:1},maxWidth:favoriteIds.length===1?3.6:1.5,maxHeight:2.15}});}
  const priority=slot=>slot.wall==='outer'?0:slot.area==='corridor'?1:slot.wall==='entrance'?3:2;
  const floorSlots=[0,1,2].map(floor=>{
    const perRoom=rooms.filter(r=>r.floor===floor).map(room=>[...slots,...corridorSlots].filter(s=>s.room===room.id).sort((a,b)=>priority(a)-priority(b))),ordered=[];
    // Give every room one print before filling a second position in any room.
    for(let i=0;i<Math.max(...perRoom.map(s=>s.length));i++)for(const list of perRoom)if(list[i])ordered.push(list[i]);return ordered;
  });
  // Interleave floors so shared companion folders cannot be consumed entirely by one floor.
  const pending=[];for(let i=0;i<Math.max(...floorSlots.map(s=>s.length));i++)for(const list of floorSlots)if(list[i]){const slot=list[i],primary=exhibition?(slot.floor===2&&slot.maxWidth<=5&&exhibition.floors[2]?.startsWith('Panorama')?exhibition.filler:exhibition.floors[slot.floor]):null;pending.push({slot,primary,assigned:false});}
  function take(folderList,slot){
    let candidates=pool.map(id=>photos.get(id)).filter(p=>!used.has(identity(p))&&(folderList===null?folderOf(p)!=='Favorite':folderList.includes(folderOf(p))));
    if(slot.portraitPreferred){const portraits=candidates.filter(p=>p.height>p.width);if(portraits.length)candidates=portraits;}
    const photo=candidates[0];if(photo)used.add(identity(photo));return photo;
  }
  function place(entry,photo){if(!photo)return;entry.assigned=true;const room=rooms.find(r=>r.id===entry.slot.room);result.push({photo,slot:{...entry.slot,y:entry.slot.height+entry.slot.floor*FLOOR_HEIGHT},label:`Floor ${room.floor+1} · ${entry.slot.area==='corridor'?'Corridor · ':''}${room.name}`});}
  // Every exhibition gets first use of its own folder before any fallback draws begin.
  for(const entry of pending)place(entry,take(exhibition?(entry.primary?[entry.primary]:[]):null,entry.slot));
  if(exhibition)for(const entry of pending.filter(e=>!e.assigned))place(entry,take(entry.primary?.startsWith('Panorama')?[]:[...new Set(catalog.photos.map(folderOf))].filter(f=>f!=='Favorite'&&!f.startsWith('Panorama')),entry.slot));
  return result;
}
