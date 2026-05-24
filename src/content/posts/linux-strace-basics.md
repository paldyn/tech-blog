---
title: "strace 기초 — 시스템 콜 추적으로 프로그램 내부 들여다보기"
description: "strace의 ptrace 기반 동작 원리, 기본/고급 옵션, -e trace 필터, -c 통계, 실전 디버깅 시나리오(파일 없음·권한 거부·네트워크 연결 실패) 해결법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 10
type: "knowledge"
category: "Linux"
tags: ["linux", "strace", "debugging", "syscall", "ptrace", "performance", "troubleshooting"]
featured: false
draft: false
---

[지난 글](/posts/linux-memory-leak-investigation/)에서 메모리 누수를 조사하는 도구들을 살펴봤습니다. 이번에는 **strace** — 프로그램이 커널에 어떤 시스템 콜을 보내는지 실시간으로 추적하는 도구를 알아봅니다. 소스 코드 없이도 프로그램이 어떤 파일을 열려 하는지, 왜 실패하는지, 어떤 네트워크 연결을 시도하는지 파악할 수 있습니다.

## 동작 원리

strace는 Linux의 `ptrace()` 시스템 콜을 이용합니다. 대상 프로세스가 시스템 콜을 호출할 때마다 커널이 strace를 깨워 진입/종료 시점의 레지스터 값을 읽게 합니다. 소스 코드 수정이나 라이브러리 치환 없이 순수하게 커널 레벨에서 관찰합니다.

![strace 동작 원리](/assets/posts/linux-strace-basics-concept.svg)

strace 출력 형식:
```
syscall_name(인자1, 인자2, ...) = 반환값
```
에러 시에는 `-1 ERRNO_NAME (설명)` 형태로 표시됩니다.

## 기본 사용법

```bash
# 새 프로세스 실행하며 추적
strace ls /tmp

# 실행 중인 프로세스에 attach
sudo strace -p 1234

# 자식 프로세스까지 추적 (-f)
sudo strace -f -p 1234

# 표준 에러 대신 파일에 저장
sudo strace -o /tmp/trace.log -p 1234

# 타임스탬프 포함
strace -tt ls /tmp

# 각 시스템 콜 소요 시간
strace -T ls /tmp
```

## 필터링 옵션

출력이 너무 많을 때 `-e trace` 옵션으로 특정 카테고리만 볼 수 있습니다.

![strace 명령어](/assets/posts/linux-strace-basics-commands.svg)

```bash
# 파일 접근 관련 콜만
strace -e trace=file ls

# 네트워크 관련 콜만 (실행 중 프로세스)
sudo strace -e trace=network -p 1234

# 특정 콜 이름 지정
strace -e openat,read,write cat /etc/hosts

# 프로세스 생성 관련
strace -e trace=process bash -c "echo hello"

# 메모리 관련
strace -e trace=memory ./my_program
```

## 통계 모드 (-c)

어떤 시스템 콜이 얼마나 자주, 얼마나 오래 호출되는지 요약합니다.

```bash
strace -c ls /

# 출력 예시:
# % time     seconds  usecs/call     calls    errors syscall
# ------ ----------- ----------- --------- --------- ----------------
#  38.16    0.000291          36         8           mmap
#  21.05    0.000160          40         4           read
#  15.79    0.000120          24         5           openat
#  10.53    0.000080          80         1           execve
```

성능 프로파일링보다 디버깅에 더 유용합니다. 어떤 콜이 에러가 많은지 (`errors` 컬럼) 한눈에 볼 수 있습니다.

## 실전 디버깅 시나리오

### 1. 파일을 찾지 못하는 앱

`No such file or directory` 에러가 나는 앱이 어떤 경로를 찾는지 파악합니다.

```bash
# ENOENT(파일 없음) 발생 위치 찾기
strace -e openat ./my_app 2>&1 | grep ENOENT

# 출력:
# openat(AT_FDCWD, "/etc/myapp/config.yml", O_RDONLY) = -1 ENOENT
# openat(AT_FDCWD, "/home/user/.myapp.yml", O_RDONLY) = -1 ENOENT
# → 앱이 찾는 설정 파일 위치를 정확히 알 수 있음
```

### 2. 권한 거부 문제

```bash
strace -e openat,access -p 1234 2>&1 | grep EACCES

# openat(AT_FDCWD, "/var/log/app.log", O_WRONLY|O_APPEND) = -1 EACCES
# → 로그 파일 쓰기 권한 없음 → chmod or 사용자 변경
```

### 3. 네트워크 연결 실패

```bash
strace -e connect,socket,sendto -p 1234 2>&1 | grep -E 'connect|REFUSED|TIMEOUT'

# connect(4, {sa_family=AF_INET, sin_port=htons(5432), sin_addr="127.0.0.1"}, 16) = -1 ECONNREFUSED
# → PostgreSQL 포트 5432에 연결 실패 → DB 실행 여부 확인
```

### 4. 느린 프로세스 원인 분석

```bash
# 시간이 오래 걸리는 콜 찾기 (10ms 이상)
strace -T -p 1234 2>&1 | awk -F'<' '$2+0 > 0.01 {print}'

# read(5, ...) = 1024 <0.032156>  ← 32ms 소요
# → slow I/O 위치 파악
```

### 5. 실행 파일이 로드하는 라이브러리

```bash
strace -e openat ./my_binary 2>&1 | grep '.so'

# openat(AT_FDCWD, "/lib/x86_64-linux-gnu/libssl.so.3", O_RDONLY) = 3
# openat(AT_FDCWD, "/lib/x86_64-linux-gnu/libcrypto.so.3", O_RDONLY) = 3
```

## 주의사항

**성능 오버헤드**: strace는 모든 시스템 콜마다 컨텍스트 스위치를 유발합니다. I/O 집약적인 프로세스에서는 10배 이상 느려질 수 있습니다. 프로덕션 환경에서는 짧은 시간만 사용하거나 `-e trace` 필터로 범위를 좁혀야 합니다.

**더 낮은 오버헤드 대안**: `perf trace`는 strace와 비슷하지만 eBPF 기반이라 오버헤드가 훨씬 낮습니다.

```bash
# perf trace (strace 대안, 낮은 오버헤드)
sudo perf trace -p 1234

# 특정 콜만
sudo perf trace -e openat -p 1234
```

**보안**: `ptrace`는 프로세스의 메모리를 읽을 수 있는 강력한 권한입니다. 다른 사용자의 프로세스를 추적하려면 root 권한이 필요하고, `/proc/sys/kernel/yama/ptrace_scope` 설정에 따라 제한될 수 있습니다.

---

**지난 글:** [메모리 누수 조사 — valgrind·heaptrack·smaps로 원인 찾기](/posts/linux-memory-leak-investigation/)

<br>
읽어주셔서 감사합니다. 😊
