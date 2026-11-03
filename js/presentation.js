// Page de présentation d'une section pas encore développée (Carte Patte, Boutique, Communauté, Professionnels).
// Elle montre ce qui est prévu, clairement marqué « Bientôt disponible » : aucun faux lieu, produit, avis ni profil.

import { icone } from './icons.js';
import { echapper } from './utils.js';
import { badge, alerte, bouton } from './composants.js';

/**
 * config : { icone, titre, intro, fonctions: [{ icone, titre, texte }] }
 */
export function rendrePresentation(zone, config) {
  zone.classList.add('page-large');
  zone.innerHTML = `
    <div class="cp pg">
      <header class="pg-entete pg-entete--icone">
        <span class="cp-avatar cp-avatar--grand">${icone(config.icone, { taille: 40 })}</span>
        <div>
          <div class="pg-entete__badges">${badge({ texte: 'Bientôt disponible', variante: 'bientot' })}</div>
          <h1>${echapper(config.titre)}</h1>
          <p>${echapper(config.intro)}</p>
        </div>
      </header>

      ${alerte({ type: 'info', titre: 'Section en préparation', texte: 'Rien n\'est encore publié ici : aucune donnée, aucun contenu. Vos animaux et vos rappels continuent de fonctionner normalement.' })}

      <section class="pg-section" aria-labelledby="pg-prevu">
        <div class="pg-section__tete"><h2 id="pg-prevu">Ce qui est prévu</h2></div>
        <div class="pg-fonctions">
          ${config.fonctions.map((f) => `
            <div class="cp-carte pg-fonction">
              <span class="pg-tuile__icone">${icone(f.icone, { taille: 22 })}</span>
              <h3 class="cp-carte__titre" style="font-size:var(--cp-taille-m);margin:0">${echapper(f.titre)}</h3>
              <p>${echapper(f.texte)}</p>
            </div>`).join('')}
        </div>
      </section>

      <div>${bouton({ texte: 'Retour à l\'accueil', variante: 'secondaire', icone: 'arrow-left', href: '#/accueil' })}</div>
    </div>`;
}
