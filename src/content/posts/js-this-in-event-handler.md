---
title: "이벤트 핸들러와 this — currentTarget과 바인딩"
description: "DOM 이벤트 핸들러에서 this가 어떻게 결정되는지, e.target과 e.currentTarget의 차이, 그리고 클래스 메서드를 안전하게 이벤트 핸들러로 사용하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["javascript", "이벤트핸들러", "this", "currentTarget", "target", "addEventListener", "이벤트위임"]
featured: false
draft: false
---

[지난 글](/posts/js-class-method-this/)에서 클래스 메서드의 `this` 소실 문제와 해결책을 살펴봤습니다. DOM 이벤트 핸들러는 이 문제가 가장 자주 발생하는 실전 환경입니다. 이번에는 `addEventListener`에서 `this`가 어떻게 결정되는지, `e.target`과 `e.currentTarget`의 차이, 그리고 클래스와 결합할 때의 올바른 패턴을 살펴봅니다.

---

## addEventListener에서 일반 함수의 this

`addEventListener`에 일반 함수를 등록하면, 이벤트 발생 시 브라우저는 **핸들러가 등록된 요소**를 `this`로 설정합니다. 이는 `e.currentTarget`과 동일합니다.

```javascript
const button = document.querySelector('#btn');

button.addEventListener('click', function handleClick(e) {
  console.log(this === button);        // true
  console.log(this === e.currentTarget); // true
  console.log(this.id);               // 'btn'
});
```

이 동작은 DOM 이벤트 명세에 의해 보장됩니다. "이벤트 핸들러는 `currentTarget`을 `this`로 하여 실행된다"라고 정의되어 있습니다.

![이벤트 핸들러와 this — currentTarget](/assets/posts/js-this-in-event-handler-diagram.svg)

---

## e.target vs e.currentTarget

이벤트 버블링 맥락에서 두 프로퍼티는 다른 요소를 가리킬 수 있습니다.

```html
<div id="parent">
  <button id="child">클릭</button>
</div>
```

```javascript
const parent = document.getElementById('parent');

parent.addEventListener('click', function(e) {
  // 버튼을 클릭했을 때
  e.target;         // #child (실제로 클릭된 요소)
  e.currentTarget;  // #parent (핸들러가 등록된 요소)
  this;             // #parent (currentTarget과 동일)
});
```

- `e.target`: 이벤트가 발생한 **원래 요소** (버블링 시작점)
- `e.currentTarget`: 현재 핸들러가 **등록된 요소** (버블링 경로상의 현재 위치)
- `this`: 일반 함수에서 `e.currentTarget`과 동일

이벤트 위임(Event Delegation) 패턴에서 이 구분이 핵심입니다.

---

## 화살표 함수 핸들러의 this

화살표 함수를 핸들러로 사용하면 `this`는 DOM 요소가 아닌 **외부 렉시컬 환경의 `this`**입니다.

```javascript
button.addEventListener('click', (e) => {
  // 화살표 함수: this !== button
  console.log(this); // 전역 객체 또는 클래스 인스턴스
  // DOM 요소에 접근하려면 e.currentTarget 사용
  console.log(e.currentTarget); // button
});
```

화살표 함수 핸들러에서 DOM 요소가 필요하면 `this` 대신 `e.currentTarget`을 사용해야 합니다.

---

## 클래스 메서드를 이벤트 핸들러로 — 올바른 패턴

클래스 메서드를 `addEventListener`에 직접 넘기면 `this`가 `undefined`(엄격 모드)가 됩니다.

```javascript
class Toggle {
  active = false;

  toggle() {
    this.active = !this.active; // this = undefined → TypeError
  }
}

const t = new Toggle();
btn.addEventListener('click', t.toggle); // ❌ this 소실
```

![클래스 이벤트 핸들러 — this 유지 패턴](/assets/posts/js-this-in-event-handler-class.svg)

**올바른 방법 1 — 클래스 필드 화살표 함수**

```javascript
class Toggle {
  active = false;

  toggle = (e) => {
    this.active = !this.active; // this = Toggle 인스턴스 (항상)
    e.currentTarget.classList.toggle('active', this.active);
  };
}

const t = new Toggle();
btn.addEventListener('click', t.toggle); // ✓ this 유지
```

화살표 함수 내부에서 DOM 요소가 필요하면 `e.currentTarget`으로 접근합니다.

**올바른 방법 2 — 호출 시 래핑**

```javascript
class Toggle {
  active = false;
  toggle(e) {
    this.active = !this.active;
    e.currentTarget.classList.toggle('active', this.active);
  }
}

const t = new Toggle();
btn.addEventListener('click', (e) => t.toggle(e)); // ✓
// 또는
btn.addEventListener('click', t.toggle.bind(t));   // ✓
```

---

## 이벤트 위임과 this

이벤트 위임은 많은 자식 요소에 각각 핸들러를 붙이는 대신, 공통 부모에 하나만 등록하는 패턴입니다.

```javascript
const list = document.getElementById('list');

list.addEventListener('click', function(e) {
  // this = list (currentTarget)
  // e.target = 실제 클릭된 li 또는 그 자식

  // 원하는 요소 타입 확인 (이벤트 위임의 핵심)
  const item = e.target.closest('li');
  if (!item || !list.contains(item)) return;

  console.log(item.dataset.id); // 클릭된 li의 data-id
});
```

`e.target.closest('selector')`은 클릭된 요소부터 위로 올라가며 가장 가까운 매칭 요소를 반환합니다. 이벤트 위임의 핵심 도구입니다.

---

## inline onclick과 this

HTML `onclick` 속성에서 `this`는 요소 자체입니다.

```html
<!-- this = button 요소 -->
<button onclick="console.log(this)">클릭</button>

<!-- 외부 함수 호출 시 this는 전역 -->
<button onclick="handleClick()">클릭</button>

<!-- 외부 함수에 this 전달 -->
<button onclick="handleClick(this)">클릭</button>
```

`onclick` 속성은 유지보수 어려움, CSP(Content Security Policy) 제약 등의 이유로 현대 개발에서는 권장되지 않습니다.

---

## once, passive 옵션과 정리

`addEventListener`의 세 번째 인수(옵션 객체)로 핸들러 동작을 제어할 수 있습니다.

```javascript
const handler = (e) => {
  console.log('clicked');
};

// { once: true }: 한 번만 실행 후 자동 제거
button.addEventListener('click', handler, { once: true });

// { passive: true }: preventDefault 호출 없음을 보장 → 스크롤 성능 향상
window.addEventListener('touchmove', handler, { passive: true });

// 제거 (핸들러 참조 필요)
button.removeEventListener('click', handler);
```

`once: true` 옵션은 자동으로 핸들러를 제거하므로 `removeEventListener`가 필요 없어 메모리 관리에 편리합니다.

---

## 핵심 요약

| 상황 | this |
|------|------|
| 일반 함수 핸들러 | `e.currentTarget` (핸들러 등록 요소) |
| 화살표 함수 핸들러 | 외부 렉시컬 this |
| 클래스 메서드 직접 전달 | `undefined` (엄격) / 전역 (비엄격) |
| 클래스 필드 화살표 | 클래스 인스턴스 (안전) |
| HTML onclick 속성 | HTML 요소 |

이벤트 핸들러에서 `this`가 필요한 경우 어떤 방식으로 등록했는지 항상 확인하세요. 클래스와 함께 사용한다면 클래스 필드 화살표 함수 패턴이 가장 안전합니다.

---

**지난 글:** [클래스 메서드와 this — 잃어버리기 쉬운 컨텍스트](/posts/js-class-method-this/)

**다음 글:** [객체 생성 패턴 — 팩토리, 생성자, 클래스, Object.create](/posts/js-object-creation-patterns/)

<br>
읽어주셔서 감사합니다. 😊
