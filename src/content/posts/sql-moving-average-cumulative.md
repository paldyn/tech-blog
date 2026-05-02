---
title: "이동 평균과 누적 합계"
description: "SUM OVER, AVG OVER와 윈도우 프레임을 사용해 누적 합계(running total), 이동 평균(moving average), 이동 합계를 계산하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-03"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["sql", "window-function", "moving-average", "running-total", "cumulative", "rows-between", "frame", "sum", "avg"]
featured: false
draft: false
---

[지난 글](/posts/sql-lag-lead/)에서 LAG/LEAD로 이전·다음 행의 값을 참조하는 방법을 살펴봤다. 이번에는 윈도우 프레임(frame)을 조합해 **누적 합계(running total)** 와 **이동 평균(moving average)** 을 계산하는 방법을 다룬다. 집계 함수에 `OVER` 절을 붙이면 프레임 내 합계·평균을 행마다 계산할 수 있다.

---

## 누적 합계 (Running Total)

누적 합계는 첫 행부터 현재 행까지의 값을 더한 결과다. 프레임을 `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`로 지정한다.

```sql
SELECT
    sale_date, amount,
    SUM(amount) OVER (
        ORDER BY sale_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_total
FROM daily_sales;
```

`ORDER BY`만 있고 프레임이 없으면, 집계 함수는 기본적으로 `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`를 사용한다. 날짜가 모두 다를 때는 결과가 같지만, 동일 날짜가 있으면 같은 날짜의 모든 행을 포함하므로 `ROWS` 프레임과 결과가 달라진다. 항상 `ROWS`를 명시하는 것이 안전하다.

![누적 합계와 이동 평균 예시](/assets/posts/sql-moving-average-cumulative-visual.svg)

---

## 이동 평균 (Moving Average)

이동 평균은 최근 N개 행의 평균이다. 프레임을 `ROWS BETWEEN N-1 PRECEDING AND CURRENT ROW`로 설정한다. 3일 이동 평균은 `2 PRECEDING AND CURRENT ROW`.

![이동 평균·이동 합계 SQL](/assets/posts/sql-moving-average-cumulative-code.svg)

```sql
SELECT
    sale_date, amount,
    SUM(amount) OVER (
        ORDER BY sale_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_total,
    AVG(amount) OVER (
        ORDER BY sale_date
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) AS ma3,
    SUM(amount) OVER (
        ORDER BY sale_date
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) AS sum3
FROM daily_sales;
```

이동 평균은 초반 행에서 프레임이 N개를 채우지 못하면 실제로 있는 행만으로 계산한다. 1행은 자기 자신만, 2행은 2개 행으로 평균을 낸다. 이 동작이 의도에 맞지 않으면 행 번호로 필터링하거나 LAG로 N행 전 값 존재 여부를 확인해야 한다.

---

## PARTITION BY 조합 — 그룹별 누적 합계

여러 카테고리가 섞인 데이터에서 카테고리별로 독립 누적을 구하려면 `PARTITION BY`를 추가한다.

```sql
SELECT
    category, sale_date, amount,
    SUM(amount) OVER (
        PARTITION BY category
        ORDER BY sale_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS category_running_total
FROM sales;
-- category가 바뀔 때마다 누적 합계가 0에서 재시작
```

---

## PRECEDING과 FOLLOWING

프레임 경계에는 `PRECEDING`(이전)과 `FOLLOWING`(이후) 모두 사용할 수 있다.

```sql
-- 중심 이동 평균: 앞 1행 + 현재 + 뒤 1행 (총 3행)
SELECT
    sale_date, amount,
    AVG(amount) OVER (
        ORDER BY sale_date
        ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING
    ) AS centered_ma
FROM daily_sales;
```

`1 FOLLOWING`을 쓰면 미래 값을 포함한다. 예측 모델이나 스무딩에는 유용하지만 실시간 누적이 필요한 경우에는 적합하지 않다.

---

## 프레임 없이 ORDER BY만 사용 시 주의

`ORDER BY`만 있고 프레임 절이 없는 집계 윈도우 함수는 암묵적으로 `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`를 적용한다. RANGE는 동일한 ORDER BY 값을 가진 모든 행을 현재 행과 같은 피어(peer)로 취급한다.

```sql
-- 같은 날짜가 두 행이면 RANGE는 두 행 모두를 '현재' 범위에 포함
-- ROWS는 물리적 위치로 처리하므로 행마다 값이 다를 수 있음
SELECT
    sale_date, amount,
    SUM(amount) OVER (ORDER BY sale_date) AS range_default,
    SUM(amount) OVER (
        ORDER BY sale_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS rows_explicit
FROM daily_sales;
```

동일 날짜가 있을 때 두 컬럼의 값이 달라진다. 데이터에 중복 날짜가 없다고 확신하지 않는 한 `ROWS`를 명시한다.

---

## 실무 패턴 정리

| 패턴 | 프레임 설정 |
|---|---|
| 전체 누적 합계 | `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` |
| 최근 N일 이동 합계 | `ROWS BETWEEN N-1 PRECEDING AND CURRENT ROW` |
| 중심 이동 평균 | `ROWS BETWEEN N PRECEDING AND N FOLLOWING` |
| 전체 합계(분모용) | `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING` |
| 최솟값·최댓값 누적 | `MIN`/`MAX` + `UNBOUNDED PRECEDING` |

---

**지난 글:** [LAG / LEAD — 이전·다음 행 참조](/posts/sql-lag-lead/)

**다음 글:** [PARTITION BY와 ORDER BY의 역할](/posts/sql-partition-by-order-by/)

<br>
읽어주셔서 감사합니다. 😊
