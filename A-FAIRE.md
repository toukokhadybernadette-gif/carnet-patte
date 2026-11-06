# Avant et après le merge de `refonte-design` sur `main`

## Fait (sur la branche)
- [x] Démo de design 5h supprimée (`demo-design.html`, `demo/`). Elle reste dans l'historique de la branche, pas dans les fichiers.
- [x] Chargement des données robuste : des données illisibles ne sont jamais écrasées (copie de secours + écran d'aide, `js/secours.js`).
- [x] Tests : `node tests/lancer.mjs` (5e, 5f, finitions, 5g, 5h, secours, migration).

## Avant le merge (à valider par la propriétaire du projet)
- [ ] Relire la liste de contrôle donnée dans la conversation et la valider.
- [ ] Vérifier à la main dans Chrome, Firefox, Safari (iPhone) et sur téléphone (voir « Vérifications à la main »).
- [ ] Créer et pousser le repère de retour arrière : `git tag avant-refonte-5h 6d4e74c` puis `git push origin avant-refonte-5h`.

## Merge (quand c'est validé)
1. `git switch main` puis `git pull`.
2. `git merge --no-ff refonte-design -m "Refonte du design (5h) : nouvelle interface, prénom facultatif, chargement sécurisé"`.
3. Relancer `node tests/lancer.mjs`, puis `git push origin main`. GitHub Pages republie tout seul (1 à 2 minutes).

## Juste après la publication : vérifier le site public
Adresse : https://toukokhadybernadette-gif.github.io/carnet-patte/
- Ouvrir la page dans une fenêtre privée, puis dans la fenêtre habituelle (celle qui contient de vraies données) avec Ctrl+F5.
- Accueil, Mes animaux, une fiche, Rappels, Poids (graphique), Profil, Sauvegarde : tout s'affiche, aucune erreur dans la console (F12).
- Les vrais animaux, soins et pesées sont toujours là ; faire un export depuis la page Sauvegarde et garder le fichier.
- Sur téléphone : ouvrir le site, vérifier la barre du bas et le bouton « Fait ».

## Revenir en arrière rapidement
- Le plus simple : `git revert -m 1 <numéro du commit de merge>` puis `git push origin main` (annule la fusion sans réécrire l'historique).
- Repère : le tag `avant-refonte-5h` pointe sur la version d'avant. Pour inspecter : `git switch --detach avant-refonte-5h`.
- Les données des utilisateurs ne sont pas touchées par un retour arrière : la version d'avant relit les données de la nouvelle (testé dans `tests/test-migration.mjs`, étape 5). Seul le prénom (champ ajouté) sera oublié à la prochaine écriture.

## Vérifications à la main
Les tests tournent dans Edge. À regarder à l'œil dans Chrome, Firefox, Safari (iPhone) et un vrai téléphone :
- Les polices (Manrope, Inter) se chargent ; pas de texte qui déborde.
- Champs de saisie sur iPhone : la page ne zoome pas quand on touche un champ (16 px).
- Barre du bas : ne cache pas le contenu ; le bouton « Fait » se touche facilement.
- Graphique des pesées : l'info-bulle apparaît au toucher.
- Sauvegarde : le téléchargement du fichier et l'import fonctionnent.
