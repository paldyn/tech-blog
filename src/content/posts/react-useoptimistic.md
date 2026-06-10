---
title: "useOptimistic으로 낙관적 UI 업데이트 구현하기"
description: "useOptimistic의 동작 원리, 낙관적 업데이트와 롤백 메커니즘, 리스트 추가/삭제/수정 패턴, Actions와의 통합 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 4
type: "knowledge"
category: "React"
tags: ["React19", "useOptimistic", "낙관적업데이트", "UX", "Actions"]
featured: false
draft: false
---

[지난 글](/posts/react-useactionstate/)에서 `useActionState`로 Action의 결과 상태를 관리하는 방법을 살펴봤다. 네트워크 요청이 느릴 때 사용자에게 즉각적인 피드백을 주려면 **낙관적 업데이트(Optimistic Update)** 패턴이 필요하다. React 19는 이를 위해 `useOptimistic` 훅을 제공한다.

## 낙관적 업데이트란?

일반적인 서버 요청 흐름은 "클릭 → 서버 요청 → 응답 대기 → UI 업데이트"다. 사용자는 응답이 올 때까지 기다려야 한다. 낙관적 업데이트는 이 순서를 바꾼다.

**낙관적 흐름**: "클릭 → UI 즉시 업데이트 → 서버 요청(백그라운드) → 성공이면 확정, 실패하면 롤백"

서버 요청이 성공할 것이라고 **낙관적으로 가정**하고 UI를 먼저 업데이트한다. 요청이 실패하면 자동으로 이전 상태로 돌아간다.

![useOptimistic 낙관적 업데이트 개념](/assets/posts/react-useoptimistic-concept.svg)

## useOptimistic API

```tsx
const [optimisticState, addOptimistic] = useOptimistic(state, updateFn);
```

- `state` — 실제 서버 데이터 상태
- `updateFn` — `(currentState, optimisticValue) => newState` 형태. 낙관적 값으로 임시 상태를 만드는 함수
- 반환값: `[낙관적으로 업데이트된 상태, 낙관적 업데이트를 트리거하는 함수]`

핵심은 `optimisticState`와 `state`가 분리된다는 것이다. `state`는 서버에서 확인된 실제 값이고, `optimisticState`는 낙관적으로 계산된 임시 값이다. 렌더링에는 항상 `optimisticState`를 사용한다.

## 좋아요 버튼 예제

가장 간단한 예제는 좋아요 버튼이다.

```tsx
import { useOptimistic, useState } from 'react';
import { startTransition } from 'react';

function LikeButton({ postId, initialLikes }: { postId: string; initialLikes: number }) {
  const [likes, setLikes] = useState(initialLikes);

  const [optimisticLikes, addOptimisticLike] = useOptimistic(
    likes,
    (currentLikes, change: number) => currentLikes + change
  );

  async function handleLike() {
    startTransition(async () => {
      addOptimisticLike(1); // 즉시 +1
      try {
        const confirmed = await likePost(postId);
        setLikes(confirmed.likes); // 서버 확정 값으로 업데이트
      } catch {
        // 에러 시 optimisticLikes가 자동으로 likes로 복원
      }
    });
  }

  return (
    <button onClick={handleLike}>
      ♥ {optimisticLikes} {/* 낙관적 상태로 렌더 */}
    </button>
  );
}
```

`addOptimisticLike(1)`을 호출하면 `optimisticLikes`가 즉시 `likes + 1`이 된다. 서버 요청이 완료되면 `setLikes(confirmed.likes)`로 서버의 실제 값으로 교체한다.

## 리스트 항목 추가

할 일 목록에 항목을 추가할 때 낙관적 업데이트를 적용해 보자.

```tsx
import { useOptimistic, useState, useTransition } from 'react';

type Todo = { id: number; text: string; sending?: boolean };

function TodoList({ initialTodos }: { initialTodos: Todo[] }) {
  const [todos, setTodos] = useState(initialTodos);
  const [isPending, startTransition] = useTransition();

  const [optimisticTodos, addOptimisticTodo] = useOptimistic(
    todos,
    (state, newTodo: Todo) => [...state, newTodo] // 항목 추가
  );

  function handleSubmit(text: string) {
    const tempTodo: Todo = {
      id: Date.now(),
      text,
      sending: true, // "전송 중" 표시용
    };

    startTransition(async () => {
      addOptimisticTodo(tempTodo); // 즉시 목록에 추가
      const saved = await saveTodo(text); // 서버에 저장
      setTodos(current => [...current, saved]); // 서버 응답으로 교체
    });
  }

  return (
    <ul>
      {optimisticTodos.map(todo => (
        <li key={todo.id} style={{ opacity: todo.sending ? 0.5 : 1 }}>
          {todo.text}
          {todo.sending && ' (저장 중...)'}
        </li>
      ))}
    </ul>
  );
}
```

`sending: true`인 항목을 반투명하게 표시해 "아직 서버에 저장되지 않은 항목"임을 시각적으로 알려준다.

![낙관적 리스트 업데이트 패턴](/assets/posts/react-useoptimistic-list.svg)

## Actions와 함께 사용하기

`useOptimistic`은 React 19 Actions와 함께 쓸 때 가장 자연스럽다.

```tsx
function MessageThread({ threadId }: { threadId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);

  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (state, optimistic: Message) => [...state, optimistic]
  );

  async function sendMessageAction(formData: FormData) {
    const text = formData.get('message') as string;
    const tempMessage: Message = {
      id: crypto.randomUUID(),
      text,
      status: 'sending',
    };

    addOptimisticMessage(tempMessage); // 즉시 표시

    const sent = await sendMessage(threadId, text);
    setMessages(msgs => [...msgs, sent]); // 서버 확정
  }

  return (
    <div>
      <ul>
        {optimisticMessages.map(msg => (
          <li key={msg.id} className={msg.status === 'sending' ? 'pending' : ''}>
            {msg.text}
          </li>
        ))}
      </ul>
      <form action={sendMessageAction}>
        <input name="message" />
        <button type="submit">전송</button>
      </form>
    </div>
  );
}
```

## 롤백 처리

Action이 실패하면 `optimisticState`는 자동으로 원래 `state`로 돌아간다. React가 이를 자동으로 처리하므로 별도의 롤백 코드가 필요 없다.

```tsx
async function deleteItem(itemId: string) {
  startTransition(async () => {
    addOptimisticItems(prev => prev.filter(item => item.id !== itemId)); // 즉시 제거
    try {
      await deleteFromServer(itemId);
      setItems(items => items.filter(item => item.id !== itemId)); // 확정
    } catch {
      // 에러 throw 시 optimisticItems가 items로 자동 복원
      // 삭제된 것처럼 보였던 항목이 다시 나타남
    }
  });
}
```

## useOptimistic 사용 시 주의사항

1. **반드시 `startTransition` 안에서 호출**: `addOptimistic`은 트랜지션 컨텍스트가 필요하다. Actions(`form action={}`)를 사용하면 자동으로 트랜지션이 생성된다.

2. **렌더링에 `optimisticState` 사용**: `state`가 아닌 `optimisticState`를 렌더링에 사용해야 한다.

3. **서버 확정 후 `setState` 호출**: Action 성공 후 `setState`로 서버 응답 값을 확정해야 임시 항목이 실제 항목으로 교체된다.

`useOptimistic`을 사용하면 느린 네트워크에서도 반응형 UI를 구현할 수 있다. 사용자 경험이 크게 개선되는 패턴이다. 다음 글에서는 `useFormStatus`를 더 자세히 살펴본다.

---

**지난 글:** [useActionState로 Action 결과 상태 관리하기](/posts/react-useactionstate/)

**다음 글:** [useFormStatus — 폼 상태를 자식 컴포넌트에서 읽기](/posts/react-useformstatus/)

<br>
읽어주셔서 감사합니다. 😊
