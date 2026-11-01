import { atriumVoid,makeGuardRuns,guardBlocks,benchLayout,benchBlocks } from './fixtures.js';
export const TAU=Math.PI*2, FLOOR_HEIGHT=6;
export const polar=(r,a)=>({x:r*Math.cos(a),z:r*Math.sin(a)});
export const entrance={x:-1,z:8.7,y:0,yaw:.4};
export const featuredWall={a:{x:-6.8,z:4.4},b:{x:-1.2,z:4.4},kind:'feature',floor:0};
export const desk={x:-4,z:2.6,width:4.4,depth:2.1};
export const ring=Array.from({length:12},(_,i)=>polar(13,i*TAU/12));
export const innerRing=Array.from({length:12},(_,i)=>polar(9,i*TAU/12));
export const upperVoid=atriumVoid(innerRing);
const names=['Autumn studies','Along the water','Open country','Woodland light','Quiet places','Changing seasons','Near & far','Lines in nature','Passing moments','Land & sky','Evening light','Collected views'];
export const floors=Array.from({length:3},(_,floor)=>({floor,base:floor*FLOOR_HEIGHT,name:`Floor ${floor+1}`,panorama:floor===2,count:floor===2?6:12}));
export const rooms=[],walls=[],slots=[],corridorSlots=[];
const addWall=(a,b,floor,kind='wall')=>walls.push({a,b,floor,kind});
function doorway(a,b,floor,width=2.4){
  const len=Math.hypot(b.x-a.x,b.z-a.z),p=t=>({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
  addWall(a,p(.5-width/len/2),floor);addWall(p(.5+width/len/2),b,floor);addWall(p(.5-width/len/2),p(.5+width/len/2),floor,'lintel');
}
for(const f of floors){
  for(let i=0;i<f.count;i++){
    const span=TAU/f.count,start=-Math.PI+i*span,end=start+span,angle=(start+end)/2;
    const a=polar(13,start),b=polar(13,end),oa=polar(23,start),ob=polar(23,end);
    // Panorama rooms combine two adjacent sectors into one uninterrupted gallery.
    const middle=f.panorama?polar(13,angle):null;
    const inner=middle?[a,middle,b]:[a,b];
    const room={id:`f${f.floor+1}-r${i+1}`,floor:f.floor,index:i,name:f.panorama?`Panorama ${i+1}`:names[i],subtitle:f.panorama?'Wide views · Sample photographs for now':`Gallery ${i+1} · Sample collection`,angle,span,panorama:f.panorama,polygon:[...inner,ob,oa],visit:polar(f.panorama?15:16.2,angle)};
    rooms.push(room);
    for(let j=0;j<inner.length-1;j++)doorway(inner[j],inner[j+1],f.floor,f.panorama?2.8:2.4);
    for(let j=0;j<inner.length-1;j++){
      const ia=inner[j],ib=inner[j+1],m={x:(ia.x+ib.x)/2,z:(ia.z+ib.z)/2},len=Math.hypot(m.x,m.z),n={x:m.x/len,z:m.z/len};
      for(const t of [.16,.84])slots.push({id:`${room.id}-entrance-${j}-${t}`,floor:f.floor,room:room.id,wall:'entrance',x:ia.x+(ib.x-ia.x)*t+n.x*.16,z:ia.z+(ib.z-ia.z)*t+n.z*.16,normal:n,maxWidth:1.25,maxHeight:2,height:2.1,portraitPreferred:true});
    }
    addWall(oa,ob,f.floor);
    // Each radial partition is constructed once and has a connecting side door.
    doorway(a,oa,f.floor,2.6);
    const mid={x:(oa.x+ob.x)/2,z:(oa.z+ob.z)/2},l=Math.hypot(mid.x,mid.z),normal={x:-mid.x/l,z:-mid.z/l};
    for(let j=0;j<2;j++){
      const t=f.panorama?.3+j*.4:(j+1)/3;
      slots.push({id:`${room.id}-wall-${j}`,floor:f.floor,room:room.id,wall:'outer',x:oa.x+(ob.x-oa.x)*t+normal.x*.16,z:oa.z+(ob.z-oa.z)*t+normal.z*.16,normal,maxWidth:f.panorama?8:2.5,maxHeight:f.panorama?2.8:2.6,height:2.35});
    }
    for(const [side,angle] of [['left',start],['right',end]]){
      const n=side==='left'?{x:-Math.sin(angle),z:Math.cos(angle)}:{x:Math.sin(angle),z:-Math.cos(angle)};
      for(const radius of [14.7,21.3]){const p=polar(radius,angle);slots.push({id:`${room.id}-side-${side}-${radius}`,floor:f.floor,room:room.id,wall:side,x:p.x+n.x*.16,z:p.z+n.z*.16,normal:n,maxWidth:radius<18?1.8:2.4,maxHeight:2.2,height:2.25});}
    }
    const ca=inner[0],cb=inner[1],cm={x:(ca.x+cb.x)/2,z:(ca.z+cb.z)/2},cl=Math.hypot(cm.x,cm.z),cn={x:-cm.x/cl,z:-cm.z/cl};
    corridorSlots.push({id:`${room.id}-corridor`,floor:f.floor,room:room.id,area:'corridor',x:ca.x+(cb.x-ca.x)*.16+cn.x*.16,z:ca.z+(cb.z-ca.z)*.16+cn.z*.16,normal:cn,maxWidth:1.45,maxHeight:1.7,height:2.2,portraitPreferred:true});
  }
}
walls.push(featuredWall);
export const benches=rooms.map(room=>({...benchLayout(room),floor:room.floor}));
export const guardRuns=makeGuardRuns(floors,upperVoid);
export function segmentDistance(x,z,a,b){const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a.x-t*dx,z-a.z-t*dz);}
export function inPolygon(x,z,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(segmentDistance(x,z,a,b)<.00001)return true;if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;}return inside;}
export function floorAt(y){return Math.max(0,Math.min(2,Math.round(y/FLOOR_HEIGHT)));}
export function roomAt(x,z,floor=0){return rooms.find(r=>r.floor===floor&&inPolygon(x,z,r.polygon));}
export function inStairFootprint(x,z){return x>4.65&&x<9.35&&z>-4.35&&z<3.2;}
export function deckContains(x,z,floor){
  if(inStairFootprint(x,z))return false;
  if(floor===0){if(Math.hypot(x,z)<2.45)return false;if(x>desk.x-desk.width/2-.3&&x<desk.x+desk.width/2+.3&&z>desk.z-desk.depth/2-.3&&z<desk.z+desk.depth/2+.3)return false;}
  // The upper balconies have open centers and a bridge to the stair landing.
  const bridge=x>=4.8&&x<=13&&z>=3.2&&z<=4.7;
  const interior=inPolygon(x,z,ring)&&(floor===0||!inPolygon(x,z,upperVoid)||bridge);
  return interior||rooms.some(r=>r.floor===floor&&inPolygon(x,z,r.polygon));
}
export function blocked(x,z,y){
  if(guardBlocks(x,z,y,guardRuns))return true;
  const floor=floorAt(y);
  if(Math.abs(y-floor*FLOOR_HEIGHT)<.4){
    if(walls.some(w=>w.floor===floor&&w.kind!=='lintel'&&segmentDistance(x,z,w.a,w.b)<.32))return true;
    if(benches.some(b=>b.floor===floor&&benchBlocks(x,z,b)))return true;
  }
  return false;
}
export function surfacesAt(x,z){
  const heights=[];
  for(let f=0;f<3;f++)if(deckContains(x,z,f))heights.push(f*FLOOR_HEIGHT);
  for(let f=0;f<2;f++){
    const base=f*FLOOR_HEIGHT;
    if(x>=5.25&&x<=6.35&&z>=-3.2&&z<=3.2)heights.push(base+(3.2-z)/6.4*3);
    if(x>=7.65&&x<=8.75&&z>=-3.2&&z<=3.2)heights.push(base+3+(z+3.2)/6.4*3);
    if(x>=5.25&&x<=8.75&&z>=-3.95&&z<=-3.2)heights.push(base+3);
  }
  return heights.filter(y=>!blocked(x,z,y));
}
export function walkSurface(x,z,fromY){return surfacesAt(x,z).filter(y=>Math.abs(y-fromY)<.31).sort((a,b)=>Math.abs(a-fromY)-Math.abs(b-fromY))[0];}
export function canWalk(x,z,floor=0){return surfacesAt(x,z).some(y=>Math.abs(y-floor*FLOOR_HEIGHT)<.01);}

class Heap{constructor(){this.a=[];}push(n){let i=this.a.length;this.a.push(n);while(i){const p=(i-1)>>1;if(this.a[p].f<=n.f)break;this.a[i]=this.a[p];i=p;}this.a[i]=n;}pop(){const first=this.a[0],last=this.a.pop();if(this.a.length){let i=0;while(i*2+1<this.a.length){let c=i*2+1;if(c+1<this.a.length&&this.a[c+1].f<this.a[c].f)c++;if(this.a[c].f>=last.f)break;this.a[i]=this.a[c];i=c;}this.a[i]=last;}return first;}get length(){return this.a.length;}}
// One navigation graph joins flat floors and continuous stair surfaces.
export function findPath3D(start,end){
  const step=.5,sx=Math.round(start.x/step),sz=Math.round(start.z/step),ex=Math.round(end.x/step),ez=Math.round(end.z/step),sy=start.y??0,ey=end.y??0;
  const starts=surfacesAt(sx*step,sz*step).filter(y=>Math.abs(y-sy)<.45);if(!starts.length||!surfacesAt(ex*step,ez*step).some(y=>Math.abs(y-ey)<.4))return [];
  const key=(x,z,y)=>`${x},${z},${Math.round(y*100)}`,heuristic=(x,z,y)=>Math.hypot((ex-x)*step,(ez-z)*step,ey-y);
  const open=new Heap(),best=new Map();const first={x:sx,z:sz,y:starts[0],g:0,f:0,parent:null};open.push(first);best.set(key(sx,sz,first.y),0);
  let count=0;
  while(open.length&&count++<60000){
    const n=open.pop();if(n.g>best.get(key(n.x,n.z,n.y)))continue;
    if(n.x===ex&&n.z===ez&&Math.abs(n.y-ey)<.4){const path=[{...end,y:ey}];let p=n;while(p.parent){path.push({x:p.x*step,z:p.z*step,y:p.y});p=p.parent;}return path.reverse();}
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const x=n.x+dx,z=n.z+dz;if(Math.abs(x)>49||Math.abs(z)>49)continue;
      const mid=walkSurface((n.x+dx*.5)*step,(n.z+dz*.5)*step,n.y);if(mid===undefined)continue;
      for(const y of surfacesAt(x*step,z*step)){
        if(Math.abs(y-mid)>.31)continue;
        const g=n.g+Math.hypot(dx*step,dz*step,y-n.y),k=key(x,z,y);if(best.has(k)&&best.get(k)<=g)continue;
        best.set(k,g);open.push({x,z,y,g,f:g+heuristic(x,z,y),parent:n});
      }
    }
  }
  return [];
}
export function findPath(start,end,floor=0){return findPath3D({...start,y:start.y??floor*FLOOR_HEIGHT},{...end,y:end.y??floor*FLOOR_HEIGHT});}
