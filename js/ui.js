// Éléments d'interface partagés : fenêtres modales, confirmation, messages.
// Les fonctions gardent leur signature d'origine (les modules ne changent pas) ;
// l'affichage et l'accessibilité viennent des composants de js/composants.js.

import { ouvrirModale, confirmer as confirmerComposant, notifier } from './composants.js';

/**
 * Ouvre une fenêtre modale. `ouvert(dialog)` est appelé une fois le contenu affiché,
 * pour brancher les boutons et formulaires. Retourne l'élément <dialog> (dialog.close() pour fermer).
 */
export function modale(titre, contenuHtml, ouvert) {
  return ouvrirModale({ titre, contenu: contenuHtml, ouvert });
}

/** Demande une confirmation. Retourne une promesse : true si l'utilisateur confirme. */
export function confirmer(message, libelle = 'Supprimer') {
  return confirmerComposant({ titre: 'Confirmation', message, libelle, danger: true });
}

/** Petit message qui disparaît tout seul. type : 'succes' (par défaut) | 'info' | 'erreur'. */
export function toast(message, type = 'succes') {
  notifier(message, { type });
}
