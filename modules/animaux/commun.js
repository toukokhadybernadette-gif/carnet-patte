// Éléments partagés par les fichiers du module « animaux ».

import * as storage from '../../js/storage.js';
import { echapper, aujourdhui, joursEntre, ajouterMois, formatDate } from '../../js/utils.js';
import { modale, toast } from '../../js/ui.js';
import { icone } from '../../js/icons.js';

// ----- Espèces proposées dans le formulaire -----
export const ESPECES = [
  { id: 'chien', nom: 'Chien', icone: 'dog' },
  { id: 'chat', nom: 'Chat', icone: 'cat' },
  { id: 'lapin', nom: 'Lapin', icone: 'rabbit' },
  { id: 'cochon-inde', nom: "Cochon d'Inde", icone: 'rat' },
  { id: 'hamster', nom: 'Hamster', icone: 'rat' },
  { id: 'furet', nom: 'Furet', icone: 'paw-print' },
  { id: 'oiseau', nom: 'Oiseau', icone: 'bird' },
  { id: 'poule', nom: 'Poule', icone: 'bird' },
  { id: 'canard', nom: 'Canard', icone: 'bird' },
  { id: 'chevre', nom: 'Chèvre', icone: 'paw-print' },
  { id: 'mouton', nom: 'Mouton', icone: 'paw-print' },
  { id: 'cheval', nom: 'Cheval', icone: 'paw-print' },
  { id: 'ane', nom: 'Âne', icone: 'paw-print' },
  { id: 'vache', nom: 'Vache', icone: 'paw-print' },
  { id: 'cochon', nom: 'Cochon', icone: 'paw-print' },
  { id: 'tortue', nom: 'Tortue', icone: 'turtle' },
  { id: 'poisson', nom: 'Poisson', icone: 'fish' },
  { id: 'autre', nom: 'Autre', icone: 'paw-print' },
];

export function infosEspece(animal) {
  return ESPECES.find((e) => e.id === animal.espece) ?? ESPECES[ESPECES.length - 1];
}

/** Nom de l'espèce à afficher ("Autre" → ce que l'utilisateur a tapé). */
export function nomEspece(animal) {
  if (animal.espece === 'autre') return animal.especeAutre?.trim() || 'Autre';
  return infosEspece(animal).nom;
}

/** Photo de l'animal, ou à défaut l'icône de son espèce. */
export function avatarHtml(animal, classe = '') {
  const photo = animal.photo;
  if (typeof photo === 'string' && photo.startsWith('data:image/')) {
    return `<img class="avatar ${classe}" src="${echapper(photo)}" alt="">`;
  }
  return `<div class="avatar ${classe}" aria-hidden="true">${icone(infosEspece(animal).icone, { taille: classe.includes('grand') ? 44 : 30 })}</div>`;
}

// ----- Types de soins -----
export const TYPES_SOIN = [
  { id: 'vaccin', nom: 'Vaccin', icone: 'syringe' },
  { id: 'vermifuge', nom: 'Vermifuge', icone: 'pill' },
  { id: 'antiparasitaire', nom: 'Antiparasitaire', icone: 'bug' },
  { id: 'veto', nom: 'Visite véto', icone: 'stethoscope' },
  { id: 'autre', nom: 'Autre soin', icone: 'bandage' },
];

export function infosType(id) {
  return TYPES_SOIN.find((t) => t.id === id) ?? TYPES_SOIN[TYPES_SOIN.length - 1];
}

// ----- Rappels -----

/**
 * État du rappel d'un soin. Retourne null s'il n'y a pas de rappel à venir (ou s'il est déjà traité).
 * classe : 'retard' (date passée), 'semaine' (dans 7 jours ou moins), 'plus-tard'.
 */
export function statutRappel(soin) {
  if (!soin.rappel || soin.rappelFait) return null;
  const jours = joursEntre(aujourdhui(), soin.rappel);
  let texte;
  if (jours < 0) texte = `En retard de ${-jours} j`;
  else if (jours === 0) texte = "Aujourd'hui";
  else if (jours === 1) texte = 'Demain';
  else texte = `Dans ${jours} j`;
  const classe = jours < 0 ? 'retard' : jours <= 7 ? 'semaine' : 'plus-tard';
  return { jours, classe, texte };
}

/**
 * Fenêtre « Marquer le rappel comme fait ».
 * Propose de programmer directement le prochain rappel (le soin est alors noté à la date du jour).
 */
export function ouvrirRappelFait(soin, apres) {
  const type = infosType(soin.type);
  const titre = [type.nom, soin.titre].filter(Boolean).join(' — ');
  const html = `
    <form class="formulaire">
      <p><strong>${echapper(titre)}</strong><br>
         <span class="discret">Rappel prévu le ${formatDate(soin.rappel)}</span></p>
      <label>Programmer le prochain rappel ?
        <select name="delai">
          <option value="0">Non, pas de prochain rappel</option>
          <option value="1">Dans 1 mois</option>
          <option value="3">Dans 3 mois</option>
          <option value="6">Dans 6 mois</option>
          <option value="12">Dans 1 an</option>
        </select>
      </label>
      <p class="discret">Le soin sera noté comme effectué aujourd'hui.</p>
      <div class="actions">
        <button type="button" class="bouton secondaire" data-annuler>Annuler</button>
        <button type="submit" class="bouton">${icone('check', { taille: 18 })} C'est fait</button>
      </div>
    </form>`;
  modale('Rappel effectué', html, (dlg) => {
    dlg.querySelector('[data-annuler]').addEventListener('click', () => dlg.close());
    dlg.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const delai = Number(new FormData(e.target).get('delai'));
      storage.modifier('soins', soin.id, { rappelFait: true });
      if (delai > 0) {
        storage.ajouter('soins', {
          animalId: soin.animalId,
          type: soin.type,
          titre: soin.titre,
          date: aujourdhui(),
          notes: '',
          rappel: ajouterMois(aujourdhui(), delai),
          rappelFait: false,
        });
      }
      dlg.close();
      toast('Rappel marqué comme fait');
      apres();
    });
  });
}
