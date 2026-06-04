---
title: "Effect 경쟁 조건 — 오래된 응답이 나중에 도착할 때"
description: "useEffect에서 데이터 페칭 시 발생하는 경쟁 조건(race condition)의 원리, ignore 플래그 패턴으로 오래된 응답 무시하기, AbortController로 요청 자체 취소하기, 그리고 로딩/에러 상태 처리를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 9
type: "knowledge"
category: "React"
tags: ["React", "useEffect", "경쟁조건", "RaceCondition", "데이터페칭", "AbortController", "비동기"]
featured: false
draft: false
---

[지난 글](/posts/react-you-might-not-need-effect/)에서 Effect가 필요 없는 상황들을 살펴봤다. 이번에는 Effect가 실제로 필요한 가장 흔한 경우인 데이터 페칭에서 발생하는 **경쟁 조건(race condition)**을 다룬다. 빠르게 클릭하거나 값이 빠르게 바뀌는 환경에서 반드시 마주치는 문제다.

## 경쟁 조건이란

같은 Effect가 여러 번 실행될 때, 먼저 시작한 요청이 나중에 완료되면 오래된 데이터로 화면이 덮어씌워지는 문제다.

```jsx
// 문제가 있는 코드
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUser(userId).then(data => {
      setUser(data); // userId가 바뀐 후 이전 응답이 도착하면?
    });
  }, [userId]);
}
```

![경쟁 조건 타임라인](/assets/posts/react-effect-race-timeline.svg)

`userId`가 1 → 2로 빠르게 바뀌면:
1. userId=1 요청 시작
2. userId=2 요청 시작
3. userId=2 응답 도착 → `setUser(user2)` 화면에 userId=2 표시
4. userId=1 응답이 늦게 도착 → `setUser(user1)` 화면에 userId=1 데이터 덮어씀

userId=2를 보고 있는데 userId=1의 데이터가 표시된다.

## 해결책 1: ignore 플래그 패턴

가장 범용적인 해결책이다. cleanup 함수에서 `ignore = true`로 바꿔 이전 Effect의 콜백을 무력화한다.

![ignore 플래그 패턴 코드](/assets/posts/react-effect-race-fix.svg)

```jsx
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let ignore = false; // 이 Effect 실행 인스턴스의 플래그
    setIsLoading(true);

    fetchUser(userId)
      .then(data => {
        if (!ignore) { // cleanup이 실행됐다면 무시
          setUser(data);
          setIsLoading(false);
        }
      })
      .catch(err => {
        if (!ignore) {
          setError(err.message);
          setIsLoading(false);
        }
      });

    return () => {
      ignore = true; // userId 바뀌면 이 플래그를 true로
    };
  }, [userId]);

  if (isLoading) return <Spinner />;
  return <Profile user={user} />;
}
```

`ignore`는 각 Effect 실행마다 새로 만들어지는 로컬 변수다. cleanup이 실행되면(userId가 바뀌면) 해당 실행의 `ignore`가 `true`로 바뀌어, 이미 시작된 fetch가 완료되어도 `setUser`를 호출하지 않는다.

## 해결책 2: AbortController

`AbortController`를 써서 이전 요청 자체를 취소할 수 있다.

```jsx
useEffect(() => {
  const controller = new AbortController();

  fetch(`/api/user/${userId}`, {
    signal: controller.signal
  })
    .then(res => {
      if (!res.ok) throw new Error('요청 실패');
      return res.json();
    })
    .then(data => setUser(data))
    .catch(err => {
      if (err.name === 'AbortError') return; // 취소는 에러 아님
      setError(err.message);
    });

  return () => controller.abort(); // cleanup: 이전 요청 취소
}, [userId]);
```

`AbortController`는 브라우저의 `fetch` API와 직접 연동된다. cleanup에서 `controller.abort()`를 호출하면 진행 중인 네트워크 요청 자체가 취소되고, promise가 `AbortError`로 reject된다.

**ignore 패턴 vs AbortController:**
- `ignore`: 구현 간단, 어떤 비동기 함수에도 사용 가능, 요청은 계속 진행됨 (응답만 무시)
- `AbortController`: 네트워크 요청 자체를 취소해 불필요한 대역폭 절약, `fetch` 전용

## 로딩, 에러, 성공 상태 올바르게 관리

경쟁 조건을 막으면서 로딩/에러/성공 상태를 함께 관리하는 완성된 패턴이다.

```jsx
function useUser(userId) {
  const [state, setState] = useState({
    data: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    if (!userId) return; // userId 없으면 실행 안 함

    let ignore = false;
    setState({ data: null, isLoading: true, error: null });

    fetchUser(userId)
      .then(data => {
        if (!ignore) setState({ data, isLoading: false, error: null });
      })
      .catch(err => {
        if (!ignore) setState({ data: null, isLoading: false, error: err.message });
      });

    return () => { ignore = true; };
  }, [userId]);

  return state;
}
```

`setState`를 한 번에 객체로 업데이트해서 로딩 시작 시 data와 error를 동시에 초기화한다. 이렇게 하면 이전 사용자의 데이터가 새 사용자 로딩 중에 잠깐 보이는 문제를 방지한다.

## 빠른 입력과 디바운스

검색어처럼 빠르게 바뀌는 값에 fetch를 연결할 때는 디바운스와 함께 쓰는 것이 좋다.

```jsx
function SearchResults({ query }) {
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    let ignore = false;
    const timerId = setTimeout(() => {
      // 300ms 후에야 fetch 시작 (디바운스)
      fetchSearch(query).then(data => {
        if (!ignore) setResults(data);
      });
    }, 300);

    return () => {
      clearTimeout(timerId); // 타이머 취소 (cleanup)
      ignore = true;          // 이미 시작된 fetch 무시
    };
  }, [query]);

  return <ul>{results.map(r => <li key={r.id}>{r.name}</li>)}</ul>;
}
```

cleanup에서 타이머와 ignore 플래그를 함께 처리한다. `query`가 빠르게 바뀌면 타이머가 계속 취소/재생성되어 마지막 입력 후 300ms 뒤에만 요청이 나간다.

---

**지난 글:** [Effect가 필요 없는 상황들](/posts/react-you-might-not-need-effect/)

**다음 글:** [AbortController로 fetch 요청 취소하기](/posts/react-abort-controller/)

<br>
읽어주셔서 감사합니다. 😊
