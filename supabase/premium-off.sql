-- TEST SANS PAIEMENT : remet un compte en formule gratuite. À coller dans Supabase → SQL Editor → Run.
-- Remplacez l'adresse ci-dessous par celle du compte (entre les apostrophes), dans l'éditeur Supabase seulement : ce fichier du dépôt est public.
-- Les données déjà dans le cloud restent lisibles et téléchargeables ; le compte ne peut plus rien y ÉCRIRE.
update public.profils
set plan = 'gratuit'
where id = (select id from auth.users where email = 'votre.adresse@exemple.fr');
select u.email, p.plan, p.cloud_bloque from public.profils p join auth.users u on u.id = p.id where u.email = 'votre.adresse@exemple.fr';
