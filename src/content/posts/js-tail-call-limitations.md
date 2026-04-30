---
title: "꼬리 호출 최적화의 한계"
description: "ES2015에서 명세화된 꼬리 호출 최적화(TCO)가 왜 대부분의 JS 엔진에서 미구현 상태인지, 그리고 트램폴린과 반복문으로 어떻게 대응하는지 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-04-28"
archiveOrder: 25
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "꼬리 호출", "재귀", "TCO", "트램폴린", "스택 오버플로우"]
featured: false
draft: false
---

[지난 글](/posts/js-function-composition/)에서 작은 함수들을 조합하는 함수 합성을 배웠습니다. 이번에는 재귀 함수를 깊이 호출할 때 맞닥뜨리는 **스택 오버플로우** 문제와 이를 해결하기 위한 **꼬리 호출 최적화(Tail Call Optimization, TCO)** 그리고 그 현실적 한계를 살펴봅니다.

## 재귀와 콜 스택

함수를 호출하면 엔진은 콜 스택에 **스택 프레임**을 쌓습니다. 스택 프레임에는 인자, 지역 변수, 반환 주소 등이 담깁니다. 재귀 호출이 깊어지면 스택 프레임이 누적되어 한계에 도달하면 `RangeError: Maximum call stack size exceeded`가 발생합니다.

```javascript
function sum(n) {
  if (n <= 0) return 0;
  return n + sum(n - 1); // 재귀 호출 후 n을 더하는 작업이 남아 있음
}

sum(10000); // 💥 RangeError (환경에 따라 다름)
```

`n + sum(n - 1)`에서 `sum(n - 1)`이 반환된 후에도 `n`을 더하는 연산이 남아 있습니다. 따라서 엔진은 현재 스택 프레임을 유지한 채로 새 프레임을 쌓아야 합니다.

![일반 재귀 vs 꼬리 재귀 호출 스택](/assets/posts/js-tail-call-limitations-stack.svg)

## 꼬리 위치란?

함수 호출이 함수의 **마지막 동작**이고 반환값을 즉시 반환할 때, 이 호출을 **꼬리 위치(tail position)** 에 있다고 합니다.

```javascript
// 꼬리 위치 X: 반환 후 덧셈 연산이 남아 있음
return n + sum(n - 1);

// 꼬리 위치 O: 재귀 호출 결과를 즉시 반환
return sumTCO(n - 1, acc + n);
```

꼬리 위치에 있는 재귀 호출은 현재 스택 프레임을 재사용할 수 있습니다. 다시 돌아올 필요가 없으니까요.

## 꼬리 재귀 변환: Accumulator 패턴

누적 인자(accumulator)를 추가해 꼬리 재귀로 변환합니다.

```javascript
// 꼬리 재귀 버전
function sumTCO(n, acc = 0) {
  if (n <= 0) return acc;          // 기저 조건
  return sumTCO(n - 1, acc + n);  // 꼬리 위치
}

sumTCO(3);
// sumTCO(3, 0) → sumTCO(2, 3) → sumTCO(1, 5) → sumTCO(0, 6) → 6
```

중간 계산 결과를 `acc`에 담아 전달하므로, 현재 스택 프레임이 다음 호출에서 완전히 대체될 수 있습니다.

## ES2015 명세와 현실의 간극

ES2015(ES6)는 엄격 모드(`'use strict'`)에서 꼬리 위치의 호출을 최적화하도록 명세에 포함했습니다. 그러나 실상은 다릅니다.

| 엔진 | 환경 | TCO 지원 |
|---|---|---|
| JavaScriptCore | Safari, WKWebView | ✓ 지원 |
| V8 | Chrome, Node.js, Edge | ✗ 미구현 |
| SpiderMonkey | Firefox | ✗ 미구현 |

V8 팀은 TCO를 의도적으로 구현하지 않기로 결정했습니다. 주요 이유는 다음과 같습니다.

- **스택 트레이스 손실**: 최적화 시 중간 프레임이 사라져 디버깅이 어렵습니다.
- **개발자 기대 불일치**: 일반 재귀처럼 보이는 코드가 다르게 동작하면 혼란을 줍니다.
- **성능 오버헤드**: `'use strict'` 감지 비용이 생깁니다.

실용적으로 **Node.js와 브라우저(Chrome, Firefox)에서는 TCO를 기대할 수 없습니다.**

## 대안 1: 트램폴린 패턴

트램폴린(Trampoline)은 함수 대신 **함수를 반환하는 함수**를 루프로 실행하는 기법입니다. 재귀 대신 반복이 스택을 소비합니다.

```javascript
function trampoline(fn) {
  return function (...args) {
    let result = fn(...args);
    while (typeof result === 'function') {
      result = result(); // 반환된 함수를 즉시 실행
    }
    return result;
  };
}

const sumT = trampoline(function sum(n, acc = 0) {
  if (n <= 0) return acc;
  return () => sum(n - 1, acc + n); // 함수를 반환 (스택 미소비)
});

sumT(1000000); // 500000500000 — 스택 오버플로우 없음
```

스택 프레임이 1개로 유지되고, while 루프가 연속 호출을 처리합니다.

![TCO 대안: 트램폴린과 반복문](/assets/posts/js-tail-call-limitations-alternatives.svg)

## 대안 2: 반복문으로 변환 (가장 실용적)

깊은 재귀가 필요한 경우 가장 안전한 방법은 명시적 루프로 변환하는 것입니다.

```javascript
// 재귀 → 반복문
function sumIter(n) {
  let acc = 0;
  while (n > 0) {
    acc += n;
    n--;
  }
  return acc;
}

sumIter(1_000_000); // 500000500000 — 안전, 빠름
```

트리 순회처럼 자연스러운 재귀가 필요한 경우 명시적 스택(배열)을 사용합니다.

```javascript
// DFS 재귀 → 명시적 스택
function dfsIterative(root) {
  const stack = [root];
  const result = [];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) continue;
    result.push(node.val);
    stack.push(node.right, node.left); // 오른쪽 먼저 push (왼쪽 먼저 pop)
  }

  return result;
}
```

## 대안 3: 제너레이터 (다음 글 주제)

제너레이터 함수는 실행을 yield 지점에서 일시 정지하고 나중에 재개할 수 있습니다. 깊은 재귀를 제너레이터로 표현하면 스택 소비 없이 처리할 수 있습니다. 이 내용은 다음 글에서 자세히 다룹니다.

## 언제 재귀를 써도 되나?

- **입력 크기가 제한적**이고 스택 깊이가 수백 수준: 재귀가 오히려 명확합니다.
- **트리/그래프 탐색**: 깊이가 불분명하면 명시적 스택을 고려합니다.
- **수백만 이상의 재귀 깊이**: 반복문 또는 트램폴린을 사용합니다.

꼬리 호출 최적화는 명세에 있지만 실제 환경에서는 제한적으로만 동작합니다. 깊은 재귀가 필요할 때는 트램폴린 또는 반복문을 활용하세요. 다음 글에서는 실행을 중간에 멈추고 재개할 수 있는 **제너레이터 함수(Generator Functions)** 를 살펴봅니다.

---

**지난 글:** [함수 합성](/posts/js-function-composition/)

**다음 글:** [제너레이터 함수](/posts/js-generator-functions/)

<br>
읽어주셔서 감사합니다. 😊
