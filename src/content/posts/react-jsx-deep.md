---
title: "JSX 심화: 컴파일 과정과 표현식 규칙"
description: "JSX가 구 변환(React.createElement)과 신 변환(_jsx)으로 각각 어떻게 컴파일되는지, 중괄호 안에서 허용되는 표현식 규칙, 그리고 흔히 빠지는 함정을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 1
type: "knowledge"
category: "React"
tags: ["React", "JSX", "컴파일", "표현식", "Babel"]
featured: false
draft: false
---

[지난 글](/posts/react-jsx/)에서 JSX가 JavaScript로 변환된다는 사실을 확인했습니다. 이번에는 한 걸음 더 나아가, 트랜스파일러가 실제로 어떤 코드를 출력하는지, 그리고 JSX 중괄호 `{}` 안에서 정확히 무엇이 허용되고 무엇이 금지되는지 깊이 살펴봅니다.

---

## 구 변환 vs 신 변환

JSX 컴파일 방식은 React 17을 기점으로 크게 바뀌었습니다.

### React 17 이전: `React.createElement()`

```jsx
// 개발자 작성
function Greeting({ name }) {
  return <h1 className="hi">{name}</h1>;
}
```

```javascript
// 트랜스파일러 출력 (구 변환)
import React from 'react'; // 파일마다 필요!

function Greeting({ name }) {
  return React.createElement('h1', { className: 'hi' }, name);
}
```

`React` 객체가 런타임에 접근 가능해야 했기 때문에, JSX를 쓰는 파일마다 `import React from 'react'` 구문을 작성해야 했습니다. JSX는 보이지 않는 곳에서 항상 `React.createElement`를 호출하고 있었기 때문입니다.

### React 17 이후: `_jsx()` 자동 import

```javascript
// 트랜스파일러 출력 (신 변환 — 자동 삽입)
import { jsx as _jsx } from 'react/jsx-runtime';

function Greeting({ name }) {
  return _jsx('h1', { className: 'hi', children: name });
}
```

신 변환은 두 가지 이점을 가져왔습니다.

1. **`import React` 불필요** — 파일 상단에서 React를 명시적으로 import 하지 않아도 됩니다.
2. **번들 크기 감소** — `_jsx`는 `React.createElement`보다 가볍고, 개발 모드 경고도 개선됩니다.

Create React App 5 이상, Vite, Next.js는 모두 신 변환을 기본으로 사용합니다.

![JSX 심화: 구 변환 vs 신 변환](/assets/posts/react-jsx-deep-transform.svg)

---

## React Element 객체 구조

컴파일 결과가 `_jsx()`든 `React.createElement()`든, 반환 값은 동일한 **React Element 객체**(일반 JS 객체)입니다.

```javascript
// React Element의 핵심 구조
{
  $$typeof: Symbol(react.element),  // React Element임을 증명
  type: 'h1',                        // 태그명 또는 컴포넌트 함수
  props: { className: 'hi', children: 'Alice' },
  key: null,
  ref: null,
}
```

`$$typeof`는 XSS 공격 방어를 위한 Symbol 값으로, JSON에는 Symbol이 없으므로 서버에서 주입된 악성 객체가 Element로 오인될 위험을 차단합니다.

---

## JSX 중괄호 안의 표현식 규칙

JSX `{}` 안에는 **값을 만드는 표현식(expression)**만 들어갈 수 있습니다. `if`·`for` 같은 **문(statement)**은 값을 반환하지 않으므로 불가합니다.

![JSX 중괄호 안에서 쓸 수 있는 표현식](/assets/posts/react-jsx-deep-expressions.svg)

### 허용되는 표현식

```jsx
// 변수·상수
const title = '안녕하세요';
<h1>{title}</h1>

// 삼항 연산자
<span>{isLoggedIn ? '환영합니다' : '로그인 해주세요'}</span>

// &&  단락 평가 (주의: 숫자 0 렌더링 함정 있음)
{!!hasItems && <List items={items} />}

// 함수 호출
{formatDate(post.publishedAt)}

// 배열.map()
{posts.map(post => <PostCard key={post.id} post={post} />)}
```

### 허용되지 않는 것

```jsx
// ❌ if 문 — 값을 반환하지 않음
<div>{if (ok) <p>ok</p>}</div>

// ❌ for 문 — 값을 반환하지 않음
<ul>{for (let i = 0; i < 3; i++) <li>{i}</li>}</ul>

// ❌ 여러 루트 요소 — JSX는 단일 루트만 허용
return <h1>제목</h1><p>본문</p>;
```

`if`/`for`가 필요하면 JSX 밖에서 결과를 변수에 담고, 그 변수를 `{}` 안에 넣습니다.

```jsx
// ✓ JSX 밖에서 처리
function Article({ isPublished, items }) {
  let status;
  if (isPublished) {
    status = <span className="badge">발행됨</span>;
  } else {
    status = <span className="badge draft">임시저장</span>;
  }

  return (
    <div>
      {status}
      <ul>
        {items.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

---

## `&&` 연산자의 숫자 0 함정

`count && <Badge count={count} />`를 작성하면, `count`가 `0`일 때 `false`가 아니라 `0`(숫자)이 렌더링됩니다. React는 `false`·`null`·`undefined`는 무시하지만 `0`은 텍스트로 출력합니다.

```jsx
// ❌ 문제: count=0이면 "0"이 화면에 출력
{count && <Badge count={count} />}

// ✓ 해결 방법 1: 불리언으로 명시 변환
{count > 0 && <Badge count={count} />}

// ✓ 해결 방법 2: 삼항 연산자
{count ? <Badge count={count} /> : null}
```

---

## JSX는 HTML이 아니다: 주요 차이점

| HTML 속성 | JSX 속성 | 이유 |
|---|---|---|
| `class` | `className` | `class`는 JS 예약어 |
| `for` | `htmlFor` | `for`는 JS 예약어 |
| `onclick` | `onClick` | 카멜케이스 이벤트 |
| `style="color:red"` | `style={{ color: 'red' }}` | JS 객체로 전달 |
| `tabindex` | `tabIndex` | 카멜케이스 |

자기 닫힘 태그도 HTML과 다릅니다. `<img>`는 JSX에서 반드시 `<img />`로 닫아야 합니다.

---

**지난 글:** [JSX 문법 이해하기](/posts/react-jsx/)

**다음 글:** [React.Fragment 완전 이해](/posts/react-fragments/)

<br>
읽어주셔서 감사합니다. 😊
