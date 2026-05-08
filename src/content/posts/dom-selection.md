---
title: "DOM 요소 선택 — querySelector와 선택 API 완전 정복"
description: "querySelector · querySelectorAll · getElementById · getElementsBy* 의 차이, 정적 vs 실시간 컬렉션, :scope 선택자, 성능 비교를 실무 패턴과 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "DOM", "querySelector", "getElementById", "CSS 선택자", "NodeList", "HTMLCollection"]
featured: false
draft: false
---

[지난 글](/posts/dom-document-element-node-text/)에서 `Node`, `Element`, `Document`, `Text` 인터페이스를 살펴봤습니다. 이번에는 DOM에서 원하는 요소를 정확히 찾는 선택 API를 정리합니다.

---

## querySelector / querySelectorAll

CSS 선택자를 그대로 사용할 수 있는 가장 유연한 API입니다.

```javascript
// 단일 요소 — 첫 번째 일치 (없으면 null)
const btn = document.querySelector('button.primary');
const header = document.querySelector('#app > header');

// 여러 요소 — 정적 NodeList
const items = document.querySelectorAll('.list-item');
const checked = document.querySelectorAll('input[type=checkbox]:checked');
const firstTwo = document.querySelectorAll('li:nth-child(-n+2)');

// NodeList → Array
const arr = [...items];
Array.from(items);
```

![DOM 선택 메서드 비교](/assets/posts/dom-selection-methods.svg)

---

## :scope — 컨텍스트 기준 선택

`element.querySelectorAll(sel)`은 전역 문서에서 선택자를 평가한 뒤 결과를 `element` 하위로 필터링합니다. `:scope`는 기준 요소를 명시적으로 가리킵니다.

```javascript
const list = document.querySelector('.nav-list');

// ⚠ 의도치 않은 동작 — 문서 전체에서 .nav-item > a 찾고 list 하위 필터
const links = list.querySelectorAll('.nav-item > a');

// ✅ :scope — list의 직접 자식 .nav-item > a
const links2 = list.querySelectorAll(':scope > .nav-item > a');
```

---

## getElementById 계열

```javascript
// getElementById — document 전용, 가장 빠름
const app = document.getElementById('app');  // id 선택자 없이 순수 id

// getElementsByTagName — 실시간 HTMLCollection
const divs = document.getElementsByTagName('div'); // '*'로 전체 요소
const svgs = document.getElementsByTagNameNS(
  'http://www.w3.org/2000/svg', 'circle'
);

// getElementsByClassName — 실시간 HTMLCollection
const cards = document.getElementsByClassName('card');
// 여러 클래스는 공백으로 구분
const activeCards = document.getElementsByClassName('card active');

// element에서도 사용 가능
const nav = document.querySelector('nav');
nav.getElementsByTagName('a'); // nav 하위의 a만
```

![선택 API 성능 · 실시간 vs 정적](/assets/posts/dom-selection-perf.svg)

---

## 실시간 컬렉션 vs 정적 컬렉션

| | HTMLCollection (getElementById 계열) | NodeList (querySelectorAll) |
|---|---|---|
| DOM 변경 반영 | 실시간 | 정적 (스냅샷) |
| 포함 노드 | Element만 | 설정에 따라 (childNodes는 실시간) |
| 성능 | 빠름 | 약간 느림 |
| 위험성 | 순회 중 DOM 변경 시 버그 | 안전 |

```javascript
// 실시간 컬렉션 안전하게 순회하기
const divs = document.getElementsByTagName('div');
[...divs].forEach(div => div.classList.add('processed'));
// Array로 변환 후 순회하면 DOM 변경 영향 없음
```

---

## 선택 API 비교 정리

```javascript
// 1. id로 단일 요소 — getElementById (가장 빠름)
document.getElementById('my-id');

// 2. CSS 선택자로 단일 요소 — querySelector
document.querySelector('.card:first-of-type');

// 3. CSS 선택자로 여러 요소 — querySelectorAll (정적)
document.querySelectorAll('input[required]');

// 4. 클래스로 여러 요소 — getElementsByClassName (실시간)
document.getElementsByClassName('active');

// 5. 태그로 여러 요소 — getElementsByTagName (실시간)
document.getElementsByTagName('button');

// 6. name 속성 — getElementsByName (form 요소)
document.getElementsByName('username');
```

---

## matches / closest / contains

```javascript
const li = document.querySelector('li.selected');

// 이 요소가 선택자와 일치하는지
li.matches('.selected');        // true
li.matches('li[data-id]');      // false

// 자신부터 위로 올라가며 선택자에 맞는 첫 요소
li.closest('ul');               // 상위 <ul>
li.closest('[data-list="main"]'); // data 속성 조상
li.closest('.없음');             // null

// 포함 여부
document.body.contains(li);    // true
li.contains(document.body);    // false
```

이벤트 위임에서 `closest`는 클릭된 자식 요소에서 원하는 조상을 찾는 표준 패턴입니다.

```javascript
document.querySelector('.list').addEventListener('click', (e) => {
  const item = e.target.closest('.list-item');
  if (!item) return;
  item.classList.toggle('selected');
});
```

---

## 복합 선택자 팁

```javascript
// 여러 선택자 — OR 조건
document.querySelectorAll('h1, h2, h3');

// 속성 선택자
document.querySelectorAll('[data-lazy]');
document.querySelectorAll('img[src$=".webp"]');

// 형제 선택자
document.querySelectorAll('.active + .item');   // 바로 다음 형제
document.querySelectorAll('.active ~ .item');   // 이후 모든 형제

// 부정 선택자
document.querySelectorAll('li:not(.disabled)');

// has — 자식 조건부 선택 (CSS Selectors 4)
document.querySelectorAll('article:has(img)');  // 이미지를 포함한 article
```

`:has()`는 Chrome 105+, Safari 15.4+, Firefox 121+에서 지원됩니다.

---

## 실무 패턴: 안전한 단일 요소 선택

```javascript
// null 체크 강제 패턴
function $(sel, ctx = document) {
  const el = ctx.querySelector(sel);
  if (!el) throw new Error(`Element not found: ${sel}`);
  return el;
}

// 선택적 패턴 (없으면 null)
function $$(sel, ctx = document) {
  return [...ctx.querySelectorAll(sel)];
}

// 사용
const header = $('#main-header');        // 없으면 throw
const buttons = $$('button[data-action]'); // 빈 배열 가능
```

---

**지난 글:** [Document · Element · Node · Text — DOM의 핵심 인터페이스](/posts/dom-document-element-node-text/)

**다음 글:** [DOM 요소 생성·삽입·제거 — createElement부터 replaceWith까지](/posts/dom-create-insert-remove/)

<br>
읽어주셔서 감사합니다. 😊
