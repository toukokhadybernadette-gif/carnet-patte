// Point d'entrée de l'appli : construit le menu, enregistre les modules, démarre le routeur.
//
// POUR AJOUTER UN MODULE PLUS TARD :
//   1. créer son dossier dans /modules (avec une fonction rendre(zone, segments))
//   2. l'importer ici et ajouter  route('nom', rendre)
//   3. ajouter une entrée dans MENU

import * as storage from './storage.js';
import { route, demarrer } from './router.js';
import { echapper } from './utils.js';
import { rendre as rendreAnimaux } from '../modules/animaux/animaux.js';
import { compterEnRetard } from '../modules/animaux/rappels.js';
import { ajouterExemples } from '../modules/animaux/exemples.js';
import { rendre as rendreDonnees } from './donnees.js';
import { rendre as rendreBientot, MODULES_A_VENIR } from './bientot.js';

// ----- Routes -----
route('animaux', rendreAnimaux);
route('donnees', rendreDonnees);
route('bientot', rendreBientot);

// ----- Premier lancement : quelques animaux d'exemple -----
if (!storage.exemplesDejaAjoutes()) ajouterExemples();

// ----- Menu -----
// `actif(seg)` dit si l'entrée est la page courante. `rappels: true` ajoute la pastille de rappels en retard.
const MENU = [
  { href: '#/animaux', icone: '🐾', titre: 'Mes animaux', actif: (s) => s[0] === 'animaux' && s[1] !== 'rappels' },
  { href: '#/animaux/rappels', icone: '🔔', titre: 'Rappels', actif: (s) => s[0] === 'animaux' && s[1] === 'rappels', rappels: true },
  // Sur téléphone : un seul bouton « Bientôt »
  { href: '#/bientot', icone: '🧭', titre: 'Bientôt', actif: (s) => s[0] === 'bientot', classe: 'mobile-seulement' },
  // Sur ordinateur : un lien par module à venir
  ...MODULES_A_VENIR.map((m) => ({
    href: `#/bientot/${m.id}`, icone: m.icone, titre: m.titre,
    actif: (s) => s[0] === 'bientot' && s[1] === m.id, classe: 'desktop-seulement', groupe: 'Bientôt',
  })),
  { href: '#/donnees', icone: '💾', titre: 'Sauvegarde', actif: (s) => s[0] === 'donnees', groupe: 'Données' },
];

const menu = document.getElementById('menu');

function construireMenu() {
  let html = '<div class="marque">🐾 Carnet Patte</div><ul>';
  let groupeCourant = null;
  MENU.forEach((item, i) => {
    if (item.groupe && item.groupe !== groupeCourant) {
      html += `<li class="titre-groupe ${item.classe ?? ''}">${echapper(item.groupe)}</li>`;
    }
    groupeCourant = item.groupe ?? null;
    html += `<li class="${item.classe ?? ''}">
      <a href="${item.href}" data-i="${i}"><span class="icone">${item.icone}</span><span>${echapper(item.titre)}</span>
      ${item.rappels ? '<span class="pastille-nav" hidden></span>' : ''}</a></li>`;
  });
  menu.innerHTML = html + '</ul>';
}

function majMenu(seg = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean)) {
  menu.querySelectorAll('a').forEach((a) => {
    a.classList.toggle('actif', MENU[a.dataset.i].actif(seg));
  });
  const nb = compterEnRetard();
  const pastille = menu.querySelector('.pastille-nav');
  if (pastille) {
    pastille.textContent = nb;
    pastille.hidden = nb === 0;
  }
}

construireMenu();
window.addEventListener('donnees-modifiees', () => majMenu());

// ----- Démarrage -----
demarrer(document.getElementById('contenu'), majMenu);
