-- Šeptanda cloud v1. Run once in the Supabase SQL editor or `supabase db push`.
-- Separate private tables; no existing auth users, passwords or legacy Blobs are changed.
begin;

create table if not exists public.septanda_consent_policy (
  singleton boolean primary key default true check (singleton),
  version text not null,
  text text not null
);
insert into public.septanda_consent_policy(singleton,version,text) values
  (true,'2026-10-16-v1','Chci e-mailem dostávat novinky o Šeptandě, nových hrách a tematických vydáních. Souhlas mohu kdykoli odvolat v nastavení účtu.')
  on conflict (singleton) do nothing;

create table if not exists public.septanda_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 24),
  email text,
  email_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.septanda_progress (
  user_id uuid primary key references public.septanda_profiles(user_id) on delete cascade,
  state jsonb,
  revision bigint not null default 0 check (revision >= 0),
  stats jsonb not null default '{"solved":0,"spent":0,"attempts":0,"revealed":0,"points":100}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint state_is_v6 check (state is null or (jsonb_typeof(state)='object' and state->>'version'='6'))
);
create table if not exists public.septanda_marketing_consents (
  user_id uuid primary key references public.septanda_profiles(user_id) on delete cascade,
  granted boolean not null default false,
  version text not null,
  text text not null,
  granted_at timestamptz,
  withdrawn_at timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists public.septanda_consent_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.septanda_profiles(user_id) on delete cascade,
  granted boolean not null,
  version text not null,
  text text not null,
  recorded_at timestamptz not null default now(),
  source text not null check (source in ('registration','account','backfill'))
);
create index if not exists septanda_consent_events_user_time on public.septanda_consent_events(user_id,recorded_at);
create table if not exists public.septanda_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);
create table if not exists public.septanda_daily_scores (
  user_id uuid not null references public.septanda_profiles(user_id) on delete cascade,
  date date not null,
  points integer not null,
  solved smallint not null check (solved between 0 and 5),
  completed smallint not null check (completed between 0 and 5),
  attempts integer not null check (attempts >= 0),
  spent integer not null check (spent >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id,date)
);
create index if not exists septanda_daily_scores_date_points on public.septanda_daily_scores(date,points desc,user_id);

-- Every exposed table has RLS AND explicit least-privilege grants. No browser can write scores or roles.
alter table public.septanda_consent_policy enable row level security;
alter table public.septanda_profiles enable row level security;
alter table public.septanda_progress enable row level security;
alter table public.septanda_marketing_consents enable row level security;
alter table public.septanda_consent_events enable row level security;
alter table public.septanda_admins enable row level security;
alter table public.septanda_daily_scores enable row level security;
revoke all on public.septanda_consent_policy,public.septanda_profiles,public.septanda_progress,
  public.septanda_marketing_consents,public.septanda_consent_events,public.septanda_admins,public.septanda_daily_scores from anon,authenticated;
grant select on public.septanda_profiles,public.septanda_progress,public.septanda_marketing_consents,
  public.septanda_consent_events,public.septanda_admins,public.septanda_daily_scores to authenticated;
grant all on public.septanda_consent_policy,public.septanda_profiles,public.septanda_progress,
  public.septanda_marketing_consents,public.septanda_consent_events,public.septanda_admins,public.septanda_daily_scores to service_role;
revoke all on sequence public.septanda_consent_events_id_seq from anon,authenticated;
grant usage,select on sequence public.septanda_consent_events_id_seq to service_role;

create policy septanda_own_profile on public.septanda_profiles for select to authenticated using ((select auth.uid())=user_id);
create policy septanda_own_progress on public.septanda_progress for select to authenticated using ((select auth.uid())=user_id);
create policy septanda_own_consent on public.septanda_marketing_consents for select to authenticated using ((select auth.uid())=user_id);
create policy septanda_own_consent_events on public.septanda_consent_events for select to authenticated using ((select auth.uid())=user_id);
create policy septanda_own_admin_membership on public.septanda_admins for select to authenticated using ((select auth.uid())=user_id);
create policy septanda_own_score on public.septanda_daily_scores for select to authenticated using ((select auth.uid())=user_id);

-- Signup stores consent evidence BEFORE e-mail confirmation redirects. Unverified e-mail is never marketable.
-- User-controlled metadata is used only as an explicit opt-in signal, never for permissions or canonical consent text.
create or replace function public.septanda_auth_user_created()
returns trigger language plpgsql security definer set search_path='' as $$
declare
  policy public.septanda_consent_policy%rowtype;
  opted_in boolean;
  nickname text;
begin
  select * into strict policy from public.septanda_consent_policy where singleton=true;
  nickname:=left(trim(coalesce(new.raw_user_meta_data->>'display_name','Hráč')),24);
  if char_length(nickname)<2 then nickname:='Hráč'; end if;
  opted_in:=coalesce(new.raw_user_meta_data->>'marketing_opt_in','false')='true'
    and coalesce(new.raw_user_meta_data->>'marketing_consent_version','')=policy.version;
  insert into public.septanda_profiles(user_id,display_name,email,email_confirmed_at,created_at)
    values(new.id,nickname,new.email,new.email_confirmed_at,coalesce(new.created_at,now()));
  insert into public.septanda_progress(user_id) values(new.id);
  insert into public.septanda_marketing_consents(user_id,granted,version,text,granted_at)
    values(new.id,opted_in,policy.version,policy.text,case when opted_in then now() else null end);
  insert into public.septanda_consent_events(user_id,granted,version,text,source)
    values(new.id,opted_in,policy.version,policy.text,'registration');
  return new;
end $$;
revoke all on function public.septanda_auth_user_created() from public,anon,authenticated;
create trigger septanda_on_auth_user_created after insert on auth.users for each row execute procedure public.septanda_auth_user_created();

create or replace function public.septanda_auth_email_updated()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.septanda_profiles set email=new.email,email_confirmed_at=new.email_confirmed_at,updated_at=now() where user_id=new.id;
  return new;
end $$;
revoke all on function public.septanda_auth_email_updated() from public,anon,authenticated;
create trigger septanda_on_auth_email_updated after update of email,email_confirmed_at on auth.users for each row execute procedure public.septanda_auth_email_updated();

-- Existing Supabase users get a private profile and an explicit NO, never inferred marketing consent.
insert into public.septanda_profiles(user_id,display_name,email,email_confirmed_at,created_at)
  select id,case when char_length(trim(coalesce(raw_user_meta_data->>'display_name','')))>=2 then left(trim(raw_user_meta_data->>'display_name'),24) else 'Hráč' end,
    email,email_confirmed_at,coalesce(created_at,now()) from auth.users on conflict(user_id) do nothing;
insert into public.septanda_progress(user_id) select user_id from public.septanda_profiles on conflict(user_id) do nothing;
insert into public.septanda_marketing_consents(user_id,granted,version,text)
  select p.user_id,false,c.version,c.text from public.septanda_profiles p cross join public.septanda_consent_policy c on conflict(user_id) do nothing;

-- A Netlify server re-evaluates every answer using the shared scorer, then commits the whole canonical result.
-- The revision comparison plus row lock makes state AND leaderboard updates one atomic operation.
create or replace function public.septanda_commit_progress(p_user uuid,p_expected_revision bigint,p_state jsonb,p_stats jsonb,p_scores jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_revision bigint; entry jsonb; next_revision bigint;
begin
  select revision into current_revision from public.septanda_progress where user_id=p_user for update;
  if not found then raise exception 'profile_missing'; end if;
  if current_revision<>p_expected_revision then return jsonb_build_object('saved',false,'revision',current_revision); end if;
  if p_state->>'version' is distinct from '6' or jsonb_typeof(p_state) is distinct from 'object' or jsonb_typeof(p_scores) is distinct from 'array' then raise exception 'invalid_state'; end if;
  next_revision:=current_revision+1;
  update public.septanda_progress set state=p_state,stats=p_stats,revision=next_revision,updated_at=now() where user_id=p_user;
  for entry in select * from jsonb_array_elements(p_scores) loop
    insert into public.septanda_daily_scores(user_id,date,points,solved,completed,attempts,spent)
      values(p_user,(entry->>'date')::date,(entry->>'points')::integer,(entry->>'solved')::smallint,(entry->>'completed')::smallint,(entry->>'attempts')::integer,(entry->>'spent')::integer)
      on conflict(user_id,date) do update set points=excluded.points,solved=excluded.solved,completed=excluded.completed,
        attempts=excluded.attempts,spent=excluded.spent,updated_at=now();
  end loop;
  return jsonb_build_object('saved',true,'revision',next_revision);
end $$;
revoke all on function public.septanda_commit_progress(uuid,bigint,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.septanda_commit_progress(uuid,bigint,jsonb,jsonb,jsonb) to service_role;

-- Only server code can call this. It reads current policy itself and records an immutable audit event.
create or replace function public.septanda_set_consent(p_user uuid,p_granted boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare previous public.septanda_marketing_consents%rowtype; policy public.septanda_consent_policy%rowtype;
begin
  select * into strict policy from public.septanda_consent_policy where singleton=true;
  select * into strict previous from public.septanda_marketing_consents where user_id=p_user for update;
  if previous.granted=p_granted and (not p_granted or previous.version=policy.version) then return to_jsonb(previous); end if;
  update public.septanda_marketing_consents set granted=p_granted,
    version=case when p_granted then policy.version else previous.version end,
    text=case when p_granted then policy.text else previous.text end,
    granted_at=case when p_granted then now() else previous.granted_at end,
    withdrawn_at=case when p_granted then null else now() end,updated_at=now() where user_id=p_user returning * into previous;
  insert into public.septanda_consent_events(user_id,granted,version,text,source)
    values(p_user,p_granted,previous.version,previous.text,'account');
  return to_jsonb(previous);
end $$;
revoke all on function public.septanda_set_consent(uuid,boolean) from public,anon,authenticated;
grant execute on function public.septanda_set_consent(uuid,boolean) to service_role;

-- Filter and paginate in SQL, never load an entire e-mail database into a public response.
create or replace function public.septanda_admin_list(p_marketing boolean default false,p_limit integer default 50,p_offset integer default 0)
returns jsonb language sql security definer set search_path='' as $$
  with matching as (
    select p.user_id as id,p.display_name as name,p.email,p.email_confirmed_at,p.created_at,s.stats,
      c.granted,c.version,c.text,c.granted_at,c.withdrawn_at,c.updated_at
    from public.septanda_profiles p
    join public.septanda_marketing_consents c on c.user_id=p.user_id
    join public.septanda_progress s on s.user_id=p.user_id
    where not p_marketing or (c.granted and p.email_confirmed_at is not null and p.email is not null)
  ), page as (select * from matching order by created_at desc,id limit least(greatest(p_limit,1),100) offset greatest(p_offset,0))
  select jsonb_build_object('users',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),'total',(select count(*) from matching));
$$;
revoke all on function public.septanda_admin_list(boolean,integer,integer) from public,anon,authenticated;
grant execute on function public.septanda_admin_list(boolean,integer,integer) to service_role;

-- Explicit, safe leaderboard projection. No raw state, email or marketing table is returned.
create or replace function public.septanda_public_leaderboard(p_date date,p_me uuid default null)
returns jsonb language sql security definer set search_path='' as $$
  with ranked as (
    select rank() over(order by s.points desc) as rank,s.user_id as id,p.display_name as name,s.points,s.solved,s.completed,s.attempts
    from public.septanda_daily_scores s join public.septanda_profiles p on p.user_id=s.user_id where s.date=p_date
  ), page as (select * from ranked order by rank,name,id limit 100)
  select jsonb_build_object('entries',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),
    'me',(select to_jsonb(ranked) from ranked where id=p_me),'total',(select count(*) from ranked));
$$;
revoke all on function public.septanda_public_leaderboard(date,uuid) from public,anon,authenticated;
grant execute on function public.septanda_public_leaderboard(date,uuid) to service_role;

commit;
