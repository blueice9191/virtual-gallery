export function setupFullscreen(doc,button,onError,{exitButton,edge}={}){
  const current=()=>doc.fullscreenElement||doc.webkitFullscreenElement;
  let revealTimer;
  function reveal(){if(!current()||!edge)return;edge.dataset.revealed='true';clearTimeout(revealTimer);revealTimer=setTimeout(()=>{edge.dataset.revealed='false';},3500);}
  function update(){const active=!!current();button.textContent=active?'Exit full screen':'Full screen';button.setAttribute('aria-pressed',String(active));if(doc.documentElement.dataset)doc.documentElement.dataset.galleryFullscreen=String(active);if(edge){edge.hidden=!active;edge.dataset.revealed='false';}clearTimeout(revealTimer);}
  async function exit(){try{const leave=doc.exitFullscreen||doc.webkitExitFullscreen;if(!leave)throw Error();await leave.call(doc);}catch{onError('Could not exit full screen. Try the Escape key or your browser’s fullscreen control.');}update();}
  button.onclick=async()=>{if(current()){await exit();return;}try{const root=doc.documentElement,request=root.requestFullscreen||root.webkitRequestFullscreen;if(!request)throw Error();await request.call(root);}catch{onError('Full screen is unavailable in this browser. You can still use the gallery normally.');}update();};
  if(exitButton)exitButton.onclick=exit;
  if(edge){edge.addEventListener('pointerenter',reveal);edge.addEventListener('pointerdown',reveal);edge.addEventListener('focusin',reveal);}
  doc.addEventListener('fullscreenchange',update);doc.addEventListener('webkitfullscreenchange',update);update();
}
