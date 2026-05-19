---
title: "glob과 fnmatch: 파일 패턴 매칭"
description: "Python glob과 fnmatch 모듈의 패턴 매칭 기능을 설명합니다. *, ?, [], ** 와일드카드 패턴, iglob, fnmatch.filter, fnmatch.translate 등 실무 활용법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 6
type: "knowledge"
category: "Python"
tags: ["Python", "glob", "fnmatch", "파일탐색", "패턴매칭", "표준라이브러리"]
featured: false
draft: false
---

[지난 글](/posts/python-subprocess/)에서 외부 프로세스를 실행하는 `subprocess` 모듈을 살펴봤습니다. 이번에는 파일 시스템에서 이름 패턴으로 파일을 탐색하는 `glob`과, 문자열 자체에 패턴 매칭을 적용하는 `fnmatch`를 다룹니다. 이 두 모듈은 `*.py`, `data_??.csv` 같은 쉘 스타일 와일드카드를 Python에서 그대로 사용하게 해줍니다.

## glob 모듈 기본

```python
import glob

# 현재 디렉토리의 .py 파일 목록 (리스트 반환)
py_files = glob.glob("*.py")

# 특정 디렉토리 아래
configs = glob.glob("config/*.json")

# 문자 선택
logs = glob.glob("log_[0-9][0-9].txt")  # log_01.txt ~ log_99.txt
```

`glob.glob()`은 쉘의 파일 확장(file globbing)과 동일한 방식으로 파일시스템을 탐색하여 일치하는 경로 목록을 반환합니다. 숨김 파일(`.`으로 시작하는 파일)은 기본적으로 포함하지 않습니다.

![glob / fnmatch 패턴 표](/assets/posts/python-glob-fnmatch-patterns.svg)

## 재귀 탐색 — **

```python
import glob

# 모든 하위 디렉토리의 .py 파일 (recursive=True 필수)
all_py = glob.glob("**/*.py", recursive=True)

# src 아래 모든 파일
all_files = glob.glob("src/**", recursive=True)
```

`**`는 Python 3.5부터 지원하며, `recursive=True`를 반드시 함께 전달해야 합니다. 빠뜨리면 `**`가 두 레벨 이름을 의미하는 리터럴로 처리됩니다.

## iglob — 메모리 효율적인 이터레이터

```python
import glob

# glob()은 결과를 리스트로 한 번에 반환
# iglob()은 한 번에 하나씩 (제너레이터)
for path in glob.iglob("logs/**/*.log", recursive=True):
    process(path)
```

파일 수가 수만 개 이상이라면 `iglob()`로 메모리를 아낍니다. `pathlib`의 `rglob()`도 동일하게 제너레이터를 반환합니다.

## glob.glob vs pathlib.rglob

```python
# glob 방식
import glob
py1 = glob.glob("src/**/*.py", recursive=True)

# pathlib 방식
from pathlib import Path
py2 = list(Path("src").rglob("*.py"))
```

기능은 동일하지만 `pathlib`은 `Path` 객체를 반환하여 이후 `stem`, `parent` 등 속성 접근이 편합니다. 새 코드에서는 `pathlib.rglob()`이 권장됩니다.

## fnmatch — 파일명 문자열 매칭

`fnmatch`는 파일시스템에 접근하지 않고 **문자열**이 패턴에 일치하는지만 판별합니다.

```python
import fnmatch

fnmatch.fnmatch("report.csv", "*.csv")     # True
fnmatch.fnmatch("REPORT.CSV", "*.csv")    # True (대소문자 무시, Unix에서도)
fnmatch.fnmatch("report.csv", "report??.csv")  # False (2글자 필요, csv 앞)

# 대소문자 엄격 구분
fnmatch.fnmatchcase("REPORT.CSV", "*.csv")  # False
```

`fnmatch.fnmatch()`는 플랫폼에 따라 대소문자 처리가 다를 수 있습니다. 일관된 동작을 원하면 `fnmatchcase()`를 씁니다.

![glob / fnmatch 코드 패턴](/assets/posts/python-glob-fnmatch-code.svg)

## fnmatch.filter — 리스트 필터링

```python
import fnmatch

entries = ["main.py", "utils.py", "config.json", "test_main.py"]

# 패턴과 일치하는 항목만 추출
py_files = fnmatch.filter(entries, "*.py")
# ["main.py", "utils.py", "test_main.py"]

test_files = fnmatch.filter(entries, "test_*.py")
# ["test_main.py"]
```

`fnmatch.filter(names, pattern)`은 `[n for n in names if fnmatch(n, pattern)]`과 동일하지만 더 빠릅니다.

## fnmatch.translate — 정규식 변환

```python
import fnmatch, re

pattern = fnmatch.translate("*.py")
print(pattern)  # (?s:.*\.py)\Z

regex = re.compile(pattern)
print(bool(regex.match("hello.py")))  # True
```

`fnmatch.translate()`는 와일드카드 패턴을 정규식 문자열로 변환합니다. `re` 모듈과 결합하면 더 복잡한 매칭 로직을 구현할 수 있습니다.

## 실전 활용 — 백업 제외 패턴

```python
import glob
import fnmatch

EXCLUDE_PATTERNS = ["*.pyc", "__pycache__", ".git", "*.egg-info"]

def should_include(path: str) -> bool:
    name = path.split("/")[-1]
    return not any(fnmatch.fnmatch(name, p) for p in EXCLUDE_PATTERNS)

# 전체 파일 목록에서 제외 패턴 빼기
all_files = glob.glob("project/**", recursive=True)
included  = [f for f in all_files if should_include(f)]
```

## 정리

| 도구 | 사용 시점 |
|------|-----------|
| `glob.glob()` | 파일시스템 탐색, 결과를 리스트로 받을 때 |
| `glob.iglob()` | 파일 수가 많아 메모리 절약이 필요할 때 |
| `pathlib.glob/rglob()` | 탐색 후 Path 속성이 필요할 때 (권장) |
| `fnmatch.fnmatch()` | 이미 가진 문자열이 패턴에 맞는지 확인할 때 |
| `fnmatch.filter()` | 리스트에서 패턴 일치 항목 추출할 때 |

---

**지난 글:** [subprocess: 외부 프로세스 실행하기](/posts/python-subprocess/)

**다음 글:** [tempfile: 임시 파일과 디렉토리 안전하게 다루기](/posts/python-tempfile/)

<br>
읽어주셔서 감사합니다. 😊
