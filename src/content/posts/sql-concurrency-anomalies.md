---
title: "동시성 이상 현상"
description: "Dirty Read, Non-Repeatable Read, Phantom Read, Lost Update, Write Skew 각 이상 현상의 원인, 구체적 시나리오, 격리 수준별 방지 여부, 실무 해결 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["sql", "concurrency", "dirty-read", "non-repeatable-read", "phantom-read", "lost-update", "write-skew", "transaction", "isolation"]
featured: false
draft: false
---

[지난 글](/posts/sql-isolation-levels-standard/)에서 격리 수준 4단계를 살펴봤다. 각 수준이 "무엇을 방지하는가"를 이해하려면 **이상 현상(Anomaly)**을 구체적으로 알아야 한다. 이번 글에서는 Dirty Read·Non-Repeatable Read·Phantom Read·Lost Update·Write Skew 각각의 원인과 해결책을 정리한다.

---

## Dirty Read

**커밋되지 않은(롤백될 수도 있는) 데이터를 읽는 현상**이다.

![동시성 이상 현상 타임라인](/assets/posts/sql-concurrency-anomalies-timeline.svg)

```sql
-- READ UNCOMMITTED에서 발생
-- T1: 잔액 900으로 변경 (아직 미커밋)
-- T2: READ UNCOMMITTED로 잔액 조회 → 900 읽음
-- T1: ROLLBACK → 실제 잔액은 1000이었음
-- T2는 존재하지 않는 값(900)을 사용
```

READ COMMITTED 이상의 격리 수준에서는 방지된다. 실무에서 READ UNCOMMITTED를 쓰는 경우는 드물다.

---

## Non-Repeatable Read

**한 트랜잭션 내에서 같은 행을 두 번 읽었는데 값이 달라지는 현상**이다. 다른 트랜잭션이 사이에 해당 행을 수정하고 커밋했기 때문이다.

```sql
-- REPEATABLE READ 미만에서 발생
BEGIN;
SELECT price FROM products WHERE id = 1;  -- 100
-- 다른 트랜잭션이 price를 120으로 UPDATE + COMMIT
SELECT price FROM products WHERE id = 1;  -- 120 (달라짐!)
COMMIT;
-- 같은 트랜잭션 내에서 계산 결과가 일관성 없어질 수 있음
```

REPEATABLE READ 이상의 격리 수준에서 방지된다. 단일 행의 수정(UPDATE/DELETE)으로 발생하며, 행 집합의 변화(Phantom)와는 구분된다.

---

## Phantom Read

**한 트랜잭션 내에서 같은 조건의 쿼리를 두 번 실행했는데 행의 집합이 달라지는 현상**이다. 다른 트랜잭션이 INSERT 또는 DELETE를 커밋했기 때문이다.

```sql
-- REPEATABLE READ에서도 발생 가능 (이론상)
BEGIN;
SELECT COUNT(*) FROM orders WHERE amount > 100;  -- 5
-- 다른 트랜잭션이 amount=200인 행 INSERT + COMMIT
SELECT COUNT(*) FROM orders WHERE amount > 100;  -- 6 (유령 행 등장)
COMMIT;
```

SERIALIZABLE에서만 완전히 방지된다. MySQL InnoDB의 REPEATABLE READ는 MVCC + Gap Lock으로 팬텀을 대부분 방지하지만, 잠금 읽기(`SELECT ... FOR UPDATE`)에서는 여전히 주의가 필요하다.

---

## Lost Update (갱신 손실)

**두 트랜잭션이 같은 데이터를 읽고 각각 수정했을 때, 나중에 커밋된 쪽이 먼저 커밋된 변경을 덮어쓰는 현상**이다.

![Lost Update와 Write Skew 코드](/assets/posts/sql-concurrency-anomalies-code.svg)

```sql
-- 해결 1: 원자적 UPDATE (읽기-수정-쓰기를 DB에 위임)
UPDATE counter SET value = value + 1 WHERE id = 1;

-- 해결 2: SELECT ... FOR UPDATE (비관적 잠금)
BEGIN;
SELECT value FROM counter WHERE id = 1 FOR UPDATE;
-- 이 시점에 다른 트랜잭션은 같은 행 잠금 대기
UPDATE counter SET value = value + 1 WHERE id = 1;
COMMIT;

-- 해결 3: 낙관적 잠금 (버전 컬럼 비교)
UPDATE counter SET value = 101, version = version + 1
WHERE id = 1 AND version = 5;
-- 영향 행 수가 0이면 다른 트랜잭션이 먼저 수정한 것 → 재시도
```

---

## Write Skew (쓰기 왜곡)

**두 트랜잭션이 각자 조건을 확인하고 서로 다른 데이터를 수정했는데, 합쳐서 보면 불변 조건(invariant)을 위반하는 현상**이다.

```sql
-- 시나리오: 당직 의사 최소 1명 유지
-- T1, T2 모두 동시에 당직 의사 2명 확인
-- T1은 의사A를 퇴근 처리, T2는 의사B를 퇴근 처리
-- 결과: 당직 의사 0명 (조건 위반)

-- 해결: SERIALIZABLE 격리 수준
SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;
BEGIN;
SELECT COUNT(*) FROM on_duty WHERE active = true;
-- SERIALIZABLE이면 이 범위에 잠금 → T2는 대기
IF count > 1 THEN
    UPDATE on_duty SET active = false WHERE doctor_id = ?;
END IF;
COMMIT;

-- 또는: SELECT ... FOR UPDATE로 관련 행 모두 잠금
SELECT * FROM on_duty WHERE active = true FOR UPDATE;
```

Write Skew는 읽은 것과 쓰는 것이 **다른 행**이므로 REPEATABLE READ로는 방지할 수 없다. SERIALIZABLE 또는 명시적 잠금이 필요하다.

---

## 이상 현상 방지 요약

| 이상 현상 | RC | RR | Serializable | 추가 대책 |
|---------|----|----|-------------|---------|
| Dirty Read | ✓ | ✓ | ✓ | — |
| Non-Repeatable Read | ✗ | ✓ | ✓ | — |
| Phantom Read | ✗ | △ | ✓ | Gap Lock |
| Lost Update | ✗ | △ | ✓ | 원자적 UPDATE / 낙관적 잠금 |
| Write Skew | ✗ | ✗ | ✓ | SELECT FOR UPDATE |

(RC = READ COMMITTED, RR = REPEATABLE READ, △ = 일부 방지)

---

**지난 글:** [트랜잭션 격리 수준 표준](/posts/sql-isolation-levels-standard/)

**다음 글:** [2PL과 MVCC 이론](/posts/sql-2pl-mvcc-theory/)

<br>
읽어주셔서 감사합니다. 😊
