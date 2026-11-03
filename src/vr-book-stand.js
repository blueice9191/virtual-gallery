import * as THREE from 'three';
import {textMesh} from './world.js';

// A world-locked reading lectern. Only explicit Reset follows the viewer.
export function createVRBookStand(scene,{pose,close,makeText=textMesh}){
 const root=new THREE.Group(),tilt=new THREE.Group();root.name='VR reading stand';root.visible=false;root.add(tilt);scene.add(root);
 const controls=[];let mounted=null,saved=null,angle=45,height=0,baseY=0;
 const mat=new THREE.MeshStandardMaterial({color:'#e8e5dc',roughness:.8});
 const tray=new THREE.Mesh(new THREE.BoxGeometry(2.75,.04,1.73),mat);tray.position.y=-.04;tilt.add(tray);
 function apply(){root.position.y=baseY+height;tilt.rotation.x=-THREE.MathUtils.degToRad(angle);root.updateMatrixWorld(true);}
 function reset(){const {position,direction}=pose(),forward=direction.clone();forward.y=0;if(forward.lengthSq()<.001)forward.set(0,0,-1);forward.normalize();root.position.copy(position).addScaledVector(forward,2);root.rotation.set(0,Math.atan2(forward.x,forward.z),0);baseY=position.y-.35;height=0;angle=45;apply();}
 function button(label,x,y,action){const mesh=makeText(label,.64,.18,60,'#263b32','#f8f9f6');mesh.position.set(x,y,-.92);mesh.rotation.y=Math.PI;mesh.userData.vrAction=action;root.add(mesh);controls.push(mesh);}
 button('Raise',.72,-.55,()=>{height=Math.min(.6,height+.1);apply();});button('Lower',0,-.55,()=>{height=Math.max(-.6,height-.1);apply();});button('Reset',-.72,-.55,reset);
 button('More tilt',.72,-.78,()=>{angle=Math.min(75,angle+5);apply();});button('Less tilt',0,-.78,()=>{angle=Math.max(15,angle-5);apply();});button('Close book',-.72,-.78,close);
 function unmount(){if(!mounted)return;const book=mounted;saved.parent.add(book);book.position.copy(saved.position);book.quaternion.copy(saved.quaternion);book.updateMatrixWorld(true);mounted=null;saved=null;root.visible=false;}
 function mount(book){unmount();mounted=book;saved={parent:book.parent,position:book.position.clone(),quaternion:book.quaternion.clone()};tilt.add(book);book.position.set(0,0,0);book.quaternion.identity();root.visible=true;reset();}
 function dispose(){unmount();scene.remove(root);root.traverse(o=>{o.geometry?.dispose();if(o.material){o.material.map?.dispose();o.material.dispose();}});}
 return {mount,unmount,reset,dispose,root,tilt,controls,get active(){return !!mounted;}};
}
