import test from 'node:test';
import assert from 'node:assert/strict';
import {setupFullscreen} from '../src/fullscreen.js';
test('fullscreen button enters, exits and follows native Escape changes',async()=>{
 const events={},button={setAttribute(k,v){this[k]=v;}},doc={documentElement:{async requestFullscreen(){doc.fullscreenElement=this;}},async exitFullscreen(){doc.fullscreenElement=null;},addEventListener(k,v){events[k]=v;}};
 setupFullscreen(doc,button,()=>assert.fail('unexpected fullscreen error'));
 assert.equal(button.textContent,'Full screen');await button.onclick();assert.equal(button.textContent,'Exit full screen');await button.onclick();assert.equal(button.textContent,'Full screen');await button.onclick();doc.fullscreenElement=null;events.fullscreenchange();assert.equal(button['aria-pressed'],'false');
});
test('unsupported fullscreen is reported without breaking the viewer',async()=>{let message;const button={setAttribute(){}},doc={documentElement:{},addEventListener(){}};setupFullscreen(doc,button,m=>message=m);await button.onclick();assert.match(message,/unavailable/);});
