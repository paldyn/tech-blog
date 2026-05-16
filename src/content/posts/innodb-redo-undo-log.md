---
title: "InnoDB Redo Log와 Undo Log — 복구와 MVCC의 두 기둥"
description: "InnoDB가 충돌 복구(Durability)와 MVCC(동시성)를 구현하는 두 가지 로그 메커니즘인 Redo Log와 Undo Log의 구조, 역할, 내구성 파라미터, 그리고 장시간 트랜잭션의 위험성을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 15
type: "knowledge"
category: "SQL"
tags: ["mysql", "innodb", "redo-log", "undo-log", "mvcc", "충돌복구", "WAL"]
featured: false
draft: false
---

[지난 글](/posts/innodb-buffer-pool-lru/)에서 InnoDB Buffer Pool이 Midpoint LRU로 핫 페이지를 보호하는 방법을 살펴봤습니다. Buffer Pool은 메모리입니다. 서버가 갑자기 꺼지면 메모리의 데이터는 사라집니다. 이것을 막는 것이 **Redo Log**이고, 동시에 여러 트랜잭션이 서로를 방해하지 않고 읽을 수 있게 하는 것이 **Undo Log**입니다. 두 로그는 함께 InnoDB의 ACID를 완성합니다.

## Redo Log — 충돌 후 복구를 보장한다

Redo Log는 WAL(Write-Ahead Logging) 패턴의 구현입니다. 데이터를 Buffer Pool에 수정하기 전에, 변경 내용을 먼저 Redo Log 파일에 기록합니다. 커밋 시에는 Redo Log를 디스크에 fsync한 뒤 "커밋 성공"을 클라이언트에게 알립니다. 이후 Buffer Pool의 Dirty Page는 백그라운드에서 천천히 디스크에 씁니다.

서버가 중간에 죽으면, 재시작 시 Redo Log를 읽어 Buffer Pool에 반영되지 않은 변경을 재실행(Roll Forward)합니다.

```sql
-- Redo Log 크기 설정 (MySQL 8.0.30+)
SET GLOBAL innodb_redo_log_capacity = 8589934592; -- 8GB

-- 내구성 vs 성능 트레이드오프
-- 1: 커밋마다 fsync (완전한 ACID, 기본값)
-- 2: 커밋마다 OS 버퍼까지만 (OS 크래시 시 최대 1초 손실)
-- 0: 1초마다 flush (MySQL 크래시 시에도 손실 가능)
SET GLOBAL innodb_flush_log_at_trx_commit = 1;

-- LSN(Log Sequence Number) 확인
SHOW ENGINE INNODB STATUS\G
-- Log sequence number: 1234567
-- Log flushed up to:   1234500
-- Pages flushed up to: 1234000
-- Last checkpoint at:  1233000
```

Redo Log는 고정 크기의 **순환 버퍼**입니다. LSN이 증가하면서 공간을 채우고, Checkpoint가 이동하면 오래된 공간을 재사용합니다. Redo Log가 너무 작으면 Checkpoint가 자주 발생해 쓰기 부하가 증가합니다. 대용량 OLTP 환경에서는 4~8GB 이상을 권장합니다.

## Undo Log — ROLLBACK과 MVCC의 기반

Undo Log는 변경 전(Before Image)의 값을 저장합니다. 두 가지 용도가 있습니다.

1. **ROLLBACK**: 트랜잭션을 취소할 때 Undo Log를 따라 이전 상태로 되돌립니다.
2. **MVCC**: 다른 트랜잭션이 이전 버전의 스냅샷을 읽을 수 있게 합니다(잠금 없는 읽기).

![Redo Log와 Undo Log — 역할 비교](/assets/posts/innodb-redo-undo-log-structure.svg)

### MVCC와 버전 체인

```sql
-- 예: accounts 테이블
-- id=1, balance=1000

-- 트랜잭션 A 시작 (ReadView 생성)
START TRANSACTION;

-- 트랜잭션 B: balance를 800으로 변경 (커밋)
-- Undo Log: "id=1, 이전 balance=1000" 저장
-- 현재 행: balance=800

-- 트랜잭션 A의 SELECT: ReadView에 따라 Undo Log를 참조
SELECT balance FROM accounts WHERE id = 1;
-- 결과: 1000 (B가 커밋됐어도 A의 ReadView 기준 이전 버전)

COMMIT;
```

각 행에는 `DB_TRX_ID`(마지막 수정 트랜잭션 ID)와 `DB_ROLL_PTR`(Undo Log 포인터)이 숨겨진 컬럼으로 존재합니다. Undo Log는 체인 형태로 연결되어, 각 버전이 이전 버전을 가리킵니다. ReadView는 이 체인을 따라가며 자신이 보아야 할 버전을 결정합니다.

## 충돌 복구 흐름

![충돌 복구 흐름 — Redo → Undo 순서](/assets/posts/innodb-redo-undo-log-recovery.svg)

InnoDB의 충돌 복구는 두 단계입니다.

1. **Roll Forward (Redo)**: Checkpoint 이후의 모든 Redo 레코드를 재실행합니다. 커밋된 트랜잭션의 변경을 모두 반영합니다.
2. **Roll Back (Undo)**: 커밋되지 않은 트랜잭션을 Undo Log로 되돌립니다.

이 두 단계를 거치면 데이터베이스는 마지막으로 커밋된 상태로 복구됩니다.

## 장시간 트랜잭션의 위험

```sql
-- 장시간 트랜잭션 찾기
SELECT trx_id, trx_started, trx_state,
       TIMESTAMPDIFF(SECOND, trx_started, NOW()) AS duration_sec,
       trx_query
FROM   information_schema.INNODB_TRX
WHERE  TIMESTAMPDIFF(SECOND, trx_started, NOW()) > 60
ORDER  BY duration_sec DESC;
```

장시간 열린 트랜잭션은 두 가지 문제를 일으킵니다.

- **Undo Log 누적**: 다른 트랜잭션이 이 ReadView보다 오래된 버전을 필요로 하지 않게 될 때까지 Undo Log를 삭제할 수 없습니다. Undo Tablespace가 비정상적으로 커집니다.
- **Purge 지연**: MySQL의 백그라운드 Purge 스레드가 오래된 Undo를 삭제합니다. 장시간 트랜잭션이 있으면 Purge를 진행할 수 없어 Undo 공간이 계속 늘어납니다.

```sql
-- Undo 히스토리 길이 확인 (클수록 위험)
SHOW ENGINE INNODB STATUS\G
-- History list length: 숫자 → 1000 초과 시 주의

-- Purge 지연의 최대 허용 길이
SHOW VARIABLES LIKE 'innodb_max_purge_lag';
```

애플리케이션에서 트랜잭션을 짧고 빠르게 유지하는 것이 InnoDB Undo 관리의 핵심입니다.

---

**지난 글:** [InnoDB Buffer Pool과 LRU — Midpoint Insertion 전략](/posts/innodb-buffer-pool-lru/)

**다음 글:** [InnoDB Doublewrite Buffer — 부분 쓰기 문제를 막는 방법](/posts/innodb-doublewrite-buffer/)

<br>
읽어주셔서 감사합니다. 😊
