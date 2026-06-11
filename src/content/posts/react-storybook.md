---
title: "Storybook — 컴포넌트 주도 개발과 문서화"
description: "Storybook으로 컴포넌트를 격리 개발하고 문서화하는 방법을 다룹니다. CSF 스토리 작성법, args와 Controls, decorators, Autodocs, play 함수를 이용한 인터랙션 테스트까지 — React 완전 정복 시리즈의 마지막 글입니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 10
type: "knowledge"
category: "React"
tags: ["Storybook", "CSF", "컴포넌트주도개발", "문서화", "디자인시스템"]
featured: false
draft: false
---

[지난 글](/posts/react-testing-hooks/)에서 커스텀 훅 테스트까지 다루며 테스트의 큰 그림을 완성했다. 시리즈의 마지막 주제는 개발·문서화·테스트를 하나로 묶는 도구, **Storybook**이다. 버튼 하나를 확인하려고 로그인하고 세 페이지를 클릭해 들어가 본 경험이 있다면, 컴포넌트를 앱에서 떼어내 격리된 환경에서 개발하는 방식이 왜 필요한지 이미 알고 있는 셈이다.

## 컴포넌트 주도 개발

Storybook의 핵심 아이디어는 **컴포넌트의 각 상태를 "스토리"로 명세**하는 것이다. 로딩 중인 버튼, 비활성화된 버튼, 아이콘이 있는 버튼 — 각각이 하나의 스토리가 되고, 사이드바에서 클릭 한 번으로 어떤 상태든 즉시 확인할 수 있다. 라우팅도, 로그인도, 서버도 필요 없다.

```bash
npm create storybook@latest
# 프레임워크를 자동 감지해 설정을 생성한다
npm run storybook   # localhost:6006
```

## 스토리 작성 — CSF

스토리 파일은 **CSF(Component Story Format)** 라는 표준 형식을 따른다. 평범한 ES 모듈이다.

![CSF — Component Story Format](/assets/posts/react-storybook-csf.svg)

```tsx
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

// default export = Meta: 이 파일 전체의 설정
const meta = {
  title: 'UI/Button',          // 사이드바에서의 위치
  component: Button,
  tags: ['autodocs'],          // 문서 페이지 자동 생성
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// named export = 스토리: props 조합 하나가 상태 하나
export const Primary: Story = {
  args: { variant: 'primary', children: '저장' },
};

export const Disabled: Story = {
  args: { variant: 'primary', children: '저장', disabled: true },
};

export const Loading: Story = {
  args: { variant: 'primary', children: '저장', loading: true },
};
```

여기서 중요한 설계 철학이 보인다. 스토리는 렌더링 코드가 아니라 **직렬화 가능한 props 조합(`args`)**이다. 데이터이기 때문에 Storybook의 다른 도구들 — Controls, Autodocs, 테스트 러너 — 이 스토리를 그대로 재사용할 수 있다.

## args와 Controls

`args`로 정의된 props는 **Controls 패널**에서 실시간으로 조작할 수 있다. 디자이너나 PM이 코드를 건드리지 않고 모든 변형을 직접 확인할 수 있다는 뜻이다.

```tsx
const meta = {
  component: Button,
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'danger'],
    },
    size: { control: 'radio', options: ['sm', 'md', 'lg'] },
    onClick: { action: 'clicked' },   // 클릭 시 Actions 패널에 로그
  },
} satisfies Meta<typeof Button>;
```

`meta.args`에 공통 args를 두면 모든 스토리가 상속하고, 각 스토리는 다른 부분만 덮어쓰면 된다.

## decorators — 컨텍스트 주입

테마 Provider나 Router가 필요한 컴포넌트는 **decorator**로 감싼다. 테스트의 wrapper와 같은 개념이다.

```tsx
// .storybook/preview.tsx — 전역 decorator
import type { Preview } from '@storybook/react';
import { ThemeProvider } from '../src/theme';

const preview: Preview = {
  decorators: [
    (Story) => (
      <ThemeProvider theme="light">
        <Story />
      </ThemeProvider>
    ),
  ],
};

export default preview;
```

```tsx
// 특정 스토리에만 적용할 수도 있다
export const InCard: Story = {
  args: { children: '저장' },
  decorators: [
    (Story) => <div style={{ padding: 24, maxWidth: 400 }}><Story /></div>,
  ],
};
```

API에 의존하는 컴포넌트라면 [MSW](/posts/react-mocking-msw/)의 핸들러를 Storybook에서도 그대로 재사용할 수 있다(`msw-storybook-addon`). 테스트와 스토리가 같은 목 데이터를 공유하게 된다.

## play 함수 — 스토리 위에서 인터랙션 테스트

스토리는 정적인 상태 전시에 그치지 않는다. `play` 함수를 붙이면 스토리가 렌더링된 뒤 **자동으로 인터랙션 시나리오를 실행**한다. API가 Testing Library와 동일하다.

```tsx
import { expect, userEvent, within } from '@storybook/test';

export const FilledForm: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.type(
      canvas.getByLabelText('이메일'), 'dev@paldyn.com'
    );
    await userEvent.type(canvas.getByLabelText('비밀번호'), 'secret123');
    await userEvent.click(canvas.getByRole('button', { name: '로그인' }));

    await expect(
      canvas.getByText('환영합니다')
    ).toBeInTheDocument();
  },
};
```

브라우저에서 스토리를 열면 시나리오가 단계별로 재생되는 것을 눈으로 볼 수 있고, Interactions 패널에서 각 단계를 디버깅할 수 있다. 그리고 `@storybook/test-runner`를 돌리면 **모든 스토리가 곧 테스트**가 된다 — 렌더링 에러 검사 + play 함수 실행이 CI에서 자동으로 수행된다.

```bash
npx test-storybook   # 모든 스토리를 헤드리스 브라우저에서 검증
```

## 스토리 하나, 쓰임새 넷

이렇게 작성한 스토리는 네 가지 역할을 동시에 한다.

![스토리 하나로 할 수 있는 일](/assets/posts/react-storybook-workflow.svg)

- **격리 개발**: 앱 전체를 띄우지 않고 컴포넌트만 빠르게 반복 개발
- **문서화**: `autodocs` 태그만으로 props 표와 사용 예제가 포함된 살아 있는 문서 생성
- **인터랙션 테스트**: play 함수 + 테스트 러너로 CI 검증
- **시각 회귀 테스트**: Chromatic 같은 도구가 모든 스토리의 스크린샷을 비교해 의도치 않은 픽셀 변화를 감지

스토리를 잘 쪼개 두는 것 하나가 개발 속도, 문서 품질, 테스트 커버리지를 한꺼번에 끌어올린다. 디자인 시스템을 운영하는 팀에서 Storybook이 사실상 필수 도구가 된 이유다.

## 시리즈를 마치며

이 글로 **React 완전 정복 시리즈 100편**이 완결되었다. JSX의 첫 문법에서 출발해 렌더링 모델과 훅의 동작 원리를 지나, 상태 관리 생태계와 테스트·문서화 도구까지 — React라는 라이브러리 하나를 둘러싼 생태계 전체를 순서대로 걸어왔다. 시리즈의 어느 글이든 필요할 때 다시 꺼내 볼 수 있는 레퍼런스가 되길 바란다. 그동안 함께 읽어주신 모든 분들께 감사드린다.

---

**지난 글:** [커스텀 훅 테스트하기 — renderHook 완전 가이드](/posts/react-testing-hooks/)

<br>
읽어주셔서 감사합니다. 😊
