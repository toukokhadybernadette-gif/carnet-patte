// Page « Sauvegarde » : export, import et effacement des données.

import * as storage from './storage.js';
import { aujourdhui } from './utils.js';
import { confirmer, toast } from './ui.js';
import { rafraichir } from './router.js';

export function rendre(zone) {
  zone.innerHTML = `
    <div class="page-titre"><h1>Sauvegarde</h1></div>

    <section class="carte">
      <h2>Vos données restent sur cet appareil</h2>
      <p>Carnet Patte enregistre tout dans votre navigateur. Si vous videz les données du navigateur
         ou changez de téléphone / d'ordinateur, elles disparaissent : pensez à faire un export de temps en temps.</p>
    </section>

    <section class="carte">
      <h2>⬇️ Exporter</h2>
      <p>Télécharge un fichier avec tous vos animaux, soins et pesées.</p>
      <div class="zone-boutons"><button class="bouton" data-act="exporter">Télécharger ma sauvegarde</button></div>
    </section>

    <section class="carte">
      <h2>⬆️ Importer</h2>
      <p>Charge un fichier d'export. <strong>Attention : cela remplace toutes les données actuelles.</strong></p>
      <div class="zone-boutons">
        <label class="bouton secondaire">Choisir un fichier…
          <input type="file" accept=".json,application/json" hidden data-fichier>
        </label>
      </div>
    </section>

    <section class="carte">
      <h2>🗑 Tout effacer</h2>
      <p>Supprime définitivement tous les animaux, soins et pesées de cet appareil.</p>
      <div class="zone-boutons"><button class="bouton danger" data-act="effacer">Tout effacer</button></div>
    </section>`;

  zone.addEventListener('click', async (e) => {
    const bouton = e.target.closest('[data-act]');
    if (!bouton) return;
    if (bouton.dataset.act === 'exporter') {
      const blob = new Blob([storage.exporter()], { type: 'application/json' });
      const lien = document.createElement('a');
      lien.href = URL.createObjectURL(blob);
      lien.download = `carnet-patte-${aujourdhui()}.json`;
      lien.click();
      URL.revokeObjectURL(lien.href);
      toast('Sauvegarde téléchargée');
    } else if (bouton.dataset.act === 'effacer') {
      if (await confirmer('Effacer toutes les données ? Pensez à faire un export avant : cette action est définitive.', 'Tout effacer')) {
        storage.toutEffacer();
        toast('Données effacées');
        rafraichir();
      }
    }
  });

  zone.querySelector('[data-fichier]').addEventListener('change', async (e) => {
    const fichier = e.target.files[0];
    e.target.value = '';
    if (!fichier) return;
    if (!await confirmer(`Importer « ${fichier.name} » ? Les données actuelles seront remplacées.`, 'Importer')) return;
    try {
      storage.importer(await fichier.text());
      toast('Données importées');
      location.hash = '#/animaux';
    } catch (err) {
      toast(err.message);
    }
  });
}
