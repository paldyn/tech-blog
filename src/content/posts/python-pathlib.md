---
title: "pathlib으로 경로 다루기: 객체지향 파일시스템 API"
description: "Python 3.4+ pathlib 모듈의 Path 객체 사용법을 정리합니다. / 연산자, glob, rglob, read_text, write_text, mkdir 등 실무에서 자주 쓰는 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["Python", "pathlib", "Path", "파일시스템", "표준라이브러리"]
featured: false
draft: false
---

[지난 글](/posts/python-os-module/)에서 `os` 모듈로 파일 시스템을 다루는 방법을 살펴봤습니다. `os.path.join("/home", "user", "file.txt")`처럼 함수 중심의 API는 읽기 불편할 때가 많습니다. Python 3.4에서 추가된 `pathlib` 모듈은 경로를 객체로 다루며 `/` 연산자로 이어 붙이는 직관적인 방식을 제공합니다.

## Path 객체 만들기

```python
from pathlib import Path

# 문자열로 생성
p = Path("/home/user/project/main.py")

# 현재 디렉토리
cwd = Path.cwd()

# 홈 디렉토리
home = Path.home()

# 현재 파일 기준 경로 (스크립트 내)
here = Path(__file__).parent
```

`Path()`는 플랫폼을 자동 감지하여 Linux/macOS에서는 `PosixPath`, Windows에서는 `WindowsPath` 인스턴스를 반환합니다. 코드는 둘 다 `Path`로 다루면 됩니다.

## / 연산자로 경로 연결

```python
base = Path("/home/user")
config = base / ".config" / "app" / "settings.json"
# → /home/user/.config/app/settings.json
```

`os.path.join(base, ".config", "app", "settings.json")`과 동일하지만 훨씬 읽기 쉽습니다. 오른쪽 피연산자가 문자열이어도 됩니다.

![pathlib.Path 속성과 메서드](/assets/posts/python-pathlib-api.svg)

## 경로 분해

```python
p = Path("/home/user/project/main.py")

p.name      # "main.py"
p.stem      # "main"
p.suffix    # ".py"
p.suffixes  # [".py"]  (예: "archive.tar.gz" → [".tar", ".gz"])
p.parent    # Path("/home/user/project")
p.parents   # 모든 상위 경로 시퀀스
p.parts     # ("/", "home", "user", "project", "main.py")
p.anchor    # "/"
```

확장자를 변경하려면 `with_suffix()`, 파일명을 교체하려면 `with_name()`을 씁니다.

```python
p.with_suffix(".pyc")   # /home/user/project/main.pyc
p.with_name("test.py")  # /home/user/project/test.py
p.with_stem("backup")   # /home/user/project/backup.py (3.9+)
```

## 존재 여부와 타입 확인

```python
p = Path("data/config.json")

p.exists()   # True / False
p.is_file()  # 일반 파일 여부
p.is_dir()   # 디렉토리 여부
p.is_symlink()  # 심볼릭 링크 여부
p.stat().st_size   # 파일 크기 (바이트)
p.stat().st_mtime  # 최종 수정 시각
```

## 디렉토리 탐색

```python
d = Path("/home/user/project")

# 직계 자식만
for child in d.iterdir():
    print(child.name)

# 현재 디렉토리의 .py 파일만
for py in d.glob("*.py"):
    print(py)

# 재귀 glob
for py in d.rglob("*.py"):
    print(py.relative_to(d))  # 상대 경로로 출력
```

`glob()`은 현재 디렉토리 수준만, `rglob("*.py")`는 `glob("**/*.py")`와 동일하게 모든 하위 디렉토리를 재귀 탐색합니다.

![pathlib 실전 코드 패턴](/assets/posts/python-pathlib-code.svg)

## 파일 읽기와 쓰기

```python
p = Path("notes.txt")

# 텍스트 읽기 (파일 열고 닫는 과정 자동)
text = p.read_text(encoding="utf-8")

# 바이너리 읽기
data = p.read_bytes()

# 텍스트 쓰기 (기존 내용 덮어씀)
p.write_text("Hello, World!\n", encoding="utf-8")

# 바이너리 쓰기
p.write_bytes(b"\x00\x01\x02")
```

소규모 파일은 `read_text()` / `write_text()`가 가장 간결합니다. 대용량 파일이나 스트리밍이 필요하면 `p.open("r")`으로 파일 객체를 얻어서 처리합니다.

## 디렉토리 생성과 파일 삭제

```python
# 중첩 디렉토리 생성
Path("output/logs/2026").mkdir(parents=True, exist_ok=True)

# 파일 삭제
Path("temp.txt").unlink(missing_ok=True)  # 3.8+, 없어도 에러 없음

# 빈 디렉토리 삭제
Path("empty_dir").rmdir()

# 중첩 디렉토리 삭제는 shutil.rmtree() 사용
import shutil
shutil.rmtree("output")
```

## 절대 경로 변환

```python
p = Path("./src/../src/main.py")

p.resolve()     # 심볼릭 링크 해석 + 절대 경로
p.absolute()    # 절대 경로 (링크 해석 없음, 3.11+에서 권장)

# 상대 경로로 변환
abs_p = Path("/home/user/project/main.py")
abs_p.relative_to("/home/user")  # Path("project/main.py")
```

## 자주 쓰는 패턴 모음

```python
# 스크립트와 같은 디렉토리의 파일 참조
DATA_DIR = Path(__file__).parent / "data"
config_path = DATA_DIR / "config.json"

# 존재하는 .py 파일만 모으기
py_files = sorted(Path(".").rglob("*.py"))

# 파일 확장자별 분류
from collections import defaultdict
by_ext = defaultdict(list)
for f in Path(".").iterdir():
    if f.is_file():
        by_ext[f.suffix].append(f)
```

## os.path와 pathlib 비교 요약

| 작업 | os.path | pathlib |
|------|---------|---------|
| 경로 합치기 | `os.path.join(a, b)` | `Path(a) / b` |
| 파일명 | `os.path.basename(p)` | `p.name` |
| 확장자 | `os.path.splitext(p)[1]` | `p.suffix` |
| 존재 확인 | `os.path.exists(p)` | `p.exists()` |
| 파일 읽기 | `open(p).read()` | `p.read_text()` |
| 재귀 탐색 | `os.walk()` | `p.rglob("*")` |

`pathlib`이 더 읽기 쉽고 메서드 체이닝이 자연스럽습니다. 새 코드에서는 `pathlib`을 기본으로, `os.path`가 필요한 외부 라이브러리 인터페이스에서만 `str(path)`로 변환해 넘깁니다.

---

**지난 글:** [os 모듈 완전 정복: 파일·디렉토리·환경변수 다루기](/posts/python-os-module/)

**다음 글:** [sys 모듈: Python 인터프리터와 직접 대화하기](/posts/python-sys-module/)

<br>
읽어주셔서 감사합니다. 😊
