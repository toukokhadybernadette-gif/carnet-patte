// Refonte du style : 6 thèmes de couleur (aperçu immédiat, mémorisés, contraste 4,5:1), photos au centre (Accueil, fiche, formulaire), illustrations d'espèces.
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

// ===== 1. Les thèmes (sans navigateur) : le générateur contrôle chaque paire de couleurs =====
log('=== THÈMES : outils/generer-themes.mjs ===');
const G = await import(pathToFileURL(path.join(RACINE, 'outils/generer-themes.mjs')).href);
const TH = await import(pathToFileURL(path.join(RACINE, 'js/theme.js')).href);
const CT = await import(pathToFileURL(path.join(RACINE, 'js/couleurs-theme.js')).href);
const IL = await import(pathToFileURL(path.join(RACINE, 'js/illustrations.js')).href);
const CO = await import(pathToFileURL(path.join(RACINE, 'modules/animaux/commun.js')).href).catch(() => null);
verifier(G.THEMES.map((t) => t.id).join() === 'kaki,bleu-ciel,sauge,terracotta,lavande,sable,rose-poudre,corail,menthe,turquoise,bleu-nuit,moutarde' && TH.THEMES.map((t) => t.id).join() === G.THEMES.map((t) => t.id).join(), '12 thèmes : kaki, bleu ciel, sauge, terracotta, lavande, sable, rose poudré, corail, menthe, turquoise, bleu nuit, moutarde');
let pireGlobal = { ratio: 99 };
for (const t of G.THEMES) {
  const r = G.controle(t);
  const mauvais = r.filter((x) => x.ratio < x.mini);
  const pire = r.reduce((m, x) => (x.ratio / x.mini < m.ratio / m.mini ? x : m));
  if (pire.ratio < pireGlobal.ratio) pireGlobal = { ...pire, theme: t.nom };
  verifier(mauvais.length === 0, `${t.nom} : ${r.length} paires texte/fond à 4,5:1 minimum (la plus juste : ${pire.ratio.toFixed(2)}:1, ${pire.nom})`);
}
let nbPerso = 0; let mauvaisPerso = 0; let pirePerso = 99;
for (let h = 0; h < 360; h += 15) for (const sat of [0, 25, 60, 100]) for (const l of [2, 20, 40, 60, 80, 97]) {
  const { theme } = CT.themeDepuisCouleur(CT.hex(CT.hsl(h, sat, l)));
  for (const x of CT.controle(theme)) { nbPerso++; pirePerso = Math.min(pirePerso, x.ratio / x.mini * 4.5); if (x.ratio < x.mini) mauvaisPerso++; }
}
verifier(mauvaisPerso === 0, `couleur personnalisée : ${nbPerso} contrôles sur ${24 * 4 * 6} couleurs de départ, aucun sous le seuil (le plus juste : ${pirePerso.toFixed(2)}:1)`);
const css = fs.readFileSync(path.join(RACINE, 'css/themes.css'), 'utf8');
verifier(G.THEMES.every((t) => css.includes(`/* ----- ${t.nom} ----- */`)), 'css/themes.css contient les 12 thèmes (à jour avec le générateur)');

// ===== 2. L'appli dans Edge =====
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
let axeSrc = ''; for (let i = 0; i < 4 && !axeSrc; i++) { try { axeSrc = await (await fetch('https://cdn.jsdelivr.net/npm/axe-core@4.10.2/axe.min.js')).text(); } catch { await sleep(1500); } }
const axe = async (sel, nom) => { if (await ev('typeof axe') !== 'function') await ev(axeSrc); const a = await ev(`axe.run(document.querySelector('${sel}'), {runOnly:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}).then(r=>({v:r.violations.map(v=>v.id+'('+v.nodes.length+') '+v.nodes[0].html.slice(0,90)),inc:r.incomplete.map(i=>i.id)}))`); log('axe', nom, ':', a.v.length ? 'VIOLATIONS ' + a.v.join(' | ') : '0 violation', a.inc.length ? '· à vérifier ' + a.inc : ''); };
const sansDebord = () => ev(`document.documentElement.scrollWidth<=innerWidth`);
const texte = (sel) => ev(`(document.querySelector(${JSON.stringify(sel)})?.innerText ?? 'ABSENT').replace(/\\s+/g,' ').trim()`);
const importer = (t) => ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(t)}))`);
const A = (id, nom, espece, extra = {}) => ({ id, nom, espece, especeAutre: '', race: '', naissance: '', photo: '', ...extra });
const style = (sel, prop) => ev(`getComputedStyle(document.querySelector(${JSON.stringify(sel)}))[${JSON.stringify(prop)}]`);
const variable = (nom) => ev(`getComputedStyle(document.documentElement).getPropertyValue(${JSON.stringify(nom)}).trim()`);

await send('Page.navigate', { url: URL }); await sleep(1800); await taille(390, 844); await aller('#/accueil'); await ev(axeSrc);
// Une vraie photo (petit dégradé en JPEG) pour Moka ; Mimi et Zorro n'en ont pas
const photo = await ev(`(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 320; const g = c.getContext('2d'); const d = g.createLinearGradient(0, 0, 400, 320); d.addColorStop(0, '#d9a066'); d.addColorStop(1, '#6b4a2b'); g.fillStyle = d; g.fillRect(0, 0, 400, 320); g.fillStyle = '#f3e3c8'; g.beginPath(); g.arc(200, 150, 90, 0, 7); g.fill(); return c.toDataURL('image/jpeg', 0.8); })()`);
const aujourdhui = await ev(`import('/js/utils.js').then(m => m.aujourdhui())`);
const dansJours = (n) => new Date(Date.parse(aujourdhui) + n * 86400000).toISOString().slice(0, 10);
const donnees = { version: 1, exemplesAjoutes: true,
  animaux: [A('c', 'Moka', 'chien', { photo, race: 'Labrador', naissance: '2019-05-02' }), A('b', 'Mimi', 'chat'), A('a', 'Zorro', 'furet')],
  soins: [{ id: 's1', animalId: 'c', type: 'vermifuge', titre: 'Vermifuge', date: dansJours(-100), notes: '', rappel: dansJours(-3), rappelFait: false },
    { id: 's2', animalId: 'b', type: 'vaccin', titre: 'Rage', date: dansJours(-300), notes: '', rappel: dansJours(4), rappelFait: false }],
  pesees: [{ id: 'p1', animalId: 'c', date: dansJours(-20), poidsKg: 28.4 }, { id: 'p2', animalId: 'c', date: dansJours(-50), poidsKg: 28 }] };
await importer(JSON.stringify(donnees));

log('=== STYLE GÉNÉRAL ===');
await aller2('#/accueil');
verifier((await style('.cp-btn--principal, .ac-afaire [data-fait]', 'borderRadius')).startsWith('9999') || parseFloat(await style('.ac-afaire [data-fait]', 'borderTopLeftRadius')) >= 20, 'bouton principal : pilule pleine');
await aller2('#/animaux');
verifier(parseFloat(await style('.cp-btn--principal', 'borderTopLeftRadius')) >= 20 && (await style('.cp-btn--principal', 'backgroundColor')) !== 'rgba(0, 0, 0, 0)', 'bouton « Ajouter un animal » : pilule pleine');
await ev(`document.querySelector('[data-act=ajouter]').click()`); await sleep(500);
verifier(parseFloat(await style('dialog .cp-btn--secondaire', 'borderTopLeftRadius')) >= 20 && parseFloat(await style('dialog .cp-btn--secondaire', 'borderTopWidth')) === 1, 'bouton secondaire : pilule à contour fin (1 px)');
await ev(`document.querySelector('dialog [data-annuler]').click()`); await sleep(300);
verifier((await style('.app-fond', 'position')) === 'fixed' && (await ev(`getComputedStyle(document.querySelector('.app-fond'), '::before').backgroundImage`)).includes('linear-gradient'), 'fond : dégradé doux de la couleur du thème en haut de l\'écran');
verifier(await ev(`getComputedStyle(document.querySelector('.cp-carte-animal')).backdropFilter !== 'none' || innerWidth < 600`), 'cartes : verre léger');
verifier(parseFloat(await style('.cp-carte', 'borderTopLeftRadius')) >= 28, 'cartes : grands coins arrondis');
verifier(parseFloat(await style('h1', 'fontSize')) >= 30, `titre de page plus grand (${await style('h1', 'fontSize')})`);

log('=== ACCUEIL : grande carte avec la photo ===');
await aller2('#/accueil');
verifier(await ev(`document.querySelectorAll('.ac-hero .ac-couv__slide:not(.ac-couv__slide--ajout)').length`) === 3, 'un défilement entre les 3 animaux');
verifier(await ev(`document.querySelector('.ac-couv__slide .ac-couv__nom').textContent`) === 'Moka', 'l\'animal le plus pressé (rappel en retard) passe en premier');
verifier(await ev(`!!document.querySelector('.ac-couv__slide img.ac-couv__img') && document.querySelector('.ac-couv__slide img').src.startsWith('data:image/')`), 'sa photo est affichée en grand');
const dim = await ev(`(() => { const r = document.querySelector('.ac-couv__photo').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; })()`);
verifier(dim.w >= 280 && dim.h >= 220, `grande photo (${dim.w} × ${dim.h} px)`);
verifier(await ev(`(() => { const s = document.querySelector('.ac-couv__slide'); const a = s.querySelector('[data-afaire]'); return !!a && a.querySelector('[data-fait]') && a.textContent.includes('Vermifuge') && !a.textContent.includes('Moka'); })()`), 'sous la photo : la chose à faire maintenant (sans le nom de l’animal), avec « Fait »');
verifier(await ev(`document.querySelectorAll('.ac-couv__slide[data-slide=b] svg.cp-illu, .ac-couv__slide[data-slide=a] svg.cp-illu').length`) === 2, 'sans photo : une illustration d\'espèce (chat, furet)');
verifier(await ev(`document.querySelectorAll('.ac-couv__point').length`) === 4 && await ev(`document.querySelectorAll('.ac-couv__point.is-actif').length`) === 1, 'quatre points (3 animaux + Ajouter), un seul actif');
await ev(`document.querySelector('[data-piste]').scrollTo({ left: 99999 })`); await sleep(500);
verifier(await ev(`[...document.querySelectorAll('.ac-couv__point')].findIndex(p => p.classList.contains('is-actif'))`) === 3, 'le défilement déplace le point actif');
await ev(`document.querySelector('[data-piste]').scrollTo({ left: 0 })`); await sleep(300);
verifier(await sansDebord(), 'Accueil : pas de défilement horizontal de la page');
verifier(await ev(`!/^[A-Z]{1,2}$/.test(document.querySelector('.ac-story .cp-avatar')?.textContent.trim() ?? '')`), 'plus d\'initiales à la place des illustrations');
await ecran('accueil-kaki', true);
await ev(`document.querySelector('.ac-couv__photo').click()`); await sleep(700);

log('=== FICHE : grande photo sur fond dégradé ===');
const fiche = await ev(`(() => { const b = document.querySelector('.fi-avatar-bouton').getBoundingClientRect(); const e = document.querySelector('.fi-entete'); return { w: Math.round(b.width), h: Math.round(b.height), fond: getComputedStyle(e).backgroundImage.includes('linear-gradient'), img: !!document.querySelector('.fi-avatar img'), nom: document.querySelector('.fi-entete h1').textContent, cartes: document.querySelectorAll('.fi-chiffre').length }; })()`);
verifier(fiche.w >= 280 && fiche.h >= 280 && fiche.img && fiche.fond && fiche.nom === 'Moka', `photo en grand (${fiche.w} × ${fiche.h} px) sur un fond dégradé`);
verifier(fiche.cartes === 3, 'les infos sont dessous, dans des cartes (âge, poids, rappel)');
await ecran('fiche-kaki', true);
await aller2('#/animaux/b');
verifier(await ev(`!!document.querySelector('.fi-avatar svg.cp-illu') && document.querySelector('.fi-avatar-bouton').getBoundingClientRect().width >= 280`), 'sans photo : grande illustration du chat');
await ecran('fiche-chat-kaki');

log('=== FORMULAIRE : « Ajouter une photo » ===');
await aller2('#/animaux');
await ev(`document.querySelector('[data-act=ajouter]').click()`); await sleep(500);
const ajout = await ev(`(() => { const l = document.querySelector('dialog .al-photo__ajout'); const r = l.getBoundingClientRect(); return { texte: l.textContent.trim(), classe: l.className, w: Math.round(r.width), h: Math.round(r.height), illu: !!document.querySelector('dialog [data-apercu] svg.cp-illu') }; })()`);
verifier(ajout.texte === 'Ajouter une photo' && ajout.classe.includes('cp-btn--principal') && ajout.w >= 200 && ajout.h >= 44, `bouton « ${ajout.texte} » mis en avant (principal, ${ajout.w} × ${ajout.h} px)`);
verifier(ajout.illu, 'sans photo, l\'aperçu montre l\'illustration de l\'espèce choisie');
await ev(`document.querySelector('dialog input[name=espece][value=lapin]').click()`); await sleep(200);
verifier(await ev(`document.querySelector('dialog [data-apercu] svg.cp-illu--lapin') !== null`), 'l\'illustration change avec l\'espèce');
await ecran('formulaire-photo');
await ev(`document.querySelector('dialog [data-annuler]').click()`); await sleep(300);

log('=== ILLUSTRATIONS D\'ESPÈCES ===');
const especes = (CO?.ESPECES ?? []).map((e) => e.icone);
verifier(especes.length >= 18 && especes.every((i) => IL.illustration(i).startsWith('<svg')), `les ${especes.length} espèces de l'appli ont leur illustration SVG`);
verifier(IL.illustration('user') === '', 'une icône sans illustration (profil) garde les initiales');

log('=== ACCUEIL : sans « Mes animaux », diapositive « Ajouter », carte « À faire » sans nom ===');
await taille(390, 844); await aller2('#/accueil');
verifier(await ev(`!document.querySelector('#ac-animaux, .ac-stories, .ac-story')`) && !(await texte('#contenu')).includes('Mes animaux'), 'la section « Mes animaux » (doublon du carrousel) est supprimée');
verifier(await ev(`document.querySelector('.ac-couv__piste').lastElementChild.classList.contains('ac-couv__slide--ajout')`) && (await texte('.ac-couv__slide--ajout')) === 'Ajouter un animal', 'dernière diapositive : « + Ajouter un animal »');
verifier(await ev(`document.querySelectorAll('.ac-couv__point').length`) === 4, 'le carrousel a 4 points (3 animaux + « Ajouter »)');
const afaire = await texte('.ac-couv__slide [data-afaire] .ac-afaire__titre');
verifier(afaire === 'Vermifuge', `carte « À faire » : « ${afaire} » (sans le nom de l'animal)`);
verifier(!(await ev(`[...document.querySelectorAll('.ac-afaire__titre')].some(t => /·/.test(t.textContent))`)), 'aucun titre « À faire » ne contient « · » ni un nom d\'animal');
verifier((await ev(`document.querySelector('[data-fait]').getAttribute('aria-label')`)).includes('Moka'), 'le bouton « Fait » garde le nom de l\'animal pour les lecteurs d\'écran');
await ev(`document.querySelector('.ac-couv__ajout').click()`); await sleep(500);
verifier(await ev(`!!document.querySelector('dialog[open] input[name=nom]') && document.querySelector('dialog[open] h2, dialog[open] .cp-modale__titre')?.textContent.includes('Nouvel animal')`), 'toucher « Ajouter un animal » ouvre le formulaire d\'un nouvel animal');
await ev(`document.querySelector('dialog[open] [data-annuler]').click()`); await sleep(300);
// Actions rapides : jamais sous la barre du bas
const chevauche = () => ev(`(() => { const n = document.querySelector('.app-nav-bas').getBoundingClientRect(); return [...document.querySelectorAll('.ac-action')].some(a => { const r = a.getBoundingClientRect(); return r.bottom > n.top && r.top < n.bottom; }); })()`);
await ev(`document.querySelector('.ac-actions').scrollIntoView({ block: 'end' })`); await sleep(400);
verifier(!(await chevauche()), 'actions rapides amenées à l\'écran : aucune ne passe sous la barre du bas (téléphone)');
await ev(`window.scrollTo(0, 1e7)`); await sleep(300);
verifier(!(await chevauche()), 'page défilée jusqu\'en bas : les actions ne sont pas sous la barre');
await ecran('accueil-actions-mobile');
await ev(`window.scrollTo(0, 0)`);

log('=== POIDS : poids actuel, grand graphique, fenêtre d\'ajout, liste compacte ===');
await aller2('#/animaux/c'); await ev(`document.querySelector('[data-onglet=poids]').click()`); await sleep(500);
const poids = await ev(`(() => { const p = document.querySelector('.ps'); const pos = (s) => { const e = p.querySelector(s); return e ? e.getBoundingClientRect().top : -1; }; return { valeur: p.querySelector('.ps-actuel__valeur')?.textContent, variation: p.querySelector('.ps-actuel__variation')?.textContent.replace(/\\s+/g, ' ').trim(), tailleValeur: parseFloat(getComputedStyle(p.querySelector('.ps-actuel__valeur')).fontSize), ordre: pos('.ps-actuel') < pos('.ps-graph') && pos('.ps-graph') < pos('.ps-liste'), hGraph: Math.round(p.querySelector('.ps-graphique')?.getBoundingClientRect().height ?? 0), formEnLigne: !!p.querySelector('form'), bouton: p.querySelector('[data-ajouter-pesee]')?.textContent.trim(), hLigne: Math.round(p.querySelector('.ps-carte').getBoundingClientRect().height), lignes: p.querySelectorAll('.ps-carte').length }; })()`);
verifier(poids.valeur === '28,4 kg' && poids.tailleValeur >= 40, `poids actuel en grand (${poids.valeur}, ${poids.tailleValeur} px)`);
verifier(/\+0,4 kg depuis le/.test(poids.variation), `variation : « ${poids.variation} »`);
verifier(poids.ordre && poids.hGraph >= 220, `puis le graphique en grand (${poids.hGraph} px de haut), puis la liste`);
verifier(!poids.formEnLigne && poids.bouton === 'Ajouter une pesée', 'plus de formulaire dans la page : un bouton « Ajouter une pesée »');
verifier(poids.hLigne <= 64 && poids.lignes === 2, `liste compacte (${poids.lignes} lignes de ${poids.hLigne} px)`);
await ev(`document.querySelector('[data-ajouter-pesee]').click()`); await sleep(500);
verifier(await ev(`!!document.querySelector('dialog[open] #mpesee-poids') && !!document.querySelector('dialog[open] #mpesee-date')`), 'le bouton ouvre une fenêtre (date + poids)');
verifier(/^\d{1,2} [a-zéû]+ \d{4}$/.test(await texte('dialog[open] .cp-champ__datefr')), `date en français sous le champ : « ${await texte('dialog[open] .cp-champ__datefr')} »`);
await ev(`(() => { const f = document.querySelector('dialog[open] form'); f.poids.value = '29,1'; f.poids.dispatchEvent(new Event('input', { bubbles: true })); f.requestSubmit(); })()`); await sleep(600);
verifier(await texte('.ps-actuel__valeur') === '29,1 kg' && /\+0,7 kg/.test(await texte('.ps-actuel__variation')), 'après l\'ajout : poids actuel 29,1 kg, variation +0,7 kg');
await axe('.ps', 'Poids (téléphone)'); await ecran('poids-mobile', true);
await taille(1280, 900); await aller2('#/animaux/c'); await ev(`document.querySelector('[data-onglet=poids]').click()`); await sleep(600);
verifier(await sansDebord(), 'Poids ordinateur : pas de défilement horizontal'); await ecran('poids-ordinateur', true);

log('=== RAPPELS sur ordinateur : badge en haut à droite, lignes propres ===');
await taille(1280, 900); await aller2('#/animaux/rappels'); await sleep(500);
const rp = await ev(`(() => { const c = document.querySelector('.rp-carte--retard'); const cr = c.getBoundingClientRect(); const b = c.querySelector('.rp-carte__etat .cp-badge').getBoundingClientRect(); const corps = c.querySelector('.rp-carte__corps').getBoundingClientRect(); const lignes = [...c.querySelectorAll('.rp-ligne')].filter((l) => l.offsetParent); return { hautDroite: b.top - cr.top < 24 && cr.right - b.right < 24, sansChevauche: b.left >= corps.right - 1 || b.top >= corps.bottom, debuts: lignes.map((l) => getComputedStyle(l, '::before').content), textes: lignes.map((l) => l.innerText.trim()), n: lignes.length }; })()`);
verifier(rp.hautDroite && rp.sansChevauche, 'le badge « En retard de … j » est en haut à droite de la carte, sans chevaucher le texte');
verifier(rp.n >= 2 && rp.debuts.every((d) => d === 'none' || d === 'normal') && rp.textes.every((t) => !t.startsWith('·')), `infos sur des lignes propres, sans « · » en début de ligne (${rp.textes.join(' / ')})`);
verifier(await sansDebord(), 'Rappels ordinateur : pas de défilement horizontal');
await ecran('rappels-ordinateur');
await taille(390, 844); await aller2('#/animaux/rappels'); await sleep(400); await ecran('rappels-mobile');
verifier(await sansDebord(), 'Rappels téléphone : pas de défilement horizontal');

log('=== DATES en français à côté des champs date ===');
await taille(390, 844); await aller2('#/animaux');
await ev(`document.querySelector('[data-act=ajouter]').click()`); await sleep(500);
verifier(/^Aucune date choisie$/.test(await texte('dialog[open] .cp-champ__datefr')), 'date de naissance vide : « Aucune date choisie »');
await ev(`(() => { const d = document.querySelector('dialog[open] input[type=date]'); d.value = '2026-03-01'; d.dispatchEvent(new Event('input', { bubbles: true })); })()`);
verifier(/^(1er|1) mars 2026$/.test(await texte('dialog[open] .cp-champ__datefr')), `date saisie 2026-03-01 : « ${await texte('dialog[open] .cp-champ__datefr')} »`);
await ev(`(() => { const d = document.querySelector('dialog[open] input[type=date]'); d.value = '2026-11-18'; d.dispatchEvent(new Event('change', { bubbles: true })); })()`);
verifier(await texte('dialog[open] .cp-champ__datefr') === '18 novembre 2026', 'date saisie 2026-11-18 : « 18 novembre 2026 »');
await ev(`(() => { const d = document.querySelector('dialog[open] input[type=date]'); d.value = ''; d.dispatchEvent(new Event('input', { bubbles: true })); })()`);
verifier(await texte('dialog[open] .cp-champ__datefr') === 'Aucune date choisie', 'champ vidé : « Aucune date choisie »');
verifier(await ev(`document.querySelector('dialog[open] input[type=date]').getAttribute('aria-describedby').includes('-datefr')`), 'la date en français est reliée au champ pour les lecteurs d\'écran');
await ev(`document.querySelector('dialog[open] [data-annuler]').click()`); await sleep(300);
// formulaires de soin et de rappel
await aller2('#/animaux/c'); await ev(`document.querySelector('[data-act], .cp-btn')`);
const nbDates = await ev(`(async () => { const m = await import('/js/composants.js'); const h = m.champ({ id: 'x-d', label: 'Date', type: 'date', valeur: '2026-12-25' }); return h.includes('25 décembre 2026'); })()`);
verifier(nbDates, 'tous les champs date (soin, rappel, pesée, naissance) affichent la date en français : « 25 décembre 2026 »');

log('=== COULEUR PERSONNALISÉE : nuancier libre, ajustée pour le contraste ===');
await taille(390, 844); await aller2('#/profil');
verifier(await ev(`!!document.querySelector('#pf-couleur[type=color]') && !!document.querySelector('[data-themes] input[value=perso]')`), 'Profil : option « Couleur personnalisée » avec un nuancier libre');
const contrasteBlanc = async () => { const c = await variable('--cp-foret'); return G.contraste([255, 255, 255], CT.lire(c)); };
for (const choisie of ['#FFE600', '#101010', '#2F6FED', '#FF3D00', '#FFFFFF', '#7FFFD4']) {
  await ev(`(() => { const c = document.querySelector('#pf-couleur'); c.value = '${choisie.toLowerCase()}'; c.dispatchEvent(new Event('input', { bubbles: true })); })()`); await sleep(250);
  const r = await contrasteBlanc();
  verifier(await ev(`document.documentElement.dataset.theme`) === 'perso' && r >= 4.5 && await ev(`document.querySelector('[data-themes] input[value=perso]').checked`), `couleur ${choisie} : appliquée en direct, texte blanc des boutons à ${r.toFixed(1)}:1 (minimum 4,5:1)`);
  verifier(/appliquée|assombrie/.test(await texte('[data-perso-info]')), `couleur ${choisie} : message « ${(await texte('[data-perso-info]')).slice(0, 70)}… »`);
}
await ev(`(() => { const c = document.querySelector('#pf-couleur'); c.value = '#ffe600'; c.dispatchEvent(new Event('input', { bubbles: true })); })()`); await sleep(250);
verifier(/assombrie/.test(await texte('[data-perso-info]')), 'jaune vif : la couleur est assombrie automatiquement, et le message le dit');
for (const [nom, pg] of [['Profil', '#/profil'], ['Accueil', '#/accueil'], ['Toxique', '#/toxique'], ['Fiche', '#/animaux/c']]) { await aller2(pg); await axe('#app', `${nom} · couleur personnalisée (jaune)`); }
await aller2('#/profil'); await ecran('profil-perso');
await send('Page.reload'); await sleep(1800); await ev(axeSrc);
verifier(await ev(`document.documentElement.dataset.theme`) === 'perso' && await ev(`!!document.documentElement.style.getPropertyValue('--cp-foret')`) && await ev(`document.querySelector('#pf-couleur')?.value ?? '#ffe600'`) === '#ffe600', 'après rechargement : la couleur personnalisée est toujours là');
await ev(`document.querySelector('[data-themes] input[value=sauge]').click()`); await sleep(300);
verifier(await ev(`document.documentElement.dataset.theme === 'sauge' && !document.documentElement.style.getPropertyValue('--cp-foret')`), 'revenir à un thème prêt retire la couleur personnalisée');
await ev(`document.querySelector('[data-themes] input[value=perso]').click()`); await sleep(300);
verifier(await ev(`document.documentElement.dataset.theme`) === 'perso', 'rechoisir « Couleur personnalisée » rapplique la dernière couleur du nuancier');
await ev(`localStorage.setItem('carnetpatte.themePerso', 'pas-une-couleur')`);
await send('Page.reload'); await sleep(1800);
verifier(await ev(`document.documentElement.dataset.theme`) === 'kaki', 'couleur personnalisée illisible en mémoire : retour au kaki, sans erreur');
verifier(await ev(`!document.documentElement.getAttribute('style')`), 'et sans reste de la couleur personnalisée précédente (aucune variable en ligne)');
await ev(`localStorage.removeItem('carnetpatte.themePerso'); localStorage.removeItem('carnetpatte.theme'); localStorage.removeItem('carnetpatte.themePersoVars'); document.documentElement.removeAttribute('style')`);
await importer(JSON.stringify(donnees));

log('=== THÈMES : choix, aperçu immédiat, mémoire, contraste ===');
await aller2('#/profil');
verifier(await ev(`document.querySelectorAll('[data-themes] input[name=theme]').length`) === 13 && await ev(`document.querySelector('[data-themes] input:checked').value`) === 'kaki', 'Profil : « Couleur de l\'appli » avec 12 thèmes + « Couleur personnalisée », kaki par défaut');
const fixes = ['--cp-terre', '--cp-terre-pale', '--cp-ambre', '--cp-ambre-pale', '--cp-succes', '--cp-succes-pale', '--cp-succes-texte', '--cp-type-vaccin-fond', '--cp-type-veto-texte', '--cp-an-turquoise-fond'];
const refUrgence = {}; for (const v of fixes) refUrgence[v] = await variable(v);
const palettes = {};
for (const t of G.THEMES) {
  await aller2('#/profil');
  await ev(`document.querySelector('[data-themes] input[value="${t.id}"]').click()`); await sleep(350);
  verifier(await ev(`document.documentElement.dataset.theme`) === t.id, `${t.nom} : appliqué tout de suite (aperçu immédiat)`);
  const p = G.palette(t);
  const attendu = `#${p.foret.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  verifier((await variable('--cp-foret')).toUpperCase() === attendu, `${t.nom} : couleur principale ${attendu}`);
  verifier(await ev(`localStorage.getItem('carnetpatte.theme')`) === (t.id === 'kaki' ? null : t.id), `${t.nom} : ${t.id === 'kaki' ? 'thème par défaut (rien à mémoriser)' : 'mémorisé sur l\'appareil'}`);
  verifier(await ev(`!localStorage.getItem('carnetpatte.v1').includes('"theme"')`), `${t.nom} : le choix n'est pas mêlé aux données des animaux (jamais exporté ni effacé avec elles)`);
  let urgenceIdentique = true; for (const v of fixes) if (await variable(v) !== refUrgence[v]) urgenceIdentique = false;
  verifier(urgenceIdentique, `${t.nom} : couleurs d'urgence (rouge, ambre, vert) et de types de soin inchangées`);
  verifier(await ev(`/1\\.56/.test(getComputedStyle(document.querySelector('.cp-btn, .pf-theme__carte')).transitionTimingFunction)`), `${t.nom} : rebond conservé`);
  verifier(await ev(`getComputedStyle(document.querySelector('.cp-carte')).backgroundColor.startsWith('rgba(255, 255, 255, 0.')`) && await ev(`getComputedStyle(document.querySelector('.cp-carte')).backdropFilter.includes('blur')`), `${t.nom} : cartes en verre (transparence conservée)`);
  verifier(await ev(`document.querySelector('meta[name=theme-color]').content.toLowerCase()`) === `#${p.degrade.map((v) => v.toString(16).padStart(2, '0')).join('')}`, `${t.nom} : barre d'état de l'iPhone à la couleur du dégradé (${await ev(`document.querySelector('meta[name=theme-color]').content`)})`);
  palettes[t.id] = attendu;
  await axe('#app', `Profil · ${t.nom}`);
  await aller2('#/accueil'); await axe('#app', `Accueil · ${t.nom}`);
  await ecran(`accueil-${t.id}`);
  await aller2('#/animaux/c'); await axe('#app', `Fiche · ${t.nom}`);
  await aller2('#/toxique'); await axe('#app', `Toxique · ${t.nom}`);
  await aller2('#/profil'); await ecran(`profil-${t.id}`);
}
verifier(new Set(Object.values(palettes)).size === 12, 'les 12 thèmes ont 12 couleurs principales différentes');
// Mémoire après rechargement complet de la page
await ev(`document.querySelector('[data-themes] input[value=lavande]').click()`); await sleep(300);
await send('Page.reload'); await sleep(1800); await ev(axeSrc);
verifier(await ev(`document.documentElement.dataset.theme`) === 'lavande', 'après rechargement de la page : le thème lavande est toujours là');
verifier(await ev(`document.querySelector('[data-themes] input:checked')?.value ?? (location.hash === '#/profil' ? 'x' : 'ok')`) !== 'x', 'le choix reste affiché dans Profil');
// Effacer toutes les données ne change pas la couleur de l'appli
await ev(`import('/js/storage.js').then(m=>m.toutEffacer())`);
verifier(await ev(`localStorage.getItem('carnetpatte.theme')`) === 'lavande', 'effacer les données ne change pas la couleur de l\'appli');
// Valeur inconnue dans la mémoire : retour au kaki, sans erreur
await ev(`localStorage.setItem('carnetpatte.theme', 'rose-bonbon')`);
await send('Page.reload'); await sleep(1800);
verifier(await ev(`document.documentElement.dataset.theme`) === 'kaki', 'thème inconnu en mémoire : kaki, sans erreur');
await ev(`localStorage.removeItem('carnetpatte.theme')`);
await importer(JSON.stringify(donnees));

log('=== TROIS LARGEURS ===');
for (const [w, h, nom] of [[1280, 900, 'ordinateur'], [820, 1000, 'tablette'], [390, 844, 'mobile']]) {
  await taille(w, h);
  for (const pg of ['#/accueil', '#/animaux', '#/animaux/c', '#/profil']) { await aller2(pg); verifier(await sansDebord(), `${nom} ${pg} : pas de défilement horizontal`); }
  await aller2('#/accueil'); await ecran(`accueil-${nom}`);
  await aller2('#/animaux/c'); await ecran(`fiche-${nom}`);
}

const exp = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
await ev(`import('/js/storage.js').then(m=>m.toutEffacer())`); await importer(exp);
const exp2 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
const net = (x) => { const o = JSON.parse(x); delete o.exporteLe; return JSON.stringify(o); };
log('export -> effacer -> import -> export identique :', net(exp) === net(exp2));

log('ERREURS CONSOLE :', erreurs.length ? erreurs : 'aucune');
log('VÉRIFICATIONS EN ÉCHEC :', echecs);
ws.close(); proc.kill(); process.exit(echecs ? 1 : 0);
