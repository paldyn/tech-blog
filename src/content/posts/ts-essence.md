---
title: "TypeScript 완전 정복 ①: TypeScript의 본질"
description: "TypeScript가 무엇인지, JavaScript와 어떤 관계인지, 타입 시스템이 왜 필요한지를 핵심만 짚어 설명합니다. 시리즈의 출발점."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "타입시스템", "JavaScript", "정적타입", "컴파일"]
featured: false
draft: false
---

프론트엔드 개발자라면 한 번쯤 들어봤을 이름, TypeScript. 거대한 오픈소스 프로젝트들이 너나없이 TypeScript로 전환했고, 채용 공고에도 "TypeScript 우대"가 기본값이 됐다. 그런데 막상 처음 접하면 "그냥 JavaScript에 타입을 붙인 것 아닌가?" 하는 생각이 든다. 이 시리즈는 그 질문에서 출발한다. TypeScript가 **정확히 무엇**이며, 왜 지금 가장 중요한 프론트엔드·백엔드 언어 중 하나가 됐는지를 처음부터 완전히 이해하는 것이 목표다.

## TypeScript란 무엇인가

TypeScript는 Microsoft가 2012년에 발표한 **JavaScript의 상위 집합(superset) 언어**다. "상위 집합"이라는 말이 핵심이다. 모든 유효한 JavaScript 코드는 그대로 TypeScript 코드이기도 하다. TypeScript는 JavaScript 위에 **정적 타입 시스템**을 더한 것이다.

```typescript
// 이것은 완벽히 유효한 TypeScript 코드다 (그냥 JavaScript)
function greet(name) {
  return "Hello, " + name;
}

// 이것은 TypeScript가 추가한 문법 (타입 어노테이션)
function greetTyped(name: string): string {
  return "Hello, " + name;
}
```

TypeScript 파일(`.ts`, `.tsx`)은 **컴파일러(`tsc`)**가 처리하면 순수한 JavaScript 파일(`.js`)로 변환된다. 브라우저도, Node.js도 TypeScript를 직접 실행하지 않는다. TypeScript는 개발 단계에서만 존재하고, 런타임에는 흔적도 없이 사라진다.

![TypeScript의 본질: JavaScript + 타입 시스템](/assets/posts/ts-essence-concept.svg)

## 정적 타입 vs 동적 타입

프로그래밍 언어에서 타입이 **언제** 결정되느냐에 따라 크게 두 가지로 나뉜다.

**동적 타입 언어(JavaScript, Python, Ruby)**는 변수의 타입이 런타임에 결정된다. 코드를 작성할 때는 이 변수가 숫자인지 문자열인지 신경 쓰지 않아도 된다. 유연하지만, 타입 관련 오류가 실행 중에야 드러난다.

**정적 타입 언어(TypeScript, Java, Rust)**는 변수의 타입이 컴파일 타임에 결정된다. 코드를 실행하기 전에 타입 검사기가 오류를 잡아준다.

```typescript
// JavaScript식: 런타임까지 오류 모름
let value: any = "hello";
value = 42;
// value.toUpperCase(); // 런타임 TypeError!

// TypeScript: 코드 작성 중 즉시 감지
let value2: string = "hello";
// value2 = 42; // 오류: Type 'number' is not assignable to type 'string'
```

## 타입은 왜 필요한가

오류를 일찍 발견할수록 수정 비용이 극적으로 줄어든다. 코딩 중 에디터에서 발견한 오류는 몇 초 안에 고칠 수 있다. 같은 오류가 프로덕션에서 발생하면 장애 대응, 핫픽스 배포, 사용자 CS 처리까지 수십 배의 비용이 든다.

![타입 안전성: 오류를 언제 발견하는가](/assets/posts/ts-essence-type-safety.svg)

정적 타입의 두 번째 이점은 **도구 지원**이다. 에디터가 타입 정보를 알면 자동완성, 타입 힌트, 리팩터링 도구가 정확하게 동작한다. 함수 시그니처가 바뀌면 그 함수를 쓰는 모든 곳에서 즉시 오류가 표시된다. 대규모 코드베이스에서 이 능력은 필수다.

## TypeScript가 하지 않는 것

TypeScript에 대한 흔한 오해를 정리하자.

```typescript
// TypeScript는 런타임 타입 검사를 하지 않는다
// 컴파일 후 타입 정보는 사라진다
function process(input: string) {
  return input.toUpperCase();
}

// 외부 API 응답에 as를 남용하지 말 것
// const data = await fetchUser() as User; // 위험!

// 올바른 방법: 런타임 검증 추가
function isUser(x: unknown): x is User {
  return typeof x === "object" && x !== null && "name" in x;
}
```

TypeScript가 **하지 않는** 것: 런타임 타입 보장, 성능 최적화, 새로운 런타임 기능 추가.

TypeScript가 **하는** 것: 컴파일 타임 타입 검사, 개발 도구 통합 향상, 코드 문서화 역할.

## 슈퍼셋이라는 의미

TypeScript가 JavaScript의 슈퍼셋이라는 사실은 점진적 도입을 가능하게 한다. `allowJs: true` 설정으로 `.js`와 `.ts` 파일을 섞어 쓸 수 있고, 하나씩 전환해 나갈 수 있다.

```typescript
// 점진적 타이핑 — 처음엔 any를 써도 된다
function processLegacy(data: any) {
  return data.value;
}

// 시간을 들여 구체적인 타입으로 개선
interface Data {
  value: number;
  label: string;
}

function processTyped(data: Data) {
  return data.value; // 완전한 타입 안전성
}
```

이 점진적 전환 전략 덕분에 수십만 줄의 레거시 JavaScript 프로젝트도 TypeScript로 옮길 수 있다.

## 정리

TypeScript는 JavaScript가 진화한 형태다. JavaScript의 자유로움을 유지하면서, 대규모 애플리케이션 개발에 필요한 타입 안전성과 도구 지원을 더했다. 컴파일하면 순수 JS가 되므로 어디서든 실행된다. 이 시리즈를 통해 타입 시스템의 기초부터 고급 패턴까지, TypeScript를 완전히 정복한다.

---

**다음 글:** [왜 TypeScript를 써야 하는가](/posts/ts-why-typescript/)

<br>
읽어주셔서 감사합니다. 😊
