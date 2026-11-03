// Profil : accès aux données, à la sauvegarde et aux sections à venir.
// Il n'y a pas encore de compte : tout reste enregistré sur cet appareil.

import { icone } from '../../js/icons.js';
import { badge, alerte } from '../../js/composants.js';

const ligne = ({ icone: i, titre, texte, href, bientot }) => `
  <li><a class="cp-liste__ligne cp-liste__ligne--lien" href="${href}">
    <span class="cp-liste__icone">${icone(i, { taille: 20 })}</span>
    <div class="cp-liste__corps"><span class="cp-liste__titre">${titre}</span><span class="cp-liste__meta">${texte}</span></div>
    <div class="cp-liste__fin">${bientot ? badge({ texte: 'Bientôt', variante: 'bientot' }) : ''}${icone('chevron-right', { taille: 20 })}</div>
  </a></li>`;

export function rendre(zone) {
  zone.classList.add('page-large');
  zone.innerHTML = `
    <div class="cp pg">
      <header class="pg-entete pg-entete--icone">
        <span class="cp-avatar cp-avatar--grand">${icone('user', { taille: 40 })}</span>
        <div><h1>Profil</h1><p>Vos données et vos accès rapides.</p></div>
      </header>

      ${alerte({ type: 'info', titre: 'Pas encore de compte', texte: 'Les comptes arriveront plus tard. Pour l\'instant, vos animaux, soins et pesées sont enregistrés sur cet appareil : pensez à faire une sauvegarde de temps en temps.' })}

      <section class="pg-section" aria-labelledby="pf-donnees">
        <div class="pg-section__tete"><h2 id="pf-donnees">Mes données</h2></div>
        <ul class="cp-liste">${ligne({ icone: 'save', titre: 'Sauvegarde', texte: 'Exporter, importer ou effacer vos données.', href: '#/donnees' })}</ul>
      </section>

      <section class="pg-section" aria-labelledby="pf-acces">
        <div class="pg-section__tete"><h2 id="pf-acces">Accès rapides</h2></div>
        <ul class="cp-liste">
          ${ligne({ icone: 'users', titre: 'Communauté', texte: 'Échanger avec d\'autres passionnés.', href: '#/communaute', bientot: true })}
          ${ligne({ icone: 'briefcase-business', titre: 'Professionnels', texte: 'Outils pour éleveurs et professionnels.', href: '#/pro', bientot: true })}
          ${ligne({ icone: 'compass', titre: 'Autres modules à venir', texte: 'Toxique ?, basse-cour, perdus / trouvés, refuges.', href: '#/bientot' })}
        </ul>
      </section>
    </div>`;
}
