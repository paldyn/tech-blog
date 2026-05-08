---
title: "PL/SQL 컬렉션"
description: "PL/SQL의 세 가지 컬렉션 유형(Associative Array, Nested Table, VARRAY)의 특성 비교, 메서드 활용, 그리고 BULK COLLECT로 대량 데이터를 효율적으로 처리하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["oracle", "plsql", "collections", "associative-array", "nested-table", "varray", "bulk-collect", "forall", "index-by", "extend"]
featured: false
draft: false
---

[지난 글](/posts/plsql-trigger-sequence-synonym/)에서 트리거·시퀀스·시노님을 다뤘다. 이번에는 PL/SQL에서 다중 값을 다루는 **컬렉션(Collection)** 세 가지 유형을 비교하고 실무 활용 패턴을 살펴본다.

## 컬렉션 세 가지 유형

### 1. Associative Array (INDEX BY Table)

가장 자주 사용하는 유형이다. 초기화 없이 바로 사용할 수 있고, 인덱스로 숫자뿐 아니라 문자열도 사용할 수 있다.

```sql
DECLARE
  -- 숫자 인덱스
  TYPE t_sal_map IS TABLE OF NUMBER INDEX BY PLS_INTEGER;
  v_salaries t_sal_map;

  -- 문자열 인덱스 (해시 맵처럼 활용)
  TYPE t_dept_map IS TABLE OF VARCHAR2(100) INDEX BY VARCHAR2(30);
  v_depts t_dept_map;
BEGIN
  v_salaries(100) := 5000;
  v_salaries(200) := 8000;

  v_depts('IT')      := '정보기술';
  v_depts('FINANCE') := '재무';

  DBMS_OUTPUT.PUT_LINE(v_salaries.COUNT);  -- 2
  DBMS_OUTPUT.PUT_LINE(v_depts('IT'));     -- 정보기술
END;
/
```

데이터베이스 컬럼에 저장할 수 없지만 PL/SQL 내 캐시·룩업 테이블로는 가장 편리하다.

### 2. Nested Table

Associative Array와 비슷하지만 초기화가 필요하고 데이터베이스 컬럼에 저장할 수 있다.

```sql
DECLARE
  TYPE t_names IS TABLE OF VARCHAR2(50);
  v_names t_names := t_names();  -- 빈 컬렉션으로 초기화
BEGIN
  v_names.EXTEND;
  v_names(1) := 'Kim';
  v_names.EXTEND;
  v_names(2) := 'Lee';

  FOR i IN 1..v_names.COUNT LOOP
    DBMS_OUTPUT.PUT_LINE(i || ': ' || v_names(i));
  END LOOP;
END;
/
```

`DELETE(i)`로 원소를 삭제하면 **희소(Sparse)** 컬렉션이 된다. 희소 컬렉션은 `NEXT()` 메서드로 순회해야 한다.

### 3. VARRAY

최대 크기를 선언해야 하는 배열이다. 저장 순서가 보장되고 데이터베이스에도 저장할 수 있다.

```sql
DECLARE
  TYPE t_tags IS VARRAY(5) OF VARCHAR2(30);  -- 최대 5개
  v_tags t_tags := t_tags('SQL', 'Oracle', 'PL/SQL');
BEGIN
  DBMS_OUTPUT.PUT_LINE(v_tags.COUNT);  -- 3
END;
/
```

![PL/SQL 컬렉션 유형 비교](/assets/posts/plsql-collections-types.svg)

---

## 컬렉션 메서드

| 메서드 | 설명 |
|--------|------|
| `COUNT` | 현재 원소 개수 |
| `FIRST` | 첫 번째 인덱스 |
| `LAST` | 마지막 인덱스 |
| `EXISTS(i)` | i번 원소 존재 여부 |
| `EXTEND` | 원소 1개 추가 공간 확보 |
| `EXTEND(n)` | n개 추가 공간 확보 |
| `DELETE` | 전체 삭제 |
| `DELETE(i)` | i번 원소 삭제 |
| `NEXT(i)` | i 다음 인덱스 반환 |
| `PRIOR(i)` | i 이전 인덱스 반환 |

`EXTEND`와 `DELETE`는 Nested Table과 VARRAY에만 적용된다. Associative Array는 자동으로 크기가 조정된다.

```sql
-- 희소 컬렉션 안전 순회
DECLARE
  TYPE t_map IS TABLE OF NUMBER INDEX BY PLS_INTEGER;
  v_map t_map;
  i PLS_INTEGER;
BEGIN
  v_map(1) := 100;
  v_map(3) := 300;   -- 2번 인덱스 없음 (희소)
  v_map(5) := 500;

  i := v_map.FIRST;
  WHILE i IS NOT NULL LOOP
    DBMS_OUTPUT.PUT_LINE(i || ' => ' || v_map(i));
    i := v_map.NEXT(i);
  END LOOP;
END;
/
```

---

## BULK COLLECT — 컬렉션으로 대량 데이터 적재

행 단위로 FETCH하면 PL/SQL과 SQL 엔진 간 컨텍스트 스위치가 행마다 발생한다. `BULK COLLECT`는 한 번의 SQL 실행으로 여러 행을 컬렉션에 한꺼번에 적재해 이 비용을 최소화한다.

```sql
DECLARE
  TYPE t_emp_tab IS TABLE OF employees%ROWTYPE;
  v_emps t_emp_tab;
BEGIN
  -- 전체 결과를 한 번에 (소용량 테이블)
  SELECT * BULK COLLECT INTO v_emps
  FROM   employees
  WHERE  department_id = 60;

  DBMS_OUTPUT.PUT_LINE(v_emps.COUNT || '건 로드');
END;
/
```

### LIMIT으로 청크 처리

수백만 행을 한 번에 컬렉션에 담으면 SGA 메모리를 과도하게 사용한다. `LIMIT` 절로 청크 크기를 제한한다.

```sql
DECLARE
  TYPE t_rows IS TABLE OF orders%ROWTYPE;
  v_rows t_rows;
  CURSOR c_old IS SELECT * FROM orders WHERE status = 'COMPLETED';
BEGIN
  OPEN c_old;
  LOOP
    FETCH c_old BULK COLLECT INTO v_rows LIMIT 2000;
    EXIT WHEN v_rows.COUNT = 0;

    -- 배치 처리
    FOR i IN 1..v_rows.COUNT LOOP
      -- 각 행 처리
      NULL;
    END LOOP;
    COMMIT;  -- 청크 단위 커밋
  END LOOP;
  CLOSE c_old;
END;
/
```

적절한 LIMIT 값은 행의 폭과 PGA 설정에 따라 다르지만 500~5000 사이가 일반적이다.

![컬렉션 메서드와 BULK COLLECT](/assets/posts/plsql-collections-methods.svg)

---

## FORALL — 컬렉션을 한 번에 DML

`BULK COLLECT`가 SELECT를 대량화하는 것처럼, `FORALL`은 DML을 대량화한다.

```sql
DECLARE
  TYPE t_ids IS TABLE OF employees.employee_id%TYPE;
  v_ids t_ids := t_ids(100, 101, 102, 103);
BEGIN
  -- 루프 대신 FORALL: 단 1번의 SQL 엔진 호출
  FORALL i IN 1..v_ids.COUNT
    UPDATE employees
    SET    salary = salary * 1.1
    WHERE  employee_id = v_ids(i);

  DBMS_OUTPUT.PUT_LINE(SQL%ROWCOUNT || '행 갱신');
END;
/
```

`FORALL`과 `BULK COLLECT`를 조합하면 대용량 배치 처리 성능이 크게 향상된다.

---

**지난 글:** [PL/SQL 트리거, 시퀀스, 시노님](/posts/plsql-trigger-sequence-synonym/)

<br>
읽어주셔서 감사합니다. 😊
