---
title: "iter()와 next() 내장 함수 심층 탐구"
description: "iter()의 두 가지 형태(이터러블 변환, 센티넬 패턴)와 next()의 기본값 형태를 실무 예제와 함께 완전히 이해합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["Python", "iter", "next", "센티넬", "이터레이터", "내장함수"]
featured: false
draft: false
---

[지난 글](/posts/python-iterator-protocol/)에서 이터레이터 프로토콜의 구조를 살펴봤다. 이번 글에서는 프로토콜의 진입점인 `iter()`와 `next()` 내장 함수를 더 깊이 파고든다. 특히 `iter()`의 두 번째 형태인 센티넬 패턴은 실무에서 의외로 자주 쓰이지만 잘 알려지지 않았다.

## iter() — 이터레이터를 꺼내는 함수

`iter(obj)`는 `obj.__iter__()`를 호출하고 그 결과를 돌려준다.

```python
nums = [1, 2, 3]
it = iter(nums)
print(type(it))   # <class 'list_iterator'>
print(it is nums) # False (새 이터레이터 객체)

# 이미 이터레이터면 동일 객체를 반환
it2 = iter(it)
print(it2 is it)  # True
```

이터레이터에 `iter()`를 적용하면 자기 자신이 반환된다. `__iter__()`가 `self`를 반환하기 때문이다. 이 성질 덕분에 이터레이터를 for 루프에 직접 넣거나 `iter()`를 한 번 더 감싸도 문제없이 동작한다.

![iter()와 next() 내장 함수 시그니처](/assets/posts/python-iter-next-functions.svg)

## iter()의 두 번째 형태: 센티넬 패턴

`iter(callable, sentinel)` 형태는 파이썬 공식 문서에 명시되어 있지만 많이 모른다.

- `callable`: 인수 없이 호출할 수 있는 객체
- `sentinel`: 종료 신호 값

이 이터레이터는 `callable()`을 반복 호출한다. 반환 값이 `sentinel`과 같으면 `StopIteration`을 발생시킨다. `sentinel` 값 자체는 결과에 포함되지 않는다.

```python
import random

# 6이 나올 때까지 주사위를 굴려 결과를 수집
results = list(iter(lambda: random.randint(1, 6), 6))
print(results)  # 예: [3, 1, 4, 2]  (6은 포함 안 됨)
```

센티넬 패턴이 특히 유용한 곳은 **파일 읽기**다.

```python
# 기존 방법
with open("data.txt") as f:
    while True:
        chunk = f.read(4096)
        if not chunk:
            break
        process(chunk)

# 센티넬 패턴
with open("data.txt") as f:
    for chunk in iter(lambda: f.read(4096), b""):
        process(chunk)
```

두 번째 방법이 더 간결하고 의도가 명확하다. `f.read(4096)`이 빈 bytes를 반환하면 EOF임을 나타내는 것을 그대로 센티넬로 활용한다.

## next() — 하나씩 꺼내는 함수

`next(iterator)`는 `iterator.__next__()`를 호출한다.

```python
it = iter(range(3))
print(next(it))  # 0
print(next(it))  # 1
print(next(it))  # 2
# next(it)       # StopIteration 발생
```

### next()의 기본값 형태

`next(iterator, default)` 형태는 이터레이터가 소진됐을 때 예외 대신 `default`를 반환한다.

```python
it = iter([10, 20])
print(next(it, 0))  # 10
print(next(it, 0))  # 20
print(next(it, 0))  # 0   (소진 → 예외 없이 기본값)
print(next(it, 0))  # 0   (계속 기본값)
```

![센티넬 패턴과 next() 기본값 사용 예시](/assets/posts/python-iter-next-sentinel.svg)

### 실무 패턴: 첫 번째 요소만 꺼내기

리스트나 이터러블에서 첫 번째 값만 안전하게 꺼내는 관용 코드다.

```python
items = []

# 방법 1: 조건 검사
first = items[0] if items else None

# 방법 2: next + iter (이터러블 전반에 통용)
first = next(iter(items), None)
```

`next(iter(items), None)`은 빈 이터러블에도 안전하고, 리스트 뿐 아니라 제너레이터 등 모든 이터러블에 적용된다.

조건식을 만족하는 첫 번째 요소를 찾을 때도 활용한다.

```python
users = [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]

# 25살 이상 첫 번째 사용자
first_adult = next((u for u in users if u["age"] >= 25), None)
print(first_adult)  # {"name": "Alice", "age": 30}
```

제너레이터 식을 `iter()`로 감쌀 필요 없이 바로 `next()`에 전달할 수 있다. 제너레이터 식은 이미 이터레이터이기 때문이다.

## iter()가 TypeError를 발생시키는 경우

인자로 전달한 객체에 `__iter__()`가 없으면 `TypeError`가 발생한다.

```python
iter(42)        # TypeError: 'int' object is not iterable
iter(None)      # TypeError: 'NoneType' object is not iterable
```

단, `__getitem__()`만 있는 옛날 스타일 시퀀스는 예외다.

```python
class OldStyle:
    def __getitem__(self, idx):
        if idx >= 3:
            raise IndexError
        return idx * 10

for x in OldStyle():
    print(x)  # 0  10  20
```

`__iter__()`가 없어도 `__getitem__()`이 있으면 Python은 0부터 시작해 `IndexError`가 날 때까지 인덱스를 증가시키며 호출하는 폴백 이터레이터를 생성한다. 새 코드에서는 `__iter__`를 명시적으로 구현하는 것이 권장된다.

## next() 직접 호출이 필요한 상황

for 루프로는 두 이터레이터를 병렬로 소비하기 어렵다. 이럴 때 `next()`를 직접 쓴다.

```python
a = iter([1, 2, 3, 4])
b = iter([10, 20, 30, 40])

pairs = []
for x in a:
    y = next(b, None)
    if y is None:
        break
    pairs.append((x, y))

print(pairs)  # [(1, 10), (2, 20), (3, 30), (4, 40)]
```

물론 이런 경우는 보통 `zip()`이 더 간결하지만, 비대칭 이터레이터 소비나 특수 조건이 있을 때는 `next()` 직접 호출이 필요하다.

## 정리

| 함수 | 시그니처 | 핵심 동작 |
|------|----------|-----------|
| `iter(obj)` | 이터러블 → 이터레이터 | `obj.__iter__()` 위임 |
| `iter(fn, sentinel)` | callable → 센티넬 이터레이터 | `fn()` 반복 호출, sentinel에서 중단 |
| `next(it)` | 이터레이터 → 값 | `it.__next__()` 위임, 소진 시 `StopIteration` |
| `next(it, default)` | 이터레이터 → 값 or default | 소진 시 예외 없이 `default` 반환 |

`iter()`와 `next()`를 자유자재로 쓰면 for 루프 없이도 이터레이터를 정교하게 제어할 수 있다. 다음 글에서는 이터레이터를 더 쉽게 만드는 제너레이터 함수를 소개한다.

---

**지난 글:** [Python 이터레이터 프로토콜: __iter__와 __next__ 완전 이해](/posts/python-iterator-protocol/)

**다음 글:** [제너레이터 함수: yield로 만드는 지연 이터레이터](/posts/python-generator-function/)

<br>
읽어주셔서 감사합니다. 😊
