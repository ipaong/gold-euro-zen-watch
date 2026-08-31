-- Gold Futures archive for Time Machine (~1 month of GC=F 15m).
-- Paste this whole file into Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to re-run. Does not touch market_candles / Gold API / XM tables.

create table if not exists public.market_archive (
  symbol text not null,
  timeframe text not null,
  t bigint not null,
  o double precision not null check (o > 0),
  h double precision not null check (h > 0),
  l double precision not null check (l > 0),
  c double precision not null check (c > 0),
  source text not null default 'yahoo-finance',
  updated_at timestamptz not null default now(),
  primary key (symbol, timeframe, t),
  constraint market_archive_ohlc check (
    h >= greatest(o, c) and l <= least(o, c)
  )
);

create index if not exists market_archive_lookup_idx
  on public.market_archive (symbol, timeframe, t);

alter table public.market_archive enable row level security;

revoke all on table public.market_archive from public, anon, authenticated;
grant all on table public.market_archive to service_role;

create or replace function public.ingest_yahoo_archive(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before int;
  v_after int;
  v_first bigint;
  v_last bigint;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'p_rows must be a json array';
  end if;

  select count(*) into v_before
  from public.market_archive
  where symbol = 'GC=F' and timeframe = '15m';

  insert into public.market_archive (symbol, timeframe, t, o, h, l, c, source)
  select
    'GC=F',
    '15m',
    (row->>'t')::bigint,
    (row->>'o')::double precision,
    (row->>'h')::double precision,
    (row->>'l')::double precision,
    (row->>'c')::double precision,
    coalesce(nullif(row->>'source', ''), 'yahoo-finance')
  from jsonb_array_elements(p_rows) as row
  where (row->>'t') is not null
  on conflict (symbol, timeframe, t) do update set
    o = excluded.o,
    h = excluded.h,
    l = excluded.l,
    c = excluded.c,
    source = excluded.source,
    updated_at = now();

  select count(*), min(t), max(t)
    into v_after, v_first, v_last
  from public.market_archive
  where symbol = 'GC=F' and timeframe = '15m';

  return jsonb_build_object(
    'appended', greatest(v_after - v_before, 0),
    'total', v_after,
    'first', v_first,
    'last', v_last
  );
end;
$$;

revoke all on function public.ingest_yahoo_archive(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_yahoo_archive(jsonb) to service_role;

create or replace function public.read_yahoo_archive()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('t', t, 'o', o, 'h', h, 'l', l, 'c', c)
      order by t asc
    ),
    '[]'::jsonb
  )
  from public.market_archive
  where symbol = 'GC=F' and timeframe = '15m';
$$;

revoke all on function public.read_yahoo_archive() from public, anon, authenticated;
grant execute on function public.read_yahoo_archive() to service_role;

do $$
begin
  raise notice 'market_archive พร้อมแล้ว — ไปสร้าง Edge Function ชื่อ yahoo-archive-collector ต่อ';
end $$;
