-- 기존 DB 변경 검토용 템플릿입니다. 자동 적용하지 마세요.
-- 기존 컬럼/행 소유자를 확인하기 전에는 실행할 수 없습니다.
-- 먼저 schema-existing-db-review.sql 결과와 데이터 소유자 매핑을 검토하세요.
-- 이 템플릿은 기존 행을 삭제하거나 덮어쓰지 않습니다.

-- 전제: public.kpi_records가 이미 있고 month, department, target, actual 컬럼이 존재해야 합니다.
-- 기존 행의 소유자를 확정할 때까지 user_id는 nullable로 추가합니다.
-- 필요 시 승인된 데이터 소유자 매핑표를 바탕으로 수동 backfill을 별도 검토합니다.
-- 기존 데이터를 특정 사용자에게 임의 할당하는 UPDATE는 포함하지 않습니다.

begin;

do $$
begin
  if to_regclass('public.kpi_records') is null then
    raise exception '기존 kpi_records 테이블이 없습니다. 빈 새 DB에만 schema.sql 적용을 검토하세요.';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'kpi_records' and column_name = 'month'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'kpi_records' and column_name = 'department'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'kpi_records' and column_name = 'target'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'kpi_records' and column_name = 'actual'
  ) then
    raise exception '기존 필수 컬럼이 다릅니다. 자동 변경을 중단합니다.';
  end if;
end $$;

alter table public.kpi_records
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists created_at timestamptz default now();

-- 의도적으로 RLS 활성화, NOT NULL, 정책, 유니크 제약은 여기서 적용하지 않습니다.
-- user_id가 NULL인 기존 행과 기존 중복 행을 검토하고 소유자 매핑을 확정한 다음,
-- 별도 검토된 후속 SQL로 제약과 RLS를 단계 적용해야 합니다.

commit;
