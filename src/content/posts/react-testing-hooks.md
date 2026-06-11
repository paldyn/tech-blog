---
title: "커스텀 훅 테스트하기 — renderHook 완전 가이드"
description: "renderHook으로 커스텀 훅을 단독 테스트하는 방법을 다룹니다. result.current의 의미, act로 상태 업데이트 감싸기, rerender와 unmount, wrapper로 Provider 주입, 타이머·비동기 훅 테스트 패턴까지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 9
type: "knowledge"
category: "React"
tags: ["renderHook", "커스텀훅", "테스트", "act", "TestingLibrary"]
featured: false
draft: false
---

[지난 글](/posts/react-mocking-msw/)에서 MSW로 네트워크까지 통제하는 방법을 다뤘다. 그런데 잘 설계된 React 코드일수록 로직은 컴포넌트가 아니라 **커스텀 훅**에 모여 있다. `useDebounce`, `useLocalStorage`, `usePagination` 같은 훅들은 여러 컴포넌트에서 재사용되므로, 훅 자체를 직접 테스트해 두면 효율이 높다. 문제는 훅이 컴포넌트 밖에서 호출될 수 없다는 것인데, `renderHook`이 이 제약을 우회해 준다.

## renderHook — 훅을 위한 render

훅을 테스트 코드에서 그냥 호출하면 "Invalid hook call" 에러가 난다. Rules of Hooks에 따라 훅은 컴포넌트 렌더링 중에만 실행될 수 있기 때문이다. `renderHook`은 **보이지 않는 테스트 컴포넌트를 만들어 그 안에서 훅을 호출**해 준다.

![renderHook의 동작 원리](/assets/posts/react-testing-hooks-renderhook.svg)

```tsx
// useCounter.ts
export function useCounter(initial = 0) {
  const [count, setCount] = useState(initial);
  const increment = useCallback(() => setCount((c) => c + 1), []);
  const reset = useCallback(() => setCount(initial), [initial]);
  return { count, increment, reset };
}
```

```tsx
// useCounter.test.ts
import { renderHook, act } from '@testing-library/react';
import { useCounter } from './useCounter';

test('초기값으로 시작한다', () => {
  const { result } = renderHook(() => useCounter(5));
  expect(result.current.count).toBe(5);
});
```

`result.current`는 훅의 **가장 최근 반환값을 가리키는 살아 있는 참조**다. 리렌더링될 때마다 갱신되므로, 항상 `result.current.xxx` 형태로 접근해야 한다.

## act — 상태 업데이트 감싸기

훅이 반환한 함수로 상태를 바꿀 때는 `act`로 감싼다.

![상태 업데이트와 act](/assets/posts/react-testing-hooks-act.svg)

```tsx
test('increment가 카운트를 올린다', () => {
  const { result } = renderHook(() => useCounter());

  act(() => {
    result.current.increment();
  });

  expect(result.current.count).toBe(1);
});
```

`act`는 "이 콜백 안에서 일어난 상태 업데이트와 그로 인한 리렌더링을 모두 처리한 뒤에 다음으로 진행하라"는 의미다. 빼먹으면 경고와 함께 단언 시점에 갱신이 반영되지 않을 수 있다.

여기서 초보자가 자주 빠지는 함정이 있다.

```tsx
// ❌ 잘못된 코드 — 구조 분해로 미리 꺼내면 stale 값
const { count, increment } = result.current;
act(() => increment());
expect(count).toBe(1);   // 실패! count는 여전히 0

// ✅ 항상 result.current를 통해 접근
act(() => result.current.increment());
expect(result.current.count).toBe(1);
```

`count`는 구조 분해 시점의 원시값 복사본이다. 리렌더링되어도 그 변수는 갱신되지 않는다.

## rerender — 인자가 바뀌는 시나리오

훅의 인자(컴포넌트로 치면 props)가 바뀔 때의 동작은 `initialProps`와 `rerender`로 검증한다.

```tsx
// useDebounce.test.ts
import { renderHook } from '@testing-library/react';
import { useDebounce } from './useDebounce';

test('지연 시간 안의 변경은 무시된다', () => {
  vi.useFakeTimers();

  const { result, rerender } = renderHook(
    ({ value, delay }) => useDebounce(value, delay),
    { initialProps: { value: 'a', delay: 500 } }
  );

  expect(result.current).toBe('a');

  // 값이 바뀌어도 즉시 반영되지 않는다
  rerender({ value: 'ab', delay: 500 });
  expect(result.current).toBe('a');

  // 500ms 경과 후 반영
  act(() => {
    vi.advanceTimersByTime(500);
  });
  expect(result.current).toBe('ab');

  vi.useRealTimers();
});
```

타이머 기반 훅은 `vi.useFakeTimers()`로 시간을 직접 제어한다. 실제로 500ms를 기다리는 테스트는 느리고 불안정하다.

## unmount — 클린업 검증

구독 해제나 타이머 정리는 `unmount`로 검증한다.

```tsx
test('언마운트 시 이벤트 리스너를 제거한다', () => {
  const removeSpy = vi.spyOn(window, 'removeEventListener');

  const { unmount } = renderHook(() => useWindowSize());
  unmount();

  expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
});
```

## wrapper — Context에 의존하는 훅

`useContext`나 TanStack Query 기반 훅은 Provider가 필요하다. `wrapper` 옵션으로 주입한다.

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

test('사용자 데이터를 가져온다', async () => {
  // MSW가 /api/user 요청을 처리한다고 가정
  const { result } = renderHook(() => useUser(1), {
    wrapper: createWrapper(),
  });

  // 비동기 결과는 waitFor로 기다린다
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.name).toBe('김개발');
});
```

비동기 훅의 단언은 `waitFor`로 감싼다. `result.current`가 원하는 상태가 될 때까지 폴링해 준다.

## 훅 테스트 vs 컴포넌트 테스트 — 선택 기준

모든 훅을 `renderHook`으로 테스트해야 하는 것은 아니다.

- **재사용 유틸 훅**(useDebounce, useLocalStorage 등): 훅 단독 테스트가 적합하다. 여러 경계 조건을 빠르게 검증할 수 있다
- **특정 컴포넌트 전용 훅**(useCheckoutForm 등): 그 컴포넌트의 테스트로 충분한 경우가 많다. 사용자 관점 동작이 이미 검증된다면 훅을 따로 테스트하는 것은 중복이다

"훅을 쓰는 컴포넌트가 하나뿐이라면 컴포넌트를 테스트하고, 여럿이라면 훅을 테스트한다"가 실용적인 기준이다.

테스트 시리즈의 마지막 주제가 남았다. 컴포넌트를 격리된 환경에서 개발하고, 살아 있는 문서로 만들고, 인터랙션 테스트까지 수행하는 도구 — 다음 글에서 Storybook을 다루며 React 완전 정복 시리즈를 마무리한다.

---

**지난 글:** [MSW로 API 모킹하기 — 네트워크 레벨 테스트](/posts/react-mocking-msw/)

**다음 글:** [Storybook — 컴포넌트 주도 개발과 문서화](/posts/react-storybook/)

<br>
읽어주셔서 감사합니다. 😊
