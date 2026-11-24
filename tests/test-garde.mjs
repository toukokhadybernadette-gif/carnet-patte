// Test « garde » : fiche de garde pour les pet-sitters (formulaire en sections repliables, aperçu en cartes, PDF soigné, partage, export / import).
// Vérifie : bouton sur la fiche, sections repliables, nouveaux champs (dates de garde, traitements, puce et tatouage, habitudes), migration douce d'une fiche
// enregistrée avant les nouveautés, vaccins (dernier, prochain rappel, « Ajouter un vaccin »), enregistrement automatique, aperçu (grande photo ronde, urgences,
// cartes, suivi du jour cochable), PDF (structure, accents, photo ronde, centres antipoison tels que dans l'appli, couleurs du thème, une page, rien ne dépasse,
// deux pages pour un très long texte), avertissement avant partage, export / import, hors connexion, écran de 375 px, accessibilité.
import { ouvrirEdge, dort, jour } from './outil-cdp.mjs';

const [S, URL, TAG] = process.argv.slice(2);
const { send, ev, log, verifier, texte, ecran, donnees, aller, importer, axe, fin, taille, controler } = await ouvrirEdge({ sortie: S, balise: TAG, port: +(process.env.PORT || 9350) });

await send('Network.enable');
await send('Page.navigate', { url: URL }); await dort(1800);
await taille(375, 812);

// Une vraie photo JPEG (petite), pour l'animal
const photo = await ev(`(() => { const c = document.createElement('canvas'); c.width = 120; c.height = 90; const g = c.getContext('2d'); g.fillStyle = '#C9975B'; g.fillRect(0, 0, 120, 90); g.fillStyle = '#3B2A1E'; g.fillRect(40, 30, 40, 30); return c.toDataURL('image/jpeg', 0.9); })()`);
const fichier = { version: 1, exemplesAjoutes: true, exporteLe: '2026-01-01T00:00:00.000Z',
  animaux: [
    { id: 'a', nom: 'Moka', espece: 'chien', especeAutre: '', race: 'Berger australien', naissance: '2023-08-01', photo },
    { id: 'b', nom: 'Filou', espece: 'chat', especeAutre: '', race: '', naissance: '', photo: '' },
    { id: 'c', nom: 'Noisette', espece: 'lapin', especeAutre: '', race: '', naissance: '', photo: '' }],
  soins: [
    { id: 'v1', animalId: 'a', type: 'vaccin', titre: 'Rage', date: jour(-100), notes: '', rappel: jour(265), rappelFait: false },
    { id: 'v2', animalId: 'b', type: 'vaccin', titre: 'Typhus', date: jour(-400), notes: '', rappel: jour(-30), rappelFait: false }],
  pesees: [{ id: 'p1', animalId: 'a', date: jour(-20), poidsKg: 21.4 }] };
// Une fiche enregistrée AVANT les nouveautés (anciens champs seulement) : elle doit s'ouvrir à l'identique
const ancienne = { aliment: 'Pâtée du matin', secoursNom: 'Tante Rose', secoursTel: '06 99 88 77 66', vetoNom: 'Dr Lemaire', infos: 'Clé chez la voisine' };
await importer({ ...fichier, fichesGarde: { a: ancienne } });

// Capture des fichiers créés (PDF) et du partage
await ev(`(() => { window.__pdf = []; const o = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (b) => { if (b.type === 'application/pdf') b.arrayBuffer().then((t) => window.__pdf.push(Array.from(new Uint8Array(t)))); return o(b); };
  window.__telechargements = []; const clic = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) window.__telechargements.push(this.download); else clic.call(this); };
  window.__partages = []; navigator.canShare = () => true; navigator.share = async (d) => { window.__partages.push({ nom: d.files[0].name, type: d.files[0].type, taille: d.files[0].size, titre: d.title }); };
  window.__reseau = []; const f = window.fetch.bind(window); window.fetch = (...a) => { window.__reseau.push(String(a[0]?.url ?? a[0])); return f(...a); }; })()`);
const dernierPdf = async (n) => { for (let i = 0; i < 40 && (await ev(`window.__pdf.length`)) < n; i++) await dort(150); return Buffer.from(await ev(`window.__pdf[${n - 1}]`)); };

// Lecture d'un PDF : vérifie la structure (xref), rend le texte lisible et relève les couleurs
const lirePdf = (buf) => {
  const s = buf.toString('latin1');
  const ok = { entete: s.startsWith('%PDF-1.4'), fin: s.trimEnd().endsWith('%%EOF') };
  const debut = Number(s.match(/startxref\n(\d+)/)[1]);
  const lignesXref = s.slice(debut).split('\n');
  const total = Number(lignesXref[1].split(' ')[1]);
  const offsets = lignesXref.slice(3, 2 + total).map((l) => Number(l.slice(0, 10)));
  ok.xref = s.slice(debut, debut + 4) === 'xref' && offsets.length === total - 1 && offsets.every((o, i) => s.slice(o, o + String(i + 1).length + 6) === `${i + 1} 0 obj`);
  const cp1252 = { 0x80: '€', 0x85: '…', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x9C: 'œ', 0x8C: 'Œ' };
  const chaines = [...s.matchAll(/\(((?:[^()\\]|\\.)*)\) Tj/g)].map((m) => m[1].replace(/\\(\d{3})/g, (_, o) => { const n = parseInt(o, 8); return cp1252[n] ?? String.fromCharCode(n); }).replace(/\\([()\\])/g, '$1'));
  const couleurs = new Set([...s.matchAll(/([\d.]+ [\d.]+ [\d.]+) rg/g)].map((m) => m[1]));
  const textes = [...s.matchAll(/\/F[12] [\d.]+ Tf ([\d.]+) ([\d.]+) ([\d.]+) rg/g)].map((m) => [m[1], m[2], m[3]].map(Number));
  return { ok, s, texte: chaines.join('\n'), pages: Number((s.match(/\/Count (\d+)/) ?? [])[1] ?? 0), image: s.includes('/DCTDecode') && s.includes('/Im1 Do'), rond: / W n [\d.]+ 0 0 [\d.]+ [\d.-]+ [\d.-]+ cm \/Im1 Do/.test(s), couleurs, textes, traits: (s.match(/\sS Q/g) ?? []).length, taille: buf.length };
};
const lum = ([r, g, b]) => { const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };

// ===== 1. Bouton sur la fiche =====
log('--- 1. Accès depuis la fiche ---');
await aller('#/animaux/a');
verifier((await texte('.fi-garde a.cp-btn')) === 'Fiche de garde', 'bouton « Fiche de garde » sur la fiche de l’animal');
verifier(await ev(`document.querySelector('.fi-garde a.cp-btn').getAttribute('href')`) === '#/animaux/a/garde', 'il mène à la fiche de garde');
await controler('fiche de l’animal à 375 px');
await ev(`document.querySelector('.fi-garde a.cp-btn').click()`); await dort(600);

// ===== 2. Formulaire : sections repliables, migration douce, nouveaux champs =====
log('--- 2. Formulaire ---');
verifier((await texte('h1')) === 'Fiche de garde de Moka', `titre : ${await texte('h1')}`);
verifier(await ev(`document.querySelector('.gd-hero .gd-photo img')?.getBoundingClientRect().width >= 100`) || await ev(`document.querySelector('.gd-hero .gd-photo .cp-avatar').getBoundingClientRect().width >= 100`), 'grande photo ronde de l’animal en tête (au moins 100 px)');
const noms = await ev(`[...document.querySelectorAll('.gd-section__titre > span:nth-child(2)')].map((e) => e.textContent)`);
verifier(JSON.stringify(noms) === JSON.stringify(['Dates de garde', 'Repas', 'Santé et traitements', 'Habitudes', 'Contacts', 'Infos pratiques']), `sections : ${noms.join(', ')}`);
verifier(await ev(`document.querySelectorAll('details.gd-section').length`) === 6, 'six sections repliables');
await ev(`document.querySelector('[data-section=habitudes] summary').click()`); await dort(200);
const habOuverte = await ev(`document.querySelector('[data-section=habitudes]').open`);
await ev(`document.querySelector('[data-section=habitudes] summary').click()`); await dort(200);
verifier(habOuverte && !(await ev(`document.querySelector('[data-section=habitudes]').open`)), 'toucher le titre d’une section l’ouvre, puis la referme');
const champsAttendus = ['gardeDu', 'gardeAu', 'aliment', 'quantite', 'horaires', 'interdits', 'puce', 'tatouage', 'soinsGarde', 'promenades', 'litiere', 'sommeil', 'aime', 'jouets', 'peurs', 'nePasFaire', 'regles', 'proprietaireNom', 'proprietaireTel', 'vetoNom', 'vetoTel', 'secoursNom', 'secoursTel', 'infos'];
verifier(JSON.stringify(await ev(`[...document.querySelectorAll('.gd-form [name]')].map((e) => e.name)`)) === JSON.stringify(champsAttendus), 'tous les champs : dates, repas, puce et tatouage, soins, habitudes (aime, ne pas faire…), contacts, infos pratiques');
verifier(await ev(`[...document.querySelectorAll('.gd-form [name]')].every((e) => !e.required)`), 'aucun champ obligatoire');
const libelles = await ev(`[...document.querySelectorAll('.gd-form label')].map((l) => l.textContent.trim())`);
verifier(libelles.includes('Personne à prévenir en urgence (nom)') && libelles.includes('Vétérinaire habituel (téléphone)') && libelles.includes('Numéro de puce (transpondeur)') && libelles.includes('Ce qu\'il ne faut pas faire'), 'libellés : personne à prévenir en urgence, vétérinaire habituel, puce, ce qu’il ne faut pas faire');
// Migration douce : l'ancienne fiche s'affiche telle quelle, et l'ouvrir ne la modifie pas
const valeurs = await ev(`Object.fromEntries([...document.querySelectorAll('.gd-form [name]')].map((e) => [e.name, e.value]))`);
verifier(valeurs.aliment === ancienne.aliment && valeurs.secoursNom === ancienne.secoursNom && valeurs.secoursTel === ancienne.secoursTel && valeurs.vetoNom === ancienne.vetoNom && valeurs.infos === ancienne.infos && valeurs.puce === '' && valeurs.gardeDu === '', 'une fiche enregistrée avant les nouveautés s’ouvre à l’identique : rien n’est perdu, les nouveaux champs sont vides');
verifier(JSON.stringify(JSON.parse(await donnees()).fichesGarde.a) === JSON.stringify(ancienne), 'et l’ouvrir ne la modifie pas');
// Vaccins dans la section Santé (les sections repliées ne sont pas lisibles : on les ouvre)
await ev(`document.querySelectorAll('details.gd-section').forEach((d) => { d.open = true; })`);
const vac = await texte('[data-vaccins]');
verifier(vac.includes('Dernier vaccin : Rage') && /Prochain rappel : Rage/.test(vac), `santé : dernier vaccin et prochain rappel (« ${vac.replace(/\s+/g, ' ').slice(0, 90)} »)`);
await ev(`document.querySelectorAll('details.gd-section').forEach((d) => { d.open = true; })`);
await controler('formulaire à 375 px', '#contenu');
await ecran('garde-formulaire'); await axe('#contenu', 'formulaire fiche de garde');
const remplir = (nom, valeur) => ev(`(() => { const e = document.querySelector('.gd-form [name=${nom}]'); e.value = ${JSON.stringify(valeur)}; e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
await remplir('aliment', 'Croquettes « Sensible » à l’été');
await remplir('quantite', '150 g par repas');
await remplir('horaires', '8 h et 18 h');
await remplir('interdits', 'Pas de chocolat\nPas de restes de table');
await remplir('puce', '250 26 00 12 34 56 78');
await remplir('tatouage', 'ABC 123');
await remplir('promenades', 'Deux sorties, toujours en laisse');
await remplir('aime', 'Les câlins, la balle jaune');
await remplir('peurs', 'Aspirateur, orages ; œil sur les feux d’artifice');
await remplir('nePasFaire', 'Ne pas le laisser seul au jardin');
await remplir('proprietaireNom', 'Léa Dupont'); await remplir('proprietaireTel', '06 12 34 56 78');
await remplir('vetoNom', 'Clinique des Écureuils'); await remplir('vetoTel', '02 99 00 11 22');
await remplir('gardeDu', jour(0)); await remplir('gardeAu', jour(3));
// Traitements : ajouter, remplir, retirer
await ev(`document.querySelector('[data-ajouter-trait]').click()`); await dort(200);
await ev(`document.querySelector('[data-ajouter-trait]').click()`); await dort(200);
verifier(await ev(`document.querySelectorAll('[data-trait]').length`) === 2 && await ev(`document.querySelector('[data-aucun-trait]').hidden`), '« Ajouter un traitement » ajoute des lignes (médicament, dose, horaires)');
const remplirTrait = (i, nom, dose, horaires) => ev(`(() => { const r = document.querySelectorAll('[data-trait]')[${i}]; for (const [k, v] of Object.entries(${JSON.stringify({ nom, dose, horaires })})) { const e = r.querySelector('[data-t=' + k + ']'); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); } })()`);
await remplirTrait(0, 'Apoquel', '1 comprimé', 'le soir, pendant le repas');
await remplirTrait(1, 'Gouttes oculaires', '2 gouttes', 'matin et soir');
let stock = JSON.parse(await donnees()).fichesGarde?.a;
verifier(stock.traitements?.length === 2 && stock.traitements[0].nom === 'Apoquel' && stock.traitements[1].horaires === 'matin et soir', 'les traitements sont enregistrés (liste de médicament, dose, horaires)');
verifier(stock.puce === '250 26 00 12 34 56 78' && stock.aime === 'Les câlins, la balle jaune' && stock.gardeDu === jour(0) && stock.aliment === 'Croquettes « Sensible » à l’été' && stock.secoursNom === ancienne.secoursNom && stock.infos === ancienne.infos, 'les nouveaux champs sont enregistrés, les anciens sont toujours là');
verifier((await texte('[data-section=sante] [data-nb]')) === '4 remplis' && (await texte('[data-section=repas] [data-nb]')) === '4 remplis', `compteurs par section : santé « ${await texte('[data-section=sante] [data-nb]')} », repas « ${await texte('[data-section=repas] [data-nb]')} »`);
await ev(`document.querySelectorAll('[data-trait]')[1].querySelector('[data-retirer-trait]').click()`); await dort(300);
stock = JSON.parse(await donnees()).fichesGarde?.a;
verifier(stock.traitements.length === 1 && stock.traitements[0].nom === 'Apoquel', '« Retirer » supprime la ligne choisie');
for (let i = 0; i < 10; i++) await ev(`document.querySelector('[data-ajouter-trait]').click()`);
verifier(await ev(`document.querySelectorAll('[data-trait]').length`) === 8, 'huit traitements au plus');
for (let i = 7; i >= 1; i--) await ev(`document.querySelectorAll('[data-trait]')[${i}].querySelector('[data-retirer-trait]').click()`);
await dort(300);
// Dates incohérentes : message, la date de fin n'est pas gardée
await remplir('gardeAu', jour(-5)); await dort(200);
stock = JSON.parse(await donnees()).fichesGarde?.a;
verifier(!(await ev(`document.querySelector('[data-date-erreur]').hidden`)) && !stock.gardeAu && stock.gardeDu === jour(0), 'date de fin avant le début : message clair, elle n’est pas enregistrée');
await remplir('gardeAu', jour(3));
// Ajouter un vaccin quand il n'y en a pas (animal Noisette)
await aller('#/animaux/c/garde'); await dort(500);
await ev(`document.querySelectorAll('details.gd-section').forEach((d) => { d.open = true; })`);
verifier((await texte('[data-vaccins]')).includes('Aucun vaccin enregistré') && await ev(`!!document.querySelector('[data-vaccins] [data-act=ajouter-vaccin]')`), 'sans vaccin : « Aucun vaccin enregistré » et un bouton « Ajouter un vaccin »');
await ev(`document.querySelector('[data-vaccins] [data-act=ajouter-vaccin]').click()`); await dort(500);
verifier(await ev(`document.querySelector('dialog[open] input[name=type][value=vaccin]').checked`), 'il ouvre le formulaire de soin, déjà sur « Vaccin »');
await ev(`(() => { const f = document.querySelector('dialog[open] form'); f.titre.value = 'Myxomatose'; f.date.value = '${jour(-20)}'; f.rappel.value = '${jour(345)}'; f.requestSubmit(); })()`); await dort(700);
await ev(`document.querySelectorAll('details.gd-section').forEach((d) => { d.open = true; })`);
const vac2 = await texte('[data-vaccins]');
verifier(vac2.includes('Dernier vaccin : Myxomatose') && /Prochain rappel : Myxomatose/.test(vac2), 'après l’ajout : le dernier vaccin et le prochain rappel apparaissent');
await aller('#/animaux/a/garde'); await dort(500);
await ev(`document.querySelector('.gd-form').requestSubmit()`); await dort(300);
verifier((await texte('.cp-notifs')).includes('Fiche de garde enregistrée'), 'bouton « Enregistrer » : confirmation');

// ===== 3. Aperçu =====
log('--- 3. Aperçu ---');
await ev(`document.querySelector('[data-apercu]').click()`); await dort(700);
verifier(await ev(`location.hash`) === '#/animaux/a/garde/apercu', 'le bouton ouvre l’aperçu');
const feuille = await texte('[data-feuille]');
verifier(/Moka/.test(feuille) && /Chien · Berger australien · 3 ans/.test(feuille) && /Poids : 21,4 kg/.test(feuille), `identité et poids : ${feuille.slice(0, 70).replace(/\s+/g, ' ')}`);
verifier(await ev(`document.querySelector('[data-feuille] .gd-photo img') !== null && document.querySelector('[data-feuille] .gd-photo .cp-avatar').getBoundingClientRect().width >= 100`), 'grande photo ronde de l’animal');
verifier(/Garde du .* au /.test(await texte('.gd-garde-pastille')), `dates de garde : « ${await texte('.gd-garde-pastille')} »`);
const centres = await ev(`import('/modules/toxique/donnees.js').then((m) => m.CENTRES_ANTIPOISON)`);
const urg = await texte('.gd-carte--urgence');
verifier(urg.includes('Urgences') && centres.every((c) => urg.includes(c.nom) && urg.includes(c.tel) && urg.includes(c.horaires)), 'bloc « Urgences » : les centres antipoison et leurs horaires sont EXACTEMENT ceux de l’appli (' + centres.map((c) => `${c.nom} ${c.horaires}`).join(' ; ') + ')');
verifier(urg.includes('En dehors de ces horaires : appelez votre vétérinaire ou une clinique vétérinaire de garde.') && !/24 ?h ?\/ ?24|24 heures/.test(feuille), 'phrase « En dehors de ces horaires… » présente, aucun « 24 h/24 » inventé');
verifier(/Clinique des Écureuils/.test(urg) && /Léa Dupont/.test(urg) && /Tante Rose/.test(urg) && /Personne à prévenir en urgence/.test(urg), 'urgences : vétérinaire, personne à prévenir, propriétaire');
verifier(await ev(`getComputedStyle(document.querySelector('.gd-carte--urgence')).borderTopWidth`) === '2px', 'le bloc Urgences est bien visible (cadre épais, couleur d’alerte)');
const titres = await ev(`[...document.querySelectorAll('[data-feuille] h2')].map((e) => e.textContent.trim())`);
verifier(JSON.stringify(titres) === JSON.stringify(['Urgences', 'Santé', 'Repas', 'Habitudes', 'Infos pratiques', 'Suivi du jour']), `cartes : ${titres.join(' | ')}`);
const sante = await texte('[aria-labelledby=gd-t-sante]');
verifier(/Dernier vaccin : Rage/.test(sante) && /Prochain rappel : Rage/.test(sante) && /Apoquel/.test(sante) && /1 comprimé/.test(sante) && /250 26 00 12 34 56 78/.test(sante) && /ABC 123/.test(sante), 'santé : vaccins, traitement, puce, tatouage');
verifier(await ev(`!!document.querySelector('[data-feuille] a[href="tel:+33478871040"]') && !!document.querySelector('[data-feuille] a[href="tel:0612345678"]')`), 'les numéros sont cliquables (tel:)');
verifier((await texte('.cp-alerte')).includes('Vérifiez les infos. N\'ajoutez pas de code d\'alarme ou de clés.'), 'avertissement affiché');
verifier((await texte('[data-act=pdf]')) === 'Télécharger en PDF' && (await texte('[data-act=partager]')) === 'Partager', 'boutons « Télécharger en PDF » et « Partager »');
verifier(await ev(`getComputedStyle(document.querySelector('.gd-liste dd')).whiteSpace`) === 'pre-line' && feuille.includes('Pas de chocolat'), 'les retours à la ligne saisis sont gardés');
verifier(await ev(`getComputedStyle(document.querySelector('.gd-carte')).backdropFilter.includes('blur')`), 'style « bulles » (verre), comme le reste de l’appli');
// Suivi du jour
verifier(await ev(`document.querySelectorAll('.gd-jour').length`) === 4 && await ev(`document.querySelector('.gd-jour--choisi').dataset.jour`) === jour(0), 'suivi du jour : un bouton par jour de garde (4), aujourd’hui est choisi');
verifier(await ev(`[...document.querySelectorAll('[data-tache]')].map((c) => c.dataset.tache).join()`) === 'repas,eau,promenade,medicament', 'quatre tâches : repas, eau, promenade, médicament');
await ev(`document.querySelector('[data-tache=repas]').click(); document.querySelector('[data-tache=medicament]').click()`); await dort(300);
let suivi = JSON.parse(await donnees()).fichesGarde.a.suivi;
verifier(JSON.stringify(suivi) === JSON.stringify({ [jour(0)]: ['repas', 'medicament'] }), `cocher enregistre tout de suite : ${JSON.stringify(suivi)}`);
await ev(`document.querySelector('[data-jour="${jour(1)}"]').click()`); await dort(200);
verifier(await ev(`[...document.querySelectorAll('[data-tache]')].every((c) => !c.checked)`) && await ev(`document.querySelector('[data-jour="${jour(1)}"]').getAttribute('aria-pressed')`) === 'true', 'un autre jour : cases vides, jour sélectionné');
await ev(`document.querySelector('[data-tache=eau]').click()`); await dort(200);
await ev(`document.querySelector('[data-jour="${jour(0)}"]').click()`); await dort(200);
verifier(await ev(`document.querySelector('[data-tache=repas]').checked && document.querySelector('[data-tache=medicament]').checked && !document.querySelector('[data-tache=eau]').checked`), 'chaque jour garde ses propres cases');
await aller('#/animaux/a/garde/apercu'); await dort(500);
verifier(await ev(`document.querySelector('[data-tache=repas]').checked`), 'les cases cochées sont retrouvées en rouvrant la page');
stock = JSON.parse(await donnees()).fichesGarde.a; // la fiche avec son suivi, pour la suite
await controler('aperçu à 375 px');
await ecran('garde-apercu'); await axe('#contenu', 'aperçu fiche de garde');
// Vaccins en retard / aucun
await importer({ ...fichier, fichesGarde: { b: { aliment: 'Pâtée' } } });
await aller('#/animaux/b/garde/apercu'); await dort(400);
verifier(/À renouveler : Typhus/.test(await texte('[data-feuille]')) && await ev(`!!document.querySelector('.gd-vaccins--retard')`), 'vaccin en retard : « À renouveler »');
await aller('#/animaux/c/garde/apercu'); await dort(400);
verifier(/Aucun vaccin enregistré/.test(await texte('[data-feuille]')) && await ev(`!!document.querySelector('[data-feuille] [data-act=ajouter-vaccin]')`) && !(await ev(`[...document.querySelectorAll('[data-feuille] h2')].some((h) => /^Repas$/.test(h.textContent.trim()))`)) && /Urgences/.test(await texte('[data-feuille]')), 'animal sans vaccin ni fiche : lien « Ajouter un vaccin », pas de section vide, les urgences restent');
await ev(`document.querySelector('[data-feuille] [data-act=ajouter-vaccin]').click()`); await dort(400);
verifier(await ev(`!!document.querySelector('dialog[open] input[name=type][value=vaccin]:checked')`), 'depuis l’aperçu aussi : « Ajouter un vaccin » ouvre le formulaire de soin');
await ev(`document.querySelector('dialog[open] [data-annuler]').click()`); await dort(300);
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
verifier(p.pages === 1, 'la fiche complète tient sur UNE page');
verifier(p.image && p.rond, 'en-tête : la photo de l’animal en JPEG, rognée en rond');
verifier(/FICHE DE GARDE/.test(p.texte) && /\nMoka\n/.test(`\n${p.texte}\n`) && /Chien · Berger australien · 3 ans/.test(p.texte) && /Garde du .* au /.test(p.texte), 'en-tête : titre, nom en grand, identité, dates de garde');
verifier(/Carnet Patte/.test(p.texte) && /Fiche créée avec Carnet Patte · carnetpatte\.com/.test(p.texte), 'logo « Carnet Patte » en haut et pied de page « Fiche créée avec Carnet Patte · carnetpatte.com »');
verifier(/URGENCES/.test(p.texte) && centres.every((c) => p.texte.includes(c.nom) && p.texte.includes(c.tel) && p.texte.includes(c.horaires.replace(/ /g, ' '))), 'bloc URGENCES : centres antipoison et horaires identiques à ceux de l’appli');
verifier(/En dehors de ces horaires : appelez votre vétérinaire ou une clinique vétérinaire de garde\./.test(p.texte) && !/24 ?h ?\/ ?24/.test(p.texte), 'phrase « En dehors de ces horaires… » dans le PDF, aucun « 24 h/24 »');
verifier(/Croquettes « Sensible » à l’été/.test(p.texte) && /Clinique des Écureuils/.test(p.texte) && /œil sur les feux d’artifice/.test(p.texte), 'accents, guillemets français, apostrophe typographique et « œ » bien encodés');
verifier(/Pas de chocolat/.test(p.texte) && /Pas de restes de table/.test(p.texte), 'texte sur plusieurs lignes');
verifier(/Dernier vaccin : Rage/.test(p.texte) && /Prochain rappel : Rage/.test(p.texte) && /Apoquel/.test(p.texte) && /250 26 00 12 34 56 78/.test(p.texte) && /Poids : 21,4 kg/.test(p.texte), 'vaccins (dernier et prochain rappel), traitement, puce, poids');
verifier(/Suivi de la garde/.test(p.texte) && /Repas/.test(p.texte) && /Eau/.test(p.texte) && /Promenade/.test(p.texte) && /Médicament/.test(p.texte), 'grille « Suivi de la garde » (repas, eau, promenade, médicament)');
verifier((p.s.match(/ B Q/g) ?? []).length >= 8 && p.traits > 20, 'cartes arrondies avec cadre et petites icônes dessinées (tracés vectoriels)');
// Lisible en noir et blanc : tout le texte est foncé ou posé sur un fond plein foncé ; le bloc Urgences porte le mot « URGENCES »
const clair = p.textes.filter((c) => lum(c) > 0.35 && !(c[0] === 1 && c[1] === 1 && c[2] === 1));
verifier(clair.length === 0, `texte lisible imprimé en noir et blanc : aucun texte de couleur claire (${p.textes.length} textes)`);
// Rien ne dépasse de la page, couleurs du thème
const rapport = await ev(`import('/modules/animaux/garde.js').then(async (g) => { const s = await import('/js/storage.js'); const a = s.trouver('animaux', 'a'); const o = await g.creerPdfFiche(g.modeleFiche(a, s.lireFicheGarde('a')), { photo: a.photo, taches: g.TACHES }); return { pages: o.rapport.pages, echelle: o.rapport.echelle, boites: o.rapport.boites.map((b) => [b.page, b.x, b.y, b.l, b.taille]) }; })`);
const dehors = rapport.boites.filter(([pg, x, y, l]) => x < 33 || x + l > 595.28 - 33 || y > 841.89 - 18 || y < 20);
verifier(dehors.length === 0 && rapport.boites.length > 60, `${rapport.boites.length} textes, aucun ne dépasse des marges de la page (échelle ${rapport.echelle})`);
const minTaille = Math.min(...rapport.boites.map((b) => b[4]));
verifier(minTaille >= 7, `le plus petit texte fait ${minTaille.toFixed(1)} points (lisible)`);
const couleursKaki = [...p.couleurs].join('|');
await ev(`import('/js/theme.js').then((t) => t.appliquerTheme('bleu-ciel', { memoriser: false }))`); await dort(300);
await ev(`document.querySelector('[data-act=pdf]').click()`);
const pBleu = lirePdf(await dernierPdf(2));
verifier([...pBleu.couleurs].join('|') !== couleursKaki, 'le PDF reprend les couleurs du thème choisi (autre thème : autres couleurs)');
await ev(`import('/js/theme.js').then((t) => t.appliquerTheme('kaki', { memoriser: false }))`);
// Un texte très long : deux pages ou plus, rien de perdu
const long = (c) => Array.from({ length: 70 }, (_, k) => `${c} ${k + 1} : consigne.`).join('\n');
await ev(`import('/js/storage.js').then((m) => m.enregistrerFicheGarde('a', { infos: ${JSON.stringify(long('Infos'))}, soinsGarde: ${JSON.stringify(long('Soin'))}, regles: ${JSON.stringify(long('Règle'))}, peurs: ${JSON.stringify(long('Peur'))}, aliment: 'Mot' + 'x'.repeat(200) }))`);
await ev(`import('/js/router.js').then((r) => r.rafraichir())`); await dort(500);
await ev(`document.querySelector('[data-act=pdf]').click()`);
const p2 = lirePdf(await dernierPdf(3));
verifier(p2.ok.xref && p2.pages >= 2 && /Infos 1 :/.test(p2.texte) && /Infos 70 :/.test(p2.texte) && /Règle 70 :/.test(p2.texte) && /Peur 70 :/.test(p2.texte) && /Soin 1 :/.test(p2.texte) && /Soin 70 :/.test(p2.texte), `très long : ${p2.pages} pages, début et fin de chaque texte présents (rien n’est coupé)`);
verifier(/Page 2 sur \d/.test(p2.texte) && /\(suite\)/.test(p2.texte) && /URGENCES/.test(p2.texte) && /xxxxx/.test(p2.texte), 'pages suivantes numérotées, cartes reportées « (suite) », mot plus long que la ligne coupé sans rien perdre');
const rapport2 = await ev(`import('/modules/animaux/garde.js').then(async (g) => { const s = await import('/js/storage.js'); const a = s.trouver('animaux', 'a'); const o = await g.creerPdfFiche(g.modeleFiche(a, s.lireFicheGarde('a')), { photo: a.photo, taches: g.TACHES }); return o.rapport.boites.map((b) => [b.page, b.x, b.y, b.l]); })`);
verifier(rapport2.every(([pg, x, y, l]) => x >= 33 && x + l <= 595.28 - 33 && y <= 841.89 - 18), 'même très long : aucun texte ne dépasse de la page');
// Fiche presque vide : la page reste propre, les urgences y sont toujours
await importer({ ...fichier, fichesGarde: { c: {} } });
await aller('#/animaux/c/garde/apercu'); await dort(500);
await ev(`document.querySelector('[data-act=pdf]').click()`);
const pVide = lirePdf(await dernierPdf(4));
verifier(pVide.ok.xref && pVide.pages === 1 && /URGENCES/.test(pVide.texte) && /Aucun vaccin enregistré/.test(pVide.texte) && /Suivi de la garde/.test(pVide.texte) && !pVide.image, 'fiche vide : une page, urgences et grille de suivi présentes, sans photo (illustration)');
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
await ev(`navigator.canShare = () => false; window.__telechargements.length = 0`);
await ev(`document.querySelector('[data-act=partager]').click()`); await dort(500);
await ev(`[...document.querySelectorAll('dialog[open] button')].find((b) => b.textContent.trim() === 'Partager').click()`); await dort(900);
verifier((await ev(`window.__telechargements`))[0] === 'fiche-de-garde-moka.pdf' && (await texte('.cp-notifs')).includes('le PDF a été téléchargé'), 'sans partage de fichiers : le PDF est téléchargé, avec un message');

// ===== 6. Hors connexion : rien sur le réseau =====
log('--- 6. Hors connexion ---');
await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
await ev(`window.__reseau.length = 0; window.__pdf.length = 0`);
await aller('#/animaux/a/garde'); await dort(400);
await remplir('infos', 'Clé sous le pot, à gauche');
await aller('#/animaux/a/garde/apercu'); await dort(400);
await ev(`document.querySelector('[data-act=pdf]').click()`);
const p3 = lirePdf(await dernierPdf(1));
verifier(p3.ok.xref && /Clé sous le pot/.test(p3.texte), 'hors connexion : fiche enregistrée et PDF créé');
verifier((await ev(`window.__reseau`)).length === 0, 'aucune requête réseau');
await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
await importer({ ...fichier, fichesGarde: { a: stock } });

// ===== 7. Export / import, synchronisation =====
log('--- 7. Export, import, synchronisation ---');
const exp = await ev(`import('/js/sauvegarde.js').then((m) => m.exporterTout())`);
const ficheExp = JSON.parse(exp).fichesGarde?.a;
verifier(ficheExp?.aliment === 'Croquettes « Sensible » à l’été' && ficheExp.traitements?.[0]?.nom === 'Apoquel' && ficheExp.puce === '250 26 00 12 34 56 78' && ficheExp.suivi?.[jour(0)]?.includes('repas'), 'la fiche (nouveaux champs, traitements, suivi) est dans le fichier d’export');
await ev(`import('/js/sauvegarde.js').then((m) => m.toutEffacerTout())`);
verifier(JSON.stringify(JSON.parse(await donnees()).fichesGarde) === '{}', '« Tout effacer » efface les fiches');
await ev(`import('/js/sauvegarde.js').then((m) => m.importerTout(${JSON.stringify(exp)}))`);
verifier(JSON.stringify(JSON.parse(await donnees()).fichesGarde.a) === JSON.stringify(stock), 'import : la fiche revient identique');
// Synchronisation Premium : la fiche entière (nouveaux champs compris) fait partie de ce qui est copié, et se réapplique à l'identique
const sync = await ev(`import('/js/storage.js').then((m) => { const i = m.instantane().fichesGarde.a; m.appliquerDistant([{ collection: 'fichesGarde', id: 'a', supprimer: true }]); const vide = m.lireFicheGarde('a').traitements.length; m.appliquerDistant([{ collection: 'fichesGarde', id: 'a', donnees: i }]); return JSON.stringify({ i, vide, apres: m.instantane().fichesGarde.a }); })`);
const sj = JSON.parse(sync);
verifier(sj.i.traitements?.[0]?.nom === 'Apoquel' && sj.i.suivi && sj.vide === 0 && JSON.stringify(sj.apres) === JSON.stringify(sj.i), 'synchronisation : les nouveaux champs, traitements et suivi sont dans l’instantané copié dans le cloud et se réappliquent à l’identique');
await ev(`import('/js/storage.js').then((m) => m.importer(${JSON.stringify(JSON.stringify(fichier))}))`);
verifier(JSON.stringify(JSON.parse(await donnees()).fichesGarde) === '{}', 'ancien export sans fiche : importé normalement');
// Valeurs invalides : ignorées
const sale = { aliment: 'Pâtée', champInconnu: 'x', gardeDu: 'pas une date', gardeAu: '2026-12-31', traitements: [{ nom: 'A', dose: '1', horaires: '' }, { nom: '', dose: '', horaires: '' }, 'texte', ...Array.from({ length: 12 }, (_, k) => ({ nom: `T${k}` }))], suivi: { '2026-12-01': ['repas', 'inconnu'], 'pas-une-date': ['eau'], '2026-12-02': [] } };
const avecInconnu = { ...fichier, fichesGarde: { a: sale, fantome: { aliment: 'Zut' }, b: 'pas un objet' } };
await ev(`import('/js/storage.js').then((m) => m.importer(${JSON.stringify(JSON.stringify(avecInconnu))}))`);
const fg = JSON.parse(await donnees()).fichesGarde;
verifier(Object.keys(fg).join() === 'a' && fg.a.aliment === 'Pâtée' && !fg.a.champInconnu && !fg.a.gardeDu && fg.a.gardeAu === '2026-12-31' && fg.a.traitements.length === 8 && fg.a.traitements[0].nom === 'A' && JSON.stringify(fg.a.suivi) === JSON.stringify({ '2026-12-01': ['repas'] }),
  `champs inconnus, date invalide, traitements en trop, tâches inconnues, animal inconnu : ignorés sans rien casser (${Object.keys(fg.a).join(', ')})`);
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
