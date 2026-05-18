---
title: "SPA vs MPA vs MFE — 프론트엔드 아키텍처 선택"
description: "SPA, MPA, Micro-Frontend의 렌더링 전략·성능·SEO·팀 구조 비교, CSR/SSR/SSG/ISR 스펙트럼, Module Federation과 single-spa 소개, 아키텍처 선택 기준을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "SPA", "MPA", "MicroFrontend", "아키텍처", "렌더링", "ModuleFederation", "프레임워크"]
featured: false
draft: false
---

[지난 글](/posts/lint-custom-rules/)에서 ESLint 커스텀 규칙을 작성하는 방법을 다뤘습니다. 이번부터는 **프론트엔드 프레임워크와 아키텍처** 시리즈를 시작합니다. 첫 주제는 가장 근본적인 질문, **"우리 서비스는 SPA로 만들어야 할까, MPA로 만들어야 할까?"**입니다. 그리고 대규모 조직에서 등장한 세 번째 선택지인 **Micro-Frontend(MFE)**까지 살펴봅니다.

---

## 세 가지 아키텍처 비교

![SPA vs MPA vs MFE 아키텍처 비교](/assets/posts/fw-spa-mpa-mfe-compare.svg)

### SPA (Single-Page Application)

서버에서 HTML은 최소한으로만 보내고, 페이지 전환과 콘텐츠 렌더링을 **브라우저의 JavaScript**가 담당합니다. `history.pushState()`로 URL을 바꾸고, 필요한 데이터만 API로 가져와 DOM을 업데이트합니다. React, Vue, Angular의 기본 빌드 출력이 이 방식입니다.

**장점**
- 페이지 전환 속도가 빠르고 앱처럼 느껴집니다.
- 서버와의 인터페이스가 API 하나로 단순합니다.
- 상태 관리가 클라이언트에 집중되어 UI 일관성 유지가 쉽습니다.

**단점**
- 첫 번째 의미 있는 렌더링(FCP)이 JS 번들 다운로드·파싱 후에 일어납니다.
- 검색엔진 크롤러가 JS를 실행하지 않으면 빈 페이지를 보게 됩니다 (SSR로 해결).
- 번들 크기 관리가 중요합니다.

### MPA (Multi-Page Application)

요청마다 서버가 완성된 HTML을 내려줍니다. 전통적인 웹 방식입니다. Next.js, Nuxt, Astro 같은 메타 프레임워크도 기본적으로 MPA 구조를 채택하면서 일부 영역에서 클라이언트 사이드 하이드레이션을 추가합니다.

**장점**
- 서버가 HTML을 렌더링하므로 첫 화면이 빠르고 SEO에 유리합니다.
- JS를 완전히 비활성화해도 기본 기능이 동작합니다.
- 페이지별로 독립적이어서 부분 장애 영향이 적습니다.

**단점**
- 페이지 전환마다 전체 HTML을 다시 받으므로 네이티브 앱 수준의 UX가 어렵습니다.
- 공유 상태(장바구니, 로그인 정보 등)를 페이지 간에 전달하기 위해 추가 작업이 필요합니다.

### MFE (Micro-Frontend)

하나의 프론트엔드를 **여러 독립 팀이 개발·배포하는 작은 앱들로 나누는** 아키텍처입니다. 마이크로서비스의 프론트엔드 버전입니다. 팀 A는 React, 팀 B는 Vue를 쓰더라도 Shell 앱이 이들을 런타임에 합성합니다.

---

## 렌더링 전략 스펙트럼

![렌더링 전략 스펙트럼](/assets/posts/fw-spa-mpa-mfe-rendering.svg)

| 전략 | 렌더링 시점 | TTFB | FCP | 동적 데이터 |
|---|---|---|---|---|
| CSR | 브라우저 | 빠름 | 느림 | 가능 |
| SSR | 요청마다 서버 | 보통 | 빠름 | 가능 |
| SSG | 빌드 타임 | 매우 빠름 | 매우 빠름 | 제한적 |
| ISR | 빌드 + 주기적 재생성 | 매우 빠름 | 매우 빠름 | 가능 |
| Streaming SSR | 서버 (청크 단위) | 매우 빠름 | 빠름 | 가능 |

**ISR(Incremental Static Regeneration)**은 Next.js가 도입한 방식으로, SSG 페이지를 일정 시간 후 백그라운드에서 재생성합니다. 대부분의 요청은 캐시된 정적 파일을 받고, 만료 후 첫 요청자는 낡은 페이지를 받지만 동시에 재생성이 트리거됩니다.

---

## Micro-Frontend 구현 방식

### 1. Webpack Module Federation

런타임에 다른 앱의 번들을 동적으로 로드합니다. Webpack 5에 내장되어 있습니다.

```javascript
// shop-app/webpack.config.js (Remote)
new ModuleFederationPlugin({
  name: 'teamA',
  filename: 'remoteEntry.js',
  exposes: {
    './App': './src/App',
    './ProductCard': './src/components/ProductCard',
  },
  shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
})

// shell/webpack.config.js (Host)
new ModuleFederationPlugin({
  name: 'shell',
  remotes: {
    teamA: 'teamA@https://shop.example.com/remoteEntry.js',
  },
  shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
})
```

```javascript
// shell/src/App.jsx
const ProductApp = React.lazy(() => import('teamA/App'))

function App() {
  return (
    <Suspense fallback={<div>로딩 중...</div>}>
      <ProductApp />
    </Suspense>
  )
}
```

### 2. single-spa

프레임워크 불문 MFE 오케스트레이터입니다. 각 앱을 등록하고 URL에 따라 마운트/언마운트합니다.

```javascript
import { registerApplication, start } from 'single-spa'

registerApplication({
  name: '@company/products',
  app: () => import('@company/products'),
  activeWhen: '/products',
})

registerApplication({
  name: '@company/checkout',
  app: () => import('@company/checkout'),
  activeWhen: ['/cart', '/checkout'],
})

start()
```

### 3. iframe 방식

격리가 가장 강력하지만 UX(스크롤, 포커스, 통신)가 복잡합니다. 보안이 최우선인 결제 모듈에 적합합니다.

---

## 아키텍처 선택 기준

```
서비스 성격은?
├── 콘텐츠 중심 (블로그, 커머스 상품 목록) → MPA + SSG/ISR
├── 앱 중심 (대시보드, 어드민, SaaS) → SPA + CSR 또는 SSR
└── 대규모 조직 (10개 이상 독립 팀) → MFE
    ├── 팀이 독립 배포 필요? → Module Federation
    └── 프레임워크 혼합 필요? → single-spa
```

주의할 점: **MFE는 복잡성 비용이 매우 큽니다.** 공유 의존성 버전 충돌, 팀 간 계약(Contract) 관리, 런타임 로딩 실패 처리 등이 추가됩니다. 팀이 10명 이하이고 배포 속도 문제가 없다면 모노레포 SPA가 훨씬 단순합니다.

---

**지난 글:** [ESLint 커스텀 규칙 — AST 기반 규칙 작성](/posts/lint-custom-rules/)

**다음 글:** [React 핵심 원리 — Virtual DOM, Fiber, Reconciliation](/posts/fw-react-core/)

<br>
읽어주셔서 감사합니다. 😊
