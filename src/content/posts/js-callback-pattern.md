---
title: "콜백 패턴 — 비동기의 시작과 콜백 헬"
description: "JavaScript 비동기의 원형인 콜백 패턴의 구조와 유형을 이해하고, 콜백 헬이 왜 발생하는지, 어떻게 벗어날 수 있는지 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "콜백", "비동기", "콜백헬", "에러퍼스트", "이벤트리스너", "비동기패턴"]
featured: false
draft: false
---

[지난 글](/posts/js-module-system/)에서 이벤트 루프를 살펴봤습니다. 콜 스택이 비면 이벤트 루프가 큐에서 함수를 꺼내 실행한다고 했습니다. 그 "큐에 들어가는 함수"가 바로 **콜백(Callback)** 입니다.

콜백은 JavaScript 비동기의 출발점입니다. "나중에 실행할 함수를 지금 인자로 넘겨라" — 이 단순한 아이디어 위에 초기 JavaScript의 비동기 모델이 만들어졌습니다. 그리고 이 단순함이 복잡해지면서 **콜백 헬(Callback Hell)** 이라는 악명 높은 문제가 생겼고, 이것이 Promise와 async/await 탄생의 직접적인 동기가 됩니다.

---

## 콜백이란

콜백은 다른 함수에 인자로 전달되어, 특정 시점에 그 함수에 의해 호출되는 함수입니다. "나중에 불러줘(call me back)"에서 이름이 왔습니다.

```js
function greet(name, callback) {
  const message = `안녕하세요, ${name}!`;
  callback(message);
}

greet("지민", (msg) => console.log(msg)); // "안녕하세요, 지민!"
```

이 예제는 동기적 콜백입니다. `greet`가 실행될 때 `callback`도 즉시 호출됩니다. 함수가 일급 객체인 JavaScript에서 콜백은 자연스러운 패턴입니다.

---

## 세 가지 콜백 유형

콜백은 실행 시점에 따라 크게 세 가지로 나뉩니다.

![콜백 패턴의 세 가지 유형 — 동기, 비동기, 이벤트 기반](/assets/posts/js-callback-pattern-types.svg)

**동기 콜백**은 콜 스택에서 즉시 실행됩니다. `Array.prototype.forEach`, `map`, `filter`, `sort`가 대표적입니다. 이벤트 루프와 무관하고, 순서가 보장됩니다.

**비동기 콜백**은 나중에 실행됩니다. `setTimeout`, `setInterval`, Node.js의 `fs.readFile`, `http.get` 등이 이 범주입니다. 완료되면 태스크 큐나 마이크로태스크 큐에 들어가 이벤트 루프를 통해 실행됩니다.

**이벤트 기반 콜백**은 특정 이벤트가 발생할 때마다 실행됩니다. DOM의 `addEventListener`, Node.js의 `EventEmitter`가 이 패턴을 사용합니다. 한 번 등록하면 이벤트가 발생할 때마다 반복 호출됩니다.

---

## 에러 퍼스트 콜백 (Node.js 관례)

Node.js에서는 비동기 콜백의 첫 번째 인자로 에러 객체를 전달하는 관례가 있습니다. 성공하면 `null`, 실패하면 Error 인스턴스입니다.

```js
const fs = require("fs");

fs.readFile("data.txt", "utf8", (err, data) => {
  if (err) {
    console.error("파일 읽기 실패:", err.message);
    return;
  }
  console.log("파일 내용:", data);
});
```

이 관례는 Node.js 초창기부터 정착된 표준입니다. 덕분에 콜백을 받는 모든 함수가 동일한 시그니처를 가지게 되었고, 유틸리티 함수 작성이 일관됩니다. 하지만 매번 `if (err) return handle(err);`를 작성해야 한다는 반복 부담이 있습니다.

---

## 콜백 헬의 발생

비동기 작업이 여럿 연속으로 이어질 때 문제가 생깁니다. "로그인 → 프로필 조회 → 주문 내역 조회 → 필터링 → 렌더링"처럼 앞 단계 결과가 다음 단계 입력이 되는 순차 비동기 처리는 콜백 중첩으로 이어집니다.

![콜백 헬 — 중첩이 깊어지는 피라미드 구조와 문제점](/assets/posts/js-callback-pattern-hell.svg)

오른쪽으로 계속 들여쓰이는 코드를 "콜백 헬" 또는 "파멸의 피라미드(Pyramid of Doom)"라 부릅니다. 각 단계에서 오류 처리를 반복해야 하고, 코드를 읽는 방향이 뒤틀립니다.

---

## 콜백 헬에서 벗어나는 첫 번째 방법: 함수 분리

가장 단순한 개선은 인라인 함수를 명명 함수로 분리하는 것입니다.

```js
// 콜백 헬 버전
login(user, (err, session) => {
  if (err) return handleErr(err);
  getProfile(session, (err, profile) => {
    if (err) return handleErr(err);
    // ...
  });
});

// 함수 분리 버전
function onLogin(err, session) {
  if (err) return handleErr(err);
  getProfile(session, onProfile);
}

function onProfile(err, profile) {
  if (err) return handleErr(err);
  getOrders(profile, onOrders);
}

login(user, onLogin);
```

들여쓰기 깊이는 해소되지만 코드가 흩어집니다. 흐름을 파악하려면 여러 함수를 번갈아 봐야 합니다.

---

## 제어의 역전 문제

콜백 패턴에는 구조적인 문제가 있습니다. **제어의 역전(Inversion of Control)** 입니다. 콜백을 전달하면 언제, 몇 번, 어떤 인자로 호출될지를 내가 제어하지 못하고 상대방 함수가 결정합니다.

```js
thirdPartyLib.doSomething(data, (result) => {
  // 이 콜백이 몇 번 호출될지 확신할 수 없다
  // 오류가 삼켜질 수도 있다
  // 동기로 호출될지 비동기로 호출될지 모를 수도 있다
});
```

신뢰할 수 없는 외부 라이브러리에 콜백을 넘기는 것은 자신의 코드 실행을 신뢰하지 못하는 라이브러리에 위임하는 셈입니다. Promise는 이 제어의 역전 문제를 해결하기 위해 설계됩니다.

---

## 콜백은 여전히 유효하다

콜백의 문제점을 많이 이야기했지만, 콜백 자체는 여전히 JavaScript의 중요한 패턴입니다.

- `Array.map`, `filter`, `reduce` 같은 고차 함수는 동기 콜백을 받으며 여전히 일상적으로 씁니다.
- DOM 이벤트 리스너는 콜백 기반입니다. `addEventListener`를 Promise로 바꿀 이유가 없습니다.
- 간단한 타이머나 단발성 비동기 작업은 콜백으로 충분합니다.

문제는 **순차적 비동기 처리**를 콜백으로 표현할 때입니다. 이 지점에서 Promise와 async/await가 빛을 발합니다.

---

콜백 패턴은 JavaScript 비동기의 토대이자, 더 나은 패턴이 왜 필요한지를 보여주는 교훈입니다. 다음 글에서는 **Promise**를 살펴봅니다. 비동기 작업을 값으로 다루고, 체이닝으로 순차 처리를 표현하며, 에러를 중앙화하는 방법을 알아보겠습니다.

---

**지난 글:** [모듈 시스템 — CommonJS에서 ES Module까지](/posts/js-module-system/)

**다음 글:** [이벤트 루프 — 싱글 스레드가 비동기를 다루는 방법](/posts/js-event-loop/)

<br>
읽어주셔서 감사합니다. 😊
