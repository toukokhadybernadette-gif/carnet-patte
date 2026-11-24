// Profil : prénom (facultatif), accès aux données, à la sauvegarde et aux sections à venir.
// Il n'y a pas encore de compte : tout reste enregistré sur cet appareil.

import * as storage from '../../js/storage.js';
import { icone } from '../../js/icons.js';
import { badge, alerte, bouton, champ, avatar, choix } from '../../js/composants.js';
import { toast } from '../../js/ui.js';
import { rafraichir } from '../../js/router.js';
import { NAV } from '../../js/navigation.js';
import { echapper } from '../../js/utils.js';
import { THEMES, PERSO, themeActuel, appliquerTheme, appliquerPerso, couleurPerso, MODES, modeMemorise, appliquerMode, sombreActif } from '../../js/theme.js';
import { themeDepuisCouleur, variablesTheme } from '../../js/couleurs-theme.js';
import { variablesThemeSombre } from '../../js/couleurs-sombre.js';
import { estInstallee } from '../../js/pwa.js';
import { estConfigure as comptesActifs } from '../../js/compte.js';

const ligne = ({ icone: i, titre, texte, href, bientot }) => `
  <li><a class="cp-liste__ligne cp-liste__ligne--lien" href="${href}">
    <span class="cp-liste__icone">${icone(i, { taille: 18 })}</span>
    <div class="cp-liste__corps"><span class="cp-liste__titre">${titre}</span><span class="cp-liste__meta">${texte}</span></div>
    <div class="cp-liste__fin">${bientot ? badge({ texte: 'Bientôt', variante: 'bientot' }) : ''}${icone('chevron-right', { taille: 18 })}</div>
  </a></li>`;

/** Les modules à venir : une seule ligne discrète (les pages restent accessibles depuis le menu). */
function ligneBientot() {
  const modules = NAV.filter((n) => n.bientot);
  return `
    <section class="pg-bientot" aria-labelledby="pf-bientot">
      <h2 id="pf-bientot">Bientôt sur Carnet Patte</h2>
      <ul class="pg-bientot__liste">
        ${modules.map((m) => `<li><a class="pg-bientot__lien" href="${m.href}">${echapper(m.titre)}</a></li>`).join('')}
        <li><a class="pg-bientot__lien" href="#/bientot">Et d'autres modules</a></li>
      </ul>
    </section>`;
}

/** Variables de la pastille d'un thème dans Profil (carte « Couleur personnalisée »). */
const styleApercu = (couleur) => { const { theme } = themeDepuisCouleur(couleur); const a = (sombreActif() ? variablesThemeSombre(theme) : variablesTheme(theme)).apercu; return `--pastille: ${a.pastille}; --pf-degrade: ${a.degrade}; --pf-fond: ${a.fond};`; };

/** Aide « Installer sur votre iPhone » : seulement si l'appli n'est pas déjà ouverte depuis l'écran d'accueil. */
const aideInstallation = () => estInstallee() ? '' : `
      <section class="pg-section" aria-labelledby="pf-installer" data-installer>
        <div class="pg-section__tete"><h2 id="pf-installer">Installer Carnet Patte sur votre iPhone</h2></div>
        <div class="cp-carte pwa-aide">
          <svg class="pwa-aide__illu" viewBox="0 0 320 108" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="6" y="6" width="140" height="96" rx="16" fill="var(--cp-surface-2, #f3f3ee)" stroke="none"/>
        <path d="M76 66V24M63 36l13-13 13 13"/><path d="M60 46H54a6 6 0 0 0-6 6v30a6 6 0 0 0 6 6h44a6 6 0 0 0 6-6V52a6 6 0 0 0-6-6h-6"/>
        <path d="M156 54h8M160 50l4 4-4 4"/>
        <rect x="174" y="6" width="140" height="96" rx="16" fill="var(--cp-surface-2, #f3f3ee)" stroke="none"/>
        <rect x="212" y="30" width="64" height="64" rx="14"/><path d="M244 48v28M230 62h28"/>
      </svg>
          <ol class="pwa-aide__etapes">
            <li>Ouvrez Carnet Patte dans <strong>Safari</strong>.</li>
            <li>Touchez <strong>Partager</strong> (le carré avec une flèche vers le haut, en bas de l'écran).</li>
            <li>Faites défiler, puis touchez <strong>Sur l'écran d'accueil</strong>.</li>
            <li>Touchez <strong>Ajouter</strong> : l'appli apparaît sur votre écran d'accueil.</li>
          </ol>
          <p class="cp-doux">Une fois installée, elle s'ouvre en plein écran et reste utilisable sans connexion. Vos animaux restent enregistrés sur cet appareil.</p>
        </div>
      </section>`;

export function rendre(zone) {
  zone.classList.add('page-large');
  const perso = couleurPerso();
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

      <section class="pg-section" aria-labelledby="pf-mode">
        <div class="pg-section__tete"><h2 id="pf-mode">Apparence</h2></div>
        <div class="cp-carte pf-mode">
          ${choix({ nom: 'mode', legende: 'Clair, sombre ou automatique', valeur: modeMemorise(), classe: 'pf-mode__choix',
            options: MODES.map((m) => ({ valeur: m.id, texte: m.nom, icone: { clair: 'sun', sombre: 'moon', auto: 'smartphone' }[m.id] })) })}
          <p class="cp-doux" data-mode-info>Automatique suit le réglage de votre iPhone (clair le jour, sombre le soir). Fonctionne avec toutes les couleurs ci-dessous.</p>
        </div>
      </section>

      <section class="pg-section" aria-labelledby="pf-theme">
        <div class="pg-section__tete"><h2 id="pf-theme">Couleur de l'appli</h2></div>
        <div class="cp-carte pf-themes">
          <fieldset class="pf-themes__liste" data-themes>
            <legend class="cp-sr">Couleur de l'appli</legend>
            ${THEMES.map((t) => `
              <label class="pf-theme pf-theme--${t.id}"><input type="radio" name="theme" value="${t.id}"${t.id === themeActuel() ? ' checked' : ''}>
                <span class="pf-theme__carte"><span class="pf-theme__pastille">${icone('check', { taille: 18 })}</span><span class="pf-theme__nom">${echapper(t.nom)}</span></span></label>`).join('')}
            <label class="pf-theme pf-theme--perso" data-perso-carte style="${styleApercu(perso)}"><input type="radio" name="theme" value="${PERSO}"${themeActuel() === PERSO ? ' checked' : ''}>
              <span class="pf-theme__carte"><span class="pf-theme__pastille">${icone('check', { taille: 18 })}</span><span class="pf-theme__nom">Couleur personnalisée</span></span></label>
          </fieldset>
          <div class="pf-perso">
            <label class="pf-perso__etiquette" for="pf-couleur">Nuancier : choisissez n'importe quelle couleur</label>
            <input type="color" class="pf-perso__nuancier" id="pf-couleur" value="${perso.toLowerCase()}" aria-describedby="pf-perso-info">
            <p class="cp-doux pf-perso__info" id="pf-perso-info" role="status" data-perso-info>La couleur est ajustée automatiquement si besoin, pour que le texte reste lisible (contraste d'au moins 4,5:1).</p>
          </div>
          <p class="cp-doux">Le changement est immédiat. Votre choix est gardé sur cet appareil.</p>
        </div>
      </section>

      ${alerte({ type: 'info', titre: 'Un compte est facultatif', texte: 'Avec ou sans compte, vos animaux, soins et pesées sont enregistrés sur cet appareil. La sauvegarde et la synchronisation en ligne sont réservées à la formule Premium (pas encore ouverte au public) : en attendant, pensez à faire une sauvegarde de temps en temps.' })}

      <section class="pg-section" aria-labelledby="pf-donnees">
        <div class="pg-section__tete"><h2 id="pf-donnees">Mes données</h2></div>
        <ul class="cp-liste">${ligne({ icone: 'save', titre: 'Sauvegarde', texte: 'Exporter, importer ou effacer vos données.', href: '#/donnees' })}</ul>
      </section>

      ${aideInstallation()}

      <section class="pg-section" aria-labelledby="pf-acces">
        <div class="pg-section__tete"><h2 id="pf-acces">Accès rapides</h2></div>
        <ul class="cp-liste">
          ${ligne({ icone: 'users', titre: 'Communauté', texte: 'Échanger avec d\'autres passionnés.', href: '#/communaute', bientot: true })}
          ${ligne({ icone: 'briefcase-business', titre: 'Professionnels', texte: 'Outils pour éleveurs et professionnels.', href: '#/pro', bientot: true })}
          ${comptesActifs() ? ligne({ icone: 'user', titre: 'Compte', texte: 'Connexion facultative par code reçu par e-mail, liste d\'attente Premium, vos données.', href: '#/compte' }) : ''}
          ${ligne({ icone: 'info', titre: 'À propos', texte: 'Mentions légales, sources et licences.', href: '#/apropos' })}
          ${ligne({ icone: 'compass', titre: 'Autres modules à venir', texte: 'Basse-cour, perdus / trouvés, refuges.', href: '#/bientot' })}
        </ul>
      </section>

      ${ligneBientot()}
    </div>`;

  // Apparence : changement immédiat, gardé sur l'appareil
  zone.querySelector('.pf-mode').addEventListener('change', (e) => {
    if (e.target.name !== 'mode') return;
    appliquerMode(e.target.value);
    toast(`Apparence « ${MODES.find((m) => m.id === e.target.value)?.nom ?? ''} » appliquée`);
  });

  // Couleur de l'appli : aperçu immédiat, puis mémorisé sur l'appareil
  zone.querySelector('[data-themes]').addEventListener('change', (e) => {
    if (e.target.name !== 'theme') return;
    if (e.target.value === PERSO) { majPerso(appliquerPerso(couleurPerso())); toast('Couleur personnalisée appliquée'); return; }
    appliquerTheme(e.target.value);
    toast(`Couleur « ${THEMES.find((t) => t.id === e.target.value)?.nom ?? ''} » appliquée`);
  });
  // Nuancier libre : la couleur est appliquée en direct, ajustée si besoin, et le message sous le nuancier le dit
  const info = zone.querySelector('[data-perso-info]');
  const majPerso = ({ choisie, utilisee, ajustee, apercu }) => {
    const carte = zone.querySelector('[data-perso-carte]');
    carte.style.cssText = `--pastille: ${apercu.pastille}; --pf-degrade: ${apercu.degrade}; --pf-fond: ${apercu.fond};`;
    carte.querySelector('input').checked = true;
    info.textContent = ajustee
      ? `Couleur assombrie automatiquement (${utilisee}) pour que le texte reste lisible : contraste d'au moins 4,5:1.`
      : `Couleur ${choisie} appliquée : le texte reste lisible (contraste d'au moins 4,5:1).`;
  };
  zone.querySelector('#pf-couleur').addEventListener('input', (e) => majPerso(appliquerPerso(e.target.value)));

  zone.querySelector('.pf-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const saisi = new FormData(e.currentTarget).get('prenom');
    const { prenom: enregistre } = storage.modifierProfil({ prenom: saisi });
    toast(enregistre ? `Bonjour ${enregistre} !` : 'Prénom effacé');
    rafraichir();
    document.getElementById('profil-prenom')?.focus();
  });
}
