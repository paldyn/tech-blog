---
title: "ENUM vs 룩업 테이블 — 코드성 데이터 설계"
description: "상태값·코드성 데이터를 ENUM 컬럼으로 처리할지, 별도의 룩업(코드) 테이블로 분리할지 결정하는 기준을 설명합니다. 각 방식의 구조, 장단점, 실무 패턴을 SQL 예시와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["ENUM", "룩업 테이블", "코드 테이블", "데이터 모델링", "도메인 설계"]
featured: false
draft: false
---

[지난 글](/posts/pattern-auto-id-uuid-ulid-snowflake/)에서 기본키 ID 전략을 다뤘습니다. 테이블 설계에서 자주 마주치는 또 다른 결정은 **상태값이나 코드성 데이터를 어떻게 저장할지**입니다. 주문 상태(PENDING, PAID, SHIPPED, DONE)처럼 정해진 값 집합을 가지는 컬럼은 ENUM으로 처리하거나 별도의 룩업 테이블로 분리할 수 있습니다.

## ENUM 컬럼

![ENUM vs 룩업 테이블 비교](/assets/posts/pattern-enum-vs-lookup-table-compare.svg)

ENUM은 컬럼에 허용되는 값을 스키마 레벨에서 선언하는 방식입니다.

```sql
-- MySQL
CREATE TABLE orders (
  id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  status ENUM('PENDING','PAID','SHIPPED','CANCELLED','DONE') NOT NULL DEFAULT 'PENDING',
  amount DECIMAL(12,2) NOT NULL
);

-- PostgreSQL — 먼저 타입 생성
CREATE TYPE order_status_t AS ENUM ('PENDING','PAID','SHIPPED','CANCELLED','DONE');

CREATE TABLE orders (
  id     BIGSERIAL PRIMARY KEY,
  status order_status_t NOT NULL DEFAULT 'PENDING',
  amount NUMERIC(12,2) NOT NULL
);
```

MySQL에서 ENUM은 내부적으로 1~2바이트 정수로 저장됩니다. PostgreSQL의 ENUM 타입은 시스템 카탈로그에 기록되고, 타입을 사용하는 모든 컬럼에서 공유됩니다.

**값 추가는 간단하지만 삭제·재정렬은 번거롭습니다:**

```sql
-- MySQL: 값 추가 (테이블 리빌드 없이 가능 — MySQL 5.6+ ALGORITHM=INSTANT 불가하나 빠름)
ALTER TABLE orders MODIFY status ENUM('PENDING','PAID','PROCESSING','SHIPPED','CANCELLED','DONE');

-- PostgreSQL: 타입에 값 추가
ALTER TYPE order_status_t ADD VALUE 'PROCESSING' AFTER 'PAID';
-- 단, 추가한 값은 같은 트랜잭션 내에서 즉시 사용 불가
```

PostgreSQL에서 ENUM 값 **제거**는 공식 지원이 없습니다. 타입을 새로 만들고 컬럼을 마이그레이션해야 합니다.

## 룩업 테이블

별도 테이블에 코드값을 저장하고 외래 키로 참조합니다.

```sql
CREATE TABLE order_status (
  code    VARCHAR(20) PRIMARY KEY,
  label   TEXT NOT NULL,       -- 화면에 표시할 이름
  sort_no INT  NOT NULL,       -- 표시 순서
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO order_status (code, label, sort_no) VALUES
  ('PENDING',   '주문 대기',  1),
  ('PAID',      '결제 완료',  2),
  ('SHIPPED',   '배송 중',    3),
  ('CANCELLED', '취소',       4),
  ('DONE',      '구매 확정',  5);

CREATE TABLE orders (
  id     BIGSERIAL PRIMARY KEY,
  status VARCHAR(20) NOT NULL REFERENCES order_status(code),
  amount NUMERIC(12,2) NOT NULL
);
```

값 추가는 `INSERT` 한 줄로 끝납니다. DDL이 필요 없으므로 배포 없이 운영 중 변경도 가능합니다.

## 계층형 코드 테이블 (공통 코드 패턴)

여러 종류의 코드를 한 테이블에서 관리하는 방식이 많은 엔터프라이즈 시스템에서 사용됩니다.

![공통 코드 테이블 설계](/assets/posts/pattern-enum-vs-lookup-table-design.svg)

```sql
CREATE TABLE code_group (
  grp_id VARCHAR(30) PRIMARY KEY,
  grp_nm TEXT NOT NULL
);

CREATE TABLE code (
  grp_id  VARCHAR(30) NOT NULL REFERENCES code_group(grp_id),
  code    VARCHAR(30) NOT NULL,
  label   TEXT NOT NULL,
  sort_no INT  NOT NULL DEFAULT 0,
  is_use  BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (grp_id, code)
);

-- 사용 예
CREATE TABLE orders (
  id          BIGSERIAL PRIMARY KEY,
  status_code VARCHAR(30) NOT NULL,
  FOREIGN KEY (status_code) REFERENCES code(code)
    -- 복합 FK를 쓰려면: REFERENCES code(grp_id, code) — grp_id는 'ORDER_STATUS'로 고정
);
```

그룹 ID까지 함께 참조하려면 `CHECK (grp_id = 'ORDER_STATUS')` 제약을 추가하거나, 뷰나 애플리케이션 레이어에서 검증합니다. 완전한 참조 무결성을 DB에서 보장하려면 **부분 복합 외래 키** 대신 각 코드 종류마다 전용 룩업 테이블을 두는 편이 깔끔합니다.

## CHECK 제약으로 간단히 처리하기

ENUM이나 룩업 테이블 없이 `CHECK` 제약으로도 허용값을 제한할 수 있습니다.

```sql
-- PostgreSQL / SQL Server
CREATE TABLE products (
  id     BIGSERIAL PRIMARY KEY,
  status VARCHAR(20) NOT NULL CHECK (status IN ('ACTIVE','INACTIVE','DISCONTINUED'))
);

-- 값 추가 시 CHECK 제약 재정의 필요
ALTER TABLE products DROP CONSTRAINT products_status_check;
ALTER TABLE products ADD CONSTRAINT products_status_check
  CHECK (status IN ('ACTIVE','INACTIVE','DISCONTINUED','ARCHIVED'));
```

스키마에 허용값이 명시되고 별도 테이블이 필요 없습니다. 대신 값 변경 시 DDL이 필요하고, 표시명을 저장할 수 없다는 한계는 ENUM과 동일합니다.

## 선택 기준 요약

```
값이 코드로 굳어 있고 변경이 거의 없다  →  ENUM 또는 CHECK
값을 관리자가 자유롭게 추가·수정해야 한다  →  룩업 테이블
다국어 표시명, 정렬 순서, 부가 메타데이터가 필요하다  →  룩업 테이블
여러 테이블에서 같은 코드 체계를 공유한다  →  공통 코드 테이블
```

ORM을 사용할 때는 ENUM과 룩업 테이블 모두 애플리케이션 레이어에서 Enum 타입으로 매핑하는 방식이 흔합니다. 룩업 테이블이라면 애플리케이션 시작 시 코드 목록을 캐시해 두면 매 쿼리마다 JOIN 비용이 발생하지 않습니다.

---

**지난 글:** [기본키 ID 전략 — AUTO_INCREMENT, UUID, ULID, Snowflake](/posts/pattern-auto-id-uuid-ulid-snowflake/)

**다음 글:** [SQL 인젝션 방어 — 파라미터 바인딩과 안전한 쿼리 작성](/posts/pattern-sql-injection-defense/)

<br>
읽어주셔서 감사합니다. 😊
