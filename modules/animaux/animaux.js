// Module 1 : point d'entrée. Liste des animaux + formulaire d'ajout / modification.
// Adresses gérées :
//   #/animaux            → liste
//   #/animaux/rappels    → rappels
//   #/animaux/<id>       → fiche d'un animal

import * as storage from '../../js/storage.js';
import { echapper, aujourdhui, age, redimensionnerPhoto } from '../../js/utils.js';
import { modale, confirmer, toast } from '../../js/ui.js';
import { icone } from '../../js/icons.js';
import { rafraichir } from '../../js/router.js';
import { ESPECES, avatarHtml, nomEspece } from './commun.js';
import { calculerRappels, resumeRappelsHtml, rendre as rendreRappels } from './rappels.js';
import { rendre as rendreFiche } from './fiche.js';
import { ajouterExemples } from './exemples.js';

export function rendre(zone, segments) {
  if (segments[0] === 'rappels') return rendreRappels(zone);
  if (segments[0]) return rendreFiche(zone, segments[0]);
  rendreListe(zone);
}

// ----- Formulaire (ajout et modification) -----

export function formulaireAnimal(animal, apres) {
  const a = animal ?? { nom: '', espece: 'chien', especeAutre: '', race: '', naissance: '', photo: '' };
  let photo = a.photo || '';

  const options = ESPECES.map((e) =>
    `<option value="${e.id}" ${e.id === a.espece ? 'selected' : ''}>${e.nom}</option>`).join('');

  const html = `
    <form class="formulaire">
      <div class="photo-champ">
        <div data-apercu></div>
        <div class="photo-boutons">
          <label class="bouton secondaire petit">${icone('camera', { taille: 18 })} Choisir une photo
            <input type="file" accept="image/*" hidden data-fichier>
          </label>
          <button type="button" class="bouton lien" data-retirer>Retirer la photo</button>
        </div>
      </div>
      <label>Nom <input name="nom" required maxlength="40" value="${echapper(a.nom)}"></label>
      <label>Espèce <select name="espece">${options}</select></label>
      <label data-champ-autre>Précisez l'espèce
        <input name="especeAutre" maxlength="40" value="${echapper(a.especeAutre)}" placeholder="Ex. : Perroquet, Lama...">
      </label>
      <label>Race (facultatif) <input name="race" maxlength="60" value="${echapper(a.race)}"></label>
      <label>Date de naissance (facultatif)
        <input type="date" name="naissance" max="${aujourdhui()}" value="${a.naissance ?? ''}">
      </label>
      <div class="actions">
        <button type="button" class="bouton secondaire" data-annuler>Annuler</button>
        <button type="submit" class="bouton">Enregistrer</button>
      </div>
    </form>`;

  modale(animal ? `Modifier ${animal.nom}` : 'Nouvel animal', html, (dlg) => {
    const form = dlg.querySelector('form');
    const apercu = dlg.querySelector('[data-apercu]');
    const champAutre = dlg.querySelector('[data-champ-autre]');

    const majApercu = () => {
      apercu.innerHTML = avatarHtml({ espece: form.espece.value, photo }, 'grand');
    };
    const majAutre = () => { champAutre.hidden = form.espece.value !== 'autre'; };
    majApercu(); majAutre();

    form.espece.addEventListener('change', () => { majApercu(); majAutre(); });

    dlg.querySelector('[data-fichier]').addEventListener('change', async (e) => {
      const fichier = e.target.files[0];
      if (!fichier) return;
      try {
        photo = await redimensionnerPhoto(fichier);
        majApercu();
      } catch (err) {
        toast(err.message);
      }
    });
    dlg.querySelector('[data-retirer]').addEventListener('click', () => { photo = ''; majApercu(); });
    dlg.querySelector('[data-annuler]').addEventListener('click', () => dlg.close());

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const champs = {
        nom: f.get('nom').trim(),
        espece: f.get('espece'),
        especeAutre: f.get('espece') === 'autre' ? f.get('especeAutre').trim() : '',
        race: f.get('race').trim(),
        naissance: f.get('naissance') || '',
        photo,
      };
      if (!champs.nom) return;
      if (animal) {
        storage.modifier('animaux', animal.id, champs);
      } else {
        storage.ajouter('animaux', champs);
      }
      dlg.close();
      toast(animal ? 'Animal modifié' : 'Animal ajouté');
      apres();
    });
  });
}

// ----- Liste -----

function carteHtml(animal, rappelsEnRetard) {
  const retard = rappelsEnRetard.get(animal.id) ?? 0;
  const detail = [nomEspece(animal), animal.race].filter(Boolean).map(echapper).join(' · ');
  return `
    <a class="carte carte-animal" href="#/animaux/${encodeURIComponent(animal.id)}">
      ${avatarHtml(animal)}
      <div class="carte-animal-texte">
        <strong>${echapper(animal.nom)}</strong>
        <span class="discret">${detail}</span>
        <span class="discret">${animal.naissance ? age(animal.naissance) : 'Âge inconnu'}</span>
        ${retard ? `<span><span class="pastille retard">${icone('bell-ring', { taille: 14 })} ${retard} rappel${retard > 1 ? 's' : ''} en retard</span></span>` : ''}
      </div>
    </a>`;
}

function rendreListe(zone) {
  const animaux = storage.lister('animaux').sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));

  const enRetard = new Map();
  for (const r of calculerRappels()) {
    if (r.statut.classe === 'retard') enRetard.set(r.animal.id, (enRetard.get(r.animal.id) ?? 0) + 1);
  }

  const aDesExemples = animaux.some((a) => a.exemple);

  zone.innerHTML = `
    <div class="page-titre">
      <h1>Mes animaux</h1>
      <button class="bouton" data-act="ajouter">${icone('plus', { taille: 18 })} Ajouter un animal</button>
    </div>
    ${resumeRappelsHtml()}
    ${aDesExemples ? `
      <div class="bandeau-exemples">
        <span class="avec-icone">${icone('info', { taille: 18 })} Les animaux marqués « exemple » servent à découvrir l'appli.</span>
        <button class="bouton secondaire petit" data-act="effacer-exemples">Supprimer les exemples</button>
      </div>` : ''}
    ${animaux.length
      ? `<div class="grille-animaux">${animaux.map((a) => carteHtml(a, enRetard)).join('')}</div>`
      : `<div class="carte vide"><span class="grand-icone">${icone('paw-print', { taille: 44 })}</span>
           Aucun animal pour l'instant.<br><br>
           <button class="bouton" data-act="ajouter">${icone('plus', { taille: 18 })} Ajouter mon premier animal</button><br><br>
           <button class="bouton lien" data-act="remettre-exemples">Remettre les animaux d'exemple</button>
         </div>`}`;

  zone.addEventListener('click', async (e) => {
    const bouton = e.target.closest('[data-act]');
    if (!bouton) return;
    switch (bouton.dataset.act) {
      case 'ajouter':
        formulaireAnimal(null, rafraichir);
        break;
      case 'remettre-exemples':
        ajouterExemples();
        rafraichir();
        break;
      case 'effacer-exemples':
        if (await confirmer('Supprimer les animaux d\'exemple, avec leurs soins et pesées ?')) {
          animaux.filter((a) => a.exemple).forEach((a) => storage.supprimer('animaux', a.id));
          toast('Exemples supprimés');
          rafraichir();
        }
        break;
    }
  });
}
