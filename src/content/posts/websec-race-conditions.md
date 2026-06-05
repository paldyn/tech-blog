---
title: "레이스 컨디션: 동시성의 틈을 노리는 공격"
description: "체크-사용(Check-Then-Act) 패턴의 원자성 결여를 악용해 할인 중복 사용·잔액 음수·파일 검증 우회를 유발하는 레이스 컨디션의 원리와 원자적 DB 업데이트·분산 락·멱등성 키 방어 전략을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 4
type: "knowledge"
category: "Security"
tags: ["웹보안", "레이스컨디션", "동시성", "트랜잭션", "분산락"]
featured: false
draft: false
---

[지난 글](/posts/websec-open-redirect/)에서 리다이렉트 검증 우회를 살펴봤다. 이번에는 **레이스 컨디션(Race Condition)**이다. 멀티스레드·멀티프로세스 환경에서 두 요청이 동시에 동일한 공유 자원에 접근할 때, 처리 순서에 따라 의도치 않은 결과가 발생하는 취약점이다.

## 문제의 핵심: Check-Then-Act 패턴

대부분의 레이스 컨디션은 다음 패턴에서 발생한다:

```
1. 상태 확인 (Check)
2. 비즈니스 로직 처리
3. 상태 변경 (Act)
```

1단계와 3단계 사이에 다른 요청이 끼어들면, 둘 다 같은 초기 상태를 읽고 처리를 진행한다.

## 할인 쿠폰 중복 사용 예시

```javascript
// 취약한 코드
async function applyCoupon(userId, couponId) {
  const coupon = await db.query(
    'SELECT * FROM coupons WHERE id = $1', [couponId]
  );
  
  if (coupon.used) throw new Error('이미 사용된 쿠폰');
  
  // ⚠ 이 시점에 다른 요청이 동일 쿠폰 조회 가능
  
  await db.query(
    'UPDATE orders SET discount = $1 WHERE user_id = $2',
    [coupon.discount, userId]
  );
  await db.query(
    'UPDATE coupons SET used = true WHERE id = $1', [couponId]
  );
}
```

공격자가 같은 쿠폰으로 두 요청을 동시에 보내면:
- 요청 A: `used=false` 확인 → 할인 적용
- 요청 B: `used=false` 확인 (A가 아직 `used=true`로 갱신 전) → 할인 적용
- 결과: 쿠폰 한 장으로 두 번 할인

![레이스 컨디션: 중복 할인 쿠폰 사용 예시](/assets/posts/websec-race-conditions-flow.svg)

## 다른 공격 시나리오

**잔액 초과 출금**

```
잔액: 100원
요청 A: 잔액 100 확인 → 100원 출금 처리 중
요청 B: 잔액 100 확인 (A 완료 전) → 100원 출금 처리 중
결과: 잔액 -100원 (200원 출금)
```

**파일 업로드 TOCTOU(Time-of-Check to Time-of-Use)**

악성 파일을 업로드하고, 검증과 이동 사이의 짧은 시간에 파일을 교체한다:

```
서버: 파일 검증 통과 (이미지 파일 확인)
공격자: 검증된 파일을 웹쉘로 교체
서버: 파일을 public 디렉토리로 이동
결과: 웹쉘이 공개 경로에 배치됨
```

**계정 제한 우회**

```
API 요청 횟수 제한: 1분에 10회
공격자: 동시에 100개 요청 전송
서버: 각 요청이 카운터를 읽을 때 9로 보임 (서로가 갱신 전)
결과: 실제 100회 요청이 모두 통과
```

## 방어 전략

![레이스 컨디션 방어 패턴](/assets/posts/websec-race-conditions-defense.svg)

### 1. 원자적 DB 업데이트 (가장 권장)

`SELECT + UPDATE` 두 단계를 `WHERE` 조건부 `UPDATE` 한 단계로 합친다:

```sql
-- 원자적: 조건 확인과 상태 변경을 한 쿼리로
UPDATE coupons
SET used = true
WHERE id = $1 AND used = false
RETURNING id;

-- rowCount = 0이면 이미 사용됨 (다른 요청이 먼저 처리)
-- rowCount = 1이면 성공적으로 예약
```

`AND used = false` 조건이 있어 여러 요청이 동시에 시도해도 하나만 성공한다. DB의 원자성 보장을 이용한 방법이다.

### 2. SELECT FOR UPDATE (비관적 락)

트랜잭션 내에서 레코드를 읽는 순간 락을 잡아 다른 요청을 대기시킨다:

```sql
BEGIN;
SELECT * FROM coupons WHERE id = $1 FOR UPDATE;
-- 이 시점부터 다른 트랜잭션은 이 레코드를 수정 불가
UPDATE coupons SET used = true WHERE id = $1;
COMMIT;
```

처리량이 많은 시스템에서는 락 경합으로 성능이 저하될 수 있다.

### 3. 낙관적 락 (Optimistic Lock)

버전 번호를 사용해 충돌을 감지한다:

```javascript
// 버전 번호 기반 낙관적 락
const result = await db.query(
  `UPDATE coupons SET used = true, version = version + 1
   WHERE id = $1 AND version = $2 AND used = false`,
  [couponId, coupon.version]
);

if (result.rowCount === 0) {
  throw new Error('동시 처리 충돌 — 재시도 필요');
}
```

락 없이 충돌 감지만 하므로 성능이 좋지만, 충돌 시 재시도 로직이 필요하다.

### 4. 분산 락 (Redis)

여러 서버 인스턴스 간에는 DB 트랜잭션만으로 부족할 수 있다. Redis의 `SET NX EX`로 분산 락을 구현한다:

```javascript
const lockKey = `lock:coupon:${couponId}:user:${userId}`;
const lockValue = crypto.randomUUID();

// 원자적 락 획득 (NX: 없을 때만 설정, EX: 10초 TTL)
const acquired = await redis.set(lockKey, lockValue, 'NX', 'EX', 10);

if (!acquired) {
  throw new Error('동시 요청 처리 중 — 잠시 후 재시도');
}

try {
  await processCoupon(couponId, userId);
} finally {
  // Lua 스크립트로 원자적 삭제 (자신이 획득한 락만)
  await redis.eval(
    `if redis.call('get', KEYS[1]) == ARGV[1] then
       return redis.call('del', KEYS[1])
     end`,
    1, lockKey, lockValue
  );
}
```

### 5. 멱등성 키 (Idempotency Key)

클라이언트가 요청마다 고유 키를 보내고, 서버가 같은 키의 재요청은 저장된 응답을 반환한다:

```http
POST /api/apply-coupon
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{"couponId": "PROMO2026", "orderId": "ord_123"}
```

서버는 `Idempotency-Key`를 DB나 Redis에 저장하고, 같은 키로 재요청이 오면 재처리 없이 첫 번째 응답을 그대로 반환한다.

## Burp Suite로 레이스 컨디션 테스트

Burp Suite의 **Repeater** 탭에서 여러 요청을 그룹으로 묶어 동시에 전송하는 기능(Send group in parallel)을 사용한다. HTTP/2 single-packet 공격으로 네트워크 지터를 최소화해 경쟁 창을 넓힐 수 있다.

---

**지난 글:** [오픈 리다이렉트: 신뢰 도메인을 피싱의 발판으로](/posts/websec-open-redirect/)

**다음 글:** [비즈니스 로직 취약점](/posts/websec-business-logic-flaws/)

<br>
읽어주셔서 감사합니다. 😊
