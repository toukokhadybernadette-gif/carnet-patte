// Test « documents » : onglet Documents de la fiche (photos et PDF gardés dans IndexedDB).
// Vérifie : ajout avec titre, date et type ; photo réduite ; PDF ; espace utilisé ; ouverture et téléchargement ; export / import (documents compris,
// ancien export sans documents) ; avertissement de sauvegarde volumineuse ; « Tout effacer » ; suppression d'un animal ; hors connexion ;
// aucune requête réseau ; écran de 375 px (aucun chevauchement) ; accessibilité.
import { ouvrirEdge, dort, jour } from './outil-cdp.mjs';

const [S, URL, TAG] = process.argv.slice(2);
const { send, ev, log, verifier, texte, ecran, donnees, aller, importer, axe, fin, taille, controler } = await ouvrirEdge({ sortie: S, balise: TAG, port: +(process.env.PORT || 9350) });

await send('Network.enable');
const requetes = [];
await send('Page.navigate', { url: URL }); await dort(1800);
await taille(375, 812);
// Les requêtes du réseau : on garde celles qui partent APRÈS ce point (les fichiers de l'appli sont déjà chargés)
const surRequete = new Set();
await ev(`(() => { window.__reseau = []; const f = window.fetch.bind(window); window.fetch = (...a) => { window.__reseau.push(String(a[0]?.url ?? a[0])); return f(...a); };
  const x = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function (m, u) { window.__reseau.push(String(u)); return x.apply(this, arguments); };
  window.__ouvertures = []; window.open = (u) => { window.__ouvertures.push(u); return {}; };
  window.__telechargements = []; const clic = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) window.__telechargements.push(this.download); else clic.call(this); }; })()`);

const fichier = { version: 1, exemplesAjoutes: true, exporteLe: '2026-01-01T00:00:00.000Z',
  animaux: [{ id: 'a', nom: 'Moka', espece: 'chien', especeAutre: '', race: '', naissance: '2023-08-01', photo: '' }, { id: 'b', nom: 'Filou', espece: 'chat', especeAutre: '', race: '', naissance: '', photo: '' }],
  soins: [], pesees: [] };
await importer(fichier);
await ev(`import('/js/documents-db.js').then((d) => d.toutEffacerDocuments())`);

// Fabrique un File dans la page et le met dans le champ de la fenêtre
const photoGrosse = `(async () => { const c = document.createElement('canvas'); c.width = 3200; c.height = 2400; const g = c.getContext('2d');
  for (let i = 0; i < 400; i++) { g.fillStyle = 'hsl(' + (i * 37 % 360) + ',70%,' + (30 + i % 40) + '%)'; g.fillRect((i * 97) % 3200, (i * 61) % 2400, 300, 220); }
  const b = await new Promise((r) => c.toBlob(r, 'image/png')); return new File([b], 'IMG_0042.png', { type: 'image/png' }); })()`;
const pdf = `new File([new TextEncoder().encode('%PDF-1.4\\n1 0 obj<<>>endobj\\ntrailer<<>>\\n%%EOF')], 'ordonnance_dr_martin.pdf', { type: 'application/pdf' })`;
const choisir = (expr) => ev(`(async () => { const f = await ${expr}; const dt = new DataTransfer(); dt.items.add(f); const i = document.querySelector('dialog[open] #doc-fichier'); i.files = dt.files; i.dispatchEvent(new Event('change', { bubbles: true })); return f.size; })()`);
const lister = () => ev(`import('/js/documents-db.js').then(async (d) => (await d.listerDocuments()).map((x) => ({ id: x.id, animalId: x.animalId, titre: x.titre, date: x.date, type: x.type, mime: x.mime, taille: x.taille })))`);
const ouvrirOnglet = async (id) => { await aller(`#/animaux/${id}`); await ev(`document.querySelector('[data-onglet=documents]').click()`); await dort(600); };

// ===== 1. Onglet vide, formulaire, erreurs =====
log('--- 1. Onglet Documents ---');
await ouvrirOnglet('a');
verifier(!(await texte('#fi-panneau-documents')).includes('Bientôt disponible'), 'plus de « Bientôt disponible »');
verifier((await texte('#fi-panneau-documents')).includes('Aucun document pour l\'instant'), 'état vide clair');
verifier(/Espace utilisé par les documents : 0 o \(0 document/.test(await texte('[data-espace]')), `espace affiché : ${await texte('[data-espace]')}`);
await ev(`document.querySelector('#fi-panneau-documents [data-act=ajouter]').click()`); await dort(500);
verifier(await ev(`!!document.querySelector('dialog[open] #doc-fichier') && !!document.querySelector('dialog[open] #doc-titre') && !!document.querySelector('dialog[open] #doc-date') && !!document.querySelector('dialog[open] #doc-type')`), 'formulaire : fichier, titre, date, type');
verifier(await ev(`document.querySelector('dialog[open] #doc-fichier').accept`) === 'image/*,application/pdf', 'le champ propose photos et PDF');
verifier((await texte('dialog[open]')).includes('Rien n\'est envoyé sur internet'), 'le formulaire dit que rien n’est envoyé');
await ev(`document.querySelector('dialog[open] form').requestSubmit()`); await dort(300);
verifier((await texte('dialog[open]')).includes('Choisissez une photo ou un PDF.') && (await texte('dialog[open]')).includes('Donnez un titre au document.'), 'envoi vide : deux messages clairs');
await controler('formulaire à 375 px', 'dialog[open]');
await axe('dialog[open]', 'formulaire document');

// ===== 2. Une photo : réduite =====
log('--- 2. Photo réduite ---');
const tailleOrigine = await choisir(photoGrosse);
verifier(await ev(`document.querySelector('dialog[open] #doc-titre').value`) === 'IMG 0042', 'le titre est proposé d’après le nom du fichier');
await ev(`(() => { const t = document.querySelector('dialog[open] #doc-titre'); t.value = 'Analyse sang 2026'; document.querySelector('dialog[open] #doc-date').value = '${jour(-12)}'; document.querySelector('dialog[open] #doc-type').value = 'analyse'; document.querySelector('dialog[open] form').requestSubmit(); })()`);
for (let i = 0; i < 40 && (await lister()).length < 1; i++) await dort(250);
await dort(500);
let liste = await lister();
verifier(liste.length === 1 && liste[0].titre === 'Analyse sang 2026' && liste[0].type === 'analyse' && liste[0].date === jour(-12) && liste[0].animalId === 'a', `document enregistré : ${JSON.stringify(liste[0])}`);
const dim = await ev(`import('/js/documents-db.js').then(async (d) => { const [x] = await d.listerDocuments('a'); const b = await createImageBitmap(x.blob); return { w: b.width, h: b.height, mime: x.blob.type }; })`);
verifier(dim.mime === 'image/jpeg' && Math.max(dim.w, dim.h) === 1600, `photo réduite : ${dim.w}×${dim.h} (origine 3200×2400), ${dim.mime}`);
verifier(liste[0].taille < tailleOrigine, `plus légère : ${liste[0].taille} octets au lieu de ${tailleOrigine}`);
verifier(await ev(`!document.querySelector('dialog[open]')`), 'la fenêtre se ferme après l’ajout');
verifier(await ev(`document.querySelectorAll('.dc-carte').length`) === 1 && await ev(`!!document.querySelector('.dc-carte img.dc-vignette__img')`), 'la carte du document apparaît avec sa vignette');
const carte = await texte('.dc-carte');
verifier(carte.includes('Analyse sang 2026') && carte.includes('Analyse') && /Ko|Mo/.test(carte), `carte : ${carte}`);

// ===== 3. Un PDF =====
log('--- 3. PDF ---');
await ev(`document.querySelector('#fi-panneau-documents [data-act=ajouter]').click()`); await dort(400);
await choisir(pdf);
await ev(`(() => { document.querySelector('dialog[open] #doc-type').value = 'ordonnance'; document.querySelector('dialog[open] form').requestSubmit(); })()`);
for (let i = 0; i < 40 && (await lister()).length < 2; i++) await dort(250);
await dort(500);
liste = await lister();
const doc2 = liste.find((d) => d.mime === 'application/pdf');
verifier(doc2 && doc2.titre === 'ordonnance dr martin' && doc2.type === 'ordonnance', `PDF gardé tel quel, titre d’après le fichier : ${JSON.stringify(doc2)}`);
verifier(await ev(`document.querySelectorAll('.dc-carte').length`) === 2 && await ev(`!!document.querySelector('.dc-vignette__pdf')`), 'deux cartes, la vignette « PDF » pour le PDF');
const espaceAffiche = await texte('[data-espace]');
const attendu = liste.reduce((n, d) => n + d.taille, 0);
verifier(espaceAffiche.includes('(2 documents') && (await ev(`import('/js/documents-db.js').then((d) => d.espaceDocuments())`)).octets === attendu, `espace utilisé mis à jour : ${espaceAffiche}`);
await controler('onglet Documents à 375 px');
await ecran('documents'); await axe('#fi-panneau-documents', 'onglet Documents');

// ===== 4. Ouvrir, télécharger =====
log('--- 4. Ouvrir et télécharger ---');
await ev(`document.querySelector('.dc-carte [data-act=ouvrir][aria-label*="Analyse"]').click()`); await dort(400);
verifier(await ev(`!!document.querySelector('dialog[open] img.dc-grande')`), 'la photo s’ouvre en grand dans une fenêtre');
await ev(`document.querySelector('dialog[open] [data-fermer]').click()`); await dort(300);
await ev(`document.querySelector('.dc-carte [data-act=ouvrir][aria-label*="ordonnance"]').click()`); await dort(300);
const ouvertures = await ev(`window.__ouvertures`);
verifier(ouvertures.length === 1 && ouvertures[0].startsWith('blob:'), 'le PDF s’ouvre dans un nouvel onglet (adresse blob: locale)');
await ev(`document.querySelector('.dc-carte [data-act=telecharger][aria-label*="Analyse"]').click()`); await dort(200);
const tel = await ev(`window.__telechargements`);
verifier(tel.length === 1 && /\.jpg$/.test(tel[0]) && tel[0].startsWith('Analyse'), `téléchargement : ${tel[0]}`);

// ===== 4 bis. Modifier titre, date et type =====
log('--- 4 bis. Modifier un document ---');
const avantModif = (await lister()).find((d) => d.mime === 'application/pdf');
await ev(`document.querySelector('.dc-carte [data-act=modifier][aria-label*="ordonnance"]').click()`); await dort(500);
verifier(await ev(`document.querySelector('dialog[open] #doc-titre').value`) === 'ordonnance dr martin' && await ev(`document.querySelector('dialog[open] #doc-type').value`) === 'ordonnance', 'la fenêtre propose le titre, la date et le type actuels');
await ev(`document.querySelector('dialog[open] #doc-titre').value = ''; document.querySelector('dialog[open] #doc-date').value = '${jour(9)}'; document.querySelector('dialog[open] form').requestSubmit()`); await dort(400);
verifier((await texte('dialog[open]')).includes('Donnez un titre au document.') && (await texte('dialog[open]')).includes('dans le futur'), 'titre vide et date future : messages clairs');
await controler('fenêtre Modifier à 375 px', 'dialog[open]');
await ev(`document.querySelector('dialog[open] #doc-titre').value = 'Ordonnance Dr Martin'; document.querySelector('dialog[open] #doc-date').value = '${jour(-30)}'; document.querySelector('dialog[open] #doc-type').value = 'analyse'; document.querySelector('dialog[open] form').requestSubmit()`); await dort(700);
const apresModif = (await lister()).find((d) => d.id === avantModif.id);
verifier(apresModif.titre === 'Ordonnance Dr Martin' && apresModif.date === jour(-30) && apresModif.type === 'analyse', `modifié : ${apresModif.titre}, ${apresModif.date}, ${apresModif.type}`);
verifier(apresModif.taille === avantModif.taille && apresModif.mime === 'application/pdf', 'le fichier lui-même n’a pas changé (même taille)');
verifier((await texte('.dc-carte[data-doc="' + avantModif.id + '"]')).includes('Ordonnance Dr Martin') && await ev(`document.querySelectorAll('.dc-carte').length`) === 2, 'la carte est mise à jour dans la liste');
await controler('onglet Documents (4 boutons par carte) à 375 px');
await ev(`import('/js/documents-db.js').then((d) => d.modifierDocument('${avantModif.id}', { titre: 'ordonnance dr martin', date: '${avantModif.date}', type: 'ordonnance' }))`);
await ouvrirOnglet('a');

// ===== 5. Les documents sont ceux de l'animal =====
log('--- 5. Un animal à la fois ---');
await ouvrirOnglet('b');
verifier(await ev(`document.querySelectorAll('.dc-carte').length`) === 0 && (await texte('#fi-panneau-documents')).includes('Aucun document'), 'la fiche de Filou n’affiche pas les documents de Moka');

// ===== 6. Export / import =====
log('--- 6. Export et import ---');
const exp = await ev(`import('/js/sauvegarde.js').then((m) => m.exporterTout())`);
const objet = JSON.parse(exp);
verifier(Array.isArray(objet.documents) && objet.documents.length === 2 && objet.documents.every((d) => d.donnees.length > 20 && d.animalId === 'a'), `l’export contient ${objet.documents?.length} documents (en base64)`);
verifier(objet.documents.find((d) => d.mime === 'application/pdf') && Buffer.from(objet.documents.find((d) => d.mime === 'application/pdf').donnees, 'base64').toString().startsWith('%PDF-1.4'), 'le contenu du PDF est intact dans le fichier');
const avantImport = await lister();
await ev(`import('/js/sauvegarde.js').then((m) => m.toutEffacerTout())`);
verifier((await lister()).length === 0 && JSON.parse(await donnees()).animaux.length === 0, 'effacement complet : plus de documents ni d’animaux');
const res = await ev(`import('/js/sauvegarde.js').then((m) => m.importerTout(${JSON.stringify(exp)}))`);
const apresImport = await lister();
verifier(res.documents === 2 && JSON.stringify(apresImport.map((d) => [d.id, d.titre, d.date, d.type, d.taille]).sort()) === JSON.stringify(avantImport.map((d) => [d.id, d.titre, d.date, d.type, d.taille]).sort()), 'après l’import : les mêmes documents (titres, dates, types, tailles)');
await ouvrirOnglet('a');
verifier(await ev(`document.querySelectorAll('.dc-carte').length`) === 2, 'ils réapparaissent dans la fiche');
const octetsOk = await ev(`import('/js/documents-db.js').then(async (d) => { const [x] = (await d.listerDocuments('a')).filter((y) => y.mime === 'application/pdf'); return new TextDecoder().decode(await x.blob.arrayBuffer()).startsWith('%PDF-1.4'); })`);
verifier(octetsOk, 'le PDF importé est identique');
// Un export plus ancien, sans documents : s'importe, et remplace les documents actuels
const ancien = await ev(`import('/js/sauvegarde.js').then((m) => m.importerTout(${JSON.stringify(JSON.stringify(fichier))}))`);
verifier(ancien.documents === 0 && (await lister()).length === 0, 'ancien export (sans documents) : importé, les documents actuels sont remplacés');
// Un document dont l'animal n'existe pas dans le fichier est ignoré
const orphelin = { ...objet, documents: [...objet.documents, { ...objet.documents[0], id: 'orphelin', animalId: 'inconnu' }, { id: 'casse', animalId: 'a', mime: 'image/png', date: '2026-01-01', donnees: '!!!pas du base64!!!' }] };
const r3 = await ev(`import('/js/sauvegarde.js').then((m) => m.importerTout(${JSON.stringify(JSON.stringify(orphelin))}))`);
verifier(r3.documents === 2 && r3.ignores === 2 && (await lister()).length === 2, `documents d’un animal inconnu ou abîmés : ignorés (${r3.ignores}), les autres gardés`);
let refuse = '';
try { await ev(`import('/js/sauvegarde.js').then((m) => m.importerTout('pas du json'))`); } catch (e) { refuse = e.message; }
verifier(refuse.includes('JSON illisible') && (await lister()).length === 2, 'fichier invalide : refusé, documents actuels intacts');

// ===== 7. Page Sauvegarde : taille, avertissement, Tout effacer =====
log('--- 7. Page Sauvegarde ---');
await aller('#/donnees'); await dort(700);
verifier(/Taille de la sauvegarde : environ .*\(dont 2 documents\)/.test(await texte('[data-taille]')), `taille annoncée : ${await texte('[data-taille]')}`);
verifier(await ev(`!document.querySelector('[data-gros] .cp-alerte')`), 'petite sauvegarde : pas d’avertissement');
// Un très gros document : l'avertissement apparaît
await ev(`import('/js/documents-db.js').then((d) => d.ajouterDocument({ animalId: 'a', titre: 'Énorme', date: '2026-01-01', type: 'autre', blob: new Blob([new Uint8Array(24 * 1024 * 1024)], { type: 'application/pdf' }), nom: 'enorme.pdf' }))`);
await ev(`import('/js/router.js').then((r) => r.rafraichir())`); await dort(1200);
verifier((await texte('[data-gros]')).includes('Sauvegarde volumineuse'), `sauvegarde de plus de 25 Mo : avertissement (${await texte('[data-taille]')})`);
await controler('page Sauvegarde à 375 px');
await ecran('sauvegarde-gros'); await axe('#contenu', 'sauvegarde');
await ev(`import('/js/documents-db.js').then(async (d) => { for (const x of await d.listerDocuments('a')) if (x.titre === 'Énorme') await d.supprimerDocument(x.id); })`);
// Tout effacer, par le bouton
await ev(`document.querySelector('[data-act=effacer]').click()`); await dort(400);
await ev(`document.querySelector('dialog[open] .cp-btn--danger, dialog[open] [data-confirmer], dialog[open] button[type=submit]')?.click()`); await dort(900);
verifier((await lister()).length === 0 && JSON.parse(await donnees()).animaux.length === 0, '« Tout effacer » efface aussi les documents');

// ===== 8. Supprimer un animal supprime ses documents ; supprimer un document =====
log('--- 8. Suppressions ---');
await importer(fichier);
await ev(`import('/js/documents-db.js').then((d) => d.ajouterDocument({ animalId: 'a', titre: 'Rage', date: '2026-02-02', type: 'vaccination', blob: new Blob(['%PDF-1.4 x'], { type: 'application/pdf' }), nom: 'r.pdf' }))`);
await ev(`import('/js/documents-db.js').then((d) => d.ajouterDocument({ animalId: 'b', titre: 'Puce', date: '2026-02-02', type: 'identification', blob: new Blob(['%PDF-1.4 y'], { type: 'application/pdf' }), nom: 'p.pdf' }))`);
await ouvrirOnglet('a');
await ev(`document.querySelector('.dc-carte [data-act=supprimer]').click()`); await dort(400);
verifier((await texte('dialog[open]')).includes('Supprimer « Rage »'), 'suppression d’un document : confirmation avec son titre');
await ev(`document.querySelector('dialog[open] .cp-btn--danger')?.click()`); await dort(800);
verifier((await lister()).map((d) => d.titre).join() === 'Puce', 'le document est supprimé, celui de l’autre animal reste');
await ev(`import('/js/storage.js').then((m) => m.supprimer('animaux', 'b'))`); await dort(600);
verifier((await lister()).length === 0, 'supprimer un animal supprime ses documents');

// ===== 9. Hors connexion et rien sur le réseau =====
log('--- 9. Hors connexion ---');
await importer(fichier);
await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
await ev(`window.__reseau.length = 0`);
await ouvrirOnglet('a');
await ev(`document.querySelector('#fi-panneau-documents [data-act=ajouter]').click()`); await dort(400);
await choisir(photoGrosse);
await ev(`(() => { document.querySelector('dialog[open] #doc-titre').value = 'Hors ligne'; document.querySelector('dialog[open] form').requestSubmit(); })()`);
for (let i = 0; i < 40 && (await lister()).length < 1; i++) await dort(250);
await dort(500);
verifier((await lister()).length === 1 && await ev(`document.querySelectorAll('.dc-carte').length`) === 1, 'hors connexion : ajout et affichage fonctionnent');
await ev(`document.querySelector('.dc-carte [data-act=ouvrir]').click()`); await dort(300);
verifier(await ev(`!!document.querySelector('dialog[open] img.dc-grande')`) && await ev(`document.querySelector('dialog[open] img.dc-grande').complete && document.querySelector('dialog[open] img.dc-grande').naturalWidth > 0`), 'hors connexion : la photo s’ouvre');
await ev(`document.querySelector('dialog[open] [data-fermer]').click()`);
verifier((await ev(`window.__reseau`)).length === 0, `aucune requête réseau pendant l’ajout et l’ouverture (${JSON.stringify(await ev(`window.__reseau`))})`);
await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

// Aller-retour export / import des données
const exp1 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
await ev(`import('/js/storage.js').then(m=>m.toutEffacer())`);
await ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(exp1)}))`);
const exp2 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
const net = (t) => { const o = JSON.parse(t); delete o.exporteLe; return JSON.stringify(o); };
fin(net(exp1) === net(exp2));
