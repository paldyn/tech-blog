---
title: "TypeScript의 본질: 타입이 있는 JavaScript"
description: "TypeScript가 무엇인지, JavaScript의 상위집합으로서 어떤 역할을 하는지 이해합니다. 타입 시스템이 코드에 가져오는 근본적인 변화를 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["TypeScript", "타입시스템", "JavaScript", "정적타이핑", "입문"]
featured: false
draft: false
---

TypeScript는 마이크로소프트가 2012년에 발표한 언어로, 한 문장으로 정의하면 **"타입 시스템을 추가한 JavaScript"**입니다. JavaScript를 쓰면서 느끼는 불안함, 즉 "이 변수에 뭐가 들어있지?", "이 함수가 뭘 반환하지?"라는 물음에 컴파일 단계에서 답을 주는 도구입니다.

## TypeScript는 JavaScript의 상위집합

TypeScript의 가장 중요한 특성은 **JavaScript의 완전한 상위집합(superset)**이라는 점입니다. 모든 유효한 JavaScript 코드는 그대로 TypeScript 코드로 동작합니다. 기존 JS 파일 확장자를 `.ts`로 바꾸기만 해도 TypeScript 프로젝트로 전환할 수 있습니다.

![TypeScript 상위집합 다이어그램](/assets/posts/ts-essence-overview.svg)

상위집합이기 때문에 TypeScript는 JavaScript의 모든 것을 포함합니다. 변수, 함수, 클래스, 모듈, Promise, DOM API, npm 패키지 — 전부 그대로 사용합니다. TypeScript는 그 위에 타입 주석(type annotation), 인터페이스, 제네릭, 열거형 같은 추가 문법을 얹을 뿐입니다.

## 컴파일 후 흔적 없이 사라지는 타입

TypeScript 타입은 **런타임에 존재하지 않습니다**. `tsc`(TypeScript Compiler)가 `.ts` 파일을 `.js` 파일로 변환하면서 타입 주석과 인터페이스 같은 TypeScript 전용 문법을 완전히 제거합니다. 브라우저와 Node.js는 JavaScript만 실행하므로, TypeScript의 타입 검사는 개발 시점에만 작동하고 런타임 성능 오버헤드는 전혀 없습니다.

```typescript
// 원본 TypeScript
function add(a: number, b: number): number {
  return a + b;
}

// tsc 컴파일 후 JavaScript
function add(a, b) {
  return a + b;
}
```

## 오류를 실행 전에 잡는다

TypeScript가 주는 핵심 이점은 **컴파일 타임 오류 감지**입니다. JavaScript에서 런타임에야 터지던 오류들이 TypeScript에서는 개발 중에 즉시 빨간 줄로 표시됩니다.

![JavaScript vs TypeScript 코드 비교](/assets/posts/ts-essence-benefits.svg)

```typescript
interface Product {
  id: number;
  name: string;
  price: number;
}

function formatPrice(product: Product): string {
  return `${product.name}: ${product.price}원`;
}

// 오타가 있으면 컴파일 타임에 잡힘
// formatPrice({ id: 1, name: "사과", prcie: 1000 });
// TS2345: 'prcie' does not exist in type 'Product'
```

## TypeScript를 써야 하는 이유

TypeScript를 배워야 할 이유는 간단합니다. 2024년 Stack Overflow 개발자 설문에서 TypeScript는 가장 사랑받는 언어 5위 안에 꾸준히 이름을 올리고 있고, 대부분의 대규모 프론트엔드 프로젝트(React, Vue, Angular)와 Node.js 백엔드가 TypeScript를 표준으로 채택했습니다. 오픈소스 라이브러리 대부분도 `.d.ts` 타입 선언 파일을 제공합니다.

학습 관점에서도 TypeScript는 장점이 있습니다. 타입을 명시하면서 코드를 작성하다 보면 JavaScript의 동작 방식을 더 깊이 이해하게 됩니다. 타입 시스템을 통해 데이터 구조를 명확하게 정의하는 습관이 자연스럽게 길러집니다.

## 이 시리즈의 목표

이 "TypeScript 완전 정복" 시리즈는 TypeScript를 처음 배우는 분부터 고급 타입 기법을 익히고 싶은 분까지를 대상으로 합니다. 기본 타입 시스템부터 시작해서 제네릭, 조건부 타입, 맵드 타입, 선언 파일 작성, 모노레포 설정까지 단계적으로 다룹니다. JavaScript를 알고 있다면 누구든 따라올 수 있도록 설명합니다.

```bash
# TypeScript 시작 (다음 글에서 자세히 다룸)
npm install --save-dev typescript
npx tsc --init
```

TypeScript는 처음에는 타입을 다는 번거로움으로 느껴질 수 있습니다. 하지만 프로젝트가 커지고 팀이 늘어날수록 그 번거로움이 얼마나 큰 안전망인지 실감하게 됩니다. 이제 TypeScript의 세계로 들어가 보겠습니다.

---

**다음 글:** [왜 TypeScript인가: 타입 시스템이 주는 생산성](/posts/ts-why-typescript/)

<br>
읽어주셔서 감사합니다. 😊
