---
title: "PostgreSQL WAL 메커니즘"
description: "PostgreSQL WAL(Write-Ahead Log)의 영속성 보장 원리, WAL Buffer에서 pg_wal 디스크까지의 쓰기 흐름, LSN(Log Sequence Number) 구조, synchronous_commit 옵션, WAL을 활용한 PITR 기반 백업·복구 방법을 상세히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 9
type: "knowledge"
category: "SQL"
tags: ["postgresql", "wal", "write-ahead-log", "lsn", "synchronous-commit", "crash-recovery", "pitr", "wal-level", "archive-mode", "replication"]
featured: false
draft: false
---

[지난 글](/posts/pg-storage-heap-toast/)에서 PostgreSQL의 Heap 파일 구조와 TOAST를 살펴봤다. 이번에는 데이터 영속성의 핵심인 **WAL(Write-Ahead Log)** 메커니즘을 다룬다.

## WAL이란

WAL은 "데이터 파일보다 로그를 먼저 써라"는 원칙이다. 트랜잭션이 커밋될 때 **데이터 페이지(Dirty Page)를 디스크에 즉시 쓰지 않아도** 되는 대신, **변경 내용을 기술하는 WAL 레코드를 반드시 먼저 디스크에 기록(fsync)**한다.

덕분에 데이터베이스가 갑자기 충돌하더라도, 재기동 시 WAL 레코드를 재적용(Redo)해 일관성을 복구할 수 있다. 이것이 ACID의 **D(Durability)**를 보장하는 핵심 메커니즘이다.

## WAL 쓰기 흐름

![PostgreSQL WAL 쓰기 흐름](/assets/posts/pg-wal-flow.svg)

1. `UPDATE/INSERT` 실행 → Shared Buffers에 Dirty Page 생성, WAL Buffer에 WAL 레코드 추가
2. `COMMIT` 명령 → WAL Buffer의 레코드를 `pg_wal/` 디렉토리에 **fsync()**
3. COMMIT 응답을 클라이언트에 반환
4. Dirty Page는 나중에 BGWriter / Checkpointer가 비동기로 디스크에 기록

WAL Writer 프로세스는 `wal_writer_delay`(기본 200ms) 주기로 WAL Buffer를 파일에 flush하여 COMMIT 시 fsync 부담을 분산한다.

## LSN — Log Sequence Number

WAL 레코드는 64비트 단조 증가 포인터인 **LSN(Log Sequence Number)**으로 식별된다. `0/1A000028` 형태로 표시되며, 앞 32비트가 세그먼트 번호, 뒤 32비트가 세그먼트 내 오프셋이다.

```sql
-- 현재 WAL LSN 확인
SELECT pg_current_wal_lsn();

-- LSN을 WAL 파일명으로 변환
SELECT pg_walfile_name(pg_current_wal_lsn());
-- 결과: 000000010000000100000002 (timeline + segment 번호)

-- 두 LSN 사이의 바이트 차이 (WAL 생성량)
SELECT pg_wal_lsn_diff('0/2000000', '0/1000000');  -- 16MB
```

## WAL 세그먼트 파일

`pg_wal/` 디렉토리에는 WAL 레코드가 기본 **16MB** 단위 파일로 저장된다. 파일이 가득 차면 새 세그먼트를 만들고, 체크포인트 이후 더 이상 필요 없는 파일은 재사용(recycled)된다.

```ini
# postgresql.conf
wal_segment_size = 16MB          # 기본값 (컴파일 시 결정)
min_wal_size     = 80MB          # 최소 보유 WAL 크기
max_wal_size     = 1GB           # 체크포인트 간격 상한 (I/O 폭풍 방지)
```

## wal_level — WAL 기록 수준

```ini
wal_level = minimal    # 충돌 복구만 지원
wal_level = replica    # 스트리밍 복제 지원 (기본값)
wal_level = logical    # 논리 복제, 디코딩 지원
```

`logical` 레벨이 WAL 크기가 가장 크지만, 논리 복제나 `pg_logical` 기반 CDC(Change Data Capture)를 사용하려면 반드시 필요하다.

## synchronous_commit — 내구성 vs 성능 트레이드오프

`synchronous_commit`은 클라이언트에 COMMIT 응답을 언제 보낼지 결정한다.

| 설정 | 동작 | 성능 | 위험 |
|---|---|---|---|
| `on` (기본) | WAL fsync 후 응답 | 낮음 | 데이터 손실 없음 |
| `remote_write` | 스탠바이 수신(OS 버퍼) 후 응답 | 중간 | 스탠바이 crash 시 손실 가능 |
| `remote_apply` | 스탠바이 Replay 완료 후 응답 | 낮음 | 읽기 일관성 최강 |
| `local` | 로컬 WAL fsync 후 응답 | 중간 | 스탠바이 손실 가능 |
| `off` | WAL 기록 전 응답 | 높음 | **충돌 시 마지막 트랜잭션 손실** |

```sql
-- 세션 단위로 성능 우선 트랜잭션
SET synchronous_commit = off;
INSERT INTO event_log ... ;  -- 손실 허용
COMMIT;
RESET synchronous_commit;
```

## PITR — 특정 시점 복구

WAL을 아카이브에 보관하면 **base backup + WAL 아카이브**로 임의의 시점으로 복구할 수 있다.

```ini
# 아카이브 설정 (postgresql.conf)
archive_mode    = on
archive_command = 'cp %p /archive/%f'
```

```bash
# Base Backup 생성
pg_basebackup -D /backup/base -Fp -Xs -P

# recovery.conf (또는 postgresql.conf 14c+)에서 복구 목표 설정
restore_command = 'cp /archive/%f %p'
recovery_target_time = '2026-05-11 12:00:00'
```

![WAL 설정 & 모니터링 SQL](/assets/posts/pg-wal-config-sql.svg)

## WAL 관련 주요 통계

```sql
-- 체크포인트 통계 (WAL 부하 측정)
SELECT checkpoints_timed, checkpoints_req,
       buffers_checkpoint, buffers_clean,
       maxwritten_clean
FROM   pg_stat_bgwriter;

-- 스트리밍 복제 지연 모니터링
SELECT client_addr, state,
       write_lag, flush_lag, replay_lag
FROM   pg_stat_replication;
```

`checkpoints_req`이 `checkpoints_timed`보다 훨씬 많으면 WAL이 너무 빠르게 생성되는 것이므로 `max_wal_size`를 늘리거나 쓰기 패턴을 최적화해야 한다.

## 정리

WAL은 PostgreSQL 영속성의 근간이다. COMMIT 시 WAL fsync → 나중에 Dirty Page flush라는 두 단계가 성능과 안전성을 모두 확보하는 핵심 패턴이다. `synchronous_commit = off`는 성능을 높이지만 데이터 손실 위험이 있으므로, 중요 데이터에는 기본값(`on`)을 유지해야 한다.

---

**지난 글:** [PostgreSQL 스토리지 — Heap과 TOAST](/posts/pg-storage-heap-toast/)

**다음 글:** [Checkpointer와 BGWriter — 더티 페이지 플러시](/posts/pg-checkpointer-bgwriter/)

<br>
읽어주셔서 감사합니다. 😊
