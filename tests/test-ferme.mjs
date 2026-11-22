// Test « ferme » : groupes d'animaux (basse-cour), suivi de ponte, stock de nourriture, soins du groupe.
// Vérifie : création d'un groupe, onglets d'un groupe, soins et rappels du groupe (dont « Ajouter au calendrier »), ponte (saisie, remplacement,
// erreurs, moyenne, graphique sur 30 jours), stock de nourriture (calcul, alerte « à racheter », « J'ai racheté »), export / import,
// suppressions, hors connexion (aucune requête), écrans de 375 et 390 px (aucun chevauchement), accessibilité.
import { ouvrirEdge, dort, jour } from './outil-cdp.mjs';

const [S, URL, TAG] = process.argv.slice(2);
const { send, ev, log, verifier, texte, ecran, donnees, aller, importer, axe, fin, taille, controler } = await ouvrirEdge({ sortie: S, balise: TAG, port: +(process.env.PORT || 9350) });

await send('Network.enable');
await send('Page.navigate', { url: URL }); await dort(1800);
await taille(375, 812);
await ev(`(() => { window.__reseau = []; const f = window.fetch.bind(window); window.fetch = (...a) => { window.__reseau.push(String(a[0]?.url ?? a[0])); return f(...a); };
  window.__ics = []; const o = URL.createObjectURL.bind(URL); URL.createObjectURL = (b) => { if (b.type.startsWith('text/calendar')) b.text().then((t) => window.__ics.push(t)); return o(b); }; })()`);

const base = { version: 1, exemplesAjoutes: true, exporteLe: '2026-01-01T00:00:00.000Z',
  animaux: [{ id: 'a', nom: 'Moka', espece: 'chien', especeAutre: '', race: '', naissance: '2023-08-01', photo: '' }], soins: [], pesees: [] };
await importer(base);
const lire = async () => JSON.parse(await donnees());
const groupeDe = async (nom) => (await lire()).animaux.find((a) => a.nom === nom);
const cliquer = (sel) => ev(`document.querySelector(${JSON.stringify(sel)}).click()`);
const allerR = async (h) => { if ((await ev('location.hash')) === h) await rafraichir(); else await aller(h); };
const rafraichir = async () => { await ev(`import('/js/router.js').then((r) => r.rafraichir())`); await dort(500); };
const onglet = async (id) => { await cliquer(`[data-onglet=${id}]`); await dort(500); };

// ===== 1. Créer un groupe =====
log('--- 1. Créer un groupe ---');
await allerR('#/animaux'); await dort(400);
verifier((await texte('[data-act=groupe]')) === 'Créer un groupe', 'bouton « Créer un groupe » sur la page Mes animaux');
await controler('Mes animaux à 375 px');
await cliquer('[data-act=groupe]'); await dort(500);
verifier(await ev(`!!document.querySelector('dialog[open] #gr-nom') && !!document.querySelector('dialog[open] #gr-espece') && !!document.querySelector('dialog[open] #gr-effectif')`), 'formulaire : nom, espèce, nombre d’animaux');
await ev(`document.querySelector('dialog[open] #gr-effectif').value = '0'; document.querySelector('dialog[open] form').requestSubmit()`); await dort(300);
verifier((await texte('dialog[open]')).includes('Donnez un nom au groupe.') && (await texte('dialog[open]')).includes('nombre entier d\'animaux'), 'nom vide et nombre à 0 : messages clairs');
await controler('formulaire de groupe à 375 px', 'dialog[open]'); await axe('dialog[open]', 'formulaire de groupe');
await ev(`(() => { document.querySelector('dialog[open] #gr-nom').value = 'Mes poules'; document.querySelector('dialog[open] #gr-effectif').value = '6'; document.querySelector('dialog[open] form').requestSubmit(); })()`); await dort(600);
const poules = await groupeDe('Mes poules');
verifier(poules && poules.groupe === true && poules.espece === 'poule' && poules.effectif === 6, `groupe créé : ${JSON.stringify(poules)}`);
verifier((await texte('[data-grille]')).includes('Groupe · Poule') && (await texte('[data-grille]')).includes('6 poules'), 'la carte du groupe dit « Groupe · Poule » et « 6 poules »');
await ecran('liste-groupe');

// ===== 2. Fiche du groupe =====
log('--- 2. Fiche du groupe ---');
await allerR(`#/animaux/${poules.id}`); await dort(500);
const onglets = await ev(`[...document.querySelectorAll('[role=tab]')].map((t) => t.textContent.trim())`);
verifier(JSON.stringify(onglets) === JSON.stringify(['Santé', 'Ponte', 'Alimentation', 'Historique', 'Documents']), `onglets : ${onglets.join(', ')} (pas de Poids)`);
verifier((await texte('.fi-entete')).includes('Groupe · 6 poules') && !(await texte('#contenu')).includes('Fiche de garde'), 'en-tête « Groupe · 6 poules », pas de fiche de garde');
verifier((await texte('.fi-chiffres')).includes('Effectif') && (await texte('.fi-chiffres')).includes('6'), 'chiffre clé : effectif 6');
await cliquer('.fi-entete [data-act=modifier]'); await dort(500);
verifier(await ev(`!!document.querySelector('dialog[open] #gr-effectif') && document.querySelector('dialog[open] #gr-nom').value === 'Mes poules'`), '« Modifier » ouvre le formulaire de groupe');
await ev(`document.querySelector('dialog[open] #gr-effectif').value = '7'; document.querySelector('dialog[open] form').requestSubmit()`); await dort(600);
verifier((await groupeDe('Mes poules')).effectif === 7 && (await texte('.fi-entete')).includes('7 poules'), 'effectif modifié : 7 poules');
await ev(`import('/js/storage.js').then((m) => m.modifier('animaux', '${poules.id}', { effectif: 6 }))`); await rafraichir();
await controler('fiche du groupe à 375 px');

// ===== 3. Soins et rappels du groupe =====
log('--- 3. Soins du groupe ---');
await cliquer('#fi-panneau-sante [data-act=ajouter]'); await dort(500);
verifier(await texte('dialog[open] [data-suggestion]') === 'Nettoyage du poulailler', 'idée « Nettoyage du poulailler » dans le formulaire de soin');
await cliquer('dialog[open] [data-suggestion]');
verifier(await ev(`document.querySelector('dialog[open] #soin-titre').value`) === 'Nettoyage du poulailler' && await ev(`document.querySelector('dialog[open] input[name=type][value=autre]').checked`), 'elle remplit le nom et choisit « Autre soin »');
await ev(`(() => { document.querySelector('dialog[open] #soin-date').value = '${jour(-20)}'; document.querySelector('dialog[open] #soin-rappel').value = '${jour(10)}'; document.querySelector('dialog[open] form').requestSubmit(); })()`); await dort(600);
await cliquer('#fi-panneau-sante [data-act=ajouter]'); await dort(500);
await ev(`(() => { document.querySelector('dialog[open] input[name=type][value=vermifuge]').checked = true; document.querySelector('dialog[open] #soin-date').value = '${jour(-60)}'; document.querySelector('dialog[open] #soin-rappel').value = '${jour(3)}'; document.querySelector('dialog[open] form').requestSubmit(); })()`); await dort(600);
const soinsGroupe = (await lire()).soins.filter((s) => s.animalId === poules.id);
verifier(soinsGroupe.length === 2 && soinsGroupe.some((s) => s.titre === 'Nettoyage du poulailler' && s.type === 'autre') && soinsGroupe.some((s) => s.type === 'vermifuge'), 'deux soins enregistrés pour le groupe (nettoyage et vermifuge)');
await controler('soins du groupe à 375 px');
await allerR('#/animaux/rappels'); await dort(500);
verifier((await texte('.rp-groupes')).includes('Mes poules') && (await texte('.rp-groupes')).includes('Nettoyage du poulailler') && (await texte('.rp-groupes')).includes('Vermifuge'), 'page Rappels : les rappels du groupe apparaissent');
await cliquer(`[data-cal="${soinsGroupe.find((s) => s.type === 'vermifuge').id}"]`); await dort(400);
verifier((await ev(`window.__ics[0]`)).includes('SUMMARY:Vermifuge — Mes poules'), 'ajouter au calendrier : « Vermifuge — Mes poules »');
await allerR('#/accueil'); await dort(500);
verifier((await texte('[data-piste]')).includes('Groupe · 6 poules'), 'Accueil : le groupe est dans le carrousel');

// ===== 4. Ponte =====
log('--- 4. Ponte ---');
await allerR(`#/animaux/${poules.id}`); await onglet('ponte');
verifier((await texte('#fi-panneau-ponte')).includes('Pas encore de saisie'), 'ponte vide : message clair');
await ev(`document.querySelector('#fe-nombre').value = '-2'; document.querySelector('#fi-panneau-ponte form').requestSubmit()`); await dort(300);
verifier((await texte('#fi-panneau-ponte')).includes('nombre entier d\'œufs'), 'nombre négatif : refusé');
await ev(`document.querySelector('#fe-nombre').value = '2.5'; document.querySelector('#fi-panneau-ponte form').requestSubmit()`); await dort(300);
verifier((await lire()).oeufs.length === 0 && (await texte('#fi-panneau-ponte')).includes('nombre entier d\'œufs'), '2,5 œufs : refusé');
await ev(`document.querySelector('#fe-nombre').value = ''; document.querySelector('#fi-panneau-ponte form').requestSubmit()`); await dort(300);
verifier((await lire()).oeufs.length === 0, 'champ vide : refusé (0 œuf doit être saisi explicitement)');
// Saisie du jour, puis remplacement
await ev(`document.querySelector('#fe-nombre').value = '5'; document.querySelector('#fi-panneau-ponte form').requestSubmit()`); await dort(500);
let oeufs = (await lire()).oeufs;
verifier(oeufs.length === 1 && oeufs[0].nombre === 5 && oeufs[0].date === jour(0) && oeufs[0].animalId === poules.id, `saisie d'aujourd'hui : ${JSON.stringify(oeufs[0])}`);
await ev(`document.querySelector('#fe-nombre').value = '4'; document.querySelector('#fi-panneau-ponte form').requestSubmit()`); await dort(500);
oeufs = (await lire()).oeufs;
verifier(oeufs.length === 1 && oeufs[0].nombre === 4 && (await texte('.cp-notifs')).includes('saisie remplacée'), 'même jour : la saisie est remplacée, pas ajoutée');
await ev(`document.querySelector('#fe-date').value = '${jour(5)}'; document.querySelector('#fe-nombre').value = '3'; document.querySelector('#fi-panneau-ponte form').requestSubmit()`); await dort(300);
verifier((await lire()).oeufs.length === 1 && (await texte('#fi-panneau-ponte')).includes('dans le futur'), 'date dans le futur : refusée');
// Jeu de données connu : 20 jours saisis dans les 30 derniers, une valeur ancienne hors période
const valeurs = [4, 5, 6, 3, 5, 5, 4, 6, 2, 0, 5, 4, 6, 5, 3, 4, 5, 6, 4, 5]; // jours -1 … -20
const jeu = valeurs.map((n, i) => ({ id: `o${i}`, animalId: poules.id, date: jour(-(i + 1)), nombre: n }));
jeu.push({ id: 'ancien', animalId: poules.id, date: jour(-40), nombre: 99 });
await importer({ ...base, animaux: [...base.animaux, poules], soins: [], oeufs: jeu });
await allerR(`#/animaux/${poules.id}`); await onglet('ponte');
const total = valeurs.reduce((a, b) => a + b, 0); const moy = total / valeurs.length;
const fr = (n, d = 1) => n.toLocaleString('fr-FR', { maximumFractionDigits: d });
const txtMoy = await texte('[data-moyenne]');
verifier(txtMoy.includes(`Moyenne : ${fr(moy)} œufs par jour (sur 20 jours saisis)`) && txtMoy.includes(`${fr(moy / 6, 2)} par poule`) && txtMoy.includes(`total : ${total}`), `moyenne exacte sur les 30 derniers jours, sans la valeur de 40 jours : ${txtMoy}`);
const stats = await ev(`import('/modules/ferme/ferme.js').then((m) => m.statsPonte(${JSON.stringify(poules)}))`);
verifier(stats.serie.length === 30 && stats.saisis === 20 && stats.max === 6 && stats.serie[29].date === jour(0) && stats.serie[0].date === jour(-29), `statsPonte : 30 jours (${stats.serie[0].date} → ${stats.serie[29].date}), ${stats.saisis} saisis, maximum ${stats.max}`);
const g = await ev(`(() => { const s = document.querySelector('.fe-graphe'); return { barres: s.querySelectorAll('.fe-barre').length, vides: s.querySelectorAll('.fe-vide').length, label: s.getAttribute('aria-label'), role: s.getAttribute('role'), largeur: s.getBoundingClientRect().width, parent: s.parentElement.getBoundingClientRect().width }; })()`);
verifier(g.role === 'img' && g.barres === 20 && g.vides === 10 && g.label.includes(`moyenne ${fr(moy)}`) && g.label.includes('maximum 6'), `graphique : 20 barres, 10 jours sans saisie, nom accessible : « ${g.label} »`);
verifier(g.largeur <= g.parent, 'le graphique tient dans son cadre à 375 px');
await controler('onglet Ponte à 375 px'); await ecran('ponte'); await axe('#fi-panneau-ponte', 'onglet Ponte');
await cliquer('#fi-panneau-ponte [data-supprimer="o0"]'); await dort(400);
verifier((await texte('dialog[open]')).includes('Supprimer la saisie du'), 'supprimer une saisie : confirmation');
await ev(`document.querySelector('dialog[open] .cp-btn--danger').click()`); await dort(600);
verifier((await lire()).oeufs.length === 20, 'saisie supprimée');
await taille(390, 844); await allerR(`#/animaux/${poules.id}`); await onglet('ponte');
await controler('onglet Ponte à 390 px');
await taille(375, 812);

// ===== 5. Alimentation =====
log('--- 5. Alimentation ---');
await allerR(`#/animaux/${poules.id}`); await onglet('alimentation');
verifier((await texte('#fi-panneau-alimentation')).includes('Aucun stock de nourriture'), 'aucun stock : message clair');
await cliquer('#fi-panneau-alimentation [data-ajouter]'); await dort(500);
verifier(await ev(`document.querySelector('dialog[open] #st-conso').value`) === '0,72', 'consommation proposée : 6 poules × 120 g = 0,72 kg par jour');
await ev(`document.querySelector('dialog[open] #st-conso').value = '0'; document.querySelector('dialog[open] form').requestSubmit()`); await dort(300);
verifier((await texte('dialog[open]')).includes('Indiquez la nourriture.') && (await texte('dialog[open]')).includes('Indiquez la quantité en kg') && (await texte('dialog[open]')).includes('plus de 0'), 'champs manquants : trois messages clairs');
await controler('formulaire de stock à 375 px', 'dialog[open]');
await ev(`(() => { document.querySelector('dialog[open] #st-nom').value = 'Mélange de céréales'; document.querySelector('dialog[open] #st-quantite').value = '10'; document.querySelector('dialog[open] #st-conso').value = '0,5'; document.querySelector('dialog[open] form').requestSubmit(); })()`); await dort(600);
let stocks = (await lire()).stocks;
verifier(stocks.length === 1 && stocks[0].quantiteKg === 10 && stocks[0].consoJourKg === 0.5 && stocks[0].seuilJours === 7 && stocks[0].date === jour(0), `stock enregistré (virgule décimale acceptée) : ${JSON.stringify(stocks[0])}`);
verifier((await texte('.fe-stock')).includes('Stock suffisant') && (await texte('.fe-stock')).includes('Environ 20 jours'), `10 kg à 0,5 kg/jour : 20 jours, pas d’alerte (${(await texte('.fe-stock')).slice(0, 90)})`);
// Calcul exact de l'état d'un stock
const calc = await ev(`import('/modules/ferme/ferme.js').then((m) => [
  m.etatStock({ quantiteKg: 10, consoJourKg: 1, date: '${jour(-4)}', seuilJours: 7 }),
  m.etatStock({ quantiteKg: 10, consoJourKg: 1, date: '${jour(-2)}', seuilJours: 7 }),
  m.etatStock({ quantiteKg: 5, consoJourKg: 1, date: '${jour(-10)}', seuilJours: 7 }),
  m.etatStock({ quantiteKg: 10, consoJourKg: 1, date: '${jour(0)}', seuilJours: 14 })])`);
verifier(calc[0].restant === 6 && calc[0].alerte && calc[1].restant === 8 && !calc[1].alerte && calc[2].restant === 0 && calc[2].vide && calc[2].alerte && calc[3].alerte && calc[3].jours === 10, 'calcul : 6 jours restants → alerte ; 8 jours → pas d’alerte ; stock épuisé → alerte ; seuil de 14 jours');
verifier(calc[0].finLe === jour(6), `date de fin estimée : ${calc[0].finLe}`);
// Alerte : un stock bientôt vide
await ev(`import('/js/storage.js').then((m) => m.ajouter('stocks', { animalId: '${poules.id}', nom: 'Coquilles d\\'huîtres', quantiteKg: 3, consoJourKg: 0.5, seuilJours: 7, date: '${jour(-2)}' }))`);
await rafraichir();
verifier((await texte('#fi-panneau-alimentation .cp-alerte')).includes('À racheter') && (await texte('#fi-panneau-alimentation .cp-alerte')).includes('Coquilles d\'huîtres'), 'alerte « À racheter » dans l’onglet (2 kg restants, 4 jours)');
verifier((await texte('.fe-stock--alerte')).includes('À racheter') && (await texte('.fe-stock--alerte')).includes('Environ 4 jours'), 'la carte du stock porte le badge « À racheter »');
verifier((await texte('.fi-chiffres')).includes('Ponte'), 'chiffres : ponte');
await controler('onglet Alimentation à 375 px'); await ecran('alimentation'); await axe('#fi-panneau-alimentation', 'onglet Alimentation');
await allerR('#/accueil'); await dort(600);
verifier((await texte('[data-alerte-stock]')).includes('Coquilles d\'huîtres pour Mes poules') && await ev(`document.querySelector('[data-alerte-stock]').getAttribute('href')`) === `#/animaux/${poules.id}`, 'Accueil : alerte « À racheter » avec lien vers le groupe');
await controler('Accueil avec alerte à 375 px');
await allerR('#/animaux'); await dort(500);
verifier((await texte('[data-grille]')).includes('Nourriture à racheter') && await ev(`!!document.querySelector('[data-alerte-stock]')`), 'liste des animaux : badge et alerte');
await allerR(`#/animaux/${poules.id}`); await onglet('alimentation');
await cliquer('.fe-stock--alerte [data-racheter]'); await dort(500);
verifier((await texte('dialog[open]')).includes('Il reste environ 2 kg'), 'J’ai racheté : affiche ce qu’il reste');
await ev(`document.querySelector('dialog[open] #rc-quantite').value = ''; document.querySelector('dialog[open] form').requestSubmit()`); await dort(300);
verifier((await texte('dialog[open]')).includes('Indiquez la quantité rachetée'), 'quantité vide : refusée');
await ev(`document.querySelector('dialog[open] #rc-quantite').value = '10'; document.querySelector('dialog[open] form').requestSubmit()`); await dort(600);
const coquilles = (await lire()).stocks.find((s) => s.nom.startsWith('Coquilles'));
verifier(coquilles.quantiteKg === 12 && coquilles.date === jour(0) && await ev(`!document.querySelector('.fe-stock--alerte') && !document.querySelector('#fi-panneau-alimentation .cp-alerte')`), 'racheté 10 kg : 2 + 10 = 12 kg à partir d’aujourd’hui, l’alerte disparaît');
await allerR('#/accueil'); await dort(500);
verifier(await ev(`!document.querySelector('[data-alerte-stock]')`), 'Accueil : plus d’alerte');
// Groupe non pondeur
await importer({ ...base, animaux: [...base.animaux, poules, { id: 'ch', nom: 'Mes chèvres', espece: 'chevre', especeAutre: '', groupe: true, effectif: 3, race: '', naissance: '', photo: '' }], oeufs: jeu, stocks: (await lire()).stocks });
await allerR('#/animaux/ch'); await dort(500);
const onglets2 = await ev(`[...document.querySelectorAll('[role=tab]')].map((t) => t.textContent.trim())`);
verifier(JSON.stringify(onglets2) === JSON.stringify(['Santé', 'Alimentation', 'Historique', 'Documents']), `groupe de chèvres : pas d’onglet Ponte (${onglets2.join(', ')})`);
verifier((await texte('.fi-entete')).includes('Groupe · 3 chèvres') && (await texte('.fi-chiffres')).includes('Nourriture'), '« 3 chèvres », chiffre « Nourriture »');
await cliquer('#fi-panneau-sante [data-act=ajouter]'); await dort(400);
verifier(await texte('dialog[open] [data-suggestion]') === "Nettoyage de l'enclos", 'idée adaptée : « Nettoyage de l\'enclos »');
await ev(`document.querySelector('dialog[open] [data-annuler]').click()`);
await ecran('groupe-chevres');

// ===== 6. Export, import, suppressions =====
log('--- 6. Export, import, suppressions ---');
const exp = JSON.parse(await ev(`import('/js/sauvegarde.js').then((m) => m.exporterTout())`));
verifier(exp.oeufs.length === 21 && exp.stocks.length === 2 && exp.animaux.some((a) => a.groupe && a.effectif === 6), 'l’export contient les groupes, les œufs et les stocks');
await ev(`import('/js/sauvegarde.js').then((m) => m.toutEffacerTout())`);
verifier((await lire()).oeufs.length === 0 && (await lire()).stocks.length === 0, '« Tout effacer » efface œufs et stocks');
await ev(`import('/js/sauvegarde.js').then((m) => m.importerTout(${JSON.stringify(JSON.stringify(exp))}))`);
const apres = await lire();
verifier(apres.oeufs.length === 21 && apres.stocks.length === 2 && JSON.stringify(apres.stocks) === JSON.stringify(exp.stocks), 'import : œufs et stocks reviennent identiques');
await ev(`import('/js/storage.js').then((m) => m.importer(${JSON.stringify(JSON.stringify(base))}))`);
verifier((await lire()).oeufs.length === 0 && (await lire()).stocks.length === 0, 'ancien export sans œufs ni stocks : importé normalement');
await importer({ ...base, animaux: [...base.animaux, poules], oeufs: jeu, stocks: exp.stocks });
await allerR(`#/animaux/${poules.id}`); await dort(500);
await cliquer('.fi-entete [data-act=supprimer]'); await dort(500);
verifier((await texte('dialog[open]')).includes('21 saisies d\'œufs') && (await texte('dialog[open]')).includes('2 stocks'), 'supprimer le groupe : la confirmation annonce œufs et stocks');
await ev(`document.querySelector('dialog[open] .cp-btn--danger').click()`); await dort(700);
const fin2 = await lire();
verifier(fin2.oeufs.length === 0 && fin2.stocks.length === 0 && !fin2.animaux.some((a) => a.id === poules.id), 'groupe supprimé avec ses œufs et ses stocks');

// ===== 7. Hors connexion, rien sur le réseau =====
log('--- 7. Hors connexion ---');
await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
await ev(`window.__reseau.length = 0`);
await importer({ ...base, animaux: [...base.animaux, poules] });
await allerR(`#/animaux/${poules.id}`); await onglet('ponte');
await ev(`document.querySelector('#fe-nombre').value = '3'; document.querySelector('#fi-panneau-ponte form').requestSubmit()`); await dort(500);
verifier((await lire()).oeufs.length === 1 && (await ev(`window.__reseau`)).length === 0, 'hors connexion : saisie de ponte enregistrée, aucune requête réseau');
await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

// Aller-retour export / import des données
const exp1 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
await ev(`import('/js/storage.js').then(m=>m.toutEffacer())`);
await ev(`import('/js/storage.js').then(m=>m.importer(${JSON.stringify(exp1)}))`);
const exp2 = await ev(`import('/js/storage.js').then(m=>m.exporter())`);
const net = (t) => { const o = JSON.parse(t); delete o.exporteLe; return JSON.stringify(o); };
fin(net(exp1) === net(exp2));
