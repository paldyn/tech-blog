---
title: "Oracle 백그라운드 프로세스"
description: "Oracle 인스턴스를 구성하는 핵심 백그라운드 프로세스(DBWR, LGWR, CKPT, SMON, PMON, ARCn)의 역할, COMMIT 시 WAL 흐름, 인스턴스 복구 메커니즘을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["oracle", "background-process", "dbwr", "lgwr", "ckpt", "smon", "pmon", "wal", "instance-recovery", "commit"]
featured: false
draft: false
---

[지난 글](/posts/oracle-memory-sga-pga-uga/)에서 SGA·PGA 메모리 구조를 살펴봤다. Oracle 인스턴스는 메모리뿐 아니라 여러 **백그라운드 프로세스**가 함께 동작해야 완성된다. 이 프로세스들은 눈에 보이지 않지만 데이터의 영속성·일관성·복구 가능성을 실질적으로 책임진다.

---

## 핵심 백그라운드 프로세스 지도

![Oracle 핵심 백그라운드 프로세스](/assets/posts/oracle-background-processes-map.svg)

```sql
-- 실행 중인 백그라운드 프로세스 조회
SELECT name, description
FROM v$bgprocess
WHERE paddr != '00'
ORDER BY name;
```

---

## DBWR (Database Writer)

**Buffer Cache의 Dirty 버퍼(변경됐지만 디스크에 아직 쓰지 않은 블록)**를 데이터 파일에 기록한다.

DBWR가 쓰기를 수행하는 시점:
- 체크포인트(CKPT) 신호를 받을 때
- Buffer Cache에서 Dirty 버퍼가 LRU 교체 대상이 될 때
- Timeout(3초)

```sql
-- DBWR 통계
SELECT name, value
FROM v$sysstat
WHERE name LIKE '%physical write%';
```

DBWR는 **COMMIT과 동기화되지 않는다.** 즉, COMMIT을 해도 데이터 파일에 즉시 기록될 필요가 없다. 크래시가 발생해도 Redo Log로 복구할 수 있기 때문이다.

---

## LGWR (Log Writer)

**Redo Log Buffer의 내용을 온라인 Redo Log 파일**에 순차적으로 기록한다. COMMIT 처리의 핵심이다.

LGWR가 쓰기를 수행하는 시점:
- 트랜잭션이 **COMMIT**될 때 (가장 중요)
- 3초마다 타임아웃
- Redo Log Buffer가 1/3 이상 찼을 때
- DBWR 요청 시 (DBWR보다 먼저 쓰기)

```sql
-- Redo 쓰기 통계
SELECT name, value
FROM v$sysstat
WHERE name IN ('redo writes', 'redo write time');
```

---

## COMMIT 흐름과 WAL

LGWR와 COMMIT의 관계가 Oracle 내구성의 핵심이다.

![COMMIT 시 백그라운드 프로세스 흐름](/assets/posts/oracle-background-processes-commit.svg)

**Write-Ahead Logging(WAL) 원칙**: Redo Log 기록이 COMMIT 응답보다 먼저 완료되어야 한다. 데이터 파일 기록(DBWR)은 나중에 비동기로 처리된다. 이 구조 덕분에:

1. COMMIT이 빠르다 (순차 Redo 쓰기 한 번)
2. 크래시 후 복구 가능 (Redo로 Roll Forward)

---

## CKPT (Checkpoint)

**체크포인트**는 Buffer Cache의 Dirty 버퍼를 데이터 파일에 모두 기록하고, SCN(System Change Number)을 Control 파일과 데이터 파일 헤더에 기록하는 작업이다.

CKPT 프로세스가 직접 데이터를 쓰지는 않는다. DBWR에게 신호를 보내고, SCN을 갱신하는 역할이다.

```sql
-- 체크포인트 시간 확인
SELECT checkpoint_change#, checkpoint_time
FROM v$datafile_header
WHERE rownum <= 3;
```

체크포인트가 자주 발생하면 복구 시간(MTTR)은 줄지만 I/O가 증가한다. `fast_start_mttr_target`으로 목표 복구 시간을 설정하면 Oracle이 자동으로 체크포인트 주기를 조정한다.

---

## SMON (System Monitor)

SMON은 인스턴스 관리자 역할이다.

- **인스턴스 복구**: 비정상 종료 후 재기동 시 Roll Forward + Roll Back 수행
- **Temp 세그먼트 정리**: 비정상 종료 세션의 임시 세그먼트 정리
- **Dictionary 캐시 복구**: 딕셔너리 캐시 일관성 유지

```sql
-- 인스턴스 복구 상태 확인
SELECT recovery_estimated_ios, actual_redo_blks
FROM v$instance_recovery;
```

---

## PMON (Process Monitor)

비정상 종료된 **서버 프로세스를 감시**하고 자원을 정리한다.

- 비정상 종료 세션의 트랜잭션 롤백
- 획득한 락·핀 해제
- PGA 해제
- 리스너에 인스턴스 재등록

PMON이 없으면 죽은 프로세스가 차지한 락이 영원히 해제되지 않는다.

---

## ARCn (Archiver)

ARCHIVELOG 모드에서 온라인 Redo Log가 전환(switch)될 때마다 로그 파일을 **아카이브 디렉터리**로 복사한다.

```sql
-- ARCHIVELOG 모드 확인
SELECT log_mode FROM v$database;

-- 아카이브 로그 목록
SELECT sequence#, name, applied
FROM v$archived_log
ORDER BY sequence# DESC
FETCH FIRST 10 ROWS ONLY;
```

ARCn이 없으면 Redo Log가 덮어씌워져 PITR(Point-In-Time Recovery)이 불가능해진다.

---

## 프로세스 장애 대응 요약

| 프로세스 | 장애 증상 | 대응 |
|----------|----------|------|
| LGWR 중단 | 모든 COMMIT 블록 | 인스턴스 재시작 |
| DBWR 중단 | Buffer Cache 소진 → 신규 세션 불가 | 인스턴스 재시작 |
| PMON 중단 | 죽은 세션 자원 미해제 | 인스턴스 재시작 |
| ARCn 중단 | Redo Log 꽉 참 → DB 중단 | 아카이브 경로 확인·공간 확보 |

---

**지난 글:** [Oracle 메모리 구조 (SGA·PGA·UGA)](/posts/oracle-memory-sga-pga-uga/)

<br>
읽어주셔서 감사합니다. 😊
