---
title: "클라이언트-서버 모델과 와이어 프로토콜"
description: "SQL 쿼리가 애플리케이션에서 DBMS 서버까지 어떻게 전달되는지 살펴봅니다. TCP/IP 위에서 동작하는 DBMS별 와이어 프로토콜, Simple vs Extended Query Protocol, 커넥션 풀의 역할을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["sql", "클라이언트서버", "프로토콜", "jdbc", "odbc", "prepared-statement", "커넥션풀"]
featured: false
draft: false
---

## 이전 글 연결

지난 글에서 SQL이 어떻게 표준화됐는지 살펴봤습니다. 그런데 우리가 코드에서 `connection.execute("SELECT ...")` 한 줄을 실행할 때, 실제로는 무슨 일이 벌어질까요? SQL 문자열이 어떻게 DBMS에 전달되고, 결과가 어떻게 돌아오는지 이해하면 성능 튜닝과 보안 취약점 방어 모두에서 큰 그림이 보입니다.

## 클라이언트-서버 모델

DBMS는 전형적인 **클라이언트-서버 아키텍처**로 동작합니다.

![SQL 쿼리의 여행 — 클라이언트에서 결과까지](/assets/posts/sql-client-server-protocol-flow.svg)

클라이언트(애플리케이션)는 SQL을 문자열로 생성하고, **드라이버(JDBC, ODBC, libpq 등)**가 이를 DBMS별 바이너리 프로토콜로 직렬화해 TCP 소켓으로 전송합니다. 서버는 수신된 패킷을 파싱하고, 실행 계획을 수립한 후, 스토리지에서 데이터를 읽어 결과를 돌려줍니다.

### DBMS별 기본 포트

| DBMS | 프로토콜 | 기본 포트 |
|------|---------|---------|
| PostgreSQL | Frontend-Backend Protocol (FBP) | 5432 |
| MySQL / MariaDB | MySQL Client-Server Protocol | 3306 |
| Oracle | TNS (Transparent Network Substrate) | 1521 |
| SQL Server | TDS (Tabular Data Stream) | 1433 |
| SQLite | 해당 없음 (파일 직접 접근) | — |

SQLite는 클라이언트-서버 모델이 없습니다. 프로세스가 파일을 직접 열어 읽고 씁니다. 이것이 SQLite가 단일 프로세스 환경에 적합하고 고동시성에 취약한 이유입니다.

## Simple Query vs Extended Query (Prepared Statement)

![Simple vs Extended Query Protocol](/assets/posts/sql-client-server-protocol-prepare.svg)

### Simple Query Protocol

클라이언트가 SQL 문자열 전체를 매번 전송합니다.

```sql
-- Simple Query: 서버가 매번 파싱·계획 수립
SELECT * FROM orders WHERE customer_id = 42;
SELECT * FROM orders WHERE customer_id = 99;
SELECT * FROM orders WHERE customer_id = 100;
-- → 동일한 구조인데 3번 파싱됨
```

- 장점: 구현이 단순, 1회성 쿼리에 적합
- 단점: 반복 실행 시 파싱 오버헤드, SQL Injection 위험

### Extended Query Protocol (Prepared Statement)

SQL 구조와 실행을 분리합니다.

```sql
-- 1단계: 서버에 쿼리 등록 (파싱·계획 수립 1회)
PREPARE get_orders(int) AS
  SELECT order_id, amount
  FROM   orders
  WHERE  customer_id = $1      -- PostgreSQL 파라미터 바인딩
  ORDER  BY created_at DESC;

-- 2단계: 값만 바꿔 N회 실행 (파싱 재사용)
EXECUTE get_orders(42);
EXECUTE get_orders(99);
EXECUTE get_orders(100);

-- 사용 후 해제
DEALLOCATE get_orders;
```

대부분의 JDBC/ORM 라이브러리는 내부적으로 Prepared Statement를 사용합니다. PostgreSQL의 경우 같은 쿼리를 5회 이상 실행하면 자동으로 서버 측 캐시로 전환합니다(auto-prepared).

### SQL Injection과 파라미터 바인딩

Prepared Statement가 SQL Injection을 막는 원리는 단순합니다. SQL 구조와 데이터를 **별도 채널**로 전송해 값이 SQL로 해석되지 않습니다.

```python
# 취약한 코드: 문자열 직접 포맷
user_input = "'; DROP TABLE users; --"
query = f"SELECT * FROM users WHERE name = '{user_input}'"
# → SELECT * FROM users WHERE name = ''; DROP TABLE users; --'

# 안전한 코드: 파라미터 바인딩
cursor.execute(
    "SELECT * FROM users WHERE name = %s",
    (user_input,)   # 값이 SQL로 해석되지 않음
)
```

DBMS는 SQL 구조 파싱이 완료된 후 바인딩 값을 데이터로만 취급합니다. 어떤 값을 넣어도 쿼리 구조를 바꿀 수 없습니다.

## 드라이버 레이어

애플리케이션이 직접 TCP 소켓을 다루지 않는 이유는 **드라이버(Driver)**가 복잡성을 숨겨주기 때문입니다.

```java
// JDBC (Java Database Connectivity) 예시
String url = "jdbc:postgresql://localhost:5432/mydb";
Connection conn = DriverManager.getConnection(url, "user", "pass");

// PreparedStatement: 내부적으로 Extended Query Protocol 사용
PreparedStatement ps = conn.prepareStatement(
    "SELECT * FROM orders WHERE customer_id = ? AND status = ?"
);
ps.setInt(1, 42);
ps.setString(2, "PAID");
ResultSet rs = ps.executeQuery();

while (rs.next()) {
    System.out.println(rs.getInt("order_id"));
}
```

**ODBC(Open Database Connectivity)**는 드라이버 추상화 레이어입니다. 언어에 무관하게 동일한 API로 다양한 DBMS에 접속할 수 있습니다. Python의 `pyodbc`, C의 `sqlsrv` 드라이버가 대표적입니다.

## 커넥션과 커넥션 풀

TCP 연결 수립(`3-way handshake`) + DBMS 인증 과정은 수십~수백 ms가 걸립니다. 웹 서버가 요청마다 새 커넥션을 맺으면 성능이 크게 저하됩니다.

**커넥션 풀(Connection Pool)**은 미리 여러 커넥션을 만들어 두고 재사용합니다.

```yaml
# HikariCP (Spring Boot 기본 커넥션 풀) 설정 예시
spring:
  datasource:
    hikari:
      maximum-pool-size: 10      # 최대 커넥션 수
      minimum-idle: 5            # 최소 유지 수
      connection-timeout: 30000  # 획득 대기 최대 30초
      idle-timeout: 600000       # 유휴 10분 후 해제
      max-lifetime: 1800000      # 커넥션 최대 수명 30분
```

커넥션 풀 크기 공식으로 유명한 것은 HikariCP 권고입니다:

```
pool_size = (core_count × 2) + effective_spindle_count
```

대부분의 웹 애플리케이션 서버에서는 **10~20개** 정도로 시작해서 모니터링으로 조정하는 것이 실용적입니다.

## 트랜잭션과 커넥션의 관계

트랜잭션은 **하나의 커넥션** 위에서 실행됩니다. 커넥션이 풀로 반환되기 전에 트랜잭션이 커밋 또는 롤백돼야 합니다.

```python
# 트랜잭션 범위 = 커넥션 보유 범위
with connection.cursor() as cur:
    try:
        cur.execute("UPDATE accounts SET balance = balance - 100 WHERE id = 1")
        cur.execute("UPDATE accounts SET balance = balance + 100 WHERE id = 2")
        connection.commit()    # 트랜잭션 완료 → 커넥션 반환 가능
    except Exception:
        connection.rollback()  # 실패 시 롤백
        raise
```

트랜잭션을 길게 유지하면 커넥션이 풀에서 점유되고, 다른 요청이 커넥션을 기다리는 **커넥션 고갈(connection starvation)**이 발생합니다. 트랜잭션은 가능한 짧게 유지하는 것이 원칙입니다.

## 정리

SQL 쿼리 한 줄이 실행되기까지 TCP 연결, 프로토콜 직렬화, 파싱, 실행 계획, 스토리지 접근, 결과 직렬화, TCP 전송이 모두 이루어집니다. Prepared Statement는 이 과정에서 파싱 비용을 줄이고 SQL Injection을 막는 핵심 메커니즘입니다. 커넥션 풀은 TCP 연결 비용을 분산해 성능을 높입니다. 다음 글에서는 SQL을 DDL·DML·DCL·TCL로 분류하는 **언어 카테고리**를 살펴보겠습니다.

**다음 글:** SQL 언어 분류 — DDL · DML · DCL · TCL

<br>
읽어주셔서 감사합니다. 😊
