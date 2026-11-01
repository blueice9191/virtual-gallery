// Shared fixture descriptions drive both rendering and collision checks.
export function benchLayout(room){
  let center={x:19*Math.cos(room.angle),z:19*Math.sin(room.angle)};
  if(room.panorama){let crossSum=0,x=0,z=0;for(let i=0;i<room.polygon.length;i++){const a=room.polygon[i],b=room.polygon[(i+1)%room.polygon.length],cross=a.x*b.z-b.x*a.z;crossSum+=cross;x+=(a.x+b.x)*cross;z+=(a.z+b.z)*cross;}center={x:x/(3*crossSum),z:z/(3*crossSum)};}
  const length=3,depth=.55,rotation=Math.PI/2-room.angle,tangent={x:Math.cos(rotation),z:-Math.sin(rotation)};
  return {center,length,depth,rotation,tangent,legs:[-1,1].map(sign=>({x:center.x+sign*length*.36*tangent.x,z:center.z+sign*length*.36*tangent.z}))};
}
export function benchBlocks(x,z,bench,padding=.3){const dx=x-bench.center.x,dz=z-bench.center.z,u=dx*bench.tangent.x+dz*bench.tangent.z,v=-dx*bench.tangent.z+dz*bench.tangent.x;return Math.abs(u)<bench.length/2+padding&&Math.abs(v)<bench.depth/2+padding;}
export function bookLayout(desk,count){
  const width=Math.min(.29,(count>3?1.3:.87)/Math.max(1,count)),edge=desk.x+desk.width/2-.05;
  return {open:{x:desk.x-(count>3?.7:.25),z:desk.z-.1,width:2.65,depth:1.65},standing:Array.from({length:count},(_,i)=>({x:edge-width/2-i*width,z:desk.z+desk.depth/2-.37,width,depth:.64}))};
}
export function rightBoundaryAt(polygon,z){
  const xs=[];
  for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];if(z>=Math.min(a.z,b.z)-1e-8&&z<=Math.max(a.z,b.z)+1e-8&&Math.abs(b.z-a.z)>1e-8){const t=(z-a.z)/(b.z-a.z);if(t>=-1e-8&&t<=1+1e-8)xs.push(a.x+(b.x-a.x)*t);}}
  return Math.max(...xs);
}
export function atriumVoid(innerRing){
  // Extend the atrium cutout around the stairwell, so no balcony slab or rail
  // intersects the top of the return flight.
  return [{x:9.35,z:3.2},{x:rightBoundaryAt(innerRing,3.2),z:3.2},...innerRing.slice(1),{x:rightBoundaryAt(innerRing,-4.35),z:-4.35},{x:9.35,z:-4.35}];
}
export function makeGuardRuns(floors,voidPolygon){
  const runs=[];
  const add=(a,b,kind)=>{if(Math.hypot(b.x-a.x,b.z-a.z,b.y-a.y)>.04)runs.push({a,b,kind,height:1.05});};
  for(const f of floors.filter(f=>f.floor>0)){
    for(let i=0;i<voidPolygon.length;i++){
      const a=voidPolygon[i],b=voidPolygon[(i+1)%voidPolygon.length],cuts=[0,1];
      for(const z of [3.2,4.7])if(Math.abs(b.z-a.z)>1e-8){const t=(z-a.z)/(b.z-a.z);if(t>0&&t<1)cuts.push(t);}
      cuts.sort((a,b)=>a-b);
      for(let j=0;j<cuts.length-1;j++){
        const t=cuts[j],u=cuts[j+1],mid=(t+u)/2,x=a.x+(b.x-a.x)*mid,z=a.z+(b.z-a.z)*mid;
        if(x>=4.8&&z>=3.2-1e-7&&z<=4.7+1e-7)continue;
        add({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,y:f.base},{x:a.x+(b.x-a.x)*u,z:a.z+(b.z-a.z)*u,y:f.base},'balcony');
      }
    }
    // Only void edges receive bridge guards. The corridor itself stays open.
    add({x:4.8,z:4.7,y:f.base},{x:rightBoundaryAt(voidPolygon,4.7),z:4.7,y:f.base},'bridge');
    add({x:4.8,z:3.2,y:f.base},{x:4.8,z:4.7,y:f.base},'bridge');
    if(f.floor===1){add({x:4.8,z:3.2,y:f.base},{x:5,z:3.2,y:f.base},'landing');add({x:6.6,z:3.2,y:f.base},{x:7.4,z:3.2,y:f.base},'landing');}
    else add({x:4.8,z:3.2,y:f.base},{x:7.4,z:3.2,y:f.base},'landing');
  }
  for(let f=0;f<2;f++){
    const base=f*6;
    for(const x of [5,6.6])add({x,z:3.2,y:base},{x,z:-3.2,y:base+3},'stair');
    for(const x of [7.4,9])add({x,z:-3.2,y:base+3},{x,z:3.2,y:base+6},'stair');
    add({x:5,z:-4.2,y:base+3},{x:9,z:-4.2,y:base+3},'landing');
    for(const x of [5,9])add({x,z:-4.2,y:base+3},{x,z:-3.2,y:base+3},'landing');
    add({x:6.6,z:-3.2,y:base+3},{x:7.4,z:-3.2,y:base+3},'landing');
  }
  return runs;
}
export function guardPosts(run,maxSpacing=.85){
  const count=Math.max(1,Math.ceil(Math.hypot(run.b.x-run.a.x,run.b.z-run.a.z)/maxSpacing));
  return Array.from({length:count+1},(_,i)=>{const t=i/count;return {x:run.a.x+(run.b.x-run.a.x)*t,y:run.a.y+(run.b.y-run.a.y)*t,z:run.a.z+(run.b.z-run.a.z)*t};});
}
export function guardBlocks(x,z,y,runs){
  return runs.some(({a,b})=>{const dx=b.x-a.x,dz=b.z-a.z,denom=dx*dx+dz*dz;if(!denom)return false;const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/denom));return Math.hypot(x-a.x-t*dx,z-a.z-t*dz)<.19&&Math.abs(y-a.y-t*(b.y-a.y))<.4;});
}
