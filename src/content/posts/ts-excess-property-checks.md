---
title: "초과 프로퍼티 검사 — 객체 리터럴의 엄격한 검사"
description: "TypeScript 초과 프로퍼티 검사(Excess Property Checks)의 발동 조건, 변수 경유 우회, 인덱스 시그니처 해결법, 실무 주의점을 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "초과프로퍼티검사", "excess property", "객체리터럴", "타입체크", "TS2345"]
featured: false
draft: false
---

[지난 글](/posts/ts-nominal-branded-types/)에서 브랜드 타입을 살펴봤다. 이번에는 TypeScript의 **초과 프로퍼티 검사(Excess Property Checks)**를 다룬다. 구조적 타이핑에 추가된 특별한 검사로, 객체 리터럴을 직접 할당할 때만 작동하는 엄격한 타입 검사다.

## 구조적 타이핑과의 차이

구조적 타이핑만 있으면 추가 필드가 있어도 할당이 가능하다. 그런데 TypeScript는 **객체 리터럴을 직접 할당할 때** 초과 프로퍼티가 있으면 오류를 낸다.

```typescript
interface Config {
  host: string;
  port: number;
}

// 오류 — 객체 리터럴 직접 할당
const c: Config = {
  host: "localhost",
  port: 3000,
  timeout: 5000, // TS2353 ❌ Config에 없는 프로퍼티
};

// OK — 변수 경유 (구조적 타이핑만 적용)
const opts = { host: "localhost", port: 3000, timeout: 5000 };
const c2: Config = opts; // ✅
```

![초과 프로퍼티 검사 발동 조건](/assets/posts/ts-excess-property-checks-trigger.svg)

## 왜 이런 구분이 있는가

객체 리터럴은 대부분 "새로 만든 값을 특정 타입에 맞춰 넣는다"는 의도다. 이때 오타나 잘못된 필드 이름을 잡아내는 것이 실용적이다.

```typescript
// 이런 오타를 잡기 위해
fetchUser({ usrId: "123" }); // TS2353 ❌ — userId가 맞음
```

반면 변수를 경유하면 "이미 다른 용도로 만든 객체를 재사용한다"는 의도일 가능성이 높으므로 구조적 타이핑만 적용한다.

## 발동 조건 정리

초과 프로퍼티 검사가 발동하는 경우:
- 타입 주석이 있는 변수에 객체 리터럴 직접 할당
- 함수 호출 시 인수 자리에 객체 리터럴 사용
- `return` 문에서 객체 리터럴 반환 (반환 타입 주석이 있을 때)

발동하지 않는 경우:
- 변수에 객체를 담은 뒤 할당 (변수 경유)
- `as` 타입 단언 사용
- 인터페이스에 인덱스 시그니처가 있을 때

## 우회 방법과 언제 써야 하나

![초과 프로퍼티 우회 방법](/assets/posts/ts-excess-property-checks-bypass.svg)

```typescript
// 1. 변수 경유 (가장 흔한 방법)
const opts = { host: "x", port: 80, timeout: 5 };
setup(opts); // OK ✅

// 2. 타입 단언 (as) — 마지막 수단
setup({ host: "x", port: 80, timeout: 5 } as Config); // OK, 주의 필요

// 3. 인덱스 시그니처로 추가 필드 허용
interface FlexibleConfig {
  host: string;
  port: number;
  [key: string]: unknown; // 추가 필드 허용
}
```

타입 단언(`as`)은 진짜 오류도 숨길 수 있으므로 마지막 수단으로만 사용해야 한다. 변수 경유나 인터페이스 수정이 더 명시적이다.

## 실무 패턴: 옵션 백

함수 옵션을 선언할 때 `Partial`과 함께 쓰면 편리하다.

```typescript
interface RequestOptions {
  timeout:  number;
  retries:  number;
  headers?: Record<string, string>;
}

function request(url: string, options: Partial<RequestOptions> = {}) {
  const merged: RequestOptions = {
    timeout: 5000,
    retries: 3,
    ...options,
  };
  // ...
}

// 초과 프로퍼티 검사가 오타를 잡아줌
request("/api/users", { timout: 1000 }); // TS2353 ❌ timeout이 맞음
```

## 핵심 정리

초과 프로퍼티 검사는 구조적 타이핑에 추가된 실용적 안전망이다. 오타나 잘못된 옵션 이름을 컴파일 타임에 잡아준다. 오류가 뜰 때는 "정말 이 필드가 필요한가?"를 먼저 확인하자. 필요하다면 인터페이스에 추가하거나 인덱스 시그니처를 검토하는 것이 `as` 우회보다 낫다.

---

**지난 글:** [명목적 타입과 브랜드 타입 — 의미 있는 타입 구분](/posts/ts-nominal-branded-types/)

**다음 글:** [매핑 타입 — keyof와 in으로 타입 변환](/posts/ts-mapped-types/)

<br>
읽어주셔서 감사합니다. 😊
