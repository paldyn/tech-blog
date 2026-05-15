---
title: "addEventListener 옵션 완전 이해"
description: "capture, once, passive, signal 네 가지 옵션의 동작 원리와 removeEventListener 시 옵션 일치 규칙, AbortController 패턴까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "addEventListener", "이벤트", "passive", "capture", "AbortController", "DOM"]
featured: false
draft: false
---

[지난 글](/posts/event-prevent-stop-propagation/)에서 `preventDefault()`와 `stopPropagation()`으로 이벤트 흐름을 제어하는 법을 살펴봤습니다. 이번에는 `addEventListener`의 세 번째 인수에 전달할 수 있는 옵션 객체 — `capture`, `once`, `passive`, `signal` — 를 하나씩 해부합니다.

---

## 옵션 객체 기본 문법

`addEventListener`는 세 번째 인수로 불리언(`useCapture`) 또는 옵션 객체를 받습니다. 불리언 형태는 레거시 API이고, 옵션 객체가 현대적 방식입니다.

```js
element.addEventListener(type, listener, {
  capture: false,  // 기본값
  once:    false,
  passive: false,
  signal:  undefined,
});
```

네 옵션은 독립적이며 조합해서 사용할 수 있습니다.

![addEventListener 옵션 한눈에 보기](/assets/posts/event-listener-options-diagram.svg)

---

## capture

`capture: true`로 등록하면 이벤트가 대상 요소에 도달하기 **전**, 캡처 단계에서 리스너가 실행됩니다.

```js
// 캡처 단계에서 모든 클릭 이벤트를 선제 처리
document.addEventListener('click', (e) => {
  console.log('캡처:', e.target.tagName);
}, { capture: true });
```

캡처 리스너는 버블링 리스너보다 먼저 실행됩니다. 이벤트 위임을 하위 요소보다 상위에서 먼저 처리해야 할 때, 또는 하위 요소의 `stopPropagation()`을 우회할 때 유용합니다.

**주의**: `removeEventListener`에도 동일한 `capture` 옵션을 전달해야 제거됩니다. 이 불일치가 메모리 누수의 원인이 됩니다.

```js
// 등록
el.addEventListener('click', handler, { capture: true });

// 제거 — capture: true를 반드시 동일하게 명시
el.removeEventListener('click', handler, { capture: true });
```

---

## once

`once: true`는 리스너를 **딱 한 번** 실행한 뒤 자동으로 제거합니다. 수동으로 `removeEventListener`를 호출할 필요가 없습니다.

```js
// 최초 스크롤 이벤트 한 번만 처리
window.addEventListener('scroll', initLazyLoad, { once: true });

// 애니메이션 종료 시 정리
el.addEventListener('transitionend', cleanup, { once: true });
```

초기화 로직, 튜토리얼 트리거, 일회성 애니메이션 콜백에 자주 사용됩니다.

---

## passive

`passive: true`는 브라우저에게 "이 리스너에서 `preventDefault()`를 절대 호출하지 않겠다"고 약속합니다. 브라우저는 이 약속을 믿고 스크롤 렌더링을 메인 스레드 JS 실행과 **동시에 진행**할 수 있어 스크롤 성능이 크게 향상됩니다.

```js
// 스크롤 이벤트 — passive로 등록해 렌더링 지연 방지
window.addEventListener('scroll', onScroll, { passive: true });

// touchstart/touchmove도 passive 권장
el.addEventListener('touchmove', onMove, { passive: true });
```

`passive: true` 리스너에서 `preventDefault()`를 호출하면 브라우저가 경고를 출력하고 무시합니다. Chrome 등 주요 브라우저는 `touchstart`, `touchmove`, `wheel` 이벤트를 `document`/`body`에 등록할 때 기본적으로 passive로 처리합니다.

---

## signal (AbortController 연동)

`signal` 옵션은 `AbortController`의 `AbortSignal`을 받아, `controller.abort()`가 호출되면 리스너를 자동 제거합니다.

```js
const controller = new AbortController();
const { signal } = controller;

// 여러 리스너를 같은 signal로 등록
document.addEventListener('keydown', onKey, { signal });
document.addEventListener('mousemove', onMove, { signal });
el.addEventListener('click', onClick, { signal });

// 한 번에 모두 제거 — removeEventListener 없이
controller.abort();
```

컴포넌트 언마운트, 다이얼로그 닫기, 라우트 변경 등 "정리(cleanup)" 시점에 여러 리스너를 일괄 제거할 때 특히 강력합니다. `removeEventListener`의 옵션 불일치 실수도 없앨 수 있습니다.

---

## 옵션 코드 패턴 정리

![옵션 사용 코드 패턴](/assets/posts/event-listener-options-code.svg)

---

## 옵션 감지 (Feature Detection)

구형 브라우저는 옵션 객체를 지원하지 않을 수 있습니다. 아래 패턴으로 지원 여부를 확인합니다.

```js
let passiveSupported = false;
try {
  const opts = Object.defineProperty({}, 'passive', {
    get() { passiveSupported = true; },
  });
  window.addEventListener('test', null, opts);
  window.removeEventListener('test', null, opts);
} catch (_) {}

const listenerOpts = passiveSupported ? { passive: true } : false;
el.addEventListener('touchstart', fn, listenerOpts);
```

현대 브라우저는 모두 옵션 객체를 지원하므로, 새 프로젝트에서는 이 감지 코드 없이 바로 옵션 객체를 사용해도 됩니다.

---

## 정리

| 옵션 | 언제 쓰나 |
|---|---|
| `capture: true` | 하위 요소보다 먼저 실행해야 할 때 |
| `once: true` | 초기화, 일회성 콜백 |
| `passive: true` | 스크롤/터치 성능 최적화 |
| `signal` | 컴포넌트 cleanup 시 일괄 제거 |

옵션 객체는 코드 의도를 명시적으로 드러내고, `signal`을 활용하면 리스너 관리 코드가 훨씬 간결해집니다.

---

**지난 글:** [preventDefault · stopPropagation 완전 이해](/posts/event-prevent-stop-propagation/)

**다음 글:** [커스텀 이벤트 완전 이해](/posts/event-custom-events/)

<br>
읽어주셔서 감사합니다. 😊
