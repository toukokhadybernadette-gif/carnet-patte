# Publier Carnet Patte sur Cloudflare Pages (offre gratuite)

**Adresse définitive : https://carnetpatte.com** (`www.carnetpatte.com` redirige vers elle). Le projet Cloudflare s'appelle `carnet-patte` : son adresse technique (`carnet-patte.pages.dev`) sert seulement à Cloudflare et **n'est jamais montrée aux utilisateurs** (le test `demenagement` vérifie qu'elle n'apparaît dans aucun fichier du site).

L'ancienne adresse GitHub Pages reste ouverte, avec un bandeau et la page `demenagement.html`, **jusqu'à votre accord**.

Cloudflare reconstruit le site à chaque fusion sur la branche de production, tout seul. Rien à installer sur votre ordinateur.

> Les libellés de Cloudflare changent parfois d'un mois à l'autre. Si un bouton n'a pas exactement ce nom, cherchez le plus proche et dites-moi ce que vous voyez.

---

## Partie A : créer le projet Pages (une seule fois)

1. Allez sur **dash.cloudflare.com** et connectez-vous (même compte que celui du domaine).
2. Menu de gauche → **Workers & Pages**. Cliquez le bouton bleu **Créer** (« Create »).
3. Un écran propose « Workers » et « Pages » (onglets ou cartes). Choisissez **Pages** → **Se connecter à Git** (« Connect to Git »).
   Si vous ne voyez que « Workers », cherchez en petit « Looking to deploy Pages? Get started » : c'est le même chemin.
4. **Connect GitHub** : une fenêtre GitHub s'ouvre. Connectez-vous si besoin, puis choisissez **Only select repositories** → cochez **carnet-patte** (et rien d'autre) → **Install & Authorize**.
5. De retour dans Cloudflare : sélectionnez le dépôt **carnet-patte** → **Begin setup** (« Commencer la configuration »).
6. **Nom du projet** : `carnet-patte`. **Il ne pourra plus être changé.** S'il est déjà pris, Cloudflare en propose un autre : arrêtez-vous et dites-le-moi.
7. **Branche de production** : **`cloudflare`** pour l'essai (voir « Pourquoi » plus bas).
8. **Réglages de build** :
   | Champ | Valeur |
   |---|---|
   | Preset de framework (« Framework preset ») | **None** (aucun) |
   | Commande de build (« Build command ») | `node outils/assembler-site.mjs` |
   | Dossier de sortie (« Build output directory ») | `_site` |
   | Dossier racine (« Root directory », réglages avancés) | laisser vide |
9. **Variables d'environnement** (déplier « Environment variables (advanced) ») → **Add variable** : nom `NODE_VERSION`, valeur `22`.
10. Cliquez **Save and Deploy**. Un journal s'affiche : attendez 1 à 2 minutes jusqu'à « Success! Your site is deployed ». Cloudflare montre une adresse en `…pages.dev` : c'est l'adresse technique, elle est normale ici.
11. **Économiser les déploiements** : dans le projet → **Settings** → **Builds** (ou « Build configuration ») → **Branch control** → *Preview branches* → **None**. L'offre gratuite compte 500 déploiements par mois.

**Pourquoi la branche `cloudflare` d'abord ?** Fusionner dans `main` ajouterait le bandeau « Carnet Patte a déménagé » sur l'ancienne adresse **avant** que `carnetpatte.com` fonctionne. Une fois le test validé sur l'iPhone, dites OK : je fusionne dans `main`, puis vous changez la branche de production (Partie D).

---

## Partie B : relier carnetpatte.com au projet (Custom domains)

Le domaine est dans le même compte Cloudflare : le branchement est quasi automatique. Mais le courrier de `contact@carnetpatte.com` utilise des enregistrements DNS « MX » : on vérifie avant et après qu'ils n'ont pas bougé.

**B1. Photographier l'e-mail AVANT (2 minutes)**
1. Menu de gauche → **Domain Configuration** → **Domains**, ou « Websites » → cliquez **carnetpatte.com** → **DNS** → **Records**.
2. Notez (capture d'écran) les lignes de type **MX** (normalement `route1.mx.cloudflare.net`, `route2…`, `route3…`) et **TXT** (dont `v=spf1 include:_spf.mx.cloudflare.net ~all`, et une clé « DKIM » `…_domainkey`). Ce sont celles d'Email Routing. **Il ne faudra supprimer ni modifier aucune de ces lignes.**
3. Vérifiez aussi qu'il n'existe **pas** déjà de ligne de type A, AAAA ou CNAME pour `carnetpatte.com` lui-même (nom `@`). S'il y en a une, arrêtez-vous et dites-le-moi.

**B2. Ajouter le domaine à Pages**
1. **Workers & Pages** → cliquez le projet **carnet-patte** → onglet **Custom domains** (« Domaines personnalisés »).
2. **Set up a custom domain** → saisissez `carnetpatte.com` → **Continue**.
3. Cloudflare affiche un récapitulatif de l'enregistrement DNS à créer (un CNAME `carnetpatte.com` → `carnet-patte.pages.dev`) : cliquez **Activate domain** (« Activer le domaine »). Comme le domaine est dans votre compte, l'enregistrement est ajouté tout seul.
4. Le statut passe de « Initializing » à **Active** en quelques minutes (le certificat HTTPS est créé automatiquement). Rechargez la page de temps en temps.

**B3. Vérifier que l'e-mail n'a pas bougé**
1. Retournez dans **DNS → Records** : les lignes **MX** et **TXT** de B1 doivent être **exactement les mêmes**. Il y a en plus UNE ligne nouvelle : CNAME `carnetpatte.com` (nuage orange). C'est normal : Cloudflare la traite sans gêner les MX (« CNAME flattening »).
2. **Email** → **Email Routing** : l'état doit rester « Enabled / Activé » et les enregistrements DNS « Configured ».
3. **Test réel** : depuis une autre boîte (pas contact@ lui-même), envoyez un message à `contact@carnetpatte.com` et vérifiez qu'il arrive bien dans la boîte de destination configurée dans Email Routing (regardez aussi les indésirables).
4. Si un avertissement mentionne un conflit d'enregistrements : **ne supprimez rien**, dites-le-moi.

**B4. Ajouter www et le rediriger vers carnetpatte.com**
1. **DNS → Records → Add record** : Type **CNAME**, Nom `www`, Cible `carnetpatte.com`, Statut du proxy **Proxied** (nuage orange). **Save**.
2. Redirection (méthode que Cloudflare recommande pour Pages) : menu du compte → **Bulk Redirects** (« Redirections en masse ») → **Create Bulk Redirects**.
   - Créez une **liste** (nom : `www-vers-racine`) avec une entrée : *Source URL* `www.carnetpatte.com`, *Target URL* `https://carnetpatte.com`, *Status* **301**, et cochez **Preserve query string**, **Subpath matching** et **Preserve path suffix** (pour que `www.carnetpatte.com/quelque-chose` mène à `carnetpatte.com/quelque-chose`).
   - Puis créez la **règle** (« Bulk Redirect Rule ») qui utilise cette liste, et **activez-la** (Deploy).
   - Variante équivalente : **Rules → Redirect Rules → modèle « Redirect from WWW to root »**.
3. Test (dites-moi, je le vérifie aussi) : `https://www.carnetpatte.com` doit arriver sur `https://carnetpatte.com`.

**B5. Ensuite**
Ouvrez `https://carnetpatte.com` sur l'iPhone et dites-moi. Les réglages de l'appli (manifeste, service worker) sont relatifs : aucun changement à faire quand le domaine change.

---

## Partie C : ce que fait le déploiement

`node outils/assembler-site.mjs` copie seulement ce qui sert au site dans `_site` (pas les tests, outils, notes), écrit la **version du commit** dans `sw.js` et la liste des fichiers à garder hors ligne. C'est le même script que celui de l'Action GitHub Pages. Le fichier `_headers` (à la racine du dépôt) demande à Cloudflare de toujours relire `sw.js`, `index.html` et le manifeste : pas de vieille version bloquée.

Limites de l'offre gratuite : transfert illimité, 500 déploiements par mois, 20 000 fichiers par site (nous en avons environ 190), 1 déploiement à la fois.

## Partie D : après votre OK

1. Je fusionne la branche `cloudflare` dans `main` (le bandeau et `demenagement.html` apparaissent alors sur l'ancienne adresse, qui renvoie vers `https://carnetpatte.com`).
2. Vous : projet **carnet-patte** → **Settings** → **Builds** → **Production branch** → **`main`**, puis **Save**. Un nouveau déploiement part.
3. **Mise à jour mensuelle des lieux** : inchangée. L'Action ouvre une Pull Request ; quand vous la fusionnez, Cloudflare redéploie.
4. **Fermer l'ancienne adresse** : seulement sur votre accord. Il suffira de remplacer le site GitHub Pages par la seule page `demenagement.html`, puis (plus tard) de le désactiver dans GitHub → Settings → Pages.
