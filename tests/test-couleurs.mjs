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

// ===== Couleurs : une par type de soin, une par animal (modifiable) ; urgence = rouge / ambre / vert uniquement =====
let echecs = 0;
const verifier = (condition, texteLog) => { if (!condition) echecs++; log(`  ${texteLog} = ${condition}`); };
const importer = (texte) => ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(texte)}))`);
const brut = () => ev(`localStorage.getItem('carnetpatte.v1')`);
const auj = new Date();
const iso = (d) => { const x = new Date(auj); x.setDate(x.getDate() + d); const p = (v) => String(v).padStart(2, '0'); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`; };
const soin = (id, type, titre, rappel = '') => ({ id, animalId: 'a', type, titre, date: iso(-30), notes: '', rappel, rappelFait: false });
const jeu = (extra = {}) => JSON.stringify({ version: 1, exemplesAjoutes: true,
  animaux: [{ id: 'a', nom: 'Pomme', espece: 'cheval', especeAutre: '', race: '', naissance: '', photo: '', ...extra }, { id: 'b', nom: 'Bob', espece: 'chat', especeAutre: '', race: '', naissance: '', photo: '' }],
  soins: [soin('s1', 'vaccin', 'Grippe', iso(-3)), soin('s2', 'vermifuge', '', iso(4)), soin('s3', 'antiparasitaire', 'Pipette', iso(60)), soin('s4', 'veto', 'Dents'), soin('s5', 'autre', 'Parage'), soin('s6', 'inconnu-futur', 'Type inventé')],
  pesees: [{ id: 'p1', animalId: 'a', date: iso(-90), poidsKg: 500 }, { id: 'p2', animalId: 'a', date: iso(-30), poidsKg: 510 }, { id: 'p3', animalId: 'a', date: iso(-5), poidsKg: 508 }] });
// contraste WCAG calculé dans la page, à partir des couleurs réellement appliquées
const OUTIL = `window.__c = (css) => { const m = css.match(/[\\d.]+/g).map(Number); return m.slice(0, 3); };
  window.__lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  window.__ratio = (a, b) => { const x = window.__lum(window.__c(a)), y = window.__lum(window.__c(b)); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };`;

await taille(1280, 900);
await importer(jeu());
await aller2('#/animaux/a'); await ev(OUTIL);

log('=== COULEUR PAR TYPE DE SOIN ===');
const tuiles = await ev(`[...document.querySelectorAll('#zone-soins .sn-carte')].map(c => { const i = getComputedStyle(c.querySelector('.sn-carte__icone')); return { nom: c.querySelector('.sn-carte__nom').textContent, fond: i.backgroundColor, texte: i.color, ratio: window.__ratio(i.color, i.backgroundColor) }; })`);
const parNom = Object.fromEntries(tuiles.map((t) => [t.nom, t]));
const cinq = ['Grippe', 'Vermifuge', 'Pipette', 'Dents', 'Parage'].map((n) => parNom[n]);
verifier(cinq.every(Boolean) && new Set(cinq.map((t) => t.fond)).size === 5, 'vaccin, vermifuge, antiparasitaire, visite véto et autre ont 5 fonds différents');
verifier(parNom['Type inventé'].fond === parNom['Parage'].fond, 'un type inconnu (futur) prend la couleur « autre » (gris)');
verifier(tuiles.every((t) => t.ratio >= 4.5), `icône/texte sur fond >= 4,5:1 pour tous les types (minimum ${Math.min(...tuiles.map((t) => t.ratio)).toFixed(2)})`);
const teinte = (t) => { const [r, g, b] = t.fond.match(/\d+/g).map(Number); return { r, g, b }; };
const [bleu, vert, orange, violet, gris] = cinq.map(teinte);
verifier(bleu.b > bleu.r && bleu.b > bleu.g, 'vaccin : dominante bleue');
verifier(vert.g > vert.r && vert.g >= vert.b - 12, 'vermifuge : dominante verte');
verifier(orange.r > orange.g && orange.g > orange.b, 'antiparasitaire : dominante orange');
verifier(violet.r > violet.g && violet.b > violet.g, 'visite véto : dominante violette');
verifier(Math.max(gris.r, gris.g, gris.b) - Math.min(gris.r, gris.g, gris.b) < 15, 'autre : gris');
const urgences = await ev(`[...new Set([...document.querySelectorAll('.cp-badge--alerte, .cp-badge--attention, .cp-badge--succes')].map(b => getComputedStyle(b).backgroundColor))]`);
verifier(urgences.length > 0 && tuiles.every((t) => !urgences.includes(t.fond)), `les fonds des types ne reprennent aucune couleur d'urgence des badges (${urgences.length} couleurs d'urgence présentes)`);
const badgesType = await ev(`[...document.querySelectorAll('#zone-soins [class*="cp-type--"] .cp-badge')].every(b => /cp-badge--(alerte|attention|succes|info)|^cp-badge$/.test(b.className.trim()))`);
verifier(badgesType, 'les badges d\'échéance gardent leurs couleurs d\'urgence (pas celles du type)');

log('=== LA MÊME COULEUR PARTOUT ===');
const vaccinFiche = tuiles.find((t) => t.nom === 'Grippe').fond;
await ev(`document.querySelector('[data-onglet=historique]').click()`); await sleep(300);
verifier(await ev(`[...document.querySelectorAll('.fi-histo__ligne.cp-type--vaccin .fi-histo__icone')].length > 0 && [...document.querySelectorAll('.fi-histo__ligne.cp-type--vaccin .fi-histo__icone')].every(i => getComputedStyle(i).backgroundColor === ${JSON.stringify(vaccinFiche)})`), 'historique : l\'icône du vaccin a la même couleur que dans la liste des soins');
await aller2('#/animaux/rappels');
verifier(await ev(`[...document.querySelectorAll('.rp-carte.cp-type--vaccin .rp-carte__icone')].length > 0 && [...document.querySelectorAll('.rp-carte.cp-type--vaccin .rp-carte__icone')].every(i => getComputedStyle(i).backgroundColor === ${JSON.stringify(vaccinFiche)})`), 'page Rappels : même couleur pour le vaccin');
await aller2('#/accueil');
verifier(await ev(`[...document.querySelectorAll('.cp-liste__icone.cp-type--vaccin')].length > 0 && [...document.querySelectorAll('.cp-liste__icone.cp-type--vaccin')].every(i => getComputedStyle(i).backgroundColor === ${JSON.stringify(vaccinFiche)})`), 'Accueil : même couleur pour le vaccin');
await aller2('#/animaux/a');
await ev(`document.querySelector('#zone-soins [data-act=fait]').click()`); await sleep(500);
verifier(await ev(`getComputedStyle(document.querySelector('.rf-resume__icone')).backgroundColor !== 'rgba(0, 0, 0, 0)' && document.querySelector('.rf-resume__icone').className.includes('cp-type--')`), 'fenêtre « Fait » : l\'icône reprend la couleur du type');
await axe('dialog', 'fenêtre « Fait »');
await ev(`document.querySelector('dialog [data-fermer]').click()`); await sleep(300);

log('=== COULEUR PAR ANIMAL ===');
const cl = (sel) => ev(`(document.querySelector(${JSON.stringify(sel)})?.className.match(/cp-an-[a-z]+/) ?? [null])[0]`);
await aller2('#/animaux');
const auto = await ev(`[...document.querySelectorAll('[data-grille] a')].map(a => a.querySelector('.cp-carte-animal__nom').textContent + ':' + (a.querySelector('.cp-avatar').className.match(/cp-an-[a-z]+/) ?? [''])[0])`);
log('  couleurs automatiques :', auto.join(' | '));
verifier(auto.length === 2 && auto[0].split(':')[1] !== auto[1].split(':')[1], 'deux animaux, deux couleurs automatiques différentes');
await send('Page.reload'); await sleep(1500); await ev(axeSrc); await ev(OUTIL);
verifier(JSON.stringify(await ev(`[...document.querySelectorAll('[data-grille] a')].map(a => a.querySelector('.cp-carte-animal__nom').textContent + ':' + (a.querySelector('.cp-avatar').className.match(/cp-an-[a-z]+/) ?? [''])[0])`)) === JSON.stringify(auto), 'après rechargement : mêmes couleurs automatiques (stables)');
const avantChoix = await brut();
await aller2('#/animaux/a');
await ev(`document.querySelector('[data-act=modifier]').click()`); await sleep(500);
const options = await ev(`[...document.querySelectorAll('dialog .cp-choix--couleurs .cp-choix__option')].map(l => l.textContent.trim())`);
verifier(options.length === 9 && options[0] === 'Automatique' && options.includes('Bleu ardoise') && options.includes('Gris-bleu'), `formulaire : « Automatique » + 8 couleurs, chacune avec son nom écrit (${options.join(', ')})`);
verifier(await ev(`document.querySelector('dialog input[name=couleur]:checked').value`) === '', 'sans choix enregistré : « Automatique » coché');
await axe('dialog', 'formulaire animal avec choix de couleur');
await ev(`(()=>{ const r = document.querySelector('dialog input[name=couleur][value=magenta]'); r.click(); })()`); await sleep(200);
verifier(await ev(`document.querySelector('dialog [data-apercu] .cp-avatar').className.includes('cp-an-magenta')`), 'l\'aperçu de l\'avatar change tout de suite');
await ev(`document.querySelector('dialog form').requestSubmit()`); await sleep(600);
verifier((await ev(`JSON.parse(localStorage.getItem('carnetpatte.v1')).animaux.find(a => a.id === 'a').couleur`)) === 'magenta', 'couleur « magenta » enregistrée dans l\'animal');
verifier(await cl('.fi-avatar') === 'cp-an-magenta' && await cl('.fi-page') === 'cp-an-magenta', 'avatar de la fiche et fiche (donc graphique) en magenta');
await ev(`document.querySelector('[data-onglet=poids]').click()`); await sleep(500);
verifier(await ev(`getComputedStyle(document.querySelector('.ps-ligne')).stroke`) === 'rgb(176, 51, 138)' && await ev(`getComputedStyle(document.querySelector('.ps-point')).stroke`) === 'rgb(176, 51, 138)', 'graphique : courbe et points dans la couleur de l\'animal');
await aller2('#/animaux');
verifier(await ev(`[...document.querySelectorAll('[data-grille] a')].find(a => a.textContent.includes('Pomme')).querySelector('.cp-avatar').className.includes('cp-an-magenta')`), 'liste des animaux : avatar en magenta');
await aller2('#/accueil');
verifier(await ev(`[...document.querySelectorAll('section[aria-labelledby=ac-animaux] a')].find(a => a.textContent.includes('Pomme')).querySelector('.cp-avatar').className.includes('cp-an-magenta')`), 'Accueil : avatar en magenta');
await aller2('#/animaux/rappels');
verifier(await ev(`[...document.querySelectorAll('.rp-animal')].filter(a => a.textContent.includes('Pomme')).every(a => a.querySelector('.cp-avatar').className.includes('cp-an-magenta'))`), 'Rappels : avatar en magenta');
// retour à « Automatique »
await aller2('#/animaux/a');
await ev(`document.querySelector('[data-act=modifier]').click()`); await sleep(500);
verifier(await ev(`document.querySelector('dialog input[name=couleur]:checked').value`) === 'magenta', 'rouvrir le formulaire : le choix enregistré est coché');
await ev(`document.querySelector('dialog input[name=couleur][value=""]').click(); document.querySelector('dialog form').requestSubmit()`); await sleep(600);
verifier((await ev(`JSON.parse(localStorage.getItem('carnetpatte.v1')).animaux.find(a => a.id === 'a').couleur`)) === '' && await cl('.fi-avatar') === auto.find((x) => x.startsWith('Pomme')).split(':')[1], '« Automatique » : champ vidé, la couleur automatique revient');

log('=== CLIC SUR L AVATAR : choix de la couleur ===');
await importer(jeu());
await aller2('#/animaux/a');
verifier(await ev(`document.querySelector('.fi-avatar-bouton')?.getAttribute('aria-label')`) === 'Changer la couleur de Pomme', 'l\'avatar de la fiche est un bouton « Changer la couleur de Pomme »');
await ev(`document.querySelector('.fi-avatar-bouton').click()`); await sleep(500);
const boutonsCouleur = await ev(`[...document.querySelectorAll('dialog [data-couleur]')].map(b => b.textContent.trim() + (b.getAttribute('aria-pressed') === 'true' ? '*' : ''))`);
verifier(boutonsCouleur.length === 9 && boutonsCouleur[0] === 'Automatique*', `fenêtre : « Automatique » (actuel) + 8 couleurs nommées (${boutonsCouleur.join(', ')})`);
await axe('dialog', 'fenêtre de choix de la couleur');
await ev(`document.querySelector('dialog [data-couleur=turquoise]').click()`); await sleep(600);
verifier((await ev(`JSON.parse(localStorage.getItem('carnetpatte.v1')).animaux.find(a => a.id === 'a').couleur`)) === 'turquoise' && await ev(`!document.querySelector('dialog')`), 'un clic enregistre la couleur et ferme la fenêtre');
verifier(await cl('.fi-avatar') === 'cp-an-turquoise', 'l\'avatar de la fiche est aussitôt turquoise');
await ev(`document.querySelector('.fi-avatar-bouton').click()`); await sleep(500);
verifier(await ev(`document.querySelector('dialog [aria-pressed=true]').dataset.couleur`) === 'turquoise', 'rouvrir : la couleur actuelle est marquée');
await ev(`document.querySelector('dialog [data-couleur=""]').click()`); await sleep(600);
verifier((await ev(`JSON.parse(localStorage.getItem('carnetpatte.v1')).animaux.find(a => a.id === 'a').couleur`)) === '', '« Automatique » vide le champ');
await taille(390, 844); await aller2('#/animaux/a');
verifier(await ev(`(()=>{const r=document.querySelector('.fi-avatar-bouton').getBoundingClientRect();return r.width>=44 && r.height>=44})()`) && await sansDebord(), 'mobile : le bouton avatar fait au moins 44 px, sans défilement horizontal');
await taille(1280, 900);

log('=== LES 8 COULEURS : contrastes ===');
const palette = await ev(`(() => { const r = []; for (const k of ['ardoise','turquoise','indigo','magenta','brun','rose','olive','gris']) { const e = document.createElement('span'); e.className = 'cp-avatar cp-an-' + k; document.body.append(e); const s = getComputedStyle(e); const initiales = window.__ratio(s.color, s.backgroundColor); e.style.color = getComputedStyle(document.documentElement).getPropertyValue('--cp-an-' + k + '-trait').trim(); r.push({ k, initiales, trait: window.__ratio(getComputedStyle(e).color, 'rgb(255,255,255)') }); e.remove(); } return r; })()`);
verifier(palette.length === 8 && palette.every((p) => p.initiales >= 4.5), `initiales sur fond >= 4,5:1 (minimum ${Math.min(...palette.map((p) => p.initiales)).toFixed(2)})`);
verifier(palette.every((p) => p.trait >= 3), `trait du graphique sur blanc >= 3:1 (minimum ${Math.min(...palette.map((p) => p.trait)).toFixed(2)})`);

log('=== DONNÉES : champ facultatif ===');
await importer(jeu({ couleur: 'rouge-vif' }));
const brutInvalide = await brut();
await aller2('#/animaux/a');
verifier(/cp-an-[a-z]+/.test(await cl('.fi-avatar')) && !(await cl('.fi-avatar')).includes('rouge'), 'couleur invalide dans les données : ignorée, couleur automatique');
verifier(await brut() === brutInvalide, 'et les données ne sont pas modifiées pour autant');
await importer(jeu({ couleur: 42 }));
await aller2('#/animaux/a'); verifier(/cp-an-[a-z]+/.test(await cl('.fi-avatar')), 'couleur de type nombre : ignorée');
const ancien = JSON.parse(jeu()); delete ancien.animaux[0].couleur; delete ancien.animaux[1].couleur;
await importer(JSON.stringify(ancien));
await aller2('#/animaux/a'); verifier(/cp-an-[a-z]+/.test(await cl('.fi-avatar')), 'ancien export sans champ « couleur » : importé, couleur automatique');
await importer(jeu({ couleur: 'turquoise' }));
const exp = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
await ev(`import('/js/storage.js').then(m=>m.toutEffacer())`);
await importer(exp);
verifier((await ev(`JSON.parse(localStorage.getItem('carnetpatte.v1')).animaux[0].couleur`)) === 'turquoise', 'export puis import : la couleur choisie est conservée');
const net = (t) => { const o = JSON.parse(t); delete o.exporteLe; return JSON.stringify(o); };
const exp2 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
log('export -> effacer -> import -> export identique :', net(exp) === net(exp2));

log('=== ACCESSIBILITÉ ===');
for (const [h, nom] of [['#/animaux/a', 'fiche (Santé)'], ['#/animaux/rappels', 'Rappels'], ['#/accueil', 'Accueil'], ['#/animaux', 'Mes animaux']]) {
  await taille(1280, 900); await aller2(h); await axe('#contenu', `${nom} avec les couleurs`);
}
await taille(390, 844); await aller2('#/animaux/a'); await axe('#contenu', 'fiche mobile avec les couleurs');
verifier(await sansDebord(), 'mobile : sans défilement horizontal');

log('ERREURS CONSOLE :', erreurs.length ? erreurs : 'aucune');
log('VÉRIFICATIONS EN ÉCHEC :', echecs);
ws.close(); proc.kill(); process.exit(echecs ? 1 : 0);
