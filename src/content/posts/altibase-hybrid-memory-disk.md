---
title: "Altibase 하이브리드 구조 — 메모리와 디스크 데이터 티어링"
description: "Altibase의 메모리-디스크 하이브리드 아키텍처에서 데이터 티어링 전략, MVCC 읽기 일관성, 메모리 크기 산정, 체크포인트 튜닝을 실전 SQL과 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 7
type: "knowledge"
category: "SQL"
tags: ["Altibase", "HybridDB", "티어링", "MVCC", "체크포인트", "메모리DB"]
featured: false
draft: false
---

[지난 글](/posts/altibase-in-memory-architecture/)에서 Altibase의 기본 아키텍처를 살펴봤다. 이번에는 Altibase 하이브리드 구조의 핵심인 **데이터 티어링 전략**, **MVCC**, **메모리 크기 산정과 체크포인트 튜닝**을 실전 관점에서 깊이 다룬다.

## 데이터 티어링 전략

Altibase 하이브리드 DB의 핵심 설계 결정은 **어떤 테이블을 메모리에, 어떤 테이블을 디스크에 배치할 것인가**다.

![Altibase 하이브리드 데이터 티어링 전략](/assets/posts/altibase-hybrid-tiering.svg)

**메모리 티어에 배치해야 하는 데이터**:
- 마이크로초 응답이 필요한 실시간 처리 데이터
- 빈번히 UPDATE되는 세션·상태 정보
- 크기가 RAM에 수용 가능한 hot 데이터

**디스크 티어에 배치해야 하는 데이터**:
- TB 규모의 이력 데이터
- 배치 분석이나 리포트 용도 데이터
- 접근 빈도가 낮은 cold 데이터

```sql
-- 메모리 → 디스크 티어로 데이터 주기적 이전 (Aging)
-- 예: 오래된 체결 데이터를 메모리에서 디스크 이력 테이블로 이전

BEGIN
    -- 디스크 테이블로 오래된 데이터 복사
    INSERT INTO trade_history (
        tick_id, stock_code, price, volume, tick_time
    )
    SELECT tick_id, stock_code, price, volume, tick_time
    FROM   trade_tick
    WHERE  tick_time < SYSDATE - 1;  -- 1일 이상 된 데이터

    -- 메모리 테이블에서 삭제
    DELETE FROM trade_tick
    WHERE  tick_time < SYSDATE - 1;

    COMMIT;
END;
/
-- 이 작업을 tb_job 또는 외부 스케줄러로 주기적 실행
```

## MVCC — 메모리 테이블의 읽기 일관성

![Altibase 메모리 테이블 MVCC](/assets/posts/altibase-mvcc.svg)

Altibase 메모리 테이블은 **MVCC(Multi-Version Concurrency Control)** 로 읽기 일관성을 보장한다. 행이 업데이트되면 구버전을 버전 체인에 유지하고, 새 트랜잭션은 자신의 SCN(System Change Number)에 맞는 버전을 읽는다.

```sql
-- MVCC 동작 확인: 격리 수준 조회
SELECT TX_ISOLATION_LEVEL FROM V$SESSION WHERE ID = SESSION_ID();

-- 읽기 일관성 테스트
-- Session A:
BEGIN;
-- 이 시점에서 price = 1000

-- Session B (별도 세션):
UPDATE products SET price = 1200 WHERE product_id = 1;
COMMIT;

-- Session A에서 계속 조회:
SELECT price FROM products WHERE product_id = 1;
-- Altibase RC(Read Committed): 1200 반환 (B의 커밋 반영)
-- Altibase Serializable: 1000 반환 (트랜잭션 시작 시점 버전)
```

메모리 테이블의 MVCC는 구버전 행을 메모리에 보관하므로, 장기 트랜잭션이 많으면 메모리 사용량이 증가한다. **구버전 정리(Version Garbage Collection)** 가 주기적으로 실행돼 불필요한 구버전을 제거한다.

## 메모리 크기 산정

메모리 테이블스페이스 크기 산정은 Altibase 운영의 핵심이다.

```sql
-- 현재 메모리 사용량 확인
SELECT mem_alloc_page_count * 32 / 1024 AS used_mb,
       mem_free_page_count  * 32 / 1024 AS free_mb,
       (mem_alloc_page_count + mem_free_page_count) * 32 / 1024 AS total_mb
FROM   v$memtbl_info;

-- 테이블별 메모리 사용량
SELECT table_name,
       ROUND(mem_used_size / 1024 / 1024, 1) AS used_mb,
       record_count
FROM   v$memtbl_info
ORDER  BY mem_used_size DESC;
```

**산정 공식**:
```text
필요 메모리 = 최대 레코드 수 × 행 크기 × 안전계수(1.5)
             + MVCC 구버전 보관 여유분 (통상 20%)
             + 인덱스 크기
             + 운영 여유분 (20%)
```

`MEM_DB_DIR` 파라미터로 메모리 DB 체크포인트 파일 경로를 지정하고, `MEM_MAX_DB_SIZE`로 최대 크기를 제한한다.

## 체크포인트 튜닝

체크포인트는 메모리 DB 상태를 디스크에 저장하는 작업이다. 너무 자주 하면 I/O 부하가 커지고, 너무 드물면 장애 복구 시간이 길어진다.

```sql
-- 체크포인트 관련 파라미터 확인
SELECT name, value
FROM   v$property
WHERE  name IN ('CHECKPOINT_INTERVAL_IN_LOG',
                'CHECKPOINT_INTERVAL_IN_SEC',
                'MEM_DB_DIR');

-- 수동 체크포인트
ALTER SYSTEM CHECKPOINT;

-- 체크포인트 진행 상황 모니터링
SELECT checkpoint_state, checkpoint_begin_lsn, checkpoint_end_lsn
FROM   v$checkpoint;
```

**핵심 파라미터**:

| 파라미터 | 기본값 | 설명 |
|---|---|---|
| CHECKPOINT_INTERVAL_IN_LOG | 100 | 로그 파일 N개마다 체크포인트 |
| CHECKPOINT_INTERVAL_IN_SEC | 600 | N초마다 체크포인트 |
| MEM_DB_DIR | 설정값 | 체크포인트 파일 저장 경로 |

## 성능 모니터링

```sql
-- 메모리 테이블 잠금 대기 확인
SELECT t.table_name,
       s.id AS session_id,
       s.tx_id,
       s.wait_time
FROM   v$lock_wait w
JOIN   v$session   s ON w.session_id = s.id
JOIN   system_.sys_tables_ t ON w.table_oid = t.table_oid
WHERE  w.wait_time > 0;

-- 가장 많은 메모리를 쓰는 Top 10 쿼리
SELECT sql_text,
       execute_count,
       ROUND(avg_execute_time / 1000, 2) AS avg_ms,
       memory_used
FROM   v$sqltext
ORDER  BY memory_used DESC
FETCH  FIRST 10 ROWS ONLY;
```

## 하이브리드 조인 성능 고려사항

메모리 테이블과 디스크 테이블을 조인할 때 옵티마이저는 메모리 테이블을 드라이빙 측으로 선호한다. 디스크 테이블 접근 비용이 훨씬 크기 때문이다.

```sql
-- 좋은 패턴: 메모리 테이블을 드라이버로
SELECT /*+ LEADING(t) USE_NL(h) */
       t.stock_code,
       t.price AS current_price,
       h.close_price AS prev_close
FROM   trade_tick    t   -- 메모리 (드라이버)
JOIN   trade_history h   -- 디스크 (inner)
  ON   t.stock_code = h.stock_code
 AND   h.trade_date = TRUNC(SYSDATE) - 1
WHERE  t.tick_time >= SYSDATE - 1/1440;  -- 최근 1분

-- 나쁜 패턴: 대용량 디스크 테이블 풀스캔 후 메모리 테이블 조인
-- → EXPLAIN PLAN으로 조인 순서 확인 후 힌트로 조정
```

Altibase 하이브리드 DB의 성능을 최대화하려면 "어떤 데이터가 지금 가장 뜨겁게 접근되는가"를 파악해 적절한 티어에 배치하고, 체크포인트 주기와 메모리 크기를 운영 부하에 맞게 튜닝해야 한다.

---

**지난 글:** [Altibase 인메모리 데이터베이스 아키텍처](/posts/altibase-in-memory-architecture/)

**다음 글:** [CUBRID 아키텍처와 특징](/posts/cubrid-architecture/)

<br>
읽어주셔서 감사합니다. 😊
