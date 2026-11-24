-- Carnet Patte, étape 4 des comptes : abonnement Premium (Stripe). Tables protégées, état de l'abonnement, passage Premium / gratuit par le SERVEUR seulement.
-- À coller TEL QUEL dans Supabase → SQL Editor → New query → Run, APRÈS etape2.sql, etape3.sql et etape3b.sql. On peut le relancer sans risque.
--
-- Principes :
--  * Le plan (gratuit / premium) ne change QUE par appliquer_abonnement(), appelée par l'Edge Function « stripe-webhook » (clé service_role) après vérification
--    de la signature de Stripe. Aucun droit pour « anon » ni « authenticated » : l'appli ne peut jamais se donner Premium.
--  * Les identifiants Stripe (client, abonnement) restent dans une table que l'appli ne peut ni lire ni écrire. Elle ne voit que l'état, par mon_abonnement().
--  * Les règles RLS sont activées SANS aucune règle : personne, hors service_role, n'a accès à ces tables.
--  * « Grant API access automatically » est décoché sur ce projet : on donne donc EXPLICITEMENT leurs droits au rôle service_role (celui des Edge Functions).
--  * Un compte avec un abonnement en cours ne peut pas être supprimé tant que l'abonnement n'est pas annulé chez Stripe (supprimer_mon_compte refuse).

-- ===== 1. Tables =====
create table if not exists public.abonnements (
  user_id                uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  statut                 text not null default 'aucun'
                         check (statut in ('aucun', 'incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  fin_periode            timestamptz,                       -- fin de la période payée en cours
  resiliation_prevue     boolean not null default false,    -- résilié : Premium jusqu'à fin_periode, puis gratuit
  paiement_echoue        boolean not null default false,    -- dernier paiement refusé : message dans l'appli
  consentement_le        timestamptz,                       -- preuve : la personne a demandé l'accès immédiat et reconnu perdre son droit de rétractation
  consentement_texte     text,
  maj_le                 timestamptz not null default now()
);

create table if not exists public.evenements_stripe (
  id      text primary key,   -- identifiant de l'événement Stripe : un événement n'est jamais traité deux fois
  type    text not null,
  recu_le timestamptz not null default now()
);

-- ===== 2. RLS sans aucune règle, et droits explicites : seul service_role y accède =====
alter table public.abonnements       enable row level security;
alter table public.evenements_stripe enable row level security;

revoke all on public.abonnements       from public, anon, authenticated;
revoke all on public.evenements_stripe from public, anon, authenticated;
grant select, insert, update on public.abonnements       to service_role;
grant select, insert         on public.evenements_stripe to service_role;

-- ===== 3. Ce que l'appli peut savoir : l'état de SON abonnement, sans les identifiants Stripe =====
create or replace function public.mon_abonnement() returns jsonb
language sql stable security definer set search_path = '' as $$
  select to_jsonb(a) from (
    select statut, fin_periode, resiliation_prevue, paiement_echoue
    from public.abonnements where user_id = (select auth.uid())
  ) a;
$$;
revoke execute on function public.mon_abonnement() from public, anon;
grant  execute on function public.mon_abonnement() to authenticated;

-- ===== 4. Appliquer l'état d'un abonnement ET changer la formule, en UNE opération (réservée à service_role) =====
-- Retourne 'applique', 'doublon' (événement déjà traité) ou 'inconnu' (compte supprimé entre-temps).
create or replace function public.appliquer_abonnement(
  p_evenement text, p_type text, p_user uuid, p_client text, p_abonnement text,
  p_statut text, p_fin timestamptz, p_resiliation boolean, p_echec boolean
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  lignes integer;
begin
  insert into public.evenements_stripe (id, type) values (p_evenement, p_type) on conflict (id) do nothing;
  get diagnostics lignes = row_count;
  if lignes = 0 then return 'doublon'; end if;
  if not exists (select 1 from auth.users where id = p_user) then return 'inconnu'; end if;

  insert into public.abonnements (user_id, stripe_customer_id, stripe_subscription_id, statut, fin_periode, resiliation_prevue, paiement_echoue, maj_le)
  values (p_user, p_client, p_abonnement, p_statut, p_fin, p_resiliation, p_echec, now())
  on conflict (user_id) do update set
    stripe_customer_id = excluded.stripe_customer_id, stripe_subscription_id = excluded.stripe_subscription_id, statut = excluded.statut,
    fin_periode = excluded.fin_periode, resiliation_prevue = excluded.resiliation_prevue, paiement_echoue = excluded.paiement_echoue, maj_le = now();

  -- active / trialing : Premium ; past_due (paiement échoué, Stripe réessaie) : Premium avec message ; tout le reste : gratuit (rien n'est supprimé)
  update public.profils set plan = case when p_statut in ('active', 'trialing', 'past_due') then 'premium' else 'gratuit' end where id = p_user;
  return 'applique';
end;
$$;
revoke execute on function public.appliquer_abonnement(text, text, uuid, text, text, text, timestamptz, boolean, boolean) from public, anon, authenticated;
grant  execute on function public.appliquer_abonnement(text, text, uuid, text, text, text, timestamptz, boolean, boolean) to service_role;

-- ===== 5. Suppression de SON compte : refuse s'il reste des fichiers (étape 3) OU un abonnement en cours (l'appli l'annule d'abord chez Stripe) =====
create or replace function public.supprimer_mon_compte() returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  restants bigint;
begin
  if uid is null then
    raise exception 'non connecté' using errcode = '28000';
  end if;
  if exists (select 1 from public.abonnements where user_id = uid and statut in ('trialing', 'active', 'past_due', 'unpaid', 'paused')) then
    raise exception 'abonnement_actif' using errcode = 'P0001', hint = 'Annulez d''abord l''abonnement.';
  end if;
  select count(*) into restants from storage.objects where bucket_id = 'documents' and name like uid::text || '/%';
  if restants > 0 then
    raise exception 'fichiers_restants' using errcode = 'P0001', hint = 'Supprimez d''abord les fichiers du cloud.';
  end if;
  -- Les lignes de profils, liste d'attente, elements, documents_cloud et abonnements partent avec le compte (on delete cascade)
  delete from auth.users where id = uid;
end;
$$;
revoke execute on function public.supprimer_mon_compte() from public, anon;
grant  execute on function public.supprimer_mon_compte() to authenticated;
