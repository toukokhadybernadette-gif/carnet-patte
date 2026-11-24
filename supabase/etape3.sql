-- Carnet Patte, étape 3 des comptes : sauvegarde cloud et synchronisation entre appareils (réservées au Premium).
-- À coller TEL QUEL dans Supabase → SQL Editor → New query → Run, APRÈS etape2.sql. On peut le relancer sans risque (rien n'est perdu).
--
-- Principes :
--  * Tout se contrôle ICI, côté serveur (RLS) : un compte gratuit ne peut RIEN écrire dans le cloud, même en contournant l'appli.
--  * Droits explicites (« Grant API access automatically » est décoché) : rien pour « anon » (visiteur non connecté).
--  * « La dernière modification gagne », élément par élément : une écriture plus ancienne que celle déjà enregistrée est ignorée par le serveur.
--  * L'heure de réception (recu_le) est posée PAR LE SERVEUR : les appareils s'en servent pour demander « ce qui a changé depuis », jamais leur propre horloge.
--    L'heure de l'appareil (modifie_le) ne sert qu'à départager deux modifications du même élément.
--  * Les suppressions laissent une « stèle » (supprime = true, contenu vidé) pour que les autres appareils suppriment aussi ; les stèles de plus de 90 jours sont purgées.
--  * Les fichiers (documents, photos d'animaux) sont dans le bucket PRIVÉ « documents », un dossier par utilisateur. Les supprimer en SQL ne supprime pas les vrais fichiers :
--    l'appli les retire par l'API Storage AVANT de supprimer le compte, et supprimer_mon_compte() REFUSE de continuer s'il en reste (jamais de fichier orphelin).
--  * Quota de 100 Mo par compte : appliqué à l'enregistrement du document (déclencheur sur documents_cloud, message « quota_depasse »), avec un contrôle horaire de
--    la taille réelle des fichiers (entretien_cloud). Un déclencheur sur storage.objects n'est pas permis sur Supabase : on passe par documents_cloud.

-- ===== 0. Un compte dont les fichiers dépassent le quota est bloqué en écriture jusqu'à ce qu'il repasse sous le quota =====
alter table public.profils add column if not exists cloud_bloque boolean not null default false;

-- ===== 1. Qui a le droit d'écrire dans le cloud ? (Premium, non bloqué) =====
create or replace function public.peut_ecrire_cloud() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profils where id = (select auth.uid()) and plan = 'premium' and not cloud_bloque);
$$;
revoke execute on function public.peut_ecrire_cloud() from public, anon;
grant  execute on function public.peut_ecrire_cloud() to authenticated;

-- ===== 2. Tables =====
create table if not exists public.elements (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  collection text        not null check (collection in ('animaux', 'soins', 'pesees', 'oeufs', 'stocks', 'fichesGarde', 'profil')),
  item_id    text        not null check (char_length(item_id) between 1 and 80),
  donnees    jsonb       not null default '{}'::jsonb check (octet_length(donnees::text) <= 100000),
  modifie_le timestamptz not null,                          -- heure de l'APPAREIL : sert seulement à départager deux modifications
  recu_le    timestamptz not null default clock_timestamp(), -- heure du SERVEUR : sert à demander « ce qui a changé depuis »
  supprime   boolean     not null default false,
  primary key (user_id, collection, item_id)
);
create index if not exists elements_recu on public.elements (user_id, recu_le);

create table if not exists public.documents_cloud (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  id         text        not null check (id ~ '^[A-Za-z0-9_-]{1,80}$'),   -- le fichier est « <user_id>/<id> » dans le bucket « documents »
  genre      text        not null default 'document' check (genre in ('document', 'photo')),
  animal_id  text        check (char_length(animal_id) <= 80),
  titre      text        check (char_length(titre) <= 200),
  date       text        check (char_length(date) <= 10),
  type       text        check (char_length(type) <= 40),
  mime       text        not null check (mime in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf')),
  nom        text        check (char_length(nom) <= 200),
  taille     bigint      not null check (taille >= 0 and taille <= 15728640),  -- 15 Mo au plus par fichier
  ajoute_le  timestamptz not null default now(),
  modifie_le timestamptz not null,
  recu_le    timestamptz not null default clock_timestamp(),
  supprime   boolean     not null default false,
  primary key (user_id, id)
);
create index if not exists documents_cloud_recu on public.documents_cloud (user_id, recu_le);

-- ===== 3. Déclencheurs : dernière modification gagnante, heure du serveur, stèles vidées, plafonds =====
create or replace function public.elements_avant_ecriture() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.modifie_le <= old.modifie_le then return null; end if; -- écriture plus ancienne (ou identique) : ignorée, la plus récente reste
  elsif (select count(*) from public.elements where user_id = new.user_id) >= 20000 then
    raise exception 'limite_elements' using errcode = 'P0001';
  end if;
  new.recu_le := clock_timestamp();
  if new.supprime then new.donnees := '{}'::jsonb; end if;
  return new;
end;
$$;
drop trigger if exists elements_avant on public.elements;
create trigger elements_avant before insert or update on public.elements
  for each row execute function public.elements_avant_ecriture();

create or replace function public.documents_avant_ecriture() returns trigger
language plpgsql set search_path = '' as $$
declare
  quota constant bigint := 104857600; -- 100 Mo
begin
  if tg_op = 'UPDATE' then
    if new.modifie_le <= old.modifie_le then return null; end if;
  elsif (select count(*) from public.documents_cloud where user_id = new.user_id and not supprime) >= 300 then
    raise exception 'limite_documents' using errcode = 'P0001';
  end if;
  if new.supprime then
    new.taille := 0; -- le fichier est retiré par l'appli : la place est rendue
  elsif (select coalesce(sum(taille), 0) from public.documents_cloud where user_id = new.user_id and not supprime and id <> new.id) + new.taille > quota then
    raise exception 'quota_depasse' using errcode = 'P0001', hint = 'Le quota de 100 Mo est atteint.';
  end if;
  new.recu_le := clock_timestamp();
  return new;
end;
$$;
drop trigger if exists documents_avant on public.documents_cloud;
create trigger documents_avant before insert or update on public.documents_cloud
  for each row execute function public.documents_avant_ecriture();

-- ===== 4. RLS : chacun ne voit et n'écrit QUE ses lignes ; écrire = Premium. Pas de « delete » : on pose une stèle =====
alter table public.elements        enable row level security;
alter table public.documents_cloud enable row level security;

drop policy if exists "elements : lire les siens" on public.elements;
create policy "elements : lire les siens" on public.elements
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "elements : ajouter (Premium)" on public.elements;
create policy "elements : ajouter (Premium)" on public.elements
  for insert to authenticated with check ((select auth.uid()) = user_id and public.peut_ecrire_cloud());
drop policy if exists "elements : modifier (Premium)" on public.elements;
create policy "elements : modifier (Premium)" on public.elements
  for update to authenticated using ((select auth.uid()) = user_id and public.peut_ecrire_cloud())
  with check ((select auth.uid()) = user_id and public.peut_ecrire_cloud());

drop policy if exists "documents : lire les siens" on public.documents_cloud;
create policy "documents : lire les siens" on public.documents_cloud
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "documents : ajouter (Premium)" on public.documents_cloud;
create policy "documents : ajouter (Premium)" on public.documents_cloud
  for insert to authenticated with check ((select auth.uid()) = user_id and public.peut_ecrire_cloud());
drop policy if exists "documents : modifier (Premium)" on public.documents_cloud;
create policy "documents : modifier (Premium)" on public.documents_cloud
  for update to authenticated using ((select auth.uid()) = user_id and public.peut_ecrire_cloud())
  with check ((select auth.uid()) = user_id and public.peut_ecrire_cloud());

-- ===== 5. Droits explicites (on retire tout, puis on donne le strict nécessaire) =====
revoke all on public.elements        from anon, authenticated;
revoke all on public.documents_cloud from anon, authenticated;
grant select, insert, update on public.elements        to authenticated;
grant select, insert, update on public.documents_cloud to authenticated;

-- ===== 6. Fichiers : bucket PRIVÉ « documents », un dossier par utilisateur (« <user_id>/<id> ») =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "documents : lire ses fichiers" on storage.objects;
create policy "documents : lire ses fichiers" on storage.objects
  for select to authenticated using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Déposer : Premium, dans son dossier, ET seulement un fichier déjà déclaré dans documents_cloud (c'est là que le quota est contrôlé)
drop policy if exists "documents : déposer (Premium)" on storage.objects;
create policy "documents : déposer (Premium)" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.peut_ecrire_cloud()
    and exists (select 1 from public.documents_cloud d where d.user_id = (select auth.uid()) and d.user_id::text || '/' || d.id = name and not d.supprime)
  );

-- Supprimer SES fichiers : toujours permis (même après un retour au plan gratuit, pour libérer la place ou partir)
drop policy if exists "documents : supprimer ses fichiers" on storage.objects;
create policy "documents : supprimer ses fichiers" on storage.objects
  for delete to authenticated using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ===== 7. Suppression de SON compte : refuse s'il reste des fichiers (l'appli les supprime d'abord par l'API Storage) =====
create or replace function public.supprimer_mon_compte() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  restants bigint;
begin
  if uid is null then
    raise exception 'non connecté' using errcode = '28000';
  end if;
  select count(*) into restants from storage.objects where bucket_id = 'documents' and name like uid::text || '/%';
  if restants > 0 then
    raise exception 'fichiers_restants' using errcode = 'P0001', hint = 'Supprimez d''abord les fichiers du cloud.';
  end if;
  -- Les lignes de profils, liste d'attente, elements et documents_cloud partent avec le compte (on delete cascade)
  delete from auth.users where id = uid;
end;
$$;
revoke execute on function public.supprimer_mon_compte() from public, anon;
grant  execute on function public.supprimer_mon_compte() to authenticated;

-- ===== 8. Entretien (toutes les heures) : purge des stèles de plus de 90 jours, contrôle de la taille RÉELLE des fichiers =====
create or replace function public.entretien_cloud() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.elements        where supprime and recu_le < now() - interval '90 days';
  delete from public.documents_cloud where supprime and recu_le < now() - interval '90 days';
  -- Compte dont les fichiers pèsent plus de 100 Mo en vrai : écriture bloquée ; débloqué dès qu'il repasse sous le quota
  update public.profils p set cloud_bloque = coalesce((
    select sum((o.metadata ->> 'size')::bigint) > 104857600
    from storage.objects o where o.bucket_id = 'documents' and o.name like p.id::text || '/%'
  ), false);
end;
$$;
revoke execute on function public.entretien_cloud() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'carnetpatte-entretien';
  perform cron.schedule('carnetpatte-entretien', '17 * * * *', 'select public.entretien_cloud()');
exception when others then
  raise notice 'pg_cron indisponible (%) : activez l''extension « pg_cron » dans Database → Extensions, puis relancez ce script.', sqlerrm;
end;
$$;
