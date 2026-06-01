---
title: "컴파운드 컴포넌트 패턴"
description: "부모-자식 컴포넌트가 Context로 상태를 공유하는 컴파운드 컴포넌트 패턴의 원리, Tabs·Select·Accordion 같은 UI 컴포넌트 구현법, 장단점과 적용 기준을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 6
type: "knowledge"
category: "React"
tags: ["React", "컴파운드컴포넌트", "CompoundComponents", "Context", "디자인패턴", "재사용"]
featured: false
draft: false
---

[지난 글](/posts/react-composition-vs-inheritance/)에서 children과 슬롯 props로 컴포지션을 구현했다. 컴파운드 컴포넌트 패턴은 한 단계 더 나아간다. 여러 서브 컴포넌트가 Context를 통해 암묵적으로 상태를 공유하고, 사용자는 내부 구현을 몰라도 선언적이고 유연하게 조합할 수 있다. Tabs, Select, Accordion, Menu 같은 UI 컴포넌트를 만들 때 빛을 발한다.

## 왜 컴파운드 컴포넌트인가

단순한 Select 컴포넌트를 만든다고 생각해보자.

```jsx
// 방법 1: 모든 것을 props로 전달 — 유연성 없음
<Select options={[{value: 'a', label: 'A'}]} value={val} onChange={setVal} />

// 방법 2: 컴파운드 컴포넌트 — 선언적이고 유연
<Select defaultValue="a">
  <Select.Trigger />
  <Select.List>
    <Select.Option value="a">A</Select.Option>
    <Select.Option value="b" disabled>B (비활성)</Select.Option>
  </Select.List>
</Select>
```

방법 2는 각 서브 컴포넌트를 자유롭게 배치하고, 추가 props나 커스텀 렌더링을 쉽게 적용할 수 있다.

![컴파운드 컴포넌트 패턴 다이어그램](/assets/posts/react-compound-components-diagram.svg)

## Context로 상태 공유

핵심은 루트 컴포넌트가 Context를 만들고 서브 컴포넌트들이 그것을 구독하는 것이다.

```jsx
const TabsContext = createContext(null);

function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs 컴포넌트 내부에서만 사용 가능합니다');
  return ctx;
}
```

![컴파운드 컴포넌트 구현 — Tabs 예제](/assets/posts/react-compound-components-code.svg)

## 완전한 Tabs 구현

```jsx
import { createContext, useContext, useState } from 'react';

const TabsContext = createContext(null);

function Tabs({ defaultTab, children }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className="tabs">{children}</div>
    </TabsContext.Provider>
  );
}

Tabs.TabList = function TabList({ children }) {
  return <div role="tablist" className="tab-list">{children}</div>;
};

Tabs.Tab = function Tab({ id, children }) {
  const { activeTab, setActiveTab } = useContext(TabsContext);
  return (
    <button
      role="tab"
      aria-selected={activeTab === id}
      onClick={() => setActiveTab(id)}
      className={activeTab === id ? 'tab active' : 'tab'}
    >
      {children}
    </button>
  );
};

Tabs.Panel = function Panel({ id, children }) {
  const { activeTab } = useContext(TabsContext);
  if (activeTab !== id) return null;
  return (
    <div role="tabpanel" className="tab-panel">
      {children}
    </div>
  );
};

// 사용
function App() {
  return (
    <Tabs defaultTab="react">
      <Tabs.TabList>
        <Tabs.Tab id="react">React</Tabs.Tab>
        <Tabs.Tab id="vue">Vue</Tabs.Tab>
        <Tabs.Tab id="svelte">Svelte</Tabs.Tab>
      </Tabs.TabList>
      <Tabs.Panel id="react">
        <p>React는 Facebook이 만든 UI 라이브러리입니다.</p>
      </Tabs.Panel>
      <Tabs.Panel id="vue">
        <p>Vue는 Evan You가 만든 프레임워크입니다.</p>
      </Tabs.Panel>
      <Tabs.Panel id="svelte">
        <p>Svelte는 컴파일 타임에 최적화하는 프레임워크입니다.</p>
      </Tabs.Panel>
    </Tabs>
  );
}
```

## 제어 모드 지원 (Controlled)

외부에서 탭을 제어하고 싶다면 `value`와 `onChange`를 받아 제어 컴포넌트로 동작하게 할 수 있다.

```jsx
function Tabs({ defaultTab, value, onChange, children }) {
  const [internalTab, setInternalTab] = useState(defaultTab);

  const activeTab = value !== undefined ? value : internalTab;
  const setActiveTab = onChange ?? setInternalTab;

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className="tabs">{children}</div>
    </TabsContext.Provider>
  );
}

// 비제어 (기본)
<Tabs defaultTab="a">...</Tabs>

// 제어 (외부 state로 관리)
<Tabs value={activeTab} onChange={setActiveTab}>...</Tabs>
```

## 적용 기준

컴파운드 컴포넌트가 적합한 경우는 두 가지다. 첫째, 여러 서브 컴포넌트가 하나의 상태를 공유해야 하고, 사용자가 서브 컴포넌트의 배치를 자유롭게 결정해야 할 때다. 둘째, Headless UI처럼 로직과 구조만 제공하고 스타일은 사용자에게 맡길 때다.

필드가 고정되어 있고 단순히 `options` 배열과 `value`를 받으면 충분한 컴포넌트라면 일반 props로도 충분하다. 컴파운드 패턴은 유연성이 필요할 때 사용한다.

다음 글에서는 함수를 prop으로 전달해 렌더링 로직을 외부에서 주입하는 렌더 프롭 패턴을 다룬다.

---

**지난 글:** [컴포지션 vs 상속](/posts/react-composition-vs-inheritance/)

**다음 글:** [렌더 프롭 패턴](/posts/react-render-props/)

<br>
읽어주셔서 감사합니다. 😊
