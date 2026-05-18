---
title: "MySQL 옵티마이저 힌트 — 실행 계획 직접 제어하기"
description: "MySQL 8.0 옵티마이저 힌트(INDEX, JOIN_ORDER, HASH_JOIN, SEMIJOIN, MERGE, SET_VAR)의 종류와 작성법, 힌트를 쓸 때와 피해야 할 때를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 32
type: "knowledge"
category: "SQL"
tags: ["mysql", "optimizer-hints", "explain", "join-order", "index-hint", "set-var", "쿼리튜닝"]
featured: false
draft: false
---

[지난 글](/posts/mysql-explain-formats/)에서 EXPLAIN의 네 가지 포맷과 핵심 컬럼을 해석하는 방법을 살펴봤습니다. 이번 글에서는 옵티마이저가 선택한 실행 계획이 최선이 아닐 때 **힌트(Hint)**로 직접 제어하는 방법을 다룹니다.

## 힌트가 필요한 상황

MySQL 옵티마이저는 통계 정보를 기반으로 비용을 추정합니다. 하지만 통계가 오래됐거나, 데이터 분포가 편중됐거나, 쿼리 패턴이 특이한 경우에는 최선의 계획을 선택하지 못하기도 합니다.

```sql
-- 옵티마이저가 잘못된 인덱스를 선택하는 경우
EXPLAIN SELECT * FROM orders WHERE status = 'paid' AND amount > 10000;
-- type: ALL 또는 엉뚱한 인덱스 사용 → 힌트로 올바른 인덱스 지정
```

힌트를 쓰기 전에 반드시 `ANALYZE TABLE`로 통계를 갱신하고, 인덱스 추가나 쿼리 재작성을 먼저 시도해야 합니다. 힌트는 **최후 수단**입니다.

## 힌트 작성 위치

MySQL 8.0 옵티마이저 힌트는 `SELECT` 키워드 직후에 `/*+ ... */` 주석 형태로 작성합니다.

```sql
SELECT /*+ 힌트1 힌트2 */
  column1, column2
FROM table1
WHERE ...;
```

`#힌트` 형태나 `SELECT` 외 위치에 쓰면 무시됩니다. 힌트는 대·소문자를 구분하지 않지만 관례상 대문자로 작성합니다.

## 인덱스 힌트

특정 인덱스를 강제로 사용하거나 제외합니다.

```sql
-- 특정 인덱스 강제 사용
SELECT /*+ INDEX(o idx_status_amount) */
  o.id, o.amount
FROM orders o
WHERE o.status = 'paid' AND o.amount > 50000;

-- 특정 인덱스 사용 금지
SELECT /*+ NO_INDEX(o idx_created_at) */
  * FROM orders o
WHERE o.created_at > '2024-01-01';

-- 기본 키(PK) 강제
SELECT /*+ INDEX(o PRIMARY) */
  * FROM orders o WHERE o.id > 1000;
```

테이블 앨리어스와 인덱스 이름을 함께 지정합니다. 앨리어스가 없으면 테이블 이름을 사용합니다.

## 조인 순서 힌트

옵티마이저가 선택한 조인 순서를 재정의합니다.

```sql
-- customers를 드라이빙 테이블로 고정
SELECT /*+ JOIN_ORDER(c, o) */
  c.name, SUM(o.amount) total
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE c.tier = 'VIP'
GROUP BY c.name;
```

드라이빙 테이블의 결과 집합이 작을수록 Nested Loop Join 성능이 좋습니다. `JOIN_ORDER`는 두 테이블 이상 나열할 수 있으며, 나열하지 않은 테이블은 옵티마이저가 자유롭게 배치합니다.

## 조인 알고리즘 힌트

```sql
-- Hash Join 강제 (8.0.18+)
SELECT /*+ HASH_JOIN(o, c) */
  o.id, c.name
FROM orders o JOIN customers c ON o.customer_id = c.id
WHERE o.amount > 100000;

-- Hash Join 금지 (Nested Loop 강제)
SELECT /*+ NO_HASH_JOIN(o, c) */
  o.id, c.name
FROM orders o JOIN customers c ON o.customer_id = c.id;
```

Hash Join은 대용량 테이블 간 조인에서 Nested Loop보다 빠를 수 있지만, 메모리(`join_buffer_size`)를 많이 사용합니다.

## 서브쿼리 변환 힌트

```sql
-- IN 서브쿼리를 세미조인으로 변환 유도
SELECT /*+ SEMIJOIN(@subq) */
  * FROM orders o
WHERE o.customer_id IN (
  SELECT /*+ QB_NAME(subq) */ id
  FROM customers WHERE tier = 'VIP'
);

-- 세미조인 변환 금지 (Materialization 유지)
SELECT /*+ NO_SEMIJOIN(@subq MATERIALIZATION) */
  * FROM orders o
WHERE o.customer_id IN (
  SELECT /*+ QB_NAME(subq) */ id
  FROM customers WHERE tier = 'VIP'
);
```

`QB_NAME(이름)`으로 쿼리 블록에 이름을 붙이고 `@이름`으로 참조합니다.

## 파생 테이블 병합 힌트

![옵티마이저 힌트 분류](/assets/posts/mysql-optimizer-hints-types.svg)

```sql
-- 파생 테이블을 외부 쿼리에 병합 (기본 동작)
SELECT /*+ MERGE(sub) */
  sub.status, sub.cnt
FROM (
  SELECT status, COUNT(*) cnt
  FROM orders GROUP BY status
) sub
WHERE sub.cnt > 100;

-- 병합 금지 → 별도 임시 테이블로 Materialize
SELECT /*+ NO_MERGE(sub) */
  sub.status, sub.cnt
FROM (SELECT status, COUNT(*) cnt FROM orders GROUP BY status) sub
WHERE sub.cnt > 100;
```

`MERGE`는 파생 테이블을 제거해 조건을 외부로 밀어 넣을 수 있을 때 유리합니다. `NO_MERGE`는 파생 테이블 결과를 먼저 구체화해 외부 쿼리가 작은 집합을 받을 때 유리합니다.

## SET_VAR 힌트 — 세션 변수 임시 변경

![힌트 코드 비교](/assets/posts/mysql-optimizer-hints-code.svg)

```sql
-- 특정 쿼리에서만 sort_buffer_size 일시 확대
SELECT /*+ SET_VAR(sort_buffer_size=33554432) */
  *
FROM large_table
ORDER BY col1, col2, col3;
-- 쿼리 종료 후 원래 세션 값으로 자동 복원
```

`SET 세션변수 = 값`을 쿼리 전후에 실행하는 것과 동일하지만, 힌트 방식은 트랜잭션 내에서 세션 변수가 다른 쿼리에 영향을 주지 않아 더 안전합니다.

## 힌트를 피해야 할 때

힌트는 옵티마이저의 자율성을 제거하므로 스키마·데이터·MySQL 버전이 바뀌면 역효과가 날 수 있습니다.

```sql
-- 힌트 대신 시도할 것들
-- 1. 통계 갱신
ANALYZE TABLE orders;

-- 2. 인덱스 추가/변경
ALTER TABLE orders ADD INDEX idx_status_amount (status, amount);

-- 3. 쿼리 재작성
-- EXISTS 대신 IN, 또는 반대로 변환해 보기

-- 4. optimizer_switch 확인
SHOW VARIABLES LIKE 'optimizer_switch';
```

장기 유지가 필요한 힌트라면 **SQL Plan Management**(mysql-sql-plan-management)와 함께 사용하면 업그레이드 후에도 계획을 안정적으로 관리할 수 있습니다.

---

**지난 글:** [MySQL EXPLAIN 완전 해석 — TRADITIONAL · JSON · TREE · ANALYZE](/posts/mysql-explain-formats/)

**다음 글:** [MySQL 통계 정보와 INFORMATION_SCHEMA — 옵티마이저의 눈](/posts/mysql-statistics-information-schema/)

<br>
읽어주셔서 감사합니다. 😊
