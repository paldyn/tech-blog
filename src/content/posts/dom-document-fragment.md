---
title: "DocumentFragment — 배치 삽입으로 리플로우 줄이기"
description: "DocumentFragment를 사용해 여러 DOM 노드를 메모리에 조립한 뒤 단 한 번의 삽입으로 리플로우를 최소화하는 패턴과, template 요소와 함께 활용하는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "DOM", "DocumentFragment", "성능", "리플로우", "template"]
featured: false
draft: false
---

[지난 글](/posts/dom-classlist-attributes-dataset/)에서 `classList`·`dataset`으로 요소의 속성을 조작하는 방법을 알아봤습니다. 이번에는 여러 노드를 한꺼번에 삽입해 레이아웃 재계산(리플로우)을 최소화하는 **DocumentFragment**를 다룹니다.

---

## 왜 개별 삽입이 느린가

브라우저는 `appendChild`, `insertBefore` 같은 Live DOM 변경이 일어날 때마다 레이아웃 재계산과 리페인트를 예약합니다. 루프 안에서 노드를 10개 넣으면 최대 10번의 리플로우 트리거가 쌓입니다. 실제로 매 프레임마다 플러시되기 때문에 체감이 다를 수 있지만, 레이아웃이 강제 동기화(forced synchronous layout)되는 상황에서는 성능 저하가 직접 나타납니다.

![DocumentFragment 개념 — 배치 삽입 원리](/assets/posts/dom-document-fragment-concept.svg)

---

## DocumentFragment란

`DocumentFragment`는 실제 문서 트리에 존재하지 않는 **경량 컨테이너 노드**입니다. `parentNode`가 항상 `null`이고, 화면에 렌더링되지 않습니다. 자식 노드를 맘껏 조립한 뒤 Live DOM에 삽입하면, 컨테이너 자체가 아닌 **자식 노드만** 이전됩니다. 삽입 후 Fragment는 자동으로 비워집니다.

```js
const frag = document.createDocumentFragment();
// 또는: new DocumentFragment()  (최신 브라우저)

['사과', '바나나', '체리'].forEach(name => {
  const li = document.createElement('li');
  li.textContent = name;
  frag.appendChild(li); // DOM 접촉 없음
});

document.querySelector('ul').appendChild(frag); // 리플로우 1회
// 이후 frag.childNodes.length === 0
```

삽입 이후 `frag`를 재사용하려면 다시 노드를 채워야 합니다.

---

## template 요소와의 관계

`<template>` 요소의 `.content` 프로퍼티가 바로 `DocumentFragment`입니다. 파싱 시 비활성 상태로 보관되기 때문에 스크립트 실행, 이미지 로딩, 스타일 적용이 일어나지 않습니다. 재사용 가능한 마크업 청사진으로 이상적입니다.

```html
<template id="row-tpl">
  <tr>
    <td class="name"></td>
    <td class="age"></td>
  </tr>
</template>
```

```js
const tmpl = document.querySelector('#row-tpl');

function renderRow(data) {
  const clone = tmpl.content.cloneNode(true); // 깊은 복사
  clone.querySelector('.name').textContent = data.name;
  clone.querySelector('.age').textContent  = data.age;
  return clone; // DocumentFragment 반환
}

const tbody = document.querySelector('tbody');
const frag  = document.createDocumentFragment();

users.forEach(u => frag.appendChild(renderRow(u)));
tbody.appendChild(frag); // 단 한 번 삽입
```

`cloneNode(true)`로 깊은 복사를 해야 원본 template 내용이 유지됩니다.

![DocumentFragment 코드 패턴](/assets/posts/dom-document-fragment-code.svg)

---

## 주의 사항

**querySelector 범위**: Fragment에 append된 노드는 `frag.querySelector()` 로 탐색할 수 있습니다. 그러나 `document.querySelector()`로는 찾을 수 없습니다.

**이벤트 위임**: Fragment 자체에 이벤트를 붙여도 삽입 후 소멸하므로 의미가 없습니다. 삽입 전에 개별 자식에 리스너를 붙이거나, 삽입 후 공통 조상에 위임 방식으로 처리합니다.

**성능 측정**: 노드 수가 적을 때는 Fragment 없이 직접 삽입해도 차이가 미미합니다. 수십 개 이상의 노드를 루프에서 삽입할 때 Fragment가 의미 있는 차이를 만듭니다. 항상 `performance.now()`나 DevTools Performance 탭으로 실측합니다.

---

## 정리

| 항목 | 설명 |
|---|---|
| 생성 | `document.createDocumentFragment()` |
| parentNode | 항상 `null` |
| 렌더링 | 없음 (메모리 전용) |
| 삽입 시 동작 | 자식만 이전, Fragment 비워짐 |
| template.content | Fragment 타입 |

DocumentFragment는 DOM 조작의 "스테이징 구역"입니다. 여러 노드를 미리 조립한 뒤 한 번에 올리는 습관이 리플로우 비용을 줄이는 가장 간단한 방법입니다.

---

**지난 글:** [classList · attributes · dataset — 요소 속성 조작 API](/posts/dom-classlist-attributes-dataset/)

**다음 글:** [innerHTML · textContent · innerText 완벽 비교](/posts/dom-innerhtml-textcontent-innertext/)

<br>
읽어주셔서 감사합니다. 😊
