---
title: "함수 합성"
description: "compose와 pipe를 구현하고, 순수 함수를 레고처럼 조립하는 함수 합성 패턴과 실전 데이터 파이프라인 구축법을 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "함수 합성", "함수형 프로그래밍", "pipe", "compose"]
featured: false
draft: false
---

[지난 글](/posts/js-memoization/)에서 순수 함수의 결과를 캐싱하는 메모이제이션을 다뤘습니다. 이번에는 작은 순수 함수들을 연결해 복잡한 로직을 표현하는 **함수 합성(Function Composition)** 을 살펴봅니다. 함수 합성은 단일 책임 함수들을 파이프라인처럼 이어 붙여 코드의 가독성과 재사용성을 높이는 기법입니다.

## 함수 합성이란?

수학에서 `(f∘g)(x) = f(g(x))`처럼, 함수를 합성하면 한 함수의 출력이 다음 함수의 입력이 됩니다.

```javascript
const double = x => x * 2;
const addTen = x => x + 10;

// 직접 중첩 호출
const result = addTen(double(5)); // 20

// 합성 함수
const doubleThenAdd = x => addTen(double(x));
doubleThenAdd(5); // 20
```

중첩 호출은 함수가 많아질수록 가독성이 떨어집니다. `f(g(h(i(x))))` 형태는 안쪽부터 읽어야 해서 직관적이지 않습니다.

![함수 합성 — compose vs pipe](/assets/posts/js-function-composition-concept.svg)

## compose: 오른쪽에서 왼쪽으로

수학 표기법을 따라 오른쪽에서 왼쪽 순서로 함수를 실행합니다. `reduceRight`로 간결하게 구현할 수 있습니다.

```javascript
const compose = (...fns) =>
  x => fns.reduceRight((value, fn) => fn(value), x);

const toLowerCase = s => s.toLowerCase();
const trim        = s => s.trim();
const toUpperCase = s => s.toUpperCase();

// toUpperCase(trim(toLowerCase(s))) 와 동일
const process = compose(toUpperCase, trim, toLowerCase);
process('  Hello World  '); // 'HELLO WORLD'
```

배열에서 가장 마지막 함수(`toLowerCase`)가 먼저 실행됩니다.

## pipe: 왼쪽에서 오른쪽으로

실행 순서와 코드 작성 순서를 일치시켜 가독성을 높입니다. 실무에서는 `pipe`를 더 많이 사용합니다.

```javascript
const pipe = (...fns) =>
  x => fns.reduce((value, fn) => fn(value), x);

const process = pipe(
  toLowerCase, // 1번째 실행
  trim,        // 2번째 실행
  toUpperCase  // 3번째 실행
);
process('  Hello World  '); // 'HELLO WORLD'
```

배열에서 첫 번째 함수(`toLowerCase`)가 먼저 실행됩니다. 영어 문장을 읽는 것처럼 위에서 아래로 순서를 파악할 수 있습니다.

## 실전: 데이터 정제 파이프라인

```javascript
const pipe = (...fns) => x => fns.reduce((v, f) => f(v), x);

const trim      = s => s.trim();
const lower     = s => s.toLowerCase();
const removeAt  = s => s.replace(/@.*$/, '');
const addDomain = s => `${s}@company.com`;

const normalizeEmail = pipe(trim, lower, removeAt, addDomain);

normalizeEmail('  Alice@Gmail.com  ');   // 'alice@company.com'
normalizeEmail('  BOB@HOTMAIL.COM  ');   // 'bob@company.com'
```

각 변환 함수는 한 가지 일만 합니다. 독립적으로 테스트할 수 있고, 다른 파이프라인에서도 재사용됩니다.

![실전 파이프라인 패턴](/assets/posts/js-function-composition-pipeline.svg)

## 포인트프리 스타일

커링과 함수 합성을 결합하면 데이터를 명시하지 않고 **변환 로직 자체**를 표현할 수 있습니다.

```javascript
const curry = fn => {
  const arity = fn.length;
  return function curried(...args) {
    if (args.length >= arity) return fn(...args);
    return (...more) => curried(...args, ...more);
  };
};

const pipe  = (...fns) => x => fns.reduce((v, f) => f(v), x);
const map   = curry((fn, arr) => arr.map(fn));
const filter= curry((pred, arr) => arr.filter(pred));
const take  = curry((n, arr) => arr.slice(0, n));

// 데이터(arr)를 명시하지 않음 — 포인트프리
const getTopActiveUsers = pipe(
  filter(u => u.active),
  map(u => u.name),
  take(5)
);

getTopActiveUsers(users); // 활성 사용자 이름 최대 5개
```

`getTopActiveUsers`는 **어떻게 처리할지**만 표현하고 **무엇을** 처리하는지는 나중에 전달합니다.

## 비동기 함수 합성

`Promise`도 합성할 수 있습니다. 각 함수가 값 또는 Promise를 반환하는 경우를 처리합니다.

```javascript
const pipeAsync = (...fns) =>
  x => fns.reduce((p, fn) => p.then(fn), Promise.resolve(x));

const fetchUser    = id => fetch(`/api/users/${id}`).then(r => r.json());
const fetchPosts   = user => fetch(`/api/posts?userId=${user.id}`).then(r => r.json());
const formatTitles = posts => posts.map(p => p.title);

const getUserPostTitles = pipeAsync(fetchUser, fetchPosts, formatTitles);

getUserPostTitles(42).then(console.log); // ['제목1', '제목2', ...]
```

## JavaScript Proposal: Pipeline Operator

TC39에서 파이프라인 연산자(`|>`)를 제안 중입니다. 언어 수준에서 함수 합성을 지원하게 됩니다.

```javascript
// 제안 문법 (Stage 2, 현재 미지원)
const result = '  Hello World  '
  |> toLowerCase(%)
  |> trim(%)
  |> toUpperCase(%);
```

아직 표준화되지 않았으므로 현재는 `pipe` 헬퍼를 직접 구현해 사용합니다.

## 주의 사항

- 합성에 참여하는 함수들은 **단항(unary)** 이어야 합니다. 여러 인자가 필요하면 커링으로 단항 함수로 만듭니다.
- 각 단계의 출력 타입이 다음 단계의 입력 타입과 일치해야 합니다.
- 너무 긴 파이프라인은 중간 단계를 추적하기 어렵습니다. 의미 있는 단위로 나눠 이름을 붙이세요.

함수 합성은 복잡한 로직을 작고 테스트 가능한 조각들로 표현하는 강력한 도구입니다. 다음 글에서는 재귀 최적화 기법인 **꼬리 호출 최적화(Tail Call Optimization)** 의 한계를 살펴봅니다.

---

**지난 글:** [메모이제이션](/posts/js-memoization/)

**다음 글:** [꼬리 호출 최적화의 한계](/posts/js-tail-call-limitations/)

<br>
읽어주셔서 감사합니다. 😊
