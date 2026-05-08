---
title: "MutationObserver — DOM 변화 감지"
description: "MutationObserver로 DOM의 자식 노드 추가·제거, 속성 변경, 텍스트 변경을 비동기적으로 감지하는 방법과 MutationRecord 구조, 올바른 정리(disconnect) 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "DOM", "MutationObserver", "MutationRecord", "DOM감지", "성능"]
featured: false
draft: false
---

[지난 글](/posts/dom-style-cssom/)에서 CSSOM으로 스타일을 읽고 쓰는 방법을 정리했습니다. 이번에는 DOM 트리의 변화를 비동기적으로 감지하는 `MutationObserver`를 다룹니다.

---

## 왜 MutationObserver인가

과거에는 `DOMNodeInserted`, `DOMAttrModified` 같은 Mutation Events로 DOM 변화를 감지했습니다. 하지만 이 이벤트들은 변경마다 동기적으로 발화해 성능이 나빴고, 현재는 폐기됐습니다. `MutationObserver`는 변경 사항을 일괄 수집한 뒤 현재 태스크가 끝나는 시점에 마이크로태스크로 한 번에 전달합니다. 훨씬 효율적입니다.

![MutationObserver 동작 흐름](/assets/posts/dom-mutation-observer-flow.svg)

---

## 기본 사용법

```js
const observer = new MutationObserver((mutations, obs) => {
  for (const m of mutations) {
    console.log(m.type, m.target);
  }
});

observer.observe(document.querySelector('#container'), {
  childList: true,   // 자식 노드 추가/제거
  attributes: true,  // 속성 변경
  subtree: true,     // 모든 후손 포함
  characterData: true, // 텍스트 노드 내용 변경
  attributeOldValue: true, // 변경 전 속성값 기록
  characterDataOldValue: true,
});

// 감시 중단
observer.disconnect();
```

`observe`는 여러 대상에 호출할 수 있습니다. `disconnect`는 이 Observer가 감시하는 **모든** 대상을 중단합니다.

![MutationObserver 코드 예제](/assets/posts/dom-mutation-observer-code.svg)

---

## MutationRecord 구조

콜백의 첫 번째 인자는 `MutationRecord` 배열입니다.

| 필드 | 설명 |
|---|---|
| `type` | `"childList"` \| `"attributes"` \| `"characterData"` |
| `target` | 변경이 일어난 노드 |
| `addedNodes` | 추가된 NodeList |
| `removedNodes` | 제거된 NodeList |
| `attributeName` | 변경된 속성 이름 (type이 attributes일 때) |
| `oldValue` | 변경 전 값 (옵션 활성화 시) |
| `previousSibling` / `nextSibling` | 추가/제거된 노드의 이전/다음 형제 |

```js
const observer = new MutationObserver(mutations => {
  for (const { type, target, addedNodes, attributeName, oldValue } of mutations) {
    if (type === 'childList') {
      addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          console.log('요소 추가:', node.tagName);
        }
      });
    } else if (type === 'attributes') {
      console.log(`${attributeName}: ${oldValue} → ${target.getAttribute(attributeName)}`);
    }
  }
});
```

---

## takeRecords — 미전달 레코드 즉시 수집

`disconnect` 전에 아직 전달되지 않은 레코드를 즉시 가져올 수 있습니다.

```js
// 정리 전 남은 레코드 처리
const pending = observer.takeRecords();
observer.disconnect();
pending.forEach(m => process(m));
```

`takeRecords`를 호출하면 내부 큐가 비워집니다.

---

## 실전 패턴: 서드파티 DOM 변경 추적

프레임워크가 관리하는 DOM을 직접 건드리지 않고 반응해야 할 때 유용합니다.

```js
function watchForElement(selector, callback) {
  // 이미 존재하면 바로 실행
  const existing = document.querySelector(selector);
  if (existing) { callback(existing); return; }

  const obs = new MutationObserver((mutations, self) => {
    for (const { addedNodes } of mutations) {
      for (const node of addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        const el = node.matches(selector)
          ? node
          : node.querySelector(selector);
        if (el) {
          callback(el);
          self.disconnect(); // 한 번 찾으면 중단
          return;
        }
      }
    }
  });

  obs.observe(document.body, { childList: true, subtree: true });
}
```

---

## 주의 사항

**무한 루프**: 콜백 안에서 감시 대상 DOM을 변경하면 새 MutationRecord가 생성되어 콜백이 재진입합니다. 가드 조건을 두거나, 콜백 내에서 일시적으로 `disconnect` → 처리 → `observe`를 반복합니다.

**메모리**: Observer가 살아있는 한 `target` 노드가 GC되지 않습니다. 필요 없어지면 반드시 `disconnect`를 호출합니다. 컴포넌트 정리(`cleanup`, `useEffect` 반환값 등)에서 호출하는 것이 패턴입니다.

**subtree + childList 비용**: 대형 서브트리를 감시하면 변경이 잦을 때 콜백 호출 횟수가 많아집니다. 필요한 최소 범위만 감시합니다.

---

MutationObserver는 "내가 모르는 DOM 변경에 반응해야 할 때" 쓰는 도구입니다. 직접 제어하는 코드라면 변경 코드 뒤에 로직을 놓는 것이 훨씬 명확합니다.

---

**지난 글:** [style · CSSOM — 자바스크립트로 스타일 다루기](/posts/dom-style-cssom/)

**다음 글:** [ResizeObserver · IntersectionObserver — 요소 크기와 가시성 감지](/posts/dom-resize-intersection-observer/)

<br>
읽어주셔서 감사합니다. 😊
