// Test « recadrage » : recadrer la photo d'un animal (js/recadrage.js, formulaire de modules/animaux/animaux.js).
// Vérifie : le calcul de cadrage (la photo couvre toujours le cadre), déplacement à la souris / au doigt (un point), pincer (deux points), curseur, molette, clavier,
// aperçu rond et carré, « Valider » (photo carrée de 480 px, JPEG léger) et « Annuler » (rien ne change), fichier choisi puis recadré, bouton « Recadrer la photo »
// quand la photo existe déjà, photo illisible (message clair), écran de 375 px sans chevauchement, accessibilité.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ouvrirEdge, dort } from './outil-cdp.mjs';

const [S, URL, TAG] = process.argv.slice(2);
const { send, ev, log, verifier, texte, ecran, donnees, aller, importer, axe, fin, taille, controler } = await ouvrirEdge({ sortie: S, balise: TAG, port: +(process.env.PORT || 9352) });

await send('Network.enable');
await send('Page.navigate', { url: URL }); await dort(1800);
await taille(375, 812);
await importer({ version: 1, exemplesAjoutes: true, exporteLe: '2026-01-01T00:00:00.000Z', animaux: [{ id: 'a', nom: 'Moka', espece: 'chien', especeAutre: '', race: '', naissance: '', photo: '' }], soins: [], pesees: [] });
await aller('#/animaux'); await dort(500);

// Une photo de test : 600 x 300, moitié gauche rouge, moitié droite bleue, avec du « grain » pour peser comme une vraie photo
const source = await ev(`(() => { const c = document.createElement('canvas'); c.width = 600; c.height = 300; const g = c.getContext('2d');
  g.fillStyle = '#d02020'; g.fillRect(0, 0, 300, 300); g.fillStyle = '#2020d0'; g.fillRect(300, 0, 300, 300);
  for (let i = 0; i < 4000; i++) { g.fillStyle = 'rgba(' + (i * 37 % 255) + ',' + (i * 91 % 255) + ',' + (i * 53 % 255) + ',.25)'; g.fillRect((i * 131) % 600, (i * 71) % 300, 3, 3); }
  return c.toDataURL('image/jpeg', 0.9); })()`);
await ev(`window.__source = ${JSON.stringify(source)}; window.__px = (url, x, y) => new Promise((ok) => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; const g = c.getContext('2d'); g.drawImage(i, 0, 0); ok({ l: i.naturalWidth, h: i.naturalHeight, p: Array.from(g.getImageData(x, y, 1, 1).data) }); }; i.src = url; });`);
const pixel = (x, y) => ev(`window.__px(window.__result, ${x}, ${y})`);
const rouge = (p) => p.p[0] > 150 && p.p[2] < 110;
const bleu = (p) => p.p[2] > 150 && p.p[0] < 110;
const ouvrir = async (arg = 'window.__source') => { await ev(`(() => { window.__result = undefined; window.__termine = false; window.__fini = import('/js/recadrage.js').then((m) => m.recadrerPhoto(${arg})).then((r) => { window.__result = r; window.__termine = true; return r; }).catch((e) => { window.__erreur = e.message; window.__termine = true; }); return true; })()`); await dort(500); };
const terminer = async () => { for (let i = 0; i < 30 && !(await ev(`window.__termine`)); i++) await dort(150); };
const cliquer = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).click()`);
const souris = async (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons: type === 'mouseReleased' ? 0 : 1, clickCount: 1, ...extra });
const centreToile = async () => ev(`(() => { const r = document.querySelector('dialog[open] [data-toile]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.width }; })()`);
const glisser = async (dx, dy) => { const c = await centreToile(); await souris('mousePressed', c.x, c.y); for (let i = 1; i <= 8; i++) await souris('mouseMoved', c.x + (dx * i) / 8, c.y + (dy * i) / 8); await souris('mouseReleased', c.x + dx, c.y + dy); await dort(150); };
const pointeurs = (type, id, x, y) => ev(`document.querySelector('dialog[open] [data-toile]').dispatchEvent(new PointerEvent('${type}', { pointerId: ${id}, clientX: ${x}, clientY: ${y}, bubbles: true, cancelable: true, isPrimary: ${id === 1} }))`);
const choisirFichier = async (chemin) => { const doc = (await send('DOM.getDocument', { depth: 1 })).result; const champ = (await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'dialog[open] [data-fichier]' })).result; await send('DOM.setFileInputFiles', { files: [chemin], nodeId: champ.nodeId }); await dort(900); };
const zoomCurseur = () => ev(`Number(document.querySelector('dialog[open] [data-zoom]').value)`);

// ===== 1. Le calcul de cadrage : la photo couvre toujours le cadre =====
log('--- 1. Calcul du cadrage ---');
const calc = await ev(`import('/js/recadrage.js').then((m) => {
  const a = m.cadrage({ largeur: 600, hauteur: 300, cadre: 300, zoom: 1, centreX: 150, centreY: 150 });
  const b = m.cadrage({ largeur: 600, hauteur: 300, cadre: 300, zoom: 1, centreX: 9999, centreY: -9999 });
  const c = m.cadrage({ largeur: 600, hauteur: 300, cadre: 300, zoom: 0.2, centreX: 150, centreY: 150 });
  const d = m.cadrage({ largeur: 600, hauteur: 300, cadre: 300, zoom: 99, centreX: 150, centreY: 150 });
  return JSON.stringify({ a, b, c, d });
})`);
const { a, b, c, d } = JSON.parse(calc);
verifier(a.w === 600 && a.h === 300 && a.x === -150 && a.y === 0, 'photo large (600 x 300) dans un cadre de 300 : elle remplit la hauteur et déborde à gauche et à droite');
verifier(b.x <= 0 && b.x + b.w >= 300 && b.y <= 0 && b.y + b.h >= 300, 'on ne peut jamais la déplacer au point de laisser un bord vide (limites)');
verifier(c.w === 600 && d.w === 2400, 'le zoom reste entre 1 (photo juste couvrante) et 4');

// ===== 2. Valider sans rien toucher : carré de 480 px, JPEG léger =====
log('--- 2. Écran de recadrage ---');
await ouvrir();
verifier(await ev(`!!document.querySelector('dialog[open] [data-toile]') && !!document.querySelector('dialog[open] [data-zoom]')`) && (await texte('dialog[open]')).includes('Recadrer la photo'), 'l’écran de recadrage s’ouvre avec la photo, un curseur de zoom, « Annuler » et « Valider »');
verifier(await ev(`getComputedStyle(document.querySelector('dialog[open] .rc-mini--rond')).borderRadius`) === '50%' && await ev(`document.querySelectorAll('dialog[open] .rc-mini').length`) === 2, 'aperçus du résultat : rond (listes, avatars) et carré (fiche)');
const larg = await ev(`document.querySelector('dialog[open] [data-toile]').getBoundingClientRect().width`);
const bord = await ev(`document.querySelector('dialog[open]').getBoundingClientRect().right <= window.innerWidth + 1 && document.documentElement.scrollWidth <= window.innerWidth`);
verifier(larg >= 220 && larg <= 320 && bord, `à 375 px : cadre de ${Math.round(larg)} px, rien ne dépasse de l’écran`);
await controler('Recadrage à 375 px'); await axe('dialog[open]', 'écran de recadrage'); await ecran('recadrage');
await cliquer('dialog[open] [data-valider]'); await terminer();
const r1 = await ev(`window.__result`);
const p0 = await pixel(10, 240); const p1 = await pixel(470, 240);
verifier(/^data:image\/jpeg;base64,/.test(r1) && p0.l === 480 && p0.h === 480, `« Valider » : photo carrée de ${p0.l} x ${p0.h} px, en JPEG`);
verifier(rouge(p0) && bleu(p1), 'sans déplacement, c’est le centre de la photo qui est gardé (rouge à gauche, bleu à droite)');
verifier(r1.length < 130000, `elle reste légère : ${Math.round(r1.length / 1024)} Ko (gardée sur l’appareil et dans le cloud)`);

// ===== 3. Déplacer à la souris, limites =====
log('--- 3. Déplacer, zoomer ---');
await ouvrir();
await glisser(130, 0);
await cliquer('dialog[open] [data-valider]'); await terminer();
const q = await pixel(400, 240);
verifier(rouge(q), 'glisser la photo vers la droite montre davantage de sa partie gauche (rouge) : le déplacement à la souris marche');
await ouvrir();
await glisser(1500, 1500);
await cliquer('dialog[open] [data-valider]'); await terminer();
const bords = [await pixel(2, 240), await pixel(477, 240), await pixel(240, 2), await pixel(240, 477)];
verifier(bords.every((p) => !(p.p[0] > 245 && p.p[1] > 245 && p.p[2] > 245)), 'même en tirant très fort, la photo couvre toujours le cadre : aucun bord vide');
// Zoom : curseur, molette, clavier, pincer
await ouvrir();
await ev(`(() => { const z = document.querySelector('dialog[open] [data-zoom]'); z.value = '2'; z.dispatchEvent(new Event('input', { bubbles: true })); })()`); await dort(150);
verifier(await zoomCurseur() === 2, 'le curseur règle le zoom');
const c0 = await centreToile();
await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: c0.x, y: c0.y, deltaX: 0, deltaY: -120 }); await dort(150);
verifier(await zoomCurseur() > 2, `la molette zoome (${(await zoomCurseur()).toFixed(2)})`);
await ev(`(() => { const z = document.querySelector('dialog[open] [data-zoom]'); z.value = '1'; z.dispatchEvent(new Event('input', { bubbles: true })); })()`); await dort(150);
await ev(`document.querySelector('dialog[open] [data-cadre]').focus()`);
await ev(`document.querySelector('dialog[open] [data-cadre]').dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true, cancelable: true }))`); await dort(100);
verifier(await zoomCurseur() > 1.05, 'au clavier : « + » zoome (la zone est accessible sans souris)');
await ev(`document.querySelector('dialog[open] [data-cadre]').dispatchEvent(new KeyboardEvent('keydown', { key: '-', bubbles: true, cancelable: true }))`); await dort(100);
await ev(`(() => { const z = document.querySelector('dialog[open] [data-zoom]'); z.value = '1'; z.dispatchEvent(new Event('input', { bubbles: true })); })()`); await dort(100);
// Pincer avec deux doigts (deux pointeurs)
const t = await centreToile();
await pointeurs('pointerdown', 1, t.x - 30, t.y); await pointeurs('pointerdown', 2, t.x + 30, t.y);
for (let i = 1; i <= 6; i++) { await pointeurs('pointermove', 1, t.x - 30 - i * 10, t.y); await pointeurs('pointermove', 2, t.x + 30 + i * 10, t.y); }
await pointeurs('pointerup', 1, t.x - 90, t.y); await pointeurs('pointerup', 2, t.x + 90, t.y); await dort(150);
const zp = await zoomCurseur();
verifier(zp > 2.5, `pincer avec deux doigts zoome (${zp.toFixed(2)} fois)`);
// Aperçus : le rond a ses coins transparents, le carré est plein
const mini = await ev(`(() => { const lire = (s) => { const c = document.querySelector(s); const d = c.getContext('2d').getImageData(1, 1, 1, 1).data[3]; return d; }; return { rond: lire('dialog[open] .rc-mini--rond'), carre: lire('dialog[open] .rc-mini--carre') }; })()`);
verifier(mini.rond === 0 && mini.carre === 255, 'aperçu rond : coins vides ; aperçu carré : plein');
// Annuler
await cliquer('dialog[open] [data-annuler]'); await terminer();
verifier(await ev(`window.__result === null`) && await ev(`!document.querySelector('dialog[open]')`), '« Annuler » : rien n’est renvoyé, l’écran se ferme');

// ===== 4. Dans le formulaire de l'animal : fichier choisi, puis « Recadrer la photo » =====
log('--- 4. Formulaire de l’animal ---');
const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'recadrage-'));
const fichierJpg = path.join(dossier, 'photo.jpg');
fs.writeFileSync(fichierJpg, Buffer.from(source.split(',')[1], 'base64'));
await ev(`import('/modules/animaux/animaux.js').then((m) => m.formulaireAnimal(null, () => {}))`); await dort(500);
verifier(await ev(`document.querySelector('dialog[open] [data-recadrer]').hidden`), 'nouvel animal sans photo : pas de bouton « Recadrer la photo »');
await choisirFichier(fichierJpg);
verifier(await ev(`document.querySelectorAll('dialog[open]').length`) === 2 && (await texte('dialog[open]:last-of-type')).includes('Recadrer la photo'), 'après le choix d’un fichier, l’écran de recadrage s’ouvre (au-dessus du formulaire)');
await ev(`document.querySelector('dialog[open]:last-of-type [data-annuler]').click()`); await dort(400);
verifier(await ev(`document.querySelector('dialog[open] [data-recadrer]').hidden`), '« Annuler » dans le recadrage : le formulaire n’a pas de photo');
await choisirFichier(fichierJpg);
await ev(`document.querySelector('dialog[open]:last-of-type [data-valider]').click()`); await dort(500);
verifier(!(await ev(`document.querySelector('dialog[open] [data-recadrer]').hidden`)) && await ev(`!!document.querySelector('dialog[open] .al-photo__apercu img')`), '« Valider » : la photo recadrée apparaît dans l’aperçu du formulaire, le bouton « Recadrer la photo » apparaît');
await ev(`(() => { const f = document.querySelector('dialog[open] form'); f.nom.value = 'Nouveau'; })()`);
await ev(`document.querySelector('dialog[open] form').requestSubmit()`); await dort(600);
const sauve = await ev(`import('/js/storage.js').then((m) => m.lister('animaux').find((x) => x.nom === 'Nouveau')?.photo ?? '')`);
await ev(`window.__result = ${JSON.stringify(sauve)}`);
const ps = await pixel(10, 10);
verifier(ps.l === 480 && ps.h === 480 && sauve.length < 130000, `l’animal enregistré garde une photo carrée de ${ps.l} x ${ps.h} px (${Math.round(sauve.length / 1024)} Ko)`);
// « Modifier » : recadrer une photo existante
await ev(`import('/js/storage.js').then((m) => { const a = m.lister('animaux').find((x) => x.nom === 'Nouveau'); return import('/modules/animaux/animaux.js').then((x) => x.formulaireAnimal(a, () => {})); })`); await dort(500);
verifier(!(await ev(`document.querySelector('dialog[open] [data-recadrer]').hidden`)), 'en modifiant un animal qui a une photo : « Recadrer la photo » est proposé');
await cliquer('dialog[open] [data-recadrer]'); await dort(600);
await ev(`(() => { const z = document.querySelector('dialog[open]:last-of-type [data-zoom]'); z.value = '2'; z.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await ev(`document.querySelector('dialog[open]:last-of-type [data-valider]').click()`); await dort(500);
await ev(`document.querySelector('dialog[open] form').requestSubmit()`); await dort(600);
const sauve2 = await ev(`import('/js/storage.js').then((m) => m.lister('animaux').find((x) => x.nom === 'Nouveau')?.photo ?? '')`);
await ev(`window.__result = ${JSON.stringify(sauve2)}`);
const ps2 = await pixel(10, 10);
verifier(sauve2 !== sauve && ps2.l === 480 && ps2.h === 480, 'la photo existante recadrée (zoom 2) remplace l’ancienne, toujours carrée de 480 px');
// Photo illisible : message clair
fs.writeFileSync(path.join(dossier, 'faux.jpg'), 'ceci n’est pas une image');
await ev(`import('/modules/animaux/animaux.js').then((m) => m.formulaireAnimal(null, () => {}))`); await dort(500);
await choisirFichier(path.join(dossier, 'faux.jpg'));
verifier((await texte('.cp-notifs')).includes('pas pu être lue') && await ev(`document.querySelectorAll('dialog[open]').length`) === 1, 'une photo illisible : message clair, pas d’écran de recadrage');
fs.rmSync(dossier, { recursive: true, force: true });

fin(true);
