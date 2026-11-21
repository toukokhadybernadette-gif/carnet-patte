// Test « boutique » : la sélection Carnet Patte (liens vers des sites marchands) : données, filtres, aucun produit médical, mention d'affiliation, liens sponsored, blocs croisés, 375 px.
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


const MENTION = 'Liens affiliés : Carnet Patte peut toucher une petite commission si vous achetez, sans surcoût pour vous. Nos choix restent indépendants.';

// ===== 1. LES DONNÉES (lues sur le disque) : modules/boutique/produits.js =====
log('=== DONNÉES : modules/boutique/produits.js ===');
const M = await import(pathToFileURL(path.join(RACINE, 'modules/boutique/produits.js')).href);
const T = await import(pathToFileURL(path.join(RACINE, 'modules/toxique/donnees.js')).href);
const { PRODUITS, BESOINS, MARCHANDS, MENTION_AFFILIATION } = M;
const GROUPES = T.ESPECES_TOXIQUE.map((g) => g.id);
const HOTES = { Animalis: 'www.animalis.com', 'Maxi Zoo': 'www.maxizoo.fr', Zooplus: 'www.zooplus.fr' };
verifier(PRODUITS.length >= 30 && PRODUITS.length <= 40, `entre 30 et 40 produits de départ (${PRODUITS.length})`);
verifier(MENTION_AFFILIATION === MENTION, 'la mention d\'affiliation est exactement celle demandée');
verifier(new Set(PRODUITS.map((p) => p.id)).size === PRODUITS.length && PRODUITS.every((p) => /^[a-z0-9-]+$/.test(p.id)), 'identifiants uniques');
verifier(PRODUITS.every((p) => [p.nom, p.categorie, p.pourquoi, p.marchand, p.lien].every((x) => typeof x === 'string' && x.trim()) && Array.isArray(p.especes) && p.especes.length > 0 && 'lienAffilie' in p), 'chaque produit : nom, catégorie, espèces, « pourquoi », marchand, lien, et le champ lienAffilie');
verifier(PRODUITS.every((p) => BESOINS.some((b) => b.id === p.categorie) && p.especes.every((e) => GROUPES.includes(e))), 'catégories et espèces valides (mêmes espèces que « Toxique ? »)');
verifier(PRODUITS.every((p) => p.lienAffilie === ''), 'lienAffilie est vide pour l\'instant (liens normaux)');
verifier(PRODUITS.every((p) => MARCHANDS.includes(p.marchand) && new globalThis.URL(p.lien).protocol === 'https:' && new globalThis.URL(p.lien).hostname === HOTES[p.marchand]), 'chaque lien est en https et pointe vers le site du marchand indiqué (Animalis, Maxi Zoo, Zooplus)');
const texteProduit = (p) => `${p.nom} ${p.pourquoi} ${p.lien}`;
const MEDICAL = /médicament|medicament|antiparasit|vermifug|anti-?puces?|anti-?tiques?|pipette|comprimé|complément|supplément|vitamine|probiotique|ordonnance|posologie|sirop|anti-?inflammatoire|antibiotique|parapharmac|pharma|collier (anti|répulsif)|shampooing (anti|médic)|veterinary|\bsanté\b|\bsoins?-sante/i;
const fautifs = PRODUITS.filter((p) => MEDICAL.test(texteProduit(p)));
verifier(fautifs.length === 0, `AUCUN médicament, antiparasitaire, vermifuge ni complément de santé (${fautifs.map((p) => p.id).join(', ') || 'rien trouvé'})`);
const PRIX = /€|\beuros?\b|\bprix\b|pas cher|promo|solde|\d\s?%|\bremise\b/i;
const AVIS = /\bavis\b|\bnotes?\b|étoile|★|⭐|\/\s?5\b|client|témoign|recommandé par/i;
const PROMESSE = /meilleur|n°\s?1|numéro 1|le plus vendu|garanti|100\s?%|miracle|guérit|soigne|prouvé/i;
verifier(PRODUITS.every((p) => !PRIX.test(`${p.nom} ${p.pourquoi}`)), 'aucun prix écrit dans les données');
verifier(PRODUITS.every((p) => !AVIS.test(`${p.nom} ${p.pourquoi}`) && !PROMESSE.test(`${p.nom} ${p.pourquoi}`)), 'aucune note, aucun avis, aucune promesse inventée (« meilleur », « garanti »…)');
verifier(PRODUITS.every((p) => p.pourquoi.length >= 40 && p.pourquoi.length <= 230), 'chaque « pourquoi » est une phrase courte (40 à 230 caractères)');
for (const g of ['chien', 'chat', 'lapin', 'rongeur', 'oiseau', 'poule']) verifier(PRODUITS.filter((p) => p.especes.includes(g)).length >= 3, `espèce « ${g} » : ${PRODUITS.filter((p) => p.especes.includes(g)).length} produits (au moins 3)`);
verifier(BESOINS.every((b) => PRODUITS.filter((p) => p.categorie === b.id).length >= 2), `chaque besoin a au moins 2 produits (${BESOINS.map((b) => `${b.id}=${PRODUITS.filter((p) => p.categorie === b.id).length}`).join(' ')})`);
const idsToxique = new Set(T.FICHES.map((f) => f.id));
verifier(PRODUITS.filter((p) => p.remplace).every((p) => p.remplace.every((id) => idsToxique.has(id))), 'les alternatives (« remplace ») désignent de vraies fiches « Toxique ? »');
verifier(M.lienFinal({ lien: 'https://a.test/x', lienAffilie: '' }) === 'https://a.test/x' && M.lienFinal({ lien: 'https://a.test/x', lienAffilie: 'https://aff.test/y' }) === 'https://aff.test/y', 'lienFinal : le lien affilié est utilisé s\'il est rempli, sinon le lien normal');
const bientotSrc = fs.readFileSync(path.join(RACINE, 'js/bientot.js'), 'utf8');
verifier(!/boutique/i.test(bientotSrc), 'la Boutique n\'est plus dans la liste « Bientôt »');

// ===== 2. L'APPLI DANS EDGE =====
const il_y_a = (j) => new Date(Date.now() - j * 864e5).toISOString().slice(0, 10);
const donnees = () => ev(`import('/js/storage.js').then(m => m.exporter())`);
const sansHorodatage = (t) => { const o = JSON.parse(t); delete o.exporteLe; return JSON.stringify(o); };
const importer = (t) => ev(`import('/js/storage.js').then(m => m.importer(${JSON.stringify(t)}))`);
const A = (id, nom, espece, extra = {}) => ({ id, nom, espece, especeAutre: '', race: '', naissance: '', photo: '', ...extra });
const cliquer = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).click()`);
const attendre = async (expr, ms = 8000) => { const fin = Date.now() + ms; while (Date.now() < fin) { if (await ev(expr)) return true; await sleep(120); } return false; };
const lire = () => ev(`({
  ids: [...document.querySelectorAll('.bq-produit')].map((c) => c.dataset.produit), statut: document.querySelector('#bq-resultat').textContent,
  esp: [...document.querySelectorAll('#bq-espece .bq-filtre')].map((b) => ({ v: b.dataset.valeur, p: b.getAttribute('aria-pressed'), n: +b.querySelector('.cp-filtre__nombre').textContent, d: b.disabled })),
  bes: [...document.querySelectorAll('#bq-besoin .bq-filtre')].map((b) => ({ v: b.dataset.valeur, p: b.getAttribute('aria-pressed'), n: +b.querySelector('.cp-filtre__nombre').textContent, d: b.disabled })),
  vide: !document.querySelector('#bq-aucun').hidden })`);
const filtre = async (groupe, valeur) => { await ev(`document.querySelector('#bq-${groupe} [data-valeur="${valeur}"]').click()`); await sleep(200); };
const attendus = (e, b) => PRODUITS.filter((p) => (e === 'toutes' || p.especes.includes(e)) && (b === 'tous' || p.categorie === b)).map((p) => p.id);

await send('Page.navigate', { url: URL }); await sleep(1800); await taille(1280, 900); await aller2('#/accueil'); await ev(axeSrc);
await importer(JSON.stringify({ version: 1, exemplesAjoutes: true, animaux: [
  A('moka', 'Moka', 'chien', { naissance: il_y_a(150) }), A('rex', 'Rex', 'chien', { naissance: '2019-03-01' }), A('mimi', 'Mimi', 'chat', { naissance: '2018-05-01' }),
  A('pomme', 'Pomme', 'hamster', { naissance: il_y_a(200) }), A('zorro', 'Zorro', 'furet', { naissance: '2020-01-01' })], soins: [], pesees: [] }));
const avantDonnees = sansHorodatage(await donnees());

log('=== ACCÈS : menu ☰, plus dans « Bientôt » ===');
await ev(`document.querySelector('#menu-bouton').click()`); await sleep(500);
verifier(await ev(`document.querySelectorAll('dialog.app-menu .app-menu__lien').length`) === 6 && await ev(`document.querySelector('dialog.app-menu [data-menu=boutique]')?.getAttribute('href')`) === '#/boutique', 'menu ☰ : entrée « Boutique » (6 entrées en tout)');
await ev(`document.querySelector('dialog.app-menu [data-menu=boutique]').click()`); await sleep(900);
verifier(await ev(`location.hash`) === '#/boutique' && await texte('#contenu h1') === 'Boutique', 'le menu ouvre la page Boutique');
verifier(await ev(`!!document.querySelector('.app-lateral [data-nav=boutique]') && !document.querySelector('.app-bientot__liste [data-nav=boutique]')`), 'barre latérale : la Boutique n\'est plus rangée sous « Bientôt »');
await aller2('#/bientot'); verifier(await ev(`document.querySelectorAll('.bt-carte').length`) === 3 && !/Boutique/.test(await texte('#contenu')), 'page « Bientôt » : 3 modules, plus de Boutique');
await aller2('#/profil'); verifier(await ev(`document.querySelectorAll('.pg-bientot a').length`) === 3 && !/Boutique/.test(await texte('.pg-bientot')), 'Profil, « Bientôt sur Carnet Patte » : plus de Boutique (3 liens)');

log('=== LA PAGE BOUTIQUE ===');
await aller2('#/boutique');
verifier((await texte('.pg--boutique > .bq-mention')).includes(MENTION), `mention d'affiliation exacte : « ${MENTION} »`);
verifier(await ev(`(() => { const r = document.querySelector('.pg--boutique > .bq-mention').getBoundingClientRect(); return r.width > 150 && r.height > 20 && r.top < innerHeight && getComputedStyle(document.querySelector('.pg--boutique > .bq-mention')).visibility === 'visible'; })()`), 'la mention est visible dès l\'arrivée sur la page (pas cachée, pas repliée)');
let s0 = await lire();
verifier(s0.ids.length === PRODUITS.length && s0.statut === `${PRODUITS.length} produits.` && s0.esp[0].v === 'toutes' && s0.esp[0].p === 'true' && s0.bes[0].v === 'tous' && s0.bes[0].p === 'true', `au départ : les ${PRODUITS.length} produits, « Toutes » et « Tous » actifs`);
verifier(JSON.stringify(s0.esp.map((x) => x.v)) === JSON.stringify(['toutes', 'chien', 'chat', 'lapin', 'oiseau', 'rongeur', 'poule']) && s0.bes.length === 8, `pastilles « Pour qui ? » : ${s0.esp.map((x) => x.v).join(', ')} ; « Pour quoi ? » : ${s0.bes.length - 1} besoins`);
await filtre('espece', 'chien');
let s1 = await lire();
verifier(JSON.stringify(s1.ids) === JSON.stringify(attendus('chien', 'tous')) && s1.esp.filter((x) => x.p === 'true').length === 1 && s1.esp.find((x) => x.v === 'chien').p === 'true', `espèce « chien » : ${s1.ids.length} produits, tous pour chien (${s1.statut})`);
verifier(s1.bes.every((b) => b.n === attendus('chien', b.v).length) && s1.bes.find((b) => b.v === 'hygiene').d === true, 'les nombres des besoins tiennent compte de l\'espèce ; un besoin sans produit pour cette espèce est grisé (hygiène pour chien)');
await filtre('besoin', 'jouets');
let s2 = await lire();
verifier(JSON.stringify(s2.ids) === JSON.stringify(attendus('chien', 'jouets')) && s2.ids.length >= 1 && /pour chien · jouets\./.test(s2.statut), `chien + jouets : ${s2.ids.join(', ')} (${s2.statut})`);
verifier(await ev(`[...document.querySelectorAll('.bq-produit')].every((c) => c.dataset.categorie === 'jouets')`), 'seuls des jouets sont affichés');
await filtre('espece', 'toutes'); await filtre('besoin', 'tous');
await filtre('espece', 'poule');
let s3 = await lire();
verifier(JSON.stringify(s3.ids) === JSON.stringify(attendus('poule', 'tous')) && s3.esp.find((x) => x.v === 'chien').n === s3.esp.find((x) => x.v === 'chien').n, `espèce « poule » : ${s3.ids.length} produits`);
await filtre('espece', 'toutes');
await aller2('#/boutique/chat/jouets');
let s4 = await lire();
verifier(s4.esp.find((x) => x.v === 'chat').p === 'true' && s4.bes.find((x) => x.v === 'jouets').p === 'true' && JSON.stringify(s4.ids) === JSON.stringify(attendus('chat', 'jouets')), 'l\'adresse #/boutique/chat/jouets ouvre la page avec ces deux filtres déjà choisis');
await aller2('#/boutique/oiseau/saison');
let s5 = await lire();
verifier(s5.ids.length === 0 && s5.vide && /Aucun produit pour cette combinaison/.test(await texte('#bq-aucun')), 'combinaison sans produit (oiseau + été/hiver) : message clair, pas de page blanche');
await cliquer('#bq-reinit'); await sleep(200);
verifier((await lire()).ids.length === PRODUITS.length, '« Tout afficher » remet tous les produits');
await aller2('#/boutique');

log('=== LES PRODUITS ET LEURS LIENS ===');
const liens = await ev(`[...document.querySelectorAll('.bq-produit a')].map((a) => ({ href: a.href, rel: a.rel, cible: a.target, texte: a.textContent.trim(), nom: a.getAttribute('aria-label') }))`);
verifier(liens.length === PRODUITS.length && liens.every((l) => l.cible === '_blank' && /\bsponsored\b/.test(l.rel) && /\bnoopener\b/.test(l.rel)), `les ${liens.length} liens s'ouvrent dans un nouvel onglet avec rel="sponsored noopener" (rel : « ${liens[0].rel} »)`);
verifier(liens.every((l, i) => l.href === PRODUITS[i].lien && l.texte === 'Voir le prix' && /^Voir le prix : /.test(l.nom) && /nouvel onglet/.test(l.nom)), 'bouton « Voir le prix » (nom complet pour les lecteurs d\'écran), adresse = celle du fichier de données');
const cartes = await ev(`[...document.querySelectorAll('.bq-produit')].map((c) => c.innerText)`);
verifier(cartes.every((t) => !PRIX.test(t.replace(/Voir le prix/g, ''))) && cartes.every((t) => !AVIS.test(t)) && !cartes.some((t) => /€|★/.test(t)), 'aucun prix, aucune note, aucun avis affichés sur les cartes');
verifier(cartes.every((t) => !MEDICAL.test(t)), 'aucun mot de médicament ou de santé animale sur les cartes');
verifier(cartes.every((t) => /Pourquoi on le recommande :/.test(t) && /Chez (Animalis|Maxi Zoo|Zooplus)/.test(t)), 'chaque carte : « Pourquoi on le recommande » et le site marchand');
verifier(/ni médicament, ni antiparasitaire, ni complément de santé/.test(await texte('.bq-pied')), 'pied de page : cette sélection ne contient aucun produit de santé');
// Le champ lienAffilie : s'il est rempli, le lien affilié est utilisé
await ev(`import('/modules/boutique/produits.js').then((m) => { window.__p0 = m.PRODUITS[0]; window.__l0 = m.PRODUITS[0].lienAffilie; m.PRODUITS[0].lienAffilie = 'https://affilie.example/test'; })`);
await ev(`import('/js/router.js').then((r) => r.rafraichir())`); await sleep(500);
verifier(await ev(`document.querySelector('[data-produit="${PRODUITS[0].id}"] a').href`) === 'https://affilie.example/test' && await ev(`document.querySelector('[data-produit="${PRODUITS[0].id}"] a').rel`) === 'sponsored noopener', 'lienAffilie rempli : le bouton utilise le lien affilié (toujours sponsored noopener)');
await ev(`window.__p0.lienAffilie = window.__l0`); await ev(`import('/js/router.js').then((r) => r.rafraichir())`); await sleep(500);
verifier(await ev(`document.querySelector('[data-produit="${PRODUITS[0].id}"] a').href`) === PRODUITS[0].lien, 'lienAffilie vide : retour au lien normal');
await axe('#contenu', 'Boutique, 1280 px');

log('=== SUR 375 px (iPhone) ===');
await taille(375, 812); await aller2('#/boutique'); await sleep(500);
verifier(await sansDebord(), 'aucun défilement horizontal');
verifier(await ev(`(() => { const r = document.querySelector('.pg--boutique > .bq-mention').getBoundingClientRect(); return r.top < innerHeight && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; })()`), 'la mention d\'affiliation est entière dans le premier écran');
const f375 = await ev(`[...document.querySelectorAll('.bq-filtres')].map((c) => { const f = [...c.querySelectorAll('.bq-filtre')]; return { lignes: new Set(f.map((b) => Math.round(b.getBoundingClientRect().top))).size, defile: c.scrollWidth > c.clientWidth, haut: Math.round(f[0].getBoundingClientRect().height), gauche: Math.round(c.getBoundingClientRect().left) }; })`);
verifier(f375.length === 2 && f375.every((r) => r.lignes === 1 && r.defile && r.haut <= 34), `les deux rangées de filtres tiennent sur UNE ligne qui défile (${f375.map((r) => `${r.haut} px`).join(', ')})`);
const m375 = await ev(`(() => { const cartes = [...document.querySelectorAll('.bq-produit')]; const hors = cartes.filter((c) => { const b = c.getBoundingClientRect(); return b.left < 0 || b.right > innerWidth || [...c.querySelectorAll('*')].some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > b.right + 1 || r.left < b.left - 1); }); }).length; return { n: cartes.length, hors, boutons: cartes.map((c) => Math.round(c.querySelector('a.cp-btn').getBoundingClientRect().height)) }; })()`);
verifier(m375.hors === 0 && m375.boutons.every((h) => h >= 44), `${m375.n} cartes : rien ne déborde, boutons « Voir le prix » assez grands pour le doigt (${Math.min(...m375.boutons)} px minimum)`);
await ecran('375-boutique'); await ev(`document.querySelector('.bq-liste').scrollIntoView({ block: 'start' })`); await sleep(300); await ecran('375-boutique-liste');
await axe('#contenu', 'Boutique, 375 px');
await taille(768, 1024); await sleep(400); verifier(await sansDebord(), 'aucun défilement horizontal à 768 px'); await axe('#contenu', 'Boutique, 768 px');
await taille(1280, 900); await sleep(300);

log('=== FICHE D\'UN ANIMAL : « Pour [nom] » ===');
const blocDe = async (id) => { await aller2(`#/animaux/${id}`); await sleep(400); return ev(`(() => { const b = document.querySelector('.bq-bloc'); return b ? { titre: b.querySelector('h2').textContent, ids: [...b.querySelectorAll('.bq-produit')].map((c) => c.dataset.produit), cats: [...b.querySelectorAll('.bq-produit')].map((c) => c.dataset.categorie), mention: b.querySelector('.bq-mention')?.textContent.trim(), liens: [...b.querySelectorAll('.bq-produit a')].map((a) => a.target + '|' + a.rel), tout: b.querySelector('.pg-lien')?.getAttribute('href'), apresOnglets: !!(document.querySelector('.fi-onglets').compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) } : null; })()`); };
const bMoka = await blocDe('moka');
verifier(bMoka && bMoka.titre === 'Pour Moka' && bMoka.ids.length === 3 && new Set(bMoka.cats).size === 3, `fiche de Moka : « ${bMoka?.titre} » avec 3 produits de besoins différents (${bMoka?.ids.join(', ')})`);
verifier(bMoka.ids.every((id) => PRODUITS.find((p) => p.id === id).especes.includes('chien')), 'les 3 produits sont des produits pour chien');
verifier(bMoka.mention === MENTION && bMoka.liens.every((l) => l === '_blank|sponsored noopener') && bMoka.apresOnglets, 'le bloc porte la mention d\'affiliation, ses liens sont sponsored noopener, et il est sous les onglets de la fiche');
verifier(bMoka.tout === '#/boutique/chien', '« Toute la sélection » mène à la Boutique, espèce chien');
const bMoka2 = await blocDe('moka');
verifier(JSON.stringify(bMoka2.ids) === JSON.stringify(bMoka.ids), 'le choix est stable : même animal, mêmes produits');
verifier(await ev(`document.querySelectorAll('.fi-onglets [role=tab]').length`) === 4, 'les 4 onglets de la fiche fonctionnent toujours');
const bRex = await blocDe('rex'); const bMimi = await blocDe('mimi'); const bPomme = await blocDe('pomme'); const bZorro = await blocDe('zorro');
verifier(bRex.ids.length === 3 && !bRex.cats.includes('arrivee') && bMimi.ids.every((id) => PRODUITS.find((p) => p.id === id).especes.includes('chat')) && !bMimi.cats.includes('arrivee'), 'un chien et un chat adultes : pas de « kit d\'arrivée » ; Mimi n\'a que des produits pour chat');
verifier(bPomme.titre === 'Pour Pomme' && bPomme.ids.every((id) => PRODUITS.find((p) => p.id === id).especes.includes('rongeur')), 'un hamster : produits pour rongeurs');
verifier(bZorro === null, 'un furet (aucun produit dans la sélection) : pas de bloc');
const saisons = await ev(`import('/modules/boutique/blocs.js').then((m) => ({ janvier: m.produitsPourAnimal({ id: 'x', espece: 'chien', naissance: '2019-01-01' }, 9, 0).map((p) => p.id), juillet: m.produitsPourAnimal({ id: 'x', espece: 'chien', naissance: '2019-01-01' }, 9, 6).map((p) => p.id), chiot: m.produitsPourAnimal({ id: 'x', espece: 'chien', naissance: '${il_y_a(100)}' }, 9, 3).map((p) => p.id) }))`);
verifier(!saisons.janvier.some((id) => /chaleur|piscine/.test(id)) && saisons.janvier.includes('chien-manteau') && !saisons.juillet.includes('chien-manteau') && saisons.juillet.includes('chien-piscine'), 'saisons : pas de produit d\'été en janvier, pas de manteau en juillet');
verifier(saisons.chiot.includes('chien-chiot') && !saisons.janvier.includes('chien-chiot'), '« Kit d\'arrivée du chiot » seulement pour un chiot (moins d\'un an)');
await taille(375, 812); await blocDe('moka'); await sleep(300);
verifier(await sansDebord() && await ev(`(() => { const b = document.querySelector('.bq-bloc').getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth && [...document.querySelectorAll('.bq-bloc *')].every((e) => e.getBoundingClientRect().right <= innerWidth + 1); })()`), 'fiche sur 375 px : le bloc « Pour Moka » reste dans l\'écran');
await ev(`document.querySelector('.bq-bloc').scrollIntoView({ block: 'start' })`); await sleep(300); await ecran('375-fiche-pour');
await axe('#contenu', 'Fiche animal avec « Pour Moka », 375 px');
await taille(1280, 900); await sleep(300);
await aller2('#/animaux/moka'); await ev(`document.querySelector('.bq-bloc .pg-lien').click()`); await sleep(700);
verifier(await ev(`location.hash`) === '#/boutique/chien' && (await lire()).esp.find((x) => x.v === 'chien').p === 'true', 'depuis la fiche, « Toute la sélection » ouvre la Boutique sur les produits pour chien');

log('=== « TOXIQUE ? » : une alternative sûre sous un aliment dangereux ===');
const ouvrirFiche = async (groupe, mot) => {
  await aller2('#/toxique'); await sleep(300);
  await ev(`document.querySelector('input[name=tx-espece][value=${groupe}]').click()`); await sleep(200);
  await ev(`(() => { const i = document.querySelector('#tx-q'); i.value = ${JSON.stringify(mot)}; i.dispatchEvent(new Event('input', { bubbles: true })); })()`); await sleep(400);
  return ev(`(() => { const c = document.querySelector('.tx-carte[data-niveau]'); const d = c?.querySelector('.tx-carte__detail'); const alt = d?.querySelector('.bq-alternative'); const urg = d?.querySelector('.tx-urgence--dans-fiche'); const src = d?.querySelector('.tx-source');
    return { niveau: c?.dataset.niveau, ouverte: d && !d.hidden, alt: !!alt, ids: alt ? [...alt.querySelectorAll('.bq-produit')].map((x) => x.dataset.produit) : [], mention: alt?.querySelector('.bq-mention')?.textContent.trim(), liens: alt ? [...alt.querySelectorAll('a')].map((a) => a.target + '|' + a.rel) : [],
      ordre: !!(alt && urg && src && (urg.compareDocumentPosition(alt) & Node.DOCUMENT_POSITION_FOLLOWING) && (alt.compareDocumentPosition(src) & Node.DOCUMENT_POSITION_FOLLOWING)), urgence: !!urg, titre: alt?.querySelector('h4')?.textContent }; })()`);
};
const tChoc = await ouvrirFiche('chien', 'chocolat');
verifier(tChoc.ouverte && ['toxique', 'tres'].includes(tChoc.niveau) && tChoc.alt && tChoc.ids.includes('chien-friandises') && tChoc.titre === 'Une alternative sûre', `chocolat pour chien (${tChoc.niveau}) : alternative sûre = ${tChoc.ids.join(', ')}`);
verifier(tChoc.mention === MENTION && tChoc.liens.every((l) => l === '_blank|sponsored noopener') && tChoc.ordre && tChoc.urgence, 'elle vient APRÈS les numéros d\'urgence et AVANT les sources ; mention d\'affiliation et liens sponsored présents');
const tLys = await ouvrirFiche('chat', 'lys');
verifier(tLys.alt && tLys.ids.includes('chat-catnip'), `lys pour chat : alternative = ${tLys.ids.join(', ')} (jouets à l'herbe à chat)`);
const tChat = await ouvrirFiche('chat', 'chocolat');
verifier(tChat.alt && tChat.ids.includes('chat-friandises') && !tChat.ids.includes('chien-friandises'), 'chocolat pour chat : friandises pour CHAT, pas pour chien');
const tLapin = await ouvrirFiche('lapin', 'chocolat');
verifier(!tLapin.alt && tLapin.urgence, 'chocolat pour lapin : aucune suggestion (pas de produit adapté), l\'urgence reste affichée');
const tLait = await ouvrirFiche('chien', 'lait');
verifier(!tLait.alt, `un aliment qui n'est pas dans la liste des alternatives (lait, niveau ${tLait.niveau}) : aucune suggestion`);
await taille(375, 812); await ouvrirFiche('chien', 'chocolat'); await sleep(300);
verifier(await sansDebord(), '« Toxique ? » avec l\'alternative sur 375 px : rien ne déborde');
await ev(`document.querySelector('.bq-alternative').scrollIntoView({ block: 'center' })`); await sleep(300); await ecran('375-toxique-alternative');
await axe('#contenu', 'Toxique ? avec alternative, 375 px');
await taille(1280, 900); await sleep(300);

log('=== DONNÉES DE L\'UTILISATEUR INTACTES ===');
await aller2('#/boutique'); await aller2('#/animaux/moka'); await aller2('#/toxique');
verifier(avantDonnees === sansHorodatage(await donnees()), 'consulter la Boutique et les blocs ne modifie aucune donnée enregistrée');
const exp = await donnees();
await ev(`import('/js/storage.js').then(m => m.toutEffacer())`); await importer(exp);
log('export -> effacer -> import -> export identique :', sansHorodatage(exp) === sansHorodatage(await donnees()));

log('ERREURS CONSOLE :', erreurs.length ? erreurs : 'aucune');
log('VÉRIFICATIONS EN ÉCHEC :', echecs);
ws.close(); proc.kill(); process.exit(echecs ? 1 : 0);
