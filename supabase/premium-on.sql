-- TEST SANS PAIEMENT : passe un compte en Premium à la main. À coller dans Supabase → SQL Editor → Run.
-- Remplacez l'adresse ci-dessous par celle du compte à passer en Premium (entre les apostrophes), puis lancez.
-- Ne mettez JAMAIS votre vraie adresse dans un fichier du dépôt : ce fichier est public, modifiez-le seulement dans l'éditeur Supabase.
update public.profils
set plan = 'premium'
where id = (select id from auth.users where email = 'votre.adresse@exemple.fr');
-- Doit afficher « UPDATE 1 » : s'il affiche « UPDATE 0 », l'adresse ne correspond à aucun compte (ou le profil n'existe pas).
select u.email, p.plan, p.cloud_bloque from public.profils p join auth.users u on u.id = p.id where u.email = 'votre.adresse@exemple.fr';
