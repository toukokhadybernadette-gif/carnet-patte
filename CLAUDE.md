# CLAUDE.md

## Règles permanentes

- Après chaque publication réussie sur main, supprime automatiquement la branche fusionnée (locale et GitHub) et remets le serveur local sur 127.0.0.1, sans me demander. Garde toujours les tags de sauvegarde.

## Tests (rapides, sans retirer aucune vérification)

- Pendant le travail : `node tests/lancer.mjs --rapide` ne lance que les tests liés aux fichiers modifiés (non commités + commits de la branche depuis main). Un fichier central (router, storage, app, index.html, CSS de base…) déclenche tous les tests.
- Suite complète : `node tests/lancer.mjs`, une seule fois, juste avant chaque publication sur main. Pas de suite complète à chaque petite retouche.
- Les tests tournent 2 à la fois par défaut (4 provoquait des échecs dus à la charge, qui disparaissaient en relançant le test seul) (`--jobs=N` pour changer). Chaque test a son propre port et son propre profil Edge, donc le parallèle est sûr : ne jamais relancer deux lanceurs en même temps (ils partagent `tests/sortie/`).
- Le lanceur affiche à la fin un résumé : nombre de tests OK, noms des échecs, durée totale.
- Si un test échoue : le relancer seul une fois (`node tests/lancer.mjs <nom>`) ; s'il échoue encore, s'arrêter, expliquer, et ne pas publier.
- `node tests/lancer.mjs carte-reel` appelle les vrais serveurs OpenStreetMap : à lancer à la main seulement (il n'est ni dans la suite complète ni dans `--rapide`), par exemple quand la Carte affiche des erreurs de serveur.
- Nouveau test ou nouveau fichier de l'application : ajouter la règle correspondante dans `REGLES` de `tests/lancer.mjs` (sinon le fichier est traité comme central et lance tout).

## Données de la Carte (lieux préparés à l'avance)

- `donnees/lieux/` est une base dérivée d'OpenStreetMap sous licence **ODbL**. Seule autre donnée admise : les adresses manquantes complétées par la **Base Adresse Nationale** (Licence Ouverte 2.0, via le géocodage inverse de la Géoplateforme `https://data.geopf.fr/geocodage/` ; l'ancienne adresse `api-adresse.data.gouv.fr` est dépréciée), marquées « b » dans les fichiers. Toujours garder `LICENCE.txt` et les mentions « © contributeurs d'OpenStreetMap » et « Base Adresse Nationale, Licence Ouverte 2.0 » dans l'appli.
- **Sources d'adresses : OpenStreetMap et la BAN, rien d'autre.** JAMAIS Google Maps ni les Pages Jaunes (ni aucun service dont les conditions interdisent de stocker ses résultats) : testé par `outils/test_extraire_lieux.py`. Pas de courriel ni de nom de personne dans ces fichiers (RGPD).
- On ne modifie pas ces fichiers à la main : `python outils/extraire-lieux.py` les refait, et l'Action mensuelle `lieux-mensuel.yml` ouvre une Pull Request à valider (jamais de publication automatique).
- Aucun serveur hébergé hors d'Europe dans `SERVEURS_OVERPASS` (vie privée, RGPD).

## Boutique (liens vers des sites marchands)

- `modules/boutique/produits.js` ne contient JAMAIS de médicament, antiparasitaire, vermifuge ni complément de santé, ni prix, ni note, ni avis inventés (testé par `tests/test-boutique.mjs`).
- Une mention reste visible sur la page Boutique et dans chaque bloc de liens (fiche animal, Toxique ?), et elle est AUTOMATIQUE : « Sélection indépendante : Carnet Patte ne touche aucune commission sur ces liens pour l'instant. » tant qu'aucun `lienAffilie` n'est rempli, « Liens affiliés : Carnet Patte peut toucher une petite commission… » dès qu'un seul l'est (`mentionCourante()` dans `produits.js`). Les liens s'ouvrent dans un nouvel onglet avec `rel="sponsored noopener"`.
- N'ajouter un produit qu'avec un lien dont la page a été vérifiée (`node tests/lancer.mjs boutique-liens`, à la main).
