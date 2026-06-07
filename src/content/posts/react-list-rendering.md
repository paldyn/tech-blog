---
title: "목록 렌더링 — map()과 배열 처리 패턴"
description: "배열을 JSX로 변환하는 map() 기본 패턴, filter() 조합, 빈 배열 처리, 중첩 목록 컴포넌트 분리, 배열 메서드 선택 기준까지 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 10
type: "knowledge"
category: "React"
tags: ["목록렌더링", "map", "filter", "배열", "React", "JSX패턴"]
featured: false
draft: false
---

[지난 글](/posts/react-conditional-rendering/)에서 조건부 렌더링 패턴을 모두 살펴봤다. 실제 앱에서 리스트 UI는 빠질 수 없다. 게시글 목록, 댓글 목록, 카테고리 메뉴 — 모두 배열을 JSX로 변환하는 패턴으로 만든다. React에서 목록 렌더링은 별도 디렉티브 없이 JavaScript `map()`을 그대로 쓴다.

## 기본 패턴: map()

배열에서 각 항목을 JSX Element로 변환하는 가장 기본적인 패턴이다.

```jsx
function PostList({ posts }) {
  return (
    <ul>
      {posts.map(post => (
        <li key={post.id}>
          <a href={`/posts/${post.slug}`}>{post.title}</a>
        </li>
      ))}
    </ul>
  );
}
```

`map()`이 JSX Element의 배열을 반환하고, React가 이를 순서대로 렌더한다. **`key` prop은 필수**다. 없으면 경고가 뜨고 성능이 저하된다. (key에 대해서는 다음 글에서 전면적으로 다룬다.)

## filter() + map() 조합

먼저 `filter()`로 렌더할 항목을 추려낸 다음 `map()`으로 변환하는 것이 일반적이다.

```jsx
function PublishedPostList({ posts }) {
  return (
    <ul>
      {posts
        .filter(post => post.published)
        .map(post => (
          <PostCard key={post.id} post={post} />
        ))
      }
    </ul>
  );
}
```

`.filter()` → `.map()` 체인은 선언적이고 읽기 쉽다. 성능이 걱정된다면 `useMemo`로 결과를 메모이제이션한다.

![목록 렌더링 패턴](/assets/posts/react-list-rendering-map.svg)

## 빈 배열 처리

`map()`은 빈 배열에도 오류 없이 동작해 아무것도 렌더하지 않는다. 사용자에게 "데이터 없음" 메시지를 보여주려면 명시적으로 처리해야 한다.

```jsx
function PostList({ posts }) {
  if (posts.length === 0) {
    return <p className="empty">작성된 글이 없습니다.</p>;
  }

  return (
    <ul>
      {posts.map(post => (
        <PostCard key={post.id} post={post} />
      ))}
    </ul>
  );
}
```

얼리 리턴으로 빈 상태를 먼저 처리하면 주된 렌더 로직이 깔끔해진다.

## 컴포넌트로 분리

`map()` 안에 긴 JSX를 쓰면 가독성이 떨어진다. 각 항목을 별도 컴포넌트로 분리한다.

```jsx
// ❌ map 안에 긴 JSX
{items.map(item => (
  <div key={item.id} className="card">
    <img src={item.thumbnail} alt={item.title} />
    <div className="card-body">
      <h3>{item.title}</h3>
      <p>{item.summary}</p>
      <span>{item.date}</span>
    </div>
  </div>
))}

// ✅ 컴포넌트로 분리
{items.map(item => (
  <PostCard key={item.id} post={item} />
))}
```

컴포넌트로 분리하면 `map` 부분이 간결해지고, `PostCard` 내부 로직도 독립적으로 관리할 수 있다.

## 중첩 목록

중첩 데이터를 렌더할 때는 각 계층을 별도 컴포넌트로 분리하는 것이 명확하다.

```jsx
function CategoryList({ categories }) {
  return (
    <ul>
      {categories.map(cat => (
        <CategoryItem key={cat.id} category={cat} />
      ))}
    </ul>
  );
}

function CategoryItem({ category }) {
  return (
    <li>
      <span>{category.name}</span>
      <ul>
        {category.items.map(item => (
          <li key={item.id}>{item.title}</li>
        ))}
      </ul>
    </li>
  );
}
```

![중첩 목록과 컴포넌트 분리](/assets/posts/react-list-rendering-nested.svg)

## 인덱스를 key로 쓰면 안 되는 경우

`map()`의 두 번째 인자로 오는 인덱스를 key로 쓰면 쉽지만 위험하다.

```jsx
// ⚠️ 항목이 추가/삭제/정렬될 수 있다면 인덱스 key는 위험
{items.map((item, index) => (
  <Item key={index} item={item} />
))}

// ✅ 안정적인 고유 ID 사용
{items.map(item => (
  <Item key={item.id} item={item} />
))}
```

인덱스를 key로 쓰면 항목이 재정렬되거나 삽입/삭제될 때 React가 잘못된 컴포넌트를 재사용해 상태 버그와 성능 문제가 생긴다. (이 주제는 다음 키 글에서 깊이 다룬다.)

## 정리

- `map()`으로 배열을 JSX 배열로 변환한다
- `key` prop은 필수이며 배열 내에서 안정적으로 고유해야 한다
- `filter()` → `map()` 체인으로 조건부 목록을 만든다
- 빈 배열은 얼리 리턴이나 삼항으로 명시적으로 처리한다
- 항목이 복잡하면 컴포넌트로 분리해 `map()` 안을 단순하게 유지한다
- 항목이 재정렬될 수 있다면 인덱스 key는 사용하지 않는다

다음 글에서는 `key` prop이 정확히 무엇을 하는지, 잘못된 key가 어떤 버그를 만드는지 완전히 파헤친다.

---

**지난 글:** [조건부 렌더링 — 삼항 연산자부터 얼리 리턴까지](/posts/react-conditional-rendering/)

<br>
읽어주셔서 감사합니다. 😊
