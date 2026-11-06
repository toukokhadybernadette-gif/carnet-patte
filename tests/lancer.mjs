// Lance les tests de bout en bout : démarre un petit serveur local sur le projet, puis exécute chaque script dans Edge (sans fenêtre).
// Usage : node tests/lancer.mjs [5e] [5f] [finitions] [5g] [5h] [secours] [migration] [couleurs]     (sans argument : tous les tests)
// Résultats complets : tests/sortie/<test>.txt · captures d'écran : tests/sortie/shots/

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const SORTIE = path.join(ICI, 'sortie');

const TESTS = {
  '5e': 'test-5e-soins.mjs',
  '5f': 'test-5f-rappels.mjs',
  finitions: 'test-finitions.mjs',
  '5g': 'test-5g-pesees.mjs',
  '5h': 'test-5h-prenom.mjs',
  secours: 'test-secours.mjs',
  migration: 'test-migration.mjs',
  couleurs: 'test-couleurs.mjs',
};
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.txt': 'text/plain' };

const choisis = process.argv.slice(2);
const aLancer = choisis.length ? choisis : Object.keys(TESTS);
const inconnus = aLancer.filter((t) => !TESTS[t]);
if (inconnus.length) { console.error(`Test inconnu : ${inconnus.join(', ')}. Choix possibles : ${Object.keys(TESTS).join(', ')}`); process.exit(2); }

fs.rmSync(path.join(SORTIE, 'shots'), { recursive: true, force: true });
fs.mkdirSync(SORTIE, { recursive: true });

const serveur = http.createServer((req, res) => {
  const chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const fichier = path.join(RACINE, chemin === '/' ? 'index.html' : chemin);
  if (!fichier.startsWith(RACINE) || fichier.startsWith(ICI) || !fs.existsSync(fichier) || fs.statSync(fichier).isDirectory()) { res.writeHead(404).end('introuvable'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fichier)] ?? 'application/octet-stream' });
  fs.createReadStream(fichier).pipe(res);
});
await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${serveur.address().port}/index.html`;
console.log(`Serveur local : ${url}\n`);

let echecs = 0;
let port = 9400;
for (const nom of aLancer) {
  const script = path.join(ICI, TESTS[nom]);
  const sortie = path.join(SORTIE, `${nom}.txt`);
  // spawnSync bloquerait le serveur : on lance le test dans un processus séparé et on attend sa fin de façon asynchrone
  const { spawn } = await import('node:child_process');
  const code = await new Promise((fini) => {
    const enfant = spawn(process.execPath, [script, SORTIE, url, nom], { env: { ...process.env, PORT: String(port++) } });
    let texte = '';
    enfant.stdout.on('data', (d) => { texte += d; });
    enfant.stderr.on('data', (d) => { texte += d; });
    const limite = setTimeout(() => enfant.kill(), 280000);
    enfant.on('close', (c) => { clearTimeout(limite); fs.writeFileSync(sortie, texte); fini({ c, texte }); });
  });
  const t = code.texte;
  const violations = (t.match(/VIOLATIONS/g) ?? []).length;
  const axeOk = (t.match(/ 0 violation/g) ?? []).length;
  const consoleOk = /ERREURS CONSOLE : aucune/.test(t);
  const allerRetour = /identique : true/.test(t);
  const echecsVerif = Number((t.match(/VÉRIFICATIONS EN ÉCHEC : (\d+)/) ?? [])[1] ?? 0);
  const ok = code.c === 0 && violations === 0 && consoleOk && allerRetour && echecsVerif === 0;
  if (!ok) echecs++;
  console.log(`${ok ? 'OK    ' : 'ÉCHEC '} ${nom.padEnd(10)} ${axeOk} contrôles d'accessibilité à 0 violation, ${violations} avec violations · console ${consoleOk ? 'propre' : 'AVEC ERREURS'} · export/import ${allerRetour ? 'identique' : 'DIFFÉRENT'}${echecsVerif ? ` · ${echecsVerif} vérification(s) en échec` : ''}${code.c === 0 ? '' : ` · le script s'est arrêté (code ${code.c})`}`);
}
serveur.close();
console.log(`\n${echecs ? `${echecs} test(s) en échec : voir tests/sortie/<test>.txt` : 'Tous les tests passent.'} (lisez aussi les lignes « = false » dans les fichiers de sortie : chaque test affiche ses vérifications.)`);
process.exit(echecs ? 1 : 0);
