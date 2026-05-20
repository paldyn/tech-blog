---
title: "operator 모듈: 연산을 함수로 다루기"
description: "Python operator 모듈의 핵심 기능을 설명합니다. add/sub/mul 등 산술 함수, itemgetter/attrgetter/methodcaller, 비교 함수, reduce와 조합, lambda 대체 패턴까지 실전 예제와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 4
type: "knowledge"
category: "Python"
tags: ["Python", "operator", "itemgetter", "attrgetter", "methodcaller", "함수형프로그래밍", "표준라이브러리"]
featured: false
draft: false
---

[지난 글](/posts/python-functools-partial/)에서 `partial`로 함수 인자를 고정하는 방법을 살펴봤습니다. 이번 글에서는 `operator` 모듈을 다룹니다. Python의 연산자(`+`, `<`, `[]` 등)를 함수 객체로 제공하는 이 모듈은 `map`, `sorted`, `functools.reduce` 등 고차 함수와 조합할 때 특히 유용합니다.

## operator 모듈이 필요한 이유

고차 함수에 연산을 전달하려면 보통 `lambda`를 씁니다.

```python
from functools import reduce

total = reduce(lambda a, b: a + b, [1, 2, 3, 4])  # 10
```

`operator` 모듈을 쓰면 `lambda` 없이 더 명확하게 표현할 수 있습니다.

```python
from functools import reduce
from operator import add

total = reduce(add, [1, 2, 3, 4])   # 10
```

`operator` 함수는 C 구현이라 `lambda`보다 빠르고, `pickle` 직렬화가 가능해서 `multiprocessing`에서도 안전하게 쓸 수 있습니다.

![operator 모듈 개요](/assets/posts/python-operator-module-overview.svg)

## 산술·비교 함수

```python
import operator

# 산술
operator.add(3, 4)      # 7   (3 + 4)
operator.sub(10, 3)     # 7   (10 - 3)
operator.mul(3, 4)      # 12  (3 * 4)
operator.truediv(10, 4) # 2.5 (10 / 4)
operator.floordiv(10,4) # 2   (10 // 4)
operator.mod(10, 3)     # 1   (10 % 3)
operator.pow(2, 10)     # 1024(2 ** 10)
operator.neg(5)         # -5  (-5)
operator.abs(-7)        # 7

# 비교
operator.eq(1, 1)       # True  (==)
operator.ne(1, 2)       # True  (!=)
operator.lt(3, 5)       # True  (<)
operator.le(5, 5)       # True  (<=)
operator.gt(5, 3)       # True  (>)
operator.ge(5, 5)       # True  (>=)
```

## itemgetter — 컨테이너 키 접근

`itemgetter(key)`는 `obj[key]`를 반환하는 callable을 만듭니다. 딕셔너리, 튜플, 리스트 모두 지원합니다.

```python
from operator import itemgetter

users = [
    {'name': 'Charlie', 'age': 28},
    {'name': 'Alice',   'age': 35},
    {'name': 'Bob',     'age': 22},
]

# 단일 키 정렬
sorted(users, key=itemgetter('age'))
# [Bob(22), Charlie(28), Alice(35)]

# 다중 키 정렬 (age 먼저, 같으면 name 순)
sorted(users, key=itemgetter('age', 'name'))
```

튜플 리스트에도 쓸 수 있습니다.

```python
data = [(1, 'banana'), (3, 'apple'), (2, 'cherry')]
sorted(data, key=itemgetter(1))
# [(3,'apple'), (1,'banana'), (2,'cherry')]  — 두 번째 원소 기준

# 여러 인덱스를 동시에 추출
get_0_2 = itemgetter(0, 2)
get_0_2((10, 20, 30, 40))   # (10, 30)
```

## attrgetter — 객체 속성 접근

`attrgetter('attr')`는 `obj.attr`을 반환하는 callable입니다. 중첩 속성도 점(.)으로 지정할 수 있습니다.

```python
from operator import attrgetter
from dataclasses import dataclass

@dataclass
class Employee:
    name: str
    dept: str
    salary: float

employees = [
    Employee('Alice', 'dev', 80000),
    Employee('Bob',   'qa',  65000),
    Employee('Carol', 'dev', 90000),
]

# salary 내림차순
sorted(employees, key=attrgetter('salary'), reverse=True)
# [Carol(90000), Alice(80000), Bob(65000)]

# 다중 속성 (dept, salary)
sorted(employees, key=attrgetter('dept', 'salary'))
```

중첩 속성 접근:

```python
@dataclass
class Address:
    city: str

@dataclass
class Person:
    name: str
    address: Address

people = [Person('A', Address('Seoul')), Person('B', Address('Busan'))]
sorted(people, key=attrgetter('address.city'))
```

![itemgetter/attrgetter/methodcaller 코드](/assets/posts/python-operator-module-code.svg)

## methodcaller — 메서드 호출

`methodcaller('method', *args, **kwargs)`는 `obj.method(*args, **kwargs)`를 호출하는 callable입니다.

```python
from operator import methodcaller

# 인자 없는 메서드
upper = methodcaller('upper')
list(map(upper, ['hello', 'world']))  # ['HELLO', 'WORLD']

# 인자 있는 메서드
strip_space = methodcaller('strip', ' -')
list(map(strip_space, [' -hello- ', ' -world- ']))
# ['hello', 'world']

# replace 메서드
replace = methodcaller('replace', 'foo', 'bar')
replace('foobar')   # 'barbar'
```

## reduce와 조합

```python
from functools import reduce
import operator

numbers = [1, 2, 3, 4, 5]

# 합산
reduce(operator.add, numbers)           # 15
# 곱산
reduce(operator.mul, numbers)           # 120
# 문자열 연결
reduce(operator.add, ['a', 'b', 'c'])  # 'abc'
```

## 논리·비트 연산

```python
import operator

# 비트 연산
operator.and_(0b1010, 0b1100)   # 0b1000 = 8
operator.or_(0b1010, 0b1100)    # 0b1110 = 14
operator.xor(0b1010, 0b1100)    # 0b0110 = 6
operator.lshift(1, 4)           # 16 (1 << 4)
operator.rshift(64, 2)          # 16 (64 >> 2)
operator.invert(0b1010)         # ~10 = -11

# not_: bool not (not 키워드의 함수 버전)
operator.not_(0)                # True
operator.not_(1)                # False
```

## 인플레이스(in-place) 연산자

`iadd`, `isub` 등은 `+=`, `-=` 등 인플레이스 연산의 함수 버전입니다.

```python
import operator

lst = [1, 2, 3]
operator.iadd(lst, [4, 5])  # lst += [4, 5]
print(lst)                  # [1, 2, 3, 4, 5]
```

## contains와 index 연산

```python
import operator

operator.contains([1, 2, 3], 2)    # True  (2 in [1,2,3])
operator.indexOf([1, 2, 3], 2)     # 1
operator.countOf([1, 2, 1, 3], 1)  # 2
```

---

**지난 글:** [functools.partial: 인자를 고정한 함수 만들기](/posts/python-functools-partial/)

**다음 글:** [json 모듈: JSON 직렬화와 역직렬화](/posts/python-json-module/)

<br>
읽어주셔서 감사합니다. 😊
