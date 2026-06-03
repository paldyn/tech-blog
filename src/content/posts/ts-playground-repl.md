---
title: "TypeScript Playground: 브라우저에서 즉시 실험하기"
description: "설치 없이 브라우저에서 TypeScript를 바로 실험할 수 있는 공식 Playground 사용법, 주요 기능, 학습 팁을 소개한다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "Playground", "REPL", "타입추론", "학습", "실험"]
featured: false
draft: false
---

[지난 글](/posts/ts-compiler-tsc/)에서 tsc 컴파일러 동작 원리를 파악했다. 이번 편에서는 환경 설정 없이 브라우저에서 TypeScript를 즉시 실험할 수 있는 공식 **TypeScript Playground**를 소개한다.

## TypeScript Playground란

TypeScript 공식 팀이 제공하는 온라인 편집기로, `typescriptlang.org/play`에서 바로 접근할 수 있다. 설치, 빌드 단계 없이 타입스크립트 코드를 작성하고 결과를 즉시 확인할 수 있다.

![TypeScript Playground 인터페이스](/assets/posts/ts-playground-repl-ui.svg)

Playground는 크게 세 영역으로 구성된다.

- **왼쪽 패널**: TypeScript 코드 작성 영역
- **오른쪽 패널**: JavaScript 출력, 타입 선언(`.d.ts`), 에러 목록 중 선택
- **하단 패널**: 오류 메시지 목록

## 기본 사용법

Playground에 코드를 입력하면 실시간으로 JavaScript 출력이 업데이트된다.

```typescript
// Playground에 입력
interface Point {
  x: number;
  y: number;
}

function distance(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

const p1: Point = { x: 0, y: 0 };
const p2: Point = { x: 3, y: 4 };
console.log(distance(p1, p2)); // 5
```

오른쪽 패널에서 "JS" 탭을 선택하면 컴파일된 JavaScript를 확인할 수 있다. `interface Point`가 사라진 것을 직접 눈으로 볼 수 있다.

## 실시간 타입 추론 확인

Playground의 가장 강력한 기능은 **타입 호버(hover)**다. 변수나 함수 위에 마우스를 올리면 TypeScript가 추론한 타입이 팝업으로 표시된다.

![실시간 타입 추론 확인](/assets/posts/ts-playground-repl-inference.svg)

```typescript
const numbers = [1, 2, 3, 4, 5];
// numbers 위에 호버하면: const numbers: number[]

const doubled = numbers.map(n => n * 2);
// doubled 위에 호버하면: const doubled: number[]

const first = numbers[0];
// first 위에 호버하면: const first: number
```

이 기능은 "TypeScript가 지금 이 코드를 어떻게 이해하고 있는가"를 즉시 파악하게 해준다. 타입 추론이 예상과 다르게 동작할 때 Playground에서 확인하면 디버깅이 빨라진다.

## 오류 메시지 실험

Playground는 타입 에러 메시지를 이해하는 연습에도 좋다.

```typescript
// 다음 코드를 Playground에 입력해보자
function greet(name: string): string {
  return name.length;  // Error!
}
```

에러 메시지: `Type 'number' is not assignable to type 'string'`

함수가 `string` 반환을 선언했는데 `number`인 `name.length`를 반환하려고 해서 발생한다. 에러 메시지를 읽는 법을 익히는 데 Playground가 최적의 환경이다.

## 다양한 설정 실험

Playground 상단의 "TS Config" 패널에서 컴파일러 옵션을 실시간으로 변경할 수 있다.

```typescript
// strictNullChecks 끄고 켜보면서 차이 확인
let name: string;
name = null;  // strictNullChecks: true면 에러, false면 허용
```

`strict`, `target`, `lib` 등 다양한 옵션이 코드에 어떤 영향을 미치는지 직접 실험해보자.

## TypeScript 버전 전환

Playground 상단에서 TypeScript 버전을 선택할 수 있다. 과거 버전부터 최신 베타까지 전환 가능하다.

새로운 TypeScript 기능이 어느 버전부터 추가됐는지 확인할 때 유용하다. 예를 들어 `satisfies` 연산자는 TypeScript 4.9부터, `const` 타입 파라미터는 5.0부터 추가됐다.

## 공유 URL로 협업

Playground의 코드는 URL에 인코딩된다. 주소창의 URL을 복사해서 팀원에게 공유하면 같은 코드 상태를 즉시 볼 수 있다.

Stack Overflow나 GitHub Issue에서 TypeScript 관련 질문을 할 때 Playground 링크를 첨부하면 훨씬 빠른 도움을 받을 수 있다.

## 공식 예제 활용

Playground 상단의 "Examples" 메뉴에는 TypeScript 팀이 준비한 공식 예제가 카테고리별로 정리돼 있다.

- **JavaScript Essentials**: JS와 TS의 관계
- **TypeScript Essentials**: 기본 타입, 유니언, 인터페이스
- **Playground**: 재미있는 타입 실험

시리즈를 따라가면서 각 개념을 배울 때 관련 예제를 Playground에서 직접 실행해보는 것이 학습 효과를 높인다.

## 로컬 환경 vs Playground

| 상황 | 권장 도구 |
|------|----------|
| 개념 실험 / 에러 재현 | Playground |
| 팀원에게 코드 공유 | Playground |
| 새 TypeScript 기능 탐색 | Playground |
| 실제 프로젝트 개발 | 로컬 + VS Code |
| 파일 시스템 접근 필요 | 로컬 환경 |

Playground는 학습과 실험을 위한 최적의 도구다. 다음 편에서는 로컬 환경에서 첫 TypeScript 프로그램을 작성하고 실행하는 전 과정을 다룬다.

---

**지난 글:** [tsc 컴파일러 완전 해부: 동작 원리와 옵션](/posts/ts-compiler-tsc/)

**다음 글:** [첫 TypeScript 프로그램: Hello, Types!](/posts/ts-first-program/)

<br>
읽어주셔서 감사합니다. 😊
