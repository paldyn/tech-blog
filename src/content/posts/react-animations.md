---
title: "React에서 애니메이션 구현하기"
description: "CSS transition/keyframes부터 Framer Motion의 AnimatePresence까지, React 애니메이션 구현 방법을 단계적으로 설명합니다. 마운트·언마운트 애니메이션 처리 방법과 성능 주의사항도 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 1
type: "knowledge"
category: "React"
tags: ["React", "애니메이션", "FramerMotion", "CSSTransition", "AnimatePresence", "성능"]
featured: false
draft: false
---

[지난 글](/posts/react-focus-management/)에서 포커스 관리와 키보드 내비게이션을 다뤘다. 이번에는 React 앱에 생동감을 더하는 **애니메이션**을 살펴본다. "어떤 라이브러리를 써야 하나"에서 시작해 마운트·언마운트 시 동작까지 실전 관점으로 정리한다.

## 왜 애니메이션이 필요한가?

애니메이션은 단순한 치장이 아니다. 사용자에게 **상태 변화를 자연스럽게 인지**시키고, 조작의 결과를 확인시켜 준다. 버튼 클릭 후 즉각 사라지는 모달보다, 부드럽게 닫히는 모달이 훨씬 명확하다.

![React 애니메이션 방법 비교](/assets/posts/react-animations-approaches.svg)

## CSS 기반 애니메이션

가장 간단한 방법은 CSS `transition`과 `className` 토글이다.

```css
.box {
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.box.visible {
  opacity: 1;
  transform: translateY(0);
}
```

```tsx
function FadeBox({ show }: { show: boolean }) {
  return <div className={`box ${show ? 'visible' : ''}`}>내용</div>;
}
```

성능 측면에서 `opacity`와 `transform`만 변경하면 GPU가 처리해 레이아웃 재계산(reflow)이 발생하지 않는다. `width`, `height`, `top` 같은 레이아웃 속성을 애니메이션하면 매 프레임마다 reflow가 발생해 jank(끊김)의 원인이 된다.

### @keyframes로 반복·다단계 애니메이션

```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

.spinner {
  animation: spin 1s linear infinite;
}
```

로딩 인디케이터처럼 루프가 필요한 경우에 유용하다.

## react-transition-group

순수 CSS만으로는 **마운트·언마운트 타이밍**을 잡기 어렵다. 컴포넌트가 DOM에서 제거되면 exit 애니메이션을 실행할 기회가 없다. `react-transition-group`은 이 문제를 해결한다.

```tsx
import { CSSTransition } from 'react-transition-group';

function Modal({ show }: { show: boolean }) {
  return (
    <CSSTransition in={show} timeout={300} classNames="modal" unmountOnExit>
      <div className="modal">모달 내용</div>
    </CSSTransition>
  );
}
```

`in` prop이 `false`로 바뀌면 `modal-exit` → `modal-exit-active` 클래스가 순서대로 붙고, `timeout` 후 언마운트된다. CSS는 개발자가 직접 작성한다.

## Framer Motion

현재 React 생태계에서 가장 널리 쓰이는 애니메이션 라이브러리다. 선언적 API, 제스처 지원, 레이아웃 애니메이션 등을 제공한다.

```bash
npm install framer-motion
```

### 기본 사용법

```tsx
import { motion } from 'framer-motion';

function Card() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      카드 내용
    </motion.div>
  );
}
```

- `initial`: 마운트 직후 초기 상태
- `animate`: 목표 상태 (자동으로 전환)
- `transition`: 타이밍·이징 제어

### variants로 복잡한 상태 관리

```tsx
const variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

function AnimatedList({ items }: { items: string[] }) {
  return (
    <motion.ul variants={variants} initial="hidden" animate="visible">
      {items.map((item, i) => (
        <motion.li key={item} variants={variants}
          transition={{ delay: i * 0.1 }}>
          {item}
        </motion.li>
      ))}
    </motion.ul>
  );
}
```

부모의 `variants` 상태가 자식에게 자동으로 전파(orchestration)된다.

## AnimatePresence로 언마운트 애니메이션

![AnimatePresence 상태 흐름](/assets/posts/react-animations-states.svg)

React는 조건 렌더링으로 컴포넌트를 제거할 때 즉시 DOM에서 삭제한다. `AnimatePresence`는 `exit` prop을 정의한 컴포넌트가 트리에서 제거될 때 애니메이션이 완료될 때까지 DOM에 유지한다.

```tsx
import { AnimatePresence, motion } from 'framer-motion';

function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="toast"
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 50 }}
          transition={{ duration: 0.25 }}
          style={{ position: 'fixed', top: 20, right: 20 }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

`key` prop이 중요하다. `AnimatePresence`는 key를 기준으로 어느 자식이 나타나고 사라지는지 추적한다.

## hover · tap 인터랙션

```tsx
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.97 }}
  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
>
  클릭
</motion.button>
```

`spring` 타입은 물리 기반이라 자연스러운 느낌을 준다. `stiffness`(탄성)와 `damping`(감쇠)으로 조절한다.

## React Spring

물리 기반 애니메이션에 특화된 라이브러리다. 중간에 값이 바뀌어도 현재 속도를 유지하며 자연스럽게 전환한다.

```tsx
import { useSpring, animated } from '@react-spring/web';

function Counter({ value }: { value: number }) {
  const spring = useSpring({ number: value, from: { number: 0 } });

  return <animated.span>{spring.number.to((n) => n.toFixed(0))}</animated.span>;
}
```

숫자 카운터, 스크롤 기반 패럴랙스 등에서 강점을 발휘한다.

## 성능 체크리스트

| 항목 | 권장 |
|------|------|
| 애니메이션 속성 | `transform`, `opacity` 우선 |
| layout 속성 | `width`, `top` 등 피할 것 |
| will-change | 필요한 경우만 (메모리 증가) |
| 60fps 목표 | DevTools Performance 탭으로 확인 |

Framer Motion은 내부적으로 Web Animations API를 사용해 메인 스레드가 아닌 컴포지터 스레드에서 실행할 수 있다. `animate` prop에 `transform`·`opacity`만 사용하면 자동으로 GPU 가속이 적용된다.

## 라이브러리 선택 가이드

- **간단한 hover/fade**: CSS `transition` + className
- **마운트/언마운트 포함**: Framer Motion `AnimatePresence`
- **복잡한 오케스트라 시퀀스**: Framer Motion `variants`
- **물리 기반 인터랙티브**: React Spring
- **번들 크기 제로**: CSS Animations API / WAAPI (`useRef` + `.animate()`)

---

**지난 글:** [포커스 관리와 키보드 내비게이션](/posts/react-focus-management/)

**다음 글:** [에러 경계(Error Boundary)로 안전한 UI 만들기](/posts/react-error-boundaries/)

<br>
읽어주셔서 감사합니다. 😊
