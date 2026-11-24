// Test « carte » : Carte Patte (lieux utiles autour de soi) avec des réponses SIMULÉES : aucun vrai serveur OpenStreetMap n'est appelé.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const S = process.argv[2], URL = process.argv[3], TAG = process.argv[4];
const E = process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'; // chemin de msedge.exe : à adapter avec la variable EDGE si besoin
const port = +(process.env.PORT || 9350);
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let echecs = 0;
const log = (...a) => console.log(...a);
const verifier = (condition, texteLog) => { if (!condition) echecs++; log(`  ${texteLog} = ${condition}`); };

fs.rmSync(`${S}/prof-e2e-${TAG}`, { recursive: true, force: true });
const proc = spawn(E, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${S}/prof-e2e-${TAG}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let list; for (let i = 0; i < 40; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (list.find((t) => t.type === 'page')) break; } catch {} await sleep(250); }
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(); const erreurs = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') erreurs.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
  if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) erreurs.push('CONSOLE ' + d.params.args.map((a) => a.value ?? a.description).join(' '));
  if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') erreurs.push('LOG ' + d.params.entry.text + ' ' + (d.params.entry.url || ''));
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'erreur'); return r.result.result.value; };
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
fs.mkdirSync(`${S}/shots`, { recursive: true });
const taille = (w, h) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
const aller = async (h) => { await ev(`location.hash='${h}'`); await sleep(700); };
const aller2 = async (h) => { if (await ev(`location.hash`) === h) { await ev(`import('/js/router.js').then(r=>r.rafraichir())`); await sleep(500); } else await aller(h); };
const ecran = async (nom, plein = false) => { const c = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: plein }); fs.writeFileSync(`${S}/shots/${TAG}-${nom}.png`, Buffer.from(c.result.data, 'base64')); };
let axeSrc = ''; for (let i = 0; i < 4 && !axeSrc; i++) { try { axeSrc = await (await fetch('https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js')).text(); } catch { await sleep(1500); } }
const axe = async (sel, nom) => { const a = await ev(`axe.run(document.querySelector('${sel}'), {runOnly:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}).then(r=>({v:r.violations.map(v=>v.id+'('+v.nodes.length+') '+v.nodes[0].html.slice(0,90)),inc:r.incomplete.map(i=>i.id)}))`); log('axe', nom, ':', a.v.length ? 'VIOLATIONS ' + a.v.join(' | ') : '0 violation', a.inc.length ? '· à vérifier ' + a.inc : ''); };
const sansDebord = () => ev(`document.documentElement.scrollWidth<=innerWidth`);
const texte = (sel) => ev(`(document.querySelector(${JSON.stringify(sel)})?.innerText ?? 'ABSENT').replace(/\\s+/g,' ').trim()`);

// ===== Réponses simulées : AUCUN vrai serveur (Overpass, Nominatim, tuiles) n'est appelé =====
const mondial = (a, b) => { const r = Math.PI / 180, dl = (b.lat - a.lat) * r, dn = (b.lon - a.lon) * r; const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) ** 2; return 2 * 6371000 * Math.asin(Math.sqrt(h)); };
const C = { lat: 48.1173, lon: -1.6778 };                               // « Rennes »
const POS = { lat: 48.1175, lon: -1.6775 };                             // la position simulée de l'appareil (jamais écrite nulle part)
const nord = (m) => +(C.lat + m / 111320).toFixed(6);
const est = (m) => +(C.lon + m / (111320 * Math.cos(C.lat * Math.PI / 180))).toFixed(6);
const NOM_LONG = 'Clinique Vétérinaire Universitaire Internationale des Animaux de Compagnie et de la Faune Sauvage de Bretagne Occidentale';
const ELEMENTS = [
  { type: 'node', id: 1, lat: nord(400), lon: C.lon, tags: { amenity: 'veterinary', name: 'Clinique Vétérinaire du Parc', 'addr:housenumber': '12', 'addr:street': 'rue des Lilas', 'addr:postcode': '35000', 'addr:city': 'Rennes', phone: '+33 2 99 00 00 01', opening_hours: 'Mo-Fr 09:00-18:00; Sa 09:00-12:00' } },
  { type: 'node', id: 12, lat: nord(-700), lon: C.lon, tags: { amenity: 'veterinary', name: NOM_LONG, 'addr:full': '1 avenue du Professeur Docteur Jean-Baptiste de la Fontaine-Saint-Martin, 35000 Rennes' } },
  { type: 'node', id: 2, lat: C.lat, lon: est(1500), tags: { amenity: 'veterinary', name: 'Urgences Vétérinaires Rennes', opening_hours: '24/7', phone: '02 99 00 00 02' } },
  { type: 'way', id: 3, center: { lat: nord(2600), lon: C.lon }, tags: { leisure: 'dog_park', name: 'Parc canin de la Prévalaye' } },
  { type: 'node', id: 4, lat: nord(-3500), lon: C.lon, tags: { shop: 'pet', name: 'Au Royaume des Animaux' } },
  { type: 'node', id: 5, lat: C.lat, lon: est(-4500), tags: { shop: 'pet_grooming', name: 'Toilettage Doudou', phone: 'pas un numéro', opening_hours: 'Mo-Sa 10:00-19:00' } },
  { type: 'node', id: 7, lat: nord(6000), lon: C.lon, tags: { amenity: 'veterinary' } },
  { type: 'node', id: 6, lat: C.lat, lon: est(8000), tags: { amenity: 'animal_shelter', name: 'Refuge de la SPA', phone: '+33 2 99 00 00 06' } },
  { type: 'node', id: 8, lat: nord(-9500), lon: C.lon, tags: { shop: 'pet_supply', name: 'Pet Zone' } },
  { type: 'node', id: 9, lat: nord(14000), lon: C.lon, tags: { amenity: 'veterinary', name: 'Vétérinaire lointain' } },
];
const BRUIT = [{ type: 'node', id: 90, lat: nord(200), lon: C.lon, tags: { amenity: 'cafe', name: 'Un café' } }, { type: 'node', id: 91, tags: { amenity: 'veterinary', name: 'Sans position' } }];
const CAT = (t) => (t.amenity === 'veterinary' ? 'veto' : t.leisure === 'dog_park' ? 'parc' : ['pet', 'pet_supply'].includes(t.shop) ? 'animalerie' : t.shop === 'pet_grooming' ? 'toiletteur' : t.amenity === 'animal_shelter' ? 'refuge' : null);
const coord = (e) => ({ lat: e.lat ?? e.center.lat, lon: e.lon ?? e.center.lon });
const attendus = (centre, rayonKm) => ELEMENTS.map((e) => ({ id: `${e.type}/${e.id}`, cat: CAT(e.tags), nom: e.tags.name ?? '', d: mondial(centre, coord(e)), tags: e.tags })).filter((l) => l.d <= rayonKm * 1000).sort((a, b) => a.d - b.d);
const VILLES = { rennes: { lat: C.lat, lon: C.lon, display_name: 'Rennes, Ille-et-Vilaine, Bretagne, France métropolitaine, France' }, '35000': { lat: C.lat, lon: C.lon, display_name: '35000, Rennes, Ille-et-Vilaine, Bretagne, France' },
  brest: { lat: 48.39, lon: -4.486, display_name: 'Brest, Finistère, Bretagne, France' }, nantes: { lat: 47.2184, lon: -1.5536, display_name: 'Nantes, Loire-Atlantique, Pays de la Loire, France' },
  lyon: { lat: 45.764, lon: 4.8357, display_name: 'Lyon, Métropole de Lyon, Rhône, France' }, marseille: { lat: 43.2965, lon: 5.3698, display_name: 'Marseille, Bouches-du-Rhône, France' } };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

const appels = [];                 // chaque requête vers Overpass ou Nominatim : { t, type, ... }
let tuiles = 0, enCours = 0, maxEnCours = 0, mode = 'ok';
await send('Fetch.enable', { patterns: [{ urlPattern: '*overpass-api.de*' }, { urlPattern: '*nominatim.openstreetmap.org*' }, { urlPattern: '*tile.openstreetmap.org*' }] });
const repondre = (requestId, { status = 200, type = 'application/json', corps = '' }) => send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: type }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: Buffer.from(corps).toString('base64') });
ws.addEventListener('message', async (m) => {
  const d = JSON.parse(m.data);
  if (d.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = d.params;
  const u = new globalThis.URL(request.url);
  if (u.hostname === 'tile.openstreetmap.org') { tuiles++; await repondre(requestId, { type: 'image/png', corps: PNG }); return; }
  enCours++; maxEnCours = Math.max(maxEnCours, enCours);
  await sleep(450); // une vraie réponse n'est pas instantanée : on vérifie qu'aucune autre requête ne part pendant ce temps
  try {
    if (u.hostname === 'nominatim.openstreetmap.org') {
      const q = (u.searchParams.get('postalcode') ?? u.searchParams.get('q') ?? '').toLowerCase();
      appels.push({ t: Date.now(), type: 'nominatim', q, pays: u.searchParams.get('country'), cp: u.searchParams.get('postalcode') });
      await repondre(requestId, { corps: JSON.stringify(VILLES[q] ? [{ lat: String(VILLES[q].lat), lon: String(VILLES[q].lon), display_name: VILLES[q].display_name }] : []) });
    } else {
      const requete = new URLSearchParams(request.postData ?? '').get('data') ?? '';
      const [, r, lat, lon] = requete.match(/around:(\d+),([-\d.]+),([-\d.]+)/) ?? [];
      appels.push({ t: Date.now(), type: 'overpass', rayon: +r, lat, lon, methode: request.method, requete });
      if (mode === 'hors-ligne') await send('Fetch.failRequest', { requestId, errorReason: 'InternetDisconnected' });
      else if (mode === 'serveur') await repondre(requestId, { status: 504, type: 'text/plain', corps: 'Gateway Timeout' });
      else if (mode === 'remarque') await repondre(requestId, { corps: JSON.stringify({ elements: [], remark: 'runtime error: Query timed out in "query" at line 1 after 26 seconds.' }) });
      else {
        const centre = { lat: +lat, lon: +lon };
        const dedans = ELEMENTS.filter((e) => mondial(centre, coord(e)) <= +r);
        const bruit = BRUIT.filter((e) => !e.lat || mondial(centre, coord(e)) <= +r);
        await repondre(requestId, { corps: JSON.stringify({ version: 0.6, elements: [...dedans, ...bruit] }) });
      }
    }
  } finally { enCours--; }
});
const nbOverpass = () => appels.filter((a) => a.type === 'overpass').length;
const nbNominatim = () => appels.filter((a) => a.type === 'nominatim').length;
const attendre = async (expr, ms = 20000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await ev(expr)) return true; await sleep(150); } return false; };
const origine = new globalThis.URL(URL).origin;
await send('Browser.grantPermissions', { origin: origine, permissions: ['geolocation'] }).catch(() => {});
await send('Emulation.setGeolocationOverride', { latitude: POS.lat, longitude: POS.lon, accuracy: 20 });
// Espion : compte les demandes de position et permet de simuler un refus (le vrai refus dépend du profil du navigateur)
const poserEspion = () => ev(`(() => { window.__geo = 0; window.__geoMode = 'reel'; const o = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
  navigator.geolocation.getCurrentPosition = (ok, err, opt) => { window.__geo++; if (window.__geoMode === 'refus') return setTimeout(() => err({ code: 1, message: 'denied' }), 40); return o(ok, err, opt); }; return true; })()`);
const statut = () => texte('#ca-statut');
const liste = () => ev(`[...document.querySelectorAll('.ca-lieu')].map((b) => ({ id: b.dataset.id, nom: b.querySelector('.ca-lieu__nom').textContent, meta: b.querySelector('.ca-lieu__meta').textContent }))`);
const cliquer = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).click()`);
const chercherVille = async (v) => { await ev(`(() => { const i = document.querySelector('#ca-ville'); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#ca-form').requestSubmit(); })()`); };
const donnees = () => ev(`import('/js/storage.js').then(m => m.exporter())`);
const sansHorodatage = (t) => { const o = JSON.parse(t); delete o.exporteLe; return JSON.stringify(o); };
const importer = (t) => ev(`import('/js/storage.js').then(m => m.importer(${JSON.stringify(t)}))`);
const A = (id, nom, espece, extra = {}) => ({ id, nom, espece, especeAutre: '', race: '', naissance: '', photo: '', ...extra });
const erreursAttendues = (avant) => { const n = erreurs.length - avant; const dernieres = erreurs.slice(avant); const ok = dernieres.every((e) => /overpass-api|Failed to load resource|ERR_|504/.test(e)); erreurs.splice(avant); return ok ? n : -1; };

await send('Page.navigate', { url: URL }); await sleep(1800); await taille(1280, 900); await aller2('#/accueil'); await ev(axeSrc);
await importer(JSON.stringify({ version: 1, exemplesAjoutes: true, animaux: [A('c', 'Moka', 'chien'), A('b', 'Mimi', 'chat')], soins: [], pesees: [] }));
const avantDonnees = sansHorodatage(await donnees());
await ev(`localStorage.removeItem('carnetpatte.carteCache')`);

log('=== ACCÈS : Accueil, menu ☰, barre latérale ===');
await aller2('#/accueil');
verifier(await ev(`document.querySelector('a.ca-acces')?.getAttribute('href')`) === '#/carte', 'Accueil : une carte « Carte Patte » mène à #/carte');
await ev(`document.querySelector('#menu-bouton').click()`); await sleep(500);
verifier(await ev(`document.querySelector('dialog.app-menu [data-menu=carte]')?.getAttribute('href')`) === '#/carte' && await ev(`document.querySelectorAll('dialog.app-menu .app-menu__lien').length`) === 6, 'menu ☰ : entrée « Carte Patte » (6 entrées en tout)');
await ev(`document.querySelector('dialog.app-menu [data-menu=carte]').click()`); await sleep(900);
verifier(await ev(`location.hash`) === '#/carte' && await texte('#contenu h1') === 'Carte Patte', 'le menu ouvre la page Carte Patte');
verifier(await ev(`!!document.querySelector('.app-lateral [data-nav=carte]') && !document.querySelector('.app-bientot__liste [data-nav=carte]')`), 'barre latérale : la Carte n\'est plus rangée sous « Bientôt »');

log('=== PAGE AVANT TOUTE RECHERCHE ===');
await poserEspion();
const MESSAGE = 'Données OpenStreetMap, parfois incomplètes. En urgence, appelez votre vétérinaire.';
verifier((await texte('.ca-avertissement')).includes(MESSAGE), `message d'avertissement exact et visible : « ${MESSAGE} »`);
verifier(await ev(`(() => { const r = document.querySelector('.ca-avertissement').getBoundingClientRect(); return r.width > 100 && r.height > 20; })()`), 'le message est visible (dimensions réelles)');
verifier(await ev(`document.querySelector('.ca-info').textContent`).then((t) => /position/.test(t) && /pas enregistrée/.test(t)), 'ligne de vie privée : la position n\'est pas enregistrée');
verifier(await ev(`window.__geo`) === 0, 'aucune demande de position avant un toucher');
verifier(nbOverpass() === 0 && nbNominatim() === 0 && tuiles === 0, 'aucune requête réseau avant une recherche (ni lieux, ni ville, ni tuiles)');
verifier(await ev(`document.querySelector('#ca-zone').hidden && !document.querySelector('#ca-vide').hidden`), 'avant la recherche : invite « Où êtes-vous ? », pas de carte');
verifier(await ev(`!!document.querySelector('label[for=ca-ville]') && document.querySelector('#ca-loc').textContent.trim() === 'Autour de moi'`), 'bouton « Autour de moi » et champ « Ville ou code postal » étiquetés');
verifier(JSON.stringify(await ev(`[...document.querySelectorAll('input[name=ca-rayon]')].map((i) => i.value + (i.checked ? '*' : ''))`)) === '["2","5*","10"]', 'rayon réglable 2, 5, 10 km (5 par défaut)');
await axe('#contenu', 'Carte avant recherche, 1280 px');

log('=== LOCALISATION REFUSÉE → recherche par ville ===');
await ev(`window.__geoMode = 'refus'`); await cliquer('#ca-loc'); await sleep(500);
verifier(/refusée/.test(await texte('#ca-erreur')) && await ev(`document.activeElement.id`) === 'ca-ville', 'refus : message clair et le curseur passe dans « Ville ou code postal »');
verifier(await ev(`!document.querySelector('#ca-reessayer')`) && nbOverpass() === 0, 'refus : pas de bouton « Réessayer » inutile, aucune requête');
await ev(`window.__geoMode = 'reel'`);

log('=== AUTOUR DE MOI (position simulée) ===');
await ev(`window.__geo = 0`);
await cliquer('#ca-loc');
verifier(await attendre(`/lieux? dans/.test(document.querySelector('#ca-statut').textContent)`), 'les lieux s\'affichent');
verifier(await ev(`window.__geo`) === 1, 'une seule demande de position, après le toucher');
let attendu = attendus(POS, 5);
let l = await liste();
verifier(JSON.stringify(l.map((x) => x.id)) === JSON.stringify(attendu.map((x) => x.id)), `liste triée par distance : ${l.map((x) => x.id.replace('node/', '')).join(' > ')} (attendu ${attendu.map((x) => x.id.replace('node/', '')).join(' > ')})`);
const km = (t) => { const m = t.match(/([\d,]+)\s*(km|m)\b/); return parseFloat(m[1].replace(',', '.')) * (m[2] === 'km' ? 1000 : 1); };
verifier(l.every((x, i) => i === 0 || km(x.meta) >= km(l[i - 1].meta)), `distances affichées croissantes (${l.map((x) => x.meta.split('· ')[1]).join(', ')})`);
verifier(l.every((x, i) => Math.abs(km(x.meta) - attendu[i].d) <= Math.max(60, attendu[i].d * 0.06)), 'distances affichées justes (à 6 % près)');
verifier((await statut()) === `${attendu.length} lieux dans 5 km autour de votre position, du plus proche au plus loin.`, `statut annoncé : « ${await statut()} »`);
verifier(!l.some((x) => /café|Sans position/.test(x.nom)), 'le café et le lieu sans position sont ignorés');
const o1 = appels.filter((a) => a.type === 'overpass');
verifier(o1.length === 1 && o1[0].methode === 'POST' && o1[0].rayon === 6000 && o1[0].lat === '48.12' && o1[0].lon === '-1.68', `une seule requête Overpass, zone arrondie à 1 km (${o1[0]?.lat}, ${o1[0]?.lon}), rayon ${o1[0]?.rayon} m`);
verifier(['veterinary', 'dog_park', 'pet', 'pet_supply', 'pet_grooming', 'animal_shelter'].every((t) => o1[0].requete.includes(`"${t}"`)), 'la requête demande les 5 catégories (vétérinaires, parcs à chiens, animaleries, toiletteurs, refuges)');
verifier(!o1[0].requete.includes('48.1175') && !o1[0].requete.includes('1.6775'), 'la position exacte n\'est pas envoyée à Overpass');

await sleep(3000);
log('ERREURS', JSON.stringify(erreurs));
log('script', await ev(`[...document.scripts].map(s=>s.src).join(' | ')`));
log('L', await ev(`typeof window.L`));
log('zone hidden', await ev(`document.querySelector('#ca-zone').hidden`), await ev(`document.querySelector('#ca-zone').innerHTML.slice(0,300)`));
ws.close(); proc.kill(); process.exit(0);
