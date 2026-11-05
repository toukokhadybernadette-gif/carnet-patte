// Rappels : soins à refaire (en retard, cette semaine, plus tard) et rappels déjà effectués.

import * as storage from '../../js/storage.js';
import { echapper, formatDate } from '../../js/utils.js';
import { rafraichir } from '../../js/router.js';
import { icone } from '../../js/icons.js';
import { bouton, avatar, choix, selecteur, vide } from '../../js/composants.js';
import { infosType, infosEspece, statutRappel, ouvrirRappelFait, badgeSoin, libellesSoin, nomCourtSoin, titreSoin } from './commun.js';

/** Tous les rappels en attente, du plus urgent au plus lointain. */
export function calculerRappels() {
  const animaux = new Map(storage.lister('animaux').map((a) => [a.id, a]));
  return storage.lister('soins')
    .map((soin) => ({ soin, animal: animaux.get(soin.animalId), statut: statutRappel(soin) }))
    .filter((r) => r.statut && r.animal)
    .sort((a, b) => a.statut.jours - b.statut.jours);
}

export function compterEnRetard() {
  return calculerRappels().filter((r) => r.statut.classe === 'retard').length;
}

/** Petit résumé affiché en haut de la liste des animaux. */
export function resumeRappelsHtml() {
  const rappels = calculerRappels();
  if (!rappels.length) return '';
  const retard = rappels.filter((r) => r.statut.classe === 'retard').length;
  const semaine = rappels.filter((r) => r.statut.classe === 'semaine').length;
  const prochains = rappels.slice(0, 3).map((r) =>
    `<li><span class="pastille ${r.statut.classe}">${r.statut.texte}</span>
       ${echapper(nomCourtSoin(r.soin))} · ${echapper(r.animal.nom)}</li>`
  ).join('');
  return `
    <a class="carte resume-rappels" href="#/animaux/rappels">
      <h2 class="titre-icone">${icone('bell', { taille: 20 })} Rappels</h2>
      <p>
        ${retard ? `<strong class="texte-rouge">${retard} en retard</strong> · ` : ''}
        ${semaine} cette semaine · ${rappels.length} au total
      </p>
      <ul>${prochains}</ul>
    </a>`;
}

// ----- Page Rappels -----
// Tout ce qui suit ne fait qu'afficher : les seules écritures passent par ouvrirRappelFait() (commun.js).

const PAS_FAITS = 20; // rappels effectués affichés à la fois
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

// Filtres choisis : gardés pendant la visite, pour les retrouver après « Fait »
let filtre = { statut: 'a-faire', animal: '' };

const STATUTS = [
  { valeur: 'a-faire', texte: 'À faire' },
  { valeur: 'retard', texte: 'En retard' },
  { valeur: 'a-venir', texte: 'À venir' },
  { valeur: 'faits', texte: 'Effectués' },
];

// Groupes de cartes, et ceux affichés pour chaque filtre de statut
const GROUPES = {
  retard: { titre: 'En retard', icone: 'bell-ring' },
  semaine: { titre: 'Cette semaine', icone: 'clock' },
  'plus-tard': { titre: 'Plus tard', icone: 'calendar' },
  faits: { titre: 'Effectués', icone: 'circle-check' },
};
const GROUPES_PAR_STATUT = {
  'a-faire': ['retard', 'semaine', 'plus-tard'],
  retard: ['retard'],
  'a-venir': ['semaine', 'plus-tard'],
  faits: ['faits'],
};

/** Rappels déjà traités, le plus récent d'abord. Comme les rappels en attente : seulement pour des animaux existants. */
function calculerFaits() {
  const animaux = new Map(storage.lister('animaux').map((a) => [a.id, a]));
  return storage.lister('soins')
    .filter((s) => s.rappel && s.rappelFait && animaux.has(s.animalId))
    .map((soin) => ({ soin, animal: animaux.get(soin.animalId), statut: null }))
    .sort((a, b) => b.soin.rappel.localeCompare(a.soin.rappel));
}

const lienFiche = (animal) => `#/animaux/${encodeURIComponent(animal.id)}`;
const lienSoin = (soin, animal) => `${lienFiche(animal)}/soin/${encodeURIComponent(soin.id)}`;

function carteHtml({ soin, animal, statut }) {
  const type = infosType(soin.type);
  const { categorie, nom } = libellesSoin(soin);
  const photo = typeof animal.photo === 'string' && animal.photo.startsWith('data:image/') ? animal.photo : '';
  const quoi = `${titreSoin(soin)} pour ${animal.nom}`;
  return `
    <li class="cp-carte rp-carte rp-carte--${statut ? statut.classe : 'fait'}">
      <span class="rp-carte__icone" aria-hidden="true">${icone(type.icone, { taille: 24 })}</span>
      <div class="rp-carte__corps">
        ${nom ? `<span class="rp-carte__type">${echapper(categorie)}</span>` : ''}
        <div class="rp-carte__tete">
          <strong class="rp-carte__nom">${echapper(nom || categorie)}</strong>
          ${badgeSoin(soin)}
        </div>
        <a class="rp-animal" href="${lienFiche(animal)}">${avatar({ icone: infosEspece(animal).icone, photo })}<span>${echapper(animal.nom)}</span></a>
        <span class="rp-ligne">${icone(statut ? 'bell' : 'check', { taille: 16 })}<span>${statut ? 'Prévu le' : 'Rappel du'} <time datetime="${soin.rappel}">${formatDate(soin.rappel)}</time>${statut ? '' : ' · traité'}</span></span>
        <span class="rp-ligne">${icone('calendar', { taille: 16 })}<span>Dernier soin le <time datetime="${soin.date}">${formatDate(soin.date)}</time></span></span>
      </div>
      <div class="rp-carte__actions">
        ${statut ? bouton({ texte: 'Fait', icone: 'check', taille: 's', attrs: { 'data-fait': soin.id, 'aria-label': `Fait : ${quoi}` } }) : ''}
        ${bouton({ texte: 'Voir le soin', variante: 'secondaire', icone: 'chevron-right', taille: 's', href: lienSoin(soin, animal), attrs: { 'aria-label': `Voir le soin ${quoi}` } })}
      </div>
    </li>`;
}

function groupeHtml(cle, rappels, limite) {
  if (!rappels.length) return '';
  const g = GROUPES[cle];
  const visibles = cle === 'faits' ? rappels.slice(0, limite) : rappels;
  const reste = rappels.length - visibles.length;
  return `
    <section class="rp-groupe rp-groupe--${cle}" aria-labelledby="rp-groupe-${cle}">
      <h2 class="rp-groupe__titre" id="rp-groupe-${cle}">
        <span class="rp-groupe__icone" aria-hidden="true">${icone(g.icone, { taille: 18 })}</span>${g.titre}
        <span class="cp-compteur">${rappels.length}<span class="cp-sr"> ${rappels.length > 1 ? 'rappels' : 'rappel'}</span></span>
      </h2>
      <ul class="rp-liste">${visibles.map(carteHtml).join('')}</ul>
      ${reste > 0 ? bouton({ texte: `Afficher ${Math.min(reste, PAS_FAITS)} de plus (${reste} restants)`, variante: 'secondaire', attrs: { 'data-plus': true } }) : ''}
    </section>`;
}

function chiffreHtml({ libelle, valeur, icone: nomIcone, ton, sous }) {
  return `
    <div class="cp-carte cp-stat rp-chiffre rp-chiffre--${ton}" role="group" aria-label="${echapper(libelle)}">
      <div class="cp-stat__tete"><span>${echapper(libelle)}</span><span class="cp-stat__icone">${icone(nomIcone, { taille: 20 })}</span></div>
      <span class="cp-stat__valeur">${valeur}</span>
      <span class="rp-chiffre__sous">${echapper(sous)}</span>
    </div>`;
}

export function rendre(zone) {
  zone.classList.add('page-large');
  const enAttente = calculerRappels();
  const faits = calculerFaits();
  const tous = [...enAttente, ...faits];
  const parClasse = (c, liste) => liste.filter((r) => r.statut?.classe === c);

  // Animaux qui ont au moins un rappel (en attente ou traité), par ordre alphabétique
  const animaux = [...new Map(tous.map((r) => [r.animal.id, r.animal])).values()]
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  if (filtre.animal && !animaux.some((a) => a.id === filtre.animal)) filtre.animal = '';

  const retard = parClasse('retard', enAttente).length;
  const sousTitre = enAttente.length
    ? `${pluriel(enAttente.length, 'rappel')} à faire${retard ? `, dont ${retard} en retard` : ''}.`
    : faits.length ? 'Tout est à jour : aucun rappel en attente.' : 'Les soins à refaire, au bon moment.';
  const entete = `<header class="pg-entete"><h1 tabindex="-1">Rappels</h1><p>${sousTitre}</p></header>`;

  if (!tous.length) {
    zone.innerHTML = `
      <div class="cp pg rp-page">
        ${entete}
        <div class="cp-carte">${vide({
          niveau: 2, icone: 'bell', titre: 'Aucun rappel pour le moment',
          texte: 'Quand vous notez un soin (vaccin, vermifuge…), ajoutez une date de rappel : il apparaîtra ici.',
          action: bouton({ texte: 'Aller à mes animaux', icone: 'paw-print', href: '#/animaux' }),
        })}</div>
      </div>`;
    return;
  }

  zone.innerHTML = `
    <div class="cp pg rp-page">
      ${entete}

      <section class="rp-chiffres" aria-label="Résumé des rappels">
        ${chiffreHtml({ libelle: 'En retard', valeur: retard, icone: 'bell-ring', ton: 'retard', sous: retard ? 'À faire dès que possible' : 'Aucun retard' })}
        ${chiffreHtml({ libelle: 'Cette semaine', valeur: parClasse('semaine', enAttente).length, icone: 'clock', ton: 'semaine', sous: 'Sous 7 jours' })}
        ${chiffreHtml({ libelle: 'Plus tard', valeur: parClasse('plus-tard', enAttente).length, icone: 'calendar', ton: 'plus-tard', sous: 'Au-delà de 7 jours' })}
        ${chiffreHtml({ libelle: 'Effectués', valeur: faits.length, icone: 'circle-check', ton: 'faits', sous: 'Rappels déjà traités' })}
      </section>

      <div class="rp-outils">
        ${choix({ nom: 'rp-statut', legende: 'Afficher', valeur: filtre.statut, classe: 'rp-statuts', options: STATUTS })}
        ${animaux.length > 1 ? `<div class="rp-animaux">${selecteur({
          id: 'rp-animal', label: 'Animal', valeur: filtre.animal,
          options: [{ valeur: '', texte: 'Tous les animaux' }, ...animaux.map((a) => ({ valeur: a.id, texte: a.nom }))],
        })}</div>` : ''}
      </div>
      <p class="cp-sr" data-resultat role="status"></p>

      <div class="rp-groupes" data-groupes></div>
    </div>`;

  const zoneGroupes = zone.querySelector('[data-groupes]');
  const resultat = zone.querySelector('[data-resultat]');
  let limiteFaits = PAS_FAITS;

  // Nombre de rappels de chaque statut (pour l'animal choisi), affiché dans les pastilles
  const majCompteurs = (liste) => {
    const nb = {
      'a-faire': liste.filter((r) => r.statut).length,
      retard: parClasse('retard', liste).length,
      'a-venir': liste.filter((r) => r.statut && r.statut.classe !== 'retard').length,
      faits: liste.filter((r) => !r.statut).length,
    };
    zone.querySelectorAll('input[name="rp-statut"]').forEach((input) => {
      const etiquette = input.nextElementSibling;
      etiquette.querySelector('.rp-nombre')?.remove();
      etiquette.insertAdjacentHTML('beforeend', `<span class="rp-nombre">${nb[input.value]}</span>`);
    });
  };

  const afficher = () => {
    const liste = filtre.animal ? tous.filter((r) => r.animal.id === filtre.animal) : tous;
    majCompteurs(liste);
    const groupes = GROUPES_PAR_STATUT[filtre.statut].map((cle) => [cle, cle === 'faits' ? liste.filter((r) => !r.statut) : parClasse(cle, liste)]);
    const total = groupes.reduce((n, [, l]) => n + l.length, 0);
    const animal = animaux.find((a) => a.id === filtre.animal);
    const filtreActif = filtre.statut !== 'a-faire' || filtre.animal;

    zoneGroupes.innerHTML = total
      ? groupes.map(([cle, l]) => groupeHtml(cle, l, limiteFaits)).join('')
      : `<div class="cp-carte">${vide({
        niveau: 2,
        icone: filtre.statut === 'faits' ? 'bell' : 'circle-check',
        titre: { faits: 'Aucun rappel effectué', retard: 'Aucun rappel en retard', 'a-venir': 'Aucun rappel à venir' }[filtre.statut] ?? 'Aucun rappel à faire',
        texte: `${animal ? `Pour ${animal.nom}. ` : ''}${filtre.statut === 'faits' ? 'Les rappels marqués « Fait » apparaîtront ici.' : 'Tout est à jour.'}`,
        action: filtreActif ? bouton({ texte: 'Voir tous les rappels à faire', variante: 'secondaire', attrs: { 'data-reinitialiser': true } }) : '',
      })}</div>`;
    const libelle = STATUTS.find((s) => s.valeur === filtre.statut).texte.toLowerCase();
    resultat.textContent = `${pluriel(total, 'rappel')} affiché${total > 1 ? 's' : ''} : ${libelle}${animal ? `, ${animal.nom}` : ''}`;
  };
  afficher();

  zone.querySelector('.rp-statuts').addEventListener('change', (e) => {
    filtre.statut = e.target.value;
    limiteFaits = PAS_FAITS;
    afficher();
  });
  zone.querySelector('#rp-animal')?.addEventListener('change', (e) => {
    filtre.animal = e.target.value;
    afficher();
  });

  zone.addEventListener('click', (e) => {
    if (e.target.closest('[data-reinitialiser]')) {
      filtre = { statut: 'a-faire', animal: '' };
      const sel = zone.querySelector('#rp-animal');
      if (sel) sel.value = '';
      const radio = zone.querySelector('input[name="rp-statut"][value="a-faire"]');
      radio.checked = true;
      afficher();
      radio.focus();
      return;
    }
    if (e.target.closest('[data-plus]')) {
      const deja = zoneGroupes.querySelectorAll('.rp-groupe--faits .rp-carte').length;
      limiteFaits += PAS_FAITS;
      afficher();
      // le focus va sur le premier rappel ajouté, pour continuer la lecture là où on en était
      zoneGroupes.querySelectorAll('.rp-groupe--faits .rp-carte')[deja]?.querySelector('a')?.focus();
      return;
    }
    const declencheur = e.target.closest('[data-fait]');
    const soin = declencheur && storage.trouver('soins', declencheur.dataset.fait);
    if (soin) {
      ouvrirRappelFait(soin, () => {
        rafraichir();
        // la page est reconstruite : le focus revient au titre au lieu de se perdre en haut du document
        document.querySelector('.rp-page h1')?.focus();
      });
    }
  });
}
