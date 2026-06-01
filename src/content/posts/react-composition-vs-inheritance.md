---
title: "컴포지션 vs 상속"
description: "React가 상속 대신 컴포지션을 권장하는 이유, children prop·슬롯 props·특수화의 세 가지 컴포지션 패턴, 코드 재사용을 컴포지션으로 해결하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 5
type: "knowledge"
category: "React"
tags: ["React", "컴포지션", "Composition", "상속", "Inheritance", "children", "재사용"]
featured: false
draft: false
---

[지난 글](/posts/react-lifting-state/)에서 공통 부모로 상태를 끌어올리는 패턴을 다뤘다. 이번에는 컴포넌트 코드 재사용 전략인 컴포지션과 상속의 차이를 살펴본다. React 공식 문서는 "컴포지션을 상속보다 우선시하라"고 명시한다. 왜 그렇고, 어떻게 구현하는지 알아보자.

## 상속의 문제점

클래스 기반 객체지향에서는 공통 기능을 부모 클래스에 두고 상속받는 방식이 자연스럽다. React 컴포넌트에도 같은 발상을 적용할 수 있지만, 실제로 쓰면 금방 문제가 드러난다.

```jsx
// 의도는 좋지만 실제로 쓰면 복잡해진다
class BaseInput extends Component {
  handleChange(e) { /* 공통 처리 */ }
  render() { return <input onChange={this.handleChange} />; }
}

class EmailInput extends BaseInput {
  // BaseInput의 handleChange를 어떻게 오버라이드? super 호출?
  // 내부 구현에 강하게 의존하게 됨
}
```

부모를 변경하면 모든 자식에 영향을 준다. 다중 상속이 없어 두 베이스 클래스의 기능을 동시에 가질 수 없다. 계층이 깊어질수록 코드를 따라가기 어려워진다.

![컴포지션 vs 상속 비교](/assets/posts/react-composition-vs-inheritance-compare.svg)

## 컴포지션 패턴 1: children

가장 기본적인 컴포지션이다. 컴포넌트가 자신의 내부 구조를 children을 통해 열어두면, 사용처에서 자유롭게 내용을 채울 수 있다.

```jsx
function Panel({ title, children }) {
  return (
    <div className="panel">
      {title && <h2 className="panel-title">{title}</h2>}
      <div className="panel-body">{children}</div>
    </div>
  );
}

// 어떤 컴포넌트든 안에 넣을 수 있다
<Panel title="사용자 정보">
  <Avatar user={user} />
  <UserDetails user={user} />
  <EditButton />
</Panel>
```

`Panel`은 레이아웃·스타일을 담당하고, 내용은 사용처에서 결정한다. 상속이라면 `Panel`을 상속한 `UserPanel`을 만들어야 했을 것이다.

## 컴포지션 패턴 2: 슬롯 props

여러 영역을 가진 컴포넌트라면 각 영역을 별도 prop으로 받는다. 이를 슬롯(slot) 패턴이라 부른다.

```jsx
function SplitPane({ left, right }) {
  return (
    <div className="split-pane">
      <div className="pane-left">{left}</div>
      <div className="pane-right">{right}</div>
    </div>
  );
}

<SplitPane
  left={<FileTree />}
  right={<EditorArea />}
/>
```

props에는 문자열, 숫자뿐 아니라 컴포넌트(JSX)도 전달할 수 있다는 점을 활용한다. `left`와 `right`는 각각 독립적인 컴포넌트 트리가 될 수 있다.

![컴포지션 핵심 패턴 3가지](/assets/posts/react-composition-vs-inheritance-patterns.svg)

## 컴포지션 패턴 3: 특수화

덜 일반적인 컴포넌트가 더 일반적인 컴포넌트를 렌더링하고 특정 props를 고정하는 패턴이다.

```jsx
function Dialog({ title, message, footer }) {
  return (
    <div className="dialog-backdrop">
      <div className="dialog">
        <h1>{title}</h1>
        <p>{message}</p>
        {footer && <div className="dialog-footer">{footer}</div>}
      </div>
    </div>
  );
}

// Dialog를 특수화한 컴포넌트들
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <Dialog
      title="확인"
      message={message}
      footer={
        <>
          <button onClick={onCancel}>취소</button>
          <button onClick={onConfirm}>확인</button>
        </>
      }
    />
  );
}

function AlertDialog({ message }) {
  return <Dialog title="알림" message={message} />;
}
```

`ConfirmDialog`와 `AlertDialog`는 `Dialog`를 사용하지 상속받지 않는다. `Dialog`의 내부 구현이 바뀌어도 인터페이스(props)가 같으면 영향이 없다.

## 코드 재사용: 상속 없이도 충분하다

재사용 가능한 로직이 필요할 때 상속 대신 쓸 수 있는 방법이 여러 가지 있다.

```jsx
// 방법 1: 유틸리티 함수 추출
function formatPrice(price, currency = 'KRW') {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency }).format(price);
}

// 방법 2: 커스텀 훅으로 상태 로직 공유
function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? initialValue;
    } catch {
      return initialValue;
    }
  });

  const set = useCallback(val => {
    setValue(val);
    localStorage.setItem(key, JSON.stringify(val));
  }, [key]);

  return [value, set];
}

// 방법 3: 컴포넌트 조합
function WithLoadingSpinner({ loading, children }) {
  if (loading) return <Spinner />;
  return children;
}
```

상속이 필요한 유일한 경우는 Error Boundary처럼 React가 클래스 컴포넌트를 요구하는 특수 상황뿐이다.

## React가 상속을 쓰지 않는 이유

Facebook의 React 팀은 수천 개의 컴포넌트를 만든 경험에서 "컴포넌트 상속 계층이 필요한 사례를 한 번도 발견하지 못했다"고 밝혔다. 컴포지션은 상속보다 유연하고, 각 컴포넌트가 독립적이어서 테스트하기 쉬우며, 계층을 따라가지 않아도 props만 보면 어떤 데이터를 받는지 알 수 있다.

다음 글에서는 컴포지션의 고급 응용인 컴파운드 컴포넌트 패턴을 다룬다.

---

**지난 글:** [상태 끌어올리기 (Lifting State Up)](/posts/react-lifting-state/)

**다음 글:** [컴파운드 컴포넌트 패턴](/posts/react-compound-components/)

<br>
읽어주셔서 감사합니다. 😊
