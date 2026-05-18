---
title: "bpftrace — eBPF 기반 동적 추적 입문"
description: "bpftrace로 커널·사용자 공간 함수를 동적으로 추적하는 방법을 설명합니다. kprobe, tracepoint, uprobe 프로브 타입과 count·histogram·printf 내장 함수, 실전 원라이너를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 8
type: "knowledge"
category: "Linux"
tags: ["linux", "bpftrace", "ebpf", "tracing", "kprobe", "tracepoint", "uprobe", "performance"]
featured: false
draft: false
---

[지난 글](/posts/linux-perf-basics/)에서 perf로 CPU 이벤트를 프로파일링하는 방법을 배웠습니다. perf가 샘플링 기반 분석이라면, `bpftrace`는 **이벤트 기반 동적 추적**입니다. 리부팅 없이, 커널 모듈 없이, 단 한 줄의 스크립트로 커널 내부 함수를 추적할 수 있습니다.

## eBPF란

eBPF(extended Berkeley Packet Filter)는 리눅스 커널 안의 안전한 가상 머신입니다. 사용자가 작성한 프로그램을 커널 verifier가 안전성을 검증한 후 JIT 컴파일해 실행합니다. 커널 코드 수정 없이 커널 내부를 계측할 수 있어 성능 저하가 극히 적습니다.

```bash
# bpftrace 설치
apt install bpftrace    # Ubuntu 20.04+

# 커널 헤더 필요 (일부 환경)
apt install linux-headers-$(uname -r)

# 버전 확인
bpftrace --version
```

## 첫 번째 원라이너

```bash
# Hello World: 프로세스 실행 이벤트 추적
sudo bpftrace -e 'tracepoint:syscalls:sys_enter_execve { printf("%s called execve\n", comm); }'

# 초당 시스템 콜 횟수 집계 (5초 후 출력)
sudo bpftrace -e 'tracepoint:raw_syscalls:sys_enter { @[comm] = count(); } interval:s:5 { print(@); clear(@); }'
```

## bpftrace 언어 기초

bpftrace는 AWK와 비슷한 `probe { action }` 구조입니다.

```bash
# 기본 구조
# probe_type:target:action_point { 액션 }

# 내장 변수
# pid    : 현재 프로세스 PID
# comm   : 현재 프로세스 이름
# args   : 프로브 인자 구조체
# retval : 함수 리턴값 (kretprobe/uretprobe)
# nsecs  : 현재 타임스탬프 (nanoseconds)
# tid    : 현재 스레드 ID
```

## 프로브 타입

![bpftrace 프로브 타입과 예제](/assets/posts/linux-bpftrace-probes.svg)

## eBPF 아키텍처

![bpftrace / eBPF 아키텍처](/assets/posts/linux-bpftrace-architecture.svg)

## 실전 원라이너 모음

```bash
# 파일 열기 추적 (프로세스 + 파일명)
sudo bpftrace -e 'kprobe:do_sys_openat2 { printf("%s %s\n", comm, str(arg1)); }'

# 디스크 읽기 지연 히스토그램 (ms)
sudo bpftrace -e '
  kprobe:blk_account_io_start { @start[arg0] = nsecs; }
  kprobe:blk_account_io_done
  /@start[arg0]/
  { @ms = hist((nsecs - @start[arg0]) / 1000000); delete(@start[arg0]); }'

# TCP 연결 추적
sudo bpftrace -e 'kprobe:tcp_connect { printf("connect %s → %s\n", comm, ntop(0)); }'

# malloc 크기 분포 (libc)
sudo bpftrace -e 'uprobe:/lib/x86_64-linux-gnu/libc.so.6:malloc { @size = hist(arg0); }'

# 상위 syscall 집계 (Ctrl+C로 종료 시 출력)
sudo bpftrace -e 'tracepoint:raw_syscalls:sys_enter { @[comm, probe] = count(); }'
```

## bpftrace 스크립트 파일

복잡한 추적 로직은 `.bt` 파일로 저장합니다.

```bash
# /tmp/opensnoop.bt
#!/usr/bin/bpftrace
BEGIN { printf("Tracing open calls... Ctrl-C to stop\n"); }

tracepoint:syscalls:sys_enter_openat {
  printf("%-6d %-16s %s\n", pid, comm, str(args->filename));
}
```

```bash
sudo bpftrace /tmp/opensnoop.bt
```

bpftrace는 [BCC 도구 모음](https://github.com/iovisor/bcc)과 함께 현대 리눅스 성능 분석의 핵심입니다. `opensnoop`, `execsnoop`, `tcplife`, `biolatency` 같은 완성된 bpftrace 스크립트가 `/usr/share/bpftrace/tools/`에 이미 설치되어 있습니다.

---

**지난 글:** [perf — 리눅스 성능 분석 기초](/posts/linux-perf-basics/)

**다음 글:** [Bash 셔뱅과 스크립트 실행 방식](/posts/bash-shebang-and-execution/)

<br>
읽어주셔서 감사합니다. 😊
