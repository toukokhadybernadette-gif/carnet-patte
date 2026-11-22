// Fabrique les icônes de l'appli installable et les écrans de démarrage iPhone (PNG) dans assets/icons/pwa/.
// Usage : node outils/generer-icones-pwa.mjs   (Edge est utilisé pour dessiner le SVG ; variable EDGE si msedge.exe est ailleurs)
// Les PNG sont commités : ce script ne sert que si on change le dessin.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SORTIE = path.join(RACINE, 'assets/icons/pwa');
const EDGE = process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORT = 9333;
const FOND = '#5B6334'; // kaki, couleur de la patte du site
const CLAIR = '#EEF3D3';

// La patte de l'icône du site (Lucide « paw-print »), tracée à part pour rester nette à toutes les tailles
const PATTE = (cote, x, y) => `<svg x="${x}" y="${y}" width="${cote}" height="${cote}" viewBox="0 0 24 24" fill="none" stroke="${CLAIR}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/></svg>`;

// Icône : fond plein (iOS n'aime pas la transparence), patte dans les 60 % centraux (zone sûre des icônes « maskable »)
const icone = (t) => `<svg xmlns="http://www.w3.org/2000/svg" width="${t}" height="${t}"><rect width="${t}" height="${t}" fill="${FOND}"/>${PATTE(t * 0.6, t * 0.2, t * 0.2)}</svg>`;
// Écran de démarrage : fond clair, patte et nom
const demarrage = (w, h) => {
  const c = Math.round(Math.min(w, h) * 0.26);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${CLAIR}"/><g transform="translate(0 0)">${PATTE(c, (w - c) / 2, h / 2 - c * 0.75).replace(`stroke="${CLAIR}"`, `stroke="${FOND}"`)}</g><text x="${w / 2}" y="${h / 2 + c * 0.55}" text-anchor="middle" font-family="Manrope, Segoe UI, sans-serif" font-weight="700" font-size="${Math.round(c * 0.26)}" fill="${FOND}">Carnet Patte</text></svg>`;
};

const TAILLES_ICONES = [72, 96, 120, 128, 144, 152, 167, 180, 192, 256, 384, 512];
const DEMARRAGES = [ // [largeur, hauteur] en pixels, portrait
  [1320, 2868], [1206, 2622], [1290, 2796], [1179, 2556], [1284, 2778], [1170, 2532], [1125, 2436], [1242, 2688], [828, 1792], [1242, 2208], [750, 1334],
];

fs.mkdirSync(SORTIE, { recursive: true });
const profil = path.join(RACINE, 'tests/sortie/prof-icones');
fs.rmSync(profil, { recursive: true, force: true });
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profil}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const dort = (ms) => new Promise((r) => setTimeout(r, ms));
let liste;
for (let i = 0; i < 40; i++) { try { liste = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (liste.find((t) => t.type === 'page')) break; } catch { /* Edge démarre */ } await dort(250); }
const ws = new WebSocket(liste.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let n = 0; const attente = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && attente.has(d.id)) { attente.get(d.id)(d); attente.delete(d.id); } };
const envoyer = (method, params = {}) => new Promise((r) => { const id = ++n; attente.set(id, r); ws.send(JSON.stringify({ id, method, params })); });

async function png(svg, w, h, fichier) {
  await envoyer('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await envoyer('Page.navigate', { url: `data:text/html;charset=utf-8,${encodeURIComponent(`<style>html,body{margin:0;background:#fff}svg{display:block}</style>${svg}`)}` });
  await dort(250);
  const r = await envoyer('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: w, height: h, scale: 1 } });
  fs.writeFileSync(path.join(SORTIE, fichier), Buffer.from(r.result.data, 'base64'));
  console.log(fichier);
}

await envoyer('Page.enable');
for (const t of TAILLES_ICONES) await png(icone(t), t, t, `icone-${t}.png`);
await png(icone(180), 180, 180, 'apple-touch-icon.png');
await png(icone(512), 512, 512, 'icone-maskable-512.png');
for (const [w, h] of DEMARRAGES) await png(demarrage(w, h), w, h, `demarrage-${w}x${h}.png`);
ws.close();
edge.kill();
process.exit(0);
