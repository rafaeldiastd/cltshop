-- Save na nuvem da Lojinha Lofi
-- Rode este arquivo inteiro no SQL Editor do Supabase (uma vez).
--
-- Regras:
--  * cada jogador (inclusive anônimo, que entra com o papel "authenticated") só enxerga o próprio save;
--  * ninguém grava direto na tabela: só pelas funções abaixo;
--  * o save só anda para frente (rev crescente) e só a sessão ativa grava (um aparelho/aba por vez).

create table if not exists public.saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  rev        bigint not null default 0,
  session_id uuid,
  game_day   int,
  data       jsonb,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

-- leitura: só a própria linha. Não há políticas de insert/update/delete: escrita só pelas funções.
drop policy if exists "saves: ler o proprio" on public.saves;
create policy "saves: ler o proprio" on public.saves
  for select to authenticated
  using ((select auth.uid()) = user_id);

revoke insert, update, delete on public.saves from anon, authenticated;

-- Assume a sessão (a aba/aparelho que abriu por último passa a ser a única que grava)
-- e devolve o save atual para o jogo comparar com o local.
create or replace function public.claim_session(p_session uuid)
returns table (rev bigint, data jsonb, game_day int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'sem login';
  end if;
  insert into public.saves as s (user_id, session_id)
  values (v_uid, p_session)
  on conflict (user_id) do update set session_id = excluded.session_id;
  return query select s.rev, s.data, s.game_day from public.saves s where s.user_id = v_uid;
end;
$$;

-- Grava o save. Respostas: 'ok', 'stale' (essa versão ou mais nova já está lá),
-- 'other_session' (o jogo foi aberto em outro lugar: esta aba deve parar).
create or replace function public.save_game(p_session uuid, p_rev bigint, p_day int, p_data jsonb)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session uuid;
begin
  if v_uid is null then
    raise exception 'sem login';
  end if;
  if pg_column_size(p_data) > 2000000 then
    raise exception 'save grande demais';
  end if;

  update public.saves
     set rev = p_rev, data = p_data, game_day = p_day, updated_at = now()
   where user_id = v_uid and session_id = p_session and rev < p_rev;
  if found then
    return 'ok';
  end if;

  select s.session_id into v_session from public.saves s where s.user_id = v_uid;
  if v_session is distinct from p_session then
    return 'other_session';
  end if;
  return 'stale';
end;
$$;

revoke all on function public.claim_session(uuid) from public, anon;
revoke all on function public.save_game(uuid, bigint, int, jsonb) from public, anon;
grant execute on function public.claim_session(uuid) to authenticated;
grant execute on function public.save_game(uuid, bigint, int, jsonb) to authenticated;
