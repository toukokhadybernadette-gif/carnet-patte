-- Vérification de l'étape 4 (lecture seule) : à lancer dans le SQL Editor après etape4.sql, et à me copier-coller le résultat si un doute.

-- 1. RLS activée sur les deux tables (rowsecurity doit valoir true)
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename in ('abonnements', 'evenements_stripe');

-- 2. AUCUNE règle sur ces tables : doit renvoyer 0 ligne (personne, hors service_role, n'y accède)
select tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('abonnements', 'evenements_stripe');

-- 3. Les droits : RIEN pour anon ni authenticated ; service_role = select, insert, update (abonnements) et select, insert (evenements_stripe)
select table_name, grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('abonnements', 'evenements_stripe') and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

-- 4. Qui peut appeler les fonctions : mon_abonnement et supprimer_mon_compte = authenticated ; appliquer_abonnement = service_role SEULEMENT (jamais anon ni authenticated)
select p.proname as fonction, r.rolname as role, has_function_privilege(r.oid, p.oid, 'execute') as peut_executer
from pg_proc p cross join pg_roles r
where p.pronamespace = 'public'::regnamespace and p.proname in ('mon_abonnement', 'appliquer_abonnement', 'supprimer_mon_compte') and r.rolname in ('anon', 'authenticated', 'service_role')
order by p.proname, r.rolname;

-- 5. La formule ne peut pas être modifiée par l'appli : profils n'a que « select » pour authenticated (doit renvoyer une seule ligne : select)
select privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'profils' and grantee = 'authenticated';

-- 6. supprimer_mon_compte connaît l'abonnement : doit renvoyer true
select pg_get_functiondef('public.supprimer_mon_compte'::regproc) like '%abonnement_actif%' as refuse_si_abonnement;

-- 7. Les comptes et leur formule (sans aucune adresse e-mail) : après un paiement de test, une ligne « premium » avec un abonnement « active » doit apparaître
select p.plan, a.statut, a.resiliation_prevue, a.paiement_echoue, a.fin_periode, (a.consentement_le is not null) as consentement_garde
from public.profils p left join public.abonnements a on a.user_id = p.id order by a.maj_le desc nulls last limit 20;
