---
title: "Error cause (ES2022)"
description: "ES2022에서 도입된 Error cause 옵션으로 에러를 연쇄하고 원인 에러를 보존하는 방법, 커스텀 에러 클래스와의 통합, cause 체인 순회 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 8
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "ES2022", "Error", "cause", "에러 처리", "에러 연쇄", "디버깅"]
featured: false
draft: false
---

[지난 글](/posts/js-find-last/)에서 `findLast()`를 살펴봤습니다. 이번에는 ES2022에서 추가된 **Error cause**를 다룹니다. 에러를 다시 던질 때 원래의 에러를 `cause` 속성으로 보존할 수 있게 해 주는 기능으로, 다층 계층 애플리케이션에서 디버깅 경험을 크게 향상시킵니다.

## 문제: 에러 컨텍스트 소실

저수준 에러를 상위 레이어에서 래핑해 다시 던질 때, 원인 에러를 잃어버리는 경우가 많았습니다.

```javascript
// 기존 방식 — 원인 에러 소실
try {
  await fetchData('/api/user');
} catch (err) {
  throw new Error('사용자 로드 실패');
  // err는 완전히 사라짐
}
```

`err.message`를 문자열로 합쳐서 전달하는 방법도 있었지만, 스택 트레이스와 타입 정보가 사라집니다.

## Error cause 사용법

ES2022부터 `Error` 생성자의 두 번째 인자 옵션 객체에 `cause`를 포함할 수 있습니다.

```javascript
try {
  await fetchData('/api/user');
} catch (err) {
  throw new Error('사용자 로드 실패', { cause: err });
}
```

이렇게 하면 새 에러의 `.cause` 속성에 원인 에러가 저장됩니다.

## 에러 연쇄 구조

![Error cause 연쇄 구조](/assets/posts/js-error-cause-chain.svg)

여러 레이어에서 에러를 래핑하면 연쇄 구조가 만들어집니다.

```javascript
async function fetchData(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function loadUser(id) {
  try {
    return await fetchData(`/api/users/${id}`);
  } catch (err) {
    throw new Error('사용자 로드 실패', { cause: err });
  }
}

async function renderPage(id) {
  try {
    const user = await loadUser(id);
    render(user);
  } catch (err) {
    throw new Error('페이지 렌더링 실패', { cause: err });
  }
}
```

## cause 체인 순회

![cause 체인 순회와 커스텀 에러](/assets/posts/js-error-cause-patterns.svg)

`cause`는 일반 속성이므로 루프로 쉽게 순회할 수 있습니다.

```javascript
function getCauseChain(err) {
  const chain = [];
  let current = err;
  while (current instanceof Error) {
    chain.push({
      message: current.message,
      name: current.name,
    });
    current = current.cause;
  }
  return chain;
}

try {
  await renderPage(1);
} catch (err) {
  console.log(getCauseChain(err));
  // [
  //   { message: '페이지 렌더링 실패', name: 'Error' },
  //   { message: '사용자 로드 실패',  name: 'Error' },
  //   { message: 'HTTP 404',          name: 'Error' },
  // ]
}
```

## 커스텀 에러 클래스와 통합

커스텀 에러 클래스에서도 `super(msg, { cause })`로 `cause`를 전달할 수 있습니다.

```javascript
class DatabaseError extends Error {
  constructor(message, { cause, query } = {}) {
    super(message, { cause });
    this.name = 'DatabaseError';
    this.query = query;
  }
}

try {
  await db.execute('SELECT ...');
} catch (err) {
  throw new DatabaseError('쿼리 실패', {
    cause: err,
    query: 'SELECT ...',
  });
}
```

## 로깅에서의 활용

에러 로깅 시스템에서 `cause` 체인을 재귀적으로 직렬화하면 더 풍부한 에러 정보를 수집할 수 있습니다.

```javascript
function serializeError(err) {
  if (!(err instanceof Error)) return String(err);
  return {
    name: err.name,
    message: err.message,
    stack: err.stack,
    cause: err.cause ? serializeError(err.cause) : undefined,
  };
}

logger.error('요청 처리 실패', serializeError(topLevelErr));
```

## 지원 환경

Chrome 93+, Firefox 91+, Safari 15+, Node.js 16.9+에서 지원됩니다. `cause` 속성은 명세에 강제되지 않으므로 접근 시 항상 `err.cause`가 존재하는지 확인하는 것이 좋습니다.

---

**지난 글:** [findLast와 findLastIndex](/posts/js-find-last/)

**다음 글:** [structuredClone()](/posts/js-structured-clone/)

<br>
읽어주셔서 감사합니다. 😊
