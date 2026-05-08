---
title: "innerHTML · textContent · innerText 완벽 비교"
description: "innerHTML, textContent, innerText의 동작 차이와 XSS 위험, 성능 특성을 정리하고 상황별 올바른 선택 기준을 제시합니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 2
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "DOM", "innerHTML", "textContent", "innerText", "XSS", "성능"]
featured: false
draft: false
---

[지난 글](/posts/dom-document-fragment/)에서 DocumentFragment로 배치 삽입하는 방법을 알아봤습니다. 이번에는 요소의 내용을 읽고 쓰는 세 가지 프로퍼티 — `innerHTML`, `textContent`, `innerText` — 의 차이를 구체적으로 비교합니다.

---

## 세 프로퍼티 한눈에 보기

![innerHTML · textContent · innerText 비교표](/assets/posts/dom-innerhtml-textcontent-innertext-compare.svg)

### innerHTML

`innerHTML`은 요소의 자식 노드를 **HTML 문자열로 직렬화**하거나, 역으로 HTML 문자열을 파싱해 자식 노드로 교체합니다. 태그·주석·엔티티가 모두 포함됩니다. 마크업을 직접 삽입할 수 있어 편리하지만, 사용자 입력을 그대로 넣으면 XSS 공격의 통로가 됩니다.

```js
const div = document.querySelector('.preview');

// 읽기: 직렬화된 HTML 문자열
console.log(div.innerHTML); // "<strong>Hello</strong> world"

// 쓰기: 기존 자식 제거 후 파싱·삽입
div.innerHTML = '<em>새 내용</em>';
```

쓰기 시 이전 자식 노드는 모두 제거되며, 이전에 등록한 이벤트 리스너도 함께 사라집니다.

### textContent

`textContent`는 요소와 모든 후손의 **텍스트 노드를 연결한 순수 문자열**을 반환합니다. 태그가 제거되고, `display: none` 요소의 텍스트도 포함됩니다. 쓸 때는 단일 텍스트 노드로 교체하므로 HTML이 해석되지 않아 XSS 위험이 없습니다. 성능도 가장 빠릅니다.

```js
const p = document.querySelector('p');
// <p>Hello <span style="display:none">hidden</span> world</p>

p.textContent; // "Hello hidden world"  (숨김 포함)

// 사용자 입력 안전하게 삽입
p.textContent = userInput; // 태그 문자가 그대로 텍스트로 표시됨
```

### innerText

`innerText`는 CSS 스타일을 **실제로 반영한 렌더 텍스트**를 반환합니다. `display: none` 요소는 제외되고, `<br>`은 개행 문자로, 블록 요소 경계는 줄바꿈으로 변환됩니다. "사용자가 화면에서 보는 텍스트"와 가장 유사합니다.

```js
// <p>Hello <span style="display:none">hidden</span> world</p>
p.innerText; // "Hello world"  (숨김 제외)

// <div>첫 번째<br>두 번째</div>
div.innerText; // "첫 번째\n두 번째"
```

**결정적 차이**: `innerText`를 읽을 때마다 브라우저는 최신 레이아웃을 계산하기 위해 **강제 리플로우**를 발생시킵니다. 루프 안에서 반복 읽기는 심각한 성능 저하를 유발합니다.

---

## XSS와 안전한 사용

![innerHTML XSS와 안전한 대안](/assets/posts/dom-innerhtml-textcontent-innertext-xss.svg)

`innerHTML`에 사용자 제공 문자열을 넣을 때는 반드시 정제합니다. `DOMPurify` 라이브러리가 사실상 표준입니다.

```js
import DOMPurify from 'dompurify';

// 서버에서 온 마크업도 정제 후 삽입
container.innerHTML = DOMPurify.sanitize(serverHtml);
```

`script` 태그만 막아서는 부족합니다. `onerror`, `onload` 같은 인라인 이벤트 핸들러, `javascript:` URL, SVG 내 스크립트도 XSS 벡터입니다.

---

## 상황별 선택 가이드

**사용자 입력 표시**: `textContent`를 사용합니다. 태그를 문자 그대로 보여주므로 XSS 위험이 없습니다.

**신뢰할 수 있는 마크업 삽입**: `innerHTML`을 사용합니다. 서버에서 생성했거나 하드코딩된 문자열만 해당합니다.

**외부 입력 마크업 삽입**: `DOMPurify.sanitize()` 결과를 `innerHTML`에 넣습니다.

**화면 텍스트 복사/읽기**: `innerText`를 사용하되, 루프 밖에서 한 번만 읽습니다.

```js
// ✅ 한 번만 읽고 캐시
const text = element.innerText;
items.forEach(item => { /* text 재사용 */ });

// ❌ 루프마다 강제 리플로우
items.forEach(() => { console.log(element.innerText); });
```

---

## outerHTML과 insertAdjacentHTML

`outerHTML`은 요소 자신을 포함한 HTML 문자열입니다. 쓰면 해당 요소가 파싱된 노드로 교체됩니다.

`insertAdjacentHTML(position, html)`은 기존 내용을 지우지 않고 특정 위치에 마크업을 삽입합니다. position은 `'beforebegin'`, `'afterbegin'`, `'beforeend'`, `'afterend'` 네 가지입니다.

```js
// 기존 ul에 li 추가 — innerHTML처럼 전체 교체 없음
ul.insertAdjacentHTML('beforeend', '<li>새 항목</li>');
```

단, `insertAdjacentHTML`도 HTML을 파싱하므로 XSS 주의가 필요합니다.

---

세 프로퍼티는 각각 적합한 상황이 다릅니다. 기본은 `textContent`, 마크업이 필요할 때만 `innerHTML`, 화면 텍스트가 필요할 때만 `innerText`로 기억하면 실수를 줄일 수 있습니다.

---

**지난 글:** [DocumentFragment — 배치 삽입으로 리플로우 줄이기](/posts/dom-document-fragment/)

**다음 글:** [style · CSSOM — 자바스크립트로 스타일 다루기](/posts/dom-style-cssom/)

<br>
읽어주셔서 감사합니다. 😊
