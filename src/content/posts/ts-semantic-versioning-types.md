---
title: "타입과 시맨틱 버저닝"
description: "타입 변경도 사용자 코드를 깨뜨리면 호환성 깨짐(breaking change)이다. 어떤 타입 변경이 메이저이고 어떤 것이 마이너인지, TypeScript 컴파일러 버전 자체가 호환 표면이 되는 이유, peerDependencies와 버전 매트릭스 테스트까지 라이브러리 유지보수 관점에서 정리한다."
author: "PALDYN Team"
pubDate: "2026-06-19"
archiveOrder: 5
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "SemVer", "버저닝", "라이브러리", "호환성"]
featured: false
draft: false
---

[지난 글](/posts/ts-publishing-typed-library/)에서 타입을 포함한 라이브러리를 배포하는 설정을 다뤘다. 그런데 배포는 한 번으로 끝나지 않는다. 라이브러리는 계속 버전이 올라가고, 그때마다 우리는 "이게 메이저인가 마이너인가"를 판단해야 한다. 자바스크립트 라이브러리라면 런타임 동작만 보면 되지만, 타입이 있는 라이브러리는 **타입 변경도 호환성 깨짐이 될 수 있다.** 사용자의 코드는 런타임뿐 아니라 컴파일 타임에도 깨질 수 있기 때문이다.

## 타입 변경도 깨짐이 될 수 있다

시맨틱 버저닝의 정의는 단순하다. 사용자 코드를 깨뜨리면 메이저, 기능 추가는 마이너, 버그 수정은 패치다. 핵심은 타입에서 "깨뜨린다"가 곧 "기존에 통과하던 사용자 코드가 이제 컴파일 에러를 낸다"를 뜻한다는 점이다.

![어떤 타입 변경이 깨짐인가](/assets/posts/ts-semantic-versioning-types-changes.svg)

여기서 변성(variance)에 대한 직관이 그대로 적용된다. **매개변수 타입을 좁히면 깨짐**이다. 예전엔 `string | number`를 받던 함수가 이제 `string`만 받으면, `number`를 넘기던 사용자 코드가 에러난다. 반대로 **매개변수 타입을 넓히는 것은 안전**하다. 더 많은 입력을 받게 되니 기존 호출은 그대로 통과한다.

```typescript
// v1
export function format(value: string | number): string;

// v2 — 매개변수 좁힘 = 메이저 (number 넘기던 코드가 깨짐)
export function format(value: string): string;

// v2' — 매개변수 넓힘 = 마이너 (안전)
export function format(value: string | number | boolean): string;
```

반환 타입은 정반대다. **반환 타입을 넓히면 깨짐**이다. `User`를 반환하던 함수가 `User | null`을 반환하면, 반환값을 곧장 쓰던 사용자 코드가 "null일 수 있다"는 에러를 만난다. 반환 타입을 좁히는 것은 안전하다.

## 필드와 export

객체 타입도 같은 원리다. **필수 필드를 추가하면 깨짐**이다. 그 타입의 객체를 직접 만들던 사용자가 새 필드를 채우지 않으면 에러나기 때문이다. 반면 **선택 필드(`?:`) 추가는 안전**하다.

```typescript
// v1
export interface Options {
  timeout: number;
}

// v2 — 필수 필드 추가 = 메이저
export interface Options {
  timeout: number;
  retries: number;   // 기존 사용자가 안 채움 → 에러
}

// v2' — 선택 필드 추가 = 마이너 (안전)
export interface Options {
  timeout: number;
  retries?: number;
}
```

공개 export를 제거하거나 이름을 바꾸는 것, 유니온에서 멤버를 빼는 것, 오버로드 시그니처를 지우는 것 모두 메이저다. 반대로 새 export 추가, 유니온 멤버 추가(대개), 오버로드 추가는 마이너다. 유니온 멤버 추가가 "대개"인 이유는, 사용자가 소진 검사(exhaustiveness check)를 하고 있었다면 새 멤버가 그 `switch`를 깨뜨릴 수 있어서다. 그래서 엄밀히는 "사용자가 어떻게 쓰느냐"에 따라 경계가 미묘해진다.

## 컴파일러 버전도 호환 표면이다

여기서 한 가지 함정이 있다. **TypeScript 컴파일러 자체는 시맨틱 버저닝을 따르지 않는다.** TS 팀은 마이너 릴리스(예: 5.3 → 5.4)에서도 타입 검사 동작을 바꿀 수 있다고 명시한다. 즉 내가 코드를 바꾸지 않아도, 사용자가 TS 버전을 올리는 것만으로 내 라이브러리 타입이 다르게 동작할 수 있다.

![컴파일러 버전도 호환 표면](/assets/posts/ts-semantic-versioning-types-compiler.svg)

또 하나, 새 TypeScript 문법(예: `satisfies`, `const` 타입 매개변수)을 `.d.ts`에 쓰면 구버전 컴파일러를 쓰는 사용자가 그 선언을 읽지 못한다. 그래서 라이브러리는 지원하는 TS 버전 범위를 명시하는 편이 좋다.

```json
{
  "peerDependencies": {
    "typescript": ">=5.0"
  },
  "peerDependenciesMeta": {
    "typescript": { "optional": true }
  }
}
```

더 적극적으로는, 구버전 TS 사용자에게 다른 `.d.ts`를 내려보내는 `typesVersions` 필드도 있다. 다만 이건 유지보수 비용이 크므로, 보통은 지원 하한선을 정해 두고 CI에서 여러 TS 버전을 매트릭스로 돌려 회귀를 잡는 편이 현실적이다.

```yaml
# CI: 여러 TypeScript 버전에서 타입 검사
strategy:
  matrix:
    typescript: ["5.0", "5.4", "latest"]
```

## 의존성 타입의 전파

마지막으로, 내가 의존하는 라이브러리의 타입 변경이 내 공개 API로 전파될 수 있다는 점도 기억해야 한다. 어떤 의존성의 타입을 내 함수 시그니처가 그대로 노출하고 있다면, 그 의존성이 메이저를 올릴 때 내 라이브러리도 영향을 받는다. 이런 전파를 막으려면 의존성의 타입을 직접 노출하지 말고 내 타입으로 한 겹 감싸는 것이 안전하다.

## 정리

타입 라이브러리의 버저닝은 "사용자 코드가 컴파일 타임에 깨지는가"가 기준이다. **매개변수 좁힘·반환 타입 넓힘·필수 필드 추가·export 제거는 메이저, 그 반대 방향은 대체로 마이너다.** 또한 TypeScript 컴파일러 자체가 마이너에서도 동작을 바꿀 수 있으므로 지원 버전 범위를 `peerDependencies`로 명시하고, 여러 TS 버전을 CI 매트릭스로 검증하면 안정적인 라이브러리를 유지할 수 있다. 다음 글에서는 시야를 바꿔, 기존 자바스크립트 코드베이스를 TypeScript로 옮기는 마이그레이션 전략을 다룬다.

---

**지난 글:** [타입을 포함한 라이브러리 배포하기](/posts/ts-publishing-typed-library/)

**다음 글:** [TypeScript 마이그레이션 전략](/posts/ts-migration-strategy/)

<br>
읽어주셔서 감사합니다. 😊
