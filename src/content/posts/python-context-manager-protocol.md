---
title: "컨텍스트 매니저 프로토콜: __enter__와 __exit__"
description: "Python with 문의 동작 원리, __enter__와 __exit__ 구현 방법, 예외 억제와 전파, contextlib.contextmanager 데코레이터 활용법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 10
type: "knowledge"
category: "Python"
tags: ["python", "컨텍스트 매니저", "__enter__", "__exit__", "with 문"]
featured: false
draft: false
---

[지난 글](/posts/python-arithmetic-methods/)에서 산술 연산 매직 메서드를 살펴보았습니다. 이번에는 `with` 문을 지원하는 **컨텍스트 매니저 프로토콜**을 다룹니다. 파일, 데이터베이스 연결, 잠금처럼 "사용 후 반드시 해제해야 하는" 리소스를 안전하게 관리하는 핵심 패턴입니다.

## with 문의 동작

`with` 문은 블록 진입 시 `__enter__`, 블록 종료 시(정상 또는 예외 무관) `__exit__`을 호출합니다.

```python
with open("data.txt", "r") as f:
    content = f.read()
# 블록을 벗어나면 자동으로 f.close() 호출
```

예외가 발생해도 `__exit__`은 반드시 호출됩니다. `try/finally`와 동일한 보장을 제공하면서 코드가 더 간결해집니다.

## __enter__와 __exit__ 구현

```python
class DatabaseConnection:
    def __init__(self, host):
        self.host = host

    def __enter__(self):
        print(f"Connecting to {self.host}")
        self.conn = self._connect()
        return self.conn   # as 변수에 전달

    def __exit__(self, exc_type, exc_val, exc_tb):
        print("Closing connection")
        self.conn.close()
        return False   # 예외 전파 (None도 동일)

    def _connect(self):
        ...  # 실제 연결 로직

with DatabaseConnection("localhost") as conn:
    conn.execute("SELECT 1")
```

`__enter__`의 반환값이 `as` 변수에 바인딩됩니다. `return self`로 컨텍스트 매니저 자체를 반환하거나, `return self.file`처럼 내부 리소스를 반환할 수 있습니다.

![with 문 실행 흐름](/assets/posts/python-context-manager-protocol-flow.svg)

## __exit__ 인수 처리

`__exit__`은 세 가지 예외 정보를 받습니다.

- `exc_type`: 예외 클래스 (예외 없으면 `None`)
- `exc_val`: 예외 인스턴스
- `exc_tb`: 트레이스백 객체

```python
class SafeLogger:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            print(f"Error occurred: {exc_type.__name__}: {exc_val}")
            # True 반환 시 예외 억제, None/False 반환 시 예외 전파
        return False
```

`True`를 반환하면 예외가 억제되어 블록 이후 코드가 계속 실행됩니다. 대부분의 경우 예외를 전파하는 `False` 또는 `None` 반환이 올바른 패턴입니다.

![__exit__ 예외 처리 패턴](/assets/posts/python-context-manager-protocol-exception.svg)

## contextlib.contextmanager

클래스 대신 제너레이터 함수로 컨텍스트 매니저를 만드는 더 간결한 방법입니다.

```python
from contextlib import contextmanager
import time

@contextmanager
def timer(label="elapsed"):
    start = time.perf_counter()
    try:
        yield                    # with 블록이 여기서 실행
    finally:
        elapsed = time.perf_counter() - start
        print(f"{label}: {elapsed:.4f}s")

with timer("sorting"):
    sorted(range(10_000_000))
```

`yield` 앞이 `__enter__`의 역할, `yield` 뒤(finally)가 `__exit__`의 역할을 합니다. `yield value`로 `as` 변수에 값을 전달할 수 있습니다.

```python
@contextmanager
def managed_file(path, mode="r"):
    f = open(path, mode)
    try:
        yield f                  # as f 에 전달
    finally:
        f.close()

with managed_file("data.txt") as f:
    print(f.read())
```

## 여러 컨텍스트 매니저 중첩

```python
# 중첩 방식
with open("in.txt") as fin:
    with open("out.txt", "w") as fout:
        fout.write(fin.read())

# 한 줄로 쓰는 방식 (Python 3.1+)
with open("in.txt") as fin, open("out.txt", "w") as fout:
    fout.write(fin.read())
```

## 실용적인 활용 예

```python
from contextlib import contextmanager, suppress

# 특정 예외 무시
with suppress(FileNotFoundError):
    os.remove("temp.txt")

# 트랜잭션 패턴
@contextmanager
def transaction(conn):
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise

# 임시 디렉터리 (표준 라이브러리)
import tempfile
with tempfile.TemporaryDirectory() as tmpdir:
    # tmpdir은 블록 종료 시 자동 삭제
    pass
```

컨텍스트 매니저는 Python에서 리소스 관리의 관용구입니다. 파일 외에도 소켓, 잠금, 트랜잭션, 타이머, 임시 상태 변경 등 "열고-닫아야 하는" 모든 패턴에 적용할 수 있습니다.

---

**지난 글:** [산술 연산 메서드: __add__, __mul__ 외](/posts/python-arithmetic-methods/)

<br>
읽어주셔서 감사합니다. 😊
