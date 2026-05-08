---
title: "이벤트 위임 — 효율적인 이벤트 리스너 관리"
description: "이벤트 버블링을 활용해 공통 조상에 단 하나의 리스너를 등록하는 이벤트 위임 패턴과 closest()로 정확한 대상을 판별하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "이벤트", "이벤트위임", "버블링", "closest", "성능", "DOM"]
featured: false
draft: false
---

[지난 글](/posts/dom-template-slot/)에서 웹 컴포넌트의 template·slot 합성 패턴을 살펴봤습니다. 이번에는 이벤트 시스템의 강력한 패턴인 **이벤트 위임**을 다룹니다.

---

## 문제: 개별 리스너의 비용

100개의 리스트 항목마다 `click` 리스너를 달면 리스너가 100개 생깁니다. 동적으로 항목이 추가될 때마다 새 리스너를 등록하는 코드도 필요합니다. 항목 삭제 시에는 리스너 해제도 잊지 말아야 합니다. 누수의 씨앗입니다.

```js
// ❌ 개별 등록
document.querySelectorAll('li').forEach(li => {
  li.addEventListener('click', handler); // N개의 리스너
});
// 나중에 추가된 li에는 리스너 없음
```

![이벤트 위임 개념](/assets/posts/event-delegation-concept.svg)

---

## 해결책: 이벤트 위임

이벤트는 DOM 트리를 **버블링**(하위 → 상위)합니다. 자식에서 발생한 클릭이 부모·조상까지 전파됩니다. 이 성질을 이용해 **공통 조상에 리스너 하나**만 등록하면 모든 자식의 이벤트를 처리할 수 있습니다.

```js
// ✅ 위임 — 리스너 1개
const list = document.querySelector('#list');

list.addEventListener('click', e => {
  const li = e.target.closest('li');
  if (!li || !list.contains(li)) return;
  console.log('클릭된 항목:', li.textContent);
});
```

`e.target`은 실제로 클릭된 요소입니다. `li` 안에 `<span>` 같은 자식이 있으면 `e.target`이 span이 될 수 있습니다. `closest('li')`는 자신부터 조상 방향으로 올라가며 첫 번째 `li`를 반환해 이 문제를 해결합니다.

---

## closest()로 안전하게 판별

`element.closest(selector)`는 자기 자신부터 시작해 조상을 순회하며 selector에 맞는 첫 요소를 반환합니다. 없으면 `null`을 반환합니다.

```js
document.querySelector('#list').addEventListener('click', e => {
  const item = e.target.closest('[data-id]');
  if (!item) return; // 리스트 바깥 클릭 또는 data-id 없는 요소

  const id = item.dataset.id;
  handleItemClick(id);
});
```

`list.contains(item)` 검사를 추가하면 리스너 요소 밖에서 버블링되어 올라온 케이스를 차단할 수 있습니다.

---

## data-action 패턴 — 다중 액션 위임

여러 종류의 버튼을 하나의 리스너로 처리할 때 `data-action` 속성을 조합합니다.

```html
<div id="toolbar">
  <button data-action="save">저장</button>
  <button data-action="delete">삭제</button>
  <button data-action="export">내보내기</button>
</div>
```

```js
const handlers = {
  save:   () => saveDocument(),
  delete: () => deleteSelected(),
  export: () => exportData(),
};

document.querySelector('#toolbar').addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  const action = btn?.dataset.action;
  handlers[action]?.();
});
```

새 버튼을 추가할 때 HTML과 `handlers` 객체만 수정하면 됩니다. 리스너 코드는 건드리지 않아도 됩니다.

---

## 구현 코드 패턴

![이벤트 위임 코드 패턴](/assets/posts/event-delegation-code.svg)

---

## 위임이 적합하지 않은 경우

**focus / blur**: 기본적으로 버블링하지 않습니다. 버블링 버전인 `focusin` / `focusout`을 사용하거나 `addEventListener`의 세 번째 인자 `{ capture: true }`를 씁니다.

**mouseenter / mouseleave**: 버블링하지 않습니다. 버블링하는 `mouseover` / `mouseout`으로 대체하되, 자식 이동 시 반복 발화에 주의합니다.

**stopPropagation 사용 시**: 자식 요소에서 `e.stopPropagation()`을 호출하면 버블링이 막혀 위임 리스너에 도달하지 않습니다. 서드파티 라이브러리가 내부에서 전파를 막는 경우도 마찬가지입니다.

---

## 위임 vs 직접 등록 선택 기준

| 상황 | 권장 방식 |
|---|---|
| 항목 수가 많거나 동적 | 이벤트 위임 |
| 항목 수가 적고 고정 | 직접 등록 |
| focus/blur 계열 | focusin/focusout 위임 |
| stopPropagation 불가피 | 직접 등록 |

이벤트 위임은 리스트, 테이블, 동적 컴포넌트처럼 **유사한 자식이 많은 경우**에 가장 강력합니다. `closest()`를 적극 활용해 중첩 구조에서도 안전하게 판별하면 됩니다.

---

**지난 글:** [template · slot — 웹 컴포넌트 마크업 청사진](/posts/dom-template-slot/)

**다음 글:** [이벤트 캡처·버블 — 전파 단계 완전 이해](/posts/event-capture-bubble/)

<br>
읽어주셔서 감사합니다. 😊
