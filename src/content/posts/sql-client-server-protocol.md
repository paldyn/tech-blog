---
title: "SQL 클라이언트-서버 프로토콜과 쿼리 처리 흐름"
description: "애플리케이션이 SQL을 보내면 DB 서버가 연결 관리·파싱·옵티마이징·실행 단계를 거쳐 결과를 반환하는 전체 흐름과, JDBC·libpq 같은 드라이버 계층을 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["클라이언트서버", "JDBC", "libpq", "쿼리처리", "파서", "옵티마이저", "SQL프로토콜"]
featured: false
draft: false
---

[지난 글](/posts/sql-history-and-standard/)에서 SQL 표준의 역사를 살펴봤다. 이번에는 애플리케이션 코드에서 `connection.execute("SELECT ...")` 를 호출하는 순간부터 결과가 돌아오기까지 내부에서 일어나는 일을 단계별로 추적한다. 이 흐름을 이해하면 느린 쿼리의 원인을 찾거나 커넥션 풀을 올바르게 설정하는 근거가 생긴다.

## 드라이버 계층: 애플리케이션과 서버 사이

애플리케이션이 SQL을 직접 TCP로 보내지는 않는다. **드라이버(driver)**가 중간에서 애플리케이션 언어의 API를 DB 전용 와이어 프로토콜로 변환한다.

| 계층 | Java | Python | Node.js |
|------|------|--------|---------|
| 표준 API | JDBC | DB-API 2.0 | 없음 (비표준) |
| PostgreSQL 드라이버 | pgjdbc | psycopg2/3 | node-postgres |
| MySQL 드라이버 | Connector/J | mysql-connector | mysql2 |
| 범용 추상화 | JPA/Hibernate | SQLAlchemy | Sequelize/Prisma |

드라이버는 세 가지 일을 한다.

1. **연결 수립**: TCP 소켓을 열고 DB 전용 핸드셰이크(handshake) 수행, 인증
2. **쿼리 전송**: SQL 문자열을 와이어 프로토콜 패킷으로 직렬화
3. **결과 수신**: 응답 패킷을 파싱해 애플리케이션 언어의 객체로 변환

## 와이어 프로토콜

각 RDBMS는 자체 바이너리 프로토콜을 사용한다.

- **PostgreSQL**: libpq Wire Protocol (TCP 5432). 프론트엔드/백엔드 메시지 스트림.
- **MySQL**: MySQL Client/Server Protocol (TCP 3306). HandshakeV9 기반.
- **Oracle**: TNS(Transparent Network Substrate) (TCP 1521).
- **SQL Server**: TDS(Tabular Data Stream) (TCP 1433). Microsoft 독점.

```python
# psycopg2 — PostgreSQL 와이어 프로토콜 사용 예
import psycopg2

conn = psycopg2.connect("host=localhost dbname=mydb user=app password=secret")
cur = conn.cursor()
cur.execute("SELECT id, name FROM employees WHERE dept_id = %s", (10,))
rows = cur.fetchall()
conn.close()
```

`%s` 플레이스홀더는 **파라미터 바인딩(parameter binding)**을 사용한다. SQL 문자열과 데이터가 분리된 채 서버에 전송되므로 SQL 인젝션이 원천 차단된다.

## 서버 내부: 쿼리 처리 파이프라인

![SQL 클라이언트-서버 프로토콜 흐름](/assets/posts/sql-client-server-protocol-flow.svg)

서버가 SQL을 받으면 다음 단계를 순서대로 거친다.

### 1. 연결 관리자(Connection Manager)

가장 먼저 **인증(authentication)**을 처리한다. PostgreSQL은 `pg_hba.conf`, MySQL은 `user` 테이블, Oracle은 `DBA_USERS`로 사용자를 검증한다. 인증이 통과하면 **세션(session)**이 생성된다.

**커넥션 풀(connection pool)**이 중요한 이유가 여기 있다. 매 요청마다 TCP 핸드셰이크와 DB 인증을 거치면 수십~수백 ms가 낭비된다. PgBouncer, HikariCP, c3p0 같은 풀러는 커넥션을 미리 만들어 두고 재사용한다.

### 2. 파싱(Parsing)

![쿼리 파싱 단계 상세](/assets/posts/sql-client-server-protocol-parse.svg)

SQL 문자열이 파서에 도달하면 두 단계를 거친다.

- **렉서(Lexer)**: 문자열을 토큰(SELECT, id, FROM, ...)으로 분리
- **파서(Parser)**: 토큰을 문법 규칙에 따라 AST(Abstract Syntax Tree)로 조합

파싱 후 **의미 분석(semantic analysis)**에서 테이블·컬럼 존재 여부와 데이터 타입, 권한을 검증한다. 문법은 맞지만 존재하지 않는 테이블을 참조하는 쿼리는 이 단계에서 에러가 난다.

### 3. 옵티마이저(Optimizer)

**가장 중요한 단계다.** 옵티마이저는 동일한 결과를 낼 수 있는 여러 실행 방법 중 비용(cost)이 가장 낮은 실행 계획을 선택한다.

```sql
-- 이 쿼리를 실행하는 방법은 최소 두 가지
SELECT * FROM employees WHERE dept_id = 10;

-- 방법 A: 풀스캔 (dept_id 인덱스 없을 때)
--   employees 테이블 전체를 읽어 dept_id = 10 필터링

-- 방법 B: 인덱스 스캔 (idx_emp_dept_id 인덱스 있을 때)
--   인덱스로 dept_id = 10인 행 위치 파악 → 해당 행만 읽기
```

옵티마이저는 통계 정보(테이블 행 수, 컬럼 값 분포)를 사용해 비용을 추정한다. `EXPLAIN` 명령으로 선택된 실행 계획을 확인할 수 있다.

### 4. 실행기(Executor)와 스토리지

실행 계획대로 데이터를 읽는다. **버퍼 캐시(buffer cache)**에 데이터가 있으면 디스크 I/O 없이 메모리에서 직접 읽는다. 캐시 히트율이 높을수록 쿼리가 빠르다.

## Prepared Statement: 파싱 비용 절감

같은 구조의 쿼리를 반복 실행할 때 매번 파싱하면 낭비다. **Prepared Statement**는 파싱·의미 분석·최적화까지만 미리 수행하고, 실제 값(파라미터)만 바꿔서 실행한다.

```sql
-- PostgreSQL: Prepared Statement
PREPARE get_emp (INTEGER) AS
    SELECT id, name FROM employees WHERE dept_id = $1;

EXECUTE get_emp(10);
EXECUTE get_emp(20);
```

JDBC의 `PreparedStatement`, psycopg2의 `execute()` (자동 prepare)가 이 방식을 사용한다. 파싱 오버헤드를 줄이는 동시에 SQL 인젝션도 차단하므로 프로덕션 코드에서는 항상 Prepared Statement를 써야 한다.

## 연결 수 관리

RDBMS는 동시 연결 수에 제한이 있다.

- PostgreSQL: `max_connections` (기본 100)
- MySQL: `max_connections` (기본 151)
- Oracle: 라이선스·메모리에 따라 가변

연결 하나당 서버 메모리(PostgreSQL은 약 5~10 MB)를 소비하므로 무작정 늘릴 수 없다. 커넥션 풀을 통해 애플리케이션 스레드 수보다 훨씬 적은 DB 커넥션으로 처리량을 확보하는 것이 올바른 설계다.

---

**지난 글:** [SQL의 역사와 표준: ANSI SQL에서 SQL:2023까지](/posts/sql-history-and-standard/)

**다음 글:** [SQL 언어 분류: DDL·DML·DCL·TCL·DQL 완전 정리](/posts/sql-language-categories/)

<br>
읽어주셔서 감사합니다. 😊
