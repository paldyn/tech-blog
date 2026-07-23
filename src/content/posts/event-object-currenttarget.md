---
title: "event.target · currentTarget · relatedTarget 완전 이해"
description: "이벤트 객체의 target, currentTarget, relatedTarget이 각각 어떤 요소를 가리키는지, 이벤트 전파 단계에서 어떻게 달라지는지, 비동기 컨텍스트에서의 주의사항을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "이벤트", "target", "currentTarget", "relatedTarget", "이벤트객체", "DOM"]
featured: false
draft: false
---

[지난 글](/posts/event-capture-bubble/)에서 이벤트 전파 3단계(캡처, 타깃, 버블링)를 살펴봤습니다. 이번에는 이벤트 객체에서 가장 혼동하기 쉬운 세 가지 프로퍼티 — `target`, `currentTarget`, `relatedTarget` — 의 차이를 정확히 이해합니다.

---

## target과 currentTarget의 차이

```html
<div id="outer">   <!-- onclick 리스너 등록 -->
  <button id="inner">
    <span>텍스트</span>  <!-- 실제 클릭 위치 -->
  </button>
</div>
```

`span`을 클릭하면 이벤트가 버블링으로 `outer`에 전달됩니다.

| 프로퍼티 | 값 | 설명 |
|---|---|---|
| `e.target` | `span` | 실제로 이벤트가 발생한 요소. 버블링 중에도 변하지 않음 |
| `e.currentTarget` | `outer` | 현재 실행 중인 리스너가 등록된 요소. 전파 단계마다 변함 |

![target · currentTarget · relatedTarget 차이](/assets/posts/event-object-currenttarget-diff.svg)

```js
outer.addEventListener('click', e => {
  console.log(e.target);        // <span>텍스트</span>
  console.log(e.currentTarget); // <div id="outer">
  console.log(e.target === e.currentTarget); // false
});
```

이벤트 위임에서 `e.target`으로 실제 클릭된 자식을 판별하고, `e.currentTarget`으로 리스너 컨텍스트를 유지합니다.

---

## 타깃 단계에서의 동작

이벤트가 발생한 요소에 직접 리스너를 등록했을 때는 `target`과 `currentTarget`이 동일합니다.

```js
inner.addEventListener('click', e => {
  e.target === e.currentTarget; // true (타깃 단계)
});
```

---

## relatedTarget

`relatedTarget`은 **이전 또는 다음으로 이동한 관련 요소**를 가리킵니다. 주로 마우스와 포커스 이벤트에서 의미가 있습니다.

| 이벤트 | relatedTarget 의미 |
|---|---|
| `mouseover` | 마우스가 이전에 있던 요소(벗어나온 곳) |
| `mouseout` | 마우스가 이동한 다음 요소(들어간 곳) |
| `focusin` / `focus` | 포커스를 잃은 이전 요소 |
| `focusout` / `blur` | 포커스를 받을 다음 요소 |

`relatedTarget`이 `null`인 경우: 브라우저 창 밖에서 들어왔거나, Shadow DOM 경계를 넘는 경우입니다.

```js
tooltip.addEventListener('mouseover', e => {
  // 툴팁 내부 자식 → 부모 이동 시 relatedTarget이 툴팁 안에 있으면 무시
  if (e.relatedTarget && tooltip.contains(e.relatedTarget)) return;
  showTooltip();
});
```

---

## 비동기 컨텍스트에서의 currentTarget

`currentTarget`은 이벤트 디스패치가 끝나면 `null`이 됩니다. `async` 리스너에서 `await` 이후 `e.currentTarget`을 참조하면 `null`입니다.

```js
button.addEventListener('click', async e => {
  // ✅ await 전에 미리 저장
  const target = e.currentTarget;

  await fetchData();

  // ✅ 저장된 참조 사용
  target.textContent = '완료';

  // ❌ e.currentTarget는 이미 null
  // e.currentTarget.textContent = '완료';
});
```

`e.target`도 동일한 주의가 필요합니다. 비동기 리스너에서는 항상 필요한 참조를 `const`로 먼저 저장합니다.

---

## 코드 예제 모음

![이벤트 객체 프로퍼티 활용 패턴](/assets/posts/event-object-currenttarget-code.svg)

---

## 이벤트 객체의 다른 유용한 프로퍼티

| 프로퍼티 | 설명 |
|---|---|
| `e.type` | 이벤트 종류 (`"click"`, `"keydown"` 등) |
| `e.timeStamp` | 이벤트 발생 시각 (ms, DOMHighResTimeStamp) |
| `e.bubbles` | 버블링 여부 |
| `e.cancelable` | `preventDefault` 가능 여부 |
| `e.isTrusted` | 사용자 직접 발생(`true`) vs `dispatchEvent` 발생(`false`) |
| `e.composed` | Shadow DOM 경계 통과 여부 |

`e.isTrusted`는 봇·자동화 클릭과 실제 사용자 입력을 구분할 때 참고할 수 있습니다. 단, 보안 판단에 단독으로 사용하면 안 됩니다.

---

## 정리

- **target**: 이벤트 발생 요소. 버블링 중 변하지 않음.
- **currentTarget**: 현재 리스너가 등록된 요소. 전파 단계마다 변함. 비동기 후 `null`.
- **relatedTarget**: 이전/다음 관련 요소. `mouseover`·`mouseout`·포커스 이벤트에서 활용.

세 프로퍼티의 차이를 정확히 알면 이벤트 위임 코드를 올바르게 작성하고, 마우스 호버 효과의 "떨림"을 방지하며, 비동기 이벤트 핸들러에서 버그를 예방할 수 있습니다.

---

**지난 글:** [이벤트 캡처·버블 — 전파 단계 완전 이해](/posts/event-capture-bubble/)

**다음 글:** [preventDefault · stopPropagation 완전 이해](/posts/event-prevent-stop-propagation/)

<br>
읽어주셔서 감사합니다. 😊
