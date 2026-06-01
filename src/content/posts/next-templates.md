---
title: "Next.js template.tsx — 페이지마다 초기화되는 특별한 레이아웃"
description: "layout.tsx와 template.tsx의 차이를 명확히 이해합니다. 재마운트가 필요한 시나리오, useEffect 재실행, 페이지별 애니메이션, 폼 상태 리셋까지 template 파일의 모든 것을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 1
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "template", "layout", "App Router", "useEffect", "애니메이션"]
featured: false
draft: false
---

[지난 글](/posts/next-layouts/)에서 루트 레이아웃과 중첩 레이아웃을 살펴봤습니다. 레이아웃이 강력한 이유 중 하나는 "페이지 이동 시 리렌더하지 않는다"는 점인데, 바로 이 특성이 때로는 문제가 됩니다. 이번 글에서는 레이아웃 대신 **template.tsx**를 써야 하는 상황과 동작 원리를 정확히 이해합니다.

## layout과 template의 핵심 차이

두 파일의 차이는 단 하나입니다. **레이아웃은 자식 라우트 간 이동 시 리렌더되지 않지만, 템플릿은 매 이동마다 새 인스턴스를 생성합니다.**

![layout.tsx vs template.tsx 동작 비교](/assets/posts/next-templates-vs-layout.svg)

파일 구조와 API는 identical합니다. `layout.tsx`를 `template.tsx`로 이름만 바꿔도 됩니다.

```tsx
// app/dashboard/template.tsx
export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div>{children}</div>;
}
```

React 입장에서 레이아웃과 템플릿의 차이는:
- **레이아웃**: 동일 컴포넌트 인스턴스가 유지됨 (DOM 재사용)
- **템플릿**: 라우트 이동 시 `key`가 달라져 언마운트 → 마운트 반복

## 템플릿을 써야 하는 4가지 시나리오

![template.tsx 주요 사용 시나리오](/assets/posts/next-templates-usecase.svg)

### 1. 페이지 진입 애니메이션

CSS transition 라이브러리(Framer Motion 등)로 페이지 진입 효과를 구현할 때, 레이아웃을 쓰면 동일 컴포넌트가 재사용되어 애니메이션이 첫 번째 방문에만 동작합니다. 템플릿은 매번 새 컴포넌트를 마운트하므로 항상 진입 효과가 동작합니다.

```tsx
// app/template.tsx
'use client';

import { motion } from 'framer-motion';

export default function Template({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}
```

### 2. 페이지별 조회수·분석 이벤트

Analytics 라이브러리의 `pageView()` 호출은 라우트 이동 시마다 발생해야 합니다. 레이아웃의 `useEffect`는 최초 마운트에만 실행되지만, 템플릿의 `useEffect`는 매 이동마다 실행됩니다.

```tsx
// app/template.tsx
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { analytics } from '@/lib/analytics';

export default function Template({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  useEffect(() => {
    analytics.pageView(pathname);
  }, [pathname]); // pathname이 바뀌면 다시 실행

  return <>{children}</>;
}
```

### 3. useEffect cleanup 보장

소켓 연결, 구독, 타이머 등은 페이지를 떠날 때 정리(cleanup)해야 합니다. 레이아웃에서는 라우트 이동 시 cleanup이 실행되지 않습니다. 템플릿을 사용하면 언마운트 시 cleanup이 항상 실행됩니다.

```tsx
// app/chat/template.tsx
'use client';

import { useEffect } from 'react';
import { socket } from '@/lib/socket';

export default function ChatTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    socket.connect();

    return () => {
      socket.disconnect(); // 페이지 이동 시 반드시 실행됨
    };
  }, []);

  return <>{children}</>;
}
```

### 4. 폼 상태 자동 리셋

같은 폼 컴포넌트가 여러 라우트에 등장할 때, 레이아웃 내에 두면 입력값이 라우트 이동 후에도 남아 있습니다. 템플릿을 쓰면 `key` prop 없이도 라우트 이동마다 폼 상태가 자동 초기화됩니다.

## layout과 template 중첩 사용

같은 경로에 `layout.tsx`와 `template.tsx`를 함께 쓸 수 있습니다. 렌더 순서는 다음과 같습니다.

```
Layout (마운트 1회)
  └── Template (이동마다 재마운트)
        └── Page
```

공통 헤더/사이드바는 레이아웃에, 페이지별 초기화 로직은 템플릿에 분리하는 패턴이 가장 실용적입니다.

## 언제 layout, 언제 template?

```
페이지 이동 시 상태를 유지해야 한다  →  layout.tsx
매 이동마다 초기화/Effect 재실행 필요  →  template.tsx
```

대부분의 경우 `layout.tsx`가 적합합니다. 애니메이션, 분석 이벤트, 소켓 연결처럼 "매 진입마다 새로 시작"해야 하는 로직이 있을 때만 `template.tsx`를 선택하세요.

---

**지난 글:** [Next.js 레이아웃 — 중첩 레이아웃과 루트 레이아웃](/posts/next-layouts/)

**다음 글:** [서버 컴포넌트 vs 클라이언트 컴포넌트 — 무엇을 언제 쓸까](/posts/next-server-vs-client-components/)

<br>
읽어주셔서 감사합니다. 😊
