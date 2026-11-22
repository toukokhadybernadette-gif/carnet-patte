// « À propos » (présentation, sources et licences) et « Mentions légales » (éditeur, hébergeur, données personnelles).
// Les informations de l'éditeur viennent de js/mentions-config.js : un champ vide s'affiche « [à compléter] ».

import { echapper } from '../../js/utils.js';
import { icone } from '../../js/icons.js';
import { bouton } from '../../js/composants.js';
import { estAncienneAdresse } from '../../js/adresse.js';
import { EDITEUR, HEBERGEURS, MISE_A_JOUR } from '../../js/mentions-config.js';

const aCompleter = '<mark class="ap-vide">[à compléter]</mark>';
const valeur = (v) => (String(v ?? '').trim() ? echapper(String(v).trim()) : aCompleter);

/** L'hébergeur de l'adresse sur laquelle on lit la page. */
export const hebergeurActuel = (hote = location.hostname) => (estAncienneAdresse(hote) ? HEBERGEURS.github : HEBERGEURS.cloudflare);

const LICENCES = [
  ['Lieux et fond de carte', "© contributeurs d'OpenStreetMap, données sous licence ODbL ; fichiers de lieux préparés à l'avance : même licence (voir donnees/lieux/LICENCE.txt)."],
  ['Adresses complétées', 'Base Adresse Nationale, Licence Ouverte 2.0.'],
  ['Carte', 'Leaflet (licence BSD-2) et Leaflet.markercluster (licence MIT), hébergés avec le site.'],
  ['Polices', 'Inter et Manrope (licence SIL OFL 1.1), hébergées avec le site.'],
  ['Icônes', 'Lucide (licence ISC).'],
];

function entete(titre, intro, retour) {
  return `
    <a class="pg-lien fi-retour" href="${retour.href}">${icone('arrow-left', { taille: 18 })} ${echapper(retour.texte)}</a>
    <header class="pg-entete"><h1 tabindex="-1">${echapper(titre)}</h1>${intro ? `<p>${intro}</p>` : ''}</header>`;
}

/** Page « À propos ». */
export function rendre(zone) {
  zone.classList.add('page-large');
  zone.innerHTML = `
    <div class="cp pg ap-page">
      ${entete('À propos', 'Carnet Patte, le carnet de santé de vos animaux : soins, rappels, pesées, documents, fiche de garde, basse-cour.', { href: '#/profil', texte: 'Profil' })}
      <section class="cp-carte ap-bloc" aria-labelledby="ap-donnees">
        <h2 id="ap-donnees">Vos données restent chez vous</h2>
        <p>Il n'y a pas de compte : vos animaux, soins, pesées, documents et fiches de garde sont enregistrés sur votre appareil. L'éditeur du site n'y a pas accès. Pensez à faire une sauvegarde de temps en temps.</p>
        <p>${bouton({ texte: 'Sauvegarde', variante: 'secondaire', icone: 'save', href: '#/donnees' })}</p>
      </section>
      <section class="cp-carte ap-bloc" aria-labelledby="ap-legal">
        <h2 id="ap-legal">Informations légales</h2>
        <p>Qui édite ce site, qui l'héberge, et ce qui se passe avec vos données.</p>
        <p>${bouton({ texte: 'Mentions légales', icone: 'shield-check', href: '#/mentions' })}</p>
      </section>
      <section class="cp-carte ap-bloc" aria-labelledby="ap-licences">
        <h2 id="ap-licences">Sources et licences</h2>
        <ul class="ap-liste">${LICENCES.map(([t, d]) => `<li><strong>${echapper(t)}</strong> : ${echapper(d)}</li>`).join('')}</ul>
      </section>
    </div>`;
}

/** Page « Mentions légales ». `config` et `hote` ne servent qu'aux tests. */
export function rendreMentions(zone, config = EDITEUR, hote = location.hostname) {
  zone.classList.add('page-large');
  const h = hebergeurActuel(hote);
  const adresse = String(config.adresse ?? '').trim();
  zone.innerHTML = `
    <div class="cp pg ap-page">
      ${entete('Mentions légales', `Dernière mise à jour : ${echapper(MISE_A_JOUR)}.`, { href: '#/apropos', texte: 'À propos' })}

      <section class="cp-carte ap-bloc" aria-labelledby="ml-editeur">
        <h2 id="ml-editeur">Éditeur du site</h2>
        <dl class="ap-dl">
          <div><dt>Nom</dt><dd data-champ="nom">${valeur(config.nom)}</dd></div>
          <div><dt>Statut</dt><dd data-champ="statut">${valeur(config.statut)}</dd></div>
          <div><dt>SIRET</dt><dd data-champ="siret">${valeur(config.siret)}</dd></div>
          <div><dt>Contact</dt><dd data-champ="email">${String(config.email ?? '').trim() ? `<a href="mailto:${echapper(String(config.email).trim())}">${echapper(String(config.email).trim())}</a>` : aCompleter}</dd></div>
          ${adresse ? `<div><dt>Adresse</dt><dd data-champ="adresse">${echapper(adresse)}</dd></div>` : ''}
          <div><dt>Directeur de la publication</dt><dd data-champ="directeur">${valeur(config.nom)}</dd></div>
        </dl>
      </section>

      <section class="cp-carte ap-bloc" aria-labelledby="ml-hebergeur">
        <h2 id="ml-hebergeur">Hébergeur</h2>
        <dl class="ap-dl">
          <div><dt>Société</dt><dd data-champ="hebergeur">${echapper(h.nom)}</dd></div>
          <div><dt>Adresse</dt><dd>${echapper(h.adresse)}</dd></div>
          ${h.telephone ? `<div><dt>Téléphone</dt><dd>${echapper(h.telephone)}</dd></div>` : ''}
          <div><dt>Site</dt><dd><a href="${echapper(h.site)}" target="_blank" rel="noopener noreferrer">${echapper(h.site)}</a></dd></div>
        </dl>
      </section>

      <section class="cp-carte ap-bloc" aria-labelledby="ml-donnees">
        <h2 id="ml-donnees">Données personnelles</h2>
        <p><strong>Pas de compte, pas de suivi.</strong> Vos animaux, soins, pesées, documents, fiches de garde et réglages sont enregistrés dans votre navigateur (stockage local de l'appareil). L'éditeur n'y a pas accès et n'utilise ni cookie publicitaire, ni outil de mesure d'audience.</p>
        <p><strong>Ce qui sort de votre appareil :</strong></p>
        <ul class="ap-liste">
          <li>l'hébergeur du site traite techniquement les requêtes (dont l'adresse IP) pour envoyer les pages ;</li>
          <li>la Carte : le fond de carte vient des serveurs d'OpenStreetMap (votre adresse IP leur est transmise) ; une recherche de ville est envoyée à Nominatim ; hors France métropolitaine, une zone approximative d'environ 1 km est envoyée à un serveur Overpass. Votre position exacte n'est jamais enregistrée ;</li>
          <li>les liens de la Boutique ouvrent les sites des marchands, qui ont leurs propres règles.</li>
        </ul>
        <p><strong>Vos droits.</strong> Comme rien n'est collecté par l'éditeur, il n'a pas de données à vous communiquer ni à effacer : pour supprimer vos données, utilisez « Sauvegarde → Tout effacer » ou videz les données du site dans votre navigateur. Pour toute question : ${String(config.email ?? '').trim() ? `<a href="mailto:${echapper(String(config.email).trim())}">${echapper(String(config.email).trim())}</a>` : aCompleter}. Vous pouvez aussi saisir la CNIL (cnil.fr).</p>
      </section>

      <section class="cp-carte ap-bloc" aria-labelledby="ml-usage">
        <h2 id="ml-usage">Informations indicatives</h2>
        <p>Les fiches « Toxique ? », les conseils et les lieux affichés sont donnés à titre indicatif, parfois incomplets, et ne remplacent pas l'avis d'un vétérinaire. En cas d'urgence ou de doute, appelez votre vétérinaire ou un centre antipoison vétérinaire.</p>
      </section>

      <section class="cp-carte ap-bloc" aria-labelledby="ml-pi">
        <h2 id="ml-pi">Propriété intellectuelle et licences</h2>
        <p>Le contenu et le code de Carnet Patte sont la propriété de l'éditeur, sauf les éléments tiers ci-dessous, utilisés selon leurs licences.</p>
        <ul class="ap-liste">${LICENCES.map(([t, d]) => `<li><strong>${echapper(t)}</strong> : ${echapper(d)}</li>`).join('')}</ul>
      </section>
    </div>`;
}
