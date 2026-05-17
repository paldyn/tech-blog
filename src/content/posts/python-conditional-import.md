---
title: "조건부 임포트: 선택적 의존성과 폴백 처리"
description: "Python 조건부 임포트 패턴(try/except ImportError, find_spec, TYPE_CHECKING), 플랫폼·버전별 임포트 분기, 선택적 의존성 설계 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 9
type: "knowledge"
category: "Python"
tags: ["python", "조건부임포트", "선택적의존성", "TYPE_CHECKING", "ImportError", "폴백"]
featured: false
draft: false
---

[지난 글](/posts/python-module-caching/)에서 모듈 캐싱을 살펴봤습니다. 이번에는 "이 패키지가 설치되어 있으면 쓰고, 없으면 다른 걸 써라"는 **조건부 임포트**를 다룹니다. 표준 라이브러리와 서드파티 패키지를 혼용하거나, OS·Python 버전에 따라 다른 구현을 선택해야 할 때 꼭 알아야 하는 패턴들입니다.

## 패턴 1: try/except ImportError

가장 일반적인 방식입니다. 설치되어 있으면 빠른 구현을, 없으면 표준 라이브러리 폴백을 씁니다.

```python
try:
    import ujson as json   # ujson이 있으면 사용 (빠름)
except ImportError:
    import json            # 없으면 표준 라이브러리

# 이후 코드는 json 하나로만 씀
data = json.loads('{"key": 1}')
```

중요한 점은 `as` 별칭으로 이름을 통일해 이후 코드가 분기 없이 하나의 이름을 쓸 수 있게 하는 것입니다.

**주의**: `except Exception`으로 너무 넓게 잡으면 임포트가 성공했지만 모듈 내부 오류(문법 오류, 의존성 없음 등)를 묻어버릴 수 있습니다. 반드시 `ImportError`만 잡으세요.

```python
# 잘못된 패턴
try:
    import numpy as np
except Exception:  # 너무 넓음!
    np = None

# 올바른 패턴
try:
    import numpy as np
except ImportError:
    np = None
```

![조건부 임포트 패턴](/assets/posts/python-conditional-import-overview.svg)

## 패턴 2: find_spec() 사전 확인

`importlib.util.find_spec()`으로 존재 여부를 먼저 확인하고 조건에 따라 임포트합니다.

```python
from importlib.util import find_spec

HAS_NUMPY = find_spec("numpy") is not None

def compute(data):
    if HAS_NUMPY:
        import numpy as np
        return np.array(data).mean()
    else:
        return sum(data) / len(data)
```

모듈 레벨에서 플래그를 정의해 두면 여러 곳에서 `find_spec`을 반복 호출하지 않아도 됩니다.

## 패턴 3: TYPE_CHECKING — 타입 전용 임포트

무거운 라이브러리를 타입 힌트에만 쓰는 경우, 런타임에 임포트하지 않아도 됩니다.

```python
from __future__ import annotations  # Python 3.10+ 에선 기본
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import pandas as pd  # mypy, pyright만 실행, 런타임 미로드

def process(df: "pd.DataFrame") -> None:
    ...
```

`TYPE_CHECKING`은 런타임에서 `False`이므로 이 블록은 실행되지 않습니다. 타입 검사 도구만 `True`로 처리합니다.

## 플랫폼·버전별 임포트

OS나 Python 버전에 따라 다른 모듈이 필요한 경우입니다.

![플랫폼·버전별 조건부 임포트](/assets/posts/python-conditional-import-platform.svg)

```python
import sys

# OS별 분기
if sys.platform == "win32":
    import winreg
    def get_registry_value(key):
        ...
elif sys.platform.startswith("linux"):
    import fcntl
    def get_registry_value(key):
        raise NotImplementedError("Windows only")

# Python 버전별 분기 (tomllib은 3.11+에 내장)
if sys.version_info >= (3, 11):
    import tomllib
else:
    try:
        import tomli as tomllib  # 서드파티 backport
    except ImportError:
        raise ImportError("pip install tomli 필요 (Python 3.10 이하)")
```

`sys.version_info`는 `(major, minor, micro, ...)` 튜플이므로 비교 연산이 직관적입니다.

## 선택적 의존성 문서화

조건부 임포트를 쓰는 패키지는 선택적 의존성을 `pyproject.toml`에 명시해야 합니다.

```toml
# pyproject.toml
[project.optional-dependencies]
fast = ["ujson>=5.0", "orjson>=3.0"]
numpy = ["numpy>=1.21"]
all = ["mypackage[fast]", "mypackage[numpy]"]
```

```bash
pip install mypackage           # 기본 설치
pip install "mypackage[fast]"   # 빠른 JSON 포함
pip install "mypackage[all]"    # 모든 선택적 의존성 포함
```

## 런타임 기능 등록 패턴

조건부 임포트를 활용해 기능을 레지스트리에 등록하는 패턴도 있습니다.

```python
# backends.py
BACKENDS = {}

try:
    from .sql_backend import SqlBackend
    BACKENDS["sql"] = SqlBackend
except ImportError:
    pass  # sqlalchemy 없으면 SQL 백엔드 미등록

try:
    from .redis_backend import RedisBackend
    BACKENDS["redis"] = RedisBackend
except ImportError:
    pass

def get_backend(name: str):
    if name not in BACKENDS:
        raise RuntimeError(f"Backend '{name}' 미설치. pip install myapp[{name}] 시도")
    return BACKENDS[name]()
```

사용자는 `get_backend("sql")`을 호출하고, 설치 안 된 백엔드를 요청하면 친절한 에러 메시지를 받습니다.

---

**지난 글:** [모듈 캐싱과 sys.modules](/posts/python-module-caching/)

**다음 글:** [이름 맹글링과 private 네임](/posts/python-private-name-mangling/)

<br>
읽어주셔서 감사합니다. 😊
