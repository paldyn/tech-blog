---
title: "상태 끌어올리기 (Lifting State Up)"
description: "여러 컴포넌트가 같은 데이터를 공유해야 할 때 상태를 공통 부모로 끌어올리는 패턴, 부모→자식 props와 자식→부모 콜백 흐름, 실전 온도 변환 예제를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 4
type: "knowledge"
category: "React"
tags: ["React", "LiftingStateUp", "상태끌어올리기", "단방향데이터흐름", "props", "콜백"]
featured: false
draft: false
---

[지난 글](/posts/react-react-hook-form/)에서 React Hook Form으로 폼 상태를 효율적으로 다뤘다. 이번에는 컴포넌트 사이에서 상태를 공유하는 가장 기본적인 방법인 상태 끌어올리기를 다룬다. Context나 외부 상태 관리 라이브러리가 필요 없는 상황에서 React의 단방향 데이터 흐름을 이해하는 데 핵심이 되는 패턴이다.

## 문제: 형제 컴포넌트끼리 상태를 공유할 수 없다

두 컴포넌트가 각자의 state를 가지면 서로의 상태를 알 방법이 없다. React에서 데이터는 부모→자식 방향으로만 흐르기 때문이다.

```jsx
// 문제: 각 자식이 독립된 상태를 가짐
function ChildA() {
  const [count, setCount] = useState(0); // ChildB가 이 값을 모름
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;
}

function ChildB() {
  // ChildA의 count에 접근할 방법 없음
  return <p>ChildA의 count를 표시하고 싶다</p>;
}
```

![상태 끌어올리기 다이어그램](/assets/posts/react-lifting-state-diagram.svg)

## 해결: 공통 부모로 상태를 끌어올린다

해결책은 두 컴포넌트의 가장 가까운 공통 조상에 상태를 두고, 자식에게는 props로 값과 변경 콜백을 내려주는 것이다.

```jsx
function Parent() {
  const [count, setCount] = useState(0); // 공통 부모에 상태 위치

  return (
    <>
      <ChildA count={count} onIncrement={() => setCount(c => c + 1)} />
      <ChildB count={count} />
    </>
  );
}

function ChildA({ count, onIncrement }) {
  return <button onClick={onIncrement}>{count}</button>;
}

function ChildB({ count }) {
  return <p>현재 카운트: {count}</p>;
}
```

이제 ChildA에서 버튼을 클릭하면 Parent의 state가 바뀌고, 두 자식이 모두 새 값으로 리렌더된다.

## 실전 예제: 온도 변환기

React 공식 문서의 고전적인 예제다. 섭씨와 화씨 입력창이 서로를 실시간으로 동기화해야 한다.

![상태 끌어올리기 온도 변환 예제](/assets/posts/react-lifting-state-code.svg)

```jsx
function toCelsius(f) {
  return (f - 32) * 5 / 9;
}

function toFahrenheit(c) {
  return c * 9 / 5 + 32;
}

function tryConvert(temperature, convert) {
  const input = parseFloat(temperature);
  if (Number.isNaN(input)) return '';
  return String(Math.round(convert(input) * 1000) / 1000);
}

function TemperatureInput({ scale, value, onTemperatureChange }) {
  const name = scale === 'c' ? '섭씨' : '화씨';
  return (
    <fieldset>
      <legend>{name}로 입력:</legend>
      <input value={value} onChange={e => onTemperatureChange(e.target.value)} />
    </fieldset>
  );
}

function Calculator() {
  const [temperature, setTemperature] = useState('');
  const [scale, setScale] = useState('c');

  const celsius = scale === 'f' ? tryConvert(temperature, toCelsius) : temperature;
  const fahrenheit = scale === 'c' ? tryConvert(temperature, toFahrenheit) : temperature;

  return (
    <div>
      <TemperatureInput
        scale="c"
        value={celsius}
        onTemperatureChange={t => { setTemperature(t); setScale('c'); }}
      />
      <TemperatureInput
        scale="f"
        value={fahrenheit}
        onTemperatureChange={t => { setTemperature(t); setScale('f'); }}
      />
      {parseFloat(celsius) >= 100 && <p>물이 끓습니다!</p>}
    </div>
  );
}
```

두 입력창이 각자 상태를 갖지 않는다. 어느 쪽에 입력해도 `Calculator`의 `temperature`와 `scale`이 업데이트되고, 두 입력창 모두 그 값으로 리렌더된다. 파생된 값(`celsius`, `fahrenheit`)은 render 중 계산되어 항상 일관성을 유지한다.

## 끌어올리기의 적용 기준

**같은 데이터를 두 컴포넌트가 동시에 필요로 할 때** 상태를 끌어올린다. 가장 가까운 공통 조상이 상태를 소유해야 한다. 너무 높이 올리면(루트까지) 불필요한 리렌더가 생기고 코드 추적이 어려워진다.

```
App
├── Header       ← count 필요 없음
├── Sidebar      ← count 필요 없음
└── Main
    ├── Counter  ← count 사용
    └── Display  ← count 사용

→ count는 Main에 위치해야 함. App에 올리면 Header·Sidebar도 리렌더됨
```

## 콜백 이름 짓기

자식에게 내려주는 콜백 props는 이벤트 핸들러처럼 `on` 접두사로 이름 짓는다.

```jsx
// 좋은 예
<SearchBar searchText={text} onSearchChange={handleSearchChange} />

// 피할 예
<SearchBar searchText={text} changeSearch={handleSearchChange} />
```

이벤트 핸들러 컨벤션을 따르면 props가 "이 컴포넌트 내부에서 어떤 일이 일어날 때 호출될 콜백"임을 명확히 전달한다.

상태 끌어올리기는 단방향 데이터 흐름의 직접적인 표현이다. 다음 글에서는 React가 상속 대신 컴포지션을 선택한 이유와 다양한 컴포지션 패턴을 다룬다.

---

**지난 글:** [React Hook Form으로 폼 관리](/posts/react-react-hook-form/)

**다음 글:** [컴포지션 vs 상속](/posts/react-composition-vs-inheritance/)

<br>
읽어주셔서 감사합니다. 😊
