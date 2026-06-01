---
title: "key를 이용한 컴포넌트 리셋"
description: "React key prop의 리셋 메커니즘, key가 바뀔 때 컴포넌트가 언마운트-마운트되는 원리, 사용자 전환·폼 초기화·애니메이션 재실행에서 key 리셋이 useEffect보다 나은 이유를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 9
type: "knowledge"
category: "React"
tags: ["React", "key", "리셋", "Reset", "언마운트", "마운트", "폼초기화"]
featured: false
draft: false
---

[지난 글](/posts/react-higher-order-components/)에서 고차 컴포넌트로 기능을 추가하는 방법을 다뤘다. 이번에는 React의 `key` prop을 활용한 리셋 패턴을 살펴본다. 리스트 렌더링에서 사용하는 `key`가 완전한 컴포넌트 초기화 도구로도 쓰인다는 사실을 아는 개발자는 생각보다 적다.

## key가 바뀌면 무슨 일이 일어나나

React는 리렌더 시 이전 트리와 새 트리를 비교해 최소한의 DOM 업데이트를 수행한다. 이때 `key`는 컴포넌트의 신원(identity)을 나타낸다. 같은 위치에 같은 타입의 컴포넌트라도 `key`가 다르면 완전히 다른 인스턴스로 취급한다.

```
key="user-1" → key="user-2"
React: "이건 다른 컴포넌트다"
→ 기존 인스턴스 언마운트 (cleanup 실행)
→ 새 인스턴스 마운트 (state 초기화, Effect 실행)
```

![key prop으로 컴포넌트 리셋](/assets/posts/react-key-as-reset-diagram.svg)

## 폼 리셋 문제

사용자를 전환할 때 이전 사용자가 입력 중이던 폼이 남아 있으면 버그가 된다. 이를 해결하는 두 가지 방법이 있다.

![key 리셋 vs useEffect 비교](/assets/posts/react-key-as-reset-compare.svg)

`key`를 사용하면 `ProfileForm` 안에 상태가 몇 개 있든, 어떤 중간 상태에 있든 관계없이 완전히 초기화된다. `useEffect`로 수동 리셋하는 방법은 상태를 하나씩 직접 초기화해야 해서 실수가 생기기 쉽고, 초기화 중 한 프레임 동안 이전 데이터가 보이는 깜빡임 문제도 있다.

## 실전 예제 1: 채팅 앱 메시지 입력창

```jsx
function ChatWindow({ currentUserId }) {
  return (
    <div>
      <MessageList userId={currentUserId} />
      {/* key로 리셋: 대화 상대가 바뀌면 입력창 초기화 */}
      <MessageInput key={currentUserId} />
    </div>
  );
}

function MessageInput() {
  const [draft, setDraft] = useState('');

  return (
    <input
      value={draft}
      onChange={e => setDraft(e.target.value)}
      placeholder="메시지를 입력하세요..."
    />
  );
}
```

`currentUserId`가 바뀌면 `MessageInput`이 리셋되어 이전 대화 상대에게 쓰던 초안이 사라진다.

## 실전 예제 2: 카운터 초기화 버튼

```jsx
function App() {
  const [version, setVersion] = useState(0);

  return (
    <div>
      <Counter key={version} />
      <button onClick={() => setVersion(v => v + 1)}>
        카운터 초기화
      </button>
    </div>
  );
}

function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}
```

`version`을 증가시키면 `Counter`가 리셋된다. 이 방법은 자식 컴포넌트에 "리셋하라"는 인터페이스를 추가하지 않아도 된다는 장점이 있다.

## 실전 예제 3: 애니메이션 재실행

CSS 트랜지션이나 GSAP 애니메이션을 재실행하고 싶을 때도 `key`를 활용할 수 있다.

```jsx
function AnimatedAlert({ message }) {
  const [key, setKey] = useState(0);

  function showAlert(newMessage) {
    setKey(k => k + 1); // 같은 메시지라도 애니메이션 재실행
  }

  return <Alert key={key} message={message} />;
}

function Alert({ message }) {
  // 마운트 시 자동으로 fade-in 애니메이션 시작
  return <div className="alert fade-in">{message}</div>;
}
```

## key는 전역 고유값일 필요 없다

`key`는 형제 컴포넌트 사이에서만 고유하면 된다. 리셋 용도로 쓸 때는 "이전과 다른 값"이기만 하면 된다.

```jsx
// 모두 유효한 리셋 패턴
<Form key={userId} />
<Form key={`${userId}-${timestamp}`} />
<Form key={resetCount} />
```

## 언제 key 리셋을 사용해야 하나

props가 바뀔 때 컴포넌트의 내부 상태 전체를 초기화해야 하는 상황에 key 리셋이 맞다. 특히 상태가 복잡하고 많을수록 효과적이다. 반면 일부 상태만 초기화하거나, 초기화 후 서버 데이터를 가져오는 등 비동기 로직이 필요한 경우라면 `useEffect`나 다른 방법을 고려한다.

다음 글에서는 prop drilling 문제와 그 해결책들을 다룬다.

---

**지난 글:** [고차 컴포넌트 (HOC)](/posts/react-higher-order-components/)

**다음 글:** [Prop Drilling 문제와 해결책](/posts/react-prop-drilling/)

<br>
읽어주셔서 감사합니다. 😊
