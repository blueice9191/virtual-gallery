export const maxBookTilt=Math.PI/6;
export function bookCameraPose(book,aspect,fov,tilt=0){
  tilt=Math.max(0,Math.min(maxBookTilt,tilt));
  const tangent=Math.tan(fov*Math.PI/360),distance=Math.max(1.2/tangent,1.75/(tangent*Math.max(.2,aspect)));
  return {x:book.x,y:1.15+distance*Math.cos(tilt),z:book.z-distance*Math.sin(tilt),yaw:Math.PI,pitch:-Math.PI/2+tilt,tilt};
}
