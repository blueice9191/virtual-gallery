import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSettings,normalizeSettings,readSettings,settingsKey} from '../src/settings.js';
test('branding uses safe bounded values and retains site defaults for malformed local storage',()=>{
  assert.deepEqual(readSettings({getItem(){throw Error('blocked');}},defaultSettings),defaultSettings);
  assert.deepEqual(readSettings({getItem(){return '{';}},defaultSettings),defaultSettings);
  const normalized=normalizeSettings({name:'  My gallery  ',subtitle:'',logo:'javascript:alert(1)',sky:'bad'});
  assert.equal(normalized.name,'My gallery');assert.equal(normalized.subtitle,'');assert.equal(normalized.logo,'/gg.svg');assert.equal(normalized.sky,'');
  assert.equal(normalizeSettings({name:'x'.repeat(200)}).name.length,60);
  assert.equal(normalizeSettings({logo:'//remote.example/logo.svg'}).logo,'/gg.svg');
});
test('exported browser branding can become published defaults and sky preferences round-trip',()=>{
  const site={...defaultSettings,name:'Other gallery',subtitle:'Landscapes',logo:'data:image/png;base64,YQ==',sky:'18'};
  const store=new Map([[settingsKey,JSON.stringify(site)]]);
  assert.deepEqual(readSettings({getItem:k=>store.get(k)},defaultSettings),site);
  assert.deepEqual(normalizeSettings(JSON.parse(JSON.stringify(site))),site);
});
