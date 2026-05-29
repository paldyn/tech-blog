---
title: "클라이언트-서버 프로토콜 — SQL이 전달되는 방식"
description: "SQL 쿼리가 애플리케이션을 떠나 DBMS에 도달하기까지 파싱·옵티마이저·실행의 과정을 추적하고, Simple Statement와 Prepared Statement의 차이를 명확히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["SQL", "클라이언트 서버", "프로토콜", "Prepared Statement", "SQL 인젝션"]
featured: false
draft: false
---

[지난 글](/posts/sql-history-and-standard/)에서 SQL 표준의 역사를 살펴봤습니다. 이번에는 내가 작성한 SQL 한 줄이 어떤 경로를 거쳐 실제로 실행되는지를 살펴봅니다. 이 흐름을 이해해야 성능 문제를 파악하고 보안 취약점을 예방할 수 있습니다.

## 전체 흐름

애플리케이션에서 `SELECT * FROM users WHERE id = 1`을 실행하면 내부적으로는 다음 단계를 거칩니다.

![SQL 클라이언트-서버 통신 흐름](/assets/posts/sql-client-server-protocol-flow.svg)

### 1. 드라이버와 커넥션

애플리케이션은 DBMS와 직접 소통하지 않습니다. **드라이버(Driver)**가 중간에서 역할을 합니다. Java라면 JDBC, Python이라면 psycopg2 또는 PyMySQL, Node.js라면 pg 또는 mysql2 같은 라이브러리가 드라이버입니다.

드라이버는 TCP 연결을 DBMS에 맺고, 각 DBMS의 고유 **와이어 프로토콜(Wire Protocol)**로 패킷을 전송합니다.

| DBMS | 프로토콜 | 기본 포트 |
|---|---|---|
| PostgreSQL | PostgreSQL Wire Protocol | 5432 |
| MySQL/MariaDB | MySQL Client/Server Protocol | 3306 |
| SQL Server | TDS (Tabular Data Stream) | 1433 |
| Oracle | Oracle Net (SQL*Net) | 1521 |

### 2. 파싱(Parse)

DBMS 서버는 SQL 문자열을 받으면 **어휘 분석 → 구문 분석 → AST(Abstract Syntax Tree) 생성** 과정을 거칩니다. 문법 오류는 이 단계에서 잡힙니다. "테이블이 없다"는 오류도 대부분 이 단계에서 발생합니다.

### 3. 옵티마이저(Optimizer)

파싱된 쿼리는 **옵티마이저**가 받습니다. 옵티마이저는 같은 결과를 얻는 여러 실행 경로를 탐색하고 비용(I/O, CPU)이 가장 낮은 **실행 계획(Execution Plan)**을 선택합니다. 인덱스를 쓸지, 어떤 방식으로 테이블을 조인할지가 여기서 결정됩니다.

`EXPLAIN` 명령으로 옵티마이저가 선택한 계획을 확인할 수 있습니다.

```sql
EXPLAIN SELECT * FROM users WHERE email = 'hong@example.com';
```

### 4. 실행(Execute)

실행 계획에 따라 **스토리지 엔진**이 데이터를 읽습니다. 버퍼 풀(메모리)에 데이터가 있으면 디스크를 읽지 않고 바로 반환합니다. 없으면 디스크에서 페이지를 로드합니다.

실행 결과는 **결과셋(Result Set)**으로 만들어져 프로토콜 패킷으로 직렬화되어 클라이언트로 전송됩니다.

## Simple Statement vs Prepared Statement

가장 중요한 실용적 주제입니다.

![Simple vs Prepared Statement](/assets/posts/sql-client-server-protocol-prepare.svg)

**Simple Statement**는 매번 SQL 문자열을 서버로 보내고, 파싱·옵티마이저·실행이 모두 한 번에 일어납니다. 동일한 쿼리를 100번 실행하면 파싱도 100번 합니다.

**Prepared Statement**는 두 단계로 나뉩니다.

1. **Prepare**: SQL 문자열(파라미터는 `?` 또는 `$1`로 표시)을 서버에 보내 파싱·최적화를 마칩니다.
2. **Execute**: 실제 값만 바인딩해서 실행합니다. 파싱·최적화를 건너뜁니다.

```sql
-- PostgreSQL 예시
PREPARE get_user(int) AS
    SELECT id, name, email FROM users WHERE id = $1;

EXECUTE get_user(42);
EXECUTE get_user(99);  -- 파싱 없이 실행
```

Prepared Statement의 세 가지 이점은 다음과 같습니다.

| 이점 | 설명 |
|---|---|
| **SQL 인젝션 방어** | 바인딩 값은 SQL 코드가 아닌 데이터로 처리됨 |
| **파싱 비용 절감** | 동일 쿼리 반복 시 옵티마이징 생략 |
| **플랜 캐시 활용** | 캐시된 실행 계획 재사용 |

## 커넥션 풀

DBMS 연결은 비용이 큽니다(TCP 핸드셰이크 + 인증 + 세션 초기화). 따라서 실무에서는 **커넥션 풀(Connection Pool)**을 사용해 연결을 재사용합니다. HikariCP(Java), pgBouncer(PostgreSQL), ProxySQL(MySQL)이 대표적입니다.

```
애플리케이션 → 커넥션 풀 → DB 서버
              (연결 10개 유지)
```

풀이 없으면 요청마다 새 연결을 맺고 끊어서 DB 서버가 연결 폭탄을 받을 수 있습니다.

## 정리

SQL 한 줄은 드라이버 → 와이어 프로토콜 → 파싱 → 옵티마이저 → 실행 → 결과셋 반환의 경로를 거칩니다. Prepared Statement를 쓰면 보안과 성능을 동시에 챙길 수 있습니다. 다음 글에서는 SQL 언어 분류(DDL, DML, DCL, TCL)를 명확히 정리합니다.

---

**지난 글:** [SQL의 역사와 표준 — ANSI/ISO SQL이 만들어진 이유](/posts/sql-history-and-standard/)

**다음 글:** [SQL 언어 분류 — DDL, DML, DCL, TCL](/posts/sql-language-categories/)

<br>
읽어주셔서 감사합니다. 😊
