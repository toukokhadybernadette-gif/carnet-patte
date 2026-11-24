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
        <p>Un compte est facultatif : vos animaux, soins, pesées, documents et fiches de garde sont enregistrés sur votre appareil, avec ou sans compte. L'éditeur du site n'y a pas accès. Pensez à faire une sauvegarde de temps en temps.</p>
        <p>${bouton({ texte: 'Sauvegarde', variante: 'secondaire', icone: 'save', href: '#/donnees' })}</p>
      </section>
      <section class="cp-carte ap-bloc" aria-labelledby="ap-legal">
        <h2 id="ap-legal">Informations légales</h2>
        <p>Qui édite ce site, qui l'héberge, et ce qui se passe avec vos données.</p>
        <p class="ap-actions">${bouton({ texte: 'Mentions légales', icone: 'shield-check', href: '#/mentions' })} ${bouton({ texte: 'Confidentialité', variante: 'secondaire', icone: 'file-text', href: '#/confidentialite' })}</p>
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
        <p><strong>Compte facultatif, aucun suivi.</strong> Vos animaux, soins, pesées, documents, fiches de garde et réglages sont enregistrés dans votre navigateur (stockage local de l'appareil). L'éditeur n'y a pas accès et n'utilise ni cookie publicitaire, ni outil de mesure d'audience.</p>
        <p>Si vous créez un compte (facultatif), seuls votre adresse e-mail et votre formule sont conservées sur nos serveurs : tout est détaillé dans la <a href="#/confidentialite">politique de confidentialité</a>.</p>
        <p><strong>Ce qui sort de votre appareil :</strong></p>
        <ul class="ap-liste">
          <li>l'hébergeur du site traite techniquement les requêtes (dont l'adresse IP) pour envoyer les pages ;</li>
          <li>la Carte : le fond de carte vient des serveurs d'OpenStreetMap (votre adresse IP leur est transmise) ; une recherche de ville est envoyée à Nominatim ; hors France métropolitaine, une zone approximative d'environ 1 km est envoyée à un serveur Overpass. Votre position exacte n'est jamais enregistrée ;</li>
          <li>les liens de la Boutique ouvrent les sites des marchands, qui ont leurs propres règles.</li>
        </ul>
        <p><strong>Vos droits.</strong> Sans compte, rien n'est collecté par l'éditeur : il n'a pas de données à vous communiquer ni à effacer ; pour supprimer les données de votre appareil, utilisez « Sauvegarde → Tout effacer » ou videz les données du site dans votre navigateur. Pour toute question : ${String(config.email ?? '').trim() ? `<a href="mailto:${echapper(String(config.email).trim())}">${echapper(String(config.email).trim())}</a>` : aCompleter}. Avec un compte, vous pouvez télécharger et supprimer ses données depuis la page Compte. Vous pouvez aussi saisir la CNIL (cnil.fr).</p>
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

/** Page « Confidentialité » (RGPD) : ce que l'appli garde, ce que le compte facultatif ajoute, qui traite quoi, les droits. */
export function rendreConfidentialite(zone, config = EDITEUR) {
  zone.classList.add('page-large');
  const mail = String(config.email ?? '').trim();
  const contact = mail ? `<a href="mailto:${echapper(mail)}">${echapper(mail)}</a>` : aCompleter;
  zone.innerHTML = `
    <div class="cp pg ap-page">
      ${entete('Confidentialité', `Dernière mise à jour : ${echapper(MISE_A_JOUR)}. En clair : sans compte, rien ne quitte votre appareil ; avec un compte, seulement votre e-mail.`, { href: '#/apropos', texte: 'À propos' })}

      <section class="cp-carte ap-bloc" aria-labelledby="cf-resp">
        <h2 id="cf-resp">Qui est responsable de vos données</h2>
        <p>L'éditeur du site, ${valeur(config.nom)} (voir les <a href="#/mentions">mentions légales</a>). Contact pour toute question ou demande : ${contact}.</p>
      </section>

      <section class="cp-carte ap-bloc" aria-labelledby="cf-sans">
        <h2 id="cf-sans">Sans compte : tout reste sur votre appareil</h2>
        <p>Vos animaux, soins, rappels, pesées, documents, photos et fiches de garde sont enregistrés dans le stockage local de votre appareil. Ils ne sont <strong>jamais envoyés</strong> à l'éditeur ni à un tiers, avec ou sans compte. Il n'y a ni cookie publicitaire, ni outil de mesure d'audience, ni publicité.</p>
      </section>

      <section class="cp-carte ap-bloc" aria-labelledby="cf-avec">
        <h2 id="cf-avec">Avec un compte (facultatif)</h2>
        <p>Un compte permet de vous connecter par un code reçu par e-mail, sans mot de passe. Voici <strong>tout</strong> ce que le serveur conserve :</p>
        <ul class="ap-liste">
          <li>votre adresse e-mail ;</li>
          <li>la date de création du compte et de votre dernière connexion ;</li>
          <li>votre formule (gratuite ou Premium) ;</li>
          <li>votre inscription éventuelle à la liste d'attente Premium.</li>
        </ul>
        <p><strong>Jamais</strong> : vos animaux, soins, pesées, documents, photos ou votre position. La sauvegarde cloud et la synchronisation n'existent pas encore ; elles seront réservées à la formule Premium. Avant leur ouverture, cette page sera mise à jour et vous serez prévenu(e).</p>
        <p><strong>Pourquoi, et sur quel fondement.</strong> Vous connecter et reconnaître votre compte : c'est le service que vous demandez en créant un compte. Vous prévenir de l'ouverture du Premium : uniquement si vous vous inscrivez vous-même sur la liste d'attente, ce qui vaut consentement, que vous pouvez retirer à tout moment. Vos données ne sont ni vendues, ni louées, ni utilisées pour de la publicité.</p>
        <p><strong>Sur votre appareil.</strong> La session de connexion est gardée dans le stockage local de l'appareil (ce n'est pas un cookie de suivi). « Se déconnecter » l'efface.</p>
      </section>

      <section class="cp-carte ap-bloc" aria-labelledby="cf-qui">
        <h2 id="cf-qui">Qui traite quoi</h2>
        <ul class="ap-liste">
          <li><strong>Supabase</strong> : base de données et connexion des comptes. Projet hébergé en Europe (Irlande).</li>
          <li><strong>Resend</strong> : envoi par e-mail du code de connexion, depuis l'adresse noreply@carnetpatte.com. Ce service reçoit votre adresse e-mail et le code pour l'envoyer ; serveurs en Europe (Irlande).</li>
          <li><strong>Cloudflare</strong> : hébergement du site (voir les mentions légales).</li>
          <li>La Carte contacte OpenStreetMap quand vous l'utilisez (voir les mentions légales).</li>
        </ul>
        <p>Ces prestataires agissent pour le compte de l'éditeur. Leurs sociétés mères étant établies hors de l'Union européenne, les éventuels transferts de données sont encadrés par les garanties prévues par le RGPD (clauses contractuelles types).</p>
      </section>

      <section class="cp-carte ap-bloc" aria-labelledby="cf-duree">
        <h2 id="cf-duree">Combien de temps</h2>
        <p>Vos informations de compte sont conservées tant que le compte existe. Si vous supprimez le compte, elles sont effacées du serveur immédiatement et définitivement. Les prestataires d'envoi d'e-mails gardent un journal technique d'envoi pendant une durée limitée qu'ils fixent.</p>
      </section>

      <section class="cp-carte ap-bloc" aria-labelledby="cf-droits">
        <h2 id="cf-droits">Vos droits</h2>
        <p>Vous pouvez accéder à vos données, les faire corriger, les récupérer, les effacer, vous opposer à leur traitement ou retirer votre consentement. Connecté(e), la plupart se font <strong>directement</strong> dans l'appli :</p>
        <ul class="ap-liste">
          <li>télécharger les données de votre compte, et supprimer votre compte : page Compte ;</li>
          <li>vous retirer de la liste d'attente Premium : page Compte ;</li>
          <li>pour les données de votre appareil : « Sauvegarde » (export et « Tout effacer »).</li>
        </ul>
        <p>Pour toute autre demande (par exemple changer d'adresse e-mail) : ${contact}. Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la CNIL (cnil.fr).</p>
        <p>${bouton({ texte: 'Ouvrir la page Compte', icone: 'user', href: '#/compte' })}</p>
      </section>
    </div>`;
}
