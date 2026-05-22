---
title: "Ramda와 lodash/fp — 함수형 유틸리티 라이브러리"
description: "Ramda와 lodash/fp의 커링·파이프라인·포인트프리 스타일을 비교합니다. 렌즈를 활용한 중첩 객체 불변 업데이트, 트랜스듀서로 성능 최적화하는 방법까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 4
type: "knowledge"
category: "JavaScript"
tags: ["JavaScript", "함수형프로그래밍", "Ramda", "lodash", "커링", "파이프라인", "렌즈", "FP"]
featured: false
draft: false
---

[지난 글](/posts/fp-functor-monad-intro/)에서 펑터와 모나드의 개념을 살펴봤습니다. 이번에는 FP 스타일을 JavaScript에서 실용적으로 사용할 수 있게 해주는 두 라이브러리, **Ramda** 와 **lodash/fp** 를 비교합니다.

## 왜 FP 유틸리티 라이브러리가 필요한가

Vanilla JavaScript는 `Array.map`, `filter`, `reduce`를 제공하지만, 커링이 기본이 아니고 함수 합성 도구가 부족합니다. FP 라이브러리는 이를 보완합니다.

```js
// Vanilla: 명시적 인수 전달 필요
const doubled = arr.map(x => x * 2);

// Ramda: 커링으로 포인트프리 가능
const doubled = R.map(R.multiply(2)); // 데이터 없이 함수 정의
```

## Ramda vs lodash/fp

![Ramda vs lodash/fp 비교](/assets/posts/fp-ramda-lodash-fp-compare.svg)

**Ramda**는 처음부터 FP를 위해 설계되었습니다. 모든 함수가 자동 커링되고, 불변성을 기본으로 합니다. 데이터를 마지막 인수로 받는 "data-last" 설계로 포인트프리 스타일에 최적입니다.

**lodash/fp**는 기존 lodash를 FP 친화적으로 래핑한 것입니다. 함수 인수 순서를 data-last로 뒤집고, 자동 커링을 추가합니다. lodash에 이미 익숙하다면 진입 장벽이 낮습니다.

```js
// 번들 크기 최적화 — 필요한 함수만 임포트
import pipe from 'ramda/src/pipe';
import filter from 'ramda/src/filter';
import map from 'ramda/src/map';

// 또는 lodash/fp 개별 임포트
import flow from 'lodash/fp/flow';
import filter from 'lodash/fp/filter';
```

## 커링(Currying)

Ramda의 모든 함수는 자동 커링됩니다.

```js
import * as R from 'ramda';

// add(a, b)를 하나씩 적용
const add5 = R.add(5);     // 부분 적용 — a=5 고정
add5(3);                    // 8

// 플레이스홀더로 중간 인수 고정
const divideBy2 = R.divide(R.__, 2); // b=2 고정
divideBy2(10);              // 5
```

`R.__`는 플레이스홀더로, 특정 위치의 인수를 건너뛸 수 있습니다.

## pipe와 compose

함수 합성의 두 방향입니다.

```js
// pipe: 왼쪽에서 오른쪽 (읽기 편함)
const process = R.pipe(
  R.filter(x => x > 0),
  R.map(R.multiply(2)),
  R.reduce(R.add, 0)
);
process([-1, 2, 3, -4, 5]); // (2+3+5)*2 = 20

// compose: 오른쪽에서 왼쪽 (수학적 표기)
const transform = R.compose(
  R.reduce(R.add, 0),
  R.map(R.multiply(2)),
  R.filter(x => x > 0)
);
// 동일 결과
```

대부분의 경우 읽기 쉬운 `pipe`를 선호합니다.

## 포인트프리 스타일

인수를 명시하지 않고 함수만 조합하는 스타일입니다.

```js
// 명시적 인수
const getNames = users => users.map(u => u.name);

// 포인트프리
const getNames = R.map(R.prop('name'));

// 활성 사용자 이름 목록
const getActiveNames = R.pipe(
  R.filter(R.prop('active')),
  R.map(R.prop('name'))
);

getActiveNames(users); // ['Alice', 'Bob', ...]
```

포인트프리 코드는 간결하지만 가독성이 떨어질 수 있습니다. 팀 합의가 중요합니다.

## 렌즈(Lens) — 중첩 객체 업데이트

렌즈는 중첩 구조의 특정 부분을 **읽고·수정하는 조합 가능한 도구**입니다.

![렌즈와 트랜스듀서](/assets/posts/fp-ramda-lodash-fp-lens.svg)

```js
const user = {
  name: 'Alice',
  address: { city: 'Seoul', zip: '04524' }
};

// lensPath로 깊은 경로 지정
const cityLens = R.lensPath(['address', 'city']);

// 읽기
R.view(cityLens, user);        // 'Seoul'

// 불변 업데이트 — 원본 보존
const updated = R.set(cityLens, 'Busan', user);
// { name: 'Alice', address: { city: 'Busan', zip: '04524' } }

// 함수로 변환
const upper = R.over(cityLens, s => s.toUpperCase(), user);
// { ..., address: { city: 'SEOUL', ... } }
```

렌즈를 합성하면 더 복잡한 구조도 다룰 수 있습니다.

```js
const streetLens = R.lensPath(['address', 'street']);
const zipLens = R.lensPath(['address', 'zip']);

// 여러 필드 동시 업데이트
const updateAddress = R.pipe(
  R.set(streetLens, '123 Main St'),
  R.set(zipLens, '12345')
);
const result = updateAddress(user);
```

## lodash/fp의 set과 update

lodash/fp는 Ramda의 렌즈보다 단순하지만 실용적인 방법을 제공합니다.

```js
import { set, update, flow } from 'lodash/fp';

// 불변 set
const updated = set('address.city', 'Busan', user);

// 함수로 업데이트
const uppercased = update('address.city', s => s.toUpperCase(), user);

// 파이프라인으로 여러 업데이트
const transform = flow([
  set('address.city', 'Busan'),
  set('address.zip', '12345'),
]);
```

## 트랜스듀서 — 효율적인 파이프라인

일반 `filter + map + reduce` 체인은 각 단계마다 중간 배열을 생성합니다. 트랜스듀서는 이를 **한 번의 순회**로 처리합니다.

```js
const xf = R.compose(
  R.filter(x => x > 10),
  R.map(R.multiply(2))
);

// 중간 배열 없이 한 번에 처리
R.transduce(xf, R.flip(R.append), [], [5, 15, 20, 25]);
// [30, 40, 50] — filter(>10) 후 multiply(2)
```

대규모 데이터 처리에서 메모리와 성능 이점이 있습니다.

## 선택 기준

| 기준 | Ramda | lodash/fp |
|---|---|---|
| FP 엄밀성 | ★★★★★ | ★★★★☆ |
| 번들 크기 | 중간 (~12KB gzip) | 개별 임포트 유리 |
| 렌즈/트랜스듀서 | 내장 | 제한적 |
| 학습 곡선 | 가파름 | 완만 |
| 팀 익숙도 | lodash 경험 무의미 | lodash 경험 활용 |

## 정리

Ramda와 lodash/fp는 JavaScript에 커링·파이프라인·포인트프리 스타일을 가져옵니다. Ramda는 FP를 깊이 파고들 때, lodash/fp는 기존 lodash 팀에서 점진적으로 FP를 도입할 때 적합합니다.

---

**지난 글:** [펑터와 모나드 입문 — 함수형 프로그래밍의 핵심 추상](/posts/fp-functor-monad-intro/)

**다음 글:** [Immer와 Immutable.js — 불변 데이터 구조 라이브러리](/posts/fp-immutable-immer/)

<br>
읽어주셔서 감사합니다. 😊
