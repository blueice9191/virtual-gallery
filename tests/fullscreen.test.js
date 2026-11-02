import test from 'node:test';
import assert from 'node:assert/strict';
import {setupFullscreen} from '../src/fullscreen.js';
test('fullscreen button enters, exits and follows native Escape changes',async()=>{
 const events={},button={setAttribute(k,v){this[k]=v;}},doc={documentElement:{async requestFullscreen(){doc.fullscreenElement=this;}},async exitFullscreen(){doc.fullscreenElement=null;},addEventListener(k,v){events[k]=v;}};
 setupFullscreen(doc,button,()=>assert.fail('unexpected fullscreen error'));
 assert.equal(button.textContent,'Full screen');await button.onclick();assert.equal(button.textContent,'Exit full screen');await button.onclick();assert.equal(button.textContent,'Full screen');await button.onclick();doc.fullscreenElement=null;events.fullscreenchange();assert.equal(button['aria-pressed'],'false');
});
test('unsupported fullscreen is reported without breaking the viewer',async()=>{let message;const button={setAttribute(){}},doc={documentElement:{},addEventListener(){}};setupFullscreen(doc,button,m=>message=m);await button.onclick();assert.match(message,/unavailable/);});

test('fullscreen hides navigation and exposes an edge-triggered exit control',async()=>{
 const events={},edgeEvents={},edge={dataset:{},addEventListener(k,v){edgeEvents[k]=v;}},exitButton={},button={setAttribute(){}},root={dataset:{},async requestFullscreen(){doc.fullscreenElement=this;}},doc={documentElement:root,async exitFullscreen(){this.fullscreenElement=null;},addEventListener(k,v){events[k]=v;}};
 setupFullscreen(doc,button,()=>assert.fail('unexpected error'),{edge,exitButton});
 assert.equal(edge.hidden,true);await button.onclick();assert.equal(root.dataset.galleryFullscreen,'true');assert.equal(edge.hidden,false);assert.equal(edge.dataset.revealed,'false');
 edgeEvents.pointerdown();assert.equal(edge.dataset.revealed,'true');await exitButton.onclick();assert.equal(root.dataset.galleryFullscreen,'false');assert.equal(edge.hidden,true);
 await button.onclick();doc.fullscreenElement=null;events.fullscreenchange();assert.equal(root.dataset.galleryFullscreen,'false');assert.equal(edge.hidden,true);
});
