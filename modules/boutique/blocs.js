// Boutique : les morceaux d'interface partagés (page Boutique, fiche d'un animal, « Toxique ? »).
//   - carteProduit()      : une carte de produit, avec le bouton « Voir le prix » ;
//   - blocPourAnimal()    : « Pour [nom] », trois produits de l'espèce de l'animal ;
//   - blocAlternative()   : sous un aliment dangereux, une alternative sûre quand c'est pertinent.
// Tous les liens s'ouvrent dans un nouvel onglet avec rel="sponsored noopener" ; la mention (indépendante ou d'affiliation, automatique) accompagne chaque bloc de liens.

import { echapper } from '../../js/utils.js';
import { icone } from '../../js/icons.js';
import { ESPECES_TOXIQUE } from '../toxique/donnees.js';
import { PRODUITS, BESOINS, mentionCourante, selectionAffiliee, lienFinal, produitsPourEspece } from './produits.js';

export const besoin = (id) => BESOINS.find((b) => b.id === id);
export const groupeEspece = (id) => ESPECES_TOXIQUE.find((g) => g.id === id);
/** Le groupe d'espèces d'un animal de l'appli (Rongeurs = cochon d'Inde + hamster), ou null. */
export const groupeDeAnimal = (animal) => ESPECES_TOXIQUE.find((g) => g.especes.includes(animal?.espece)) ?? null;

/** Le lien vers le site marchand : nouvel onglet, rel="sponsored noopener" (lien affilié s'il est rempli). */
export function lienProduit(p, { classe = 'cp-btn cp-btn--secondaire' } = {}) {
  return `<a class="${classe}" href="${echapper(lienFinal(p))}" target="_blank" rel="sponsored noopener" aria-label="${echapper(`Voir le prix : ${p.nom}, chez ${p.marchand} (s'ouvre dans un nouvel onglet)`)}">${icone('external-link', { taille: 16 })}<span>Voir le prix</span></a>`;
}

/** La mention (automatique) : indépendante tant qu'aucun lien n'est affilié, sinon la mention d'affiliation. */
export const mentionHtml = (classe = '') => `<p class="bq-mention${classe ? ` ${classe}` : ''}" role="note" data-mention="${selectionAffiliee() ? 'affiliation' : 'independante'}">${icone('info', { taille: 16 })}<span>${echapper(mentionCourante())}</span></p>`;

/** Une carte de produit. Aucun prix, aucune note, aucun avis : seulement ce que Carnet Patte écrit lui-même. */
export function carteProduit(p) {
  const b = besoin(p.categorie);
  const especes = p.especes.map((id) => groupeEspece(id)?.nom).filter(Boolean).join(', ');
  return `
    <li class="cp-carte bq-produit" data-produit="${echapper(p.id)}" data-categorie="${echapper(p.categorie)}">
      <div class="bq-produit__tete">
        <span class="bq-produit__icone" aria-hidden="true">${icone(b?.icone ?? 'shopping-bag', { taille: 20 })}</span>
        <div class="bq-produit__titre">
          <h3 class="bq-produit__nom">${echapper(p.nom)}</h3>
          <p class="bq-produit__meta">${echapper(b?.court ?? '')} · ${echapper(especes)}</p>
        </div>
      </div>
      <p class="bq-produit__pourquoi"><strong>Pourquoi on le recommande :</strong> ${echapper(p.pourquoi)}</p>
      <div class="bq-produit__pied">
        <span class="bq-produit__marchand">Chez ${echapper(p.marchand)}</span>
        ${lienProduit(p)}
      </div>
    </li>`;
}

// ----- « Pour [nom] » : trois produits de l'espèce de l'animal, sur la fiche -----

const PRIORITE = ['arrivee', 'couchage', 'jouets', 'gamelles', 'transport', 'hygiene', 'saison'];
const hash = (texte) => [...String(texte)].reduce((t, c) => (t * 31 + c.charCodeAt(0)) % 9973, 7);

/** Hors saison : un produit d'été n'est pas proposé en hiver, et inversement. */
function enSaison(p, mois) {
  if (p.saison === 'ete') return mois >= 4 && mois <= 8;
  if (p.saison === 'hiver') return mois >= 10 || mois <= 2;
  return true;
}

/** « Arrivée » seulement pour un animal de moins d'un an (date de naissance connue). */
function estJeune(animal) {
  const n = Date.parse(animal?.naissance ?? '');
  return Number.isFinite(n) && Date.now() - n < 365 * 864e5 && Date.now() >= n;
}

/**
 * Trois produits de l'espèce, de besoins différents. Le choix est stable pour un animal donné (même animal, mêmes produits)
 * mais varie d'un animal à l'autre.
 */
export function produitsPourAnimal(animal, nombre = 3, mois = new Date().getMonth()) {
  const g = groupeDeAnimal(animal);
  if (!g) return [];
  const candidats = produitsPourEspece(g.id).filter((p) => enSaison(p, mois) && (p.categorie !== 'arrivee' || estJeune(animal)));
  const categories = PRIORITE.filter((c) => candidats.some((p) => p.categorie === c));
  const h = hash(animal.id);
  const choisis = [];
  for (let i = 0; i < categories.length && choisis.length < nombre; i++) {
    const c = categories[(i + h) % categories.length];
    const dans = candidats.filter((p) => p.categorie === c);
    choisis.push(dans[(h + i) % dans.length]);
  }
  return choisis;
}

export function blocPourAnimal(animal) {
  const g = groupeDeAnimal(animal);
  const produits = produitsPourAnimal(animal);
  if (!g || !produits.length) return '';
  return `
    <section class="bq-bloc" aria-labelledby="bq-pour">
      <div class="bq-bloc__tete">
        <h2 id="bq-pour">Pour ${echapper(animal.nom)}</h2>
        <a class="pg-lien" href="#/boutique/${echapper(g.id)}">Toute la sélection ${icone('chevron-right', { taille: 16 })}</a>
      </div>
      <ul class="bq-liste bq-liste--bloc">${produits.map(carteProduit).join('')}</ul>
      ${mentionHtml('bq-mention--petite')}
    </section>`;
}

// ----- Sous un aliment dangereux : une alternative sûre, quand c'est pertinent -----

/** Les produits qui remplacent l'élément de la fiche « Toxique ? » `ficheId`, pour l'espèce `groupeId`. */
export const alternativesA = (ficheId, groupeId) => PRODUITS.filter((p) => p.remplace?.includes(ficheId) && p.especes.includes(groupeId));

export function blocAlternative(ficheId, groupeId) {
  const produits = alternativesA(ficheId, groupeId);
  if (!produits.length) return '';
  return `
    <div class="bq-alternative">
      <h4 class="tx-titre">Une alternative sûre</h4>
      <ul class="bq-liste bq-liste--bloc">${produits.map(carteProduit).join('')}</ul>
      ${mentionHtml('bq-mention--petite')}
    </div>`;
}
