---
title: "MySQL EXPLAIN 완전 해석 — TRADITIONAL · JSON · TREE · ANALYZE"
description: "MySQL EXPLAIN의 모든 포맷(TRADITIONAL, JSON, TREE, ANALYZE)과 핵심 컬럼(type, key, rows, filtered, Extra)을 실전 예시로 해석하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 31
type: "knowledge"
category: "SQL"
tags: ["mysql", "explain", "explain-analyze", "query-optimization", "실행계획", "옵티마이저", "쿼리튜닝"]
featured: false
draft: false
---

[지난 글](/posts/mysql-fulltext-index/)에서 InnoDB FULLTEXT 인덱스로 전문 검색을 구현하는 방법을 살펴봤습니다. 이번 글에서는 MySQL 쿼리 튜닝의 시작점인 **EXPLAIN** 명령을 네 가지 포맷과 핵심 컬럼을 중심으로 완전하게 해석합니다.

## EXPLAIN이란

`EXPLAIN`은 MySQL 옵티마이저가 선택한 **실행 계획(Execution Plan)**을 사람이 읽을 수 있는 형태로 출력하는 명령입니다. 실행 계획에는 어떤 인덱스를 사용하는지, 몇 건을 스캔하는지, 조인 순서는 어떻게 되는지가 담겨 있습니다.

```sql
-- 기본 사용법
EXPLAIN SELECT * FROM orders WHERE status = 'paid';

-- UPDATE/DELETE/INSERT도 가능 (8.0.19+)
EXPLAIN DELETE FROM logs WHERE created_at < '2024-01-01';
```

쿼리 앞에 `EXPLAIN`을 붙이면 실제 쿼리는 **실행하지 않고** 계획만 반환합니다. 단, `EXPLAIN ANALYZE`는 예외로 실제로 실행합니다.

## 네 가지 포맷

MySQL 8.0에서는 출력 포맷을 선택할 수 있습니다.

```sql
-- TRADITIONAL (기본): 테이블 형태
EXPLAIN SELECT ...;

-- JSON: 비용 정보 포함, 프로그래밍 처리에 적합
EXPLAIN FORMAT=JSON SELECT ...;

-- TREE: 실행 트리 구조 (8.0.16+)
EXPLAIN FORMAT=TREE SELECT ...;

-- ANALYZE: 실제 실행 + 시간 측정 (8.0.18+)
EXPLAIN ANALYZE SELECT ...;
```

![EXPLAIN 포맷 비교](/assets/posts/mysql-explain-formats-analyze.svg)

**EXPLAIN ANALYZE**는 쿼리를 실제로 실행하면서 각 단계의 소요 시간과 실제 처리 행 수를 측정합니다. 옵티마이저의 **예상(estimated) vs 실제(actual)** 값을 비교할 수 있어 가장 강력한 튜닝 도구입니다. 단, 실제 실행이므로 DML 쿼리에 사용하면 데이터가 변경됩니다.

## type 컬럼 — 가장 중요한 컬럼

`type`은 테이블에 대한 **접근 방식**을 나타냅니다. 성능에 직접적인 영향을 미치므로 가장 먼저 확인해야 합니다.

```sql
-- type 별 예시 쿼리
-- const: PK/UNIQUE 단일 값 조회
SELECT * FROM users WHERE id = 1;          -- type: const

-- eq_ref: 조인에서 PK 룩업
SELECT * FROM o JOIN c ON o.cust_id = c.id; -- type: eq_ref

-- ref: Non-unique 인덱스
SELECT * FROM orders WHERE status = 'paid'; -- type: ref (status에 인덱스 있을 때)

-- range: 범위 조건
SELECT * FROM orders WHERE id BETWEEN 100 AND 200; -- type: range

-- ALL: 풀 테이블 스캔 (인덱스 없을 때)
SELECT * FROM orders WHERE memo LIKE '%결제%'; -- type: ALL
```

![EXPLAIN 컬럼 해석](/assets/posts/mysql-explain-formats-columns.svg)

`const`와 `eq_ref`는 최적의 상태, `ALL`은 개선이 필요한 상태입니다. `range`까지는 일반적으로 허용되지만 스캔 범위가 넓으면 문제가 될 수 있습니다.

## rows · filtered — 예상 처리량 계산

`rows`는 옵티마이저가 스캔할 것으로 예상하는 행 수입니다. `filtered`는 WHERE 조건을 적용한 후 남을 행의 **비율(%)**입니다.

```sql
-- rows=10000, filtered=10.00 이면
-- 실제 다음 단계로 전달되는 행 수 = 10,000 × 0.10 = 1,000건
```

`filtered`가 낮다면 인덱스의 선택성이 좋지 않거나 WHERE 조건이 인덱스를 활용하지 못한다는 신호입니다. 이 경우 복합 인덱스 추가나 조건 개선이 필요합니다.

## Extra 컬럼 — 핵심 키워드 해석

`Extra`는 실행 계획에 대한 추가 정보를 담습니다.

| Extra 값 | 의미 | 대응 |
|---|---|---|
| `Using index` | 커버링 인덱스 적용 | 최적 상태, 유지 |
| `Using index condition` | ICP 적용, 스토리지 엔진 필터링 | 양호 |
| `Using where` | Server 레이어 WHERE 필터 | 인덱스 커버리지 검토 |
| `Using filesort` | 인덱스 외부 정렬 | ORDER BY 칼럼 인덱스 추가 |
| `Using temporary` | 임시 테이블 생성 | 가장 주의, GROUP BY/ORDER BY 검토 |
| `Using MRR` | Multi-Range Read 최적화 | 양호 |

```sql
-- Using temporary가 나타나는 전형적인 패턴
SELECT status, COUNT(*)
FROM orders
GROUP BY status     -- Using temporary 가능성
ORDER BY COUNT(*);  -- + Using filesort 가능성
```

`Using temporary`가 보이면 쿼리 재작성이나 인덱스 추가를 우선적으로 검토합니다.

## JSON 포맷으로 비용 확인

TRADITIONAL 포맷은 비용 정보를 보여주지 않습니다. 두 쿼리를 비교하거나 옵티마이저가 어떤 계획이 저렴하다고 판단했는지 알려면 JSON 포맷이 필요합니다.

```sql
EXPLAIN FORMAT=JSON
SELECT * FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.status = 'paid'\G

-- 주요 확인 포인트
-- "query_cost": 전체 쿼리 비용 (낮을수록 좋음)
-- "read_cost": 디스크 읽기 비용
-- "eval_cost": 조건 평가 비용
-- "used_key_parts": 실제 사용된 인덱스 컬럼
```

## EXPLAIN ANALYZE 실전 활용

예상 rows와 실제 rows가 크게 다르면 통계가 오래됐거나 잘못된 것입니다.

```sql
EXPLAIN ANALYZE
SELECT * FROM orders o
JOIN customers c ON o.customer_id = c.id
WHERE o.amount > 10000;

-- 출력 예시
-- -> Nested loop inner join  (cost=1240 rows=320)
--                            (actual time=0.8..45.2 rows=8 loops=1)
-- 예상 320건 vs 실제 8건 → 통계 갱신 필요
```

예상 행수(rows=320)와 실제 행수(rows=8)의 차이가 크면 `ANALYZE TABLE orders;`로 통계를 갱신하고 다시 확인합니다.

## 실습 워크플로

실제 튜닝 작업의 흐름은 다음과 같습니다.

```sql
-- 1단계: 빠른 개요 파악
EXPLAIN SELECT ...;

-- 2단계: type=ALL 또는 Extra에 문제 있으면 상세 분석
EXPLAIN FORMAT=JSON SELECT ...\G

-- 3단계: 예상치 vs 실제 차이 확인
EXPLAIN ANALYZE SELECT ...;

-- 4단계: 통계 불일치 시
ANALYZE TABLE target_table;
-- 그 후 다시 EXPLAIN ANALYZE
```

EXPLAIN 결과를 해석하는 능력은 MySQL 튜닝의 핵심 역량입니다. `type`과 `Extra`를 먼저 확인하고, 행수 예측 오차가 크면 `EXPLAIN ANALYZE`로 실측값을 비교하는 습관을 들이세요.

---

**지난 글:** [MySQL FULLTEXT 인덱스 — 전문 검색 구현과 한계](/posts/mysql-fulltext-index/)

**다음 글:** [MySQL 옵티마이저 힌트 — 실행 계획 직접 제어하기](/posts/mysql-optimizer-hints/)

<br>
읽어주셔서 감사합니다. 😊
