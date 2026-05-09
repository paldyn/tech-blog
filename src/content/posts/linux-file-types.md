---
title: "리눅스 파일 유형 7가지: - d l c b p s"
description: "ls -l 첫 글자로 구분하는 7가지 파일 유형(일반·디렉터리·심볼릭링크·문자장치·블록장치·FIFO·소켓)의 특징과 확인 방법을 익힌다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 10
type: "knowledge"
category: "Linux"
tags: ["Linux", "파일유형", "ls", "file", "inode", "장치파일", "소켓"]
featured: false
draft: false
---

[지난 글](/posts/linux-hard-vs-soft-link/)에서 하드 링크와 심볼릭 링크의 차이를 살펴봤다. 이번에는 리눅스 파일 시스템이 다루는 **파일 유형 7가지**를 정리한다. 리눅스는 "모든 것은 파일이다"라는 철학 아래 하드웨어 장치, 프로세스 간 통신 채널, 소켓까지 파일로 표현한다. `ls -l` 출력의 첫 번째 문자를 읽을 줄 알면 시스템 전체가 더 명확하게 보인다.

## ls -l 로 유형 확인

```bash
ls -l /dev/sda /dev/tty /run/docker.sock /tmp
# brw-rw----  /dev/sda          → b: 블록 장치
# crw-rw-rw-  /dev/tty          → c: 문자 장치
# srw-rw----  /run/docker.sock  → s: 소켓
# drwxrwxrwt  /tmp              → d: 디렉터리
```

권한 문자열 10자리 중 **첫 번째 문자**가 파일 유형을 나타낸다.

## 7가지 파일 유형

![리눅스 파일 유형 7가지](/assets/posts/linux-file-types-overview.svg)

### `-` — 일반 파일

텍스트, 바이너리, 실행 파일, 이미지 등 가장 흔한 파일. `touch`, 편집기, `cp` 등으로 생성한다.

### `d` — 디렉터리

파일명 → inode 번호 매핑 테이블을 담는 특수 파일이다. `ls -la`로 보면 모든 디렉터리에 `.`(자신)과 `..`(부모)가 있다.

### `l` — 심볼릭 링크

대상 경로 문자열을 저장하는 파일. `ln -s target link`로 생성하며 `ls -l`에서 `→ target`으로 표시된다.

### `c` — 문자 장치 (Character Device)

문자 스트림 단위로 I/O하는 장치. `/dev/tty`(터미널), `/dev/null`, `/dev/random`, `/dev/urandom` 등이 대표적이다.

```bash
# /dev/null: 블랙홀 — 모든 입력을 버린다
command > /dev/null 2>&1

# /dev/random: 암호학적으로 안전한 난수
head -c 16 /dev/urandom | xxd
```

### `b` — 블록 장치 (Block Device)

블록 단위로 I/O하는 저장 장치. `/dev/sda`, `/dev/nvme0n1`, `/dev/loop0` 등이다. `lsblk`로 블록 장치 목록을 확인할 수 있다.

### `p` — 명명된 파이프 (Named Pipe / FIFO)

FIFO(First In, First Out) 방식의 단방향 IPC 채널이다. 익명 파이프(`|`)와 달리 파일시스템에 이름을 가진다.

```bash
mkfifo mypipe          # FIFO 생성
cat mypipe &           # 한 터미널에서 읽기 대기
echo "hello" > mypipe  # 다른 터미널에서 쓰기
```

### `s` — 소켓 (Socket)

양방향 IPC를 위한 Unix 도메인 소켓이다. 네트워크 소켓과 달리 파일 경로로 접근한다.

```bash
ls -la /run/*.sock /tmp/.mysql.sock
# s 로 시작하는 항목들
```

## 파일 유형 확인 명령어

![파일 유형 확인 명령어](/assets/posts/linux-file-types-commands.svg)

### file 명령 — 내용 기반 판별

`ls`는 inode의 유형 플래그를 보지만, `file`은 파일 **내용의 매직 바이트**를 분석해 실제 포맷을 판단한다.

```bash
file /bin/ls          # ELF 64-bit LSB executable
file /etc/hostname    # ASCII text
file image.png        # PNG image data
file archive.tar.gz   # gzip compressed data
file unknown          # 확장자 없어도 내용으로 판별
```

확장자를 신뢰할 수 없는 파일이나 미지의 바이너리를 검사할 때 유용하다.

### find -type — 유형별 검색

```bash
find /dev -type c        # 문자 장치
find /dev -type b        # 블록 장치
find /run -type s        # 소켓
find . -type l           # 심볼릭 링크
find /tmp -type p        # FIFO
```

### 스크립트에서 유형 확인

```bash
if [ -f "$path" ]; then
    echo "일반 파일"
elif [ -d "$path" ]; then
    echo "디렉터리"
elif [ -L "$path" ]; then
    echo "심볼릭 링크"
elif [ -S "$path" ]; then
    echo "소켓"
elif [ -p "$path" ]; then
    echo "FIFO"
elif [ -b "$path" ]; then
    echo "블록 장치"
elif [ -c "$path" ]; then
    echo "문자 장치"
fi
```

`-L` 체크는 `-f`보다 먼저 수행해야 한다. `-f`는 링크가 가리키는 파일을 따라가기 때문에 심볼릭 링크도 일반 파일로 판정될 수 있다.

## /dev 주요 특수 파일 정리

| 경로 | 유형 | 용도 |
|---|---|---|
| `/dev/null` | `c` | 출력 버리기 |
| `/dev/zero` | `c` | 0x00 스트림 |
| `/dev/random` | `c` | 블로킹 난수 |
| `/dev/urandom` | `c` | 논블로킹 난수 |
| `/dev/sda` | `b` | 첫 번째 SATA 디스크 |
| `/dev/tty` | `c` | 제어 터미널 |
| `/dev/pts/0` | `c` | 첫 번째 가상 터미널 |

---

**지난 글:** [하드 링크 vs 심볼릭 링크: 연결의 두 가지 방식](/posts/linux-hard-vs-soft-link/)

<br>
읽어주셔서 감사합니다. 😊
