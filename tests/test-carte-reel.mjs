// Test « carte-reel » : Carte Patte contre les VRAIS serveurs OpenStreetMap (Nominatim, Overpass, tuiles). Lancé À LA MAIN seulement :
//   node tests/lancer.mjs carte-reel
// Il ne fait partie ni de la suite automatique ni du mode --rapide : il demande internet et dépend de serveurs publics, parfois en panne.
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
const sansDebord = () => ev(`document.documentElement.scrollWidth<=innerWidth`);
const texte = (sel) => ev(`(document.querySelector(${JSON.stringify(sel)})?.innerText ?? 'ABSENT').replace(/\\s+/g,' ').trim()`);


const VILLE = 'Toulouse';
const POINT = { lat: 43.6045, lon: 1.4442 };   // centre de Toulouse
const donnees = () => ev(`import('/js/storage.js').then(m => m.exporter())`);
const sansHorodatage = (t) => { const o = JSON.parse(t); delete o.exporteLe; return JSON.stringify(o); };
const attendre = async (expr, ms) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await ev(expr)) return true; await sleep(300); } return false; };

await send('Page.navigate', { url: URL }); await sleep(1800); await taille(1280, 900); await aller2('#/carte');
await ev(`localStorage.removeItem('carnetpatte.carteCache')`); // on veut de vraies requêtes, pas le cache
const avant = sansHorodatage(await donnees());

log('=== 1. LES SERVEURS RÉPONDENT-ILS ? (requêtes réelles depuis le navigateur, comme l\'appli) ===');
// Même chemin que l'appli : fetch depuis la page. Un refus CORS ou une coupure y apparaît comme « Failed to fetch ».
const sonde = (url, optionsJs) => ev(`(async () => { const t0 = performance.now(); try { const r = await fetch(${JSON.stringify(url)}, Object.assign(${optionsJs}, { signal: AbortSignal.timeout(60000) })); const txt = await r.text(); return { ok: r.ok, status: r.status, ms: Math.round(performance.now() - t0), debut: txt.slice(0, 90).replace(/\\s+/g, ' '), elements: (() => { try { return JSON.parse(txt).elements.length; } catch { return null; } })() }; } catch (e) { return { ok: false, erreur: e.name + ' : ' + e.message, ms: Math.round(performance.now() - t0) }; } })()`);
const nominatim = await sonde(`https://nominatim.openstreetmap.org/search?q=${VILLE}&format=jsonv2&limit=1&accept-language=fr`, '{}');
log('  Nominatim (ville) :', JSON.stringify(nominatim));
verifier(nominatim.ok && /place_id/.test(nominatim.debut), `Nominatim répond (HTTP ${nominatim.status} en ${nominatim.ms} ms, CORS accepté par le navigateur)`);
const serveurs = await ev(`import('/modules/carte/carte-donnees.js').then(m => m.SERVEURS_OVERPASS.map((s) => ({ nom: s.nom, url: s.url })))`);
const requete = await ev(`import('/modules/carte/carte-donnees.js').then(m => m.requeteOverpass(${POINT.lat}, ${POINT.lon}, 6000))`);
let bons = 0;
for (const s of serveurs) {
  await sleep(1600); // pause entre deux requêtes, comme l'appli
  const r = await sonde(s.url, `{ method: 'POST', body: new URLSearchParams({ data: ${JSON.stringify(requete)} }) }`);
  log(`  Overpass ${s.nom} :`, JSON.stringify(r));
  const bon = r.ok && r.elements > 0;
  if (bon) bons++;
  verifier(bon, `Overpass ${s.nom} répond avec des lieux (${r.ok ? `HTTP ${r.status}, ${r.elements} éléments, ${r.ms} ms` : `ÉCHEC : ${r.erreur ?? `HTTP ${r.status} ${r.debut}`}`})`);
}
verifier(bons >= 1, `au moins un serveur Overpass répond (${bons} sur ${serveurs.length}) : sinon la Carte ne peut pas fonctionner`);

log('=== 2. LA RECHERCHE COMPLÈTE DANS L\'APPLI (vraie ville, rayon 5 km) ===');
await sleep(1600);
const t0 = Date.now();
await ev(`(() => { const i = document.querySelector('#ca-ville'); i.value = ${JSON.stringify(VILLE)}; i.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#ca-form').requestSubmit(); })()`);
const fini = await attendre(`!/Recherche en cours/.test(document.querySelector('#ca-statut').textContent) && (document.querySelector('#ca-statut').textContent !== '' || document.querySelector('#ca-erreur .cp-alerte'))`, 200000);
const duree = Date.now() - t0;
const statut = await texte('#ca-statut');
const erreurUi = await texte('#ca-erreur');
log(`  durée : ${duree} ms · statut : « ${statut} » · erreur affichée : « ${erreurUi === 'ABSENT' ? '' : erreurUi} »`);
verifier(fini && !(await ev(`!!document.querySelector('#ca-erreur .cp-alerte')`)), `la recherche aboutit sans message d'erreur (${erreurUi.slice(0, 200)})`);
verifier(new RegExp(`autour de ${VILLE}`).test(statut) && /^\d+ lieux? dans 5 km/.test(statut), `statut : « ${statut} »`);
const lieux = await ev(`[...document.querySelectorAll('.ca-lieu')].map((b) => ({ nom: b.querySelector('.ca-lieu__nom').textContent, meta: b.querySelector('.ca-lieu__meta').textContent }))`);
log('  premiers lieux :', lieux.slice(0, 5).map((l) => `${l.nom} (${l.meta})`).join(' | '));
verifier(lieux.length >= 1, `des lieux réels sont affichés (${lieux.length} dans la liste)`);
const km = (t) => { const m = t.match(/([\d,]+)\s*(km|m)\b/); return m ? parseFloat(m[1].replace(',', '.')) * (m[2] === 'km' ? 1000 : 1) : NaN; };
verifier(lieux.every((l, i) => i === 0 || km(l.meta) >= km(lieux[i - 1].meta)) && lieux.every((l) => km(l.meta) <= 5000), 'liste triée par distance, tous dans les 5 km');
verifier(await attendre(`document.querySelectorAll('.leaflet-marker-icon.ca-marqueur').length > 0 && document.querySelectorAll('.leaflet-tile-loaded').length > 0`, 20000), 'la carte affiche des marqueurs et de vraies tuiles OpenStreetMap');
const serveurUtilise = await ev(`JSON.parse(localStorage.getItem('carnetpatte.carteCache') ?? '{"zones":[]}').zones.length`);
verifier(serveurUtilise === 1, 'les lieux sont gardés en cache après une vraie recherche');
await ecran('reel-toulouse');

log('=== 3. CE QUE L\'APPLI A ÉCRIT DANS LA CONSOLE ===');
const estDiag = (e) => /\[Carte Patte\]|overpass|maps\.mail\.ru|nominatim|Access-Control|ERR_FAILED|Failed to load resource/.test(e); // vraies erreurs réseau des serveurs publics : informatives
const diag = erreurs.filter(estDiag);
for (const d of diag) log('  INFO', d);
log(diag.length ? `  ${diag.length} avertissement(s) de diagnostic : un serveur a échoué, l'appli a essayé le suivant.` : '  aucun avertissement : le premier serveur a répondu du premier coup.');
for (let i = erreurs.length - 1; i >= 0; i--) if (estDiag(erreurs[i])) erreurs.splice(i, 1);

log('=== 4. DONNÉES INTACTES ===');
verifier(avant === sansHorodatage(await donnees()), 'une vraie recherche ne modifie aucune donnée enregistrée');
const exp = await donnees();
await ev(`import('/js/storage.js').then(m => m.toutEffacer())`);
await ev(`import('/js/storage.js').then(m => m.importer(${JSON.stringify(exp)}))`);
log('export -> effacer -> import -> export identique :', sansHorodatage(exp) === sansHorodatage(await donnees()));

log('ERREURS CONSOLE :', erreurs.length ? erreurs : 'aucune');
log('VÉRIFICATIONS EN ÉCHEC :', echecs);
ws.close(); proc.kill(); process.exit(echecs ? 1 : 0);
