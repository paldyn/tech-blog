---
title: "SELECT FOR UPDATE SKIP LOCKED — DB 큐 패턴"
description: "외부 메시지 큐 없이 PostgreSQL·MySQL의 SELECT FOR UPDATE SKIP LOCKED를 이용해 안전하고 신뢰성 높은 작업 큐를 DB 테이블로 구현하는 방법을 설명합니다. 다중 Worker 동시 처리, 재시도 전략, Dead Letter Queue, Stale Job 회수까지 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 10
type: "knowledge"
category: "SQL"
tags: ["작업 큐", "SKIP LOCKED", "PostgreSQL", "트랜잭션", "백그라운드 작업", "데드락"]
featured: false
draft: false
---

[지난 글](/posts/pattern-history-audit-trail/)에서 변경 이력을 추적하는 히스토리 테이블을 살펴봤습니다. 이번 글은 **DB를 작업 큐로 활용하는 패턴**입니다. Redis나 RabbitMQ 같은 외부 메시지 브로커 없이, 이미 사용 중인 PostgreSQL이나 MySQL만으로 신뢰성 있는 백그라운드 작업 큐를 구현할 수 있습니다.

## DB 큐를 선택하는 이유

외부 메시지 큐를 추가하면 운영 복잡도가 높아집니다. 다음 상황에서는 DB 큐가 더 적합합니다.

- 트랜잭션 안에서 작업을 큐에 넣어야 할 때 (트랜잭션 롤백 시 큐 작업도 롤백)
- 운영 인프라를 단순하게 유지하고 싶을 때
- 작업량이 초당 수백 건 이내일 때 (초당 수천 건이 넘으면 RabbitMQ/Kafka 고려)

## 테이블 설계

```sql
CREATE TABLE job_queue (
  id            BIGSERIAL PRIMARY KEY,
  type          VARCHAR(100) NOT NULL,   -- 작업 종류
  payload       JSONB NOT NULL,          -- 작업 데이터
  status        VARCHAR(20) NOT NULL DEFAULT 'pending',
  priority      INT NOT NULL DEFAULT 0,
  retry_count   INT NOT NULL DEFAULT 0,
  max_retries   INT NOT NULL DEFAULT 3,
  next_run_at   TIMESTAMPTZ DEFAULT NOW(),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  error_msg     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 효율적인 작업 조회 인덱스
CREATE INDEX idx_job_queue_pending
  ON job_queue(priority DESC, next_run_at, id)
  WHERE status = 'pending';
```

## SKIP LOCKED의 핵심

`SELECT FOR UPDATE`는 선택한 행에 배타적 잠금을 겁니다. 다른 트랜잭션이 같은 행을 `FOR UPDATE`로 선택하려 하면 잠금이 해제될 때까지 기다립니다. **`SKIP LOCKED`를 추가하면 잠긴 행을 기다리지 않고 건너뜁니다.** 이것이 여러 Worker가 중복 없이 각자 다른 작업을 처리하게 하는 핵심입니다.

```sql
-- Worker가 다음 작업을 가져오는 쿼리 (트랜잭션 내에서 실행)
WITH next_job AS (
  SELECT id
  FROM   job_queue
  WHERE  status = 'pending'
    AND  next_run_at <= NOW()
  ORDER  BY priority DESC, next_run_at, id
  LIMIT  1
  FOR UPDATE SKIP LOCKED  -- 핵심: 다른 Worker가 처리 중인 행 건너뜀
)
UPDATE job_queue
SET    status     = 'processing',
       started_at = NOW()
WHERE  id = (SELECT id FROM next_job)
RETURNING *;
```

이 쿼리는 **원자적으로** "다음 pending 작업을 찾고 → processing으로 상태 변경"을 수행합니다. 여러 Worker가 동시에 실행해도 데드락 없이 각자 다른 작업을 가져갑니다.

![DB 큐 — SELECT FOR UPDATE SKIP LOCKED 흐름](/assets/posts/pattern-queue-for-update-skip-locked-flow.svg)

## Worker 구현

```python
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession

async def process_next_job(session: AsyncSession):
    async with session.begin():
        # 다음 작업 할당 (트랜잭션 내)
        result = await session.execute("""
            WITH next_job AS (
              SELECT id FROM job_queue
              WHERE  status = 'pending' AND next_run_at <= NOW()
              ORDER  BY priority DESC, next_run_at, id
              LIMIT  1
              FOR UPDATE SKIP LOCKED
            )
            UPDATE job_queue
            SET status = 'processing', started_at = NOW()
            WHERE id = (SELECT id FROM next_job)
            RETURNING id, type, payload
        """)
        job = result.fetchone()

        if not job:
            return False  # 처리할 작업 없음

        try:
            # 작업 타입에 따른 실제 처리
            await dispatch(job.type, job.payload)

            # 성공
            await session.execute("""
                UPDATE job_queue
                SET status = 'done', completed_at = NOW()
                WHERE id = :id
            """, {"id": job.id})

        except Exception as e:
            await handle_failure(session, job.id, str(e))

    return True

async def worker_loop():
    while True:
        processed = await process_next_job(get_session())
        if not processed:
            await asyncio.sleep(1)  # 작업 없으면 1초 대기
```

## 재시도와 Dead Letter Queue

실패한 작업은 즉시 재시도하지 않고 **지수 백오프(Exponential Backoff)**로 대기 시간을 늘립니다.

![재시도 전략과 Dead Letter Queue](/assets/posts/pattern-queue-for-update-skip-locked-retry.svg)

```sql
-- 실패 처리: 재시도 카운트 증가, 지수 백오프 대기 시간 설정
UPDATE job_queue
SET    retry_count  = retry_count + 1,
       error_msg    = :error,
       status       = CASE
                        WHEN retry_count + 1 >= max_retries THEN 'dead_letter'
                        ELSE 'pending'
                      END,
       -- 2^retry_count 분 대기: 1분, 2분, 4분, 8분...
       next_run_at  = NOW() + POWER(2, retry_count) * INTERVAL '1 minute'
WHERE  id = :job_id;
```

`dead_letter` 상태의 작업은 자동으로 재시도되지 않고, 운영자가 직접 확인해 수동 재처리하거나 버립니다.

## Stale Job 회수

Worker 프로세스가 크래시하면 `processing` 상태로 묶인 작업이 방치됩니다. 주기적으로 이런 "오래된" 작업을 `pending`으로 되돌립니다.

```sql
-- Stale Job 회수 (예: 10분 이상 처리 중인 작업)
UPDATE job_queue
SET    status     = 'pending',
       started_at = NULL,
       error_msg  = 'Worker timeout'
WHERE  status     = 'processing'
  AND  started_at < NOW() - INTERVAL '10 minutes';
```

이 쿼리는 크론잡이나 별도 모니터링 프로세스에서 1~5분마다 실행합니다.

## Transactional Outbox 패턴

비즈니스 트랜잭션과 큐 작업 삽입을 **같은 트랜잭션**에 묶으면 "결제 처리 성공 + 이메일 발송 큐 추가"가 원자적으로 처리됩니다.

```python
async def complete_order(session, order_id, user_email):
    async with session.begin():
        # 주문 완료
        await session.execute(
            "UPDATE orders SET status='paid' WHERE id=:id",
            {"id": order_id}
        )
        # 이메일 발송 큐 삽입 (같은 트랜잭션!)
        await session.execute(
            "INSERT INTO job_queue (type, payload) VALUES ('email', :p)",
            {"p": json.dumps({"to": user_email, "template": "order_paid"})}
        )
    # 트랜잭션 커밋 시 두 작업 모두 반영 또는 둘 다 롤백
```

이 패턴은 DB 큐의 가장 큰 장점입니다. 외부 메시지 브로커로는 이 원자성을 보장하기 위해 2PC(Two-Phase Commit) 같은 복잡한 프로토콜이 필요합니다. 이것으로 SQL 완전 정복 시리즈의 ORM·패턴 파트가 마무리됩니다.

---

**지난 글:** [변경 이력 추적 — 히스토리 테이블 패턴](/posts/pattern-history-audit-trail/)

<br>
읽어주셔서 감사합니다. 😊
