---
title: "TypeScript 완전 정복: 시리즈를 시작하며"
description: "TypeScript가 무엇인지, 왜 탄생했는지, JavaScript와 어떤 관계인지 — TypeScript 완전 정복 시리즈의 시작점을 명확히 짚는다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "타입스크립트", "정적타입", "JavaScript슈퍼셋", "프론트엔드", "백엔드"]
featured: false
draft: false
---

TypeScript는 2012년 Microsoft가 공개한 이후 지금까지 꾸준히 성장해 왔으며, 오늘날 프론트엔드와 백엔드를 막론하고 사실상의 표준 언어로 자리 잡았다. 이 시리즈는 TypeScript의 기초 개념부터 고급 타입 시스템, 실무 패턴까지 순서대로 파고드는 완전 정복 가이드다. 첫 번째 글인 이번 편에서는 "TypeScript가 무엇인가"라는 가장 근본적인 질문에 답한다.

## TypeScript란 무엇인가

한 줄로 요약하면 **TypeScript = JavaScript + 타입 시스템**이다. 더 정확하게는 "타입을 추가한 JavaScript의 상위 집합(superset)"이다. 모든 유효한 JavaScript 파일은 그대로 TypeScript 파일로 사용할 수 있다는 뜻이다.

![TypeScript의 본질](/assets/posts/ts-essence-overview.svg)

TypeScript는 브라우저나 Node.js가 직접 실행하지 못한다. TypeScript 컴파일러(`tsc`)가 소스를 읽어 타입을 검사한 뒤, 타입 정보를 제거하고 순수 JavaScript를 출력한다. 이 과정을 **컴파일** 또는 **트랜스파일**이라고 부른다.

```typescript
// TypeScript 소스
function greet(name: string): string {
  return `Hello, ${name}!`;
}

// tsc가 출력하는 JavaScript
function greet(name) {
  return `Hello, ${name}!`;
}
```

`name: string`이라는 타입 주석은 JS 출력에서 완전히 사라진다. 타입은 오직 컴파일 타임에만 존재하고 런타임에는 아무런 흔적도 남기지 않는다.

## 컴파일 흐름 한눈에 보기

![TypeScript 컴파일 흐름](/assets/posts/ts-essence-compile.svg)

TypeScript 파일(`.ts`)은 `tsc`를 통해 JavaScript 파일(`.js`)로 변환된다. 이때 타입 에러가 있으면 컴파일이 중단(또는 경고)되고 개발자에게 보고된다. 에러가 없으면 순수 JavaScript가 출력되어 Node.js나 브라우저에서 실행된다.

## TypeScript가 해결하는 문제

JavaScript는 동적 타입 언어다. 변수에 어떤 값이든 넣을 수 있고, 함수가 어떤 인자를 받는지 코드를 읽지 않으면 알 수 없다. 소규모 스크립트에서는 문제가 없지만 코드베이스가 수만 줄로 커지면 다음과 같은 문제가 생긴다.

- **런타임 크래시**: 잘못된 타입의 값을 전달해도 실행 전까지 알 수 없다.
- **IDE 한계**: 에디터가 타입 정보를 모르면 자동완성이 부정확하다.
- **리팩터링 공포**: 함수 시그니처를 바꾸면 어디가 깨지는지 전체 검색에 의존해야 한다.
- **암묵적 계약**: API가 어떤 형태의 데이터를 받는지 문서로만 알 수 있다.

TypeScript는 이 문제를 **정적 타입 검사**로 해결한다. 컴파일 단계에서 타입 규칙 위반을 찾아내므로 개발 사이클 가장 초기에, 가장 저렴한 비용으로 버그를 잡는다.

## JavaScript와의 관계

TypeScript는 JavaScript를 대체하는 언어가 아니다. JavaScript를 강화(augment)하는 언어다. 세 가지 핵심 관계를 기억하자.

**슈퍼셋**: 모든 유효한 `.js`는 유효한 `.ts`다. 기존 JavaScript 프로젝트에 TypeScript를 도입할 때 파일 확장자만 바꿔도 동작하는 이유다.

**컴파일 후 삭제**: 타입 정보는 런타임에 존재하지 않는다. TypeScript는 실행 오버헤드를 추가하지 않는다.

**점진적 채택**: `allowJs`, `checkJs` 옵션을 이용하면 기존 JavaScript 파일을 그대로 두면서 TypeScript를 조금씩 섞어 쓸 수 있다.

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "allowJs": true,    // .js 파일도 컴파일에 포함
    "checkJs": true,    // .js 파일도 타입 검사
    "strict": true
  }
}
```

## 왜 지금 TypeScript인가

2024년 State of JS 설문에서 응답자의 78%가 "TypeScript를 사용 중"이라고 답했다. React, Vue, Angular 같은 주요 프레임워크가 TypeScript를 공식 지원하고, Node.js 생태계(Fastify, NestJS, tRPC 등)도 TypeScript-first로 전환했다. 취업 시장에서도 TypeScript 경험은 사실상 필수 요건이 됐다.

TypeScript를 배우는 것은 단순히 "타입을 추가하는 법"을 배우는 것이 아니다. 코드를 더 명확하게 설계하는 방법, 팀과의 소통 수단으로서의 타입, 컴파일러를 도구로 삼는 사고방식을 익히는 과정이다.

## 시리즈 로드맵

이 시리즈는 다음 순서로 진행된다.

1. **기초 세팅**: 설치, tsc, Playground, 첫 프로그램, 에디터 설정
2. **타입 기초**: 기본 타입, 특수 타입, 배열, 튜플, 객체, 리터럴
3. **타입 시스템**: 추론, 주석, 단언, 유니언, 교차 타입
4. **좁히기(Narrowing)**: 타입 가드, instanceof, in 연산자, CFA
5. **인터페이스 & 클래스**: extends, 추상 클래스, 접근 제한자
6. **제네릭**: 함수/클래스 제네릭, 제약, 기본값
7. **고급 타입**: 조건부, 매핑, 템플릿 리터럴, 재귀
8. **유틸리티 타입**: Partial, Pick, Record, Extract 등
9. **모듈 & 설정**: tsconfig, 선언 파일, 모듈 시스템
10. **실전 패턴**: React, Node.js, 비동기, 에러 처리

이제 본격적으로 시작하자.

---

**다음 글:** [왜 TypeScript인가: 정적 타입이 바꾸는 개발 경험](/posts/ts-why-typescript/)

<br>
읽어주셔서 감사합니다. 😊
