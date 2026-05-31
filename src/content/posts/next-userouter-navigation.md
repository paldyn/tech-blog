---
title: "useRouter로 프로그래매틱 내비게이션 하기"
description: "next/navigation의 useRouter, usePathname, useSearchParams, useParams 훅을 활용해 코드로 페이지를 이동하고 URL 상태를 관리하는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 8
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "useRouter", "usePathname", "useSearchParams", "내비게이션"]
featured: false
draft: false
---

[지난 글](/posts/next-link-navigation/)에서 `<Link>` 컴포넌트로 선언적으로 페이지를 이동하는 방법을 배웠습니다. 이번에는 **코드로 이동**해야 하는 상황 — 폼 제출 후 리다이렉트, 로그인 성공 후 대시보드 이동 등 — 에 사용하는 `next/navigation` 훅들을 다룹니다.

## Pages Router와의 중요한 차이점

`next/router`(Pages Router)와 `next/navigation`(App Router)은 **완전히 다른 패키지**입니다. App Router 프로젝트에서 `next/router`를 import하면 오류가 발생합니다. 반드시 `next/navigation`에서 import하세요.

```ts
// ❌ Pages Router 전용
import { useRouter } from 'next/router';

// ✅ App Router 전용
import { useRouter } from 'next/navigation';
```

## next/navigation 훅 4종

![App Router 내비게이션 훅](/assets/posts/next-userouter-navigation-hooks.svg)

### useRouter

이동·새로고침을 코드로 트리거합니다.

```tsx
'use client';

import { useRouter } from 'next/navigation';

export function LoginForm() {
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await loginUser(/* ... */);
    router.push('/dashboard');         // 히스토리에 추가하며 이동
    // router.replace('/dashboard');   // 히스토리 대체
    // router.back();                  // 뒤로가기
    // router.forward();               // 앞으로가기
    // router.refresh();               // 서버 컴포넌트 리페치
  }

  return <form onSubmit={handleSubmit}>{/* ... */}</form>;
}
```

`router.refresh()`는 현재 URL을 유지한 채 서버 컴포넌트를 다시 실행합니다. 데이터 뮤테이션 후 화면을 갱신할 때 활용합니다.

### usePathname

현재 URL의 경로를 문자열로 반환합니다.

```tsx
'use client';

import { usePathname } from 'next/navigation';

export function Breadcrumb() {
  const pathname = usePathname();
  // '/blog/hello-world' → ['blog', 'hello-world']
  const segments = pathname.split('/').filter(Boolean);

  return (
    <ol>
      {segments.map((seg, i) => (
        <li key={i}>{seg}</li>
      ))}
    </ol>
  );
}
```

### useSearchParams

URL 쿼리 스트링(`?key=value`)을 읽는 훅입니다. 반환값은 브라우저 네이티브 `URLSearchParams` 인터페이스를 구현합니다.

```tsx
'use client';

import { useSearchParams } from 'next/navigation';

export function SearchResults() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q');     // 단일 값
  const tags = searchParams.getAll('tag'); // 복수 값 배열

  return <p>검색어: {query}</p>;
}
```

> `useSearchParams`를 사용하는 컴포넌트는 반드시 `<Suspense>` 경계로 감싸야 합니다. 그렇지 않으면 빌드 시 경고 혹은 에러가 발생합니다.

```tsx
// page.tsx
import { Suspense } from 'react';
import { SearchResults } from './SearchResults';

export default function SearchPage() {
  return (
    <Suspense fallback={<p>로딩 중...</p>}>
      <SearchResults />
    </Suspense>
  );
}
```

### useParams

클라이언트 컴포넌트에서 동적 라우트 파라미터를 읽습니다. 서버 컴포넌트에서는 `props.params`를 사용하면 됩니다.

```tsx
'use client';

import { useParams } from 'next/navigation';

export function PostActions() {
  const params = useParams<{ slug: string }>();
  return <button>슬러그: {params.slug}</button>;
}
```

## URL 쿼리를 상태로 사용하기

검색 필터, 페이지 번호 등 UI 상태를 URL 쿼리로 관리하면 공유·새로고침 시에도 상태가 유지됩니다.

![쿼리 파라미터 업데이트 패턴](/assets/posts/next-userouter-navigation-searchparams.svg)

```tsx
'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export function SearchBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(q: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (q) {
      params.set('q', q);
    } else {
      params.delete('q');
    }
    // replace로 히스토리 오염 없이 쿼리 업데이트
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <input
      defaultValue={searchParams.get('q') ?? ''}
      onChange={e => handleChange(e.target.value)}
      placeholder="검색..."
    />
  );
}
```

## redirect (서버 컴포넌트에서)

서버 컴포넌트나 Server Action에서 이동하려면 `next/navigation`의 `redirect`를 씁니다.

```tsx
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login'); // 서버에서 바로 리다이렉트
  return <Dashboard />;
}
```

`redirect()`는 Next.js 내부에서 예외를 던지는 방식으로 동작합니다. `try-catch` 블록 안에서 호출하면 catch로 잡히므로 주의하세요.

---

**지난 글:** [next/link로 페이지 이동하기](/posts/next-link-navigation/)

**다음 글:** [환경 변수 완전 정복 — .env 파일부터 NEXT_PUBLIC까지](/posts/next-environment-variables/)

<br>
읽어주셔서 감사합니다. 😊
