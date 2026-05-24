---
title: "SQLite 타입 어파이니티 — 유연한 타입 시스템 이해하기"
description: "SQLite의 동적 타입 시스템, 5가지 어파이니티 규칙, 스토리지 클래스, 타입 불일치로 인한 함정, STRICT 모드까지 상세히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["SQLite", "타입어파이니티", "동적타입", "STRICT", "스토리지클래스"]
featured: false
draft: false
---

[지난 글](/posts/sqlite-single-file-page/)에서 SQLite 파일의 B-Tree 구조를 살펴봤다. 이번에는 SQLite를 처음 사용하는 사람이 가장 당혹스러워하는 특징인 **타입 어파이니티(Type Affinity)** 를 다룬다. SQLite는 다른 DB와 달리 열에 선언된 타입이 절대적 제약이 아닌 **권장(affinity)** 으로만 작동한다.

## SQLite의 동적 타입

대부분의 SQL 데이터베이스는 "정적 타입"을 사용한다. `INTEGER` 열에 텍스트를 삽입하면 오류가 발생한다. SQLite는 다르다. **값 자체**가 타입을 갖고, 열 선언은 값을 어떻게 변환할지 "경향"을 지시한다.

```sql
-- SQLite에서 이 모든 삽입이 오류 없이 동작한다
CREATE TABLE demo (
    a INTEGER,
    b TEXT,
    c REAL
);
INSERT INTO demo VALUES (42,    42,    42   );  -- 정수 -> INTEGER, TEXT, REAL
INSERT INTO demo VALUES ('안녕', '안녕', '안녕');  -- 텍스트 -> TEXT로 저장
INSERT INTO demo VALUES (3.14,  3.14,  3.14 );  -- 실수

-- typeof()로 실제 저장 타입 확인
SELECT a, typeof(a), b, typeof(b), c, typeof(c)
FROM demo;
-- 42|integer|42|text|42.0|real
-- 안녕|text|안녕|text|안녕|text
-- 3|integer|3.14|text|3.14|real  ← 3.14가 a에서 정수 3으로 잘림!
```

## 5가지 어파이니티

SQLite는 컬럼 선언 타입 문자열을 분석해 5가지 어파이니티 중 하나로 분류한다.

![SQLite 타입 어파이니티 규칙](/assets/posts/sqlite-type-affinity-rules.svg)

### 어파이니티 결정 규칙 (우선순위 순)

1. 타입명에 `INT`가 포함되면 → **INTEGER**
2. `CHAR`, `CLOB`, `TEXT`가 포함되면 → **TEXT**
3. `BLOB` 또는 타입 미지정이면 → **BLOB (NONE)**
4. `REAL`, `FLOA`, `DOUB`이 포함되면 → **REAL**
5. 위 해당 없음 (DECIMAL, NUMERIC, BOOLEAN, DATE 등) → **NUMERIC**

```sql
-- 어파이니티 분류 예시
CREATE TABLE affinity_demo (
    a  INTEGER,          -- INTEGER affinity
    b  TINYINT,          -- INTEGER (INT 포함)
    c  VARCHAR(100),     -- TEXT (CHAR 포함)
    d  CLOB,             -- TEXT
    e  BLOB,             -- BLOB
    f  REAL,             -- REAL
    g  FLOAT,            -- REAL (FLOA 포함)
    h  NUMERIC,          -- NUMERIC
    i  DECIMAL(10,2),    -- NUMERIC
    j  BOOLEAN,          -- NUMERIC (FALSE=0, TRUE=1)
    k  DATE,             -- NUMERIC (ISO 문자열 권장)
    l  DATETIME,         -- NUMERIC
    m,                   -- BLOB (타입 미지정)
    n  XYZA              -- NUMERIC (규칙 1~4 미해당)
);
```

## 스토리지 클래스 vs 어파이니티

중요한 구분: **어파이니티**는 컬럼 수준 속성이고, **스토리지 클래스**는 실제 저장된 값의 타입이다.

![SQLite 스토리지 클래스와 비교 규칙](/assets/posts/sqlite-type-affinity-compare.svg)

### 어파이니티별 변환 동작

```sql
-- INTEGER 어파이니티
INSERT INTO t (int_col) VALUES ('123');  -- '123' -> 123 (정수 변환)
INSERT INTO t (int_col) VALUES ('abc');  -- 'abc' 변환 불가 -> 'abc' TEXT로 저장
INSERT INTO t (int_col) VALUES (3.0);   -- 3.0 -> 3 (정수 표현 가능하면 변환)
INSERT INTO t (int_col) VALUES (3.1);   -- 3.1 -> 3.1 REAL 유지

-- TEXT 어파이니티
INSERT INTO t (text_col) VALUES (42);   -- 42 -> '42' (텍스트 변환)
INSERT INTO t (text_col) VALUES (3.14); -- 3.14 -> '3.14' (텍스트 변환)

-- NUMERIC 어파이니티 (가장 유연)
INSERT INTO t (num_col) VALUES ('3');   -- '3' -> 3 INTEGER
INSERT INTO t (num_col) VALUES ('3.1'); -- '3.1' -> 3.1 REAL
INSERT INTO t (num_col) VALUES ('abc'); -- 변환 불가 -> 'abc' TEXT 유지
```

## 타입 불일치가 만드는 함정

### 정렬 오류

TEXT 어파이니티 컬럼에 숫자를 저장하면 사전순(lexicographic)으로 정렬된다.

```sql
CREATE TABLE scores (val TEXT);
INSERT INTO scores VALUES ('9');
INSERT INTO scores VALUES ('10');
INSERT INTO scores VALUES ('100');
INSERT INTO scores VALUES ('42');

SELECT val FROM scores ORDER BY val;
-- 결과: 10, 100, 42, 9  ← 사전순! 수치 순이 아님

-- 해결 1: CAST로 수치 정렬
SELECT val FROM scores ORDER BY CAST(val AS INTEGER);
-- 결과: 9, 10, 42, 100

-- 해결 2: INTEGER 어파이니티 컬럼 사용
CREATE TABLE scores2 (val INTEGER);
```

### Boolean 저장

SQLite에는 BOOLEAN 타입이 없다. NUMERIC 어파이니티로 처리되어 `0`(거짓)과 `1`(참)로 저장된다.

```sql
CREATE TABLE flags (is_active BOOLEAN);
INSERT INTO flags VALUES (TRUE);   -- 1로 저장
INSERT INTO flags VALUES (FALSE);  -- 0으로 저장
INSERT INTO flags VALUES (1);      -- 1
INSERT INTO flags VALUES (0);      -- 0

SELECT is_active, typeof(is_active) FROM flags;
-- 1|integer
-- 0|integer

-- Boolean 비교
SELECT * FROM flags WHERE is_active = TRUE;   -- WHERE is_active = 1과 동일
SELECT * FROM flags WHERE is_active IS TRUE;  -- SQLite 3.23+ 지원
```

### DATE/DATETIME

SQLite는 날짜 타입도 없다. ISO 8601 텍스트 문자열(`'2026-05-25'`), Julian Day 실수, Unix 타임스탬프 정수 중 하나를 선택해 일관되게 써야 한다.

```sql
-- ISO 8601 텍스트 방식 (권장)
CREATE TABLE events (
    id         INTEGER PRIMARY KEY,
    event_name TEXT    NOT NULL,
    event_date TEXT    NOT NULL  -- 'YYYY-MM-DD' 형식
);
INSERT INTO events VALUES (1, '회의', '2026-05-25');

-- 날짜 함수 활용
SELECT event_name,
       date(event_date)                         AS 날짜,
       strftime('%Y년 %m월 %d일', event_date)   AS 한국어형식
FROM events
WHERE event_date >= date('now', '-7 days');
```

## STRICT 모드 (SQLite 3.37+)

어파이니티의 유연성이 버그로 이어진다면 `STRICT` 키워드로 엄격한 타입 체크를 적용할 수 있다.

```sql
-- STRICT 테이블 생성
CREATE TABLE products (
    id    INTEGER PRIMARY KEY,
    name  TEXT    NOT NULL,
    price REAL    NOT NULL,
    stock INTEGER NOT NULL
) STRICT;

-- STRICT에서 허용되는 타입: INT, INTEGER, REAL, TEXT, BLOB, ANY
-- ANY는 모든 타입 허용 (BLOB affinity와 유사)

-- 타입 불일치 → 즉시 오류
INSERT INTO products VALUES (1, '사과', '비쌈', 10);
-- Error: cannot store TEXT value in REAL column products.price

-- STRICT + 기존 테이블 공존 가능
-- CREATE TABLE legacy (...);         -- 기존 어파이니티 방식
-- CREATE TABLE strict_t (...) STRICT; -- 엄격 방식
```

## 실용 지침

1. **INTEGER PRIMARY KEY**: rowid의 별칭이 되므로 반드시 INTEGER로 선언
2. **날짜**: TEXT로 저장하되 ISO 8601 형식 통일
3. **돈(금액)**: REAL은 부동소수 오류가 있으므로 정수(센트)로 저장하거나 TEXT
4. **새 프로젝트**: STRICT 모드로 타입 안전성 확보
5. **typeof() 활용**: 디버깅 시 실제 저장 타입 확인

```sql
-- 데이터 품질 검사
SELECT rowid, col, typeof(col)
FROM my_table
WHERE typeof(col) != 'integer'  -- INTEGER 어파이니티지만 실제 다른 타입
  AND col IS NOT NULL;

-- CAST로 안전하게 변환
SELECT CAST(price_text AS REAL) AS price
FROM old_import_table
WHERE CAST(price_text AS REAL) IS NOT NULL;  -- 변환 실패 시 NULL
```

어파이니티는 SQLite가 다양한 언어·프레임워크의 타입을 거부감 없이 수용하기 위한 설계 선택이다. 이를 이해하면 예상치 못한 정렬·비교 오류를 피하고, 필요할 때 STRICT 모드를 적절히 활용할 수 있다.

---

**지난 글:** [SQLite 단일 파일 구조와 페이지 레이아웃](/posts/sqlite-single-file-page/)

**다음 글:** [SQLite WAL 모드와 롤백 저널 — 트랜잭션 내구성 구현](/posts/sqlite-wal-vs-rollback-journal/)

<br>
읽어주셔서 감사합니다. 😊
