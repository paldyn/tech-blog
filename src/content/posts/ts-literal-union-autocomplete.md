---
title: "리터럴 유니온 자동완성 — string & {} 패턴"
description: "string 리터럴 유니온에 자유 문자열을 허용하면서도 IDE 자동완성을 유지하는 string & {} 패턴을 설명합니다. 왜 단순 union에서는 추천이 사라지는지, LooseAutocomplete 헬퍼와 satisfies 활용까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 6
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "리터럴타입", "유니온", "자동완성", "DX", "satisfies"]
featured: false
draft: false
---

[지난 글](/posts/ts-union-to-intersection/)에서 유니온을 인터섹션으로 바꾸는 타입을 다뤘다. 이번에는 라이브러리 API를 설계할 때 마주치는 아주 실용적인 문제를 푼다. **"미리 정의한 값은 자동완성으로 추천하되, 그 외 문자열도 허용하고 싶다"**는 요구다. 단순한 유니온으로는 둘 중 하나만 얻을 수 있는데, `string & {}`라는 작은 트릭으로 둘 다 만족시킬 수 있다.

## 문제: string을 더하면 추천이 사라진다

CSS 색상이나 컴포넌트 크기처럼, 추천하고 싶은 후보가 있지만 임의 값도 받아야 하는 경우가 있다. 자연스럽게 이렇게 쓴다.

```typescript
type Size = "sm" | "md" | "lg" | string;

function setSize(size: Size) { /* ... */ }
setSize(""); // 무엇을 넣어도 통과 — 하지만...
```

타입 검사는 통과하지만, 에디터에서 `setSize(`를 입력해도 `"sm"`, `"md"`, `"lg"` 추천이 **전혀 뜨지 않는다**. 이유는 단순하다. 타입스크립트는 `"sm" | "md" | "lg" | string`을 단순화(reduce)할 때, 리터럴들이 모두 `string`의 부분집합이므로 전체를 그냥 `string`으로 합쳐 버린다. 결국 타입은 `string`과 다를 바 없어지고, 리터럴 정보가 사라진다.

![리터럴 자동완성 + 자유 입력](/assets/posts/ts-literal-union-autocomplete-flow.svg)

## 해결: string & {} 로 흡수를 막는다

핵심은 `string`을 그대로 두지 않고 `string & {}`로 살짝 바꾸는 것이다. `string & {}`는 의미상 `string`과 동일한 값 집합을 갖지만, 타입스크립트의 단순화 알고리즘이 이 형태를 리터럴과 **합치지 않는다**. 그래서 리터럴들이 살아남아 자동완성에 표시된다.

```typescript
type Size = "sm" | "md" | "lg" | (string & {});

function setSize(size: Size) { /* ... */ }

setSize("md");      // ✅ 추천됨
setSize("13px");    // ✅ 자유 문자열도 허용
```

`(string & {})`는 "비어 있지 않은 객체와 교차한 string"이라는, 표면상 무의미해 보이는 표현이다. 하지만 바로 그 "구분되는 형태"라는 점이 단순화를 막아 리터럴을 보존하는 역할을 한다.

![자동완성 보존 패턴](/assets/posts/ts-literal-union-autocomplete-code.svg)

## 재사용 헬퍼: LooseAutocomplete

매번 `(string & {})`를 붙이기 번거로우니 헬퍼 타입으로 묶어 둔다. 자주 `LooseAutocomplete`라는 이름으로 알려진 패턴이다.

```typescript
type LooseAutocomplete<T extends string> = T | (string & {});

type Color = LooseAutocomplete<"red" | "green" | "blue">;

const a: Color = "red";     // 추천 + 허용
const b: Color = "#ff0000"; // 자유 입력 허용
```

`number` 버전이 필요하면 `T | (number & {})`로 같은 패턴을 적용한다. API의 옵션 값처럼 "추천은 하되 강제하지 않는" 모든 곳에 쓸 수 있다.

## satisfies와 함께 쓰기

설정 객체의 키를 자동완성하면서 값의 타입도 검증하고 싶다면, `satisfies` 연산자와 조합하면 좋다. 리터럴 추천과 타입 안전을 모두 챙긴다.

```typescript
type Theme = {
  size: LooseAutocomplete<"sm" | "md" | "lg">;
  color: LooseAutocomplete<"primary" | "danger">;
};

const config = {
  size: "md",       // 추천이 뜸
  color: "#3366ff", // 자유 입력도 OK
} satisfies Theme;

config.size; // 타입 추론은 정확히 유지됨
```

`satisfies`는 `config`가 `Theme`를 만족하는지 검사하면서도, 실제 추론 타입(`size: string`이 아니라 리터럴 `"md"`)을 좁게 보존한다. 자동완성·검증·정밀 추론을 한 번에 얻는 조합이다.

## 주의할 점

이 패턴은 어디까지나 **개발자 경험(DX)을 위한 트릭**이다. `(string & {})`가 들어가는 순간 그 타입은 사실상 모든 문자열을 받으므로, 진짜로 값을 제한하고 싶다면 단순 리터럴 유니온(`"sm" | "md" | "lg"`)을 그대로 써야 한다. "추천은 주되 제약은 두지 않는" 의도일 때만 사용하는 것이 맞다.

```typescript
// 값을 진짜 제한하려면 — 트릭 없이
type StrictSize = "sm" | "md" | "lg";

// 추천만 주고 자유 입력 허용하려면 — 트릭 사용
type LooseSize = "sm" | "md" | "lg" | (string & {});
```

작은 표현 하나로 라이브러리 사용성이 눈에 띄게 좋아진다. 많은 인기 라이브러리의 타입 정의에서 이 패턴을 발견할 수 있다. 다음 글에서는 반대 방향의 문제 — 구조가 같은 타입을 **서로 구분**하고 싶을 때 쓰는 Opaque(branded) 타입으로 넘어간다.

---

**지난 글:** [UnionToIntersection — 유니온을 인터섹션으로 변환하기](/posts/ts-union-to-intersection/)

**다음 글:** [Opaque 타입 — 구조적 타이핑에 명목성 부여하기](/posts/ts-opaque-types/)

<br>
읽어주셔서 감사합니다. 😊
