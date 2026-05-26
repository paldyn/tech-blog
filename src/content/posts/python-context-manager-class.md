---
title: "컨텍스트 매니저 클래스"
description: "__enter__와 __exit__ 메서드를 구현해 with 문에서 사용 가능한 컨텍스트 매니저 클래스를 만드는 방법, __exit__의 예외 처리 로직, 실용 예제를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 1
type: "knowledge"
category: "Python"
tags: ["Python", "context-manager", "__enter__", "__exit__", "with문"]
featured: false
draft: false
---

[지난 글](/posts/python-deprecated-warnings-decorator/)에서 deprecated 경고 데코레이터를 살펴봤다. 이번 글부터는 **컨텍스트 매니저** 시리즈를 시작한다. `with open("file.txt") as f:` 처럼 자원 획득과 해제를 자동화하는 `with` 문의 내부 동작 원리, 즉 **컨텍스트 매니저 프로토콜**부터 살펴본다.

## 컨텍스트 매니저 프로토콜

Python의 `with` 문은 두 가지 메서드 규약으로 동작한다.

| 메서드 | 시점 | 역할 |
|--------|------|------|
| `__enter__(self)` | `with` 진입 시 | 자원 획득, 반환값이 `as` 절에 바인딩 |
| `__exit__(self, exc_type, exc_val, exc_tb)` | `with` 탈출 시 | 자원 해제, 예외 처리 여부 결정 |

`__exit__`이 `True`를 반환하면 예외가 억제(swallow)된다. `False` 또는 `None`을 반환하면 예외가 그대로 전파된다.

![컨텍스트 매니저 클래스 프로토콜](/assets/posts/python-context-manager-class-protocol.svg)

## 기본 구조

```python
class MyContext:
    def __enter__(self):
        # 자원 획득
        return self  # as 절에 바인딩될 객체

    def __exit__(self, exc_type, exc_val, exc_tb):
        # 자원 해제
        # exc_type 이 None 이면 정상 종료
        return False  # True 면 예외 억제
```

`__enter__`는 반드시 뭔가를 반환해야 하지만, `as` 절을 쓰지 않는다면 `None`을 반환해도 무방하다. `__exit__`는 세 개의 예외 인수를 받는다. 정상 종료 시 세 값 모두 `None`이다.

## Timer 예제: 경과 시간 측정

가장 자주 보이는 패턴 중 하나가 코드 블록의 실행 시간을 재는 Timer다.

```python
import time

class Timer:
    def __enter__(self):
        self.start = time.perf_counter()
        return self            # t = Timer() → __enter__() 반환값

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.elapsed = time.perf_counter() - self.start
        return False           # 예외 억제 안 함

with Timer() as t:
    result = sum(range(10_000_000))

print(f"걸린 시간: {t.elapsed:.3f}s")
# 걸린 시간: 0.412s
```

![Timer 컨텍스트 매니저 구현](/assets/posts/python-context-manager-class-code.svg)

## __exit__로 예외 억제하기

`__exit__`에서 `True`를 반환하면 블록 안에서 발생한 예외가 사라진다. 특정 예외만 잡고 나머지는 전파할 때 유용하다.

```python
class SuppressZeroDivision:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is ZeroDivisionError:
            print(f"ZeroDivision 억제: {exc_val}")
            return True   # 예외 삼킴
        return False      # 다른 예외는 그대로 전파

with SuppressZeroDivision():
    x = 1 / 0    # 예외 발생
    print("여기는 실행 안 됨")

print("with 블록 이후 코드는 정상 실행")
# ZeroDivision 억제: division by zero
# with 블록 이후 코드는 정상 실행
```

## 데이터베이스 트랜잭션 패턴

실무에서 가장 많이 보이는 사례다. 성공 시 커밋, 예외 시 롤백을 자동화한다.

```python
class Transaction:
    def __init__(self, conn):
        self.conn = conn

    def __enter__(self):
        return self.conn.cursor()

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            self.conn.commit()
        else:
            self.conn.rollback()
        return False  # 예외 전파 (호출자에게 알림)
```

## 중첩 with 문

컨텍스트 매니저는 중첩해서 쓸 수 있다. Python 3.10 이후에는 괄호로 묶을 수 있다.

```python
# 전통 방식
with open("in.txt") as src:
    with open("out.txt", "w") as dst:
        dst.write(src.read())

# Python 3.10+ 괄호 방식
with (
    open("in.txt") as src,
    open("out.txt", "w") as dst,
):
    dst.write(src.read())
```

## __enter__ 반환값 패턴

`__enter__`가 무엇을 반환하느냐에 따라 `as` 절의 의미가 달라진다.

```python
# self를 반환: as 절로 컨텍스트 매니저 자체에 접근
class Timer:
    def __enter__(self): return self

# 새 객체 반환: open()이 이 방식
class ManagedFile:
    def __init__(self, path):
        self.path = path
    def __enter__(self):
        self.file = open(self.path)
        return self.file  # ← 파일 객체 반환

# None 반환: as 절 없이 쓸 때
class Lock:
    def __enter__(self): self.acquire(); return None
    def __exit__(self, *a): self.release(); return False
```

## 요약

- `__enter__` → `with` 블록 진입 시 호출, 반환값이 `as`에 바인딩
- `__exit__` → 블록 탈출 시 항상 호출 (정상·예외 모두)
- `__exit__` 반환 `True` → 예외 억제, `False`/`None` → 예외 전파
- 자원 획득·해제, 트랜잭션, 타이머 등 "enter/exit" 패턴에 활용

---

**다음 글:** [contextlib.contextmanager 데코레이터](/posts/python-contextlib-decorator/)

<br>
읽어주셔서 감사합니다. 😊
