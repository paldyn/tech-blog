---
title: "React 이벤트 핸들러 타이핑"
description: "React 합성 이벤트(SyntheticEvent)를 TypeScript로 타이핑하는 법을 정리합니다. ChangeEvent·MouseEvent·FormEvent·KeyboardEvent의 엘리먼트 제네릭, target과 currentTarget의 차이, 인라인 핸들러의 자동 추론과 분리 함수의 명시, EventHandler 별칭까지 실무 관점으로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-18"
archiveOrder: 5
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "React", "이벤트", "SyntheticEvent", "ChangeEvent", "핸들러"]
featured: false
draft: false
---

[지난 글](/posts/ts-react-context-typing/)에서 Context로 값을 트리에 내려보냈다. 이번에는 반대 방향, 사용자 입력이 컴포넌트로 들어오는 통로인 이벤트 핸들러를 타이핑한다. React의 이벤트는 브라우저 네이티브 이벤트를 감싼 합성 이벤트(SyntheticEvent)라 타입이 살짝 다르고, `target`과 `currentTarget`의 차이처럼 자주 헷갈리는 지점이 있다. 핸들러를 어디에 쓰느냐에 따라 타입을 명시할지 추론에 맡길지도 갈린다.

## 인라인 핸들러는 타입이 공짜다

가장 먼저 알아둘 사실. JSX 속성 자리에 핸들러를 인라인으로 직접 쓰면 **이벤트 인자의 타입이 자동으로 추론된다.** `<input>`의 `onChange`에 넘긴 함수의 `e`는 따로 명시하지 않아도 `ChangeEvent<HTMLInputElement>`다.

```typescript
<input
  onChange={(e) => {
    // e: React.ChangeEvent<HTMLInputElement> — 자동 추론
    setValue(e.target.value);
  }}
/>
```

React가 JSX 속성마다 핸들러 타입을 알고 있어서, 인라인이면 맥락(contextual typing)으로 인자 타입이 흘러든다. 그래서 인라인 핸들러에 일부러 타입을 다는 건 대개 군더더기다.

![인라인 핸들러는 타입이 공짜](/assets/posts/ts-react-event-handlers-inference.svg)

문제는 핸들러를 별도 함수로 분리할 때다. JSX 맥락에서 떨어져 나오면 추론의 단서가 사라지므로, 인자 타입을 직접 명시해야 한다.

```typescript
function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
  setValue(e.target.value);
}

<input onChange={handleChange} />;
```

이때 필요한 게 "어떤 이벤트에 어떤 타입을 쓰는가"라는 지도다.

## 이벤트 타입 지도

React 이벤트 타입은 대부분 `이벤트종류Event<엘리먼트타입>` 형태다. 자주 쓰는 것들만 외워두면 거의 다 커버된다.

![자주 쓰는 React 이벤트 타입](/assets/posts/ts-react-event-handlers-map.svg)

```typescript
// 입력 변경
function onChange(e: React.ChangeEvent<HTMLInputElement>) {
  console.log(e.target.value);
}

// 클릭
function onClick(e: React.MouseEvent<HTMLButtonElement>) {
  console.log(e.clientX, e.clientY);
}

// 폼 제출
function onSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
}

// 키 입력
function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Enter") submit();
}
```

제네릭 인자인 엘리먼트 타입을 정확히 맞추는 게 중요하다. `<select>`의 `onChange`라면 `HTMLSelectElement`, `<textarea>`면 `HTMLTextAreaElement`다. 이 타입이 `e.target`이나 `e.currentTarget`이 어떤 요소인지를 결정한다.

## target과 currentTarget — 자주 틀리는 지점

이벤트 객체에는 비슷해 보이는 두 속성이 있다. `currentTarget`은 **핸들러가 붙은 요소**이고, `target`은 **실제로 이벤트가 발생한 요소**다. 이벤트 위임 때문에 둘이 다를 수 있다.

타입 관점에서 결정적 차이가 있다. `currentTarget`은 제네릭으로 준 엘리먼트 타입으로 정확히 좁혀지지만, `target`은 `EventTarget`이라는 넓은 타입이다. 그래서 `e.target.value`는 사실 타입이 보장되지 않는 경우가 있다.

```typescript
function onSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  // currentTarget은 HTMLFormElement로 좁혀짐
  const form = e.currentTarget;
  const data = new FormData(form); // 안전

  // e.target은 EventTarget — .elements 접근하려면 단언 필요
}
```

`onChange`처럼 React가 잘 정의해 둔 흔한 케이스에서는 `e.target.value`가 동작하지만, 일반적으로 **요소의 프로퍼티에 접근할 땐 `currentTarget`이 타입상 안전하다.** 폼 전체를 다룰 때 특히 그렇다.

## EventHandler 별칭으로 핸들러를 변수에 담기

핸들러를 변수에 담거나 props로 넘길 때는, 함수 시그니처 전체를 직접 쓰는 대신 React가 제공하는 핸들러 타입 별칭을 쓰면 간결하다.

```typescript
const onChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
  setValue(e.target.value); // e는 자동으로 좁혀짐
};

const onClick: React.MouseEventHandler<HTMLButtonElement> = (e) => {
  console.log(e.currentTarget.disabled);
};
```

`ChangeEventHandler<T>`는 `(e: ChangeEvent<T>) => void`의 별칭이다. 변수 타입으로 핸들러 별칭을 달면, 화살표 함수의 `e`는 다시 추론으로 채워진다 — 인라인일 때처럼. 컴포넌트 props에 핸들러를 받을 때도 이 별칭이 깔끔하다.

```typescript
interface SearchBoxProps {
  onSearch: React.ChangeEventHandler<HTMLInputElement>;
}

function SearchBox({ onSearch }: SearchBoxProps) {
  return <input onChange={onSearch} />;
}
```

## 커스텀 이벤트와 제네릭 핸들러

가끔 여러 요소에 같은 핸들러를 쓰고 싶을 때가 있다. 이럴 땐 핸들러를 제네릭으로 만들거나, 공통 상위 타입을 쓴다. 예를 들어 `HTMLInputElement`와 `HTMLTextAreaElement` 모두에 쓸 변경 핸들러는 유니온으로 받을 수 있다.

```typescript
function onChange(
  e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
) {
  setValue(e.target.value); // 둘 다 value를 가짐
}
```

`HTMLInputElement | HTMLTextAreaElement`의 `target`은 두 타입의 공통 속성만 접근 가능하다. `value`는 둘 다 있으니 안전하고, 한쪽에만 있는 속성은 [좁히기](/posts/ts-narrowing-basics/)가 필요하다. 이건 이벤트 타이핑이라기보다 우리가 시리즈 내내 다룬 유니온 다루기의 응용이다.

정리하면, React 이벤트 핸들러 타이핑의 원칙은 세 가지다. **인라인이면 추론에 맡기고, 분리하면 `이벤트Event<엘리먼트>`로 명시하며, 요소 프로퍼티는 `currentTarget`으로 안전하게 접근한다.** 핸들러를 변수나 props로 다룰 땐 `EventHandler` 별칭이 간결하다. 다음 글에서는 컴포넌트 자체를 제네릭으로 만들어 재사용성을 끌어올리는 법을 본다.

---

**지난 글:** [React Context 타이핑](/posts/ts-react-context-typing/)

**다음 글:** [제네릭 컴포넌트 만들기](/posts/ts-react-generic-components/)

<br>
읽어주셔서 감사합니다. 😊
