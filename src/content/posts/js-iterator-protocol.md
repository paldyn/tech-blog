---
title: "이터레이터 프로토콜"
description: "next()·return()·throw() 세 메서드로 구성된 이터레이터 프로토콜의 전체 명세와 지연 평가, 리소스 정리 패턴을 실습합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 3
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "이터레이터", "iterator", "next", "return", "throw", "지연 평가"]
featured: false
draft: false
---

[지난 글](/posts/js-iterable-protocol/)에서 이터러블 프로토콜을 살펴봤습니다. 이터러블이 "순회 가능하다"는 약속이라면, **이터레이터 프로토콜**은 그 순회를 실제로 수행하는 객체의 규격입니다.

## 이터레이터 프로토콜 명세

이터레이터는 다음 메서드를 가진 객체입니다.

| 메서드 | 필수 여부 | 반환 |
|---|---|---|
| `next(value?)` | 필수 | `{ value, done }` |
| `return(value?)` | 선택 | `{ value, done: true }` |
| `throw(error?)` | 선택 | `{ value, done }` |

```javascript
// 최소 이터레이터
const minimalIterator = {
  [Symbol.iterator]() { return this; },
  next() {
    return { value: 42, done: true }; // 단 한 번 반환 후 종료
  },
};

for (const v of minimalIterator) console.log(v); // 출력 없음 (done: true)
```

`done: false`가 아니면 값이 소비되지 않습니다. 값을 적어도 한 번 내려면 첫 호출에서 `done: false`를 반환해야 합니다.

![이터레이터 프로토콜 수명 주기](/assets/posts/js-iterator-protocol-lifecycle.svg)

## next() 심층 이해

`next()`에 인자를 전달할 수 있습니다. 이 값은 제너레이터 함수에서 `yield` 표현식의 결과로 받을 수 있습니다.

```javascript
function* adder() {
  let total = 0;
  while (true) {
    const delta = yield total; // next(delta) 로 전달한 값 수신
    total += delta ?? 0;
  }
}

const gen = adder();
gen.next();     // { value: 0, done: false } — 시작
gen.next(10);   // { value: 10, done: false }
gen.next(5);    // { value: 15, done: false }
```

## return() — 조기 종료와 리소스 정리

`for...of` 루프에서 `break`, `return`, 또는 예외로 루프를 이탈하면 엔진이 이터레이터의 `return()` 메서드를 호출합니다. 파일 핸들, 소켓 등 외부 리소스를 정리할 기회입니다.

```javascript
function makeFileIterator(lines) {
  let index = 0;
  return {
    [Symbol.iterator]() { return this; },
    next() {
      if (index < lines.length)
        return { value: lines[index++], done: false };
      return { value: undefined, done: true };
    },
    return() {
      console.log('[파일 이터레이터] 연결 정리');
      return { value: undefined, done: true };
    },
  };
}

const it = makeFileIterator(['a', 'b', 'c', 'd']);
for (const line of it) {
  if (line === 'b') break; // return() 호출됨
}
// 출력: [파일 이터레이터] 연결 정리
```

제너레이터 함수는 `return()`이 자동으로 구현돼 있어 `try...finally`로 정리 로직을 작성합니다.

```javascript
function* withCleanup() {
  try {
    yield 1;
    yield 2;
  } finally {
    console.log('정리 완료'); // break 시 실행
  }
}

for (const v of withCleanup()) {
  if (v === 1) break;
}
// 정리 완료
```

## throw() — 에러 주입

이터레이터 내부에 예외를 던질 때 사용합니다. 주로 제너레이터와 함께 씁니다.

```javascript
function* safeGen() {
  try {
    yield 1;
    yield 2;
  } catch (e) {
    console.log('에러 수신:', e.message);
    yield -1; // 에러 후 복구 값
  }
}

const g = safeGen();
g.next();           // { value: 1, done: false }
g.throw(new Error('문제 발생')); // 에러 수신: 문제 발생 → { value: -1, done: false }
g.next();           // { value: undefined, done: true }
```

## 지연 평가(Lazy Evaluation)

이터레이터는 `next()` 호출 시점에만 값을 계산합니다. 덕분에 무한 수열도 메모리 부담 없이 표현할 수 있습니다.

![무한 피보나치 이터레이터와 take 유틸](/assets/posts/js-iterator-protocol-lazy.svg)

```javascript
function* naturals() {
  let n = 0;
  while (true) yield n++;
}

// 첫 5개만 소비
const result = [];
for (const n of naturals()) {
  result.push(n);
  if (n >= 4) break;
}
console.log(result); // [0, 1, 2, 3, 4]
```

## Iterator Helpers (Stage 3+)

TC39에서 이터레이터 변환 메서드를 표준화하고 있습니다. V8 v12 이상, Firefox 131+에서 사용 가능합니다.

```javascript
// Iterator.prototype.map / filter / take / drop / toArray
const squares = naturals()
  .take(5)
  .map(n => n * n)
  .toArray();
// [0, 1, 4, 9, 16]
```

아직 모든 환경에서 쓸 수 없으므로 `take` 같은 유틸 함수를 직접 구현하거나 폴리필을 사용합니다.

다음 글에서는 이터레이터를 훨씬 간결하게 작성할 수 있는 **제너레이터 함수 응용 패턴**을 살펴봅니다.

---

**지난 글:** [이터러블 프로토콜](/posts/js-iterable-protocol/)

**다음 글:** [제너레이터 응용 패턴](/posts/js-generator-applications/)

<br>
읽어주셔서 감사합니다. 😊
