---
title: "IIFE — 즉시 실행 함수 표현식 완전 정복"
description: "IIFE(Immediately Invoked Function Expression)의 문법·목적·역사적 배경, 클로저를 활용한 모듈 패턴, 비동기 IIFE, 그리고 ES 모듈 시대의 현재 역할을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "IIFE", "즉시실행함수", "모듈패턴", "클로저", "스코프격리", "레거시패턴"]
featured: false
draft: false
---

[지난 글](/posts/js-arguments-object/)에서 `arguments` 객체와 그 현대적 대체 방법을 살펴봤습니다. 이번에는 ES 모듈이 없던 시절 JavaScript 코드 구조화의 핵심이었던 **IIFE(Immediately Invoked Function Expression, 즉시 실행 함수 표현식)**를 다룹니다. 레거시 코드에서 빈번하게 등장하고, 오늘날에도 특정 상황에서 유용한 패턴입니다.

## IIFE란

함수를 정의하자마자 즉시 호출하는 표현식입니다. 핵심은 **함수를 표현식으로 만들어 즉시 호출**하는 것입니다.

```javascript
// 기본 형태 — 함수 전체를 괄호로 감싸기 (크록포드 스타일)
(function() {
  console.log('즉시 실행!');
}());

// 호출 괄호를 바깥에 두기 (더글라스 스타일)
(function() {
  console.log('즉시 실행!');
})();

// 화살표 함수 IIFE
(() => {
  console.log('즉시 실행!');
})();
```

괄호가 필요한 이유는 JavaScript 파서가 `function`으로 시작하는 문장을 선언식으로 해석하기 때문입니다. 괄호로 감싸거나 `void`, `!`, `+` 같은 단항 연산자를 앞에 붙이면 표현식 위치로 해석되어 즉시 호출이 가능해집니다.

```javascript
void function() { console.log('실행!'); }();
!function() { console.log('실행!'); }();
+function() { console.log('실행!'); }();
```

## 왜 IIFE가 필요했나

ES2015 이전에는 `var` 변수가 함수 스코프만 가졌고, 블록 스코프가 없었습니다. ES 모듈도 없었습니다. 이런 환경에서 코드를 모듈화하고 전역 네임스페이스 오염을 막는 유일한 방법이 IIFE였습니다.

```javascript
// ES2015 이전 — 전역 오염 없는 초기화
var MyApp = (function() {
  var _private = 'secret'; // 외부에서 접근 불가

  function init() {
    console.log('앱 시작');
  }

  return {
    init: init,
    version: '1.0'
  };
}());

MyApp.init();          // 정상 동작
console.log(MyApp._private); // undefined — 접근 불가
```

![IIFE 문법 형태](/assets/posts/js-iife-syntax.svg)

## 클로저 모듈 패턴

IIFE와 클로저를 결합하면 프라이빗 상태를 가진 모듈을 만들 수 있습니다.

```javascript
const counter = (function() {
  let _count = 0; // 프라이빗

  return {
    increment() { _count++; },
    decrement() { _count--; },
    getCount()  { return _count; },
    reset()     { _count = 0; },
  };
}());

counter.increment();
counter.increment();
counter.getCount(); // 2
counter._count;     // undefined — 직접 접근 불가
```

이 패턴은 **revealing module pattern**의 기반이었으며, ES2022 클래스 프라이빗 필드(`#`)가 등장하기 전까지 캡슐화의 표준 방식이었습니다.

![IIFE 모듈 패턴](/assets/posts/js-iife-module-pattern.svg)

## 초기화 값 전달

IIFE에 인수를 넘겨 외부 값을 안전하게 캡처할 수 있습니다. 미니파이어가 파라미터 이름을 줄여도 내부 동작은 보장됩니다.

```javascript
const app = (function(window, document, undefined) {
  // undefined를 명시적으로 파라미터에 올려 외부 변조 방지 (ES5 관용구)
  // window, document는 지역 변수로 미니파이 가능

  function onReady() {
    document.title = 'App Ready';
  }

  window.addEventListener('DOMContentLoaded', onReady);
  return { version: '1.0' };
}(window, document));
```

## 비동기 IIFE

Top-level await가 없던 시절, 모듈 최상단에서 `async`/`await`를 사용하려면 비동기 IIFE가 필요했습니다.

```javascript
(async function() {
  try {
    const config = await fetch('/api/config').then(r => r.json());
    initApp(config);
  } catch (err) {
    console.error('초기화 실패:', err);
  }
}());

// 화살표 버전
(async () => {
  const data = await loadData();
  render(data);
})();
```

오늘날 ES 모듈에서는 top-level await를 직접 사용할 수 있어 이 패턴이 불필요해졌습니다.

```javascript
// 현대 ES 모듈에서
const data = await loadData(); // 바로 사용 가능
render(data);
```

## for 루프 var 클로저 문제 해결 (역사적 패턴)

`var`와 루프의 클로저 문제를 IIFE로 해결하던 고전 패턴입니다.

```javascript
// 문제: 모든 핸들러가 i=5를 출력
for (var i = 0; i < 5; i++) {
  setTimeout(function() { console.log(i); }, i * 100);
}

// 해결: IIFE로 i를 캡처
for (var i = 0; i < 5; i++) {
  (function(j) {
    setTimeout(function() { console.log(j); }, j * 100);
  }(i));
}

// 현대 해결책: let 사용 (블록 스코프)
for (let i = 0; i < 5; i++) {
  setTimeout(() => console.log(i), i * 100);
}
```

## 현대 코드에서 IIFE

ES2015+ 환경에서 IIFE의 전통적 역할 대부분은 다른 기능이 대체했습니다.

- **스코프 격리** → ES 모듈 (각 파일이 독립 스코프)
- **프라이빗 상태** → 클래스 프라이빗 필드(`#`) 또는 클로저
- **블록 스코프** → `let`/`const`
- **비동기 초기화** → Top-level await

그럼에도 IIFE가 여전히 유용한 경우가 있습니다.

```javascript
// 복잡한 초기화 값을 const에 할당
const DATA = (() => {
  const raw = [/* 복잡한 처리 */];
  return Object.freeze(raw.map(transform));
})();

// 블록 스코프가 필요하지만 이름 없는 로직
{
  const temp = computeExpensive();
  useOnce(temp);
} // temp는 여기서 GC 대상

// 위와 동일한 효과를 IIFE로
(() => {
  const temp = computeExpensive();
  useOnce(temp);
})();
```

---

**지난 글:** [arguments 객체 완전 정복](/posts/js-arguments-object/)

**다음 글:** [고차 함수 완전 정복](/posts/js-higher-order-functions/)

<br>
읽어주셔서 감사합니다. 😊
