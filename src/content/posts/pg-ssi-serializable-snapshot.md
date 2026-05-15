---
title: "SSI — 직렬화 스냅샷 격리의 충돌 감지"
description: "PostgreSQL SERIALIZABLE 격리 수준의 핵심인 SSI(Serializable Snapshot Isolation)가 rw-anti-dependency 사이클을 탐지해 Write Skew를 방지하는 원리, SIREAD Predicate Lock의 단위와 승격 규칙, 그리고 실무에서 SSI를 재시도 로직과 함께 적용하는 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 3
type: "knowledge"
category: "SQL"
tags: ["postgresql", "serializable", "ssi", "write-skew", "predicate-lock", "siread", "rw-anti-dependency", "isolation", "concurrency"]
featured: false
draft: false
---

[지난 글](/posts/pg-isolation-implementation/)에서 스냅샷 기반 격리의 동작 원리를 살펴봤다. `REPEATABLE READ`는 Non-Repeatable Read와 Phantom Read를 막지만, **Write Skew**라는 더 미묘한 이상 현상은 방지하지 못한다. PostgreSQL의 `SERIALIZABLE` 격리 수준은 SSI(Serializable Snapshot Isolation) 알고리즘으로 이 문제를 해결한다.

## Write Skew란

Write Skew는 두 트랜잭션이 각자 서로의 읽기 결과에 의존해 쓰기를 수행할 때 발생한다. 가장 전형적인 예는 당직 의사 시나리오다. 두 트랜잭션 모두 "당직 인원이 2명이므로 1명을 빼도 된다"고 읽고, 각자 다른 의사를 비번으로 바꾼다. 결과적으로 당직 인원이 0명이 되는 논리적 불변식 위반이 발생한다.

```sql
-- 트랜잭션 T1 (SERIALIZABLE)
BEGIN ISOLATION LEVEL SERIALIZABLE;
SELECT count(*) FROM doctors WHERE on_call = TRUE;  -- 2 반환
UPDATE doctors SET on_call = FALSE WHERE name = 'Alice';
COMMIT;  -- 성공 or 롤백

-- 트랜잭션 T2 (SERIALIZABLE, T1과 동시 실행)
BEGIN ISOLATION LEVEL SERIALIZABLE;
SELECT count(*) FROM doctors WHERE on_call = TRUE;  -- 역시 2 반환
UPDATE doctors SET on_call = FALSE WHERE name = 'Bob';
COMMIT;  -- SSI가 사이클 탐지 → 오류 발생
-- ERROR: could not serialize access due to read/write dependencies
```

직렬 실행이라면 T1이 먼저 실행되면 T2의 읽기 결과는 1이 되고 UPDATE를 하지 않는다. SSI는 이 직렬화 불가능한 상태를 커밋 전에 탐지한다.

![Write Skew와 rw-anti-dependency 사이클](/assets/posts/pg-ssi-serializable-snapshot-rw-cycle.svg)

## rw-anti-dependency와 SIREAD Lock

SSI는 **SIREAD Predicate Lock**으로 각 트랜잭션의 읽기 범위를 추적한다. SIREAD 락은 실제 접근을 차단하지 않는다 — 단지 "이 범위를 읽었음"을 기록할 뿐이다.

| 읽기 유형 | SIREAD 락 단위 |
|-----------|----------------|
| Sequential Scan | Relation 전체 |
| Index Scan | 접근한 Index Page |
| Index + Heap | 읽은 Tuple |

트랜잭션 A가 읽은 범위에 트랜잭션 B가 쓰면 A→B 방향의 rw-anti-dependency가 생성된다. 반대로 B가 읽은 범위에 A가 쓰면 B→A 방향의 rw-anti-dependency가 생성된다. 이 두 방향이 사이클을 이루면 PostgreSQL은 늦게 커밋하는 트랜잭션을 롤백한다.

```sql
-- pg_locks로 SIREAD 락 확인
SELECT pid, locktype, relation::regclass, mode, granted
FROM   pg_locks
WHERE  mode = 'SIReadLock';

-- SSI 메모리 사용량 확인
SELECT name, setting
FROM   pg_settings
WHERE  name LIKE 'max_pred_locks%';
```

![SIREAD Lock 단위와 SSI 설정](/assets/posts/pg-ssi-serializable-snapshot-siread.svg)

## SIREAD Lock 승격

튜플 단위 SIREAD 락이 한 페이지에 `max_pred_locks_per_page`(기본 2)개를 초과하면 페이지 단위로 승격된다. 페이지 락이 테이블 내에서 `max_pred_locks_per_relation`을 초과하면 테이블 전체 락으로 승격된다. 승격은 메모리를 절약하지만 거짓 양성(false positive) 롤백이 증가할 수 있다.

## 재시도 패턴

SSI 오류는 정상적인 직렬화 실패다. 애플리케이션은 반드시 재시도 로직을 갖춰야 한다.

```python
import psycopg2
from time import sleep

def run_with_serializable_retry(conn_str, fn, max_retries=5):
    for attempt in range(max_retries):
        try:
            with psycopg2.connect(conn_str) as conn:
                conn.autocommit = False
                conn.set_isolation_level(
                    psycopg2.extensions.ISOLATION_LEVEL_SERIALIZABLE
                )
                result = fn(conn)
                conn.commit()
                return result
        except psycopg2.errors.SerializationFailure:
            if attempt == max_retries - 1:
                raise
            sleep(0.1 * (2 ** attempt))  # 지수 백오프
```

## SSI vs 명시적 락

| 전략 | 특징 |
|------|------|
| SSI | 낙관적, 읽기 충돌 시 롤백, 재시도 필요 |
| `SELECT FOR UPDATE` | 비관적, 대기 발생, 데드락 위험 |
| `LOCK TABLE` | 전체 테이블 잠금, 동시성 최소 |

Write Skew가 논리적으로 불가능한 도메인(e.g., 계좌 잔액)에서는 `SELECT FOR UPDATE`가 더 단순하다. 불변식 위반이 복잡한 범위 조건에 걸릴 때는 SSI가 더 적합하다.

---

**지난 글:** [PostgreSQL 격리 수준 구현 — 스냅샷과 가시성 체크](/posts/pg-isolation-implementation/)

**다음 글:** [PostgreSQL 락 유형과 pg_locks — 잠금 계층 이해](/posts/pg-lock-types-pg-locks/)

<br>
읽어주셔서 감사합니다. 😊
