---
title: "패키지와 __init__.py: 역할과 설계 패턴"
description: "Python 패키지 선언 파일 __init__.py의 역할(패키지 인식, API 노출, 초기화), __all__ 활용, lazy import 패턴, 비어 있어도 되는 이유를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 3
type: "knowledge"
category: "Python"
tags: ["python", "__init__.py", "패키지", "__all__", "lazy import", "모듈"]
featured: false
draft: false
---

[지난 글](/posts/python-relative-vs-absolute-import/)에서 임포트 스타일을 비교했습니다. 이번에는 패키지를 이루는 핵심 파일인 `__init__.py`가 실제로 어떤 일을 하는지, 그리고 잘 설계하는 방법을 살펴봅니다.

## __init__.py 란

디렉터리를 **패키지(package)**로 만드는 파일입니다. `__init__.py`가 있는 디렉터리는 `import myapp`처럼 패키지로 임포트할 수 있습니다.

```
myapp/
  __init__.py   ← 이것이 있어야 패키지
  utils.py
  models.py
  core/
    __init__.py ← 서브패키지도 각자 필요
    engine.py
```

파일 내용이 완전히 비어 있어도 됩니다. Python 3.3부터는 `__init__.py` 없이도 **네임스페이스 패키지**로 동작하지만, 일반 패키지를 명시적으로 선언하려면 파일을 두는 편이 안전합니다.

![패키지와 __init__.py 역할](/assets/posts/python-package-init-py-overview.svg)

## 패키지 임포트 시 실행 타이밍

`import myapp`이나 `from myapp import utils`를 처음 호출하면 `myapp/__init__.py`가 **즉시 실행**됩니다. 이후 같은 인터프리터 세션에서는 `sys.modules` 캐시에서 반환되어 다시 실행되지 않습니다.

```python
# myapp/__init__.py
print("myapp 패키지 초기화")  # import myapp 시 한 번만 출력
```

이 동작을 이용해 패키지 수준 초기화 코드를 넣을 수 있습니다(로깅 설정, 플러그인 등록 등).

## 퍼블릭 API 노출 패턴

`__init__.py`의 가장 흔한 역할은 내부 모듈 구조를 숨기고 편리한 임포트 경로를 제공하는 것입니다.

```python
# myapp/__init__.py
from .models import User, Product
from .core.engine import Engine
from .exceptions import APIError

__version__ = "2.0.0"
__all__ = ["User", "Product", "Engine", "APIError"]
```

이렇게 하면 사용자는 내부 구조를 알 필요 없이 `from myapp import User`만 쓰면 됩니다.

```python
# 사용 측
from myapp import User, Engine  # 내부 경로(myapp.models, myapp.core.engine) 몰라도 됨
```

내부 모듈을 나중에 `myapp/db/models.py`로 옮겨도 `__init__.py`만 수정하면 사용자 코드는 그대로입니다.

## __all__ 과 와일드카드 임포트

`__all__`은 `from pkg import *` 시 노출할 이름 목록을 정의합니다.

```python
# __all__ 없는 경우
# _로 시작하지 않는 모든 이름이 * 로 노출됨

# __all__ 있는 경우
__all__ = ["Client", "Config"]
# 목록에 있는 것만 * 로 노출, _InternalHelper 같은 이름은 숨겨짐
```

와일드카드 임포트(`from pkg import *`)는 일반적으로 권장되지 않지만, `__all__`을 정의해 두면 최소한 노출 범위를 제어할 수 있습니다.

## Lazy import 패턴

패키지 안에 무거운 의존성(numpy, tensorflow 등)이 있을 때, `__init__.py`에서 모두 임포트하면 패키지 로드 시간이 길어집니다. `__getattr__`을 활용한 지연 임포트로 이를 해결합니다.

```python
# myapp/__init__.py
def __getattr__(name: str):
    if name == "HeavyAnalyzer":
        from ._analyzer import HeavyAnalyzer
        return HeavyAnalyzer
    raise AttributeError(f"module 'myapp' has no attribute {name!r}")
```

```python
# 사용 측
import myapp
# HeavyAnalyzer는 아직 로드 안됨

analyzer = myapp.HeavyAnalyzer()  # 이 시점에 로드
```

Python 표준 라이브러리(`email`, `html` 등)도 이 패턴을 사용합니다.

![__init__.py 패턴](/assets/posts/python-package-init-py-patterns.svg)

## __init__.py를 비우는 게 나은 경우

파일이 커질수록 임포트 시간이 늘고, 순환 임포트 위험도 증가합니다. 다음 경우에는 `__init__.py`를 최소화하는 편이 낫습니다.

- 내부 모듈이 많고 각자 독립적으로 사용될 때
- 사용자가 `from myapp.core import engine`처럼 직접 경로를 쓰는 게 자연스러울 때
- 프레임워크나 라이브러리가 아니라 애플리케이션 코드일 때

```python
# 비운 __init__.py도 완전히 유효한 패키지
# myapp/__init__.py
# (empty)
```

## 버전 관리 위치

단일 진실 공급원으로 `__init__.py`에 버전을 두는 패턴이 전통적입니다.

```python
# myapp/__init__.py
__version__ = "1.2.3"
__author__ = "PALDYN Team"
```

최근에는 `pyproject.toml`의 `[project] version`이 단일 진실 공급원이 되고, `importlib.metadata`로 읽는 방식을 선호합니다.

```python
from importlib.metadata import version
__version__ = version("myapp")
```

---

**지난 글:** [절대 임포트 vs 상대 임포트](/posts/python-relative-vs-absolute-import/)

**다음 글:** [네임스페이스 패키지](/posts/python-namespace-package/)

<br>
읽어주셔서 감사합니다. 😊
