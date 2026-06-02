---
title: "Request Memoization — 동일 요청 자동 중복 제거"
description: "Next.js App Router에서 React의 Request Memoization이 동일한 fetch 요청을 자동으로 중복 제거하는 원리를 이해합니다. 컴포넌트 트리 전체에서 한 번의 네트워크 요청으로 데이터를 공유하는 방법과 React.cache()를 이용한 비-fetch 함수 메모이제이션까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 1
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "Request Memoization", "React.cache", "서버 컴포넌트", "데이터 패칭", "중복 제거"]
featured: false
draft: false
---

[지난 글](/posts/next-server-data-fetching/)에서 서버 컴포넌트로 데이터를 패칭하는 기본 방법과 `Promise.all`을 활용한 병렬 패칭을 살펴봤습니다. 이번에는 같은 데이터가 여러 컴포넌트에서 필요할 때 어떻게 중복 요청을 없애는지 알아봅니다. 핵심 개념은 **Request Memoization**입니다.

## Request Memoization이란

App Router에서 React는 `fetch` API를 확장해, 하나의 렌더 패스 안에서 **동일한 URL과 옵션**으로 호출된 `fetch`를 자동으로 메모이제이션합니다. 첫 번째 호출만 실제 네트워크 요청을 보내고, 그 결과가 인메모리 캐시에 저장됩니다. 같은 렌더 트리 내 이후 호출은 네트워크 없이 캐시된 결과를 반환합니다.

![Request Memoization 동작 원리](/assets/posts/next-request-deduplication-memoization.svg)

```tsx
// lib/data.ts
async function fetchUser(id: string) {
  const res = await fetch(`https://api.example.com/users/${id}`);
  return res.json();
}

// app/layout.tsx — 첫 번째 호출 → 실제 네트워크 요청
export default async function Layout() {
  const user = await fetchUser('me');
  return <header>{user.name}</header>;
}

// app/page.tsx — 동일 URL → 캐시 반환, fetch 없음
export default async function Page() {
  const user = await fetchUser('me');
  return <Profile user={user} />;
}
```

`fetchUser`를 두 곳에서 호출했지만 네트워크 요청은 한 번뿐입니다. Props drilling 없이 각 컴포넌트가 독립적으로 데이터를 선언하면서도 성능을 유지할 수 있는 이유가 여기 있습니다.

## 적용 조건

메모이제이션이 동작하려면 다음 조건을 모두 충족해야 합니다.

- **GET 요청**만 해당합니다. POST, DELETE 등은 사이드 이펙트가 있으므로 메모이제이션되지 않습니다.
- **동일한 URL + 동일한 옵션 객체**여야 합니다. 옵션이 조금이라도 다르면 별개 키로 처리됩니다.
- **같은 렌더 패스** 안에 있어야 합니다. 서로 다른 HTTP 요청은 완전히 별개의 캐시를 씁니다.

```tsx
// ✅ 같은 캐시 키 — 두 번째는 캐시 히트
fetch('https://api.example.com/users/me')
fetch('https://api.example.com/users/me')

// ❌ 다른 캐시 키 — 두 번 모두 실제 요청
fetch('https://api.example.com/users/me')
fetch('https://api.example.com/users/me', { cache: 'no-store' })
```

## 스코프와 수명

![Memoization vs Data Cache 스코프 비교](/assets/posts/next-request-deduplication-scope.svg)

Request Memoization은 **단일 서버 요청** 수명 동안만 유효합니다. React가 렌더링을 마치면 캐시는 자동으로 해제됩니다. 다음 사용자 요청이 오면 새로 빈 캐시에서 시작합니다.

이 점에서 **Data Cache**와 구분됩니다. Data Cache는 서버 재시작이나 명시적 무효화 전까지 여러 요청에 걸쳐 유지됩니다. Request Memoization은 서버 컴포넌트 Props drilling을 피하기 위한 **같은 요청 안에서의 최적화**이고, Data Cache는 **요청 간 공유**를 위한 영속적 저장소입니다.

## React.cache() — fetch 외 함수 메모이제이션

ORM, DB 직접 쿼리, 또는 커스텀 로직은 `fetch`를 쓰지 않으므로 자동 메모이제이션이 적용되지 않습니다. 이때 `React.cache()`로 동일한 효과를 얻을 수 있습니다.

```tsx
import { cache } from 'react';
import { db } from '@/lib/db';

// 같은 렌더 패스에서 동일 id 호출 시 DB 쿼리 1회만 실행
export const getUserById = cache(async (id: string) => {
  return db.user.findUnique({ where: { id } });
});

// app/layout.tsx
const user = await getUserById('abc123');

// app/dashboard/page.tsx
const user = await getUserById('abc123'); // DB 쿼리 없이 캐시 반환
```

`React.cache()`는 인수를 기준으로 메모이제이션하므로, `id`가 같으면 한 번만 DB를 조회합니다. 이 캐시도 Request Memoization과 마찬가지로 렌더 패스가 끝나면 초기화됩니다.

## 실전 패턴

각 컴포넌트에서 필요한 데이터를 직접 선언하고, 공통 함수는 `React.cache()`로 감싸두는 것이 권장 패턴입니다.

```tsx
// lib/queries.ts
import { cache } from 'react';

export const getUser = cache(async (id: string) => {
  const res = await fetch(`/api/users/${id}`);
  return res.json();
});

export const getOrders = cache(async (userId: string) => {
  return db.order.findMany({ where: { userId } });
});
```

이렇게 하면 서버 컴포넌트 트리 어디서나 `getUser(id)`를 호출해도 실제 작업은 딱 한 번만 이루어집니다. TypeScript 타입도 명시적으로 관리할 수 있어 유지보수가 쉽습니다.

## 메모이제이션 무효화

필요하다면 특정 `fetch` 호출을 메모이제이션에서 제외할 수 있습니다. `AbortSignal`을 활용해 고유한 요청으로 만들거나, 서버 액션처럼 항상 최신 데이터가 필요한 맥락에서는 `cache: 'no-store'`와 함께 사용하는 방법이 있습니다.

---

**지난 글:** [서버 데이터 패칭 — fetch, async 컴포넌트, 중복 제거](/posts/next-server-data-fetching/)

**다음 글:** [클라이언트 데이터 패칭 — SWR과 TanStack Query](/posts/next-client-data-fetching/)

<br>
읽어주셔서 감사합니다. 😊
