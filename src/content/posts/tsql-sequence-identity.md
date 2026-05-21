---
title: "T-SQL SEQUENCE와 IDENTITY — 자동 증가 키 완전 가이드"
description: "SQL Server의 자동 증가 키 생성 방식인 IDENTITY 속성과 SEQUENCE 객체를 비교하고, 각각의 내부 동작·캐시·재설정 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["SQLServer", "TSQL", "IDENTITY", "SEQUENCE", "자동증가", "PK", "채번"]
featured: false
draft: false
---

[지난 글](/posts/tsql-merge/)에서 T-SQL MERGE 문으로 Upsert를 구현하는 방법을 살펴봤다. 이번에는 자동 증가 키를 생성하는 두 가지 메커니즘 — **IDENTITY**와 **SEQUENCE** — 을 비교하고, 각각을 언제 어떻게 써야 하는지 짚어본다.

## IDENTITY — 테이블에 묶인 자동 증가

`IDENTITY(seed, increment)` 속성은 열 정의에 직접 붙인다. `seed`는 시작값, `increment`는 증가 폭이다.

```sql
CREATE TABLE orders (
    order_id   INT         IDENTITY(1, 1) PRIMARY KEY,
    customer_id INT        NOT NULL,
    order_date  DATETIME2  DEFAULT GETDATE()
);

-- INSERT 시 order_id는 자동 부여
INSERT INTO orders (customer_id) VALUES (101);

-- 마지막 INSERT에서 생성된 값 조회
SELECT SCOPE_IDENTITY();          -- 현재 스코프 한정 (권장)
SELECT @@IDENTITY;                -- 트리거 영향 받을 수 있음
SELECT IDENT_CURRENT('orders');   -- 세션 무관 테이블 기준
```

IDENTITY의 핵심 제약은 **테이블 종속성**이다. 하나의 열에만 귀속되며, 테이블 삭제 없이 시드를 변경하려면 `DBCC CHECKIDENT`를 써야 한다.

```sql
-- IDENTITY 값 재설정 (현재 값을 1000으로)
DBCC CHECKIDENT ('orders', RESEED, 1000);
```

![IDENTITY vs SEQUENCE 비교](/assets/posts/tsql-sequence-identity-comparison.svg)

## SEQUENCE — 독립 객체로 채번

SQL Server 2012(ANSI SQL 2011 표준)에서 도입된 `SEQUENCE`는 테이블과 무관하게 존재하는 독립 객체다. `NEXT VALUE FOR`로 언제든 다음 값을 꺼낼 수 있다.

```sql
-- SEQUENCE 객체 생성
CREATE SEQUENCE dbo.order_seq
    AS BIGINT
    START WITH 1
    INCREMENT BY 1
    MINVALUE 1
    MAXVALUE 9999999999
    NO CYCLE
    CACHE 50;

-- INSERT 없이 독립적으로 다음 값 채번
DECLARE @new_id BIGINT;
SET @new_id = NEXT VALUE FOR dbo.order_seq;
SELECT @new_id;   -- 1

-- INSERT에서 사용
INSERT INTO orders (order_id, customer_id)
VALUES (NEXT VALUE FOR dbo.order_seq, 101);

-- DEFAULT 제약으로 SEQUENCE 연결
ALTER TABLE invoices
    ADD CONSTRAINT df_invoice_id
    DEFAULT (NEXT VALUE FOR dbo.order_seq) FOR invoice_id;
```

![SEQUENCE 객체 사용 흐름](/assets/posts/tsql-sequence-identity-sequence.svg)

## CACHE 옵션의 의미

`CACHE N`은 SQL Server가 메모리에 N개의 값을 미리 예약함을 뜻한다. 값을 꺼낼 때마다 디스크(시스템 카탈로그)에 기록하지 않아도 되므로 **INSERT 속도**가 크게 향상된다. 단, 서버 재시작 시 캐시된 값이 버려져 번호에 간격(gap)이 생길 수 있다. 번호 연속성이 필수인 전표 시스템이 아니라면 CACHE는 기본값(50~100)으로 두는 것이 성능상 유리하다.

```sql
-- CACHE 없이 (느리지만 gap 최소)
CREATE SEQUENCE dbo.strict_seq AS INT
    START WITH 1 INCREMENT BY 1 NO CACHE;

-- 재설정 (IDENTITY의 DBCC CHECKIDENT보다 간결)
ALTER SEQUENCE dbo.order_seq RESTART WITH 1000;
```

## 어떤 것을 선택해야 할까

단순히 테이블 하나의 PK 자동 생성이 목적이라면 `IDENTITY`로 충분하다. 반면 다음 상황에서는 `SEQUENCE`가 우선이다.

- **여러 테이블이 동일한 번호 범위를 공유**해야 할 때 (주문/청구서가 같은 채번 체계)
- INSERT 전에 값을 미리 알아야 하는 배치 로직
- 주기적으로 시드를 재설정하거나 간격 제어가 필요한 경우
- `CYCLE` 옵션으로 순환 채번이 필요한 경우

```sql
-- CYCLE 예: 0~999 순환 (배치 작업 슬롯 번호 등)
CREATE SEQUENCE dbo.slot_seq
    AS SMALLINT
    START WITH 0
    INCREMENT BY 1
    MINVALUE 0
    MAXVALUE 999
    CYCLE
    CACHE 10;
```

## sys.sequences로 상태 확인

```sql
SELECT name,
       current_value,
       start_value,
       increment,
       minimum_value,
       maximum_value,
       is_cycling,
       cache_size
FROM   sys.sequences
WHERE  name = 'order_seq';
```

`current_value`는 마지막으로 캐시 블록을 확보한 시점의 값을 반영하므로, 실제로 발급된 마지막 값과 다를 수 있다는 점에 유의한다.

---

**지난 글:** [T-SQL MERGE 문 — Upsert 완전 가이드](/posts/tsql-merge/)

**다음 글:** [T-SQL 임시 테이블 vs 테이블 변수 — 언제 무엇을 쓸까](/posts/tsql-temp-table-vs-table-variable/)

<br>
읽어주셔서 감사합니다. 😊
