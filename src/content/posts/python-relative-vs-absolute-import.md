---
title: "절대 임포트 vs 상대 임포트: 언제 무엇을 써야 하나"
description: "Python 절대 임포트와 상대 임포트의 문법 차이, 점(.) 표기 의미, 직접 실행 시 ImportError 원인, PEP 8 권고를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["python", "import", "절대임포트", "상대임포트", "패키지", "PEP8"]
featured: false
draft: false
---

[지난 글](/posts/python-module-search-path/)에서 `sys.path`가 어떻게 구성되는지 살펴봤습니다. 이번에는 그 경로 위에서 실제로 모듈을 불러올 때 쓰는 두 가지 임포트 스타일, **절대 임포트(absolute import)**와 **상대 임포트(relative import)**의 차이를 파헤칩니다.

## 절대 임포트

패키지 루트부터 전체 경로를 명시하는 방식입니다.

```python
# myapp/core/engine.py 안에서
from myapp import utils          # 상위 패키지의 모듈
from myapp.core import parser    # 같은 패키지의 형제 모듈
import myapp.core.parser         # 전체 경로 import
```

`myapp`이 `sys.path`의 어딘가에 있으면 어디서 실행하든 이 임포트는 동일하게 동작합니다. 코드를 읽는 사람이 모듈 출처를 바로 알 수 있고, IDE의 자동완성·타입 검사와도 궁합이 좋습니다.

## 상대 임포트

현재 파일의 위치를 기준으로 점(`.`)으로 상대 위치를 표현합니다.

```python
# myapp/core/engine.py 안에서
from . import parser          # 같은 디렉터리(myapp/core/)
from .parser import parse     # 같은 디렉터리의 특정 심볼
from .. import utils          # 상위 패키지(myapp/)
from ..utils import helper    # 상위 패키지의 특정 심볼
```

점의 개수가 올라가는 단계를 나타냅니다. `.` = 현재, `..` = 한 단계 위, `...` = 두 단계 위.

![절대 vs 상대 임포트 overview](/assets/posts/python-relative-vs-absolute-import-overview.svg)

## 직접 실행 시 생기는 함정

상대 임포트를 쓴 파일을 스크립트로 직접 실행하면 에러가 납니다.

```python
# myapp/core/engine.py
from . import parser   # 상대 임포트 사용
```

```bash
# 이렇게 실행하면
python myapp/core/engine.py
# ImportError: attempted relative import with no known parent package
```

`python script.py` 방식으로 실행하면 해당 파일이 `__name__ == '__main__'`이 되고 `__package__`가 `None`이 되어 버립니다. 상대 임포트는 `__package__`를 기준으로 경로를 계산하므로 패키지 정보가 없으면 동작하지 않습니다.

올바른 실행 방법은 두 가지입니다.

```bash
# 방법 1: -m 플래그 (패키지 맥락 유지)
python -m myapp.core.engine

# 방법 2: myapp/__main__.py 에서 진입
python -m myapp
```

![상대 임포트 주의사항](/assets/posts/python-relative-vs-absolute-import-pitfalls.svg)

## PEP 8이 절대 임포트를 권장하는 이유

PEP 8은 **절대 임포트를 기본**으로 권장하고, 상대 임포트는 패키지 내부에서 절대 임포트가 장황해질 때만 허용합니다.

절대 임포트의 장점:

- 어디서 실행해도 동일하게 동작(이식성)
- 패키지 이름을 보면 출처가 즉시 파악됨(가독성)
- IDE 지원(자동완성, 타입 추론)이 완벽에 가까움

상대 임포트가 쓸모 있는 경우:

- 패키지를 다른 이름으로 재배포할 계획이 있을 때
- 깊은 중첩 구조에서 `myapp.core.plugins.cache.backend`처럼 경로가 극단적으로 길 때

```python
# 상대 임포트가 합리적인 예
# myapp/utils/string_helpers.py
from . import validators      # 같은 utils/ 내부 모듈
from ._internal import _fast  # 내부 구현 세부사항
```

## 혼용 시 주의

같은 파일에서 절대·상대 임포트를 혼용해도 오류는 아니지만, 가독성이 나빠집니다. 하나의 파일은 한 가지 스타일로 통일하는 것이 낫습니다.

```python
# 혼용 (권장하지 않음)
import os
from . import utils
from myapp.core import engine

# 통일 (권장)
import os
from myapp import utils
from myapp.core import engine
```

## `__future__` 와 Python 2 잔재

Python 2에서는 `from __future__ import absolute_import`가 필요했습니다. Python 3에서는 절대 임포트가 기본이므로 이 선언은 불필요합니다. 오래된 코드를 보수할 때 제거해도 됩니다.

---

**지난 글:** [Python 모듈 검색 경로: sys.path 완전 정복](/posts/python-module-search-path/)

**다음 글:** [패키지와 __init__.py](/posts/python-package-init-py/)

<br>
읽어주셔서 감사합니다. 😊
