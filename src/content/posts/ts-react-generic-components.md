---
title: "제네릭 컴포넌트 만들기"
description: "재사용 가능한 React 컴포넌트를 제네릭으로 타이핑하는 법을 정리합니다. 타입 인자가 props 사이를 흐르는 원리, .tsx에서 제네릭 화살표 함수가 막히는 문법 함정과 해결, 제약(extends)으로 키 안전성 확보, forwardRef와 제네릭을 함께 쓰는 법까지 실무 관점으로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-18"
archiveOrder: 6
type: "knowledge"
category: "TypeScript"
tags: ["TypeScript", "React", "제네릭", "컴포넌트", "재사용", "tsx"]
featured: false
draft: false
---

[지난 글](/posts/ts-react-event-handlers/)에서 이벤트 핸들러를 타이핑했다. 이번에는 한 단계 위로 올라가, 컴포넌트 자체를 제네릭으로 만들어 본다. 목록·테이블·셀렉트·자동완성처럼 "어떤 데이터 타입이든 받아 동일하게 동작하는" 컴포넌트는 제네릭으로 만들면 타입 안전을 유지한 채 재사용성을 극대화할 수 있다. [제네릭 함수](/posts/ts-generic-functions/)를 컴포넌트로 옮긴 것이라 원리는 같지만, JSX 특유의 문법 함정이 하나 있어 그걸 짚는 게 이 글의 핵심이다.

## 왜 제네릭 컴포넌트인가

목록을 렌더링하는 `List` 컴포넌트를 생각해 보자. `any[]`로 받으면 재사용은 되지만 타입 안전이 사라지고, `User[]`로 고정하면 안전하지만 `Product`에는 못 쓴다. 제네릭은 이 둘을 동시에 만족시킨다 — **호출하는 쪽이 넘긴 데이터 타입을 컴포넌트가 그대로 기억한다.**

```typescript
interface ListProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}

function List<T>({ items, renderItem }: ListProps<T>) {
  return <ul>{items.map((item, i) => <li key={i}>{renderItem(item)}</li>)}</ul>;
}
```

타입 인자 `T`는 props 사이를 흐른다. `items`에 `User[]`를 넘기면 `T`가 `User`로 추론되고, 그 `T`가 `renderItem`의 인자 타입까지 전파된다.

![제네릭 컴포넌트에서 T의 흐름](/assets/posts/ts-react-generic-components-flow.svg)

```typescript
<List
  items={users} // User[]
  renderItem={(user) => <span>{user.name}</span>} // user는 User로 좁혀짐
/>;
```

`renderItem`의 `user`에 타입을 명시하지 않았는데도 `User`로 안다. `user.naem`처럼 오타를 내면 컴파일 에러다. 한 컴포넌트로 `User`·`Product`·무엇이든, 각 요소 타입의 안전성을 유지한 채 재사용한다.

## .tsx의 함정 — 제네릭 화살표 함수

여기서 TypeScript + React만의 문법 함정이 등장한다. `.tsx` 파일에서는 `<T>` 같은 꺾쇠가 JSX 태그로 해석될 수 있어, 제네릭 화살표 함수를 그냥 쓰면 파서가 혼란에 빠진다.

```typescript
// .tsx에서 에러 — <T>를 JSX 여는 태그로 오해
const identity = <T>(x: T) => x;
```

JSX 파서가 `<T>`를 여는 태그로 보고 닫는 태그를 찾다 실패한다. 해결법은 두 가지다. 타입 매개변수 뒤에 **쉼표를 붙이거나**(`<T,>`), **`extends` 제약을 다는 것**(`<T extends unknown>`)이다.

![.tsx 제네릭 화살표 함수의 함정](/assets/posts/ts-react-generic-components-syntax.svg)

```typescript
// 방법 1: 쉼표
const identity = <T,>(x: T) => x;

// 방법 2: extends 제약
const identity = <T extends unknown>(x: T) => x;
```

함수 선언문(`function List<T>(...)`)에는 이 문제가 없다. 그래서 **제네릭 컴포넌트는 화살표 함수보다 `function` 선언으로 쓰는 편이 깔끔하다.** 화살표로 꼭 써야 한다면 `<T,>`를 기억하자.

## 제약으로 안전성 더하기

제네릭 컴포넌트가 `T`의 특정 속성에 접근해야 한다면 [제약](/posts/ts-generic-constraints/)을 건다. 예를 들어 각 항목에 고유 `id`가 있다고 가정하는 목록이라면, `T`가 `{ id: ... }`를 가진다고 제약한다.

```typescript
interface HasId {
  id: string | number;
}

function KeyedList<T extends HasId>({ items, renderItem }: {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>{renderItem(item)}</li> // item.id 안전
      ))}
    </ul>
  );
}
```

`T extends HasId` 덕분에 `item.id`에 안전하게 접근해 `key`로 쓸 수 있다. `id`가 없는 배열을 넘기면 호출부에서 에러가 난다. 더 나아가 `keyof`로 "정렬할 키"를 prop으로 받는 테이블처럼, [인덱스 접근 타입](/posts/ts-indexed-access-types/)과 결합하면 칼럼 키와 값 타입을 연결하는 정교한 컴포넌트도 만들 수 있다.

```typescript
interface ColumnProps<T, K extends keyof T> {
  rows: T[];
  sortKey: K; // T의 실제 키만 허용
}
```

`sortKey`에 존재하지 않는 키를 넘기면 컴파일 타임에 걸린다. 데이터 모양과 컴포넌트 설정이 타입으로 묶이는 것이다.

## forwardRef와 제네릭을 함께

제네릭 컴포넌트에 [지난 ref 글](/posts/ts-react-refs-forwardref/)의 `forwardRef`를 결합하려면 약간 번거롭다. `forwardRef`가 제네릭을 그대로 보존하지 못해서, 반환값을 다시 단언하거나 래핑하는 패턴이 필요하다.

```typescript
function ListInner<T>(
  props: ListProps<T>,
  ref: React.Ref<HTMLUListElement>
) {
  return <ul ref={ref}>{/* ... */}</ul>;
}

// forwardRef가 제네릭을 삼키므로 단언으로 복원
const List = forwardRef(ListInner) as <T>(
  props: ListProps<T> & { ref?: React.Ref<HTMLUListElement> }
) => React.ReactElement;
```

다소 투박하지만, [React 19](/posts/ts-react-refs-forwardref/)에서 `ref`가 일반 prop이 되면 이 우회가 사라진다. 그냥 props 타입에 `ref?: React.Ref<...>`를 추가하면 제네릭이 자연스럽게 유지되기 때문이다. 새 코드라면 이쪽이 훨씬 단순하다.

## 정리

제네릭 컴포넌트는 "타입 안전 + 재사용"을 동시에 얻는 방법이다. 타입 인자 `T`가 `items`에서 `renderItem`까지 props 사이를 흐르고, 호출 시점에 확정된다. `.tsx`에서는 `<T>`가 JSX와 충돌하므로 `function` 선언을 쓰거나 화살표라면 `<T,>`로 구분한다. 필요하면 `extends`로 제약을 걸어 키 안전성을 더한다. 이번 글로 React 묶음을 마치고, 다음 글부터는 비동기 영역으로 돌아가 `Promise`를 깊게 타이핑한다.

---

**지난 글:** [React 이벤트 핸들러 타이핑](/posts/ts-react-event-handlers/)

**다음 글:** [Promise 깊이 타이핑하기](/posts/ts-typing-promise-deep/)

<br>
읽어주셔서 감사합니다. 😊
