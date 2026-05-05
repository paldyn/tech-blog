---
title: "비정규화: 언제, 어떻게 결정하는가"
description: "정규화된 스키마를 의도적으로 비정규화하는 시점과 패턴—계산값 미리 저장, 중복 컬럼 복사, 요약 테이블—을 프로파일링 기반 의사결정 흐름과 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["sql", "denormalization", "performance", "database-design", "olap", "oltp", "schema", "tradeoff", "optimization"]
featured: false
draft: false
---

[지난 글](/posts/sql-normalization-1nf-2nf-3nf-bcnf/)에서 1NF부터 BCNF까지 정규화 단계를 살펴봤다. 이번에는 그 반대 방향, **비정규화(Denormalization)**—정규화된 스키마를 의도적으로 다시 합치거나 중복을 허용하는 결정—을 다룬다.

---

## 비정규화는 설계 실패가 아니다

정규화는 **일관성과 무결성**을 위한 원칙이고, 비정규화는 **읽기 성능**을 위한 트레이드오프다. 두 전략 모두 정당하다. 문제는 *언제* 비정규화를 선택하느냐다.

흔한 실수는 "느릴 것 같으니까" 처음부터 비정규화하는 것이다. 올바른 순서는 다음과 같다.

```
1. 정규화된 스키마로 설계한다.
2. 실제 트래픽을 받으며 슬로우 쿼리를 측정한다.
3. JOIN·집계가 병목임을 확인한다.
4. 그때 선택적으로 비정규화를 적용한다.
```

![비정규화 트레이드오프](/assets/posts/sql-denormalization-decisions-tradeoff.svg)

---

## OLTP vs OLAP에서의 기준

**OLTP** 환경(전자상거래, 뱅킹)은 쓰기 트랜잭션이 많고 레코드 단위 접근이 주다. 정규화 수준을 높게 유지하는 것이 갱신 이상을 막고 잠금 범위를 줄인다.

**OLAP** 환경(데이터 웨어하우스, BI 대시보드)은 수백만 행을 집계하는 읽기 쿼리가 지배적이다. 스타 스키마처럼 의도적으로 비정규화해 JOIN을 최소화하고 컬럼 스캔 효율을 높인다.

```sql
-- OLAP 스타 스키마: 비정규화된 팩트 테이블
CREATE TABLE fact_sales (
    sale_id       BIGINT PRIMARY KEY,
    dt            DATE,
    -- dimension FK들
    customer_id   INT,
    product_id    INT,
    region_id     INT,
    -- 미리 집계하지 않지만 JOIN 횟수를 줄이기 위해
    -- 자주 필터링되는 속성을 직접 보유
    product_category VARCHAR(50),  -- products 테이블의 컬럼 복사
    region_name      VARCHAR(50),  -- regions 테이블의 컬럼 복사
    amount        NUMERIC(12,2),
    qty           INT
);
```

---

## 주요 비정규화 패턴

![비정규화 패턴](/assets/posts/sql-denormalization-decisions-patterns.svg)

### 패턴 1: 계산값(Derived Value) 미리 저장

매번 `SUM()`이나 `COUNT()` 집계를 실행하는 대신, 결과를 별도 컬럼에 저장하고 쓰기 시점에 갱신한다.

```sql
-- orders 테이블에 주문 총액 컬럼 추가
ALTER TABLE orders ADD COLUMN total_amount NUMERIC(12,2) DEFAULT 0;

-- order_items 삽입/삭제 시 동기화 (트리거 방식)
CREATE OR REPLACE FUNCTION sync_order_total()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE orders
     SET total_amount = (
           SELECT COALESCE(SUM(unit_price * qty), 0)
             FROM order_items
            WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
         )
   WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  RETURN NEW;
END;
$$;
```

### 패턴 2: 중복 컬럼 복사

JOIN이 불필요한 컬럼을 사용 테이블에 직접 복사한다.

```sql
-- order_items에 product_name 복사: products JOIN 없이 조회 가능
ALTER TABLE order_items ADD COLUMN product_name VARCHAR(200);

-- 삽입 시 함께 채움
INSERT INTO order_items (order_id, product_id, product_name, qty, unit_price)
SELECT :order_id, p.id, p.name, :qty, p.price
  FROM products p
 WHERE p.id = :product_id;
```

상품명이 바뀌어도 과거 주문은 당시 이름을 유지해야 하는 경우라면 이 중복이 오히려 비즈니스상 올바른 설계다.

### 패턴 3: 요약 테이블(Summary Table)

집계 쿼리 결과를 주기적으로 별도 테이블에 저장한다. 대용량 리포트에 효과적이다.

```sql
CREATE TABLE daily_sales_summary (
    dt           DATE PRIMARY KEY,
    total_amount NUMERIC(14,2),
    order_count  BIGINT,
    updated_at   TIMESTAMPTZ DEFAULT now()
);

-- 매일 배치로 갱신
INSERT INTO daily_sales_summary (dt, total_amount, order_count)
SELECT DATE(created_at), SUM(total_amount), COUNT(*)
  FROM orders
 WHERE created_at >= CURRENT_DATE - INTERVAL '1 day'
   AND created_at <  CURRENT_DATE
ON CONFLICT (dt) DO UPDATE
   SET total_amount = EXCLUDED.total_amount,
       order_count  = EXCLUDED.order_count,
       updated_at   = now();
```

### 패턴 4: 계층 평탄화

자기참조 테이블(재귀 구조)을 평탄화해 계층 탐색 없이 바로 접근한다.

```sql
-- 카테고리 계층을 레벨 컬럼으로 비정규화
CREATE TABLE categories_flat (
    id       INT PRIMARY KEY,
    name     VARCHAR(100),
    lv1_id   INT,   -- 최상위 카테고리
    lv1_name VARCHAR(100),
    lv2_id   INT,
    lv2_name VARCHAR(100),
    lv3_id   INT,
    lv3_name VARCHAR(100)
);
```

---

## 일관성 유지 전략

비정규화의 가장 큰 위험은 **갱신 이상**이다. 중복된 데이터 중 일부만 수정되면 데이터가 불일치한다. 세 가지 동기화 방법이 있다.

| 방법 | 장점 | 단점 |
|------|------|------|
| **트리거** | 자동, DB 레벨 일관성 | 오버헤드, 디버그 어려움 |
| **애플리케이션 로직** | 유연, 가시적 | 누락 위험 |
| **배치/스케줄러** | 단순, 주기 조절 가능 | 실시간 일관성 미보장 |

```sql
-- PostgreSQL: 트리거로 product_name 동기화
CREATE OR REPLACE FUNCTION sync_product_name_in_items()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    UPDATE order_items
       SET product_name = NEW.name
     WHERE product_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_product_name_sync
AFTER UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION sync_product_name_in_items();
```

---

## 비정규화 결정 체크리스트

```
✓ EXPLAIN ANALYZE로 JOIN/집계가 실제 병목인가?
✓ 읽기/쓰기 비율이 읽기 쪽으로 크게 치우쳐 있는가?
✓ 동기화 로직(트리거/배치)을 유지할 수 있는가?
✓ 데이터 불일치 허용 범위(eventual consistency)가 있는가?
✓ 정규화 스키마로 캐시(Materialized View, Redis)로 해결 가능하지 않은가?
```

마지막 항목이 중요하다. 많은 경우 비정규화보다 **Materialized View**나 애플리케이션 캐시가 더 나은 대안이다. 스키마를 바꾸지 않고도 읽기 성능을 높일 수 있기 때문이다.

---

**지난 글:** [정규화: 1NF ~ BCNF](/posts/sql-normalization-1nf-2nf-3nf-bcnf/)

**다음 글:** [ER 다이어그램 읽기와 그리기](/posts/sql-er-diagram/)

<br>
읽어주셔서 감사합니다. 😊
