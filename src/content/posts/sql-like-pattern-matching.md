---
title: "LIKE 패턴 매칭"
description: "SQL LIKE 연산자의 와일드카드 % 와 _, ESCAPE 절, 대소문자 처리, ILIKE·REGEXP 확장 문법, 그리고 앞쪽 와일드카드가 인덱스를 막는 이유까지 패턴 매칭의 모든 것을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["sql", "like", "pattern-matching", "wildcard", "ilike", "regexp", "full-text", "인덱스"]
featured: false
draft: false
---

[지난 글](/posts/sql-where-comparison/)에서 WHERE 절의 비교 연산자를 살펴봤다. 이번에는 그중 문자열 패턴 매칭을 담당하는 LIKE를 집중적으로 다룬다.

---

## LIKE 기본 문법

```sql
-- 기본 형태
WHERE 컬럼 LIKE '패턴'
WHERE 컬럼 NOT LIKE '패턴'
```

LIKE는 두 가지 와일드카드를 사용한다.

- `%` — 0개 이상의 임의 문자
- `_` — 정확히 1개의 임의 문자

![LIKE 와일드카드 — % 와 _](/assets/posts/sql-like-pattern-matching-wildcards.svg)

---

## 패턴 유형별 예시

```sql
-- 접두사 매칭: 'Kim'으로 시작
WHERE name LIKE 'Kim%'    -- Kim, Kimchi, Kim123

-- 접미사 매칭: 특정 도메인으로 끝남
WHERE email LIKE '%@paldyn.com'

-- 중간 포함: 어디든 'sql' 포함
WHERE title LIKE '%sql%'

-- 정확히 N자: _ 하나당 한 글자
WHERE code LIKE '__-___'  -- AB-123 형태의 코드

-- 한글도 동일하게 처리
WHERE name LIKE '김%'    -- 김씨 성 이름 모두
```

---

## ESCAPE — 와일드카드 문자 자체 검색

`%`나 `_`를 리터럴 문자로 검색해야 할 때 `ESCAPE`를 사용한다.

```sql
-- '30% discount' 라는 문자열 자체를 검색
WHERE description LIKE '30!% discount' ESCAPE '!'

-- '_id' 컬럼명 패턴 검색
WHERE column_name LIKE '!_id%' ESCAPE '!'
```

`ESCAPE '!'`는 `!` 뒤에 오는 문자를 와일드카드가 아닌 리터럴로 처리하라는 의미다. 어떤 문자를 ESCAPE 문자로 쓸지는 자유롭게 선택할 수 있다.

---

## 대소문자 처리

LIKE의 대소문자 처리는 DBMS와 콜레이션(Collation) 설정에 따라 다르다.

```sql
-- PostgreSQL: 기본 대소문자 구분
WHERE name LIKE 'kim%'  -- 'Kim', 'KIM'은 불일치

-- PostgreSQL: ILIKE로 대소문자 무시
WHERE name ILIKE 'kim%'  -- 'Kim', 'KIM', 'kim' 모두 매칭

-- MySQL: utf8mb4_general_ci (기본)는 대소문자 구분 안 함
-- MySQL: 대소문자 강제 구분
WHERE name LIKE BINARY 'kim%'
```

---

## 성능: 앞쪽 와일드카드 문제

LIKE 패턴에서 가장 주의할 점은 **앞쪽 와일드카드**다.

```sql
-- ✓ 접두사 매칭: B-tree 인덱스 범위 스캔 가능
WHERE name LIKE 'Kim%'

-- ✗ 중간/접미사 매칭: 풀 테이블 스캔
WHERE name LIKE '%Kim%'
WHERE name LIKE '%Kim'
```

B-tree 인덱스는 정렬된 순서로 데이터를 저장한다. `'Kim%'`는 `'Kim' 이상, 'Kin' 미만` 범위로 변환되어 인덱스를 탐색할 수 있다. 반면 `'%Kim'`은 어디서 시작할지 알 수 없어 인덱스를 처음부터 끝까지 읽어야 한다.

---

## 정규표현식 확장

더 복잡한 패턴이 필요할 때는 DBMS별 정규표현식 기능을 사용한다.

```sql
-- MySQL / MariaDB: REGEXP (RLIKE)
WHERE phone REGEXP '^010-[0-9]{4}-[0-9]{4}$'

-- PostgreSQL: ~ (정규식 일치)
WHERE email ~ '@[a-z]+\.com$'
WHERE email !~ 'test'          -- 불일치
WHERE email ~* 'gmail'         -- 대소문자 무시 (~*)

-- PostgreSQL: SIMILAR TO (SQL 표준 정규식)
WHERE name SIMILAR TO '(Kim|Lee|Park)%'
```

정규표현식은 LIKE보다 훨씬 강력하지만, 인덱스를 활용하지 못하고 CPU 비용이 높다. 소수 행 검색이나 데이터 검증 목적에 적합하다.

![DBMS 확장 패턴 매칭](/assets/posts/sql-like-pattern-matching-advanced.svg)

---

## 대용량 텍스트 검색 대안

테이블이 크고 중간 포함(`%keyword%`) 검색이 빈번하다면 전문 검색 솔루션을 고려한다.

```sql
-- PostgreSQL: pg_trgm 확장 + GIN 인덱스 (중간 LIKE도 인덱스 활용)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_name_trgm ON products USING GIN (name gin_trgm_ops);
-- 이후 LIKE '%keyword%' 도 인덱스 활용 가능

-- MySQL: FULLTEXT 인덱스
CREATE FULLTEXT INDEX ft_title ON articles(title, content);
SELECT * FROM articles
WHERE MATCH(title, content) AGAINST ('sql pattern' IN BOOLEAN MODE);
```

`pg_trgm`은 문자열을 3글자 단위(트라이그램)로 인덱싱해서 중간 포함 검색도 인덱스를 활용하게 한다.

---

**지난 글:** [WHERE 절과 비교 연산자](/posts/sql-where-comparison/)

**다음 글:** [IN · BETWEEN · IS NULL](/posts/sql-in-between-isnull/)

<br>
읽어주셔서 감사합니다. 😊
