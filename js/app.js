// Point d'entrée de l'appli : enregistre les pages, construit la navigation, démarre le routeur.
//
// POUR AJOUTER UN MODULE PLUS TARD :
//   1. créer son dossier dans /modules (avec une fonction rendre(zone, segments))
//   2. l'importer ici et ajouter  route('nom', rendre)
//   3. ajouter une entrée dans NAV (js/navigation.js)

import * as storage from './storage.js';
import { route, demarrer } from './router.js';
import { construireNavigation, majNavigation } from './navigation.js';
import { rendre as rendreAccueil } from '../modules/accueil/accueil.js';
import { rendre as rendreAnimaux } from '../modules/animaux/animaux.js';
import { rendre as rendreCarte } from '../modules/carte/carte.js';
import { rendre as rendreBoutique } from '../modules/boutique/boutique.js';
import { rendre as rendreCommunaute } from '../modules/communaute/communaute.js';
import { rendre as rendrePro } from '../modules/pro/pro.js';
import { rendre as rendreProfil } from '../modules/profil/profil.js';
import { ajouterExemples } from '../modules/animaux/exemples.js';
import { rendre as rendreDonnees } from './donnees.js';
import { rendre as rendreBientot } from './bientot.js';
import { afficherSecours } from './secours.js';
import { mesurerEtAdapter } from './fond.js';
import { rendre as rendreComposants } from '../modules/composants/composants.js';

// ----- Routes -----
route('accueil', rendreAccueil);
route('animaux', rendreAnimaux);
route('carte', rendreCarte);
route('boutique', rendreBoutique);
route('communaute', rendreCommunaute);
route('pro', rendrePro);
route('profil', rendreProfil);
route('donnees', rendreDonnees);
route('bientot', rendreBientot);
route('composants', rendreComposants); // page de référence du design, pas dans le menu

// ----- Données enregistrées illisibles : on n'écrase RIEN, on explique et on propose de les exporter (js/secours.js) -----
const etatDonnees = storage.etatDonnees();
if (etatDonnees) {
  afficherSecours(etatDonnees);
} else {
  // ----- Premier lancement : quelques animaux d'exemple -----
  if (!storage.exemplesDejaAjoutes()) ajouterExemples();

  // ----- Navigation (barre latérale, barre du haut, barre du bas) -----
  construireNavigation();

  // ----- Démarrage -----
  demarrer(document.getElementById('contenu'), majNavigation);

  // ----- Décor animé : figé automatiquement si l'appareil a du mal à le jouer (js/fond.js) -----
  mesurerEtAdapter();
}
