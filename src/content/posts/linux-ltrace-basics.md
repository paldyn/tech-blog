---
title: "ltrace 기초 — 라이브러리 함수 호출 추적으로 동작 파악하기"
description: "ltrace의 PLT 후킹 동작 원리, 기본/고급 옵션(-e, -c, -f, -s), strace와의 차이점, 실전 디버깅 시나리오(메모리 할당 추적, 함수 필터링)를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 1
type: "knowledge"
category: "Linux"
tags: ["linux", "ltrace", "debugging", "library", "PLT", "tracing", "troubleshooting"]
featured: false
draft: false
---

[지난 글](/posts/linux-strace-basics/)에서 strace로 시스템 콜을 추적하는 방법을 배웠습니다. 이번에는 **ltrace** — 공유 라이브러리 함수 호출을 추적하는 도구를 알아봅니다. `printf()`, `malloc()`, `fopen()` 같은 libc 함수가 언제, 어떤 인자로 호출되는지 소스 코드 없이도 파악할 수 있습니다.

## 동작 원리

ltrace는 ELF 바이너리의 **PLT(Procedure Linkage Table)**를 이용합니다. 동적으로 링크된 프로그램은 라이브러리 함수를 직접 호출하지 않고 PLT를 거칩니다. ltrace는 이 PLT 엔트리에 중단점(breakpoint)을 설치해 함수 진입·종료 시점을 포착합니다.

![ltrace 동작 원리](/assets/posts/linux-ltrace-basics-concept.svg)

strace가 커널-유저 경계(시스템 콜)에서 추적한다면, ltrace는 라이브러리-애플리케이션 경계에서 추적합니다. 그 결과 ltrace는 커널 진입 없이 일어나는 `malloc()` 같은 순수 유저스페이스 함수도 잡을 수 있습니다.

## 설치

```bash
# Debian/Ubuntu
sudo apt install ltrace

# RHEL/Fedora
sudo dnf install ltrace

# Arch
sudo pacman -S ltrace
```

## 기본 사용법

```bash
# 새 프로세스 실행하며 추적
ltrace ./myprogram

# 실행 중인 프로세스에 연결
sudo ltrace -p 1234

# 자식 프로세스까지 추적
ltrace -f ./server

# 결과를 파일에 저장
ltrace -o /tmp/ltrace.log ./myprogram
```

출력 형식은 strace와 유사합니다.

```
라이브러리함수(인자, ...) = 반환값
```

예를 들어 `puts("Hello") = 6`은 `puts`가 `"Hello"`를 인자로 받아 6을 반환했다는 의미입니다.

## 주요 옵션

![ltrace 명령어 옵션](/assets/posts/linux-ltrace-basics-commands.svg)

### `-e`: 특정 함수만 필터링

```bash
# malloc만 추적
ltrace -e malloc ./app

# malloc과 free 함께
ltrace -e 'malloc+free' ./app

# 패턴 매칭 (m으로 시작하는 모든 함수)
ltrace -e 'm*' ./app
```

### `-c`: 통계 요약

```bash
ltrace -c ./myprogram
```

종료 시 각 함수의 호출 횟수, 총 소요 시간, 평균 시간을 표로 출력합니다. 어느 함수가 병목인지 빠르게 파악할 수 있습니다.

### `-s`: 문자열 출력 길이 조정

기본값은 32자로 잘립니다. 긴 문자열을 보려면:

```bash
ltrace -s 256 ./app
```

### `-n`: 중첩 깊이 들여쓰기

```bash
# 함수 호출 계층을 들여쓰기로 표현
ltrace -n 2 ./app
```

## 실전 시나리오

### 메모리 누수 단서 찾기

```bash
# malloc/free 불균형 확인
ltrace -e 'malloc+free+realloc' -c ./app

# 각 malloc 호출의 크기와 주소 추적
ltrace -e malloc ./app 2>&1 | grep malloc
```

`malloc` 호출 횟수가 `free`보다 현저히 많다면 누수를 의심할 수 있습니다.

### 파일 접근 패턴 파악

```bash
ltrace -e 'fopen+fclose+fread+fwrite' ./app
```

어떤 파일을 어떤 순서로 열고 닫는지 추적합니다.

### 암호화 라이브러리 호출 확인

```bash
ltrace -e '*ssl*+*crypto*' ./app
```

OpenSSL 함수 호출 흐름을 파악할 때 유용합니다.

## ltrace가 동작하지 않는 경우

ltrace는 PLT를 통한 동적 링킹에 의존합니다. 다음 경우에는 사용할 수 없습니다.

| 상황 | 이유 | 대안 |
|------|------|------|
| 정적 링킹(static binary) | PLT 없음 | gdb, strace |
| Go 바이너리 | Go 런타임이 자체 링킹 | Delve, eBPF |
| strip된 심볼 | 함수명 매핑 불가 | addr2line + objdump |
| 직접 syscall | libc 우회 | strace |

```bash
# 동적 링킹 여부 확인
file ./myprogram
ldd ./myprogram
```

`not a dynamic executable` 이 나오면 ltrace를 사용할 수 없습니다.

## strace와 병행 사용

시스템 콜과 라이브러리 콜을 동시에 보려면 두 도구를 조합합니다.

```bash
# strace로 시스템 콜 확인
strace -e trace=file ./app

# ltrace로 라이브러리 콜 확인
ltrace -e 'fopen+fclose' ./app

# 비교: fopen()이 내부적으로 open() syscall을 호출하는지 확인 가능
```

일반적으로 `fopen()` 같은 libc 함수 한 번 호출이 `open()`, `fstat()` 등 여러 syscall로 이어집니다. ltrace는 "라이브러리 레벨에서 뭘 호출했는가", strace는 "커널 레벨에서 뭘 했는가"를 보여줍니다.

---

**지난 글:** [strace 기초 — 시스템 콜 추적으로 프로그램 내부 들여다보기](/posts/linux-strace-basics/)

**다음 글:** [lsof — 열린 파일과 소켓 한눈에 보기](/posts/linux-lsof/)

<br>
읽어주셔서 감사합니다. 😊
