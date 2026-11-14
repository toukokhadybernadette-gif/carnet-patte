# Carnet Patte

Application web pour les propriétaires d'animaux (module 1 : animaux, soins, rappels, pesées ; module 2 : « Toxique ? », aliments, plantes et produits dangereux selon l'espèce).

## Lancer
1. Ouvrir ce dossier dans VS Code.
2. Installer l'extension **Live Server** (Ritwick Dey).
3. Clic droit sur `index.html` → **Open with Live Server** (ou bouton « Go Live » en bas à droite).

Ouvrir `index.html` par double-clic ne fonctionne pas (les modules JS exigent un serveur).

## Organisation
- `js/` : cœur de l'appli (stockage, routeur, interface, sauvegarde)
- `css/` : styles communs
- `modules/<nom>/` : un dossier par module (`animaux` et `toxique` sont réalisés ; les fiches de « Toxique ? » sont dans `modules/toxique/donnees.js`)
