import * as THREE from 'three';

export const vaultSpring=4.76,vaultRise=.86;
// One shallow barrel per original 30-degree sector; panorama rooms retain two bays.
export function vaultBays(room){
 const count=room.panorama?2:1;
 return Array.from({length:count},(_,i)=>({angle:room.angle-room.span/2+(i+.5)*room.span/count,roomAngle:room.angle,outer:23*Math.cos(room.span/2),inner:13*Math.cos(Math.PI/12)}));
}
export function vaultPoint(bay,u,t,y){
 const delta=bay.angle-bay.roomAngle,k=Math.tan(Math.PI/12),far=bay.outer/(Math.cos(delta)-u*k*Math.sin(delta)),r=THREE.MathUtils.lerp(bay.inner,far,t);
 return new THREE.Vector3(r*Math.cos(bay.angle)-u*r*k*Math.sin(bay.angle),y,r*Math.sin(bay.angle)+u*r*k*Math.cos(bay.angle));
}
function surface(bay,u0,u1,profile,segments=18,tint=false){
 const vertices=[],colors=[],indices=[];
 for(let i=0;i<=segments;i++){const u=THREE.MathUtils.lerp(u0,u1,i/segments);for(const t of [0,1]){const p=vaultPoint(bay,u,t,profile(u));vertices.push(p.x,p.y,p.z);if(tint){const light=.6+.4*Math.pow(1-Math.abs(u),.65);colors.push(light,light*.992,light*.966);}}}
 for(let i=0;i<segments;i++){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));if(tint)g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
export function createVaultMaterials(){return {
 shell:new THREE.MeshStandardMaterial({color:'#ebe9e3',vertexColors:true,roughness:1,side:THREE.DoubleSide,emissive:'#ede8da',emissiveIntensity:.12}),
 diffuser:new THREE.MeshBasicMaterial({color:'#fff9e9',side:THREE.DoubleSide}),
 reflector:new THREE.MeshStandardMaterial({color:'#e5e3db',roughness:.65,metalness:.15,side:THREE.DoubleSide,emissive:'#f5efdc',emissiveIntensity:.32}),
 edge:new THREE.MeshStandardMaterial({color:'#c8c6bb',roughness:.85,side:THREE.DoubleSide})
};}
export function addVaultedRoom(parent,room,materials){
 const group=new THREE.Group();group.name=`Vaulted ceiling ${room.id}`;parent.add(group);
 const add=(geometry,material)=>{const m=new THREE.Mesh(geometry,material);m.userData.static=true;m.userData.vault=true;group.add(m);return m;};
 for(const bay of vaultBays(room)){
  const profile=u=>vaultSpring+vaultRise*Math.sqrt(Math.max(0,1-u*u));
  for(const [a,b] of [[-1,-.025],[.025,1]])add(surface(bay,a,b,profile,22,true),materials.shell);
  add(surface(bay,-.025,.025,()=>5.615,1),materials.diffuser);
  // Two shallow upturned reflector wings soften the crown strip, without extra lights.
  for(const [a,b] of [[-.09,0],[0,.09]])add(surface(bay,a,b,u=>5.27+.12*Math.pow(Math.abs(u)/.09,1.5),6),materials.reflector);
  for(const t of [0,1]){
   const verts=[],idx=[];
   for(let i=0;i<=44;i++){const u=-1+2*i/44;for(const offset of [0,-.075]){const p=vaultPoint(bay,u,t,profile(u)+offset);verts.push(p.x,p.y,p.z);}if(i<44){const a=2*i;idx.push(a,a+2,a+1,a+1,a+2,a+3);}}
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(idx);g.computeVertexNormals();add(g,materials.edge);
  }
 }
 return group;
}
