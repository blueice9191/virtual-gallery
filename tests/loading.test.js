import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhotoAssets } from '../src/photo-assets.js';
import { createMuseumServer } from '../server.mjs';
import { readFileSync } from 'node:fs';

test('wall and close-up share one loaded asset even after the server becomes unavailable', async () => {
  let requests = 0, online = true;
  const assets = createPhotoAssets({ fetchAsset: async () => { requests++; if (!online) throw new Error('Server stopped'); return new Response(new Blob(['photo'], { type: 'image/jpeg' })); }, makeObjectURL: () => 'blob:loaded-photo' });
  const photo = { id: 'test-photo', src: '/photos/sample.jpg' };
  assert.equal(await assets.source(photo), 'blob:loaded-photo');
  online = false;
  assert.equal(await assets.source(photo), 'blob:loaded-photo');
  assert.equal(requests, 1);
});

test('a failed image fetch is retryable and an HTML fallback is rejected', async () => {
  let requests = 0;
  const assets = createPhotoAssets({ fetchAsset: async () => { requests++; return requests === 1 ? new Response('<html>wrong file</html>', { headers: { 'Content-Type': 'text/html' } }) : new Response(new Blob(['photo'], { type: 'image/jpeg' })); }, makeObjectURL: () => 'blob:retried-photo' });
  const photo = { id: 'test-photo', src: '/photos/sample.jpg' };
  await assert.rejects(assets.source(photo), /did not return an image/);
  assert.equal(await assets.source(photo), 'blob:retried-photo');
  assert.equal(requests, 2);
});

test('local server serves all production assets with correct types and no stale cache', async t => {
  const server = createMuseumServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const home = await fetch(origin); assert.equal(home.status, 200); assert.equal(home.headers.get('cache-control'), 'no-store');
  const html = await home.text();
  const paths = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(m => m[1]);
  assert.ok(paths.some(p => p.endsWith('.css'))); assert.ok(paths.some(p => p.endsWith('.js')));
  for (const p of paths) { const r = await fetch(origin + p); assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), p.endsWith('.css') ? /text\/css/ : /javascript/); }
  const catalog = JSON.parse(readFileSync(new URL('../public/gallery.json', import.meta.url)));
  for (const photo of catalog.photos.filter(p=>p.src.startsWith('/'))) { const r = await fetch(origin + photo.src); assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /image\/(jpeg|svg\+xml)/); assert.ok((await r.arrayBuffer()).byteLength > 100); }
  const missing = await fetch(`${origin}/assets/old-missing.js`); assert.equal(missing.status, 404); assert.match(missing.headers.get('content-type'), /text\/plain/);
});
