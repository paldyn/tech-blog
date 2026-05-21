---
title: "readline vs readlines: 파일 읽기 방법 완전 비교"
description: "Python 파일 읽기 메서드 read·readline·readlines와 for 반복자의 차이를 완전히 비교합니다. 메모리 사용량, 줄 처리 방식, 대용량 파일 스트리밍, 개행 문자 제거 패턴까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 5
type: "knowledge"
category: "Python"
tags: ["Python", "파일읽기", "readline", "readlines", "대용량파일", "스트리밍", "파일입출력"]
featured: false
draft: false
---

[지난 글](/posts/python-file-encoding/)에서 인코딩 문제를 살펴봤다. 파일을 올바른 인코딩으로 열었다면 이제 내용을 읽어야 한다. Python은 파일 내용을 읽는 방법을 여러 가지 제공한다. `read()`, `readline()`, `readlines()`, 그리고 파일 객체를 직접 반복하는 방법이다. 각각 메모리 사용 방식이 다르므로, 상황에 맞게 선택해야 한다.

## 네 가지 읽기 방법

![파일 읽기 방법 4가지 비교](/assets/posts/python-readline-vs-readlines-overview.svg)

### `read()` — 전체를 한 번에

파일 전체 내용을 하나의 `str`로 반환한다. 사용이 간편하지만 파일 크기만큼 메모리를 소비한다.

```python
with open("config.json", encoding="utf-8") as f:
    content = f.read()    # → str, 파일 전체

# 크기 제한: read(n) — n바이트만 읽기
with open("large.txt", encoding="utf-8") as f:
    first_100 = f.read(100)    # 처음 100자
```

소용량 파일(설정 파일, JSON, 짧은 텍스트)에는 `read()`가 가장 간편하다. 100MB가 넘는 파일에는 쓰지 않는 편이 좋다.

### `readline()` — 한 줄씩

매번 호출할 때마다 다음 한 줄을 반환한다. EOF에 도달하면 빈 문자열 `''`을 반환한다. 반환된 문자열에는 개행 문자(`\n`)가 포함된다.

```python
with open("data.txt", encoding="utf-8") as f:
    line1 = f.readline()    # 첫 번째 줄 + '\n'
    line2 = f.readline()    # 두 번째 줄 + '\n'
    line3 = f.readline()    # EOF면 ''

# 반복 루프 패턴
with open("data.txt", encoding="utf-8") as f:
    while True:
        line = f.readline()
        if not line:        # EOF 감지
            break
        process(line.rstrip("\n"))
```

`readline()`은 파일 포인터를 직접 제어하거나 첫 번째 줄(헤더)만 읽고 싶을 때 유용하다. 그 외에는 `for` 루프가 더 파이써닉하다.

### `readlines()` — 전체를 리스트로

파일 전체를 읽어 줄 단위로 나눈 `list[str]`을 반환한다. 각 원소에 개행 문자가 포함된다.

```python
with open("data.txt", encoding="utf-8") as f:
    lines = f.readlines()    # → ['line1\n', 'line2\n', 'line3']

print(len(lines))            # 총 줄 수
print(lines[-1])             # 마지막 줄
print(lines[5])              # 6번째 줄 (인덱스 접근)
```

`readlines()`는 특정 인덱스의 줄에 접근하거나 줄 수를 세야 할 때 쓴다. 파일 전체를 메모리에 올리므로 대용량 파일에는 부적합하다.

### `for` 루프 — 반복자 (가장 파이써닉)

파일 객체는 반복자(iterator)이므로 `for` 루프에서 직접 사용할 수 있다. 내부적으로 `readline()`을 호출하며, 한 번에 한 줄씩만 메모리에 올린다.

```python
# 가장 권장되는 방법
with open("large.log", encoding="utf-8") as f:
    for line in f:
        line = line.rstrip("\n")   # 개행 제거
        if "ERROR" in line:
            print(line)
```

10GB 로그 파일도 메모리 부족 없이 처리할 수 있다. 한 줄의 크기만큼만 메모리를 사용한다.

## 실전 대용량 파일 처리

![대용량 파일 처리 패턴](/assets/posts/python-readline-vs-readlines-code.svg)

## 개행 문자 제거 패턴

`readline()`과 `for` 루프로 읽은 줄에는 `\n`이 붙어있다. 마지막 줄은 `\n` 없이 끝날 수도 있다.

```python
line = "  hello world\n"

line.strip()        # → 'hello world'   (앞뒤 공백+개행 제거)
line.rstrip()       # → '  hello world' (뒤만 제거, 앞 공백 유지)
line.rstrip("\n")   # → '  hello world' (개행만 제거)
line.rstrip("\r\n") # → '  hello world' (CRLF/LF 모두)
```

들여쓰기가 있는 코드 파일이나 데이터를 처리할 때는 `rstrip("\n")`을 선호한다. `strip()`은 앞의 공백까지 제거해 의도치 않은 결과를 낼 수 있다.

## 처음 N줄만 읽기

```python
from itertools import islice

# 처음 100줄만 읽기
with open("huge.csv", encoding="utf-8") as f:
    header = next(f).strip()                    # 헤더 한 줄
    first_99 = [line.strip() for line in islice(f, 99)]

# readline()으로 N줄
with open("data.txt", encoding="utf-8") as f:
    lines = [f.readline().rstrip("\n") for _ in range(10)]
```

## 이진 파일: 청크 단위 읽기

이진 파일은 줄 개념이 없으므로 `read(n)`으로 고정 크기 청크를 읽는다.

```python
CHUNK = 65536  # 64KB

with open("video.mp4", "rb") as f:
    while True:
        chunk = f.read(CHUNK)
        if not chunk:        # EOF: 빈 bytes 반환
            break
        process_chunk(chunk)

# 같은 코드, 왈러스 연산자 사용 (Python 3.8+)
with open("video.mp4", "rb") as f:
    while chunk := f.read(CHUNK):
        process_chunk(chunk)
```

## 방법별 사용 가이드

| 상황 | 권장 방법 |
|---|---|
| 소용량 텍스트 파일 전체 읽기 | `read()` |
| 대용량 텍스트 파일 줄 단위 처리 | `for line in f` |
| 헤더만 읽고 나머지 처리 | `readline()` + `for line in f` |
| 특정 줄 인덱스 접근 | `readlines()` |
| 이진 파일 청크 처리 | `read(n)` + `while` |
| CSV 처리 | `csv.reader(f)` (내부에서 `for` 사용) |

대부분의 경우 `for line in f`가 메모리 효율과 가독성 모두에서 최선이다. 처음 보는 코드에 `readlines()`가 있다면, 대용량 파일에서 문제가 될 수 있는지 검토해보자.

---

**지난 글:** [파일 인코딩: UTF-8부터 EUC-KR까지](/posts/python-file-encoding/)

**다음 글:** [write·flush·버퍼: 파일 쓰기의 내부 동작](/posts/python-write-flush-buffer/)

<br>
읽어주셔서 감사합니다. 😊
