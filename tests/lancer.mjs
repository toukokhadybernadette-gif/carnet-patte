// Lance les tests de bout en bout : démarre un petit serveur local sur le projet, puis exécute chaque script dans Edge (sans fenêtre).
// Usage : node tests/lancer.mjs [--rapide] [--jobs=N] [5e] [5f] [finitions] [5g] [5h] [secours] [migration] [couleurs] [verre] [graphique] [retouches] [toxique] [refonte] [etroit] [carte] [boutique] [carte-reel] [boutique-liens] [installable] [calendrier] [documents] [garde] [ferme] [sombre] [demenagement] [compte]
//   « carte-reel » appelle les VRAIS serveurs OpenStreetMap : il n'est jamais lancé par la suite automatique ni par --rapide, seulement à la main (node tests/lancer.mjs carte-reel)
//   sans argument : tous les tests, 2 à la fois (--jobs=N change le nombre de tests simultanés)
//   --rapide : uniquement les tests liés aux fichiers modifiés (non commités + commits de la branche depuis main)
// Résultats complets : tests/sortie/<test>.txt · captures d'écran : tests/sortie/shots/

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
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
  verre: 'test-verre.mjs',
  graphique: 'test-graphique.mjs',
  retouches: 'test-retouches.mjs',
  toxique: 'test-toxique.mjs',
  refonte: 'test-refonte.mjs',
  etroit: 'test-etroit.mjs',
  carte: 'test-carte.mjs',
  boutique: 'test-boutique.mjs',
  'carte-reel': 'test-carte-reel.mjs',
  'boutique-liens': 'test-boutique-liens.mjs',
  installable: 'test-installable.mjs',
  calendrier: 'test-calendrier.mjs',
  documents: 'test-documents.mjs',
  garde: 'test-garde.mjs',
  ferme: 'test-ferme.mjs',
  sombre: 'test-sombre.mjs',
  demenagement: 'test-demenagement.mjs',
  compte: 'test-compte.mjs',
};
const MANUELS = new Set(['carte-reel', 'boutique-liens']); // jamais dans « tous les tests » (internet et serveurs publics requis)
const AUTOMATIQUES = Object.keys(TESTS).filter((t) => !MANUELS.has(t));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.txt': 'text/plain' };

// Fichier modifié → tests concernés (première règle qui correspond). Un fichier sans règle est considéré central : on lance tout. [] = sans effet sur les tests.
const REGLES = [
  [/^js\/(compte|supabase-config)\.js$|^modules\/compte\/|^assets\/supabase\/|^SUPABASE\.md$/, ['compte', 'installable', 'etroit']],
  [/^demenagement\.html$|^_headers$|^js\/(adresse|mentions-config)\.js$|^modules\/apropos\/|^outils\/assembler-site\.mjs$/, ['demenagement', 'installable', 'etroit']],
  [/^css\/(sombre|themes-sombre)\.css$|^js\/couleurs-sombre\.js$/, ['sombre', 'refonte', 'couleurs', 'verre', 'etroit']],
  [/^modules\/ferme\//, ['ferme', '5e', '5f', 'finitions', 'etroit', 'retouches']],
  [/^js\/pdf\.js$|^modules\/animaux\/garde\.js$/, ['garde', 'etroit']],
  [/^js\/documents-db\.js$|^js\/sauvegarde\.js$|^js\/donnees\.js$|^modules\/animaux\/documents\.js$/, ['documents', 'migration', 'secours', 'etroit']],
  [/^js\/ics\.js$|^modules\/animaux\/calendrier\.js$/, ['calendrier', '5f', '5e', 'finitions', 'etroit']],
  [/^js\/pwa\.js$|^sw\.js$|^manifest\.webmanifest$|^css\/pwa\.css$|^assets\/icons\/pwa\/|^outils\/(preparer-sw|generer-icones-pwa)\.mjs$|^\.github\/workflows\/pages\.yml$|^tests\/outil-cdp\.mjs$/, ['installable', 'calendrier', 'etroit']],
  [/^modules\/carte\/|^assets\/leaflet\//, ['carte', 'etroit']],
  [/^modules\/boutique\//, ['boutique', 'finitions', 'etroit']],
  [/^donnees\/|^outils\/|^\.github\/workflows\/(lieux-mensuel|pages)\.yml$/, ['carte']],
  [/^tests\/lancer\.mjs$|\.md$|^\.github\/|^\.gitignore$|^assets\/|^tests\/sortie\//, []],
  [/^tests\/test-(.+)\.mjs$/, (m) => [Object.keys(TESTS).find((k) => TESTS[k] === `test-${m[1]}.mjs`)].filter(Boolean)],
  [/^css\/verre\.css$|^js\/fond\.js$/, ['verre', 'etroit']],
  [/^css\/(refonte|themes)\.css$|^js\/(theme|couleurs-theme|illustrations)\.js$/, ['refonte', 'couleurs', 'verre', 'etroit']],
  [/^modules\/toxique\/|^js\/bientot\.js$/, ['toxique', 'etroit']],
  [/^modules\/animaux\/soins\.js$/, ['5e', '5f', 'finitions', 'etroit']],
  [/^modules\/animaux\/rappels\.js$/, ['5f', '5e', 'finitions', 'etroit']],
  [/^modules\/animaux\/pesees\.js$/, ['5g', 'graphique', 'finitions']],
  [/^modules\/animaux\/(fiche|animaux|commun|exemples)\.js$|^modules\/animaux\/animaux\.css$/, ['5e', '5f', '5g', '5h', 'finitions', 'retouches', 'etroit']],
  [/^js\/conseils\.js$/, ['5h', 'verre']],
  [/^modules\/(accueil|boutique|communaute|composants|pro|profil)\//, ['finitions', 'refonte', 'etroit', 'carte']],
];

function testsLiesAuxModifications() {
  const git = (...a) => spawnSync('git', a, { cwd: RACINE, encoding: 'utf8' }).stdout ?? '';
  const fichiers = new Set([
    ...git('diff', '--name-only', 'main...HEAD').split('\n'),
    ...git('status', '--porcelain', '-uall').split('\n').map((l) => l.slice(3).replace(/^"|"$/g, '').split(' -> ').pop()),
  ].map((f) => f.trim()).filter(Boolean));
  const tests = new Set();
  const centraux = [];
  for (const f of fichiers) {
    const regle = REGLES.find(([re]) => re.test(f));
    if (!regle) { centraux.push(f); continue; }
    const r = typeof regle[1] === 'function' ? regle[1](f.match(regle[0])) : regle[1];
    r.forEach((t) => tests.add(t));
  }
  if (centraux.length) {
    console.log(`Fichier(s) central(aux) modifié(s) (${centraux.join(', ')}) : ils touchent toute l'application, tous les tests sont lancés.`);
    return AUTOMATIQUES;
  }
  console.log(`Fichiers modifiés : ${fichiers.size}. Tests concernés : ${[...tests].join(', ') || 'aucun'}.`);
  return AUTOMATIQUES.filter((t) => tests.has(t));
}

const args = process.argv.slice(2);
const rapide = args.includes('--rapide');
const jobs = Math.max(1, Number((args.find((a) => a.startsWith('--jobs=')) ?? '').slice(7)) || 2);
const choisis = args.filter((a) => !a.startsWith('--'));
const aLancer = choisis.length ? choisis : rapide ? testsLiesAuxModifications() : AUTOMATIQUES;
const inconnus = aLancer.filter((t) => !TESTS[t]);
if (inconnus.length) { console.error(`Test inconnu : ${inconnus.join(', ')}. Choix possibles : ${Object.keys(TESTS).join(', ')}`); process.exit(2); }
if (!aLancer.length) { console.log('Rien à tester : aucun fichier modifié ne concerne les tests.'); process.exit(0); }

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
console.log(`Serveur local : ${url} · ${aLancer.length} test(s), ${Math.min(jobs, aLancer.length)} à la fois\n`);

const debut = Date.now();
const duree = (ms) => { const s = Math.round(ms / 1000); return s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`; };
const resultats = [];
let port = 9400;

// Un test = un processus séparé (le serveur doit rester libre de répondre). Port de débogage et profil Edge propres à chaque test : pas de collision en parallèle.
function lance(nom) {
  const script = path.join(ICI, TESTS[nom]);
  const sortie = path.join(SORTIE, `${nom}.txt`);
  const t0 = Date.now();
  return new Promise((fini) => {
    const enfant = spawn(process.execPath, [script, SORTIE, url, nom], { env: { ...process.env, PORT: String(port++), NO_COLOR: '1', FORCE_COLOR: '0' } });
    let texte = '';
    enfant.stdout.on('data', (d) => { texte += d; });
    enfant.stderr.on('data', (d) => { texte += d; });
    const limite = setTimeout(() => enfant.kill(), 420000);
    enfant.on('close', (c) => {
      clearTimeout(limite);
      fs.writeFileSync(sortie, texte);
      const t = texte.replace(/\u001b\[[0-9;]*m/g, ''); // certains terminaux imposent des couleurs : on les retire avant de lire les résultats
      const violations = (t.match(/VIOLATIONS/g) ?? []).length;
      const axeOk = (t.match(/ 0 violation/g) ?? []).length;
      const consoleOk = /ERREURS CONSOLE : aucune/.test(t);
      const allerRetour = /identique : true/.test(t);
      const echecsVerif = Number((t.match(/VÉRIFICATIONS EN ÉCHEC : (\d+)/) ?? [])[1] ?? 0);
      const ok = c === 0 && violations === 0 && consoleOk && allerRetour && echecsVerif === 0;
      resultats.push({ nom, ok });
      console.log(`${ok ? 'OK    ' : 'ÉCHEC '} ${nom.padEnd(10)} ${axeOk} contrôles d'accessibilité à 0 violation, ${violations} avec violations · console ${consoleOk ? 'propre' : 'AVEC ERREURS'} · export/import ${allerRetour ? 'identique' : 'DIFFÉRENT'}${echecsVerif ? ` · ${echecsVerif} vérification(s) en échec` : ''}${c === 0 ? '' : ` · le script s'est arrêté (code ${c})`} · ${duree(Date.now() - t0)}`);
      fini();
    });
  });
}

const file = [...aLancer];
await Promise.all(Array.from({ length: Math.min(jobs, file.length) }, async () => { while (file.length) await lance(file.shift()); }));
serveur.close();

const echecs = resultats.filter((r) => !r.ok);
console.log(`\n=== RÉSUMÉ ===\n${resultats.length - echecs.length} test(s) OK sur ${resultats.length} · ${echecs.length} échec(s)${echecs.length ? ` : ${echecs.map((r) => r.nom).join(', ')}` : ''} · durée totale ${duree(Date.now() - debut)}`);
if (echecs.length) console.log(`Détails : ${echecs.map((r) => `tests/sortie/${r.nom}.txt`).join(', ')}`);
console.log('(Lisez aussi les lignes « = false » dans les fichiers de sortie : chaque test affiche ses vérifications.)');
process.exit(echecs.length ? 1 : 0);
