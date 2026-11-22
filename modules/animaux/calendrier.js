// « Ajouter au calendrier » : transforme les rappels de soins en fichier .ics créé sur l'appareil (js/ics.js).
// Ce fichier ne modifie jamais les données : il les lit seulement.

import * as storage from '../../js/storage.js';
import { creerIcs, telechargerIcs } from '../../js/ics.js';
import { aujourdhui, formatDate, ajouterJours } from '../../js/utils.js';
import { toast } from '../../js/ui.js';
import { bouton } from '../../js/composants.js';
import { nomCourtSoin, titreSoin } from './commun.js';

export const PHRASE_DATE = 'Si vous changez la date dans Carnet Patte, ajoutez à nouveau le rappel au calendrier.';

const enRetard = (soin) => soin.rappel < aujourdhui();

/** « Vermifuge — Moka », et « Vermifuge — Moka (en retard) » si le rappel est déjà passé. */
export const titreEvenement = (soin, animal) => `${nomCourtSoin(soin)} — ${animal.nom}${enRetard(soin) ? ' (en retard)' : ''}`;

/** Le rappel prêt pour le fichier : titre, date, et une note avec le nom du soin (jamais les notes privées du soin). */
export function rappelPourCalendrier(soin, animal) {
  return {
    id: soin.id,
    titre: titreEvenement(soin, animal),
    description: `Soin : ${titreSoin(soin)}\nAnimal : ${animal.nom}\nRappel prévu le ${formatDate(soin.rappel)}${enRetard(soin) ? ' (en retard)' : ''}.\nCréé par Carnet Patte.`,
    // Un rappel déjà passé est placé DEMAIN : une alerte dans le passé ne sonnerait jamais
    date: enRetard(soin) ? ajouterJours(aujourdhui(), 1) : soin.rappel,
  };
}

const slug = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/**
 * « Ajouter au calendrier » d'un rappel en attente : un petit lien avec icône, toujours SOUS les boutons de la carte
 * (jamais dans leur rangée : à 375 px, trois boutons côte à côte se chevauchaient). Voir `.cal-lien` dans css/pages.css.
 */
export function boutonCalendrier(soin, animal) {
  return `<div class="cal-lien">${bouton({ texte: 'Ajouter au calendrier', icone: 'calendar-plus', variante: 'discret', taille: 's',
    attrs: { 'data-cal': soin.id, 'aria-label': `Ajouter au calendrier : ${titreEvenement(soin, animal)}` } })}</div>`;
}

/** Rappels à venir (aujourd'hui et après), pour « Tout ajouter ». */
export function rappelsAVenir() {
  const animaux = new Map(storage.lister('animaux').map((a) => [a.id, a]));
  return storage.lister('soins')
    .filter((s) => s.rappel && !s.rappelFait && s.rappel >= aujourdhui() && animaux.has(s.animalId))
    .sort((a, b) => a.rappel.localeCompare(b.rappel))
    .map((s) => rappelPourCalendrier(s, animaux.get(s.animalId)));
}

export function ajouterUn(soinId) {
  const soin = storage.trouver('soins', soinId);
  const animal = soin && storage.trouver('animaux', soin.animalId);
  if (!soin?.rappel || !animal) return false;
  const r = rappelPourCalendrier(soin, animal);
  telechargerIcs(`rappel-${slug(animal.nom) || 'animal'}-${slug(nomCourtSoin(soin)) || 'soin'}.ics`, creerIcs([r]));
  toast(`Fichier calendrier créé : ${r.titre}. ${PHRASE_DATE}`, 'info');
  return true;
}

export function ajouterTout() {
  const liste = rappelsAVenir();
  if (!liste.length) { toast('Aucun rappel à venir à ajouter.', 'info'); return 0; }
  telechargerIcs('carnet-patte-rappels.ics', creerIcs(liste));
  toast(`Fichier calendrier créé : ${liste.length} rappel${liste.length > 1 ? 's' : ''}. ${PHRASE_DATE}`, 'info');
  return liste.length;
}

/** Branche les boutons [data-cal] et [data-cal-tout] d'une page (un seul écouteur sur la zone). */
export function brancherCalendrier(zone) {
  zone.addEventListener('click', (e) => {
    const un = e.target.closest('[data-cal]');
    if (un) { ajouterUn(un.dataset.cal); return; }
    if (e.target.closest('[data-cal-tout]')) ajouterTout();
  });
}
