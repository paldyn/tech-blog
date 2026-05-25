---
title: "Altibase 인메모리 데이터베이스 아키텍처"
description: "국산 인메모리 DBMS Altibase의 메모리 테이블스페이스, 디스크 테이블스페이스, WAL, 체크포인트 구조를 디스크 기반 RDBMS와 비교하며 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["Altibase", "인메모리DB", "IMDB", "국산DB", "메모리테이블", "HDB"]
featured: false
draft: false
---

[지난 글](/posts/tibero-tbadmin-tbcm/)에서 Tibero의 관리 도구를 살펴봤다. 이번에는 또 다른 국산 RDBMS인 **Altibase**를 다룬다. Altibase는 순수 인메모리 방식과 디스크 방식을 하나의 엔진에서 동시에 지원하는 독특한 **하이브리드 데이터베이스**다. 금융권 실시간 거래 처리, 통신사 CDR(Call Data Record) 처리, 주식 거래 시스템 등 마이크로초 수준의 응답 시간이 요구되는 영역에서 강점을 보인다.

## 인메모리 데이터베이스의 등장 배경

전통적인 디스크 기반 RDBMS는 데이터를 디스크에 저장하고, 자주 읽는 데이터만 메모리 버퍼에 캐싱한다. 문제는 **캐시 미스가 발생하면 디스크 I/O 지연(수 밀리초~수십 밀리초)** 을 피할 수 없다는 점이다. 초당 수만~수십만 건의 트랜잭션이 일어나는 환경에서 이 지연은 치명적이다.

인메모리 DB는 모든 데이터를 RAM에 상주시켜 디스크 I/O를 원천 제거한다. 단 RAM은 휘발성이므로, 장애 시 데이터를 복구하기 위한 **WAL(Write-Ahead Log)과 체크포인트** 메커니즘이 필수다.

## Altibase 아키텍처 개요

![Altibase 인메모리 데이터베이스 아키텍처](/assets/posts/altibase-memory-architecture.svg)

Altibase의 핵심은 **메모리 테이블스페이스(Memory Tablespace)** 와 **디스크 테이블스페이스(Disk Tablespace)** 를 단일 SQL 엔진 아래 통합한 것이다.

### 메모리 테이블스페이스

메모리 테이블은 데이터 전체가 RAM에 상주한다. 디스크 I/O가 없으므로 **마이크로초(μs) 단위의 응답 시간**이 가능하다.

- **행 표현**: 포인터 체인(linked list)으로 행을 연결해 삽입/삭제 시 이동 없이 포인터만 업데이트
- **T-Index**: 메모리 내 B-Tree 인덱스. 노드 분할/병합도 RAM에서만 이루어짐
- **동시성**: MVCC 기반. 읽기 일관성을 위해 구버전을 메모리에 유지

```sql
-- 메모리 테이블 생성
CREATE TABLE trade_tick (
    tick_id     BIGINT      NOT NULL,
    stock_code  CHAR(6)     NOT NULL,
    price       INTEGER     NOT NULL,
    volume      INTEGER     NOT NULL,
    tick_time   TIMESTAMP   NOT NULL
) TABLESPACE SYS_MEM_TBS;  -- 메모리 테이블스페이스 지정

-- 인덱스도 메모리 내 B-Tree
CREATE INDEX idx_tick_code ON trade_tick(stock_code, tick_time);
```

### 디스크 테이블스페이스

대용량 데이터는 디스크 테이블스페이스에 저장한다. 표준 RDBMS와 동일하게 버퍼 풀을 통해 I/O를 최소화한다.

```sql
-- 디스크 테이블 생성 (이력 데이터 등 대용량)
CREATE TABLE trade_history (
    trade_id    BIGINT      NOT NULL,
    stock_code  CHAR(6)     NOT NULL,
    trade_date  DATE        NOT NULL,
    open_price  INTEGER,
    close_price INTEGER,
    volume      BIGINT
) TABLESPACE SYS_DISK_TBS;  -- 디스크 테이블스페이스 지정

-- 메모리 테이블과 디스크 테이블을 하나의 SQL로 조인
SELECT t.stock_code,
       t.price,
       h.close_price AS prev_close
FROM   trade_tick    t           -- 메모리 테이블
JOIN   trade_history h           -- 디스크 테이블
  ON   t.stock_code = h.stock_code
 AND   h.trade_date = TRUNC(SYSDATE) - 1
WHERE  t.tick_time >= SYSDATE - 1/24;  -- 최근 1시간
```

## 성능 비교

![인메모리 DB vs 디스크 기반 DB 성능 특성](/assets/posts/altibase-perf-comparison.svg)

메모리 테이블은 **디스크 I/O 제로**이므로 응답 시간이 수 마이크로초 수준이지만, 데이터 용량이 RAM 크기로 제한된다. 디스크 테이블은 TB 이상의 데이터를 저장할 수 있지만 캐시 미스 시 수 밀리초 지연이 발생한다.

Altibase의 하이브리드 구조는 두 장점을 결합한다. 실시간 처리가 필요한 hot 데이터는 메모리 테이블에, 이력/분석 데이터는 디스크 테이블에 배치하는 **티어링(tiering)** 전략이다.

## 내구성: WAL과 체크포인트

메모리는 전원이 꺼지면 사라진다. Altibase는 두 가지 메커니즘으로 내구성을 보장한다.

**WAL (Write-Ahead Log)**: 메모리 테이블에 변경이 발생하면 먼저 Redo Log를 디스크에 기록하고, 그 후 메모리를 변경한다. 장애 시 로그를 재적용해 복구한다.

**체크포인트(Checkpoint)**: 주기적으로 메모리 전체 상태(스냅샷)를 체크포인트 파일에 저장한다. 재시작 시 체크포인트 파일 로드 + 이후 Redo Log 재적용으로 빠르게 복구된다.

```sql
-- 체크포인트 수동 실행
ALTER SYSTEM CHECKPOINT;

-- Redo 로그 파일 확인
SELECT logfile_no, logfile_status, logfile_size
FROM   v$logfile
ORDER  BY logfile_no;
```

## 주요 활용 영역

| 영역 | 사용 이유 |
|---|---|
| 증권 체결 시스템 | μs 수준 응답, 초당 수만 건 체결 |
| 통신 CDR 처리 | 초당 수만 건 기록, 실시간 과금 |
| 게임 랭킹/세션 | 메모리 속도 + SQL 편의성 |
| 실시간 위치 추적 | 빈번한 UPDATE, 낮은 지연 필수 |

Altibase는 SQL 표준을 준수하므로 응용 코드의 SQL은 대부분 변경 없이 동작한다. 다만 **테이블스페이스 지정, 메모리 크기 산정, 체크포인트 주기 튜닝**이 디스크 기반 RDBMS와 다른 핵심 운영 포인트다.

---

**지난 글:** [Tibero 관리 도구 — tbAdmin과 tbcm](/posts/tibero-tbadmin-tbcm/)

**다음 글:** [Altibase 하이브리드 메모리-디스크 구조](/posts/altibase-hybrid-memory-disk/)

<br>
읽어주셔서 감사합니다. 😊
