---
title: "표준 문자열 함수"
description: "SQL 표준 문자열 함수(SUBSTRING, TRIM, POSITION, CONCAT, UPPER/LOWER 등)와 DB별 차이, 실무 조합 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-03"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["sql", "string-functions", "substring", "trim", "concat", "position", "lpad", "replace", "string-agg"]
featured: false
draft: false
---

[지난 글](/posts/sql-coalesce-nullif/)에서 NULL 처리 함수를 다뤘다. 이번에는 SQL 표준 문자열 함수를 체계적으로 정리한다. 문자열 조작은 데이터 정제·마스킹·포맷 변환에 필수이며, 함수 이름과 인자 순서가 DB마다 조금씩 달라 혼란스러울 수 있다.

---

## 길이 함수

`CHAR_LENGTH(s)`는 문자 수를 반환한다. 한글 1자는 `CHAR_LENGTH` 기준 1이지만 `LENGTH`나 `OCTET_LENGTH` 기준으로는 UTF-8 인코딩에서 3바이트다.

```sql
SELECT
    CHAR_LENGTH('안녕'),   -- 2 (문자 수)
    LENGTH('안녕'),        -- 6 (UTF-8 바이트)
    OCTET_LENGTH('hello'); -- 5 (바이트)
```

MySQL에서는 `CHAR_LENGTH`와 `CHARACTER_LENGTH`가 동의어다. Oracle은 `LENGTH`가 문자 수를 반환하고 `LENGTHB`가 바이트 수다.

---

## 부분 문자열 — SUBSTRING

`SUBSTRING(s FROM pos FOR len)` 또는 `SUBSTRING(s, pos, len)`으로 사용한다. pos는 1부터 시작한다.

```sql
-- 이메일 @ 앞부분(로컬 파트) 추출
SELECT
    SUBSTRING(email, 1, POSITION('@' IN email) - 1) AS local_part,
    SUBSTRING(email, POSITION('@' IN email) + 1)    AS domain
FROM users;
```

Oracle과 MySQL은 `SUBSTR(s, pos, len)` 형태도 지원한다. SQL Server는 `SUBSTRING(s, start, length)`만 지원한다.

---

## 트리밍 — TRIM

`TRIM(s)`는 양쪽 공백을 제거한다. 공백 외의 특정 문자를 제거하려면 `TRIM(LEADING char FROM s)` 구문을 쓴다.

```sql
SELECT
    TRIM('  hello  '),              -- 'hello'
    TRIM(LEADING '0' FROM '00123'), -- '123'
    LTRIM('   left'),               -- 'left'
    RTRIM('right   ');              -- 'right'
```

입력 데이터 정제 시 `TRIM(NULLIF(TRIM(col), ''))` 패턴으로 공백 문자열과 NULL을 동시에 정규화하는 것이 유용하다.

---

## 대소문자 변환

```sql
SELECT
    UPPER('hello sql'),  -- 'HELLO SQL'
    LOWER('HELLO SQL'),  -- 'hello sql'
    INITCAP('hello sql') -- 'Hello Sql' (PostgreSQL/Oracle)
```

대소문자 무관 검색은 `LOWER(col) = LOWER(input)` 또는 적절한 대조(collation) 설정으로 처리한다. 인덱스를 살리려면 표현식 인덱스(`CREATE INDEX ON t (LOWER(col))`)를 고려한다.

---

## 검색 및 위치

`POSITION(needle IN haystack)`은 첫 등장 위치를 1 기반으로 반환한다. 없으면 0을 반환한다.

```sql
-- @ 위치 찾기
SELECT POSITION('@' IN email) AS at_pos FROM users;

-- PostgreSQL 전용: 위치와 개수 모두
SELECT
    STRPOS(email, '@')    AS at_pos,
    STRPOS(email, '@', 2) -- 두 번째 @ 위치 (미지원 함수)
FROM users;
```

Oracle은 `INSTR(s, needle, start_pos, occurrence)`, SQL Server는 `CHARINDEX(needle, s, start_pos)`를 쓴다.

---

## 치환 — REPLACE, TRANSLATE

`REPLACE(s, from_str, to_str)`는 문자열을 치환한다. `TRANSLATE(s, from_chars, to_chars)`는 문자 단위로 매핑한다.

```sql
-- 전화번호 숫자만 남기기
SELECT TRANSLATE(phone, '- .()', '     ') FROM contacts;
-- '-', ' ', '.', '(', ')' 각각을 공백으로 치환
-- 공백 제거는 추가로 TRIM 또는 REPLACE 필요
```

---

## 패딩 — LPAD, RPAD

숫자를 고정 자릿수 문자열로 포맷할 때 유용하다.

```sql
-- 주문번호를 8자리로 제로 패딩
SELECT LPAD(order_id::text, 8, '0') AS order_no FROM orders;
-- order_id=123 → '00000123'
```

---

## 연결과 STRING_AGG

```sql
-- 이름 마스킹 및 전화번호 포맷
SELECT
    LEFT(name, 1) || REPEAT('*', CHAR_LENGTH(name) - 1) AS masked,
    LEFT(phone, 3) || '-' || SUBSTRING(phone, 4, 4)
        || '-' || RIGHT(phone, 4) AS phone_fmt
FROM users;
```

그룹별 문자열 집계는 `STRING_AGG` (PostgreSQL/SQL Server), `GROUP_CONCAT` (MySQL/MariaDB), `LISTAGG` (Oracle)로 한다.

```sql
-- 부서별 직원 이름 목록 (표준 SQL:2016)
SELECT
    dept,
    STRING_AGG(emp_name, ', ' ORDER BY emp_name) AS members
FROM employees
GROUP BY dept;
```

![문자열 함수 분류 개요](/assets/posts/sql-string-functions-standard-overview.svg)

![문자열 함수 실전 조합](/assets/posts/sql-string-functions-standard-code.svg)

---

## DB별 주요 차이

| 기능 | PostgreSQL | MySQL | Oracle | SQL Server |
|---|---|---|---|---|
| 연결 | `||` | `CONCAT()` | `||` | `+` |
| 부분 문자열 | `SUBSTRING` | `SUBSTR` | `SUBSTR` | `SUBSTRING` |
| 위치 | `STRPOS` | `LOCATE` | `INSTR` | `CHARINDEX` |
| 집계 연결 | `STRING_AGG` | `GROUP_CONCAT` | `LISTAGG` | `STRING_AGG` |

MySQL에서 `||`는 논리 OR이므로 문자열 연결에는 `CONCAT()`을 써야 한다. 이식성이 중요할 때는 `CONCAT()`을 기본으로 선택한다.

---

**지난 글:** [COALESCE와 NULLIF — NULL 처리 도구](/posts/sql-coalesce-nullif/)

**다음 글:** [LIKE, SIMILAR TO, 정규식 패턴 매칭](/posts/sql-regex-similar-to/)

<br>
읽어주셔서 감사합니다. 😊
