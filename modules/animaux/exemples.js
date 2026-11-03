// Deux animaux d'exemple pour voir l'appli remplie au premier lancement.
// Ils portent `exemple: true`, ce qui permet de les supprimer d'un clic depuis la liste.
// Les dates sont calculées par rapport à aujourd'hui pour que les rappels soient toujours parlants.

import * as storage from '../../js/storage.js';
import { aujourdhui, ajouterJours, ajouterMois } from '../../js/utils.js';

export function ajouterExemples() {
  const auj = aujourdhui();
  const jour = (n) => ajouterJours(auj, n);

  const moka = storage.ajouter('animaux', {
    nom: 'Moka', espece: 'chien', especeAutre: '', race: 'Labrador',
    naissance: ajouterMois(auj, -38), photo: '', exemple: true,
  });
  const mimi = storage.ajouter('animaux', {
    nom: 'Mimi', espece: 'chat', especeAutre: '', race: 'Européen',
    naissance: ajouterMois(auj, -26), photo: '', exemple: true,
  });

  const soin = (animal, type, titre, date, notes, rappel) =>
    storage.ajouter('soins', { animalId: animal.id, type, titre, date, notes, rappel: rappel ?? '', rappelFait: false });

  // Moka : un vermifuge en retard, un vaccin bientôt
  soin(moka, 'vaccin', 'CHPPiL + rage', jour(-335), 'Rappel annuel chez le Dr Martin.', jour(30));
  soin(moka, 'vermifuge', '', jour(-100), '', jour(-10));
  soin(moka, 'veto', 'Contrôle dents', jour(-200), 'Léger tartre, RAS pour le reste.');

  // Mimi : un antiparasitaire cette semaine, un vaccin plus tard
  soin(mimi, 'vaccin', 'Typhus + coryza', jour(-300), '', jour(65));
  soin(mimi, 'antiparasitaire', 'Pipette', jour(-23), '', jour(5));

  const pesee = (animal, decalage, poidsKg) =>
    storage.ajouter('pesees', { animalId: animal.id, date: jour(decalage), poidsKg });

  [[-330, 27.5], [-250, 28.1], [-170, 28.6], [-90, 29.0], [-14, 29.2]].forEach(([d, p]) => pesee(moka, d, p));
  [[-280, 3.9], [-180, 4.1], [-90, 4.2], [-20, 4.15]].forEach(([d, p]) => pesee(mimi, d, p));

  storage.marquerExemplesAjoutes();
}
