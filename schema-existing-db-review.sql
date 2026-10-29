-- 기존 DB의 스키마 상태를 읽기만 하는 사전 검토 SQL입니다.
-- UPDATE/INSERT/DELETE/ALTER/CREATE/DROP 문은 포함하지 않습니다.

select table_schema, table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'kpi_records'
order by ordinal_position;

select tc.constraint_name, tc.constraint_type, kcu.column_name
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_catalog = kcu.constraint_catalog
 and tc.constraint_schema = kcu.constraint_schema
 and tc.constraint_name = kcu.constraint_name
where tc.table_schema = 'public' and tc.table_name = 'kpi_records'
order by tc.constraint_name, kcu.ordinal_position;

select policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'kpi_records'
order by policyname;

select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'kpi_records';
