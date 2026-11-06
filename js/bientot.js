// Page « Bientôt » : présente les modules pas encore réalisés.
// Quand un module sera prêt, on le déplace de MODULES_A_VENIR vers le menu (js/app.js).

import { echapper } from './utils.js';
import { icone } from './icons.js';
import { badge } from './composants.js';

export const MODULES_A_VENIR = [
  { id: 'toxique', icone: 'shield-alert', titre: 'Toxique ?', texte: 'Vérifier si un aliment ou une plante est dangereux selon l\'espèce.' },
  { id: 'ferme', icone: 'wheat', titre: 'Basse-cour / ferme', texte: 'Suivi de la ponte, de l\'alimentation et des soins du troupeau.' },
  { id: 'perdus-trouves', icone: 'search', titre: 'Perdus / trouvés', texte: 'Signaler un animal perdu ou trouvé. Nécessitera un compte et une base en ligne.' },
  { id: 'refuges', icone: 'house-heart', titre: 'Aide aux refuges', texte: 'Soutenir les refuges près de chez vous. Nécessitera un compte et une base en ligne.' },
];

export function rendre(zone, segments) {
  const cible = segments[0];
  zone.classList.add('page-large');
  zone.innerHTML = `
    <div class="cp pg">
      <header class="pg-entete">
        <h1 tabindex="-1">Bientôt</h1>
        <p>Ces modules arrivent dans une prochaine étape.</p>
      </header>
      <ul class="bt-liste">
        ${MODULES_A_VENIR.map((m) => `
          <li class="cp-carte bt-carte${m.id === cible ? ' bt-carte--cible' : ''}" aria-disabled="true">
            <span class="bt-carte__icone" aria-hidden="true">${icone(m.icone, { taille: 26 })}</span>
            <h2 class="bt-carte__titre">${echapper(m.titre)}</h2>
            <p>${echapper(m.texte)}</p>
            ${badge({ texte: 'Bientôt', variante: 'bientot' })}
          </li>`).join('')}
      </ul>
    </div>`;
}
