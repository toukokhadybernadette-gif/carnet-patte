// Écran affiché à la place de l'appli quand les données enregistrées dans le navigateur sont illisibles.
// Principe : ne RIEN effacer ni remplacer. js/storage.js a gardé le texte brut, en a fait une copie de secours
// dans une autre clé, et n'écrit plus rien tant que l'utilisateur n'a pas choisi l'une des actions ci-dessous.

import * as storage from './storage.js';
import { aujourdhui } from './utils.js';
import { alerte, bouton, confirmer, notifier } from './composants.js';

const EXPLICATIONS = {
  illisible: "Le texte enregistré dans ce navigateur est abîmé : il ne peut pas être lu comme des données de Carnet Patte.",
  invalide: "Les données enregistrées dans ce navigateur n'ont pas la forme attendue.",
  recente: "Ces données ont été enregistrées par une version plus récente de Carnet Patte que celle-ci. Les modifier risquerait d'en perdre une partie.",
};

export function afficherSecours(etat) {
  document.getElementById('app').hidden = true;
  const racine = document.createElement('main');
  racine.className = 'cp secours';
  racine.id = 'secours';
  racine.innerHTML = `
    <div class="secours__contenu">
      <h1>Vos données n'ont pas pu être lues</h1>
      ${alerte({ type: 'attention', titre: 'Rien n\'a été effacé ni modifié.', texte: `${EXPLICATIONS[etat.raison] ?? EXPLICATIONS.invalide} Carnet Patte n'écrit plus rien tant que vous n'avez pas choisi ce qu'il faut faire.` })}
      ${etat.cleSecours
        ? alerte({ type: 'info', texte: `Une copie de secours a été gardée dans ce navigateur (clé « ${etat.cleSecours} »).` })
        : alerte({ type: 'erreur', titre: 'Copie de secours impossible.', texte: "L'espace du navigateur est plein : téléchargez les données brutes ci-dessous avant toute autre action." })}
      <ol class="secours__etapes">
        <li><strong>Téléchargez les données brutes</strong> : un fichier texte avec exactement ce qui est enregistré. Gardez-le : il peut permettre de tout récupérer.</li>
        <li>Si vous avez une sauvegarde (un export de Carnet Patte), <strong>importez-la</strong>.</li>
        <li>Sinon, vous pouvez <strong>repartir de zéro</strong>. La copie de secours reste dans le navigateur.</li>
      </ol>
      <div class="secours__actions">
        ${bouton({ texte: 'Télécharger les données brutes', icone: 'download', attrs: { 'data-act': 'telecharger' } })}
        ${bouton({ texte: 'Importer une sauvegarde…', variante: 'secondaire', icone: 'upload', attrs: { 'data-act': 'choisir' } })}
        ${bouton({ texte: 'Recharger la page', variante: 'secondaire', attrs: { 'data-act': 'recharger' } })}
        ${bouton({ texte: 'Repartir de zéro', variante: 'danger', icone: 'trash-2', attrs: { 'data-act': 'zero' } })}
        <input type="file" accept=".json,application/json,text/plain" hidden data-fichier aria-label="Fichier de sauvegarde à importer">
      </div>
    </div>`;
  document.body.prepend(racine);
  document.title = 'Données illisibles · Carnet Patte';
  racine.querySelector('h1').tabIndex = -1;
  racine.querySelector('h1').focus();

  racine.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'telecharger') {
      const lien = document.createElement('a');
      lien.href = URL.createObjectURL(new Blob([storage.donneesBrutes()], { type: 'text/plain' }));
      lien.download = `carnet-patte-donnees-brutes-${aujourdhui()}.txt`;
      lien.click();
      URL.revokeObjectURL(lien.href);
      notifier('Données brutes téléchargées');
    } else if (act === 'choisir') {
      racine.querySelector('[data-fichier]').click();
    } else if (act === 'recharger') {
      location.reload();
    } else if (act === 'zero') {
      const ok = await confirmer({
        titre: 'Repartir de zéro ?',
        message: etat.cleSecours
          ? 'Carnet Patte repart avec des données vides. La copie de secours reste dans le navigateur, mais vous ne la verrez plus dans l\'appli.'
          : "Aucune copie de secours n'a pu être faite : les données actuelles seront perdues. Avez-vous téléchargé les données brutes ?",
        libelle: 'Repartir de zéro',
      });
      if (ok) { storage.repartirDeZero(); location.hash = '#/accueil'; location.reload(); }
    }
  });

  racine.querySelector('[data-fichier]').addEventListener('change', async (e) => {
    const fichier = e.target.files[0];
    e.target.value = '';
    if (!fichier) return;
    try {
      storage.importer(await fichier.text());
      location.hash = '#/animaux';
      location.reload();
    } catch (err) {
      notifier(err.message, { type: 'erreur' });
    }
  });
}
