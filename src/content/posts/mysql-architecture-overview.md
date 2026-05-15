---
title: "MySQL 아키텍처 개요 — 서버 레이어와 스토리지 엔진"
description: "MySQL의 두 계층 구조인 서버 레이어(파서·옵티마이저·실행 엔진)와 스토리지 엔진 플러그인 아키텍처를 설명합니다. 스레드 per 연결 모델, Handler API, InnoDB가 기본 엔진이 된 이유도 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["mysql", "아키텍처", "innodb", "스토리지엔진", "서버레이어", "옵티마이저"]
featured: false
draft: false
---

[지난 글](/posts/pg-slow-query-diagnosis/)에서 PostgreSQL의 슬로우 쿼리를 진단하는 워크플로우를 정리했습니다. 이제 새로운 DBMS인 MySQL로 넘어갑니다. PostgreSQL이 프로세스 per 연결 모델인 반면, MySQL은 **스레드 per 연결** 모델로 동작합니다. 그리고 MySQL의 가장 큰 특징은 스토리지 엔진이 **플러그인** 형태로 교체 가능하다는 점입니다.

## MySQL의 2계층 구조

![MySQL 서버 아키텍처](/assets/posts/mysql-architecture-overview-layers.svg)

MySQL은 크게 두 계층으로 나뉩니다.

### 서버 레이어

SQL 처리의 공통 로직을 담당합니다.

- **커넥션 매니저**: 클라이언트 연결을 수락하고 각 연결에 스레드를 할당합니다.
- **파서 / 전처리기**: SQL 문자열을 파싱하고 문법 오류를 검출합니다.
- **쿼리 옵티마이저**: 통계 정보를 기반으로 최적 실행 계획을 선택합니다.
- **실행 엔진**: 옵티마이저가 선택한 계획에 따라 Handler API를 통해 스토리지 엔진을 호출합니다.

### 스토리지 엔진 레이어

실제 데이터 저장·검색·트랜잭션을 담당합니다. 테이블마다 다른 스토리지 엔진을 지정할 수 있습니다.

```sql
-- 테이블 생성 시 엔진 지정
CREATE TABLE logs (
    id    BIGINT AUTO_INCREMENT PRIMARY KEY,
    msg   TEXT,
    ts    DATETIME
) ENGINE = Archive;   -- 압축 저장, INSERT/SELECT만 지원

CREATE TABLE sessions (
    token  CHAR(64) PRIMARY KEY,
    data   JSON,
    expires DATETIME
) ENGINE = Memory;    -- 재시작 시 데이터 사라짐, 빠름
```

## 스레드 모델

![MySQL 스레드 모델과 연결 처리](/assets/posts/mysql-architecture-overview-thread.svg)

PostgreSQL이 연결마다 **프로세스**를 생성하는 반면, MySQL은 연결마다 **스레드**를 할당합니다. 스레드는 프로세스보다 생성 비용이 낮고 메모리를 공유할 수 있습니다.

`thread_cache_size`를 설정하면 연결 종료 후에도 스레드를 캐시로 보존해 다음 연결 시 재사용합니다. 연결/해제가 빈번한 환경에서 효과적입니다.

## Handler API — 스토리지 엔진 추상화

옵티마이저와 스토리지 엔진 사이에는 **Handler API**가 있습니다. 실행 엔진은 `ha_read_first()`, `ha_write_row()` 같은 핸들러 함수를 호출하고, 스토리지 엔진이 이를 구현합니다.

이 구조 덕분에 서버 레이어는 스토리지 엔진의 내부를 알 필요가 없고, 새로운 스토리지 엔진을 플러그인으로 추가할 수 있습니다.

## 엔진별 특성 비교

| 엔진 | ACID | FK | Full-Text | 특징 |
|------|------|----|-----------|------|
| **InnoDB** | ✅ | ✅ | ✅ | 기본 엔진, 클러스터드 인덱스 |
| MyISAM | ❌ | ❌ | ✅ | 단순 읽기 전용, 레거시 |
| Memory | ❌ | ❌ | ❌ | 임시 테이블, 세션 데이터 |
| Archive | ❌ | ❌ | ❌ | INSERT/SELECT만, 압축 로그 저장 |
| NDB | ✅ | ✅ | ❌ | MySQL Cluster, 분산 |

## InnoDB가 기본 엔진이 된 이유

MySQL 5.5(2010년)부터 InnoDB가 기본 스토리지 엔진이 됐습니다. 이전까지는 MyISAM이 기본이었지만, MyISAM은 트랜잭션과 Foreign Key를 지원하지 않아 데이터 무결성 보장이 불가능했습니다.

InnoDB는 다음을 제공합니다.
- **ACID 트랜잭션**: 완전한 트랜잭션 지원
- **행 단위 잠금**: 동시성이 높은 환경에서 병목 최소화
- **MVCC**: 읽기 작업이 쓰기를 차단하지 않음
- **클러스터드 인덱스**: PRIMARY KEY 순서로 데이터 정렬 저장

```sql
-- 현재 엔진 확인
SELECT TABLE_NAME, ENGINE
FROM   information_schema.TABLES
WHERE  TABLE_SCHEMA = 'mydb';
```

## MySQL vs MariaDB

MySQL은 Oracle이 인수한 뒤 Community Edition과 Enterprise Edition으로 나뉩니다. MariaDB는 MySQL 창립자가 만든 포크로, MySQL과 호환성을 유지하면서 Aria 엔진, Galera Cluster 등 독자 기능을 추가했습니다. 대부분의 MySQL 쿼리는 MariaDB에서도 동작합니다.

---

**지난 글:** [PostgreSQL 슬로우 쿼리 진단 — pg_stat_statements와 EXPLAIN](/posts/pg-slow-query-diagnosis/)

**다음 글:** [MySQL 스토리지 엔진 — InnoDB·MyISAM·Memory](/posts/mysql-storage-engines/)

<br>
읽어주셔서 감사합니다. 😊
