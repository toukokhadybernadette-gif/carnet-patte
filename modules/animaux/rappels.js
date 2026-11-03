// Rappels : liste des soins à refaire, en retard ou à venir.

import * as storage from '../../js/storage.js';
import { echapper, formatDate } from '../../js/utils.js';
import { rafraichir } from '../../js/router.js';
import { icone } from '../../js/icons.js';
import { infosType, statutRappel, ouvrirRappelFait } from './commun.js';

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

function ligneHtml({ soin, animal, statut }) {
  const type = infosType(soin.type);
  const titre = [type.nom, soin.titre].filter(Boolean).join(' — ');
  return `
    <li class="ligne">
      <div class="ligne-icone">${icone(type.icone, { taille: 22 })}</div>
      <div class="ligne-corps">
        <strong>${echapper(titre)}</strong>
        <a href="#/animaux/${encodeURIComponent(animal.id)}">${echapper(animal.nom)}</a>
        <span class="discret">Pour le ${formatDate(soin.rappel)}</span>
        <span><span class="pastille ${statut.classe}">${statut.texte}</span></span>
      </div>
      <div class="ligne-actions">
        <button class="bouton petit" data-fait="${soin.id}">${icone('check', { taille: 16 })} Fait</button>
      </div>
    </li>`;
}

function groupeHtml(titre, rappels, nomIcone, classe) {
  if (!rappels.length) return '';
  return `
    <section class="carte">
      <h2 class="titre-icone ${classe}">${icone(nomIcone, { taille: 20 })} ${titre} <span class="discret">(${rappels.length})</span></h2>
      <ul class="lignes">${rappels.map(ligneHtml).join('')}</ul>
    </section>`;
}

/** Petit résumé affiché en haut de la liste des animaux. */
export function resumeRappelsHtml() {
  const rappels = calculerRappels();
  if (!rappels.length) return '';
  const retard = rappels.filter((r) => r.statut.classe === 'retard').length;
  const semaine = rappels.filter((r) => r.statut.classe === 'semaine').length;
  const prochains = rappels.slice(0, 3).map((r) =>
    `<li><span class="pastille ${r.statut.classe}">${r.statut.texte}</span>
       ${infosType(r.soin.type).nom}${r.soin.titre ? ' ' + echapper(r.soin.titre) : ''} · ${echapper(r.animal.nom)}</li>`
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

export function rendre(zone) {
  const rappels = calculerRappels();
  const retard = rappels.filter((r) => r.statut.classe === 'retard');
  const semaine = rappels.filter((r) => r.statut.classe === 'semaine');
  const plusTard = rappels.filter((r) => r.statut.classe === 'plus-tard');

  zone.innerHTML = `
    <div class="page-titre"><h1>Rappels</h1></div>
    ${rappels.length ? '' : `
      <div class="carte vide"><span class="grand-icone">${icone('circle-check', { taille: 44 })}</span>
        Aucun rappel en attente.<br>
        <span class="discret">Ajoutez une date de rappel lorsque vous notez un soin.</span>
      </div>`}
    ${groupeHtml('En retard', retard, 'circle-alert', 'icone-retard')}
    ${groupeHtml('Cette semaine', semaine, 'clock', 'icone-semaine')}
    ${groupeHtml('À venir', plusTard, 'calendar', 'icone-plus-tard')}`;

  zone.addEventListener('click', (e) => {
    const bouton = e.target.closest('[data-fait]');
    if (!bouton) return;
    const soin = storage.trouver('soins', bouton.dataset.fait);
    if (soin) ouvrirRappelFait(soin, rafraichir);
  });
}
