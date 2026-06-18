---
title: "any를 체계적으로 제거하기"
description: "코드에 남은 any를 체계적으로 걷어내는 법을 다룬다. any가 유입되는 경로(JSON.parse, catch, 서드파티, 캐스팅)별 대체 전략, any 대신 unknown을 안전한 기본값으로 쓰는 이유, ESLint의 no-unsafe 규칙과 type-coverage로 재유입을 막는 가드까지 정리한다."
author: "PALDYN Team"
pubDate: "2026-06-19"
archiveOrder: 10
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "any", "unknown", "타입 안전성", "리팩터링"]
featured: false
draft: false
---

[지난 글](/posts/ts-gradual-strictness/)에서 strict 플래그를 점진적으로 켜는 법을 다뤘다. 그 과정의 마지막 관문이 바로 `any`다. `any`는 "타입 검사를 이 값에 대해 꺼라"는 명령이다. 한 군데에 `any`가 있으면, 거기서 나온 값이 흐르는 모든 경로에서 검사가 풀려 버린다. strict를 다 켜도 `any`가 곳곳에 남아 있으면 타입 안전성은 구멍이 숭숭 뚫린 채다. 이번 글은 `any`를 체계적으로 찾아내고 걷어내는 법을 다룬다.

## any가 위험한 진짜 이유

`any`의 문제는 단순히 "타입이 부정확하다"가 아니라, **전염된다**는 데 있다. `any` 값에는 어떤 속성 접근, 어떤 호출, 어떤 할당도 허용되고, 그 결과 역시 `any`가 된다. 그렇게 검사 꺼짐이 코드 곳곳으로 퍼진다.

![any 대신 unknown](/assets/posts/ts-any-elimination-any-vs-unknown.svg)

대부분의 경우 `any` 자리에 들어가야 할 더 나은 기본값은 **`unknown`**이다. `unknown`도 "타입을 모른다"를 뜻하지만, 결정적인 차이가 있다. `unknown` 값은 **무언가를 하기 전에 반드시 좁혀야** 한다. 속성 접근, 호출, 구체 타입 할당이 전부 막혀서, 사용 전에 `typeof`나 `instanceof`, 스키마 검증으로 타입을 좁히도록 강제한다.

```typescript
function process(value: unknown) {
  // value.length;        // ❌ unknown은 그냥 못 씀
  if (typeof value === "string") {
    return value.length;  // ✅ 여기선 string으로 좁혀짐
  }
  return 0;
}
```

## 유입 경로별 대체 전략

`any`는 몇 가지 정해진 경로로 코드에 들어온다. 경로마다 대응이 다르므로, 출처를 알면 고치기 쉽다.

![any가 들어오는 경로와 대체](/assets/posts/ts-any-elimination-sources.svg)

**`JSON.parse()`**의 반환 타입은 `any`다. 외부에서 온 데이터이므로 본질적으로 신뢰할 수 없다. 여기엔 `unknown`으로 받은 뒤 스키마 검증 라이브러리(zod 등)로 형태를 확인하는 것이 정석이다.

```typescript
import { z } from "zod";

const UserSchema = z.object({ id: z.number(), name: z.string() });

const raw: unknown = JSON.parse(text);
const user = UserSchema.parse(raw); // 검증 통과 후 User로 좁혀짐
```

**`catch (e)`**의 `e`는 기본적으로 `any`다(`useUnknownInCatchVariables`를 켜면 `unknown`이 된다). 던져진 것이 꼭 `Error`라는 보장이 없으므로, `instanceof`로 좁혀 다룬다.

```typescript
try {
  risky();
} catch (e) {
  if (e instanceof Error) {
    console.error(e.message); // 안전하게 좁힘
  }
}
```

**타입 없는 서드파티 라이브러리**는 `@types/패키지` 설치로 대부분 해결되고, 없으면 필요한 부분만 직접 ambient 선언을 작성한다. **`as any` 캐스팅**은 가장 노골적인 `any`이므로, 정확한 타입으로 캐스팅하거나 캐스팅 자체를 없애는 리팩터링이 필요하다.

## any를 찾아내기

제거하려면 먼저 찾아야 한다. 명시적 `any`는 검색으로 잡히지만, 무서운 건 숨은 `any`다. `as any`, 타입 없는 함수 매개변수, `any[]`, `Function`, 타입 단언 등이 그렇다.

```bash
# 명시적 any 검색
grep -rn ": any\|<any>\|as any" src

# type-coverage로 숨은 any까지 측정 (any인 식별자 위치 출력)
npx type-coverage --detail --strict
```

`type-coverage`는 단순 텍스트 검색을 넘어, 실제로 타입이 `any`로 평가되는 모든 식별자를 찾아 위치를 알려준다. `--detail`로 어디가 구멍인지 정확히 짚어 우선순위를 정할 수 있다.

## 재유입을 막는 가드

힘들게 걷어낸 `any`가 다시 스며들지 않게 하는 것이 마지막이자 가장 중요한 단계다. ESLint의 `@typescript-eslint` 규칙들이 강력한 가드가 된다.

```json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/no-unsafe-return": "error"
  }
}
```

`no-explicit-any`는 코드에 적힌 `any`를 막고, `no-unsafe-*` 계열은 `any` 값을 쓰는 행위(할당·접근·호출·반환)를 각각 막는다. 후자가 특히 중요하다. 외부 라이브러리에서 흘러든 `any`처럼 코드에 `any`라고 적혀 있지 않은데도 검사가 풀린 경우를 잡아주기 때문이다. 여기에 앞 글에서 본 `type-coverage` 하한선까지 CI에 걸면, 한번 높인 타입 안전성은 절대 후퇴하지 않는다.

```bash
# CI: any 재유입과 커버리지 후퇴를 동시에 차단
eslint src --max-warnings 0
type-coverage --at-least 98 --strict
```

## 정리

`any`는 검사를 끄는 명령이고 전염되므로, 남겨 두면 strict의 의미가 옅어진다. **대부분의 `any`는 `unknown`으로 바꿔 사용 전 좁힘을 강제하고, `JSON.parse`는 스키마 검증으로, `catch`는 `instanceof`로, 서드파티는 타입 선언으로, `as any`는 정확한 타입으로 대체한다.** `type-coverage`로 숨은 `any`까지 찾아내고, `no-explicit-any`와 `no-unsafe-*` 규칙으로 재유입을 막으면, 코드베이스의 타입 안전성을 끝까지 끌어올릴 수 있다. 마이그레이션 묶음은 여기까지다. 출발점의 느슨한 자바스크립트에서 시작해, 빌드 연결·파일 변환·strict 강화·`any` 제거를 거쳐 완전한 타입 안전성에 도달하는 전 과정을 함께 걸었다.

---

**지난 글:** [점진적으로 strict 강화하기](/posts/ts-gradual-strictness/)

<br>
읽어주셔서 감사합니다. 😊
