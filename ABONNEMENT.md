# Abonnement Premium (Stripe) : guide pas à pas

Ce guide met en place l'abonnement **Premium à 2,99 € TTC par mois**, en **mode test Stripe** : aucun vrai paiement n'est possible tant que vous n'avez pas fait le passage en réel (checklist en bas).

> **Les clés secrètes** (`sk_test_…`, `whsec_…`) vont **uniquement dans les secrets Supabase**. Jamais dans ce dépôt (il est public), jamais dans un message, jamais dans un fichier du projet. Un test refuse de publier si une clé Stripe apparaît dans le dépôt.
> Les libellés du tableau de bord Stripe changent parfois un peu : si un nom diffère, cherchez le mot-clé indiqué en anglais.

## Comment ça marche

- **Passer Premium** : l'appli appelle la fonction `stripe-checkout`, qui ouvre la page de paiement de Stripe. Le bouton n'apparaît que si le serveur dit que le paiement est ouvert **pour ce compte** (voir `COMPTES_TEST` plus bas).
- **Le passage en Premium ne se fait que par le serveur** : Stripe appelle `stripe-webhook`, qui vérifie la signature, relit l'abonnement chez Stripe, puis change la formule en base. L'appli ne peut jamais se donner Premium.
- **Gérer / résilier** : la fonction `stripe-portail` ouvre le portail Stripe (carte, factures). « Résilier mon abonnement » mène directement à l'écran de résiliation.
- **Supprimer son compte** : la fonction `abonnement-annuler` annule d'abord l'abonnement chez Stripe ; le serveur refuse de supprimer un compte dont l'abonnement est encore en cours.
- Résiliation : Premium jusqu'à la fin de la période payée, puis gratuit. Paiement échoué : message dans l'appli, Stripe réessaie, puis gratuit si non régularisé. **Rien n'est jamais supprimé** à ce moment-là.

## A. Supabase : le SQL

1. SQL Editor → New query → collez tout `supabase/etape4.sql` → **Run** (« Success »). Il faut avoir déjà lancé `etape2.sql`, `etape3.sql` et `etape3b.sql`.
2. Nouvelle requête avec `supabase/verifier-etape4.sql` (lecture seule), et vérifiez :
   - requête 1 : `rowsecurity = true` pour `abonnements` et `evenements_stripe` ;
   - requête 2 : **0 ligne** (aucune règle : personne n'y accède, hors serveur) ;
   - requête 3 : **rien** pour `anon` ni `authenticated` ; `service_role` a ses droits ;
   - requête 4 : `appliquer_abonnement` n'est exécutable que par `service_role` ; `mon_abonnement` et `supprimer_mon_compte` par `authenticated` ;
   - requête 5 : une seule ligne, `SELECT` (l'appli ne peut pas modifier la formule) ;
   - requête 6 : `true`.

## B. Stripe : le tableau de bord (mode test)

1. **Compte** : créez un compte sur stripe.com. Restez en **mode test** (bandeau « Mode test » / environnement « Sandbox » en haut du tableau de bord). Pas besoin d'activer le compte pour les tests.
2. **Détails de l'entreprise** (Paramètres → *Business details*) : nom public, e-mail d'assistance `contact@carnetpatte.com`, **adresse** (celle que vous aurez choisie : domiciliation ou personnelle ; obligatoire sur les factures).
3. **Produit et prix** : Catalogue de produits → *Add product*.
   - Nom : `Carnet Patte Premium`.
   - Prix : **2,99 EUR**, *Recurring* (récurrent), **Monthly** (mensuel). Pas d'essai gratuit. Pas de Stripe Tax (la TVA ne s'applique pas).
   - Enregistrez, puis copiez l'**ID du prix** (`price_…`). Ce n'est pas un secret.
4. **Portail client** : Paramètres → *Billing* → *Customer portal*. Activez :
   - *Customers can update payment methods* (changer de carte) ;
   - *Invoice history* (factures) ;
   - *Cancel subscriptions* → **à la fin de la période de facturation** (*at end of billing period*) ;
   - désactivez le changement de formule et de quantité ;
   - liens de conditions et de confidentialité : `https://carnetpatte.com/#/cgv` et `https://carnetpatte.com/#/confidentialite`.
   - Enregistrez.
5. **Paiements échoués** : Paramètres → *Billing* → *Subscriptions and emails* (*Manage failed payments*) : activez les nouvelles tentatives automatiques (*Smart Retries*) et choisissez, si toutes échouent, **« Annuler l'abonnement »**. Activez aussi les e-mails au client pour les paiements échoués et les reçus.
6. **Factures avec vos mentions** : Paramètres → *Billing* → *Invoice template* :
   - **Pied de page** (*Footer*) : `Entrepreneur individuel (EI) - SIRET 13121199700013 - TVA non applicable, art. 293 B du CGI` ;
   - le nom et l'adresse du vendeur viennent des détails de l'entreprise (étape 2).
7. **Clé secrète de test** : Développeurs → *API keys* → *Secret key* (`sk_test_…`) → *Reveal test key*. Gardez cette page ouverte pour l'étape C, sans copier la clé ailleurs.

## C. Supabase : les secrets et les fonctions

### Les secrets
Supabase → **Edge Functions → Secrets** (ou Project Settings → Edge Functions) → *Add new secret*, un par ligne :

| Nom | Valeur |
|---|---|
| `STRIPE_SECRET_KEY` | la clé `sk_test_…` de l'étape B7 |
| `STRIPE_PRICE_ID` | l'ID `price_…` de l'étape B3 |
| `SITE_URLS` | `https://carnetpatte.com` (ajoutez, séparées par des virgules, les adresses d'aperçu à tester, par exemple `https://abonnement.carnet-patte.pages.dev`) |
| `COMPTES_TEST` | **votre** adresse e-mail de compte Carnet Patte (celle avec laquelle vous vous connectez). Écrivez-la ici, dans Supabase : ne la mettez dans aucun fichier du dépôt public. |
| `STRIPE_WEBHOOK_SECRET` | à ajouter à l'étape D (après la création du webhook) |

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis automatiquement aux fonctions : n'y touchez pas, ne les copiez nulle part.

**`COMPTES_TEST`** est le garde-fou : tant que `PAIEMENT_OUVERT` n'est pas à `oui`, seuls les comptes listés ici voient le bouton « Passer Premium » et peuvent payer. Sans lui, n'importe qui pourrait taper la carte de test 4242 sur le vrai site et obtenir Premium gratuitement. Plusieurs adresses : séparez-les par des virgules.

### Déployer les 4 fonctions
Sur votre PC, dans le dossier du projet (PowerShell). La CLI Supabase n'a pas besoin d'être installée : `npx` la télécharge.
```
npx supabase login
npx supabase functions deploy stripe-checkout --project-ref tiqtmoyxxqzabgaaiwfa --use-api
npx supabase functions deploy stripe-portail --project-ref tiqtmoyxxqzabgaaiwfa --use-api
npx supabase functions deploy abonnement-annuler --project-ref tiqtmoyxxqzabgaaiwfa --use-api
npx supabase functions deploy stripe-webhook --project-ref tiqtmoyxxqzabgaaiwfa --use-api
```
(`login` ouvre le navigateur ; `--use-api` évite d'avoir besoin de Docker.) Le fichier `supabase/config.toml` désactive la vérification de jeton de la plateforme (`verify_jwt = false`) : le webhook de Stripe n'envoie pas de jeton Supabase, et les trois autres fonctions vérifient elles-mêmes le jeton de session.

À refaire à chaque modification de `supabase/functions/`.

## D. Stripe : le webhook

1. Développeurs → *Webhooks* → *Add endpoint*.
2. **URL** : `https://tiqtmoyxxqzabgaaiwfa.supabase.co/functions/v1/stripe-webhook`
3. **Événements** à écouter (exactement ces cinq) :
   `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
4. Après création : *Signing secret* → *Reveal* (`whsec_…`) → copiez-le **dans le secret Supabase `STRIPE_WEBHOOK_SECRET`** (étape C). Nulle part ailleurs.

## E. Le test (carte de test Stripe)

1. Connectez-vous à l'appli avec le compte de `COMPTES_TEST`, en **formule gratuite** (si le compte est Premium à la main, lancez `supabase/premium-off.sql` dans l'éditeur Supabase).
2. Profil → Compte : la carte **« Passer Premium »** apparaît. Le bouton est grisé tant que la case n'est pas cochée.
3. Cochez la case, touchez « Passer Premium – 2,99 €/mois ». Sur la page Stripe : carte **4242 4242 4242 4242**, date dans le futur, code à 3 chiffres au choix, nom et e-mail au choix.
4. Retour dans l'appli : « Paiement reçu : activation en cours… », puis Premium. Vérifiez avec la requête 7 de `verifier-etape4.sql` (plan `premium`, statut `active`, consentement gardé).
5. Essayez « Gérer mon abonnement et mes factures » (portail), puis « Résilier mon abonnement » : l'appli dit « Premium jusqu'au… ».
6. Autres cartes de test : `4000 0000 0000 0002` (refusée), `4000 0000 0000 0341` (acceptée à la souscription, refusée aux renouvellements : pour tester le message « paiement échoué »). Pour simuler le passage du temps (fin de période, renouvellement), utilisez les **horloges de test** de Stripe (*Test clocks*, dans Facturation).
7. Si rien ne se passe après un paiement : Stripe → Développeurs → Webhooks → votre endpoint → les tentatives (code de réponse) ; Supabase → Edge Functions → `stripe-webhook` → Logs. Une réponse `400` veut presque toujours dire que `STRIPE_WEBHOOK_SECRET` est faux.

## Avant le passage en réel (checklist)

Rien de ce qui suit n'est fait pour vous. Cochez dans l'ordre :

- [ ] **Adresse du vendeur** : choisie (domiciliation ou adresse personnelle, avec votre comptable), écrite dans `js/mentions-config.js` (champ `adresse`) et dans Stripe (détails de l'entreprise). Elle apparaît alors dans les mentions légales, les CGV et les factures.
- [ ] **Médiateur de la consommation** : adhésion faite, coordonnées écrites dans `js/mentions-config.js` (champ `mediateur`).
- [ ] **CGV relues** par un professionnel (page `#/cgv`) : je les ai rédigées à partir de vos consignes, ce n'est pas un avis juridique.
- [ ] **Supabase Pro** (environ 25 $/mois) : sauvegardes de la base, pas de mise en pause du projet, 100 Go de fichiers. À faire **avant** le premier abonné payant.
- [ ] **Activation du compte Stripe** : SIRET, IBAN, pièce d'identité, détails de l'entreprise.
- [ ] **Refaire en mode réel** (bascule « Mode test » désactivée) dans Stripe : produit et prix 2,99 € (nouvel ID `price_…`), portail client, paiements échoués, modèle de facture (pied de page), nouveau webhook avec les 5 événements (nouveau `whsec_…`).
- [ ] **Remplacer les secrets Supabase** : `STRIPE_SECRET_KEY` (`sk_live_…`), `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` ; vérifier `SITE_URLS` (seulement `https://carnetpatte.com`).
- [ ] **`PAIEMENT_OUVERT=oui`** dans les secrets Supabase : à partir de là, tout le monde voit le bouton « Passer Premium ». Avant, seul `COMPTES_TEST` le voit.
- [ ] **Un vrai paiement d'essai** de 2,99 € avec votre propre carte, puis résiliation et remboursement depuis Stripe, pour vérifier la chaîne complète (facture reçue, Premium activé, résiliation).
- [ ] Retirer les mentions « pas encore ouverte au public » (page Profil et page Compte), mettre à jour la date des mentions légales, et écrire aux inscrits de la liste d'attente.
- [ ] Penser à déclarer ce chiffre d'affaires comme micro-entrepreneur (avec votre comptable).
