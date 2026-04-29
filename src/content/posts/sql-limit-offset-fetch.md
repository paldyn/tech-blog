---
title: "LIMIT / OFFSET / FETCH FIRST — 페이지 처리"
description: "SQL에서 결과 행 수를 제한하는 LIMIT/OFFSET, 표준 FETCH FIRST, DBMS별 문법 차이, 깊은 페이지에서 발생하는 OFFSET 성능 문제, 그리고 커서 기반 페이지네이션 전환 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["sql", "limit", "offset", "fetch-first", "pagination", "cursor-based", "성능", "페이지네이션"]
featured: false
draft: false
---

[지난 글](/posts/sql-order-by-and-null-sort/)에서 ORDER BY와 NULL 정렬을 살펴봤다. 이번에는 정렬된 결과에서 일부만 가져오는 LIMIT/OFFSET과 페이지 처리 패턴을 다룬다.

---

## 기본 문법

```sql
-- MySQL, PostgreSQL: LIMIT [count] OFFSET [skip]
SELECT * FROM products
ORDER BY id
LIMIT 10 OFFSET 20;  -- 21~30번째 행

-- LIMIT만 사용 (처음 N개)
SELECT * FROM products ORDER BY created_at DESC LIMIT 5;
```

페이지 번호(page)와 페이지 크기(size)가 있을 때 OFFSET 계산 공식은 `OFFSET = (page - 1) * size`다.

---

## DBMS별 문법

| DBMS | 문법 |
|---|---|
| MySQL / MariaDB | `LIMIT count OFFSET skip` |
| PostgreSQL | `LIMIT count OFFSET skip` |
| SQL Server | `ORDER BY ... OFFSET skip ROWS FETCH NEXT count ROWS ONLY` |
| Oracle 12c+ | `OFFSET skip ROWS FETCH NEXT count ROWS ONLY` |
| Oracle 11g- | `WHERE ROWNUM <= N` (중첩 서브쿼리 필요) |

![LIMIT · OFFSET · FETCH 문법 비교](/assets/posts/sql-limit-offset-fetch-syntax.svg)

---

## SQL:2008 표준 — FETCH FIRST

SQL:2008에서 표준 문법이 도입되었다. SQL Server 2012+, Oracle 12c+, PostgreSQL이 지원한다.

```sql
-- SQL 표준
SELECT * FROM products
ORDER BY id
OFFSET 20 ROWS
FETCH NEXT 10 ROWS ONLY;

-- FIRST와 NEXT는 동의어, ROWS와 ROW도 동의어
FETCH FIRST 5 ROWS ONLY   -- OFFSET 없이 처음 5행
FETCH NEXT 10 ROW ONLY    -- 동일 의미
```

---

## ORDER BY 없는 LIMIT는 의미 없다

LIMIT/OFFSET은 반드시 ORDER BY와 함께 사용해야 결정론적 결과를 얻는다.

```sql
-- ✗ 어떤 10개인지 실행마다 다를 수 있음
SELECT * FROM users LIMIT 10;

-- ✓ 순서가 확정됨
SELECT * FROM users ORDER BY id LIMIT 10;
```

---

## OFFSET 페이지네이션의 성능 문제

가장 널리 쓰이는 방식이지만 **깊은 페이지에서 성능이 급격히 저하된다.** OFFSET N이라고 해서 N번째 행으로 바로 점프하는 게 아니라, 처음부터 N개 행을 읽고 버린다.

```sql
-- OFFSET 0: 빠름 — 처음 10개만 읽음
SELECT * FROM logs ORDER BY id LIMIT 10 OFFSET 0;

-- OFFSET 999990: 느림 — 999990 + 10 = 100만 행을 읽음
SELECT * FROM logs ORDER BY id LIMIT 10 OFFSET 999990;
```

![OFFSET vs 커서 기반 페이지네이션](/assets/posts/sql-limit-offset-fetch-cursor.svg)

---

## 커서 기반 페이지네이션

"무한 스크롤"이나 대용량 테이블 페이지 처리에는 커서 기반이 적합하다. 마지막으로 본 행의 ID(커서)를 WHERE 조건으로 사용한다.

```sql
-- 첫 페이지
SELECT id, title, created_at
FROM articles
ORDER BY id
LIMIT 10;
-- → 마지막 id = 1023

-- 다음 페이지 (cursor = 1023)
SELECT id, title, created_at
FROM articles
WHERE id > 1023       -- 커서 조건
ORDER BY id
LIMIT 10;
-- → 마지막 id = 1035

-- 그 다음 페이지 (cursor = 1035)
WHERE id > 1035 ...
```

`WHERE id > cursor`는 인덱스를 사용하는 범위 탐색이므로 페이지 깊이에 관계없이 일정한 성능을 유지한다.

**커서 기반의 제약:**
- 임의 페이지로 점프 불가 (순차 이동만)
- 정렬 기준 컬럼에 유니크 인덱스가 있어야 커서가 확정됨
- 삽입/삭제로 인한 행 건너뜀/중복 가능성 없음 (OFFSET 방식의 문제를 해결)

---

## 페이지네이션 방식 선택 기준

- **OFFSET**: 관리자 페이지, 임의 페이지 이동이 필요한 경우, 소규모 테이블
- **커서 기반**: 피드/타임라인, 무한 스크롤, 대용량 테이블, API pagination

---

**지난 글:** [ORDER BY와 NULL 정렬](/posts/sql-order-by-and-null-sort/)

**다음 글:** [DISTINCT의 비용과 대안](/posts/sql-distinct-cost/)

<br>
읽어주셔서 감사합니다. 😊
