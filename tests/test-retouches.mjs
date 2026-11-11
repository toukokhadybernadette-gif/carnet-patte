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
// ===== Retouches : couleur unique kaki/beige, boutons nets, bugs iPhone, bugs vus sur iPhone (date, filtre, marges, graphique, pesées, exemples) =====
let echecs = 0;
const verifier = (condition, texteLog) => { if (!condition) echecs++; log(`  ${texteLog} = ${condition}`); };
const importer = (texte) => ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(texte)}))`);
const A = (id, nom, extra = {}) => ({ id, nom, espece: 'chat', especeAutre: '', race: '', naissance: '', photo: '', ...extra });
const jeu = (animaux, soins = [], pesees = []) => importer(JSON.stringify({ version: 1, exemplesAjoutes: true, animaux, soins, pesees }));
const KAKI = 'rgb(91, 99, 52)';

const SOIN = (id, rappel) => ({ id, animalId: 'a', type: 'vermifuge', titre: '', date: jour(-60), notes: '', rappel: jour(rappel), rappelFait: false });
await jeu([A('a', 'Bob', { exemple: true }), A('b', 'Mia', { espece: 'chien' })], [SOIN('s1', -3), SOIN('s2', 3), SOIN('s3', 30)], [
  { id: 'p1', animalId: 'a', date: jour(-40), poidsKg: 4.1 }, { id: 'p2', animalId: 'a', date: jour(-20), poidsKg: 4.55 }, { id: 'p3', animalId: 'a', date: jour(-1), poidsKg: 4.1 }]);

log('=== COULEUR UNIQUE (vert kaki) ===');
await taille(1280, 900); await aller2('#/animaux'); await sleep(800); await ev(`document.querySelector('.cp-filtre[data-valeur=chat]').click()`); await sleep(300);
verifier(await ev(`getComputedStyle(document.querySelector('.app-marque__logo')).backgroundColor`) === KAKI, 'logo : kaki');
verifier(await ev(`getComputedStyle(document.documentElement).getPropertyValue('--cp-foret').trim().toLowerCase()`) === '#5b6334', 'couleur principale : #5B6334');
log('  filtre actif :', await ev(`getComputedStyle(document.querySelector('.cp-filtre[aria-pressed="true"]')).backgroundColor`));
verifier(await ev(`(() => { const b = document.querySelector('.cp-filtre[aria-pressed="true"]'); return !!b && getComputedStyle(b).backgroundColor === 'rgb(91, 99, 52)'; })()`), 'filtre actif : kaki');
// aucun bleu : on parcourt fonds, textes et contours des éléments de plusieurs pages
const bleu = `(() => { const out = []; for (const e of document.querySelectorAll('body *:not(.cp-avatar):not([class*="type-"]):not(.cp-liste__icone)')) { const cs = getComputedStyle(e); for (const k of ['backgroundColor', 'color', 'borderTopColor']) { const m = cs[k].match(/rgba?\\((\\d+), (\\d+), (\\d+)(?:, ([\\d.]+))?\\)/); if (!m) continue; const r = +m[1], g = +m[2], b = +m[3], a = m[4] === undefined ? 1 : +m[4]; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const h = mx === mn ? 0 : mx === r ? ((g - b) / (mx - mn) * 60 + 360) % 360 : mx === g ? (b - r) / (mx - mn) * 60 + 120 : (r - g) / (mx - mn) * 60 + 240; if (a > 0.15 && mx - mn > 50 && h >= 185 && h <= 335) out.push(e.className + ':' + k + ':' + cs[k]); } } return out.slice(0, 6); })()`;
for (const [h, nom] of [['#/animaux', 'Animaux'], ['#/accueil', 'Accueil'], ['#/animaux/rappels', 'Rappels'], ['#/profil', 'Profil']]) {
  await aller2(h); await sleep(400);
  const r = await ev(bleu);
  verifier(r.length === 0, `${nom} : aucune couleur bleue ni violette (${r.join(' | ') || 'rien'})`);
}
await aller2('#/animaux/a'); await ev(`document.querySelector('[data-onglet=poids]').click()`); await sleep(600);
verifier((await ev(bleu)).length === 0, 'fiche, onglet Poids : aucune couleur bleue ni violette');
verifier(await ev(`getComputedStyle(document.querySelector('.ps-periodes .cp-filtre[aria-pressed="true"]')).backgroundColor`) === KAKI, 'périodes du graphique : kaki');
verifier(await ev(`getComputedStyle(document.querySelector('.cp-onglets__trait')).backgroundColor`) === KAKI, 'onglet actif : trait kaki');

log('=== BOUTONS NETS : un seul bord, ni anneau ni halo (téléphone) ===');
await taille(390, 844); await aller2('#/animaux/rappels'); await sleep(900);
const nets = await ev(`(() => { const out = []; for (const sel of ['.cp-btn', '.rp-statuts .cp-choix__option span', '.app-nav-bas', '.app-nav-bas .cp-nav-bas__item[aria-current=page]']) { const e = document.querySelector(sel); if (!e) { out.push(sel + ' : absent'); continue; } const cs = getComputedStyle(e); const ombre = cs.boxShadow; const anneau = /(rgba?\([^)]*\)) 0px 0px 0px [1-9]\d*px( inset)?/.test(ombre); const bord = parseFloat(cs.borderTopWidth); if (anneau) out.push(sel + ' : anneau ' + ombre); if (bord > 1) out.push(sel + ' : bord ' + bord + 'px'); if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) out.push(sel + ' : contour ' + cs.outlineStyle); if (cs.backdropFilter !== 'none' && sel !== '.app-nav-bas') out.push(sel + ' : flou ' + cs.backdropFilter); if (cs.webkitTapHighlightColor !== 'rgba(0, 0, 0, 0)') out.push(sel + ' : tap ' + cs.webkitTapHighlightColor); } return out; })()`);
verifier(nets.length === 0, `boutons, filtres, pastilles et barre : un seul bord, aucun anneau, halo ni flou (${nets.join(' | ') || 'rien à signaler'})`);
await aller2('#/accueil'); await sleep(700);
const nets2 = await ev(`(() => { const out = []; for (const sel of ['.ac-action__rond', '[data-fait]', '.ac-story--ajout']) { const e = document.querySelector(sel); if (!e) { out.push(sel + ' : absent'); continue; } const cs = getComputedStyle(e); if (/(rgba?\([^)]*\)) 0px 0px 0px [1-9]\d*px( inset)?/.test(cs.boxShadow)) out.push(sel + ' : anneau ' + cs.boxShadow); if (cs.backdropFilter !== 'none') out.push(sel + ' : flou'); if (cs.webkitTapHighlightColor !== 'rgba(0, 0, 0, 0)') out.push(sel + ' : tap'); } return out; })()`);
verifier(nets2.length === 0, `Accueil : « Fait », actions rapides, carte Ajouter : bord net (${nets2.join(' | ') || 'rien à signaler'})`);
// captures zoomées à 200 % : bord du bouton « Fait », des cercles et de la barre du bas
const zoom = async (nom, sel) => { const r = await ev(`(() => { const b = document.querySelector('${sel}').getBoundingClientRect(); return { x: Math.max(b.left - 12, 0), y: Math.max(b.top - 12, 0) + scrollY, w: b.width + 24, h: b.height + 24 }; })()`); const c = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: r.x, y: r.y, width: Math.min(r.w, 390), height: r.h, scale: 2 } }); fs.writeFileSync(`${S}/shots/${TAG}-${nom}.png`, Buffer.from(c.result.data, 'base64')); };
await zoom('zoom-fait', '.ac-afaire'); await zoom('zoom-actions', '.ac-actions'); await zoom('zoom-barre', '.app-nav-bas');

log('=== ACCUEIL : étiquette sur une ligne, première carte alignée sur la marge ===');
await aller2('#/accueil'); await sleep(800);
verifier(await ev(`(() => { const e = document.querySelector('.ac-afaire__etiquette'); const lh = parseFloat(getComputedStyle(e).lineHeight); return !!e && e.getBoundingClientRect().height <= lh + 1; })()`), '« À faire » : sur une seule ligne (téléphone)');
const marges = await ev(`(() => { const ul = document.querySelector('.ac-stories ul'); const carte = document.querySelector('.ac-story').getBoundingClientRect(); const titre = document.querySelector('#ac-animaux').getBoundingClientRect(); const hero = document.querySelector('.ac-hero').getBoundingClientRect(); return { carte: Math.round(carte.left), titre: Math.round(titre.left), hero: Math.round(hero.left), scroll: ul.scrollLeft, droite: ul.getBoundingClientRect().right, largeur: innerWidth }; })()`);
verifier(marges.carte === marges.titre && marges.carte === marges.hero && marges.carte >= 12 && marges.scroll === 0, `première carte d'animal alignée sur la marge des autres blocs (carte ${marges.carte} px, titre ${marges.titre} px, héros ${marges.hero} px)`);
verifier(marges.droite >= marges.largeur - 1, 'le défilement des cartes va jusqu\'au bord droit de l\'écran');

log('=== URGENCE : le vert « plus tard » ne se confond pas avec le kaki (forme + texte) ===');
await aller2('#/animaux/rappels'); await sleep(700);
const badges = await ev(`(() => { const f = (c) => { const b = document.querySelector('.cp-badge--' + c); return b ? { texte: b.textContent.trim(), icone: b.querySelector('svg')?.innerHTML || '' } : null; }; return { retard: f('alerte'), semaine: f('attention'), plusTard: f('succes') }; })()`);
verifier(badges.retard && badges.semaine && badges.plusTard && new Set([badges.retard.icone, badges.semaine.icone, badges.plusTard.icone]).size === 3 && [badges.retard, badges.semaine, badges.plusTard].every((b) => b.texte.length > 3), `retard / cette semaine / plus tard : trois icônes différentes et un texte chacun (${[badges.retard, badges.semaine, badges.plusTard].map((b) => b && b.texte).join(' | ')})`);

log('=== PAGE ANIMAUX : exemples en petite ligne, filtre sans rectangle ===');
await taille(390, 844); await aller2('#/animaux'); await sleep(600); await ev(`document.querySelector('.cp-filtre[data-valeur=chat]').click()`); await sleep(300);
verifier(await ev(`(() => { const e = document.querySelector('.al-exemples'); return !!e && e.getBoundingClientRect().height <= 60 && !e.classList.contains('cp-alerte') && e.querySelector('[data-act=effacer-exemples]').textContent === 'Supprimer les exemples'; })()`), 'bloc « exemple » : une petite ligne avec le lien « Supprimer les exemples »');
log('  nombres :', await ev(`[...document.querySelectorAll('.cp-filtre__nombre')].map(x => getComputedStyle(x).backgroundColor + '/' + x.parentElement.getAttribute('aria-pressed')).join(' ')`));
verifier(await ev(`(() => { const n = [...document.querySelectorAll('.cp-filtre__nombre')]; return n.length > 0 && n.every(x => { const c = getComputedStyle(x).backgroundColor; return c === 'rgba(0, 0, 0, 0)' || c === 'transparent'; }); })()`), 'filtre « Chat 1 » actif : aucun rectangle derrière le chiffre');
await clip('animaux-mobile', '.pg', 2000);

log('=== DATES : en français, sans dépasser ===');
await aller2('#/animaux/a'); await sleep(400);
await ev(`document.querySelector('[data-onglet=poids]').click()`); await sleep(500);
verifier(await ev(`(() => { const d = document.querySelector('input[type=date]'); return !!d && d.lang === 'fr'; })()`), 'champ date de la pesée : lang="fr"');
verifier(await ev(`(() => { const d = document.querySelector('input[type=date]'); const p = d.closest('form, .cp-carte').getBoundingClientRect(); const r = d.getBoundingClientRect(); return r.right <= p.right + 0.5 && r.left >= p.left - 0.5; })()`), 'champ date : ne dépasse pas de sa carte (téléphone)');
verifier(await sansDebord(), 'fiche : pas de défilement horizontal');

log('=== MARGE EN BAS (barre flottante) ===');
verifier(await ev(`parseFloat(getComputedStyle(document.querySelector('.contenu')).paddingBottom) >= 120`), 'téléphone : au moins 120 px de marge sous chaque page');
await ev(`window.scrollTo(0, document.documentElement.scrollHeight)`); await sleep(300);
verifier(await ev(`(() => { const bar = document.querySelector('.app-nav-bas').getBoundingClientRect(); const c = document.querySelector('.contenu > div').lastElementChild; const dern = (c.lastElementChild || c).getBoundingClientRect(); return dern.bottom <= bar.top - 8; })()`), 'en bas de page, le dernier bloc reste au-dessus de la barre flottante');

log('=== GRAPHIQUE : marge au-dessus de la courbe ===');
verifier(await ev(`(() => { const svg = document.querySelector('svg.ps-graphique'); const ys = [...svg.querySelectorAll('circle.ps-point')].map(c => +c.getAttribute('cy')); return ys.length >= 2 && Math.min(...ys) >= 20; })()`), 'le point le plus haut a au moins 20 px de marge au-dessus');

log('=== LISTE DES PESÉES : « +0,45 kg » ===');
const infos = (await ev(`[...document.querySelectorAll('.ps-ligne-info')].map(x => x.textContent.trim())`)).filter((t) => /kg|inchangé/.test(t));
verifier(infos.length > 0 && infos.every((t) => /^[+−]\d+(,\d+)? kg$|^Poids inchangé$/.test(t)) && infos.some((t) => t === '+0,45 kg'), `variations : ${infos.join(' | ')}`);
verifier(await ev(`!document.body.textContent.includes('depuis la pesée précédente')`), 'plus de « depuis la pesée précédente »');

log('=== ACCESSIBILITÉ ===');
for (const [h, nom] of [['#/accueil', 'Accueil'], ['#/animaux', 'Animaux'], ['#/animaux/a', 'fiche']]) { await aller2(h); await sleep(700); await axe('#app', nom + ' (retouches)'); }
const exp = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
await ev(`import('/js/storage.js').then(m=>m.toutEffacer())`); await importer(exp);
const exp2 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
const net = (t) => { const o = JSON.parse(t); delete o.exporteLe; return JSON.stringify(o); };
log('export -> effacer -> import -> export identique :', net(exp) === net(exp2));
log('ERREURS CONSOLE :', erreurs.length ? erreurs : 'aucune');
log('VÉRIFICATIONS EN ÉCHEC :', echecs);
ws.close(); proc.kill(); process.exit(echecs ? 1 : 0);
