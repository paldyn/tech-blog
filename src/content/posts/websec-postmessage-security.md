---
title: "postMessage 보안: 크로스 오리진 통신 안전하게"
description: "window.postMessage로 크로스 오리진 통신 시 발생하는 origin 미검증·wildcard targetOrigin·XSS 삽입 취약점과 안전한 메시지 스키마 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 2
type: "knowledge"
category: "Security"
tags: ["postMessage", "크로스오리진", "XSS", "브라우저보안", "iframe", "메시지통신"]
featured: false
draft: false
---

[지난 글](/posts/websec-iframe-sandbox/)에서 iframe sandbox로 임베드 콘텐츠를 격리하는 방법을 살펴봤다. sandbox는 iframe의 권한을 제한하지만, 부모 페이지와 iframe이 데이터를 주고받아야 하는 경우가 있다. 이때 유일하게 허용되는 안전한 채널이 `window.postMessage` API다.

## postMessage의 동작 원리

`postMessage`는 서로 다른 오리진 간에 메시지를 비동기로 전달하는 브라우저 내장 API다.

```javascript
// 발신 (부모 페이지)
iframeEl.contentWindow.postMessage(data, targetOrigin);

// 수신 (iframe 또는 팝업)
window.addEventListener('message', (event) => {
  // event.origin: 발신자 오리진
  // event.data: 전달된 데이터
  // event.source: 발신자 Window 참조
});
```

Same-Origin Policy는 직접적인 DOM 접근과 쿠키 공유를 막지만, `postMessage`는 명시적으로 SOP를 우회해 메시지를 전달하는 안전한 대안이다. 단, 안전하게 쓰려면 몇 가지 규칙을 반드시 지켜야 한다.

![postMessage 통신 흐름](/assets/posts/websec-postmessage-flow.svg)

## 주요 취약점 3가지

![postMessage 취약점과 방어 패턴](/assets/posts/websec-postmessage-attacks.svg)

### ① targetOrigin에 와일드카드(`*`) 사용

```javascript
// 취약한 코드 — 토큰을 모든 오리진에 브로드캐스트
iframe.contentWindow.postMessage({ token: authToken }, '*');
```

`'*'`를 지정하면 현재 페이지에 임베드된 모든 오리진의 window가 메시지를 수신할 수 있다. 공격자가 악성 iframe을 같은 페이지에 삽입하거나, 중간자가 메시지를 가로채면 토큰이 유출된다.

```javascript
// 안전한 코드
const WIDGET_ORIGIN = 'https://widget.example.com';
iframe.contentWindow.postMessage({ token: authToken }, WIDGET_ORIGIN);
```

정확한 오리진을 지정하면 브라우저가 수신자 윈도우의 오리진을 검사해, 불일치 시 메시지 전달 자체를 차단한다.

### ② 수신 측 origin 미검증

```javascript
// 취약한 수신 코드
window.addEventListener('message', (event) => {
  // origin 확인 없이 바로 처리 → 임의 오리진이 메시지 전송 가능
  processCommand(event.data);
});
```

수신 측에서 `event.origin`을 검증하지 않으면 임의 사이트에서 `postMessage`를 보내 수신자의 로직을 트리거할 수 있다. 피해자가 공격자 페이지를 방문한 상태에서 금융 거래가 실행되는 등의 공격이 가능하다.

```javascript
// 안전한 수신 코드
const TRUSTED_ORIGIN = 'https://parent.example.com';

window.addEventListener('message', (event) => {
  // ① origin 검증 (정확한 문자열 비교)
  if (event.origin !== TRUSTED_ORIGIN) return;

  // ② 타입 기반 처리 (eval 절대 금지)
  switch (event.data.type) {
    case 'INIT_CONFIG':
      applyConfig(event.data.payload);
      break;
    case 'USER_ACTION':
      handleAction(event.data.payload);
      break;
  }
});
```

### ③ data를 innerHTML에 직접 삽입

```javascript
// 취약한 코드 — 수신한 데이터를 DOM에 직접 삽입
window.addEventListener('message', (event) => {
  if (event.origin !== TRUSTED_ORIGIN) return;
  // origin은 검증했지만 XSS는 여전히 발생 가능
  document.getElementById('content').innerHTML = event.data.html;
});
```

신뢰된 오리진에서 온 메시지라도 해당 오리진 자체가 XSS에 취약하다면 오염된 데이터가 전달될 수 있다. `innerHTML` 대신 `textContent`를 사용하거나, DOMPurify로 정제한 후 삽입해야 한다.

```javascript
// 안전한 삽입
import DOMPurify from 'dompurify';

const clean = DOMPurify.sanitize(event.data.html);
document.getElementById('content').innerHTML = clean;

// HTML 불필요 시 textContent 사용
document.getElementById('label').textContent = event.data.text;
```

## 메시지 스키마 설계

postMessage로 주고받는 데이터는 **타입 기반 구조화 스키마**를 사용해야 한다.

```javascript
// 권장 메시지 스키마
const message = {
  type: 'PAYMENT_RESULT',  // 문자열 상수 (enum 같이 관리)
  version: 1,              // 스키마 버전
  payload: {               // 실제 데이터
    status: 'success',
    transactionId: 'TXN-123'
  }
};

// Zod 같은 스키마 검증 라이브러리 활용
import { z } from 'zod';

const MessageSchema = z.object({
  type: z.enum(['PAYMENT_RESULT', 'INIT_DONE', 'ERROR']),
  version: z.number(),
  payload: z.unknown()
});

window.addEventListener('message', (event) => {
  if (event.origin !== TRUSTED_ORIGIN) return;

  const parsed = MessageSchema.safeParse(event.data);
  if (!parsed.success) return; // 유효하지 않은 스키마 무시

  handleMessage(parsed.data);
});
```

## 리액트/Next.js 환경에서의 구현

```typescript
// hooks/usePostMessage.ts
import { useEffect, useCallback } from 'react';

const TRUSTED_ORIGIN = process.env.NEXT_PUBLIC_WIDGET_ORIGIN!;

export function usePostMessage<T>(
  handler: (data: T) => void
) {
  const listener = useCallback((event: MessageEvent) => {
    if (event.origin !== TRUSTED_ORIGIN) return;
    handler(event.data as T);
  }, [handler]);

  useEffect(() => {
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [listener]);
}
```

`useEffect` 클린업에서 리스너를 제거하지 않으면 컴포넌트 언마운트 후에도 리스너가 남아 메모리 누수와 예기치 않은 동작이 생긴다.

## 보안 체크리스트

| 항목 | 확인 |
|---|---|
| `postMessage(data, '*')` 사용 여부 | 반드시 구체적 오리진 지정 |
| 수신 측 `event.origin` 검증 | 반드시 검증, 불일치 시 즉시 return |
| `eval(event.data)` 사용 | 절대 금지 |
| `innerHTML = event.data` | DOMPurify 정제 또는 textContent 사용 |
| 메시지 스키마 검증 | Zod 등으로 타입 검증 |
| 리스너 클린업 | removeEventListener 반드시 |

---

**지난 글:** [iframe sandbox: 안전한 임베드를 위한 격리](/posts/websec-iframe-sandbox/)

**다음 글:** [쿠키 보안: Secure·HttpOnly·SameSite 완전 정복](/posts/websec-cookie-security/)

<br>
읽어주셔서 감사합니다. 😊
