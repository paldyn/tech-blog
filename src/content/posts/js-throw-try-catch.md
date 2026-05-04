---
title: "throw와 try/catch/finally — 에러 전파의 기초"
description: "throw 문의 동작 원리, try/catch/finally의 실행 순서, 에러를 재통(rethrow)해야 하는 이유를 정리합니다. 에러 처리의 가장 기본이 되는 메커니즘입니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "throw", "try", "catch", "finally", "에러처리", "rethrow"]
featured: false
draft: false
---

[지난 글](/posts/js-async-queue-semaphore/)에서 비동기 흐름 제어 패턴을 살펴봤습니다. 이번에는 JavaScript 에러 처리의 가장 기본인 `throw`와 `try/catch/finally`의 동작 원리를 정확히 짚어봅니다.

## throw — 어떤 값이든 던질 수 있다

`throw`는 **표현식**이 아니라 **문(statement)**입니다. 어떤 값이든 던질 수 있지만, 항상 `Error` 객체(또는 그 서브클래스)를 던져야 합니다.

```js
throw new Error('메시지');         // 권장
throw new TypeError('타입 불일치'); // 내장 서브클래스
throw '문자열';                     // 비권장 — 스택 트레이스 없음
throw 42;                           // 비권장
```

문자열이나 숫자를 던지면 `catch (e)`에서 `e.stack`을 사용할 수 없어 디버깅이 어려워집니다. `Error` 객체를 던지면 발생 위치와 호출 스택이 자동으로 기록됩니다.

## 에러 전파 — 콜 스택을 거슬러 올라간다

`throw`된 에러는 현재 실행 컨텍스트를 즉시 빠져나가 `catch`를 만날 때까지 콜 스택을 거슬러 올라갑니다.

```js
function parseJSON(text) {
  if (!text.startsWith('{')) throw new SyntaxError('잘못된 JSON');
  return JSON.parse(text);
}

function loadConfig(path) {
  const text = readFile(path);
  return parseJSON(text); // parseJSON에서 throw → 여기로 전파
}

function main() {
  try {
    const config = loadConfig('./config.json');
    start(config);
  } catch (e) {
    // parseJSON에서 던진 에러가 여기서 포착됨
    console.error('설정 로드 실패:', e.message);
  }
}
```

![throw — 콜 스택 위로 에러 전파](/assets/posts/js-throw-try-catch-flow.svg)

중간에 `catch` 없이 에러를 그대로 통과시키는 것을 **에러 전파(propagation)**라 합니다. 각 함수가 에러를 처리할 필요 없이, 의미 있는 컨텍스트가 있는 곳에서 포착합니다.

## try/catch/finally 실행 순서

```js
function example() {
  try {
    console.log('1: try');
    throw new Error('oops');
    console.log('2: 실행 안 됨');
  } catch (e) {
    console.log('3: catch', e.message);
    return 'caught'; // return이 있어도 finally 실행
  } finally {
    console.log('4: finally'); // 항상 실행
  }
  console.log('5: 실행 안 됨 (catch에서 return)');
}

example();
// 출력: "1: try" → "3: catch oops" → "4: finally"
```

`finally`는 `try` 또는 `catch` 블록에 `return`, `break`, `continue`, `throw`가 있어도 **항상 실행**됩니다. 자원 해제(DB 연결 닫기, 락 해제, 타이머 정리)에 적합합니다.

## 에러 유형에 따른 선택적 처리

```js
try {
  await fetchData(url);
} catch (e) {
  if (e instanceof NetworkError) {
    // 네트워크 오류 → 재시도
    return retry(url);
  }
  if (e instanceof AuthError) {
    // 인증 오류 → 로그아웃
    return logout();
  }
  throw e; // 알 수 없는 에러는 반드시 재통
}
```

모든 에러를 한 번에 삼키는 것은 위험합니다. 처리할 수 있는 유형만 처리하고, 나머지는 `throw e`로 상위에 전파해야 합니다.

![try / catch / finally 핵심 패턴](/assets/posts/js-throw-try-catch-patterns.svg)

## finally 안에서의 return — 주의

```js
function tricky() {
  try {
    throw new Error('oops');
  } finally {
    return 'finally 값'; // 에러를 억제하고 이 값이 반환됨!
  }
}

console.log(tricky()); // 'finally 값' — 에러가 사라짐
```

`finally` 블록에서 `return`하면 `try`/`catch`에서 발생한 에러나 반환값을 **덮어씁니다**. 이는 의도치 않은 에러 억제로 이어지므로, `finally`에서는 `return`을 쓰지 않아야 합니다.

## Optional Catch Binding — ES2019

에러 변수가 필요 없을 때는 `catch` 다음 괄호를 생략할 수 있습니다.

```js
function safeParseInt(str) {
  try {
    return parseInt(str, 10);
  } catch {
    // e 없어도 됨
    return 0;
  }
}
```

## 동기와 비동기 에러 처리의 차이

```js
// 동기: try/catch로 포착 가능
try {
  JSON.parse('invalid');
} catch (e) {
  console.error(e); // SyntaxError
}

// 비동기: setTimeout 콜백의 throw는 포착 불가
try {
  setTimeout(() => { throw new Error('async error'); }, 0);
} catch (e) {
  // 여기서 포착되지 않음!
}

// 올바른 방법: async/await + try/catch
async function main() {
  try {
    await asyncOperation();
  } catch (e) {
    console.error(e);
  }
}
```

`setTimeout`, `Promise` 콜백 등 비동기 컨텍스트에서 발생한 에러는 외부의 동기 `try/catch`로 포착할 수 없습니다.

## 정리

- `throw`는 `Error` 객체를 던질 것 — 문자열/숫자는 스택 트레이스 없음
- 에러는 `catch`를 만날 때까지 콜 스택을 거슬러 올라감
- `finally`는 항상 실행 — 자원 해제 코드 위치
- `finally`에서 `return` 금지 — 에러가 조용히 사라짐
- 처리 못 하는 에러는 반드시 `throw e`로 재통

---

**지난 글:** [비동기 큐와 세마포어 — 흐름 제어 패턴](/posts/js-async-queue-semaphore/)

**다음 글:** [Error 객체와 스택 트레이스 — 구조와 활용](/posts/js-error-object-stack/)

<br>
읽어주셔서 감사합니다. 😊
