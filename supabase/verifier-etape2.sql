-- Vérification de l'étape 2 (lecture seule) : à lancer dans le SQL Editor après etape2.sql, et à me copier-coller le résultat si un doute.

-- 1. RLS activée sur les deux tables (rowsecurity doit valoir true)
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename in ('profils', 'liste_attente_premium');

-- 2. Les règles : 1 pour profils (select), 3 pour liste_attente_premium (select, insert, delete), toutes « authenticated »
select tablename, policyname, cmd, roles from pg_policies where schemaname = 'public' order by tablename, cmd;

-- 3. Les droits : rien pour anon ; authenticated = select (profils) et select, insert, delete (liste_attente_premium)
select table_name, grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('profils', 'liste_attente_premium') and grantee in ('anon', 'authenticated')
order by table_name, grantee, privilege_type;

-- 4. Qui peut appeler les fonctions : supprimer_mon_compte = authenticated seulement ; creer_profil = personne
select p.proname as fonction, r.rolname as role, has_function_privilege(r.oid, p.oid, 'execute') as peut_executer
from pg_proc p cross join pg_roles r
where p.pronamespace = 'public'::regnamespace and p.proname in ('supprimer_mon_compte', 'creer_profil') and r.rolname in ('anon', 'authenticated')
order by p.proname, r.rolname;
