---
title: "PostgreSQL 확장 시스템 — CREATE EXTENSION과 주요 확장들"
description: "PostgreSQL 확장의 .control 파일·SQL 스크립트·공유 라이브러리 구성, CREATE EXTENSION 설치 흐름, pg_extension·pg_depend 카탈로그, ALTER EXTENSION UPDATE 버전 업그레이드, 성능·검색·타입·보안 분야 주요 확장 목록을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["postgresql", "extension", "create-extension", "pg-trgm", "pg-stat-statements", "pgcrypto", "hstore", "citext", "uuid-ossp", "tablefunc"]
featured: false
draft: false
---

[지난 글](/posts/pg-function-parameters-polymorphism/)에서 함수 파라미터의 다형성을 살펴봤다. 이번에는 PostgreSQL의 **확장(Extension) 시스템**을 다룬다. 확장은 PostGIS, pg_trgm처럼 별도로 개발된 기능을 하나의 단위로 패키징해 데이터베이스에 설치하는 메커니즘이다.

## 확장이란

PostgreSQL 확장은 함수, 데이터 타입, 연산자, 인덱스 접근 방법, 설정 파라미터 등을 하나의 묶음으로 만들어 단일 `CREATE EXTENSION` 명령으로 설치할 수 있게 한다.

확장의 장점:
- 단일 명령으로 설치·제거
- 버전 관리와 업그레이드 경로 지원
- `pg_depend`를 통한 의존성 추적

## 확장 구성 파일

![PostgreSQL 확장 시스템 구조](/assets/posts/pg-extension-system-architecture.svg)

확장은 세 가지 파일로 구성된다.

**1. 컨트롤 파일 (`myext.control`)**
```
default_version = '1.0'
module_pathname = '$libdir/myext'
relocatable = true
comment = 'My custom extension'
```

**2. SQL 스크립트 (`myext--1.0.sql`)**
```sql
-- 확장이 제공하는 오브젝트 정의
CREATE FUNCTION myext_hello() RETURNS TEXT LANGUAGE sql AS
  $$ SELECT 'hello from myext' $$;
```

**3. 업그레이드 스크립트 (`myext--1.0--1.1.sql`)** — 버전 간 변경 사항

C 함수를 포함하는 경우 공유 라이브러리(`.so`)도 필요하다. 파일들은 PostgreSQL의 `SHAREDIR/extension/`과 `libdir`에 배치된다.

## CREATE EXTENSION 사용법

```sql
-- 설치 (현재 search_path의 첫 번째 스키마에 생성)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 특정 스키마에 설치
CREATE EXTENSION pg_trgm SCHEMA myschema;

-- 설치된 확장 목록
SELECT extname, extversion, extnamespace::regnamespace AS schema
FROM pg_extension;

-- 특정 확장이 제공하는 오브젝트 목록
SELECT objid::regproc, classid::regclass, deptype
FROM pg_depend
WHERE refobjid = (SELECT oid FROM pg_extension WHERE extname = 'pg_trgm')
  AND classid = 'pg_proc'::regclass;
```

## 버전 업그레이드

```sql
-- 현재 버전 확인
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_trgm';

-- 업그레이드 (myext--1.0--1.1.sql 실행)
ALTER EXTENSION myext UPDATE TO '1.1';

-- 제거 (의존 오브젝트 포함)
DROP EXTENSION myext CASCADE;
```

`CASCADE`를 쓰면 해당 확장이 제공한 타입이나 함수에 의존하는 컬럼·인덱스·함수도 함께 삭제된다. 주의해서 사용해야 한다.

## 주요 확장 목록

![주요 PostgreSQL 확장](/assets/posts/pg-extension-system-popular.svg)

### 성능·진단

**pg_stat_statements** — 실행된 쿼리의 통계(총 실행 시간, 호출 횟수, I/O)를 수집한다. 슬로우 쿼리 분석의 시작점이다. `postgresql.conf`에 `shared_preload_libraries = 'pg_stat_statements'`를 추가해야 한다.

```sql
CREATE EXTENSION pg_stat_statements;
SELECT query, calls, total_exec_time, rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC LIMIT 10;
```

**auto_explain** — `log_min_duration` 이상의 쿼리에 대해 EXPLAIN 결과를 자동으로 서버 로그에 기록한다.

```sql
-- postgresql.conf에 추가
-- shared_preload_libraries = 'auto_explain'
-- auto_explain.log_min_duration = 1000  -- 1초 이상

LOAD 'auto_explain';  -- 세션 단위 로드
SET auto_explain.log_min_duration = 500;
```

### 인덱스·검색

**pg_trgm** — 문자열의 트라이그램(3-문자 조각) 유사도를 계산하고, `LIKE`·`ILIKE` 패턴 검색에 GIN/GiST 인덱스를 활용할 수 있게 한다.

```sql
CREATE EXTENSION pg_trgm;
CREATE INDEX idx_trgm ON products USING GIN (name gin_trgm_ops);

SELECT name, similarity(name, 'posgres')
FROM products
WHERE name % 'posgres'  -- 유사도 임계값 이상
ORDER BY similarity(name, 'posgres') DESC;
```

**unaccent** — `é` → `e`처럼 발음 기호(accent)를 제거한다. 전문 검색 사전으로 사용한다.

```sql
CREATE EXTENSION unaccent;
SELECT unaccent('café');  -- → cafe
```

### 데이터 타입

**citext** — 대소문자를 무시하는 TEXT 타입이다. `LOWER()` 함수 없이도 대소문자 무관 비교가 된다.

```sql
CREATE EXTENSION citext;
CREATE TABLE users (email citext UNIQUE);
INSERT INTO users VALUES ('User@Example.com');
SELECT * FROM users WHERE email = 'user@example.com';  -- 매칭됨
```

**uuid-ossp** — UUID v1~v4 생성 함수를 제공한다. PostgreSQL 13+에서는 `gen_random_uuid()`가 내장되어 있어 v4 UUID는 확장 없이 생성 가능하다.

```sql
CREATE EXTENSION "uuid-ossp";
SELECT uuid_generate_v4();
SELECT uuid_generate_v1();  -- 타임스탬프 기반
```

**tablefunc** — `crosstab()` 함수로 행을 열로 변환하는 피벗을 구현할 수 있다.

### 보안·암호화

**pgcrypto** — 해시(MD5, SHA-256), 대칭(AES), 비대칭(RSA) 암호화 함수를 제공한다.

```sql
CREATE EXTENSION pgcrypto;
-- bcrypt 해시 (패스워드 저장)
SELECT crypt('my_password', gen_salt('bf', 10));
-- AES 암호화
SELECT pgp_sym_encrypt('secret', 'passphrase');
```

## 확장 개발 시작하기

직접 확장을 만들려면 `PGXS`(PostgreSQL Extension Build Infrastructure)를 사용한다.

```makefile
# Makefile
EXTENSION = myext
DATA = myext--1.0.sql
REGRESS = myext_test

PG_CONFIG = pg_config
PGXS := $(shell $(PG_CONFIG) --pgxs)
include $(PGXS)
```

```bash
make && make install
psql -c "CREATE EXTENSION myext;"
```

확장은 단순한 SQL 함수 묶음부터 PostGIS처럼 수십만 줄의 C 코드까지 범위가 넓다. 팀 내에서 자주 쓰는 유틸리티 함수도 확장으로 패키징하면 여러 데이터베이스에 일관되게 배포할 수 있다.

---

**지난 글:** [PostgreSQL 함수 파라미터와 다형성 — ANYELEMENT, 오버로딩](/posts/pg-function-parameters-polymorphism/)

**다음 글:** [pg_stat_statements — 쿼리 통계로 슬로우 쿼리 잡기](/posts/pg-stat-statements/)

<br>
읽어주셔서 감사합니다. 😊
