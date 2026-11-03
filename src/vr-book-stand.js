import * as THREE from 'three';
import {textMesh} from './world.js';
export const TABLE_TOP=1.01,MAX_VIEWER_HEIGHT=1.9812;

// The near-edge hinge stays on the desk; only the viewing height is adjustable.
export function createVRBookStand(scene,{pose,adjustHeight=()=>{},resetHeight=()=>{},close,makeText=textMesh}){
 const root=new THREE.Group(),tilt=new THREE.Group();root.name='VR reading stand';root.visible=false;root.add(tilt);scene.add(root);
 const controls=[];let mounted=null,saved=null,angle=45;
 const mat=new THREE.MeshStandardMaterial({color:'#e8e5dc',roughness:.8});
 const tray=new THREE.Mesh(new THREE.BoxGeometry(2.75,.04,1.73),mat);tray.position.set(0,-.04,.825);tilt.add(tray);
 const hinge=new THREE.Mesh(new THREE.BoxGeometry(2.75,.08,.12),mat);hinge.position.y=-.04;root.add(hinge);
 function apply(){tilt.rotation.x=-THREE.MathUtils.degToRad(angle);root.updateMatrixWorld(true);}
 function reset(){angle=45;resetHeight(true);apply();}
 function button(label,x,y,action){const mesh=makeText(label,.64,.18,60,'#263b32','#f8f9f6');mesh.position.set(x,y,-.16);mesh.rotation.y=Math.PI;mesh.userData.vrAction=action;root.add(mesh);controls.push(mesh);}
 // Viewer faces the desk from local -Z: their right is the book's -X side.
 button('Higher',-1.78,.6,()=>adjustHeight(.1));button('Lower',-2.5,.6,()=>adjustHeight(-.1));
 button('More tilt',-1.78,.36,()=>{angle=Math.min(75,angle+5);apply();});button('Less tilt',-2.5,.36,()=>{angle=Math.max(15,angle-5);apply();});
 button('Reset',-1.78,.12,reset);button('Close book',-2.5,.12,close);
 function unmount(){if(!mounted)return;const book=mounted;saved.parent.add(book);book.position.copy(saved.position);book.quaternion.copy(saved.quaternion);book.updateMatrixWorld(true);mounted=null;saved=null;root.visible=false;resetHeight();}
 function mount(book){unmount();mounted=book;saved={parent:book.parent,position:book.position.clone(),quaternion:book.quaternion.clone()};root.position.set(saved.position.x,TABLE_TOP+.08,saved.position.z-.825);root.rotation.set(0,0,0);tilt.add(book);book.position.set(0,0,.825);book.quaternion.identity();root.visible=true;reset();}
 function dispose(){unmount();scene.remove(root);root.traverse(o=>{o.geometry?.dispose();if(o.material){o.material.map?.dispose();o.material.dispose();}});}
 return {mount,unmount,reset,dispose,root,tilt,controls,get active(){return !!mounted;}};
}
