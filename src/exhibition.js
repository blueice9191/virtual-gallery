export const folderOf=photo=>photo.folder||photo.theme||'Collection';
export function exhibitionPlan(catalog,visit){
  let seed=Number(visit.created)>>>0;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;},pick=list=>list.length?list[Math.floor(random()*list.length)]:null;
  const folders=[...new Set(catalog.photos.map(folderOf))];
  const normal=folders.filter(f=>f!=='Favorite'&&!f.startsWith('Panorama'));
  const first=pick(normal),second=pick(normal.filter(f=>f!==first))||first;
  const panorama=pick(folders.filter(f=>f.startsWith('Panorama')));
  const filler=pick(normal);
  const matched=catalog.photos.find(p=>folderOf(p)==='Favorite'&&(p.favoriteFor||p.title||'').replace(/\.(jpe?g|png|webp|avif|svg)$/i,'').toLowerCase()===first?.toLowerCase());
  const favorite=matched||pick(catalog.photos.filter(p=>folderOf(p)===first))||pick(catalog.photos.filter(p=>folderOf(p)!=='Favorite'));
  return {floors:[first,second,panorama||pick(normal)],filler:panorama?filler:null,favoriteId:favorite?.id};
}
export function printGeometry(photo,slot,margin='none'){
  const aspect=photo.width/photo.height,maxW=slot.maxWidth||2.3,maxH=slot.maxHeight||2.7;
  const narrowHeight=Math.min(maxH/1.2,maxW/(aspect+.2)),mat=narrowHeight*({none:0,narrow:.1,wide:.2}[margin]??0);
  const h=Math.min(maxH-2*mat,(maxW-2*mat)/aspect),w=h*aspect;
  return {width:w,height:h,mat,outerWidth:w+2*mat,outerHeight:h+2*mat};
}
