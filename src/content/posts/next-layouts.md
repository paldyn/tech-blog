---
title: "레이아웃 시스템 완전 해설 — 중첩 레이아웃과 상태 보존"
description: "Next.js App Router의 레이아웃 시스템을 완전 해설합니다. 루트 레이아웃 필수 요소, 중첩 레이아웃, layout vs template, 메타데이터 설정까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 10
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "레이아웃", "layout", "AppRouter", "RootLayout", "중첩레이아웃", "Metadata"]
featured: false
draft: false
---

[지난 글](/posts/next-environment-variables/)에서 환경 변수로 서버 시크릿을 안전하게 관리하는 방법을 배웠다. 이번에는 Next.js App Router의 핵심 기능 중 하나인 **레이아웃 시스템**을 완전히 파고든다. `layout.tsx`를 제대로 이해하면 복잡한 중첩 UI도 깔끔하게 구현할 수 있다.

## 레이아웃이란

레이아웃(Layout)은 여러 페이지에 공통으로 적용되는 UI 껍데기다. 웹사이트의 헤더, 사이드바, 푸터가 페이지마다 동일하게 표시되어야 할 때, 각 `page.tsx`에 반복해서 쓰는 대신 `layout.tsx`에 한 번 정의하면 된다.

App Router의 레이아웃은 Pages Router의 `_app.tsx`보다 훨씬 강력하다. 레이아웃이 **중첩**될 수 있고, 페이지 이동 시 **리렌더링 없이 유지**된다는 점이 핵심이다.

## 루트 레이아웃 (필수)

`app/layout.tsx`는 **모든 페이지의 루트 레이아웃**이다. Next.js 앱에서 유일하게 `<html>`과 `<body>` 태그를 포함해야 하는 파일이다.

![루트 레이아웃 구조](/assets/posts/next-layouts-root.svg)

```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    template: '%s | My App',  // 각 페이지 title + ' | My App'
    default: 'My App',
  },
  description: 'Next.js로 만든 앱',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  )
}
```

`lang="ko"` 속성은 스크린 리더와 검색 엔진을 위해 반드시 설정한다. 루트 레이아웃은 Server Component이므로 `async/await`를 사용할 수 있다.

## 중첩 레이아웃

하위 경로에 추가 레이아웃을 겹쳐 쌓을 수 있다. 대시보드처럼 로그인한 사용자에게만 사이드바를 보여줘야 하는 경우가 대표적이다.

![중첩 레이아웃 구조](/assets/posts/next-layouts-nesting.svg)

```tsx
// app/dashboard/layout.tsx
// /dashboard/** 경로 모두에 적용됨
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="dashboard">
      <Sidebar />
      <div className="content">{children}</div>
    </div>
  )
}
```

이제 `/dashboard`, `/dashboard/settings`, `/dashboard/profile` 모두 루트 레이아웃 + 대시보드 레이아웃을 함께 받는다.

## 레이아웃 상태 보존의 이점

Next.js 레이아웃의 가장 강력한 특징은 **네비게이션 시 리렌더링 없이 상태를 보존**한다는 것이다.

```tsx
// app/dashboard/layout.tsx
'use client'

import { useState } from 'react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div>
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(p => !p)} />
      {children}
    </div>
  )
}
```

사용자가 `/dashboard/settings`에서 `/dashboard/profile`로 이동해도 `sidebarOpen` 상태가 유지된다. SPA의 장점을 그대로 누리면서 SSR의 이점도 가진다.

## layout vs template

비슷해 보이지만 동작이 다르다.

| 특성 | layout | template |
|------|--------|----------|
| 네비게이션 시 마운트 | 유지 (리렌더링 없음) | 언마운트 후 새로 마운트 |
| 상태 보존 | 유지 | 초기화됨 |
| useEffect | 첫 마운트 시 1회 | 매 네비게이션마다 실행 |
| 사용 용도 | 공통 UI, 상태 유지 | 페이지 추적, 초기화 필요 시 |

페이지 추적(analytics), 진입 애니메이션, 각 페이지마다 폼 초기화가 필요한 경우에만 `template.tsx`를 사용한다.

## 레이아웃에서 데이터 페칭

레이아웃도 Server Component이므로 `async/await`로 데이터를 가져올 수 있다.

```tsx
// app/dashboard/layout.tsx
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser() // 세션에서 사용자 정보 조회
  if (!user) redirect('/login')

  return (
    <div>
      <Sidebar user={user} />
      {children}
    </div>
  )
}
```

이렇게 하면 대시보드의 모든 하위 페이지에서 인증 체크가 자동으로 이루어진다.

## 메타데이터 상속

각 `layout.tsx`와 `page.tsx`에서 `metadata`를 내보내면 자동으로 병합된다. 하위의 메타데이터가 상위를 덮어쓴다.

```tsx
// app/blog/page.tsx
export const metadata = {
  title: '블로그', // → '블로그 | My App' (루트 layout의 template 적용)
  description: '최신 글을 확인하세요',
}
```

루트 레이아웃에 `title.template: '%s | My App'`을 설정했다면, 각 페이지의 title이 자동으로 `블로그 | My App` 형태가 된다.

---

**지난 글:** [환경 변수 완전 정복 — 서버·클라이언트 범위 이해하기](/posts/next-environment-variables/)

<br>
읽어주셔서 감사합니다. 😊
