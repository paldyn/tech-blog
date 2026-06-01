---
title: "Catch-all 라우트 — 가변 경로 세그먼트 처리"
description: "Next.js의 [...slug]와 [[...slug]] 문법으로 임의 깊이의 URL을 단일 파일에서 처리하는 방법을 배웁니다. 문서 사이트, 다국어 경로, 중첩 카테고리 등 실전 사용 사례를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 5
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "catch-all", "동적 라우트", "slug", "App Router"]
featured: false
draft: false
---

[지난 글](/posts/next-dynamic-routes/)에서 `[slug]` 하나의 동적 세그먼트를 처리하는 방법을 배웠습니다. 하지만 `/docs/api/auth/tokens`처럼 **깊이가 가변적인 URL**은 `[slug]` 하나로 처리할 수 없습니다. 이때 필요한 것이 **Catch-all 라우트**입니다.

## [...slug] — 필수 Catch-all

`[...slug]` 폴더 이름은 해당 위치 이후의 **모든 세그먼트를 배열로 캡처**합니다.

![Catch-all 라우트 세그먼트 캡처](/assets/posts/next-catch-all-routes-segments.svg)

```
app/docs/[...slug]/page.tsx

/docs/intro              → slug = ['intro']
/docs/api/reference      → slug = ['api', 'reference']
/docs/a/b/c/d            → slug = ['a', 'b', 'c', 'd']
/docs                    → 404 (세그먼트가 없음)
```

파라미터 타입이 `string[]`인 점에 주목하세요. 단일 `[param]`은 `string`, catch-all `[...slug]`는 `string[]`입니다.

```tsx
// app/docs/[...slug]/page.tsx
import { notFound } from 'next/navigation';

export default async function DocsPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  // slug = ['api', 'reference'] 형태의 배열

  const doc = await getDoc(slug); // slug를 경로로 활용
  if (!doc) notFound();

  return (
    <article>
      <h1>{doc.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: doc.content }} />
    </article>
  );
}
```

## [[...slug]] — 선택적 Catch-all

이중 대괄호 `[[...slug]]`는 세그먼트가 **0개 이상**을 허용합니다. `/docs`처럼 세그먼트가 없는 URL도 같은 파일로 처리합니다.

![선택적 Catch-all 비교](/assets/posts/next-catch-all-routes-optional.svg)

```
app/docs/[[...slug]]/page.tsx

/docs                    → slug = undefined
/docs/intro              → slug = ['intro']
/docs/api/reference      → slug = ['api', 'reference']
```

```tsx
// app/docs/[[...slug]]/page.tsx
export default async function DocsPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>; // string[] | undefined
}) {
  const { slug } = await params;

  if (!slug) {
    // /docs 루트 — 목차 페이지
    return <DocIndex />;
  }

  const doc = await getDoc(slug);
  if (!doc) notFound();
  return <DocContent doc={doc} />;
}
```

## 실전: 문서 사이트 구조

문서 사이트처럼 계층적 URL이 많은 경우 catch-all 라우트가 이상적입니다.

```
app/
└── [locale]/        ← 언어 코드 (ko, en, ja)
    └── docs/
        └── [[...slug]]/  ← 문서 경로
            └── page.tsx

/ko/docs               → locale='ko', slug=undefined
/ko/docs/intro         → locale='ko', slug=['intro']
/en/docs/api/auth      → locale='en', slug=['api','auth']
```

```tsx
type Props = {
  params: Promise<{ locale: string; slug?: string[] }>;
};

export default async function DocsPage({ params }: Props) {
  const { locale, slug } = await params;
  const doc = await getLocalizedDoc(locale, slug ?? []);
  return <DocContent doc={doc} />;
}
```

## generateStaticParams로 정적 생성

catch-all 라우트도 `generateStaticParams`로 빌드 시 사전 생성할 수 있습니다.

```tsx
export async function generateStaticParams() {
  const docs = await getAllDocs();

  return docs.map((doc) => ({
    slug: doc.path.split('/'), // 'api/auth' → ['api', 'auth']
  }));
}
```

## [param] vs [...slug] vs [[...slug]] 비교

| 문법 | 예시 | 매칭 URL | params 타입 |
|------|------|----------|------------|
| `[id]` | `[id]/page.tsx` | `/123` | `string` |
| `[...slug]` | `[...slug]/page.tsx` | `/a`, `/a/b`, `/a/b/c` | `string[]` |
| `[[...slug]]` | `[[...slug]]/page.tsx` | `/`, `/a`, `/a/b` | `string[] \| undefined` |

---

**지난 글:** [동적 라우트 — [slug]로 무한한 URL 처리하기](/posts/next-dynamic-routes/)

**다음 글:** [라우트 그룹 — URL 영향 없이 레이아웃 나누기](/posts/next-route-groups/)

<br>
읽어주셔서 감사합니다. 😊
