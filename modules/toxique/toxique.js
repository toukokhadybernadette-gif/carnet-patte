// Module « Toxique ? » : on tape un aliment, une plante ou un produit ménager, et la page dit s'il est dangereux pour l'espèce choisie.
// Les fiches sont dans donnees.js (fichier fait pour être relu à la main). Cette page LIT seulement : elle ne modifie jamais les données des animaux.
// Règle absolue : jamais de dose ni de traitement ; la phrase « En cas de doute… » et les numéros des centres antipoison sont toujours visibles.

import * as storage from '../../js/storage.js';
import { icone } from '../../js/icons.js';
import { echapper } from '../../js/utils.js';
import { badge, vide } from '../../js/composants.js';
import { infosEspece } from '../animaux/commun.js';
import { FICHES, ESPECES_TOXIQUE, NOTES_ESPECE, NOMS_CATEGORIES, CENTRES_ANTIPOISON, PHRASE_DOUTE, DATE_VERIFICATION } from './donnees.js';

// ----- Les 4 niveaux : couleur d'urgence + FORME de l'icône (la couleur ne porte jamais seule l'information) -----
const NIVEAUX = {
  ok: { rang: 3, texte: 'Pas de toxicité grave connue', variante: 'succes', icone: 'circle-check' },
  prudence: { rang: 2, texte: 'Prudence', variante: 'attention', icone: 'triangle-alert' },
  toxique: { rang: 1, texte: 'Toxique', variante: 'alerte', icone: 'circle-alert' },
  tres: { rang: 0, texte: 'Très toxique', variante: 'critique', icone: 'octagon-x' },
};
const ICONES_CATEGORIES = { aliment: 'utensils', plante: 'leaf', menager: 'spray-can', dehors: 'trees' };
const FILTRES = [['tous', 'Tout', 'paw-print'], ['aliment', 'Aliments', 'utensils'], ['plante', 'Plantes', 'leaf'], ['menager', 'Produits et médicaments', 'spray-can'], ['dehors', 'Dehors', 'trees']];

/** « Éléphant » → « elephant » : la recherche ignore les majuscules et les accents. */
export const normaliser = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[œŒ]/g, 'oe').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const fiches = FICHES.map((f) => ({ ...f, _texte: normaliser([f.nom, ...(f.aussi ?? [])].join(' ')) }));

const badgeNiveau = (niveau) => {
  const n = NIVEAUX[niveau];
  return `<span class="cp-badge cp-badge--${n.variante} tx-niveau tx-niveau--${niveau}">${icone(n.icone, { taille: 14 })}${echapper(n.texte)}</span>`;
};

/** Le groupe d'espèces des fiches (Rongeurs = cochon d'Inde + hamster) pour une espèce de l'appli. */
const groupeDe = (animal) => ESPECES_TOXIQUE.find((g) => g.especes.includes(animal.espece));

/** Espèce choisie au départ : celle de l'animal demandé dans l'adresse (#/toxique/<id>), sinon celle du premier animal (ordre alphabétique, comme l'Accueil). */
function choixParDefaut(segments) {
  const animaux = storage.lister('animaux').sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  const demande = segments[0] && animaux.find((a) => a.id === segments[0]);
  const animal = [demande, ...animaux].find((a) => a && groupeDe(a));
  return animal ? { groupe: groupeDe(animal), animal } : { groupe: ESPECES_TOXIQUE[0], animal: null };
}

const numeros = () => CENTRES_ANTIPOISON.map((c) => `<a class="tx-tel" href="${c.lien}">${icone('phone', { taille: 16 })}<span><strong>${echapper(c.nom.split(' (')[0])}</strong> ${echapper(c.tel)}</span></a>`).join('');

/** Bloc toujours présent : la phrase de prudence et les numéros. */
const blocUrgence = (classe = '') => `
  <div class="tx-urgence ${classe}">
    <p class="tx-urgence__phrase"><strong>${echapper(PHRASE_DOUTE)}.</strong></p>
    <div class="tx-urgence__numeros">${numeros()}</div>
  </div>`;

const lienSource = ([nom, url]) => `<a href="${echapper(url)}" target="_blank" rel="noopener noreferrer">${echapper(nom)}<span class="cp-sr"> (nouvel onglet)</span></a>`;

function signesPour(fiche, espece) {
  const s = fiche.signes;
  if (typeof s === 'string') return s;
  return s?.[espece] ?? s?.tous ?? '';
}

/** Le détail d'une fiche pour UNE espèce (ce qui s'ouvre au clic). */
function detail(fiche, groupe) {
  const niveau = fiche.niveaux[groupe.id];
  const info = NIVEAUX[niveau];
  // Seules les sources qui parlent de l'espèce choisie (3e élément facultatif dans donnees.js) ; à défaut, toutes
  const utiles = fiche.sources.filter(([, , esp]) => !esp || esp.includes(groupe.id));
  const liste = utiles.length ? utiles : fiche.sources;
  const sources = `<p class="tx-source">Source${liste.length > 1 ? 's' : ''} : ${liste.map(lienSource).join(' · ')}</p>`;
  const note = fiche.note ? `<p class="tx-note">${echapper(fiche.note)}</p>` : '';

  if (niveau === 'ok') {
    return `
      <div class="tx-bandeau tx-bandeau--ok">${icone(info.icone, { taille: 20 })}<p><strong>Pas de toxicité grave connue pour ${echapper(groupe.nom.toLowerCase())}.</strong> Peut quand même causer des troubles digestifs, ne pas en donner volontairement.</p></div>
      ${note}${sources}`;
  }
  const signes = signesPour(fiche, groupe.id);
  const urgent = niveau === 'tres' || niveau === 'toxique';
  const etapes = [
    "Éloignez l'animal de la source et empêchez-le d'en reprendre.",
    "Ne provoquez pas de vomissement et ne donnez rien à boire ni à manger sans l'avis d'un professionnel.",
    "Notez ce qui a été avalé, la quantité approximative et l'heure ; gardez l'emballage ou un échantillon de la plante.",
    niveau === 'tres' ? '<strong>Appelez tout de suite</strong> votre vétérinaire ou un centre antipoison vétérinaire, même si votre animal semble aller bien.'
      : niveau === 'toxique' ? '<strong>Appelez rapidement</strong> votre vétérinaire ou un centre antipoison vétérinaire, même si votre animal semble aller bien.'
        : 'Surveillez votre animal. Si des signes apparaissent, ou en cas de doute, appelez votre vétérinaire ou un centre antipoison vétérinaire.',
  ];
  return `
    <div class="tx-bandeau tx-bandeau--${niveau}">${icone(info.icone, { taille: 20 })}<p><strong>${echapper(info.texte)} pour ${echapper(groupe.nom.toLowerCase())}${niveau === 'tres' ? ' : urgence' : ''}.</strong></p></div>
    ${signes ? `<h4 class="tx-titre">Signes possibles</h4><p>${echapper(signes)}</p>` : ''}
    ${note}
    <h4 class="tx-titre">Quoi faire</h4>
    <ol class="tx-etapes">${etapes.map((e) => `<li>${e}</li>`).join('')}</ol>
    ${fiche.conseil ? `<p class="tx-conseil">${icone('info', { taille: 16 })}<span>${echapper(fiche.conseil)}</span></p>` : ''}
    ${urgent ? blocUrgence('tx-urgence--dans-fiche') : `<div class="tx-urgence tx-urgence--dans-fiche"><p class="tx-urgence__phrase"><strong>${echapper(PHRASE_DOUTE)}.</strong></p><div class="tx-urgence__numeros">${numeros()}</div></div>`}
    ${sources}`;
}

/** Une carte repliable. `groupe` = espèce choisie ; sans fiche pour cette espèce, la carte le dit clairement (jamais « sans danger » par défaut). */
function carte(fiche, groupe, id, ouverte) {
  const niveau = fiche.niveaux[groupe.id];
  const concerne = ESPECES_TOXIQUE.filter((g) => fiche.niveaux[g.id]).map((g) => g.nom.toLowerCase()).join(', ');
  const entete = `
    <span class="tx-carte__icone" aria-hidden="true">${icone(ICONES_CATEGORIES[fiche.cat], { taille: 20 })}</span>
    <span class="tx-carte__corps"><span class="tx-carte__nom">${echapper(fiche.nom)}</span>${niveau ? badgeNiveau(niveau) : badge({ texte: 'Pas de fiche', variante: 'neutre', icone: 'circle-help' })}</span>
    <span class="tx-carte__fleche" aria-hidden="true">${icone('chevron-down', { taille: 18 })}</span>`;
  const corps = niveau ? detail(fiche, groupe) : `
    <div class="tx-bandeau tx-bandeau--aucune">${icone('circle-help', { taille: 20 })}<p><strong>Pas d'information vérifiée pour ${echapper(groupe.nom.toLowerCase())}.</strong> Cela ne veut pas dire que c'est sans danger. Cet élément a une fiche pour : ${echapper(concerne)}.</p></div>
    <div class="tx-urgence tx-urgence--dans-fiche"><p class="tx-urgence__phrase"><strong>${echapper(PHRASE_DOUTE)}.</strong></p><div class="tx-urgence__numeros">${numeros()}</div></div>`;
  return `
    <li class="cp-carte tx-carte" data-fiche="${echapper(fiche.id)}" data-cat="${fiche.cat}"${niveau ? ` data-niveau="${niveau}"` : ' data-niveau="aucune"'}>
      <h3 class="tx-carte__titre"><button type="button" class="tx-carte__tete" aria-expanded="${ouverte}" aria-controls="tx-detail-${id}">${entete}</button></h3>
      <div class="tx-carte__detail" id="tx-detail-${id}"${ouverte ? '' : ' hidden'}>${corps}</div>
    </li>`;
}

export function rendre(zone, segments = []) {
  zone.classList.add('page-large');
  const defaut = choixParDefaut(segments);
  const etat = { groupe: defaut.groupe, q: '', cat: 'tous', ouvertes: new Set(['tres']) };

  zone.innerHTML = `
    <div class="cp pg pg--toxique">
      <header class="pg-entete">
        <h1 tabindex="-1">Toxique ?</h1>
        <p>Tapez un aliment, une plante ou un produit pour savoir s'il est dangereux pour votre animal.</p>
      </header>

      ${blocUrgence('tx-urgence--haut')}

      <section class="pg-section" aria-labelledby="tx-espece-titre">
        <h2 id="tx-espece-titre" class="cp-sr">Espèce de l'animal</h2>
        <fieldset class="cp-choix cp-choix--especes tx-especes">
          <legend>Pour quelle espèce ?</legend>
          ${ESPECES_TOXIQUE.map((g) => `
            <label class="cp-choix__option"><input type="radio" name="tx-espece" value="${g.id}"${g.id === etat.groupe.id ? ' checked' : ''}>
              <span>${icone(g.icone, { taille: 18 })}${echapper(g.nom)}</span></label>`).join('')}
        </fieldset>
        <p class="tx-defaut" data-defaut${defaut.animal ? '' : ' hidden'}>Choix par défaut : <strong>${defaut.animal ? echapper(defaut.animal.nom) : ''}</strong> (${defaut.animal ? echapper(infosEspece(defaut.animal).nom.toLowerCase()) : ''}).</p>
        <p class="tx-note-espece" data-note-espece role="note"></p>
      </section>

      <section class="pg-section tx-outils" aria-labelledby="tx-recherche-titre">
        <h2 id="tx-recherche-titre" class="cp-sr">Recherche</h2>
        <div class="cp-champ tx-recherche">
          <label class="cp-champ__label" for="tx-q">Un aliment, une plante ou un produit</label>
          <div class="cp-champ__zone">${icone('search', { taille: 20 })}
            <input type="search" class="cp-input" id="tx-q" name="q" placeholder="Ex. : chocolat, lys, antigel…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">
          </div>
        </div>
        <div class="cp-filtres tx-filtres" role="group" aria-label="Filtrer par type">
          ${FILTRES.map(([id, nom, ic]) => `<button type="button" class="cp-filtre" aria-pressed="${id === 'tous'}" data-cat="${id}">${icone(ic, { taille: 16 })}${echapper(nom)}</button>`).join('')}
        </div>
        <p class="tx-resultat" data-resultat role="status"></p>
      </section>

      <section class="pg-section" aria-label="Résultats">
        <div data-sections></div>
        <ul class="tx-liste" data-liste></ul>
        <div data-aucun hidden>${vide({ niveau: 2, icone: 'search', titre: 'Aucune fiche trouvée',
          texte: "Cela ne veut pas dire que ce n'est pas dangereux. En cas de doute ou d'ingestion, appelez votre vétérinaire ou un centre antipoison vétérinaire." })}</div>
      </section>

      <footer class="tx-pied">
        <p>Les niveaux (pas de toxicité grave connue, prudence, toxique, très toxique) sont une classification simplifiée de l'appli, établie d'après les sources citées sur chaque fiche. Ils ne remplacent pas l'avis d'un vétérinaire. Les fiches ne contiennent ni dose ni traitement. Sources consultées en ${echapper(DATE_VERIFICATION)}.</p>
        <p>Numéros des centres antipoison vétérinaires : CNITV, ${echapper(CENTRES_ANTIPOISON[0].horaires)}. Un centre antipoison ne remplace pas une consultation : si l'animal va mal, allez chez le vétérinaire.</p>
        <p>${FICHES.length} fiches. Une espèce absente d'une fiche signifie « pas d'information vérifiée », jamais « sans danger ».</p>
      </footer>
    </div>`;

  const liste = zone.querySelector('[data-liste]');
  const resultat = zone.querySelector('[data-resultat]');
  const aucun = zone.querySelector('[data-aucun]');
  const sections = zone.querySelector('[data-sections]');
  const noteEspece = zone.querySelector('[data-note-espece]');

  function afficher() {
    const g = etat.groupe;
    const mots = normaliser(etat.q).split(' ').filter(Boolean);
    const trouve = (f) => (etat.cat === 'tous' || f.cat === etat.cat) && mots.every((m) => f._texte.includes(m));
    const rang = (f) => NIVEAUX[f.niveaux[g.id]].rang;
    const avec = fiches.filter((f) => f.niveaux[g.id] && trouve(f)).sort((a, b) => rang(a) - rang(b) || a.nom.localeCompare(b.nom, 'fr'));
    // Avec une recherche, on montre aussi ce qui existe pour d'autres espèces : l'absence d'information ne doit pas passer pour « sans danger »
    const sans = mots.length ? fiches.filter((f) => !f.niveaux[g.id] && trouve(f)).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')) : [];
    const unique = mots.length > 0 && avec.length + sans.length === 1;
    if (mots.length) {
      // Pendant une recherche : les résultats directement, sans sections
      sections.innerHTML = '';
      liste.hidden = false;
      liste.innerHTML = [...avec, ...sans].map((f, i) => carte(f, g, i, unique)).join('');
    } else {
      liste.hidden = true;
      liste.innerHTML = '';
      let i = 0;
      sections.innerHTML = Object.keys(NIVEAUX).sort((a, b) => NIVEAUX[a].rang - NIVEAUX[b].rang).map((n) => {
        const dans = avec.filter((f) => f.niveaux[g.id] === n);
        if (!dans.length) return '';
        const ouverte = etat.ouvertes.has(n);
        return `
        <section class="tx-section tx-section--${n}" data-niveau-section="${n}">
          <h3 class="tx-section__titre"><button type="button" class="tx-section__tete" aria-expanded="${ouverte}" aria-controls="tx-sec-${n}" data-section="${n}">
            <span class="tx-section__nom">${icone(NIVEAUX[n].icone, { taille: 20 })}${echapper(NIVEAUX[n].texte)} <span class="tx-section__n">(${dans.length})</span></span>
            <span class="tx-carte__fleche" aria-hidden="true">${icone('chevron-down', { taille: 18 })}</span></button></h3>
          <ul class="tx-liste" id="tx-sec-${n}"${ouverte ? '' : ' hidden'}>${dans.map((f) => carte(f, g, i++, false)).join('')}</ul>
        </section>`;
      }).join('');
    }
    aucun.hidden = avec.length + sans.length > 0;
    const n = avec.length;
    resultat.textContent = mots.length
      ? `${n} fiche${n > 1 ? 's' : ''} pour ${g.nom.toLowerCase()}${sans.length ? `, et ${sans.length} sans information vérifiée pour cette espèce` : ''}.`
      : `${n} fiche${n > 1 ? 's' : ''} pour ${g.nom.toLowerCase()}, du plus au moins dangereux.`;
    noteEspece.textContent = NOTES_ESPECE[g.id] ?? '';
    noteEspece.hidden = !NOTES_ESPECE[g.id];
  }

  zone.querySelector('.tx-especes').addEventListener('change', (e) => {
    const g = ESPECES_TOXIQUE.find((x) => x.id === e.target.value);
    if (!g) return;
    etat.groupe = g;
    zone.querySelector('[data-defaut]').hidden = !(defaut.animal && g.id === defaut.groupe.id);
    afficher();
  });
  zone.querySelector('#tx-q').addEventListener('input', (e) => { etat.q = e.target.value; afficher(); });
  zone.querySelector('.tx-filtres').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    etat.cat = b.dataset.cat;
    zone.querySelectorAll('.tx-filtres [data-cat]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    afficher();
  });
  sections.addEventListener('click', (e) => {
    const b = e.target.closest('[data-section]');
    if (!b) return;
    const ouvert = b.getAttribute('aria-expanded') !== 'true';
    etat.ouvertes[ouvert ? 'add' : 'delete'](b.dataset.section);
    b.setAttribute('aria-expanded', String(ouvert));
    document.getElementById(b.getAttribute('aria-controls')).hidden = !ouvert;
  });
  zone.querySelector('.pg--toxique').addEventListener('click', (e) => {
    const tete = e.target.closest('.tx-carte__tete');
    if (!tete) return;
    const ouvert = tete.getAttribute('aria-expanded') !== 'true';
    tete.setAttribute('aria-expanded', String(ouvert));
    document.getElementById(tete.getAttribute('aria-controls')).hidden = !ouvert;
  });
  // Entrée dans le champ : pas de rechargement, on cache le clavier de l'iPhone pour voir les résultats
  zone.querySelector('#tx-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });

  afficher();
}
