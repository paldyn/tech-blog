---
title: "importlib로 동적 임포트: 런타임 모듈 로딩"
description: "importlib.import_module(), importlib.util.find_spec(), importlib.reload()를 활용한 동적 임포트, 플러그인 로더 구현, 선택적 의존성 처리 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 6
type: "knowledge"
category: "Python"
tags: ["python", "importlib", "동적임포트", "플러그인", "find_spec", "reload"]
featured: false
draft: false
---

[지난 글](/posts/python-circular-import/)에서 순환 임포트를 다뤘습니다. 이번에는 `import` 문 대신 코드에서 직접 모듈을 로드하는 **동적 임포트**를 살펴봅니다. 설정 파일로 플러그인을 교체하거나, 선택적 의존성을 처리하거나, 개발 중에 모듈을 재로드하는 상황에서 `importlib`가 강력한 도구가 됩니다.

## importlib.import_module()

`import` 문의 프로그래밍 인터페이스입니다. 모듈 이름을 **문자열**로 받아 모듈 객체를 반환합니다.

```python
import importlib

# import json 과 동일한 효과
mod = importlib.import_module("json")
data = mod.loads('{"key": "value"}')

# from myapp.core import Engine 과 동일
Engine = importlib.import_module("myapp.core").Engine

# 또는 getattr 활용
core = importlib.import_module("myapp.core")
Engine = getattr(core, "Engine")
```

상대 경로도 지원합니다. `package` 인수에 현재 패키지를 전달하면 됩니다.

```python
# 현재 패키지 안에서 .utils 임포트
utils = importlib.import_module(".utils", package=__package__)
```

![importlib 동적 임포트 개요](/assets/posts/python-importlib-dynamic-overview.svg)

## importlib.util.find_spec()

모듈을 실제로 **로드하지 않고** 존재 여부만 확인합니다. 설치 여부에 따라 다른 코드 경로를 선택할 때 유용합니다.

```python
from importlib.util import find_spec

def get_json_parser():
    if find_spec("orjson") is not None:
        import orjson
        return orjson.loads  # 빠른 구현
    else:
        import json
        return json.loads    # 표준 라이브러리 폴백
```

`find_spec()`은 `None`을 반환하면 없는 것, `ModuleSpec` 객체를 반환하면 있는 것입니다.

```python
spec = find_spec("numpy")
if spec:
    print(spec.origin)      # /usr/lib/python3.x/site-packages/numpy/__init__.py
    print(spec.name)        # 'numpy'
    print(spec.submodule_search_locations)  # 패키지이면 경로 목록
```

## 플러그인 로더 구현

`importlib.import_module()`의 가장 강력한 활용은 **런타임 플러그인 로딩**입니다.

![플러그인 로더 구현 패턴](/assets/posts/python-importlib-dynamic-plugin.svg)

```python
# plugin_loader.py
import importlib
from importlib.util import find_spec

def load_backend(name: str):
    """
    name: 'sql', 'rest', 'redis' 등
    각 백엔드는 myapp.backends.{name} 에 Backend 클래스를 정의
    """
    module_path = f"myapp.backends.{name}"
    if find_spec(module_path) is None:
        raise ImportError(f"Backend '{name}' not found")
    mod = importlib.import_module(module_path)
    return mod.Backend()  # 각 모듈이 Backend 클래스를 노출
```

```python
# main.py
backend_name = config.get("backend", "sql")  # 설정에서 읽음
backend = load_backend(backend_name)
backend.connect()
```

이 패턴으로 코드 변경 없이 설정만 바꿔 다른 백엔드를 사용할 수 있습니다.

## importlib.reload()

이미 로드된 모듈을 **재실행**합니다. 개발 중 파일을 수정하고 인터프리터를 재시작하지 않고 변경사항을 적용할 때 씁니다.

```python
import importlib
import mymodule

# mymodule.py 파일을 수정한 후
importlib.reload(mymodule)  # 다시 로드
```

주의사항:

- `reload()`는 모듈을 새로 실행하지만, **이미 `from mymodule import func`로 가져온 이름은 갱신되지 않습니다**.
- 모듈 객체 자체는 같은 객체이므로 `reload()` 이후에도 기존 참조는 유효합니다.

```python
from mymodule import greet  # greet가 변경 전 함수를 가리킴

importlib.reload(mymodule)  # 모듈 재로드

greet()           # 여전히 구버전 함수 실행!
mymodule.greet()  # 새 버전 실행
```

## 파일 경로로 모듈 로드

패키지 외부의 파일을 경로로 직접 임포트하는 것도 가능합니다.

```python
import importlib.util, sys

spec = importlib.util.spec_from_file_location(
    "my_plugin",
    "/opt/plugins/my_plugin.py"
)
mod = importlib.util.module_from_spec(spec)
sys.modules["my_plugin"] = mod  # 캐시에 등록
spec.loader.exec_module(mod)    # 실행

mod.run()  # 사용
```

플러그인을 파일 시스템 경로로 배포하는 시스템에서 유용합니다.

## __import__() 대신 importlib

`__import__("json")`처럼 내장 `__import__()` 함수를 직접 쓰는 코드를 종종 볼 수 있습니다. `importlib.import_module()`이 더 명확하고 권장되는 방식입니다. `__import__()`는 저수준 인터페이스로, 반환 값이 직관적이지 않습니다.

```python
# 이렇게 쓰지 마세요
mod = __import__("json")  # 최상위 패키지 반환

# 이렇게 쓰세요
import importlib
mod = importlib.import_module("json")  # 명확
```

---

**지난 글:** [순환 임포트와 해결법](/posts/python-circular-import/)

**다음 글:** [if __name__ == "__main__" 이디엄](/posts/python-name-main-idiom/)

<br>
읽어주셔서 감사합니다. 😊
