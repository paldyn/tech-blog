---
title: "useLocalStorage 커스텀 훅 — 브라우저 저장소 연동"
description: "localStorage를 React 상태처럼 쓸 수 있는 useLocalStorage 훅을 단계별로 구현합니다. 지연 초기화, JSON 직렬화, 함수형 업데이트, 탭 간 동기화까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 5
type: "knowledge"
category: "React"
tags: ["React", "커스텀훅", "localStorage", "useLocalStorage", "브라우저저장소"]
featured: false
draft: false
---

[지난 글](/posts/react-custom-hooks/)에서 커스텀 훅의 기본 개념과 설계 방법을 배웠다. 이번에는 실무에서 가장 자주 쓰이는 커스텀 훅 중 하나인 `useLocalStorage`를 처음부터 구현한다.

## 왜 useLocalStorage가 필요한가

`localStorage`를 직접 쓰면 컴포넌트 코드가 지저분해진다.

```jsx
// 직접 localStorage 쓸 때 매번 이런 코드 반복
function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('theme') ?? 'dark';
    } catch {
      return 'dark';
    }
  });

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
  }

  return <button onClick={toggle}>{theme}</button>;
}
```

이 패턴이 여러 컴포넌트에 반복된다. `useLocalStorage` 훅으로 추상화하면 단 한 줄로 줄어든다.

## 기본 구현

![useLocalStorage 동작 원리](/assets/posts/react-use-localstorage-concept.svg)

```jsx
function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setStoredValue = useCallback((newValue) => {
    try {
      const v = newValue instanceof Function ? newValue(value) : newValue;
      setValue(v);
      localStorage.setItem(key, JSON.stringify(v));
    } catch (e) {
      console.warn(`useLocalStorage: key="${key}" 쓰기 실패`, e);
    }
  }, [key, value]);

  return [value, setStoredValue];
}
```

두 가지 핵심 설계 결정이 있다.

**1. 지연 초기화(lazy initializer)**: `useState(() => ...)` 형태로 초기화 함수를 전달한다. 컴포넌트가 처음 마운트될 때만 실행되므로, 매 렌더마다 `localStorage.getItem`을 호출하는 낭비가 없다.

**2. JSON 직렬화/역직렬화**: `localStorage`는 문자열만 저장할 수 있다. `JSON.stringify`/`JSON.parse`로 객체, 배열, 숫자, 불리언도 저장한다.

## 함수형 업데이트 지원

`useState`의 setter는 함수형 업데이트(`prev => next`)를 지원한다. `useLocalStorage`도 동일한 인터페이스를 제공해야 한다.

```jsx
const v = newValue instanceof Function ? newValue(value) : newValue;
```

이 한 줄이 함수형 업데이트를 처리한다. `newValue`가 함수면 현재 값을 인수로 호출하고, 아니면 그대로 사용한다.

```jsx
const [count, setCount] = useLocalStorage('count', 0);

// 직접 값 설정
setCount(5);

// 함수형 업데이트 — 현재 값 기반으로 증가
setCount(c => c + 1);
```

## 탭 간 동기화와 삭제 기능

![useLocalStorage 고급 기능](/assets/posts/react-use-localstorage-advanced.svg)

브라우저는 **같은 도메인의 다른 탭**에서 `localStorage`가 변경되면 `storage` 이벤트를 발생시킨다. 이를 구독하면 탭 간 동기화가 가능하다.

```jsx
function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setStoredValue = useCallback((newValue) => {
    try {
      const v = newValue instanceof Function ? newValue(value) : newValue;
      setValue(v);
      localStorage.setItem(key, JSON.stringify(v));
    } catch (e) {
      console.warn(`useLocalStorage: "${key}" 쓰기 실패`, e);
    }
  }, [key, value]);

  const removeValue = useCallback(() => {
    localStorage.removeItem(key);
    setValue(defaultValue);
  }, [key, defaultValue]);

  // 다른 탭에서 변경 시 동기화
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== key) return;
      try {
        setValue(e.newValue !== null ? JSON.parse(e.newValue) : defaultValue);
      } catch {
        setValue(defaultValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key, defaultValue]);

  return [value, setStoredValue, removeValue];
}
```

## 사용 예시

```jsx
function App() {
  const [theme, setTheme, removeTheme] = useLocalStorage('theme', 'dark');
  const [user, setUser] = useLocalStorage('user', null);

  return (
    <div data-theme={theme}>
      <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>
        테마 전환
      </button>
      <button onClick={removeTheme}>
        테마 리셋
      </button>
      {user && <p>{user.name}님 환영합니다</p>}
    </div>
  );
}
```

## SSR 주의사항

Next.js 등 서버 사이드 렌더링 환경에서는 `localStorage`가 서버에 없으므로 `ReferenceError`가 발생한다.

```jsx
function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return defaultValue; // SSR 안전 처리
    try {
      const item = localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  });
  // ...
}
```

---

**지난 글:** [커스텀 훅 만들기 — 로직을 훅으로 분리하는 법](/posts/react-custom-hooks/)

**다음 글:** [useDebounce 커스텀 훅 — 입력 최적화](/posts/react-use-debounce/)

<br>
읽어주셔서 감사합니다. 😊
