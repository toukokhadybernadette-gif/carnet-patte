// Accueil : carte « héros » (Bonjour [prénom], date, la chose à faire maintenant), le carrousel des animaux,
// prochains rappels, conseil du moment (2 lignes + « Lire la suite »), « Ce mois-ci » en pastilles.
// Cette page LIT les données mais ne les modifie jamais (les ajouts passent par les formulaires existants).

import * as storage from '../../js/storage.js';
import { icone } from '../../js/icons.js';
import { echapper, formatDate, aujourdhui, lireISO } from '../../js/utils.js';
import { vide, couleurAnimal, bouton } from '../../js/composants.js';
import { illustration } from '../../js/illustrations.js';
import { rafraichir } from '../../js/router.js';
import { conseilDuMois, PHRASE_VETERINAIRE } from '../../js/conseils.js';
import { brancherCalendrier, boutonCalendrier } from '../animaux/calendrier.js';
import { estGroupe, libelleEffectif, alerteStocksHtml } from '../ferme/ferme.js';
import { calculerRappels } from '../animaux/rappels.js';
import { formulaireAnimal } from '../animaux/animaux.js';
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
        <span class="ac-afaire__etiquette">À faire</span>
        <span class="ac-afaire__titre">${echapper(nom)}</span>
        <span class="ac-afaire__meta">${dateCourte(soin.rappel)} ${badgeEcheance(statut)}</span>
      </div>
      ${bouton({ texte: 'Fait', icone: 'check', taille: 's', attrs: { 'data-fait': soin.id, 'aria-label': `Fait : ${nom}, ${animal.nom}` } })}
      ${boutonCalendrier(soin, animal)}
    </div>`;
}

/** Grande photo d'un animal (ou son illustration) avec son nom, puis la chose à faire pour LUI. Un toucher sur la photo ouvre sa fiche. */
function slideAnimal(a, urgent, i, total) {
  const photo = photoDe(a);
  const image = photo
    ? `<img class="ac-couv__img" src="${echapper(photo)}" alt="">`
    : `<span class="ac-couv__illu">${illustration(infosEspece(a).icone)}</span>`;
  return `
    <li class="ac-couv__slide cp-an-${couleurAnimal(a)}" data-slide="${echapper(a.id)}">
      <a class="ac-couv__photo${photo ? '' : ' ac-couv__photo--illu'}" href="#/animaux/${encodeURIComponent(a.id)}" aria-label="Ouvrir la fiche de ${echapper(a.nom)}">
        ${image}
        <span class="ac-couv__voile" aria-hidden="true"></span>
        <span class="ac-couv__nom">${echapper(a.nom)}</span>
        <span class="ac-couv__espece">${echapper(estGroupe(a) ? `Groupe · ${libelleEffectif(a)}` : nomEspece(a))}</span>
      </a>
      ${blocAFaire(urgent)}
    </li>`;
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
  // Un rappel « à faire maintenant » par animal ; l'animal le plus pressé passe en premier dans le défilement
  const urgentDe = (a) => rappels.find((r) => r.animal.id === a.id && r.statut.classe !== 'plus-tard') ?? null;
  const rang = (a) => { const u = urgentDe(a); return u ? rappels.indexOf(u) : 1e6; };
  const ordreCouverture = [...animaux].sort((x, y) => rang(x) - rang(y) || x.nom.localeCompare(y.nom, 'fr'));

  const resume = animaux.length
    ? `<a class="ac-resume" href="#/animaux/rappels">${pluriel(animaux.length, 'animal', 'animaux')} · ${enRetard ? `<span class="ac-resume__retard">${pluriel(enRetard, 'rappel en retard', 'rappels en retard')}</span>` : 'aucun rappel en retard'}${icone('chevron-right', { taille: 14 })}</a>`
    : '<p class="ac-resume ac-resume--vide">Votre carnet est vide pour l\'instant.</p>';


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
        ${animaux.length ? `
        <div class="ac-couv" role="region" aria-label="Photos de mes animaux">
          <ul class="ac-couv__piste ac-couv__piste--multi" tabindex="0" data-piste>
            ${ordreCouverture.map((a, i) => slideAnimal(a, urgentDe(a), i, ordreCouverture.length + 1)).join('')}
            <li class="ac-couv__slide ac-couv__slide--ajout" data-slide="ajout"><div class="ac-couv__ajout"><span class="ac-couv__plus" aria-hidden="true">${icone('plus', { taille: 28 })}</span>${bouton({ texte: 'Ajouter un animal', attrs: { 'data-act': 'animal' } })}</div></li>
          </ul>
          <div class="ac-couv__points" aria-hidden="true">${[...ordreCouverture, null].map((_, i) => `<span class="ac-couv__point" data-point="${i}"></span>`).join('')}</div>
        </div>` : ''}
      </header>

      ${animaux.length ? `
      <section class="pg-section" aria-labelledby="ac-rappels">
        <div class="pg-section__tete">
          <h2 id="ac-rappels">Prochains rappels</h2>
          ${rappels.length ? `<a class="pg-lien" href="#/animaux/rappels">Tout voir ${icone('chevron-right', { taille: 16 })}</a>` : ''}
        </div>
        ${blocRappels}
        ${alerteStocksHtml()}
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

      <section class="pg-section" aria-labelledby="ac-carte">
        <h2 id="ac-carte">Autour de vous</h2>
        <a class="cp-carte ca-acces" href="#/carte">
          <span class="ca-acces__icone" aria-hidden="true">${icone('map-pin', { taille: 22 })}</span>
          <span class="ca-acces__corps"><span class="ca-acces__titre">Carte Patte</span><span class="ca-acces__texte">Vétérinaires, parcs à chiens, animaleries, toiletteurs et refuges près de chez vous.</span></span>
          <span class="ca-acces__fleche" aria-hidden="true">${icone('chevron-right', { taille: 18 })}</span>
        </a>
      </section>
    </div>`;

  // Points sous le défilement : celui de la photo la plus visible est plein
  const piste = zone.querySelector('[data-piste]');
  if (piste) {
    const points = [...zone.querySelectorAll('[data-point]')];
    const majPoints = () => {
      const centre = piste.scrollLeft + piste.clientWidth / 2;
      let proche = 0; let ecart = Infinity;
      [...piste.children].forEach((li, i) => { const d = Math.abs(li.offsetLeft - piste.offsetLeft + li.offsetWidth / 2 - centre); if (d < ecart) { ecart = d; proche = i; } });
      points.forEach((p, i) => p.classList.toggle('is-actif', i === proche));
    };
    piste.addEventListener('scroll', () => requestAnimationFrame(majPoints), { passive: true });
    majPoints();
  }

  brancherCalendrier(zone);
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
    if (e.target.closest('[data-act="animal"]')) formulaireAnimal(null, rafraichir);
  });
}
