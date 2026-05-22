---
title: "warnings 모듈: 경고를 오류처럼 다루기"
description: "Python warnings 모듈의 동작 원리와 사용법을 설명합니다. 경고 카테고리, filterwarnings로 경고를 오류로 전환하는 방법, 테스트에서 경고를 검증하는 방법까지 완전히 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 8
type: "knowledge"
category: "Python"
tags: ["Python", "warnings", "DeprecationWarning", "filterwarnings", "테스트"]
featured: false
draft: false
---

[지난 글](/posts/python-exception-groups/)에서 ExceptionGroup과 except*를 살펴봤다. 이번에는 예외는 아니지만 예외 계층에 포함되는 **경고(Warning)**를 다룬다. Python의 `warnings` 모듈은 라이브러리 개발자가 사용자에게 "이 기능은 곧 없어집니다" 같은 메시지를 전달하는 공식 채널이다. 경고를 올바르게 다루면 코드베이스의 품질을 높일 수 있다.

## 경고와 예외의 차이

경고는 예외와 달리 기본적으로 **프로그램을 멈추지 않는다**. `sys.stderr`에 메시지를 출력하고 실행을 계속한다.

```python
import warnings

warnings.warn("이 함수는 다음 버전에서 삭제됩니다", DeprecationWarning)
# DeprecationWarning: 이 함수는 다음 버전에서 삭제됩니다
# 프로그램은 계속 실행됨
```

경고는 예외 계층에서 `Warning`(→ `Exception` → `BaseException`)을 상속받는다. 즉, 원한다면 예외처럼 `raise`하거나 `except`로 잡을 수도 있다.

## 경고 카테고리

![경고 카테고리](/assets/posts/python-warnings-categories.svg)

| 카테고리 | 용도 |
|---------|------|
| `DeprecationWarning` | 개발자가 직접 쓸 때, 폐기 예정 기능 |
| `PendingDeprecationWarning` | 향후 폐기 예정이나 아직 결정 안 됨 |
| `FutureWarning` | 기본 동작이 바뀔 예정 (최종 사용자 대상) |
| `RuntimeWarning` | 런타임 의심 동작 |
| `ResourceWarning` | 파일/소켓 같은 리소스 누수 |
| `UserWarning` | 사용자 정의 경고 (기본값) |

기본적으로 `DeprecationWarning`과 `PendingDeprecationWarning`은 `__main__`에서 실행될 때만 보이고, 라이브러리 코드에서는 숨겨진다. `FutureWarning`은 항상 표시된다.

## 경고 발생시키기

```python
import warnings

def old_api(data):
    warnings.warn(
        "old_api()는 deprecated입니다. new_api()를 사용하세요.",
        DeprecationWarning,
        stacklevel=2,   # 경고 위치를 호출자로 설정
    )
    return new_api(data)
```

`stacklevel=2`가 중요하다. 기본값 1은 `warnings.warn()`이 있는 줄을 가리키고, 2는 `old_api()`를 호출한 줄을 가리킨다. 사용자 입장에서는 어디서 deprecated API를 호출했는지 알아야 하므로 2가 맞다.

```python
# stacklevel=1 (기본, 나쁜 예):
# path/to/mylib.py:5: DeprecationWarning: ...

# stacklevel=2 (올바른 예):  
# user_code.py:10: DeprecationWarning: ...  ← 사용자 코드 줄 번호
```

## filterwarnings로 경고 제어

`warnings.filterwarnings(action, message, category, module, lineno)`

```python
import warnings

# 모든 DeprecationWarning을 오류로 전환
warnings.filterwarnings("error", category=DeprecationWarning)

# 특정 모듈의 경고 무시
warnings.filterwarnings("ignore", module="pandas")

# 특정 메시지를 포함한 경고 무시
warnings.filterwarnings("ignore", message=".*deprecated.*")

# 경고 필터 초기화
warnings.resetwarnings()
```

![경고 필터 액션](/assets/posts/python-warnings-filters.svg)

### 컨텍스트 관리자로 임시 적용

```python
with warnings.catch_warnings():
    warnings.simplefilter("ignore")   # 블록 내에서만 경고 무시
    legacy_function()

# 블록을 벗어나면 원래 설정으로 복구됨
```

## CLI와 환경 변수로 제어

```bash
# 모든 경고를 오류로 전환
python -W error script.py

# DeprecationWarning만 오류로
python -W error::DeprecationWarning script.py

# 환경 변수로 설정
PYTHONWARNINGS=error python script.py
```

pytest에서는 기본적으로 `DeprecationWarning`과 `PendingDeprecationWarning`이 표시되도록 설정되어 있다.

## 테스트에서 경고 검증하기

pytest에서 경고를 검사하는 방법이다.

```python
import warnings
import pytest

def test_deprecated_api():
    with pytest.warns(DeprecationWarning, match="old_api"):
        old_api(data)
```

경고가 발생하지 않으면 테스트가 실패한다.

`unittest`를 사용하는 경우:

```python
import unittest
import warnings

class TestWarnings(unittest.TestCase):
    def test_deprecated(self):
        with self.assertWarns(DeprecationWarning):
            old_api(data)

    def test_no_warnings(self):
        with warnings.catch_warnings():
            warnings.simplefilter("error")
            # 이 블록에서 경고가 발생하면 오류가 됨
            clean_function()
```

## 라이브러리 폐기 API 패턴

실무에서 API를 교체할 때 쓰는 표준 패턴이다.

```python
import functools
import warnings

def deprecated(replacement=None, version=None):
    """폐기 함수를 표시하는 데코레이터"""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            msg = f"{func.__name__}()는 deprecated입니다."
            if replacement:
                msg += f" {replacement}()를 사용하세요."
            if version:
                msg += f" (v{version}에서 삭제 예정)"
            warnings.warn(msg, DeprecationWarning, stacklevel=2)
            return func(*args, **kwargs)
        return wrapper
    return decorator

@deprecated(replacement="new_process", version="2.0")
def process(data):
    return old_implementation(data)
```

```python
result = process(my_data)
# UserCode:5: DeprecationWarning: process()는 deprecated입니다.
# new_process()를 사용하세요. (v2.0에서 삭제 예정)
```

## ResourceWarning: 리소스 누수 감지

```python
import warnings

# ResourceWarning은 기본적으로 숨겨져 있음
# -W default::ResourceWarning 또는 아래 코드로 활성화
warnings.simplefilter("always", ResourceWarning)

def leaky_function():
    f = open("data.txt")
    # f.close()를 안 했음
    return f.read()

leaky_function()
# ResourceWarning: unclosed file <...>
```

리소스 누수를 찾을 때 `ResourceWarning`을 활성화하면 파일, 소켓, 데이터베이스 연결 등의 누수를 감지할 수 있다.

## warnings.warn_explicit

더 세밀한 제어가 필요할 때 `warn_explicit`을 쓴다.

```python
# 특정 파일·줄 번호를 직접 지정
warnings.warn_explicit(
    "직접 지정한 경고",
    category=UserWarning,
    filename="custom_file.py",
    lineno=42,
    module="my_module",
)
```

## 경고를 로거로 보내기

```python
import logging
import warnings

logging.captureWarnings(True)
# 이후 모든 경고가 logging.warning()으로 전달됨

logger = logging.getLogger("py.warnings")
# warnings 로거에서 메시지 수신 가능
```

`logging.captureWarnings(True)`를 쓰면 경고를 로그 파일에 저장하거나 중앙 로그 시스템으로 전달할 수 있다. 서버 애플리케이션에서 경고를 놓치지 않도록 하는 데 유용하다.

경고 시스템을 잘 이해하면 라이브러리를 더 친절하게 설계하고, 경고를 테스트로 검증해 코드 품질을 높일 수 있다. 다음 글에서는 `traceback` 모듈로 예외 정보를 더 세밀하게 다루는 방법을 살펴본다.

---

**지난 글:** [예외 그룹과 except*: Python 3.11의 새 문법](/posts/python-exception-groups/)

**다음 글:** [traceback 모듈로 예외 정보 완전 제어하기](/posts/python-traceback-module/)

<br>
읽어주셔서 감사합니다. 😊
