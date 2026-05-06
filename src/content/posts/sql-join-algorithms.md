---
title: "조인 알고리즘"
description: "Nested Loop Join, Hash Join, Sort-Merge Join 세 가지 조인 알고리즘의 동작 원리, 복잡도, 적합한 사용 조건과 각 알고리즘을 CBO가 어떻게 선택하는지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["sql", "join", "nested-loop", "hash-join", "sort-merge", "algorithm", "optimizer", "performance"]
featured: false
draft: false
---

[지난 글](/posts/sql-cost-based-optimizer/)에서 CBO가 비용 추정으로 플랜을 결정하는 방법을 알아봤다. CBO가 선택하는 핵심 결정 중 하나가 **조인 알고리즘**이다. 데이터 크기와 인덱스 유무에 따라 알고리즘 선택이 성능에 결정적 영향을 미친다.

---

## 3가지 조인 알고리즘

![3가지 조인 알고리즘](/assets/posts/sql-join-algorithms-three.svg)

### 1. Nested Loop Join (NL)

외부 테이블(Outer)을 순회하면서 각 행에 대해 내부 테이블(Inner)을 탐색하는 방식이다.

```sql
-- 의사 코드
FOR each row r1 IN outer_table:
    FOR each row r2 IN inner_table WHERE r2.key = r1.key:
        output(r1, r2)
```

Inner 테이블에 인덱스가 있으면 각 Outer 행마다 **인덱스 룩업 한 번**으로 끝난다. 이를 Index Nested Loop라 부르며 OLTP의 핵심 패턴이다.

- **복잡도**: O(N × M), 인덱스 있으면 O(N × log M)
- **적합**: 소량 Outer × Inner에 인덱스 존재
- **부적합**: 대용량 테이블 전체 스캔 조인

### 2. Hash Join

작은 테이블을 메모리에 해시 테이블로 구축(Build)한 뒤, 큰 테이블을 순차 읽으며 해시를 탐색(Probe)한다.

```sql
-- Build phase: 작은 테이블 → 메모리 해시 테이블
hash_table = { row.key: row for row in small_table }

-- Probe phase: 큰 테이블을 순차 읽으며 조회
FOR each row r IN large_table:
    match = hash_table.get(r.key)
    IF match: output(r, match)
```

- **복잡도**: O(N + M)
- **적합**: 대용량 등치 조인, 인덱스 없는 경우
- **부적합**: 메모리 부족 시 디스크 Spill, 범위 조인

### 3. Sort-Merge Join

양쪽 테이블을 조인 키로 정렬한 뒤 두 포인터를 진행하며 병합한다.

```sql
-- Sort: 양쪽 정렬 (이미 정렬돼 있으면 생략)
sorted_A = sort(table_A, by=key)
sorted_B = sort(table_B, by=key)

-- Merge: 두 포인터 순차 진행
merge(sorted_A, sorted_B, on=key)
```

- **복잡도**: 정렬 O(N log N + M log M), 이미 정렬됐으면 O(N + M)
- **적합**: 범위 조인, ORDER BY가 필요한 쿼리, 이미 정렬된 데이터
- **부적합**: 정렬 비용이 크고 인덱스가 있을 때

---

## 비용 비교 매트릭스

![조인 알고리즘 비용 비교](/assets/posts/sql-join-algorithms-cost.svg)

---

## EXPLAIN으로 알고리즘 확인

```sql
EXPLAIN SELECT o.id, u.name
FROM orders o
JOIN users u ON o.user_id = u.id
WHERE o.status = 'pending';
```

PostgreSQL 출력 예시:

```
Hash Join  (cost=310.50..2840.30 rows=1200 width=48)
  Hash Cond: (o.user_id = u.id)
  ->  Seq Scan on orders o
        Filter: (status = 'pending')
  ->  Hash
        ->  Seq Scan on users u
```

`Hash Join`으로 선택된 것을 볼 수 있다. `users` 테이블이 작아 Build 대상으로 선택됐다.

---

## 알고리즘 강제 지정 (힌트)

통계 이상으로 잘못된 알고리즘이 선택된다면:

```sql
-- PostgreSQL: 특정 알고리즘 비활성화
SET enable_hashjoin = off;
SET enable_nestloop = off;

-- MySQL: 힌트
SELECT /*+ NO_HASH_JOIN(o, u) */ ...
FROM orders o JOIN users u ON ...

-- Oracle
SELECT /*+ USE_NL(o u) */ ...
FROM orders o, users u WHERE ...
```

힌트는 통계 갱신·쿼리 재작성 후에도 문제가 남을 때만 사용한다.

---

## 실전 가이드

| 상황 | 권장 알고리즘 |
|------|---------------|
| OLTP 단건 조회 + PK/FK 조인 | Nested Loop |
| DW 대용량 집계 조인 | Hash Join |
| 날짜 범위 조인, 리포트 | Sort-Merge |
| 이미 정렬된 결과가 필요한 조인 | Sort-Merge |
| `work_mem`이 작은 환경 | Nested Loop 유리 |

---

**지난 글:** [비용 기반 옵티마이저(CBO)](/posts/sql-cost-based-optimizer/)

**다음 글:** [정렬과 집계의 비용](/posts/sql-sort-aggregate-cost/)

<br>
읽어주셔서 감사합니다. 😊
