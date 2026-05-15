---
title: "Checkpointer와 BGWriter — 더티 페이지 플러시"
description: "PostgreSQL Checkpointer와 BGWriter 프로세스의 역할 분담, 체크포인트 I/O 폭풍 발생 원인과 checkpoint_completion_target으로 분산하는 방법, pg_stat_bgwriter로 성능을 진단하는 실무 쿼리를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["postgresql", "checkpointer", "bgwriter", "checkpoint", "dirty-page", "io-storm", "checkpoint-completion-target", "pg-stat-bgwriter", "max-wal-size", "buffer-flush"]
featured: false
draft: false
---

[지난 글](/posts/pg-wal-mechanism/)에서 WAL이 영속성을 보장하는 원리를 살펴봤다. 이번에는 WAL과 짝을 이루는 두 프로세스 — **Checkpointer**와 **BGWriter** — 가 Dirty Page를 어떻게 관리하는지 다룬다.

## 더티 페이지 문제

PostgreSQL이 데이터를 수정하면 Shared Buffers의 페이지가 **Dirty(더티)**가 된다. 이 더티 페이지는 언젠가 디스크에 기록되어야 한다. 문제는 "언제, 어떻게 쓰느냐"다.

모든 변경을 즉시 디스크에 쓰면 I/O가 폭발한다. 아무것도 안 쓰면 충돌 시 복구에 너무 많은 WAL이 필요하다. 이 균형을 잡는 것이 Checkpointer와 BGWriter의 역할이다.

## BGWriter — 선행 플러시로 Free Buffer 확보

**BGWriter**는 `bgwriter_delay`(기본 200ms) 주기로 깨어나 Shared Buffers에서 **LRU에서 오래된 Dirty Page** 최대 `bgwriter_lru_maxpages`(기본 100)개를 디스크에 기록하고 다시 잠든다.

목적은 체크포인트와 무관하게 **미리 Free Buffer를 확보**하는 것이다. Backend가 새 페이지를 올리려 할 때 빈 슬롯이 없으면 스스로 Dirty Page를 써야 한다(Backend I/O). BGWriter가 이 작업을 대신하면 Backend가 I/O로 블로킹되지 않는다.

![Checkpointer & BGWriter — 더티 페이지 플러시](/assets/posts/pg-checkpoint-bgwriter-flow.svg)

```ini
# postgresql.conf
bgwriter_delay          = 200ms   # 실행 주기
bgwriter_lru_maxpages   = 100     # 회차당 최대 기록 페이지
bgwriter_lru_multiplier = 2.0     # 예상 수요의 N배 확보
bgwriter_flush_after    = 512kB   # OS fsync 강제 주기 (I/O 평탄화)
```

## Checkpointer — 일관성 보장점 생성

**Checkpointer**는 주기적으로(또는 WAL이 `max_wal_size`에 도달하면) **체크포인트**를 실행한다. 체크포인트는 다음 두 가지를 보장한다.

1. 그 시점의 **모든 Dirty Page를 디스크에 기록**
2. WAL에 체크포인트 레코드 삽입

체크포인트 완료 후에는 그 이전의 WAL 세그먼트가 복구에 불필요하므로 정리된다. 즉, **체크포인트는 Crash Recovery 시작점을 앞당겨 복구 시간을 줄이는 역할**을 한다.

```sql
-- 수동 체크포인트 실행 (정상 종료 전, 벌크 로드 후 활용)
CHECKPOINT;

-- 체크포인트 간격 확인
SHOW checkpoint_timeout;   -- 기본 5분
SHOW max_wal_size;         -- 기본 1GB
```

## I/O 폭풍 문제와 checkpoint_completion_target

체크포인트가 시작되면 짧은 시간 안에 수백 MB의 더티 페이지를 디스크에 써야 한다. 이 **I/O 폭풍(I/O Storm)**이 발생하면 일반 쿼리 응답 시간이 급격히 증가한다.

**`checkpoint_completion_target`**은 이를 완화한다. 기본값 0.5는 체크포인트 간격의 50% 안에 모든 기록을 끝내라는 의미다. 0.9로 올리면 체크포인트 간격의 90%에 걸쳐 I/O를 분산한다.

```ini
# 권장 설정 (쓰기 많은 OLTP)
checkpoint_timeout           = 15min   # 기본 5분보다 길게
max_wal_size                 = 4GB     # 기본 1GB보다 크게
checkpoint_completion_target = 0.9     # I/O 분산 (기본 0.5)
```

`checkpoint_timeout`과 `max_wal_size` 둘 중 먼저 도달하는 조건이 체크포인트를 트리거한다.

![Checkpoint · BGWriter 모니터링 SQL](/assets/posts/pg-checkpoint-bgwriter-sql.svg)

## pg_stat_bgwriter로 성능 진단

```sql
SELECT checkpoints_timed,    -- 타임아웃 기반 체크포인트 수
       checkpoints_req,      -- WAL 크기 초과로 강제된 체크포인트 수
       buffers_checkpoint,   -- 체크포인트가 기록한 버퍼 수
       buffers_clean,        -- BGWriter가 기록한 버퍼 수
       maxwritten_clean,     -- BGWriter 한계(bgwriter_lru_maxpages) 도달 횟수
       buffers_backend,      -- Backend가 직접 기록한 버퍼 수 (나쁜 신호)
       buffers_alloc         -- 새로 할당된 버퍼 수
FROM   pg_stat_bgwriter;
```

**진단 기준:**

| 지표 | 문제 상황 | 조치 |
|---|---|---|
| `checkpoints_req` 다수 | WAL 너무 빠름 | `max_wal_size` 증가 |
| `buffers_backend` 많음 | BGWriter 부족 | `bgwriter_lru_maxpages` 증가 |
| `maxwritten_clean` 많음 | BGWriter 한계 도달 | `bgwriter_lru_maxpages` 증가 |

```sql
-- 통계 리셋 (벤치마크 전)
SELECT pg_stat_reset_shared('bgwriter');

-- 체크포인트 비율 (req가 총합의 10% 초과면 문제)
SELECT checkpoints_req::float
       / NULLIF(checkpoints_timed + checkpoints_req, 0) * 100
       AS forced_pct
FROM   pg_stat_bgwriter;
```

## 정리

Checkpointer와 BGWriter는 역할이 다르다. BGWriter는 **평상시 Free Buffer 확보**를 위해 선행 플러시하고, Checkpointer는 **일관성 보장점**을 만들어 복구 범위를 제한한다. 두 프로세스를 잘 튜닝하면 I/O 폭풍을 완화하고 Backend 응답 시간을 안정적으로 유지할 수 있다.

---

**지난 글:** [PostgreSQL WAL 메커니즘](/posts/pg-wal-mechanism/)

<br>
읽어주셔서 감사합니다. 😊
