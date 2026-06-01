---
title: "React 폼 유효성 검사"
description: "onChange·onBlur·onSubmit 세 타이밍의 차이, touched 상태로 조기 오류 표시를 방지하는 패턴, 커스텀 훅으로 재사용 가능한 유효성 검사 로직 구현 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 2
type: "knowledge"
category: "React"
tags: ["React", "폼유효성검사", "FormValidation", "touched", "커스텀훅", "onChange", "onBlur"]
featured: false
draft: false
---

[지난 글](/posts/react-uncontrolled-inputs/)에서 DOM이 값을 직접 보관하는 비제어 컴포넌트를 다뤘다. 실제 폼에서는 유효성 검사가 빠질 수 없다. 언제 검사할지, 오류를 언제 보여줄지에 따라 사용자 경험이 크게 달라진다. 이번 글에서는 세 가지 검사 타이밍과 `touched` 패턴, 그리고 재사용 가능한 커스텀 훅을 만드는 방법을 다룬다.

## 검사 타이밍 세 가지

유효성 검사는 입력할 때(`onChange`), 필드를 떠날 때(`onBlur`), 제출할 때(`onSubmit`) 실행할 수 있다. 각 타이밍은 트레이드오프가 있다.

![폼 유효성 검사 흐름](/assets/posts/react-form-validation-flow.svg)

`onSubmit`만 쓰면 구현이 가장 단순하지만 사용자는 제출 직전까지 어떤 필드가 잘못됐는지 알 수 없다. `onChange`는 즉각 피드백을 주지만 첫 글자를 입력하는 순간 오류 메시지가 뜨는 불쾌한 경험을 만들 수 있다. `onBlur`는 포커스를 옮긴 뒤 검사해서 입력 중 방해하지 않으면서도 제출 전 오류를 알려주는 좋은 균형점이다.

## touched로 조기 오류 방지

필드를 한 번도 방문하지 않았는데 오류가 표시되는 상황을 막으려면 `touched` 상태가 필요하다.

```jsx
function EmailField() {
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);
  const [touched, setTouched] = useState(false);

  function validate(val) {
    if (!val) return '이메일을 입력하세요';
    if (!val.includes('@')) return '올바른 이메일 형식이 아닙니다';
    return null;
  }

  function handleChange(e) {
    setValue(e.target.value);
    // touched된 이후에만 실시간 검사
    if (touched) setError(validate(e.target.value));
  }

  function handleBlur() {
    setTouched(true);
    setError(validate(value));
  }

  return (
    <div>
      <input
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        style={{ borderColor: error && touched ? 'red' : undefined }}
      />
      {touched && error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
```

`touched`가 `false`인 동안은 `onBlur`가 발생하지 않았으므로 오류를 보여주지 않는다. 한 번 `onBlur`가 발생한 이후에는 `onChange`마다 실시간으로 검사해 즉각적인 피드백을 제공한다.

## 전체 폼 제출 처리

여러 필드를 가진 폼은 제출 시 모든 필드를 한꺼번에 검사하고, 하나라도 오류가 있으면 제출을 막아야 한다.

```jsx
function SignupForm() {
  const [fields, setFields] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validators = {
    name: v => (v.length < 2 ? '이름은 2자 이상이어야 합니다' : null),
    email: v => (!v.includes('@') ? '올바른 이메일 형식이 아닙니다' : null),
    password: v => (v.length < 8 ? '비밀번호는 8자 이상이어야 합니다' : null),
  };

  function handleChange(e) {
    const { name, value } = e.target;
    setFields(prev => ({ ...prev, [name]: value }));
    if (touched[name]) {
      setErrors(prev => ({ ...prev, [name]: validators[name](value) }));
    }
  }

  function handleBlur(e) {
    const { name, value } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    setErrors(prev => ({ ...prev, [name]: validators[name](value) }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    const newErrors = {};
    let hasError = false;
    for (const [key, validate] of Object.entries(validators)) {
      const err = validate(fields[key]);
      newErrors[key] = err;
      if (err) hasError = true;
    }
    setErrors(newErrors);
    setTouched({ name: true, email: true, password: true });
    if (hasError) return;
    console.log('제출:', fields);
  }

  return (
    <form onSubmit={handleSubmit}>
      {['name', 'email', 'password'].map(field => (
        <div key={field}>
          <input
            name={field}
            value={fields[field]}
            onChange={handleChange}
            onBlur={handleBlur}
          />
          {touched[field] && errors[field] && (
            <p style={{ color: 'red' }}>{errors[field]}</p>
          )}
        </div>
      ))}
      <button type="submit">가입</button>
    </form>
  );
}
```

## 커스텀 훅으로 로직 분리

같은 패턴이 반복된다면 커스텀 훅으로 추출할 수 있다.

![커스텀 훅으로 폼 유효성 검사](/assets/posts/react-form-validation-code.svg)

```jsx
function useFormField(validate) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);
  const [touched, setTouched] = useState(false);

  function handleChange(e) {
    setValue(e.target.value);
    if (touched) setError(validate(e.target.value));
  }

  function handleBlur() {
    setTouched(true);
    setError(validate(value));
  }

  const isValid = !validate(value);
  return { value, error: touched ? error : null, isValid, handleChange, handleBlur };
}

// 사용 예
function ContactForm() {
  const name = useFormField(v => (v.length < 1 ? '이름을 입력하세요' : null));
  const email = useFormField(v => (!v.includes('@') ? '이메일 형식 오류' : null));

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.isValid || !email.isValid) return;
    // 제출 처리
  }

  return (
    <form onSubmit={handleSubmit}>
      <input value={name.value} onChange={name.handleChange} onBlur={name.handleBlur} />
      {name.error && <p>{name.error}</p>}
      <input value={email.value} onChange={email.handleChange} onBlur={email.handleBlur} />
      {email.error && <p>{email.error}</p>}
      <button type="submit">전송</button>
    </form>
  );
}
```

## 비동기 유효성 검사

이메일 중복 확인처럼 서버에 요청이 필요한 경우 `useEffect`나 디바운스를 함께 사용한다.

```jsx
function useAsyncValidation(value, asyncValidator) {
  const [error, setError] = useState(null);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    if (!value) return;
    const timer = setTimeout(async () => {
      setValidating(true);
      const err = await asyncValidator(value);
      setError(err);
      setValidating(false);
    }, 400); // 입력 후 400ms 대기 (디바운스)

    return () => clearTimeout(timer);
  }, [value]);

  return { error, validating };
}
```

유효성 검사는 UX의 핵심이다. `touched`로 조기 노출을 막고, `onBlur`로 방해 없는 피드백을 주고, `onSubmit`에서 최종 전수 검사하는 패턴이 대부분의 폼에 적합하다. 다음 글에서는 이 모든 것을 훨씬 간단하게 처리해주는 React Hook Form을 살펴본다.

---

**지난 글:** [비제어 컴포넌트와 useRef 폼 처리](/posts/react-uncontrolled-inputs/)

**다음 글:** [React Hook Form으로 폼 관리](/posts/react-react-hook-form/)

<br>
읽어주셔서 감사합니다. 😊
