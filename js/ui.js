// Éléments d'interface partagés : fenêtres modales, confirmation, messages.

import { echapper } from './utils.js';

/**
 * Ouvre une fenêtre modale. `ouvert(dialog)` est appelé une fois le contenu affiché,
 * pour brancher les boutons et formulaires. Retourne l'élément <dialog> (dialog.close() pour fermer).
 */
export function modale(titre, contenuHtml, ouvert) {
  const dlg = document.createElement('dialog');
  dlg.className = 'modale';
  dlg.innerHTML = `
    <div class="modale-tete">
      <h2>${echapper(titre)}</h2>
      <button type="button" class="fermer" aria-label="Fermer">✕</button>
    </div>
    <div class="modale-corps">${contenuHtml}</div>`;
  document.body.append(dlg);

  dlg.querySelector('.fermer').addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => dlg.remove());
  // Un clic sur le fond sombre ferme la fenêtre
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  dlg.showModal();
  if (ouvert) ouvert(dlg);
  return dlg;
}

/** Demande une confirmation. Retourne une promesse : true si l'utilisateur confirme. */
export function confirmer(message, libelle = 'Supprimer') {
  return new Promise((resolve) => {
    let ok = false;
    const dlg = modale('Confirmation', `
      <p>${echapper(message)}</p>
      <div class="actions">
        <button type="button" class="bouton secondaire" data-non>Annuler</button>
        <button type="button" class="bouton danger" data-oui>${echapper(libelle)}</button>
      </div>`, (d) => {
      d.querySelector('[data-oui]').addEventListener('click', () => { ok = true; d.close(); });
      d.querySelector('[data-non]').addEventListener('click', () => d.close());
    });
    dlg.addEventListener('close', () => resolve(ok));
  });
}

/** Petit message qui disparaît tout seul. */
export function toast(message) {
  const zone = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  zone.append(el);
  setTimeout(() => el.remove(), 3000);
}
