---
title: "Vercel 배포 — Next.js 앱을 프로덕션에 올리는 최선의 방법"
description: "Vercel에 Next.js 앱을 배포하는 전체 과정을 다룹니다. GitHub 연동, 환경 변수 설정, Preview 배포, 커스텀 도메인, Analytics 활성화까지 실전 위주로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 61
type: "knowledge"
category: "Next.js"
tags: ["nextjs", "Vercel", "배포", "CI/CD", "EdgeNetwork", "환경변수", "PreviewDeploy"]
featured: false
draft: false
---

[지난 글](/posts/next-e2e-testing/)에서 Playwright로 E2E 테스트를 작성하는 방법을 다뤘다. 코드 품질을 검증했다면 이제 실제 서비스를 인터넷에 올릴 차례다. Next.js에게 가장 최적화된 배포 플랫폼은 단연 **Vercel**이다. 빌드 캐시, Edge Network, ISR, Server Actions까지 Next.js 전 기능이 Vercel 위에서 별도 설정 없이 동작한다.

## Vercel 배포 프로세스

코드를 `git push`하는 순간 Vercel이 자동으로 빌드·배포한다.

![Vercel 배포 프로세스](/assets/posts/next-deployment-vercel-flow.svg)

브랜치마다 다른 배포 URL이 생긴다. `main` 브랜치에 머지하면 프로덕션으로, PR을 열면 Preview URL이 자동 생성된다. 팀원이 PR을 리뷰할 때 실제 동작하는 환경을 바로 공유할 수 있다.

## 1. 프로젝트 연결

```bash
npm i -g vercel
vercel login          # GitHub / GitLab / Email 로그인
vercel link           # 현재 디렉토리를 Vercel 프로젝트에 연결
```

처음 연결 시 프레임워크(Next.js)를 자동 감지해 빌드 명령(`next build`)과 출력 디렉토리(`.next`)를 설정한다. 별도 수정 없이 그대로 진행해도 된다.

## 2. GitHub 연동 — 자동 배포

Vercel 대시보드 → **Add New Project** → GitHub 저장소 선택 → **Deploy**. 이후 `git push`마다 자동 배포된다.

```bash
git push origin main        # → Production 배포 자동 트리거
git push origin feature/foo # → Preview 배포 자동 트리거
```

## 3. vercel.json

배포 동작을 세부 제어하려면 프로젝트 루트에 `vercel.json`을 추가한다.

```json
{
  "buildCommand": "next build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "regions": ["icn1"],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    }
  ]
}
```

`regions`에 `"icn1"`(인천)을 명시하면 서버리스 함수가 한국 리전에서 실행된다. 단, Edge Functions는 전 세계 엣지에서 실행되어 지역 설정이 의미 없다.

## 4. 환경 변수

![Vercel 주요 기능](/assets/posts/next-deployment-vercel-config.svg)

대시보드 **Settings → Environment Variables**에서 세 범위(Production / Preview / Development)로 나눠 관리한다. 로컬 개발 시 Vercel CLI로 동기화하면 `.env.local`을 직접 관리하지 않아도 된다.

```bash
vercel env pull .env.local   # Vercel에 등록된 환경 변수를 로컬로 가져오기
```

`NEXT_PUBLIC_` 접두사가 붙은 변수만 브라우저에 노출된다. 서버 전용 비밀값(DB 비밀번호, API 키)은 접두사 없이 등록한다.

## 5. 커스텀 도메인

대시보드 **Settings → Domains → Add** → 도메인 입력 → DNS 레코드(A 또는 CNAME)를 도메인 등록 기관에서 설정. SSL 인증서는 Vercel이 Let's Encrypt로 자동 발급·갱신한다.

```
A     @     76.76.21.21
CNAME www   cname.vercel-dns.com
```

## 6. Analytics & Speed Insights

`@vercel/analytics`와 `@vercel/speed-insights` 패키지를 추가하면 Web Vitals(LCP, CLS, TTFB)를 실시간으로 수집한다.

```tsx
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

대시보드 **Analytics** 탭에서 페이지별 성능 지표와 사용자 세션 데이터를 확인할 수 있다.

## 7. 배포 롤백

배포가 잘못됐을 때 이전 버전으로 즉시 복구할 수 있다. 대시보드 **Deployments** 탭에서 원하는 배포를 선택 → **Promote to Production** 클릭. CLI로는 다음과 같다.

```bash
vercel rollback [deployment-url]
```

## Vercel이 관리하는 것, 개발자가 관리해야 할 것

| 항목 | Vercel 자동 | 개발자 설정 |
|------|------------|------------|
| SSL 인증서 | ✅ | — |
| 빌드 캐시 | ✅ | — |
| ISR 재검증 | ✅ | revalidate 값 설정 |
| 환경 변수 | — | 대시보드 등록 |
| 커스텀 도메인 | — | DNS 레코드 설정 |
| 리전 선택 | 자동(Edge) | vercel.json regions |

---

**지난 글:** [E2E 테스트 — Playwright로 전체 흐름 검증하기](/posts/next-e2e-testing/)

**다음 글:** [Docker로 셀프 호스팅 — Next.js를 직접 배포하는 방법](/posts/next-self-hosting-docker/)

<br>
읽어주셔서 감사합니다. 😊
