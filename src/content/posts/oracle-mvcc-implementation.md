---
title: "Oracle MVCC 구현"
description: "Oracle이 Undo 세그먼트와 SCN을 활용해 MVCC(Multi-Version Concurrency Control)를 구현하는 내부 메커니즘을 상세히 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 4
type: "knowledge"
category: "SQL"
tags: ["oracle", "mvcc", "undo", "scn", "cr-block", "itl", "concurrency", "consistent-read", "snapshot-too-old"]
featured: false
draft: false
---

[지난 글](/posts/oracle-scn-read-consistency/)에서 SCN이 읽기 일관성을 보장하는 원리를 개념적으로 살펴봤다. 이번에는 Oracle이 MVCC를 실제로 구현하는 내부 구조, 즉 ITL·Undo·CR 블록이 어떻게 협력하는지 깊게 파고든다.

## MVCC란 무엇인가

**MVCC(Multi-Version Concurrency Control)**는 데이터의 여러 버전을 유지해 읽기와 쓰기가 서로를 차단하지 않게 하는 동시성 제어 방식이다.

Oracle의 MVCC 구현 핵심 원칙:
- **읽기는 쓰기를 차단하지 않는다** (SELECT가 UPDATE를 막지 않음)
- **쓰기는 읽기를 차단하지 않는다** (UPDATE가 SELECT를 막지 않음)
- 데이터 파일에는 항상 **최신 버전(Current Block)**만 보관
- 과거 버전은 **Undo 세그먼트**에서 재구성

---

## 블록 내부 구조: ITL

Oracle의 모든 데이터 블록 헤더에는 **ITL(Interest Transaction List)**이 있다. ITL은 해당 블록을 수정한 활성 트랜잭션 목록이다. 각 엔트리는 다음을 포함한다.

| 필드 | 내용 |
|------|------|
| TXN ID | 트랜잭션 식별자 |
| UBA | Undo Block Address (Undo 위치) |
| FLAG | 커밋 여부 (C: committed, L: locked) |
| SCN | 커밋 SCN |
| LCK | 잠긴 행 수 |

ITL 슬롯이 부족하면 다른 세션이 블록에 접근할 때 **ITL Waits**가 발생한다. `INITRANS`를 높이면 ITL 슬롯을 늘릴 수 있다.

```sql
-- ITL Wait 통계
SELECT name, value
FROM   v$sysstat
WHERE  name IN ('transaction tables consistent reads',
                'transaction tables consistent read rollbacks',
                'data blocks consistent reads');
```

---

## CR 블록 생성 절차

![Oracle MVCC 동작 구조](/assets/posts/oracle-mvcc-implementation-arch.svg)

세션 B(쿼리 SCN=1050)가 블록(현재 SCN=1080)을 읽는 순서:

1. **Current Block 복제**: Buffer Cache에서 현재 블록을 메모리에 복사
2. **ITL 검사**: 블록 SCN(1080) > 쿼리 SCN(1050)이므로 Undo 필요
3. **UBA 추적**: ITL 엔트리의 UBA(Undo Block Address)로 Undo 세그먼트 접근
4. **Undo 역방향 적용**: Before Image를 CR 블록에 적용해 SCN 1050 시점 복원
5. **CR 블록 반환**: 세션 B는 복원된 CR 블록에서 데이터 읽기

---

## Undo 체인(Undo Chain)

한 블록이 여러 트랜잭션에 의해 반복 수정됐다면 Undo는 **체인**으로 연결된다. CR 블록 생성 시 쿼리 SCN에 도달할 때까지 체인을 거슬러 올라간다.

```sql
-- Undo 세그먼트 사용 현황
SELECT usn, writes, gets, waits, shrinks, wraps
FROM   v$rollstat
ORDER  BY writes DESC;

-- 세션별 Undo 블록 조회
SELECT s.sid, s.username, t.used_ublk AS undo_blocks
FROM   v$session s
JOIN   v$transaction t ON s.taddr = t.addr
ORDER  BY used_ublk DESC;
```

---

## consistent gets와 성능

CR 블록 생성은 CPU와 메모리 소비를 수반한다. `consistent gets`는 이 비용의 지표다.

```sql
-- 쿼리별 consistent gets 분석
SELECT sql_id, sql_text,
       consistent_gets,
       db_block_gets,
       rows_processed
FROM   v$sqlstats
WHERE  consistent_gets > 100000
ORDER  BY consistent_gets DESC
FETCH FIRST 20 ROWS ONLY;
```

![MVCC 관련 딕셔너리 조회](/assets/posts/oracle-mvcc-implementation-code.svg)

`consistent gets`가 과도하게 많은 SQL은 인덱스 누락이나 파티션 프루닝 미적용의 신호일 수 있다.

---

## ORA-01555: Snapshot Too Old

Undo 세그먼트는 무한하지 않다. `UNDO_RETENTION` 초과 후 해당 Undo가 다른 트랜잭션에 재사용되면, 아직 그 Undo를 필요로 하는 CR 블록 생성이 실패한다.

```sql
-- ORA-01555 발생 빈도 확인
SELECT name, value
FROM   v$sysstat
WHERE  name = 'snapshot too old';

-- UNDO 테이블스페이스 보장 설정
ALTER TABLESPACE undo RETENTION GUARANTEE;

-- UNDO_RETENTION 조정
ALTER SYSTEM SET undo_retention = 3600 SCOPE=BOTH;
```

`RETENTION GUARANTEE`를 설정하면 UNDO_RETENTION 내 Undo는 절대 재사용되지 않는다. 단, UNDO 테이블스페이스가 꽉 차면 새 트랜잭션이 실패할 수 있으므로 용량을 충분히 확보해야 한다.

---

## Oracle MVCC vs PostgreSQL MVCC

| 비교 항목 | Oracle | PostgreSQL |
|-----------|--------|-----------|
| 구버전 저장 위치 | 별도 Undo 테이블스페이스 | 테이블 본체 (Dead Tuple) |
| 구버전 정리 | 자동 (Undo 재사용) | VACUUM 필요 |
| 읽기 오버헤드 | consistent gets (CR 블록 생성) | Dead Tuple 증가 → 블로트 |
| ORA-01555 유사 오류 | Snapshot Too Old | 없음 (단, 테이블 블로트) |

---

**지난 글:** [Oracle SCN과 읽기 일관성](/posts/oracle-scn-read-consistency/)

**다음 글:** [Oracle 격리 수준: Read Committed와 Serializable](/posts/oracle-isolation-rc-serializable/)

<br>
읽어주셔서 감사합니다. 😊
