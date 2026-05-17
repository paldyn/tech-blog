---
title: "MySQL 데드락 분석 — SHOW ENGINE INNODB STATUS 읽는 법"
description: "InnoDB 데드락 발생 시 SHOW ENGINE INNODB STATUS 출력에서 LATEST DETECTED DEADLOCK 섹션을 읽고 원인을 파악하는 방법, 데드락 예방·재시도 전략을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 22
type: "knowledge"
category: "SQL"
tags: ["mysql", "innodb", "deadlock", "show-engine-innodb-status", "lock", "트랜잭션"]
featured: false
draft: false
---

[지난 글](/posts/mysql-gap-lock-next-key/)에서 Gap Lock과 Next-Key Lock이 어떻게 데드락을 유발하는지 살펴봤습니다. 이번 글에서는 실제로 데드락이 발생했을 때 MySQL이 어떻게 감지·해소하는지, 그리고 `SHOW ENGINE INNODB STATUS`를 통해 원인을 분석하는 방법을 다룹니다.

## 데드락 감지 메커니즘

InnoDB는 잠금 대기 그래프를 실시간으로 유지합니다. 트랜잭션이 잠금을 요청할 때마다 대기 그래프에 간선이 추가되고, InnoDB는 이 그래프에 사이클이 생겼는지 즉시 검사합니다. 사이클이 발견되면 데드락으로 판정하고, 비용(변경 행 수 기준)이 낮은 트랜잭션을 롤백합니다.

![데드락 순환 대기 그래프](/assets/posts/mysql-deadlock-show-engine-cycle.svg)

이 동작은 `innodb_deadlock_detect` 파라미터로 제어하며, 기본값은 `ON`입니다. 이를 끄면 데드락이 감지되지 않고 `innodb_lock_wait_timeout`(기본 50초) 타임아웃이 대신 트리거됩니다. 고부하 환경에서 데드락 감지 비용이 문제가 될 때만 끄는 것을 고려하세요.

## SHOW ENGINE INNODB STATUS 읽기

```sql
SHOW ENGINE INNODB STATUS\G
```

출력에서 `LATEST DETECTED DEADLOCK` 섹션을 찾습니다.

![SHOW ENGINE INNODB STATUS 데드락 섹션](/assets/posts/mysql-deadlock-show-engine-status.svg)

섹션 구조는 다음과 같습니다.

- **TRANSACTION**: 데드락에 관여한 각 트랜잭션 정보 (번호, 활성 시간, 대기 상태)
- **RECORD LOCKS**: 잠금이 걸린 테이블·인덱스·페이지 정보
- **lock_mode**: `X`(배타적), `S`(공유), `X locks gap before rec`(Gap Lock), `X locks rec but not gap`(Record Lock만)
- **WE ROLL BACK TRANSACTION (N)**: 롤백된 트랜잭션 번호

주의: 이 섹션은 마지막 데드락 하나만 보관합니다. 에러 로그에 모든 데드락을 기록하려면:

```sql
SET GLOBAL innodb_print_all_deadlocks = ON;
-- my.cnf에도 추가: innodb_print_all_deadlocks = 1
```

## performance_schema로 현재 잠금 조회

```sql
-- 현재 잠금 대기 상태
SELECT
    r.trx_id         AS waiting_trx,
    r.trx_query      AS waiting_query,
    b.trx_id         AS blocking_trx,
    b.trx_query      AS blocking_query
FROM
    information_schema.innodb_lock_waits w
    JOIN information_schema.innodb_trx r ON r.trx_id = w.requesting_trx_id
    JOIN information_schema.innodb_trx b ON b.trx_id = w.blocking_trx_id;

-- MySQL 8.0+: performance_schema 사용
SELECT * FROM performance_schema.data_lock_waits\G
SELECT * FROM performance_schema.data_locks\G
```

## 데드락 예방 전략

데드락은 완전히 막을 수 없지만, 발생 확률을 줄이는 방법이 있습니다.

**잠금 획득 순서 일원화**: 여러 행을 잠글 때 항상 같은 순서(예: 기본키 오름차순)로 잠그도록 쿼리를 정렬합니다.

```sql
-- 나쁜 예: Tx A는 1→2, Tx B는 2→1 순서
-- 좋은 예: 항상 id 오름차순으로 처리
SELECT * FROM t WHERE id IN (1, 2) ORDER BY id FOR UPDATE;
```

**트랜잭션을 짧게**: 잠금 보유 시간이 길수록 충돌 확률이 높습니다. 트랜잭션 안에서 네트워크 I/O나 사용자 입력을 기다리지 마세요.

**격리 수준 조정**: `READ COMMITTED`로 낮추면 Gap Lock이 사라져 삽입 관련 데드락이 줄어듭니다. 단, 팬텀 읽기가 허용됩니다.

**재시도 로직 필수**: 데드락은 완전히 없앨 수 없으므로, 애플리케이션에서 `ER_LOCK_DEADLOCK`(오류 코드 1213)을 잡아 트랜잭션을 재시도해야 합니다.

```python
import mysql.connector
from mysql.connector import errorcode

MAX_RETRY = 3

for attempt in range(MAX_RETRY):
    try:
        conn.start_transaction()
        # ... DML ...
        conn.commit()
        break
    except mysql.connector.Error as e:
        conn.rollback()
        if e.errno == errorcode.ER_LOCK_DEADLOCK and attempt < MAX_RETRY - 1:
            continue   # 재시도
        raise
```

## 진단 체크리스트

데드락 발생 시 다음 순서로 분석합니다.

1. `SHOW ENGINE INNODB STATUS`에서 관여 트랜잭션과 잠금 종류 확인
2. `lock_mode` 항목에서 어떤 인덱스의 어떤 구간이 잠겼는지 파악
3. 애플리케이션 코드에서 두 트랜잭션의 잠금 획득 순서 확인
4. 잠금 순서를 통일하거나, 쿼리를 단순화하거나, 격리 수준을 조정
5. 재시도 로직 추가 후 배포

데드락 분석은 "어떤 자원을 누가 먼저 잡았는가"를 추적하는 작업입니다. INNODB STATUS 출력을 읽는 연습을 꾸준히 하면 대부분의 패턴을 빠르게 식별할 수 있습니다.

---

**지난 글:** [MySQL Gap Lock · Next-Key Lock — 팬텀 읽기 방지 메커니즘](/posts/mysql-gap-lock-next-key/)

**다음 글:** [MySQL autocommit과 트랜잭션 제어](/posts/mysql-autocommit-transaction/)

<br>
읽어주셔서 감사합니다. 😊
