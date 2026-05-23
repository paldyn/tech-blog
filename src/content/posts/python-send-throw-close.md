---
title: "제너레이터 제어: send(), throw(), close() 완전 정복"
description: "제너레이터의 세 가지 제어 메서드 send(), throw(), close()의 동작 원리, 실전 활용 패턴, GeneratorExit 처리 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 6
type: "knowledge"
category: "Python"
tags: ["Python", "제너레이터", "send", "throw", "close", "GeneratorExit"]
featured: false
draft: false
---

[지난 글](/posts/python-coroutine-basics/)에서 `send()`를 활용한 코루틴 패턴과 프라이밍 규칙을 익혔다. 이번 글에서는 제너레이터를 외부에서 제어하는 세 메서드 `send()`, `throw()`, `close()`를 체계적으로 살펴본다. 이 세 가지를 완전히 이해하면 제너레이터 프로토콜의 전체 그림이 완성된다.

## 세 메서드 개요

제너레이터 객체는 `__next__()` 외에도 외부에서 값이나 예외를 주입하는 메서드를 제공한다.

```python
gen.send(value)          # 값을 전달해 yield 표현식의 결과로 만듦
gen.throw(exc_type, ...)  # 현재 yield 위치에 예외 발생
gen.close()              # GeneratorExit 주입, 제너레이터 종료
```

세 메서드 모두 제너레이터를 재개시키고, 다음 `yield`까지 실행한다.

![제너레이터 제어 메서드 개요](/assets/posts/python-send-throw-close-methods.svg)

## send(value) 상세

`send(value)`는 제너레이터를 재개하면서 `yield` 식의 반환값을 `value`로 설정한다. 재개 후 다음 `yield`에서 멈추고 그 값을 반환한다.

```python
def demo():
    x = yield "첫 yield"        # next() 호출 시 "첫 yield" 반환
    print(f"받은 값: {x}")
    y = yield "두 번째 yield"   # send(10) 시 x=10, "두 번째 yield" 반환
    print(f"또 받음: {y}")

g = demo()
print(next(g))        # "첫 yield"  (x에는 아직 아무것도 없음)
print(g.send(10))     # "받은 값: 10", "두 번째 yield" 반환
g.send(20)            # "또 받음: 20", StopIteration 발생
```

`next(g)`는 `g.send(None)`과 동일하다.

```python
# 아래 두 줄은 완전히 동일
next(g)
g.send(None)
```

## throw(exc_type[, exc_val[, traceback]]) 상세

`throw()`는 현재 `yield` 위치에서 예외를 발생시킨다. 제너레이터 내부에서 그 예외를 잡으면 계속 실행되고, 못 잡으면 예외가 호출자로 전파된다.

```python
def safe_gen():
    for i in range(10):
        try:
            yield i
        except RuntimeError as e:
            print(f"RuntimeError 잡힘: {e}, 계속 진행")

g = safe_gen()
print(next(g))               # 0
print(next(g))               # 1
print(g.throw(RuntimeError, "테스트"))  # RuntimeError 잡힘: 테스트, 계속 진행 / 2 반환
print(next(g))               # 3
```

내부에서 잡지 않은 예외는 그대로 전파된다.

```python
def strict_gen():
    yield 1
    yield 2

g = strict_gen()
next(g)
g.throw(ValueError, "전파됨")  # ValueError: 전파됨 — 잡히지 않음
```

![throw()와 close() 실전 예제](/assets/posts/python-send-throw-close-code.svg)

## close() 상세

`close()`는 현재 `yield` 위치에 `GeneratorExit` 예외를 발생시킨다.

- 제너레이터가 `GeneratorExit`를 잡지 않으면 조용히 종료된다
- `finally` 블록은 항상 실행된다 (리소스 정리에 활용)
- `GeneratorExit`를 잡았다면 `return`으로 끝내거나 예외를 다시 올려야 한다. `yield`로 값을 반환하면 `RuntimeError`가 발생한다

```python
def cleanup_gen():
    try:
        while True:
            yield
    except GeneratorExit:
        print("GeneratorExit 잡힘 — 정리 작업")
    finally:
        print("finally 실행")

g = cleanup_gen()
next(g)
g.close()
# GeneratorExit 잡힘 — 정리 작업
# finally 실행
```

GC(가비지 컬렉터)도 소멸 중인 제너레이터에 자동으로 `close()`를 호출한다.

```python
def leaky():
    try:
        yield 1
    finally:
        print("GC가 close() 호출함")

g = leaky()
next(g)
del g   # GC 호출 → "GC가 close() 호출함"
```

## GeneratorExit와 StopIteration 비교

| 상황 | 발생하는 예외 | 처리 방법 |
|------|-------------|-----------|
| 제너레이터 소진 | `StopIteration` | for 루프가 자동 처리 |
| `close()` 호출 | `GeneratorExit` | `finally` 또는 `except GeneratorExit` |
| `return` 문 | `StopIteration(value)` | `yield from`이 수집 |

`GeneratorExit`는 `BaseException`을 직접 상속한다. `except Exception`으로는 잡히지 않는다.

```python
# BaseException 계층
# BaseException
#   ├── SystemExit
#   ├── KeyboardInterrupt
#   ├── GeneratorExit    ← 여기
#   └── Exception
#       ├── RuntimeError
#       ├── ValueError
#       └── ...
```

## throw()로 취소 신호 구현

비동기 취소 패턴을 제너레이터로 구현할 때 `throw()`가 유용하다.

```python
class CancelError(Exception):
    pass

def long_task():
    results = []
    try:
        for i in range(100):
            results.append(i)
            yield i
    except CancelError:
        print(f"취소됨. {len(results)}개 처리 완료")
        return results

task = long_task()
for _ in range(5):
    next(task)

task.throw(CancelError)   # 취소됨. 5개 처리 완료
```

## yield from과 throw/close의 관계

`yield from`이 활성화된 위임 제너레이터에서 `throw()`나 `close()`를 호출하면 서브 제너레이터에 투명하게 전달된다.

```python
def sub():
    try:
        yield 1
        yield 2
    except RuntimeError:
        print("서브에서 잡힘")
        yield 99

def delegating():
    yield from sub()

g = delegating()
print(next(g))               # 1
print(g.throw(RuntimeError)) # "서브에서 잡힘", 99 반환
```

위임 제너레이터는 `throw()`를 따로 처리하지 않아도 서브 제너레이터가 처리한다.

## 정리

| 메서드 | 시그니처 | 사용 목적 |
|--------|----------|-----------|
| `send(value)` | `value → yield_result` | 값 주입 (코루틴 패턴) |
| `throw(exc)` | 예외 주입 | 취소 신호, 리셋, 오류 전달 |
| `close()` | GeneratorExit 주입 | 종료 및 리소스 정리 |

세 메서드와 `yield from`의 투명 전달을 함께 이해하면 제너레이터 프로토콜의 전체 그림이 완성된다. 다음 글에서는 비동기 컨텍스트에서의 이터레이터 프로토콜인 비동기 이터레이터를 살펴본다.

---

**지난 글:** [제너레이터 기반 코루틴: send()와 초기 코루틴 패턴](/posts/python-coroutine-basics/)

**다음 글:** [비동기 이터레이터: __aiter__와 __anext__ 프로토콜](/posts/python-async-iterator/)

<br>
읽어주셔서 감사합니다. 😊
