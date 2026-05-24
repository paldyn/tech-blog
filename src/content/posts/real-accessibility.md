---
title: "웹 접근성(a11y) — ARIA와 키보드 내비게이션 구현"
description: "시맨틱 HTML, ARIA 속성, 키보드 내비게이션, 포커스 관리, 색 대비 기준 등 웹 접근성(a11y)의 핵심 개념과 React에서의 구현 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "React", "접근성", "a11y", "ARIA", "WCAG", "키보드내비게이션", "실전"]
featured: false
draft: false
---

[지난 글](/posts/real-i18n/)에서 react-i18next로 다국어 지원을 구현했습니다. 이번에는 **웹 접근성(Accessibility, a11y)**을 다룹니다. 접근성은 시각 장애인이나 운동 장애인만을 위한 것이 아닙니다. 화면 리더, 키보드만 사용하는 고급 사용자, 느린 네트워크 환경의 사용자 모두에게 더 나은 경험을 제공합니다. WCAG(Web Content Accessibility Guidelines) 2.1 AA 수준을 목표로 하는 것이 현재 산업 표준입니다.

![웹 접근성 — ARIA 속성과 역할](/assets/posts/real-accessibility-aria.svg)

## 시맨틱 HTML이 먼저다

가장 효과적인 접근성 개선은 **의미 있는 HTML 요소**를 사용하는 것입니다. `div`와 `span`으로 모든 것을 만들지 말고, 브라우저와 보조 기술이 이해하는 요소를 선택합니다.

```html
<!-- 나쁜 예 -->
<div class="button" onclick="submit()">제출</div>
<div class="nav">
  <div onclick="goto('/')">홈</div>
</div>

<!-- 좋은 예 -->
<button type="button" onclick="submit()">제출</button>
<nav>
  <ul>
    <li><a href="/">홈</a></li>
    <li><a href="/about">소개</a></li>
  </ul>
</nav>
```

시맨틱 요소는 키보드 접근(`Tab`, `Enter`, `Space`), 화면 리더 음성 출력, 검색 엔진 색인 모두를 자동으로 처리합니다. `div` 클릭은 이 세 가지를 모두 직접 구현해야 합니다.

## ARIA 속성

시맨틱 HTML만으로 표현할 수 없는 복잡한 UI 패턴에는 **ARIA(Accessible Rich Internet Applications)** 속성을 추가합니다.

```tsx
// 커스텀 다이얼로그
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-desc"
>
  <h2 id="dialog-title">계정 삭제</h2>
  <p id="dialog-desc">이 작업은 되돌릴 수 없습니다.</p>
  <button>확인</button>
  <button>취소</button>
</div>

// 확장/축소 패널 (아코디언)
<button
  aria-expanded={isOpen}
  aria-controls="panel-1"
>
  자주 묻는 질문
</button>
<div id="panel-1" hidden={!isOpen}>
  답변 내용...
</div>

// 로딩 상태
<button aria-busy={isLoading} disabled={isLoading}>
  {isLoading ? '처리 중...' : '제출'}
</button>
```

**ARIA 사용 원칙**: ARIA는 시맨틱 HTML을 *보완*하는 것입니다. 시맨틱 요소가 있다면 불필요한 ARIA를 추가하지 않습니다(예: `<button role="button">`은 중복).

## 라이브 영역 — 동적 콘텐츠 알림

화면이 업데이트될 때 화면 리더에 변화를 알리려면 `aria-live`를 사용합니다.

```tsx
function StatusMessage({ message }: { message: string }) {
  return (
    <div
      aria-live="polite"   // 현재 읽는 것이 끝난 후 알림
      aria-atomic="true"   // 전체 영역을 한 번에 읽음
      className="sr-only"  // 시각적으로 숨김, 스크린 리더는 읽음
    >
      {message}
    </div>
  );
}
```

`aria-live="assertive"`는 긴급 오류 메시지에만 사용합니다. 즉시 읽기를 중단하고 알리므로 남용하면 사용자를 방해합니다.

## 키보드 내비게이션과 포커스 관리

![키보드 내비게이션과 포커스 관리](/assets/posts/real-accessibility-focus.svg)

### 포커스 트랩 (Focus Trap)

모달이 열렸을 때 Tab 키가 모달 안에서만 순환하도록 합니다. 수동 구현은 복잡하므로 **Radix UI**나 **Headless UI** 같은 접근성 지원 라이브러리를 사용하는 것이 현실적입니다.

```tsx
import * as Dialog from '@radix-ui/react-dialog';

// Radix UI는 포커스 트랩, Escape 닫기, ARIA를 자동 처리
<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
  <Dialog.Trigger asChild>
    <button>열기</button>
  </Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay />
    <Dialog.Content>
      <Dialog.Title>제목</Dialog.Title>
      {/* 포커스 자동 이동, Tab 순환, Escape 닫기 내장 */}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

### 스킵 내비게이션

반복되는 내비게이션을 건너뛰고 본문으로 바로 이동하는 링크를 제공합니다.

```tsx
// App.tsx 최상단에 위치
<a href="#main-content" className="skip-link">
  본문으로 바로 가기
</a>

<main id="main-content">
  {/* 본문 */}
</main>
```

```css
.skip-link {
  position: absolute;
  left: -9999px;
}
.skip-link:focus {
  left: 0;
  top: 0;
  z-index: 9999;
  padding: 8px 16px;
  background: #000;
  color: #fff;
}
```

### 포커스 가시성

브라우저 기본 포커스 아웃라인을 제거(`outline: none`)하면 키보드 사용자가 현재 위치를 알 수 없습니다. 대신 더 나은 스타일로 교체합니다.

```css
/* 기본 outline 제거 대신 커스텀 포커스 스타일 */
:focus-visible {
  outline: 2px solid #7ec8e3;
  outline-offset: 2px;
}

/* 마우스 클릭 시에는 포커스 링 숨김 (키보드만 표시) */
:focus:not(:focus-visible) {
  outline: none;
}
```

## 색 대비와 시각적 접근성

```tsx
// 색만으로 상태를 전달하지 않기 — 아이콘 또는 텍스트 함께 제공
function FormField({ error }: { error?: string }) {
  return (
    <div>
      <input
        aria-invalid={!!error}
        aria-describedby={error ? 'error-msg' : undefined}
        style={{ borderColor: error ? 'red' : 'gray' }} // 색 + border
      />
      {error && (
        <span id="error-msg" role="alert">
          ⚠ {error} {/* 아이콘 + 텍스트 */}
        </span>
      )}
    </div>
  );
}
```

WCAG 2.1 AA 기준: 일반 텍스트 **4.5:1**, 대형 텍스트(18pt+) **3:1** 이상의 색 대비가 필요합니다.

## 자동화 테스트

```tsx
// jest-axe로 접근성 자동 검사
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('접근성 위반 없음', async () => {
  const { container } = render(<MyComponent />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

자동화 도구로는 모든 접근성 문제의 약 30~40%만 잡을 수 있습니다. 나머지는 실제 화면 리더(NVDA, VoiceOver)로 직접 테스트해야 합니다.

## 접근성 체크리스트

| 항목 | 방법 |
|---|---|
| 이미지 대체 텍스트 | `alt` 속성 (장식 이미지는 `alt=""`) |
| 폼 레이블 연결 | `<label htmlFor>` 또는 `aria-label` |
| 포커스 순서 논리적 | DOM 순서 = 시각적 순서 |
| 색 대비 4.5:1 | Chrome DevTools / axe |
| 키보드 단독 동작 | Tab + Enter + Space + Escape |
| 에러 메시지 연결 | `aria-describedby` |
| 동적 변경 알림 | `aria-live` |

---

**지난 글:** [국제화(i18n) — react-i18next로 다국어 지원 구현](/posts/real-i18n/)

**다음 글:** [다크 모드 — CSS 변수와 prefers-color-scheme 구현](/posts/real-dark-mode/)

<br>
읽어주셔서 감사합니다. 😊
