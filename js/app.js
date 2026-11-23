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
import { rendre as rendreToxique } from '../modules/toxique/toxique.js';
import { ajouterExemples } from '../modules/animaux/exemples.js';
import { rendre as rendreDonnees } from './donnees.js';
import { rendre as rendreBientot } from './bientot.js';
import { afficherSecours } from './secours.js';
import { mesurerEtAdapter } from './fond.js';
import { initialiserTheme } from './theme.js';
import { initialiserPwa } from './pwa.js';
import { afficherBandeauDemenagement } from './adresse.js';
import { rendre as rendreComposants } from '../modules/composants/composants.js';
import { rendre as rendreApropos, rendreMentions, rendreConfidentialite } from '../modules/apropos/apropos.js';
import { rendre as rendreCompte } from '../modules/compte/compte.js';

// ----- Thème de couleur (mémorisé sur l'appareil) -----
initialiserTheme();

// ----- Appli installable et hors ligne (service worker, bannière de mise à jour) -----
initialiserPwa();
afficherBandeauDemenagement(); // seulement sur l'ancienne adresse (GitHub Pages) : à retirer quand elle sera fermée

// ----- Routes -----
route('accueil', rendreAccueil);
route('animaux', rendreAnimaux);
route('carte', rendreCarte);
route('boutique', rendreBoutique);
route('communaute', rendreCommunaute);
route('pro', rendrePro);
route('profil', rendreProfil);
route('toxique', rendreToxique);
route('donnees', rendreDonnees);
route('bientot', rendreBientot);
route('compte', rendreCompte); // essai de connexion (facultatif) : invisible tant que js/supabase-config.js est vide
route('apropos', rendreApropos);
route('mentions', (zone) => rendreMentions(zone)); // la fonction a d'autres paramètres (tests) : on ne lui passe que la zone
route('confidentialite', (zone) => rendreConfidentialite(zone)); // idem : seulement la zone
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
