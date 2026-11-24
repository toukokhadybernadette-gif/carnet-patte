// Test « demenagement » : le site à sa nouvelle adresse (Cloudflare Pages) et l'ancienne adresse (GitHub Pages) qui explique le déménagement.
// Vérifie : assemblage du site (ce qui est publié, version, en-têtes), aucun nom de compte ni lien vers l'ancienne adresse dans le site,
// manifeste valable à la racine et en sous-dossier, bandeau « Carnet Patte a déménagé » (seulement sur *.github.io), page demenagement.html
// (export en un geste, marche à suivre, hors connexion, sombre), reprise des données là-bas, pages À propos et Mentions légales (champs à remplir,
// pas d'adresse postale), 375 et 390 px sans chevauchement, accessibilité.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ouvrirEdge, dort, jour } from './outil-cdp.mjs';
import { assembler } from '../outils/assembler-site.mjs';

const [S, , TAG] = process.argv.slice(2);
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { send, ev, log, verifier, texte, ecran, aller, importer, axe, fin, taille, controler } = await ouvrirEdge({ sortie: S, balise: TAG, port: +(process.env.PORT || 9350) });

// ===== 1. Assemblage du site (le même script que Cloudflare et GitHub) =====
log('--- 1. Assemblage du site ---');
const SITE = fs.mkdtempSync(path.join(os.tmpdir(), 'cp-site-'));
const r = assembler({ sortie: SITE, version: 'testdem1abcdef9999' });
const present = (f) => fs.existsSync(path.join(SITE, f));
verifier(['index.html', 'demenagement.html', 'manifest.webmanifest', 'sw.js', '_headers', 'js/app.js', 'css/sombre.css', 'modules/apropos/apropos.js', 'donnees/lieux/index.json', 'assets/icons/pwa/icone-192.png'].every(present), 'le site contient la page, la page de déménagement, le manifeste, sw.js, _headers, les scripts, les styles et les données');
verifier(!['tests', 'outils', '.github', 'README.md', 'A-FAIRE.md', 'CLAUDE.md', 'DEPLOIEMENT-CLOUDFLARE.md', 'captures-5f', '.outils-temp', 'node_modules'].some(present), 'ni tests, ni outils, ni notes, ni captures ne sont publiés');
const sw = fs.readFileSync(path.join(SITE, 'sw.js'), 'utf8');
verifier(sw.includes("const VERSION = 'testdem1abcd';") && !sw.includes('/*FICHIERS*/'), 'sw.js reçoit la version (12 premiers caractères du commit)');
const liste = JSON.parse(sw.match(/const FICHIERS = (\[.*?\]);/s)[1]);
verifier(liste.includes('demenagement.html') && liste.includes('index.html') && liste.every((f) => present(f)) && !liste.some((f) => f.startsWith('donnees/')), `${liste.length} fichiers à garder hors ligne, tous présents (demenagement.html compris)`);
const entetes = fs.readFileSync(path.join(SITE, '_headers'), 'utf8');
verifier(/\/sw\.js\r?\n\s+Cache-Control: no-cache/.test(entetes) && /\/index\.html\r?\n\s+Cache-Control: no-cache/.test(entetes) && /X-Content-Type-Options: nosniff/.test(entetes), '_headers : sw.js, index.html et manifeste toujours relus ; nosniff');
const cf = spawnSync(process.execPath, [path.join(RACINE, 'outils/assembler-site.mjs'), `--sortie=${path.join(SITE, '_cf')}`], { env: { ...process.env, CF_PAGES_COMMIT_SHA: 'cafebabe1234deadbeef' }, encoding: 'utf8' });
verifier(cf.status === 0 && fs.readFileSync(path.join(SITE, '_cf', 'sw.js'), 'utf8').includes("const VERSION = 'cafebabe1234';"), 'sur Cloudflare, la version vient de CF_PAGES_COMMIT_SHA');
fs.rmSync(path.join(SITE, '_cf'), { recursive: true, force: true });

// ===== 2. Rien qui contienne le nom du compte, aucun lien vers l'ancienne adresse =====
log('--- 2. Aucun nom, aucun lien absolu ---');
const textes = []; const parcourir = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) parcourir(p); else if (/\.(html|js|css|json|webmanifest|txt|md)$|^_headers$/.test(e.name)) textes.push([path.relative(SITE, p).replaceAll('\\', '/'), fs.readFileSync(p, 'utf8')]); } };
parcourir(SITE);
verifier(textes.length > 80 && !textes.some(([, t]) => /toukokhadybernadette/i.test(t)), `${textes.length} fichiers publiés lus : le nom du compte n’apparaît nulle part`);
verifier(!textes.some(([, t]) => /pages\.dev/i.test(t)), 'l’adresse technique de Cloudflare (*.pages.dev) n’apparaît dans AUCUN fichier du site : les utilisateurs ne voient que carnetpatte.com');
verifier(textes.some(([f, t]) => f === 'js/adresse.js' && t.includes("'https://carnetpatte.com/'")) && textes.some(([f, t]) => f === 'demenagement.html' && t.includes('https://carnetpatte.com/')), 'la nouvelle adresse est https://carnetpatte.com/ (bandeau et page de déménagement)');
const github = textes.filter(([, t]) => /github\.io/i.test(t)).map(([f]) => f);
verifier(JSON.stringify(github) === JSON.stringify(['js/adresse.js']), `« github.io » seulement dans js/adresse.js (détection de l'ancienne adresse) : ${github.join(', ')}`);
verifier(!textes.some(([, t]) => /https?:\/\/[^'"\s)]*\/carnet-patte\//i.test(t)), 'aucun lien absolu vers un sous-dossier /carnet-patte/');
const manifeste = JSON.parse(fs.readFileSync(path.join(SITE, 'manifest.webmanifest'), 'utf8'));
for (const [nom, base, attendu] of [['Cloudflare', 'https://carnetpatte.com/manifest.webmanifest', '/'], ['GitHub Pages', 'https://exemple.github.io/carnet-patte/manifest.webmanifest', '/carnet-patte/']]) {
  const chemins = [manifeste.scope, manifeste.start_url, manifeste.id].map((u) => new URL(u, base).pathname);
  verifier(chemins.every((c) => c === attendu) && manifeste.icons.every((i) => new URL(i.src, base).pathname.startsWith(attendu)), `manifeste sur ${nom} : portée, démarrage, identifiant et icônes sous ${attendu}`);
}

// ===== Serveur de test : le site assemblé, comme Cloudflare (« /demenagement » sans .html fonctionne) =====
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };
const serveur = http.createServer((req, res) => {
  let chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (chemin === '/') chemin = '/index.html';
  let f = path.join(SITE, chemin);
  if (!path.extname(f) && fs.existsSync(`${f}.html`)) f = `${f}.html`;
  if (!f.startsWith(SITE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404).end('introuvable'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] ?? 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${serveur.address().port}`;
await send('Page.navigate', { url: `${BASE}/index.html` }); await dort(2500);
await taille(375, 812);

// ===== 3. Bandeau sur l'ancienne adresse seulement =====
log('--- 3. Bandeau « Carnet Patte a déménagé » ---');
const hotes = await ev(`import('/js/adresse.js').then((m) => ['quelquun.github.io', 'QUELQUUN.GitHub.io', 'carnetpatte.com', 'www.carnetpatte.com', 'carnet-patte.pages.dev', 'github.io.evil.example', 'github.io', '127.0.0.1', 'localhost'].map((h) => [h, m.estAncienneAdresse(h)]))`);
verifier(JSON.stringify(hotes.map(([, v]) => v)) === JSON.stringify([true, true, false, false, false, false, false, false, false]), `reconnaît *.github.io et rien d'autre : ${hotes.map(([h, v]) => h + '=' + v).join(', ')}`);
verifier(await ev(`!document.querySelector('.pwa-demenage')`), 'sur la nouvelle adresse (ici 127.0.0.1) : aucun bandeau');
await ev(`import('/js/adresse.js').then((m) => { m.afficherBandeauDemenagement({ hote: 'quelquun.github.io' }); m.afficherBandeauDemenagement({ hote: 'quelquun.github.io' }); })`);
verifier(await ev(`document.querySelectorAll('.pwa-demenage').length`) === 1, 'sur *.github.io : un seul bandeau (pas de doublon)');
const t = await texte('.pwa-demenage');
verifier(t.includes('Carnet Patte a déménagé') && t.includes('carnetpatte.com') && !t.includes('pages.dev') && await ev(`document.querySelector('.pwa-demenage a').getAttribute('href')`) === 'demenagement.html' && await ev(`document.querySelector('.pwa-demenage').getAttribute('role')`) === 'region', `bandeau : « ${t} » → demenagement.html`);
await controler('bandeau à 375 px', '.pwa-demenage'); await ecran('bandeau');
await taille(390, 844); await controler('bandeau à 390 px', '.pwa-demenage'); await taille(375, 812);
await ev(`document.querySelector('.pwa-demenage').remove()`);

// ===== 4. Page de déménagement =====
log('--- 4. Page demenagement.html ---');
const fichier = { version: 1, exemplesAjoutes: true, exporteLe: '2026-01-01T00:00:00.000Z',
  animaux: [{ id: 'a', nom: 'Moka', espece: 'chien', especeAutre: '', race: '', naissance: '2023-08-01', photo: '' }, { id: 'b', nom: 'Filou', espece: 'chat', especeAutre: '', race: '', naissance: '', photo: '' }],
  soins: [{ id: 's1', animalId: 'a', type: 'vermifuge', titre: '', date: jour(-60), notes: '', rappel: jour(5), rappelFait: false }], pesees: [] };
await importer(fichier);
await ev(`import('/js/documents-db.js').then((d) => d.ajouterDocument({ animalId: 'a', titre: 'Carnet', date: '2026-02-02', type: 'vaccination', blob: new Blob(['%PDF-1.4 essai'], { type: 'application/pdf' }), nom: 'c.pdf' }))`);
await send('Page.navigate', { url: `${BASE}/demenagement.html` }); await dort(1800);
verifier(await texte('h1') === 'Carnet Patte a déménagé' && await ev(`!document.querySelector('#contenu')`), 'la page de déménagement s’affiche (et non l’appli), même avec le service worker actif');
verifier(await ev(`document.querySelector('[data-lien-nouvelle]').href`) === 'https://carnetpatte.com/' && (await texte('[data-nouvelle]')) === 'carnetpatte.com', 'bouton « Ouvrir la nouvelle adresse » → https://carnetpatte.com/');
const etapes = await ev(`[...document.querySelectorAll('ol > li')].map((l) => l.textContent.replace(/\\s+/g, ' ').trim())`);
verifier(etapes.length === 4 && /^Exporter ici/.test(etapes[0]) && /^Ouvrir la nouvelle adresse/.test(etapes[1]) && /^Importer là-bas.*Profil → Sauvegarde.*Choisir un fichier/.test(etapes[2]) && /^Réinstaller l'appli.*Sur l'écran d'accueil/.test(etapes[3]), 'quatre étapes : Exporter ici → ouvrir → Importer là-bas (Profil → Sauvegarde) → réinstaller');
await dort(600);
verifier(/2 animaux, 1 document, environ/.test(await texte('#etat')), `la page annonce ce qui sera sauvegardé : ${await texte('#etat')}`);
await ev(`(() => { window.__dl = []; window.__blobs = []; const o = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { b.text().then((x) => window.__blobs.push(x)); return o(b); }; const c = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) window.__dl.push(this.download); else c.call(this); }; })()`);
await ev(`document.querySelector('#exporter').click()`); await dort(900);
const nomDl = (await ev(`window.__dl`))[0];
const exporte = JSON.parse((await ev(`window.__blobs`))[0] ?? 'null');
verifier(/^carnet-patte-\d{4}-\d{2}-\d{2}\.json$/.test(nomDl) && exporte?.animaux?.length === 2 && exporte.documents?.length === 1 && exporte.soins.length === 1, `« Télécharger ma sauvegarde » : ${nomDl} avec 2 animaux, 1 soin, 1 document`);
verifier(/Sauvegarde téléchargée/.test(await texte('#etat')), 'message de confirmation');
await ecran('demenagement'); await axe('main', 'page de déménagement');
await controler('page de déménagement à 375 px', 'main');
await taille(390, 844); await controler('page de déménagement à 390 px', 'main'); await taille(375, 812);
// « Là-bas » : une origine vide reçoit le fichier
await send('Page.navigate', { url: `${BASE}/index.html` }); await dort(1500);
await ev(`import('/js/sauvegarde.js').then((m) => m.toutEffacerTout())`); await dort(300);
const res = await ev(`import('/js/sauvegarde.js').then((m) => m.importerTout(${JSON.stringify(JSON.stringify(exporte))}))`);
verifier(res.documents === 1 && (await ev(`import('/js/storage.js').then((m) => m.lister('animaux').map((a) => a.nom).join())`)) === 'Moka,Filou', 'importer le fichier ailleurs : animaux, soin et document retrouvés');
// Sombre
await ev(`localStorage.setItem('carnetpatte.mode', 'sombre')`);
await send('Page.navigate', { url: `${BASE}/demenagement.html` }); await dort(1500);
verifier(await ev(`document.documentElement.dataset.mode`) === 'dark' && (await ev(`getComputedStyle(document.body).backgroundColor`)).match(/\d+/g).slice(0, 3).every((v) => Number(v) < 70), 'la page suit le mode sombre');
await ecran('demenagement-sombre'); await axe('main', 'page de déménagement en sombre');
await ev(`localStorage.removeItem('carnetpatte.mode')`);

// ===== 5. Hors connexion : la page de déménagement s'ouvre aussi =====
log('--- 5. Hors connexion ---');
await send('Page.navigate', { url: `${BASE}/index.html` }); await dort(1500);
for (let i = 0; i < 40 && !(await ev(`!!navigator.serviceWorker.controller`)); i++) await dort(250);
await new Promise((ok) => { serveur.close(ok); serveur.closeAllConnections(); });
await send('Page.navigate', { url: `${BASE}/demenagement.html` }); await dort(1800);
verifier(await texte('h1') === 'Carnet Patte a déménagé' && await ev(`!document.querySelector('#contenu')`), 'serveur arrêté : demenagement.html s’ouvre depuis le cache');
await send('Page.navigate', { url: `${BASE}/demenagement` }); await dort(1800);
verifier(await texte('h1') === 'Carnet Patte a déménagé', 'et /demenagement (sans « .html », comme sur Cloudflare) aussi');
await send('Page.navigate', { url: `${BASE}/index.html` }); await dort(1800);
verifier(await ev(`!!document.querySelector('#contenu')`), 'l’appli elle-même s’ouvre toujours hors connexion');
await new Promise((ok) => { serveur.listen(+BASE.split(':')[2], '127.0.0.1', ok); });

// ===== 6. À propos et Mentions légales =====
log('--- 6. À propos et Mentions légales ---');
await aller('#/profil'); await dort(500);
verifier(await ev(`[...document.querySelectorAll('a[href="#/apropos"]')].some((a) => a.textContent.includes('À propos'))`), 'Profil : ligne « À propos »');
await aller('#/apropos'); await dort(500);
verifier(await texte('h1') === 'À propos' && await ev(`document.querySelector('a[href="#/mentions"]').textContent.trim()`) === 'Mentions légales', 'page À propos avec le bouton « Mentions légales »');
verifier((await texte('#contenu')).includes('ODbL') && (await texte('#contenu')).includes('Licence Ouverte 2.0') && (await texte('#contenu')).includes('Leaflet'), 'sources et licences rappelées');
await controler('À propos à 375 px'); await axe('#contenu', 'À propos');
await aller('#/mentions'); await dort(500);
verifier(await texte('h1') === 'Mentions légales', 'page Mentions légales');
const vides = await ev(`[...document.querySelectorAll('[data-champ]')].filter((e) => e.querySelector('.ap-vide')).map((e) => e.dataset.champ)`);
verifier(vides.length === 0, `nom, SIRET et directeur de la publication renseignés (js/mentions-config.js), plus de « [à compléter] »`);
verifier(await ev(`document.querySelector('[data-champ=email] a')?.getAttribute('href')`) === 'mailto:contact@carnetpatte.com' && (await texte('[aria-labelledby=ml-donnees]')).includes('contact@carnetpatte.com'), 'e-mail de contact : contact@carnetpatte.com (éditeur et droits sur les données) ');
verifier(await texte('[data-champ=statut]') === 'Entrepreneur individuel (EI) – micro-entreprise' && await ev(`!document.querySelector('[data-champ=adresse]')`), 'statut « Entrepreneur individuel (EI) – micro-entreprise » ; AUCUNE adresse postale affichée pour l’éditeur');
verifier(await texte('[data-champ=hebergeur]') === 'Cloudflare, Inc.' && (await texte('[aria-labelledby=ml-hebergeur]')).includes('101 Townsend Street'), 'hébergeur : Cloudflare, Inc. et son adresse');
verifier((await texte('[aria-labelledby=ml-donnees]')).includes('Compte facultatif, aucun suivi') && (await texte('[aria-labelledby=ml-donnees]')).includes('OpenStreetMap') && (await texte('[aria-labelledby=ml-donnees]')).includes('Tout effacer'), 'données personnelles : rien collecté, ce qui sort de l’appareil, comment tout effacer');
await controler('Mentions légales à 375 px'); await ecran('mentions-vides'); await axe('#contenu', 'Mentions légales (champs vides)');
// Champs remplis, adresse remplie, sur l'ancienne adresse
await ev(`import('/modules/apropos/apropos.js').then((m) => m.rendreMentions(document.querySelector('#contenu > div'), { nom: 'Jeanne <b>Martin</b>', statut: 'Micro-entreprise', siret: '123 456 789 00012', email: 'contact@exemple.fr', adresse: '1 rue des Lilas, 35000 Rennes' }, 'quelquun.github.io'))`); await dort(300);
const rempli = await ev(`({ vides: document.querySelectorAll('.ap-vide').length, nom: document.querySelector('[data-champ=nom]').textContent, gras: !!document.querySelector('[data-champ=nom] b'), mail: document.querySelector('[data-champ=email] a')?.getAttribute('href'), directeur: document.querySelector('[data-champ=directeur]').textContent, adresse: document.querySelector('[data-champ=adresse]')?.textContent, heb: document.querySelector('[data-champ=hebergeur]').textContent })`);
verifier(rempli.vides === 0 && rempli.nom === 'Jeanne <b>Martin</b>' && !rempli.gras && rempli.mail === 'mailto:contact@exemple.fr' && rempli.directeur === rempli.nom, 'champs remplis : plus de « [à compléter] », le texte saisi est protégé (pas de HTML), le directeur de la publication est l’éditeur');
verifier(rempli.adresse === '1 rue des Lilas, 35000 Rennes' && rempli.heb === 'GitHub, Inc.', 'l’adresse n’apparaît que si on la renseigne ; sur *.github.io l’hébergeur affiché est GitHub');
await axe('#contenu', 'Mentions légales (champs remplis)');
await taille(390, 844); await aller('#/mentions'); await dort(400); await controler('Mentions légales à 390 px'); await taille(375, 812);

// Aller-retour export / import des données
const exp1 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
await ev(`import('/js/storage.js').then(m=>m.toutEffacer())`);
await ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(exp1)}))`);
const exp2 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
const net = (x) => { const o = JSON.parse(x); delete o.exporteLe; return JSON.stringify(o); };
serveur.close(); serveur.closeAllConnections();
fs.rmSync(SITE, { recursive: true, force: true });
fin(net(exp1) === net(exp2));
