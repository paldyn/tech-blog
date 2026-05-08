---
title: "Shadow DOM · Custom Elements — 웹 컴포넌트 기초"
description: "Custom Elements로 새로운 HTML 태그를 정의하고, Shadow DOM으로 스타일과 마크업을 캡슐화하는 웹 컴포넌트의 두 핵심 기술을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "DOM", "웹컴포넌트", "ShadowDOM", "CustomElements", "캡슐화"]
featured: false
draft: false
---

[지난 글](/posts/dom-resize-intersection-observer/)에서 ResizeObserver·IntersectionObserver로 요소의 크기와 가시성을 추적하는 방법을 살펴봤습니다. 이번에는 브라우저 네이티브 컴포넌트 모델인 **웹 컴포넌트**의 두 핵심 — `Custom Elements`와 `Shadow DOM` — 을 다룹니다.

---

## 웹 컴포넌트란

웹 컴포넌트는 재사용 가능한 커스텀 HTML 요소를 만드는 브라우저 표준 스펙의 묶음입니다. 세 가지 기술이 결합됩니다.

- **Custom Elements**: 새로운 HTML 태그 정의
- **Shadow DOM**: 스타일·DOM 캡슐화
- **HTML Template**: 재사용 가능한 마크업 청사진 (`<template>`, `<slot>`)

React·Vue 없이도 컴포넌트를 만들 수 있고, 프레임워크와 함께 사용할 수도 있습니다.

---

## Custom Elements

`HTMLElement`를 상속한 클래스를 `customElements.define(tag, class)`로 등록합니다. 태그명에는 반드시 하이픈(`-`)이 포함돼야 합니다.

```js
class GreetingEl extends HTMLElement {
  connectedCallback() {
    this.textContent = `안녕하세요, ${this.getAttribute('name')}님`;
  }
}
customElements.define('greeting-el', GreetingEl);
```

```html
<greeting-el name="철수"></greeting-el>
```

### 라이프사이클 콜백

| 콜백 | 호출 시점 |
|---|---|
| `constructor` | 인스턴스 생성 시 |
| `connectedCallback` | 문서 DOM에 삽입될 때 |
| `disconnectedCallback` | 문서에서 제거될 때 |
| `attributeChangedCallback(name, old, new)` | 감시 속성 변경 시 |
| `adoptedCallback` | 다른 document로 이전될 때 |

`attributeChangedCallback`이 실행되려면 정적 프로퍼티 `observedAttributes`에 감시할 속성 이름을 등록해야 합니다.

```js
static observedAttributes = ['theme', 'size'];

attributeChangedCallback(name, oldValue, newValue) {
  this.render();
}
```

---

## Shadow DOM

![Shadow DOM 구조](/assets/posts/dom-shadow-custom-elements-structure.svg)

Shadow DOM은 호스트 요소(`Shadow Host`)에 연결된 별도의 DOM 트리(`Shadow Root`)입니다. `document.querySelector()`로 내부 요소에 접근할 수 없고, CSS도 격리됩니다.

```js
const shadow = element.attachShadow({ mode: 'open' });
shadow.innerHTML = `
  <style>
    :host { display: block; padding: 16px; }
    p { color: navy; }  /* 외부 스타일에 영향 안 받음 */
  </style>
  <p>Shadow 내부 단락</p>
`;
```

`mode: 'open'`이면 `element.shadowRoot`로 외부 JS가 접근할 수 있습니다. `'closed'`면 `shadowRoot`가 `null`을 반환해 완전히 봉인됩니다.

### Shadow DOM과 CSS

- **:host**: Shadow Host 요소 자체를 선택합니다.
- **:host-context(selector)**: 특정 조상 아래에 있을 때 다른 스타일을 적용합니다.
- **::slotted(selector)**: `<slot>`에 배분된 Light DOM 자식을 선택합니다.
- **CSS 커스텀 프로퍼티**(`--var`)는 Shadow 경계를 넘어 상속됩니다. 외부에서 테마를 주입할 수 있는 유일한 CSS 채널입니다.

```css
/* 외부 CSS */
my-card { --card-bg: #f5f5f5; }

/* Shadow 내부 */
:host { background: var(--card-bg, white); }
```

---

## Custom Element + Shadow DOM 통합 예제

![Custom Element 구현 코드](/assets/posts/dom-shadow-custom-elements-code.svg)

```html
<my-card title="공지사항">
  <p>Shadow 외부 Light DOM 콘텐츠입니다.</p>
</my-card>
```

`<slot>`이 Light DOM의 자식(`<p>`)을 Shadow 트리 내에 투영합니다. 실제 DOM 이동 없이 렌더링 위치만 바뀝니다.

---

## 기존 HTML 요소 확장 (Customized built-in)

```js
class FancyButton extends HTMLButtonElement {
  connectedCallback() {
    this.style.fontWeight = 'bold';
  }
}
customElements.define('fancy-button', FancyButton, { extends: 'button' });
```

```html
<button is="fancy-button">클릭</button>
```

Safari는 Customized built-in을 지원하지 않으므로 폴리필이 필요합니다. Autonomous custom elements(`<my-el>` 형태)는 모든 모던 브라우저에서 지원됩니다.

---

## 언제 웹 컴포넌트를 쓸까

프레임워크 없는 위젯(대시보드 카드, 데이터 테이블), 크로스 프레임워크 라이브러리, 마이크로프론트엔드 경계 컴포넌트에 적합합니다. React·Vue 앱 내에서도 `customElements`로 만든 컴포넌트를 JSX/템플릿에 태그로 사용할 수 있습니다.

---

**지난 글:** [ResizeObserver · IntersectionObserver — 요소 크기와 가시성 감지](/posts/dom-resize-intersection-observer/)

**다음 글:** [template · slot — 웹 컴포넌트 마크업 청사진](/posts/dom-template-slot/)

<br>
읽어주셔서 감사합니다. 😊
