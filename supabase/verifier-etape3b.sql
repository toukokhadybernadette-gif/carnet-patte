-- Vérification de l'étape 3b (lecture seule) : à lancer dans le SQL Editor après etape3b.sql, et à me copier-coller le résultat si un doute.

-- 1. Aucune règle « update » (ni « all ») sur storage.objects : doit renvoyer 0 ligne (l'appli dépose avec upsert = false)
select policyname, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd in ('UPDATE', 'ALL');

-- 2. La règle « déposer » contient bien le contrôle du quota réel : la colonne with_check doit citer octets_cloud_reels() et 104857600
select policyname, cmd, roles, with_check from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname = 'documents : déposer (Premium)';

-- 3. Les 3 règles des fichiers (lire, déposer, supprimer), toutes « authenticated »
select policyname, cmd, roles from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'documents :%' order by cmd;

-- 4. Qui peut appeler octets_cloud_reels : authenticated seulement (jamais anon)
select p.proname as fonction, r.rolname as role, has_function_privilege(r.oid, p.oid, 'execute') as peut_executer
from pg_proc p cross join pg_roles r
where p.pronamespace = 'public'::regnamespace and p.proname = 'octets_cloud_reels' and r.rolname in ('anon', 'authenticated');

-- 5. Espace réel occupé par dossier (les fichiers, tels que Supabase les a reçus) : à comparer au quota de 104857600 octets
select split_part(name, '/', 1) as dossier, count(*) as fichiers, sum((metadata ->> 'size')::bigint) as octets_reels
from storage.objects where bucket_id = 'documents' group by 1 order by 3 desc;
