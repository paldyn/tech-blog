---
title: "테스팅 — Jest와 React Testing Library로 단위 테스트 작성하기"
description: "Next.js 프로젝트에 Jest와 React Testing Library를 설정하고 컴포넌트, 커스텀 훅, Server Action, API Route를 테스트하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 59
type: "knowledge"
category: "Next.js"
tags: ["nextjs", "테스팅", "Jest", "ReactTestingLibrary", "단위테스트", "TDD"]
featured: false
draft: false
---

[지난 글](/posts/next-error-monitoring/)에서 Sentry로 프로덕션 에러를 추적하는 방법을 살펴봤다. 이번 글은 **단위·통합 테스트**다. Next.js App Router 환경에서 Jest와 React Testing Library(RTL)를 설정하고 실전적인 테스트를 작성하는 방법을 다룬다.

## 테스트 전략

![Next.js 테스트 피라미드](/assets/posts/next-testing-pyramid.svg)

테스트는 피라미드 구조로 구성하는 것이 이상적이다. 단위 테스트를 가장 많이, E2E 테스트를 가장 적게 작성한다. 각 계층의 비용과 피드백 속도가 다르기 때문이다.

## 설치

```bash
npm install -D jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event ts-jest
```

![Jest + React Testing Library 설정](/assets/posts/next-testing-setup.svg)

```ts
// jest.config.ts
import type { Config } from 'jest'
import nextJest from 'next/jest'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: ['./jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
}

export default createJestConfig(config)
```

```ts
// jest.setup.ts
import '@testing-library/jest-dom'
```

## 컴포넌트 테스트

```tsx
// components/__tests__/UserCard.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserCard } from '@/components/UserCard'

const mockUser = {
  id: '1',
  name: '김철수',
  email: 'kim@example.com',
  role: 'admin' as const,
}

describe('UserCard', () => {
  it('사용자 이름과 이메일을 렌더링한다', () => {
    render(<UserCard user={mockUser} />)

    expect(screen.getByText('김철수')).toBeInTheDocument()
    expect(screen.getByText('kim@example.com')).toBeInTheDocument()
  })

  it('admin 역할에 뱃지를 표시한다', () => {
    render(<UserCard user={mockUser} />)

    expect(screen.getByText('관리자')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /관리자/ })).toBeInTheDocument()
  })

  it('삭제 버튼 클릭 시 onDelete 콜백을 호출한다', async () => {
    const handleDelete = jest.fn()
    const user = userEvent.setup()

    render(<UserCard user={mockUser} onDelete={handleDelete} />)

    await user.click(screen.getByRole('button', { name: '삭제' }))

    expect(handleDelete).toHaveBeenCalledWith('1')
    expect(handleDelete).toHaveBeenCalledTimes(1)
  })
})
```

## 커스텀 훅 테스트

```tsx
// hooks/__tests__/useCounter.test.ts
import { renderHook, act } from '@testing-library/react'
import { useCounter } from '@/hooks/useCounter'

describe('useCounter', () => {
  it('초기값이 0이어야 한다', () => {
    const { result } = renderHook(() => useCounter())
    expect(result.current.count).toBe(0)
  })

  it('increment 호출 시 카운터가 증가한다', () => {
    const { result } = renderHook(() => useCounter())

    act(() => {
      result.current.increment()
    })

    expect(result.current.count).toBe(1)
  })

  it('초기값을 받을 수 있다', () => {
    const { result } = renderHook(() => useCounter({ initialValue: 10 }))
    expect(result.current.count).toBe(10)
  })
})
```

## API Route Handler 테스트

```ts
// app/api/users/__tests__/route.test.ts
import { GET } from '@/app/api/users/route'
import { NextRequest } from 'next/server'

// 데이터베이스 모킹
jest.mock('@/lib/db', () => ({
  db: {
    user: {
      findMany: jest.fn(),
    },
  },
}))

import { db } from '@/lib/db'

describe('GET /api/users', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('사용자 목록을 반환한다', async () => {
    const mockUsers = [
      { id: '1', name: '김철수', email: 'kim@example.com' },
      { id: '2', name: '이영희', email: 'lee@example.com' },
    ]

    ;(db.user.findMany as jest.Mock).mockResolvedValue(mockUsers)

    const request = new NextRequest('http://localhost:3000/api/users')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual(mockUsers)
  })

  it('DB 오류 시 500을 반환한다', async () => {
    ;(db.user.findMany as jest.Mock).mockRejectedValue(new Error('DB Error'))

    const request = new NextRequest('http://localhost:3000/api/users')
    const response = await GET(request)

    expect(response.status).toBe(500)
  })
})
```

## Server Action 테스트

Server Action은 일반 async 함수이므로 직접 호출해서 테스트한다.

```ts
// actions/__tests__/createPost.test.ts
import { createPost } from '@/actions/createPost'

jest.mock('@/lib/db')
jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

import { db } from '@/lib/db'
import { revalidatePath } from 'next/cache'

describe('createPost', () => {
  it('유효한 데이터로 포스트를 생성한다', async () => {
    const mockPost = { id: '1', title: '테스트 포스트', content: '내용' }
    ;(db.post.create as jest.Mock).mockResolvedValue(mockPost)

    const formData = new FormData()
    formData.append('title', '테스트 포스트')
    formData.append('content', '내용')

    const result = await createPost({}, formData)

    expect(result).toEqual({ success: true, post: mockPost })
    expect(revalidatePath).toHaveBeenCalledWith('/blog')
  })

  it('빈 제목으로 검증 실패를 반환한다', async () => {
    const formData = new FormData()
    formData.append('title', '') // 빈 제목

    const result = await createPost({}, formData)

    expect(result).toEqual({
      success: false,
      errors: { title: '제목은 필수입니다.' },
    })
  })
})
```

## MSW로 API 모킹

외부 API 호출을 포함한 컴포넌트를 테스트할 때는 Mock Service Worker(MSW)를 사용한다.

```bash
npm install -D msw
```

```ts
// mocks/handlers.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('/api/posts', () => {
    return HttpResponse.json([
      { id: '1', title: '포스트 1' },
      { id: '2', title: '포스트 2' },
    ])
  }),

  http.post('/api/posts', async ({ request }) => {
    const body = await request.json() as { title: string }
    return HttpResponse.json({ id: '3', ...body }, { status: 201 })
  }),
]
```

```ts
// jest.setup.ts
import '@testing-library/jest-dom'
import { server } from './mocks/server'

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

---

**지난 글:** [에러 모니터링 — Sentry로 프로덕션 오류 추적하기](/posts/next-error-monitoring/)

**다음 글:** [E2E 테스트 — Playwright로 전체 흐름 검증하기](/posts/next-e2e-testing/)

<br>
읽어주셔서 감사합니다. 😊
