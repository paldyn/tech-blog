---
title: "DB 클라이언트-서버 프로토콜 — 연결부터 결과 반환까지"
description: "애플리케이션이 DB에 연결하는 방법, 각 DBMS의 프로토콜, SQL 쿼리 생애 주기, Prepared Statement와 커넥션 풀의 원리를 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["DB클라이언트", "커넥션풀", "PreparedStatement", "JDBC", "쿼리생애주기", "TCP", "pgwire", "TDS"]
featured: false
draft: false
---

[지난 글](/posts/sql-history-and-standard/)에서 SQL 표준의 역사를 살펴봤다. SQL 문법을 작성하기 전에 한 가지 더 알아야 할 것이 있다. 내가 작성한 SQL이 어떤 경로로 DB 서버에 전달되고, 어떤 과정을 거쳐 결과가 돌아오는가다. 이 과정을 이해하면 **Prepared Statement, 커넥션 풀, N+1 문제** 같은 성능 이슈가 왜 발생하는지 직관적으로 알 수 있다.

## 클라이언트-서버 아키텍처

모든 주요 DBMS는 **클라이언트-서버(Client-Server)** 모델로 동작한다. 애플리케이션(클라이언트)은 네트워크나 소켓을 통해 DB 서버와 통신한다.

![DB 클라이언트-서버 아키텍처](/assets/posts/sql-client-server-arch.svg)

각 DBMS는 고유한 **바이너리 프로토콜**을 사용한다.

| DBMS | 프로토콜 | 기본 포트 |
|------|---------|---------|
| Oracle | OCI (Oracle Call Interface), JDBC Thin | 1521 |
| PostgreSQL | pgwire (Frontend/Backend Protocol) | 5432 |
| MySQL/MariaDB | MySQL Client/Server Protocol | 3306 |
| SQL Server | TDS (Tabular Data Stream) | 1433 |
| SQLite | 라이브러리 직접 호출 (네트워크 없음) | — |

연결 방식도 세 가지다. **TCP/IP**는 원격 서버용 표준 방식이고, **Unix Domain Socket**은 로컬에서 TCP보다 빠르며(Oracle 로컬, PostgreSQL 기본), **Shared Memory**는 Oracle 로컬 연결에서 가장 높은 성능을 제공한다.

## SQL 쿼리 생애 주기

![SQL 쿼리 생애 주기](/assets/posts/sql-client-server-lifecycle.svg)

SQL이 결과로 돌아오기까지의 과정:

### 1단계: 연결(Connection)

```python
# Python psycopg2 예시
import psycopg2
conn = psycopg2.connect(
    host="localhost", port=5432,
    dbname="mydb", user="app", password="secret"
)
```

연결 과정에서 TCP 핸드셰이크 → TLS 협상(옵션) → DB 인증 → 세션 초기화가 순서대로 일어난다. 이 과정에 **50~200ms**가 소요되기 때문에 쿼리마다 새 연결을 만드는 것은 큰 낭비다.

### 2단계: 쿼리 전송

```java
// Java JDBC 예시 — Simple Query
Statement stmt = conn.createStatement();
ResultSet rs = stmt.executeQuery("SELECT * FROM users WHERE id = 1");
```

SQL 텍스트가 그대로 서버로 전송된다(Simple Query Protocol). 매번 파싱·최적화 비용이 발생한다.

### 3단계: 파싱과 의미 분석

서버 파서가 SQL 문자열을 읽어 **추상 구문 트리(AST)**를 만든다. 테이블 존재 여부, 컬럼 타입, 권한 등 **의미 검사(Semantic Analysis)**도 이 단계에서 수행된다.

### 4단계: 최적화

옵티마이저가 가능한 실행 계획 목록을 만들고, 통계(Statistics)를 기반으로 **비용(Cost)이 가장 낮은 계획**을 선택한다. 이 계획을 **실행 계획(Execution Plan)**이라 한다.

```sql
-- 실행 계획 확인 (PostgreSQL)
EXPLAIN ANALYZE
SELECT u.name, o.amount
FROM users u JOIN orders o ON u.user_id = o.user_id
WHERE o.amount > 40000;
```

### 5단계: 실행 및 결과 반환

실행 엔진이 스토리지에서 데이터를 읽어 결과를 직렬화해 클라이언트에 전송한다.

## Prepared Statement: 파싱 비용 절감 + SQL 인젝션 방어

```java
// Prepared Statement — 파싱은 1회, 실행은 N회
PreparedStatement ps = conn.prepareStatement(
    "SELECT * FROM users WHERE id = ?"
);
ps.setInt(1, 42);   // 바인딩 변수, SQL 인젝션 불가
ResultSet rs = ps.executeQuery();
```

Prepared Statement는 두 가지 이점을 준다. 첫째, SQL 텍스트를 한 번만 파싱·최적화하므로 반복 실행 시 서버 CPU를 아낀다. 둘째, 파라미터를 바인딩 변수(`?`, `:name`)로 처리하므로 SQL 인젝션 공격이 불가능해진다.

```sql
-- 나쁜 예: 문자열 조합 → SQL 인젝션 취약
-- "SELECT * FROM users WHERE name = '" + userInput + "'"
-- userInput = "'; DROP TABLE users; --"

-- 좋은 예: 바인딩 변수 사용
SELECT * FROM users WHERE name = :name  -- Oracle/PG
SELECT * FROM users WHERE name = ?      -- MySQL/JDBC
```

## 커넥션 풀: 연결 재사용

연결 비용이 크기 때문에 실제 애플리케이션은 **커넥션 풀(Connection Pool)**을 사용한다.

```yaml
# HikariCP 설정 예시 (Spring Boot)
spring:
  datasource:
    hikari:
      minimum-idle: 5        # 최소 유지 연결 수
      maximum-pool-size: 20  # 최대 연결 수
      idle-timeout: 600000   # 유휴 연결 제거 (10분)
      max-lifetime: 1800000  # 연결 최대 수명 (30분)
      connection-timeout: 30000  # 연결 대기 최대 시간
```

**커넥션 풀 크기 공식**: CPU 코어 수 × 2 + 유효 디스크 스핀들 수가 PostgreSQL의 경험 법칙이다. 너무 크면 DB 서버 자체의 컨텍스트 스위칭 비용이 증가한다.

## 정리

- DB는 **클라이언트-서버** 모델로 동작하며, 각 DBMS마다 전용 프로토콜을 사용한다
- 쿼리 생애 주기: **연결 → 전송 → 파싱 → 최적화 → 실행 → 결과 반환**
- **Prepared Statement**: 파싱 비용 절감 + SQL 인젝션 방어 — 항상 사용해야 한다
- **커넥션 풀**: 연결 비용(50~200ms)을 상각. `minimum-idle`, `maximum-pool-size` 튜닝 필수
- 연결 방식: TCP/IP(원격) > Unix Socket(로컬) > Shared Memory(Oracle 로컬)

---

**지난 글:** [SQL의 역사와 표준 — SQL-86부터 SQL:2023까지](/posts/sql-history-and-standard/)

**다음 글:** [SQL 언어 분류 — DDL, DML, DCL, TCL 완전 정복](/posts/sql-language-categories/)

<br>
읽어주셔서 감사합니다. 😊
