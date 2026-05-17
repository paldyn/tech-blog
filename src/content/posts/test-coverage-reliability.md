---
title: "커버리지와 테스트 신뢰성 — 숫자 너머의 품질"
description: "Statement/Branch/Function/Line 커버리지 지표, 높은 커버리지가 보장하지 않는 것, 변이 테스트(Mutation Testing), 테스트 신뢰성을 높이는 실전 전략을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "커버리지", "테스트신뢰성", "변이테스트", "MutationTesting", "Istanbul", "v8커버리지"]
featured: false
draft: false
---

[지난 글](/posts/test-snapshot-pitfalls/)에서 스냅샷 테스트의 함정을 살펴봤습니다. 이번에는 **테스트 커버리지**를 다룹니다. 커버리지 80% 이상을 강제하는 팀이 많지만, 숫자 자체가 코드 품질이나 버그 부재를 보장하지는 않습니다. 커버리지를 올바르게 이해하고 활용하는 방법을 정리합니다.

---

## 커버리지 4가지 지표

![커버리지 지표 4종](/assets/posts/test-coverage-reliability-metrics.svg)

### 커버리지 설정 및 실행

```bash
# Vitest
vitest run --coverage

# Jest
jest --coverage

# Istanbul(nyc) — Node.js 스크립트
nyc --reporter=html --reporter=text node test.js
```

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',         // 또는 'istanbul'
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 80,
        branches: 70,
        functions: 80,
        statements: 80,
      },
      exclude: ['**/*.d.ts', '**/test/**', 'coverage/**'],
    },
  },
})
```

`v8` 커버리지는 Node.js V8 엔진 내장 기능을 사용해 istanbul보다 빠릅니다. `istanbul`은 더 세밀한 보고와 넓은 호환성을 제공합니다.

---

## 높은 커버리지가 보장하지 않는 것

100% 커버리지가 있어도 다음 상황에서 버그가 숨어있을 수 있습니다.

### 어서션 없는 테스트

```typescript
// 커버리지 100%지만 실제로 아무것도 검증하지 않음
it('실행된다', () => {
  processOrder({ id: 1, amount: 100 })  // 에러 없으면 통과
  // expect 없음 → 반환값, 부작용 전혀 검증 안 됨
})
```

이런 테스트는 코드를 실행하므로 Statement/Line 커버리지를 100%로 만들지만, 실제 동작은 검증하지 않습니다.

### 경계값 누락

```typescript
function clamp(n: number, min: number, max: number): number {
  if (n < min) return min
  if (n > max) return max
  return n
}

// 커버리지는 채우지만 경계값을 테스트하지 않음
expect(clamp(5, 0, 10)).toBe(5)  // 중간값만 테스트

// 경계값 테스트 추가 필요
expect(clamp(0, 0, 10)).toBe(0)   // 하한 경계
expect(clamp(10, 0, 10)).toBe(10) // 상한 경계
expect(clamp(-1, 0, 10)).toBe(0)  // 하한 이하
expect(clamp(11, 0, 10)).toBe(10) // 상한 초과
```

---

## 변이 테스트 (Mutation Testing)

변이 테스트는 **테스트 자체의 품질**을 측정합니다. 원본 코드를 약간 변경(변이)해 테스트가 이를 감지하는지 확인합니다.

![변이 테스트](/assets/posts/test-coverage-reliability-mutation.svg)

```bash
# Stryker Mutator — JavaScript/TypeScript 변이 테스트
npm install -D @stryker-mutator/core @stryker-mutator/vitest-runner
npx stryker run
```

```javascript
// stryker.config.mjs
export default {
  testRunner: 'vitest',
  mutate: ['src/**/*.ts', '!src/**/*.test.ts'],
  reporters: ['html', 'clear-text'],
  thresholds: { high: 80, low: 60, break: null },
}
```

변이 예시: `a >= b`를 `a > b`로 변경했을 때 테스트가 실패하면 "죽은 변이(killed)", 그대로 통과하면 "살아남은 변이(survived)"입니다.

---

## 테스트 신뢰성을 높이는 전략

### 1. 경계값과 에지케이스 명시적 테스트

```typescript
describe('parseAmount', () => {
  // 정상값
  it('정수를 파싱한다', () => expect(parseAmount('100')).toBe(100))

  // 경계값
  it('0을 파싱한다', () => expect(parseAmount('0')).toBe(0))
  it('최대값을 파싱한다', () => expect(parseAmount('999999999')).toBe(999999999))

  // 에러 케이스
  it('빈 문자열은 에러', () => expect(() => parseAmount('')).toThrow())
  it('음수는 에러', () => expect(() => parseAmount('-1')).toThrow())
  it('소수점은 에러', () => expect(() => parseAmount('1.5')).toThrow())
})
```

### 2. 테스트 코드도 리뷰

"테스트 코드는 그냥 합치자"는 태도는 테스트 품질을 빠르게 저하시킵니다. 테스트 코드도 PR 리뷰에서 확인합니다.

- 어서션이 실제로 올바른 것을 검증하는가
- 테스트 이름이 실패 시 무슨 문제인지 설명하는가
- 테스트가 독립적으로 실행될 수 있는가 (순서 의존성 없는가)

### 3. 테스트를 먼저 실패시켜라

새 테스트를 작성할 때 먼저 **실패함을 확인**합니다. 처음부터 통과하는 테스트는 무언가를 잘못 검증하고 있을 가능성이 높습니다.

```typescript
// Red → Green → Refactor (TDD)
it('사용자 이름은 2자 이상이어야 한다', () => {
  // 1. 먼저 이 테스트가 실패하는지 확인
  expect(() => createUser({ name: 'A' })).toThrow('이름은 2자 이상이어야 합니다')
  // 2. 통과하도록 구현
  // 3. 리팩토링
})
```

### 4. 테스트 격리 확인

```typescript
// afterEach로 상태 리셋 확인
afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllTimers()
  cleanup()  // @testing-library/react
})

// 전역 상태 변경 테스트는 beforeEach에서 리셋
beforeEach(() => {
  store.dispatch(resetState())
})
```

---

## 커버리지 목표 설정 가이드

| 프로젝트 특성 | 권장 Branch Coverage |
|-------------|---------------------|
| 핀테크·의료·결제 | 90%+ |
| 일반 SaaS 백엔드 | 75~85% |
| 프론트엔드 앱 | 65~75% |
| 내부 도구·스크립트 | 50~65% |
| 프로토타입 | 별도 목표 없음 |

숫자보다 중요한 것은 "비즈니스 핵심 로직이 잘 테스트되어 있는가"입니다. 커버리지가 낮더라도 주요 경로가 잘 검증되어 있으면 충분히 신뢰할 수 있습니다.

---

**지난 글:** [스냅샷 테스트의 함정 — 올바른 활용 패턴](/posts/test-snapshot-pitfalls/)

**다음 글:** [ESLint 기초 — 파서·규칙·플러그인·Flat Config](/posts/lint-eslint-basics/)

<br>
읽어주셔서 감사합니다. 😊
