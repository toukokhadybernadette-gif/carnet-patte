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
verifier(flou(await style('.pg-stats', 'backdropFilter')) && flou(await style('.cp-liste', 'backdropFilter')), 'cartes et listes : flou');
const alpha = (c) => parseFloat((c ?? '').match(/rgba\([^)]*,\s*([\d.]+)\)/)?.[1] ?? '1');
const fond = await style('.pg-stats', 'backgroundColor');
verifier(alpha(fond) >= 0.3 && alpha(fond) <= 0.55, `cartes nettement transparentes : blanc à ${Math.round(alpha(fond) * 100)} % (${fond})`);
const px = (v) => parseFloat((v ?? '').match(/blur\((\d+(?:\.\d+)?)px/)?.[1] ?? '0');
verifier(px(await style('.pg-stats', 'backdropFilter')) >= 24 && px(await style('.app-lateral', 'backdropFilter')) >= 24, `flou fort sur les cartes (${px(await style('.pg-stats', 'backdropFilter'))} px) et le menu (${px(await style('.app-lateral', 'backdropFilter'))} px)`);
verifier(alpha(await style('.pg-stats', 'borderTopColor')) >= 0.8 && (await style('.pg-stats', 'borderTopColor')).startsWith('rgba(255, 255, 255') && parseFloat(await style('.pg-stats', 'borderTopLeftRadius')) >= 16, 'bordure claire bien visible et coins arrondis (16 px ou plus)');
verifier(!/inset 0px 0px 0px 0px/.test(await style('.pg-stats', 'boxShadow')) && (await style('.pg-stats', 'boxShadow')) !== 'none', 'ombre douce');
await aller2('#/animaux/rappels'); await sleep(800);
verifier(['.rp-carte', '.rp-chiffre'].every(async (s) => true) && !flou(await style('.rp-carte', 'backdropFilter')) && !flou(await style('.rp-chiffre', 'backdropFilter')), 'pas de flou imbriqué : les lignes de liste et les chiffres d\'une carte à colonnes n\'ont pas de flou propre');
await aller2('#/animaux/a'); await sleep(800);
verifier(flou(await style('.fi-entete', 'backdropFilter')) && (await style('.fi-entete', 'boxShadow')).includes('inset'), 'fiche : en-tête en verre, avec son filet de couleur d\'animal conservé');
await ev(`document.querySelector('[data-act=modifier]').click()`); await sleep(600);
verifier(flou(await style('dialog', 'backdropFilter')) && alpha(await style('dialog', 'backgroundColor')) >= 0.6 && alpha(await style('dialog', 'backgroundColor')) <= 0.85, 'fenêtre : verre dépoli semi-transparent (un peu plus opaque que les cartes : on y tape du texte)');
verifier(flou(await ev(`getComputedStyle(document.querySelector('dialog'), '::backdrop').backdropFilter`)), 'arrière-plan de la fenêtre flouté');
await axe('dialog', 'fenêtre en verre');
await ev(`document.querySelector('dialog [data-fermer]').click()`); await sleep(300);
await taille(390, 844); await aller2('#/accueil'); await sleep(800);
verifier(flou(await style('.app-nav-bas', 'backdropFilter')) && flou(await style('.app-haut', 'backdropFilter')), 'téléphone : barre du bas et barre du haut en verre');
verifier(!flou(await style('.cp-carte-animal', 'backdropFilter')), 'téléphone : pas de flou sur chaque carte d\'animal (économie)');
verifier(px(await style('.pg-stats', 'backdropFilter')) === 16, 'téléphone : flou réduit mais fort (16 px)');
await taille(1280, 900);
const regles = await ev(`(() => { let trouve = false; for (const f of document.styleSheets) { try { for (const r of f.cssRules) if (r instanceof CSSSupportsRule && r.conditionText.includes('backdrop-filter')) trouve = true; } catch {} } return trouve; })()`);
verifier(regles, 'repli prévu pour un navigateur sans backdrop-filter (fonds presque pleins)');

log('=== PASTILLES EN VERT SAUGE (urgence inchangée) ===');
const vert = (c) => { const m = (c ?? '').match(/[\d.]+/g)?.map(Number); return !!m && m[1] > m[0] && m[1] > m[2] && (m[3] ?? 1) < 0.7; }; // dominante verte, translucide
await aller2('#/animaux/rappels'); await sleep(900);
verifier(await ev(`[...document.querySelectorAll('.rp-statuts .cp-choix__option input:not(:checked) + span')].length === 3`) && vert(await ev(`getComputedStyle(document.querySelector('.rp-statuts .cp-choix__option input:not(:checked) + span')).backgroundColor`)), 'boutons de filtre (En retard, À venir, Effectués) : verre teinté vert sauge translucide');
verifier(vert(await ev(`getComputedStyle(document.querySelector('.rp-statuts .cp-choix__option input:checked + span')).backgroundColor`)) && await ev(`getComputedStyle(document.querySelector('.rp-statuts .cp-choix__option input:checked + span')).borderTopColor`) === 'rgb(36, 61, 53)', 'bouton de filtre choisi (À faire) : vert sauge plus soutenu, contour foncé (le choix ne dépend pas que de la couleur)');
verifier(vert(await ev(`getComputedStyle(document.querySelector('.rp-statuts .rp-nombre')).backgroundColor`)), 'compteurs dans les boutons de filtre : vert sauge');
verifier(await ev(`!!document.querySelector('.rp-groupe--semaine .rp-groupe__titre .cp-compteur')`) && vert(await ev(`getComputedStyle(document.querySelector('.rp-groupe--semaine .rp-groupe__titre .cp-compteur')).backgroundColor`)), 'compteur d\'un groupe « Cette semaine » : vert sauge');
// l'urgence garde ses couleurs d'avant
const rgb = (sel) => ev(`getComputedStyle(document.querySelector(${JSON.stringify(sel)})).backgroundColor`);
verifier(await rgb('.rp-groupe--retard .rp-groupe__titre .cp-compteur') === 'rgb(246, 227, 220)', 'compteur du groupe « En retard » : toujours rouge pâle');
verifier(await rgb('.cp-badge--alerte') === 'rgb(246, 227, 220)' && await rgb('.cp-badge--attention') === 'rgb(246, 232, 201)' && await rgb('.cp-badge--succes') === 'rgb(228, 238, 224)', 'badges d\'échéance : rouge pâle, ambre pâle et vert pâle inchangés');
verifier(await rgb('.app-nav__compteur') === 'rgb(142, 61, 43)', 'pastille rouge des retards dans le menu : inchangée');
await aller2('#/animaux'); await sleep(900);
verifier(await ev(`document.querySelectorAll('.cp-filtre').length >= 2`) && vert(await ev(`getComputedStyle(document.querySelector('.cp-filtre')).backgroundColor`)), 'filtres par espèce (Mes animaux) : vert sauge translucide');
await ev(`document.querySelector('.cp-filtre').click()`); await sleep(200);
verifier(await ev(`getComputedStyle(document.querySelector('.cp-filtre[aria-pressed="true"]')).backgroundColor`) === 'rgb(36, 61, 53)', 'filtre activé : reste bien foncé (état très lisible)');
await ev(`document.querySelector('.cp-filtre[aria-pressed="true"]').click()`); await sleep(100);
await aller2('#/accueil'); await sleep(500);
await ev(`document.querySelector('.app-bientot__titre').click()`); await sleep(150);
verifier(vert(await ev(`getComputedStyle(document.querySelector('.app-bientot__nombre')).backgroundColor`)), 'compteur de la section « Bientôt » du menu : vert sauge');
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
        const dessus = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); // texte masqué par une barre ou une fenêtre : pas mesuré ici
        if (!dessus || !(el.contains(dessus) || dessus.contains(el))) continue;
        r.push({ texte: t.nodeValue.trim().slice(0, 24), couleur: el instanceof SVGElement ? cs.fill : cs.color, x: b.left, y: b.top, w: b.width, h: b.height });
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
        for (const [fx, fy] of [[0.5, 0.5], [0.15, 0.5], [0.85, 0.5], [0.5, 0.2], [0.5, 0.8]]) {
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

log('=== MOUVEMENT ===');
await ev(`document.documentElement.classList.remove('bulles-figees')`); // la protection de fluidité a pu se déclencher pendant les captures de ce test : on la retire pour tester le mouvement
await aller2('#/accueil'); await sleep(900);
const bulle = await ev(`(()=>{const s=getComputedStyle(document.querySelector('.app-fond span'));return {nom:s.animationName,duree:parseFloat(s.animationDuration)}})()`);
verifier(bulle.nom === 'app-bulle' && bulle.duree >= 60, `bulles : animation très lente (${bulle.duree} s par aller)`);
await aller2('#/animaux/a'); await sleep(300);
await aller2('#/accueil');
verifier(await ev(`getComputedStyle(document.querySelector('.contenu > div')).animationName`) === 'app-fondu' && await ev(`getComputedStyle(document.querySelector('.contenu > div .pg > *')).animationName`) === 'app-monte', 'changement de page : la page se fond et ses blocs montent doucement');
await sleep(900);
const bouton = await ev(`(()=>{const b=document.querySelector('.cp-btn--principal');const r=b.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: bouton.x, y: bouton.y }); await sleep(400);
verifier(await ev(`getComputedStyle(document.querySelector('.cp-btn--principal')).transform`) !== 'none', 'bouton : s\'élève au survol');
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: bouton.x, y: bouton.y, button: 'left', clickCount: 1 }); await sleep(300);
const enfonce = await ev(`getComputedStyle(document.querySelector('.cp-btn--principal')).transform`);
verifier(/matrix\(0\.97/.test(enfonce), `bouton : s'enfonce au clic (${enfonce})`);
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
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: bouton.x, y: bouton.y }); await sleep(300);
verifier(await ev(`getComputedStyle(document.querySelector('.cp-btn--principal')).transform`) === 'none', 'bouton : plus de mouvement au survol');
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
await aller2('#/animaux/a'); await sleep(500);
await ev(`document.querySelector('[data-onglet=poids]').click()`); await sleep(60);
verifier(await ev(`getComputedStyle(document.querySelector('#fi-panneau-poids')).animationName`) === 'none' && parseFloat(await ev(`getComputedStyle(document.querySelector('.cp-onglets__trait')).transitionDuration`)) <= 0.01, 'onglets : pas d\'animation, le trait se place d\'un coup');
await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });

log('=== PROTECTION DE FLUIDITÉ ===');
await aller2('#/accueil'); await sleep(500);
const lent = await ev(`import('/js/fond.js').then(m => m.mesurerEtAdapter({ delai: 0, duree: 400, seuilMs: 0.0001 }))`);
verifier(lent.fige === true && await ev(`document.documentElement.classList.contains('bulles-figees') && getComputedStyle(document.querySelector('.app-fond span')).animationName === 'none'`), 'appareil jugé trop lent (seuil volontairement bas) : les bulles sont figées, le verre reste');
verifier(flou(await style('.pg-stats', 'backdropFilter')), 'le verre est conservé quand les bulles sont figées');
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
