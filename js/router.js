// Navigation entre les pages grâce à l'adresse (#/accueil, #/animaux, #/animaux/rappels, #/donnees...).
// Sans adresse, on arrive sur l'Accueil.
// Chaque module déclare sa route avec route('nom', fonction).
// La fonction reçoit : la zone où afficher la page, et le reste de l'adresse (ex. l'id d'un animal).

import { vide, bouton } from './composants.js';

const routes = {};
let zoneContenu = null;
let apresAffichage = null;

export function route(nom, fonctionAffichage) {
  routes[nom] = fonctionAffichage;
}

export function segments() {
  return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

/** Réaffiche la page actuelle (utile après une modification de données). */
export function rafraichir() {
  const seg = segments();
  if (!seg.length) {
    location.replace('#/accueil');
    return;
  }
  // Chaque affichage reçoit un conteneur neuf : les écouteurs de clic de l'ancienne page disparaissent avec lui
  const page = document.createElement('div');
  zoneContenu.replaceChildren(page);
  const affichage = routes[seg[0]];
  if (affichage) {
    affichage(page, seg.slice(1));
  } else {
    page.innerHTML = `<div class="cp pg"><div class="cp-carte">${vide({ niveau: 1, icone: 'circle-help', titre: 'Page introuvable', texte: "Cette page n'existe pas.", action: bouton({ texte: "Retour à l'accueil", icone: 'house', href: '#/accueil' }) })}</div></div>`;
  }
  if (apresAffichage) apresAffichage(seg);
}

export function demarrer(zone, apres) {
  zoneContenu = zone;
  apresAffichage = apres;
  window.addEventListener('hashchange', () => {
    rafraichir();
    window.scrollTo(0, 0);
  });
  rafraichir();
}
