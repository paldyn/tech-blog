---
title: "MSW로 API 모킹하기 — 네트워크 레벨 테스트"
description: "Mock Service Worker(MSW)로 컴포넌트의 데이터 페칭을 테스트하는 방법을 다룹니다. fetch 모킹의 한계, setupServer와 핸들러 작성, server.use를 통한 테스트별 오버라이드, 에러·지연 시나리오 테스트까지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 8
type: "knowledge"
category: "React"
tags: ["MSW", "모킹", "테스트", "API", "MockServiceWorker"]
featured: false
draft: false
---

[지난 글](/posts/react-user-event/)에서 사용자 상호작용을 충실하게 재현하는 방법을 다뤘다. 그런데 실제 컴포넌트는 대부분 어딘가에서 데이터를 가져온다. 테스트에서 진짜 API를 호출할 수는 없으니 모킹이 필요한데, **어느 층에서 모킹하느냐**가 테스트의 품질을 좌우한다. `fetch` 함수 자체를 모킹하는 흔한 방식에는 함정이 있고, **MSW(Mock Service Worker)**는 그 함정을 네트워크 레벨 가로채기로 해결한다.

## fetch 모킹의 문제

전통적인 접근은 전역 fetch를 가짜 함수로 바꿔치기하는 것이다.

```tsx
// 흔하지만 취약한 방식
vi.spyOn(global, 'fetch').mockResolvedValue({
  ok: true,
  json: async () => ({ name: '김개발' }),
} as Response);
```

이 방식의 문제는 **구현 세부에 결합**된다는 것이다. 컴포넌트가 fetch에서 axios로 바뀌면 테스트가 전부 깨진다. URL이 맞는지, 메서드가 맞는지, 쿼리 파라미터가 맞는지 검증하려면 mock 호출 인자를 일일이 뒤져야 한다. Response 객체를 손으로 흉내 내다 보면 실제 응답과 미묘하게 다른 가짜를 만들기도 쉽다.

MSW는 접근을 뒤집는다. 요청 코드는 건드리지 않고, **네트워크 계층에서 요청을 가로채** 정의된 응답을 돌려준다.

![MSW 요청 가로채기 구조](/assets/posts/react-mocking-msw-architecture.svg)

앱 코드는 자신이 모킹된 환경인지 전혀 모른다. fetch든 axios든, 어떤 HTTP 클라이언트든 동일하게 동작한다.

## 핸들러 정의

핸들러는 "이 요청이 오면 이렇게 응답하라"는 선언이다. Express 라우트와 비슷한 모양이다.

```ts
// src/test/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/posts', () => {
    return HttpResponse.json([
      { id: 1, title: '첫 번째 글' },
      { id: 2, title: '두 번째 글' },
    ]);
  }),

  http.get('/api/posts/:id', ({ params }) => {
    return HttpResponse.json({
      id: Number(params.id),
      title: `${params.id}번 글`,
    });
  }),

  http.post('/api/posts', async ({ request }) => {
    const body = (await request.json()) as { title: string };
    return HttpResponse.json({ id: 3, ...body }, { status: 201 });
  }),
];
```

## 테스트 환경 연결 — setupServer

Node 테스트 환경에서는 Service Worker가 없으므로 `setupServer`를 쓴다. API는 동일하다.

```ts
// src/test/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

```ts
// src/test/setup.ts (vitest setupFiles)
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './server';

beforeAll(() =>
  // 핸들러에 없는 요청은 에러로 — 빠뜨린 모킹을 즉시 발견
  server.listen({ onUnhandledRequest: 'error' })
);
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

이제 컴포넌트 테스트는 모킹 코드 없이 깨끗해진다.

```tsx
test('글 목록을 불러와 표시한다', async () => {
  render(<PostList />);

  // MSW가 응답을 돌려줄 때까지 findBy로 대기
  expect(await screen.findByText('첫 번째 글')).toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
});
```

## 테스트별 오버라이드 — server.use

성공 응답은 전역 핸들러로 충분하지만, 에러 화면 테스트는 그 테스트에서만 응답을 바꿔야 한다. `server.use`는 기존 핸들러 위에 **임시 핸들러를 덮어씌운다**.

![테스트에서의 MSW 생명주기](/assets/posts/react-mocking-msw-lifecycle.svg)

```tsx
import { http, HttpResponse } from 'msw';
import { server } from '../test/server';

test('서버 에러 시 에러 메시지를 보여준다', async () => {
  // 이 테스트에서만 500 응답
  server.use(
    http.get('/api/posts', () =>
      HttpResponse.json({ message: '서버 오류' }, { status: 500 })
    )
  );

  render(<PostList />);

  expect(
    await screen.findByText('목록을 불러오지 못했습니다')
  ).toBeInTheDocument();
});

test('다음 테스트는 다시 정상 응답을 받는다', async () => {
  // afterEach의 resetHandlers() 덕분에 오버라이드가 남지 않는다
  render(<PostList />);
  expect(await screen.findByText('첫 번째 글')).toBeInTheDocument();
});
```

`afterEach(() => server.resetHandlers())`가 격리의 핵심이다. 이 한 줄이 없으면 앞 테스트의 에러 핸들러가 뒤 테스트로 새어 나간다.

## 네트워크 시나리오 재현

네트워크 레벨에서 가로채기 때문에 다양한 상황을 사실적으로 흉내 낼 수 있다.

```ts
import { http, HttpResponse, delay } from 'msw';

// 로딩 스피너 테스트 — 응답 지연
http.get('/api/posts', async () => {
  await delay(200);
  return HttpResponse.json([]);
});

// 네트워크 단절
http.get('/api/posts', () => HttpResponse.error());

// 인증 실패
http.get('/api/me', () =>
  HttpResponse.json({ message: '인증 필요' }, { status: 401 })
);

// 빈 목록 — 의외로 자주 빠뜨리는 경계 상태
http.get('/api/posts', () => HttpResponse.json([]));
```

## 요청 내용 검증이 필요할 때

"올바른 본문으로 POST했는가"를 검증하고 싶다면, 핸들러 안에서 받은 요청을 검사하기보다 **응답이 화면에 미친 결과**로 검증하는 것이 RTL 철학에 부합한다. 그래도 요청 자체를 확인해야 한다면 핸들러에서 본문을 조건 분기하면 된다.

```ts
http.post('/api/login', async ({ request }) => {
  const { email, password } = (await request.json()) as LoginBody;

  if (email === 'dev@paldyn.com' && password === 'correct') {
    return HttpResponse.json({ token: 'abc' });
  }
  return HttpResponse.json({ message: '잘못된 인증 정보' }, { status: 401 });
});
```

올바른 인증 정보면 성공 화면, 아니면 에러 메시지 — 테스트는 두 시나리오의 화면 결과만 단언하면 된다.

## 개발 서버에서도 재사용

MSW의 또 다른 장점은 같은 핸들러를 **브라우저 개발 환경에서도** 쓸 수 있다는 것이다. `setupWorker`로 등록하면 백엔드가 준비되지 않아도 프런트엔드를 개발할 수 있고, Storybook에서도 동일한 목 데이터를 공유할 수 있다.

지금까지 컴포넌트 단위의 테스트를 다뤘다. 그런데 로직이 컴포넌트가 아니라 **커스텀 훅**에 들어 있다면 어떻게 테스트할까? 다음 글에서 renderHook을 다룬다.

---

**지난 글:** [user-event — 실제 사용자처럼 상호작용 테스트하기](/posts/react-user-event/)

**다음 글:** [커스텀 훅 테스트하기 — renderHook 완전 가이드](/posts/react-testing-hooks/)

<br>
읽어주셔서 감사합니다. 😊
