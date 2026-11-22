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
  { type: 'node', id: 1, lat: nord(400), lon: C.lon, tags: { amenity: 'veterinary', name: 'Clinique Vétérinaire du Parc', 'addr:housenumber': '12', 'addr:street': 'rue des Lilas', 'addr:postcode': '35000', 'addr:city': 'Rennes', phone: '+33 2 99 00 00 01', opening_hours: 'Mo-Fr 09:00-18:00; Sa 09:00-12:00', website: 'https://clinique-du-parc.example/rdv' } },
  { type: 'node', id: 12, lat: nord(-700), lon: C.lon, tags: { amenity: 'veterinary', name: NOM_LONG, 'addr:full': '1 avenue du Professeur Docteur Jean-Baptiste de la Fontaine-Saint-Martin, 35000 Rennes' } },
  { type: 'node', id: 2, lat: C.lat, lon: est(1500), tags: { amenity: 'veterinary', name: 'Urgences Vétérinaires Rennes', opening_hours: '24/7', phone: '02 99 00 00 02' } },
  { type: 'way', id: 3, center: { lat: nord(2600), lon: C.lon }, tags: { leisure: 'dog_park', name: 'Parc canin de la Prévalaye' } },
  { type: 'node', id: 4, lat: nord(-3500), lon: C.lon, tags: { shop: 'pet', name: 'Au Royaume des Animaux', 'x-ban': '7 Rue Test, 35000 Rennes' } },
  { type: 'node', id: 5, lat: C.lat, lon: est(-4500), tags: { shop: 'pet_grooming', name: 'Toilettage Doudou', phone: 'pas un numéro', opening_hours: '"Sur rendez-vous"; Mo-Sa 10:00-19:00' } },
  { type: 'node', id: 7, lat: nord(6000), lon: C.lon, tags: { amenity: 'veterinary', 'x-rue-proche': 'avenue de la Gare' } },
  { type: 'node', id: 13, lat: nord(900), lon: C.lon, tags: { amenity: 'veterinary', 'addr:street': 'rue Anonyme' } },
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
  toulouse: { lat: 43.6045, lon: 1.4442, display_name: 'Toulouse, Haute-Garonne, Occitanie, France' },
  bruxelles: { lat: 50.8503, lon: 4.3517, display_name: 'Bruxelles, Région de Bruxelles-Capitale, Belgique' }, frontiere: { lat: 50.45, lon: 1.0, display_name: 'Ville-Frontière, Pas-de-Calais, France' },
  metropolis: { lat: 47.0, lon: 2.0, display_name: 'Metropolis, Cher, Centre-Val de Loire, France' }, dense: { lat: 46.0, lon: 3.0, display_name: 'Denseville, Allier, Auvergne, France' },
  paris: { lat: 48.8566, lon: 2.3522, display_name: 'Paris, Île-de-France, France' }, lille: { lat: 50.6292, lon: 3.0573, display_name: 'Lille, Nord, Hauts-de-France, France' },
  lyon: { lat: 45.764, lon: 4.8357, display_name: 'Lyon, Métropole de Lyon, Rhône, France' }, marseille: { lat: 43.2965, lon: 5.3698, display_name: 'Marseille, Bouches-du-Rhône, France' } };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

// ----- Lieux préparés à l'avance (donnees/lieux/) : fichiers SIMULÉS pour le navigateur -----
const CODE_CAT = { veto: 'v', parc: 'p', animalerie: 'a', toiletteur: 't', refuge: 'r' };
const ligneDe = (e) => { const t = e.tags; const c = coord(e); const adr = t['x-ban'] ?? t['addr:full'] ?? [[t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' '), [t['addr:postcode'], t['addr:city']].filter(Boolean).join(' ')].filter(Boolean).join(', '); return [`${e.type[0]}${e.id}`, CODE_CAT[CAT(t)], c.lat, c.lon, t.name ?? '', adr, t.phone ?? '', t.opening_hours ?? '', t.website ?? '', t.name ? '' : (t['addr:street'] ?? t['x-rue-proche'] ?? ''), t['x-ban'] ? 'b' : '']; };
const LIGNES_35 = ELEMENTS.filter((e) => e.id % 2 === 1).map(ligneDe);   // deux « départements » qui se partagent la zone de Rennes
const LIGNES_53 = ELEMENTS.filter((e) => e.id % 2 === 0).map(ligneDe);
const LIGNES_29 = [                                                       // Brest : de bonnes lignes et des lignes piégées
  ['n501', 'v', 48.3905, -4.486, 'Vétérinaire de Brest', '', '', '', 'https://brest.example'],
  ['x502', 'v', 48.39, -4.49, 'Ligne invalide : identifiant'],
  ['n503', 'z', 48.39, -4.49, 'Ligne invalide : catégorie'],
  ['n504', 'p', 'pas un nombre', -4.49, 'Ligne invalide : position'],
  ['n505', 'a', 48.392, -4.485, 'Animalerie piégée', '', '+33 2 98 00 00 05', '', 'javascript:alert(1)'],
  'pas une ligne',
];
// 350 lieux répartis régulièrement (spirale) : combien il y en a dans chaque rayon est connu d'avance (350 × (r / rayon max)²)
const spirale = (centre, rayonMax, n, depart) => Array.from({ length: n }, (_, i) => { const r = rayonMax * Math.sqrt((i + 0.5) / n); const a = i * 2.399963; return [`n${depart + i}`, 'vpatr'[i % 5], +(centre.lat + (r * Math.cos(a)) / 111320).toFixed(5), +(centre.lon + (r * Math.sin(a)) / (111320 * Math.cos(centre.lat * Math.PI / 180))).toFixed(5), `Lieu ${depart + i}`]; });
const LIGNES_18 = spirale(VILLES.metropolis, 9000, 350, 7000);   // 350 lieux sur 9 km : 108 dans 5 km, 17 dans 2 km
const LIGNES_03 = spirale(VILLES.dense, 1900, 350, 8000);        // 350 lieux sur 1,9 km : tous dans 2 km
const bornes = (l) => [Math.min(...l.filter((x) => Number.isFinite(x[2])).map((x) => x[2])), Math.min(...l.map((x) => x[3])), Math.max(...l.filter((x) => Number.isFinite(x[2])).map((x) => x[2])), Math.max(...l.map((x) => x[3]))];
const INDEX_SIMULE = { v: 1, extrait: '2026-11-20T21:21:21Z', genere: '2026-11-21', total: LIGNES_35.length + LIGNES_53.length + 2,
  departements: { '35': { n: LIGNES_35.length, bbox: bornes(LIGNES_35) }, '53': { n: LIGNES_53.length, bbox: bornes(LIGNES_53) }, '29': { n: 2, bbox: [48.39, -4.49, 48.392, -4.485] }, '18': { n: 350, bbox: bornes(LIGNES_18) }, '03': { n: 350, bbox: bornes(LIGNES_03) } },
  france: [[[-5, 42], [8, 42], [8, 50.5], [-5, 50.5], [-5, 42]]] };   // un grand rectangle : Bruxelles (50,85° N) est hors couverture
const FICHIERS_SIMULES = { 'index.json': INDEX_SIMULE, '35.json': { v: 1, dep: '35', lieux: LIGNES_35 }, '53.json': { v: 1, dep: '53', lieux: LIGNES_53 }, '29.json': { v: 1, dep: '29', lieux: LIGNES_29 }, '18.json': { v: 1, dep: '18', lieux: LIGNES_18 }, '03.json': { v: 1, dep: '03', lieux: LIGNES_03 } };
let modeLocal = 'indisponible';    // 'indisponible' (réponse inutilisable : l'appli passe à Overpass) | 'mock' (fichiers simulés) | 'erreur-500'
const donneesAppels = [];          // les fichiers de donnees/lieux/ demandés par l'appli

// ===== Les VRAIS fichiers de donnees/lieux/ (lus sur le disque) : structure, tailles, protection de la vie privée =====
log('=== DONNÉES PRÉPARÉES À L\'AVANCE : donnees/lieux/ (fichiers réels du dépôt) ===');
const DOSSIER_LIEUX = path.join(RACINE, 'donnees/lieux');
const lireLieux = (f) => JSON.parse(fs.readFileSync(path.join(DOSSIER_LIEUX, f), 'utf8'));
let idxReel = null; try { idxReel = lireLieux('index.json'); } catch { /* signalé par la vérification suivante */ }
verifier(idxReel?.v === 1 && /^\d{4}-\d{2}-\d{2}T/.test(idxReel.extrait ?? '') && Object.keys(idxReel.departements ?? {}).length >= 90, `index.json lisible : version 1, extrait du ${idxReel?.extrait}, ${Object.keys(idxReel?.departements ?? {}).length} départements`);
if (idxReel) {
  const fichiersReels = fs.readdirSync(DOSSIER_LIEUX).filter((f) => /^[0-9AB]{2}\.json$/.test(f));
  verifier(fichiersReels.length === Object.keys(idxReel.departements).length && fichiersReels.every((f) => idxReel.departements[f.slice(0, 2)]), `un fichier par département de l'index (${fichiersReels.length})`);
  let nAdr = 0, nBan = 0, banSansAdresse = 0, banMalFormees = 0, srcInconnue = 0;
  let total = 0, octets = 0, plusGros = 0, nomPlusGros = '', mauvaises = [], vusIds = new Set(), doublons = 0, courriels = 0, sitesMauvais = 0, tels = 0, horsBoite = 0, nonTries = 0;
  const parCat = {};
  for (const f of fichiersReels) {
    const code = f.slice(0, 2);
    const taille = fs.statSync(path.join(DOSSIER_LIEUX, f)).size;
    octets += taille; if (taille > plusGros) { plusGros = taille; nomPlusGros = code; }
    const d = lireLieux(f);
    const [s0, w0, n0, e0] = idxReel.departements[code].bbox;
    if (d.v !== 1 || d.dep !== code || d.lieux.length !== idxReel.departements[code].n) mauvaises.push(`${code} : en-tête ou nombre`);
    let precedent = '';
    for (const l of d.lieux) {
      total++;
      const [id, c, lat, lon, nom = '', adr = '', tel = '', hor = '', site = '', rue = '', src = ''] = l;
      if (adr) nAdr++;
      if (src === 'b') { nBan++; if (!adr) banSansAdresse++; else if (!/^\d+.*, \d{5} \S/.test(adr)) banMalFormees++; } else if (src !== '') srcInconnue++;
      if (!/^[nwr]\d+$/.test(id) || !'vpatr'.includes(c) || !Number.isFinite(lat) || !Number.isFinite(lon)) mauvaises.push(`${code} : ${JSON.stringify(l).slice(0, 80)}`);
      if (lat < s0 - 1e-9 || lat > n0 + 1e-9 || lon < w0 - 1e-9 || lon > e0 + 1e-9) horsBoite++;
      if (vusIds.has(id)) doublons++; vusIds.add(id);
      if (id < precedent) nonTries++; precedent = id;
      if (l.slice(4).some((x) => typeof x !== 'string' || /[\w.+-]+@[\w-]+\.[\w.-]+/.test(x))) courriels++;
      if (site && !/^https?:\/\/[^\s<>"']+$/i.test(site)) sitesMauvais++;
      if (tel) { tels++; if (!/^\+?\d{6,15}$/.test(tel.replace(/[\s.()-]/g, ''))) mauvaises.push(`${code} : téléphone ${tel}`); }
      parCat[c] = (parCat[c] ?? 0) + 1;
    }
  }
  verifier(mauvaises.length === 0, `toutes les lignes sont valides (${mauvaises.slice(0, 3).join(' | ') || 'aucune erreur'})`);
  verifier(total === idxReel.total && total >= 5000, `${total} lieux au total (index : ${idxReel.total}) : au moins 5 000 pour la France métropolitaine`);
  verifier(['v', 'p', 'a', 't', 'r'].every((c) => parCat[c] >= 50) && parCat.v >= 1000, `les 5 catégories sont bien présentes : ${Object.entries(parCat).map(([c, n]) => `${c}=${n}`).join(' ')}`);
  verifier(doublons === 0 && horsBoite === 0 && nonTries === 0, `identifiants uniques (${doublons} doublons), tous dans la zone de leur département (${horsBoite} dehors), fichiers triés (${nonTries} désordres)`);
  const pourcent = (n) => Math.round((n * 100) / total);
  verifier(pourcent(nAdr) >= 70 && pourcent(tels) >= 30, `adresse dans ${pourcent(nAdr)} % des lieux (${nAdr} sur ${total} : au moins 70 % avec la Base Adresse Nationale), téléphone dans ${pourcent(tels)} % (au moins 30 %)`);
  verifier(nBan > 1000 && banSansAdresse === 0 && banMalFormees === 0 && srcInconnue === 0, `${nBan} adresses de la Base Adresse Nationale (colonne 11 = « b »), toutes complètes (numéro, rue, code postal, commune) ; ${nAdr - nBan} adresses venues d'OpenStreetMap`);
  verifier(idxReel.adresses_ban?.n === nBan && /Licence Ouverte 2\.0/.test(idxReel.adresses_ban?.licence ?? '') && idxReel.adresses_ban?.rayon_m === 50 && /Géoplateforme/.test(idxReel.adresses_ban?.source ?? '') && /Base Adresse Nationale/.test(idxReel.adresses_ban?.source ?? ''), 'index.json : source (BAN via la Géoplateforme), Licence Ouverte 2.0, rayon de 50 m, nombre d\'adresses BAN');
  verifier(courriels === 0 && sitesMauvais === 0, `aucun courriel (${courriels}), tous les sites sont des adresses http(s) (${sitesMauvais} mauvais)`);
  const tailleIndex = fs.statSync(path.join(DOSSIER_LIEUX, 'index.json')).size;
  log(`  TAILLE RÉELLE : ${(octets / 1048576).toFixed(2)} Mo de départements (${fichiersReels.length} fichiers, moyenne ${Math.round(octets / fichiersReels.length / 1024)} Ko, plus gros : ${nomPlusGros} = ${Math.round(plusGros / 1024)} Ko) + index ${Math.round(tailleIndex / 1024)} Ko ; ${total} lieux, ${tels} avec téléphone`);
  verifier(octets < 12 * 1048576 && plusGros < 600 * 1024 && tailleIndex < 60 * 1024, 'tailles raisonnables (moins de 12 Mo en tout, moins de 600 Ko par département, index de moins de 60 Ko)');
  // Vérification de bon sens : autour du centre de Toulouse, il y a des vétérinaires dans le fichier de la Haute-Garonne
  const toulouse = { lat: 43.6045, lon: 1.4442 };
  const vetosToulouse = lireLieux('31.json').lieux.filter((l) => l[1] === 'v' && mondial(toulouse, { lat: l[2], lon: l[3] }) <= 5000);
  verifier(vetosToulouse.length >= 10, `bon sens : ${vetosToulouse.length} vétérinaires à moins de 5 km du centre de Toulouse (fichier 31)`);
  const contour = idxReel.france;
  const dansContour = (lon, lat) => contour.some((a) => { let d = false; for (let i = 0, j = a.length - 1; i < a.length; j = i++) { const [xi, yi] = a[i], [xj, yj] = a[j]; if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) d = !d; } return d; });
  verifier(dansContour(1.4442, 43.6045) && dansContour(2.3522, 48.8566) && dansContour(8.7386, 41.9192) && dansContour(9.4503, 42.6977) && !dansContour(4.35, 50.85) && !dansContour(-0.1276, 51.5072) && !dansContour(55.45, -20.88), 'contour de la France : Toulouse, Paris, Ajaccio et Bastia dedans ; Bruxelles, Londres et La Réunion dehors');
}
const licence = fs.existsSync(path.join(DOSSIER_LIEUX, 'LICENCE.txt')) ? fs.readFileSync(path.join(DOSSIER_LIEUX, 'LICENCE.txt'), 'utf8') : '';
verifier(/ODbL/.test(licence) && /openstreetmap\.org\/copyright/.test(licence) && /opendatacommons\.org\/licenses\/odbl\/1-0/.test(licence) && /COURRIELS/.test(licence) && /Geofabrik/.test(licence), 'LICENCE.txt : ODbL 1.0, attribution OpenStreetMap, source Geofabrik, modifications (courriels supprimés)');
verifier(/Base Adresse Nationale/.test(licence) && /Licence Ouverte 2\.0/.test(licence) && /data\.geopf\.fr/.test(licence) && /Aucune autre source d'adresses/.test(licence), 'LICENCE.txt : source (Base Adresse Nationale, Géoplateforme) et Licence Ouverte 2.0 des adresses complétées');
const wfMensuel = fs.readFileSync(path.join(RACINE, '.github/workflows/lieux-mensuel.yml'), 'utf8');
const wfPages = fs.readFileSync(path.join(RACINE, '.github/workflows/pages.yml'), 'utf8');
verifier(/cron: '0 4 2 \* \*'/.test(wfMensuel) && /workflow_dispatch/.test(wfMensuel) && /gh pr create/.test(wfMensuel) && /pull-requests: write/.test(wfMensuel) && !/push[^\n]*origin main|--base main --head main/.test(wfMensuel), 'GitHub Action mensuelle : planifiée, lancement manuel possible, ouvre une Pull Request, ne pousse jamais sur main');
const assembleur = fs.readFileSync(path.join(RACINE, 'outils/assembler-site.mjs'), 'utf8');
verifier(/assembler-site\.mjs/.test(wfPages) && /DOSSIERS = \[[^\]]*'donnees'/.test(assembleur), 'le déploiement du site (GitHub et Cloudflare : outils/assembler-site.mjs) publie le dossier donnees/');
const { spawnSync } = await import('node:child_process');
const py = ['python', 'python3', 'py'].map((c) => spawnSync(c, [path.join(RACINE, 'outils/test_extraire_lieux.py')], { encoding: 'utf8' })).find((r) => !r.error);
const pySansModule = py && /No module named/.test(py.stderr ?? '');
verifier(!py || pySansModule || py.status === 0, py ? (pySansModule ? 'tests Python du script d\'extraction ignorés (pip install osmium shapely manquant)' : `tests Python du script d'extraction (12 contrôles : sans courriel, sites sûrs, doublons, départements) : ${py.status === 0 ? 'OK' : (py.stderr || py.stdout).slice(-300)}`) : 'tests Python ignorés (Python absent)');

const appels = [];                 // chaque requête vers Overpass ou Nominatim : { t, type, ... }
let tuiles = 0, enCours = 0, maxEnCours = 0, mode = 'ok';
await send('Fetch.enable', { patterns: [{ urlPattern: '*overpass-api.de*' }, { urlPattern: '*overpass.kumi.systems*' }, { urlPattern: '*overpass.private.coffee*' }, { urlPattern: '*nominatim.openstreetmap.org*' }, { urlPattern: '*tile.openstreetmap.org*' }, { urlPattern: '*/donnees/lieux/*' }] });
const repondre = (requestId, { status = 200, type = 'application/json', corps = '' }) => send('Fetch.fulfillRequest', { requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: type }, { name: 'Access-Control-Allow-Origin', value: '*' }], body: Buffer.from(corps).toString('base64') });
ws.addEventListener('message', async (m) => {
  const d = JSON.parse(m.data);
  if (d.method !== 'Fetch.requestPaused') return;
  const { requestId, request } = d.params;
  const u = new globalThis.URL(request.url);
  if (u.hostname === 'tile.openstreetmap.org') { tuiles++; await repondre(requestId, { type: 'image/png', corps: PNG }); return; }
  if (u.pathname.includes('/donnees/lieux/')) {
    const fichier = u.pathname.split('/').pop();
    donneesAppels.push(fichier);
    if (!/\.json$/.test(fichier)) { await send('Fetch.continueRequest', { requestId }); return; }   // LICENCE.txt : le vrai fichier du dépôt
    if (modeLocal === 'reel') { await send('Fetch.continueRequest', { requestId }); return; }   // les VRAIS fichiers de donnees/lieux/
    if (modeLocal === 'erreur-500') await repondre(requestId, { status: 500, type: 'text/plain', corps: 'Erreur du serveur' });
    else if (modeLocal === 'mock' && FICHIERS_SIMULES[fichier]) await repondre(requestId, { corps: JSON.stringify(FICHIERS_SIMULES[fichier]) });
    else await repondre(requestId, { corps: JSON.stringify({ v: 0 }) });
    return;
  }
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
      appels.push({ t: Date.now(), type: 'overpass', serveur: u.hostname, rayon: +r, lat, lon, methode: request.method, requete });
      if (mode === 'principal-en-panne' && u.hostname === 'overpass-api.de') await repondre(requestId, { status: 502, type: 'text/html', corps: '<html><body><h1>502 Bad Gateway</h1></body></html>' });
      else if (mode === 'hors-ligne') await send('Fetch.failRequest', { requestId, errorReason: 'InternetDisconnected' });
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
// La carte regroupe les marqueurs proches en bulles : le total des lieux = marqueurs isolés + nombres écrits dans les bulles
const marqueurs = () => ev(`(() => { const iso = document.querySelectorAll('.leaflet-marker-icon.ca-marqueur').length; const bulles = [...document.querySelectorAll('.leaflet-marker-icon.ca-groupe')].map((g) => +g.querySelector('.ca-groupe__n').textContent); return { iso, bulles, total: iso + bulles.reduce((a, b) => a + b, 0) }; })()`);
const attendreMarqueurs = async (n, ms = 20000) => { const fin = Date.now() + ms; let m; while (Date.now() < fin) { m = await marqueurs(); if (m.total === n) return m; await sleep(150); } return m; };
const liste = () => ev(`[...document.querySelectorAll('.ca-lieu')].map((b) => ({ id: b.dataset.id, nom: b.querySelector('.ca-lieu__nom').textContent, meta: b.querySelector('.ca-lieu__meta').textContent }))`);
const cliquer = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).click()`);
const chercherVille = async (v) => { await ev(`(() => { const i = document.querySelector('#ca-ville'); i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#ca-form').requestSubmit(); })()`); };
const donnees = () => ev(`import('/js/storage.js').then(m => m.exporter())`);
const sansHorodatage = (t) => { const o = JSON.parse(t); delete o.exporteLe; return JSON.stringify(o); };
const importer = (t) => ev(`import('/js/storage.js').then(m => m.importer(${JSON.stringify(t)}))`);
const A = (id, nom, espece, extra = {}) => ({ id, nom, espece, especeAutre: '', race: '', naissance: '', photo: '', ...extra });
const erreursAttendues = (avant) => { const n = erreurs.length - avant; const dernieres = erreurs.slice(avant); const ok = dernieres.every((e) => /overpass|Failed to load resource|ERR_|50[24]|\[Carte Patte\]/.test(e)); erreurs.splice(avant); return ok ? n : -1; };

await send('Page.navigate', { url: URL }); await sleep(1800); await taille(1280, 900); await aller2('#/accueil'); await ev(axeSrc);
await importer(JSON.stringify({ version: 1, exemplesAjoutes: true, animaux: [A('c', 'Moka', 'chien'), A('b', 'Mimi', 'chat')], soins: [], pesees: [] }));
const avantDonnees = sansHorodatage(await donnees());
await ev(`localStorage.removeItem('carnetpatte.carteCache')`);

log('=== ACCÈS : Accueil, menu ☰, barre latérale ===');
await aller2('#/accueil');
verifier(await ev(`document.querySelector('a.ca-acces')?.getAttribute('href')`) === '#/carte', 'Accueil : une carte « Carte Patte » mène à #/carte');
await ev(`document.querySelector('#menu-bouton').click()`); await sleep(500);
verifier(await ev(`document.querySelectorAll('dialog.app-menu .app-menu__lien').length`) === 6 && await ev(`!document.querySelector('dialog.app-menu [data-menu=carte]')`), 'menu ☰ : plus d\'entrée « Carte Patte » (doublon avec la barre du bas), 6 entrées avec la Boutique');
await ev(`document.querySelector('dialog.app-menu [data-fermer]').click()`); await sleep(400);
verifier(await ev(`document.querySelector('#nav-bas [data-nav=carte]')?.getAttribute('href')`) === '#/carte' && await ev(`[...document.querySelectorAll('#nav-bas [data-nav]')].map((a) => a.dataset.nav).join()`) === 'accueil,animaux,carte,rappels,profil', 'barre du bas : l\'onglet Carte est entre Animaux et Rappels');
await ev(`document.querySelector('#nav-bas [data-nav=carte]').click()`); await sleep(900);
verifier(await ev(`location.hash`) === '#/carte' && await texte('#contenu h1') === 'Carte Patte' && await ev(`document.querySelector('#nav-bas [data-nav=carte]').getAttribute('aria-current')`) === 'page', 'l\'onglet ouvre la page Carte Patte et devient l\'onglet actif');
verifier(await ev(`!!document.querySelector('.app-lateral [data-nav=carte]') && !document.querySelector('.app-bientot__liste [data-nav=carte]')`), 'barre latérale : la Carte n\'est plus rangée sous « Bientôt »');

log('=== PAGE AVANT TOUTE RECHERCHE ===');
await poserEspion();

// Les nombres sur les pastilles : foncés, gras, opacité pleine, contraste d'au moins 4,5:1 (sur du blanc ET sur le fond de la page)
const lisibiliteFiltres = () => ev(`(() => {
  const lum = (c) => { const [r, g, b] = c.match(/[\\d.]+/g).slice(0, 3).map(Number).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const rapport = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const versRgb = (c) => { const i = document.createElement('i'); i.style.color = c; document.body.append(i); const r = getComputedStyle(i).color; i.remove(); return r; };
  const fondPage = versRgb(getComputedStyle(document.documentElement).getPropertyValue('--cp-fond').trim() || '#FFFFFF');
  return [...document.querySelectorAll('.ca-filtre')].map((b) => { const n = b.querySelector('.cp-filtre__nombre'); const s = getComputedStyle(n); let o = 1; for (let e = n; e; e = e.parentElement) o *= +getComputedStyle(e).opacity;
    return { cat: b.dataset.cat, actif: b.getAttribute('aria-pressed'), couleur: s.color, taille: parseFloat(s.fontSize), gras: +s.fontWeight, opacite: o, surBlanc: Math.round(rapport(s.color, 'rgb(255, 255, 255)') * 10) / 10, surPage: Math.round(rapport(s.color, fondPage) * 10) / 10 }; });
})()`);
const nombresLisibles = (l) => l.length === 5 && l.every((x) => x.surBlanc >= 4.5 && x.surPage >= 4.5 && x.taille >= 12 && x.gras >= 600 && x.opacite === 1);
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

log('=== LA CARTE (Leaflet, OpenStreetMap) ===');
const m0 = await attendreMarqueurs(attendu.length);
verifier(m0.total === attendu.length && m0.bulles.length >= 1, `${attendu.length} lieux sur la carte : ${m0.iso} marqueurs isolés + ${m0.bulles.length} bulle(s) de regroupement (${m0.bulles.join(', ')})`);
verifier(await ev(`L.version`) === '1.9.4', 'Leaflet 1.9.4 (version fixe, hébergée dans l\'appli)');
verifier(await ev(`!!document.querySelector('script[src="assets/leaflet/leaflet.js"]') && !document.querySelector('script[src*="unpkg"], script[src*="cdn"]')`), 'Leaflet vient de l\'appli, pas d\'un serveur tiers');
const attrib = await ev(`(() => { const a = document.querySelector('.leaflet-control-attribution'); const r = a.getBoundingClientRect(); const c = document.querySelector('#ca-carte').getBoundingClientRect(); const lien = [...a.querySelectorAll('a')].find((x) => /OpenStreetMap/.test(x.textContent)); return { texte: a.textContent, href: lien?.href, visible: r.width > 50 && r.height > 8 && r.right <= c.right + 1 && r.bottom <= c.bottom + 1 && getComputedStyle(a).visibility === 'visible' && getComputedStyle(a).display !== 'none', taille: parseFloat(getComputedStyle(a).fontSize) }; })()`);
verifier(/© OpenStreetMap contributors/.test(attrib.texte) && attrib.href === 'https://www.openstreetmap.org/copyright' && attrib.visible && attrib.taille >= 11, `attribution « © OpenStreetMap contributors » visible, avec le lien vers la licence (${attrib.taille}px)`);
for (let i = 0; i < 40 && tuiles === 0; i++) await sleep(250); // les tuiles partent juste après l'affichage de la carte : on leur laisse le temps sous charge
verifier(tuiles > 0, `les tuiles viennent de tile.openstreetmap.org (${tuiles} demandées, simulées)`);
verifier(await ev(`[...document.querySelectorAll('.leaflet-marker-icon.ca-marqueur')].every((m) => m.getAttribute('title') && m.getAttribute('tabindex') === '0')`), 'chaque marqueur a un nom (title) et se atteint au clavier (tabindex 0)');
verifier(await ev(`[...document.querySelectorAll('.leaflet-marker-icon.ca-groupe')].every((g) => g.getAttribute('tabindex') === '0' && /lieux regroupés/.test(g.textContent) && getComputedStyle(g.querySelector('.ca-groupe__n')).color === 'rgb(255, 255, 255)')`), 'chaque bulle : nombre de lieux en blanc, atteignable au clavier, nommée pour les lecteurs d\'écran (« N lieux regroupés »)');
verifier(await ev(`document.querySelector('#ca-carte').getAttribute('role') === 'region' && !!document.querySelector('#ca-carte').getAttribute('aria-label')`), 'la carte est une région nommée');
const couleurs = await ev(`[...document.querySelectorAll('.leaflet-marker-icon.ca-marqueur span')].map((s) => s.style.background + '|' + !!s.querySelector('svg'))`);
verifier(couleurs.length === m0.iso && couleurs.every((c) => c.endsWith('|true')), 'chaque marqueur isolé a son icône');
await cliquer('.leaflet-control-zoom-in'); await sleep(300);
verifier(await ev(`location.hash`) === '#/carte', 'les boutons + / − de la carte ne changent pas la page (pas de « # » dans l\'adresse)');
await sleep(700);
verifier(await ev(`document.activeElement !== null`) && (await ev(`getComputedStyle(document.querySelector('.leaflet-control-attribution')).display`)) !== 'none', 'carte toujours en place après un zoom');
const stock = await ev(`JSON.stringify([...Object.entries(localStorage), ...Object.entries(sessionStorage)])`);
verifier(!/48\.1175|1\.6775/.test(stock), 'la position exacte n\'est écrite nulle part (localStorage, sessionStorage)');
const zonesGardees = await ev(`JSON.parse(localStorage.getItem('carnetpatte.carteCache')).zones.map((z) => ({ cle: z.cle, rayon: z.rayon, cles: Object.keys(z).join() }))`);
verifier(zonesGardees.length === 1 && zonesGardees[0].cle === '48.12,-1.68' && zonesGardees[0].cles === 'cle,rayon,t,lieux', `seuls les lieux et la zone arrondie à 1 km sont gardés (cache de quelques heures) : ${JSON.stringify(zonesGardees)}`);
await axe('#contenu', 'Carte avec résultats, 1280 px');

log('=== FILTRES EN PASTILLES ===');
const pastilles = await ev(`[...document.querySelectorAll('.ca-filtre')].map((b) => ({ cat: b.dataset.cat, nom: b.textContent.replace(/\\s+/g, ' ').trim(), presse: b.getAttribute('aria-pressed'), n: b.querySelector('.cp-filtre__nombre').textContent, couleur: b.querySelector('.ca-puce').style.getPropertyValue('--ca-c'), icone: !!b.querySelector('.ca-puce svg'), haut: Math.round(b.getBoundingClientRect().height) }))`);
verifier(pastilles.length === 5 && pastilles.every((p) => p.presse === 'true' && p.icone && /^#[0-9A-F]{6}$/i.test(p.couleur)), `5 pastilles actives, chacune avec son icône et sa couleur : ${pastilles.map((p) => `${p.nom}`).join(' | ')}`);
verifier(new Set(pastilles.map((p) => p.couleur)).size === 5, 'cinq couleurs différentes');
verifier(pastilles.every((p) => +p.n === attendu.filter((x) => x.cat === p.cat).length), `nombre par catégorie juste (${pastilles.map((p) => `${p.cat}=${p.n}`).join(', ')})`);
const rangee = await ev(`(() => { const f = [...document.querySelectorAll('.ca-filtre')]; const c = document.querySelector('#ca-filtres'); return { lignes: new Set(f.map((b) => Math.round(b.getBoundingClientRect().top))).size, haut: Math.round(f[0].getBoundingClientRect().height), defile: getComputedStyle(c).overflowX, enrobage: getComputedStyle(c).flexWrap, fond: getComputedStyle(f[0]).backgroundColor, bord: getComputedStyle(f[0]).borderTopStyle, nombre: getComputedStyle(f[0].querySelector('.cp-filtre__nombre')).fontSize }; })()`);
verifier(rangee.lignes === 1 && rangee.haut <= 34 && rangee.defile === 'auto' && rangee.enrobage === 'nowrap', `filtres : une seule rangée de petites pastilles (${rangee.haut} px de haut) qui défile horizontalement`);
const lisib1 = await lisibiliteFiltres();
verifier(nombresLisibles(lisib1), `nombres des pastilles actives lisibles : ${lisib1.map((x) => `${x.cat} ${x.surBlanc}:1/${x.surPage}:1 ${x.gras}`).join(' | ')} (4,5:1 exigé sur blanc et sur le fond de la page)`);
const fondActif = rangee.fond.match(/[\d.]+/g).map(Number);
verifier(fondActif[0] >= 250 && fondActif[1] >= 250 && fondActif[2] >= 250 && (fondActif[3] ?? 1) >= 0.85 && rangee.bord === 'solid', `filtre actif : fond clair (${rangee.fond}), bord plein à la couleur de la catégorie, plus de gros bloc foncé`);
await cliquer('.ca-filtre[data-cat=veto]'); await sleep(300);
const inactif = await ev(`(() => { const b = document.querySelector('.ca-filtre[data-cat=veto]'); const st = getComputedStyle(b); return { fond: st.backgroundColor, bord: st.borderTopStyle }; })()`);
const lisib2 = await lisibiliteFiltres();
verifier(nombresLisibles(lisib2) && lisib2.find((x) => x.cat === 'veto').actif === 'false', `nombre d'une pastille INACTIVE aussi lisible (${lisib2.find((x) => x.cat === 'veto').surBlanc}:1 sur blanc, ${lisib2.find((x) => x.cat === 'veto').surPage}:1 sur la page)`);
verifier(inactif.bord === 'dashed' && /rgba\(0, 0, 0, 0\)|transparent/.test(inactif.fond), `filtre inactif : transparent à bord pointillé (${inactif.fond}, ${inactif.bord}) : on le distingue de l'actif sans la couleur seule`);
let vis = attendu.filter((x) => x.cat !== 'veto');
verifier((await liste()).length === vis.length && (await attendreMarqueurs(vis.length, 8000)).total === vis.length && await ev(`document.querySelector('.ca-filtre[data-cat=veto]').getAttribute('aria-pressed')`) === 'false', `sans les vétérinaires : ${vis.length} lieux dans la liste ET sur la carte`);
verifier((await liste()).every((x) => !/Vétérinaire ·/.test(x.meta)) && /^\d+ lieux? dans 5 km/.test(await statut()), 'plus aucun vétérinaire dans la liste ; le statut se met à jour');
for (const c of ['parc', 'animalerie', 'toiletteur', 'refuge']) await cliquer(`.ca-filtre[data-cat=${c}]`);
await sleep(300);
verifier((await liste()).length === 0 && /Aucun type de lieu sélectionné/.test(await statut()), 'tout désactivé : message clair, liste vide');
for (const c of ['veto', 'parc', 'animalerie', 'toiletteur', 'refuge']) await cliquer(`.ca-filtre[data-cat=${c}]`);
await sleep(300);
verifier((await liste()).length === attendu.length, 'tout réactivé : tous les lieux reviennent');
await cliquer('.ca-filtre[data-cat=animalerie]'); await sleep(200); await cliquer('.ca-filtre[data-cat=animalerie]'); await sleep(200);

log('=== FICHE D\'UN LIEU ===');
const ouvrir = async (id) => { await ev(`document.querySelector('.ca-lieu[data-id="${id}"]').click()`); await sleep(400); };
await ouvrir('node/1');
verifier(await ev(`!document.querySelector('#ca-fiche').hidden`) && await texte('#ca-fiche h3') === 'Clinique Vétérinaire du Parc', 'toucher un lieu de la liste ouvre sa fiche (nom)');
const f1 = await texte('#ca-fiche');
verifier(f1.includes('12 rue des Lilas, 35000 Rennes') && f1.includes('+33 2 99 00 00 01') && f1.includes('lun-ven 09:00-18:00 ; sam 09:00-12:00'), `fiche : adresse, téléphone, horaires traduits (${f1.slice(0, 160)}…)`);
const b1 = await ev(`(() => { const a = [...document.querySelectorAll('#ca-fiche a')]; const it = a.find((x) => /^Itinéraire/.test(x.textContent.trim())); const ap = a.find((x) => /^Appeler/.test(x.textContent.trim())); return { it: it?.href, itRel: it?.rel, itCible: it?.target, ap: ap?.href, apNom: ap?.getAttribute('aria-label'), osm: [...a].find((x) => /OpenStreetMap/.test(x.textContent))?.href }; })()`);
verifier(new RegExp(`^https://(www.google.com/maps/dir/\\?api=1&destination=${nord(400)},${C.lon}|maps.apple.com/\\?daddr=${nord(400)},${C.lon}&dirflg=d)$`).test(b1.it) && /noopener/.test(b1.itRel) && b1.itCible === '_blank', `bouton « Itinéraire » : ${b1.it}`);
verifier(b1.ap === 'tel:+33299000001' && /^Appeler/.test(b1.apNom), `bouton « Appeler » : ${b1.ap}`);
verifier(b1.osm === 'https://www.openstreetmap.org/node/1', 'lien pour corriger le lieu sur OpenStreetMap');
verifier(await ev(`document.activeElement.id`) === 'ca-fiche', 'le focus passe sur la fiche (lecteurs d\'écran)');
verifier(await ev(`document.querySelector('.ca-lieu[data-id="node/1"]').getAttribute('aria-current')`) === 'true' && await attendre(`document.querySelector('.leaflet-marker-icon.is-selection')?.getAttribute('title') === 'Clinique Vétérinaire du Parc'`, 8000), 'lieu choisi : repéré dans la liste ET sur la carte (le marqueur sort de sa bulle)');
await axe('#ca-fiche', 'fiche d\'un lieu');
await ouvrir('node/2');
verifier(/Ouvert 24h\/24, 7 j\/7/.test(await texte('#ca-fiche')), '« Ouvert 24h/24 » seulement parce que la donnée dit 24/7');
await ouvrir('node/4');
const f4 = await texte('#ca-fiche');
verifier(/Horaires non indiqués/.test(f4) && /Téléphone non indiqué/.test(f4) && /Adresse non indiquée/.test(f4) && !/24\s?h/i.test(f4) && await ev(`![...document.querySelectorAll('#ca-fiche a')].some((x) => /^Appeler/.test(x.textContent.trim()))`), 'sans horaires ni téléphone dans les données : rien d\'inventé, jamais « 24h/24 », pas de bouton « Appeler »');
await ouvrir('node/5');
verifier(/Téléphone non indiqué/.test(await texte('#ca-fiche')) && /lun-sam 10:00-19:00/.test(await texte('#ca-fiche')), 'un « téléphone » qui n\'en est pas un est ignoré');
const f5h = await texte('#ca-fiche');
verifier(!/["\u201C\u201D]/.test(f5h) && /Sur rendez-vous ; lun-sam 10:00-19:00/.test(f5h), `horaires : les guillemets d'OpenStreetMap disparaissent, le commentaire reste (« ${(f5h.match(/Sur rendez-vous[^()]*/) ?? [''])[0].trim()} »)`);
await ouvrir('way/3');   // choisir un lieu dans la liste le fait sortir de sa bulle : la carte zoome sur lui
verifier(await attendre(`!!document.querySelector('.leaflet-marker-icon[title="Parc canin de la Prévalaye"]')`, 8000), 'choisir un lieu dans la liste fait apparaître son marqueur (la carte zoome jusqu\'à le sortir de sa bulle)');
await cliquer('#ca-fermer'); await sleep(300);
await ev(`document.querySelector('.leaflet-marker-icon[title="Parc canin de la Prévalaye"]').click()`); await sleep(500);
verifier(await texte('#ca-fiche h3') === 'Parc canin de la Prévalaye' && await ev(`document.activeElement.id`) === 'ca-fiche', 'toucher un marqueur ouvre aussi la fiche');
await cliquer('#ca-fermer'); await sleep(300);
verifier(await ev(`document.querySelector('#ca-fiche').hidden`) && await ev(`document.activeElement.classList.contains('ca-lieu')`), 'fermer la fiche : le focus revient dans la liste');
await ouvrir('node/12');
const longNom = await ev(`({ sw: document.documentElement.scrollWidth, iw: innerWidth, h3: document.querySelector('#ca-fiche h3')?.textContent, vis: !document.querySelector('#ca-fiche').hidden })`);
verifier(longNom.sw <= longNom.iw && /Faune Sauvage de Bretagne Occidentale/.test(longNom.h3 ?? ''), `nom très long : la fiche s'affiche entière sans déborder (${JSON.stringify(longNom).slice(0, 220)})`);

log('=== RAYON ET CACHE ===');
const avantR = nbOverpass();
await cliquer('input[name=ca-rayon][value="2"]');
verifier(await attendre(`/dans 2 km/.test(document.querySelector('#ca-statut').textContent)`), 'rayon 2 km');
attendu = attendus(POS, 2);
verifier(JSON.stringify((await liste()).map((x) => x.id)) === JSON.stringify(attendu.map((x) => x.id)), `2 km : ${attendu.length} lieux, triés`);
verifier(nbOverpass() === avantR, 'rayon plus petit : réponse tirée du cache, aucune nouvelle requête');
await cliquer('input[name=ca-rayon][value="10"]');
verifier(await attendre(`/dans 10 km/.test(document.querySelector('#ca-statut').textContent)`), 'rayon 10 km');
attendu = attendus(POS, 10);
l = await liste();
verifier(nbOverpass() === avantR + 1 && appels.filter((a) => a.type === 'overpass').at(-1).rayon === 11000, 'rayon plus grand : une seule nouvelle requête (11 km avec la marge)');
verifier(JSON.stringify(l.map((x) => x.id)) === JSON.stringify(attendu.map((x) => x.id)) && !l.some((x) => x.id === 'node/9'), `10 km : ${attendu.length} lieux triés ; le vétérinaire à 14 km est exclu`);
verifier(l.some((x) => x.nom === 'Vétérinaire (sans nom)') && l.some((x) => x.nom === 'Vétérinaire · rue Anonyme'), `lieu sans nom : « Vétérinaire (sans nom) » sans rue connue, « Vétérinaire · rue Anonyme » avec sa rue (${l.filter((x) => /Vétérinaire (\(|·)/.test(x.nom)).map((x) => x.nom).join(' | ')})`);
await cliquer('input[name=ca-rayon][value="5"]'); await attendre(`/dans 5 km/.test(document.querySelector('#ca-statut').textContent)`);
verifier(nbOverpass() === avantR + 1, 'retour à 5 km : toujours depuis le cache');

log('=== RECHERCHE PAR VILLE OU CODE POSTAL ===');
await chercherVille('Rennes');
verifier(await attendre(`/autour de Rennes, Ille-et-Vilaine/.test(document.querySelector('#ca-statut').textContent)`), `ville : « ${await statut()} »`);
verifier(nbNominatim() === 1 && appels.find((a) => a.type === 'nominatim').q === 'rennes', 'une requête de ville (Nominatim)');
verifier(nbOverpass() === avantR + 1, 'même zone que tout à l\'heure : aucune nouvelle requête de lieux (cache)');
attendu = attendus(C, 5);
verifier(JSON.stringify((await liste()).map((x) => x.id)) === JSON.stringify(attendu.map((x) => x.id)), 'lieux autour de Rennes, triés par distance depuis le centre-ville');
await chercherVille('35000');
await attendre(`/autour de 35000, Rennes/.test(document.querySelector('#ca-statut').textContent)`);
const cp = appels.filter((a) => a.type === 'nominatim').at(-1);
verifier(cp.cp === '35000' && cp.pays === 'France', 'un code postal à 5 chiffres est cherché comme code postal français');
await chercherVille('Brest');
verifier(await attendre(`/autour de Brest/.test(document.querySelector('#ca-statut').textContent)`) && /Aucun lieu trouvé dans 5 km autour de Brest/.test(await statut()), `aucun résultat : message honnête (« ${await statut()} »)`);
verifier(await ev(`document.querySelector('#ca-zone').hidden === false`), 'la carte reste affichée même sans lieu');
await chercherVille('zzzzzz');
await attendre(`/Aucune ville/.test(document.querySelector('#ca-erreur').textContent)`);
verifier(/Aucune ville ni aucun code postal/.test(await texte('#ca-erreur')) && await ev(`document.activeElement.id`) === 'ca-ville' && await ev(`!document.querySelector('#ca-reessayer')`), 'ville inconnue : message clair, focus dans le champ, pas de « Réessayer »');
const avantVide = nbNominatim();
await chercherVille('  ');
await sleep(300);
verifier(/Entrez une ville ou un code postal/.test(await texte('#ca-erreur')) && nbNominatim() === avantVide, 'champ vide : message, aucune requête');

log('=== UNE SEULE RECHERCHE À LA FOIS, PAUSE ENTRE LES REQUÊTES ===');
const n0 = appels.length;
await ev(`(() => { const i = document.querySelector('#ca-ville'); i.value = 'Nantes'; const f = document.querySelector('#ca-form'); f.requestSubmit(); f.requestSubmit(); document.querySelector('#ca-loc').click(); document.querySelector('input[name=ca-rayon][value="10"]').click(); })()`);
await attendre(`/autour de Nantes/.test(document.querySelector('#ca-statut').textContent) || /Aucun lieu trouvé/.test(document.querySelector('#ca-statut').textContent)`);
await sleep(4500); // laisse passer la relance éventuelle après le changement de rayon
const nouveaux = appels.slice(n0);
verifier(nouveaux.filter((a) => a.type === 'nominatim').length === 1, `deux envois du formulaire + « Autour de moi » pendant la recherche : une seule requête de ville (${nouveaux.filter((a) => a.type === 'nominatim').length})`);
verifier(maxEnCours === 1, `jamais deux requêtes en même temps vers OpenStreetMap (maximum observé : ${maxEnCours})`);
const ecarts = appels.slice(1).map((a, i) => a.t - appels[i].t);
verifier(ecarts.every((e) => e >= 1400), `au moins 1,5 s entre deux requêtes (plus petit écart : ${Math.min(...ecarts)} ms sur ${appels.length} requêtes)`);
verifier(await ev(`window.__geo`) === 1, 'le bouton « Autour de moi » est ignoré pendant une recherche');
verifier(appels.filter((a) => a.type === 'overpass').every((a) => a.methode === 'POST'), 'requêtes Overpass en POST (pas de très longue adresse)');
await cliquer('input[name=ca-rayon][value="5"]'); await attendre(`/dans 5 km/.test(document.querySelector('#ca-statut').textContent)`);

log('=== ERREURS RÉSEAU ===');
let avantE = erreurs.length;
mode = 'hors-ligne';
await chercherVille('Lyon');
verifier(await attendre(`document.querySelector('#ca-reessayer')`, 25000), 'coupure pendant la recherche : bouton « Réessayer » affiché');
verifier(/Impossible de joindre OpenStreetMap/.test(await texte('#ca-erreur')) && await ev(`document.querySelector('#ca-erreur [role=alert]') !== null`), 'message clair, annoncé aux lecteurs d\'écran (role=alert)');
await axe('#ca-erreur', 'message d\'erreur');
mode = 'ok';
await cliquer('#ca-reessayer');
verifier(await attendre(`/autour de Lyon/.test(document.querySelector('#ca-statut').textContent)`, 25000) && await ev(`!document.querySelector('#ca-erreur .cp-alerte')`), '« Réessayer » relance la même recherche : l\'erreur disparaît');
mode = 'serveur';
await chercherVille('Marseille');
verifier(await attendre(`/ne répond pas correctement/.test(document.querySelector('#ca-erreur').textContent)`, 40000) && await ev(`!!document.querySelector('#ca-reessayer')`), 'serveur en erreur (504) : message clair + « Réessayer »');
const detailsTech = await ev(`document.querySelector('.ca-details').textContent.replace(/\\s+/g, ' ').trim()`);
verifier(/overpass-api\.de/.test(detailsTech) && /overpass\.kumi\.systems/.test(detailsTech) && /overpass\.private\.coffee/.test(detailsTech) && !/mail\.ru/.test(detailsTech) && (detailsTech.match(/HTTP 504/g) ?? []).length === 3, `erreur : « Détails techniques » avec la vraie raison de CHAQUE serveur essayé (${detailsTech})`);
verifier(erreurs.some((e) => /\[Carte Patte\] overpass-api\.de : HTTP 504/.test(e)) && erreurs.some((e) => /\[Carte Patte\] overpass\.private\.coffee : HTTP 504/.test(e)), 'la vraie raison est écrite dans la console (« [Carte Patte] serveur : HTTP 504 … »)');
mode = 'remarque';
await cliquer('#ca-reessayer');
verifier(await attendre(`/ne répond pas correctement/.test(document.querySelector('#ca-erreur').textContent) && !document.querySelector('#ca-statut').textContent.includes('Recherche en cours')`, 25000), 'réponse « Query timed out » d\'Overpass : traitée comme une erreur, pas comme « aucun lieu »');
mode = 'ok';
await send('Network.enable');
await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
const avantHL = appels.length;
await chercherVille('Toulouse');
verifier(await attendre(`/Pas de connexion internet/.test(document.querySelector('#ca-erreur').textContent)`, 8000) && appels.length === avantHL, 'sans connexion : message immédiat, aucune requête tentée');
await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
await cliquer('#ca-reessayer');
verifier(await attendre(`/autour de Toulouse/.test(document.querySelector('#ca-statut').textContent)`, 25000), 'connexion revenue : « Réessayer » fonctionne');

log('=== SERVEUR OVERPASS DE SECOURS ===');
mode = 'principal-en-panne';
const avantS = appels.length;
await chercherVille('Paris');
verifier(await attendre(`/autour de Paris/.test(document.querySelector('#ca-statut').textContent)`, 40000) && await ev(`!document.querySelector('#ca-erreur .cp-alerte')`), 'serveur principal en panne (502) : la recherche réussit quand même grâce au serveur de secours, sans message d\'erreur');
verifier(appels.slice(avantS).filter((a) => a.type === 'overpass').map((a) => a.serveur).join() === 'overpass-api.de,overpass.kumi.systems', 'ordre des essais : le principal, puis le premier secours');
const avantL = appels.length;
await chercherVille('Lille');
verifier(await attendre(`/autour de Lille/.test(document.querySelector('#ca-statut').textContent)`, 40000), 'recherche suivante réussie');
verifier(appels.slice(avantL).filter((a) => a.type === 'overpass').map((a) => a.serveur).join() === 'overpass.kumi.systems', 'la recherche suivante commence directement par le serveur qui répond (pas d\'attente inutile sur celui en panne)');
mode = 'ok';
verifier(erreursAttendues(avantE) >= 0, 'seules les erreurs réseau simulées apparaissent dans la console (retirées du compte)');

log('=== LIEUX PRÉPARÉS À L\'AVANCE : lecture des fichiers du site (simulés) ===');
modeLocal = 'mock';
const lo0 = nbOverpass(), nn0 = nbNominatim(), lf0 = donneesAppels.length;
await ev(`window.__geo = 0`);
const lt0 = Date.now();
await cliquer('#ca-loc');
verifier(await attendre(`/lieux? dans/.test(document.querySelector('#ca-statut').textContent) && /extrait/.test(document.querySelector('#ca-source').textContent)`, 20000), 'les lieux s\'affichent depuis les fichiers du site');
const dureeLocale = Date.now() - lt0;
verifier(dureeLocale < 4000, `recherche « Autour de moi » en ${dureeLocale} ms (jamais 30 à 45 s) : aucune requête Overpass ni pause de 1,5 s`);
verifier(nbOverpass() === lo0 && nbNominatim() === nn0, 'AUCUNE requête vers Overpass ni Nominatim : la position ne quitte pas l\'appareil');
verifier(donneesAppels.slice(lf0).slice().sort().join() === '35.json,53.json,index.json', `seuls les départements voisins sont chargés (${donneesAppels.slice(lf0).join(', ')}) : pas 29.json (Brest)`);
attendu = attendus(POS, 5);
verifier(JSON.stringify((await liste()).map((x) => x.id)) === JSON.stringify(attendu.map((x) => x.id)), `liste triée par distance, deux fichiers réunis : ${(await liste()).map((x) => x.id.replace('node/', '')).join(' > ')}`);
const lsource = await texte('#ca-source');
verifier(/extrait d'OpenStreetMap du .*2026/.test(lsource) && /préparé à l'avance/.test(lsource) && !/frontière/.test(lsource), `la source est indiquée : « ${lsource} »`);
verifier(await ev(`(() => { const a = [...document.querySelectorAll('.ca-licence a')]; return a.some((x) => x.href === 'https://www.openstreetmap.org/copyright') && a.some((x) => x.href === 'https://opendatacommons.org/licenses/odbl/1-0/') && a.some((x) => x.href.endsWith('donnees/lieux/LICENCE.txt')) && /© contributeurs d'OpenStreetMap/.test(document.querySelector('.ca-licence').textContent) && a.every((x) => /noopener/.test(x.rel)); })()`), 'pied de page : « © contributeurs d\'OpenStreetMap », licence ODbL et lien vers la licence des fichiers');
verifier(await ev(`(() => { const a = [...document.querySelectorAll('.ca-licence a')]; return a.some((x) => x.href === 'https://adresse.data.gouv.fr/') && a.some((x) => x.href === 'https://www.etalab.gouv.fr/licence-ouverte-open-licence/') && /Base Adresse Nationale/.test(document.querySelector('.ca-licence').textContent) && /Licence Ouverte 2\\.0/.test(document.querySelector('.ca-licence').textContent); })()`), 'pied de page : la source (Base Adresse Nationale) et sa Licence Ouverte 2.0 sont citées, avec leurs liens');
verifier(await ev(`fetch('donnees/lieux/LICENCE.txt').then(async (r) => r.status === 200 && /ODbL/.test(await r.text()))`), 'le lien « licence et source » ouvre bien LICENCE.txt (ODbL)');
await ouvrir('node/1');
const lfSite = await ev(`(() => { const a = [...document.querySelectorAll('#ca-fiche a')].find((x) => /^Site web/.test(x.textContent.trim())); return a ? { href: a.href, rel: a.rel, cible: a.target, hote: a.textContent } : null; })()`);
verifier(lfSite && lfSite.href === 'https://clinique-du-parc.example/rdv' && /noopener/.test(lfSite.rel) && lfSite.cible === '_blank' && /clinique-du-parc\.example/.test(lfSite.hote), `fiche : lien « Site web » vers ${lfSite?.href} (nouvel onglet, noopener)`);
await ouvrir('node/4');
verifier(await ev(`![...document.querySelectorAll('#ca-fiche a')].some((x) => /^Site web/.test(x.textContent.trim()))`), 'sans site web dans les données : pas de ligne « Site web »');
const f4ban = await texte('#ca-fiche');
verifier(/Adresse officielle la plus proche : 7 Rue Test, 35000 Rennes/.test(f4ban) && /Base Adresse Nationale, à confirmer/.test(f4ban) && !/Adresse non indiquée/.test(f4ban), `adresse de la BAN : la fiche dit « adresse officielle la plus proche » et cite la source (${f4ban.slice(0, 110)}…)`);
verifier(await ev(`document.querySelector('.ca-lieu[data-id="node/4"] .ca-lieu__adresse')?.textContent`) === 'Près de : 7 Rue Test, 35000 Rennes', 'liste : « Près de : 7 Rue Test, 35000 Rennes » (une adresse BAN n\'est jamais présentée comme l\'adresse exacte)');
await ouvrir('node/1');
verifier(!/Adresse officielle la plus proche|Base Adresse Nationale/.test(await texte('#ca-fiche')) && /12 rue des Lilas, 35000 Rennes/.test(await texte('#ca-fiche')) && await ev(`!/Près de/.test(document.querySelector('.ca-lieu[data-id="node/1"]').textContent)`), 'une adresse d\'OpenStreetMap reste affichée telle quelle, sans la mention BAN');
log('--- fiche ouverte : la carte et le marqueur restent visibles (écran de 667 px, fiche haute, lieu choisi tout en bas de la liste) ---');
await cliquer('#ca-fermer'); await sleep(300);
await taille(375, 667); await sleep(500);
await ev(`window.scrollTo(0, document.body.scrollHeight)`); await sleep(400);
const hCarteSans = await ev(`Math.round(document.querySelector('#ca-carte').getBoundingClientRect().height)`);
await ev(`document.querySelector('.ca-lieu[data-id="node/1"]').click()`); await sleep(1800);
const visFiche = await ev(`(() => { const c = document.querySelector('#ca-carte').getBoundingClientRect(); const m = document.querySelector('.leaflet-marker-icon.is-selection')?.getBoundingClientRect(); const eh = document.querySelector('#barre-haut').getBoundingClientRect().bottom; const bas = document.querySelector('#barre-bas')?.getBoundingClientRect().top ?? innerHeight; const f = document.querySelector('#ca-fiche').getBoundingClientRect();
  return { carte: [Math.round(c.top), Math.round(c.bottom)], ecran: innerHeight, entete: Math.round(eh), marqueur: m ? { cx: Math.round(m.left + m.width / 2) - Math.round(c.left + c.width / 2), cy: Math.round(m.top + m.height / 2) - Math.round(c.top + c.height / 2), dedans: m.top >= eh && m.bottom <= bas } : null, ficheHaut: Math.round(f.top), hCarte: Math.round(c.height) }; })()`);
verifier(visFiche.marqueur && visFiche.marqueur.dedans && Math.abs(visFiche.marqueur.cx) <= 8 && Math.abs(visFiche.marqueur.cy) <= 8, `le marqueur est visible et AU CENTRE de la carte (écart ${visFiche.marqueur?.cx}, ${visFiche.marqueur?.cy} px ; carte de ${visFiche.carte[0]} à ${visFiche.carte[1]} px sous l'en-tête de ${visFiche.entete} px, écran de ${visFiche.ecran} px)`);
verifier(visFiche.hCarte < hCarteSans && visFiche.ficheHaut > visFiche.carte[1] - 4 && visFiche.ficheHaut < visFiche.ecran - 100, `la carte se resserre (${hCarteSans} → ${visFiche.hCarte} px) et le début de la fiche est visible juste dessous (haut de la fiche à ${visFiche.ficheHaut} px sur ${visFiche.ecran})`);
await ouvrir('node/5');
await sleep(1200);
verifier(await attendre(`(() => { const c = document.querySelector('#ca-carte').getBoundingClientRect(); const m = document.querySelector('.leaflet-marker-icon.is-selection')?.getBoundingClientRect(); return !!m && Math.abs(m.left + m.width / 2 - (c.left + c.width / 2)) <= 8 && Math.abs(m.top + m.height / 2 - (c.top + c.height / 2)) <= 8; })()`, 6000), 'passer à une autre fiche : le nouveau marqueur vient aussi au centre de la carte');
await cliquer('#ca-fermer'); await sleep(500);
verifier(await ev(`Math.round(document.querySelector('#ca-carte').getBoundingClientRect().height)`) === hCarteSans, 'fiche fermée : la carte retrouve sa taille');
await taille(1280, 900); await sleep(400);
await ouvrir('node/1');   // la suite du scénario referme cette fiche

await cliquer('#ca-fermer'); await sleep(200);
await cliquer('input[name=ca-rayon][value="10"]'); await attendre(`/dans 10 km/.test(document.querySelector('#ca-statut').textContent)`);
verifier(donneesAppels.slice(lf0).filter((f) => f.endsWith('.json')).length === 3 && nbOverpass() === lo0, 'autre rayon : lecture en mémoire, aucun nouveau fichier ni requête');
await cliquer('input[name=ca-rayon][value="5"]'); await attendre(`/dans 5 km/.test(document.querySelector('#ca-statut').textContent)`);
await axe('#contenu', 'Carte, lieux des fichiers du site (1280 px)');

log('--- une autre ville de France (Brest) : lignes piégées dans le fichier ---');
await chercherVille('Brest');
verifier(await attendre(`/autour de Brest/.test(document.querySelector('#ca-statut').textContent)`, 20000), `ville : « ${await statut()} »`);
const lbrest = await liste();
verifier(lbrest.length === 2 && lbrest.map((x) => x.nom).join('|') === 'Vétérinaire de Brest|Animalerie piégée', `les 4 lignes invalides (identifiant, catégorie, position, « pas une ligne ») sont ignorées : ${lbrest.map((x) => x.nom).join(' | ')}`);
verifier(donneesAppels.slice(lf0).filter((f) => f === '29.json').length === 1 && donneesAppels.slice(lf0).filter((f) => f === 'index.json').length === 1, 'seul 29.json est chargé de plus ; index.json une seule fois pour toute la visite');
await ouvrir('node/505');
verifier(await ev(`document.querySelectorAll('a[href^="javascript"]').length === 0 && ![...document.querySelectorAll('#ca-fiche a')].some((x) => /^Site web/.test(x.textContent.trim()))`), 'un site « javascript:… » est refusé : aucun lien dangereux');
verifier(await ev(`[...document.querySelectorAll('#ca-fiche a')].some((x) => x.href === 'tel:+33298000005')`), 'le téléphone valide de la même fiche reste utilisable');
await cliquer('#ca-fermer'); await sleep(200);

log('--- lieu sans nom : la catégorie et la rue la plus proche (fichiers du site) ---');
await cliquer('input[name=ca-rayon][value="10"]'); await attendre(`/dans 10 km/.test(document.querySelector('#ca-statut').textContent)`);
await chercherVille('Rennes');
await attendre(`/autour de Rennes/.test(document.querySelector('#ca-statut').textContent)`, 20000);
const sansNom = await liste();
verifier(sansNom.some((x) => x.nom === 'Vétérinaire · avenue de la Gare') && sansNom.some((x) => x.nom === 'Vétérinaire · rue Anonyme') && !sansNom.some((x) => /sans nom/.test(x.nom)), `sans nom : « ${sansNom.filter((x) => /^Vétérinaire ·/.test(x.nom)).map((x) => x.nom).join(' | ')} » (rue la plus proche venant du fichier)`);
await ouvrir('node/7');
verifier(/Près de : avenue de la Gare/.test(await texte('#ca-fiche')) && /à confirmer/.test(await texte('#ca-fiche')), 'fiche : « Près de : avenue de la Gare (rue la plus proche d\'après OpenStreetMap, à confirmer) »');
await cliquer('#ca-fermer'); await sleep(200);

log('--- grande ville : bulles de regroupement et suggestion « passer à N km » ---');
await ev(`window.__t = 0`);
await chercherVille('Metropolis');
verifier(await attendre(`/350 lieux dans 10 km autour de Metropolis/.test(document.querySelector('#ca-statut').textContent)`, 20000), `350 lieux dans 10 km : « ${await statut()} »`);
const sug1 = await texte('#ca-suggestion');
verifier(/Beaucoup de lieux ici \(350\) : passer à 5 km \?/.test(sug1) && await ev(`document.querySelector('#ca-suggestion-bouton')?.textContent.trim()`) === 'Passer à 5 km', `plus de 300 lieux : « ${sug1.replace(/\s+/g, ' ').slice(0, 90)} » (5 km garde 108 lieux)`);
const mm = await attendreMarqueurs(350, 30000);
verifier(mm.total === 350 && mm.bulles.length >= 5 && mm.iso < 350, `350 lieux regroupés : ${mm.iso} marqueurs isolés + ${mm.bulles.length} bulles (${mm.bulles.slice(0, 8).join(', ')}…), aucun lieu perdu`);
const niveauZoom = () => ev(`Math.max(...[...document.querySelectorAll('.leaflet-tile')].map((t) => +(t.src.split('/').slice(-3)[0] || 0)))`);
const zoomAvant = await niveauZoom();
const grosse = Math.max(...mm.bulles);
await ev(`[...document.querySelectorAll('.leaflet-marker-icon.ca-groupe')].sort((a, b) => +b.querySelector('.ca-groupe__n').textContent - +a.querySelector('.ca-groupe__n').textContent)[0].click()`); await sleep(600);
await attendre(`(() => { const b = [...document.querySelectorAll('.leaflet-marker-icon.ca-groupe')].map((g) => +g.querySelector('.ca-groupe__n').textContent); return b.length === 0 || Math.max(...b) < ${grosse}; })()`, 15000); // le zoom est animé : on attend sa vraie fin, pas un délai fixe
const apresZoom = await marqueurs();
log(`  zoom de la carte : ${zoomAvant} -> ${await niveauZoom()}`);
verifier(apresZoom.bulles.length === 0 || Math.max(...apresZoom.bulles) < grosse, `toucher la plus grosse bulle (${grosse} lieux) zoome : elle se défait, les lieux deviennent assez espacés pour s'afficher un à un (${apresZoom.iso} isolés, bulles ${apresZoom.bulles.join(', ') || 'aucune'})`);
await cliquer('#ca-suggestion-bouton');
verifier(await attendre(`/dans 5 km autour de Metropolis/.test(document.querySelector('#ca-statut').textContent)`, 20000), `« Passer à 5 km » : « ${await statut()} »`);
verifier(await ev(`document.querySelector('input[name=ca-rayon]:checked').value`) === '5' && await ev(`document.querySelector('#ca-suggestion').hidden`) && (await attendreMarqueurs(108, 20000)).total === 108, 'rayon 5 km choisi, 108 lieux, plus de suggestion (moins de 300)');
await cliquer('input[name=ca-rayon][value="10"]'); await attendre(`/dans 10 km/.test(document.querySelector('#ca-statut').textContent)`);
await chercherVille('Dense');
await attendre(`/autour de Denseville/.test(document.querySelector('#ca-statut').textContent)`, 20000);
verifier(/Beaucoup de lieux ici \(350\) : passer à 2 km \?/.test(await texte('#ca-suggestion')), `même à 5 km il y en aurait plus de 300 : on propose 2 km (« ${(await texte('#ca-suggestion')).replace(/\s+/g, ' ').slice(0, 70)} »)`);
await axe('#contenu', 'Carte, grande ville avec bulles et suggestion (1280 px)');
await cliquer('input[name=ca-rayon][value="5"]'); await attendre(`/dans 5 km/.test(document.querySelector('#ca-statut').textContent)`);
verifier(/Beaucoup de lieux ici \(350\) : passer à 2 km \?/.test(await texte('#ca-suggestion')), 'à 5 km, toujours 350 lieux : la suggestion reste (2 km)');
await cliquer('input[name=ca-rayon][value="2"]'); await attendre(`/dans 2 km/.test(document.querySelector('#ca-statut').textContent)`);
verifier(await ev(`document.querySelector('#ca-suggestion').hidden`), 'à 2 km (le plus petit rayon) : plus de suggestion, rien de plus petit à proposer');
await cliquer('input[name=ca-rayon][value="5"]'); await attendre(`/dans 5 km/.test(document.querySelector('#ca-statut').textContent)`);

log('--- hors de la France métropolitaine (Bruxelles) : Overpass en secours ---');
const lo1 = nbOverpass(), lf1 = donneesAppels.length;
await chercherVille('Bruxelles');
verifier(await attendre(`/autour de Bruxelles/.test(document.querySelector('#ca-statut').textContent) && /Overpass/.test(document.querySelector('#ca-source').textContent)`, 30000), `hors couverture : « ${await texte('#ca-source')} »`);
verifier(nbOverpass() === lo1 + 1 && donneesAppels.length === lf1, 'une requête Overpass, aucun fichier de département chargé');

log('--- près d\'une frontière : la limite est dite ---');
const lf2 = donneesAppels.length;
await chercherVille('Frontiere');
await attendre(`/autour de Ville-Frontière/.test(document.querySelector('#ca-statut').textContent)`, 20000);
verifier(!/frontière ou d'une côte/.test(await texte('#ca-source')), 'rayon 5 km, cercle entièrement en France : pas de remarque');
await cliquer('input[name=ca-rayon][value="10"]');
verifier(await attendre(`/frontière ou d'une côte/.test(document.querySelector('#ca-source').textContent)`, 20000), `rayon 10 km, cercle qui sort de France : « ${await texte('#ca-source')} »`);
await cliquer('input[name=ca-rayon][value="5"]'); await attendre(`/dans 5 km|Aucun lieu trouvé dans 5 km/.test(document.querySelector('#ca-statut').textContent)`);

log('--- fichiers du site en panne (HTTP 500) : repli automatique sur Overpass ---');
await send('Page.navigate', { url: URL }); await sleep(1800); await aller2('#/carte'); await ev(axeSrc); await poserEspion();
modeLocal = 'erreur-500';
const avantL500 = erreurs.length, lo2 = nbOverpass();
await cliquer('#ca-loc');
verifier(await attendre(`/lieux? dans/.test(document.querySelector('#ca-statut').textContent) && /Overpass/.test(document.querySelector('#ca-source').textContent)`, 40000), 'fichiers illisibles : la recherche réussit quand même, via Overpass');
verifier(nbOverpass() === lo2 + 1 && JSON.stringify((await liste()).map((x) => x.id)) === JSON.stringify(attendus(POS, 5).map((x) => x.id)), 'les lieux viennent bien d\'Overpass (une requête) et sont triés');
verifier(erreurs.slice(avantL500).every((e) => /Failed to load resource|500/.test(e)) && erreurs.slice(avantL500).length >= 1, 'seule l\'erreur réseau simulée apparaît dans la console (retirée du compte)');
erreurs.splice(avantL500);

log('=== PARIS, RAYON 10 km, VRAIS FICHIERS, iPhone simulé (processeur 4 fois plus lent) ===');
await send('Page.navigate', { url: URL }); await sleep(1800); await aller2('#/carte'); await ev(axeSrc); await poserEspion();
modeLocal = 'reel';
await taille(375, 812);
await send('Emulation.setCPUThrottlingRate', { rate: 4 });
await send('Performance.enable');
const tachesAvant = (await send('Performance.getMetrics')).result.metrics.find((m) => m.name === 'TaskDuration').value;
await cliquer('input[name=ca-rayon][value="10"]');
const tp = Date.now();
await chercherVille('Paris');
verifier(await attendre(`/lieux? dans 10 km autour de Paris/.test(document.querySelector('#ca-statut').textContent)`, 60000), `Paris : « ${await statut()} »`);
const nParis = +(await statut()).match(/^(\d+) lieu/)[1];
const mp = await attendreMarqueurs(nParis, 60000);
const dureeParis = Date.now() - tp;
const tachesApres = (await send('Performance.getMetrics')).result.metrics.find((m) => m.name === 'TaskDuration').value;
log(`  Paris 10 km : ${nParis} lieux, ${mp.iso} marqueurs isolés + ${mp.bulles.length} bulles, ${dureeParis} ms de la saisie à l'affichage complet, ${(tachesApres - tachesAvant).toFixed(2)} s de travail du processeur (ralenti 4 fois)`);
verifier(nParis >= 100, `plusieurs centaines de vrais lieux autour de Paris (${nParis})`);
verifier(mp.total === nParis && mp.bulles.length >= 3 && mp.iso < nParis / 2, `la carte reste lisible : ${nParis} lieux = ${mp.iso} marqueurs isolés + ${mp.bulles.length} bulles (${mp.bulles.slice(0, 6).join(', ')}…)`);
verifier(dureeParis < 8000 && tachesApres - tachesAvant < 6, `fluide même sur un processeur 4 fois plus lent : ${dureeParis} ms, ${(tachesApres - tachesAvant).toFixed(2)} s de calcul`);
verifier(/extrait d'OpenStreetMap/.test(await texte('#ca-source')) && await sansDebord(), 'lieux venant des fichiers (instantané) et aucun défilement horizontal à 375 px');
const rangee375 = await ev(`(() => { const c = document.querySelector('#ca-filtres'); const f = [...c.querySelectorAll('.ca-filtre')]; return { lignes: new Set(f.map((b) => Math.round(b.getBoundingClientRect().top))).size, defile: c.scrollWidth > c.clientWidth, haut: Math.round(f[0].getBoundingClientRect().height) }; })()`);
verifier(rangee375.lignes === 1 && rangee375.defile && rangee375.haut <= 34, `à 375 px : les 5 pastilles tiennent sur UNE rangée qui défile (${rangee375.haut} px de haut)`);
if (nParis > 300) {
  const sugParis = await texte('#ca-suggestion');
  verifier(/Beaucoup de lieux ici \(\d+\) : passer à \d km \?/.test(sugParis), `plus de 300 lieux à Paris : « ${sugParis.replace(/\s+/g, ' ').slice(0, 80)} »`);
} else {
  log(`  (Paris 10 km : ${nParis} lieux, moins de 300 : pas de suggestion de rayon)`);
  verifier(await ev(`document.querySelector('#ca-suggestion').hidden`), 'moins de 300 lieux : pas de suggestion');
}
await ev(`document.querySelector('#ca-carte').scrollIntoView({ block: 'center' })`); await sleep(400);
await ecran('paris-375');
const tz = Date.now();
await ev(`[...document.querySelectorAll('.leaflet-marker-icon.ca-groupe')].sort((a, b) => +b.querySelector('.ca-groupe__n').textContent - +a.querySelector('.ca-groupe__n').textContent)[0].click()`); await sleep(1500);
log(`  toucher la plus grosse bulle : ${Date.now() - tz} ms jusqu'à la fin du zoom (compris 1,5 s d'attente)`);
const zoomParis = await marqueurs();
log(`  après le zoom : ${zoomParis.iso} marqueurs isolés + ${zoomParis.bulles.length} bulles (${zoomParis.bulles.join(', ')})`);
await ecran('paris-375-zoom');
await send('Emulation.setCPUThrottlingRate', { rate: 1 });
await send('Page.navigate', { url: URL }); await sleep(1800); await aller2('#/carte'); await ev(axeSrc); await poserEspion();
await taille(1280, 900);

log('=== VRAIS FICHIERS : la fiche affiche exactement ce que contient le fichier (adresse, téléphone, adresse BAN) ===');
await chercherVille('Toulouse');
verifier(await attendre(`/autour de Toulouse/.test(document.querySelector('#ca-statut').textContent)`, 60000), `recherche « Toulouse » dans les vrais fichiers : « ${await statut()} »`);
const reels31 = new Map(lireLieux('31.json').lieux.map((l) => [l[0], l]));
for (let i = 0; i < 6 && await ev(`!document.querySelector('#ca-plus').hidden`); i++) { await cliquer('#ca-plus-bouton'); await sleep(200); }   // « Afficher plus de lieux » : toute la liste
const idsFichesT = await ev(`[...document.querySelectorAll('.ca-lieu')].map((b) => b.dataset.id)`);
const ecartsFiches = []; let nAdrFiche = 0, nTelFiche = 0, nBanFiche = 0;
for (const idl of idsFichesT) {
  await ev(`document.querySelector('.ca-lieu[data-id="${idl}"]').click()`); await sleep(300);
  const f = await ev(`(() => { const t = document.querySelector('#ca-fiche').innerText; return { adr: !/Adresse non indiquée/.test(t), tel: !!document.querySelector('#ca-fiche a[href^="tel:"]'), ban: /Adresse officielle la plus proche/.test(t), guillemets: /["\u201C\u201D]/.test(t) }; })()`);
  const [type, num] = idl.split('/');
  const ligne = reels31.get(`${type[0]}${num}`);
  if (!ligne) { ecartsFiches.push(`${idl} : absent du fichier 31.json`); continue; }
  const [, , , , nomL = '', adrL = '', telL = '', , , rueL = '', srcL = ''] = ligne;
  const attAdr = !!(adrL || (!nomL && rueL));
  const attTel = /^\+?\d{6,15}$/.test(String(telL).split(/[;,/]/)[0].replace(/[\s.()-]/g, ''));
  if (f.adr !== attAdr) ecartsFiches.push(`${idl} : adresse ${f.adr ? 'affichée' : 'absente'} mais fichier ${attAdr ? 'en a une' : 'sans adresse'}`);
  if (f.tel !== attTel) ecartsFiches.push(`${idl} : téléphone ${f.tel ? 'affiché' : 'absent'} mais fichier ${attTel ? 'en a un' : 'sans téléphone'}`);
  if (f.guillemets) ecartsFiches.push(`${idl} : guillemets dans la fiche`);
  if (f.ban !== (srcL === 'b' && !!adrL)) ecartsFiches.push(`${idl} : mention BAN ${f.ban ? 'affichée' : 'absente'} (fichier : ${srcL || 'OpenStreetMap'})`);
  if (f.adr) nAdrFiche++; if (f.tel) nTelFiche++; if (f.ban) nBanFiche++;
}
log(`  TOUTES les fiches de Toulouse (${idsFichesT.length} lieux à 5 km) ouvertes : adresse affichée ${nAdrFiche}, téléphone ${nTelFiche}, adresse officielle la plus proche (BAN) ${nBanFiche}`);
verifier(idsFichesT.length >= 40 && ecartsFiches.length === 0, `les ${idsFichesT.length} fiches de Toulouse affichent exactement ce que contient le fichier : adresse, téléphone et mention BAN (${ecartsFiches.slice(0, 3).join(' | ') || 'aucun écart'})`);
verifier(nAdrFiche * 100 >= 25 * idsFichesT.length && nTelFiche * 100 >= 25 * idsFichesT.length, `fiches de Toulouse : ${Math.round(nAdrFiche * 100 / idsFichesT.length)} % affichent une adresse (au moins 25 %) et ${Math.round(nTelFiche * 100 / idsFichesT.length)} % un téléphone (au moins 25 % ici : les parcs à chiens n'en ont pas ; 30 % sur l'ensemble des fichiers, vérifié plus haut)`);
await cliquer('#ca-fermer'); await sleep(200);
modeLocal = 'indisponible';

log('=== AFFICHAGE SUR 375 px (iPhone), PAGE RECHARGÉE ===');
await taille(375, 812);
await send('Page.navigate', { url: URL }); await sleep(1800); await aller2('#/carte'); await ev(axeSrc); await poserEspion();
const cle = await ev(`localStorage.getItem('carnetpatte.carteCache')`);
verifier(cle !== null && JSON.parse(cle).zones.length >= 1, 'le cache survit au rechargement (lieux seulement)');
// Cache expiré (plus de 6 h) : on doit refaire une vraie requête
await ev(`(() => { const o = JSON.parse(localStorage.getItem('carnetpatte.carteCache')); o.zones.forEach((z) => { z.t -= 7 * 3600e3; }); localStorage.setItem('carnetpatte.carteCache', JSON.stringify(o)); })()`);
const avantExp = nbOverpass();
await cliquer('#ca-loc');
verifier(await attendre(`/lieux? dans/.test(document.querySelector('#ca-statut').textContent)`) && nbOverpass() === avantExp + 1, 'cache vieux de plus de 6 h : ignoré, nouvelle requête');
await sleep(800);
attendu = attendus(POS, 5);
verifier(await sansDebord(), 'aucun défilement horizontal à 375 px');
const mesures = await ev(`(() => { const v = innerWidth; const trop = [...document.querySelectorAll('.pg--carte *')].filter((e) => !e.closest('.leaflet-container') && !e.closest('.ca-filtres') && !e.closest('.cp-sr') && getComputedStyle(e).position !== 'fixed').filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > v + 1 || r.left < -1); }).map((e) => e.className || e.tagName).slice(0, 5);
  const cible = (sel) => [...document.querySelectorAll(sel)].map((e) => Math.round(e.getBoundingClientRect().height));
  const carte = document.querySelector('#ca-carte').getBoundingClientRect();
  return { trop, carteL: Math.round(carte.width), carteH: Math.round(carte.height), carteG: Math.round(carte.left), carteD: Math.round(v - carte.right), boutons: [...cible('#ca-loc'), ...cible('#ca-chercher')], pastilles: cible('.ca-filtre'), lignes: cible('.ca-lieu'), rayons: [...document.querySelectorAll('.ca-rayons .cp-choix__option span')].map((e) => Math.round(e.getBoundingClientRect().height)) }; })()`);
verifier(mesures.trop.length === 0, `rien ne dépasse de l'écran (${mesures.trop.join(', ') || 'rien'})`);
verifier(mesures.carteL >= 300 && mesures.carteH >= 260 && mesures.carteG >= 8 && mesures.carteD >= 8, `la carte occupe la largeur avec une marge (${mesures.carteL} × ${mesures.carteH} px, marges ${mesures.carteG}/${mesures.carteD})`);
verifier(mesures.boutons.every((h) => h >= 40) && mesures.lignes.every((h) => h >= 48) && mesures.pastilles.every((h) => h >= 30), `boutons et lignes assez grands pour le doigt (boutons ${mesures.boutons}, pastilles ${mesures.pastilles}, lignes ${mesures.lignes})`);
await ecran('375-liste', true);
await ouvrir('node/12');
verifier(await sansDebord() && await ev(`(() => { const f = document.querySelector('#ca-fiche').getBoundingClientRect(); return f.left >= 0 && f.right <= innerWidth && [...document.querySelectorAll('#ca-fiche *')].every((e) => e.getBoundingClientRect().right <= innerWidth + 1); })()`), 'fiche avec un nom de 120 caractères : tout reste dans l\'écran');
await ecran('375-fiche');
// La carte ne passe pas par-dessus la barre du bas
const dessus = await ev(`(() => { window.scrollTo(0, document.querySelector('#ca-carte').getBoundingClientRect().top + scrollY - (innerHeight - 110)); const n = document.querySelector('.cp-nav-bas').getBoundingClientRect(); const e = document.elementFromPoint(n.left + n.width / 2, n.top + n.height / 2); return !!e?.closest('#nav-bas'); })()`);
verifier(dessus, 'la carte glisse SOUS la barre de navigation du bas (rien ne la recouvre)');
await ev(`window.scrollTo(0, 0)`);
await axe('#contenu', 'Carte avec fiche, 375 px');
await taille(768, 1024); await sleep(500); verifier(await sansDebord(), 'aucun défilement horizontal à 768 px'); await axe('#contenu', 'Carte, 768 px');
await taille(1280, 900); await sleep(500); verifier(await sansDebord(), 'aucun défilement horizontal à 1280 px'); await axe('#contenu', 'Carte, 1280 px');

log('=== LES AUTRES PAGES NE SONT PAS CASSÉES ===');
for (const h of ['#/accueil', '#/animaux', '#/animaux/rappels', '#/toxique', '#/profil', '#/donnees', '#/bientot']) { await aller2(h); verifier(await ev(`!!document.querySelector('#contenu h1')`), `page ${h} s'affiche`); }
await aller2('#/bientot'); verifier(await ev(`document.querySelectorAll('.bt-carte').length`) === 3, 'page Bientôt : 3 modules à venir');
await aller2('#/carte'); verifier(await ev(`!!document.querySelector('.leaflet-container')`) && /lieux? dans/.test(await statut()), 'revenir sur la Carte : les résultats sont toujours là, sans nouvelle requête');
verifier(await ev(`document.querySelectorAll('.leaflet-container').length`) === 1, 'une seule carte dans la page (l\'ancienne est bien détruite)');

log('=== DONNÉES DE L\'UTILISATEUR INTACTES ===');
const apresDonnees = sansHorodatage(await donnees());
verifier(avantDonnees === apresDonnees, 'utiliser la Carte ne modifie aucune donnée enregistrée (animaux, soins, pesées)');
verifier(!/carteCache|"lat"|lieux/.test(await donnees()), 'les lieux gardés ne sont pas dans l\'export de sauvegarde');
const exp = await donnees();
await ev(`import('/js/storage.js').then(m => m.toutEffacer())`);
verifier(await ev(`localStorage.getItem('carnetpatte.carteCache')`) === null, '« Tout effacer » vide aussi les lieux gardés par la Carte');
await importer(exp);
const exp2 = await donnees();
log('export -> effacer -> import -> export identique :', sansHorodatage(exp) === sansHorodatage(exp2));

log('ERREURS CONSOLE :', erreurs.length ? erreurs : 'aucune');
log('VÉRIFICATIONS EN ÉCHEC :', echecs);
ws.close(); proc.kill(); process.exit(echecs ? 1 : 0);
