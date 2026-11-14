# Module : Toxique ? (vérifier si un aliment, une plante ou un produit est dangereux selon l'espèce)

Réalisé (module 2). Accessible par l'action rapide « Toxique ? » de l'Accueil, ou par `#/toxique` (et `#/toxique/<id d'un animal>` pour partir de son espèce).

## Fichiers
- `donnees.js` : **les fiches** (91 éléments). C'est le fichier à relire et à corriger à la main ; les règles de rédaction sont en tête du fichier.
- `toxique.js` : la page (recherche, choix de l'espèce, filtres, fiches repliables).
- `toxique.css` : les styles du module.
- Tests : `node tests/lancer.mjs toxique`.

## Règles
- **Jamais de dose ni de traitement.** Le test refuse toute quantité chiffrée (mg, ml, g/kg…) et les mots de traitement.
- La phrase « En cas de doute ou d'ingestion, appelez votre vétérinaire ou un centre antipoison vétérinaire » et les numéros des centres antipoison vétérinaires sont toujours affichés (en haut de la page et dans chaque fiche).
- Une espèce n'est dans une fiche que si une source citée en parle. Une espèce absente = « pas d'information vérifiée », jamais « sans danger ».
- En cas de doute sur une entrée : ne pas l'ajouter.

## Numéros (vérifiés en novembre 2026)
- CNITV (Lyon) : 04 78 87 10 40, de 8 h 30 à minuit, 7 jours sur 7 (cnitv.fr/Contact).
- CAPAE-Ouest (Nantes) : 02 40 68 77 40 (page de l'école Oniris). D'autres sites citent d'autres numéros pour ce centre : à recontrôler si besoin.

## Niveaux
`ok` (sans danger connu), `prudence`, `toxique`, `tres` (très toxique). Classification **simplifiée de l'appli** : les sources n'emploient pas ces quatre mots. Les critères sont en tête de `donnees.js`.

## Limites connues
- Peu de données publiques accessibles pour les lapins, rongeurs, oiseaux et poules : leurs fiches s'appuient surtout sur le Manuel vétérinaire Merck, Wood Green (cochon d'Inde, lapin), PetMD et UF/IFAS. Les fiches « rongeurs » concernent le cochon d'Inde ; rien n'est déduit pour le hamster.
- Les champignons sauvages ne sont pas dans les fiches : aucune source vétérinaire française n'a pu être vérifiée.
- Espèces de l'appli non couvertes (furet, canard, chèvre, mouton, âne, vache, cochon, tortue, poisson…) : la page propose les 7 groupes de fiches, rien n'est déduit pour les autres.

Pour ajouter un module : voir le mode d'emploi en haut de `js/app.js`.
