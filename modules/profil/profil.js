// Profil : prénom (facultatif), accès aux données, à la sauvegarde et aux sections à venir.
// Il n'y a pas encore de compte : tout reste enregistré sur cet appareil.

import * as storage from '../../js/storage.js';
import { icone } from '../../js/icons.js';
import { badge, alerte, bouton, champ, avatar } from '../../js/composants.js';
import { toast } from '../../js/ui.js';
import { rafraichir } from '../../js/router.js';

const ligne = ({ icone: i, titre, texte, href, bientot }) => `
  <li><a class="cp-liste__ligne cp-liste__ligne--lien" href="${href}">
    <span class="cp-liste__icone">${icone(i, { taille: 18 })}</span>
    <div class="cp-liste__corps"><span class="cp-liste__titre">${titre}</span><span class="cp-liste__meta">${texte}</span></div>
    <div class="cp-liste__fin">${bientot ? badge({ texte: 'Bientôt', variante: 'bientot' }) : ''}${icone('chevron-right', { taille: 18 })}</div>
  </a></li>`;

export function rendre(zone) {
  zone.classList.add('page-large');
  const { prenom } = storage.lireProfil();
  zone.innerHTML = `
    <div class="cp pg">
      <header class="pg-entete pg-entete--icone">
        ${avatar({ nom: prenom, icone: 'user', grand: true, id: 'profil' })}
        <div><h1>Profil</h1><p>Vos données et vos accès rapides.</p></div>
      </header>

      <section class="pg-section" aria-labelledby="pf-prenom">
        <div class="pg-section__tete"><h2 id="pf-prenom">Votre prénom</h2></div>
        <form class="cp-carte cp-formulaire pf-form" novalidate>
          ${champ({ id: 'profil-prenom', label: 'Prénom (facultatif)', valeur: prenom, placeholder: 'Ex. : Léa',
            aide: "Il sert seulement à vous dire bonjour sur l'Accueil. Il reste sur cet appareil.",
            attrs: { name: 'prenom', maxlength: 40, autocomplete: 'given-name' } })}
          <div class="pf-form__actions">${bouton({ texte: 'Enregistrer', type: 'submit', icone: 'check' })}</div>
        </form>
      </section>

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

  zone.querySelector('.pf-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const saisi = new FormData(e.currentTarget).get('prenom');
    const { prenom: enregistre } = storage.modifierProfil({ prenom: saisi });
    toast(enregistre ? `Bonjour ${enregistre} !` : 'Prénom effacé');
    rafraichir();
    document.getElementById('profil-prenom')?.focus();
  });
}
