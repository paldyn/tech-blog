---
title: "Server Action 입력 검증 — Zod로 안전하게"
description: "Server Action에서 FormData 입력값을 Zod로 검증하는 방법을 설명합니다. safeParse를 활용한 필드별 오류 반환, flatten으로 오류 메시지 구성, useActionState 연동까지 실전 패턴을 코드로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 7
type: "knowledge"
category: "Next.js"
tags: ["Next.js", "ServerActions", "Zod", "입력검증", "FormData", "타입안전성"]
featured: false
draft: false
---

[지난 글](/posts/next-use-optimistic/)에서 낙관적 UI로 응답성 높은 인터페이스를 만드는 방법을 살펴봤습니다. Server Action을 실제 서비스에 사용할 때는 클라이언트에서 어떤 데이터가 전달될지 절대 신뢰해서는 안 됩니다. 이번 글에서는 **Zod**를 사용해 Server Action의 입력을 안전하게 검증하는 실전 패턴을 다룹니다.

## 왜 서버 검증이 필수인가

클라이언트 검증(HTML5 `required`, React 상태 검증 등)은 정상 사용자에게 즉각적인 피드백을 주지만, 쉽게 우회됩니다. 브라우저 개발자 도구로 HTML을 수정하거나 `curl`로 직접 요청을 보내면 클라이언트 검증은 무의미합니다. **서버에서의 검증은 항상 필수**입니다.

![Server Action 검증 레이어](/assets/posts/next-server-action-validation-layers.svg)

## Zod 스키마 정의

Zod는 TypeScript 우선 스키마 선언·검증 라이브러리입니다. 먼저 스키마를 별도 파일에 정의하면 서버 액션과 클라이언트 검증에서 재사용할 수 있습니다.

```ts
// lib/schemas/post.ts
import { z } from 'zod'

export const CreatePostSchema = z.object({
  title: z
    .string()
    .min(2, '제목은 최소 2자 이상이어야 합니다')
    .max(100, '제목은 100자를 초과할 수 없습니다'),
  content: z
    .string()
    .min(10, '내용은 최소 10자 이상이어야 합니다'),
  category: z.enum(['tech', 'life', 'review'], {
    errorMap: () => ({ message: '올바른 카테고리를 선택하세요' }),
  }),
  published: z.boolean().optional().default(false),
})

// 타입 추출
export type CreatePostInput = z.infer<typeof CreatePostSchema>
```

## Server Action에서 safeParse 사용

```ts
// app/actions/posts.ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { CreatePostSchema } from '@/lib/schemas/post'
import { db } from '@/lib/db'

type ActionState = {
  errors?: {
    fieldErrors: { title?: string[]; content?: string[]; category?: string[] }
    formErrors: string[]
  }
}

export async function createPost(
  _prevState: ActionState | null,
  formData: FormData,
): Promise<ActionState | null> {
  const parsed = CreatePostSchema.safeParse({
    title: formData.get('title'),
    content: formData.get('content'),
    category: formData.get('category'),
  })

  if (!parsed.success) {
    return { errors: parsed.error.flatten() }
  }

  // 검증 통과 — parsed.data는 타입이 보장된 CreatePostInput
  const post = await db.post.create({ data: parsed.data })

  revalidatePath('/posts')
  redirect(`/posts/${post.id}`)
}
```

`safeParse`는 검증 실패 시 예외를 던지지 않고 `{ success: false, error }` 객체를 반환합니다. `error.flatten()`은 필드별 오류(`fieldErrors`)와 폼 전체 오류(`formErrors`)로 나눠 반환해 UI에 표시하기 편합니다.

![Zod 검증 패턴](/assets/posts/next-server-action-validation-zod.svg)

## Client Component에서 오류 표시

`useActionState`와 연동해 검증 오류를 필드 아래에 표시합니다.

```tsx
// app/posts/new/page.tsx
'use client'

import { useActionState } from 'react'
import { createPost } from '@/app/actions/posts'

export default function NewPostPage() {
  const [state, action, isPending] = useActionState(createPost, null)

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="title">제목</label>
        <input id="title" name="title" />
        {state?.errors?.fieldErrors?.title?.map(err => (
          <p key={err} className="text-red-500 text-sm">{err}</p>
        ))}
      </div>

      <div>
        <label htmlFor="content">내용</label>
        <textarea id="content" name="content" rows={10} />
        {state?.errors?.fieldErrors?.content?.map(err => (
          <p key={err} className="text-red-500 text-sm">{err}</p>
        ))}
      </div>

      <div>
        <label htmlFor="category">카테고리</label>
        <select id="category" name="category">
          <option value="tech">기술</option>
          <option value="life">일상</option>
          <option value="review">리뷰</option>
        </select>
        {state?.errors?.fieldErrors?.category?.map(err => (
          <p key={err} className="text-red-500 text-sm">{err}</p>
        ))}
      </div>

      {state?.errors?.formErrors?.map(err => (
        <p key={err} className="text-red-500">{err}</p>
      ))}

      <button type="submit" disabled={isPending}>
        {isPending ? '저장 중...' : '작성 완료'}
      </button>
    </form>
  )
}
```

## FormData 변환 헬퍼

복잡한 폼에서는 FormData를 객체로 변환하는 헬퍼를 만들어두면 편리합니다.

```ts
// lib/form-utils.ts
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  for (const [key, value] of formData.entries()) {
    if (key in obj) {
      // 같은 이름의 필드가 여러 개면 배열로
      obj[key] = Array.isArray(obj[key]) ? [...(obj[key] as unknown[]), value] : [obj[key], value]
    } else {
      obj[key] = value
    }
  }
  return obj
}

// 사용
const parsed = CreatePostSchema.safeParse(formDataToObject(formData))
```

## 숫자·날짜 변환

`FormData`는 모든 값을 문자열로 반환합니다. Zod에서 숫자나 날짜로 변환하려면 `coerce`를 사용합니다.

```ts
const PriceSchema = z.object({
  amount: z.coerce.number().min(0, '금액은 0 이상이어야 합니다'),
  date: z.coerce.date(),
})
```

---

**지난 글:** [useOptimistic — 낙관적 UI 업데이트](/posts/next-use-optimistic/)

**다음 글:** [Server Action 보안 — 인증과 인가](/posts/next-server-action-security/)

<br>
읽어주셔서 감사합니다. 😊
