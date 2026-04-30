---
title: "Promise.withResolvers() — 외부에서 제어하는 Promise"
description: "ES2024에 추가된 Promise.withResolvers()로 Deferred 패턴을 간결하게 구현하는 방법과 이벤트 대기, 큐 일시정지 등 실전 활용 사례를 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Promise", "withResolvers", "Deferred", "비동기", "ES2024"]
featured: false
draft: false
---

[지난 글](/posts/js-array-immutable-methods/)에서 원본을 보존하는 불변 배열 메서드를 살펴봤습니다. 이번에는 비동기 제어의 새 도구인 **`Promise.withResolvers()`** 를 소개합니다. Promise를 생성한 뒤 그 `resolve`와 `reject`를 외부 어딘가에서 호출해야 할 때가 있습니다. 지금까지는 클로저를 이용한 보일러플레이트가 필요했는데, ES2024(Chrome 119+, Node 22+)에서 이 문제가 한 줄로 해결됩니다.

## Deferred 패턴이란?

Promise의 생성 위치와 결정 위치가 다른 패턴을 **Deferred(지연된 Promise)** 라고 부릅니다. 예를 들어 버튼 클릭을 기다리거나, WebSocket 연결 완료를 기다리거나, 큐를 일시정지하는 경우가 그렇습니다.

기존에는 다음과 같이 작성해야 했습니다.

```javascript
let resolve, reject;
const promise = new Promise((res, rej) => {
  resolve = res; // 클로저로 꺼냄
  reject  = rej;
});
// 나중에 resolve('value') 호출
```

`let` 선언 → `new Promise` 내부에서 할당 → 외부에서 사용이라는 세 단계가 필요합니다. 명확하지 않고 누군가는 `resolve`를 호출하기 전에 `undefined`라는 사실을 잊기도 합니다.

## Promise.withResolvers() 사용법

```javascript
const { promise, resolve, reject } = Promise.withResolvers();

setTimeout(() => resolve('done'), 1000);

const result = await promise;
console.log(result); // 'done'
```

구조 분해 한 줄로 `promise`, `resolve`, `reject` 세 가지를 동시에 얻습니다.

![Promise.withResolvers() 이전 vs 이후](/assets/posts/js-promise-with-resolvers-before-after.svg)

## 반환값 설명

`Promise.withResolvers()`는 세 프로퍼티를 가진 객체를 반환합니다.

| 프로퍼티 | 타입 | 설명 |
|---------|------|------|
| `promise` | `Promise<T>` | 대기하는 쪽이 `.then()` 또는 `await`로 구독 |
| `resolve` | `(value: T) => void` | 성공 신호를 보내는 함수 |
| `reject` | `(reason?: any) => void` | 실패 신호를 보내는 함수 |

## 실전 활용 패턴

![withResolvers() 활용 패턴](/assets/posts/js-promise-with-resolvers-usecases.svg)

### 이벤트 완료 대기

```javascript
function waitForClick(btn) {
  const { promise, resolve } = Promise.withResolvers();
  btn.addEventListener('click', resolve, { once: true });
  return promise;
}

await waitForClick(document.getElementById('ok'));
console.log('클릭됨');
```

### 큐 일시정지 / 재개

```javascript
class PausableQueue {
  #gate = null;

  pause() {
    this.#gate = Promise.withResolvers();
  }
  resume() {
    this.#gate?.resolve();
    this.#gate = null;
  }
  async process(task) {
    if (this.#gate) await this.#gate.promise;
    return task();
  }
}
```

`pause()` 호출 시 gate promise를 만들고, `resume()` 호출 시 resolve해서 대기 중인 `process`를 풀어줍니다.

### 콜백 API를 Promise로 변환

```javascript
function promisifyEvent(emitter, event) {
  const { promise, resolve, reject } = Promise.withResolvers();
  emitter.once(event, resolve);
  emitter.once('error', reject);
  return promise;
}
```

## 서브클래스 호환

`Promise.withResolvers()`는 `this`를 기반으로 동작하므로, `Promise` 서브클래스에서도 올바르게 작동합니다.

```javascript
class TrackedPromise extends Promise {}
const { promise } = TrackedPromise.withResolvers();
// promise instanceof TrackedPromise → true
```

## 호환성

- Chrome 119+, Firefox 121+, Safari 17.4+, Node.js 22+
- 폴리필: `Promise.withResolvers ??= function() { let r, j; const p = new this((...a) => [r, j] = a); return { promise: p, resolve: r, reject: j }; }`

## 정리

| 측면 | 이전 방식 | withResolvers() |
|------|---------|----------------|
| 코드 양 | 5~6줄 보일러플레이트 | 구조 분해 1줄 |
| 타입 안전 | `let` 초기화 불안정 | 항상 정의됨 |
| 서브클래스 | 별도 처리 필요 | 자동 지원 |
| 가독성 | 낮음 | 높음 |

Deferred 패턴이 필요한 상황에서 `Promise.withResolvers()`는 현재 가장 간결하고 의도 명확한 해결책입니다.

---

**지난 글:** [배열 불변 메서드 — 원본을 건드리지 않는 방법들](/posts/js-array-immutable-methods/)

**다음 글:** [ES 모듈 기초 — import/export 핵심 이해](/posts/js-esm-basics/)

<br>
읽어주셔서 감사합니다. 😊
