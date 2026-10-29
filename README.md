# KPI 성과 대시보드 실습앱

## 실행

폴더의 `index.html`을 브라우저에서 연다. 별도 프레임워크나 빌드는 없다. `config.js`가 유효한 Supabase URL과 공개 anon key를 포함하면 DB 로그인 화면이 표시된다. 설정이 없거나 자리표시자면 샘플 모드와 미연결 안내로 실행된다. 직접 파일로 열어도 샘플 데이터는 `core.js`에서 로드하며 `fetch`하지 않는다.

## 파일 역할

- `index.html`: 화면 구조, 상대 경로 스타일·스크립트 연결.
- `style.css`: 대시보드와 작은 화면 스타일.
- `core.js`: 샘플, 입력값 검사, 필터, 합계와 달성률 계산.
- `app.js`: 화면 동작, Supabase Auth/REST 요청, DB 응답·재조회 확인.
- `config.js`: 로컬 연결 설정. 이미 있는 파일을 유지한다. Git에 올리지 않는다.
- `config.example.js`: 실제 값이 없는 공개 설정 예시.
- `data/kpi.json`, `data/kpi.csv`: 가져오기·원본 비교용 사본. 앱이 자동으로 읽지 않는다.
- `schema.sql`: 비어 있는 새 교육용 DB의 기본 테이블과 RLS 설계.
- `schema-existing-db-review.sql`: 기존 테이블 구조와 정책을 확인하는 읽기 전용 SQL.
- `schema-existing-db-migration-template.sql`: 기존 데이터를 유지하면서 nullable 소유자/생성시각 컬럼을 추가하는 검토용 초안. 실행 전 실제 스키마·기존 행 소유자 매핑 검토가 필요하다.
- `prd.md`, `검증체크리스트.md`: 화면·요구사항 및 확인 항목.

## 샘플 모드와 DB 모드

샘플 모드에서 입력·삭제한 값은 현재 화면에만 반영되고 자동 저장되지 않는다. 새로고침하면 원래 샘플로 돌아간다. DB 모드에서는 이메일·비밀번호로 기존 Supabase Auth 사용자로 로그인한다. 이 앱은 사용자 계정을 만들지 않는다. 조회·저장·삭제 요청에 로그인한 사용자 ID 조건을 넣고, RLS 정책도 본인 행으로 제한한다. DB 저장은 응답 행을 확인하고 다시 조회한 값이 같은지 비교한 뒤 완료로 표시한다. 샘플 데이터는 DB로 보내지 않는다.

설정값이 있어도 최초 화면에서는 실제 서버 연결을 확인하지 않은 상태로 표시한다. 로그인 이후 DB 조회 성공 시 연결/본인 조회 확인 상태가 된다. 실제 행 저장을 해보지 않았다면 저장·재조회 검증까지 완료된 것은 아니다.

## SQL 적용 주의

`schema.sql`은 기존 DB에 실행하는 변경 스크립트가 아니다. **비어 있는 새 교육용 Supabase DB에 한 번만** 적용하는 기본 SQL이다. 실행하지 않았다. 기존 DB가 있으면 먼저 `schema-existing-db-review.sql` 결과와 기존 행의 소유자를 검토한다. migration template은 행을 특정 사용자에게 임의 귀속하지 않고 기존 행을 삭제하거나 덮어쓰지 않는다. 최종 변경 SQL은 실제 구조와 소유자 매핑 검토 후 별도로 확정해야 한다.

## 공개 저장소에 올릴 파일

`index.html`, `style.css`, `app.js`, `core.js`, `data/kpi.json`, `data/kpi.csv`, `prd.md`, `README.md`, `검증체크리스트.md`, `schema.sql`, `schema-existing-db-review.sql`, `schema-existing-db-migration-template.sql`, `config.example.js`를 올릴 수 있다. `config.js`는 `.gitignore` 대상이다. 브라우저에 공개되는 anon/publishable key만 사용하고 service-role key 등 비밀 키를 클라이언트 코드에 넣지 않는다.
