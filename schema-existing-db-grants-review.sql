-- 기존 kpi_records에서 Data API 테이블 권한이 빠진 경우 검토할 최소 권한 SQL.
-- 실행하지 않았습니다. 먼저 schema-existing-db-diagnose-403.sql 결과를 확인하세요.
-- GRANT는 행 데이터를 변경하지 않으며 RLS 정책은 계속 적용됩니다.
-- 앱의 조회/삽입/upsert(충돌 시 UPDATE)/삭제에 authenticated 권한만 부여합니다.
-- anon 또는 service_role에는 권한을 추가하지 않습니다.

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.kpi_records to authenticated;
