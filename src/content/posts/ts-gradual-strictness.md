---
title: "점진적으로 strict 강화하기"
description: "strict: true를 한 번에 켜는 대신, 안에 든 플래그를 하나씩 켜며 타입을 단단히 하는 법을 다룬다. noImplicitAny부터 strictNullChecks까지 권장 활성화 순서, overrides로 파일·디렉터리별 적용, type-coverage를 이용한 래칫 전략으로 후퇴를 막는 방법을 정리한다."
author: "PALDYN Team"
pubDate: "2026-06-19"
archiveOrder: 9
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "strict", "tsconfig", "마이그레이션", "타입 안전성"]
featured: false
draft: false
---

[지난 글](/posts/ts-jsdoc-typing/)에서 JSDoc으로 자바스크립트에 타입을 입히는 법을 봤다. `.ts`로 옮긴 뒤든, JSDoc으로 검사를 켠 뒤든, 결국 우리가 향하는 목적지는 `strict: true`다. 그런데 큰 코드베이스에서 `strict`를 갑자기 켜면 에러 수천 개가 한꺼번에 쏟아진다. 다행히 `strict`는 단일 스위치가 아니라 여러 플래그의 묶음이라서, 그 안의 플래그를 하나씩 켜며 점진적으로 다가갈 수 있다. 이번 글은 그 순서와 전략을 다룬다.

## strict는 여러 플래그의 묶음

`strict: true`는 그 자체로 검사를 하는 게 아니라, 여러 개별 플래그를 한꺼번에 켜는 메타 옵션이다. 핵심 구성원은 `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, `alwaysStrict`, `useUnknownInCatchVariables` 등이다.

![strict가 켜는 플래그들](/assets/posts/ts-gradual-strictness-flags.svg)

핵심 통찰은, 이 플래그들을 `strict: false` 상태에서 **개별적으로** 켤 수 있다는 점이다. 즉 한 번에 하나의 검사만 활성화하고, 그 검사가 드러낸 에러만 집중적으로 정리한 뒤 커밋하는 사이클을 반복할 수 있다.

```json
{
  "compilerOptions": {
    "strict": false,
    "noImplicitAny": true
  }
}
```

## 권장 활성화 순서

플래그를 켜는 순서는 "영향이 크고 가치가 높은 것부터"가 원칙이다.

가장 먼저 **`noImplicitAny`**다. 타입을 추론할 수 없어 조용히 `any`가 되던 곳을 모두 에러로 드러낸다. 이걸 닫아야 비로소 "타입이 새는 구멍"이 막히므로 출발점으로 적합하다. 영향 범위가 가장 넓어 에러가 많이 나오지만, 매개변수에 타입을 다는 단순 작업이 대부분이라 정리가 직관적이다.

```typescript
// noImplicitAny 켜기 전: param은 암묵적 any
function handle(param) { return param.value; }

// 켠 후: 타입을 명시해야 한다
function handle(param: { value: string }) { return param.value; }
```

다음은 **`strictNullChecks`**다. 실무 버그를 가장 많이 잡아주는 플래그다. 이전까지 `null`과 `undefined`는 모든 타입에 슬쩍 들어갈 수 있었지만, 이 플래그를 켜면 타입에 명시적으로 포함해야 한다. "혹시 null일 수 있는 값을 그냥 썼다"는 가장 흔한 런타임 에러가 컴파일 타임으로 올라온다.

```typescript
// strictNullChecks 켠 후
function len(s: string | null): number {
  return s.length; // ❌ s가 null일 수 있음
  return s?.length ?? 0; // ✅ 좁히고 처리
}
```

그다음 `strictFunctionTypes`, `strictPropertyInitialization` 등을 켠다. 이들은 보통 에러 수가 적어, 앞의 둘을 정리한 뒤라면 한꺼번에 켜도 부담이 작다. 마지막으로 모든 플래그가 켜졌으면 `strict: true`로 바꾸고 개별 플래그 줄을 지운다(중복 제거).

## 파일·디렉터리별로 적용

전역으로 한 번에 켜기가 부담스러우면, **새 코드부터 strict를 적용**하고 레거시는 점진적으로 따라오게 하는 방법이 있다. 같은 프로젝트 안에서 영역별로 다른 엄격함을 적용하려면 별도의 tsconfig를 디렉터리에 두고 확장하거나, 도구의 override를 쓴다.

```json
// src/new-module/tsconfig.json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "strict": true
  }
}
```

이렇게 하면 "새로 작성하는 모듈은 처음부터 strict, 레거시는 느슨하게" 같은 경계를 만들 수 있다. 핵심은 **새 코드가 절대 느슨한 영역에 추가되지 않도록** 경계를 분명히 하는 것이다.

## 래칫으로 후퇴 막기

점진적 강화의 가장 큰 적은 "후퇴"다. 어렵게 strict로 만든 파일에 누군가 다시 `any`를 들이거나, 느슨한 영역이 다시 커지는 것이다. 이를 막는 것이 **래칫(ratchet)** 전략, 즉 엄격함이 한 방향으로만 움직이게 만드는 가드다.

![래칫 전략](/assets/posts/ts-gradual-strictness-ratchet.svg)

`type-coverage` 같은 도구는 코드베이스에서 타입이 정확히 잡힌 식별자의 비율을 % 로 측정한다. CI에서 이 비율의 **하한선**을 강제하면, 커버리지를 떨어뜨리는 PR은 막힌다. 처음엔 현재 수치를 하한으로 잡고, 개선될 때마다 하한을 조금씩 올리면 절대 후퇴하지 않는다.

```bash
# 타입 커버리지 측정과 하한 강제
npx type-coverage --at-least 95 --strict

# CI에서 이 명령이 실패하면 PR 차단
```

`tsc --noImplicitAny`만 별도로 돌리거나, ESLint의 `no-explicit-any` 규칙을 점진적으로 에러로 올리는 것도 같은 래칫 효과를 낸다.

## 정리

`strict`는 한 번에 켜는 스위치가 아니라 점진적으로 다가가는 목적지다. **`noImplicitAny`로 시작해 `strictNullChecks`로 가장 많은 버그를 잡고, 나머지 플래그를 정리한 뒤 `strict: true`로 통합한다.** 새 코드부터 strict를 적용하고, `type-coverage` 같은 래칫으로 CI에서 후퇴를 막으면, 거대한 코드베이스도 멈춤 없이 점점 더 안전해진다. 다음 글에서는 이 과정의 마지막 관문, 코드에 남은 `any`를 체계적으로 제거하는 법을 다룬다.

---

**지난 글:** [JSDoc으로 타입 작성하기](/posts/ts-jsdoc-typing/)

**다음 글:** [any를 체계적으로 제거하기](/posts/ts-any-elimination/)

<br>
읽어주셔서 감사합니다. 😊
