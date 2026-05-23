---
title: "무한 이터레이터: count, cycle, repeat와 islice 활용"
description: "itertools의 count(), cycle(), repeat() 무한 이터레이터와 이를 안전하게 제어하는 islice(), takewhile(), next() 패턴을 실전 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 10
type: "knowledge"
category: "Python"
tags: ["Python", "itertools", "count", "cycle", "repeat", "islice", "무한이터레이터"]
featured: false
draft: false
---

[지난 글](/posts/python-itertools-chain-product/)에서 `chain`, `product`, `combinations` 등 itertools의 핵심 함수를 살펴봤다. 이번 글에서는 `itertools`에서 특별한 위치를 차지하는 세 가지 **무한 이터레이터** `count`, `cycle`, `repeat`를 집중적으로 다룬다. 끝이 없는 이터레이터를 올바르게 사용하는 방법과 `islice`로 안전하게 제어하는 패턴도 함께 설명한다.

## 무한 이터레이터란

무한 이터레이터는 `StopIteration`을 발생시키지 않고 끝없이 값을 생성하는 이터레이터다. Python에서는 `itertools.count`, `itertools.cycle`, `itertools.repeat` 세 가지가 무한 이터레이터다.

```python
from itertools import count, cycle, repeat

# 절대 이렇게 쓰지 말것
# list(count())   ← 메모리 무한 소비
# for x in cycle([1,2,3]): pass   ← 무한 루프
```

무한 이터레이터를 쓸 때는 반드시 종료 조건을 지정해야 한다.

![세 가지 무한 이터레이터](/assets/posts/python-infinite-iterator-types.svg)

## count(start=0, step=1)

`start`부터 시작해 `step`씩 증가하는 수를 무한히 생성한다.

```python
from itertools import count

# 기본: 0, 1, 2, 3, ...
counter = count()

# 시작과 간격 지정
evens = count(0, 2)    # 0, 2, 4, 6, ...
odds = count(1, 2)     # 1, 3, 5, 7, ...

# 소수점도 지원
halves = count(0, 0.5)  # 0.0, 0.5, 1.0, 1.5, ...
```

`enumerate()`가 `zip(count(), iterable)`과 동일하다. `count`의 시작값을 바꾸면 `enumerate(iterable, start=n)`처럼 동작한다.

```python
items = ["a", "b", "c"]

# enumerate 대용
for idx, item in zip(count(1), items):
    print(f"{idx}. {item}")
# 1. a  2. b  3. c
```

## cycle(iterable)

이터러블의 요소를 무한히 반복한다. 내부적으로 요소를 복사해 저장한다.

```python
from itertools import cycle

colors = cycle(["red", "green", "blue"])
# red, green, blue, red, green, blue, ...
```

`cycle`은 처음 순회 시 요소를 내부 버퍼에 저장하고, 이후부터 버퍼에서 재생한다. 따라서 원본 이터러블이 소진된 후에도 동작한다.

실용 예: 순환 색상 지정

```python
from itertools import cycle, islice

colors = cycle(["#e74c3c", "#3498db", "#2ecc71", "#f39c12"])
labels = ["데이터A", "데이터B", "데이터C", "데이터D", "데이터E"]

for label, color in zip(labels, colors):
    print(f"{label}: {color}")
# 데이터A: #e74c3c
# 데이터B: #3498db
# 데이터C: #2ecc71
# 데이터D: #f39c12
# 데이터E: #e74c3c  ← 다시 처음으로
```

## repeat(object, times=None)

같은 값을 반복한다. `times`를 지정하면 유한, 생략하면 무한이다.

```python
from itertools import repeat

# 유한: 3번
list(repeat(0, 3))   # [0, 0, 0]

# 무한
zeros = repeat(0)    # 0, 0, 0, ...
```

`map()`과 함께 고정 인자를 제공할 때 자주 쓰인다.

```python
# pow(base, exp)에서 exp를 3으로 고정
list(map(pow, range(5), repeat(3)))
# [0, 1, 8, 27, 64]  ← 0³, 1³, 2³, 3³, 4³
```

이는 `functools.partial(pow, exponent=3)` 대신 쓸 수 있는 간결한 패턴이다.

## islice()로 무한 이터레이터 제어

![islice()로 무한 이터레이터 제어](/assets/posts/python-infinite-iterator-islice.svg)

`islice(iterable, stop)` 또는 `islice(iterable, start, stop[, step])`으로 이터레이터를 슬라이싱한다.

```python
from itertools import islice, count

# 처음 10개
list(islice(count(), 10))          # [0, 1, 2, ..., 9]

# 5번째부터 10번째까지
list(islice(count(), 5, 10))       # [5, 6, 7, 8, 9]

# 0부터 20까지 3 간격
list(islice(count(), 0, 20, 3))    # [0, 3, 6, 9, 12, 15, 18]
```

주의: `islice()`는 음수 인덱스를 지원하지 않는다.

## 무한 이터레이터 + 파이프라인

무한 이터레이터를 다른 itertools 함수와 조합해 강력한 파이프라인을 만들 수 있다.

```python
from itertools import count, takewhile, dropwhile

# 조건이 True인 동안만 취하기
first_small = list(takewhile(lambda x: x < 5, count()))
# [0, 1, 2, 3, 4]

# 특정 조건 이후부터
from itertools import dropwhile
after_ten = list(islice(dropwhile(lambda x: x < 10, count()), 5))
# [10, 11, 12, 13, 14]
```

## 무한 피보나치 수열

무한 이터레이터의 가장 대표적인 예다.

```python
from itertools import islice

def fibonacci():
    a, b = 0, 1
    while True:
        yield a
        a, b = b, a + b

# 처음 10개
print(list(islice(fibonacci(), 10)))
# [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]

# 1000 이하의 피보나치 수
fibs_under_1000 = list(takewhile(lambda x: x < 1000, fibonacci()))
```

## next()로 무한 이터레이터에서 하나씩 꺼내기

`for` 루프 대신 `next()`를 쓰면 무한 이터레이터를 안전하게 조건부로 소비할 수 있다.

```python
from itertools import count

counter = count()

# 3의 배수가 아닌 첫 번째 값 찾기
first_non_multiple = next(x for x in counter if x % 3 != 0)
# 1

# 100 이상 소수 찾기
def is_prime(n):
    if n < 2: return False
    return all(n % i for i in range(2, int(n**0.5) + 1))

first_prime_over_100 = next(n for n in count(101) if is_prime(n))
# 101
```

## cycle을 활용한 라운드 로빈 분배

```python
from itertools import cycle

def round_robin(*iterables):
    """여러 이터러블에서 번갈아 가며 하나씩 꺼낸다"""
    pending = len(iterables)
    nexts = cycle(iter(it).__next__ for it in iterables)
    while pending:
        try:
            for next_fn in islice(nexts, pending):
                yield next_fn()
        except StopIteration:
            pending -= 1

list(round_robin("ABC", [1, 2], range(3, 6)))
# ['A', 1, 3, 'B', 2, 4, 'C', 5]
```

## repeat의 주의점: 가변 객체

`repeat(obj)`는 같은 객체를 반복 반환한다. 가변 객체라면 예상치 못한 공유가 발생한다.

```python
# 위험: 모든 요소가 같은 리스트를 참조
rows = list(repeat([], 3))
rows[0].append(1)
print(rows)   # [[1], [1], [1]]  ← 모두 변경됨!

# 안전: 각각 새 리스트
rows = [[] for _ in range(3)]
rows[0].append(1)
print(rows)   # [[1], [], []]
```

## 정리

| 무한 이터레이터 | 시그니처 | 생성 값 |
|----------------|----------|---------|
| `count` | `count(start, step)` | start, start+step, start+2*step, … |
| `cycle` | `cycle(iterable)` | 요소 무한 반복 (복사본 저장) |
| `repeat` | `repeat(obj, times)` | 동일 객체 반복 (times 없으면 무한) |

| 제어 함수 | 역할 |
|-----------|------|
| `islice(it, n)` | 처음 n개 |
| `islice(it, s, e)` | s번째부터 e번째 |
| `takewhile(pred, it)` | 조건 True 동안 |
| `next(gen_exp)` | 첫 번째 매칭 요소 |

무한 이터레이터와 `islice`를 함께 쓰는 패턴은 Python에서 지연 평가의 정수다. 값을 미리 만들지 않고 필요할 때만 꺼내는 이 방식은 메모리를 절약하고 파이프라인 처리를 가능하게 한다. 다음 글에서는 함수형 프로그래밍의 핵심 개념인 불변성(immutability)을 살펴본다.

---

**지난 글:** [itertools 핵심: chain, product, combinations](/posts/python-itertools-chain-product/)

**다음 글:** [불변성(Immutability): Python에서 변경 불가 데이터 다루기](/posts/python-immutability/)

<br>
읽어주셔서 감사합니다. 😊
