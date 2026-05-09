---
title: "클립보드 API 완전 이해"
description: "navigator.clipboard의 writeText/readText/write/read, copy/cut/paste 이벤트, clipboardData, 권한 모델까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "클립보드", "ClipboardAPI", "copy", "paste", "navigator.clipboard", "DOM"]
featured: false
draft: false
---

[지난 글](/posts/event-drag-drop/)에서 드래그 앤 드롭 API를 살펴봤습니다. 이번에는 클립보드(복사·붙여넣기)와 관련된 두 레이어 — 이벤트 기반 클립보드 이벤트와 Promise 기반 `navigator.clipboard` API — 를 함께 정리합니다.

---

## 두 가지 접근법

클립보드를 다루는 방법은 두 가지입니다.

**레거시: `document.execCommand()`** — 동기 실행, 사용자 선택 텍스트만 복사 가능, deprecated 상태.

**현대: `navigator.clipboard`** — Promise 기반 비동기, 임의 텍스트 및 이미지 지원, HTTPS(보안 컨텍스트) 필요.

새 프로젝트에서는 `navigator.clipboard`를 사용하고, 구형 환경 폴백으로만 `execCommand`를 유지합니다.

![Clipboard API 두 가지 방식](/assets/posts/event-clipboard-api.svg)

---

## navigator.clipboard.writeText()

텍스트를 클립보드에 씁니다. 사용자 제스처(클릭 이벤트 핸들러 안 등) 컨텍스트에서 호출하면 권한 프롬프트 없이 작동합니다.

```js
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('복사되었습니다');
  } catch (err) {
    // HTTPS가 아니거나 권한 거부
    fallbackCopy(text);
  }
}

// 폴백: textarea 임시 생성 방식
function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}
```

---

## navigator.clipboard.readText()

클립보드에서 텍스트를 읽습니다. 브라우저가 `'clipboard-read'` 권한 프롬프트를 표시합니다. 사용자가 허용해야만 읽을 수 있습니다.

```js
async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    insertText(text);
  } catch (err) {
    if (err.name === 'NotAllowedError') {
      console.log('클립보드 읽기 권한 거부됨');
    }
  }
}

// 권한 상태 사전 확인
const status = await navigator.permissions.query({ name: 'clipboard-read' });
if (status.state === 'granted') {
  const text = await navigator.clipboard.readText();
}
```

---

## navigator.clipboard.write() — 리치 컨텐츠

텍스트 외 HTML, 이미지 등 여러 MIME 타입을 클립보드에 동시에 쓸 수 있습니다.

```js
async function copyRichContent(html, text) {
  const htmlBlob = new Blob([html], { type: 'text/html' });
  const textBlob = new Blob([text], { type: 'text/plain' });

  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': htmlBlob,
      'text/plain': textBlob,
    }),
  ]);
}

// 이미지 복사
async function copyImage(imageUrl) {
  const res = await fetch(imageUrl);
  const blob = await res.blob();
  await navigator.clipboard.write([
    new ClipboardItem({ [blob.type]: blob }),
  ]);
}
```

---

## 클립보드 이벤트: copy / cut / paste

사용자가 직접 복사/잘라내기/붙여넣기 동작을 할 때 브라우저가 이벤트를 발생시킵니다. 이 이벤트를 가로채 데이터를 커스터마이징할 수 있습니다.

### copy 이벤트 가로채기

```js
document.addEventListener('copy', (e) => {
  e.preventDefault(); // 기본 복사 동작 취소

  const selected = window.getSelection().toString();
  const attribution = `\n\n출처: ${location.href}`;

  // 커스텀 데이터 설정
  e.clipboardData.setData('text/plain', selected + attribution);
  e.clipboardData.setData('text/html',
    `<p>${selected}</p><p>출처: <a href="${location.href}">${location.href}</a></p>`
  );
});
```

콘텐츠 사이트에서 출처를 자동으로 붙이는 패턴입니다. `e.clipboardData`는 이벤트 기반 API에서만 사용 가능합니다.

### paste 이벤트로 이미지 붙여넣기

```js
editor.addEventListener('paste', async (e) => {
  const items = [...e.clipboardData.items];

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const blob = item.getAsFile();
      const dataUrl = await blobToDataUrl(blob);
      insertImageIntoEditor(dataUrl);
      return;
    }
  }
  // 이미지가 없으면 기본 붙여넣기 진행
});

function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(blob);
  });
}
```

스크린샷을 에디터에 바로 붙여넣는 기능을 구현할 때 자주 쓰이는 패턴입니다.

---

## clipboardData.items vs files

`ClipboardEvent.clipboardData`는 `DataTransfer` 객체와 같은 인터페이스를 공유합니다.

```js
document.addEventListener('paste', (e) => {
  // items: MIME 타입별 접근 — 텍스트, 이미지 등
  for (const item of e.clipboardData.items) {
    console.log(item.kind, item.type);
    // 'string', 'text/plain'
    // 'file', 'image/png'
  }

  // getData: 텍스트 직접 읽기
  const text = e.clipboardData.getData('text/plain');
});
```

![클립보드 코드 패턴](/assets/posts/event-clipboard-code.svg)

---

## 권한 모델 정리

| 동작 | 권한 필요 여부 |
|---|---|
| `writeText()` — 사용자 제스처 내 | 불필요 |
| `writeText()` — 제스처 외 | 필요 (거부 가능) |
| `readText()` | `clipboard-read` 권한 프롬프트 |
| `copy` 이벤트 내 `clipboardData.setData` | 불필요 |
| `paste` 이벤트 내 `clipboardData.getData` | 불필요 |

클립보드 읽기는 프라이버시 민감도가 높아 브라우저가 엄격하게 제어합니다. `writeText`는 복사 버튼 UX에 바로 적용할 수 있지만, `readText`는 권한 요청이 필요하므로 사용자 경험을 고려해 시점을 선택합니다.

---

## 정리

| API | 용도 | 권한 |
|---|---|---|
| `navigator.clipboard.writeText()` | 텍스트 복사 | 제스처 내 불필요 |
| `navigator.clipboard.readText()` | 텍스트 붙여넣기 | `clipboard-read` 필요 |
| `navigator.clipboard.write()` | 리치 컨텐츠 복사 | 제스처 내 불필요 |
| `copy`/`cut`/`paste` 이벤트 | 동작 가로채기 | 불필요 |

---

**지난 글:** [드래그 앤 드롭 완전 이해](/posts/event-drag-drop/)

**다음 글:** [window · document · navigator 완전 이해](/posts/browser-window-document-navigator/)

<br>
읽어주셔서 감사합니다. 😊
