---
title: "next/link로 페이지 이동하기"
description: "Next.js의 Link 컴포넌트를 완전히 이해합니다. 프리페치, 활성 링크 표시, href 형식, replace/scroll 옵션까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 7
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "Link", "내비게이션", "next/link"]
featured: false
draft: false
---

[지난 글](/posts/next-file-based-routing/)에서 파일 기반 라우팅으로 URL 구조를 잡는 방법을 배웠습니다. 이제 그 라우트 사이를 이동하는 방법을 살펴봅니다. Next.js에서 페이지 이동의 기본은 `<Link>` 컴포넌트입니다.

## 왜 `<a>` 태그 대신 `<Link>`를 쓸까

HTML `<a>` 태그를 사용하면 브라우저가 **전체 페이지를 새로 로드**합니다. Next.js의 `<Link>` 컴포넌트는 **클라이언트 사이드 내비게이션**을 수행합니다.

- 변경된 부분만 다시 렌더링 (전체 새로고침 없음)
- 레이아웃 컴포넌트 상태 유지 (헤더, 사이드바 등)
- 이동 전 자동 프리페치로 빠른 전환

## 기본 사용법

![next/link 동작 원리](/assets/posts/next-link-navigation-demo.svg)

```tsx
import Link from 'next/link';

export default function Navigation() {
  return (
    <nav>
      <Link href="/">홈</Link>
      <Link href="/about">회사 소개</Link>
      <Link href="/blog">블로그</Link>
    </nav>
  );
}
```

`Link`는 서버 컴포넌트에서 사용할 수 있습니다. `'use client'`가 필요 없습니다.

## href prop 형식

![href prop 형식](/assets/posts/next-link-navigation-href.svg)

```tsx
// 동적 경로 구성
const slug = 'hello-world';
<Link href={`/blog/${slug}`}>포스트 보기</Link>

// 객체 형식 (쿼리 파라미터가 많을 때 가독성 좋음)
<Link href={{ pathname: '/search', query: { q: 'nextjs', page: 1 } }}>
  검색 결과
</Link>
// → /search?q=nextjs&page=1
```

## 자동 프리페치

`<Link>` 컴포넌트가 **뷰포트(화면 보이는 영역)에 들어오는 순간**, Next.js는 그 경로의 React Server Component payload와 JavaScript 번들을 백그라운드에서 미리 가져옵니다. 사용자가 클릭하면 이미 캐시돼 있어 즉시 이동됩니다.

```tsx
// 프리페치 비활성화 (트래픽이 많은 링크에서 비용 절감)
<Link href="/heavy-page" prefetch={false}>
  무거운 페이지
</Link>
```

개발 모드(`npm run dev`)에서는 프리페치가 동작하지 않습니다. 프로덕션 빌드에서 확인하세요.

## replace와 scroll 옵션

```tsx
// replace: 브라우저 히스토리 스택에 추가하지 않음
// → 뒤로가기 시 이전 페이지로 돌아가지 않음
<Link href="/search" replace>
  검색 (히스토리 대체)
</Link>

// scroll: 이동 후 스크롤 위치 유지 (기본값은 최상단으로 이동)
<Link href={`/blog/${slug}`} scroll={false}>
  스크롤 유지하며 이동
</Link>
```

## 활성 링크 표시

현재 URL과 링크 경로를 비교해 활성 스타일을 적용하려면 `usePathname` 훅이 필요합니다. 훅은 클라이언트 컴포넌트에서만 사용 가능합니다.

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: '홈' },
  { href: '/about', label: '소개' },
  { href: '/blog', label: '블로그' },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav>
      {links.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={pathname === href ? 'font-bold text-blue-600' : 'text-gray-600'}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
```

서버 컴포넌트인 레이아웃에서 이 `NavLinks` 클라이언트 컴포넌트를 import해서 사용하는 방식이 일반적입니다.

## 외부 링크와 새 탭

```tsx
// 외부 링크는 Link 대신 <a>를 사용해도 무방
<a href="https://nextjs.org" target="_blank" rel="noopener noreferrer">
  Next.js 공식 문서
</a>

// Link로도 외부 링크 처리 가능 (프리페치 없음)
<Link href="https://github.com" target="_blank" rel="noopener noreferrer">
  GitHub
</Link>
```

외부 URL에는 `target="_blank"`와 함께 반드시 `rel="noopener noreferrer"`를 붙이세요. 새 탭이 원래 탭의 `window.opener`에 접근하는 보안 취약점을 차단합니다.

---

**지난 글:** [파일 기반 라우팅 완전 정복](/posts/next-file-based-routing/)

**다음 글:** [useRouter로 프로그래매틱 내비게이션 하기](/posts/next-userouter-navigation/)

<br>
읽어주셔서 감사합니다. 😊
