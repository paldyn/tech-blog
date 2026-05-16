---
title: "InnoDB Buffer Pool과 LRU — Midpoint Insertion 전략"
description: "InnoDB의 핵심 메모리 구조인 Buffer Pool이 Midpoint LRU 알고리즘으로 페이지를 관리하는 방법, 풀 테이블 스캔으로부터 핫 페이지를 보호하는 원리, 핵심 파라미터와 모니터링 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 14
type: "knowledge"
category: "SQL"
tags: ["mysql", "innodb", "buffer-pool", "lru", "캐시", "성능튜닝"]
featured: false
draft: false
---

[지난 글](/posts/innodb-disk-layout/)에서 InnoDB가 디스크에 데이터를 저장하는 계층 구조를 살펴봤습니다. 디스크는 느립니다. InnoDB의 성능 대부분은 **Buffer Pool**이라는 메모리 캐시에서 결정됩니다. Buffer Pool은 단순한 LRU가 아니라, 풀 테이블 스캔과 같은 일회성 대량 읽기로부터 자주 쓰는 페이지를 보호하는 **Midpoint Insertion** 전략을 사용합니다.

## Buffer Pool의 역할

Buffer Pool은 `innodb_buffer_pool_size`만큼의 메모리 공간으로, InnoDB가 읽어들인 16KB 페이지를 캐싱합니다.

- 데이터 페이지 조회 → Buffer Pool에 있으면 디스크 I/O 없이 반환
- 없으면(Cache Miss) 디스크에서 읽어 Buffer Pool에 적재
- 데이터 수정 → Buffer Pool의 페이지를 먼저 수정(Dirty Page 생성)
- 백그라운드 스레드(Page Cleaner)가 주기적으로 Dirty Page를 디스크에 플러시

**적중률(Hit Ratio)** = `1 - (disk_reads / total_logical_reads)`. 이 값이 0.99 이상이어야 좋은 성능을 기대할 수 있습니다.

## Midpoint LRU 알고리즘

전통적인 LRU(Least Recently Used)는 가장 최근에 읽은 페이지를 Head에, 오래된 페이지를 Tail에 두고, 페이지가 필요할 때 Tail을 제거합니다.

문제는 풀 테이블 스캔입니다. `SELECT * FROM large_table` 같은 쿼리는 수만 개의 페이지를 순서대로 읽습니다. 단순 LRU라면 이 일회성 페이지들이 Head를 차지하며 평소 자주 쓰던 핫 페이지를 모두 밀어냅니다.

InnoDB는 **Midpoint Insertion** 전략으로 이를 방지합니다.

![InnoDB Buffer Pool — Midpoint LRU 구조](/assets/posts/innodb-buffer-pool-lru-structure.svg)

Buffer Pool 리스트를 두 부분으로 나눕니다.

- **New Sublist (Young)**: 전체의 5/8. 자주 접근하는 핫 페이지가 위치합니다.
- **Old Sublist**: 전체의 3/8(`innodb_old_blocks_pct=37`). 새로 읽어온 페이지가 여기에 먼저 삽입됩니다.

새 페이지를 읽으면 New Sublist의 Head가 아닌, **Old Sublist의 Head(= Midpoint)** 에 삽입합니다. Old에서 `innodb_old_blocks_time`(기본 1000ms = 1초) 이상 경과 후에 다시 접근되면 비로소 New Sublist의 Head로 승격됩니다.

풀 테이블 스캔의 페이지는 한 번씩만 읽히고 다시 접근되지 않으므로, Old Sublist의 Tail로 밀려나 제거됩니다. 핫 페이지는 보호됩니다.

## 핵심 파라미터

```sql
-- Buffer Pool 크기 (총 RAM의 50~70% 권장)
SET GLOBAL innodb_buffer_pool_size = 8589934592; -- 8GB

-- 인스턴스 수 (8GB 이상이면 8 권장 — Mutex 분산)
SET GLOBAL innodb_buffer_pool_instances = 8;

-- Old Sublist 비율 (기본 37%)
SET GLOBAL innodb_old_blocks_pct = 37;

-- Old Sublist 체류 최소 시간 (ms, 기본 1000)
SET GLOBAL innodb_old_blocks_time = 1000;

-- 서버 시작 시 워밍업 데이터 덤프/로드
SET GLOBAL innodb_buffer_pool_dump_at_shutdown = ON;
SET GLOBAL innodb_buffer_pool_load_at_startup  = ON;
```

`innodb_buffer_pool_instances`를 늘리면 Buffer Pool이 여러 독립 인스턴스로 분할됩니다. 각 인스턴스는 자체 Mutex를 가지므로 동시 접근 시 경합이 줄어듭니다. 페이지는 `page_id % num_instances`로 인스턴스에 배분됩니다.

## 모니터링

![Buffer Pool 모니터링 — 핵심 지표](/assets/posts/innodb-buffer-pool-lru-tuning.svg)

```sql
-- Buffer Pool 상세 상태
SHOW STATUS LIKE 'Innodb_buffer_pool%';

-- 기본 진단 스크립트
SELECT
  ROUND(bp_size / 1024 / 1024 / 1024, 1)  AS pool_gb,
  ROUND(pages_data * 16 / 1024, 0)         AS data_mb,
  ROUND(pages_dirty * 16 / 1024, 0)        AS dirty_mb,
  ROUND(pages_free * 16 / 1024, 0)         AS free_mb,
  ROUND(1 - reads / read_requests, 4)      AS hit_ratio
FROM (
  SELECT
    @@innodb_buffer_pool_size                          AS bp_size,
    (SELECT variable_value FROM information_schema.GLOBAL_STATUS
     WHERE variable_name = 'Innodb_buffer_pool_pages_data')  + 0 AS pages_data,
    (SELECT variable_value FROM information_schema.GLOBAL_STATUS
     WHERE variable_name = 'Innodb_buffer_pool_pages_dirty') + 0 AS pages_dirty,
    (SELECT variable_value FROM information_schema.GLOBAL_STATUS
     WHERE variable_name = 'Innodb_buffer_pool_pages_free')  + 0 AS pages_free,
    (SELECT variable_value FROM information_schema.GLOBAL_STATUS
     WHERE variable_name = 'Innodb_buffer_pool_reads')       + 0 AS reads,
    (SELECT variable_value FROM information_schema.GLOBAL_STATUS
     WHERE variable_name = 'Innodb_buffer_pool_read_requests') + 0 AS read_requests
) t;
```

| 지표 | 설명 | 이상 신호 |
|------|------|----------|
| `hit_ratio` | Buffer Pool 적중률 | 0.99 미만 |
| `pages_dirty` | 디스크에 아직 안 쓴 Dirty Page 수 | 과다하면 플러시 부하 |
| `pool_wait_free` | 빈 페이지가 없어서 대기한 횟수 | 0 이상이면 Buffer Pool 부족 |
| `read_ahead_evicted` | Read-ahead로 읽었다가 쓰이지 않고 제거된 페이지 | 크면 read-ahead 설정 확인 |

## 워밍업(Warmup)

서버를 재시작하면 Buffer Pool이 비어있어 초반에 적중률이 급락합니다. `innodb_buffer_pool_dump_at_shutdown = ON`으로 종료 시 Page 목록을 `.ini` 파일에 저장하고, 시작 시 자동으로 읽어들여 빠르게 워밍업할 수 있습니다.

```sql
-- 현재 Buffer Pool 즉시 덤프
SET GLOBAL innodb_buffer_pool_dump_now = ON;

-- 덤프 로드 진행 상황
SHOW STATUS LIKE 'Innodb_buffer_pool_load_status';
```

---

**지난 글:** [InnoDB 디스크 레이아웃 — 테이블스페이스, 세그먼트, 익스텐트, 페이지](/posts/innodb-disk-layout/)

**다음 글:** [InnoDB Redo Log와 Undo Log — 복구와 MVCC의 두 기둥](/posts/innodb-redo-undo-log/)

<br>
읽어주셔서 감사합니다. 😊
