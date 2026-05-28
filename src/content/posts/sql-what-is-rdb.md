---
title: "RDB란 무엇인가 — 관계형 데이터베이스의 세계로"
description: "관계형 데이터베이스(RDB)의 핵심 개념인 테이블·행·열·기본 키·외래 키를 파일 시스템과 비교하며 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["SQL", "RDB", "데이터베이스", "기초"]
featured: false
draft: false
---

데이터를 저장하고 조회하는 가장 성숙한 기술, 관계형 데이터베이스(Relational Database, RDB)는 1970년대에 등장한 이후 반세기가 지난 지금도 대부분의 서비스에서 핵심 저장소로 사용됩니다. 이 시리즈의 첫 글에서는 "RDB가 정확히 무엇인가"라는 질문에 파일 시스템과의 비교를 통해 답합니다.

## 파일 시스템의 한계

초기 애플리케이션은 데이터를 그냥 파일로 저장했습니다. CSV, 텍스트 파일, 독자적인 바이너리 포맷 등이 그 예입니다. 편리하지만 데이터가 늘어나면 문제가 생깁니다.

- **데이터 중복**: 고객의 주소가 여러 파일에 흩어져 있으면, 주소가 바뀌었을 때 모든 파일을 동기화해야 합니다.
- **참조 무결성 없음**: `orders.csv`에 존재하지 않는 고객 ID를 기록해도 아무도 막지 않습니다.
- **동시 접근 문제**: 두 프로세스가 동시에 같은 파일을 수정하면 데이터가 깨집니다.
- **표준 질의 언어 없음**: 파일에서 "서울 사는 고객의 총 주문금액"을 구하려면 직접 파싱 로직을 짜야 합니다.

![RDB vs 파일 시스템](/assets/posts/sql-what-is-rdb-comparison.svg)

## 관계형 모델의 답

1970년 IBM의 에드거 코드(Edgar F. Codd)는 수학적인 **관계(Relation)** 개념을 기반으로 데이터를 저장하는 방법을 제안했습니다. 핵심 아이디어는 세 가지입니다.

1. **데이터를 2차원 테이블로 표현한다.** 행(Row, 튜플)은 하나의 레코드, 열(Column, 속성)은 그 레코드의 특성입니다.
2. **각 테이블에는 행을 유일하게 식별하는 기본 키(Primary Key)가 있다.** `customer_id = 1`이라는 값은 오직 한 고객을 가리킵니다.
3. **다른 테이블의 기본 키를 참조하는 외래 키(Foreign Key)로 테이블 간 관계를 표현한다.** 이 참조가 항상 유효하다는 보장이 **참조 무결성**입니다.

```sql
-- 기본 키와 외래 키 정의 예시
CREATE TABLE customers (
    customer_id  INT PRIMARY KEY,
    name         VARCHAR(50) NOT NULL
);

CREATE TABLE orders (
    order_id     INT PRIMARY KEY,
    customer_id  INT NOT NULL REFERENCES customers(customer_id),
    amount       NUMERIC(12, 2)
);
```

![관계형 데이터베이스 구조](/assets/posts/sql-what-is-rdb-structure.svg)

## RDB의 네 가지 특성

| 특성 | 설명 |
|------|------|
| **독립성** | 물리적 저장 방식이 바뀌어도 질의 방식은 동일 |
| **무결성** | 제약조건(NOT NULL, UNIQUE, FK 등)으로 데이터 정확성 유지 |
| **보안** | 테이블·행·열 단위 접근 권한 제어 |
| **트랜잭션** | ACID(원자성·일관성·격리성·지속성) 보장 |

## SQL이란

RDB를 조작하는 표준 언어가 **SQL(Structured Query Language)** 입니다. ISO/IEC 9075 표준으로 정의되며, Oracle·PostgreSQL·MySQL·SQL Server 등 거의 모든 RDBMS가 이 표준을 구현합니다. 이 시리즈 전체가 바로 SQL을 중심으로 전개됩니다.

```sql
-- 가장 기본적인 SQL 질의
SELECT name, amount
FROM   customers
JOIN   orders USING (customer_id)
WHERE  amount > 30000
ORDER BY amount DESC;
```

데이터베이스를 처음 접하는 분이라면 지금 당장 위 쿼리를 이해하지 않아도 됩니다. 시리즈를 따라가다 보면 자연스럽게 읽힐 것입니다.

## 정리

- RDB는 **데이터를 테이블(행+열)로 표현**하고, **기본 키**로 식별하며, **외래 키**로 테이블을 연결합니다.
- 파일 시스템과 달리 중복 제거·참조 무결성·동시성 제어·트랜잭션을 기본 제공합니다.
- SQL은 이 모든 기능을 다루는 표준 언어입니다.

다음 글에서는 코드가 제안한 **관계형 모델의 수학적 이론** — 릴레이션, 튜플, 속성, 관계 대수 — 를 살펴봅니다.

---

**다음 글:** [관계형 모델 이론 — 릴레이션, 튜플, 관계 대수](/posts/sql-relational-model/)

<br>
읽어주셔서 감사합니다. 😊
