---
title: "모듈 캐싱과 sys.modules: 한 번만 로드되는 이유"
description: "Python sys.modules 캐시 동작 원리, importlib.reload() 한계와 올바른 사용법, __pycache__ 바이트코드 캐시 구조를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 8
type: "knowledge"
category: "Python"
tags: ["python", "sys.modules", "모듈캐시", "importlib.reload", "__pycache__", "바이트코드"]
featured: false
draft: false
---

[지난 글](/posts/python-name-main-idiom/)에서 `__name__` 이디엄을 살펴봤습니다. 이번에는 `import` 문이 같은 모듈을 여러 번 써도 파일이 한 번만 실행되는 이유, 즉 **모듈 캐싱** 메커니즘을 알아봅니다.

## sys.modules: 캐시의 핵심

`sys.modules`는 모듈 이름을 키, 모듈 객체를 값으로 하는 딕셔너리입니다. Python이 `import`를 실행할 때 가장 먼저 이곳을 확인합니다.

```python
import sys

# import 전
print("json" in sys.modules)  # False

import json

# import 후
print("json" in sys.modules)  # True
print(sys.modules["json"])     # <module 'json' from '...'>
```

같은 모듈을 100번 임포트해도 `sys.modules`에 있으면 파일 실행 없이 즉시 반환됩니다. 이 덕분에 임포트가 빠르고, 모듈 레벨 전역 상태가 프로그램 전체에서 공유됩니다.

![모듈 캐싱 개요](/assets/posts/python-module-caching-overview.svg)

## 싱글턴 효과

모듈 레벨 객체가 캐시 덕분에 사실상 싱글턴처럼 동작합니다.

```python
# counter.py
count = 0

def increment():
    global count
    count += 1
```

```python
# a.py
import counter
counter.increment()
print(counter.count)  # 1
```

```python
# b.py
import counter          # 동일한 객체! (새 로드 아님)
print(counter.count)   # 1 (a.py에서 증가시킨 값 그대로)
```

설정 모듈, 로깅 설정, 레지스트리 등을 모듈 레벨에서 관리하는 패턴이 이를 활용합니다.

## importlib.reload()

파일을 수정하고 재시작 없이 변경사항을 적용하려면 `reload()`를 씁니다.

```python
import importlib
import mymod

# mymod.py 파일 수정 후
importlib.reload(mymod)
```

`reload()`는 모듈 파일을 다시 실행하고 모듈 객체의 속성을 갱신합니다. 그러나 중요한 제한이 있습니다.

![importlib.reload() 동작과 주의사항](/assets/posts/python-module-caching-reload.svg)

**`from module import name` 으로 이미 가져온 이름은 갱신되지 않습니다.**

```python
from mymod import greet  # greet는 구버전 함수 객체를 직접 가리킴

importlib.reload(mymod)  # 모듈 재로드

greet()        # 여전히 구버전! (greet 변수가 새 함수를 가리키지 않음)
mymod.greet()  # 새버전 (모듈 속성 접근이라 갱신된 것)
```

`reload()` 후에는 `from` 임포트로 가져온 이름을 다시 바인딩해야 합니다.

```python
importlib.reload(mymod)
from mymod import greet  # 다시 바인딩
greet()  # 이제 새버전
```

## sys.modules 직접 조작

테스트나 플러그인 시스템에서 `sys.modules`를 직접 건드리는 일이 있습니다.

```python
import sys

# 모듈 캐시 강제 삭제 → 다음 import 시 재로드
del sys.modules["mymod"]

# None 등록 → import 시 ImportError 강제 발생
# (테스트에서 "이 패키지가 없는 환경" 시뮬레이션)
sys.modules["numpy"] = None

try:
    import numpy  # ImportError: import of 'numpy' halted
except ImportError:
    print("numpy 없음")
```

가짜 모듈을 등록하는 것도 가능합니다. pytest의 `monkeypatch` 픽스처나 `unittest.mock.patch`가 이 방식으로 모듈을 교체합니다.

## __pycache__와 .pyc 파일

Python은 `.py` 파일을 처음 임포트할 때 바이트코드로 컴파일해 `__pycache__/` 디렉터리에 저장합니다.

```
myapp/
  __pycache__/
    utils.cpython-312.pyc   ← 컴파일된 바이트코드
  utils.py
```

파일명에 `cpython-312`처럼 인터프리터 버전이 포함되어, CPython 3.12로 컴파일된 파일은 3.11에서 사용되지 않습니다.

다음 번에 임포트할 때 Python은:
1. `.py` 파일의 수정 시각과 크기를 `.pyc`에 기록된 값과 비교
2. 일치하면 `.pyc`를 직접 로드(컴파일 생략 → 빠름)
3. 불일치하면 `.py`를 다시 컴파일

```bash
# .pyc 생성 억제
python -B script.py
# 또는 환경변수
PYTHONDONTWRITEBYTECODE=1 python script.py
```

`.pyc` 파일을 `.gitignore`에 추가하는 것이 관례입니다(`__pycache__/` 디렉터리 전체).

## .pyc 직접 배포

소스를 숨기고 바이트코드만 배포할 수도 있습니다. `compileall` 모듈로 일괄 컴파일합니다.

```bash
python -m compileall myapp/
# __pycache__/*.pyc 생성

# .py 파일 없이 .pyc만 배포
# 단, 디컴파일 도구로 역분석이 가능하므로 완전한 난독화는 아님
```

---

**지난 글:** [if __name__ == "__main__" 이디엄](/posts/python-name-main-idiom/)

**다음 글:** [조건부 임포트](/posts/python-conditional-import/)

<br>
읽어주셔서 감사합니다. 😊
