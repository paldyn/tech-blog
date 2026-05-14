---
title: "PostgreSQL FDW — Foreign Data Wrapper로 외부 데이터 연결"
description: "PostgreSQL FDW(Foreign Data Wrapper)의 아키텍처, FOREIGN DATA WRAPPER·FOREIGN SERVER·USER MAPPING·FOREIGN TABLE 설정 순서, postgres_fdw로 원격 PostgreSQL·MySQL·Oracle·CSV 파일 연결, IMPORT FOREIGN SCHEMA, 조건 푸시다운, 비동기 실행 옵션을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["postgresql", "fdw", "foreign-data-wrapper", "postgres-fdw", "mysql-fdw", "file-fdw", "import-foreign-schema", "pushdown", "remote-join"]
featured: false
draft: false
---

[지난 글](/posts/pg-fulltext-tsvector-tsquery/)에서 전문 검색을 위한 tsvector와 GIN 인덱스를 살펴봤다. 이번에는 PostgreSQL에서 외부 데이터 소스를 로컬 테이블처럼 쿼리할 수 있게 해주는 **FDW(Foreign Data Wrapper)**를 다룬다.

## FDW란

FDW는 SQL/MED(Management of External Data) 표준을 구현한 PostgreSQL의 확장 인터페이스다. 로컬 PostgreSQL에서 다른 PostgreSQL, MySQL, Oracle, CSV 파일, Redis, S3 등을 마치 로컬 테이블처럼 `SELECT`, `INSERT`, `UPDATE`, `DELETE`할 수 있게 한다.

## 구성 요소

![FDW 아키텍처](/assets/posts/pg-foreign-data-wrapper-architecture.svg)

| 구성 요소 | 역할 |
|-----------|------|
| `FOREIGN DATA WRAPPER` | 외부 데이터 소스 종류 (드라이버) |
| `SERVER` | 실제 연결 정보 (host, port, dbname) |
| `USER MAPPING` | 사용자별 인증 정보 |
| `FOREIGN TABLE` | 외부 테이블의 로컬 뷰 |

## postgres_fdw 설정

![postgres_fdw 설정 단계](/assets/posts/pg-foreign-data-wrapper-setup.svg)

```sql
-- 1. FDW 확장 설치
CREATE EXTENSION postgres_fdw;

-- 2. 원격 서버 정의
CREATE SERVER remote_pg
  FOREIGN DATA WRAPPER postgres_fdw
  OPTIONS (
    host 'db.example.com',
    port '5432',
    dbname 'sales'
  );

-- 3. 현재 사용자의 원격 자격증명
CREATE USER MAPPING FOR current_user
  SERVER remote_pg
  OPTIONS (user 'app_user', password 'secret');

-- 4. 개별 FOREIGN TABLE 직접 생성
CREATE FOREIGN TABLE remote_orders (
  id         BIGINT,
  amount     NUMERIC(10,2),
  created_at TIMESTAMP
)
SERVER remote_pg
OPTIONS (schema_name 'public', table_name 'orders');

-- 4-b. 또는 스키마 전체 자동 임포트 (권장)
CREATE SCHEMA remote_schema;
IMPORT FOREIGN SCHEMA public
  FROM SERVER remote_pg
  INTO remote_schema;
```

`IMPORT FOREIGN SCHEMA`를 사용하면 원격 스키마의 모든 테이블을 자동으로 FOREIGN TABLE로 생성한다. 원격 테이블이 많을 때 매우 편리하다.

## 사용 — 로컬 테이블처럼

```sql
-- 단순 조회
SELECT * FROM remote_schema.orders WHERE amount > 100;

-- 로컬 테이블과 조인
SELECT c.name, SUM(o.amount)
FROM local_customers c
JOIN remote_schema.orders o ON c.id = o.customer_id
GROUP BY c.name;

-- INSERT (원격 테이블에 쓰기)
INSERT INTO remote_schema.orders (amount, created_at)
VALUES (99.99, now());
```

## 조건 푸시다운 (Predicate Pushdown)

`postgres_fdw`는 `WHERE` 조건, `ORDER BY`, `LIMIT`을 원격 서버에 전달해 필터링 후 결과만 가져오는 **푸시다운**을 지원한다.

```sql
-- 이 쿼리는 WHERE를 원격에서 실행 (네트워크 트래픽 최소화)
EXPLAIN SELECT * FROM remote_schema.orders
WHERE customer_id = 42 AND amount > 1000;

-- 실행 계획에서 확인
-- Foreign Scan on remote_schema.orders
--   Filter: (pushed down to remote)
```

집계(`SUM`, `COUNT` 등)도 `fetch_size`와 `use_remote_estimate` 옵션을 켜면 원격 실행이 가능하다.

## postgres_fdw 주요 옵션

```sql
-- 서버 수준 옵션
ALTER SERVER remote_pg OPTIONS (
  fetch_size '10000',          -- 한 번에 가져오는 행 수 (기본 100)
  use_remote_estimate 'on',    -- 원격 통계로 로컬 플래너 보조
  async_capable 'on'           -- PG14+: 비동기 패치 (병렬 FDW)
);

-- 테이블 수준 옵션
ALTER FOREIGN TABLE remote_schema.orders OPTIONS (
  batch_size '1000'            -- INSERT 배치 크기
);
```

`fetch_size`를 너무 작게 두면 왕복이 많아지고, 너무 크면 메모리 부담이 생긴다. 보통 1000~10000이 적당하다.

## file_fdw — CSV 파일 읽기

```sql
CREATE EXTENSION file_fdw;

CREATE SERVER csv_files FOREIGN DATA WRAPPER file_fdw;

CREATE FOREIGN TABLE sales_csv (
  date     DATE,
  product  TEXT,
  amount   NUMERIC
)
SERVER csv_files
OPTIONS (
  filename '/var/lib/postgresql/sales_2026.csv',
  format 'csv',
  header 'true',
  delimiter ','
);

SELECT * FROM sales_csv WHERE date >= '2026-01-01';
```

파일 경로는 서버 파일시스템 기준이다. 슈퍼유저 또는 `pg_read_server_files` 권한이 필요하다.

## 주요 FDW 목록

| FDW | 대상 | 설치 |
|-----|------|------|
| `postgres_fdw` | PostgreSQL | 내장 |
| `file_fdw` | CSV/TSV 파일 | 내장 |
| `mysql_fdw` | MySQL/MariaDB | PGXN |
| `oracle_fdw` | Oracle DB | PGXN |
| `tds_fdw` | SQL Server/Sybase | PGXN |
| `mongo_fdw` | MongoDB | PGXN |
| `redis_fdw` | Redis | PGXN |
| `multicorn` | Python으로 커스텀 FDW | PGXN |

## 주의 사항

**트랜잭션 경계**: FDW 연산은 원격 서버의 트랜잭션과 분리된다. 로컬 트랜잭션을 롤백해도 이미 원격에서 커밋된 데이터는 되돌아오지 않는다. `postgres_fdw`는 2PC(2-Phase Commit)를 지원하지 않는다.

**성능**: 원격 조회는 네트워크 왕복 비용이 있다. 대량 데이터를 가져오는 것보다 원격에서 집계 후 결과만 받는 패턴이 효율적이다.

**보안**: `USER MAPPING`의 비밀번호는 `pg_user_mappings` 뷰에 암호화되지 않고 저장될 수 있다. 패스워드보다 SSL 인증서나 `.pgpass` 파일을 사용하는 것이 안전하다.

```sql
-- FDW 상태 확인
SELECT * FROM information_schema.foreign_servers;
SELECT * FROM information_schema.foreign_tables;

-- 연결 캐시 제거
SELECT postgres_fdw_disconnect('remote_pg');
SELECT postgres_fdw_disconnect_all();
```

---

**지난 글:** [PostgreSQL 전문 검색 — tsvector와 tsquery](/posts/pg-fulltext-tsvector-tsquery/)

**다음 글:** [PostgreSQL 선언적 파티셔닝 — RANGE·LIST·HASH](/posts/pg-declarative-partitioning/)

<br>
읽어주셔서 감사합니다. 😊
