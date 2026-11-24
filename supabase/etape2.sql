-- Carnet Patte, étape 2 des comptes : profils, liste d'attente Premium, suppression de compte.
-- À coller TEL QUEL dans Supabase → SQL Editor → New query → Run. On peut le relancer sans risque (rien n'est perdu).
--
-- Principes :
--  * RLS (règles de sécurité par ligne) activée sur chaque table : chacun ne voit et ne touche QUE ses propres lignes.
--  * Droits donnés explicitement (« Grant API access automatically » est décoché) : rien pour « anon » (visiteur non connecté).
--  * Le plan (gratuit / premium) se lit mais ne s'écrit PAS depuis l'appli : personne ne peut se donner Premium tout seul.
--  * Aucune donnée d'animal n'est stockée ici : la sauvegarde cloud et la synchro (Premium) viendront plus tard, avec leurs propres tables.

-- ===== 1. Tables =====
create table if not exists public.profils (
  id      uuid primary key references auth.users (id) on delete cascade,
  plan    text not null default 'gratuit' check (plan in ('gratuit', 'premium')),
  cree_le timestamptz not null default now()
);

create table if not exists public.liste_attente_premium (
  user_id uuid primary key references auth.users (id) on delete cascade,
  cree_le timestamptz not null default now()
);

-- ===== 2. RLS =====
alter table public.profils               enable row level security;
alter table public.liste_attente_premium enable row level security;

drop policy if exists "profils : lire le sien" on public.profils;
create policy "profils : lire le sien" on public.profils
  for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "attente : lire la sienne" on public.liste_attente_premium;
create policy "attente : lire la sienne" on public.liste_attente_premium
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "attente : s'inscrire" on public.liste_attente_premium;
create policy "attente : s'inscrire" on public.liste_attente_premium
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "attente : se retirer" on public.liste_attente_premium;
create policy "attente : se retirer" on public.liste_attente_premium
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ===== 3. Droits explicites (on retire tout, puis on donne le strict nécessaire) =====
revoke all on public.profils               from anon, authenticated;
revoke all on public.liste_attente_premium from anon, authenticated;
grant select                 on public.profils               to authenticated;
grant select, insert, delete on public.liste_attente_premium to authenticated;

-- ===== 4. Un profil « gratuit » est créé tout seul à la création de chaque compte =====
create or replace function public.creer_profil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profils (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
revoke execute on function public.creer_profil() from public, anon, authenticated;

drop trigger if exists a_la_creation_du_compte on auth.users;
create trigger a_la_creation_du_compte after insert on auth.users
  for each row execute function public.creer_profil();

insert into public.profils (id) select id from auth.users on conflict do nothing; -- comptes déjà créés pendant l'essai

-- ===== 5. Suppression de SON compte (droit à l'effacement) =====
-- Supprime la ligne de auth.users de la personne connectée ; ses profils et sa ligne de liste d'attente partent avec (on delete cascade).
create or replace function public.supprimer_mon_compte() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then
    raise exception 'non connecté' using errcode = '28000';
  end if;
  delete from auth.users where id = uid;
end;
$$;
revoke execute on function public.supprimer_mon_compte() from public, anon;
grant  execute on function public.supprimer_mon_compte() to authenticated;
