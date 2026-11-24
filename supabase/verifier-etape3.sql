-- Vérification de l'étape 3 (lecture seule) : à lancer dans le SQL Editor après etape3.sql, et à me copier-coller le résultat si un doute.

-- 1. RLS activée sur les deux tables (rowsecurity doit valoir true)
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename in ('elements', 'documents_cloud');

-- 2. Les règles : 3 par table (select, insert, update), toutes « authenticated » ; aucune règle « delete » (on pose des stèles)
select tablename, policyname, cmd, roles from pg_policies where schemaname = 'public' and tablename in ('elements', 'documents_cloud') order by tablename, cmd;

-- 3. Les droits : RIEN pour anon ; authenticated = select, insert, update seulement (pas de delete, pas de truncate)
select table_name, grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('elements', 'documents_cloud') and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;

-- 4. Le bucket « documents » : public = false (privé), 15 Mo au plus par fichier, seulement images et PDF
select id, public, file_size_limit, allowed_mime_types from storage.buckets where id = 'documents';

-- 5. Les règles des fichiers : 3 règles « documents : … » (lire, déposer, supprimer), toutes « authenticated », aucune pour anon
select policyname, cmd, roles from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'documents :%' order by cmd;

-- 6. Qui peut appeler les fonctions : peut_ecrire_cloud et supprimer_mon_compte = authenticated seulement ; entretien_cloud et les déclencheurs = personne
select p.proname as fonction, r.rolname as role, has_function_privilege(r.oid, p.oid, 'execute') as peut_executer
from pg_proc p cross join pg_roles r
where p.pronamespace = 'public'::regnamespace and p.proname in ('peut_ecrire_cloud', 'supprimer_mon_compte', 'entretien_cloud') and r.rolname in ('anon', 'authenticated')
order by p.proname, r.rolname;

-- 7. Les déclencheurs sont en place (4 lignes : elements_avant et documents_avant, en insert et en update)
select event_object_table as table, trigger_name, event_manipulation from information_schema.triggers
where trigger_schema = 'public' and trigger_name in ('elements_avant', 'documents_avant') order by 1, 3;

-- 8. La tâche horaire d'entretien (purge des stèles de plus de 90 jours, contrôle des quotas) : 1 ligne, active = true
select jobname, schedule, active from cron.job where jobname = 'carnetpatte-entretien';

-- 9. Le compte peut-il lire les fichiers pour vérifier qu'il n'en reste pas à la suppression ? (doit valoir true)
select has_table_privilege('postgres', 'storage.objects', 'select') as peut_lire_les_fichiers;

-- 10. Fichiers orphelins (dont le propriétaire n'existe plus) : doit renvoyer 0 ligne
select name from storage.objects
where bucket_id = 'documents' and split_part(name, '/', 1) not in (select id::text from auth.users);

-- 11. Votre compte : plan et blocage (remplacez l'adresse dans l'éditeur seulement, pas dans le fichier du dépôt)
select u.email, p.plan, p.cloud_bloque,
  (select count(*) from public.elements e where e.user_id = u.id and not e.supprime) as elements,
  (select coalesce(sum(taille), 0) from public.documents_cloud d where d.user_id = u.id and not d.supprime) as octets_declares
from auth.users u join public.profils p on p.id = u.id where u.email = 'votre.adresse@exemple.fr';
