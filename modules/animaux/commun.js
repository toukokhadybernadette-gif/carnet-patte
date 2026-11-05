// Éléments partagés par les fichiers du module « animaux ».

import * as storage from '../../js/storage.js';
import { echapper, aujourdhui, joursEntre, ajouterMois, formatDate } from '../../js/utils.js';
import { modale, toast } from '../../js/ui.js';
import { icone } from '../../js/icons.js';
import { bouton, badge, champ, choix } from '../../js/composants.js';

// ----- Espèces proposées dans le formulaire -----
// `icone` : nom d'une icône Lucide (js/icons.js) ou d'une icône sur mesure (js/icons-especes.js).
// Pour ajouter une espèce : une ligne ici + son dessin dans js/icons-especes.js. L'espèce « Autre » (et toute espèce
// inconnue, par exemple venue d'un fichier d'une version future) affiche la patte, symbole de Carnet Patte.
export const ESPECES = [
  { id: 'chien', nom: 'Chien', icone: 'dog' },
  { id: 'chat', nom: 'Chat', icone: 'cat' },
  { id: 'lapin', nom: 'Lapin', icone: 'rabbit' },
  { id: 'cochon-inde', nom: "Cochon d'Inde", icone: 'cochon-inde' },
  { id: 'hamster', nom: 'Hamster', icone: 'hamster' },
  { id: 'furet', nom: 'Furet', icone: 'furet' },
  { id: 'oiseau', nom: 'Oiseau', icone: 'bird' },
  { id: 'poule', nom: 'Poule', icone: 'poule' },
  { id: 'canard', nom: 'Canard', icone: 'canard' },
  { id: 'chevre', nom: 'Chèvre', icone: 'chevre' },
  { id: 'mouton', nom: 'Mouton', icone: 'mouton' },
  { id: 'cheval', nom: 'Cheval', icone: 'cheval' },
  { id: 'ane', nom: 'Âne', icone: 'ane' },
  { id: 'vache', nom: 'Vache', icone: 'vache' },
  { id: 'cochon', nom: 'Cochon', icone: 'cochon' },
  { id: 'tortue', nom: 'Tortue', icone: 'turtle' },
  { id: 'poisson', nom: 'Poisson', icone: 'fish' },
  { id: 'autre', nom: 'Autre', icone: 'paw-print' },
];

export function infosEspece(animal) {
  return ESPECES.find((e) => e.id === animal.espece) ?? ESPECES[ESPECES.length - 1];
}

/** Nom de l'espèce à afficher ("Autre" → ce que l'utilisateur a tapé). */
export function nomEspece(animal) {
  if (animal.espece === 'autre') return animal.especeAutre?.trim() || 'Autre';
  return infosEspece(animal).nom;
}

/** Photo de l'animal, ou à défaut l'icône de son espèce. */
export function avatarHtml(animal, classe = '') {
  const photo = animal.photo;
  if (typeof photo === 'string' && photo.startsWith('data:image/')) {
    return `<img class="avatar ${classe}" src="${echapper(photo)}" alt="">`;
  }
  return `<div class="avatar ${classe}" aria-hidden="true">${icone(infosEspece(animal).icone, { taille: classe.includes('grand') ? 44 : 30 })}</div>`;
}

/** Affiche (ou efface, si `message` est vide) l'erreur sous un champ, reliée au champ pour les lecteurs d'écran. */
export function erreurChamp(input, message) {
  const bloc = input.closest('.cp-champ');
  bloc.querySelector('.cp-champ__erreur')?.remove();
  if (!message) {
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
    return;
  }
  const id = `${input.id}-erreur`;
  bloc.insertAdjacentHTML('beforeend',
    `<p class="cp-champ__erreur" id="${id}">${icone('circle-alert', { taille: 16 })}<span>${echapper(message)}</span></p>`);
  input.setAttribute('aria-invalid', 'true');
  input.setAttribute('aria-describedby', id);
}

// ----- Types de soins -----
export const TYPES_SOIN = [
  { id: 'vaccin', nom: 'Vaccin', icone: 'syringe' },
  { id: 'vermifuge', nom: 'Vermifuge', icone: 'pill' },
  { id: 'antiparasitaire', nom: 'Antiparasitaire', icone: 'bug' },
  { id: 'veto', nom: 'Visite véto', icone: 'stethoscope' },
  { id: 'autre', nom: 'Autre soin', icone: 'bandage' },
];

export function infosType(id) {
  return TYPES_SOIN.find((t) => t.id === id) ?? TYPES_SOIN[TYPES_SOIN.length - 1];
}

// ----- Rappels -----

/**
 * État du rappel d'un soin. Retourne null s'il n'y a pas de rappel à venir (ou s'il est déjà traité).
 * classe : 'retard' (date passée), 'semaine' (dans 7 jours ou moins), 'plus-tard'.
 */
export function statutRappel(soin) {
  if (!soin.rappel || soin.rappelFait) return null;
  const jours = joursEntre(aujourdhui(), soin.rappel);
  let texte;
  if (jours < 0) texte = `En retard de ${-jours} j`;
  else if (jours === 0) texte = "Aujourd'hui";
  else if (jours === 1) texte = 'Demain';
  else texte = `Dans ${jours} j`;
  const classe = jours < 0 ? 'retard' : jours <= 7 ? 'semaine' : 'plus-tard';
  return { jours, classe, texte };
}

// ----- Une seule règle de couleur pour les échéances, sur toutes les pages -----
// rouge : en retard · ambre : cette semaine (7 jours ou moins) · vert : plus tard (au-delà de 7 jours)
export const VARIANTE_ECHEANCE = { retard: 'alerte', semaine: 'attention', 'plus-tard': 'succes' };

/** Badge d'échéance d'un rappel en attente. `statut` vient de statutRappel() ; `texte` remplace le texte par défaut. */
export function badgeEcheance(statut, texte = statut.texte) {
  return badge({ texte, variante: VARIANTE_ECHEANCE[statut.classe], icone: statut.classe === 'retard' ? 'bell-ring' : 'bell' });
}

/** Badge de statut d'un soin : effectué, à venir ou en retard (HTML). */
export function badgeSoin(soin) {
  const statut = statutRappel(soin);
  if (statut) return badgeEcheance(statut, statut.classe === 'retard' ? statut.texte : `À venir · ${statut.texte.toLowerCase()}`);
  if (soin.rappel) return badge({ texte: 'Effectué', variante: 'succes', icone: 'circle-check' });
  if (soin.date > aujourdhui()) return badge({ texte: 'À venir', variante: 'info', icone: 'calendar' });
  return badge({ texte: 'Effectué', variante: 'succes', icone: 'circle-check' });
}

// ----- Noms d'un soin -----
const comparable = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * Catégorie (type de soin) et nom précis d'un soin. `nom` vaut '' quand le soin n'a pas de nom à lui
 * ou que son nom répète la catégorie (ex. un vermifuge nommé « Vermifuge ») : on n'affiche alors pas deux fois le même mot.
 */
export function libellesSoin(soin) {
  const categorie = infosType(soin.type).nom;
  const titre = String(soin.titre ?? '').trim();
  return { categorie, nom: titre && comparable(titre) !== comparable(categorie) ? titre : '' };
}

/** Nom court d'un soin pour une ligne de résumé : son nom précis, sinon sa catégorie (« Pipette », « Vermifuge »). */
export function nomCourtSoin(soin) {
  const { categorie, nom } = libellesSoin(soin);
  return nom || categorie;
}

/**
 * Fenêtre « Marquer le rappel comme fait ».
 * Le soin d'origine n'est pas modifié : seul son rappel passe à « traité ». Si on programme la suite,
 * un NOUVEAU soin est ajouté (daté d'aujourd'hui, avec son propre rappel). La fenêtre dit précisément ce qui va se passer.
 */
export function ouvrirRappelFait(soin, apres) {
  const type = infosType(soin.type);
  const titre = [type.nom, soin.titre].filter(Boolean).join(' — ');
  const DELAIS = [
    { valeur: '0', texte: 'Non' }, { valeur: '1', texte: '1 mois' }, { valeur: '3', texte: '3 mois' },
    { valeur: '6', texte: '6 mois' }, { valeur: '12', texte: '1 an' }, { valeur: 'date', texte: 'Autre date' },
  ];
  const html = `
    <form class="cp-formulaire rf-form" novalidate>
      <div class="rf-resume">
        <span class="rf-resume__icone">${icone(type.icone, { taille: 22 })}</span>
        <div class="rf-resume__texte">
          <strong>${echapper(titre)}</strong>
          <span>Rappel prévu le ${formatDate(soin.rappel)}</span>
        </div>
        ${badgeSoin(soin)}
      </div>
      ${choix({ nom: 'delai', legende: 'Programmer le prochain rappel', valeur: '0', classe: 'rf-delais',
        options: DELAIS })}
      <div class="rf-date" hidden>
        ${champ({ id: 'rf-date', label: 'Date du prochain rappel', type: 'date', attrs: { name: 'dateRappel', min: aujourdhui() } })}
      </div>
      <p class="rf-consequence" data-consequence role="status"></p>
      <div class="rf-actions">
        ${bouton({ texte: 'Annuler', variante: 'secondaire', attrs: { 'data-annuler': true } })}
        ${bouton({ texte: "C'est fait", type: 'submit', icone: 'check' })}
      </div>
    </form>`;
  modale('Rappel effectué', html, (dlg) => {
    const form = dlg.querySelector('form');
    const consequence = dlg.querySelector('[data-consequence]');
    const blocDate = dlg.querySelector('.rf-date');
    const champDate = form.dateRappel;
    /** Date du prochain rappel choisie, '' si aucune (ou si « Autre date » n'est pas encore remplie). */
    const prochain = () => {
      const delai = new FormData(form).get('delai');
      if (delai === 'date') return champDate.value;
      return Number(delai) > 0 ? ajouterMois(aujourdhui(), Number(delai)) : '';
    };
    const majConsequence = () => {
      const date = prochain() >= aujourdhui() ? prochain() : '';
      blocDate.hidden = new FormData(form).get('delai') !== 'date';
      consequence.textContent = date
        ? `Ce rappel sera marqué comme traité. Un nouveau soin « ${titre} » sera ajouté à la date d'aujourd'hui, avec un rappel le ${formatDate(date)}. Le soin d'origine ne change pas.`
        : blocDate.hidden
          ? 'Ce rappel sera marqué comme traité. Aucune autre information ne sera modifiée.'
          : 'Choisissez la date du prochain rappel.';
    };
    majConsequence();
    form.addEventListener('change', (e) => {
      majConsequence();
      if (e.target.name === 'delai' && e.target.value === 'date' && !matchMedia('(pointer: coarse)').matches) champDate.focus();
    });
    form.addEventListener('input', (e) => { if (e.target === champDate) { erreurChamp(champDate, ''); majConsequence(); } });
    dlg.querySelector('[data-annuler]').addEventListener('click', () => dlg.close());
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const aDate = !blocDate.hidden;
      const date = prochain();
      erreurChamp(champDate, '');
      if (aDate && (!date || date < aujourdhui())) {
        erreurChamp(champDate, date ? 'Choisissez une date à partir d’aujourd’hui.' : 'Indiquez la date du prochain rappel, ou choisissez « Non ».');
        champDate.focus();
        return;
      }
      storage.modifier('soins', soin.id, { rappelFait: true });
      if (date) {
        storage.ajouter('soins', {
          animalId: soin.animalId,
          type: soin.type,
          titre: soin.titre,
          date: aujourdhui(),
          notes: '',
          rappel: date,
          rappelFait: false,
        });
      }
      dlg.close();
      toast(date ? `Rappel fait · prochain rappel le ${formatDate(date)}` : 'Rappel marqué comme fait');
      apres();
    });
  });
}
