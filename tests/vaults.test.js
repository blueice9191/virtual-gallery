import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {rooms,inPolygon,FLOOR_HEIGHT} from '../src/building.js';
import {vaultBays,vaultPoint,vaultSpring,vaultRise,addVaultedRoom,createVaultMaterials} from '../src/vaults.js';
test('vault bays fit every existing room and remain below the next walking floor',()=>{
 let bays=0;
 for(const room of rooms){const layout=vaultBays(room);assert.equal(layout.length,room.panorama?2:1);bays+=layout.length;
  for(const bay of layout)for(let i=0;i<=40;i++)for(const t of [0,.5,1]){const u=-1+i/20,p=vaultPoint(bay,u,t,vaultSpring+vaultRise*Math.sqrt(Math.max(0,1-u*u)));assert.ok(inPolygon(p.x,p.z,room.polygon),`${room.id} ${JSON.stringify(p)}`);assert.ok(p.y>=4.7&&p.y<FLOOR_HEIGHT-.3);}
 }
 assert.equal(bays,36);
});
test('vaulted rooms use shared materials, bounded geometry and no per-room lights',()=>{
 const root=new THREE.Group(),materials=createVaultMaterials();let triangles=0,lights=0;
 for(const room of rooms)addVaultedRoom(root,room,materials);
 root.traverse(o=>{if(o.isLight)lights++;if(o.isMesh){assert.equal(o.userData.static,true);triangles+=o.geometry.index.count/3;for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));}});
 assert.equal(lights,0);assert.ok(triangles<12000,triangles);assert.equal(root.children.length,30);
});
