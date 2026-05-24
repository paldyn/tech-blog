---
title: "폼 유효성 검사 — RHF + Zod로 견고한 폼 만들기"
description: "React Hook Form과 Zod를 조합해 타입 안전한 폼 유효성 검사를 구현하는 방법을 설명합니다. 검사 시점(mode), 스키마 기반 검증, 비동기 검사, 크로스 필드 검증 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 1
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "React", "폼", "유효성검사", "React Hook Form", "Zod", "실전"]
featured: false
draft: false
---

[지난 글](/posts/real-form-controlled-uncontrolled/)에서 제어·비제어 컴포넌트의 차이와 React Hook Form의 기본 개념을 살펴봤습니다. 이번에는 **폼 유효성 검사**에 집중합니다. 내장 HTML validation부터 RHF의 register 규칙, Zod 스키마 통합, 비동기 검사까지 단계별로 정리합니다.

![폼 유효성 검사 흐름](/assets/posts/real-form-validation-flow.svg)

## 검사 시점(mode) 선택

React Hook Form은 `useForm({ mode })` 옵션으로 언제 유효성을 검사할지 제어합니다.

```ts
const { register, handleSubmit, formState: { errors } } = useForm({
  mode: 'all', // onChange + onBlur 병행 — UX 최적
});
```

| mode | 검사 시점 | 특징 |
|---|---|---|
| `onChange` | 타이핑마다 | 즉각 피드백, 렌더링 빈번 |
| `onBlur` | 포커스 이탈 시 | UX 균형 (기본값) |
| `onSubmit` | 제출 시에만 | 단순 폼에 적합 |
| `all` | onBlur 후 onChange | 오류 발생 후 즉시 재검사 — 권장 |
| `onTouched` | 첫 blur 이후 onChange | all과 유사하지만 더 부드러운 시작 |

## RHF 내장 검사 규칙

`register()`의 두 번째 인수로 규칙을 선언합니다. 별도 라이브러리 없이도 대부분의 검사를 커버합니다.

```tsx
function SignupForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>();

  return (
    <form onSubmit={handleSubmit(console.log)}>
      <input
        {...register('email', {
          required: '이메일을 입력하세요',
          pattern: {
            value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: '올바른 이메일 형식이 아닙니다',
          },
        })}
      />
      {errors.email && <span>{errors.email.message}</span>}

      <input
        type="password"
        {...register('password', {
          required: '비밀번호를 입력하세요',
          minLength: { value: 8, message: '8자 이상 입력하세요' },
        })}
      />
      {errors.password && <span>{errors.password.message}</span>}

      <button type="submit">가입</button>
    </form>
  );
}
```

주요 규칙: `required`, `minLength`, `maxLength`, `min`, `max`, `pattern`, `validate`.

## Zod 스키마 통합

프로덕션 프로젝트에서는 **Zod + zodResolver** 조합이 표준입니다. 스키마 하나로 TypeScript 타입 추론과 런타임 검사를 동시에 해결합니다.

![Zod 스키마 기반 유효성 검사](/assets/posts/real-form-validation-schema.svg)

```ts
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z
  .object({
    name: z.string().min(2, '이름은 2자 이상'),
    email: z.string().email('이메일 형식 오류'),
    password: z.string().min(8, '8자 이상'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['confirm'], // 에러를 특정 필드에 할당
  });

type FormData = z.infer<typeof schema>; // TypeScript 타입 자동 생성

const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
  resolver: zodResolver(schema),
  mode: 'all',
});
```

`.refine()`은 두 필드 이상이 연관된 **크로스 필드 검증**에 사용합니다. `path` 옵션으로 에러를 특정 필드에 귀속시킵니다.

## 비동기 유효성 검사

서버에 이미 등록된 이메일인지 확인하는 것처럼, API 호출이 필요한 검사는 `validate` 옵션에 비동기 함수를 전달합니다.

```ts
register('email', {
  validate: async (value) => {
    const res = await fetch(`/api/check-email?email=${value}`);
    const { available } = await res.json();
    return available || '이미 사용 중인 이메일입니다';
  },
});
```

비동기 검사는 네트워크 요청을 수반하므로 `onBlur` 모드와 함께 사용하거나, `debounce`로 요청 빈도를 조절하는 것이 좋습니다.

```ts
import { useDebouncedCallback } from 'use-debounce';

const checkEmail = useDebouncedCallback(async (value: string) => {
  const res = await fetch(`/api/check-email?email=${value}`);
  return (await res.json()).available || '중복된 이메일';
}, 500);

register('email', { validate: checkEmail });
```

## setError로 서버 오류 반영

폼 제출 후 서버에서 반환한 오류를 특정 필드에 표시할 때는 `setError`를 사용합니다.

```ts
const { setError } = useForm();

const onSubmit = async (data: FormData) => {
  try {
    await api.signup(data);
  } catch (err) {
    if (err.code === 'EMAIL_TAKEN') {
      setError('email', {
        type: 'server',
        message: '이미 가입된 이메일입니다',
      });
    }
  }
};
```

서버 검증 오류는 `type: 'server'`로 구분하면 클라이언트 오류와 분리해 처리하기 쉽습니다.

## 유효성 검사 전략 정리

| 상황 | 권장 방식 |
|---|---|
| 단일 필드 규칙 (required, pattern 등) | RHF `register` 옵션 |
| 복잡한 스키마 + 타입 안전성 | Zod + zodResolver |
| 두 필드 비교 (비밀번호 확인) | Zod `.refine()` |
| 서버 중복 확인 | `validate` async + debounce |
| 제출 후 서버 오류 | `setError('field', {...})` |
| 전체 폼 오류 (401, 500) | `setError('root', {...})` |

---

**지난 글:** [제어 컴포넌트와 비제어 컴포넌트 — 폼 상태 관리 전략](/posts/real-form-controlled-uncontrolled/)

**다음 글:** [국제화(i18n) — react-i18next로 다국어 지원 구현](/posts/real-i18n/)

<br>
읽어주셔서 감사합니다. 😊
