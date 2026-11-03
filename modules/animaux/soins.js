// Soins d'un animal : vaccins, vermifuges, visites... avec une date de rappel facultative.

import * as storage from '../../js/storage.js';
import { echapper, aujourdhui, formatDate } from '../../js/utils.js';
import { modale, confirmer, toast } from '../../js/ui.js';
import { icone } from '../../js/icons.js';
import { TYPES_SOIN, infosType, statutRappel, ouvrirRappelFait } from './commun.js';

function formulaireSoin(animal, soin, apres) {
  const s = soin ?? { type: 'vaccin', titre: '', date: aujourdhui(), notes: '', rappel: '' };
  const options = TYPES_SOIN.map((t) =>
    `<option value="${t.id}" ${t.id === s.type ? 'selected' : ''}>${t.nom}</option>`).join('');

  const html = `
    <form class="formulaire">
      <label>Type de soin <select name="type">${options}</select></label>
      <label>Précision (facultatif)
        <input name="titre" maxlength="60" value="${echapper(s.titre)}" placeholder="Ex. : Rage, Frontline...">
      </label>
      <label>Date du soin <input type="date" name="date" required value="${s.date}"></label>
      <label>Notes (facultatif) <textarea name="notes" maxlength="500">${echapper(s.notes)}</textarea></label>
      <label>Date de rappel (facultatif)
        <input type="date" name="rappel" value="${s.rappel ?? ''}">
      </label>
      <div class="actions">
        <button type="button" class="bouton secondaire" data-annuler>Annuler</button>
        <button type="submit" class="bouton">Enregistrer</button>
      </div>
    </form>`;

  modale(soin ? 'Modifier le soin' : `Nouveau soin pour ${animal.nom}`, html, (dlg) => {
    dlg.querySelector('[data-annuler]').addEventListener('click', () => dlg.close());
    dlg.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const champs = {
        type: f.get('type'),
        titre: f.get('titre').trim(),
        date: f.get('date'),
        notes: f.get('notes').trim(),
        rappel: f.get('rappel') || '',
      };
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

function ligneHtml(soin) {
  const type = infosType(soin.type);
  const titre = [type.nom, soin.titre].filter(Boolean).join(' — ');
  const statut = statutRappel(soin);

  let rappel = '';
  if (statut) {
    rappel = `<span><span class="pastille ${statut.classe}">${icone('bell-ring', { taille: 14 })} Rappel le ${formatDate(soin.rappel)} · ${statut.texte}</span></span>`;
  } else if (soin.rappel) {
    rappel = `<span><span class="pastille fait">${icone('check', { taille: 14 })} Rappel du ${formatDate(soin.rappel)} traité</span></span>`;
  }

  return `
    <li class="ligne">
      <div class="ligne-icone">${icone(type.icone, { taille: 22 })}</div>
      <div class="ligne-corps">
        <strong>${echapper(titre)}</strong>
        <span class="discret">${formatDate(soin.date)}</span>
        ${soin.notes ? `<span class="notes">${echapper(soin.notes)}</span>` : ''}
        ${rappel}
      </div>
      <div class="ligne-actions">
        ${statut ? `<button class="bouton petit" data-act="fait" data-id="${soin.id}">${icone('check', { taille: 16 })} Fait</button>` : ''}
        <button class="bouton secondaire petit icone" data-act="modifier" data-id="${soin.id}" aria-label="Modifier">${icone('pencil', { taille: 16 })}</button>
        <button class="bouton secondaire petit icone" data-act="supprimer" data-id="${soin.id}" aria-label="Supprimer">${icone('trash-2', { taille: 16 })}</button>
      </div>
    </li>`;
}

/** Affiche la section « Soins » dans `zone`. Se réaffiche toute seule après chaque modification. */
export function rendre(zone, animal) {
  const section = document.createElement('section');
  section.className = 'carte';
  zone.replaceChildren(section);

  const soins = storage.lister('soins')
    .filter((s) => s.animalId === animal.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const rerendre = () => rendre(zone, animal);

  section.innerHTML = `
    <div class="page-titre">
      <h2>Soins</h2>
      <button class="bouton petit" data-act="ajouter">${icone('plus', { taille: 18 })} Ajouter un soin</button>
    </div>
    ${soins.length
      ? `<ul class="lignes">${soins.map(ligneHtml).join('')}</ul>`
      : `<div class="vide">Aucun soin noté pour l'instant.</div>`}`;

  section.addEventListener('click', async (e) => {
    const bouton = e.target.closest('[data-act]');
    if (!bouton) return;
    const soin = bouton.dataset.id ? storage.trouver('soins', bouton.dataset.id) : null;

    switch (bouton.dataset.act) {
      case 'ajouter': formulaireSoin(animal, null, rerendre); break;
      case 'modifier': if (soin) formulaireSoin(animal, soin, rerendre); break;
      case 'fait': if (soin) ouvrirRappelFait(soin, rerendre); break;
      case 'supprimer':
        if (soin && await confirmer('Supprimer ce soin ?')) {
          storage.supprimer('soins', soin.id);
          toast('Soin supprimé');
          rerendre();
        }
        break;
    }
  });
}
