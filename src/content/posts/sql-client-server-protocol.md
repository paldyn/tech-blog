---
title: "클라이언트-서버 프로토콜 — SQL 실행의 여정"
description: "클라이언트가 SQL을 전송해 결과를 받기까지의 과정 — 드라이버, 프로토콜, 파싱, 최적화, 실행 — 을 단계별로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["SQL", "클라이언트 서버", "JDBC", "SQL 파싱", "커넥션 풀"]
featured: false
draft: false
---

[지난 글](/posts/sql-history-and-standard/)에서 SQL 표준의 역사를 살펴봤습니다. 이번에는 우리가 작성한 SQL이 DBMS 서버에서 실제로 실행될 때까지 어떤 여정을 거치는지 따라가 보겠습니다. "왜 첫 번째 쿼리는 느리고 두 번째는 빠른가?" 같은 질문에 대한 답이 여기 있습니다.

## 큰 그림

SQL 실행은 다음 단계를 거칩니다.

```
애플리케이션 → 드라이버 → 네트워크(TCP) → DBMS 서버(파싱 → 최적화 → 실행) → 결과 반환
```

![SQL 실행 흐름](/assets/posts/sql-client-server-protocol-flow.svg)

## 드라이버: 언어와 DB를 잇는 다리

각 프로그래밍 언어는 데이터베이스에 접속하기 위한 표준 인터페이스를 갖습니다.

| 언어/표준 | 드라이버 |
|-----------|---------|
| Java | JDBC (Java Database Connectivity) |
| Python | DB-API 2.0 (`psycopg2`, `cx_Oracle`, `mysql-connector`) |
| .NET | ADO.NET (`SqlClient`, `Npgsql`, `MySqlConnector`) |
| ODBC | 공통 C API — 다양한 언어에서 사용 가능 |

드라이버는 SQL 문자열을 받아 DBMS 고유 **와이어 프로토콜**로 직렬화해 전송하고, 결과를 역직렬화해 언어 객체로 반환합니다.

```java
// Java JDBC 예시
Connection conn = DriverManager.getConnection(
    "jdbc:postgresql://localhost:5432/mydb", "user", "pass");

PreparedStatement ps = conn.prepareStatement(
    "SELECT name, salary FROM employees WHERE dept_id = ?");
ps.setInt(1, 10);
ResultSet rs = ps.executeQuery();

while (rs.next()) {
    System.out.println(rs.getString("name") + ": " + rs.getInt("salary"));
}
```

## 와이어 프로토콜

각 DBMS는 클라이언트-서버 통신을 위한 고유 프로토콜을 갖습니다.

| DBMS | 기본 포트 | 프로토콜 |
|------|----------|---------|
| Oracle | 1521 | TNS (Transparent Network Substrate) |
| PostgreSQL | 5432 | Frontend/Backend Protocol (공개 문서화) |
| MySQL / MariaDB | 3306 | MySQL Protocol (패킷 기반) |
| SQL Server | 1433 | TDS (Tabular Data Stream) |

## DBMS 내부: 파싱 → 최적화 → 실행

![SQL 파싱 단계 상세](/assets/posts/sql-client-server-protocol-parse.svg)

### 1단계: 파싱(Parsing)

SQL 문자열을 받아 구문 검사 후 **파스 트리(Abstract Syntax Tree)** 를 만들고, 테이블·컬럼 존재 여부와 접근 권한을 확인합니다.

**소프트 파싱(Soft Parse)**: 같은 SQL이 이미 **플랜 캐시(Plan Cache)** 에 있으면 파싱·최적화를 건너뜁니다.  
**하드 파싱(Hard Parse)**: 처음 실행되는 SQL이나 캐시에 없는 SQL은 전 과정을 다시 거칩니다.

### 2단계: 최적화(Optimization)

통계 정보(테이블 행 수, 컬럼 분포, 인덱스 구조)를 바탕으로 가장 비용이 낮은 **실행 계획(Execution Plan)** 을 선택합니다.

```sql
-- 실행 계획 확인 (PostgreSQL)
EXPLAIN ANALYZE
SELECT name, salary
FROM   employees
WHERE  dept_id = 10
ORDER BY salary DESC;
```

### 3단계: 실행(Execution)

실행 계획대로 스토리지 엔진에 접근해 데이터를 읽고, 필터·정렬·집계를 수행합니다.

### 4단계: 결과 전송

결과를 **커서(Cursor)** 형태로 클라이언트에 전송합니다. 클라이언트는 `FETCH` 또는 `ResultSet.next()`로 행을 하나씩 가져옵니다.

## 커넥션 풀이 필요한 이유

TCP 연결 하나를 맺는 데는 3-way 핸드셰이크 + 인증 과정이 필요해 수십~수백 ms가 걸립니다. 매 요청마다 연결을 새로 맺으면 성능이 극히 떨어집니다. **커넥션 풀**은 연결을 미리 만들어 두고 재사용합니다.

```yaml
# Spring Boot - HikariCP 설정 예시
spring:
  datasource:
    hikari:
      maximum-pool-size: 20      # 최대 커넥션 수
      minimum-idle: 5            # 유지할 최소 유휴 커넥션
      connection-timeout: 30000  # 30초 대기 후 에러
      idle-timeout: 600000       # 10분 유휴 시 반납
```

## Prepared Statement: 보안 + 성능

`?` 자리 표시자를 사용한 Prepared Statement는 두 가지 이점이 있습니다.

1. **SQL 인젝션 방지**: 파라미터 값이 SQL 구조에 영향을 줄 수 없습니다.
2. **소프트 파싱**: 파라미터만 다른 동일 구조 SQL은 파스 트리를 재사용합니다.

```python
# Python - psycopg2 Prepared Statement 예시
cursor.execute(
    "SELECT * FROM products WHERE price < %s AND category_id = %s",
    (max_price, category_id)  # 파라미터는 별도로 바인딩
)
```

## 정리

- SQL은 드라이버 → 와이어 프로토콜 → DBMS(파싱 → 최적화 → 실행) → 결과 반환의 흐름으로 처리됩니다.
- 플랜 캐시가 있으면 파싱·최적화를 건너뛰는 소프트 파싱이 일어납니다.
- 커넥션 풀로 연결 비용을 줄이고, Prepared Statement로 보안과 성능을 함께 챙깁니다.

다음 글에서는 SQL을 기능에 따라 분류하는 **DDL·DML·DCL·TCL** 네 가지 언어 범주를 살펴봅니다.

---

**지난 글:** [SQL 역사와 표준 — SQL-86부터 SQL:2023까지](/posts/sql-history-and-standard/)

**다음 글:** [SQL 언어 분류 — DDL·DML·DCL·TCL](/posts/sql-language-categories/)

<br>
읽어주셔서 감사합니다. 😊
