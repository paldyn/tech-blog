---
title: "윈도우 프레임 — ROWS BETWEEN과 RANGE BETWEEN"
description: "ROWS, RANGE, GROUPS 세 가지 윈도우 프레임 모드의 차이, PRECEDING·FOLLOWING·CURRENT ROW 키워드, 동점 행 처리를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-03"
archiveOrder: 5
type: "knowledge"
category: "SQL"
tags: ["sql", "window-function", "frame", "rows-between", "range-between", "preceding", "following", "current-row"]
featured: false
draft: false
---

[지난 글](/posts/sql-partition-by-order-by/)에서 `PARTITION BY`와 `ORDER BY`의 역할을 구분했다. 이번에는 윈도우 프레임(frame) — `ROWS BETWEEN ... AND ...`와 `RANGE BETWEEN ... AND ...` — 의 동작 방식을 상세히 다룬다. 프레임은 현재 행을 기준으로 집계·계산에 포함할 행 범위를 정의한다.

---

## 프레임이란

윈도우 함수가 계산할 때 "현재 행 주변의 몇 행까지 포함할지"를 지정하는 것이 프레임이다. `ORDER BY`가 없으면 프레임 절은 의미가 없다(순위 함수에는 아예 적용되지 않는다).

```sql
function() OVER (
    [PARTITION BY ...]
    ORDER BY col
    ROWS|RANGE BETWEEN start AND end
)
```

프레임 절이 없을 때 집계 윈도우의 기본 프레임은 `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`다.

---

## ROWS 모드 — 물리적 행 수

`ROWS BETWEEN N PRECEDING AND M FOLLOWING`은 현재 행 위치를 기준으로 N행 위부터 M행 아래까지를 포함한다. **값이 아니라 물리적 행 번호**를 기준으로 하므로 동일한 ORDER BY 값을 가진 행들도 각각 다른 프레임을 갖는다.

![ROWS vs RANGE 비교](/assets/posts/sql-window-frame-rows-range-visual.svg)

```sql
-- 직전 1행 + 현재 행의 합 (ROWS 기준)
SELECT
    score,
    SUM(score) OVER (
        ORDER BY score
        ROWS BETWEEN 1 PRECEDING AND CURRENT ROW
    ) AS sum_rows
FROM test_scores;
```

score=20인 두 번째 행: 직전 행(score=10)과 현재(score=20)의 합 = 30

score=20인 세 번째 행: 직전 행(score=20)과 현재(score=20)의 합 = 40

---

## RANGE 모드 — 논리적 값 범위

`RANGE BETWEEN N PRECEDING AND M FOLLOWING`은 ORDER BY 컬럼의 값 기준으로 `[현재값 - N, 현재값 + M]` 범위 안의 모든 행을 포함한다. **동일한 ORDER BY 값을 가진 행들(피어, peer)은 항상 같은 프레임을 갖는다.**

`RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`에서 `CURRENT ROW`는 현재 행과 같은 값의 행 전체를 포함한다. 이로 인해 ORDER BY 값이 중복되면 같은 값을 가진 모든 행이 동일한 누적 합계를 보인다.

```sql
-- RANGE 기준: ORDER BY 값 ±10 범위
SELECT
    score,
    SUM(score) OVER (
        ORDER BY score
        RANGE BETWEEN 10 PRECEDING AND CURRENT ROW
    ) AS sum_range
FROM test_scores;
-- score=20인 두 행 모두: 10+20+20=50 (값 10~20 범위)
```

RANGE의 N 값은 숫자형 또는 날짜/인터벌 타입이어야 한다. 문자열 컬럼에는 RANGE N을 쓸 수 없다.

---

## 프레임 경계 키워드

![프레임 경계 패턴](/assets/posts/sql-window-frame-rows-range-code.svg)

| 키워드 | 의미 |
|---|---|
| `UNBOUNDED PRECEDING` | 파티션의 첫 번째 행 |
| `N PRECEDING` | 현재 행보다 N(행 수 또는 값) 앞 |
| `CURRENT ROW` | 현재 행 (RANGE: 동점 행 전체 포함) |
| `N FOLLOWING` | 현재 행보다 N 뒤 |
| `UNBOUNDED FOLLOWING` | 파티션의 마지막 행 |

시작 경계는 끝 경계보다 앞이어야 한다. `BETWEEN 3 PRECEDING AND 1 PRECEDING`처럼 현재 행 이전 구간만 포함하는 것도 가능하다.

---

## GROUPS 모드 (SQL:2011)

`GROUPS` 모드는 피어 그룹(동일 ORDER BY 값을 공유하는 행들의 묶음) 수를 기준으로 프레임을 정한다. `GROUPS BETWEEN 1 PRECEDING AND CURRENT ROW`는 직전 피어 그룹과 현재 피어 그룹을 포함한다.

```sql
-- PostgreSQL 11+
SELECT
    score,
    SUM(score) OVER (
        ORDER BY score
        GROUPS BETWEEN 1 PRECEDING AND CURRENT ROW
    ) AS sum_groups
FROM test_scores;
```

GROUPS 모드는 PostgreSQL 11+, DuckDB가 지원하며, MySQL, Oracle은 미지원이다.

---

## LAST_VALUE의 함정

기본 프레임(`RANGE UNBOUNDED PRECEDING AND CURRENT ROW`)에서 `LAST_VALUE`를 쓰면 파티션의 마지막 값이 아니라 현재 행 자신의 값이 반환된다. 파티션 끝까지 포함하려면 프레임을 명시해야 한다.

```sql
-- 잘못된 예: 항상 현재 행 값이 나옴
SELECT
    sale_date, amount,
    LAST_VALUE(amount) OVER (ORDER BY sale_date) AS wrong
FROM daily_sales;

-- 올바른 예: 파티션 끝까지 포함
SELECT
    sale_date, amount,
    LAST_VALUE(amount) OVER (
        ORDER BY sale_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS correct_last
FROM daily_sales;
```

---

## 모드 선택 기준

- **ROWS**: 이동 평균, 이동 합계 등 정확히 N행을 다룰 때. 동점 행이 있어도 각자 다른 값이 나오길 원할 때.
- **RANGE**: 날짜/값 범위 기반 집계(최근 7일, ±10점 범위). 동점 행을 같은 그룹으로 취급해야 할 때.
- **GROUPS**: 동점 그룹 수 기준의 특수 사례, 지원 DB 확인 필요.

---

**지난 글:** [PARTITION BY와 ORDER BY의 역할](/posts/sql-partition-by-order-by/)

**다음 글:** [CASE 표현식 — Simple과 Searched CASE](/posts/sql-case-expression/)

<br>
읽어주셔서 감사합니다. 😊
