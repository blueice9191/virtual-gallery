import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3 } from 'three';
import { createStatue } from '../src/statue.js';
import { normalizeSettings,defaultSettings } from '../src/settings.js';

test('statue variants remain on their pedestal and reproduce from exported seeds',()=>{
  for(let seed=0;seed<36;seed++){
    const statue=createStatue(seed),copy=createStatue(seed),bounds=new Box3().setFromObject(statue);
    assert.ok(bounds.min.y>=1.04&&bounds.max.y<3);
    assert.ok(bounds.min.x> -1&&bounds.max.x<1&&bounds.min.z> -1&&bounds.max.z<1);
    assert.deepEqual(bounds,new Box3().setFromObject(copy));
    for(const group of [statue,copy])group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
  }
  assert.equal(defaultSettings.cloudName,'');
  assert.equal(normalizeSettings({statueSeed:-1}).statueSeed,0);
  assert.equal(normalizeSettings({statueSeed:24}).statueSeed,24);
});
