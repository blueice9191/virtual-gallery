import {createHash} from 'node:crypto';
export function buildCloudCatalog(resources,cloudName){
  const photos=resources.filter(r=>r.resource_type==='image'&&r.type==='upload'&&!r.access_control?.length).map(r=>{
    const folder=(r.asset_folder||r.folder||r.public_id.split('/').slice(0,-1).join('/')||'Collection').split('/')[0],title=r.display_name||r.public_id.split('/').at(-1),path=r.public_id.split('/').map(encodeURIComponent).join('/'),tail=`v${r.version}/${path}.${r.format}`,prefix=`https://res.cloudinary.com/${cloudName}/image/upload/`;
    const p={id:r.public_id,publicId:r.public_id,folder,theme:folder,filename:r.display_name||r.original_filename||r.public_id.split('/').at(-1),title,alt:`${folder}: ${title}`,width:r.width,height:r.height,src:r.secure_url||prefix+tail,displaySrc:prefix+`c_limit,w_${folder.startsWith('Panorama')?4096:1600},q_auto,f_auto/`+tail,thumbnail:prefix+'c_limit,w_384,q_auto,f_auto/'+tail,contentKey:r.etag?.replaceAll('"','')||null};if(folder==='Favorite')p.favoriteFor=title.replace(/(?:_A)?\.(?:jpe?g|png|webp)$/i,'').replace(/_A$/,'');return p;
  }).filter(p=>p.width>0&&p.height>0).sort((a,b)=>a.id.localeCompare(b.id));
  const version=createHash('sha256').update(JSON.stringify(photos)).digest('hex').slice(0,20),folders={};for(const p of photos)folders[p.folder]=(folders[p.folder]||0)+1;
  return {version:`cloudinary-${cloudName}-${version}`,cloudName,photos,folders,favoritePhotoIds:photos.filter(p=>p.folder==='Favorite').map(p=>p.id)};
}
export function cloudConnectionFromEnvironment(env=process.env){
  try{if(env.CLOUDINARY_URL){const u=new URL(env.CLOUDINARY_URL);return {cloudName:u.hostname,apiKey:decodeURIComponent(u.username),apiSecret:decodeURIComponent(u.password)};}}catch{}
  if(env.CLOUDINARY_CLOUD_NAME&&env.CLOUDINARY_API_KEY&&env.CLOUDINARY_API_SECRET)return {cloudName:env.CLOUDINARY_CLOUD_NAME,apiKey:env.CLOUDINARY_API_KEY,apiSecret:env.CLOUDINARY_API_SECRET};return null;
}
export async function cloudResources(connection,fetchAPI=fetch,limit=500){
  const all=[];let cursor;
  do{const url=new URL(`https://api.cloudinary.com/v1_1/${connection.cloudName}/resources/image/upload`);url.searchParams.set('max_results',String(limit));if(cursor)url.searchParams.set('next_cursor',cursor);
    const response=await fetchAPI(url,{headers:{Authorization:`Basic ${Buffer.from(`${connection.apiKey}:${connection.apiSecret}`).toString('base64')}`},signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw Error(response.status===401?'Cloudinary rejected the API credentials.':`Cloudinary returned HTTP ${response.status}.`);
    const body=await response.json();all.push(...body.resources||[]);if(limit===1)break;cursor=body.next_cursor;
  }while(cursor);return all;
}
export function makeCloudinaryAPI({fetchAPI=fetch,env=process.env,onCatalog=async()=>{}}={}){
  let connection=cloudConnectionFromEnvironment(env),syncing=false;
  return async function api(req,res){
    if(!req.url.startsWith('/api/cloudinary/'))return false;
    const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    // No cross-origin admin calls. The local preview binds to loopback only.
    const hostname=new URL(`http://${req.headers.host}`).hostname;if(!['127.0.0.1','localhost','[::1]'].includes(hostname)){json(403,{error:'Cloudinary administration is available only on the local server.'});return true;}
    const origin=req.headers.origin;if(origin&&origin!==`http://${req.headers.host}`&&origin!==`https://${req.headers.host}`){json(403,{error:'Cross-origin connection requests are not allowed.'});return true;}
    if(req.method==='GET'&&req.url==='/api/cloudinary/status'){json(200,{configured:!!connection,cloudName:connection?.cloudName||null});return true;}
    if(req.method!=='POST'){json(405,{error:'Use POST.'});return true;}
    if(!req.headers['content-type']?.startsWith('application/json')){json(415,{error:'JSON required.'});return true;}
    try{
      let input='';for await(const chunk of req){input+=chunk;if(input.length>8192)throw Error('Request too large.');}const data=JSON.parse(input||'{}');
      if(req.url==='/api/cloudinary/connect'){
        if(!/^[a-z0-9_-]+$/i.test(data.cloudName||'')||!data.apiKey||!data.apiSecret)throw Error('Enter the cloud name, API key and API secret.');
        const candidate={cloudName:data.cloudName,apiKey:String(data.apiKey),apiSecret:String(data.apiSecret)};await cloudResources(candidate,fetchAPI,1);connection=candidate;json(200,{configured:true,cloudName:connection.cloudName});return true;
      }
      if(req.url==='/api/cloudinary/disconnect'){connection=null;json(200,{configured:false});return true;}
      if(req.url!=='/api/cloudinary/resync'){json(404,{error:'Unknown action.'});return true;}
      if(!connection){json(409,{error:'Connect Cloudinary in Settings first. API credentials stay in local server memory.'});return true;}
      if(data.cloudName&&data.cloudName!==connection.cloudName){json(409,{error:'The cloud name differs from the connected account.'});return true;}
      if(syncing){json(409,{error:'A resync is already running.'});return true;}
      syncing=true;try{const catalog=buildCloudCatalog(await cloudResources(connection,fetchAPI),connection.cloudName);let index=0;await Promise.all(Array.from({length:8},async()=>{while(index<catalog.photos.length){const photo=catalog.photos[index++];if(photo.contentKey)continue;try{const response=await fetchAPI(photo.src,{method:'HEAD',signal:AbortSignal.timeout(20000)});photo.contentKey=response.headers.get('etag')?.replaceAll('\"','')||photo.id;}catch{photo.contentKey=photo.id;}}}));if(!catalog.photos.length)throw Error('No public image uploads were found.');await onCatalog(catalog);json(200,{catalog});}finally{syncing=false;}
    }catch(error){json(400,{error:error.message==='Request too large.'?error.message:error instanceof SyntaxError?'Invalid JSON request.':error.message});}return true;
  };
}
