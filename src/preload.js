export async function preloadPhotos(photos,load,onProgress=()=>{},concurrency=8){
  const unique=[...new Map(photos.map(p=>[p.id,p])).values()],ready=new Map(),failed=[];let next=0,done=0;onProgress(0,unique.length);
  await Promise.all(Array.from({length:Math.min(concurrency,unique.length)},async()=>{while(next<unique.length){const photo=unique[next++];try{ready.set(photo.id,await load(photo));}catch(error){failed.push({photo,error});}onProgress(++done,unique.length);}}));
  return {ready,failed};
}
export function createSpreadCache(photos,getTexture,bounded=false){
  const lookup=new Map(photos.map(p=>[p.id,p])),cache=new Map();
  function prepare(album,spread){
    if(spread<0||spread>=Math.ceil(album.photoIds.length/2))return Promise.resolve(null);
    const key=`${album.id}:${spread}`;
    if(!cache.has(key)){const promise=Promise.all([0,1].map(async side=>{const photo=lookup.get(album.photoIds[spread*2+side]);return photo?{photo,map:await getTexture(photo)}:{photo:null,map:null};})).catch(error=>{cache.delete(key);throw error;});cache.set(key,promise);}
    return cache.get(key);
  }
  function clearExcept(keys){if(!bounded)return;for(const [key,pending] of cache)if(!keys.has(key)){cache.delete(key);pending.then(pages=>pages?.forEach(p=>p.map?.dispose())).catch(()=>{});}}
  function warm(album,spread){clearExcept(new Set([spread-1,spread,spread+1].map(i=>`${album.id}:${i}`)));for(const index of [spread-1,spread+1])prepare(album,index).catch(()=>{});}
  return {prepare,warm,clear(){clearExcept(new Set());}};
}
