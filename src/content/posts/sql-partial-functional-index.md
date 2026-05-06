---
title: "부분 인덱스와 함수 기반 인덱스"
description: "WHERE 조건으로 인덱스 대상 행을 한정하는 부분 인덱스(Partial Index)와, 표현식 결과를 직접 저장하는 함수 기반 인덱스(Functional/Expression Index)의 원리와 활용 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["sql", "partial-index", "functional-index", "expression-index", "btree", "postgresql", "performance", "index"]
featured: false
draft: false
---

[지난 글](/posts/sql-covering-index/)에서 커버링 인덱스로 힙 접근을 없애는 방법을 살펴봤다. 이번에는 인덱스 크기 자체를 줄이거나 함수 결과를 인덱싱하는 두 가지 고급 기법, **부분 인덱스**와 **함수 기반 인덱스**를 정리한다.

---

## 부분 인덱스(Partial Index)

일반 인덱스는 테이블의 **모든 행**을 인덱스에 기록한다. 하지만 쿼리가 항상 특정 조건의 행만 조회한다면, 나머지 행은 인덱스에 들어갈 필요가 없다. 부분 인덱스는 `CREATE INDEX ... WHERE <조건>`으로 **인덱스에 포함할 행을 제한**한다.

```sql
-- 전체 인덱스: 모든 주문을 인덱싱
CREATE INDEX idx_orders_status ON orders(id);

-- 부분 인덱스: 미처리 주문만 인덱싱
CREATE INDEX idx_orders_pending
ON orders(id)
WHERE status = 'pending';
```

![부분 인덱스 구조](/assets/posts/sql-partial-functional-index-partial.svg)

전체 주문 중 'pending' 상태가 1%뿐이라면 인덱스 크기가 1/100로 줄고, INSERT/UPDATE 시 인덱스 유지 비용도 대폭 감소한다.

### 활용 시나리오

| 패턴 | 예시 조건 |
|------|-----------|
| 소프트 삭제 | `WHERE deleted_at IS NULL` |
| 처리 대기열 | `WHERE status = 'pending'` |
| 미결 알림 | `WHERE is_read = false` |
| 최신 파티션 대체 | `WHERE created_at > '2025-01-01'` |

### Planner가 부분 인덱스를 사용하는 조건

옵티마이저는 쿼리의 WHERE 조건이 인덱스 정의 조건을 **논리적으로 함의(imply)**할 때 부분 인덱스를 선택한다.

```sql
-- 인덱스 정의: WHERE status = 'pending'
-- 아래 쿼리는 인덱스 조건을 포함하므로 인덱스 사용
SELECT id FROM orders
WHERE status = 'pending'
  AND created_at > NOW() - INTERVAL '7 days';
```

반대로 `WHERE status != 'deleted'` 처럼 인덱스 조건보다 넓은 범위를 요구하면 인덱스를 사용하지 못한다.

---

## 함수 기반 인덱스(Functional / Expression Index)

WHERE 절에 `LOWER(email) = 'alice@example.com'` 같은 함수 호출이 있으면 일반 인덱스는 사용되지 않는다. 옵티마이저가 `email` 컬럼의 원본 값과 함수 결과를 연결하지 못하기 때문이다. **함수 기반 인덱스**는 표현식 결과를 미리 계산해 인덱스 리프에 저장함으로써 이 문제를 해결한다.

```sql
-- LOWER(email) 표현식 인덱스 생성
CREATE INDEX idx_lower_email
ON users(LOWER(email));

-- 동일한 표현식으로 조회 → Index Scan 가능
SELECT id FROM users
WHERE LOWER(email) = 'alice@example.com';
```

![함수 기반 인덱스 패턴](/assets/posts/sql-partial-functional-index-functional.svg)

### 표현식이 일치해야 동작한다

Planner는 인덱스 생성 시 사용한 표현식 트리와 쿼리 WHERE의 표현식 트리를 **비교**한다. 정확히 같아야 인덱스를 활용한다.

```sql
-- idx 정의: LOWER(email)
WHERE LOWER(email) = ...   -- ✓ 사용
WHERE UPPER(email) = ...   -- ✗ 불일치, Full Scan
WHERE email = ...          -- ✗ 원본 컬럼, 다름
```

### 대표 활용 패턴

```sql
-- 1. 날짜 월 단위 집계 인덱스
CREATE INDEX idx_order_month
ON orders(DATE_TRUNC('month', created_at));

-- 2. JSON 필드 인덱스 (PostgreSQL)
CREATE INDEX idx_payload_type
ON events((payload->>'type'));

-- 3. 계산 컬럼 인덱스
CREATE INDEX idx_total_price
ON order_items(quantity * unit_price);
```

---

## 두 기법의 조합

부분 인덱스와 함수 기반 인덱스는 함께 쓸 수 있다.

```sql
-- 활성 사용자의 소문자 이메일만 인덱싱
CREATE INDEX idx_active_lower_email
ON users(LOWER(email))
WHERE status = 'active';
```

이 인덱스는 `status = 'active'` 행에 대해서만 `LOWER(email)`을 계산·저장하므로 두 기법의 장점이 합쳐진다.

---

## 주의사항

- **쓰기 오버헤드**: 함수 기반 인덱스는 INSERT/UPDATE 시 함수를 실행해 값을 계산해야 하므로 쓰기 비용이 높아진다. 연산이 무거운 함수는 주의한다.
- **통계 갱신**: 부분 인덱스의 정의 조건이 변하는 데이터에 적용되면 `ANALYZE`를 통해 통계를 최신 상태로 유지해야 Planner가 올바르게 선택한다.
- **DB 지원 범위**: PostgreSQL은 두 기법 모두 완전 지원한다. Oracle은 `Function-Based Index`를, MySQL 8.0+은 `Functional Index`를 지원하며, SQL Server는 `INCLUDE` 또는 Computed Column 인덱스로 유사 기능을 구현한다.

---

**지난 글:** [커버링 인덱스](/posts/sql-covering-index/)

**다음 글:** [해시 인덱스](/posts/sql-hash-index/)

<br>
읽어주셔서 감사합니다. 😊
