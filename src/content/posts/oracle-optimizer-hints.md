---
title: "Oracle 옵티마이저 힌트"
description: "Oracle CBO를 재정의하는 옵티마이저 힌트의 문법, 주요 분류, 올바른 사용법과 힌트가 무시되는 원인을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["oracle", "optimizer-hints", "cbo", "full", "index", "leading", "use-nl", "use-hash", "parallel", "explain-plan"]
featured: false
draft: false
---

[지난 글](/posts/oracle-rbo-vs-cbo/)에서 CBO가 통계를 기반으로 실행 계획을 결정하는 원리를 다뤘다. 이번에는 CBO의 결정을 개발자가 직접 재정의하는 **옵티마이저 힌트**를 살펴본다.

## 힌트란 무엇인가

힌트는 SQL 문장 안의 특수 주석(`/*+ ... */`)으로, CBO에게 특정 접근 경로·조인 방법·쿼리 변환 방식을 지시한다. CBO는 힌트를 **강한 권고**로 수용한다. 문법 오류나 의미적으로 불가능한 힌트는 **조용히 무시**되며 오류가 발생하지 않는다.

힌트는 통계 수집, 인덱스 추가, 쿼리 재작성 같은 근본적인 해결책이 안 될 때 사용하는 **마지막 수단**이다. 사용 이유를 반드시 주석으로 남겨야 나중에 힌트를 제거해야 하는 시점을 알 수 있다.

## 힌트 문법

```sql
-- SELECT 키워드 바로 뒤 /*+ ... */ 형식
SELECT /*+ 힌트명(별칭) 힌트명2(별칭) */
       컬럼 목록
FROM   테이블명 별칭
WHERE  조건;

-- INSERT/UPDATE/DELETE에도 적용 가능
INSERT /*+ APPEND */ INTO sales SELECT ...
```

힌트 안에서 테이블을 가리킬 때는 **FROM 절의 별칭**을 그대로 사용해야 한다. 별칭과 힌트 내 이름이 다르면 힌트가 무시된다.

![Oracle 옵티마이저 힌트 분류](/assets/posts/oracle-optimizer-hints-types.svg)

---

## 주요 힌트 분류

### 접근 경로 힌트

```sql
-- Full Table Scan 강제 (인덱스 존재해도 무시)
SELECT /*+ FULL(e) */ last_name FROM employees e
WHERE  department_id = 50;

-- 특정 인덱스 사용 강제
SELECT /*+ INDEX(e idx_emp_dept) */ last_name
FROM   employees e
WHERE  department_id = 50;

-- 인덱스 제외
SELECT /*+ NO_INDEX(e idx_emp_dept) */ last_name
FROM   employees e
WHERE  department_id = 50;

-- Index Fast Full Scan: 인덱스 전체를 멀티블록으로 스캔
SELECT /*+ INDEX_FFS(e idx_emp_dept) */ COUNT(*)
FROM   employees e;
```

### 조인 방법 힌트

```sql
-- Nested Loops: 소형 드라이버 + 대형 inner 인덱스 있을 때
SELECT /*+ LEADING(d e) USE_NL(e) */
       d.department_name, e.last_name
FROM   departments d
JOIN   employees e ON d.department_id = e.department_id
WHERE  d.location_id = 1700;

-- Hash Join: 대용량 테이블 간 등치 조인
SELECT /*+ USE_HASH(e d) */
       e.last_name, d.department_name
FROM   employees e JOIN departments d
       ON e.department_id = d.department_id;

-- Sort-Merge Join: 이미 정렬된 데이터 또는 범위 조인
SELECT /*+ USE_MERGE(e d) */
       e.last_name, d.department_name
FROM   employees e JOIN departments d
       ON e.department_id = d.department_id;
```

`LEADING(t1 t2 t3)` 힌트로 조인 순서를 지정할 때는 선택도가 높은(결과 행이 적은) 테이블을 앞에 배치하는 것이 일반적으로 유리하다.

### 쿼리 변환 힌트

```sql
-- CTE를 임시 테이블로 구체화 (반복 참조 최적화)
WITH monthly_sales AS (
    /*+ MATERIALIZE */
    SELECT trunc(sale_date, 'MM') mon, SUM(amount) total
    FROM   sales
    GROUP  BY trunc(sale_date, 'MM')
)
SELECT * FROM monthly_sales WHERE total > 100000;

-- 서브쿼리를 조인으로 인라인화
SELECT /*+ UNNEST */ *
FROM   orders o
WHERE  o.cust_id IN (SELECT cust_id FROM vip_customers);
```

![힌트 작성 문법과 적용 예시](/assets/posts/oracle-optimizer-hints-sql.svg)

---

## 힌트가 무시되는 이유

Oracle은 힌트에 오류가 있어도 SQL을 실행하고 힌트를 조용히 무시한다. 흔한 원인 네 가지:

1. **별칭 불일치** — `FROM employees e`인데 힌트에 `FULL(employees)` 사용
2. **오타** — `IDNEX(e idx)` 같은 오타는 무시됨
3. **의미적 불가능** — 존재하지 않는 인덱스 이름 지정
4. **뷰 내부 테이블** — 뷰 밖에서 힌트를 줄 때 뷰 내부 테이블에는 전달되지 않음

힌트가 실제로 반영됐는지 확인하는 방법:

```sql
-- 힌트 무시 여부 확인 (12c+)
SELECT hint_text, ignored, ignored_reason
FROM   v$sql_hint_usage
WHERE  sql_id = :sql_id;

-- DBMS_XPLAN으로 힌트 반영 확인
SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY_CURSOR(NULL, NULL, 'TYPICAL +HINT_REPORT'));
```

`+HINT_REPORT` 옵션을 추가하면 실행 계획 아래에 각 힌트의 반영 여부와 무시 이유가 출력된다.

---

## 힌트 제거 계획 세우기

힌트는 임시 처방이다. 아래 조건이 충족되면 힌트를 제거하고 CBO에게 다시 위임할 수 있다.

- 인덱스가 추가되었고 통계가 수집되었다
- 대량 DML 후 통계가 최신 상태다
- 테이블 파티셔닝 등 구조 변경이 이루어졌다

힌트를 남기더라도 **왜 이 힌트가 필요한지**, **제거해도 되는 조건은 무엇인지**를 코드 주석에 명시한다.

---

**지난 글:** [Oracle RBO vs. CBO](/posts/oracle-rbo-vs-cbo/)

**다음 글:** [Oracle SQL Plan Management](/posts/oracle-sql-plan-management/)

<br>
읽어주셔서 감사합니다. 😊
