# Outils : lieux préparés à l'avance (Carte Patte)

La Carte Patte affiche les lieux utiles aux animaux (vétérinaires, parcs à chiens, animaleries, toiletteurs, refuges) **depuis des fichiers du site**, pas depuis un serveur public saturé : `donnees/lieux/<département>.json` (France métropolitaine). En dehors de la métropole, ou si ces fichiers sont illisibles, l'appli passe aux serveurs Overpass.

## Ce que contiennent les fichiers
- `donnees/lieux/index.json` : date de l'extrait, nombre de lieux par département, zone couverte par chaque fichier, contour simplifié de la France.
- `donnees/lieux/<code>.json` : un par département. Une ligne par lieu : `[id, catégorie, lat, lon, nom, adresse, téléphone, horaires, site web, rue]` (champs vides de fin omis). La « rue » n'existe que pour les lieux sans nom : la leur si OpenStreetMap la connaît, sinon celle du point d'adresse le plus proche à moins de 150 m (environ les deux tiers des lieux sans nom en ont une).
- `donnees/lieux/LICENCE.txt` : licence **ODbL 1.0**, attribution, source et modifications.
- Jamais de courriel ni de nom de personne (RGPD) ; le script les supprime.
- **Adresses manquantes** : OpenStreetMap n'a pas l'adresse de beaucoup de lieux. Pendant l'extraction, le script demande à la **Base Adresse Nationale** (Licence Ouverte 2.0), par le géocodage inverse de la Géoplateforme (`https://data.geopf.fr/geocodage/reverse/csv/`, adresse officielle actuelle : l'ancienne `api-adresse.data.gouv.fr` est dépréciée), l'adresse du numéro de rue le plus proche **à moins de 50 m**. Ces adresses sont marquées « b » (colonne 11) et l'appli les présente comme « adresse officielle la plus proche » (jamais comme l'adresse exacte). Les lieux sont envoyés par lots de 1 000 avec 3 s de pause, et les résultats du mois précédent sont réutilisés (un lieu qui n'a pas bougé n'est pas redemandé) : l'API est très peu sollicitée. Si elle est indisponible, l'extraction continue sans ces adresses (`--sans-ban` pour la désactiver). Aucune autre source (jamais Google Maps ni les Pages Jaunes).

## Mise à jour mensuelle (automatique)
`.github/workflows/lieux-mensuel.yml` tourne le 2 de chaque mois (et à la demande : onglet **Actions**, « Lieux : mise à jour mensuelle », **Run workflow**) :
1. télécharge l'extrait « France » de Geofabrik (environ 5 Go),
2. lance `outils/extraire-lieux.py`,
3. **ouvre une Pull Request** avec le nombre de lieux ajoutés et retirés.

Vous relisez la Pull Request puis vous la fusionnez : le site se met à jour tout seul (`pages.yml`). Rien n'est publié sans votre clic.
À activer une fois dans GitHub : *Settings > Actions > General > Workflow permissions > « Allow GitHub Actions to create and approve pull requests »*.

Garde-fou : si l'extraction trouve moins de 5 000 lieux, ou moins de 80 % de la version précédente, le script **refuse d'écrire** (code de sortie 2) et la Pull Request n'est pas créée.

## Refaire l'extraction à la main
```
pip install osmium shapely
curl -L -o france.osm.pbf https://download.geofabrik.de/europe/france-latest.osm.pbf
python outils/extraire-lieux.py --pbf france.osm.pbf --sortie donnees/lieux
```
Durée mesurée sur un PC de bureau : environ 3 min 30 s, plus une quinzaine de secondes pour les requêtes BAN (le téléchargement de 5 Go prend davantage). Les contours des départements (IGN Admin Express via Etalab, Licence Ouverte) sont téléchargés automatiquement ; l'adresse est dans le script (`URL_CONTOURS`, année à avancer de temps en temps).

## Tests
`python outils/test_extraire_lieux.py` (28 contrôles, sans réseau : l'API est simulée) ; ils sont aussi lancés par `node tests/lancer.mjs carte`, qui vérifie en plus les vrais fichiers de `donnees/lieux/` (structure, tailles, aucun courriel, contour de la France).

## Ajouter ou changer une catégorie
Modifier `CATEGORIES` dans `extraire-lieux.py` **et** dans `modules/carte/carte-donnees.js` (mêmes étiquettes OpenStreetMap), puis refaire l'extraction.
