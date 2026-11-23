# Créer le projet Supabase (offre gratuite, région Europe)

Supabase gardera plus tard les comptes et (pour Premium) les données synchronisées. Pour l'instant (étape 0), il sert seulement à **tester la connexion par code à 6 chiffres** sur l'iPhone.

**Ce que vous me donnerez à la fin : 2 valeurs seulement** (l'adresse du projet et la clé « publishable »). Elles sont publiques par conception. **Ne me donnez jamais** le mot de passe de la base, la clé « secret » ni « service_role ».

> Les libellés de Supabase changent parfois. Si un bouton n'a pas exactement ce nom, cherchez le plus proche et dites-moi ce que vous voyez.

---

## 1. Compte

1. Allez sur **supabase.com** → **Start your project** (ou **Sign in**).
2. Connectez-vous avec **GitHub** (le plus simple) ou avec une adresse e-mail. Confirmez l'e-mail si on vous le demande.

## 2. Organisation

3. Si Supabase propose de créer une **organisation** : nom `Carnet Patte`, type **Personal**, plan **Free** → **Create organization**.

## 3. Projet

4. **New project** (« Nouveau projet »), dans l'organisation `Carnet Patte`.
5. Remplissez :
   | Champ | Valeur |
   |---|---|
   | Name | `carnet-patte` |
   | Database Password | cliquez **Generate a password**, puis **copiez-le dans un gestionnaire de mots de passe** (ou un carnet). Vous ne pourrez plus le revoir. **Ne me l'envoyez pas.** |
   | Region | **West EU (Paris)**. Si Paris n'existe pas dans la liste : **Central EU (Frankfurt)**. Surtout pas une région hors d'Europe. |
   | Pricing plan | **Free** (aucune carte bancaire demandée) |
6. Si une case « **Enable Data API** » ou « **Automatically enable RLS** » (ou « Enable Row Level Security ») apparaît : **laissez cochées**. La sécurité par utilisateur en dépend.
7. **Create new project**. Patientez 1 à 2 minutes (« Setting up your project »).

## 4. Réglages de connexion par e-mail

8. Menu de gauche → **Authentication**.
9. **Sign In / Providers** (ou « Providers ») → **Email** : le fournisseur doit être **activé**. Réglages utiles :
   - **Confirm email** : peut rester activé (le code sert de confirmation).
   - **Email OTP Length** : **6**.
   - **Email OTP Expiration** : 3600 secondes par défaut est correct (vous pouvez mettre 900 = 15 minutes).
   - Cliquez **Save**.
10. **Email Templates** (ou « Emails » → « Templates ») : il y a deux modèles à changer, **Magic Link** et **Confirm signup**. Dans **chacun** :
    - *Subject* : `Votre code Carnet Patte`
    - *Message (body)* : remplacez le contenu par ceci, puis **Save** :
      ```html
      <p>Bonjour,</p>
      <p>Votre code de connexion à Carnet Patte : <strong style="font-size:22px;letter-spacing:4px">{{ .Token }}</strong></p>
      <p>Il est valable 1 heure. Si vous n'avez rien demandé, ignorez ce message.</p>
      ```
    Le mot `{{ .Token }}` est ce qui met le code à 6 chiffres dans le message : sans lui, aucun code n'est envoyé.
11. **URL Configuration** : *Site URL* = `https://carnetpatte.com`. Dans *Redirect URLs* ajoutez `https://carnetpatte.com/**`. **Save**.

**Limite à connaître** : l'envoi d'e-mails intégré de Supabase est **très limité** (quelques messages par heure) : suffisant pour votre essai, pas pour de vrais utilisateurs. À l'étape suivante nous brancherons un vrai service d'envoi (Resend, offre gratuite) avec votre domaine.

## 5. Les deux valeurs à me donner

12. Menu de gauche → roue crantée **Project Settings** → **API Keys** (ou « API »).
13. Notez :
    - **Project URL** : de la forme `https://abcdefghijklmnop.supabase.co`
    - **Publishable key** : commence par `sb_publishable_…` (si vous ne voyez que « anon » / « Legacy API keys », la clé **anon public** convient aussi).
14. Envoyez-moi ces deux valeurs. **Pas** la « secret key », **pas** « service_role », **pas** le mot de passe de la base.

## 6. Ensuite (je m'en occupe)

Je les écris dans `js/supabase-config.js` (public par conception), je pousse la branche `comptes`, et vous testez la connexion sur l'iPhone (voir l'écran **Profil → Compte (essai)**). Les tables et les règles de sécurité (RLS) arrivent à l'étape 2, avec les sauvegardes automatiques **avant** de mettre de vraies données.

## 7. Vrai envoi d'e-mails : Resend avec carnetpatte.com (Cloudflare)

Sans SMTP personnalisé, Supabase n'autorise pas à changer le modèle d'e-mail et limite fortement les envois. Resend (offre gratuite : 100 e-mails par jour, 3 000 par mois) envoie les codes depuis `@carnetpatte.com`.

**A. Resend : ajouter le domaine**
1. Créez un compte sur resend.com. **Domains** → **Add Domain** → `carnetpatte.com`, région **Ireland (eu-west-1)** (données en Europe).
2. Resend affiche des enregistrements DNS (en général 1 MX et 1 TXT « SPF » sur `send`, 1 TXT « DKIM » sur `resend._domainkey`). Deux façons de les créer :
   - **Automatique** : bouton « Sign in to Cloudflare » / « Auto configure », vous autorisez, c'est fait ;
   - **À la main** : Cloudflare → carnetpatte.com → **DNS** → **Records** → **Add record**, un par ligne de Resend (même type, même nom, même valeur). Pour chacun, **Proxy status = « DNS only »** (nuage gris, pas orange).
3. Retour dans Resend → **Verify DNS Records**. Quelques minutes suffisent d'habitude ; le domaine doit passer à **Verified**.
4. Facultatif mais conseillé : un enregistrement TXT `_dmarc` avec la valeur `v=DMARC1; p=none;` (aide à ne pas finir dans les indésirables).

**B. Resend : créer la clé**
5. **API Keys** → **Create API Key**, nom `supabase`, permission **Sending access**, domaine `carnetpatte.com`. La clé commence par `re_` et ne s'affiche qu'une fois.
6. Cette clé est **secrète** : elle va uniquement dans Supabase (étape 7). Ne l'écrivez ni dans le dépôt, ni dans un message, ni à moi.

**C. Supabase : brancher Resend**
7. Supabase → **Authentication** → **Emails** → **SMTP Settings** → **Enable Custom SMTP** :
   - Sender email : `noreply@carnetpatte.com` · Sender name : `Carnet Patte`
   - Host : `smtp.resend.com` · Port : `465`
   - Username : `resend` · Password : la clé `re_…`
   - **Save**.
8. **Authentication** → **Rate Limits** : « emails sent per hour » est limité à 30 après un SMTP perso ; c'est largement suffisant pour l'essai.
9. **Authentication** → **Emails** → **Templates** : les modèles sont maintenant modifiables. **Magic Link** et **Confirm signup**, chacun avec le sujet et le corps de l'étape 10 ci-dessus (`{{ .Token }}` = le code à 6 chiffres).
10. **URL Configuration** : *Site URL* = `https://carnetpatte.com`, *Redirect URLs* = `https://carnetpatte.com/**`.

**Test** : sur l'iPhone, Profil → Compte (essai), saisissez votre e-mail : le code arrive de `noreply@carnetpatte.com`.

## Limites de l'offre gratuite (rappel)

500 Mo de base, 1 Go de fichiers, 5 Go de transfert par mois, 50 000 utilisateurs actifs par mois, **pas de sauvegarde** et **pause du projet après une semaine d'inactivité**. Elles conviennent à l'essai ; pour de vrais abonnés payants, il faudra passer au palier Pro (environ 25 $/mois), comme prévu dans le plan.
