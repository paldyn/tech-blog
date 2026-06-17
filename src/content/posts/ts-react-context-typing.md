---
title: "React Context 타이핑"
description: "React Context를 TypeScript로 안전하게 만드는 법을 정리합니다. createContext의 제네릭 선언, 가짜 기본값의 위험과 undefined 기본값, Provider 밖 사용을 차단하는 가드 커스텀 훅, 상태와 dispatch를 두 Context로 분리하는 패턴까지 실무 관점으로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-18"
archiveOrder: 4
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "React", "Context", "createContext", "useContext", "커스텀훅"]
featured: false
draft: false
---

[지난 글](/posts/ts-react-refs-forwardref/)에서 ref를 컴포넌트 경계 너머로 전달하는 법을 봤다. 이번에는 값을 트리 전체에 내려보내는 Context를 타이핑한다. Context는 props drilling을 피하는 강력한 도구지만, TypeScript와 함께 쓸 때 거의 모두가 똑같은 곳에서 막힌다 — `createContext`의 기본값을 무엇으로 줄 것인가. 이 질문에 제대로 답하면 Context 타이핑의 8할이 끝난다.

## createContext의 제네릭과 기본값 딜레마

`createContext`는 호출할 때 기본값을 요구한다. 그리고 그 기본값의 타입이 곧 Context의 타입이 된다. 문제는 대부분의 Context가 "실제 값은 Provider가 채워주고, 그 전에는 의미 있는 기본값이 없다"는 점이다.

타입을 `AuthValue`로 두고 싶지만, 초기 기본값으로 줄 진짜 `AuthValue`가 없다. 흔히 빠지는 함정이 가짜 기본값을 단언으로 욱여넣는 것이다.

```typescript
// 안티패턴 — 가짜 기본값
const AuthContext = createContext<AuthValue>({} as AuthValue);
```

이러면 타입은 항상 `AuthValue`라 `null` 체크가 사라지고, **Provider로 감싸지 않은 곳에서 Context를 써도 컴파일러가 잡지 못한다.** 빈 객체의 메서드를 호출하다 런타임에서야 터진다.

## undefined 기본값 + 가드 커스텀 훅

정석은 기본값을 `undefined`로 두고, 타입을 `AuthValue | undefined`로 선언하는 것이다. 그리고 `useContext`를 직접 부르는 대신, `undefined`를 걸러내는 커스텀 훅으로 한 번 감싼다.

```typescript
interface AuthValue {
  user: User | null;
  login: (email: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | undefined>(undefined);

function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error("useAuth는 AuthProvider 안에서만 호출할 수 있습니다");
  }
  return ctx; // 여기서 ctx는 AuthValue로 좁혀진다
}
```

`if (ctx === undefined) throw`를 지나면 [제어 흐름 분석](/posts/ts-control-flow-analysis/)에 의해 `ctx`의 타입이 `AuthValue`로 좁혀진다. 그래서 `useAuth`의 반환 타입은 깔끔하게 `AuthValue`이고, 소비하는 컴포넌트는 `?.` 없이 바로 `user`나 `login`에 접근한다.

![Context 기본값 문제와 가드 훅](/assets/posts/ts-react-context-typing-guard.svg)

이 패턴의 이점은 두 겹이다. 타입 레벨에서는 소비처가 `undefined`를 신경 쓸 필요가 없어지고, 런타임에서는 Provider로 감싸지 않은 실수가 명확한 에러 메시지로 즉시 드러난다. 가짜 기본값이 숨기던 버그를 정반대로 끄집어내는 것이다.

## Provider 타이핑

Provider 컴포넌트 자체는 평범한 컴포넌트다. `value`에 넘기는 객체가 `createContext`에 선언한 타입과 일치하는지 컴파일러가 검사한다.

```typescript
function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const value: AuthValue = {
    user,
    login: (email) => setUser({ email }),
    logout: () => setUser(null),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
```

`value` 변수에 `: AuthValue` 주석을 달아두면, 객체를 만들 때부터 누락된 필드나 잘못된 타입을 잡아준다. `value` 속성에 넘기는 순간이 아니라 객체를 정의하는 시점에 에러가 떠서 디버깅이 쉽다.

![Context 흐름과 타입의 출처](/assets/posts/ts-react-context-typing-flow.svg)

`createContext`의 제네릭 한 곳이 진실의 출처(single source of truth)다. `AuthValue`를 바꾸면 Provider의 `value`와 `useAuth`를 쓰는 모든 곳이 동시에 다시 타입 검사를 받는다. 계약을 한 곳에 모으는 것 — 이게 타입 시스템의 본질적 가치다.

## 상태와 dispatch를 분리하기

성능이 중요한 큰 앱에서는 상태(state)와 변경 함수(dispatch)를 별도 Context로 나누는 패턴을 쓴다. 자주 바뀌는 상태와 거의 안 바뀌는 dispatch를 분리하면, dispatch만 쓰는 컴포넌트가 상태 변경 때마다 리렌더되는 걸 막는다. 타이핑도 자연스럽게 둘로 갈린다.

```typescript
const StateContext = createContext<TodoState | undefined>(undefined);
const DispatchContext = createContext<React.Dispatch<TodoAction> | undefined>(undefined);

function useTodoState(): TodoState {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error("Provider 밖 호출");
  return ctx;
}

function useTodoDispatch(): React.Dispatch<TodoAction> {
  const ctx = useContext(DispatchContext);
  if (!ctx) throw new Error("Provider 밖 호출");
  return ctx;
}
```

`React.Dispatch<TodoAction>`는 [지난 글의 useReducer](/posts/ts-react-hooks-typing/)에서 본 dispatch의 타입이다. 판별 유니온 `TodoAction`을 그대로 재사용하므로, dispatch 호출부에서도 잘못된 액션이 컴파일 타임에 걸린다. 두 Context 모두 같은 가드 훅 패턴을 쓰니, 한 번 익힌 관용구가 그대로 확장된다.

## 정리

Context 타이핑은 결국 하나의 결정으로 수렴한다 — **기본값을 `undefined`로 두고, 가드 커스텀 훅으로 좁혀라.** 가짜 기본값(`{} as T`)은 타입과 런타임의 안전망을 동시에 무력화하므로 피한다. `createContext`의 제네릭을 진실의 출처로 삼고, Provider의 `value`에 타입 주석을 달며, 필요하면 상태와 dispatch를 분리한다. 다음 글에서는 컴포넌트가 다루는 또 다른 입력, DOM 이벤트 핸들러를 타이핑한다.

---

**지난 글:** [ref와 forwardRef 타이핑](/posts/ts-react-refs-forwardref/)

**다음 글:** [React 이벤트 핸들러 타이핑](/posts/ts-react-event-handlers/)

<br>
읽어주셔서 감사합니다. 😊
