---
title: "라우트 그룹 — URL 영향 없이 레이아웃 나누기"
description: "Next.js App Router의 라우트 그룹 (group) 문법을 완전히 이해합니다. URL 구조 변경 없이 레이아웃 분리, 여러 루트 레이아웃 구성, 폴더 구조 정리까지 실전 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 6
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "라우트 그룹", "layout", "App Router", "폴더 구조"]
featured: false
draft: false
---

[지난 글](/posts/next-catch-all-routes/)에서 catch-all 라우트로 가변 URL을 처리하는 방법을 배웠습니다. 이번에는 App Router의 숨겨진 강력한 기능, **라우트 그룹**을 다룹니다. 괄호 폴더 `(group)`은 URL에 나타나지 않으면서 파일을 논리적으로 묶고, 서로 다른 레이아웃을 적용할 수 있게 해줍니다.

## 라우트 그룹이란

폴더 이름을 괄호로 감싸면 라우트 그룹이 됩니다.

```
app/
├── (marketing)/
│   ├── page.tsx      → /
│   └── about/
│       └── page.tsx  → /about
└── (app)/
    └── dashboard/
        └── page.tsx  → /dashboard
```

`(marketing)`과 `(app)` 폴더 이름은 URL에 포함되지 않습니다. `/marketing/about`이 아니라 그냥 `/about`이 됩니다.

## 레이아웃 분리

라우트 그룹의 가장 강력한 용도는 **다른 레이아웃을 쓰는 라우트를 분리**하는 것입니다.

![라우트 그룹 폴더 구조](/assets/posts/next-route-groups-structure.svg)

공개 마케팅 페이지(`/`, `/about`, `/pricing`)와 인증이 필요한 앱 페이지(`/dashboard`, `/settings`)에 각각 다른 레이아웃을 적용할 수 있습니다.

![라우트 그룹 레이아웃 분리](/assets/posts/next-route-groups-layouts.svg)

```tsx
// app/(marketing)/layout.tsx — 헤더/푸터가 있는 마케팅 레이아웃
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}
```

```tsx
// app/(app)/layout.tsx — 사이드바 + 인증 체크
import { redirect } from 'next/navigation';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();
  if (!user) redirect('/login');

  return (
    <div className="flex">
      <Sidebar user={user} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

## 여러 루트 레이아웃

`app/layout.tsx`를 삭제하고 각 라우트 그룹에 루트 레이아웃을 두면 **완전히 다른 HTML 구조**를 가진 앱을 만들 수 있습니다.

```
app/
├── (shop)/
│   ├── layout.tsx   ← <html>과 <body> 정의 (쇼핑몰 전용)
│   └── ...
└── (blog)/
    ├── layout.tsx   ← <html>과 <body> 정의 (블로그 전용)
    └── ...
```

이 경우 각 그룹의 `layout.tsx`가 루트 레이아웃 역할을 하므로 `<html>`과 `<body>`를 반드시 포함해야 합니다.

## 폴더 구조 정리

라우트 그룹은 URL 영향 없이 폴더를 정리하는 용도로도 씁니다.

```
app/
├── (auth)/
│   ├── login/page.tsx    → /login
│   ├── signup/page.tsx   → /signup
│   └── forgot/page.tsx   → /forgot-password
└── (main)/
    ├── page.tsx          → /
    └── blog/
        └── page.tsx      → /blog
```

파일 시스템에서는 `(auth)/login`이지만 URL은 `/login`입니다.

## 주의사항: URL 충돌

같은 URL을 생성하는 라우트 그룹이 있으면 빌드 오류가 발생합니다.

```
app/
├── (a)/
│   └── about/page.tsx  → /about
└── (b)/
    └── about/page.tsx  → /about  ← ❌ 충돌!
```

라우트 그룹을 여러 개 사용할 때는 URL 충돌이 없는지 확인하세요.

---

**지난 글:** [Catch-all 라우트 — 가변 경로 세그먼트 처리](/posts/next-catch-all-routes/)

**다음 글:** [라우트 세그먼트 설정 — dynamic, revalidate, runtime](/posts/next-route-segment-config/)

<br>
읽어주셔서 감사합니다. 😊
