// Page « Bientôt » : présente les modules pas encore réalisés.
// Quand un module sera prêt, on le déplace de MODULES_A_VENIR vers le menu (js/app.js).

import { echapper } from './utils.js';

export const MODULES_A_VENIR = [
  { id: 'toxique', icone: '☠️', titre: 'Toxique ?', texte: 'Vérifier si un aliment ou une plante est dangereux selon l\'espèce.' },
  { id: 'ferme', icone: '🐔', titre: 'Basse-cour / ferme', texte: 'Suivi de la ponte, de l\'alimentation et des soins du troupeau.' },
  { id: 'perdus-trouves', icone: '🔎', titre: 'Perdus / trouvés', texte: 'Signaler un animal perdu ou trouvé. Nécessitera un compte et une base en ligne.' },
  { id: 'refuges', icone: '🏠', titre: 'Aide aux refuges', texte: 'Soutenir les refuges près de chez vous. Nécessitera un compte et une base en ligne.' },
];

export function rendre(zone, segments) {
  const cible = segments[0];
  zone.innerHTML = `
    <div class="page-titre"><h1>Bientôt</h1></div>
    <p class="discret">Ces modules arrivent dans une prochaine étape.</p>
    <div class="liste-modules">
      ${MODULES_A_VENIR.map((m) => `
        <section class="carte" ${m.id === cible ? 'style="border-color:var(--vert);"' : ''}>
          <span class="grand-emoji">${m.icone}</span>
          <h2>${echapper(m.titre)}</h2>
          <p class="discret">${echapper(m.texte)}</p>
          <span class="pastille semaine">Bientôt</span>
        </section>`).join('')}
    </div>`;
}
