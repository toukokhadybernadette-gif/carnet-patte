// Menu ☰ de la barre du haut : un panneau en verre qui glisse depuis la gauche.
// Entrées : Toxique ?, Boutique, Sauvegarde, Couleur de l'appli, Bientôt sur Carnet Patte, À propos.
// C'est un <dialog> modal : le navigateur gère le piégeage du focus, la touche Échap et le fond assombri.

import { icone } from './icons.js';
import { modale } from './ui.js';

const ENTREES = [
  { id: 'toxique', titre: 'Toxique ?', texte: 'Un aliment, une plante ou un produit est-il dangereux ?', icone: 'shield-alert', href: '#/toxique' },
  { id: 'boutique', titre: 'Boutique', texte: "Une sélection d'accessoires, avec des liens vers des sites marchands.", icone: 'shopping-bag', href: '#/boutique' },
  { id: 'donnees', titre: 'Sauvegarde', texte: 'Exporter, importer ou effacer vos données.', icone: 'save', href: '#/donnees' },
  { id: 'couleur', titre: "Couleur de l'appli", texte: '12 couleurs, ou la vôtre.', icone: 'palette', href: '#/profil', vers: 'pf-theme' },
  { id: 'bientot', titre: 'Bientôt sur Carnet Patte', texte: 'Les modules à venir.', icone: 'compass', href: '#/bientot' },
  { id: 'apropos', titre: 'À propos', texte: 'Ce qu\'est Carnet Patte, et où restent vos données.', icone: 'info' },
];

/** Fenêtre « À propos ». */
export function ouvrirAPropos() {
  modale('À propos de Carnet Patte', `
    <div class="ap-texte">
      <p><strong>Carnet Patte</strong> est un carnet de santé pour vos animaux : soins, rappels, pesées, et un guide « Toxique ? » pour savoir ce qui est dangereux.</p>
      <p><strong>Vos données restent sur cet appareil.</strong> Il n'y a pas de compte et vos animaux, soins et rappels ne sont jamais envoyés sur internet. Seule la Carte Patte contacte OpenStreetMap, quand vous lancez une recherche. La Boutique ne contient que des liens vers des sites marchands : ils s'ouvrent dans un nouvel onglet, et la page indique toujours si Carnet Patte touche une commission. Pensez à faire une sauvegarde de temps en temps (menu ☰, « Sauvegarde »).</p>
      <p>Le guide « Toxique ? » est indicatif : il ne remplace pas l'avis d'un vétérinaire. En cas de doute, appelez votre vétérinaire ou un centre antipoison vétérinaire.</p>
      <p class="cp-doux">Polices Manrope et Inter, icônes Lucide, carte Leaflet et son plugin de regroupement : licences libres, hébergées dans l'application. Lieux et fond de carte © contributeurs d'OpenStreetMap.</p>
    </div>`);
}

let panneau = null;

function fermer() {
  if (!panneau) return;
  const p = panneau;
  panneau = null;
  p.classList.add('app-menu--sortie');
  const fin = () => { if (p.open) p.close(); };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) fin(); else setTimeout(fin, 180);
}

/** Ouvre le panneau du menu. `declencheur` : le bouton ☰, qui récupère le focus à la fermeture. */
export function ouvrirMenu(declencheur) {
  if (panneau) return;
  const dlg = document.createElement('dialog');
  dlg.className = 'app-menu';
  dlg.setAttribute('aria-label', 'Menu');
  dlg.innerHTML = `
    <div class="app-menu__tete">
      <span class="app-marque"><span class="app-marque__logo">${icone('paw-print', { taille: 22 })}</span><span class="app-marque__nom">Carnet Patte</span></span>
      <button type="button" class="cp-btn cp-btn--discret cp-btn--icone" data-fermer aria-label="Fermer le menu">${icone('x', { taille: 18 })}</button>
    </div>
    <nav aria-label="Menu">
      <ul class="app-menu__liste">
        ${ENTREES.map((e) => `<li>${e.href
          ? `<a class="app-menu__lien" href="${e.href}" data-menu="${e.id}">`
          : `<button type="button" class="app-menu__lien" data-menu="${e.id}">`}
            <span class="app-menu__icone" aria-hidden="true">${icone(e.icone, { taille: 20 })}</span>
            <span class="app-menu__corps"><span class="app-menu__titre">${e.titre}</span><span class="app-menu__texte">${e.texte}</span></span>
            <span class="app-menu__fleche" aria-hidden="true">${icone('chevron-right', { taille: 18 })}</span>
          ${e.href ? '</a>' : '</button>'}</li>`).join('')}
      </ul>
    </nav>`;
  document.body.append(dlg);
  panneau = dlg;
  declencheur?.setAttribute('aria-expanded', 'true');
  dlg.addEventListener('close', () => { dlg.remove(); if (panneau === dlg) panneau = null; declencheur?.setAttribute('aria-expanded', 'false'); declencheur?.focus({ preventScroll: true }); });
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); fermer(); }); // Échap : même glissement de sortie
  dlg.addEventListener('click', (e) => {
    if (e.target === dlg || e.target.closest('[data-fermer]')) { fermer(); return; }
    const lien = e.target.closest('[data-menu]');
    if (!lien) return;
    const entree = ENTREES.find((x) => x.id === lien.dataset.menu);
    fermer();
    if (entree.id === 'apropos') ouvrirAPropos();
    // « Couleur de l'appli » : la page Profil s'ouvre directement sur ce réglage
    if (entree.vers) {
      const cible = () => document.getElementById(entree.vers)?.scrollIntoView({ behavior: 'auto', block: 'start' });
      setTimeout(cible, 120); setTimeout(cible, 450);
    }
  });
  dlg.showModal();
}
