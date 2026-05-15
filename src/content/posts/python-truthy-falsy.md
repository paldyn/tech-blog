---
title: "참·거짓값(Truthy/Falsy): Python 조건식 완전 이해"
description: "Python에서 조건식으로 평가되는 모든 객체의 참·거짓 규칙, bool() 변환, 단락 평가, __bool__/__len__ 커스텀, all/any를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 8
type: "knowledge"
category: "Python"
tags: ["Python", "Truthy", "Falsy", "bool", "조건식", "초급"]
featured: false
draft: false
---

[지난 글](/posts/python-type-conversion/)에서 타입 변환을 살펴봤다. 이번에는 조건식에서 모든 객체가 어떻게 참·거짓으로 평가되는지 이해한다. Python에서는 `True`/`False`뿐 아니라 모든 객체가 조건식에 쓰일 수 있다.

## Falsy 값의 목록

Python에서 `if x:` 조건이 `False`로 평가되는 값은 다음과 같다.

```python
# 모두 bool()로 변환하면 False
bool(None)     # False
bool(False)    # False
bool(0)        # False  (int)
bool(0.0)      # False  (float)
bool(0j)       # False  (complex)
bool("")       # False  (빈 str)
bool(b"")      # False  (빈 bytes)
bool([])       # False  (빈 list)
bool(())       # False  (빈 tuple)
bool({})       # False  (빈 dict)
bool(set())    # False  (빈 set)
bool(range(0)) # False  (빈 range)
```

이 외의 모든 값은 Truthy다.

## Truthy 값

```python
bool(1)           # True
bool(-1)          # True  (0이 아닌 정수)
bool(3.14)        # True
bool("0")         # True  (빈 문자열이 아님!)
bool(" ")         # True  (공백도 True)
bool([0])         # True  (원소가 있으면 True)
bool({0: False})  # True
```

`"0"`이나 `" "` 같은 문자열은 Truthy임에 주의하자. 숫자 0인지 검사하려면 `x == 0`을 써야 한다.

![Truthy/Falsy 전체 목록](/assets/posts/python-truthy-falsy-overview.svg)

## 단락 평가 (Short-Circuit Evaluation)

`and`/`or`는 bool을 반환하지 않고 **피연산자를 반환**한다.

```python
# and: 첫 번째 Falsy 값 또는 마지막 값 반환
0 and "hello"    # 0     (0이 Falsy이므로 즉시 반환)
1 and "hello"    # "hello"
None and foo()   # None  (foo() 호출 안 됨)

# or: 첫 번째 Truthy 값 또는 마지막 값 반환
0 or "hello"     # "hello"
"hi" or "world"  # "hi"
None or 0 or []  # []    (모두 Falsy → 마지막 값)
```

## 관용구

```python
# 기본값 지정 (or 패턴)
name = user_input or "guest"
config = load_config() or default_config

# None 가드 (and 패턴)
result = obj and obj.method()

# 빈 컬렉션 검사
if items:          # len(items) > 0 과 동일하지만 더 간결
    process(items)

if not items:
    return []
```

## all과 any

```python
# all: 모든 원소가 Truthy이면 True
all([1, "hi", True])     # True
all([1, 0, "hi"])        # False  (0이 Falsy)
all([])                  # True   (빈 이터러블은 True)

# any: 하나라도 Truthy이면 True
any([0, None, "hi"])     # True
any([0, None, False])    # False
any([])                  # False  (빈 이터러블은 False)

# 실용 예
numbers = [2, 4, 6, 8]
all(n % 2 == 0 for n in numbers)   # True — 모두 짝수?
any(n > 5 for n in numbers)        # True — 5보다 큰 수 있음?
```

![Truthy/Falsy 활용 패턴](/assets/posts/python-truthy-falsy-patterns.svg)

## __bool__과 __len__ 커스텀

클래스에서 조건식 동작을 제어할 수 있다.

```python
class Bag:
    def __init__(self, items):
        self.items = items

    def __bool__(self):
        return bool(self.items)   # 비어 있으면 Falsy

bag = Bag([1, 2])
if bag:    # True (원소 있음)
    print("bag has items")
```

`__bool__`이 없으면 `__len__`을 호출해 0이면 Falsy, 양수면 Truthy로 처리한다. 둘 다 없으면 항상 Truthy다.

## 주의: "0"은 Truthy

```python
x = "0"          # 사용자 입력
if x:            # True! "0"은 빈 문자열이 아님
    print("입력 있음")  # 실행됨

# 의도가 숫자 0 검사라면 명시적으로
if int(x) == 0:
    print("숫자 0")
```

---

**지난 글:** [타입 변환: int, str, float, list 상호 변환](/posts/python-type-conversion/)

**다음 글:** [동등성 vs 동일성: == 와 is 의 차이](/posts/python-equality-vs-identity/)

<br>
읽어주셔서 감사합니다. 😊
