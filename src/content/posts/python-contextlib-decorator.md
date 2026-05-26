---
title: "contextlib.contextmanager 데코레이터"
description: "@contextmanager 데코레이터로 제너레이터 함수를 컨텍스트 매니저로 변환하는 방법, yield 전/후 코드 흐름, try/finally 패턴, 클래스 방식과의 비교를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["Python", "contextlib", "contextmanager", "제너레이터", "with문"]
featured: false
draft: false
---

[지난 글](/posts/python-context-manager-class/)에서 클래스로 `__enter__`와 `__exit__`을 직접 구현했다. 클래스를 만드는 것이 부담스러울 때 `contextlib.contextmanager` 데코레이터를 쓰면 **제너레이터 함수 하나**로 동일한 기능을 구현할 수 있다.

## @contextmanager 기본 개념

`contextlib.contextmanager`는 `yield`가 하나인 제너레이터 함수를 `with` 문에서 쓸 수 있는 컨텍스트 매니저로 변환한다.

- **yield 앞**: `__enter__`에 해당 — 자원 획득, 초기화
- **yield**: 블록 본문에 제어권을 넘기고 여기서 일시 정지. `yield value`면 `as` 절에 `value` 바인딩
- **yield 뒤**: `__exit__`에 해당 — 자원 해제, 정리

![contextmanager 실행 흐름](/assets/posts/python-contextlib-decorator-flow.svg)

## 기본 예제: 파일 관리

```python
from contextlib import contextmanager

@contextmanager
def managed_resource(path):
    resource = open(path)
    print("자원 획득")
    try:
        yield resource      # 블록에 파일 객체 전달
    finally:
        resource.close()    # 예외 여부와 관계없이 실행
        print("자원 해제")

with managed_resource("data.txt") as f:
    data = f.read()
```

**`try/finally`가 핵심이다.** `finally` 없이 yield 뒤에 정리 코드만 쓰면, 블록에서 예외가 발생했을 때 정리 코드가 실행되지 않는다.

![contextmanager 예제](/assets/posts/python-contextlib-decorator-code.svg)

## 예외 처리

블록 안에서 예외가 발생하면 `yield` 지점에서 예외가 다시 던져진다. `except`로 잡아서 처리하거나, 잡지 않으면 전파된다.

```python
@contextmanager
def safe_op():
    try:
        yield
    except ValueError as e:
        print(f"ValueError 억제: {e}")
        # return 으로 함수 종료 → 예외 억제 (True 반환과 동일)
    except Exception:
        raise  # 다른 예외는 그대로 전파
    finally:
        print("항상 실행")

with safe_op():
    raise ValueError("테스트")
# ValueError 억제: 테스트
# 항상 실행
```

## 클래스 방식 vs @contextmanager

| 항목 | 클래스 방식 | @contextmanager |
|------|-------------|----------------|
| 코드량 | 더 많음 | 적음 (함수 하나) |
| 상태 저장 | 인스턴스 속성 | 지역 변수 |
| 재사용성 | 상속 가능 | 함수 중첩 |
| 가독성 | 명시적 | 간결 |

단순한 자원 관리에는 `@contextmanager`가 편리하다. 상태가 복잡하거나 상속이 필요한 경우에는 클래스 방식이 더 적합하다.

## 실용 예제: 임시 디렉터리 변경

```python
import os
from contextlib import contextmanager

@contextmanager
def chdir(path):
    old = os.getcwd()
    os.chdir(path)
    try:
        yield
    finally:
        os.chdir(old)

with chdir("/tmp"):
    print(os.getcwd())  # /tmp
# 복귀
print(os.getcwd())  # 원래 디렉터리
```

## yield는 반드시 한 번만

`@contextmanager` 함수에서 `yield`를 두 번 이상 실행하면 `RuntimeError: generator didn't stop`이 발생한다. `contextmanager` 래퍼가 `yield`가 정확히 한 번 실행되길 기대하기 때문이다.

```python
@contextmanager
def broken():
    yield 1
    yield 2   # ← RuntimeError 발생
```

## 요약

- `@contextmanager` + `yield` 하나로 클래스 없이 컨텍스트 매니저 구현
- `yield` 앞 → 진입, `yield value` → `as` 바인딩, `yield` 뒤 → 탈출
- 정리 코드는 반드시 `try/finally` 안에 넣어야 예외 시에도 실행됨
- `yield`는 정확히 한 번만

---

**지난 글:** [컨텍스트 매니저 클래스](/posts/python-context-manager-class/)

**다음 글:** [contextlib.suppress와 redirect](/posts/python-suppress-redirect/)

<br>
읽어주셔서 감사합니다. 😊
