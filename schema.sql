-- 설계 예시 전용. 비어 있는 새 교육용 Supabase DB에 한 번만 적용하는 기본 SQL입니다.
-- 기존 DB/테이블에는 이 파일을 실행하지 마세요. 기존 데이터는 지우거나 덮어쓰지 않습니다.
-- 실행하지 않았습니다.
-- UUID id, user_id, created_at, 제약 및 RLS는 DB 연결을 위한 추가 설계입니다.
-- 원본에서 확인한 값: month, department, target, actual.
-- 한 행은 한 사용자의 한 달·한 부서 KPI이며 금액 단위는 원, 안전한 정수입니다.

create table public.kpi_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null,
  department text not null check (length(trim(department)) > 0),
  target bigint not null check (target between 0 and 1000000000000),
  actual bigint not null check (actual between 0 and 1000000000000),
  created_at timestamptz not null default now(),
  constraint kpi_records_month_first_day check (extract(day from month) = 1),
  constraint kpi_records_user_month_department_unique unique (user_id, month, department)
);

alter table public.kpi_records enable row level security;

-- API object privileges are separate from row policies. No anon access is granted.
-- INSERT with ON CONFLICT also requires UPDATE; RLS still limits rows to auth.uid().
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.kpi_records to authenticated;

create policy "Users can read their own KPI records"
  on public.kpi_records for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own KPI records"
  on public.kpi_records for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own KPI records"
  on public.kpi_records for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own KPI records"
  on public.kpi_records for delete to authenticated
  using (auth.uid() = user_id);
