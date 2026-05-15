---
title: "키보드·마우스·터치·포인터 이벤트 완전 이해"
description: "keyboard, mouse, touch, pointer 네 종류 입력 이벤트의 주요 프로퍼티, 좌표계 차이, mouseover vs mouseenter, Pointer Capture까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "키보드이벤트", "마우스이벤트", "터치이벤트", "포인터이벤트", "DOM", "이벤트"]
featured: false
draft: false
---

[지난 글](/posts/event-custom-events/)에서 커스텀 이벤트를 만드는 방법을 살펴봤습니다. 이번에는 브라우저가 사용자 입력에 반응해 자동으로 발생시키는 네 종류의 이벤트 — 키보드, 마우스, 터치, 포인터 — 를 체계적으로 비교합니다.

---

## 키보드 이벤트

키보드 이벤트는 세 가지입니다. `keydown`은 키를 누르는 순간, `keyup`은 뗄 때 발생합니다. `keypress`는 deprecated 상태이므로 사용하지 않습니다.

핵심 프로퍼티는 `key`와 `code`입니다.

```js
document.addEventListener('keydown', (e) => {
  console.log(e.key);   // 'Enter', 'a', 'ArrowUp' — 실제 문자/기능
  console.log(e.code);  // 'Enter', 'KeyA', 'ArrowUp' — 물리 키 위치
  console.log(e.repeat); // 키 홀드 시 true
});
```

`key`는 시스템 언어와 수식키 조합을 반영합니다. 같은 `A` 키를 눌러도 Shift가 눌리면 `key`는 `'A'`, 아니면 `'a'`입니다. `code`는 항상 물리적 위치를 기준으로 하므로 키보드 레이아웃과 무관합니다. 게임 컨트롤 같은 위치 기반 로직에는 `code`를, 텍스트 입력에는 `key`를 사용합니다.

수식키 상태는 `ctrlKey`, `shiftKey`, `altKey`, `metaKey` 불리언으로 확인합니다.

```js
// Ctrl+S 또는 Cmd+S 저장
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveDocument();
  }
});
```

---

## 마우스 이벤트

마우스 이벤트는 크게 클릭 계열과 이동 계열로 나뉩니다.

**클릭 계열**: `mousedown`, `mouseup`, `click`, `dblclick`, `contextmenu`

**이동 계열**: `mousemove`, `mouseover`, `mouseout`, `mouseenter`, `mouseleave`

좌표를 나타내는 프로퍼티가 여러 개라 혼동하기 쉽습니다.

| 프로퍼티 | 기준 |
|---|---|
| `clientX/Y` | 뷰포트(화면 보이는 영역) |
| `pageX/Y` | 문서 전체 (스크롤 포함) |
| `screenX/Y` | 모니터 화면 |
| `offsetX/Y` | 이벤트 대상 요소 내부 |
| `movementX/Y` | 이전 이벤트 위치 대비 이동량 |

버튼 구분은 `e.button`으로 합니다. 0은 왼쪽, 1은 가운데, 2는 오른쪽 버튼입니다.

---

## mouseover vs mouseenter

이 두 이벤트는 동작이 미묘하게 다릅니다.

```html
<div id="parent">
  <span id="child">자식</span>
</div>
```

```js
const parent = document.getElementById('parent');

// mouseover: 버블링 O
// 마우스가 span에 진입해도 div에서 발생
parent.addEventListener('mouseover', () => console.log('over'));

// mouseenter: 버블링 X
// 마우스가 div에 처음 진입할 때만 발생
parent.addEventListener('mouseenter', () => console.log('enter'));
```

`mouseover`/`mouseout`은 자식 요소 경계를 넘을 때마다 부모에서도 발생합니다. 호버 효과를 요소 자체에만 적용할 때는 `mouseenter`/`mouseleave`가 더 직관적입니다. `relatedTarget`으로 이전/이후 요소를 파악할 수 있습니다.

---

## 터치 이벤트

터치스크린 기기에서 발생하며 멀티터치를 지원합니다.

```js
el.addEventListener('touchstart', (e) => {
  e.preventDefault(); // 스크롤 방지 (passive:false 필요)
  const touch = e.changedTouches[0];
  console.log(touch.clientX, touch.clientY);
}, { passive: false });
```

`touches`는 현재 화면에 닿아 있는 모든 터치 포인트, `changedTouches`는 이번 이벤트에서 변경된 터치 포인트, `targetTouches`는 이벤트 대상 요소의 터치 포인트입니다. 핀치 줌 감지에는 두 터치 포인트 사이 거리를 계산합니다.

```js
let initialDist = 0;

function getTouchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

el.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    initialDist = getTouchDist(e.touches);
  }
}, { passive: true });

el.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2) {
    const scale = getTouchDist(e.touches) / initialDist;
    applyScale(scale);
  }
}, { passive: true });
```

스크롤 성능을 위해 `touchmove`는 `passive: true`로 등록하는 것이 권장됩니다.

---

## 포인터 이벤트

포인터 이벤트는 마우스, 터치, 스타일러스 펜을 **단일 API**로 처리합니다. 새로운 프로젝트에서는 마우스/터치 이벤트 대신 포인터 이벤트를 우선 고려합니다.

```js
el.addEventListener('pointerdown', (e) => {
  console.log(e.pointerType); // 'mouse', 'touch', 'pen'
  console.log(e.pointerId);   // 각 포인트 고유 ID
  console.log(e.pressure);    // 압력 (0~1, 펜 지원 시)
});
```

**Pointer Capture**: 드래그 UI에서 포인터가 요소 밖으로 빠져도 이벤트를 계속 받으려면 `setPointerCapture`를 사용합니다.

```js
el.addEventListener('pointerdown', (e) => {
  el.setPointerCapture(e.pointerId);
});

el.addEventListener('pointermove', (e) => {
  // 포인터가 el 밖으로 나가도 계속 발생
  updateDragPosition(e.clientX, e.clientY);
});

// pointerup 또는 pointercancel 시 자동 해제
el.addEventListener('pointerup', () => {
  finalizeDrag();
});
```

슬라이더, 드래그 앤 드롭, 그림판 등 드래그 계열 UI에서 마우스 이벤트보다 안정적입니다.

---

## 이벤트 발생 순서

터치 기기에서 탭(tap)하면 이벤트 발생 순서는 다음과 같습니다.

```
pointerdown → touchstart → pointerup → touchend → click
```

`preventDefault()`를 `touchstart`에서 호출하면 이후 마우스·클릭 이벤트 시뮬레이션이 억제됩니다. 포인터 이벤트를 사용하면 이 시뮬레이션 체인을 신경 쓰지 않아도 됩니다.

![입력 이벤트 4종 비교](/assets/posts/event-keyboard-mouse-touch-pointer-types.svg)

![입력 이벤트 코드 패턴](/assets/posts/event-keyboard-mouse-touch-pointer-code.svg)

---

## 정리

| 이벤트 종류 | 특징 | 권장 상황 |
|---|---|---|
| Keyboard | `key`/`code`로 키 식별 | 단축키, 텍스트 입력 처리 |
| Mouse | 풍부한 좌표/버튼 정보 | 데스크톱 전용 UI |
| Touch | 멀티터치, changedTouches | 모바일 전용, 핀치 제스처 |
| Pointer | 마우스+터치+펜 통합 | 범용 입력 처리, 드래그 UI |

---

**지난 글:** [커스텀 이벤트 완전 이해](/posts/event-custom-events/)

**다음 글:** [드래그 앤 드롭 완전 이해](/posts/event-drag-drop/)

<br>
읽어주셔서 감사합니다. 😊
