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
node tests/lancer.mjs 5g         # un seul test : 5e, 5f, finitions ou 5g
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
| `5g` | `test-5g-pesees.mjs` | Pesées (validation, petits poids, graphique, suppression), Sauvegarde, Bientôt, page introuvable |

Chaque test passe sur trois largeurs : ordinateur (1280 px), tablette (820 px) et mobile (390 px).

## Lancer un script seul

`node tests/test-5g-pesees.mjs <dossier-de-sortie> <adresse-de-l-appli> <étiquette>` avec l'application servie par vos soins, par exemple `node tests/test-5g-pesees.mjs tests/sortie http://localhost:8765/index.html 5g`. Variable `PORT` : port de débogage d'Edge (par défaut 9343 pour `5e`, 9350 pour les autres).

## Si les données de test changent

Les scripts s'appuient sur les données d'exemple de l'application (Moka, Mimi) et sur des fichiers d'import construits dans le script. Si vous modifiez `modules/animaux/exemples.js`, certains tests (`finitions`) devront être ajustés.
