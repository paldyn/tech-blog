---
title: "Blob · File · FileReader — 파일과 이진 데이터 다루기"
description: "Blob으로 이진 데이터를 표현하고, File로 사용자 파일에 접근하며, FileReader와 Blob 메서드로 읽는 방법, Object URL 활용까지 실무 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 5
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Blob", "File", "FileReader", "Object URL", "파일업로드", "Web API"]
featured: false
draft: false
---

[지난 글](/posts/js-textencoder-decoder/)에서 `TextEncoder`/`TextDecoder`로 문자열과 바이트를 변환하는 방법을 살펴봤습니다. 이번에는 브라우저에서 파일과 이진 데이터를 다루는 핵심 API인 `Blob`, `File`, `FileReader`를 정리합니다.

---

## Blob

`Blob`(Binary Large Object)은 불변 이진 데이터를 표현하는 객체입니다.

```javascript
// 배열로 생성 (string, ArrayBuffer, Blob, TypedArray 조합 가능)
const blob = new Blob(['Hello', ' ', 'World'], { type: 'text/plain' });
blob.size;     // 11
blob.type;     // 'text/plain'

// JSON Blob
const jsonBlob = new Blob(
  [JSON.stringify({ name: '홍길동', age: 30 })],
  { type: 'application/json' }
);

// 이미지 Blob (fetch 응답에서)
const imageBlob = await fetch('/logo.png').then(r => r.blob());
```

![Blob · File · FileReader 계층](/assets/posts/js-blob-file-hierarchy.svg)

### Blob 메서드

```javascript
const blob = new Blob(['안녕하세요']);

// 텍스트로 읽기
await blob.text(); // '안녕하세요'

// ArrayBuffer로 읽기
const ab = await blob.arrayBuffer();
new Uint8Array(ab); // UTF-8 바이트 배열

// ReadableStream으로 읽기
const stream = blob.stream();
const reader = stream.getReader();

// 슬라이싱 (새 Blob 생성)
const first = blob.slice(0, 3);         // 첫 3바이트
const typed = blob.slice(0, -1, 'text/plain'); // type 변경
```

---

## File

`File`은 `Blob`을 상속하며 파일 메타데이터를 추가합니다.

```javascript
// 직접 생성
const file = new File(['내용'], 'hello.txt', {
  type: 'text/plain',
  lastModified: Date.now(),
});

file.name;         // 'hello.txt'
file.lastModified; // 타임스탬프 (ms)
file.type;         // 'text/plain'
file.size;         // 바이트 수

// <input type="file">에서 획득
const input = document.querySelector('input[type=file]');
input.addEventListener('change', (e) => {
  const file = e.target.files[0]; // FileList → File
  console.log(file.name, file.size, file.type);
});
```

### FileList와 다중 파일

```javascript
// multiple 속성 input
const files = Array.from(input.files); // FileList → Array

// 파일 필터링
const images = files.filter(f => f.type.startsWith('image/'));
const largeFiles = files.filter(f => f.size > 5 * 1024 * 1024); // 5MB 초과
```

---

## FileReader

`FileReader`는 이벤트 기반으로 파일을 비동기 읽습니다. 현대 코드에서는 `Blob` 메서드를 권장하지만, `readAsDataURL` 같은 특수 기능은 여전히 유용합니다.

![FileReader vs Blob 메서드 · Object URL](/assets/posts/js-blob-file-operations.svg)

```javascript
// FileReader — Promise로 래핑하면 사용하기 편함
function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file, 'utf-8');
  });
}

// DataURL — 이미지 미리보기
function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// 사용
const text = await readAsText(file);
const dataUrl = await readAsDataURL(imageFile);
img.src = dataUrl;
```

### Blob 메서드 (권장)

```javascript
// FileReader 대신 Blob 메서드 사용 — 더 간결
const text = await file.text();
const ab = await file.arrayBuffer();
const stream = file.stream();

// 이미지 미리보기는 Object URL이 더 효율적
const url = URL.createObjectURL(file);
img.src = url;
img.onload = () => URL.revokeObjectURL(url); // 반드시 해제
```

---

## Object URL

`URL.createObjectURL(blob)`은 `blob:` 스킴의 임시 URL을 생성합니다.

```javascript
// 파일 다운로드 트리거
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // 약간의 지연 후 revoke (즉시 revoke하면 다운로드가 취소될 수 있음)
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// CSV 다운로드
const csv = 'name,age\n홍길동,30\n이순신,45';
downloadBlob(new Blob([csv], { type: 'text/csv' }), 'users.csv');
```

Object URL을 `revokeObjectURL` 없이 방치하면 메모리 누수가 발생합니다. SPA 환경에서는 컴포넌트 언마운트 시 반드시 해제해야 합니다.

---

## 실무 패턴

### 파일 유효성 검사

```javascript
function validateFile(file, options = {}) {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB
    accept = ['image/jpeg', 'image/png', 'image/webp'],
  } = options;

  if (!accept.includes(file.type)) {
    throw new Error(`허용되지 않는 파일 형식: ${file.type}`);
  }
  if (file.size > maxSize) {
    throw new Error(`파일 크기 초과: ${(file.size / 1024 / 1024).toFixed(1)}MB`);
  }
  return true;
}
```

### 대용량 파일 청크 업로드

```javascript
async function uploadInChunks(file, chunkSize = 1024 * 1024) {
  const chunks = Math.ceil(file.size / chunkSize);

  for (let i = 0; i < chunks; i++) {
    const start = i * chunkSize;
    const chunk = file.slice(start, start + chunkSize);
    const formData = new FormData();
    formData.append('file', chunk, file.name);
    formData.append('chunkIndex', i);
    formData.append('totalChunks', chunks);

    await fetch('/api/upload-chunk', { method: 'POST', body: formData });
  }
}
```

### 클립보드에서 이미지 붙여넣기

```javascript
document.addEventListener('paste', async (e) => {
  const items = [...e.clipboardData.items];
  const imageItem = items.find(item => item.type.startsWith('image/'));
  if (!imageItem) return;

  const file = imageItem.getAsFile();
  const url = URL.createObjectURL(file);
  const img = document.createElement('img');
  img.src = url;
  img.onload = () => URL.revokeObjectURL(url);
  document.body.appendChild(img);
});
```

### JSON 파일 읽기

```javascript
async function readJsonFile(file) {
  const text = await file.text();
  return JSON.parse(text);
}

input.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file || file.type !== 'application/json') return;
  const data = await readJsonFile(file);
  console.log(data);
});
```

---

## Drag & Drop 파일 수신

```javascript
const dropZone = document.getElementById('drop-zone');

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('active');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('active');
});

dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropZone.classList.remove('active');

  const files = [...e.dataTransfer.files];
  for (const file of files) {
    console.log(file.name, file.size);
    // 처리
  }
});
```

---

**지난 글:** [TextEncoder · TextDecoder — 텍스트와 이진 데이터 변환](/posts/js-textencoder-decoder/)

**다음 글:** [DOM 트리 구조 — 문서를 객체로 표현하는 방법](/posts/dom-tree-structure/)

<br>
읽어주셔서 감사합니다. 😊
