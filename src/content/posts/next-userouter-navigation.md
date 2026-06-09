---
title: "useRouter로 프로그래밍 방식 네비게이션 구현하기"
description: "Next.js App Router의 useRouter, usePathname, useSearchParams 훅을 완전 해설합니다. 버튼 클릭, 폼 제출 후 이동, 쿼리 파라미터 읽기까지 실전 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 8
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "useRouter", "usePathname", "useSearchParams", "프로그래매틱네비게이션", "AppRouter"]
featured: false
draft: false
---

[지난 글](/posts/next-link-navigation/)에서 `<Link>` 컴포넌트로 페이지 간 이동을 구현하는 방법을 배웠다. 링크 클릭이 아닌 버튼 클릭, 폼 제출 완료, 타이머 만료 등 **코드로 직접 네비게이션**을 제어해야 할 때는 `useRouter` 훅을 사용한다.

## App Router의 세 가지 네비게이션 훅

App Router는 클라이언트 컴포넌트에서 사용할 수 있는 세 가지 훅을 제공한다.

![App Router 네비게이션 훅](/assets/posts/next-userouter-hooks.svg)

모두 `next/navigation`에서 가져온다. `next/router`(Pages Router용)와 경로가 다르니 주의한다.

```tsx
'use client' // 세 훅 모두 클라이언트 컴포넌트 필수

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
```

## useRouter — 프로그래매틱 이동

버튼 클릭이나 비동기 작업 완료 후 특정 경로로 이동해야 할 때 사용한다.

```tsx
'use client'

import { useRouter } from 'next/navigation'

export default function LoginForm() {
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await login(formData)
    router.push('/dashboard') // 로그인 성공 후 이동
  }

  return <form onSubmit={handleSubmit}>...</form>
}
```

![useRouter 메서드 비교](/assets/posts/next-userouter-methods.svg)

**router.push(url)**: 새 히스토리 항목 추가 후 이동. 뒤로 가기로 이전 페이지 복귀 가능.

**router.replace(url)**: 현재 히스토리 항목을 교체. 뒤로 가기로 이전 페이지로 돌아갈 수 없다. 로그인 완료, 결제 완료 같은 "돌아가면 안 되는" 경우에 사용.

**router.back()** / **router.forward()**: 브라우저 뒤로/앞으로 버튼과 동일.

**router.refresh()**: 현재 라우트를 서버에서 재렌더링한다. Server Components의 데이터를 갱신할 때 유용하다. 클라이언트 상태(useState)는 유지된다.

## usePathname — 현재 경로 읽기

현재 URL 경로명을 문자열로 반환한다. 활성 링크 스타일링, 조건부 렌더링에 자주 쓰인다.

```tsx
'use client'

import { usePathname } from 'next/navigation'

export default function Breadcrumb() {
  const pathname = usePathname()
  // pathname === '/blog/my-post'

  const segments = pathname.split('/').filter(Boolean)
  // ['blog', 'my-post']

  return (
    <nav>
      {segments.map((seg, i) => {
        const href = '/' + segments.slice(0, i + 1).join('/')
        return <span key={href}><a href={href}>{seg}</a></span>
      })}
    </nav>
  )
}
```

## useSearchParams — 쿼리 파라미터 읽기

`/blog?page=2&sort=latest` 같은 URL의 쿼리 파라미터를 읽는 데 사용한다.

```tsx
'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback } from 'react'

export default function BlogFilter() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()

  const currentPage = Number(searchParams.get('page') ?? '1')

  const setPage = useCallback((page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(page))
    router.push(`${pathname}?${params.toString()}`)
  }, [searchParams, pathname, router])

  return (
    <div>
      <span>페이지 {currentPage}</span>
      <button onClick={() => setPage(currentPage + 1)}>다음</button>
    </div>
  )
}
```

`URLSearchParams`를 활용하면 기존 파라미터를 유지하면서 특정 값만 변경할 수 있다.

## useSearchParams와 Suspense

`useSearchParams`를 사용하는 컴포넌트는 **Suspense 경계** 안에 있어야 한다. 그렇지 않으면 Next.js가 빌드 시 경고를 낸다.

```tsx
// app/blog/page.tsx
import { Suspense } from 'react'
import BlogFilter from './BlogFilter'

export default function BlogPage() {
  return (
    <div>
      <h1>블로그</h1>
      <Suspense fallback={<div>필터 로딩중...</div>}>
        <BlogFilter />  {/* useSearchParams 사용 컴포넌트 */}
      </Suspense>
    </div>
  )
}
```

## Pages Router와의 차이

Pages Router의 `useRouter`는 `query`, `pathname`, `push`, `replace` 등을 하나의 객체로 제공했다. App Router에서는 이것이 세 개의 훅으로 분리됐다. Pages Router에서 `router.pathname`으로 읽던 것이 App Router에서는 `usePathname()`이 됐고, `router.query`는 `useSearchParams()`가 됐다.

```tsx
// Pages Router (구 방식)
import { useRouter } from 'next/router'
const { pathname, query, push } = useRouter()

// App Router (현재)
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
const router = useRouter()
const pathname = usePathname()
const searchParams = useSearchParams()
```

---

**지난 글:** [Link 컴포넌트로 페이지 이동하기](/posts/next-link-navigation/)

**다음 글:** [환경 변수 완전 정복 — 서버·클라이언트 범위 이해하기](/posts/next-environment-variables/)

<br>
읽어주셔서 감사합니다. 😊
