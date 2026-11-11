// Accueil : « Bonjour [prénom] » + résumé, avatars des animaux, actions rapides, prochains rappels, conseil du moment, bilan du mois.
// Cette page LIT les données mais ne les modifie jamais (les ajouts passent par les formulaires existants).

import * as storage from '../../js/storage.js';
import { icone } from '../../js/icons.js';
import { echapper, formatDate, aujourdhui } from '../../js/utils.js';
import { vide, avatar, couleurAnimal } from '../../js/composants.js';
import { modale } from '../../js/ui.js';
import { rafraichir } from '../../js/router.js';
import { conseilDuMois, PHRASE_VETERINAIRE } from '../../js/conseils.js';
import { calculerRappels } from '../animaux/rappels.js';
import { formulaireAnimal } from '../animaux/animaux.js';
import { formulaireSoin } from '../animaux/soins.js';
import { formulairePesee } from '../animaux/pesees.js';
import { infosEspece, infosType, classeType, badgeEcheance, nomCourtSoin } from '../animaux/commun.js';

const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
const photoDe = (a) => (typeof a.photo === 'string' && a.photo.startsWith('data:image/') ? a.photo : '');

/** « 27 oct. » pour l'année en cours, « 27 oct. 2027 » sinon : la ligne reste courte. */
export function dateCourte(iso) {
  const complete = formatDate(iso);
  return iso?.slice(0, 4) === aujourdhui().slice(0, 4) ? complete.replace(/\s+\d{4}$/, '') : complete;
}

/** Une ligne de rappel compacte : le soin en haut, l'animal et la date dessous, le badge à droite. */
function ligneRappel(r) {
  return `
    <li><a class="cp-liste__ligne cp-liste__ligne--lien" href="#/animaux/rappels">
      <span class="cp-liste__icone ${classeType(r.soin.type)}">${icone(infosType(r.soin.type).icone, { taille: 18 })}</span>
      <div class="cp-liste__corps"><span class="cp-liste__titre">${echapper(nomCourtSoin(r.soin))}</span><span class="cp-liste__meta">${echapper(r.animal.nom)} · ${dateCourte(r.soin.rappel)}</span></div>
      <div class="cp-liste__fin">${badgeEcheance(r.statut)}</div>
    </a></li>`;
}

/** Plusieurs animaux : un petit choix « Pour quel animal ? » avant le formulaire. Un seul animal : on va directement au formulaire. */
function pourUnAnimal(animaux, suite) {
  if (animaux.length === 1) { suite(animaux[0]); return; }
  const html = `
    <div class="ac-choix" role="group" aria-label="Animal concerné">
      ${animaux.map((a) => `<button type="button" class="cp-carte ac-choix__animal" data-animal="${echapper(a.id)}">${avatar({ icone: infosEspece(a).icone, photo: photoDe(a), nom: a.nom, id: a.id, couleur: couleurAnimal(a) })}<span>${echapper(a.nom)}</span></button>`).join('')}
    </div>`;
  modale('Pour quel animal ?', html, (dlg) => {
    dlg.addEventListener('click', (e) => {
      const b = e.target.closest('[data-animal]');
      const animal = b && storage.trouver('animaux', b.dataset.animal);
      if (!animal) return;
      dlg.close();
      suite(animal);
    });
  });
}

const action = ({ id, texte, ic, href }) => {
  const rond = `<span class="ac-action__rond" aria-hidden="true">${icone(ic, { taille: 26 })}</span><span class="ac-action__texte">${texte}</span>`;
  return href ? `<a class="ac-action" href="${href}">${rond}</a>` : `<button type="button" class="ac-action" data-act="${id}">${rond}</button>`;
};

export function rendre(zone) {
  zone.classList.add('page-large');
  const { prenom } = storage.lireProfil(); // facultatif : sans prénom, « Bonjour » tout court

  const animaux = storage.lister('animaux').sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const parId = new Map(animaux.map((a) => [a.id, a]));
  const rappels = calculerRappels(); // du plus en retard au plus lointain
  const enRetard = rappels.filter((r) => r.statut.classe === 'retard').length;

  // Bilan du mois : soins déjà faits (date du soin passée) et pesées, dans le mois en cours, pour les animaux qui existent
  const auj = aujourdhui();
  const moisCourant = auj.slice(0, 7);
  const dansLeMois = (e) => e.date && e.date.slice(0, 7) === moisCourant && e.date <= auj && parId.has(e.animalId);
  const nbSoins = storage.lister('soins').filter(dansLeMois).length;
  const nbPesees = storage.lister('pesees').filter(dansLeMois).length;

  const conseil = conseilDuMois();

  const resume = animaux.length
    ? `<a class="ac-resume" href="#/animaux/rappels">${pluriel(animaux.length, 'animal', 'animaux')} · ${enRetard ? `<span class="ac-resume__retard">${pluriel(enRetard, 'rappel en retard', 'rappels en retard')}</span>` : 'aucun rappel en retard'}${icone('chevron-right', { taille: 14 })}</a>`
    : '<p class="ac-resume ac-resume--vide">Votre carnet est vide pour l\'instant.</p>';

  const stories = animaux.length ? `
      <nav class="ac-stories" aria-label="Mes animaux">
        <ul>
          ${animaux.map((a) => `<li><a class="ac-story" href="#/animaux/${encodeURIComponent(a.id)}">${avatar({ icone: infosEspece(a).icone, photo: photoDe(a), nom: a.nom, id: a.id, couleur: couleurAnimal(a) })}<span class="ac-story__nom">${echapper(a.nom)}</span></a></li>`).join('')}
        </ul>
      </nav>` : '';

  const actions = [
    animaux.length && action({ id: 'soin', texte: 'Ajouter un soin', ic: 'stethoscope' }),
    animaux.length && action({ id: 'pesee', texte: 'Ajouter une pesée', ic: 'scale' }),
    action({ id: 'animal', texte: 'Ajouter un animal', ic: 'paw-print' }),
    action({ texte: 'Sauvegarde', ic: 'save', href: '#/donnees' }),
  ].filter(Boolean).join('');

  const blocRappels = rappels.length
    ? `<ul class="cp-liste">${rappels.slice(0, 3).map(ligneRappel).join('')}</ul>`
    : `<div class="cp-carte">${vide({ icone: 'circle-check', titre: 'Aucun rappel en attente', texte: 'Ajoutez une date de rappel quand vous notez un soin.' })}</div>`;

  zone.innerHTML = `
    <div class="cp pg pg--accueil">
      <header class="pg-entete pg-entete--accueil">
        <h1>Bonjour${prenom ? ` ${echapper(prenom)}` : ''}</h1>
        ${resume}
      </header>

      ${stories}

      <section class="pg-section" aria-labelledby="ac-actions">
        <h2 id="ac-actions" class="cp-sr">Actions rapides</h2>
        <div class="ac-actions">${actions}</div>
      </section>

      ${animaux.length ? `
      <section class="pg-section" aria-labelledby="ac-rappels">
        <div class="pg-section__tete">
          <h2 id="ac-rappels">Prochains rappels</h2>
          ${rappels.length ? `<a class="pg-lien" href="#/animaux/rappels">Tout voir ${icone('chevron-right', { taille: 16 })}</a>` : ''}
        </div>
        ${blocRappels}
      </section>

      <section class="pg-section" aria-labelledby="ac-conseil">
        <article class="cp-carte ac-conseil">
          <span class="ac-conseil__icone" aria-hidden="true">${icone(conseil.icone, { taille: 22 })}</span>
          <div class="ac-conseil__corps">
            <p class="ac-conseil__etiquette" id="ac-conseil">Conseil du moment</p>
            <h2 class="ac-conseil__titre">${echapper(conseil.titre)}</h2>
            <p class="ac-conseil__texte">${echapper(conseil.texte)}</p>
            <p class="ac-conseil__vet"><strong>${echapper(PHRASE_VETERINAIRE)}</strong></p>
            <p class="ac-conseil__source">Source : ${echapper(conseil.source)}</p>
          </div>
        </article>
      </section>

      <p class="ac-mois" data-ce-mois>Ce mois-ci : ${pluriel(nbSoins, 'soin fait', 'soins faits')}, ${pluriel(nbPesees, 'pesée', 'pesées')}</p>` : `<div class="cp-carte">${vide({ niveau: 2, icone: 'paw-print', titre: 'Aucun animal pour l\'instant', texte: 'Ajoutez votre premier compagnon pour suivre ses soins, ses pesées et ses rappels.' })}</div>`}
    </div>`;

  zone.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'soin') pourUnAnimal(animaux, (a) => formulaireSoin(a, null, rafraichir));
    else if (act === 'pesee') pourUnAnimal(animaux, (a) => formulairePesee(a, rafraichir));
    else if (act === 'animal') formulaireAnimal(null, rafraichir);
  });
}
