---
title: "병렬 라우트와 인터셉팅 라우트 — 모달과 슬롯"
description: "Next.js App Router의 병렬 라우트(@slot)와 인터셉팅 라우트(.)를 이해합니다. 대시보드 위젯 레이아웃, URL을 유지하는 모달, 갤러리 사진 상세 등 고급 UI 패턴을 실전 코드와 함께 배웁니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 9
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "병렬 라우트", "인터셉팅 라우트", "모달", "@slot", "App Router"]
featured: false
draft: false
---

[지난 글](/posts/next-loading-error-ui/)에서 로딩 UI와 에러 경계를 다뤘습니다. 이번에는 App Router의 고급 라우팅 기능인 **병렬 라우트**와 **인터셉팅 라우트**를 다룹니다. 처음엔 복잡해 보이지만, 대시보드 위젯 레이아웃이나 "URL은 바뀌지만 페이지는 유지되는 모달" 같은 패턴을 만들 때 매우 강력합니다.

## 병렬 라우트 — @slot

`@`로 시작하는 폴더는 **슬롯(slot)**이 됩니다. 같은 레벨의 `layout.tsx`에서 슬롯 이름으로 props를 받아 화면에 동시에 렌더링할 수 있습니다.

![병렬 라우트 슬롯 구조](/assets/posts/next-parallel-intercepting-routes-slots.svg)

```tsx
// app/dashboard/layout.tsx
export default function DashboardLayout({
  children,
  analytics, // @analytics 슬롯
  users,     // @users 슬롯
}: {
  children: React.ReactNode;
  analytics: React.ReactNode;
  users: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>{analytics}</div>
      <div>{users}</div>
      <div>{children}</div>
    </div>
  );
}
```

슬롯 폴더 안에도 중첩 라우트를 만들 수 있습니다. `/dashboard/revenue`는 `@analytics/revenue/page.tsx`를 렌더링합니다.

### default.tsx

라우트 이동 시 슬롯이 이전 상태를 유지하지 못하면 Next.js는 `default.tsx`를 렌더링합니다. 슬롯에 `default.tsx`를 두지 않으면 404가 발생할 수 있습니다.

```tsx
// app/dashboard/@analytics/default.tsx
export default function AnalyticsDefault() {
  return null; // 또는 기본 위젯
}
```

## 인터셉팅 라우트 — (..)

인터셉팅 라우트는 **클라이언트 내비게이션 시 다른 라우트의 URL을 가로채서** 현재 레이아웃 안에서 렌더링합니다. URL을 직접 입력하거나 새로고침하면 원래 라우트가 동작합니다.

![인터셉팅 라우트 모달 패턴](/assets/posts/next-parallel-intercepting-routes-modal.svg)

### 갤러리 모달 패턴

인터셉팅 라우트의 가장 대표적인 사용 사례입니다. 갤러리에서 사진을 클릭하면:
- 클라이언트 이동: URL은 `/photos/42`로 바뀌지만 갤러리 배경 유지 + 모달 표시
- 직접 URL 접근: 사진 전체 화면 페이지 표시

```
app/photos/
├── page.tsx               → /photos (갤러리)
├── layout.tsx             (슬롯 수신)
├── @modal/
│   ├── default.tsx        (null 반환)
│   └── (.)photos/[id]/
│       └── page.tsx       → 모달로 인터셉트
└── [id]/
    └── page.tsx           → /photos/42 전체 화면
```

```tsx
// app/photos/layout.tsx
export default function PhotosLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal} {/* 모달이 있을 때만 렌더링 */}
    </>
  );
}
```

```tsx
// app/photos/@modal/(.)photos/[id]/page.tsx
import { Modal } from '@/components/Modal';

export default async function PhotoModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const photo = await getPhoto(id);

  return (
    <Modal>
      <img src={photo.url} alt={photo.title} />
    </Modal>
  );
}
```

```tsx
// components/Modal.tsx
'use client';

import { useRouter } from 'next/navigation';

export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center"
      onClick={() => router.back()} // 배경 클릭 시 뒤로 가기
    >
      <div onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
```

### 인터셉트 접두사

경로 앞에 붙이는 접두사로 어느 레벨의 라우트를 인터셉트할지 지정합니다.

```
(.)    같은 레벨의 라우트 인터셉트
(..)   한 레벨 위의 라우트 인터셉트
(...)  app/ 루트 레벨의 라우트 인터셉트
```

## 언제 사용하나

병렬 라우트는 대시보드처럼 **독립적으로 업데이트되는 여러 섹션**이 필요할 때, 인터셉팅 라우트는 **현재 컨텍스트를 유지하면서 서브 라우트를 모달로 표시**할 때 이상적입니다. 구현 복잡도가 높으므로, 단순 `useState` 모달로도 충분하면 굳이 인터셉팅 라우트를 쓸 필요는 없습니다.

---

**지난 글:** [loading.tsx와 error.tsx — 스트리밍과 에러 경계](/posts/next-loading-error-ui/)

**다음 글:** [서버 데이터 패칭 — fetch, async 컴포넌트, 중복 제거](/posts/next-server-data-fetching/)

<br>
읽어주셔서 감사합니다. 😊
