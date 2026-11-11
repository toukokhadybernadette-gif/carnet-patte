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

// ===== Effet verre : structure, lisibilité mesurée sur captures, mouvement, « réduire les animations », protection de fluidité =====
let echecs = 0;
const verifier = (condition, texteLog) => { if (!condition) echecs++; log(`  ${texteLog} = ${condition}`); };
const importer = (texte) => ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(texte)}))`);
const auj = new Date();
const iso = (d) => { const x = new Date(auj); x.setDate(x.getDate() + d); const p = (v) => String(v).padStart(2, '0'); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`; };
const jeu = JSON.stringify({ version: 1, exemplesAjoutes: true,
  animaux: [{ id: 'a', nom: 'Pomme', espece: 'cheval', especeAutre: '', race: 'Comtois', naissance: '2019-04-02', photo: '' }, { id: 'b', nom: 'Bob', espece: 'chat', especeAutre: '', race: '', naissance: '', photo: '' }],
  soins: [{ id: 's1', animalId: 'a', type: 'vaccin', titre: 'Grippe', date: iso(-300), notes: 'RAS', rappel: iso(-3), rappelFait: false }, { id: 's2', animalId: 'a', type: 'vermifuge', titre: '', date: iso(-60), notes: '', rappel: iso(4), rappelFait: false }, { id: 's3', animalId: 'b', type: 'veto', titre: 'Dents', date: iso(-20), notes: '', rappel: iso(80), rappelFait: false }],
  pesees: [{ id: 'p1', animalId: 'a', date: iso(-90), poidsKg: 500 }, { id: 'p2', animalId: 'a', date: iso(-30), poidsKg: 510 }, { id: 'p3', animalId: 'a', date: iso(-5), poidsKg: 508 }] });
const style = (sel, prop) => ev(`getComputedStyle(document.querySelector(${JSON.stringify(sel)}))[${JSON.stringify(prop)}]`);
const flou = (v) => /blur\(/.test(v ?? '');

await taille(1280, 900);
await importer(jeu);
await aller2('#/accueil'); await sleep(800);

log('=== STRUCTURE DU VERRE ===');
verifier(await ev(`(()=>{const f=document.querySelector('.app-fond');return !!f && f.getAttribute('aria-hidden')==='true' && f.querySelectorAll('span').length===3 && getComputedStyle(f).pointerEvents==='none' && getComputedStyle(f).position==='fixed'})()`), 'décor : 3 bulles (pêche, bleu, lilas), caché aux lecteurs d\'écran, sans effet sur les clics');
verifier(flou(await style('.app-haut', 'backdropFilter')) && flou(await style('.app-lateral', 'backdropFilter')), 'barre du haut et menu latéral : flou');
verifier(flou(await style('.cp-liste', 'backdropFilter')) && flou(await style('.cp-liste', 'backdropFilter')), 'cartes et listes : flou');
const alpha = (c) => parseFloat((c ?? '').match(/rgba\([^)]*,\s*([\d.]+)\)/)?.[1] ?? '1');
const fond = await style('.cp-liste', 'backgroundColor');
verifier(alpha(fond) >= 0.3 && alpha(fond) <= 0.55, `cartes nettement transparentes : blanc à ${Math.round(alpha(fond) * 100)} % (${fond})`);
const px = (v) => parseFloat((v ?? '').match(/blur\((\d+(?:\.\d+)?)px/)?.[1] ?? '0');
verifier(px(await style('.cp-liste', 'backdropFilter')) >= 24 && px(await style('.app-lateral', 'backdropFilter')) >= 24, `flou fort sur les cartes (${px(await style('.cp-liste', 'backdropFilter'))} px) et le menu (${px(await style('.app-lateral', 'backdropFilter'))} px)`);
verifier(alpha(await style('.cp-liste', 'borderTopColor')) >= 0.8 && (await style('.cp-liste', 'borderTopColor')).startsWith('rgba(255, 253, 250') && parseFloat(await style('.cp-liste', 'borderTopLeftRadius')) >= 16, 'bordure claire bien visible et coins arrondis (16 px ou plus)');
verifier(!/inset 0px 0px 0px 0px/.test(await style('.cp-liste', 'boxShadow')) && (await style('.cp-liste', 'boxShadow')) !== 'none', 'ombre douce');
await aller2('#/animaux/rappels'); await sleep(800);
verifier(!flou(await style('.rp-carte', 'backdropFilter')) && flou(await style('.rp-liste', 'backdropFilter')), 'pas de flou imbriqué : les lignes de rappel n\'ont pas de flou propre, c\'est la liste qui est en verre');
await aller2('#/animaux/a'); await sleep(800);
verifier(flou(await style('.fi-entete', 'backdropFilter')) && (await style('.fi-entete', 'boxShadow')).includes('inset'), 'fiche : en-tête en verre, avec son filet de couleur d\'animal conservé');
await ev(`document.querySelector('[data-act=modifier]').click()`); await sleep(600);
verifier(flou(await style('dialog', 'backdropFilter')) && alpha(await style('dialog', 'backgroundColor')) >= 0.6 && alpha(await style('dialog', 'backgroundColor')) <= 0.85, 'fenêtre : verre dépoli semi-transparent (un peu plus opaque que les cartes : on y tape du texte)');
verifier(flou(await ev(`getComputedStyle(document.querySelector('dialog'), '::backdrop').backdropFilter`)), 'arrière-plan de la fenêtre flouté');
await axe('dialog', 'fenêtre en verre');
await ev(`document.querySelector('dialog [data-fermer]').click()`); await sleep(300);
await taille(390, 844); await aller2('#/accueil'); await sleep(800);
verifier(flou(await style('.app-nav-bas', 'backdropFilter')) && flou(await style('.app-haut', 'backdropFilter')), 'téléphone : barre du bas et barre du haut en verre');
await aller2('#/animaux'); await sleep(600);
verifier(!flou(await style('.cp-carte-animal', 'backdropFilter')), 'téléphone : pas de flou sur chaque carte d\'animal (économie)');
await aller2('#/accueil'); await sleep(600);
verifier(px(await style('.cp-liste', 'backdropFilter')) === 16, 'téléphone : flou réduit mais fort (16 px)');
await taille(1280, 900);
const regles = await ev(`(() => { let trouve = false; for (const f of document.styleSheets) { try { for (const r of f.cssRules) if (r instanceof CSSSupportsRule && r.conditionText.includes('backdrop-filter')) trouve = true; } catch {} } return trouve; })()`);
verifier(regles, 'repli prévu pour un navigateur sans backdrop-filter (fonds presque pleins)');

log('=== PASTILLES EN VERT SAUGE (urgence inchangée) ===');
const sable = (c) => { const m = (c ?? '').match(/[\d.]+/g)?.map(Number); return !!m && m[0] >= m[2] && m[1] > m[2] && m[0] > 200; }; // beige / sable clair, opaque ou non
const vert = (c) => { const m = (c ?? '').match(/[\d.]+/g)?.map(Number); return !!m && m[0] > m[2] && m[1] > m[2] && (m[3] ?? 1) < 0.7; }; // dominante kaki / sable (couleur unique), translucide
await aller2('#/animaux/rappels'); await sleep(900);
verifier(await ev(`[...document.querySelectorAll('.rp-statuts .cp-choix__option input:not(:checked) + span')].length === 3`) && sable(await ev(`getComputedStyle(document.querySelector('.rp-statuts .cp-choix__option input:not(:checked) + span')).backgroundColor`)), 'boutons de filtre (En retard, À venir, Effectués) : capsules nettes beiges');
verifier(await ev(`getComputedStyle(document.querySelector('.rp-statuts .cp-choix__option input:checked + span')).backgroundColor`) === 'rgb(91, 99, 52)' && await ev(`getComputedStyle(document.querySelector('.rp-statuts .cp-choix__option input:checked + span')).color`) === 'rgb(255, 255, 255)', 'bouton de filtre choisi (À faire) : rempli de kaki, texte blanc (il ressort nettement du verre kaki clair)');
verifier(vert(await ev(`getComputedStyle(document.querySelector('.rp-statuts input:not(:checked) + span .rp-nombre')).backgroundColor`)), 'compteurs dans les boutons de filtre non choisis : kaki clair');
verifier(await ev(`!!document.querySelector('.rp-groupe--semaine .rp-groupe__titre .cp-compteur')`) && vert(await ev(`getComputedStyle(document.querySelector('.rp-groupe--semaine .rp-groupe__titre .cp-compteur')).backgroundColor`)), 'compteur d\'un groupe « Cette semaine » : kaki clair');
// l'urgence garde ses couleurs d'avant
const rgb = (sel) => ev(`getComputedStyle(document.querySelector(${JSON.stringify(sel)})).backgroundColor`);
verifier(await rgb('.rp-groupe--retard .rp-groupe__titre .cp-compteur') === 'rgb(246, 227, 220)', 'compteur du groupe « En retard » : toujours rouge pâle');
verifier(await rgb('.cp-badge--alerte') === 'rgb(246, 227, 220)' && await rgb('.cp-badge--attention') === 'rgb(246, 232, 201)' && await rgb('.cp-badge--succes') === 'rgb(217, 240, 226)', 'badges d\'échéance : rouge pâle, ambre pâle inchangés, vert pâle plus franc (distinct du kaki)');
verifier(await rgb('.app-nav__compteur') === 'rgb(142, 61, 43)', 'pastille rouge des retards dans le menu : inchangée');
await aller2('#/animaux'); await sleep(900);
verifier(await ev(`document.querySelectorAll('.cp-filtre').length >= 2`) && sable(await ev(`getComputedStyle(document.querySelector('.cp-filtre')).backgroundColor`)), 'filtres par espèce (Mes animaux) : capsules nettes beiges');
await ev(`document.querySelector('.cp-filtre').click()`); await sleep(200);
verifier(await ev(`getComputedStyle(document.querySelector('.cp-filtre[aria-pressed="true"]')).backgroundColor`) === 'rgb(91, 99, 52)', 'filtre activé : rempli de kaki (état très lisible)');
await ev(`document.querySelector('.cp-filtre[aria-pressed="true"]').click()`); await sleep(100);
await aller2('#/accueil'); await sleep(500);
await ev(`document.querySelector('.app-bientot__titre').click()`); await sleep(150);
verifier(vert(await ev(`getComputedStyle(document.querySelector('.app-bientot__nombre')).backgroundColor`)), 'compteur de la section « Bientôt » du menu : kaki clair');
await ev(`document.querySelector('.app-bientot__titre').click()`);

log('=== LISIBILITÉ MESURÉE SUR CAPTURE (texte rendu transparent pour lire le vrai fond, bulles à 3 positions) ===');
const mesurer = async (nom) => {
  const phases = [0, 0.5, 1];
  let pire = { ratio: 99 }; let n = 0;
  for (const p of phases) {
    await ev(`document.querySelectorAll('.app-fond span').forEach((s) => { const d = parseFloat(getComputedStyle(s).animationDuration); s.style.animationPlayState = 'paused'; s.style.animationDelay = (-${p} * d) + 's'; })`); await sleep(200);
    const cibles = await ev(`(() => {
      const r = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let t = w.nextNode(); t; t = w.nextNode()) {
        if (!t.nodeValue.trim()) continue;
        const el = t.parentElement; const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[hidden], .cp-sr, dialog:not([open]), #toasts, .app-evitement')) continue;
        const range = document.createRange(); range.selectNodeContents(t); const b = range.getBoundingClientRect();
        if (b.width < 4 || b.height < 4 || b.top < 0 || b.left < 0 || b.bottom > innerHeight || b.right > innerWidth) continue;
        // seuls les points où CE texte est visible comptent : un texte qui passe sous la capsule flottante ou sous une fenêtre n'est pas lu à cet endroit
        const pts = [[0.5, 0.5], [0.15, 0.5], [0.85, 0.5], [0.5, 0.2], [0.5, 0.8]].filter(([fx, fy]) => { const d = document.elementFromPoint(b.left + b.width * fx, b.top + b.height * fy); return d && (el.contains(d) || d.contains(el)); });
        if (!pts.length) continue;
        r.push({ texte: t.nodeValue.trim().slice(0, 24), couleur: el instanceof SVGElement ? cs.fill : cs.color, x: b.left, y: b.top, w: b.width, h: b.height, pts });
      } return r; })()`);
    await ev(`(() => { const s = document.createElement('style'); s.id = 'sans-texte'; s.textContent = '*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; } svg { visibility: hidden !important; }'; document.head.append(s); })()`); await sleep(150);
    const cap = await send('Page.captureScreenshot', { format: 'png' });
    await ev(`document.getElementById('sans-texte').remove()`);
    const res = await ev(`(async () => {
      const img = new Image(); img.src = 'data:image/png;base64,${cap.result.data}'; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const lum = ([r, gg, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b); };
      const rat = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const cibles = ${JSON.stringify(cibles)}; let pire = { ratio: 99 };
      for (const t of cibles) {
        const txt = t.couleur.match(/[\\d.]+/g).map(Number).slice(0, 3);
        for (const [fx, fy] of t.pts) {
          const px = g.getImageData(Math.min(img.width - 1, Math.floor(t.x + t.w * fx)), Math.min(img.height - 1, Math.floor(t.y + t.h * fy)), 1, 1).data;
          const q = rat(txt, [px[0], px[1], px[2]]);
          if (q < pire.ratio) pire = { ratio: q, texte: t.texte, fond: [px[0], px[1], px[2]], couleur: t.couleur };
        }
      } return { n: cibles.length, pire }; })()`);
    n += res.n; if (res.pire.ratio < pire.ratio) pire = res.pire;
  }
  await ev(`document.querySelectorAll('.app-fond span').forEach((s) => { s.style.animationPlayState = ''; s.style.animationDelay = ''; })`);
  verifier(pire.ratio >= 4.5, `${nom} : ${n} mesures de texte, plus faible contraste ${pire.ratio.toFixed(2)}:1 (« ${pire.texte} », texte ${pire.couleur} sur fond rgb(${pire.fond})) — minimum exigé 4,5:1`);
};
for (const [h, nom, l, hh] of [['#/accueil', 'Accueil (ordinateur)', 1280, 900], ['#/animaux/rappels', 'Rappels (ordinateur)', 1280, 900], ['#/animaux/a', 'Fiche (ordinateur)', 1280, 900], ['#/animaux', 'Mes animaux (ordinateur)', 1280, 900], ['#/accueil', 'Accueil (téléphone)', 390, 844], ['#/animaux/rappels', 'Rappels (téléphone)', 390, 844], ['#/animaux/a', 'Fiche (téléphone)', 390, 844], ['#/animaux/a/poids', 'Poids avec le graphique (ordinateur)', 1280, 900], ['#/animaux/a/poids', 'Poids avec le graphique (téléphone)', 390, 844]]) {
  await taille(l, hh);
  if (h.endsWith('/poids')) { await aller2(h.replace('/poids', '')); await ev(`document.querySelector('[data-onglet="poids"]').click()`); await sleep(2300); } else { await aller2(h); await sleep(900); }
  await mesurer(nom);
}
await taille(1280, 900);

log('=== STYLE « CENTRE DE CONTRÔLE » (boutons ronds, capsules, barre flottante, groupes arrondis) ===');
const rgbaDe = (c) => (c ?? '').match(/[\d.]+/g)?.map(Number) ?? [];
await taille(390, 844); await aller2('#/accueil'); await sleep(900);
// actions rapides : grands cercles de verre gris-mauve translucide, reflet clair en haut, icônes blanches
const cercle = await ev(`(() => { const r = document.querySelector('.ac-action__rond'); const s = getComputedStyle(r); const b = r.getBoundingClientRect(); return { w: b.width, h: b.height, rayon: s.borderRadius, fond: s.backgroundColor, flou: s.backdropFilter, bord: s.borderTopColor, ombre: s.boxShadow, icone: getComputedStyle(r.querySelector('svg')).color }; })()`);
const fondCercle = rgbaDe(cercle.fond);
verifier(cercle.w === cercle.h && cercle.w >= 56 && cercle.rayon === '50%', `actions rapides : cercles de ${cercle.w} px`);
verifier(fondCercle[0] < 140 && fondCercle[1] > fondCercle[2] && fondCercle[1] >= fondCercle[0], `cercle kaki plein, pas blanc (${cercle.fond})`);
verifier(cercle.flou === 'none', `bord net : aucun flou sur le cercle (${cercle.flou})`);
verifier((rgbaDe(cercle.bord)[3] ?? 1) === 1 && /inset/.test(cercle.ombre) && !/ 0px 0px 0px [1-9]px/.test(cercle.ombre.replace(/inset[^,]*/g, '')) && !/ 0px 0px 0px [1-9]px inset/.test(cercle.ombre), 'un seul bord net, reflet léger en haut à l\'intérieur, aucun anneau supplémentaire');
verifier(cercle.icone === 'rgb(255, 255, 255)', 'icônes blanches');
// contraste de l'icône blanche sur le verre : on masque les icônes, on capture, on lit le pixel au centre de chaque cercle
await ev(`(() => { const s = document.createElement('style'); s.id = 'sans-icones'; s.textContent = 'svg { visibility: hidden !important; }'; document.head.append(s); })()`); await sleep(200);
const capCercles = await send('Page.captureScreenshot', { format: 'png' });
await ev(`document.getElementById('sans-icones').remove()`);
const contrasteIcones = await ev(`(async () => { const img = new Image(); img.src = 'data:image/png;base64,${capCercles.result.data}'; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const lum = ([r, gg, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b); };
  return [...document.querySelectorAll('.ac-action__rond')].map((r) => { const b = r.getBoundingClientRect(); const px = g.getImageData(Math.floor(b.left + b.width / 2), Math.floor(b.top + b.height / 2), 1, 1).data; return (1.05) / (lum([px[0], px[1], px[2]]) + 0.05); }); })()`);
verifier(contrasteIcones.length === 4 && contrasteIcones.every((c) => c >= 3), `icône blanche sur le verre : contraste >= 3:1 (minimum ${Math.min(...contrasteIcones).toFixed(2)}:1, seuil WCAG des pictogrammes)`);
// barre du bas : capsule flottante détachée des bords
const barre = await ev(`(() => { const e = document.querySelector('.app-nav-bas'); const s = getComputedStyle(e); const b = e.getBoundingClientRect(); return { gauche: b.left, droite: innerWidth - b.right, bas: innerHeight - b.bottom, h: b.height, rayon: parseFloat(s.borderTopLeftRadius), fond: s.backgroundColor, flou: s.backdropFilter, position: s.position, actif: (() => { const a = e.querySelector('[aria-current="page"]'); const t = getComputedStyle(a); return { fond: t.backgroundColor, texte: t.color }; })() }; })()`);
verifier(barre.position === 'fixed' && barre.gauche >= 12 && barre.droite >= 12 && barre.bas >= 8, `barre du bas flottante, détachée des bords (${Math.round(barre.gauche)} px à gauche, ${Math.round(barre.droite)} à droite, ${Math.round(barre.bas)} du bas)`);
verifier(barre.rayon >= barre.h / 2 - 1 && /blur/.test(barre.flou) && rgbaDe(barre.fond)[3] < 0.97, `capsule : coins en demi-cercle (${barre.rayon} px pour ${Math.round(barre.h)} px de haut), flou léger, fond kaki`);
verifier((rgbaDe(barre.actif.fond)[3] ?? 1) >= 0.95 && rgbaDe(barre.actif.fond)[0] > 240 && barre.actif.texte === 'rgb(69, 78, 37)', 'onglet actif : capsule sable clair opaque, texte kaki foncé');
await ev(`window.scrollTo(0, document.documentElement.scrollHeight)`); await sleep(300);
const sousBarre = await ev(`(() => { const barre = document.querySelector('.app-nav-bas').getBoundingClientRect(); const dernier = [...document.querySelectorAll('#contenu .pg > *')].pop().getBoundingClientRect(); return { fin: dernier.bottom, hautBarre: barre.top }; })()`);
verifier(sousBarre.fin <= sousBarre.hautBarre - 4, `en bas de page, le dernier élément reste au-dessus de la barre (${Math.round(sousBarre.fin)} px < ${Math.round(sousBarre.hautBarre)} px)`);
await ev(`window.scrollTo(0, 0)`);
// boutons et pastilles : capsules
await aller2('#/animaux/rappels'); await sleep(900);
const capsules = await ev(`[...document.querySelectorAll('.cp-btn, .cp-filtre, .rp-statuts .cp-choix__option span.rp-nombre, .cp-badge')].filter(e => e.getBoundingClientRect().width > 0 && !e.classList.contains('cp-btn--icone')).map(e => { const b = e.getBoundingClientRect(); return { r: parseFloat(getComputedStyle(e).borderTopLeftRadius), h: b.height }; })`);
verifier(capsules.length > 10 && capsules.every((c) => c.r >= c.h / 2 - 1), `boutons, pastilles et badges : capsules (${capsules.length} éléments, coins en demi-cercle)`);
const secondaire = await ev(`(() => { const s = getComputedStyle(document.querySelector('.cp-btn--secondaire')); return { fond: s.backgroundColor, flou: s.backdropFilter, ombre: s.boxShadow }; })()`);
verifier(sable(secondaire.fond) && secondaire.flou === 'none' && /inset/.test(secondaire.ombre), `bouton secondaire : beige net, sans flou, reflet léger (${secondaire.fond})`);
const principal = await ev(`(() => { const s = getComputedStyle(document.querySelector('.cp-btn--principal, [data-fait]')); return { fond: s.backgroundColor, flou: s.backdropFilter, texte: s.color }; })()`);
verifier(principal.fond === 'rgb(91, 99, 52)' && principal.flou === 'none' && principal.texte === 'rgb(255, 255, 255)', `bouton principal : kaki plein, sans flou, texte blanc (${principal.fond})`);
const inactifs = await ev(`[...document.querySelectorAll('.rp-statuts input:not(:checked) + span')].map(e => { const s = getComputedStyle(e); return { flou: s.backdropFilter, fond: s.backgroundColor }; })`);
verifier(inactifs.length === 3 && inactifs.every((x) => x.flou === 'none' && sable(x.fond)), 'filtres inactifs : capsules beiges nettes, sans flou');
// groupes : carrés très arrondis
const rayons = await ev(`({ liste: parseFloat(getComputedStyle(document.querySelector('.rp-liste')).borderTopLeftRadius) })`);
verifier(rayons.liste >= 28, `groupes (listes, cartes) : coins très arrondis (${rayons.liste} px)`);
await aller2('#/animaux/a'); await sleep(500);
await ev(`document.querySelector('[data-act=modifier]').click()`); await sleep(600);
verifier(parseFloat(await style('dialog', 'borderTopLeftRadius')) >= 30, 'fenêtres : coins arrondis de 30 px');
await ev(`document.querySelector('dialog [data-fermer]').click()`); await sleep(300);
// fond plus coloré
const bulles = await ev(`[...document.querySelectorAll('.app-fond span')].map(s => getComputedStyle(s).backgroundImage)`);
const alphas = bulles.map((b) => Number((b.match(/rgba\([^)]*,\s*([\d.]+)\)/) ?? [0, 0])[1]));
verifier(alphas.length === 3 && alphas.every((a) => a >= 0.58), `fond plus coloré : trois bulles (sable, kaki clair, brun léger) à ${alphas.map((a) => Math.round(a * 100)).join(' %, ')} % d'opacité`);
await taille(1280, 900);

log('=== MOUVEMENT ===');
await ev(`document.documentElement.classList.remove('bulles-figees')`); // la protection de fluidité a pu se déclencher pendant les captures de ce test : on la retire pour tester le mouvement
await aller2('#/accueil'); await sleep(900);
const bulle = await ev(`(()=>{const s=getComputedStyle(document.querySelector('.app-fond span'));return {nom:s.animationName,duree:parseFloat(s.animationDuration)}})()`);
verifier(bulle.nom === 'app-bulle' && bulle.duree >= 60, `bulles : animation très lente (${bulle.duree} s par aller)`);
await aller2('#/animaux/a'); await sleep(300);
await aller2('#/accueil');
verifier(await ev(`getComputedStyle(document.querySelector('.contenu > div')).animationName`) === 'app-fondu' && await ev(`getComputedStyle(document.querySelector('.contenu > div .pg > *')).animationName`) === 'app-monte', 'changement de page : la page se fond et ses blocs montent doucement');
await sleep(900);
await aller2('#/animaux'); await sleep(900); // la page Mes animaux a un bouton principal (l'Accueil n'en a plus : ses ajouts sont des actions rapides)
const bouton = await ev(`(()=>{const b=document.querySelector('.cp-btn--principal');const r=b.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: bouton.x, y: bouton.y }); await sleep(400);
verifier(await ev(`getComputedStyle(document.querySelector('.cp-btn--principal')).transform`) !== 'none', 'bouton : s\'élève au survol');
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: bouton.x, y: bouton.y, button: 'left', clickCount: 1 }); await sleep(300);
const enfonce = await ev(`getComputedStyle(document.querySelector('.cp-btn--principal')).transform`);
verifier(/matrix\(0.9[0-6]/.test(enfonce), `bouton : s'enfonce au clic (${enfonce})`);
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: bouton.x, y: bouton.y, button: 'left', clickCount: 1 }); await sleep(600);
await ev(`document.querySelector('dialog [data-fermer]')?.click()`); await sleep(300);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
await aller2('#/animaux/a'); await sleep(900);
const avant = await ev(`getComputedStyle(document.querySelector('.cp-onglets__trait')).getPropertyValue('--x')`);
await ev(`document.querySelector('[data-onglet=historique]').click()`); await sleep(60);
verifier(await ev(`document.querySelector('#fi-panneau-historique').classList.contains('cp-entree')`), 'changement d\'onglet : le panneau apparaît en fondu');
await sleep(500);
const apres = await ev(`getComputedStyle(document.querySelector('.cp-onglets__trait')).getPropertyValue('--x')`);
verifier(avant !== apres && await ev(`document.querySelector('.cp-onglets__trait').classList.contains('is-pret')`) && await ev(`getComputedStyle(document.querySelector('.cp-onglets__trait')).transitionDuration`) !== '0s', `changement d'onglet : le trait glisse (${avant} -> ${apres})`);
verifier(await ev(`document.querySelector('.cp-onglets__trait').getAttribute('aria-hidden') === 'true' && document.querySelectorAll('[role=tab][aria-selected=true]').length === 1`), 'le trait est décoratif ; un seul onglet reste annoncé comme sélectionné');

log('=== « RÉDUIRE LES ANIMATIONS » ===');
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await aller2('#/animaux/b'); await sleep(300); await aller2('#/accueil'); await sleep(300);
verifier(await ev(`getComputedStyle(document.querySelector('.app-fond span')).animationName`) === 'none', 'bulles immobiles');
verifier(await ev(`getComputedStyle(document.querySelector('.contenu > div .pg > *')).animationName`) === 'none' && await ev(`getComputedStyle(document.querySelector('.contenu > div')).animationName`) === 'none', 'apparition des pages et des blocs : supprimée');
await aller2('#/animaux'); await sleep(700); // la page Mes animaux a un bouton principal (l'Accueil n'en a plus : ses ajouts sont des actions rapides)
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: bouton.x, y: bouton.y }); await sleep(300);
verifier(await ev(`getComputedStyle(document.querySelector('.cp-btn--principal')).transform`) === 'none', 'bouton : plus de mouvement au survol');
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
await aller2('#/animaux/a'); await sleep(500);
await ev(`document.querySelector('[data-onglet=poids]').click()`); await sleep(60);
verifier(await ev(`getComputedStyle(document.querySelector('#fi-panneau-poids')).animationName`) === 'none' && parseFloat(await ev(`getComputedStyle(document.querySelector('.cp-onglets__trait')).transitionDuration`)) <= 0.01, 'onglets : pas d\'animation, le trait se place d\'un coup');
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

log('=== REBOND DES BOUTONS (étape D) ===');
await aller2('#/accueil'); await sleep(500);
verifier(await ev(`(()=>{const b=getComputedStyle(document.querySelector('.cp-btn')).transitionTimingFunction;return /1\.56/.test(b)})()`), 'boutons : courbe à dépassement (ressort) au relâchement');
verifier(await ev(`(()=>{const a=document.querySelector('.ac-action__rond');return /1\.56/.test(getComputedStyle(a).transitionTimingFunction)})()`), 'actions rapides : courbe à dépassement');
verifier(await ev(`import('/js/conseils.js').then(m=>m.CONSEILS.length===12 && m.CONSEILS.every(c=>c.source && !/confirmer/i.test(c.source)))`), 'conseils : 12 conseils, aucune mention « à confirmer » dans les sources');

log('=== PROTECTION DE FLUIDITÉ ===');
await aller2('#/accueil'); await sleep(500);
const lent = await ev(`import('/js/fond.js').then(m => m.mesurerEtAdapter({ delai: 0, duree: 400, seuilMs: 0.0001 }))`);
verifier(lent.fige === true && await ev(`document.documentElement.classList.contains('bulles-figees') && getComputedStyle(document.querySelector('.app-fond span')).animationName === 'none'`), 'appareil jugé trop lent (seuil volontairement bas) : les bulles sont figées, le verre reste');
verifier(flou(await style('.cp-liste', 'backdropFilter')), 'le verre est conservé quand les bulles sont figées');
await ev(`document.documentElement.classList.remove('bulles-figees')`);
const rapide = await ev(`import('/js/fond.js').then(m => m.mesurerEtAdapter({ delai: 0, duree: 400, seuilMs: 500 }))`);
verifier(rapide.fige === false && await ev(`!document.documentElement.classList.contains('bulles-figees')`), `appareil assez rapide (médiane ${rapide.mediane.toFixed(1)} ms par image) : décor conservé`);

log('=== ACCESSIBILITÉ ===');
for (const [h, nom] of [['#/accueil', 'Accueil'], ['#/animaux/rappels', 'Rappels'], ['#/animaux/a', 'fiche'], ['#/animaux', 'Mes animaux'], ['#/profil', 'Profil']]) {
  await taille(1280, 900); await aller2(h); await sleep(900); await axe('#app', `${nom} en verre`);
}
await taille(390, 844); await aller2('#/accueil'); await sleep(900); await axe('#app', 'Accueil en verre (téléphone)');
verifier(await sansDebord(), 'téléphone : sans défilement horizontal');
const exp = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
await ev(`import('/js/storage.js').then(m=>m.toutEffacer())`); await importer(exp);
const exp2 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
const net = (t) => { const o = JSON.parse(t); delete o.exporteLe; return JSON.stringify(o); };
log('export -> effacer -> import -> export identique :', net(exp) === net(exp2));
log('ERREURS CONSOLE :', erreurs.length ? erreurs : 'aucune');
log('VÉRIFICATIONS EN ÉCHEC :', echecs);
ws.close(); proc.kill(); process.exit(echecs ? 1 : 0);
