---
title: "타입을 테스트하기: expectTypeOf와 tsd"
description: "런타임 테스트가 값의 정확성을 보장한다면, 타입 테스트는 타입의 모양을 보장한다. Vitest의 expectTypeOf, tsd, @ts-expect-error를 활용해 제네릭 함수와 유틸리티 타입의 추론 결과를 컴파일 타임에 검증하는 방법을 정리한다."
author: "PALDYN Team"
pubDate: "2026-06-19"
archiveOrder: 1
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "타입 테스트", "expectTypeOf", "tsd", "테스트"]
featured: false
draft: false
---

[지난 글](/posts/ts-typing-vitest-jest/)에서 Vitest와 Jest로 런타임 동작을 검증하는 법을 다뤘다. 그런데 정교한 제네릭 함수나 유틸리티 타입을 만들다 보면, "이 함수가 5를 반환하는가"보다 "이 함수의 반환 타입이 정말 `number`인가, 혹시 `number | undefined`로 새지 않는가"가 더 중요한 순간이 온다. 값은 테스트로 잡을 수 있지만, 타입의 모양은 런타임에 존재하지 않으므로 일반 테스트로는 잡을 수 없다. 이번 글은 타입 자체를 테스트하는 도구인 `expectTypeOf`, `tsd`, 그리고 `@ts-expect-error`를 다룬다.

## 값의 테스트와 타입의 테스트

런타임 테스트와 타입 테스트는 검증하는 차원이 다르다. 런타임 테스트는 코드를 실제로 실행해 결과값이 기대와 같은지 본다. 반면 타입 테스트는 코드를 실행하지 않는다. 컴파일러가 추론한 타입이 우리가 의도한 타입과 일치하는지를, 타입 검사 단계에서 확인한다.

![런타임 테스트와 타입 테스트의 차이](/assets/posts/ts-type-testing-expect-type-runtime-vs-type.svg)

핵심 차이는 "실패가 언제 드러나는가"다. 런타임 테스트의 실패는 테스트 러너가 코드를 돌릴 때 나타나지만, 타입 테스트의 실패는 `tsc`가 타입을 검사할 때 컴파일 에러로 나타난다. 즉 타입 테스트는 사실상 "타입 에러가 나면 실패, 안 나면 성공"인 검사다. 이 단순한 원리 위에 도구들이 얹혀 있다.

## expectTypeOf로 타입 단언하기

Vitest에는 `expectTypeOf`가 내장되어 있다(별도 패키지 `expect-type`로도 쓸 수 있다). 이름이 `expect`와 비슷하지만, 받는 것은 값이 아니라 타입이고, 검사도 런타임이 아니라 컴파일 타임에 일어난다.

```typescript
import { expectTypeOf } from "vitest";

function add(a: number, b: number): number {
  return a + b;
}

expectTypeOf(add).returns.toEqualTypeOf<number>();
expectTypeOf(add).parameters.toEqualTypeOf<[number, number]>();
```

`.returns`와 `.parameters`는 함수 타입을 분해해서, 반환 타입이나 매개변수 튜플만 따로 단언하게 해 준다. 값을 전달했지만 `expectTypeOf`는 그 값을 절대 실행하지 않는다. 오로지 타입만 본다.

![expectTypeOf 매처와 @ts-expect-error](/assets/posts/ts-type-testing-expect-type-assertions.svg)

가장 자주 쓰는 두 매처는 `toEqualTypeOf`와 `toMatchTypeOf`다. 둘의 차이가 중요하다.

```typescript
type User = { id: number; name: string };

// toEqualTypeOf: 정확히 같은 타입이어야 통과
expectTypeOf<User>().toEqualTypeOf<{ id: number; name: string }>();

// toMatchTypeOf: 부분적으로 호환되면 통과 (할당 가능성)
expectTypeOf<User>().toMatchTypeOf<{ id: number }>();
```

`toEqualTypeOf`는 양방향으로 정확히 같은 타입일 때만 통과한다. 반면 `toMatchTypeOf`는 "왼쪽 타입을 오른쪽 타입에 할당할 수 있는가"를 본다. 제네릭 유틸리티의 결과를 검증할 때는 의도치 않은 넓힘이나 좁힘을 잡기 위해 `toEqualTypeOf`를 기본으로 쓰는 편이 안전하다.

## 특수 타입과 음수 테스트

`never`, `any`, `unknown` 같은 특수 타입은 일반 비교로는 다루기 까다롭다. 특히 `any`는 모든 타입과 호환되기 때문에, 무심코 타입이 `any`로 새어 나가도 `toEqualTypeOf`가 통과해 버릴 수 있다. 전용 매처가 있는 이유다.

```typescript
import { expectTypeOf } from "vitest";

// 의도적으로 never여야 하는 경우 (소진 검사 등)
expectTypeOf<never>().toBeNever();

// any로 새는 것을 막고 싶을 때
expectTypeOf<unknown>().not.toBeAny();
expectTypeOf<string>().not.toBeAny();
```

`.not`을 붙이면 부정 단언이 된다. "이 타입은 `any`가 아니어야 한다"처럼, 타입이 의도치 않게 넓어지는 회귀를 막는 가드로 쓰기 좋다.

또 하나의 중요한 도구가 `@ts-expect-error`다. 이건 "이 다음 줄에서는 타입 에러가 발생해야 정상"이라고 컴파일러에게 알리는 주석이다. 잘못된 입력을 우리 타입이 제대로 거부하는지를 검증하는 음수 테스트(negative test)에 쓴다.

```typescript
function greet(name: string): string {
  return `Hello, ${name}`;
}

// @ts-expect-error: number는 받으면 안 된다
greet(42);

// 만약 위 호출이 에러를 내지 않으면(예: name 타입을 any로 바꾸면)
// 오히려 @ts-expect-error 자체가 "불필요한 억제"로 컴파일 에러가 된다
```

`@ts-ignore`와 헷갈리지 말자. `@ts-ignore`는 에러가 있든 없든 그냥 무시하지만, `@ts-expect-error`는 에러가 *없으면* 실패한다. 그래서 테스트 용도로는 항상 `@ts-expect-error`를 써야 한다.

## tsd: 라이브러리 배포 전 타입 검증

`tsd`는 패키지의 타입 정의를 테스트하는 데 특화된 도구다. 라이브러리를 npm에 배포하기 전, `.d.ts`가 사용자에게 의도한 대로 보이는지 확인할 때 쓴다.

```typescript
import { expectType, expectError } from "tsd";
import { parseConfig } from "../index.js";

expectType<{ port: number }>(parseConfig("port=3000"));

// 인자가 빠지면 에러여야 한다
expectError(parseConfig());
```

`tsd`는 `package.json`의 `tsd` 필드나 `test-d` 디렉터리 규약을 따라 동작하며, CI에서 `tsd` 명령 하나로 타입 정의 회귀를 잡아준다. Vitest를 이미 쓰고 있다면 `expectTypeOf`로 대부분을 처리할 수 있고, 라이브러리 배포 파이프라인에서는 `tsd`가 더 잘 맞는다.

## 타입 테스트를 CI에 거는 법

타입 테스트의 실패는 컴파일 에러다. 따라서 별도의 실행 없이 타입 검사만 돌려도 검증된다. Vitest는 `vitest typecheck` 모드로 타입 단언만 모아 돌릴 수 있다.

```bash
# 타입 테스트만 별도로 실행
vitest typecheck

# 또는 전체 프로젝트 타입 검사로 한 번에
tsc --noEmit
```

`tsc --noEmit`은 `expectTypeOf`와 `@ts-expect-error`가 들어간 파일까지 전부 타입 검사하므로, 타입 테스트가 깨지면 곧바로 비정상 종료된다. CI에 `tsc --noEmit` 한 줄만 걸어도 타입 회귀의 상당수를 막을 수 있다.

## 정리

타입 테스트는 "값이 맞는가"가 아니라 "타입의 모양이 맞는가"를 검증한다. **`expectTypeOf`로 추론 결과를 단언하고, `toEqualTypeOf`와 `toMatchTypeOf`를 정확히 구분해 쓰며, `@ts-expect-error`로 잘못된 입력이 거부되는지를 음수 테스트한다.** 라이브러리를 배포한다면 `tsd`로 `.d.ts`까지 검증하면 좋다. 정교한 제네릭과 유틸리티 타입을 만들수록, 타입 테스트는 "추론이 조용히 망가지는" 가장 잡기 어려운 회귀를 컴파일 타임에 붙잡아 준다. 다음 글에서는 타입을 실제 자바스크립트로 변환하는 빌드 도구, SWC와 esbuild의 타입 처리 방식을 살펴본다.

---

**지난 글:** [Vitest와 Jest 타이핑](/posts/ts-typing-vitest-jest/)

**다음 글:** [SWC와 esbuild의 타입 처리](/posts/ts-swc-esbuild/)

<br>
읽어주셔서 감사합니다. 😊
