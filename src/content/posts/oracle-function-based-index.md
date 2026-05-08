---
title: "Oracle Function-Based Index (FBI)"
description: "표현식을 인덱스 키로 저장하는 Function-Based Index의 원리, 생성 방법, 실행 계획 확인, 그리고 흔한 실수를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["oracle", "function-based-index", "fbi", "index", "query-rewrite", "upper", "expression-index", "cbo", "explain-plan"]
featured: false
draft: false
---

[지난 글](/posts/oracle-reverse-key-index/)에서 RAC 환경의 삽입 경합을 해소하는 Reverse Key 인덱스를 다뤘다. 이번에는 **컬럼 자체가 아닌 표현식(함수 결과)을 키로 저장**하는 Function-Based Index(FBI)를 살펴본다.

## FBI가 필요한 이유

인덱스가 `last_name` 컬럼에 생성되어 있어도 아래 쿼리는 인덱스를 사용하지 못한다.

```sql
-- UPPER() 적용 시 일반 인덱스 무력화
SELECT * FROM employees
WHERE  UPPER(last_name) = 'SMITH';
```

옵티마이저는 `UPPER(last_name)`의 결과를 예측할 수 없기 때문에 전체 스캔(Full Table Scan)을 선택한다. 대소문자 구분 없는 검색, 날짜·수식 파생 조건처럼 "컬럼에 함수를 씌운 WHERE 절"이 성능 병목이 되는 경우가 이 패턴에 해당한다.

## 원리: 표현식을 미리 계산해 저장

FBI는 `UPPER(last_name)` 같은 **표현식의 결과값**을 B-Tree 키로 사전 계산해 저장한다. 인덱스 생성 시점에 모든 행에 대해 표현식을 평가하고, DML 발생 때마다 자동으로 갱신한다. 쿼리 WHERE 절의 표현식이 인덱스 표현식과 **정확히 일치**하면 옵티마이저가 Index Range Scan을 선택한다.

![Function-Based Index 개념](/assets/posts/oracle-function-based-index-concept.svg)

---

## 생성 문법

```sql
-- 기본 형태: 표현식을 괄호 안에 그대로
CREATE INDEX idx_upper_last_name
ON employees (UPPER(last_name));

-- 복합 표현식 (계산 컬럼)
CREATE INDEX idx_annual_salary
ON employees (salary * 12);

-- CASE 표현식 — 특정 상태 행만 인덱싱
CREATE INDEX idx_active_salary
ON employees (
  CASE WHEN status = 'ACTIVE' THEN salary END
);

-- 날짜 트런케이션
CREATE INDEX idx_hire_month
ON employees (TRUNC(hire_date, 'MM'));
```

`CASE WHEN ... END` 패턴은 조건에 해당하지 않는 행이 NULL을 반환하고, Oracle B-Tree 인덱스가 모든 키가 NULL인 행을 저장하지 않는다는 특성을 이용해 **부분 인덱스** 효과를 낸다.

---

## 선행 조건

FBI가 실제로 사용되려면 세 가지 조건이 모두 충족되어야 한다.

| 조건 | 기본값 | 설정 방법 |
|------|--------|-----------|
| 쿼리 표현식 ≡ 인덱스 표현식 | — | 쿼리 작성 시 주의 |
| `QUERY_REWRITE_ENABLED = TRUE` | TRUE (11g+) | `ALTER SESSION/SYSTEM SET` |
| 인덱스 통계 수집 | — | `DBMS_STATS.GATHER_TABLE_STATS` |

특히 **통계 수집**을 빠뜨리면 옵티마이저가 FBI의 선택도를 알 수 없어 Full Scan을 택한다.

```sql
-- FBI 포함 통계 수집
BEGIN
  DBMS_STATS.GATHER_TABLE_STATS(
    ownname    => 'HR',
    tabname    => 'EMPLOYEES',
    method_opt => 'FOR ALL INDEXED COLUMNS SIZE AUTO'
  );
END;
/
```

---

## 실행 계획으로 FBI 사용 확인

```sql
EXPLAIN PLAN FOR
SELECT * FROM employees
WHERE  UPPER(last_name) = 'KING';

SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);
```

FBI가 제대로 동작하면 실행 계획에 아래처럼 나타난다.

```
| Id | Operation                          | Name               |
|----|------------------------------------|---------------------|
|  0 | SELECT STATEMENT                   |                     |
|  1 |  TABLE ACCESS BY INDEX ROWID BATCHED| EMPLOYEES           |
|* 2 |   INDEX RANGE SCAN                 | IDX_UPPER_LAST_NAME |
```

`INDEX RANGE SCAN`이 보이지 않고 `TABLE ACCESS FULL`이 나타난다면 세 가지 선행 조건 중 하나가 누락된 상황이다.

![FBI 활용 패턴 및 실행 계획 확인](/assets/posts/oracle-function-based-index-sql.svg)

---

## 흔한 실수

**표현식 불일치**: 인덱스를 `UPPER(last_name)`으로 생성하고 쿼리에서 `LOWER(last_name)`을 사용하면 인덱스를 타지 않는다. 표현식이 **글자 하나라도 달라서는 안 된다.**

**타입 변환 경합**: `TO_CHAR(hire_date, 'YYYY-MM-DD')` 인덱스를 만들고 쿼리에서 `TO_CHAR(hire_date, 'YYYY/MM/DD')`를 쓰면 형식 문자열이 달라 불일치가 발생한다.

**묵시적 형변환**: `WHERE salary = '50000'` 같은 암묵적 변환 조건은 `TO_NUMBER(salary)` 형태로 해석되어 `salary` 컬럼 인덱스 자체를 무력화할 수 있다.

---

## FBI vs. 가상 컬럼 (12c+)

Oracle 11g부터 제공된 **가상 컬럼(Virtual Column)**은 FBI와 유사한 문제를 테이블 정의 수준에서 해결한다.

```sql
-- 가상 컬럼 추가 후 일반 인덱스
ALTER TABLE employees
ADD (last_name_upper AS (UPPER(last_name)) VIRTUAL);

CREATE INDEX idx_virt_upper ON employees (last_name_upper);
```

쿼리에서 여전히 `UPPER(last_name)` 표현식을 사용할 수 있으며 옵티마이저가 가상 컬럼 인덱스를 자동으로 선택한다. 팀 내 SQL 표준화가 어렵거나 ORM 생성 쿼리를 제어할 수 없는 환경에서 가상 컬럼 방식이 더 안전하다.

---

**지난 글:** [Oracle Reverse Key 인덱스](/posts/oracle-reverse-key-index/)

**다음 글:** [Oracle Index-Organized Table (IOT)](/posts/oracle-index-organized-table/)

<br>
읽어주셔서 감사합니다. 😊
