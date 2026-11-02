import test from 'node:test';
import assert from 'node:assert/strict';
import {bookCameraPose,maxBookTilt} from '../src/book-camera.js';
test('book opens directly overhead and tilt orbits its center between zero and 30 degrees',()=>{
 const book={x:-4.7,z:2.5};
 for(const aspect of [390/844,1,16/9]){
  const top=bookCameraPose(book,aspect,66),low=bookCameraPose(book,aspect,66,99);
  assert.equal(top.x,book.x);assert.equal(top.z,book.z);assert.equal(top.pitch,-Math.PI/2);assert.equal(top.tilt,0);
  assert.equal(low.tilt,maxBookTilt);assert.ok(Math.abs(low.pitch+Math.PI/3)<1e-12);
  assert.ok(Math.abs(Math.hypot(low.y-1.15,low.z-book.z)-(top.y-1.15))<1e-10);
  assert.equal(bookCameraPose(book,aspect,66,-5).tilt,0);
 }
 assert.ok(bookCameraPose(book,.46,66).y>bookCameraPose(book,1.77,66).y);
});
