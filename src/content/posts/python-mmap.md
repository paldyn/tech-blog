---
title: "mmap: 메모리 맵 파일로 대용량 처리"
description: "Python mmap 모듈로 파일을 메모리처럼 직접 접근하는 방법을 설명합니다. OS 페이지 캐시 활용, 복사 없는 읽기·쓰기, 대용량 파일 고속 검색, 정규식 적용, 공유 메모리 패턴까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 9
type: "knowledge"
category: "Python"
tags: ["Python", "mmap", "메모리맵", "대용량파일", "고성능IO", "파일입출력", "표준라이브러리"]
featured: false
draft: false
---

[지난 글](/posts/python-pathlib-read-write/)에서 `pathlib`로 파일을 읽고 쓰는 현대적인 방법을 살펴봤다. 이번에는 한 단계 더 낮은 레벨, OS의 가상 메모리 시스템을 직접 활용하는 `mmap`을 다룬다. 수 GB 짜리 파일을 복사 없이 접근하거나, 여러 프로세스가 같은 파일을 공유할 때 `mmap`은 강력한 도구다.

## mmap이 특별한 이유

일반 `read()`는 디스크 → OS 페이지 캐시 → 앱 버퍼로 **두 번 복사**된다. `mmap`은 파일을 프로세스의 **가상 주소 공간에 직접 매핑**한다. 파일의 일부를 읽으면 OS가 해당 페이지만 디스크에서 로드하고, 앱은 그 메모리에 직접 접근한다.

![mmap — 메모리 맵 파일](/assets/posts/python-mmap-overview.svg)

이 방식의 장점은 다음과 같다.

1. **제로 복사**: 앱 버퍼로의 복사가 없다
2. **필요한 부분만 로드**: 10GB 파일이라도 접근한 페이지만 메모리에 올라간다
3. **OS 페이지 캐시 재사용**: 이미 읽힌 페이지는 캐시에서 즉시 반환된다
4. **슬라이싱·인덱싱 지원**: `bytes`처럼 `mm[100:200]`으로 접근 가능

## 기본 사용

```python
import mmap

# 읽기 전용
with open("large_data.bin", "rb") as f:
    mm = mmap.mmap(
        f.fileno(),          # 파일 디스크립터
        0,                   # 0 = 파일 전체 매핑
        access=mmap.ACCESS_READ
    )
    
    # bytes처럼 사용
    print(mm[0:4])           # 처음 4바이트
    print(mm.find(b"MAGIC")) # 패턴 위치 찾기
    mm.seek(1000)
    chunk = mm.read(50)      # seek+read도 가능
    
    mm.close()

# with 문으로 자동 close
with open("data.bin", "rb") as f:
    with mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ) as mm:
        data = mm[:]    # 전체 복사 (일반 bytes로)
```

## 대용량 파일 검색

```python
import mmap
import re

def grep_file(path: str, pattern: bytes) -> list[bytes]:
    """파일 전체를 mmap으로 열어 정규식 검색"""
    with open(path, "rb") as f:
        with mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ) as mm:
            return re.findall(pattern, mm)

# 10GB 로그 파일에서 에러 라인 추출
errors = grep_file("server.log", rb"ERROR.*?\n")
print(f"에러 수: {len(errors)}")

# 바이너리 시그니처 검색
with open("firmware.bin", "rb") as f:
    with mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ) as mm:
        pos = mm.find(b"\x7fELF")   # ELF 헤더 찾기
        if pos != -1:
            print(f"ELF 섹션 위치: {pos}")
```

## 쓰기 가능 mmap

![mmap 실전 패턴](/assets/posts/python-mmap-code.svg)

```python
import mmap

# r+b로 열어야 쓰기 가능
with open("database.bin", "r+b") as f:
    with mmap.mmap(f.fileno(), 0) as mm:
        # 읽기
        header = mm[:8]
        
        # 쓰기 (즉시 메모리에 반영, 나중에 디스크로)
        mm[0] = 0x89              # 1바이트 수정
        mm[4:8] = b"\x00\x00\x00\x01"   # 4바이트 슬라이스 교체
        
        # seek/write 인터페이스
        mm.seek(100)
        mm.write(b"updated data")
        
        mm.flush()    # OS 페이지 캐시 → 디스크 동기화
```

## 부분 매핑

```python
import mmap

# 파일의 특정 영역만 매핑 (대형 파일의 일부 처리)
PAGE_SIZE = mmap.PAGESIZE   # 일반적으로 4096

with open("huge.bin", "r+b") as f:
    # 오프셋은 PAGE_SIZE 배수여야 함
    offset = PAGE_SIZE * 100       # 100번째 페이지 = 409600 바이트
    length = PAGE_SIZE * 10        # 10 페이지 = 40960 바이트
    
    with mmap.mmap(f.fileno(), length, offset=offset) as mm:
        print(mm.size())           # 40960
        data = mm[:]               # 매핑된 영역 전체
```

## 프로세스 간 공유 메모리 (Unix)

```python
import mmap
import os

# Unix: MAP_SHARED + 익명 파일로 IPC
# 부모가 만들고 자식이 공유
mm = mmap.mmap(-1, 4096)  # -1 = 익명 메모리

pid = os.fork()
if pid == 0:   # 자식
    mm[0:5] = b"hello"
    os._exit(0)
else:           # 부모
    os.waitpid(pid, 0)
    print(mm[0:5])   # b"hello" — 자식이 쓴 값
    mm.close()
```

## 언제 mmap을 쓰나

| 적합 | 부적합 |
|---|---|
| 대용량 파일 일부 랜덤 접근 | 순차적으로 한 번만 읽는 경우 |
| 이진 파일 패턴 검색 | 소용량 파일 (<100MB) |
| 파일의 특정 위치 수정 | 텍스트 파일 줄 단위 처리 |
| 프로세스 간 공유 메모리 | 간단한 읽기·쓰기 작업 |

대용량 파일을 순차적으로 처리할 때는 `for line in f` 스트리밍이 더 단순하다. `mmap`의 진가는 **랜덤 접근**과 **이진 패턴 검색**에서 나타난다.

```python
# 성능 비교 개요
# read() 전체: 메모리 = 파일 크기, 시간 = 복사 포함
# mmap: 메모리 = 접근한 페이지만, 시간 = 복사 없음
# for line: 메모리 = O(한 줄), 시간 = 순차 최적화
```

---

**지난 글:** [pathlib로 파일 읽고 쓰기: 현대적인 파일 I/O](/posts/python-pathlib-read-write/)

**다음 글:** [줄 끝 문자: \n·\r\n·\r과 크로스 플랫폼 처리](/posts/python-line-endings/)

<br>
읽어주셔서 감사합니다. 😊
