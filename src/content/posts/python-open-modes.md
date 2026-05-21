---
title: "파일 열기 모드: open() 완전 정리"
description: "Python open() 함수의 r·w·a·x·b·+ 모드를 완전히 정리합니다. 각 모드의 동작 차이, 이진 모드, FileNotFoundError·FileExistsError 발생 조건, 실전 패턴까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 1
type: "knowledge"
category: "Python"
tags: ["Python", "파일입출력", "open", "파일모드", "이진모드", "표준라이브러리"]
featured: false
draft: false
---

[지난 글](/posts/python-hashlib/)에서 hashlib로 데이터를 해싱하는 방법을 살펴봤다. 이번 글부터는 파일 I/O 챕터를 시작한다. Python에서 파일을 다룰 때 가장 먼저 마주치는 것이 `open()` 함수다. `open()`은 단순해 보이지만 모드(mode) 조합에 따라 동작이 크게 달라지며, 잘못 고르면 기존 파일을 날려버리거나 예상치 못한 에러를 만난다.

## open() 기본 구조

```python
f = open(file, mode='r', buffering=-1, encoding=None,
         errors=None, newline=None, closefd=True, opener=None)
```

가장 자주 사용하는 인자는 `file`(경로), `mode`(모드), `encoding`(인코딩) 세 가지다. 나머지는 특수한 경우에만 필요하다.

```python
# 기본 사용 (with 문 권장)
with open("data.txt", "r", encoding="utf-8") as f:
    content = f.read()
```

`with` 문을 쓰면 블록을 빠져나올 때 자동으로 `f.close()`가 호출된다. 예외가 발생하더라도 파일이 안전하게 닫힌다.

## 모드 완전 정리

![open() 모드 완전 정리](/assets/posts/python-open-modes-overview.svg)

### 기본 모드 4개

**`'r'` — 읽기 전용 (기본값)**

파일이 없으면 `FileNotFoundError`가 발생한다. 파일 포인터는 파일 시작 위치에 놓인다. 쓰기는 불가능하다.

```python
with open("config.txt", "r", encoding="utf-8") as f:
    data = f.read()       # 전체 읽기
    # f.write("x")       # → UnsupportedOperation: not writable
```

**`'w'` — 쓰기 전용**

파일이 없으면 자동으로 생성한다. **파일이 이미 있으면 내용을 지우고 처음부터 다시 쓴다.** 데이터를 날리는 가장 흔한 실수가 `'r'` 대신 `'w'`를 잘못 사용하는 것이다.

```python
with open("output.txt", "w", encoding="utf-8") as f:
    f.write("새로운 내용\n")  # 기존 내용은 모두 삭제됨
```

**`'a'` — 추가 (append)**

파일이 없으면 생성, 있으면 파일 끝에 이어서 쓴다. 로그 파일처럼 내용을 누적해야 할 때 쓴다.

```python
import datetime

with open("app.log", "a", encoding="utf-8") as f:
    timestamp = datetime.datetime.now().isoformat()
    f.write(f"[{timestamp}] 서버 시작\n")
```

**`'x'` — 배타 생성 (exclusive creation)**

파일이 없을 때만 새로 만든다. 파일이 이미 존재하면 `FileExistsError`를 발생시킨다. 덮어쓰기를 방지해야 할 때 유용하다.

```python
try:
    with open("config.json", "x", encoding="utf-8") as f:
        f.write('{"version": 1}\n')
except FileExistsError:
    print("설정 파일이 이미 존재합니다. 건너뜁니다.")
```

### `+` 수식어: 읽기+쓰기 동시

**`'r+'`** — 읽기·쓰기 모두 가능. 파일이 없으면 에러, 있으면 내용 유지.

**`'w+'`** — 읽기·쓰기 모두 가능. 파일이 없으면 생성, 있으면 **기존 내용 삭제**.

```python
# r+ : 파일을 읽고 일부를 덮어쓸 때
with open("record.txt", "r+", encoding="utf-8") as f:
    content = f.read()
    f.seek(0)          # 처음으로 이동
    f.write(content.replace("OLD", "NEW"))
    f.truncate()       # 남은 데이터 잘라냄
```

`r+`는 `seek()`과 `truncate()`를 함께 써야 안전하게 편집이 된다. 복잡하므로 단순 교체는 `pathlib`의 `write_text()`를 쓰는 편이 낫다.

### `'b'` 수식어: 이진 모드

텍스트 모드(`'r'`, `'w'`, `'a'`)는 개행 문자를 플랫폼에 맞게 변환하고, 인코딩/디코딩을 수행한다. 이진 모드(`'rb'`, `'wb'`, `'ab'`)는 변환 없이 raw bytes를 그대로 다룬다.

```python
# 이미지 복사 (이진 모드 필수)
with open("photo.jpg", "rb") as src, open("copy.jpg", "wb") as dst:
    dst.write(src.read())

# 대용량 파일: 청크 단위로 처리
with open("large.bin", "rb") as src, open("out.bin", "wb") as dst:
    while chunk := src.read(65536):   # 64KB씩
        dst.write(chunk)
```

이미지·오디오·PDF·실행 파일 등 텍스트가 아닌 파일은 반드시 이진 모드를 써야 한다. 텍스트 모드로 열면 개행 변환 때문에 파일이 손상된다.

## 실전 패턴 코드

![open() 모드별 실전 코드](/assets/posts/python-open-modes-code.svg)

## encoding은 항상 명시하라

`open()`의 기본 `encoding`은 `locale.getpreferredencoding(False)`로 결정된다. Windows에서는 흔히 `cp949`, macOS/Linux에서는 `utf-8`이다.

```python
import locale
print(locale.getpreferredencoding(False))  # Windows: cp949, Linux: UTF-8
```

코드에 `encoding`을 명시하지 않으면 같은 파일이 OS에 따라 깨진다. **항상 `encoding="utf-8"`을 명시하는 습관**을 들이면 이 문제를 원천 차단할 수 있다.

```python
# ❌ 플랫폼 의존 — Windows에서 한글 깨짐 가능
with open("data.txt", "r") as f:
    content = f.read()

# ✅ 명시적 인코딩
with open("data.txt", "r", encoding="utf-8") as f:
    content = f.read()
```

Python 3.15부터는 `encoding` 미명시 시 `DeprecationWarning`이 발생할 예정이다.

## errors 매개변수

인코딩 오류 처리 방식을 결정한다.

```python
# 'strict'  (기본): UnicodeDecodeError 발생
# 'ignore'  : 오류 문자 건너뜀
# 'replace' : 오류 문자를 '?'로 대체

with open("messy.txt", "r", encoding="utf-8", errors="replace") as f:
    content = f.read()   # 깨진 바이트 → '?'로 치환
```

`errors="ignore"`는 데이터 손실이 발생하므로 디버깅용에만 쓴다.

## 모드 선택 요약

| 상황 | 모드 |
|---|---|
| 파일 읽기 | `'r'` |
| 파일 새로 쓰기 (덮어씀 허용) | `'w'` |
| 로그 누적, 끝에 추가 | `'a'` |
| 새 파일만 생성 (덮어씀 방지) | `'x'` |
| 이미지·바이너리 읽기/쓰기 | `'rb'` / `'wb'` |
| 파일 읽고 일부 수정 | `'r+'` + `seek` + `truncate` |

---

**지난 글:** [hashlib: 해시 함수와 암호화 기초](/posts/python-hashlib/)

**다음 글:** [with 문과 컨텍스트 매니저: 파일을 안전하게 열고 닫는 법](/posts/python-with-context/)

<br>
읽어주셔서 감사합니다. 😊
