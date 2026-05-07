---
title: "Oracle SCN과 읽기 일관성"
description: "SCN(System Change Number)의 구조와 증가 방식, Oracle이 이를 사용해 문장 수준·트랜잭션 수준 읽기 일관성을 보장하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["oracle", "scn", "read-consistency", "cr-block", "undo", "mvcc", "snapshot", "consistent-read"]
featured: false
draft: false
---

[지난 글](/posts/oracle-redo-undo-flashback/)에서 Redo와 Undo가 각각 내구성과 원자성을 담당한다고 설명했다. 그런데 Oracle은 **잠금 없이 SELECT가 일관된 결과를 반환**하는 것으로 유명하다. 이 마법의 열쇠가 SCN(System Change Number)이다.

## SCN이란 무엇인가

**SCN(System Change Number)**은 Oracle 데이터베이스에서 모든 커밋에 단조 증가 번호를 부여하는 글로벌 타임스탬프다. 정수 카운터로, 커밋이 발생할 때마다 단조적으로 증가한다.

SCN이 저장되는 위치:
- Control 파일 헤더
- 데이터 파일 헤더(체크포인트 SCN)
- 온라인 Redo Log(커밋 SCN)
- **각 데이터 블록 헤더**(해당 블록을 마지막으로 변경한 커밋 SCN)
- Undo 세그먼트(트랜잭션 SCN)

```sql
-- 현재 SCN 조회
SELECT current_scn,
       scn_to_timestamp(current_scn) AS current_time
FROM   v$database;

-- 타임스탬프 ↔ SCN 변환
SELECT timestamp_to_scn(SYSTIMESTAMP - INTERVAL '1' HOUR) AS scn_1h_ago
FROM   dual;
```

---

## 문장 수준 읽기 일관성 (Statement-Level Consistency)

Oracle의 기본 격리 수준은 **Read Committed**다. 이 수준에서 각 문장은 **문장이 시작된 시점의 SCN**을 기준으로 일관된 데이터를 읽는다.

![SCN 증가와 읽기 일관성 동작](/assets/posts/oracle-scn-read-consistency-scn.svg)

동작 원리:
1. 세션 B가 SELECT를 시작할 때 **쿼리 SCN = 1050**이 고정된다.
2. 세션 A가 UPDATE를 COMMIT하면 **SCN = 1080**이 부여된다.
3. 세션 B가 해당 블록을 읽을 때 블록 SCN(1080) > 쿼리 SCN(1050)임을 확인한다.
4. Undo를 역방향으로 적용해 SCN 1050 시점의 **CR(Consistent Read) 블록**을 생성한다.
5. 세션 B는 CR 블록에서 데이터를 읽는다 — 세션 A의 변경은 보이지 않는다.

---

## CR 블록(Consistent Read Block)

CR 블록은 디스크 파일의 현재 버전(Current Block)을 복제해 Undo를 역방향으로 적용한 메모리 상의 임시 블록이다. Buffer Cache에 생성되며, 쿼리가 완료되면 재사용 가능 상태가 된다.

```sql
-- CR 블록 생성 통계 확인
SELECT name, value
FROM   v$sysstat
WHERE  name IN ('consistent gets',
                'consistent gets from cache',
                'CR blocks created');
```

CR 블록 생성 비용이 높으면 `consistent gets`가 증가하고, 극단적으로 Undo가 이미 재사용되면 `ORA-01555`가 발생한다.

---

## 트랜잭션 수준 읽기 일관성 (Transaction-Level Consistency)

`SET TRANSACTION READ ONLY` 또는 `SERIALIZABLE`을 설정하면 트랜잭션 전체가 **트랜잭션 시작 시점의 SCN**을 기준으로 읽기를 수행한다.

```sql
-- 트랜잭션 시작 시 SCN 고정
SET TRANSACTION READ ONLY;

-- 이후 모든 SELECT는 동일 SCN 기준
SELECT COUNT(*) FROM orders;
SELECT SUM(amount) FROM orders;

COMMIT; -- READ ONLY 트랜잭션 종료
```

이를 통해 여러 쿼리가 동일 시점 기준으로 일관된 집계를 수행할 수 있다. 보고서 생성 시 유용하다.

---

## ORA_ROWSCN: 행 수준 SCN

`ORA_ROWSCN` 의사컬럼은 해당 행이 속한 블록의 최종 변경 SCN을 반환한다. Optimistic Locking 구현에 활용할 수 있다.

```sql
-- 행 SCN 기반 낙관적 잠금 예시
DECLARE
    v_scn    NUMBER;
    v_amount NUMBER;
BEGIN
    SELECT amount, ora_rowscn
    INTO   v_amount, v_scn
    FROM   orders
    WHERE  order_id = 1001;

    -- ... 비즈니스 로직 ...

    UPDATE orders
    SET    amount = v_amount * 1.1
    WHERE  order_id = 1001
    AND    ora_rowscn = v_scn; -- 변경 감지

    IF SQL%ROWCOUNT = 0 THEN
        RAISE_APPLICATION_ERROR(-20001, '동시 수정 감지');
    END IF;
END;
/
```

![SCN 조회 및 Flashback SCN 활용](/assets/posts/oracle-scn-read-consistency-sql.svg)

---

## SCN과 분산 환경

RAC(Real Application Clusters)나 Database Link를 사용하는 분산 환경에서는 **글로벌 SCN 동기화**가 필요하다. Oracle은 SCN Headroom이라는 메커니즘으로 분산 인스턴스 간 SCN 일관성을 유지한다. SCN이 최대값(6바이트 정수 상한)에 가까워지면 데이터베이스가 시작되지 않을 수 있으므로 주기적으로 모니터링해야 한다.

```sql
-- SCN 상태 확인
SELECT current_scn,
       (POWER(2, 48) - current_scn) AS scn_headroom
FROM   v$database;
```

---

## 정리

| 개념 | 설명 |
|------|------|
| SCN | 커밋마다 단조 증가하는 글로벌 타임스탬프 |
| 쿼리 SCN | SELECT 시작 시 고정, 문장 수준 일관성 기준 |
| CR 블록 | Undo 역적용으로 생성한 읽기 전용 버전 블록 |
| ORA-01555 | Undo 재사용으로 CR 블록 생성 불가 |
| SET TRANSACTION READ ONLY | 트랜잭션 수준 일관성 SCN 고정 |

---

**지난 글:** [Oracle Redo·Undo·플래시백](/posts/oracle-redo-undo-flashback/)

**다음 글:** [Oracle MVCC 구현](/posts/oracle-mvcc-implementation/)

<br>
읽어주셔서 감사합니다. 😊
