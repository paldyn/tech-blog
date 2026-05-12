---
title: "PostgreSQL 배열 타입과 UNNEST — 다차원 데이터 처리"
description: "PostgreSQL의 배열 타입 선언, 삽입, 연산자(@>, &&), UNNEST로 행 집합 변환, array_agg 역집계, GIN 인덱스 활용까지 배열 데이터 처리 전 과정을 실무 쿼리와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["postgresql", "array", "unnest", "gin-index", "array-agg", "data-types", "text-array"]
featured: false
draft: false
---

[지난 글](/posts/pg-rich-data-types/)에서 PostgreSQL의 풍부한 타입 시스템을 개관했다. 이번에는 그 중에서도 특히 실무 활용도가 높은 **배열 타입**과 `UNNEST` 함수를 깊이 살펴본다.

## 배열 타입이 필요한 상황

관계형 모델의 원칙은 "한 셀, 한 값"이지만, 현실에서는 "이 게시글의 태그 목록", "이 주문의 옵션 코드들"처럼 **순서 없는 소규모 집합**을 한 컬럼에 묶어 두면 편리한 경우가 많다.

정규화하면 조인이 필요하고, EAV 패턴은 타입 안전성을 잃는다. 배열 타입은 이 사이의 실용적 균형점이다. 단, 배열 원소를 외래 키로 참조하거나, 원소별 집계가 빈번하면 정규화를 선택하는 것이 낫다.

![배열 타입 구조와 UNNEST 변환](/assets/posts/pg-array-types-unnest-structure.svg)

## 배열 선언과 삽입

```sql
-- 1차원 배열
CREATE TABLE article (
    id     bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title  text NOT NULL,
    tags   text[]  DEFAULT '{}'::text[],
    scores integer[] DEFAULT ARRAY[]::integer[]
);

-- 삽입: ARRAY 생성자 vs 리터럴
INSERT INTO article (title, tags) VALUES
    ('PG 가이드', ARRAY['postgresql', 'sql', 'index']),
    ('MySQL 튜닝', '{mysql,sql}'::text[]);

-- 첫 번째 원소 조회 (1-based index)
SELECT tags[1] FROM article WHERE id = 1;  -- 'postgresql'

-- 슬라이싱
SELECT tags[1:2] FROM article WHERE id = 1;  -- '{postgresql,sql}'
```

PostgreSQL 배열 인덱스는 **1부터 시작**한다. 0 기반 언어에 익숙한 개발자가 자주 놓치는 점이다.

## 다차원 배열

```sql
-- 2차원 배열 (행렬)
CREATE TABLE matrix_data (
    id   integer PRIMARY KEY,
    grid integer[][]
);

INSERT INTO matrix_data VALUES
    (1, ARRAY[[1,2,3],[4,5,6],[7,8,9]]);

-- 특정 원소 접근 [행][열]
SELECT grid[2][3] FROM matrix_data WHERE id = 1;  -- 6

-- 행 전체 슬라이스
SELECT grid[2:2][1:3] FROM matrix_data WHERE id = 1;  -- {{4,5,6}}
```

## 배열 연산자

| 연산자 | 의미 | 예시 |
|--------|------|------|
| `@>` | 왼쪽이 오른쪽을 포함 | `tags @> ARRAY['sql']` |
| `<@` | 왼쪽이 오른쪽에 포함됨 | `ARRAY['pg'] <@ tags` |
| `&&` | 교집합 존재 | `tags && ARRAY['pg','mysql']` |
| `\|\|` | 배열 연결 | `tags \|\| ARRAY['new']` |
| `= ANY(arr)` | 배열 원소 중 하나와 일치 | `'sql' = ANY(tags)` |

```sql
-- GIN 인덱스 생성 (포함 검색 최적화)
CREATE INDEX idx_article_tags ON article USING GIN (tags);

-- 인덱스 활용 검색
SELECT id, title FROM article WHERE tags @> ARRAY['sql'];
SELECT id, title FROM article WHERE tags && ARRAY['postgresql', 'mysql'];
```

`ANY`는 인덱스를 활용하지 못하는 경우가 많다. 포함 검색에는 `@>` 연산자와 GIN 인덱스를 사용해야 한다.

## UNNEST — 배열을 행으로 펼치기

`UNNEST`는 배열의 각 원소를 별도 행으로 변환한다. `FROM` 절에서 테이블처럼 사용하면 **Lateral Join**처럼 동작한다.

```sql
-- 기본 UNNEST
SELECT unnest(ARRAY['a', 'b', 'c']) AS elem;
-- a
-- b
-- c

-- 테이블 컬럼과 함께
SELECT a.id, a.title, t.tag
FROM article a,
     UNNEST(a.tags) AS t(tag)
WHERE a.id = 1;
```

### WITH ORDINALITY — 순서 번호 포함

```sql
SELECT tag, ordinality AS pos
FROM UNNEST(ARRAY['postgresql', 'sql', 'index'])
     WITH ORDINALITY AS t(tag, ordinality);
-- postgresql | 1
-- sql        | 2
-- index      | 3
```

여러 배열을 병렬로 펼칠 때도 사용한다.

```sql
-- 두 배열을 zip처럼 병렬 펼치기
SELECT k, v
FROM UNNEST(
    ARRAY['name', 'age', 'city'],
    ARRAY['Alice', '30', 'Seoul']
) AS t(k, v);
```

![배열 연산 SQL 패턴](/assets/posts/pg-array-types-unnest-code.svg)

## 태그 빈도 집계 — UNNEST + GROUP BY

```sql
-- 태그별 게시글 수
SELECT tag, COUNT(*) AS cnt
FROM article,
     UNNEST(tags) AS t(tag)
GROUP BY tag
ORDER BY cnt DESC;
```

이 패턴은 태그 클라우드, 인기 카테고리 분석에 자주 쓰인다.

## array_agg — 행을 배열로 역집계

`UNNEST`의 반대 방향: 여러 행의 값을 하나의 배열로 묶는다.

```sql
-- 저자별 게시글 제목 배열 집계
SELECT author_id,
       array_agg(title ORDER BY id) AS article_titles,
       array_agg(DISTINCT tags[1]) AS first_tags
FROM article
GROUP BY author_id;

-- 정수 배열로 ID 수집
SELECT array_agg(id) AS all_ids FROM article WHERE tags @> ARRAY['sql'];
```

## 배열 조작 함수

```sql
-- 원소 추가
SELECT array_append(ARRAY[1,2,3], 4);        -- {1,2,3,4}
SELECT array_prepend(0, ARRAY[1,2,3]);        -- {0,1,2,3}
SELECT ARRAY[1,2] || ARRAY[3,4];             -- {1,2,3,4}

-- 원소 제거
SELECT array_remove(ARRAY[1,2,3,2], 2);      -- {1,3}

-- 검색
SELECT array_position(ARRAY['a','b','c'], 'b');  -- 2
SELECT array_positions(ARRAY[1,2,3,1], 1);      -- {1,4}

-- 길이
SELECT array_length(ARRAY[1,2,3], 1);  -- 3 (1차원)

-- 정렬
SELECT array_sort(ARRAY[3,1,2]);  -- {1,2,3} (pg 16+)
```

## 배열 vs 정규화 선택 기준

| 상황 | 배열 | 정규화 |
|------|------|--------|
| 원소 개수 ≤ 수십 개 | ✓ | |
| 원소 간 FK 참조 없음 | ✓ | |
| 원소별 행으로 집계 드묾 | ✓ | |
| 원소 자체가 복잡한 구조 | | ✓ |
| 원소별 FK 참조 필요 | | ✓ |
| 원소 빈번 업데이트 | | ✓ |

## 성능 주의사항

- 대용량 배열(수천 원소)은 **TOAST** 저장으로 넘어가 페이지 분리 발생
- `ANY(array)` vs `@>` — `@>`가 GIN을 활용하므로 검색 성능 우위
- `UNNEST` + `JOIN`은 행 수가 급증할 수 있어 `LIMIT`와 함께 사용 권장

## 정리

PostgreSQL 배열은 태그, 옵션 코드, 집계 중간 결과처럼 **소규모 동질 집합을 한 컬럼에 관리**하는 실용적 도구다. GIN 인덱스와 결합하면 포함 검색 성능도 확보된다. `UNNEST`로 행 집합으로 펼치고 `array_agg`로 다시 묶는 패턴은 복잡한 집계를 단순화하는 데 강력하다.

---

**지난 글:** [PostgreSQL 풍부한 데이터 타입 — 표준을 넘어서](/posts/pg-rich-data-types/)

**다음 글:** [JSON vs JSONB — 저장 구조와 선택 기준](/posts/pg-json-vs-jsonb/)

<br>
읽어주셔서 감사합니다. 😊
