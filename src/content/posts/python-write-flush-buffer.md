---
title: "write·flush·버퍼: 파일 쓰기의 내부 동작"
description: "Python f.write()가 호출될 때 데이터가 실제로 디스크에 저장되기까지의 과정을 설명합니다. 버퍼링 레이어, flush()와 close()의 차이, 원자적 파일 쓰기 패턴, print(flush=True)까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 6
type: "knowledge"
category: "Python"
tags: ["Python", "파일쓰기", "버퍼링", "flush", "파일입출력", "원자적쓰기"]
featured: false
draft: false
---

[지난 글](/posts/python-readline-vs-readlines/)에서 파일 읽기 방법을 살펴봤다. 이번에는 **쓰기**를 다룬다. `f.write("data")`를 호출했을 때 데이터가 즉시 디스크에 저장되리라고 생각하기 쉽지만, 실제로는 그렇지 않다. 데이터는 여러 레이어의 버퍼를 거쳐야 비로소 디스크에 도달한다.

## 버퍼링 레이어 구조

![파일 쓰기 버퍼링 동작](/assets/posts/python-write-flush-buffer-overview.svg)

`f.write()`를 호출하면 데이터는 다음 경로를 거친다.

1. **Python 쓰기 버퍼**: Python의 `io` 레이어가 관리하는 메모리 버퍼. 기본적으로 8KB 단위로 묶어서 OS에 전달한다.
2. **OS 페이지 캐시**: 커널이 관리하는 메모리 영역. 빠른 I/O를 위해 쓰기를 일시적으로 보류한다.
3. **디스크**: 실제 영구 저장.

`f.write()`만 호출하면 데이터는 Python 버퍼에 있다. `f.flush()`를 호출하면 Python 버퍼 → OS 페이지 캐시로 이동한다. OS가 페이지 캐시를 디스크에 쓰는 것은 OS가 결정하며, `os.fsync(f.fileno())`로 강제할 수 있다.

## write() 기본 사용

```python
with open("output.txt", "w", encoding="utf-8") as f:
    f.write("첫 번째 줄\n")     # 버퍼에 쌓임
    f.write("두 번째 줄\n")     # 버퍼에 쌓임
    f.write("세 번째 줄\n")     # 버퍼에 쌓임
# with 블록 종료 시 close() 자동 호출 → flush() + 파일 닫기

# writelines: 리스트를 한 번에
lines = ["line1\n", "line2\n", "line3\n"]
with open("output.txt", "w", encoding="utf-8") as f:
    f.writelines(lines)   # 개행 문자를 직접 포함해야 함
```

`writelines()`는 리스트를 받지만 자동으로 개행을 추가하지 않는다. 각 원소에 `\n`이 포함돼 있어야 한다.

## flush()를 명시적으로 호출해야 하는 경우

```python
import sys
import time

# 로그 실시간 표시: print의 기본 동작
# 터미널: 줄 버퍼링 (\n 만나면 flush)
# 파이프/리다이렉트: 블록 버퍼링 (8KB 찰 때까지 보류)

# flush=True로 즉시 출력
for i in range(100):
    print(f"진행: {i:3d}%", end="\r", flush=True)
    time.sleep(0.05)

# 파일 로그 실시간 확인
with open("live.log", "w", encoding="utf-8") as f:
    for event in stream_events():
        f.write(f"{event}\n")
        f.flush()          # 다른 프로세스가 즉시 읽을 수 있게
```

## buffering 매개변수

```python
# buffering=-1 (기본): 시스템이 최적 버퍼 크기 결정
# buffering=0  : 버퍼 없음 (이진 모드만 허용)
# buffering=1  : 줄 버퍼링 (텍스트 모드만)
# buffering=N  : N바이트 블록 버퍼

# 줄 버퍼: \n마다 flush — 로그 파일에 유용
log = open("app.log", "a", encoding="utf-8", buffering=1)
log.write("서버 시작\n")    # \n에서 즉시 flush
log.write("요청 수신\n")    # \n에서 즉시 flush

# 버퍼 없음: 이진 모드 전용
raw = open("raw.bin", "wb", buffering=0)
raw.write(b"\x00\x01")     # 즉시 디스크
```

## close() vs flush()

```python
f = open("data.txt", "w", encoding="utf-8")
f.write("내용")
f.flush()    # Python 버퍼 → OS. 파일은 아직 열려있음
# f는 여전히 유효한 파일 객체

f.close()    # flush() + 파일 디스크립터 반환
# f.write("추가") → ValueError: I/O operation on closed file
```

`close()`는 `flush()`를 포함한다. `with` 문을 쓰면 블록 종료 시 자동으로 `close()`가 호출되므로 명시적으로 쓸 필요가 없다.

## 실전 패턴

![write · flush · print 실전 패턴](/assets/posts/python-write-flush-buffer-code.svg)

## 원자적 파일 쓰기

큰 파일을 쓰는 도중 크래시가 나면 파일이 불완전한 상태로 남는다. 이를 방지하는 패턴이 "임시 파일에 쓰고 원자적으로 교체(rename)"다.

```python
import os
import tempfile
from pathlib import Path

def safe_write(target_path: str, content: str, encoding: str = "utf-8") -> None:
    """쓰기 중 크래시로 인한 파일 손상을 방지하는 원자적 쓰기"""
    p = Path(target_path)
    # 같은 디렉터리에 임시 파일 생성
    fd, tmp_path = tempfile.mkstemp(dir=p.parent, prefix=".tmp_")
    try:
        with os.fdopen(fd, "w", encoding=encoding) as f:
            f.write(content)
            f.flush()
            os.fsync(f.fileno())   # OS → 디스크 강제 동기화
        os.replace(tmp_path, target_path)   # 원자적 교체
    except Exception:
        os.unlink(tmp_path)        # 실패 시 임시 파일 삭제
        raise

safe_write("config.json", '{"version": 2}')
```

`os.replace()`는 POSIX에서 원자적 연산이다. 대상 파일이 있으면 교체하고, 없으면 생성한다. 이 연산 중 크래시가 나도 원본 파일은 손상되지 않는다.

## Python -u와 PYTHONUNBUFFERED

Docker, CI 환경에서 stdout 출력이 지연되거나 아예 안 보이는 경우가 있다. 파이프라인 연결 시 stdout이 블록 버퍼링 모드가 되기 때문이다.

```bash
# 버퍼링 비활성화 옵션
python -u app.py               # -u: unbuffered
PYTHONUNBUFFERED=1 python app.py  # 환경 변수
```

Dockerfile에서는 `ENV PYTHONUNBUFFERED=1`을 추가하면 로그가 실시간으로 보인다.

## 쓰기 성능과 버퍼

버퍼링이 없으면 매번 `write()`마다 시스템 콜이 발생한다. 수천 번의 작은 쓰기는 버퍼를 통해 묶어서 처리해야 빠르다.

```python
import time

# 버퍼 없음: 느림 (이진 모드에서만 가능)
with open("test.bin", "wb", buffering=0) as f:
    start = time.perf_counter()
    for _ in range(10000):
        f.write(b"x")
    print(f"버퍼 없음: {time.perf_counter()-start:.3f}s")

# 기본 버퍼: 빠름
with open("test.bin", "wb") as f:
    start = time.perf_counter()
    for _ in range(10000):
        f.write(b"x")
    print(f"기본 버퍼: {time.perf_counter()-start:.3f}s")
# 버퍼 없음이 10배 이상 느린 경우가 많음
```

---

**지난 글:** [readline vs readlines: 파일 읽기 방법 완전 비교](/posts/python-readline-vs-readlines/)

**다음 글:** [seek·tell: 파일 포인터로 임의 위치 읽기·쓰기](/posts/python-seek-tell/)

<br>
읽어주셔서 감사합니다. 😊
