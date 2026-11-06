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

// ===== Graphique de poids : courbe lissée sans dépassement, dégradé, tracé animé, info-bulle, périodes, axes discrets =====
let echecs = 0;
const verifier = (condition, texteLog) => { if (!condition) echecs++; log(`  ${texteLog} = ${condition}`); };
const importer = (texte) => ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(texte)}))`);
const auj = new Date();
const iso = (d) => { const x = new Date(auj); x.setDate(x.getDate() + d); const p = (v) => String(v).padStart(2, '0'); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`; };
const pes = (id, animalId, jours, kg) => ({ id, animalId, date: iso(jours), poidsKg: kg });
const animaux = [{ id: 'a', nom: 'Pomme', espece: 'cheval', especeAutre: '', race: '', naissance: '', photo: '', couleur: 'magenta' }, { id: 'z', nom: 'Zigzag', espece: 'chat', especeAutre: '', race: '', naissance: '', photo: '' }];
const jeu = (pesees) => JSON.stringify({ version: 1, exemplesAjoutes: true, animaux, soins: [], pesees });
const PESEES_A = [pes('p1', 'a', -400, 480), pes('p2', 'a', -300, 495), pes('p3', 'a', -200, 490), pes('p4', 'a', -100, 505), pes('p5', 'a', -50, 510), pes('p6', 'a', -20, 508), pes('p7', 'a', -5, 515)];
const ZIGZAG = [pes('z1', 'z', -90, 10), pes('z2', 'z', -70, 30), pes('z3', 'z', -50, 12), pes('z4', 'z', -49, 12), pes('z5', 'z', -30, 40), pes('z6', 'z', -10, 5), pes('z7', 'z', -9, 5.5), pes('z8', 'z', -9, 7)];
const ouvrirPoids = async (id) => { await aller2('#/animaux/' + id); await ev(`document.querySelector('[data-onglet="poids"]').click()`); await sleep(700); };
const nbPoints = () => ev(`document.querySelectorAll('circle.ps-point').length`);
const pressees = () => ev(`[...document.querySelectorAll('[data-periode]')].map(b => b.textContent.trim() + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')).join(' | ')`);

await taille(1280, 900);
await importer(jeu([...PESEES_A, ...ZIGZAG]));
await ouvrirPoids('a');

log('=== COURBE ARRONDIE, COULEUR DE L ANIMAL, DÉGRADÉ ===');
const forme = await ev(`(() => { const l = document.querySelector('path.ps-ligne'); const a = document.querySelector('path.ps-aire'); const hauts = document.querySelector('.ps-degrade-haut'), bas = document.querySelector('.ps-degrade-bas');
  return { d: l.getAttribute('d'), aire: a.getAttribute('d'), fill: a.getAttribute('fill'), traitCouleur: getComputedStyle(l).stroke, hautCouleur: getComputedStyle(hauts).stopColor, hautOpacite: getComputedStyle(hauts).stopOpacity, basOpacite: getComputedStyle(bas).stopOpacity, defs: !!document.querySelector('#ps-degrade'), polyline: !!document.querySelector('.ps-graphique polyline') }; })()`);
verifier((forme.d.match(/C/g) ?? []).length === 6 && !forme.polyline, 'la courbe est faite de 6 arcs lissés pour 7 pesées (plus de segments droits)');
verifier(forme.traitCouleur === 'rgb(176, 51, 138)', `courbe dans la couleur de l'animal (magenta : ${forme.traitCouleur})`);
verifier(forme.defs && forme.fill === 'url(#ps-degrade)' && forme.aire.endsWith('Z') && forme.hautCouleur === 'rgb(176, 51, 138)' && Number(forme.hautOpacite) > 0.2 && Number(forme.basOpacite) === 0, `dégradé sous la courbe : de la couleur de l'animal (opacité ${forme.hautOpacite}) vers transparent (${forme.basOpacite})`);

log('=== LA COURBE NE DÉPASSE JAMAIS LES VALEURS MESURÉES ===');
const SONDE = (n) => `(() => { const l = document.querySelector('path.ps-ligne'); const L = l.getTotalLength(); const cys = [...document.querySelectorAll('circle.ps-point')].map(c => ({ x: +c.getAttribute('cx'), y: +c.getAttribute('cy') }));
  const mn = Math.min(...cys.map(c => c.y)), mx = Math.max(...cys.map(c => c.y)); let hors = 0, pire = 0; const echant = [];
  for (let i = 0; i <= ${n}; i++) { const p = l.getPointAtLength(L * i / ${n}); echant.push(p); if (p.y < mn - 0.5 || p.y > mx + 0.5) { hors++; pire = Math.max(pire, mn - p.y, p.y - mx); } }
  const passe = cys.every(c => echant.some(p => Math.hypot(p.x - c.x, p.y - c.y) < 1.5));
  return { hors, pire, passe, nan: l.getAttribute('d').includes('NaN') }; })()`;
const r1 = await ev(SONDE(600));
verifier(r1.hors === 0 && r1.passe && !r1.nan, `pesées régulières : courbe entre le plus bas et le plus haut (${r1.hors} échantillons dehors), passe par chaque point`);
await ouvrirPoids('z');
const r2 = await ev(SONDE(900));
verifier(r2.hors === 0 && r2.passe && !r2.nan, `pesées en dents de scie (10, 30, 12, 12, 40, 5, 5,5 et 7 kg ; deux le même jour) : aucun dépassement (${r2.hors} dehors, pire ${r2.pire.toFixed(2)} px), passe par chaque point, pas de NaN`);
verifier((await ev(`document.querySelector('path.ps-ligne').getAttribute('d')`)).includes('L'), 'deux pesées à 1 jour d\'écart ou le même jour : le trait droit de secours est utilisé sans erreur');

log('=== TRACÉ ANIMÉ À L OUVERTURE ===');
await ouvrirPoids('a'); // ré-ouvre : l'animation repart
await aller2('#/animaux/a'); await ev(`document.querySelector('[data-onglet="poids"]').click()`); await sleep(160);
const anim = await ev(`(() => { const l = document.querySelector('path.ps-ligne'); const s = getComputedStyle(l); return { nom: s.animationName, dur: s.animationDuration, dash: s.strokeDasharray, offset: parseFloat(s.strokeDashoffset), pathLength: l.getAttribute('pathLength') }; })()`);
verifier(anim.nom === 'ps-trace' && anim.pathLength === '1' && anim.offset > 0.02, `la courbe se dessine (animation ${anim.nom} de ${anim.dur}, reste ${anim.offset.toFixed(2)} à tracer 160 ms après l'ouverture)`);
await sleep(1800);
verifier(await ev(`parseFloat(getComputedStyle(document.querySelector('path.ps-ligne')).strokeDashoffset)`) === 0 && await ev(`getComputedStyle(document.querySelector('circle.ps-point')).opacity`) === '1', 'une fois tracée : courbe complète et points visibles');

log('=== INFO-BULLE : date et poids, au survol et au toucher ===');
const cible = async (i) => ev(`(() => { const c = document.querySelectorAll('.ps-cible')[${i}]; c.scrollIntoView({ block: 'center' }); const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, cx: c.getAttribute('cx') }; })()`);
const c3 = await cible(3);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c3.x, y: c3.y }); await sleep(300);
const bulle = await ev(`(() => { const b = document.querySelector('.ps-infobulle'); const g = document.querySelector('.ps-graph').getBoundingClientRect(); const r = b.getBoundingClientRect(); return { texte: b.textContent, visible: !b.hidden && r.width > 0, dedans: r.left >= g.left - 0.5 && r.right <= g.right + 0.5, repere: document.querySelector('.ps-repere').classList.contains('est-visible'), x1: document.querySelector('.ps-repere').getAttribute('x1'), actif: document.querySelectorAll('.ps-point--actif').length }; })()`);
verifier(bulle.visible && /^\d{1,2} \S+\.? \d{4} · 505 kg$/.test(bulle.texte) && bulle.dedans, `survol : info-bulle « ${bulle.texte} » (date et poids), dans la carte`);
verifier(bulle.repere && bulle.x1 === c3.cx && bulle.actif === 1, 'survol : trait vertical sur la pesée et point mis en valeur');
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 }); await sleep(250);
verifier(await ev(`document.querySelector('.ps-infobulle').hidden && !document.querySelector('.ps-repere').classList.contains('est-visible')`), 'la souris part : info-bulle et trait disparaissent');
await taille(390, 844); await sleep(700);
const t0 = await cible(0);
await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: t0.x, y: t0.y }] }); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(300);
verifier(await ev(`(() => { const b = document.querySelector('.ps-infobulle'); return !b.hidden && /· 480 kg$/.test(b.textContent) })()`), 'toucher (téléphone) : info-bulle avec la date et 480 kg');
await taille(1280, 900); await sleep(700);

log('=== PÉRIODES : 3 mois, 6 mois, 1 an, Tout ===');
await ouvrirPoids('a');
verifier(await pressees() === '3 mois | 6 mois | 1 an | Tout*' && await nbPoints() === 7, `quatre boutons, « Tout » choisi au départ, 7 points (${await pressees()})`);
const parPeriode = {};
for (const [id, attendu] of [['1a', 6], ['6m', 4], ['3m', 3], ['tout', 7]]) {
  await ev(`document.querySelector('[data-periode="${id}"]').click()`); await sleep(350);
  parPeriode[id] = await nbPoints();
  verifier(parPeriode[id] === attendu && (await pressees()).split(' | ').filter((x) => x.endsWith('*')).length === 1, `période « ${id} » : ${parPeriode[id]} points (attendu ${attendu}), un seul bouton choisi`);
}
await ev(`document.querySelector('[data-periode="3m"]').click()`); await sleep(350);
verifier(/3 mois/.test(await ev(`document.querySelector('.ps-graphique').getAttribute('aria-label')`)) && /3 pesées/.test(await ev(`document.querySelector('.ps-graphique').getAttribute('aria-label')`)), 'la description du graphique (lecteurs d\'écran) cite la période et le nombre de pesées');
verifier(/3 pesées, 3 mois/.test(await ev(`document.querySelector('[data-etat]').textContent`)), `changement annoncé aux lecteurs d'écran (« ${await ev(`document.querySelector('[data-etat]').textContent`)} »)`);
verifier(await ev(`document.querySelectorAll('.ps-carte').length`) === 7, 'la liste des pesées reste complète (la période ne change que le graphique)');
const dates = await ev(`[...document.querySelectorAll('.ps-graphique text')].filter(t => t.getAttribute('text-anchor') === 'start' || /\\d{4}$/.test(t.textContent)).map(t => t.textContent)`);
verifier(dates.length === 2 && dates[0] !== dates[1], `axe du bas : début et fin de la période (${dates.join(' → ')})`);
// choix conservé après l'ajout d'une pesée
await ev(`(()=>{const f=document.querySelector('.ps-form');f.date.value=${JSON.stringify(iso(0))};f.poids.value='520';f.poids.dispatchEvent(new Event('input',{bubbles:true}));f.requestSubmit();})()`); await sleep(900);
verifier(await pressees() === '3 mois* | 6 mois | 1 an | Tout' && await nbPoints() === 4, `après l'ajout d'une pesée : la période « 3 mois » est gardée, 4 points (${await pressees()})`);
// période presque vide
await importer(jeu([pes('q1', 'a', -400, 480), pes('q2', 'a', -300, 495), pes('q3', 'a', -200, 490), pes('q4', 'a', -100, 505), pes('q5', 'a', -5, 515)]));
await ouvrirPoids('a');
verifier(await pressees() === '3 mois* | 6 mois | 1 an | Tout' && await ev(`!document.querySelector('.ps-graphique') && !!document.querySelector('.ps-note--periode')`), 'moins de 2 pesées sur la période : message clair à la place de la courbe, les boutons restent');
await axe('.ps', 'graphique : période presque vide');
await ev(`document.querySelector('[data-periode="tout"]').click()`); await sleep(350);
verifier(await nbPoints() === 5 && await ev(`!document.querySelector('.ps-note--periode')`), '« Tout » : la courbe revient');
await ev(`document.querySelector('[data-periode="tout"]').click()`);

log('=== AXES DISCRETS, GRAPHIQUE MOINS HAUT, DESSIN À LA TAILLE RÉELLE ===');
await importer(jeu(PESEES_A));
const mesure = () => ev(`(() => { const s = document.querySelector('.ps-graphique'); const r = s.getBoundingClientRect(); const vb = s.viewBox.baseVal; const t = document.querySelector('.ps-texte'); return { h: r.height, echelle: r.width / vb.width, police: parseFloat(getComputedStyle(t).fontSize), effective: parseFloat(getComputedStyle(t).fontSize) * r.width / vb.width, enfants: s.querySelectorAll('text').length }; })()`);
for (const [nom, w, h, hmax] of [['ordinateur', 1280, 900, 185], ['mobile', 390, 844, 160]]) {
  await taille(w, h); await ouvrirPoids('a'); await sleep(400);
  const m = await mesure();
  verifier(m.h <= hmax && m.h >= 120, `${nom} : graphique de ${Math.round(m.h)} px de haut (au plus ${hmax} ; il en faisait plus de 400 sur ordinateur avant)`);
  verifier(m.echelle > 0.97 && m.echelle < 1.03 && m.effective <= 11, `${nom} : dessiné à l'échelle 1:1 (${m.echelle.toFixed(2)}), chiffres des axes de ${m.effective.toFixed(1)} px (11 maximum, et lisibles)`);
}
// rotation / redimensionnement : le graphique est redessiné à la nouvelle largeur
await taille(1280, 900); await ouvrirPoids('a'); await sleep(300);
const L1 = await ev(`document.querySelector('.ps-graphique').viewBox.baseVal.width`);
await taille(390, 844); await sleep(800);
const L2 = await ev(`document.querySelector('.ps-graphique').viewBox.baseVal.width`);
const e2 = await mesure();
verifier(L2 < L1 - 400 && e2.echelle > 0.97 && e2.echelle < 1.03, `redimensionnement : redessiné (largeur ${Math.round(L1)} -> ${Math.round(L2)}), toujours à l'échelle 1:1`);
verifier(await sansDebord(), 'téléphone : sans défilement horizontal');
await axe('.ps', 'graphique sur téléphone');
await taille(1280, 900); await sleep(700);
await axe('.ps', 'graphique sur ordinateur');
const lignesEtTextes = await ev(`(() => { const g = [...document.querySelectorAll('.ps-grille')].map(l => { const r = l.getBoundingClientRect(); return r.top + r.height / 2; }); const t = [...document.querySelectorAll('.ps-graphique text[text-anchor="end"]')].filter(x => /^[\\d\\s,.]+$/.test(x.textContent.trim())).map(x => { const r = x.getBoundingClientRect(); return r.top + r.height / 2; }); return { n: g.length, ecart: Math.max(...g.map((y, i) => Math.abs(y - t[i]))) }; })()`);
verifier(lignesEtTextes.n >= 3 && lignesEtTextes.ecart <= 3, `chaque chiffre de l'axe reste centré sur sa ligne (${lignesEtTextes.n} graduations, écart max ${lignesEtTextes.ecart.toFixed(1)} px)`);

log('=== « RÉDUIRE LES ANIMATIONS » ===');
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await ouvrirPoids('a'); await sleep(200);
const fixe = await ev(`(() => { const g = (s) => getComputedStyle(document.querySelector(s)); return { ligne: g('path.ps-ligne').animationName, aire: g('path.ps-aire').animationName, point: g('circle.ps-point').animationName, offset: parseFloat(g('path.ps-ligne').strokeDashoffset), opacite: g('circle.ps-point').opacity }; })()`);
verifier(fixe.ligne === 'none' && fixe.aire === 'none' && fixe.point === 'none' && fixe.offset === 0 && fixe.opacite === '1', 'courbe, dégradé et points affichés tout de suite, sans animation');
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

log('=== DONNÉES ET ROBUSTESSE ===');
await importer(jeu([pes('b1', 'a', -10, 500), pes('b2', 'a', -10, 500)])); await ouvrirPoids('a');
verifier(await ev(`!!document.querySelector('.ps-graphique') && !document.querySelector('.ps-graphique').outerHTML.includes('NaN')`), 'deux pesées identiques le même jour : graphique sans NaN');
await importer(jeu([pes('c1', 'a', -9, 3.9), pes('c2', 'a', -5, 1200)])); await ouvrirPoids('a');
verifier(await ev(`!document.querySelector('.ps-graphique').outerHTML.includes('NaN')`) && (await ev(SONDE(300))).hors === 0, 'très grande amplitude (3,9 à 1200 kg) : pas de NaN, pas de dépassement');
await importer(jeu(Array.from({ length: 80 }, (_, i) => pes('m' + i, 'a', -330 + i * 4, Math.round((20 + Math.sin(i / 6) * 3) * 10) / 10)))); await ouvrirPoids('a');
const r3 = await ev(SONDE(1200));
verifier(r3.hors === 0 && !r3.nan, `80 pesées : courbe sans dépassement (${r3.hors} dehors), sans NaN`);
const exp = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
await ev(`import('/js/storage.js').then(m=>m.toutEffacer())`); await importer(exp);
const exp2 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
const net = (t) => { const o = JSON.parse(t); delete o.exporteLe; return JSON.stringify(o); };
log('export -> effacer -> import -> export identique :', net(exp) === net(exp2));
log('ERREURS CONSOLE :', erreurs.length ? erreurs : 'aucune');
log('VÉRIFICATIONS EN ÉCHEC :', echecs);
ws.close(); proc.kill(); process.exit(echecs ? 1 : 0);
