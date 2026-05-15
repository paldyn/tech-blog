---
title: "Python 함수 정의: def 키워드로 코드를 묶다"
description: "def 키워드 문법, 매개변수, 반환값, 독스트링까지 — Python 함수 정의의 모든 것을 예제 중심으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 1
type: "knowledge"
category: "Python"
tags: ["Python", "함수", "def", "매개변수", "반환값", "독스트링"]
featured: false
draft: false
---

[지난 글](/posts/python-loop-pitfalls/)에서 루프의 함정을 다뤘다. 이제 코드를 재사용 가능한 단위로 묶는 핵심 도구인 **함수**를 살펴본다. 함수를 잘 쓰는 것만으로도 코드의 가독성과 유지보수성이 극적으로 향상된다.

## 함수란 무엇인가

함수는 **이름을 붙인 코드 블록**이다. 한 번 정의해 두면 어디서든 이름으로 호출할 수 있고, 입력값을 받아 처리한 결과를 돌려준다. Python에서 함수는 `def` 키워드로 정의한다.

```python
# 가장 단순한 함수
def say_hello():
    print("Hello, World!")

say_hello()   # Hello, World!
```

## def 문법 전체 구조

![Python 함수 해부도](/assets/posts/python-function-def-anatomy.svg)

`def` 다음에 **함수 이름**, 괄호 안에 **매개변수 목록**, 콜론(`:`)으로 헤더를 마친다. 이후 들여쓰기된 블록이 함수 본문이다.

```python
def 함수이름(매개변수1, 매개변수2):
    """독스트링 (선택사항)"""
    # 본문
    return 결과값
```

이름은 `snake_case`를 사용하는 것이 파이썬 스타일이다.

## 매개변수와 인수

**매개변수(parameter)**는 함수 정의에 나타나는 변수명, **인수(argument)**는 호출 시 전달하는 실제 값이다.

```python
def add(a, b):        # a, b → 매개변수
    return a + b

result = add(3, 4)    # 3, 4 → 인수
print(result)         # 7
```

## 기본값 인수

매개변수에 `=`로 기본값을 지정하면 호출 시 생략할 수 있다.

```python
def power(base, exp=2):
    return base ** exp

print(power(3))     # 9  (exp=2 기본값 사용)
print(power(2, 10)) # 1024
```

기본값이 있는 매개변수는 반드시 기본값이 없는 매개변수 뒤에 와야 한다.

```python
# 오류!
def wrong(a=1, b):  # SyntaxError
    pass

# 올바름
def correct(a, b=1):
    pass
```

## 반환값 — return

`return` 키워드 뒤의 표현식이 호출자에게 전달된다. `return`이 없거나 값 없이 `return`만 쓰면 `None`을 반환한다.

```python
def greet(name, greeting="Hello"):
    """이름에게 인사 메시지를 반환한다."""
    message = greeting + ", " + name + "!"
    return message

msg = greet("철수")
print(msg)           # Hello, 철수!
print(greet("영희", "안녕"))  # 안녕, 영희!
```

![함수 정의와 호출 패턴](/assets/posts/python-function-def-examples.svg)

## 독스트링(Docstring)

함수 첫 줄에 삼중 따옴표(`"""..."""`)로 작성하는 문서 문자열이다. `help()` 함수나 IDE에서 활용된다.

```python
def circle_area(radius):
    """
    원의 넓이를 반환한다.

    Args:
        radius (float): 반지름 (양수)
    Returns:
        float: 넓이 (π × r²)
    """
    import math
    return math.pi * radius ** 2

help(circle_area)   # 독스트링 출력
```

## 반환값이 없는 함수

부수 효과(출력, 파일 쓰기 등)만 수행하는 함수는 `return`을 생략한다. 이 경우 반환값은 `None`이다.

```python
def log(message):
    print(f"[LOG] {message}")

result = log("시작")
print(result)    # None
```

## 함수는 객체다

Python에서 함수는 **일급 객체(first-class object)**다. 변수에 할당하거나 다른 함수에 인수로 전달할 수 있다.

```python
def double(x):
    return x * 2

fn = double       # 함수 객체를 변수에 할당
print(fn(5))      # 10

nums = [1, 2, 3]
print(list(map(double, nums)))   # [2, 4, 6]
```

## 정리

| 구성 요소 | 설명 |
|-----------|------|
| `def` | 함수 정의 키워드 |
| 함수 이름 | snake_case, 동사 권장 |
| 매개변수 | 입력값 자리, 기본값 지정 가능 |
| 독스트링 | 선택사항, 문서화 목적 |
| `return` | 반환값 지정, 없으면 None |

---

**다음 글:** [위치 인수와 키워드 인수: Python 인수 전달 방식의 기본](/posts/python-positional-keyword-args/)

<br>
읽어주셔서 감사합니다. 😊
