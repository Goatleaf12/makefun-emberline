// Tiny static server for EMBERLINE's game/ folder (development only).
// Serves files from game/ on localhost:8080 so the game can be played
// and screenshotted in a desktop browser. Standard library only.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(join(fileURLToPath(new URL('.', import.meta.url)), 'game'));

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    const target = resolve(join(root, path === '/' ? 'index.html' : path));
    if (!target.startsWith(root + '/') && target !== root) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    const body = await readFile(target);
    res.writeHead(200, { 'content-type': types[extname(target)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

const port = Number(process.env.PORT ?? 8080);
server.listen(port, '127.0.0.1', () => {
  console.log(`EMBERLINE serving game/ at http://127.0.0.1:${port}/`);
});
