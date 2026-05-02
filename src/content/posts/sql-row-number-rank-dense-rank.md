---
title: "ROW_NUMBER, RANK, DENSE_RANK — 순위 함수와 동점 처리"
description: "ROW_NUMBER, RANK, DENSE_RANK 세 순위 함수의 동점 처리 방식 차이, PARTITION BY를 활용한 그룹별 순위, TOP-N 쿼리 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-03"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["sql", "window-function", "row-number", "rank", "dense-rank", "ranking", "partition-by", "top-n"]
featured: false
draft: false
---

[지난 글](/posts/sql-window-functions-intro/)에서 윈도우 함수의 기본 구조와 OVER 절을 소개했다. 이번에는 가장 자주 쓰이는 순위 함수 세 가지—`ROW_NUMBER`, `RANK`, `DENSE_RANK`—의 동작 차이를 정확히 이해하고 실무 패턴에 적용하는 방법을 살펴본다.

---

## 세 함수의 차이

세 함수 모두 `OVER (ORDER BY ...)` 절과 함께 사용하며 행에 번호를 매긴다. 차이는 **동점(tie)이 생겼을 때** 드러난다.

![순위 함수별 동점 처리 비교](/assets/posts/sql-row-number-rank-dense-rank-comparison.svg)

- **ROW_NUMBER()**: 동점 여부와 무관하게 항상 고유한 번호를 부여한다. 같은 값이 두 개라도 2, 3으로 구분한다. 내부 정렬이 비결정적(non-deterministic)이어서 동점 간 순서는 실행 때마다 달라질 수 있다.
- **RANK()**: 동점인 행에게 같은 번호를 주고, 다음 번호는 동점 수만큼 건너뛴다. 두 행이 2위 동점이면 다음은 4위가 된다. 올림픽 순위와 같은 방식이다.
- **DENSE_RANK()**: 동점인 행에게 같은 번호를 주지만 번호를 건너뛰지 않는다. 두 행이 2위 동점이면 다음은 3위다. 순위 번호 자체가 "몇 개의 서로 다른 값이 존재하는가"를 뜻한다.

```sql
SELECT
    score,
    ROW_NUMBER() OVER (ORDER BY score DESC) AS rn,
    RANK()       OVER (ORDER BY score DESC) AS rnk,
    DENSE_RANK() OVER (ORDER BY score DESC) AS drk
FROM exam_results;
-- score=95가 2행이면: rn=2/3, rnk=2/2, drk=2/2
-- 다음 score=90:      rn=4,   rnk=4,   drk=3
```

---

## PARTITION BY로 그룹별 순위

실무에서는 전체 순위보다 **그룹(부서·카테고리) 내 순위**가 더 많이 쓰인다. `PARTITION BY`를 추가하면 파티션마다 독립적으로 순위가 초기화된다.

![PARTITION BY로 부서별 순위](/assets/posts/sql-row-number-rank-dense-rank-code.svg)

```sql
SELECT
    emp_name, dept, salary,
    ROW_NUMBER() OVER (PARTITION BY dept ORDER BY salary DESC) AS rn,
    RANK()       OVER (PARTITION BY dept ORDER BY salary DESC) AS rnk,
    DENSE_RANK() OVER (PARTITION BY dept ORDER BY salary DESC) AS drk
FROM employees;
```

`PARTITION BY dept`를 넣으면 dept 값이 바뀔 때마다 카운터가 1로 리셋된다. 결과적으로 각 부서 안에서 급여 순위가 독립적으로 매겨진다.

---

## TOP-N 패턴

순위 함수의 대표적 활용은 그룹별 상위 N개 추출이다. SQL 표준은 LIMIT/OFFSET으로 전체 정렬만 지원하므로, **그룹별 상위 N**은 윈도우 함수 없이 구현하기 어렵다.

```sql
-- 부서별 상위 2명
SELECT emp_name, dept, salary, rn
FROM (
    SELECT emp_name, dept, salary,
           ROW_NUMBER() OVER (
               PARTITION BY dept ORDER BY salary DESC) AS rn
    FROM employees
) ranked
WHERE rn <= 2;
```

`RANK`를 쓰면 동점자를 모두 포함("상위 2위 이내"), `ROW_NUMBER`를 쓰면 정확히 N명을 고른다. 비즈니스 요건에 따라 선택한다.

---

## NTILE — N등분 버킷

순위 대신 **몇 분위에 속하는지**를 알고 싶을 때는 `NTILE(n)`을 쓴다. 행을 n개의 버킷으로 나눠 1부터 n까지 번호를 부여한다.

```sql
SELECT
    emp_name, salary,
    NTILE(4) OVER (ORDER BY salary DESC) AS quartile
FROM employees;
-- 전체 직원을 급여 기준 4분위로 나눔 (1=상위 25%)
```

행 수가 n으로 나누어 떨어지지 않으면 앞쪽 버킷이 한 행 더 많아진다.

---

## PERCENT_RANK, CUME_DIST

상대적 위치를 0~1 범위 비율로 표현하는 함수도 있다.

```sql
SELECT
    score,
    PERCENT_RANK() OVER (ORDER BY score) AS pct_rank,
    CUME_DIST()    OVER (ORDER BY score) AS cum_dist
FROM exam_results;
-- PERCENT_RANK: (rank-1)/(total_rows-1), 첫 행 = 0
-- CUME_DIST: rank/total_rows, 해당 값 이하인 행의 비율
```

---

## 선택 기준 정리

| 상황 | 추천 함수 |
|---|---|
| 정확히 N행 추출 | `ROW_NUMBER` |
| 동점자를 같은 순위로 처리 | `RANK` 또는 `DENSE_RANK` |
| 번호 연속성이 중요 | `DENSE_RANK` |
| 분위수(상위 25% 등) | `NTILE` |
| 상대 백분율 위치 | `PERCENT_RANK`, `CUME_DIST` |

`ROW_NUMBER`를 사용할 때 동점 행 사이의 순서가 비결정적임을 인식해야 한다. 결과 일관성이 필요하면 `ORDER BY`에 고유 컬럼(PK 등)을 추가로 지정한다.

---

**지난 글:** [윈도우 함수 입문 — OVER 절과 파티션](/posts/sql-window-functions-intro/)

**다음 글:** [LAG / LEAD — 이전·다음 행 참조](/posts/sql-lag-lead/)

<br>
읽어주셔서 감사합니다. 😊
