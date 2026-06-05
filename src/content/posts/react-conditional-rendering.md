---
title: "조건부 렌더링 — 상황에 맞는 UI 표현하기"
description: "React의 5가지 조건부 렌더링 방법(if/else, 삼항, &&, 변수, 컴포넌트 맵), && 연산자의 0 함정, null 반환과 CSS hidden의 차이를 실전 예제로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 9
type: "knowledge"
category: "React"
tags: ["조건부렌더링", "React", "삼항연산자", "논리AND", "null반환"]
featured: false
draft: false
---

[지난 글](/posts/react-props-spreading/)에서 props 스프레딩의 올바른 사용법을 배웠다. 실제 앱에서 UI는 상태, 권한, 데이터 유무에 따라 다르게 보여야 한다. React는 자바스크립트 표현식을 JSX 안에 그대로 쓸 수 있어, 조건부 렌더링 방법도 다양하다.

## 5가지 조건부 렌더링 방법

![조건부 렌더링 5가지 방법](/assets/posts/react-conditional-rendering-methods.svg)

### ① if/else로 early return

가장 읽기 쉬운 방법이다. 렌더링 전에 특수 케이스를 먼저 처리하고 조기 반환한다.

```jsx
function UserProfile({ userId }) {
  const { data: user, isLoading, error } = useUser(userId);

  // 특수 케이스 먼저 처리 (guard clauses)
  if (isLoading) return <Skeleton />;
  if (error)     return <ErrorMessage error={error} />;
  if (!user)     return <EmptyState message="사용자를 찾을 수 없습니다" />;

  // 메인 렌더링
  return (
    <div className="profile">
      <Avatar src={user.avatar} name={user.name} />
      <h2>{user.name}</h2>
      <p>{user.bio}</p>
    </div>
  );
}
```

이 패턴을 **Guard Clause(가드 절)** 패턴이라 한다. 중첩 없이 코드가 선형적으로 읽힌다.

### ② 삼항 연산자 (?:)

두 가지 중 하나를 선택해 렌더링할 때 사용한다. JSX 안에 인라인으로 쓸 수 있다.

```jsx
function LoginStatus({ isLoggedIn }) {
  return (
    <header>
      <Logo />
      {isLoggedIn
        ? <UserMenu />
        : <LoginButton />
      }
    </header>
  );
}

// 단순한 경우 한 줄도 가능
const badge = isNew ? <NewBadge /> : null;
```

삼항이 중첩되면 가독성이 떨어진다. 3단 이상 중첩은 컴포넌트 분리 또는 변수 방식이 낫다.

### ③ 논리 AND (&&)

조건이 참일 때만 렌더링하고, 거짓이면 아무것도 표시하지 않을 때 사용한다.

```jsx
function Notification({ count, messages }) {
  return (
    <div>
      {count > 0 && <Badge count={count} />}
      {messages.length > 0 && (
        <MessageList messages={messages} />
      )}
    </div>
  );
}
```

**⚠ 주의: 숫자 0 함정**

```jsx
// ❌ count가 0이면 "0"이 화면에 출력됨
{count && <Badge count={count} />}

// ✅ 명시적 비교로 해결
{count > 0 && <Badge count={count} />}

// ✅ Boolean 변환
{Boolean(count) && <Badge count={count} />}

// ✅ 삼항으로 null
{count ? <Badge count={count} /> : null}
```

### ④ 변수에 JSX 저장

JSX를 변수에 저장해 복잡한 조건 로직을 분리한다.

```jsx
function Dashboard({ role, permissions }) {
  let sidebarContent;

  if (role === 'admin') {
    sidebarContent = <AdminSidebar />;
  } else if (permissions.includes('manager')) {
    sidebarContent = <ManagerSidebar />;
  } else {
    sidebarContent = <UserSidebar />;
  }

  return (
    <div className="dashboard">
      <aside>{sidebarContent}</aside>
      <main><Outlet /></main>
    </div>
  );
}
```

### ⑤ 컴포넌트 맵(Map Object)

여러 값 중 하나에 따라 컴포넌트를 전환할 때, 객체로 매핑하면 switch보다 간결하다.

```jsx
const STATUS_COMPONENTS = {
  idle:    <IdleView />,
  loading: <LoadingView />,
  success: <SuccessView />,
  error:   <ErrorView />,
};

function StatusDisplay({ status }) {
  return STATUS_COMPONENTS[status] ?? <UnknownStatus />;
}
```

`??` 연산자는 `null`이나 `undefined`일 때 폴백을 제공한다.

## null 반환과 CSS hidden의 차이

![실전 조건부 렌더링 패턴](/assets/posts/react-conditional-rendering-patterns.svg)

컴포넌트를 숨길 때 `null` 반환과 CSS `display: none` / `visibility: hidden`은 다르게 동작한다.

```jsx
// null 반환 — 컴포넌트가 완전히 언마운트됨
function Modal({ isOpen }) {
  if (!isOpen) return null;
  return <ModalContent />;
}
// 열 때마다 새로 마운트 → 내부 state 초기화
// 닫을 때 DOM에서 완전 제거

// CSS로 숨김 — 마운트 유지
function Modal({ isOpen }) {
  return (
    <div style={{ display: isOpen ? 'block' : 'none' }}>
      <ModalContent />
    </div>
  );
}
// state가 닫혀도 보존됨
// 애니메이션(fade out 등) 구현 가능
```

| 방법 | 마운트 상태 | state 보존 | 애니메이션 |
|---|---|---|---|
| null 반환 | 언마운트 | ❌ 초기화 | 진입만 가능 |
| display:none | 마운트 유지 | ✅ 보존 | 진입·퇴장 모두 가능 |

드로어, 모달처럼 **열고 닫는 UI에 애니메이션**이 필요하다면 CSS로 숨기는 방식을 선택한다.

## 권한 기반 조건부 렌더링

실전에서 자주 쓰이는 패턴 — 권한 체크를 컴포넌트로 추출한다.

```jsx
function Can({ permission, children, fallback = null }) {
  const { permissions } = useAuth();
  return permissions.includes(permission) ? children : fallback;
}

// 사용 측
<Can permission="posts:write">
  <CreatePostButton />
</Can>

<Can permission="admin:delete" fallback={<span>권한 없음</span>}>
  <DeleteButton />
</Can>
```

## 정리

조건부 렌더링의 핵심은 **가독성과 의도의 명확성**이다. 단순 on/off는 `&&`, 두 가지 택일은 삼항, 여러 가드 조건은 early return, 3개 이상 선택지는 컴포넌트 맵을 쓴다. `&&` 사용 시 숫자 0 함정을 반드시 피하고, 애니메이션이 필요한 UI는 `null` 반환 대신 CSS로 숨긴다. 다음 글에서는 배열 데이터를 화면에 표시하는 **리스트 렌더링**을 알아본다.

---

**지난 글:** [Props Spreading — 편리함과 위험성의 균형](/posts/react-props-spreading/)

**다음 글:** [리스트 렌더링 — map, key, 성능 최적화](/posts/react-list-rendering/)

<br>
읽어주셔서 감사합니다. 😊
