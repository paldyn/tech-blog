---
title: "with 문과 컨텍스트 매니저: 자원을 안전하게 관리하는 법"
description: "Python with 문의 동작 원리(__enter__/__exit__ 프로토콜), 파일·락·DB 연결 등 다양한 자원 관리 패턴, contextlib.contextmanager로 직접 만드는 방법까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["Python", "with문", "컨텍스트매니저", "contextlib", "파일입출력", "자원관리"]
featured: false
draft: false
---

[지난 글](/posts/python-open-modes/)에서 `open()` 모드를 살펴봤다. 파일을 열었으면 반드시 닫아야 한다. 예외가 발생해도, 조기에 `return`이 실행돼도 닫혀야 한다. 이 "반드시"를 보장하는 것이 `with` 문이다. `with` 문은 파일에만 국한되지 않는다. 데이터베이스 연결, 스레드 락, 임시 디렉터리, HTTP 세션 등 **획득-사용-반환** 패턴이 필요한 모든 자원에 적용된다.

## with 문 없이 파일을 다루면

```python
# try/finally 없이 쓰면 예외 발생 시 close() 누락
f = open("data.txt", encoding="utf-8")
data = f.read()           # 여기서 예외가 나면?
f.close()                 # 실행되지 않음 → 파일 디스크립터 누수

# 올바른 방법 — try/finally
f = open("data.txt", encoding="utf-8")
try:
    data = f.read()
    process(data)
except Exception as e:
    log_error(e)
finally:
    f.close()             # 항상 실행됨
```

`try/finally`로 자원 해제를 보장할 수 있지만, 코드가 길고 반복적이다. `with` 문은 이 패턴의 문법적 설탕(syntactic sugar)이다.

## with 문의 동작 원리

![with 문의 실행 흐름](/assets/posts/python-with-context-overview.svg)

`with` 문은 **컨텍스트 매니저 프로토콜**을 따르는 객체와 함께 사용한다. 프로토콜은 두 메서드로 구성된다.

- `__enter__(self)`: `with` 블록 진입 시 호출. 반환값이 `as` 뒤의 변수에 바인딩된다.
- `__exit__(self, exc_type, exc_val, exc_tb)`: 블록을 나갈 때 **항상** 호출된다. 예외 정보를 인자로 받는다.

```python
# with 문의 내부 동작
with open("data.txt", encoding="utf-8") as f:
    content = f.read()

# 위 코드는 아래와 동일하게 동작
_ctx = open("data.txt", encoding="utf-8")
f = _ctx.__enter__()         # 파일 객체 반환
try:
    content = f.read()
except BaseException as e:
    if not _ctx.__exit__(type(e), e, e.__traceback__):
        raise               # __exit__가 False → 예외 재발생
else:
    _ctx.__exit__(None, None, None)
```

`__exit__`가 `True`를 반환하면 예외를 **억제(suppress)** 한다. 일반적으로는 `False`(또는 `None`)를 반환해 예외를 그대로 전파시킨다.

## 여러 파일을 동시에 열기

```python
# Python 3.10+ 괄호 스타일 (가독성 좋음)
with (
    open("input.txt", "r", encoding="utf-8") as fin,
    open("output.txt", "w", encoding="utf-8") as fout,
):
    for line in fin:
        fout.write(line.upper())

# 구버전 호환 방식
with open("a.txt") as a, open("b.txt") as b:
    ...
```

중첩 `with` 대신 한 줄에 여러 매니저를 나열하면 모두 안전하게 관리된다. 첫 번째 `__enter__`에서 예외가 나도 이미 열린 자원은 `__exit__`로 정리된다.

## with 문이 쓰이는 곳

파일 외에도 `with` 문을 지원하는 표준 라이브러리가 많다.

```python
import threading
import sqlite3
import tempfile
from pathlib import Path

# 스레드 락
lock = threading.Lock()
with lock:
    shared_resource += 1   # lock 해제 자동 보장

# 데이터베이스 연결 (트랜잭션)
with sqlite3.connect("app.db") as conn:
    conn.execute("INSERT INTO logs VALUES (?)", ("event",))
    # 블록 끝에서 commit, 예외 시 rollback

# 임시 파일
with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=True) as tmp:
    tmp.write("id,name\n1,Alice\n")
    tmp.flush()
    process_file(tmp.name)
# 블록 후 파일 자동 삭제

# 임시 디렉터리
with tempfile.TemporaryDirectory() as tmpdir:
    work = Path(tmpdir) / "work.json"
    work.write_text("{}")
# 블록 후 디렉터리 자동 삭제
```

## contextlib로 컨텍스트 매니저 만들기

![with 문 활용 패턴](/assets/posts/python-with-context-code.svg)

`__enter__`/`__exit__` 메서드를 갖춘 클래스를 작성하는 대신, `contextlib.contextmanager` 데코레이터로 제너레이터 함수를 이용해 간단히 만들 수 있다.

```python
from contextlib import contextmanager
import shutil
import tempfile
from pathlib import Path

@contextmanager
def temp_directory(prefix="tmp_"):
    path = Path(tempfile.mkdtemp(prefix=prefix))
    try:
        yield path          # ← with 블록이 실행되는 지점
    finally:
        shutil.rmtree(path, ignore_errors=True)

# 사용
with temp_directory(prefix="build_") as d:
    (d / "config.json").write_text('{"debug": true}')
    run_build(d)
# 블록 후 디렉터리 자동 삭제
```

`yield` 앞이 `__enter__`, 뒤가 `__exit__`에 해당한다. `try/finally`로 정리 코드를 `yield` 뒤에 배치한다.

```python
@contextmanager
def timer(label=""):
    import time
    start = time.perf_counter()
    try:
        yield
    finally:
        elapsed = time.perf_counter() - start
        print(f"{label}: {elapsed:.3f}s")

with timer("데이터 처리"):
    process_large_dataset()
# → 데이터 처리: 2.341s
```

## 클래스로 만드는 컨텍스트 매니저

세밀한 제어가 필요하면 클래스로 직접 구현한다.

```python
class ManagedConnection:
    def __init__(self, host, port):
        self.host = host
        self.port = port
        self.conn = None

    def __enter__(self):
        self.conn = connect(self.host, self.port)
        return self.conn

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            self.conn.rollback()
        else:
            self.conn.commit()
        self.conn.close()
        return False  # 예외 억제하지 않음

with ManagedConnection("localhost", 5432) as conn:
    conn.execute("UPDATE users SET active = 1 WHERE id = ?", (42,))
```

`__exit__`의 반환값이 `True`면 예외를 무시한다. `contextlib.suppress`가 이 패턴을 구현하고 있다.

```python
from contextlib import suppress

with suppress(FileNotFoundError):
    Path("temp.txt").unlink()   # 없어도 에러 없이 통과
```

## 요약

| 항목 | 내용 |
|---|---|
| `with` 문 | `__enter__` → 블록 → `__exit__` 순서 보장 |
| 파일 | `open()` 사용 후 자동 `close()` |
| 락 | `threading.Lock()` 자동 해제 |
| DB | `sqlite3.connect()` 자동 commit/rollback |
| 커스텀 | `@contextmanager` 데코레이터 또는 `__enter__/__exit__` 클래스 |

`with` 문을 적극적으로 활용하면 자원 누수를 방지하고, 예외 안전한 코드를 간결하게 작성할 수 있다.

---

**지난 글:** [파일 열기 모드: open() 완전 정리](/posts/python-open-modes/)

**다음 글:** [텍스트 vs 이진 모드: 개행 문자와 인코딩의 차이](/posts/python-text-vs-binary-mode/)

<br>
읽어주셔서 감사합니다. 😊
