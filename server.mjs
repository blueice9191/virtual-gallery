import { makeCloudinaryAPI } from './server/cloudinary.mjs';
import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat,writeFile } from 'node:fs/promises';
import { albumsFromCatalog } from './src/sources.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const root = fileURLToPath(new URL('./dist/', import.meta.url));
export const port = Number(process.env.MUSEUM_PORT||5180);
const origin = `http://127.0.0.1:${port}`;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

export function assetPath(requestUrl) {
  const parsed = new URL(requestUrl, origin);
  const pathname = decodeURIComponent(parsed.pathname);
  const filename = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!filename.toLowerCase().startsWith(`${root.toLowerCase()}${root.endsWith(path.sep) ? '' : path.sep}`)) return null;
  return filename;
}

export function createMuseumServer(options={}) {
  const cloudAPI=makeCloudinaryAPI(options);
  return http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if(await cloudAPI(req,res))return;
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end('Method not allowed'); return; }
    if (req.url === '/__museum/health') { res.writeHead(200, { 'Content-Type': types['.json'] }); res.end(JSON.stringify({ app: 'twelve-museum', url: origin })); return; }
    try {
      const filename = assetPath(req.url);
      if (!filename || !(await stat(filename)).isFile()) { res.writeHead(404); res.end('Museum file not found'); return; }
      res.writeHead(200, { 'Content-Type': types[path.extname(filename).toLowerCase()] || 'application/octet-stream' });
      if (req.method === 'HEAD') res.end();
      else { const stream = createReadStream(filename); stream.on('error', () => res.destroy()); stream.pipe(res); }
    } catch { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Museum file not found'); }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!existsSync(path.join(root, 'index.html'))) { console.error('Build the museum first: npm.cmd run build'); process.exitCode = 1; }
  else {
    const server = createMuseumServer({onCatalog:async catalog=>{for(const directory of ['public','dist']){const base=fileURLToPath(new URL(`./${directory}/`,import.meta.url));await writeFile(path.join(base,'gallery.json'),JSON.stringify(catalog,null,2));await writeFile(path.join(base,'albums.json'),JSON.stringify({albums:albumsFromCatalog(catalog)},null,2));}}});
    const open = () => { if (process.argv.includes('--open')) spawn('explorer.exe', [origin], { detached: true, stdio: 'ignore' }).unref(); };
    server.on('error', async error => {
      if (error.code === 'EADDRINUSE') {
        try {
          const check = await fetch(`${origin}/__museum/health`, { signal: AbortSignal.timeout(2000) });
          if ((await check.json()).app === 'twelve-museum') { console.log(`The museum is already running: ${origin}`); open(); return; }
        } catch { /* Another program owns the port. Never terminate it. */ }
      }
      console.error(`Could not start the museum at ${origin}: ${error.message}`); process.exitCode = 1;
    });
    server.listen(port, '127.0.0.1', () => { console.log(`Open Gallery: ${origin}\nKeep this server running while visiting. Press Ctrl+C to stop.`); open(); });
  }
}
