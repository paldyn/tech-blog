---
title: "os 모듈 완전 정복: 파일·디렉토리·환경변수 다루기"
description: "Python os 모듈로 운영체제와 상호작용하는 법을 설명합니다. getcwd, makedirs, walk, environ, os.path 등 핵심 함수와 실무 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 1
type: "knowledge"
category: "Python"
tags: ["Python", "os", "파일시스템", "환경변수", "os.path"]
featured: false
draft: false
---

[지난 글](/posts/python-private-name-mangling/)에서 이름 맹글링과 `_`, `__` 접두사 관례를 살펴봤습니다. 이번에는 Python 표준 라이브러리의 핵심인 `os` 모듈로 넘어갑니다. 운영체제의 파일 시스템, 디렉토리, 환경변수, 프로세스 정보를 Python 코드 한 줄로 다루는 방법을 체계적으로 정리합니다.

## os 모듈이란?

`os` 모듈은 Python이 실행 중인 운영체제(Windows, macOS, Linux)와 인터페이스하는 표준 라이브러리입니다. 파일 시스템 조작, 환경변수 읽기·쓰기, 프로세스 정보 조회 등 OS 레벨의 기능을 플랫폼에 무관하게 동일한 API로 제공합니다.

```python
import os

# 기본 정보
print(os.name)       # 'posix' (Linux/macOS) 또는 'nt' (Windows)
print(os.sep)        # '/' 또는 '\\'
print(os.linesep)    # '\n' 또는 '\r\n'
```

`os.name`이 `'posix'`면 Unix 계열, `'nt'`면 Windows입니다. 이 값으로 플랫폼별 분기를 작성할 수 있지만, 대부분의 경우 os 모듈 내부가 이미 처리해 주므로 직접 분기할 일은 거의 없습니다.

![os 모듈 4대 영역](/assets/posts/python-os-module-overview.svg)

## 현재 디렉토리와 경로 탐색

```python
import os

# 현재 작업 디렉토리
cwd = os.getcwd()
print(cwd)   # /home/user/project

# 디렉토리 내용 목록
entries = os.listdir(".")
files = [e for e in entries if os.path.isfile(e)]
dirs  = [e for e in entries if os.path.isdir(e)]
```

`os.listdir()`는 숨김 파일(`.`으로 시작하는 항목)도 포함합니다. 정렬은 보장되지 않으므로 필요하다면 `sorted()`로 감쌉니다.

## 디렉토리 생성과 삭제

```python
# 단일 디렉토리 생성
os.mkdir("logs")

# 중첩 디렉토리 한 번에 생성
os.makedirs("a/b/c", exist_ok=True)

# 빈 디렉토리 삭제
os.rmdir("logs")

# 중첩 빈 디렉토리 제거
os.removedirs("a/b/c")
```

`exist_ok=True` 옵션 없이 이미 존재하는 경로로 `makedirs()`를 호출하면 `FileExistsError`가 발생합니다. 실무에서는 거의 항상 `exist_ok=True`를 함께 씁니다.

## 파일 조작

```python
# 파일 삭제
os.remove("old.txt")

# 파일 이름 변경 / 이동
os.rename("old.txt", "new.txt")
os.rename("file.txt", "subdir/file.txt")  # 이동도 됨

# 파일 메타데이터
stat = os.stat("file.txt")
print(stat.st_size)   # 바이트 크기
print(stat.st_mtime)  # 최종 수정 시각 (Unix timestamp)
```

`os.rename()`은 파일과 디렉토리 모두에 작동합니다. 단, 다른 파일시스템(마운트 포인트)을 넘어 이동하면 실패합니다. 이 경우 `shutil.move()`를 사용해야 합니다.

## os.walk — 트리 전체 순회

```python
import os

for root, dirs, files in os.walk("/home/user/project"):
    level = root.replace("/home/user/project", "").count(os.sep)
    indent = "  " * level
    print(f"{indent}{os.path.basename(root)}/")
    for fname in files:
        print(f"{indent}  {fname}")
```

`os.walk()`는 디렉토리 트리를 위에서 아래로 순회하며 `(root, dirs, files)` 튜플을 yield하는 제너레이터입니다. `dirs` 리스트를 제자리에서 수정하면 하위 방향을 제어할 수 있습니다.

```python
# 특정 디렉토리 건너뛰기
for root, dirs, files in os.walk("."):
    dirs[:] = [d for d in dirs if d != "__pycache__"]
    for f in files:
        print(os.path.join(root, f))
```

## 환경변수

```python
import os

# environ은 dict-like 매핑 객체
home = os.environ["HOME"]        # 없으면 KeyError
port = os.getenv("PORT", "8080") # 없으면 기본값 반환

# 현재 프로세스의 환경변수 설정
os.environ["DEBUG"] = "1"

# 삭제
del os.environ["DEBUG"]
# 또는
os.unsetenv("DEBUG")  # environ 딕셔너리 반영 안 됨 — del 사용 권장
```

`os.getenv()`가 `os.environ.get()`과 동일합니다. `None`을 반환하므로 `KeyError` 걱정 없이 안전하게 씁니다.

![os 모듈 코드 패턴](/assets/posts/python-os-module-code.svg)

## os.path — 경로 조작 서브모듈

```python
import os.path

p = "/home/user/project/main.py"

os.path.basename(p)   # "main.py"
os.path.dirname(p)    # "/home/user/project"
os.path.split(p)      # ("/home/user/project", "main.py")
os.path.splitext(p)   # ("/home/user/project/main", ".py")

os.path.join("/home/user", "project", "main.py")
# → "/home/user/project/main.py"

os.path.exists(p)     # True/False
os.path.isfile(p)     # True
os.path.isdir(p)      # False
os.path.abspath(".")  # 절대 경로로 변환
os.path.realpath(p)   # 심볼릭 링크 해석 후 절대 경로
```

`os.path.join()`은 경로 구분자를 플랫폼에 맞게 처리합니다. Windows에서는 `\`, Unix에서는 `/`를 사용합니다.

## 프로세스 정보

```python
import os

print(os.getpid())   # 현재 프로세스 ID
print(os.getppid())  # 부모 프로세스 ID
print(os.getlogin()) # 로그인된 사용자 이름
```

`os.system("ls -la")`는 쉘 명령을 실행하지만, 출력을 캡처하지 못하고 보안 위험이 있습니다. 외부 명령은 `subprocess.run()`을 사용하세요.

## os.scandir — listdir보다 효율적

```python
import os

with os.scandir(".") as it:
    for entry in it:
        if entry.is_file():
            print(entry.name, entry.stat().st_size)
```

`os.scandir()`은 `os.listdir()` + `os.stat()` 조합보다 훨씬 빠릅니다. 디렉토리를 열 때 inode 정보를 함께 가져오기 때문입니다. 대형 디렉토리를 탐색할 때는 반드시 `scandir()`을 택합니다.

## os 모듈 vs pathlib

| 기능 | os / os.path | pathlib |
|------|--------------|---------|
| 경로 생성 | `os.path.join(a, b)` | `Path(a) / b` |
| 존재 확인 | `os.path.exists(p)` | `Path(p).exists()` |
| 파일 읽기 | `open(p)` | `Path(p).read_text()` |
| 확장자 | `os.path.splitext(p)[1]` | `Path(p).suffix` |
| 순회 | `os.listdir()` | `Path(p).iterdir()` |

Python 3.4부터 `pathlib`이 표준 라이브러리에 포함되면서 경로 조작의 권장 방법이 바뀌었습니다. 그러나 레거시 코드, 빠른 일회성 스크립트, 혹은 특정 라이브러리와의 호환 때문에 `os.path`를 여전히 많이 만나게 됩니다. 두 가지 모두 읽을 줄 알아야 합니다.

---

**지난 글:** [이름 맹글링과 private 네임: _, __ 접두사 완전 정리](/posts/python-private-name-mangling/)

**다음 글:** [pathlib으로 경로 다루기: 객체지향 파일시스템 API](/posts/python-pathlib/)

<br>
읽어주셔서 감사합니다. 😊
