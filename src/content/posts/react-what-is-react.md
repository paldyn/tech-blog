---
title: "React란 무엇인가"
description: "React의 핵심 철학인 선언형 UI와 컴포넌트 기반 설계를 이해하고, UI = f(state) 공식이 왜 강력한지 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 1
type: "knowledge"
category: "React"
tags: ["React", "프론트엔드", "선언형UI", "컴포넌트", "JavaScript"]
featured: false
draft: false
---

React는 Meta(구 Facebook)가 만들고 오픈소스로 공개한 **UI 라이브러리**입니다. 2013년 등장 이후 프론트엔드 생태계의 사실상 표준으로 자리 잡았고, 현재 전 세계 수백만 개의 서비스가 React로 구축되어 있습니다. 이 시리즈에서는 React의 가장 기본 개념부터 Next.js를 활용한 실무 패턴까지 단계적으로 살펴봅니다.

---

## 선언형(Declarative) vs 명령형(Imperative)

React를 이해하는 첫 번째 열쇠는 **선언형 프로그래밍** 패러다임입니다.

**명령형 방식**은 DOM을 직접 조작합니다. 버튼 클릭 시 카운트를 보여주려면 요소를 찾고, 값을 읽고, 수정하는 과정을 개발자가 일일이 지시해야 합니다.

```javascript
// 명령형: "어떻게" 바꿀지 단계별로 지시
const el = document.getElementById('count');
el.textContent = Number(el.textContent) + 1;
el.style.color = count > 10 ? 'red' : 'black';
```

**선언형 방식(React)**은 "지금 상태에서 UI가 어떻게 보여야 하는가"만 기술합니다. 실제 DOM 변경은 React가 알아서 처리합니다.

```jsx
// 선언형: "어떤 모습이어야 할지"만 선언
function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button
      style={{ color: count > 10 ? 'red' : 'black' }}
      onClick={() => setCount(c => c + 1)}
    >
      {count}
    </button>
  );
}
```

상태(`count`)가 바뀌면 React가 새 UI를 계산하고 변경된 부분만 DOM에 반영합니다. 개발자는 상태 전환 로직에만 집중할 수 있습니다.

---

## UI = f(state)

React의 핵심 철학은 한 줄로 요약됩니다.

> **UI = f(state)**

UI는 상태(state)의 순수 함수입니다. 동일한 상태를 넣으면 항상 동일한 UI가 나옵니다. 이 단순한 원칙 덕분에 UI의 동작을 예측하고, 테스트하고, 디버깅하는 일이 훨씬 쉬워집니다.

![React 선언형 UI 개요](/assets/posts/react-what-is-react-overview.svg)

---

## React의 세 가지 핵심 특징

### 1. 컴포넌트 기반

React는 UI를 **독립적이고 재사용 가능한 컴포넌트**로 분리합니다. 헤더, 버튼, 카드, 폼 같은 조각들을 각각 컴포넌트로 만들고 조합해 전체 화면을 구성합니다.

```jsx
// 재사용 가능한 버튼 컴포넌트
function Button({ label, onClick, variant = 'primary' }) {
  return (
    <button className={`btn btn-${variant}`} onClick={onClick}>
      {label}
    </button>
  );
}

// 여러 곳에서 조합
function App() {
  return (
    <div>
      <Button label="저장" onClick={handleSave} />
      <Button label="취소" onClick={handleCancel} variant="secondary" />
    </div>
  );
}
```

### 2. 단방향 데이터 흐름

데이터는 항상 **부모 → 자식** 방향으로만 흐릅니다(props). 자식이 부모의 상태를 바꾸려면 부모가 내려준 콜백 함수를 호출합니다. 이 단방향 흐름 덕분에 데이터가 어디서 와서 어디로 가는지 추적하기 쉽습니다.

### 3. 가상 DOM(Virtual DOM)

상태가 변경될 때마다 React는 메모리상의 가상 DOM 트리를 새로 만들고, 이전 트리와 비교(diffing)합니다. 실제로 달라진 노드만 실제 DOM에 반영하므로 불필요한 DOM 조작을 최소화합니다.

---

## React는 프레임워크가 아니다

React는 **라이브러리**입니다. UI 렌더링만 담당하며, 라우팅·상태 관리·서버 통신은 별도 라이브러리와 조합합니다.

![React 생태계](/assets/posts/react-what-is-react-ecosystem.svg)

완전한 애플리케이션을 만들 때는 보통 React 위에 **메타 프레임워크**를 얹습니다. 이 시리즈 후반부에서 다룰 **Next.js**가 가장 대표적입니다. Next.js는 파일 기반 라우팅, 서버 사이드 렌더링, API 라우트 등을 제공해 React만으로는 부족한 부분을 채워 줍니다.

---

## React를 배우는 로드맵

이 시리즈는 다음 순서로 진행됩니다.

1. **JSX와 컴포넌트** — React의 문법과 기본 단위
2. **props와 상태** — 데이터 전달과 반응형 UI
3. **렌더링 모델** — Virtual DOM과 재조정 알고리즘
4. **Hooks** — 함수형 컴포넌트의 상태·사이드 이펙트 관리
5. **성능 최적화** — 메모이제이션과 동시성 기능
6. **Next.js** — 프로덕션 수준의 React 애플리케이션

---

**다음 글:** [JSX 문법 이해하기](/posts/react-jsx/)

<br>
읽어주셔서 감사합니다. 😊
