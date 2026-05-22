---
title: "Python 예외 계층 구조 완전 탐구"
description: "Python 내장 예외 클래스의 전체 계층 구조를 살펴봅니다. BaseException에서 시작해 Exception, ArithmeticError, LookupError 등 주요 그룹과 자주 만나는 내장 예외를 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 4
type: "knowledge"
category: "Python"
tags: ["Python", "예외계층", "내장예외", "BaseException", "Exception", "LookupError"]
featured: false
draft: false
---

[지난 글](/posts/python-raise-from/)에서 `raise`와 `raise from`으로 예외를 발생·연결하는 방법을 배웠다. 예외를 제대로 잡고 처리하려면 Python 내장 예외 계층 구조를 알아야 한다. 어떤 예외가 어떤 부모 클래스를 갖는지 알면, 더 넓은 범위를 한 번에 처리하거나, 반대로 원하는 예외만 정확히 골라낼 수 있다.

## 계층 구조 개요

Python 내장 예외는 모두 `BaseException`을 최상위로 하는 클래스 트리에 있다. `help('exceptions')`나 공식 문서에서 전체 트리를 볼 수 있지만, 실무에서 자주 만나는 부분만 추려보면 다음과 같다.

```python
BaseException
 ├── SystemExit
 ├── KeyboardInterrupt
 ├── GeneratorExit
 └── Exception
      ├── ArithmeticError
      │    ├── ZeroDivisionError
      │    └── OverflowError
      ├── LookupError
      │    ├── KeyError
      │    └── IndexError
      ├── ValueError
      ├── TypeError
      ├── AttributeError
      ├── NameError
      ├── OSError (= IOError)
      │    ├── FileNotFoundError
      │    ├── PermissionError
      │    └── TimeoutError
      ├── RuntimeError
      │    └── RecursionError
      ├── StopIteration
      ├── NotImplementedError
      └── Warning
           ├── DeprecationWarning
           └── ...
```

![Python 예외 계층 구조](/assets/posts/python-exception-hierarchy-tree.svg)

## Exception의 주요 서브그룹

### ArithmeticError

수학 연산 오류를 나타내는 그룹이다.

```python
try:
    result = 1 / 0
except ZeroDivisionError:
    print("0으로 나누기")

try:
    import math
    result = math.exp(10000)   # OverflowError
except OverflowError:
    print("숫자가 너무 큼")

# ArithmeticError로 두 가지를 한 번에
try:
    compute()
except ArithmeticError as e:
    print(f"산술 오류: {type(e).__name__}: {e}")
```

### LookupError

컬렉션 접근 실패를 나타내는 그룹이다. `KeyError`(딕셔너리)와 `IndexError`(리스트·튜플)를 모두 포함한다.

```python
data = {"name": "Alice"}
items = [1, 2, 3]

try:
    v1 = data["age"]    # KeyError
    v2 = items[10]      # IndexError
except LookupError as e:
    print(f"데이터 접근 실패: {type(e).__name__}: {e}")
```

`KeyError`와 `IndexError`를 항상 같이 처리한다면 `LookupError`를 부모로 잡는 것이 더 깔끔하다.

### OSError 그룹

운영 체제 관련 오류 전체를 `OSError`가 포함한다. 과거에는 `IOError`, `EnvironmentError` 등으로 분리되어 있었는데 Python 3에서 모두 `OSError`의 별칭으로 통합되었다.

```python
try:
    with open("data.txt") as f:
        data = f.read()
except FileNotFoundError:
    print("파일 없음")
except PermissionError:
    print("권한 없음")
except OSError as e:
    # 그 밖의 파일 시스템 오류
    print(f"파일 오류: {e.strerror} (errno={e.errno})")
```

`OSError`는 `errno` 속성을 가지므로 구체적인 오류 코드도 확인할 수 있다.

```python
import errno

try:
    open("/root/secret")
except OSError as e:
    if e.errno == errno.EACCES:
        print("접근 거부")
    elif e.errno == errno.ENOENT:
        print("파일 없음")
```

## 자주 만나는 내장 예외 정리

![자주 쓰는 내장 예외](/assets/posts/python-exception-hierarchy-common.svg)

### ValueError vs TypeError

이 두 가지는 가장 많이 혼동된다.

```python
# TypeError: 타입 자체가 잘못됨
"hello" + 42        # str과 int는 더할 수 없다

# ValueError: 타입은 맞지만 값이 잘못됨
int("abc")          # str이지만 정수로 변환 불가
int("3.14")         # 역시 ValueError (float 문자열)
int("3")            # OK → 3
```

사용자 정의 함수에서도 이 구분을 따르는 것이 좋다.

```python
def set_age(age):
    if not isinstance(age, int):
        raise TypeError(f"age는 정수여야 합니다. 받은 타입: {type(age).__name__}")
    if age < 0 or age > 150:
        raise ValueError(f"age 범위 초과: {age}")
```

### AttributeError vs NameError

```python
# NameError: 정의되지 않은 변수/이름
print(undefined_var)    # NameError

# AttributeError: 객체에 없는 속성/메서드
None.upper()            # AttributeError
[1, 2].push(3)          # AttributeError (Python 리스트는 append)
```

`None`을 반환하는 함수의 결과를 바로 체인 호출하면 `AttributeError`가 자주 발생한다.

```python
result = find_user(user_id)
result.activate()    # find_user가 None 반환 시 AttributeError
```

`Optional` 타입을 반환하는 함수를 쓸 때는 None 체크가 필수다.

### RuntimeError와 RecursionError

`RuntimeError`는 다른 카테고리에 속하지 않는 런타임 오류에 쓰는 일반 예외다. `RecursionError`는 `RuntimeError`의 서브클래스로, 재귀 한도(기본 1000)를 초과하면 발생한다.

```python
import sys
sys.setrecursionlimit(100)   # 재귀 한도 변경

def infinite_recursion():
    return infinite_recursion()

try:
    infinite_recursion()
except RecursionError:
    print("재귀 깊이 초과")
```

### StopIteration

이터레이터의 끝을 알리는 예외로, `for` 루프가 내부적으로 이것을 사용해 반복을 종료한다.

```python
it = iter([1, 2])
print(next(it))    # 1
print(next(it))    # 2
next(it)           # StopIteration 발생
```

직접 `next()`를 호출할 때는 `StopIteration`을 대비하거나 기본값을 지정한다.

```python
it = iter([1, 2])
val = next(it, None)   # 기본값 방식: 끝이면 None 반환
```

## isinstance를 활용한 계층 이용

```python
def classify_error(e):
    if isinstance(e, LookupError):
        return "컬렉션 접근 오류"
    elif isinstance(e, ArithmeticError):
        return "수학 연산 오류"
    elif isinstance(e, OSError):
        return f"OS 오류 (errno={getattr(e, 'errno', None)})"
    elif isinstance(e, ValueError):
        return "값 오류"
    elif isinstance(e, TypeError):
        return "타입 오류"
    else:
        return f"기타: {type(e).__name__}"

try:
    risky_operation()
except Exception as e:
    category = classify_error(e)
    print(f"[{category}] {e}")
```

## 예외 계층을 이용한 광범위 처리 전략

라이브러리 개발 시 흔히 쓰는 두 가지 전략이다.

```python
# 전략 1: 특정 그룹 전체를 잡기
try:
    result = parse_and_compute(data)
except (ValueError, TypeError) as e:
    # 잘못된 입력 처리
    return {"error": str(e)}
except OSError as e:
    # 파일/네트워크 오류 처리
    return {"error": "외부 리소스 오류"}

# 전략 2: 계층 부모로 잡기 + 세분화
try:
    result = db_query(sql)
except LookupError as e:
    if isinstance(e, KeyError):
        return default_row
    raise
```

예외 계층을 알면 `except Exception:`처럼 너무 넓게 잡거나, 반대로 `except ZeroDivisionError, except OverflowError, except...`처럼 불필요하게 세분화하는 것을 피할 수 있다. 다음 글에서는 이 계층을 확장하는 커스텀 예외 클래스를 설계하는 방법을 배운다.

---

**지난 글:** [raise와 raise from: 예외 재발생과 원인 연결](/posts/python-raise-from/)

**다음 글:** [커스텀 예외 클래스 설계하기](/posts/python-custom-exception/)

<br>
읽어주셔서 감사합니다. 😊
