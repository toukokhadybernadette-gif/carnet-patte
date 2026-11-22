# Carnet Patte

Application web pour les propriétaires d'animaux (module 1 : animaux, soins, rappels, pesées ; module 2 : « Toxique ? », aliments, plantes et produits dangereux selon l'espèce ; module 3 : « Carte Patte », vétérinaires, parcs à chiens, animaleries, toiletteurs et refuges autour de soi ; module 4 : « Boutique », une sélection d'accessoires avec des liens vers des sites marchands).

## Lancer
1. Ouvrir ce dossier dans VS Code.
2. Installer l'extension **Live Server** (Ritwick Dey).
3. Clic droit sur `index.html` → **Open with Live Server** (ou bouton « Go Live » en bas à droite).

Ouvrir `index.html` par double-clic ne fonctionne pas (les modules JS exigent un serveur).

## Organisation
- `js/` : cœur de l'appli (stockage, routeur, interface, sauvegarde)
- `css/` : styles communs
- `modules/<nom>/` : un dossier par module (`animaux`, `toxique`, `carte` et `boutique` sont réalisés ; les fiches de « Toxique ? » sont dans `modules/toxique/donnees.js`)
- `assets/leaflet/` : Leaflet 1.9.4 (licence BSD-2), et `assets/leaflet-markercluster/` : Leaflet.markercluster 1.5.3 (licence MIT, regroupement des marqueurs en bulles), hébergés ici et chargés seulement sur la page Carte. Fond de carte et lieux : © contributeurs d'OpenStreetMap (ODbL). Le module Carte contacte `nominatim.openstreetmap.org` (ville ou code postal), `tile.openstreetmap.org` (fond de carte) et, seulement hors France métropolitaine ou si les fichiers `donnees/lieux/` sont illisibles, des serveurs Overpass publics (liste `SERVEURS_OVERPASS` dans `modules/carte/carte-donnees.js`), une recherche à la fois.
- `donnees/lieux/` : lieux utiles aux animaux de la France métropolitaine, un fichier JSON par département (base dérivée d'OpenStreetMap, licence ODbL : voir `LICENCE.txt`). Mise à jour mensuelle par Pull Request automatique.
- `outils/` : script d'extraction de ces lieux (`extraire-lieux.py`) et ses tests ; voir `outils/LISEZMOI.md`.
- `modules/boutique/produits.js` : la sélection (nom, besoin, espèces, « pourquoi », marchand, lien, `lienAffilie`). Aucun médicament ni complément de santé, aucun prix, aucun avis. Mention d'affiliation toujours visible ; liens en `rel="sponsored noopener"`.
- **Appli installable et hors ligne** : `manifest.webmanifest`, `sw.js` (service worker) et `assets/icons/pwa/` (icônes et écrans de démarrage iPhone, refaits par `outils/generer-icones-pwa.mjs`). Pendant le développement `sw.js` ne met rien en cache (`VERSION = 'dev'`) ; à la publication, l'Action « Publier le site » y écrit la version (le commit) et la liste des fichiers (`outils/preparer-sw.mjs`). Une nouvelle version s'affiche sous forme de bannière « Nouvelle version disponible — Mettre à jour » (`js/pwa.js`) ; les données des animaux (localStorage) ne passent jamais par le cache.
- **Ajouter au calendrier** : `js/ics.js` (fichier .ics) et `modules/animaux/calendrier.js` (boutons). Le fichier est créé sur l'appareil, rien n'est envoyé.
- **Documents** (onglet de la fiche) : photos et PDF gardés dans IndexedDB (`js/documents-db.js`), photos réduites à 1 600 px, inclus dans l'export/import (`js/sauvegarde.js`, avertissement au-delà de 25 Mo), effacés avec « Tout effacer » et avec l'animal.
- **Fiche de garde** (`modules/animaux/garde.js`, `js/pdf.js`) : formulaire en sections repliables, aperçu, PDF créé sur l'appareil sans bibliothèque, partage avec avertissement ; stockée dans les données (`fichesGarde`).
- **Ferme / basse-cour** (`modules/ferme/ferme.js`) : un groupe est un animal avec `groupe: true` et `effectif` (soins, rappels, documents, calendrier comme les autres) ; collections `oeufs` et `stocks` (facultatives dans les exports).
- **Mode sombre** : `js/couleurs-sombre.js` (palette), `css/themes-sombre.css` (généré par `outils/generer-themes.mjs`, avec contrôle de contraste), `css/sombre.css` (couleurs écrites en dur) ; choix Clair / Sombre / Automatique dans Profil (`js/theme.js`).
- **Publication** : Cloudflare Pages (`carnet-patte.pages.dev`, offre gratuite) construit le site à chaque fusion sur `main` avec `node outils/assembler-site.mjs` (dossier `_site`) : marche à suivre dans `DEPLOIEMENT-CLOUDFLARE.md`. L'ancienne adresse GitHub Pages (`.github/workflows/pages.yml`, même script) reste ouverte avec un bandeau et la page `demenagement.html` jusqu'à fermeture décidée par l'éditeur. `_headers` : en-têtes de Cloudflare.
- **À propos et Mentions légales** : `modules/apropos/apropos.js` ; les informations de l'éditeur (nom, SIRET, e-mail) sont à remplir dans `js/mentions-config.js` (pas d'adresse postale sans décision de l'éditeur).

