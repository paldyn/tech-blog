---
title: "서버 컴포넌트 vs 클라이언트 컴포넌트 — 무엇을 언제 쓸까"
description: "Next.js App Router의 핵심 개념인 서버 컴포넌트와 클라이언트 컴포넌트의 차이를 완벽히 이해합니다. 각각의 기능, 제약, 'use client' 경계 동작, 실전 선택 기준을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 2
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "Server Component", "Client Component", "use client", "App Router", "RSC"]
featured: false
draft: false
---

[지난 글](/posts/next-templates/)에서 template.tsx의 재마운트 특성을 알아봤습니다. App Router를 제대로 쓰려면 그 밑바닥에 있는 **서버 컴포넌트(RSC)와 클라이언트 컴포넌트의 차이**를 명확히 이해해야 합니다. 이 두 가지를 언제 쓸지 혼동하면 불필요한 클라이언트 번들이 커지거나 서버 기능을 제대로 활용하지 못하게 됩니다.

## 두 가지 컴포넌트 모델

![서버 컴포넌트 vs 클라이언트 컴포넌트 비교](/assets/posts/next-server-vs-client-components-comparison.svg)

App Router에서 모든 컴포넌트는 기본적으로 **서버 컴포넌트**입니다. `'use client'` 지시문을 추가해야만 클라이언트 컴포넌트가 됩니다.

```tsx
// Server Component (기본값 — 선언 없음)
export default async function UserProfile({ id }: { id: string }) {
  const user = await db.user.findUnique({ where: { id } }); // DB 직접 접근
  return <div>{user.name}</div>;
}
```

```tsx
// Client Component
'use client';

import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0); // useState 사용 가능
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

## 서버 컴포넌트의 능력과 제약

서버 컴포넌트는 Node.js 환경에서 렌더링됩니다. 다음이 가능합니다.

- `async/await`를 컴포넌트에서 직접 사용
- 데이터베이스, 파일시스템에 직접 접근
- API 키, 시크릿 환경 변수 안전하게 사용
- 큰 의존성을 클라이언트 번들에서 제외

하지만 브라우저 API와 React 인터랙티비티 기능은 쓸 수 없습니다.

```tsx
// 서버 컴포넌트에서 불가능한 것들
// ❌ import { useState } from 'react';
// ❌ onClick, onChange 등 이벤트 핸들러
// ❌ window, document, localStorage
// ❌ useEffect, useContext, useReducer
```

## 'use client' 경계

![use client 경계와 컴포넌트 트리](/assets/posts/next-server-vs-client-components-boundary.svg)

`'use client'`는 파일 최상단에 선언합니다. 이 선언은 **모듈 그래프에서 경계(boundary)를 만듭니다.** 해당 파일과 그 파일에서 import하는 모든 모듈이 클라이언트 번들에 포함됩니다.

```tsx
// app/components/ProductList.tsx
'use client'; // 이 파일부터 클라이언트 경계

import { useState } from 'react';
import { AddToCart } from './AddToCart'; // 자동으로 클라이언트

export function ProductList({ products }) {
  const [filter, setFilter] = useState('all');
  // ...
}
```

`AddToCart`가 `'use client'`를 직접 선언하지 않아도 `ProductList`가 import하므로 클라이언트 컴포넌트가 됩니다.

## 언제 서버, 언제 클라이언트?

실전에서 판단 기준은 단순합니다.

```
데이터 페칭, DB 접근, 민감 정보 처리
→ 서버 컴포넌트 (기본값 유지)

useState, useEffect, 이벤트 핸들러, 브라우저 API
→ 클라이언트 컴포넌트 ('use client')
```

일반적인 Next.js 앱의 컴포넌트 비율은 서버 70% + 클라이언트 30% 정도가 이상적입니다. 클라이언트 컴포넌트는 상호작용이 필요한 최소 단위에만 적용하세요.

## 서버 컴포넌트를 클라이언트에 전달하기

클라이언트 컴포넌트 내부에서 서버 컴포넌트를 **직접 import할 수 없습니다.** 하지만 props(`children`)로 전달하는 것은 가능합니다.

```tsx
// ✅ 올바른 패턴: children으로 전달
// app/page.tsx (Server)
import { Modal } from '@/components/Modal'; // Client
import { UserInfo } from '@/components/UserInfo'; // Server

export default function Page() {
  return (
    <Modal>
      <UserInfo /> {/* 서버 컴포넌트를 children으로 전달 */}
    </Modal>
  );
}
```

```tsx
// ❌ 잘못된 패턴: 클라이언트에서 서버 컴포넌트 import
// components/Modal.tsx
'use client';
import { UserInfo } from './UserInfo'; // ❌ 서버 전용 코드가 클라이언트로 끌려옴
```

이 패턴은 **컴포넌트 합성(Composition)**의 핵심입니다. 다음 글에서 더 깊이 다룹니다.

## 클라이언트 컴포넌트의 서버 사이드 렌더링

`'use client'`가 "브라우저에서만 실행"을 의미하지 않습니다. 클라이언트 컴포넌트도 **초기 페이지 로드 시 서버에서 HTML로 사전 렌더링**됩니다. 'use client'는 "인터랙티비티를 위해 클라이언트에서도 실행"을 의미합니다.

```
서버 컴포넌트: 서버에서만 실행 (HTML)
클라이언트 컴포넌트: 서버에서도 실행 (HTML) + 클라이언트에서 Hydration
```

---

**지난 글:** [Next.js template.tsx — 페이지마다 초기화되는 특별한 레이아웃](/posts/next-templates/)

**다음 글:** [서버·클라이언트 컴포넌트 합성 패턴](/posts/next-component-composition/)

<br>
읽어주셔서 감사합니다. 😊
