---
title: "Vitest — Vite 네이티브 테스트 러너 완전 정복"
description: "Vitest의 Vite 기반 HMR 아키텍처, Jest 호환 API, 워크스페이스 설정, 컴포넌트 테스트, vi.fn() 타입 안전 목, 브라우저 모드까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Vitest", "테스트", "Vite", "HMR", "단위테스트", "TypeScript", "목킹"]
featured: false
draft: false
---

[지난 글](/posts/test-jest/)에서 Jest의 격리 아키텍처와 모킹 시스템을 살펴봤습니다. 이번에는 **Vitest**를 다룹니다. Vitest는 Vite 생태계를 위해 설계된 테스트 프레임워크로, Vite의 변환 파이프라인을 재사용해 별도 트랜스파일 설정 없이 TypeScript·JSX를 즉시 처리합니다. Jest와 API가 거의 동일해 마이그레이션 비용이 적고, HMR 기반 모듈 추적 덕분에 변경된 파일만 재실행하는 watch 모드가 빠릅니다.

---

## 왜 Vitest인가

Jest는 Node.js CommonJS 환경 기반으로 설계되어, ESM 프로젝트나 Vite 기반 앱에서는 별도의 `babel-jest` 또는 `ts-jest`, `@swc/jest` 설정이 필요합니다. 설정 파일이 `jest.config.ts`, `babel.config.js`, `tsconfig.json` 여러 곳에 흩어지고, 프로젝트 빌드 설정(`vite.config.ts`)과 테스트 설정이 따로 유지됩니다.

Vitest는 이 문제를 근본적으로 해결합니다. `vite.config.ts`에 `test` 블록 하나를 추가하면 Vite 플러그인(SWC, Vue, React, Svelte 등)이 테스트 환경에도 그대로 적용됩니다. 테스트 파일에서 `.vue`, `.svelte`, `.tsx` 임포트가 별도 트랜스파일러 없이 동작합니다.

![Vitest 실행 파이프라인](/assets/posts/test-vitest-architecture.svg)

---

## 설치와 기본 설정

```bash
# Vite 프로젝트 기준
npm install -D vitest @vitest/coverage-v8 jsdom
# 또는 React 컴포넌트 테스트가 필요하면
npm install -D @vitest/ui @testing-library/react @testing-library/jest-dom
```

`vitest.config.ts`를 별도로 만들거나, 기존 `vite.config.ts`에 통합할 수 있습니다.

```typescript
// vitest.config.ts (별도 파일)
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,          // describe/it/expect 전역 등록 (Jest 동작과 동일)
    environment: 'jsdom',   // 'node' | 'jsdom' | 'happy-dom' | 'edge-runtime'
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',       // 'v8' | 'istanbul'
      reporter: ['text', 'html', 'lcov'],
      thresholds: { lines: 80, branches: 70 },
    },
  },
})
```

`globals: true`를 사용하면 `describe`, `it`, `expect`, `vi`를 각 파일마다 import 없이 사용할 수 있습니다. 단, TypeScript 타입을 위해 `tsconfig.json`의 `types`에 `"vitest/globals"`를 추가해야 합니다.

---

## 테스트 작성 — Jest와 동일한 패턴

Vitest의 API는 Jest와 거의 동일합니다. 기존 Jest 테스트를 import 경로만 바꿔(`'jest'` → `'vitest'`) 사용할 수 있습니다.

```typescript
// user.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fetchUser } from './user'
import * as api from './api'

describe('fetchUser', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('사용자 정보를 반환한다', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ id: 1, name: 'Alice' })
    const user = await fetchUser(1)
    expect(user.name).toBe('Alice')
    expect(api.get).toHaveBeenCalledWith('/users/1')
  })

  it('실패 시 에러를 던진다', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new Error('404'))
    await expect(fetchUser(999)).rejects.toThrow('404')
  })
})
```

생명주기 훅(`beforeAll`, `afterAll`, `beforeEach`, `afterEach`)과 `describe.skip`, `it.only`, `it.todo`도 Jest와 동일합니다.

---

## vi — Vitest 목 유틸리티

Jest의 `jest` 전역 객체에 대응하는 것이 `vi`입니다.

```typescript
import { vi } from 'vitest'

// 함수 목
const mockFn = vi.fn<[number, number], number>()
mockFn.mockReturnValue(42)
mockFn.mockImplementationOnce((a, b) => a + b)

// 모듈 자동 목 (파일 상단에 선언, hoisting됨)
vi.mock('./auth', () => ({
  login: vi.fn().mockResolvedValue({ token: 'abc' }),
}))

// 타이머 제어
vi.useFakeTimers()
vi.advanceTimersByTime(1000)
vi.useRealTimers()

// 환경 변수 스텁
vi.stubEnv('NODE_ENV', 'test')
vi.unstubAllEnvs()
```

`vi.mock()`은 Jest의 `jest.mock()`과 마찬가지로 파일 최상단으로 호이스팅됩니다. `vi.importActual()`로 실제 모듈의 일부만 목할 수 있습니다.

---

## 인라인 스냅샷과 타입 검증

```typescript
it('결과를 스냅샷으로 검증한다', () => {
  expect(transform({ id: 1 })).toMatchInlineSnapshot(`
    {
      "id": 1,
      "slug": "item-1",
    }
  `)
})

// 타입 수준 검증 (expectTypeOf)
import { expectTypeOf } from 'vitest'
expectTypeOf(fetchUser).returns.toEqualTypeOf<Promise<User>>()
```

`expectTypeOf`는 TypeScript 타입을 런타임이 아닌 컴파일 타임에 검증하는 Vitest 고유 기능입니다. 제네릭 함수의 반환 타입, 유니언 타입 등을 확인할 때 유용합니다.

---

## 모노레포 워크스페이스 설정

```typescript
// vitest.workspace.ts
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'packages/core',     // 각 패키지의 vite.config.ts 자동 탐색
  'packages/ui',
  {
    extends: './vitest.config.ts',
    test: {
      name: 'browser',
      environment: 'happy-dom',
      include: ['packages/ui/**/*.test.tsx'],
    },
  },
])
```

워크스페이스 모드에서 `vitest --project=core`로 특정 패키지만 실행할 수 있습니다.

---

## watch 모드와 UI

```bash
vitest              # watch 모드 (기본)
vitest run          # CI용 단일 실행
vitest --coverage   # 커버리지 포함
npx vitest --ui     # 브라우저 기반 UI 리포트 (포트 51204)
```

watch 모드는 변경된 파일과 관련 테스트만 재실행합니다. Vite의 모듈 그래프를 활용해 어떤 테스트가 영향을 받는지 파악하므로, 대형 프로젝트에서도 빠른 피드백이 가능합니다.

![Vitest 설정과 테스트 코드](/assets/posts/test-vitest-config.svg)

---

## Jest와의 마이그레이션 포인트

| 항목 | Jest | Vitest |
|------|------|--------|
| 목 유틸 | `jest.fn()` | `vi.fn()` |
| 타이머 | `jest.useFakeTimers()` | `vi.useFakeTimers()` |
| 스파이 | `jest.spyOn()` | `vi.spyOn()` |
| 모듈 목 | `jest.mock()` | `vi.mock()` |
| 환경 변수 | `process.env.X = ...` | `vi.stubEnv('X', ...)` |
| 커버리지 | `--coverage` (istanbul) | `--coverage` (v8/istanbul 선택) |
| 설정 파일 | `jest.config.ts` | `vitest.config.ts` / `vite.config.ts` |

대부분의 Jest 코드는 import 경로만 변경하면 Vitest에서 그대로 동작합니다. `jest.resetModules()` 대신 `vi.resetModules()`, `jest.clearMocks()` 대신 `vi.clearAllMocks()`를 사용합니다.

---

**지난 글:** [Jest — JavaScript 테스트 프레임워크 완전 정복](/posts/test-jest/)

**다음 글:** [Mocha + Chai — 유연한 클래식 테스트 스택](/posts/test-mocha-chai/)

<br>
읽어주셔서 감사합니다. 😊
