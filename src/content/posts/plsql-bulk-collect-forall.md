---
title: "BULK COLLECT와 FORALL"
description: "PL/SQL에서 대량 데이터를 효율적으로 처리하는 BULK COLLECT와 FORALL의 동작 원리, context switch 최소화 전략, SAVE EXCEPTIONS 활용법까지 실무 중심으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["oracle", "plsql", "bulk-collect", "forall", "context-switch", "performance", "collections", "save-exceptions"]
featured: false
draft: false
---

[지난 글](/posts/plsql-collections/)에서 PL/SQL의 세 가지 컬렉션 유형을 살펴봤다. 컬렉션을 배웠으니 이제 그 컬렉션을 대량 데이터 처리에 활용하는 `BULK COLLECT`와 `FORALL`을 깊이 파고들어보자.

## 왜 BULK COLLECT인가

PL/SQL 코드는 두 가지 엔진 위에서 실행된다. PL/SQL 엔진은 절차형 로직을 처리하고, SQL 엔진은 SELECT/DML을 처리한다. 문제는 이 둘 사이의 **context switch**에 있다. 행 하나를 가져올 때마다 제어권이 SQL 엔진에서 PL/SQL 엔진으로, 다시 SQL 엔진으로 넘어간다. 10만 행이면 10만 번의 context switch가 발생한다.

![Context Switch 비교: Row-by-Row vs BULK COLLECT](/assets/posts/plsql-bulk-collect-forall-context-switch.svg)

`BULK COLLECT INTO`는 SQL 엔진이 한 번의 호출로 결과 집합 전체(또는 지정한 배치 단위)를 컬렉션에 담아 돌려준다. context switch 횟수가 `ceil(N / LIMIT)` 로 급감한다.

## BULK COLLECT 기본 문법

```sql
DECLARE
  TYPE t_emp_rec IS RECORD (
    emp_id   employees.emp_id%TYPE,
    emp_name employees.emp_name%TYPE,
    salary   employees.salary%TYPE
  );
  TYPE t_emp_tab IS TABLE OF t_emp_rec;
  v_emps t_emp_tab;
BEGIN
  SELECT emp_id, emp_name, salary
  BULK COLLECT INTO v_emps
  FROM employees
  WHERE dept_id = 10;

  FOR i IN 1 .. v_emps.COUNT LOOP
    DBMS_OUTPUT.PUT_LINE(v_emps(i).emp_name || ': ' || v_emps(i).salary);
  END LOOP;
END;
/
```

`%ROWTYPE`을 활용하면 레코드 타입 선언을 더 간결하게 줄일 수 있다.

## LIMIT 절 — 메모리와 성능의 균형

결과 집합이 수백만 행이라면 전부 SGA에 올리는 것은 PGA 폭발의 지름길이다. `LIMIT` 절을 커서 루프와 함께 쓰면 배치 단위로 처리할 수 있다.

```sql
DECLARE
  CURSOR c_emp IS
    SELECT emp_id, salary FROM employees WHERE status = 'ACTIVE';
  TYPE t_ids  IS TABLE OF employees.emp_id%TYPE;
  TYPE t_sals IS TABLE OF employees.salary%TYPE;
  v_ids  t_ids;
  v_sals t_sals;
BEGIN
  OPEN c_emp;
  LOOP
    FETCH c_emp
      BULK COLLECT INTO v_ids, v_sals
      LIMIT 500;

    EXIT WHEN v_ids.COUNT = 0;

    -- 배치 처리 로직
    FOR i IN 1 .. v_ids.COUNT LOOP
      NULL; -- 실제 처리
    END LOOP;
  END LOOP;
  CLOSE c_emp;
END;
/
```

LIMIT 값은 보통 **100~1000** 사이에서 테스트로 결정한다. 너무 작으면 context switch 횟수가 늘고, 너무 크면 PGA 압박이 생긴다.

## FORALL — 배치 DML

`FORALL`은 BULK COLLECT의 반대 방향이다. 컬렉션에 담긴 데이터를 한 번의 SQL 엔진 호출로 일괄 DML(INSERT/UPDATE/DELETE)한다.

![BULK COLLECT & FORALL 구문](/assets/posts/plsql-bulk-collect-forall-syntax.svg)

```sql
DECLARE
  TYPE t_id_tab  IS TABLE OF employees.emp_id%TYPE;
  TYPE t_sal_tab IS TABLE OF employees.salary%TYPE;
  v_ids  t_id_tab;
  v_sals t_sal_tab;
BEGIN
  -- 1) 수정 대상 조회
  SELECT emp_id, salary * 1.1
  BULK COLLECT INTO v_ids, v_sals
  FROM employees
  WHERE dept_id = 20;

  -- 2) 일괄 UPDATE
  FORALL i IN v_ids.FIRST .. v_ids.LAST
    UPDATE employees
    SET    salary = v_sals(i)
    WHERE  emp_id = v_ids(i);

  COMMIT;
END;
/
```

`FORALL`은 완전한 반복문이 아니다. DML 문 하나만 올 수 있다. 조건부 분기가 필요하면 CASE 식을 DML 안에 녹여야 한다.

## SAVE EXCEPTIONS — 부분 실패 처리

FORALL은 기본적으로 하나라도 실패하면 전체가 롤백된다. `SAVE EXCEPTIONS` 옵션을 추가하면 실패한 행을 건너뛰고 계속 진행한다. 실패 정보는 `SQL%BULK_EXCEPTIONS`에 쌓인다.

```sql
DECLARE
  TYPE t_ids IS TABLE OF NUMBER;
  v_ids t_ids := t_ids(1, 2, -999, 4, 5);  -- -999는 FK 위반 예시
  e_bulk_errors EXCEPTION;
  PRAGMA EXCEPTION_INIT(e_bulk_errors, -24381);
BEGIN
  FORALL i IN v_ids.FIRST .. v_ids.LAST
    SAVE EXCEPTIONS
    DELETE FROM employees WHERE emp_id = v_ids(i);

EXCEPTION
  WHEN e_bulk_errors THEN
    FOR j IN 1 .. SQL%BULK_EXCEPTIONS.COUNT LOOP
      DBMS_OUTPUT.PUT_LINE(
        '인덱스: ' || SQL%BULK_EXCEPTIONS(j).ERROR_INDEX ||
        ' 에러: ' || SQLERRM(-SQL%BULK_EXCEPTIONS(j).ERROR_CODE)
      );
    END LOOP;
END;
/
```

오류 코드 `-24381`은 "DML errors in bulk operation"을 의미하는 Oracle 내부 코드다.

## SQL%BULK_ROWCOUNT — 행별 영향 건수

`FORALL` 실행 후 `SQL%BULK_ROWCOUNT(i)`로 i번째 DML이 영향을 준 행 수를 확인할 수 있다.

```sql
FORALL i IN v_ids.FIRST .. v_ids.LAST
  UPDATE orders SET status = 'CLOSED'
  WHERE order_id = v_ids(i);

FOR i IN v_ids.FIRST .. v_ids.LAST LOOP
  IF SQL%BULK_ROWCOUNT(i) = 0 THEN
    DBMS_OUTPUT.PUT_LINE(v_ids(i) || ': 대상 없음');
  END IF;
END LOOP;
```

## 실무 성능 비교

직접 측정한 대략적인 수치다. 환경에 따라 크게 다를 수 있지만 방향성은 일관된다.

| 방식 | 10만 행 UPDATE | context switch |
|---|---|---|
| Row-by-Row LOOP | ~18초 | 100,000회 |
| BULK COLLECT + FORALL | ~0.8초 | ~200회 (LIMIT 500) |
| Direct SQL UPDATE | ~0.3초 | 1회 |

순수 SQL UPDATE 한 방이 가장 빠르다. 그러나 비즈니스 로직이 PL/SQL에 있어야 하는 경우라면 BULK COLLECT + FORALL 조합이 차선의 최선이다.

## 정리

- **BULK COLLECT INTO**: SQL 엔진 → PL/SQL 엔진 방향의 대량 조회, `LIMIT`으로 배치 제어
- **FORALL**: PL/SQL 엔진 → SQL 엔진 방향의 대량 DML, `SAVE EXCEPTIONS`로 부분 실패 처리
- LIMIT 500 기준: Row-by-Row 대비 20배 이상 성능 향상이 일반적
- 가능하면 순수 SQL이 우선; PL/SQL이 불가피할 때 BULK 조합 활용

---

**지난 글:** [PL/SQL 컬렉션](/posts/plsql-collections/)

**다음 글:** [Oracle 파티셔닝: Range·List·Hash](/posts/oracle-partitioning-range-list-hash/)

<br>
읽어주셔서 감사합니다. 😊
