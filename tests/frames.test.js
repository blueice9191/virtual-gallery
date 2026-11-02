import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultSettings,normalizeSettings} from '../src/settings.js';
import {frameBorder,frameStyles} from '../src/frames.js';
test('frame options validate, round trip, and use half-width borders',()=>{assert.equal(frameBorder,.08/2);assert.equal(defaultSettings.margin,'wide');assert.equal(defaultSettings.frameColor,'pearl');assert.equal(normalizeSettings({frameColor:'invalid'}).frameColor,'pearl');for(const frameColor of Object.keys(frameStyles))assert.equal(normalizeSettings(JSON.parse(JSON.stringify({...defaultSettings,frameColor}))).frameColor,frameColor);});
