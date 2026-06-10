---
title: "React 상태 관리 전략 개요 — 내장 훅부터 외부 라이브러리까지"
description: "로컬 상태, 공유 상태, 전역 상태, 서버 상태의 네 가지 범주와 각 범주에 맞는 도구 선택 가이드를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 7
type: "knowledge"
category: "React"
tags: ["상태관리", "useState", "Context", "Zustand", "TanStackQuery", "Redux"]
featured: false
draft: false
---

[지난 글](/posts/react-ref-as-prop/)에서 React 19의 ref 변경사항을 살펴봤다. 이번 글부터는 React 애플리케이션의 **상태 관리**를 본격적으로 다룬다. "어떤 상태 관리 라이브러리를 써야 하나?"는 React 개발자들이 가장 자주 묻는 질문 중 하나다. 정답은 상태의 **범위와 성격**에 따라 다르다.

## 상태는 어디에 사는가?

먼저 상태를 네 가지 범주로 나눠야 한다. 이 분류가 도구 선택의 출발점이다.

**① 로컬 상태** — 단일 컴포넌트 안에서만 필요한 상태다. 모달의 open/close, 입력 값, 토글 상태 등이 여기에 해당한다.

**② 공유 상태** — 몇 개의 연관된 컴포넌트가 함께 사용하는 상태다. 폼의 여러 필드, 쇼핑몰의 특정 페이지 내 필터 등이 여기에 해당한다.

**③ 전역 상태** — 앱 전체에서 접근해야 하는 상태다. 로그인한 사용자 정보, 테마, 언어 설정, 장바구니 등이 여기에 해당한다.

**④ 서버 상태** — 서버에서 가져오는 비동기 데이터다. API 응답, 데이터베이스 데이터 등이 여기에 해당하며, 캐싱과 동기화가 중요하다.

![React 상태 관리 옵션 지도](/assets/posts/react-state-management-overview-map.svg)

## ① 로컬 상태: useState와 useReducer

대부분의 상태는 로컬이어야 한다. 무조건 전역 상태 관리 라이브러리를 쓰는 것은 **과도한 설계(over-engineering)**다.

```tsx
// 단순한 값: useState
function Accordion() {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setIsOpen(prev => !prev)}>
        {isOpen ? '접기' : '펼치기'}
      </button>
      {isOpen && <div>내용...</div>}
    </div>
  );
}

// 복잡한 전환 로직: useReducer
type Action =
  | { type: 'FETCH_START' }
  | { type: 'FETCH_SUCCESS'; data: User[] }
  | { type: 'FETCH_ERROR'; error: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'FETCH_START': return { ...state, loading: true, error: null };
    case 'FETCH_SUCCESS': return { loading: false, data: action.data, error: null };
    case 'FETCH_ERROR': return { ...state, loading: false, error: action.error };
  }
}
```

## ② 공유 상태: 상태 끌어올리기와 Context

여러 컴포넌트가 같은 상태를 필요로 한다면 공통 부모로 **상태를 끌어올린다**. 트리가 깊어 prop drilling이 심해지면 Context를 사용한다.

```tsx
// Context + useReducer 조합: 소규모 전역 상태에 충분
const CartContext = createContext<CartContextType | null>(null);

function CartProvider({ children }: { children: ReactNode }) {
  const [cart, dispatch] = useReducer(cartReducer, []);
  return (
    <CartContext.Provider value={{ cart, dispatch }}>
      {children}
    </CartContext.Provider>
  );
}
```

## ③ 전역 상태: 언제 외부 라이브러리가 필요한가?

Context가 충분하지 않은 경우는 세 가지다.

1. **성능**: Context는 소비자 전체를 re-render한다. 빠른 업데이트(예: 마우스 위치)가 있으면 외부 라이브러리가 낫다.
2. **복잡한 로직**: 미들웨어, 시간 여행 디버깅이 필요한 경우 Redux가 유리하다.
3. **팀 규모**: 대규모 팀에서 일관성을 위해 구조화된 솔루션이 필요한 경우.

## ④ 서버 상태: 별도로 관리하라

가장 흔한 실수 중 하나가 서버 데이터를 `useState`로 관리하는 것이다.

```tsx
// 안티 패턴: 서버 데이터를 useState로
function UserList() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchUsers().then(data => {
      setUsers(data);
      setLoading(false);
    }).catch(err => {
      setError(err);
      setLoading(false);
    });
  }, []);
  // ...
}
```

서버 상태는 **캐싱, 재요청, 동기화, 백그라운드 갱신** 등 복잡한 문제를 수반한다. TanStack Query나 SWR이 이 모든 것을 처리한다.

```tsx
// 올바른 패턴: TanStack Query
function UserList() {
  const { data: users, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  });
  // 캐싱, 재요청, 백그라운드 갱신 자동 처리
}
```

![상태 관리 선택 결정 트리](/assets/posts/react-state-management-overview-decision.svg)

## 도구 선택 기준 요약

| 상태 유형 | 특징 | 권장 도구 |
|-----------|------|-----------|
| 로컬 상태 | 단일 컴포넌트 | `useState`, `useReducer` |
| 공유 상태 | 근처 컴포넌트 | 상태 끌어올리기 |
| 전역 UI 상태 | 테마, 인증 | Context + useReducer |
| 전역 상태 (복잡) | 대규모 앱 | Zustand, Redux Toolkit |
| 서버 상태 | API 데이터 | TanStack Query, SWR |

## 가장 중요한 원칙: 최소한의 상태

어떤 도구를 쓰든 **최소한의 상태**를 유지하는 것이 중요하다. 파생될 수 있는 값은 상태가 아니라 계산값이어야 한다.

```tsx
// 잘못된 예: 파생값을 별도 상태로
const [items, setItems] = useState([]);
const [count, setCount] = useState(0); // ← 불필요한 상태

// 올바른 예: 파생값은 렌더 중 계산
const [items, setItems] = useState([]);
const count = items.length; // 파생값은 상태 X
```

다음 글부터는 각 도구를 깊이 살펴본다. 먼저 Context와 외부 상태 관리 라이브러리를 비교하는 글을 다룬다.

---

**지난 글:** [ref를 Props로 전달하기 — forwardRef 없이 ref 넘기기](/posts/react-ref-as-prop/)

**다음 글:** [Context vs 외부 상태 관리 — 언제 무엇을 쓸까?](/posts/react-context-vs-external/)

<br>
읽어주셔서 감사합니다. 😊
