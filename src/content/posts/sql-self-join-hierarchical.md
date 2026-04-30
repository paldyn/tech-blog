---
title: "셀프 조인과 계층형 데이터"
description: "동일 테이블을 두 번 조인하는 셀프 조인의 원리, 조직도·카테고리 트리 같은 계층형 데이터 쿼리 패턴, 그리고 임의 깊이 탐색이 필요할 때 쓰는 재귀 CTE와의 비교를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["sql", "self-join", "계층형", "hierarchical", "재귀", "recursive-cte", "조직도", "트리"]
featured: false
draft: false
---

[지난 글](/posts/sql-cross-join-cartesian/)에서 CROSS JOIN과 카테시안 곱을 살펴봤다. 이번에는 같은 테이블을 두 번 조인하는 **셀프 조인(Self Join)**을 다룬다. 조직도, 카테고리 트리, 댓글 스레드처럼 하나의 테이블 안에서 부모-자식 관계가 있는 데이터를 다룰 때 핵심 패턴이다.

---

## 셀프 조인이란

셀프 조인은 특별한 조인 키워드가 따로 있는 게 아니다. 같은 테이블에 서로 다른 **별칭(Alias)**을 붙여 두 번 참조하는 일반 JOIN이다.

```sql
-- employees 테이블: id, name, manager_id (자기 참조 FK)
SELECT
    e.name  AS employee,
    m.name  AS manager
FROM employees e
LEFT JOIN employees m ON m.id = e.manager_id;
```

`employees`가 두 역할로 등장한다. `e`는 직원으로서, `m`은 관리자로서 사용된다. `manager_id`가 NULL인 최상위 직원도 LEFT JOIN 덕분에 결과에 포함된다.

![셀프 조인 — 계층형 데이터 구조](/assets/posts/sql-self-join-hierarchical-tree.svg)

---

## 자기 참조 외래키 설계

계층형 데이터를 저장하는 가장 단순한 방법은 **인접 목록(Adjacency List)** 패턴이다. 같은 테이블의 `id`를 참조하는 `parent_id` 또는 `manager_id` 컬럼을 둔다.

```sql
CREATE TABLE categories (
    id        BIGINT PRIMARY KEY,
    name      VARCHAR(100) NOT NULL,
    parent_id BIGINT REFERENCES categories(id)  -- 자기 참조
);

INSERT INTO categories VALUES
    (1, '전자제품', NULL),
    (2, '스마트폰', 1),
    (3, '태블릿', 1),
    (4, '아이폰', 2),
    (5, '갤럭시', 2);
```

최상위 노드는 `parent_id = NULL`이다.

---

## 셀프 조인 활용 패턴

### 1단계 부모 조회

```sql
-- 카테고리와 상위 카테고리 이름
SELECT
    c.id,
    c.name             AS category,
    p.name             AS parent
FROM categories c
LEFT JOIN categories p ON p.id = c.parent_id;

-- 결과:
-- 1  전자제품   NULL
-- 2  스마트폰   전자제품
-- 4  아이폰     스마트폰
```

### 같은 그룹 내 비교

셀프 조인은 계층 탐색 외에도 **같은 테이블의 행끼리 비교**할 때 사용한다.

```sql
-- 같은 부서에서 월급 차이가 100만 원 이상인 직원 쌍
SELECT
    a.name AS emp_a,
    b.name AS emp_b,
    ABS(a.salary - b.salary) AS diff
FROM employees a
JOIN employees b
    ON a.dept_id = b.dept_id
   AND a.id < b.id         -- 중복 쌍 제거
WHERE ABS(a.salary - b.salary) >= 1000000;
```

`a.id < b.id` 조건으로 (Alice, Bob)과 (Bob, Alice)가 중복 반환되지 않도록 한다.

---

## 재귀 CTE로 임의 깊이 탐색

셀프 조인은 한 번 조인할 때마다 한 단계 내려간다. 계층이 3단계면 JOIN을 3번 써야 한다. 깊이를 알 수 없는 계층을 탐색할 때는 **재귀 CTE(WITH RECURSIVE)**를 사용한다.

![재귀 CTE vs 셀프 조인](/assets/posts/sql-self-join-hierarchical-recursive.svg)

```sql
-- 조직 전체 계층 순회
WITH RECURSIVE org AS (
    -- 앵커: 최상위 직원
    SELECT id, name, manager_id, 0 AS depth
    FROM employees
    WHERE manager_id IS NULL

    UNION ALL

    -- 재귀: 자식 직원 탐색
    SELECT e.id, e.name, e.manager_id, o.depth + 1
    FROM employees e
    JOIN org o ON o.id = e.manager_id
)
SELECT
    REPEAT('  ', depth) || name AS indented_name,
    depth
FROM org
ORDER BY depth, name;

-- 결과:
-- Alice           (depth 0)
--   Bob           (depth 1)
--     Dave        (depth 2)
--     Eve         (depth 2)
--   Carol         (depth 1)
--     Frank       (depth 2)
```

재귀 CTE는 무한 루프를 방지하기 위해 `MAXRECURSION` 설정(SQL Server) 또는 `depth < 100` 같은 조건을 추가하는 것이 안전하다.

---

## 하위 트리 전체 조회

특정 노드 아래의 모든 자식을 재귀적으로 가져올 때도 같은 패턴을 사용한다.

```sql
-- 'Bob(id=2)' 아래의 모든 하위 직원
WITH RECURSIVE subtree AS (
    SELECT id, name, manager_id
    FROM employees
    WHERE id = 2  -- 시작 노드

    UNION ALL

    SELECT e.id, e.name, e.manager_id
    FROM employees e
    JOIN subtree s ON s.id = e.manager_id
)
SELECT * FROM subtree;
-- Bob, Dave, Eve
```

---

## 데이터베이스별 계층 쿼리

| DB | 방법 |
|----|------|
| PostgreSQL, SQL Server, MySQL 8+, SQLite 3.35+ | `WITH RECURSIVE` |
| Oracle | `CONNECT BY PRIOR` + `START WITH` |
| 공통 | 셀프 조인 (1단계) |

Oracle의 `CONNECT BY` 문법은 표준 SQL이 아니지만 계층 쿼리에 특화된 편리한 기능을 제공한다. `LEVEL` 가상 컬럼으로 깊이를, `SYS_CONNECT_BY_PATH`로 경로 문자열을 얻을 수 있다.

```sql
-- Oracle CONNECT BY 예시
SELECT
    LEVEL AS depth,
    LPAD(' ', (LEVEL-1)*2) || name AS indented_name
FROM employees
START WITH manager_id IS NULL
CONNECT BY PRIOR id = manager_id;
```

---

**지난 글:** [CROSS JOIN과 카테시안 곱](/posts/sql-cross-join-cartesian/)

**다음 글:** [NATURAL JOIN과 USING 절](/posts/sql-natural-join-using/)

<br>
읽어주셔서 감사합니다. 😊
