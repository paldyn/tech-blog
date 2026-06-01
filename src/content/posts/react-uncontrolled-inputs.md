---
title: "비제어 컴포넌트와 useRef 폼 처리"
description: "React 비제어 컴포넌트(Uncontrolled Input)의 동작 원리, useRef로 DOM 값을 읽는 패턴, 파일 업로드·서드파티 연동 등 비제어가 필요한 상황을 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 1
type: "knowledge"
category: "React"
tags: ["React", "비제어컴포넌트", "UncontrolledInput", "useRef", "폼처리", "파일업로드"]
featured: false
draft: false
---

[지난 글](/posts/react-forms-controlled-inputs/)에서 `value`와 `onChange`를 짝지어 React 상태가 입력값을 직접 관리하는 제어 컴포넌트를 다뤘다. 이번에는 반대쪽을 살펴본다. 비제어 컴포넌트는 DOM 스스로 값을 보관하고, React는 필요한 순간에만 `ref`로 그 값을 읽는다. 두 방식의 차이를 이해하면 상황에 맞는 선택을 할 수 있다.

## 비제어 컴포넌트란

제어 컴포넌트는 사용자가 한 글자 입력할 때마다 `onChange`가 실행되고, state가 갱신되고, 컴포넌트가 리렌더된다. 비제어 컴포넌트는 이 흐름을 건너뛴다. `input` 엘리먼트가 자체적으로 현재 값을 보유하고, React는 폼이 제출되거나 특정 이벤트가 발생할 때 `ref.current.value`로 한 번에 읽는다.

![제어 vs 비제어 입력 비교](/assets/posts/react-uncontrolled-inputs-compare.svg)

## useRef로 비제어 입력 처리하기

```jsx
import { useRef } from 'react';

function LoginForm() {
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  function handleSubmit(e) {
    e.preventDefault();
    const email = emailRef.current.value;
    const password = passwordRef.current.value;
    console.log({ email, password });
  }

  return (
    <form onSubmit={handleSubmit}>
      <input ref={emailRef} type="email" defaultValue="" />
      <input ref={passwordRef} type="password" defaultValue="" />
      <button type="submit">로그인</button>
    </form>
  );
}
```

`value` 대신 `defaultValue`를 쓴다는 점이 중요하다. `value`를 사용하면 React가 값을 고정해버려 사용자가 타이핑할 수 없다(읽기 전용 경고 발생). `defaultValue`는 초기값만 설정하고 이후 DOM이 자유롭게 값을 관리하게 둔다.

## 파일 업로드 — 비제어만 가능한 경우

`<input type="file">`은 보안 정책상 JavaScript에서 값을 직접 설정할 수 없다. 제어 컴포넌트 방식(`value` 프로퍼티)이 불가능하므로 반드시 비제어로 처리해야 한다.

```jsx
function FileUpload() {
  const fileRef = useRef(null);

  function handleUpload() {
    const file = fileRef.current.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    fetch('/api/upload', { method: 'POST', body: formData });
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" />
      <button onClick={handleUpload}>업로드</button>
    </>
  );
}
```

## defaultValue와 defaultChecked

비제어 입력에서 초기값 설정은 `defaultValue` / `defaultChecked`로 한다.

```jsx
// 텍스트 입력 초기값
<input ref={nameRef} defaultValue="홍길동" />

// 체크박스 초기 체크 상태
<input ref={agreeRef} type="checkbox" defaultChecked={false} />

// select 초기 선택값
<select ref={roleRef} defaultValue="user">
  <option value="admin">관리자</option>
  <option value="user">일반 사용자</option>
</select>
```

## 비제어 컴포넌트가 적합한 상황

![비제어 컴포넌트 실전 패턴](/assets/posts/react-uncontrolled-inputs-ref.svg)

세 가지 상황에서 비제어 컴포넌트가 두각을 나타낸다. 첫째, 파일 업로드처럼 제어 자체가 불가능할 때다. 둘째, Chart.js나 날짜 선택기처럼 DOM을 직접 조작하는 서드파티 라이브러리와 연동할 때다. 셋째, 폼 필드가 수십 개이고 키 입력마다 리렌더가 성능 문제로 이어질 때다.

반대로 실시간 유효성 검사, 입력값에 따라 다른 UI를 보여줘야 하는 상황, 값을 즉시 다른 컴포넌트에 전달해야 하는 경우라면 제어 컴포넌트가 맞다. 비제어 컴포넌트에서는 폼이 제출되기 전까지 React가 값을 "모르기" 때문에 이런 동기적인 반응이 어렵다.

## 폼 초기화 패턴

비제어 폼을 초기화할 때는 `ref`로 직접 DOM 값을 바꿀 수 있다.

```jsx
function ResetableForm() {
  const formRef = useRef(null);

  function handleReset() {
    formRef.current.reset(); // 폼 전체 초기화
  }

  return (
    <form ref={formRef}>
      <input name="username" defaultValue="" />
      <input name="email" type="email" defaultValue="" />
      <button type="button" onClick={handleReset}>초기화</button>
      <button type="submit">제출</button>
    </form>
  );
}
```

`form.reset()`은 HTML 네이티브 메서드로, 폼 안의 모든 입력 필드를 `defaultValue`로 되돌린다.

## 제어와 비제어 혼용 주의

한 입력 엘리먼트에 `value`와 `ref`를 동시에 쓰는 것은 피해야 한다. `value`가 있으면 제어 컴포넌트가 되어 DOM이 값을 스스로 바꿀 수 없으므로 `ref.current.value`를 수정해도 반영이 안 된다. 또한 초기 렌더에는 `undefined`를 넣고 나중에 값을 줘서 비제어→제어로 전환하면 React가 경고를 출력한다.

```jsx
// 잘못된 예: value와 ref 혼용
<input value={name} ref={inputRef} onChange={...} />
// ref.current.value를 강제로 수정해도 value prop이 우선하므로 무의미

// 올바른 분리
// 제어: value + onChange 만 사용
// 비제어: defaultValue + ref 만 사용
```

---

**지난 글:** [제어 컴포넌트와 폼 처리](/posts/react-forms-controlled-inputs/)

**다음 글:** [React 폼 유효성 검사](/posts/react-form-validation/)

<br>
읽어주셔서 감사합니다. 😊
