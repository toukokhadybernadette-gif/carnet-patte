# Module 4 « Boutique » : en cours (branche `boutique`, pas encore publié)

Version d'avant : `main` (tag `avant-carte` = avant le module 3). Retour arrière après publication : `git revert -m 1 <commit de merge>` puis `git push origin main`.

## Ce que c'est
Une sélection de 37 accessoires du quotidien (`modules/boutique/produits.js`) : liens vers des sites marchands (Animalis, Maxi Zoo, Zooplus), jamais de vente directe. Rangement par espèce et par besoin, bloc « Pour [nom] » sur la fiche d'un animal, alternative sûre sous un aliment dangereux dans « Toxique ? ».

## À relire à la main avant de publier
- **La sélection est éditoriale** : j'ai choisi des TYPES de produits (harnais, litière, cage…) et des pages de catégories des sites marchands, chacune vérifiée le 2026-11-21 (page trouvée, pas de renvoi vers l'accueil). Les phrases « pourquoi » sont des conseils généraux, jamais des promesses sur une marque. Un seul produit nomme une marque (Kong Classic). À vous de garder, retirer ou compléter.
- **Aucun lien n'est encore affilié** (`lienAffilie` vide). Il faut d'abord s'inscrire aux programmes d'affiliation des marchands ; l'affiliation est refusée ou soumise à conditions chez certains. La mention est AUTOMATIQUE : « Sélection indépendante : Carnet Patte ne touche aucune commission sur ces liens pour l'instant. » tant qu'aucun `lienAffilie` n'est rempli ; dès qu'un seul l'est, « Liens affiliés : … » s'affiche sur la page et dans tous les blocs.
- Pas de prix, pas de note, pas d'avis : à ne jamais ajouter sans source.
- Les sites marchands changent leurs adresses : `node tests/lancer.mjs boutique-liens` (à la main) revérifie les 37 liens. Wanimo, essayé au départ, bloque les contrôles automatiques (429) : retiré.

## À vérifier à la main (non testé automatiquement)
Safari sur iPhone : ouverture d'un lien dans un nouvel onglet (« Voir le prix »), défilement des deux rangées de pastilles au doigt, lisibilité de la mention d'affiliation.

# Module 3 « Carte Patte » : en cours (branche `carte`, pas encore publié)

Version d'avant : `main` (avant la fusion de la branche `carte`). Retour arrière après publication : `git revert -m 1 <commit de merge>` puis `git push origin main`.
Le module ne modifie jamais les données des animaux (testé dans `tests/test-carte.mjs`, avec des réponses simulées : aucun vrai serveur n'est appelé).

## À savoir
- La géolocalisation du navigateur n'existe qu'en **HTTPS** (ou sur `localhost`). Sur iPhone via le Wi-Fi en `http://192.168…`, « Autour de moi » ne marche pas : utiliser le champ « Ville ou code postal », ou tester « Autour de moi » sur le site publié (HTTPS).
- **Lieux préparés à l'avance (France métropolitaine)** : `donnees/lieux/<département>.json` + `index.json` + `LICENCE.txt` (ODbL), lus directement par l'appli (instantané, la position ne quitte pas l'appareil). Première extraction réelle (extrait OpenStreetMap du 2026-11-20) : 8 159 lieux, 96 départements, 830 Ko bruts / 325 Ko compressés. Mise à jour mensuelle : `.github/workflows/lieux-mensuel.yml` ouvre une Pull Request à valider (voir `outils/LISEZMOI.md`). **À faire une fois dans GitHub** : Settings > Actions > General > « Allow GitHub Actions to create and approve pull requests ». Hors métropole ou fichiers illisibles : repli automatique sur Overpass.
- **Navigation** : barre du bas = 5 icônes (Accueil, Animaux, Carte, Rappels, Profil) + « + » séparé ; « Carte Patte » n'est plus dans le menu ☰. À 320 px les onglets font 36 px de large (au-dessus du minimum WCAG de 24 px, sous les 44 px recommandés par Apple).
- **Carte** : marqueurs regroupés en bulles (Leaflet.markercluster 1.5.3, `assets/leaflet-markercluster/`) ; au-delà de 300 lieux dans le rayon, l'appli propose un rayon plus petit (« Beaucoup de lieux ici (447) : passer à 5 km ? »). Paris à 10 km : 447 lieux, 8 bulles, affichage en 1,5 s sur un processeur ralenti 4 fois. Lieux sans nom : « Vétérinaire · rue X » (rue du lieu, ou rue du point d'adresse OpenStreetMap le plus proche à moins de 150 m, déduite à l'extraction : 1 337 des 2 022 lieux sans nom en ont une). Les marqueurs d'un lieu choisi sortent de leur bulle sans passer par `zoomToShowLayer` du plugin, qui laisse un écouteur en attente et plante quand les marqueurs sont remplacés.
- **Serveurs Overpass, désormais SEULEMENT en secours (constaté le 2026-11-21)** : `overpass-api.de` est souvent saturé (« 502 … at capacity ») et, quand il accepte la requête, met 33 à 45 s à répondre ; l'appli attend jusqu'à 55 s, affiche une progression, et passe au serveur suivant à la moindre erreur (détails dans le message d'erreur et dans la console, préfixe `[Carte Patte]`). `overpass.openstreetmap.fr` est exclu : « service réservé à des usages autorisés » (403 sans en-tête CORS, vu par le navigateur comme une erreur CORS). `overpass.kumi.systems` et `overpass.private.coffee` ne répondaient pas ce jour-là. `maps.mail.ru` (VK, Russie) a été retiré : pas de serveur hors d'Europe (vie privée, RGPD). Pour savoir quels serveurs répondent : `node tests/lancer.mjs carte-reel` (vrais serveurs, à la main seulement).
- Règles d'usage d'OpenStreetMap respectées : une recherche à la fois, 1,5 s minimum entre deux requêtes, lieux gardés 6 h (zone arrondie à 1 km, jamais la position exacte). Les serveurs publics (Overpass, Nominatim, tuiles) n'ont aucune garantie de disponibilité : l'appli affiche un message et « Réessayer ».
- Les lieux viennent d'OpenStreetMap et sont parfois incomplets ou périmés : l'appli n'affiche jamais « ouvert 24h/24 » sauf si la donnée dit exactement `24/7`, et n'indique jamais si un lieu est ouvert « maintenant ».

## À vérifier à la main (non testé automatiquement)
Safari sur iPhone : fenêtre de permission de localisation (en HTTPS), défilement de la page avec la carte sous le doigt, appui sur « Itinéraire » (Plans) et « Appeler », taille des marqueurs, clavier du champ « Ville ».

# Refonte du design (5h) : publiée

Fusionnée sur `main` après validation en local. Version d'avant : tag `avant-refonte-5h` (commit `6d4e74c`).

## Retour arrière rapide
1. `git revert -m 1 <commit de merge>` puis `git push origin main` (annule la fusion sans réécrire l'historique).
2. Les données des utilisateurs ne sont pas touchées : l'ancienne version relit celles de la nouvelle (`tests/test-migration.mjs`). Seuls le prénom et les couleurs d'animaux (champs ajoutés) sont ignorés par l'ancienne version.

## Tests
`node tests/lancer.mjs` (voir `tests/LISEZMOI.md`).

## À vérifier à la main (non testé automatiquement)
Safari et iPhone, Firefox, et la fluidité des bulles de fond sur un vrai téléphone. Si le fond saccade : retirer le `<link>` de `css/verre.css` et la balise `.app-fond` dans `index.html`.

# Module 2 « Toxique ? » : en cours (branche `module-toxique`, pas encore publié)

Version d'avant : tag `avant-toxique` (sur `main`). Retour arrière après publication : `git revert -m 1 <commit de merge>` puis `git push origin main`.
Le module ne modifie jamais les données des animaux (testé dans `tests/test-toxique.mjs`).

## À relire à la main avant de publier
- `modules/toxique/donnees.js` : 91 fiches, chacune avec ses sources. Relire surtout les niveaux (classification simplifiée de l'appli) et les fiches pour lapins, rongeurs, oiseaux et poules (sources moins nombreuses : Merck, Wood Green, PetMD, UF/IFAS).
- Numéro de CAPAE-Ouest (02 40 68 77 40) : publié par Oniris, mais d'autres sites en citent d'autres ; à recontrôler.
- Champignons sauvages : volontairement absents (aucune source vétérinaire française vérifiée).

## À vérifier à la main (non testé automatiquement)
Safari sur iPhone : saisie dans la recherche (pas de zoom), clavier, appui sur les numéros (`tel:`), rebond des pastilles et des fiches, défilement des filtres.
