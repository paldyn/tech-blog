---
title: "LAG / LEAD — 이전·다음 행 참조"
description: "LAG, LEAD 함수의 구문과 인자(오프셋, 기본값), 전일 대비 변화량·등락률 계산, FIRST_VALUE/LAST_VALUE와의 비교를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-03"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["sql", "window-function", "lag", "lead", "offset", "first-value", "last-value", "delta"]
featured: false
draft: false
---

[지난 글](/posts/sql-row-number-rank-dense-rank/)에서 순위 함수 ROW_NUMBER, RANK, DENSE_RANK를 살펴봤다. 이번에는 **오프셋 함수(offset function)** 인 `LAG`와 `LEAD`를 다룬다. 같은 결과셋 안에서 이전 행·다음 행의 값을 현재 행에서 직접 참조할 수 있게 해주는 함수로, 시계열 데이터 분석에 특히 유용하다.

---

## LAG와 LEAD 기본 구조

```sql
LAG  (expr [, offset [, default]]) OVER (... ORDER BY ...)
LEAD (expr [, offset [, default]]) OVER (... ORDER BY ...)
```

- `expr`: 가져올 컬럼이나 식
- `offset`: 몇 행 앞(LAG) 또는 뒤(LEAD)인지. 기본값 1
- `default`: 참조할 행이 없을 때(첫 행의 LAG, 마지막 행의 LEAD) 반환할 값. 기본값 NULL

**LAG**는 `ORDER BY` 기준으로 현재 행보다 앞에 있는 행, **LEAD**는 뒤에 있는 행의 값을 가져온다.

![LAG/LEAD 행 참조 시각화](/assets/posts/sql-lag-lead-visual.svg)

---

## 전일 대비 변화량과 등락률

가장 흔한 사용 사례는 시계열 데이터에서 **전 기간 대비 변화량**을 구하는 것이다.

![전일 대비 변화량 계산 코드](/assets/posts/sql-lag-lead-code.svg)

```sql
SELECT
    order_date,
    amount,
    LAG(amount, 1, 0) OVER (ORDER BY order_date) AS prev_amount,
    amount - LAG(amount, 1, 0) OVER (ORDER BY order_date) AS daily_delta,
    ROUND(
        (amount - LAG(amount) OVER (ORDER BY order_date))
        / NULLIF(LAG(amount) OVER (ORDER BY order_date), 0) * 100,
        2
    ) AS change_pct
FROM daily_sales;
```

첫 번째 행의 `LAG` 값은 존재하지 않으므로 기본값 0을 지정했다. 등락률 계산에서 전날 값이 0이면 0으로 나누기가 발생하므로 `NULLIF(LAG(...), 0)`으로 보호한다.

---

## 그룹별 변화량 — PARTITION BY 조합

여러 상품(또는 부서·지역)의 데이터가 섞여 있을 때는 `PARTITION BY`로 그룹을 나눠야 한다. 그렇지 않으면 상품 경계를 넘어 이전 행을 참조하게 된다.

```sql
SELECT
    product_id,
    sale_date,
    revenue,
    LAG(revenue) OVER (
        PARTITION BY product_id
        ORDER BY sale_date
    ) AS prev_revenue
FROM product_sales;
-- 각 product_id 내에서만 이전 행을 참조
```

---

## 오프셋 N — 여러 기간 전 값 참조

`LAG(amount, 7)`처럼 오프셋을 7로 지정하면 7행 전, 즉 주간 기준으로 한 주 전 값을 가져온다.

```sql
SELECT
    sale_date, amount,
    LAG(amount, 7) OVER (ORDER BY sale_date) AS week_ago,
    amount - LAG(amount, 7) OVER (ORDER BY sale_date)
        AS wow_delta
FROM daily_sales;
-- WoW(Week over Week) 변화량
```

---

## FIRST_VALUE, LAST_VALUE, NTH_VALUE

비슷한 오프셋 계열 함수로 프레임 내 특정 위치의 값을 반환하는 함수가 있다.

```sql
SELECT
    order_date, amount,
    FIRST_VALUE(amount) OVER (
        ORDER BY order_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS first_day_amount,
    NTH_VALUE(amount, 3) OVER (
        ORDER BY order_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS third_day_amount
FROM daily_sales;
```

`LAST_VALUE`는 기본 프레임이 `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`이므로, 전체 마지막 값을 얻으려면 프레임을 `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`으로 명시해야 한다. 이 점이 흔한 실수다.

---

## LAG/LEAD vs 셀프 조인

LAG/LEAD 이전에는 셀프 조인으로 이전 행을 참조했다.

```sql
-- 셀프 조인 방식 (복잡하고 느림)
SELECT a.sale_date, a.amount, b.amount AS prev_amount
FROM daily_sales a
LEFT JOIN daily_sales b
  ON b.sale_date = a.sale_date - INTERVAL '1 day';

-- 윈도우 함수 방식 (간결하고 빠름)
SELECT sale_date, amount,
       LAG(amount, 1) OVER (ORDER BY sale_date) AS prev_amount
FROM daily_sales;
```

윈도우 함수는 한 번의 테이블 스캔으로 처리하는 반면 셀프 조인은 조인 비용이 발생한다. 날짜가 연속하지 않는 경우에도 LAG/LEAD가 더 정확하다. 셀프 조인은 날짜 간격을 계산해 매핑하므로 빠진 날짜가 있으면 JOIN 조건이 실패할 수 있다.

---

## 실무 팁

| 상황 | 처리 방법 |
|---|---|
| 첫/끝 행의 NULL 처리 | 세 번째 인자로 기본값 지정 |
| 그룹 경계 누설 방지 | `PARTITION BY` 반드시 사용 |
| 주간/월간 비교 | offset을 7, 28, 30 등으로 조정 |
| 가장 최근 값 유지 | `LAST_VALUE` + 프레임 명시 |

---

**지난 글:** [ROW_NUMBER, RANK, DENSE_RANK — 순위 함수와 동점 처리](/posts/sql-row-number-rank-dense-rank/)

**다음 글:** [이동 평균과 누적 합계](/posts/sql-moving-average-cumulative/)

<br>
읽어주셔서 감사합니다. 😊
