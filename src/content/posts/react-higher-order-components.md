---
title: "고차 컴포넌트 (HOC)"
description: "컴포넌트를 인수로 받아 강화된 컴포넌트를 반환하는 고차 컴포넌트(HOC) 패턴의 구조, 인증 가드·로딩·에러 바운더리 등 실전 예제, displayName 설정과 커스텀 훅과의 비교를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 8
type: "knowledge"
category: "React"
tags: ["React", "HOC", "고차컴포넌트", "HigherOrderComponent", "withAuth", "패턴"]
featured: false
draft: false
---

[지난 글](/posts/react-render-props/)에서 렌더 프롭으로 렌더링 로직을 외부에서 주입하는 방법을 다뤘다. 고차 컴포넌트(Higher-Order Component, HOC)는 또 다른 재사용 패턴이다. 컴포넌트를 인수로 받아 새로운 기능이 추가된 컴포넌트를 반환하는 함수다. 인증, 로딩 상태 처리, 로깅, 에러 바운더리 같은 횡단 관심사를 우아하게 분리할 수 있다.

## HOC의 기본 구조

함수가 함수를 받아 함수를 반환한다는 점에서 JavaScript의 고차 함수와 같은 발상이다.

```jsx
// withFeature: HOC 함수
function withFeature(WrappedComponent) {
  // Enhanced: 반환되는 새 컴포넌트
  function Enhanced(props) {
    // 여기에 추가 로직 (상태, 사이드 이펙트, 조건부 렌더링)
    return <WrappedComponent {...props} />;
  }
  // DevTools에서 표시될 이름 설정
  Enhanced.displayName = `withFeature(${WrappedComponent.displayName || WrappedComponent.name})`;
  return Enhanced;
}
```

![HOC 구조 다이어그램](/assets/posts/react-higher-order-components-diagram.svg)

## 인증 가드 HOC

로그인하지 않은 사용자를 로그인 페이지로 리다이렉트하는 가장 흔한 HOC 패턴이다.

```jsx
function withAuth(WrappedComponent) {
  function Protected(props) {
    const { user, loading } = useAuth();

    if (loading) return <Spinner />;
    if (!user) return <Navigate to="/login" replace />;

    return <WrappedComponent {...props} user={user} />;
  }
  Protected.displayName = `withAuth(${WrappedComponent.name})`;
  return Protected;
}

// 적용
const PrivateDashboard = withAuth(Dashboard);
const PrivateSettings = withAuth(Settings);
```

## 로딩·에러 처리 HOC

```jsx
function withLoading(WrappedComponent) {
  function WithLoading({ isLoading, ...props }) {
    if (isLoading) return <Spinner />;
    return <WrappedComponent {...props} />;
  }
  WithLoading.displayName = `withLoading(${WrappedComponent.name})`;
  return WithLoading;
}

function withError(WrappedComponent) {
  function WithError({ error, ...props }) {
    if (error) return <ErrorMessage message={error.message} />;
    return <WrappedComponent {...props} />;
  }
  WithError.displayName = `withError(${WrappedComponent.name})`;
  return WithError;
}

// 두 HOC 합성
const UserListEnhanced = withError(withLoading(UserList));

// 사용
<UserListEnhanced isLoading={loading} error={error} users={users} />
```

## HOC 합성

여러 HOC를 합성하는 유틸리티 함수를 만들면 가독성이 높아진다.

```jsx
function compose(...hocs) {
  return Component => hocs.reduceRight((acc, hoc) => hoc(acc), Component);
}

const enhance = compose(
  withAuth,
  withLoading,
  withError
);

const EnhancedPage = enhance(Page);
// = withAuth(withLoading(withError(Page)))
```

![HOC 실전 패턴 3가지](/assets/posts/react-higher-order-components-patterns.svg)

## 주의사항

HOC를 잘못 사용하면 버그가 생긴다.

```jsx
// 잘못된 예: render 안에서 HOC 생성
function Parent() {
  // 매 렌더마다 새 컴포넌트가 생성 → 상태 초기화, 성능 저하
  const EnhancedChild = withFeature(Child);
  return <EnhancedChild />;
}

// 올바른 예: 모듈 최상위에서 생성
const EnhancedChild = withFeature(Child);
function Parent() {
  return <EnhancedChild />;
}
```

또한 HOC가 원본 컴포넌트의 정적 메서드를 자동으로 복사하지 않으므로, 필요하다면 `hoistNonReactStatics` 라이브러리를 쓰거나 수동으로 복사해야 한다.

## HOC vs 커스텀 훅

훅이 나온 이후 상태 로직 재사용은 대부분 커스텀 훅으로 해결할 수 있다. 그러나 HOC는 여전히 `withAuth`처럼 컴포넌트 트리 구조 자체를 제어해야 하는 경우(리다이렉트, 에러 바운더리 래핑)에 적합하다.

다음 글에서는 `key` prop을 이용해 컴포넌트를 강제로 리셋하는 패턴을 다룬다.

---

**지난 글:** [렌더 프롭 패턴](/posts/react-render-props/)

**다음 글:** [key를 이용한 컴포넌트 리셋](/posts/react-key-as-reset/)

<br>
읽어주셔서 감사합니다. 😊
