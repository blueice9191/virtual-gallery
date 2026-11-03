export const VR_FLOOR_HEIGHT=6;
export async function immersiveSupported(xr=globalThis.navigator?.xr){
  try{return !!xr&&await xr.isSessionSupported('immersive-vr');}catch{return false;}
}
export function teleportLanding(point,canStand){
  const floor=Math.round(point.y/VR_FLOOR_HEIGHT);
  if(floor<0||floor>2||Math.abs(point.y-floor*VR_FLOOR_HEIGHT)>.04)return null;
  // Keep the landing clear of walls, benches, guardrails, and atrium edges.
  for(const [dx,dz] of [[0,0],[.2,0],[-.2,0],[0,.2],[0,-.2]])if(!canStand(point.x+dx,point.z+dz,floor))return null;
  return {x:point.x,y:floor*VR_FLOOR_HEIGHT,z:point.z};
}
export const floorLanding=floor=>({x:11,y:floor*VR_FLOOR_HEIGHT,z:4});
export function fittedArtwork(photo,maxWidth=1.9,maxHeight=1.5){
  const aspect=photo.width/photo.height,width=Math.min(maxWidth,maxHeight*aspect);
  return {width,height:width/aspect};
}
