---
title: "LIKE, SIMILAR TO, 정규식 패턴 매칭"
description: "SQL LIKE 와일드카드, SIMILAR TO 확장 패턴, POSIX 정규식(~, REGEXP_LIKE), 인덱스 활용 방법, 이메일·전화번호 검증 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-03"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["sql", "like", "similar-to", "regex", "regexp", "pattern-matching", "ilike", "pg-trgm"]
featured: false
draft: false
---

[지난 글](/posts/sql-string-functions-standard/)에서 표준 문자열 함수를 정리했다. 이번에는 문자열 패턴 매칭 세 가지 방법—`LIKE`, `SIMILAR TO`, 정규식(`~`/`REGEXP`)—을 비교하고 인덱스 활용 방안까지 살펴본다.

---

## LIKE — 표준 와일드카드 매칭

`LIKE`는 모든 SQL DB가 지원하는 표준 패턴 매칭이다. 두 가지 와일드카드를 제공한다.

- `%`: 0개 이상의 임의 문자
- `_`: 정확히 1개의 임의 문자

```sql
-- '%sql%': sql이 포함된 모든 문자열
WHERE title LIKE '%sql%'

-- '_bc': 첫 글자 1개 + bc
WHERE code LIKE '_bc'

-- 'abc%': abc로 시작 (인덱스 사용 가능)
WHERE name LIKE 'abc%'

-- 리터럴 % 검색: ESCAPE 지정
WHERE description LIKE '50\%' ESCAPE '\'
```

`ILIKE`는 PostgreSQL에서 대소문자 무관 LIKE다. MySQL은 기본적으로 collation에 따라 대소문자 처리가 결정된다.

---

## LIKE와 인덱스

`'prefix%'` 패턴(전위 고정)은 B-Tree 인덱스를 사용할 수 있다. `'%suffix'`나 `'%infix%'`는 인덱스를 사용하지 못하고 전체 스캔을 한다.

```sql
-- 인덱스 사용 가능: name LIKE 'Kim%'
-- 인덱스 사용 불가: name LIKE '%Kim' 또는 LIKE '%Kim%'
```

중간 포함 검색(`%keyword%`)이 필요하면 PostgreSQL의 `pg_trgm` 확장 + GIN 인덱스를 사용한다.

```sql
-- PostgreSQL: 트라이그램 인덱스 생성
CREATE EXTENSION pg_trgm;
CREATE INDEX idx_title_trgm ON articles USING GIN (title gin_trgm_ops);
-- 이후 LIKE '%keyword%', ILIKE, ~ 모두 인덱스 활용 가능
```

---

## SIMILAR TO — SQL 표준 정규식

`SIMILAR TO`는 SQL:1999 표준으로 LIKE의 와일드카드에 일부 정규식 메타문자를 추가한 것이다. PostgreSQL만 지원한다.

```sql
-- SIMILAR TO: LIKE 메타문자 + 정규식 일부
WHERE phone SIMILAR TO '0[0-9]{1,2}-[0-9]{3,4}-[0-9]{4}'
-- 0으로 시작, 1~2자리 숫자, -, 3~4자리 숫자, -, 4자리 숫자

-- 대안(교대): 세 글자로 시작하는 두 패턴 중 하나
WHERE code SIMILAR TO '(ABC|DEF)%'
```

`SIMILAR TO`는 패턴이 전체 문자열에 매칭해야 한다(암묵적 `^...$`). POSIX 정규식과 달리 부분 매칭이 기본이 아니다.

![패턴 매칭 비교 표](/assets/posts/sql-regex-similar-to-comparison.svg)

---

## 정규식 — POSIX 패턴 매칭

PostgreSQL은 `~` 연산자로 POSIX 정규식을 지원한다.

| 연산자 | 의미 |
|---|---|
| `~` | 정규식 매칭 (대소문자 구분) |
| `!~` | 정규식 불매칭 |
| `~*` | 대소문자 무관 매칭 |
| `!~*` | 대소문자 무관 불매칭 |

MySQL/MariaDB는 `REGEXP`/`RLIKE`, Oracle은 `REGEXP_LIKE()`, SQL Server는 `LIKE`에만 의존(CHARINDEX, PATINDEX 조합)한다.

![패턴 매칭 SQL 예제](/assets/posts/sql-regex-similar-to-patterns.svg)

```sql
-- PostgreSQL: 이메일 형식 검증
WHERE email ~ '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'

-- MySQL: REGEXP_LIKE (8.0+)
WHERE REGEXP_LIKE(phone, '^01[016789]-[0-9]{3,4}-[0-9]{4}$')

-- Oracle: REGEXP_LIKE
WHERE REGEXP_LIKE(postal_code, '^[0-9]{5}(-[0-9]{4})?$')
```

---

## REGEXP 관련 함수

DB마다 정규식 관련 함수 이름이 다르지만 기능은 유사하다.

```sql
-- 정규식으로 추출 (PostgreSQL)
SELECT REGEXP_SUBSTR(address, '[0-9]+', 1, 1) AS house_num
FROM addresses;

-- 정규식으로 치환 (PostgreSQL)
SELECT REGEXP_REPLACE(phone, '[^0-9]', '', 'g') AS digits_only
FROM contacts;
-- 'g' 플래그: 전체 치환 (기본은 첫 번째만)

-- 정규식으로 분리 (PostgreSQL)
SELECT REGEXP_SPLIT_TO_TABLE(tags, ',\s*') AS tag
FROM articles;
```

Oracle에도 `REGEXP_REPLACE`, `REGEXP_SUBSTR`, `REGEXP_INSTR`, `REGEXP_COUNT`가 있으며 MySQL 8.0+는 `REGEXP_REPLACE`를 지원한다.

---

## 성능 주의 사항

패턴 매칭 함수는 대부분 인덱스를 사용하지 못한다. 대량 데이터에서 성능 문제가 생기면:

1. 전위 패턴 `LIKE 'prefix%`로 변환 가능한지 검토
2. 생성 컬럼(generated column)에 결과를 저장하고 인덱스 부여
3. PostgreSQL: `pg_trgm` + GIN 인덱스
4. 전문 검색이 필요하면 tsvector/tsquery(Full-Text Search)로 이동

---

**지난 글:** [표준 문자열 함수](/posts/sql-string-functions-standard/)

**다음 글:** [날짜·시간 함수와 INTERVAL 연산](/posts/sql-datetime-functions-interval/)

<br>
읽어주셔서 감사합니다. 😊
