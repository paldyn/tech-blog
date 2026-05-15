---
title: "PL/pgSQL 제어 흐름 — IF, LOOP, EXCEPTION 완전 가이드"
description: "PL/pgSQL의 IF/ELSIF/ELSE 조건문, LOOP/WHILE/FOR 루프, EXIT와 CONTINUE로 흐름 제어, EXCEPTION 블록으로 오류 처리, 커서(CURSOR)로 대량 결과 처리, RAISE로 메시지 출력하는 방법을 실전 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["postgresql", "plpgsql", "control-flow", "if-elsif", "loop", "for-loop", "exception", "cursor", "raise", "error-handling"]
featured: false
draft: false
---

[지난 글](/posts/pg-create-function-sql-plpgsql/)에서 SQL 함수와 PL/pgSQL 함수의 기본 구조를 살펴봤다. 이번에는 PL/pgSQL의 핵심인 **제어 흐름(Control Flow)** 전체를 다룬다. 조건문, 루프, 예외 처리, 커서까지 실전에서 자주 쓰는 패턴 중심으로 설명한다.

## IF / ELSIF / ELSE

PL/pgSQL의 조건문은 SQL의 CASE WHEN과 달리 절차적으로 동작한다.

```sql
CREATE OR REPLACE FUNCTION classify_order(amount numeric)
RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    IF amount IS NULL THEN
        RETURN 'unknown';
    ELSIF amount >= 1000000 THEN
        RETURN 'large';
    ELSIF amount >= 100000 THEN
        RETURN 'medium';
    ELSE
        RETURN 'small';
    END IF;
END;
$$;
```

`ELSIF`에 주목하자. SQL의 `ELSE IF`가 아니라 `ELSIF`다. PL/pgSQL 특유의 문법이다.

## CASE 문

SQL의 CASE 표현식과 다르게, PL/pgSQL의 CASE는 문장(statement)이다.

```sql
CREATE OR REPLACE FUNCTION status_label(code int)
RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    label text;
BEGIN
    CASE code
        WHEN 1 THEN label := 'active';
        WHEN 2 THEN label := 'pending';
        WHEN 3 THEN label := 'deleted';
        ELSE       label := 'unknown';
    END CASE;
    RETURN label;
END;
$$;
```

## 루프 종류

![PL/pgSQL 루프 종류](/assets/posts/pg-plpgsql-control-flow-loops.svg)

### LOOP / EXIT / CONTINUE

```sql
-- 기본 LOOP: EXIT WHEN으로 탈출
CREATE OR REPLACE FUNCTION fibonacci(n int)
RETURNS bigint
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    a bigint := 0;
    b bigint := 1;
    i int    := 0;
    tmp bigint;
BEGIN
    LOOP
        EXIT WHEN i >= n;
        tmp := a + b;
        a   := b;
        b   := tmp;
        i   := i + 1;
    END LOOP;
    RETURN a;
END;
$$;
```

`CONTINUE`는 현재 반복을 건너뛰고 다음 반복으로 넘어간다. `EXIT WHEN`과 `CONTINUE WHEN`은 조건을 같은 줄에 쓸 수 있어 가독성이 좋다.

### FOR 루프 (정수 범위)

```sql
-- 정수 범위 FOR 루프
CREATE OR REPLACE FUNCTION generate_slots(start_hour int, end_hour int)
RETURNS TABLE (slot_time text)
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
    FOR h IN start_hour..end_hour LOOP
        slot_time := lpad(h::text, 2, '0') || ':00';
        RETURN NEXT;
        slot_time := lpad(h::text, 2, '0') || ':30';
        RETURN NEXT;
    END LOOP;
END;
$$;

-- REVERSE: 역순 순회
FOR i IN REVERSE 10..1 LOOP
    RAISE NOTICE 'i = %', i;
END LOOP;
```

### FOR 루프 (쿼리 결과)

```sql
-- 쿼리 결과 행마다 실행
CREATE OR REPLACE FUNCTION recalc_user_tiers()
RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
    rec RECORD;
BEGIN
    FOR rec IN
        SELECT id, email FROM users WHERE is_active = true
    LOOP
        UPDATE users
        SET    tier = get_user_tier(rec.id)
        WHERE  id   = rec.id;

        -- 1000행마다 로그
        IF (rec.id % 1000 = 0) THEN
            RAISE NOTICE 'processed user %', rec.id;
        END IF;
    END LOOP;
END;
$$;
```

## EXCEPTION 블록

EXCEPTION 블록은 BEGIN~END 안에서 예외를 잡는다. 예외가 발생하면 EXCEPTION 절로 점프하고, 매칭되는 `WHEN` 절을 실행한다.

```sql
CREATE OR REPLACE FUNCTION safe_insert_user(
    p_email text,
    p_name  text
)
RETURNS bigint
LANGUAGE plpgsql AS $$
DECLARE
    new_id bigint;
BEGIN
    INSERT INTO users (email, name)
    VALUES (p_email, p_name)
    RETURNING id INTO new_id;

    RETURN new_id;

EXCEPTION
    WHEN unique_violation THEN
        -- 이미 존재하면 기존 ID 반환
        SELECT id INTO new_id FROM users WHERE email = p_email;
        RETURN new_id;
    WHEN not_null_violation THEN
        RAISE EXCEPTION 'email and name are required'
            USING ERRCODE = 'P0001';  -- 커스텀 SQLSTATE
    WHEN others THEN
        RAISE WARNING 'Unexpected error: % %', SQLSTATE, SQLERRM;
        RETURN NULL;
END;
$$;
```

주요 예외 조건 이름: `unique_violation`, `not_null_violation`, `foreign_key_violation`, `check_violation`, `division_by_zero`, `no_data_found`, `too_many_rows`, `others`(전부).

## 커서(Cursor)

대량 데이터를 한 번에 메모리에 올리지 않고 행 단위로 처리할 때 커서를 쓴다.

![커서(Cursor) — 대량 결과를 청크 단위로 처리](/assets/posts/pg-plpgsql-control-flow-cursor.svg)

```sql
-- 명시적 커서로 배치 처리
CREATE OR REPLACE FUNCTION batch_send_notifications(batch_size int DEFAULT 100)
RETURNS int
LANGUAGE plpgsql AS $$
DECLARE
    cur     CURSOR FOR
            SELECT id, email FROM notifications WHERE sent = false
            ORDER BY id
            FOR UPDATE SKIP LOCKED;
    rec     RECORD;
    cnt     int := 0;
BEGIN
    OPEN cur;
    LOOP
        FETCH NEXT FROM cur INTO rec;
        EXIT WHEN NOT FOUND;

        -- 알림 발송 로직 (외부 호출 등)
        UPDATE notifications SET sent = true, sent_at = now()
        WHERE CURRENT OF cur;  -- 커서 현재 위치 UPDATE

        cnt := cnt + 1;
        EXIT WHEN cnt >= batch_size;
    END LOOP;
    CLOSE cur;

    RETURN cnt;
END;
$$;
```

`WHERE CURRENT OF cursor_name`은 커서가 현재 가리키는 행을 직접 UPDATE/DELETE할 수 있는 편리한 문법이다.

## RAISE로 디버깅 및 에러

```sql
-- 로그 레벨별 RAISE
RAISE DEBUG   '값: %', some_var;    -- log_min_messages=debug 시 출력
RAISE INFO    '처리 시작: %', now();
RAISE NOTICE  '행 수: %', cnt;      -- client_min_messages=notice 시 클라이언트 출력
RAISE WARNING '느린 쿼리 감지: %ms', elapsed;
RAISE EXCEPTION '필수 파라미터 누락';  -- 트랜잭션 롤백

-- USING으로 세부 정보 추가
RAISE EXCEPTION '사용자 % 미존재', user_id
    USING ERRCODE = '20001',
          DETAIL  = 'id=' || user_id,
          HINT    = 'users 테이블에서 ID를 확인하세요';
```

`%`는 인수 값 치환 자리표시자다. 여러 `%`가 있으면 뒤에 인수를 순서대로 나열한다.

---

**지난 글:** [PostgreSQL 함수 작성 — SQL과 PL/pgSQL 기초](/posts/pg-create-function-sql-plpgsql/)

<br>
읽어주셔서 감사합니다. 😊
