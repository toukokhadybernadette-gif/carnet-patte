// Ferme / basse-cour : groupes d'animaux (« Mes poules », 6 poules), suivi de ponte et stock de nourriture.
//
// Un GROUPE est un animal de la collection « animaux » avec { groupe: true, effectif: 6 }. Il a donc, comme les autres animaux,
// ses soins (vermifuge, vaccin, nettoyage du poulailler), ses rappels, ses documents et son « Ajouter au calendrier ».
// Les œufs (collection « oeufs » : { animalId, date, nombre }) et les stocks de nourriture (collection « stocks ») sont rattachés au groupe.

import * as storage from '../../js/storage.js';
import { echapper, aujourdhui, formatDate, joursEntre, ajouterJours, lireISO } from '../../js/utils.js';
import { modale, confirmer, toast } from '../../js/ui.js';
import { icone } from '../../js/icons.js';
import { bouton, badge, champ, selecteur, alerte, vide } from '../../js/composants.js';
import { ESPECES, nomEspece, erreurChamp } from '../animaux/commun.js';

// ----- Le groupe -----

export const estGroupe = (a) => Boolean(a?.groupe);
export const ESPECES_PONTE = new Set(['poule', 'canard']);
export const pondeuse = (a) => estGroupe(a) && ESPECES_PONTE.has(a.espece);
export const effectifDe = (a) => Math.max(1, Math.floor(Number(a?.effectif)) || 1);

const SINGULIER = { poule: 'poule', canard: 'canard', chevre: 'chèvre', mouton: 'mouton', cheval: 'cheval', ane: 'âne', vache: 'vache', cochon: 'cochon', lapin: 'lapin', oiseau: 'oiseau', 'cochon-inde': "cochon d'Inde", hamster: 'hamster', furet: 'furet', tortue: 'tortue', poisson: 'poisson', chien: 'chien', chat: 'chat' };
const PLURIEL = { cheval: 'chevaux', oiseau: 'oiseaux', 'cochon-inde': "cochons d'Inde", poisson: 'poissons' };
/** « 6 poules », « 1 chèvre » */
export function libelleEffectif(a) {
  const n = effectifDe(a);
  if (a.espece === 'autre' || !SINGULIER[a.espece]) return `${n} ${n > 1 ? 'animaux' : 'animal'}`;
  return `${n} ${n > 1 ? (PLURIEL[a.espece] ?? `${SINGULIER[a.espece]}s`) : SINGULIER[a.espece]}`;
}
/** Le nom du nettoyage proposé dans le formulaire de soin d'un groupe. */
export const nomEntretien = (a) => ({ poule: 'Nettoyage du poulailler', canard: 'Nettoyage du poulailler', lapin: 'Nettoyage des clapiers' }[a.espece] ?? "Nettoyage de l'enclos");

const ESPECES_GROUPE = ['poule', 'canard', 'chevre', 'mouton', 'vache', 'cochon', 'lapin', 'cheval', 'ane', 'oiseau', 'autre'];
const lireNombre = (t) => Number(String(t ?? '').trim().replace(',', '.'));
const num = (n, d = 1) => n.toLocaleString('fr-FR', { maximumFractionDigits: d });

/** Fenêtre « Créer un groupe » / « Modifier le groupe ». */
export function formulaireGroupe(groupe, apres) {
  const g = groupe ?? { nom: '', espece: 'poule', especeAutre: '', effectif: 6 };
  const html = `
    <form class="cp-formulaire fe-form" novalidate>
      ${champ({ id: 'gr-nom', label: 'Nom du groupe', valeur: g.nom, placeholder: 'Ex. : Mes poules', requis: true, attrs: { name: 'nom', maxlength: 60, autocomplete: 'off' } })}
      ${selecteur({ id: 'gr-espece', label: 'Espèce', valeur: g.espece, options: ESPECES.filter((e) => ESPECES_GROUPE.includes(e.id)).sort((a, b) => ESPECES_GROUPE.indexOf(a.id) - ESPECES_GROUPE.indexOf(b.id)).map((e) => ({ valeur: e.id, texte: e.nom })) })}
      ${champ({ id: 'gr-autre', label: 'Précisez l\'espèce (si « Autre »)', valeur: g.especeAutre ?? '', attrs: { name: 'especeAutre', maxlength: 40 } })}
      ${champ({ id: 'gr-effectif', label: 'Nombre d\'animaux', type: 'number', valeur: String(g.effectif), requis: true, attrs: { name: 'effectif', min: 1, max: 9999, step: 1, inputmode: 'numeric' } })}
      <div class="fe-form__actions">
        ${bouton({ texte: 'Annuler', variante: 'secondaire', attrs: { 'data-annuler': true } })}
        ${bouton({ texte: groupe ? 'Enregistrer' : 'Créer le groupe', type: 'submit', icone: 'check' })}
      </div>
    </form>`;
  modale(groupe ? 'Modifier le groupe' : 'Nouveau groupe', html, (dlg) => {
    const form = dlg.querySelector('form');
    dlg.querySelector('[data-annuler]').addEventListener('click', () => dlg.close());
    form.addEventListener('input', (e) => { if (e.target.getAttribute('aria-invalid')) erreurChamp(e.target, ''); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nom = form.querySelector('#gr-nom').value.trim();
      const effectif = Number(form.querySelector('#gr-effectif').value);
      const espece = form.querySelector('#gr-espece').value;
      form.querySelectorAll('[aria-invalid]').forEach((c) => erreurChamp(c, ''));
      const problemes = [];
      if (!nom) problemes.push([form.querySelector('#gr-nom'), 'Donnez un nom au groupe.']);
      if (!Number.isInteger(effectif) || effectif < 1 || effectif > 9999) problemes.push([form.querySelector('#gr-effectif'), 'Indiquez un nombre entier d\'animaux, entre 1 et 9999.']);
      if (problemes.length) { problemes.forEach(([c, m]) => erreurChamp(c, m)); problemes[0][0].focus(); return; }
      const champs = { groupe: true, nom, espece, especeAutre: espece === 'autre' ? form.querySelector('#gr-autre').value.trim() : '', effectif, race: '', naissance: '', photo: '' };
      if (groupe) storage.modifier('animaux', groupe.id, champs); else storage.ajouter('animaux', champs);
      dlg.close();
      toast(groupe ? 'Groupe modifié' : 'Groupe créé');
      apres();
    });
  });
}

// ----- Ponte -----

const oeufsDe = (id) => storage.lister('oeufs').filter((o) => o.animalId === id).sort((a, b) => a.date.localeCompare(b.date));

/** Œufs enregistrés pour un jour (remplace la saisie du même jour). nombre >= 0, entier. */
export function enregistrerOeufs(groupeId, date, nombre) {
  const existant = storage.lister('oeufs').find((o) => o.animalId === groupeId && o.date === date);
  if (existant) return storage.modifier('oeufs', existant.id, { nombre });
  return storage.ajouter('oeufs', { animalId: groupeId, date, nombre });
}

/** Les 30 derniers jours (aujourd'hui compris) : une case par jour ({ date, nombre } ; nombre null = pas de saisie) et les chiffres. */
export function statsPonte(groupe, { jours = 30, auj = aujourdhui() } = {}) {
  const parDate = new Map(oeufsDe(groupe.id).map((o) => [o.date, o.nombre]));
  const serie = Array.from({ length: jours }, (_, i) => { const date = ajouterJours(auj, i - (jours - 1)); return { date, nombre: parDate.has(date) ? parDate.get(date) : null }; });
  const saisis = serie.filter((j) => j.nombre !== null);
  const total = saisis.reduce((n, j) => n + j.nombre, 0);
  const moyenne = saisis.length ? total / saisis.length : null;
  return { serie, saisis: saisis.length, total, moyenne, parAnimal: moyenne === null ? null : moyenne / effectifDe(groupe), max: Math.max(0, ...saisis.map((j) => j.nombre)), aujourdhui: parDate.has(auj) ? parDate.get(auj) : null };
}

/** Pas des graduations : un nombre ENTIER (des œufs ne se coupent pas en deux), pour au plus 5 repères. */
const pasEntier = (max) => [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000, 2000, 5000].find((p) => Math.ceil(Math.max(max, 1) / p) <= 5) ?? 10000;
const jourCourt = (iso) => { const d = lireISO(iso); return `${d.getDate()}/${String(d.getMonth() + 1).padStart(2, '0')}`; };

/** Graphique en barres sur 30 jours (SVG). `largeur` : largeur réelle disponible : le dessin est fait à cette taille. */
export function graphiquePonte(stats, { largeur = 600 } = {}) {
  const L = Math.max(260, Math.round(largeur));
  const H = L < 460 ? 200 : 240;
  const pasGrad = pasEntier(stats.max);
  const haut = Math.max(Math.ceil(stats.max / pasGrad) * pasGrad, pasGrad * 2);
  const marge = { g: 22 + 7 * String(haut).length, d: 10, h: 14, b: 24 }; // la place des chiffres de l'axe, avec de l'air autour
  const w = L - marge.g - marge.d;
  const h = H - marge.h - marge.b;
  const pas = w / stats.serie.length;
  const y = (v) => marge.h + (1 - v / haut) * h;
  const graduations = Array.from({ length: haut / pasGrad + 1 }, (_, i) => i * pasGrad);
  const lignes = graduations.map((v) => `<line class="fe-grille" x1="${marge.g}" x2="${L - marge.d}" y1="${y(v)}" y2="${y(v)}"/><text class="fe-axe" data-axe="y" x="${marge.g - 5}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join('');
  const barres = stats.serie.map((j, i) => {
    const x = marge.g + i * pas + pas * 0.15;
    const l = Math.max(2, pas * 0.7);
    if (j.nombre === null) return `<circle class="fe-vide" cx="${x + l / 2}" cy="${marge.h + h - 1.5}" r="1.5"/>`;
    const hb = Math.max(j.nombre === 0 ? 1.5 : 0, (j.nombre / haut) * h);
    return `<rect class="fe-barre" x="${x}" y="${marge.h + h - hb}" width="${l}" height="${hb}" rx="${Math.min(3, l / 2)}"/>`;
  }).join('');
  const reperes = [0, 14, 29].map((i) => `<text class="fe-axe" x="${marge.g + i * pas + pas / 2}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === 29 ? 'end' : 'middle'}">${jourCourt(stats.serie[i].date)}</text>`).join('');
  const resume = stats.moyenne === null ? 'Aucune saisie sur les 30 derniers jours.' : `Œufs par jour sur 30 jours : moyenne ${num(stats.moyenne)}, maximum ${stats.max}, ${stats.saisis} jours saisis.`;
  return `<svg class="fe-graphe" viewBox="0 0 ${L} ${H}" width="${L}" height="${H}" role="img" aria-label="${echapper(resume)}">${lignes}${barres}${reperes}</svg>`;
}

/** Onglet « Ponte » d'un groupe de pondeuses. */
export function rendrePonte(zone, groupe) {
  const rerendre = () => rendrePonte(zone, groupe);
  const stats = statsPonte(groupe);
  const recents = oeufsDe(groupe.id).slice(-10).reverse();
  const auj = aujourdhui();
  const existant = oeufsDe(groupe.id).find((o) => o.date === auj);
  const section = document.createElement('section');
  section.className = 'fe';
  zone.replaceChildren(section);
  const moyenneTexte = stats.moyenne === null ? 'Pas encore de saisie sur les 30 derniers jours.'
    : `Moyenne : ${num(stats.moyenne)} œuf${stats.moyenne >= 2 ? 's' : ''} par jour (sur ${stats.saisis} jour${stats.saisis > 1 ? 's' : ''} saisi${stats.saisis > 1 ? 's' : ''}) · ${num(stats.parAnimal, 2)} par ${libelleEffectif({ ...groupe, effectif: 1 }).replace(/^1 /, '')} et par jour · total : ${stats.total}`;
  section.innerHTML = `
    <div class="sn-entete"><h2>Suivi de ponte</h2></div>
    <form class="cp-carte fe-saisie" novalidate>
      ${champ({ id: 'fe-date', label: 'Jour', type: 'date', valeur: auj, attrs: { name: 'date', max: auj } })}
      ${champ({ id: 'fe-nombre', label: 'Nombre d\'œufs', type: 'number', valeur: existant ? String(existant.nombre) : '', attrs: { name: 'nombre', min: 0, max: 9999, step: 1, inputmode: 'numeric', placeholder: 'Ex. : 5' } })}
      <div class="fe-saisie__actions">${bouton({ texte: 'Enregistrer', type: 'submit', icone: 'check' })}</div>
    </form>
    <p class="fe-moyenne" data-moyenne role="status"><strong>${echapper(moyenneTexte)}</strong></p>
    <div class="cp-carte fe-graphique" data-graphe></div>
    ${recents.length ? `<h3 class="fe-titre">Dernières saisies</h3>
    <ul class="fe-liste">${recents.map((o) => `<li><span><time datetime="${o.date}">${formatDate(o.date)}</time> : <strong>${o.nombre}</strong> œuf${o.nombre > 1 ? 's' : ''}</span>${bouton({ variante: 'secondaire', taille: 's', seul: true, icone: 'trash-2', titre: `Supprimer la saisie du ${formatDate(o.date)}`, attrs: { 'data-supprimer': o.id } })}</li>`).join('')}</ul>` : ''}`;

  const dessiner = () => { const g = section.querySelector('[data-graphe]'); if (g.isConnected) g.innerHTML = graphiquePonte(stats, { largeur: g.clientWidth - 32 || 320 }); };
  dessiner();
  const redim = () => { if (section.isConnected) dessiner(); else removeEventListener('resize', redim); };
  addEventListener('resize', redim);

  const form = section.querySelector('form');
  const champDate = form.querySelector('#fe-date');
  const champNombre = form.querySelector('#fe-nombre');
  champDate.addEventListener('change', () => { const o = oeufsDe(groupe.id).find((x) => x.date === champDate.value); champNombre.value = o ? String(o.nombre) : ''; });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    form.querySelectorAll('[aria-invalid]').forEach((c) => erreurChamp(c, ''));
    const nombre = champNombre.value.trim() === '' ? NaN : Number(champNombre.value);
    const date = champDate.value;
    const problemes = [];
    if (!date || date > aujourdhui()) problemes.push([champDate, date ? 'La date ne peut pas être dans le futur.' : 'Choisissez le jour.']);
    if (!Number.isInteger(nombre) || nombre < 0 || nombre > 9999) problemes.push([champNombre, 'Indiquez un nombre entier d\'œufs (0 si aucun).']);
    if (problemes.length) { problemes.forEach(([c, m]) => erreurChamp(c, m)); problemes[0][0].focus(); return; }
    const remplace = oeufsDe(groupe.id).some((o) => o.date === date);
    enregistrerOeufs(groupe.id, date, nombre);
    toast(`${nombre} œuf${nombre > 1 ? 's' : ''} le ${formatDate(date)}${remplace ? ' (saisie remplacée)' : ''}`);
    rerendre();
  });
  section.addEventListener('click', async (e) => {
    const s = e.target.closest('[data-supprimer]');
    if (!s) return;
    const o = storage.trouver('oeufs', s.dataset.supprimer);
    if (o && await confirmer(`Supprimer la saisie du ${formatDate(o.date)} (${o.nombre} œuf${o.nombre > 1 ? 's' : ''}) ?`)) { storage.supprimer('oeufs', o.id); toast('Saisie supprimée'); rerendre(); }
  });
}

// ----- Alimentation : stock de nourriture -----

/** État d'un stock à une date : quantité estimée restante, jours restants, et s'il faut racheter. */
export function etatStock(stock, auj = aujourdhui()) {
  const ecoules = Math.max(0, joursEntre(stock.date, auj));
  const conso = Number(stock.consoJourKg) || 0;
  const restant = Math.max(0, Number(stock.quantiteKg) - conso * ecoules);
  const jours = conso > 0 ? restant / conso : null;
  const seuil = Number(stock.seuilJours) || 7;
  return { restant, jours, seuil, alerte: jours !== null && jours <= seuil, vide: restant === 0, finLe: jours === null ? '' : ajouterJours(auj, Math.floor(jours)) };
}

/** Tous les stocks à racheter (groupes qui existent), du plus urgent au moins urgent. */
export function stocksARacheter(auj = aujourdhui()) {
  const groupes = new Map(storage.lister('animaux').filter(estGroupe).map((g) => [g.id, g]));
  return storage.lister('stocks').filter((s) => groupes.has(s.animalId)).map((stock) => ({ stock, groupe: groupes.get(stock.animalId), etat: etatStock(stock, auj) }))
    .filter((x) => x.etat.alerte).sort((a, b) => a.etat.jours - b.etat.jours);
}
export const texteJours = (etat) => etat.vide ? 'Stock épuisé' : etat.jours < 1 ? 'Moins d\'un jour de nourriture' : `Environ ${Math.floor(etat.jours)} jour${Math.floor(etat.jours) > 1 ? 's' : ''} de nourriture`;

function formulaireStock(groupe, stock, apres) {
  const s = stock ?? { nom: '', quantiteKg: '', consoJourKg: ESPECES_PONTE.has(groupe.espece) ? Math.round(effectifDe(groupe) * 0.12 * 100) / 100 : '', seuilJours: 7 };
  const html = `
    <form class="cp-formulaire fe-form" novalidate>
      ${champ({ id: 'st-nom', label: 'Nourriture', valeur: s.nom, placeholder: 'Ex. : Mélange de céréales', requis: true, attrs: { name: 'nom', maxlength: 60, autocomplete: 'off' } })}
      ${champ({ id: 'st-quantite', label: 'Quantité en stock (kg)', valeur: s.quantiteKg === '' ? '' : String(s.quantiteKg).replace('.', ','), requis: true, attrs: { name: 'quantite', inputmode: 'decimal', placeholder: 'Ex. : 25' } })}
      ${champ({ id: 'st-conso', label: 'Consommation du groupe (kg par jour)', valeur: s.consoJourKg === '' ? '' : String(s.consoJourKg).replace('.', ','), requis: true,
        aide: ESPECES_PONTE.has(groupe.espece) ? 'Une poule mange environ 120 g par jour : proposition calculée pour votre groupe.' : 'Combien le groupe mange en tout chaque jour.', attrs: { name: 'conso', inputmode: 'decimal' } })}
      ${selecteur({ id: 'st-seuil', label: 'Prévenir quand il reste', valeur: String(s.seuilJours), options: [3, 7, 14].map((j) => ({ valeur: String(j), texte: `${j} jours de nourriture` })) })}
      <div class="fe-form__actions">
        ${bouton({ texte: 'Annuler', variante: 'secondaire', attrs: { 'data-annuler': true } })}
        ${bouton({ texte: stock ? 'Enregistrer' : 'Ajouter', type: 'submit', icone: 'check' })}
      </div>
    </form>`;
  modale(stock ? 'Modifier le stock' : `Nouveau stock pour ${groupe.nom}`, html, (dlg) => {
    const form = dlg.querySelector('form');
    dlg.querySelector('[data-annuler]').addEventListener('click', () => dlg.close());
    form.addEventListener('input', (e) => { if (e.target.getAttribute('aria-invalid')) erreurChamp(e.target, ''); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nom = form.querySelector('#st-nom').value.trim();
      const quantite = lireNombre(form.querySelector('#st-quantite').value);
      const conso = lireNombre(form.querySelector('#st-conso').value);
      form.querySelectorAll('[aria-invalid]').forEach((c) => erreurChamp(c, ''));
      const problemes = [];
      if (!nom) problemes.push([form.querySelector('#st-nom'), 'Indiquez la nourriture.']);
      if (!(quantite >= 0) || form.querySelector('#st-quantite').value.trim() === '' || quantite > 100000) problemes.push([form.querySelector('#st-quantite'), 'Indiquez la quantité en kg (0 si le stock est vide).']);
      if (!(conso > 0) || conso > 100000) problemes.push([form.querySelector('#st-conso'), 'Indiquez ce que le groupe mange par jour, en kg (plus de 0).']);
      if (problemes.length) { problemes.forEach(([c, m]) => erreurChamp(c, m)); problemes[0][0].focus(); return; }
      // La quantité saisie est celle d'AUJOURD'HUI : le stock estimé baisse ensuite chaque jour selon la consommation
      const champs = { animalId: groupe.id, nom, quantiteKg: quantite, consoJourKg: conso, seuilJours: Number(form.querySelector('#st-seuil').value), date: aujourdhui() };
      if (stock) storage.modifier('stocks', stock.id, champs); else storage.ajouter('stocks', champs);
      dlg.close();
      toast(stock ? 'Stock modifié' : 'Stock ajouté');
      apres();
    });
  });
}

function formulaireRachat(groupe, stock, apres) {
  const etat = etatStock(stock);
  modale(`J'ai racheté : ${stock.nom}`, `
    <form class="cp-formulaire fe-form" novalidate>
      <p>Il reste environ <strong>${num(etat.restant)} kg</strong> d'après la consommation. La quantité rachetée s'ajoute à ce reste.</p>
      ${champ({ id: 'rc-quantite', label: 'Quantité rachetée (kg)', requis: true, attrs: { name: 'quantite', inputmode: 'decimal', placeholder: 'Ex. : 25' } })}
      <div class="fe-form__actions">
        ${bouton({ texte: 'Annuler', variante: 'secondaire', attrs: { 'data-annuler': true } })}
        ${bouton({ texte: 'Mettre à jour le stock', type: 'submit', icone: 'check' })}
      </div>
    </form>`, (dlg) => {
    const form = dlg.querySelector('form');
    dlg.querySelector('[data-annuler]').addEventListener('click', () => dlg.close());
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const champQ = form.querySelector('#rc-quantite');
      const q = lireNombre(champQ.value);
      erreurChamp(champQ, '');
      if (!(q > 0) || q > 100000) { erreurChamp(champQ, 'Indiquez la quantité rachetée en kg (plus de 0).'); champQ.focus(); return; }
      storage.modifier('stocks', stock.id, { quantiteKg: Math.round((etat.restant + q) * 100) / 100, date: aujourdhui() });
      dlg.close();
      toast(`Stock mis à jour : ${num(etat.restant + q)} kg`);
      apres();
    });
  });
}

/** Onglet « Alimentation » d'un groupe : stocks de nourriture avec alerte quand il faut racheter. */
export function rendreAlimentation(zone, groupe) {
  const rerendre = () => rendreAlimentation(zone, groupe);
  const stocks = storage.lister('stocks').filter((s) => s.animalId === groupe.id);
  const section = document.createElement('section');
  section.className = 'fe';
  zone.replaceChildren(section);
  const carte = (s) => {
    const e = etatStock(s);
    return `
    <li class="cp-carte fe-stock${e.alerte ? ' fe-stock--alerte' : ''}" data-stock="${echapper(s.id)}">
      <div class="fe-stock__corps">
        <strong class="fe-stock__nom">${echapper(s.nom)}</strong>
        <span class="fe-stock__etat">${e.alerte ? badge({ texte: 'À racheter', variante: 'alerte', icone: 'shopping-cart' }) : badge({ texte: 'Stock suffisant', variante: 'succes', icone: 'circle-check' })}</span>
        <span class="fe-stock__meta">Environ <strong>${num(e.restant)} kg</strong> restants · ${echapper(texteJours(e))}${e.finLe && !e.vide ? ` (jusqu'au ${formatDate(e.finLe)})` : ''}</span>
        <span class="fe-stock__meta">Le groupe mange ${num(Number(s.consoJourKg), 2)} kg par jour · alerte à ${s.seuilJours} jours</span>
      </div>
      <div class="fe-stock__actions">
        ${bouton({ texte: "J'ai racheté", icone: 'shopping-cart', taille: 's', variante: e.alerte ? 'principal' : 'secondaire', attrs: { 'data-racheter': s.id, 'aria-label': `J'ai racheté : ${s.nom}` } })}
        ${bouton({ variante: 'secondaire', taille: 's', seul: true, icone: 'pencil', titre: `Modifier ${s.nom}`, attrs: { 'data-modifier': s.id } })}
        ${bouton({ variante: 'secondaire', taille: 's', seul: true, icone: 'trash-2', titre: `Supprimer ${s.nom}`, attrs: { 'data-supprimer': s.id } })}
      </div>
    </li>`;
  };
  const alertes = stocks.map((s) => ({ s, e: etatStock(s) })).filter((x) => x.e.alerte);
  section.innerHTML = `
    <div class="sn-entete"><h2>Alimentation</h2>${bouton({ texte: 'Ajouter un stock', icone: 'plus', taille: 's', attrs: { 'data-ajouter': true } })}</div>
    ${alertes.length ? alerte({ type: 'attention', titre: 'À racheter', texte: alertes.map((x) => `${x.s.nom} : ${texteJours(x.e).toLowerCase()}`).join(' · ') }) : ''}
    ${stocks.length ? `<ul class="fe-stocks">${stocks.map(carte).join('')}</ul>`
      : `<div class="cp-carte">${vide({ niveau: 3, icone: 'wheat', titre: 'Aucun stock de nourriture', texte: 'Indiquez ce que vous avez en réserve et ce que le groupe mange par jour : Carnet Patte vous prévient quand il faut racheter.', action: bouton({ texte: 'Ajouter un stock', icone: 'plus', attrs: { 'data-ajouter': true } }) })}</div>`}`;
  section.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-ajouter], [data-modifier], [data-supprimer], [data-racheter]');
    if (!a) return;
    if (a.hasAttribute('data-ajouter')) { formulaireStock(groupe, null, rerendre); return; }
    const s = storage.trouver('stocks', a.dataset.modifier ?? a.dataset.supprimer ?? a.dataset.racheter);
    if (!s) return;
    if (a.hasAttribute('data-modifier')) formulaireStock(groupe, s, rerendre);
    else if (a.hasAttribute('data-racheter')) formulaireRachat(groupe, s, rerendre);
    else if (await confirmer(`Supprimer le stock « ${s.nom} » ?`)) { storage.supprimer('stocks', s.id); toast('Stock supprimé'); rerendre(); }
  });
}

/** Alerte « À racheter » pour l'Accueil et la liste des animaux (HTML vide s'il n'y a rien à racheter). */
export function alerteStocksHtml() {
  const liste = stocksARacheter();
  if (!liste.length) return '';
  const { stock, groupe, etat } = liste[0];
  const autres = liste.length - 1;
  return `<a class="cp-alerte cp-alerte--attention fe-alerte" data-alerte-stock href="#/animaux/${encodeURIComponent(groupe.id)}">${icone('shopping-cart', { taille: 20 })}
    <span class="cp-alerte__texte"><strong class="cp-alerte__titre">À racheter</strong>${echapper(stock.nom)} pour ${echapper(groupe.nom)} : ${echapper(texteJours(etat).toLowerCase())}${autres ? ` · et ${autres} autre${autres > 1 ? 's' : ''}` : ''}</span></a>`;
}
