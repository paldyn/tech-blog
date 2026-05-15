---
title: "커스텀 이벤트 완전 이해"
description: "CustomEvent 생성, bubbles/detail/cancelable 옵션, dispatchEvent 반환값, EventTarget 상속 이벤트 버스 패턴까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "CustomEvent", "dispatchEvent", "EventTarget", "이벤트", "DOM"]
featured: false
draft: false
---

[지난 글](/posts/event-listener-options/)에서 `addEventListener`의 네 가지 옵션을 살펴봤습니다. 이번에는 브라우저 내장 이벤트가 아닌 **직접 만든 이벤트** — 커스텀 이벤트 — 를 생성하고 발송하는 방법을 다룹니다.

---

## CustomEvent란

브라우저는 `click`, `keydown`, `submit` 같은 내장 이벤트를 자동으로 발생시킵니다. `CustomEvent`는 개발자가 임의로 이름을 붙이고 데이터를 담아 발송할 수 있는 이벤트입니다. 컴포넌트 간 느슨한 결합, 모듈 간 통신, 이벤트 기반 아키텍처를 구현할 때 핵심 도구입니다.

```js
const event = new CustomEvent('user:login', {
  bubbles: true,
  cancelable: true,
  detail: { userId: 42, role: 'admin' },
});

document.dispatchEvent(event);
```

`new CustomEvent(type, init)` 형태로 생성합니다. `type`은 이벤트 이름 문자열이고, `init`에 옵션을 담습니다. 네임스페이스 충돌을 피하려면 `'user:login'`처럼 콜론(:)으로 구분하는 관습이 널리 쓰입니다.

![커스텀 이벤트 생명주기](/assets/posts/event-custom-events-lifecycle.svg)

---

## bubbles

기본값은 `false`입니다. `true`로 설정하면 이벤트가 DOM 트리를 따라 버블링됩니다.

```js
// bubbles: false (기본) — 발송 요소에서만 처리됨
const evt1 = new CustomEvent('modal:close');
modal.dispatchEvent(evt1);
// document에서는 수신 불가

// bubbles: true — 상위 요소에서도 수신 가능
const evt2 = new CustomEvent('modal:close', { bubbles: true });
modal.dispatchEvent(evt2);
// document까지 버블링됨
```

컴포넌트 내부에서만 처리하려면 `false`, 여러 조상 요소가 반응해야 하면 `true`를 씁니다.

---

## detail

`detail` 프로퍼티는 리스너에게 전달할 임의 데이터를 담습니다. `e.detail`로 접근합니다.

```js
const event = new CustomEvent('cart:updated', {
  bubbles: true,
  detail: {
    items: cartItems,
    total: calculateTotal(cartItems),
  },
});

document.dispatchEvent(event);

document.addEventListener('cart:updated', (e) => {
  renderCartBadge(e.detail.items.length);
  renderTotal(e.detail.total);
});
```

`detail`에 원시값, 객체, 배열 모두 담을 수 있지만, `postMessage`처럼 복사되지 않고 **참조가 전달**되므로 이벤트 발송 후 원본 객체를 변경하면 리스너에서도 변경이 보입니다. 불변성이 필요하다면 `structuredClone()`으로 복사해 담습니다.

---

## cancelable과 dispatchEvent 반환값

`cancelable: true`이면 리스너에서 `e.preventDefault()`를 호출할 수 있습니다. `dispatchEvent()`는 **동기적으로** 모든 리스너를 실행한 뒤, `preventDefault()`가 호출됐으면 `false`, 아니면 `true`를 반환합니다.

```js
const event = new CustomEvent('form:submit', {
  bubbles: true,
  cancelable: true,
  detail: { data: formData },
});

const allowed = form.dispatchEvent(event);

if (allowed) {
  submitToServer(formData);
} else {
  console.log('리스너가 제출을 취소함');
}
```

이 패턴은 "이벤트 기반 훅(hook)" — 리스너가 기본 동작을 취소할 권한을 갖는 구조 — 을 구현할 때 유용합니다.

---

## EventTarget 상속 이벤트 버스

DOM 요소 없이도 `EventTarget`을 상속하면 순수 JS 객체에서 이벤트 시스템을 사용할 수 있습니다.

```js
class Store extends EventTarget {
  #data = {};

  set(key, value) {
    const prev = this.#data[key];
    this.#data[key] = value;
    this.dispatchEvent(
      new CustomEvent('change', { detail: { key, value, prev } })
    );
  }

  get(key) {
    return this.#data[key];
  }
}

const store = new Store();

store.addEventListener('change', (e) => {
  console.log(`${e.detail.key} 변경:`, e.detail.prev, '→', e.detail.value);
});

store.set('theme', 'dark'); // "theme 변경: undefined → dark"
```

프레임워크 없이 반응형 상태 관리를 구현할 때 강력한 패턴입니다.

---

## TypeScript에서 타입 안전하게 사용하기

```ts
interface CartDetail {
  items: CartItem[];
  total: number;
}

type CartUpdatedEvent = CustomEvent<CartDetail>;

document.addEventListener('cart:updated', (e: CartUpdatedEvent) => {
  // e.detail은 CartDetail로 추론됨
  renderTotal(e.detail.total);
});

// 발송 헬퍼
function emitCartUpdate(items: CartItem[]) {
  document.dispatchEvent(
    new CustomEvent<CartDetail>('cart:updated', {
      bubbles: true,
      detail: { items, total: items.reduce((s, i) => s + i.price, 0) },
    })
  );
}
```

![커스텀 이벤트 코드 패턴](/assets/posts/event-custom-events-code.svg)

---

## 주의사항

**발송 전 리스너 등록**: `dispatchEvent`는 동기 실행이므로 발송 전에 리스너가 등록되어 있어야 합니다. 비동기 리스너가 필요하면 `setTimeout(0)` 또는 `queueMicrotask`로 발송을 지연합니다.

**이벤트 이름 네이밍**: 브라우저 내장 이름(`click`, `input` 등)을 재사용하면 혼란을 유발합니다. `네임스페이스:동작` 형태(예: `modal:open`, `cart:update`)를 권장합니다.

**메모리 관리**: 이벤트 버스 패턴에서는 컴포넌트 파괴 시 리스너를 제거해야 합니다. `AbortController`의 `signal` 옵션을 활용하면 일괄 제거가 쉽습니다.

---

## 정리

| 항목 | 설명 |
|---|---|
| `bubbles` | DOM 위로 전파 여부 |
| `cancelable` | `preventDefault()` 허용 여부 |
| `detail` | 리스너에 전달할 데이터 |
| `dispatchEvent()` | 동기 실행, 취소 여부 반환 |
| `EventTarget` 상속 | DOM 없이 이벤트 시스템 구현 |

커스텀 이벤트는 컴포넌트 경계를 넘는 통신을 DOM 트리에 자연스럽게 통합하는 표준 방법입니다.

---

**지난 글:** [addEventListener 옵션 완전 이해](/posts/event-listener-options/)

**다음 글:** [키보드·마우스·터치·포인터 이벤트 완전 이해](/posts/event-keyboard-mouse-touch-pointer/)

<br>
읽어주셔서 감사합니다. 😊
