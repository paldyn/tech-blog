---
title: "Python 모듈 검색 경로: sys.path 완전 정복"
description: "Python이 import 문 실행 시 모듈을 찾는 순서(sys.modules 캐시 → 내장 → sys.path), PYTHONPATH 환경변수, .pth 파일, site-packages 구조를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 1
type: "knowledge"
category: "Python"
tags: ["python", "sys.path", "PYTHONPATH", "모듈검색", "import", "site-packages"]
featured: false
draft: false
---

[지난 글](/posts/python-slots/)에서 `__slots__`로 클래스 메모리를 최적화하는 방법을 살펴봤습니다. 이번 글부터는 Python **모듈 시스템**을 깊이 파헤칩니다. `import` 한 줄이 실행될 때 Python 인터프리터가 어떤 경로를 어떤 순서로 탐색하는지, 그리고 그 경로를 어떻게 제어할 수 있는지 알아봅니다.

## import 실행 순서

`import mymodule`이라고 쓰면 Python은 아래 세 단계를 거칩니다.

1. **`sys.modules` 캐시 확인** — 이미 임포트된 모듈은 딕셔너리에 보관됩니다. 있으면 즉시 반환.
2. **내장 모듈 확인** — `sys.builtin_module_names`에 등록된 C 확장 모듈(`sys`, `builtins` 등) 탐색.
3. **`sys.path` 순차 탐색** — 파일 시스템에서 `.py`, `.pyc`, 디렉터리(패키지) 순으로 검색.

모든 경로에서 발견되지 않으면 `ModuleNotFoundError`가 발생합니다.

![Python 모듈 검색 경로 overview](/assets/posts/python-module-search-path-overview.svg)

## sys.path 구성 요소

```python
import sys
import pprint

pprint.pprint(sys.path)
# ['',
#  '/usr/lib/python312.zip',
#  '/usr/lib/python3.12',
#  '/usr/lib/python3.12/lib-dynload',
#  '/home/user/.local/lib/python3.12/site-packages',
#  '/usr/local/lib/python3.12/dist-packages']
```

각 항목의 의미:

| 항목 | 설명 |
|---|---|
| `''` (빈 문자열) | 현재 작업 디렉터리(스크립트가 있는 곳) |
| `PYTHONPATH` | 환경변수로 지정한 디렉터리 목록 |
| 표준 라이브러리 | `sys`·`os` 등 파이썬 설치 경로 |
| `site-packages` | `pip install`로 설치된 패키지 |

빈 문자열 `''`이 목록 맨 앞에 오기 때문에 현재 디렉터리가 항상 우선 탐색됩니다. 이 때문에 표준 라이브러리와 같은 이름의 파일(`os.py`, `json.py`)을 프로젝트 루트에 두면 표준 라이브러리가 가려지는 문제가 생깁니다.

## sys.path 수정 방법

Python은 `sys.path`를 단순한 리스트로 노출하므로 런타임에 직접 수정할 수 있습니다.

```python
import sys

# 맨 앞에 추가 (우선순위 높음)
sys.path.insert(0, "/opt/mylibs")

# 맨 뒤에 추가 (우선순위 낮음)
sys.path.append("/home/user/extra")
```

그러나 코드 안에서 직접 수정하는 방식은 이식성이 떨어집니다. 더 깔끔한 방법들이 있습니다.

### PYTHONPATH 환경변수

```bash
# 셸에서 영구 설정 (콜론으로 여러 경로 구분)
export PYTHONPATH="/opt/mylibs:/home/user/lib"

# 한 번만 적용
PYTHONPATH=/tmp/debug python myscript.py
```

셸 프로파일(`~/.bashrc`, `~/.zshrc`)에 넣으면 모든 세션에서 자동으로 적용됩니다. 팀 환경에서는 각 개발자 로컬 설정이 달라질 수 있어 주의가 필요합니다.

### .pth 파일

`site-packages` 디렉터리에 `.pth` 확장자 파일을 두면 Python 시작 시 자동으로 `sys.path`에 추가됩니다.

```
# /usr/local/lib/python3.12/site-packages/mylibs.pth
/home/user/projects/mylibs
/opt/shared/libs
```

가상 환경 내 `site-packages`에 두면 해당 환경에서만 적용됩니다.

### pip install -e (editable 설치)

개발 중인 패키지를 테스트할 때는 `.pth` 파일을 직접 만들기보다 `pip install -e .`를 씁니다. `pyproject.toml`이 있는 루트에서 실행하면 패키지 소스 경로를 `sys.path`에 연결합니다.

```bash
pip install -e .
# 소스 변경이 즉시 반영됨 (재설치 불필요)
```

![sys.path 수정 방법 비교](/assets/posts/python-module-search-path-syspath.svg)

## sys.path 디버깅

모듈을 찾지 못하는 문제가 생겼을 때 가장 먼저 확인할 것들입니다.

```python
import sys

# 현재 경로 목록 확인
for i, p in enumerate(sys.path):
    print(f"[{i}] {p!r}")

# 특정 모듈이 어디에서 로드됐는지 확인
import mymodule
print(mymodule.__file__)

# 로드된 모든 모듈 캐시 확인
print(list(sys.modules.keys())[:10])
```

`__file__` 속성이 없으면 C 확장 내장 모듈입니다.

## 가상 환경과 sys.path

`venv`를 활성화하면 `sys.path`가 가상 환경 기준으로 재구성됩니다.

```bash
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate   # Windows

python -c "import sys; print(sys.path)"
# ['.venv/lib/python3.12/site-packages', ...]
```

전역 site-packages는 목록에서 제외되어 격리가 보장됩니다(`--system-site-packages` 옵션으로 포함시킬 수도 있습니다).

## 주의사항 정리

- `sys.path.insert(0, ...)` 남용은 임포트 순서를 뒤트는 버그를 만든다. 가급적 가상 환경 + editable install을 쓸 것.
- 스크립트 실행 방식(`python script.py` vs `python -m pkg.script`)에 따라 `sys.path[0]`이 달라진다.
- `PYTHONPATH`는 가상 환경을 우회할 수 있어 주의. 테스트 환경에서 의도치 않은 모듈이 로드될 수 있다.
- `importlib.util.find_spec("mymodule")`로 경로 탐색 없이 모듈 존재 여부만 확인할 수 있다.

---

**다음 글:** [상대 임포트 vs 절대 임포트](/posts/python-relative-vs-absolute-import/)

<br>
읽어주셔서 감사합니다. 😊
