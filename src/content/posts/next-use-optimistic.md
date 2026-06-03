---
title: "useOptimistic — 낙관적 UI 업데이트"
description: "React 19의 useOptimistic 훅으로 Server Action 완료 전에 UI를 즉시 업데이트하는 낙관적 UI 패턴을 구현합니다. 좋아요 버튼, 메시지 전송 등 반응형 인터페이스에 필수적인 기법을 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 6
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "useOptimistic", "낙관적UI", "React19", "ServerActions", "UX"]
featured: false
draft: false
---

[지난 글](/posts/next-use-action-state/)에서 `useActionState`로 Server Action의 반환값을 UI에 반영하는 방법을 살펴봤습니다. 그런데 Server Action은 서버를 거치므로 최소 수십~수백 밀리초가 걸립니다. 사용자가 좋아요 버튼을 눌렀을 때 수백 밀리초를 기다려야 한다면 인터페이스가 둔하게 느껴집니다. React 19의 **`useOptimistic`** 훅은 서버 응답을 기다리지 않고 즉시 UI를 업데이트한 뒤, 서버 처리가 끝나면 실제 값으로 확정하는 **낙관적 UI** 패턴을 구현합니다.

## 낙관적 UI 개념

낙관적 UI는 사용자 액션이 성공할 것이라고 가정하고 UI를 먼저 업데이트합니다. 대부분의 요청은 성공하기 때문에 이 가정은 대체로 옳습니다. 서버가 실제로 오류를 반환하면 원래 상태로 롤백합니다.

대표적인 사용 사례는 소셜 미디어의 좋아요 버튼, 채팅의 메시지 전송, 할 일 목록의 체크박스 등입니다.

![낙관적 UI vs 일반 방식 비교](/assets/posts/next-use-optimistic-concept.svg)

## useOptimistic 시그니처

```tsx
const [optimisticState, addOptimistic] = useOptimistic(state, updateFn)
```

- **state**: 서버에서 받은 실제 상태 (props나 useState 값)
- **updateFn**: `(currentState, optimisticValue) => newState` — 낙관적 상태를 계산하는 순수 함수
- **optimisticState**: 렌더링에 사용할 상태. 낙관적 업데이트 중에는 계산된 값, 그 외에는 `state`와 동일
- **addOptimistic**: 낙관적 업데이트를 트리거하는 함수

## 좋아요 버튼 구현

```tsx
// app/components/post-like.tsx
'use client'

import { useOptimistic, useTransition } from 'react'
import { toggleLike } from '@/app/actions/likes'

type LikeState = { liked: boolean; count: number }

export function PostLike({ postId, liked, count }: { postId: string } & LikeState) {
  const [isPending, startTransition] = useTransition()
  const [optimistic, setOptimistic] = useOptimistic<LikeState, LikeState>(
    { liked, count },
    (_, next) => next,  // updateFn: 새 값을 그대로 반환
  )

  function handleClick() {
    startTransition(async () => {
      // 즉시 낙관적 업데이트
      setOptimistic({
        liked: !optimistic.liked,
        count: optimistic.count + (optimistic.liked ? -1 : 1),
      })
      // 서버 요청 (완료 전까지 위 값이 UI에 표시됨)
      await toggleLike(postId)
      // 완료 후: props(liked, count)가 revalidate로 갱신되면 실제 값으로 확정
    })
  }

  return (
    <button onClick={handleClick} aria-pressed={optimistic.liked}>
      {optimistic.liked ? '❤️' : '🤍'} {optimistic.count}
    </button>
  )
}
```

```ts
// app/actions/likes.ts
'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'

export async function toggleLike(postId: string) {
  const userId = await getCurrentUserId()
  const existing = await db.like.findFirst({ where: { postId, userId } })

  if (existing) {
    await db.like.delete({ where: { id: existing.id } })
  } else {
    await db.like.create({ data: { postId, userId } })
  }

  revalidatePath(`/posts/${postId}`)
}
```

![useOptimistic 코드 예제](/assets/posts/next-use-optimistic-code.svg)

## startTransition이 필수인 이유

`useOptimistic`는 `startTransition` 내부에서 `setOptimistic`를 호출해야 합니다. `startTransition` 없이 호출하면 React가 낙관적 업데이트와 실제 상태 갱신을 구분하지 못해 예상치 못한 동작이 발생합니다.

```tsx
// ❌ 잘못된 사용 — startTransition 없음
async function handleClick() {
  setOptimistic(newState)  // 경고: startTransition 밖에서 호출됨
  await serverAction()
}

// ✅ 올바른 사용
function handleClick() {
  startTransition(async () => {
    setOptimistic(newState)
    await serverAction()
  })
}
```

## 메시지 목록 예제

목록에 새 항목을 추가하는 패턴은 낙관적 UI가 특히 빛나는 케이스입니다.

```tsx
'use client'

import { useOptimistic, useTransition, useRef } from 'react'
import { sendMessage } from '@/app/actions/messages'

type Message = { id: string; text: string; pending?: boolean }

export function MessageList({ messages }: { messages: Message[] }) {
  const [isPending, startTransition] = useTransition()
  const [optimisticMessages, addMessage] = useOptimistic<Message[], Message>(
    messages,
    (state, newMsg) => [...state, newMsg],
  )
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <>
      <ul>
        {optimisticMessages.map(msg => (
          <li key={msg.id} className={msg.pending ? 'opacity-50' : ''}>
            {msg.text}
          </li>
        ))}
      </ul>

      <form
        ref={formRef}
        action={(formData) => {
          startTransition(async () => {
            const text = formData.get('text') as string
            addMessage({ id: `temp-${Date.now()}`, text, pending: true })
            formRef.current?.reset()
            await sendMessage(text)
          })
        }}
      >
        <input name="text" placeholder="메시지 입력" />
        <button type="submit">전송</button>
      </form>
    </>
  )
}
```

전송 중인 메시지는 `opacity-50`으로 흐리게 표시하다가 서버 응답 후 실제 데이터로 교체됩니다.

## 언제 useOptimistic을 쓸까

| 상황 | 권장 여부 |
|---|---|
| 좋아요/북마크 토글 | ✅ 적극 권장 |
| 메시지/댓글 전송 | ✅ 적극 권장 |
| 체크박스 상태 변경 | ✅ 권장 |
| 결제 / 계좌이체 | ❌ 실제 결과가 중요 — 사용 금지 |
| 사용자 정보 수정 | ⚠️ 충돌 위험 — 신중하게 |

---

**지난 글:** [useActionState — 액션 상태 관리](/posts/next-use-action-state/)

**다음 글:** [Server Action 입력 검증](/posts/next-server-action-validation/)

<br>
읽어주셔서 감사합니다. 😊
