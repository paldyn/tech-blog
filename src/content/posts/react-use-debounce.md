---
title: "useDebounce 커스텀 훅 — 입력 최적화"
description: "useDebounce 훅의 원리와 구현, debounce와 throttle의 차이, 검색 자동완성 구현 예제, 그리고 useCallback 버전 useDebouncedCallback까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 6
type: "knowledge"
category: "React"
tags: ["React", "커스텀훅", "useDebounce", "debounce", "성능최적화", "검색"]
featured: false
draft: false
---

[지난 글](/posts/react-use-localstorage/)에서 브라우저 저장소와 상태를 동기화하는 훅을 만들었다. 이번에는 사용자 입력을 최적화하는 `useDebounce` 훅을 구현한다. 검색창에서 키를 누를 때마다 API를 호출하면 서버에 과부하가 걸린다. Debounce로 마지막 입력 이후 일정 시간 뒤에만 호출하도록 제한한다.

## Debounce 원리

Debounce는 "연속 이벤트가 발생해도 마지막 이벤트 이후 특정 시간이 지났을 때만 처리"하는 기법이다.

![useDebounce 동작 원리](/assets/posts/react-use-debounce-concept.svg)

구현 원리는 간단하다. `value`가 바뀔 때마다 타이머를 설정하되, 이전 타이머를 먼저 취소한다. 타이머가 만료될 때까지 `value`가 바뀌지 않으면 그때 debouncedValue를 업데이트한다.

```jsx
function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // cleanup: 새 value가 오면 이전 타이머 취소
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
```

`useEffect`의 cleanup 함수가 핵심이다. `value`가 바뀌면 React는 이전 Effect를 정리(cleanup)하고 새 Effect를 실행한다. 정리 단계에서 `clearTimeout`이 호출되어 이전 타이머가 취소된다. 따라서 `delay`ms 동안 입력이 없을 때만 마지막 타이머가 만료되고 `debouncedValue`가 업데이트된다.

## 검색 자동완성 구현

```jsx
function SearchBox() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 400);
  const { data: results, isLoading } = useFetch(
    debouncedQuery ? `/api/search?q=${debouncedQuery}` : null
  );

  return (
    <div>
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="검색어 입력..."
      />
      {isLoading && <Spinner />}
      <ul>
        {results?.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

`query`는 키 입력마다 즉시 업데이트되어 입력창에 반영된다. `debouncedQuery`는 400ms 동안 입력이 없을 때만 업데이트되고, 그때만 API 요청이 발생한다.

## Debounce vs Throttle

![Debounce vs Throttle 비교](/assets/posts/react-use-debounce-vs-throttle.svg)

- **Debounce**: 연속 이벤트가 끝난 후 한 번만 실행. 검색 자동완성, 폼 유효성 검사에 적합.
- **Throttle**: 일정 간격마다 실행, 중간 이벤트는 무시. 스크롤 핸들러, 드래그 추적에 적합.

## useDebouncedCallback — 함수 버전

값 대신 함수를 debounce해야 할 때 사용한다.

```jsx
function useDebouncedCallback(callback, delay = 300) {
  const callbackRef = useRef(callback);
  const timerRef = useRef(null);

  // 최신 콜백을 항상 유지 (불필요한 deps 없이)
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedFn = useCallback((...args) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return debouncedFn;
}
```

`useRef`로 최신 콜백을 보관하는 패턴이 중요하다. `delay`만 deps에 포함하면 되므로 콜백이 바뀌어도 debounced 함수가 재생성되지 않는다.

```jsx
function AutoSave({ data }) {
  const saveToServer = useDebouncedCallback(async (payload) => {
    await fetch('/api/save', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }, 1000);

  // data가 바뀔 때마다 호출하지만, 1초 동안 변경이 없을 때만 실제 저장
  useEffect(() => {
    saveToServer(data);
  }, [data, saveToServer]);

  return <div>자동 저장 중...</div>;
}
```

---

**지난 글:** [useLocalStorage 커스텀 훅 — 브라우저 저장소 연동](/posts/react-use-localstorage/)

**다음 글:** [useFetch 커스텀 훅 — 데이터 페칭 완전 캡슐화](/posts/react-use-fetch/)

<br>
읽어주셔서 감사합니다. 😊
