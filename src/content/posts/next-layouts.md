---
title: "Next.js 레이아웃 — 중첩 레이아웃과 루트 레이아웃"
description: "Next.js App Router의 레이아웃 시스템을 완전히 이해합니다. 루트 레이아웃, 중첩 레이아웃, 메타데이터 내보내기, 라우트 그룹을 활용한 레이아웃 분리까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 10
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "layout", "중첩 레이아웃", "App Router", "metadata"]
featured: false
draft: false
---

[지난 글](/posts/next-environment-variables/)에서 환경 변수 관리 방법을 익혔습니다. 이번에는 App Router의 핵심 기능 중 하나인 **레이아웃 시스템**을 상세히 살펴봅니다. Pages Router의 단일 `_app.tsx` 래퍼에서 어떻게 진화했는지, 중첩 레이아웃이 어떤 문제를 해결하는지 이해합니다.

## 루트 레이아웃 — 필수 파일

`app/layout.tsx`는 **전체 애플리케이션의 진입점**입니다. `<html>`과 `<body>` 태그를 반드시 포함해야 합니다.

```tsx
// app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '내 Next.js 앱',
  description: '앱 설명',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
```

루트 레이아웃의 특성:
- 애플리케이션 전체에 적용 (페이지 이동 시 리렌더 없음)
- 폰트, 전역 CSS, 공통 프로바이더를 한 곳에서 설정
- `metadata` export로 기본 SEO 메타태그 설정

## 중첩 레이아웃

![중첩 레이아웃 구조](/assets/posts/next-layouts-nesting.svg)

특정 라우트 그룹에만 적용되는 레이아웃은 해당 폴더에 `layout.tsx`를 추가하면 됩니다.

```tsx
// app/dashboard/layout.tsx
import { Sidebar } from '@/components/Sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

`/dashboard`, `/dashboard/settings`, `/dashboard/profile` 모두 이 레이아웃을 공유합니다. 레이아웃 중첩 순서는:

```
RootLayout (app/layout.tsx)
  └── DashboardLayout (app/dashboard/layout.tsx)
        └── page.tsx (app/dashboard/page.tsx)
```

## 레이아웃의 상태 유지

**레이아웃은 라우트 이동 시 리렌더되지 않습니다.** 이 특성을 활용하면:

- 사이드바 상태(열림/닫힘) 유지
- 검색창 입력값 유지
- 모달, 토스트 등 플로팅 UI 지속 표시

반면, 페이지 이동마다 레이아웃을 초기화해야 하는 경우에는 `template.tsx`를 사용합니다.

## 라우트 그룹으로 레이아웃 분리

괄호 폴더(`(group)`)를 활용하면 URL 구조는 유지하면서 레이아웃을 다르게 적용할 수 있습니다.

```
app/
├── (marketing)/
│   ├── layout.tsx   ← 마케팅 레이아웃 (헤더, 푸터)
│   ├── page.tsx     → /
│   ├── about/
│   │   └── page.tsx → /about
│   └── pricing/
│       └── page.tsx → /pricing
└── (app)/
    ├── layout.tsx   ← 앱 레이아웃 (사이드바, 인증 체크)
    └── dashboard/
        └── page.tsx → /dashboard
```

`(marketing)` 그룹의 페이지들은 헤더·푸터가 있는 마케팅 레이아웃을 쓰고, `(app)` 그룹은 사이드바가 있는 앱 레이아웃을 씁니다. URL에는 그룹명이 나타나지 않습니다.

## metadata — SEO 설정

레이아웃과 페이지 모두에서 `metadata` 객체를 export할 수 있습니다.

![레이아웃에서 metadata 내보내기](/assets/posts/next-layouts-metadata.svg)

자식 레이아웃/페이지의 `metadata`는 부모의 것을 **자동으로 병합**합니다.

```tsx
// app/layout.tsx
export const metadata = {
  title: {
    template: '%s | 내 앱',  // 자식 페이지 제목 템플릿
    default: '내 앱',
  },
};

// app/about/page.tsx
export const metadata = {
  title: '회사 소개',  // → "회사 소개 | 내 앱"
};
```

동적 라우트에서 각 페이지별 메타데이터를 생성하려면 `generateMetadata` 함수를 씁니다.

```tsx
// app/blog/[slug]/page.tsx
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      images: [post.thumbnail],
    },
  };
}
```

## 레이아웃에서 데이터 패칭

레이아웃은 서버 컴포넌트이므로 데이터를 직접 패칭할 수 있습니다.

```tsx
// app/dashboard/layout.tsx
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser(); // 서버에서 직접 패칭
  if (!user) redirect('/login');

  return (
    <div className="flex">
      <Sidebar user={user} />
      <main>{children}</main>
    </div>
  );
}
```

레이아웃에서 인증을 확인하면 모든 하위 페이지에서 반복 확인이 필요 없습니다. 단, **레이아웃은 `params`에 접근할 수 없습니다.** 현재 경로의 동적 파라미터가 필요하면 페이지에서 처리해야 합니다.

---

**지난 글:** [환경 변수 완전 정복 — .env 파일부터 NEXT_PUBLIC까지](/posts/next-environment-variables/)

<br>
읽어주셔서 감사합니다. 😊
