import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { sampleRoot } from './prepare-sample.js';

const files = { '/': ['index.html', 'text/html; charset=utf-8'], '/styles.css': ['styles.css', 'text/css'],
  '/inter-400.woff2': ['inter-400.woff2', 'font/woff2'], '/inter-700.woff2': ['inter-700.woff2', 'font/woff2'] };
const server = http.createServer(async (req, res) => {
  const entry = files[new URL(req.url, 'http://127.0.0.1').pathname];
  if (!entry) { res.writeHead(404); res.end(); return; }
  try { const bytes = await fs.readFile(path.join(sampleRoot, entry[0])); res.setHeader('Content-Type', entry[1]); res.setHeader('Cache-Control', 'no-store'); res.end(bytes); }
  catch { res.writeHead(500); res.end('Sample file unavailable'); }
});
server.listen(4177, '127.0.0.1', () => console.log('Sample: http://127.0.0.1:4177'));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
