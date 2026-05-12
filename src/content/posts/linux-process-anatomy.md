---
title: "프로세스 해부학 — 리눅스 프로세스의 구조와 생명주기"
description: "PID·PPID·UID, 가상 메모리 레이아웃(Text/Data/Heap/Stack), 파일 디스크립터 테이블, /proc/[pid]/ 가상 파일시스템을 통해 리눅스 프로세스의 내부 구조를 완전히 이해합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 1
type: "knowledge"
category: "Linux"
tags: ["linux", "process", "pid", "memory", "proc", "file-descriptor", "virtual-memory"]
featured: false
draft: false
---

[지난 글](/posts/linux-immutable-files/)에서 `chattr +i`로 파일에 불변 속성을 부여하는 방법을 살펴봤습니다. 이번 글부터는 리눅스 프로세스 관리 시리즈로 넘어가, 프로세스가 무엇인지 내부 구조부터 파고듭니다.

## 프로세스란 무엇인가

프로세스(Process)는 **실행 중인 프로그램의 인스턴스**입니다. `/usr/bin/bash` 파일 자체는 디스크 위의 정적 바이트일 뿐이지만, 커널이 그것을 메모리에 올려 실행 상태로 만들면 비로소 프로세스가 됩니다. 같은 바이너리라도 두 번 실행하면 두 개의 독립 프로세스가 생기며, 각자 고유한 PID와 주소 공간을 갖습니다.

커널은 각 프로세스를 **PCB(Process Control Block)** — 리눅스에서는 `task_struct` 구조체 — 로 추적합니다. `task_struct`에는 PID, 스케줄링 정보, 메모리 맵 포인터, 열린 파일 목록 등 프로세스에 관한 모든 상태가 담깁니다.

## 프로세스 식별자

| 항목 | 설명 |
|------|------|
| **PID** | Process ID — 시스템 전체에서 고유한 양의 정수 |
| **PPID** | Parent PID — 이 프로세스를 생성(fork)한 부모의 PID |
| **PGID** | Process Group ID — 파이프라인 그룹, 시그널 일괄 전달에 사용 |
| **SID** | Session ID — 터미널 세션 단위, 로그아웃 시 일괄 종료 |
| **UID/GID** | 실행 사용자·그룹 ID — 파일 접근 권한 결정 |
| **EUID/EGID** | 유효 UID/GID — setuid 바이너리 실행 시 변경 |

```bash
# 현재 셸 프로세스의 주요 ID 확인
echo "PID=$$  PPID=$PPID  UID=$(id -u)  GID=$(id -g)"

# 특정 프로세스의 PID·PPID 확인
cat /proc/$$/status | grep -E "^(Pid|PPid|Uid|Gid):"
```

PID 1은 항상 `systemd`(또는 구형 시스템에선 `init`)이며, 시스템에서 가장 먼저 생성되는 사용자 공간 프로세스입니다. 고아 프로세스는 모두 PID 1에 입양됩니다.

## 가상 메모리 레이아웃

리눅스는 각 프로세스에 독립된 **가상 주소 공간**을 부여합니다. 32비트 시스템에선 4 GB, 64비트에선 수십 TB에 달하는 가상 공간이 제공됩니다. 이 공간은 아래에서 위로 다음과 같이 구성됩니다.

![프로세스 구조 — 메타데이터·메모리·파일디스크립터](/assets/posts/linux-process-anatomy-structure.svg)

- **Text segment**: 컴파일된 기계어 코드. 읽기 전용이며 여러 프로세스가 공유 가능(shared library 포함)
- **Data segment**: 초기값이 있는 전역·정적 변수(`int x = 5;`)
- **BSS segment**: 초기값 없는 전역·정적 변수(`int y;`). 커널이 0으로 초기화
- **Heap**: `malloc()`/`new`로 동적 할당. `brk()`/`mmap()` 시스템 콜로 확장, 위쪽으로 성장
- **Stack**: 함수 호출 프레임, 지역 변수, 반환 주소. 아래쪽으로 성장

```bash
# 프로세스의 메모리 맵 확인
cat /proc/$$/maps | head -20

# VSZ(가상 크기)와 RSS(실제 물리 메모리) 확인
ps -o pid,vsz,rss,comm -p $$
```

`VSZ`는 가상 주소 공간 전체 크기, `RSS`는 실제로 물리 메모리에 올라온 크기입니다. 차이가 크다면 아직 접근하지 않은 페이지가 많다는 뜻입니다(Demand Paging).

## 파일 디스크립터 테이블

프로세스는 열린 파일을 **파일 디스크립터(fd)** — 0 이상의 정수 — 로 참조합니다. 커널 내부에선 fd → 파일 테이블 항목 → inode의 3단계 간접 참조 구조입니다.

| fd | 이름 | 기본 연결 |
|----|------|-----------|
| 0 | stdin | 터미널 입력 |
| 1 | stdout | 터미널 출력 |
| 2 | stderr | 터미널 오류 출력 |
| 3+ | 사용자 정의 | `open()`, `socket()` 등 |

```bash
# 현재 셸이 열고 있는 fd 목록
ls -la /proc/$$/fd

# 특정 프로세스(PID 1)의 fd 개수
ls /proc/1/fd | wc -l
```

`fork()` 시 자식 프로세스는 부모의 fd 테이블을 **복사**합니다. 같은 파일 테이블 항목을 공유하므로 파일 오프셋도 공유됩니다. `exec()`는 `O_CLOEXEC` 플래그가 없는 fd를 그대로 유지합니다.

## /proc/[pid]/ 가상 파일시스템

`/proc`는 디스크에 아무것도 없는 **가상 파일시스템**입니다. 커널이 읽기 요청을 받을 때마다 실시간으로 데이터를 생성해 돌려줍니다. PID별 디렉터리를 통해 실행 중인 프로세스를 파일처럼 탐색할 수 있습니다.

![/proc/[PID]/ 가상 파일시스템 구조](/assets/posts/linux-process-anatomy-proc.svg)

```bash
# 실행 중인 bash의 커맨드라인 확인
cat /proc/$$/cmdline | tr '\0' ' '; echo

# 프로세스 상태 요약 (사람이 읽기 좋은 형식)
cat /proc/$$/status

# 실행 중인 바이너리 경로
readlink /proc/$$/exe

# 메모리 사용 상세 (Smaps)
cat /proc/$$/smaps | grep -A5 "heap" | head -20
```

`/proc/[pid]/status`에서 `VmPeak`(최대 가상 메모리), `VmRSS`(현재 RSS), `Threads`(스레드 수) 등 풍부한 정보를 얻을 수 있습니다.

## 프로세스 생성 — fork와 exec

리눅스에서 새 프로세스를 만드는 방법은 딱 두 가지입니다.

```bash
# fork(): 부모를 복사해 자식 생성
# exec(): 현재 프로세스 이미지를 새 프로그램으로 교체
# 실제로는 fork() 직후 exec()를 호출하는 패턴이 일반적

# strace로 bash가 ls를 실행할 때 fork+exec 관찰
strace -e trace=clone,execve bash -c "ls /tmp" 2>&1 | head -10
```

`fork()`는 부모의 가상 주소 공간을 **Copy-on-Write(CoW)** 방식으로 복사합니다. 실제 페이지는 어느 쪽이 수정할 때까지 공유되므로 즉각적인 메모리 복사는 일어나지 않습니다. 그래서 `fork()` 자체는 매우 빠릅니다.

## 스레드와 프로세스의 관계

리눅스에서 스레드는 `clone()` 시스템 콜로 생성되며, 주소 공간·파일 테이블·시그널 핸들러를 **공유**한다는 점이 프로세스와 다릅니다. 커널 입장에서는 스레드도 독립된 `task_struct`를 가지므로 고유한 TID(Thread ID)를 부여받습니다. `ps` 명령에서 `-T` 옵션을 추가하면 스레드 단위로 볼 수 있습니다.

```bash
# 특정 프로세스의 스레드 목록
ps -T -p $(pgrep -n firefox) 2>/dev/null | head -10

# /proc/[pid]/task/ 로도 확인 가능
ls /proc/$$/task/
```

---

**다음 글:** [ps 완전 가이드 — aux와 -ef로 프로세스 목록 읽기](/posts/linux-ps-aux-ef/)

<br>
읽어주셔서 감사합니다. 😊
