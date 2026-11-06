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

// ===== Migration : données créées par la version EN LIGNE (main, 6d4e74c) -> nouvelle version, même origine =====
// L'ancien code est extrait du dépôt git (git archive) ; ancien et nouveau code sont servis tour à tour sur LE MÊME port,
// donc avec le même localStorage, exactement comme lorsqu'on publie une mise à jour sur le même site.
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const COMMIT_EN_LIGNE = process.env.COMMIT_EN_LIGNE || '6d4e74c'; // version de main avant la refonte
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ANCIEN = path.resolve(S, 'version-en-ligne');
let echecs = 0;
const verifier = (condition, texteLog) => { if (!condition) echecs++; log(`  ${texteLog} = ${condition}`); };

fs.rmSync(ANCIEN, { recursive: true, force: true }); fs.mkdirSync(ANCIEN, { recursive: true });
const arch = spawnSync('git', ['archive', '--format=tar', '-o', `${S}/version-en-ligne.tar`, COMMIT_EN_LIGNE], { cwd: RACINE });
if (arch.status !== 0) { log('git archive impossible :', String(arch.stderr)); process.exit(2); }
const tar = spawnSync('tar', ['-xf', 'version-en-ligne.tar', '-C', 'version-en-ligne'], { cwd: S }); // chemins relatifs : le tar de Git Bash prend « C: » pour un nom de machine
if (tar.status !== 0) { log('tar impossible :', String(tar.stderr)); process.exit(2); }
log(`version en ligne (${COMMIT_EN_LIGNE}) extraite : ${fs.existsSync(`${ANCIEN}/js/storage.js`)}`);

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
let racineServie = ANCIEN;
const serveur = http.createServer((q, r) => {
  const f = path.join(racineServie, decodeURIComponent(new globalThis.URL(q.url, 'http://x').pathname));
  if (!f.startsWith(racineServie) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404).end(); return; }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(r);
});
await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
const ORIGINE = `http://127.0.0.1:${serveur.address().port}/index.html`;
await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true });
let n = 0;
const ouvrir = async (version, hash = '#/animaux') => { racineServie = version === 'ancienne' ? ANCIEN : RACINE; await send('Page.navigate', { url: `${ORIGINE}?v=${++n}${hash}` }); await sleep(1800); };
const brut = () => ev(`localStorage.getItem('carnetpatte.v1')`);
const contenu = async (hash) => { await ev(`location.hash=${JSON.stringify(hash)}`); await sleep(700); return ev(`document.querySelector('#contenu').innerText.replace(/\\u00a0|\\u202f/g,' ').replace(/\\s+/g,' ')`); };
const DATE = /\b\d{1,2} (?:janv|févr|mars|avr|mai|juin|juil|août|sept|oct|nov|déc)\.? \d{4}\b/g;
const POIDS = /\b\d+(?:,\d+)? (?:kg|g)\b/g;
const jetons = (t) => [...new Set([...(t.match(DATE) ?? []), ...(t.match(POIDS) ?? [])])];
// Un repère de l'ancienne version est « présent » dans la nouvelle s'il y figure tel quel. Seule exception voulue : un poids de
// moins de 1 g (0,0455 kg), que l'ancienne version arrondissait à 3 décimales (« 0,046 kg ») et que la nouvelle (étape 5g)
// affiche sans arrondi trompeur (« 0,0455 kg ») : on accepte alors tout poids affiché qui donne le repère une fois arrondi.
const retrouve = (jeton, texte) => {
  if (texte.includes(jeton)) return true;
  if (!jeton.endsWith(' kg')) return false;
  const arrondi = (x) => Math.round(x * 1000) / 1000;
  const v = Number(jeton.replace(' kg', '').replace(',', '.'));
  return (texte.match(POIDS) ?? []).some((p) => p.endsWith(' kg') && arrondi(Number(p.replace(' kg', '').replace(',', '.'))) === v);
};

// ----- 1. La version en ligne crée des données (avec son propre code) -----
log('=== 1. Données créées par la version en ligne ===');
await taille(1280, 900);
await ouvrir('ancienne');
await ev(`import('/js/storage.js').then(async (m) => {
  const iso = (d) => { const x = new Date(); x.setDate(x.getDate() + d); const p = (v) => String(v).padStart(2, '0'); return x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate()); };
  const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  const pomme = m.ajouter('animaux', { nom: "Pomme d'Api", espece: 'cheval', especeAutre: '', race: 'Comtois', naissance: '2019-04-02', photo });
  const bob = m.ajouter('animaux', { nom: 'Bob <b>le</b> "Bricoleur" & Cie', espece: 'autre', especeAutre: 'Furet nain', race: '', naissance: '', photo: '' });
  const s = (a, type, titre, date, notes, rappel, fait) => m.ajouter('soins', { animalId: a.id, type, titre, date, notes, rappel, rappelFait: fait });
  s(pomme, 'vaccin', 'Grippe + tétanos', iso(-400), 'Rappel annuel.\\nDeuxième ligne : é, ç, œ.', iso(-35), false);
  s(pomme, 'vermifuge', '', iso(-90), '', iso(3), false);
  s(pomme, 'antiparasitaire', 'Pipette', iso(-20), '', iso(40), false);
  s(pomme, 'veto', 'Dents', iso(-200), 'RAS', '', false);
  s(pomme, 'autre', 'Parage', iso(-60), '', iso(-5), true);
  s(bob, 'vaccin', '', iso(-10), '', iso(0), false);
  s(bob, 'veto', 'Contrôle <i>annuel</i>', iso(-300), '', '', false);
  [[-300, 480], [-250, 485.5], [-200, 490], [-150, 492.5], [-100, 500], [-60, 505.25], [-30, 510], [-10, 512]].forEach(([d, kg]) => m.ajouter('pesees', { animalId: pomme.id, date: iso(d), poidsKg: kg }));
  [[-90, 0.035], [-45, 0.041], [-5, 0.0455]].forEach(([d, kg]) => m.ajouter('pesees', { animalId: bob.id, date: iso(d), poidsKg: kg }));
})`);
const donneesAvant = await brut();
const modele = JSON.parse(donneesAvant);
const ids = modele.animaux.map((a) => a.id);
log(`  créées : ${modele.animaux.length} animaux, ${modele.soins.length} soins, ${modele.pesees.length} pesées`);
const exportAncien = await ev(`import('/js/storage.js').then(m=>m.exporter())`);

// Ce que la version en ligne AFFICHE
const vueAncienne = { liste: await contenu('#/animaux'), rappels: await contenu('#/animaux/rappels'), fiches: {} };
for (const id of ids) vueAncienne.fiches[id] = await contenu(`#/animaux/${id}`);
const pastilleAncienne = await ev(`document.querySelector('.pastille-nav')?.textContent.trim() ?? ''`);
log(`  affichage ancien : pastille des retards = « ${pastilleAncienne} », ${jetons(vueAncienne.rappels).length} repères (dates, poids) sur la page Rappels`);
verifier(await brut() === donneesAvant, 'consulter les pages de l ancienne version n a rien modifié');

// ----- 2. La nouvelle version ouvre les mêmes données -----
log('=== 2. Nouvelle version, même origine, mêmes données ===');
await ouvrir('nouvelle');
verifier(await brut() === donneesAvant, 'données enregistrées IDENTIQUES octet pour octet après l ouverture (aucune écriture au chargement)');
verifier(await ev(`!document.getElementById('secours')`) && (await ev(`Object.keys(localStorage).filter(k=>k.includes('secours')).length`)) === 0, 'pas d écran de secours, pas de copie de secours');
const listeN = await contenu('#/animaux');
for (const a of modele.animaux) verifier(listeN.includes(a.nom), `Mes animaux : « ${a.nom} » affiché`);
const rappelsN = await contenu('#/animaux/rappels');
const manquantsRappels = jetons(vueAncienne.rappels).filter((j) => !retrouve(j, rappelsN));
verifier(manquantsRappels.length === 0, `Rappels : toutes les dates de l ancienne page sont là ${manquantsRappels.length ? JSON.stringify(manquantsRappels) : ''}`);
const nbRetardN = await ev(`document.querySelector('.app-lateral [data-nav=rappels] [data-retards]').hidden ? '' : document.querySelector('.app-lateral [data-nav=rappels] [data-retards]').textContent.trim()`);
verifier(nbRetardN === pastilleAncienne, `nombre de rappels en retard identique (ancien « ${pastilleAncienne} », nouveau « ${nbRetardN} »)`);
for (const id of ids) {
  const nom = modele.animaux.find((a) => a.id === id).nom;
  await ev(`location.hash=${JSON.stringify(`#/animaux/${id}`)}`); await sleep(700);
  let t = await ev(`document.querySelector('#contenu').innerText.replace(/\\u00a0|\\u202f/g,' ').replace(/\\s+/g,' ')`);
  await ev(`document.querySelector('[data-onglet="poids"]').click()`); await sleep(300);
  t += ' ' + await ev(`document.querySelector('#contenu').innerText.replace(/\\u00a0|\\u202f/g,' ').replace(/\\s+/g,' ')`);
  await ev(`document.querySelector('[data-onglet="historique"]').click()`); await sleep(300);
  t += ' ' + await ev(`document.querySelector('#contenu').innerText.replace(/\\u00a0|\\u202f/g,' ').replace(/\\s+/g,' ')`);
  const manquants = jetons(vueAncienne.fiches[id]).filter((j) => !retrouve(j, t));
  verifier(manquants.length === 0, `fiche « ${nom} » : dates et poids de l ancienne fiche tous présents ${manquants.length ? JSON.stringify(manquants) : ''}`);
  for (const s of modele.soins.filter((x) => x.animalId === id)) {
    const libelle = s.titre || { vaccin: 'Vaccin', vermifuge: 'Vermifuge', antiparasitaire: 'Antiparasitaire', veto: 'Visite véto', autre: 'Autre soin' }[s.type];
    if (!t.includes(libelle)) { echecs++; log(`  soin « ${libelle} » absent de la fiche ${nom} = false`); }
  }
  const notes = modele.soins.filter((x) => x.animalId === id && x.notes).map((x) => x.notes.split('\n')[0]);
  verifier(notes.every((x) => t.includes(x)), `fiche « ${nom} » : notes des soins présentes`);
}
verifier(await ev(`document.querySelectorAll('img[src^="data:image/png"]').length >= 0`) && await ev(`!document.querySelector('#contenu b, #contenu i')`), 'noms et titres avec du HTML (<b>, <i>) affichés comme texte, rien d interprété');

// ----- 3. Écrire dans la nouvelle version ne touche pas aux anciennes données -----
log('=== 3. Une écriture dans la nouvelle version ===');
await ev(`import('/js/storage.js').then(m=>{ m.modifierProfil({ prenom: 'Léa' }); m.ajouter('pesees', { animalId: ${JSON.stringify(ids[0])}, date: '2099-01-01', poidsKg: 1 }); })`);
const apres = JSON.parse(await brut());
for (const c of ['animaux', 'soins', 'pesees']) {
  verifier(JSON.stringify(apres[c].slice(0, modele[c].length)) === JSON.stringify(modele[c]), `« ${c} » : les ${modele[c].length} éléments d origine sont identiques, dans le même ordre`);
}
verifier(apres.pesees.length === modele.pesees.length + 1 && apres.profil.prenom === 'Léa' && apres.exemplesAjoutes === modele.exemplesAjoutes, 'seuls l ajout et le prénom ont changé');

const brutApresEcriture = await brut();
await ouvrir('nouvelle');
verifier(await brut() === brutApresEcriture, 'rechargement après l écriture : données enregistrées identiques (rien n est écrasé, aucun exemple ajouté)');

// ----- 4. Export de l'ancienne version -> import dans la nouvelle -----
log('=== 4. Export fait par la version en ligne, importé dans la nouvelle ===');
await ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(exportAncien)}))`);
const importe = JSON.parse(await brut());
verifier(['animaux', 'soins', 'pesees'].every((c) => JSON.stringify(importe[c]) === JSON.stringify(modele[c])), 'import de l export ancien : animaux, soins et pesées identiques');
verifier(importe.profil && importe.profil.prenom === '', 'import sans champ profil : prénom vide');

// ----- 5. Retour en arrière : l'ancienne version relit des données écrites par la nouvelle -----
log('=== 5. Retour à la version en ligne (annulation de la mise à jour) ===');
await ev(`import('/js/storage.js').then(m=>m.modifierProfil({ prenom: 'Léa' }))`);
await ouvrir('ancienne');
const listeA = await contenu('#/animaux');
verifier(modele.animaux.every((a) => listeA.includes(a.nom)), 'l ancienne version affiche tous les animaux après un passage par la nouvelle');
const t2 = await contenu(`#/animaux/${ids[0]}`);
verifier(jetons(vueAncienne.fiches[ids[0]]).every((j) => retrouve(j, t2)), 'et la fiche affiche les mêmes dates et poids');

const net = (t) => { const o = JSON.parse(t); delete o.exporteLe; return JSON.stringify(o); };
await ouvrir('nouvelle');
const e1 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
await ev(`import('/js/storage.js').then(m=>{ m.toutEffacer(); })`);
await ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(e1)}))`);
const e2 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
log('export -> effacer -> import -> export identique :', net(e1) === net(e2));
log('ERREURS CONSOLE :', erreurs.length ? erreurs : 'aucune');
log('VÉRIFICATIONS EN ÉCHEC :', echecs);
serveur.close(); ws.close(); proc.kill(); process.exit(echecs ? 1 : 0);
