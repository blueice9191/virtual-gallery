export function stickVector(dx,dy,radius=46,deadzone=.12){const distance=Math.hypot(dx,dy),magnitude=Math.min(1,distance/radius);if(magnitude<deadzone)return {x:0,y:0};const strength=(magnitude-deadzone)/(1-deadzone);return {x:dx/distance*strength,y:dy/distance*strength};}
export function createTouchSticks(onIntent){
  const values={move:{x:0,y:0},look:{x:0,y:0}},active=new Map();
  function reset(){for(const name of ['move','look']){values[name]={x:0,y:0};document.querySelector(`[data-stick="${name}"] .stick-knob`).style.transform='translate(-50%,-50%)';}active.clear();}
  for(const name of ['move','look']){const element=document.querySelector(`[data-stick="${name}"]`),knob=element.querySelector('.stick-knob');
    element.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(active.has(name))return;const rect=element.getBoundingClientRect();active.set(name,{id:e.pointerId,x:rect.left+rect.width/2,y:rect.top+rect.height/2,radius:rect.width*.32});element.setPointerCapture(e.pointerId);onIntent();update(e);});
    function update(e){const p=active.get(name);if(!p||p.id!==e.pointerId)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;values[name]=stickVector(dx,dy,p.radius);const scale=Math.min(1,p.radius/Math.max(1,Math.hypot(dx,dy)));knob.style.transform=`translate(calc(-50% + ${dx*scale}px),calc(-50% + ${dy*scale}px))`;}
    element.addEventListener('pointermove',e=>{if(active.has(name)){e.preventDefault();e.stopPropagation();update(e);}});
    function end(e){if(active.get(name)?.id!==e.pointerId)return;active.delete(name);values[name]={x:0,y:0};knob.style.transform='translate(-50%,-50%)';}
    for(const event of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(event,end);
  }
  window.addEventListener('blur',reset);document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});return {values,reset};
}
