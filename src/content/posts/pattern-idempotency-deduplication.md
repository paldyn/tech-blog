---
title: "멱등성과 중복 처리 방지 패턴"
description: "네트워크 재시도와 중복 요청으로 인한 데이터 이중 처리 문제를 DB 설계로 해결하는 멱등성 패턴을 설명합니다. Idempotency-Key 헤더, 중복 방지 테이블, ON CONFLICT DO NOTHING, 분산 환경에서의 고려사항을 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 6
type: "knowledge"
category: "SQL"
tags: ["멱등성", "중복 처리", "트랜잭션", "결제", "API 설계", "ON CONFLICT"]
featured: false
draft: false
---

[지난 글](/posts/pattern-pagination-cursor-vs-offset/)에서 페이지네이션 전략을 살펴봤습니다. 이번 글의 주제는 **멱등성(Idempotency)**입니다. 특히 결제, 포인트 적립, 재고 감소처럼 "한 번만 실행되어야 하는" 작업에서 네트워크 오류나 클라이언트 재시도로 인한 이중 처리를 방지하는 DB 패턴을 살펴봅니다.

## 멱등성이란

수학에서 멱등(idempotent)이란 같은 연산을 여러 번 적용해도 결과가 같은 성질입니다. f(f(x)) = f(x). 시스템에서는 **같은 요청을 여러 번 보내도 결과가 한 번과 동일**한 것을 의미합니다.

HTTP 메서드로 보면 `GET`, `PUT`, `DELETE`는 멱등이지만 `POST`는 멱등이 아닙니다. "결제" API를 `POST /payments`로 설계했을 때 클라이언트가 응답을 받지 못해 재시도하면 결제가 두 번 처리될 수 있습니다.

```
클라이언트: POST /payments { amount: 10000 }
서버: 결제 처리 완료
네트워크 단절 → 클라이언트 응답 못 받음
클라이언트: POST /payments { amount: 10000 } 재시도
서버: 또 결제 처리 → 이중 결제!
```

## Idempotency-Key 패턴

Stripe가 대중화한 패턴으로, 클라이언트가 요청 시 고유한 키를 헤더에 포함합니다.

```http
POST /payments HTTP/1.1
Content-Type: application/json
Idempotency-Key: payment-user123-order456-attempt1

{ "amount": 10000, "currency": "KRW" }
```

서버는 이 키를 저장해두고, 같은 키로 재요청이 오면 새로 처리하지 않고 이전 결과를 그대로 반환합니다.

![멱등성 처리 흐름](/assets/posts/pattern-idempotency-deduplication-flow.svg)

## DB 스키마 설계

멱등성 키를 저장하는 테이블을 별도로 관리합니다.

```sql
-- 멱등성 키 저장 테이블
CREATE TABLE idempotency_keys (
  idempotency_key  VARCHAR(255) PRIMARY KEY,
  request_hash     VARCHAR(64),    -- 요청 본문 해시 (다른 요청인지 검증)
  response_body    JSONB,          -- 캐시된 응답
  response_status  INT,            -- HTTP 상태 코드
  status           VARCHAR(20) DEFAULT 'processing',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL  -- TTL (예: 24시간)
);

CREATE INDEX ON idempotency_keys (expires_at)
  WHERE status = 'completed';  -- 만료된 키 정리용
```

## 처리 로직

트랜잭션 안에서 "키 삽입 시도 → 이미 있으면 캐시 반환" 흐름으로 처리합니다.

```python
async def process_payment(idempotency_key: str, payload: dict):
    request_hash = sha256(json.dumps(payload, sort_keys=True))

    async with db.transaction():
        # 1. 멱등성 키 삽입 시도 (이미 존재하면 실패)
        result = await db.execute("""
            INSERT INTO idempotency_keys
              (idempotency_key, request_hash, status, expires_at)
            VALUES ($1, $2, 'processing', NOW() + INTERVAL '24 hours')
            ON CONFLICT (idempotency_key) DO NOTHING
            RETURNING status, response_body
        """, [idempotency_key, request_hash])

        if not result:
            # 2. 이미 처리된 경우: 기존 결과 조회
            existing = await db.fetchone(
                "SELECT status, response_body FROM idempotency_keys WHERE idempotency_key = $1",
                [idempotency_key]
            )
            if existing['status'] == 'processing':
                raise ConflictError("요청이 처리 중입니다")
            return existing['response_body']

        # 3. 신규: 비즈니스 로직 실행
        payment_result = await execute_payment(payload)

        # 4. 결과 저장
        await db.execute("""
            UPDATE idempotency_keys
            SET status = 'completed', response_body = $1
            WHERE idempotency_key = $2
        """, [json.dumps(payment_result), idempotency_key])

        return payment_result
```

## DB 레벨 중복 방지: ON CONFLICT

애플리케이션 레이어 없이 DB 레벨에서 직접 중복을 방지할 수 있습니다. PostgreSQL의 `ON CONFLICT DO NOTHING`을 사용합니다.

![DB 레벨 중복 방지 — INSERT ON CONFLICT](/assets/posts/pattern-idempotency-deduplication-upsert.svg)

```sql
-- MySQL 동일 패턴
INSERT IGNORE INTO payments (idempotency_key, user_id, amount)
VALUES ('key-abc', 1, 10000);
-- 중복 시 에러 없이 무시

-- 또는 REPLACE INTO (기존 행 삭제 후 재삽입 — 사용 주의)
-- REPLACE INTO payments ... -- PK가 바뀌므로 FK 이슈 발생 가능
```

## 클라이언트 키 생성 전략

멱등성 키는 클라이언트가 생성해야 합니다. 일반적인 전략입니다.

```javascript
// 결제 전 UUID 생성 (로컬 저장)
const idempotencyKey = crypto.randomUUID();
localStorage.setItem('pendingPaymentKey', idempotencyKey);

// 결제 API 호출
try {
  const result = await fetch('/payments', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ amount: 10000 })
  });
  localStorage.removeItem('pendingPaymentKey');
  return result.json();
} catch (error) {
  // 재시도 시 동일한 키 사용
  return retryWithSameKey(idempotencyKey);
}
```

## 주의사항

- **요청 본문 해시 검증**: 같은 키로 다른 내용의 요청이 오면 에러 반환 (다른 결제 금액 등)
- **TTL 설정**: 멱등성 키는 영구 보관하지 않습니다. 일반적으로 24시간 ~ 7일
- **분산 환경**: Redis를 사용한 분산 락과 조합하면 동시 중복 요청도 방지 가능
- **상태 확인**: `processing` 상태인 키로 재요청이 오면 "처리 중" 응답 반환

다음 글에서는 소프트 딜리트(Soft Delete)와 하드 딜리트(Hard Delete)의 트레이드오프와 올바른 선택 기준을 살펴봅니다.

---

**지난 글:** [커서 vs 오프셋 — 페이지네이션 전략](/posts/pattern-pagination-cursor-vs-offset/)

**다음 글:** [Soft Delete vs Hard Delete](/posts/pattern-soft-delete-vs-hard-delete/)

<br>
읽어주셔서 감사합니다. 😊
