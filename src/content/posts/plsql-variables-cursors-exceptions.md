---
title: "PL/SQL 변수, 커서, 예외"
description: "PL/SQL의 스칼라 변수와 %TYPE/%ROWTYPE, 명시적 커서 OPEN-FETCH-CLOSE 패턴, 커서 FOR 루프, 사용자 정의 예외와 RAISE_APPLICATION_ERROR를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["oracle", "plsql", "variables", "cursor", "explicit-cursor", "rowtype", "type", "exception", "raise-application-error", "pragma-exception-init"]
featured: false
draft: false
---

[지난 글](/posts/plsql-block-structure/)에서 PL/SQL 블록의 4개 섹션을 살펴봤다. 이번에는 PL/SQL의 세 핵심 구성 요소인 **변수·커서·예외**를 깊이 다룬다.

## 변수와 데이터 타입

### 스칼라 변수

PL/SQL은 SQL 데이터 타입 외에 `BOOLEAN`도 지원한다. `BOOLEAN`은 SQL에서 사용할 수 없고 PL/SQL 내부 로직에서만 쓴다.

```sql
DECLARE
  v_employee_id  NUMBER(6)     := 100;
  v_last_name    VARCHAR2(25);
  v_flag         BOOLEAN       := TRUE;
  v_hire_date    DATE          := SYSDATE;
  c_tax_rate     CONSTANT NUMBER := 0.033;
BEGIN
  IF v_flag THEN
    DBMS_OUTPUT.PUT_LINE('플래그 활성');
  END IF;
END;
/
```

### %TYPE와 %ROWTYPE

```sql
DECLARE
  -- %TYPE: 특정 컬럼과 동일한 타입으로 선언
  v_salary    employees.salary%TYPE;
  v_name      employees.last_name%TYPE;

  -- %ROWTYPE: 테이블 또는 커서 행 전체를 레코드로
  r_emp       employees%ROWTYPE;
BEGIN
  SELECT * INTO r_emp
  FROM   employees
  WHERE  employee_id = 100;

  DBMS_OUTPUT.PUT_LINE(r_emp.last_name || ': ' || r_emp.salary);
END;
/
```

테이블 컬럼 타입이 변경될 때 `%TYPE`을 사용한 코드는 재컴파일만으로 자동 반영된다. `%ROWTYPE`은 SELECT *의 결과를 변수 하나로 받을 때 유용하다.

![PL/SQL 변수, 커서, 예외 개념](/assets/posts/plsql-vars-cursors-concept.svg)

---

## 묵시적 커서 vs. 명시적 커서

| 구분 | 묵시적 커서 | 명시적 커서 |
|------|------------|------------|
| 선언 | 자동 | 개발자 직접 선언 |
| 사용 | DML / SELECT INTO | 다중 행 결과 반복 |
| 속성 | SQL%ROWCOUNT, SQL%FOUND | cur%ROWCOUNT, cur%NOTFOUND |
| OPEN/CLOSE | 자동 | 수동 (또는 커서 FOR 루프) |

단일 행 결과가 확실할 때는 `SELECT INTO`(묵시적 커서)를, 다중 행을 순회해야 할 때는 명시적 커서를 사용한다.

### 명시적 커서 OPEN-FETCH-CLOSE

```sql
DECLARE
  CURSOR c_high_sal (p_min NUMBER) IS
    SELECT employee_id, last_name, salary
    FROM   employees
    WHERE  salary >= p_min
    ORDER  BY salary DESC;

  TYPE t_emp_rec IS RECORD (
    emp_id   employees.employee_id%TYPE,
    nm       employees.last_name%TYPE,
    sal      employees.salary%TYPE
  );
  r t_emp_rec;
BEGIN
  OPEN c_high_sal(10000);
  LOOP
    FETCH c_high_sal INTO r;
    EXIT WHEN c_high_sal%NOTFOUND;
    DBMS_OUTPUT.PUT_LINE(r.nm || ' / ' || r.sal);
  END LOOP;
  CLOSE c_high_sal;
END;
/
```

`%NOTFOUND`를 FETCH **이후**에 확인해야 마지막 행을 놓치지 않는다.

### 커서 FOR 루프 (권장)

커서 FOR 루프는 OPEN/FETCH/CLOSE를 내부적으로 자동 처리한다.

```sql
BEGIN
  FOR r IN (
    SELECT employee_id, last_name
    FROM   employees
    WHERE  department_id = 60
  ) LOOP
    DBMS_OUTPUT.PUT_LINE(r.last_name);
  END LOOP;
END;
/
```

커서 변수 선언도 필요 없고, CLOSE 누락 버그도 없다. 대부분의 경우 커서 FOR 루프가 가장 간결하고 안전하다.

![명시적 커서와 사용자 정의 예외](/assets/posts/plsql-vars-cursors-sql.svg)

---

## 예외 처리

### 사전 정의 예외

Oracle이 미리 이름을 붙여 둔 예외들이다.

| 예외명 | 원인 |
|--------|------|
| `NO_DATA_FOUND` | SELECT INTO 결과가 0행 |
| `TOO_MANY_ROWS` | SELECT INTO 결과가 2행 이상 |
| `DUP_VAL_ON_INDEX` | Unique 제약 위반 |
| `VALUE_ERROR` | 타입 변환 또는 길이 초과 |
| `ZERO_DIVIDE` | 0으로 나누기 |
| `CURSOR_ALREADY_OPEN` | 이미 열린 커서를 다시 열기 |

### 사용자 정의 예외

비즈니스 규칙 위반을 표현할 때 사용한다.

```sql
DECLARE
  e_low_stock EXCEPTION;
  v_qty       NUMBER := 5;
BEGIN
  IF v_qty < 10 THEN
    RAISE e_low_stock;
  END IF;
EXCEPTION
  WHEN e_low_stock THEN
    DBMS_OUTPUT.PUT_LINE('재고 부족 경고');
END;
/
```

### PRAGMA EXCEPTION_INIT

ORA- 번호를 예외 이름과 연결한다.

```sql
DECLARE
  e_parent_key_not_found EXCEPTION;
  PRAGMA EXCEPTION_INIT(e_parent_key_not_found, -2291);  -- FK 위반
BEGIN
  INSERT INTO order_items VALUES (9999, 999, 1);
EXCEPTION
  WHEN e_parent_key_not_found THEN
    DBMS_OUTPUT.PUT_LINE('존재하지 않는 주문 번호');
END;
/
```

### RAISE_APPLICATION_ERROR

애플리케이션 계층으로 오류를 반환할 때 사용한다. 번호는 `-20000` ~ `-20999` 범위 내에서 자유롭게 지정한다.

```sql
CREATE OR REPLACE PROCEDURE set_salary (
  p_emp_id IN employees.employee_id%TYPE,
  p_sal    IN employees.salary%TYPE
) AS
BEGIN
  IF p_sal < 0 THEN
    RAISE_APPLICATION_ERROR(-20001, '급여는 음수일 수 없습니다.');
  END IF;
  UPDATE employees SET salary = p_sal WHERE employee_id = p_emp_id;
END;
/
```

호출자(Java, Python 등)는 이 번호와 메시지를 SQL 예외로 수신한다. 모든 예외를 `WHEN OTHERS`로 삼키지 말고, 가능하면 구체적인 예외를 처리하고 `RAISE` 또는 `RAISE_APPLICATION_ERROR`로 재전파해야 디버깅이 쉬워진다.

---

**지난 글:** [PL/SQL 블록 구조](/posts/plsql-block-structure/)

**다음 글:** [PL/SQL 패키지](/posts/plsql-package/)

<br>
읽어주셔서 감사합니다. 😊
