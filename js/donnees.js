// Page « Sauvegarde » : export, import et effacement des données.

import * as sauvegarde from './sauvegarde.js';
import { SEUIL_GROS_EXPORT } from './documents-db.js';
import { aujourdhui, formatTaille } from './utils.js';
import { confirmer, toast } from './ui.js';
import { rafraichir } from './router.js';
import { icone } from './icons.js';
import { bouton, alerte } from './composants.js';

export function rendre(zone) {
  zone.classList.add('page-large');
  const bloc = ({ id, icone: i, titre, texte, actions, danger = false }) => `
    <section class="cp-carte dn-bloc${danger ? ' dn-bloc--danger' : ''}" aria-labelledby="${id}">
      <span class="dn-bloc__icone" aria-hidden="true">${icone(i, { taille: 24 })}</span>
      <div class="dn-bloc__corps">
        <h2 id="${id}">${titre}</h2>
        <p>${texte}</p>
        <div class="dn-bloc__actions">${actions}</div>
      </div>
    </section>`;

  zone.innerHTML = `
    <div class="cp pg">
      <header class="pg-entete">
        <h1 tabindex="-1">Sauvegarde</h1>
        <p>Exportez vos données, restaurez-les ou repartez de zéro.</p>
      </header>

      ${alerte({ type: 'info', titre: 'Vos données restent sur cet appareil', texte: "Carnet Patte enregistre tout dans votre navigateur. Si vous videz les données du navigateur ou changez de téléphone ou d'ordinateur, elles disparaissent : pensez à faire un export de temps en temps." })}

      <div class="dn-liste">
        ${bloc({ id: 'dn-export', icone: 'download', titre: 'Exporter', texte: 'Télécharge un fichier avec tous vos animaux, soins, pesées, fiches de garde et documents.',
          actions: `<p class="dn-taille" data-taille role="status">Calcul de la taille…</p><div data-gros></div>` + bouton({ texte: 'Télécharger ma sauvegarde', icone: 'download', attrs: { 'data-act': 'exporter' } }) })}
        ${bloc({ id: 'dn-import', icone: 'upload', titre: 'Importer', texte: "Charge un fichier d'export. <strong>Attention : cela remplace toutes les données actuelles, documents compris.</strong>",
          actions: `${bouton({ texte: 'Choisir un fichier…', variante: 'secondaire', icone: 'upload', attrs: { 'data-act': 'choisir' } })}
            <input type="file" accept=".json,application/json" hidden data-fichier aria-label="Fichier de sauvegarde à importer">` })}
        ${bloc({ id: 'dn-effacer', icone: 'trash-2', titre: 'Tout effacer', danger: true, texte: 'Supprime définitivement tous les animaux, soins, pesées, documents, fiches de garde et votre prénom de cet appareil.',
          actions: bouton({ texte: 'Tout effacer', variante: 'danger', icone: 'trash-2', attrs: { 'data-act': 'effacer' } }) })}
      </div>
    </div>`;

  // Taille de la sauvegarde : annoncée avant de la télécharger, avec un avertissement si elle devient grosse
  sauvegarde.estimerSauvegarde().then(({ octets, documents }) => {
    if (!zone.isConnected) return;
    zone.querySelector('[data-taille]').textContent = `Taille de la sauvegarde : environ ${formatTaille(octets)}${documents ? ` (dont ${documents} document${documents > 1 ? 's' : ''})` : ''}.`;
    if (octets > SEUIL_GROS_EXPORT) zone.querySelector('[data-gros]').innerHTML = alerte({ type: 'attention', titre: 'Sauvegarde volumineuse', texte: `Le fichier fera environ ${formatTaille(octets)} : il peut être long à créer, et certaines messageries refusent les gros fichiers. Vous pouvez supprimer les documents inutiles dans la fiche des animaux.` });
  }).catch(() => { zone.querySelector('[data-taille]').textContent = ''; });

  zone.addEventListener('click', async (e) => {
    const declencheur = e.target.closest('[data-act]');
    if (!declencheur) return;
    if (declencheur.dataset.act === 'choisir') {
      zone.querySelector('[data-fichier]').click();
    } else if (declencheur.dataset.act === 'exporter') {
      try {
        const blob = new Blob([await sauvegarde.exporterTout()], { type: 'application/json' });
        const lien = document.createElement('a');
        lien.href = URL.createObjectURL(blob);
        lien.download = `carnet-patte-${aujourdhui()}.json`;
        lien.click();
        setTimeout(() => URL.revokeObjectURL(lien.href), 60000);
        toast(blob.size > SEUIL_GROS_EXPORT ? `Sauvegarde téléchargée (${formatTaille(blob.size)}) : fichier volumineux, voir l'avertissement ci-dessus.` : `Sauvegarde téléchargée (${formatTaille(blob.size)})`, blob.size > SEUIL_GROS_EXPORT ? 'info' : 'succes');
      } catch (err) {
        toast(`La sauvegarde n'a pas pu être créée : ${err.message}`, 'erreur');
      }
    } else if (declencheur.dataset.act === 'effacer') {
      if (await confirmer('Effacer toutes les données ? Pensez à faire un export avant : cette action est définitive.', 'Tout effacer')) {
        await sauvegarde.toutEffacerTout();
        toast('Données effacées');
        rafraichir();
      }
    }
  });

  zone.querySelector('[data-fichier]').addEventListener('change', async (e) => {
    const fichier = e.target.files[0];
    e.target.value = '';
    if (!fichier) return;
    if (!await confirmer(`Importer « ${fichier.name} » ? Les données actuelles, documents compris, seront remplacées.`, 'Importer')) return;
    try {
      const { documents, ignores } = await sauvegarde.importerTout(await fichier.text());
      toast(`Données importées${documents ? ` (${documents} document${documents > 1 ? 's' : ''})` : ''}${ignores ? ` · ${ignores} document${ignores > 1 ? 's' : ''} ignoré${ignores > 1 ? 's' : ''} (illisible${ignores > 1 ? 's' : ''})` : ''}`);
      location.hash = '#/animaux';
    } catch (err) {
      toast(err.message, 'erreur');
    }
  });
}
