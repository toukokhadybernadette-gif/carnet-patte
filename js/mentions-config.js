// Informations de l'éditeur affichées dans « À propos > Mentions légales » (modules/apropos/apropos.js).
// À REMPLIR par l'éditeur du site. Un champ vide s'affiche « [à compléter] » dans la page.
//
// ADRESSE POSTALE : volontairement VIDE et non affichée. Ne la renseignez que si vous décidez de la publier.
// (Un particulier ou un micro-entrepreneur peut ne pas publier son adresse personnelle à condition que l'hébergeur,
// qui la détient, soit bien indiqué : c'est le cas ci-dessous. Vérifiez ce point avec votre conseil ou votre comptable.)

export const EDITEUR = {
  nom: '',                         // Nom et prénom de l'éditeur (c'est aussi le directeur de la publication)
  statut: 'Micro-entreprise',      // Statut juridique
  siret: '',                       // 14 chiffres, sur l'avis de situation INSEE
  email: '',                       // Adresse e-mail de contact (droits sur les données, questions, signalements)
  adresse: '',                     // NE PAS REMPLIR sans décision de votre part : n'est affichée que si ce champ est rempli
};

/** Date de dernière mise à jour du texte de la page. */
export const MISE_A_JOUR = 'novembre 2026';

/** Hébergeurs du site. La page affiche celui de l'adresse sur laquelle elle est lue. */
export const HEBERGEURS = {
  cloudflare: {
    nom: 'Cloudflare, Inc.', adresse: '101 Townsend Street, San Francisco, CA 94107, États-Unis', telephone: '+1 (650) 319-8930', site: 'https://www.cloudflare.com/',
  },
  // Ancienne adresse (GitHub Pages), tant qu'elle reste ouverte
  github: {
    nom: 'GitHub, Inc.', adresse: '88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis', telephone: '', site: 'https://pages.github.com/',
  },
};
