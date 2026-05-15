---
title: "PostgreSQL 프로시저 — CALL과 트랜잭션 제어"
description: "PostgreSQL 11에서 추가된 PROCEDURE의 함수와의 차이점, CALL 호출 문법, PROCEDURE 내부에서 COMMIT·ROLLBACK으로 분할 커밋하는 대용량 배치 패턴, INOUT 파라미터 활용법을 실전 예제로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["postgresql", "procedure", "call", "commit", "rollback", "batch-processing", "inout", "transaction-control", "plpgsql"]
featured: false
draft: false
---

[지난 글](/posts/pg-trigger-function/)에서 트리거 함수의 작성과 실행 시점을 살펴봤다. 이번에는 PostgreSQL 11에서 추가된 **프로시저(PROCEDURE)**를 다룬다. 함수와 비슷해 보이지만, 내부에서 `COMMIT`·`ROLLBACK`을 직접 실행할 수 있다는 점이 결정적으로 다르다.

## 왜 PROCEDURE가 필요했나

SQL 함수는 항상 호출자의 트랜잭션 내에서 실행된다. 100만 건을 처리하는 배치 작업을 함수로 짜면 전체가 하나의 트랜잭션이 되어 잠금이 누적되고, 중간에 실패하면 전부 롤백해야 한다. PROCEDURE는 내부에서 트랜잭션을 분할해 N건씩 커밋할 수 있다.

PostgreSQL은 오랫동안 함수(FUNCTION)만 지원했다. PostgreSQL 11(2018)에서 ANSI SQL 표준의 PROCEDURE를 공식 지원하며 이 문제를 해결했다.

## 함수 vs 프로시저

![PostgreSQL 함수 vs 프로시저 비교](/assets/posts/pg-procedure-call-vs-function.svg)

가장 중요한 차이는 **트랜잭션 제어 가능 여부**다. 함수는 호출자 트랜잭션에 완전히 종속되지만, 프로시저는 내부에서 `COMMIT`·`ROLLBACK`을 자유롭게 실행할 수 있다.

또 다른 차이는 **호출 방법**이다. 함수는 `SELECT my_func()` 또는 표현식 안에서 호출하지만, 프로시저는 반드시 `CALL` 문으로 호출해야 한다.

## 프로시저 만들기

```sql
CREATE OR REPLACE PROCEDURE greet_user(p_name TEXT)
LANGUAGE plpgsql AS $$
BEGIN
  RAISE NOTICE 'Hello, %!', p_name;
END;
$$;

-- 호출
CALL greet_user('PostgreSQL');
```

`RETURNS` 절이 없다는 점이 함수와 다르다. 값을 돌려줘야 한다면 `INOUT` 파라미터를 사용한다.

## INOUT 파라미터로 출력값 전달

```sql
CREATE OR REPLACE PROCEDURE count_orders(
  p_customer_id  INT,
  INOUT p_count  INT DEFAULT 0
)
LANGUAGE plpgsql AS $$
BEGIN
  SELECT COUNT(*) INTO p_count
  FROM orders
  WHERE customer_id = p_customer_id;
END;
$$;

-- 호출: 변수를 넘기면 결과가 채워진다
DO $$
DECLARE v_cnt INT;
BEGIN
  CALL count_orders(42, v_cnt);
  RAISE NOTICE 'Count: %', v_cnt;
END;
$$;
```

`INOUT`은 입력과 출력 모두 가능한 파라미터다. `CALL` 시 변수를 넘기면 프로시저 종료 후 변수에 결과가 들어온다.

## 핵심 패턴: 분할 커밋 배치

![PROCEDURE 분할 커밋 흐름](/assets/posts/pg-procedure-call-transaction.svg)

대용량 데이터를 배치로 처리할 때 가장 강력한 패턴이다.

```sql
CREATE OR REPLACE PROCEDURE batch_archive(batch_size INT DEFAULT 5000)
LANGUAGE plpgsql AS $$
DECLARE
  v_deleted INT;
BEGIN
  LOOP
    DELETE FROM logs
    WHERE id IN (
      SELECT id FROM logs
      WHERE created_at < now() - '90 days'::interval
      LIMIT batch_size
      FOR UPDATE SKIP LOCKED
    );
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    EXIT WHEN v_deleted = 0;

    COMMIT;  -- 함수에서는 불가능한 중간 커밋
    PERFORM pg_sleep(0.01);  -- 다른 세션 양보
  END LOOP;
END;
$$;

CALL batch_archive(5000);
```

`COMMIT` 후 다음 반복이 시작되면 이전 배치의 잠금이 모두 해제된다. `SKIP LOCKED`는 다른 세션이 이미 잠근 행을 건너뛰어 병렬 배치 처리도 가능하게 한다.

## ROLLBACK TO SAVEPOINT

프로시저 내에서 `SAVEPOINT`도 사용할 수 있다.

```sql
CREATE OR REPLACE PROCEDURE upsert_with_retry(p_id INT, p_val TEXT)
LANGUAGE plpgsql AS $$
BEGIN
  LOOP
    BEGIN
      INSERT INTO t VALUES (p_id, p_val);
      COMMIT;
      RETURN;
    EXCEPTION WHEN unique_violation THEN
      -- 충돌 시 재시도
    END;
  END LOOP;
END;
$$;
```

단, `COMMIT` 이후에는 이전 `SAVEPOINT`가 사라진다. 분할 커밋 구간마다 새로운 트랜잭션이 시작되는 개념이다.

## 프로시저에서 함수 호출

프로시저 내에서 함수를 호출하는 것은 완전히 자유롭다. 반대로 **함수에서 프로시저를 CALL할 수는 없다**. 함수는 트랜잭션 제어를 가질 수 없기 때문에 트랜잭션을 관리하는 프로시저를 포함할 수 없다.

```sql
-- 함수에서 프로시저 호출: 불가
CREATE FUNCTION bad_func() RETURNS void AS $$
BEGIN
  CALL batch_archive(100);  -- 오류: cannot CALL procedure from function
END;
$$ LANGUAGE plpgsql;
```

## 언제 PROCEDURE를 쓰고 언제 FUNCTION을 쓰나

| 상황 | 권장 |
|------|------|
| SELECT에서 호출하거나 반환값이 필요한 경우 | FUNCTION |
| 대용량 배치·정기 정리 작업 (분할 커밋 필요) | PROCEDURE |
| 트리거 함수 | FUNCTION (RETURNS trigger) |
| 단순 로직, 트랜잭션 제어 불필요 | FUNCTION |

대부분의 업무 로직은 함수로 충분하다. 프로시저는 "중간 커밋이 반드시 필요한 배치 작업"에 집중해서 사용하는 것이 좋다.

## 프로시저 관리

```sql
-- 목록 조회
SELECT proname, prokind  -- 'f'=function, 'p'=procedure
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace;

-- 삭제
DROP PROCEDURE batch_archive(INT);

-- 권한 부여
GRANT EXECUTE ON PROCEDURE batch_archive(INT) TO batch_role;
```

---

**지난 글:** [PostgreSQL 트리거 함수 — BEFORE·AFTER·INSTEAD OF 완전 가이드](/posts/pg-trigger-function/)

**다음 글:** [PostgreSQL 언어 옵션 — SQL, PL/pgSQL, PL/Python, PL/v8](/posts/pg-language-options/)

<br>
읽어주셔서 감사합니다. 😊
