---
title: "Oracle Redo·Undo·플래시백"
description: "Oracle의 Redo Log(내구성), Undo 세그먼트(롤백·읽기 일관성), 플래시백(조회 및 복구) 메커니즘을 체계적으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 2
type: "knowledge"
category: "SQL"
tags: ["oracle", "redo", "undo", "flashback", "wal", "durability", "atomicity", "rollback", "read-consistency", "lgwr"]
featured: false
draft: false
---

[지난 글](/posts/oracle-storage-tablespace-segment/)에서 Oracle 스토리지 계층 구조를 살펴봤다. 그 구조 위에서 트랜잭션 내구성과 롤백을 실현하는 핵심 장치가 **Redo**와 **Undo**다. 여기에 더해 과거 시점 데이터를 조회하거나 복구하는 **Flashback** 기능까지 함께 정리한다.

## Redo와 Undo의 역할 분리

Oracle은 트랜잭션의 ACID 중 두 가지를 Redo/Undo로 분담한다.

- **Redo**: 내구성(Durability) — 커밋된 변경은 반드시 살아남아야 한다
- **Undo**: 원자성(Atomicity) + 읽기 일관성 — 롤백과 과거 이미지 제공

![Redo vs Undo 역할 비교](/assets/posts/oracle-redo-undo-flashback-flow.svg)

---

## Redo: 변경 후 이미지(After Image)

모든 DML 변경은 **Redo Log Buffer**에 변경 후 이미지(After Image)로 기록된다. 트랜잭션이 COMMIT되면 LGWR(Log Writer)가 이를 **온라인 Redo Log 파일**에 동기적으로 기록하고 그 이후에야 성공 응답을 반환한다. 이것이 WAL(Write-Ahead Logging) 원칙이다.

```sql
-- Redo 기록 효율 확인
SELECT name, value
FROM   v$sysstat
WHERE  name IN ('redo writes',
                'redo write time',
                'redo size');
```

온라인 Redo Log는 순환 구조로 관리된다. ARCHIVELOG 모드에서는 로그 스위치 시 ARCn 프로세스가 로그를 보관본으로 복사해 PITR(Point-In-Time Recovery)을 가능하게 한다.

---

## Undo: 변경 전 이미지(Before Image)

DML이 실행되면 변경 전 값(Before Image)이 **Undo 세그먼트**에 기록된다. Undo 세그먼트는 UNDO 테이블스페이스에 위치한다.

Undo의 두 가지 용도:

1. **ROLLBACK 또는 비정상 종료**: Undo 데이터를 적용해 변경 이전 상태로 복구
2. **읽기 일관성**: 다른 세션이 커밋되지 않은 변경을 읽지 않도록 CR(Consistent Read) 블록 생성

```sql
-- Undo 파라미터 확인
SELECT name, value
FROM   v$parameter
WHERE  name IN ('undo_tablespace',
                'undo_retention',
                'undo_management');

-- Undo 세그먼트 상태 확인
SELECT usn, status, rssize / 1048576 AS size_mb
FROM   v$rollstat
ORDER  BY rssize DESC;
```

---

## Undo Retention과 ORA-01555

`UNDO_RETENTION` 파라미터(기본 900초)는 커밋 후에도 Undo 데이터를 최소 몇 초간 보존할지를 지정한다. 이 값보다 오래된 Undo는 다른 트랜잭션이 재사용할 수 있다.

Undo가 재사용된 후 오래된 Undo를 필요로 하는 쿼리가 실행되면 `ORA-01555: snapshot too old` 오류가 발생한다. 이를 방지하려면 `UNDO_RETENTION`을 늘리거나, UNDO 테이블스페이스 크기를 충분히 확보하고 `RETENTION GUARANTEE`를 설정한다.

```sql
-- UNDO 사용량 기반 권장 RETENTION 계산
SELECT d.undo_block_per_sec * t.block_size * d.maxquerylen / 1048576 AS recommended_mb
FROM   v$undostat d, dba_tablespaces t
WHERE  t.tablespace_name = 'UNDO'
AND    rownum = 1;
```

---

## Flashback 기능

Oracle Flashback은 Undo 데이터(또는 Flashback Log)를 활용해 과거 시점 데이터에 접근하거나 복구하는 기능이다.

![Flashback 기능 유형과 SQL](/assets/posts/oracle-redo-undo-flashback-query.svg)

### Flashback Query

`AS OF TIMESTAMP` 또는 `AS OF SCN` 절로 특정 시점의 데이터를 조회한다. SELECT만 가능하며 실제 테이블을 변경하지 않는다.

```sql
-- 1시간 전 데이터 조회
SELECT order_id, status, amount
FROM   orders
AS OF  TIMESTAMP (SYSTIMESTAMP - INTERVAL '1' HOUR)
WHERE  customer_id = 100;
```

### Flashback Table

테이블 전체를 과거 시점으로 되돌린다. `ROW MOVEMENT`가 활성화되어 있어야 한다.

```sql
ALTER TABLE orders ENABLE ROW MOVEMENT;

FLASHBACK TABLE orders
TO TIMESTAMP (SYSTIMESTAMP - INTERVAL '30' MINUTE);
```

### Flashback Drop

`DROP TABLE` 후 Recycle Bin에서 복구한다.

```sql
-- Recycle Bin 조회
SELECT object_name, original_name, droptime
FROM   user_recyclebin;

-- 복구
FLASHBACK TABLE orders TO BEFORE DROP;
```

### Flashback Database

데이터베이스 전체를 과거 시점으로 복구한다. Undo가 아닌 **Flashback Database Log**를 사용하므로 별도 활성화가 필요하다.

```sql
-- Flashback Database 활성화 (재시작 필요)
ALTER SYSTEM SET db_flashback_retention_target = 1440; -- 24시간
-- MOUNT 상태에서:
ALTER DATABASE FLASHBACK ON;

-- 복구
FLASHBACK DATABASE TO TIMESTAMP (SYSTIMESTAMP - INTERVAL '2' HOUR);
```

---

## 정리: 무엇이 무엇을 쓰는가

| 기능 | 의존 데이터 | 한계 |
|------|-----------|------|
| ROLLBACK | Undo | 트랜잭션 종료 전까지 |
| 읽기 일관성(CR) | Undo | UNDO_RETENTION 내 |
| Flashback Query/Table | Undo | UNDO_RETENTION 내 |
| Flashback Database | Flashback Log | Retention Target 내 |
| Instance Recovery | Redo | 로그 보존 범위 내 |
| Media Recovery | Archived Redo | 보관본 보존 범위 내 |

---

**지난 글:** [Oracle 스토리지 구조: 테이블스페이스·세그먼트·익스텐트·블록](/posts/oracle-storage-tablespace-segment/)

**다음 글:** [Oracle SCN과 읽기 일관성](/posts/oracle-scn-read-consistency/)

<br>
읽어주셔서 감사합니다. 😊
