---
title: "다크 모드 — CSS 변수와 prefers-color-scheme 구현"
description: "CSS 커스텀 프로퍼티와 data-theme 속성을 사용해 다크 모드를 구현하는 방법을 설명합니다. useTheme 훅 작성, SSR 깜빡임 방지, 시스템 설정 연동, Tailwind CSS dark 모드 설정을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "React", "다크모드", "CSS변수", "prefers-color-scheme", "테마", "실전"]
featured: false
draft: false
---

[지난 글](/posts/real-accessibility/)에서 웹 접근성(a11y) 구현 방법을 살펴봤습니다. 이번에는 현대 웹에서 사실상 필수가 된 **다크 모드**를 구현합니다. CSS 커스텀 프로퍼티(변수)와 `data-theme` 속성을 결합하면 JS 양을 최소화하면서도 사용자 선호를 저장하고, SSR 깜빡임도 방지할 수 있습니다.

![다크 모드 구현 전략 비교](/assets/posts/real-dark-mode-strategy.svg)

## 구현 전략 선택

세 가지 방식이 있습니다.

1. **미디어 쿼리만** — `@media (prefers-color-scheme: dark)` 단독 사용. 구현이 가장 단순하지만 사용자가 직접 전환할 수 없고 설정을 저장할 수 없습니다.
2. **`data-theme` 속성** (권장) — CSS 변수를 `[data-theme="dark"]` 선택자로 분기. JS로 제어하고 `localStorage`에 저장합니다. 미디어 쿼리와 병행도 가능합니다.
3. **Tailwind `dark:` 접두사** — `darkMode: 'class'` 설정 후 유틸리티 클래스로 다크 스타일 적용. Tailwind를 사용하는 프로젝트에 적합합니다.

## CSS 디자인 토큰 설계

![CSS 디자인 토큰으로 테마 관리](/assets/posts/real-dark-mode-tokens.svg)

```css
/* global.css */
:root,
[data-theme="light"] {
  --color-bg: #ffffff;
  --color-bg-secondary: #f5f5f5;
  --color-text: #111111;
  --color-text-muted: #666666;
  --color-primary: #0070f3;
  --color-border: #e5e5e5;
  --shadow-md: 0 4px 6px rgb(0 0 0 / 0.07);
}

[data-theme="dark"] {
  --color-bg: #0a0a0a;
  --color-bg-secondary: #111111;
  --color-text: #e8e8e8;
  --color-text-muted: #888888;
  --color-primary: #3b9eff;
  --color-border: #2a2a2a;
  --shadow-md: 0 4px 6px rgb(0 0 0 / 0.4);
}

/* 컴포넌트에서는 토큰만 사용 */
body {
  background: var(--color-bg);
  color: var(--color-text);
}
```

컴포넌트에서 직접 색상 값(`#ffffff`, `#0a0a0a`)을 쓰지 않고 CSS 변수만 참조하면, 테마 전환 시 CSS 변수만 교체하면 됩니다.

## useTheme 훅

```ts
// hooks/useTheme.ts
type Theme = 'light' | 'dark' | 'system';

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function applyTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemTheme() : theme;
  document.documentElement.dataset.theme = resolved;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem('theme') as Theme) ?? 'system',
  );

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // 시스템 테마 변경 감지 (system 모드일 때만)
  useEffect(() => {
    if (theme !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return { theme, setTheme: setThemeState };
}
```

`'system'` 모드는 OS 설정을 따르며, OS 설정이 바뀔 때 `change` 이벤트로 실시간 반영합니다.

## SSR 깜빡임 방지

React가 hydration을 시작하기 전에 일시적으로 잘못된 테마가 적용되어 화면이 번쩍이는 현상(**FOUC**)이 발생할 수 있습니다. 이를 막으려면 `<head>` 안에 인라인 스크립트를 삽입해 서버 렌더링 단계에서 즉시 테마를 적용합니다.

```html
<!-- public/index.html 또는 Next.js _document.tsx -->
<head>
  <!-- 다른 스크립트보다 먼저 실행 -->
  <script>
    (function() {
      var theme = localStorage.getItem('theme') || 'system';
      var resolved = theme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : theme;
      document.documentElement.dataset.theme = resolved;
    })();
  </script>
</head>
```

즉시 실행 함수(IIFE)로 감싸 전역 변수 오염을 막습니다.

### Next.js App Router

```tsx
// app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                var t = localStorage.getItem('theme') || 'system';
                var r = t === 'system'
                  ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                  : t;
                document.documentElement.dataset.theme = r;
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

`suppressHydrationWarning`은 `data-theme`이 서버와 클라이언트에서 다를 수 있다는 React의 hydration 경고를 억제합니다.

## 테마 전환 UI

```tsx
function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <select
      value={theme}
      onChange={(e) => setTheme(e.target.value as Theme)}
      aria-label="테마 선택"
    >
      <option value="system">시스템 설정</option>
      <option value="light">라이트</option>
      <option value="dark">다크</option>
    </select>
  );
}
```

## Tailwind CSS 다크 모드

Tailwind를 사용한다면 `darkMode: 'selector'`(Tailwind v3.4+) 또는 `'class'`로 설정합니다.

```ts
// tailwind.config.ts
export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  // ...
};
```

```tsx
<div className="bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
  <button className="border border-gray-200 dark:border-gray-700">
    클릭
  </button>
</div>
```

`data-theme="dark"`가 `html` 요소에 붙으면 `dark:` 접두사가 활성화됩니다. `useTheme` 훅과 완벽히 연동됩니다.

## CSS 전환 애니메이션

```css
/* 테마 전환 시 부드러운 색 변화 */
*,
*::before,
*::after {
  transition:
    background-color 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease;
}

/* 단, 사용자가 모션 감소를 선호하면 제거 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition: none !important;
  }
}
```

## 구현 체크리스트

| 항목 | 방법 |
|---|---|
| CSS 변수로 토큰화 | `--color-bg`, `--color-text` 등 |
| 사용자 설정 저장 | `localStorage.setItem('theme', ...)` |
| 시스템 설정 연동 | `matchMedia('(prefers-color-scheme: dark)')` |
| SSR 깜빡임 방지 | `<head>` 인라인 스크립트 |
| 모션 감소 존중 | `prefers-reduced-motion` |
| 접근성 | `aria-label`, 키보드 전환 가능 |

---

**지난 글:** [웹 접근성(a11y) — ARIA와 키보드 내비게이션 구현](/posts/real-accessibility/)

<br>
읽어주셔서 감사합니다. 😊
