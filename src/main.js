import {createVR} from './vr.js';
import {immersiveSupported,walkingLanding} from './vr-policy.js';
import {setupFullscreen} from './fullscreen.js';
import {bookCameraPose,maxBookTilt} from './book-camera.js';
import {frameStyles,frameBorder} from './frames.js';
import {artworkTitle} from './artwork-title.js';
import {imageURL,nearbyDisplays,createWallStream,wallTextureSize} from './mobile-rendering.js';
import { createSources,albumsFromCatalog,validateCatalog } from './sources.js';
import { createTouchSticks } from './touch-sticks.js';
import { preloadPhotos } from './preload.js';
import { exhibitionPlan,folderOf,printGeometry } from './exhibition.js';
import { defaultSettings,normalizeSettings,readSettings,settingsKey } from './settings.js';
import * as THREE from 'three';
import { createPhotoAssets } from './photo-assets.js';
import { rooms, floors, ring, innerRing, slots, polar, canWalk, roomAt, findPath3D, walkSurface, floorAt, entrance, FLOOR_HEIGHT } from './building.js';
import { buildWorld } from './world.js';
import { createBooks } from './books.js';
import { buildTourRoute, TourProgress } from './tour.js';
import { smoothHeading,routeLookAhead,roomSweepYaw } from './tour-camera.js';
import { makeSky } from './materials.js';
import { planExpandedDisplays } from './expanded-displays.js';
import { createVisit, validVisit } from './visit.js';

const $ = id => document.getElementById(id);
const mobile=innerWidth<800||/iPhone|iPad|iPod|Android/i.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&matchMedia('(pointer: coarse)').matches);
let vr,constrained=mobile;
let wallStream,streamEntries=[],streamTime=0,closeupURL;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const keys = new Set();
const state = { entered: false, yaw: 0, pitch: 0, path: [], selected: null, hovered: null, visit: null, photos: [], filter: 'all' };
let scene, camera, renderer, catalog, lastTime = 0, down = null, toastTimer, returnFocus;
const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
const artMeshes = [], floorMeshes = [], occluders = [], artworkGroups = [];
const textureCache = new Map();
let photoAssets = createPhotoAssets();
const toolbarObserver=new ResizeObserver(()=>{document.documentElement.style.setProperty('--toolbar-height',`${document.querySelector('.topbar').getBoundingClientRect().height}px`);if(state.reading)applyBookCamera();});toolbarObserver.observe(document.querySelector('.topbar'));toolbarObserver.observe($('book-reader'));
const sources=createSources();let sticks,pendingSourceBoot;
const displayLocations = new Map();
let viewerRequest = 0;let readingBookPose=null,bookTilt=0;
let skySystem, skyHemi, skySun, books, albums=[], readingPose=null, mapFloor=0;
const tour=new TourProgress();let tourRejoin=[],tourLook=null,tourBuilding=false;
const targetMarker = new THREE.Group();
let siteDefaults={...defaultSettings},settings={...defaultSettings},updateBrand,pendingLogo,updateRoomLabels,updateStatue;let artworkRequest=0,exhibitionLoading=true;
const EYE = 1.7;
const SAVE_KEY = 'twelve-museum-visit-v1';
const entranceYaw = () => innerWidth < 800 ? Math.atan2(entrance.x + 4, entrance.z - 4.4) : entrance.yaw;

function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 3400); }
function activeDialog() { return document.querySelector('dialog[open]'); }
function pause() { sticks?.reset();tour.pause(); updateTourUI(); keys.clear(); state.path = []; targetMarker.visible = false; if (document.pointerLockElement) document.exitPointerLock(); }
function showDialog(id) { pause(); returnFocus = document.activeElement; $(id).showModal(); }
function closeDialog(id) { $(id).close(); (returnFocus?.isConnected ? returnFocus : $('scene')).focus({ preventScroll: true }); }
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => closeDialog(b.dataset.close));
document.querySelectorAll('dialog').forEach(d => {
  d.addEventListener('click', e => { if (e.target === d) { const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close(); } });
  d.addEventListener('close', () => { keys.clear(); if (!vr?.active && state.entered && !activeDialog()) $('scene').focus({ preventScroll: true }); });
});

function material(color, options = {}) { return new THREE.MeshStandardMaterial({ color, roughness: .88, ...options }); }
function box(w, h, d, x, y, z, mat, parent = scene) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z); mesh.receiveShadow = true; mesh.castShadow = true; parent.add(mesh); return mesh;
}
async function loadMobileTexture(photo,entry){const tex=await new THREE.TextureLoader().loadAsync(imageURL(photo,wallTextureSize(entry)));tex.colorSpace=THREE.SRGBColorSpace;tex.generateMipmaps=false;tex.minFilter=THREE.LinearFilter;tex.anisotropy=1;return tex;}
async function getTexture(photo) {
  if(constrained)return loadMobileTexture(photo);
  if (textureCache.has(photo.id)) return textureCache.get(photo.id);
  const promise = photoAssets.source({...photo,id:`${photo.id}:display`,src:photo.displaySrc||photo.src}).then(source => new THREE.TextureLoader().loadAsync(source)).then(tex => { tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return tex; }).catch(error=>{if(textureCache.get(photo.id)===promise)textureCache.delete(photo.id);throw error;});
  textureCache.set(photo.id, promise); return promise;
}
async function hangPhotos() {
  exhibitionLoading=true;$('exhibition-loading').hidden=false;
  const nav=[...document.querySelectorAll('.topbar button')];nav.forEach(b=>b.disabled=true);
  try{
  wallStream?.dispose();streamEntries=[];
  artMeshes.length = 0;
  artworkGroups.forEach(g => { scene.remove(g); g.traverse(o => { o.geometry?.dispose(); if (o.material) { if (o.userData.label) o.material.map?.dispose(); o.material.dispose(); } }); });
  artworkGroups.length = 0;const ticket=++artworkRequest;
  const assignments = planExpandedDisplays(catalog, state.visit);
  const loaded=constrained?{ready:new Map(),failed:[]}:await preloadPhotos(assignments.map(a=>a.photo),async photo=>{const texture=await getTexture(photo);renderer.initTexture(texture);return texture;},(done,total)=>{$('exhibition-progress').textContent=`${done} / ${total} artworks ready`;$('exhibition-bar').max=Math.max(1,total);$('exhibition-bar').value=done;});
  if(ticket!==artworkRequest)return;
  displayLocations.clear();const plan=exhibitionPlan(catalog,state.visit);
  if(plan){$('collection-summary').textContent=`Floor 1: ${plan.floors[0]} · Floor 2: ${plan.floors[1]} · Floor 3: ${plan.floors[2]}`;}
  for (const { slot, photo, label: locationLabel } of assignments) {
    const texture=loaded.ready.get(photo.id);if(!texture&&!constrained)continue;
    if (!displayLocations.has(photo.id) || slot.area === 'favorites') displayLocations.set(photo.id, locationLabel);

    const geometry=printGeometry(photo,slot,settings.margin),w=geometry.width,h=geometry.height;
    const group = new THREE.Group(); group.position.set(slot.x, slot.y, slot.z); group.rotation.y = Math.atan2(slot.normal.x, slot.normal.z); scene.add(group); artworkGroups.push(group);
    const frameStyle=frameStyles[settings.frameColor];const frame=box(geometry.outerWidth+2*frameBorder,geometry.outerHeight+2*frameBorder,.09,0,0,0,material(frameStyle.color,frameStyle),group);frame.userData.artFrame=true;
    if(geometry.mat)box(geometry.outerWidth,geometry.outerHeight,.012,0,0,.051,new THREE.MeshBasicMaterial({color:'#ffffff'}),group);
    const image = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({map:texture})); image.position.z = .064; image.userData.photo = photo; image.userData.location = locationLabel; image.userData.sequenceIds = assignments.filter(a=>a.slot.room===slot.room&&a.slot.area===slot.area).map(a=>a.photo.id); group.add(image); artMeshes.push(image);if(constrained){group.visible=false;streamEntries.push({slot,photo,group,material:image.material});}

  }
  if(constrained){wallStream=createWallStream(loadMobileTexture,t=>t.dispose());wallStream.update(nearbyDisplays(streamEntries,camera.position));$('exhibition-progress').textContent='Preparing nearby galleries…';await wallStream.ready();}
  scene.updateMatrixWorld(true);
  renderer.shadowMap.needsUpdate=true;
  if(loaded.failed.length)toast(`${loaded.failed.length} artworks could not load. New visit will retry them; no empty frames are displayed.`);
  }finally{exhibitionLoading=false;$('exhibition-loading').hidden=true;nav.forEach(b=>b.disabled=false);}
}
function buildMap() {
  const ns='http://www.w3.org/2000/svg';$('map-shapes').replaceChildren();$('room-links').replaceChildren();
  $('map-floor').value=String(mapFloor);$('map-description').textContent=`Floor ${mapFloor+1} · ${mapFloor===2?'Six double-width panorama galleries':'Twelve connected galleries'}`;
  function polygon(poly,fill){const el=document.createElementNS(ns,'polygon');el.setAttribute('points',poly.map(p=>`${p.x*10},${p.z*10}`).join(' '));el.setAttribute('fill',fill);el.setAttribute('stroke','#f8f9f6');el.setAttribute('stroke-width','3');$('map-shapes').append(el);}
  function label(x,z,text,size=20){const el=document.createElementNS(ns,'text');el.setAttribute('x',x*10);el.setAttribute('y',z*10);el.setAttribute('font-size',size);el.setAttribute('text-anchor','middle');el.textContent=text;$('map-shapes').append(el);}
  polygon(ring,'#d1d7cb');if(mapFloor)polygon(innerRing,'#f0f2ed');
  rooms.filter(r=>r.floor===mapFloor).forEach(r=>{polygon(r.polygon,r.panorama?'#becdbb':'#c2cebc');const p=polar(18,r.angle);label(p.x,p.z,String(r.index+1),25);});
  polygon([{x:5,z:-4.2},{x:9,z:-4.2},{x:9,z:4.7},{x:5,z:4.7}],'#8fa68c');label(7,.5,'Stairs',16);label(-3,1,mapFloor?'Open atrium':'Atrium',18);
  for(const r of rooms.filter(r=>r.floor===mapFloor)){const b=document.createElement('button');b.textContent=`${r.index+1}. ${r.name}`;const small=document.createElement('span');small.textContent=r.subtitle;b.append(small);b.onclick=()=>{enter();gotoRoom(r.id);closeDialog('map-dialog');};$('room-links').append(b);}
  const atriumButton=document.createElement('button');atriumButton.textContent='Atrium & stairs';const atriumDetail=document.createElement('span');atriumDetail.textContent=mapFloor?'View the open atrium from the balcony':'Return to the entrance';atriumButton.append(atriumDetail);atriumButton.onclick=()=>{enter();pause();if(mapFloor){camera.position.set(11,mapFloor*FLOOR_HEIGHT+EYE,3.9);state.yaw=Math.atan2(11,3.9);state.pitch=-.32;updateCamera();updateLocation();}else gotoRoom('atrium');closeDialog('map-dialog');};$('room-links').append(atriumButton);
  const playerFloor=camera?floorAt(camera.position.y-EYE):0;$('map-player').style.display=playerFloor===mapFloor?'':'none';
}
$('map-floor').onchange=()=>{mapFloor=Number($('map-floor').value);buildMap();};
function gotoRoom(id) {
  if(state.reading)return;pause();const room=rooms.find(r=>r.id===id);
  if(room){const p=room.visit,display=slots.find(s=>s.room===room.id&&s.wall==='outer');camera.position.set(p.x,EYE+room.floor*FLOOR_HEIGHT,p.z);state.yaw=Math.atan2(p.x-display.x,p.z-display.z);}
  else {camera.position.set(entrance.x,EYE,entrance.z);state.yaw=entranceYaw();}
  state.pitch=0;updateCamera();updateLocation();
}
function feet(){return {x:camera.position.x,z:camera.position.z,y:camera.position.y-EYE};}
function updateLocation(){
  if(!camera)return;const p=feet(),floor=floorAt(p.y),room=roomAt(p.x,p.z,floor),onStairs=Math.abs(p.y-floor*FLOOR_HEIGHT)>.25;
  $('location-name').textContent=state.reading?'The album desk':onStairs?'The staircase':room?.name||(floor===0&&p.x<.5&&p.z>4.4?'The display panel':'The atrium');
  $('location-detail').textContent=state.reading?'Floor 1 · Album open on the desk':onStairs?`Between floors · ${p.y.toFixed(1)} m`:`Floor ${floor+1} · ${room?.subtitle||(floor===2?'Panorama galleries':'Explore at your own pace')}`;
  $('scene').dataset.floor=String(floor+1);$('map-player').setAttribute('cx',p.x*10);$('map-player').setAttribute('cy',p.z*10);$('map-player').style.display=floor===mapFloor?'':'none';
}
function applyBookCamera(){if(!readingBookPose)return;const top=document.querySelector('.topbar').getBoundingClientRect().height+16,bottom=$('book-reader').hidden?100:$('book-reader').getBoundingClientRect().height+16,safeHeight=Math.max(120,innerHeight-top-bottom),safeFov=2*Math.atan(Math.tan(camera.fov*Math.PI/360)*safeHeight/innerHeight)*180/Math.PI;camera.setViewOffset(innerWidth,innerHeight,0,(bottom-top)/2,innerWidth,innerHeight);const pose=bookCameraPose(readingBookPose,innerWidth/safeHeight,safeFov,bookTilt);bookTilt=pose.tilt;camera.position.set(pose.x,pose.y,pose.z);state.yaw=pose.yaw;state.pitch=pose.pitch;updateCamera();$('book-angle').textContent=`View: ${Math.round(bookTilt*180/Math.PI)}° tilt · ↑ overhead / ↓ tilt (max 30°)`;}
function updateCamera() { if(vr?.active)return;camera.rotation.set(state.pitch, state.yaw, 0, 'YXZ'); }
function loadVisit() {
  let saved; try { saved = JSON.parse(sessionStorage.getItem(SAVE_KEY)); } catch { /* Storage may be unavailable. */ }
  state.visit = validVisit(saved, catalog) ? saved : createVisit(catalog);
  saveVisit();applyExhibitionLabels();
}
function applyExhibitionLabels(){const plan=exhibitionPlan(catalog,state.visit);if(!plan)return;for(const room of rooms){room.name=`${plan.floors[room.floor]||'Gallery'} · ${room.index+1}`;room.subtitle=`${plan.floors[room.floor]||'No collection'}${room.floor===2?` · Small walls: ${plan.filler||'none'}`:''}`;}updateRoomLabels?.();}
function saveVisit() { try { sessionStorage.setItem(SAVE_KEY, JSON.stringify(state.visit)); } catch { toast('This browser cannot save visits. Refreshing will start a new arrangement.'); } }
function buildCollectionFilters(){
  $('filters').replaceChildren();for(const [id,name] of [['all','All artworks'],['favorites','Favorites'],...[...new Set(catalog.photos.map(folderOf))].filter(f=>f!=='Favorite').sort().map(f=>[f,f])]){const b=document.createElement('button');b.dataset.filter=id;b.textContent=name;b.setAttribute('aria-pressed',String(state.filter===id));$('filters').append(b);}
}
function renderCollection() {
  const photos = catalog.photos.filter(p => state.filter === 'all' || (state.filter === 'favorites' ? catalog.favoritePhotoIds?.includes(p.id) : folderOf(p) === state.filter));
  $('collection-summary').textContent = `${photos.length} ${photos.length === 1 ? 'artwork' : 'artworks'} · ${catalog.photos.some(p=>p.folder)?'Cloudinary collection':'Sample collection'}`;
  $('collection-grid').replaceChildren();
  for (const photo of photos) {
    const button = document.createElement('button'); button.className = 'collection-item';
    const img = document.createElement('img'); img.alt = photo.alt;
    img.loading='lazy';img.decoding='async';img.src=photo.thumbnail||photo.src;
    const title = document.createElement('strong'); title.textContent = artworkTitle(photo);title.hidden=!title.textContent;
    const theme = document.createElement('span'); theme.textContent = displayLocations.get(photo.id) || ({autumn:'Autumn studies',water:'Along the water',country:'Open country'}[photo.theme] || folderOf(photo));
    button.append(img, title, theme); button.onclick = () => openPhoto(photo); $('collection-grid').append(button);
  }
}
async function openPhoto(photo,locationLabel=null,sequenceIds=null) {
  if(vr?.active){await vr.openArtwork(photo);return;}
  pause(); state.selected = photo;
  const request = ++viewerRequest;
  $('full-photo').hidden = true; $('full-photo').removeAttribute('src'); $('full-photo').alt = photo.alt;
  $('photo-load-status').hidden = false; $('photo-load-status').textContent = 'Loading artwork…'; $('retry-photo').hidden = true;
  $('zoom-photo').disabled = true;
  const caption=artworkTitle(photo);$('photo-title').textContent=caption;$('photo-title').hidden=!caption; $('photo-description').textContent = photo.description || '';
  $('photo-meta').textContent = [photo.dateTaken, photo.location, photo.metadataStatus].filter(Boolean).join(' · ');
  $('viewer-room').textContent = locationLabel || (state.reading?`Album · ${books.reader.album?.name||'Photo album'}`:displayLocations.get(photo.id)) || 'The collection';
  const ids = sequenceIds || (state.reading?books.reader.album.photoIds:state.visit.assignments[photo.theme]); state.viewerIds=ids;state.viewerLocation=$('viewer-room').textContent; $('photo-position').textContent = `${ids.indexOf(photo.id) + 1} / ${ids.length}`;
  $('photo-stage').classList.remove('zoomed'); $('zoom-photo').textContent = 'Zoom in';
  if (!$('photo-dialog').open) showDialog('photo-dialog');
  try {
    let source;if(mobile){const response=await fetch(imageURL(photo,2048));if(!response.ok)throw Error('Image unavailable');const blob=await response.blob();if(request!==viewerRequest)return;source=URL.createObjectURL(blob);if(closeupURL)URL.revokeObjectURL(closeupURL);closeupURL=source;}else source=await photoAssets.source(photo);
    if (request !== viewerRequest) return;
    $('full-photo').src = source;
    await $('full-photo').decode();
    if (request !== viewerRequest) return;
    $('full-photo').hidden = false; $('photo-load-status').hidden = true; $('zoom-photo').disabled = false;
  } catch (error) {
    if (request !== viewerRequest) return;
    $('photo-load-status').textContent = 'This artwork could not load. Keep the local museum server running and try again.';
    $('retry-photo').hidden = false;
  }
}
$('retry-photo').onclick = () => openPhoto(state.selected);
function adjacentPhoto(direction) { const ids=state.viewerIds,i=ids.indexOf(state.selected.id);openPhoto(catalog.photos.find(p=>p.id===ids[(i+direction+ids.length)%ids.length]),state.viewerLocation,ids); }
$('previous-photo').onclick = () => adjacentPhoto(-1); $('next-photo').onclick = () => adjacentPhoto(1);
$('photo-dialog').addEventListener('close',()=>{if(mobile){viewerRequest++;$('full-photo').removeAttribute('src');if(closeupURL)URL.revokeObjectURL(closeupURL);closeupURL=null;}});
$('close-photo').onclick = () => closeDialog('photo-dialog');
$('zoom-photo').onclick = () => { const zoom = $('photo-stage').classList.toggle('zoomed'); $('zoom-photo').textContent = zoom ? 'Fit image' : 'Zoom in'; };
$('full-photo').onclick = () => $('zoom-photo').click();
$('map-button').onclick = () => { mapFloor=floorAt(camera.position.y-EYE);buildMap();updateLocation();showDialog('map-dialog'); };
$('collection-button').onclick = () => { renderCollection(); showDialog('collection-dialog'); };
$('help-button').onclick = () => showDialog('help-dialog');
$('settings-button').onclick=()=>{fillSettings();showDialog('settings-dialog');};
function fillSettings(){ $('gallery-name').value=settings.name;$('gallery-subtitle').value=settings.subtitle;$('gallery-logo').value='';pendingLogo=settings.logo;$('sky-preview').value=settings.sky;$('photo-margin').value=settings.margin;$('frame-color').value=settings.frameColor;$('settings-status').textContent='';fillSourceSettings(); }
function fillSourceSettings(){
  $('photo-source').value=settings.source;$('source-cloud-name').value=settings.cloudName;$('source-catalog-url').value=settings.catalogUrl;showSourceOptions();
  $('source-status').textContent=catalog?`${catalog.photos.length} artworks loaded · ${settings.source==='local'?(catalog.sourceName||'Local collection'):'Online collection'}`:'Choose a source to open the gallery.';
}
function showSourceOptions(){$('cloud-account').hidden=!['127.0.0.1','localhost','[::1]'].includes(location.hostname);const connector=document.querySelector('#cloud-source-options details');if(connector)connector.hidden=!['127.0.0.1','localhost','[::1]'].includes(location.hostname);const local=$('photo-source').value==='local';$('local-source-options').hidden=!local;$('cloud-source-options').hidden=local;}
$('photo-source').onchange=showSourceOptions;
async function cloudAPI(action,data){
  if(!['127.0.0.1','localhost','[::1]'].includes(location.hostname))throw Error('Live Cloudinary administration is available on the local preview. Use a public catalog URL on a static hosted site.');
  const response=await fetch(`/api/cloudinary/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});let body;try{body=await response.json();}catch{throw Error('The Cloudinary connector is unavailable here. Use START_MUSEUM.cmd locally, or provide a public catalog URL.');}if(!response.ok)throw Error(body.error||'Cloudinary connection failed.');return body;
}
async function acceptSource(next,mode){
  validateCatalog(next);settings.source=mode;persistSettings();
  if(pendingSourceBoot){const resolve=pendingSourceBoot;pendingSourceBoot=null;resolve(next);closeDialog('settings-dialog');return;}
  pause();tour.stop();tourRejoin=[];tourLook=null;books?.dispose();books=null;state.reading=false;$('app').dataset.reading='false';$('book-reader').hidden=true;
  for(const promise of textureCache.values())Promise.resolve(promise).then(texture=>texture.dispose()).catch(()=>{});textureCache.clear();photoAssets.dispose?.();photoAssets=createPhotoAssets();
  catalog=next;albums=albumsFromCatalog(catalog);state.filter='all';$('photo-count').textContent=catalog.photos.length;loadVisit();buildMap();buildCollectionFilters();await hangPhotos();setupAlbums();updateTourUI();fillSourceSettings();
}
async function chooseLocal(){
  try{if(!sources.supportsPicker){$('local-folder-input').click();return;}$('source-status').textContent='Reading local folder…';const next=await sources.choose((done,total)=>{$('source-status').textContent=`Preparing local files ${done} / ${total}`;});await acceptSource(next,'local');$('source-status').textContent=`Local folder connected: ${next.sourceName} · ${next.photos.length} artworks.`;}catch(error){if(error.name!=='AbortError')$('source-status').textContent=error.message;}
}
$('choose-local-folder').onclick=chooseLocal;
$('local-folder-input').onchange=async()=>{try{$('source-status').textContent='Reading selected local files…';const next=await sources.fromInput($('local-folder-input').files,(done,total)=>{$('source-status').textContent=`Preparing local files ${done} / ${total}`;});await acceptSource(next,'local');$('source-status').textContent=`Local folder connected: ${next.sourceName} · ${next.photos.length} artworks.`;}catch(error){$('source-status').textContent=error.message;}finally{$('local-folder-input').value='';}};
$('load-online-catalog').onclick=async()=>{try{$('source-status').textContent='Loading online catalog…';const url=$('source-catalog-url').value.trim()||'/gallery.json',response=await fetch(url,{cache:'no-store'});if(!response.ok)throw Error(`Catalog returned HTTP ${response.status}.`);const next=await response.json();settings.catalogUrl=url==='/gallery.json'?'':url;settings.cloudName=$('source-cloud-name').value.trim()||settings.cloudName;await acceptSource(next,'cloudinary');$('source-status').textContent=`Loaded ${next.photos.length} linked artworks. This is the saved catalog; connect Cloudinary for live resync.`;}catch(error){$('source-status').textContent=error.message;}};
$('connect-cloudinary').onclick=async()=>{
  const secret=$('cloud-api-secret').value,key=$('cloud-api-key').value,cloudName=$('source-cloud-name').value.trim();$('cloud-api-secret').value='';$('cloud-api-key').value='';
  try{$('source-status').textContent='Checking Cloudinary connection…';await cloudAPI('connect',{cloudName,apiKey:key,apiSecret:secret});settings.cloudName=cloudName;persistSettings();$('source-status').textContent='Cloudinary connected to the local server. Click Resync collection to load current folders.';}catch(error){$('source-status').textContent=error.message;}
};
$('disconnect-cloudinary').onclick=async()=>{try{await cloudAPI('disconnect',{});$('source-status').textContent='Cloudinary connection cleared from server memory.';}catch(error){$('source-status').textContent=error.message;}};
$('resync-source').onclick=async()=>{
  $('resync-source').disabled=true;
  try{
    const mode=$('photo-source').value;let next;
    if(mode==='local')next=await sources.resync((done,total)=>{$('source-status').textContent=`Preparing local files ${done} / ${total}`;});
    else{
      settings.cloudName=$('source-cloud-name').value.trim();settings.catalogUrl=$('source-catalog-url').value.trim();settings=normalizeSettings(settings);$('source-status').textContent='Fetching the latest online collection…';
      if(settings.catalogUrl){const response=await fetch(settings.catalogUrl,{cache:'no-store'});if(!response.ok)throw Error(`Catalog returned HTTP ${response.status}.`);next=await response.json();}
      else next=(await cloudAPI('resync',{cloudName:settings.cloudName})).catalog;
    }
    await acceptSource(next,mode);$('source-status').textContent=`Resynced ${next.photos.length} artworks. The exhibition and album list are updated.`;
  }catch(error){$('source-status').textContent=error.message;}finally{$('resync-source').disabled=false;}
};
function applyBranding(){
  const brand=$('home');brand.setAttribute('aria-label',`${settings.name}, return to atrium`);let image=brand.querySelector('img');if(!image){brand.querySelector('svg')?.remove();image=document.createElement('img');image.alt='';brand.prepend(image);}image.src=settings.logo;
  const heading=brand.querySelector('h1');heading.replaceChildren(document.createTextNode(settings.name));const sub=document.createElement('span');sub.textContent=settings.subtitle;heading.append(sub);document.title=`${settings.name} — ${settings.subtitle||'Visual art'}`;document.querySelector('link[rel="icon"]').href=settings.logo;updateBrand?.(settings);
}
function persistSettings(){try{localStorage.setItem(settingsKey,JSON.stringify(settings));return true;}catch{$('settings-status').textContent='Browser storage is unavailable or full. Changes apply for this visit; export to keep them.';return false;}}
$('gallery-logo').onchange=async()=>{
  const file=$('gallery-logo').files[0];if(!file)return;
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024){$('settings-status').textContent='Choose a PNG, JPEG or WebP smaller than 2 MB.';$('gallery-logo').value='';return;}
  try{const bitmap=await createImageBitmap(file),scale=Math.min(1,512/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();pendingLogo=canvas.toDataURL('image/png');$('settings-status').textContent='Logo ready. Save branding to apply.';}catch{$('settings-status').textContent='This image could not be opened.';}
};
$('default-logo').onclick=()=>{pendingLogo=defaultSettings.logo;$('gallery-logo').value='';$('settings-status').textContent='Original GG logo selected. Save branding to apply.';};
$('settings-form').onsubmit=e=>{e.preventDefault();settings=normalizeSettings({...settings,name:$('gallery-name').value,subtitle:$('gallery-subtitle').value,logo:pendingLogo});applyBranding();if(persistSettings())$('settings-status').textContent='Branding saved in this browser.';};
$('regenerate-statue').onclick=()=>{settings.statueSeed=(settings.statueSeed+1)>>>0;updateStatue?.(settings.statueSeed);if(persistSettings())$('statue-status').textContent='New statue saved in this browser.';};
$('export-settings').onclick=()=>{const blob=new Blob([JSON.stringify(settings,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='site.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('reset-settings').onclick=async()=>{const wasLocal=settings.source==='local';settings={...siteDefaults};applyBranding();updateStatue?.(settings.statueSeed);fillSettings();skySystem?.setPreview(settings.sky===''?null:Number(settings.sky));try{if(pendingSourceBoot||wasLocal){const response=await fetch('/gallery.json',{cache:'no-store'});if(!response.ok)throw Error('The default catalog is unavailable.');await acceptSource(await response.json(),'cloudinary');}else if(catalog&&renderer)await hangPhotos();if(persistSettings())$('settings-status').textContent='Site defaults restored.';}catch(error){$('settings-status').textContent=error.message;}};
$('frame-color').onchange=()=>{settings.frameColor=$('frame-color').value;const style=frameStyles[settings.frameColor];for(const group of artworkGroups)group.traverse(o=>{if(o.userData.artFrame){o.material.color.set(style.color);o.material.metalness=style.metalness;o.material.roughness=style.roughness;}});persistSettings();};
$('photo-margin').onchange=async()=>{settings.margin=$('photo-margin').value;persistSettings();await hangPhotos();};
$('sky-preview').onchange=()=>{settings.sky=$('sky-preview').value;skySystem?.setPreview(settings.sky===''?null:Number(settings.sky));persistSettings();};
$('home').onclick = e => { e.preventDefault(); if (camera&&!exhibitionLoading) { enter(); gotoRoom('atrium'); } };
$('filters').onclick = e => { const b = e.target.closest('[data-filter]'); if (!b) return; state.filter = b.dataset.filter; $('filters').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); renderCollection(); };
function enter() { if (!renderer||exhibitionLoading) return; state.entered = true; $('hud').hidden = false; $('scene').focus({ preventScroll: true }); }
setupFullscreen(document,$('fullscreen-button'),toast,{exitButton:$('exit-fullscreen'),edge:$('fullscreen-edge')});
$('new-visit').onclick = async () => {
  pause(); $('new-visit').disabled = true;
  try { state.visit = createVisit(catalog); saveVisit();tour.stop();tourRejoin=[];applyExhibitionLabels();buildMap();await hangPhotos(); toast('A new visit. New folder exhibitions and artwork placements are ready.'); }
  finally { $('new-visit').disabled = false; }
};
$('mouse-lock').onclick = async () => { enter(); try { await renderer.domElement.requestPointerLock(); } catch { toast('Mouse look is unavailable here. Drag the scene to look around.'); } };
document.addEventListener('pointerlockchange', () => { $('reticle').hidden = !document.pointerLockElement; $('mouse-lock').textContent = document.pointerLockElement ? 'Escape to release' : 'Mouse look'; keys.clear(); });

function rayAt(x, y) {
  const rect = renderer.domElement.getBoundingClientRect(); pointer.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
  camera.updateMatrixWorld(); raycaster.setFromCamera(pointer, camera);
}
function interactionHit() {
  const hits = raycaster.intersectObjects([...artMeshes.filter(o=>o.parent.visible), ...(books?.pickables.filter(o=>{let p=o;while(p){if(!p.visible)return false;p=p.parent;}return true;})||[]), ...occluders], false);
  return hits[0]?.distance<18?hits[0]:null;
}
function photoHit(){return interactionHit()?.object.userData.photo || null;
}
function pick(x, y) {
  rayAt(x,y);const hit=interactionHit();if(hit?.object.userData.turnPage){books.turn(hit.object.userData.turnPage);return;}if(hit?.object.userData.album){books.open(hit.object.userData.album);return;}const photo=hit?.object.userData.photo;if(photo){openPhoto(photo,hit.object.userData.location,hit.object.userData.sequenceIds);return;}
  const floor = raycaster.intersectObjects(floorMeshes)[0];
  const wall = raycaster.intersectObjects(occluders)[0];
  if (floor && (!wall || floor.distance < wall.distance)) {
    const destination = {x:floor.point.x,z:floor.point.z,y:floor.point.y};
    if(state.reading)return;pause();
    const path=findPath3D(feet(),destination);
    if (!path.length) { toast('Choose a spot inside the museum.'); return; }
    state.path = path; targetMarker.position.set(destination.x,destination.y+.025,destination.z); targetMarker.visible = true;
  }
}
function bindScene() {
  const canvas = renderer.domElement;
  canvas.addEventListener('pointerdown', e => { if (vr?.active || !state.entered || activeDialog() || e.button !== 0) return; $('scene').focus({ preventScroll: true }); down = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', e => {
    if (vr?.active || !state.entered || activeDialog()) return;
    if(state.reading){if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)down.moved=true;return;}
    if (document.pointerLockElement === canvas) { state.yaw -= e.movementX * .002; state.pitch = THREE.MathUtils.clamp(state.pitch - e.movementY * .002, -.9, .9); }
    else if (down) {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) down.moved = true;
      if (down.moved) { state.yaw -= (e.clientX - down.lastX) * .004; state.pitch = THREE.MathUtils.clamp(state.pitch - (e.clientY - down.lastY) * .003, -.9, .9); }
      down.lastX = e.clientX; down.lastY = e.clientY;
    } else { rayAt(e.clientX, e.clientY); state.hovered = interactionHit(); canvas.style.cursor = (state.hovered?.object.userData.album||state.hovered?.object.userData.turnPage)?'pointer':state.hovered?.object.userData.photo?'zoom-in':'grab'; }
    updateCamera();
  });
  canvas.addEventListener('pointerup', e => { if (down && !down.moved) pick(document.pointerLockElement ? innerWidth / 2 : e.clientX, document.pointerLockElement ? innerHeight / 2 : e.clientY); down = null; });
  canvas.addEventListener('pointercancel', () => down = null);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); pause(); toast('The graphics connection was interrupted. Refresh to reopen the museum.'); });
}
document.addEventListener('keydown', e => {
  if(vr?.active)return;
  if(state.reading&&!activeDialog()){if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();bookTilt=Math.max(0,Math.min(maxBookTilt,bookTilt+(e.key==='ArrowDown'?1:-1)*Math.PI/60));applyBookCamera();return;}if(e.key==='Escape'){books.close();return;}if(e.key==='ArrowRight'){e.preventDefault();books.turn(1);return;}if(e.key==='ArrowLeft'){e.preventDefault();books.turn(-1);return;}return;}
  if (e.key === '?' && !activeDialog()) { showDialog('help-dialog'); return; }
  if ($('photo-dialog').open) { if (e.key === 'ArrowRight') { e.preventDefault(); adjacentPhoto(1); } if (e.key === 'ArrowLeft') { e.preventDefault(); adjacentPhoto(-1); } return; }
  if (!state.entered || activeDialog() || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (e.target.closest('button,a') && e.key === 'Enter') return;
  const controls = ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyQ','KeyE','KeyR','KeyF','ShiftLeft','ShiftRight'];
  if (controls.includes(e.code)) { e.preventDefault();tour.pause();updateTourUI();keys.add(e.code);state.path=[]; targetMarker.visible = false; }
  if (e.key === 'Enter') { rayAt(innerWidth / 2, innerHeight / 2); const hit=interactionHit();if(hit?.object.userData.turnPage){books.turn(hit.object.userData.turnPage);return;}if(hit?.object.userData.album)books.open(hit.object.userData.album);else if(hit?.object.userData.photo)openPhoto(hit.object.userData.photo,hit.object.userData.location,hit.object.userData.sequenceIds); }
});
document.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); down = null; state.path = []; });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
function move(dx, dz) {
  // Small substeps prevent crossing a wall even after a slow frame.
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .12));
  for (let i = 0; i < n; i++) {
    let h=walkSurface(camera.position.x+dx/n,camera.position.z,camera.position.y-EYE);if(h!==undefined){camera.position.x+=dx/n;camera.position.y=h+EYE;}
    h=walkSurface(camera.position.x,camera.position.z+dz/n,camera.position.y-EYE);if(h!==undefined){camera.position.z+=dz/n;camera.position.y=h+EYE;}
  }
}
function animate(time) {
  const dt = Math.min((time - lastTime) / 1000 || 0, .05); lastTime = time;
  books?.update(dt);if(constrained&&wallStream&&!vr?.transitioning&&(!vr?.active||renderer.xr.isPresenting)&&time-streamTime>400){streamTime=time;wallStream.update(nearbyDisplays(streamEntries,vr?.active?vr.headPosition():camera.position));}
  vr?.update(dt);
  if (!vr?.active && state.entered && !activeDialog() && !state.reading && !tourBuilding && !exhibitionLoading) {
    let forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'))-(sticks?.values.move.y||0);
    let side = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'))+(sticks?.values.move.x||0);
    state.yaw += (Number(keys.has('KeyQ')) - Number(keys.has('KeyE'))) * dt * 1.4-(sticks?.values.look.x||0)*dt*1.5;
    state.pitch = THREE.MathUtils.clamp(state.pitch + (Number(keys.has('KeyR')) - Number(keys.has('KeyF'))) * dt-(sticks?.values.look.y||0)*dt*1.2, -.9, .9);
    updateCamera();
    if (forward || side) { const len = Math.max(1,Math.hypot(forward, side)), speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 5 : 3; forward /= len; side /= len; move((side * Math.cos(state.yaw) - forward * Math.sin(state.yaw)) * dt * speed, (-side * Math.sin(state.yaw) - forward * Math.cos(state.yaw)) * dt * speed); }
    advanceTour(dt);
    if (state.path.length && tour.status!=='running') {
      const p = state.path[0], dx = p.x - camera.position.x, dz = p.z - camera.position.z, distance = Math.hypot(dx, dz);
      if (distance < .12) state.path.shift();
      else {
        const before = camera.position.clone(); move(dx / distance * Math.min(3 * dt, distance), dz / distance * Math.min(3 * dt, distance));
        if (camera.position.distanceTo(before) < .0001) { state.path = []; toast('The route is blocked. Choose a spot beside the bench.'); }
        // Manual walking preserves the chosen yaw and pitch; only explicit look input turns the view.
      }
      if (!state.path.length) targetMarker.visible = false;
    }
    updateLocation();rayAt(innerWidth/2,innerHeight/2);const hit=interactionHit(),data=hit?.object.userData;$('hover-hint').hidden=!data?.photo&&!data?.album&&!data?.turnPage;$('hover-hint').textContent=data?.turnPage?(data.turnPage>0?'Next pages':'Previous pages'):data?.album?`Read ${data.album.name} · Enter`:'View artwork · Enter';
  }
  const skyLabel = skySystem?.update(time, skyHemi, skySun);
  if(skyLabel)renderer.shadowMap.needsUpdate=true;
  if (skyLabel) $('sky-status').textContent = `${skyLabel} · ${$('sky-preview').value === '' ? 'Following your computer’s local clock' : 'Preview'}`;
  renderer.render(scene, camera);
}
async function boot() {
  try{const response=await fetch('/site.json',{cache:'no-store'});if(response.ok)siteDefaults=normalizeSettings(await response.json());}catch{}
  try{settings=readSettings(localStorage,siteDefaults);}catch{settings={...siteDefaults};}applyBranding();$('tour-speed').value='1';$('sky-preview').value=settings.sky;
  if(settings.source==='local')catalog=await sources.restore();
  else {const response=await fetch(settings.catalogUrl||'/gallery.json',{cache:'no-store'});if(!response.ok)throw Error('The photo catalog is unavailable.');catalog=await response.json();}
  if(!catalog){document.querySelectorAll('.topbar button').forEach(b=>b.disabled=b.id!=='settings-button');clearTimeout(window.museumStartupTimer);exhibitionLoading=false;fillSettings();$('settings-dialog').showModal();catalog=await new Promise(resolve=>pendingSourceBoot=resolve);}
  validateCatalog(catalog);albums=albumsFromCatalog(catalog);
  if (!catalog.photos?.length) throw new Error('Add artworks to public/gallery.json to open the museum.');
  $('photo-count').textContent = catalog.photos.length;
  loadVisit();buildMap();buildCollectionFilters();
  scene = new THREE.Scene(); scene.background = new THREE.Color('#dce6e7'); scene.fog = null;
  const vrSupported=await immersiveSupported();constrained=mobile||vrSupported;
  camera = new THREE.PerspectiveCamera(innerWidth < 800 ? 80 : 66, innerWidth / innerHeight, .08, 110); camera.position.set(entrance.x, EYE, entrance.z); state.yaw = entranceYaw();
  renderer = new THREE.WebGLRenderer({ antialias: !constrained, powerPreference: vrSupported?'high-performance':mobile?'low-power':'high-performance' }); renderer.setPixelRatio(Math.min(devicePixelRatio, constrained?1:1.7)); renderer.setSize(innerWidth, innerHeight); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = !constrained; renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  $('scene').append(renderer.domElement);
  skyHemi = new THREE.HemisphereLight('#eff5ff', '#bbb9a6', 2.5); scene.add(skyHemi); scene.add(new THREE.AmbientLight('#fffdf4', .65));
  const sun = new THREE.DirectionalLight('#fff4dd', 2.3); sun.position.set(7, 18, 10); sun.castShadow = !constrained; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -27, right: 27, top: 27, bottom: -27, near: .1, far: 60 }); sun.shadow.bias = -.0004; sun.shadow.normalBias = .03; scene.add(sun);
  skySun = sun; skySystem = makeSky(scene, reduced);skySystem.setPreview(settings.sky===''?null:Number(settings.sky)); skySystem.update(0,skyHemi,skySun);
  const world=buildWorld(scene,renderer,settings);updateBrand=world.updateBrand;updateStatue=world.updateStatue;updateRoomLabels=world.updateRoomLabels;floorMeshes.push(...world.floorMeshes);occluders.push(...world.occluders);
  const ringMarker=new THREE.Mesh(new THREE.RingGeometry(.22,.3,32),new THREE.MeshBasicMaterial({color:'#216653',side:THREE.DoubleSide}));ringMarker.rotation.x=-Math.PI/2;targetMarker.add(ringMarker);targetMarker.visible=false;scene.add(targetMarker);
  updateCamera();renderer.setAnimationLoop(animate);window.museumBooted=true;clearTimeout(window.museumStartupTimer);
  await hangPhotos();setupAlbums();bindScene();sticks=createTouchSticks(()=>{tour.pause();updateTourUI();state.path=[];targetMarker.visible=false;});updateCamera();
  window.museumBooted = true;
  clearTimeout(window.museumStartupTimer);
  vr=createVR({scene,renderer,camera,button:$('vr-button'),hooks:{
    beforeEnter(){pause();tourBuildToken++;tourBuilding=false;tour.stop();if(state.reading){books.close();books.update(1);}document.querySelectorAll('dialog[open]').forEach(d=>d.close());camera.clearViewOffset();},
    feet:()=>feet(),yaw:()=>state.yaw,canStand:canWalk,
    walkSurface:(x,z,y)=>walkingLanding(x,z,y,walkSurface),
    bookTargets:()=>books?.pickables||[],openBook:album=>books.open(album),turnBook:direction=>books.turn(direction),closeBook(){books?.close();books?.update(1);},artworks:()=>artMeshes,floors:()=>floorMeshes,occluders:()=>occluders,
    async loadArtwork(photo){const texture=await new THREE.TextureLoader().loadAsync(imageURL(photo,2048));texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;return texture;},
    async prepareLanding(point){if(wallStream){wallStream.update(nearbyDisplays(streamEntries,{x:point.x,y:point.y+EYE,z:point.z}));await wallStream.ready();}},
    changed(active){$('app').dataset.vr=String(active);document.querySelectorAll('.topbar button').forEach(b=>b.disabled=active&&b.id!=='vr-button');updateTourUI();if(!active){keys.clear();updateCamera();updateLocation();}},error:toast
  }});
  $('vr-button').hidden=!vrSupported;$('vr-button').disabled=!vrSupported;
  enter();
  window.addEventListener('resize', () => {if(vr?.active)return; camera.fov = innerWidth < 800 ? 80 : 66; camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);if(state.reading)applyBookCamera(); });
  renderer.setAnimationLoop(animate);
  // Read-only state is useful for diagnosing movement and session stability.
  window.museum = { getState: () => ({ position: { x: camera.position.x, z: camera.position.z }, yaw: state.yaw, room: roomAt(camera.position.x,camera.position.z,floorAt(camera.position.y-EYE))?.id || 'atrium', assignments: structuredClone(state.visit.assignments), selectedPhoto: state.selected?.id, pathLength: state.path.length, photoCount:artMeshes.length,floor:floorAt(camera.position.y-EYE)+1,tour:{status:tour.status,index:tour.index,visited:[...tour.visited]},album:books?.reader.album?.id,ready:true }), canWalk:(x,z)=>canWalk(x,z,floorAt(camera.position.y-EYE)) };
}
function updateTourUI(){
  const button=$('tour-button');if(!button)return;
  button.textContent=tourBuilding?'Preparing tour…':tour.status==='running'?'Pause tour':tour.status==='paused'?'Resume tour':tour.status==='complete'?'Restart tour':'Start tour';button.disabled=!!vr?.active||tourBuilding||!!state.reading;
  $('tour-stop').hidden=!['running','paused'].includes(tour.status)&&!tourBuilding;
  $('tour-progress').hidden=tour.status==='idle'&&!tourBuilding;
  $('tour-progress').textContent=tourBuilding?'Planning the route…':tour.status==='complete'?`Tour complete · ${rooms.length} galleries · Back on floor 1`:`${tour.status==='paused'?'Paused · ':''}${tour.visited.length} / ${rooms.length} galleries · ${tour.dwell>0&&tourLook?`Viewing ${tourLook.label}`:tour.target?.label||'The atrium'}`;
  $('tour-progress').dataset.status=tour.status;
}
let tourBuildToken=0;
async function startTour(){
  if(state.reading){toast('Finish or close the album before starting a tour.');return;}
  enter();pause();gotoRoom(rooms[0].id);tour.stop();tourRejoin=[];tourLook=null;tourBuilding=true;const token=++tourBuildToken;updateTourUI();
  try{const route=await buildTourRoute(feet(),(done,total)=>{$('tour-progress').textContent=`Planning gallery routes · ${done} / ${total}`;});if(token!==tourBuildToken)return;tour.start(route);toast(`The tour visits all ${rooms.length} galleries, climbs both staircases, then returns to floor 1.`);}
  catch(error){toast(error.message);console.error(error);}
  finally{if(token===tourBuildToken){tourBuilding=false;updateTourUI();}}
}
function resumeTour(){
  const p=tour.target;if(!p)return;const here=feet();
  if(Math.hypot(here.x-p.x,here.z-p.z,here.y-p.y)>.7){tourRejoin=findPath3D(here,p);if(!tourRejoin.length){toast('Move to a clear floor or stair landing before resuming.');return;}}
  state.path=[];keys.clear();tour.resume();updateTourUI();
}
$('tour-button').onclick=()=>{if(tour.status==='running'){pause();return;}if(tour.status==='paused'){resumeTour();return;}startTour();};
$('tour-stop').onclick=()=>{tourBuildToken++;tourBuilding=false;tour.stop();tourRejoin=[];state.path=[];updateTourUI();};
function facePoint(point,dt,pitch=0,speed=1){
  const desired=Math.atan2(camera.position.x-point.x,camera.position.z-point.z);
  state.yaw=smoothHeading(state.yaw,desired,dt,speed);
  state.pitch+=(pitch-state.pitch)*(1-Math.exp(-3*dt));updateCamera();
}
function advanceTour(dt){
  if(tour.status!=='running')return;
  const speed=Number($('tour-speed').value);
  if(tour.dwell>0){
    tour.dwell=Math.max(0,tour.dwell-dt*speed);
    if(tourLook){
      if(reduced)facePoint(tourLook.look,dt,0,speed);
      else {const elapsed=tourLook.duration-tour.dwell,desired=roomSweepYaw(tourLook.startYaw,elapsed,tourLook.duration);state.yaw+=Math.max(-1.1*speed*dt,Math.min(1.1*speed*dt,(desired-state.yaw)*(1-Math.exp(-6*dt))));state.pitch+=(0-state.pitch)*(1-Math.exp(-3*dt));updateCamera();}
    }
    if(tour.dwell===0)updateTourUI();return;
  }
  let budget=dt*3.2*speed,steps=0;
  while(budget>.001&&tour.status==='running'&&steps++<50){
    const target=tourRejoin.length?tourRejoin[0]:tour.target;if(!target){tour.status='complete';updateTourUI();return;}
    const p=feet(),dx=target.x-p.x,dz=target.z-p.z,dist=Math.hypot(dx,dz);
    if(dist<.08&&Math.abs(p.y-target.y)<.3){
      if(tourRejoin.length)tourRejoin.shift();
      else {
        tour.arrive();
        if(target.arrival){tourLook={...target.arrival,startYaw:state.yaw,duration:reduced?3:target.arrival.dwell};if(reduced&&tour.dwell)tour.dwell=3;}
        updateTourUI();if(tour.dwell>0)break;
      }
      continue;
    }
    const amount=Math.min(.12,dist,budget),before=camera.position.clone();
    if(dist>.001)move(dx/dist*amount,dz/dist*amount);
    if(camera.position.distanceTo(before)<.0001){tour.pause();updateTourUI();toast('Tour paused at an obstruction. Resume to reconnect to the route.');return;}
    budget-=amount;
  }
  if(tour.status==='running'&&tour.dwell===0){
    const path=tourRejoin.length?tourRejoin:tour.route,index=tourRejoin.length?0:tour.index;
    const ahead=routeLookAhead(path,index,feet(),3.5),deltaY=(ahead.y??feet().y)-feet().y;
    facePoint(ahead,dt,deltaY>.08?.1:deltaY<-.08?-.1:0,speed);
  }
}
function setupAlbums(){
  books=createBooks(scene,albums,catalog.photos,getTexture,{
    loading(message){toast(message);},
    opened(album,bookPose){if(vr?.active){readingPose=null;return;}pause();readingPose={position:camera.position.clone(),yaw:state.yaw,pitch:state.pitch};state.reading=true;$('app').dataset.reading='true';readingBookPose=bookPose;bookTilt=0;applyBookCamera();$('book-reader').hidden=false;applyBookCamera();$('album-title').textContent=album.name;$('hover-hint').hidden=true;updateLocation();updateTourUI();},
    changed(reader){if(!reader.album){$('book-reader').hidden=true;return;}$('album-pages').textContent=`Pages ${reader.spread*2+1}–${Math.min(reader.spread*2+2,reader.album.photoIds.length)} of ${reader.album.photoIds.length}`;$('book-prev').disabled=reader.spread===0;$('book-next').textContent=reader.last?'Finish & return book':'Turn page →';for(let i=0;i<2;i++){$(`book-photo-${i}`).disabled=!reader.pages[i];}},
    closed(){if(vr?.active){readingPose=null;return;}camera.clearViewOffset();readingBookPose=null;state.reading=false;$('app').dataset.reading='false';$('book-reader').hidden=true;if(readingPose){camera.position.copy(readingPose.position);state.yaw=readingPose.yaw;state.pitch=readingPose.pitch;updateCamera();}updateLocation();updateTourUI();$('scene').focus({preventScroll:true});},
  },reduced,constrained);
  $('album-list').replaceChildren();
  for(const album of albums){const b=document.createElement('button');b.className='album-choice';b.textContent=album.name;const detail=document.createElement('span');detail.textContent=`${album.photoIds.length} artworks · Read on the desk`;b.append(detail);b.onclick=()=>{closeDialog('albums-dialog');enter();books.open(album);};$('album-list').append(b);}
}
$('albums-button').onclick=()=>showDialog('albums-dialog');
$('go-desk').onclick=()=>{closeDialog('albums-dialog');enter();pause();camera.position.set(innerWidth<800?-3.7:-4.15,EYE,-1.1);state.yaw=Math.PI;state.pitch=-.03;updateCamera();updateLocation();};
$('book-prev').onclick=()=>books.turn(-1);$('book-next').onclick=()=>books.turn(1);$('book-close').onclick=()=>books.close();
for(let i=0;i<2;i++)$(`book-photo-${i}`).onclick=()=>{const id=books.reader.pages[i],photo=catalog.photos.find(p=>p.id===id);if(photo)openPhoto(photo);};
boot().catch(error => { clearTimeout(window.museumStartupTimer); console.error(error); $('error').hidden = false; $('error-detail').textContent = `${error.message} Use a current browser with WebGL 2 enabled, and launch the museum through its local server.`; });
