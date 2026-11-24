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

Je les écris dans `js/supabase-config.js` (public par conception), je pousse la branche `comptes`, et vous testez la connexion sur l'iPhone (voir l'écran **Profil → Compte**). Les tables et les règles de sécurité (RLS) arrivent à l'étape 2, avec les sauvegardes automatiques **avant** de mettre de vraies données.

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

**Test** : sur l'iPhone, Profil → Compte, saisissez votre e-mail : le code arrive de `noreply@carnetpatte.com`.

## 8. Étape 2 : tables, règles de sécurité (RLS), suppression de compte

Le fichier `supabase/etape2.sql` crée :
- `profils` (formule gratuite ou Premium, créée toute seule pour chaque compte) : lisible par son propriétaire, **non modifiable depuis l'appli** (personne ne peut se donner Premium) ;
- `liste_attente_premium` : chacun peut s'y inscrire, voir et retirer **sa** ligne, rien d'autre ;
- la fonction `supprimer_mon_compte()` : supprime le compte de la personne connectée (et ses lignes, en cascade) ;
- les droits **explicites** (« Grant API access automatically » étant décoché) : rien pour `anon`, le strict nécessaire pour `authenticated`.

**À exécuter** : Supabase → **SQL Editor** → **New query** → collez tout `supabase/etape2.sql` → **Run** (« Success. No rows returned »). On peut le relancer sans risque.
Puis une nouvelle requête avec `supabase/verifier-etape2.sql` (lecture seule) : `rowsecurity` doit valoir `true` pour les deux tables, `anon` ne doit apparaître nulle part dans les droits, et `supprimer_mon_compte` doit être exécutable par `authenticated` seulement.

## 9. Étape 3 : sauvegarde cloud et synchronisation (Premium)

Le fichier `supabase/etape3.sql` (à lancer **après** l'étape 2) crée :
- `elements` : un enregistrement par animal, soin, pesée, fiche de garde… (`donnees` en JSON, `modifie_le` = heure de l'appareil pour départager deux modifications, `recu_le` = heure du **serveur** pour demander « ce qui a changé depuis », `supprime` = stèle) ;
- `documents_cloud` : la liste des fichiers (documents et photos d'animaux), avec leur taille ; c'est ici que le **quota de 100 Mo** est appliqué ;
- le bucket privé `documents` (Storage) : un dossier par utilisateur, accès limité au sien ;
- la règle **Premium requis pour écrire** (fonction `peut_ecrire_cloud()`), appliquée côté serveur : un compte gratuit qui contourne l'appli est refusé (code 42501) ;
- une tâche horaire (`pg_cron`) : purge des stèles de plus de 90 jours et contrôle de la taille **réelle** des fichiers (un compte qui dépasse 100 Mo est bloqué en écriture jusqu'à repasser sous le quota) ;
- `supprimer_mon_compte()` mise à jour : elle **refuse** de supprimer le compte s'il reste des fichiers. L'appli les supprime d'abord par l'API Storage (supprimer des lignes de `storage.objects` en SQL ne retire pas les vrais fichiers).

**À exécuter** : SQL Editor → New query → collez tout `supabase/etape3.sql` → **Run**. Un message « pg_cron indisponible » (NOTICE) signifie qu'il faut activer l'extension : **Database → Extensions → pg_cron → Enable**, puis relancer le script. Puis une nouvelle requête avec `supabase/verifier-etape3.sql` (lecture seule) et vérifiez :
1. `rowsecurity = true` pour `elements` et `documents_cloud` ;
2. 3 règles par table (select, insert, update), toutes `authenticated`, **aucune** « delete » ;
3. `anon` n'apparaît nulle part dans les droits ; `authenticated` = select, insert, update ;
4. bucket `documents` : `public = false`, 15 Mo par fichier ;
5. 3 règles Storage (lire, déposer, supprimer) ; 6. `peut_ecrire_cloud` et `supprimer_mon_compte` exécutables par `authenticated` seulement, `entretien_cloud` par personne ;
7. 4 déclencheurs ; 8. la tâche `carnetpatte-entretien` existe et `active = true` ; 9. `peut_lire_les_fichiers = true` ; 10. aucune ligne de fichiers orphelins.

**Étape 3b (quota réel)** : collez ensuite `supabase/etape3b.sql` → Run, puis `supabase/verifier-etape3b.sql` : la requête 1 doit renvoyer **0 ligne** (aucune règle « update » sur les fichiers : l'appli dépose avec `upsert = false`), la requête 2 doit montrer `octets_cloud_reels()` et `104857600` dans `with_check`, la requête 4 `authenticated = true` et `anon = false`.

**Tester sans paiement** : dans l'éditeur Supabase, ouvrez `supabase/premium-on.sql`, remplacez l'adresse par la vôtre **dans l'éditeur seulement** (jamais dans le fichier du dépôt), Run : « UPDATE 1 ». `supabase/premium-off.sql` remet le compte en gratuit : ses données cloud restent lisibles, mais il ne peut plus rien y écrire.

**Limites à connaître**
- Le quota de 100 Mo est contrôlé à l'enregistrement du fichier (taille déclarée), puis, avec l'étape 3b, à chaque dépôt sur la taille **réelle** des fichiers déjà là, et toutes les heures. Supabase n'autorise pas de déclencheur sur `storage.objects`. Un utilisateur malveillant qui mentirait sur la taille ne peut dépasser que d'un fichier (15 Mo au plus) ; si cela devient un risque, il faudra une Edge Function.
- Un appareil resté hors ligne plus de 90 jours peut ressusciter des éléments supprimés entre-temps (leurs stèles ont été purgées).
- Pas de restauration d'anciennes versions ni de carnet partagé : prévus plus tard.

## Limites de l'offre gratuite (rappel) et passage en Pro


500 Mo de base, 1 Go de fichiers, 5 Go de transfert par mois, 50 000 utilisateurs actifs par mois, **pas de sauvegarde** et **pause du projet après une semaine d'inactivité**. Elles conviennent à l'essai ; pour de vrais abonnés payants, il faudra passer au palier Pro (environ 25 $/mois), comme prévu dans le plan.

**Quand passer en Pro (environ 25 $/mois) ?**
- **Dès le premier abonné payant**, pour une raison qui ne dépend pas du nombre d'utilisateurs : l'offre gratuite n'a **aucune sauvegarde** de la base et met le projet **en pause après une semaine d'inactivité**. Il ne faut pas vendre une « sauvegarde » sans l'avoir.
- **Stockage de fichiers (1 Go)** : c'est la première limite. Un Premium qui remplit son quota occupe 100 Mo, un usage typique 5 à 20 Mo (photos réduites à 400 px, quelques PDF). Compter **environ 50 à 60 Premium** en usage typique, **10 seulement** si tous remplissent leur quota.
- **Base de données (500 Mo)** : un carnet pèse environ 20 à 200 Ko de JSON : plus de 2 000 Premium avant d'être gêné. Ce n'est pas la limite.
- **Transfert (5 Go par mois)** : l'appli consulte le serveur toutes les 60 s **seulement quand elle est ouverte** (environ 50 à 100 Mo par appareil et par mois). Restaurer un carnet sur un nouvel appareil télécharge ses fichiers. À surveiller vers quelques dizaines d'appareils très actifs.
