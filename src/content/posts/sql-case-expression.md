---
title: "CASE 표현식 — Simple과 Searched CASE"
description: "SQL CASE 표현식의 두 형태(Simple·Searched), 조건부 집계, 피벗, ORDER BY 정렬 제어, DECODE와의 비교, 주의 사항을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-03"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["sql", "case-expression", "conditional", "pivot", "aggregate", "searched-case", "simple-case", "decode"]
featured: false
draft: false
---

[지난 글](/posts/sql-window-frame-rows-range/)에서 윈도우 프레임의 ROWS와 RANGE 모드를 구분했다. 이번에는 SQL에서 조건 분기를 처리하는 핵심 도구인 `CASE` 표현식을 다룬다. CASE는 프로그래밍 언어의 if-else와 같은 역할이지만, **값을 반환하는 표현식**이라는 점에서 SQL의 모든 절에 삽입할 수 있다.

---

## 두 가지 형태

SQL CASE 표현식에는 **Simple CASE**와 **Searched CASE** 두 형태가 있다.

![CASE 두 가지 형태 비교](/assets/posts/sql-case-expression-types.svg)

**Simple CASE**: `CASE expr WHEN value1 THEN result1 ...` 형태. 앞의 표현식을 각 WHEN 값과 등호로 비교한다. 범위 비교나 IS NULL 같은 조건은 쓸 수 없다.

```sql
SELECT
    order_id,
    CASE status
        WHEN 'P' THEN '결제완료'
        WHEN 'S' THEN '배송중'
        WHEN 'D' THEN '배송완료'
        ELSE '기타'
    END AS status_label
FROM orders;
```

**Searched CASE**: `CASE WHEN condition1 THEN result1 ...` 형태. 각 WHEN마다 독립적인 불리언 조건을 쓸 수 있어 범위·IN·IS NULL 등 모든 비교가 가능하다.

```sql
SELECT
    score,
    CASE
        WHEN score >= 90 THEN 'A'
        WHEN score >= 80 THEN 'B'
        WHEN score >= 70 THEN 'C'
        WHEN score IS NULL THEN '미응시'
        ELSE 'F'
    END AS grade
FROM exam;
```

---

## 단락 평가(Short-circuit Evaluation)

CASE는 위에서 아래로 평가하며 첫 번째 참인 WHEN에서 멈춘다. 나머지 WHEN은 평가하지 않는다. 이를 이용해 0 나누기나 함수 오류를 회피할 수 있다.

```sql
-- score가 0일 때 나누기 오류 방지
SELECT
    CASE
        WHEN total_score = 0 THEN 0
        ELSE (part_score * 100.0 / total_score)
    END AS ratio
FROM scores;
```

---

## 조건부 집계 (Conditional Aggregation)

`CASE`를 집계 함수 안에 넣으면 조건을 만족하는 행만 집계할 수 있다. 이른바 **피벗(pivot)** 패턴이다.

![조건부 집계 및 ORDER BY 제어](/assets/posts/sql-case-expression-code.svg)

```sql
-- 지역별 매출을 열(column)로 피벗
SELECT
    sale_month,
    SUM(CASE WHEN region = '서울' THEN amount ELSE 0 END) AS seoul,
    SUM(CASE WHEN region = '부산' THEN amount ELSE 0 END) AS busan,
    SUM(CASE WHEN region = '대구' THEN amount ELSE 0 END) AS daegu
FROM sales
GROUP BY sale_month;
```

`COUNT`를 쓸 때는 `ELSE NULL`을 사용한다. `COUNT`는 NULL을 세지 않으므로 조건을 만족하는 행 수를 얻을 수 있다.

```sql
-- ELSE NULL: 조건 불만족 행은 COUNT에서 제외
SELECT
    COUNT(CASE WHEN status = 'Y' THEN 1 END) AS active_cnt,
    COUNT(CASE WHEN status = 'N' THEN 1 END) AS inactive_cnt
FROM users;
```

---

## ORDER BY 내 CASE — 사용자 정의 정렬

CASE는 ORDER BY 절에도 쓸 수 있어 임의 순서로 결과를 정렬할 수 있다.

```sql
SELECT order_id, status, created_at
FROM orders
ORDER BY
    CASE status
        WHEN '긴급' THEN 1
        WHEN '일반' THEN 2
        ELSE 3
    END,
    created_at DESC;
```

---

## GROUP BY 내 CASE — 그룹 생성

GROUP BY 절에도 CASE를 넣어 동적으로 그룹을 만들 수 있다.

```sql
-- 점수 구간별 집계
SELECT
    CASE
        WHEN score >= 90 THEN '90점대 이상'
        WHEN score >= 70 THEN '70~89점'
        ELSE '70점 미만'
    END AS score_group,
    COUNT(*) AS cnt,
    AVG(score) AS avg_score
FROM exam
GROUP BY
    CASE
        WHEN score >= 90 THEN '90점대 이상'
        WHEN score >= 70 THEN '70~89점'
        ELSE '70점 미만'
    END;
```

---

## DECODE (Oracle 전용)

Oracle에는 `DECODE` 함수가 있어 Simple CASE와 유사한 동작을 한다. 단, NULL 비교가 가능하고(`=`가 아닌 내부 비교) 더 간결하다.

```sql
-- Oracle DECODE: Simple CASE의 함수 버전
SELECT DECODE(status, 'P', '결제', 'S', '배송', '기타')
FROM orders;
```

표준 CASE가 모든 DB에서 동작하므로 DECODE보다 CASE를 권장한다.

---

## 주의 사항

1. **반드시 `END`로 닫는다.** CASE는 `END`가 없으면 문법 오류다.
2. **ELSE 생략 시 NULL 반환.** 의도치 않은 NULL이 생기지 않도록 ELSE를 명시하는 습관을 들인다.
3. **THEN의 모든 반환값 타입이 호환되어야 한다.** 하나는 숫자, 다른 하나는 문자열이면 DB에 따라 암묵적 변환 또는 오류가 발생한다.
4. **중첩 CASE 가능하지만 가독성 주의.** 조건이 복잡해지면 CTE나 뷰로 분리한다.

---

**지난 글:** [윈도우 프레임 — ROWS BETWEEN과 RANGE BETWEEN](/posts/sql-window-frame-rows-range/)

**다음 글:** [COALESCE와 NULLIF — NULL 처리 도구](/posts/sql-coalesce-nullif/)

<br>
읽어주셔서 감사합니다. 😊
