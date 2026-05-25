---
title: "eBPF 개요 — 커널을 재컴파일 없이 관찰하는 혁신적 기술"
description: "eBPF의 동작 원리(Verifier·JIT·Maps), Hook 포인트(kprobe·tracepoint·XDP·LSM), bpftrace·BCC 도구 생태계, 성능 분석·보안·네트워킹 활용 사례를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 3
type: "knowledge"
category: "Linux"
tags: ["linux", "eBPF", "observability", "performance", "security", "bpftrace", "BCC", "kernel"]
featured: false
draft: false
---

[지난 글](/posts/linux-lsof/)에서 lsof로 열린 파일과 소켓을 조회하는 방법을 배웠습니다. 이번에는 현대 리눅스 커널에서 가장 혁신적인 기술 중 하나인 **eBPF(extended Berkeley Packet Filter)**를 살펴봅니다. 커널을 재컴파일하거나 커널 모듈을 로드하지 않고, 안전하게 커널 내부를 관찰하고 프로그래밍할 수 있는 기술입니다.

## eBPF란 무엇인가

원래 BPF는 1992년 네트워크 패킷 필터링을 위해 설계된 가상 머신이었습니다. 리눅스 3.18(2014년)부터 크게 확장되어 "extended BPF"가 됐고, 이제는 패킷 필터링을 넘어 **커널의 어느 이벤트에나 붙어서 안전하게 프로그램을 실행**할 수 있는 범용 커널 프로그래밍 플랫폼이 됐습니다.

![eBPF 아키텍처](/assets/posts/linux-eBPF-overview-arch.svg)

핵심 특징:
- **안전성**: Verifier가 모든 프로그램을 사전 검증 (무한 루프·메모리 범위 초과 차단)
- **성능**: JIT 컴파일로 네이티브 코드 수준 속도
- **재부팅 불필요**: 커널 재시작 없이 런타임에 동적 로드
- **격리**: 버그가 있는 eBPF 프로그램이 커널을 크래시시키지 못함

## 동작 원리

1. **작성**: C 또는 Rust로 eBPF 프로그램 작성 → clang으로 eBPF bytecode(.o) 컴파일
2. **로드**: 유저스페이스 로더(libbpf, BCC)가 `bpf()` syscall로 커널에 전달
3. **검증**: Verifier가 안전성 검사 (허용된 명령어, 메모리 범위, 루프 탈출 보장)
4. **JIT 컴파일**: 검증 통과 후 아키텍처별 네이티브 코드로 변환
5. **Attach**: Hook 포인트에 연결 (kprobe, tracepoint, XDP 등)
6. **실행**: 이벤트 발생 시 커널이 eBPF 프로그램 호출
7. **데이터 공유**: eBPF Maps를 통해 커널↔유저스페이스 데이터 교환

## Hook 포인트 종류

| 유형 | 설명 | 사용 예 |
|------|------|---------|
| kprobe | 커널 함수 시작/종료 | `do_sys_open` 추적 |
| kretprobe | 커널 함수 반환 값 | 반환 코드 수집 |
| tracepoint | 커널 정적 트레이스 포인트 | `syscalls:sys_enter_read` |
| uprobe | 유저스페이스 함수 | `libc:malloc` 추적 |
| XDP | 네트워크 스택 최하단 | DDoS 필터링, 로드밸런싱 |
| tc | 트래픽 컨트롤 후크 | 패킷 조작 |
| LSM | 보안 모듈 후크 | 파일 접근 제어 |
| perf_event | 하드웨어 성능 카운터 | CPU 프로파일링 |

## 설치

```bash
# Ubuntu/Debian
sudo apt install bpftrace bpfcc-tools \
  linux-headers-$(uname -r)

# RHEL/Fedora
sudo dnf install bpftrace bcc-tools \
  kernel-headers

# 커널 eBPF 지원 확인
uname -r  # 5.x 이상 권장
ls /sys/kernel/btf/vmlinux  # BTF 지원 확인
```

## bpftrace 기초

bpftrace는 awk와 유사한 문법으로 eBPF 프로그램을 한 줄로 작성할 수 있는 고수준 도구입니다.

```bash
# 모든 프로세스의 syscall 횟수
sudo bpftrace -e 'tracepoint:raw_syscalls:sys_enter { @[comm] = count() }'

# 파일 열기 추적
sudo bpftrace -e 'tracepoint:syscalls:sys_enter_openat { printf("%s %s\n", comm, str(args->filename)); }'

# read() 레이턴시 히스토그램
sudo bpftrace -e 'kretprobe:vfs_read { @us = hist(nsecs/1000); }'

# 특정 프로세스 추적
sudo bpftrace -e 'kprobe:do_sys_open /comm == "nginx"/ { printf("%s\n", str(arg1)); }'
```

![eBPF 도구 생태계](/assets/posts/linux-eBPF-overview-tools.svg)

## BCC 도구 모음

BCC(BPF Compiler Collection)는 즉시 사용 가능한 eBPF 기반 도구를 제공합니다.

```bash
# 프로세스 실행 추적
sudo execsnoop

# 파일 열기 추적
sudo opensnoop

# 느린 I/O (10ms 이상)
sudo biolatency -D

# TCP 연결 추적
sudo tcptracer

# CPU 프로파일링 (플레임 그래프용)
sudo profile -F 99 -f 30 > /tmp/out.txt

# 느린 ext4 작업 (10ms 이상)
sudo ext4slower 10

# MySQL 쿼리 레이턴시
sudo dbslower mysql
```

## eBPF Maps — 데이터 공유 메커니즘

eBPF Maps는 커널 eBPF 프로그램과 유저스페이스 간 데이터를 공유하는 자료구조입니다.

```c
// eBPF 프로그램에서 Map 선언 (C)
struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, 1024);
    __type(key, u32);       // PID
    __type(value, u64);     // count
} syscall_count SEC(".maps");

// Map 업데이트
u32 pid = bpf_get_current_pid_tgid();
u64 *cnt = bpf_map_lookup_elem(&syscall_count, &pid);
if (cnt) (*cnt)++;
```

Map 유형:
- `BPF_MAP_TYPE_HASH`: 키-값 해시 테이블
- `BPF_MAP_TYPE_ARRAY`: 인덱스 기반 배열
- `BPF_MAP_TYPE_RINGBUF`: 고성능 이벤트 스트림 (최신 커널 권장)
- `BPF_MAP_TYPE_PERF_EVENT_ARRAY`: perf 이벤트 버퍼

## 실전 활용 시나리오

### 성능 병목 찾기

```bash
# 느린 함수 찾기 (1ms 이상)
sudo funclatency -u 1000 vfs_read

# 스택 추적으로 핫 코드 경로 파악
sudo profile -F 99 30
```

### 보안 모니터링

```bash
# 특권 명령 실행 감지 (실시간)
sudo bpftrace -e 'tracepoint:syscalls:sys_enter_execve { printf("%s %s\n", comm, str(args->filename)); }'

# 외부 연결 시도 감지
sudo tcptracer | grep -v "127.0.0.1"
```

### 컨테이너 관측

Cilium은 eBPF를 이용해 iptables 없이 쿠버네티스 네트워크 정책을 구현합니다. Falco는 eBPF로 컨테이너 런타임 보안 이벤트를 실시간 탐지합니다.

## strace/ltrace와의 비교

| 도구 | 방식 | 오버헤드 | 커널 수정 |
|------|------|---------|---------|
| strace | ptrace syscall | 높음 (2-10x) | 불필요 |
| ltrace | PLT 후킹 | 중간 | 불필요 |
| eBPF | JIT 네이티브 | 매우 낮음 (<1%) | 불필요 |
| 커널 모듈 | 네이티브 | 없음 | 불필요 |

eBPF는 strace와 달리 프로덕션 환경에서도 안전하게 실행할 수 있을 만큼 오버헤드가 낮습니다.

---

**지난 글:** [lsof — 열린 파일과 소켓 한눈에 보기](/posts/linux-lsof/)

**다음 글:** [Flame Graph — CPU 병목을 시각화하는 플레임 그래프](/posts/linux-flame-graphs/)

<br>
읽어주셔서 감사합니다. 😊
