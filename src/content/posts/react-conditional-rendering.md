---
title: "조건부 렌더링 — 삼항 연산자부터 얼리 리턴까지"
description: "if/else 얼리 리턴, 삼항 연산자, && 단축 평가, JSX 변수 패턴까지 React 조건부 렌더링의 모든 패턴과 0 렌더링 함정을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 9
type: "knowledge"
category: "React"
tags: ["조건부렌더링", "삼항연산자", "단락평가", "얼리리턴", "React", "JSX패턴"]
featured: false
draft: false
---

[지난 글](/posts/react-props-spreading/)에서 props spreading의 올바른 사용법을 살펴봤다. 실제 앱에서 UI는 거의 항상 조건에 따라 달라진다. 로그인 여부, 로딩 상태, 에러 유무에 따라 완전히 다른 화면을 보여줘야 한다. React에서 조건부 렌더링은 별도 문법이 아니라 **순수 JavaScript 조건 표현식**을 JSX 안에서 활용하는 것이다.

## 4가지 패턴

### ① if/else — 얼리 리턴

컴포넌트 함수 안에서 일반 `if` 문을 사용한다. 특히 로딩·에러 가드에 최적이다.

```jsx
function PostPage({ postId }) {
  const { data, isLoading, error } = usePost(postId);

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage message={error.message} />;

  return (
    <article>
      <h1>{data.title}</h1>
      <p>{data.body}</p>
    </article>
  );
}
```

"행복 경로"(정상 케이스)를 마지막에 두고 예외 케이스를 앞에서 처리하는 구조다. 코드가 위에서 아래로 선형적으로 읽혀 이해하기 쉽다.

### ② 삼항 연산자 — 두 가지 중 하나

JSX 안에서 인라인으로 A 또는 B를 선택할 때 쓴다.

```jsx
function AuthButton({ isLoggedIn }) {
  return (
    <header>
      <h1>My App</h1>
      {isLoggedIn ? (
        <button onClick={logout}>로그아웃</button>
      ) : (
        <button onClick={login}>로그인</button>
      )}
    </header>
  );
}
```

두 가지 분기가 명확할 때 적합하다. 중첩 삼항 연산자는 가독성을 급격히 떨어뜨리므로 피해야 한다.

### ③ && 단축 평가 — 있거나 없거나

조건이 참일 때만 무언가를 렌더하고, 거짓이면 아무것도 렌더하지 않을 때 쓴다.

```jsx
function Notification({ hasNew }) {
  return (
    <div>
      <span>알림</span>
      {hasNew && <span className="badge">새 알림</span>}
    </div>
  );
}
```

### ④ 변수에 JSX 저장

세 가지 이상의 분기가 필요하거나 복잡한 조건 로직이 있을 때 변수에 JSX를 미리 저장한다.

```jsx
function StatusMessage({ status }) {
  let content;
  if (status === 'loading') content = <Spinner />;
  else if (status === 'error') content = <ErrorIcon />;
  else if (status === 'empty') content = <EmptyState />;
  else content = <CheckIcon />;

  return <div className="status">{content}</div>;
}
```

복잡한 로직을 JSX 반환 부분에서 분리할 수 있어 읽기 쉬워진다.

![조건부 렌더링 4가지 패턴](/assets/posts/react-conditional-patterns.svg)

## && 연산자의 함정 — 0이 화면에 나타난다

`&&` 단축 평가를 숫자나 빈 문자열에 사용하면 예상치 못한 결과가 생긴다.

```jsx
const count = 0;

// ❌ 잘못된 코드 — 화면에 "0"이 나타남
{count && <Badge>{count}</Badge>}

// 이유: 0 && <Badge> === 0 (false가 아니라 숫자 0)
// React는 숫자 0을 DOM에 렌더한다
```

JavaScript `&&`의 결과가 `false`이면 React가 렌더하지 않지만, `0`, `NaN`, `""` 같은 falsy 값은 **React가 텍스트 노드로 렌더**한다.

```jsx
// ✅ Boolean으로 명시적 변환
{!!count && <Badge>{count}</Badge>}

// ✅ 삼항 연산자로 명확하게
{count > 0 ? <Badge>{count}</Badge> : null}
```

![&& 연산자 함정](/assets/posts/react-conditional-pitfalls.svg)

## null과 false를 반환하면 아무것도 렌더되지 않는다

컴포넌트가 `null`이나 `false`를 반환하면 React는 DOM에 아무것도 추가하지 않는다. `undefined`를 반환하면 에러가 발생하므로 조심해야 한다.

```jsx
// null 반환 → DOM에서 완전히 제거
function Banner({ show }) {
  if (!show) return null;
  return <div className="banner">이벤트 배너</div>;
}

// undefined 반환 → ⚠️ React 에러
function Bad() {
  // return이 없으면 undefined 반환 — 에러!
}
```

## 복잡한 조건은 컴포넌트로 분리

삼항 연산자나 `&&`이 JSX 안에서 3줄 이상을 차지하거나 중첩된다면 별도 컴포넌트로 분리하는 것이 낫다.

```jsx
// ❌ 읽기 어려운 중첩 삼항
{isLoading ? <Spinner /> : error ? <Error msg={error} /> : data ? <List items={data} /> : null}

// ✅ 컴포넌트로 분리
function PostContent({ isLoading, error, data }) {
  if (isLoading) return <Spinner />;
  if (error) return <Error msg={error} />;
  if (!data) return null;
  return <List items={data} />;
}
```

## 정리

- 로딩·에러 가드에는 얼리 리턴 패턴이 가장 명확하다
- A/B 선택에는 삼항 연산자, 있거나 없거나에는 `&&` 단축 평가를 쓴다
- `&&`를 숫자/빈 문자열에 쓰면 0이나 빈 텍스트가 렌더될 수 있다. `!!` 또는 삼항으로 해결한다
- 복잡한 조건 로직은 변수나 별도 컴포넌트로 분리한다
- `null` 반환 = DOM에서 제거. `undefined` 반환 = 에러

다음 글에서는 배열 데이터를 화면에 나열하는 **목록 렌더링** 패턴을 다룬다.

---

**지난 글:** [Props Spreading — 편리함과 위험성 사이](/posts/react-props-spreading/)

**다음 글:** [목록 렌더링 — map()과 배열 처리 패턴](/posts/react-list-rendering/)

<br>
읽어주셔서 감사합니다. 😊
