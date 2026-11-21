# Module 3 « Carte Patte » : en cours (branche `carte`, pas encore publié)

Version d'avant : `main` (avant la fusion de la branche `carte`). Retour arrière après publication : `git revert -m 1 <commit de merge>` puis `git push origin main`.
Le module ne modifie jamais les données des animaux (testé dans `tests/test-carte.mjs`, avec des réponses simulées : aucun vrai serveur n'est appelé).

## À savoir
- La géolocalisation du navigateur n'existe qu'en **HTTPS** (ou sur `localhost`). Sur iPhone via le Wi-Fi en `http://192.168…`, « Autour de moi » ne marche pas : utiliser le champ « Ville ou code postal », ou tester « Autour de moi » sur le site publié (HTTPS).
- **Serveurs Overpass (constaté le 2026-11-21)** : `overpass-api.de` est souvent saturé (« 502 … at capacity ») et, quand il accepte la requête, met 33 à 45 s à répondre ; l'appli attend jusqu'à 55 s, affiche une progression, et passe au serveur suivant à la moindre erreur (détails dans le message d'erreur et dans la console, préfixe `[Carte Patte]`). `overpass.openstreetmap.fr` est exclu : « service réservé à des usages autorisés » (403 sans en-tête CORS, vu par le navigateur comme une erreur CORS). `overpass.kumi.systems` et `overpass.private.coffee` ne répondaient pas ce jour-là. `maps.mail.ru` (VK, Russie) a été retiré : pas de serveur hors d'Europe (vie privée, RGPD). Pour savoir quels serveurs répondent : `node tests/lancer.mjs carte-reel` (vrais serveurs, à la main seulement).
- Règles d'usage d'OpenStreetMap respectées : une recherche à la fois, 1,5 s minimum entre deux requêtes, lieux gardés 6 h (zone arrondie à 1 km, jamais la position exacte). Les serveurs publics (Overpass, Nominatim, tuiles) n'ont aucune garantie de disponibilité : l'appli affiche un message et « Réessayer ».
- Les lieux viennent d'OpenStreetMap et sont parfois incomplets ou périmés : l'appli n'affiche jamais « ouvert 24h/24 » sauf si la donnée dit exactement `24/7`, et n'indique jamais si un lieu est ouvert « maintenant ».

## À vérifier à la main (non testé automatiquement)
Safari sur iPhone : fenêtre de permission de localisation (en HTTPS), défilement de la page avec la carte sous le doigt, appui sur « Itinéraire » (Plans) et « Appeler », taille des marqueurs, clavier du champ « Ville ».

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
