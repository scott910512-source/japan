-- JS일본어 — 기기 간 학습 기록 동기화용 스키마
--
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run 하면 된다.
-- 여러 번 실행해도 안전하다(전부 if not exists / or replace).
--
-- 설계 메모
--  학습 기록은 지금 브라우저 localStorage에 통째로 들어 있다. 그 모양을 그대로
--  jsonb 컬럼으로 옮긴다. 카드 한 장을 한 행으로 쪼개면 단어 1,400개 + 문장 600개가
--  전부 행이 되어 관리가 커지는데, 이 앱이 필요한 건 "내 기기 두 대가 같은 진도를
--  보는 것"뿐이라 그 비용을 낼 이유가 없다.
--
--  대신 기기 간 충돌은 클라이언트에서 카드 단위로 합친다 —
--  같은 카드가 양쪽에 있으면 lastSeen이 늦은 쪽을 남긴다. 통째로 덮어쓰면
--  아이패드에서 한 공부가 아이폰 기록에 지워진다.

-- ─────────────────────────────────────────────
-- 1) 학습 데이터 (사용자당 한 행)
-- ─────────────────────────────────────────────
create table if not exists public.user_data (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  review       jsonb not null default '{}'::jsonb,   -- 회독 상태 { 카드id: {box, streak, lastSeen, ...} }
  progress     jsonb not null default '{}'::jsonb,   -- 북마크 · 문법/문장 진행
  settings     jsonb not null default '{}'::jsonb,   -- 앱 설정 (음성 키는 여기 넣지 않는다)
  stats        jsonb not null default '{}'::jsonb,   -- 일별 학습량
  custom_words jsonb not null default '[]'::jsonb,   -- 직접 추가한 단어
  streak       jsonb not null default '{}'::jsonb,   -- 연속 학습일
  updated_at   timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 2) 행 수준 보안 — 남의 학습 기록을 못 보게 한다
--    이게 꺼져 있으면 anon 키를 아는 누구나 전체 테이블을 읽는다. 반드시 켠 채로 둔다.
-- ─────────────────────────────────────────────
alter table public.user_data enable row level security;

drop policy if exists "본인 데이터만 조회" on public.user_data;
create policy "본인 데이터만 조회" on public.user_data
  for select using (auth.uid() = user_id);

drop policy if exists "본인 데이터만 생성" on public.user_data;
create policy "본인 데이터만 생성" on public.user_data
  for insert with check (auth.uid() = user_id);

drop policy if exists "본인 데이터만 수정" on public.user_data;
create policy "본인 데이터만 수정" on public.user_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "본인 데이터만 삭제" on public.user_data;
create policy "본인 데이터만 삭제" on public.user_data
  for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 3) updated_at 자동 갱신
--    어느 기기 기록이 최신인지 판단하는 기준이라 앱이 직접 넣게 두지 않는다.
-- ─────────────────────────────────────────────
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_data_touch on public.user_data;
create trigger user_data_touch
  before update on public.user_data
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────
-- 4) 가입하면 빈 행을 자동으로 만든다
--    앱이 첫 로그인에서 행이 없는 경우를 따로 처리하지 않아도 되게.
-- ─────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_data (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────
-- 5) 이미 가입한 계정이 있다면 빈 행을 채워 준다 (재실행해도 안전)
-- ─────────────────────────────────────────────
insert into public.user_data (user_id)
select id from auth.users
on conflict (user_id) do nothing;
