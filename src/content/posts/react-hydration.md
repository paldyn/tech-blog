---
title: "하이드레이션 — SSR과 React 연결하기"
description: "서버사이드 렌더링(SSR)에서 서버가 생성한 HTML에 React가 이벤트 핸들러를 연결하는 하이드레이션 과정, render와 hydrateRoot의 차이, hydration mismatch 오류의 원인과 해결 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 7
type: "knowledge"
category: "React"
tags: ["React", "Hydration", "하이드레이션", "SSR", "서버사이드렌더링", "NextJS", "hydrateRoot"]
featured: false
draft: false
---

[지난 글](/posts/react-strict-mode/)에서 StrictMode의 동작 원리를 살펴봤다. 이번에는 서버사이드 렌더링(SSR)과 React를 연결하는 하이드레이션(Hydration)을 다룬다. Next.js, Remix 같은 프레임워크를 사용한다면 반드시 이해해야 할 개념이다.

## 클라이언트 전용 렌더링의 한계

기본 React 앱(`createRoot + render`)은 브라우저에서만 HTML을 생성한다.

```
1. 서버가 빈 HTML 전송: <div id="root"></div>
2. 브라우저가 JavaScript 다운로드 및 실행
3. React가 DOM 생성 → 화면 표시
```

이 방식의 문제는 JavaScript가 실행되기 전까지 사용자에게 빈 화면이 보인다는 것이다. FCP(First Contentful Paint)가 늦다. SEO에도 불리하다.

## SSR의 동작 방식

SSR은 서버에서 React 컴포넌트를 실행해 HTML 문자열을 만들어서 브라우저로 전송한다.

```
1. 서버가 React 컴포넌트 실행 → HTML 문자열 생성
2. 브라우저가 완성된 HTML 즉시 표시 (FCP 빠름)
3. JavaScript 로드 후 React가 이벤트 핸들러 연결 (하이드레이션)
```

사용자는 JavaScript 로드 전에도 콘텐츠를 볼 수 있다. 다만, JavaScript 로드 전에는 버튼 클릭 등 인터랙션이 동작하지 않는다.

![SSR + 하이드레이션 흐름](/assets/posts/react-hydration-ssr.svg)

## render vs hydrateRoot

```jsx
// 클라이언트 전용: DOM을 새로 생성
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')).render(<App />);

// SSR: 기존 HTML에 이벤트 핸들러 연결
import { hydrateRoot } from 'react-dom/client';
hydrateRoot(document.getElementById('root'), <App />);
```

`hydrateRoot`는 서버가 이미 만들어놓은 DOM 구조를 그대로 사용한다. DOM을 새로 만들지 않고 기존 HTML에 React의 이벤트 시스템과 state를 연결한다. 서버 HTML과 클라이언트 렌더 결과가 **일치한다는 것을 가정**하므로 매우 빠르다.

## 서버 렌더링 코드

React는 서버 렌더링을 위한 `react-dom/server` 패키지를 제공한다.

```jsx
// server.js
import { renderToString } from 'react-dom/server';
import App from './App';

// Express 예시
app.get('/', (req, res) => {
  const html = renderToString(<App />);
  res.send(`
    <!DOCTYPE html>
    <html>
      <body>
        <div id="root">${html}</div>
        <script src="/bundle.js"></script>
      </body>
    </html>
  `);
});
```

최신 React는 `renderToString` 대신 스트리밍을 지원하는 `renderToPipeableStream`을 권장한다. 큰 페이지를 청크 단위로 전송할 수 있어 TTFB(Time to First Byte)가 개선된다.

## Hydration Mismatch 오류

하이드레이션에서 가장 자주 만나는 문제다. 서버가 생성한 HTML과 클라이언트의 React가 렌더링한 결과가 다를 때 발생한다.

```
Warning: Text content did not match.
Server: "2026년 6월 4일"
Client: "2026년 6월 5일"
```

![Hydration Mismatch 오류와 해결책](/assets/posts/react-hydration-mismatch.svg)

원인은 대부분 서버와 클라이언트에서 다른 값을 사용하는 코드다.

**날짜/시간**:

```jsx
// 문제: 서버와 클라이언트의 실행 시간이 다름
function CurrentTime() {
  return <div>{new Date().toLocaleString()}</div>;
}

// 해결: 클라이언트에서만 렌더
function CurrentTime() {
  const [time, setTime] = useState(null);
  useEffect(() => {
    setTime(new Date().toLocaleString());
  }, []);
  return <div>{time ?? '로딩 중...'}</div>;
}
```

**브라우저 전용 API**:

```jsx
// 문제: localStorage는 서버에 없음
function ThemeButton() {
  const theme = localStorage.getItem('theme'); // 서버에서 에러!
  return <button>{theme}</button>;
}

// 해결: 마운트 후에만 접근
function ThemeButton() {
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    setTheme(localStorage.getItem('theme') ?? 'light');
  }, []);
  return <button>{theme}</button>;
}
```

**Math.random, UUID**:

```jsx
// 문제: 서버/클라이언트에서 다른 값 생성
const id = Math.random(); // 매번 다른 값

// 해결: useId 훅 사용 (React 18)
import { useId } from 'react';
function FormField() {
  const id = useId(); // SSR에서도 일관된 id 생성
  return <label htmlFor={id}>...</label>;
}
```

## suppressHydrationWarning

불가피하게 서버/클라이언트 값이 다를 수밖에 없는 경우, 해당 요소에 `suppressHydrationWarning`을 추가해 경고를 억제할 수 있다.

```jsx
<time
  dateTime={serverDate}
  suppressHydrationWarning
>
  {/* 클라이언트에서 다른 형식으로 표시해도 경고 없음 */}
  {clientFormattedDate}
</time>
```

남용하면 mismatch가 실제 UI 버그로 이어질 수 있으므로 주의해서 사용한다.

## Next.js에서의 하이드레이션

Next.js App Router는 기본적으로 서버 컴포넌트를 사용한다. 클라이언트 기능이 필요한 컴포넌트만 `'use client'`를 선언한다.

```jsx
// 서버 컴포넌트 — 하이드레이션 없음, JS 번들에 포함 안 됨
async function ServerPost({ id }) {
  const post = await fetchPost(id); // 서버에서 직접 실행
  return <article>{post.content}</article>;
}

// 클라이언트 컴포넌트 — 하이드레이션 필요
'use client';
function LikeButton({ postId }) {
  const [liked, setLiked] = useState(false);
  return <button onClick={() => setLiked(l => !l)}>{liked ? '♥' : '♡'}</button>;
}
```

---

**지난 글:** [StrictMode — 개발 환경 품질 검사](/posts/react-strict-mode/)

**다음 글:** [훅의 규칙 — 최상위에서만, 함수 컴포넌트에서만](/posts/react-rules-of-hooks/)

<br>
읽어주셔서 감사합니다. 😊
