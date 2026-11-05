// Navigation de l'application (étape 4) : barre latérale, barre supérieure, barre du bas et recherche.
//
// UNE SEULE LISTE (NAV) décrit les entrées. Elle sert aux trois dispositions :
//   - barre latérale (tablette et ordinateur) : toutes les entrées ;
//   - barre du bas (téléphone) : seulement celles marquées `bas: true` (5 entrées) ; les Rappels y sont remplacés
//     par la cloche de la barre du haut (même adresse, même nombre de retards) ;
//   - Communauté et Professionnels restent accessibles sur téléphone depuis l'Accueil et le Profil.
//
// POUR AJOUTER UNE PAGE : créer son module, l'enregistrer avec route() dans js/app.js,
// puis ajouter une ligne dans NAV (et dans TITRES si la page a un titre particulier).

import * as storage from './storage.js';
import { icone } from './icons.js';
import { echapper } from './utils.js';
import { badge, compteur, bouton } from './composants.js';
import { compterEnRetard } from '../modules/animaux/rappels.js';
import { infosEspece, nomEspece } from '../modules/animaux/commun.js';

// `actif(seg)` dit si l'entrée correspond à la page affichée (seg = morceaux de l'adresse : ['animaux', 'rappels']).
export const NAV = [
  { id: 'accueil', titre: 'Accueil', court: 'Accueil', icone: 'house', href: '#/accueil', bas: true, actif: (s) => s[0] === 'accueil' },
  { id: 'animaux', titre: 'Mes animaux', court: 'Animaux', icone: 'paw-print', href: '#/animaux', bas: true, actif: (s) => s[0] === 'animaux' && s[1] !== 'rappels' },
  // Rappels : adresse inchangée (#/animaux/rappels) pour ne casser aucun lien. Sur téléphone, la cloche de la barre du haut y mène.
  { id: 'rappels', titre: 'Rappels', court: 'Rappels', icone: 'bell', href: '#/animaux/rappels', compteurRetards: true, actif: (s) => s[0] === 'animaux' && s[1] === 'rappels' },
  { id: 'carte', titre: 'Carte Patte', court: 'Carte', icone: 'map-pin', href: '#/carte', bas: true, bientot: true, actif: (s) => s[0] === 'carte' },
  { id: 'boutique', titre: 'Boutique', court: 'Boutique', icone: 'shopping-bag', href: '#/boutique', bas: true, bientot: true, actif: (s) => s[0] === 'boutique' },
  { id: 'communaute', titre: 'Communauté', court: 'Communauté', icone: 'users', href: '#/communaute', bientot: true, actif: (s) => s[0] === 'communaute' },
  { id: 'pro', titre: 'Professionnels', court: 'Pro', icone: 'briefcase-business', href: '#/pro', bientot: true, actif: (s) => s[0] === 'pro' },
  // Le Profil est en bas de la barre latérale ; la page Sauvegarde en dépend
  { id: 'profil', titre: 'Profil', court: 'Profil', icone: 'user', href: '#/profil', bas: true, pied: true, actif: (s) => s[0] === 'profil' || s[0] === 'donnees' },
];

// Titre de l'onglet du navigateur selon la page
function titrePage(seg) {
  if (seg[0] === 'animaux') return seg[1] === 'rappels' ? 'Rappels' : seg[1] ? 'Fiche animal' : 'Mes animaux';
  const direct = { donnees: 'Sauvegarde', bientot: 'Bientôt', composants: 'Composants' }[seg[0]];
  return direct ?? NAV.find((n) => n.actif(seg))?.titre ?? 'Page introuvable';
}

const el = (id) => document.getElementById(id);

// ----- Construction -----

const itemLateral = (n) => `
  <li><a class="cp-nav-item" href="${n.href}" data-nav="${n.id}" data-etiquette="${echapper(n.titre)}">
    ${icone(n.icone, { taille: 22 })}<span class="app-nav__texte">${echapper(n.titre)}</span>${n.bientot ? badge({ texte: 'Bientôt', variante: 'bientot' }) : ''}${n.compteurRetards ? '<span class="cp-compteur app-nav__compteur" data-retards hidden></span>' : ''}
  </a></li>`;

const itemBas = (n) => `
  <a class="cp-nav-bas__item" href="${n.href}" data-nav="${n.id}">
    <span class="cp-nav-bas__icone">${icone(n.icone, { taille: 22 })}</span>${echapper(n.court)}
  </a>`;

const logo = () => `
  <a class="app-marque" href="#/accueil" aria-label="Carnet Patte, accueil">
    <span class="app-marque__logo">${icone('paw-print', { taille: 22 })}</span><span class="app-marque__nom">Carnet Patte</span>
  </a>`;

export function construireNavigation() {
  el('barre-laterale').innerHTML = `
    ${logo()}
    <nav class="app-lateral__nav" aria-label="Navigation principale">
      <ul class="cp-nav-liste">${NAV.filter((n) => !n.pied).map(itemLateral).join('')}</ul>
      <ul class="cp-nav-liste app-lateral__pied">${NAV.filter((n) => n.pied).map(itemLateral).join('')}</ul>
    </nav>`;

  el('nav-bas').innerHTML = `<div class="cp-nav-bas">${NAV.filter((n) => n.bas).map(itemBas).join('')}</div>`;

  el('barre-haut').innerHTML = `
    ${logo()}
    <div class="app-recherche" role="search">
      <div class="cp-champ__zone">
        ${icone('search', { taille: 20 })}
        <input class="cp-input" id="recherche-champ" type="search" role="combobox" aria-expanded="false" aria-controls="recherche-liste"
               aria-autocomplete="list" autocomplete="off" placeholder="Rechercher un animal…" aria-label="Rechercher un animal">
      </div>
      <ul class="app-recherche__liste" id="recherche-liste" role="listbox" aria-label="Résultats de la recherche" hidden></ul>
      <span class="cp-sr" id="recherche-etat" role="status"></span>
    </div>
    <div class="app-haut__actions">
      ${bouton({ variante: 'discret', seul: true, icone: 'search', titre: 'Rechercher', attrs: { class: 'cp-btn cp-btn--discret cp-btn--icone app-bouton-recherche', 'aria-expanded': 'false', id: 'recherche-bouton' } })}
      <a class="cp-btn cp-btn--discret cp-btn--icone app-notif" href="#/animaux/rappels" id="notif-lien" aria-label="Rappels">
        ${icone('bell', { taille: 20 })}<span class="cp-compteur" id="notif-nombre" hidden></span>
      </a>
      <a class="app-profil" href="#/profil" id="profil-lien" aria-label="Profil">${icone('user', { taille: 20 })}</a>
    </div>`;

  el('evitement').addEventListener('click', () => el('contenu').focus());
  initialiserRecherche();
  majRappels();
  window.addEventListener('donnees-modifiees', majRappels);
}

// ----- Rappels en retard (cloche) -----

export function majRappels() {
  const n = compterEnRetard();
  const libelle = n ? `Rappels : ${n} en retard` : 'Rappels';
  const pastille = el('notif-nombre');
  pastille.textContent = n;
  pastille.hidden = n === 0;
  el('notif-lien').setAttribute('aria-label', libelle);
  // Entrée « Rappels » de la barre latérale : le nombre est visible, le lien est nommé en entier pour les lecteurs d'écran
  document.querySelectorAll('[data-nav="rappels"]').forEach((a) => {
    a.setAttribute('aria-label', libelle);
    a.dataset.etiquette = libelle; // info-bulle de la barre réduite (tablette)
    const c = a.querySelector('[data-retards]');
    c.textContent = n;
    c.hidden = n === 0;
  });
}

// ----- Page courante -----

let routePrecedente = null;

/** Appelée après chaque affichage : page active, titre de l'onglet, focus et animation d'entrée. */
export function majNavigation(seg) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const n = NAV.find((x) => x.id === a.dataset.nav);
    if (n.actif(seg)) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (NAV.find((x) => x.id === 'profil').actif(seg)) el('profil-lien').setAttribute('aria-current', 'page');
  else el('profil-lien').removeAttribute('aria-current');
  if (NAV.find((x) => x.id === 'rappels').actif(seg)) el('notif-lien').setAttribute('aria-current', 'page');
  else el('notif-lien').removeAttribute('aria-current');
  majRappels();

  const cle = seg.join('/');
  if (cle === routePrecedente) return; // simple rafraîchissement après une modification : on ne touche à rien
  const premiere = routePrecedente === null;
  routePrecedente = cle;

  const titre = titrePage(seg);
  document.title = `${titre} · Carnet Patte`;
  const page = el('contenu').firstElementChild;
  if (page && !premiere) page.classList.add('page-entree');
  if (!premiere) {
    el('contenu').focus({ preventScroll: true }); // lecteurs d'écran : on repart du début de la nouvelle page
    el('annonce-page').textContent = titre;
  }
  fermerRecherche();
}

// ----- Recherche d'animaux -----

const normaliser = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
let resultats = [];
let actif = -1;

function chercher(texte) {
  const q = normaliser(texte);
  if (!q) return [];
  return storage.lister('animaux')
    .filter((a) => normaliser(a.nom).includes(q) || normaliser(nomEspece(a)).includes(q) || normaliser(a.race ?? '').includes(q))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    .slice(0, 6);
}

function afficherResultats(texte) {
  const liste = el('recherche-liste');
  const champ = el('recherche-champ');
  resultats = chercher(texte);
  actif = -1;
  champ.removeAttribute('aria-activedescendant');
  if (!texte.trim()) { fermerListe(); return; }
  liste.innerHTML = resultats.length
    ? resultats.map((a, i) => `
        <li class="app-recherche__option" role="option" id="recherche-opt-${i}" aria-selected="false" data-id="${echapper(a.id)}">
          <span class="cp-avatar" aria-hidden="true">${icone(infosEspece(a).icone, { taille: 20 })}</span>
          <span class="app-recherche__texte"><span class="app-recherche__nom">${echapper(a.nom)}</span>
          <span class="app-recherche__meta">${echapper([nomEspece(a), a.race].filter(Boolean).join(' · '))}</span></span>
        </li>`).join('')
    : `<li class="app-recherche__vide" role="presentation">Aucun animal ne correspond à « ${echapper(texte.trim())} ».</li>`;
  liste.hidden = false;
  champ.setAttribute('aria-expanded', 'true');
  el('recherche-etat').textContent = resultats.length ? `${resultats.length} résultat${resultats.length > 1 ? 's' : ''}` : 'Aucun résultat';
}

function fermerListe() {
  el('recherche-liste').hidden = true;
  el('recherche-champ').setAttribute('aria-expanded', 'false');
  el('recherche-champ').removeAttribute('aria-activedescendant');
  actif = -1;
}

function choisir(i) {
  const a = resultats[i];
  if (!a) return;
  el('recherche-champ').value = '';
  fermerRecherche();
  location.hash = `#/animaux/${encodeURIComponent(a.id)}`;
}

function surligner(i) {
  const options = [...el('recherche-liste').querySelectorAll('[role="option"]')];
  options.forEach((o, k) => o.setAttribute('aria-selected', String(k === i)));
  actif = i;
  const champ = el('recherche-champ');
  if (options[i]) { champ.setAttribute('aria-activedescendant', options[i].id); options[i].scrollIntoView({ block: 'nearest' }); }
  else champ.removeAttribute('aria-activedescendant');
}

/** Referme la liste ; sur téléphone, referme aussi le champ déplié. */
export function fermerRecherche() {
  fermerListe();
  const haut = el('barre-haut');
  if (haut.classList.contains('app-haut--recherche')) {
    haut.classList.remove('app-haut--recherche');
    const b = el('recherche-bouton');
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-label', 'Rechercher');
    b.innerHTML = icone('search', { taille: 18 });
  }
}

function initialiserRecherche() {
  const champ = el('recherche-champ');
  const liste = el('recherche-liste');
  const haut = el('barre-haut');

  champ.addEventListener('input', () => afficherResultats(champ.value));
  champ.addEventListener('focus', () => { if (champ.value.trim()) afficherResultats(champ.value); });
  champ.addEventListener('keydown', (e) => {
    const n = resultats.length;
    if (e.key === 'ArrowDown' && n) { e.preventDefault(); surligner((actif + 1) % n); }
    else if (e.key === 'ArrowUp' && n) { e.preventDefault(); surligner((actif - 1 + n) % n); }
    else if (e.key === 'Enter' && n) { e.preventDefault(); choisir(actif >= 0 ? actif : 0); }
    else if (e.key === 'Escape') {
      if (!liste.hidden || champ.value) { champ.value = ''; fermerListe(); } else fermerRecherche();
    }
  });
  liste.addEventListener('mousedown', (e) => e.preventDefault()); // garde le focus dans le champ
  liste.addEventListener('click', (e) => {
    const option = e.target.closest('[role="option"]');
    if (option) choisir([...liste.children].indexOf(option));
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.app-recherche') && !e.target.closest('#recherche-bouton')) fermerListe(); });

  // Téléphone : l'icône déplie ou referme le champ
  el('recherche-bouton').addEventListener('click', () => {
    const ouvert = haut.classList.toggle('app-haut--recherche');
    const b = el('recherche-bouton');
    b.setAttribute('aria-expanded', String(ouvert));
    b.setAttribute('aria-label', ouvert ? 'Fermer la recherche' : 'Rechercher');
    b.innerHTML = icone(ouvert ? 'x' : 'search', { taille: 18 });
    if (ouvert) champ.focus(); else { champ.value = ''; fermerListe(); }
  });
}
