---
title: "순환 임포트: 원인, 동작 원리, 해결 패턴"
description: "Python 순환 임포트(circular import) 발생 원인, sys.modules 부분 초기화 메커니즘, 함수 내 임포트·TYPE_CHECKING·공통 모듈 분리 등 해결책을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 5
type: "knowledge"
category: "Python"
tags: ["python", "순환임포트", "circular import", "ImportError", "TYPE_CHECKING", "아키텍처"]
featured: false
draft: false
---

[지난 글](/posts/python-namespace-package/)에서 네임스페이스 패키지를 살펴봤습니다. 이번에는 패키지를 키우다 보면 반드시 한 번은 만나는 골칫거리, **순환 임포트(circular import)**를 해부합니다. 왜 생기는지, 내부적으로 어떻게 처리되는지, 그리고 어떤 방법으로 해결하는지 알아봅니다.

## 순환 임포트란

두 모듈이 서로를 임포트하는 상황입니다.

```python
# a.py
from b import B_func

def A_func():
    return "A"
```

```python
# b.py
from a import A_func

def B_func():
    return "B"
```

```python
# main.py
import a   # ImportError!
# ImportError: cannot import name 'A_func'
# from partially initialized module 'a'
```

![순환 임포트 개요](/assets/posts/python-circular-import-overview.svg)

## 내부 동작: 부분 초기화 모듈

Python은 모듈을 임포트할 때 실행 **시작 직전**에 빈 모듈 객체를 `sys.modules`에 등록합니다. 이는 무한 재귀를 막기 위한 장치입니다.

![순환 임포트 실행 순서](/assets/posts/python-circular-import-mechanics.svg)

`import a`가 시작될 때:

1. `sys.modules['a']` = 빈 모듈 객체 등록
2. `a.py` 실행 시작 → `from b import B_func` 만남
3. `sys.modules['b']` = 빈 모듈 객체 등록
4. `b.py` 실행 시작 → `from a import A_func` 만남
5. `sys.modules['a']` 확인 → **부분 초기화된 객체 발견**
6. 아직 `a.py`의 `A_func` 정의 줄에 도달하지 않았으므로 `A_func` 없음 → `ImportError`

## 세 가지 해결책

### 1. 함수 내 임포트 (Local Import)

임포트를 최상위에서 함수 안으로 이동합니다. 해당 함수가 **호출될 때** 임포트가 실행되므로, 그 시점에는 두 모듈이 이미 완전히 로드되어 있습니다.

```python
# a.py
def A_func():
    from b import B_func  # 함수 호출 시 임포트
    return B_func()
```

단점은 함수를 호출할 때마다 `sys.modules` 조회가 일어납니다(캐시에서 반환되므로 실제 재로딩은 없지만 오버헤드가 약간 있습니다).

### 2. TYPE_CHECKING 블록

타입 힌트를 위한 임포트만 순환을 만드는 경우, `typing.TYPE_CHECKING`을 활용합니다. 이 상수는 런타임에서 `False`이므로 해당 블록은 실행되지 않고, 타입 검사 도구(`mypy`, `pyright`)가 분석할 때만 `True`로 취급됩니다.

```python
# a.py
from __future__ import annotations  # 타입 평가 지연 (Python 3.10+ 기본)
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from b import BModel  # 런타임에는 실행 안됨

def process(obj: "BModel") -> None:  # 문자열 어노테이션
    ...
```

```python
# Python 3.10+ 에서는 __future__ 없이도 가능
def process(obj: BModel) -> None:  # PEP 563 기본 동작
    ...
```

### 3. 공통 모듈로 분리 (권장)

두 모듈이 서로에게 의존하는 경우, 공통 의존성을 별도 모듈로 추출하는 것이 가장 근본적인 해결책입니다.

```python
# models.py (공통 모듈)
class User:
    pass

class Order:
    pass
```

```python
# a.py
from models import User  # models는 a, b 아무것도 임포트 안함

def A_func(user: User):
    ...
```

```python
# b.py
from models import Order  # 역시 models만 임포트

def B_func(order: Order):
    ...
```

## 아키텍처 레벨 예방

순환 임포트는 보통 **의존 방향이 단방향이지 않을 때** 발생합니다. 아래 레이어 구조를 지키면 순환이 생길 수가 없습니다.

```
presentation/  →  service/  →  domain/  →  infrastructure/
(api, views)       (비즈니스)    (모델, 인터페이스)   (DB, 외부API)
```

상위 레이어가 하위 레이어를 임포트하고, 하위 레이어는 상위 레이어를 임포트하지 않는 원칙(의존 역전)을 지키면 됩니다.

## 순환이 아닌 정상 경우

`import a` 후 `a.something()`처럼 **모듈 전체**를 임포트하고 속성에 **나중에** 접근하면 동작할 수도 있습니다.

```python
# b.py
import a  # 모듈 전체 임포트 (부분 초기화 상태라도 OK)

def B_func():
    return a.A_func()  # 호출 시점에는 a 완전 초기화됨
```

이 패턴은 `from a import A_func` 대신 `import a`를 쓰는 차이입니다. 하지만 의도가 명확하지 않아 권장하지 않습니다.

## 빠른 진단

```python
# 어디서 순환이 발생하는지 추적
import sys
import importlib

# 임포트 전 sys.modules 상태 확인
print([k for k in sys.modules if 'myapp' in k])
```

`-v` 플래그로 실행하면 임포트 순서를 로그로 볼 수 있습니다.

```bash
python -v script.py 2>&1 | grep "import"
```

---

**지난 글:** [네임스페이스 패키지](/posts/python-namespace-package/)

**다음 글:** [importlib로 동적 임포트](/posts/python-importlib-dynamic/)

<br>
읽어주셔서 감사합니다. 😊
