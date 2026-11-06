// Pesées d'un animal + petit graphique d'évolution (dessiné à la main en SVG).
// Format des données inchangé : { id, animalId, date, poidsKg }.

import * as storage from '../../js/storage.js';
import { echapper, aujourdhui, ajouterMois, formatDate, formatPoids, lireISO } from '../../js/utils.js';
import { confirmer, modale, toast } from '../../js/ui.js';
import { icone } from '../../js/icons.js';
import { bouton, champ, vide } from '../../js/composants.js';
import { erreurChamp } from './commun.js';

const POIDS_MAX = 2000; // kg

/** Nombre en français, sans décimale inutile (jusqu'à 3 : 0,035 reste 0,035). */
const nombre = (n) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: Math.round(n * 1000) / 1000 === n ? 3 : 6 });

/**
 * Lit un poids saisi (virgule ou point, 3 décimales au plus). Retourne { kg } ou { erreur }.
 * Le champ est un texte et non un « number » : un champ number refuse la virgule selon la langue du navigateur.
 */
export function lirePoids(saisie) {
  const t = String(saisie ?? '').trim().replace(/\s/g, '');
  if (!t) return { erreur: 'Indiquez le poids en kilogrammes.' };
  if (!/^\d+([.,]\d+)?$/.test(t)) return { erreur: 'Entrez un nombre, par exemple 4,2 ou 0,035.' };
  if (/[.,]\d{4,}$/.test(t)) return { erreur: 'Trois décimales au maximum (par exemple 0,035 kg, soit 35 g).' };
  const kg = Number(t.replace(',', '.'));
  if (!(kg > 0)) return { erreur: 'Le poids doit être supérieur à 0.' };
  if (kg > POIDS_MAX) return { erreur: `Le poids ne peut pas dépasser ${nombre(POIDS_MAX)} kg.` };
  return { kg };
}

/** Une pesée au format attendu (date AAAA-MM-JJ valide, poids positif) : les données abîmées ne sont pas affichées, mais jamais effacées. */
const lisible = (p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date ?? '') && !Number.isNaN(lireISO(p.date).getTime()) && Number.isFinite(p.poidsKg) && p.poidsKg > 0;

/** Vérifie la date d'une pesée : présente, valide et pas dans le futur (aujourd'hui accepté). */
export function verifierDate(date) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(lireISO(date).getTime())) return 'Indiquez la date de la pesée.';
  if (date > aujourdhui()) return 'La date ne peut pas être dans le futur.';
  return '';
}

/**
 * Graduations de l'axe vertical : 3 à 7 valeurs rondes (pas de 1, 2, 2,5 ou 5 × une puissance de 10) comprises dans [min, max].
 * Les étiquettes sont EXACTEMENT les valeurs des lignes : la position de chaque ligne vient de la même fonction y() que celle des points.
 */
function graduations(min, max) {
  const brut = (max - min) / 3;
  const base = 10 ** Math.floor(Math.log10(brut));
  const pas = [5, 2.5, 2, 1].map((f) => f * base).find((p) => p <= brut * 1.000001) ?? base;
  const valeurs = [];
  for (let k = Math.ceil(min / pas - 1e-9); k * pas <= max + pas * 1e-9; k++) valeurs.push(Number((k * pas).toFixed(10)));
  let d = 0;
  while (d < 8 && valeurs.some((v) => Math.abs(v - Number(v.toFixed(d))) > 1e-9)) d++;
  return valeurs.map((v) => ({ v, texte: v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) }));
}

/**
 * Courbe lissée passant par tous les points, qui NE DÉPASSE JAMAIS les valeurs mesurées : interpolation monotone
 * (Fritsch-Carlson). Une courbe « naïve » (Catmull-Rom…) pourrait dessiner un poids plus haut ou plus bas qu'aucune pesée.
 * `pts` : [{ x, y }] triés par x ; deux pesées le même jour (même x) sont reliées par un trait droit.
 */
export function courbe(pts) {
  const n = pts.length;
  const dx = [];
  const pente = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    pente[i] = dx[i] > 1e-9 ? (pts[i + 1].y - pts[i].y) / dx[i] : 0;
  }
  const t = new Array(n).fill(0); // pente de la courbe en chaque point
  if (n === 2) {
    t[0] = pente[0]; t[1] = pente[0];
  } else if (n > 2) {
    t[0] = pente[0]; t[n - 1] = pente[n - 2];
    for (let i = 1; i < n - 1; i++) {
      t[i] = dx[i - 1] <= 1e-9 || dx[i] <= 1e-9 || pente[i - 1] * pente[i] <= 0 ? 0 : (pente[i - 1] + pente[i]) / 2; // un sommet ou un creux reste plat
    }
  }
  for (let i = 0; i < n - 1; i++) { // limitation de Fritsch-Carlson : pas de dépassement entre deux points
    if (dx[i] <= 1e-9) continue;
    if (pente[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / pente[i];
    const b = t[i + 1] / pente[i];
    const somme = a * a + b * b;
    if (somme > 9) { const k = 3 / Math.sqrt(somme); t[i] = k * a * pente[i]; t[i + 1] = k * b * pente[i]; }
  }
  const f = (v) => v.toFixed(2);
  let d = `M${f(pts[0].x)},${f(pts[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const { x: x0, y: y0 } = pts[i];
    const { x: x1, y: y1 } = pts[i + 1];
    if (dx[i] <= 1e-9) { d += `L${f(x1)},${f(y1)}`; continue; }
    const c = dx[i] / 3;
    d += `C${f(x0 + c)},${f(y0 + t[i] * c)} ${f(x1 - c)},${f(y1 - t[i + 1] * c)} ${f(x1)},${f(y1)}`;
  }
  return d;
}

/**
 * Construit le graphique SVG. `pesees` doit être triée par date croissante.
 * `largeur` : largeur réelle disponible en pixels. Le dessin est fait à CETTE taille (1 unité = 1 pixel), donc les chiffres
 * des axes restent petits et nets sur ordinateur comme sur téléphone. `periode` : texte de la période choisie (facultatif).
 */
export function graphiqueSvg(pesees, { largeur = 600, periode = '' } = {}) {
  const L = Math.max(260, Math.round(largeur));
  const H = L < 460 ? 150 : 172; // peu haut : la courbe se lit d'un coup d'œil
  const poids = pesees.map((p) => p.poidsKg);
  const pMin = Math.min(...poids);
  const pMax = Math.max(...poids);
  let min = pMin;
  let max = pMax;
  if (min === max) { const e = Math.max(min * 0.1, 0.001); min -= e; max += e; }
  const marge15 = (max - min) * 0.15;
  min = Math.max(min - marge15, 0); max += marge15;

  const graduationsAxe = graduations(min, max);
  const marge = { g: Math.round(14 + 6 * Math.max(...graduationsAxe.map((g) => g.texte.length))), d: 14, h: 12, b: 26 }; // la marge gauche suit la longueur des chiffres
  const largeurUtile = L - marge.g - marge.d;
  const hauteur = H - marge.h - marge.b;

  // UNE SEULE conversion valeur -> position, utilisée par la grille, la courbe et les points
  const t0 = lireISO(pesees[0].date).getTime();
  const t1 = lireISO(pesees[pesees.length - 1].date).getTime();
  const dedans = 12; // le premier et le dernier point ne touchent ni l'axe ni le bord
  const x = (date) => marge.g + dedans + (t1 === t0 ? (largeurUtile - 2 * dedans) / 2 : ((lireISO(date).getTime() - t0) / (t1 - t0)) * (largeurUtile - 2 * dedans));
  const y = (kg) => marge.h + (1 - (kg - min) / (max - min)) * hauteur;

  // Les étiquettes sont écrites sur la ligne de leur valeur (y + 4 : le milieu du chiffre tombe sur la ligne)
  const grille = graduationsAxe.map((g) => `
    <line x1="${marge.g}" x2="${L - marge.d}" y1="${y(g.v).toFixed(2)}" y2="${y(g.v).toFixed(2)}" class="ps-grille"/>
    <text x="${marge.g - 8}" y="${(y(g.v) + 4).toFixed(2)}" text-anchor="end" class="ps-texte">${g.texte}</text>`).join('');

  const pts = pesees.map((p) => ({ x: x(p.date), y: y(p.poidsKg) }));
  const trace = courbe(pts);
  const bas = marge.h + hauteur;
  const aire = `${trace}L${pts[pts.length - 1].x.toFixed(2)},${bas}L${pts[0].x.toFixed(2)},${bas}Z`;
  const rayonCible = pesees.length > 30 ? 8 : 16; // zone de survol et de toucher, bien plus grande que le point
  const ronds = pesees.map((p, i) => `<circle cx="${pts[i].x.toFixed(2)}" cy="${pts[i].y.toFixed(2)}" r="3.5" class="ps-point" data-kg="${p.poidsKg}"/>`).join('');
  const cibles = pesees.map((p, i) => `<circle cx="${pts[i].x.toFixed(2)}" cy="${pts[i].y.toFixed(2)}" r="${rayonCible}" class="ps-cible" data-i="${i}" data-info="${echapper(`${formatDate(p.date)} · ${formatPoids(p.poidsKg)}`)}"/>`).join('');

  const debut = pesees[0].date;
  const fin = pesees[pesees.length - 1].date;
  const resume = `Évolution du poids${periode ? ` (${periode})` : ''} : ${pesees.length} pesées du ${formatDate(debut)} au ${formatDate(fin)}, de ${formatPoids(pesees[0].poidsKg)} à ${formatPoids(pesees[pesees.length - 1].poidsKg)} (minimum ${formatPoids(pMin)}, maximum ${formatPoids(pMax)}).`;

  return `
    <svg viewBox="0 0 ${L} ${H}" width="100%" height="${H}" class="ps-graphique" role="img" aria-label="${echapper(resume)}">
      <defs>
        <linearGradient id="ps-degrade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="ps-degrade-haut"/><stop offset="1" class="ps-degrade-bas"/></linearGradient>
      </defs>
      ${grille}
      <path d="${aire}" class="ps-aire" fill="url(#ps-degrade)"/>
      <path d="${trace}" class="ps-ligne" pathLength="1"/>
      <line x1="0" x2="0" y1="${marge.h}" y2="${bas}" class="ps-repere"/>
      ${ronds}
      ${cibles}
      <text x="${marge.g}" y="${H - 6}" class="ps-texte">${formatDate(debut)}</text>
      <text x="${L - marge.d}" y="${H - 6}" text-anchor="end" class="ps-texte">${formatDate(fin)}</text>
    </svg>
    <div class="ps-infobulle" aria-hidden="true" hidden></div>`;
}

// ----- Période affichée par le graphique (le choix est gardé pendant la visite, y compris après l'ajout d'une pesée) -----
const PERIODES = [
  { id: '3m', texte: '3 mois', mois: 3 },
  { id: '6m', texte: '6 mois', mois: 6 },
  { id: '1a', texte: '1 an', mois: 12 },
  { id: 'tout', texte: 'Tout', mois: 0 },
];
let periodeChoisie = 'tout';

/** Les pesées qui tombent dans la période (elles sont déjà triées). Seul l'affichage change : aucune donnée n'est touchée. */
export function dansPeriode(pesees, idPeriode) {
  const p = PERIODES.find((x) => x.id === idPeriode);
  if (!p?.mois) return pesees;
  const debut = ajouterMois(aujourdhui(), -p.mois);
  return pesees.filter((x) => x.date >= debut);
}

function carteHtml(pesee, precedente) {
  let variation = '';
  if (precedente) {
    const diff = Math.round((pesee.poidsKg - precedente.poidsKg) * 10000) / 10000;
    variation = diff !== 0
      ? `<span class="ps-ligne-info">${icone(diff > 0 ? 'arrow-up' : 'arrow-down', { taille: 16 })}<span>${diff > 0 ? '+' : '−'}${nombre(Math.abs(diff))} kg depuis la pesée précédente</span></span>`
      : `<span class="ps-ligne-info">${icone('minus', { taille: 16 })}<span>Poids inchangé depuis la pesée précédente</span></span>`;
  }
  const nom = `la pesée de ${formatPoids(pesee.poidsKg)} du ${formatDate(pesee.date)}`;
  return `
    <li class="cp-carte ps-carte" data-pesee="${echapper(pesee.id)}">
      <span class="ps-carte__icone" aria-hidden="true">${icone('scale', { taille: 24 })}</span>
      <div class="ps-carte__corps">
        <strong class="ps-carte__poids">${formatPoids(pesee.poidsKg)}</strong>
        <span class="ps-ligne-info">${icone('calendar', { taille: 16 })}<time datetime="${echapper(pesee.date)}">${formatDate(pesee.date)}</time></span>
        ${variation}
      </div>
      <div class="ps-carte__actions">
        ${bouton({ variante: 'secondaire', taille: 's', seul: true, icone: 'trash-2', titre: `Supprimer ${nom}`, attrs: { 'data-supprimer': pesee.id } })}
      </div>
    </li>`;
}

// Un toucher ou un clic n'importe où ailleurs referme l'info-bulle ouverte (un seul écouteur pour toute l'application)
document.addEventListener('pointerdown', (e) => {
  if (e.target.closest?.('.ps-cible')) return;
  document.querySelectorAll('.ps-infobulle:not([hidden])').forEach((b) => {
    b.hidden = true;
    b.closest('.ps-graph')?.querySelectorAll('.ps-point--actif').forEach((p) => p.classList.remove('ps-point--actif'));
    b.closest('.ps-graph')?.querySelector('.ps-repere')?.classList.remove('est-visible');
  });
});

/** Ajout d'une pesée dans une fenêtre (action rapide de l'Accueil). Mêmes vérifications que le formulaire de l'onglet Poids. */
export function formulairePesee(animal, apres) {
  const html = `
    <form class="cp-formulaire sn-form" novalidate>
      ${champ({ id: 'mpesee-date', label: 'Date', type: 'date', valeur: aujourdhui(), requis: true, attrs: { name: 'date', max: aujourdhui() } })}
      ${champ({ id: 'mpesee-poids', label: 'Poids (kg)', valeur: '', requis: true, placeholder: 'Ex. : 4,2', aide: 'Virgule ou point. Petit animal : 0,035 pour 35 g.', attrs: { name: 'poids', inputmode: 'decimal', autocomplete: 'off' } })}
      <div class="sn-form__actions">
        ${bouton({ texte: 'Annuler', variante: 'secondaire', attrs: { 'data-annuler': true } })}
        ${bouton({ texte: 'Enregistrer', type: 'submit', icone: 'check' })}
      </div>
    </form>`;
  modale(`Nouvelle pesée pour ${animal.nom}`, html, (dlg) => {
    const form = dlg.querySelector('form');
    dlg.querySelector('[data-annuler]').addEventListener('click', () => dlg.close());
    form.addEventListener('input', (e) => { if (e.target.getAttribute('aria-invalid')) erreurChamp(e.target, ''); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      form.querySelectorAll('[aria-invalid]').forEach((c) => erreurChamp(c, ''));
      const erreurDate = verifierDate(form.date.value);
      const lu = lirePoids(form.poids.value);
      if (erreurDate) erreurChamp(form.date, erreurDate);
      if (lu.erreur) erreurChamp(form.poids, lu.erreur);
      if (erreurDate || lu.erreur) { (erreurDate ? form.date : form.poids).focus(); return; }
      storage.ajouter('pesees', { animalId: animal.id, date: form.date.value, poidsKg: lu.kg });
      dlg.close();
      toast('Pesée ajoutée');
      apres();
    });
  });
}

/** Affiche la section « Pesées » dans `zone`. */
export function rendre(zone, animal) {
  const section = document.createElement('section');
  section.className = 'ps';
  zone.replaceChildren(section);

  const pesees = storage.lister('pesees')
    .filter((p) => p.animalId === animal.id && lisible(p))
    .sort((a, b) => a.date.localeCompare(b.date));

  const rerendre = () => rendre(zone, animal);

  let graphique;
  if (pesees.length >= 2) {
    graphique = `
      <div class="cp-carte ps-graph">
        <div class="ps-graph__tete">
          <h3>Évolution <span class="ps-unite">(poids en kg)</span></h3>
          <div class="ps-periodes" role="group" aria-label="Période du graphique">
            ${PERIODES.map((p) => `<button type="button" class="cp-filtre" aria-pressed="${p.id === periodeChoisie}" data-periode="${p.id}">${p.texte}</button>`).join('')}
          </div>
        </div>
        <div class="ps-graph__zone" data-zone></div>
        <p class="cp-sr" role="status" data-etat></p>
      </div>`;
  } else if (pesees.length === 1) {
    graphique = `<p class="ps-note">${icone('info', { taille: 16 })}<span>Ajoutez une deuxième pesée pour voir la courbe.</span></p>`;
  } else {
    graphique = `<div class="cp-carte">${vide({ niveau: 3, icone: 'scale', titre: "Aucune pesée pour l'instant", texte: `Notez le poids de ${animal.nom} pour suivre son évolution.` })}</div>`;
  }

  // Liste : la plus récente en premier, avec la variation par rapport à la précédente
  const liste = pesees.map((p, i) => carteHtml(p, pesees[i - 1])).reverse().join('');

  section.innerHTML = `
    <div class="sn-entete"><h2 id="ps-titre" tabindex="-1">Poids</h2></div>
    <form class="cp-carte cp-formulaire ps-form" novalidate aria-labelledby="ps-titre-form">
      <h3 class="ps-form__titre" id="ps-titre-form">Ajouter une pesée</h3>
      <div class="ps-form__champs">
        ${champ({ id: 'pesee-date', label: 'Date', type: 'date', valeur: aujourdhui(), requis: true, attrs: { name: 'date', max: aujourdhui() } })}
        ${champ({ id: 'pesee-poids', label: 'Poids (kg)', valeur: '', requis: true, placeholder: 'Ex. : 4,2', aide: 'Virgule ou point. Petit animal : 0,035 pour 35 g.',
          attrs: { name: 'poids', inputmode: 'decimal', autocomplete: 'off' } })}
      </div>
      ${bouton({ texte: 'Ajouter la pesée', icone: 'plus', type: 'submit' })}
    </form>
    ${graphique}
    ${pesees.length ? `<ul class="sn-liste" aria-label="Pesées, de la plus récente à la plus ancienne">${liste}</ul>` : ''}`;

  // Graphique : dessiné à la largeur réelle de sa zone, redessiné si cette largeur change (rotation du téléphone, fenêtre redimensionnée)
  // et quand on change de période. La courbe se trace à l'affichage (animation CSS, supprimée si « réduire les animations »).
  const graph = section.querySelector('.ps-graph');
  if (graph) {
    const zone = graph.querySelector('[data-zone]');
    const etat = graph.querySelector('[data-etat]');
    let largeurDessinee = -1;
    const dessiner = (annoncer = false) => {
      const periode = PERIODES.find((p) => p.id === periodeChoisie);
      const vue = dansPeriode(pesees, periodeChoisie);
      largeurDessinee = zone.clientWidth;
      if (vue.length < 2) {
        zone.innerHTML = `<p class="ps-note ps-note--periode">${icone('info', { taille: 16 })}<span>Moins de deux pesées sur cette période : choisissez une période plus longue.</span></p>`;
      } else {
        zone.innerHTML = graphiqueSvg(vue, { largeur: largeurDessinee || 600, periode: periode.mois ? periode.texte : '' });
      }
      if (annoncer) etat.textContent = vue.length < 2 ? 'Moins de deux pesées sur cette période.' : `Graphique : ${vue.length} pesées${periode.mois ? `, ${periode.texte}` : ''}.`;
    };
    dessiner();
    new ResizeObserver(() => { if (zone.clientWidth > 0 && Math.abs(zone.clientWidth - largeurDessinee) > 24) dessiner(); }).observe(zone);

    graph.querySelector('.ps-periodes').addEventListener('click', (e) => {
      const b = e.target.closest('[data-periode]');
      if (!b || b.dataset.periode === periodeChoisie) return;
      periodeChoisie = b.dataset.periode;
      graph.querySelectorAll('[data-periode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      dessiner(true);
    });

    // Info-bulle des points : survol à la souris, toucher sur téléphone (le survol n'existe pas au doigt).
    // Elle double la liste de cartes ci-dessous, qui reste la version accessible au clavier et aux lecteurs d'écran.
    const cacher = () => {
      const bulle = zone.querySelector('.ps-infobulle');
      if (bulle) bulle.hidden = true;
      zone.querySelectorAll('.ps-point--actif').forEach((p) => p.classList.remove('ps-point--actif'));
      zone.querySelector('.ps-repere')?.classList.remove('est-visible');
    };
    const montrer = (cible) => {
      cacher();
      const bulle = zone.querySelector('.ps-infobulle');
      const point = zone.querySelectorAll('.ps-point')[Number(cible.dataset.i)];
      point.classList.add('ps-point--actif');
      const repere = zone.querySelector('.ps-repere');
      repere.setAttribute('x1', point.getAttribute('cx'));
      repere.setAttribute('x2', point.getAttribute('cx'));
      repere.classList.add('est-visible');
      bulle.textContent = cible.dataset.info; // date et poids
      bulle.hidden = false;
      const g = graph.getBoundingClientRect();
      const c = point.getBoundingClientRect();
      const moitie = bulle.offsetWidth / 2;
      const centre = Math.min(Math.max(c.left + c.width / 2 - g.left, moitie + 4), g.width - moitie - 4); // reste dans la carte
      bulle.style.left = `${centre}px`;
      bulle.style.top = `${c.top - g.top - 8}px`;
    };
    graph.addEventListener('pointerover', (e) => { const c = e.target.closest('.ps-cible'); if (c) montrer(c); });
    graph.addEventListener('pointerout', (e) => { if (e.pointerType === 'mouse' && e.target.closest('.ps-cible')) cacher(); });
    section.addEventListener('pointerdown', (e) => { const c = e.target.closest('.ps-cible'); if (c) montrer(c); else cacher(); });
  }

  const form = section.querySelector('form');
  form.addEventListener('input', (e) => { if (e.target.getAttribute('aria-invalid')) erreurChamp(e.target, ''); });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    form.querySelectorAll('[aria-invalid]').forEach((c) => erreurChamp(c, ''));
    const erreurDate = verifierDate(form.date.value);
    const lu = lirePoids(form.poids.value);
    if (erreurDate) erreurChamp(form.date, erreurDate);
    if (lu.erreur) erreurChamp(form.poids, lu.erreur);
    if (erreurDate || lu.erreur) { (erreurDate ? form.date : form.poids).focus(); return; }
    storage.ajouter('pesees', { animalId: animal.id, date: form.date.value, poidsKg: lu.kg });
    toast('Pesée ajoutée');
    rerendre();
    zone.querySelector('#pesee-poids')?.focus(); // prêt à saisir la suivante
  });

  section.addEventListener('click', async (e) => {
    const declencheur = e.target.closest('[data-supprimer]');
    if (!declencheur) return;
    const pesee = storage.trouver('pesees', declencheur.dataset.supprimer);
    if (!pesee) return;
    if (await confirmer(`Supprimer la pesée de ${formatPoids(pesee.poidsKg)} du ${formatDate(pesee.date)} ?`)) {
      storage.supprimer('pesees', pesee.id);
      toast('Pesée supprimée');
      rerendre();
      zone.querySelector('#ps-titre')?.focus(); // la carte a disparu : le focus revient au titre de la section
    }
  });
}
