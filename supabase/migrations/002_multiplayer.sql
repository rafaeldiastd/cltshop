-- Multiplayer Realtime + Diretório de Lojas da Lojinha Lofi
-- Rode este arquivo no SQL Editor do Supabase (depois do 001_saves.sql)
-- para habilitar visitas pelo código mesmo entre aparelhos diferentes e entrega de gorjetas.

create table if not exists public.store_directory (
  code             text primary key,
  user_id          uuid references auth.users (id) on delete cascade,
  store_name       text not null default 'Lojinha Lofi',
  region           text not null default 'residencial',
  level            int not null default 0,
  rep              numeric not null default 3,
  open_to_visitors boolean not null default true,
  snapshot         jsonb,
  tips_pending     numeric not null default 0,
  updated_at       timestamptz not null default now()
);

alter table public.store_directory add column if not exists rep numeric not null default 3;
alter table public.store_directory add column if not exists open_to_visitors boolean not null default true;
alter table public.store_directory add column if not exists snapshot jsonb;
alter table public.store_directory add column if not exists tips_pending numeric not null default 0;

alter table public.store_directory enable row level security;

drop policy if exists "directory: leitura publica" on public.store_directory;
create policy "directory: leitura publica" on public.store_directory
  for select to authenticated, anon
  using (true);

drop policy if exists "directory: dono gerencia" on public.store_directory;
create policy "directory: dono gerencia" on public.store_directory
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Envia gorjeta para uma loja aberta (acumulada para o dono resgatar)
create or replace function public.send_store_tip(p_code text, p_amount numeric)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'sem login';
  end if;
  if p_amount <= 0 or p_amount > 500 then
    raise exception 'valor invalido';
  end if;

  update public.store_directory
     set tips_pending = coalesce(tips_pending, 0) + p_amount
   where code = upper(trim(p_code)) and open_to_visitors = true;

  return found;
end;
$$;

-- Resgata e zera gorjetas pendentes da loja do usuario autenticado
create or replace function public.claim_store_tips(p_code text)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tips numeric := 0;
begin
  if v_uid is null then
    return 0;
  end if;

  with cur as (
    select code, coalesce(tips_pending, 0) as amt
      from public.store_directory
     where code = upper(trim(p_code)) and user_id = v_uid and coalesce(tips_pending, 0) > 0
     for update
  ), upd as (
    update public.store_directory d
       set tips_pending = 0
      from cur
     where d.code = cur.code
  )
  select amt into v_tips from cur;

  return coalesce(v_tips, 0);
end;
$$;

revoke all on function public.send_store_tip(text, numeric) from public, anon;
revoke all on function public.claim_store_tips(text) from public, anon;
grant execute on function public.send_store_tip(text, numeric) to authenticated;
grant execute on function public.claim_store_tips(text) to authenticated;
