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
