---
title: "classList · attributes · dataset — 요소 속성 조작 API"
description: "classList로 CSS 클래스를 관리하고, getAttribute/setAttribute로 속성을 다루며, dataset으로 data-* 사용자 데이터를 읽고 쓰는 실무 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "DOM", "classList", "dataset", "getAttribute", "setAttribute", "속성"]
featured: false
draft: false
---

[지난 글](/posts/dom-create-insert-remove/)에서 DOM 요소를 생성·삽입·제거하는 방법을 살펴봤습니다. 이번에는 요소의 클래스와 속성을 읽고 쓰는 API — `classList`, `getAttribute`/`setAttribute`, `dataset` — 를 정리합니다.

---

## classList — CSS 클래스 관리

`className`은 클래스 전체를 하나의 문자열로 관리해 개별 클래스 조작이 불편합니다. `classList`는 `DOMTokenList` 인터페이스로 각 클래스를 독립적으로 다룹니다.

```javascript
const el = document.querySelector('.btn');

// className 방식 (구형, 불편)
el.className = el.className + ' active'; // 공백 처리 실수 잦음

// classList 방식 (권장)
el.classList.add('active');         // 없으면 추가
el.classList.remove('active');      // 있으면 제거
el.classList.toggle('active');      // 토글
el.classList.contains('active');    // true/false
el.classList.replace('old', 'new'); // 교체 (반환: 성공 여부)
```

![classList · DOMTokenList API](/assets/posts/dom-classlist-api.svg)

### 다중 클래스 조작

```javascript
// add/remove는 여러 클래스 동시 처리 가능
el.classList.add('active', 'highlighted', 'large');
el.classList.remove('disabled', 'hidden');
```

### toggle의 force 인자

```javascript
// force: true → 무조건 추가 (add와 같음)
// force: false → 무조건 제거 (remove와 같음)
el.classList.toggle('active', isLoggedIn);
el.classList.toggle('error', hasError);

// 상태 기반 클래스 설정 패턴
['loading', 'success', 'error'].forEach(s => el.classList.remove(s));
el.classList.add(currentState);
```

### classList 이터레이션

```javascript
const el = document.querySelector('.a.b.c');

[...el.classList];       // ['a', 'b', 'c']
el.classList.length;     // 3
el.classList.item(0);    // 'a'
el.classList.value;      // 'a b c'

for (const cls of el.classList) {
  console.log(cls);
}
```

---

## attributes — 속성 조작

HTML 속성은 모두 문자열로 저장됩니다.

```javascript
const img = document.querySelector('img');

// 읽기 — 없으면 null
img.getAttribute('src');    // '/logo.png'
img.getAttribute('missing'); // null

// 쓰기 — 항상 문자열로 변환
img.setAttribute('alt', '로고');
img.setAttribute('width', 200); // 숫자도 '200'으로 저장됨

// 존재 확인
img.hasAttribute('loading'); // true/false

// 제거 — 빈 문자열('')과 다름
img.removeAttribute('loading');

// 모든 속성 목록
img.getAttributeNames(); // ['src', 'alt', 'width', ...]
```

![attributes · dataset — 속성 조작](/assets/posts/dom-attributes-dataset.svg)

### 속성 vs 프로퍼티

HTML 속성과 DOM 프로퍼티는 다릅니다.

```javascript
const input = document.querySelector('input');

// HTML attribute: input.getAttribute('value') — 초기값 (항상 문자열)
// DOM property: input.value — 현재 입력값 (자동 타입 변환)

input.setAttribute('value', 'hello'); // HTML 마크업의 value
input.value;                          // 사용자가 수정한 현재 값

// boolean 속성 차이
const btn = document.querySelector('button');
btn.setAttribute('disabled', ''); // HTML: disabled="" (존재만으로 활성화)
btn.disabled;                     // true (DOM 프로퍼티, boolean)
btn.removeAttribute('disabled');  // 완전 제거
btn.disabled = false;             // 프로퍼티 방식 (더 간편)
```

### ARIA 속성

```javascript
el.setAttribute('aria-expanded', 'true');
el.setAttribute('aria-label', '닫기');
el.setAttribute('role', 'button');

// 또는 ariaExpanded 프로퍼티 (Chrome 81+)
el.ariaExpanded = 'true';
```

---

## dataset — data-* 사용자 데이터

HTML의 `data-*` 속성은 JavaScript와 데이터를 교환하는 표준 방법입니다.

```html
<div id="user-card"
     data-user-id="42"
     data-role="admin"
     data-last-login="2026-05-08">
</div>
```

```javascript
const card = document.getElementById('user-card');

// kebab-case → camelCase 자동 변환
card.dataset.userId;    // '42'
card.dataset.role;      // 'admin'
card.dataset.lastLogin; // '2026-05-08'

// 설정 — 자동으로 data-* 속성 추가
card.dataset.theme = 'dark'; // → data-theme="dark"

// 삭제
delete card.dataset.role; // data-role 제거

// 존재 확인
'userId' in card.dataset; // true
```

### dataset 이터레이션

```javascript
// Object.entries — key는 camelCase
for (const [key, value] of Object.entries(card.dataset)) {
  console.log(key, value);
  // userId 42 / role admin / lastLogin 2026-05-08
}

// 스프레드
const data = { ...card.dataset };
// { userId: '42', role: 'admin', lastLogin: '2026-05-08' }
```

---

## 실무 패턴

### CSS 상태 클래스 기반 토글

```javascript
// 아코디언 UI
const accordions = document.querySelectorAll('.accordion');

accordions.forEach(acc => {
  acc.querySelector('.header').addEventListener('click', () => {
    const isOpen = acc.classList.contains('open');
    // 나머지 모두 닫기
    accordions.forEach(a => a.classList.remove('open'));
    // 클릭한 것만 토글
    acc.classList.toggle('open', !isOpen);
  });
});
```

### dataset으로 이벤트 위임

```javascript
// HTML: <button data-action="delete" data-id="42">삭제</button>
document.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;

  const { action, id } = btn.dataset;
  if (action === 'delete') deleteItem(id);
  if (action === 'edit') editItem(id);
});
```

### className vs classList 성능

```javascript
// className으로 여러 클래스 설정 — 1번의 DOM 조작
el.className = 'card active highlighted large';

// classList.add 여러 번 — 역시 1번의 DOM 조작 (배치 처리)
el.classList.add('card', 'active', 'highlighted', 'large');

// 두 방법 모두 빠름 — 가독성 기준으로 선택
```

### getComputedStyle과 함께

```javascript
// CSS 변수 읽기
const style = getComputedStyle(el);
style.getPropertyValue('--primary-color'); // '#7ec8e3'
style.color; // 계산된 색상값

// inline style 직접 설정
el.style.setProperty('--gap', '16px');
el.style.backgroundColor = '#0a0a0a';
el.style.removeProperty('color');
```

---

**지난 글:** [DOM 요소 생성·삽입·제거 — createElement부터 replaceWith까지](/posts/dom-create-insert-remove/)

<br>
읽어주셔서 감사합니다. 😊
