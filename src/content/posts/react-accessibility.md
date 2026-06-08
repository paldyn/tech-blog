---
title: "React 접근성(a11y) 기초 — 스크린 리더와 시맨틱"
description: "React 앱을 장애인 사용자도 쓸 수 있게 만드는 접근성 기초를 다룹니다. HTML 시맨틱, ARIA 속성(aria-label, aria-live, role), 색상 대비, 키보드 접근성, 자동 검사 도구까지 실전 예제로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 9
type: "knowledge"
category: "React"
tags: ["접근성", "a11y", "ARIA", "스크린리더", "웹접근성", "WCAG"]
featured: false
draft: false
---

[지난 글](/posts/react-portals-deep/)에서 모달 구현 코드에 `role="dialog"`, `aria-modal="true"` 같은 속성이 등장했다. 이 글에서는 그 속성들이 왜 필요한지, 그리고 React 앱 전반에서 **접근성(Accessibility, a11y)을 어떻게 챙기는지** 체계적으로 설명한다.

## 접근성이란?

접근성은 **시각·청각·운동·인지 장애가 있는 사용자도 웹을 사용할 수 있도록** 만드는 것이다. 전 세계 약 15%의 인구가 어떤 형태로든 장애를 가지고 있으며, 고령자·일시적 부상자도 포함하면 그 범위는 더 넓다.

접근성은 "특별한 기능"이 아니라 **올바른 HTML과 의미 있는 마크업의 결과물**이다.

## 1. 시맨틱 HTML이 기본

스크린 리더는 HTML 태그의 역할을 기반으로 페이지를 해석한다. 의미에 맞는 태그를 쓰면 ARIA 속성 없이도 접근성이 대부분 확보된다.

```tsx
// ❌ div로 모든 것을 처리
<div onClick={handleSubmit} className="button">제출</div>

// ✓ 시맨틱 태그 사용
<button onClick={handleSubmit}>제출</button>

// ❌ div로 네비게이션
<div className="nav">
  <div onClick={() => navigate('/home')}>홈</div>
</div>

// ✓ nav + a 태그
<nav>
  <a href="/home">홈</a>
</nav>
```

`<button>`은 Tab 포커스, Enter·Space 클릭, 스크린 리더 "버튼" 안내까지 자동으로 처리해 준다. `<div onClick>`은 이 모든 것을 직접 구현해야 한다.

## 2. 핵심 ARIA 속성

HTML 시맨틱만으로 표현할 수 없는 상황에서 ARIA 속성을 사용한다.

![ARIA 핵심 속성](/assets/posts/react-accessibility-aria.svg)

### aria-label / aria-labelledby

시각적 텍스트가 없는 요소에 이름을 부여한다.

```tsx
// 아이콘 버튼 — 텍스트 없음
<button aria-label="검색">
  <SearchIcon />
</button>

// 제목 요소로 레이블 연결
<h2 id="section-title">상품 목록</h2>
<section aria-labelledby="section-title">
  ...
</section>
```

### aria-describedby

요소에 대한 상세 설명을 연결한다.

```tsx
<label htmlFor="password">비밀번호</label>
<input
  id="password"
  type="password"
  aria-describedby="password-hint"
/>
<p id="password-hint" className="hint">8자 이상, 영문·숫자 조합</p>
```

### aria-expanded

드롭다운·아코디언의 열림 상태를 알려준다.

```tsx
function Accordion({ title, content }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {title}
      </button>
      {isOpen && <div>{content}</div>}
    </div>
  );
}
```

### aria-live

동적으로 업데이트되는 영역을 스크린 리더에 알린다.

```tsx
// 폼 에러 메시지
<div role="alert" aria-live="assertive">
  {error && <span>{error}</span>}
</div>

// 검색 결과 수 — 즉각 알릴 필요 없음
<div aria-live="polite" aria-atomic="true">
  {resultCount !== null && `${resultCount}개 결과`}
</div>
```

- `"assertive"`: 즉시 읽어줌 (에러, 경고)
- `"polite"`: 현재 읽기가 끝난 후 읽어줌 (상태 메시지)

## 3. 폼 접근성

React에서 폼은 접근성 실수가 가장 많이 생기는 영역이다.

```tsx
function SignupForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div>
        <label htmlFor="email">이메일 *</label>
        <input
          id="email"
          type="email"
          required
          aria-required="true"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <span id="email-error" role="alert">
            {errors.email}
          </span>
        )}
      </div>
    </form>
  );
}
```

```tsx
// react-hook-form과 함께
const { register, formState: { errors } } = useForm();

<input
  {...register('email', { required: '이메일을 입력해주세요' })}
  aria-invalid={!!errors.email}
  aria-describedby={errors.email ? 'email-error' : undefined}
/>
```

## 4. 색상 대비

WCAG AA 기준으로 일반 텍스트는 **4.5:1 이상**, 대형 텍스트는 **3:1 이상** 대비를 권장한다.

```tsx
// ❌ 배경 #0a0a0a에 텍스트 #444444 — 대비 부족
<p style={{ color: '#444444' }}>안내 메시지</p>

// ✓ #888888 이상 사용
<p style={{ color: '#888888' }}>안내 메시지</p>
```

색상만으로 의미를 전달하면 안 된다.

```tsx
// ❌ 빨간색만으로 에러 표시
<span style={{ color: 'red' }}>{errorMessage}</span>

// ✓ 아이콘 + 텍스트 병행
<span style={{ color: '#e05555' }}>
  <ErrorIcon aria-hidden="true" /> {errorMessage}
</span>
```

## 5. 이미지 alt 텍스트

```tsx
// ✓ 의미 있는 이미지
<img src="profile.jpg" alt="홍길동 프로필 사진" />

// ✓ 장식용 이미지는 빈 alt
<img src="decoration.png" alt="" />

// ❌ alt 누락 (스크린 리더가 파일명을 읽음)
<img src="complex-chart.png" />

// ✓ 복잡한 차트는 긴 설명
<img
  src="chart.png"
  alt="2024년 분기별 매출"
  aria-describedby="chart-desc"
/>
<p id="chart-desc" className="sr-only">
  1분기 120만원, 2분기 150만원, ...
</p>
```

## 자동 검사 도구

```bash
# eslint-plugin-jsx-a11y: 정적 분석
npm install -D eslint-plugin-jsx-a11y

# .eslintrc
{ "extends": ["plugin:jsx-a11y/recommended"] }
```

```tsx
// 테스트에서 jest-axe 사용
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

it('has no accessibility violations', async () => {
  const { container } = render(<MyForm />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

![접근성 체크리스트](/assets/posts/react-accessibility-checklist.svg)

접근성은 "나중에 추가하는 것"이 아니라 컴포넌트를 처음 만들 때부터 시맨틱 태그를 선택하고 aria 속성을 붙이는 습관에서 시작된다. 다음 글에서는 접근성의 핵심 요소 중 하나인 **포커스 관리와 키보드 내비게이션**을 심화로 다룬다.

---

**지난 글:** [Portal 심화 — 모달과 토스트 직접 구현](/posts/react-portals-deep/)

**다음 글:** [포커스 관리와 키보드 내비게이션](/posts/react-focus-management/)

<br>
읽어주셔서 감사합니다. 😊
