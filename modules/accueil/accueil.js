// Accueil : bienvenue, résumé des animaux, raccourcis, rappels et activité récente.
// Cette page LIT les données (animaux, soins, pesées) mais ne les modifie jamais.

import * as storage from '../../js/storage.js';
import { icone } from '../../js/icons.js';
import { echapper, aujourdhui, formatDate, formatPoids } from '../../js/utils.js';
import { badge, carteStat, carteAnimal, vide, bouton } from '../../js/composants.js';
import { NAV } from '../../js/navigation.js';
import { rafraichir } from '../../js/router.js';
import { calculerRappels } from '../animaux/rappels.js';
import { formulaireAnimal } from '../animaux/animaux.js';
import { infosEspece, nomEspece, infosType, badgeEcheance, nomCourtSoin, titreSoin } from '../animaux/commun.js';

function ligne({ icone: i, titre, meta, fin = '', href }) {
  const corps = `
    <span class="cp-liste__icone">${icone(i, { taille: 20 })}</span>
    <div class="cp-liste__corps"><span class="cp-liste__titre">${echapper(titre)}</span><span class="cp-liste__meta">${echapper(meta)}</span></div>
    ${fin ? `<div class="cp-liste__fin">${fin}</div>` : ''}`;
  return href
    ? `<li><a class="cp-liste__ligne cp-liste__ligne--lien" href="${href}">${corps}</a></li>`
    : `<li class="cp-liste__ligne">${corps}</li>`;
}

/** Les modules à venir, réunis dans une seule carte (les pages restent accessibles depuis le menu). */
function blocBientot() {
  const modules = NAV.filter((n) => n.bientot);
  return `
    <section class="cp-carte pg-bientot" aria-labelledby="ac-bientot">
      <h2 class="pg-tuile__titre" id="ac-bientot">Bientôt sur Carnet Patte</h2>
      <ul class="pg-bientot__liste">
        ${modules.map((m) => `<li><a class="pg-bientot__lien" href="${m.href}">${icone(m.icone, { taille: 18 })}<span>${echapper(m.titre)}</span></a></li>`).join('')}
        <li><a class="pg-bientot__lien" href="#/bientot">${icone('compass', { taille: 18 })}<span>Et d'autres modules</span></a></li>
      </ul>
    </section>`;
}

export function rendre(zone) {
  zone.classList.add('page-large');
  const { prenom } = storage.lireProfil(); // facultatif : sans prénom, « Bonjour » tout court

  // Même ordre que la page Mes animaux : alphabétique
  const animaux = storage.lister('animaux').sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const parId = new Map(animaux.map((a) => [a.id, a]));
  const rappels = calculerRappels();
  const enRetard = rappels.filter((r) => r.statut.classe === 'retard');
  const retardParAnimal = new Map();
  enRetard.forEach((r) => retardParAnimal.set(r.animal.id, (retardParAnimal.get(r.animal.id) ?? 0) + 1));
  const prochain = rappels[0]; // le plus urgent : calculerRappels trie du plus en retard au plus lointain
  const libelleProchain = prochain?.statut.classe === 'retard' ? 'Rappel le plus urgent' : 'Prochain rappel';

  // Activité récente : derniers soins et dernières pesées déjà passés
  const auj = aujourdhui();
  const activite = [
    ...storage.lister('soins').filter((s) => s.date && s.date <= auj && parId.has(s.animalId)).map((s) => {
      const type = infosType(s.type);
      return { date: s.date, icone: type.icone, titre: titreSoin(s), animal: parId.get(s.animalId) };
    }),
    ...storage.lister('pesees').filter((p) => p.date && p.date <= auj && parId.has(p.animalId)).map((p) => (
      { date: p.date, icone: 'scale', titre: `Pesée : ${formatPoids(p.poidsKg)}`, animal: parId.get(p.animalId) })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);

  const blocAnimaux = animaux.length
    ? `<div class="pg-animaux">${animaux.slice(0, 4).map((a) => carteAnimal({
        id: a.id, nom: a.nom, espece: nomEspece(a), details: a.race, icone: infosEspece(a).icone, photo: a.photo?.startsWith('data:image/') ? a.photo : '',
        href: `#/animaux/${encodeURIComponent(a.id)}`,
        badges: retardParAnimal.has(a.id) ? badge({ texte: `${retardParAnimal.get(a.id)} rappel${retardParAnimal.get(a.id) > 1 ? 's' : ''} en retard`, variante: 'alerte', icone: 'bell-ring' }) : '',
      })).join('')}</div>`
    : `<div class="cp-carte">${vide({ icone: 'paw-print', titre: 'Aucun animal pour l\'instant', texte: 'Ajoutez votre premier compagnon pour suivre sa santé.', action: bouton({ texte: 'Ajouter un animal', icone: 'plus', href: '#/animaux' }) })}</div>`;

  const blocRappels = rappels.length
    ? `<ul class="cp-liste">${rappels.slice(0, 3).map((r) => ligne({
        icone: infosType(r.soin.type).icone,
        titre: `${nomCourtSoin(r.soin)} · ${r.animal.nom}`,
        meta: `Prévu le ${formatDate(r.soin.rappel)}`,
        fin: badgeEcheance(r.statut),
        href: '#/animaux/rappels',
      })).join('')}</ul>`
    : `<div class="cp-carte">${vide({ icone: 'circle-check', titre: 'Aucun rappel en attente', texte: 'Ajoutez une date de rappel quand vous notez un soin.' })}</div>`;

  const blocActivite = activite.length
    ? `<ul class="cp-liste">${activite.map((x) => ligne({
        icone: x.icone, titre: x.titre, meta: `${x.animal.nom} · ${formatDate(x.date)}`,
        href: `#/animaux/${encodeURIComponent(x.animal.id)}`,
      })).join('')}</ul>`
    : `<div class="cp-carte">${vide({ icone: 'calendar', titre: 'Pas encore d\'activité', texte: 'Vos derniers soins et pesées apparaîtront ici.' })}</div>`;

  zone.innerHTML = `
    <div class="cp pg">
      <header class="pg-entete pg-entete--accueil">
        <div>
          <h1>Bonjour${prenom ? ` ${echapper(prenom)}` : ''}</h1>
          <p>Voici un aperçu de vos animaux et de ce qui vous attend.</p>
        </div>
        ${bouton({ texte: 'Ajouter un animal', icone: 'plus', attrs: { 'data-act': 'ajouter' } })}
      </header>

      <section class="pg-section" aria-label="Résumé">
        <div class="pg-stats">
          ${carteStat({ libelle: animaux.length > 1 ? 'Animaux suivis' : 'Animal suivi', valeur: animaux.length, icone: 'paw-print' })}
          ${carteStat({ libelle: 'Rappels en retard', valeur: enRetard.length, icone: 'bell' })}
          ${carteStat({ libelle: libelleProchain, valeur: prochain ? prochain.statut.texte : 'Aucun', icone: prochain?.statut.classe === 'retard' ? 'bell-ring' : 'calendar',
            detail: prochain ? `${nomCourtSoin(prochain.soin)} · ${prochain.animal.nom}` : '' })}
        </div>
      </section>

      <section class="pg-section" aria-label="Modules à venir">
        <div class="pg-raccourcis pg-raccourcis--utiles">
          ${blocBientot()}
        </div>
      </section>

      <section class="pg-section" aria-labelledby="ac-animaux">
        <div class="pg-section__tete">
          <h2 id="ac-animaux">Mes animaux</h2>
          ${animaux.length ? `<a class="pg-lien" href="#/animaux">Tout voir ${icone('chevron-right', { taille: 16 })}</a>` : ''}
        </div>
        ${blocAnimaux}
      </section>

      <div class="pg-colonnes">
        <section class="pg-section" aria-labelledby="ac-rappels">
          <div class="pg-section__tete">
            <h2 id="ac-rappels">Rappels</h2>
            ${rappels.length ? `<a class="pg-lien" href="#/animaux/rappels">Tout voir ${icone('chevron-right', { taille: 16 })}</a>` : ''}
          </div>
          ${blocRappels}
        </section>
        <section class="pg-section" aria-labelledby="ac-activite">
          <div class="pg-section__tete"><h2 id="ac-activite">Activité récente</h2></div>
          ${blocActivite}
        </section>
      </div>
    </div>`;

  zone.querySelector('[data-act="ajouter"]').addEventListener('click', () => formulaireAnimal(null, rafraichir));
}
