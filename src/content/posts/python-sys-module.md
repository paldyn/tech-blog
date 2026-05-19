---
title: "sys 모듈: Python 인터프리터와 직접 대화하기"
description: "Python sys 모듈의 핵심 기능을 설명합니다. sys.argv, sys.path, sys.exit, sys.stdin/stdout/stderr, sys.version_info 등 실무에서 자주 쓰는 속성과 함수를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 3
type: "knowledge"
category: "Python"
tags: ["Python", "sys", "인터프리터", "argv", "sys.path", "표준라이브러리"]
featured: false
draft: false
---

[지난 글](/posts/python-pathlib/)에서 `pathlib`으로 경로를 객체지향적으로 다루는 법을 살펴봤습니다. 이번에는 Python 인터프리터 자체와 직접 상호작용하는 `sys` 모듈을 정리합니다. 커맨드라인 인수 파싱, 모듈 검색 경로 조작, 프로세스 종료 코드 제어 등 스크립트 작성에 없어서는 안 될 도구들입니다.

## sys 모듈 개요

`sys` 모듈은 Python 인터프리터가 제공하는 변수와 함수에 접근하는 창구입니다. 크게 네 영역으로 나뉩니다.

```python
import sys

print(sys.version)       # 3.11.2 (main, ...) [GCC ...]
print(sys.version_info)  # sys.version_info(major=3, minor=11, ...)
print(sys.platform)      # 'linux' | 'darwin' | 'win32'
print(sys.executable)    # /usr/bin/python3  (현재 인터프리터 경로)
```

![sys 모듈 구성 요소](/assets/posts/python-sys-module-overview.svg)

## sys.argv — 커맨드라인 인수

```python
# python greet.py Alice 30
import sys

script = sys.argv[0]  # "greet.py"
name   = sys.argv[1]  # "Alice"
age    = sys.argv[2]  # "30" (항상 문자열)

if len(sys.argv) < 3:
    print("Usage: greet.py <name> <age>", file=sys.stderr)
    sys.exit(1)

print(f"Hello, {name}! You are {age} years old.")
```

`sys.argv[0]`는 스크립트 파일 경로 (또는 인터프리터 호출 방식에 따라 `'-'`, `''`), 나머지가 순서대로 인수입니다. 복잡한 파싱은 표준 라이브러리의 `argparse` 모듈을 사용합니다.

## sys.path — 모듈 검색 경로

```python
import sys

# 기본 값 확인
for p in sys.path:
    print(p)

# 런타임에 경로 추가
sys.path.insert(0, "/home/user/my_libs")

# 이제 /home/user/my_libs/mymodule.py를 import 가능
import mymodule
```

`sys.path`는 `import` 문이 실행될 때 모듈을 찾는 디렉토리 목록입니다. `PYTHONPATH` 환경변수와 `site-packages` 디렉토리가 여기에 포함됩니다. `insert(0, ...)`으로 최우선 순위를 부여할 수 있지만, 가능하면 가상 환경이나 `pip install`을 통해 경로를 관리하는 것이 더 깔끔합니다.

## sys.modules — 임포트 캐시

```python
import sys
import json

# 이미 임포트된 모듈은 sys.modules에 있음
print("json" in sys.modules)  # True

# 모듈 강제 재로드 (주의: 드물게 쓸 것)
del sys.modules["json"]
import json  # 다시 임포트됨
```

`sys.modules`는 모듈 이름을 키로, 모듈 객체를 값으로 갖는 딕셔너리입니다. 동일한 모듈을 여러 번 임포트해도 실제로는 한 번만 로드되는 이유가 여기에 있습니다.

## sys.exit() — 프로세스 종료

```python
import sys

# 정상 종료 (exit code 0)
sys.exit(0)

# 오류 종료 (exit code 1)
sys.exit(1)

# 문자열 전달 시 stderr에 출력 후 종료
sys.exit("Fatal error: cannot connect to database")
```

`sys.exit()`는 `SystemExit` 예외를 발생시킵니다. `except SystemExit`로 잡을 수 있지만 일반적으로는 잡지 않습니다. `os._exit()`은 클린업 없이 즉시 종료하므로 정상적인 상황에서는 `sys.exit()`을 씁니다.

## sys.stdin / sys.stdout / sys.stderr

```python
import sys

# stdout 대신 stderr에 출력 (로그·오류 분리)
print("ERROR: file not found", file=sys.stderr)

# stdin에서 라인 읽기 (파이프 처리)
for line in sys.stdin:
    process(line.rstrip())

# stdout 버퍼 즉시 비우기
sys.stdout.flush()

# stdout을 파일로 교체 (테스트 등에 활용)
import io
sys.stdout = io.StringIO()
print("captured")
output = sys.stdout.getvalue()
sys.stdout = sys.__stdout__  # 원래대로 복원
```

![sys 모듈 코드 패턴](/assets/posts/python-sys-module-code.svg)

## 버전 체크

```python
import sys

if sys.version_info < (3, 10):
    sys.exit("Python 3.10+ is required.")

# major, minor, micro 속성도 직접 접근 가능
major = sys.version_info.major  # 3
minor = sys.version_info.minor  # 11
```

`sys.version_info`는 named tuple이라 `(major, minor, micro)` 튜플과 직접 비교할 수 있습니다.

## sys.getsizeof() — 객체 메모리 크기

```python
import sys

print(sys.getsizeof(42))         # 28
print(sys.getsizeof("hello"))    # 54
print(sys.getsizeof([1, 2, 3]))  # 88
print(sys.getsizeof({}))         # 64
```

`sys.getsizeof()`는 객체 자체가 차지하는 메모리를 반환합니다. 리스트나 딕셔너리의 경우 컨테이너 헤더만 포함하고 안의 요소들 크기는 포함하지 않습니다. 진짜 메모리 사용량이 필요하면 `tracemalloc`이나 `memory_profiler`를 씁니다.

## 자주 쓰는 sys 패턴

```python
import sys

# 스크립트 vs 모듈 구분 (sys.argv[0] 활용)
if sys.argv[0].endswith("pytest"):
    # 테스트 환경에서만 실행되는 코드
    pass

# 재귀 한계 일시 조정 (주의 필요)
old_limit = sys.getrecursionlimit()
sys.setrecursionlimit(5000)
try:
    deep_recursive_call()
finally:
    sys.setrecursionlimit(old_limit)
```

`sys.setrecursionlimit()`은 Python 콜 스택 크기를 바꾸지 않으므로 너무 높이 설정하면 운영체제 수준의 스택 오버플로가 발생할 수 있습니다. 기본값 1000을 크게 벗어나는 재귀는 반복문이나 명시적 스택으로 리팩토링하는 것이 더 안전합니다.

---

**지난 글:** [pathlib으로 경로 다루기: 객체지향 파일시스템 API](/posts/python-pathlib/)

**다음 글:** [shutil: 고수준 파일 복사·이동·압축](/posts/python-shutil/)

<br>
읽어주셔서 감사합니다. 😊
