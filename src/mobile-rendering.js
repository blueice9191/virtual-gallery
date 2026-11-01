export function imageURL(photo,maxSize){
  const src=photo.displaySrc||photo.src;
  if(!/^https:\/\/res\.cloudinary\.com\//.test(src))return src;
  return src.replace(/\/upload\/(?:[^/]*,[^/]*\/)?/,`/upload/c_limit,w_${maxSize},h_${maxSize},q_auto,f_auto/`);
}
export function nearbyDisplays(items,position,limit=24){
  return items.map(item=>({item,d:Math.hypot(item.slot.x-position.x,item.slot.z-position.z),dy:Math.abs(item.slot.y-position.y)}))
    .filter(v=>v.dy<4&&v.d<19).sort((a,b)=>a.d-b.d).slice(0,limit).map(v=>v.item);
}
// A bounded queue. Stale requests are disposed instead of attaching to old rooms.
export function createWallStream(load,release,concurrency=2){
  let entries=[],wanted=new Set(),active=0,disposed=false;
  const loaded=new Map(),pending=new Set(),failed=new Set();
  function pump(){
    if(disposed)return;
    for(const entry of entries){
      if(active>=concurrency)break;
      if(!wanted.has(entry)||loaded.has(entry)||pending.has(entry)||failed.has(entry))continue;
      active++;pending.add(entry);
      Promise.resolve().then(()=>load(entry.photo)).then(texture=>{
        if(disposed||!wanted.has(entry)){release(texture);return;}
        loaded.set(entry,texture);entry.material.map=texture;entry.material.needsUpdate=true;entry.group.visible=true;
      }).catch(()=>{failed.add(entry);}).finally(()=>{active--;pending.delete(entry);pump();});
    }
  }
  return {
    update(next){entries=next;wanted=new Set(next);for(const [entry,texture] of loaded)if(!wanted.has(entry)){entry.group.visible=false;entry.material.map=null;entry.material.needsUpdate=true;release(texture);loaded.delete(entry);}pump();},
    async ready(){while(active||entries.some(e=>!loaded.has(e)&&!pending.has(e)&&!failed.has(e))){await new Promise(resolve=>setTimeout(resolve,30));if(!active)break;}},
    dispose(){disposed=true;wanted.clear();for(const [entry,texture] of loaded){entry.material.map=null;entry.group.visible=false;release(texture);}loaded.clear();},
    get size(){return loaded.size;}
  };
}
