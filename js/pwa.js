// Appli installable et hors ligne : enregistre le service worker (sw.js) et prévient quand une nouvelle version est prête.
// Les données des animaux (localStorage) ne sont jamais touchées ici : mettre à jour = recharger la page, rien d'autre.

import { icone } from './icons.js';
import { bouton } from './composants.js';

/** L'appli est-elle ouverte depuis l'écran d'accueil (installée) ? */
export const estInstallee = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

let bandeau = null;

/** Petite bannière « Nouvelle version disponible — Mettre à jour ». `activer` est appelée au clic. */
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
  // Même page rechargée seulement si c'est NOUS qui avons demandé la mise à jour (pas à la toute première installation)
  let rechargement = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (rechargement || !demandee) return;
    rechargement = true;
    location.reload();
  });
  let demandee = false;

  addEventListener('load', async () => {
    let enregistrement;
    try { enregistrement = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }); } catch { return; } // pas de HTTPS, navigation privée… : l'appli marche quand même, sans hors-ligne
    const activer = () => { demandee = true; (enregistrement.waiting ?? enregistrement.installing)?.postMessage({ type: 'SKIP_WAITING' }); };
    // Une version déjà installée ET une autre en attente : on propose
    const surveiller = (sw) => sw.addEventListener('statechange', () => { if (sw.state === 'installed' && navigator.serviceWorker.controller) afficherBandeau(activer); });
    if (enregistrement.waiting && navigator.serviceWorker.controller) afficherBandeau(activer);
    enregistrement.addEventListener('updatefound', () => enregistrement.installing && surveiller(enregistrement.installing));
    if (enregistrement.installing) surveiller(enregistrement.installing);
    // Une appli installée reste longtemps ouverte en arrière-plan : on cherche une nouvelle version à chaque retour
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') enregistrement.update().catch(() => {}); });
  }, { once: true });
}
