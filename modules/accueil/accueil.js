// Accueil, version allégée : « Bonjour [prénom] », une ligne de résumé, les 3 prochains rappels en version compacte
// et un petit bouton d'ajout. Cette page LIT les données mais ne les modifie jamais (l'ajout passe par les formulaires existants).

import * as storage from '../../js/storage.js';
import { icone } from '../../js/icons.js';
import { echapper, formatDate } from '../../js/utils.js';
import { vide, bouton, avatar, couleurAnimal } from '../../js/composants.js';
import { modale } from '../../js/ui.js';
import { rafraichir } from '../../js/router.js';
import { calculerRappels } from '../animaux/rappels.js';
import { formulaireAnimal } from '../animaux/animaux.js';
import { formulaireSoin } from '../animaux/soins.js';
import { infosEspece, infosType, classeType, badgeEcheance, nomCourtSoin } from '../animaux/commun.js';

const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;

/** Une ligne de rappel compacte : le soin en haut, l'animal et la date dessous, le badge à droite. */
function ligneRappel(r) {
  return `
    <li><a class="cp-liste__ligne cp-liste__ligne--lien" href="#/animaux/rappels">
      <span class="cp-liste__icone ${classeType(r.soin.type)}">${icone(infosType(r.soin.type).icone, { taille: 18 })}</span>
      <div class="cp-liste__corps"><span class="cp-liste__titre">${echapper(nomCourtSoin(r.soin))}</span><span class="cp-liste__meta">${echapper(r.animal.nom)} · ${formatDate(r.soin.rappel)}</span></div>
      <div class="cp-liste__fin">${badgeEcheance(r.statut)}</div>
    </a></li>`;
}

/** Plusieurs animaux : un petit choix « pour quel animal ? » avant le formulaire du soin. Un seul animal : on va directement au formulaire. */
function ajouterUnSoin(animaux) {
  if (animaux.length === 1) { formulaireSoin(animaux[0], null, rafraichir); return; }
  const html = `
    <div class="ac-choix" role="group" aria-label="Animal concerné">
      ${animaux.map((a) => `<button type="button" class="cp-carte ac-choix__animal" data-animal="${echapper(a.id)}">${avatar({ icone: infosEspece(a).icone, photo: a.photo?.startsWith('data:image/') ? a.photo : '', nom: a.nom, id: a.id, couleur: couleurAnimal(a) })}<span>${echapper(a.nom)}</span></button>`).join('')}
    </div>`;
  modale('Pour quel animal ?', html, (dlg) => {
    dlg.addEventListener('click', (e) => {
      const b = e.target.closest('[data-animal]');
      const animal = b && storage.trouver('animaux', b.dataset.animal);
      if (!animal) return;
      dlg.close();
      formulaireSoin(animal, null, rafraichir);
    });
  });
}

export function rendre(zone) {
  zone.classList.add('page-large');
  const { prenom } = storage.lireProfil(); // facultatif : sans prénom, « Bonjour » tout court

  const animaux = storage.lister('animaux').sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const rappels = calculerRappels(); // du plus en retard au plus lointain
  const enRetard = rappels.filter((r) => r.statut.classe === 'retard').length;

  const resume = animaux.length
    ? `<a class="ac-resume" href="#/animaux/rappels">${pluriel(animaux.length, 'animal', 'animaux')} · ${enRetard ? `<span class="ac-resume__retard">${pluriel(enRetard, 'rappel en retard', 'rappels en retard')}</span>` : 'aucun rappel en retard'}${icone('chevron-right', { taille: 14 })}</a>`
    : '<p class="ac-resume ac-resume--vide">Votre carnet est vide pour l\'instant.</p>';

  const blocRappels = rappels.length
    ? `<ul class="cp-liste">${rappels.slice(0, 3).map(ligneRappel).join('')}</ul>`
    : animaux.length ? `<div class="cp-carte">${vide({ icone: 'circle-check', titre: 'Aucun rappel en attente', texte: 'Ajoutez une date de rappel quand vous notez un soin.' })}</div>` : '';

  zone.innerHTML = `
    <div class="cp pg pg--accueil">
      <header class="pg-entete pg-entete--accueil">
        <div>
          <h1>Bonjour${prenom ? ` ${echapper(prenom)}` : ''}</h1>
          ${resume}
        </div>
        ${bouton({ texte: animaux.length ? 'Ajouter un soin' : 'Ajouter un animal', icone: 'plus', taille: 's', attrs: { 'data-act': animaux.length ? 'soin' : 'animal' } })}
      </header>

      ${animaux.length ? `
      <section class="pg-section" aria-labelledby="ac-rappels">
        <div class="pg-section__tete">
          <h2 id="ac-rappels">Prochains rappels</h2>
          ${rappels.length ? `<a class="pg-lien" href="#/animaux/rappels">Tout voir ${icone('chevron-right', { taille: 16 })}</a>` : ''}
        </div>
        ${blocRappels}
      </section>` : `<div class="cp-carte">${vide({ niveau: 2, icone: 'paw-print', titre: 'Aucun animal pour l\'instant', texte: 'Ajoutez votre premier compagnon pour suivre ses soins, ses pesées et ses rappels.' })}</div>`}
    </div>`;

  zone.querySelector('[data-act]').addEventListener('click', (e) => {
    if (e.currentTarget.dataset.act === 'soin') ajouterUnSoin(animaux); else formulaireAnimal(null, rafraichir);
  });
}
