---
title: "useActionState — 액션 상태 관리"
description: "React 19의 useActionState 훅으로 Server Action의 반환값과 pending 상태를 관리하는 방법을 설명합니다. 검증 오류 표시, 성공 피드백, 이전 상태 활용 패턴을 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 5
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "useActionState", "ServerActions", "React19", "폼검증", "상태관리"]
featured: false
draft: false
---

[지난 글](/posts/next-form-actions/)에서 `<form action>`과 `useFormStatus`를 이용해 폼 제출 상태를 처리하는 방법을 살펴봤습니다. 그러나 Server Action의 **반환값**(검증 오류, 성공 메시지 등)을 클라이언트에서 받아 UI에 반영하려면 추가 도구가 필요합니다. React 19에서 도입된 **`useActionState`** 훅이 바로 그 역할을 합니다.

## useActionState란

`useActionState`는 Server Action을 래핑해서 세 가지 값을 반환하는 훅입니다.

```tsx
const [state, action, isPending] = useActionState(serverFn, initialState)
```

- **state**: Server Action이 반환한 가장 최근 값. 초기에는 `initialState`.
- **action**: `<form action={action}>`에 전달할 래핑된 액션 함수.
- **isPending**: 액션 실행 중 여부를 나타내는 boolean.

Server Action에서 검증 실패를 반환하면 `state`가 업데이트되고 컴포넌트가 리렌더링됩니다. 별도의 `useState`나 `useEffect` 없이 서버 응답을 UI에 즉시 반영할 수 있습니다.

![useActionState 데이터 흐름](/assets/posts/next-use-action-state-flow.svg)

## Server Action에서 상태 반환하기

`useActionState`와 함께 사용하는 Server Action은 첫 번째 인자로 `prevState`를 받습니다.

```ts
// app/actions/signup.ts
'use server'

type State = {
  error?: string
  fieldErrors?: { email?: string; password?: string }
  ok?: boolean
}

export async function signUp(prevState: State | null, formData: FormData): Promise<State> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  // 검증
  if (!email.includes('@')) {
    return { fieldErrors: { email: '유효한 이메일을 입력하세요' } }
  }
  if (password.length < 8) {
    return { fieldErrors: { password: '비밀번호는 8자 이상이어야 합니다' } }
  }

  // DB 처리
  try {
    await db.user.create({ data: { email, password: await hash(password) } })
  } catch {
    return { error: '이미 사용 중인 이메일입니다' }
  }

  return { ok: true }
}
```

`prevState`는 이전 호출의 반환값입니다. 다단계 폼이나 누적 오류가 필요할 때 활용할 수 있지만, 단순한 경우 `_`로 무시해도 됩니다.

## Client Component에서 사용하기

```tsx
// app/signup/page.tsx
'use client'

import { useActionState } from 'react'
import { signUp } from '@/app/actions/signup'

export default function SignUpPage() {
  const [state, action, isPending] = useActionState(signUp, null)

  if (state?.ok) {
    return <p className="text-green-600">회원가입이 완료되었습니다! 🎉</p>
  }

  return (
    <form action={action} className="space-y-4">
      {state?.error && (
        <p className="text-red-500">{state.error}</p>
      )}

      <div>
        <input name="email" type="email" placeholder="이메일" />
        {state?.fieldErrors?.email && (
          <p className="text-red-400 text-sm">{state.fieldErrors.email}</p>
        )}
      </div>

      <div>
        <input name="password" type="password" placeholder="비밀번호" />
        {state?.fieldErrors?.password && (
          <p className="text-red-400 text-sm">{state.fieldErrors.password}</p>
        )}
      </div>

      <button type="submit" disabled={isPending}>
        {isPending ? '처리 중...' : '가입하기'}
      </button>
    </form>
  )
}
```

![useActionState 전체 예제](/assets/posts/next-use-action-state-code.svg)

## useActionState vs useFormStatus 비교

| 훅 | 역할 | 위치 |
|---|---|---|
| `useActionState` | 액션의 반환값과 isPending 관리 | 폼을 포함하는 컴포넌트 |
| `useFormStatus` | 부모 form의 pending 상태만 읽음 | form 안의 자식 컴포넌트 |

둘을 함께 사용하면 더욱 세밀한 UX를 구현할 수 있습니다.

```tsx
// SubmitButton: useFormStatus로 pending 읽기
function SubmitButton() {
  const { pending } = useFormStatus()
  return <button type="submit" disabled={pending}>{pending ? '처리 중...' : '제출'}</button>
}

// SignUpForm: useActionState로 오류 메시지 받기
function SignUpForm() {
  const [state, action] = useActionState(signUp, null)
  return (
    <form action={action}>
      {state?.error && <p>{state.error}</p>}
      <input name="email" />
      <SubmitButton />
    </form>
  )
}
```

## 구버전과의 호환성

React 19 이전에는 동일한 기능을 `useFormState`라는 이름으로 `react-dom`에서 제공했습니다. React 19에서 `react`로 이동하고 이름이 `useActionState`로 변경됐습니다. Next.js 15는 React 19를 기본으로 사용하므로 `useActionState`를 권장합니다.

```ts
// React 18 이하 (구버전)
import { useFormState } from 'react-dom'

// React 19 / Next.js 15 이상 (현재)
import { useActionState } from 'react'
```

---

**지난 글:** [Form Actions — 폼과 Server Action 연결](/posts/next-form-actions/)

**다음 글:** [useOptimistic — 낙관적 UI 업데이트](/posts/next-use-optimistic/)

<br>
읽어주셔서 감사합니다. 😊
