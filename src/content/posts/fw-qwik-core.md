---
title: "Qwik 핵심 — 재개 가능성(Resumability)과 O(1) 로딩"
description: "Qwik의 Resumability 개념, Hydration과의 차이, $ 접미사 지연 로딩 경계, useSignal/useStore, QwikCity routeLoader$/routeAction$, 서버-클라이언트 경계 직렬화를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 10
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Qwik", "Resumability", "지연로딩", "SSR", "QwikCity", "Signal", "성능"]
featured: false
draft: false
---

[지난 글](/posts/fw-solid-core/)에서 SolidJS의 세밀한 반응성을 살펴봤습니다. 이번에는 **Qwik**을 다룹니다. Qwik은 "애플리케이션 크기에 관계없이 **O(1)의 초기 로딩 시간**을 달성한다"는 목표로 설계된 프레임워크입니다. 핵심 아이디어는 **Resumability(재개 가능성)**입니다. 서버에서 렌더링한 상태를 직렬화해 HTML에 포함시키고, 클라이언트는 전통적인 Hydration 없이 바로 인터랙션할 수 있습니다.

---

## Resumability vs Hydration

![Qwik — Resumability vs Hydration](/assets/posts/fw-qwik-core-resumable.svg)

### 전통적 Hydration의 문제

Next.js, Nuxt 같은 SSR 프레임워크는 서버에서 HTML을 만들어 보내지만, 클라이언트에서 전체 JavaScript를 다운로드하고 모든 컴포넌트를 다시 실행(Hydration)해야 인터랙션이 가능합니다. 앱이 클수록 TTI(Time to Interactive)가 느려집니다.

### Resumability

Qwik은 서버 렌더링 시 컴포넌트 상태와 이벤트 핸들러 위치를 HTML 속성(`q:id`, `q:func`)으로 직렬화합니다. 클라이언트는 약 **1KB의 런타임**만 로드합니다. 이 런타임이 이벤트를 감청하다가, 실제 이벤트가 발생하면 **그 이벤트 핸들러 코드만** 지연 로드해 실행합니다.

```html
<!-- Qwik이 생성하는 HTML (단순화) -->
<button on:click="./chunk-abc123.js#onClick">
  Count: 0
</button>
<script id="qwikloader">
  /* ~1KB — 전역 이벤트 리스너, 지연 로딩 조율 */
</script>
```

버튼을 클릭하면 `chunk-abc123.js`를 로드해 `onClick` 핸들러를 실행합니다. 다른 컴포넌트의 코드는 전혀 로드하지 않습니다.

---

## $ 접미사 — 지연 로딩 경계

Qwik에서 `$` 접미사는 **코드 분리 경계(Lazy Loading Boundary)**를 표시합니다. 컴파일러가 이 부분을 별도 청크로 분리합니다.

```jsx
import { component$, useSignal, useTask$ } from '@builder.io/qwik'

export const Counter = component$(() => {
  const count = useSignal(0)

  // $ 핸들러 — 이벤트 발생 시 이 청크만 로드
  const handleClick = $(() => {
    count.value++
  })

  // useTask$ — 서버와 클라이언트 모두에서 실행
  useTask$(({ track }) => {
    track(() => count.value)
    console.log('count changed:', count.value)
  })

  return (
    <button onClick$={handleClick}>
      Count: {count.value}
    </button>
  )
})
```

`component$`, `onClick$`, `useTask$` — `$`가 붙은 곳이 코드 분리 지점입니다.

---

## Signal과 Store

```jsx
import { useSignal, useStore, useComputed$ } from '@builder.io/qwik'

export const App = component$(() => {
  // 단순 값
  const count = useSignal(0)

  // 객체 상태 (중첩 속성도 반응성)
  const state = useStore({
    items: [] as string[],
    filter: '',
  })

  // 파생 Signal
  const filtered = useComputed$(() =>
    state.items.filter(item => item.includes(state.filter))
  )

  return (
    <div>
      <p>{count.value}</p>
      <ul>
        {filtered.value.map(item => <li key={item}>{item}</li>)}
      </ul>
    </div>
  )
})
```

---

## QwikCity — 라우팅과 서버 통신

![QwikCity — 라우팅과 데이터 로딩](/assets/posts/fw-qwik-core-loader.svg)

QwikCity는 Qwik의 메타 프레임워크입니다. Next.js처럼 파일 시스템 기반 라우팅을 제공하며, 서버-클라이언트 경계를 `routeLoader$`와 `routeAction$`으로 처리합니다.

```typescript
// routes/users/index.tsx
import { routeLoader$ } from '@builder.io/qwik-city'

export const useUsers = routeLoader$(async () => {
  // 이 코드는 서버에서만 실행됩니다
  // DB 접근, API 키 사용 가능 — 클라이언트에 노출 안 됨
  return await db.user.findMany()
})

export default component$(() => {
  const users = useUsers()  // Signal<User[]>

  return (
    <ul>
      {users.value.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  )
})
```

### routeAction$ — 폼 처리

```typescript
import { routeAction$, zod$, z } from '@builder.io/qwik-city'

export const useCreateUser = routeAction$(
  async (data, { redirect }) => {
    await db.user.create({ data })
    throw redirect(302, '/users')
  },
  // zod로 유효성 검증
  zod$({ name: z.string().min(1), email: z.string().email() })
)

export default component$(() => {
  const createUser = useCreateUser()

  return (
    <Form action={createUser}>
      <input name="name" type="text" />
      <input name="email" type="email" />
      {createUser.value?.failed && <p>오류 발생</p>}
      <button type="submit">생성</button>
    </Form>
  )
})
```

`Form` 컴포넌트는 JavaScript 없이도 동작하는 **Progressive Enhancement**를 지원합니다.

---

## 다른 프레임워크와 비교

| 항목 | Qwik | Next.js | SolidStart |
|---|---|---|---|
| 초기 로딩 전략 | Resumability | Hydration | Hydration |
| 초기 JS | ~1KB 런타임 | 전체 번들 | SolidJS 런타임 |
| 코드 분리 | 자동 ($) | 수동 (dynamic import) | 자동 |
| 서버 함수 | routeLoader$/Action$ | Server Actions | server$ |
| 학습 곡선 | 높음 ($ 패턴 생소) | 낮음-중간 | 중간 |

---

## 언제 Qwik을 선택할까?

- 콘텐츠가 많은 사이트에서 Core Web Vitals(LCP, TTI)가 비즈니스 KPI인 경우
- 모바일 저사양 기기, 느린 네트워크 환경을 타깃으로 하는 경우
- 번들 크기 증가에 비례해 TTI가 나빠지는 상황을 근본적으로 해결하고 싶을 때

반면 팀이 소규모이고 빠른 개발 속도가 중요하다면 Next.js 또는 SvelteKit이 더 실용적인 선택입니다. Qwik의 `$` 패턴과 직렬화 제약(클로저 안 값이 직렬화 가능해야 함)은 학습과 디버깅 비용을 높입니다.

---

**지난 글:** [SolidJS 핵심 — 세밀한 반응성과 Virtual DOM 없는 선언적 UI](/posts/fw-solid-core/)

<br>
읽어주셔서 감사합니다. 😊
