import test from 'node:test';import assert from 'node:assert/strict';
import {buildCloudCatalog} from '../server/cloudinary.mjs';import {createMuseumServer} from '../server.mjs';
import {folderFromPath,albumsFromCatalog,validateCatalog} from '../src/sources.js';import {stickVector,createTouchSticks} from '../src/touch-sticks.js';
const asset=(id,folder)=>({public_id:id,asset_folder:folder,display_name:id,resource_type:'image',type:'upload',version:1,format:'jpg',width:1500,height:1000,etag:'same-hash'});
test('Cloudinary import respects dynamic folders and preserves content keys across filenames',()=>{
 const a=buildCloudCatalog([asset('Scenery_A','Favorite'),asset('image-1','Scenery'),asset('wide','Panorama_Scenery')],'example');
 assert.equal(a.photos.find(p=>p.id==='Scenery_A').favoriteFor,'Scenery');assert.equal(a.photos.find(p=>p.id==='image-1').contentKey,'same-hash');assert.equal(a.photos.length,3);assert.equal(albumsFromCatalog(a).length,2);
 assert.equal(buildCloudCatalog([asset('image-1','Scenery')],'example').version,buildCloudCatalog([asset('image-1','Scenery')],'example').version);
});
test('local root grouping uses child folders, and malformed or duplicate catalog IDs fail',()=>{
 assert.equal(folderFromPath('Root/Scenery/nested/image.JPG'),'Scenery');assert.equal(folderFromPath('Root/image.JPG'),'Collection');assert.throws(()=>validateCatalog({photos:[]}));
 assert.throws(()=>validateCatalog({photos:[{id:'a',src:'/x',width:2,height:2},{id:'a',src:'/y',width:2,height:2}]}));
});
test('joystick axes have a dead zone and bounded analog strength without changing unrelated axes',()=>{
 assert.deepEqual(stickVector(1,1),{x:0,y:0});assert.deepEqual(stickVector(0,0),{x:0,y:0});const right=stickVector(100,0);assert.equal(right.x,1);assert.equal(right.y,0);const forward=stickVector(0,-30);assert.equal(forward.x,0);assert.ok(forward.y<0&&forward.y>-1);const diagonal=stickVector(100,100);assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.y)-1)<1e-10);
});
test('local Cloudinary connector keeps credentials out of status and paginates a live resync',async t=>{
 let pages=0;const server=createMuseumServer({env:{},fetchAPI:async(url,options)=>{assert.ok(String(url).startsWith('https://api.cloudinary.com/'));assert.equal(options.headers.Authorization,'Basic '+Buffer.from('key:secret').toString('base64'));const u=new URL(url);if(u.searchParams.get('max_results')==='1')return Response.json({resources:[asset('a','Scenery')]});pages++;return Response.json(u.searchParams.has('next_cursor')?{resources:[asset('b','Foliage')]}:{resources:[asset('a','Scenery')],next_cursor:'second'});}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();return new Promise(r=>server.close(r));});const base=`http://127.0.0.1:${server.address().port}`;
 let r=await fetch(base+'/api/cloudinary/resync',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,409);
 r=await fetch(base+'/api/cloudinary/connect',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://other.example'},body:'{}'});assert.equal(r.status,403);
 r=await fetch(base+'/api/cloudinary/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cloudName:'example',apiKey:'key',apiSecret:'secret'})});assert.equal(r.status,200);
 const status=await (await fetch(base+'/api/cloudinary/status')).text();assert.ok(!status.includes('secret')&&!status.includes('apiKey'));assert.equal(JSON.parse(status).configured,true);
 r=await fetch(base+'/api/cloudinary/resync',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cloudName:'example'})});const result=await r.json();assert.equal(result.catalog.photos.length,2);assert.equal(pages,2);
});

test('both touch wheels track independent fingers and release without stuck movement',()=>{
 const oldDocument=global.document,oldWindow=global.window;
 const elements={};for(const name of ['move','look'])elements[name]={handlers:{},knob:{style:{}},getBoundingClientRect:()=>({left:0,top:0,width:132,height:132}),setPointerCapture(){},querySelector(){return this.knob;},addEventListener(event,handler){this.handlers[event]=handler;}};
 global.document={hidden:false,addEventListener(){},querySelector(selector){const name=selector.includes('move')?'move':'look';return selector.includes('stick-knob')?elements[name].knob:elements[name];}};global.window={addEventListener(){}};
 try{let intents=0;const sticks=createTouchSticks(()=>intents++),event=(id,x,y)=>({pointerId:id,clientX:x,clientY:y,preventDefault(){},stopPropagation(){}});
 elements.move.handlers.pointerdown(event(1,66,24));elements.look.handlers.pointerdown(event(2,108,66));assert.ok(sticks.values.move.y<0);assert.ok(sticks.values.look.x>0);assert.equal(intents,2);
 elements.look.handlers.pointerup(event(2,108,66));assert.equal(sticks.values.look.x,0);assert.ok(sticks.values.move.y<0);elements.move.handlers.pointercancel(event(1,66,24));assert.deepEqual(sticks.values.move,{x:0,y:0});
 }finally{global.document=oldDocument;global.window=oldWindow;}
});
