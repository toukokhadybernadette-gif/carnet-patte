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

// ===== 5h : prénom facultatif, ancien export, rechargement, graphique des pesées, tailles tactiles =====
let echecs = 0;
const verifier = (condition, texteLog) => { if (!condition) echecs++; log(`  ${texteLog} = ${condition}`); };
const ancienExport = JSON.stringify({ version: 1, exemplesAjoutes: true, exporteLe: '2025-01-01T00:00:00.000Z',
  animaux: [{ id: 'a', nom: 'Pomme', espece: 'cheval', especeAutre: '', race: '', naissance: '', photo: '' }],
  soins: [], pesees: [{ id: 'p1', animalId: 'a', date: '2025-01-01', poidsKg: 500 }, { id: 'p2', animalId: 'a', date: '2025-03-01', poidsKg: 510 }] }); // SANS le champ « profil »
const importer = (texte) => ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(texte)}))`);

log('=== ANCIEN EXPORT (sans profil) ===');
await importer(ancienExport);
verifier(await ev(`import('/js/storage.js').then(m=>JSON.stringify(m.lireProfil()))`) === '{"prenom":""}', 'importé sans erreur, prénom vide');
verifier((await donnees()).animaux.length === 1, 'animal importé');
await aller2('#/accueil');
verifier(await texte('h1') === 'Bonjour', 'Accueil sans prénom : « Bonjour » tout court');
verifier(await ev(`document.querySelector('#profil-lien').getAttribute('aria-label')`) === 'Profil', 'lien Profil sans prénom');

log('=== PROFIL : saisie du prénom ===');
const saisir = async (valeur) => { await aller2('#/profil'); await ev(`(()=>{const f=document.querySelector('.pf-form');f.prenom.value=${JSON.stringify(valeur)};f.requestSubmit();})()`); await sleep(500); };
await saisir('  Léa   Marie ');
verifier((await donnees()).profil.prenom === 'Léa Marie', 'prénom enregistré, espaces nettoyés');
await saisir('x'.repeat(80));
verifier((await donnees()).profil.prenom.length === 40, 'prénom limité à 40 caractères');
await saisir('Léa <b>');
await aller2('#/accueil');
verifier(await texte('h1') === 'Bonjour Léa <b>' && await ev(`!document.querySelector('h1 b')`), 'Accueil : « Léa <b> » affiché comme texte (rien n est interprété)');
await saisir('Léa');
await aller2('#/accueil');
verifier(await texte('h1') === 'Bonjour Léa', 'Accueil avec prénom : « Bonjour Léa »');
verifier(await ev(`document.querySelector('#profil-lien').getAttribute('aria-label')`) === 'Profil de Léa', 'lien Profil : « Profil de Léa »');
verifier(await texte('.app-lateral [data-nav=profil] .app-nav__texte') === 'Léa', 'barre latérale : le prénom remplace « Profil »');
await ecran('accueil-prenom');

log('=== RECHARGEMENT : les données et le prénom sont conservés ===');
const avant = JSON.stringify(await donnees());
await send('Page.reload'); await sleep(1800);
verifier(JSON.stringify(await donnees()) === avant, 'après rechargement, données identiques (aucun animal d exemple rajouté)');
await ev(axeSrc); // la page vient d'être rechargée : on réinjecte le moteur d'accessibilité

log('=== EXPORT / IMPORT AVEC PRÉNOM ===');
const exp = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
verifier(JSON.parse(exp).profil.prenom === 'Léa', 'l export contient profil.prenom');
await ev(`import('/js/storage.js').then(m=>m.toutEffacer())`);
verifier((await donnees()).profil.prenom === '', 'tout effacer : prénom effacé');
await importer(exp);
verifier((await donnees()).profil.prenom === 'Léa', 'réimport : prénom restauré');
for (const bizarre of [{ prenom: 42 }, { prenom: null }, 'texte', null, []]) {
  await importer(JSON.stringify({ ...JSON.parse(ancienExport), profil: bizarre }));
  verifier((await donnees()).profil.prenom === '', `profil invalide ${JSON.stringify(bizarre)} : ignoré, prénom vide`);
}

log('=== NAVIGATION : section Bientôt ===');
await taille(1280, 900); await aller2('#/accueil');
verifier(await ev(`getComputedStyle(document.querySelector('.app-bientot__liste')).display`) === 'none', 'repliée par défaut sur ordinateur');
await ev(`document.querySelector('.app-bientot__titre').click()`); await sleep(200);
verifier(await ev(`document.querySelector('.app-bientot__titre').getAttribute('aria-expanded')`) === 'true' && await ev(`getComputedStyle(document.querySelector('.app-bientot__liste')).display`) !== 'none', 'dépliée au clic (aria-expanded = true)');
await ev(`document.querySelector('.app-bientot__titre').click()`); await sleep(100);
await aller2('#/boutique');
verifier(await ev(`document.querySelector('.app-bientot--ouvert')!==null`), 'dépliée d office sur la page d un module à venir');
await taille(820, 1000); await sleep(200);
verifier(await ev(`[...document.querySelectorAll('.app-lateral .app-bientot [data-nav]')].every(a=>a.getBoundingClientRect().width>0)`), 'tablette : modules à venir visibles (icônes)');
await axe('#app', 'navigation tablette'); await taille(1280, 900);
await aller2('#/accueil');
await axe('#app', 'accueil avec prénom (ordinateur)');

log('=== PESÉES : graphique et info-bulle avec le nouveau style ===');
await importer(ancienExport);
await taille(1280, 900); await aller2('#/animaux/a'); await ev(`document.querySelector('[data-onglet="poids"]').click()`); await sleep(300);
verifier(await ev(`!!document.querySelector('.ps-graphique') && !document.querySelector('.ps-graphique').outerHTML.includes('NaN')`), 'graphique présent, sans NaN');
const geo = await ev(`(()=>{const g=document.querySelector('.ps-graphique');const lignes=[...g.querySelectorAll('.ps-grille')].map(l=>{const r=l.getBoundingClientRect();return r.top+r.height/2});const textes=[...g.querySelectorAll('text.ps-texte')].slice(0,lignes.length).map(t=>{const r=t.getBoundingClientRect();return r.top+r.height/2});return {ecarts:lignes.map((y,i)=>Math.abs(y-textes[i])),n:lignes.length}})()`);
verifier(geo.n > 0 && Math.max(...geo.ecarts) <= 6, `graduations alignées sur leurs lignes (écart max ${Math.max(...geo.ecarts).toFixed(1)} px)`);
const cible = (i) => ev(`(()=>{const c=document.querySelectorAll('.ps-cible')[${i}];c.scrollIntoView({block:'center'});const r=c.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
const c = await cible(1);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y }); await sleep(300);
verifier(await ev(`(()=>{const b=document.querySelector('.ps-infobulle');return !b.hidden && b.textContent.includes('510')})()`), 'souris : info-bulle affichée avec la valeur');
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 }); await sleep(200);
await taille(390, 844); await sleep(300);
const c2 = await cible(0);
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c2.x, y: c2.y }] }); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(300);
verifier(await ev(`(()=>{const b=document.querySelector('.ps-infobulle');return !b.hidden && b.textContent.includes('500')})()`), 'toucher (mobile) : info-bulle affichée avec la valeur');
await ecran('pesees-graphique-mobile');

log('=== TÉLÉPHONE : tailles tactiles et champs ===');
await importer(JSON.stringify({ ...JSON.parse(ancienExport), soins: [{ id: 's1', animalId: 'a', type: 'vermifuge', titre: '', date: '2025-01-01', notes: '', rappel: '2025-02-01', rappelFait: false }] }));
await aller2('#/animaux/rappels');
const mesures = await ev(`({fait:[...document.querySelectorAll('[data-fait]')].map(e=>Math.round(e.getBoundingClientRect().height)),une_ligne:[...document.querySelectorAll('.rp-ligne')].map(e=>e.getBoundingClientRect().height<=22)})`);
verifier(mesures.fait.length > 0 && mesures.fait.every((x) => x >= 44), `bouton « Fait » : ${mesures.fait.join(', ')} px (44 minimum)`);
verifier(mesures.une_ligne.length > 0 && mesures.une_ligne.every(Boolean), '« Prévu le… » tient sur une seule ligne');
await aller2('#/profil');
verifier(await ev(`[...document.querySelectorAll('input,select,textarea')].every(e=>parseFloat(getComputedStyle(e).fontSize)>=16)`), 'champs de saisie à 16 px minimum');
verifier(await sansDebord(), 'sans défilement horizontal');

await importer(exp);
const exp1 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
await ev(`import('/js/storage.js').then(m=>m.toutEffacer())`);
await importer(exp1);
const exp2 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
const net = (t) => { const o = JSON.parse(t); delete o.exporteLe; return JSON.stringify(o); };
log('export -> effacer -> import -> export identique :', net(exp1) === net(exp2));
log('ERREURS CONSOLE :', erreurs.length ? erreurs : 'aucune');
log('VÉRIFICATIONS EN ÉCHEC :', echecs);
ws.close(); proc.kill(); process.exit(echecs ? 1 : 0);
