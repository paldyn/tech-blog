---
title: "MySQL 조인 알고리즘 — BNL · NLJ · Hash Join 완전 정리"
description: "MySQL이 조인을 처리하는 세 가지 알고리즘(Nested Loop Join, Block Nested Loop, Hash Join)의 작동 원리, 선택 조건, EXPLAIN으로 확인하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 34
type: "knowledge"
category: "SQL"
tags: ["mysql", "join-algorithms", "nested-loop-join", "hash-join", "bnl", "join-buffer", "explain", "조인알고리즘"]
featured: false
draft: false
---

[지난 글](/posts/mysql-statistics-information-schema/)에서 옵티마이저가 실행 계획을 결정하는 근거인 통계 정보를 살펴봤습니다. 이번 글에서는 옵티마이저가 실제로 조인을 수행하는 **세 가지 알고리즘**의 내부 동작과 선택 기준을 다룹니다.

## MySQL의 조인 알고리즘 세 가지

MySQL에서 사용되는 조인 알고리즘은 다음과 같습니다.

- **NLJ (Nested Loop Join)**: 인덱스가 있을 때 사용하는 기본 조인
- **BNL (Block Nested Loop)**: 8.0.20 이전, 인덱스 없을 때 join_buffer 활용
- **Hash Join**: 8.0.18 도입, BNL 대체. 인덱스 없는 대용량 조인에 유리

```sql
-- 현재 optimizer_switch에서 hash_join 확인
SHOW VARIABLES LIKE 'optimizer_switch'\G
-- hash_join=on (기본값, 8.0.18+)
```

## Nested Loop Join (NLJ)

NLJ는 드라이빙 테이블(outer)의 각 행에 대해 내부 테이블(inner)을 조인 키로 조회하는 방식입니다.

```sql
-- NLJ가 적용되는 전형적인 쿼리
SELECT c.name, o.amount
FROM customers c          -- 드라이빙 (작은 쪽)
JOIN orders o             -- inner (조인 키에 인덱스 있어야 함)
  ON o.customer_id = c.id;

-- EXPLAIN 확인
-- id=1 c: type=ALL (customers 전체 스캔)
-- id=1 o: type=ref, key=idx_customer_id (인덱스 룩업)
-- Extra: 없음 (= NLJ)
```

인덱스 없는 inner 테이블에 대해 NLJ를 수행하면 `O(N × M)` 복잡도로 성능이 급격히 저하됩니다.

## Block Nested Loop (BNL) — 레거시

인덱스가 없을 때 8.0.20 이전에 사용된 방식입니다. 드라이빙 테이블의 행을 `join_buffer`에 블록 단위로 적재하고, inner 테이블을 한 번 스캔하면서 버퍼 전체와 비교합니다.

```sql
-- 8.0.19 이전 EXPLAIN
-- Extra: Using join buffer (Block Nested Loop)

-- join_buffer_size 확인 및 설정
SHOW VARIABLES LIKE 'join_buffer_size';
SET SESSION join_buffer_size = 4194304; -- 4MB
```

버퍼가 클수록 inner 테이블 스캔 횟수가 줄어들어 성능이 향상됩니다.

## Hash Join (8.0.18+)

8.0.18에서 도입된 Hash Join은 8.0.20부터 BNL을 완전히 대체합니다.

![조인 알고리즘 비교](/assets/posts/mysql-join-algorithms-bnl-hash-compare.svg)

Hash Join은 두 단계로 동작합니다.

**Build Phase**: 두 테이블 중 작은 쪽으로 메모리 내 해시 맵을 만듭니다.

**Probe Phase**: 큰 테이블을 순서대로 읽으면서 해시 맵을 조회해 매칭 행을 찾습니다.

```sql
-- 인덱스 없는 조인 → Hash Join 자동 선택
EXPLAIN FORMAT=TREE
SELECT a.name, b.value
FROM table_a a
JOIN table_b b ON a.key_col = b.key_col;
-- -> Inner hash join (table_b.key_col = table_a.key_col)
--    -> Table scan on table_b
--    -> Hash
--       -> Table scan on table_a

-- TRADITIONAL 포맷에서 확인
-- Extra: Using join buffer (hash join)
```

## EXPLAIN으로 알고리즘 판별

![EXPLAIN 조인 알고리즘 확인](/assets/posts/mysql-join-algorithms-bnl-hash-code.svg)

| Extra 값 | 알고리즘 | 의미 |
|---|---|---|
| (없음) | NLJ | 인덱스 기반 Nested Loop |
| `Using join buffer (Block Nested Loop)` | BNL | 구버전, 인덱스 없음 |
| `Using join buffer (hash join)` | Hash Join | 8.0.20+, 인덱스 없음 |
| `Using join buffer (batched key access)` | BKA | MRR 최적화 NLJ |

## join_buffer_size 튜닝

Hash Join과 BNL 모두 `join_buffer_size`를 사용합니다.

```sql
-- 기본값 확인
SHOW VARIABLES LIKE 'join_buffer_size';
-- 기본: 262144 (256KB) — 대용량 조인에는 작을 수 있음

-- 세션 단위 임시 확대 (특정 쿼리에만)
SET SESSION join_buffer_size = 8388608; -- 8MB

-- 또는 힌트 사용 (다른 쿼리에 영향 없음)
SELECT /*+ SET_VAR(join_buffer_size=8388608) */
  a.name, b.value
FROM table_a a JOIN table_b b ON a.key_col = b.key_col;
```

`join_buffer`가 해시 맵 크기를 초과하면 온디스크 Hash Join으로 전환되어 성능이 저하됩니다. 대형 조인 쿼리가 많다면 `join_buffer_size`를 1~8MB로 설정하는 것이 좋습니다.

## 알고리즘 제어

인덱스가 있어도 Hash Join을 강제하거나, Hash Join을 금지할 수 있습니다.

```sql
-- Hash Join 강제 (인덱스가 있어도 적용)
SELECT /*+ HASH_JOIN(a, b) */
  a.name, b.value
FROM table_a a JOIN table_b b ON a.id = b.a_id;

-- Hash Join 금지 (NLJ 강제)
SELECT /*+ NO_HASH_JOIN(a, b) */
  a.name, b.value
FROM table_a a JOIN table_b b ON a.id = b.a_id;

-- 전역적으로 Hash Join 비활성화 (권장하지 않음)
SET optimizer_switch = 'hash_join=off';
```

## 실전 권장사항

OLTP 환경에서는 **모든 조인 키에 인덱스**를 유지해 NLJ가 동작하게 하는 것이 기본입니다.

```sql
-- 조인 키에 인덱스 없는 경우 확인
SELECT
  kcu.TABLE_NAME, kcu.COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
LEFT JOIN INFORMATION_SCHEMA.STATISTICS s
  ON kcu.TABLE_SCHEMA = s.TABLE_SCHEMA
  AND kcu.TABLE_NAME = s.TABLE_NAME
  AND kcu.COLUMN_NAME = s.COLUMN_NAME
WHERE kcu.TABLE_SCHEMA = 'mydb'
  AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
  AND s.INDEX_NAME IS NULL;
-- FK 컬럼에 인덱스 없는 것들 → 즉시 추가
```

분석용 대용량 조인이 자주 발생하면 `join_buffer_size`를 늘리거나, 해당 쿼리를 별도 읽기 전용 인스턴스로 분리하는 것을 검토합니다.

---

**지난 글:** [MySQL 통계 정보와 INFORMATION_SCHEMA — 옵티마이저의 눈](/posts/mysql-statistics-information-schema/)

**다음 글:** [MySQL Derived Table Merge — 파생 테이블 병합 최적화](/posts/mysql-derived-merge/)

<br>
읽어주셔서 감사합니다. 😊
