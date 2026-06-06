---
title: "useId — 고유 ID 생성 훅"
description: "React 18의 useId 훅이 해결하는 문제(SSR hydration 불일치, 중복 ID), 사용법, 접근성 aria 연결 패턴, 그리고 사용해서는 안 되는 경우를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 8
type: "knowledge"
category: "React"
tags: ["React", "useId", "접근성", "SSR", "aria", "React18"]
featured: false
draft: false
---

[지난 글](/posts/react-use-fetch/)에서 useFetch 훅을 완성했다. 이번에는 완전히 다른 종류의 문제를 다룬다. 폼 컴포넌트에서 `label`과 `input`을 연결하려면 고유한 `id`가 필요하다. 직접 만들면 여러 문제가 생기는데, `useId`가 이를 우아하게 해결한다.

## 왜 useId가 필요한가

`label`의 `htmlFor`와 `input`의 `id`는 값이 일치해야 접근성이 작동한다.

```jsx
// ❌ 하드코딩 ID — 같은 컴포넌트를 두 번 렌더하면 중복
<label htmlFor="email">이메일</label>
<input id="email" type="email" />
```

같은 `EmailField` 컴포넌트를 로그인 폼과 회원가입 폼에서 동시에 렌더하면 `id="email"`이 두 개 생겨 DOM이 충돌한다. 화면 낭독기가 잘못된 `input`을 연결할 수 있다.

```jsx
// ❌ Math.random() — 서버와 클라이언트 값이 달라서 hydration 경고
const id = useRef(Math.random().toString(36).slice(2));
```

SSR에서는 서버가 렌더링한 HTML의 ID와 클라이언트의 hydration 과정에서 생성한 ID가 달라서 React가 경고를 출력하고 불필요한 DOM 업데이트가 발생한다.

![useId 동작 원리](/assets/posts/react-useid-concept.svg)

## 기본 사용법

```jsx
import { useId } from 'react';

function EmailField() {
  const id = useId();

  return (
    <div>
      <label htmlFor={id}>이메일</label>
      <input id={id} type="email" />
    </div>
  );
}
```

`useId`는 `:r0:`, `:r1:`처럼 콜론으로 감싼 문자를 반환한다. 이 형식은 컴포넌트 트리 안에서의 위치를 기반으로 결정되므로, 서버와 클라이언트 렌더링 결과가 동일하다.

```jsx
// 같은 컴포넌트를 두 번 렌더해도 각각 다른 ID
<EmailField /> // id=":r0:"
<EmailField /> // id=":r1:"
```

## 연관된 여러 ID에 접두어 패턴

하나의 컴포넌트에서 여러 연관 `id`가 필요할 때 `useId`를 한 번 호출하고 접두어를 붙인다.

```jsx
function FormField({ label, description }) {
  const id = useId();
  const inputId = `${id}-input`;
  const descriptionId = `${id}-description`;

  return (
    <div>
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        type="text"
        aria-describedby={descriptionId}
      />
      <p id={descriptionId}>{description}</p>
    </div>
  );
}
```

`useId`를 여러 번 호출하는 대신 하나의 접두어로 파생 ID를 만드는 패턴이 권장된다.

## 접근성 aria 속성에 활용

![useId 패턴](/assets/posts/react-useid-patterns.svg)

```jsx
function Accordion({ title, children }) {
  const id = useId();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button
        id={`${id}-btn`}
        aria-expanded={isOpen}
        aria-controls={`${id}-panel`}
        onClick={() => setIsOpen(o => !o)}
      >
        {title}
      </button>
      <div
        id={`${id}-panel`}
        role="region"
        aria-labelledby={`${id}-btn`}
        hidden={!isOpen}
      >
        {children}
      </div>
    </div>
  );
}
```

`aria-expanded`, `aria-controls`, `aria-labelledby` 같은 ARIA 속성들은 요소 간 ID로 관계를 표현한다. `useId`를 쓰면 이런 연결이 컴포넌트가 몇 번 렌더되든 항상 올바르게 유지된다.

## 사용해서는 안 되는 경우

```jsx
// ❌ key prop에 useId 사용 금지
const id = useId();
return items.map((item, i) => (
  <li key={`${id}-${i}`}> {/* 인덱스가 있으면 useId가 무의미 */}
    {item.name}
  </li>
));
```

`key`는 목록 아이템을 추적하는 용도이므로 데이터의 고유 ID(`item.id`)를 사용해야 한다.

```jsx
// ❌ CSS selector에 직접 사용
const id = useId(); // ":r0:" → CSS에서 콜론은 특수 문자
document.querySelector(`#${id}`); // 콜론 이스케이프 필요
```

`useId`가 반환하는 값에는 콜론(`:`)이 포함된다. HTML `id` 속성으로는 유효하지만 CSS selector로 직접 쓰면 이스케이프가 필요하다. DOM을 직접 조작해야 한다면 다른 방법을 쓰는 게 낫다.

## React 18 이전 대안

React 18 미만이거나 `useId`를 쓸 수 없는 환경에서는 전역 카운터 패턴을 쓴다.

```jsx
let counter = 0;

function generateId() {
  return `id-${++counter}`;
}

function useUniqueId() {
  const [id] = useState(generateId);
  return id;
}
```

`useState`의 지연 초기화를 이용해 컴포넌트마다 한 번만 ID를 생성한다. 단, SSR에서는 서버/클라이언트 카운터가 다를 수 있으므로 주의해야 한다.

---

**지난 글:** [useFetch 커스텀 훅 — 데이터 페칭 완전 캡슐화](/posts/react-use-fetch/)

**다음 글:** [useSyncExternalStore로 외부 상태 구독하기](/posts/react-usesyncexternalstore/)

<br>
읽어주셔서 감사합니다. 😊
