// Adresse du site : le site a déménagé de GitHub Pages (*.github.io) vers Cloudflare Pages.
// Tant que l'ancienne adresse reste ouverte, l'appli qui y tourne affiche un bandeau « Carnet Patte a déménagé » qui mène à demenagement.html
// (explications, sauvegarde en un geste, marche à suivre). Sur la nouvelle adresse, ce bandeau n'apparaît jamais.
// Le jour où l'ancienne adresse est fermée, on retire l'appel à afficherBandeauDemenagement() dans js/app.js.

export const NOUVELLE_ADRESSE = 'https://carnet-patte.pages.dev/';
export const NOUVEAU_NOM = 'carnet-patte.pages.dev';

/** Est-on sur l'ancienne adresse (GitHub Pages) ? `hote` ne sert qu'aux tests. */
export const estAncienneAdresse = (hote = location.hostname) => /\.github\.io$/i.test(hote);

/** Affiche le bandeau en haut de la page, seulement sur l'ancienne adresse. Retourne l'élément (ou null). */
export function afficherBandeauDemenagement({ hote } = {}) {
  if (!estAncienneAdresse(hote) || document.querySelector('.pwa-demenage')) return null;
  const bandeau = document.createElement('div');
  bandeau.className = 'pwa-demenage';
  bandeau.setAttribute('role', 'region');
  bandeau.setAttribute('aria-label', 'Déménagement du site');
  bandeau.innerHTML = `
    <p class="pwa-demenage__texte"><strong>Carnet Patte a déménagé</strong> : <span>${NOUVEAU_NOM}</span>. Récupérez vos données, puis passez à la nouvelle adresse.</p>
    <a class="cp-btn cp-btn--principal cp-btn--s" href="demenagement.html">Voir comment</a>`;
  document.body.prepend(bandeau);
  return bandeau;
}
