# Tests de bout en bout

Ces scripts ouvrent l'application dans Edge (sans fenêtre visible), cliquent comme un utilisateur et vérifient les résultats : données enregistrées, messages, accessibilité (axe-core), absence de défilement horizontal, erreurs console. Ils ne modifient jamais vos vraies données : chaque test utilise un profil de navigateur temporaire.

## Ce qu'il faut

- **Node.js 22 ou plus récent** (les scripts utilisent `fetch` et `WebSocket` intégrés).
- **Microsoft Edge**. Si `msedge.exe` n'est pas dans `C:\Program Files (x86)\Microsoft\Edge\Application\`, indiquez son chemin avec la variable `EDGE`.
- **Une connexion internet** : le moteur d'accessibilité (axe-core) est téléchargé au lancement de chaque test.

## Lancer

Depuis la racine du projet :

```
node tests/lancer.mjs            # tous les tests
node tests/lancer.mjs 5g         # un seul test : 5e, 5f, finitions, 5g, 5h, toxique, refonte, etroit, carte ou boutique
node tests/lancer.mjs 5e 5f      # plusieurs
```

Avec un autre Edge (PowerShell) : `$env:EDGE = "C:\chemin\msedge.exe"; node tests/lancer.mjs`

Le lanceur démarre lui-même un petit serveur local : rien d'autre à installer ni à démarrer. Comptez 1 à 2 minutes par test.

## Résultats

Le lanceur affiche une ligne par test (`OK` ou `ÉCHEC`) : accessibilité, console, aller-retour export/import. Le détail complet est dans `tests/sortie/<test>.txt`, une vérification par ligne. Cherchez-y les valeurs `false` ou `VIOLATIONS` : certaines lignes affichent `false` normalement (par exemple « NaN = false » ou « rappelFait = false »), lisez la phrase avant de conclure.

Les captures d'écran sont dans `tests/sortie/shots/`. Le dossier `tests/sortie/` n'est pas commité.

## Les tests

| Test | Fichier | Ce qu'il vérifie |
|---|---|---|
| `5e` | `test-5e-soins.mjs` | Soins : ajout, modification, suppression, rappel « Fait », formulaires et erreurs |
| `5f` | `test-5f-rappels.mjs` | Page Rappels : groupes, filtres, « Fait », « Voir le soin », longue liste |
| `finitions` | `test-finitions.mjs` | Navigation, couleurs d'échéance, noms de soins, Accueil, résumés, barre du bas mobile |
| `toxique` | `test-toxique.mjs` | Module « Toxique ? » : 80 fiches au moins, sources, aucune dose, numéros des centres antipoison, recherche (accents, majuscules), niveaux par espèce, « pas de fiche » jamais présenté comme « sans danger », action rapide de l'Accueil, trois largeurs, accessibilité |
| `refonte` | `test-refonte.mjs` | Refonte du style : 12 thèmes de couleur + couleur personnalisée (aperçu immédiat, mémorisés sur l'appareil, couleurs d'urgence inchangées, contraste 4,5:1 mesuré sur chaque thème et sur plus de 500 couleurs de départ, puis par axe-core), Accueil (carrousel, diapositive « Ajouter », carte « À faire »), Poids (poids actuel, grand graphique, fenêtre d'ajout), Rappels sur ordinateur, dates en français, illustrations, trois largeurs |
| `etroit` | `test-etroit.mjs` | Écran de 375 px avec des noms longs (animaux, espèces, soins, fiches Toxique ?) : rien ne déborde, aucun texte n'en chevauche un autre, aucun mot coupé au milieu ; menu ☰, bouton rond « + » (fond blanc, icône de la couleur du thème) de la barre du bas, plus d'« Actions rapides », trait rouge des rappels, carrousel et diapositive « Ajouter » |
| `installable` | `test-installable.mjs` | Appli installable : manifeste et icônes (tailles exactes), réglages iPhone, service worker enregistré sur 127.0.0.1, mode « dev » sans cache, mise en cache, ouverture hors connexion (serveur de test vraiment arrêté), message de la Carte hors ligne, bannière de mise à jour et mise à jour sur demande, données des animaux intactes, aide « Installer sur votre iPhone » |
| `calendrier` | `test-calendrier.mjs` | « Ajouter au calendrier » : contenu du .ics (structure, titre, journée entière, alertes la veille 18 h et le jour même 9 h, accents, caractères spéciaux, lignes longues, année bissextile), identifiant stable, « Tout ajouter », boutons sur Rappels / fiche / Accueil, aucune requête réseau, données intactes |
| `documents` | `test-documents.mjs` | Onglet Documents : ajout (titre, date, type), photo réduite, PDF, espace utilisé, ouvrir / télécharger, export / import avec documents (anciens exports, fichiers abîmés), avertissement de sauvegarde volumineuse, « Tout effacer », suppression d'un animal, hors connexion, 375 px |
| `garde` | `test-garde.mjs` | Fiche de garde : sections repliables, enregistrement automatique, aperçu (sections remplies seulement, vaccins, centres antipoison), PDF valide (structure, accents, plusieurs pages), avertissement avant partage, export / import, hors connexion, 375 px |
| `ferme` | `test-ferme.mjs` | Groupes (basse-cour) : création, onglets, soins et rappels du groupe, ponte (saisie, moyenne exacte, graphique 30 jours), stock de nourriture (calcul, alerte « à racheter », « J'ai racheté »), export / import, suppressions, hors connexion, 375 et 390 px |
| `sombre` | `test-sombre.mjs` | Mode sombre : Clair / Sombre / Automatique (suit l'appareil en direct), contraste 4,5:1 mesuré dans le navigateur (12 thèmes + couleurs personnalisées) et par axe-core (4 pages × 13 thèmes), verre conservé, Carte lisible, rechargement sans flash, 375 px |
| `demenagement` | `test-demenagement.mjs` | Déménagement vers Cloudflare : assemblage du site (contenu, version, `_headers`), aucun nom de compte ni lien vers l'ancienne adresse, manifeste à la racine et en sous-dossier, bandeau seulement sur *.github.io, page `demenagement.html` (export en un geste, quatre étapes, hors connexion, sombre), reprise des données ailleurs, À propos et Mentions légales (champs à compléter, pas d'adresse postale), 375 et 390 px |
| `5g` | `test-5g-pesees.mjs` | Pesées (validation, petits poids, suppression), graphique (alignement des points sur les graduations à 1 px près, info-bulle à la souris et au toucher), Sauvegarde, Bientôt, page introuvable |

Chaque test passe sur trois largeurs : ordinateur (1280 px), tablette (820 px) et mobile (390 px).

## Lancer un script seul

`node tests/test-5g-pesees.mjs <dossier-de-sortie> <adresse-de-l-appli> <étiquette>` avec l'application servie par vos soins, par exemple `node tests/test-5g-pesees.mjs tests/sortie http://localhost:8765/index.html 5g`. Variable `PORT` : port de débogage d'Edge (par défaut 9343 pour `5e`, 9350 pour les autres).

## Si les données de test changent

Les scripts s'appuient sur les données d'exemple de l'application (Moka, Mimi) et sur des fichiers d'import construits dans le script. Si vous modifiez `modules/animaux/exemples.js`, certains tests (`finitions`) devront être ajustés.
| `carte-reel` | `test-carte-reel.mjs` | **À LANCER À LA MAIN SEULEMENT** (`node tests/lancer.mjs carte-reel`, jamais dans la suite automatique ni avec `--rapide`) : appelle les VRAIS serveurs (Nominatim, chaque serveur Overpass, tuiles) pour une vraie recherche « Toulouse » à 5 km. Montre pour chaque serveur le code HTTP, la durée et si le navigateur accepte la réponse (CORS). Peut échouer sans que l'appli soit en faute : les serveurs publics sont parfois saturés ou en panne ; lisez le détail dans `tests/sortie/carte-reel.txt` |
| `carte` | `test-carte.mjs` | Carte Patte, avec des réponses SIMULÉES (aucun vrai serveur OpenStreetMap appelé) ; lit aussi les VRAIS fichiers de `donnees/lieux/` (structure, au moins 70 % de lieux avec adresse et 30 % avec téléphone, adresses de la Base Adresse Nationale complètes et marquées, source et Licence Ouverte 2.0, 5 catégories, tailles, aucun courriel, contour de la France, LICENCE.txt ODbL, Action mensuelle qui ouvre une Pull Request) et lance les tests Python du script d'extraction. Navigateur : accès depuis l'Accueil et le menu ☰, position demandée seulement après un toucher (refus simulé aussi), lieux lus dans les fichiers du site (instantané, aucune requête Overpass ni Nominatim pour « Autour de moi », seuls les départements voisins chargés, lignes piégées ignorées, site web `javascript:` refusé, source et date affichées, remarque près d'une frontière), repli sur Overpass hors métropole ou si les fichiers sont en panne (HTTP 500), adresse officielle la plus proche (BAN) distinguée de l'adresse OpenStreetMap dans la liste et la fiche, et sur les VRAIS fichiers de Toulouse : les 25 premières fiches affichent exactement ce que contient le fichier, liste triée par distance, filtres en pastilles, fiche d'un lieu (adresse, téléphone, horaires, site web, Itinéraire, Appeler, jamais « 24h/24 » inventé), rayon 2/5/10 km, cache de 6 h (Overpass), recherche par ville ou code postal, une seule recherche à la fois et pause entre deux requêtes, serveurs Overpass de secours, erreurs réseau avec « Réessayer » et détails techniques, attribution OpenStreetMap et licence ODbL visibles, position exacte jamais enregistrée ni envoyée, 375 px, trois largeurs, accessibilité |
| `boutique` | `test-boutique.mjs` | Boutique : lit les VRAIS produits de `modules/boutique/produits.js` (30 à 40, champs, `lienAffilie`, liens https vers le bon marchand, AUCUN médicament ni complément de santé, aucun prix, aucune note ni promesse, besoins et espèces couverts). Navigateur : entrée dans le menu ☰ et plus dans « Bientôt », mention d'affiliation exacte et visible dès l'arrivée, filtres par espèce et par besoin (nombres, pastilles grisées, adresses `#/boutique/chat/jouets`, combinaison vide), 37 liens `target=_blank rel="sponsored noopener"` avec « Voir le prix », aucun prix ni avis affiché, `lienAffilie` utilisé s'il est rempli, bloc « Pour [nom] » sur la fiche (3 produits de l'espèce, besoins différents, stable, saisons, kit d'arrivée pour un chiot seulement, rien pour un furet), alternative sûre sous un aliment dangereux de « Toxique ? » (après l'urgence, jamais pour une espèce sans produit), 375 px, trois largeurs, accessibilité, données intactes |
| `boutique-liens` | `test-boutique-liens.mjs` | **À LANCER À LA MAIN SEULEMENT** (`node tests/lancer.mjs boutique-liens`) : appelle les vrais sites marchands, une page à la fois, pour vérifier que chaque lien répond encore (page trouvée, pas de renvoi vers l'accueil, titre présent). Les sites changent leurs adresses : un échec veut dire « allez voir ce lien » |
