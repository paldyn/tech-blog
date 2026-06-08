---
title: "클라이언트-서버 프로토콜과 커넥션 관리"
description: "JDBC, ODBC, 각 DBMS별 네트워크 프로토콜(MySQL Protocol v41, PostgreSQL Frontend/Backend, TDS)의 동작 원리를 설명하고, 커넥션 풀이 왜 필수인지, HikariCP 설정 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["SQL", "JDBC", "ODBC", "커넥션풀", "HikariCP", "프로토콜", "데이터베이스연결"]
featured: false
draft: false
---

[지난 글](/posts/sql-history-and-standard/)에서 SQL 표준과 방언의 역사를 다뤘다. 이번에는 애플리케이션이 DB에 연결하는 물리적 메커니즘을 들여다본다. SQL을 아무리 잘 써도 연결 자체를 잘못 관리하면 트래픽이 몰렸을 때 시스템이 멈춰버린다. 커넥션이 어떻게 맺어지고, 왜 풀링이 필요한지를 이해하면 장애 원인을 빠르게 파악할 수 있다.

## 전체 통신 흐름

![SQL 클라이언트-서버 통신 흐름](/assets/posts/sql-client-server-protocol-flow.svg)

애플리케이션이 SQL을 실행하는 과정은 다음과 같다.

1. **연결 요청**: 드라이버(JDBC/ODBC)가 DB 서버의 포트로 TCP 연결을 시도한다.
2. **인증**: 사용자 이름, 비밀번호, 데이터베이스 이름을 전달해 인증한다. TLS를 사용하면 이 단계 전에 핸드셰이크가 추가된다.
3. **세션 설정**: 세션 변수(타임존, 문자셋, 격리 수준 등)가 초기화된다.
4. **SQL 전송**: 드라이버가 SQL 문자열을 DBMS별 프로토콜로 직렬화해 전송한다.
5. **결과 수신**: 서버가 결과셋(ResultSet)을 청크로 나눠 전송한다.
6. **종료 또는 반납**: 사용을 마친 커넥션을 닫거나 풀에 반납한다.

## DBMS별 와이어 프로토콜

각 DBMS는 고유의 바이너리 프로토콜을 사용한다.

### MySQL: Client/Server Protocol v4.1+

MySQL 4.1부터 도입된 프로토콜은 커넥션 패킷, 명령 패킷, 응답 패킷의 3종류로 이루어진다. 기본 포트는 3306이다. MySQL 8.0부터는 X Protocol도 지원하며, 이는 비동기 통신과 CRUD API를 제공한다.

### PostgreSQL: Frontend/Backend Protocol

PostgreSQL은 클라이언트(Frontend)와 서버(Backend)가 메시지 타입으로 통신한다. 기본 포트는 5432. `StartupMessage`, `Query`, `DataRow`, `CommandComplete` 등의 메시지로 구성된다. SSL/TLS 협상이 프로토콜 레벨에서 내장되어 있다.

### SQL Server: TDS (Tabular Data Stream)

Microsoft가 설계한 TDS는 Sybase와 SQL Server 모두에서 사용한다. 포트 1433. .NET의 `System.Data.SqlClient`는 이 프로토콜 위에서 동작한다.

### Oracle: SQL*Net / Oracle Net

Oracle은 자체 프로토콜인 Oracle Net(구 SQL*Net)을 사용한다. JDBC Thin 드라이버는 순수 Java로 이 프로토콜을 구현한다.

## 커넥션 생성 비용

커넥션을 맺는 것은 저렴한 작업이 아니다.

- TCP 3-way 핸드셰이크
- TLS 핸드셰이크 (암호화 사용 시)
- 인증 패킷 교환
- 세션 초기화 (시간대, 문자셋, 스키마 설정)

짧은 요청이라면 커넥션 생성 자체가 전체 처리 시간의 대부분을 차지할 수 있다. 초당 수백 요청이 들어오는 서비스에서 매번 새 커넥션을 만들면 DB 서버가 금방 포화된다.

## 커넥션 풀이 필요한 이유

**커넥션 풀(Connection Pool)**은 미리 일정 수의 커넥션을 생성해두고, 요청이 오면 커넥션을 빌려주고, 작업이 끝나면 반납받아 재사용한다.

![커넥션 풀 설정](/assets/posts/sql-client-server-protocol-pool.svg)

### HikariCP 핵심 파라미터

| 파라미터 | 역할 | 주의사항 |
|---|---|---|
| `maximumPoolSize` | 최대 커넥션 수 | DB max_connections 한계 고려 |
| `minimumIdle` | 유휴 최소 커넥션 | 0으로 설정 시 풀이 소진될 수 있음 |
| `connectionTimeout` | 풀에서 커넥션 대기 최대 시간 | 초과 시 SQLException |
| `idleTimeout` | 유휴 커넥션 제거 대기 시간 | `maxLifetime`보다 짧아야 함 |
| `maxLifetime` | 커넥션 최대 수명 | DB의 `wait_timeout`보다 짧게 설정 |

### maxLifetime과 wait_timeout

흔한 장애 패턴 중 하나다. DB 서버가 `wait_timeout=600초`로 설정되어 있는데, HikariCP의 `maxLifetime=1800000ms`(30분)로 설정하면, 10분간 유휴 상태였던 커넥션을 DB 서버가 끊어버려도 풀은 그 커넥션이 살아있다고 믿는다. 다음 요청에서 이 죽은 커넥션을 사용하면 `Communications link failure`가 발생한다.

```sql
-- MySQL: 현재 세션 타임아웃 확인
SHOW VARIABLES LIKE 'wait_timeout';
SHOW VARIABLES LIKE 'interactive_timeout';

-- PostgreSQL: 세션 설정 확인
SHOW tcp_keepalives_idle;
SELECT current_setting('statement_timeout');
```

## Prepared Statement와 프로토콜

대부분의 드라이버는 **Prepared Statement**를 지원한다. SQL 문자열과 파라미터를 분리해 전송하면 두 가지 이점이 있다. 첫째, SQL 인젝션을 방지한다. 둘째, 같은 쿼리를 반복 실행할 때 파싱·최적화 비용을 절감한다.

```java
// Java JDBC Prepared Statement
String sql = "SELECT * FROM orders WHERE user_id = ? AND status = ?";
try (PreparedStatement ps = conn.prepareStatement(sql)) {
    ps.setInt(1, userId);
    ps.setString(2, "paid");
    ResultSet rs = ps.executeQuery();
    // rs 처리...
}
```

PostgreSQL은 서버 사이드 Prepared Statement를 지원해 반복 실행 시 실행 계획을 캐시한다. MySQL의 경우 `useServerPrepStmts=true` 옵션을 명시해야 서버 사이드로 동작한다.

다음 글에서는 SQL 언어 자체를 DDL, DML, DCL, TCL로 분류하고 각각의 역할을 살펴본다.

---

**지난 글:** [SQL의 역사와 표준 — ANSI SQL부터 SQL:2023까지](/posts/sql-history-and-standard/)

**다음 글:** [SQL 언어 분류 — DDL, DML, DCL, TCL](/posts/sql-language-categories/)

<br>
읽어주셔서 감사합니다. 😊
