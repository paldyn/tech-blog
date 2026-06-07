---
title: "데이터 타입 완전 정리 — 숫자, 문자열, 불리언"
description: "SQL 숫자 타입(INTEGER, NUMERIC, FLOAT)과 문자열 타입(CHAR, VARCHAR, TEXT), 불리언의 특성과 선택 기준, FLOAT 오차 함정을 이해합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["SQL", "데이터타입", "NUMERIC", "VARCHAR", "BOOLEAN"]
featured: false
draft: false
---

[지난 글](/posts/sql-create-table-basics/)에서 `CREATE TABLE`의 전체 구조를 살펴봤다. 열을 선언할 때 데이터 타입을 잘못 선택하면 성능 저하, 데이터 오류, 스토리지 낭비로 이어진다. 이번에는 숫자, 문자열, 불리언 타입을 각각 언제, 어떻게 써야 하는지 정리한다.

## 숫자 타입

### 정수형

```sql
-- SMALLINT: -32,768 ~ 32,767 (2바이트)
상태코드  SMALLINT  -- 몇 가지 상태값만 있을 때

-- INTEGER / INT: -2,147,483,648 ~ 2,147,483,647 (4바이트)
주문ID    INTEGER   -- 일반적인 기본 키

-- BIGINT: -9.2 × 10¹⁸ ~ 9.2 × 10¹⁸ (8바이트)
로그ID    BIGINT    -- 수십억 건 이상 쌓이는 테이블
```

일반적으로 기본 키는 `INTEGER`에서 시작해 행 수가 20억을 넘을 것으로 예상되면 `BIGINT`로 간다. `SMALLINT`는 코드 테이블처럼 값의 범위가 작고 명확할 때 사용한다.

### 정밀 소수 — NUMERIC / DECIMAL

```sql
-- NUMERIC(precision, scale)
-- precision: 전체 자릿수, scale: 소수점 이하 자릿수
금액      NUMERIC(15, 2)   -- 최대 999,999,999,999,999.99
환율      NUMERIC(10, 6)   -- 최대 9999.999999
세율      NUMERIC(5, 4)    -- 0.0000 ~ 9.9999
```

`DECIMAL`과 `NUMERIC`은 SQL 표준에서 동의어다. 대부분의 DBMS에서 동일하게 동작한다.

### 부동소수점 — FLOAT / REAL / DOUBLE

```sql
-- 과학적 계산, 센서 데이터처럼 오차를 허용할 때만
온도      REAL             -- 4바이트 부동소수
측정값    DOUBLE PRECISION -- 8바이트 부동소수
```

**금액에는 절대 FLOAT을 사용하지 않는다.** `SELECT 0.1 + 0.2`가 `0.30000000000000004`를 반환하는 이유는 IEEE 754 이진 부동소수점 표현의 한계다. 이 오차가 수백만 건 집계에서 누적되면 정산이 틀려진다.

![숫자·문자열·불리언 타입 비교](/assets/posts/sql-data-types-numeric-string-bool-types.svg)

## 문자열 타입

### CHAR(n) — 고정 길이

```sql
국가코드   CHAR(2)    -- 'KR', 'US'
성별       CHAR(1)    -- 'M', 'F'
우편번호   CHAR(5)    -- '12345'
```

길이가 항상 일정한 코드값에 사용한다. `CHAR(10)`에 `'Hi'`를 저장하면 내부적으로 `'Hi        '`(공백 8개 패딩)로 저장된다. 검색 성능은 VARCHAR와 유사하거나 약간 유리하지만, 실제로는 VARCHAR를 쓰는 것이 대부분의 경우에 더 유연하다.

### VARCHAR(n) — 가변 길이

```sql
이름        VARCHAR(100)
이메일      VARCHAR(255)
주소        VARCHAR(500)
```

실제 입력한 길이만 저장한다. `n`은 **최대** 길이다. 한글 UTF-8은 한 글자당 3바이트이므로 `VARCHAR(300)`이면 한글 100자를 수용한다. 많은 DBMS에서 `VARCHAR` 길이를 크게 선언해도 실제 데이터가 짧으면 공간을 낭비하지 않는다.

### TEXT — 대용량 문자열

```sql
본문        TEXT    -- 블로그 글, JSON 등
에러메시지  TEXT
```

길이 제한이 없다. 단, `TEXT` 컬럼에는 인덱스를 걸 때 제한이 있다(MySQL: 앞 767바이트, PostgreSQL: 2,712바이트까지 B-tree). 전문 검색이 필요하면 Full-Text Index를 사용한다.

![FLOAT 오차 vs NUMERIC 정확도](/assets/posts/sql-data-types-numeric-string-bool-pitfalls.svg)

## 불리언 타입

```sql
-- PostgreSQL: 네이티브 BOOLEAN 지원
활성여부   BOOLEAN  DEFAULT TRUE
삭제됨     BOOLEAN  DEFAULT FALSE

-- MySQL: TINYINT(1) 내부 사용
is_active  TINYINT(1) DEFAULT 1  -- 1=TRUE, 0=FALSE

-- Oracle: NUMBER(1) 또는 CHAR(1) 관례
is_active  NUMBER(1) DEFAULT 1 CHECK (is_active IN (0,1))
```

표준 SQL은 `BOOLEAN`을 정의하지만 DBMS별 구현이 다르다. 이식성이 중요하면 `SMALLINT`나 `CHAR(1)`로 맞추고, 특정 DBMS에 묶인 코드라면 해당 DBMS의 네이티브 타입을 활용한다.

## 타입 선택 체크리스트

| 데이터 성격 | 추천 타입 |
|---|---|
| 기본 키 (20억 미만) | INTEGER |
| 기본 키 (20억 이상) | BIGINT |
| 금액, 수량, 세율 | NUMERIC(p,s) |
| 과학 측정값, 좌표 | DOUBLE PRECISION |
| 짧고 고정된 코드 | CHAR(n) |
| 이름, 이메일, URL | VARCHAR(n) |
| 본문, JSON, 로그 | TEXT |
| 참/거짓 플래그 | BOOLEAN (DBMS 지원 확인) |

---

**지난 글:** [CREATE TABLE 기초 — 테이블 설계의 시작](/posts/sql-create-table-basics/)

**다음 글:** [데이터 타입 완전 정리 — 날짜와 시간](/posts/sql-data-types-datetime/)

<br>
읽어주셔서 감사합니다. 😊
