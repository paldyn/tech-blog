---
title: "네임스페이스 패키지: __init__.py 없는 패키지"
description: "Python 3.3+ 네임스페이스 패키지(PEP 420) 동작 원리, 일반 패키지와 차이, 플러그인 아키텍처 활용법, __path__ 속성을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 4
type: "knowledge"
category: "Python"
tags: ["python", "네임스페이스패키지", "PEP420", "__init__.py", "플러그인", "패키지"]
featured: false
draft: false
---

[지난 글](/posts/python-package-init-py/)에서 `__init__.py`가 패키지를 선언하고 API를 노출하는 방법을 살펴봤습니다. 이번에는 `__init__.py` 없이도 동작하는 **네임스페이스 패키지**를 알아봅니다. 언제 쓰는지, 어떻게 동작하는지, 그리고 일반 패키지와 어떻게 다른지 정리합니다.

## 네임스페이스 패키지란

Python 3.3(PEP 420)에서 도입된 기능으로, `__init__.py` 없이도 디렉터리를 패키지로 인식하게 합니다. 더 중요한 점은 **여러 디렉터리에 흩어진 같은 이름의 디렉터리를 하나의 패키지로 병합**할 수 있다는 것입니다.

```python
# /path/a/acme/core.py
# /path/b/acme/plugins.py
# 두 위치 모두 __init__.py 없음

import sys
sys.path = ["/path/a", "/path/b"]

import acme.core    # /path/a/acme/core.py 로드
import acme.plugins # /path/b/acme/plugins.py 로드
# 둘 다 acme 패키지의 일부로 동작
```

![네임스페이스 패키지 개요](/assets/posts/python-namespace-package-overview.svg)

## 일반 패키지 vs 네임스페이스 패키지

모듈 탐색 시 Python의 우선순위는 다음과 같습니다.

1. `sys.modules` 캐시
2. 내장 모듈
3. `sys.path`의 각 경로를 순서대로 확인:
   - `__init__.py` 있는 디렉터리 → 일반 패키지 (즉시 반환)
   - `__init__.py` 없는 디렉터리 → 후보로 기록, 계속 탐색
   - 모든 경로 탐색 후 → 후보들이 있으면 네임스페이스 패키지로 반환

```python
import acme
print(type(acme))       # <class 'module'>
print(acme.__file__)    # AttributeError! 없음
print(acme.__path__)    # _NamespacePath(['/path/a/acme', '/path/b/acme'])
```

일반 패키지와 달리 `__file__`이 없고, `__path__`가 여러 경로를 담는 `_NamespacePath` 객체입니다.

## 플러그인 아키텍처에서의 활용

가장 실질적인 사용 사례는 **확장 가능한 플러그인 시스템**입니다.

![네임스페이스 패키지 플러그인 예시](/assets/posts/python-namespace-package-plugin.svg)

코어 패키지와 각 플러그인을 별도의 pip 패키지로 배포하되, 모두 같은 네임스페이스 아래 놓는 방식입니다.

```bash
pip install acme-core
pip install acme-plugin-sql
pip install acme-plugin-rest
```

세 패키지 모두 `acme/` 디렉터리를 포함하지만 `__init__.py`는 없습니다. 설치 후 사용자는 하나의 `acme` 네임스페이스로 접근합니다.

```python
from acme.core import App           # acme-core 제공
from acme.sql.backend import SqlDB  # acme-plugin-sql 제공
from acme.rest.client import Rest   # acme-plugin-rest 제공
```

실제 사례: `pytest` 플러그인(`pytest-asyncio`, `pytest-mock` 등), `sphinx` 확장, `babel` 언어팩이 이 패턴을 씁니다.

## 주의사항

### __init__.py 혼재 금지

같은 네임스페이스에 `__init__.py` 있는 패키지와 없는 패키지가 섞이면 일반 패키지가 우선합니다. 나머지 경로는 무시됩니다.

```python
# /path/a/acme/__init__.py  ← 일반 패키지
# /path/b/acme/plugins.py   ← 네임스페이스 후보

# 결과: /path/a가 우선, /path/b/acme/plugins.py는 acme에서 접근 불가
```

### 서브패키지도 네임스페이스여야 함

```
/path/a/acme/sql/backend.py
```

`acme`와 `acme/sql` 모두 `__init__.py`가 없어야 네임스페이스 패키지로 동작합니다. 중간 디렉터리에 `__init__.py`가 있으면 하위 경로 병합이 안 됩니다.

### 성능

일반 패키지는 `__init__.py`를 찾으면 즉시 반환하지만, 네임스페이스 패키지는 `sys.path`를 **끝까지** 탐색해야 합니다. `sys.path`가 길면 임포트가 느려집니다.

## 언제 쓰고 언제 안 쓰나

**쓸 때:**
- 플러그인·확장을 별도 패키지로 배포하면서 같은 최상위 네임스페이스를 공유해야 할 때
- 여러 저장소에 분산된 코드를 하나의 네임스페이스로 통합해야 할 때

**안 써도 될 때:**
- 단일 저장소의 일반 애플리케이션 코드
- `__init__.py`가 있는 일반 패키지로 충분한 경우

```python
# 현재 패키지가 네임스페이스 패키지인지 확인
import importlib
spec = importlib.util.find_spec("acme")
print(spec.submodule_search_locations)  # _NamespacePath이면 네임스페이스
```

---

**지난 글:** [패키지와 __init__.py](/posts/python-package-init-py/)

**다음 글:** [순환 임포트와 해결법](/posts/python-circular-import/)

<br>
읽어주셔서 감사합니다. 😊
