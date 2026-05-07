---
title: "DOM 요소 생성·삽입·제거 — createElement부터 replaceWith까지"
description: "createElement · append · prepend · insertAdjacentElement · remove · replaceWith 등 현대 DOM 조작 API와 DocumentFragment를 활용한 배치 삽입 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 9
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "DOM", "createElement", "append", "remove", "DocumentFragment", "DOM 조작"]
featured: false
draft: false
---

[지난 글](/posts/dom-selection/)에서 DOM 요소를 선택하는 API를 살펴봤습니다. 이번에는 요소를 생성하고 트리에 삽입·제거·교체하는 DOM 조작 API를 정리합니다.

---

## 요소 생성

```javascript
// createElement(tagName) — 가장 기본
const div = document.createElement('div');
const input = document.createElement('input');

// 속성 설정 후 삽입
div.id = 'app';
div.className = 'container active';
div.textContent = '안녕하세요';
div.setAttribute('role', 'main');
input.type = 'text';
input.placeholder = '검색어 입력';

// SVG/MathML — createElementNS 필요
const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
```

```javascript
// 텍스트 노드
const text = document.createTextNode('Hello, World!');
// 주석 노드
const comment = document.createComment('dev note');
// DocumentFragment
const frag = document.createDocumentFragment();
```

![DOM 요소 생성·삽입 흐름](/assets/posts/dom-create-insert-flow.svg)

---

## 삽입 — 현대 API

ES2015+부터 `append`, `prepend`, `before`, `after` 메서드를 사용합니다.

```javascript
const ul = document.querySelector('ul');
const li1 = document.createElement('li');
const li2 = document.createElement('li');

// append — 자식 끝에 추가 (다중 인자, 문자열 가능)
ul.append(li1, li2, '직접 텍스트도 됩니다');

// prepend — 자식 앞에 추가
ul.prepend(li1);

// before — 자신 앞에 형제로 삽입
li1.before(li2); // li2가 li1 앞에 위치

// after — 자신 뒤에 형제로 삽입
li1.after(li2);  // li2가 li1 뒤에 위치
```

`append`는 `Node` 또는 `string` 여러 개를 받습니다. 문자열은 자동으로 `TextNode`로 변환됩니다(XSS 안전).

---

## 삽입 — 위치 지정

```javascript
const target = document.querySelector('.card');

// insertAdjacentElement(position, element)
target.insertAdjacentElement('beforebegin', el); // target 앞 형제
target.insertAdjacentElement('afterbegin', el);  // target 첫 번째 자식
target.insertAdjacentElement('beforeend', el);   // target 마지막 자식
target.insertAdjacentElement('afterend', el);    // target 뒤 형제

// insertAdjacentHTML — HTML 문자열 파싱 후 삽입 (⚠ XSS 주의)
target.insertAdjacentHTML('beforeend', '<span class="badge">New</span>');

// insertAdjacentText — 텍스트만 삽입 (XSS 안전)
target.insertAdjacentText('afterbegin', '안녕하세요 ');
```

---

## 구형 삽입 API

```javascript
// appendChild — 단일 노드만, 반환값 삽입된 노드
parent.appendChild(child);

// insertBefore(new, reference)
parent.insertBefore(newNode, referenceNode);
// referenceNode가 null이면 끝에 삽입

// ⚠ 이미 DOM에 있는 노드를 삽입 → 이동(복사 아님)
const existing = document.querySelector('.item');
parent.appendChild(existing); // 기존 위치에서 제거 후 새 위치에 추가
```

---

## 제거

```javascript
// 현대: el.remove()
const el = document.querySelector('.old-item');
el.remove();

// 구형: parent.removeChild(el) — IE 지원 시
el.parentNode.removeChild(el);

// 모든 자식 제거 (여러 방법)
while (container.firstChild) {
  container.firstChild.remove();
}
// 또는 (더 빠름)
container.textContent = '';
// 또는
container.innerHTML = '';  // ⚠ 이벤트 리스너 제거 + XSS 주의
```

---

## 교체

```javascript
const oldEl = document.querySelector('.old');
const newEl = document.createElement('div');
newEl.textContent = '새 요소';

// 현대: replaceWith
oldEl.replaceWith(newEl);
// 여러 개로도 교체 가능
oldEl.replaceWith(newEl, '텍스트도 됩니다', anotherEl);

// 구형: replaceChild
oldEl.parentNode.replaceChild(newEl, oldEl);
```

---

## DocumentFragment — 배치 삽입

많은 요소를 하나씩 삽입하면 매번 리플로우(레이아웃 재계산)가 발생합니다. `DocumentFragment`를 사용하면 한 번의 DOM 조작으로 처리합니다.

![제거 · 교체 · DocumentFragment](/assets/posts/dom-remove-methods.svg)

```javascript
const ul = document.querySelector('ul');
const items = ['사과', '바나나', '체리'];

// 느린 방법 — 매 iteration마다 리플로우
items.forEach(name => {
  const li = document.createElement('li');
  li.textContent = name;
  ul.appendChild(li); // 3번의 리플로우
});

// 빠른 방법 — DocumentFragment
const frag = document.createDocumentFragment();
items.forEach(name => {
  const li = document.createElement('li');
  li.textContent = name;
  frag.appendChild(li); // Fragment에는 리플로우 없음
});
ul.appendChild(frag); // 1번의 리플로우
```

`append(el1, el2, ...)`도 내부적으로 유사한 최적화를 적용합니다.

---

## innerHTML vs 안전한 대안

```javascript
// ⚠ innerHTML — XSS 위험
container.innerHTML = userInput; // 절대 금지

// ✅ textContent — 텍스트만
container.textContent = userInput;

// ✅ createTextNode
container.appendChild(document.createTextNode(userInput));

// ✅ insertAdjacentText
container.insertAdjacentText('beforeend', userInput);

// ✅ DOMParser — 신뢰된 HTML 파싱
const parser = new DOMParser();
const doc = parser.parseFromString(trustedHtml, 'text/html');
const el = doc.body.firstChild;
container.appendChild(document.importNode(el, true));

// ✅ setHTML (Sanitizer API — Chrome 130+)
// container.setHTML(userInput); // 자동 sanitize
```

---

## 실무 패턴: 재사용 가능한 요소 빌더

```javascript
function el(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') element.className = v;
    else if (k.startsWith('on')) element[k] = v;
    else element.setAttribute(k, v);
  });
  children.forEach(child => {
    element.append(
      typeof child === 'string' ? document.createTextNode(child) : child
    );
  });
  return element;
}

// 사용
const card = el('div', { class: 'card', id: 'main-card' },
  el('h2', {}, '제목'),
  el('p', {}, '내용'),
  el('button', { onclick: () => alert('click') }, '클릭')
);
document.body.append(card);
```

---

**지난 글:** [DOM 요소 선택 — querySelector와 선택 API 완전 정복](/posts/dom-selection/)

**다음 글:** [classList · attributes · dataset — 요소 속성 조작 API](/posts/dom-classlist-attributes-dataset/)

<br>
읽어주셔서 감사합니다. 😊
