import { spawn } from 'node:child_process';
import fs from 'node:fs';
const S = process.argv[2], URL = process.argv[3], TAG = process.argv[4];
const E = process.env.EDGE || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'; // chemin de msedge.exe : à adapter avec la variable EDGE si besoin
const port = +(process.env.PORT||9350);
fs.rmSync(`${S}/prof-e2e-${TAG}`, { recursive: true, force: true });
const proc = spawn(E, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`, `--user-data-dir=${S}/prof-e2e-${TAG}`, '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let list; for (let i = 0; i < 40; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (list.find(t => t.type === 'page')) break; } catch {} await sleep(250); }
const ws = new WebSocket(list.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const erreurs = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') erreurs.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
  if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) erreurs.push('CONSOLE ' + d.params.args.map(a => a.value ?? a.description).join(' '));
  if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') erreurs.push('LOG ' + d.params.entry.text + ' ' + (d.params.entry.url || ''));
};
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'erreur'); return r.result.result.value; };
await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
fs.mkdirSync(`${S}/shots`, { recursive: true });
const log = (...a) => console.log(...a);
const taille = (w, h) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
const aller = async (h) => { await ev(`location.hash='${h}'`); await sleep(700); };
const clip = async (nom, sel, max = 2600) => { const r = await ev(`(()=>{const e=document.querySelector('${sel}');const b=e.getBoundingClientRect();return {y:b.top+scrollY,w:innerWidth,h:b.height}})()`);
  const c = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: r.y, width: r.w, height: Math.min(r.h, max), scale: 1 } }); fs.writeFileSync(`${S}/shots/${TAG}-${nom}.png`, Buffer.from(c.result.data, 'base64')); };


const aller2 = async (h) => { if (await ev(`location.hash`) === h) { await ev(`import('/js/router.js').then(r=>r.rafraichir())`); await sleep(500); } else await aller(h); };
const touche = async (key, code, vk) => { await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk }); await sleep(150); };
const ecran = async (nom) => { const c = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${S}/shots/${TAG}-${nom}.png`, Buffer.from(c.result.data, 'base64')); };
const donnees = () => ev(`JSON.parse(localStorage.getItem('carnetpatte.v1'))`);
let axeSrc = ''; for (let i = 0; i < 4 && !axeSrc; i++) { try { axeSrc = await (await fetch('https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js')).text(); } catch { await sleep(1500); } }
const axe = async (sel, nom) => { const a = await ev(`axe.run(document.querySelector('${sel}'), {runOnly:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}).then(r=>({v:r.violations.map(v=>v.id+'('+v.nodes.length+') '+v.nodes[0].html.slice(0,90)),inc:r.incomplete.map(i=>i.id)}))`); log('axe', nom, ':', a.v.length ? 'VIOLATIONS ' + a.v.join(' | ') : '0 violation', a.inc.length ? '· à vérifier ' + a.inc : ''); };
const sansDebord = () => ev(`document.documentElement.scrollWidth<=innerWidth`);
const texte = (sel) => ev(`(document.querySelector(${JSON.stringify(sel)})?.innerText ?? 'ABSENT').replace(/\\s+/g,' ').trim()`);
const jour = (n) => { const d = new Date(); d.setDate(d.getDate() + n); const p = (x) => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
await send('Page.navigate', { url: URL }); await sleep(1800); await taille(1280, 900); await aller('#/animaux'); await ev(axeSrc);

// ===== Données enregistrées illisibles : jamais écrasées, copie de secours, message clair =====
let echecs = 0;
const verifier = (condition, texteLog) => { if (!condition) echecs++; log(`  ${texteLog} = ${condition}`); };
const CLE = 'carnetpatte.v1';
const lire = (k) => ev(`localStorage.getItem(${JSON.stringify(k)})`);
const cles = () => ev(`Object.keys(localStorage).sort()`);
const secours = async () => (await cles()).filter((k) => k.startsWith(CLE + '.secours'));
const recharger = async () => { await send('Page.reload'); await sleep(1600); await ev(axeSrc); };
const poser = async (brut) => { await ev(`localStorage.clear(); localStorage.setItem(${JSON.stringify(CLE)}, ${JSON.stringify(brut)})`); await recharger(); };

const valide = { version: 1, exemplesAjoutes: true, animaux: [{ id: 'a', nom: 'Pomme', espece: 'cheval', especeAutre: '', race: '', naissance: '', photo: '' }], soins: [], pesees: [] };
const CAS = [
  ['JSON coupé', '{"version":1,"animaux":[{"id":"a","nom":"Pomme"'],
  ['texte quelconque', 'bonjour'],
  ['null', 'null'],
  ['liste au lieu d un objet', '[]'],
  ['animaux n est pas une liste', JSON.stringify({ ...valide, animaux: 'oups' })],
  ['soins n est pas une liste', JSON.stringify({ ...valide, soins: { a: 1 } })],
  ['version plus récente (v2)', JSON.stringify({ ...valide, version: 2, champFutur: 'x' })],
];

for (const [nom, brut] of CAS) {
  log(`=== ${nom} ===`);
  await taille(1280, 900);
  await poser(brut);
  verifier(await lire(CLE) === brut, 'données d origine INTACTES (aucune écriture par-dessus)');
  const copies = await secours();
  verifier(copies.length === 1 && await lire(copies[0]) === brut, 'une copie de secours identique, dans une autre clé');
  verifier(await ev(`!!document.querySelector('#secours h1') && document.getElementById('app').hidden`), 'écran explicatif affiché à la place de l appli');
  verifier(await ev(`!document.body.innerText.includes('Moka')`), 'aucun animal d exemple ajouté');
  verifier(await ev(`import('/js/storage.js').then(m=>m.donneesBrutes())`) === brut, 'les données brutes sont disponibles au téléchargement, telles quelles');
  await recharger();
  verifier(await lire(CLE) === brut && (await secours()).length === 1, 'après un 2e chargement : toujours intactes, toujours UNE seule copie');
  await axe('#secours', `écran de secours (${nom})`);
}

log('=== Un clic sur « Repartir de zéro » : seulement après confirmation, la copie reste ===');
const mauvais = '{"version":1,"animaux":[';
await poser(mauvais);
await ev(`document.querySelector('[data-act=zero]').click()`); await sleep(400);
verifier(await lire(CLE) === mauvais, 'avant de confirmer : rien n a changé');
await ev(`document.querySelector('dialog [data-non]').click()`); await sleep(300);
verifier(await lire(CLE) === mauvais, 'après « Annuler » : rien n a changé');
await ev(`document.querySelector('[data-act=zero]').click()`); await sleep(400);
await ev(`document.querySelector('dialog [data-oui]').click()`); await sleep(1800); await ev(axeSrc);
const apres = JSON.parse(await lire(CLE));
verifier(apres.animaux.length === 0 && apres.exemplesAjoutes === true, 'après confirmation : données vides valides (sans animaux d exemple)');
verifier((await secours()).length === 1 && await lire((await secours())[0]) === mauvais, 'la copie de secours est toujours là');
verifier(await ev(`!document.getElementById('secours')`), 'l appli normale est revenue');

log('=== Importer une sauvegarde depuis l écran de secours ===');
await poser(mauvais);
await ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(JSON.stringify(valide))}))`);
verifier(JSON.parse(await lire(CLE)).animaux[0].nom === 'Pomme', 'import : les données du fichier remplacent les données illisibles');
verifier((await secours()).length === 1, 'la copie de secours des données illisibles est conservée');

log('=== Données valides : chargement sans aucune écriture ===');
const ancien = JSON.stringify(valide); // ancien format, sans « profil »
await poser(ancien);
verifier(await lire(CLE) === ancien && (await secours()).length === 0 && await ev(`!document.getElementById('secours')`), 'données valides : intactes octet pour octet, pas de copie de secours, appli normale');
const exp = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
await ev(`import('/js/storage.js').then(m=>m.toutEffacer())`);
await ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(exp)}))`);
const exp2 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
const net = (t) => { const o = JSON.parse(t); delete o.exporteLe; return JSON.stringify(o); };
log('export -> effacer -> import -> export identique :', net(exp) === net(exp2));

log('ERREURS CONSOLE :', erreurs.length ? erreurs : 'aucune');
log('VÉRIFICATIONS EN ÉCHEC :', echecs);
ws.close(); proc.kill(); process.exit(echecs ? 1 : 0);
