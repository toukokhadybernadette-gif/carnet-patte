// Appli installable et hors ligne : enregistre le service worker (sw.js) et prévient quand une nouvelle version est prête.
// Les données des animaux (localStorage) ne sont jamais touchées ici : mettre à jour = recharger la page, rien d'autre.

import { icone } from './icons.js';
import { bouton } from './composants.js';

/** L'appli est-elle ouverte depuis l'écran d'accueil (installée) ? */
export const estInstallee = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

let bandeau = null;

/** Petite bannière « Nouvelle version disponible — Mettre à jour » (recharge la page). `activer` est appelée au clic. */
function afficherBandeau(activer) {
  if (bandeau?.isConnected) return;
  bandeau = document.createElement('div');
  bandeau.className = 'pwa-maj';
  bandeau.setAttribute('role', 'status');
  bandeau.innerHTML = `
    <span class="pwa-maj__icone" aria-hidden="true">${icone('download', { taille: 18 })}</span>
    <span class="pwa-maj__texte">Nouvelle version disponible</span>
    ${bouton({ texte: 'Mettre à jour', taille: 's', attrs: { 'data-maj': true } })}
    ${bouton({ variante: 'discret', taille: 's', seul: true, icone: 'x', titre: 'Plus tard', attrs: { 'data-plus-tard': true } })}`;
  bandeau.querySelector('[data-maj]').addEventListener('click', (e) => { e.currentTarget.disabled = true; activer(); });
  bandeau.querySelector('[data-plus-tard]').addEventListener('click', () => bandeau.remove());
  document.body.append(bandeau);
}

export function initialiserPwa() {
  if (!('serviceWorker' in navigator)) return;
  // La nouvelle version prend la main toute seule (sw.js : skipWaiting + clients.claim). Si la page était déjà contrôlée par l'ancienne,
  // on propose de recharger ; la page n'est jamais rechargée sans clic. À la toute première installation, rien à proposer.
  const avaitControleur = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (avaitControleur) afficherBandeau(() => location.reload()); });

  addEventListener('load', async () => {
    let enregistrement;
    try { enregistrement = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }); } catch { return; } // pas de HTTPS, navigation privée… : l'appli marche quand même, sans hors-ligne
    // Une appli installée reste longtemps ouverte en arrière-plan : on cherche une nouvelle version à chaque retour
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') enregistrement.update().catch(() => {}); });
  }, { once: true });
}
