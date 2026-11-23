-- Cal Tracker: initial schema.
--
-- Every table has Row Level Security ENABLED. Policies are scoped to the signed-in user via
-- auth.uid() and apply only to the `authenticated` role. There are no policies for `anon`, so a
-- signed-out request can read and write nothing. The table owner (postgres) bypasses RLS as usual,
-- which the sign-up trigger below relies on.

-- ---------------------------------------------------------------------------
-- Shared helper: keep updated_at fresh
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: onboarding answers and daily targets (one row per user)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  onboarded boolean not null default false,
  goal text check (goal in ('lose', 'maintain', 'gain', 'muscle')),
  sex text check (sex in ('male', 'female')),
  age smallint check (age between 13 and 100),
  height_cm numeric(5, 1) check (height_cm between 100 and 250),
  weight_kg numeric(5, 1) check (weight_kg between 30 and 300),
  activity text check (activity in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  target_calories integer check (target_calories between 0 and 20000),
  target_protein_g integer check (target_protein_g between 0 and 2000),
  target_carbs_g integer check (target_carbs_g between 0 and 5000),
  target_fat_g integer check (target_fat_g between 0 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- meals: one row per logged meal, with a small compressed thumbnail
-- ---------------------------------------------------------------------------
create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  calories numeric(7, 1) not null check (calories between 0 and 100000),
  protein_g numeric(6, 1) not null check (protein_g between 0 and 10000),
  carbs_g numeric(6, 1) not null check (carbs_g between 0 and 10000),
  fat_g numeric(6, 1) not null check (fat_g between 0 and 10000),
  day date not null,
  logged_at timestamptz not null,
  thumbnail text check (
    thumbnail is null
    or (char_length(thumbnail) <= 200000 and thumbnail like 'data:image/jpeg;base64,%')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meals_user_day_idx on public.meals (user_id, day, logged_at);

-- ---------------------------------------------------------------------------
-- weight_logs: weigh-ins
-- ---------------------------------------------------------------------------
create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  logged_at timestamptz not null,
  kg numeric(5, 1) not null check (kg > 0 and kg <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index weight_logs_user_day_idx on public.weight_logs (user_id, day, logged_at);

-- ---------------------------------------------------------------------------
-- meal_reminders: configurable reminder schedule (local notifications are scheduled on-device)
-- ---------------------------------------------------------------------------
create table public.meal_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  hour smallint not null check (hour between 0 and 23),
  minute smallint not null check (minute between 0 and 59),
  enabled boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meal_reminders_user_idx on public.meal_reminders (user_id, sort_order);

-- ---------------------------------------------------------------------------
-- ai_usage: per-user daily counter for the analyze-meal Edge Function.
-- No client policies at all; only the service role (via consume_ai_quota) touches it.
-- ---------------------------------------------------------------------------
create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default ((now() at time zone 'utc')::date),
  count integer not null default 0,
  primary key (user_id, day)
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger meals_set_updated_at before update on public.meals
  for each row execute function public.set_updated_at();
create trigger weight_logs_set_updated_at before update on public.weight_logs
  for each row execute function public.set_updated_at();
create trigger meal_reminders_set_updated_at before update on public.meal_reminders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.meals enable row level security;
alter table public.weight_logs enable row level security;
alter table public.meal_reminders enable row level security;
alter table public.ai_usage enable row level security;

-- profiles: own row only. No delete policy (the row goes away with the auth user).
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- meals
create policy "meals_select_own" on public.meals
  for select to authenticated using (user_id = (select auth.uid()));
create policy "meals_insert_own" on public.meals
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "meals_update_own" on public.meals
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "meals_delete_own" on public.meals
  for delete to authenticated using (user_id = (select auth.uid()));

-- weight_logs
create policy "weight_logs_select_own" on public.weight_logs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "weight_logs_insert_own" on public.weight_logs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "weight_logs_update_own" on public.weight_logs
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "weight_logs_delete_own" on public.weight_logs
  for delete to authenticated using (user_id = (select auth.uid()));

-- meal_reminders
create policy "meal_reminders_select_own" on public.meal_reminders
  for select to authenticated using (user_id = (select auth.uid()));
create policy "meal_reminders_insert_own" on public.meal_reminders
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "meal_reminders_update_own" on public.meal_reminders
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "meal_reminders_delete_own" on public.meal_reminders
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Privileges: belt and braces on top of RLS. anon gets nothing; authenticated only what it needs.
-- ---------------------------------------------------------------------------
revoke all on table public.profiles, public.meals, public.weight_logs, public.meal_reminders, public.ai_usage
  from anon, authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.meals, public.weight_logs, public.meal_reminders
  to authenticated;
-- ai_usage: no grants to client roles.

-- ---------------------------------------------------------------------------
-- New users: create their profile row and seed the default (disabled) reminders
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  insert into public.meal_reminders (user_id, name, hour, minute, enabled, sort_order) values
    (new.id, 'Breakfast', 8, 0, false, 0),
    (new.id, 'Lunch', 12, 30, false, 1),
    (new.id, 'Dinner', 18, 30, false, 2);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- consume_ai_quota: atomically count one analysis for a user, or refuse past the limit.
-- Callable only by the service role (the Edge Function).
-- ---------------------------------------------------------------------------
create or replace function public.consume_ai_quota(p_user uuid, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  used integer;
begin
  insert into public.ai_usage as u (user_id, day, count)
  values (p_user, ((now() at time zone 'utc')::date), 1)
  on conflict (user_id, day) do update set count = u.count + 1 where u.count < p_limit
  returning u.count into used;
  return used is not null;
end;
$$;

revoke all on function public.consume_ai_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid, integer) to service_role;
