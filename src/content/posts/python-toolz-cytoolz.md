---
title: "toolz와 cytoolz: Python 함수형 프로그래밍 라이브러리"
description: "toolz의 itertoolz, functoolz, dicttoolz 모듈 핵심 함수들과 cytoolz 성능 차이, compose/pipe/curry/frequencies 등 실전 활용법을 소개합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 5
type: "knowledge"
category: "Python"
tags: ["Python", "toolz", "cytoolz", "함수형프로그래밍", "compose", "pipe", "curry"]
featured: false
draft: false
---

[지난 글](/posts/python-currying-partial/)에서 커링과 `functools.partial`을 다뤘다. Python 표준 라이브러리만으로도 함수형 프로그래밍이 가능하지만, **toolz** 라이브러리는 더 풍부한 함수형 도구를 제공한다. 함수 합성, 커링, 딕셔너리 변환, 시퀀스 처리를 위한 수십 가지 유틸리티가 들어 있다.

## toolz란?

`toolz`는 함수형 프로그래밍 스타일을 Python에서 자연스럽게 구사할 수 있도록 돕는 라이브러리다. Clojure의 함수형 유틸리티에서 영감을 받았으며, 세 개의 서브모듈로 구성된다.

- **`toolz.itertoolz`**: 시퀀스/이터러블 처리
- **`toolz.functoolz`**: 함수 변환 및 조합
- **`toolz.dicttoolz`**: 딕셔너리 변환

![toolz 핵심 함수 분류](/assets/posts/python-toolz-cytoolz-overview.svg)

```bash
pip install toolz       # 순수 Python 구현
pip install cytoolz     # Cython 구현 (2~5배 빠름, 컴파일러 필요)
```

`cytoolz`는 `toolz`와 동일한 API를 Cython으로 재구현한 것이다. 대부분의 경우 `from cytoolz import ...`로 드롭인 교체하면 성능이 올라간다.

## functoolz: 함수 합성과 변환

![toolz 핵심 함수 예제](/assets/posts/python-toolz-cytoolz-examples.svg)

**`compose`**: 함수를 오른쪽에서 왼쪽으로 합성한다.

```python
from toolz import compose

double = lambda x: x * 2
add1 = lambda x: x + 1
square = lambda x: x ** 2

# square(add1(double(x)))
transform = compose(square, add1, double)
print(transform(3))   # square(add1(6)) = square(7) = 49
```

**`pipe`**: 데이터를 왼쪽에서 오른쪽으로 함수들에 통과시킨다. 읽기 순서가 자연스러워 더 직관적이다.

```python
from toolz import pipe

result = pipe(
    3,
    lambda x: x * 2,    # 6
    lambda x: x + 1,    # 7
    lambda x: x ** 2,   # 49
)
print(result)   # 49
```

**`curry`**: 데코레이터로 함수를 자동 커링한다. 인자를 부분적으로 전달하면 나머지 인자를 기다리는 새 함수를 반환한다.

```python
from toolz import curry

@curry
def add(a, b, c):
    return a + b + c

add10 = add(10)           # a=10 고정
add10_20 = add10(20)      # a=10, b=20 고정
print(add10_20(30))       # 60

# 혼합 호출도 가능
print(add(1)(2)(3))       # 6
print(add(1, 2)(3))       # 6
print(add(1)(2, 3))       # 6
```

**`memoize`**: 함수 결과를 캐시한다. `functools.lru_cache`와 비슷하지만 더 유연하다.

```python
from toolz import memoize

@memoize
def slow_fib(n):
    if n < 2:
        return n
    return slow_fib(n - 1) + slow_fib(n - 2)
```

## itertoolz: 시퀀스 처리

```python
from toolz.itertoolz import (
    first, second, last, take, drop,
    partition, sliding_window,
    frequencies, groupby, unique
)

data = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3]

print(first(data))               # 3
print(take(3, data))             # (3, 1, 4)
print(list(drop(7, data)))       # [6, 5, 3]

# 빈도 계산
print(frequencies(data))
# {3: 2, 1: 2, 4: 1, 5: 2, 9: 1, 2: 1, 6: 1}

# 조건으로 그룹핑
words = ["apple", "ant", "bear", "bee", "cat"]
print(groupby(lambda w: w[0], words))
# {"a": ["apple", "ant"], "b": ["bear", "bee"], "c": ["cat"]}

# 슬라이딩 윈도우
print(list(sliding_window(3, [1, 2, 3, 4, 5])))
# [(1, 2, 3), (2, 3, 4), (3, 4, 5)]
```

## dicttoolz: 딕셔너리 변환

```python
from toolz.dicttoolz import valmap, keymap, merge, assoc, dissoc

d = {"a": 1, "b": 2, "c": 3}

# 모든 값에 함수 적용
print(valmap(lambda v: v * 10, d))
# {"a": 10, "b": 20, "c": 30}

# 모든 키에 함수 적용
print(keymap(str.upper, d))
# {"A": 1, "B": 2, "C": 3}

# 불변 방식으로 값 추가/삭제
d2 = assoc(d, "d", 4)      # {"a":1, "b":2, "c":3, "d":4}
d3 = dissoc(d, "b")        # {"a":1, "c":3}
print(d)                    # 원본은 변경 없음
```

## toolz vs 표준 라이브러리

| 기능 | 표준 라이브러리 | toolz |
|------|----------------|-------|
| 함수 합성 | `functools.reduce` 수동 | `compose`, `pipe` |
| 커링 | `functools.partial` 수동 | `@curry` |
| 빈도 계산 | `collections.Counter` | `frequencies` |
| 딕셔너리 병합 | `{**a, **b}` | `merge` |
| 슬라이딩 윈도우 | 직접 구현 | `sliding_window` |
| 메모이제이션 | `functools.lru_cache` | `memoize` |

표준 라이브러리가 더 의존성이 적지만, `toolz`는 함수형 스타일을 일관되게 유지하고 싶을 때 코드를 훨씬 간결하게 만들어 준다. 다음 글에서는 `pipe`를 활용한 함수형 파이프 패턴을 더 깊이 살펴본다.

---

**지난 글:** [커링과 부분 적용: functools.partial 완전 정복](/posts/python-currying-partial/)

**다음 글:** [파이프 패턴: 데이터를 흘리는 함수형 파이프라인](/posts/python-pipe-pattern/)

<br>
읽어주셔서 감사합니다. 😊
