---
title: "Link 컴포넌트로 페이지 이동하기"
description: "next/link의 Link 컴포넌트 사용법, 주요 props(href, prefetch, replace, scroll), 활성 링크 스타일링, 프리패칭 동작 원리를 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 7
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "Link", "네비게이션", "prefetch", "클라이언트사이드네비게이션", "usePathname"]
featured: false
draft: false
---

[지난 글](/posts/next-file-based-routing/)에서 파일 기반 라우팅으로 URL 구조를 만드는 방법을 배웠다. 이제 그 라우트들 사이를 어떻게 이동하는지 알아볼 차례다. Next.js에서 페이지 간 이동의 첫 번째 방법은 `<Link>` 컴포넌트다.

## Link 컴포넌트란

Next.js의 `next/link`에서 제공하는 `<Link>` 컴포넌트는 HTML `<a>` 태그를 확장한 것이다. 일반 `<a>` 태그는 서버에 새 요청을 보내 전체 페이지를 새로 불러오지만, `<Link>`는 JavaScript로 클라이언트 내에서 **소프트 네비게이션**을 처리한다.

```tsx
import Link from 'next/link'

export default function Nav() {
  return (
    <nav>
      <Link href="/">홈</Link>
      <Link href="/about">소개</Link>
      <Link href="/blog">블로그</Link>
    </nav>
  )
}
```

페이지 전체를 새로 불러오는 대신 변경된 부분만 업데이트하므로 화면 깜빡임이 없고 빠르다.

## 주요 Props

![Link 컴포넌트 핵심 속성](/assets/posts/next-link-navigation-props.svg)

**href** (필수): 이동할 경로를 문자열 또는 URL 객체로 지정한다.

```tsx
// 문자열 형태
<Link href="/blog">블로그</Link>

// URL 객체 형태 — 쿼리 파라미터 포함 시 유용
<Link href={{ pathname: '/blog', query: { page: 2 } }}>
  다음 페이지
</Link>
// → /blog?page=2
```

**replace**: 기본값은 `false`(히스토리 스택에 push). `true`로 설정하면 현재 히스토리 항목을 교체해 뒤로 가기로 이전 페이지로 돌아갈 수 없다. 로그인 후 리다이렉트 같은 경우에 유용하다.

```tsx
<Link href="/dashboard" replace>
  로그인
</Link>
```

**scroll**: 기본값 `true`. 새 페이지로 이동 시 자동으로 화면 맨 위로 스크롤한다. `false`로 설정하면 스크롤 위치를 유지한다.

**prefetch**: 링크가 뷰포트에 보이면 백그라운드에서 라우트 데이터를 미리 가져온다. 기본값은 `null`(프로덕션에서만 자동 동작). `true`로 설정하면 뷰포트 여부와 무관하게 즉시 프리패치한다.

## 프리패칭 동작 원리

![Link 프리패칭 동작](/assets/posts/next-link-navigation-prefetch.svg)

`<Link>` 컴포넌트가 뷰포트에 들어오는 순간 Next.js는 해당 라우트의 데이터를 백그라운드에서 가져온다. 사용자가 실제로 클릭하면 이미 데이터가 캐시에 있으므로 즉시 화면이 전환된다. 이것이 Next.js 앱이 빠르게 느껴지는 핵심 이유다.

프리패치된 데이터는 **Router Cache**라는 인메모리 캐시에 저장된다. 세션 동안 유지되며, 같은 라우트를 재방문할 때 서버 요청 없이 즉시 렌더링된다.

## 활성 링크 스타일링

현재 경로에 맞는 링크에 활성 스타일을 주려면 `usePathname` 훅과 조합한다.

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/', label: '홈' },
  { href: '/blog', label: '블로그' },
  { href: '/about', label: '소개' },
]

export default function Navigation() {
  const pathname = usePathname()

  return (
    <nav>
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={pathname === item.href ? 'active' : ''}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
```

`usePathname`은 클라이언트 훅이므로 `'use client'`가 필요하다. `/blog/hello-world` 경로에서 `/blog` 링크도 활성으로 보이려면 `pathname.startsWith(item.href)`를 사용한다.

## 동적 링크 생성

배열을 순회하며 동적으로 링크를 생성하는 패턴도 자주 사용된다.

```tsx
const posts = await getPosts()

return (
  <ul>
    {posts.map(post => (
      <li key={post.id}>
        <Link href={`/blog/${post.slug}`}>
          {post.title}
        </Link>
      </li>
    ))}
  </ul>
)
```

## 언제 `<a>` 태그를 사용해야 할까

외부 사이트로 이동하는 경우에는 `next/link` 대신 일반 `<a>` 태그를 사용한다. `<Link>`는 동일 Next.js 앱 내의 경로 이동에만 사용한다.

```tsx
// 외부 링크 — 일반 <a> 사용
<a href="https://github.com" target="_blank" rel="noopener noreferrer">
  GitHub
</a>

// 내부 링크 — <Link> 사용
<Link href="/about">소개 페이지</Link>
```

---

**지난 글:** [파일 기반 라우팅 — 폴더가 URL이 되는 마법](/posts/next-file-based-routing/)

**다음 글:** [useRouter로 프로그래밍 방식 네비게이션 구현하기](/posts/next-userouter-navigation/)

<br>
읽어주셔서 감사합니다. 😊
