---
title: "MySQL Gap Lock · Next-Key Lock — 팬텀 읽기 방지 메커니즘"
description: "InnoDB가 REPEATABLE READ에서 팬텀 읽기를 막기 위해 사용하는 Gap Lock, Next-Key Lock, Insert Intention Lock의 구조와 범위, 데드락 시나리오까지 상세히 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 21
type: "knowledge"
category: "SQL"
tags: ["mysql", "innodb", "gap-lock", "next-key-lock", "phantom-read", "deadlock", "repeatable-read"]
featured: false
draft: false
---

[지난 글](/posts/mysql-isolation-rr-default/)에서 InnoDB의 REPEATABLE READ 격리 수준이 MVCC와 잠금을 결합해 동작한다고 설명했습니다. 이번 글에서는 그 잠금의 핵심인 **Gap Lock**과 **Next-Key Lock** 구조를 깊이 살펴봅니다.

## 왜 팬텀 읽기가 발생하는가

같은 트랜잭션 안에서 같은 범위 쿼리를 두 번 실행했을 때, 다른 트랜잭션이 그 사이에 행을 삽입하면 결과가 달라집니다. 이 현상을 팬텀 읽기(Phantom Read)라 부릅니다.

MVCC만으로는 `SELECT ... FOR UPDATE`처럼 잠금을 수반하는 쿼리의 팬텀을 막을 수 없습니다. MVCC는 읽기에만 스냅샷을 적용하고, 잠금 읽기는 현재 최신 버전을 기준으로 동작하기 때문입니다. InnoDB는 이 문제를 **Gap Lock**으로 해결합니다.

## 세 가지 행 수준 잠금

InnoDB는 행 수준 잠금을 세 종류로 구분합니다.

**Record Lock**은 인덱스 레코드 하나에 걸리는 잠금입니다. `WHERE id = 20`처럼 특정 행을 지정하면 해당 인덱스 항목만 잠급니다.

**Gap Lock**은 두 인덱스 키 사이의 빈 공간에 걸리는 잠금입니다. 예를 들어 인덱스에 10, 20, 30이 있을 때 `(20, 30)` 구간에 Gap Lock을 걸면, 그 사이에 새 행을 삽입하는 모든 트랜잭션이 대기합니다. Gap Lock은 순수하게 삽입을 막기 위한 잠금이며, 같은 갭에 대한 Gap Lock끼리는 충돌하지 않습니다.

**Next-Key Lock**은 Record Lock + 앞쪽 Gap Lock의 조합입니다. `(20, 30]`처럼 갭과 레코드를 함께 잠급니다. InnoDB는 범위 검색 시 스캔한 인덱스 구간 전체에 Next-Key Lock을 기본으로 적용합니다.

![Gap Lock · Next-Key Lock 범위](/assets/posts/mysql-gap-lock-next-key-range.svg)

## 잠금 범위 계산

```sql
-- t.id: 10, 20, 30, 50 존재
-- RR 격리 수준, 잠금 읽기

SELECT * FROM t WHERE id BETWEEN 20 AND 30 FOR UPDATE;
-- Next-Key Lock: (10,20], (20,30], (30,50] 적용
```

InnoDB는 검색 조건에 해당하는 인덱스 구간 전체를 스캔하므로, 조건 범위보다 넓게 잠금이 걸릴 수 있습니다. `BETWEEN 20 AND 30`이라도 InnoDB는 스캔 경계 바깥 갭까지 잠금 대상에 포함합니다.

범위 끝 이후의 supremum pseudo-record에도 잠금이 걸려, 인덱스 마지막 값 이후 구간에 대한 삽입도 차단합니다.

## Insert Intention Lock

갭에 행을 삽입하려는 트랜잭션은 먼저 **Insert Intention Lock**을 획득하려 합니다. 이 잠금은 같은 갭을 대상으로 하는 다른 Insert Intention Lock과는 충돌하지 않지만, Gap Lock과는 충돌합니다.

```sql
-- 같은 갭 (20,30)에 서로 다른 트랜잭션이 삽입 시도
-- Tx A: INSERT id=22  →  Insert Intention Lock 획득 시도
-- Tx B: INSERT id=27  →  Insert Intention Lock 획득 시도
-- → 두 트랜잭션이 서로를 막지 않음 (서로 다른 키)

-- 하지만 Tx C가 Gap Lock (20,30)을 갖고 있다면
-- Tx A, Tx B 모두 WAIT
```

## 데드락 시나리오

Gap Lock의 가장 주의해야 할 부분은 데드락입니다. Gap Lock끼리는 공유 잠금처럼 동시에 보유할 수 있지만, 서로의 갭에 삽입을 시도하면 순환 대기가 발생합니다.

![Gap Lock 데드락 시나리오](/assets/posts/mysql-gap-lock-next-key-deadlock.svg)

```sql
-- 데드락 확인
SHOW ENGINE INNODB STATUS\G
-- LATEST DETECTED DEADLOCK 섹션 참고

-- 최근 데드락 정보 초기화
-- (innodb_print_all_deadlocks=ON 이면 에러 로그에도 기록됨)
SET GLOBAL innodb_print_all_deadlocks = ON;
```

## Gap Lock을 피하는 방법

```sql
-- 1. READ COMMITTED 격리 수준: Gap Lock 미사용
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;

-- 2. 정확한 기본키 조회: Record Lock만 걸림
SELECT * FROM t WHERE id = 20 FOR UPDATE;
-- → id=20 레코드만 잠금, 갭 없음

-- 3. unique index 등치 검색
SELECT * FROM t WHERE unique_col = 'ABC' FOR UPDATE;
-- → 해당 레코드 Record Lock만, Gap Lock 없음
```

`READ COMMITTED`에서는 Gap Lock이 없어 동시 삽입이 자유롭지만, 팬텀 읽기가 발생할 수 있습니다. 어떤 격리 수준을 선택할지는 애플리케이션의 일관성 요구 사항과 트레이드오프를 고려해야 합니다.

## 정리

| 잠금 종류 | 범위 | 삽입 차단 | 읽기/쓰기 충돌 |
|---|---|---|---|
| Record Lock | 단일 레코드 | ✗ | ✓ |
| Gap Lock | (a, b) 열린 구간 | ✓ | ✗ |
| Next-Key Lock | (a, b] 닫힌 구간 | ✓ | ✓ |
| Insert Intention | 갭 내 특정 위치 | — | Gap Lock과만 충돌 |

InnoDB REPEATABLE READ가 팬텀을 막는 방식은 Gap Lock과 Next-Key Lock의 조합입니다. 이 구조를 이해하면 데드락이 발생하는 이유와, 그것을 피하기 위한 격리 수준·쿼리 패턴 선택이 명확해집니다.

---

**지난 글:** [MySQL REPEATABLE READ — 기본 격리 수준과 Gap Lock](/posts/mysql-isolation-rr-default/)

**다음 글:** [MySQL SHOW ENGINE INNODB STATUS — 데드락 분석](/posts/mysql-deadlock-show-engine/)

<br>
읽어주셔서 감사합니다. 😊
