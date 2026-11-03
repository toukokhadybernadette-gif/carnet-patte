// Fiche d'un animal : en-tête, soins et pesées.

import * as storage from '../../js/storage.js';
import { echapper, age, formatDate } from '../../js/utils.js';
import { confirmer, toast } from '../../js/ui.js';
import { rafraichir } from '../../js/router.js';
import { icone } from '../../js/icons.js';
import { avatarHtml, nomEspece } from './commun.js';
import { formulaireAnimal } from './animaux.js';
import * as soins from './soins.js';
import * as pesees from './pesees.js';

export function rendre(zone, id) {
  const animal = storage.trouver('animaux', id);
  if (!animal) {
    zone.innerHTML = `
      <div class="carte vide"><span class="grand-icone">${icone('circle-help', { taille: 44 })}</span>
        Cet animal n'existe pas (ou plus).<br><br>
        <a class="bouton" href="#/animaux">Retour à mes animaux</a>
      </div>`;
    return;
  }

  const details = [nomEspece(animal), animal.race].filter(Boolean).map(echapper).join(' · ');
  const naissance = animal.naissance
    ? `Né(e) le ${formatDate(animal.naissance)} · ${age(animal.naissance)}`
    : 'Date de naissance inconnue';

  zone.innerHTML = `
    <p><a class="avec-icone" href="#/animaux">${icone('arrow-left', { taille: 18 })} Mes animaux</a></p>
    <section class="carte fiche-entete">
      ${avatarHtml(animal, 'grand')}
      <div class="fiche-infos">
        <h1>${echapper(animal.nom)}</h1>
        <p>${details}</p>
        <p class="discret">${naissance}</p>
        <div class="actions" style="justify-content:flex-start">
          <button class="bouton secondaire petit" data-act="modifier">${icone('pencil', { taille: 16 })} Modifier</button>
          <button class="bouton secondaire petit" data-act="supprimer">${icone('trash-2', { taille: 16 })} Supprimer</button>
        </div>
      </div>
    </section>
    <div id="zone-soins"></div>
    <div id="zone-pesees"></div>`;

  soins.rendre(zone.querySelector('#zone-soins'), animal);
  pesees.rendre(zone.querySelector('#zone-pesees'), animal);

  zone.querySelector('.fiche-entete').addEventListener('click', async (e) => {
    const bouton = e.target.closest('[data-act]');
    if (!bouton) return;
    if (bouton.dataset.act === 'modifier') {
      formulaireAnimal(animal, rafraichir);
    } else if (bouton.dataset.act === 'supprimer') {
      const message = `Supprimer ${animal.nom} ? Ses soins et ses pesées seront aussi supprimés. Cette action est définitive.`;
      if (await confirmer(message)) {
        storage.supprimer('animaux', animal.id);
        toast(`${animal.nom} a été supprimé`);
        location.hash = '#/animaux';
      }
    }
  });
}
