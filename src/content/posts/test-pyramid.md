---
title: "테스트 피라미드 — 전략적 테스트 포트폴리오 구성"
description: "테스트 피라미드의 단위·통합·E2E 계층 특성, 비용/속도 트레이드오프, 역 피라미드·모래시계 안티패턴, 트로피 모델까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "테스트전략", "테스트피라미드", "단위테스트", "통합테스트", "E2E", "테스트트로피", "TDD"]
featured: false
draft: false
---

[지난 글](/posts/test-playwright-cypress/)에서 E2E 테스트 프레임워크를 비교했습니다. 이번에는 **테스트 전략** 관점에서 어떤 계층에 얼마나 투자해야 하는지를 다룹니다. 테스트 피라미드는 Mike Cohn이 제안한 개념으로, 서로 다른 테스트 유형의 이상적인 비율을 시각화합니다.

---

## 테스트 피라미드의 세 계층

피라미드는 아래에서 위로 갈수록 테스트 수가 적어지고, 실행 속도가 느려지며, 유지보수 비용이 높아집니다.

![테스트 피라미드](/assets/posts/test-pyramid-diagram.svg)

### 단위 테스트 (Unit Tests)

하나의 함수, 클래스, 컴포넌트를 외부 의존성 없이 격리해 테스트합니다. 실행이 수 밀리초로 빠르고, 실패 원인을 즉시 파악할 수 있습니다. 전체 테스트의 60~70%를 차지해야 합니다.

```typescript
// 순수 함수 단위 테스트
import { formatPrice } from './format'

describe('formatPrice', () => {
  it('천 단위 구분자를 추가한다', () => {
    expect(formatPrice(1000)).toBe('1,000원')
    expect(formatPrice(1234567)).toBe('1,234,567원')
  })

  it('소수점을 반올림한다', () => {
    expect(formatPrice(9.99)).toBe('10원')
  })
})
```

### 통합 테스트 (Integration Tests)

여러 모듈이 함께 동작하는지 확인합니다. API 라우트 + 서비스 + 검증 로직, 또는 React 컴포넌트 + 상태 관리 + API 호출의 조합을 테스트합니다. Testing Library로 작성하는 컴포넌트 테스트가 여기에 해당합니다.

```typescript
// 서비스 통합 테스트 (실제 DB 대신 인메모리 DB)
describe('UserService', () => {
  let userService: UserService
  let db: InMemoryDB

  beforeEach(() => {
    db = new InMemoryDB()
    userService = new UserService(db)
  })

  it('사용자를 생성하고 조회한다', async () => {
    const created = await userService.create({ name: 'Alice', email: 'alice@test.com' })
    const found = await userService.findById(created.id)
    expect(found?.name).toBe('Alice')
  })
})
```

### E2E 테스트

실제 브라우저에서 전체 사용자 시나리오를 실행합니다. 가장 높은 신뢰도를 주지만, 느리고 유지보수 비용이 높습니다. 핵심 비즈니스 흐름(로그인, 결제, 핵심 기능)에만 집중해 전체의 5~10%로 제한합니다.

---

## 계층별 특성 비교

![테스트 계층별 특성](/assets/posts/test-pyramid-tradeoffs.svg)

---

## 안티패턴: 역 피라미드와 모래시계

**역 피라미드(Ice Cream Cone)**는 E2E 테스트가 대부분을 차지하는 패턴입니다. 테스트 실행 시간이 수십 분에 달하고, 플래키(flaky) 테스트가 많아 CI 파이프라인이 불안정해집니다. "빠른 시작"의 유혹에서 비롯됩니다.

```bash
# 역 피라미드의 CI 현실
cypress run  # 40분... CI timeout
# 단위 테스트는 없고 E2E만 있어서 작은 함수 변경도 전체 스위트 실행
```

**모래시계** 패턴은 단위 테스트와 E2E는 있지만 통합 테스트가 없는 형태입니다. 모듈 간 연동 문제가 E2E에서만 발견되어 디버깅이 어렵습니다.

---

## 현대적 변형: 트로피 모델

Kent C. Dodds가 제안한 **트로피(Trophy)** 모델은 통합 테스트에 가장 많은 비중을 둡니다. "구현이 아닌 동작을 테스트하라"는 Testing Library의 철학과 맞닿아 있습니다.

```
  E2E (소수 — 핵심 경로만)
 통합 테스트 (가장 많음 — Testing Library 등)
  단위 테스트 (유틸·알고리즘)
  정적 분석 (TypeScript + ESLint)
```

정적 분석(TypeScript, ESLint)을 피라미드의 기반으로 추가합니다. 타입 오류와 일반적인 실수를 코드 작성 시점에 잡아 전체 테스트 비용을 줄입니다.

---

## 무엇을 단위 테스트하고, 무엇을 통합 테스트할까

| 대상 | 권장 계층 |
|------|-----------|
| 순수 함수, 유틸리티 | 단위 |
| 복잡한 비즈니스 로직 | 단위 |
| API 라우트 핸들러 | 통합 (supertest) |
| React 컴포넌트 + 상태 | 통합 (Testing Library) |
| 폼 유효성 검사 흐름 | 통합 |
| 로그인/결제 플로우 | E2E |
| 외부 서비스 연동 확인 | E2E 또는 계약 테스트 |

---

## 플래키 테스트 관리

E2E 테스트에서 가장 흔한 문제는 플래키(flaky) 테스트입니다. 때로는 통과하고 때로는 실패하는 테스트는 CI 신뢰도를 떨어뜨립니다.

```typescript
// 플래키 원인: 고정 sleep
await page.waitForTimeout(2000) // 환경에 따라 불충분할 수 있음

// 권장: 조건 기반 대기
await page.waitForSelector('[data-testid="result"]')
await expect(page.getByText('완료')).toBeVisible()
// Playwright의 built-in assertion은 자동 재시도
```

플래키 테스트를 격리하려면 `test.fixme()`(Playwright) 또는 Cypress의 `cy.intercept`로 네트워크를 안정화합니다.

---

**지난 글:** [Playwright vs Cypress — E2E 테스트 프레임워크 완전 비교](/posts/test-playwright-cypress/)

**다음 글:** [Mock 전략 — Fake·Stub·Spy·Mock 완전 정리](/posts/test-mocking-strategies/)

<br>
읽어주셔서 감사합니다. 😊
