---
title: "React 타이핑 시작 — 컴포넌트와 props의 타입"
description: "React 컴포넌트와 props에 타입을 입히는 기본을 정리합니다. props 인터페이스 정의, React.FC를 쓰지 않는 이유, children과 ReactNode, 기본값과 옵셔널 props, HTML 속성 확장을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-15"
archiveOrder: 10
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "React", "props", "컴포넌트", "ReactNode", "타이핑"]
featured: false
draft: false
---

[지난 글](/posts/ts-eslint-typescript/)까지 TypeScript의 설정·빌드·품질 도구를 한 바퀴 돌았다. 이제 그 기초를 실전에 적용한다. 많은 개발자가 TypeScript를 가장 자주 만나는 무대가 **React** 다. JSX 속성이 잘못됐는지, 필수 prop을 빠뜨렸는지를 컴파일 타임에 잡아주는 것만으로도 React 개발 경험이 크게 달라진다. 그 출발점인 **컴포넌트와 props의 타입**부터 시작하자.

## props에 타입을 주면 사용처가 검사된다

React 컴포넌트는 결국 props를 받아 JSX를 반환하는 함수다. props에 타입을 주면, 그 컴포넌트를 JSX로 사용할 때 속성이 올바른지 검사된다.

![Props 타입이 컴포넌트를 거쳐 JSX 사용처까지 흐르는 모습](/assets/posts/ts-typing-react-props.svg)

```tsx
interface ButtonProps {
  label: string;
  onClick: () => void;
}

function Button(props: ButtonProps) {
  return <button onClick={props.onClick}>{props.label}</button>;
}

// 사용처
<Button label="저장" onClick={save} />;  // ✅
<Button label="저장" />;                  // ❌ onClick 누락
<Button label={42} onClick={save} />;     // ❌ label은 string
```

타입 하나로 "필수 prop 누락", "잘못된 prop 타입", "오타 난 prop 이름"이 전부 빌드 타임 에러가 된다. 이것이 React에 TypeScript를 쓰는 가장 직접적인 이득이다.

## interface vs type, 그리고 구조 분해

props 타입은 `interface`로도 `type`으로도 정의할 수 있다. 단일 객체 형태의 props에는 둘 다 잘 맞으며, 팀 컨벤션을 따르면 된다. 실무에서는 props를 구조 분해해서 받는 형태가 가장 흔하다.

![React.FC 없이 props에 직접 타입을 주는 함수 컴포넌트 예시](/assets/posts/ts-typing-react-component.svg)

```tsx
function Button({ label, onClick }: ButtonProps) {
  return <button onClick={onClick}>{label}</button>;
}
```

## React.FC를 권하지 않는 이유

예전 코드에서 `const Button: React.FC<ButtonProps> = (props) => ...` 형태를 자주 본다. 요즘은 **`React.FC`를 굳이 쓰지 않고 props에 직접 타입을 다는 방식**이 더 권장된다. 이유는 다음과 같다.

- `React.FC`는 과거 `children`을 암묵적으로 props에 끼워 넣어, children을 받지 않는 컴포넌트에도 children이 허용되는 문제가 있었다(이 동작은 이후 제거됐지만 혼란의 흔적이 남았다).
- 제네릭 컴포넌트를 만들 때 `React.FC`와 잘 어울리지 않는다.
- props에 직접 타입을 다는 쪽이 더 단순하고 일관적이다.

```tsx
// 권장: props에 직접 타입
function Button({ label }: ButtonProps) { /* ... */ }

// 비권장(요즘): React.FC
const Button: React.FC<ButtonProps> = ({ label }) => { /* ... */ };
```

## children과 ReactNode

자식 요소를 받는 컴포넌트라면 `children`을 명시적으로 선언한다. 자식의 타입은 보통 `React.ReactNode`다. 이 타입은 문자열·숫자·JSX 요소·배열·`null` 등 React가 렌더링할 수 있는 거의 모든 것을 포괄한다.

```tsx
interface CardProps {
  title: string;
  children?: React.ReactNode;
}

function Card({ title, children }: CardProps) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
```

"무엇이든 렌더링 가능한 자식"에는 `ReactNode`를, "단 하나의 JSX 요소"만 받고 싶다면 `React.ReactElement`를 쓴다. 대부분의 경우 `ReactNode`가 정답이다.

## 옵셔널 props와 기본값

`?`로 옵셔널 prop을 선언하고, 구조 분해에서 기본값을 준다. 옛 `defaultProps` 대신 이 방식이 함수 컴포넌트의 표준이다.

```tsx
interface BadgeProps {
  text: string;
  variant?: "info" | "warning"; // 옵셔널 + 리터럴 유니온
}

function Badge({ text, variant = "info" }: BadgeProps) {
  return <span className={variant}>{text}</span>;
}
```

`variant`에 `"info" | "warning"` 같은 리터럴 유니온을 쓰면, 허용된 값 외에는 자동 완성에도 안 뜨고 잘못된 값은 에러가 난다. 단순 `string`보다 훨씬 안전하다.

## 네이티브 HTML 속성 확장

버튼·인풋처럼 HTML 요소를 감싸는 컴포넌트는 보통 그 요소의 모든 표준 속성(`disabled`, `type`, `aria-*` 등)을 그대로 받고 싶다. 이때는 React가 제공하는 속성 타입을 확장한다.

```tsx
interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost";
}

function Button({ variant = "primary", ...rest }: ButtonProps) {
  return <button className={variant} {...rest} />;
}

// onClick, disabled, type 등 표준 속성 모두 사용 가능
<Button type="submit" disabled onClick={save} variant="ghost" />;
```

`React.ButtonHTMLAttributes<HTMLButtonElement>`를 확장하면 `<button>`의 모든 표준 속성을 자동으로 받고, 거기에 우리만의 prop(`variant`)을 더할 수 있다. 나머지 속성은 `...rest`로 받아 실제 `<button>`에 펼쳐 넘긴다. 이것이 재사용 가능한 UI 컴포넌트의 표준 패턴이다.

여기까지가 React 타이핑의 첫걸음이다. props에 타입을 주는 것만으로 컴포넌트 사용처 전체가 타입의 보호를 받는다. 이 시리즈의 다음 단계에서는 `useState`·`useReducer` 같은 훅의 타이핑, ref와 이벤트 핸들러, 그리고 제네릭 컴포넌트까지 React와 TypeScript의 결합을 더 깊이 파고든다.

---

**지난 글:** [typescript-eslint — 타입 인식 린팅 설정하기](/posts/ts-eslint-typescript/)

<br>
읽어주셔서 감사합니다. 😊
