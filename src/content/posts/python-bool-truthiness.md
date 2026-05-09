---
title: "bool과 Truthiness: 참과 거짓을 판별하는 방법"
description: "Python의 bool 타입과 Truthiness(진릿값) 규칙을 설명합니다. Falsy 값 목록, 논리 연산자, 단락 평가, 실전 패턴까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 7
type: "knowledge"
category: "Python"
tags: ["Python", "bool", "Truthiness", "Falsy", "논리연산자", "초급"]
featured: false
draft: false
---

[지난 글](/posts/python-numbers-int-float-complex/)에서 숫자 타입을 살펴봤다. 이번에는 Python의 `bool` 타입과 **진릿값(Truthiness)** — "어떤 값이 참으로 평가되고 어떤 값이 거짓으로 평가되는가" — 를 정리한다.

## bool 타입

`bool`은 `True`와 `False` 두 가지 값만 갖는 타입이다. Python에서 `bool`은 `int`의 서브클래스다.

```python
print(type(True))    # <class 'bool'>
print(True + True)   # 2
print(True == 1)     # True
print(False == 0)    # True
```

`bool` 리터럴은 반드시 **대문자로 시작**해야 한다.

```python
True    # OK
False   # OK
true    # NameError
false   # NameError
```

## Falsy 값 — 거짓으로 평가되는 값

Python에서 다음 값들은 `if` 조건식에서 `False`로 평가된다.

```python
# 완전한 Falsy 값 목록
False
None
0       # int 0
0.0     # float 0
0j      # complex 0
""      # 빈 문자열
[]      # 빈 리스트
()      # 빈 튜플
{}      # 빈 딕셔너리
set()   # 빈 집합
```

이 외의 모든 값은 **Truthy** — 참으로 평가된다.

```python
bool([])      # False
bool([0])     # True  — [0]은 비어 있지 않음
bool("")      # False
bool(" ")     # True  — 공백 문자열도 truthy
bool(None)    # False
bool(0)       # False
bool(-1)      # True  — 0이 아닌 숫자는 truthy
```

![Falsy 값 vs Truthy 값](/assets/posts/python-bool-truthiness-values.svg)

## Truthiness를 활용한 관용구

Python에서는 `len(x) > 0` 대신 `x`를 직접 조건에 쓰는 것이 관용적이다.

```python
items = []

# 비권장
if len(items) > 0:
    process(items)

# 권장 (Pythonic)
if items:
    process(items)
```

문자열이 비어 있는지 확인할 때도 같은 방식을 쓴다.

```python
name = ""

if not name:
    print("이름을 입력해 주세요.")
```

단, `None`과 빈 컬렉션을 구별해야 할 때는 `is None`을 명시적으로 사용한다.

```python
result = some_function()

if result is None:
    print("결과 없음")
elif not result:
    print("결과 있으나 빈 컨테이너")
```

## 논리 연산자

Python의 논리 연산자는 `and`, `or`, `not`이다. `&&`, `||`, `!`를 사용하지 않는다.

| 연산자 | 의미 |
|--------|------|
| `x and y` | x가 falsy면 x, 아니면 y |
| `x or y` | x가 truthy면 x, 아니면 y |
| `not x` | x가 truthy면 False, 아니면 True |

`and`와 `or`는 **마지막으로 평가된 피연산자의 값을 반환**한다. 단순한 `True/False`가 아니다.

```python
1 and 2    # 2    (1이 truthy → 2까지 평가)
0 and 2    # 0    (0이 falsy → 단락, 2는 평가 안 함)
0 or 2     # 2    (0이 falsy → 2까지 평가)
1 or 2     # 1    (1이 truthy → 단락)
not 0      # True
not []     # True
```

## 단락 평가(Short-circuit Evaluation)

`and`는 왼쪽이 falsy면 오른쪽을 평가하지 않는다. `or`는 왼쪽이 truthy면 오른쪽을 평가하지 않는다.

```python
def side_effect():
    print("호출됨")
    return True

False and side_effect()   # "호출됨" 출력 안 됨
True or side_effect()     # "호출됨" 출력 안 됨
```

이를 활용한 **기본값 패턴**이 Python 코드에서 자주 보인다.

```python
user_name = input_value or "Guest"    # input_value가 falsy면 "Guest"
```

단, `None`과 `0`, `""` 를 구별해야 할 때는 이 패턴이 의도치 않게 동작할 수 있다. `0`이나 빈 문자열도 falsy이기 때문이다.

```python
count = user_count or 10   # user_count가 0이면 10으로 대체 — 의도와 다를 수 있음
count = 10 if user_count is None else user_count   # 명확한 None 체크
```

![논리 연산자와 단락 평가](/assets/posts/python-bool-truthiness-operators.svg)

## 커스텀 객체의 Truthiness

클래스에서 `__bool__()` 또는 `__len__()`을 정의하면 그 인스턴스의 진릿값을 제어할 수 있다.

```python
class MyQueue:
    def __init__(self):
        self._items = []

    def __len__(self):
        return len(self._items)

q = MyQueue()
if not q:
    print("큐가 비어 있습니다.")   # 출력됨
```

`__bool__()`이 없으면 `__len__()`을 사용하고, 둘 다 없으면 항상 `True`다.

## 비교 연산자와 bool

비교 연산자(`==`, `!=`, `<`, `>`, `<=`, `>=`, `is`, `in`)는 `True` 또는 `False`를 반환한다.

```python
3 > 2          # True
"a" in "abc"   # True
5 is 5         # True (소정수 캐시)
[] is []       # False (다른 객체)
```

---

**지난 글:** [숫자 타입: int, float, complex](/posts/python-numbers-int-float-complex/)

**다음 글:** [문자열 기초: 생성, 인덱싱, 슬라이싱](/posts/python-string-essentials/)

<br>
읽어주셔서 감사합니다. 😊
