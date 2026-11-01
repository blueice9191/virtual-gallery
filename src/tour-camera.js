export const smoothstep=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function smoothHeading(current,target,dt,speed=1,response=4){
  const delta=Math.atan2(Math.sin(target-current),Math.cos(target-current));
  const eased=delta*(1-Math.exp(-response*dt));
  const limit=.95*Math.max(1,speed)*dt;
  return current+Math.max(-limit,Math.min(limit,eased));
}
export function routeLookAhead(route,index,position,distance=3.5){
  let previous=position,left=distance;
  for(let i=index;i<route.length;i++){
    const p=route[i],d=Math.hypot(p.x-previous.x,p.z-previous.z);
    if(p.arrival&&d<=left&&p.arrival.look)return {...p.arrival.look,y:position.y};
    if(d>=left&&d>1e-6){const t=left/d;return {x:previous.x+(p.x-previous.x)*t,z:previous.z+(p.z-previous.z)*t,y:(previous.y??0)+((p.y??0)-(previous.y??0))*t};}
    left-=d;previous=p;
  }
  return previous;
}
export function roomSweepYaw(startYaw,elapsed,duration){return startYaw+Math.PI*2*smoothstep(elapsed/duration);}
