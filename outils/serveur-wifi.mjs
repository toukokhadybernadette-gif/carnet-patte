// Serveur de l'appli sur le réseau Wi-Fi, pour l'essayer sur un iPhone (même Wi-Fi que l'ordinateur).
// Usage : node outils/serveur-wifi.mjs [port]      (port 8080 par défaut)  ·  arrêt : Ctrl+C
// Il ne sert QUE les fichiers de l'appli (index.html, css, js, modules, assets), jamais tests, .git ni les notes du projet.
// Pour revenir au serveur local seulement (127.0.0.1) : arrêter ce serveur puis lancer par exemple  python -m http.server 8080 --bind 127.0.0.1

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2]) || 8080;
const AUTORISES = ['css', 'js', 'modules', 'assets'];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' };

const serveur = http.createServer((req, res) => {
  const chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const relatif = chemin === '/' ? 'index.html' : chemin.replace(/^\/+/, '');
  const fichier = path.join(RACINE, relatif);
  const ok = fichier.startsWith(RACINE) && (relatif === 'index.html' || AUTORISES.includes(relatif.split(/[\\/]/)[0]));
  if (!ok || !fs.existsSync(fichier) || fs.statSync(fichier).isDirectory()) { res.writeHead(404).end('introuvable'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fichier)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(fichier).pipe(res);
});

serveur.listen(PORT, '0.0.0.0', () => {
  const adresses = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log('Carnet Patte est accessible sur le Wi-Fi. Sur l\'iPhone (même Wi-Fi), ouvrez dans Safari :');
  for (const a of adresses) console.log(`  http://${a}:${PORT}/`);
  console.log('\nSur cet ordinateur : http://127.0.0.1:' + PORT + '/   ·   Arrêt : Ctrl+C');
});
