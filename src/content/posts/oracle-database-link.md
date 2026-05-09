---
title: "Database Link"
description: "Oracle Database Link의 구조, Private·Public 차이, 분산 쿼리와 분산 트랜잭션(2PC) 동작 방식, 시노님을 활용한 투명한 접근 패턴까지 실무 관점에서 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["oracle", "database-link", "distributed-query", "2pc", "two-phase-commit", "synonym", "sqlnet", "distributed-transaction"]
featured: false
draft: false
---

[지난 글](/posts/oracle-materialized-view-query-rewrite/)에서 Materialized View로 집계 쿼리를 사전 계산하는 방법을 다뤘다. 이번에는 완전히 다른 Oracle 인스턴스에 있는 데이터를 마치 로컬 테이블처럼 접근하게 해주는 **Database Link**를 살펴본다.

## Database Link란

Database Link(이하 DB Link)는 한 Oracle DB에서 다른 Oracle DB(또는 Oracle 게이트웨이를 통한 이기종 DB)의 객체에 접근하기 위한 연결 정보 객체다. `@link_name` 문법으로 원격 테이블, 뷰, 시퀀스, 프로시저 등에 투명하게 접근할 수 있다.

![Oracle Database Link 아키텍처](/assets/posts/oracle-database-link-arch.svg)

## Private vs Public DB Link

DB Link는 생성 범위에 따라 Private과 Public으로 나뉜다.

```sql
-- Private: 생성한 사용자만 사용 가능
CREATE DATABASE LINK branch_db
  CONNECT TO app_user IDENTIFIED BY "s3cur3pw"
  USING '10.0.0.5:1521/branchdb';

-- 링크 테스트
SELECT SYSDATE FROM dual@branch_db;

-- Public: 데이터베이스의 모든 사용자 사용 가능 (DBA 권한 필요)
CREATE PUBLIC DATABASE LINK branch_public_db
  USING 'branch_tns_alias';
```

Public DB Link에 `CONNECT TO` 절이 없으면, 접속 시 현재 세션의 사용자명과 동일한 계정으로 원격 DB에 접속을 시도한다. 이를 **Current User DB Link**라고 한다.

USING 절에는 tnsnames.ora의 별칭(TNS alias) 또는 EZConnect 형식(`host:port/service_name`)을 쓸 수 있다.

## 기본 사용 문법

![Database Link 생성 & 분산 쿼리](/assets/posts/oracle-database-link-query.svg)

```sql
-- 원격 테이블 조회
SELECT sale_id, cust_id, amount
FROM   branch_sales@branch_db
WHERE  sale_dt >= TRUNC(SYSDATE, 'MM');

-- 로컬 + 원격 조인
SELECT e.emp_name,
       e.dept_id,
       s.sale_dt,
       s.amount
FROM   hq_employees          e
JOIN   branch_sales@branch_db s ON e.emp_id = s.emp_id
WHERE  s.sale_dt >= DATE '2024-01-01';

-- 원격 테이블 INSERT
INSERT INTO log_archive@branch_db (log_id, log_dt, msg)
  SELECT log_id, log_dt, msg
  FROM   local_log
  WHERE  log_dt < TRUNC(SYSDATE) - 90;

COMMIT;
```

DML(INSERT/UPDATE/DELETE)도 DB Link를 통해 실행할 수 있다. 단, DDL은 직접 불가능하며 `EXECUTE IMMEDIATE`를 PL/SQL에서 동적으로 실행해야 한다.

## 시노님으로 @link 숨기기

코드에 `@branch_db`를 직접 쓰면 나중에 링크 이름이 바뀔 때 모든 SQL을 수정해야 한다. **시노님(SYNONYM)**으로 추상화하면 이 의존성을 제거할 수 있다.

```sql
-- 시노님 생성
CREATE SYNONYM branch_sales FOR branch_sales@branch_db;
CREATE SYNONYM branch_inventory FOR branch_inventory@branch_db;

-- 이후 쿼리에서 @link 불필요
SELECT * FROM branch_sales WHERE sale_dt > SYSDATE - 30;

-- 링크 변경 시 시노님만 재생성
DROP SYNONYM branch_sales;
CREATE SYNONYM branch_sales FOR branch_sales@new_branch_db;
```

## 분산 트랜잭션과 2PC

로컬과 원격 DB 양쪽에 DML이 있는 경우, Oracle은 **Two-Phase Commit(2PC)**으로 원자성을 보장한다.

```sql
BEGIN
  -- 로컬 DB 차감
  UPDATE hq_accounts
  SET    balance = balance - 1000
  WHERE  acct_id = 101;

  -- 원격 DB 입금
  UPDATE savings_accts@branch_db
  SET    balance = balance + 1000
  WHERE  acct_id = 202;

  COMMIT;  -- Oracle이 2PC로 양쪽 커밋 조율
END;
/
```

2PC는 Prepare 단계(양쪽 커밋 준비 확인)와 Commit 단계(양쪽 실제 커밋)로 이루어진다. 네트워크 장애로 Commit 단계에서 실패하면 `DBA_2PC_PENDING` 뷰에 미해결 트랜잭션이 남는다. 이 경우 DBA가 수동으로 `COMMIT FORCE` 또는 `ROLLBACK FORCE`로 해결해야 한다.

```sql
-- 미해결 분산 트랜잭션 확인
SELECT local_tran_id, global_tran_id, state
FROM   dba_2pc_pending;

-- 강제 커밋/롤백
COMMIT FORCE 'local_tran_id';
ROLLBACK FORCE 'local_tran_id';
```

## DB Link 관리

```sql
-- 현재 세션의 DB Link 목록
SELECT db_link, username, host
FROM   user_db_links;

-- 전체 DB Link (DBA)
SELECT owner, db_link, username, host
FROM   dba_db_links;

-- DB Link 삭제
DROP DATABASE LINK branch_db;
DROP PUBLIC DATABASE LINK branch_public_db;

-- 현재 열린 DB Link 세션 확인
SELECT * FROM v$dblink;
```

열린 DB Link 세션은 명시적으로 닫거나 로컬 트랜잭션이 끝날 때 닫힌다. 세션이 너무 오래 열려 있으면 원격 DB의 리소스를 잡아먹으므로 주의한다.

## 분산 쿼리 성능 고려사항

DB Link를 통한 분산 쿼리는 네트워크 왕복 시간이 추가된다. 성능을 위한 핵심 원칙:

**1. 원격 필터링 우선**: 조건을 원격 DB에서 먼저 처리하게 한다.

```sql
-- 좋음: 원격 DB에서 필터 후 소량 전송
SELECT *
FROM   (SELECT * FROM branch_sales@branch_db
        WHERE  sale_dt > SYSDATE - 7) b
JOIN   local_products p ON b.prod_id = p.prod_id;

-- 나쁨: 전체 전송 후 로컬 필터
SELECT *
FROM   branch_sales@branch_db b  -- 수백만 행 전송
JOIN   local_products p ON b.prod_id = p.prod_id
WHERE  b.sale_dt > SYSDATE - 7;
```

**2. DRIVING_SITE 힌트**: 조인을 원격 DB에서 실행하게 강제한다.

```sql
SELECT /*+ DRIVING_SITE(b) */
       b.sale_id, p.prod_name
FROM   branch_sales@branch_db b
JOIN   local_products          p ON b.prod_id = p.prod_id;
```

**3. 루프 안 DB Link 금지**: 매 반복마다 원격 접속이 발생하므로 성능이 극도로 나빠진다. BULK COLLECT로 배치 처리하거나 조인으로 대체한다.

## 이기종 DB 연결 (Heterogeneous Services)

Oracle은 Oracle 게이트웨이를 통해 MySQL, SQL Server, PostgreSQL 등 이기종 DB에도 DB Link로 접속할 수 있다. Oracle Database Gateway 제품을 설치해야 하며, 기능 제약이 있다(일부 SQL 구문, 트랜잭션 격리 수준 등).

## 정리

- DB Link = 원격 DB 접속 정보 저장 객체, `@link_name`으로 투명 접근
- Private/Public/Current User 세 가지 종류
- 시노님으로 `@link_name` 의존성을 코드에서 제거
- DML 가능, 2PC로 분산 트랜잭션 원자성 보장
- 성능: 원격 필터링 우선, DRIVING_SITE 힌트, 루프 안 DB Link 금지

---

**지난 글:** [Materialized View와 Query Rewrite](/posts/oracle-materialized-view-query-rewrite/)

**다음 글:** [Advanced Queuing (AQ)](/posts/oracle-advanced-queueing/)

<br>
읽어주셔서 감사합니다. 😊
