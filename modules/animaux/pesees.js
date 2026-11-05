// Pesées d'un animal + petit graphique d'évolution (dessiné à la main en SVG).
// Format des données inchangé : { id, animalId, date, poidsKg }.

import * as storage from '../../js/storage.js';
import { echapper, aujourdhui, formatDate, formatPoids, lireISO } from '../../js/utils.js';
import { confirmer, toast } from '../../js/ui.js';
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

/** Construit le graphique SVG. `pesees` doit être triée par date croissante. */
export function graphiqueSvg(pesees) {
  const L = 620, H = 260;
  const marge = { g: 64, d: 18, h: 16, b: 34 };
  const largeur = L - marge.g - marge.d;
  const hauteur = H - marge.h - marge.b;

  const poids = pesees.map((p) => p.poidsKg);
  const pMin = Math.min(...poids);
  const pMax = Math.max(...poids);
  let min = pMin;
  let max = pMax;
  if (min === max) { const e = Math.max(min * 0.1, 0.001); min -= e; max += e; }
  const marge15 = (max - min) * 0.15;
  min = Math.max(min - marge15, 0); max += marge15;

  // UNE SEULE conversion valeur -> position, utilisée par la grille, la ligne et les points
  const t0 = lireISO(pesees[0].date).getTime();
  const t1 = lireISO(pesees[pesees.length - 1].date).getTime();
  const dedans = 14; // le premier et le dernier point ne touchent ni l'axe ni le bord
  const x = (date) => marge.g + dedans + (t1 === t0 ? (largeur - 2 * dedans) / 2 : ((lireISO(date).getTime() - t0) / (t1 - t0)) * (largeur - 2 * dedans));
  const y = (kg) => marge.h + (1 - (kg - min) / (max - min)) * hauteur;

  const grille = graduations(min, max).map((g) => `
    <line x1="${marge.g}" x2="${L - marge.d}" y1="${y(g.v).toFixed(2)}" y2="${y(g.v).toFixed(2)}" class="ps-grille"/>
    <text x="${marge.g - 8}" y="${(y(g.v) + 4).toFixed(2)}" text-anchor="end" class="ps-texte">${g.texte}</text>`).join('');

  const points = pesees.map((p) => `${x(p.date).toFixed(2)},${y(p.poidsKg).toFixed(2)}`).join(' ');
  const rayonCible = pesees.length > 30 ? 8 : 14; // zone de survol et de toucher, plus grande que le point
  const ronds = pesees.map((p) => `<circle cx="${x(p.date).toFixed(2)}" cy="${y(p.poidsKg).toFixed(2)}" r="5" class="ps-point" data-kg="${p.poidsKg}"/>`).join('');
  const cibles = pesees.map((p, i) => `<circle cx="${x(p.date).toFixed(2)}" cy="${y(p.poidsKg).toFixed(2)}" r="${rayonCible}" class="ps-cible" data-i="${i}" data-info="${echapper(`${formatDate(p.date)} · ${formatPoids(p.poidsKg)}`)}"/>`).join('');

  const debut = pesees[0].date;
  const fin = pesees[pesees.length - 1].date;
  const resume = `Évolution du poids : ${pesees.length} pesées du ${formatDate(debut)} au ${formatDate(fin)}, de ${formatPoids(pesees[0].poidsKg)} à ${formatPoids(pesees[pesees.length - 1].poidsKg)} (minimum ${formatPoids(pMin)}, maximum ${formatPoids(pMax)}).`;

  return `
    <svg viewBox="0 0 ${L} ${H}" class="ps-graphique" role="img" aria-label="${echapper(resume)}">
      ${grille}
      <polyline points="${points}" class="ps-ligne"/>
      ${ronds}
      ${cibles}
      <text x="${marge.g}" y="${H - 8}" class="ps-texte">${formatDate(debut)}</text>
      <text x="${L - marge.d}" y="${H - 8}" text-anchor="end" class="ps-texte">${formatDate(fin)}</text>
    </svg>
    <div class="ps-infobulle" aria-hidden="true" hidden></div>`;
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
  });
});

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
    graphique = `<div class="cp-carte ps-graph"><div class="ps-graph__tete"><h3>Évolution</h3><span class="ps-unite">Poids en kg</span></div>${graphiqueSvg(pesees)}</div>`;
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

  // Info-bulle des points : survol à la souris, toucher sur téléphone (le survol n'existe pas au doigt).
  // Elle double la liste de cartes ci-dessous, qui reste la version accessible au clavier et aux lecteurs d'écran.
  const graph = section.querySelector('.ps-graph');
  const bulle = graph?.querySelector('.ps-infobulle');
  if (bulle) {
    const points = [...graph.querySelectorAll('.ps-point')];
    const cacher = () => { bulle.hidden = true; points.forEach((p) => p.classList.remove('ps-point--actif')); };
    const montrer = (cible) => {
      cacher();
      const point = points[Number(cible.dataset.i)];
      point.classList.add('ps-point--actif');
      bulle.textContent = cible.dataset.info;
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
