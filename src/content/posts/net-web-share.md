---
title: "Web Share API · 네이티브 공유 다이얼로그"
description: "Web Share API의 navigator.share()·navigator.canShare()·파일 공유, Web Share Target API, 브라우저 지원 현황, 클립보드 폴백, 제약사항까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Web Share API", "PWA", "navigator.share", "공유", "네이티브", "모바일"]
featured: false
draft: false
---

[지난 글](/posts/net-background-sync/)에서 오프라인 요청을 큐에 저장했다가 자동 재전송하는 Background Sync를 살펴봤습니다. 이번에는 **Web Share API**를 정리합니다. `navigator.share()`를 호출하면 브라우저가 OS 네이티브 공유 시트를 열어, 사용자가 카카오톡·메시지·메일 등으로 직접 공유할 수 있게 합니다.

---

## Web Share API란

Web Share API는 웹 앱이 **OS 레벨 공유 기능**을 호출하는 인터페이스입니다. 개발자가 공유 앱 목록을 직접 만들 필요 없이, OS가 설치된 앱을 자동으로 표시합니다.

기존 접근법과의 차이:
- **기존**: 카카오톡·트위터 공유 버튼을 각각 구현
- **Web Share**: `navigator.share()` 하나로 OS가 알아서 앱 목록 표시

![Web Share API 흐름](/assets/posts/net-web-share-flow.svg)

---

## 기본 사용법

```js
// 반드시 사용자 동작(클릭 등) 내에서 호출해야 함
shareButton.addEventListener('click', async () => {
  if (!navigator.share) {
    // 미지원 브라우저 폴백
    fallbackShare();
    return;
  }

  try {
    await navigator.share({
      title: '흥미로운 기사',
      text: '이 기사를 읽어보세요!',
      url: 'https://example.com/article/123'
    });
    console.log('공유 완료');
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('사용자가 공유를 취소함');
    } else {
      console.error('공유 실패:', err);
    }
  }
});
```

**중요 제약**: `navigator.share()`는 **사용자 제스처(클릭·터치)** 컨텍스트에서만 호출할 수 있습니다. `setTimeout`이나 Promise 체인 내에서 호출하면 `InvalidStateError`가 발생합니다.

---

## navigator.canShare() — 공유 가능 여부 확인

```js
// 파일 공유 전 가능 여부 확인
function canShareData(data) {
  // navigator.share 미지원
  if (!navigator.share) return false;

  // canShare 지원 여부 (구형 브라우저 호환)
  if (!navigator.canShare) return !!navigator.share;

  return navigator.canShare(data);
}

const data = {
  title: '제목',
  url: 'https://example.com'
};

if (canShareData(data)) {
  await navigator.share(data);
}
```

`navigator.canShare(data)`는 `data`를 현재 환경에서 공유할 수 있는지 boolean으로 반환합니다. 파일 형식이 지원되지 않거나 브라우저 제한이 있는 경우 `false`를 반환합니다.

---

## 파일 공유

![Web Share API 코드 패턴](/assets/posts/net-web-share-code.svg)

```js
async function shareScreenshot() {
  // canvas를 Blob으로 변환
  const canvas = document.querySelector('canvas');
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  const file = new File([blob], 'screenshot.png', { type: 'image/png' });

  const shareData = { files: [file] };

  if (!navigator.canShare(shareData)) {
    // 파일 공유 미지원 → 다운로드로 폴백
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'screenshot.png';
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  await navigator.share(shareData);
}
```

지원 파일 형식: 이미지(JPEG·PNG·GIF·WebP), 오디오(MP3·OGG), 비디오(MP4·OGG), 텍스트(TXT·CSV). PDF는 일부 플랫폼에서만 지원됩니다.

---

## 현재 페이지 공유

```js
// 현재 페이지를 그대로 공유하는 공통 유틸
async function shareCurrentPage(extraText = '') {
  const shareData = {
    title: document.title,
    text: extraText || document.querySelector('meta[name=description]')?.content,
    url: window.location.href
  };

  if (navigator.share && navigator.canShare(shareData)) {
    await navigator.share(shareData);
  } else {
    // 클립보드 복사 폴백
    await navigator.clipboard.writeText(window.location.href);
    showToast('링크가 클립보드에 복사됐습니다');
  }
}
```

---

## Web Share Target API

Web Share Target은 **반대 방향** — 다른 앱에서 내 PWA로 공유받는 기능입니다. `manifest.json`에 설정합니다.

```json
// manifest.json
{
  "name": "My App",
  "share_target": {
    "action": "/share-handler",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url",
      "files": [
        { "name": "media", "accept": ["image/*"] }
      ]
    }
  }
}
```

```js
// /share-handler 페이지에서 처리
const params = new URLSearchParams(window.location.search);
const title = params.get('title');
const url = params.get('url');

// 또는 POST로 파일을 받는 경우
// fetch('/share-handler', { method: 'POST', body: formData })
```

PWA가 홈 화면에 추가되면 OS 공유 시트에 앱 목록으로 나타나고, 사용자가 선택하면 `/share-handler`로 이동합니다.

---

## 브라우저 지원 및 제약

| 플랫폼 | navigator.share | files 공유 |
|--------|-----------------|----------|
| Chrome Android | ✅ | ✅ (89+) |
| Chrome Desktop | ✅ (Windows/macOS) | ✅ |
| Safari iOS | ✅ | ✅ |
| Safari macOS | ✅ (12.1+) | ✅ |
| Firefox | ❌ | ❌ |

**주요 제약**:
- HTTPS 필수 (또는 localhost)
- 사용자 제스처 필수 (click, touchend 등)
- `url`은 `https://` 또는 같은 origin이어야 함
- `files`와 `url`을 동시에 사용할 수 없는 경우가 있음 (OS 제한)

---

## React 컴포넌트 예시

```jsx
function ShareButton({ post }) {
  const canShare = Boolean(navigator.share);

  const handleShare = async () => {
    try {
      await navigator.share({
        title: post.title,
        text: post.excerpt,
        url: `${window.location.origin}/posts/${post.slug}`
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        // AbortError는 사용자 취소이므로 무시
        console.error(err);
      }
    }
  };

  if (!canShare) {
    return <CopyLinkButton url={post.slug} />;
  }

  return (
    <button onClick={handleShare} type="button">
      공유하기
    </button>
  );
}
```

`AbortError`는 사용자가 공유 시트를 닫은 것이므로 오류 처리할 필요가 없습니다. 나머지 예외만 처리합니다.

---

**지난 글:** [Background Sync API · 오프라인 요청 큐](/posts/net-background-sync/)

**다음 글:** [Web Worker 기초 · 멀티스레드 JavaScript](/posts/worker-web-worker-basics/)

<br>
읽어주셔서 감사합니다. 😊
