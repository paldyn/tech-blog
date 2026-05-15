---
title: "드래그 앤 드롭 완전 이해"
description: "HTML Drag and Drop API의 이벤트 흐름, dataTransfer 객체, 파일 드롭 처리, 드롭 허용 조건, 접근성까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "DragAndDrop", "dataTransfer", "드래그", "드롭", "파일업로드", "DOM"]
featured: false
draft: false
---

[지난 글](/posts/event-keyboard-mouse-touch-pointer/)에서 키보드, 마우스, 터치, 포인터 이벤트를 살펴봤습니다. 이번에는 HTML 표준 Drag and Drop API의 이벤트 구조와 올바른 구현 패턴을 정리합니다.

---

## 이벤트 흐름 개요

드래그 앤 드롭은 **소스(드래그되는 요소)**와 **대상(드롭 받는 영역)** 두 참여자의 이벤트 조합으로 이루어집니다.

**소스에서 발생하는 이벤트:**
- `dragstart` — 드래그 시작 시 한 번 발생, `dataTransfer`에 데이터 저장
- `drag` — 드래그 중 반복 발생
- `dragend` — 드롭 성공·실패에 관계없이 드래그가 끝나면 발생

**대상에서 발생하는 이벤트:**
- `dragenter` — 드래그한 항목이 대상 요소에 진입할 때
- `dragover` — 대상 요소 위에서 반복 발생
- `dragleave` — 대상 요소를 벗어날 때
- `drop` — 드롭이 일어날 때

![Drag & Drop 이벤트 흐름](/assets/posts/event-drag-drop-flow.svg)

---

## 드롭 허용의 핵심 조건

브라우저는 기본적으로 드롭을 허용하지 않습니다. **`dragover` 리스너에서 `e.preventDefault()`를 반드시 호출해야** `drop` 이벤트가 발생합니다. 이것이 가장 많이 실수하는 부분입니다.

```js
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault(); // 드롭 허용 — 필수!
  e.dataTransfer.dropEffect = 'move';
});
```

---

## draggable 속성

HTML 요소를 드래그 가능하게 만들려면 `draggable="true"` 속성을 추가합니다. `<a>`와 `<img>`는 기본적으로 드래그 가능합니다. 다른 요소는 명시적으로 설정해야 합니다.

```html
<div draggable="true" id="item-1">드래그 가능한 항목</div>
<div id="drop-zone">드롭 영역</div>
```

---

## dataTransfer 객체

`dataTransfer`는 소스와 대상 사이에 데이터를 전달하는 채널입니다.

```js
// dragstart: 데이터 저장
item.addEventListener('dragstart', (e) => {
  e.dataTransfer.setData('text/plain', item.dataset.id);
  e.dataTransfer.setData('application/json', JSON.stringify({
    id: item.dataset.id,
    type: 'card',
  }));
  e.dataTransfer.effectAllowed = 'move';
});

// drop: 데이터 읽기
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  const id = e.dataTransfer.getData('text/plain');
  const meta = JSON.parse(e.dataTransfer.getData('application/json'));
  moveCard(id, dropZone, meta);
});
```

`setData`/`getData`의 타입으로 `'text/plain'`, `'text/html'`, `'application/json'` 등 MIME 타입을 사용합니다. **보안 제약**: `getData`는 `drop` 이벤트 리스너 안에서만 읽을 수 있습니다. `dragover`에서는 `types` 프로퍼티(어떤 타입이 있는지)만 확인할 수 있습니다.

### effectAllowed와 dropEffect

`effectAllowed`는 소스가 허용하는 조작 종류를, `dropEffect`는 대상이 실제 수행할 조작을 나타냅니다. 값이 불일치하면 `drop` 커서 모양이 "허용 안 됨"으로 바뀝니다.

```js
// 소스
e.dataTransfer.effectAllowed = 'copyMove'; // 복사 또는 이동 허용

// 대상
e.dataTransfer.dropEffect = 'copy'; // 복사로 처리
```

---

## 드래그 고스트 이미지 커스텀

드래그할 때 따라다니는 반투명 이미지를 커스터마이징할 수 있습니다.

```js
item.addEventListener('dragstart', (e) => {
  const ghost = document.createElement('div');
  ghost.textContent = '이동 중...';
  ghost.style.cssText = `
    position: fixed; top: -1000px;
    background: #333; color: white;
    padding: 8px 12px; border-radius: 4px;
  `;
  document.body.append(ghost);

  e.dataTransfer.setDragImage(ghost, 0, 0);

  // dragend에서 제거
  item.addEventListener('dragend', () => ghost.remove(), { once: true });
});
```

---

## 파일 드롭 처리

운영체제에서 파일을 브라우저로 드래그하면 `dataTransfer.files`로 접근합니다.

```js
const dropArea = document.getElementById('upload-area');

dropArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropArea.classList.add('drag-over');
});

dropArea.addEventListener('dragleave', () => {
  dropArea.classList.remove('drag-over');
});

dropArea.addEventListener('drop', (e) => {
  e.preventDefault();
  dropArea.classList.remove('drag-over');

  const files = [...e.dataTransfer.files];
  files.forEach((file) => {
    console.log(file.name, file.size, file.type);
    uploadFile(file);
  });
});
```

`e.dataTransfer.items`를 사용하면 폴더 드롭 처리(`FileSystemEntry` API)도 가능합니다.

---

## dragend에서 결과 확인

`dragend` 이벤트의 `dataTransfer.dropEffect`가 `'none'`이면 드롭이 취소됐거나 유효한 대상이 없었다는 뜻입니다.

```js
item.addEventListener('dragend', (e) => {
  if (e.dataTransfer.dropEffect === 'none') {
    // 드롭 실패 — 원래 위치로 복원
    restoreItem(item);
  }
});
```

![드래그 앤 드롭 구현 패턴](/assets/posts/event-drag-drop-code.svg)

---

## 접근성 주의사항

HTML5 Drag and Drop API는 키보드와 스크린 리더로 사용할 수 없습니다. 접근성을 위해 키보드 대안(방향키로 이동, Enter로 선택 등)을 별도로 구현하거나, `aria-grabbed`/`aria-dropeffect` ARIA 속성을 추가합니다. 또는 포인터 이벤트 기반 커스텀 드래그 라이브러리(dnd-kit 등)를 사용하면 접근성 처리를 포함하기 쉽습니다.

---

## 정리

| 이벤트 | 발생 위치 | 주요 역할 |
|---|---|---|
| `dragstart` | 소스 | 데이터 저장, 효과 설정 |
| `dragover` | 대상 | `preventDefault()` 필수 |
| `drop` | 대상 | 데이터 읽기, 처리 |
| `dragend` | 소스 | 결과 확인, 정리 |

드래그 앤 드롭의 핵심은 `dragover`에서 `preventDefault()`를 호출하는 것과, `dataTransfer`로 데이터를 안전하게 전달하는 것입니다.

---

**지난 글:** [키보드·마우스·터치·포인터 이벤트 완전 이해](/posts/event-keyboard-mouse-touch-pointer/)

**다음 글:** [클립보드 API 완전 이해](/posts/event-clipboard/)

<br>
읽어주셔서 감사합니다. 😊
