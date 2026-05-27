---
title: "관계형 데이터베이스(RDB)란 무엇인가"
description: "관계형 데이터베이스의 개념, 테이블·행·열·기본키·외래키의 의미, SQL 질의 처리 흐름, NoSQL과의 차이를 그림과 예제로 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 1
type: "knowledge"
category: "SQL"
tags: ["RDB", "관계형데이터베이스", "SQL기초", "테이블", "기본키", "외래키", "NoSQL비교"]
featured: false
draft: false
---

데이터베이스라는 단어를 처음 접하면 으레 엑셀 스프레드시트를 떠올린다. 그 직관은 완전히 틀리지 않았다. 1970년 에드거 F. 코드(Edgar F. Codd)가 IBM 연구소에서 발표한 논문 *"A Relational Model of Data for Large Shared Data Banks"*는 데이터를 **수학적 집합인 릴레이션(relation)**으로 표현하자는 제안이었고, 현대 RDB는 그 아이디어를 그대로 구현한 시스템이다.

## RDB의 핵심 구조

관계형 데이터베이스는 데이터를 **테이블(Table)** 단위로 저장한다. 테이블은 행(Row, 튜플)과 열(Column, 속성)로 구성된 2차원 격자 구조이며, 수학에서의 릴레이션과 대응된다.

![RDB 구조와 테이블 간 관계](/assets/posts/sql-what-is-rdb-concept.svg)

각 테이블의 핵심 요소를 정리하면 다음과 같다.

| 요소 | 설명 |
|------|------|
| **행 (Row / Tuple)** | 하나의 개체(entity)를 표현하는 데이터 묶음 |
| **열 (Column / Attribute)** | 개체의 속성, 데이터 타입을 갖는다 |
| **기본 키 (PK)** | 행을 유일하게 식별. NULL 불가, 중복 불가 |
| **외래 키 (FK)** | 다른 테이블의 PK를 참조해 관계를 표현 |
| **스키마** | 테이블 구조 정의(열 이름, 타입, 제약 조건) |

### 기본 키와 외래 키의 역할

`users` 테이블의 `user_id`가 기본 키(PK)라면, `orders` 테이블의 `user_id`는 `users`를 참조하는 외래 키(FK)다. 이 외래 키 연결이 RDB를 "관계형"으로 만드는 핵심 메커니즘이다. 외래 키는 **참조 무결성(Referential Integrity)**을 강제하여, 존재하지 않는 `user_id`를 가진 주문이 생길 수 없도록 막는다.

```sql
-- 테이블 구조 정의 예시
CREATE TABLE users (
    user_id  INT         PRIMARY KEY,
    name     VARCHAR(50) NOT NULL,
    email    VARCHAR(100) UNIQUE
);

CREATE TABLE orders (
    order_id  INT     PRIMARY KEY,
    user_id   INT     NOT NULL,
    amount    DECIMAL(10,2),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
```

## SQL 질의 처리 흐름

SQL(Structured Query Language)은 RDB에 데이터를 묻고 조작하는 **선언형(Declarative) 언어**다. "어떤 결과를 원한다"는 것만 기술하면 엔진이 최적 실행 경로를 결정한다.

![SQL 질의 처리 흐름](/assets/posts/sql-what-is-rdb-sql-example.svg)

질의가 데이터베이스 내부에서 처리되는 순서는 다음과 같다.

1. **파서(Parser)**: SQL 문자열을 읽어 구문 분석 후 추상 구문 트리(AST) 생성
2. **옵티마이저(Optimizer)**: 가능한 실행 계획 목록 생성, 통계 기반으로 최저 비용 선택
3. **실행 엔진(Execution Engine)**: 선택된 계획대로 스토리지 레이어에서 데이터 획득
4. **결과 반환**: 클라이언트에게 결과 집합(Result Set) 전송

```sql
-- users와 orders를 JOIN해 고액 주문 조회
SELECT u.name, o.amount
FROM   users u
JOIN   orders o ON u.user_id = o.user_id
WHERE  o.amount > 40000
ORDER BY o.amount DESC;
```

## RDB vs NoSQL

RDB가 만능은 아니다. 적합한 상황이 있다.

| 기준 | RDB | NoSQL |
|------|-----|-------|
| 스키마 | 고정(강한 구조) | 유연(스키마리스) |
| 트랜잭션 | ACID 완전 지원 | BASE (대부분) |
| 수평 확장 | 제한적 | 설계상 용이 |
| 복잡한 쿼리 | JOIN, 집계 강점 | 키-값 패턴에 최적 |
| 적합 케이스 | 금융, ERP, CRM | 캐시, 로그, SNS |

핵심은 **트랜잭션 일관성이 중요하고 데이터 간 관계가 복잡**할수록 RDB가 유리하고, **단순 키-값 조회나 대규모 수평 확장**이 필요할 때 NoSQL이 유리하다는 것이다.

## 주요 RDB 제품

현재 시장에서 널리 쓰이는 RDB는 크게 세 가지로 나뉜다.

```text
오픈소스: PostgreSQL · MySQL · MariaDB · SQLite
상용    : Oracle Database · SQL Server (MSSQL) · IBM Db2
클라우드: Amazon Aurora · Google Cloud Spanner · Azure SQL
```

이 시리즈에서는 SQL 표준 문법을 중심으로 다루며, 주요 제품별 차이가 있는 부분은 별도로 표기한다.

## 정리

- RDB는 데이터를 **테이블(릴레이션) 집합**으로 표현하는 데이터베이스 모델이다
- **기본 키(PK)**로 행을 식별하고, **외래 키(FK)**로 테이블 간 관계를 표현한다
- SQL은 "무엇을 원하는지"만 기술하는 **선언형 언어**이며, 실행 방법은 옵티마이저가 결정한다
- 트랜잭션 일관성과 복잡한 관계 질의에서 RDB가 NoSQL 대비 강점을 갖는다

---

**다음 글:** [관계형 모델 이론 — 릴레이션, 튜플, 속성의 수학적 기초](/posts/sql-relational-model/)

<br>
읽어주셔서 감사합니다. 😊
