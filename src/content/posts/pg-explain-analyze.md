---
title: "EXPLAIN ANALYZE 읽기 — 실행 계획 해석 완전 가이드"
description: "PostgreSQL EXPLAIN ANALYZE 출력에서 cost, actual time, rows, loops, Buffers를 읽는 방법, 추정과 실제의 차이로 통계 문제를 찾는 법, loops 함정, Bitmap vs Index vs Seq Scan 선택 기준, JSON 포맷과 시각화 도구 활용법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["postgresql", "explain", "explain-analyze", "query-plan", "cost", "buffers", "loops", "performance-tuning", "seq-scan", "index-scan"]
featured: false
draft: false
---

[지난 글](/posts/pg-index-only-scan/)에서 Index-Only Scan의 동작 원리와 성립 조건을 살펴봤다. 이번에는 PostgreSQL 쿼리 성능 튜닝의 핵심 도구인 **EXPLAIN ANALYZE**를 완전히 해석하는 방법을 다룬다. 출력 숫자들이 정확히 무엇을 뜻하는지 알아야 어디가 병목인지 판단할 수 있다.

## EXPLAIN vs EXPLAIN ANALYZE

`EXPLAIN`만 실행하면 옵티마이저의 **추정값**만 보여준다. 실제로 쿼리를 실행하지 않는다. `EXPLAIN ANALYZE`는 쿼리를 실제로 실행하고 **실제 시간과 행 수**를 함께 출력한다.

```sql
-- 추정만 (실행 없음)
EXPLAIN SELECT * FROM orders WHERE customer_id = 42;

-- 실제 실행 + 추정 비교
EXPLAIN ANALYZE SELECT * FROM orders WHERE customer_id = 42;

-- DML에 EXPLAIN ANALYZE 쓸 때는 반드시 롤백
BEGIN;
EXPLAIN ANALYZE UPDATE orders SET status = 'done' WHERE id = 1;
ROLLBACK;
```

운영 환경에서 DML에 EXPLAIN ANALYZE를 쓸 때는 반드시 트랜잭션으로 감싸고 ROLLBACK해야 한다. 그렇지 않으면 실제 데이터가 바뀐다.

## 출력 구조 해석

![EXPLAIN ANALYZE 출력 해부](/assets/posts/pg-explain-analyze-anatomy.svg)

각 노드 줄의 구성:

- `cost=시작..끝`: 옵티마이저가 추정한 코스트. 단위는 임의 단위(arbitrary unit)로, `seq_page_cost=1.0` 기준으로 계산됨. 시작은 첫 행 반환까지, 끝은 전체 완료까지
- `rows=N`: 추정 반환 행 수
- `width=N`: 추정 행당 바이트 수
- `actual time=시작..끝`: 실제 실행 시간(ms)
- `actual rows=N`: 실제 반환 행 수
- `loops=N`: 이 노드가 반복 실행된 횟수

**가장 중요한 확인 포인트**: 추정 rows와 actual rows의 차이. 크게 다르면 통계가 오래되었거나 상관 관계가 있는 컬럼을 필터링하는 것이다.

## loops 함정

Nested Loop 내부 노드는 `loops=N`이 1보다 클 수 있다. 이 경우 `actual time`은 **1루프 기준** 시간이다. 총 시간은 `actual_end_time × loops`로 계산해야 한다.

```sql
-- loops 함정 예시
EXPLAIN ANALYZE
SELECT o.id, u.name
FROM   orders o
JOIN   users  u ON u.id = o.customer_id
WHERE  o.created_at >= now() - INTERVAL '1 day';

-- 출력 예시
-- Nested Loop  (actual time=0.1..200.0 rows=1000 loops=1)
--   -> Seq Scan on orders  (actual time=0.05..50.0 rows=1000 loops=1)
--   -> Index Scan on users (actual time=0.01..0.15 rows=1 loops=1000)
--                                                              ↑ 총 시간 = 0.15 × 1000 = 150ms
```

Index Scan on users의 actual time은 0.15ms처럼 보이지만, loops=1000이므로 실제 총 기여 시간은 150ms다.

## BUFFERS 옵션으로 I/O 진단

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders WHERE customer_id = 42;

-- Buffers: shared hit=10 read=5
-- hit: 공유 버퍼(shared_buffers)에서 찾은 블록 수
-- read: 디스크에서 읽은 블록 수
-- dirty: 수정된 블록 수 (DML 시)
-- written: 체크포인트 전에 쓴 블록 수
```

`read`가 높으면 shared_buffers에 데이터가 없어 디스크 I/O가 발생했다는 뜻이다. 반복 실행 시 `hit`만 나오면 캐시에서 처리된 것이다.

## 주요 노드 타입과 선택 기준

| 노드 | 선택 조건 | 비용 특성 |
|------|-----------|-----------|
| Seq Scan | 대량 행 반환, 인덱스 없음 | 순차 I/O, 병렬 가능 |
| Index Scan | 소량 행, 선택도 높음 | 랜덤 I/O |
| Bitmap Heap Scan | 중간 행 수, 여러 인덱스 결합 | 비트맵 정렬 후 순차 I/O |
| Index Only Scan | 커버링 인덱스, VM all-visible | 힙 접근 최소 |
| Hash Join | 대용량 두 집합 조인 | 해시 테이블 메모리 |
| Merge Join | 정렬된 두 집합 조인 | 정렬 비용 |
| Nested Loop | 소량 외측, 인덱스 내측 | 외측 행 수 × 내측 비용 |

```sql
-- 추정 vs 실제 rows 차이 큰 경우 → ANALYZE 실행
ANALYZE orders;

-- 또는 특정 컬럼 통계 확장
ALTER TABLE orders ALTER COLUMN customer_id SET STATISTICS 500;
ANALYZE orders;
```

## EXPLAIN 옵션 모음

![EXPLAIN 옵션 가이드](/assets/posts/pg-explain-analyze-options.svg)

## JSON 포맷과 시각화 도구

JSON 포맷은 프로그래밍으로 실행 계획을 파싱하거나 시각화 도구에 붙여넣을 때 편리하다.

```sql
-- JSON 포맷으로 출력
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT o.id, u.name, o.amount
FROM   orders o
JOIN   users  u ON u.id = o.customer_id
WHERE  o.status = 'pending'
ORDER  BY o.created_at DESC
LIMIT  50;
```

출력된 JSON을 [explain.depesz.com](https://explain.depesz.com) 이나 [explain.dalibo.com](https://explain.dalibo.com)에 붙여넣으면 노드별 시간을 시각적으로 확인할 수 있다. 특히 노드 트리를 색으로 표시해 어느 노드가 전체 시간의 몇 %를 차지하는지 한눈에 볼 수 있다.

---

**지난 글:** [Index-Only Scan 완전 이해 — 언제 힙을 건너뛰는가](/posts/pg-index-only-scan/)

**다음 글:** [ANALYZE와 통계 — 옵티마이저가 신뢰하는 데이터](/posts/pg-analyze-statistics/)

<br>
읽어주셔서 감사합니다. 😊
