---
title: "PL/SQL 블록 구조"
description: "PL/SQL 프로그램의 기본 단위인 블록의 DECLARE/BEGIN/EXCEPTION/END 섹션 역할, 제어 구조, 중첩 블록과 예외 전파 원리를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["oracle", "plsql", "block-structure", "declare", "begin", "exception", "if-elsif", "loop", "for-loop", "nested-block"]
featured: false
draft: false
---

[지난 글](/posts/oracle-sql-plan-management/)에서 Oracle SPM으로 실행 계획을 안정화하는 방법을 다뤘다. 이번 글부터는 Oracle의 절차적 확장 언어인 **PL/SQL**을 본격적으로 다룬다. PL/SQL의 모든 프로그램 단위는 블록이라는 동일한 구조를 공유한다.

## PL/SQL 블록의 4개 섹션

PL/SQL 블록은 다음 네 섹션으로 구성된다.

| 섹션 | 필수 여부 | 역할 |
|------|-----------|------|
| `DECLARE` | 선택 | 변수, 상수, 커서, 예외 선언 |
| `BEGIN` | 필수 | 실행 가능 문장 (SQL + 절차적 코드) |
| `EXCEPTION` | 선택 | 런타임 예외 핸들러 |
| `END;` | 필수 | 블록 종료 |

`BEGIN`과 `END;`는 생략할 수 없다. `BEGIN` 안에는 최소한 `NULL;` 한 줄이라도 있어야 한다.

```sql
-- 최소 PL/SQL 블록
BEGIN
  NULL;
END;
/
```

슬래시(`/`)는 SQL*Plus나 SQLcl에서 블록을 실행하라는 종료 신호다.

![PL/SQL 블록 구조 해부](/assets/posts/plsql-block-structure-anatomy.svg)

---

## DECLARE 섹션

변수와 상수를 선언한다. 초기값을 할당할 수 있으며, 지정하지 않으면 NULL이다.

```sql
DECLARE
  -- 변수 선언
  v_employee_id  NUMBER(6);
  v_last_name    VARCHAR2(25);
  v_hire_date    DATE := SYSDATE;

  -- 상수 (값 변경 불가)
  c_max_salary   CONSTANT NUMBER := 50000;

  -- %TYPE: 테이블 컬럼과 동일한 타입 참조
  v_salary       employees.salary%TYPE;

  -- %ROWTYPE: 테이블 행 전체를 변수 하나로
  r_emp          employees%ROWTYPE;
BEGIN
  SELECT *
  INTO   r_emp
  FROM   employees
  WHERE  employee_id = 100;

  DBMS_OUTPUT.PUT_LINE(r_emp.last_name || ', ' || r_emp.salary);
END;
/
```

`%TYPE`과 `%ROWTYPE`은 테이블 구조가 바뀌어도 코드를 수정할 필요가 없어 유지 보수성을 높인다.

---

## BEGIN 섹션

SQL 문장과 절차적 제어 구조가 모두 들어간다.

### 조건문

```sql
DECLARE
  v_sal  NUMBER := 12000;
  v_msg  VARCHAR2(20);
BEGIN
  IF v_sal > 10000 THEN
    v_msg := '고연봉';
  ELSIF v_sal > 5000 THEN
    v_msg := '중연봉';
  ELSE
    v_msg := '저연봉';
  END IF;

  -- CASE 표현식도 사용 가능
  v_msg := CASE
             WHEN v_sal > 10000 THEN '고연봉'
             WHEN v_sal > 5000  THEN '중연봉'
             ELSE                    '저연봉'
           END;

  DBMS_OUTPUT.PUT_LINE(v_msg);
END;
/
```

### 반복문

```sql
BEGIN
  -- FOR 루프 (i는 자동 선언, 수정 불가)
  FOR i IN 1..5 LOOP
    DBMS_OUTPUT.PUT_LINE('i = ' || i);
  END LOOP;

  -- WHILE 루프
  DECLARE v_n NUMBER := 1; BEGIN
    WHILE v_n <= 5 LOOP
      DBMS_OUTPUT.PUT_LINE(v_n);
      v_n := v_n + 1;
    END LOOP;
  END;

  -- 기본 LOOP + EXIT
  DECLARE v_k NUMBER := 0; BEGIN
    LOOP
      v_k := v_k + 1;
      EXIT WHEN v_k > 5;
    END LOOP;
  END;
END;
/
```

---

## EXCEPTION 섹션

런타임에 발생하는 예외를 잡아 처리한다. 예외가 발생하면 BEGIN 섹션의 나머지 코드는 건너뛰고 EXCEPTION 섹션으로 제어가 이동한다.

```sql
DECLARE
  v_name employees.last_name%TYPE;
BEGIN
  SELECT last_name INTO v_name
  FROM   employees
  WHERE  employee_id = 9999;         -- 없는 ID

EXCEPTION
  WHEN NO_DATA_FOUND THEN
    DBMS_OUTPUT.PUT_LINE('사원 없음');
  WHEN TOO_MANY_ROWS THEN
    DBMS_OUTPUT.PUT_LINE('결과가 여러 행');
  WHEN OTHERS THEN
    DBMS_OUTPUT.PUT_LINE('오류: ' || SQLERRM);
    RAISE;                            -- 상위로 재전파
END;
/
```

`OTHERS`는 앞의 특정 예외 핸들러가 처리하지 못한 모든 예외를 잡는다. `OTHERS`만 작성하고 `RAISE`를 빠뜨리면 예외가 조용히 삼켜지므로, 재전파 또는 로깅이 필요하다.

![PL/SQL 제어 구조 및 중첩 블록](/assets/posts/plsql-block-structure-flow.svg)

---

## 중첩 블록과 예외 전파

PL/SQL은 블록 안에 블록을 **중첩**할 수 있다. 내부 블록에서 예외가 발생하면:

1. 내부 블록에 핸들러가 있으면 그곳에서 처리 — 외부 블록은 정상 실행 계속
2. 없으면 외부 블록의 EXCEPTION 섹션으로 전파
3. 최상위 블록까지 핸들러가 없으면 호출 환경(SQL*Plus, 애플리케이션)으로 전파

```sql
BEGIN
  -- 내부 블록: 개별 예외 격리 처리
  BEGIN
    INSERT INTO orders VALUES (seq.NEXTVAL, ...);
  EXCEPTION
    WHEN DUP_VAL_ON_INDEX THEN
      UPDATE orders SET ... WHERE order_id = :id;
  END;
  -- 내부 예외 처리 후 외부 블록 계속 실행
  COMMIT;
EXCEPTION
  WHEN OTHERS THEN
    ROLLBACK;
    RAISE;
END;
/
```

중첩 블록은 "한 예외는 여기서, 다른 예외는 바깥에서" 처리할 때 유용하다.

---

## 블록 유형 비교

| 유형 | 이름 | 저장 | 재호출 |
|------|------|------|--------|
| 익명 블록 | 없음 | 안 됨 | 안 됨 |
| 프로시저 | 있음 | 됨 | 됨 |
| 함수 | 있음 | 됨 | 됨 (값 반환) |
| 패키지 | 있음 | 됨 | 됨 (논리 묶음) |
| 트리거 | 있음 | 됨 | 이벤트 자동 실행 |

익명 블록은 일회성 작업이나 테스트에 적합하고, 반복 호출이 필요하면 프로시저나 함수로 저장한다.

---

**지난 글:** [Oracle SQL Plan Management](/posts/oracle-sql-plan-management/)

**다음 글:** [PL/SQL 변수, 커서, 예외](/posts/plsql-variables-cursors-exceptions/)

<br>
읽어주셔서 감사합니다. 😊
