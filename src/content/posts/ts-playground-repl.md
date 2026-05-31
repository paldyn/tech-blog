---
title: "TypeScript Playground — 브라우저에서 바로 실험하기"
description: "설치 없이 브라우저에서 TypeScript를 실험할 수 있는 공식 Playground 사용법을 안내합니다. 타입 실험, 버전 비교, 공유 기능까지 모두 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "Playground", "학습도구", "타입실험", "REPL"]
featured: false
draft: false
---

[지난 글](/posts/ts-compiler-tsc/)에서 `tsc` 컴파일러의 내부 동작을 살펴봤다. TypeScript를 처음 배울 때나 새로운 타입 문법을 실험할 때 매번 로컬에서 컴파일하기 번거롭다. TypeScript 공식 Playground를 사용하면 브라우저에서 바로 TypeScript를 작성하고 결과를 확인할 수 있다.

## TypeScript Playground란

TypeScript Playground는 마이크로소프트가 제공하는 공식 온라인 REPL(Read-Eval-Print Loop) 환경이다. 브라우저에서 TypeScript 코드를 작성하면 실시간으로 JavaScript 출력을 보여 주고, 타입 오류가 있으면 즉시 표시해 준다.

**접속 주소**: `typescriptlang.org/play`

설치가 필요 없다. 계정 없이 바로 시작할 수 있다.

![TypeScript Playground 주요 기능](/assets/posts/ts-playground-repl-ui.svg)

## 핵심 기능

### 실시간 JS 변환

TypeScript 코드를 입력하면 오른쪽 패널에 컴파일된 JavaScript가 실시간으로 표시된다. 타입 문법이 어떻게 제거되는지, 어떤 JavaScript로 변환되는지 바로 확인할 수 있다.

```typescript
// 입력한 TypeScript
interface Config {
  timeout: number;
  retries?: number;
}

function request(url: string, config: Config): Promise<Response> {
  return fetch(url);
}
```

이 코드를 Playground에 입력하면 오른쪽에 `interface` 와 타입 정보가 제거된 JavaScript가 표시된다.

### 타입 정보 호버

코드 편집기에서 변수나 표현식 위에 마우스를 올리면 TypeScript가 추론한 타입을 툴팁으로 보여 준다. 복잡한 타입 추론 결과를 확인할 때 매우 유용하다.

```typescript
const items = [1, 2, 3];
const doubled = items.map(x => x * 2);
// doubled에 마우스 오버 → "const doubled: number[]" 표시
```

### TS 버전 선택

상단 드롭다운에서 TypeScript 버전을 바꿀 수 있다. 버전별로 동작이 달라지는 기능을 비교하거나, nightly 빌드로 아직 릴리즈되지 않은 기능을 미리 실험할 수 있다.

### URL 공유

Playground에 코드를 입력하면 URL에 코드가 Base64 인코딩되어 포함된다. 이 URL을 공유하면 상대방이 같은 코드를 바로 열 수 있다. Stack Overflow 질문, GitHub 이슈, 팀 내 타입 문제 공유에 매우 유용하다.

## 실습: 첫 번째 타입 실험

Playground를 열고 다음 코드를 입력해 보자.

```typescript
// 타입 오류가 발생하는 코드
function multiply(a: number, b: number): number {
  return a * b;
}

const result = multiply(5, "3"); // 여기에 빨간 밑줄이 표시됨
```

`multiply(5, "3")` 에 빨간 밑줄이 그어지고, 마우스를 올리면 `Argument of type 'string' is not assignable to parameter of type 'number'` 오류 메시지가 나타난다. 이것이 TypeScript의 정적 타입 검사다.

이번에는 `"3"` 을 `3` 으로 바꿔 보자. 빨간 밑줄이 사라지고 오류가 없어진다.

## 설정 패널 활용

Playground 상단의 `TS Config` 탭을 클릭하면 컴파일러 옵션을 GUI로 변경할 수 있다.

- **strict** 체크박스를 끄고 켜면서 오류 변화 확인
- **target** 을 ES5로 바꿔 화살표 함수가 일반 함수로 변환되는 것 확인
- **noImplicitAny** 를 끄고 켜면서 암묵적 `any` 허용 여부 비교

![Playground 활용 사례](/assets/posts/ts-playground-repl-usecases.svg)

## 유용한 단축키

| 단축키 | 기능 |
|---|---|
| `Ctrl/Cmd + Enter` | 코드 실행(Logs 탭에서 console.log 결과 확인) |
| `Ctrl/Cmd + S` | 현재 코드 URL 업데이트 |
| 마우스 오버 | 타입 정보 툴팁 표시 |

## Playground의 한계

Playground는 학습과 실험에 최적화되어 있지만 몇 가지 한계가 있다.

- **파일 시스템 없음** — 여러 파일로 나눠 작성하기 어렵다
- **npm 패키지 없음** — 외부 라이브러리를 import 할 수 없다 (일부 @types는 지원)
- **실행 결과 제한** — console.log 결과는 Logs 탭에서 볼 수 있지만 DOM 조작 등은 불가

복잡한 코드를 실험하거나 실제 프로젝트를 개발할 때는 이전 글에서 설명한 로컬 환경을 사용한다.

다음 글에서는 로컬 환경에서 TypeScript로 첫 번째 실용적인 프로그램을 작성한다.

---

**지난 글:** [TypeScript 컴파일러 tsc 완전 해설](/posts/ts-compiler-tsc/)

**다음 글:** [TypeScript로 첫 번째 프로그램 작성하기](/posts/ts-first-program/)

<br>
읽어주셔서 감사합니다. 😊
