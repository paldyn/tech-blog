---
title: "제네릭: TypeVar와 Generic으로 타입을 재사용하기"
description: "TypeVar로 타입 변수를 선언하고, 제네릭 함수와 제네릭 클래스를 만드는 법, 그리고 PEP 695의 새 문법까지 파이썬 제네릭을 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["제네릭", "TypeVar", "Generic", "타입힌트", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-typing-overview/)에서 타입 힌트의 기본을 익혔다. 그런데 `list`에서 첫 원소를 꺼내는 함수에 타입을 달려고 하면 곤란해진다. 정수 리스트에는 정수를, 문자열 리스트에는 문자열을 반환해야 하는데, 단순히 `-> object`라고 쓰면 호출한 쪽에서 구체적인 타입을 잃어버린다. 제네릭(generics)은 바로 이 "타입을 그대로 흘려보내는" 문제를 우아하게 푸는 도구다.

## 문제: 타입을 잃어버리는 함수

먼저 제네릭이 없을 때 무슨 일이 벌어지는지 보자.

```python
def first(items: list) -> object:
    return items[0]

n = first([1, 2, 3])
# 검사기 입장에서 n은 object — int인지 모른다
n.bit_length()  # 오류: object에는 그런 메서드가 없다
```

`n`이 실제로는 정수인데 검사기는 `object`로만 보기 때문에 정수 메서드를 쓸 수 없다고 경고한다. 입력 타입과 출력 타입의 **연결 고리**가 끊긴 것이다.

## TypeVar: 타입을 담는 변수

이 연결 고리를 만드는 것이 `TypeVar`다. 타입 변수 `T`를 선언하고, 입력과 출력에 같은 `T`를 쓰면 "입력 리스트의 원소 타입이 곧 반환 타입"이라고 선언하는 셈이 된다.

```python
from typing import TypeVar

T = TypeVar("T")

def first(items: list[T]) -> T:
    return items[0]

n = first([1, 2, 3])    # n: int 으로 추론
s = first(["a", "b"])   # s: str 으로 추론
```

![TypeVar로 타입을 그대로 전달하기](/assets/posts/python-typing-generics-typevar.svg)

`T`는 호출할 때마다 다른 타입으로 바인딩된다. 정수 리스트를 넘기면 `T`는 `int`가 되고, 반환 타입도 `int`로 추론된다. 함수 하나로 모든 타입을 안전하게 처리한다.

## 제네릭 클래스

클래스도 타입 파라미터를 받을 수 있다. `Generic[T]`를 상속하면 그 클래스는 제네릭이 된다. 컨테이너나 래퍼를 만들 때 특히 유용하다.

```python
from typing import Generic, TypeVar

T = TypeVar("T")

class Box(Generic[T]):
    def __init__(self, value: T) -> None:
        self.value = value

    def get(self) -> T:
        return self.value

b: Box[str] = Box("hi")
x = b.get()   # x: str
```

`Box[str]`로 명시하면 `b.value`와 `b.get()`이 모두 `str`로 추론된다. `Box[int]`로 만들면 같은 클래스가 정수 상자로 동작한다.

## 제약과 바운드

`TypeVar`에는 두 가지 제한 방법이 있다. 특정 타입들로만 한정하는 **제약(constraint)** 과, 어떤 타입의 하위 타입으로 한정하는 **바운드(bound)** 다.

```python
from typing import TypeVar

# 제약: int 또는 float 만 허용
Num = TypeVar("Num", int, float)

def double(x: Num) -> Num:
    return x * 2

# 바운드: Comparable의 하위 타입만 허용
from typing import Protocol
class Comparable(Protocol):
    def __lt__(self, other: object) -> bool: ...

C = TypeVar("C", bound=Comparable)

def smallest(items: list[C]) -> C:
    return min(items)
```

제약은 "이 중 하나"를, 바운드는 "이것의 자식"을 의미한다. `smallest`는 비교 가능한 어떤 타입이든 받되, 비교가 불가능한 타입은 거부한다.

## PEP 695의 새 문법

파이썬 3.12부터는 `TypeVar`를 따로 선언하지 않고 대괄호로 타입 파라미터를 직접 적을 수 있다. 훨씬 간결하다.

```python
def first[T](items: list[T]) -> T:
    return items[0]

class Box[T]:
    def __init__(self, value: T) -> None:
        self.value = value

n = first([1, 2, 3])        # n: int 으로 추론
b: Box[str] = Box("hi")     # b.value: str
```

![제네릭 함수와 제네릭 클래스 (PEP 695)](/assets/posts/python-typing-generics-code.svg)

`def first[T]`와 `class Box[T]` 문법은 import도 필요 없고 스코프도 명확하다. 3.12 이상을 쓴다면 이 방식을 권장한다. 다만 구버전 호환이 필요하면 `TypeVar`를 계속 쓰면 된다. 다음 글에서는 "여러 타입 중 하나"를 표현하는 Union을 살펴본다.

---

**지난 글:** [타입 힌트 입문: 파이썬에 타입을 더하는 법](/posts/python-typing-overview/)

**다음 글:** [Union과 Optional: 여러 타입을 허용하기](/posts/python-typing-union-optional/)

<br>
읽어주셔서 감사합니다. 😊
