---
title: "Opaque 타입 — 구조적 타이핑에 명목성 부여하기"
description: "구조적 타이핑에서 string·number가 무분별하게 호환되는 문제를 brand로 막는 Opaque(branded) 타입을 설명합니다. UserId와 PostId를 구분하는 방법, 생성자 함수, unique symbol 브랜딩, 런타임 비용 0의 안전성을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-16"
archiveOrder: 7
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "Opaque", "branded", "명목타입", "구조적타이핑", "타입안전"]
featured: false
draft: false
---

[지난 글](/posts/ts-literal-union-autocomplete/)에서 자동완성을 살리는 트릭을 다뤘다. 이번에는 정반대 고민을 푼다. TypeScript는 **구조적 타이핑**을 쓰기 때문에, 모양이 같으면 같은 타입으로 취급한다. 그래서 `UserId`와 `PostId`가 둘 다 `string`이면 서로 자유롭게 섞여 버린다. 이 위험을 막아 주는 것이 Opaque(혹은 branded) 타입이다.

## 문제: string은 다 같은 string이다

타입 별칭으로 의미를 구분해도, 별칭은 그저 이름일 뿐 실제 타입은 동일하다.

```typescript
type UserId = string;
type PostId = string;

function getPost(id: PostId) { /* ... */ }

const userId: UserId = "u_123";
getPost(userId); // ❌ 막고 싶지만 — 통과해 버린다
```

`UserId`와 `PostId`는 둘 다 `string`이므로 구조적으로 완전히 호환된다. 사용자 ID를 게시물 조회에 잘못 넘겨도 컴파일러가 잡지 못한다. 이런 ID 혼용 버그는 런타임에서야 드러나고, 디버깅도 까다롭다.

![Opaque 타입으로 명목성 부여](/assets/posts/ts-opaque-types-flow.svg)

## 해결: 타입에 브랜드를 붙인다

각 타입에 **다른 타입과 구분되는 태그(brand)**를 교차(intersection)로 더한다. 값 차원에는 존재하지 않는 가짜 속성이라 런타임 비용이 없고, 타입 차원에서는 서로 호환되지 않게 만든다.

```typescript
type Brand<T, B> = T & { readonly __brand: B };

type UserId = Brand<string, "UserId">;
type PostId = Brand<string, "PostId">;

function getPost(id: PostId) { /* ... */ }

declare const userId: UserId;
getPost(userId);
// ❌ 'UserId'를 'PostId'에 할당할 수 없음 — 의도대로 차단!
```

`Brand<string, "UserId">`는 "`string`이면서 `__brand: "UserId"`를 가진 타입"이다. `__brand`의 리터럴 값이 다르므로 `UserId`와 `PostId`는 더 이상 호환되지 않는다. 동시에 둘 다 여전히 `string`이라, 길이 확인이나 비교 같은 일반 문자열 연산은 그대로 쓸 수 있다.

![Opaque(branded) 타입](/assets/posts/ts-opaque-types-code.svg)

## 생성자로 안전하게 만들기

브랜디드 값은 어떻게 만들까? `"u_123" as UserId`처럼 단언할 수도 있지만, 검증을 곁들인 **스마트 생성자**를 두면 더 안전하다. 유효성 검사를 통과한 값만 브랜드를 얻게 된다.

```typescript
function toUserId(raw: string): UserId {
  if (!/^u_\d+$/.test(raw)) {
    throw new Error(`잘못된 UserId 형식: ${raw}`);
  }
  return raw as UserId; // 검증 후에만 단언
}

const id = toUserId("u_42"); // UserId
// const bad = toUserId("42"); // 런타임에서 거부
```

이제 `UserId`를 얻는 유일한 정상 경로가 `toUserId`가 된다. 형식 검증과 타입 안전이 한곳에 묶여, "검증되지 않은 문자열이 ID로 흘러드는" 일을 막는다.

## unique symbol로 더 강하게

문자열 리터럴 브랜드는 실수로 같은 이름을 두 곳에서 쓰면 충돌할 수 있다. 더 엄격하게는 `declare const`로 만든 `unique symbol`을 브랜드 키로 쓴다. 모듈 밖에서는 절대 만들 수 없는 키라 위조가 사실상 불가능하다.

```typescript
declare const brand: unique symbol;

type Opaque<T, K> = T & { readonly [brand]: K };

type Email = Opaque<string, "Email">;
type Url = Opaque<string, "Url">;

// 외부 코드는 brand 심볼에 접근할 수 없어 위조 불가
```

`unique symbol`은 선언된 위치에서만 유효한 고유 키이므로, 같은 모양의 브랜드를 우연히 또는 의도적으로 흉내 내기 어렵다. 보안에 민감한 식별자나 토큰 타입에 적합하다.

## 언제 쓰고 언제 피할까

Opaque 타입은 강력하지만 모든 ID에 다 붙일 필요는 없다. **혼동 시 실제 피해가 큰** 값 — 사용자/계좌 ID, 통화 단위, 검증된 입력(이메일·URL), 암호화 키 등에 선택적으로 적용하는 것이 좋다. 남용하면 단언(`as`)이 코드 곳곳에 늘어나 오히려 가독성을 해친다.

```typescript
// 좋은 후보: 섞이면 위험한 식별자
type AccountId = Brand<string, "AccountId">;
type Cents = Brand<number, "Cents">; // 금액 단위 혼동 방지

// 굳이 불필요: 지역적으로만 쓰는 임시 변수
```

핵심은 "런타임 비용 0으로 구조적 타이핑에 명목성을 빌려 온다"는 것이다. 다음 글에서는 이 브랜딩을 한 단계 더 밀어붙여, 값이 아니라 **상태**를 타입으로 추적하는 Phantom 타입을 살펴본다.

---

**지난 글:** [리터럴 유니온 자동완성 — string & {} 패턴](/posts/ts-literal-union-autocomplete/)

**다음 글:** [Phantom 타입 — 타입으로만 상태를 추적하기](/posts/ts-phantom-types/)

<br>
읽어주셔서 감사합니다. 😊
