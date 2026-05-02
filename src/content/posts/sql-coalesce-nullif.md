---
title: "COALESCE와 NULLIF — NULL 처리 도구"
description: "COALESCE로 NULL 기본값 치환, NULLIF로 특정 값을 NULL로 변환, NVL·IFNULL 등 비표준 함수와의 비교, NULL 연산 규칙을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-03"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["sql", "null", "coalesce", "nullif", "nvl", "ifnull", "null-handling", "three-valued-logic"]
featured: false
draft: false
---

[지난 글](/posts/sql-case-expression/)에서 CASE 표현식으로 조건 분기를 처리하는 방법을 다뤘다. 이번에는 NULL을 다루는 전용 함수—`COALESCE`, `NULLIF`, 그리고 비표준인 `NVL`, `IFNULL`—를 살펴본다. SQL에서 NULL은 "알 수 없는 값"이며, 일반 산술/비교 연산과 다르게 동작하기 때문에 전용 처리 도구가 필요하다.

---

## NULL의 특성 — 3값 논리

SQL NULL은 `= NULL` 비교가 항상 UNKNOWN이다. `NULL = NULL`은 TRUE가 아니라 UNKNOWN이다.

```sql
-- NULL 비교 — 모두 UNKNOWN (WHERE 조건 불통과)
WHERE column = NULL      -- 항상 UNKNOWN
WHERE column != NULL     -- 항상 UNKNOWN
WHERE NULL = NULL        -- 항상 UNKNOWN

-- 올바른 NULL 검사
WHERE column IS NULL
WHERE column IS NOT NULL
```

산술 연산에서도 NULL이 포함되면 결과가 NULL이 된다. `100 + NULL = NULL`, `NULL * 0 = NULL`.

---

## COALESCE — 첫 번째 non-NULL 반환

`COALESCE(v1, v2, ..., vN)`은 인자를 순서대로 평가해 처음으로 NULL이 아닌 값을 반환한다. 모두 NULL이면 NULL을 반환한다.

![COALESCE NULLIF 흐름 비교](/assets/posts/sql-coalesce-nullif-flow.svg)

```sql
-- 연락처 우선순위: 휴대폰 → 유선전화 → 이메일 → '미입력'
SELECT
    customer_name,
    COALESCE(mobile, phone, email, '미입력') AS contact
FROM customers;
```

COALESCE는 **단락 평가(short-circuit)**를 한다. 첫 인자가 non-NULL이면 나머지를 평가하지 않는다. 따라서 뒤 인자에 비용이 큰 서브쿼리가 있어도 앞이 non-NULL이면 실행되지 않는다.

COALESCE는 SQL:1999 표준이며 모든 주요 RDBMS에서 지원한다. Oracle의 `NVL(a, b)`, MySQL의 `IFNULL(a, b)`는 인자가 두 개로 제한되며 동일 기능이다.

---

## NULLIF — 특정 값을 NULL로 변환

`NULLIF(v1, v2)`는 v1이 v2와 같으면 NULL을 반환하고, 다르면 v1을 반환한다.

```sql
-- v1 = v2 → NULL
-- v1 ≠ v2 → v1
SELECT NULLIF(10, 10);  -- NULL
SELECT NULLIF(10, 0);   -- 10
```

가장 흔한 사용 사례는 **0 나누기 방지**다.

```sql
-- cost가 0이면 NULL 반환 → 나누기 오류 방지
SELECT
    order_id,
    revenue / NULLIF(cost, 0) AS margin_ratio
FROM orders;
```

또 다른 사용 사례는 **빈 문자열을 NULL로 통일**하는 것이다.

```sql
-- 입력값 정규화: '' → NULL
UPDATE contacts
SET email = NULLIF(TRIM(email), '');
```

---

## 실전 패턴

![NULL 처리 실전 패턴](/assets/posts/sql-coalesce-nullif-code.svg)

```sql
-- NULL 비율 계산 (분모가 0이면 NULL 보호)
SELECT
    COUNT(email) * 100.0
    / NULLIF(COUNT(*), 0) AS email_fill_rate
FROM customers;

-- 복합: 빈 문자열과 NULL을 모두 기본값으로 처리
SELECT
    COALESCE(NULLIF(TRIM(nickname), ''), username, '익명')
        AS display_name
FROM users;
```

`COALESCE(NULLIF(...))` 조합은 빈 문자열과 NULL을 동시에 처리하는 관용 표현이다.

---

## NVL2 (Oracle 전용)

Oracle에는 `NVL2(expr, not_null_val, null_val)`도 있다. expr이 NULL이 아닌 경우와 NULL인 경우 각각 다른 값을 반환한다.

```sql
-- Oracle NVL2: is_email_registered 컬럼 생성
SELECT NVL2(email, 'Y', 'N') AS has_email FROM customers;
-- Searched CASE와 동일
-- CASE WHEN email IS NOT NULL THEN 'Y' ELSE 'N' END
```

---

## NULL과 집계 함수

집계 함수는 기본적으로 NULL을 무시한다. `COUNT(*)` 만이 NULL 행을 포함한다.

```sql
SELECT
    COUNT(*)      AS total_rows,  -- NULL 포함
    COUNT(email)  AS email_cnt,   -- NULL 제외
    SUM(amount)   AS total,       -- NULL 행 무시
    AVG(score)    AS avg_score    -- NULL 행 무시 (분모도 null 제외)
FROM orders;
```

평균에서 NULL과 0은 다른 의미를 가진다. NULL은 "값 없음"이고 0은 "0이라는 값"이다. `AVG`가 NULL을 제외하고 계산하므로 "점수 없음"과 "0점"을 구분하려면 저장 시 NULL vs 0을 명확히 해야 한다.

---

## 3값 논리와 WHERE/HAVING

UNKNOWN이 WHERE·HAVING에서 나오면 해당 행은 결과에서 제외된다.

```sql
-- deleted_at이 NULL인 행도 아래 조건에서 제외됨
WHERE deleted_at != '2026-01-01'
-- 올바른 방법: NULL 명시 처리
WHERE deleted_at != '2026-01-01' OR deleted_at IS NULL
```

---

**지난 글:** [CASE 표현식 — Simple과 Searched CASE](/posts/sql-case-expression/)

**다음 글:** [표준 문자열 함수](/posts/sql-string-functions-standard/)

<br>
읽어주셔서 감사합니다. 😊
