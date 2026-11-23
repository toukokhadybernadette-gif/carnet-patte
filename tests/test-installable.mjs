// Test « installable » : l'appli s'installe sur l'écran d'accueil et s'ouvre sans connexion.
// Vérifie : manifeste et icônes, réglages iPhone, service worker (enregistré sur 127.0.0.1), mode développement sans cache, mise en cache,
// ouverture hors connexion (le serveur de test est VRAIMENT arrêté), message de la Carte hors ligne, bannière « Nouvelle version disponible »,
// mise à jour sur demande, données des animaux jamais touchées, aide « Installer sur votre iPhone » (masquée si déjà installée).
// Ce test démarre son propre serveur (pour l'arrêter, le relancer et servir deux versions de sw.js) ; il n'appelle aucun serveur extérieur.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ouvrirEdge, dort, jour } from './outil-cdp.mjs';
import { preparerSw, listerFichiers } from '../outils/preparer-sw.mjs';

const [S, URL_PARTAGEE, TAG] = process.argv.slice(2);
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };
const { send, ev, log, verifier, texte, ecran, donnees, aller, importer, axe, erreurs, fin } = await ouvrirEdge({ sortie: S, balise: TAG, port: +(process.env.PORT || 9350) });

// ----- Serveur du test : le projet, avec sw.js « publié » sous la version courante -----
let version = 't1';
const serveur = http.createServer((req, res) => {
  const chemin = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (chemin === '/sw.js') { res.writeHead(200, { 'Content-Type': MIME['.js'], 'Cache-Control': 'max-age=3600' }).end(preparerSw(version)); return; } // un cache HTTP long : le navigateur doit quand même voir la nouvelle version
  // Comme Cloudflare Pages : /index.html → /, /demenagement.html → /demenagement (réponses REDIRIGÉES, que le service worker ne doit jamais servir telles quelles)
  if (chemin === '/index.html' || chemin === '/demenagement.html') { res.writeHead(308, { Location: chemin === '/index.html' ? '/' : '/demenagement' }).end(); return; }
  const fichier = path.join(RACINE, chemin === '/' ? 'index.html' : chemin === '/demenagement' ? 'demenagement.html' : chemin);
  if (!fichier.startsWith(RACINE) || fichier.startsWith(path.join(RACINE, 'tests')) || !fs.existsSync(fichier) || fs.statSync(fichier).isDirectory()) { res.writeHead(404).end('introuvable'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fichier)] ?? 'application/octet-stream' });
  fs.createReadStream(fichier).pipe(res);
});
const demarrer = (port = 0) => new Promise((ok) => serveur.listen(port, '127.0.0.1', ok));
await demarrer();
const PORT = serveur.address().port;
const BASE = `http://127.0.0.1:${PORT}`;
const arreter = () => new Promise((ok) => { serveur.close(ok); serveur.closeAllConnections(); });
const lire = async (u) => fetch(`${BASE}/${u}`);

// ===== 1. Manifeste, icônes, réglages iPhone =====
log('--- 1. Manifeste et réglages iPhone ---');
const rm = await lire('manifest.webmanifest');
const m = await rm.json();
verifier(rm.ok && /manifest\+json/.test(rm.headers.get('content-type')), `manifeste lisible (${rm.headers.get('content-type')})`);
verifier(m.name === 'Carnet Patte' && m.short_name === 'Carnet Patte', 'nom : Carnet Patte');
verifier(m.display === 'standalone', 'affichage : standalone (plein écran, sans barre du navigateur)');
verifier(/^#[0-9A-Fa-f]{6}$/.test(m.theme_color) && /^#[0-9A-Fa-f]{6}$/.test(m.background_color), `couleur du thème ${m.theme_color}, fond ${m.background_color}`);
const publie = 'https://exemple.github.io/carnet-patte/manifest.webmanifest';
verifier(new URL(m.scope, publie).pathname === '/carnet-patte/' && new URL(m.start_url, publie).pathname === '/carnet-patte/', `publié sur GitHub Pages : portée ${new URL(m.scope, publie).pathname}, démarrage ${new URL(m.start_url, publie).pathname}`);
verifier(m.lang === 'fr' && m.id, 'langue fr, identifiant de l’appli');
const tailles = new Set(); let iconesOk = true; let maskable = false;
for (const ic of m.icons) {
  const r = await lire(ic.src); const buf = Buffer.from(await r.arrayBuffer());
  const [w, h] = ic.sizes.split('x').map(Number);
  const png = buf.subarray(1, 4).toString() === 'PNG' && buf.readUInt32BE(16) === w && buf.readUInt32BE(20) === h;
  if (!r.ok || !png || ic.type !== 'image/png') { iconesOk = false; log('  icône défectueuse :', ic.src); }
  tailles.add(w); if (ic.purpose === 'maskable') maskable = true;
}
verifier(iconesOk && [72, 96, 128, 144, 152, 192, 384, 512].every((t) => tailles.has(t)), `icônes PNG existantes, à la taille annoncée : ${[...tailles].sort((a, b) => a - b).join(', ')}`);
verifier(maskable, 'une icône « maskable » (adaptée aux masques Android)');
const html = await (await lire('index.html')).text();
const balise = (re) => (html.match(re) ?? [])[1];
verifier(balise(/<link rel="manifest" href="([^"]+)"/) === 'manifest.webmanifest', 'index.html relie le manifeste');
const apple = balise(/<link rel="apple-touch-icon" href="([^"]+)"/);
const ra = await lire(apple); const ba = Buffer.from(await ra.arrayBuffer());
verifier(ra.ok && ba.readUInt32BE(16) === 180 && ba.readUInt32BE(20) === 180 && ba[25] === 2, `apple-touch-icon 180×180, sans transparence (${apple})`);
verifier(/<meta name="apple-mobile-web-app-capable" content="yes">/.test(html) && /<meta name="mobile-web-app-capable" content="yes">/.test(html), 'ouverture plein écran depuis l’écran d’accueil (iPhone et Android)');
verifier(/<meta name="apple-mobile-web-app-status-bar-style" content="(default|black-translucent)">/.test(html) && /<meta name="theme-color" content="#[0-9A-Fa-f]{6}">/.test(html), 'barre d’état réglée, couleur du thème présente (js/theme.js la suit quand on change de thème)');
verifier(/<meta name="apple-mobile-web-app-title" content="Carnet Patte">/.test(html), 'nom sous l’icône : Carnet Patte');
const demarrages = [...html.matchAll(/<link rel="apple-touch-startup-image" href="([^"]+)" media="[^"]*device-width: (\d+)px[^"]*device-height: (\d+)px[^"]*-webkit-device-pixel-ratio: (\d)/g)];
let demarragesOk = demarrages.length >= 8;
for (const [, src, cw, ch, ratio] of demarrages) { const b = Buffer.from(await (await lire(src)).arrayBuffer()); if (b.readUInt32BE(16) !== cw * ratio || b.readUInt32BE(20) !== ch * ratio) { demarragesOk = false; log('  écran de démarrage de mauvaise taille :', src); } }
verifier(demarragesOk, `${demarrages.length} écrans de démarrage iPhone, chacun à la taille exacte de son écran`);
const liste = listerFichiers();
verifier(liste.includes('index.html') && liste.includes('js/app.js') && liste.includes('css/base.css') && liste.includes('modules/toxique/donnees.js') && liste.includes('assets/icons/pwa/icone-192.png') && liste.includes('assets/fonts/inter-latin-wght.woff2') && liste.includes('assets/leaflet/leaflet.js'), `liste de mise en cache : ${liste.length} fichiers (page, styles, scripts, données Toxique, icônes, polices, Leaflet)`);
verifier(!liste.some((f) => f.startsWith('donnees/') || f.startsWith('tests/') || /demarrage-/.test(f)), 'ni les lieux (gardés à la demande), ni les tests, ni les écrans de démarrage ne sont dans la liste');

// ===== 2. Mode développement : le service worker ne met rien en cache =====
log('--- 2. Développement (sw.js tel quel) ---');
await send('Page.navigate', { url: URL_PARTAGEE }); await dort(2500);
const dev = await ev(`navigator.serviceWorker.getRegistration().then(async (r) => ({ scope: r?.scope ?? null, actif: !!(r?.active || r?.installing || r?.waiting), caches: await caches.keys() }))`);
verifier(dev.scope && dev.actif, `service worker enregistré sur ${dev.scope}`);
verifier(dev.caches.filter((c) => c.startsWith('carnetpatte-app-')).length === 0, 'version « dev » : aucun cache de l’appli (on voit toujours les fichiers à jour)');

// ===== 3. Première installation (version t1) =====
log('--- 3. Installation et mise en cache ---');
await send('Network.enable');
await send('Network.setBlockedURLs', { urls: ['*tile.openstreetmap.org*', '*nominatim.openstreetmap.org*', '*overpass*'] }); // aucun vrai serveur de carte
await send('Page.navigate', { url: `${BASE}/index.html` }); await dort(2500);
await ev(`navigator.serviceWorker.ready.then(() => true)`);
for (let i = 0; i < 40 && !(await ev(`!!navigator.serviceWorker.controller`)); i++) await dort(250);
const noms = () => ev(`caches.keys()`);
verifier(await ev(`!!navigator.serviceWorker.controller`), 'le service worker contrôle la page (dès la première visite)');
const reg = await ev(`navigator.serviceWorker.getRegistration().then((r) => r.scope)`);
verifier(reg === `${BASE}/`, `service worker enregistré sur localhost : ${reg}`);
verifier((await noms()).includes('carnetpatte-app-t1'), `cache de la version t1 créé : ${(await noms()).join(', ')}`);
const cles = await ev(`caches.open('carnetpatte-app-t1').then(async (c) => (await c.keys()).map((r) => r.url))`);
verifier(cles.length === liste.length && liste.every((f) => cles.includes(`${BASE}/${f}`)), `les ${liste.length} fichiers de l’appli sont en cache`);
verifier(await ev(`!document.querySelector('.pwa-maj')`), 'pas de bannière de mise à jour à la première installation');
const redirigees = await ev(`caches.open('carnetpatte-app-t1').then(async (c) => { const r = await Promise.all(['index.html', 'demenagement.html'].map((f) => c.match(f))); return r.map((x) => x && x.redirected); })`);
verifier(JSON.stringify(redirigees) === '[false,false]', `index.html et demenagement.html (redirigés par le serveur) sont gardés sans trace de redirection : ${JSON.stringify(redirigees)}`);

const fichier = { version: 1, exemplesAjoutes: true, exporteLe: '2026-01-01T00:00:00.000Z',
  animaux: [{ id: 'a', nom: 'Moka', espece: 'chien', especeAutre: '', race: 'Berger', naissance: '2023-08-01', photo: '' }, { id: 'b', nom: 'Filou', espece: 'chat', especeAutre: '', race: '', naissance: '', photo: '' }],
  soins: [{ id: 's1', animalId: 'a', type: 'vermifuge', titre: '', date: jour(-80), notes: 'Note à garder', rappel: jour(5), rappelFait: false }],
  pesees: [{ id: 'p1', animalId: 'a', date: jour(-3), poidsKg: 21.4 }] };
await importer(fichier);
const avant = await donnees();
verifier(avant.includes('Moka') && avant.includes('Note à garder'), 'animaux de test enregistrés');

// Une recherche « Autour de moi » en ligne : les fichiers de lieux consultés sont gardés
await send('Browser.grantPermissions', { origin: BASE, permissions: ['geolocation'] }).catch(() => {});
await send('Emulation.setGeolocationOverride', { latitude: 48.1175, longitude: -1.6775, accuracy: 20 });
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
const chercherLieux = async () => { await ev(`document.querySelector('#ca-loc').click()`); for (let i = 0; i < 60 && !(await ev(`document.querySelectorAll('.ca-lieu').length > 0`)); i++) await dort(250); return ev(`document.querySelectorAll('.ca-lieu').length`); };
await aller('#/carte'); await dort(500);
const lieuxEnLigne = await chercherLieux();
await dort(1200);
verifier(lieuxEnLigne > 0, `Carte en ligne : ${lieuxEnLigne} lieux listés`);
verifier(await ev(`!document.querySelector('#ca-hors-ligne').hidden`), 'tuiles bloquées : le message « Carte indisponible hors connexion » s’affiche aussi quand le fond de carte ne charge pas');
const lieuxGardes = await ev(`caches.open('carnetpatte-lieux').then(async (c) => (await c.keys()).map((r) => r.url.split('/').pop()))`);
verifier(lieuxGardes.includes('index.json') && lieuxGardes.length >= 2, `fichiers de lieux consultés gardés : ${lieuxGardes.join(', ')}`);
await aller('#/toxique'); await dort(300);

// ===== 4. Hors connexion : le serveur est arrêté =====
log('--- 4. Hors connexion (serveur arrêté) ---');
await arreter();
verifier(await fetch(`${BASE}/index.html`).then(() => false, () => true), 'le serveur est bien arrêté (aucune réponse du réseau)');
await send('Page.reload'); await dort(2500);
log('  titre =', await ev(`document.title`), '| contenu =', (await texte('#contenu')).slice(0, 60));
verifier((await ev(`document.title`)).endsWith('Carnet Patte') && await ev(`!!document.querySelector('#contenu h1')`), 'l’appli se rouvre sans réseau (page rechargée depuis le cache)');
// Navigations directes vers des adresses que le serveur redirige : ERR_FAILED si le service worker servait une réponse redirigée
for (const [adresse, titre] of [[`${BASE}/index.html`, 'Carnet Patte'], [`${BASE}/demenagement.html`, 'Carnet Patte'], [`${BASE}/demenagement`, 'Carnet Patte']]) {
  const nav = await send('Page.navigate', { url: adresse }); await dort(1800);
  const t = await ev(`document.title`);
  verifier(!nav?.errorText && t.includes(titre), `hors connexion, ${adresse.replace(BASE, '')} s’ouvre sans erreur (${nav?.errorText ?? 'ok'}) : « ${t} »`);
}
await send('Page.navigate', { url: `${BASE}/index.html` }); await dort(1800);
await aller('#/animaux'); await dort(400);
verifier((await texte('#contenu')).includes('Moka') && (await texte('#contenu')).includes('Filou'), 'les animaux s’affichent hors connexion');
await aller('#/animaux/rappels'); await dort(400);
verifier((await texte('#contenu')).includes('Vermifuge'), 'les rappels s’affichent hors connexion');
await aller('#/toxique'); await dort(500);
verifier(await ev(`document.querySelectorAll('#contenu a, #contenu button').length > 5`), 'les fiches « Toxique ? » s’affichent hors connexion');
await ecran('hors-ligne-toxique');
await aller('#/profil'); await dort(300);
verifier(await ev(`getComputedStyle(document.body).fontFamily.length > 0 && document.fonts.check('16px Inter')`), 'les polices viennent du cache');
verifier(await donnees() === avant, 'données des animaux identiques hors connexion');
await aller('#/carte'); await dort(500);
const lieuxHorsLigne = await chercherLieux(); await dort(1200);
verifier(lieuxHorsLigne === lieuxEnLigne, `Carte hors connexion : la liste des lieux déjà chargés reste visible (${lieuxHorsLigne} lieux)`);
verifier(await texte('#ca-hors-ligne') === 'Carte indisponible hors connexion, la liste des lieux déjà chargés reste visible.', 'message clair : « Carte indisponible hors connexion, la liste des lieux déjà chargés reste visible. »');
await ecran('hors-ligne-carte');
const manquant = await ev(`fetch('donnees/lieux/29.json').then((r) => r.status, () => 'erreur réseau')`);
verifier(manquant === 'erreur réseau', 'un fichier de lieux jamais consulté n’est pas disponible hors connexion (la Carte l’explique)');
verifier(await ev(`import('/js/storage.js').then((m) => m.lister('animaux').length)`) === 2, 'animaux toujours là');

// ===== 5. Nouvelle version =====
log('--- 5. Nouvelle version ---');
await demarrer(PORT);
version = 't2';
await aller('#/accueil'); await dort(300);
await ev(`window.__ancienne = true; navigator.serviceWorker.getRegistration().then((r) => r.update())`);
for (let i = 0; i < 60 && !(await ev(`!!document.querySelector('.pwa-maj')`)); i++) await dort(250);
verifier(await ev(`!!document.querySelector('.pwa-maj')`), 'la bannière apparaît quand une nouvelle version est publiée');
verifier((await texte('.pwa-maj')).includes('Nouvelle version disponible') && (await texte('.pwa-maj [data-maj]')) === 'Mettre à jour', `bannière : « ${await texte('.pwa-maj')} »`);
verifier(await ev(`document.querySelector('.pwa-maj').getAttribute('role')`) === 'status', 'bannière annoncée aux lecteurs d’écran (role=status)');
for (let i = 0; i < 40 && (await noms()).includes('carnetpatte-app-t1'); i++) await dort(250); // le nettoyage suit l'activation de quelques instants
const pendant = await noms();
verifier(pendant.includes('carnetpatte-app-t2') && !pendant.includes('carnetpatte-app-t1'), `la nouvelle version a pris la main toute seule (skipWaiting) et l’ancien cache est nettoyé : ${pendant.join(', ')}`);
verifier(await ev(`navigator.serviceWorker.getRegistration().then((r) => !r.waiting && !!r.active)`), 'aucune version en attente : la nouvelle est déjà active');
verifier(await ev(`window.__ancienne === true`), 'la page n’a pas été rechargée toute seule');
verifier(await donnees() === avant, 'données des animaux identiques pendant l’attente');
await ecran('banniere-maj'); await axe('.pwa-maj', 'bannière');
await ev(`document.querySelector('.pwa-maj [data-maj]').click()`);
for (let i = 0; i < 60 && (await ev(`window.__ancienne === true`).catch(() => true)); i++) await dort(250);
await dort(1500);
verifier(await ev(`window.__ancienne`) === undefined, 'après « Mettre à jour », la page est rechargée');
verifier(JSON.stringify(await noms()) === JSON.stringify(['carnetpatte-app-t2', 'carnetpatte-lieux']) || (await noms()).sort().join() === 'carnetpatte-app-t2,carnetpatte-lieux', `l’ancien cache est supprimé, les lieux gardés : ${(await noms()).join(', ')}`);
verifier(await ev(`!document.querySelector('.pwa-maj')`), 'plus de bannière après la mise à jour');
verifier(await donnees() === avant, 'données des animaux identiques après la mise à jour');
await aller('#/animaux'); verifier((await texte('#contenu')).includes('Moka'), 'les animaux sont toujours là');
verifier((await ev(`caches.open('carnetpatte-app-t2').then(async (c) => (await c.keys()).map((r) => r.url))`)).every((u) => u.startsWith(BASE)), 'seuls des fichiers de l’appli (même site) sont en cache : jamais les données ni un autre site');

// ===== 6. Aide « Installer sur votre iPhone » =====
log('--- 6. Aide à l’installation ---');
await aller('#/profil'); await dort(400);
verifier((await texte('#pf-installer')) === 'Installer Carnet Patte sur votre iPhone', 'Profil : section « Installer Carnet Patte sur votre iPhone » (appli non installée)');
const etapes = await texte('[data-installer]');
verifier(/Partager/.test(etapes) && /Sur l'écran d'accueil/.test(etapes) && await ev(`!!document.querySelector('[data-installer] svg.pwa-aide__illu')`), 'étapes Partager → Sur l’écran d’accueil, avec une illustration');
await ecran('aide-installation'); await axe('#contenu', 'profil avec aide');
await ev(`Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })`); // comme Safari quand l’appli est ouverte depuis l’écran d’accueil
await ev(`import('/js/router.js').then((r) => r.rafraichir())`); await dort(500);
verifier(await ev(`!document.querySelector('[data-installer]')`), 'appli déjà installée (mode standalone) : l’aide disparaît');

// Aller-retour export / import
const exp = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
await ev(`import('/js/storage.js').then(m=>m.toutEffacer())`);
await ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(exp)}))`);
const exp2 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
const net = (t) => { const o = JSON.parse(t); delete o.exporteLe; return JSON.stringify(o); };
const identique = net(exp) === net(exp2);
serveur.close(); serveur.closeAllConnections();
fin(identique);
