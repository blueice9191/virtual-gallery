import * as THREE from 'three';

// Bounded, deterministic variations keep exported gallery configurations reproducible.
export function createStatue(seed=0){
  const group=new THREE.Group(),variant=seed%3;
  const color=['#5b695c','#927859','#667887','#806876'][Math.floor(seed/3)%4];
  function add(geometry,x,y,z,rx=0,ry=0,rz=0){
    const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,metalness:.45,roughness:.32}));
    mesh.position.set(x,y,z);mesh.rotation.set(rx,ry,rz);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
  }
  if(variant===0){
    add(new THREE.TorusKnotGeometry(.52,.13,100,14,2+(Math.floor(seed/12)%2),3),0,1.8,0,0,seed*.37);
  }else if(variant===1){
    for(let i=0;i<3;i++)add(new THREE.TorusGeometry(.46,.07,12,64),0,1.53+i*.34,0,.25+i*.42,seed*.31+i*.8);
  }else{
    for(let i=0;i<4;i++){
      const geometry=new THREE.IcosahedronGeometry(1,1);geometry.scale(.42-i*.055,.17,.35-i*.04);
      add(geometry,Math.sin(seed+i)*.07,1.22+i*.3,Math.cos(seed+i)*.05,0,seed*.6+i*.7);
    }
  }
  let bounds=new THREE.Box3().setFromObject(group);
  const scale=Math.min(1,1.8/(bounds.max.y-bounds.min.y));group.scale.setScalar(scale);
  bounds=new THREE.Box3().setFromObject(group);group.position.y=1.06-bounds.min.y;
  group.name='Atrium statue';return group;
}
