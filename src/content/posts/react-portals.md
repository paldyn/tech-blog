---
title: "React Portal — DOM 경계 너머에 렌더링하기"
description: "React Portal의 동작 원리, createPortal API, 컴포넌트 트리와 DOM 트리의 분리 개념, 이벤트 버블링 특성, 그리고 모달·툴팁·드롭다운에서의 활용 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 7
type: "knowledge"
category: "React"
tags: ["Portal", "createPortal", "모달", "DOM렌더링", "React고급"]
featured: false
draft: false
---

[지난 글](/posts/react-virtualization/)에서 긴 목록의 렌더 성능 문제를 가상화로 해결하는 방법을 배웠다. 이번 글에서는 DOM의 특정 위치에 렌더링해야 할 때 사용하는 **React Portal**을 살펴본다.

## Portal이 필요한 이유

Modal 컴포넌트를 만들 때 가장 흔히 마주치는 문제가 있다. 컴포넌트 트리 깊은 곳에 있는 Modal이 부모의 CSS 스타일에 종속되어 버린다.

```tsx
// Dashboard → Sidebar → UserMenu → Modal 순서로 중첩
// Sidebar가 overflow: hidden이거나 z-index 스태킹 컨텍스트를 만들면
// Modal이 잘리거나 z-index가 의도대로 동작하지 않음
.sidebar {
  overflow: hidden;   /* Modal이 잘림 */
  position: relative; /* 새 스태킹 컨텍스트 */
}
```

이를 해결하려면 Modal의 **DOM 노드를 `<body>` 직하에 위치**시켜야 한다. 하지만 React 컴포넌트로서의 **부모-자식 관계는 그대로 유지**하고 싶다. 이 두 가지 요구를 동시에 만족시키는 것이 Portal이다.

![Portal 개념](/assets/posts/react-portals-concept.svg)

## createPortal API

```tsx
import { createPortal } from 'react-dom';

function Modal({ isOpen, onClose, children }: ModalProps) {
  if (!isOpen) return null;

  return createPortal(
    // 첫 번째 인자: 렌더할 React 요소
    <div className="modal-wrapper">
      {children}
    </div>,
    // 두 번째 인자: 마운트할 DOM 노드
    document.body,
  );
}
```

`createPortal`의 두 번째 인자는 **렌더 결과가 마운트될 DOM 노드**다. `document.body` 외에도 `document.getElementById('modal-root')` 같은 별도 컨테이너를 지정할 수 있다.

## HTML 준비

```html
<!-- index.html -->
<body>
  <div id="root"></div>
  <div id="modal-root"></div>  <!-- Portal 마운트 대상 -->
</body>
```

```tsx
// 별도 컨테이너를 사용할 때
createPortal(
  <ModalContent />,
  document.getElementById('modal-root')!,
);
```

별도 컨테이너를 쓰면 z-index 관리가 더 예측 가능해진다.

## 이벤트 버블링 특성

Portal의 핵심 특성 중 하나는 **이벤트가 DOM 트리가 아닌 React 컴포넌트 트리를 따라 버블링**된다는 점이다.

```tsx
function Parent() {
  const handleClick = () => console.log('Parent clicked');

  return (
    <div onClick={handleClick}>
      <Modal isOpen>
        <button>모달 버튼</button>
        {/* 버튼 클릭 → Modal → Parent 순으로 버블링 */}
        {/* DOM에서는 #modal-root 안에 있지만 이벤트는 Parent까지 전파 */}
      </Modal>
    </div>
  );
}
```

이 동작은 **Context도 동일하게 적용**된다. Portal 안의 컴포넌트는 컴포넌트 트리 기준 부모의 Context에 접근할 수 있다.

```tsx
// ThemeContext.Provider가 Portal 위쪽 트리에 있어도
// Portal 안에서 useContext(ThemeContext) 사용 가능
function ModalContent() {
  const { theme } = useContext(ThemeContext);  // ✓ 정상 접근
  return <div className={theme}>...</div>;
}
```

## Portal 사용처

![Portal 사용 패턴](/assets/posts/react-portals-usage.svg)

| 컴포넌트 | 이유 |
|---|---|
| 모달 / 다이얼로그 | overflow:hidden 탈출, z-index 최상위 |
| 툴팁 | 부모 overflow 탈출, 뷰포트 기준 위치 |
| 드롭다운 / 팝오버 | table·fixed 컨테이너 탈출 |
| 토스트 / 스낵바 | 항상 화면 최상단에 표시 |
| 커서 팔로우 효과 | 전체 화면 이벤트 영역 |

## React 19의 portal 변화

React 19부터는 `<dialog>` 태그와의 조합이 더 자연스러워졌다. `<dialog>` 요소 자체가 브라우저 네이티브 스태킹을 관리하므로 Portal 없이도 z-index 문제를 피할 수 있는 경우가 늘었다.

```tsx
// React 19+ dialog 네이티브 활용 (Portal 불필요)
function NativeModal({ isOpen, onClose }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (isOpen) ref.current?.showModal();
    else ref.current?.close();
  }, [isOpen]);

  return (
    <dialog ref={ref} onClose={onClose}>
      <form method="dialog">
        <button>닫기</button>
      </form>
    </dialog>
  );
}
```

다음 글에서는 Portal을 활용한 **모달과 토스트 알림을 실제로 구현**하는 심화 예제를 다룬다.

---

**지난 글:** [가상화(Virtualization)로 긴 목록 성능 최적화](/posts/react-virtualization/)

**다음 글:** [Portal 심화 — 모달과 토스트 직접 구현](/posts/react-portals-deep/)

<br>
읽어주셔서 감사합니다. 😊
