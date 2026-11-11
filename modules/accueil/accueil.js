// Accueil : carte « héros » (Bonjour [prénom], date, la chose à faire maintenant), mes animaux (cartes), actions rapides (un panneau),
// prochains rappels, conseil du moment (2 lignes + « Lire la suite »), « Ce mois-ci » en pastilles.
// Cette page LIT les données mais ne les modifie jamais (les ajouts passent par les formulaires existants).

import * as storage from '../../js/storage.js';
import { icone } from '../../js/icons.js';
import { echapper, formatDate, aujourdhui, lireISO } from '../../js/utils.js';
import { vide, avatar, couleurAnimal, bouton } from '../../js/composants.js';
import { modale } from '../../js/ui.js';
import { rafraichir } from '../../js/router.js';
import { conseilDuMois, PHRASE_VETERINAIRE } from '../../js/conseils.js';
import { calculerRappels } from '../animaux/rappels.js';
import { formulaireAnimal } from '../animaux/animaux.js';
import { formulaireSoin } from '../animaux/soins.js';
import { formulairePesee } from '../animaux/pesees.js';
import { infosEspece, nomEspece, infosType, classeType, badgeEcheance, nomCourtSoin, ouvrirRappelFait } from '../animaux/commun.js';

const pluriel = (n, un, plusieurs) => `${n} ${n > 1 ? plusieurs : un}`;
const photoDe = (a) => (typeof a.photo === 'string' && a.photo.startsWith('data:image/') ? a.photo : '');

/** « 27 oct. » pour l'année en cours, « 27 oct. 2027 » sinon : la ligne reste courte. */
export function dateCourte(iso) {
  const complete = formatDate(iso);
  return iso?.slice(0, 4) === aujourdhui().slice(0, 4) ? complete.replace(/\s+\d{4}$/, '') : complete;
}

/** Une ligne de rappel compacte : le soin en haut, l'animal et la date dessous, le badge à droite. */
function ligneRappel(r) {
  return `
    <li><a class="cp-liste__ligne cp-liste__ligne--lien" href="#/animaux/rappels">
      <span class="cp-liste__icone ${classeType(r.soin.type)}">${icone(infosType(r.soin.type).icone, { taille: 18 })}</span>
      <div class="cp-liste__corps"><span class="cp-liste__titre">${echapper(nomCourtSoin(r.soin))}</span><span class="cp-liste__meta">${echapper(r.animal.nom)} · ${dateCourte(r.soin.rappel)}</span></div>
      <div class="cp-liste__fin">${badgeEcheance(r.statut)}</div>
    </a></li>`;
}

/** Plusieurs animaux : un petit choix « Pour quel animal ? » avant le formulaire. Un seul animal : on va directement au formulaire. */
function pourUnAnimal(animaux, suite) {
  if (animaux.length === 1) { suite(animaux[0]); return; }
  const html = `
    <div class="ac-choix" role="group" aria-label="Animal concerné">
      ${animaux.map((a) => `<button type="button" class="cp-carte ac-choix__animal" data-animal="${echapper(a.id)}">${avatar({ icone: infosEspece(a).icone, photo: photoDe(a), nom: a.nom, id: a.id, couleur: couleurAnimal(a) })}<span>${echapper(a.nom)}</span></button>`).join('')}
    </div>`;
  modale('Pour quel animal ?', html, (dlg) => {
    dlg.addEventListener('click', (e) => {
      const b = e.target.closest('[data-animal]');
      const animal = b && storage.trouver('animaux', b.dataset.animal);
      if (!animal) return;
      dlg.close();
      suite(animal);
    });
  });
}

/** Un des 4 cercles du panneau d'actions : libellé court visible, nom complet pour les lecteurs d'écran. */
const action = ({ id, texte, ic, href, nom = texte }) => {
  const rond = `<span class="ac-action__rond" aria-hidden="true">${icone(ic, { taille: 26 })}</span><span class="ac-action__texte">${texte}</span>`;
  const etiquette = nom === texte ? '' : ` aria-label="${echapper(nom)}"`;
  return href ? `<a class="ac-action" href="${href}"${etiquette}>${rond}</a>` : `<button type="button" class="ac-action" data-act="${id}"${etiquette}>${rond}</button>`;
};

/** « Mardi 11 novembre » */
const dateDuJour = () => {
  const t = lireISO(aujourdhui()).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** LA chose à faire maintenant : le rappel le plus urgent (en retard ou dans les 7 jours), avec « Fait » directement dedans. */
function blocAFaire(urgent) {
  if (!urgent) return '<p class="ac-afaire ac-afaire--ok" data-afaire="ok">Tout est à jour <span aria-hidden="true">🎉</span></p>';
  const { soin, animal, statut } = urgent;
  const nom = nomCourtSoin(soin);
  return `
    <div class="ac-afaire" data-afaire="${echapper(soin.id)}">
      <span class="cp-liste__icone ${classeType(soin.type)}">${icone(infosType(soin.type).icone, { taille: 20 })}</span>
      <div class="ac-afaire__corps">
        <span class="ac-afaire__etiquette">À faire maintenant</span>
        <span class="ac-afaire__titre">${echapper(nom)} · ${echapper(animal.nom)}</span>
        <span class="ac-afaire__meta">${dateCourte(soin.rappel)} ${badgeEcheance(statut)}</span>
      </div>
      ${bouton({ texte: 'Fait', icone: 'check', taille: 's', attrs: { 'data-fait': soin.id, 'aria-label': `Fait : ${nom}, ${animal.nom}` } })}
    </div>`;
}

export function rendre(zone) {
  zone.classList.add('page-large');
  const { prenom } = storage.lireProfil(); // facultatif : sans prénom, « Bonjour » tout court

  const animaux = storage.lister('animaux').sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const parId = new Map(animaux.map((a) => [a.id, a]));
  const rappels = calculerRappels(); // du plus en retard au plus lointain
  const enRetard = rappels.filter((r) => r.statut.classe === 'retard').length;

  // Bilan du mois : soins déjà faits (date du soin passée) et pesées, dans le mois en cours, pour les animaux qui existent
  const auj = aujourdhui();
  const moisCourant = auj.slice(0, 7);
  const dansLeMois = (e) => e.date && e.date.slice(0, 7) === moisCourant && e.date <= auj && parId.has(e.animalId);
  const nbSoins = storage.lister('soins').filter(dansLeMois).length;
  const nbPesees = storage.lister('pesees').filter(dansLeMois).length;

  const conseil = conseilDuMois();
  const urgent = rappels.find((r) => r.statut.classe !== 'plus-tard') ?? null;

  const resume = animaux.length
    ? `<a class="ac-resume" href="#/animaux/rappels">${pluriel(animaux.length, 'animal', 'animaux')} · ${enRetard ? `<span class="ac-resume__retard">${pluriel(enRetard, 'rappel en retard', 'rappels en retard')}</span>` : 'aucun rappel en retard'}${icone('chevron-right', { taille: 14 })}</a>`
    : '<p class="ac-resume ac-resume--vide">Votre carnet est vide pour l\'instant.</p>';

  const stories = animaux.length ? `
      <section class="pg-section" aria-labelledby="ac-animaux">
        <h2 id="ac-animaux">Mes animaux</h2>
        <nav class="ac-stories" aria-label="Mes animaux">
          <ul>
            ${animaux.map((a) => `<li><a class="ac-story" href="#/animaux/${encodeURIComponent(a.id)}">${avatar({ icone: infosEspece(a).icone, photo: photoDe(a), nom: a.nom, id: a.id, couleur: couleurAnimal(a) })}<span class="ac-story__nom">${echapper(a.nom)}</span><span class="ac-story__espece">${echapper(nomEspece(a))}</span></a></li>`).join('')}
            <li><button type="button" class="ac-story ac-story--ajout" data-act="animal"><span class="ac-story__plus" aria-hidden="true">${icone('plus', { taille: 22 })}</span><span class="ac-story__nom">Ajouter</span><span class="ac-story__espece">un animal</span></button></li>
          </ul>
        </nav>
      </section>` : '';

  const actions = [
    animaux.length && action({ id: 'soin', texte: 'Soin', nom: 'Ajouter un soin', ic: 'stethoscope' }),
    animaux.length && action({ id: 'pesee', texte: 'Pesée', nom: 'Ajouter une pesée', ic: 'scale' }),
    action({ id: 'animal', texte: 'Animal', nom: 'Ajouter un animal', ic: 'paw-print' }),
    action({ texte: 'Sauvegarde', ic: 'save', href: '#/donnees' }),
  ].filter(Boolean).join('');

  const blocRappels = rappels.length
    ? `<ul class="cp-liste">${rappels.slice(0, 3).map(ligneRappel).join('')}</ul>`
    : `<div class="cp-carte">${vide({ icone: 'circle-check', titre: 'Aucun rappel en attente', texte: 'Ajoutez une date de rappel quand vous notez un soin.' })}</div>`;

  const pastilles = [[nbSoins, 'soin fait', 'soins faits'], [nbPesees, 'pesée', 'pesées']]
    .map(([n, un, plusieurs]) => `<li class="ac-pastille"><strong>${n}</strong> ${n > 1 ? plusieurs : un}</li>`).join('');

  zone.innerHTML = `
    <div class="cp pg pg--accueil">
      <header class="ac-hero cp-carte">
        <p class="ac-hero__date">${dateDuJour()}</p>
        <h1>Bonjour${prenom ? ` ${echapper(prenom)}` : ''}</h1>
        ${resume}
        ${animaux.length ? blocAFaire(urgent) : ''}
      </header>

      ${stories}

      <section class="pg-section" aria-labelledby="ac-actions">
        <h2 id="ac-actions">Actions rapides</h2>
        <div class="ac-actions cp-carte">${actions}</div>
      </section>

      ${animaux.length ? `
      <section class="pg-section" aria-labelledby="ac-rappels">
        <div class="pg-section__tete">
          <h2 id="ac-rappels">Prochains rappels</h2>
          ${rappels.length ? `<a class="pg-lien" href="#/animaux/rappels">Tout voir ${icone('chevron-right', { taille: 16 })}</a>` : ''}
        </div>
        ${blocRappels}
      </section>

      <section class="pg-section" aria-labelledby="ac-conseil">
        <h2 id="ac-conseil">Conseil du moment</h2>
        <article class="cp-carte ac-conseil">
          <span class="ac-conseil__icone" aria-hidden="true">${icone(conseil.icone, { taille: 22 })}</span>
          <div class="ac-conseil__corps">
            <h3 class="ac-conseil__titre">${echapper(conseil.titre)}</h3>
            <p class="ac-conseil__texte" id="ac-conseil-texte">${echapper(conseil.texte)}</p>
            <p class="ac-conseil__vet" hidden><strong>${echapper(PHRASE_VETERINAIRE)}</strong></p>
            <p class="ac-conseil__source" hidden>Source : ${echapper(conseil.source)}</p>
            <button type="button" class="ac-conseil__suite" data-conseil-suite aria-expanded="false" aria-controls="ac-conseil-texte">Lire la suite</button>
          </div>
        </article>
      </section>

      <section class="pg-section" aria-labelledby="ac-mois">
        <h2 id="ac-mois">Ce mois-ci</h2>
        <ul class="ac-mois" data-ce-mois>${pastilles}</ul>
      </section>` : `<div class="cp-carte">${vide({ niveau: 2, icone: 'paw-print', titre: "Aucun animal pour l'instant", texte: 'Ajoutez votre premier compagnon pour suivre ses soins, ses pesées et ses rappels.' })}</div>`}
    </div>`;

  zone.addEventListener('click', (e) => {
    const fait = e.target.closest('[data-fait]');
    if (fait) { const soin = storage.trouver('soins', fait.dataset.fait); if (soin) ouvrirRappelFait(soin, rafraichir); return; }
    if (e.target.closest('[data-conseil-suite]')) {
      const suite = e.target.closest('[data-conseil-suite]');
      const ouvert = suite.getAttribute('aria-expanded') !== 'true';
      suite.setAttribute('aria-expanded', String(ouvert));
      suite.textContent = ouvert ? 'Réduire' : 'Lire la suite';
      zone.querySelector('.ac-conseil').classList.toggle('is-ouvert', ouvert);
      zone.querySelectorAll('.ac-conseil__vet, .ac-conseil__source').forEach((el) => { el.hidden = !ouvert; });
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'soin') pourUnAnimal(animaux, (a) => formulaireSoin(a, null, rafraichir));
    else if (act === 'pesee') pourUnAnimal(animaux, (a) => formulairePesee(a, rafraichir));
    else if (act === 'animal') formulaireAnimal(null, rafraichir);
  });
}
