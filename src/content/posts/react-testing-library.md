---
title: "React Testing Library — 사용자 관점의 테스트"
description: "React Testing Library의 철학과 기본 사용법을 다룹니다. 구현 세부가 아닌 동작을 테스트하는 이유, render와 screen, 기본 쿼리와 단언, Vitest 환경 설정, Provider 래퍼를 포함한 커스텀 render까지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 5
type: "knowledge"
category: "React"
tags: ["TestingLibrary", "테스트", "Vitest", "jsdom", "RTL"]
featured: false
draft: false
---

[지난 글](/posts/react-tanstack-query-mutations/)까지 상태 관리 도구들을 살펴보며 애플리케이션을 만드는 방법을 다뤘다. 이제 만든 것이 **제대로 동작하는지 보증하는** 방법으로 넘어간다. React 컴포넌트 테스트의 표준 도구는 **React Testing Library**(RTL)다. 이 라이브러리는 단순한 도구를 넘어 하나의 철학을 강제하는데, 그 철학을 이해하는 것이 사용법보다 중요하다.

## 철학 — 사용자가 보는 것만 테스트한다

RTL의 가이딩 원칙은 한 문장이다.

> 테스트가 소프트웨어의 실제 사용 방식을 닮을수록, 더 큰 확신을 준다.

사용자는 컴포넌트의 state 값이 몇인지, 어떤 메서드가 호출됐는지 모른다. 화면에 보이는 텍스트를 읽고, 버튼을 클릭하고, 결과를 확인할 뿐이다. 테스트도 똑같이 해야 한다.

![구현이 아니라 동작을 테스트한다](/assets/posts/react-testing-library-philosophy.svg)

구현 세부에 묶인 테스트는 두 가지 방식으로 배신한다. 동작이 그대로인데 내부 구조만 바꿨을 때 깨지고(거짓 음성), 내부 값은 맞는데 화면이 잘못 그려졌을 때 통과한다(거짓 양성). RTL은 애초에 내부에 접근할 방법을 제공하지 않음으로써 이 함정을 차단한다.

## 환경 설정 — Vitest + jsdom

Vite 프로젝트 기준으로 설정해 보자.

```bash
npm i -D vitest jsdom @testing-library/react \
  @testing-library/jest-dom @testing-library/user-event
```

```ts
// vite.config.ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',        // 브라우저 없이 DOM API 제공
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
});
```

```ts
// src/test/setup.ts
import '@testing-library/jest-dom/vitest';
// toBeInTheDocument, toBeVisible 같은 DOM 매처가 추가된다
```

## 첫 번째 테스트

카운터 컴포넌트를 테스트해 보자.

```tsx
// Counter.tsx
export function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div>
      <p>현재 값: {count}</p>
      <button onClick={() => setCount((c) => c + 1)}>증가</button>
    </div>
  );
}
```

```tsx
// Counter.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Counter } from './Counter';

test('증가 버튼을 누르면 카운트가 올라간다', async () => {
  const user = userEvent.setup();
  render(<Counter />);

  // 사용자가 찾는 방식으로 요소를 찾는다
  const button = screen.getByRole('button', { name: '증가' });

  await user.click(button);
  await user.click(button);

  expect(screen.getByText('현재 값: 2')).toBeInTheDocument();
});
```

테스트의 구조는 항상 같다.

![테스트의 네 단계](/assets/posts/react-testing-library-flow.svg)

1. **render** — jsdom에 컴포넌트를 마운트한다
2. **query** — `screen`으로 사용자가 보는 방식으로 요소를 찾는다
3. **interact** — `userEvent`로 클릭·입력을 재현한다
4. **assert** — 화면에 보이는 결과를 단언한다

어디에도 `count` state를 직접 들여다보는 코드가 없다. 내일 이 컴포넌트를 `useReducer`로 리팩터링해도 테스트는 그대로 통과한다.

## screen과 기본 쿼리

`render`가 반환하는 쿼리 함수들도 있지만, 전역 `screen` 객체를 쓰는 것이 권장된다.

```tsx
import { render, screen } from '@testing-library/react';

render(<LoginForm />);

// role로 찾기 — 가장 권장
screen.getByRole('textbox', { name: '이메일' });
screen.getByRole('button', { name: '로그인' });

// 레이블로 찾기 — 폼 필드에 적합
screen.getByLabelText('비밀번호');

// 텍스트로 찾기 — 비인터랙티브 요소
screen.getByText('계정이 없으신가요?');
```

요소를 못 찾으면 `getBy*`는 **현재 DOM 전체를 출력하며 실패**한다. 이 에러 메시지가 매우 친절해서, 무엇이 렌더링되어 있는지 바로 확인할 수 있다.

## 비동기 UI — findBy와 waitFor

데이터 로딩처럼 시간이 걸리는 UI는 `findBy*`(폴링하며 기다리는 쿼리)나 `waitFor`로 다룬다.

```tsx
test('로딩 후 사용자 이름이 표시된다', async () => {
  render(<UserProfile userId={1} />);

  // 처음에는 로딩 표시
  expect(screen.getByText('불러오는 중...')).toBeInTheDocument();

  // findBy*는 요소가 나타날 때까지 기다린다 (기본 1초)
  expect(await screen.findByText('김개발')).toBeInTheDocument();

  // 로딩 표시는 사라졌는지 — 없음을 확인할 때는 queryBy*
  expect(screen.queryByText('불러오는 중...')).not.toBeInTheDocument();
});
```

`getBy`/`queryBy`/`findBy`의 선택 기준은 다음 글에서 깊이 다룬다.

## Provider가 필요한 컴포넌트 — 커스텀 render

실제 컴포넌트는 Router, QueryClient, 테마 Context 등에 의존하는 경우가 많다. 매 테스트마다 Provider를 감싸는 대신, 래퍼가 포함된 커스텀 render를 만들어 둔다.

```tsx
// src/test/test-utils.tsx
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

function AllProviders({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },  // 테스트에선 재시도 끔
  });
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

function customRender(ui: React.ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export * from '@testing-library/react';
export { customRender as render };
```

이후 테스트에서는 `@testing-library/react` 대신 `test-utils`에서 import하면 된다.

## 무엇을 테스트할 것인가

컴포넌트 테스트에서 가치가 높은 것부터 나열하면 이렇다.

- 사용자 인터랙션의 결과 (클릭하면 무엇이 보이는가)
- 조건부 렌더링 (권한·상태에 따라 무엇이 보이고 숨는가)
- 폼 입력과 검증 메시지
- 에러·로딩·빈 목록 같은 경계 상태

반대로 스냅샷 남발, 스타일 검사, 내부 함수 호출 횟수 단언은 유지보수 비용만 키우는 경우가 대부분이다.

다음 글에서는 RTL의 심장인 **쿼리 시스템**을 해부한다. `getByRole`이 왜 항상 1순위인지, 쿼리 우선순위가 접근성과 어떻게 연결되는지 살펴본다.

---

**지난 글:** [TanStack Query Mutations — 데이터 변경과 낙관적 업데이트](/posts/react-tanstack-query-mutations/)

**다음 글:** [Testing Library 쿼리 완전 정리 — getBy, queryBy, findBy](/posts/react-rtl-queries/)

<br>
읽어주셔서 감사합니다. 😊
