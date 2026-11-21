// Ajout rapide : le bouton rond « + » de la barre du bas (et le bouton « Ajouter » de la barre du haut sur tablette et ordinateur).
// Une petite fenêtre propose : Ajouter un soin, Ajouter une pesée, Ajouter un animal. Pour un soin ou une pesée, on choisit d'abord l'animal s'il y en a plusieurs.

import * as storage from './storage.js';
import { icone } from './icons.js';
import { echapper } from './utils.js';
import { avatar, couleurAnimal } from './composants.js';
import { modale } from './ui.js';
import { rafraichir } from './router.js';
import { formulaireAnimal } from '../modules/animaux/animaux.js';
import { formulaireSoin } from '../modules/animaux/soins.js';
import { formulairePesee } from '../modules/animaux/pesees.js';
import { infosEspece } from '../modules/animaux/commun.js';

const photoDe = (a) => (typeof a.photo === 'string' && a.photo.startsWith('data:image/') ? a.photo : '');

/** Plusieurs animaux : un petit choix « Pour quel animal ? » avant le formulaire. Un seul animal : on va directement au formulaire. */
export function pourUnAnimal(animaux, suite) {
  if (animaux.length === 1) { suite(animaux[0]); return; }
  const html = `
    <div class="ac-choix" role="group" aria-label="Animal concerné">
      ${animaux.map((a) => `<button type="button" class="cp-carte ac-choix__animal" data-animal="${echapper(a.id)}">${avatar({ icone: infosEspece(a).icone, photo: photoDe(a), nom: a.nom, id: a.id, couleur: couleurAnimal(a) })}<span class="ac-choix__nom">${echapper(a.nom)}</span></button>`).join('')}
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

const CHOIX = [
  { id: 'soin', titre: 'Ajouter un soin', texte: 'Vaccin, vermifuge, visite chez le véto…', icone: 'stethoscope', besoinAnimal: true },
  { id: 'pesee', titre: 'Ajouter une pesée', texte: 'Noter le poids de votre animal.', icone: 'scale', besoinAnimal: true },
  { id: 'animal', titre: 'Ajouter un animal', texte: 'Un nouveau compagnon dans le carnet.', icone: 'paw-print', besoinAnimal: false },
];

/** Ouvre la petite fenêtre d'ajout. Après un ajout, la page affichée est réaffichée. */
export function ouvrirAjoutRapide() {
  const animaux = storage.lister('animaux').sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const html = `
    <ul class="ar-liste">
      ${CHOIX.map((c) => {
        const bloque = c.besoinAnimal && !animaux.length;
        return `<li><button type="button" class="ar-choix" data-ajout="${c.id}"${bloque ? ' disabled' : ''}>
          <span class="ar-choix__icone" aria-hidden="true">${icone(c.icone, { taille: 22 })}</span>
          <span class="ar-choix__corps"><span class="ar-choix__titre">${c.titre}</span><span class="ar-choix__texte">${bloque ? "Ajoutez d'abord un animal." : c.texte}</span></span>
          <span class="ar-choix__fleche" aria-hidden="true">${icone('chevron-right', { taille: 18 })}</span>
        </button></li>`;
      }).join('')}
    </ul>`;
  modale('Ajouter', html, (dlg) => {
    dlg.querySelector('.cp-modale__corps').addEventListener('click', (e) => {
      const b = e.target.closest('[data-ajout]');
      if (!b || b.disabled) return;
      dlg.close();
      if (b.dataset.ajout === 'soin') pourUnAnimal(animaux, (a) => formulaireSoin(a, null, rafraichir));
      else if (b.dataset.ajout === 'pesee') pourUnAnimal(animaux, (a) => formulairePesee(a, rafraichir));
      else formulaireAnimal(null, rafraichir);
    });
  });
}
