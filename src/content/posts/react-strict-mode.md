---
title: "StrictMode — 개발 환경 품질 검사 도구"
description: "React.StrictMode가 개발 모드에서 이중 실행을 통해 어떤 문제를 감지하는지, 프로덕션에는 영향이 없는 이유, 이중 실행에서 깨지는 코드 패턴과 올바른 수정 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 6
type: "knowledge"
category: "React"
tags: ["React", "StrictMode", "개발모드", "디버깅", "useEffect", "클린업", "품질검사"]
featured: false
draft: false
---

[지난 글](/posts/react-key-reconciliation/)에서 key prop의 역할과 올바른 사용법을 살펴봤다. 이번에는 개발 환경에서 React 코드의 품질을 검사해주는 `StrictMode`를 다룬다. StrictMode는 처음 보면 버그처럼 느껴질 수 있지만, 실제로는 중요한 문제를 미리 잡아주는 안전망이다.

## StrictMode란

`React.StrictMode`는 애플리케이션의 잠재적 문제를 감지하기 위한 개발 전용 도구다. 런타임에 경고를 추가하고, 특정 함수를 이중으로 호출해 부수효과를 드러낸다.

**프로덕션 빌드에서는 완전히 비활성화**된다. 따라서 성능에 영향이 없다.

```jsx
// main.jsx 또는 index.jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

Create React App, Vite의 React 템플릿, Next.js 모두 기본적으로 StrictMode를 활성화한다.

## 이중 실행: 마운트 → 언마운트 → 재마운트

React 18의 StrictMode에서 가장 두드러지는 동작은 **컴포넌트 이중 마운트**다. 개발 모드에서 컴포넌트를 처음 마운트할 때 React가 다음 순서로 실행한다.

1. 컴포넌트 마운트 (effect 실행)
2. 즉시 언마운트 (cleanup 실행)
3. 재마운트 (effect 재실행)

사용자에게는 최종 마운트된 상태만 보인다.

![StrictMode 이중 실행 동작](/assets/posts/react-strict-mode-double.svg)

```jsx
function Example() {
  useEffect(() => {
    console.log('effect 실행');
    return () => console.log('cleanup 실행');
  }, []);

  return <div>예시</div>;
}

// StrictMode 개발 모드 콘솔 출력:
// effect 실행
// cleanup 실행
// effect 실행
```

처음 보면 버그처럼 느껴지지만 의도적인 설계다.

## 왜 이중 실행하는가

이중 실행의 목적은 **cleanup 없는 effect를 찾아내는 것**이다.

```jsx
// 잘못된 코드 — cleanup 없는 이벤트 리스너
useEffect(() => {
  window.addEventListener('resize', handleResize);
  // cleanup 없음!
}, []);

// 이중 실행 시:
// 1차 마운트: resize 리스너 등록
// cleanup: (없음)
// 2차 마운트: resize 리스너 또 등록
// → 핸들러가 두 번 실행됨!
```

```jsx
// 올바른 코드 — cleanup 있음
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);

// 이중 실행 시:
// 1차 마운트: 리스너 등록
// cleanup: 리스너 제거
// 2차 마운트: 리스너 다시 등록 → 1개만 존재
```

cleanup을 올바르게 작성했다면 이중 실행해도 최종 결과는 동일하다. cleanup이 없거나 잘못됐다면 버그가 드러난다.

## 감지하는 문제들

![StrictMode가 감지하는 문제들](/assets/posts/react-strict-mode-checks.svg)

**비순수 컴포넌트**: 렌더 함수가 매번 다른 결과를 반환하거나 외부 상태를 변경하는 경우다.

```jsx
// 잘못된 코드 — 렌더 중 외부 변수 변경
let renderCount = 0;
function Component() {
  renderCount++; // 외부 변수 수정 — 이중 실행 시 2씩 증가
  return <div>렌더 {renderCount}회</div>;
}
```

**Deprecated API 사용**: `findDOMNode`, 레거시 Context API(`childContextTypes`), `componentWillMount` 등을 사용하면 콘솔에 경고가 표시된다.

**Ref 남용**: 렌더 도중 ref를 읽는 패턴도 감지한다.

## StrictMode 경고 대응 방법

StrictMode 경고가 나타났을 때 `// eslint-disable` 처럼 무시하는 것은 옳지 않다. 해당 경고는 프로덕션에서 문제가 될 수 있다는 신호다.

```jsx
// 흔한 패턴: 이중 실행에서 두 번 호출되면 안 되는 작업
useEffect(() => {
  // 잘못된 해결: 플래그로 막기
  let initialized = false;
  if (!initialized) {
    initTracking();
    initialized = true; // 이중 실행 시에도 막힘
  }
  // 하지만 이건 근본 해결이 아님

  // 올바른 해결: cleanup으로 초기화를 되돌리기
  initTracking();
  return () => destroyTracking();
}, []);
```

**StrictMode와 잘 맞는 코드**가 곧 **예측 가능하고 안전한 코드**다. StrictMode 경고를 모두 해소한 코드는 React의 Concurrent 기능과도 잘 호환된다.

## 특정 컴포넌트만 StrictMode에서 제외

부득이하게 서드파티 라이브러리가 StrictMode와 호환되지 않는 경우, 해당 컴포넌트 주변만 StrictMode를 제거할 수 있다. 하지만 전체 앱에서 StrictMode를 끄는 것은 권장하지 않는다.

```jsx
// 특정 구역만 StrictMode 제외 (권장하지 않음)
function App() {
  return (
    <StrictMode>
      <MainContent />
      {/* LegacyLib이 StrictMode와 호환 안 될 때만 */}
      <LegacyWrapper />
    </StrictMode>
  );
}
```

React 팀은 모든 새 코드를 StrictMode 호환으로 작성할 것을 권장한다.

---

**지난 글:** [key와 재조정](/posts/react-key-reconciliation/)

**다음 글:** [하이드레이션 — SSR과 React 연결하기](/posts/react-hydration/)

<br>
읽어주셔서 감사합니다. 😊
