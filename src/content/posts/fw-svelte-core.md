---
title: "Svelte 핵심 — 컴파일러 기반 반응성과 Virtual DOM 없는 렌더링"
description: "Svelte의 컴파일러 동작 원리, Virtual DOM 없는 직접 DOM 조작, Runes 반응성 문법($state/$derived/$effect), Stores, SvelteKit, Svelte 4 vs 5 비교를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Svelte", "SvelteKit", "컴파일러", "반응성", "Runes", "VirtualDOM", "성능"]
featured: false
draft: false
---

[지난 글](/posts/fw-vue-core/)에서 Vue 3의 Proxy 기반 반응성을 살펴봤습니다. 이번에는 **Svelte**를 다룹니다. Svelte는 React나 Vue와 근본적으로 다른 철학을 가집니다. **"프레임워크를 런타임에 포함시키지 말고, 컴파일 타임에 바닐라 JS로 변환하자"**는 발상입니다. Virtual DOM 없이, 런타임 Diff 없이, 직접 DOM을 조작하는 코드를 생성합니다.

---

## 컴파일러 동작 원리

![Svelte — 컴파일러 기반 반응성](/assets/posts/fw-svelte-core-compile.svg)

`.svelte` 파일은 빌드 타임에 컴파일됩니다. 컴파일러는 템플릿 변수를 분석해서 **어떤 DOM 노드가 어떤 변수에 의존하는지** 정적으로 파악합니다. 그 결과 런타임에 "어디가 변경됐는지 찾는" 과정이 필요 없습니다. `count++`가 실행되면 컴파일된 코드가 직접 해당 텍스트 노드를 업데이트합니다.

```javascript
// 컴파일 결과 (단순화)
let count = 0
const text = document.createTextNode(count)

button.addEventListener('click', () => {
  count++
  text.data = count   // DOM 직접 업데이트 — Diff 없음
})
```

---

## Svelte 4 — 기본 문법

```svelte
<script>
  export let name = 'World'   // props
  let count = 0

  // $: 반응성 선언 (count가 바뀔 때마다 재계산)
  $: doubled = count * 2
  $: {
    // 블록 전체가 반응성
    if (count > 10) console.log('10 초과!')
  }

  function handleClick() {
    count++
  }
</script>

<h1>Hello, {name}!</h1>
<button on:click={handleClick}>
  클릭: {count} (doubled: {doubled})
</button>

<style>
  /* 자동으로 컴포넌트 스코프 적용 */
  button { color: red; }
</style>
```

Svelte의 CSS는 기본적으로 **컴포넌트 스코프**입니다. 컴파일러가 각 클래스에 고유 해시를 붙여서 다른 컴포넌트와 충돌하지 않습니다.

---

## Svelte 5 — Runes

Svelte 5는 **Runes**라는 새로운 반응성 API를 도입했습니다. `$state`, `$derived`, `$effect`, `$props`는 특수 컴파일러 시그널로, 일반 JS 변수 할당처럼 작성하지만 반응성이 있습니다.

```svelte
<script>
  let count = $state(0)
  let doubled = $derived(count * 2)

  $effect(() => {
    console.log('count changed:', count)
    return () => console.log('cleanup')   // cleanup
  })

  let { name, age = 0 } = $props()
</script>
```

Runes는 TypeScript와 훨씬 자연스럽게 통합됩니다. `$state<User>({ id: 1 })`처럼 제네릭 타입도 지원합니다.

---

## Stores — 전역 상태 관리

![Svelte Stores — 전역 상태 관리](/assets/posts/fw-svelte-core-store.svg)

Svelte Stores는 **subscribe 계약**을 구현한 객체입니다. 표준 인터페이스(`{ subscribe }`)를 구현하면 Svelte의 `$` 자동 구독 문법을 쓸 수 있습니다.

```javascript
// stores.js
import { writable, readable, derived, get } from 'svelte/store'

// writable: set/update/subscribe
export const count = writable(0)

// readable: 외부 소스 연결 (WebSocket, timer 등)
export const time = readable(new Date(), function start(set) {
  const id = setInterval(() => set(new Date()), 1000)
  return function stop() { clearInterval(id) }
})

// derived: 다른 스토어에서 파생
export const elapsed = derived(
  time,
  $time => Math.round(($time - start) / 1000)
)

// 컴포넌트 밖에서 스토어 값 읽기
const value = get(count)
```

```svelte
<script>
  import { count } from './stores'
</script>

<!-- $ 접두사: 자동 구독 + 컴포넌트 언마운트 시 자동 해제 -->
<p>현재 카운트: {$count}</p>
<button on:click={() => count.update(n => n + 1)}>증가</button>
<button on:click={() => count.set(0)}>리셋</button>
```

---

## 컴포넌트 간 통신

```svelte
<!-- Parent.svelte -->
<script>
  import Child from './Child.svelte'
  let message = ''

  function handleMessage(event) {
    message = event.detail.text
  }
</script>

<Child on:message={handleMessage} />
<p>받은 메시지: {message}</p>
```

```svelte
<!-- Child.svelte -->
<script>
  import { createEventDispatcher } from 'svelte'
  const dispatch = createEventDispatcher()

  function send() {
    dispatch('message', { text: 'Hello from Child!' })
  }
</script>

<button on:click={send}>메시지 보내기</button>
```

---

## SvelteKit — 메타 프레임워크

SvelteKit은 Svelte의 공식 메타 프레임워크로, Next.js에 대응합니다.

```javascript
// src/routes/products/[id]/+page.server.js
export async function load({ params }) {
  const product = await fetchProduct(params.id)
  if (!product) throw error(404, 'Product not found')
  return { product }
}
```

```svelte
<!-- src/routes/products/[id]/+page.svelte -->
<script>
  export let data   // load()의 반환값 자동 주입
</script>

<h1>{data.product.name}</h1>
```

파일 시스템 기반 라우팅, SSR/SSG/CSR 혼합, Form Actions, 서버 사이드 데이터 로딩을 지원합니다.

---

## React/Vue와 비교

| 항목 | Svelte | React | Vue 3 |
|---|---|---|---|
| 반응성 방식 | 컴파일 타임 변환 | 런타임 Hook | Proxy 기반 |
| Virtual DOM | 없음 | 있음 | 있음 |
| 런타임 크기 | ~4KB | ~40KB | ~30KB |
| 번들 크기 (앱 포함) | 앱이 커질수록 차이 감소 | 런타임 고정 | 런타임 고정 |
| 학습 곡선 | 낮음 | 중간 | 중간 |
| TypeScript | Runes에서 완전 지원 | 완전 지원 | 완전 지원 |

---

**지난 글:** [Vue 3 핵심 — Composition API, Reactivity, Virtual DOM](/posts/fw-vue-core/)

**다음 글:** [Angular 핵심 — Zone.js, DI, 변경 감지, Signal](/posts/fw-angular-core/)

<br>
읽어주셔서 감사합니다. 😊
