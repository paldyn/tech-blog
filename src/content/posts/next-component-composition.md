---
title: "서버·클라이언트 컴포넌트 합성 패턴"
description: "Next.js App Router에서 서버와 클라이언트 컴포넌트를 올바르게 조합하는 방법을 배웁니다. children prop 패턴, 서버 데이터 전달, Context Provider 분리, 서버 전용 코드 보호까지 실전 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 3
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "Server Component", "composition", "Context", "children", "use client"]
featured: false
draft: false
---

[지난 글](/posts/next-server-vs-client-components/)에서 서버·클라이언트 컴포넌트의 기본 차이를 이해했습니다. 이번에는 실제 앱을 만들 때 자주 부딪히는 문제—"서버 컴포넌트를 클라이언트 컴포넌트 안에 어떻게 넣지?"—를 해결하는 합성 패턴을 다룹니다.

## 핵심 제약: 클라이언트에서 서버를 import할 수 없다

클라이언트 컴포넌트 파일에서 서버 컴포넌트를 직접 import하면 Next.js가 서버 전용 코드를 클라이언트 번들로 끌어들입니다. DB 쿼리 코드, 시크릿 환경변수 접근 코드가 브라우저에 노출될 수 있습니다.

```tsx
// ❌ 안티패턴
// ClientModal.tsx
'use client';
import { UserProfile } from './UserProfile'; // 서버 컴포넌트 직접 import

export function ClientModal() {
  return <UserProfile />; // 빌드 에러 또는 서버 코드 번들 포함
}
```

![서버·클라이언트 합성 패턴들](/assets/posts/next-component-composition-pattern.svg)

## 패턴 1: children prop으로 서버 컴포넌트 전달

가장 간단하고 강력한 패턴입니다. **서버 컴포넌트(Page, Layout)에서 클라이언트 컴포넌트를 import하되, 서버 컴포넌트를 children으로 넘깁니다.**

```tsx
// app/page.tsx (Server Component)
import { Modal } from '@/components/Modal';   // Client
import { UserProfile } from '@/components/UserProfile'; // Server

export default async function Page() {
  return (
    <Modal>
      <UserProfile /> {/* 서버 컴포넌트를 children으로 주입 */}
    </Modal>
  );
}
```

```tsx
// components/Modal.tsx (Client Component)
'use client';
import { useState } from 'react';

export function Modal({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  return (
    <div className="modal">
      <button onClick={() => setOpen(false)}>닫기</button>
      {children} {/* 서버 컴포넌트가 여기서 렌더링됨 */}
    </div>
  );
}
```

`Modal`은 `children`이 서버 컴포넌트인지 모릅니다. React가 이미 렌더링된 결과를 받아서 표시할 뿐입니다.

## 패턴 2: 서버 데이터를 직렬화 가능한 props로 전달

서버에서 데이터를 fetch하고 클라이언트 컴포넌트에 전달할 때, **직렬화 가능한 데이터(JSON으로 변환 가능한 값)만 props로 넘길 수 있습니다.**

```tsx
// app/dashboard/page.tsx (Server)
import { ChartWidget } from '@/components/ChartWidget'; // Client

export default async function DashboardPage() {
  const metrics = await fetchMetrics(); // DB 쿼리

  // 직렬화 가능한 데이터만 전달
  return (
    <ChartWidget
      data={metrics.data}   // ✅ number[]
      labels={metrics.labels} // ✅ string[]
    />
  );
}
```

```tsx
// components/ChartWidget.tsx (Client)
'use client';
import { useRef } from 'react';

export function ChartWidget({
  data,
  labels,
}: {
  data: number[];
  labels: string[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // canvas API, Chart.js 등 클라이언트 라이브러리 사용
  return <canvas ref={canvasRef} />;
}
```

함수, 클래스 인스턴스, Date 객체 등은 직렬화가 불가능하므로 넘길 수 없습니다.

## 패턴 3: Context Provider 분리

`createContext`는 클라이언트 API이므로 Context Provider는 `'use client'`가 필요합니다. 하지만 `app/layout.tsx`를 서버 컴포넌트로 유지하고 싶다면, **Provider를 별도 파일로 분리**하면 됩니다.

![Context Provider 패턴](/assets/posts/next-component-composition-provider.svg)

```tsx
// providers/ThemeProvider.tsx
'use client'; // Provider만 클라이언트로 분리

import { createContext, useContext, useState } from 'react';

const ThemeContext = createContext<'light' | 'dark'>('light');

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

```tsx
// app/layout.tsx (Server Component 유지)
import { ThemeProvider } from '@/providers/ThemeProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <ThemeProvider> {/* Client Provider가 Server layout을 감쌈 */}
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

## 서버 전용 코드 보호

실수로 서버 전용 코드가 클라이언트에 포함되는 것을 방지하려면 `server-only` 패키지를 사용합니다.

```tsx
// lib/data.ts
import 'server-only'; // 클라이언트에서 import 시 빌드 에러 발생

export async function getSecretData() {
  return await db.secret.findMany(); // DB 쿼리
}
```

마찬가지로 `client-only` 패키지로 브라우저 전용 모듈을 보호할 수 있습니다.

## 실전 체크리스트

```
클라이언트 컴포넌트 → 서버 컴포넌트 필요
→ children prop 또는 slot prop으로 전달

서버에서 데이터 → 클라이언트 컴포넌트 필요
→ 직렬화 가능한 props로 전달

Context (useState 기반) → 서버 레이아웃에서 필요
→ Provider를 별도 'use client' 파일로 분리
```

---

**지난 글:** [서버 컴포넌트 vs 클라이언트 컴포넌트 — 무엇을 언제 쓸까](/posts/next-server-vs-client-components/)

**다음 글:** [동적 라우트 — [slug]로 무한한 URL 처리하기](/posts/next-dynamic-routes/)

<br>
읽어주셔서 감사합니다. 😊
