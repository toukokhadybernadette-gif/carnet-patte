// Test « garde » : fiche de garde pour les pet-sitters (formulaire en sections repliables, aperçu, PDF, partage, export / import).
// Vérifie : bouton sur la fiche, sections repliables, enregistrement automatique, aperçu (sections remplies seulement, photo, âge, poids,
// vaccins, centres antipoison), PDF valide (structure, accents, photo, plusieurs pages), avertissement avant partage, export / import,
// hors connexion, écran de 375 px (aucun chevauchement), accessibilité.
import { ouvrirEdge, dort, jour } from './outil-cdp.mjs';

const [S, URL, TAG] = process.argv.slice(2);
const { send, ev, log, verifier, texte, ecran, donnees, aller, importer, axe, fin, taille, controler } = await ouvrirEdge({ sortie: S, balise: TAG, port: +(process.env.PORT || 9350) });

await send('Network.enable');
await send('Page.navigate', { url: URL }); await dort(1800);
await taille(375, 812);

// Une vraie photo JPEG (petite), pour l'animal
const photo = await ev(`(() => { const c = document.createElement('canvas'); c.width = 120; c.height = 90; const g = c.getContext('2d'); g.fillStyle = '#C9975B'; g.fillRect(0, 0, 120, 90); g.fillStyle = '#3B2A1E'; g.fillRect(40, 30, 40, 30); return c.toDataURL('image/jpeg', 0.8); })()`);
const fichier = { version: 1, exemplesAjoutes: true, exporteLe: '2026-01-01T00:00:00.000Z',
  animaux: [
    { id: 'a', nom: 'Moka', espece: 'chien', especeAutre: '', race: 'Berger australien', naissance: '2023-08-01', photo },
    { id: 'b', nom: 'Filou', espece: 'chat', especeAutre: '', race: '', naissance: '', photo: '' },
    { id: 'c', nom: 'Noisette', espece: 'lapin', especeAutre: '', race: '', naissance: '', photo: '' }],
  soins: [
    { id: 'v1', animalId: 'a', type: 'vaccin', titre: 'Rage', date: jour(-100), notes: '', rappel: jour(265), rappelFait: false },
    { id: 'v2', animalId: 'b', type: 'vaccin', titre: 'Typhus', date: jour(-400), notes: '', rappel: jour(-30), rappelFait: false }],
  pesees: [{ id: 'p1', animalId: 'a', date: jour(-20), poidsKg: 21.4 }] };
await importer(fichier);

// Capture des fichiers créés (PDF) et du partage
await ev(`(() => { window.__pdf = []; const o = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (b) => { if (b.type === 'application/pdf') b.arrayBuffer().then((t) => window.__pdf.push(Array.from(new Uint8Array(t)))); return o(b); };
  window.__telechargements = []; const clic = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) window.__telechargements.push(this.download); else clic.call(this); };
  window.__partages = []; navigator.canShare = () => true; navigator.share = async (d) => { window.__partages.push({ nom: d.files[0].name, type: d.files[0].type, taille: d.files[0].size, titre: d.title }); };
  window.__reseau = []; const f = window.fetch.bind(window); window.fetch = (...a) => { window.__reseau.push(String(a[0]?.url ?? a[0])); return f(...a); }; })()`);
const dernierPdf = async (n) => { for (let i = 0; i < 40 && (await ev(`window.__pdf.length`)) < n; i++) await dort(150); return Buffer.from(await ev(`window.__pdf[${n - 1}]`)); };

// Lecture d'un PDF : vérifie la structure (xref) et rend le texte lisible
const lirePdf = (buf) => {
  const s = buf.toString('latin1');
  const ok = { entete: s.startsWith('%PDF-1.4'), fin: s.trimEnd().endsWith('%%EOF') };
  const debut = Number(s.match(/startxref\n(\d+)/)[1]);
  const lignesXref = s.slice(debut).split('\n');
  const total = Number(lignesXref[1].split(' ')[1]);
  const offsets = lignesXref.slice(3, 2 + total).map((l) => Number(l.slice(0, 10)));
  ok.xref = s.slice(debut, debut + 4) === 'xref' && offsets.length === total - 1 && offsets.every((o, i) => s.slice(o, o + String(i + 1).length + 6) === `${i + 1} 0 obj`);
  const cp1252 = { 0x80: '€', 0x85: '…', 0x92: '’', 0x93: '“', 0x94: '”', 0x96: '–', 0x97: '—', 0x9C: 'œ', 0x8C: 'Œ' };
  const chaines = [...s.matchAll(/\(((?:[^()\\]|\\.)*)\) Tj/g)].map((m) => m[1].replace(/\\(\d{3})/g, (_, o) => { const n = parseInt(o, 8); return cp1252[n] ?? String.fromCharCode(n); }).replace(/\\([()\\])/g, '$1'));
  return { ok, texte: chaines.join('\n'), pages: Number((s.match(/\/Count (\d+)/) ?? [])[1] ?? 0), image: s.includes('/DCTDecode') && s.includes('/Im1 Do'), taille: buf.length };
};

// ===== 1. Bouton sur la fiche =====
log('--- 1. Accès depuis la fiche ---');
await aller('#/animaux/a');
verifier((await texte('.fi-garde a.cp-btn')) === 'Fiche de garde', 'bouton « Fiche de garde » sur la fiche de l’animal');
verifier(await ev(`document.querySelector('.fi-garde a.cp-btn').getAttribute('href')`) === '#/animaux/a/garde', 'il mène à la fiche de garde');
await controler('fiche de l’animal à 375 px');
await ev(`document.querySelector('.fi-garde a.cp-btn').click()`); await dort(600);

// ===== 2. Formulaire : sections repliables, enregistrement =====
log('--- 2. Formulaire ---');
verifier((await texte('h1')) === 'Fiche de garde de Moka', `titre : ${await texte('h1')}`);
const noms = await ev(`[...document.querySelectorAll('.gd-section__titre > span:nth-child(2)')].map((e) => e.textContent)`);
verifier(JSON.stringify(noms) === JSON.stringify(['Repas', 'Soins pendant la garde', 'Habitudes', 'Contacts', 'Infos pratiques']), `sections : ${noms.join(', ')}`);
verifier(await ev(`document.querySelectorAll('details.gd-section').length`) === 5 && await ev(`document.querySelectorAll('details.gd-section[open]').length`) === 1, 'cinq sections repliables, seule la première est ouverte');
await ev(`document.querySelector('[data-section=habitudes] summary').click()`); await dort(200);
verifier(await ev(`document.querySelector('[data-section=habitudes]').open`), 'toucher le titre d’une section l’ouvre');
await ev(`document.querySelector('[data-section=habitudes] summary').click()`); await dort(200);
verifier(!(await ev(`document.querySelector('[data-section=habitudes]').open`)), 'et la referme');
const champsAttendus = ['aliment', 'quantite', 'horaires', 'interdits', 'soinsGarde', 'promenades', 'litiere', 'sommeil', 'jouets', 'peurs', 'regles', 'proprietaireNom', 'proprietaireTel', 'secoursNom', 'secoursTel', 'vetoNom', 'vetoTel', 'infos'];
verifier(JSON.stringify(await ev(`[...document.querySelectorAll('.gd-form [name]')].map((e) => e.name)`)) === JSON.stringify(champsAttendus), 'tous les champs : repas (aliment, quantité, horaires, interdits), soins, habitudes (promenades, litière, sommeil, jouets, peurs, règles), contacts, infos pratiques');
verifier(await ev(`[...document.querySelectorAll('.gd-form [name]')].every((e) => !e.required)`), 'aucun champ obligatoire');
await ev(`document.querySelectorAll('details.gd-section').forEach((d) => { d.open = true; })`);
await controler('formulaire à 375 px', '#contenu');
await ecran('garde-formulaire'); await axe('#contenu', 'formulaire fiche de garde');
const remplir = (nom, valeur) => ev(`(() => { const e = document.querySelector('.gd-form [name=${nom}]'); e.value = ${JSON.stringify(valeur)}; e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
await remplir('aliment', 'Croquettes « Sensible » à l’été');
await remplir('quantite', '150 g par repas');
await remplir('horaires', '8 h et 18 h');
await remplir('interdits', 'Pas de chocolat\nPas de restes de table');
await remplir('promenades', 'Deux sorties, toujours en laisse');
await remplir('peurs', 'Aspirateur, orages ; œil sur les feux d’artifice');
await remplir('proprietaireNom', 'Léa Dupont'); await remplir('proprietaireTel', '06 12 34 56 78');
await remplir('vetoNom', 'Clinique des Écureuils'); await remplir('vetoTel', '02 99 00 11 22');
const stock = JSON.parse(await donnees()).fichesGarde?.a;
verifier(stock?.aliment === 'Croquettes « Sensible » à l’été' && stock?.vetoTel === '02 99 00 11 22' && !('soinsGarde' in stock) && !('infos' in stock), `enregistré à chaque modification, champs vides non gardés : ${Object.keys(stock ?? {}).join(', ')}`);
verifier((await texte('[data-section=repas] [data-nb]')) === '4 remplis' && (await texte('[data-section=soins] [data-nb]')) === '', `compteur par section : « ${await texte('[data-section=repas] [data-nb]')} »`);
verifier(!(await ev(`!!document.querySelector('.gd-form [name=aliment]').closest('form').querySelector('[required]')`)), 'aucun champ requis');
await ev(`document.querySelector('.gd-form').requestSubmit()`); await dort(300);
verifier((await texte('.cp-notifs')).includes('Fiche de garde enregistrée'), 'bouton « Enregistrer » : confirmation');

// ===== 3. Aperçu =====
log('--- 3. Aperçu ---');
await ev(`document.querySelector('[data-apercu]').click()`); await dort(700);
verifier(await ev(`location.hash`) === '#/animaux/a/garde/apercu', 'le bouton ouvre l’aperçu');
const feuille = await texte('[data-feuille]');
verifier(/Moka/.test(feuille) && /Chien · Berger australien · 3 ans/.test(feuille), `identité : ${feuille.slice(0, 60)}`);
verifier(/Poids : 21,4 kg/.test(feuille), 'dernier poids affiché');
verifier(await ev(`!!document.querySelector('[data-feuille] img.cp-avatar__img, [data-feuille] img')`), 'photo de l’animal');
verifier(/Vaccins : À jour · dernier : Rage/.test(feuille), `vaccins à jour : ${(feuille.match(/Vaccins : [^·]*·[^·]*/) ?? [''])[0]}`);
const titres = await ev(`[...document.querySelectorAll('[data-feuille] h3')].map((e) => e.textContent)`);
verifier(JSON.stringify(titres) === JSON.stringify(['Repas', 'Habitudes', 'Contacts', 'En cas d\'ingestion ou d\'intoxication']), `sections remplies seulement : ${titres.join(' | ')}`);
verifier(!/Soins pendant la garde|Infos pratiques/.test(feuille), 'les sections vides ne sont pas affichées');
verifier(/04 78 87 10 40/.test(feuille) && /02 40 68 77 40/.test(feuille) && /CNITV/.test(feuille) && /CAPAE/.test(feuille), 'numéros des centres antipoison vétérinaires');
verifier(await ev(`!!document.querySelector('[data-feuille] a[href="tel:+33478871040"]') && !!document.querySelector('[data-feuille] a[href="tel:0612345678"]')`), 'les numéros sont cliquables (tel:)');
verifier((await texte('.cp-alerte')).includes('Vérifiez les infos. N\'ajoutez pas de code d\'alarme ou de clés.'), 'avertissement affiché');
verifier((await texte('[data-act=pdf]')) === 'Télécharger en PDF' && (await texte('[data-act=partager]')) === 'Partager', 'boutons « Télécharger en PDF » et « Partager »');
verifier(await ev(`document.querySelector('[data-feuille]').textContent.includes('Pas de chocolat')`) && await ev(`getComputedStyle(document.querySelector('.gd-liste dd')).whiteSpace`) === 'pre-line', 'les retours à la ligne saisis sont gardés');
await controler('aperçu à 375 px');
await ecran('garde-apercu'); await axe('#contenu', 'aperçu fiche de garde');
// Vaccins en retard / inconnus
await importer({ ...fichier, fichesGarde: { b: { aliment: 'Pâtée' } } });
await aller('#/animaux/b/garde/apercu'); await dort(400);
verifier(/Vaccins : À renouveler : Typhus/.test(await texte('[data-feuille]')), 'vaccin en retard : « À renouveler »');
await aller('#/animaux/c/garde/apercu'); await dort(400);
verifier(/Vaccins : Non renseigné/.test(await texte('[data-feuille]')) && /Aucune information supplémentaire remplie/.test(await texte('[data-feuille]')) && !/Repas/.test(await texte('[data-feuille]')), 'animal sans vaccin ni fiche : « Non renseigné », aucune section');
await aller('#/animaux/inconnu/garde'); await dort(300);
verifier((await texte('#contenu')).includes("n'existe pas"), 'animal inconnu : message clair');
await importer({ ...fichier, fichesGarde: { a: stock } });

// ===== 4. PDF =====
log('--- 4. PDF ---');
await aller('#/animaux/a/garde/apercu'); await dort(500);
await ev(`document.querySelector('[data-act=pdf]').click()`);
const buf = await dernierPdf(1);
const p = lirePdf(buf);
verifier(p.ok.entete && p.ok.fin && p.ok.xref, `PDF valide : en-tête, %%EOF, table xref exacte (${p.taille} octets)`);
verifier((await ev(`window.__telechargements`))[0] === 'fiche-de-garde-moka.pdf', `fichier : ${(await ev(`window.__telechargements`))[0]}`);
verifier(p.pages === 1 && p.image, 'une page, avec la photo de l’animal (JPEG)');
verifier(/FICHE DE GARDE/.test(p.texte) && /\nMoka\n/.test(`\n${p.texte}\n`) && /Chien · Berger australien · 3 ans/.test(p.texte), 'titre, nom, identité dans le PDF');
verifier(/Croquettes « Sensible » à l’été/.test(p.texte) && /Clinique des Écureuils/.test(p.texte) && /œil sur les feux d’artifice/.test(p.texte), 'accents, guillemets français, apostrophe typographique et « œ » bien encodés');
verifier(/Pas de chocolat/.test(p.texte) && /Pas de restes de table/.test(p.texte), 'texte sur plusieurs lignes');
verifier(/04 78 87 10 40/.test(p.texte) && /02 40 68 77 40/.test(p.texte) && /Vaccins : À jour/.test(p.texte) && /Poids : 21,4 kg/.test(p.texte), 'vaccins, poids, numéros des centres antipoison');
verifier(!/Soins pendant la garde|Infos pratiques/.test(p.texte) && /Repas/.test(p.texte) && /Habitudes/.test(p.texte) && /Contacts/.test(p.texte), 'sections remplies seulement');
verifier(/page 1 sur 1/.test(p.texte), 'pied de page numéroté');
// Un texte très long : plusieurs pages, rien de perdu
const long = (c) => Array.from({ length: 70 }, (_, k) => `${c} ${k + 1} : consigne.`).join('\n');
await ev(`import('/js/storage.js').then((m) => m.enregistrerFicheGarde('a', { infos: ${JSON.stringify(long('Infos'))}, soinsGarde: ${JSON.stringify(long('Soin'))}, regles: ${JSON.stringify(long('Règle'))}, peurs: ${JSON.stringify(long('Peur'))}, aliment: 'Mot' + 'x'.repeat(200) }))`);
await ev(`import('/js/router.js').then((r) => r.rafraichir())`); await dort(500);
await ev(`document.querySelector('[data-act=pdf]').click()`);
const p2 = lirePdf(await dernierPdf(2));
verifier(p2.ok.xref && p2.pages >= 3 && /Infos 1 :/.test(p2.texte) && /Infos 70 :/.test(p2.texte) && /Règle 70 :/.test(p2.texte) && /Peur 70 :/.test(p2.texte) && /Soin 1 :/.test(p2.texte) && /page 3 sur \d/.test(p2.texte), `très long : ${p2.pages} pages, début et fin de chaque section présents`);
verifier(!/\(\s*Mot/.test('') && /xxxxx/.test(p2.texte), 'un mot plus long que la ligne est coupé (rien n’est perdu)');
await importer({ ...fichier, fichesGarde: { a: stock } });

// ===== 5. Partager =====
log('--- 5. Partager ---');
await aller('#/animaux/a/garde/apercu'); await dort(500);
await ev(`document.querySelector('[data-act=partager]').click()`); await dort(500);
verifier((await texte('dialog[open]')).includes('Vérifiez les infos. N\'ajoutez pas de code d\'alarme ou de clés.'), 'avertissement dans une fenêtre avant le partage');
await ev(`document.querySelector('dialog[open] [data-fermer], dialog[open] .cp-btn--secondaire')?.click()`); await dort(400);
verifier((await ev(`window.__partages.length`)) === 0 && await ev(`!document.querySelector('dialog[open]')`), 'annuler : rien n’est partagé');
await ev(`document.querySelector('[data-act=partager]').click()`); await dort(500);
await ev(`[...document.querySelectorAll('dialog[open] button')].find((b) => b.textContent.trim() === 'Partager').click()`); await dort(800);
const partages = await ev(`window.__partages`);
verifier(partages.length === 1 && partages[0].nom === 'fiche-de-garde-moka.pdf' && partages[0].type === 'application/pdf' && partages[0].taille > 1000, `confirmer : le PDF est partagé (${JSON.stringify(partages[0])})`);
// Appareil sans partage de fichiers : le PDF est téléchargé
await ev(`navigator.canShare = () => false; window.__telechargements.length = 0`);
await ev(`document.querySelector('[data-act=partager]').click()`); await dort(500);
await ev(`[...document.querySelectorAll('dialog[open] button')].find((b) => b.textContent.trim() === 'Partager').click()`); await dort(900);
verifier((await ev(`window.__telechargements`))[0] === 'fiche-de-garde-moka.pdf' && (await texte('.cp-notifs')).includes('le PDF a été téléchargé'), 'sans partage de fichiers : le PDF est téléchargé, avec un message');

// ===== 6. Hors connexion : rien sur le réseau =====
log('--- 6. Hors connexion ---');
await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
await ev(`window.__reseau.length = 0; window.__pdf.length = 0`);
await aller('#/animaux/a/garde'); await dort(400);
await remplir('infos', 'Clé sous le pot, à gauche'); // un texte quelconque
await aller('#/animaux/a/garde/apercu'); await dort(400);
await ev(`document.querySelector('[data-act=pdf]').click()`);
const p3 = lirePdf(await dernierPdf(1));
verifier(p3.ok.xref && /Clé sous le pot/.test(p3.texte), 'hors connexion : fiche enregistrée et PDF créé');
verifier((await ev(`window.__reseau`)).length === 0, 'aucune requête réseau');
await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
await importer({ ...fichier, fichesGarde: { a: stock } });

// ===== 7. Export / import =====
log('--- 7. Export et import ---');
const exp = await ev(`import('/js/sauvegarde.js').then((m) => m.exporterTout())`);
verifier(JSON.parse(exp).fichesGarde?.a?.aliment === 'Croquettes « Sensible » à l’été', 'la fiche est dans le fichier d’export');
await ev(`import('/js/sauvegarde.js').then((m) => m.toutEffacerTout())`);
verifier(JSON.stringify(JSON.parse(await donnees()).fichesGarde) === '{}', '« Tout effacer » efface les fiches');
await ev(`import('/js/sauvegarde.js').then((m) => m.importerTout(${JSON.stringify(exp)}))`);
verifier(JSON.stringify(JSON.parse(await donnees()).fichesGarde.a) === JSON.stringify(stock), 'import : la fiche revient identique');
await ev(`import('/js/storage.js').then((m) => m.importer(${JSON.stringify(JSON.stringify(fichier))}))`);
verifier(JSON.stringify(JSON.parse(await donnees()).fichesGarde) === '{}', 'ancien export sans fiche : importé normalement');
const avecInconnu = { ...fichier, fichesGarde: { a: { aliment: 'Pâtée', champInconnu: 'x' }, fantome: { aliment: 'Zut' }, b: 'pas un objet' } };
await ev(`import('/js/storage.js').then((m) => m.importer(${JSON.stringify(JSON.stringify(avecInconnu))}))`);
const fg = JSON.parse(await donnees()).fichesGarde;
verifier(JSON.stringify(fg) === JSON.stringify({ a: { aliment: 'Pâtée' } }), `fiche d’un animal inconnu, champ inconnu, valeur invalide : ignorés (${JSON.stringify(fg)})`);
await ev(`import('/js/storage.js').then((m) => m.supprimer('animaux', 'a'))`);
verifier(JSON.stringify(JSON.parse(await donnees()).fichesGarde) === '{}', 'supprimer un animal supprime sa fiche de garde');

// Aller-retour export / import des données
await importer({ ...fichier, fichesGarde: { a: stock } });
const exp1 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
await ev(`import('/js/storage.js').then(m=>m.toutEffacer())`);
await ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(exp1)}))`);
const exp2 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
const net = (t) => { const o = JSON.parse(t); delete o.exporteLe; return JSON.stringify(o); };
fin(net(exp1) === net(exp2));
