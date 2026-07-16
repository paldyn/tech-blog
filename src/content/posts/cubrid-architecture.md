---
title: "CUBRID 아키텍처와 핵심 특징"
description: "국산 오픈소스 RDBMS CUBRID의 3계층 아키텍처(클라이언트·Broker·서버), 객체-관계형 혼합 모델, HA 복제, Java 저장 프로시저를 SQL 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 8
type: "knowledge"
category: "SQL"
tags: ["CUBRID", "국산DB", "오픈소스", "RDBMS", "Broker", "HA"]
featured: false
draft: false
---

[지난 글](/posts/altibase-hybrid-memory-disk/)에서 Altibase의 하이브리드 아키텍처를 살펴봤다. 이번에는 NHN(네이버·한게임)이 개발해 오픈소스로 공개한 국산 RDBMS **CUBRID**를 다룬다. CUBRID는 GPL/LGPL 이중 라이선스로 무료로 사용할 수 있고, 포털 대규모 서비스를 기반으로 설계된 독특한 아키텍처를 갖는다.

## CUBRID 개요

CUBRID는 1999년 NHN(당시 네이버)이 대규모 웹 서비스 요구에 맞게 개발한 RDBMS다. 2008년 오픈소스로 공개됐으며, 현재 CUBRID 프로젝트로 운영된다. 표준 SQL을 지원하는 관계형 모델에 객체 지향 확장(집합 타입, 상속)을 추가한 **객체-관계형 DBMS(ORDBMS)** 다.

## 3계층 아키텍처

CUBRID의 핵심 특징은 **클라이언트-Broker-서버**라는 3계층 구조다.

![CUBRID 아키텍처](/assets/posts/cubrid-architecture-overview.svg)

### CUBRID Broker (CAS)

Broker는 CUBRID 고유의 미들웨어 계층이다. Oracle의 Connection Manager, MySQL의 ProxySQL과 유사하지만, CUBRID에서는 기본 내장이다.

- **연결 풀링**: 클라이언트 연결 수를 제한하고 서버 연결을 재사용
- **Read/Write 분리**: 읽기 쿼리는 Replica로, 쓰기는 Primary로 자동 라우팅
- **Statement 재사용**: Prepared Statement 캐싱으로 파싱 비용 절감
- **부하 분산**: 여러 DB 서버 사이에 연결 분배

```bash
# Broker 상태 확인
cubrid broker status

# 출력 예시:
# NAME             PID    PORT   JQ AS AT ...
# query_editor     12345  30000   0  5  0
# broker1          12346  33000   0 40  5
```

```sql
-- Broker 연결 현황 (csql에서)
;broker
-- 또는 시스템 뷰:
SELECT host, port, status, num_clients
FROM   db_server_info;
```

## 주요 특징

![CUBRID 주요 특징](/assets/posts/cubrid-features.svg)

### 집합(SET) 타입 — ORDBMS 확장

CUBRID는 표준 SQL에 없는 **집합 타입(SET, MULTISET, SEQUENCE)** 을 지원한다.

```sql
-- SET 타입 컬럼: 중복 없는 집합
CREATE TABLE article (
    article_id  INTEGER PRIMARY KEY,
    title       VARCHAR(200),
    tags        SET(VARCHAR(50))  -- 태그 집합
);

INSERT INTO article VALUES (1, 'CUBRID 입문', {'DB', 'RDBMS', '국산DB'});
INSERT INTO article VALUES (2, 'SQL 최적화',  {'DB', 'SQL', '성능'});

-- SET에 특정 값이 포함된 행 조회
SELECT title FROM article WHERE 'DB' = ANY(tags);
-- → CUBRID 입문, SQL 최적화 모두 반환

-- SEQUENCE 타입: 순서 있는 집합 (중복 허용)
CREATE TABLE playlist (
    id    INTEGER,
    songs SEQUENCE(VARCHAR(100))
);
```

### 트랜잭션과 격리 수준

```sql
-- CUBRID 기본 격리 수준: TRAN_REP_CLASS_UNCOMMIT_INSTANCE
-- (MySQL의 Read Committed에 가까운 수준)

-- 트랜잭션 시작
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN;

UPDATE products SET stock = stock - 1 WHERE product_id = 100;
UPDATE orders   SET status = 'CONFIRMED' WHERE order_id = 9999;

COMMIT;
```

### HA (High Availability)

CUBRID HA는 **Primary-Replica(Standby)** 구조다.

```bash
# HA 상태 확인
cubrid heartbeat status

# Primary 서버에서 복제 상태
SELECT server_id, repl_delay, repl_status
FROM   db_ha_apply_info;
```

```ini
# cubrid.conf HA 설정 예시
[service]
service=server,broker,manager,heartbeat

[common]
ha_mode=on
ha_server_num=2
ha_node_list=primary:192.168.1.10, replica:192.168.1.11
ha_db_list=testdb
```

## SQL 기초 사용

CUBRID SQL은 표준 SQL과 거의 동일하지만 몇 가지 차이가 있다.

```sql
-- 페이지네이션: LIMIT 절 (MySQL과 동일)
SELECT article_id, title
FROM   article
ORDER  BY article_id DESC
LIMIT  10 OFFSET 20;

-- 자동 증가: AUTO_INCREMENT
CREATE TABLE users (
    user_id  INTEGER AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email    VARCHAR(100)
);

-- ROWNUM (Oracle 호환) 대신 LIMIT 권장
-- Oracle의 TO_DATE 대신 STR_TO_DATE 사용
SELECT STR_TO_DATE('2026-05-26', '%Y-%m-%d') AS dt;

-- 날짜 함수
SELECT SYSDATE, CURDATE(), NOW(), YEAR(SYSDATE);

-- DECODE (Oracle 호환 지원)
SELECT DECODE(status, 1, '활성', 0, '비활성', '알수없음') FROM users;
```

## 관리 도구

```bash
# DB 생성
cubrid createdb testdb ko_KR.utf8

# 서버 기동/종료
cubrid service start
cubrid service stop

# csql: CUBRID CLI 클라이언트
csql -u dba testdb
-- csql 내부에서:
;schema tablename    -- 테이블 스키마 조회
;info tables         -- 테이블 목록

# 백업
cubrid backupdb -S testdb
```

## CUBRID vs MySQL vs PostgreSQL

| 항목 | CUBRID | MySQL | PostgreSQL |
|---|---|---|---|
| 라이선스 | GPL/LGPL | GPL | PostgreSQL |
| Broker | 내장 | 별도(ProxySQL 등) | 별도(PgBouncer 등) |
| 집합 타입 | SET/MULTISET/SEQUENCE | 미지원(JSON으로 대체) | ARRAY |
| Java SP | JVM 내장 | 미지원 | Java 확장(비권장) |
| 풀텍스트 | 지원 | 지원 | 지원(tsvector) |

CUBRID는 특히 **국내 웹 서비스 환경**, Java 기반 애플리케이션, 한글 처리가 중요한 시스템에서 강점을 보인다. PostgreSQL이나 MySQL 대비 커뮤니티가 작지만 국내 기업 지원이 활발하다.

---

**지난 글:** [Altibase 하이브리드 메모리-디스크 구조](/posts/altibase-hybrid-memory-disk/)

**다음 글:** [CUBRID Java 연동 완전 가이드](/posts/cubrid-java-integration/)

<br>
읽어주셔서 감사합니다. 😊
