---
title: "제어 컴포넌트와 폼 처리"
description: "React 제어 컴포넌트(Controlled Input)의 동작 원리, value+onChange 쌍이 필요한 이유, text/checkbox/select/radio 등 입력 타입별 올바른 처리 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 10
type: "knowledge"
category: "React"
tags: ["React", "폼", "Controlled Input", "onChange", "입력 처리"]
featured: false
draft: false
---

[지난 글](/posts/react-automatic-batching/)에서 React 18의 자동 배칭을 살펴봤습니다. 이번에는 사용자 입력을 다루는 **제어 컴포넌트(Controlled Component)** 패턴을 알아봅니다. React에서 폼을 올바르게 처리하려면 입력값을 React state가 소유하도록 만드는 것이 핵심입니다.

---

## 제어 컴포넌트란

**제어 컴포넌트**는 입력 요소의 현재 값이 React state에 의해 결정되는 컴포넌트입니다.

```jsx
function SearchBox() {
  const [query, setQuery] = useState('');

  return (
    <input
      value={query}           // state → DOM
      onChange={e => setQuery(e.target.value)}  // DOM → state
    />
  );
}
```

사용자가 키를 누를 때마다:
1. `onChange` 이벤트 발생 → `e.target.value` 수신
2. `setQuery(e.target.value)` 호출 → state 업데이트
3. 리렌더 → `value={query}`로 input 값 반영

React state가 "진실의 단일 공급원(Single Source of Truth)"이 됩니다.

![제어 컴포넌트 동작 원리](/assets/posts/react-forms-controlled-inputs-concept.svg)

---

## value와 onChange는 항상 쌍으로

`value`만 제공하고 `onChange`를 빠뜨리면 input이 **읽기 전용**이 됩니다. React는 콘솔에 경고를 출력합니다.

```jsx
// ❌ onChange 없이 value — 읽기 전용, React 경고
<input value={email} />

// ❌ value=undefined — 비제어 컴포넌트로 동작
<input value={undefined} onChange={...} />

// ✓ 올바른 제어 컴포넌트
<input value={email} onChange={e => setEmail(e.target.value)} />
```

---

## 입력 타입별 패턴

입력 타입에 따라 연결 방식이 조금씩 다릅니다.

![입력 타입별 제어 컴포넌트 패턴](/assets/posts/react-forms-controlled-inputs-types.svg)

### text / email / password / number

`value`와 `e.target.value`를 씁니다.

```jsx
const [name, setName] = useState('');
<input type="text" value={name} onChange={e => setName(e.target.value)} />

// number 타입: e.target.value는 문자열이므로 변환 필요
const [age, setAge] = useState(0);
<input
  type="number"
  value={age}
  onChange={e => setAge(Number(e.target.value))}
/>
```

### checkbox

`value` 대신 `checked`를 사용하고, `e.target.checked`(boolean)로 읽습니다.

```jsx
const [agreed, setAgreed] = useState(false);
<input
  type="checkbox"
  checked={agreed}
  onChange={e => setAgreed(e.target.checked)}
/>
```

### radio

같은 name을 공유하는 여러 input에서 `checked`로 현재 선택을 표시합니다.

```jsx
const [size, setSize] = useState('M');

['S', 'M', 'L'].map(s => (
  <label key={s}>
    <input
      type="radio"
      value={s}
      checked={size === s}
      onChange={() => setSize(s)}
    />
    {s}
  </label>
))
```

### select

`<select>`에 `value`를 전달합니다. React는 선택된 `<option>`에 자동으로 `selected`를 설정합니다.

```jsx
const [country, setCountry] = useState('KR');

<select value={country} onChange={e => setCountry(e.target.value)}>
  <option value="KR">대한민국</option>
  <option value="US">미국</option>
  <option value="JP">일본</option>
</select>
```

### textarea

HTML `<textarea>`는 내용을 자식 텍스트로 넣지만, React에서는 `value` prop을 사용합니다.

```jsx
const [bio, setBio] = useState('');
<textarea
  value={bio}
  onChange={e => setBio(e.target.value)}
  rows={4}
/>
```

---

## 여러 입력을 하나의 state로

폼 필드가 많을 때는 객체 state로 통합할 수 있습니다.

```jsx
function ProfileForm() {
  const [form, setForm] = useState({ name: '', email: '', bio: '' });

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = e => {
    e.preventDefault();
    console.log(form);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="name"  value={form.name}  onChange={handleChange} />
      <input name="email" value={form.email} onChange={handleChange} />
      <textarea name="bio" value={form.bio}  onChange={handleChange} />
      <button type="submit">저장</button>
    </form>
  );
}
```

`e.target.name`을 computed property key(`[name]`)로 활용해 핸들러 하나로 모든 필드를 처리합니다.

---

## 폼 제출 시 기본 동작 막기

HTML form의 기본 동작은 페이지를 새로고침합니다. React에서는 `e.preventDefault()`로 막습니다.

```jsx
function LoginForm() {
  const handleSubmit = async e => {
    e.preventDefault();   // 페이지 새로고침 방지

    const res = await api.login({ email, password });
    if (res.ok) router.push('/dashboard');
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

---

**지난 글:** [자동 배칭(Automatic Batching): React 18](/posts/react-automatic-batching/)

<br>
읽어주셔서 감사합니다. 😊
