---
title: "PostgreSQL 트리거 함수 — BEFORE·AFTER·INSTEAD OF 완전 가이드"
description: "PostgreSQL 트리거의 BEFORE/AFTER/INSTEAD OF 실행 시점, ROW/STATEMENT 레벨 차이, 트리거 함수에서 NEW·OLD·TG_OP 등 특수 변수 사용법, 감사 로그·뷰 갱신 패턴, CONSTRAINT TRIGGER와 무한 루프 방지를 실전 예제로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["postgresql", "trigger", "before-trigger", "after-trigger", "instead-of", "row-level", "statement-level", "audit-log", "constraint-trigger", "plpgsql"]
featured: false
draft: false
---

[지난 글](/posts/pg-plpgsql-control-flow/)에서 PL/pgSQL의 제어 흐름 전반을 다뤘다. 이번에는 데이터 변경 이벤트에 자동으로 반응하는 **트리거(Trigger)**를 본격적으로 살펴본다. 트리거는 감사 로그, 데이터 정합성 보정, 뷰 갱신 등 광범위한 자동화에 활용된다.

## 트리거란 무엇인가

트리거는 테이블(또는 뷰)에 `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE` 이벤트가 발생할 때 자동으로 호출되는 함수다. 두 부분으로 구성된다.

1. **트리거 함수** — `RETURNS trigger`를 반환하는 PL/pgSQL(또는 C) 함수
2. **트리거 정의** — `CREATE TRIGGER`로 함수를 테이블·이벤트에 연결

두 개념의 분리가 Oracle 트리거와 다른 중요한 차이점이다. 동일한 트리거 함수를 여러 테이블·이벤트에 재사용할 수 있다.

## 실행 시점: BEFORE · AFTER · INSTEAD OF

![트리거 실행 흐름](/assets/posts/pg-trigger-function-lifecycle.svg)

| 시점 | 적용 대상 | 특징 |
|------|-----------|------|
| `BEFORE` | 테이블 | 실제 변경 전 실행. ROW 레벨이면 `RETURN NEW`로 값 수정 가능 |
| `AFTER` | 테이블 | 변경 완료 후 실행. 감사 로그, 파생 테이블 갱신에 적합 |
| `INSTEAD OF` | 뷰 | DML을 완전 대체. 조인 뷰 등 기본 키 없는 뷰에 쓰기 가능하게 함 |

## ROW 레벨 vs STATEMENT 레벨

- `FOR EACH ROW` — 변경되는 행마다 한 번씩 호출. `NEW`·`OLD` 변수로 개별 행 접근 가능
- `FOR EACH STATEMENT` — 문장 전체에 한 번만 호출. `NEW`·`OLD` 없음, 대신 Transition Table(`OLD TABLE`/`NEW TABLE`) 사용

대량 `UPDATE`에서 ROW 레벨 트리거를 잘못 쓰면 성능에 치명적이다. 1백만 행 업데이트면 트리거가 1백만 번 실행된다.

## 트리거 함수 작성

![트리거 함수 코드 패턴](/assets/posts/pg-trigger-function-code.svg)

```sql
-- 트리거 함수: RETURNS trigger 필수
CREATE OR REPLACE FUNCTION log_changes()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO audit_log(op, tbl, new_data, changed_at)
  VALUES (TG_OP, TG_TABLE_NAME, row_to_json(NEW), now());
  RETURN NEW;  -- AFTER 트리거는 이 값을 무시하지만 NULL을 피하는 관례
END;
$$;

-- 트리거 등록
CREATE TRIGGER trg_orders_audit
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW
EXECUTE FUNCTION log_changes();
```

### 트리거 특수 변수

| 변수 | 타입 | 설명 |
|------|------|------|
| `NEW` | RECORD | INSERT·UPDATE 후 행. DELETE에서는 NULL |
| `OLD` | RECORD | UPDATE·DELETE 전 행. INSERT에서는 NULL |
| `TG_OP` | text | `'INSERT'`, `'UPDATE'`, `'DELETE'`, `'TRUNCATE'` |
| `TG_TABLE_NAME` | name | 트리거가 걸린 테이블 이름 |
| `TG_WHEN` | text | `'BEFORE'`, `'AFTER'`, `'INSTEAD OF'` |
| `TG_LEVEL` | text | `'ROW'` 또는 `'STATEMENT'` |
| `TG_ARGV` | text[] | `CREATE TRIGGER ... EXECUTE FUNCTION f(arg1, arg2)` 인자 |

## BEFORE ROW 트리거로 값 보정

`BEFORE ROW` 트리거에서 `NEW`를 수정하고 `RETURN NEW`하면 실제 저장되는 값을 바꿀 수 있다.

```sql
CREATE OR REPLACE FUNCTION normalize_email()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.email := lower(trim(NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_normalize
BEFORE INSERT OR UPDATE OF email ON users
FOR EACH ROW EXECUTE FUNCTION normalize_email();
```

`RETURN NULL`을 반환하면 해당 행의 변경 자체가 취소된다. 이 메커니즘으로 소프트 필터링이 가능하다.

## INSTEAD OF 트리거 — 조인 뷰에 쓰기

뷰에는 기본적으로 INSERT·UPDATE·DELETE가 불가능하다. `INSTEAD OF` 트리거를 등록하면 베이스 테이블에 실제 DML을 위임할 수 있다.

```sql
CREATE VIEW order_summary AS
  SELECT o.id, o.total, c.name AS customer
  FROM orders o JOIN customers c ON o.customer_id = c.id;

CREATE OR REPLACE FUNCTION upsert_order_summary()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO orders(total, customer_id) VALUES (NEW.total, ...);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_order_summary_ins
INSTEAD OF INSERT ON order_summary
FOR EACH ROW EXECUTE FUNCTION upsert_order_summary();
```

## WHEN 조건 — 불필요한 실행 줄이기

트리거에 `WHEN` 절을 추가하면 조건을 만족하는 행만 트리거를 실행한다. 함수 호출 오버헤드 자체를 줄여준다.

```sql
CREATE TRIGGER trg_status_change
AFTER UPDATE OF status ON orders
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION notify_status_change();
```

`IS DISTINCT FROM`은 NULL-safe 비교로, `OLD.status = NEW.status`와 달리 NULL 변화도 감지한다.

## CONSTRAINT TRIGGER

`CONSTRAINT TRIGGER`는 `DEFERRABLE` 옵션과 결합해 트랜잭션 커밋 시점까지 실행을 지연할 수 있다.

```sql
CREATE CONSTRAINT TRIGGER trg_balance_check
AFTER INSERT OR UPDATE ON transactions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_account_balance();
```

트랜잭션 중간에는 잠시 불균형 상태를 허용하고, 커밋 직전에 한 번에 검증하는 패턴이다.

## 무한 루프 방지

트리거 함수 내에서 같은 테이블에 DML을 실행하면 트리거가 재귀 호출된다. 방지 방법:

```sql
-- pg_trigger_depth()로 재귀 차단
CREATE OR REPLACE FUNCTION safe_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  -- ... 로직
  RETURN NEW;
END;
$$;
```

`pg_trigger_depth()`가 1보다 크면 이미 트리거 내부에서 재호출된 것이므로 즉시 반환한다.

## 트리거 관리

```sql
-- 트리거 비활성화 (테이블 전체 마이그레이션 등)
ALTER TABLE orders DISABLE TRIGGER trg_orders_audit;
ALTER TABLE orders ENABLE TRIGGER trg_orders_audit;

-- 세션 내 모든 트리거 비활성화 (슈퍼유저)
SET session_replication_role = 'replica';

-- 트리거 목록 조회
SELECT trigger_name, event_manipulation, action_timing, action_orientation
FROM information_schema.triggers
WHERE event_object_table = 'orders';
```

## 성능 고려 사항

- **ROW 레벨 AFTER 트리거**는 변경된 행마다 함수 호출 비용이 발생한다. 대량 배치에는 STATEMENT 레벨을 우선 검토한다.
- `WHEN` 조건으로 불필요한 호출을 사전 차단하면 오버헤드를 크게 줄일 수 있다.
- 감사 로그를 동기 트리거로 구현하면 원래 트랜잭션 속도에 영향을 준다. 중요한 경우 `pg_notify` + 비동기 리스너로 분리하는 방안도 검토한다.

트리거는 강력하지만 숨겨진 로직이 되기 쉽다. ORM이나 애플리케이션 레이어에서 INSERT를 실행할 때 트리거가 개입하는지 항상 문서화해두는 것이 좋다.

---

**지난 글:** [PL/pgSQL 제어 흐름 — IF, LOOP, EXCEPTION 완전 가이드](/posts/pg-plpgsql-control-flow/)

**다음 글:** [PostgreSQL 프로시저 — CALL과 트랜잭션 제어](/posts/pg-procedure-call/)

<br>
읽어주셔서 감사합니다. 😊
