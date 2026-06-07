---
title: "SQL 클라이언트-서버 프로토콜 — 쿼리가 실행되는 과정"
description: "SQL 쿼리가 클라이언트에서 DBMS 서버까지 어떻게 전달되고, 파싱·최적화·실행을 거쳐 결과가 돌아오는지 내부 흐름을 이해합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["SQL", "클라이언트서버", "PreparedStatement", "JDBC", "쿼리실행"]
featured: false
draft: false
---

[지난 글](/posts/sql-history-and-standard/)에서 SQL 표준이 어떻게 발전했는지 살펴봤다. SQL을 단순히 쿼리를 보내는 언어로만 알면 성능 문제에 부딪혔을 때 원인을 찾기 어렵다. 이번에는 SQL 텍스트가 클라이언트를 떠나 DBMS 서버에서 결과로 돌아오기까지의 과정을 단계별로 살펴본다.

## 쿼리 실행 8단계

### ① SQL 텍스트 작성

개발자가 애플리케이션 코드나 SQL 클라이언트(psql, DBeaver, SQL*Plus 등)에서 SQL 문자열을 작성한다.

### ② 드라이버 직렬화

SQL 텍스트는 드라이버(JDBC, ODBC, libpq, pymysql 등)가 해당 DBMS 전용 와이어 프로토콜(wire protocol)로 직렬화해 TCP/IP를 통해 전송한다. PostgreSQL은 Frontend/Backend Protocol, MySQL은 MySQL Protocol(COM_QUERY 커맨드)을 사용한다.

### ③ 파서(Parser)

서버는 수신한 SQL 텍스트를 **파서**로 분석한다. 렉서(Lexer)가 토큰을 분리하고, 파서가 문법 규칙에 따라 **AST(Abstract Syntax Tree)**를 생성한다. 문법 오류는 여기서 잡힌다.

### ④ 옵티마이저(Optimizer)

AST를 받은 **옵티마이저**가 통계 정보(테이블 크기, 컬럼 분포, 인덱스 구조)를 바탕으로 가능한 실행 계획들의 비용을 계산하고, 가장 저렴한 **실행 계획(Execution Plan)**을 선택한다. `EXPLAIN` 명령으로 이 계획을 확인할 수 있다.

### ⑤ 실행 엔진(Executor)

선택된 실행 계획에 따라 **실행 엔진**이 실제 데이터를 처리한다. 조인 알고리즘(Nested Loop, Hash Join, Merge Join), 집계 연산 등이 여기서 이루어진다.

### ⑥ 스토리지 엔진

실행 엔진의 요청에 따라 **스토리지 엔진**이 데이터를 읽는다. 버퍼 캐시에 있으면 메모리에서, 없으면 디스크에서 페이지를 읽어온다. 이 I/O 비용이 쿼리 성능에 가장 큰 영향을 미친다.

### ⑦⑧ 결과 반환 및 페치

결과 집합이 드라이버를 통해 클라이언트로 반환된다. 수백만 행 결과라면 한 번에 전송하지 않고 **커서(Cursor)**를 통해 배치로 가져온다(FETCH).

![SQL 쿼리 실행 흐름](/assets/posts/sql-client-server-protocol-flow.svg)

## Prepared Statement

매번 SQL 텍스트를 파싱하는 비용을 줄이고 SQL Injection을 방지하는 핵심 도구가 **Prepared Statement**다. 쿼리 구조를 먼저 준비(PREPARE)하고, 파라미터만 바꿔가며 반복 실행(EXECUTE)한다.

```java
// Java JDBC 예시
PreparedStatement ps = conn.prepareStatement(
    "SELECT * FROM 고객 WHERE 고객ID = ?"
);
ps.setString(1, customerId);   // 파라미터 바인딩
ResultSet rs = ps.executeQuery();
```

파라미터 바인딩은 값을 SQL 텍스트에 직접 붙이지 않고 별도로 전달하므로, `'; DROP TABLE 고객; --` 같은 악의적 입력이 SQL 명령으로 해석되지 않는다.

![Prepared Statement vs 일반 쿼리](/assets/posts/sql-client-server-protocol-prepared.svg)

## 커넥션 풀(Connection Pool)

TCP 커넥션 수립은 비싼 연산이다. 매 요청마다 새로운 커넥션을 만들면 CPU와 네트워크 오버헤드가 크다. 실제 서비스에서는 **커넥션 풀**을 사용해 커넥션을 미리 만들어 두고 재사용한다.

```
HikariCP 설정 예시 (Spring Boot)
  minimumIdle: 5      -- 항상 유지할 최소 커넥션 수
  maximumPoolSize: 20 -- 최대 허용 커넥션 수
  connectionTimeout: 30000  -- 커넥션 대기 타임아웃 (ms)
```

풀이 부족하면 요청이 대기하고, 너무 크면 DBMS 메모리를 낭비한다. CPU 코어 수 × 2 + 유효 스핀들 수를 시작점으로 튜닝한다(HikariCP 가이드라인).

## EXPLAIN으로 실행 계획 확인

```sql
-- PostgreSQL
EXPLAIN ANALYZE
SELECT * FROM 고객 WHERE 나이 > 30;

-- MySQL
EXPLAIN FORMAT=JSON
SELECT * FROM 고객 WHERE 나이 > 30;
```

`EXPLAIN` 결과에서 확인해야 할 핵심 지표:
- **Seq Scan / Full Table Scan**: 인덱스 없이 전체 테이블 스캔 — 행이 많으면 느림
- **Index Scan / Index Range Scan**: 인덱스 사용 — 선택도 낮은 조건에 효과적
- **rows**: 옵티마이저 추정 처리 행 수 — 실제와 크게 다르면 통계 갱신 필요
- **actual time** (PostgreSQL의 ANALYZE 옵션): 실제 소요 시간

---

**지난 글:** [SQL의 역사와 표준 — ISO SQL이 중요한 이유](/posts/sql-history-and-standard/)

**다음 글:** [SQL 언어 분류 — DDL, DML, DCL, TCL](/posts/sql-language-categories/)

<br>
읽어주셔서 감사합니다. 😊
