---
title: "클로저: 함수가 환경을 기억하는 방법"
description: "Python 클로저의 정의, 자유 변수가 캡처되는 원리, LEGB 스코프 규칙, nonlocal 키워드로 외부 변수를 수정하는 방법, 팩토리 패턴 활용을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 9
type: "knowledge"
category: "Python"
tags: ["Python", "함수", "클로저", "자유 변수", "nonlocal", "LEGB", "스코프"]
featured: false
draft: false
---

[지난 글](/posts/python-lambda/)에서 람다 함수를 다뤘다. 이번에는 함수가 **자신이 정의된 환경을 기억**하는 클로저를 살펴본다.

## 클로저란

클로저는 **외부 함수의 변수를 기억하는 내부 함수**다. 외부 함수가 종료된 후에도 내부 함수는 그 변수를 사용할 수 있다.

```python
def make_adder(n):
    def add(x):
        return x + n    # n은 make_adder의 변수
    return add

add5 = make_adder(5)
print(add5(3))    # 8
print(add5(10))   # 15
```

`make_adder(5)` 호출이 끝나도 `n=5`는 메모리에 살아있고, `add5`를 호출할 때마다 사용된다.

## 자유 변수(Free Variable)

`add` 함수 안의 `n`은 `add`의 지역 변수도 아니고 전역 변수도 아니다. **자유 변수**라고 한다. 클로저 객체의 `__closure__`에 저장된다.

```python
print(add5.__closure__)
# (<cell at 0x...>,)
print(add5.__closure__[0].cell_contents)
# 5
```

![클로저 — 자유 변수와 스코프](/assets/posts/python-closure-scope.svg)

## LEGB 스코프 규칙

Python에서 변수를 찾는 순서는 **LEGB**다.

1. **L**ocal — 현재 함수 내부
2. **E**nclosing — 둘러싼 함수들의 스코프 (클로저가 여기서 찾음)
3. **G**lobal — 모듈 수준
4. **B**uilt-in — Python 내장

클로저는 `E` (Enclosing) 단계에서 변수를 찾는다.

## nonlocal — 외부 변수 수정

클로저 내에서 외부 변수를 **읽기**만 할 때는 문제가 없다. 하지만 **수정(할당)**하려면 `nonlocal` 선언이 필요하다.

```python
def make_counter(start=0):
    count = start
    def inc():
        nonlocal count
        count += 1
        return count
    return inc

c = make_counter()
print(c())   # 1
print(c())   # 2
print(c())   # 3
```

`nonlocal` 없이 `count += 1`을 쓰면 `UnboundLocalError`가 발생한다. Python이 `count`를 지역 변수로 간주하기 때문이다.

![nonlocal — 외부 변수 수정](/assets/posts/python-closure-nonlocal.svg)

## 팩토리 패턴

클로저의 대표 활용 사례는 **팩토리 함수**다. 설정값을 기억하는 함수를 만든다.

```python
def make_multiplier(factor):
    return lambda x: x * factor

double = make_multiplier(2)
triple = make_multiplier(3)

print(double(5))   # 10
print(triple(5))   # 15
```

## 루프에서 클로저 함정

루프 변수를 클로저에서 캡처할 때 흔히 겪는 함정이 있다.

```python
funcs = [lambda: i for i in range(3)]
print([f() for f in funcs])   # [2, 2, 2] — 예상은 [0, 1, 2]
```

루프가 끝난 후 `i`가 `2`이고, 세 람다 모두 같은 `i`를 참조하기 때문이다. 해결책은 기본 인수로 값을 고정하는 것이다.

```python
funcs = [lambda i=i: i for i in range(3)]
print([f() for f in funcs])   # [0, 1, 2]
```

## 정리

클로저는 함수형 프로그래밍의 핵심 개념이다. 데코레이터, 팩토리 함수, 콜백 등 여러 패턴의 기반이 된다.

---

**지난 글:** [람다 함수: 익명 함수의 용법과 한계](/posts/python-lambda/)

**다음 글:** [재귀 깊이 제한: sys.setrecursionlimit과 스택 오버플로](/posts/python-recursion-limit/)

<br>
읽어주셔서 감사합니다. 😊
