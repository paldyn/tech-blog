---
title: "데이터베이스란 무엇인가 — 파일 시스템과의 차이"
description: "파일 시스템과 데이터베이스를 비교하며 DBMS가 왜 필요한지, ANSI/SPARC 3단계 아키텍처가 어떻게 데이터 독립성을 보장하는지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["sql", "rdb", "dbms", "파일시스템", "데이터베이스"]
featured: false
draft: false
---

## 왜 데이터베이스가 필요할까?

1990년대 초 한 유통 회사가 있었다고 상상해 보세요. 상품 목록은 `products.csv`, 고객 정보는 `customers.txt`, 주문은 `orders.dat`. 세 팀이 각자의 파일을 담당했고, 매달 말 정산 보고서를 만들려면 개발자가 직접 파이썬 스크립트를 돌려 파일 세 개를 합쳐야 했습니다. 그러던 어느 날 두 팀이 동시에 `customers.txt`에 쓰기를 시도했고, 파일이 절반만 갱신된 채 망가졌습니다.

이것이 **파일 시스템 기반 데이터 관리의 한계**입니다. 데이터베이스 관리 시스템(DBMS)은 이런 문제를 구조적으로 해결하기 위해 탄생했습니다.

## 파일 시스템의 다섯 가지 문제

![파일 시스템 vs 데이터베이스 비교](/assets/posts/sql-what-is-rdb-filesystem-vs-db.svg)

### 1. 데이터 중복과 불일치

파일 시스템에서는 각 애플리케이션이 독립적인 파일을 갖습니다. 고객 이름이 `customers.csv`에도, `invoices.csv`에도 있습니다. 한쪽만 고치면 두 파일 사이에 불일치가 생깁니다. DBMS는 **하나의 테이블에 한 번만 저장**하고, 참조(외래 키)로 연결해 중복을 제거합니다.

### 2. 동시 접근 제어 불가

파일 잠금(file lock)은 너무 거칩니다. 파일 전체를 잠그거나, 잠금이 없거나 둘 중 하나입니다. DBMS는 **행 수준 잠금(row-level locking)**과 **트랜잭션 격리 수준**으로 수천 개의 동시 요청을 안전하게 처리합니다.

### 3. 장애 시 데이터 손상

파일에 절반만 쓰다가 전원이 나가면 파일은 망가집니다. DBMS는 **WAL(Write-Ahead Log)**을 통해 트랜잭션 단위로 원자적(atomic)으로 쓰고, 장애 후 재시작 시 자동으로 복구합니다.

### 4. 보안 제어의 어려움

파일 시스템 권한은 디렉터리·파일 단위입니다. DBMS는 **테이블, 컬럼, 심지어 행 수준**까지 접근을 제한할 수 있습니다(`GRANT`, `REVOKE`, Row-Level Security).

### 5. 데이터와 프로그램의 결합

파일 구조가 바뀌면 그 파일을 읽는 모든 프로그램을 수정해야 합니다. DBMS는 아래의 3단계 아키텍처로 이 문제를 해결합니다.

## ANSI/SPARC 3단계 아키텍처

![ANSI/SPARC 3단계 아키텍처](/assets/posts/sql-what-is-rdb-three-schema.svg)

1970년대 ANSI/SPARC 위원회가 제안한 이 구조는 오늘날 모든 RDBMS의 기본 뼈대입니다.

| 단계 | 역할 | 독립성 |
|------|------|--------|
| **외부 단계** | 사용자·앱별 맞춤 뷰 | 논리적 독립성 ↕ |
| **개념 단계** | 전체 DB 논리 구조 (스키마) | — |
| **내부 단계** | 실제 파일·인덱스·블록 | 물리적 독립성 ↕ |

- **논리적 독립성**: 개념 스키마(테이블 구조)가 바뀌어도 앱의 외부 뷰는 유지됩니다.
- **물리적 독립성**: 디스크를 SSD로 교체하거나 인덱스를 추가해도 SQL 쿼리는 그대로 동작합니다.

## DBMS가 제공하는 핵심 기능

```sql
-- 1. 선언형 질의 — "어떻게"가 아니라 "무엇을" 기술
SELECT c.name, COUNT(o.id) AS order_count
FROM   customers c
JOIN   orders o ON o.customer_id = c.id
WHERE  o.created_at >= '2026-01-01'
GROUP  BY c.name
ORDER  BY order_count DESC;

-- 2. 트랜잭션 — 원자성 보장
BEGIN;
  UPDATE accounts SET balance = balance - 100 WHERE id = 1;
  UPDATE accounts SET balance = balance + 100 WHERE id = 2;
COMMIT; -- 둘 다 성공하거나 둘 다 실패

-- 3. 제약 조건 — DBMS가 무결성 보장
ALTER TABLE orders
  ADD CONSTRAINT fk_customer
  FOREIGN KEY (customer_id) REFERENCES customers(id);
```

파일 시스템으로는 위 세 가지를 구현하려면 수천 줄의 애플리케이션 코드가 필요합니다. DBMS는 이를 커널 수준에서 처리합니다.

## 데이터베이스 vs DBMS vs RDBMS

헷갈리기 쉬운 용어를 정리합니다.

- **데이터베이스(Database)**: 체계적으로 조직된 데이터의 집합체.
- **DBMS(Database Management System)**: 데이터베이스를 생성·관리·조작하는 소프트웨어 시스템. Oracle, PostgreSQL, MySQL이 DBMS입니다.
- **RDBMS(Relational DBMS)**: 관계형 모델(테이블·행·열·관계)을 기반으로 하는 DBMS. 현재 엔터프라이즈 환경의 90% 이상이 RDBMS입니다.

## 정리

파일 시스템은 단순한 데이터 저장에는 충분하지만, **동시성·무결성·복구·보안** 측면에서 근본적인 한계를 가집니다. DBMS는 ANSI/SPARC 3단계 아키텍처를 통해 데이터 독립성을 확보하고, SQL이라는 표준 선언형 언어로 복잡한 저수준 처리를 추상화합니다. 다음 글에서는 관계형 모델의 이론적 근거인 **관계·튜플·속성** 개념을 깊이 들여다봅니다.

**다음 글:** 관계형 모델 이론 — 관계·튜플·속성

<br>
읽어주셔서 감사합니다. 😊
