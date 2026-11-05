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
const jourN = jour;
const fichier = (pesees, extra = {}) => JSON.stringify({ version: 1, exemplesAjoutes: true, exporteLe: '2026-01-01T00:00:00.000Z',
  animaux: [{ id: 'h', nom: 'Noisette', espece: 'autre', especeAutre: 'Hamster', race: '', naissance: '', photo: '' }, { id: 'c', nom: 'Moka', espece: 'chien', especeAutre: '', race: '', naissance: '', photo: '' }],
  soins: [], pesees, ...extra });
const charger = async (pesees, extra) => { await ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(fichier(pesees, extra))}))`); };
const poidsOnglet = async (id) => { await aller2('#/animaux/' + id); await ev(`document.querySelector('[data-onglet="poids"]').click()`); await sleep(250); };
const remplir = async (date, poids) => {
  await ev(`(()=>{const f=document.querySelector('.ps-form');f.date.value=${JSON.stringify(date)};const p=f.poids;p.value=${JSON.stringify(poids)};p.dispatchEvent(new Event('input',{bubbles:true}));f.requestSubmit();})()`); await sleep(300); };
const erreur = () => ev(`document.querySelector('.ps-form .cp-champ__erreur')?.innerText.trim() ?? null`);
const pesees = async () => (await donnees()).pesees;
const chiffres = () => ev(`[...document.querySelectorAll('.cp-stat')].map(s=>s.innerText.replace(/\\s+/g,' ')).join(' | ')`);

await taille(1280, 900); await aller('#/animaux');
await charger([]); await poidsOnglet('h');
log('=== ÉTAT VIDE : texte =', await texte('.ps'));
await axe('.ps', 'pesées vide ordinateur'); await clip('pesees-vide-ordinateur', '.ps');

log('=== VALIDATION (rien ne doit être enregistré en cas d\'erreur)');
const cas = [['vide', jourN(0), ''], ['zéro', jourN(0), '0'], ['0,000', jourN(0), '0,000'], ['négatif', jourN(0), '-3'], ['texte', jourN(0), 'abc'], ['2000,001', jourN(0), '2000,001'], ['2001', jourN(0), '2001'], ['0,0004', jourN(0), '0,0004'], ['date future', jourN(1), '4,2'], ['date vide', '', '4,2']];
for (const [nom, d, p] of cas) {
  await remplir(d, p);
  log(`  ${nom} : erreur = ${await erreur()} | pesées = ${(await pesees()).length} | aria-invalid = ${await ev(`document.querySelectorAll('.ps-form [aria-invalid]').length`)}`);
}
await taille(390, 844); await sleep(200); await clip('pesees-erreur-mobile', '.ps-form'); await taille(1280, 900);
await axe('.ps', 'pesées en erreur');
await ev(`(()=>{const p=document.querySelector('#pesee-poids');p.value='4';p.dispatchEvent(new Event('input',{bubbles:true}));})()`);
log('  l\'erreur du poids disparaît en corrigeant =', await ev(`!document.querySelector('#pesee-poids').getAttribute('aria-invalid')`));

log('=== SAISIES VALIDES');
const valides = [['4,2', 4.2], ['4.2', 4.2], ['0,035', 0.035], ['0.035', 0.035], ['0,001', 0.001], ['2000', 2000], [' 12,5 ', 12.5], ['7', 7], ['0,5', 0.5]];
for (const [saisie, attendu] of valides) {
  const avant = (await pesees()).length;
  await ev(`(()=>{const f=document.querySelector('.ps-form');f.date.value=${JSON.stringify(jourN(0))};f.poids.value=${JSON.stringify(saisie)};f.requestSubmit();})()`); await sleep(300);
  const ps = await pesees(); const der = ps[ps.length - 1];
  log(`  « ${saisie} » -> poidsKg = ${der?.poidsKg} (attendu ${attendu}) ok = ${der?.poidsKg === attendu && ps.length === avant + 1 && typeof der.poidsKg === 'number'} | clés = ${Object.keys(der).sort().join(',')}`);
}
log('  focus remis sur le poids =', await ev(`document.activeElement.id`));

await charger([{ id: 'h1', animalId: 'h', date: jourN(-6), poidsKg: 0.035 }, { id: 'h2', animalId: 'h', date: jourN(-4), poidsKg: 0.036 }, { id: 'h3', animalId: 'h', date: jourN(-2), poidsKg: 0.0345 }, { id: 'h4', animalId: 'h', date: jourN(0), poidsKg: 0.038 }]);
await poidsOnglet('h');
log('=== PETITS POIDS (hamster)');
log('  cartes :', await ev(`[...document.querySelectorAll('.ps-carte')].map(c=>c.querySelector('.ps-carte__poids').textContent+' ['+c.querySelector('.ps-carte__corps').innerText.split('\\n').pop()+']').join(' || ')`));
log('  aucune carte arrondie à 0 =', await ev(`![...document.querySelectorAll('.ps-carte__poids')].some(e=>/^0( |,0 )/.test(e.textContent.trim()) && e.textContent.trim().length<6)`));
log('  axe Y :', await ev(`[...document.querySelectorAll('.ps-graphique text')].slice(0,4).map(t=>t.textContent).join(' | ')`), '| étiquettes distinctes =', await ev(`new Set([...document.querySelectorAll('.ps-graphique text')].slice(0,4).map(t=>t.textContent)).size===4`));
log('  description du graphique :', await ev(`document.querySelector('.ps-graphique').getAttribute('aria-label')`));
log('  chiffres clés :', await chiffres());
await ev(`document.querySelector('[data-onglet="historique"]').click()`); await sleep(250);
log('  historique :', await ev(`[...document.querySelectorAll('[data-historique] *')].filter(e=>e.children.length===0&&e.textContent.startsWith('Pesée')).map(e=>e.textContent).join(' ; ')`));
await ev(`document.querySelector('[data-onglet="poids"]').click()`); await sleep(250);
for (const [nom, w, h] of [['ordinateur', 1280, 900], ['tablette', 820, 1100], ['mobile', 390, 844]]) {
  await taille(w, h); await sleep(300);
  log(`  ${nom} : sans défilement horizontal =`, await sansDebord());
  await axe('.ps', `pesées petits poids ${nom}`);
  await clip(`pesees-petits-poids-${nom}`, '.ps');
}

await taille(1280, 900);
await charger([{ id: 'u1', animalId: 'c', date: jourN(-3), poidsKg: 21.4 }]); await poidsOnglet('c');
log('=== UNE SEULE PESÉE : note =', await ev(`document.querySelector('.ps-note')?.innerText`), '| graphique absent =', await ev(`!document.querySelector('.ps-graphique')`), '| variation absente =', await ev(`!document.querySelector('.ps-carte').innerText.includes('précédente')`));
await charger([{ id: 'e1', animalId: 'c', date: jourN(-3), poidsKg: 10 }, { id: 'e2', animalId: 'c', date: jourN(-3), poidsKg: 10 }]); await poidsOnglet('c');
log('=== DEUX PESÉES IDENTIQUES, MÊME JOUR : graphique =', await ev(`!!document.querySelector('.ps-graphique')`), '| NaN =', await ev(`document.querySelector('.ps-graphique').outerHTML.includes('NaN')`), '| inchangé :', await ev(`[...document.querySelectorAll('.ps-carte')].map(c=>c.innerText.includes('inchangé')).join(',')`));
const gros = []; for (let i = 0; i < 70; i++) gros.push({ id: 'g' + i, animalId: 'c', date: jourN(-300 + i * 4), poidsKg: Math.round((20 + Math.sin(i / 6) * 3) * 10) / 10 });
await charger(gros); await poidsOnglet('c');
log('=== 70 PESÉES : cartes =', await ev(`document.querySelectorAll('.ps-carte').length`), '| NaN =', await ev(`document.querySelector('.ps-graphique').outerHTML.includes('NaN')`));
for (const [nom, w, h] of [['ordinateur', 1280, 900], ['tablette', 820, 1100], ['mobile', 390, 844]]) {
  await taille(w, h); await sleep(300);
  log(`  ${nom} : sans défilement horizontal =`, await sansDebord()); await axe('.ps', `pesées longue liste ${nom}`);
}
await taille(390, 844); await clip('pesees-70-mobile', '.ps', 1500); await taille(1280, 900);

const base = [{ id: 'p1', animalId: 'c', date: jourN(-20), poidsKg: 20.5 }, { id: 'p2', animalId: 'c', date: jourN(-10), poidsKg: 21 }, { id: 'p3', animalId: 'c', date: jourN(-1), poidsKg: 20.8 }, { id: 'ph', animalId: 'h', date: jourN(-1), poidsKg: 0.04 }];
const soinBase = [{ id: 's1', animalId: 'c', type: 'vaccin', titre: 'Rage', date: jourN(-5), notes: '', rappel: '', rappelFait: false }];
await charger(base, { soins: soinBase }); await poidsOnglet('c');
const avant = await donnees();
log('=== SUPPRESSION');
log('  noms des boutons :', await ev(`(()=>{const n=[...document.querySelectorAll('[data-supprimer]')].map(b=>b.getAttribute('aria-label'));return n.length+' boutons, '+new Set(n).size+' noms · '+n[0]})()`));
await ev(`document.querySelector('[data-pesee="p2"] [data-supprimer]').click()`); await sleep(400);
log('  fenêtre :', await ev(`document.querySelector('dialog[open]')?.innerText.replace(/\\s+/g,' ')`), '| focus =', await ev(`document.activeElement.textContent.trim()`));
await ev(`document.querySelector('dialog [data-non]').click()`); await sleep(400);
log('  Annuler : rien modifié =', JSON.stringify(avant) === JSON.stringify(await donnees()));
await ev(`document.querySelector('[data-pesee="p2"] [data-supprimer]').click()`); await sleep(400);
await touche('Escape', 'Escape', 27); await sleep(300);
log('  Échap : fenêtre fermée =', await ev(`!document.querySelector('dialog[open]')`), '| rien modifié =', JSON.stringify(avant) === JSON.stringify(await donnees()));
await ev(`document.querySelector('[data-pesee="p2"] [data-supprimer]').click()`); await sleep(400);
await ev(`document.querySelector('dialog [data-oui]').click()`); await sleep(600);
const apres = await donnees();
log('  Confirmer : seule p2 retirée =', JSON.stringify(apres.pesees.map((p) => p.id)) === '["p1","p3","ph"]', '| animaux et soins intacts =', JSON.stringify(apres.animaux) === JSON.stringify(avant.animaux) && JSON.stringify(apres.soins) === JSON.stringify(avant.soins), '| focus =', await ev(`document.activeElement.id`));
log('  variation recalculée :', await ev(`document.querySelector('[data-pesee="p3"]').innerText.replace(/\\s+/g,' ')`));
await remplir(jourN(0), '22,3');
log('=== AJOUT : chiffres clés =', await chiffres());

await ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(fichier([{ id: 'x"><img src=x onerror=alert(1)>', animalId: 'c', date: '2026-01-01"><b>', poidsKg: 3 }, { id: 'y', animalId: 'c', date: jourN(-2), poidsKg: 4 }]))}))`).catch(() => {});
await poidsOnglet('c').catch(() => {});
log('=== DONNÉES CORROMPUES : aucune balise injectée =', await ev(`!document.querySelector('.ps img, .ps b')`), '| aucune ligne Invalid =', await ev(`!document.querySelector('.ps').innerText.includes('Invalid')`), '| page affichée =', await ev(`!!document.querySelector('.ps-form')`));

await charger([{ id: 'k1', animalId: 'c', date: jourN(-2), poidsKg: 5 }]); await poidsOnglet('c');
await ev(`document.querySelector('#pesee-date').focus()`); await touche('Tab', 'Tab', 9);
log('=== CLAVIER : Tab après la date ->', await ev(`document.activeElement.id`));
await ev(`document.querySelector('#pesee-poids').value='5,5'; document.querySelector('#pesee-poids').focus()`); await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }); await sleep(400);
log('  Entrée dans le poids : pesée ajoutée =', (await pesees()).some((p) => p.poidsKg === 5.5));

for (const [nom, w, h] of [['ordinateur', 1280, 900], ['tablette', 820, 1100], ['mobile', 390, 844]]) {
  await taille(w, h);
  await charger(base); await aller2('#/donnees'); await sleep(300);
  log(`=== SAUVEGARDE ${nom} : sans défilement =`, await sansDebord(), '| titres =', await ev(`[...document.querySelectorAll('.dn-bloc h2')].map(h=>h.textContent).join(', ')`), '| boutons =', await ev(`[...document.querySelectorAll('.dn-bloc .cp-btn')].map(b=>b.innerText.trim()).join(', ')`));
  await axe('#contenu', `sauvegarde ${nom}`); await ecran(`sauvegarde-${nom}`);
  await aller2('#/bientot'); await sleep(300);
  log(`=== BIENTÔT ${nom} : sans défilement =`, await sansDebord(), '| cartes =', await ev(`document.querySelectorAll('.bt-carte').length`)); await axe('#contenu', `bientot ${nom}`); await ecran(`bientot-${nom}`);
  await poidsOnglet('c'); await ecran(`fiche-poids-${nom}`);
}
await taille(1280, 900); await charger(base); await aller2('#/donnees');
await ev(`document.querySelector('[data-act="effacer"]').click()`); await sleep(400);
await ev(`document.querySelector('dialog [data-non]').click()`); await sleep(300);
log('SAUVEGARDE — effacer annulé : pesées conservées =', (await pesees()).length === base.length);
await ev(`document.querySelector('[data-act="effacer"]').click()`); await sleep(400);
await ev(`document.querySelector('dialog [data-oui]').click()`); await sleep(600);
log('  effacer confirmé : plus de pesées =', (await pesees()).length === 0);
await charger(base);
const exp = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
await ev(`import('/js/storage.js').then(m=>m.toutEffacer())`);
await ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(exp)}))`);
const exp2 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
const net = (t) => { const o = JSON.parse(t); delete o.exporteLe; return JSON.stringify(o); };
log('export -> effacer -> import -> export identique :', net(exp) === net(exp2));
log('ERREURS CONSOLE :', erreurs.length ? erreurs : 'aucune');
ws.close(); proc.kill(); process.exit(0);
