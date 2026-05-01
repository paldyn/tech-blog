---
title: "재귀 CTE — 계층 구조와 그래프 순회"
description: "WITH RECURSIVE를 사용한 계층 데이터 탐색, Anchor/Recursive Member 구조, 경로 누적, 날짜 시리즈 생성, 무한 루프 방지 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["sql", "recursive-cte", "with-recursive", "계층구조", "트리탐색", "날짜시리즈", "cycle"]
featured: false
draft: false
---

[지난 글](/posts/sql-cte-with-clause/)에서 일반 CTE의 구조와 활용법을 살펴봤다. 이번에는 CTE의 확장 형태인 **재귀 CTE(Recursive CTE)** 를 다룬다. 조직도·카테고리 트리·BOM 같은 계층 구조와 그래프 데이터를 SQL 한 문장으로 탐색할 수 있는 강력한 기능이다.

---

## 재귀 CTE 구조

재귀 CTE는 `WITH RECURSIVE` 키워드로 시작하며, 내부는 반드시 두 파트를 `UNION ALL`로 연결해야 한다.

```sql
WITH RECURSIVE cte_name AS (
    -- Anchor Member: 초기 행 (재귀 시작점)
    SELECT id, name, parent_id, 1 AS level
    FROM categories WHERE parent_id IS NULL

    UNION ALL

    -- Recursive Member: 직전 결과와 조인
    SELECT c.id, c.name, c.parent_id, t.level + 1
    FROM categories c
    JOIN cte_name t ON c.parent_id = t.id   -- 자기 참조
)
SELECT * FROM cte_name ORDER BY level, name;
```

- **Anchor Member**: 재귀의 시작점이 되는 행을 반환한다. 보통 루트 노드(parent_id IS NULL) 또는 특정 시작 노드를 지정한다.
- **Recursive Member**: `cte_name` 자체를 참조해 직전 반복 결과와 조인한다. 새로 발견된 행이 없으면 재귀가 종료된다.

![재귀 CTE 구조와 실행 흐름](/assets/posts/sql-recursive-cte-structure.svg)

---

## DBMS별 문법 차이

```sql
-- PostgreSQL, MySQL 8.0+, SQLite 3.35+, MariaDB 10.2+
WITH RECURSIVE org_tree AS (...)
SELECT * FROM org_tree;

-- SQL Server: MAXRECURSION 옵션
WITH org_tree AS (...)   -- RECURSIVE 키워드 없음
SELECT * FROM org_tree
OPTION (MAXRECURSION 100);

-- Oracle: CONNECT BY 전통 구문 (재귀 CTE도 지원)
SELECT id, name, LEVEL
FROM employees
START WITH manager_id IS NULL
CONNECT BY PRIOR id = manager_id;
```

---

## 경로 누적 패턴

각 노드의 루트에서부터 현재 노드까지의 전체 경로를 문자열로 누적할 수 있다.

```sql
WITH RECURSIVE cat_tree AS (
    SELECT id, name, parent_id,
           name::text AS path          -- 루트의 경로 = 자신의 이름
    FROM categories WHERE parent_id IS NULL

    UNION ALL

    SELECT c.id, c.name, c.parent_id,
           t.path || ' > ' || c.name  -- 부모 경로에 자신을 추가
    FROM categories c
    JOIN cat_tree t ON c.parent_id = t.id
)
SELECT id, path FROM cat_tree ORDER BY path;
-- 결과: 전자 > 스마트폰 > 갤럭시S25
```

경로 외에도 깊이(level), 루트 id, 정렬 키(materialized path) 등을 함께 누적할 수 있다.

---

## 날짜 시리즈 생성

재귀 CTE로 연속 날짜 목록을 만들 수 있다. 캘린더 테이블이나 `generate_series()`가 없는 DBMS에서 유용하다.

```sql
WITH RECURSIVE date_series AS (
    SELECT DATE '2025-01-01' AS d
    UNION ALL
    SELECT d + 1 FROM date_series WHERE d < DATE '2025-12-31'
)
SELECT d FROM date_series;
```

숫자 시리즈, 주 단위, 월 단위도 같은 방식으로 만든다.

![재귀 CTE 활용 패턴](/assets/posts/sql-recursive-cte-patterns.svg)

---

## 무한 루프 방지

재귀 CTE에서 가장 주의해야 할 것이 무한 루프다. 순환 참조가 있는 그래프 데이터에서 종료 조건 없이 실행하면 에러가 발생하거나 MAXRECURSION 제한에 걸린다.

```sql
-- 방법 1: WHERE로 깊이 제한
WHERE t.level < 10

-- 방법 2: 방문 배열로 사이클 감지 (PostgreSQL)
WITH RECURSIVE graph AS (
    SELECT id, ARRAY[id] AS visited
    FROM nodes WHERE id = 1
    UNION ALL
    SELECT e.to_id, g.visited || e.to_id
    FROM edges e
    JOIN graph g ON g.id = e.from_id
    WHERE e.to_id <> ALL(g.visited)   -- 이미 방문한 노드는 건너뜀
)
SELECT * FROM graph;

-- 방법 3: SQL:2023 CYCLE 절 (PostgreSQL 14+)
WITH RECURSIVE graph AS (...)
CYCLE id SET is_cycle USING path
SELECT * FROM graph WHERE NOT is_cycle;
```

---

## 성능 고려 사항

재귀 CTE는 각 반복마다 임시 결과를 만들고, 그것을 다음 반복이 읽는 방식으로 동작한다. 깊이가 깊고 노드 수가 많으면 메모리 사용량이 급증한다.

- 인덱스: `parent_id`(또는 `manager_id`) 컬럼에 인덱스가 있어야 각 반복의 JOIN이 빠르다.
- 깊이 제한: 실제 데이터에서 가능한 최대 깊이를 파악하고 안전망(level < N)을 둔다.
- 대안: 계층이 변경되지 않거나 읽기가 압도적이면 Nested Set 모델이나 Closure Table 패턴도 고려한다.

---

**지난 글:** [CTE — WITH 절로 쿼리를 구조화하기](/posts/sql-cte-with-clause/)

**다음 글:** [윈도우 함수 입문 — OVER 절과 파티션](/posts/sql-window-functions-intro/)

<br>
읽어주셔서 감사합니다. 😊
