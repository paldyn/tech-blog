---
title: "렉시컬 스코프"
description: "JavaScript의 렉시컬(정적) 스코프가 무엇인지, 동적 스코프와 어떻게 다른지, 렉시컬 환경이 클로저와 어떻게 연결되는지를 명확히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "렉시컬 스코프", "렉시컬 환경", "클로저", "스코프"]
featured: false
draft: false
---

[지난 글](/posts/js-scope-chain/)에서 변수 탐색 경로인 스코프 체인을 살펴봤습니다. 이번에는 스코프가 **어떤 기준으로 결정되는지**를 다루는 **렉시컬 스코프(Lexical Scope)** 를 알아봅니다. 렉시컬 스코프는 JavaScript 클로저의 기반이 되는 핵심 개념입니다.

## 렉시컬 스코프란?

**렉시컬(Lexical)** 이란 "소스 코드에서의 위치"를 의미합니다. 렉시컬 스코프는 **함수가 어디에 선언되었느냐**에 따라 스코프가 결정되는 방식입니다. 함수가 어디서 호출되든 관계없이, 선언 위치에서 형성된 스코프를 유지합니다.

```javascript
const x = 1;

function foo() {
  console.log(x); // 선언 위치 기준: 전역 x = 1
}

function bar() {
  const x = 2;
  foo(); // foo를 bar 안에서 호출해도 foo의 스코프는 변하지 않음
}

bar(); // 1 출력
```

`foo`가 `bar` 안에서 호출되더라도, `foo`가 참조하는 `x`는 `foo`가 **선언된 위치**에서 보이는 `x`입니다. `bar` 안의 `x = 2`는 무관합니다.

![렉시컬 스코프 vs 동적 스코프](/assets/posts/js-lexical-scope-static-vs-dynamic.svg)

## 동적 스코프와의 차이

세상에는 두 종류의 스코프 결정 방식이 있습니다.

| 방식 | 스코프 결정 기준 | 예시 언어 |
|---|---|---|
| 렉시컬(정적) 스코프 | 선언 위치 | JavaScript, Python, Go |
| 동적 스코프 | 호출 스택 | Bash, 일부 Perl 모드 |

동적 스코프에서는 같은 함수여도 **어디서 호출하느냐**에 따라 결과가 달라집니다. 예측하기 어렵고 버그가 많아 현대 언어는 대부분 렉시컬 스코프를 채택합니다.

JavaScript는 완전한 렉시컬 스코프 언어입니다. 예외처럼 보이는 `this`는 렉시컬 스코프가 아닌 **실행 컨텍스트**에 따라 결정되지만, 화살표 함수의 `this`는 렉시컬로 결정됩니다.

## 렉시컬 환경(Lexical Environment)

엔진 내부에서 각 스코프는 **렉시컬 환경(Lexical Environment)** 객체로 표현됩니다. 렉시컬 환경은 두 가지를 갖습니다.

1. **환경 레코드(Environment Record)**: 현재 스코프의 변수 바인딩 저장
2. **외부 렉시컬 환경 참조(Outer Lexical Environment Reference)**: 상위 스코프 가리킴

```javascript
// 실제로 이런 구조가 엔진 내부에 생성됩니다 (의사코드)
// 전역 렉시컬 환경
{
  environmentRecord: { x: 1 },
  outer: null,          // 더 이상 바깥이 없음
}

// foo의 렉시컬 환경 (foo 호출 시 생성)
{
  environmentRecord: {}, // foo 내 지역 변수 없음
  outer: 전역 렉시컬 환경, // foo가 선언된 곳의 환경
}
```

스코프 체인 탐색 = 렉시컬 환경의 `outer` 링크를 따라 올라가는 것입니다.

## 렉시컬 스코프와 클로저

렉시컬 스코프 덕분에 함수는 **선언 시점의 환경을 기억**할 수 있습니다. 이것이 클로저입니다.

```javascript
function makeCounter(initial = 0) {
  let count = initial; // makeCounter의 렉시컬 환경에 저장

  return {
    increment() { return ++count; }, // count가 있는 환경 참조
    decrement() { return --count; },
    reset()     { count = initial; },
  };
}

const c1 = makeCounter(0);
const c2 = makeCounter(100); // 독립적인 렉시컬 환경

c1.increment(); // 1
c1.increment(); // 2
c2.increment(); // 101 — c1과 독립
```

`makeCounter`가 반환된 후에도 반환된 메서드들은 `count`와 `initial`이 담긴 렉시컬 환경을 참조합니다. `c1`과 `c2`는 각각 별도의 환경을 가지므로 서로 영향을 주지 않습니다.

![렉시컬 환경과 클로저](/assets/posts/js-lexical-scope-closure-link.svg)

## 함수 표현식과 렉시컬 스코프

함수가 선언된 방식(선언문, 표현식, 화살표)과 무관하게 렉시컬 스코프 규칙은 동일하게 적용됩니다.

```javascript
const multiplier = 10;

const timesMultiplier = (x) => x * multiplier; // 전역 multiplier 참조

function makeAdder(n) {
  return (x) => x + n; // n은 makeAdder의 렉시컬 환경에 있음
}

const add5 = makeAdder(5);
add5(3);  // 8
add5(10); // 15
```

## 렉시컬 스코프 실용 패턴

### 팩토리 함수로 비공개 상태 생성

```javascript
function createStack() {
  const items = []; // 외부에서 직접 접근 불가

  return {
    push(item) { items.push(item); },
    pop()      { return items.pop(); },
    peek()     { return items[items.length - 1]; },
    size()     { return items.length; },
  };
}

const stack = createStack();
stack.push(1);
stack.push(2);
stack.pop();    // 2
stack.size();   // 1
// stack.items  — undefined (접근 불가)
```

`items` 배열은 `createStack`의 렉시컬 환경에만 존재하고, 반환된 메서드들만 접근할 수 있습니다. 클래스 없이 캡슐화를 구현합니다.

### 이벤트 핸들러의 렉시컬 바인딩

```javascript
function setupButtons(labels) {
  labels.forEach((label, index) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    // 클릭 핸들러는 label과 index가 있는 렉시컬 환경을 가짐
    btn.addEventListener('click', () => {
      console.log(`버튼 ${index}: ${label}`);
    });
    document.body.appendChild(btn);
  });
}
```

화살표 함수는 선언 시점의 `label`과 `index`를 렉시컬으로 캡처합니다. `var`로 `index`를 선언했다면 공유 환경 문제가 발생하는데, `const`/`let`은 블록마다 새 바인딩을 생성하므로 안전합니다.

## `eval`과 `with`는 렉시컬 스코프를 우회

`eval`과 `with`는 실행 시점에 동적으로 스코프를 변경할 수 있어 엔진의 정적 분석을 방해합니다. 엄격 모드에서는 이 영향이 제한되고, 현대 코드에서는 사용하지 않는 것이 강력히 권장됩니다.

렉시컬 스코프는 JavaScript의 예측 가능성의 토대입니다. 이 규칙을 이해하면 클로저, this 바인딩, 모듈 시스템 등 복잡한 개념이 훨씬 자연스럽게 이해됩니다. 다음 글에서는 `var`와 `let/const`의 스코프 차이인 **함수 스코프 vs 블록 스코프** 를 살펴봅니다.

---

**지난 글:** [스코프 체인](/posts/js-scope-chain/)

**다음 글:** [함수 스코프 vs 블록 스코프](/posts/js-function-vs-block-scope/)

<br>
읽어주셔서 감사합니다. 😊
