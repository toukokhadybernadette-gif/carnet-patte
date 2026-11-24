-- Carnet Patte, étape 3b : quota RÉEL des fichiers dans la règle « déposer (Premium) ».
-- À coller TEL QUEL dans Supabase → SQL Editor → New query → Run, APRÈS etape3.sql. On peut le relancer sans risque.
--
-- Pourquoi : etape3.sql contrôle le quota sur la taille DÉCLARÉE du fichier (table documents_cloud). Ici, on ajoute le contrôle sur la taille RÉELLE
-- des fichiers déjà déposés (metadata->>'size' dans storage.objects) : on ne peut plus déposer de fichier quand le dossier de la personne,
-- plus le fichier à déposer, dépasserait 100 Mo. La taille du fichier en cours de dépôt n'est pas connue de la règle à cet instant : on prend
-- celle déclarée (au plus 15 Mo, limite du bucket). Le dépassement possible par un utilisateur qui mentirait sur la taille est donc d'UN fichier
-- (15 Mo au plus) ; le contrôle horaire (entretien_cloud) bloque ensuite le compte tant qu'il dépasse.
--
-- Fichiers : pas de règle « update » sur storage.objects, volontairement. L'appli dépose avec upsert = false (insertion seule) ; un fichier qui existe
-- déjà (reprise après une coupure) répond « existe déjà », ce que l'appli accepte. Remplacer un fichier = nouveau nom (les photos portent l'empreinte
-- de leur contenu dans leur nom) ; jamais d'écrasement.

-- ===== 1. Taille réelle des fichiers de la personne connectée (lecture, sans passer par les règles pour éviter toute récursion) =====
create or replace function public.octets_cloud_reels() returns bigint
language sql stable security definer set search_path = '' as $$
  select coalesce(sum((metadata ->> 'size')::bigint), 0)::bigint
  from storage.objects
  where bucket_id = 'documents' and name like (select auth.uid())::text || '/%';
$$;
revoke execute on function public.octets_cloud_reels() from public, anon;
grant  execute on function public.octets_cloud_reels() to authenticated;

-- ===== 2. La règle « déposer » : Premium, dans son dossier, fichier déclaré, ET quota réel respecté =====
drop policy if exists "documents : déposer (Premium)" on storage.objects;
create policy "documents : déposer (Premium)" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.peut_ecrire_cloud()
    and exists (
      select 1 from public.documents_cloud d
      where d.user_id = (select auth.uid()) and d.user_id::text || '/' || d.id = name and not d.supprime
        and public.octets_cloud_reels() + d.taille <= 104857600
    )
  );
