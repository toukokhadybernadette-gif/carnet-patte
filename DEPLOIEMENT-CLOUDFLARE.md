# Publier Carnet Patte sur Cloudflare Pages (offre gratuite)

Adresse visée : **https://carnet-patte.pages.dev** (elle ne contient pas votre nom). L'ancienne adresse GitHub Pages reste ouverte, avec un bandeau et une page `demenagement.html`, **jusqu'à votre accord**.

Cloudflare reconstruit le site à chaque fusion sur `main`, tout seul. Rien à installer sur votre ordinateur.

## Ce que vous cliquez vous-même (une seule fois)

1. **Compte** : créez un compte gratuit sur dash.cloudflare.com (e-mail + mot de passe). L'offre gratuite suffit ; aucun paiement n'est nécessaire.
2. Dans le menu de gauche : **Workers & Pages** → **Créer** (« Create application »). Choisissez l'onglet **Pages** → **Importer un dépôt existant** (« Connect to Git »).
   Si l'écran ne propose que « Workers », cherchez le lien discret « Looking to deploy Pages? Get started » : c'est le même chemin.
3. **GitHub** : cliquez **Connect GitHub**, connectez-vous, puis dans la fenêtre GitHub choisissez **Only select repositories** → cochez **carnet-patte** uniquement → **Install & Authorize**.
4. Sélectionnez le dépôt **carnet-patte** → **Begin setup** (« Commencer la configuration »).
5. **Nom du projet** : `carnet-patte`.
   C'est ce nom qui fait l'adresse `carnet-patte.pages.dev`. **Il ne peut plus être changé ensuite.** S'il est déjà pris, Cloudflare propose une variante (par exemple `carnet-patte-1a2`) : dites-le-moi et j'adapte les réglages de l'appli.
6. **Branche de production** : choisissez **`cloudflare`** pour le premier essai (c'est la branche où se trouvent ces fichiers).
   Pourquoi pas `main` tout de suite ? Fusionner dans `main` ajouterait le bandeau « Carnet Patte a déménagé » sur l'ancienne adresse **avant** que la nouvelle existe. Une fois le test validé sur votre iPhone, dites OK : je fusionne dans `main`, puis vous changez la branche de production (projet → **Settings** → **Builds** → **Production branch** → `main`).
7. **Réglages de build** :
   | Champ | Valeur |
   |---|---|
   | Preset de framework (« Framework preset ») | **None** (aucun) |
   | Commande de build (« Build command ») | `node outils/assembler-site.mjs` |
   | Dossier de sortie (« Build output directory ») | `_site` |
   | Dossier racine (« Root directory », réglages avancés) | laisser vide |
8. **Variables d'environnement** (réglages avancés, « Environment variables ») : ajoutez `NODE_VERSION` = `22`.
9. Cliquez **Enregistrer et déployer** (« Save and Deploy »). Attendez 1 à 2 minutes : le journal doit finir par « Success » et afficher l'adresse du site.
10. **Économiser les déploiements** : projet → **Settings** → **Builds** → **Branch control** → *Preview branches* → **None** (la branche de production, elle, se déploie toujours).
    L'offre gratuite compte 500 déploiements par mois ; sans ce réglage, chaque branche de travail en consommerait.
11. Ouvrez `https://carnet-patte.pages.dev` sur l'iPhone et dites-moi.

## Ce que fait le déploiement

`node outils/assembler-site.mjs` copie seulement ce qui sert au site dans `_site` (pas les tests, outils, notes), écrit la **version du commit** dans `sw.js` et la liste des fichiers à garder hors ligne. C'est le même script que celui de l'Action GitHub Pages. Le fichier `_headers` (à la racine du dépôt) demande à Cloudflare de toujours relire `sw.js`, `index.html` et le manifeste : pas de vieille version bloquée.

## Limites de l'offre gratuite

Transfert illimité, 500 déploiements par mois, 20 000 fichiers par site (nous en avons environ 190), 1 déploiement à la fois.

## Et ensuite

- **Mise à jour mensuelle des lieux** : inchangée. L'Action ouvre une Pull Request ; quand vous la fusionnez, Cloudflare redéploie.
- **Fermer l'ancienne adresse** : seulement sur votre accord. Il suffira alors de remplacer le site GitHub Pages par la seule page `demenagement.html`, puis (plus tard) de le désactiver dans GitHub → Settings → Pages.
- **Domaine à vous** (facultatif, plus tard) : Pages → Custom domains. Les installations iPhone sur `carnet-patte.pages.dev` devraient alors être refaites : un nom de domaine à vous évite tout futur déménagement.
