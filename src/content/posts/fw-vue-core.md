---
title: "Vue 3 핵심 — Composition API, Reactivity, Virtual DOM"
description: "Vue 3의 Proxy 기반 반응성 시스템, ref/reactive/computed, Composition API와 script setup, Composable 패턴, 컴포넌트 생명주기, Vue 3 vs Vue 2 주요 차이를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 6
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "Vue", "Vue3", "CompositionAPI", "반응성", "Proxy", "ref", "Composable"]
featured: false
draft: false
---

[지난 글](/posts/fw-react-core/)에서 React Fiber와 Hook의 내부 동작을 살펴봤습니다. 이번에는 **Vue 3**를 다룹니다. Vue는 React보다 더 선언적이고 양방향 바인딩이 자연스럽습니다. Vue 3는 내부 반응성 엔진을 Proxy 기반으로 완전히 재작성했고, Composition API를 도입해 코드 재사용 방식을 혁신했습니다.

---

## Proxy 기반 반응성 시스템

Vue 2는 `Object.defineProperty`로 각 속성에 getter/setter를 심어 변화를 감지했습니다. 이 방식은 `obj.newProp = value` 같은 새 속성 추가를 감지하지 못해 `Vue.set()`이 필요했습니다.

Vue 3는 **Proxy**로 객체 전체를 감쌉니다. 모든 속성 접근(`get`)과 변경(`set`)을 인터셉트할 수 있어 새 속성 추가도 자동으로 감지합니다.

![Vue 3 반응성 시스템 — Proxy 기반](/assets/posts/fw-vue-core-reactivity.svg)

```javascript
// reactive()는 내부적으로 이렇게 동작
function reactive(obj) {
  return new Proxy(obj, {
    get(target, key) {
      track(target, key)           // 현재 실행 중인 Effect를 의존성으로 등록
      return Reflect.get(target, key)
    },
    set(target, key, value) {
      Reflect.set(target, key, value)
      trigger(target, key)         // 의존성 Effect 모두 재실행
      return true
    },
  })
}
```

---

## ref vs reactive

`ref`는 단일 값(원시값 포함)을 반응성으로 만듭니다. `.value`로 접근합니다.
`reactive`는 객체를 Proxy로 감쌉니다. 속성에 직접 접근합니다.

```javascript
import { ref, reactive, computed, watch, watchEffect } from 'vue'

// ref — 원시값도 가능
const count = ref(0)
count.value++               // .value 필수
console.log(count.value)   // 1

// reactive — 객체
const state = reactive({ count: 0, name: 'Vue' })
state.count++               // .value 없이 직접

// ⚠ reactive 변수 자체를 교체하면 반응성이 끊어집니다
let obj = reactive({ x: 1 })
obj = reactive({ x: 2 })   // ❌ 이전 참조를 가진 곳에서 반응성 없어짐
```

템플릿에서 `ref`는 `.value` 없이 자동으로 언래핑됩니다.

---

## computed와 watch

```javascript
// computed: 읽기 전용 파생 상태, 캐시됨
const doubled = computed(() => count.value * 2)

// computed setter
const fullName = computed({
  get: () => `${firstName.value} ${lastName.value}`,
  set: (val) => {
    [firstName.value, lastName.value] = val.split(' ')
  },
})

// watch: 소스를 명시적으로 지정
watch(count, (newVal, oldVal) => {
  console.log('count 변경:', oldVal, '->', newVal)
}, { immediate: true })   // 즉시 실행

// watchEffect: 의존성 자동 추적
watchEffect(() => {
  console.log('count:', count.value)   // count를 읽으므로 자동 추적
})
```

---

## Composition API vs Options API

![Options API vs Composition API](/assets/posts/fw-vue-core-composition.svg)

`<script setup>` 문법을 쓰면 Composition API를 가장 간결하게 쓸 수 있습니다.

```vue
<!-- Counter.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{ initialCount: number }>()
const emit = defineEmits<{ change: [count: number] }>()

const count = ref(props.initialCount)
const doubled = computed(() => count.value * 2)

function increment() {
  count.value++
  emit('change', count.value)
}
</script>

<template>
  <button @click="increment">{{ count }} (doubled: {{ doubled }})</button>
</template>
```

`defineProps`와 `defineEmits`는 컴파일러 매크로입니다. `import` 없이 `<script setup>` 안에서만 사용합니다.

---

## Composable — 로직 재사용 단위

Composable은 Vue 3의 핵심 패턴입니다. 반응성 상태와 로직을 함수로 추출해 여러 컴포넌트에서 재사용합니다.

```javascript
// composables/useCounter.js
import { ref, computed } from 'vue'

export function useCounter(initialValue = 0) {
  const count = ref(initialValue)
  const doubled = computed(() => count.value * 2)

  function increment(step = 1) { count.value += step }
  function reset() { count.value = initialValue }

  return { count, doubled, increment, reset }
}
```

```javascript
// composables/useFetch.js
import { ref, watchEffect } from 'vue'

export function useFetch(url) {
  const data = ref(null)
  const error = ref(null)
  const loading = ref(false)

  watchEffect(async () => {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(url.value ?? url)
      data.value = await res.json()
    } catch (e) {
      error.value = e
    } finally {
      loading.value = false
    }
  })

  return { data, error, loading }
}
```

---

## 컴포넌트 생명주기

```javascript
import {
  onMounted,
  onUpdated,
  onUnmounted,
  onBeforeMount,
} from 'vue'

onMounted(() => {
  // DOM 접근 가능
  console.log('컴포넌트 마운트됨')
})

onUnmounted(() => {
  // 정리 작업 (이벤트 리스너 제거 등)
})
```

| Hook | Options API | 설명 |
|---|---|---|
| `onBeforeMount` | `beforeMount` | DOM 생성 전 |
| `onMounted` | `mounted` | DOM 생성 후 |
| `onUpdated` | `updated` | 반응성 업데이트 후 |
| `onUnmounted` | `unmounted` | 언마운트 후 |

---

## Vue 3 vs Vue 2 주요 변화

| 항목 | Vue 2 | Vue 3 |
|---|---|---|
| 반응성 | `Object.defineProperty` | `Proxy` |
| 루트 엘리먼트 | 단일 루트 필수 | 다중 루트(Fragment) 가능 |
| 전역 API | `Vue.component`, `Vue.use` | `app.component`, `app.use` |
| Teleport | 없음 | `<Teleport>` 내장 |
| TypeScript | 제한적 | 완전 지원 |
| 번들 크기 | ~20KB | ~10KB (tree-shaking) |

---

**지난 글:** [React 핵심 원리 — Virtual DOM, Fiber, Reconciliation](/posts/fw-react-core/)

**다음 글:** [Svelte 핵심 — 컴파일러 기반 반응성과 Virtual DOM 없는 렌더링](/posts/fw-svelte-core/)

<br>
읽어주셔서 감사합니다. 😊
