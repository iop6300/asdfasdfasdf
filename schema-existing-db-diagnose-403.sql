-- 읽기 전용 진단. 실제 권한이나 정책은 변경하지 않습니다.
-- Supabase SQL Editor에서 현재 역할 기준으로 결과를 확인하세요.

select to_regclass('public.kpi_records') as table_found;

select
  has_schema_privilege('authenticated', 'public', 'USAGE') as authenticated_schema_usage,
  has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_select,
  has_table_privilege('authenticated', c.oid, 'INSERT') as authenticated_insert,
  has_table_privilege('authenticated', c.oid, 'UPDATE') as authenticated_update,
  has_table_privilege('authenticated', c.oid, 'DELETE') as authenticated_delete,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'kpi_records' and c.relkind in ('r', 'p');

select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'kpi_records'
order by policyname;
