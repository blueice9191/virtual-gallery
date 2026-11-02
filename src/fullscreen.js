export function setupFullscreen(doc,button,onError){
  const current=()=>doc.fullscreenElement||doc.webkitFullscreenElement;
  function update(){const active=!!current();button.textContent=active?'Exit full screen':'Full screen';button.setAttribute('aria-pressed',String(active));}
  button.onclick=async()=>{try{if(current()){const exit=doc.exitFullscreen||doc.webkitExitFullscreen;if(!exit)throw Error();await exit.call(doc);}else{const root=doc.documentElement,request=root.requestFullscreen||root.webkitRequestFullscreen;if(!request)throw Error();await request.call(root);}}catch{onError('Full screen is unavailable in this browser. You can still use the gallery normally.');}update();};
  doc.addEventListener('fullscreenchange',update);doc.addEventListener('webkitfullscreenchange',update);update();
}
