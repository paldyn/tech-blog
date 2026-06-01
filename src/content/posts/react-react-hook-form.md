---
title: "React Hook Form으로 폼 관리"
description: "React Hook Form의 비제어 방식 성능 이점, register·handleSubmit·formState 사용법, Controller로 커스텀 UI 연동, Zod 스키마 검사까지 실전 예제로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 3
type: "knowledge"
category: "React"
tags: ["React", "ReactHookForm", "폼관리", "register", "handleSubmit", "Controller", "Zod"]
featured: false
draft: false
---

[지난 글](/posts/react-form-validation/)에서 `touched`와 `onBlur`를 조합해 직접 유효성 검사를 구현했다. 필드가 늘어날수록 이 코드는 빠르게 복잡해진다. React Hook Form은 이 과정을 극적으로 단순화한다. 비제어 방식으로 DOM을 직접 참조해 리렌더를 최소화하면서도 검사·오류 표시·제출을 깔끔하게 처리한다.

## 왜 React Hook Form인가

직접 구현한 제어 폼은 필드마다 `useState`, `error`, `touched` 상태가 필요하고, 키를 누를 때마다 전체 컴포넌트가 리렌더된다. React Hook Form은 내부적으로 `useRef`로 값을 추적하고, 오류가 발생했을 때만 리렌더를 일으킨다. 100개 입력 필드가 있는 폼에서 사용자가 타이핑해도 리렌더는 극소수만 발생한다.

## 기본 설치와 사용

```bash
npm install react-hook-form
```

```jsx
import { useForm } from 'react-hook-form';

function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm();

  async function onSubmit(data) {
    await fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input
        {...register('email', {
          required: '이메일을 입력하세요',
          pattern: { value: /\S+@\S+\.\S+/, message: '올바른 이메일 형식이 아닙니다' },
        })}
        placeholder="이메일"
      />
      {errors.email && <p>{errors.email.message}</p>}

      <input
        type="password"
        {...register('password', {
          required: '비밀번호를 입력하세요',
          minLength: { value: 8, message: '8자 이상이어야 합니다' },
        })}
        placeholder="비밀번호"
      />
      {errors.password && <p>{errors.password.message}</p>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? '로그인 중...' : '로그인'}
      </button>
    </form>
  );
}
```

`register`를 spread하면 `name`, `ref`, `onChange`, `onBlur`가 모두 주입된다. `handleSubmit`은 검사를 먼저 실행하고 통과하면 콜백을 호출한다.

![React Hook Form 아키텍처](/assets/posts/react-react-hook-form-arch.svg)

## register 내장 검사 규칙

`register`의 두 번째 인수로 검사 규칙을 선언한다. `validate`에는 비동기 함수도 쓸 수 있다.

![register 검사 규칙과 Controller](/assets/posts/react-react-hook-form-rules.svg)

## 기본값 설정

```jsx
const { register } = useForm({
  defaultValues: {
    name: '홍길동',
    role: 'user',
    subscribe: true,
  },
});
```

서버에서 받아온 데이터로 초기화할 때도 `defaultValues`를 사용한다. 비동기 로딩이라면 `reset(serverData)`로 나중에 설정할 수 있다.

## 폼 상태 활용

```jsx
const {
  formState: {
    errors,        // 검사 오류 객체
    isSubmitting,  // 제출 중 여부
    isDirty,       // 기본값에서 변경됨
    isValid,       // 오류 없음
    touchedFields, // 방문한 필드
    dirtyFields,   // 변경된 필드
  },
} = useForm({ mode: 'onBlur' }); // 검사 타이밍: onChange | onBlur | onSubmit | onTouched | all
```

`mode: 'onBlur'`는 포커스를 벗어날 때 검사를 실행해 직접 구현했던 것과 동일한 UX를 자동으로 제공한다.

## Zod로 스키마 검사

`@hookform/resolvers`와 `zod`를 조합하면 스키마 기반 검사를 간결하게 작성할 수 있다.

```bash
npm install zod @hookform/resolvers
```

```jsx
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다'),
  password: z.string().min(8, '8자 이상이어야 합니다'),
  age: z.number({ invalid_type_error: '숫자를 입력하세요' }).min(18, '18세 이상만 가입 가능'),
});

function SignupForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit(data => console.log(data))}>
      <input {...register('email')} />
      {errors.email && <p>{errors.email.message}</p>}
      {/* ... */}
    </form>
  );
}
```

Zod 스키마는 TypeScript 타입도 자동 추론(`z.infer<typeof schema>`)해주어 타입 안전성까지 얻을 수 있다.

## watch로 필드 값 구독

```jsx
const { register, watch } = useForm();
const watchRole = watch('role'); // 특정 필드
const watchAll = watch(); // 전체 폼 값

// 조건부 필드 표시
{watchRole === 'admin' && (
  <input {...register('adminCode')} placeholder="관리자 코드" />
)}
```

`watch`는 해당 필드가 바뀔 때마다 리렌더를 일으키므로 꼭 필요한 경우에만 사용하고, 단순 폼 제출에서는 생략하는 것이 좋다.

React Hook Form 하나로 직접 구현했던 상태 관리, 검사 타이밍, 오류 표시가 모두 해결된다. 다음 글에서는 컴포넌트 간 상태 공유를 위한 상태 끌어올리기를 다룬다.

---

**지난 글:** [React 폼 유효성 검사](/posts/react-form-validation/)

**다음 글:** [상태 끌어올리기 (Lifting State Up)](/posts/react-lifting-state/)

<br>
읽어주셔서 감사합니다. 😊
