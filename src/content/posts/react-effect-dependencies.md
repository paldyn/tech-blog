---
title: "의존성 배열 — Object.is 비교와 흔한 함정들"
description: "useEffect의 의존성 배열이 Object.is()로 비교되는 원리, 객체·함수·배열이 매 렌더마다 새 참조를 만드는 문제, 무한 루프 패턴과 해결책, exhaustive-deps 경고를 올바르게 해소하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 10
type: "knowledge"
category: "React"
tags: ["React", "useEffect", "의존성배열", "ObjectIs", "무한루프", "useMemo", "useCallback", "ESLint"]
featured: false
draft: false
---

[지난 글](/posts/react-useeffect/)에서 useEffect의 목적과 cleanup 패턴을 다뤘다. 이번에는 useEffect에서 가장 많은 버그를 만들어내는 **의존성 배열**을 깊이 파고든다. 의존성 배열이 어떻게 비교되는지 정확히 이해하면 무한 루프와 stale closure 버그를 예방할 수 있다.

## 의존성 배열이 하는 일

React는 매 렌더 후 의존성 배열의 값들을 **이전 렌더의 값들과 비교**한다. 하나라도 달라졌다면 effect를 다시 실행한다.

```jsx
useEffect(() => {
  document.title = `${name} - ${count}`;
}, [name, count]);

// 렌더 1: name="홍길동", count=0
// 렌더 2: name="홍길동", count=1
// → count가 달라짐 → effect 재실행

// 렌더 3: name="홍길동", count=1
// → 아무것도 달라지지 않음 → effect 스킵
```

![의존성 배열 — 3가지 형태](/assets/posts/react-effect-dependencies-array.svg)

## Object.is() 비교

비교 방식은 `Object.is()`다. 원시값과 참조값의 동작이 다르다.

```javascript
// 원시값 — 값으로 비교
Object.is(5, 5)       // true — 같음
Object.is('abc', 'abc') // true — 같음
Object.is(null, null)   // true — 같음

// 참조값 — 참조로 비교
Object.is({a: 1}, {a: 1}) // false — 다른 객체
Object.is([1,2], [1,2])   // false — 다른 배열
Object.is(() => {}, () => {}) // false — 다른 함수
```

문제는 React 컴포넌트가 렌더링될 때마다 함수 안에 선언된 객체, 배열, 함수가 **새 참조로 생성**된다는 것이다.

```jsx
function Component({ userId }) {
  // 매 렌더마다 새 options 객체 생성!
  const options = { userId, limit: 10 };

  useEffect(() => {
    fetchData(options);
  }, [options]); // options는 매번 새 참조 → 매 렌더마다 실행
}
```

## 무한 루프 패턴

가장 흔한 실수는 effect 안에서 state를 업데이트하고, 그 state가 의존성에 있는 경우다.

```jsx
// 무한 루프 예시 1 — state 업데이트가 재실행 유발
function Component() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchData().then(result => {
      setData(result); // data 변경 → effect 재실행 → 무한
    });
  }, [data]); // data가 의존성인데 안에서 data를 바꿈
}

// 해결: 의존성에서 data 제거 (빈 배열로)
useEffect(() => {
  fetchData().then(setData);
}, []); // 마운트 1회만
```

```jsx
// 무한 루프 예시 2 — 객체 의존성
function Component() {
  const [items, setItems] = useState([]);
  const config = { endpoint: '/api/items' }; // 매 렌더마다 새 객체

  useEffect(() => {
    fetch(config.endpoint).then(res => res.json()).then(setItems);
  }, [config]); // config는 항상 "다름" → 무한 실행
}
```

![의존성 배열 흔한 함정](/assets/posts/react-effect-dependencies-pitfalls.svg)

## 해결책 1: 원시값으로 분해

객체/배열 대신 필요한 값만 의존성으로 넣는다.

```jsx
function Component({ config }) {
  const { endpoint, limit } = config; // 원시값으로 분해

  useEffect(() => {
    fetch(`${endpoint}?limit=${limit}`).then(...);
  }, [endpoint, limit]); // 원시값 비교 → 실제 값이 바뀔 때만 재실행
}
```

## 해결책 2: useMemo로 참조 안정화

객체나 배열을 의존성으로 써야 할 때 `useMemo`로 참조를 안정화한다.

```jsx
function Component({ userId, limit }) {
  const options = useMemo(
    () => ({ userId, limit }), // userId나 limit이 바뀔 때만 새 객체 생성
    [userId, limit]
  );

  useEffect(() => {
    fetchData(options);
  }, [options]); // options 참조가 안정적
}
```

## 해결책 3: useCallback으로 함수 참조 안정화

함수를 의존성으로 쓰거나 effect 안에서 호출하는 함수가 매 렌더 재생성될 때 `useCallback`을 사용한다.

```jsx
function Component({ onSuccess }) {
  // onSuccess가 매 렌더 새 참조면 effect가 계속 재실행됨
  const stableOnSuccess = useCallback(onSuccess, [onSuccess]);

  useEffect(() => {
    fetchData().then(stableOnSuccess);
  }, [stableOnSuccess]);
}
```

## exhaustive-deps 경고 올바르게 해소하기

eslint의 `exhaustive-deps` 경고는 effect 안에서 사용하지만 의존성 배열에 빠진 값을 알려준다.

```jsx
// 경고: 'userId'가 의존성 배열에 빠져있음
useEffect(() => {
  fetchUser(userId); // userId를 사용하지만
}, []); // 의존성 배열에 없음

// 해결 방법 1: 의존성 추가 (권장)
useEffect(() => {
  fetchUser(userId);
}, [userId]);

// 해결 방법 2: 함수를 effect 안으로 이동
useEffect(() => {
  function load() { fetchUser(userId); } // 의존성이 필요 없어짐
  load();
}, [userId]);
```

**경고를 eslint-disable로 무시하는 것은 최후의 수단**이다. 대부분의 경우 코드 구조를 바꾸면 경고를 제거하면서도 올바른 동작을 얻을 수 있다.

## 황금 규칙

> effect 안에서 사용하는 모든 **반응형 값**(state, props, 컴포넌트 안에 선언된 변수)은 의존성 배열에 넣어야 한다.

의존성 배열에 거짓말하면(실제로 사용하는 값을 빼면) **stale closure** 버그가 생긴다. effect가 오래된 값을 참조하면서 잘못 동작한다.

```jsx
function Counter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setCount(count + 1); // count가 항상 0 — stale closure!
    }, 1000);
    return () => clearInterval(id);
  }, []); // count를 사용하지만 의존성에 없음

  // 해결: 함수형 업데이트 사용 (현재 값을 직접 참조)
  useEffect(() => {
    const id = setInterval(() => {
      setCount(c => c + 1); // 현재 값 기반 업데이트
    }, 1000);
    return () => clearInterval(id);
  }, []); // count 의존성 불필요
}
```

---

**지난 글:** [useEffect — 부수효과와 외부 시스템 동기화](/posts/react-useeffect/)

**다음 글:** [Effect cleanup — 언마운트와 재실행 전 정리](/posts/react-effect-cleanup/)

<br>
읽어주셔서 감사합니다. 😊
