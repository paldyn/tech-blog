---
title: "Python 예외 처리 기초: try, except, 그리고 예외 객체"
description: "Python 예외 처리의 핵심 개념을 설명합니다. 예외란 무엇인지, BaseException과 Exception의 차이, try/except의 기본 사용법과 예외 객체에서 정보를 얻는 방법을 배웁니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 1
type: "knowledge"
category: "Python"
tags: ["Python", "예외처리", "try", "except", "BaseException", "Exception"]
featured: false
draft: false
---

[지난 글](/posts/python-line-endings/)에서 파일 입출력에서 줄 끝 문자를 다루는 방법을 살펴봤다. 이번에는 파일 작업을 포함한 모든 Python 코드에서 반드시 알아야 할 **예외 처리** 시스템을 심층적으로 다룬다. "오류가 나면 고치면 되지"라는 생각은 위험하다—예외를 제대로 처리하지 않으면 데이터 손실, 서버 다운, 보안 취약점으로 이어진다.

## 예외란 무엇인가

Python에서 예외(Exception)는 프로그램 실행 중 발생한 **비정상적인 상황**을 나타내는 객체다. 파일이 없거나, 타입이 맞지 않거나, 인터넷 연결이 끊어졌을 때—이런 상황에서 Python은 예외 객체를 생성하고 던진다(raise). 아무도 이 예외를 받아서 처리(catch)하지 않으면 프로그램이 종료된다.

```python
# 예외가 발생하는 상황들
int("abc")        # ValueError: invalid literal for int()
[][0]             # IndexError: list index out of range
{}["key"]         # KeyError: 'key'
1 / 0             # ZeroDivisionError: division by zero
open("없는파일")   # FileNotFoundError: No such file or directory
```

이 코드를 실행하면 각 줄에서 Python이 해당 예외를 발생시키고 프로그램을 멈춘다. 예외 처리를 하지 않은 상태에서는 트레이스백(traceback)이 출력되고 실행이 종료된다.

## BaseException vs Exception

![Python 예외 계층 구조](/assets/posts/python-exception-basics-hierarchy.svg)

Python의 모든 예외는 `BaseException`을 루트로 하는 클래스 계층에 속한다. 여기서 중요한 분기가 있다.

**`BaseException`의 직계 자식 중 특별한 것들**:
- `SystemExit`: `sys.exit()` 호출 시 발생. 프로그램 정상 종료를 의미한다.
- `KeyboardInterrupt`: Ctrl+C로 사용자가 중단할 때 발생.
- `GeneratorExit`: 제너레이터가 닫힐 때 발생.

이 세 가지는 일반적인 애플리케이션 오류가 아니다. `except Exception:`으로 잡으면 이것들은 통과시킨다는 것이 설계 의도다. `except:` (bare except)는 이것들까지 잡아버리므로 위험하다.

```python
import sys

# 위험한 코드: Ctrl+C로도 멈출 수 없다
try:
    while True:
        pass
except:          # SystemExit, KeyboardInterrupt까지 잡음!
    pass

# 올바른 코드
try:
    while True:
        pass
except Exception:    # 시스템 예외는 통과시킴
    pass
```

## try / except 기본 사용법

```python
# 기본 구조
try:
    # 예외가 발생할 수 있는 코드
    result = int(input("숫자 입력: "))
    print(f"입력값의 2배: {result * 2}")
except ValueError:
    # ValueError가 발생했을 때만 실행
    print("숫자를 입력해 주세요.")
```

`try` 블록의 코드를 실행하다 `ValueError`가 발생하면 즉시 `except ValueError:` 블록으로 넘어간다. 예외가 없으면 `except` 블록은 완전히 건너뛴다.

### 여러 예외 처리하기

```python
def read_config(path, key):
    try:
        with open(path) as f:
            import json
            data = json.load(f)
        return data[key]
    except FileNotFoundError:
        print(f"설정 파일을 찾을 수 없습니다: {path}")
    except json.JSONDecodeError as e:
        print(f"JSON 형식 오류: {e}")
    except KeyError:
        print(f"키 '{key}'가 설정 파일에 없습니다")
    return None
```

여러 `except` 절을 쓰면 타입마다 다른 처리를 할 수 있다. 위에서 아래로 순서대로 검사하므로 구체적인 예외를 먼저, 일반적인 예외를 나중에 배치해야 한다.

같은 처리가 필요한 여러 예외는 튜플로 묶을 수도 있다.

```python
try:
    value = data[key]
except (KeyError, IndexError) as e:
    print(f"데이터 접근 오류: {e}")
```

## 예외 객체에서 정보 얻기

`as e`로 예외 객체를 받으면 여러 유용한 정보를 얻을 수 있다.

```python
try:
    int("abc")
except ValueError as e:
    print(type(e).__name__)   # ValueError
    print(str(e))             # invalid literal for int() with base 10: 'abc'
    print(e.args)             # ("invalid literal for int() with base 10: 'abc'",)
```

가장 중요한 속성:

| 속성/표현 | 내용 |
|---------|------|
| `type(e).__name__` | 예외 클래스 이름 |
| `str(e)` | 예외 메시지 |
| `e.args` | 생성자에 전달된 인자 튜플 |
| `e.__cause__` | `raise ... from`으로 지정한 원인 예외 |
| `e.__traceback__` | 호출 스택 정보 객체 |

![try / except 기본 흐름](/assets/posts/python-exception-basics-flow.svg)

## 예외를 다시 발생시키기

처리한 뒤 다시 발생시켜야 할 때는 `raise`를 인자 없이 사용한다. 이렇게 하면 원래 예외와 트레이스백이 보존된다.

```python
import logging

def process():
    try:
        risky_operation()
    except Exception as e:
        logging.error("작업 실패: %s", e)
        raise   # 예외를 다시 발생시켜 호출자에게 전파
```

`raise`와 `raise e`는 미묘하게 다르다. `raise`는 트레이스백 시작점을 보존하고, `raise e`는 현재 위치로 재설정한다. 따라서 원본 트레이스백을 살리려면 인자 없는 `raise`를 쓰는 것이 원칙이다.

## isinstance로 예외 타입 확인하기

예외 계층을 활용하면 부모 클래스로 여러 관련 예외를 한 번에 처리할 수 있다.

```python
try:
    data[key]
except LookupError as e:
    # KeyError와 IndexError 모두 LookupError의 서브클래스이므로 한 번에 처리
    print(f"데이터 조회 실패: {type(e).__name__}: {e}")

# isinstance로 세밀한 분기
try:
    result = compute(value)
except ArithmeticError as e:
    if isinstance(e, ZeroDivisionError):
        print("0으로 나누기 오류")
    else:
        print(f"산술 오류: {e}")
```

## 자주 마주치는 예외들

실무에서 가장 자주 처리하게 되는 예외들이다.

```python
# ValueError: 올바른 타입이지만 값이 잘못됨
try:
    age = int(user_input)
    if age < 0:
        raise ValueError(f"나이는 0 이상이어야 합니다: {age}")
except ValueError as e:
    print(f"잘못된 값: {e}")

# KeyError: 딕셔너리에 없는 키
config = {"host": "localhost"}
try:
    port = config["port"]
except KeyError:
    port = 8080  # 기본값 사용

# FileNotFoundError: 파일 없음
try:
    with open("data.csv") as f:
        data = f.read()
except FileNotFoundError as e:
    print(f"파일을 찾을 수 없습니다: {e.filename}")
```

예외 처리의 핵심은 **어디서 무엇이 잘못될 수 있는지를 예측하고, 그 상황에서 프로그램이 어떻게 동작해야 할지를 명확히 정의하는 것**이다. 다음 글에서는 `try/except/else/finally`의 네 절을 모두 조합해 더 정교한 예외 처리를 작성하는 방법을 살펴본다.

---

**지난 글:** [줄 끝 문자: \n·\r\n·\r과 크로스 플랫폼 처리](/posts/python-line-endings/)

**다음 글:** [try / except / else / finally 완전 정복](/posts/python-try-except-else-finally/)

<br>
읽어주셔서 감사합니다. 😊
