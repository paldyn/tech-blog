---
title: "스냅샷 테스트의 함정 — 올바른 활용 패턴"
description: "스냅샷 테스트의 장단점, 거대 스냅샷 문제, 자동 승인 습관화, 인라인 스냅샷 패턴, 스냅샷이 적합한/부적합한 상황을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 7
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "스냅샷테스트", "Jest", "Vitest", "테스트품질", "인라인스냅샷", "toMatchSnapshot"]
featured: false
draft: false
---

[지난 글](/posts/test-mocking-strategies/)에서 테스트 더블 전략을 살펴봤습니다. 이번에는 **스냅샷 테스트**를 다룹니다. 스냅샷 테스트는 "이전에 올바르다고 판단한 출력과 지금 출력이 같은가"를 자동으로 검증합니다. 처음에는 작성이 쉬워서 인기를 얻지만, 잘못 사용하면 테스트 신뢰도를 오히려 떨어뜨립니다.

---

## 스냅샷 테스트란

Jest와 Vitest는 `toMatchSnapshot()`으로 임의의 직렬화 가능한 값을 스냅샷 파일(`.snap`)에 저장합니다. 이후 실행 시 현재 값과 저장된 값을 비교해 차이가 있으면 실패합니다.

```typescript
it('버튼 컴포넌트 스냅샷', () => {
  const { container } = render(<Button variant="primary">저장</Button>)
  expect(container.firstChild).toMatchSnapshot()
})
```

처음 실행하면 `__snapshots__/button.test.tsx.snap` 파일이 생성됩니다. 다음 실행부터는 이 파일과 비교합니다.

![스냅샷 테스트 워크플로우](/assets/posts/test-snapshot-pitfalls-workflow.svg)

---

## 스냅샷이 가져다주는 문제

### 1. 자동 승인 습관화

스냅샷 실패가 잦아지면 "뭔가 바뀌었나보다" 하고 `vitest -u`(update) 또는 `jest --updateSnapshot`을 무반사적으로 실행하게 됩니다. 이 시점에 스냅샷은 변경 감지 역할을 잃습니다.

```bash
# 이런 패턴이 반복되면 스냅샷이 무의미해짐
vitest -u   # 스냅샷 업데이트 → 실제 버그도 승인해버릴 수 있음
```

### 2. 거대 스냅샷

전체 컴포넌트 트리나 API 응답 전체를 스냅샷하면 수백 줄짜리 `.snap` 파일이 생깁니다. 코드 리뷰에서 스냅샷 diff를 제대로 검토하기 어렵고, 무관한 변경(CSS 클래스명 변경, 라이브러리 업그레이드)에서도 스냅샷이 깨집니다.

### 3. 테스트 의도 불명확

```
// 이 스냅샷이 무엇을 검증하는지 알 수 없음
expect(output).toMatchSnapshot()
// vs 명시적 어서션
expect(output.type).toBe('error')
expect(output.message).toContain('invalid email')
```

---

## 올바른 스냅샷 사용 패턴

### 인라인 스냅샷 선호

```typescript
it('에러 메시지 형식', () => {
  const error = formatApiError(new Error('Not Found'), 404)
  expect(error).toMatchInlineSnapshot(`
    {
      "code": 404,
      "message": "Not Found",
      "timestamp": Any<String>,
    }
  `)
})
```

`toMatchInlineSnapshot()`은 스냅샷을 외부 파일 대신 테스트 코드 안에 저장합니다. 코드 리뷰에서 테스트와 스냅샷을 한 화면에서 볼 수 있고, 스냅샷이 작을 수밖에 없어 거대 스냅샷 문제를 자연스럽게 방지합니다.

---

![스냅샷 테스트 코드 패턴](/assets/posts/test-snapshot-pitfalls-code.svg)

---

### 동적 값 마스킹

타임스탬프, UUID, 렌덤값 등은 스냅샷이 항상 깨지게 만듭니다.

```typescript
// 나쁜 예: 타임스탬프가 항상 달라서 깨짐
expect(createLog('error')).toMatchSnapshot()

// 좋은 예: 동적 값 마스킹
expect(createLog('error')).toMatchSnapshot({
  timestamp: expect.any(String),
  id: expect.any(String),
})

// 또는 타임스탬프를 고정
vi.setSystemTime(new Date('2026-01-01'))
expect(createLog('error')).toMatchInlineSnapshot(`
  { "level": "error", "timestamp": "2026-01-01T00:00:00.000Z" }
`)
```

---

## 스냅샷이 적합한 경우

스냅샷은 **안정적이고 의도적으로 관리되는 직렬화 결과물**에 적합합니다.

```typescript
// 1. 코드 생성기 출력 검증
it('타입 정의를 생성한다', () => {
  expect(generateTypes(schema)).toMatchSnapshot()
})

// 2. 에러 메시지 형식 검증 (짧고 안정적인 경우)
it('유효성 검사 에러 구조', () => {
  const errors = validate(invalidInput)
  expect(errors).toMatchInlineSnapshot(`
    [
      { "field": "email", "message": "이메일 형식이 올바르지 않습니다" },
    ]
  `)
})

// 3. CLI 도구 출력 검증
it('help 명령 출력', () => {
  expect(cli(['--help'])).toMatchSnapshot()
})
```

---

## 스냅샷 대신 명시적 어서션을 선호해야 하는 경우

컴포넌트가 올바르게 렌더링되는지 검증할 때는 스냅샷보다 Testing Library의 명시적 쿼리가 더 낫습니다.

```typescript
// 스냅샷 사용 (의도 불명확, 리팩토링에 취약)
expect(container).toMatchSnapshot()

// 명시적 어서션 (의도 명확, 구현 독립적)
expect(screen.getByRole('heading', { name: '사용자 프로필' })).toBeInTheDocument()
expect(screen.getByText(user.name)).toBeVisible()
expect(screen.getByRole('img', { name: user.name })).toHaveAttribute('src', user.avatarUrl)
```

명시적 어서션은 "무엇을 검증하는가"가 코드에서 드러납니다. 내부 마크업 구조가 바뀌어도 사용자에게 보이는 요소가 유지되면 테스트가 통과합니다.

---

## 스냅샷 리뷰 체크리스트

PR에서 스냅샷 변경이 있을 때 확인해야 할 사항입니다.

```
□ 이 스냅샷 변경이 의도된 것인가?
□ 변경된 diff를 실제로 읽었는가?
□ 삭제된 내용이 있다면 그것이 누락되어도 괜찮은가?
□ 스냅샷이 50줄 이상인가? → 범위 축소 고려
□ 동적 값(타임스탬프, ID)이 포함되어 있는가? → 마스킹 필요
```

---

**지난 글:** [Mock 전략 — Fake·Stub·Spy·Mock 완전 정리](/posts/test-mocking-strategies/)

**다음 글:** [커버리지와 테스트 신뢰성 — 숫자 너머의 품질](/posts/test-coverage-reliability/)

<br>
읽어주셔서 감사합니다. 😊
