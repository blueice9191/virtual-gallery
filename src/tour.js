import { rooms,slots,entrance,FLOOR_HEIGHT,findPath3D } from './building.js';
export function tourStops(){return [...rooms.map(r=>({id:r.id,label:`Floor ${r.floor+1} · ${r.name}`,floor:r.floor,point:{...r.visit,y:r.floor*FLOOR_HEIGHT},look:slots.find(s=>s.room===r.id&&s.wall==='outer'),dwell:12})),{id:'return',label:'Return to the first-floor atrium',floor:0,point:{...entrance},look:{x:-4,z:4.4},dwell:0}];}
export async function buildTourRoute(start,onProgress=()=>{}){
  const route=[];let from=start;const stops=tourStops();
  for(let i=0;i<stops.length;i++){
    const stop=stops[i],path=findPath3D(from,stop.point);if(!path.length)throw new Error(`No walkable route to ${stop.label}`);
    for(const point of path)route.push({...point,stopIndex:i,label:stop.label});
    route[route.length-1]={...route.at(-1),arrival:stop};from=stop.point;onProgress(i+1,stops.length);
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  return route;
}
export class TourProgress{
  constructor(){this.route=[];this.index=0;this.status='idle';this.dwell=0;this.visited=[];}
  start(route){this.route=route;this.index=0;this.status='running';this.dwell=0;this.visited=[];}
  pause(){if(this.status==='running')this.status='paused';}
  resume(){if(this.status==='paused')this.status='running';}
  stop(){this.status='idle';this.route=[];this.index=0;this.dwell=0;}
  get target(){return this.route[this.index];}
  arrive(){const current=this.target;if(current?.arrival){this.dwell=current.arrival.dwell;if(current.arrival.id!=='return'&&!this.visited.includes(current.arrival.id))this.visited.push(current.arrival.id);}this.index++;if(this.index>=this.route.length){this.status='complete';this.dwell=0;}}
}
