---
title: "Mock 전략 — Fake·Stub·Spy·Mock 완전 정리"
description: "테스트 더블 유형(Dummy, Fake, Stub, Spy, Mock)의 정의와 차이, 단위/통합 테스트에서 모킹 경계 설정, 과도한 모킹의 문제점과 실전 전략을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Mock", "Stub", "Spy", "Fake", "테스트더블", "단위테스트", "vi.fn"]
featured: false
draft: false
---

[지난 글](/posts/test-pyramid/)에서 테스트 피라미드와 계층별 전략을 살펴봤습니다. 이번에는 **테스트 더블(Test Double)**을 다룹니다. 테스트 더블은 Gerard Meszaros의 책 *xUnit Test Patterns*에서 정리된 개념으로, 영화에서 위험한 장면을 대신하는 스턴트 더블에서 이름을 빌렸습니다. 테스트에서 실제 의존성 대신 사용하는 모든 대체물을 통칭합니다.

---

## 5가지 테스트 더블 유형

![테스트 더블 — 5가지 유형 비교](/assets/posts/test-mocking-strategies-types.svg)

### Dummy

자리를 채우기 위해 전달되지만 실제로 사용되지 않는 객체입니다.

```typescript
// logger는 이 테스트에서 호출되지 않음 — null로 충분
function createUser(name: string, logger: Logger | null) {
  if (!name) throw new Error('name required')
  return { name }
}
it('빈 이름은 에러', () => {
  expect(() => createUser('', null)).toThrow()
})
```

### Fake

실제로 동작하지만 프로덕션에는 적합하지 않은 가벼운 구현체입니다. 인메모리 데이터베이스, 인메모리 이메일 큐 등이 대표적입니다.

```typescript
class InMemoryUserRepository implements UserRepository {
  private users = new Map<string, User>()

  async save(user: User): Promise<void> {
    this.users.set(user.id, user)
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null
  }
}
```

Fake는 실제 인터페이스를 구현하므로, DB 연결 없이도 서비스 로직을 통합 수준에서 테스트할 수 있습니다.

### Stub

미리 프로그래밍된 값을 반환하는 단순한 대체물입니다. 호출 여부나 횟수를 검증하지 않고, 의존성의 간접 입력(반환값)을 제어하는 것이 목적입니다.

```typescript
// Vitest
const weatherStub = vi.fn().mockResolvedValue({ temp: 23, condition: 'sunny' })
// 입력과 무관하게 항상 같은 값 반환
const weatherStub2 = vi.fn()
  .mockResolvedValueOnce({ temp: 10 })  // 첫 번째 호출
  .mockResolvedValueOnce({ temp: 30 })  // 두 번째 호출
  .mockResolvedValue({ temp: 20 })      // 이후 모든 호출
```

### Spy

실제 동작을 그대로 수행하면서 호출 정보를 기록합니다. 호출 횟수, 전달된 인수, 반환값 등을 사후에 검증할 수 있습니다.

```typescript
import * as emailModule from './email'

const sendSpy = vi.spyOn(emailModule, 'sendEmail')
// 기본: 실제 sendEmail 실행 + 호출 기록
// 필요 시 구현 오버라이드:
sendSpy.mockImplementation(async () => ({ messageId: 'test-123' }))

await registerUser({ email: 'alice@test.com' })

expect(sendSpy).toHaveBeenCalledOnce()
expect(sendSpy).toHaveBeenCalledWith(
  expect.objectContaining({ to: 'alice@test.com' })
)
```

### Mock

Stub + Spy를 결합한 것입니다. 반환값을 제어하면서 동시에 호출 여부를 사전 기대(expectation)로 설정합니다. 일상에서 "목을 만든다"고 할 때 보통 이 의미입니다.

---

## vi.fn()과 vi.mock() 활용

```typescript
// vi.fn(): 함수 수준 목
const notifyFn = vi.fn<[string], Promise<void>>()
notifyFn.mockResolvedValue(undefined)

await processOrder({ id: 1 }, notifyFn)

expect(notifyFn).toHaveBeenCalledTimes(1)
expect(notifyFn).toHaveBeenCalledWith('주문 #1 처리 완료')

// vi.mock(): 모듈 수준 목 (파일 최상단으로 hoisting)
vi.mock('./analytics', () => ({
  track: vi.fn(),
  identify: vi.fn(),
}))

// 부분 목: 실제 구현의 일부만 대체
vi.mock('./config', async (importActual) => {
  const actual = await importActual<typeof import('./config')>()
  return { ...actual, API_URL: 'http://localhost:3001' }
})
```

---

![Mock 전략 코드 패턴](/assets/posts/test-mocking-strategies-code.svg)

---

## 모킹 경계: 어디를 목해야 하나

가장 중요한 질문은 "어디에 목을 놓을까"입니다.

```
[테스트 대상 코드] → [목 경계] → [실제 외부 의존성]
                              → HTTP API
                              → Database
                              → File System
                              → Email/SMS
                              → Timer/Date
```

**경계는 시스템 경계(I/O)에 놓아야 합니다.** 같은 모듈 안의 내부 함수를 목하면 구현 세부사항에 의존하게 되어 리팩토링 때마다 테스트가 깨집니다.

```typescript
// 나쁜 예: 내부 함수 목
vi.spyOn(userService, '_validateEmail') // private 메서드 목 → 구현 노출
vi.spyOn(userService, 'hashPassword')   // 내부 로직 목

// 좋은 예: I/O 경계만 목
vi.mock('./db')                          // DB 드라이버
vi.mock('./http-client')                 // HTTP 클라이언트
vi.spyOn(global, 'fetch')               // fetch API
```

---

## 과도한 모킹의 신호

- 테스트 setup 코드가 비즈니스 로직 코드보다 길다
- `vi.mock()`이 한 파일에 5개 이상이다
- 리팩토링할 때마다 목 설정도 수정해야 한다
- 테스트가 통과해도 실제 동작이 불안하다

과도한 모킹은 테스트를 구현 세부사항의 거울로 만들어 "테스트가 있지만 신뢰하기 어려운" 상태를 만듭니다. 이때는 통합 테스트나 Fake 객체로 교체를 고려합니다.

---

## MSW로 HTTP 경계 목킹

네트워크 레이어를 목킹할 때는 `fetch`를 직접 목하기보다 MSW(Mock Service Worker)를 사용하면 더 현실적입니다.

```typescript
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  http.get('https://api.example.com/users/:id', ({ params }) => {
    return HttpResponse.json({ id: params.id, name: 'Alice' })
  })
)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

MSW는 실제 `fetch`/`axios` 호출을 인터셉트하므로 어떤 HTTP 클라이언트를 사용해도 동일하게 목킹됩니다.

---

**지난 글:** [테스트 피라미드 — 전략적 테스트 포트폴리오 구성](/posts/test-pyramid/)

**다음 글:** [스냅샷 테스트의 함정 — 올바른 활용 패턴](/posts/test-snapshot-pitfalls/)

<br>
읽어주셔서 감사합니다. 😊
