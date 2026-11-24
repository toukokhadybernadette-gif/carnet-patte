// Informations de l'éditeur affichées dans « À propos > Mentions légales » (modules/apropos/apropos.js).
// À REMPLIR par l'éditeur du site. Un champ vide s'affiche « [à compléter] » dans la page.
//
// ADRESSE : vide pour l'instant (affichée « [à compléter] »). Avec un abonnement payant, une adresse de vendeur est exigée sur les factures et dans les CGV :
// à choisir (domiciliation ou adresse personnelle) AVANT le passage en réel, avec votre comptable. La même adresse est à saisir dans Stripe (Paramètres → Détails de l'entreprise).

export const EDITEUR = {
  nom: 'Touko Khady Bernadette',                         // Nom et prénom de l'éditeur (c'est aussi le directeur de la publication)
  statut: 'Entrepreneur individuel (EI) – micro-entreprise', // Statut juridique
  siret: '13121199700013',                       // 14 chiffres, sur l'avis de situation INSEE
  email: 'contact@carnetpatte.com', // Adresse e-mail de contact (droits sur les données, questions, signalements)
  adresse: '',                     // Adresse du vendeur : OBLIGATOIRE sur les factures et dans les CGV dès que le Premium est payant (adresse professionnelle ou de domiciliation). « [à compléter] » tant qu'elle est vide.
  mediateur: '',                   // Médiateur de la consommation (nom, site, adresse postale) : OBLIGATOIRE dans les CGV pour vendre à des particuliers. « [à compléter] » tant qu'il est vide.
};

/** L'abonnement Premium : le prix affiché dans l'appli et dans les CGV. Le prix réel est celui du « prix » créé dans Stripe (voir ABONNEMENT.md) : les deux doivent être identiques. */
export const PREMIUM = { prix: '2,99', periode: 'mois' };

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
