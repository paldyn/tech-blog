---
title: "클라이언트-서버 모델과 와이어 프로토콜"
description: "SQL 명령이 애플리케이션을 떠나 DBMS에 도달하고 결과가 돌아오기까지의 경로를 네트워크 수준에서 추적합니다. PostgreSQL과 MySQL의 와이어 프로토콜 구조를 실제 바이트 단위로 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["sql", "클라이언트서버", "와이어프로토콜", "postgresql", "mysql", "jdbc", "드라이버"]
featured: false
draft: false
---

## 우리가 SQL을 쓰는 방식

코드를 작성할 때 우리는 이렇게 쓴다.

```python
# Python + psycopg2 (PostgreSQL 드라이버)
import psycopg2

conn = psycopg2.connect("host=localhost dbname=mydb user=alice password=secret")
cur = conn.cursor()
cur.execute("SELECT id, name FROM employees WHERE dept_id = 10")
rows = cur.fetchall()
```

이 코드를 실행하면 화면에 결과가 나타난다. 하지만 `cur.execute(...)` 한 줄 뒤에 무슨 일이 일어나는지 아는 사람은 많지 않다. 이번 글은 그 과정을 네트워크 패킷 수준까지 추적한다.

---

## 클라이언트-서버 아키텍처

RDBMS는 거의 예외 없이 **클라이언트-서버 모델**로 동작한다. 데이터베이스 엔진(서버)은 독립 프로세스로 실행되며, 애플리케이션(클라이언트)은 네트워크 소켓을 통해 통신한다.

```text
┌─────────────────┐        TCP/IP         ┌───────────────────┐
│  애플리케이션    │  ──────────────────►  │  DBMS 서버 프로세스 │
│  (Python/Java)  │                       │  (postgres / mysqld)│
│                 │  ◄──────────────────  │                   │
└─────────────────┘     ResultSet 반환     └───────────────────┘
```

로컬 개발 환경에서도 동일하다. `localhost:5432`처럼 루프백 소켓으로 연결되므로 구조는 같다.

예외: **SQLite**는 클라이언트-서버 모델이 아니다. 라이브러리가 파일을 직접 열기 때문에 소켓도, 프로토콜도 없다. 이 점이 SQLite를 모바일·임베디드에서 강력하게 만드는 동시에 제약이기도 하다. (SQLite 편에서 자세히 다룬다.)

---

## 쿼리 실행의 8단계

![SQL 쿼리 실행 흐름](/assets/posts/sql-client-server-protocol-flow.svg)

### 클라이언트 측

**① 쿼리 작성**: 애플리케이션이 SQL 문자열을 준비한다. 이 시점에는 단순한 파이썬 문자열일 뿐이다.

**② DB 드라이버**: 드라이버(JDBC, psycopg2, mysql2 등)가 문자열을 받아 DBMS가 이해하는 프로토콜로 포장한다. 드라이버는 DBMS 제조사나 커뮤니티가 제공하며, DBMS마다 별도 드라이버가 필요하다.

**③ 직렬화 & TCP 전송**: 드라이버가 SQL 문자열을 DBMS의 **와이어 프로토콜**에 맞는 바이트 패킷으로 변환하여 TCP 소켓으로 전송한다.

### 서버 측

**⑤ 수신 & 파싱**: DBMS가 패킷을 받아 SQL 문자열을 추출하고, **렉서(Lexer)** → **파서(Parser)** 순서로 처리해 AST(Abstract Syntax Tree)를 만든다. 이 단계에서 문법 오류가 검출된다.

**⑥ 옵티마이저**: AST를 분석해 가장 효율적인 **실행 계획(Execution Plan)**을 수립한다. "인덱스를 쓸까? 전체 스캔이 빠를까?" 같은 결정을 여기서 내린다.

**⑦ 실행 엔진**: 실행 계획대로 스토리지에서 데이터를 읽고, 조인·필터·집계를 수행해 **ResultSet**을 만든다.

**⑧ 결과 반환**: ResultSet을 와이어 프로토콜 패킷으로 직렬화해 클라이언트에 전송한다.

---

## 와이어 프로토콜 (Wire Protocol)

와이어 프로토콜은 클라이언트와 서버가 TCP 위에서 주고받는 **바이트 포맷 규약**이다. DBMS마다 고유한 프로토콜을 갖는다.

![와이어 프로토콜 구조](/assets/posts/sql-client-server-protocol-wire.svg)

### PostgreSQL 프론트엔드/백엔드 프로토콜 v3

PostgreSQL 클라이언트가 단순 쿼리를 보낼 때 패킷 구조:

```text
Byte 0    : 메시지 타입 = 'Q' (0x51)
Bytes 1-4 : 메시지 길이 (페이로드 포함, Big-Endian int32)
Bytes 5-N : SQL 문자열 (UTF-8) + NULL 종료자 (0x00)

예: "SELECT 1\0"  → Q | 00 00 00 0E | 53 45 4C 45 43 54 20 31 00
```

서버 응답 시퀀스:

1. `T` (RowDescription): 컬럼 개수, 이름, 타입 OID
2. `D` (DataRow): 행마다 하나씩, 각 컬럼 값의 바이트 길이와 데이터
3. `C` (CommandComplete): `"SELECT 3"` 처럼 완료 태그
4. `Z` (ReadyForQuery): 다음 명령을 받을 준비 완료, 트랜잭션 상태 포함

이 구조 덕분에 **스트리밍**이 가능하다. `D` 메시지를 받는 즉시 애플리케이션이 처리할 수 있어 수백만 행도 메모리 폭발 없이 처리된다.

### MySQL 클라이언트/서버 프로토콜

MySQL은 3+1 바이트 헤더를 사용한다.

```text
Bytes 0-2 : 페이로드 길이 (Little-Endian int24)
Byte 3    : 시퀀스 번호 (패킷 순서 추적)
Byte 4    : 커맨드 타입 (COM_QUERY = 0x03)
Bytes 5-N : SQL 문자열 (NULL 종료자 없음)
```

응답은 `Result Set` 패킷으로 컬럼 정의 → 행 데이터 → EOF 패킷 순으로 온다.

---

## 연결 풀링(Connection Pooling)

TCP 연결 수립(`SYN → SYN-ACK → ACK`)과 DBMS 인증 핸드셰이크는 비용이 크다. 매 쿼리마다 연결을 새로 맺으면 수십 밀리초가 낭비된다.

**커넥션 풀**은 미리 맺어둔 연결들을 재사용하는 패턴이다.

```python
# SQLAlchemy 연결 풀 예시
from sqlalchemy import create_engine

engine = create_engine(
    "postgresql://alice:secret@localhost/mydb",
    pool_size=10,       # 기본 유지 연결 수
    max_overflow=20,    # 피크 시 추가 허용 연결
    pool_timeout=30,    # 연결 획득 대기 최대 시간 (초)
)
```

운영 환경에서는 PgBouncer(PostgreSQL), ProxySQL(MySQL) 같은 **외부 커넥션 풀러**를 애플리케이션 앞에 놓는다. 수천 개 앱 연결을 수십 개 실제 DB 연결로 압축한다.

---

## 준비된 문장 (Prepared Statement)

평범한 `execute(sql)`는 매번 파싱 + 플래닝을 반복한다. **준비된 문장**은 실행 계획을 한 번 만들어 세션 내에서 재사용한다.

```sql
-- PostgreSQL 와이어 프로토콜 수준 Prepared Statement
PREPARE emp_by_dept (integer) AS
  SELECT id, name FROM employees WHERE dept_id = $1;

EXECUTE emp_by_dept(10);
EXECUTE emp_by_dept(20);
```

드라이버 수준에서도 동일하게 동작한다. psycopg2는 `cursor.execute("… WHERE id = %s", (1,))`를 자동으로 서버 측 준비된 문장으로 처리할 수 있다.

준비된 문장은 성능 외에도 **SQL Injection 방어**의 핵심 수단이다. `$1` 자리에 들어오는 값은 문자열로 삽입되는 게 아니라 별도 파라미터 바인딩으로 전달되기 때문에, SQL 구조를 변형할 수 없다.

---

## 포트와 설정

각 DBMS의 기본 포트:

```text
PostgreSQL  5432
MySQL       3306
Oracle      1521
SQL Server  1433
SQLite      (없음 — 파일 직접 접근)
```

TLS/SSL 암호화도 동일 포트에서 지원된다(PostgreSQL은 SSLRequest 메시지로 협상).

---

## 정리

- SQL은 TCP/IP 소켓을 통해 DBMS 서버로 전달된다.
- **DB 드라이버**가 SQL 문자열을 각 DBMS의 **와이어 프로토콜**로 변환한다.
- 서버 측에서는 파싱 → 최적화 → 실행 순으로 처리한다.
- 서버 응답은 스트리밍 방식으로 오므로 대용량 결과도 메모리 효율적으로 처리 가능하다.
- **커넥션 풀링**으로 연결 수립 비용을 절감한다.
- **준비된 문장**은 성능과 SQL Injection 방어 두 마리 토끼를 잡는다.

**다음 글:** SQL 언어 분류 (DDL · DML · DCL · TCL) — 각 분류가 무엇을 하고 왜 이렇게 나뉘어졌는지를 정리합니다.

<br>
읽어주셔서 감사합니다. 😊
