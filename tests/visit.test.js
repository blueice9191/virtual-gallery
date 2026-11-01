import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,existsSync } from 'node:fs';
import { createVisit,validVisit } from '../src/visit.js';
const catalog=JSON.parse(readFileSync(new URL('../public/gallery.json',import.meta.url)));
test('sample catalog uses unique local artwork references and valid dimensions',()=>{assert.ok(catalog.photos.length>0);assert.equal(new Set(catalog.photos.map(p=>p.id)).size,catalog.photos.length);for(const p of catalog.photos){assert.match(p.src,/^\/artwork\//);assert.ok(p.folder&&p.width>0&&p.height>0);}});

test('session assignments survive serialization and reject incompatible catalogs',()=>{const visit=createVisit(catalog);assert.ok(validVisit(visit,catalog));assert.ok(validVisit(JSON.parse(JSON.stringify(visit)),catalog));assert.equal(validVisit({...visit,version:'outdated'},catalog),false);visit.assignments[Object.keys(visit.assignments)[0]][0]='missing';assert.equal(validVisit(visit,catalog),false);});
test('new visits can change theme order without losing any photographs',()=>{const a=createVisit(catalog,()=>.01),b=createVisit(catalog,()=>.99);assert.notDeepEqual(a.assignments,b.assignments);assert.equal(new Set(Object.values(a.assignments).flat()).size,catalog.photos.length);assert.ok(validVisit(a,catalog));});
test('future catalog themes do not require changes to the room generator',()=>{const expanded={version:'future',photos:[...catalog.photos,{id:'new-photo',theme:'Mountains'}]};const visit=createVisit(expanded);assert.deepEqual(visit.assignments.Mountains,['new-photo']);assert.ok(validVisit(visit,expanded));assert.equal(validVisit(createVisit(catalog),expanded),false);});
