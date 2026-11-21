// Boutique : la sélection Carnet Patte. Des accessoires du quotidien, avec un lien vers un site marchand (Carnet Patte ne vend rien).
// Rangement par espèce (« Pour qui ? ») et par besoin (« Pour quoi ? »), en pastilles comme sur la Carte.
// Adresse : #/boutique, #/boutique/chien (espèce choisie d'avance), #/boutique/chien/jouets (espèce et besoin).

import { echapper } from '../../js/utils.js';
import { icone } from '../../js/icons.js';
import { vide, bouton } from '../../js/composants.js';
import { ESPECES_TOXIQUE } from '../toxique/donnees.js';
import { PRODUITS, BESOINS } from './produits.js';
import { carteProduit, mentionHtml } from './blocs.js';

const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;

export function rendre(zone, segments = []) {
  zone.classList.add('page-large');
  const especes = ESPECES_TOXIQUE.filter((g) => PRODUITS.some((p) => p.especes.includes(g.id)));
  const etat = {
    espece: especes.some((g) => g.id === segments[0]) ? segments[0] : 'toutes',
    besoin: BESOINS.some((b) => b.id === segments[1]) ? segments[1] : 'tous',
  };

  zone.innerHTML = `
    <div class="cp pg pg--boutique">
      <header class="pg-entete">
        <h1 tabindex="-1">Boutique</h1>
        <p>Notre sélection d'accessoires du quotidien pour vos animaux. Carnet Patte ne vend rien : chaque bouton vous mène chez un site marchand.</p>
      </header>

      ${mentionHtml()}

      <section class="pg-section bq-outils" aria-labelledby="bq-filtres-titre">
        <h2 id="bq-filtres-titre" class="cp-sr">Filtres</h2>
        <div class="bq-groupe">
          <p class="bq-groupe__titre" id="bq-t-espece">Pour qui ?</p>
          <div class="cp-filtres bq-filtres" role="group" aria-labelledby="bq-t-espece" data-filtre="espece" id="bq-espece"></div>
        </div>
        <div class="bq-groupe">
          <p class="bq-groupe__titre" id="bq-t-besoin">Pour quoi ?</p>
          <div class="cp-filtres bq-filtres" role="group" aria-labelledby="bq-t-besoin" data-filtre="besoin" id="bq-besoin"></div>
        </div>
        <p class="bq-resultat" id="bq-resultat" role="status"></p>
      </section>

      <section class="pg-section" aria-label="Produits">
        <ul class="bq-liste" id="bq-liste"></ul>
        <div id="bq-aucun" hidden>${vide({ niveau: 2, icone: 'shopping-bag', titre: 'Aucun produit pour cette combinaison',
          texte: "Essayez un autre besoin ou une autre espèce.", action: bouton({ texte: 'Tout afficher', variante: 'secondaire', attrs: { id: 'bq-reinit', class: 'cp-btn cp-btn--secondaire' } }) })}</div>
      </section>

      <footer class="bq-pied">
        <p>Cette sélection ne contient ni médicament, ni antiparasitaire, ni complément de santé : pour la santé de votre animal, demandez conseil à votre vétérinaire.</p>
        <p>Les sites marchands fixent leurs prix et leurs stocks : le bouton « Voir le prix » ouvre la page correspondante dans un nouvel onglet.</p>
      </footer>
    </div>`;

  const elEspece = zone.querySelector('#bq-espece');
  const elBesoin = zone.querySelector('#bq-besoin');
  const elListe = zone.querySelector('#bq-liste');
  const elAucun = zone.querySelector('#bq-aucun');
  const elResultat = zone.querySelector('#bq-resultat');

  const correspond = (p, e, b) => (e === 'toutes' || p.especes.includes(e)) && (b === 'tous' || p.categorie === b);

  const pastille = (valeur, texte, nombre, actif, nomIcone) =>
    `<button type="button" class="cp-filtre bq-filtre" aria-pressed="${actif}" data-valeur="${echapper(valeur)}"${nombre === 0 && !actif ? ' disabled' : ''}>${nomIcone ? icone(nomIcone, { taille: 16 }) : ''}${echapper(texte)} <span class="cp-filtre__nombre">${nombre}</span></button>`;

  function afficher() {
    // Les nombres tiennent compte de l'AUTRE filtre : on ne propose jamais une pastille qui donnerait « aucun produit » sans le dire
    elEspece.innerHTML = pastille('toutes', 'Toutes', PRODUITS.filter((p) => correspond(p, 'toutes', etat.besoin)).length, etat.espece === 'toutes')
      + especes.map((g) => pastille(g.id, g.nom, PRODUITS.filter((p) => correspond(p, g.id, etat.besoin)).length, etat.espece === g.id, g.icone)).join('');
    elBesoin.innerHTML = pastille('tous', 'Tous', PRODUITS.filter((p) => correspond(p, etat.espece, 'tous')).length, etat.besoin === 'tous')
      + BESOINS.map((b) => pastille(b.id, b.court, PRODUITS.filter((p) => correspond(p, etat.espece, b.id)).length, etat.besoin === b.id, b.icone)).join('');
    const produits = PRODUITS.filter((p) => correspond(p, etat.espece, etat.besoin));
    elListe.innerHTML = produits.map(carteProduit).join('');
    elListe.hidden = !produits.length;
    elAucun.hidden = produits.length > 0;
    const g = especes.find((x) => x.id === etat.espece);
    const b = BESOINS.find((x) => x.id === etat.besoin);
    elResultat.textContent = `${pluriel(produits.length, 'produit', 'produits')}${g ? ` pour ${g.nom.toLowerCase()}` : ''}${b ? ` · ${b.nom.toLowerCase()}` : ''}.`;
  }

  zone.addEventListener('click', (e) => {
    const f = e.target.closest('.bq-filtre');
    if (f) {
      const type = f.closest('[data-filtre]').dataset.filtre;
      etat[type] = f.dataset.valeur;
      afficher();
      // la rangée est reconstruite : on rend le focus à la même pastille
      zone.querySelector(`[data-filtre="${type}"] [data-valeur="${CSS.escape(f.dataset.valeur)}"]`)?.focus({ preventScroll: true });
      return;
    }
    if (e.target.closest('#bq-reinit')) { etat.espece = 'toutes'; etat.besoin = 'tous'; afficher(); }
  });

  afficher();
}
