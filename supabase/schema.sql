-- MOURESS Académie — schéma Supabase (PostgreSQL).
-- ATTENTION : ce schéma et js/store-supabase.js N'ONT PAS ÉTÉ TESTÉS contre une vraie instance Supabase.
-- À relire et exécuter dans l'éditeur SQL d'un projet de test avant toute mise en production.
--
-- Principes :
--  * Les comptes RH passent par Supabase Auth ; chaque utilisateur appartient à une entreprise (table profiles).
--  * Les candidats n'ont PAS de compte : ils agissent via des fonctions RPC « security definer » identifiées par le token
--    de leur lien (#/t/<token>) ou par un identifiant d'appareil pour les examens libres.
--  * La vérification d'une attestation est publique via verify_certificate(code) (ne renvoie que le strict nécessaire).
--  * V1 : la notation est faite côté client (corrigés présents dans les JSON). À terme, déplacer la notation dans une
--    fonction serveur (rpc_score_attempt) avec les corrigés stockés en base.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- Tables
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Utilisateurs RH (le « profil » ici est celui d'un compte, à ne pas confondre avec les profils métier du catalogue).
create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  company_id uuid not null references companies (id) on delete cascade,
  full_name text not null,
  role text not null default 'hr' check (role in ('hr', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  type text not null default 'recruitment' check (type in ('recruitment', 'training')),
  title text not null,
  profile_id text not null,               -- identifiant du profil métier (data/profiles.json)
  level text not null default 'tech',     -- niveau du poste (détermine le prix du Pass)
  question_count integer not null default 30 check (question_count between 5 and 60),
  pass_mark integer not null default 70 check (pass_mark between 1 and 100),
  deadline timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(10), 'hex'),
  name text not null default '',
  email text not null default '',
  order_id uuid,
  price integer,                          -- prix du Pass payé (FCFA)
  training_at timestamptz,                -- premier suivi de formation / entraînement
  created_at timestamptz not null default now()
);
create index if not exists invitations_session_idx on invitations (session_id);
create index if not exists invitations_email_idx on invitations (lower(email));

create table if not exists attempts (
  id text primary key,                    -- identifiant généré par le client (a_xxxx)
  invitation_id uuid references invitations (id) on delete set null,
  session_id uuid references sessions (id) on delete set null,
  device_id text,
  profile_id text not null,
  profile_name text,
  candidate_name text not null,
  candidate_email text,
  status text not null default 'in_progress' check (status in ('in_progress', 'done')),
  pass_mark integer not null default 70,
  total integer not null,
  correct integer,
  percent integer,
  passed boolean,
  duration_ms integer,
  themes jsonb,
  state jsonb,                            -- phase, idx, qStart, items (ordre mélangé) pour la reprise
  cert_code text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists attempts_session_idx on attempts (session_id);
create index if not exists attempts_invitation_idx on attempts (invitation_id);

create table if not exists answers (
  id bigint generated always as identity primary key,
  attempt_id text not null references attempts (id) on delete cascade,
  position integer not null,
  question_id text not null,
  theme text,
  picked integer,                         -- indice affiché, null = temps écoulé
  ok boolean,
  time_used_ms integer
);
create index if not exists answers_attempt_idx on answers (attempt_id);

create table if not exists certificates (
  code text primary key check (code ~ '^MRS-[0-9]{4}-[A-Z0-9]{6}$'),
  attempt_id text not null unique references attempts (id) on delete cascade,
  holder_name text not null,
  holder_email text,
  profile_id text not null,
  profile_name text,
  percent integer not null,
  pass_mark integer not null,
  issued_at timestamptz not null default now()
);

create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions (id) on delete cascade,
  invitation_id uuid not null references invitations (id) on delete cascade,
  kind text not null check (kind in ('module', 'practice')),
  profile_id text not null,
  module_id text,
  theme text,
  due timestamptz not null,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

-- Commandes de Pass (une par achat : N personnes pour un poste). Aucune donnée de carte n'est stockée.
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  company_id uuid not null references companies (id) on delete cascade,
  session_id uuid references sessions (id) on delete set null,
  session_title text,
  profile_id text not null,
  profile_name text,
  level text not null,
  unit_price integer not null,
  qty integer not null check (qty > 0),
  total integer not null,
  method text,
  ref text,
  demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- Aide RLS
create or replace function current_company() returns uuid
language sql stable security definer set search_path = public as
$$ select company_id from profiles where id = auth.uid() $$;

-- ---------------------------------------------------------------- RLS
alter table companies enable row level security;
alter table profiles enable row level security;
alter table sessions enable row level security;
alter table invitations enable row level security;
alter table attempts enable row level security;
alter table answers enable row level security;
alter table certificates enable row level security;
alter table assignments enable row level security;
alter table orders enable row level security;

create policy companies_read on companies for select using (id = current_company());
create policy profiles_read on profiles for select using (company_id = current_company());

create policy sessions_all on sessions for all using (company_id = current_company()) with check (company_id = current_company());
create policy invitations_all on invitations for all
  using (session_id in (select id from sessions where company_id = current_company()))
  with check (session_id in (select id from sessions where company_id = current_company()));
create policy attempts_read on attempts for select
  using (session_id in (select id from sessions where company_id = current_company()));
create policy answers_read on answers for select
  using (attempt_id in (select id from attempts where session_id in (select id from sessions where company_id = current_company())));
create policy certificates_read on certificates for select
  using (attempt_id in (select id from attempts where session_id in (select id from sessions where company_id = current_company())));
create policy assignments_all on assignments for all
  using (session_id in (select id from sessions where company_id = current_company()))
  with check (session_id in (select id from sessions where company_id = current_company()));
create policy orders_read on orders for select using (company_id = current_company());
-- Pas d'écriture directe des tentatives / attestations / commandes par les clients : uniquement via les fonctions ci-dessous.

-- ---------------------------------------------------------------- Fonctions RH
-- Création d'entreprise + profil RH juste après l'inscription Auth.
create or replace function rpc_create_company(p_company text, p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'Non authentifié'; end if;
  insert into companies (name) values (p_company) returning id into cid;
  insert into profiles (id, company_id, full_name) values (auth.uid(), cid, p_name);
  return cid;
end $$;

-- Commande de Pass : crée session + Pass (invitations) + commande.
-- EN PRODUCTION : ne l'appeler qu'après confirmation du paiement par l'agrégateur (webhook, service_role) ;
-- la retirer alors aux clients (revoke) et la faire appeler par une fonction serveur.
-- En mode démo (paiement simulé), on la laisse exécutable par les utilisateurs authentifiés.
create or replace function rpc_create_order(p_type text, p_title text, p_profile text, p_profile_name text, p_level text, p_unit int, p_questions int,
                                            p_pass int, p_deadline timestamptz, p_people jsonb, p_method text, p_ref text, p_demo boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid := current_company(); sid uuid; oid uuid; n int := jsonb_array_length(p_people); k int;
begin
  if cid is null then raise exception 'Non autorisé'; end if;
  insert into sessions (company_id, type, title, profile_id, level, question_count, pass_mark, deadline)
    values (cid, p_type, p_title, p_profile, p_level, p_questions, p_pass, p_deadline) returning id into sid;
  select count(*) + 1 into k from orders where company_id = cid;
  insert into orders (number, company_id, session_id, session_title, profile_id, profile_name, level, unit_price, qty, total, method, ref, demo)
    values ('MRS-' || to_char(now(), 'YYYY') || '-' || lpad(k::text, 4, '0'), cid, sid, p_title, p_profile, p_profile_name, p_level, p_unit, n, p_unit * n, p_method, p_ref, p_demo)
    returning id into oid;
  insert into invitations (session_id, name, email, order_id, price)
    select sid, coalesce(x->>'name', ''), coalesce(x->>'email', ''), oid, p_unit from jsonb_array_elements(p_people) x;
  return jsonb_build_object('session_id', sid, 'order_id', oid);
end $$;

create or replace function rpc_add_passes(p_session uuid, p_people jsonb, p_unit int, p_profile_name text, p_method text, p_ref text, p_demo boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid := current_company(); s sessions; oid uuid; n int := jsonb_array_length(p_people); k int;
begin
  select * into s from sessions where id = p_session and company_id = cid;
  if not found then raise exception 'Non autorisé'; end if;
  select count(*) + 1 into k from orders where company_id = cid;
  insert into orders (number, company_id, session_id, session_title, profile_id, profile_name, level, unit_price, qty, total, method, ref, demo)
    values ('MRS-' || to_char(now(), 'YYYY') || '-' || lpad(k::text, 4, '0'), cid, s.id, s.title, s.profile_id, p_profile_name, s.level, p_unit, n, p_unit * n, p_method, p_ref, p_demo)
    returning id into oid;
  insert into invitations (session_id, name, email, order_id, price)
    select s.id, coalesce(x->>'name', ''), coalesce(x->>'email', ''), oid, p_unit from jsonb_array_elements(p_people) x;
  return oid;
end $$;

create or replace function rpc_touch_invitation(p_token text) returns void
language sql security definer set search_path = public as $$
  update invitations set training_at = coalesce(training_at, now()) where token = p_token
$$;
grant execute on function rpc_touch_invitation(text) to anon, authenticated;

-- ---------------------------------------------------------------- Fonctions candidat (sans compte)
create or replace function rpc_get_invitation(p_token text) returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'invitation', jsonb_build_object('id', i.id, 'token', i.token, 'name', i.name, 'email', i.email, 'sessionId', i.session_id),
    'session', jsonb_build_object('id', s.id, 'type', s.type, 'title', s.title, 'profileId', s.profile_id, 'questionCount', s.question_count, 'passMark', s.pass_mark, 'deadline', s.deadline),
    'company', jsonb_build_object('name', c.name),
    'attempts', coalesce((select jsonb_agg(to_jsonb(a) order by a.started_at) from attempts a where a.invitation_id = i.id), '[]'::jsonb))
  from invitations i join sessions s on s.id = i.session_id join companies c on c.id = s.company_id
  where i.token = p_token
$$;
grant execute on function rpc_get_invitation(text) to anon, authenticated;

-- Enregistre (upsert) une tentative. p_token : lien RH (facultatif pour un examen libre).
create or replace function rpc_save_attempt(p_token text, p_attempt jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare inv invitations; sess sessions; aid text := p_attempt->>'id';
begin
  if p_token is not null then
    select * into inv from invitations where token = p_token;
    if not found then raise exception 'Lien invalide'; end if;
    select * into sess from sessions where id = inv.session_id;
  end if;
  insert into attempts (id, invitation_id, session_id, device_id, profile_id, profile_name, candidate_name, candidate_email, status, pass_mark, total,
                        correct, percent, passed, duration_ms, themes, state, cert_code, started_at, finished_at)
  values (aid, inv.id, sess.id, p_attempt->>'deviceId', p_attempt->>'profileId', p_attempt->>'profileName',
          p_attempt#>>'{candidate,name}', p_attempt#>>'{candidate,email}', p_attempt->>'status', (p_attempt->>'passMark')::int, (p_attempt->>'total')::int,
          (p_attempt->>'correct')::int, (p_attempt->>'percent')::int, (p_attempt->>'passed')::boolean, (p_attempt->>'durationMs')::int,
          p_attempt->'themes', p_attempt->'state', p_attempt->>'certCode',
          to_timestamp((p_attempt->>'startedAt')::double precision / 1000), to_timestamp(nullif(p_attempt->>'finishedAt', '')::double precision / 1000))
  on conflict (id) do update set status = excluded.status, correct = excluded.correct, percent = excluded.percent, passed = excluded.passed,
    duration_ms = excluded.duration_ms, themes = excluded.themes, state = excluded.state, cert_code = excluded.cert_code, finished_at = excluded.finished_at
  where attempts.device_id is not distinct from excluded.device_id;
end $$;
grant execute on function rpc_save_attempt(text, jsonb) to anon, authenticated;

create or replace function rpc_get_attempt(p_id text, p_device text) returns jsonb
language sql security definer set search_path = public as $$
  select to_jsonb(a) from attempts a where a.id = p_id
$$;
grant execute on function rpc_get_attempt(text, text) to anon, authenticated;

create or replace function rpc_list_device_attempts(p_device text) returns setof attempts
language sql security definer set search_path = public as $$
  select * from attempts where device_id = p_device order by started_at desc
$$;
grant execute on function rpc_list_device_attempts(text) to anon, authenticated;

-- Émet l'attestation d'une tentative réussie (idempotent).
create or replace function rpc_issue_certificate(p_attempt text, p_code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare a attempts; c certificates;
begin
  select * into a from attempts where id = p_attempt and status = 'done' and passed;
  if not found then raise exception 'Tentative non réussie'; end if;
  select * into c from certificates where attempt_id = p_attempt;
  if not found then
    insert into certificates (code, attempt_id, holder_name, holder_email, profile_id, profile_name, percent, pass_mark)
    values (p_code, a.id, a.candidate_name, a.candidate_email, a.profile_id, a.profile_name, a.percent, a.pass_mark) returning * into c;
  end if;
  return to_jsonb(c);
end $$;
grant execute on function rpc_issue_certificate(text, text) to anon, authenticated;

-- Vérification publique d'une attestation.
create or replace function verify_certificate(p_code text) returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_build_object('code', code, 'name', holder_name, 'profileId', profile_id, 'profileName', profile_name,
                            'percent', percent, 'passMark', pass_mark, 'date', issued_at)
  from certificates where code = upper(p_code)
$$;
grant execute on function verify_certificate(text) to anon, authenticated;

-- Parcours collaborateur : assignations et marquage « fait » (identifiés par le token du lien).
create or replace function rpc_my_assignments(p_token text) returns setof assignments
language sql security definer set search_path = public as $$
  select a.* from assignments a join invitations i on i.id = a.invitation_id where i.token = p_token
$$;
grant execute on function rpc_my_assignments(text) to anon, authenticated;

create or replace function rpc_complete_assignments(p_token text, p_profile text, p_module text, p_theme text) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update assignments a set done_at = now()
  from invitations i
  where i.id = a.invitation_id and i.token = p_token and a.done_at is null and a.profile_id = p_profile
    and ((p_module is not null and a.kind = 'module' and a.module_id = p_module) or (p_theme is not null and a.kind = 'practice' and a.theme = p_theme));
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function rpc_complete_assignments(text, text, text, text) to anon, authenticated;
