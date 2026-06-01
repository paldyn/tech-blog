---
title: "TypeScript 완전 정복 ⑥: TypeScript Playground와 REPL 활용"
description: "설치 없이 브라우저에서 TypeScript를 실험할 수 있는 Playground 완전 가이드. URL 공유, 버전 선택, 타입 디버깅 활용법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "Playground", "REPL", "학습도구", "타입실험"]
featured: false
draft: false
---

[지난 글](/posts/ts-compiler-tsc/)에서 `tsc` 컴파일러의 내부 동작을 살펴봤다. TypeScript를 배우는 과정에서 가장 강력한 도구 중 하나가 **TypeScript Playground**다. 설치 없이 브라우저에서 TypeScript 코드를 실행하고, 결과를 URL로 공유할 수 있다.

## TypeScript Playground란

[typescriptlang.org/play](https://www.typescriptlang.org/play)는 TypeScript 공식 사이트에서 제공하는 온라인 편집기다. 왼쪽에 TypeScript 코드를 입력하면 오른쪽에 컴파일된 JavaScript가 실시간으로 표시된다.

![TypeScript Playground 주요 기능](/assets/posts/ts-playground-repl-features.svg)

## Playground의 핵심 기능

### 1. 실시간 JS 출력 확인

```typescript
// Playground 왼쪽에 입력
type UserId = string & { readonly _brand: unique symbol };

function createUserId(id: string): UserId {
  return id as UserId;
}

const userId = createUserId("user-123");
```

오른쪽 탭에서 `JS` 탭을 선택하면 컴파일된 JavaScript를 볼 수 있다. 타입 정보가 어떻게 제거되는지 직접 확인하면 TypeScript의 동작 원리를 이해하는 데 도움이 된다.

### 2. .d.ts 탭으로 선언 파일 확인

`DTS` 탭을 클릭하면 현재 코드로부터 생성되는 타입 선언 파일을 볼 수 있다. 라이브러리를 작성할 때 소비자가 보게 될 타입이 어떻게 표현되는지 미리 확인할 수 있어 유용하다.

### 3. 타입 오류 인라인 표시

```typescript
// 오류가 있는 코드를 입력하면 즉시 빨간 밑줄
interface User {
  name: string;
  email: string;
}

const user: User = {
  name: "Alice",
  // email 필드 누락 — 오류 표시
};
```

오류 위에 마우스를 올리면 상세 오류 메시지와 오류 코드가 표시된다. 로컬 에디터 없이도 오류를 학습할 수 있다.

### 4. 마우스 오버로 타입 추론 확인

```typescript
const numbers = [1, 2, 3, 4, 5];
const doubled = numbers.map(n => n * 2);
// doubled 위에 마우스를 올리면 "number[]" 타입임을 표시
```

변수나 함수에 마우스를 올리면 TypeScript가 추론한 타입이 팝업으로 표시된다. 복잡한 제네릭 타입의 실제 추론 결과를 확인할 때 매우 유용하다.

## URL 공유 기능

Playground의 가장 강력한 기능은 **URL 공유**다. 코드 전체가 URL에 인코딩되어 있어서 누군가에게 URL을 보내면 동일한 코드와 설정으로 열린다. GitHub Issue나 StackOverflow 질문에서 "왜 이 타입이 안 되나요?" 같은 질문을 할 때 필수적이다.

```typescript
// 이런 코드를 작성하고 URL을 복사하면
type Flatten<T> = T extends Array<infer U> ? U : T;

type Numbers = Flatten<number[]>;  // number
type String = Flatten<string>;     // string
```

## Playground 설정 패널

왼쪽 상단 `TS Config` 버튼을 클릭하면 컴파일러 옵션을 직접 바꿀 수 있다.

```typescript
// strict: false 로 바꾸면 아래 코드가 허용됨
function greet(name) {  // noImplicitAny 비활성화
  return "Hello, " + name;
}

// strict: true 로 바꾸면
// Parameter 'name' implicitly has an 'any' type 오류 발생
```

설정을 바꾸면 URL도 바뀌어서 설정과 코드가 함께 공유된다.

## 버전 스위처

Playground 오른쪽 상단에서 TypeScript 버전을 선택할 수 있다. 버전 업그레이드 시 동작 변화를 확인하거나, 특정 버전에서 도입된 기능을 실험할 때 유용하다.

```typescript
// TypeScript 5.0에서 추가된 const 타입 매개변수
function identity<const T>(value: T): T {
  return value;
}

const result = identity(["a", "b"] as const);
// 버전 4.x에서는 이 문법이 오류 발생
// 5.x에서 정상 동작
```

## 로컬 REPL 옵션

![Playground 활용 시나리오](/assets/posts/ts-playground-repl-workflow.svg)

Playground 없이 로컬에서 빠르게 TypeScript를 실험하고 싶을 때:

```bash
# tsx REPL 모드
npx tsx --repl

# 터미널에서 바로 실행
> const greet = (name: string) => `Hello, ${name}`
> greet("World")
'Hello, World'
> greet(42)  // 오류는 런타임에서 처리됨 (REPL 특성)
```

```bash
# 단일 파일 바로 실행
echo "const x: number = 42; console.log(x);" > /tmp/test.ts
npx tsx /tmp/test.ts
# 42
```

## Playground 학습 팁

Playground에는 왼쪽 상단 `Examples` 메뉴에 공식 예제들이 있다. 유틸리티 타입, 제네릭, 조건부 타입 등 각 기능의 공식 예제를 직접 수정해보는 것이 TypeScript를 빠르게 익히는 방법이다.

```typescript
// Playground에서 직접 실험해볼 코드
// Partial: 모든 필드를 옵셔널로
type PartialUser = Partial<{ name: string; email: string }>;
// { name?: string; email?: string }

// ReturnType: 함수 반환 타입 추출
function getUser() {
  return { id: 1, name: "Alice" };
}
type UserType = ReturnType<typeof getUser>;
// { id: number; name: string }
```

이런 코드를 Playground에서 변수 위에 마우스를 올려보면서 TypeScript가 어떤 타입을 추론하는지 확인하는 연습이 중요하다.

## 정리

TypeScript Playground는 설치 없이 즉시 TypeScript를 실험할 수 있는 공식 도구다. URL 공유, 버전 선택, 실시간 타입 추론 확인 기능을 활용해 학습을 가속할 수 있다. 질문할 때도 Playground URL을 첨부하면 훨씬 명확하게 문제를 전달할 수 있다.

---

**지난 글:** [tsc 컴파일러 완전 이해](/posts/ts-compiler-tsc/)

**다음 글:** [첫 TypeScript 프로그램 작성](/posts/ts-first-program/)

<br>
읽어주셔서 감사합니다. 😊
