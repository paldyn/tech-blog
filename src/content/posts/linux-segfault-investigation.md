---
title: "Segmentation Fault 조사 — 세그멘테이션 폴트 원인 분석"
description: "Segmentation Fault(SIGSEGV) 발생 시 dmesg 로그 해독, 코어 덤프 활성화, gdb 백트레이스 분석, Valgrind/AddressSanitizer를 이용한 메모리 오류 추적 방법을 단계별로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 4
type: "knowledge"
category: "Linux"
tags: ["linux", "segfault", "gdb", "coredump", "valgrind", "debugging", "troubleshooting"]
featured: false
draft: false
---

[지난 글](/posts/linux-permission-denied/)에서 권한 거부 문제를 계층별로 추적했다. 이번에는 프로세스가 갑자기 비정상 종료되면서 "Segmentation fault (core dumped)"를 남기는 상황을 다룬다. 세그멘테이션 폴트는 커널이 프로세스를 강제로 종료하는 신호(SIGSEGV)로, 허가되지 않은 메모리 영역에 접근했을 때 발생한다. 원인은 NULL 포인터 역참조, 버퍼 오버플로, 해제된 메모리 재접근(Use-After-Free) 등 다양하다.

## Segmentation Fault 메커니즘

CPU가 메모리 접근 명령을 처리할 때 MMU(Memory Management Unit)가 해당 가상 주소가 유효한지, 접근 권한(읽기/쓰기/실행)이 맞는지 확인한다. 위반이 발생하면 페이지 폴트 예외가 발생하고, 커널은 이를 SIGSEGV로 변환해 프로세스에 전달한다. 기본 핸들러는 프로세스를 종료하고 코어 덤프를 생성한다.

![Segmentation Fault 조사 흐름](/assets/posts/linux-segfault-investigation-flow.svg)

## 1단계 — dmesg 커널 로그 확인

```bash
dmesg | grep segfault | tail -5
# 예:
# myapp[4321]: segfault at 0 ip 00401a3c sp 7ffed3a0 error 4 in myapp[400000+20000]
```

로그 항목 해독:
- `at 0` — NULL 포인터(주소 0) 접근
- `ip 00401a3c` — 충돌 발생 명령어 주소
- `sp 7ffed3a0` — 스택 포인터 (스택 오버플로 시 비정상 값)
- `error 4` — 유저 모드, 읽기 중 미매핑 페이지 접근

주소가 0이거나 매우 작으면 NULL 포인터 역참조가 가장 유력하다.

## 2단계 — 코어 덤프 활성화

코어 덤프 크기가 0으로 제한되어 있으면 분석할 파일이 생성되지 않는다.

```bash
# 현재 한도 확인
ulimit -c

# 현재 세션에서 무제한 허용
ulimit -c unlimited

# 코어 덤프 위치 확인
cat /proc/sys/kernel/core_pattern
```

systemd를 사용하는 시스템에서는 `systemd-coredump`가 관리한다.

```bash
# 코어 덤프 목록 확인 (systemd-coredump)
coredumpctl list

# 특정 실행 파일의 최신 코어 덤프 분석
coredumpctl gdb myapp
```

![Segfault 조사 핵심 명령어](/assets/posts/linux-segfault-investigation-tools.svg)

## 3단계 — gdb로 백트레이스 분석

디버그 심볼을 포함해 재빌드(`-g` 플래그)한 바이너리와 코어 파일을 함께 gdb에 전달한다.

```bash
gcc -g -O0 -o myapp main.c
./myapp        # 크래시 유발
gdb ./myapp core
```

gdb 안에서 실행할 명령:

```
(gdb) bt              # 백트레이스 (호출 스택)
(gdb) bt full         # 지역 변수 포함 상세 스택
(gdb) frame 2         # 특정 스택 프레임 선택
(gdb) info locals     # 현재 프레임 지역 변수
(gdb) print ptr       # 변수 값 출력
(gdb) x/10x $sp       # 스택 메모리 덤프
```

`bt` 출력의 최상위 프레임이 충돌 위치다. 소스 파일명과 줄 번호가 표시되면 해당 코드를 직접 확인한다.

## 4단계 — Valgrind로 메모리 오류 추적

gdb만으로는 원인을 찾기 어려울 때 Valgrind가 메모리 접근 오류를 실시간으로 보고한다.

```bash
valgrind --leak-check=full --show-error-list=yes ./myapp args
```

주요 보고 유형:
- `Invalid read of size 4` — 허용 범위 밖 읽기 (버퍼 오버플로)
- `Use of uninitialised value` — 초기화되지 않은 변수 사용
- `Invalid free()` — 이미 해제된 메모리 재해제

## 5단계 — AddressSanitizer (ASAN)

Valgrind보다 빠르게 실행되며 현대 컴파일러에 내장된 메모리 오류 탐지 도구다.

```bash
# ASAN을 활성화해 컴파일
gcc -fsanitize=address -fsanitize=undefined -g -o myapp main.c

# 실행하면 오류 발생 시 상세 보고
./myapp
# ==4567==ERROR: AddressSanitizer: heap-buffer-overflow
# READ of size 4 at 0x602000000050
```

ASAN은 힙 버퍼 오버플로, 스택 버퍼 오버플로, Use-After-Free, 이중 해제를 탐지한다.

## 공통 원인 패턴

```c
// NULL 포인터 역참조
char *ptr = NULL;
*ptr = 'a';   // SIGSEGV: at 0

// 버퍼 오버플로
char buf[10];
strcpy(buf, "more than 10 chars");   // 스택 오버플로

// Use-After-Free
free(ptr);
printf("%c", *ptr);   // 해제 후 접근
```

## strace로 충돌 syscall 확인

```bash
strace -f -o strace.log ./myapp 2>&1 | tail -20
grep -E "SIGSEGV|killed" strace.log
```

Segfault는 보통 특정 입력 값이나 상태에서만 재현된다. `dmesg`로 주소를 확인하고, 코어 덤프 + gdb 백트레이스로 스택을 보고, Valgrind 또는 ASAN으로 정확한 코드 위치를 찾는 순서가 가장 효율적이다.

---

**지난 글:** [Permission Denied — 권한 거부 트러블슈팅](/posts/linux-permission-denied/)

**다음 글:** [프로세스 멈춤 — Hung Process 조사](/posts/linux-process-hung/)

<br>
읽어주셔서 감사합니다. 😊
