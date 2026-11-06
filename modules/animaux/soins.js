// Soins d'un animal : vaccins, vermifuges, visites... avec une date de rappel facultative.

import * as storage from '../../js/storage.js';
import { echapper, aujourdhui, formatDate } from '../../js/utils.js';
import { modale, confirmer, toast } from '../../js/ui.js';
import { icone } from '../../js/icons.js';
import { bouton, champ, choix, vide } from '../../js/composants.js';
import { TYPES_SOIN, classeType, infosType, statutRappel, ouvrirRappelFait, badgeSoin, erreurChamp, libellesSoin } from './commun.js';

function formulaireSoin(animal, soin, apres) {
  const s = soin ?? { type: 'vaccin', titre: '', date: aujourdhui(), notes: '', rappel: '' };
  const typeInitial = TYPES_SOIN.some((t) => t.id === s.type) ? s.type : 'autre';
  const rappelTraite = Boolean(soin && soin.rappel && soin.rappelFait);

  const html = `
    <form class="cp-formulaire sn-form" novalidate>
      ${choix({ nom: 'type', legende: 'Type de soin', valeur: typeInitial, classe: 'cp-choix--tuiles',
        options: TYPES_SOIN.map((t) => ({ valeur: t.id, texte: t.nom, icone: t.icone, classe: classeType(t.id) })) })}
      ${champ({ id: 'soin-titre', label: 'Nom du soin (facultatif)', valeur: s.titre ?? '', placeholder: 'Ex. : Rage, Frontline…', attrs: { name: 'titre', maxlength: 60, autocomplete: 'off' } })}
      ${champ({ id: 'soin-date', label: 'Date du soin', type: 'date', valeur: s.date ?? '', requis: true, attrs: { name: 'date' } })}
      ${champ({ id: 'soin-notes', label: 'Note (facultatif)', type: 'textarea', valeur: s.notes ?? '', attrs: { name: 'notes', maxlength: 500, rows: 3 } })}
      <fieldset class="sn-rappel-champ">
        <legend>Prochain rappel</legend>
        ${champ({ id: 'soin-rappel', label: 'Date du rappel (facultatif)', type: 'date', valeur: s.rappel ?? '',
          aide: rappelTraite
            ? 'Ce rappel est déjà traité. Changer la date le remettra « à faire ».'
            : 'Le rappel apparaîtra dans la page Rappels et sur la fiche de l’animal.',
          attrs: { name: 'rappel' } })}
      </fieldset>
      <div class="sn-form__actions">
        ${bouton({ texte: 'Annuler', variante: 'secondaire', attrs: { 'data-annuler': true } })}
        ${bouton({ texte: 'Enregistrer', type: 'submit', icone: 'check' })}
      </div>
    </form>`;

  modale(soin ? 'Modifier le soin' : `Nouveau soin pour ${animal.nom}`, html, (dlg) => {
    const form = dlg.querySelector('form');
    dlg.querySelector('[data-annuler]').addEventListener('click', () => dlg.close());
    form.addEventListener('input', (e) => { if (e.target.getAttribute('aria-invalid')) erreurChamp(e.target, ''); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const champs = {
        type: f.get('type'),
        titre: f.get('titre').trim(),
        date: f.get('date'),
        notes: f.get('notes').trim(),
        rappel: f.get('rappel') || '',
      };
      form.querySelectorAll('[aria-invalid]').forEach((c) => erreurChamp(c, ''));
      if (!champs.date) {
        erreurChamp(form.date, 'Indiquez la date du soin.');
        form.date.focus();
        return;
      }
      if (soin) {
        // Si la date de rappel change, le rappel redevient « à faire »
        const rappelFait = champs.rappel === soin.rappel ? soin.rappelFait : false;
        storage.modifier('soins', soin.id, { ...champs, rappelFait });
      } else {
        storage.ajouter('soins', { animalId: animal.id, ...champs, rappelFait: false });
      }
      dlg.close();
      toast(soin ? 'Soin modifié' : 'Soin ajouté');
      apres();
    });
  });
}

function carteHtml(soin) {
  const type = infosType(soin.type);
  const statut = statutRappel(soin);
  const { categorie, nom: nomPrecis } = libellesSoin(soin);
  const nom = nomPrecis || categorie; // pour les noms des boutons

  let rappel = '';
  if (statut) {
    rappel = `<span class="sn-ligne">${icone('bell', { taille: 16 })}<span>Prochain rappel le <time datetime="${soin.rappel}">${formatDate(soin.rappel)}</time></span></span>`;
  } else if (soin.rappel) {
    rappel = `<span class="sn-ligne">${icone('check', { taille: 16 })}<span>Rappel du <time datetime="${soin.rappel}">${formatDate(soin.rappel)}</time> traité</span></span>`;
  }

  return `
    <li class="cp-carte sn-carte ${classeType(soin.type)}" data-soin="${echapper(soin.id)}">
      <span class="sn-carte__icone" aria-hidden="true">${icone(type.icone, { taille: 24 })}</span>
      <div class="sn-carte__corps">
        ${nomPrecis ? `<span class="sn-carte__type">${echapper(categorie)}</span>` : ''}
        <div class="sn-carte__tete">
          <strong class="sn-carte__nom">${echapper(nom)}</strong>
          ${badgeSoin(soin)}
        </div>
        <span class="sn-ligne">${icone('calendar', { taille: 16 })}<span>Soin du <time datetime="${soin.date}">${formatDate(soin.date)}</time></span></span>
        ${rappel}
        ${soin.notes ? `<p class="sn-carte__notes">${echapper(soin.notes)}</p>` : ''}
      </div>
      <div class="sn-carte__actions">
        ${statut ? bouton({ texte: 'Fait', icone: 'check', taille: 's', attrs: { 'data-act': 'fait', 'data-id': soin.id, 'aria-label': `Marquer le rappel « ${nom} » comme fait` } }) : ''}
        ${bouton({ variante: 'secondaire', taille: 's', seul: true, icone: 'pencil', titre: `Modifier ${nom}`, attrs: { 'data-act': 'modifier', 'data-id': soin.id } })}
        ${bouton({ variante: 'secondaire', taille: 's', seul: true, icone: 'trash-2', titre: `Supprimer ${nom}`, attrs: { 'data-act': 'supprimer', 'data-id': soin.id } })}
      </div>
    </li>`;
}

/** Affiche la section « Soins » dans `zone`. Se réaffiche toute seule après chaque modification. */
export function rendre(zone, animal) {
  const section = document.createElement('section');
  section.className = 'sn';
  zone.replaceChildren(section);

  const soins = storage.lister('soins')
    .filter((s) => s.animalId === animal.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const rerendre = () => rendre(zone, animal);

  section.innerHTML = `
    <div class="sn-entete">
      <h2>Soins et traitements</h2>
      ${bouton({ texte: 'Ajouter un soin', icone: 'plus', taille: 's', attrs: { 'data-act': 'ajouter' } })}
    </div>
    ${soins.length
      ? `<ul class="sn-liste">${soins.map(carteHtml).join('')}</ul>`
      : `<div class="cp-carte">${vide({
        niveau: 3, icone: 'stethoscope', titre: "Aucun soin noté pour l'instant",
        texte: 'Vaccins, vermifuges, visites chez le vétérinaire… notez-les ici pour ne rien oublier.',
        action: bouton({ texte: 'Ajouter un soin', icone: 'plus', attrs: { 'data-act': 'ajouter' } }),
      })}</div>`}`;

  section.addEventListener('click', async (e) => {
    const declencheur = e.target.closest('[data-act]');
    if (!declencheur) return;
    const soin = declencheur.dataset.id ? storage.trouver('soins', declencheur.dataset.id) : null;

    switch (declencheur.dataset.act) {
      case 'ajouter': formulaireSoin(animal, null, rerendre); break;
      case 'modifier': if (soin) formulaireSoin(animal, soin, rerendre); break;
      case 'fait': if (soin) ouvrirRappelFait(soin, rerendre); break;
      case 'supprimer':
        if (soin && await confirmer(`Supprimer ce soin ?${soin.titre ? ` (${soin.titre})` : ''}`)) {
          storage.supprimer('soins', soin.id);
          toast('Soin supprimé');
          rerendre();
        }
        break;
    }
  });
}
