import test from 'node:test';
import assert from 'node:assert/strict';
import {artworkTitle} from '../src/artwork-title.js';
test('only explicit double-hash filenames become captions',()=>{
 for(const name of ['IMG_1234.JPG','Landscape','x##Caption.jpg','##.jpg'])assert.equal(artworkTitle({title:name}),'');
 assert.equal(artworkTitle({filename:'##Autumn, 2026.JPG'}),'Autumn, 2026');
 assert.equal(artworkTitle({title:'##Ink study.v2'}),'Ink study.v2');
 assert.equal(artworkTitle({filename:'normal.jpg',title:'##not a filename'}),'');
 assert.equal(artworkTitle({title:'##<script>text</script>.png'}),'<script>text</script>');
});
