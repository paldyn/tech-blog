---
title: "이벤트 캡처·버블 — 전파 단계 완전 이해"
description: "이벤트가 DOM 트리를 이동하는 3단계(캡처, 타깃, 버블링)의 동작 원리와 addEventListener의 capture 옵션, stopPropagation/stopImmediatePropagation 사용법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "이벤트", "캡처", "버블링", "stopPropagation", "eventPhase", "DOM"]
featured: false
draft: false
---

[지난 글](/posts/event-delegation/)에서 버블링을 활용한 이벤트 위임 패턴을 알아봤습니다. 이번에는 그 근거가 되는 이벤트 전파의 3단계 — 캡처, 타깃, 버블링 — 을 원리부터 정확히 이해합니다.

---

## 이벤트 전파 3단계

브라우저에서 이벤트가 발생하면 단순히 해당 요소에만 전달되는 것이 아닙니다. W3C 이벤트 모델은 세 단계를 정의합니다.

1. **캡처 단계(Capture)**: `document` → `html` → `body` → … → 타깃의 **부모** 순서로 하향 이동
2. **타깃 단계(Target)**: 이벤트가 실제로 발생한 요소에서 리스너 실행
3. **버블링 단계(Bubble)**: 타깃 → 부모 → … → `document` 순서로 상향 이동

![이벤트 전파 3단계](/assets/posts/event-capture-bubble-phases.svg)

`addEventListener`의 세 번째 인자(또는 `{ capture: true }`)로 어느 단계에서 리스너를 실행할지 지정합니다. 기본값은 버블링 단계(`false`)입니다.

---

## 실행 순서

```html
<div id="outer">
  <button id="inner">클릭</button>
</div>
```

```js
const outer = document.querySelector('#outer');
const inner = document.querySelector('#inner');

outer.addEventListener('click', () => console.log('outer 캡처'), true);  // 캡처
inner.addEventListener('click', () => console.log('inner 타깃'));
outer.addEventListener('click', () => console.log('outer 버블'));          // 버블

// inner 클릭 시:
// 1. "outer 캡처"
// 2. "inner 타깃"
// 3. "outer 버블"
```

캡처 리스너는 버블 리스너보다 **항상** 먼저 실행됩니다.

![캡처·버블 실행 순서 코드](/assets/posts/event-capture-bubble-code.svg)

---

## e.eventPhase

현재 리스너가 어느 단계에서 실행되고 있는지 숫자로 알 수 있습니다.

| 값 | 단계 | 상수 |
|---|---|---|
| 1 | 캡처 | `Event.CAPTURING_PHASE` |
| 2 | 타깃 | `Event.AT_TARGET` |
| 3 | 버블링 | `Event.BUBBLING_PHASE` |

```js
document.addEventListener('click', e => {
  console.log(e.eventPhase); // 1 (document에서 캡처 단계)
});
```

---

## 전파 중단

### stopPropagation

현재 리스너 실행 후 **이후 전파를 중단**합니다. 같은 요소에 등록된 나머지 리스너는 계속 실행됩니다.

```js
inner.addEventListener('click', e => {
  e.stopPropagation(); // outer의 버블 리스너는 실행 안 됨
  console.log('inner 처리');
});
```

### stopImmediatePropagation

같은 요소의 나머지 리스너까지 **즉시 모두 중단**합니다.

```js
inner.addEventListener('click', e => {
  e.stopImmediatePropagation();
  console.log('이 리스너만 실행됨');
});

inner.addEventListener('click', () => {
  console.log('이 리스너는 실행 안 됨'); // 호출되지 않음
});
```

### preventDefault vs stopPropagation

`preventDefault`는 이벤트 기본 동작(링크 이동, 폼 제출 등)을 막지만, 전파를 막지는 않습니다. 두 메서드는 독립적입니다.

```js
a.addEventListener('click', e => {
  e.preventDefault();    // 링크 이동 막기
  // 버블링은 계속됨
});
```

---

## 버블링하지 않는 이벤트

모든 이벤트가 버블링하지는 않습니다. `focus`, `blur`, `mouseenter`, `mouseleave`, `load`, `scroll`(일부) 등이 버블링하지 않습니다.

| 버블링 없음 | 버블링 대안 |
|---|---|
| `focus` | `focusin` |
| `blur` | `focusout` |
| `mouseenter` | `mouseover` |
| `mouseleave` | `mouseout` |

이벤트 위임이 필요한 경우 버블링 대안을 사용하거나 캡처 단계를 이용합니다.

---

## addEventListener 옵션 정리

```js
element.addEventListener('click', handler, {
  capture: false,  // 기본: 버블 단계
  once: true,      // 한 번 발화 후 자동 removeEventListener
  passive: true,   // preventDefault 호출 안 함을 브라우저에 알림 (스크롤 성능)
  signal: controller.signal, // AbortController로 제거
});
```

`passive: true`는 터치/스크롤 이벤트에서 `preventDefault`를 호출하지 않음을 브라우저에 미리 알려 스크롤을 최적화합니다. Chrome은 `touchstart`, `touchmove`, `wheel` 이벤트의 기본값을 `passive: true`로 설정합니다.

---

이벤트 전파를 이해하면 위임 패턴을 제대로 설계하고, 예상치 못한 이벤트 처리를 디버그할 수 있습니다. "캡처는 하향, 버블은 상향"으로 기억하고, `closest()`와 함께 조합하면 됩니다.

---

**지난 글:** [이벤트 위임 — 효율적인 이벤트 리스너 관리](/posts/event-delegation/)

**다음 글:** [event.target · currentTarget · relatedTarget 완전 이해](/posts/event-object-currenttarget/)

<br>
읽어주셔서 감사합니다. 😊
