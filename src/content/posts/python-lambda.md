---
title: "람다 함수: 익명 함수의 용법과 한계"
description: "Python lambda 키워드로 만드는 익명 함수의 문법, def와의 차이, sorted/map/filter에서의 활용, 그리고 람다를 피해야 할 상황을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 8
type: "knowledge"
category: "Python"
tags: ["Python", "함수", "lambda", "익명 함수", "map", "filter", "sorted"]
featured: false
draft: false
---

[지난 글](/posts/python-return-multiple/)에서 여러 값을 반환하는 패턴을 다뤘다. 이번에는 이름 없이 만드는 **람다 함수**를 살펴본다.

## 람다란

`lambda` 키워드로 만드는 **이름 없는 함수(익명 함수)**다. 단일 표현식만 가질 수 있고, 그 표현식이 자동으로 반환된다.

```python
lambda 매개변수: 표현식
```

간단한 예:

```python
square = lambda x: x ** 2
print(square(5))   # 25

add = lambda x, y: x + y
print(add(3, 4))   # 7
```

## def와 비교

![lambda vs def 비교](/assets/posts/python-lambda-comparison.svg)

`lambda`는 단일 표현식만 허용한다. `def`와 달리 여러 줄, 독스트링, `if` 블록은 사용할 수 없다. 조건 표현식은 가능하다.

```python
classify = lambda x: "양수" if x > 0 else ("음수" if x < 0 else "영")
print(classify(3))    # 양수
print(classify(-1))   # 음수
```

## 주요 사용 패턴

### sorted 정렬 기준 지정

```python
words = ["banana", "apple", "fig", "cherry"]
sorted(words, key=lambda w: len(w))
# ['fig', 'apple', 'banana', 'cherry']

# 딕셔너리 리스트 정렬
people = [{"name": "영희", "age": 30}, {"name": "철수", "age": 25}]
sorted(people, key=lambda p: p["age"])
# 나이 기준 오름차순
```

### map과 filter

```python
nums = [1, 2, 3, 4, 5]

squares = list(map(lambda x: x**2, nums))
# [1, 4, 9, 16, 25]

evens = list(filter(lambda x: x % 2 == 0, nums))
# [2, 4]
```

하지만 이 두 경우는 **리스트 컴프리헨션**이 더 가독성 있다.

```python
squares = [x**2 for x in nums]
evens = [x for x in nums if x % 2 == 0]
```

![람다의 전형적인 사용 패턴](/assets/posts/python-lambda-usage.svg)

## 람다를 피해야 할 때

PEP 8은 람다를 변수에 할당하는 것을 권장하지 않는다. 그 경우에는 `def`가 낫다.

```python
# PEP 8 비권장
double = lambda x: x * 2

# PEP 8 권장
def double(x):
    return x * 2
```

이유:
- `def`로 만든 함수는 `__name__`이 올바른 이름을 가진다 (디버깅에 유리)
- 독스트링을 추가할 수 있다
- 가독성이 높다

람다의 적절한 사용처는 **이름이 필요 없는 짧은 콜백**이다. `sorted`, `max`, `min`의 `key` 인수가 대표적이다.

## 람다의 내부 이름

람다도 일급 객체다. 타입도 `function`이다.

```python
f = lambda x: x * 2
print(type(f))      # <class 'function'>
print(f.__name__)   # <lambda>  — def와 달리 이름 없음
```

## 정리

| 항목 | lambda | def |
|------|--------|-----|
| 문법 | 단일 표현식 | 여러 줄 |
| 이름 | 없음(`<lambda>`) | 있음 |
| 독스트링 | 불가 | 가능 |
| 주 용도 | 단순 콜백 | 모든 함수 |

---

**지난 글:** [여러 값 반환하기: 튜플 언패킹과 Python다운 반환](/posts/python-return-multiple/)

**다음 글:** [클로저: 함수가 환경을 기억하는 방법](/posts/python-closure/)

<br>
읽어주셔서 감사합니다. 😊
