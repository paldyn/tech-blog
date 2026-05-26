---
title: "contextlib.suppress와 redirect"
description: "contextlib.suppress로 특정 예외를 억제하는 방법, redirect_stdout/redirect_stderr로 출력을 리다이렉트하는 방법, nullcontext 활용법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 3
type: "knowledge"
category: "Python"
tags: ["Python", "contextlib", "suppress", "redirect_stdout", "nullcontext"]
featured: false
draft: false
---

[지난 글](/posts/python-contextlib-decorator/)에서 `@contextmanager` 데코레이터로 제너레이터 함수를 컨텍스트 매니저로 변환하는 방법을 살펴봤다. 이번에는 `contextlib`이 제공하는 **즉시 사용 가능한 유틸리티**인 `suppress`, `redirect_stdout`, `nullcontext`를 살펴본다.

## contextlib.suppress — 예외 억제

`suppress`는 지정한 예외가 발생해도 조용히 무시하고 넘어가는 컨텍스트 매니저다. `try/except: pass` 패턴을 한 줄로 줄여준다.

```python
from contextlib import suppress
import os

# 기존 패턴
try:
    os.remove("temp.txt")
except FileNotFoundError:
    pass

# suppress 사용
with suppress(FileNotFoundError):
    os.remove("temp.txt")
```

두 코드는 완전히 동일하게 동작한다. `suppress` 쪽이 의도를 더 명확히 전달한다. "이 예외는 무시해도 괜찮다"는 의미가 코드에 드러난다.

![suppress와 redirect 개요](/assets/posts/python-suppress-redirect-overview.svg)

## 여러 예외 동시 억제

`suppress`는 여러 예외 타입을 동시에 받을 수 있다.

```python
with suppress(FileNotFoundError, PermissionError):
    os.remove("protected.txt")
```

## contextlib.redirect_stdout — 출력 리다이렉트

`redirect_stdout`은 `with` 블록 안의 `print()` 출력을 다른 스트림으로 돌린다.

```python
import io
from contextlib import redirect_stdout

buf = io.StringIO()
with redirect_stdout(buf):
    print("캡처된 텍스트")
    print("두 번째 줄")

output = buf.getvalue()
print(repr(output))
# '캡처된 텍스트\n두 번째 줄\n'
```

테스트 코드에서 서드파티 라이브러리의 출력을 캡처하거나, 명령어 출력을 파일로 저장할 때 유용하다.

![suppress / redirect 코드 예제](/assets/posts/python-suppress-redirect-code.svg)

## redirect_stderr

표준 에러도 같은 방식으로 리다이렉트한다.

```python
import sys
import io
from contextlib import redirect_stderr

err_buf = io.StringIO()
with redirect_stderr(err_buf):
    print("에러 메시지", file=sys.stderr)

print(err_buf.getvalue())
# '에러 메시지\n'
```

## redirect_stdout 주의사항

`redirect_stdout`은 내부적으로 `sys.stdout`을 전역으로 교체한다. 따라서:

- **스레드 안전하지 않다** — 멀티스레드 환경에서 다른 스레드의 출력도 영향을 받을 수 있다
- 블록을 벗어나면 자동 복원된다
- `C` 확장이 직접 `libc`의 `printf`를 쓰는 경우 캡처되지 않는다

```python
# 테스트에서 출력 캡처 예
import unittest
from contextlib import redirect_stdout
import io

class TestOutput(unittest.TestCase):
    def test_print_output(self):
        buf = io.StringIO()
        with redirect_stdout(buf):
            my_function()
        self.assertIn("expected", buf.getvalue())
```

## contextlib.nullcontext — 아무것도 안 하는 컨텍스트

`nullcontext`는 `__enter__`와 `__exit__`이 아무것도 하지 않는 컨텍스트 매니저다. 조건부 with 문에서 자리표시자로 사용한다.

```python
from contextlib import nullcontext
import threading

def process_data(data, lock=None):
    # lock 이 있으면 잠그고, 없으면 nullcontext 로 그냥 실행
    ctx = lock if lock is not None else nullcontext()
    with ctx:
        return expensive_operation(data)
```

`None`을 `with` 문에 넣으면 `AttributeError`가 나지만 `nullcontext()`는 안전하게 동작한다. 선택적 잠금이나 트레이싱 도구를 조건부로 활성화할 때 자주 쓰인다.

## suppress 남용 주의

`suppress`를 너무 넓게 쓰면 버그를 숨길 수 있다.

```python
# 나쁜 예: 너무 넓은 억제
with suppress(Exception):   # 모든 예외 억제 → 디버깅 불가
    do_something()

# 좋은 예: 명확한 예외만 억제
with suppress(FileNotFoundError):
    os.remove("cache.tmp")   # 없는 파일 삭제는 OK
```

억제할 예외의 의미가 명확하고, 그 예외가 실제로 무시해도 괜찮은 경우에만 `suppress`를 쓴다.

## 요약

| 도구 | 용도 |
|------|------|
| `suppress(ExcType)` | 특정 예외 억제 (try/except pass 대체) |
| `redirect_stdout(stream)` | print() 출력을 지정 스트림으로 |
| `redirect_stderr(stream)` | stderr 출력을 지정 스트림으로 |
| `nullcontext()` | 아무것도 안 하는 더미 컨텍스트 |

---

**지난 글:** [contextlib.contextmanager 데코레이터](/posts/python-contextlib-decorator/)

**다음 글:** [ExitStack — 동적 컨텍스트 매니저 스택](/posts/python-exitstack/)

<br>
읽어주셔서 감사합니다. 😊
