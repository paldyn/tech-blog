---
title: "Testing Library 쿼리 완전 정리 — getBy, queryBy, findBy"
description: "React Testing Library의 쿼리 시스템을 해부합니다. getBy·queryBy·findBy의 동작 차이와 선택 기준, getByRole이 1순위인 이유, 쿼리 우선순위와 접근성의 관계, within을 이용한 범위 한정 질의까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 6
type: "knowledge"
category: "React"
tags: ["TestingLibrary", "쿼리", "getByRole", "접근성", "테스트"]
featured: false
draft: false
---

[지난 글](/posts/react-testing-library/)에서 React Testing Library의 철학과 기본 흐름을 익혔다. 테스트 코드의 품질은 사실상 **요소를 어떻게 찾느냐**에서 결정된다. 쿼리를 잘못 고르면 불안정한 테스트가 되고, 접근성이 나쁜 마크업을 그대로 방치하게 된다. 이번 글에서는 쿼리 시스템을 변형(variant)과 우선순위 두 축으로 완전히 정리한다.

## 첫 번째 축 — getBy, queryBy, findBy

모든 쿼리는 접두사에 따라 **요소가 없을 때의 동작**이 달라진다.

![getBy vs queryBy vs findBy](/assets/posts/react-rtl-queries-matrix.svg)

```tsx
// getBy: 없으면 즉시 에러 — "반드시 있어야 한다"는 단언을 겸한다
const button = screen.getByRole('button', { name: '저장' });

// queryBy: 없으면 null — "없음"을 단언할 때만 사용
expect(screen.queryByText('에러 발생')).not.toBeInTheDocument();

// findBy: Promise 반환 — 비동기로 나타날 요소를 기다린다 (기본 1초 폴링)
const userName = await screen.findByText('김개발');
```

선택 기준은 단순하다.

- 요소가 **지금 있어야 한다** → `getBy`
- 요소가 **없음을 확인한다** → `queryBy`
- 요소가 **곧 나타난다** → `findBy`

흔한 실수는 존재 확인에 `queryBy`를 쓰는 것이다. `getBy`는 실패 시 현재 DOM을 출력해 주는 친절한 에러를 던지지만, `queryBy`는 null을 반환해 `expect(null).toBeInTheDocument()` 같은 덜 명확한 실패 메시지로 이어진다. `queryBy`의 용도는 부재(不在) 단언 하나뿐이라고 기억하자.

복수 요소 버전도 같은 규칙을 따른다.

```tsx
// 목록 아이템처럼 여러 개를 다룰 때
const items = screen.getAllByRole('listitem');       // 0개면 에러
expect(items).toHaveLength(3);

const rows = screen.queryAllByRole('row');           // 0개면 빈 배열
const cards = await screen.findAllByTestId('card');  // 나타날 때까지 대기
```

## 두 번째 축 — 무엇으로 찾을 것인가

같은 버튼이라도 role, 텍스트, testid 등 여러 방법으로 찾을 수 있다. 공식 문서는 명확한 우선순위를 제시한다.

![쿼리 우선순위](/assets/posts/react-rtl-queries-priority.svg)

이 순서는 취향이 아니라 원칙의 표현이다. **실제 사용자와 보조기술(스크린 리더)이 요소를 인식하는 방식에 가까울수록 상위**다.

## getByRole — 언제나 1순위

`getByRole`은 브라우저의 **접근성 트리**를 기반으로 요소를 찾는다. 버튼, 링크, 입력, 헤딩 등 거의 모든 인터랙티브 요소에는 암묵적 role이 있다.

```tsx
// name 옵션은 "접근 가능한 이름" — 보이는 텍스트, aria-label 등
screen.getByRole('button', { name: '회원가입' });
screen.getByRole('heading', { name: '장바구니', level: 2 });
screen.getByRole('textbox', { name: '이메일' });
screen.getByRole('checkbox', { name: '약관 동의' });
screen.getByRole('link', { name: '자세히 보기' });

// 상태 옵션으로 더 정밀하게
screen.getByRole('button', { name: '저장', disabled: true });
screen.getByRole('tab', { name: '리뷰', selected: true });
```

`getByRole`이 강력한 진짜 이유는 **접근성 검증을 겸한다**는 점이다. `<div onClick={...}>`으로 만든 가짜 버튼은 `getByRole('button')`로 찾을 수 없다. 테스트가 실패하면서 "이 요소는 스크린 리더 사용자에게 버튼이 아니다"라는 사실을 알려주는 셈이다. 쿼리를 고치는 게 아니라 마크업을 `<button>`으로 고치는 것이 올바른 대응이다.

자주 쓰는 role은 외우기보다 에러 메시지를 활용하면 된다. `getByRole('없는role')`로 실패하면 현재 DOM에 존재하는 모든 role 목록이 출력된다.

## getByLabelText — 폼 필드의 표준

폼 입력은 `getByLabelText`로 찾는 것이 자연스럽다. 이 쿼리는 `<label>` 연결, `aria-label`, `aria-labelledby`를 모두 인식한다.

```tsx
// 아래 마크업 모두 getByLabelText('비밀번호')로 찾을 수 있다
<label htmlFor="pw">비밀번호</label><input id="pw" type="password" />

<label>비밀번호 <input type="password" /></label>

<input type="password" aria-label="비밀번호" />
```

레이블 없는 입력은 이 쿼리로 찾을 수 없는데, 이것 역시 접근성 결함의 신호다.

## getByTestId — 최후의 수단

`data-testid`는 사용자가 볼 수도, 들을 수도 없는 식별자다. 따라서 RTL 철학에서 가장 멀다. 그래도 필요한 순간이 있다.

```tsx
// 의미 있는 role도 텍스트도 없는 컨테이너
<div data-testid="chart-canvas">{/* canvas 렌더링 */}</div>

screen.getByTestId('chart-canvas');
```

동적 텍스트, 시각화 캔버스, 서드파티 위젯 래퍼처럼 의미론적 접점이 정말 없을 때만 쓰고, 그 외에는 상위 쿼리로 찾을 방법을 먼저 고민한다.

## within — 범위를 좁혀 질의하기

같은 role의 요소가 많을 때는 `within`으로 특정 영역 안에서만 찾을 수 있다.

```tsx
import { render, screen, within } from '@testing-library/react';

render(<TodoList />);

// 여러 listitem 중 "우유 사기" 항목 안의 삭제 버튼만
const item = screen.getByRole('listitem', { name: /우유 사기/ });
const deleteButton = within(item).getByRole('button', { name: '삭제' });

// 테이블 특정 행 안의 셀 검증
const row = screen.getByRole('row', { name: /김개발/ });
expect(within(row).getByRole('cell', { name: '관리자' })).toBeInTheDocument();
```

`getAllBy`로 배열 인덱스를 뒤지는 것보다 의도가 명확하고, 항목 순서가 바뀌어도 깨지지 않는다.

## TextMatch — 문자열, 정규식, 함수

모든 쿼리의 매칭 인자는 세 가지 형태를 받는다.

```tsx
screen.getByText('장바구니가 비었습니다');     // 완전 일치 (공백 정규화)
screen.getByText(/비었습니다/);                // 정규식 — 부분 일치
screen.getByText((content, element) =>        // 함수 — 쪼개진 텍스트 매칭
  element?.textContent === '총 3,000원'
);
```

텍스트가 여러 태그에 걸쳐 쪼개져 있어 `getByText`가 실패하는 경우, 함수 매처나 상위 요소 질의로 해결할 수 있다.

쿼리로 요소를 찾았다면 다음은 **상호작용**이다. 다음 글에서는 fireEvent와의 차이를 포함해, 실제 사용자의 입력을 충실하게 재현하는 user-event 라이브러리를 다룬다.

---

**지난 글:** [React Testing Library — 사용자 관점의 테스트](/posts/react-testing-library/)

**다음 글:** [user-event — 실제 사용자처럼 상호작용 테스트하기](/posts/react-user-event/)

<br>
읽어주셔서 감사합니다. 😊
