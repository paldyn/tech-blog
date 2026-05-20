---
title: "MariaDB System-Versioned Tables — 시간 여행 쿼리 완전 가이드"
description: "MariaDB 10.3+ System-Versioned Tables의 내부 구조, FOR SYSTEM_TIME 쿼리 문법, 파티셔닝으로 이력 관리, 애플리케이션 패턴과 주의사항을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["MariaDB", "SystemVersioning", "시간여행쿼리", "이력관리", "감사로그", "TEMPORAL"]
featured: false
draft: false
---

[지난 글](/posts/mariadb-maxscale/)에서 MaxScale의 쿼리 라우팅과 Failover 기능을 살펴봤다. 이번 글에서는 MariaDB 10.3에 도입된 **System-Versioned Tables**을 다룬다. 이 기능을 사용하면 행의 변경 이력이 DB 수준에서 자동으로 보존되어, 특정 시점의 데이터를 SQL 한 줄로 조회할 수 있다.

## System-Versioned Tables란

System-Versioned Tables는 SQL:2011 표준에 정의된 **시간적 테이블(Temporal Table)** 기능의 구현이다. 테이블에 `WITH SYSTEM VERSIONING`을 붙이면 MariaDB가 각 행의 시작 시각(`row_start`)과 끝 시각(`row_end`)을 자동 관리한다.

- **UPDATE**: 기존 행의 `row_end`를 현재 시각으로 갱신 후 새 행 삽입
- **DELETE**: 기존 행의 `row_end`를 현재 시각으로 갱신 (물리 삭제 아님)
- **SELECT** 기본: `row_end = MAXVALUE`인 행만 반환 (현재 데이터)

![System-Versioned Table 구조](/assets/posts/mariadb-system-versioning-table.svg)

## 테이블 생성

```sql
-- 기본 생성
CREATE TABLE employees (
    id     INT          NOT NULL PRIMARY KEY,
    name   VARCHAR(100) NOT NULL,
    dept   VARCHAR(50),
    salary DECIMAL(12,2)
) WITH SYSTEM VERSIONING;

-- 기존 테이블에 적용
ALTER TABLE orders ADD SYSTEM VERSIONING;

-- row_start/row_end 컬럼을 명시적으로 정의 (파티셔닝 필요 시)
CREATE TABLE employees (
    id          INT NOT NULL PRIMARY KEY,
    name        VARCHAR(100),
    salary      DECIMAL(12,2),
    row_start   TIMESTAMP(6) GENERATED ALWAYS AS ROW START,
    row_end     TIMESTAMP(6) GENERATED ALWAYS AS ROW END,
    PERIOD FOR SYSTEM_TIME(row_start, row_end)
) WITH SYSTEM VERSIONING;
```

## FOR SYSTEM_TIME 쿼리

MariaDB는 SQL:2011 표준 문법을 지원한다.

```sql
-- 1. AS OF: 특정 시점 스냅샷
SELECT * FROM employees
FOR SYSTEM_TIME AS OF '2025-09-01 12:00:00';

-- 2. BETWEEN: 기간 내 유효했던 모든 버전 (시작·끝 포함)
SELECT id, name, salary, row_start, row_end
FROM employees
FOR SYSTEM_TIME BETWEEN '2024-01-01' AND '2025-12-31';

-- 3. FROM...TO: 기간 내 유효했던 버전 (끝 시각 미포함)
SELECT * FROM employees
FOR SYSTEM_TIME FROM '2024-01-01' TO '2025-01-01';

-- 4. ALL: 현재 + 이력 전체
SELECT *, row_start, row_end
FROM employees
FOR SYSTEM_TIME ALL
ORDER BY id, row_start;
```

![시간 여행 쿼리 유형](/assets/posts/mariadb-system-versioning-query.svg)

## 이력 파티셔닝

행 이력이 계속 쌓이면 테이블이 커진다. 파티셔닝으로 오래된 이력을 별도 파티션에 저장하면 보관·삭제가 편리해진다.

```sql
CREATE TABLE orders (
    id         INT NOT NULL PRIMARY KEY,
    customer   VARCHAR(100),
    total      DECIMAL(12,2),
    row_start  TIMESTAMP(6) GENERATED ALWAYS AS ROW START,
    row_end    TIMESTAMP(6) GENERATED ALWAYS AS ROW END,
    PERIOD FOR SYSTEM_TIME(row_start, row_end)
) WITH SYSTEM VERSIONING
PARTITION BY SYSTEM_TIME (
    PARTITION p_hist   HISTORY,   -- 이력 데이터
    PARTITION p_cur    CURRENT    -- 현재 데이터
);

-- 이력이 많아지면 파티션 추가 (월별 분리)
ALTER TABLE orders PARTITION BY SYSTEM_TIME
    INTERVAL 1 MONTH
    STARTS '2024-01-01'
    PARTITIONS 24;

-- 오래된 이력 삭제 (6개월 이전)
DELETE HISTORY FROM orders
BEFORE SYSTEM_TIME (NOW() - INTERVAL 6 MONTH);
```

## 이력 제외 컬럼

모든 컬럼의 변경을 이력에 저장하면 불필요한 행이 많아진다. `WITHOUT SYSTEM VERSIONING` 옵션으로 특정 컬럼 변경을 이력에서 제외할 수 있다.

```sql
CREATE TABLE sessions (
    id          INT NOT NULL PRIMARY KEY,
    user_id     INT NOT NULL,
    last_seen   TIMESTAMP WITHOUT SYSTEM VERSIONING,  -- 이력 제외
    ip_address  VARCHAR(45)  -- 이력 포함
) WITH SYSTEM VERSIONING;
```

`last_seen` 컬럼은 업데이트해도 새 이력 행이 생성되지 않아 빈번한 heartbeat 업데이트에도 이력이 폭증하지 않는다.

## 실전 패턴: 감사 로그 대체

별도 audit 테이블 없이 System Versioning만으로 모든 변경 이력을 추적할 수 있다.

```sql
-- 급여 변경 이력 조회
SELECT
    name,
    salary,
    row_start AS changed_at,
    LEAD(salary) OVER (PARTITION BY id ORDER BY row_start) AS new_salary
FROM employees
FOR SYSTEM_TIME ALL
WHERE id = 1
ORDER BY row_start;

-- 특정 시점 이후 변경된 모든 직원 조회
SELECT DISTINCT id, name
FROM employees
FOR SYSTEM_TIME FROM '2026-01-01' TO NOW()
WHERE salary != (
    SELECT salary FROM employees
    FOR SYSTEM_TIME AS OF '2026-01-01'
    WHERE id = e.id
);
```

## 주의사항

System-Versioned Tables를 운영할 때 알아야 할 제약 사항이다.

| 항목 | 제약 |
|---|---|
| **Galera Cluster** | Galera와 함께 사용하면 `row_start` 시각이 노드마다 다를 수 있음 (TrxID 기반 버저닝 권장) |
| **외래키** | System-Versioned 테이블에 대한 외래키 참조 시 이력 행도 제약 대상이 됨 |
| **BLOB/TEXT** | 대용량 컬럼 변경 시 이력 데이터 크기가 급증 — 이력 제외 옵션 활용 |
| **INSERT IGNORE** | 이력 테이블에 직접 INSERT 불가 (시스템 관리 컬럼) |
| **성능** | DELETE가 실제 삭제가 아닌 UPDATE로 처리됨 — 주기적 `DELETE HISTORY` 필요 |

```sql
-- Galera 환경: TrxID 기반 버저닝 (시각 대신 트랜잭션 ID 사용)
CREATE TABLE orders (
    id  INT NOT NULL PRIMARY KEY,
    amt DECIMAL(12,2)
) WITH SYSTEM VERSIONING
  TRANSACTION_BASED;

-- 테이블의 System Versioning 제거
ALTER TABLE employees REMOVE SYSTEM VERSIONING;
```

System-Versioned Tables는 별도 audit 테이블, 트리거, 애플리케이션 코드 없이 DB 수준에서 완전한 변경 이력을 관리할 수 있는 강력한 기능이다. 다음 글부터는 SQL Server(MSSQL)로 넘어가 SQLOS의 구조를 살펴본다.

---

**지난 글:** [MariaDB MaxScale — 지능형 데이터베이스 프록시 완전 가이드](/posts/mariadb-maxscale/)

**다음 글:** [SQL Server SQLOS — 운영체제 추상화 계층](/posts/mssql-sqlos/)

<br>
읽어주셔서 감사합니다. 😊
