---
title: "React.lazy와 코드 스플리팅"
description: "React.lazy와 동적 import()로 번들을 분리하는 방법, 라우트 기반 코드 스플리팅, named export 처리, 프리로드 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 6
type: "knowledge"
category: "React"
tags: ["React", "lazy", "코드스플리팅", "Suspense", "동적import", "번들최적화"]
featured: false
draft: false
---

[지난 글](/posts/react-suspense-data-fetching/)에서 Suspense와 데이터 페칭을 살펴봤다. 이번에는 `React.lazy`로 자바스크립트 번들을 분리해 초기 로딩을 최적화하는 **코드 스플리팅**을 다룬다.

## 코드 스플리팅이 필요한 이유

SPA는 전체 앱의 자바스크립트를 하나의 번들로 묶어 전송하는 경향이 있다. 사용자가 로그인 페이지만 방문해도 대시보드, 관리자 패널의 코드까지 다운로드한다.

코드 스플리팅은 **사용자가 실제로 방문한 페이지의 코드만 다운로드**하게 한다. 초기 로딩 속도(TTI, Time to Interactive)가 크게 개선된다.

![코드 스플리팅 효과](/assets/posts/react-lazy-loading-split.svg)

## React.lazy 기본 사용법

```tsx
import { lazy, Suspense } from 'react';

// 동적 import — 이 시점에 번들 분리
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));
const Admin = lazy(() => import('./pages/Admin'));

function App() {
  return (
    <Suspense fallback={<div>페이지 불러오는 중...</div>}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </Suspense>
  );
}
```

`React.lazy`는 `() => import(...)` 형태의 함수를 인자로 받는다. 해당 컴포넌트가 처음 렌더링될 때 청크를 네트워크로 로드한다.

**제약사항**: `React.lazy`는 **default export**가 있는 컴포넌트만 지원한다.

## named export 처리

named export 컴포넌트를 lazy로 불러오려면 `.then()`으로 래핑한다:

```tsx
// MyComponent.tsx: export function MyComp() { ... }
const MyComp = lazy(() =>
  import('./MyComponent').then((module) => ({
    default: module.MyComp,
  }))
);
```

또는 해당 파일에 default export를 추가하는 방법도 있다.

## Skeleton UI로 부드러운 전환

```tsx
function PageSkeleton() {
  return (
    <div className="skeleton-container">
      <div className="skeleton-header" />
      <div className="skeleton-content" />
      <div className="skeleton-content" />
    </div>
  );
}

const Dashboard = lazy(() => import('./pages/Dashboard'));

function App() {
  return (
    <ErrorBoundary fallback={<div>페이지를 불러오지 못했습니다. 새로고침해주세요.</div>}>
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
```

Spinner보다 실제 레이아웃과 유사한 Skeleton UI를 쓰면 사용자가 콘텐츠를 기다리는 느낌이 줄어든다. ErrorBoundary를 감싸는 것도 중요하다 — 네트워크 오류로 청크 로드가 실패할 수 있다.

## 프리로드로 딜레이 최소화

![named export 처리와 프리로드](/assets/posts/react-lazy-loading-preload.svg)

사용자가 버튼에 마우스를 올렸을 때 미리 청크를 로드하면, 실제 클릭 시 이미 로드되어 있어 딜레이가 없다:

```tsx
// lazyFn을 변수로 분리
const loadDashboard = () => import('./pages/Dashboard');
const Dashboard = lazy(loadDashboard);

function NavButton() {
  return (
    <button
      onMouseEnter={() => loadDashboard()} // 마우스 올릴 때 프리로드
      onClick={() => navigate('/dashboard')}
    >
      대시보드로
    </button>
  );
}
```

브라우저는 같은 URL의 동적 import 결과를 캐시하므로, `loadDashboard()`를 여러 번 호출해도 실제 네트워크 요청은 한 번만 발생한다.

## Vite에서 청크 이름 지정

```tsx
const Dashboard = lazy(() =>
  import(/* webpackChunkName: "dashboard" */ './pages/Dashboard')
);

// Vite의 경우
const Dashboard = lazy(() =>
  import('./pages/Dashboard').then((m) => ({ default: m.default }))
);
```

Vite는 자동으로 파일명 기반 청크 이름을 생성하므로 특별한 설정이 없어도 된다. Webpack을 쓴다면 magic comment로 이름을 지정할 수 있다.

## 컴포넌트 수준 스플리팅

라우트뿐 아니라 무거운 컴포넌트도 lazy로 분리할 수 있다:

```tsx
const RichTextEditor = lazy(() => import('./RichTextEditor'));
const MapView = lazy(() => import('./MapView'));
const DataChart = lazy(() => import('./DataChart'));

function PostEditor({ showMap }: { showMap: boolean }) {
  return (
    <div>
      <Suspense fallback={<EditorSkeleton />}>
        <RichTextEditor />
      </Suspense>
      {showMap && (
        <Suspense fallback={<MapSkeleton />}>
          <MapView />
        </Suspense>
      )}
    </div>
  );
}
```

Rich Text Editor나 지도 라이브러리는 수백 KB에 달하는 경우가 많다. 이 컴포넌트들을 lazy로 분리하면 초기 번들 크기를 대폭 줄일 수 있다.

## 스플리팅 적용 전 번들 분석

무작위로 스플리팅하기보다 **어떤 청크가 크고 불필요하게 포함됐는지 파악**하는 것이 먼저다.

```bash
# Vite
npm run build -- --report

# webpack
npx webpack-bundle-analyzer
```

번들 분석 후 다음 기준으로 스플리팅을 결정한다:
- 초기 렌더링에 필요하지 않은 페이지/기능
- 큰 서드파티 라이브러리를 포함하는 컴포넌트
- 조건부로 표시되는 무거운 UI (모달, 드로어)

## 한계와 주의사항

| 항목 | 내용 |
|------|------|
| SSR | `React.lazy`는 SSR 미지원 — Next.js는 `next/dynamic` 사용 |
| 로드 실패 | 네트워크 오류 시 ErrorBoundary 필요 |
| 과도한 분리 | HTTP 요청 수 증가 → HTTP/2 환경에서는 덜 문제되지만 주의 |

---

**지난 글:** [Suspense와 데이터 페칭](/posts/react-suspense-data-fetching/)

**다음 글:** [동시성(Concurrent) 기능 개요](/posts/react-concurrent-features/)

<br>
읽어주셔서 감사합니다. 😊
