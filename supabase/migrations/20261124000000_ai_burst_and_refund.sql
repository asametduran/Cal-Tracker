-- analyze-meal hardening: per-minute burst limit and daily-quota refunds.
--
-- consume_ai_quota (boolean) is replaced by consume_ai_scan, which also enforces a per-minute burst
-- limit and says which limit was hit. refund_ai_scan gives a daily scan back when the AI provider fails.
-- Both are callable by the service role only (the Edge Function). Dropping the old function means an
-- older deployed function fails closed (500) instead of bypassing the new limits.

-- ---------------------------------------------------------------------------
-- ai_burst: scans per user per minute. No client policies, no client grants.
-- ---------------------------------------------------------------------------
create table public.ai_burst (
  user_id uuid not null references auth.users (id) on delete cascade,
  bucket timestamptz not null,
  count integer not null default 0,
  primary key (user_id, bucket)
);

alter table public.ai_burst enable row level security;
revoke all on table public.ai_burst from anon, authenticated;

drop function if exists public.consume_ai_quota(uuid, integer);

-- ---------------------------------------------------------------------------
-- consume_ai_scan: count one scan. Returns 'ok', 'daily' (daily limit reached) or 'burst' (too fast).
-- A scan refused for bursting does not use up a daily scan.
-- ---------------------------------------------------------------------------
create function public.consume_ai_scan(p_user uuid, p_daily_limit integer, p_burst_limit integer default 6)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := ((now() at time zone 'utc')::date);
  this_minute timestamptz := date_trunc('minute', now());
  daily_used integer;
  burst_used integer;
begin
  insert into public.ai_usage as u (user_id, day, count)
  values (p_user, today, 1)
  on conflict (user_id, day) do update set count = u.count + 1 where u.count < p_daily_limit
  returning u.count into daily_used;
  if daily_used is null then
    return 'daily';
  end if;

  -- Housekeeping: old minute buckets are of no use.
  delete from public.ai_burst where user_id = p_user and bucket < now() - interval '1 hour';

  insert into public.ai_burst as b (user_id, bucket, count)
  values (p_user, this_minute, 1)
  on conflict (user_id, bucket) do update set count = b.count + 1 where b.count < p_burst_limit
  returning b.count into burst_used;
  if burst_used is null then
    update public.ai_usage set count = greatest(count - 1, 0) where user_id = p_user and day = today;
    return 'burst';
  end if;

  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------
-- refund_ai_scan: give back one daily scan (the AI provider failed, so the user got nothing).
-- The burst counter is left alone so failures cannot be used to hammer the provider.
-- ---------------------------------------------------------------------------
create function public.refund_ai_scan(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.ai_usage
  set count = greatest(count - 1, 0)
  where user_id = p_user and day = ((now() at time zone 'utc')::date);
end;
$$;

revoke all on function public.consume_ai_scan(uuid, integer, integer) from public, anon, authenticated;
revoke all on function public.refund_ai_scan(uuid) from public, anon, authenticated;
grant execute on function public.consume_ai_scan(uuid, integer, integer) to service_role;
grant execute on function public.refund_ai_scan(uuid) to service_role;
