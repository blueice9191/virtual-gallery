export function folderFromPath(path){const parts=path.replaceAll('\\','/').split('/').filter(Boolean);return parts.length>2?parts[1]:'Collection';}
export function albumsFromCatalog(catalog){return [...new Set(catalog.photos.map(p=>p.folder||p.theme||'Collection'))].filter(f=>f!=='Favorite').sort().map(name=>({id:`album-${name}`,name,photoIds:catalog.photos.filter(p=>(p.folder||p.theme||'Collection')===name).map(p=>p.id)}));}
export function validateCatalog(catalog){
  if(!catalog||!Array.isArray(catalog.photos)||!catalog.photos.length)throw Error('The source contains no photographs.');
  const ids=new Set();for(const p of catalog.photos){if(!p.id||ids.has(p.id)||!p.src||!(p.width>0&&p.height>0))throw Error('The catalog has missing dimensions or duplicate IDs.');ids.add(p.id);}
  return catalog;
}
export function createSources(){
  let handle=null,lastFiles=null,localURLs=[];
  function database(){return new Promise((resolve,reject)=>{const req=indexedDB.open('grant-gallery-sources',1);req.onupgradeneeded=()=>req.result.createObjectStore('handles');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
  async function storedHandle(save){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('handles',save?'readwrite':'readonly'),store=tx.objectStore('handles'),req=save?store.put(save,'local'):store.get('local');req.onsuccess=()=>resolve(save||req.result);req.onerror=()=>reject(req.error);});}finally{db.close();}}
  async function collect(dir,path=dir.name){const files=[];for await(const [name,item]of dir.entries()){if(item.kind==='directory')files.push(...await collect(item,`${path}/${name}`));else files.push({file:await item.getFile(),path:`${path}/${name}`});}return files;}
  async function importFiles(files,onProgress=()=>{}){
    const selected=files.filter(({file})=>/\.(jpe?g|png|webp|avif)$/i.test(file.name)),photos=[],nextURLs=[];let complete=0;
    if(!selected.length)throw Error('Choose a root folder containing JPEG, PNG, WebP or AVIF photographs.');
    try{for(const {file,path}of selected){
      const bitmap=await createImageBitmap(file),folder=folderFromPath(path),name=file.name.replace(/\.[^.]+$/,''),hash=await crypto.subtle.digest('SHA-256',await file.arrayBuffer()),contentKey=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join(''); // taste-skill-ignore: fixed-width SHA-256 hexadecimal bytes, not UI numbering
      const original=URL.createObjectURL(file);nextURLs.push(original);
      const resize=async max=>{const scale=Math.min(1,max/bitmap.width),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));if(!blob)throw Error('Could not prepare a local photograph.');const url=URL.createObjectURL(blob);nextURLs.push(url);return url;};
      const p={id:`local:${path}`,folder,theme:folder,title:name,alt:`${folder}: ${name}`,width:bitmap.width,height:bitmap.height,contentKey,src:original,displaySrc:await resize(folder.startsWith('Panorama')?4096:1600),thumbnail:await resize(384)};bitmap.close();if(folder==='Favorite')p.favoriteFor=name.replace(/_A$/,'');photos.push(p);onProgress(++complete,selected.length);
    }}catch(error){nextURLs.forEach(u=>URL.revokeObjectURL(u));throw error;}
    const versionData=photos.map(p=>[p.id,p.contentKey]).sort((a,b)=>a[0].localeCompare(b[0])),hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(versionData))),version=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join(''); // taste-skill-ignore: fixed-width SHA-256 hexadecimal bytes, not UI numbering
    const folders={};for(const p of photos)folders[p.folder]=(folders[p.folder]||0)+1;
    const previous=localURLs;localURLs=nextURLs;setTimeout(()=>previous.forEach(u=>URL.revokeObjectURL(u)),60000);
    return {version:`local-${version}`,photos,folders,favoritePhotoIds:photos.filter(p=>p.folder==='Favorite').map(p=>p.id),sourceName:handle?.name||selected[0].path.split('/')[0]};
  }
  return {
    supportsPicker:typeof window.showDirectoryPicker==='function',
    async choose(onProgress){handle=await window.showDirectoryPicker({mode:'read'});try{await storedHandle(handle);}catch{}lastFiles=null;return importFiles(await collect(handle),onProgress);},
    async fromInput(files,onProgress){handle=null;lastFiles=Array.from(files,f=>({file:f,path:f.webkitRelativePath||f.name}));return importFiles(lastFiles,onProgress);},
    async restore(){try{handle=await storedHandle();if(handle&&await handle.queryPermission({mode:'read'})==='granted')return await importFiles(await collect(handle));}catch{}return null;},
    async resync(onProgress){if(!handle&&!lastFiles)try{handle=await storedHandle();}catch{}if(handle){if(await handle.queryPermission({mode:'read'})!=='granted'&&await handle.requestPermission({mode:'read'})!=='granted')throw Error('Local folder permission was not granted.');return importFiles(await collect(handle),onProgress);}if(lastFiles)throw Error('This browser needs the root folder selected again to see added or removed files.');throw Error('Choose a local root folder first.');},
  };
}
