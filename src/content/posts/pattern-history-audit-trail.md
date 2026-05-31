---
title: "변경 이력 추적 — 히스토리 테이블 패턴"
description: "데이터의 변경 이력을 전체적으로 추적하는 히스토리 테이블 패턴을 설명합니다. 트리거로 INSERT/UPDATE/DELETE를 자동 기록하는 방법, JSONB를 사용한 범용 감사 로그, Temporal Table, 그리고 이벤트 소싱과의 차이를 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["히스토리 테이블", "감사 로그", "트리거", "JSONB", "변경 이력", "Temporal Table"]
featured: false
draft: false
---

[지난 글](/posts/pattern-audit-columns/)에서 `created_at`, `updated_at` 같은 감사 컬럼을 살펴봤습니다. 감사 컬럼은 "마지막으로 누가 언제 바꿨는지"는 알려주지만 "무엇이 어떻게 바뀌었는지"는 알 수 없습니다. 전체 변경 이력이 필요하다면 **히스토리 테이블(History Table)** 패턴을 사용합니다.

## 히스토리 테이블의 목적

- **규제 준수**: 금융, 의료, 법률 도메인에서 데이터 변경의 완전한 이력을 보관
- **버그 추적**: "3일 전에 이 값이 왜 바뀌었는가" 디버깅
- **복구**: 실수로 수정된 값을 이전 상태로 되돌리기
- **감사(Audit)**: "누가 이 데이터를 열람·수정했는지" 증적 보존

## 히스토리 테이블 설계

히스토리 테이블은 원본 테이블의 구조를 가지되, 히스토리 메타데이터 컬럼이 추가됩니다.

```sql
-- 원본 테이블
CREATE TABLE orders (
  id         BIGSERIAL PRIMARY KEY,
  status     VARCHAR(20) NOT NULL DEFAULT 'pending',
  amount     NUMERIC(12, 2) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 히스토리 테이블 (원본 테이블 컬럼 + 이력 컬럼)
CREATE TABLE orders_history (
  hist_id    BIGSERIAL PRIMARY KEY,
  order_id   BIGINT NOT NULL,  -- FK 없음! 삭제된 주문 이력도 유지
  action     VARCHAR(10) NOT NULL,  -- INSERT / UPDATE / DELETE
  old_data   JSONB,    -- 변경 전 전체 행 (UPDATE/DELETE)
  new_data   JSONB,    -- 변경 후 전체 행 (INSERT/UPDATE)
  changed_by VARCHAR(100),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_history_order_id ON orders_history(order_id, changed_at DESC);
```

히스토리 테이블에는 원본 테이블의 PK에 대한 외래 키를 **추가하지 않습니다**. 원본이 삭제되어도 이력은 남아야 하기 때문입니다.

![히스토리 테이블 구조와 트리거 흐름](/assets/posts/pattern-history-audit-trail-design.svg)

## PostgreSQL 트리거로 자동화

트리거를 이용하면 모든 INSERT/UPDATE/DELETE를 자동으로 히스토리 테이블에 기록합니다.

![PostgreSQL 감사 트리거 함수](/assets/posts/pattern-history-audit-trail-trigger.svg)

```sql
-- 트리거 완성 (함수 + 실행 선언)
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO audit_log (
    table_name, action, old_data, new_data, changed_by, changed_at
  ) VALUES (
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) END,
    current_setting('app.current_user', true),
    NOW()
  );
  RETURN COALESCE(NEW, OLD);
END; $$;

-- orders 테이블에 트리거 등록
CREATE TRIGGER orders_audit
  AFTER INSERT OR UPDATE OR DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();
```

이 함수는 `TG_TABLE_NAME`과 `TG_OP`를 동적으로 사용하므로 여러 테이블에 동일하게 적용할 수 있습니다. `current_setting('app.current_user', true)`는 PostgreSQL 세션 변수로, 애플리케이션에서 트랜잭션 시작 시 설정합니다.

```sql
-- 애플리케이션에서 세션 변수 설정
SET LOCAL app.current_user = 'user:42';
UPDATE orders SET status = 'shipped' WHERE id = 1001;
-- 트리거가 자동으로 audit_log에 changed_by = 'user:42' 기록
```

## 이력 조회 예시

```sql
-- 특정 주문의 전체 변경 이력
SELECT
  changed_at,
  action,
  changed_by,
  old_data->>'status' AS old_status,
  new_data->>'status' AS new_status,
  old_data->>'amount' AS old_amount,
  new_data->>'amount' AS new_amount
FROM   orders_history
WHERE  order_id = 1001
ORDER  BY changed_at;

-- 특정 시점의 데이터 복원 (Point-in-Time Recovery)
SELECT new_data
FROM   orders_history
WHERE  order_id   = 1001
  AND  changed_at <= '2024-03-10 12:00:00'::timestamptz
ORDER  BY changed_at DESC
LIMIT  1;
```

## Temporal Table (SQL:2011 표준)

일부 DBMS는 히스토리 테이블을 자동으로 관리하는 **Temporal Table**을 지원합니다.

```sql
-- MariaDB / MySQL 8.0 System-Versioned Table
CREATE TABLE orders (
  id     BIGINT PRIMARY KEY,
  status VARCHAR(20),
  amount NUMERIC(12,2),
  row_start DATETIME(6) GENERATED ALWAYS AS ROW START INVISIBLE,
  row_end   DATETIME(6) GENERATED ALWAYS AS ROW END   INVISIBLE,
  PERIOD FOR SYSTEM_TIME(row_start, row_end)
) WITH SYSTEM VERSIONING;

-- 과거 특정 시점 조회
SELECT * FROM orders
FOR SYSTEM_TIME AS OF '2024-03-10 12:00:00'
WHERE id = 1001;
```

SQL Server는 `SYSTEM_VERSIONED TEMPORAL TABLE`로 동일한 기능을 제공합니다. PostgreSQL은 네이티브 지원이 없고 트리거 기반 확장(temporal_tables)을 사용합니다.

## 저장 공간과 성능 고려사항

히스토리 테이블은 원본 데이터보다 훨씬 크게 자랄 수 있습니다. 관리 전략이 필요합니다.

```sql
-- 오래된 이력 아카이브 (2년 이상)
INSERT INTO orders_history_archive
SELECT * FROM orders_history
WHERE  changed_at < NOW() - INTERVAL '2 years';

DELETE FROM orders_history
WHERE  changed_at < NOW() - INTERVAL '2 years';

-- 또는 파티셔닝으로 자동 관리
CREATE TABLE orders_history_2024 PARTITION OF orders_history
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```

감사 이력 데이터는 일반적으로 **쓰기 중심**이므로 인덱스를 최소화합니다. 조회가 필요한 컬럼(order_id, changed_at)에만 인덱스를 추가합니다. 다음 글에서는 SELECT FOR UPDATE SKIP LOCKED를 이용한 큐 패턴을 살펴봅니다.

---

**지난 글:** [감사 컬럼 패턴 — created_at, updated_at, created_by](/posts/pattern-audit-columns/)

**다음 글:** [SELECT FOR UPDATE SKIP LOCKED — DB 큐 패턴](/posts/pattern-queue-for-update-skip-locked/)

<br>
읽어주셔서 감사합니다. 😊
