---
title: "Tibero tbPSM — PL/SQL 호환 절차형 언어 완전 해설"
description: "Tibero의 절차형 언어 tbPSM의 블록 구조, 변수·커서·예외 처리, 프로시저·함수·패키지·트리거 작성법을 Oracle PL/SQL과 비교하며 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["Tibero", "tbPSM", "PLSQL", "절차형SQL", "프로시저", "패키지", "트리거"]
featured: false
draft: false
---

[지난 글](/posts/tibero-tac-cluster/)에서 Tibero TAC의 클러스터 구조를 살펴봤다. 이번에는 Tibero에서 복잡한 비즈니스 로직을 DB 내부에 구현하는 데 사용하는 절차형 언어 **tbPSM(Tibero Procedural SQL Module)** 을 다룬다.

## tbPSM이란

tbPSM은 Oracle PL/SQL을 기반으로 설계된 Tibero의 절차형 확장 언어다. SQL과 달리 조건 분기, 반복, 예외 처리, 변수 선언 등 절차형 프로그래밍 요소를 포함한다. Oracle 환경에서 작성된 PL/SQL 코드의 대부분을 재작성 없이 또는 최소한의 수정으로 실행할 수 있다.

## 블록 구조

tbPSM의 기본 단위는 **블록(block)** 이다. 익명 블록(anonymous block), 프로시저, 함수, 패키지 모두 동일한 구조를 갖는다.

![tbPSM 블록 구조](/assets/posts/tibero-psm-block-structure.svg)

```sql
-- 기본 블록 구조
DECLARE
    -- 변수, 커서, 타입, 예외 선언 (생략 가능)
    v_emp_count  NUMBER;
    v_dept_name  VARCHAR2(50);
BEGIN
    -- 실행부 (필수)
    SELECT COUNT(*), d.dept_name
    INTO   v_emp_count, v_dept_name
    FROM   employees e
    JOIN   departments d ON e.dept_id = d.dept_id
    WHERE  d.dept_id = 10
    GROUP  BY d.dept_name;

    DBMS_OUTPUT.PUT_LINE(v_dept_name || ': ' || v_emp_count || '명');
EXCEPTION
    -- 예외 처리 (생략 가능)
    WHEN NO_DATA_FOUND THEN
        DBMS_OUTPUT.PUT_LINE('해당 부서 없음');
    WHEN OTHERS THEN
        RAISE_APPLICATION_ERROR(-20001, SQLERRM);
END;
/
```

## 저장 객체 유형

![tbPSM 저장 객체 유형](/assets/posts/tibero-psm-objects.svg)

### 프로시저(Procedure)

반환값 없이 DML 수행이나 부작용(side effect) 처리에 사용한다.

```sql
CREATE OR REPLACE PROCEDURE transfer_funds(
    p_from_id  IN  accounts.account_id%TYPE,
    p_to_id    IN  accounts.account_id%TYPE,
    p_amount   IN  NUMBER,
    p_result   OUT VARCHAR2
) AS
    v_from_bal NUMBER;
BEGIN
    SELECT balance INTO v_from_bal
    FROM   accounts WHERE account_id = p_from_id
    FOR UPDATE;  -- 행 잠금

    IF v_from_bal < p_amount THEN
        p_result := 'INSUFFICIENT_FUNDS';
        RETURN;
    END IF;

    UPDATE accounts SET balance = balance - p_amount
    WHERE  account_id = p_from_id;

    UPDATE accounts SET balance = balance + p_amount
    WHERE  account_id = p_to_id;

    COMMIT;
    p_result := 'OK';
EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        p_result := 'ERROR: ' || SQLERRM;
END;
/

-- 호출
DECLARE
    v_res VARCHAR2(100);
BEGIN
    transfer_funds(1001, 1002, 50000, v_res);
    DBMS_OUTPUT.PUT_LINE(v_res);
END;
/
```

### 함수(Function)

값을 반환하며 SQL 쿼리 내에서 직접 호출할 수 있다.

```sql
CREATE OR REPLACE FUNCTION get_dept_budget(
    p_dept_id IN departments.dept_id%TYPE
) RETURN NUMBER
AS
    v_total NUMBER := 0;
BEGIN
    SELECT NVL(SUM(salary), 0)
    INTO   v_total
    FROM   employees
    WHERE  dept_id = p_dept_id;

    RETURN v_total;
END;
/

-- SQL 쿼리 내 직접 호출
SELECT dept_id, dept_name,
       get_dept_budget(dept_id) AS total_salary
FROM   departments
ORDER  BY total_salary DESC;
```

### 패키지(Package)

관련 프로시저와 함수를 하나로 묶어 모듈화한다. **명세(spec)** 와 **본체(body)** 로 분리된다.

```sql
-- 패키지 명세 (인터페이스 선언)
CREATE OR REPLACE PACKAGE emp_mgr AS
    g_default_dept  NUMBER := 10;  -- 패키지 전역 변수

    PROCEDURE hire(p_name VARCHAR2, p_salary NUMBER);
    FUNCTION  get_headcount(p_dept NUMBER) RETURN NUMBER;
END emp_mgr;
/

-- 패키지 본체 (구현)
CREATE OR REPLACE PACKAGE BODY emp_mgr AS
    PROCEDURE hire(p_name VARCHAR2, p_salary NUMBER) AS
    BEGIN
        INSERT INTO employees(name, salary, dept_id)
        VALUES(p_name, p_salary, g_default_dept);
        COMMIT;
    END hire;

    FUNCTION get_headcount(p_dept NUMBER) RETURN NUMBER AS
        v_cnt NUMBER;
    BEGIN
        SELECT COUNT(*) INTO v_cnt
        FROM   employees WHERE dept_id = p_dept;
        RETURN v_cnt;
    END get_headcount;
END emp_mgr;
/

-- 호출
BEGIN
    emp_mgr.hire('홍길동', 4500000);
    DBMS_OUTPUT.PUT_LINE(emp_mgr.get_headcount(10));
END;
/
```

### 트리거(Trigger)

DML 이벤트 발생 시 자동 실행된다. `:OLD`와 `:NEW` 의사 레코드로 변경 전후 값에 접근한다.

```sql
CREATE OR REPLACE TRIGGER trg_emp_audit
BEFORE UPDATE OF salary ON employees
FOR EACH ROW
BEGIN
    INSERT INTO emp_audit_log(
        emp_id, old_salary, new_salary, changed_at, changed_by
    ) VALUES (
        :OLD.employee_id,
        :OLD.salary,
        :NEW.salary,
        SYSDATE,
        SYS_CONTEXT('USERENV', 'SESSION_USER')
    );
END;
/
```

## 예외 처리

tbPSM의 예외는 **사전 정의 예외**와 **사용자 정의 예외**로 나뉜다.

```sql
DECLARE
    e_duplicate EXCEPTION;
    PRAGMA EXCEPTION_INIT(e_duplicate, -1);  -- ORA-00001 (unique 위반)
BEGIN
    INSERT INTO departments(dept_id, dept_name)
    VALUES(10, '영업부');
EXCEPTION
    WHEN e_duplicate THEN
        DBMS_OUTPUT.PUT_LINE('이미 존재하는 부서 ID');
    WHEN NO_DATA_FOUND THEN
        NULL;  -- 무시
    WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('오류 코드: ' || SQLCODE);
        DBMS_OUTPUT.PUT_LINE('오류 메시지: ' || SQLERRM);
        RAISE;  -- 상위 블록으로 재전파
END;
/
```

## Oracle PL/SQL과의 차이점

Oracle에서 Tibero로 이전할 때 주의해야 할 차이점이다.

| 항목 | Oracle PL/SQL | Tibero tbPSM |
|---|---|---|
| 기본 문법 | PL/SQL | 거의 동일 |
| UTL_FILE | 지원 | 지원 (일부 제한) |
| DBMS_JOB | 지원 | tb_job으로 대체 권장 |
| DBMS_CRYPTO | 지원 | 기능 일부 차이 |
| 파이프라인 함수 | 지원 | 지원 |
| 컬렉션 타입 | TABLE OF, VARRAY | 동일 지원 |

```sql
-- Oracle에서 마이그레이션 시 검증 쿼리
SELECT object_name, object_type, status
FROM   dba_objects
WHERE  object_type IN ('PROCEDURE', 'FUNCTION', 'PACKAGE', 'TRIGGER')
  AND  status = 'INVALID'
  AND  owner  = 'APP_SCHEMA';
-- 컴파일 실패 객체 목록 확인 후 개별 수정
```

tbPSM은 Oracle PL/SQL을 쓰던 개발자가 거의 동일한 방식으로 코드를 작성할 수 있다. 이전 시에는 내장 패키지(DBMS_*, UTL_*) 사용 여부를 가장 먼저 점검하고, 비호환 패키지는 대안 구현으로 교체해야 한다.

---

**지난 글:** [Tibero Active Cluster(TAC) 구조](/posts/tibero-tac-cluster/)

**다음 글:** [Oracle에서 Tibero로 마이그레이션](/posts/tibero-migration-from-oracle/)

<br>
읽어주셔서 감사합니다. 😊
