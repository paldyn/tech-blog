---
title: "PL/SQL 패키지"
description: "PL/SQL 패키지의 명세·본문 구조, 정보 은닉, 오버로딩, 패키지 초기화 섹션, 전역 상태 관리를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["oracle", "plsql", "package", "package-spec", "package-body", "overloading", "initialization", "global-state", "information-hiding"]
featured: false
draft: false
---

[지난 글](/posts/plsql-variables-cursors-exceptions/)에서 PL/SQL의 변수·커서·예외를 다뤘다. 이번에는 PL/SQL의 가장 강력한 구성 요소인 **패키지**를 살펴본다. 패키지는 관련 서브프로그램·타입·변수를 하나의 이름 아래 묶는 모듈화 단위다.

## 패키지의 두 부분

패키지는 **명세(Specification)**와 **본문(Body)** 두 개의 데이터베이스 객체로 구성된다.

| 구분 | 역할 | 의존 관계 |
|------|------|-----------|
| 명세 | 공개 인터페이스 선언 | 외부에서 참조 |
| 본문 | 구현 (실제 코드) | 명세에 의존 |

명세를 변경하면 명세를 참조하는 모든 객체가 무효화(INVALID)된다. **본문만 변경하면 명세 참조 객체는 영향 없다.** 이것이 패키지를 사용하는 핵심 이유다.

## 패키지 명세

공개로 노출할 타입, 상수, 변수, 프로시저/함수 시그니처를 선언한다.

```sql
CREATE OR REPLACE PACKAGE emp_mgr AS
  -- 공개 상수
  c_min_salary CONSTANT NUMBER := 2000;

  -- 공개 타입
  TYPE t_id_list IS TABLE OF NUMBER INDEX BY PLS_INTEGER;

  -- 프로시저 시그니처
  PROCEDURE hire_employee (
    p_name IN VARCHAR2,
    p_dept IN NUMBER,
    p_sal  IN NUMBER DEFAULT 3000
  );

  -- 함수 시그니처
  FUNCTION get_salary (p_emp_id IN NUMBER) RETURN NUMBER;

  -- 오버로딩: 같은 이름, 다른 파라미터 타입
  PROCEDURE log_action (p_id  IN NUMBER);
  PROCEDURE log_action (p_msg IN VARCHAR2);
END emp_mgr;
/
```

![PL/SQL 패키지 구조](/assets/posts/plsql-package-structure.svg)

---

## 패키지 본문

명세에서 선언된 모든 항목을 구현하고, 비공개 멤버를 추가한다.

```sql
CREATE OR REPLACE PACKAGE BODY emp_mgr AS
  -- 비공개 전역 변수 (본문 내에서만 접근 가능)
  g_call_count NUMBER := 0;

  PROCEDURE hire_employee (
    p_name IN VARCHAR2,
    p_dept IN NUMBER,
    p_sal  IN NUMBER DEFAULT 3000
  ) IS
  BEGIN
    IF p_sal < c_min_salary THEN
      RAISE_APPLICATION_ERROR(-20001, '최솟값 미달');
    END IF;
    INSERT INTO employees (last_name, department_id, salary)
    VALUES (p_name, p_dept, p_sal);
    g_call_count := g_call_count + 1;
  END hire_employee;

  FUNCTION get_salary (p_emp_id IN NUMBER) RETURN NUMBER IS
    v_sal NUMBER;
  BEGIN
    SELECT salary INTO v_sal
    FROM   employees
    WHERE  employee_id = p_emp_id;
    RETURN v_sal;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN RETURN NULL;
  END get_salary;

  PROCEDURE log_action (p_id IN NUMBER) IS
  BEGIN
    INSERT INTO audit_log (action_id) VALUES (p_id);
  END;

  PROCEDURE log_action (p_msg IN VARCHAR2) IS
  BEGIN
    INSERT INTO audit_log (action_msg) VALUES (p_msg);
  END;

  -- 초기화 섹션: 세션당 첫 패키지 접근 시 1회 실행
BEGIN
  g_call_count := 0;
  DBMS_OUTPUT.PUT_LINE('emp_mgr 패키지 초기화');
END emp_mgr;
/
```

---

## 초기화 섹션

패키지 본문 맨 끝에 `BEGIN ... END 패키지명;` 블록을 추가하면 **세션당 첫 번째 접근 시 한 번** 실행된다. 전역 변수 초기화, 설정 값 로드 등에 사용한다.

```sql
-- 초기화 섹션 예: NLS 설정 로드
BEGIN
  SELECT NLS_DATE_FORMAT INTO g_date_fmt
  FROM   nls_session_parameters
  WHERE  parameter = 'NLS_DATE_FORMAT';
END pkg_utils;
```

---

## 오버로딩

패키지 안에서는 **같은 이름의 서브프로그램을 파라미터 개수·타입이 다르면 여러 개 선언**할 수 있다.

```sql
-- 호출 시 파라미터에 따라 자동 선택
emp_mgr.log_action(100);     -- PROCEDURE log_action(p_id NUMBER)
emp_mgr.log_action('삭제');  -- PROCEDURE log_action(p_msg VARCHAR2)
```

오버로딩은 같은 논리적 동작을 다양한 입력 타입에 대응할 때 유용하다. 단, 반환 타입만 다른 오버로딩은 PL/SQL에서 지원하지 않는다.

---

## 패키지 호출

```sql
-- 프로시저 호출
BEGIN
  emp_mgr.hire_employee('Lee', 60, 4000);
END;
/

-- 함수를 SQL에서 직접 호출
SELECT emp_mgr.get_salary(100) FROM dual;

-- 공개 상수 참조
DECLARE v_sal NUMBER := emp_mgr.c_min_salary;
BEGIN NULL; END;
/
```

![패키지 초기화, 오버로딩, 호출](/assets/posts/plsql-package-features.svg)

---

## 패키지 전역 상태

패키지 전역 변수(`g_call_count`)는 **접속(세션) 단위로 독립적**으로 존재한다. 세션 A가 `g_call_count`를 5로 만들어도 세션 B에는 영향이 없다. 세션이 종료되면 상태가 소멸한다.

패키지 전역 변수는 세션 내 캐시·카운터·컨텍스트 전달에 유용하지만, **트랜잭션 커밋/롤백 영향을 받지 않는다**는 점에 주의해야 한다.

---

## 패키지 재컴파일

```sql
-- 명세 + 본문 재컴파일
ALTER PACKAGE emp_mgr COMPILE;

-- 본문만 재컴파일 (명세 의존 객체 무효화 없음)
ALTER PACKAGE emp_mgr COMPILE BODY;

-- 무효 객체 확인
SELECT object_name, object_type, status
FROM   user_objects
WHERE  status = 'INVALID';
```

본문을 변경할 때는 `COMPILE BODY`를 사용해야 명세 의존 객체들이 불필요하게 INVALID가 되지 않는다.

---

**지난 글:** [PL/SQL 변수, 커서, 예외](/posts/plsql-variables-cursors-exceptions/)

**다음 글:** [PL/SQL 트리거, 시퀀스, 시노님](/posts/plsql-trigger-sequence-synonym/)

<br>
읽어주셔서 감사합니다. 😊
