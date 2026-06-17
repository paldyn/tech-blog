---
title: "Vitest와 Jest 타이핑"
description: "Vitest와 Jest로 TypeScript 테스트를 작성할 때 타입을 살리는 법을 정리합니다. 전역 API 타입 설정, 제네릭 vi.fn으로 목 시그니처 보존, vi.mocked·jest.mocked로 모듈 목 타이핑, expect 매처의 타입 안전성, 비동기 단언까지 실무 관점으로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-18"
archiveOrder: 10
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "Vitest", "Jest", "테스트", "mock", "타입"]
featured: false
draft: false
---

[지난 글](/posts/ts-abortcontroller-typing/)에서 비동기 작업의 취소까지 타이핑하며 비동기 묶음을 마쳤다. 코드를 만들었으면 검증해야 한다. 이번 글은 TypeScript 프로젝트에서 가장 널리 쓰이는 테스트 러너인 Vitest와 Jest를 타입 관점에서 다룬다. 두 도구는 API가 거의 같아서(Vitest가 Jest 호환을 목표로 설계됐다), 타이핑 원리도 대부분 공유한다. 핵심은 "목(mock)도 타입을 잃지 않게 하는 것"과 "매처가 타입을 검사하게 하는 것"이다.

## 전역 API 타입부터 켜기

첫 관문은 `describe`·`it`·`expect` 같은 전역 API의 타입을 TypeScript가 인식하게 만드는 것이다. 두 도구가 방식이 조금 다르다.

![테스트 타입을 켜는 설정](/assets/posts/ts-typing-vitest-jest-setup.svg)

Vitest는 `globals: true` 설정 시 `tsconfig.json`의 `types`에 `"vitest/globals"`를 추가해야 전역 API가 잡힌다. 아니면 매 파일에서 명시적으로 import한다.

```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

```typescript
// 또는 명시적 import (globals 없이도 동작, 더 명확)
import { describe, it, expect, vi } from "vitest";
```

Jest는 `@types/jest`(또는 `@jest/globals`)를 설치하고 `ts-jest`나 babel로 TypeScript를 변환하는 구성이 일반적이다. 명시적 import 방식이 어느 쪽이든 타입 출처가 분명해서 권장된다. [tsconfig의 types](/posts/ts-tsconfig-options/)는 무엇을 전역으로 끌어올지 제어하는 핵심 옵션이라 한 번 정리해 두면 좋다.

## 목 함수의 타입을 살리기

테스트의 진짜 가치는 목에서 나온다. 그런데 타입을 신경 쓰지 않고 `vi.fn()`을 그냥 쓰면 인자와 반환이 느슨해져, 목에 엉뚱한 값을 넣어도 통과한다. 제네릭으로 시그니처를 박아두면 목도 실제 함수처럼 검사받는다.

```typescript
// 시그니처를 제네릭으로 명시
const getUser = vi.fn<(id: number) => User>();

getUser.mockReturnValue({ id: 1, name: "Kim" }); // User여야 함 — 검사됨
getUser.mockReturnValue({ id: 1 }); // ❌ name 누락 — 컴파일 에러
getUser("abc"); // ❌ id는 number — 에러
```

![타입이 살아있는 목](/assets/posts/ts-typing-vitest-jest-mock.svg)

`vi.fn<T>()`(Jest는 `jest.fn<T>()`)의 타입 인자로 함수 시그니처를 주면, `mockReturnValue`·`mockResolvedValue`에 넣는 값과 호출 인자가 모두 그 시그니처에 맞는지 검사된다. 목이 거짓말을 하지 못하게 막는 것 — 이게 타입 있는 테스트의 핵심 이점이다.

## 모듈 전체를 목으로 — vi.mocked

모듈을 통째로 목으로 대체할 때는 `vi.mock("./api")`로 자동 목을 만든 뒤, 개별 함수를 `vi.mocked()`로 감싸 타입을 복원한다. `vi.mocked`는 **실제 함수의 시그니처를 그대로 유지하면서** 목 전용 메서드(`mockReturnValue` 등)를 더해준다.

```typescript
import { getUser } from "./api";
import { vi, expect, it } from "vitest";

vi.mock("./api");

it("유저를 가져온다", () => {
  // 원래 getUser의 타입 + 목 API
  vi.mocked(getUser).mockResolvedValue({ id: 1, name: "Kim" });
  // 잘못된 형태를 넣으면 여기서 컴파일 에러
});
```

Jest에서도 `jest.mocked(getUser)`로 완전히 동일하게 동작한다. 단순히 `getUser as any`로 캐스팅하던 옛 방식과 달리, `mocked`는 타입을 보존하므로 목 설정 단계에서부터 실수를 잡는다.

## expect 매처도 타입을 본다

`expect`의 매처들도 타입 검사를 받는다. `toEqual`에 넘긴 기대값이 실제 값의 타입과 호환되는지, `toHaveLength`를 `length`가 없는 값에 쓰지 않았는지 등을 컴파일러가 본다.

```typescript
const user: User = { id: 1, name: "Kim" };

expect(user).toEqual({ id: 1, name: "Kim" }); // OK
expect(user).toEqual({ id: 1, nmae: "Kim" }); // ❌ 오타 — 타입 불일치
expect(user.name).toHaveLength(3); // OK (string)
expect(user.id).toHaveLength(3); // ❌ number엔 length 없음
```

매처가 타입을 검사한 덕분에, 테스트를 실행하기도 전에 단언문의 오타나 잘못된 기대를 잡을 수 있다. 테스트 코드 자체가 타입의 보호를 받는 것이다.

## 비동기 단언

비동기 코드를 테스트할 때는 `resolves`/`rejects`를 쓴다. 이들도 Promise의 성공 타입을 풀어 매처에 넘기므로, 기대값의 타입이 맞는지 검사된다.

```typescript
it("비동기 결과를 검증한다", async () => {
  await expect(fetchUser(1)).resolves.toEqual({ id: 1, name: "Kim" });
  await expect(fetchUser(-1)).rejects.toThrow("not found");
});
```

`resolves` 뒤의 `toEqual`은 `fetchUser`가 [Awaited](/posts/ts-awaited-utility/)로 푼 `User` 타입을 기준으로 검사한다. `await`를 빠뜨리면 단언이 실제로 기다려지지 않으니, 비동기 단언 앞의 `await`는 습관처럼 붙이는 게 좋다.

## 정리

Vitest와 Jest의 타이핑은 세 가지로 압축된다. **전역 API 타입을 `types`나 import로 켜고, 목은 제네릭 `vi.fn<T>()`·`vi.mocked()`로 시그니처를 살리며, 매처는 타입 검사를 받게 둔다.** 두 도구의 API가 거의 같아 한쪽을 익히면 다른 쪽도 자연스럽다. 타입이 살아있는 테스트는 "테스트가 실제 코드와 다른 가정을 하고 있는" 가장 흔한 버그를 컴파일 타임에 잡아준다.

이번 묶음은 React 컴포넌트 타이핑에서 출발해 Promise·비동기 이터레이터·취소를 거쳐 테스트까지, "코드를 만들고 검증하는" 전 과정을 타입으로 받쳤다. 시리즈는 다음 회차에서 빌드 도구와 라이브러리 배포로 이어진다.

---

**지난 글:** [AbortController 타이핑](/posts/ts-abortcontroller-typing/)

<br>
읽어주셔서 감사합니다. 😊
