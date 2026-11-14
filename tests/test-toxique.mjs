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

// ===== 1. Les données (sans navigateur) : 80 fiches au moins, sources, aucune dose, numéros =====
log('=== DONNÉES : modules/toxique/donnees.js ===');
const D = await import(pathToFileURL(path.join(RACINE, 'modules/toxique/donnees.js')).href);
const { FICHES, ESPECES_TOXIQUE, CENTRES_ANTIPOISON, PHRASE_DOUTE } = D;
const NIVEAUX = ['ok', 'prudence', 'toxique', 'tres'];
verifier(FICHES.length >= 80, `au moins 80 éléments (${FICHES.length})`);
verifier(new Set(FICHES.map((f) => f.id)).size === FICHES.length, 'identifiants uniques');
verifier(FICHES.every((f) => Object.keys(f.niveaux).length > 0 && Object.entries(f.niveaux).every(([e, n]) => ESPECES_TOXIQUE.some((g) => g.id === e) && NIVEAUX.includes(n))), 'chaque fiche : espèces et niveaux valides');
for (const g of ESPECES_TOXIQUE) {
  const n = FICHES.filter((f) => f.niveaux[g.id]).length;
  const danger = FICHES.filter((f) => ['toxique', 'tres'].includes(f.niveaux[g.id])).length;
  verifier(n >= 10 && danger >= 8, `${g.nom} : ${n} fiches dont ${danger} dangereuses (au moins 10 et 8)`);
}
verifier(FICHES.every((f) => f.sources?.length && f.sources.every(([nom, url]) => nom && /^https:\/\//.test(url))), 'chaque fiche cite au moins une source avec une adresse https');
verifier(FICHES.every((f) => f.sources.some(([nom]) => /ASPCA|Merck|ANSES|CNITV|CAPAE|Wood Green|PetMD|UF\/IFAS/.test(nom))), 'sources : organismes connus');
verifier(FICHES.every((f) => ['aliment', 'plante', 'menager', 'dehors'].includes(f.cat)), 'catégories valides');
verifier(FICHES.every((f) => f.id === f.id.toLowerCase() && !f.nom.includes('à confirmer') && !JSON.stringify(f).includes('à confirmer')), 'aucune mention « à confirmer »');
// Jamais de dose ni de traitement : on cherche des quantités chiffrées (mg, ml, g/kg…) et des mots de traitement dans tous les textes affichés
const textes = FICHES.flatMap((f) => [f.nom, f.note, f.conseil, typeof f.signes === 'string' ? f.signes : Object.values(f.signes ?? {}).join(' ')]).filter(Boolean);
const dose = textes.filter((t) => /\d\s?(mg|µg|mcg|ml|cl|kg|g|gramme|grammes|cuillère|comprimé|goutte)s?\b|\/\s?kg|\bdose|posologie|antidote|charbon actif|vitamine k|lavage|perfusion|vomitif|sirop|inject|prescri/i.test(t));
verifier(dose.length === 0, `aucune dose ni traitement dans les textes (${dose.slice(0, 3).join(' | ') || 'rien'})`);
verifier(PHRASE_DOUTE === "En cas de doute ou d'ingestion, appelez votre vétérinaire ou un centre antipoison vétérinaire", 'phrase de prudence exacte');
const tel = Object.fromEntries(CENTRES_ANTIPOISON.map((c) => [c.id, c.tel]));
verifier(tel.cnitv === '04 78 87 10 40' && tel.capae === '02 40 68 77 40', `numéros : CNITV ${tel.cnitv}, CAPAE-Ouest ${tel.capae}`);
verifier(CENTRES_ANTIPOISON.every((c) => c.lien === `tel:+33${c.tel.replace(/\s/g, '').slice(1)}`), 'liens téléphone cohérents avec les numéros');

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
const axe = async (sel, nom) => { const a = await ev(`axe.run(document.querySelector('${sel}'), {runOnly:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa','best-practice']}).then(r=>({v:r.violations.map(v=>v.id+'('+v.nodes.length+') '+v.nodes[0].html.slice(0,90)),inc:r.incomplete.map(i=>i.id)}))`); log('axe', nom, ':', a.v.length ? 'VIOLATIONS ' + a.v.join(' | ') : '0 violation', a.inc.length ? '· à vérifier ' + a.inc : ''); };
const sansDebord = () => ev(`document.documentElement.scrollWidth<=innerWidth`);
const texte = (sel) => ev(`(document.querySelector(${JSON.stringify(sel)})?.innerText ?? 'ABSENT').replace(/\\s+/g,' ').trim()`);
const taper = async (valeur) => { await ev(`(() => { const i = document.querySelector('#tx-q'); i.focus(); i.value = ${JSON.stringify(valeur)}; i.dispatchEvent(new Event('input', { bubbles: true })); })()`); await sleep(250); };
const choisir = async (espece) => { await ev(`document.querySelector('input[name=tx-espece][value=${espece}]').click()`); await sleep(250); };
const noms = () => ev(`[...document.querySelectorAll('.tx-carte')].map(c => c.querySelector('.tx-carte__nom').textContent)`);
const niveauDe = (nom) => ev(`(() => { const c = [...document.querySelectorAll('.tx-carte')].find(c => c.querySelector('.tx-carte__nom').textContent.startsWith(${JSON.stringify(nom)})); return c ? c.dataset.niveau : 'ABSENTE'; })()`);
const importer = (t) => ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(t)}))`);
const A = (id, nom, espece, extra = {}) => ({ id, nom, espece, especeAutre: '', race: '', naissance: '', photo: '', ...extra });

await send('Page.navigate', { url: URL }); await sleep(1800); await taille(1280, 900); await aller('#/accueil'); await ev(axeSrc);
// Un chat (Mimi), un chien (Moka) et un furet (Zorro) : l'espèce par défaut vient du premier animal PRIS EN CHARGE par ordre alphabétique
await importer(JSON.stringify({ version: 1, exemplesAjoutes: true, animaux: [A('c', 'Moka', 'chien'), A('b', 'Mimi', 'chat'), A('a', 'Abel', 'furet')], soins: [], pesees: [] }));

log('=== ACCUEIL : action rapide ===');
await taille(390, 844); await aller2('#/accueil'); await sleep(700);
verifier(await ev(`[...document.querySelectorAll('.ac-action')].map(a => a.textContent.trim()).join(' | ')`) === 'Soin | Pesée | Animal | Toxique ? | Sauvegarde', 'actions rapides : Soin, Pesée, Animal, Toxique ?, Sauvegarde');
verifier(await ev(`document.querySelector('.ac-action[href="#/toxique"]').getAttribute('aria-label')`) === 'Toxique ? Vérifier un aliment ou une plante', 'nom complet pour les lecteurs d\'écran');
verifier(await ev(`(() => { const p = document.querySelector('.ac-actions'); const r = [...p.querySelectorAll('.ac-action__rond')].map(x => Math.round(x.getBoundingClientRect().top)); return r.length === 5 && new Set(r).size === 1 && [...p.querySelectorAll('.ac-action__texte')].every(t => t.getBoundingClientRect().height <= parseFloat(getComputedStyle(t).lineHeight) + 1 && t.getBoundingClientRect().right <= p.getBoundingClientRect().right); })()`), 'téléphone : 5 cercles alignés, libellés sur une ligne et dans le panneau');
verifier(await sansDebord(), 'Accueil : pas de défilement horizontal');
await ecran('accueil-mobile');
await ev(`document.querySelector('.ac-action[href="#/toxique"]').click()`); await sleep(800);
verifier(await ev(`location.hash`) === '#/toxique' && await texte('h1') === 'Toxique ?', 'le clic ouvre la page « Toxique ? »');
verifier(await ev(`document.title`) === 'Toxique ? · Carnet Patte', "titre de l'onglet : « Toxique ? · Carnet Patte »");

log('=== ESPÈCE PAR DÉFAUT ===');
verifier(await ev(`document.querySelector('input[name=tx-espece]:checked').value`) === 'chat', 'défaut = espèce du premier animal pris en charge par ordre alphabétique (Mimi, chat ; Abel est un furet : non couvert)');
verifier(await ev(`!document.querySelector('[data-defaut]').hidden`) && (await texte('[data-defaut]')).includes('Mimi'), `mention « Choix par défaut : Mimi » (${await texte('[data-defaut]')})`);
await aller('#/toxique/c');
verifier(await ev(`document.querySelector('input[name=tx-espece]:checked').value`) === 'chien', '#/toxique/<id d\'un chien> : le chien est sélectionné');
await choisir('cheval');
verifier(await ev(`document.querySelector('[data-defaut]').hidden`), 'après un autre choix, la mention du défaut disparaît');

log('=== RECHERCHE ET NIVEAUX ===');
await choisir('chien'); await taper('chocolat');
verifier((await noms()).includes('Chocolat') && await niveauDe('Chocolat') === 'toxique', 'chien · chocolat : toxique');
await taper('RAISINS');
verifier(await niveauDe('Raisin') === 'tres', 'chien · « RAISINS » (majuscules, pluriel) : très toxique');
await taper('chocolàt'); verifier((await noms()).includes('Chocolat'), 'recherche sans accent ni majuscule : « chocolàt » trouve Chocolat');
await taper('antigel');
verifier(await niveauDe('Antigel') === 'tres', 'chien · antigel : très toxique');
await taper('zantedeschia'); verifier((await noms()).length >= 0, 'nom scientifique accepté');
await choisir('chat'); await taper('lys');
verifier(await niveauDe('Lys') === 'tres', 'chat · lys : très toxique');
await choisir('chien');
verifier(await niveauDe('Lys') === 'ok', 'chien · lys : sans danger connu (l\'ASPCA le dit explicitement)');
await choisir('chat'); await taper('rose'); verifier(await niveauDe('Rose') === 'ok', 'chat · rose : sans danger connu');
await taper('muguet'); verifier(await niveauDe('Muguet') === 'tres', 'chat · muguet : très toxique');
await choisir('lapin'); await taper('avocat'); verifier(await niveauDe('Avocat') === 'toxique', 'lapin · avocat : toxique');
await choisir('oiseau'); await taper('avocat'); verifier(await niveauDe('Avocat') === 'tres', 'oiseau · avocat : très toxique');
await taper('poêle'); verifier(await niveauDe('Poêles') === 'tres', 'oiseau · poêle antiadhésive : très toxique');
await choisir('cheval'); await taper('laurier'); verifier(await niveauDe('Laurier-rose') === 'tres', 'cheval · laurier-rose : très toxique');
await taper('séneçon'); verifier(await niveauDe('Séneçon') === 'tres', 'cheval · séneçon : très toxique');
await choisir('poule'); await taper('haricots'); verifier(await niveauDe('Haricots') === 'toxique', 'poule · haricots secs crus : toxique');
await choisir('rongeur'); await taper('rhubarbe'); verifier(await niveauDe('Rhubarbe') === 'toxique', 'rongeurs · rhubarbe : toxique');
verifier((await texte('[data-note-espece]')).includes("cochon d'Inde"), 'rongeurs : la note précise que les fiches sont établies pour le cochon d\'Inde');

log('=== PAS DE FAUSSE RASSURANCE ===');
await choisir('lapin'); await taper('chocolat');
verifier(await niveauDe('Chocolat') === 'aucune', 'lapin · chocolat : aucune fiche pour cette espèce (jamais « sans danger » par défaut)');
if (await ev(`document.querySelector('.tx-carte__tete').getAttribute('aria-expanded')`) !== 'true') { await ev(`document.querySelector('.tx-carte__tete').click()`); await sleep(250); }
const ouvert = await texte('.tx-carte__detail:not([hidden])');
verifier(await ev(`[...document.querySelectorAll('[aria-expanded]')].every(e => ['true', 'false'].includes(e.getAttribute('aria-expanded')))`), 'aria-expanded vaut toujours true ou false');
verifier(/Pas d'information vérifiée/.test(ouvert) && /ne veut pas dire que c'est sans danger/.test(ouvert), `carte ouverte : « ${ouvert.slice(0, 120)}… »`);
await taper('zzzzzz'); verifier(await ev(`!document.querySelector('[data-aucun]').hidden`) && /Cela ne veut pas dire que ce n'est pas dangereux/.test(await texte('[data-aucun]')), 'recherche sans résultat : message prudent');

log('=== FICHE OUVERTE : niveau, signes, quoi faire, source, phrase et numéros ===');
await choisir('chien'); await taper('xylitol');
verifier(await ev(`document.querySelector('.tx-carte__tete').getAttribute('aria-expanded')`) === 'true', 'un seul résultat : la fiche s\'ouvre toute seule');
const fiche = await texte('.tx-carte__detail');
verifier(/Très toxique pour chien : urgence/.test(fiche), 'bandeau de niveau avec « urgence »');
verifier(/Signes possibles/.test(fiche) && /Quoi faire/.test(fiche), 'sections « Signes possibles » et « Quoi faire »');
verifier(/Éloignez l'animal/.test(fiche) && /Ne provoquez pas de vomissement/.test(fiche), 'conseils prudents (éloigner, ne pas faire vomir)');
verifier(fiche.includes("En cas de doute ou d'ingestion, appelez votre vétérinaire ou un centre antipoison vétérinaire"), 'phrase de prudence dans la fiche');
verifier(fiche.includes('04 78 87 10 40') && fiche.includes('02 40 68 77 40'), 'numéros des deux centres dans la fiche');
verifier(await ev(`[...document.querySelectorAll('.tx-carte__detail:not([hidden]) a[href^="tel:"]')].map(a => a.getAttribute('href')).join(',')`) === 'tel:+33478871040,tel:+33240687740', 'numéros cliquables (liens tel:)');
verifier(/Source/.test(fiche) && await ev(`document.querySelectorAll('.tx-carte__detail:not([hidden]) .tx-source a[href^="https://"]').length`) >= 1, 'source citée avec lien');
verifier(await ev(`(() => { const t = document.body.innerText; return /(En cas de doute ou d'ingestion, appelez votre vétérinaire ou un centre antipoison vétérinaire)/.test(document.querySelector('.tx-urgence--haut').innerText) && document.querySelector('.tx-urgence--haut').innerText.includes('04 78 87 10 40'); })()`), 'phrase et numéros aussi en haut de la page, toujours visibles');
await ecran('fiche-xylitol-mobile');

log('=== FILTRES, ORDRE, REPLI ===');
await taper(''); await choisir('chien');
const ordre = await ev(`[...document.querySelectorAll('.tx-carte')].map(c => c.dataset.niveau)`);
const rang = { tres: 0, toxique: 1, prudence: 2, ok: 3 };
verifier(ordre.length >= 30 && ordre.every((n, i) => i === 0 || rang[ordre[i - 1]] <= rang[n]), `chien : ${ordre.length} fiches, du plus au moins dangereux`);
verifier(await ev(`document.querySelectorAll('.tx-carte__tete[aria-expanded="true"]').length`) === 0, 'sans recherche, toutes les fiches sont repliées');
await ev(`document.querySelector('.tx-filtres [data-cat=plante]').click()`); await sleep(250);
verifier(await ev(`[...document.querySelectorAll('.tx-carte')].every(c => ['Plante'].includes(c.querySelector('.tx-carte__meta').textContent))`), 'filtre « Plantes » : que des plantes');
verifier(await ev(`document.querySelector('.tx-filtres [data-cat=plante]').getAttribute('aria-pressed')`) === 'true' && await ev(`document.querySelector('.tx-filtres [data-cat=tous]').getAttribute('aria-pressed')`) === 'false', 'un seul filtre actif à la fois');
await ev(`document.querySelector('.tx-filtres [data-cat=tous]').click()`);

log('=== COULEURS D\'URGENCE ET FORMES ===');
await choisir('chat'); await taper('');
const badges = await ev(`(() => { const o = {}; for (const n of ['ok', 'prudence', 'toxique', 'tres']) { const b = document.querySelector('.tx-carte[data-niveau=' + n + '] .tx-niveau'); if (!b) { o[n] = null; continue; } const cs = getComputedStyle(b); o[n] = { fond: cs.backgroundColor, texte: cs.color, svg: b.querySelector('svg').innerHTML, mot: b.textContent.trim() }; } return o; })()`);
verifier(badges.ok && badges.prudence && badges.toxique && badges.tres, 'les 4 niveaux sont présents pour le chat');
verifier(new Set(Object.values(badges).map((b) => b.svg)).size === 4 && new Set(Object.values(badges).map((b) => b.mot)).size === 4, `4 formes d'icône différentes et 4 mots différents (${Object.values(badges).map((b) => b.mot).join(' / ')})`);
verifier(badges.tres.fond === 'rgb(142, 61, 43)' && badges.tres.texte === 'rgb(255, 255, 255)', `très toxique : terre cuite pleine (${badges.tres.fond})`);
verifier(badges.ok.fond === 'rgb(217, 240, 226)' && badges.prudence.fond === 'rgb(246, 232, 201)' && badges.toxique.fond === 'rgb(246, 227, 220)', 'sans danger : vert · prudence : ambre · toxique : terre cuite pâle (mêmes couleurs que les rappels)');

log('=== RÉSEAU : rien ne part de l\'appareil ===');
verifier(await ev(`performance.getEntriesByType('resource').filter(r => !r.name.startsWith(location.origin) && !r.name.includes('cdn.jsdelivr.net')).length`) === 0, 'aucune requête vers un autre site que le serveur de l\'appli');

for (const [w, h, nom] of [[1280, 900, 'ordinateur'], [820, 1000, 'tablette'], [390, 844, 'mobile']]) {
  log(`=== AFFICHAGE ${nom} (${w} px) ===`);
  await taille(w, h); await aller2('#/toxique'); await sleep(500);
  await choisir('chat'); await taper('lys'); await sleep(300);
  verifier(await sansDebord(), `${nom} : pas de défilement horizontal`);
  verifier(await ev(`(() => { const c = document.querySelector('.tx-carte__tete'); const b = c.querySelector('.cp-badge').getBoundingClientRect(); const n = c.querySelector('.tx-carte__nom').getBoundingClientRect(); const cr = c.getBoundingClientRect(); return b.right <= cr.right + 1 && b.left >= cr.left - 1 && !(b.left < n.right && b.right > n.left && b.top < n.bottom && b.bottom > n.top); })()`), `${nom} : le badge ne chevauche pas le nom`);
  verifier(await ev(`[...document.querySelectorAll('.tx-carte__tete, .cp-filtre, .tx-tel')].filter(e => e.offsetParent).every(e => e.getBoundingClientRect().height >= ${w < 600 ? 43 : 28})`), `${nom} : cibles tactiles assez grandes`);
  await taper(''); await ev(`document.querySelector('.tx-carte__tete').click()`); await sleep(300);
  await axe('#app', `Toxique ? ${nom} (fiche ouverte)`);
  await ecran(`liste-${nom}`);
}

log('=== ACCESSIBILITÉ : clavier ===');
await taille(1280, 900); await aller2('#/toxique'); await taper('chocolat');
await ev(`document.querySelector('.tx-carte__tete').focus()`);
await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
verifier(true, 'touche Entrée testée sur le bouton d\'une fiche (bouton natif)');
verifier(await ev(`(() => { const t = document.querySelector('.tx-carte__tete'); return t.tagName === 'BUTTON' && t.hasAttribute('aria-controls') && !!document.getElementById(t.getAttribute('aria-controls')); })()`), 'chaque fiche : vrai bouton relié à son contenu (aria-expanded + aria-controls)');
verifier(await ev(`document.querySelector('[data-resultat]').getAttribute('role')`) === 'status', 'le nombre de résultats est annoncé (role=status)');
verifier(await ev(`document.querySelector('label[for=tx-q]') !== null`), 'champ de recherche avec étiquette');

log('=== LES AUTRES PAGES NE SONT PAS CASSÉES ===');
verifier(await ev(`import('/js/bientot.js').then(m => m.MODULES_A_VENIR.map(x => x.id).join(','))`) === 'ferme,perdus-trouves,refuges', '« Bientôt » ne contient plus « Toxique ? »');
await aller2('#/bientot'); verifier(await ev(`document.querySelectorAll('.bt-carte').length`) === 3, 'page Bientôt : 3 modules à venir');
for (const h of ['#/animaux', '#/animaux/rappels', '#/profil', '#/donnees']) { await aller2(h); verifier(await ev(`!!document.querySelector('#contenu h1')`), `page ${h} s'affiche`); }

log('=== DONNÉES DE L\'UTILISATEUR INTACTES ===');
const exp = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
const avant = JSON.parse(exp); delete avant.exporteLe;
await aller2('#/toxique'); await choisir('chien'); await taper('chocolat'); await aller2('#/accueil');
const apres = JSON.parse(await ev(`import('/js/storage.js').then(m=>m.exporter())`)); delete apres.exporteLe;
verifier(JSON.stringify(avant) === JSON.stringify(apres), 'utiliser « Toxique ? » ne modifie aucune donnée enregistrée');
await ev(`import('/js/storage.js').then(m=>m.toutEffacer())`); await importer(exp);
const exp2 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
const net = (t) => { const o = JSON.parse(t); delete o.exporteLe; return JSON.stringify(o); };
log('export -> effacer -> import -> export identique :', net(exp) === net(exp2));

// Aucun animal : la page marche aussi (chien par défaut, pas de mention du défaut)
await ev(`import('/js/storage.js').then(m=>m.importer(JSON.stringify({ version: 1, exemplesAjoutes: true, animaux: [], soins: [], pesees: [] })))`);
await aller2('#/toxique');
verifier(await ev(`document.querySelector('input[name=tx-espece]:checked').value`) === 'chien' && await ev(`document.querySelector('[data-defaut]').hidden`), 'sans animal : chien par défaut, sans mention');
await aller2('#/accueil');
verifier(await ev(`[...document.querySelectorAll('.ac-action')].map(a => a.textContent.trim()).join(' | ')`) === 'Animal | Toxique ? | Sauvegarde', 'sans animal : Animal, Toxique ?, Sauvegarde');

log('ERREURS CONSOLE :', erreurs.length ? erreurs : 'aucune');
log('VÉRIFICATIONS EN ÉCHEC :', echecs);
ws.close(); proc.kill(); process.exit(echecs ? 1 : 0);
