---
title: "React Props와 children 타이핑"
description: "React 컴포넌트의 props를 TypeScript로 안전하게 선언하는 법을 정리합니다. interface와 type 중 무엇을 쓸지, children을 ReactNode·ReactElement·함수형으로 구분하는 기준, 옵셔널과 기본값 처리, FC 타입을 굳이 쓰지 않는 이유까지 실무 관점으로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-18"
archiveOrder: 1
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "React", "Props", "children", "ReactNode", "컴포넌트"]
featured: false
draft: false
---

[지난 글](/posts/ts-typing-fetch/)에서 네트워크 응답을 `unknown`으로 받아 타입 가드로 길들이는 법을 봤다. 이번 묶음부터는 무대를 React로 옮긴다. React 컴포넌트는 결국 props라는 입력을 받아 UI를 반환하는 함수이고, 그 입력의 모양을 타입으로 못 박는 일이 React + TypeScript의 출발점이다. 첫 글은 가장 기본이자 가장 자주 헷갈리는 두 가지, **props 선언**과 **children 타이핑**을 다룬다.

## props는 함수의 첫 번째 인자다

React 함수 컴포넌트는 이름이 거창하지만 props 객체 하나를 받는 함수일 뿐이다. 그래서 props 타이핑은 새로운 문법이 아니라, 우리가 시리즈 내내 다룬 "객체 타입 선언"을 컴포넌트 인자에 붙이는 것과 같다.

```typescript
interface ButtonProps {
  label: string;
  onClick: () => void;
}

function Button({ label, onClick }: ButtonProps) {
  return <button onClick={onClick}>{label}</button>;
}
```

`label`을 빼고 `<Button onClick={...} />`를 쓰면 컴파일 타임에 에러가 난다. props는 컴포넌트의 공개 API이고, 타입은 그 API의 계약서다. 호출하는 쪽이 잘못된 props를 넘기는 순간을 런타임이 아니라 에디터에서 잡아준다.

![Props 타이핑의 기본](/assets/posts/ts-react-props-children-flow.svg)

## interface와 type, 무엇을 쓸까

props 모양을 선언할 때 `interface`와 `type` 중 무엇을 써도 대부분 동작한다. [인터페이스와 타입 별칭](/posts/ts-interface-vs-type/) 글에서 정리했듯, 라이브러리처럼 외부에서 확장(선언 병합)할 여지를 남기려면 `interface`가, 유니온이나 매핑된 타입 등 타입 연산이 필요하면 `type`이 자연스럽다.

애플리케이션 컴포넌트라면 둘 중 팀 컨벤션 하나로 통일하는 편이 낫다. 다만 props가 유니온이어야 하는 경우 — 예를 들어 "둘 중 하나만 받는" 컴포넌트 — 에는 `type`이 강제된다.

```typescript
type AlertProps =
  | { variant: "info"; message: string }
  | { variant: "error"; message: string; retry: () => void };
```

`variant`가 `"error"`일 때만 `retry`를 요구하는 이런 구조는 [판별 유니온](/posts/ts-discriminated-union/)의 응용이다. 잘못된 조합을 props 단계에서 막을 수 있다.

## children — React에서 가장 특별한 prop

`children`은 JSX에서 여는 태그와 닫는 태그 사이에 넣은 내용이 자동으로 채워지는 prop이다. 명시적으로 `children` prop을 넘기지 않아도, `<Card>안녕</Card>`의 `"안녕"`이 `props.children`으로 들어온다. 문제는 이 `children`이 어떤 타입이어야 하느냐다.

가장 흔한 답은 `React.ReactNode`다. JSX 엘리먼트, 문자열, 숫자, 배열, `null`, `boolean`까지 "렌더링 가능한 거의 모든 것"을 포함하는 넓은 타입이다. 래퍼나 레이아웃 컴포넌트는 무엇이 들어올지 모르니 이걸 기본값으로 쓴다.

```typescript
interface CardProps {
  title: string;
  children: React.ReactNode;
}

function Card({ title, children }: CardProps) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}
```

하지만 항상 넓은 타입이 좋은 건 아니다. 받을 자식의 형태가 정해져 있다면 더 좁혀서 의도를 드러내는 게 낫다.

![children 타입 고르기](/assets/posts/ts-react-props-children-childrentypes.svg)

`React.ReactElement`는 단일 JSX 엘리먼트만 허용한다. 문자열이나 `null`을 거부하므로 "반드시 컴포넌트 하나를 자식으로 받는다"는 제약을 표현한다. `React.cloneElement`로 자식에 props를 주입하는 패턴에서 특히 잘 맞는다.

함수형 children, 이른바 render props는 `children`을 함수로 선언한다. 부모가 가진 값을 자식에게 내려줄 때 쓴다.

```typescript
interface ToggleProps {
  children: (state: { on: boolean; toggle: () => void }) => React.ReactNode;
}

function Toggle({ children }: ToggleProps) {
  const [on, setOn] = React.useState(false);
  return <>{children({ on, toggle: () => setOn((v) => !v) })}</>;
}

// 사용
<Toggle>{({ on, toggle }) => <button onClick={toggle}>{on ? "켜짐" : "꺼짐"}</button>}</Toggle>;
```

`children`의 타입을 함수로 선언하는 것만으로 "이 컴포넌트는 함수를 자식으로 받는다"는 사실이 호출부에 자동완성으로 드러난다.

## 옵셔널과 기본값

`children`을 받지 않아도 되는 컴포넌트라면 `children?: React.ReactNode`로 옵셔널 처리한다. 그러면 타입은 `ReactNode | undefined`가 되어 [strict 모드](/posts/ts-strict-mode-flags/)에서 `undefined` 가능성을 강제로 의식하게 된다.

기본값은 구조 분해 시 직접 지정하는 게 가장 깔끔하다. 예전의 `defaultProps`는 함수 컴포넌트에서 사실상 폐기 수순이다.

```typescript
interface BadgeProps {
  text: string;
  color?: string;
}

function Badge({ text, color = "gray" }: BadgeProps) {
  return <span style={{ color }}>{text}</span>;
}
```

`color`는 옵셔널이지만, 구조 분해에서 `= "gray"`를 주면 함수 본문 안에서는 항상 `string`으로 좁혀진다. 옵셔널 타입과 런타임 기본값을 한 줄로 묶는 관용구다.

## React.FC를 굳이 쓰지 않는 이유

예전 코드에서 자주 보이는 `const Button: React.FC<ButtonProps> = (props) => {...}` 패턴이 있다. 한때 표준처럼 쓰였지만 지금은 권장되지 않는다. `React.FC`는 `children`을 암묵적으로 추가해 — 최신 버전에서는 빠졌지만 — 자식을 받지 않는 컴포넌트에도 `children`을 끼워 넣었고, 제네릭 컴포넌트와 잘 맞지 않으며, 반환 타입을 과하게 제약했다.

지금은 그냥 일반 함수에 props 타입을 직접 붙이는 방식이 표준이다.

```typescript
// 권장
function Button(props: ButtonProps) { /* ... */ }

// 굳이 FC를 쓸 필요 없음
const Button: React.FC<ButtonProps> = (props) => { /* ... */ };
```

함수 선언이든 화살표 함수든, props 타입을 인자에 직접 명시하면 `children`은 우리가 선언한 대로만 존재한다. 명시하지 않은 것은 받지 않는다 — 이게 React + TypeScript 타이핑의 기본 정신이다.

정리하면, props는 컴포넌트의 공개 계약이고 `children`은 그중 가장 특별한 자리다. 무엇이든 받는 `ReactNode`부터, 단일 엘리먼트만 받는 `ReactElement`, 값을 내려주는 함수형 children까지 — 받을 모양에 맞춰 타입을 좁히면 컴포넌트의 사용법이 타입만 봐도 드러난다. 다음 글에서는 컴포넌트 안쪽, 즉 `useState`·`useReducer`·`useRef` 같은 Hook들의 타이핑으로 들어간다.

---

**지난 글:** [fetch 타이핑 — Response와 unknown 기반 파싱](/posts/ts-typing-fetch/)

**다음 글:** [React Hooks 타이핑 — useState부터 useReducer까지](/posts/ts-react-hooks-typing/)

<br>
읽어주셔서 감사합니다. 😊
