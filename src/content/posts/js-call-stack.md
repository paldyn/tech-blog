---
title: "콜 스택 — JavaScript 실행 흐름의 핵심"
description: "JavaScript 엔진이 함수 호출과 반환을 추적하는 콜 스택의 동작 원리를 살펴보고, 스택 오버플로우를 예방하는 방법과 비동기 코드와의 관계를 이해합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "콜스택", "실행컨텍스트", "스택오버플로우", "이벤트루프", "재귀"]
featured: false
draft: false
---

[지난 글](/posts/js-execution-context/)에서 실행 컨텍스트가 어떻게 생성되고 어떤 정보를 담고 있는지 살펴봤습니다. 그렇다면 이 컨텍스트들은 어디에 쌓이고, 어떤 순서로 처리될까요? 그 답이 바로 **콜 스택(Call Stack)**입니다. JavaScript가 단일 스레드임에도 함수 호출을 정확하게 추적할 수 있는 이유, 재귀가 깊어지면 에러가 나는 이유, `async/await`가 블로킹 없이 작동하는 이유 — 모두 콜 스택을 이해하면 자연스럽게 설명됩니다.

---

## 스택이란 무엇인가

스택(Stack)은 LIFO(Last In, First Out) 구조입니다. 가장 마지막에 들어간 항목이 가장 먼저 나옵니다. 식당 주방의 쟁반 더미를 생각해보세요 — 새 쟁반은 위에 올리고, 꺼낼 때도 위에서부터 꺼냅니다.

JavaScript 엔진은 이 스택 구조를 사용해 **어떤 함수가 현재 실행 중인지**, **그 함수가 끝나면 어디로 돌아와야 하는지**를 추적합니다.

---

## 함수 호출과 스택 변화

함수를 호출할 때마다 해당 함수의 실행 컨텍스트가 스택에 **push**되고, 함수가 반환되면 **pop**됩니다.

```javascript
function greet(name) {
  return "Hello, " + name;
}

function main() {
  const msg = greet("JS"); // greet 호출 → 스택에 push
  console.log(msg);         // greet 반환 후 실행
}

main(); // main 호출 → 스택에 push
```

이 코드의 실행 순서를 스택 관점에서 추적하면 다음과 같습니다.

1. 전역 실행 컨텍스트(GEC)가 스택에 push됩니다.
2. `main()`이 호출되면 main의 실행 컨텍스트가 스택에 push됩니다.
3. `greet("JS")`가 호출되면 greet의 실행 컨텍스트가 스택에 push됩니다.
4. `greet`가 문자열을 반환하면 pop되고, 제어가 `main`으로 돌아옵니다.
5. `main`이 종료되면 pop되고, 제어가 전역으로 돌아옵니다.
6. 전체 스크립트가 완료되면 GEC도 pop됩니다.

![콜 스택 동작 원리](/assets/posts/js-call-stack-diagram.svg)

---

## 현재 실행 프레임 확인하기

브라우저 개발자 도구나 Node.js에서 에러가 발생하면 **스택 트레이스(stack trace)**를 볼 수 있습니다. 이것이 바로 콜 스택의 스냅샷입니다.

```javascript
function c() {
  throw new Error("에러 발생!");
}

function b() { c(); }
function a() { b(); }

a();
// Error: 에러 발생!
//   at c (script.js:2)
//   at b (script.js:5)
//   at a (script.js:6)
//   at script.js:8
```

스택 트레이스는 **아래에서 위로** 읽습니다 — 가장 아래가 처음 호출된 함수, 가장 위가 에러가 발생한 지점입니다. `Error` 객체의 `stack` 프로퍼티로 이 정보를 문자열로 얻을 수도 있습니다.

---

## 스택 오버플로우

콜 스택의 크기는 무한하지 않습니다. V8(Chrome, Node.js 등)의 기본 한계는 약 10,000~15,000 프레임입니다. 종료 조건 없는 재귀 함수를 호출하면 이 한계를 초과하여 `RangeError: Maximum call stack size exceeded`가 발생합니다.

```javascript
// ❌ 종료 조건 없는 재귀 → 스택 오버플로우
function countDown(n) {
  console.log(n);
  countDown(n - 1); // 0에서도 계속 호출됨
}

countDown(5);
// 5, 4, 3, 2, 1, 0, -1, -2, ...
// → RangeError: Maximum call stack size exceeded
```

올바른 재귀는 반드시 **기저 사례(base case)**가 있어야 합니다.

```javascript
// ✓ 기저 사례를 가진 재귀
function countDown(n) {
  if (n < 0) return; // 기저 사례: 종료 조건
  console.log(n);
  countDown(n - 1);
}

countDown(5); // 5, 4, 3, 2, 1, 0
```

---

## 깊은 재귀와 setTimeout을 이용한 회피

기저 사례가 있더라도 재귀 깊이가 스택 한계를 초과할 수 있습니다. 이럴 때 `setTimeout(fn, 0)`으로 다음 반복을 이벤트 루프 큐에 등록하면 각 반복마다 스택이 비워집니다.

```javascript
// ✓ 이벤트 루프를 통한 대규모 반복 처리
function safeLoop(n) {
  if (n <= 0) return;
  doWork(n);
  setTimeout(() => safeLoop(n - 1), 0); // 스택 비우기
}

safeLoop(100000); // 스택 오버플로우 없이 처리
```

`setTimeout(fn, 0)`은 즉시 실행이 아니라 **현재 스택이 완전히 비워진 후** 이벤트 루프에 의해 실행됩니다. 따라서 스택에는 한 번에 단 하나의 `safeLoop` 프레임만 존재합니다.

![스택 오버플로우와 비동기 탈출](/assets/posts/js-call-stack-overflow.svg)

---

## 꼬리 재귀 최적화(TCO)

일부 언어는 **꼬리 위치(tail position)**의 재귀 호출을 새 스택 프레임 없이 현재 프레임을 재사용하도록 최적화합니다. ECMAScript 2015 명세도 이를 정의했지만, 현재 V8을 포함한 대부분의 엔진은 이를 구현하지 않았습니다. Safari(JavaScriptCore)만이 엄격 모드에서 TCO를 지원합니다.

```javascript
"use strict";
// 꼬리 재귀 스타일 (TCO 지원 엔진에서만 최적화됨)
function factorial(n, acc = 1) {
  if (n <= 1) return acc;
  return factorial(n - 1, n * acc); // 꼬리 위치
}

factorial(100000); // TCO 지원 시: OK / V8: 스택 오버플로우
```

실용적 맥락에서는 TCO에 의존하지 말고 반복문이나 트램폴린(trampoline) 패턴을 사용하는 것이 안전합니다.

---

## 콜 스택과 이벤트 루프의 관계

JavaScript는 단일 스레드입니다. **콜 스택이 비어 있을 때만** 이벤트 루프가 태스크 큐에서 다음 작업을 꺼내 실행합니다. 이것이 `setTimeout`, `Promise`, `fetch`가 메인 스레드를 차단하지 않는 이유입니다.

```javascript
console.log("A"); // 스택에 push → 실행 → pop

setTimeout(() => {
  console.log("B"); // 이벤트 큐 대기 (스택 비워진 후)
}, 0);

console.log("C"); // 스택에 push → 실행 → pop

// 출력: A, C, B
```

`B`가 나중에 출력되는 이유는 콜 스택이 비워지기 전까지 이벤트 루프가 콜백을 실행하지 않기 때문입니다.

---

## 동기 작업의 블로킹 문제

콜 스택에 오래 걸리는 동기 작업이 있으면 UI 렌더링이나 사용자 입력 처리도 멈춥니다.

```javascript
// ❌ 메인 스레드 블로킹 (UI 멈춤)
function heavySync() {
  const end = Date.now() + 3000; // 3초간
  while (Date.now() < end) {}    // 아무것도 못함
}

button.onclick = () => {
  heavySync(); // 3초간 버튼 응답 없음
  updateUI();
};
```

해결책은 Web Worker에서 실행하거나, 작업을 작게 나눠 `requestIdleCallback`이나 `setTimeout`으로 청크 처리하는 것입니다.

---

## 핵심 정리

| 동작 | 스택 변화 |
|------|-----------|
| 함수 호출 | 새 실행 컨텍스트 push |
| 함수 반환 | 현재 컨텍스트 pop |
| 종료 조건 없는 재귀 | 스택 오버플로우 |
| `setTimeout(fn, 0)` | 현재 스택 완료 후 fn 실행 |
| 콜 스택 비어 있음 | 이벤트 루프가 큐에서 태스크 실행 |

콜 스택은 JavaScript 실행 모델의 심장부입니다. 이 구조를 이해하면 에러 메시지의 스택 트레이스를 읽는 능력부터 비동기 코드의 동작 원리까지 한꺼번에 이해할 수 있습니다.

---

**다음 글:** [클로저의 본질 — 함수가 기억하는 것](/posts/js-closure-essence/)

<br>
읽어주셔서 감사합니다. 😊
