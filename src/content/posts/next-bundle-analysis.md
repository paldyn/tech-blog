---
title: "번들 분석 — @next/bundle-analyzer로 번들 크기 진단하기"
description: "Next.js 프로젝트의 번들 크기를 @next/bundle-analyzer로 시각화하고 불필요한 의존성을 찾아 제거하는 방법을 설명합니다. 트리맵 읽는 법부터 최적화 패턴까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 54
type: "knowledge"
category: "Next.js"
tags: ["nextjs", "번들분석", "bundle-analyzer", "번들최적화", "웹성능", "tree-shaking"]
featured: false
draft: false
---

[지난 글](/posts/next-dynamic-import/)에서 동적 임포트로 코드를 분리하는 방법을 살펴봤다. 이번 글은 **번들 분석**이다. 무엇을 최적화할지 모르는 상태에서는 최적화할 수 없다. `@next/bundle-analyzer`는 번들 구성을 인터랙티브 트리맵으로 시각화해, 어떤 모듈이 번들을 크게 만드는지 한눈에 파악하게 해준다.

## @next/bundle-analyzer 설치와 설정

```bash
npm install -D @next/bundle-analyzer
```

```ts
// next.config.ts
import type { NextConfig } from 'next'
import withBundleAnalyzer from '@next/bundle-analyzer'

const nextConfig: NextConfig = {
  // 기존 설정
}

const withAnalyzer = withBundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

export default withAnalyzer(nextConfig)
```

```json
// package.json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "analyze": "ANALYZE=true next build"
  }
}
```

```bash
npm run analyze
```

빌드가 완료되면 `client.html`, `server.html`, `edge.html` 세 개의 트리맵 파일이 자동으로 열린다.

![번들 분석 설정 방법](/assets/posts/next-bundle-analysis-config.svg)

## 트리맵 읽는 법

![번들 분석 — 크기 구성 예시](/assets/posts/next-bundle-analysis-treemap.svg)

트리맵에서 **넓은 블록**이 번들에서 큰 비중을 차지하는 모듈이다. 색상은 번들러가 자동으로 구분하며, 각 블록에 커서를 올리면 정확한 크기(gzip 압축 전/후)를 확인할 수 있다.

집중해야 할 항목:
- `node_modules` 안의 대형 라이브러리 (moment.js, lodash, chart.js 등)
- 특정 페이지에서만 쓰이는데 공유 청크에 포함된 모듈
- 같은 기능의 유사 라이브러리가 중복 포함된 경우

## 자주 발견되는 문제와 해결책

### lodash 전체 포함

```ts
// ❌ 전체 lodash 포함 (~70kB)
import _ from 'lodash'
const result = _.cloneDeep(obj)

// ✅ 필요한 함수만 가져오기 (tree-shaking)
import cloneDeep from 'lodash/cloneDeep'
const result = cloneDeep(obj)

// ✅ 더 좋은 방법: 네이티브 대체
const result = structuredClone(obj) // Node 17+, 모던 브라우저
```

### moment.js

```ts
// ❌ moment.js + locale 데이터 (~300kB)
import moment from 'moment'

// ✅ date-fns (tree-shakable, ~2kB/함수)
import { format, addDays } from 'date-fns'
import { ko } from 'date-fns/locale'

format(new Date(), 'yyyy-MM-dd', { locale: ko })
```

### 아이콘 라이브러리

```ts
// ❌ 전체 패키지 가져오기
import { FaHome, FaUser } from 'react-icons/fa'

// ✅ 개별 파일 직접 가져오기
import FaHome from 'react-icons/fa/FaHome'
import FaUser from 'react-icons/fa/FaUser'
```

## `next build` 출력으로 빠른 체크

분석 도구 없이도 `next build` 출력에서 각 페이지의 번들 크기를 확인할 수 있다.

```
Route (app)                   Size     First Load JS
┌ ○ /                         5.1 kB         102 kB
├ ○ /about                    1.2 kB          98 kB
└ ● /blog/[slug]              3.8 kB         146 kB
    └ chunks/...

First Load JS shared by all   96 kB
  ├ chunks/framework.js       45 kB
  ├ chunks/main.js            31 kB
  └ chunks/polyfills.js       87 B
```

- **First Load JS**: 해당 페이지의 초기 JS 크기. 100kB 이하가 이상적
- **shared by all**: 모든 페이지가 공통으로 로드하는 청크. 줄이면 전체 사이트 성능에 영향

## 번들 크기 목표

| 지표 | 권장값 | 경고 수준 |
|------|--------|----------|
| 초기 JS (First Load JS) | < 100kB | > 200kB |
| 페이지별 고유 JS | < 30kB | > 100kB |
| 공유 청크 | < 80kB | > 150kB |

## `bundlePagesRouterDependencies` (Pages Router)

Pages Router 사용 시 서버 번들에 불필요한 패키지가 포함되는 경우가 있다.

```ts
// next.config.ts
const nextConfig: NextConfig = {
  bundlePagesRouterDependencies: true, // 서버 번들 최적화
  serverExternalPackages: ['heavy-server-lib'], // 서버에서만 쓰는 큰 패키지 외부화
}
```

App Router에서는 Server Component가 자동으로 서버 번들에만 포함되므로 별도 설정이 필요 없다.

---

**지난 글:** [동적 임포트 — next/dynamic으로 코드 스플리팅하기](/posts/next-dynamic-import/)

**다음 글:** [성능 최적화 — Core Web Vitals 개선 전략](/posts/next-performance/)

<br>
읽어주셔서 감사합니다. 😊
