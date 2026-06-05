---
title: "비즈니스 로직 취약점: 규칙의 허점을 노리다"
description: "기술적으로 유효하지만 의도된 비즈니스 규칙을 벗어나는 비즈니스 로직 취약점의 유형(가격 조작·단계 건너뛰기·제한 우회), 탐지의 어려움과 설계 단계부터의 위협 모델링 방어 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 5
type: "knowledge"
category: "Security"
tags: ["웹보안", "비즈니스로직", "입력검증", "위협모델링", "OWASP"]
featured: false
draft: false
---

[지난 글](/posts/websec-race-conditions/)에서 동시성 취약점을 살펴봤다. 이번에는 **비즈니스 로직 취약점(Business Logic Flaws)**이다. SQL 인젝션이나 XSS처럼 기술적 오류가 아니라, 애플리케이션이 정상 작동하면서도 의도된 비즈니스 규칙을 벗어나는 방식으로 악용되는 취약점이다.

## 비즈니스 로직 취약점이란?

자동화 스캐너가 탐지하기 가장 어려운 취약점 유형이다. 요청 자체는 기술적으로 완전히 유효하지만, 공격자가 의도하지 않은 방식으로 애플리케이션을 사용한다. 예를 들어 수량 필드에 `-1`을 입력하거나, 결제 단계를 건너뛰고 완료 URL에 직접 접근하는 식이다.

핵심 원인은 개발자가 "정상적인 사용자"의 흐름만 설계하고, 이상한 순서나 비정상적인 입력값을 고려하지 않은 데 있다.

![비즈니스 로직 취약점 유형별 예시](/assets/posts/websec-business-logic-flaws-examples.svg)

## 주요 취약점 유형

### 1. 가격 조작 (Price Manipulation)

가격을 클라이언트 측에서 계산하거나 파라미터로 전달받는 경우다:

```http
POST /api/cart/update
Content-Type: application/json

{
  "productId": "laptop-pro",
  "quantity": -1,
  "price": -2000000
}
```

서버가 수량·가격에 양수 검증을 하지 않으면 총 금액이 음수가 되어 환불이 발생하거나, 0원 결제가 가능해진다. 또는 프로모션 할인율을 파라미터로 전달받는 경우:

```json
{"discount": 100, "price": 50000}
```

`discount`가 100%를 초과해도 검증하지 않으면 공짜로 구매할 수 있다.

### 2. 결제/인증 단계 건너뛰기 (Workflow Bypass)

멀티 스텝 프로세스에서 각 단계를 서버가 순서대로 검증하지 않으면 중간 단계를 우회할 수 있다:

```
정상 흐름: 장바구니 → 배송지 입력 → 결제 → 완료
공격 흐름: 완료 URL 직접 접근 → /checkout/complete?orderId=xyz
```

서버가 `orderId`만 검증하고 결제 상태(`order.status === 'PAID'`)를 확인하지 않으면 무료로 주문이 완료된다.

```python
# 취약: 결제 상태 미검증
def complete_order(request, order_id):
    order = Order.objects.get(id=order_id)
    order.status = 'COMPLETED'  # 결제 여부 확인 없음
    order.save()
    return redirect('/success')

# 안전: 이전 단계 상태 검증
def complete_order(request, order_id):
    order = Order.objects.get(id=order_id, user=request.user)
    if order.status != 'PAID':
        raise PermissionDenied('결제가 완료되지 않았습니다.')
    order.status = 'COMPLETED'
    order.save()
```

### 3. 사용 제한 우회 (Limit Bypass)

1회용 초대 코드, 회원당 1회 쿠폰, 일일 결제 한도 등의 제한을 우회하는 패턴이다:

```javascript
// 취약: 코드 유효성만 확인, 사용 여부 확인 후 무효화 미처리
async function redeemInvite(code) {
  const invite = await db.findInvite(code);
  if (!invite) throw new Error('유효하지 않은 코드');
  await createUser(...);  // 코드를 무효화하지 않음
}
```

멀티스레드 레이스 컨디션과 결합하면 단일 코드로 다수의 계정을 생성할 수 있다.

### 4. 상태 혼동 (State Confusion)

이메일 변경 후 구 토큰이 여전히 유효한 경우, 혹은 계정 비활성화 후에도 기존 세션이 유효한 경우다:

```
1. 사용자가 이메일을 a@old.com → b@new.com 으로 변경 신청
2. 두 이메일 모두에 인증 링크 발송
3. 공격자가 a@old.com 메일함에 접근해 구 링크 클릭
4. 결과: b@new.com 계정 탈취
```

### 5. 음수·극단값 입력

```javascript
// 포인트 전환
POST /api/points/transfer
{"to": "victim@example.com", "amount": -1000}
// → 내 포인트 증가, 피해자 포인트 감소
```

이체 금액이 음수일 때 방향이 역전되는 취약점이다.

## 방어 방법

![비즈니스 로직 취약점 방어 원칙](/assets/posts/websec-business-logic-flaws-defense.svg)

**서버 측 상태 머신**: 각 API 엔드포인트에서 이전 단계의 완료 여부를 반드시 검증한다. 클라이언트의 흐름을 신뢰하지 않는다.

**입력 경계값 검증**: 수량·가격·이체금액 등 모든 숫자 입력에 최솟값·최댓값·정수 여부를 검증한다.

```typescript
function validateAmount(amount: unknown): number {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0 || n > 10_000_000) {
    throw new Error('유효하지 않은 금액');
  }
  return Math.floor(n); // 소수점 처리
}
```

**1회용 토큰의 원자적 무효화**: 토큰 사용 즉시 DB에서 삭제하거나 무효 표시한다. 조회와 삭제를 단일 트랜잭션으로 처리한다.

**상태 변경 시 관련 토큰 일괄 무효화**: 이메일 변경·비밀번호 변경·계정 비활성화 시 기존 세션과 미사용 토큰을 모두 무효화한다.

**위협 모델링**: 설계 단계에서 다음 질문들을 한다:
- 이 값을 음수/0/최대값으로 보내면 어떻게 되나?
- 이 단계를 건너뛰면 어떻게 되나?
- 같은 요청을 100번 보내면 어떻게 되나?
- 다른 사용자의 ID를 파라미터로 넣으면 어떻게 되나?

## 탐지 방법

자동화 스캐너는 이런 취약점을 잘 찾지 못한다. 수동 테스트가 핵심이다. Burp Suite로 모든 요청의 파라미터를 확인하고, 비정상적인 값(음수·0·극단값·다른 순서)을 직접 시험해본다. OWASP의 **Testing Business Logic** 가이드라인이 좋은 체크리스트를 제공한다.

---

**지난 글:** [레이스 컨디션: 동시성의 틈을 노리는 공격](/posts/websec-race-conditions/)

**다음 글:** [동일 출처 정책(Same-Origin Policy)](/posts/websec-same-origin-policy/)

<br>
읽어주셔서 감사합니다. 😊
