# Refonte du design (5h) : publiée

Fusionnée sur `main` après validation en local. Version d'avant : tag `avant-refonte-5h` (commit `6d4e74c`).

## Retour arrière rapide
1. `git revert -m 1 <commit de merge>` puis `git push origin main` (annule la fusion sans réécrire l'historique).
2. Les données des utilisateurs ne sont pas touchées : l'ancienne version relit celles de la nouvelle (`tests/test-migration.mjs`). Seuls le prénom et les couleurs d'animaux (champs ajoutés) sont ignorés par l'ancienne version.

## Tests
`node tests/lancer.mjs` (voir `tests/LISEZMOI.md`).

## À vérifier à la main (non testé automatiquement)
Safari et iPhone, Firefox, et la fluidité des bulles de fond sur un vrai téléphone. Si le fond saccade : retirer le `<link>` de `css/verre.css` et la balise `.app-fond` dans `index.html`.
