# CLAUDE.md

## Règles permanentes

- Après chaque publication réussie sur main, supprime automatiquement la branche fusionnée (locale et GitHub) et remets le serveur local sur 127.0.0.1, sans me demander. Garde toujours les tags de sauvegarde.

## Tests (rapides, sans retirer aucune vérification)

- Pendant le travail : `node tests/lancer.mjs --rapide` ne lance que les tests liés aux fichiers modifiés (non commités + commits de la branche depuis main). Un fichier central (router, storage, app, index.html, CSS de base…) déclenche tous les tests.
- Suite complète : `node tests/lancer.mjs`, une seule fois, juste avant chaque publication sur main. Pas de suite complète à chaque petite retouche.
- Les tests tournent 2 à la fois par défaut (4 provoquait des échecs dus à la charge, qui disparaissaient en relançant le test seul) (`--jobs=N` pour changer). Chaque test a son propre port et son propre profil Edge, donc le parallèle est sûr : ne jamais relancer deux lanceurs en même temps (ils partagent `tests/sortie/`).
- Le lanceur affiche à la fin un résumé : nombre de tests OK, noms des échecs, durée totale.
- Si un test échoue : le relancer seul une fois (`node tests/lancer.mjs <nom>`) ; s'il échoue encore, s'arrêter, expliquer, et ne pas publier.
- Nouveau test ou nouveau fichier de l'application : ajouter la règle correspondante dans `REGLES` de `tests/lancer.mjs` (sinon le fichier est traité comme central et lance tout).
