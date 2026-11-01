import test from 'node:test';
import assert from 'node:assert/strict';
import { atmosphereAt,localHour } from '../src/atmosphere.js';
test('computer-local clock selects daylight, dawn, dusk and a starry night',()=>{
  assert.equal(atmosphereAt(12).label,'Daylight');
  assert.equal(atmosphereAt(6.5).label,'Sunrise');
  assert.equal(atmosphereAt(18).label,'Sunset');
  assert.equal(atmosphereAt(23).label,'Starry night');
  assert.equal(atmosphereAt(12).daylight,1);assert.equal(atmosphereAt(0).daylight,0);
  const d=new Date(2026,9,28,18,30,0);assert.equal(localHour(d),18.5);
});
test('sky transitions are continuous across midnight and time bands',()=>{
  for(let h=0;h<24;h+=.1){const s=atmosphereAt(h);assert.ok(s.daylight>=0&&s.daylight<=1);assert.ok(s.t>=0&&s.t<=1);}
  assert.equal(atmosphereAt(24).daylight,atmosphereAt(0).daylight);
  assert.ok(Math.abs(atmosphereAt(6.499).daylight-atmosphereAt(6.501).daylight)<.01);
});
