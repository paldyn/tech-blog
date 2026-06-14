---
title: "TypeScript Playground: 설치 없이 브라우저에서 실험하기"
description: "TypeScript Playground의 핵심 기능 6가지를 완전히 파악합니다. 실시간 타입 검사, JS 출력 확인, 컴파일러 옵션 조정, URL 공유 기능을 활용해 TypeScript 학습과 디버깅을 가속화하세요."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 6
type: "knowledge"
category: "TypeScript"
tags: ["TypeScriptPlayground", "TypeScript학습", "TypeScript완전정복", "타입실험"]
featured: false
draft: false
---

[지난 글](/posts/ts-compiler-tsc/)에서 tsc 컴파일러의 내부 동작을 이해했다. 새로운 타입 개념을 배울 때마다 로컬 환경에서 파일 생성 → 컴파일 → 실행을 반복하는 건 번거롭다. TypeScript Playground를 사용하면 브라우저에서 즉시 실험할 수 있다.

## TypeScript Playground란

TypeScript Playground는 `typescriptlang.org/play`에서 접근할 수 있는 공식 온라인 편집기다. 별도 설치 없이 TypeScript 코드를 작성하고, 타입 검사 결과와 컴파일된 JavaScript를 실시간으로 확인할 수 있다.

![TypeScript Playground 인터페이스](/assets/posts/ts-playground-repl-interface.svg)

## 핵심 기능 6가지

![TypeScript Playground 기능](/assets/posts/ts-playground-repl-features.svg)

### 1. 실시간 타입 검사

코드를 입력하는 즉시 오류를 빨간 밑줄로 표시한다. 오류 위에 마우스를 올리면 상세 오류 메시지와 오류 코드(TS2xxx)가 나타난다.

```typescript
// 입력하면서 즉시 오류 확인
interface User {
  name: string;
  age: number;
}

const user: User = {
  name: "Alice",
  age: "30"  // 빨간 밑줄 — Type 'string' is not assignable to type 'number'
};
```

### 2. JavaScript 컴파일 결과 확인

우측 패널에서 TypeScript가 어떤 JavaScript로 변환되는지 실시간으로 볼 수 있다.

```typescript
// TypeScript 입력
class Animal {
  constructor(private name: string) {}
  
  speak(): string {
    return `${this.name}이(가) 울었습니다.`;
  }
}
```

```javascript
// JavaScript 출력 (ES2022 target)
class Animal {
  constructor(name) {
    this.name = name;  // private 키워드 제거됨
  }
  speak() {
    return `${this.name}이(가) 울었습니다.`;
  }
}

// ES5 target으로 변경하면?
var Animal = /** @class */ (function () {
  function Animal(name) {
    this.name = name;
  }
  // ... ES5 방식의 클래스 에뮬레이션
});
```

`target` 옵션을 바꿔가며 출력 코드가 어떻게 달라지는지 비교해볼 수 있다.

### 3. 컴파일러 옵션 조정

Playground 상단의 설정 패널에서 `strict`, `target`, `noImplicitAny` 같은 옵션을 켜고 끌 수 있다.

```typescript
// strict: false 에서는 이게 허용됨
let x;         // any 타입으로 추론
x = 42;
x = "hello";   // 오류 없음

// strict: true 로 바꾸면 즉시 오류
let x;         // Error: Variable 'x' implicitly has an 'any' type
```

옵션을 바꿔가며 동작 차이를 직접 실험하는 건 타입 시스템을 이해하는 가장 좋은 방법이다.

### 4. URL로 코드 공유

Playground의 가장 실용적인 기능이다. 작성한 코드가 URL에 인코딩되어 링크 하나로 공유할 수 있다.

```
https://www.typescriptlang.org/play?#code/JYWwDg9gTgLgBAQwB7AgZzgMyhEcDkAJgHYBuAviAM...
```

GitHub 이슈 리포트, Stack Overflow 질문, 팀 슬랙 채널에서 코드를 공유할 때 매우 편리하다. 링크를 받은 사람이 클릭하면 완전히 동일한 코드와 설정이 로드된다.

### 5. 타입 정의 확인

심볼 위에 마우스를 올리면 TypeScript가 추론한 타입을 팝업으로 보여준다. 복잡한 제네릭 타입을 디버깅할 때 특히 유용하다.

```typescript
const users = [
  { id: 1, name: "Alice", role: "admin" as const },
  { id: 2, name: "Bob", role: "user" as const }
];

// users 위에 마우스를 올리면:
// const users: { id: number; name: string; role: "admin"; }[]
//            | { id: number; name: string; role: "user"; }[]
// 라고 표시됨

const firstUser = users[0];
// firstUser 위에 마우스 → 추론된 정확한 타입 확인
```

### 6. 예제 코드 모음

상단 메뉴의 "Examples"에서 TypeScript 공식 예제를 직접 불러와 실행해볼 수 있다. 제네릭, 유틸리티 타입, 데코레이터 등 다양한 예제가 있다.

## Playground 활용 팁

### 빠른 타입 실험

새로운 타입 기능을 배울 때 Playground에서 먼저 실험해보자.

```typescript
// 조건부 타입 동작 확인
type NonNullable<T> = T extends null | undefined ? never : T;

type A = NonNullable<string | null | undefined>;
// A 위에 마우스 → string 으로 표시됨
// null | undefined가 never로 걸러짐
```

### 오류 재현

동료나 커뮤니티에 질문할 때 오류를 Playground로 재현해서 공유하면 훨씬 정확한 도움을 받을 수 있다.

```typescript
// 이런 식으로 최소 재현 코드(MCVE)를 만들어 공유
interface Repo<T> {
  data: T;
  loading: boolean;
}

function useRepo<T>(): Repo<T> {
  // Error TS2741 발생 — 왜인지 모르겠어요
  return { loading: false };  // 'data' 프로퍼티 누락
}
```

### 버전별 동작 비교

Playground는 TypeScript의 여러 버전을 선택할 수 있다. 특정 기능이 어느 버전부터 지원됐는지 확인하거나, 버전 업그레이드 전 호환성을 검증할 때 사용한다.

## ts-node REPL (로컬 환경)

Playground가 온라인 도구라면, 로컬에서 REPL(Read-Eval-Print-Loop)을 쓰고 싶을 때는 `ts-node`의 인터랙티브 모드를 사용한다.

```bash
# ts-node REPL 시작
npx ts-node

# 프롬프트에서 코드 입력
> const arr: number[] = [1, 2, 3]
> arr.map(x => x * 2)
[2, 4, 6]
> arr.push("hello")
// Error: Argument of type 'string' is not assignable to parameter of type 'number'
```

## Playground vs 로컬 환경

| 항목 | TypeScript Playground | 로컬 환경 (ts-node) |
|------|----------------------|---------------------|
| 설치 | 필요 없음 | Node.js + ts-node |
| 공유 | URL 링크 한 줄 | 파일 첨부 필요 |
| 파일 저장 | URL에 인코딩 | 파일 시스템 |
| npm 패키지 | 일부 지원 | 완전 지원 |
| IDE 통합 | 없음 | VS Code 등 |
| 빠른 실험 | ✓ 최적 | 가능하지만 다소 번거로움 |

## 정리

TypeScript Playground는 학습, 디버깅, 공유 모두에 강력한 도구다. 새로운 개념을 배울 때는 Playground에서 먼저 실험하고, 동작을 이해한 뒤 로컬 프로젝트에 적용하는 워크플로우를 추천한다. 다음 글에서는 드디어 첫 번째 TypeScript 프로그램을 실제로 작성해본다.

---

**지난 글:** [tsc 컴파일러 완전 이해: 파이프라인과 핵심 옵션](/posts/ts-compiler-tsc/)

**다음 글:** [첫 번째 TypeScript 프로그램: Hello World부터 타입 추론까지](/posts/ts-first-program/)

<br>
읽어주셔서 감사합니다. 😊
