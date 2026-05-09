---
title: "preventDefault · stopPropagation 완전 이해"
description: "브라우저 기본 동작 취소, 이벤트 전파 차단, 즉시 중단까지 세 메서드의 차이와 올바른 사용법을 코드 예시와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "이벤트", "preventDefault", "stopPropagation", "DOM", "이벤트전파"]
featured: false
draft: false
---

[지난 글](/posts/event-object-currenttarget/)에서 `target`, `currentTarget`, `relatedTarget`의 차이를 살펴봤습니다. 이번에는 이벤트가 발생했을 때 그 흐름을 개발자가 직접 제어하는 세 가지 메서드 — `preventDefault()`, `stopPropagation()`, `stopImmediatePropagation()` — 의 동작 원리와 올바른 사용 패턴을 정리합니다.

---

## 세 메서드가 하는 일

이벤트 리스너 안에서 `e.preventDefault()`를 호출하면 브라우저가 그 이벤트에 기본적으로 수행하는 동작을 취소합니다. 링크 클릭 시 페이지 이동, 폼 제출 시 새로고침, `contextmenu` 이벤트 시 우클릭 메뉴 표시 같은 것들이 여기에 해당합니다. 중요한 점은 **이벤트 전파 자체는 그대로 진행**된다는 것입니다.

`e.stopPropagation()`은 정반대 역할입니다. 이벤트가 DOM 트리를 따라 올라가거나 내려가는 **전파 자체를 차단**하지만, 브라우저 기본 동작은 막지 않습니다. 모달 컴포넌트가 내부 클릭 이벤트를 `document`의 "외부 클릭 감지" 리스너로부터 격리할 때 전형적으로 사용됩니다.

`e.stopImmediatePropagation()`은 두 가지를 모두 합니다. 전파를 차단할 뿐 아니라, **같은 요소에 등록된 나머지 리스너들도 실행하지 않습니다**. 플러그인 충돌 방지나 우선순위 처리 로직에 유용하지만, 코드 복잡도를 높이므로 꼭 필요한 곳에만 씁니다.

![이벤트 전파 제어 메서드 비교](/assets/posts/event-prevent-stop-propagation-flow.svg)

---

## preventDefault() 실전 패턴

```html
<a id="link" href="/about">소개 페이지</a>
```

```js
const link = document.getElementById('link');

link.addEventListener('click', (e) => {
  e.preventDefault();          // 페이지 이동 취소
  navigateSPA(e.currentTarget.href); // SPA 라우팅
});
```

이벤트에 따라 `cancelable` 프로퍼티가 `false`인 경우(예: `scroll` 이벤트)가 있습니다. 이때는 `preventDefault()`를 호출해도 아무 효과가 없으므로, 범용 유틸리티를 만들 때는 미리 확인하는 습관이 좋습니다.

```js
function safePrevent(e) {
  if (e.cancelable) e.preventDefault();
}
```

`passive: true` 옵션으로 등록된 리스너에서 `preventDefault()`를 호출하면 브라우저가 콘솔 경고를 출력하고 무시합니다. `touchstart`, `touchmove`, `wheel` 이벤트의 스크롤 성능을 최적화하기 위해 브라우저가 이 이벤트들을 기본적으로 passive로 처리하기 때문입니다.

---

## stopPropagation() 실전 패턴

모달 외부 클릭 감지는 `stopPropagation()`의 가장 대표적인 사용 사례입니다.

```js
const modal = document.getElementById('modal');

// 모달 내부 클릭이 document로 버블링되지 않음
modal.addEventListener('click', (e) => {
  e.stopPropagation();
});

// 모달 외부 클릭 시에만 실행됨
document.addEventListener('click', () => {
  closeModal();
});
```

단, 이 패턴은 하나의 문제를 내포합니다. `modal` 안에서 발생한 이벤트가 `document`에 등록된 **다른 리스너**(분석 추적, 전역 단축키 등)에도 전달되지 않습니다. 가능하다면 `stopPropagation()` 대신 `e.target.closest('.modal')`로 클릭 위치를 판별하는 것이 더 안전합니다.

---

## stopImmediatePropagation()

```js
const btn = document.getElementById('btn');

// 첫 번째 리스너: 실행 후 즉시 중단
btn.addEventListener('click', (e) => {
  console.log('첫 번째 리스너');
  e.stopImmediatePropagation();
});

// 두 번째 리스너: 실행되지 않음
btn.addEventListener('click', () => {
  console.log('두 번째 리스너'); // ← 여기 도달 불가
});
```

리스너 실행 순서는 등록 순서를 따르므로, `stopImmediatePropagation()`을 사용할 때는 **리스너 등록 순서를 명확히 관리**해야 합니다. 외부 라이브러리가 동일한 요소에 리스너를 등록하는 경우 예기치 않은 부작용이 생길 수 있습니다.

---

## 세 메서드 조합

세 메서드는 독립적이므로 함께 사용할 수 있습니다.

```js
form.addEventListener('submit', (e) => {
  e.preventDefault();    // 폼 전송 차단
  e.stopPropagation();   // 버블링 차단
  validateAndSubmit();   // 직접 처리
});
```

![전파 제어 코드 패턴](/assets/posts/event-prevent-stop-propagation-code.svg)

---

## defaultPrevented 확인

리스너가 중첩된 경우, 상위 리스너에서 이미 `preventDefault()`가 호출됐는지 확인할 수 있습니다.

```js
document.addEventListener('click', (e) => {
  if (e.defaultPrevented) return; // 이미 처리됨
  // 전역 처리 로직
});
```

이 패턴은 라이브러리와 애플리케이션 코드 사이의 책임을 명확히 분리할 때 유용합니다.

---

## 정리

| 메서드 | 기본 동작 취소 | 버블링 차단 | 동일 요소 나머지 리스너 |
|---|---|---|---|
| `preventDefault()` | ✅ | ❌ | 실행됨 |
| `stopPropagation()` | ❌ | ✅ | 실행됨 |
| `stopImmediatePropagation()` | ❌ | ✅ | 차단됨 |

세 메서드를 조합하면 이벤트 흐름을 세밀하게 제어할 수 있습니다. 다만 `stopPropagation()`의 남용은 이벤트 위임 패턴이나 서드파티 라이브러리와 충돌할 수 있으므로, 꼭 필요한 경우에만 사용합니다.

---

**지난 글:** [event.target · currentTarget · relatedTarget 완전 이해](/posts/event-object-currenttarget/)

**다음 글:** [addEventListener 옵션 완전 이해](/posts/event-listener-options/)

<br>
읽어주셔서 감사합니다. 😊
